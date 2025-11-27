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
  chatSidebarCollapsed: boolean
  chatSidebarWidth: number
}

// ============================================
// Conversation Types
// ============================================

interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  name?: string
  input?: Record<string, unknown>
}

interface ConversationMessage {
  uuid: string
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'error' | 'system'
  content: string | ContentBlock[]
  timestamp: string
  sessionId?: string
  toolName?: string
  toolInput?: Record<string, unknown>
}

interface Conversation {
  id: string
  sessionId: string | null
  agentId: string
  workspaceId: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

// ============================================
// Agent Streaming Event Types
// ============================================

interface AgentStreamDelta {
  conversationId: string
  delta: string
}

interface AgentMessageEvent {
  conversationId: string
  message: ConversationMessage
}

interface AgentStatusEvent {
  agentId: string
  status: 'ready' | 'busy' | 'error'
  error?: string
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

interface ConversationAPI {
  list: (workspaceId: string, agentId: string) => Promise<ApiResult<Conversation[]>>
  create: (workspaceId: string, agentId: string) => Promise<ApiResult<Conversation>>
  load: (conversationId: string) => Promise<ApiResult<{ conversation: Conversation | null; messages: ConversationMessage[] }>>
  delete: (conversationId: string) => Promise<ApiResult>
}

interface AgentAPI {
  send: (conversationId: string, message: string, repoPath: string, sessionId?: string) => Promise<ApiResult>
  stop: (agentId: string) => Promise<ApiResult>
  checkAvailable: () => Promise<ApiResult<string | null>>
  onStreamDelta: (callback: (event: AgentStreamDelta) => void) => () => void
  onMessage: (callback: (event: AgentMessageEvent) => void) => () => void
  onStatus: (callback: (event: AgentStatusEvent) => void) => () => void
}

interface SessionAPI {
  get: (agentId: string) => Promise<ApiResult<string | null>>
  clear: (agentId: string) => Promise<ApiResult>
}

interface CustomAPI {
  settings: SettingsAPI
  workspace: WorkspaceAPI
  agents: AgentsAPI
  fs: FileSystemAPI
  dialog: DialogAPI
  git: GitAPI
  conversation: ConversationAPI
  agent: AgentAPI
  session: SessionAPI
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
  ApiResult,
  ContentBlock,
  ConversationMessage,
  Conversation,
  AgentStreamDelta,
  AgentMessageEvent,
  AgentStatusEvent
}
