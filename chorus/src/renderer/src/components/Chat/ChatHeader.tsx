import type { Agent, Workspace } from '../../types'
import { useChatStore } from '../../stores/chat-store'

interface ChatHeaderProps {
  agent: Agent
  workspace: Workspace
}

// Generate a consistent color based on agent name
function getAvatarColor(name: string): string {
  const colors = [
    '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
    '#00bcd4', '#009688', '#4caf50', '#ff9800', '#ff5722'
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

// SVG Icons
const StopIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
  </svg>
)

export function ChatHeader({ agent, workspace }: ChatHeaderProps) {
  const { agentStatus, isStreaming, stopAgent } = useChatStore()
  const avatarColor = getAvatarColor(agent.name)
  const initials = getInitials(agent.name)

  const handleStop = () => {
    stopAgent(agent.id)
  }

  // Truncate workspace path
  const truncatedPath = workspace.path.length > 40
    ? '...' + workspace.path.slice(-37)
    : workspace.path

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-default bg-sidebar">
      <div className="flex items-center gap-3">
        {/* Agent Avatar */}
        <div
          className="relative w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold"
          style={{ backgroundColor: avatarColor }}
        >
          {initials}
          {/* Status indicator */}
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-sidebar ${
              agentStatus === 'ready' ? 'bg-green-500' :
              agentStatus === 'busy' ? 'bg-yellow-500 animate-pulse' :
              'bg-red-500'
            }`}
          />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{agent.name}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                agentStatus === 'ready' ? 'bg-green-500/20 text-green-400' :
                agentStatus === 'busy' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}
            >
              {agentStatus === 'ready' ? 'Ready' :
               agentStatus === 'busy' ? 'Thinking...' :
               'Error'}
            </span>
          </div>
          <div className="text-xs text-muted truncate" title={workspace.path}>
            {truncatedPath}
          </div>
        </div>
      </div>

      {/* Stop button - only visible when busy */}
      {isStreaming && (
        <button
          onClick={handleStop}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm"
        >
          <StopIcon />
          <span>Stop</span>
        </button>
      )}
    </div>
  )
}
