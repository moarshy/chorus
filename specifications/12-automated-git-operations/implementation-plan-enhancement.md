# Implementation Plan: Git Operations Enhancements

## Overview

This plan implements the P1 priority enhancements from `feature-enhancement.md`:
- E-1: Inline Diff Viewer
- E-2: Branch Comparison Target Selection
- E-3: Merge Preview with Conflict Detection
- E-6: Push Error Display

---

## Phase 1: Inline Diff Viewer (E-1)

### 1.1 Create DiffHunkViewer Component

**File:** `chorus/src/renderer/src/components/MainPane/DiffHunkViewer.tsx`

```tsx
interface DiffHunkViewerProps {
  hunks: DiffHunk[]
  language: string  // For syntax highlighting
}

export function DiffHunkViewer({ hunks, language }: DiffHunkViewerProps) {
  return (
    <div className="font-mono text-xs bg-surface rounded overflow-hidden">
      {hunks.map((hunk, i) => (
        <div key={i} className="border-b border-default last:border-0">
          {/* Hunk header */}
          <div className="bg-input px-2 py-1 text-muted">
            @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
          </div>
          {/* Lines */}
          <div className="whitespace-pre overflow-x-auto">
            {parseDiffLines(hunk.content).map((line, j) => (
              <DiffLine key={j} line={line} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function DiffLine({ line }: { line: DiffLineData }) {
  const bgClass = line.type === 'add' ? 'bg-green-500/10'
                : line.type === 'del' ? 'bg-red-500/10'
                : ''
  const textClass = line.type === 'add' ? 'text-green-400'
                  : line.type === 'del' ? 'text-red-400'
                  : 'text-primary'

  return (
    <div className={`flex ${bgClass}`}>
      <span className="w-12 text-right px-2 text-muted select-none border-r border-default">
        {line.oldNum || ''}
      </span>
      <span className="w-12 text-right px-2 text-muted select-none border-r border-default">
        {line.newNum || ''}
      </span>
      <span className={`flex-1 px-2 ${textClass}`}>
        {line.content}
      </span>
    </div>
  )
}
```

### 1.2 Update AgentSessionsPanel for Expandable Diffs

**File:** `chorus/src/renderer/src/components/MainPane/AgentSessionsPanel.tsx`

Add state for expanded files:

```typescript
const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

const toggleFileExpand = (filePath: string) => {
  setExpandedFiles(prev => {
    const next = new Set(prev)
    if (next.has(filePath)) {
      next.delete(filePath)
    } else {
      next.add(filePath)
    }
    return next
  })
}
```

Update the diff display section to include inline hunks:

```tsx
{diffData.files.map((file) => (
  <div key={file.filePath}>
    <button
      onClick={() => toggleFileExpand(file.filePath)}
      className="w-full flex items-center gap-2 text-xs p-1.5 rounded bg-hover/50"
    >
      <span className="text-muted">
        {expandedFiles.has(file.filePath) ? '▼' : '▶'}
      </span>
      <span className={statusColorClass(file.status)}>
        {statusChar(file.status)}
      </span>
      <span className="flex-1 truncate font-mono">{file.filePath}</span>
      <span className="text-green-400">+{file.additions}</span>
      <span className="text-red-400">-{file.deletions}</span>
    </button>

    {expandedFiles.has(file.filePath) && file.hunks.length > 0 && (
      <div className="ml-6 mt-1 mb-2">
        <DiffHunkViewer
          hunks={file.hunks}
          language={getLanguageFromPath(file.filePath)}
        />
      </div>
    )}
  </div>
))}
```

### 1.3 Add "Expand All" / "Collapse All" Buttons

```tsx
<div className="flex items-center justify-between mb-2">
  <h4 className="text-xs font-semibold text-secondary">
    Changed Files ({diffData.files.length})
  </h4>
  <div className="flex gap-2">
    <button
      onClick={() => setExpandedFiles(new Set(diffData.files.map(f => f.filePath)))}
      className="text-xs text-muted hover:text-primary"
    >
      Expand All
    </button>
    <button
      onClick={() => setExpandedFiles(new Set())}
      className="text-xs text-muted hover:text-primary"
    >
      Collapse All
    </button>
  </div>
</div>
```

---

## Phase 2: Branch Comparison Target (E-2)

### 2.1 Add Comparison Branch State

**File:** `chorus/src/renderer/src/components/MainPane/AgentSessionsPanel.tsx`

```typescript
interface AgentSessionsPanelProps {
  workspacePath: string
  onBranchChange: () => void
}

export function AgentSessionsPanel({ workspacePath, onBranchChange }: AgentSessionsPanelProps) {
  // ... existing state ...
  const [comparisonBranch, setComparisonBranch] = useState<string>('main')
  const [availableBranches, setAvailableBranches] = useState<string[]>([])

  // Load available branches for comparison dropdown
  useEffect(() => {
    loadAvailableBranches()
  }, [workspacePath])

  const loadAvailableBranches = async () => {
    const result = await window.api.git.listBranches(workspacePath)
    if (result.success && result.data) {
      const locals = result.data
        .filter(b => !b.isRemote)
        .map(b => b.name)
        .filter(n => !n.startsWith('agent/'))
      setAvailableBranches(locals)

      // Set default comparison branch
      if (locals.includes('main')) {
        setComparisonBranch('main')
      } else if (locals.includes('master')) {
        setComparisonBranch('master')
      } else if (locals.length > 0) {
        setComparisonBranch(locals[0])
      }
    }
  }
```

### 2.2 Add Comparison Branch Dropdown

```tsx
{/* Comparison branch selector - shown when diff is visible */}
{diffData && (
  <div className="flex items-center gap-2 text-xs text-muted mb-2">
    <span>Comparing to:</span>
    <select
      value={comparisonBranch}
      onChange={(e) => {
        setComparisonBranch(e.target.value)
        // Re-fetch diff with new comparison branch
        handleViewChanges(diffData.branch, e.target.value)
      }}
      className="bg-input border border-default rounded px-2 py-1 text-primary"
    >
      {availableBranches.map(branch => (
        <option key={branch} value={branch}>{branch}</option>
      ))}
    </select>
  </div>
)}
```

### 2.3 Update handleViewChanges

```typescript
const handleViewChanges = async (branchName: string, baseBranch?: string) => {
  // If already showing diff for this branch, hide it
  if (diffData?.branch === branchName && !baseBranch) {
    setDiffData(null)
    return
  }

  setActionInProgress(branchName)

  const targetBaseBranch = baseBranch || comparisonBranch

  const result = await window.api.git.getDiffBetweenBranches(
    workspacePath,
    targetBaseBranch,
    branchName
  )

  if (result.success && result.data) {
    setDiffData({ branch: branchName, files: result.data, baseBranch: targetBaseBranch })
  } else {
    setDiffData({ branch: branchName, files: [], error: result.error })
  }
  setActionInProgress(null)
}
```

---

## Phase 3: Merge Preview (E-3)

### 3.1 Create MergePreviewDialog Component

**File:** `chorus/src/renderer/src/components/dialogs/MergePreviewDialog.tsx`

```tsx
interface MergePreviewDialogProps {
  sourceBranch: string
  targetBranch: string
  workspacePath: string
  onConfirm: (options: { squash: boolean }) => void
  onCancel: () => void
}

interface MergePreviewData {
  files: FileDiff[]
  behindCount: number  // How many commits target is ahead
  conflicts: string[]  // Files that might conflict
}

export function MergePreviewDialog({
  sourceBranch,
  targetBranch,
  workspacePath,
  onConfirm,
  onCancel
}: MergePreviewDialogProps) {
  const [preview, setPreview] = useState<MergePreviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [squash, setSquash] = useState(true)

  useEffect(() => {
    loadPreview()
  }, [])

  const loadPreview = async () => {
    setLoading(true)

    // Get diff
    const diffResult = await window.api.git.getDiffBetweenBranches(
      workspacePath,
      targetBranch,
      sourceBranch
    )

    // Check how far behind source is from target
    const behindResult = await window.api.git.getCommitsBehind(
      workspacePath,
      sourceBranch,
      targetBranch
    )

    // Check for potential conflicts (files modified in both)
    const conflictsResult = await window.api.git.checkMergeConflicts(
      workspacePath,
      sourceBranch,
      targetBranch
    )

    setPreview({
      files: diffResult.success ? diffResult.data : [],
      behindCount: behindResult.success ? behindResult.data : 0,
      conflicts: conflictsResult.success ? conflictsResult.data : []
    })
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-[10%] z-50">
      <div className="bg-surface border border-default rounded shadow-lg w-[500px] max-h-[70vh] flex flex-col">
        <div className="p-4 border-b border-default">
          <h2 className="text-lg font-semibold">
            Merge Preview: {sourceBranch} → {targetBranch}
          </h2>
        </div>

        {loading ? (
          <div className="p-4 text-muted">Analyzing merge...</div>
        ) : preview && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Warning if target has moved */}
            {preview.behindCount > 0 && (
              <div className="flex items-start gap-2 p-3 rounded bg-yellow-500/10 border border-yellow-500/30">
                <span className="text-yellow-400">⚠</span>
                <div className="text-sm">
                  <p className="font-medium text-yellow-400">
                    {targetBranch} has {preview.behindCount} new commit(s)
                  </p>
                  <p className="text-muted">
                    Changes were made after this branch was created
                  </p>
                </div>
              </div>
            )}

            {/* Conflict warning */}
            {preview.conflicts.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded bg-red-500/10 border border-red-500/30">
                <span className="text-red-400">⚠</span>
                <div className="text-sm">
                  <p className="font-medium text-red-400">
                    Potential conflicts in {preview.conflicts.length} file(s)
                  </p>
                  <ul className="text-muted font-mono mt-1">
                    {preview.conflicts.map(f => <li key={f}>• {f}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {/* Files to merge */}
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Files to be merged ({preview.files.length})
              </h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {preview.files.map(file => (
                  <div key={file.filePath} className="flex items-center gap-2 text-xs">
                    <span className={
                      preview.conflicts.includes(file.filePath)
                        ? 'text-yellow-400'
                        : 'text-green-400'
                    }>
                      {preview.conflicts.includes(file.filePath) ? '⚠' : '✓'}
                    </span>
                    <span className="font-mono">{file.filePath}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Merge options */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Merge Options</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={squash}
                  onChange={() => setSquash(true)}
                  className="w-4 h-4"
                />
                <span>Squash merge (recommended)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="radio"
                  checked={!squash}
                  onChange={() => setSquash(false)}
                  className="w-4 h-4"
                />
                <span>Regular merge (preserves history)</span>
              </label>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-default flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded border border-default hover:bg-hover"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ squash })}
            disabled={loading || (preview?.conflicts.length || 0) > 0}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            Proceed with Merge
          </button>
        </div>
      </div>
    </div>
  )
}
```

### 3.2 Add Backend Functions for Merge Analysis

**File:** `chorus/src/main/services/git-service.ts`

```typescript
/**
 * Get count of commits that target branch has ahead of source
 */
export async function getCommitsBehind(
  path: string,
  sourceBranch: string,
  targetBranch: string
): Promise<number> {
  try {
    // Count commits in target that aren't in source
    const output = runGit(path, `rev-list --count ${sourceBranch}..${targetBranch}`)
    return parseInt(output, 10)
  } catch {
    return 0
  }
}

/**
 * Check for files that are modified in both branches (potential conflicts)
 */
export async function checkMergeConflicts(
  path: string,
  sourceBranch: string,
  targetBranch: string
): Promise<string[]> {
  try {
    // Get merge base
    const mergeBase = runGit(path, `merge-base ${sourceBranch} ${targetBranch}`)

    // Files changed in source since merge base
    const sourceFiles = runGit(path, `diff --name-only ${mergeBase} ${sourceBranch}`)
      .split('\n').filter(Boolean)

    // Files changed in target since merge base
    const targetFiles = runGit(path, `diff --name-only ${mergeBase} ${targetBranch}`)
      .split('\n').filter(Boolean)

    // Intersection = potential conflicts
    return sourceFiles.filter(f => targetFiles.includes(f))
  } catch {
    return []
  }
}
```

### 3.3 Add IPC Handlers

**File:** `chorus/src/main/index.ts`

```typescript
ipcMain.handle('git:get-commits-behind', async (_event, path: string, source: string, target: string) => {
  try {
    const count = await getCommitsBehind(path, source, target)
    return { success: true, data: count }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('git:check-merge-conflicts', async (_event, path: string, source: string, target: string) => {
  try {
    const conflicts = await checkMergeConflicts(path, source, target)
    return { success: true, data: conflicts }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})
```

### 3.4 Update Preload Bridge

**File:** `chorus/src/preload/index.ts`

```typescript
git: {
  // ... existing ...
  getCommitsBehind: (path: string, source: string, target: string) =>
    ipcRenderer.invoke('git:get-commits-behind', path, source, target),
  checkMergeConflicts: (path: string, source: string, target: string) =>
    ipcRenderer.invoke('git:check-merge-conflicts', path, source, target),
}
```

### 3.5 Update handleMerge in AgentSessionsPanel

```typescript
const [mergePreview, setMergePreview] = useState<{ branch: string } | null>(null)

const handleMergeClick = (branchName: string) => {
  // Open preview dialog instead of merging directly
  setMergePreview({ branch: branchName })
}

const handleMergeConfirm = async (options: { squash: boolean }) => {
  if (!mergePreview) return

  const branchName = mergePreview.branch
  setMergePreview(null)
  setActionInProgress(branchName)

  // ... existing merge logic with options.squash ...
}

// In render:
{mergePreview && (
  <MergePreviewDialog
    sourceBranch={mergePreview.branch}
    targetBranch={comparisonBranch}
    workspacePath={workspacePath}
    onConfirm={handleMergeConfirm}
    onCancel={() => setMergePreview(null)}
  />
)}
```

---

## Phase 4: Push Error Display (E-6)

### 4.1 Create Better Push Error Handling

**File:** `chorus/src/renderer/src/components/MainPane/AgentSessionsPanel.tsx`

```typescript
const [pushError, setPushError] = useState<{ branch: string; message: string; suggestion: string } | null>(null)

const handlePush = async (branchName: string) => {
  setActionInProgress(branchName)
  setPushSuccess(null)
  setPushError(null)

  const result = await window.api.git.push(workspacePath, branchName, { setUpstream: true })

  if (result.success) {
    setPushSuccess(branchName)
    setTimeout(() => setPushSuccess(null), 3000)
  } else {
    // Parse error and provide helpful message
    const error = result.error || 'Unknown error'
    let suggestion = 'Try again or check terminal for details'

    if (error.includes('rejected') || error.includes('non-fast-forward')) {
      suggestion = 'Remote has new changes. Pull first, then push.'
    } else if (error.includes('remote') && error.includes('not found')) {
      suggestion = 'No remote "origin" configured. Add a remote first.'
    } else if (error.includes('permission') || error.includes('auth')) {
      suggestion = 'Check your Git credentials or SSH key.'
    } else if (error.includes('could not read Username')) {
      suggestion = 'Git authentication required. Run "git push" in terminal first.'
    }

    setPushError({ branch: branchName, message: error, suggestion })
    setTimeout(() => setPushError(null), 10000)
  }

  setActionInProgress(null)
}
```

### 4.2 Display Push Error Inline

```tsx
{/* Push error display */}
{pushError?.branch === branch.name && (
  <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/30 text-xs">
    <p className="text-red-400 font-medium">Push failed</p>
    <p className="text-muted mt-1">{pushError.message}</p>
    <p className="text-secondary mt-1">💡 {pushError.suggestion}</p>
  </div>
)}
```

---

## Testing Plan

### Unit Tests

1. **DiffHunkViewer**
   - Renders additions in green
   - Renders deletions in red
   - Shows line numbers correctly
   - Handles empty hunks

2. **Merge Analysis Functions**
   - `getCommitsBehind` returns correct count
   - `checkMergeConflicts` identifies overlapping files
   - Handles edge cases (no merge base, identical branches)

### Integration Tests

1. **View Changes Flow**
   - Click file → expands inline diff
   - Change comparison branch → diff updates
   - Expand All / Collapse All work

2. **Merge Preview Flow**
   - Shows correct files
   - Detects potential conflicts
   - Shows behind count
   - Squash/regular merge options work

3. **Push Error Flow**
   - Rejected push shows helpful message
   - Auth error shows correct suggestion
   - Error auto-dismisses after timeout

### Manual Testing Checklist

- [ ] Inline diff shows correctly for modified files
- [ ] Inline diff shows correctly for new files
- [ ] Inline diff shows correctly for deleted files
- [ ] Syntax highlighting works for common languages
- [ ] Comparison branch dropdown appears and works
- [ ] Changing comparison branch updates diff
- [ ] Merge preview shows for all branches
- [ ] Conflict detection identifies overlapping changes
- [ ] Behind count shows when target has new commits
- [ ] Push error shows helpful message for common errors

---

## File Summary

| File | Changes |
|------|---------|
| `git-service.ts` | Add `getCommitsBehind`, `checkMergeConflicts` |
| `main/index.ts` | Add 2 new IPC handlers |
| `preload/index.ts` | Expose 2 new git methods |
| `preload/index.d.ts` | Add types for new methods |
| `DiffHunkViewer.tsx` | New component |
| `MergePreviewDialog.tsx` | New component |
| `AgentSessionsPanel.tsx` | Add inline diff, comparison selector, preview |
| `types/index.ts` | Add DiffLineData type |

---

## Implementation Order

1. **Sprint 1: Inline Diff** (E-1)
   - [ ] Create DiffHunkViewer component
   - [ ] Add expand/collapse to file list
   - [ ] Add Expand All / Collapse All buttons
   - [ ] Test with various file types

2. **Sprint 2: Comparison & Preview** (E-2, E-3)
   - [ ] Add comparison branch dropdown
   - [ ] Add backend merge analysis functions
   - [ ] Create MergePreviewDialog
   - [ ] Update merge flow to use preview

3. **Sprint 3: Error Handling** (E-6)
   - [ ] Implement push error parsing
   - [ ] Add helpful suggestions
   - [ ] Display errors inline
   - [ ] Test common error scenarios
