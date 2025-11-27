# Module 5: Claude Agent SDK Integration

Connecting Chorus to real Claude Code agents via the CLI.

---

## What We Built

- **Agent service** in main process to spawn Claude CLI processes
- **Streaming responses** via JSON stream output
- **Session management** to maintain conversation context
- **Stop/cancel** functionality to abort running agents
- **Real-time status** updates (ready/busy)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERACTION                                 │
│                                                                               │
│  User types message ──► App.tsx ──► window.api.sendToAgent()                 │
│                                            │                                  │
└────────────────────────────────────────────┼──────────────────────────────────┘
                                             │
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                               PRELOAD                                         │
│                                                                               │
│  sendToAgent: (agentId, repoPath, message) =>                                │
│    ipcRenderer.invoke('send-to-agent', agentId, repoPath, message)           │
│                                                                               │
│  onAgentMessage: (callback) => ipcRenderer.on('agent-message', callback)     │
│  onAgentStatus: (callback) => ipcRenderer.on('agent-status', callback)       │
│                                                                               │
└────────────────────────────────────────────┼──────────────────────────────────┘
                                             │
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                            MAIN PROCESS                                       │
│                                                                               │
│  ipcMain.handle('send-to-agent', (_, agentId, repoPath, message) => {        │
│    sendToAgent(agentId, repoPath, message, mainWindow)                       │
│  })                                                                           │
│                                             │                                 │
│                                             ▼                                 │
│                         ┌───────────────────────────────────────┐            │
│                         │      agent-service.ts                  │            │
│                         │                                        │            │
│                         │  spawn('claude', [                     │            │
│                         │    '-p',                               │            │
│                         │    '--output-format', 'stream-json',   │            │
│                         │    message                             │            │
│                         │  ], { cwd: repoPath })                 │            │
│                         │                                        │            │
│                         └────────────────┬──────────────────────┘            │
│                                          │                                    │
│                                          ▼                                    │
│                         ┌───────────────────────────────────────┐            │
│                         │      Claude CLI Process                │            │
│                         │                                        │            │
│                         │  • Runs in repo directory              │            │
│                         │  • Has full Claude Code capabilities   │            │
│                         │  • Streams JSON events to stdout       │            │
│                         │  • Reads CLAUDE.md for context         │            │
│                         └────────────────┬──────────────────────┘            │
│                                          │                                    │
│                    stdout events         │                                    │
│                    (JSON stream)         │                                    │
│                                          ▼                                    │
│                         ┌───────────────────────────────────────┐            │
│                         │      Parse & Forward                   │            │
│                         │                                        │            │
│                         │  mainWindow.webContents.send(          │            │
│                         │    'agent-message',                    │            │
│                         │    { agentId, type, content }          │            │
│                         │  )                                     │            │
│                         └───────────────────────────────────────┘            │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Service Implementation

```typescript
// src/main/agent-service.ts

import { spawn, ChildProcess } from 'child_process'
import { BrowserWindow } from 'electron'

// Store active processes per agent
const agentProcesses: Map<string, ChildProcess> = new Map()

// Store session IDs for conversation continuity
const agentSessions: Map<string, string> = new Map()

export async function sendToAgent(
  agentId: string,
  repoPath: string,
  message: string,
  mainWindow: BrowserWindow
): Promise<void> {
  // Kill any existing process
  stopAgent(agentId)

  // Notify busy status
  mainWindow.webContents.send('agent-status', { agentId, status: 'busy' })

  // Build args
  const args = ['-p', '--output-format', 'stream-json']

  // Resume session if available
  const sessionId = agentSessions.get(agentId)
  if (sessionId) {
    args.push('--resume', sessionId)
  }

  args.push(message)

  // Spawn Claude CLI
  const claudeProcess = spawn('claude', args, {
    cwd: repoPath,
    shell: true
  })

  agentProcesses.set(agentId, claudeProcess)

  // Parse streaming JSON output
  claudeProcess.stdout?.on('data', (data) => {
    // Parse JSON lines and forward to renderer
    // ...
  })

  claudeProcess.on('close', () => {
    mainWindow.webContents.send('agent-status', { agentId, status: 'ready' })
  })
}
```

---

## IPC Handlers

```typescript
// src/main/index.ts

// Send message to agent
ipcMain.handle('send-to-agent', async (_event, agentId, repoPath, message) => {
  if (mainWindow) {
    await sendToAgent(agentId, repoPath, message, mainWindow)
    return { success: true }
  }
  return { success: false, error: 'No window available' }
})

// Stop agent
ipcMain.handle('stop-agent', async (_event, agentId) => {
  stopAgent(agentId)
  return { success: true }
})

// Clear session (fresh conversation)
ipcMain.handle('clear-agent-session', async (_event, agentId) => {
  clearAgentSession(agentId)
  return { success: true }
})
```

---

## Preload API

```typescript
// src/preload/index.ts

const api = {
  // ... existing APIs

  // Agent operations
  sendToAgent: (agentId, repoPath, message) =>
    ipcRenderer.invoke('send-to-agent', agentId, repoPath, message),
  stopAgent: (agentId) => ipcRenderer.invoke('stop-agent', agentId),
  clearAgentSession: (agentId) => ipcRenderer.invoke('clear-agent-session', agentId),

  // Event listeners for streaming
  onAgentMessage: (callback) => {
    ipcRenderer.on('agent-message', (_, msg) => callback(msg))
    return () => ipcRenderer.removeListener('agent-message', callback)
  },
  onAgentStatus: (callback) => {
    ipcRenderer.on('agent-status', (_, status) => callback(status))
    return () => ipcRenderer.removeListener('agent-status', callback)
  }
}
```

---

## Renderer Integration

```tsx
// src/renderer/src/App.tsx

function App() {
  // Set up listeners for agent events
  useEffect(() => {
    const cleanupMessage = window.api.onAgentMessage((message) => {
      const { agentId, type, content } = message

      if (type === 'text') {
        // Accumulate streaming text into conversation
      } else if (type === 'tool_use') {
        // Show tool usage
      } else if (type === 'done') {
        // Response complete
      } else if (type === 'error') {
        // Show error
      }
    })

    const cleanupStatus = window.api.onAgentStatus((status) => {
      // Update agent status in UI
    })

    return () => {
      cleanupMessage()
      cleanupStatus()
    }
  }, [])

  const handleSendMessage = async (content) => {
    // Add user message to UI
    // Send to agent via IPC
    await window.api.sendToAgent(agentId, repoPath, content)
  }
}
```

---

## Claude CLI Flags

| Flag | Description |
|------|-------------|
| `-p` | Print mode (non-interactive) |
| `--output-format stream-json` | Stream JSON events |
| `--resume <session-id>` | Continue previous conversation |
| `--max-turns <n>` | Limit agentic loops |

---

## Message Types

| Type | Description |
|------|-------------|
| `text` | Text content from Claude |
| `tool_use` | Claude is using a tool |
| `tool_result` | Result of tool execution |
| `done` | Response complete |
| `error` | Error occurred |
| `status` | Status change (busy/ready) |

---

## Key Concepts

### Session Management
- Each agent has a unique session ID
- Sessions allow conversation continuity
- Clear session to start fresh

### Process Management
- One Claude CLI process per active agent
- Processes can be killed (stop button)
- Status tracked: ready/busy

### Streaming
- JSON events streamed line-by-line
- Text accumulated into messages
- Tool usage displayed inline

---

## Files Modified

| File | Changes |
|------|---------|
| `src/main/agent-service.ts` | New - Agent spawning and management |
| `src/main/index.ts` | Added agent IPC handlers |
| `src/preload/index.ts` | Exposed agent APIs and listeners |
| `src/preload/index.d.ts` | Added agent types |
| `src/renderer/src/App.tsx` | Real agent integration |
| `src/renderer/src/components/ChatPanel.tsx` | Added stop button |

---

## Testing

1. Run `bun run dev`
2. Click "+ Add Agent" in sidebar
3. Select a directory (ideally with a CLAUDE.md)
4. Type a message and press Enter
5. Watch Claude respond in real-time
6. Click "Stop" to abort if needed

---

## Requirements

- Claude CLI installed globally (`claude` in PATH)
- Authenticated with Anthropic API
- Node.js 18+

---

## For Chorus

This enables:
- Real Claude Code agents in each panel
- Full agentic capabilities (file edit, terminal, etc.)
- Conversation history per agent
- Cancel running operations
- Multiple concurrent agents
