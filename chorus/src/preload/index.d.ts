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

// Agent type - determines which backend service handles the agent
type AgentType = 'claude' | 'openai-research'

interface Agent {
  id: string
  name: string
  filePath: string
  workspaceId: string
  isGeneral?: boolean    // True for built-in agents (Chorus, Deep Research)
  type?: AgentType       // 'claude' (default) or 'openai-research'
  description?: string   // Agent description for display
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

// Tab type for persistence
interface Tab {
  id: string
  type: 'chat' | 'file' | 'workspace'
  workspaceId?: string
  agentId?: string
  conversationId?: string  // For chat tabs
  filePath?: string
  title: string
}

interface OpenTabsState {
  tabs: Tab[]
  activeTabId: string | null
}

// Tab group for split pane - each pane has its own group of tabs
interface TabGroup {
  id: string                    // 'first' or 'second'
  tabIds: string[]              // Ordered list of tab IDs in this group
  activeTabId: string | null    // Currently active tab in this group
}

// Split pane settings for dual-pane view
interface SplitPaneSettings {
  enabled: boolean
  ratio: number              // 0-100, percentage for first pane (top or left)
  orientation: 'vertical' | 'horizontal'  // vertical = top/bottom, horizontal = left/right
  firstPaneGroup: TabGroup      // Tab group for first pane (top/left)
  secondPaneGroup: TabGroup     // Tab group for second pane (bottom/right)
}

// Editor font options
type EditorFontFamily = 'default' | 'jetbrains-mono' | 'fira-code' | 'sf-mono' | 'consolas'
type EditorFontSize = 12 | 13 | 14 | 15 | 16

interface ChorusSettings {
  rootWorkspaceDir: string
  theme: 'dark' | 'light'
  chatSidebarCollapsed: boolean
  chatSidebarWidth: number
  openTabs?: OpenTabsState
  splitPane?: SplitPaneSettings
  editorFontFamily?: EditorFontFamily
  editorFontSize?: EditorFontSize
  // OpenAI settings
  openaiApiKey?: string
  researchOutputDirectory?: string  // Default: './research'
}

// ============================================
// Claude Code Message Types (Raw Format)
// ============================================

// Content block types from Claude Code stream-json output
interface TextBlock {
  type: 'text'
  text: string
}

interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error: boolean
}

interface ThinkingBlock {
  type: 'thinking'
  thinking: string
}

interface ImageBlock {
  type: 'image'
  source: {
    type: 'base64'
    media_type: string
    data: string
  }
}

type ClaudeContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | ThinkingBlock | ImageBlock

// Claude Code system init message
interface ClaudeSystemMessage {
  type: 'system'
  subtype: 'init'
  session_id: string
  tools: string[]
  mcp_servers: string[]
  model: string
  cwd: string
  permissionMode: string
}

// Claude Code assistant message
interface ClaudeAssistantMessage {
  type: 'assistant'
  message: {
    id: string
    type: 'message'
    role: 'assistant'
    content: ClaudeContentBlock[]
    model: string
    stop_reason: string
    stop_sequence: string | null
    usage: {
      input_tokens: number
      output_tokens: number
      cache_creation_input_tokens: number
      cache_read_input_tokens: number
    }
  }
}

// Claude Code user message (tool results)
interface ClaudeUserMessage {
  type: 'user'
  message: {
    role: 'user'
    content: ClaudeContentBlock[]
  }
}

// Model usage breakdown from result message
interface ModelUsageEntry {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  webSearchRequests: number
  costUSD: number
  contextWindow: number
}

// Claude Code result message
interface ClaudeResultMessage {
  type: 'result'
  result: string
  subtype: 'success' | 'error' | 'error_max_turns' | 'error_during_execution'
  session_id: string
  total_cost_usd: number
  duration_ms: number
  duration_api_ms: number
  num_turns: number
  is_error: boolean
  usage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens: number
    cache_read_input_tokens: number
  }
  modelUsage: Record<string, ModelUsageEntry>
}

// Union of all Claude Code message types
type ClaudeCodeMessage = ClaudeSystemMessage | ClaudeAssistantMessage | ClaudeUserMessage | ClaudeResultMessage

// ============================================
// Conversation Types
// ============================================

// Simplified content block for display
interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  name?: string
  input?: Record<string, unknown>
}

// Research progress phase types
type ResearchPhase = 'analyzing' | 'searching' | 'reasoning' | 'synthesizing' | 'complete'

// Research source discovered during web search
interface ResearchSource {
  url?: string
  title?: string
  query?: string
}

// Stored message format - includes both raw Claude message and display-friendly data
interface ConversationMessage {
  uuid: string
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'error' | 'system' | 'research_progress' | 'research_result'
  content: string | ContentBlock[]
  timestamp: string
  sessionId?: string
  toolName?: string
  toolInput?: Record<string, unknown>
  // Tool execution linking - allows pairing tool_use with its tool_result
  toolUseId?: string
  // For tool_result: indicates if the tool execution failed
  isToolError?: boolean
  // Raw Claude Code message (preserved exactly as received)
  claudeMessage?: ClaudeCodeMessage
  // Metadata from result messages
  costUsd?: number
  durationMs?: number
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
  // Context window from the model used (from result.modelUsage)
  contextWindow?: number
  // Number of turns in this session
  numTurns?: number
  // Research-specific fields (for type 'research_progress' and 'research_result')
  researchPhase?: ResearchPhase
  researchSources?: ResearchSource[]
  searchCount?: number
  // Research result metadata
  outputPath?: string
  wordCount?: number
  sourceCount?: number
}

interface Conversation {
  id: string
  sessionId: string | null
  sessionCreatedAt: string | null  // ISO timestamp when session was created (for expiry tracking)
  branchName: string | null        // Git branch name associated with this conversation
  worktreePath: string | null      // Path to worktree if using worktree isolation (Sprint 16)
  agentId: string
  workspaceId: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
  settings?: ConversationSettings
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
  agentId: string
  message: ConversationMessage
}

interface AgentStatusEvent {
  agentId: string
  status: 'ready' | 'busy' | 'error'
  error?: string
}

interface AgentSessionUpdateEvent {
  conversationId: string
  sessionId: string
  sessionCreatedAt: string
}

// Permission request event from SDK canUseTool callback
interface PermissionRequestEvent {
  requestId: string
  conversationId: string
  toolName: string
  toolInput: Record<string, unknown>
}

// Permission response for SDK canUseTool callback
interface PermissionResponse {
  approved: boolean
  reason?: string
  stopCompletely?: boolean
}

// File change event from SDK PostToolUse hook
interface FileChangedEvent {
  conversationId: string
  filePath: string
  toolName: string
}

// Todo item from TodoWrite tool
interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm: string
}

// Todo update event from TodoWrite tool interception
interface TodoUpdateEvent {
  conversationId: string
  todos: TodoItem[]
  timestamp: string
}

// File change record for Details panel
interface FileChange {
  path: string
  toolName: 'Write' | 'Edit'
  timestamp: string
}

interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
}

interface WalkEntry extends DirectoryEntry {
  relativePath: string
}

interface GitChange {
  status: string
  file: string
}

interface GitStatus {
  isDirty: boolean
  changes: GitChange[]
}

export interface DetailedGitStatus {
  staged: GitChange[]
  unstaged: GitChange[]
}

export interface BranchSyncStatus {
  ahead: number
  behind: number
  upstream: string | null
  remote: string | null
  branch: string
}

// Changed file from git status (for @ mention suggestions)
interface ChangedFile {
  path: string
  status: 'M' | 'A' | 'D' | '?'  // Modified, Added, Deleted, Untracked
}

interface GitCommit {
  hash: string
  message: string
  author?: string
  date?: string
}

interface GitBranch {
  name: string
  isCurrent: boolean
  isRemote: boolean
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

// Diff hunk structure
interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  content: string
}

// File diff structure
interface FileDiff {
  filePath: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  additions: number
  deletions: number
  hunks: DiffHunk[]
}

// Agent branch info for automated git operations
interface AgentBranchInfo {
  name: string
  agentName: string
  sessionId: string
  lastCommitDate: string
  commitCount: number
  isCurrent: boolean
}

// Git branch created event (from auto-branch)
interface GitBranchCreatedEvent {
  conversationId: string
  branchName: string
  agentName: string
}

// Git commit created event (from auto-commit)
interface GitCommitCreatedEvent {
  conversationId: string
  branchName: string
  commitHash: string
  message: string
  files: string[]
  type: 'turn' | 'stop'
}

// Conversations deleted event (from branch cascade deletion)
interface ConversationsDeletedEvent {
  conversationIds: string[]
  reason: 'branch-deleted'
}

// Merge analysis result for preview dialog (E-3)
interface MergeAnalysis {
  canMerge: boolean
  behindCount: number
  conflictFiles: string[]
  changedFiles: FileDiff[]
  error?: string
}

// Worktree information (Sprint 16)
interface WorktreeInfo {
  path: string              // Absolute path to worktree
  branch: string            // Branch checked out (or 'HEAD' if detached)
  commit: string            // Current HEAD commit
  isMain: boolean           // Is this the main working tree?
  isLocked: boolean         // Is worktree locked?
  prunable: boolean         // Can be safely pruned?
}

// Worktree status
interface WorktreeStatus {
  isDirty: boolean
  untrackedFiles: number
  modifiedFiles: number
  stagedFiles: number
}

// GitHub CLI status (Sprint 17 - Create Workspace)
interface GhCliStatus {
  installed: boolean
  authenticated: boolean
  username?: string
}

// Create repo result (Sprint 17 - Create Workspace)
interface CreateRepoResult {
  repoUrl: string
  cloneUrl: string
}

// ============================================
// Conversation Settings Types
// ============================================

type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions'

interface ConversationSettings {
  permissionMode: PermissionMode
  allowedTools: string[]
  model: string
}

// Tools that require permissions - user can enable/disable these
// const PERMISSION_TOOLS = ['Bash', 'Edit', 'Write', 'WebFetch', 'WebSearch', 'NotebookEdit']
// Tools always available (no permissions needed)
// const ALWAYS_AVAILABLE = ['Read', 'Glob', 'Grep', 'Task', 'TodoWrite', 'AskUserQuestion']

// Git automation settings
interface GitSettings {
  autoBranch: boolean      // Create branch per agent session
  autoCommit: boolean      // Commit per turn
  useWorktrees: boolean    // Use worktrees for agent isolation (Sprint 16)
}

// Workspace-level default settings
interface WorkspaceSettings {
  defaultPermissionMode: PermissionMode
  defaultAllowedTools: string[]
  defaultModel: string
  git?: GitSettings
}

// Slash command from .claude/commands/*.md files
interface SlashCommand {
  name: string              // Derived from filename (without .md)
  path: string              // Relative path within .claude/commands/
  filePath: string          // Absolute path to .md file
  description?: string      // From frontmatter
  argumentHint?: string     // From frontmatter
  allowedTools?: string     // From frontmatter
  model?: string            // From frontmatter
  content: string           // Full Markdown content (without frontmatter)
}

// ============================================
// API Interface
// ============================================

interface SettingsAPI {
  get: () => Promise<ApiResult<ChorusSettings>>
  set: (settings: Partial<ChorusSettings>) => Promise<ApiResult>
  getRootDir: () => Promise<ApiResult<string>>
  setRootDir: (path: string) => Promise<ApiResult>
  setOpenTabs: (openTabs: OpenTabsState) => Promise<ApiResult>
}

interface WorkspaceAPI {
  list: () => Promise<ApiResult<Workspace[]>>
  add: (path: string) => Promise<ApiResult<Workspace>>
  remove: (id: string) => Promise<ApiResult>
  refresh: (id: string) => Promise<ApiResult<Workspace>>
  toggleExpanded: (id: string) => Promise<ApiResult>
}

interface AgentsAPI {
  discover: (repoPath: string) => Promise<ApiResult<Omit<Agent, 'workspaceId'>[]>>
}

interface FileSystemAPI {
  listDirectory: (path: string) => Promise<ApiResult<DirectoryEntry[]>>
  readFile: (path: string) => Promise<ApiResult<string>>
  writeFile: (path: string, content: string) => Promise<ApiResult>
  walkDirectory: (path: string, maxDepth?: number) => Promise<ApiResult<WalkEntry[]>>
  delete: (path: string) => Promise<ApiResult>
  rename: (oldPath: string, newPath: string) => Promise<ApiResult>
  createFile: (path: string, content?: string) => Promise<ApiResult>
  createDirectory: (path: string) => Promise<ApiResult>
  exists: (path: string) => Promise<ApiResult<boolean>>
}

interface DialogAPI {
  selectDirectory: () => Promise<ApiResult<string>>
}

interface GitAPI {
  isRepo: (path: string) => Promise<ApiResult<boolean>>
  status: (path: string) => Promise<ApiResult<GitStatus>>
  branch: (path: string) => Promise<ApiResult<string | null>>
  listBranches: (path: string) => Promise<ApiResult<GitBranch[]>>
  checkout: (path: string, branch: string, isRemote?: boolean) => Promise<ApiResult>
  log: (path: string, count?: number) => Promise<ApiResult<GitCommit[]>>
  logForBranch: (path: string, branch: string, count?: number) => Promise<ApiResult<GitCommit[]>>
  logForBranchOnly: (path: string, branch: string, baseBranch: string, count?: number) => Promise<ApiResult<GitCommit[]>>
  getDefaultBranch: (path: string) => Promise<ApiResult<string | null>>
  clone: (url: string, targetDir: string) => Promise<ApiResult>
  cancelClone: () => Promise<ApiResult>

  // New automated git operations
  createBranch: (path: string, branchName: string) => Promise<ApiResult>
  commit: (path: string, message: string) => Promise<ApiResult<string>>
  getDiff: (path: string, commitHash?: string) => Promise<ApiResult<FileDiff[]>>
  getDiffBetweenBranches: (path: string, baseBranch: string, targetBranch: string) => Promise<ApiResult<FileDiff[]>>
  merge: (path: string, sourceBranch: string, options?: { squash?: boolean }) => Promise<ApiResult>
  analyzeMerge: (path: string, sourceBranch: string, targetBranch: string) => Promise<ApiResult<MergeAnalysis>>
  deleteBranch: (path: string, branchName: string, force?: boolean, workspaceId?: string) => Promise<ApiResult>
  branchExists: (path: string, branchName: string) => Promise<ApiResult<boolean>>
  getAgentBranches: (path: string) => Promise<ApiResult<AgentBranchInfo[]>>
  stash: (path: string, message?: string) => Promise<ApiResult>
  stashPop: (path: string) => Promise<ApiResult>
  push: (path: string, branchName?: string, options?: { setUpstream?: boolean; force?: boolean }) => Promise<ApiResult>

  // File-level git operations (like GitLens)
  discardChanges: (repoPath: string, filePath: string) => Promise<ApiResult>
  stageFile: (repoPath: string, filePath: string) => Promise<ApiResult>
  unstageFile: (repoPath: string, filePath: string) => Promise<ApiResult>

  // Enhanced git operations for staging workflow
  detailedStatus: (path: string) => Promise<ApiResult<DetailedGitStatus>>
  stageAll: (path: string) => Promise<ApiResult>
  unstageAll: (path: string) => Promise<ApiResult>
  discardAll: (path: string) => Promise<ApiResult>
  fileDiff: (repoPath: string, filePath: string, staged: boolean) => Promise<ApiResult<string>>

  // Remote sync operations
  syncStatus: (path: string) => Promise<ApiResult<BranchSyncStatus>>
  pushSetUpstream: (path: string, remote: string, branch: string) => Promise<ApiResult>
  pull: (path: string) => Promise<ApiResult>
  pullRebase: (path: string) => Promise<ApiResult>
  fetch: (path: string) => Promise<ApiResult>

  // Get changed files for @ mention suggestions
  getChangedFiles: (path: string) => Promise<ApiResult<ChangedFile[]>>

  // Clone progress events
  onCloneProgress: (callback: (progress: CloneProgress) => void) => () => void
  onCloneComplete: (callback: (result: CloneResult) => void) => () => void

  // Git commit events (from agent auto-commits)
  onBranchCreated: (callback: (event: GitBranchCreatedEvent) => void) => () => void
  onCommitCreated: (callback: (event: GitCommitCreatedEvent) => void) => () => void

  // Worktree management (Sprint 16)
  listWorktrees: (repoPath: string) => Promise<ApiResult<WorktreeInfo[]>>
  createWorktree: (repoPath: string, worktreePath: string, branch: string, baseBranch?: string) => Promise<ApiResult>
  removeWorktree: (repoPath: string, worktreePath: string, force?: boolean) => Promise<ApiResult>
  pruneWorktrees: (repoPath: string) => Promise<ApiResult>
  getWorktreeStatus: (worktreePath: string) => Promise<ApiResult<WorktreeStatus>>
  isWorktree: (path: string) => Promise<ApiResult<boolean>>

  // Create Workspace (Sprint 17)
  checkGhCli: () => Promise<ApiResult<GhCliStatus>>
  createRepo: (name: string, options: { description?: string; isPrivate: boolean }) => Promise<ApiResult<CreateRepoResult>>
  initializeWorkspace: (repoPath: string) => Promise<ApiResult>
}

interface ConversationAPI {
  list: (workspaceId: string, agentId: string) => Promise<ApiResult<Conversation[]>>
  create: (workspaceId: string, agentId: string) => Promise<ApiResult<Conversation>>
  load: (conversationId: string) => Promise<ApiResult<{ conversation: Conversation | null; messages: ConversationMessage[] }>>
  delete: (conversationId: string, repoPath?: string) => Promise<ApiResult>
  updateSettings: (conversationId: string, settings: Partial<ConversationSettings>) => Promise<ApiResult<Conversation>>
  // Event: conversations cascade-deleted when branch was deleted
  onDeleted: (callback: (event: ConversationsDeletedEvent) => void) => () => void
}

interface AgentAPI {
  send: (conversationId: string, message: string, repoPath: string, sessionId?: string, agentFilePath?: string) => Promise<ApiResult>
  stop: (agentId: string, conversationId?: string) => Promise<ApiResult>
  checkAvailable: () => Promise<ApiResult<string | null>>
  // Permission response (for SDK canUseTool callback)
  respondPermission: (requestId: string, response: PermissionResponse) => Promise<ApiResult>
  // Event listeners
  onStreamDelta: (callback: (event: AgentStreamDelta) => void) => () => void
  onStreamClear: (callback: (event: { conversationId: string }) => void) => () => void
  onMessage: (callback: (event: AgentMessageEvent) => void) => () => void
  onStatus: (callback: (event: AgentStatusEvent) => void) => () => void
  onSessionUpdate: (callback: (event: AgentSessionUpdateEvent) => void) => () => void
  // SDK-only events
  onPermissionRequest: (callback: (event: PermissionRequestEvent) => void) => () => void
  onFileChanged: (callback: (event: FileChangedEvent) => void) => () => void
  onTodoUpdate: (callback: (event: TodoUpdateEvent) => void) => () => void
}

interface SessionAPI {
  get: (agentId: string) => Promise<ApiResult<string | null>>
  clear: (agentId: string) => Promise<ApiResult>
}

interface WorkspaceSettingsAPI {
  get: (workspaceId: string) => Promise<ApiResult<WorkspaceSettings>>
  set: (workspaceId: string, settings: Partial<WorkspaceSettings>) => Promise<ApiResult<WorkspaceSettings>>
  has: (workspaceId: string) => Promise<ApiResult<boolean>>
}

interface CommandsAPI {
  discover: (workspaceId: string) => Promise<ApiResult<SlashCommand[]>>
  execute: (workspaceId: string, commandName: string, args: string) => Promise<ApiResult<string>>
}

// OpenAI settings for Deep Research
interface OpenAISettingsAPI {
  getApiKey: () => Promise<ApiResult<string | null>>
  setApiKey: (key: string) => Promise<ApiResult<{ valid: boolean }>>
  validateApiKey: (key: string) => Promise<ApiResult<boolean>>
  getResearchOutputDir: () => Promise<ApiResult<string>>
  setResearchOutputDir: (dir: string) => Promise<ApiResult>
}

// Research agent API (OpenAI Deep Research)
interface ResearchAPI {
  stop: (conversationId: string) => Promise<ApiResult>
  onDelta: (callback: (event: { conversationId: string; text: string }) => void) => () => void
  onSearch: (callback: (event: { conversationId: string; query: string }) => void) => () => void
  onComplete: (callback: (event: { conversationId: string; outputPath: string; text: string }) => void) => () => void
  onError: (callback: (event: { conversationId: string; error: string }) => void) => () => void
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
  workspaceSettings: WorkspaceSettingsAPI
  commands: CommandsAPI
  openai: OpenAISettingsAPI
  research: ResearchAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}

export type {
  AgentType,
  Agent,
  Workspace,
  Tab,
  OpenTabsState,
  TabGroup,
  SplitPaneSettings,
  ChorusSettings,
  EditorFontFamily,
  EditorFontSize,
  DirectoryEntry,
  GitChange,
  GitStatus,
  GitCommit,
  GitBranch,
  CloneProgress,
  CloneResult,
  // New git types for automated operations
  DiffHunk,
  FileDiff,
  AgentBranchInfo,
  GitBranchCreatedEvent,
  GitCommitCreatedEvent,
  ConversationsDeletedEvent,
  MergeAnalysis,
  ApiResult,
  ContentBlock,
  ConversationMessage,
  Conversation,
  AgentStreamDelta,
  AgentMessageEvent,
  AgentStatusEvent,
  AgentSessionUpdateEvent,
  // SDK permission types
  PermissionRequestEvent,
  PermissionResponse,
  FileChangedEvent,
  // Todo tracking types
  TodoItem,
  TodoUpdateEvent,
  FileChange,
  // Claude Code message types
  TextBlock,
  ToolUseBlock,
  ToolResultBlock,
  ThinkingBlock,
  ImageBlock,
  ClaudeContentBlock,
  ClaudeSystemMessage,
  ClaudeAssistantMessage,
  ClaudeUserMessage,
  ClaudeResultMessage,
  ClaudeCodeMessage,
  // Conversation settings types
  PermissionMode,
  ConversationSettings,
  WorkspaceSettings,
  GitSettings,
  // Slash command types
  SlashCommand,
  // Research types
  ResearchPhase,
  ResearchSource,
  // Create Workspace types (Sprint 17)
  GhCliStatus,
  CreateRepoResult
}
