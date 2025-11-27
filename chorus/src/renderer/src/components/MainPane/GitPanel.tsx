import { useEffect, useState } from 'react'
import type { GitStatus, GitCommit } from '../../types'

interface GitPanelProps {
  workspacePath: string
}

export function GitPanel({ workspacePath }: GitPanelProps): JSX.Element {
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
    return <div className="text-sm text-muted">Loading git info...</div>
  }

  return (
    <div className="space-y-4">
      {/* Changes section */}
      {status && status.changes.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-secondary mb-2">
            Changes ({status.changes.length})
          </h3>
          <div className="space-y-1">
            {status.changes.slice(0, 10).map((change, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm font-mono"
              >
                <span className={getStatusColor(change.status)}>
                  {change.status}
                </span>
                <span className="truncate text-muted">{change.file}</span>
              </div>
            ))}
            {status.changes.length > 10 && (
              <p className="text-xs text-muted">
                +{status.changes.length - 10} more files
              </p>
            )}
          </div>
        </div>
      )}

      {/* Commits section */}
      {commits.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-secondary mb-2">Recent Commits</h3>
          <div className="space-y-2">
            {commits.map((commit) => (
              <div key={commit.hash} className="flex gap-2 text-sm">
                <span className="font-mono text-accent">{commit.hash.slice(0, 7)}</span>
                <span className="truncate text-muted">{commit.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {(!status || status.changes.length === 0) && commits.length === 0 && (
        <p className="text-sm text-muted">No git activity</p>
      )}
    </div>
  )
}

function getStatusColor(status: string): string {
  switch (status.trim()) {
    case 'M':
      return 'status-busy' // Modified - yellow
    case 'A':
      return 'status-ready' // Added - green
    case 'D':
      return 'status-error' // Deleted - red
    case '?':
    case '??':
      return 'text-muted' // Untracked - gray
    default:
      return 'text-secondary'
  }
}
