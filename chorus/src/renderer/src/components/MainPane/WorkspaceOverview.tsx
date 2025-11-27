import { GitPanel } from './GitPanel'
import { useUIStore } from '../../stores/ui-store'
import type { Workspace } from '../../types'

interface WorkspaceOverviewProps {
  workspace: Workspace
}

export function WorkspaceOverview({ workspace }: WorkspaceOverviewProps): JSX.Element {
  const { setSidebarTab } = useUIStore()

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">{workspace.name}</h1>
        <p className="text-sm text-muted font-mono">{workspace.path}</p>
      </div>

      {/* Status badges */}
      <div className="flex gap-3 mb-6">
        {workspace.gitBranch && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-input text-sm">
            <span>🌿</span>
            <span>{workspace.gitBranch}</span>
          </div>
        )}
        {workspace.isDirty && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-input text-sm status-busy">
            <span>*</span>
            <span>Uncommitted changes</span>
          </div>
        )}
        {workspace.hasSystemPrompt && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-input text-sm">
            <span>📝</span>
            <span>Has CLAUDE.md</span>
          </div>
        )}
      </div>

      {/* Agents section */}
      <div className="mb-6">
        <h2 className="text-lg font-medium mb-3">Agents</h2>
        {workspace.agents.length === 0 ? (
          <div className="p-4 rounded bg-input text-sm text-muted">
            <p>No agents found in this workspace.</p>
            <p className="mt-1">
              Create agents by adding <code className="text-accent">.md</code> files to{' '}
              <code className="text-accent">.claude/agents/</code>
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {workspace.agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center gap-3 p-3 rounded bg-input hover:bg-hover transition-colors"
              >
                <span className="text-lg">🤖</span>
                <div>
                  <p className="font-medium">{agent.name}</p>
                  <p className="text-xs text-muted font-mono">{agent.filePath.split('/').pop()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Git section */}
      <div className="mb-6">
        <h2 className="text-lg font-medium mb-3">Git</h2>
        <GitPanel workspacePath={workspace.path} />
      </div>

      {/* Quick actions */}
      <div className="mt-6">
        <button
          onClick={() => setSidebarTab('files')}
          className="btn btn-secondary"
        >
          Browse Files
        </button>
      </div>
    </div>
  )
}
