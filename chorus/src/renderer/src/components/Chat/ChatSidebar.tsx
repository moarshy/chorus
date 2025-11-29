import { useChatStore } from '../../stores/chat-store'
import { ConversationList } from './ConversationList'
import { ConversationDetails } from './ConversationDetails'

interface ChatSidebarProps {
  collapsed: boolean
  workspaceId: string
  agentId: string
  repoPath?: string
}

// SVG Icons
const ChevronLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
)

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const MessageSquareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
)

export function ChatSidebar({ collapsed, workspaceId, agentId, repoPath }: ChatSidebarProps) {
  const {
    chatSidebarTab,
    setChatSidebarTab,
    setChatSidebarCollapsed,
    createConversation,
    activeConversationId
  } = useChatStore()

  const handleNewConversation = async () => {
    await createConversation(workspaceId, agentId)
  }

  return (
    <div
      className="relative flex flex-col bg-sidebar border-r border-default transition-all duration-200 ease-in-out"
      style={{ width: collapsed ? 0 : 240, minWidth: collapsed ? 0 : 240 }}
    >
      {!collapsed && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-default">
            <button
              onClick={() => setChatSidebarTab('conversations')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                chatSidebarTab === 'conversations'
                  ? 'text-white border-b-2 border-accent'
                  : 'text-muted hover:text-secondary'
              }`}
            >
              <MessageSquareIcon />
              <span>Chats</span>
            </button>
            <button
              onClick={() => setChatSidebarTab('details')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                chatSidebarTab === 'details'
                  ? 'text-white border-b-2 border-accent'
                  : 'text-muted hover:text-secondary'
              }`}
            >
              <InfoIcon />
              <span>Details</span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {chatSidebarTab === 'conversations' ? (
              <ConversationList />
            ) : (
              <ConversationDetails
                conversationId={activeConversationId}
                repoPath={repoPath}
              />
            )}
          </div>

          {/* New Conversation Button */}
          {chatSidebarTab === 'conversations' && (
            <div className="p-3 border-t border-default">
              <button
                onClick={handleNewConversation}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-accent hover:opacity-90 text-white text-sm font-medium transition-colors"
              >
                <PlusIcon />
                <span>New Chat</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* Collapse Toggle */}
      <button
        onClick={() => setChatSidebarCollapsed(!collapsed)}
        className="absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 rounded-full bg-sidebar border border-default flex items-center justify-center text-muted hover:text-white transition-colors z-10"
        style={{ left: collapsed ? -12 : 228 }}
      >
        {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
      </button>
    </div>
  )
}
