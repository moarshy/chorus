import { useWorkspaceStore } from '../../stores/workspace-store'
import { useChatStore } from '../../stores/chat-store'
import type { Agent } from '../../types'

interface AgentItemProps {
  agent: Agent
}

// Sparkle icon for Chorus (general) agent
const SparkleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8zm10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.414a.5.5 0 1 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707zM4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708z"/>
    <circle cx="8" cy="8" r="3" />
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

export function AgentItem({ agent }: AgentItemProps) {
  const { selectedAgentId, selectAgent, selectConversation } = useWorkspaceStore()
  const { getAgentUnreadCount, getAgentStatus, loadConversations, createConversation } = useChatStore()
  const isSelected = selectedAgentId === agent.id
  const unreadCount = getAgentUnreadCount(agent.id)
  const agentStatus = getAgentStatus(agent.id)

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    selectAgent(agent.id, agent.workspaceId)

    // Load conversations for this agent
    await loadConversations(agent.workspaceId, agent.id)

    // Get conversations after loading (need to fetch fresh from API result)
    const result = await window.api.conversation.list(agent.workspaceId, agent.id)
    if (result.success && result.data) {
      const agentConversations = result.data
      if (agentConversations.length > 0) {
        // Open the most recent conversation as a tab
        const mostRecent = agentConversations[0]
        selectConversation(mostRecent.id, agent.id, agent.workspaceId, mostRecent.title)
      } else {
        // Create a new conversation if none exist
        const newConversationId = await createConversation(agent.workspaceId, agent.id)
        if (newConversationId) {
          selectConversation(newConversationId, agent.id, agent.workspaceId, 'New Conversation')
        }
      }
    }
  }

  const avatarColor = agent.isGeneral ? '#8b5cf6' : getAvatarColor(agent.name)  // Purple for Chorus
  const initials = getInitials(agent.name)

  return (
    <div
      className={`
        flex items-center gap-2.5 px-2 py-1.5 mx-2 rounded cursor-pointer
        ${isSelected ? 'bg-selected' : 'hover:bg-hover'}
      `}
      onClick={handleClick}
    >
      {/* Avatar */}
      <div
        className="relative flex-shrink-0 w-7 h-7 rounded flex items-center justify-center text-white text-xs font-semibold"
        style={{ backgroundColor: avatarColor }}
      >
        {agent.isGeneral ? <SparkleIcon /> : initials}
        {/* Status indicator - green=ready, yellow=busy, red=error */}
        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-sidebar ${
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
  )
}
