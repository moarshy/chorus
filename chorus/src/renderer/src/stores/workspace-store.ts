import { create } from 'zustand'
import type { Workspace, ChorusSettings, Tab, SlashCommand, TabGroup } from '../types'

// Helper to create empty tab group
const createEmptyTabGroup = (id: string): TabGroup => ({
  id,
  tabIds: [],
  activeTabId: null
})

interface WorkspaceStore {
  // State
  workspaces: Workspace[]
  selectedWorkspaceId: string | null
  selectedAgentId: string | null
  selectedFilePath: string | null
  selectedConversationId: string | null  // Active chat conversation
  settings: ChorusSettings | null
  isLoading: boolean
  error: string | null

  // Tab state
  tabs: Tab[]
  activeTabId: string | null

  // Recently viewed files for @ mention suggestions (per workspace)
  recentlyViewedFiles: Map<string, string[]>  // workspaceId -> file paths

  // Slash commands state (per-workspace)
  workspaceCommands: Map<string, SlashCommand[]>

  // Clone state
  cloneProgress: {
    url: string
    phase: string
    percent: number
    message: string
  } | null

  // Split pane state
  splitPaneEnabled: boolean
  splitPaneRatio: number      // 0-100, percentage for first pane
  splitPaneOrientation: 'vertical' | 'horizontal'  // vertical = top/bottom, horizontal = left/right
  firstPaneGroup: TabGroup    // Tab group for first pane
  secondPaneGroup: TabGroup   // Tab group for second pane
  activePaneId: 'first' | 'second'  // Which pane is focused

  // Unsaved files tracking (for tab indicators)
  unsavedFiles: Set<string>  // Set of file paths with unsaved changes

  // Refresh keys for cross-component coordination
  branchRefreshKey: number  // Increment to trigger branch list refresh

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
  selectConversation: (conversationId: string, agentId: string, workspaceId: string, title: string) => void
  toggleWorkspaceExpanded: (id: string) => void
  setRootWorkspaceDir: (path: string) => Promise<void>
  clearError: () => void

  // Tab actions
  openTab: (tab: Omit<Tab, 'id'>) => string
  closeTab: (tabId: string) => void
  activateTab: (tabId: string) => void
  loadTabs: () => Promise<void>
  saveTabs: () => Promise<void>

  // Slash command actions
  loadCommands: (workspaceId: string) => Promise<void>
  refreshCommands: (workspaceId: string) => Promise<void>
  getCommands: (workspaceId: string) => SlashCommand[]

  // Recently viewed files actions (for @ mention suggestions)
  trackFileView: (workspaceId: string, filePath: string) => void
  getRecentlyViewedFiles: (workspaceId: string) => string[]

  // Split pane actions
  toggleSplitPane: () => void
  setSplitPaneRatio: (ratio: number) => void
  setSplitPaneOrientation: (orientation: 'vertical' | 'horizontal') => void
  swapSplitPanes: () => void
  setActivePaneTab: (paneId: 'first' | 'second', tabId: string) => void
  moveTabToPane: (tabId: string, targetPaneId: 'first' | 'second') => void
  closeTabInPane: (paneId: 'first' | 'second', tabId: string) => void
  setActivePane: (paneId: 'first' | 'second') => void
  saveSplitPaneSettings: () => Promise<void>

  // Unsaved files actions
  markFileUnsaved: (filePath: string) => void
  markFileSaved: (filePath: string) => void
  isFileUnsaved: (filePath: string) => boolean

  // Refresh actions
  triggerBranchRefresh: () => void
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
  selectedConversationId: null,
  settings: null,
  isLoading: false,
  error: null,
  tabs: [],
  activeTabId: null,
  recentlyViewedFiles: new Map(),
  workspaceCommands: new Map(),
  cloneProgress: null,
  // Split pane defaults
  splitPaneEnabled: false,
  splitPaneRatio: 50,
  splitPaneOrientation: 'vertical',
  firstPaneGroup: createEmptyTabGroup('first'),
  secondPaneGroup: createEmptyTabGroup('second'),
  activePaneId: 'first',

  // Unsaved files tracking
  unsavedFiles: new Set<string>(),

  // Refresh keys
  branchRefreshKey: 0,

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
        // Load split pane settings if present
        if (result.data.splitPane) {
          set({
            splitPaneEnabled: result.data.splitPane.enabled,
            splitPaneRatio: result.data.splitPane.ratio,
            splitPaneOrientation: result.data.splitPane.orientation || 'vertical',
            firstPaneGroup: result.data.splitPane.firstPaneGroup || createEmptyTabGroup('first'),
            secondPaneGroup: result.data.splitPane.secondPaneGroup || createEmptyTabGroup('second')
          })
        }
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
    if (!id) {
      set({
        selectedWorkspaceId: null,
        selectedAgentId: null,
        selectedFilePath: null
      })
      return
    }

    const { tabs, openTab, workspaces, splitPaneEnabled, firstPaneGroup, secondPaneGroup } = get()
    const workspace = workspaces.find(w => w.id === id)
    const workspaceName = workspace?.name || 'Workspace'

    // Check if workspace tab already exists
    const existingTab = tabs.find(t => t.type === 'workspace' && t.workspaceId === id)
    if (existingTab) {
      set({
        selectedWorkspaceId: id,
        selectedAgentId: null,
        selectedFilePath: null,
        selectedConversationId: null,
        activeTabId: existingTab.id
      })

      // If split mode, also activate in the correct pane group
      if (splitPaneEnabled) {
        if (firstPaneGroup.tabIds.includes(existingTab.id)) {
          set({
            firstPaneGroup: { ...firstPaneGroup, activeTabId: existingTab.id },
            activePaneId: 'first'
          })
        } else if (secondPaneGroup.tabIds.includes(existingTab.id)) {
          set({
            secondPaneGroup: { ...secondPaneGroup, activeTabId: existingTab.id },
            activePaneId: 'second'
          })
        }
      }
    } else {
      // Create new workspace tab
      const tabId = openTab({
        type: 'workspace',
        workspaceId: id,
        title: workspaceName
      })
      set({
        selectedWorkspaceId: id,
        selectedAgentId: null,
        selectedFilePath: null,
        selectedConversationId: null,
        activeTabId: tabId
      })
    }
  },

  selectAgent: (agentId: string | null, workspaceId?: string) => {
    if (!agentId) {
      set({ selectedAgentId: null })
      return
    }

    const wsId = workspaceId || get().selectedWorkspaceId
    set({
      selectedWorkspaceId: wsId,
      selectedAgentId: agentId
    })
  },

  selectFile: (filePath: string | null) => {
    if (!filePath) {
      set({ selectedFilePath: null })
      return
    }

    const { tabs, openTab, selectedWorkspaceId, splitPaneEnabled, firstPaneGroup, secondPaneGroup, trackFileView } = get()

    // Track this file view for @ mention suggestions
    if (selectedWorkspaceId) {
      trackFileView(selectedWorkspaceId, filePath)
    }
    const filename = filePath.split('/').pop() || 'File'

    // Check if tab already exists
    const existingTab = tabs.find(t => t.type === 'file' && t.filePath === filePath)
    if (existingTab) {
      set({
        selectedFilePath: filePath,
        selectedConversationId: null,
        activeTabId: existingTab.id
      })

      // If split mode, also activate in the correct pane group
      if (splitPaneEnabled) {
        if (firstPaneGroup.tabIds.includes(existingTab.id)) {
          set({
            firstPaneGroup: { ...firstPaneGroup, activeTabId: existingTab.id },
            activePaneId: 'first'
          })
        } else if (secondPaneGroup.tabIds.includes(existingTab.id)) {
          set({
            secondPaneGroup: { ...secondPaneGroup, activeTabId: existingTab.id },
            activePaneId: 'second'
          })
        }
      }
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
        selectedConversationId: null,
        activeTabId: tabId
      })
    }
  },

  // Select a conversation and open it as a chat tab
  selectConversation: (conversationId: string, agentId: string, workspaceId: string, title: string) => {
    const { tabs, openTab, splitPaneEnabled, firstPaneGroup, secondPaneGroup } = get()

    // Check if chat tab already exists for this conversation
    const existingTab = tabs.find(t => t.type === 'chat' && t.conversationId === conversationId)
    if (existingTab) {
      set({
        selectedConversationId: conversationId,
        selectedAgentId: agentId,
        selectedWorkspaceId: workspaceId,
        selectedFilePath: null,
        activeTabId: existingTab.id
      })

      // If split mode, also activate in the correct pane group
      if (splitPaneEnabled) {
        if (firstPaneGroup.tabIds.includes(existingTab.id)) {
          set({
            firstPaneGroup: { ...firstPaneGroup, activeTabId: existingTab.id },
            activePaneId: 'first'
          })
        } else if (secondPaneGroup.tabIds.includes(existingTab.id)) {
          set({
            secondPaneGroup: { ...secondPaneGroup, activeTabId: existingTab.id },
            activePaneId: 'second'
          })
        }
      }
    } else {
      // Create new chat tab
      const tabId = openTab({
        type: 'chat',
        conversationId,
        agentId,
        workspaceId,
        title
      })
      set({
        selectedConversationId: conversationId,
        selectedAgentId: agentId,
        selectedWorkspaceId: workspaceId,
        selectedFilePath: null,
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
    // Persist to main process
    window.api?.workspace.toggleExpanded(id)
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
    const { splitPaneEnabled, activePaneId, firstPaneGroup, secondPaneGroup } = get()

    // Add to main tabs array
    set(state => ({
      tabs: [...state.tabs, newTab],
      activeTabId: id
    }))

    // If split mode is enabled, also add to the active pane's group
    if (splitPaneEnabled) {
      const targetKey = activePaneId === 'first' ? 'firstPaneGroup' : 'secondPaneGroup'
      const targetGroup = activePaneId === 'first' ? firstPaneGroup : secondPaneGroup
      set({
        [targetKey]: {
          ...targetGroup,
          tabIds: [...targetGroup.tabIds, id],
          activeTabId: id
        }
      })
      get().saveSplitPaneSettings()
    }

    // Persist tabs
    get().saveTabs()

    return id
  },

  closeTab: (tabId: string) => {
    const { tabs, activeTabId, splitPaneEnabled, firstPaneGroup, secondPaneGroup } = get()
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
      selectedFilePath: newActiveTab?.type === 'file' ? newActiveTab.filePath || null : null,
      selectedWorkspaceId: newActiveTab?.workspaceId || get().selectedWorkspaceId,
      // Clear agent/conversation selection unless the new active tab is a chat tab
      selectedAgentId: newActiveTab?.type === 'chat' ? newActiveTab.agentId || null : null,
      selectedConversationId: newActiveTab?.type === 'chat' ? newActiveTab.conversationId || null : null
    })

    // Also remove from pane groups if split mode is enabled
    if (splitPaneEnabled) {
      const updates: Record<string, TabGroup> = {}

      if (firstPaneGroup.tabIds.includes(tabId)) {
        const newTabIds = firstPaneGroup.tabIds.filter(id => id !== tabId)
        const idx = firstPaneGroup.tabIds.indexOf(tabId)
        let newActiveId = firstPaneGroup.activeTabId
        if (firstPaneGroup.activeTabId === tabId) {
          newActiveId = newTabIds.length > 0 ? (idx > 0 ? newTabIds[idx - 1] : newTabIds[0]) : null
        }
        updates.firstPaneGroup = { ...firstPaneGroup, tabIds: newTabIds, activeTabId: newActiveId }
      }

      if (secondPaneGroup.tabIds.includes(tabId)) {
        const newTabIds = secondPaneGroup.tabIds.filter(id => id !== tabId)
        const idx = secondPaneGroup.tabIds.indexOf(tabId)
        let newActiveId = secondPaneGroup.activeTabId
        if (secondPaneGroup.activeTabId === tabId) {
          newActiveId = newTabIds.length > 0 ? (idx > 0 ? newTabIds[idx - 1] : newTabIds[0]) : null
        }
        updates.secondPaneGroup = { ...secondPaneGroup, tabIds: newTabIds, activeTabId: newActiveId }
      }

      if (Object.keys(updates).length > 0) {
        set(updates)
        get().saveSplitPaneSettings()
      }
    }

    // Persist tabs
    get().saveTabs()
  },

  activateTab: (tabId: string) => {
    const { tabs } = get()
    const tab = tabs.find(t => t.id === tabId)
    if (!tab) return

    if (tab.type === 'chat') {
      set({
        activeTabId: tabId,
        selectedConversationId: tab.conversationId || null,
        selectedAgentId: tab.agentId || null,
        selectedWorkspaceId: tab.workspaceId || get().selectedWorkspaceId,
        selectedFilePath: null
      })
    } else if (tab.type === 'workspace') {
      set({
        activeTabId: tabId,
        selectedWorkspaceId: tab.workspaceId || null,
        selectedAgentId: null,
        selectedFilePath: null,
        selectedConversationId: null
      })
    } else {
      // file tab
      set({
        activeTabId: tabId,
        selectedFilePath: tab.filePath || null,
        selectedWorkspaceId: tab.workspaceId || get().selectedWorkspaceId,
        selectedConversationId: null
      })
    }
  },

  loadTabs: async () => {
    if (!window.api) return

    try {
      const result = await window.api.settings.get()
      if (result.success && result.data?.openTabs) {
        const { tabs: savedTabs, activeTabId: savedActiveTabId } = result.data.openTabs
        // Load both file and chat tabs
        const validTabs = savedTabs || []
        if (validTabs.length > 0) {
          const newActiveTabId = validTabs.find((t: Tab) => t.id === savedActiveTabId)?.id || validTabs[0]?.id || null
          set({ tabs: validTabs, activeTabId: newActiveTabId })

          // Set selection state based on active tab
          const activeTab = validTabs.find((t: Tab) => t.id === newActiveTabId)
          if (activeTab) {
            if (activeTab.type === 'chat') {
              set({
                selectedConversationId: activeTab.conversationId || null,
                selectedAgentId: activeTab.agentId || null,
                selectedWorkspaceId: activeTab.workspaceId || null,
                selectedFilePath: null
              })
            } else if (activeTab.type === 'workspace') {
              set({
                selectedWorkspaceId: activeTab.workspaceId || null,
                selectedAgentId: null,
                selectedFilePath: null,
                selectedConversationId: null
              })
            } else {
              // file tab
              set({
                selectedFilePath: activeTab.filePath || null,
                selectedWorkspaceId: activeTab.workspaceId || null,
                selectedConversationId: null
              })
            }
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
  },

  // Slash command actions
  loadCommands: async (workspaceId: string) => {
    if (!window.api) return

    try {
      const result = await window.api.commands.discover(workspaceId)
      if (result.success && result.data) {
        set((state) => {
          const newMap = new Map(state.workspaceCommands)
          newMap.set(workspaceId, result.data!)
          return { workspaceCommands: newMap }
        })
      }
    } catch {
      // Silently fail
    }
  },

  refreshCommands: async (workspaceId: string) => {
    // Same as loadCommands - always re-scans
    await get().loadCommands(workspaceId)
  },

  getCommands: (workspaceId: string) => {
    return get().workspaceCommands.get(workspaceId) || []
  },

  // Track file view for @ mention suggestions
  trackFileView: (workspaceId: string, filePath: string) => {
    const { recentlyViewedFiles } = get()
    const current = recentlyViewedFiles.get(workspaceId) || []

    // Move to front, remove duplicates, limit to 10
    const updated = [filePath, ...current.filter(p => p !== filePath)].slice(0, 10)

    const newMap = new Map(recentlyViewedFiles)
    newMap.set(workspaceId, updated)
    set({ recentlyViewedFiles: newMap })
  },

  // Get recently viewed files for a workspace
  getRecentlyViewedFiles: (workspaceId: string) => {
    return get().recentlyViewedFiles.get(workspaceId) || []
  },

  // Split pane actions
  toggleSplitPane: () => {
    const { splitPaneEnabled, tabs, firstPaneGroup, secondPaneGroup } = get()
    const newEnabled = !splitPaneEnabled

    if (newEnabled && tabs.length >= 1) {
      // When enabling split, ensure ALL tabs are assigned to a group
      // Find tabs that aren't in either group
      const assignedTabIds = new Set([...firstPaneGroup.tabIds, ...secondPaneGroup.tabIds])
      const unassignedTabs = tabs.filter(t => !assignedTabIds.has(t.id))

      if (unassignedTabs.length > 0 || assignedTabIds.size === 0) {
        // Need to distribute tabs
        // Start with existing group assignments, then add unassigned tabs
        let newFirstTabIds = [...firstPaneGroup.tabIds]
        let newSecondTabIds = [...secondPaneGroup.tabIds]

        if (assignedTabIds.size === 0) {
          // No tabs assigned yet - distribute all evenly
          const midpoint = Math.ceil(tabs.length / 2)
          newFirstTabIds = tabs.slice(0, midpoint).map(t => t.id)
          newSecondTabIds = tabs.slice(midpoint).map(t => t.id)
        } else {
          // Add unassigned tabs to the first pane (or distribute evenly)
          for (const tab of unassignedTabs) {
            // Add to the smaller group to balance
            if (newFirstTabIds.length <= newSecondTabIds.length) {
              newFirstTabIds.push(tab.id)
            } else {
              newSecondTabIds.push(tab.id)
            }
          }
        }

        // Determine active tab for each pane - use existing if valid, otherwise first tab
        const firstActiveTab = newFirstTabIds.includes(firstPaneGroup.activeTabId || '')
          ? firstPaneGroup.activeTabId
          : newFirstTabIds[0] || null
        const secondActiveTab = newSecondTabIds.includes(secondPaneGroup.activeTabId || '')
          ? secondPaneGroup.activeTabId
          : newSecondTabIds[0] || null

        set({
          splitPaneEnabled: newEnabled,
          firstPaneGroup: {
            id: 'first',
            tabIds: newFirstTabIds,
            activeTabId: firstActiveTab
          },
          secondPaneGroup: {
            id: 'second',
            tabIds: newSecondTabIds,
            activeTabId: secondActiveTab
          },
          activePaneId: 'first'
        })
      } else {
        // All tabs already assigned
        set({ splitPaneEnabled: newEnabled })
      }
    } else {
      // Disabling split - keep tabs but disable split view
      set({ splitPaneEnabled: newEnabled })
    }
    get().saveSplitPaneSettings()
  },

  setSplitPaneRatio: (ratio: number) => {
    // Clamp between 10 and 90 to ensure both panes are usable
    const clampedRatio = Math.min(Math.max(ratio, 10), 90)
    set({ splitPaneRatio: clampedRatio })
  },

  setSplitPaneOrientation: (orientation: 'vertical' | 'horizontal') => {
    set({ splitPaneOrientation: orientation })
    get().saveSplitPaneSettings()
  },

  swapSplitPanes: () => {
    const { firstPaneGroup, secondPaneGroup } = get()
    set({
      firstPaneGroup: { ...secondPaneGroup, id: 'first' },
      secondPaneGroup: { ...firstPaneGroup, id: 'second' }
    })
    get().saveSplitPaneSettings()
  },

  setActivePaneTab: (paneId: 'first' | 'second', tabId: string) => {
    const key = paneId === 'first' ? 'firstPaneGroup' : 'secondPaneGroup'
    const group = get()[key]
    set({
      [key]: { ...group, activeTabId: tabId },
      activePaneId: paneId
    })
    get().saveSplitPaneSettings()
  },

  moveTabToPane: (tabId: string, targetPaneId: 'first' | 'second') => {
    const { firstPaneGroup, secondPaneGroup } = get()
    const isInFirst = firstPaneGroup.tabIds.includes(tabId)
    const isInSecond = secondPaneGroup.tabIds.includes(tabId)

    // Tab not in either group (from main tab bar) - add to target
    if (!isInFirst && !isInSecond) {
      const targetGroup = targetPaneId === 'first' ? firstPaneGroup : secondPaneGroup
      const targetKey = targetPaneId === 'first' ? 'firstPaneGroup' : 'secondPaneGroup'
      set({
        [targetKey]: {
          ...targetGroup,
          tabIds: [...targetGroup.tabIds, tabId],
          activeTabId: tabId
        },
        activePaneId: targetPaneId
      })
      get().saveSplitPaneSettings()
      return
    }

    const sourceKey = isInFirst ? 'firstPaneGroup' : 'secondPaneGroup'
    const targetKey = targetPaneId === 'first' ? 'firstPaneGroup' : 'secondPaneGroup'

    if (sourceKey === targetKey) return // Already in target pane

    const sourceGroup = isInFirst ? firstPaneGroup : secondPaneGroup
    const targetGroup = targetPaneId === 'first' ? firstPaneGroup : secondPaneGroup

    // Remove from source
    const newSourceTabIds = sourceGroup.tabIds.filter(id => id !== tabId)
    const newSourceActiveTabId = sourceGroup.activeTabId === tabId
      ? (newSourceTabIds[0] || null)
      : sourceGroup.activeTabId

    // Add to target
    const newTargetTabIds = [...targetGroup.tabIds, tabId]

    set({
      [sourceKey]: { ...sourceGroup, tabIds: newSourceTabIds, activeTabId: newSourceActiveTabId },
      [targetKey]: { ...targetGroup, tabIds: newTargetTabIds, activeTabId: tabId },
      activePaneId: targetPaneId
    })
    get().saveSplitPaneSettings()
  },

  closeTabInPane: (paneId: 'first' | 'second', tabId: string) => {
    const key = paneId === 'first' ? 'firstPaneGroup' : 'secondPaneGroup'
    const group = get()[key]

    const tabIndex = group.tabIds.indexOf(tabId)
    if (tabIndex === -1) return

    const newTabIds = group.tabIds.filter(id => id !== tabId)
    let newActiveTabId = group.activeTabId
    if (group.activeTabId === tabId) {
      // Select adjacent tab
      if (newTabIds.length === 0) {
        newActiveTabId = null
      } else if (tabIndex > 0) {
        newActiveTabId = newTabIds[tabIndex - 1]
      } else {
        newActiveTabId = newTabIds[0]
      }
    }

    set({
      [key]: { ...group, tabIds: newTabIds, activeTabId: newActiveTabId }
    })

    // Also close the tab from the main tabs list
    get().closeTab(tabId)
  },

  setActivePane: (paneId: 'first' | 'second') => {
    set({ activePaneId: paneId })
  },

  saveSplitPaneSettings: async () => {
    if (!window.api) return

    const { splitPaneEnabled, splitPaneRatio, splitPaneOrientation, firstPaneGroup, secondPaneGroup } = get()
    try {
      await window.api.settings.set({
        splitPane: {
          enabled: splitPaneEnabled,
          ratio: splitPaneRatio,
          orientation: splitPaneOrientation,
          firstPaneGroup,
          secondPaneGroup
        }
      })
    } catch {
      // Silently fail
    }
  },

  // Unsaved files actions
  markFileUnsaved: (filePath: string) => {
    const { unsavedFiles } = get()
    if (!unsavedFiles.has(filePath)) {
      const newSet = new Set(unsavedFiles)
      newSet.add(filePath)
      set({ unsavedFiles: newSet })
    }
  },

  markFileSaved: (filePath: string) => {
    const { unsavedFiles } = get()
    if (unsavedFiles.has(filePath)) {
      const newSet = new Set(unsavedFiles)
      newSet.delete(filePath)
      set({ unsavedFiles: newSet })
    }
  },

  isFileUnsaved: (filePath: string) => {
    return get().unsavedFiles.has(filePath)
  },

  // Trigger branch refresh across all components watching branchRefreshKey
  triggerBranchRefresh: () => {
    set({ branchRefreshKey: get().branchRefreshKey + 1 })
  }
}))
