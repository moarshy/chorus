import { ElectronAPI } from '@electron-toolkit/preload'

// ============================================
// API Response Types
// ============================================

interface ApiResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

// ============================================
// Domain Types
// ============================================

interface Agent {
  id: string
  name: string
  filePath: string
  workspaceId: string
}

interface Workspace {
  id: string
  name: string
  path: string
  isExpanded: boolean
  gitBranch: string | null
  isDirty: boolean
  hasSystemPrompt: boolean
  agents: Agent[]
}

interface ChorusSettings {
  rootWorkspaceDir: string
  theme: 'dark' | 'light'
}

interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
}

interface GitChange {
  status: string
  file: string
}

interface GitStatus {
  isDirty: boolean
  changes: GitChange[]
}

interface GitCommit {
  hash: string
  message: string
  author?: string
  date?: string
}

interface CloneProgress {
  phase: string
  percent: number
  message: string
}

interface CloneResult {
  success: boolean
  targetDir?: string
  error?: string
}

// ============================================
// API Interface
// ============================================

interface SettingsAPI {
  get: () => Promise<ApiResult<ChorusSettings>>
  set: (settings: Partial<ChorusSettings>) => Promise<ApiResult>
  getRootDir: () => Promise<ApiResult<string>>
  setRootDir: (path: string) => Promise<ApiResult>
}

interface WorkspaceAPI {
  list: () => Promise<ApiResult<Workspace[]>>
  add: (path: string) => Promise<ApiResult<Workspace>>
  remove: (id: string) => Promise<ApiResult>
  refresh: (id: string) => Promise<ApiResult<Workspace>>
}

interface AgentsAPI {
  discover: (repoPath: string) => Promise<ApiResult<Omit<Agent, 'workspaceId'>[]>>
}

interface FileSystemAPI {
  listDirectory: (path: string) => Promise<ApiResult<DirectoryEntry[]>>
  readFile: (path: string) => Promise<ApiResult<string>>
}

interface DialogAPI {
  selectDirectory: () => Promise<ApiResult<string>>
}

interface GitAPI {
  isRepo: (path: string) => Promise<ApiResult<boolean>>
  status: (path: string) => Promise<ApiResult<GitStatus>>
  branch: (path: string) => Promise<ApiResult<string | null>>
  log: (path: string, count?: number) => Promise<ApiResult<GitCommit[]>>
  clone: (url: string, targetDir: string) => Promise<ApiResult>
  cancelClone: () => Promise<ApiResult>
  onCloneProgress: (callback: (progress: CloneProgress) => void) => () => void
  onCloneComplete: (callback: (result: CloneResult) => void) => () => void
}

interface CustomAPI {
  settings: SettingsAPI
  workspace: WorkspaceAPI
  agents: AgentsAPI
  fs: FileSystemAPI
  dialog: DialogAPI
  git: GitAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}

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
}
