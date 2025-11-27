import { useState, useEffect } from 'react'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useUIStore } from '../../stores/ui-store'

export function SettingsDialog() {
  const { settings, setRootWorkspaceDir } = useWorkspaceStore()
  const { closeSettings } = useUIStore()
  const [rootDir, setRootDir] = useState(settings?.rootWorkspaceDir || '')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (settings?.rootWorkspaceDir) {
      setRootDir(settings.rootWorkspaceDir)
    }
  }, [settings])

  const handleSelectDirectory = async () => {
    const result = await window.api.dialog.selectDirectory()
    if (result.success && result.data) {
      setRootDir(result.data)
    }
  }

  const handleSave = async () => {
    if (!rootDir) return

    setIsSaving(true)
    await setRootWorkspaceDir(rootDir)
    setIsSaving(false)
    closeSettings()
  }

  const handleClose = () => {
    closeSettings()
  }

  return (
    <div className="dialog-overlay" onClick={handleClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-4">Settings</h2>

        <div className="space-y-4">
          {/* Root workspace directory */}
          <div>
            <label className="block text-sm text-secondary mb-2">
              Root Workspace Directory
            </label>
            <p className="text-xs text-muted mb-2">
              This is where cloned repositories will be saved
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={rootDir}
                onChange={(e) => setRootDir(e.target.value)}
                placeholder="/path/to/workspaces"
                className="input flex-1"
                readOnly
              />
              <button onClick={handleSelectDirectory} className="btn btn-secondary">
                Browse
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={handleClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary"
            disabled={!rootDir || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
