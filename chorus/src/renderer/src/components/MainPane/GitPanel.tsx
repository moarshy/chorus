import { useEffect, useState } from 'react'
import type { GitStatus, GitCommit } from '../../types'

interface GitPanelProps {
  workspacePath: string
}

// SVG Icons
const FileModifiedIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-amber-400">
    <path d="M2.75 14A1.75 1.75 0 011 12.25v-2.5a.75.75 0 011.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 00.25-.25v-2.5a.75.75 0 011.5 0v2.5A1.75 1.75 0 0113.25 14H2.75z" />
    <path d="M11.78 4.72a.75.75 0 00-1.06-1.06L8.75 5.63V1.5a.75.75 0 00-1.5 0v4.13L5.28 3.66a.75.75 0 00-1.06 1.06l3.25 3.25a.75.75 0 001.06 0l3.25-3.25z" />
  </svg>
)

const FileAddedIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-green-400">
    <path d="M8 0a8 8 0 110 16A8 8 0 018 0zm1.5 4.75a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" />
  </svg>
)

const FileDeletedIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-red-400">
    <path d="M8 0a8 8 0 110 16A8 8 0 018 0zM4.75 7.25a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" />
  </svg>
)

const FileUntrackedIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-gray-400">
    <path d="M8 0a8 8 0 110 16A8 8 0 018 0zM5.78 5.97a.75.75 0 00-1.06 1.06L6.94 9.25 4.72 11.47a.75.75 0 101.06 1.06l2.22-2.22 2.22 2.22a.75.75 0 101.06-1.06l-2.22-2.22 2.22-2.22a.75.75 0 00-1.06-1.06L8 7.19 5.78 5.97z" />
  </svg>
)

const CommitIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M11.93 8.5a4.002 4.002 0 01-7.86 0H.75a.75.75 0 010-1.5h3.32a4.002 4.002 0 017.86 0h3.32a.75.75 0 010 1.5h-3.32zm-1.43-.75a2.5 2.5 0 10-5 0 2.5 2.5 0 005 0z" />
  </svg>
)

const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0a8 8 0 110 16A8 8 0 018 0zm.5 4.75a.75.75 0 00-1.5 0v3.5a.75.75 0 00.471.696l2.5 1a.75.75 0 00.557-1.392L8.5 7.742V4.75z" />
  </svg>
)

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 16A8 8 0 108 0a8 8 0 000 16zm3.78-9.72a.75.75 0 00-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l4.5-4.5z" />
  </svg>
)

export function GitPanel({ workspacePath }: GitPanelProps) {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)

    Promise.all([
      window.api.git.status(workspacePath),
      window.api.git.log(workspacePath, 10)
    ])
      .then(([statusResult, logResult]) => {
        if (statusResult.success && statusResult.data) {
          setStatus(statusResult.data)
        }
        if (logResult.success && logResult.data) {
          setCommits(logResult.data)
        }
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [workspacePath])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <div className="w-4 h-4 border-2 border-muted border-t-transparent rounded-full animate-spin" />
        Loading git info...
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Changes section */}
      {status && status.changes.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Changes ({status.changes.length})
          </h3>
          <div className="space-y-1">
            {status.changes.slice(0, 10).map((change, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-hover"
              >
                {getStatusIcon(change.status)}
                <span className="font-mono text-muted truncate">{change.file}</span>
              </div>
            ))}
            {status.changes.length > 10 && (
              <p className="text-xs text-muted pl-6">
                +{status.changes.length - 10} more files
              </p>
            )}
          </div>
        </div>
      )}

      {/* Commits section */}
      {commits.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2 flex items-center gap-2">
            <CommitIcon />
            Recent Commits
          </h3>
          <div className="space-y-2">
            {commits.map((commit) => (
              <div key={commit.hash} className="flex items-start gap-3 text-sm py-1">
                <span className="font-mono text-accent flex-shrink-0">{commit.hash.slice(0, 7)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-secondary truncate">{commit.message}</p>
                  {commit.date && (
                    <p className="flex items-center gap-1 text-xs text-muted mt-0.5">
                      <ClockIcon />
                      {formatCommitDate(commit.date)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {(!status || status.changes.length === 0) && commits.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <CheckIcon />
          Working tree clean
        </div>
      )}
    </div>
  )
}

function getStatusIcon(status: string) {
  switch (status.trim()) {
    case 'M':
      return <FileModifiedIcon />
    case 'A':
      return <FileAddedIcon />
    case 'D':
      return <FileDeletedIcon />
    case '?':
    case '??':
      return <FileUntrackedIcon />
    default:
      return <FileModifiedIcon />
  }
}

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
