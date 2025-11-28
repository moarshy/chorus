import { useState, useEffect, useRef } from 'react'

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

export function BranchSelector({ currentBranch, workspacePath, onBranchChange }: BranchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [branches, setBranches] = useState<GitBranch[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

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
      const result = await window.api.git.checkout(workspacePath, branch.name)
      if (result.success) {
        // Get the local branch name for display
        const localName = branch.isRemote
          ? branch.name.split('/').slice(1).join('/')
          : branch.name
        onBranchChange(localName)
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
                    <button
                      key={branch.name}
                      onClick={() => handleSelectBranch(branch)}
                      disabled={isCheckingOut}
                      className={`
                        w-full px-3 py-1.5 text-left text-sm flex items-center gap-2
                        ${branch.isCurrent
                          ? 'text-primary bg-selected'
                          : 'text-secondary hover:bg-hover hover:text-primary'
                        }
                        disabled:opacity-50
                      `}
                    >
                      <span className="w-4 flex-shrink-0">
                        {branch.isCurrent && <CheckIcon />}
                      </span>
                      <span className="truncate">{branch.name}</span>
                    </button>
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
    </div>
  )
}
