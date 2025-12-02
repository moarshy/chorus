import { useState, useEffect, useRef } from 'react'
import { useFileTreeStore } from '../../stores/file-tree-store'

interface GitBranch {
  name: string
  isCurrent: boolean
  isRemote: boolean
}

interface BranchSelectorProps {
  currentBranch: string
  workspacePath: string
  onBranchChange: (branch: string) => void
}

const GitBranchIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z" />
  </svg>
)

const ChevronDownIcon = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
    <path
      d="M2.5 4.5L6 8L9.5 4.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
  </svg>
)

const LoadingSpinner = () => (
  <svg className="animate-spin" width="12" height="12" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
    <path
      d="M14 8a6 6 0 00-6-6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
)

const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 00-1.492-.149l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z" />
  </svg>
)

// Delete confirmation state
interface DeleteConfirmState {
  branchName: string
}

export function BranchSelector({ currentBranch, workspacePath, onBranchChange }: BranchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [branches, setBranches] = useState<GitBranch[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const triggerFileTreeRefresh = useFileTreeStore((state) => state.triggerRefresh)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const loadBranches = async () => {
    setIsLoading(true)
    setError(null)
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
      setIsLoading(false)
    }
  }

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isOpen) {
      // Calculate position based on button location
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect()
        setDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left
        })
      }
      setIsOpen(true)
      await loadBranches()
    } else {
      setIsOpen(false)
    }
  }

  const handleSelectBranch = async (branch: GitBranch) => {
    if (branch.isCurrent) {
      setIsOpen(false)
      return
    }

    setIsCheckingOut(true)
    setError(null)

    try {
      const result = await window.api.git.checkout(workspacePath, branch.name, branch.isRemote)
      if (result.success) {
        // Get the local branch name for display
        const localName = branch.isRemote
          ? branch.name.split('/').slice(1).join('/')
          : branch.name
        onBranchChange(localName)
        triggerFileTreeRefresh() // Refresh file tree since files changed on disk
        setIsOpen(false)
      } else {
        setError(result.error || 'Failed to checkout branch')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setIsCheckingOut(false)
    }
  }

  // Handle delete button click
  const handleDeleteClick = (e: React.MouseEvent, branchName: string) => {
    e.stopPropagation()
    setDeleteConfirm({ branchName })
  }

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return

    setIsDeleting(true)
    try {
      const result = await window.api.git.deleteBranch(workspacePath, deleteConfirm.branchName, true)
      if (result.success) {
        // Reload branches
        await loadBranches()
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


  // Separate local and remote branches
  const localBranches = branches.filter(b => !b.isRemote)
  const remoteBranches = branches.filter(b => b.isRemote)

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Branch button */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        disabled={isCheckingOut}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors group"
      >
        <span className="opacity-70 group-hover:opacity-100">
          <GitBranchIcon />
        </span>
        <span className="truncate max-w-24">
          {isCheckingOut ? 'Switching...' : currentBranch}
        </span>
        {isCheckingOut ? (
          <LoadingSpinner />
        ) : (
          <span className="opacity-50 group-hover:opacity-100">
            <ChevronDownIcon />
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="fixed z-50 bg-main border border-default rounded-lg shadow-xl py-1 min-w-48 max-w-64 max-h-80 overflow-y-auto"
          style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-4 text-muted">
              <LoadingSpinner />
              <span className="text-xs">Loading branches...</span>
            </div>
          ) : error ? (
            <div className="px-3 py-2 text-xs text-red-400">{error}</div>
          ) : (
            <>
              {/* Local branches */}
              {localBranches.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-xs font-medium text-muted uppercase tracking-wide">
                    Local
                  </div>
                  {localBranches.map((branch) => (
                    <div
                      key={branch.name}
                      className={`
                        flex items-center group
                        ${branch.isCurrent
                          ? 'text-primary bg-selected'
                          : 'text-secondary hover:bg-hover hover:text-primary'
                        }
                      `}
                    >
                      <button
                        onClick={() => handleSelectBranch(branch)}
                        disabled={isCheckingOut || isDeleting}
                        className="flex-1 px-3 py-1.5 text-left text-sm flex items-center gap-2 disabled:opacity-50"
                      >
                        <span className="w-4 flex-shrink-0">
                          {branch.isCurrent && <CheckIcon />}
                        </span>
                        <span className="truncate">{branch.name}</span>
                      </button>
                      {/* Delete button - only for non-current branches */}
                      {!branch.isCurrent && (
                        <button
                          onClick={(e) => handleDeleteClick(e, branch.name)}
                          disabled={isCheckingOut || isDeleting}
                          className="p-1.5 mr-1 text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                          title="Delete branch"
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Remote branches */}
              {remoteBranches.length > 0 && (
                <div className={localBranches.length > 0 ? 'border-t border-default mt-1 pt-1' : ''}>
                  <div className="px-3 py-1.5 text-xs font-medium text-muted uppercase tracking-wide">
                    Remote
                  </div>
                  {remoteBranches.map((branch) => (
                    <button
                      key={branch.name}
                      onClick={() => handleSelectBranch(branch)}
                      disabled={isCheckingOut}
                      className="w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 text-secondary hover:bg-hover hover:text-primary disabled:opacity-50"
                    >
                      <span className="w-4 flex-shrink-0" />
                      <span className="truncate opacity-75">{branch.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {localBranches.length === 0 && remoteBranches.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted">No branches found</div>
              )}
            </>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog - VS Code style */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-[15%] z-[100]">
          <div className="bg-surface border border-default rounded shadow-lg w-[400px]">
            <div className="p-4">
              <p className="text-primary text-sm">
                Delete branch <span className="font-mono text-secondary">{deleteConfirm.branchName}</span>?
              </p>
            </div>
            <div className="px-4 pb-3 flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-sm rounded border border-default hover:bg-hover text-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  isDeleting
                    ? 'bg-red-600/50 text-white/50 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
