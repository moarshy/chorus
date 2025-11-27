import { useState } from 'react'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useUIStore } from '../../stores/ui-store'

type Mode = 'local' | 'clone'

export function AddWorkspaceDialog(): JSX.Element {
  const { addWorkspace, cloneWorkspace, error, clearError, settings } = useWorkspaceStore()
  const { closeAddWorkspace } = useUIStore()

  const [mode, setMode] = useState<Mode>('local')
  const [localPath, setLocalPath] = useState('')
  const [cloneUrl, setCloneUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSelectDirectory = async () => {
    const result = await window.api.dialog.selectDirectory()
    if (result.success && result.data) {
      setLocalPath(result.data)
      setLocalError(null)
    }
  }

  const handleAddLocal = async () => {
    if (!localPath) return

    setIsLoading(true)
    setLocalError(null)
    clearError()

    await addWorkspace(localPath)

    setIsLoading(false)

    // Check if there was an error (from store)
    // If not, close the dialog
    if (!error) {
      closeAddWorkspace()
    }
  }

  const handleClone = async () => {
    if (!cloneUrl) return

    // Validate URL
    if (!isValidGitUrl(cloneUrl)) {
      setLocalError('Please enter a valid GitHub URL')
      return
    }

    // Check if root dir is set
    if (!settings?.rootWorkspaceDir) {
      setLocalError('Please set a root workspace directory in Settings first')
      return
    }

    setIsLoading(true)
    setLocalError(null)
    clearError()

    await cloneWorkspace(cloneUrl)

    // Close dialog - clone progress will show in sidebar
    closeAddWorkspace()
  }

  const handleClose = () => {
    clearError()
    closeAddWorkspace()
  }

  const displayError = localError || error

  return (
    <div className="dialog-overlay" onClick={handleClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-4">Add Workspace</h2>

        {/* Mode tabs */}
        <div className="flex gap-1 mb-4 p-1 bg-input rounded">
          <button
            onClick={() => setMode('local')}
            className={`flex-1 py-2 px-4 rounded text-sm transition-colors ${
              mode === 'local' ? 'bg-selected text-primary' : 'text-secondary hover:text-primary'
            }`}
          >
            Local Path
          </button>
          <button
            onClick={() => setMode('clone')}
            className={`flex-1 py-2 px-4 rounded text-sm transition-colors ${
              mode === 'clone' ? 'bg-selected text-primary' : 'text-secondary hover:text-primary'
            }`}
          >
            Clone from URL
          </button>
        </div>

        {/* Local path mode */}
        {mode === 'local' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-secondary mb-2">
                Repository Path
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  placeholder="/path/to/repository"
                  className="input flex-1"
                  readOnly
                />
                <button onClick={handleSelectDirectory} className="btn btn-secondary">
                  Browse
                </button>
              </div>
              <p className="text-xs text-muted mt-1">
                Select a folder containing a git repository
              </p>
            </div>
          </div>
        )}

        {/* Clone mode */}
        {mode === 'clone' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-secondary mb-2">
                GitHub URL
              </label>
              <input
                type="text"
                value={cloneUrl}
                onChange={(e) => setCloneUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="input"
              />
              <p className="text-xs text-muted mt-1">
                Repository will be cloned to: {settings?.rootWorkspaceDir || '(set in settings)'}
              </p>
            </div>
          </div>
        )}

        {/* Error display */}
        {displayError && (
          <div className="mt-4 p-3 rounded bg-input border border-status-error text-sm text-status-error">
            {displayError}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={handleClose} className="btn btn-secondary">
            Cancel
          </button>
          {mode === 'local' ? (
            <button
              onClick={handleAddLocal}
              className="btn btn-primary"
              disabled={!localPath || isLoading}
            >
              {isLoading ? 'Adding...' : 'Add Workspace'}
            </button>
          ) : (
            <button
              onClick={handleClone}
              className="btn btn-primary"
              disabled={!cloneUrl || isLoading}
            >
              {isLoading ? 'Starting...' : 'Clone Repository'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function isValidGitUrl(url: string): boolean {
  // Simple validation for GitHub URLs
  const patterns = [
    /^https:\/\/github\.com\/[\w-]+\/[\w.-]+$/,
    /^https:\/\/github\.com\/[\w-]+\/[\w.-]+\.git$/,
    /^git@github\.com:[\w-]+\/[\w.-]+\.git$/
  ]
  return patterns.some((pattern) => pattern.test(url))
}
