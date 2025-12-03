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
  ConversationSettings
} from './conversation-service'
import { getOpenAIApiKey, getResearchOutputDirectory } from '../store'

// ============================================
// Active Sessions Management
// ============================================

// Store active abort controllers per conversation
const activeSessions: Map<string, AbortController> = new Map()

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
  settings?: ConversationSettings
): Promise<void> {
  // Stop any existing session
  stopResearchAgent(conversationId)

  // Check for API key
  const apiKey = getOpenAIApiKey()
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
  const searchQueries: string[] = []
  const isFirstMessage = !previousContext

  try {
    // Configure OpenAI client with extended timeout for deep research
    const client = new OpenAI({
      apiKey,
      timeout: 600000 // 10 minutes
    })
    setDefaultOpenAIClient(client)

    // Get model from settings or use default
    const modelId = settings?.model || 'o4-mini-deep-research-2025-06-26'

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

    // Process stream events
    for await (const event of stream) {
      // Handle text streaming
      if (event.type === 'raw_model_stream_event') {
        const data = event.data as { delta?: { type: string; text?: string } }
        const delta = data?.delta
        if (delta?.type === 'text_delta' && delta.text) {
          streamingContent += delta.text
          mainWindow.webContents.send('agent:stream-delta', {
            conversationId,
            delta: delta.text
          })
        }
      }

      // Handle tool calls (web searches)
      if (event.type === 'run_item_stream_event') {
        const itemEvent = event as { name: string; item?: { name?: string; input?: { query?: string } } }
        if (itemEvent.name === 'tool_called' && itemEvent.item?.name === 'web_search') {
          const searchQuery = itemEvent.item.input?.query || 'web'
          searchQueries.push(searchQuery)
          mainWindow.webContents.send('research:search', {
            conversationId,
            query: searchQuery
          })
        }
      }
    }

    await stream.completed

    // Clear streaming display
    mainWindow.webContents.send('agent:stream-clear', { conversationId })

    // Get final output
    const finalOutput = (stream as { finalOutput?: string }).finalOutput || streamingContent

    // Save research output to file
    const outputDir = getResearchOutputDirectory()
    const outputPath = await saveResearchOutput(repoPath, outputDir, message, finalOutput)

    // Create assistant message with the research output
    const assistantMessage: ConversationMessage = {
      uuid: uuidv4(),
      type: 'assistant',
      content: finalOutput,
      timestamp: new Date().toISOString()
    }
    appendMessage(conversationId, assistantMessage)
    mainWindow.webContents.send('agent:message', {
      conversationId,
      agentId,
      message: assistantMessage
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

    // Generate title from first message
    if (isFirstMessage) {
      const title = generateTitleFromMessage(message)
      updateConversation(conversationId, { title })
    }

    // Store result message
    const resultMessage: ConversationMessage = {
      uuid: uuidv4(),
      type: 'system',
      content: `Research complete. Saved to: ${outputPath}`,
      timestamp: new Date().toISOString()
    }
    appendMessage(conversationId, resultMessage)
    mainWindow.webContents.send('agent:message', {
      conversationId,
      agentId,
      message: resultMessage
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
 */
export async function validateOpenAIApiKey(apiKey: string): Promise<boolean> {
  try {
    const client = new OpenAI({ apiKey, timeout: 10000 })
    await client.models.list()
    return true
  } catch (error) {
    console.error('[OpenAI Research] API key validation failed:', error)
    return false
  }
}
