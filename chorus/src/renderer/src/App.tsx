import { useEffect } from 'react'
import { Sidebar } from './components/Sidebar/Sidebar'
import { MainPane } from './components/MainPane/MainPane'
import { SettingsDialog } from './components/dialogs/SettingsDialog'
import { AddWorkspaceDialog } from './components/dialogs/AddWorkspaceDialog'
import { useWorkspaceStore } from './stores/workspace-store'
import { useUIStore } from './stores/ui-store'

function App(): JSX.Element {
  const { loadWorkspaces, loadSettings } = useWorkspaceStore()
  const { isSettingsOpen, isAddWorkspaceOpen } = useUIStore()

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
    </div>
  )
}

export default App
