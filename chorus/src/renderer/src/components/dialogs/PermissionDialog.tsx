import { useState } from 'react'
import type { PermissionRequestEvent } from '../../types'

interface PermissionDialogProps {
  request: PermissionRequestEvent
  onResponse: (approved: boolean, reason?: string) => void
}

export function PermissionDialog({ request, onResponse }: PermissionDialogProps) {
  const [denyReason, setDenyReason] = useState('')
  const [showDenyInput, setShowDenyInput] = useState(false)

  const handleAllow = () => {
    onResponse(true)
  }

  const handleDeny = () => {
    if (showDenyInput) {
      onResponse(false, denyReason || 'User denied permission')
    } else {
      setShowDenyInput(true)
    }
  }

  const handleDenyWithReason = () => {
    onResponse(false, denyReason || 'User denied permission')
  }

  // Format tool input for display
  const formatInput = (input: Record<string, unknown>): string => {
    try {
      return JSON.stringify(input, null, 2)
    } catch {
      return String(input)
    }
  }

  // Get a user-friendly description of the tool action
  const getToolDescription = (): string => {
    const { toolName, toolInput } = request
    switch (toolName) {
      case 'Bash':
        return `Execute command: ${toolInput.command || 'unknown command'}`
      case 'Write':
        return `Write to file: ${toolInput.file_path || 'unknown file'}`
      case 'Edit':
        return `Edit file: ${toolInput.file_path || 'unknown file'}`
      case 'WebFetch':
        return `Fetch URL: ${toolInput.url || 'unknown URL'}`
      case 'WebSearch':
        return `Search web: ${toolInput.query || 'unknown query'}`
      case 'NotebookEdit':
        return `Edit notebook: ${toolInput.notebook_path || 'unknown notebook'}`
      default:
        return `Execute tool: ${toolName}`
    }
  }

  return (
    <div className="dialog-overlay" onClick={() => {}}>
      <div className="dialog-content max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <svg
            className="w-6 h-6 text-status-warning"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h2 className="text-xl font-semibold">Permission Required</h2>
        </div>

        <p className="text-secondary mb-4">
          Claude wants to use the <span className="font-mono text-primary">{request.toolName}</span> tool.
        </p>

        <div className="mb-4 p-3 rounded bg-input">
          <p className="text-sm font-medium mb-2">{getToolDescription()}</p>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted hover:text-secondary">
              Show full details
            </summary>
            <pre className="mt-2 p-2 bg-selected rounded overflow-auto max-h-48 text-xs">
              {formatInput(request.toolInput)}
            </pre>
          </details>
        </div>

        {showDenyInput && (
          <div className="mb-4">
            <label className="block text-sm text-secondary mb-2">
              Reason for denial (optional)
            </label>
            <input
              type="text"
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              placeholder="Tell Claude why you're denying this..."
              className="input"
              autoFocus
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          {showDenyInput ? (
            <>
              <button onClick={() => setShowDenyInput(false)} className="btn btn-secondary">
                Back
              </button>
              <button onClick={handleDenyWithReason} className="btn btn-danger">
                Deny
              </button>
            </>
          ) : (
            <>
              <button onClick={handleDeny} className="btn btn-secondary">
                Deny
              </button>
              <button onClick={handleAllow} className="btn btn-primary">
                Allow
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
