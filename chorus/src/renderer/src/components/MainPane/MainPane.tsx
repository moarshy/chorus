import { useEffect, useState, useCallback } from 'react'
import { FileViewer } from './FileViewer'
import { WorkspaceOverview } from './WorkspaceOverview'
import { ChatTab } from './ChatTab'
import { TabBar } from './TabBar'
import { SplitPaneContainer } from './SplitPaneContainer'
import { DropZoneOverlay, type DropPosition } from './DropZoneOverlay'
import { useWorkspaceStore } from '../../stores/workspace-store'

// SVG Icons
const ChorusIcon = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    <rect width="64" height="64" rx="16" fill="url(#gradient)" />
    <path
      d="M32 16C23.163 16 16 23.163 16 32s7.163 16 16 16 16-7.163 16-16-7.163-16-16-16zm0 28c-6.627 0-12-5.373-12-12s5.373-12 12-12 12 5.373 12 12-5.373 12-12 12z"
      fill="white"
      fillOpacity="0.9"
    />
    <circle cx="32" cy="32" r="6" fill="white" />
    <defs>
      <linearGradient id="gradient" x1="0" y1="0" x2="64" y2="64">
        <stop stopColor="#4a9eff" />
        <stop offset="1" stopColor="#1164a3" />
      </linearGradient>
    </defs>
  </svg>
)

const FolderPlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <line x1="12" y1="11" x2="12" y2="17" />
    <line x1="9" y1="14" x2="15" y2="14" />
  </svg>
)

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
)

// Empty pane placeholder when no tab is assigned
function EmptyPanePlaceholder() {
  return (
    <div className="flex items-center justify-center h-full bg-main text-muted">
      <div className="text-center p-4">
        <p className="text-sm">No tab assigned to this pane</p>
        <p className="text-xs mt-1">Drag a tab here or click a tab while holding Shift</p>
      </div>
    </div>
  )
}

export function MainPane() {
  const {
    workspaces,
    tabs,
    activeTabId,
    loadTabs,
    splitPaneEnabled,
    splitPaneRatio,
    splitPaneOrientation,
    firstPaneGroup,
    secondPaneGroup,
    activePaneId,
    setSplitPaneRatio,
    setSplitPaneOrientation,
    saveSplitPaneSettings,
    swapSplitPanes,
    toggleSplitPane,
    moveTabToPane
  } = useWorkspaceStore()

  // Drag and drop state
  const [isDraggingTab, setIsDraggingTab] = useState(false)
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null)

  // Load tabs on mount
  useEffect(() => {
    loadTabs()
  }, [loadTabs])

  // Handle drop to create/modify split
  const handleDrop = useCallback((position: DropPosition) => {
    setIsDraggingTab(false)

    if (!position || !draggedTabId) return

    // Enable split pane and set orientation based on drop position
    if (position === 'top' || position === 'bottom') {
      setSplitPaneOrientation('vertical')
      if (!splitPaneEnabled) {
        toggleSplitPane()
      }
      // Assign the dragged tab to the appropriate pane
      const targetPaneId = position === 'top' ? 'first' : 'second'
      moveTabToPane(draggedTabId, targetPaneId)
    } else if (position === 'left' || position === 'right') {
      setSplitPaneOrientation('horizontal')
      if (!splitPaneEnabled) {
        toggleSplitPane()
      }
      // Assign the dragged tab to the appropriate pane
      const targetPaneId = position === 'left' ? 'first' : 'second'
      moveTabToPane(draggedTabId, targetPaneId)
    }
    // 'center' just activates the tab normally

    setDraggedTabId(null)
  }, [splitPaneEnabled, toggleSplitPane, setSplitPaneOrientation, draggedTabId, moveTabToPane])

  const handleTabDragStart = useCallback((tabId: string) => {
    setIsDraggingTab(true)
    setDraggedTabId(tabId)
  }, [])

  const handleTabDragEnd = useCallback(() => {
    setIsDraggingTab(false)
    setDraggedTabId(null)
  }, [])

  // Get active tab for rendering
  const activeTab = tabs.find((t) => t.id === activeTabId)

  // Render content for a specific tab ID
  const renderTabContent = useCallback((tabId: string | null) => {
    if (!tabId) {
      return <EmptyPanePlaceholder />
    }

    const tab = tabs.find(t => t.id === tabId)
    if (!tab) {
      return <EmptyPanePlaceholder />
    }

    if (tab.type === 'chat' && tab.conversationId && tab.agentId && tab.workspaceId) {
      return (
        <ChatTab
          conversationId={tab.conversationId}
          agentId={tab.agentId}
          workspaceId={tab.workspaceId}
        />
      )
    }

    if (tab.type === 'workspace' && tab.workspaceId) {
      const workspace = workspaces.find(w => w.id === tab.workspaceId)
      if (workspace) {
        return <WorkspaceOverview workspace={workspace} />
      }
    }

    if (tab.type === 'file' && tab.filePath) {
      return <FileViewer filePath={tab.filePath} />
    }

    return <EmptyPanePlaceholder />
  }, [tabs, workspaces])

  // Determine what to show based on active tab or selection state
  const renderContent = () => {
    // Split pane mode
    if (splitPaneEnabled) {
      return (
        <SplitPaneContainer
          firstPaneGroup={firstPaneGroup}
          secondPaneGroup={secondPaneGroup}
          activePaneId={activePaneId}
          ratio={splitPaneRatio}
          orientation={splitPaneOrientation}
          onRatioChange={setSplitPaneRatio}
          onRatioChangeEnd={saveSplitPaneSettings}
          onSwap={swapSplitPanes}
          onOrientationChange={setSplitPaneOrientation}
          renderTabContent={renderTabContent}
        />
      )
    }

    // Single pane mode - content is determined by active tab only
    // If there's an active chat tab, show chat
    if (activeTab?.type === 'chat' && activeTab.conversationId && activeTab.agentId && activeTab.workspaceId) {
      return (
        <ChatTab
          conversationId={activeTab.conversationId}
          agentId={activeTab.agentId}
          workspaceId={activeTab.workspaceId}
        />
      )
    }

    // If there's an active workspace tab, show workspace overview
    if (activeTab?.type === 'workspace' && activeTab.workspaceId) {
      const workspace = workspaces.find(w => w.id === activeTab.workspaceId)
      if (workspace) {
        return <WorkspaceOverview workspace={workspace} />
      }
    }

    // If there's an active file tab, show file viewer
    if (activeTab?.type === 'file' && activeTab.filePath) {
      return <FileViewer filePath={activeTab.filePath} />
    }

    // No active tab - show welcome view
    return <WelcomeView />
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Draggable title bar area for macOS */}
      <div className="h-10 titlebar-drag-region flex-shrink-0 border-b border-default" />

      {/* Tab Bar - only shows file tabs */}
      <TabBar onTabDragStart={handleTabDragStart} onTabDragEnd={handleTabDragEnd} />

      {/* Content with drop zone overlay */}
      <div className="flex-1 overflow-hidden relative">
        {renderContent()}
        <DropZoneOverlay visible={isDraggingTab} onDrop={handleDrop} />
      </div>
    </div>
  )
}

function WelcomeView() {
  return (
    <div className="flex items-center justify-center h-full bg-main">
      <div className="text-center max-w-lg px-8">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <ChorusIcon />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold mb-3 text-primary">Welcome to Chorus</h1>
        <p className="text-secondary text-lg mb-8">
          Orchestrate Claude Code agents across your projects
        </p>

        {/* Getting started steps */}
        <div className="bg-input rounded-xl p-6 text-left mb-6">
          <h3 className="font-semibold text-primary mb-4 flex items-center gap-2">
            <FolderPlusIcon />
            Get Started
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent text-white text-sm font-semibold flex items-center justify-center">
                1
              </div>
              <div>
                <p className="text-primary font-medium">Add a workspace</p>
                <p className="text-sm text-muted">Click the + button in the sidebar to add a local repo or clone from GitHub</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent text-white text-sm font-semibold flex items-center justify-center">
                2
              </div>
              <div>
                <p className="text-primary font-medium">Define your agents</p>
                <p className="text-sm text-muted">Create <code className="text-accent bg-hover px-1 rounded">.claude/agents/*.md</code> files to define specialized agents</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent text-white text-sm font-semibold flex items-center justify-center">
                3
              </div>
              <div>
                <p className="text-primary font-medium">Start collaborating</p>
                <p className="text-sm text-muted">Click on an agent to begin a conversation</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick tip */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted">
          <span>Select a workspace from the sidebar to get started</span>
          <ArrowRightIcon />
        </div>
      </div>
    </div>
  )
}
