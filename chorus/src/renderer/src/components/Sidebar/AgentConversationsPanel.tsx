import { useEffect, useState } from 'react'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useChatStore } from '../../stores/chat-store'
import { AgentHeader } from './AgentHeader'
import type { Conversation } from '../../types'

// SVG Icons
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const MessageIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
)

// Format date for display
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

interface ConversationItemProps {
  conversation: Conversation
  isActive: boolean
  onClick: () => void
  onDelete: () => void
}

function ConversationItem({ conversation, isActive, onClick, onDelete }: ConversationItemProps) {
  const { getUnreadCount } = useChatStore()
  const [isHovered, setIsHovered] = useState(false)
  const unreadCount = getUnreadCount(conversation.id)

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete()
  }

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={onClick}
        className={`w-full px-3 py-2.5 pr-8 text-left transition-colors flex items-center gap-2 ${
          isActive ? 'bg-selected text-white' : 'hover:bg-hover text-secondary'
        }`}
      >
        <MessageIcon />
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">{conversation.title}</p>
          <p className="text-xs text-muted">{formatDate(conversation.updatedAt)}</p>
        </div>
        {unreadCount > 0 && !isActive && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-accent text-white rounded-full min-w-[18px] text-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Delete button on hover */}
      {isHovered && (
        <button
          onClick={handleDeleteClick}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-red-400 transition-colors rounded hover:bg-red-500/10"
          title="Delete conversation"
        >
          <TrashIcon />
        </button>
      )}
    </div>
  )
}

export function AgentConversationsPanel() {
  const { selectedAgentId, selectedWorkspaceId, selectedConversationId, workspaces, selectAgent, selectConversation, closeTab, tabs } = useWorkspaceStore()
  const {
    loadConversations,
    createConversation,
    deleteConversation,
    conversations,
    isLoading,
    conversationRefreshKey
  } = useChatStore()

  const [deleteConfirm, setDeleteConfirm] = useState<Conversation | null>(null)

  const workspace = workspaces.find((ws) => ws.id === selectedWorkspaceId)
  const agent = workspace?.agents.find((a) => a.id === selectedAgentId)

  // Load conversations when agent changes or refresh is triggered
  useEffect(() => {
    if (workspace && agent) {
      loadConversations(workspace.id, agent.id)
    }
  }, [workspace?.id, agent?.id, loadConversations, conversationRefreshKey])

  if (!agent || !workspace) {
    return null
  }

  const handleCreateConversation = async () => {
    const conversationId = await createConversation(workspace.id, agent.id)
    if (conversationId) {
      // Open the new conversation as a tab
      selectConversation(conversationId, agent.id, workspace.id, 'New conversation')
    }
  }

  const handleSelectConversation = (conversation: Conversation) => {
    selectConversation(conversation.id, agent.id, workspace.id, conversation.title)
  }

  const handleDeleteClick = (conversation: Conversation) => {
    setDeleteConfirm(conversation)
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return

    // Close any open tabs for this conversation
    const tabToClose = tabs.find(t => t.type === 'chat' && t.conversationId === deleteConfirm.id)
    if (tabToClose) {
      closeTab(tabToClose.id)
    }

    // Delete the conversation (and its associated branch if any)
    await deleteConversation(deleteConfirm.id, workspace?.path)
    setDeleteConfirm(null)
  }

  const handleCancelDelete = () => {
    setDeleteConfirm(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with back button */}
      <AgentHeader agent={agent} workspace={workspace} onBack={() => selectAgent(null)} />

      {/* New conversation button */}
      <div className="px-3 py-2 border-b border-default">
        <button
          onClick={handleCreateConversation}
          className="w-full px-3 py-2 text-sm bg-accent hover:bg-accent/80 text-white rounded flex items-center justify-center gap-2 transition-colors"
        >
          <PlusIcon />
          New conversation
        </button>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="px-3 py-4 text-center text-sm text-muted">
            Loading conversations...
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-muted">
            No conversations yet.<br />
            Click "New conversation" to start.
          </div>
        ) : (
          conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === selectedConversationId}
              onClick={() => handleSelectConversation(conv)}
              onDelete={() => handleDeleteClick(conv)}
            />
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/50"
            onClick={handleCancelDelete}
          />
          {/* Dialog */}
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-sidebar border border-default rounded-lg shadow-xl p-4 min-w-[300px]">
            <h3 className="text-white font-medium mb-2">Delete conversation?</h3>
            <p className="text-muted text-sm mb-1 truncate">"{deleteConfirm.title}"</p>
            <p className="text-muted text-sm mb-4">This will permanently delete all messages. This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancelDelete}
                className="px-3 py-1.5 text-sm text-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
