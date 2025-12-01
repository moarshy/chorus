import { WorkspaceItem } from './WorkspaceItem'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useUIStore } from '../../stores/ui-store'

// Settings Icon
const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

export function WorkspacesPanel() {
  const { workspaces, isLoading, cloneProgress } = useWorkspaceStore()
  const { openAddWorkspace, openSettings } = useUIStore()

  return (
    <div className="flex flex-col h-full">
      {/* Workspace list */}
      <div className="flex-1 overflow-y-auto py-2">
        {isLoading && workspaces.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted">Loading workspaces...</div>
        ) : workspaces.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted">
            <p className="mb-2">No workspaces yet</p>
            <p className="text-sm">Add a workspace to get started</p>
          </div>
        ) : (
          <div className="space-y-1">
            {workspaces.map((workspace) => (
              <WorkspaceItem key={workspace.id} workspace={workspace} />
            ))}
          </div>
        )}

        {/* Clone progress */}
        {cloneProgress && (
          <div className="mx-2 mt-2 p-3 rounded bg-input border border-default">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-secondary">Cloning...</span>
              <span className="text-xs text-muted">{cloneProgress.percent}%</span>
            </div>
            <div className="h-1.5 bg-hover rounded overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${cloneProgress.percent}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted truncate">{cloneProgress.phase}</p>
          </div>
        )}
      </div>

      {/* Footer with Add Workspace and Settings buttons */}
      <div className="p-2 border-t border-default flex items-center gap-2">
        <button
          onClick={openAddWorkspace}
          className="flex-1 py-2 px-4 rounded text-sm text-secondary hover:bg-hover hover:text-primary flex items-center justify-center gap-2"
        >
          <span>+</span>
          <span>Add Workspace</span>
        </button>
        <button
          onClick={openSettings}
          className="p-2 rounded text-secondary hover:bg-hover hover:text-primary"
          title="Settings"
        >
          <SettingsIcon />
        </button>
      </div>
    </div>
  )
}
