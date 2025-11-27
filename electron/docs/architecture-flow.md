# Chorus Architecture Flow

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ELECTRON APP                                    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        RENDERER PROCESS                                 │ │
│  │                        (Chromium/Browser)                               │ │
│  │                                                                         │ │
│  │  src/renderer/src/                                                      │ │
│  │  ├── App.tsx              ← Main React component, state management      │ │
│  │  ├── components/                                                        │ │
│  │  │   ├── Sidebar.tsx      ← Agent list, status indicators              │ │
│  │  │   ├── ChatPanel.tsx    ← Messages + Files tabs                      │ │
│  │  │   ├── MessageInput.tsx ← Text input                                 │ │
│  │  │   └── FilesPanel.tsx   ← File tree, git info                        │ │
│  │  └── types.ts             ← Agent, Message types                       │ │
│  │                                                                         │ │
│  │  Communicates via: window.api.* and window.electron.*                   │ │
│  └─────────────────────────────────┬───────────────────────────────────────┘ │
│                                    │                                         │
│                                    │ IPC (Inter-Process Communication)       │
│                                    │                                         │
│  ┌─────────────────────────────────▼───────────────────────────────────────┐ │
│  │                         PRELOAD SCRIPT                                   │ │
│  │                         (Bridge Layer)                                   │ │
│  │                                                                          │ │
│  │  src/preload/index.ts                                                    │ │
│  │  └── contextBridge.exposeInMainWorld('api', { ... })                     │ │
│  │                                                                          │ │
│  │  Exposes safe APIs:                                                      │ │
│  │  • readFile, listDirectory, selectFile, selectDirectory                  │ │
│  │  • gitIsRepo, gitStatus, gitLog, gitBranch, checkClaudeConfig            │ │
│  └─────────────────────────────────┬───────────────────────────────────────┘ │
│                                    │                                         │
│                                    │ ipcRenderer.invoke() / ipcMain.handle() │
│                                    │                                         │
│  ┌─────────────────────────────────▼───────────────────────────────────────┐ │
│  │                          MAIN PROCESS                                    │ │
│  │                          (Node.js)                                       │ │
│  │                                                                          │ │
│  │  src/main/index.ts                                                       │ │
│  │  ├── createWindow()         ← Creates BrowserWindow                      │ │
│  │  ├── ipcMain.handle(...)    ← IPC handlers                               │ │
│  │  └── runGit()               ← Helper for git commands                    │ │
│  │                                                                          │ │
│  │  Has access to:                                                          │ │
│  │  • fs (readFileSync, readdirSync, existsSync)                            │ │
│  │  • child_process (execSync for git)                                      │ │
│  │  • dialog (native file/folder pickers)                                   │ │
│  │  • Future: Claude Agent SDK                                              │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Flow: Adding an Agent

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│     RENDERER     │     │     PRELOAD      │     │   MAIN PROCESS   │
│                  │     │                  │     │                  │
│  Sidebar.tsx     │     │  index.ts        │     │  index.ts        │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         │  User clicks           │                        │
         │  "+ Add Agent"         │                        │
         │                        │                        │
         ▼                        │                        │
┌─────────────────────────┐       │                        │
│ onAddAgent() called     │       │                        │
│ in App.tsx              │       │                        │
└────────┬────────────────┘       │                        │
         │                        │                        │
         │ window.api.            │                        │
         │ selectDirectory()      │                        │
         │ ───────────────────────►                        │
         │                        │                        │
         │                        │ ipcRenderer.invoke     │
         │                        │ ('select-directory')   │
         │                        │ ───────────────────────►
         │                        │                        │
         │                        │                        ▼
         │                        │              ┌─────────────────────┐
         │                        │              │ ipcMain.handle(     │
         │                        │              │  'select-directory',│
         │                        │              │   async () => {     │
         │                        │              │     dialog.show     │
         │                        │              │     OpenDialog()    │
         │                        │              │   }                 │
         │                        │              │ )                   │
         │                        │              └─────────┬───────────┘
         │                        │                        │
         │                        │                        │ Native folder
         │                        │                        │ picker opens
         │                        │                        │
         │                        │                        ▼
         │                        │              ┌─────────────────────┐
         │                        │              │ User selects folder │
         │                        │              │ Returns:            │
         │                        │              │ { dirPath: '...' }  │
         │                        │              └─────────┬───────────┘
         │                        │                        │
         │                        │ ◄──────────────────────┤
         │                        │   Promise resolves     │
         │ ◄──────────────────────┤                        │
         │   { success: true,     │                        │
         │     dirPath: '/...' }  │                        │
         │                        │                        │
         ▼                        │                        │
┌─────────────────────────┐       │                        │
│ App.tsx creates new     │       │                        │
│ agent in state:         │       │                        │
│ setAgents([...agents,   │       │                        │
│   newAgent])            │       │                        │
└─────────────────────────┘       │                        │
```

---

## Flow: Viewing Files

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│     RENDERER     │     │     PRELOAD      │     │   MAIN PROCESS   │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         │  User clicks           │                        │
         │  "Files" tab           │                        │
         │                        │                        │
         ▼                        │                        │
┌─────────────────────────┐       │                        │
│ FilesPanel mounts       │       │                        │
│ useEffect triggers      │       │                        │
│ loadRepoInfo()          │       │                        │
└────────┬────────────────┘       │                        │
         │                        │                        │
         │ ═══════════════════════════════════════════════ │
         │   PARALLEL REQUESTS                             │
         │ ═══════════════════════════════════════════════ │
         │                        │                        │
         ├─► listDirectory() ─────►──────────────────────────►┐
         │                        │                        │  │
         ├─► gitBranch() ─────────►──────────────────────────►│
         │                        │                        │  │
         ├─► gitLog() ────────────►──────────────────────────►│
         │                        │                        │  │
         └─► checkClaudeConfig() ─►──────────────────────────►│
                                  │                        │  │
                                  │                        │  ▼
                                  │              ┌─────────────────────┐
                                  │              │ MAIN PROCESS        │
                                  │              │                     │
                                  │              │ • readdirSync()     │
                                  │              │ • git branch        │
                                  │              │ • git log           │
                                  │              │ • existsSync()      │
                                  │              └─────────┬───────────┘
                                  │                        │
         ◄════════════════════════════════════════════════◄┘
         │  All promises resolve  │                        │
         │                        │                        │
         ▼                        │                        │
┌─────────────────────────┐       │                        │
│ FilesPanel updates      │       │                        │
│ state:                  │       │                        │
│ • setEntries([...])     │       │                        │
│ • setBranch('main')     │       │                        │
│ • setCommits([...])     │       │                        │
│ • setHasClaudeMd(true)  │       │                        │
│                         │       │                        │
│ React re-renders UI     │       │                        │
└─────────────────────────┘       │                        │
```

---

## Flow: Reading a File

```
User clicks file in FilesPanel
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ RENDERER: FilesPanel.tsx                                                │
│                                                                         │
│ handleEntryClick(entry) {                                               │
│   if (entry.isDirectory) {                                              │
│     // Navigate into folder                                             │
│   } else {                                                              │
│     const result = await window.api.readFile(entry.path)  ──────────┐   │
│     setFileContent(result.content)                                  │   │
│   }                                                                 │   │
│ }                                                                   │   │
└─────────────────────────────────────────────────────────────────────│───┘
                                                                      │
         ┌────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ PRELOAD: index.ts                                                       │
│                                                                         │
│ const api = {                                                           │
│   readFile: (filePath) => ipcRenderer.invoke('read-file', filePath) ────┐
│ }                                                                       │
└─────────────────────────────────────────────────────────────────────────│
                                                                          │
         ┌────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ MAIN: index.ts                                                          │
│                                                                         │
│ ipcMain.handle('read-file', async (_event, filePath) => {               │
│   try {                                                                 │
│     const content = readFileSync(filePath, 'utf-8')  ← Node.js fs       │
│     return { success: true, content }                                   │
│   } catch (error) {                                                     │
│     return { success: false, error: String(error) }                     │
│   }                                                                     │
│ })                                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## File Responsibilities

### Main Process (`src/main/index.ts`)

| Function | Purpose |
|----------|---------|
| `createWindow()` | Creates the Electron BrowserWindow |
| `runGit(cwd, args)` | Helper to execute git commands |
| `ipcMain.handle('read-file')` | Read file contents |
| `ipcMain.handle('list-directory')` | List directory entries |
| `ipcMain.handle('select-file')` | Open file picker dialog |
| `ipcMain.handle('select-directory')` | Open folder picker dialog |
| `ipcMain.handle('git-is-repo')` | Check if .git exists |
| `ipcMain.handle('git-status')` | Get changed files |
| `ipcMain.handle('git-log')` | Get recent commits |
| `ipcMain.handle('git-branch')` | Get current branch |
| `ipcMain.handle('check-claude-config')` | Check for CLAUDE.md |

### Preload (`src/preload/index.ts`)

| Export | Maps To |
|--------|---------|
| `api.readFile()` | `ipcRenderer.invoke('read-file')` |
| `api.listDirectory()` | `ipcRenderer.invoke('list-directory')` |
| `api.selectFile()` | `ipcRenderer.invoke('select-file')` |
| `api.selectDirectory()` | `ipcRenderer.invoke('select-directory')` |
| `api.gitIsRepo()` | `ipcRenderer.invoke('git-is-repo')` |
| `api.gitStatus()` | `ipcRenderer.invoke('git-status')` |
| `api.gitLog()` | `ipcRenderer.invoke('git-log')` |
| `api.gitBranch()` | `ipcRenderer.invoke('git-branch')` |
| `api.checkClaudeConfig()` | `ipcRenderer.invoke('check-claude-config')` |

### Renderer Components

| Component | Purpose | Uses APIs |
|-----------|---------|-----------|
| `App.tsx` | State management, orchestration | `selectDirectory` |
| `Sidebar.tsx` | Agent list, add button | - |
| `ChatPanel.tsx` | Tabs, messages display | - |
| `MessageInput.tsx` | Text input, send button | - |
| `FilesPanel.tsx` | File browser, git info | `listDirectory`, `readFile`, `gitBranch`, `gitLog`, `checkClaudeConfig` |

---

## Security Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           SECURITY BOUNDARY                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  RENDERER (Untrusted)           PRELOAD (Trusted)      MAIN (Trusted)   │
│  ═══════════════════           ════════════════       ═══════════════   │
│                                                                         │
│  • Can only access              • Runs in isolated     • Full Node.js   │
│    window.api.*                   context                access         │
│                                                                         │
│  • Cannot directly              • Exposes ONLY         • Can read/write │
│    access Node.js                 specific APIs          any file       │
│                                                                         │
│  • Cannot access                • Validates/sanitizes  • Can execute    │
│    file system                    data                   commands       │
│                                                                         │
│  • Sandboxed like               • Acts as gatekeeper   • Trusted code   │
│    a web page                                            only           │
│                                                                         │
│  window.api.readFile()  ───────►  ipcRenderer.invoke  ──────► fs.read  │
│        ↑                              ↑                        ↑        │
│        │                              │                        │        │
│    React code                   contextBridge              Node.js      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```
