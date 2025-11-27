import { useState } from 'react'
import { AgentItem } from './AgentItem'
import { useWorkspaceStore } from '../../stores/workspace-store'
import type { Workspace } from '../../types'

interface WorkspaceItemProps {
  workspace: Workspace
}

// SVG Icons
const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
  >
    <path
      d="M4.5 2.5L8 6L4.5 9.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const RepoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z" />
  </svg>
)

const GitBranchIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z" />
  </svg>
)

const DocumentIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3.75 1.5a.25.25 0 00-.25.25v11.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75zm5.75.56v2.19c0 .138.112.25.25.25h2.19L9.5 2.06zM2 1.75C2 .784 2.784 0 3.75 0h5.086c.464 0 .909.184 1.237.513l3.414 3.414c.329.328.513.773.513 1.237v8.086A1.75 1.75 0 0112.25 15h-8.5A1.75 1.75 0 012 13.25V1.75z" />
  </svg>
)

export function WorkspaceItem({ workspace }: WorkspaceItemProps) {
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
    <div className="relative mb-1">
      {/* Workspace header */}
      <div
        className={`
          flex items-center gap-2 px-3 py-2 mx-2 rounded-md cursor-pointer transition-colors
          ${isSelected ? 'bg-selected' : 'hover:bg-hover'}
        `}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Expand/collapse chevron */}
        <button
          onClick={handleToggleExpand}
          className="flex-shrink-0 p-0.5 text-muted hover:text-secondary transition-colors"
        >
          <ChevronIcon expanded={workspace.isExpanded} />
        </button>

        {/* Repo icon */}
        <div className="flex-shrink-0 text-muted">
          <RepoIcon />
        </div>

        {/* Workspace name and metadata */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{workspace.name}</span>

            {/* System prompt indicator */}
            {workspace.hasSystemPrompt && (
              <span
                className="flex-shrink-0 text-muted opacity-70"
                title="Has CLAUDE.md system prompt"
              >
                <DocumentIcon />
              </span>
            )}
          </div>

          {/* Git info row */}
          {workspace.gitBranch && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-muted opacity-70">
                <GitBranchIcon />
              </span>
              <span className="text-xs text-muted truncate">
                {workspace.gitBranch}
              </span>
              {workspace.isDirty && (
                <span
                  className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500"
                  title="Uncommitted changes"
                />
              )}
            </div>
          )}
        </div>

        {/* Agent count badge */}
        {workspace.agents.length > 0 && (
          <div
            className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium rounded bg-input text-secondary"
            title={`${workspace.agents.length} agent${workspace.agents.length > 1 ? 's' : ''}`}
          >
            {workspace.agents.length}
          </div>
        )}
      </div>

      {/* Agents list */}
      {workspace.isExpanded && (
        <div className="mt-1 ml-4">
          {workspace.agents.length === 0 ? (
            <div className="px-3 py-2 mx-2 text-xs text-muted">
              No agents in this workspace
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
          <div className="absolute right-4 top-10 z-50 bg-main border border-default rounded-lg shadow-xl py-1 min-w-40 overflow-hidden">
            <button
              onClick={handleRemove}
              className="w-full px-3 py-2 text-left text-sm text-secondary hover:bg-hover hover:text-primary flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-muted">
                <path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19a1.75 1.75 0 001.741-1.575l.66-6.6a.75.75 0 00-1.492-.15l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z" />
              </svg>
              Remove Workspace
            </button>
          </div>
        </>
      )}
    </div>
  )
}
