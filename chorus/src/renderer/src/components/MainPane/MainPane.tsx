import { useEffect } from 'react'
import { FileViewer } from './FileViewer'
import { WorkspaceOverview } from './WorkspaceOverview'
import { TabBar } from './TabBar'
import { ChatView } from '../Chat'
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

export function MainPane() {
  const {
    workspaces,
    selectedWorkspaceId,
    selectedAgentId,
    selectedFilePath,
    tabs,
    activeTabId,
    loadTabs
  } = useWorkspaceStore()

  // Load tabs on mount
  useEffect(() => {
    loadTabs()
  }, [loadTabs])

  const selectedWorkspace = workspaces.find((ws) => ws.id === selectedWorkspaceId)
  const selectedAgent = selectedWorkspace?.agents.find((a) => a.id === selectedAgentId)

  // Get active tab for rendering
  const activeTab = tabs.find((t) => t.id === activeTabId)

  // Determine what to show based on active tab or selection state
  const renderContent = () => {
    // If there's an active tab, render based on tab type
    if (activeTab) {
      if (activeTab.type === 'file' && activeTab.filePath) {
        return <FileViewer filePath={activeTab.filePath} />
      }

      if (activeTab.type === 'chat') {
        // Find workspace and agent for the chat tab
        const tabWorkspace = workspaces.find((ws) => ws.id === activeTab.workspaceId)
        const tabAgent = tabWorkspace?.agents.find((a) => a.id === activeTab.agentId)

        if (tabAgent && tabWorkspace) {
          return <ChatView agent={tabAgent} workspace={tabWorkspace} />
        }
      }
    }

    // Fallback to old behavior for backward compatibility
    // File is selected - show file viewer
    if (selectedFilePath) {
      return <FileViewer filePath={selectedFilePath} />
    }

    // Agent is selected - show chat view
    if (selectedAgent && selectedWorkspace) {
      return <ChatView agent={selectedAgent} workspace={selectedWorkspace} />
    }

    // Workspace is selected - show overview
    if (selectedWorkspace) {
      return <WorkspaceOverview workspace={selectedWorkspace} />
    }

    // Nothing selected - show welcome
    return <WelcomeView />
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Draggable title bar area for macOS */}
      <div className="h-10 titlebar-drag-region flex-shrink-0 border-b border-default" />

      {/* Tab Bar */}
      <TabBar />

      {/* Content */}
      <div className="flex-1 overflow-hidden">{renderContent()}</div>
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
