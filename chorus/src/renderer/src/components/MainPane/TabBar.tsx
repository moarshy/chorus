import { useWorkspaceStore } from '../../stores/workspace-store'
import type { Tab } from '../../types'

// SVG Icons
const ChatIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const FileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

const CloseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

interface TabItemProps {
  tab: Tab
  isActive: boolean
  workspaceName?: string
  onActivate: () => void
  onClose: (e: React.MouseEvent) => void
}

function TabItem({ tab, isActive, workspaceName, onActivate, onClose }: TabItemProps) {
  const handleMiddleClick = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault()
      onClose(e)
    }
  }

  // Build tooltip: workspace name + file path or title
  const getTooltip = () => {
    const prefix = workspaceName ? `${workspaceName}: ` : ''
    if (tab.type === 'file' && tab.filePath) {
      return `${prefix}${tab.filePath}`
    }
    return `${prefix}${tab.title}`
  }

  return (
    <div
      onClick={onActivate}
      onMouseDown={handleMiddleClick}
      className={`
        group flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer
        border-r border-default min-w-0 max-w-[180px]
        ${isActive
          ? 'bg-main text-primary border-b-2 border-b-accent'
          : 'bg-sidebar text-muted hover:text-secondary hover:bg-hover'
        }
      `}
      title={getTooltip()}
    >
      {/* Icon */}
      <span className="flex-shrink-0">
        {tab.type === 'chat' ? <ChatIcon /> : <FileIcon />}
      </span>

      {/* Title */}
      <span className="truncate flex-1">{tab.title}</span>

      {/* Close button */}
      <button
        onClick={onClose}
        className={`
          flex-shrink-0 p-0.5 rounded hover:bg-hover
          ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
          transition-opacity
        `}
        title="Close tab"
      >
        <CloseIcon />
      </button>
    </div>
  )
}

export function TabBar() {
  const { tabs, activeTabId, activateTab, closeTab, workspaces } = useWorkspaceStore()

  // Don't render if no tabs
  if (tabs.length === 0) {
    return null
  }

  // Helper to get workspace name for a tab
  const getWorkspaceName = (tab: Tab): string | undefined => {
    if (tab.workspaceId) {
      const workspace = workspaces.find(w => w.id === tab.workspaceId)
      return workspace?.name
    }
    return undefined
  }

  return (
    <div className="flex bg-sidebar border-b border-default overflow-x-auto">
      {tabs.map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          workspaceName={getWorkspaceName(tab)}
          onActivate={() => activateTab(tab.id)}
          onClose={(e) => {
            e.stopPropagation()
            closeTab(tab.id)
          }}
        />
      ))}
    </div>
  )
}
