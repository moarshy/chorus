import { useState, useEffect, useCallback } from 'react'
import type { GitBranch, GitCommit } from '../../types'
import { useFileTreeStore } from '../../stores/file-tree-store'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useChatStore } from '../../stores/chat-store'

interface BranchCommitsGridProps {
  workspacePath: string
  workspaceId: string
  onBranchChange: () => void
  localOnly?: boolean
}

// SVG Icons
const GitBranchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z" />
  </svg>
)

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
  </svg>
)

const ChevronLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 12L6 8L10 4" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 12L10 8L6 4" />
  </svg>
)

const LoadingSpinner = () => (
  <svg className="animate-spin" width="14" height="14" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
    <path
      d="M14 8a6 6 0 00-6-6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
)

const CommitIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M11.93 8.5a4.002 4.002 0 01-7.86 0H.75a.75.75 0 010-1.5h3.32a4.002 4.002 0 017.86 0h3.32a.75.75 0 010 1.5h-3.32zm-1.43-.75a2.5 2.5 0 10-5 0 2.5 2.5 0 005 0z" />
  </svg>
)

const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 00-1.492-.149l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z" />
  </svg>
)

// Sync status icons
const ArrowUpIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3.47 7.78a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0l4.25 4.25a.75.75 0 01-1.06 1.06L8.75 4.56v8.69a.75.75 0 01-1.5 0V4.56L4.03 7.78a.75.75 0 01-1.06 0z" />
  </svg>
)

const ArrowDownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M12.53 8.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L2.97 9.28a.75.75 0 011.06-1.06l3.22 3.22V2.75a.75.75 0 011.5 0v8.69l3.22-3.22a.75.75 0 011.06 0z" />
  </svg>
)

const RefreshIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 3a5 5 0 104.546 2.914.5.5 0 01.908-.418A6 6 0 118 2v1z" />
    <path d="M8 1v3.5l3-2L8 1z" />
  </svg>
)

const ChevronDownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6L8 10L12 6" />
  </svg>
)

const CloudUploadIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4.406 1.342A5.53 5.53 0 018 0c2.69 0 4.923 2 5.166 4.579C14.758 4.804 16 6.137 16 7.773 16 9.569 14.502 11 12.687 11H10a.75.75 0 010-1.5h2.687C13.654 9.5 14.5 8.724 14.5 7.773c0-.951-.846-1.726-1.813-1.726-.386 0-.762.097-1.088.297a.75.75 0 01-1.036-.228A4.03 4.03 0 008 4.5c-2.19 0-3.97 1.751-3.97 3.912 0 .172.012.343.035.513a.75.75 0 01-.649.846A1.474 1.474 0 001.5 11.228c0 .62.4 1.149.932 1.355a.75.75 0 11-.494 1.417A2.972 2.972 0 010 11.228a2.973 2.973 0 012.441-2.919 5.441 5.441 0 01-.035-.597A5.404 5.404 0 014.406 1.342z" />
    <path d="M8.75 6.5v4.25a.75.75 0 01-1.5 0V6.5L5.72 8.03a.75.75 0 01-1.06-1.06l2.5-2.5a.75.75 0 011.06 0l2.5 2.5a.75.75 0 11-1.06 1.06L8.75 6.5z" />
  </svg>
)

// Tooltip component
function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  return (
    <div className="relative group/tooltip">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-zinc-800 border border-zinc-600 rounded shadow-lg text-xs text-zinc-100 whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50">
        {content}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-600" />
      </div>
    </div>
  )
}

// Pull strategy menu
function PullStrategyMenu({
  onSelect,
  onClose
}: {
  onSelect: (rebase: boolean) => void
  onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-full left-0 mt-1 w-44 bg-surface border border-default rounded shadow-lg z-50">
        <button
          onClick={() => onSelect(false)}
          className="w-full px-3 py-2 text-left text-xs hover:bg-hover flex flex-col"
        >
          <span className="text-primary">Pull (merge)</span>
          <span className="text-muted/70">Create merge commit</span>
        </button>
        <button
          onClick={() => onSelect(true)}
          className="w-full px-3 py-2 text-left text-xs hover:bg-hover flex flex-col"
        >
          <span className="text-primary">Pull (rebase)</span>
          <span className="text-muted/70">Rebase local commits</span>
        </button>
      </div>
    </>
  )
}

// Branch sync status component
interface BranchSyncStatusProps {
  workspacePath: string
  currentBranch: string
  onSyncComplete: () => void
}

function BranchSyncStatus({ workspacePath, currentBranch, onSyncComplete }: BranchSyncStatusProps) {
  const [syncStatus, setSyncStatus] = useState<{
    ahead: number
    behind: number
    upstream: string | null
    remote: string | null
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showPullMenu, setShowPullMenu] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSyncStatus = useCallback(async () => {
    const result = await window.api.git.syncStatus(workspacePath)
    if (result.success && result.data) {
      setSyncStatus(result.data)
      setError(null)
    }
  }, [workspacePath])

  useEffect(() => {
    loadSyncStatus()
  }, [loadSyncStatus, currentBranch])

  const handleFetch = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await window.api.git.fetch(workspacePath)
      if (result.success) {
        await loadSyncStatus()
      } else {
        setError(result.error || 'Fetch failed')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handlePush = async () => {
    setIsLoading(true)
    setError(null)
    try {
      let result
      if (!syncStatus?.upstream) {
        result = await window.api.git.pushSetUpstream(workspacePath, 'origin', currentBranch)
      } else {
        result = await window.api.git.push(workspacePath)
      }
      if (result.success) {
        await loadSyncStatus()
        onSyncComplete()
      } else {
        setError(result.error || 'Push failed')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handlePull = async (rebase: boolean) => {
    setIsLoading(true)
    setShowPullMenu(false)
    setError(null)
    try {
      const result = rebase
        ? await window.api.git.pullRebase(workspacePath)
        : await window.api.git.pull(workspacePath)
      if (result.success) {
        await loadSyncStatus()
        onSyncComplete()
      } else {
        setError(result.error || 'Pull failed')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (!syncStatus) return null

  const { ahead, behind, upstream } = syncStatus
  const hasUpstream = !!upstream

  return (
    <div className="flex items-center gap-3 px-1 py-2 bg-surface/50 rounded-lg border border-default/50 text-xs">
      {/* Upstream info */}
      <div className="flex items-center gap-2">
        <span className="text-muted/70">Remote:</span>
        {hasUpstream ? (
          <span className="text-muted font-mono">{upstream}</span>
        ) : (
          <span className="text-muted/50 italic">No tracking branch</span>
        )}
      </div>

      {/* Ahead/Behind indicators */}
      {hasUpstream && (
        <div className="flex items-center gap-2">
          {ahead > 0 && (
            <span className="text-green-400 flex items-center gap-0.5" title={`${ahead} commit${ahead !== 1 ? 's' : ''} ahead`}>
              <ArrowUpIcon />
              {ahead}
            </span>
          )}
          {behind > 0 && (
            <span className="text-amber-400 flex items-center gap-0.5" title={`${behind} commit${behind !== 1 ? 's' : ''} behind`}>
              <ArrowDownIcon />
              {behind}
            </span>
          )}
          {ahead === 0 && behind === 0 && (
            <span className="text-green-400/70 flex items-center gap-1">
              <CheckIcon />
              Synced
            </span>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <span className="text-red-400 truncate max-w-[200px]" title={error}>
          {error}
        </span>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-1 ml-auto">
        {isLoading ? (
          <div className="px-2">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            {/* Fetch button */}
            <Tooltip content="Fetch from remote">
              <button
                onClick={handleFetch}
                className="p-1.5 rounded hover:bg-hover text-muted hover:text-primary transition-colors"
              >
                <RefreshIcon />
              </button>
            </Tooltip>

            {/* Pull button */}
            {hasUpstream && behind > 0 && (
              <div className="relative">
                <Tooltip content={`Pull ${behind} commit${behind !== 1 ? 's' : ''}`}>
                  <button
                    onClick={() => setShowPullMenu(!showPullMenu)}
                    className="px-2 py-1 rounded hover:bg-hover text-amber-400 flex items-center gap-1 transition-colors"
                  >
                    <ArrowDownIcon />
                    Pull
                    <ChevronDownIcon />
                  </button>
                </Tooltip>
                {showPullMenu && (
                  <PullStrategyMenu
                    onSelect={handlePull}
                    onClose={() => setShowPullMenu(false)}
                  />
                )}
              </div>
            )}

            {/* Push / Publish button */}
            {(ahead > 0 || !hasUpstream) && (
              <Tooltip content={hasUpstream ? `Push ${ahead} commit${ahead !== 1 ? 's' : ''}` : 'Publish branch to remote'}>
                <button
                  onClick={handlePush}
                  className="px-2 py-1 rounded bg-green-600/20 hover:bg-green-600/30 text-green-400 flex items-center gap-1 transition-colors"
                >
                  {hasUpstream ? <ArrowUpIcon /> : <CloudUploadIcon />}
                  {hasUpstream ? 'Push' : 'Publish'}
                </button>
              </Tooltip>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const BRANCHES_PER_PAGE = 5
const COMMITS_PER_BRANCH = 10

// Format date for display
function formatCommitDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60))
        return `${diffMins}m ago`
      }
      return `${diffHours}h ago`
    } else if (diffDays === 1) {
      return 'yesterday'
    } else if (diffDays < 7) {
      return `${diffDays}d ago`
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  } catch {
    return dateString
  }
}

// Get display name for a branch (without origin/ prefix for remote branches)
function getDisplayName(branch: GitBranch): string {
  if (branch.isRemote) {
    return branch.name.split('/').slice(1).join('/')
  }
  return branch.name
}

interface BranchColumnProps {
  branch: GitBranch
  commits: GitCommit[]
  isLoading: boolean
  isCheckingOut: boolean
  onCheckout: () => void
  onDelete: () => void
}

function BranchColumn({ branch, commits, isLoading, isCheckingOut, onCheckout, onDelete }: BranchColumnProps) {
  const displayName = getDisplayName(branch)

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete()
  }

  return (
    <div
      className={`
        flex flex-col rounded-lg overflow-hidden min-w-0
        ${branch.isCurrent
          ? 'bg-accent/10 border-2 border-accent/50'
          : branch.isRemote
            ? 'bg-input border border-dashed border-default'
            : 'bg-input border border-default'
        }
      `}
    >
      {/* Branch header */}
      <div
        onClick={branch.isCurrent ? undefined : onCheckout}
        className={`
          p-3 border-b border-default group
          ${branch.isCurrent
            ? 'cursor-default'
            : 'cursor-pointer hover:bg-hover'
          }
          ${isCheckingOut ? 'opacity-50' : ''}
        `}
      >
        <div className="flex items-center gap-2">
          {isCheckingOut ? (
            <LoadingSpinner />
          ) : (
            <span className={branch.isCurrent ? 'text-accent' : 'text-muted'}>
              <GitBranchIcon />
            </span>
          )}
          <span className="font-medium truncate text-sm flex-1" title={branch.name}>
            {displayName}
          </span>
          {branch.isCurrent && (
            <span className="text-accent flex-shrink-0">
              <CheckIcon />
            </span>
          )}
          {/* Delete button - only for non-current branches */}
          {!branch.isCurrent && (
            <button
              onClick={handleDeleteClick}
              className="p-1 text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              title="Delete branch"
            >
              <TrashIcon />
            </button>
          )}
        </div>
        {branch.isRemote && !branch.isCurrent && (
          <span className="text-xs text-muted mt-1 block">remote</span>
        )}
      </div>

      {/* Commits list */}
      <div className="flex-1 overflow-y-auto max-h-96">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted">
            <LoadingSpinner />
            <span className="text-xs">Loading...</span>
          </div>
        ) : commits.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted">No commits</div>
        ) : (
          <div className="divide-y divide-default">
            {commits.map((commit) => (
              <div key={commit.hash} className="p-2 hover:bg-hover">
                <div className="flex items-center gap-1.5 mb-1">
                  <CommitIcon />
                  <span className="font-mono text-xs text-accent">
                    {commit.hash.slice(0, 7)}
                  </span>
                </div>
                <p className="text-xs text-secondary truncate" title={commit.message}>
                  {commit.message}
                </p>
                {commit.date && (
                  <p className="text-xs text-muted mt-1">
                    {formatCommitDate(commit.date)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function BranchCommitsGrid({ workspacePath, workspaceId, onBranchChange, localOnly = false }: BranchCommitsGridProps) {
  const [branches, setBranches] = useState<GitBranch[]>([])
  const [branchCommits, setBranchCommits] = useState<Map<string, GitCommit[]>>(new Map())
  const [loadingBranches, setLoadingBranches] = useState<Set<string>>(new Set())
  const [pageIndex, setPageIndex] = useState(0)
  const [isLoadingBranches, setIsLoadingBranches] = useState(true)
  const [isCheckingOut, setIsCheckingOut] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ branchName: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [defaultBranch, setDefaultBranch] = useState<string | null>(null)
  const triggerFileTreeRefresh = useFileTreeStore((state) => state.triggerRefresh)
  const branchRefreshKey = useWorkspaceStore((state) => state.branchRefreshKey)

  // Sort branches: current first, then local, then remote (excluding duplicates)
  const sortedBranches = useCallback(() => {
    const localBranches = branches.filter(b => !b.isRemote)

    // If localOnly mode, only return local branches
    if (localOnly) {
      return localBranches.sort((a, b) => {
        if (a.isCurrent) return -1
        if (b.isCurrent) return 1
        return a.name.localeCompare(b.name)
      })
    }

    const remoteBranches = branches.filter(b => b.isRemote)

    // Filter out remote branches that have local equivalents
    const localNames = new Set(localBranches.map(b => b.name))
    const uniqueRemoteBranches = remoteBranches.filter(b => {
      const remoteName = b.name.split('/').slice(1).join('/')
      return !localNames.has(remoteName)
    })

    // Sort: current first, then local, then remote
    return [...localBranches, ...uniqueRemoteBranches].sort((a, b) => {
      if (a.isCurrent) return -1
      if (b.isCurrent) return 1
      if (a.isRemote !== b.isRemote) return a.isRemote ? 1 : -1
      return a.name.localeCompare(b.name)
    })
  }, [branches, localOnly])

  const allBranches = sortedBranches()
  const totalPages = Math.ceil(allBranches.length / BRANCHES_PER_PAGE)
  const visibleBranches = allBranches.slice(
    pageIndex * BRANCHES_PER_PAGE,
    (pageIndex + 1) * BRANCHES_PER_PAGE
  )

  // Load branches function
  const loadBranches = useCallback(async () => {
    setIsLoadingBranches(true)
    setError(null)

    // Fetch default branch first
    try {
      const defaultResult = await window.api.git.getDefaultBranch(workspacePath)
      if (defaultResult.success && defaultResult.data) {
        setDefaultBranch(defaultResult.data)
      }
    } catch {
      // Default branch not found, that's okay
    }

    try {
      const result = await window.api.git.listBranches(workspacePath)
      if (result.success && result.data) {
        setBranches(result.data)
      } else {
        setError(result.error || 'Failed to load branches')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setIsLoadingBranches(false)
    }
  }, [workspacePath])

  // Load default branch and all branches, listen for changes
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
  }, [workspacePath, branchRefreshKey, loadBranches])

  // Load commits for visible branches
  useEffect(() => {
    const branchesToLoad = visibleBranches.filter(
      b => !branchCommits.has(b.name) && !loadingBranches.has(b.name)
    )

    if (branchesToLoad.length === 0) return

    // Mark branches as loading
    setLoadingBranches(prev => {
      const next = new Set(prev)
      branchesToLoad.forEach(b => next.add(b.name))
      return next
    })

    // Load commits in parallel
    // For agent branches, use logForBranchOnly to show only new commits (like GitButler)
    Promise.all(
      branchesToLoad.map(async (branch) => {
        try {
          const isAgentBranch = branch.name.startsWith('agent/')

          // For agent branches, show only commits unique to that branch
          if (isAgentBranch && defaultBranch) {
            const result = await window.api.git.logForBranchOnly(
              workspacePath,
              branch.name,
              defaultBranch,
              COMMITS_PER_BRANCH
            )
            return {
              branchName: branch.name,
              commits: result.success && result.data ? result.data : []
            }
          }

          // For non-agent branches, show regular log
          const result = await window.api.git.logForBranch(
            workspacePath,
            branch.name,
            COMMITS_PER_BRANCH
          )
          return {
            branchName: branch.name,
            commits: result.success && result.data ? result.data : []
          }
        } catch {
          return { branchName: branch.name, commits: [] }
        }
      })
    ).then((results) => {
      setBranchCommits(prev => {
        const next = new Map(prev)
        results.forEach(({ branchName, commits }) => {
          next.set(branchName, commits)
        })
        return next
      })
      setLoadingBranches(prev => {
        const next = new Set(prev)
        results.forEach(({ branchName }) => next.delete(branchName))
        return next
      })
    })
  }, [visibleBranches, workspacePath, branchCommits, loadingBranches, defaultBranch])

  const handleCheckout = async (branch: GitBranch) => {
    if (branch.isCurrent || isCheckingOut) return

    setIsCheckingOut(branch.name)
    setError(null)

    try {
      const result = await window.api.git.checkout(workspacePath, branch.name, branch.isRemote)
      if (result.success) {
        onBranchChange()
        triggerFileTreeRefresh() // Refresh file tree since files changed on disk
        // Reload branches to update current status
        const branchResult = await window.api.git.listBranches(workspacePath)
        if (branchResult.success && branchResult.data) {
          setBranches(branchResult.data)
        }
      } else {
        setError(result.error || 'Failed to checkout branch')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setIsCheckingOut(null)
    }
  }

  const handlePrevPage = () => {
    setPageIndex(prev => Math.max(0, prev - 1))
  }

  const handleNextPage = () => {
    setPageIndex(prev => Math.min(totalPages - 1, prev + 1))
  }

  const handleDelete = (branch: GitBranch) => {
    if (branch.isCurrent) return
    setDeleteConfirm({ branchName: branch.name })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return

    setIsDeleting(true)
    try {
      const result = await window.api.git.deleteBranch(workspacePath, deleteConfirm.branchName, true, workspaceId)
      if (result.success) {
        // Reload branches
        const branchResult = await window.api.git.listBranches(workspacePath)
        if (branchResult.success && branchResult.data) {
          setBranches(branchResult.data)
          // Clear commits cache for deleted branch
          setBranchCommits(prev => {
            const next = new Map(prev)
            next.delete(deleteConfirm.branchName)
            return next
          })
        }
        onBranchChange()
        // Trigger conversation refresh since branch deletion may have cascade-deleted conversations
        useChatStore.getState().triggerConversationRefresh()
        // Trigger branch refresh so AgentSessionsPanel also updates
        useWorkspaceStore.getState().triggerBranchRefresh()
      } else {
        setError(result.error || 'Failed to delete branch')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setIsDeleting(false)
      setDeleteConfirm(null)
    }
  }

  if (isLoadingBranches) {
    return (
      <div className="flex items-center gap-2 text-muted py-4">
        <LoadingSpinner />
        <span className="text-sm">Loading branches...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-sm text-red-400 py-4">{error}</div>
    )
  }

  if (allBranches.length === 0) {
    return (
      <div className="text-sm text-muted py-4">No branches found</div>
    )
  }

  // Get current branch name
  const currentBranch = branches.find(b => b.isCurrent)

  // Reload branches after sync
  const handleSyncComplete = () => {
    onBranchChange()
    // Reload branches to get updated commit counts
    window.api.git.listBranches(workspacePath).then((result) => {
      if (result.success && result.data) {
        setBranches(result.data)
        // Clear commits cache to force reload
        setBranchCommits(new Map())
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider">
          {localOnly ? 'Local Branches' : 'Branches'}
        </h2>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={pageIndex === 0}
              className="p-1 rounded hover:bg-hover disabled:opacity-30 disabled:cursor-not-allowed text-muted hover:text-secondary transition-colors"
            >
              <ChevronLeftIcon />
            </button>
            <span className="text-xs text-muted">
              {pageIndex * BRANCHES_PER_PAGE + 1}-{Math.min((pageIndex + 1) * BRANCHES_PER_PAGE, allBranches.length)} of {allBranches.length}
            </span>
            <button
              onClick={handleNextPage}
              disabled={pageIndex >= totalPages - 1}
              className="p-1 rounded hover:bg-hover disabled:opacity-30 disabled:cursor-not-allowed text-muted hover:text-secondary transition-colors"
            >
              <ChevronRightIcon />
            </button>
          </div>
        )}
      </div>

      {/* Sync status for current branch */}
      {currentBranch && (
        <BranchSyncStatus
          workspacePath={workspacePath}
          currentBranch={currentBranch.name}
          onSyncComplete={handleSyncComplete}
        />
      )}

      {/* 5-column grid */}
      <div className="grid grid-cols-5 gap-3">
        {visibleBranches.map((branch) => (
          <BranchColumn
            key={branch.name}
            branch={branch}
            commits={branchCommits.get(branch.name) || []}
            isLoading={loadingBranches.has(branch.name)}
            isCheckingOut={isCheckingOut === branch.name}
            onCheckout={() => handleCheckout(branch)}
            onDelete={() => handleDelete(branch)}
          />
        ))}
        {/* Fill empty slots if fewer than 5 branches */}
        {visibleBranches.length < BRANCHES_PER_PAGE && (
          Array.from({ length: BRANCHES_PER_PAGE - visibleBranches.length }).map((_, i) => (
            <div key={`empty-${i}`} className="rounded-lg border border-dashed border-default opacity-30" />
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[15%] z-50">
          <div className="bg-surface border border-default rounded-lg shadow-xl w-[420px]">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-default">
              <div className="p-2 bg-red-500/10 rounded-full">
                <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-primary font-medium">Delete Branch</h3>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
              <p className="text-secondary text-sm">
                Are you sure you want to delete this branch?
              </p>
              <div className="bg-hover/50 rounded px-3 py-2 border border-default">
                <code className="text-sm text-primary font-mono">{deleteConfirm.branchName}</code>
              </div>
              <p className="text-muted text-xs">
                This action cannot be undone. Any unmerged commits will be lost.
              </p>
            </div>

            {/* Actions */}
            <div className="px-4 pb-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm rounded-md border border-default hover:bg-hover text-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${
                  isDeleting
                    ? 'bg-red-600/50 text-white/50 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {isDeleting ? 'Deleting...' : 'Delete Branch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
