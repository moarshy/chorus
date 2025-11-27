import { useWorkspaceStore } from '../../stores/workspace-store'
import { FileTree } from './FileTree'

// ============================================
// SVG ICONS
// ============================================

const FolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path
      d="M2.5 13.5H13.5C14.0523 13.5 14.5 13.0523 14.5 12.5V5C14.5 4.44772 14.0523 4 13.5 4H7.70711C7.44174 4 7.18753 3.89464 7 3.70711L6.08579 2.79289C5.89845 2.60536 5.64424 2.5 5.37868 2.5H2.5C1.94772 2.5 1.5 2.94772 1.5 3.5V12.5C1.5 13.0523 1.94772 13.5 2.5 13.5Z"
      fill="#dcb67a"
      fillOpacity="0.15"
      stroke="#dcb67a"
      strokeWidth="1.2"
    />
  </svg>
)

const FolderOpenIcon = () => (
  <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" className="text-muted">
    <path d="M.513 1.513A1.75 1.75 0 011.75 1h3.5c.55 0 1.07.26 1.4.7l.9 1.2a.25.25 0 00.2.1h6a1.75 1.75 0 011.75 1.75v8.5A1.75 1.75 0 0113.75 15H2.25A1.75 1.75 0 01.5 13.25V2.75c0-.464.184-.91.513-1.237z" />
  </svg>
)

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-muted">
    <path d="M8 3a5 5 0 104.546 2.914.75.75 0 011.366-.62A6.5 6.5 0 118 1.5v-1A.75.75 0 019.28.22l2.25 2.25a.75.75 0 010 1.06L9.28 5.78A.75.75 0 018 5.25v-2.25z" />
  </svg>
)

// ============================================
// MAIN COMPONENT
// ============================================

export function FilesPanel() {
  const { workspaces, selectedWorkspaceId, selectedFilePath, selectFile, loadWorkspaces } =
    useWorkspaceStore()

  const selectedWorkspace = workspaces.find((ws) => ws.id === selectedWorkspaceId)

  const handleFileSelect = (path: string) => {
    selectFile(path)
  }

  const handleRefresh = () => {
    loadWorkspaces()
  }

  // Empty state - no workspace selected
  if (!selectedWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 text-center">
        <div className="w-12 h-12 mb-3 rounded-xl bg-input flex items-center justify-center">
          <FolderOpenIcon />
        </div>
        <p className="text-secondary font-medium mb-1">No workspace selected</p>
        <p className="text-sm text-muted">
          Select a workspace from the Workspaces tab to browse files
        </p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-default">
        <div className="flex-shrink-0">
          <FolderIcon />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate text-sm">{selectedWorkspace.name}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            className="p-1 rounded hover:bg-hover transition-colors"
            title="Refresh"
          >
            <RefreshIcon />
          </button>
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto">
        <FileTree
          rootPath={selectedWorkspace.path}
          onFileSelect={handleFileSelect}
          selectedPath={selectedFilePath}
        />
      </div>
    </div>
  )
}
