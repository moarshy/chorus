import { useState, useEffect, useCallback } from 'react'
import type { GitBranch, GitCommit } from '../../types'

interface BranchCommitsGridProps {
  workspacePath: string
  onBranchChange: () => void
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
}

function BranchColumn({ branch, commits, isLoading, isCheckingOut, onCheckout }: BranchColumnProps) {
  const displayName = getDisplayName(branch)

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
          p-3 border-b border-default
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
          <span className="font-medium truncate text-sm" title={branch.name}>
            {displayName}
          </span>
          {branch.isCurrent && (
            <span className="text-accent flex-shrink-0">
              <CheckIcon />
            </span>
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

export function BranchCommitsGrid({ workspacePath, onBranchChange }: BranchCommitsGridProps) {
  const [branches, setBranches] = useState<GitBranch[]>([])
  const [branchCommits, setBranchCommits] = useState<Map<string, GitCommit[]>>(new Map())
  const [loadingBranches, setLoadingBranches] = useState<Set<string>>(new Set())
  const [pageIndex, setPageIndex] = useState(0)
  const [isLoadingBranches, setIsLoadingBranches] = useState(true)
  const [isCheckingOut, setIsCheckingOut] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Sort branches: current first, then local, then remote (excluding duplicates)
  const sortedBranches = useCallback(() => {
    const localBranches = branches.filter(b => !b.isRemote)
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
  }, [branches])

  const allBranches = sortedBranches()
  const totalPages = Math.ceil(allBranches.length / BRANCHES_PER_PAGE)
  const visibleBranches = allBranches.slice(
    pageIndex * BRANCHES_PER_PAGE,
    (pageIndex + 1) * BRANCHES_PER_PAGE
  )

  // Load all branches
  useEffect(() => {
    setIsLoadingBranches(true)
    setError(null)

    window.api.git.listBranches(workspacePath)
      .then((result) => {
        if (result.success && result.data) {
          setBranches(result.data)
        } else {
          setError(result.error || 'Failed to load branches')
        }
      })
      .catch((err) => {
        setError(String(err))
      })
      .finally(() => {
        setIsLoadingBranches(false)
      })
  }, [workspacePath])

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
    Promise.all(
      branchesToLoad.map(async (branch) => {
        try {
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
  }, [visibleBranches, workspacePath, branchCommits, loadingBranches])

  const handleCheckout = async (branch: GitBranch) => {
    if (branch.isCurrent || isCheckingOut) return

    setIsCheckingOut(branch.name)
    setError(null)

    try {
      const result = await window.api.git.checkout(workspacePath, branch.name)
      if (result.success) {
        onBranchChange()
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

  return (
    <div className="space-y-4">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider">
          Branches
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
          />
        ))}
        {/* Fill empty slots if fewer than 5 branches */}
        {visibleBranches.length < BRANCHES_PER_PAGE && (
          Array.from({ length: BRANCHES_PER_PAGE - visibleBranches.length }).map((_, i) => (
            <div key={`empty-${i}`} className="rounded-lg border border-dashed border-default opacity-30" />
          ))
        )}
      </div>
    </div>
  )
}
