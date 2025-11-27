import { useState } from 'react'
import { AgentItem } from './AgentItem'
import { useWorkspaceStore } from '../../stores/workspace-store'
import type { Workspace } from '../../types'

interface WorkspaceItemProps {
  workspace: Workspace
}

export function WorkspaceItem({ workspace }: WorkspaceItemProps): JSX.Element {
  const {
    selectedWorkspaceId,
    selectWorkspace,
    toggleWorkspaceExpanded,
    removeWorkspace
  } = useWorkspaceStore()
  const [showContextMenu, setShowContextMenu] = useState(false)

  const isSelected = selectedWorkspaceId === workspace.id

  const handleClick = () => {
    selectWorkspace(workspace.id)
  }

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleWorkspaceExpanded(workspace.id)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setShowContextMenu(true)
  }

  const handleRemove = () => {
    removeWorkspace(workspace.id)
    setShowContextMenu(false)
  }

  return (
    <div className="relative">
      {/* Workspace header */}
      <div
        className={`
          flex items-center gap-2 px-2 py-1.5 mx-2 rounded cursor-pointer
          ${isSelected ? 'bg-selected' : 'hover:bg-hover'}
        `}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Expand/collapse chevron */}
        <button
          onClick={handleToggleExpand}
          className="p-0.5 text-muted hover:text-secondary"
        >
          <span className={`inline-block transition-transform ${workspace.isExpanded ? 'rotate-90' : ''}`}>
            ▶
          </span>
        </button>

        {/* Workspace name */}
        <span className="flex-1 truncate text-sm">{workspace.name}</span>

        {/* Badges */}
        <div className="flex items-center gap-1 text-xs">
          {/* System prompt indicator */}
          {workspace.hasSystemPrompt && (
            <span title="Has CLAUDE.md system prompt">📝</span>
          )}

          {/* Git branch */}
          {workspace.gitBranch && (
            <span className="text-muted" title={`Branch: ${workspace.gitBranch}`}>
              [{workspace.gitBranch}]
            </span>
          )}

          {/* Dirty indicator */}
          {workspace.isDirty && (
            <span className="status-busy" title="Has uncommitted changes">*</span>
          )}
        </div>
      </div>

      {/* Agents list */}
      {workspace.isExpanded && (
        <div className="ml-6">
          {workspace.agents.length === 0 ? (
            <div className="px-2 py-1 text-xs text-muted italic">
              No agents found
            </div>
          ) : (
            workspace.agents.map((agent) => (
              <AgentItem key={agent.id} agent={agent} />
            ))
          )}
        </div>
      )}

      {/* Context menu */}
      {showContextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowContextMenu(false)}
          />
          <div className="absolute right-2 top-8 z-50 bg-main border border-default rounded shadow-lg py-1 min-w-32">
            <button
              onClick={handleRemove}
              className="w-full px-3 py-1.5 text-left text-sm text-secondary hover:bg-hover hover:text-primary"
            >
              Remove Workspace
            </button>
          </div>
        </>
      )}
    </div>
  )
}
