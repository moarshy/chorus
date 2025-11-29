import { useEffect } from 'react'
import { Sidebar } from './components/Sidebar/Sidebar'
import { MainPane } from './components/MainPane/MainPane'
import { SettingsDialog } from './components/dialogs/SettingsDialog'
import { AddWorkspaceDialog } from './components/dialogs/AddWorkspaceDialog'
import { PermissionDialog } from './components/dialogs/PermissionDialog'
import { useWorkspaceStore } from './stores/workspace-store'
import { useUIStore } from './stores/ui-store'
import { useChatStore } from './stores/chat-store'

function App() {
  const { loadWorkspaces, loadSettings } = useWorkspaceStore()
  const { isSettingsOpen, isAddWorkspaceOpen } = useUIStore()
  const { pendingPermissionRequest, respondToPermission } = useChatStore()

  useEffect(() => {
    // Load settings and workspaces on mount
    loadSettings()
    loadWorkspaces()

    // Refresh workspaces when window gains focus
    const handleFocus = () => {
      loadWorkspaces()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [loadWorkspaces, loadSettings])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-main text-primary">
      <Sidebar />
      <MainPane />

      {/* Dialogs */}
      {isSettingsOpen && <SettingsDialog />}
      {isAddWorkspaceOpen && <AddWorkspaceDialog />}
      {pendingPermissionRequest && (
        <PermissionDialog
          request={pendingPermissionRequest}
          onResponse={respondToPermission}
        />
      )}
    </div>
  )
}

export default App
