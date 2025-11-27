import { WorkspaceItem } from './WorkspaceItem'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useUIStore } from '../../stores/ui-store'

export function WorkspacesPanel(): JSX.Element {
  const { workspaces, isLoading, cloneProgress } = useWorkspaceStore()
  const { openAddWorkspace } = useUIStore()

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

      {/* Add workspace button */}
      <div className="p-2 border-t border-default">
        <button
          onClick={openAddWorkspace}
          className="w-full py-2 px-4 rounded text-sm text-secondary hover:bg-hover hover:text-primary flex items-center justify-center gap-2"
        >
          <span>+</span>
          <span>Add Workspace</span>
        </button>
      </div>
    </div>
  )
}
