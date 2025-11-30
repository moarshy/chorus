import { useEffect, useCallback } from 'react'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useChatStore } from '../../stores/chat-store'
import { MessageList } from '../Chat/MessageList'
import { MessageInput } from '../Chat/MessageInput'
import { ConversationToolbar } from '../Chat/ConversationToolbar'

// Warning Icon
const WarningIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

// Error Icon
const AlertIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)

// Close Icon
const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

interface ChatTabProps {
  conversationId: string
  agentId: string
  workspaceId: string
}

export function ChatTab({ conversationId, agentId, workspaceId }: ChatTabProps) {
  const { workspaces } = useWorkspaceStore()
  const {
    selectConversation,
    isStreaming,
    streamingConversationId,
    activeConversationId,
    stopAgent,
    error,
    setError,
    claudePath,
    isClaudeChecked,
    messages
  } = useChatStore()

  const workspace = workspaces.find((ws) => ws.id === workspaceId)
  const agent = workspace?.agents.find((a) => a.id === agentId)

  // Only respond to escape if THIS conversation is streaming
  const isThisConversationStreaming = isStreaming && streamingConversationId === activeConversationId

  // Load conversation when tab is mounted or conversationId changes
  useEffect(() => {
    if (conversationId) {
      // Always load the conversation when conversationId changes
      // This ensures messages are loaded even if activeConversationId was stale
      selectConversation(conversationId)
    }
  }, [conversationId, selectConversation])

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Escape: Stop streaming (only if this conversation is streaming)
      if (e.key === 'Escape' && isThisConversationStreaming && agent) {
        stopAgent(agent.id)
      }
    },
    [agent, isThisConversationStreaming, stopAgent]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!agent || !workspace) {
    return (
      <div className="flex items-center justify-center h-full text-muted">
        <p>Agent or workspace not found</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-main">
      {/* Settings toolbar */}
      <ConversationToolbar conversationId={conversationId} messages={messages} />

      {/* Claude CLI Not Installed Warning */}
      {isClaudeChecked && !claudePath && (
        <div className="mx-4 mt-2 px-3 py-2 bg-yellow-900/30 border border-yellow-500/50 rounded-lg flex items-start gap-2">
          <div className="text-yellow-400 shrink-0 mt-0.5">
            <WarningIcon />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-yellow-200">Claude Code not found</div>
            <div className="text-xs text-yellow-300/80 mt-0.5">
              <a
                href="https://docs.anthropic.com/en/docs/claude-code"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-yellow-200"
              >
                Install guide
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mx-4 mt-2 px-3 py-2 bg-red-900/30 border border-red-500/50 rounded-lg flex items-center gap-2">
          <div className="text-red-400 shrink-0">
            <AlertIcon />
          </div>
          <div className="flex-1 text-xs text-red-200 truncate">{error}</div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300 shrink-0"
          >
            <CloseIcon />
          </button>
        </div>
      )}

      {/* Message list - takes remaining space */}
      <div className="flex-1 min-h-0">
        <MessageList />
      </div>

      {/* Message input - fixed at bottom */}
      <MessageInput agent={agent} workspace={workspace} />
    </div>
  )
}
