---
date: 2025-11-27
author: Claude
status: draft
type: implementation_plan
feature: Chorus Foundation & Setup
---

# Chorus Foundation & Setup Implementation Plan

## Overview

This plan establishes the foundation of Chorus - a Slack-like Electron desktop application built in the `chorus/` subdirectory (`cc-slack/chorus/`). We're creating a two-pane layout with a tabbed sidebar (Workspaces + Files), workspace/repo management, VS Code-style file browsing, and Git integration. No Claude Code agent integration is included - that comes in subsequent features.

## Current State Analysis

A POC exists at `/electron/chorus/` with working patterns we'll adapt:

### Key Discoveries:
- **IPC Pattern**: `ipcMain.handle`/`ipcRenderer.invoke` for request-response (`electron/chorus/src/main/index.ts:89-140`)
- **Git Helper**: `runGit()` function wraps execSync with consistent `{ success, error?, data? }` pattern (`electron/chorus/src/main/index.ts:26-33`)
- **electron-store**: Schema-based persistence with typed CRUD helpers (`electron/chorus/src/main/store.ts:25-32`)
- **electron-vite config**: Three-target build (main/preload/renderer) with Tailwind v4 (`electron/chorus/electron.vite.config.ts`)
- **TypeScript configs**: Project references pattern with separate node/web configs (`electron/chorus/tsconfig.*.json`)

### Patterns to Follow:
- Consistent result objects: `{ success: boolean, data?: T, error?: string }`
- Context isolation via `contextBridge.exposeInMainWorld()`
- Tailwind v4 CSS-first configuration with `@import "tailwindcss"`
- Module organization with clear IPC handler sections

### What's Missing (Must Build):
- Workspace management (add/clone/remove)
- Hierarchical workspace → agent tree structure
- Two-tab sidebar (Workspaces + Files)
- Root workspace directory configuration
- Agent discovery from `.claude/agents/*.md`
- Git clone with progress tracking
- Zustand state management
- Virtual scrolling file tree

## What We're NOT Doing

- Claude Code agent integration (Feature 1+)
- Chat interface functionality (Feature 1+)
- Sending messages to agents (Feature 1+)
- File editing capabilities
- Git write operations (commit, push, pull)
- Multiple themes / theme switching
- Drag-and-drop workspace reordering
- Search functionality (Cmd+P style)
- Branch switching from UI

## Implementation Approach

Build incrementally in 4 phases, each producing a working state:
1. **Phase 1**: Project foundation - electron-vite in `chorus/` subdirectory with bun
2. **Phase 2**: Sidebar structure - two tabs, workspace management, agent discovery
3. **Phase 3**: File browser - react-arborist tree, syntax-highlighted viewer
4. **Phase 4**: Git integration - status, branch, log, clone with progress

---

## Phase 1: Project Foundation

### Overview
Set up a fresh Electron project in the `chorus/` subdirectory using bun and electron-vite. Establish the build system, TypeScript configuration, and basic app shell with two-pane layout.

### Changes Required:

#### 1. Project Initialization
**Files**: `chorus/package.json`, `chorus/bun.lockb`, `chorus/electron.vite.config.ts`, `chorus/tsconfig.*.json`

**Implementation Requirements:**
- Initialize electron-vite project in `chorus/` subdirectory with bun
- Configure package.json with bun-compatible scripts (`bun run dev`, `bun run build`)
- Set up electron-vite config following POC pattern (`electron/chorus/electron.vite.config.ts`)
- Create TypeScript configs using project references pattern
- Add dependencies: electron 38+, react 19, tailwindcss 4, zustand, electron-store, simple-git (for non-clone operations), react-arborist, prism-react-renderer
- Configure .gitignore to exclude `out/`, `dist/`, `node_modules/`, `.vite/`

#### 2. Main Process Entry
**File**: `src/main/index.ts`

**Implementation Requirements:**
- Create BrowserWindow with preload script path
- Set up app lifecycle handlers (ready, activate, window-all-closed)
- Configure window properties: 1200x800 default size, dark theme native frame
- Set up HMR URL loading for development vs file loading for production
- Follow security best practices: context isolation enabled, sandbox where possible
- Reference pattern from `electron/chorus/src/main/index.ts:35-65`

#### 3. Preload Script
**Files**: `src/preload/index.ts`, `src/preload/index.d.ts`

**Implementation Requirements:**
- Set up contextBridge with empty api object (to be filled in Phase 2)
- Create TypeScript declaration file for window.api
- Follow pattern from `electron/chorus/src/preload/index.ts`

#### 4. Renderer Entry
**Files**: `src/renderer/index.html`, `src/renderer/src/main.tsx`, `src/renderer/src/App.tsx`

**Implementation Requirements:**
- Create HTML entry point with root div
- Set up React 19 root rendering
- Create App component with basic two-pane layout (sidebar + main panel)
- Import Tailwind CSS

#### 5. Tailwind Configuration
**File**: `src/renderer/src/assets/main.css`

**Implementation Requirements:**
- Use Tailwind v4 CSS-first configuration: `@import "tailwindcss"`
- Define CSS custom properties for Slack-like dark theme:
  - `--sidebar-bg: #1a1d21`
  - `--main-bg: #222529`
  - `--input-bg: #2c2f33`
  - `--border-color: #383a3e`
  - `--text-primary: #e5e7eb`
  - `--text-secondary: #9ca3af`
  - `--accent: #4A154B` (Slack purple)
  - `--status-ready: #22c55e`
  - `--status-busy: #f59e0b`
- Set base styles: system fonts, dark background, no margins

#### 6. Basic Layout Components
**Files**: `src/renderer/src/components/Sidebar/Sidebar.tsx`, `src/renderer/src/components/MainPane/MainPane.tsx`

**Implementation Requirements:**
- Sidebar: Fixed width (256px), full height, dark background, placeholder content
- MainPane: Flex-grow to fill remaining space, placeholder "Select a workspace" message
- Use CSS custom properties for theming
- Implement resizable sidebar with min 200px, max 400px (optional enhancement)

### Success Criteria:

**Automated Verification:**
- [ ] `cd chorus && bun install` completes without errors
- [ ] `cd chorus && bun run dev` launches Electron app
- [ ] TypeScript compiles without errors (`bun run typecheck`)
- [ ] ESLint passes (`bun run lint`)

**Manual Verification:**
- [ ] App window appears with dark theme
- [ ] Two-pane layout visible (sidebar on left, main panel on right)
- [ ] Hot reload works when editing React components
- [ ] Window can be resized, minimum size enforced

---

## Phase 2: Sidebar & Workspace Management

### Overview
Implement the two-tab sidebar structure (Workspaces + Files tabs), workspace persistence with electron-store, and workspace management (add local path, clone from URL, remove). Set up Zustand stores for state management.

### Changes Required:

#### 1. Zustand Stores
**Files**: `src/renderer/src/stores/workspace-store.ts`, `src/renderer/src/stores/ui-store.ts`, `src/renderer/src/stores/file-tree-store.ts`

**Implementation Requirements:**

**workspace-store.ts:**
- State: `workspaces: Workspace[]`, `selectedWorkspaceId: string | null`, `selectedAgentId: string | null`, `selectedFilePath: string | null`, `isLoading: boolean`
- Actions: `loadWorkspaces()`, `addWorkspace(path)`, `cloneWorkspace(url)`, `removeWorkspace(id)`, `selectWorkspace(id)`, `selectAgent(workspaceId, agentId)`, `selectFile(filePath)`, `toggleWorkspaceExpanded(id)`, `refreshWorkspace(id)`
- Load from electron-store on init, persist changes back

**ui-store.ts:**
- State: `sidebarTab: 'workspaces' | 'files'`, `sidebarWidth: number`, `isSettingsOpen: boolean`, `cloneProgress: { workspaceId: string, progress: number, message: string } | null`
- Actions: `setSidebarTab(tab)`, `setSidebarWidth(width)`, `openSettings()`, `closeSettings()`, `setCloneProgress(progress)`

**file-tree-store.ts:**
- State: `expandedPaths: Set<string>`
- Actions: `toggleExpanded(path)`, `expandPath(path)`, `collapsePath(path)`, `collapseAll()`

#### 2. Type Definitions
**File**: `src/renderer/src/types/index.ts`

**Implementation Requirements:**
- Define `Workspace` interface: id, name, path, isExpanded, gitBranch, isDirty, hasSystemPrompt, agents[]
- Define `Agent` interface: id, name, filePath, workspaceId
- Define `DirectoryEntry` interface: name, path, isDirectory, children?
- Define `GitStatus`, `GitChange`, `GitCommit` interfaces
- Define `ChorusSettings` interface: rootWorkspaceDir, theme
- Define `SidebarTab` type: 'workspaces' | 'files'
- Export all types for use across the app

#### 3. electron-store Configuration
**File**: `src/main/store.ts`

**Implementation Requirements:**
- Define store schema with TypeScript: workspaces[], settings (rootWorkspaceDir, theme)
- Set defaults: empty workspaces array, empty rootWorkspaceDir
- Create CRUD helpers: `getWorkspaces()`, `addWorkspace()`, `removeWorkspace()`, `updateWorkspace()`
- Create settings helpers: `getSettings()`, `setRootWorkspaceDir()`, `getRootWorkspaceDir()`
- Reference pattern from `electron/chorus/src/main/store.ts`

#### 4. Workspace Service (Main Process)
**File**: `src/main/workspace-service.ts`

**Implementation Requirements:**
- `validateGitRepo(path)`: Check if path contains `.git` directory
- `discoverAgents(repoPath)`: Scan `.claude/agents/*.md`, return Agent[] with id (uuid), name (filename without .md), filePath
- `checkSystemPrompt(repoPath)`: Check if `CLAUDE.md` exists at repo root
- `getWorkspaceInfo(path)`: Combine git branch, isDirty, hasSystemPrompt, agents into Workspace object
- Handle errors gracefully, return empty arrays/false on failures

#### 5. IPC Handlers for Workspace Management
**File**: `src/main/index.ts` (add to existing)

**Implementation Requirements:**
- `workspace:list`: Return all workspaces from store with fresh git/agent info
- `workspace:add`: Validate git repo, discover agents, add to store, return Workspace
- `workspace:remove`: Remove from store (files remain on disk)
- `workspace:refresh`: Re-fetch git status and agents for a workspace
- `workspace:get-root-dir`: Return configured root workspace directory
- `workspace:set-root-dir`: Validate directory exists, save to settings
- `agents:discover`: Scan `.claude/agents/*.md` for a given repo path

#### 6. Preload API Extensions
**File**: `src/preload/index.ts`

**Implementation Requirements:**
- Expose workspace operations: `workspace.list()`, `workspace.add(path)`, `workspace.remove(id)`, `workspace.refresh(id)`
- Expose settings operations: `settings.getRootDir()`, `settings.setRootDir(path)`
- Expose dialog operations: `dialog.selectDirectory()`
- Add TypeScript definitions for all new APIs

#### 7. Sidebar Tab Structure
**Files**: `src/renderer/src/components/Sidebar/SidebarTabs.tsx`, `src/renderer/src/components/Sidebar/Sidebar.tsx`

**Implementation Requirements:**
- Two icon buttons at top of sidebar: Workspaces (folder-tree icon), Files (file icon)
- Active tab indicated by background highlight
- Tooltip on hover showing tab name
- Click switches `sidebarTab` in ui-store
- Content area renders either WorkspacesPanel or FilesPanel based on active tab

#### 8. Workspaces Panel
**Files**: `src/renderer/src/components/Sidebar/WorkspacesPanel.tsx`, `src/renderer/src/components/Sidebar/WorkspaceItem.tsx`, `src/renderer/src/components/Sidebar/AgentItem.tsx`

**Implementation Requirements:**

**WorkspacesPanel:**
- Render list of workspaces from workspace-store
- "Add Workspace" button at bottom
- Loading state while fetching workspaces

**WorkspaceItem:**
- Collapsible section with workspace name as header
- Show git branch in brackets: `[main]`
- Show dirty indicator (*) if uncommitted changes
- Show system prompt indicator icon if CLAUDE.md exists
- Chevron icon to expand/collapse
- Right-click context menu with "Remove Workspace" option
- Click to select workspace (updates selectedWorkspaceId)
- When expanded, show agents or "No agents found" message

**AgentItem:**
- Show agent name (derived from filename)
- Click to select agent (updates selectedAgentId)
- Visual indicator for selected state

#### 9. Add Workspace Dialog
**File**: `src/renderer/src/components/dialogs/AddWorkspaceDialog.tsx`

**Implementation Requirements:**
- Modal dialog with two input modes:
  - **Local Path**: Directory picker button + path display, "Add" button
  - **Clone from URL**: Text input for GitHub URL, "Clone" button
- Tab or radio buttons to switch between modes
- Validation: Local path must be valid git repo, URL must be valid GitHub URL
- Error display for validation failures
- Loading state during clone operation
- Close on successful add, remain open on error

#### 10. Settings Dialog (First-Run)
**File**: `src/renderer/src/components/dialogs/SettingsDialog.tsx`

**Implementation Requirements:**
- Modal dialog for configuring root workspace directory
- Directory picker button to select folder
- Display selected path
- "Save" button to persist
- On first run (no rootWorkspaceDir set), show automatically
- Can also be opened from menu/settings icon

### Success Criteria:

**Automated Verification:**
- [ ] TypeScript compiles without errors
- [ ] All Zustand stores have proper TypeScript types
- [ ] IPC handlers have corresponding preload API methods

**Manual Verification:**
- [ ] Tab icons switch between Workspaces and Files views
- [ ] First run prompts for root workspace directory
- [ ] Add Workspace dialog opens with two modes
- [ ] Adding local git repo path shows workspace in sidebar
- [ ] Non-git directory shows error message
- [ ] Workspaces expand/collapse to show agents
- [ ] Agents discovered from `.claude/agents/*.md` files
- [ ] "No agents found" shown for repos without agents
- [ ] System prompt icon shown when CLAUDE.md exists
- [ ] Right-click "Remove" removes workspace (files remain)
- [ ] Workspaces persist across app restart

---

## Phase 3: File Browser & Viewer

### Overview
Implement the Files tab with a VS Code-style directory tree using react-arborist for virtual scrolling and proper tree behavior. Build the file viewer with syntax highlighting using prism-react-renderer.

### Changes Required:

#### 1. File System Service (Main Process)
**File**: `src/main/fs-service.ts`

**Implementation Requirements:**
- `listDirectory(path)`: Return DirectoryEntry[] with name, path, isDirectory
- Filter hidden files by default (except `.claude` directory)
- Sort entries: directories first, then alphabetically
- `readFile(path)`: Return file contents as string
- `watchDirectory(path)`: Set up fs.watch, emit events on changes
- Handle errors gracefully (permission denied, file not found)
- Limit file read size (e.g., 1MB max) with appropriate error message

#### 2. IPC Handlers for File System
**File**: `src/main/index.ts` (add to existing)

**Implementation Requirements:**
- `fs:list-directory`: Call fsService.listDirectory, return entries
- `fs:read-file`: Call fsService.readFile, return content
- `fs:watch-start`: Start watching directory, send `fs:changed` events
- `fs:watch-stop`: Stop watching directory
- Follow pattern from `electron/chorus/src/main/index.ts:99-114`

#### 3. Preload API Extensions for File System
**File**: `src/preload/index.ts`

**Implementation Requirements:**
- Expose `fs.listDirectory(path)`, `fs.readFile(path)`
- Expose `fs.watchStart(path)`, `fs.watchStop(path)`
- Expose `fs.onChanged(callback)` for file change events with cleanup function
- Add TypeScript definitions

#### 4. Files Panel with react-arborist
**File**: `src/renderer/src/components/Sidebar/FilesPanel.tsx`

**Implementation Requirements:**
- Header showing active workspace name: "Files: {workspaceName}"
- Use react-arborist Tree component for directory display
- Configure for virtual scrolling (handles large directories)
- Implement async children loading (lazy load on expand)
- File type icons based on extension (folder, ts, js, md, json, etc.)
- Click file to select (updates selectedFilePath in workspace-store)
- Double-click folder to expand/collapse
- Keyboard navigation: arrow keys, Enter to expand/select
- Selected file highlighted
- Show "Select a workspace" message if no workspace selected
- Integrate with file-tree-store for expanded state persistence

#### 5. File Viewer with Syntax Highlighting
**File**: `src/renderer/src/components/MainPane/FileViewer.tsx`

**Implementation Requirements:**
- Breadcrumb path at top showing file location
- Scrollable content area
- Use prism-react-renderer for syntax highlighting
- Support common languages: TypeScript, JavaScript, JSON, Markdown, Python, CSS, HTML, YAML
- Detect language from file extension
- Line numbers on left side
- Dark theme matching app design (e.g., vsDark or dracula theme)
- Handle large files gracefully (virtualize or limit display)
- Loading state while fetching file content
- Error state for unreadable files
- "Binary file not shown" message for non-text files

#### 6. Main Pane Content Switching
**File**: `src/renderer/src/components/MainPane/MainPane.tsx`

**Implementation Requirements:**
- Render content based on selection state:
  - If `selectedFilePath`: Show FileViewer
  - If `selectedAgentId`: Show ChatPlaceholder ("Agent chat coming in Feature 1")
  - If `selectedWorkspaceId` only: Show WorkspaceOverview
  - If nothing selected: Show welcome message
- Smooth transitions between content types

#### 7. Workspace Overview Panel
**File**: `src/renderer/src/components/MainPane/WorkspaceOverview.tsx`

**Implementation Requirements:**
- Show workspace name and path
- Display current branch prominently
- Show "has uncommitted changes" badge if dirty
- List agents in this workspace with count
- Quick stats: number of files, last commit info
- "View Files" button to switch to Files tab
- Placeholder for git info (commits shown in Phase 4)

#### 8. Chat Placeholder
**File**: `src/renderer/src/components/MainPane/ChatPlaceholder.tsx`

**Implementation Requirements:**
- Show agent name
- Display "Agent chat coming in Feature 1" message
- Icon or illustration indicating future functionality
- Simple, clean design matching app aesthetic

### Success Criteria:

**Automated Verification:**
- [ ] TypeScript compiles without errors
- [ ] react-arborist properly typed
- [ ] prism-react-renderer themes working

**Manual Verification:**
- [ ] Files tab shows directory tree of selected workspace
- [ ] Large directories (1000+ files) scroll smoothly (virtual scrolling works)
- [ ] Folders expand on click, load children lazily
- [ ] File icons match file types
- [ ] Clicking file shows content in main pane with syntax highlighting
- [ ] Breadcrumb shows correct file path
- [ ] Line numbers display correctly
- [ ] Different file types highlight correctly (TS, JS, JSON, MD)
- [ ] Binary files show appropriate message
- [ ] Workspace overview shows when workspace selected but no file
- [ ] Chat placeholder shows when agent selected

---

## Phase 4: Git Integration & Clone

### Overview
Implement Git status display in the Workspaces tab, Git panel in workspace overview with commit history, and git clone functionality with progress tracking for adding workspaces from GitHub URLs.

### Changes Required:

#### 1. Git Service (Main Process)
**File**: `src/main/git-service.ts`

**Implementation Requirements:**
- Wrap git CLI commands using child_process spawn/execSync
- `isRepo(path)`: Check for .git directory existence
- `getStatus(path)`: Run `git status --porcelain`, parse into GitChange[]
- `getBranch(path)`: Run `git branch --show-current`
- `getLog(path, count)`: Run `git log --oneline -n {count}`, parse into GitCommit[]
- `clone(url, targetDir, onProgress)`: Spawn `git clone --progress`, parse stderr for progress updates, call onProgress callback with percentage and message
- Reference helper pattern from `electron/chorus/src/main/index.ts:26-33`
- Handle all errors gracefully, return consistent result objects

#### 2. Git Clone with Progress
**File**: `src/main/git-service.ts` (clone function detail)

**Implementation Requirements:**
- Use `child_process.spawn` for clone (not execSync) to capture streaming output
- Parse git clone progress from stderr (format: "Receiving objects: X% (N/M)")
- Extract percentage and phase (Counting, Compressing, Receiving, Resolving)
- Call progress callback with: `{ phase: string, percent: number, message: string }`
- Handle clone failures: auth errors, network issues, invalid URL
- Return success/failure with appropriate error messages
- Support cancellation (kill child process)

#### 3. IPC Handlers for Git
**File**: `src/main/index.ts` (add to existing)

**Implementation Requirements:**
- `git:is-repo`: Check if path is git repository
- `git:status`: Get git status with changed files
- `git:branch`: Get current branch name
- `git:log`: Get recent commits (default 10)
- `git:clone`: Start clone operation, return immediately
- Send `git:clone-progress` events during clone with progress data
- Send `git:clone-complete` event when done (success or failure)
- Reference pattern from `electron/chorus/src/main/index.ts:147-200`

#### 4. Preload API Extensions for Git
**File**: `src/preload/index.ts`

**Implementation Requirements:**
- Expose `git.isRepo(path)`, `git.status(path)`, `git.branch(path)`, `git.log(path, count)`
- Expose `git.clone(url, targetDir)` - returns Promise that resolves when clone starts
- Expose `git.onCloneProgress(callback)` with cleanup function
- Expose `git.onCloneComplete(callback)` with cleanup function
- Expose `git.cancelClone()` to abort running clone
- Add TypeScript definitions

#### 5. Git Status in Workspace Items
**File**: `src/renderer/src/components/Sidebar/WorkspaceItem.tsx` (update)

**Implementation Requirements:**
- Fetch git status when workspace is loaded/refreshed
- Display branch name in brackets after workspace name
- Show dirty indicator (*) next to branch if uncommitted changes
- Color-code: green for clean, yellow/orange for dirty
- Refresh status periodically or on window focus
- Handle repos with no commits (new repos)

#### 6. Git Panel in Workspace Overview
**File**: `src/renderer/src/components/MainPane/GitPanel.tsx`

**Implementation Requirements:**
- Section in WorkspaceOverview showing git information
- Current branch with branch icon
- Uncommitted changes section:
  - List of changed files with status indicator (M/A/D/?)
  - Status icons: modified (yellow), added (green), deleted (red), untracked (gray)
  - File names truncated if too long
- Recent commits section:
  - Show last 10 commits
  - Display: short hash (7 chars), commit message (truncated)
  - Commit author and relative time (optional)
- "Refresh" button to re-fetch git info

#### 7. Clone Progress UI
**File**: `src/renderer/src/components/Sidebar/CloneProgress.tsx`

**Implementation Requirements:**
- Inline progress display in sidebar (not modal)
- Show during clone operation
- Display: repository name being cloned, progress bar, current phase, percentage
- Cancel button to abort clone
- On completion: show success briefly, then render as normal workspace
- On failure: show error message with retry option
- Integrate with ui-store cloneProgress state

#### 8. Add Workspace Dialog Clone Integration
**File**: `src/renderer/src/components/dialogs/AddWorkspaceDialog.tsx` (update)

**Implementation Requirements:**
- When "Clone" clicked with valid GitHub URL:
  - Validate URL format (https://github.com/owner/repo or git@github.com:owner/repo.git)
  - Extract repo name for target directory
  - Construct target path: `{rootWorkspaceDir}/{repoName}`
  - Check if directory already exists, show error if so
  - Start clone via IPC
  - Close dialog, show progress in sidebar
- Handle clone completion: add workspace to store, refresh list
- Handle clone failure: show error, allow retry

#### 9. Workspace Refresh on Focus
**File**: `src/renderer/src/App.tsx` or dedicated hook

**Implementation Requirements:**
- Listen for window focus events
- On focus, refresh git status for all workspaces
- Debounce to avoid excessive refreshes
- Update workspace-store with fresh data
- Also refresh when switching back to app from another window

### Success Criteria:

**Automated Verification:**
- [ ] TypeScript compiles without errors
- [ ] Git service functions have proper error handling
- [ ] Clone progress events properly typed

**Manual Verification:**
- [ ] Git branch name shows in workspace item
- [ ] Dirty indicator (*) appears when repo has uncommitted changes
- [ ] Workspace overview shows list of changed files
- [ ] Recent commits display with hash and message
- [ ] Cloning from GitHub URL shows inline progress
- [ ] Progress updates as clone proceeds (percentage changes)
- [ ] Clone completion adds workspace to list
- [ ] Clone failure shows error message
- [ ] Cancel button stops clone operation
- [ ] Git status refreshes when app regains focus
- [ ] Invalid GitHub URLs show validation error

---

## Electron-Specific Considerations

### Main Process Changes
- `src/main/index.ts`: App lifecycle, window creation, all IPC handlers
- `src/main/store.ts`: electron-store for workspace and settings persistence
- `src/main/workspace-service.ts`: Workspace validation and agent discovery
- `src/main/fs-service.ts`: File system operations with proper error handling
- `src/main/git-service.ts`: Git CLI wrapper with clone progress streaming

### Renderer Process Changes
- React 19 with Zustand for state management
- Components organized by feature (Sidebar/, MainPane/, dialogs/)
- All file/git operations go through window.api (no direct Node.js access)
- Virtual scrolling with react-arborist for performance

### Preload Script Changes
- Expose all IPC channels via contextBridge
- Type-safe API surface with index.d.ts
- Event listeners return cleanup functions
- No Node.js APIs exposed directly

### Security Considerations
- Context isolation enabled
- Sandbox enabled where possible
- No remote content loading
- Path validation before file operations
- No shell command injection (sanitize git args)

## Performance Considerations

### File Tree Performance
- react-arborist provides virtual scrolling out of the box
- Lazy load directory children on expand
- Cache expanded state in Zustand store
- Debounce file watcher events

### Git Operations
- Run git commands in main process (not blocking renderer)
- Cache git status, refresh on focus or manual trigger
- Clone progress uses streaming (doesn't block)
- Timeout on git operations (10 seconds for status/log)

### State Management
- Zustand selectors for fine-grained re-renders
- Persist only necessary state to electron-store
- Debounce store writes

## Testing Strategy

### Unit Tests
- Zustand stores: test actions and state transitions
- Git service: test output parsing (mock execSync)
- Workspace service: test agent discovery logic

### Integration Tests
- IPC round-trips: main ↔ preload ↔ renderer
- electron-store persistence across restarts
- File system operations with real directories

### Manual Testing
- Add workspace via local path
- Add workspace via GitHub clone
- Remove workspace
- Navigate file tree in large repos
- View files with syntax highlighting
- Verify git status updates
- Test first-run settings flow
- Cross-platform: macOS, Windows, Linux paths

## References
- Feature spec: `specifications/0-chorus-setup/feature.md`
- POC IPC patterns: `electron/chorus/src/main/index.ts:85-285`
- POC store patterns: `electron/chorus/src/main/store.ts`
- POC preload patterns: `electron/chorus/src/preload/index.ts`
- POC type definitions: `electron/chorus/src/preload/index.d.ts`
