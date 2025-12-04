// Re-export types from preload for convenience
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
  DetailedGitStatus,
  GitCommit,
  GitBranch,
  CloneProgress,
  CloneResult,
  ApiResult,
  ContentBlock,
  ConversationMessage,
  Conversation,
  AgentStreamDelta,
  AgentMessageEvent,
  AgentStatusEvent,
  AgentSessionUpdateEvent,
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
  // SDK permission types
  PermissionRequestEvent,
  PermissionResponse,
  FileChangedEvent,
  // Todo tracking types
  TodoItem,
  TodoUpdateEvent,
  FileChange,
  // Slash command types
  SlashCommand,
  // Git automation types
  GitSettings,
  AgentBranchInfo,
  GitBranchCreatedEvent,
  GitCommitCreatedEvent,
  DiffHunk,
  FileDiff,
  MergeAnalysis,
  // Research types
  ResearchPhase,
  ResearchSource
} from '../../../preload/index.d'

// UI-specific types
export type RightPanelTab = 'files' | 'details'

export type MainPaneView = 'welcome' | 'workspace' | 'file'

export type AgentStatus = 'ready' | 'busy' | 'error'

export interface FileTreeNode {
  id: string
  name: string
  path: string
  isDirectory: boolean
  children?: FileTreeNode[]
}
