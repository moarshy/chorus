import { query, type Query, type SDKPartialAssistantMessage } from '@anthropic-ai/claude-agent-sdk'
import { BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { existsSync, readFileSync } from 'fs'
import * as path from 'path'
import {
  appendMessage,
  updateConversation,
  generateTitleFromMessage,
  ConversationMessage,
  ClaudeCodeMessage,
  ClaudeAssistantMessage,
  ClaudeUserMessage,
  ClaudeResultMessage,
  ClaudeSystemMessage,
  ConversationSettings,
  DEFAULT_CONVERSATION_SETTINGS,
  ToolUseBlock,
  ToolResultBlock
} from './conversation-service'
import { GitSettings, DEFAULT_GIT_SETTINGS } from '../store'
import * as gitService from './git-service'
import * as worktreeService from './worktree-service'

// ============================================
// Active Streams Management
// ============================================

// Store active query streams per conversation for interruption
const activeStreams: Map<string, Query> = new Map()

// Store session IDs for conversation continuity (runtime cache)
const agentSessions: Map<string, string> = new Map()

// Session age limit in days (Claude sessions expire after ~30 days)
const SESSION_MAX_AGE_DAYS = 25

// ============================================
// Permission Handling
// ============================================

// Pending permission requests (for canUseTool callback)
interface PendingPermission {
  resolve: (response: { approved: boolean; reason?: string; stopCompletely?: boolean }) => void
  reject: (error: Error) => void
  timeoutId: NodeJS.Timeout
}
const pendingPermissions: Map<string, PendingPermission> = new Map()

// Permission timeout (5 minutes)
const PERMISSION_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Resolve a pending permission request (called from IPC handler)
 */
export function resolvePermission(
  requestId: string,
  response: { approved: boolean; reason?: string; stopCompletely?: boolean }
): boolean {
  const pending = pendingPermissions.get(requestId)
  if (!pending) {
    console.warn(`[SDK] No pending permission for requestId: ${requestId}`)
    return false
  }

  clearTimeout(pending.timeoutId)
  pendingPermissions.delete(requestId)
  pending.resolve(response)
  return true
}

/**
 * Cancel all pending permissions for a conversation (e.g., on stop)
 */
function cancelPendingPermissions(conversationId: string): void {
  for (const [requestId, pending] of pendingPermissions.entries()) {
    if (requestId.startsWith(conversationId)) {
      clearTimeout(pending.timeoutId)
      pending.reject(new Error('Agent stopped'))
      pendingPermissions.delete(requestId)
    }
  }
}

// ============================================
// Path Validation (Security)
// ============================================

// Tools that operate on file paths and need validation
const FILE_PATH_TOOLS = ['Read', 'Write', 'Edit', 'MultiEdit']

/**
 * Check if a file path is within the allowed workspace directory.
 * This prevents agents from reading/writing files outside their workspace.
 */
function isPathWithinWorkspace(filePath: string, workspacePath: string): boolean {
  // Resolve both paths to absolute, normalized forms
  const resolvedFile = path.resolve(workspacePath, filePath)
  const resolvedWorkspace = path.resolve(workspacePath)

  // Check if the file path starts with the workspace path
  // Use path.sep to ensure we match directory boundaries (not partial names)
  const normalizedFile = resolvedFile + (resolvedFile.endsWith(path.sep) ? '' : '')
  const normalizedWorkspace = resolvedWorkspace + path.sep

  return normalizedFile.startsWith(normalizedWorkspace) || resolvedFile === resolvedWorkspace
}

/**
 * Extract file path from tool input based on tool name
 */
function getFilePathFromToolInput(toolName: string, toolInput: Record<string, unknown>): string | null {
  if (toolName === 'Read' || toolName === 'Write' || toolName === 'Edit') {
    return (toolInput.file_path as string) || null
  }
  if (toolName === 'MultiEdit') {
    // MultiEdit has an array of edits, check the file_path
    return (toolInput.file_path as string) || null
  }
  return null
}

// ============================================
// Automated Git Operations
// ============================================

// Track which conversations have agent branches (exported for other services)
export const conversationBranches: Map<string, string> = new Map()

// Track files changed per turn (for commit-per-turn)
const turnFileChanges: Map<string, Set<string>> = new Map()

// Track user prompts for commit message generation
const sessionPrompts: Map<string, string[]> = new Map()

// Track original branch to restore after merge (exported for other services)
export const originalBranches: Map<string, string> = new Map()

// Track worktree paths per conversation (for commit operations)
const conversationWorktrees: Map<string, string> = new Map()

/**
 * Generate branch name for agent session
 */
export function generateAgentBranchName(agentName: string, sessionId: string): string {
  const sanitizedAgentName = agentName.toLowerCase().replace(/[^a-z0-9]/g, '-')
  const shortSessionId = sessionId.slice(0, 7)
  return `agent/${sanitizedAgentName}/${shortSessionId}`
}

/**
 * Ensure agent branch exists and is checked out
 * Exported for use by other agent services (e.g., OpenAI Research)
 *
 * When useWorktrees is enabled:
 * - Branch is created but NOT checked out in main repo
 * - The worktree will have the branch checked out separately
 *
 * When useWorktrees is disabled (legacy mode):
 * - Branch is created and checked out in main repo
 * - Original branch is saved for later restoration
 */
export async function ensureAgentBranch(
  conversationId: string,
  sessionId: string,
  agentName: string,
  repoPath: string,
  mainWindow: BrowserWindow,
  gitSettings: GitSettings
): Promise<string | null> {
  // Check if we already have a branch for this conversation
  if (conversationBranches.has(conversationId)) {
    return conversationBranches.get(conversationId)!
  }

  // Check git settings for auto-branch enabled
  if (!gitSettings.autoBranch) {
    console.log('[SDK] Auto-branch disabled in settings')
    return null
  }

  // Check if this is a git repo
  const isRepo = await gitService.isRepo(repoPath)
  if (!isRepo) {
    console.log('[SDK] Not a git repo, skipping auto-branch')
    return null
  }

  const branchName = generateAgentBranchName(agentName, sessionId)

  // If using worktrees, just register the branch name
  // The worktree will be created with the branch in sendMessageSDK
  if (gitSettings.useWorktrees) {
    console.log(`[SDK] Using worktrees - registering branch ${branchName} for conversation`)
    conversationBranches.set(conversationId, branchName)

    // Notify renderer
    mainWindow.webContents.send('git:branch-created', {
      conversationId,
      branchName,
      agentName
    })

    return branchName
  }

  // Legacy mode: checkout branch in main repo
  try {
    // Save original branch for later restoration
    const currentBranch = await gitService.getBranch(repoPath)
    if (currentBranch) {
      originalBranches.set(conversationId, currentBranch)
    }

    // Get the default branch (main or master) to use as base
    const defaultBranch = await gitService.getDefaultBranch(repoPath)
    if (!defaultBranch) {
      console.log('[SDK] No main/master branch found, using current branch as base')
    }
    const baseBranch = defaultBranch || currentBranch || 'HEAD'

    // Check for uncommitted changes
    const status = await gitService.getStatus(repoPath)
    if (status.isDirty) {
      // Stash changes before branching
      await gitService.stash(repoPath, `Pre-agent stash for ${branchName}`)
      console.log('[SDK] Stashed uncommitted changes')
    }

    // Check if branch already exists
    const exists = await gitService.branchExists(repoPath, branchName)
    if (exists) {
      await gitService.checkout(repoPath, branchName)
      console.log(`[SDK] Checked out existing agent branch: ${branchName}`)
    } else {
      // Always create branch from main/master (not current branch)
      await gitService.createBranchFrom(repoPath, branchName, baseBranch)
      console.log(`[SDK] Created new agent branch: ${branchName} from ${baseBranch}`)
    }

    // Pop stash if we stashed
    if (status.isDirty) {
      try {
        await gitService.stashPop(repoPath)
        console.log('[SDK] Restored stashed changes')
      } catch (e) {
        // Stash pop may fail if conflicts - that's okay
        console.warn('[SDK] Could not pop stash (may have conflicts):', e)
      }
    }

    conversationBranches.set(conversationId, branchName)

    // Notify renderer
    mainWindow.webContents.send('git:branch-created', {
      conversationId,
      branchName,
      agentName
    })

    return branchName
  } catch (error) {
    console.error('[SDK] Failed to create agent branch:', error)
    return null
  }
}

/**
 * Generate commit message for a single turn
 */
function generateTurnCommitMessage(userPrompt: string, files: Set<string>): string {
  const maxPromptLength = 50
  let summary = userPrompt.slice(0, maxPromptLength)
  if (userPrompt.length > maxPromptLength) {
    summary += '...'
  }

  const fileList = Array.from(files)
    .map((f) => f.split('/').pop())
    .join(', ')

  return `[Agent] ${summary}\n\nFiles: ${fileList}`
}

/**
 * Generate commit message for stop event
 */
function generateStopCommitMessage(prompts: string[], files: Set<string>): string {
  const title = prompts[0]?.slice(0, 50) || 'Agent session'
  const suffix = prompts[0]?.length > 50 ? '...' : ''

  const fileList = Array.from(files)
    .map((f) => `- ${f.split('/').pop()}`)
    .join('\n')

  const promptSummary =
    prompts.length > 1
      ? `\n\nPrompts (${prompts.length}):\n${prompts.map((p, i) => `${i + 1}. ${p.slice(0, 60)}${p.length > 60 ? '...' : ''}`).join('\n')}`
      : ''

  return `[Agent - Stopped] ${title}${suffix}\n\nFiles changed:\n${fileList}${promptSummary}`
}

/**
 * Commit changes from a turn
 */
async function commitTurnChanges(
  conversationId: string,
  repoPath: string,
  userPrompt: string,
  mainWindow: BrowserWindow,
  gitSettings: GitSettings
): Promise<void> {
  // Check if auto-commit is enabled
  if (!gitSettings.autoCommit) {
    console.log('[SDK] Auto-commit disabled in settings')
    turnFileChanges.delete(conversationId)
    return
  }

  const changedFiles = turnFileChanges.get(conversationId)
  const branchName = conversationBranches.get(conversationId)

  if (!changedFiles || changedFiles.size === 0 || !branchName) {
    console.log('[SDK] No files changed or no branch for commit', {
      hasFiles: !!changedFiles,
      fileCount: changedFiles?.size || 0,
      hasBranch: !!branchName
    })
    return
  }

  // Use worktree path if available, otherwise use main repo
  const commitPath = conversationWorktrees.get(conversationId) || repoPath

  try {
    // Check if there are actual changes to commit
    const status = await gitService.getStatus(commitPath)
    if (!status.isDirty) {
      console.log('[SDK] No changes to commit')
      turnFileChanges.delete(conversationId)
      return
    }

    const commitMessage = generateTurnCommitMessage(userPrompt, changedFiles)

    await gitService.stageAll(commitPath)
    const commitHash = await gitService.commit(commitPath, commitMessage)

    // Notify renderer
    mainWindow.webContents.send('git:commit-created', {
      conversationId,
      branchName,
      commitHash,
      message: commitMessage,
      files: Array.from(changedFiles),
      type: 'turn'
    })

    console.log(`[SDK] Turn commit: ${commitHash.slice(0, 7)}`)
  } catch (error) {
    console.error('[SDK] Turn auto-commit failed:', error)
  } finally {
    // Clear tracked files for next turn
    turnFileChanges.delete(conversationId)
  }
}

/**
 * Final commit on stop - catches any uncommitted changes
 */
async function commitOnStop(
  conversationId: string,
  repoPath: string,
  mainWindow: BrowserWindow,
  gitSettings: GitSettings
): Promise<void> {
  // Check if auto-commit is enabled
  if (!gitSettings.autoCommit) {
    console.log('[SDK] Auto-commit disabled in settings (stop)')
    turnFileChanges.delete(conversationId)
    sessionPrompts.delete(conversationId)
    return
  }

  const changedFiles = turnFileChanges.get(conversationId)
  const prompts = sessionPrompts.get(conversationId) || []
  const branchName = conversationBranches.get(conversationId)

  if (!changedFiles || changedFiles.size === 0 || !branchName) {
    // Cleanup even if no commit needed
    turnFileChanges.delete(conversationId)
    sessionPrompts.delete(conversationId)
    return
  }

  // Use worktree path if available, otherwise use main repo
  const commitPath = conversationWorktrees.get(conversationId) || repoPath

  try {
    // Check if there are actual changes to commit
    const status = await gitService.getStatus(commitPath)
    if (!status.isDirty) {
      console.log('[SDK] No remaining changes to commit on stop')
      return
    }

    const commitMessage = generateStopCommitMessage(prompts, changedFiles)

    await gitService.stageAll(commitPath)
    const commitHash = await gitService.commit(commitPath, commitMessage)

    // Notify renderer
    mainWindow.webContents.send('git:commit-created', {
      conversationId,
      branchName,
      commitHash,
      message: commitMessage,
      files: Array.from(changedFiles),
      type: 'stop'
    })

    console.log(`[SDK] Stop commit: ${commitHash.slice(0, 7)}`)
  } catch (error) {
    console.error('[SDK] Stop commit failed:', error)
  } finally {
    // Cleanup tracking
    turnFileChanges.delete(conversationId)
    sessionPrompts.delete(conversationId)
  }
}

/**
 * Cleanup git tracking for a conversation
 */
function cleanupGitTracking(conversationId: string): void {
  turnFileChanges.delete(conversationId)
  sessionPrompts.delete(conversationId)
  // Note: Don't delete conversationBranches - we want to keep the branch association
  // for future messages in the same conversation
}

/**
 * Generic commit function for agent services
 * Used by both Claude agent and OpenAI Research services
 */
export async function commitAgentChanges(
  conversationId: string,
  repoPath: string,
  commitMessage: string,
  files: string[],
  commitType: 'turn' | 'stop' | 'research',
  mainWindow: BrowserWindow,
  gitSettings: GitSettings
): Promise<string | null> {
  // Check if auto-commit is enabled
  if (!gitSettings.autoCommit) {
    console.log('[Git] Auto-commit disabled in settings')
    return null
  }

  const branchName = conversationBranches.get(conversationId)
  if (!branchName) {
    console.log('[Git] No branch for this conversation, skipping commit')
    return null
  }

  try {
    // Check if there are actual changes to commit
    const status = await gitService.getStatus(repoPath)
    if (!status.isDirty) {
      console.log('[Git] No changes to commit')
      return null
    }

    await gitService.stageAll(repoPath)
    const commitHash = await gitService.commit(repoPath, commitMessage)

    // Notify renderer
    mainWindow.webContents.send('git:commit-created', {
      conversationId,
      branchName,
      commitHash,
      message: commitMessage,
      files,
      type: commitType
    })

    console.log(`[Git] Commit (${commitType}): ${commitHash.slice(0, 7)}`)
    return commitHash
  } catch (error) {
    console.error(`[Git] Commit failed (${commitType}):`, error)
    return null
  }
}

// ============================================
// SDK Message Processing
// ============================================

/**
 * Send a message to a Claude agent using the SDK
 */
export async function sendMessageSDK(
  conversationId: string,
  agentId: string,
  repoPath: string,
  message: string,
  sessionId: string | null,
  sessionCreatedAt: string | null,
  agentFilePath: string | null,
  mainWindow: BrowserWindow,
  settings?: ConversationSettings,
  gitSettings?: GitSettings
): Promise<void> {
  // Stop any existing stream for this conversation
  await stopAgentSDK(conversationId)

  // Send busy status
  mainWindow.webContents.send('agent:status', {
    agentId,
    status: 'busy'
  })

  // Use provided settings or defaults
  const effectiveSettings = settings || DEFAULT_CONVERSATION_SETTINGS
  const effectiveGitSettings = gitSettings || DEFAULT_GIT_SETTINGS

  // Check if session has expired (Claude sessions last ~30 days)
  let effectiveSessionId = sessionId
  if (sessionId && sessionCreatedAt) {
    const ageMs = Date.now() - new Date(sessionCreatedAt).getTime()
    const ageDays = ageMs / (1000 * 60 * 60 * 24)
    if (ageDays > SESSION_MAX_AGE_DAYS) {
      console.log(`[SDK] Session ${sessionId} expired (${ageDays.toFixed(1)} days old), starting fresh`)
      effectiveSessionId = null
    }
  }

  // Create and save user message
  const userMessage: ConversationMessage = {
    uuid: uuidv4(),
    type: 'user',
    content: message,
    timestamp: new Date().toISOString()
  }
  appendMessage(conversationId, userMessage)

  // Send user message to renderer
  mainWindow.webContents.send('agent:message', {
    conversationId,
    agentId,
    message: userMessage
  })

  // Track user prompt for git commit message
  if (!sessionPrompts.has(conversationId)) {
    sessionPrompts.set(conversationId, [])
  }
  sessionPrompts.get(conversationId)!.push(message)

  // Extract agent name from file path (e.g., ".claude/agents/my-agent.md" -> "my-agent")
  const agentName = agentFilePath
    ? agentFilePath.split('/').pop()?.replace('.md', '') || 'agent'
    : 'chorus'

  // Track state during streaming
  let capturedSessionId: string | null = null
  let streamingContent = ''
  const isFirstMessage = !sessionId
  let hasSetTitle = false
  let currentAssistantMessage: ClaudeAssistantMessage | null = null
  let resultMessage: ClaudeResultMessage | null = null
  const expectedSessionId = effectiveSessionId

  // Read system prompt content if file exists (for new sessions only)
  let systemPromptContent: string | undefined
  if (!effectiveSessionId && agentFilePath && existsSync(agentFilePath)) {
    try {
      systemPromptContent = readFileSync(agentFilePath, 'utf-8')
    } catch (err) {
      console.warn(`[SDK] Failed to read agent file: ${agentFilePath}`, err)
    }
  }

  try {
    // Determine working directory (worktree or main repo)
    let agentCwd = repoPath
    let worktreePath: string | null = null

    // Create worktree if enabled and auto-branching is on
    if (effectiveGitSettings.autoBranch && effectiveGitSettings.useWorktrees) {
      const isNewSession = !effectiveSessionId
      if (isNewSession) {
        // Generate branch name for this conversation
        const branchName = worktreeService.generateAgentBranchName(agentName, conversationId.slice(0, 7))

        // Create or get worktree
        worktreePath = await worktreeService.ensureConversationWorktree(
          repoPath,
          conversationId,
          branchName,
          effectiveGitSettings
        )

        if (worktreePath) {
          agentCwd = worktreePath
          console.log(`[SDK] Using worktree: ${worktreePath}`)

          // Update conversation with worktree path
          updateConversation(conversationId, { worktreePath })

          // Register branch name and worktree path for commit operations
          conversationBranches.set(conversationId, branchName)
          conversationWorktrees.set(conversationId, worktreePath)
        }
      } else {
        // Resuming session - check for existing worktree
        const existingWorktree = worktreeService.getConversationWorktreePath(repoPath, conversationId)
        const worktrees = await gitService.listWorktrees(repoPath)
        const existingWorktreeInfo = worktrees.find(w => w.path === existingWorktree)

        if (existingWorktreeInfo) {
          agentCwd = existingWorktree
          worktreePath = existingWorktree
          console.log(`[SDK] Resuming in existing worktree: ${existingWorktree}`)

          // Register branch name and worktree path for commit operations
          conversationBranches.set(conversationId, existingWorktreeInfo.branch)
          conversationWorktrees.set(conversationId, existingWorktree)
        }
      }
    }

    // Build SDK options
    const abortController = new AbortController()
    const options: Parameters<typeof query>[0]['options'] = {
      cwd: agentCwd,  // Use worktree path if available
      abortController,
      // Enable project and user settings for slash commands
      settingSources: ['project', 'user']
    }

    // Add model if not default
    if (effectiveSettings.model && effectiveSettings.model !== 'default') {
      options.model = effectiveSettings.model as 'opus' | 'sonnet' | 'haiku'
    }

    // Add permission mode
    if (effectiveSettings.permissionMode) {
      options.permissionMode = effectiveSettings.permissionMode
    }

    // Add allowed tools
    if (effectiveSettings.allowedTools && effectiveSettings.allowedTools.length > 0) {
      options.allowedTools = effectiveSettings.allowedTools
    }

    // Add session resume
    if (effectiveSessionId) {
      options.resume = effectiveSessionId
    }

    // Add system prompt for new sessions
    // Use claude_code preset with optional custom append for agent-specific instructions
    if (!effectiveSessionId) {
      if (systemPromptContent) {
        // Use claude_code preset with custom instructions appended
        (options as { systemPrompt?: unknown }).systemPrompt = {
          type: 'preset',
          preset: 'claude_code',
          append: systemPromptContent
        }
      } else {
        // Use claude_code preset for slash commands support
        (options as { systemPrompt?: unknown }).systemPrompt = {
          type: 'preset',
          preset: 'claude_code'
        }
      }
    }

    // Add canUseTool callback for permission handling
    options.canUseTool = async (
      toolName: string,
      toolInput: Record<string, unknown>
    ) => {
      // Security: Validate file paths are within workspace (prevents path traversal attacks)
      if (FILE_PATH_TOOLS.includes(toolName)) {
        const filePath = getFilePathFromToolInput(toolName, toolInput)
        if (filePath && !isPathWithinWorkspace(filePath, agentCwd)) {
          console.warn(`[SDK] Blocked ${toolName} operation outside workspace: ${filePath} (workspace: ${agentCwd})`)
          return {
            behavior: 'deny' as const,
            message: `Security: File path "${filePath}" is outside the workspace. Operations are restricted to: ${agentCwd}`
          }
        }
      }

      const requestId = `${conversationId}-${uuidv4()}`

      // Send permission request to renderer
      mainWindow.webContents.send('permission:request', {
        requestId,
        conversationId,
        toolName,
        toolInput
      })

      // Wait for response with timeout
      return new Promise<{ behavior: 'allow'; updatedInput: Record<string, unknown> } | { behavior: 'deny'; message: string }>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          pendingPermissions.delete(requestId)
          resolve({ behavior: 'deny', message: 'Permission request timed out' })
        }, PERMISSION_TIMEOUT_MS)

        pendingPermissions.set(requestId, {
          resolve: (response) => {
            if (response.approved) {
              resolve({ behavior: 'allow', updatedInput: toolInput })
            } else {
              resolve({
                behavior: 'deny',
                message: response.reason || 'User denied permission'
              })
            }
          },
          reject,
          timeoutId
        })
      })
    }

    // Enable partial messages for real-time text streaming
    options.includePartialMessages = true

    // Add hooks for file change notifications and auto-commit tracking
    options.hooks = {
      PostToolUse: [
        {
          hooks: [
            async (input, _toolUseId, _options) => {
              // Type guard for PostToolUse input
              if (input.hook_event_name === 'PostToolUse') {
                const toolInput = input.tool_input as { file_path?: string } | undefined
                const filePath = toolInput?.file_path
                const toolName = input.tool_name
                if (filePath && (toolName === 'Write' || toolName === 'Edit' || toolName === 'MultiEdit')) {
                  // Track file for auto-commit
                  if (!turnFileChanges.has(conversationId)) {
                    turnFileChanges.set(conversationId, new Set())
                  }
                  turnFileChanges.get(conversationId)!.add(filePath)

                  // Persist file change as a message for session resumption
                  const fileChangeMessage: ConversationMessage = {
                    uuid: uuidv4(),
                    type: 'system',
                    content: `File ${toolName.toLowerCase()}d: ${filePath}`,
                    timestamp: new Date().toISOString(),
                    toolName: toolName,
                    toolInput: { file_path: filePath }
                  }
                  appendMessage(conversationId, fileChangeMessage)

                  // Send file change event to renderer
                  mainWindow.webContents.send('agent:file-changed', {
                    conversationId,
                    filePath,
                    toolName
                  })
                }
              }
              return { continue: true }
            }
          ]
        }
      ],
      // Stop hook for final commit when agent stops
      Stop: [
        {
          hooks: [
            async () => {
              // Final commit on stop - catches any uncommitted changes
              await commitOnStop(conversationId, repoPath, mainWindow, effectiveGitSettings)
              return { continue: true }
            }
          ]
        }
      ]
    }

    // Create the query stream
    const stream = query({
      prompt: message,
      options
    })

    // Store for interruption
    activeStreams.set(conversationId, stream)

    // Process stream messages
    for await (const msg of stream) {
      // Handle system init - capture session ID
      if (msg.type === 'system' && 'subtype' in msg && msg.subtype === 'init') {
        const systemMsg = msg as unknown as ClaudeSystemMessage
        const newSessionId = systemMsg.session_id
        capturedSessionId = newSessionId
        agentSessions.set(agentId, newSessionId)

        // Log session status
        if (expectedSessionId && newSessionId !== expectedSessionId) {
          console.warn(`[SDK] Resume failed - expected ${expectedSessionId}, got ${newSessionId}`)
        }

        // Only update sessionCreatedAt for NEW sessions
        const isNewSession = !expectedSessionId || newSessionId !== expectedSessionId
        const sessionCreatedAtValue = isNewSession ? new Date().toISOString() : null

        // Update conversation with session ID
        const updateData: { sessionId: string; sessionCreatedAt?: string } = { sessionId: newSessionId }
        if (sessionCreatedAtValue) {
          updateData.sessionCreatedAt = sessionCreatedAtValue
        }
        updateConversation(conversationId, updateData)

        // Notify renderer about session update
        mainWindow.webContents.send('agent:session-update', {
          conversationId,
          sessionId: newSessionId,
          sessionCreatedAt: sessionCreatedAtValue || sessionCreatedAt
        })

        // Store system init message
        const systemMessage: ConversationMessage = {
          uuid: uuidv4(),
          type: 'system',
          content: `Session started with model ${systemMsg.model}`,
          timestamp: new Date().toISOString(),
          sessionId: newSessionId,
          claudeMessage: systemMsg as ClaudeCodeMessage
        }
        appendMessage(conversationId, systemMessage)

        // Auto-create agent branch (only for new sessions)
        if (isNewSession) {
          const branchName = await ensureAgentBranch(conversationId, newSessionId, agentName, repoPath, mainWindow, effectiveGitSettings)
          // Store branchName in conversation for cascade delete
          if (branchName) {
            updateConversation(conversationId, { branchName })
          }
        }
      }

      // Handle partial assistant messages (real-time streaming)
      if (msg.type === 'stream_event') {
        const partialMsg = msg as SDKPartialAssistantMessage
        const event = partialMsg.event

        // Handle text deltas for real-time streaming
        if (event.type === 'content_block_delta') {
          const delta = event.delta as { type: string; text?: string; thinking?: string }
          if (delta.type === 'text_delta' && delta.text) {
            mainWindow.webContents.send('agent:stream-delta', {
              conversationId,
              delta: delta.text
            })
            streamingContent += delta.text
          } else if (delta.type === 'thinking_delta' && delta.thinking) {
            mainWindow.webContents.send('agent:stream-delta', {
              conversationId,
              delta: delta.thinking
            })
          }
        }
        continue // Skip further processing for partial messages
      }

      // Handle assistant messages (complete messages - for tool_use blocks)
      // Note: Text content is already streamed via stream_event above
      if (msg.type === 'assistant' && 'message' in msg) {
        const assistantMsg = msg as unknown as ClaudeAssistantMessage
        currentAssistantMessage = assistantMsg

        if (assistantMsg.message?.content) {
          for (const block of assistantMsg.message.content) {
            // Skip text blocks - already streamed via partial messages
            // But first, flush any accumulated text as a message before tool_use
            if (block.type === 'text') {
              continue
            } else if (block.type === 'tool_use') {
              // IMPORTANT: Flush accumulated streaming text BEFORE emitting tool_use
              // This ensures text appears before the tool calls that follow it
              if (streamingContent.trim()) {
                // Note: Don't include token info on intermediate messages
                // Token info is only meaningful on the final message of a turn
                const textMessage: ConversationMessage = {
                  uuid: uuidv4(),
                  type: 'assistant',
                  content: streamingContent,
                  timestamp: new Date().toISOString(),
                  sessionId: capturedSessionId || undefined
                }
                appendMessage(conversationId, textMessage)
                mainWindow.webContents.send('agent:message', {
                  conversationId,
                  agentId,
                  message: textMessage
                })
                // Clear streaming content and notify renderer to clear streaming display
                streamingContent = ''
                mainWindow.webContents.send('agent:stream-clear', { conversationId })
              }

              const toolBlock = block as ToolUseBlock

              // Special handling for TodoWrite tool - emit todo update event
              if (toolBlock.name === 'TodoWrite') {
                const todoInput = toolBlock.input as { todos?: Array<{ content: string; status: string; activeForm: string }> }
                if (todoInput.todos) {
                  // Persist TodoWrite as a message for session resumption
                  const todoMessage: ConversationMessage = {
                    uuid: uuidv4(),
                    type: 'tool_use',
                    content: 'TodoWrite update',
                    timestamp: new Date().toISOString(),
                    toolName: 'TodoWrite',
                    toolInput: { todos: todoInput.todos },
                    toolUseId: toolBlock.id,
                    claudeMessage: assistantMsg
                  }
                  appendMessage(conversationId, todoMessage)

                  // Send todo update event to renderer
                  mainWindow.webContents.send('agent:todo-update', {
                    conversationId,
                    todos: todoInput.todos,
                    timestamp: new Date().toISOString()
                  })

                  // Also send as regular message for UI consistency
                  mainWindow.webContents.send('agent:message', {
                    conversationId,
                    agentId,
                    message: todoMessage
                  })
                }
                continue // Skip normal tool_use handling for TodoWrite
              }

              // Create tool use message for other tools
              const toolMessage: ConversationMessage = {
                uuid: uuidv4(),
                type: 'tool_use',
                content: `Using tool: ${toolBlock.name}`,
                timestamp: new Date().toISOString(),
                toolName: toolBlock.name,
                toolInput: toolBlock.input,
                toolUseId: toolBlock.id,
                claudeMessage: assistantMsg
              }
              appendMessage(conversationId, toolMessage)
              mainWindow.webContents.send('agent:message', {
                conversationId,
                agentId,
                message: toolMessage
              })
            } else if (block.type === 'thinking') {
              // Skip thinking blocks - already streamed via partial messages
              continue
            }
          }
        }
      }

      // Handle user messages (tool results)
      if (msg.type === 'user' && 'message' in msg) {
        const userMsg = msg as unknown as ClaudeUserMessage
        if (userMsg.message?.content) {
          for (const block of userMsg.message.content) {
            if (block.type === 'tool_result') {
              const resultBlock = block as ToolResultBlock
              const toolResultMessage: ConversationMessage = {
                uuid: uuidv4(),
                type: 'tool_result',
                content:
                  typeof resultBlock.content === 'string'
                    ? resultBlock.content
                    : JSON.stringify(resultBlock.content),
                timestamp: new Date().toISOString(),
                toolUseId: resultBlock.tool_use_id,
                isToolError: resultBlock.is_error,
                claudeMessage: userMsg
              }
              appendMessage(conversationId, toolResultMessage)
              mainWindow.webContents.send('agent:message', {
                conversationId,
                agentId,
                message: toolResultMessage
              })
            }
          }
        }
      }

      // Handle result event
      if (msg.type === 'result') {
        const resultMsg = msg as unknown as ClaudeResultMessage
        resultMessage = resultMsg
        // Log result message for debugging token usage
        console.log('[SDK] Result message usage:', JSON.stringify(resultMsg.usage, null, 2))
        console.log('[SDK] Result message cost:', resultMsg.total_cost_usd)
        if (resultMsg.session_id && !capturedSessionId) {
          const sessionCreatedAtNow = new Date().toISOString()
          capturedSessionId = resultMsg.session_id
          agentSessions.set(agentId, resultMsg.session_id)
          updateConversation(conversationId, {
            sessionId: resultMsg.session_id,
            sessionCreatedAt: sessionCreatedAtNow
          })

          mainWindow.webContents.send('agent:session-update', {
            conversationId,
            sessionId: resultMsg.session_id,
            sessionCreatedAt: sessionCreatedAtNow
          })
        }

        // Auto-commit changes from this turn (commit-per-turn)
        await commitTurnChanges(conversationId, repoPath, message, mainWindow, effectiveGitSettings)
      }
    }

    // Save the complete assistant message if we have content
    if (streamingContent.trim()) {
      // Use cumulative token usage from result message (authoritative source)
      // Access usage from raw objects to avoid type narrowing issues
      const rawResult = resultMessage as unknown as Record<string, unknown> | undefined
      const rawAssistant = currentAssistantMessage?.message as unknown as Record<string, unknown> | undefined
      const usage = (rawResult?.usage || rawAssistant?.usage) as Record<string, number> | undefined

      const assistantMessage: ConversationMessage = {
        uuid: uuidv4(),
        type: 'assistant',
        content: streamingContent,
        timestamp: new Date().toISOString(),
        sessionId: capturedSessionId || undefined,
        claudeMessage: currentAssistantMessage || undefined,
        // Use cumulative usage from result message
        inputTokens: usage?.input_tokens,
        outputTokens: usage?.output_tokens,
        cacheReadTokens: usage?.cache_read_input_tokens,
        cacheCreationTokens: usage?.cache_creation_input_tokens,
        costUsd: resultMessage?.total_cost_usd,
        durationMs: resultMessage?.duration_ms
      }
      appendMessage(conversationId, assistantMessage)
      mainWindow.webContents.send('agent:message', {
        conversationId,
        agentId,
        message: assistantMessage
      })

      // Generate title from first user message
      if (isFirstMessage && !hasSetTitle) {
        const title = generateTitleFromMessage(message)
        updateConversation(conversationId, { title })
        hasSetTitle = true
      }
    }

    // Store result message with session stats and cumulative token usage
    if (resultMessage) {
      // Access usage and modelUsage from the raw message object (avoid type narrowing issues)
      const rawResult = resultMessage as unknown as Record<string, unknown>
      const usage = rawResult.usage as Record<string, number> | undefined
      const modelUsage = rawResult.modelUsage as Record<string, { contextWindow?: number }> | undefined

      // Get context window from the primary model (usually opus or the main model used)
      // Find the model with the highest token usage (main conversation model)
      let contextWindow: number | undefined
      if (modelUsage) {
        let maxTokens = 0
        for (const [, modelData] of Object.entries(modelUsage)) {
          const totalTokens = (modelData as Record<string, number>).inputTokens || 0
          if (totalTokens > maxTokens && modelData.contextWindow) {
            maxTokens = totalTokens
            contextWindow = modelData.contextWindow
          }
        }
      }

      const resultStoredMessage: ConversationMessage = {
        uuid: uuidv4(),
        type: 'system',
        content: `Turn completed: ${resultMessage.num_turns} turns, $${resultMessage.total_cost_usd.toFixed(4)} USD, ${(resultMessage.duration_ms / 1000).toFixed(1)}s`,
        timestamp: new Date().toISOString(),
        sessionId: resultMessage.session_id,
        claudeMessage: resultMessage,
        costUsd: resultMessage.total_cost_usd,
        durationMs: resultMessage.duration_ms,
        numTurns: resultMessage.num_turns,
        // Store cumulative token usage from result message
        inputTokens: usage?.input_tokens,
        outputTokens: usage?.output_tokens,
        cacheReadTokens: usage?.cache_read_input_tokens,
        cacheCreationTokens: usage?.cache_creation_input_tokens,
        contextWindow
      }
      appendMessage(conversationId, resultStoredMessage)

      // Send result message to renderer for context metrics display
      mainWindow.webContents.send('agent:message', {
        conversationId,
        agentId,
        message: resultStoredMessage
      })
    }
  } catch (error) {
    // Handle interruption
    if (error instanceof Error && error.name === 'AbortError') {
      const stoppedMessage: ConversationMessage = {
        uuid: uuidv4(),
        type: 'system',
        content: 'Agent stopped by user',
        timestamp: new Date().toISOString()
      }
      appendMessage(conversationId, stoppedMessage)
      mainWindow.webContents.send('agent:message', {
        conversationId,
        agentId,
        message: stoppedMessage
      })
    } else {
      // Handle other errors
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error('[SDK] Error:', errorMsg)

      const errorMessage: ConversationMessage = {
        uuid: uuidv4(),
        type: 'error',
        content: errorMsg,
        timestamp: new Date().toISOString()
      }
      appendMessage(conversationId, errorMessage)
      mainWindow.webContents.send('agent:message', {
        conversationId,
        agentId,
        message: errorMessage
      })
      mainWindow.webContents.send('agent:status', {
        agentId,
        status: 'error',
        error: errorMsg
      })
      return
    }
  } finally {
    // Cleanup
    activeStreams.delete(conversationId)
    cancelPendingPermissions(conversationId)
    cleanupGitTracking(conversationId)

    // Send ready status
    mainWindow.webContents.send('agent:status', {
      agentId,
      status: 'ready'
    })
  }
}

/**
 * Stop an agent's current operation using SDK interrupt
 */
export async function stopAgentSDK(conversationId: string): Promise<void> {
  const stream = activeStreams.get(conversationId)
  if (stream) {
    await stream.interrupt()
    activeStreams.delete(conversationId)
    cancelPendingPermissions(conversationId)
  }
}

/**
 * Get session ID for an agent
 */
export function getSessionIdSDK(agentId: string): string | null {
  return agentSessions.get(agentId) || null
}

/**
 * Clear an agent's session (start fresh conversation)
 */
export function clearSessionSDK(agentId: string): void {
  agentSessions.delete(agentId)
}
