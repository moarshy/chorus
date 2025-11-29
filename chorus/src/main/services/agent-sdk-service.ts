import { query, type Query } from '@anthropic-ai/claude-agent-sdk'
import { BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { existsSync, readFileSync } from 'fs'
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
  settings?: ConversationSettings
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
    // Build SDK options
    const abortController = new AbortController()
    const options: Parameters<typeof query>[0]['options'] = {
      cwd: repoPath,
      abortController
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
    if (systemPromptContent && !effectiveSessionId) {
      options.systemPrompt = systemPromptContent
    }

    // Add canUseTool callback for permission handling
    options.canUseTool = async (
      toolName: string,
      toolInput: Record<string, unknown>
    ) => {
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

    // Add hooks for file change notifications
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
                if (filePath && (toolName === 'Write' || toolName === 'Edit')) {
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
      }

      // Handle assistant messages
      if (msg.type === 'assistant' && 'message' in msg) {
        const assistantMsg = msg as unknown as ClaudeAssistantMessage
        currentAssistantMessage = assistantMsg

        if (assistantMsg.message?.content) {
          for (const block of assistantMsg.message.content) {
            if (block.type === 'text') {
              // Send stream delta for real-time display
              mainWindow.webContents.send('agent:stream-delta', {
                conversationId,
                delta: block.text
              })
              streamingContent += block.text
            } else if (block.type === 'tool_use') {
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
            } else if (block.type === 'thinking' && 'thinking' in block) {
              // Handle thinking blocks
              mainWindow.webContents.send('agent:stream-delta', {
                conversationId,
                delta: `\n<thinking>${block.thinking}</thinking>\n`
              })
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
      }
    }

    // Save the complete assistant message if we have content
    if (streamingContent.trim()) {
      const assistantMessage: ConversationMessage = {
        uuid: uuidv4(),
        type: 'assistant',
        content: streamingContent,
        timestamp: new Date().toISOString(),
        sessionId: capturedSessionId || undefined,
        claudeMessage: currentAssistantMessage || undefined,
        inputTokens: currentAssistantMessage?.message?.usage?.input_tokens,
        outputTokens: currentAssistantMessage?.message?.usage?.output_tokens,
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
