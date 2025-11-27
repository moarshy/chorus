---
date: 2025-11-27
author: Arshy/Claude
status: draft
type: feature
feature_id: 0
---

# Chorus Foundation & Setup Feature

## Overview

This feature establishes the foundation of Chorus - a Slack-like Electron desktop application for orchestrating multiple Claude Code agents across GitHub repositories. This initial setup creates a running Electron app with a two-pane layout (sidebar + main panel), workspace/repo management, file system browsing, and Git integration. No Claude Code agent integration is included in this feature - that comes in subsequent features.

**Important:** The Chorus app will be built in the `chorus/` subdirectory of this repository (`cc-slack/chorus/`). The existing `/electron/` directory contains a POC for reference only.

## Business Value

### For Power Users (like Richard)
- Single interface to manage all agent workspaces instead of multiple Cursor/terminal windows
- Visual file browser to see repository contents without switching apps
- Git status visibility per workspace
- Foundation for future multi-agent orchestration

### For New Users
- Familiar Slack-like interface reduces learning curve
- Visual workspace management instead of CLI-based navigation
- Clear mental model: Workspace = GitHub Repo

## Current State

A POC exists at `/electron/chorus/` with:
- Basic Electron + React + TypeScript setup using electron-vite
- Simple sidebar with agent list
- Chat panel with Claude Agent SDK integration
- Basic file browser component
- Some git commands (status, log, branch)
- Uses `npm` for package management

**Limitations of POC:**
- Flat agent list (no workspace grouping)
- No workspace management (add by URL, clone functionality)
- No configurable root workspace directory
- File browser is basic - not VS Code/Cursor quality
- Uses npm instead of bun

## User Stories

### Workspace Management

1. **User**: **Given** I am on the Workspaces tab, **when** I click "Add Workspace", **then** I see options to add a local repo path OR clone from a GitHub URL - *Acceptance: Modal/dialog with two input modes*

2. **User**: **Given** I provide a GitHub URL, **when** I confirm, **then** Chorus clones the repo to my configured root workspace directory and adds it to the sidebar - *Acceptance: Repo appears in sidebar after clone completes*

3. **User**: **Given** I provide a local path to a git repo, **when** I confirm, **then** Chorus validates it's a git repo and adds it to the sidebar - *Acceptance: Non-git directories show an error*

4. **User**: **Given** I have workspaces, **when** I right-click a workspace, **then** I can remove it from Chorus (without deleting files) - *Acceptance: Workspace disappears from sidebar, files remain on disk*

5. **User**: **Given** I open Chorus for the first time, **when** the app loads, **then** I am prompted to set my root workspace directory (where cloned repos will go) - *Acceptance: Settings stored and persisted*

### Agent Discovery

6. **User**: **Given** a workspace is listed, **when** the repo contains `.claude/agents/` directory with `.md` files, **then** I see all agents listed under that workspace - *Acceptance: Each .md file in agents/ appears as a sub-item*

7. **User**: **Given** a workspace is listed, **when** the repo does NOT have `.claude/agents/` or it's empty, **then** I see "No agents found" under that workspace - *Acceptance: Clear message indicating no agents*

8. **User**: **Given** a workspace has a `CLAUDE.md` file, **when** I view the workspace, **then** I see an indicator that it has a system prompt configured - *Acceptance: Small icon or badge, NOT listed as an agent*

9. **User**: **Given** I have multiple workspaces, **when** I expand/collapse workspaces, **then** agents under each are shown/hidden - *Acceptance: Collapsible tree structure*

### Sidebar Navigation (Cursor-style Tabs)

10. **User**: **Given** I am in the sidebar, **when** I click the "Workspaces" icon/tab, **then** I see the list of workspaces and their agents - *Acceptance: Workspaces tab is active*

11. **User**: **Given** I am in the sidebar, **when** I click the "Files" icon/tab, **then** I see the file tree of the currently selected workspace - *Acceptance: Files tab shows directory tree*

12. **User**: **Given** I am on the Files tab, **when** I select a different workspace from elsewhere, **then** the file tree updates to show that workspace's files - *Acceptance: Tree reflects active workspace*

### File System Browser

13. **User**: **Given** I am on the Files tab in sidebar, **when** a workspace is selected, **then** I see a VS Code/Cursor-like file tree of the repository - *Acceptance: Expandable folder tree, file icons*

14. **User**: **Given** I am viewing the file tree, **when** I click a file, **then** I see its contents in the main pane - *Acceptance: Syntax highlighting for common file types*

15. **User**: **Given** I am in the file browser, **when** I navigate directories, **then** the tree expands/collapses smoothly - *Acceptance: Smooth animations, lazy loading*

### Git Integration

16. **User**: **Given** a workspace is listed, **when** I view the Workspaces tab, **then** I see the current branch name and an indicator if there are uncommitted changes - *Acceptance: Branch name visible, dirty indicator (dot or color)*

17. **User**: **Given** I am viewing a workspace, **when** I open the Git section in main pane, **then** I see recent commits with hash and message - *Acceptance: Last 10 commits visible*

18. **User**: **Given** a workspace has uncommitted changes, **when** I view the Git section, **then** I see a list of modified/added/deleted files - *Acceptance: git status --porcelain parsed and displayed*

### App Setup & Configuration

19. **User**: **Given** I am on macOS/Windows/Linux, **when** I run the Chorus app, **then** it launches correctly using bun as the package manager - *Acceptance: `bun run dev` works*

20. **User**: **Given** I want to configure Chorus, **when** I access settings, **then** I can set the root workspace directory - *Acceptance: Settings persist across app restarts*

## Core Functionality

### Sidebar Structure (Left Pane) - Cursor-Style Two Tabs

```

  Chorus                             
$
  [Workspaces Icon] [Files Icon]       � Tab icons at top
$
                                     
  (Content changes based on tab)     
                                     

```


#### Tab 1: Workspaces Tab (Agent/Repo Management)
```
Workspaces
├── product-agent [main] [*] [📄]     ← [📄] = has CLAUDE.md system prompt
│   ├── researcher
│   ├── writer
│   └── analyst
├── legal-agent [main] [📄]
│   └── (No agents found)             ← No .claude/agents/ or empty
├── research-agent [feat/new] [*]
│   ├── reddit-scanner
│   └── twitter-monitor
└── + Add Workspace
```

**Key elements:**
- Collapsible workspace sections
- Agents nested under workspaces (from `.claude/agents/*.md` ONLY)
- "No agents found" shown when workspace has no agents directory or it's empty
- Branch name displayed in brackets
- Dirty indicator (*) for uncommitted changes
- System prompt indicator [📄] shown when CLAUDE.md exists (NOT an agent, just a badge)
- Status indicators (ready/busy) - prepared for future agent integration
- Click workspace to select it (affects Files tab and main pane)
- Click agent to open chat (future feature)

**Important clarification:**
- `CLAUDE.md` is a **system prompt** that applies to ALL agents in the workspace - it is NOT an agent itself
- Agents are ONLY discovered from `.claude/agents/` directory (each `.md` file = one agent)
- If a workspace has no `.claude/agents/` folder or it's empty, show "No agents found"

#### Tab 2: Files Tab (Directory Tree)
```
Files: product-agent
 =� .claude
    =� agents
       =� researcher.md
       =� writer.md
    =� commands
 =� docs
    =� brief-1.md
    =� brief-2.md
 =� CLAUDE.md
 =� README.md
 =� package.json
```

**Key elements:**
- Shows active workspace's file tree
- VS Code/Cursor-style expandable folders
- File type icons
- Click file to view in main pane
- Header shows which workspace is active

### Main Pane Structure (Right Pane)

The main pane shows content based on what's selected:

**When a file is selected:**
- File viewer with syntax highlighting
- Read-only (no editing in v1)
- Breadcrumb path at top

**When an agent is selected (placeholder for now):**
- Chat interface placeholder
- "Agent chat coming soon" message

**When workspace is selected but no file/agent:**
- Workspace overview
- Git status/commits view
- Recent activity

### Tabs in Main Pane (Optional - for workspace overview)

When viewing a workspace (not a specific file or agent):
- **Overview** - Workspace info, recent commits
- **Git** - Full git status, changes, commits

## Technical Requirements

### Stack & Tooling

| Component | Technology |
|-----------|------------|
| Runtime | Electron 38+ |
| Frontend | React 19 + TypeScript 5 |
| Build | electron-vite |
| Styling | Tailwind CSS 4 |
| Package Manager | **bun** (not npm) |
| State Persistence | electron-store |
| Git Operations | simple-git or child_process (git CLI) |

### Project Structure (In chorus/ Subdirectory)

```
cc-slack/                     # This repository root
 package.json              # bun-compatible
 bun.lockb                 # bun lockfile
 electron-builder.yml
 electron.vite.config.ts
 tsconfig.json
 tsconfig.node.json
 tsconfig.web.json
 .gitignore
 src/
    main/                 # Electron main process
       index.ts          # Main entry, IPC handlers
       store.ts          # electron-store configuration
       git-service.ts    # Git operations
       workspace-service.ts  # Workspace management
    preload/
       index.ts          # Context bridge
       index.d.ts        # Type definitions
    renderer/
        src/
            main.tsx
            App.tsx
            stores/       # Zustand stores
               workspace-store.ts
               ui-store.ts
            components/
               Sidebar/
                  Sidebar.tsx
                  SidebarTabs.tsx      # Tab icons
                  WorkspacesPanel.tsx   # Workspaces tab content
                  WorkspaceItem.tsx
                  AgentItem.tsx
                  FilesPanel.tsx        # Files tab content
                  FileTreeNode.tsx
               MainPane/
                  MainPane.tsx
                  FileViewer.tsx
                  WorkspaceOverview.tsx
                  GitPanel.tsx
                  ChatPlaceholder.tsx   # For future
               dialogs/
                   AddWorkspaceDialog.tsx
                   SettingsDialog.tsx
            types/
                index.ts
 resources/
    icon.png
 docs/                     # Keep existing docs
 specifications/           # Keep existing specs
 electron/                 # Keep POC for reference
```

### IPC Channels (Main � Renderer)

```typescript
// Workspace Management
'workspace:list' � StoredWorkspace[]
'workspace:add' � { path?: string, url?: string } � Workspace
'workspace:remove' � workspaceId � void
'workspace:get-root-dir' � string
'workspace:set-root-dir' � path � void

// File System
'fs:list-directory' � path � DirectoryEntry[]
'fs:read-file' � path � string
'fs:watch-directory' � path � void (starts watching, sends events)

// Git Operations
'git:is-repo' � path � boolean
'git:status' � path � GitStatus
'git:branch' � path � string
'git:log' � path, count � GitCommit[]
'git:clone' � url, targetDir � void (with progress events)

// Agent Discovery
'agents:discover' � repoPath � Agent[]

// Settings
'settings:get' � key � value
'settings:set' � key, value � void
```

### Data Models

```typescript
interface Workspace {
  id: string
  name: string
  path: string
  isExpanded: boolean
  gitBranch: string | null
  isDirty: boolean
  hasSystemPrompt: boolean  // true if CLAUDE.md exists (NOT an agent)
  agents: Agent[]           // Only from .claude/agents/*.md
}

interface Agent {
  id: string
  name: string          // Derived from filename (e.g., "researcher" from researcher.md)
  filePath: string      // Path to .claude/agents/*.md file
  workspaceId: string
}
// Note: Agents are ONLY from .claude/agents/*.md files
// CLAUDE.md is NOT an agent - it's a system prompt for the workspace

interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
  isExpanded?: boolean  // For tree state
  children?: DirectoryEntry[]  // For lazy loading
}

interface GitStatus {
  branch: string
  isDirty: boolean
  changes: GitChange[]
}

interface GitChange {
  status: 'M' | 'A' | 'D' | '?' | 'R'  // Modified, Added, Deleted, Untracked, Renamed
  file: string
}

interface GitCommit {
  hash: string
  message: string
  author?: string
  date?: string
}

interface ChorusSettings {
  rootWorkspaceDir: string
  theme: 'dark' | 'light'
  // Future: defaultModel, etc.
}

// UI State
type SidebarTab = 'workspaces' | 'files'
```

### State Management (Zustand)

```typescript
// workspace-store.ts
interface WorkspaceStore {
  workspaces: Workspace[]
  selectedWorkspaceId: string | null
  selectedAgentId: string | null
  selectedFilePath: string | null

  // Actions
  loadWorkspaces: () => Promise<void>
  addWorkspace: (path: string) => Promise<void>
  cloneWorkspace: (url: string) => Promise<void>
  removeWorkspace: (id: string) => void
  selectWorkspace: (id: string) => void
  selectAgent: (workspaceId: string, agentId: string) => void
  selectFile: (filePath: string) => void
  toggleWorkspaceExpanded: (id: string) => void
  refreshGitStatus: (id: string) => Promise<void>
}

// ui-store.ts
interface UIStore {
  sidebarTab: 'workspaces' | 'files'
  sidebarWidth: number

  setSidebarTab: (tab: 'workspaces' | 'files') => void
  setSidebarWidth: (width: number) => void
}

// file-tree-store.ts (for Files tab state)
interface FileTreeStore {
  expandedPaths: Set<string>

  toggleExpanded: (path: string) => void
  expandPath: (path: string) => void
  collapsePath: (path: string) => void
}
```

### Electron Architecture

**Main Process Responsibilities:**
- All file system operations (read, list, watch)
- Git command execution (via simple-git or child_process)
- Clone operations (git clone with progress)
- Workspace persistence (electron-store)
- Settings management

**Renderer Process Responsibilities:**
- UI rendering (React)
- State management (Zustand)
- User interactions

**Preload Script:**
- Exposes safe IPC APIs via contextBridge
- Type-safe API interface

### Git Operations

Use `simple-git` package for cleaner API:

```typescript
import simpleGit from 'simple-git'

const git = simpleGit(repoPath)

// Clone with progress
await git.clone(url, targetDir, ['--progress'], (progress) => {
  mainWindow.webContents.send('clone:progress', progress)
})

// Status
const status = await git.status()

// Log
const log = await git.log({ maxCount: 10 })
```

## Design Considerations

### Sidebar Tab Design (Cursor-inspired)

```

 [=�] [<2]                  � Icon buttons, active has highlight
$
                          
  Tab content here        
                          

```

- **Icons:** Small icons at top of sidebar
- **Active indicator:** Background highlight or underline
- **Tooltip:** Show "Workspaces" / "Files" on hover

### UI/UX Guidelines

- **Dark theme by default** (Slack-inspired dark mode)
- **Color palette:**
  - Background: `#1a1d21` (sidebar), `#222529` (main)
  - Accent: `#4A154B` (Slack purple) or custom Chorus color
  - Text: White/gray hierarchy
  - Status: Green (ready), Yellow (busy), Red (error)

- **Typography:**
  - System fonts (San Francisco on macOS, Segoe on Windows)
  - Monospace for code/file content

- **Spacing:**
  - Consistent 4px/8px/16px grid
  - Comfortable touch targets (min 32px height for clickable items)

### File Tree UX

- **Lazy loading:** Only load children when folder is expanded
- **Virtual scrolling:** For very large directories (1000+ files)
- **Keyboard navigation:** Arrow keys to navigate, Enter to expand/open
- **File icons:** Based on extension (optional: use file-icons library)

### Responsive Behavior

- **Minimum window size:** 800x600
- **Sidebar:** Resizable, min 200px, max 400px
- **File tree:** Scrollable, virtualized for performance

## Implementation Considerations

### Setting Up at Repo Root

The app will be built in the `chorus/` subdirectory. Steps:

1. Initialize Electron project in `chorus/` with bun
2. Move/merge existing `.gitignore` to include Electron artifacts
3. Keep `docs/`, `specifications/`, `project-docs/` directories
4. The `/electron/` POC directory can remain for reference or be removed

### Bun Usage

- Use `bun create` or manual setup
- All commands: `bun install`, `bun run dev`, `bun run build`
- Creates `bun.lockb` instead of `package-lock.json`

### Separation from POC

This is a **fresh start**, not a refactor of the POC. The POC proved concepts; this is the production foundation. We may reference POC code but will build clean.

### Future-Proofing

- Keep chat/agent interfaces stubbed but architecturally planned
- Design state stores with agent session data in mind
- IPC channel naming should accommodate future agent channels

## Success Criteria

### Core Functionality
- [ ] App launches via `cd chorus && bun run dev`
- [ ] Sidebar has two tabs: Workspaces and Files
- [ ] Add workspace via local path works
- [ ] Add workspace via GitHub URL clones repo
- [ ] Workspaces persist across app restarts
- [ ] Agents discovered from `.claude/agents/*.md` only (NOT CLAUDE.md)
- [ ] "No agents found" shown when workspace has no agents
- [ ] System prompt indicator shown when CLAUDE.md exists
- [ ] Files tab shows directory tree of active workspace
- [ ] File content displays with syntax highlighting in main pane
- [ ] Git status shows branch and dirty indicator in Workspaces tab
- [ ] Git log shows recent commits

### User Experience
- [ ] Slack-like dark theme looks polished
- [ ] Tab switching is instant
- [ ] Sidebar collapse/expand is smooth
- [ ] File tree performance is good (large repos don't freeze)
- [ ] No visual glitches or layout breaks

### Technical Quality
- [ ] TypeScript strict mode, no `any` types
- [ ] All IPC channels typed
- [ ] electron-store schema validated
- [ ] No security warnings from Electron

## Scope Boundaries

### Definitely In Scope
- Electron app shell with two-pane layout
- Two-tab sidebar (Workspaces + Files)
- Workspace management (add local, clone from URL, remove)
- Root workspace directory configuration
- Workspaces tab with collapsible workspaces and agent discovery
- Files tab with VS Code-style directory tree
- File viewer in main pane
- Git status, branch, and log display
- Dark theme styling
- Bun as package manager
- Persistence via electron-store

### Definitely Out of Scope
- Claude Code agent integration (Feature 1+)
- Chat interface functionality (Feature 1+)
- Sending messages to agents (Feature 1+)
- Real-time agent status updates (Feature 1+)
- Git operations (commit, push, pull) - view only for now
- File editing
- Multiple themes / theme switching
- MCP server integration (Phase 3)
- Inter-agent communication (Phase 3)

### Future Considerations (Not Now)
- Drag-and-drop workspace reordering
- Workspace grouping/folders
- Search across workspaces
- File search (Cmd+P style)
- Git diff viewer
- Branch switching from UI
- Third sidebar tab for settings/other features

## Open Questions & Risks

### Questions Needing Resolution
1. **Clone progress UI:** Modal with progress bar? Toast notification? Inline in sidebar? Lets do inline in sidebar
2. **Large repo handling:** Should we lazy-load the file tree? Virtual scrolling? (Suggested: Yes) 
3. **Agent file parsing:** Should we parse agent .md files for metadata (name, description) or just use filename? for now trat each agetn .md as a "teammate"
4. **Tab icons:** What icons to use? Standard folder/tree icons or custom? standard

### Identified Risks
1. **Git clone failures:** Need robust error handling for auth issues, network failures
2. **File watcher performance:** Watching large repos could be expensive
3. **Cross-platform paths:** Windows vs macOS/Linux path handling
4. **File tree performance:** Large directories (node_modules) could be slow

## Next Steps

After this feature is approved:
1. Set up fresh Electron project in `chorus/` subdirectory with bun
2. Build sidebar with two-tab structure
3. Implement workspace service and persistence
4. Build Workspaces tab with workspace/agent tree
5. Build Files tab with directory tree
6. Implement file viewer in main pane
7. Add Git status integration
8. Polish and test

---

## Appendix: Reference from POC

The POC at `/electron/chorus/` contains useful patterns:

- **IPC setup:** `src/main/index.ts` shows the handle/invoke pattern
- **Store:** `src/main/store.ts` demonstrates electron-store usage
- **Preload types:** `src/preload/index.d.ts` shows type definitions
- **File browser:** `src/renderer/src/components/FilesPanel.tsx` has basic implementation

These can be referenced but the production code should be cleaner and more modular.

---


## Visual Reference: Sidebar Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│                            Chorus                                    │
├────────────────────┬────────────────────────────────────────────────┤
│ Sidebar            │  Main Pane                                     │
│                    │                                                │
│ [Workspaces][Files]│  ┌──────────────────────────────────────────┐  │
│ ─────────────────  │  │ product-agent / docs / brief-1.md        │  │
│                    │  ├──────────────────────────────────────────┤  │
│ IF Workspaces tab: │  │                                          │  │
│ ┌────────────────┐ │  │  # Product Brief                         │  │
│ │ product-agent  │ │  │                                          │  │
│ │ [📄][main][*]  │ │  │  ## Overview                             │  │
│ │   ├ researcher │ │  │  This document describes...              │  │
│ │   ├ writer     │ │  │                                          │  │
│ │   └ analyst    │ │  │                                          │  │
│ │ legal-agent    │ │  │                                          │  │
│ │ [📄][main]     │ │  │                                          │  │
│ │   └ (No agents)│ │  │                                          │  │
│ │ + Add Workspace│ │  │                                          │  │
│ └────────────────┘ │  │                                          │  │
│                    │  │                                          │  │
│ IF Files tab:      │  │                                          │  │
│ ┌────────────────┐ │  │                                          │  │
│ │ 📁 .claude     │ │  │                                          │  │
│ │   📁 agents    │ │  │                                          │  │
│ │ 📁 docs        │ │  │                                          │  │
│ │   📄 brief-1.md│ │  │                                          │  │
│ │ 📄 CLAUDE.md   │ │  │                                          │  │
│ │ 📄 README.md   │ │  └──────────────────────────────────────────┘  │
│ └────────────────┘ │                                                │
└────────────────────┴────────────────────────────────────────────────┘

Legend:
[📄] = Has CLAUDE.md system prompt (NOT an agent)
[main] = git branch name
[*] = Has uncommitted changes
```
