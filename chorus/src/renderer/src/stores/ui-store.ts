import { create } from 'zustand'
import type { SidebarTab } from '../types'

interface UIStore {
  // Sidebar state
  sidebarTab: SidebarTab
  sidebarWidth: number

  // Dialog state
  isSettingsOpen: boolean
  isAddWorkspaceOpen: boolean

  // Actions
  setSidebarTab: (tab: SidebarTab) => void
  setSidebarWidth: (width: number) => void
  openSettings: () => void
  closeSettings: () => void
  openAddWorkspace: () => void
  closeAddWorkspace: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  // Initial state
  sidebarTab: 'workspaces',
  sidebarWidth: 256,
  isSettingsOpen: false,
  isAddWorkspaceOpen: false,

  // Actions
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(200, Math.min(400, width)) }),
  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),
  openAddWorkspace: () => set({ isAddWorkspaceOpen: true }),
  closeAddWorkspace: () => set({ isAddWorkspaceOpen: false })
}))
