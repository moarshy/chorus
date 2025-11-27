// Re-export types from preload for convenience
export type {
  Agent,
  Workspace,
  ChorusSettings,
  DirectoryEntry,
  GitChange,
  GitStatus,
  GitCommit,
  CloneProgress,
  CloneResult,
  ApiResult
} from '../../../preload/index.d'

// UI-specific types
export type SidebarTab = 'workspaces' | 'files'

export type MainPaneView = 'welcome' | 'workspace' | 'file' | 'agent'

export interface FileTreeNode {
  id: string
  name: string
  path: string
  isDirectory: boolean
  children?: FileTreeNode[]
}
