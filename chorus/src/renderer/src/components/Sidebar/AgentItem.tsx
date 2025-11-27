import { useWorkspaceStore } from '../../stores/workspace-store'
import type { Agent } from '../../types'

interface AgentItemProps {
  agent: Agent
}

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
  const { selectedAgentId, selectAgent } = useWorkspaceStore()
  const isSelected = selectedAgentId === agent.id

  const handleClick = () => {
    selectAgent(agent.id)
  }

  const avatarColor = getAvatarColor(agent.name)
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
        {initials}
        {/* Online status indicator */}
        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-sidebar" />
      </div>

      {/* Name */}
      <span className="truncate text-sm">{agent.name}</span>
    </div>
  )
}
