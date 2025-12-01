import { useState, useEffect } from 'react'
import type { AgentBranchInfo, FileDiff } from '../../types'
import { useWorkspaceStore } from '../../stores/workspace-store'

interface AgentSessionsPanelProps {
  workspacePath: string
  onBranchChange: () => void
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

export function AgentSessionsPanel({ workspacePath, onBranchChange }: AgentSessionsPanelProps) {
  const [branches, setBranches] = useState<AgentBranchInfo[]>([])
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [diffData, setDiffData] = useState<{ branch: string; files: FileDiff[] } | null>(null)
  const [pushSuccess, setPushSuccess] = useState<string | null>(null)

  const { selectFile } = useWorkspaceStore()

  // Handle clicking on a file to open it
  const handleFileClick = (relativePath: string) => {
    // Construct full path from workspace path + relative path
    const fullPath = `${workspacePath}/${relativePath}`
    selectFile(fullPath)
  }

  useEffect(() => {
    loadBranches()

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
    setActionInProgress(branchName)
    const result = await window.api.git.checkout(workspacePath, branchName)
    if (result.success) {
      onBranchChange()
      await loadBranches()
    }
    setActionInProgress(null)
  }

  const handleMerge = async (branchName: string) => {
    setActionInProgress(branchName)
    try {
      // Detect which default branch exists (main or master)
      const branchesResult = await window.api.git.listBranches(workspacePath)
      if (!branchesResult.success || !branchesResult.data) {
        console.error('Failed to list branches')
        return
      }

      const localBranches = branchesResult.data.filter(b => !b.isRemote).map(b => b.name)
      let defaultBranch = 'main'
      if (localBranches.includes('main')) {
        defaultBranch = 'main'
      } else if (localBranches.includes('master')) {
        defaultBranch = 'master'
      }

      // We need to checkout the default branch first
      await window.api.git.checkout(workspacePath, defaultBranch)

      // Then merge with squash
      const mergeResult = await window.api.git.merge(workspacePath, branchName, { squash: true })
      if (mergeResult.success) {
        // Commit the squashed changes
        await window.api.git.commit(workspacePath, `Merge agent session: ${branchName}`)
        onBranchChange()
        await loadBranches()
      }
    } catch (error) {
      console.error('Merge failed:', error)
    }
    setActionInProgress(null)
  }

  const handleDelete = async (branchName: string) => {
    setActionInProgress(branchName)
    const result = await window.api.git.deleteBranch(workspacePath, branchName, true)
    if (result.success) {
      await loadBranches()
    }
    setActionInProgress(null)
  }

  const handlePush = async (branchName: string) => {
    setActionInProgress(branchName)
    setPushSuccess(null)
    const result = await window.api.git.push(workspacePath, branchName, { setUpstream: true })
    if (result.success) {
      setPushSuccess(branchName)
      setTimeout(() => setPushSuccess(null), 3000)
    }
    setActionInProgress(null)
  }

  const handleViewChanges = async (branchName: string) => {
    // If already showing diff for this branch, hide it
    if (diffData?.branch === branchName) {
      setDiffData(null)
      return
    }

    setActionInProgress(branchName)

    // Detect which default branch exists (main or master)
    const branchesResult = await window.api.git.listBranches(workspacePath)
    if (!branchesResult.success || !branchesResult.data) {
      setActionInProgress(null)
      return
    }

    const localBranches = branchesResult.data.filter(b => !b.isRemote).map(b => b.name)
    let defaultBranch = 'main'
    if (localBranches.includes('main')) {
      defaultBranch = 'main'
    } else if (localBranches.includes('master')) {
      defaultBranch = 'master'
    }

    // Get diff between default branch and the agent branch
    const result = await window.api.git.getDiffBetweenBranches(
      workspacePath,
      defaultBranch,
      branchName
    )
    if (result.success && result.data) {
      setDiffData({ branch: branchName, files: result.data })
    }
    setActionInProgress(null)
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
                  {/* Merge is always available - it will checkout main/master first */}
                  <button
                    onClick={() => handleMerge(branch.name)}
                    disabled={actionInProgress === branch.name}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-hover hover:bg-blue-500/20 text-secondary hover:text-blue-400 transition-colors disabled:opacity-50"
                  >
                    <MergeIcon />
                    Merge to main
                  </button>
                  {!branch.isCurrent && (
                    <button
                      onClick={() => handleDelete(branch.name)}
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
                {/* Diff display */}
                {diffData?.branch === branch.name && diffData.files.length > 0 && (
                  <div className="mt-3 border-t border-default pt-3">
                    <h4 className="text-xs font-semibold text-secondary mb-2">
                      Changed Files ({diffData.files.length})
                    </h4>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {diffData.files.map((file) => (
                        <button
                          key={file.filePath}
                          onClick={() => handleFileClick(file.filePath)}
                          disabled={file.status === 'deleted'}
                          className={`w-full flex items-center gap-2 text-xs p-1.5 rounded bg-hover/50 text-left transition-colors ${
                            file.status === 'deleted'
                              ? 'opacity-50 cursor-not-allowed'
                              : 'hover:bg-hover cursor-pointer'
                          }`}
                          title={file.status === 'deleted' ? 'File was deleted' : `Open ${file.filePath}`}
                        >
                          <span className={`font-mono flex-shrink-0 ${
                            file.status === 'added' ? 'text-green-400' :
                            file.status === 'deleted' ? 'text-red-400' :
                            file.status === 'renamed' ? 'text-blue-400' :
                            'text-yellow-400'
                          }`}>
                            {file.status === 'added' ? 'A' :
                             file.status === 'deleted' ? 'D' :
                             file.status === 'renamed' ? 'R' : 'M'}
                          </span>
                          <span className="flex-1 truncate font-mono">{file.filePath}</span>
                          <span className="text-green-400 flex-shrink-0">+{file.additions}</span>
                          <span className="text-red-400 flex-shrink-0">-{file.deletions}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {diffData?.branch === branch.name && diffData.files.length === 0 && (
                  <div className="mt-3 border-t border-default pt-3">
                    <p className="text-xs text-muted">No uncommitted changes</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
