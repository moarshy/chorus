# Implementation Plan: Git Worktree Integration

## Overview

This plan implements git worktree support for concurrent agent isolation in Chorus. Each active agent conversation gets its own worktree, enabling true parallel execution without filesystem conflicts.

**Key Integration Points:**
- **Builds on Spec 12** (Automated Git Operations) - Worktrees enhance the existing `ensureAgentBranch` and auto-commit functionality
- **Supports all agent types** - Works for both Claude SDK agents AND OpenAI Deep Research agents
- **Shared git layer** - Single worktree service used by all agent backends

## Architecture: Agent-Agnostic Git Layer

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent Services                            │
├─────────────────────────────┬───────────────────────────────────┤
│  Claude SDK Service         │  OpenAI Research Service          │
│  (agent-sdk-service.ts)     │  (openai-research-service.ts)     │
│                             │                                    │
│  - Uses SDK query()         │  - Uses OpenAI Agents SDK          │
│  - PostToolUse hooks        │  - WebSearchTool                   │
│  - canUseTool callback      │  - Saves reports to files          │
└──────────────┬──────────────┴──────────────────┬────────────────┘
               │                                  │
               ▼                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Git Operations Layer                          │
│                    (worktree-service.ts)                         │
├─────────────────────────────────────────────────────────────────┤
│  ensureConversationWorktree(conversationId, branchName, ...)    │
│  getAgentWorkingDirectory(conversationId, repoPath, ...)        │
│  autoCommitTurnChanges(conversationId, worktreePath, ...)       │
│  removeConversationWorktree(conversationId, ...)                │
├─────────────────────────────────────────────────────────────────┤
│                       git-service.ts                             │
│  createWorktree() | removeWorktree() | listWorktrees() | ...    │
└─────────────────────────────────────────────────────────────────┘
```

**Flow for ANY agent type:**
1. Conversation starts → `getAgentWorkingDirectory()` called
2. If worktrees enabled → creates/reuses worktree at `.chorus-worktrees/{conversationId}/`
3. Agent service receives `cwd` path (worktree or main repo)
4. Agent operates in isolated directory
5. Auto-commit hooks work the same (in worktree context)

## Phase 1: Git Service Worktree Functions

### 1.1 Add Worktree Functions to git-service.ts

**File:** `chorus/src/main/services/git-service.ts`

```typescript
// ============================================
// WORKTREE MANAGEMENT
// ============================================

export interface WorktreeInfo {
  path: string              // Absolute path to worktree
  branch: string            // Branch checked out
  commit: string            // Current HEAD commit
  isMain: boolean           // Is this the main working tree?
  isLocked: boolean         // Is worktree locked?
  prunable: boolean         // Can be safely pruned?
}

/**
 * List all worktrees for a repository
 */
export async function listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
  const output = runGit(repoPath, 'worktree list --porcelain')
  return parseWorktreeList(output)
}

function parseWorktreeList(output: string): WorktreeInfo[] {
  const worktrees: WorktreeInfo[] = []
  const entries = output.trim().split('\n\n')

  for (const entry of entries) {
    const lines = entry.split('\n')
    const info: Partial<WorktreeInfo> = {}

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        info.path = line.slice(9)
      } else if (line.startsWith('HEAD ')) {
        info.commit = line.slice(5)
      } else if (line.startsWith('branch ')) {
        info.branch = line.slice(7).replace('refs/heads/', '')
      } else if (line === 'bare') {
        // Skip bare repos
        continue
      } else if (line === 'locked') {
        info.isLocked = true
      } else if (line === 'prunable') {
        info.prunable = true
      }
    }

    if (info.path) {
      worktrees.push({
        path: info.path,
        branch: info.branch || 'HEAD',
        commit: info.commit || '',
        isMain: worktrees.length === 0, // First entry is main worktree
        isLocked: info.isLocked || false,
        prunable: info.prunable || false
      })
    }
  }

  return worktrees
}

/**
 * Create a new worktree
 * @param repoPath - Path to main repository
 * @param worktreePath - Path where worktree will be created
 * @param branch - Branch to checkout (created if doesn't exist)
 * @param baseBranch - Base branch for new branch (optional)
 */
export async function createWorktree(
  repoPath: string,
  worktreePath: string,
  branch: string,
  baseBranch?: string
): Promise<void> {
  // Check if branch exists
  const branchExists = await checkBranchExists(repoPath, branch)

  if (branchExists) {
    // Checkout existing branch
    runGit(repoPath, `worktree add "${worktreePath}" ${branch}`)
  } else {
    // Create new branch from base
    const base = baseBranch || await getDefaultBranch(repoPath) || 'HEAD'
    runGit(repoPath, `worktree add -b ${branch} "${worktreePath}" ${base}`)
  }
}

/**
 * Remove a worktree
 * @param repoPath - Path to main repository
 * @param worktreePath - Path to worktree to remove
 * @param force - Force removal even with uncommitted changes
 */
export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
  force: boolean = false
): Promise<void> {
  const flag = force ? '--force' : ''
  runGit(repoPath, `worktree remove ${flag} "${worktreePath}"`)
}

/**
 * Prune stale worktree entries
 * Cleans up metadata for worktrees whose directories were deleted
 */
export async function pruneWorktrees(repoPath: string): Promise<void> {
  runGit(repoPath, 'worktree prune')
}

/**
 * Lock a worktree to prevent accidental removal
 */
export async function lockWorktree(
  repoPath: string,
  worktreePath: string,
  reason?: string
): Promise<void> {
  const reasonArg = reason ? `--reason "${reason}"` : ''
  runGit(repoPath, `worktree lock ${reasonArg} "${worktreePath}"`)
}

/**
 * Unlock a worktree
 */
export async function unlockWorktree(
  repoPath: string,
  worktreePath: string
): Promise<void> {
  runGit(repoPath, `worktree unlock "${worktreePath}"`)
}

/**
 * Check if a path is inside a worktree (not the main repo)
 */
export async function isWorktree(path: string): Promise<boolean> {
  try {
    const gitDir = runGit(path, 'rev-parse --git-dir')
    // Main repo: .git is a directory
    // Worktree: .git is a file pointing to main repo
    return gitDir.includes('.git/worktrees/')
  } catch {
    return false
  }
}

/**
 * Get the main repository path from a worktree
 */
export async function getMainRepoPath(worktreePath: string): Promise<string> {
  const gitDir = runGit(worktreePath, 'rev-parse --git-common-dir')
  // Returns something like /path/to/repo/.git
  // We want /path/to/repo
  return path.dirname(gitDir)
}

/**
 * Get worktree status (has uncommitted changes?)
 */
export async function getWorktreeStatus(worktreePath: string): Promise<{
  isDirty: boolean
  untrackedFiles: number
  modifiedFiles: number
  stagedFiles: number
}> {
  const status = await getStatus(worktreePath)
  return {
    isDirty: status.isDirty,
    untrackedFiles: status.files.filter(f => f.status === '??').length,
    modifiedFiles: status.files.filter(f => f.status === ' M' || f.status === 'M ').length,
    stagedFiles: status.files.filter(f => f.status.startsWith('A') || f.status.startsWith('M')).length
  }
}

/**
 * Check if a branch exists
 */
async function checkBranchExists(repoPath: string, branch: string): Promise<boolean> {
  try {
    runGit(repoPath, `rev-parse --verify refs/heads/${branch}`)
    return true
  } catch {
    return false
  }
}
```

### 1.2 Add IPC Handlers

**File:** `chorus/src/main/index.ts`

```typescript
// Worktree management IPC handlers

ipcMain.handle('git:list-worktrees', async (_event, repoPath: string) => {
  try {
    const worktrees = await gitService.listWorktrees(repoPath)
    return { success: true, data: worktrees }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('git:create-worktree', async (
  _event,
  repoPath: string,
  worktreePath: string,
  branch: string,
  baseBranch?: string
) => {
  try {
    await gitService.createWorktree(repoPath, worktreePath, branch, baseBranch)
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('git:remove-worktree', async (
  _event,
  repoPath: string,
  worktreePath: string,
  force?: boolean
) => {
  try {
    await gitService.removeWorktree(repoPath, worktreePath, force)
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('git:prune-worktrees', async (_event, repoPath: string) => {
  try {
    await gitService.pruneWorktrees(repoPath)
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('git:get-worktree-status', async (_event, worktreePath: string) => {
  try {
    const status = await gitService.getWorktreeStatus(worktreePath)
    return { success: true, data: status }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})
```

### 1.3 Update Preload Bridge

**File:** `chorus/src/preload/index.ts`

```typescript
// Add to git namespace:
git: {
  // ... existing methods ...

  // Worktree management
  listWorktrees: (repoPath: string) =>
    ipcRenderer.invoke('git:list-worktrees', repoPath),

  createWorktree: (repoPath: string, worktreePath: string, branch: string, baseBranch?: string) =>
    ipcRenderer.invoke('git:create-worktree', repoPath, worktreePath, branch, baseBranch),

  removeWorktree: (repoPath: string, worktreePath: string, force?: boolean) =>
    ipcRenderer.invoke('git:remove-worktree', repoPath, worktreePath, force),

  pruneWorktrees: (repoPath: string) =>
    ipcRenderer.invoke('git:prune-worktrees', repoPath),

  getWorktreeStatus: (worktreePath: string) =>
    ipcRenderer.invoke('git:get-worktree-status', worktreePath),
}
```

### 1.4 Add Type Definitions

**File:** `chorus/src/preload/index.d.ts`

```typescript
// Add to GitAPI interface:
interface GitAPI {
  // ... existing methods ...

  // Worktree management
  listWorktrees: (repoPath: string) => Promise<Result<WorktreeInfo[]>>
  createWorktree: (repoPath: string, worktreePath: string, branch: string, baseBranch?: string) => Promise<Result<void>>
  removeWorktree: (repoPath: string, worktreePath: string, force?: boolean) => Promise<Result<void>>
  pruneWorktrees: (repoPath: string) => Promise<Result<void>>
  getWorktreeStatus: (worktreePath: string) => Promise<Result<WorktreeStatus>>
}

interface WorktreeInfo {
  path: string
  branch: string
  commit: string
  isMain: boolean
  isLocked: boolean
  prunable: boolean
}

interface WorktreeStatus {
  isDirty: boolean
  untrackedFiles: number
  modifiedFiles: number
  stagedFiles: number
}
```

## Phase 2: Agent Services Integration

This phase integrates worktrees with **both** agent backends (Claude SDK and OpenAI Research). The key is a shared `worktree-service.ts` that any agent service can use.

### 2.1 Update Workspace Git Settings

**File:** `chorus/src/main/store/index.ts`

```typescript
// Update GitSettings interface:
export interface GitSettings {
  autoBranch: boolean        // Create branch per session
  autoCommit: boolean        // Commit per turn
  useWorktrees: boolean      // Use worktrees for isolation (NEW)
  worktreeLocation: 'inside' | 'outside'  // inside repo or ~/.chorus/worktrees
  autoCleanupWorktrees: boolean           // Cleanup after merge
}

export const DEFAULT_GIT_SETTINGS: GitSettings = {
  autoBranch: false,
  autoCommit: false,
  useWorktrees: true,        // Default enabled for new installs
  worktreeLocation: 'inside',
  autoCleanupWorktrees: true
}
```

### 2.2 Worktree Path Generation

**File:** `chorus/src/main/services/worktree-service.ts` (NEW FILE)

```typescript
import * as path from 'path'
import * as fs from 'fs/promises'
import * as gitService from './git-service'

const WORKTREE_DIR = '.chorus-worktrees'

/**
 * Get the worktree directory path for a workspace
 */
export function getWorktreeBaseDir(repoPath: string, location: 'inside' | 'outside'): string {
  if (location === 'inside') {
    return path.join(repoPath, WORKTREE_DIR)
  } else {
    // Outside repo: ~/.chorus/worktrees/{workspaceHash}/
    const workspaceHash = hashPath(repoPath)
    return path.join(process.env.HOME || '', '.chorus', 'worktrees', workspaceHash)
  }
}

/**
 * Get the worktree path for a specific conversation
 */
export function getConversationWorktreePath(
  repoPath: string,
  conversationId: string,
  location: 'inside' | 'outside'
): string {
  const baseDir = getWorktreeBaseDir(repoPath, location)
  return path.join(baseDir, conversationId)
}

/**
 * Ensure .chorus-worktrees is gitignored
 */
export async function ensureWorktreeGitignore(repoPath: string): Promise<void> {
  const gitignorePath = path.join(repoPath, '.gitignore')

  try {
    let content = ''
    try {
      content = await fs.readFile(gitignorePath, 'utf-8')
    } catch {
      // File doesn't exist, will create
    }

    if (!content.includes(WORKTREE_DIR)) {
      const newContent = content + (content.endsWith('\n') ? '' : '\n') + `\n# Chorus agent worktrees\n${WORKTREE_DIR}/\n`
      await fs.writeFile(gitignorePath, newContent)
    }
  } catch (error) {
    console.error('[Worktree] Failed to update .gitignore:', error)
  }
}

/**
 * Create or get worktree for a conversation
 */
export async function ensureConversationWorktree(
  repoPath: string,
  conversationId: string,
  branchName: string,
  gitSettings: GitSettings
): Promise<string | null> {
  if (!gitSettings.useWorktrees) {
    return null // Worktrees disabled, use main repo
  }

  const worktreePath = getConversationWorktreePath(
    repoPath,
    conversationId,
    gitSettings.worktreeLocation
  )

  // Check if worktree already exists
  const worktrees = await gitService.listWorktrees(repoPath)
  const existing = worktrees.find(w => w.path === worktreePath)

  if (existing) {
    console.log(`[Worktree] Reusing existing worktree: ${worktreePath}`)
    return worktreePath
  }

  // Ensure parent directory exists
  await fs.mkdir(path.dirname(worktreePath), { recursive: true })

  // Ensure .gitignore excludes worktrees
  await ensureWorktreeGitignore(repoPath)

  // Create worktree
  const defaultBranch = await gitService.getDefaultBranch(repoPath)
  await gitService.createWorktree(repoPath, worktreePath, branchName, defaultBranch || 'main')

  console.log(`[Worktree] Created worktree: ${worktreePath} on branch ${branchName}`)
  return worktreePath
}

/**
 * Remove conversation worktree
 */
export async function removeConversationWorktree(
  repoPath: string,
  conversationId: string,
  gitSettings: GitSettings,
  force: boolean = false
): Promise<void> {
  const worktreePath = getConversationWorktreePath(
    repoPath,
    conversationId,
    gitSettings.worktreeLocation
  )

  // Check for uncommitted changes first
  if (!force) {
    const status = await gitService.getWorktreeStatus(worktreePath)
    if (status.isDirty) {
      throw new Error('Worktree has uncommitted changes. Use force=true to remove anyway.')
    }
  }

  await gitService.removeWorktree(repoPath, worktreePath, force)
  console.log(`[Worktree] Removed worktree: ${worktreePath}`)
}

/**
 * Get all conversation worktrees for a workspace
 */
export async function getWorkspaceWorktrees(
  repoPath: string
): Promise<Array<WorktreeInfo & { conversationId: string }>> {
  const worktrees = await gitService.listWorktrees(repoPath)
  const baseDir = getWorktreeBaseDir(repoPath, 'inside')
  const outsideBaseDir = getWorktreeBaseDir(repoPath, 'outside')

  return worktrees
    .filter(w => w.path.startsWith(baseDir) || w.path.startsWith(outsideBaseDir))
    .map(w => ({
      ...w,
      conversationId: path.basename(w.path)
    }))
}

function hashPath(p: string): string {
  // Simple hash for workspace identification
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(p).digest('hex').slice(0, 12)
}
```

### 2.3 Integrate with Agent SDK Service

**File:** `chorus/src/main/services/agent-sdk-service.ts`

Update `sendMessageSDK` to use worktrees:

```typescript
import * as worktreeService from './worktree-service'

// In sendMessageSDK function, replace the cwd determination:

async function sendMessageSDK(/* params */) {
  // ... existing setup code ...

  // Determine working directory
  let agentCwd = repoPath

  if (effectiveGitSettings.autoBranch && effectiveGitSettings.useWorktrees) {
    // Create/get worktree for this conversation
    const branchName = conversationBranches.get(conversationId) ||
      generateAgentBranchName(agentName, sessionId || 'new')

    const worktreePath = await worktreeService.ensureConversationWorktree(
      repoPath,
      conversationId,
      branchName,
      effectiveGitSettings
    )

    if (worktreePath) {
      agentCwd = worktreePath

      // Update conversation with worktree path
      updateConversation(conversationId, { worktreePath })

      // Notify renderer
      mainWindow.webContents.send('git:worktree-created', {
        conversationId,
        worktreePath,
        branchName
      })
    }
  }

  // Use agentCwd instead of repoPath for SDK
  const options: Parameters<typeof query>[0]['options'] = {
    cwd: agentCwd,  // Use worktree path!
    abortController,
    // ... rest of options
  }

  // ... rest of function
}
```

### 2.4 Update ensureAgentBranch for Worktrees

When using worktrees, we don't need to checkout in the main repo:

```typescript
async function ensureAgentBranch(
  conversationId: string,
  sessionId: string,
  agentName: string,
  repoPath: string,
  mainWindow: BrowserWindow,
  gitSettings: GitSettings
): Promise<string | null> {
  if (!gitSettings.autoBranch) {
    return null
  }

  // Generate branch name
  const branchName = generateAgentBranchName(agentName, sessionId)

  // If using worktrees, we don't need to checkout in main repo
  // The worktree will be created with the branch checked out
  if (gitSettings.useWorktrees) {
    conversationBranches.set(conversationId, branchName)
    return branchName
  }

  // Legacy: checkout in main repo (existing code)
  // ... existing branch switching logic ...
}
```

### 2.5 Integrate with OpenAI Research Service

**File:** `chorus/src/main/services/openai-research-service.ts`

The OpenAI Research agent also uses worktrees for isolation. Since it saves research reports to files, the worktree provides a clean location.

```typescript
import * as worktreeService from './worktree-service'
import * as gitService from './git-service'

export async function sendResearchMessage(
  conversationId: string,
  workspaceId: string,
  message: string
): Promise<void> {
  const workspace = getWorkspace(workspaceId)
  const conversation = getConversation(conversationId)
  const gitSettings = workspace.settings?.git || DEFAULT_GIT_SETTINGS

  // Get or create worktree (same as Claude agent)
  let outputPath = workspace.path

  if (gitSettings.autoBranch && gitSettings.useWorktrees) {
    const branchName = conversation.branchName ||
      generateAgentBranchName('deep-research', conversationId.slice(0, 7))

    const worktreePath = await worktreeService.ensureConversationWorktree(
      workspace.path,
      conversationId,
      branchName,
      gitSettings
    )

    if (worktreePath) {
      outputPath = worktreePath
      updateConversation(conversationId, { worktreePath, branchName })
    }
  }

  // Run research (output goes to worktree)
  const researchOutputDir = path.join(outputPath, workspace.settings?.researchOutputDirectory || 'research')
  await fs.mkdir(researchOutputDir, { recursive: true })

  const stream = runResearch(message, {
    model: conversation.settings?.model || 'o4-mini-deep-research-2025-06-26',
    apiKey: getOpenAIApiKey(),
    previousContext: await getPreviousContext(conversationId)
  })

  let fullResponse = ''
  for await (const event of stream) {
    if (event.type === 'delta') {
      fullResponse += event.text
      mainWindow.webContents.send('research:delta', { conversationId, text: event.text })
    }
  }

  // Save report to worktree
  const filename = generateReportFilename(message)
  const reportPath = path.join(researchOutputDir, filename)
  await fs.writeFile(reportPath, fullResponse)

  // Auto-commit if enabled (commits to worktree's branch)
  if (gitSettings.autoCommit && conversation.worktreePath) {
    await gitService.stageAll(conversation.worktreePath)
    await gitService.commit(
      conversation.worktreePath,
      `[Research] ${message.slice(0, 50)}...\n\nSaved: ${filename}`
    )
  }

  mainWindow.webContents.send('research:complete', {
    conversationId,
    outputPath: reportPath
  })
}
```

### 2.6 Shared Git Helper for Both Agent Types

**File:** `chorus/src/main/services/agent-git-helper.ts` (NEW - Shared utilities)

```typescript
import * as worktreeService from './worktree-service'
import * as gitService from './git-service'

/**
 * Get the working directory for any agent conversation.
 * Returns worktree path if enabled, otherwise main repo path.
 * Works for Claude, OpenAI, or any future agent type.
 */
export async function getAgentWorkingDirectory(
  conversationId: string,
  agentName: string,
  repoPath: string,
  gitSettings: GitSettings
): Promise<{ cwd: string; branchName: string | null; worktreePath: string | null }> {
  if (!gitSettings.autoBranch) {
    return { cwd: repoPath, branchName: null, worktreePath: null }
  }

  const branchName = generateAgentBranchName(agentName, conversationId.slice(0, 7))

  if (!gitSettings.useWorktrees) {
    // Legacy: checkout in main repo
    await gitService.checkout(repoPath, branchName)
    return { cwd: repoPath, branchName, worktreePath: null }
  }

  // Worktree mode: create isolated working directory
  const worktreePath = await worktreeService.ensureConversationWorktree(
    repoPath,
    conversationId,
    branchName,
    gitSettings
  )

  return {
    cwd: worktreePath || repoPath,
    branchName,
    worktreePath
  }
}

/**
 * Auto-commit changes for any agent.
 */
export async function autoCommitAgentChanges(
  cwd: string,
  message: string,
  gitSettings: GitSettings
): Promise<string | null> {
  if (!gitSettings.autoCommit) {
    return null
  }

  const status = await gitService.getStatus(cwd)
  if (!status.isDirty) {
    return null
  }

  await gitService.stageAll(cwd)
  const commitHash = await gitService.commit(cwd, message)
  return commitHash
}

function generateAgentBranchName(agentName: string, sessionId: string): string {
  const sanitizedAgentName = agentName.toLowerCase().replace(/[^a-z0-9]/g, '-')
  return `agent/${sanitizedAgentName}/${sessionId}`
}
```

### 2.7 Update Conversation Schema

**File:** `chorus/src/main/services/conversation-service.ts`

```typescript
export interface Conversation {
  id: string
  sessionId: string | null
  sessionCreatedAt: string | null
  branchName: string | null
  worktreePath: string | null  // NEW: Path to worktree if active
  agentId: string
  workspaceId: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
  settings?: ConversationSettings
}
```

## Phase 3: UI Integration

### 3.1 Worktree Panel Component

**File:** `chorus/src/renderer/src/components/MainPane/WorktreePanel.tsx`

```tsx
import { useState, useEffect } from 'react'

interface WorktreePanelProps {
  workspacePath: string
  onRefresh: () => void
}

export function WorktreePanel({ workspacePath, onRefresh }: WorktreePanelProps) {
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadWorktrees()
  }, [workspacePath])

  const loadWorktrees = async () => {
    setLoading(true)
    const result = await window.api.git.listWorktrees(workspacePath)
    if (result.success && result.data) {
      // Filter to only show conversation worktrees (not main)
      const conversationWorktrees = result.data.filter(
        w => !w.isMain && w.path.includes('.chorus-worktrees')
      )
      setWorktrees(conversationWorktrees)
    }
    setLoading(false)
  }

  const handlePrune = async () => {
    await window.api.git.pruneWorktrees(workspacePath)
    loadWorktrees()
  }

  const handleRemove = async (worktreePath: string) => {
    const status = await window.api.git.getWorktreeStatus(worktreePath)
    if (status.data?.isDirty) {
      const confirm = window.confirm(
        'This worktree has uncommitted changes. Are you sure you want to delete it?'
      )
      if (!confirm) return
    }

    await window.api.git.removeWorktree(workspacePath, worktreePath, true)
    loadWorktrees()
    onRefresh()
  }

  if (loading) {
    return <div className="p-4 text-muted">Loading worktrees...</div>
  }

  if (worktrees.length === 0) {
    return null // Don't show section if no worktrees
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider flex items-center gap-2">
          <FolderTreeIcon />
          Active Worktrees ({worktrees.length})
        </h2>
        <button
          onClick={handlePrune}
          className="text-xs text-muted hover:text-primary"
          title="Remove stale worktree entries"
        >
          Prune
        </button>
      </div>

      <div className="space-y-2">
        {worktrees.map((worktree) => (
          <WorktreeCard
            key={worktree.path}
            worktree={worktree}
            onRemove={() => handleRemove(worktree.path)}
          />
        ))}
      </div>
    </div>
  )
}

function WorktreeCard({ worktree, onRemove }: { worktree: WorktreeInfo; onRemove: () => void }) {
  const conversationId = worktree.path.split('/').pop() || ''

  return (
    <div className="p-3 rounded-lg bg-input border border-default">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-primary truncate">
              {worktree.branch}
            </span>
            {worktree.isLocked && (
              <span className="text-xs px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                Locked
              </span>
            )}
          </div>
          <p className="text-xs text-muted mt-1 truncate" title={worktree.path}>
            {worktree.path}
          </p>
          <p className="text-xs text-muted mt-1">
            Commit: {worktree.commit.slice(0, 7)}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onRemove}
            className="p-1.5 text-muted hover:text-red-400 hover:bg-red-500/10 rounded"
            title="Remove worktree"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
```

### 3.2 Add to Workspace Overview

**File:** `chorus/src/renderer/src/components/MainPane/WorkspaceOverview.tsx`

```tsx
import { WorktreePanel } from './WorktreePanel'

// In the component, add after AgentSessionsPanel:
{workspace.gitBranch && (
  <>
    <AgentSessionsPanel
      workspacePath={workspace.path}
      onBranchChange={handleBranchChange}
    />
    <WorktreePanel
      workspacePath={workspace.path}
      onRefresh={handleRefresh}
    />
  </>
)}
```

### 3.3 Workspace Settings UI

**File:** `chorus/src/renderer/src/components/MainPane/WorkspaceSettings.tsx`

Add worktree settings section:

```tsx
// Git Isolation Settings section
<div className="mb-8">
  <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
    <GitBranchIcon />
    Agent Isolation
  </h2>
  <div className="p-4 rounded-lg bg-input border border-default space-y-4">
    <div className="space-y-2">
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="radio"
          name="isolation"
          checked={gitSettings.useWorktrees}
          onChange={() => updateGitSettings({ useWorktrees: true })}
          className="w-4 h-4"
        />
        <div>
          <p className="text-primary">Use git worktrees for agent isolation</p>
          <p className="text-xs text-muted">
            Each conversation gets its own working directory.
            Enables true parallel agent execution. (Recommended)
          </p>
        </div>
      </label>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="radio"
          name="isolation"
          checked={!gitSettings.useWorktrees}
          onChange={() => updateGitSettings({ useWorktrees: false })}
          className="w-4 h-4"
        />
        <div>
          <p className="text-primary">Use branch switching (Legacy)</p>
          <p className="text-xs text-muted">
            All agents share one working directory.
            <span className="text-yellow-400 ml-1">
              Concurrent agents may interfere with each other.
            </span>
          </p>
        </div>
      </label>
    </div>

    {gitSettings.useWorktrees && (
      <div className="pt-3 border-t border-default space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={gitSettings.autoCleanupWorktrees}
            onChange={(e) => updateGitSettings({ autoCleanupWorktrees: e.target.checked })}
            className="w-4 h-4 rounded border-default"
          />
          <div>
            <p className="text-primary">Auto-cleanup worktrees after branch merge</p>
            <p className="text-xs text-muted">
              Remove worktree when its branch is merged to main
            </p>
          </div>
        </label>
      </div>
    )}
  </div>
</div>
```

### 3.4 Chat Header Worktree Indicator

**File:** `chorus/src/renderer/src/components/Chat/ChatHeader.tsx`

```tsx
// Show worktree path if active
{conversation.worktreePath && (
  <span className="text-xs text-muted ml-2" title={conversation.worktreePath}>
    (worktree)
  </span>
)}
```

## Phase 4: Lifecycle Management

### 4.1 Cleanup on Conversation Delete

**File:** `chorus/src/main/services/conversation-service.ts`

```typescript
export async function deleteConversation(
  conversationId: string,
  cleanup: { worktree?: boolean; branch?: boolean } = {}
): Promise<void> {
  const conversation = getConversation(conversationId)
  if (!conversation) return

  // Cleanup worktree if requested
  if (cleanup.worktree && conversation.worktreePath) {
    try {
      const workspace = getWorkspace(conversation.workspaceId)
      if (workspace) {
        await worktreeService.removeConversationWorktree(
          workspace.path,
          conversationId,
          workspace.settings?.git || DEFAULT_GIT_SETTINGS,
          true // force
        )
      }
    } catch (error) {
      console.error('[Conversation] Failed to cleanup worktree:', error)
    }
  }

  // Cleanup branch if requested
  if (cleanup.branch && conversation.branchName) {
    // ... existing branch cleanup ...
  }

  // Delete conversation data
  // ... existing delete logic ...
}
```

### 4.2 Prune Worktrees on Startup

**File:** `chorus/src/main/index.ts`

```typescript
// On app ready, prune stale worktrees for all workspaces
app.whenReady().then(async () => {
  // ... existing startup code ...

  // Prune stale worktrees
  const workspaces = getAllWorkspaces()
  for (const workspace of workspaces) {
    try {
      await gitService.pruneWorktrees(workspace.path)
    } catch (error) {
      console.error(`[Startup] Failed to prune worktrees for ${workspace.path}:`, error)
    }
  }
})
```

### 4.3 IPC Events for Worktree Lifecycle

```typescript
// New IPC events
'git:worktree-created'    // { conversationId, worktreePath, branchName }
'git:worktree-removed'    // { conversationId }
'git:worktrees-pruned'    // { count }

// Listen in renderer
useEffect(() => {
  const handleWorktreeCreated = (_event, data) => {
    console.log('Worktree created:', data)
    // Update UI state
  }

  window.api.on('git:worktree-created', handleWorktreeCreated)
  return () => window.api.off('git:worktree-created', handleWorktreeCreated)
}, [])
```

## Phase 5: Testing

### 5.1 Unit Tests

```typescript
// git-service.test.ts
describe('worktree functions', () => {
  it('creates worktree with new branch', async () => {
    await createWorktree(repoPath, worktreePath, 'test-branch', 'main')
    const worktrees = await listWorktrees(repoPath)
    expect(worktrees).toContainEqual(expect.objectContaining({
      path: worktreePath,
      branch: 'test-branch'
    }))
  })

  it('creates worktree with existing branch', async () => {
    // Create branch first
    await createBranch(repoPath, 'existing-branch')
    await createWorktree(repoPath, worktreePath, 'existing-branch')
    // Verify worktree exists
  })

  it('removes worktree', async () => {
    await createWorktree(repoPath, worktreePath, 'test-branch')
    await removeWorktree(repoPath, worktreePath)
    const worktrees = await listWorktrees(repoPath)
    expect(worktrees).not.toContainEqual(expect.objectContaining({
      path: worktreePath
    }))
  })

  it('detects dirty worktree', async () => {
    await createWorktree(repoPath, worktreePath, 'test-branch')
    // Create file in worktree
    await fs.writeFile(path.join(worktreePath, 'test.txt'), 'content')
    const status = await getWorktreeStatus(worktreePath)
    expect(status.isDirty).toBe(true)
  })
})
```

### 5.2 Integration Tests

```typescript
describe('concurrent agent execution', () => {
  it('two agents can work in parallel without conflicts', async () => {
    // Start conversation A
    const convA = await createConversation(agentA, workspaceId)
    await sendMessage(convA.id, 'Create file A')

    // Start conversation B while A is still running
    const convB = await createConversation(agentB, workspaceId)
    await sendMessage(convB.id, 'Create file B')

    // Verify each wrote to their own worktree
    const fileA = await fs.readFile(path.join(convA.worktreePath, 'fileA.txt'))
    const fileB = await fs.readFile(path.join(convB.worktreePath, 'fileB.txt'))

    // Verify branches are separate
    expect(convA.branchName).not.toBe(convB.branchName)
  })
})
```

### 5.3 Manual Testing Checklist

- [ ] Start conversation with worktrees enabled → worktree created
- [ ] Send message → agent works in worktree
- [ ] Start second conversation → gets separate worktree
- [ ] Both agents work concurrently without conflicts
- [ ] Resume conversation → uses existing worktree
- [ ] Delete conversation → worktree cleaned up (if enabled)
- [ ] Disable worktrees → falls back to branch switching
- [ ] Prune button removes stale entries
- [ ] Uncommitted changes warning on delete

## File Summary

| File | Changes |
|------|---------|
| **Main Process - Git Layer** | |
| `git-service.ts` | Add 8+ worktree functions |
| `worktree-service.ts` | NEW: Worktree lifecycle management |
| `agent-git-helper.ts` | NEW: Shared git utilities for all agent types |
| **Main Process - Agent Services** | |
| `agent-sdk-service.ts` | Use worktree path as cwd (Claude agents) |
| `openai-research-service.ts` | Use worktree path for research output (OpenAI agents) |
| `conversation-service.ts` | Add worktreePath field |
| **Main Process - IPC** | |
| `main/index.ts` | Add 5 worktree IPC handlers |
| `preload/index.ts` | Expose worktree methods |
| `preload/index.d.ts` | Add worktree types |
| **Main Process - Settings** | |
| `store/index.ts` | Add worktree settings to GitSettings |
| **Renderer - UI Components** | |
| `WorktreePanel.tsx` | NEW: Worktree list UI |
| `WorkspaceSettings.tsx` | Add worktree settings UI |
| `WorkspaceOverview.tsx` | Add WorktreePanel |
| `ChatHeader.tsx` | Add worktree indicator |
| `FileBrowser.tsx` | Show branch context for active conversation |

## Implementation Order

1. **Phase 1: Git Service** - Core worktree git operations
2. **Phase 2: Agent Integration** - Use worktrees for both Claude and OpenAI agents
3. **Phase 3: UI** - Settings, worktree panel, branch indicators
4. **Phase 4: Lifecycle** - Cleanup and pruning
5. **Phase 5: Testing** - Unit, integration, manual tests

## Relationship to Other Specs

| Spec | Relationship |
|------|--------------|
| **Spec 12** (Automated Git Operations) | Worktrees BUILD ON existing auto-branch/auto-commit features. Same `GitSettings`, same commit hooks, just isolated directories. |
| **Spec 15** (OpenAI Deep Research) | Research agent uses worktree path for output directory. Research reports auto-committed to agent branch. |
| **Spec 7** (Tab Navigation) | File tabs show branch context when viewing worktree files. |
| **Spec 6** (Details Panel) | Files in Details panel link to worktree path, not main repo. |
