# Electron Study Plan for Chorus

## What is Electron?

A framework for building cross-platform desktop apps using web technologies (HTML, CSS, JavaScript/TypeScript). Apps like VS Code, Slack, Discord, and Notion are built with Electron.

---

## Architecture (Two Processes)

```
┌─────────────────────────────────────────────┐
│              Main Process                    │
│  - Node.js environment                       │
│  - Creates windows, system tray, menus       │
│  - File system access, shell commands        │
│  - Spawns Claude Agent SDK clients           │
└──────────────────┬──────────────────────────┘
                   │ IPC (Inter-Process Communication)
┌──────────────────▼──────────────────────────┐
│            Renderer Process(es)              │
│  - Browser window (Chromium)                 │
│  - React UI lives here                       │
│  - No direct Node.js access (for security)   │
│  - Communicates via IPC to main process      │
└─────────────────────────────────────────────┘
```

**Key Concept for Chorus:**
- Main process → spawns/manages Claude Agent SDK clients, git operations, file I/O
- Renderer → Slack-like React UI, sends messages to main process via IPC

---

## Modules

### Module 1: Project Setup
**Goal:** Scaffold Electron + React + TypeScript + Vite

- [ ] Install Node.js prerequisites
- [ ] Initialize project with electron-vite
- [ ] Understand project structure
- [ ] Run dev mode, see hot reload working
- [ ] Build and package a basic app

---

### Module 2: Main vs Renderer Processes
**Goal:** Understand process separation and security model

- [ ] Main process: what it can do (Node.js APIs, file system, shell)
- [ ] Renderer process: what it can do (DOM, React, browser APIs)
- [ ] Preload scripts: the secure bridge
- [ ] Context isolation and why it matters
- [ ] Exercise: Log from both processes, see where each runs

---

### Module 3: IPC Communication
**Goal:** Send messages between UI and main process

- [ ] `ipcMain` and `ipcRenderer` basics
- [ ] `contextBridge` to expose safe APIs
- [ ] Request/response pattern (invoke/handle)
- [ ] One-way events (send/on)
- [ ] Exercise: Button in UI triggers action in main process

---

### Module 4: Building the UI Shell
**Goal:** Slack-like sidebar + chat layout with React

- [ ] Set up Tailwind CSS
- [ ] Create sidebar component (agent list)
- [ ] Create main chat panel
- [ ] Create message input
- [ ] Dark theme styling
- [ ] Exercise: Static mockup of Chorus UI

---

### Module 5: File System & Git
**Goal:** Read repos, run git commands from main process

- [ ] Read directory contents (list files in a repo)
- [ ] Read file contents (CLAUDE.md, etc.)
- [ ] Execute shell commands (git status, git log)
- [ ] Watch for file changes
- [ ] Exercise: Display repo file tree in UI

---

### Module 6: Claude Agent SDK Integration
**Goal:** Spawn agent client, stream responses

- [ ] Install `@anthropic-ai/claude-code` SDK
- [ ] Create agent client in main process
- [ ] Set working directory (`cwd`) to repo path
- [ ] Stream messages to renderer
- [ ] Handle agent lifecycle (start, stop, busy state)
- [ ] Exercise: Send a message, see streamed response in UI

---

### Module 7: State Management
**Goal:** Manage multiple agents, sessions, messages

- [ ] Store agent configurations (repo paths, names)
- [ ] Persist data with electron-store or SQLite
- [ ] Session management (resume conversations)
- [ ] Message history per agent
- [ ] Exercise: Switch between agents, see separate histories

---

### Module 8: Polish & Packaging
**Goal:** Production-ready app

- [ ] Desktop notifications (agent finished)
- [ ] Status indicators (busy/ready)
- [ ] System tray integration
- [ ] Auto-updater basics
- [ ] Package for macOS/Windows/Linux
- [ ] Exercise: Build distributable .dmg/.exe

---

## Resources

- [Electron Docs](https://www.electronjs.org/docs/latest/)
- [electron-vite](https://electron-vite.org/)
- [Claude Agent SDK](https://docs.anthropic.com/en/docs/claude-code/agent-sdk)
- [Tailwind CSS](https://tailwindcss.com/)

---

## Progress Tracker

| Module | Status | Notes |
|--------|--------|-------|
| 1. Project Setup | Not Started | |
| 2. Main vs Renderer | Not Started | |
| 3. IPC Communication | Not Started | |
| 4. UI Shell | Not Started | |
| 5. File System & Git | Not Started | |
| 6. Agent SDK | Not Started | |
| 7. State Management | Not Started | |
| 8. Polish | Not Started | |
