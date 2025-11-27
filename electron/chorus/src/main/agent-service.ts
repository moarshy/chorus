import { spawn, ChildProcess } from 'child_process'
import { BrowserWindow } from 'electron'

// Store active processes per agent
const agentProcesses: Map<string, ChildProcess> = new Map()

// Store session IDs for conversation continuity
const agentSessions: Map<string, string> = new Map()

export interface AgentMessage {
  agentId: string
  type: 'text' | 'tool_use' | 'tool_result' | 'done' | 'error' | 'status'
  content: string
  timestamp: Date
}

/**
 * Send a message to a Claude agent using the Claude CLI
 * The CLI is invoked in print mode (-p) for non-interactive use
 */
export async function sendToAgent(
  agentId: string,
  repoPath: string,
  message: string,
  mainWindow: BrowserWindow
): Promise<void> {
  console.log('[Agent] sendToAgent called:', { agentId, repoPath, message: message.substring(0, 50) })

  // Kill any existing process for this agent
  stopAgent(agentId)

  // Notify renderer that agent is busy
  mainWindow.webContents.send('agent-status', { agentId, status: 'busy' })

  // Get session ID if we have one
  const sessionId = agentSessions.get(agentId)

  // Build claude command args
  // -p: print mode (non-interactive)
  // --verbose: required for stream-json output
  // --output-format: stream-json for structured streaming output
  const args = ['-p', '--verbose', '--output-format', 'stream-json']

  // Add session resume if we have one
  if (sessionId) {
    args.push('--resume', sessionId)
  }

  // Add the prompt
  args.push(message)

  try {
    console.log('[Agent] Spawning claude with args:', args)

    // Spawn claude CLI process
    // Use full path and inherit PATH for proper execution
    const claudePath = process.env.PATH?.includes('nvm')
      ? '/Users/arshath/.nvm/versions/node/v20.19.5/bin/claude'
      : 'claude'

    const claudeProcess = spawn(claudePath, args, {
      cwd: repoPath,
      env: {
        ...process.env,
        // Ensure proper terminal handling
        TERM: 'xterm-256color'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    console.log('[Agent] Process spawned, PID:', claudeProcess.pid)
    agentProcesses.set(agentId, claudeProcess)

    // Close stdin to signal no more input
    claudeProcess.stdin?.end()

    let fullResponse = ''
    let buffer = ''

    // Handle stdout - parse streaming JSON
    claudeProcess.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString()
      console.log('[Agent] stdout chunk received, length:', chunk.length)
      console.log('[Agent] stdout preview:', chunk.substring(0, 200))
      buffer += chunk

      // Process complete JSON lines
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue

        try {
          const event = JSON.parse(line)

          // Handle different event types from stream-json format
          if (event.type === 'assistant' && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === 'text') {
                fullResponse += block.text
                mainWindow.webContents.send('agent-message', {
                  agentId,
                  type: 'text',
                  content: block.text,
                  timestamp: new Date()
                } as AgentMessage)
              } else if (block.type === 'tool_use') {
                mainWindow.webContents.send('agent-message', {
                  agentId,
                  type: 'tool_use',
                  content: `Using tool: ${block.name}`,
                  timestamp: new Date()
                } as AgentMessage)
              }
            }
          } else if (event.type === 'system' && event.subtype === 'init') {
            // Save session ID from init event
            if (event.session_id) {
              agentSessions.set(agentId, event.session_id)
            }
          } else if (event.type === 'result') {
            // Final result - can also get session_id here
            if (event.session_id) {
              agentSessions.set(agentId, event.session_id)
            }
            // Send the final result text if available
            if (event.result) {
              mainWindow.webContents.send('agent-message', {
                agentId,
                type: 'done',
                content: event.result,
                timestamp: new Date()
              } as AgentMessage)
            }
          } else if (event.type === 'content_block_delta') {
            // Handle streaming text deltas
            if (event.delta?.text) {
              fullResponse += event.delta.text
              mainWindow.webContents.send('agent-message', {
                agentId,
                type: 'text',
                content: event.delta.text,
                timestamp: new Date()
              } as AgentMessage)
            }
          }
        } catch {
          // Not valid JSON, might be plain text output
          if (line.trim()) {
            fullResponse += line + '\n'
            mainWindow.webContents.send('agent-message', {
              agentId,
              type: 'text',
              content: line + '\n',
              timestamp: new Date()
            } as AgentMessage)
          }
        }
      }
    })

    // Handle stderr
    claudeProcess.stderr?.on('data', (data: Buffer) => {
      const errorText = data.toString()
      console.error('Claude stderr:', errorText)
    })

    // Handle process completion
    claudeProcess.on('close', (code) => {
      agentProcesses.delete(agentId)

      // Only send error if process failed - 'done' is sent from result event
      if (code !== 0) {
        mainWindow.webContents.send('agent-message', {
          agentId,
          type: 'error',
          content: `Process exited with code ${code}`,
          timestamp: new Date()
        } as AgentMessage)
      }

      mainWindow.webContents.send('agent-status', { agentId, status: 'ready' })
    })

    // Handle process errors
    claudeProcess.on('error', (error) => {
      agentProcesses.delete(agentId)
      mainWindow.webContents.send('agent-message', {
        agentId,
        type: 'error',
        content: error.message,
        timestamp: new Date()
      } as AgentMessage)
      mainWindow.webContents.send('agent-status', { agentId, status: 'ready' })
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    mainWindow.webContents.send('agent-message', {
      agentId,
      type: 'error',
      content: errorMessage,
      timestamp: new Date()
    } as AgentMessage)
    mainWindow.webContents.send('agent-status', { agentId, status: 'ready' })
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
 * Clear an agent's session (start fresh conversation)
 */
export function clearAgentSession(agentId: string): void {
  agentSessions.delete(agentId)
}

/**
 * Get session ID for an agent
 */
export function getAgentSession(agentId: string): string | undefined {
  return agentSessions.get(agentId)
}
