// Re-export types from preload for convenience
export type {
  Agent,
  Workspace,
  ChorusSettings,
  DirectoryEntry,
  GitChange,
  GitStatus,
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
  ClaudeCodeMessage
} from '../../../preload/index.d'

// UI-specific types
export type SidebarTab = 'workspaces' | 'files'

export type MainPaneView = 'welcome' | 'workspace' | 'file' | 'agent'

export type ChatSidebarTab = 'conversations' | 'details'

export type AgentStatus = 'ready' | 'busy' | 'error'

export interface FileTreeNode {
  id: string
  name: string
  path: string
  isDirectory: boolean
  children?: FileTreeNode[]
}
