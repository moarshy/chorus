# Git Operations

Chorus integrates Git for version control, branch management, and change tracking within workspaces.

---

## Overview

| Aspect | Description |
|--------|-------------|
| What | Git integration for workspaces |
| Why | Track changes, manage branches, review agent work |
| Where | Sidebar (branch selector), Workspace Overview, Changes Panel |

---

## Features

### 1. Branch Management ✅

Full branch lifecycle within Chorus.

#### Branch Selector ✅
- Dropdown in sidebar showing current branch
- Lists local and remote branches separately
- Quick branch switching

**Location:** Sidebar, under workspace name

#### Branch Checkout ✅
- Switch between branches
- Remote branches create local tracking branch
- File tree refreshes after checkout

**User Flow:**
1. Click branch selector in sidebar
2. Select branch from dropdown
3. Files update to reflect new branch

#### Branch Deletion ✅
- Delete local branches (not current)
- Confirmation dialog before delete
- Force delete for unmerged branches

**User Flow:**
1. Click branch selector
2. Hover over branch → Trash icon appears
3. Click trash → Confirmation dialog
4. Confirm → Branch deleted

#### Remote Branch Tracking ✅
- Shows remote branches (origin/*)
- Checkout creates local tracking branch
- Automatically set up upstream

---

### 2. Changes Tracking ✅

View and manage uncommitted changes.

#### Uncommitted Changes Panel ✅
- Shows files with pending changes
- Status icons: Modified (M), Added (A), Deleted (D), Untracked (?)
- Located in Workspace Overview

**Display:**
- First 10 files shown
- "+N more files" for overflow
- Hover reveals action buttons

#### Stage Changes ✅
- Stage individual files for commit
- Click "+" icon on file row
- Staged files ready for commit

#### Discard Changes ✅
- Revert file to last commit state
- Confirmation dialog (destructive action)
- Different messages for M/A/D status

**Confirmation Messages:**
- Modified: "This will revert changes to the last commit."
- Added/Untracked: "This will delete the untracked file."
- Deleted: "This will restore the deleted file."

#### Dirty State Indicators ✅
- Visual indicator when workspace has uncommitted changes
- Badge/dot on workspace item
- Encourages regular commits

---

### 3. Commits ✅

View commit history.

#### Recent Commits View ✅
- Shows last 10 commits
- Displays: hash (short), message, author, date
- Located in Workspace Overview

#### Branch Commits Grid ✅
- 5-column grid showing multiple branches
- 10 commits per branch
- Pagination for more commits

**Layout:**
```
┌─────────┬─────────┬─────────┬─────────┬─────────┐
│  main   │ dev/xyz │ feat/a  │ feat/b  │ origin/ │
├─────────┼─────────┼─────────┼─────────┼─────────┤
│ commit1 │ commit1 │ commit1 │ commit1 │ commit1 │
│ commit2 │ commit2 │ commit2 │ commit2 │ commit2 │
│ ...     │ ...     │ ...     │ ...     │ ...     │
└─────────┴─────────┴─────────┴─────────┴─────────┘
```

**Features:**
- Click branch header to checkout
- Horizontal scroll if > 5 branches
- Pagination arrows for more commits

---

### 4. Automated Git Operations ✅

Agent-driven Git automation with GitButler-style branch management.

#### Auto-Branch per Session ✅
- Creates `agent/{agentName}/{sessionShortId}` branch
- Automatically on first file change
- Isolates agent work from main branch

#### Auto-Commit per Turn ✅
- Commits after each conversation turn
- Message format: `[Agent] {prompt}`
- Only if files changed

#### Commit on Stop ✅
- Commits any uncommitted changes when agent stops
- Ensures work isn't lost
- Message: `[Agent] Work in progress`

#### Agent Sessions Panel ✅
- Visual list of agent branches in workspace
- Quick actions: checkout, view changes, push, merge, delete
- Shows commit count, agent name, and last activity per branch

**Features:**
- **View Changes:** Shows diff vs comparison branch with inline diff viewer
- **Comparison Selector:** Choose which branch to compare against (default: main/master)
- **Inline Diff Viewer:** Expandable file rows showing line-by-line code changes
- **Push:** Push branch to remote with upstream tracking
- **Merge Preview:** Shows files to be merged, conflict detection, squash/regular options
- **Delete:** Remove agent branch with confirmation

**Location:** Workspace Overview → Git tab → Agent Sessions section

#### Push Error Handling ✅
- Helpful error messages with actionable suggestions
- Handles: rejected push, no remote, auth required
- Auto-dismisses after 10 seconds

---

## Data Model

```typescript
interface GitStatus {
  branch: string
  ahead: number
  behind: number
  changes: GitChange[]
}

interface GitChange {
  file: string
  status: 'M' | 'A' | 'D' | '?' | 'R'  // Modified, Added, Deleted, Untracked, Renamed
}

interface GitCommit {
  hash: string
  message: string
  author: string
  date: string
}

interface GitBranch {
  name: string
  isCurrent: boolean
  isRemote: boolean
}
```

---

## UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `BranchSelector` | Sidebar | Branch dropdown |
| `BranchCommitsGrid` | WorkspaceOverview | Multi-branch commit view |
| `ChangesPanel` | WorkspaceOverview | Uncommitted changes |
| `GitPanel` | WorkspaceOverview | Combined git info |
| `AgentSessionsPanel` | WorkspaceOverview | Agent branch management |
| `DiffHunkViewer` | AgentSessionsPanel | Inline diff display |
| `MergePreviewDialog` | Dialog | Merge preview with conflict detection |

---

## IPC Handlers

| Handler | Purpose |
|---------|---------|
| `git:status` | Get current status (branch, changes) |
| `git:listBranches` | List all local/remote branches |
| `git:checkout` | Switch to branch |
| `git:deleteBranch` | Delete local branch |
| `git:stageFile` | Stage file for commit |
| `git:discardChanges` | Revert file to last commit |
| `git:log` | Get commit history |
| `git:clone` | Clone repository (with progress) |
| `git:get-agent-branches` | List agent session branches |
| `git:get-diff-between-branches` | Get diff between two branches |
| `git:push` | Push branch to remote |
| `git:merge` | Merge branch into current |
| `git:analyze-merge` | Analyze merge for preview (E-3) |

---

## User Flows

### Switch Branch
1. Click branch selector in sidebar
2. Select target branch
3. Files update to new branch

### Discard Unwanted Changes
1. Open Workspace Overview
2. Find file in Changes Panel
3. Click discard icon (↩)
4. Confirm in dialog
5. File reverts to last commit

### Review Branch History
1. Open Workspace Overview
2. Scroll to Branch Commits Grid
3. Browse commits across branches
4. Click branch header to checkout

### Delete Feature Branch
1. Click branch selector
2. Hover over branch to delete
3. Click trash icon
4. Confirm deletion

---

## Related Files

**Services:**
- `src/main/services/git-service.ts` - All git operations (including merge analysis)

**Components:**
- `src/renderer/src/components/Sidebar/BranchSelector.tsx`
- `src/renderer/src/components/MainPane/BranchCommitsGrid.tsx`
- `src/renderer/src/components/MainPane/ChangesPanel.tsx`
- `src/renderer/src/components/MainPane/WorkspaceOverview.tsx`
- `src/renderer/src/components/MainPane/AgentSessionsPanel.tsx` - Agent branch management
- `src/renderer/src/components/MainPane/DiffHunkViewer.tsx` - Inline diff display
- `src/renderer/src/components/dialogs/MergePreviewDialog.tsx` - Merge preview

**Store:**
- `src/renderer/src/stores/file-tree-store.ts` - Refresh trigger after git ops

**Specifications:**
- `specifications/12-automated-git-operations/` - Original spec
- `specifications/12-automated-git-operations/feature-enhancement.md` - P1-P3 enhancements
- `specifications/12-automated-git-operations/testing-plan.md` - Testing guide
