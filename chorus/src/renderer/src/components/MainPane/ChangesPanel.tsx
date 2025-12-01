import { useEffect, useState } from 'react'
import type { GitStatus, GitChange } from '../../types'
import { useFileTreeStore } from '../../stores/file-tree-store'

interface ChangesPanelProps {
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

const WarningIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-amber-400">
    <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575L6.457 1.047zM8 5a.75.75 0 00-.75.75v2.5a.75.75 0 001.5 0v-2.5A.75.75 0 008 5zm1 6a1 1 0 11-2 0 1 1 0 012 0z" />
  </svg>
)

// Action icons
const DiscardIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 1a7 7 0 11-4.95 11.95l-.707.707A8 8 0 108 0v1z" />
    <path d="M7.5 3v5.293L5.354 6.146a.5.5 0 10-.708.708l3 3a.5.5 0 00.708 0l3-3a.5.5 0 00-.708-.708L8.5 8.293V3a.5.5 0 00-1 0z" />
  </svg>
)

const StageIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z" />
  </svg>
)

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

// Confirmation dialog state
interface DiscardConfirmState {
  file: string
  status: string
}

export function ChangesPanel({ workspacePath }: ChangesPanelProps) {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [discardConfirm, setDiscardConfirm] = useState<DiscardConfirmState | null>(null)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const triggerFileTreeRefresh = useFileTreeStore((state) => state.triggerRefresh)

  const loadStatus = async () => {
    const result = await window.api.git.status(workspacePath)
    if (result.success && result.data) {
      setStatus(result.data)
    }
  }

  useEffect(() => {
    setIsLoading(true)
    loadStatus().finally(() => setIsLoading(false))
  }, [workspacePath])

  const handleDiscard = async (change: GitChange) => {
    setDiscardConfirm({ file: change.file, status: change.status })
  }

  const handleDiscardConfirm = async () => {
    if (!discardConfirm) return

    setActionInProgress(discardConfirm.file)
    try {
      const result = await window.api.git.discardChanges(workspacePath, discardConfirm.file)
      if (result.success) {
        await loadStatus() // Refresh the git status list
        triggerFileTreeRefresh() // Refresh file tree since files changed on disk
      } else {
        console.error('Failed to discard:', result.error)
      }
    } catch (error) {
      console.error('Discard failed:', error)
    } finally {
      setActionInProgress(null)
      setDiscardConfirm(null)
    }
  }

  const handleStage = async (change: GitChange) => {
    setActionInProgress(change.file)
    try {
      const result = await window.api.git.stageFile(workspacePath, change.file)
      if (result.success) {
        await loadStatus()
      }
    } catch (error) {
      console.error('Stage failed:', error)
    } finally {
      setActionInProgress(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted p-4">
        <div className="w-4 h-4 border-2 border-muted border-t-transparent rounded-full animate-spin" />
        Loading changes...
      </div>
    )
  }

  if (!status || status.changes.length === 0) {
    return null
  }

  return (
    <div className="rounded-lg bg-input border border-default p-4 mb-6">
      <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
        <WarningIcon />
        <span>Uncommitted Changes ({status.changes.length})</span>
      </h3>
      <div className="space-y-1">
        {status.changes.slice(0, 10).map((change, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-hover group"
          >
            <span className="flex-shrink-0">{getStatusIcon(change.status)}</span>
            <span className="font-mono text-muted truncate min-w-0 flex-1">{change.file}</span>

            {/* Action buttons - show on hover */}
            <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {actionInProgress === change.file ? (
                <div className="w-4 h-4 border-2 border-muted border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <button
                    onClick={() => handleStage(change)}
                    className="p-1 text-muted hover:text-green-400 transition-colors"
                    title="Stage changes"
                  >
                    <StageIcon />
                  </button>
                  <button
                    onClick={() => handleDiscard(change)}
                    className="p-1 text-muted hover:text-red-400 transition-colors"
                    title="Discard changes"
                  >
                    <DiscardIcon />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {status.changes.length > 10 && (
          <p className="text-xs text-muted pl-6">
            +{status.changes.length - 10} more files
          </p>
        )}
      </div>

      {/* Discard Confirmation Dialog */}
      {discardConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-[15%] z-50">
          <div className="bg-surface border border-default rounded shadow-lg w-[400px]">
            <div className="p-4">
              <p className="text-primary text-sm">
                Discard changes to <span className="font-mono text-secondary">{discardConfirm.file}</span>?
              </p>
              <p className="text-xs text-muted mt-2">
                {discardConfirm.status === 'D'
                  ? 'This will restore the deleted file.'
                  : discardConfirm.status === '??' || discardConfirm.status === 'A'
                  ? 'This will delete the untracked file.'
                  : 'This will revert changes to the last commit.'}
              </p>
            </div>
            <div className="px-4 pb-3 flex justify-end gap-2">
              <button
                onClick={() => setDiscardConfirm(null)}
                className="px-3 py-1.5 text-sm rounded border border-default hover:bg-hover text-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDiscardConfirm}
                className="px-3 py-1.5 text-sm rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
