# File Browser

Chorus includes a built-in file browser for navigating workspace files without leaving the app.

---

## Overview

| Aspect | Description |
|--------|-------------|
| What | Directory tree and file viewer |
| Why | Review agent changes, navigate code, no context switching |
| Where | Sidebar (Files panel), MainPane (file tabs), RightPanel (mini browser) |

---

## Features

### 1. Directory Tree ✅

Hierarchical file system navigation.

**Display:**
- Expandable folder structure
- File/folder icons by type
- Sorted: folders first, then files alphabetically

**File Type Icons:**
| Type | Files |
|------|-------|
| TypeScript | `.ts`, `.tsx` |
| JavaScript | `.js`, `.jsx` |
| JSON | `.json` |
| Markdown | `.md` |
| Config | `.yml`, `.yaml`, `.toml` |
| Git | `.gitignore` |
| Folder | directories |
| Default | other files |

**Interactions:**
- Click folder → Expand/collapse
- Click file → Open in file tab
- Expansion state persisted

**Implementation:**
- `FileTree.tsx` - Main tree component
- `FileTreeNode.tsx` - Recursive node renderer
- `file-tree-store.ts` - Expansion state

---

### 2. File Viewer ✅

View files with syntax highlighting.

**Features:**
- Syntax highlighting for 50+ languages
- Line numbers
- Copy button for code blocks
- Read-only display

**Supported Languages:**
TypeScript, JavaScript, Python, Rust, Go, Java, C/C++, Ruby, PHP, CSS, HTML, SQL, Shell, YAML, JSON, Markdown, and more.

**Implementation:**
- `FileViewer.tsx` - Main viewer component
- `prism-react-renderer` - Syntax highlighting

---

### 3. Create New File/Folder ✅

Create files and folders from UI.

#### Via Header Button
1. Select workspace
2. Click "New File" or "New Folder" in Files panel header
3. Enter name in prompt
4. File/folder created at workspace root

#### Via Context Menu
1. Right-click on folder in tree
2. Select "New File" or "New Folder"
3. Enter name in prompt
4. Created inside selected folder

**Validation:**
- Name cannot be empty
- Name cannot contain path separators
- Confirms overwrite if exists (files only)

---

### 4. Context Menus ✅

Right-click actions on files/folders.

**Folder Context Menu:**
- New File
- New Folder

**File Context Menu:**
- (Future: Rename, Delete, Copy Path)

---

### 5. File Tree Refresh ✅

Auto-refresh after file system changes.

**Triggers:**
- Git branch checkout
- Git discard changes
- Agent file changes (Write/Edit tools)

**Implementation:**
- `file-tree-store.ts` - `triggerRefresh()` action
- Components subscribe to `refreshTrigger`

---

## Locations

The file browser appears in three places:

### 1. Sidebar Files Panel
- Full workspace file tree
- Primary navigation
- Create new file/folder buttons

### 2. MainPane File Tabs
- Individual file viewer
- Opened when clicking file in tree
- Syntax highlighted content

### 3. RightPanel Mini Browser
- Contextual file browser
- Shows when file tab is active
- Smaller, focused view

---

## Data Model

```typescript
interface FileItem {
  name: string
  path: string           // Relative to workspace
  absolutePath: string   // Full system path
  isDirectory: boolean
  children?: FileItem[]  // For directories
}
```

---

## UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `FileTree` | Sidebar | Main tree display |
| `FileTreeNode` | FileTree | Single file/folder row |
| `FileViewer` | MainPane | File content display |
| `FilesSection` | RightPanel | Mini file browser |
| `FilesPanel` | Sidebar | Files tab container |

---

## IPC Handlers

| Handler | Purpose |
|---------|---------|
| `fs:readDir` | List directory contents |
| `fs:readFile` | Get file content |
| `fs:writeFile` | Create/update file |
| `fs:createDirectory` | Create folder |
| `fs:exists` | Check if path exists |

---

## User Flows

### Browse Files
1. Click "Files" tab in sidebar
2. Expand folders to navigate
3. Click file to open in tab

### Create New File
1. Right-click on folder
2. Select "New File"
3. Enter filename
4. File created and ready

### View Agent Changes
1. Agent makes file changes
2. Click file in Details panel "Files Changed"
3. File opens in tab
4. Review changes

### Split View: Code + Chat
1. Open chat conversation
2. Click file in Details panel
3. Split pane opens with file
4. Chat on left, file on right

---

## Related Files

**Services:**
- `src/main/services/fs-service.ts` - File system operations

**Store:**
- `src/renderer/src/stores/file-tree-store.ts` - Tree state
- `src/renderer/src/stores/workspace-store.ts` - Tab management

**Components:**
- `src/renderer/src/components/Sidebar/FileTree.tsx`
- `src/renderer/src/components/Sidebar/FilesPanel.tsx`
- `src/renderer/src/components/MainPane/FileViewer.tsx`
- `src/renderer/src/components/RightPanel/FilesSection.tsx`
