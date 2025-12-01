import { useWorkspaceStore } from '../../stores/workspace-store'
import { SplitPaneToggle } from './SplitPaneToggle'
import type { Tab } from '../../types'

// SVG Icons
const FileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

const ChatIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const WorkspaceIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z" />
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
  onDragStart: () => void
  onDragEnd: () => void
}

function TabItem({ tab, isActive, workspaceName, onActivate, onClose, onDragStart, onDragEnd }: TabItemProps) {
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

  const Icon = tab.type === 'chat' ? ChatIcon : tab.type === 'workspace' ? WorkspaceIcon : FileIcon

  const handleDragStart = (e: React.DragEvent) => {
    // Set drag data
    e.dataTransfer.setData('text/plain', tab.id)
    e.dataTransfer.effectAllowed = 'move'
    onDragStart()
  }

  const handleDragEnd = () => {
    onDragEnd()
  }

  return (
    <div
      draggable
      onClick={onActivate}
      onMouseDown={handleMiddleClick}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`
        group flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-grab
        border-r border-default min-w-0 max-w-[200px]
        ${isActive
          ? 'bg-main text-primary border-b-2 border-b-accent'
          : 'bg-sidebar text-muted hover:text-secondary hover:bg-hover'
        }
      `}
      title={getTooltip()}
    >
      {/* Icon */}
      <span className={`flex-shrink-0 ${tab.type === 'chat' ? 'text-accent' : tab.type === 'workspace' ? 'text-amber-500' : ''}`}>
        <Icon />
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

interface TabBarProps {
  onTabDragStart?: (tabId: string) => void
  onTabDragEnd?: () => void
}

export function TabBar({ onTabDragStart, onTabDragEnd }: TabBarProps) {
  const {
    tabs,
    activeTabId,
    activateTab,
    closeTab,
    workspaces,
    splitPaneEnabled,
    splitPaneOrientation,
    toggleSplitPane,
    setSplitPaneOrientation
  } = useWorkspaceStore()

  // Helper to get workspace name for a tab
  const getWorkspaceName = (tab: Tab): string | undefined => {
    if (tab.workspaceId) {
      const workspace = workspaces.find(w => w.id === tab.workspaceId)
      return workspace?.name
    }
    return undefined
  }

  // Show the bar if there are tabs OR if split pane is enabled
  const hasTabs = tabs.length > 0
  const shouldShowBar = hasTabs || splitPaneEnabled

  // Don't render anything if there's nothing to show
  if (!shouldShowBar) {
    return null
  }

  // In split mode, hide main tab bar entirely (tabs and toggle are in pane tab bars)
  if (splitPaneEnabled) {
    return null
  }

  // Single pane mode - show tabs and split toggle
  return (
    <div className="flex items-center bg-sidebar border-b border-default">
      {/* Tabs - scrollable */}
      <div className="flex-1 flex overflow-x-auto">
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
            onDragStart={() => onTabDragStart?.(tab.id)}
            onDragEnd={() => onTabDragEnd?.()}
          />
        ))}
      </div>

      {/* Split pane toggle */}
      <div className={`flex items-center px-2 ${hasTabs ? 'border-l border-default' : ''}`}>
        <SplitPaneToggle
          enabled={splitPaneEnabled}
          orientation={splitPaneOrientation}
          onDisable={() => {
            if (splitPaneEnabled) toggleSplitPane()
          }}
          onVertical={() => {
            if (!splitPaneEnabled) toggleSplitPane()
            setSplitPaneOrientation('vertical')
          }}
          onHorizontal={() => {
            if (!splitPaneEnabled) toggleSplitPane()
            setSplitPaneOrientation('horizontal')
          }}
        />
      </div>
    </div>
  )
}
