# UI & Navigation

Chorus uses a VS Code-inspired layout with sidebar navigation, tabbed main pane, and contextual right panel.

---

## Overview

| Aspect | Description |
|--------|-------------|
| What | Application layout and navigation patterns |
| Why | Familiar IDE-like experience, efficient multitasking |
| Where | Entire application |

---

## Layout Structure

```
┌────────────────────────────────────────────────────────────────┐
│                          Title Bar                              │
├──────────┬─────────────────────────────────┬──────────────────┤
│          │         Tab Bar                  │                  │
│          ├─────────────────────────────────┤                  │
│ Sidebar  │                                 │   Right Panel    │
│          │         Main Pane               │                  │
│          │                                 │                  │
│          │                                 │                  │
├──────────┴─────────────────────────────────┴──────────────────┤
│                         Status Bar                             │
└────────────────────────────────────────────────────────────────┘
```

---

## Features

### 1. Tab System ✅

VS Code-style tabs for managing open items.

#### Tab Types
| Type | Icon | Content |
|------|------|---------|
| Workspace | 🏠 | Workspace overview (git status, settings, commits) |
| Chat | 💬 | Conversation with agent |
| File | 📄 | File viewer with syntax highlighting |

**Workspace Tab:**
- Opens when clicking workspace name in sidebar
- Shows WorkspaceOverview (git panel, settings, branch grid)
- One workspace tab per workspace (no duplicates)
- Acts as "home" for the workspace

**Chat Tab:**
- Opens when clicking conversation or starting new chat
- Contains full chat interface with message history
- Multiple chat tabs allowed (different conversations)

**File Tab:**
- Opens when clicking file in tree or Details panel
- Syntax-highlighted file viewer
- Multiple file tabs allowed (different files)

#### Tab Behavior
- Single click opens tab
- Middle click closes tab
- Drag to reorder
- Duplicate tabs prevented
- Active tab highlighted

#### Tab Persistence ✅
- Open tabs saved across sessions
- Restored on app restart
- Stored in `ChorusSettings.openTabs`

**Data Model:**
```typescript
interface Tab {
  id: string
  type: 'workspace' | 'chat' | 'file'
  title: string
  workspaceId: string
  agentId?: string        // For chat tabs
  conversationId?: string // For chat tabs
  filePath?: string       // For file tabs
}
```

**Tab ID Generation:**
- Workspace: `workspace-{workspaceId}`
- Chat: `chat-{conversationId}`
- File: `file-{workspaceId}-{filePath}`

---

### 2. Split Pane View ✅

Dual-pane layout for side-by-side work.

#### Orientations
- **Horizontal:** Left | Right (default)
- **Vertical:** Top | Bottom

#### Features
- Each pane has independent mini tab bar
- Draggable divider (min 150px per pane)
- Drag-and-drop tabs between panes
- Toggle via toolbar button

#### Tab Combinations
- Workspace + Chat (overview while chatting)
- Workspace + File (overview while coding)
- Chat + Chat (compare conversations)
- Chat + File (review while chatting)
- File + File (compare files)

#### Split Pane Toggle
```
[Single Pane] ←→ [Split Pane]
     ⬜              ⬜|⬜
```

**Implementation:**
- `SplitPaneContainer.tsx` - Main split container
- `PaneTabBar.tsx` - Mini tab bar per pane
- `SplitDivider.tsx` - Draggable resize handle
- `DropZoneOverlay.tsx` - Drag-drop visual feedback

---

### 3. Right Panel ✅

Contextual panel that changes based on active tab.

#### For Chat Tabs: Details
Shows conversation insights:
- Files Changed (clickable)
- Todo List (with status)
- Tool Calls (success/failure)
- Context Metrics (tokens, cost)

#### For File Tabs: Files Browser
Shows mini file tree:
- Current workspace files
- Quick navigation
- File type icons

#### Toggle Behavior
- Auto-switches on tab change
- Can be collapsed
- Width adjustable

---

### 4. Sidebar Navigation ✅

Primary navigation for workspaces and agents.

#### Panels

**Workspaces Panel:**
- List of added workspaces
- Collapsible workspace items
- Nested agent list
- Branch selector per workspace

**Conversations Panel:**
- Shown when agent selected
- Grouped by date (Today, Yesterday, etc.)
- New conversation button
- Back button to workspaces

**Files Panel:**
- Full directory tree
- Create new file/folder
- Workspace context only

#### Panel Switching
- Click agent → Shows conversations
- Back button → Returns to workspaces
- Tab buttons → Switch sidebar mode

---

### 5. Workspace Overview ✅

Default view when no tabs open.

**Sections:**
- Workspace info (name, path, branch)
- Git status (uncommitted changes)
- Recent commits
- Branch commits grid
- Workspace settings

**Shown When:**
- Workspace selected, no tabs open
- Click workspace name in sidebar

---

## Navigation Flows

### Open Agent Chat
```
Sidebar: Click Workspace → Click Agent → Click Conversation
Result: Chat tab opens in main pane
```

### Open File
```
Sidebar: Click Files tab → Navigate tree → Click file
Result: File tab opens in main pane
```

### Side-by-Side Review
```
1. Open chat conversation
2. Click file in Details panel "Files Changed"
3. Split pane enables automatically
4. Chat left, file right
```

### Switch Between Tabs
```
Tab bar: Click tab to switch
Keyboard: Ctrl+Tab (next), Ctrl+Shift+Tab (prev)
```

### Close Tab
```
Tab bar: Click X on tab
Keyboard: Ctrl+W
Middle-click: Close tab
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |
| `Ctrl+W` | Close current tab |
| `Escape` | Stop agent (during streaming) |
| `Enter` | Send message |
| `Shift+Enter` | New line in input |

---

## UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `Sidebar` | Left | Navigation container |
| `WorkspacesPanel` | Sidebar | Workspace list |
| `AgentConversationsPanel` | Sidebar | Conversation list |
| `FilesPanel` | Sidebar | File tree |
| `MainPane` | Center | Tab content area |
| `TabBar` | MainPane | Tab list |
| `SplitPaneContainer` | MainPane | Dual pane layout |
| `PaneTabBar` | SplitPane | Mini tab bars |
| `SplitDivider` | SplitPane | Resize handle |
| `RightPanel` | Right | Contextual panel |
| `DetailsSection` | RightPanel | Chat details |
| `FilesSection` | RightPanel | Mini file browser |
| `WorkspaceOverview` | MainPane | Default workspace view |

---

## State Management

**UI Store (`ui-store.ts`):**
```typescript
interface UIState {
  sidebarWidth: number
  rightPanelWidth: number
  rightPanelCollapsed: boolean
  splitPaneEnabled: boolean
  splitOrientation: 'horizontal' | 'vertical'
  splitRatio: number
}
```

**Workspace Store (`workspace-store.ts`):**
```typescript
// Tab management
tabs: Tab[]
activeTabId: string | null
tabGroups: { pane1: string[], pane2: string[] }

// Actions
openTab(tab: Tab)
closeTab(tabId: string)
setActiveTab(tabId: string)
moveTabToPane(tabId: string, pane: 'pane1' | 'pane2')
```

---

## Visual Styling

**Theme:** Dark mode (VS Code-inspired)

**Colors:**
| Element | Color |
|---------|-------|
| Background | `#1e1e1e` |
| Sidebar | `#252526` |
| Active Tab | `#1e1e1e` |
| Inactive Tab | `#2d2d2d` |
| Text Primary | `#cccccc` |
| Text Secondary | `#858585` |
| Accent | `#0078d4` |
| Border | `#3c3c3c` |

**Tailwind Classes:**
- `bg-main` - Main background
- `bg-sidebar` - Sidebar background
- `bg-hover` - Hover state
- `text-primary` - Primary text
- `text-muted` - Secondary text
- `border-default` - Default borders

---

## Related Files

**Stores:**
- `src/renderer/src/stores/ui-store.ts` - UI state
- `src/renderer/src/stores/workspace-store.ts` - Tab state

**Components:**
- `src/renderer/src/components/Sidebar/Sidebar.tsx`
- `src/renderer/src/components/MainPane/MainPane.tsx`
- `src/renderer/src/components/MainPane/TabBar.tsx`
- `src/renderer/src/components/MainPane/SplitPaneContainer.tsx`
- `src/renderer/src/components/RightPanel/RightPanel.tsx`

**Styles:**
- `src/renderer/src/assets/main.css` - Tailwind config
