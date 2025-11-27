# Module 1: What is Electron?

## What We Did

1. **Scaffolded a project** using `electron-vite` with React + TypeScript template
2. **Installed dependencies** (~658 packages including Electron binary)
3. **Explored the project structure** - understood main, preload, and renderer
4. **Ran dev mode** - saw hot reload working

---

## What is Electron?

Electron is a framework for building **cross-platform desktop apps** using web technologies (HTML, CSS, JavaScript/TypeScript).

### Apps Built with Electron

- VS Code
- Slack
- Discord
- Notion
- Figma (desktop)
- Obsidian
- Cursor

---

## Why Chromium + Node.js?

Electron bundles **two runtimes** together:

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron App                            │
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │      Chromium       │    │         Node.js             │ │
│  │   (Browser Engine)  │    │    (Server Runtime)         │ │
│  │                     │    │                             │ │
│  │  - Renders HTML/CSS │    │  - File system access       │ │
│  │  - Runs JavaScript  │    │  - Spawn processes          │ │
│  │  - React lives here │    │  - Network sockets          │ │
│  │  - DOM manipulation │    │  - Native modules           │ │
│  │  - DevTools (F12)   │    │  - Claude Agent SDK         │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
│           ▲                            ▲                    │
│           │         IPC                │                    │
│           └────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

### Chromium (Renderer Process)

**What:** The browser engine that powers Chrome.

**Why needed:**
- Renders the UI (HTML, CSS)
- Runs React/Vue/Angular
- Provides consistent cross-platform rendering
- Gives you DevTools for debugging

**Limitations:**
- No file system access (security sandbox)
- No native OS APIs
- Can't spawn processes

### Node.js (Main Process)

**What:** JavaScript runtime for servers/backends.

**Why needed:**
- Full file system access (`fs.readFile`, `fs.writeFile`)
- Spawn child processes (`child_process.spawn`)
- Access native OS features (notifications, tray, menus)
- Run Claude Agent SDK (requires Node.js)
- Execute git commands

**Limitations:**
- No DOM (can't render UI)
- No browser APIs

### Why Both?

| Capability | Browser Only | Node.js Only | Electron (Both) |
|------------|--------------|--------------|-----------------|
| Render UI | Yes | No | Yes |
| File System | No | Yes | Yes |
| Spawn Processes | No | Yes | Yes |
| Cross-platform | Yes | Yes | Yes |
| DevTools | Yes | No | Yes |
| Native Modules | No | Yes | Yes |

**Electron = Best of both worlds**

---

## The Two-Process Architecture

### Main Process (Node.js)

```typescript
// src/main/index.ts
import { app, BrowserWindow, ipcMain } from 'electron'
import { spawn } from 'child_process'  // Node.js!
import fs from 'fs'                     // Node.js!

// Create windows
const mainWindow = new BrowserWindow({...})

// Handle IPC from renderer
ipcMain.handle('read-file', async (event, path) => {
  return fs.readFileSync(path, 'utf-8')  // Node.js file access
})

// Spawn Claude Agent SDK
ipcMain.handle('send-to-agent', async (event, message) => {
  // This is where we'll spawn Claude Code
})
```

**Runs:** Once per app
**Has access to:** Node.js APIs, OS features, file system, processes

### Renderer Process (Chromium)

```typescript
// src/renderer/src/App.tsx
function App() {
  const readFile = async () => {
    // Can't do: fs.readFileSync() - no Node.js here!
    // Must ask main process via IPC:
    const content = await window.electron.ipcRenderer.invoke('read-file', '/path/to/file')
  }

  return <div>React UI here</div>
}
```

**Runs:** One per window (can have multiple)
**Has access to:** DOM, React, browser APIs, CSS

### Preload Script (The Bridge)

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

// Safely expose specific APIs to renderer
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args))
  }
})
```

**Why needed:** Security. Renderer shouldn't have direct Node.js access (prevents XSS attacks from accessing file system).

---

## Data Flow Example: Reading a File

```
User clicks "Open File" button
         │
         ▼
┌─────────────────────────────────────┐
│  Renderer (React)                   │
│  window.electron.ipcRenderer.invoke │
│  ('read-file', '/path/to/file')     │
└─────────────────┬───────────────────┘
                  │ IPC message
                  ▼
┌─────────────────────────────────────┐
│  Preload (Bridge)                   │
│  Forwards via contextBridge         │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  Main Process (Node.js)             │
│  ipcMain.handle('read-file', ...)   │
│  fs.readFileSync(path)              │
└─────────────────┬───────────────────┘
                  │ File contents
                  ▼
         Back to Renderer
         Display in UI
```

---

## Why This Matters for Chorus

For Chorus, we need:

| Feature | Where it runs | Why |
|---------|---------------|-----|
| Slack-like UI | Renderer (React) | DOM rendering |
| Claude Agent SDK | Main Process | Requires Node.js, spawns processes |
| Git operations | Main Process | Requires `child_process` |
| File browsing | Main Process | Requires `fs` module |
| Real-time streaming | Both | Main receives, renderer displays |

```
┌─────────────────────────────────────────────────────────────┐
│                      Chorus Architecture                     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Renderer (React + Tailwind)               │ │
│  │                                                         │ │
│  │  ┌─────────┐  ┌──────────────────────────────────────┐ │ │
│  │  │ Sidebar │  │           Chat Panel                 │ │ │
│  │  │         │  │                                      │ │ │
│  │  │ Agent 1 │  │  Messages streaming from agent...    │ │ │
│  │  │ Agent 2 │  │                                      │ │ │
│  │  │ Agent 3 │  │  ┌────────────────────────────────┐  │ │ │
│  │  │         │  │  │ Type message...                │  │ │ │
│  │  └─────────┘  └──┴────────────────────────────────┴──┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │ IPC                            │
│  ┌────────────────────────▼───────────────────────────────┐ │
│  │              Main Process (Node.js)                     │ │
│  │                                                         │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │ │
│  │  │ Agent SDK   │  │ Git Ops     │  │ File System     │ │ │
│  │  │ Client 1    │  │ commit()    │  │ readDir()       │ │ │
│  │  │ Client 2    │  │ push()      │  │ readFile()      │ │ │
│  │  │ Client 3    │  │ status()    │  │ watch()         │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Electron = Chromium + Node.js** bundled together
2. **Main process** = Node.js (file system, processes, Claude SDK)
3. **Renderer process** = Browser (React UI)
4. **Preload script** = Secure bridge between them
5. **IPC** = How they communicate
6. **This architecture** is why we can build a desktop app with React that also runs Claude Code

---

## Next: Module 2

We'll dive deeper into IPC communication - how to send messages between React and the main process, which is essential for:
- Sending user messages to Claude agents
- Streaming agent responses back to UI
- Reading repo files to display in the Files tab
