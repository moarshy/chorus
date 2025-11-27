import { create } from 'zustand'
import type { Workspace, ChorusSettings } from '../types'

interface WorkspaceStore {
  // State
  workspaces: Workspace[]
  selectedWorkspaceId: string | null
  selectedAgentId: string | null
  selectedFilePath: string | null
  settings: ChorusSettings | null
  isLoading: boolean
  error: string | null

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
    } catch (error) {
      console.error('Failed to load settings:', error)
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
    } catch (error) {
      console.error('Failed to refresh workspace:', error)
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
    // If workspaceId provided, also select the workspace
    if (workspaceId) {
      set({ selectedWorkspaceId: workspaceId, selectedAgentId: agentId, selectedFilePath: null })
    } else {
      set({ selectedAgentId: agentId, selectedFilePath: null })
    }
  },

  selectFile: (filePath: string | null) => {
    set({ selectedFilePath: filePath, selectedAgentId: null })
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
  clearError: () => set({ error: null })
}))
