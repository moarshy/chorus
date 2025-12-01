import { useState } from 'react'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useFileTreeStore } from '../../stores/file-tree-store'
import { FileTree } from '../Sidebar/FileTree'

// SVG Icons
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

const NewFileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-muted">
    <path d="M3.75 1.5a.25.25 0 00-.25.25v11.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75zM9.5 1.5v2.75c0 .138.112.25.25.25h2.75l-3-3z" />
    <path d="M8 8a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5A.75.75 0 018 8z" />
  </svg>
)

const NewFolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-muted">
    <path d="M1.75 2.5a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25v-8.5a.25.25 0 00-.25-.25H7.5c-.55 0-1.07-.26-1.4-.7l-.9-1.2a.25.25 0 00-.2-.1H1.75z" />
    <path d="M8 6a.75.75 0 01.75.75v2h2a.75.75 0 010 1.5h-2v2a.75.75 0 01-1.5 0v-2h-2a.75.75 0 010-1.5h2v-2A.75.75 0 018 6z" />
  </svg>
)

// Input dialog state
interface InputDialogState {
  isOpen: boolean
  type: 'newFile' | 'newFolder'
  targetPath: string
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 text-center">
      <div className="w-12 h-12 mb-3 rounded-xl bg-input flex items-center justify-center">
        <FolderOpenIcon />
      </div>
      <p className="text-sm text-muted">{message}</p>
    </div>
  )
}

export function FilesSection() {
  const { workspaces, selectedWorkspaceId, selectFile, selectedFilePath, loadWorkspaces } =
    useWorkspaceStore()
  const triggerFileTreeRefresh = useFileTreeStore((state) => state.triggerRefresh)

  const selectedWorkspace = workspaces.find((ws) => ws.id === selectedWorkspaceId)

  // Input dialog state
  const [inputDialog, setInputDialog] = useState<InputDialogState>({
    isOpen: false,
    type: 'newFile',
    targetPath: ''
  })
  const [inputValue, setInputValue] = useState('')

  const handleRefresh = () => {
    loadWorkspaces()
    triggerFileTreeRefresh()
  }

  const handleNewFile = () => {
    if (!selectedWorkspace) return
    setInputDialog({
      isOpen: true,
      type: 'newFile',
      targetPath: selectedWorkspace.path
    })
    setInputValue('')
  }

  const handleNewFolder = () => {
    if (!selectedWorkspace) return
    setInputDialog({
      isOpen: true,
      type: 'newFolder',
      targetPath: selectedWorkspace.path
    })
    setInputValue('')
  }

  const handleInputSubmit = async () => {
    if (!inputValue.trim()) return

    const { type, targetPath } = inputDialog

    try {
      let success = false
      if (type === 'newFile') {
        const newPath = `${targetPath}/${inputValue}`
        const result = await window.api.fs.createFile(newPath)
        success = result.success
      } else if (type === 'newFolder') {
        const newPath = `${targetPath}/${inputValue}`
        const result = await window.api.fs.createDirectory(newPath)
        success = result.success
      }

      if (success) {
        triggerFileTreeRefresh()
      }
    } catch (error) {
      console.error('File operation failed:', error)
    }

    setInputDialog({ ...inputDialog, isOpen: false })
    setInputValue('')
  }

  if (!selectedWorkspace) {
    return <EmptyState message="Select a workspace to browse files" />
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-default">
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate text-sm">{selectedWorkspace.name}</p>
        </div>
        <button
          onClick={handleNewFile}
          className="p-1 rounded hover:bg-hover transition-colors"
          title="New File"
        >
          <NewFileIcon />
        </button>
        <button
          onClick={handleNewFolder}
          className="p-1 rounded hover:bg-hover transition-colors"
          title="New Folder"
        >
          <NewFolderIcon />
        </button>
        <button
          onClick={handleRefresh}
          className="p-1 rounded hover:bg-hover transition-colors"
          title="Refresh"
        >
          <RefreshIcon />
        </button>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto">
        <FileTree
          rootPath={selectedWorkspace.path}
          onFileSelect={selectFile}
          selectedPath={selectedFilePath}
        />
      </div>

      {/* Input Dialog for New File/Folder */}
      {inputDialog.isOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-[15%] z-50">
          <div className="bg-surface border border-default rounded shadow-lg w-[400px]">
            <div className="p-4 space-y-3">
              <p className="text-primary text-sm">
                {inputDialog.type === 'newFile' ? 'Enter file name' : 'Enter folder name'}
              </p>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleInputSubmit()
                  if (e.key === 'Escape') setInputDialog({ ...inputDialog, isOpen: false })
                }}
                placeholder={inputDialog.type === 'newFile' ? 'filename.txt' : 'folder-name'}
                className="w-full px-3 py-2 bg-input border border-default rounded text-primary placeholder-muted text-sm focus:outline-none focus:border-accent"
                autoFocus
              />
            </div>
            <div className="px-4 pb-3 flex justify-end gap-2">
              <button
                onClick={() => setInputDialog({ ...inputDialog, isOpen: false })}
                className="px-3 py-1.5 text-sm rounded border border-default hover:bg-hover text-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInputSubmit}
                disabled={!inputValue.trim()}
                className="px-3 py-1.5 text-sm rounded bg-accent hover:bg-accent/80 text-white transition-colors disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
