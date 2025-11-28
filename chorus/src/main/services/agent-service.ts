import { spawn, ChildProcess, execSync } from 'child_process'
import { existsSync } from 'fs'
import { BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import {
  appendMessage,
  updateConversation,
  generateTitleFromMessage,
  ConversationMessage,
  ClaudeCodeMessage,
  ClaudeAssistantMessage,
  ClaudeUserMessage,
  ClaudeResultMessage
} from './conversation-service'

// Store active processes per agent
const agentProcesses: Map<string, ChildProcess> = new Map()

// Store session IDs for conversation continuity (runtime cache)
const agentSessions: Map<string, string> = new Map()

// ============================================
// Claude CLI Detection
// ============================================

/**
 * Detect if claude CLI is available in PATH
 */
export function detectClaudePath(): string | null {
  try {
    const path = execSync('which claude', { encoding: 'utf-8' }).trim()
    return path || null
  } catch {
    return null
  }
}

/**
 * Check if Claude CLI is available
 */
export function isClaudeAvailable(): string | null {
  return detectClaudePath()
}

// ============================================
// Agent Communication
// ============================================

/**
 * Send a message to a Claude agent using the Claude CLI
 */
export async function sendMessage(
  conversationId: string,
  agentId: string,
  repoPath: string,
  message: string,
  sessionId: string | null,
  agentFilePath: string | null,
  mainWindow: BrowserWindow
): Promise<void> {
  // Kill any existing process for this agent
  stopAgent(agentId)

  // Send busy status
  mainWindow.webContents.send('agent:status', {
    agentId,
    status: 'busy'
  })

  // Build claude command args
  const args = ['-p', '--verbose', '--output-format', 'stream-json']

  // Add agent system prompt file if provided and exists
  if (agentFilePath && existsSync(agentFilePath)) {
    args.push('--system-prompt-file', agentFilePath)
  }

  // Add session resume if we have one
  if (sessionId) {
    args.push('--resume', sessionId)
  }

  // Add the prompt
  args.push(message)

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

  // Get claude path
  const claudePath = detectClaudePath()
  if (!claudePath) {
    const errorMessage: ConversationMessage = {
      uuid: uuidv4(),
      type: 'error',
      content: 'Claude CLI not found. Please install Claude Code first.',
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
      error: 'Claude CLI not found'
    })
    return
  }

  try {
    // Spawn claude CLI process
    const claudeProcess = spawn(claudePath, args, {
      cwd: repoPath,
      env: {
        ...process.env,
        TERM: 'xterm-256color'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    agentProcesses.set(agentId, claudeProcess)

    // Close stdin to signal no more input
    claudeProcess.stdin?.end()

    let buffer = ''
    let capturedSessionId: string | null = null
    let streamingContent = ''
    let isFirstMessage = !sessionId // Track if this is the first message in conversation
    let hasSetTitle = false
    // Collect all raw Claude Code messages for this turn
    const rawClaudeMessages: ClaudeCodeMessage[] = []
    let currentAssistantMessage: ClaudeAssistantMessage | null = null
    let resultMessage: ClaudeResultMessage | null = null

    // Handle stdout - parse streaming JSON
    claudeProcess.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString()
      buffer += chunk

      // Process complete JSON lines
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue

        try {
          // Parse as unknown first - not all events are stored message types
          const event = JSON.parse(line) as Record<string, unknown>
          const eventType = event.type as string

          // Only store main message types (not streaming events like content_block_delta)
          if (['system', 'assistant', 'user', 'result'].includes(eventType)) {
            rawClaudeMessages.push(event as unknown as ClaudeCodeMessage)
          }

          // Handle system init - capture session ID
          if (eventType === 'system' && event.subtype === 'init') {
            const sessionId = event.session_id as string
            capturedSessionId = sessionId
            agentSessions.set(agentId, sessionId)
            // Update conversation with session ID
            updateConversation(conversationId, { sessionId })

            // Store system init message
            const systemMessage: ConversationMessage = {
              uuid: uuidv4(),
              type: 'system',
              content: `Session started with model ${event.model as string}`,
              timestamp: new Date().toISOString(),
              sessionId,
              claudeMessage: event as unknown as ClaudeCodeMessage
            }
            appendMessage(conversationId, systemMessage)
          }

          // Handle assistant messages
          if (eventType === 'assistant') {
            const assistantEvent = event as unknown as ClaudeAssistantMessage
            if (assistantEvent.message?.content) {
              currentAssistantMessage = assistantEvent

              for (const block of assistantEvent.message.content) {
                if (block.type === 'text') {
                  // Send stream delta for real-time display
                  mainWindow.webContents.send('agent:stream-delta', {
                    conversationId,
                    delta: block.text
                  })
                  streamingContent += block.text
                } else if (block.type === 'tool_use') {
                  // Create tool use message with raw Claude message attached
                  const toolMessage: ConversationMessage = {
                    uuid: uuidv4(),
                    type: 'tool_use',
                    content: `Using tool: ${block.name}`,
                    timestamp: new Date().toISOString(),
                    toolName: block.name,
                    toolInput: block.input,
                    toolUseId: block.id, // Store tool_use ID for pairing with tool_result
                    claudeMessage: assistantEvent
                  }
                  appendMessage(conversationId, toolMessage)
                  mainWindow.webContents.send('agent:message', {
                    conversationId,
                    agentId,
                    message: toolMessage
                  })
                } else if (block.type === 'thinking') {
                  // Handle thinking blocks (extended thinking models)
                  mainWindow.webContents.send('agent:stream-delta', {
                    conversationId,
                    delta: `\n<thinking>${block.thinking}</thinking>\n`
                  })
                }
              }
            }
          }

          // Handle user messages (tool results)
          if (eventType === 'user') {
            const userEvent = event as unknown as ClaudeUserMessage
            if (userEvent.message?.content) {
              for (const block of userEvent.message.content) {
                if (block.type === 'tool_result') {
                  const toolResultMessage: ConversationMessage = {
                    uuid: uuidv4(),
                    type: 'tool_result',
                    content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
                    timestamp: new Date().toISOString(),
                    toolUseId: block.tool_use_id, // Link back to tool_use message
                    isToolError: block.is_error, // Indicate if tool execution failed
                    claudeMessage: userEvent
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

          // Handle content block deltas (streaming text) - this is a streaming event, not a stored message
          if (eventType === 'content_block_delta' && event.delta) {
            const delta = event.delta as { text?: string }
            if (delta.text) {
              mainWindow.webContents.send('agent:stream-delta', {
                conversationId,
                delta: delta.text
              })
              streamingContent += delta.text
            }
          }

          // Handle result event - capture cost and session info
          if (eventType === 'result') {
            const resultEvent = event as unknown as ClaudeResultMessage
            resultMessage = resultEvent
            if (resultEvent.session_id && !capturedSessionId) {
              capturedSessionId = resultEvent.session_id
              agentSessions.set(agentId, resultEvent.session_id)
              updateConversation(conversationId, { sessionId: resultEvent.session_id })
            }
          }
        } catch {
          // Not valid JSON, might be plain text output
          if (line.trim()) {
            mainWindow.webContents.send('agent:stream-delta', {
              conversationId,
              delta: line + '\n'
            })
            streamingContent += line + '\n'
          }
        }
      }
    })

    // Handle stderr
    claudeProcess.stderr?.on('data', (data: Buffer) => {
      const errorText = data.toString()
      console.error('[Agent] stderr:', errorText)
    })

    // Handle process completion
    claudeProcess.on('close', (code) => {
      agentProcesses.delete(agentId)

      // Save the complete assistant message if we have content
      if (streamingContent.trim()) {
        const assistantMessage: ConversationMessage = {
          uuid: uuidv4(),
          type: 'assistant',
          content: streamingContent,
          timestamp: new Date().toISOString(),
          sessionId: capturedSessionId || undefined,
          // Attach the raw assistant message if we captured one
          claudeMessage: currentAssistantMessage || undefined,
          // Include usage info from assistant message
          inputTokens: currentAssistantMessage?.message?.usage?.input_tokens,
          outputTokens: currentAssistantMessage?.message?.usage?.output_tokens,
          // Include cost info from result message
          costUsd: resultMessage?.total_cost_usd,
          durationMs: resultMessage?.duration_ms
        }
        appendMessage(conversationId, assistantMessage)
        mainWindow.webContents.send('agent:message', {
          conversationId,
          agentId,
          message: assistantMessage
        })

        // Generate title from first user message if this was the first message
        if (isFirstMessage && !hasSetTitle) {
          const title = generateTitleFromMessage(message)
          updateConversation(conversationId, { title })
          hasSetTitle = true
        }
      }

      // Store result message with session stats
      if (resultMessage) {
        const resultStoredMessage: ConversationMessage = {
          uuid: uuidv4(),
          type: 'system',
          content: `Turn completed: ${resultMessage.num_turns} turns, $${resultMessage.total_cost_usd.toFixed(4)} USD, ${(resultMessage.duration_ms / 1000).toFixed(1)}s`,
          timestamp: new Date().toISOString(),
          sessionId: resultMessage.session_id,
          claudeMessage: resultMessage,
          costUsd: resultMessage.total_cost_usd,
          durationMs: resultMessage.duration_ms
        }
        appendMessage(conversationId, resultStoredMessage)
      }

      if (code !== 0 && code !== null) {
        const errorMessage: ConversationMessage = {
          uuid: uuidv4(),
          type: 'error',
          content: `Process exited with code ${code}`,
          timestamp: new Date().toISOString()
        }
        appendMessage(conversationId, errorMessage)
        mainWindow.webContents.send('agent:message', {
          conversationId,
          agentId,
          message: errorMessage
        })
      }

      mainWindow.webContents.send('agent:status', {
        agentId,
        status: 'ready'
      })
    })

    // Handle process errors
    claudeProcess.on('error', (error) => {
      agentProcesses.delete(agentId)
      const errorMessage: ConversationMessage = {
        uuid: uuidv4(),
        type: 'error',
        content: error.message,
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
        error: error.message
      })
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
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
  }
}

/**
 * Stop an agent's current operation
 */
export function stopAgent(agentId: string): void {
  const process = agentProcesses.get(agentId)
  if (process) {
    process.kill('SIGTERM')
    agentProcesses.delete(agentId)
  }
}

/**
 * Get session ID for an agent
 */
export function getSessionId(agentId: string): string | null {
  return agentSessions.get(agentId) || null
}

/**
 * Clear an agent's session (start fresh conversation)
 */
export function clearSession(agentId: string): void {
  agentSessions.delete(agentId)
}
