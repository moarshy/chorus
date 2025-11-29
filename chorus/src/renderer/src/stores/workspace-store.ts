import { create } from 'zustand'
import type { Workspace, ChorusSettings, Tab } from '../types'

interface WorkspaceStore {
  // State
  workspaces: Workspace[]
  selectedWorkspaceId: string | null
  selectedAgentId: string | null
  selectedFilePath: string | null
  settings: ChorusSettings | null
  isLoading: boolean
  error: string | null

  // Tab state
  tabs: Tab[]
  activeTabId: string | null

  // Clone state
  cloneProgress: {
    url: string
    phase: string
    percent: number
    message: string
  } | null

  // Actions
  loadWorkspaces: () => Promise<void>
  loadSettings: () => Promise<void>
  addWorkspace: (path: string) => Promise<void>
  cloneWorkspace: (url: string) => Promise<void>
  removeWorkspace: (id: string) => Promise<void>
  refreshWorkspace: (id: string) => Promise<void>
  selectWorkspace: (id: string | null) => void
  selectAgent: (agentId: string | null, workspaceId?: string) => void
  selectFile: (filePath: string | null) => void
  toggleWorkspaceExpanded: (id: string) => void
  setRootWorkspaceDir: (path: string) => Promise<void>
  clearError: () => void

  // Tab actions
  openTab: (tab: Omit<Tab, 'id'>) => string
  closeTab: (tabId: string) => void
  activateTab: (tabId: string) => void
  loadTabs: () => Promise<void>
  saveTabs: () => Promise<void>
}

// Generate UUID for tabs
function generateTabId(): string {
  return 'tab-' + Math.random().toString(36).substring(2, 11)
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  // Initial state
  workspaces: [],
  selectedWorkspaceId: null,
  selectedAgentId: null,
  selectedFilePath: null,
  settings: null,
  isLoading: false,
  error: null,
  tabs: [],
  activeTabId: null,
  cloneProgress: null,

  // Load all workspaces
  loadWorkspaces: async () => {
    // Check if running in Electron context
    if (!window.api) {
      set({ isLoading: false })
      return
    }

    set({ isLoading: true, error: null })
    try {
      const result = await window.api.workspace.list()
      if (result.success && result.data) {
        set({ workspaces: result.data, isLoading: false })
      } else {
        set({ error: result.error || 'Failed to load workspaces', isLoading: false })
      }
    } catch (error) {
      set({ error: String(error), isLoading: false })
    }
  },

  // Load settings
  loadSettings: async () => {
    if (!window.api) return

    try {
      const result = await window.api.settings.get()
      if (result.success && result.data) {
        set({ settings: result.data })
      }
    } catch {
      // Silently fail - will use default settings
    }
  },

  // Add workspace from local path
  addWorkspace: async (path: string) => {
    set({ isLoading: true, error: null })
    try {
      const result = await window.api.workspace.add(path)
      if (result.success && result.data) {
        const { workspaces } = get()
        set({
          workspaces: [...workspaces, result.data],
          selectedWorkspaceId: result.data.id,
          isLoading: false
        })
      } else {
        set({ error: result.error || 'Failed to add workspace', isLoading: false })
      }
    } catch (error) {
      set({ error: String(error), isLoading: false })
    }
  },

  // Clone workspace from URL
  cloneWorkspace: async (url: string) => {
    const { settings } = get()
    if (!settings?.rootWorkspaceDir) {
      set({ error: 'Please set a root workspace directory first' })
      return
    }

    // Extract repo name from URL
    const repoName = url.split('/').pop()?.replace('.git', '') || 'repo'
    const targetDir = `${settings.rootWorkspaceDir}/${repoName}`

    set({
      cloneProgress: { url, phase: 'Starting', percent: 0, message: 'Starting clone...' }
    })

    // Set up progress listener
    const unsubscribeProgress = window.api.git.onCloneProgress((progress) => {
      set({
        cloneProgress: { url, ...progress }
      })
    })

    // Set up completion listener
    const unsubscribeComplete = window.api.git.onCloneComplete(async (result) => {
      unsubscribeProgress()
      unsubscribeComplete()

      if (result.success && result.targetDir) {
        // Add the cloned workspace
        await get().addWorkspace(result.targetDir)
      } else {
        set({ error: result.error || 'Clone failed' })
      }

      set({ cloneProgress: null })
    })

    // Start clone
    try {
      await window.api.git.clone(url, targetDir)
    } catch (error) {
      unsubscribeProgress()
      unsubscribeComplete()
      set({ error: String(error), cloneProgress: null })
    }
  },

  // Remove workspace
  removeWorkspace: async (id: string) => {
    try {
      const result = await window.api.workspace.remove(id)
      if (result.success) {
        const { workspaces, selectedWorkspaceId } = get()
        const newWorkspaces = workspaces.filter((ws) => ws.id !== id)
        set({
          workspaces: newWorkspaces,
          selectedWorkspaceId: selectedWorkspaceId === id ? null : selectedWorkspaceId,
          selectedAgentId: null,
          selectedFilePath: null
        })
      } else {
        set({ error: result.error || 'Failed to remove workspace' })
      }
    } catch (error) {
      set({ error: String(error) })
    }
  },

  // Refresh workspace info
  refreshWorkspace: async (id: string) => {
    try {
      const result = await window.api.workspace.refresh(id)
      if (result.success && result.data) {
        const { workspaces } = get()
        set({
          workspaces: workspaces.map((ws) => (ws.id === id ? result.data! : ws))
        })
      }
    } catch {
      // Silently fail - workspace may have been removed
    }
  },

  // Selection actions
  selectWorkspace: (id: string | null) => {
    set({
      selectedWorkspaceId: id,
      selectedAgentId: null,
      selectedFilePath: null
    })
  },

  selectAgent: (agentId: string | null, workspaceId?: string) => {
    if (!agentId) {
      set({ selectedAgentId: null, selectedFilePath: null })
      return
    }

    const { workspaces, tabs, openTab } = get()
    const wsId = workspaceId || get().selectedWorkspaceId
    const workspace = workspaces.find(w => w.id === wsId)
    const agent = workspace?.agents.find(a => a.id === agentId)

    // Check if tab already exists
    const existingTab = tabs.find(t => t.type === 'chat' && t.agentId === agentId && t.workspaceId === wsId)
    if (existingTab) {
      set({
        selectedWorkspaceId: wsId,
        selectedAgentId: agentId,
        selectedFilePath: null,
        activeTabId: existingTab.id
      })
    } else {
      // Create new tab
      const tabId = openTab({
        type: 'chat',
        workspaceId: wsId || undefined,
        agentId,
        title: agent?.name || 'Chat'
      })
      set({
        selectedWorkspaceId: wsId,
        selectedAgentId: agentId,
        selectedFilePath: null,
        activeTabId: tabId
      })
    }
  },

  selectFile: (filePath: string | null) => {
    if (!filePath) {
      set({ selectedFilePath: null })
      return
    }

    const { tabs, openTab, selectedWorkspaceId } = get()
    const filename = filePath.split('/').pop() || 'File'

    // Check if tab already exists
    const existingTab = tabs.find(t => t.type === 'file' && t.filePath === filePath)
    if (existingTab) {
      set({
        selectedFilePath: filePath,
        selectedAgentId: null,
        activeTabId: existingTab.id
      })
    } else {
      // Create new tab with current workspace context
      const tabId = openTab({
        type: 'file',
        filePath,
        workspaceId: selectedWorkspaceId || undefined,
        title: filename
      })
      set({
        selectedFilePath: filePath,
        selectedAgentId: null,
        activeTabId: tabId
      })
    }
  },

  // Toggle workspace expanded
  toggleWorkspaceExpanded: (id: string) => {
    const { workspaces } = get()
    set({
      workspaces: workspaces.map((ws) =>
        ws.id === id ? { ...ws, isExpanded: !ws.isExpanded } : ws
      )
    })
  },

  // Set root workspace directory
  setRootWorkspaceDir: async (path: string) => {
    try {
      const result = await window.api.settings.setRootDir(path)
      if (result.success) {
        const { settings } = get()
        set({
          settings: settings
            ? { ...settings, rootWorkspaceDir: path }
            : { rootWorkspaceDir: path, theme: 'dark', chatSidebarCollapsed: false, chatSidebarWidth: 240 }
        })
      }
    } catch (error) {
      set({ error: String(error) })
    }
  },

  // Clear error
  clearError: () => set({ error: null }),

  // Tab actions
  openTab: (tabData: Omit<Tab, 'id'>) => {
    const id = generateTabId()
    const newTab: Tab = { ...tabData, id }

    set(state => ({
      tabs: [...state.tabs, newTab],
      activeTabId: id
    }))

    // Persist tabs
    get().saveTabs()

    return id
  },

  closeTab: (tabId: string) => {
    const { tabs, activeTabId } = get()
    const tabIndex = tabs.findIndex(t => t.id === tabId)
    if (tabIndex === -1) return

    const newTabs = tabs.filter(t => t.id !== tabId)

    // If closing active tab, activate adjacent
    let newActiveTabId = activeTabId
    if (activeTabId === tabId) {
      if (newTabs.length === 0) {
        newActiveTabId = null
      } else if (tabIndex > 0) {
        newActiveTabId = newTabs[tabIndex - 1].id
      } else {
        newActiveTabId = newTabs[0].id
      }
    }

    // Update selection state based on new active tab
    const newActiveTab = newTabs.find(t => t.id === newActiveTabId)
    set({
      tabs: newTabs,
      activeTabId: newActiveTabId,
      selectedAgentId: newActiveTab?.type === 'chat' ? newActiveTab.agentId || null : null,
      selectedFilePath: newActiveTab?.type === 'file' ? newActiveTab.filePath || null : null,
      selectedWorkspaceId: newActiveTab?.workspaceId || get().selectedWorkspaceId
    })

    // Persist tabs
    get().saveTabs()
  },

  activateTab: (tabId: string) => {
    const { tabs } = get()
    const tab = tabs.find(t => t.id === tabId)
    if (!tab) return

    set({
      activeTabId: tabId,
      selectedAgentId: tab.type === 'chat' ? tab.agentId || null : null,
      selectedFilePath: tab.type === 'file' ? tab.filePath || null : null,
      selectedWorkspaceId: tab.workspaceId || get().selectedWorkspaceId
    })
  },

  loadTabs: async () => {
    if (!window.api) return

    try {
      const result = await window.api.settings.get()
      if (result.success && result.data?.openTabs) {
        const { tabs: savedTabs, activeTabId: savedActiveTabId } = result.data.openTabs
        if (savedTabs && savedTabs.length > 0) {
          set({ tabs: savedTabs, activeTabId: savedActiveTabId || savedTabs[0]?.id || null })

          // Set selection state based on active tab
          const activeTab = savedTabs.find((t: Tab) => t.id === savedActiveTabId)
          if (activeTab) {
            set({
              selectedAgentId: activeTab.type === 'chat' ? activeTab.agentId || null : null,
              selectedFilePath: activeTab.type === 'file' ? activeTab.filePath || null : null,
              selectedWorkspaceId: activeTab.workspaceId || null
            })
          }
        }
      }
    } catch {
      // Silently fail - will start with no tabs
    }
  },

  saveTabs: async () => {
    if (!window.api) return

    const { tabs, activeTabId } = get()
    try {
      await window.api.settings.setOpenTabs({ tabs, activeTabId })
    } catch {
      // Silently fail
    }
  }
}))
