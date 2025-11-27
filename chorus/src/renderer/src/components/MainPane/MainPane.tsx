import { FileViewer } from './FileViewer'
import { WorkspaceOverview } from './WorkspaceOverview'
import { ChatPlaceholder } from './ChatPlaceholder'
import { useWorkspaceStore } from '../../stores/workspace-store'

export function MainPane(): JSX.Element {
  const {
    workspaces,
    selectedWorkspaceId,
    selectedAgentId,
    selectedFilePath
  } = useWorkspaceStore()

  const selectedWorkspace = workspaces.find((ws) => ws.id === selectedWorkspaceId)
  const selectedAgent = selectedWorkspace?.agents.find((a) => a.id === selectedAgentId)

  // Determine what to show
  const renderContent = () => {
    // File is selected - show file viewer
    if (selectedFilePath) {
      return <FileViewer filePath={selectedFilePath} />
    }

    // Agent is selected - show chat placeholder
    if (selectedAgent) {
      return <ChatPlaceholder agent={selectedAgent} />
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

      {/* Content */}
      <div className="flex-1 overflow-hidden">{renderContent()}</div>
    </div>
  )
}

function WelcomeView(): JSX.Element {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-2">Welcome to Chorus</h1>
        <p className="text-secondary">
          Select a workspace from the sidebar or add a new one to get started
        </p>
      </div>
    </div>
  )
}
