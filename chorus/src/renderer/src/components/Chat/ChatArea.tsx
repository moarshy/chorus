import type { Agent, Workspace } from '../../types'
import { useChatStore } from '../../stores/chat-store'
import { ChatHeader } from './ChatHeader'
import { ConversationToolbar } from './ConversationToolbar'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'

interface ChatAreaProps {
  agent: Agent
  workspace: Workspace
}

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

// Warning Icon
const WarningIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

export function ChatArea({ agent, workspace }: ChatAreaProps) {
  const { error, setError, claudePath, isClaudeChecked, activeConversationId, messages } = useChatStore()

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <ChatHeader agent={agent} workspace={workspace} />
      {activeConversationId && (
        <ConversationToolbar conversationId={activeConversationId} messages={messages} />
      )}

      {/* Claude CLI Not Installed Warning */}
      {isClaudeChecked && !claudePath && (
        <div className="mx-4 mt-2 px-4 py-3 bg-yellow-900/30 border border-yellow-500/50 rounded-lg flex items-start gap-3">
          <div className="text-yellow-400 shrink-0 mt-0.5">
            <WarningIcon />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-yellow-200">Claude Code not found</div>
            <div className="text-xs text-yellow-300/80 mt-1">
              Install Claude Code to chat with agents.{' '}
              <a
                href="https://docs.anthropic.com/en/docs/claude-code"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-yellow-200"
              >
                Installation guide
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mx-4 mt-2 px-4 py-3 bg-red-900/30 border border-red-500/50 rounded-lg flex items-center gap-3">
          <div className="text-red-400 shrink-0">
            <AlertIcon />
          </div>
          <div className="flex-1 text-sm text-red-200">
            {error}
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300 shrink-0"
          >
            <CloseIcon />
          </button>
        </div>
      )}

      <MessageList />
      <MessageInput agent={agent} workspace={workspace} />
    </div>
  )
}
