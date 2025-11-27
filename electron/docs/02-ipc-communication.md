# Module 2: IPC Communication

IPC (Inter-Process Communication) is how the **renderer** (React UI) talks to the **main process** (Node.js).

---

## Why IPC?

```
┌─────────────────────────────────────────────────────────────┐
│  Renderer Process (Chromium)                                │
│                                                             │
│  - Can render UI (React)                                    │
│  - Can NOT access file system                               │
│  - Can NOT spawn processes                                  │
│  - Can NOT run Claude Agent SDK                             │
│                                                             │
│  Question: How do I read a file?                            │
│  Answer: Ask the main process via IPC!                      │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ IPC Message: "read-file /path/to/file"
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Main Process (Node.js)                                     │
│                                                             │
│  - Can access file system (fs)                              │
│  - Can spawn processes (child_process)                      │
│  - Can run Claude Agent SDK                                 │
│  - Can NOT render UI                                        │
│                                                             │
│  Action: fs.readFileSync('/path/to/file')                   │
│  Response: Send file contents back via IPC                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Two IPC Patterns

### Pattern 1: Request/Response (invoke/handle)

Like HTTP: send request, wait for response.

```typescript
// RENDERER (React) - sends request
const content = await window.electron.ipcRenderer.invoke('read-file', '/path')
//                                                 ↑ channel    ↑ args

// MAIN PROCESS - handles request
ipcMain.handle('read-file', async (event, path) => {
  return fs.readFileSync(path, 'utf-8')  // Return value goes back to renderer
})
```

**Use for:** Getting data, async operations, anything that returns a value.

### Pattern 2: One-Way Events (send/on)

Like fire-and-forget. No response expected.

```typescript
// RENDERER (React) - sends event
window.electron.ipcRenderer.send('log-message', 'User clicked button')
//                          ↑ no await, no response

// MAIN PROCESS - listens for event
ipcMain.on('log-message', (event, message) => {
  console.log(message)  // No return value
})
```

**Use for:** Notifications, logging, triggering side effects.

### Pattern 3: Main → Renderer (webContents.send)

Main process pushing updates to renderer.

```typescript
// MAIN PROCESS - sends to renderer
mainWindow.webContents.send('agent-message', { text: 'Hello from agent' })

// RENDERER (React) - listens
window.electron.ipcRenderer.on('agent-message', (event, data) => {
  setMessages(prev => [...prev, data])
})
```

**Use for:** Streaming agent responses, status updates, notifications.

---

## The Security Layer: Preload + contextBridge

Direct `ipcRenderer` access in renderer is dangerous. We use `contextBridge` to expose only specific, safe APIs.

### BAD (Insecure)

```typescript
// preload.ts - DON'T DO THIS
contextBridge.exposeInMainWorld('ipcRenderer', ipcRenderer)

// Now malicious code in renderer can do ANYTHING
```

### GOOD (Secure)

```typescript
// preload.ts - Expose specific channels only
contextBridge.exposeInMainWorld('electron', {
  readFile: (path: string) => ipcRenderer.invoke('read-file', path),
  sendMessage: (msg: string) => ipcRenderer.invoke('send-to-agent', msg),
  onAgentResponse: (callback) => ipcRenderer.on('agent-response', callback)
})

// Renderer can only use these specific APIs
// Can't access arbitrary IPC channels
```

---

## Data Flow: Complete Example

User sends message to Claude agent:

```
┌─────────────────────────────────────────────────────────────┐
│  1. RENDERER (React Component)                              │
│                                                             │
│  const sendMessage = async (msg) => {                       │
│    await window.electron.sendToAgent(msg)                   │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ invoke('send-to-agent', msg)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  2. PRELOAD (contextBridge)                                 │
│                                                             │
│  contextBridge.exposeInMainWorld('electron', {              │
│    sendToAgent: (msg) => ipcRenderer.invoke('send-to-agent')│
│  })                                                         │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ forwards to main
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  3. MAIN PROCESS                                            │
│                                                             │
│  ipcMain.handle('send-to-agent', async (event, msg) => {    │
│    const response = await agentClient.sendMessage(msg)      │
│    return response                                          │
│  })                                                         │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ response travels back
                           ▼
                      Renderer receives
```

---

## Streaming Pattern (For Claude Agent)

Claude responses stream token by token. We need main → renderer streaming:

```typescript
// MAIN PROCESS
ipcMain.handle('send-to-agent', async (event, message) => {
  const stream = await agentClient.sendMessage(message)

  for await (const chunk of stream) {
    // Send each chunk to renderer as it arrives
    mainWindow.webContents.send('agent-chunk', chunk)
  }

  // Signal completion
  mainWindow.webContents.send('agent-done')
})

// RENDERER
useEffect(() => {
  window.electron.ipcRenderer.on('agent-chunk', (chunk) => {
    setResponse(prev => prev + chunk)
  })

  window.electron.ipcRenderer.on('agent-done', () => {
    setIsStreaming(false)
  })
}, [])
```

---

## Summary Table

| Pattern | Direction | Method | Use Case |
|---------|-----------|--------|----------|
| invoke/handle | Renderer → Main → Renderer | `ipcRenderer.invoke()` | Get data, async ops |
| send/on | Renderer → Main | `ipcRenderer.send()` | Fire-and-forget |
| webContents.send | Main → Renderer | `win.webContents.send()` | Streaming, push updates |

---

## For Chorus

| Feature | IPC Pattern | Channel |
|---------|-------------|---------|
| Send message to agent | invoke/handle | `send-to-agent` |
| Stream agent response | webContents.send | `agent-chunk` |
| Read file from repo | invoke/handle | `read-file` |
| List repo files | invoke/handle | `list-files` |
| Git commit | invoke/handle | `git-commit` |
| Agent status change | webContents.send | `agent-status` |

---

## Exercise: Build a File Reader

We'll add a button that reads a file from disk and displays it in the UI.

See the code changes in the following commits.
