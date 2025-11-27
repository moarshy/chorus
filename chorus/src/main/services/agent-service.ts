import { spawn, ChildProcess, execSync } from 'child_process'
import { BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import {
  appendMessage,
  updateConversation,
  generateTitleFromMessage,
  ConversationMessage
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
          const event = JSON.parse(line)

          // Handle system init - capture session ID
          if (event.type === 'system' && event.subtype === 'init') {
            if (event.session_id) {
              capturedSessionId = event.session_id
              agentSessions.set(agentId, event.session_id)
              // Update conversation with session ID
              updateConversation(conversationId, { sessionId: event.session_id })
            }
          }

          // Handle assistant messages
          if (event.type === 'assistant' && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === 'text') {
                // Send stream delta for real-time display
                mainWindow.webContents.send('agent:stream-delta', {
                  conversationId,
                  delta: block.text
                })
                streamingContent += block.text
              } else if (block.type === 'tool_use') {
                // Create tool use message
                const toolMessage: ConversationMessage = {
                  uuid: uuidv4(),
                  type: 'tool_use',
                  content: `Using tool: ${block.name}`,
                  timestamp: new Date().toISOString(),
                  toolName: block.name,
                  toolInput: block.input
                }
                appendMessage(conversationId, toolMessage)
                mainWindow.webContents.send('agent:message', {
                  conversationId,
                  message: toolMessage
                })
              }
            }
          }

          // Handle content block deltas (streaming text)
          if (event.type === 'content_block_delta' && event.delta?.text) {
            mainWindow.webContents.send('agent:stream-delta', {
              conversationId,
              delta: event.delta.text
            })
            streamingContent += event.delta.text
          }

          // Handle result event
          if (event.type === 'result') {
            if (event.session_id && !capturedSessionId) {
              capturedSessionId = event.session_id
              agentSessions.set(agentId, event.session_id)
              updateConversation(conversationId, { sessionId: event.session_id })
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
          sessionId: capturedSessionId || undefined
        }
        appendMessage(conversationId, assistantMessage)
        mainWindow.webContents.send('agent:message', {
          conversationId,
          message: assistantMessage
        })

        // Generate title from first user message if this was the first message
        if (isFirstMessage && !hasSetTitle) {
          const title = generateTitleFromMessage(message)
          updateConversation(conversationId, { title })
          hasSetTitle = true
        }
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
