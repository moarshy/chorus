import { useState, useEffect } from 'react'
import type { AgentBranchInfo, FileDiff } from '../../types'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useChatStore } from '../../stores/chat-store'
import { DiffHunkViewer } from './DiffHunkViewer'
import { MergePreviewDialog } from '../dialogs/MergePreviewDialog'

interface AgentSessionsPanelProps {
  workspacePath: string
  workspaceId: string
  onBranchChange: () => void
}

interface PushError {
  branch: string
  message: string
  suggestion: string
}

interface MergePreviewState {
  branch: string
  targetBranch: string
}

// SVG Icons
const BranchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M9.5 3.25a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zm-6 0a.75.75 0 101.5 0 .75.75 0 00-1.5 0zm8.25-.75a.75.75 0 100 1.5.75.75 0 000-1.5zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5z" />
  </svg>
)

const PushIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0a8 8 0 110 16A8 8 0 018 0zm0 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zm.75 2.75v5.19l1.72-1.72a.75.75 0 111.06 1.06l-3 3a.75.75 0 01-1.06 0l-3-3a.75.75 0 111.06-1.06l1.72 1.72V4.25a.75.75 0 011.5 0z" transform="rotate(180 8 8)" />
  </svg>
)

const DiffIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8.75 1.75a.75.75 0 00-1.5 0V5H4.5a.75.75 0 000 1.5h2.75v2.75a.75.75 0 001.5 0V6.5h2.75a.75.75 0 000-1.5H8.75V1.75zM4 13a.75.75 0 000 1.5h8a.75.75 0 000-1.5H4z" />
  </svg>
)

const CommitIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M10.5 7.75a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm1.43.75a4.002 4.002 0 01-7.86 0H.75a.75.75 0 110-1.5h3.32a4.001 4.001 0 017.86 0h3.32a.75.75 0 110 1.5h-3.32z" />
  </svg>
)

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
  </svg>
)

const MergeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M5 3.254V3.25v.005a.75.75 0 110-.005v.004zm.45 1.9a2.25 2.25 0 10-1.95.218v5.256a2.25 2.25 0 101.5 0V7.123A5.735 5.735 0 009.25 9h1.378a2.251 2.251 0 100-1.5H9.25a4.25 4.25 0 01-3.8-2.346zM12.75 9a.75.75 0 100-1.5.75.75 0 000 1.5zm-8.5 4.5a.75.75 0 100-1.5.75.75 0 000 1.5z" />
  </svg>
)

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 00-1.492-.149l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z" />
  </svg>
)

const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)


// Simple VS Code style confirmation dialog
interface DeleteConfirmDialogProps {
  branchName: string
  onConfirm: () => void
  onCancel: () => void
}

function DeleteConfirmDialog({ branchName, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-[15%] z-50">
      <div className="bg-surface border border-default rounded shadow-lg w-[400px]">
        <div className="p-4">
          <p className="text-primary text-sm">
            Delete branch <span className="font-mono text-secondary">{branchName}</span>?
          </p>
        </div>
        <div className="px-4 pb-3 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded border border-default hover:bg-hover text-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

export function AgentSessionsPanel({ workspacePath, workspaceId, onBranchChange }: AgentSessionsPanelProps) {
  const [branches, setBranches] = useState<AgentBranchInfo[]>([])
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [diffData, setDiffData] = useState<{
    branch: string
    files: FileDiff[]
    baseBranch: string
    error?: string
  } | null>(null)
  const [pushSuccess, setPushSuccess] = useState<string | null>(null)
  const [pushError, setPushError] = useState<PushError | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // E-1: Expanded files for inline diff
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

  // E-2: Comparison branch selection
  const [comparisonBranch, setComparisonBranch] = useState<string>('main')
  const [availableBranches, setAvailableBranches] = useState<string[]>([])

  // E-3: Merge preview dialog
  const [mergePreview, setMergePreview] = useState<MergePreviewState | null>(null)

  const { selectFile, branchRefreshKey } = useWorkspaceStore()

  // Handle clicking on a file to open it
  const handleFileClick = (relativePath: string) => {
    // Construct full path from workspace path + relative path
    const fullPath = `${workspacePath}/${relativePath}`
    selectFile(fullPath)
  }

  useEffect(() => {
    loadBranches()
    loadAvailableBranches()

    // Listen for branch created events
    const unsubBranch = window.api.git.onBranchCreated(() => {
      loadBranches()
    })

    // Listen for commit created events
    const unsubCommit = window.api.git.onCommitCreated(() => {
      loadBranches()
    })

    return () => {
      unsubBranch()
      unsubCommit()
    }
  }, [workspacePath, branchRefreshKey])

  const loadBranches = async () => {
    setLoading(true)
    const result = await window.api.git.getAgentBranches(workspacePath)
    if (result.success && result.data) {
      setBranches(result.data)
    }
    setLoading(false)
  }

  // E-2: Load available branches for comparison dropdown
  const loadAvailableBranches = async () => {
    const result = await window.api.git.listBranches(workspacePath)
    if (result.success && result.data) {
      const locals = result.data
        .filter((b) => !b.isRemote)
        .map((b) => b.name)
        .filter((n) => !n.startsWith('agent/'))
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

  // E-1: Toggle file expansion for inline diff
  const toggleFileExpand = (filePath: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(filePath)) {
        next.delete(filePath)
      } else {
        next.add(filePath)
      }
      return next
    })
  }

  // E-1: Expand/collapse all files
  const expandAllFiles = () => {
    if (diffData?.files) {
      setExpandedFiles(new Set(diffData.files.map((f) => f.filePath)))
    }
  }

  const collapseAllFiles = () => {
    setExpandedFiles(new Set())
  }

  const handleCheckout = async (branchName: string) => {
    setActionInProgress(branchName)
    const result = await window.api.git.checkout(workspacePath, branchName)
    if (result.success) {
      onBranchChange()
      await loadBranches()
    }
    setActionInProgress(null)
  }

  // E-3: Show merge preview dialog instead of merging directly
  const handleMergeClick = (branchName: string) => {
    // Use the comparison branch as the merge target
    setMergePreview({ branch: branchName, targetBranch: comparisonBranch })
  }

  // E-3: Handle merge confirmation from preview dialog
  const handleMergeConfirm = async (options: { squash: boolean }) => {
    if (!mergePreview) return

    const branchName = mergePreview.branch
    const targetBranch = mergePreview.targetBranch
    setMergePreview(null)
    setActionInProgress(branchName)

    try {
      // Checkout the target branch first
      await window.api.git.checkout(workspacePath, targetBranch)

      // Merge with selected options
      const mergeResult = await window.api.git.merge(workspacePath, branchName, {
        squash: options.squash
      })

      if (mergeResult.success) {
        if (options.squash) {
          // Squash merge requires manual commit
          await window.api.git.commit(workspacePath, `Merge agent session: ${branchName}`)
        }
        onBranchChange()
        await loadBranches()
      } else {
        console.error('Merge failed:', mergeResult.error)
      }
    } catch (error) {
      console.error('Merge failed:', error)
    }
    setActionInProgress(null)
  }

  const handleMergeCancel = () => {
    setMergePreview(null)
  }

  const handleDeleteClick = (branchName: string) => {
    // Show confirmation dialog
    setDeleteConfirm(branchName)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return

    const branchName = deleteConfirm
    setDeleteConfirm(null)
    setActionInProgress(branchName)

    const result = await window.api.git.deleteBranch(workspacePath, branchName, true, workspaceId)
    if (result.success) {
      await loadBranches()
      // Trigger conversation refresh since branch deletion may have cascade-deleted conversations
      useChatStore.getState().triggerConversationRefresh()
      // Trigger branch refresh so BranchCommitsGrid also updates
      useWorkspaceStore.getState().triggerBranchRefresh()
    }
    setActionInProgress(null)
  }

  const handleDeleteCancel = () => {
    setDeleteConfirm(null)
  }

  // E-6: Enhanced push with better error handling
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
        suggestion = 'Remote has new changes. Pull the latest changes first, then push.'
      } else if (error.includes('remote') && error.includes('not found')) {
        suggestion = 'No remote "origin" configured. Add a remote first.'
      } else if (error.includes('permission') || error.includes('denied')) {
        suggestion = 'Check your Git credentials or SSH key permissions.'
      } else if (error.includes('could not read Username') || error.includes('Authentication')) {
        suggestion = 'Git authentication required. Run "git push" in terminal to authenticate.'
      } else if (error.includes('does not appear to be a git repository')) {
        suggestion = 'The remote URL may be incorrect. Check your git remote settings.'
      }

      setPushError({ branch: branchName, message: error, suggestion })
      setTimeout(() => setPushError(null), 10000)
    }

    setActionInProgress(null)
  }

  // E-2: View changes with configurable comparison branch
  const handleViewChanges = async (branchName: string, baseBranch?: string) => {
    // If already showing diff for this branch and no base branch override, hide it
    if (diffData?.branch === branchName && !baseBranch) {
      setDiffData(null)
      setExpandedFiles(new Set())
      return
    }

    setActionInProgress(branchName)

    // Use provided base branch or the selected comparison branch
    const targetBaseBranch = baseBranch || comparisonBranch

    // Get diff between base branch and the agent branch
    const result = await window.api.git.getDiffBetweenBranches(
      workspacePath,
      targetBaseBranch,
      branchName
    )

    if (result.success && result.data) {
      setDiffData({ branch: branchName, files: result.data, baseBranch: targetBaseBranch })
      setExpandedFiles(new Set()) // Reset expanded files when loading new diff
    } else {
      setDiffData({
        branch: branchName,
        files: [],
        baseBranch: targetBaseBranch,
        error: result.error || 'Failed to get diff'
      })
    }
    setActionInProgress(null)
  }

  // E-2: Handle comparison branch change
  const handleComparisonBranchChange = (newBranch: string) => {
    setComparisonBranch(newBranch)
    // Re-fetch diff with new comparison branch if diff is showing
    if (diffData) {
      handleViewChanges(diffData.branch, newBranch)
    }
  }

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
          <BranchIcon />
          Agent Sessions
        </h2>
        <div className="p-4 rounded-lg bg-input border border-default text-muted">
          Loading agent sessions...
        </div>
      </div>
    )
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
          <div
            key={branch.name}
            className="rounded-lg bg-input border border-default overflow-hidden"
          >
            {/* Branch header */}
            <div
              onClick={() => setExpandedBranch(
                expandedBranch === branch.name ? null : branch.name
              )}
              className="flex items-center gap-3 p-3 cursor-pointer hover:bg-hover transition-colors"
            >
              <span className="text-muted">
                {expandedBranch === branch.name ? <ChevronDownIcon /> : <ChevronRightIcon />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{branch.agentName}</span>
                  {branch.isCurrent && (
                    <span className="px-1.5 py-0.5 text-xs rounded bg-green-500/20 text-green-400">
                      current
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted mt-0.5">
                  <span className="font-mono">{branch.sessionId}</span>
                  <span className="flex items-center gap-1">
                    <CommitIcon />
                    {branch.commitCount} commits
                  </span>
                  <span>{formatDate(branch.lastCommitDate)}</span>
                </div>
              </div>
            </div>

            {/* Expanded actions */}
            {expandedBranch === branch.name && (
              <div className="px-3 pb-3 pt-0">
                <div className="flex flex-wrap gap-2 pt-2 border-t border-default">
                  {!branch.isCurrent && (
                    <button
                      onClick={() => handleCheckout(branch.name)}
                      disabled={actionInProgress === branch.name}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-hover hover:bg-accent/20 text-secondary hover:text-accent transition-colors disabled:opacity-50"
                    >
                      <CheckIcon />
                      Checkout
                    </button>
                  )}
                  {/* View changes - shows diff for this branch */}
                  <button
                    onClick={() => handleViewChanges(branch.name)}
                    disabled={actionInProgress === branch.name}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition-colors disabled:opacity-50 ${
                      diffData?.branch === branch.name
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-hover hover:bg-purple-500/20 text-secondary hover:text-purple-400'
                    }`}
                  >
                    <DiffIcon />
                    {diffData?.branch === branch.name ? 'Hide Changes' : 'View Changes'}
                  </button>
                  {/* Push to remote */}
                  <button
                    onClick={() => handlePush(branch.name)}
                    disabled={actionInProgress === branch.name}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-hover hover:bg-green-500/20 text-secondary hover:text-green-400 transition-colors disabled:opacity-50"
                  >
                    <PushIcon />
                    {pushSuccess === branch.name ? 'Pushed!' : 'Push'}
                  </button>
                  {/* E-3: Merge with preview dialog */}
                  <button
                    onClick={() => handleMergeClick(branch.name)}
                    disabled={actionInProgress === branch.name}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-hover hover:bg-blue-500/20 text-secondary hover:text-blue-400 transition-colors disabled:opacity-50"
                  >
                    <MergeIcon />
                    Merge to {comparisonBranch}
                  </button>
                  {!branch.isCurrent && (
                    <button
                      onClick={() => handleDeleteClick(branch.name)}
                      disabled={actionInProgress === branch.name}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-hover hover:bg-red-500/20 text-secondary hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      <TrashIcon />
                      Delete
                    </button>
                  )}
                </div>
                {branch.isCurrent && (
                  <p className="text-xs text-muted mt-2">
                    Currently checked out. Switch branches to enable checkout/delete.
                  </p>
                )}
                {/* E-6: Push error display */}
                {pushError?.branch === branch.name && (
                  <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/30 text-xs">
                    <p className="text-red-400 font-medium">Push failed</p>
                    <p className="text-muted mt-1 font-mono text-[10px] break-all">
                      {pushError.message}
                    </p>
                    <p className="text-secondary mt-1">💡 {pushError.suggestion}</p>
                  </div>
                )}

                {/* Loading indicator for diff */}
                {actionInProgress === branch.name && diffData?.branch !== branch.name && (
                  <div className="mt-3 border-t border-default pt-3">
                    <p className="text-xs text-muted animate-pulse">Loading changes...</p>
                  </div>
                )}

                {/* Diff display with E-1 inline diffs and E-2 comparison selector */}
                {diffData?.branch === branch.name && diffData.files.length > 0 && (
                  <div className="mt-3 border-t border-default pt-3">
                    {/* E-2: Comparison branch selector */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted">Comparing to:</span>
                        <select
                          value={diffData.baseBranch}
                          onChange={(e) => handleComparisonBranchChange(e.target.value)}
                          className="bg-input border border-default rounded px-2 py-0.5 text-primary text-xs"
                        >
                          {availableBranches.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>
                      {/* E-1: Expand/Collapse all */}
                      <div className="flex gap-2 text-xs">
                        <button
                          onClick={expandAllFiles}
                          className="text-muted hover:text-primary transition-colors"
                        >
                          Expand All
                        </button>
                        <span className="text-muted">|</span>
                        <button
                          onClick={collapseAllFiles}
                          className="text-muted hover:text-primary transition-colors"
                        >
                          Collapse
                        </button>
                      </div>
                    </div>

                    <h4 className="text-xs font-semibold text-secondary mb-2">
                      Changed Files ({diffData.files.length})
                    </h4>

                    <div className="space-y-1 max-h-[500px] overflow-y-auto">
                      {diffData.files.map((file) => (
                        <div key={file.filePath} className="rounded bg-hover/30 overflow-hidden">
                          {/* File header - click to expand/collapse */}
                          <div
                            onClick={() => toggleFileExpand(file.filePath)}
                            className="flex items-center gap-2 text-xs p-1.5 cursor-pointer hover:bg-hover/50 transition-colors"
                          >
                            <span className="text-muted w-4">
                              {expandedFiles.has(file.filePath) ? (
                                <ChevronDownIcon />
                              ) : (
                                <ChevronRightIcon />
                              )}
                            </span>
                            <span
                              className={`font-mono flex-shrink-0 w-4 text-center ${
                                file.status === 'added'
                                  ? 'text-green-400'
                                  : file.status === 'deleted'
                                    ? 'text-red-400'
                                    : file.status === 'renamed'
                                      ? 'text-blue-400'
                                      : 'text-yellow-400'
                              }`}
                            >
                              {file.status === 'added'
                                ? 'A'
                                : file.status === 'deleted'
                                  ? 'D'
                                  : file.status === 'renamed'
                                    ? 'R'
                                    : 'M'}
                            </span>
                            <span className="flex-1 truncate font-mono">{file.filePath}</span>
                            <span className="text-green-400 flex-shrink-0">+{file.additions}</span>
                            <span className="text-red-400 flex-shrink-0">-{file.deletions}</span>
                            {/* Open file button */}
                            {file.status !== 'deleted' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleFileClick(file.filePath)
                                }}
                                className="text-muted hover:text-accent px-1"
                                title={`Open ${file.filePath}`}
                              >
                                ↗
                              </button>
                            )}
                          </div>

                          {/* E-1: Inline diff hunks */}
                          {expandedFiles.has(file.filePath) && file.hunks.length > 0 && (
                            <div className="border-t border-default">
                              <DiffHunkViewer hunks={file.hunks} maxHeight="250px" />
                            </div>
                          )}

                          {/* Show message if no hunks available */}
                          {expandedFiles.has(file.filePath) && file.hunks.length === 0 && (
                            <div className="border-t border-default p-2 text-xs text-muted">
                              {file.status === 'added'
                                ? 'New file'
                                : file.status === 'deleted'
                                  ? 'File deleted'
                                  : 'Binary file or no diff available'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {diffData?.branch === branch.name && diffData.files.length === 0 && (
                  <div className="mt-3 border-t border-default pt-3">
                    {diffData.error ? (
                      <p className="text-xs text-red-400">Error: {diffData.error}</p>
                    ) : (
                      <p className="text-xs text-muted">
                        No differences from {diffData.baseBranch} branch
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <DeleteConfirmDialog
          branchName={deleteConfirm}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}

      {/* E-3: Merge preview dialog */}
      {mergePreview && (
        <MergePreviewDialog
          sourceBranch={mergePreview.branch}
          targetBranch={mergePreview.targetBranch}
          workspacePath={workspacePath}
          onConfirm={handleMergeConfirm}
          onCancel={handleMergeCancel}
        />
      )}
    </div>
  )
}
