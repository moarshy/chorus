import { useState, useEffect } from 'react'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useUIStore } from '../../stores/ui-store'
import type { GhCliStatus } from '../../../../preload/index.d'

type Mode = 'local' | 'clone' | 'create'
type CreateStep = 'form' | 'creating'

const CREATION_STEPS = [
  { id: 'create', label: 'Creating GitHub repository' },
  { id: 'clone', label: 'Cloning to local machine' },
  { id: 'init', label: 'Initializing default commands' },
  { id: 'push', label: 'Committing and pushing' },
  { id: 'add', label: 'Adding to Chorus' }
]

export function AddWorkspaceDialog() {
  const { addWorkspace, cloneWorkspace, error, clearError, settings } = useWorkspaceStore()
  const { closeAddWorkspace } = useUIStore()

  // Mode state
  const [mode, setMode] = useState<Mode>('local')

  // Local path mode state
  const [localPath, setLocalPath] = useState('')

  // Clone mode state
  const [cloneUrl, setCloneUrl] = useState('')

  // Create mode state
  const [repoName, setRepoName] = useState('')
  const [repoDescription, setRepoDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(true)
  const [createStep, setCreateStep] = useState<CreateStep>('form')
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [ghCliStatus, setGhCliStatus] = useState<GhCliStatus | null>(null)

  // Shared state
  const [isLoading, setIsLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  // Check gh CLI status when switching to create mode
  useEffect(() => {
    if (mode === 'create') {
      setLocalError(null)
      window.api.git.checkGhCli().then((result) => {
        if (result.success && result.data) {
          setGhCliStatus(result.data)
          if (!result.data.installed) {
            setLocalError(
              'GitHub CLI is not installed. Please install it from https://cli.github.com/'
            )
          } else if (!result.data.authenticated) {
            setLocalError('Please authenticate with GitHub CLI by running: gh auth login')
          }
        }
      })
    }
  }, [mode])

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

  const handleCreate = async () => {
    if (!repoName) return

    // Validate repo name
    const nameError = validateRepoName(repoName)
    if (nameError) {
      setLocalError(nameError)
      return
    }

    // Check if root dir is set
    if (!settings?.rootWorkspaceDir) {
      setLocalError('Please set a root workspace directory in Settings first')
      return
    }

    // Start creation process
    setCreateStep('creating')
    setCurrentStepIndex(0)
    setLocalError(null)
    clearError()

    const targetDir = `${settings.rootWorkspaceDir}/${repoName}`

    try {
      // Step 0: Create GitHub repo
      const createResult = await window.api.git.createRepo(repoName, {
        description: repoDescription || undefined,
        isPrivate
      })
      if (!createResult.success) {
        throw new Error(createResult.error || 'Failed to create repository')
      }
      setCurrentStepIndex(1)

      // Step 1: Clone the repo
      const cloneResult = await window.api.git.clone(createResult.data!.cloneUrl, targetDir)
      if (!cloneResult.success) {
        throw new Error(cloneResult.error || 'Failed to clone repository')
      }
      setCurrentStepIndex(2)

      // Step 2-3: Initialize workspace with default commands (handles commit/push internally)
      const initResult = await window.api.git.initializeWorkspace(targetDir)
      if (!initResult.success) {
        throw new Error(initResult.error || 'Failed to initialize workspace')
      }
      setCurrentStepIndex(4)

      // Step 4: Add to Chorus
      await addWorkspace(targetDir)

      // Success! Close dialog
      closeAddWorkspace()
    } catch (err) {
      // Cleanup: delete local directory if it exists
      try {
        await window.api.fs.delete(targetDir)
      } catch {
        // Ignore cleanup errors
      }

      setLocalError(err instanceof Error ? err.message : String(err))
      setCreateStep('form')
    }
  }

  const handleClose = () => {
    clearError()
    closeAddWorkspace()
  }

  const handleRepoNameChange = (value: string) => {
    // Transform: lowercase, remove invalid characters
    const transformed = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setRepoName(transformed)
    // Clear error when user types
    if (localError && localError.includes('Repository name')) {
      setLocalError(null)
    }
  }

  const displayError = localError || error

  // Determine if create button should be disabled
  const isCreateDisabled =
    !repoName ||
    isLoading ||
    createStep === 'creating' ||
    !settings?.rootWorkspaceDir ||
    (ghCliStatus !== null && !ghCliStatus.authenticated)

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
          <button
            onClick={() => setMode('create')}
            className={`flex-1 py-2 px-4 rounded text-sm transition-colors ${
              mode === 'create' ? 'bg-selected text-primary' : 'text-secondary hover:text-primary'
            }`}
          >
            Create New
          </button>
        </div>

        {/* Local path mode */}
        {mode === 'local' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-secondary mb-2">Repository Path</label>
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
              <label className="block text-sm text-secondary mb-2">GitHub URL</label>
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

        {/* Create mode - Form */}
        {mode === 'create' && createStep === 'form' && (
          <div className="space-y-4">
            {/* Repository Name */}
            <div>
              <label className="block text-sm text-secondary mb-2">
                Repository Name <span className="text-status-error">*</span>
              </label>
              <input
                type="text"
                value={repoName}
                onChange={(e) => handleRepoNameChange(e.target.value)}
                placeholder="my-agent-project"
                className="input"
                maxLength={100}
              />
              {repoName && (
                <p className="text-xs text-muted mt-1">
                  Will be created at: {settings?.rootWorkspaceDir || '(set in settings)'}/{repoName}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm text-secondary mb-2">Description (optional)</label>
              <input
                type="text"
                value={repoDescription}
                onChange={(e) => setRepoDescription(e.target.value)}
                placeholder="A new agent workspace"
                className="input"
                maxLength={350}
              />
            </div>

            {/* Visibility toggle */}
            <div>
              <label className="block text-sm text-secondary mb-2">Visibility</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!isPrivate}
                    onChange={() => setIsPrivate(false)}
                    className="accent-accent"
                  />
                  <span className="text-sm">Public</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={isPrivate}
                    onChange={() => setIsPrivate(true)}
                    className="accent-accent"
                  />
                  <span className="text-sm">Private</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Create mode - Progress */}
        {mode === 'create' && createStep === 'creating' && (
          <div className="space-y-3">
            <p className="text-sm text-secondary mb-4">Creating workspace...</p>
            {CREATION_STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center gap-3">
                {index < currentStepIndex ? (
                  <span className="text-status-success text-lg">✓</span>
                ) : index === currentStepIndex ? (
                  <span className="text-accent animate-pulse">●</span>
                ) : (
                  <span className="text-muted">○</span>
                )}
                <span
                  className={
                    index < currentStepIndex
                      ? 'text-primary'
                      : index === currentStepIndex
                        ? 'text-primary'
                        : 'text-muted'
                  }
                >
                  {step.label}
                </span>
              </div>
            ))}
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
          <button
            onClick={handleClose}
            className="btn btn-secondary"
            disabled={createStep === 'creating'}
          >
            Cancel
          </button>
          {mode === 'local' && (
            <button
              onClick={handleAddLocal}
              className="btn btn-primary"
              disabled={!localPath || isLoading}
            >
              {isLoading ? 'Adding...' : 'Add Workspace'}
            </button>
          )}
          {mode === 'clone' && (
            <button
              onClick={handleClone}
              className="btn btn-primary"
              disabled={!cloneUrl || isLoading}
            >
              {isLoading ? 'Starting...' : 'Clone Repository'}
            </button>
          )}
          {mode === 'create' && (
            <button onClick={handleCreate} className="btn btn-primary" disabled={isCreateDisabled}>
              {createStep === 'creating' ? 'Creating...' : 'Create Workspace'}
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

function validateRepoName(name: string): string | null {
  if (!name) return 'Repository name is required'
  if (name.length > 100) return 'Repository name must be 100 characters or less'
  if (!/^[a-z0-9]/.test(name)) return 'Repository name must start with a letter or number'
  if (!/[a-z0-9]$/.test(name)) return 'Repository name must end with a letter or number'
  if (!/^[a-z0-9-]+$/.test(name))
    return 'Repository name can only contain lowercase letters, numbers, and hyphens'
  if (name.includes('--')) return 'Repository name cannot contain consecutive hyphens'
  return null
}
