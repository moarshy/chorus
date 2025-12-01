# Implementation Plan: Automated Git Operations

## Overview

This plan implements GitButler-style automatic git management for agent sessions, providing branch-per-session and commit-on-stop functionality natively in Chorus.

## Phase 1: Core Git Service Extensions

### 1.1 Add New Git Functions

**File:** `chorus/src/main/services/git-service.ts`

```typescript
// New exports to add:

/**
 * Create a new branch from current HEAD
 */
export async function createBranch(path: string, branchName: string): Promise<void> {
  runGit(path, `checkout -b ${branchName}`)
}

/**
 * Stage all changes
 */
export async function stageAll(path: string): Promise<void> {
  runGit(path, 'add -A')
}

/**
 * Stage specific files
 */
export async function stageFiles(path: string, files: string[]): Promise<void> {
  const escapedFiles = files.map(f => `"${f}"`).join(' ')
  runGit(path, `add ${escapedFiles}`)
}

/**
 * Commit staged changes
 * Returns commit hash
 */
export async function commit(path: string, message: string): Promise<string> {
  // Use heredoc-style for multiline messages
  const escapedMessage = message.replace(/"/g, '\\"')
  runGit(path, `commit -m "${escapedMessage}"`)
  return runGit(path, 'rev-parse HEAD')
}

/**
 * Get diff for uncommitted changes or specific commit
 */
export async function getDiff(
  path: string,
  commitHash?: string
): Promise<string> {
  if (commitHash) {
    return runGit(path, `show ${commitHash} --format="" --patch`)
  }
  return runGit(path, 'diff')
}

/**
 * Get structured diff with file-level breakdown
 */
export interface FileDiff {
  filePath: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  additions: number
  deletions: number
  hunks: DiffHunk[]
}

export interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  content: string
}

export async function getStructuredDiff(
  path: string,
  commitHash?: string
): Promise<FileDiff[]> {
  const diff = await getDiff(path, commitHash)
  return parseDiff(diff) // Implement diff parser
}

/**
 * Merge a branch into current branch
 */
export async function merge(
  path: string,
  sourceBranch: string,
  options?: { squash?: boolean; noCommit?: boolean }
): Promise<void> {
  let args = `merge ${sourceBranch}`
  if (options?.squash) args += ' --squash'
  if (options?.noCommit) args += ' --no-commit'
  runGit(path, args)
}

/**
 * Delete a branch
 */
export async function deleteBranch(
  path: string,
  branchName: string,
  force?: boolean
): Promise<void> {
  const flag = force ? '-D' : '-d'
  runGit(path, `branch ${flag} ${branchName}`)
}

/**
 * Check if branch exists
 */
export async function branchExists(path: string, branchName: string): Promise<boolean> {
  try {
    runGit(path, `rev-parse --verify ${branchName}`)
    return true
  } catch {
    return false
  }
}

/**
 * Get all agent branches (matching agent/* pattern)
 */
export interface AgentBranchInfo {
  name: string
  agentName: string
  sessionId: string
  lastCommitDate: string
  commitCount: number
  isCurrent: boolean
}

export async function getAgentBranches(path: string): Promise<AgentBranchInfo[]> {
  const branches = await listBranches(path)
  const agentBranches = branches.filter(b => b.name.startsWith('agent/'))

  const results: AgentBranchInfo[] = []
  for (const branch of agentBranches) {
    // Parse branch name: agent/{agentName}/{sessionId}
    const parts = branch.name.split('/')
    if (parts.length >= 3) {
      const agentName = parts[1]
      const sessionId = parts.slice(2).join('/')

      // Get commit count and last commit date
      const countOutput = runGit(path, `rev-list --count ${branch.name}`)
      const dateOutput = runGit(path, `log -1 --format=%ai ${branch.name}`)

      results.push({
        name: branch.name,
        agentName,
        sessionId,
        lastCommitDate: dateOutput,
        commitCount: parseInt(countOutput, 10),
        isCurrent: branch.isCurrent
      })
    }
  }

  return results.sort((a, b) =>
    new Date(b.lastCommitDate).getTime() - new Date(a.lastCommitDate).getTime()
  )
}

/**
 * Stash current changes
 */
export async function stash(path: string, message?: string): Promise<void> {
  const args = message ? `stash push -m "${message}"` : 'stash'
  runGit(path, args)
}

/**
 * Pop stashed changes
 */
export async function stashPop(path: string): Promise<void> {
  runGit(path, 'stash pop')
}
```

### 1.2 Add IPC Handlers

**File:** `chorus/src/main/index.ts`

```typescript
// Add new handlers in the git namespace:

ipcMain.handle('git:create-branch', async (_event, path: string, branchName: string) => {
  try {
    await createBranch(path, branchName)
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('git:commit', async (_event, path: string, message: string) => {
  try {
    await stageAll(path)
    const hash = await commit(path, message)
    return { success: true, data: hash }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('git:get-diff', async (_event, path: string, commitHash?: string) => {
  try {
    const diff = await getStructuredDiff(path, commitHash)
    return { success: true, data: diff }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('git:merge', async (_event, path: string, sourceBranch: string, options?: { squash?: boolean }) => {
  try {
    await merge(path, sourceBranch, options)
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('git:delete-branch', async (_event, path: string, branchName: string) => {
  try {
    await deleteBranch(path, branchName)
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('git:get-agent-branches', async (_event, path: string) => {
  try {
    const branches = await getAgentBranches(path)
    return { success: true, data: branches }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('git:stash', async (_event, path: string, message?: string) => {
  try {
    await stash(path, message)
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('git:stash-pop', async (_event, path: string) => {
  try {
    await stashPop(path)
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})
```

### 1.3 Update Preload Bridge

**File:** `chorus/src/preload/index.ts`

```typescript
// Add to git namespace:
git: {
  // ... existing methods ...
  createBranch: (path: string, branchName: string) =>
    ipcRenderer.invoke('git:create-branch', path, branchName),
  commit: (path: string, message: string) =>
    ipcRenderer.invoke('git:commit', path, message),
  getDiff: (path: string, commitHash?: string) =>
    ipcRenderer.invoke('git:get-diff', path, commitHash),
  merge: (path: string, sourceBranch: string, options?: { squash?: boolean }) =>
    ipcRenderer.invoke('git:merge', path, sourceBranch, options),
  deleteBranch: (path: string, branchName: string) =>
    ipcRenderer.invoke('git:delete-branch', path, branchName),
  getAgentBranches: (path: string) =>
    ipcRenderer.invoke('git:get-agent-branches', path),
  stash: (path: string, message?: string) =>
    ipcRenderer.invoke('git:stash', path, message),
  stashPop: (path: string) =>
    ipcRenderer.invoke('git:stash-pop', path),
}
```

## Phase 2: Agent SDK Integration

### 2.1 Auto-Branch on Session Start

**File:** `chorus/src/main/services/agent-sdk-service.ts`

```typescript
// Add at top of file:
import * as gitService from './git-service'

// Track which conversations have branches
const conversationBranches: Map<string, string> = new Map()

// Generate branch name for agent session
function generateAgentBranchName(agentName: string, sessionId: string): string {
  const sanitizedAgentName = agentName.toLowerCase().replace(/[^a-z0-9]/g, '-')
  const shortSessionId = sessionId.slice(0, 7)
  return `agent/${sanitizedAgentName}/${shortSessionId}`
}

// In sendMessageSDK function, after session is established:
async function ensureAgentBranch(
  conversationId: string,
  sessionId: string,
  agentName: string,
  repoPath: string,
  mainWindow: BrowserWindow
): Promise<string | null> {
  // Check if we already have a branch for this conversation
  if (conversationBranches.has(conversationId)) {
    return conversationBranches.get(conversationId)!
  }

  // Check workspace settings for auto-branch
  // (TODO: Load from workspace settings)
  const autoBranchEnabled = true // Default enabled

  if (!autoBranchEnabled) return null

  const branchName = generateAgentBranchName(agentName, sessionId)

  try {
    // Check for uncommitted changes
    const status = await gitService.getStatus(repoPath)
    if (status.isDirty) {
      // Stash changes before branching
      await gitService.stash(repoPath, `Pre-agent stash for ${branchName}`)
    }

    // Check if branch already exists
    const exists = await gitService.branchExists(repoPath, branchName)
    if (exists) {
      await gitService.checkout(repoPath, branchName)
    } else {
      await gitService.createBranch(repoPath, branchName)
    }

    // Pop stash if we stashed
    if (status.isDirty) {
      try {
        await gitService.stashPop(repoPath)
      } catch {
        // Stash pop may fail if conflicts - that's okay
      }
    }

    conversationBranches.set(conversationId, branchName)

    // Notify renderer
    mainWindow.webContents.send('git:branch-created', {
      conversationId,
      branchName,
      agentName
    })

    return branchName
  } catch (error) {
    console.error('[SDK] Failed to create agent branch:', error)
    return null
  }
}
```

### 2.2 File Change Tracking (PostToolUse Hook)

**File:** `chorus/src/main/services/agent-sdk-service.ts`

Track files changed during the turn for commit-per-turn. This extends the existing PostToolUse hook.

```typescript
// Track files changed per turn (for commit-per-turn)
const turnFileChanges: Map<string, Set<string>> = new Map()

// Track user prompts for commit message generation
const sessionPrompts: Map<string, string[]> = new Map()

// Add file tracking to existing PostToolUse hook:
// In the PostToolUse handler that already exists for file-changed events:
if (filePath && (toolName === 'Write' || toolName === 'Edit' || toolName === 'MultiEdit')) {
  // Track for auto-commit
  if (!turnFileChanges.has(conversationId)) {
    turnFileChanges.set(conversationId, new Set())
  }
  turnFileChanges.get(conversationId)!.add(filePath)

  // ... existing file change notification code stays as-is ...
}

// Track each user prompt for commit message
// At start of sendMessageSDK, after creating userMessage:
if (!sessionPrompts.has(conversationId)) {
  sessionPrompts.set(conversationId, [])
}
sessionPrompts.get(conversationId)!.push(message)
```

### 2.3 Commit Per Turn (on Result Event)

Auto-commit after each conversation turn completes (result event). This gives incremental checkpoints.

```typescript
// After result event (end of turn), add auto-commit:
if (msg.type === 'result') {
  // ... existing result handling ...

  // Auto-commit changes from this turn
  const changedFiles = turnFileChanges.get(conversationId)
  if (changedFiles && changedFiles.size > 0) {
    const branchName = conversationBranches.get(conversationId)
    if (branchName) {
      try {
        // Generate commit message from user prompt
        const commitMessage = generateTurnCommitMessage(message, changedFiles)

        await gitService.stageAll(repoPath)
        const commitHash = await gitService.commit(repoPath, commitMessage)

        // Notify renderer
        mainWindow.webContents.send('git:commit-created', {
          conversationId,
          branchName,
          commitHash,
          message: commitMessage,
          files: Array.from(changedFiles),
          type: 'turn'
        })

        console.log(`[SDK] Turn commit: ${commitHash}`)
      } catch (error) {
        console.error('[SDK] Turn auto-commit failed:', error)
      } finally {
        // Clear tracked files for next turn
        turnFileChanges.delete(conversationId)
      }
    }
  }
}

// Generate commit message for a single turn
function generateTurnCommitMessage(userPrompt: string, files: Set<string>): string {
  const maxPromptLength = 50
  let summary = userPrompt.slice(0, maxPromptLength)
  if (userPrompt.length > maxPromptLength) {
    summary += '...'
  }

  const fileList = Array.from(files)
    .map(f => f.split('/').pop())
    .join(', ')

  return `[Agent] ${summary}\n\nFiles: ${fileList}`
}
```

### 2.4 Stop Hook for Final Commit

Use the SDK's `Stop` hook to commit any uncommitted changes when the agent stops. This catches cases where the agent is interrupted mid-turn.

```typescript
// Add Stop hook to options.hooks alongside PostToolUse:
options.hooks = {
  PostToolUse: [
    // ... existing file tracking hook ...
  ],
  Stop: [{
    hooks: [async () => {
      // Final commit on stop - catches any uncommitted changes
      const changedFiles = turnFileChanges.get(conversationId)
      const branchName = conversationBranches.get(conversationId)

      if (changedFiles && changedFiles.size > 0 && branchName) {
        try {
          const prompts = sessionPrompts.get(conversationId) || []
          const commitMessage = generateStopCommitMessage(prompts, changedFiles)

          await gitService.stageAll(repoPath)
          const commitHash = await gitService.commit(repoPath, commitMessage)

          mainWindow.webContents.send('git:commit-created', {
            conversationId,
            branchName,
            commitHash,
            message: commitMessage,
            files: Array.from(changedFiles),
            type: 'stop'
          })

          console.log(`[SDK] Stop commit: ${commitHash}`)
        } catch (error) {
          console.error('[SDK] Stop commit failed:', error)
        }
      }

      // Cleanup tracking
      turnFileChanges.delete(conversationId)
      sessionPrompts.delete(conversationId)

      return { continue: true }
    }]
  }]
}

// Generate commit message for stop event
function generateStopCommitMessage(prompts: string[], files: Set<string>): string {
  const title = prompts[0]?.slice(0, 50) || 'Agent session'
  const suffix = prompts[0]?.length > 50 ? '...' : ''

  const fileList = Array.from(files)
    .map(f => `- ${f.split('/').pop()}`)
    .join('\n')

  const promptSummary = prompts.length > 1
    ? `\n\nPrompts (${prompts.length}):\n${prompts.map((p, i) => `${i + 1}. ${p.slice(0, 60)}...`).join('\n')}`
    : ''

  return `[Agent - Stopped] ${title}${suffix}

Files changed:
${fileList}${promptSummary}`
}
```

### 2.5 Commit Flow Summary

The commit strategy follows GitButler's approach:

| Event | Action | Commit Message |
|-------|--------|----------------|
| **Turn completes** (result) | Commit turn's changes | `[Agent] {prompt}\n\nFiles: ...` |
| **Agent stops** (Stop hook) | Commit any remaining changes | `[Agent - Stopped] {prompt}\n\nFiles: ...` |
| **User interrupts** | Stop hook fires → commit | Same as above |
| **Error** | Stop hook fires → commit | `[Agent - Error] ...` |

This gives you:
- **Incremental history**: Each turn = one commit
- **Clean checkpoints**: Easy to see what each prompt accomplished
- **No lost work**: Stop hook catches interrupted turns

## Phase 3: Workspace Settings

### 3.1 Add Git Settings to Workspace Config

**File:** `chorus/src/main/store/index.ts`

```typescript
// Add to WorkspaceSettings interface:
interface WorkspaceSettings {
  // ... existing settings ...
  git?: {
    autoBranch: boolean      // Create branch per session (default: true)
    autoCommit: boolean      // Commit per turn (default: true)
    useGitButler: boolean    // Forward to GitButler CLI (default: false)
  }
}
```

### 3.2 Add Settings UI

**File:** `chorus/src/renderer/src/components/MainPane/WorkspaceSettings.tsx`

Add a new section for Git automation settings:

```tsx
// Git Automation Settings section
<div className="mb-8">
  <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
    <GitBranchIcon />
    Git Automation
  </h2>
  <div className="p-4 rounded-lg bg-input border border-default space-y-4">
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={gitSettings.autoBranch}
        onChange={(e) => updateGitSettings({ autoBranch: e.target.checked })}
        className="w-4 h-4 rounded border-default"
      />
      <div>
        <p className="text-primary">Auto-create branch for each agent session</p>
        <p className="text-xs text-muted">Branch pattern: agent/{'{agentName}'}/{'{sessionId}'}</p>
      </div>
    </label>

    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={gitSettings.autoCommit}
        onChange={(e) => updateGitSettings({ autoCommit: e.target.checked })}
        className="w-4 h-4 rounded border-default"
      />
      <div>
        <p className="text-primary">Auto-commit after each conversation turn</p>
        <p className="text-xs text-muted">Includes prompt summary in commit message</p>
      </div>
    </label>
  </div>
</div>
```

## Phase 4: Agent Sessions UI

### 4.1 Create AgentSessionsPanel Component

**File:** `chorus/src/renderer/src/components/MainPane/AgentSessionsPanel.tsx`

```tsx
import { useState, useEffect } from 'react'
import type { AgentBranchInfo } from '../../types'

interface AgentSessionsPanelProps {
  workspacePath: string
  onBranchChange: () => void
}

export function AgentSessionsPanel({ workspacePath, onBranchChange }: AgentSessionsPanelProps) {
  const [branches, setBranches] = useState<AgentBranchInfo[]>([])
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBranches()
  }, [workspacePath])

  const loadBranches = async () => {
    setLoading(true)
    const result = await window.api.git.getAgentBranches(workspacePath)
    if (result.success && result.data) {
      setBranches(result.data)
    }
    setLoading(false)
  }

  const handleCheckout = async (branchName: string) => {
    const result = await window.api.git.checkout(workspacePath, branchName)
    if (result.success) {
      onBranchChange()
      loadBranches()
    }
  }

  const handleMerge = async (branchName: string) => {
    // First checkout main
    await window.api.git.checkout(workspacePath, 'main')
    // Then merge
    const result = await window.api.git.merge(workspacePath, branchName, { squash: true })
    if (result.success) {
      // Commit the squashed changes
      await window.api.git.commit(workspacePath, `Merge ${branchName}`)
      onBranchChange()
      loadBranches()
    }
  }

  const handleDelete = async (branchName: string) => {
    const result = await window.api.git.deleteBranch(workspacePath, branchName)
    if (result.success) {
      loadBranches()
    }
  }

  if (loading) {
    return <div className="p-4 text-muted">Loading agent sessions...</div>
  }

  if (branches.length === 0) {
    return null // Don't show section if no agent branches
  }

  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
        <BranchIcon />
        Agent Sessions ({branches.length})
      </h2>
      <div className="space-y-2">
        {branches.map((branch) => (
          <AgentBranchCard
            key={branch.name}
            branch={branch}
            isExpanded={expandedBranch === branch.name}
            onToggle={() => setExpandedBranch(
              expandedBranch === branch.name ? null : branch.name
            )}
            onCheckout={() => handleCheckout(branch.name)}
            onMerge={() => handleMerge(branch.name)}
            onDelete={() => handleDelete(branch.name)}
            workspacePath={workspacePath}
          />
        ))}
      </div>
    </div>
  )
}
```

### 4.2 Add to WorkspaceOverview

**File:** `chorus/src/renderer/src/components/MainPane/WorkspaceOverview.tsx`

```tsx
import { AgentSessionsPanel } from './AgentSessionsPanel'

// In the component, add after ChangesPanel:
{workspace.gitBranch && (
  <AgentSessionsPanel
    workspacePath={workspace.path}
    onBranchChange={handleBranchChange}
  />
)}
```

## Phase 5: Diff Viewer

### 5.1 Create DiffViewer Component

**File:** `chorus/src/renderer/src/components/MainPane/DiffViewer.tsx`

```tsx
import { useState, useEffect } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { FileDiff } from '../../types'

interface DiffViewerProps {
  workspacePath: string
  commitHash?: string
  filePath?: string // If provided, show only this file
}

export function DiffViewer({ workspacePath, commitHash, filePath }: DiffViewerProps) {
  const [diffs, setDiffs] = useState<FileDiff[]>([])
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDiff()
  }, [workspacePath, commitHash])

  const loadDiff = async () => {
    setLoading(true)
    const result = await window.api.git.getDiff(workspacePath, commitHash)
    if (result.success && result.data) {
      let fileDiffs = result.data
      if (filePath) {
        fileDiffs = fileDiffs.filter(d => d.filePath === filePath)
      }
      setDiffs(fileDiffs)
    }
    setLoading(false)
  }

  if (loading) {
    return <div className="p-4 text-muted">Loading diff...</div>
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-default">
        <span className="text-sm text-secondary">
          {diffs.length} file{diffs.length !== 1 ? 's' : ''} changed
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('unified')}
            className={`px-2 py-1 text-xs rounded ${
              viewMode === 'unified' ? 'bg-accent text-white' : 'bg-input'
            }`}
          >
            Unified
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`px-2 py-1 text-xs rounded ${
              viewMode === 'split' ? 'bg-accent text-white' : 'bg-input'
            }`}
          >
            Split
          </button>
        </div>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto">
        {diffs.map((diff) => (
          <FileDiffView
            key={diff.filePath}
            diff={diff}
            viewMode={viewMode}
          />
        ))}
      </div>
    </div>
  )
}

function FileDiffView({ diff, viewMode }: { diff: FileDiff; viewMode: 'unified' | 'split' }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="border-b border-default">
      {/* File header */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 p-2 bg-input cursor-pointer hover:bg-hover"
      >
        <span className={`text-xs px-1 rounded ${
          diff.status === 'added' ? 'bg-green-500/20 text-green-400' :
          diff.status === 'deleted' ? 'bg-red-500/20 text-red-400' :
          'bg-yellow-500/20 text-yellow-400'
        }`}>
          {diff.status[0].toUpperCase()}
        </span>
        <span className="font-mono text-sm flex-1">{diff.filePath}</span>
        <span className="text-xs text-muted">
          +{diff.additions} -{diff.deletions}
        </span>
      </div>

      {/* Diff hunks */}
      {!collapsed && (
        <div className="font-mono text-sm">
          {diff.hunks.map((hunk, i) => (
            <DiffHunkView key={i} hunk={hunk} viewMode={viewMode} />
          ))}
        </div>
      )}
    </div>
  )
}
```

### 5.2 Integrate with Split Pane

When clicking a commit in AgentSessionsPanel, open the diff in the second pane:

```typescript
const handleViewDiff = (commitHash: string) => {
  // Create a diff tab
  openTab({
    type: 'diff',
    commitHash,
    workspaceId,
    title: `Diff: ${commitHash.slice(0, 7)}`
  })
}
```

## Phase 6: Navigation Improvements

### 6.1 Workspace Tab from Split View

**Issue:** When in split view, clicking workspace should show overview while allowing return to split.

**Solution:** Add workspace tab type and remember split state.

**File:** `chorus/src/renderer/src/stores/workspace-store.ts`

```typescript
// Already implemented! Tab type 'workspace' exists.
// The selectWorkspace action creates workspace tabs.

// Add: Remember split state before switching to workspace
interface WorkspaceStore {
  // ... existing ...
  previousSplitState: {
    enabled: boolean
    firstPaneGroup: TabGroup
    secondPaneGroup: TabGroup
    ratio: number
    orientation: 'vertical' | 'horizontal'
  } | null

  saveSplitState: () => void
  restoreSplitState: () => void
}

// In selectWorkspace, save split state if enabled:
selectWorkspace: (id: string | null) => {
  const { splitPaneEnabled } = get()

  // Save split state before exiting
  if (splitPaneEnabled) {
    get().saveSplitState()
    set({ splitPaneEnabled: false })
  }

  // ... existing logic ...
}
```

### 6.2 Return to Split View Button

Add a "Return to Split View" button in workspace overview when previous split state exists:

```tsx
// In WorkspaceOverview.tsx
const { previousSplitState, restoreSplitState } = useWorkspaceStore()

{previousSplitState && (
  <button
    onClick={restoreSplitState}
    className="fixed bottom-4 right-4 px-4 py-2 bg-accent text-white rounded-lg shadow-lg hover:bg-accent/90 flex items-center gap-2"
  >
    <SplitIcon />
    Return to Split View
  </button>
)}
```

## Testing Plan

### Unit Tests

1. **Git Service Functions**
   - `createBranch`: Creates branch, handles existing
   - `commit`: Stages and commits, returns hash
   - `getAgentBranches`: Parses branch names correctly
   - `merge`: Handles squash, conflicts

2. **Branch Name Generation**
   - Sanitizes agent names
   - Handles special characters
   - Truncates long session IDs

### Integration Tests

1. **Auto-Branch Flow**
   - Start conversation → branch created
   - Multiple conversations → separate branches
   - Resume conversation → same branch

2. **Auto-Commit Flow**
   - Agent edits file → file tracked
   - Turn completes → commit created
   - Commit message includes prompt

3. **UI Integration**
   - Agent branches appear in overview
   - Checkout switches branch
   - Merge updates main
   - Delete removes branch

### Manual Testing

1. Start new conversation, verify branch created
2. Make agent edit files, verify commits
3. Switch between agent branches
4. Merge agent branch to main
5. Test with uncommitted changes (stash flow)
6. Test split view → workspace → return to split

## File Summary

| File | Changes |
|------|---------|
| `git-service.ts` | Add 8+ new functions |
| `main/index.ts` | Add 8 new IPC handlers |
| `preload/index.ts` | Expose new git methods |
| `preload/index.d.ts` | Add types for new git methods |
| `agent-sdk-service.ts` | Add auto-branch and auto-commit |
| `store/index.ts` | Add git settings to workspace |
| `workspace-store.ts` | Add split state memory |
| `WorkspaceSettings.tsx` | Add git settings UI |
| `AgentSessionsPanel.tsx` | New component |
| `AgentBranchCard.tsx` | New component |
| `DiffViewer.tsx` | New component |
| `WorkspaceOverview.tsx` | Add agent sessions section |
| `types/index.ts` | Add AgentBranchInfo, FileDiff types |

## Implementation Order

1. **Week 1: Core Git**
   - [ ] Add git-service functions
   - [ ] Add IPC handlers
   - [ ] Update preload bridge
   - [ ] Basic tests

2. **Week 2: SDK Integration**
   - [ ] Auto-branch on session start
   - [ ] Track file changes per turn
   - [ ] Auto-commit on turn end
   - [ ] IPC notifications

3. **Week 3: UI**
   - [ ] AgentSessionsPanel component
   - [ ] Add to WorkspaceOverview
   - [ ] Basic branch actions

4. **Week 4: Polish**
   - [ ] DiffViewer component
   - [ ] Split pane integration
   - [ ] Workspace navigation improvements
   - [ ] Settings UI
   - [ ] Edge case handling
