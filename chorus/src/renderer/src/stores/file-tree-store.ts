import { create } from 'zustand'

interface FileTreeStore {
  // State - track which paths are expanded
  expandedPaths: Set<string>

  // Actions
  toggleExpanded: (path: string) => void
  expandPath: (path: string) => void
  collapsePath: (path: string) => void
  collapseAll: () => void
  isExpanded: (path: string) => boolean
}

export const useFileTreeStore = create<FileTreeStore>((set, get) => ({
  expandedPaths: new Set<string>(),

  toggleExpanded: (path: string) => {
    const { expandedPaths } = get()
    const newSet = new Set(expandedPaths)
    if (newSet.has(path)) {
      newSet.delete(path)
    } else {
      newSet.add(path)
    }
    set({ expandedPaths: newSet })
  },

  expandPath: (path: string) => {
    const { expandedPaths } = get()
    if (!expandedPaths.has(path)) {
      const newSet = new Set(expandedPaths)
      newSet.add(path)
      set({ expandedPaths: newSet })
    }
  },

  collapsePath: (path: string) => {
    const { expandedPaths } = get()
    if (expandedPaths.has(path)) {
      const newSet = new Set(expandedPaths)
      newSet.delete(path)
      set({ expandedPaths: newSet })
    }
  },

  collapseAll: () => {
    set({ expandedPaths: new Set() })
  },

  isExpanded: (path: string) => {
    return get().expandedPaths.has(path)
  }
}))
