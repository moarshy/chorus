import { useUIStore } from '../../stores/ui-store'
import type { SidebarTab } from '../../types'

const tabs: { id: SidebarTab; icon: string; label: string }[] = [
  { id: 'workspaces', icon: '📁', label: 'Workspaces' },
  { id: 'files', icon: '📄', label: 'Files' }
]

export function SidebarTabs(): JSX.Element {
  const { sidebarTab, setSidebarTab, openSettings } = useUIStore()

  return (
    <div className="flex items-center justify-between px-2 py-1 border-b border-default">
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSidebarTab(tab.id)}
            className={`
              px-3 py-1.5 rounded text-sm transition-colors titlebar-no-drag
              ${sidebarTab === tab.id ? 'bg-selected text-primary' : 'text-secondary hover:bg-hover hover:text-primary'}
            `}
            title={tab.label}
          >
            <span className="mr-1">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      <button
        onClick={openSettings}
        className="p-1.5 rounded text-secondary hover:bg-hover hover:text-primary titlebar-no-drag"
        title="Settings"
      >
        ⚙️
      </button>
    </div>
  )
}
