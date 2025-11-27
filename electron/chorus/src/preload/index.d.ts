import { ElectronAPI } from '@electron-toolkit/preload'

// Types for our custom API responses
interface FileResult {
  success: boolean
  content?: string
  error?: string
}

interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
}

interface DirectoryResult {
  success: boolean
  entries?: DirectoryEntry[]
  error?: string
}

interface SelectFileResult {
  success: boolean
  filePath?: string
  error?: string
}

interface SelectDirectoryResult {
  success: boolean
  dirPath?: string
  error?: string
}

// Git types (Module 4)
interface GitIsRepoResult {
  success: boolean
  isRepo?: boolean
  error?: string
}

interface GitStatusFile {
  status: string
  file: string
}

interface GitStatusResult {
  success: boolean
  files?: GitStatusFile[]
  hasChanges?: boolean
  error?: string
}

interface GitCommit {
  hash: string
  message: string
}

interface GitLogResult {
  success: boolean
  commits?: GitCommit[]
  error?: string
}

interface GitBranchResult {
  success: boolean
  branch?: string
  error?: string
}

interface ClaudeConfigResult {
  success: boolean
  hasClaudeMd?: boolean
  hasClaudeDir?: boolean
  claudeMdPath?: string
  claudeDir?: string
}

// Agent types (Module 5)
interface AgentResult {
  success: boolean
  error?: string
}

interface AgentMessage {
  agentId: string
  type: 'text' | 'tool_use' | 'tool_result' | 'done' | 'error' | 'status'
  content: string
  timestamp: Date
}

interface AgentStatus {
  agentId: string
  status: 'ready' | 'busy'
}

// Store types (Module 7)
interface StoredAgent {
  id: string
  name: string
  repoPath: string
  createdAt: string
}

interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface StoreAgentsResult {
  success: boolean
  agents?: StoredAgent[]
  error?: string
}

interface StoreMessagesResult {
  success: boolean
  messages?: StoredMessage[]
  error?: string
}

interface StoreSessionResult {
  success: boolean
  sessionId?: string
  error?: string
}

interface StoreResult {
  success: boolean
  error?: string
}

interface StoreAPI {
  // Agent persistence
  getAgents: () => Promise<StoreAgentsResult>
  addAgent: (agent: StoredAgent) => Promise<StoreResult>
  removeAgent: (agentId: string) => Promise<StoreResult>

  // Message persistence
  getMessages: (agentId: string) => Promise<StoreMessagesResult>
  addMessage: (agentId: string, message: StoredMessage) => Promise<StoreResult>
  clearMessages: (agentId: string) => Promise<StoreResult>

  // Session persistence
  getSession: (agentId: string) => Promise<StoreSessionResult>
  setSession: (agentId: string, sessionId: string) => Promise<StoreResult>
  clearSession: (agentId: string) => Promise<StoreResult>
}

// Our custom API exposed via contextBridge
interface CustomAPI {
  // File operations
  readFile: (filePath: string) => Promise<FileResult>
  listDirectory: (dirPath: string) => Promise<DirectoryResult>
  selectFile: () => Promise<SelectFileResult>
  selectDirectory: () => Promise<SelectDirectoryResult>

  // Git operations (Module 4)
  gitIsRepo: (repoPath: string) => Promise<GitIsRepoResult>
  gitStatus: (repoPath: string) => Promise<GitStatusResult>
  gitLog: (repoPath: string, count?: number) => Promise<GitLogResult>
  gitBranch: (repoPath: string) => Promise<GitBranchResult>
  checkClaudeConfig: (repoPath: string) => Promise<ClaudeConfigResult>

  // Agent operations (Module 5)
  sendToAgent: (agentId: string, repoPath: string, message: string) => Promise<AgentResult>
  stopAgent: (agentId: string) => Promise<AgentResult>
  clearAgentSession: (agentId: string) => Promise<AgentResult>
  onAgentMessage: (callback: (message: AgentMessage) => void) => () => void
  onAgentStatus: (callback: (status: AgentStatus) => void) => () => void

  // Store operations (Module 7)
  store: StoreAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}
