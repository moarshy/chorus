import { Agent, run, webSearchTool } from '@openai/agents'
import OpenAI from 'openai'
import { setDefaultOpenAIClient } from '@openai/agents'
import { BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs/promises'
import * as path from 'path'
import {
  appendMessage,
  updateConversation,
  generateTitleFromMessage,
  ConversationMessage,
  loadConversation,
  ConversationSettings,
  ResearchPhase,
  ResearchSource
} from './conversation-service'
import { getOpenAIApiKey, getResearchOutputDirectory, GitSettings, DEFAULT_GIT_SETTINGS } from '../store'
import {
  ensureAgentBranch,
  commitAgentChanges,
  conversationBranches
} from './agent-sdk-service'
import * as worktreeService from './worktree-service'
import * as gitService from './git-service'

// ============================================
// Active Sessions Management
// ============================================

// Store active abort controllers per conversation
const activeSessions: Map<string, AbortController> = new Map()

// ============================================
// Research-specific Git Helpers
// ============================================

/**
 * Generate commit message for research output
 */
function generateResearchCommitMessage(query: string, outputPath: string): string {
  const maxQueryLength = 50
  let summary = query.slice(0, maxQueryLength)
  if (query.length > maxQueryLength) {
    summary += '...'
  }

  return `[Deep Research] ${summary}\n\nOutput: ${outputPath}`
}

// ============================================
// OpenAI Research Service
// ============================================

/**
 * Send a research query to OpenAI Deep Research agent
 */
export async function sendResearchMessage(
  conversationId: string,
  agentId: string,
  _workspaceId: string,
  repoPath: string,
  message: string,
  mainWindow: BrowserWindow,
  settings?: ConversationSettings,
  gitSettings?: GitSettings
): Promise<void> {
  // Stop any existing session
  stopResearchAgent(conversationId)

  // Check for API key
  const apiKey = getOpenAIApiKey()
  console.log('[OpenAI Research] Got API key, length:', apiKey?.length, 'exists:', !!apiKey)
  if (!apiKey) {
    const errorMessage: ConversationMessage = {
      uuid: uuidv4(),
      type: 'error',
      content: 'OpenAI API key not configured. Go to Settings to add your key.',
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
      error: 'OpenAI API key not configured'
    })
    return
  }

  // Send busy status
  mainWindow.webContents.send('agent:status', {
    agentId,
    status: 'busy'
  })

  const controller = new AbortController()
  activeSessions.set(conversationId, controller)

  // Create and save user message
  const userMessage: ConversationMessage = {
    uuid: uuidv4(),
    type: 'user',
    content: message,
    timestamp: new Date().toISOString()
  }
  appendMessage(conversationId, userMessage)
  mainWindow.webContents.send('agent:message', {
    conversationId,
    agentId,
    message: userMessage
  })

  // Get previous context for follow-ups
  const previousContext = await getPreviousResearchContext(conversationId)

  // Track state
  let streamingContent = ''
  const isFirstMessage = !previousContext
  const effectiveGitSettings = gitSettings || DEFAULT_GIT_SETTINGS

  // Determine working directory (worktree or main repo)
  let outputBasePath = repoPath
  let worktreePath: string | null = null

  // Create worktree for new sessions if worktrees enabled
  if (isFirstMessage && effectiveGitSettings.autoBranch && effectiveGitSettings.useWorktrees) {
    const branchName = worktreeService.generateAgentBranchName('deep-research', conversationId.slice(0, 7))

    worktreePath = await worktreeService.ensureConversationWorktree(
      repoPath,
      conversationId,
      branchName,
      effectiveGitSettings
    )

    if (worktreePath) {
      outputBasePath = worktreePath
      console.log(`[OpenAI Research] Using worktree: ${worktreePath}`)
      updateConversation(conversationId, { branchName, worktreePath })
      // Register branch for commit operations
      conversationBranches.set(conversationId, branchName)
    }
  } else if (isFirstMessage) {
    // Legacy mode: create branch in main repo (without worktree)
    const branchName = await ensureAgentBranch(
      conversationId,
      conversationId,
      'deep-research',
      repoPath,
      mainWindow,
      effectiveGitSettings
    )
    if (branchName) {
      updateConversation(conversationId, { branchName })
    }
  } else {
    // Resuming session - check for existing worktree
    if (effectiveGitSettings.useWorktrees) {
      const existingWorktree = worktreeService.getConversationWorktreePath(repoPath, conversationId)
      const worktrees = await gitService.listWorktrees(repoPath)
      const existingWorktreeInfo = worktrees.find(w => w.path === existingWorktree)
      if (existingWorktreeInfo) {
        outputBasePath = existingWorktree
        worktreePath = existingWorktree
        console.log(`[OpenAI Research] Resuming in existing worktree: ${existingWorktree}`)
        // Register branch for commit operations
        conversationBranches.set(conversationId, existingWorktreeInfo.branch)
      }
    }
  }

  try {
    // Configure OpenAI client with extended timeout for deep research
    const client = new OpenAI({
      apiKey,
      timeout: 600000 // 10 minutes
    })
    setDefaultOpenAIClient(client)

    // Get model from settings - only use if it's an OpenAI model, otherwise use default
    const OPENAI_RESEARCH_MODELS = ['o4-mini-deep-research-2025-06-26', 'o3-deep-research-2025-06-26']
    const modelId = settings?.model && OPENAI_RESEARCH_MODELS.includes(settings.model)
      ? settings.model
      : 'o4-mini-deep-research-2025-06-26'

    // Build prompt with context for follow-ups
    const prompt = previousContext
      ? `Previous research:\n\n${previousContext}\n\n---\n\nFollow-up question: ${message}`
      : message

    // Create research agent
    const researchAgent = new Agent({
      name: 'Deep Researcher',
      model: modelId,
      tools: [webSearchTool()],
      instructions: `You perform deep empirical research based on the user's question.

Guidelines:
- Search multiple authoritative sources
- Cross-reference information for accuracy
- Provide citations with URLs for all claims
- Synthesize findings into actionable insights
- Structure output with clear headings
- Acknowledge limitations and gaps in information
- Use markdown formatting for better readability`
    })

    // Stream research
    const stream = await run(researchAgent, prompt, {
      stream: true,
      signal: controller.signal
    })

    // Track search count and sources for status
    let searchCount = 0
    const researchSources: ResearchSource[] = []
    let currentPhase: ResearchPhase = 'analyzing'
    let phaseStartTime = Date.now()

    // Helper to create and store a progress message
    const storeProgressMessage = (phase: ResearchPhase, content: string, sources?: ResearchSource[]) => {
      const progressMessage: ConversationMessage = {
        uuid: uuidv4(),
        type: 'research_progress',
        content,
        timestamp: new Date().toISOString(),
        researchPhase: phase,
        searchCount,
        researchSources: sources
      }
      appendMessage(conversationId, progressMessage)
      mainWindow.webContents.send('agent:message', {
        conversationId,
        agentId,
        message: progressMessage
      })
    }

    // Store initial analyzing phase
    storeProgressMessage('analyzing', 'Analyzing your research question...')

    // Process stream events
    for await (const event of stream) {
      if (event.type === 'raw_model_stream_event') {
        const data = event.data as {
          type?: string
          event?: {
            type: string
            delta?: string
            item?: { type: string; status?: string }
          }
        }
        const innerEvent = data?.event

        // Handle text streaming - multiple possible event types
        if (innerEvent?.type === 'response.output_text.delta' && innerEvent.delta) {
          // If we're getting text output, we're in synthesizing phase
          if (currentPhase !== 'synthesizing') {
            currentPhase = 'synthesizing'
            storeProgressMessage('synthesizing', `Synthesizing findings from ${searchCount} searches...`, researchSources)
          }
          streamingContent += innerEvent.delta
          mainWindow.webContents.send('agent:stream-delta', {
            conversationId,
            delta: innerEvent.delta
          })
        }

        // Also check for content_part delta (alternative text streaming format)
        if (innerEvent?.type === 'response.content_part.delta') {
          const contentDelta = (innerEvent as { delta?: { text?: string } }).delta?.text
          if (contentDelta) {
            if (currentPhase !== 'synthesizing') {
              currentPhase = 'synthesizing'
              storeProgressMessage('synthesizing', `Synthesizing findings from ${searchCount} searches...`, researchSources)
            }
            streamingContent += contentDelta
            mainWindow.webContents.send('agent:stream-delta', {
              conversationId,
              delta: contentDelta
            })
          }
        }

        // Track web searches for status
        if (innerEvent?.type === 'response.web_search_call.searching') {
          searchCount++
          if (currentPhase !== 'searching') {
            currentPhase = 'searching'
          }

          // Extract search query if available
          const searchQuery = (innerEvent as { query?: string }).query
          if (searchQuery) {
            researchSources.push({ query: searchQuery })
          }

          // Store progress every few searches to avoid too many messages
          if (searchCount === 1 || searchCount % 5 === 0) {
            storeProgressMessage('searching', `Searching the web... (${searchCount} searches)`, researchSources)
          }

          mainWindow.webContents.send('agent:stream-delta', {
            conversationId,
            delta: searchCount === 1 ? `🔍 Searching the web...\n` : ''
          })
        }

        // Track when web search finds a URL
        if (innerEvent?.type === 'response.web_search_call.completed') {
          const searchResult = innerEvent as { url?: string; title?: string }
          if (searchResult.url) {
            researchSources.push({
              url: searchResult.url,
              title: searchResult.title
            })
          }
        }

        // Show when reasoning
        if (innerEvent?.type === 'response.output_item.added') {
          const item = (innerEvent as { item?: { type: string } }).item
          if (item?.type === 'reasoning') {
            if (currentPhase !== 'reasoning') {
              currentPhase = 'reasoning'
              const elapsed = Math.round((Date.now() - phaseStartTime) / 1000)
              storeProgressMessage('reasoning', `Reasoning about findings... (${elapsed}s elapsed)`)
            }
            if (searchCount === 0) {
              mainWindow.webContents.send('agent:stream-delta', {
                conversationId,
                delta: '🤔 Analyzing your question...\n'
              })
            }
          }
        }
      }
    }

    await stream.completed

    // Clear streaming display
    mainWindow.webContents.send('agent:stream-clear', { conversationId })

    // Get final output
    const finalOutput = (stream as { finalOutput?: string }).finalOutput || streamingContent

    // Calculate metadata
    const wordCount = finalOutput.split(/\s+/).filter(w => w.length > 0).length
    const sourceCount = researchSources.filter(s => s.url).length
    const totalDuration = Date.now() - phaseStartTime

    // Save research output to file (use worktree path if available)
    const outputDir = getResearchOutputDirectory()
    const outputPath = await saveResearchOutput(outputBasePath, outputDir, message, finalOutput)

    // Create research result message with metadata
    const resultMessage: ConversationMessage = {
      uuid: uuidv4(),
      type: 'research_result',
      content: finalOutput,
      timestamp: new Date().toISOString(),
      researchPhase: 'complete',
      searchCount,
      researchSources,
      outputPath,
      wordCount,
      sourceCount,
      durationMs: totalDuration
    }
    appendMessage(conversationId, resultMessage)
    mainWindow.webContents.send('agent:message', {
      conversationId,
      agentId,
      message: resultMessage
    })

    // Send completion event with output path
    mainWindow.webContents.send('research:complete', {
      conversationId,
      outputPath,
      text: finalOutput
    })

    // Send file changed event so it shows in Details panel
    mainWindow.webContents.send('agent:file-changed', {
      conversationId,
      filePath: outputPath,
      toolName: 'ResearchSave'
    })

    // Auto-commit the research output (using shared git infrastructure)
    const commitMessage = generateResearchCommitMessage(message, outputPath)
    await commitAgentChanges(
      conversationId,
      outputBasePath,  // Use worktree path when available
      commitMessage,
      [outputPath],
      'research',
      mainWindow,
      effectiveGitSettings
    )

    // Generate title from first message
    if (isFirstMessage) {
      const title = generateTitleFromMessage(message)
      updateConversation(conversationId, { title })
    }

    // Store completion system message (the research_result already has the content)
    const completionMessage: ConversationMessage = {
      uuid: uuidv4(),
      type: 'system',
      content: `Research complete. Saved to: ${outputPath}`,
      timestamp: new Date().toISOString()
    }
    appendMessage(conversationId, completionMessage)
    mainWindow.webContents.send('agent:message', {
      conversationId,
      agentId,
      message: completionMessage
    })
  } catch (error) {
    // Handle abort/cancellation
    if (error instanceof Error && error.name === 'AbortError') {
      const stoppedMessage: ConversationMessage = {
        uuid: uuidv4(),
        type: 'system',
        content: 'Research stopped by user',
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
      console.error('[OpenAI Research] Error:', errorMsg)

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
      mainWindow.webContents.send('research:error', {
        conversationId,
        error: errorMsg
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
    activeSessions.delete(conversationId)

    // Send ready status
    mainWindow.webContents.send('agent:status', {
      agentId,
      status: 'ready'
    })
  }
}

/**
 * Stop a research session
 */
export function stopResearchAgent(conversationId: string): void {
  const controller = activeSessions.get(conversationId)
  if (controller) {
    controller.abort()
    activeSessions.delete(conversationId)
  }
}

/**
 * Get previous research context for follow-up questions
 */
function getPreviousResearchContext(conversationId: string): string | undefined {
  try {
    const { messages } = loadConversation(conversationId)

    // Get assistant messages (research outputs)
    const assistantMessages = messages
      .filter((m) => m.type === 'assistant' && m.content)
      .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))

    if (assistantMessages.length === 0) return undefined

    // Return last research output as context
    // If there are multiple, concatenate the last few (but not all, to avoid context overflow)
    const maxContextMessages = 2
    const recentMessages = assistantMessages.slice(-maxContextMessages)
    return recentMessages.join('\n\n---\n\n')
  } catch (error) {
    console.error('[OpenAI Research] Failed to load previous context:', error)
    return undefined
  }
}

/**
 * Save research output to a file
 */
async function saveResearchOutput(
  repoPath: string,
  outputDir: string,
  query: string,
  content: string
): Promise<string> {
  // Resolve output directory
  const fullOutputDir = path.isAbsolute(outputDir) ? outputDir : path.join(repoPath, outputDir)

  // Ensure directory exists
  await fs.mkdir(fullOutputDir, { recursive: true })

  // Generate filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const slug = query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
  const filename = `${timestamp}-${slug}.md`

  // Write file
  const filePath = path.join(fullOutputDir, filename)
  const fileContent = `# Research: ${query}

Generated: ${new Date().toISOString()}
Model: OpenAI Deep Research

---

${content}
`

  await fs.writeFile(filePath, fileContent, 'utf-8')

  // Return relative path for display
  return path.relative(repoPath, filePath)
}

/**
 * Validate an OpenAI API key
 * Just checks format - actual API errors will show at runtime
 */
export async function validateOpenAIApiKey(apiKey: string): Promise<boolean> {
  // Check basic format: sk-... or sk-proj-... patterns
  if (!apiKey || apiKey.length < 20) {
    return false
  }

  // Accept common OpenAI key formats
  const validPatterns = [
    /^sk-[a-zA-Z0-9]{20,}$/,           // Standard key
    /^sk-proj-[a-zA-Z0-9]{20,}$/,       // Project key
    /^sk-[a-zA-Z0-9-_]{20,}$/           // Keys with dashes/underscores
  ]

  const isValidFormat = validPatterns.some(pattern => pattern.test(apiKey))

  if (!isValidFormat) {
    console.warn('[OpenAI Research] API key format not recognized, but allowing anyway')
  }

  // Accept any key that looks reasonable - let actual API calls fail with better error messages
  return apiKey.startsWith('sk-') && apiKey.length >= 20
}
