import { useEffect, useCallback, useRef } from 'react'
import { Sidebar } from './components/Sidebar/Sidebar'
import { MainPane } from './components/MainPane/MainPane'
import { RightPanel } from './components/RightPanel'
import { ResizeHandle } from './components/ResizeHandle'
import { SettingsDialog } from './components/dialogs/SettingsDialog'
import { AddWorkspaceDialog } from './components/dialogs/AddWorkspaceDialog'
import { PermissionDialog } from './components/dialogs/PermissionDialog'
import { useWorkspaceStore } from './stores/workspace-store'
import { useUIStore } from './stores/ui-store'
import { useChatStore } from './stores/chat-store'

const MIN_PANEL_WIDTH = 200
const MAX_PANEL_WIDTH = 600

function App() {
  const { loadWorkspaces, loadSettings } = useWorkspaceStore()
  const {
    isSettingsOpen,
    isAddWorkspaceOpen,
    leftPanelWidth,
    setLeftPanelWidth,
    rightPanelWidth,
    setRightPanelWidth,
    rightPanelCollapsed
  } = useUIStore()
  const { pendingPermissionRequest, respondToPermission, initEventListeners } = useChatStore()

  // Track if event listeners have been initialized (prevent duplicates)
  const eventListenersInitialized = useRef(false)

  const handleLeftResize = useCallback((delta: number) => {
    setLeftPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, leftPanelWidth + delta)))
  }, [leftPanelWidth, setLeftPanelWidth])

  const handleRightResize = useCallback((delta: number) => {
    setRightPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, rightPanelWidth + delta)))
  }, [rightPanelWidth, setRightPanelWidth])

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

  // Initialize event listeners ONCE at the app level
  useEffect(() => {
    if (eventListenersInitialized.current) return
    eventListenersInitialized.current = true

    const cleanup = initEventListeners()
    return () => {
      cleanup()
      eventListenersInitialized.current = false
    }
  }, [initEventListeners])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-main text-primary">
      <Sidebar />
      <ResizeHandle position="left" onResize={handleLeftResize} />
      <MainPane />
      {!rightPanelCollapsed && <ResizeHandle position="right" onResize={handleRightResize} />}
      <RightPanel />

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
