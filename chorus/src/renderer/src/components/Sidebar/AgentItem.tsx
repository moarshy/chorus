import { useEffect, useState } from 'react'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useChatStore } from '../../stores/chat-store'
import type { Agent, Conversation } from '../../types'

interface AgentItemProps {
  agent: Agent
}

// SVG Icons
const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    className={`transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
  >
    <path
      d="M4.5 2.5L8 6L4.5 9.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

// Sparkle icon for Chorus (general) agent
const SparkleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8zm10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.414a.5.5 0 1 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707zM4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708z"/>
    <circle cx="8" cy="8" r="3" />
  </svg>
)

// Search/Research icon for Deep Research agent
const ResearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="6" />
    <path d="m21 21-4.35-4.35" />
    <path d="M11 8v6" />
    <path d="M8 11h6" />
  </svg>
)

const MessageIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
)

// Generate a consistent color based on agent name
function getAvatarColor(name: string): string {
  const colors = [
    '#e91e63', // pink
    '#9c27b0', // purple
    '#673ab7', // deep purple
    '#3f51b5', // indigo
    '#2196f3', // blue
    '#00bcd4', // cyan
    '#009688', // teal
    '#4caf50', // green
    '#ff9800', // orange
    '#ff5722'  // deep orange
  ]

  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }

  return colors[Math.abs(hash) % colors.length]
}

// Get initials from agent name
function getInitials(name: string): string {
  const words = name.split(/[-_\s]+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

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

// Inline conversation item
function InlineConversationItem({
  conversation,
  isActive,
  onClick,
  onDelete
}: {
  conversation: Conversation
  isActive: boolean
  onClick: () => void
  onDelete: () => void
}) {
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
        className={`w-full px-2 py-1.5 text-left transition-colors flex items-center gap-2 rounded ${
          isActive ? 'bg-selected text-white' : 'hover:bg-hover text-secondary'
        }`}
      >
        <MessageIcon />
        <div className="flex-1 min-w-0">
          <p className="text-xs truncate">{conversation.title}</p>
          <p className="text-[10px] text-muted">{formatDate(conversation.updatedAt)}</p>
        </div>
        {unreadCount > 0 && !isActive && (
          <span className="px-1 py-0.5 text-[9px] font-medium bg-accent text-white rounded-full min-w-[14px] text-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Delete button on hover */}
      {isHovered && (
        <button
          onClick={handleDeleteClick}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-red-400 transition-colors rounded hover:bg-red-500/10"
          title="Delete conversation"
        >
          <TrashIcon />
        </button>
      )}
    </div>
  )
}

export function AgentItem({ agent }: AgentItemProps) {
  const { selectedAgentId, selectedConversationId, selectAgent, selectConversation, closeTab, tabs } = useWorkspaceStore()
  const {
    getAgentUnreadCount,
    getAgentStatus,
    loadConversations,
    createConversation,
    deleteConversation,
    conversations: allConversations,
    conversationRefreshKey
  } = useChatStore()

  const [isExpanded, setIsExpanded] = useState(false)
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Conversation | null>(null)

  const isSelected = selectedAgentId === agent.id
  const unreadCount = getAgentUnreadCount(agent.id)
  const agentStatus = getAgentStatus(agent.id)

  // Filter conversations for this agent
  const agentConversations = allConversations.filter(c => c.agentId === agent.id)

  // Load conversations when expanded
  useEffect(() => {
    if (isExpanded) {
      setIsLoadingConversations(true)
      loadConversations(agent.workspaceId, agent.id).finally(() => {
        setIsLoadingConversations(false)
      })
    }
  }, [isExpanded, agent.workspaceId, agent.id, loadConversations, conversationRefreshKey])

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  const handleClick = () => {
    // Toggle expansion and select agent
    setIsExpanded(!isExpanded)
    selectAgent(agent.id, agent.workspaceId)
  }

  const handleSelectConversation = (conversation: Conversation) => {
    selectConversation(conversation.id, agent.id, agent.workspaceId, conversation.title)
  }

  const handleCreateConversation = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const conversationId = await createConversation(agent.workspaceId, agent.id)
    if (conversationId) {
      selectConversation(conversationId, agent.id, agent.workspaceId, 'New conversation')
    }
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

    // Get workspace path for branch deletion
    const workspace = useWorkspaceStore.getState().workspaces.find(w => w.id === agent.workspaceId)

    // Delete the conversation (and its associated branch if any)
    await deleteConversation(deleteConfirm.id, workspace?.path)
    setDeleteConfirm(null)
  }

  const handleCancelDelete = () => {
    setDeleteConfirm(null)
  }

  // Determine avatar color based on agent type
  const getAgentAvatarColor = (): string => {
    if (agent.type === 'openai-research') {
      return '#10b981'  // Green for OpenAI/Research
    }
    if (agent.isGeneral) {
      return '#8b5cf6'  // Purple for Chorus
    }
    return getAvatarColor(agent.name)  // Hash-based for custom agents
  }

  const avatarColor = getAgentAvatarColor()
  const initials = getInitials(agent.name)

  // Get the appropriate icon for the agent type
  const getAgentIcon = () => {
    if (agent.type === 'openai-research') {
      return <ResearchIcon />
    }
    if (agent.isGeneral) {
      return <SparkleIcon />
    }
    return initials
  }

  return (
    <div className="relative">
      {/* Agent header */}
      <div
        className={`
          flex items-center gap-2 px-2 py-1.5 mx-2 rounded cursor-pointer
          ${isSelected ? 'bg-selected' : 'hover:bg-hover'}
        `}
        onClick={handleClick}
        title={agent.description || agent.name}
      >
        {/* Expand/collapse chevron */}
        <button
          onClick={handleToggleExpand}
          className="flex-shrink-0 p-0.5 text-muted hover:text-secondary transition-colors"
        >
          <ChevronIcon expanded={isExpanded} />
        </button>

        {/* Avatar */}
        <div
          className="relative flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-white text-xs font-semibold"
          style={{ backgroundColor: avatarColor }}
        >
          {getAgentIcon()}
          {/* Status indicator - green=ready, yellow=busy, red=error */}
          <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-sidebar ${
            agentStatus === 'busy' ? 'bg-yellow-500 animate-pulse' :
            agentStatus === 'error' ? 'bg-red-500' :
            'bg-green-500'
          }`} />
        </div>

        {/* Name */}
        <span className="truncate text-sm flex-1">{agent.name}</span>

        {/* Status badge - Busy or Error */}
        {agentStatus === 'busy' && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-yellow-500/20 text-yellow-400 rounded shrink-0">
            Busy
          </span>
        )}
        {agentStatus === 'error' && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-500/20 text-red-400 rounded shrink-0">
            Error
          </span>
        )}

        {/* Unread badge */}
        {unreadCount > 0 && agentStatus === 'ready' && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-accent text-white rounded-full min-w-[18px] text-center shrink-0">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </div>

      {/* Expanded conversations list */}
      {isExpanded && (
        <div className="mt-1 ml-6 mr-2">
          {/* New conversation button */}
          <button
            onClick={handleCreateConversation}
            className="w-full px-2 py-1 text-xs text-muted hover:text-secondary hover:bg-hover rounded flex items-center gap-1.5 transition-colors mb-1"
          >
            <PlusIcon />
            New conversation
          </button>

          {/* Conversations list */}
          {isLoadingConversations ? (
            <div className="px-2 py-2 text-xs text-muted">
              Loading...
            </div>
          ) : agentConversations.length === 0 ? (
            <div className="px-2 py-2 text-xs text-muted">
              No conversations yet
            </div>
          ) : (
            <div className="space-y-0.5">
              {agentConversations.map((conv) => (
                <InlineConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === selectedConversationId}
                  onClick={() => handleSelectConversation(conv)}
                  onDelete={() => handleDeleteClick(conv)}
                />
              ))}
            </div>
          )}
        </div>
      )}

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
