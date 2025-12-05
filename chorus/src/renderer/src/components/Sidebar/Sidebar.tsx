import { WorkspacesPanel } from './WorkspacesPanel'
import { useUIStore } from '../../stores/ui-store'

// SVG Icons
const ChevronLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
)

const WorkspaceIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
)

function CollapsedSidebar({ onExpand }: { onExpand: () => void }) {
  return (
    <div className="w-10 flex flex-col items-center bg-sidebar border-r border-default">
      {/* Titlebar spacing */}
      <div className="h-10 flex-shrink-0" />

      <button
        onClick={onExpand}
        className="p-2 text-muted hover:text-white transition-colors"
        title="Expand sidebar (Cmd/Ctrl+B)"
      >
        <ChevronRightIcon />
      </button>

      {/* Vertical icons */}
      <div className="flex flex-col gap-2 mt-4">
        <button
          onClick={onExpand}
          className="p-2 transition-colors text-accent"
          title="Workspaces"
        >
          <WorkspaceIcon />
        </button>
      </div>
    </div>
  )
}

export function Sidebar() {
  const { leftPanelWidth, leftPanelCollapsed, setLeftPanelCollapsed } = useUIStore()

  if (leftPanelCollapsed) {
    return <CollapsedSidebar onExpand={() => setLeftPanelCollapsed(false)} />
  }

  return (
    <div
      className="flex flex-col h-full bg-sidebar border-r border-default"
      style={{ width: leftPanelWidth }}
    >
      {/* Draggable title bar area for macOS */}
      <div className="h-10 titlebar-drag-region flex-shrink-0 flex items-center justify-end px-2">
        <button
          onClick={() => setLeftPanelCollapsed(true)}
          className="p-1 text-muted hover:text-white transition-colors titlebar-no-drag"
          title="Collapse sidebar (Cmd/Ctrl+B)"
        >
          <ChevronLeftIcon />
        </button>
      </div>

      {/* Content - always show workspaces with inline agents and conversations */}
      <div className="flex-1 overflow-hidden">
        <WorkspacesPanel />
      </div>
    </div>
  )
}
