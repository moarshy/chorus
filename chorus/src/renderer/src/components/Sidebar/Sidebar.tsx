import { SidebarTabs } from './SidebarTabs'
import { WorkspacesPanel } from './WorkspacesPanel'
import { FilesPanel } from './FilesPanel'
import { useUIStore } from '../../stores/ui-store'

export function Sidebar() {
  const { sidebarTab, sidebarWidth } = useUIStore()

  return (
    <div
      className="flex flex-col h-full bg-sidebar border-r border-default"
      style={{ width: sidebarWidth }}
    >
      {/* Draggable title bar area for macOS */}
      <div className="h-10 titlebar-drag-region flex-shrink-0" />

      {/* Tab icons */}
      <SidebarTabs />

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {sidebarTab === 'workspaces' ? <WorkspacesPanel /> : <FilesPanel />}
      </div>
    </div>
  )
}
