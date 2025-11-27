import type { Agent } from '../../types'

interface ChatPlaceholderProps {
  agent: Agent
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
const MessageIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const FileCodeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3.75 1.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75zm5.75.56v2.19c0 .138.112.25.25.25h2.19L9.5 2.06zM2 1.75C2 .784 2.784 0 3.75 0h5.086c.464 0 .909.184 1.237.513l3.414 3.414c.329.328.513.773.513 1.237v8.086A1.75 1.75 0 0112.25 15h-8.5A1.75 1.75 0 012 13.25V1.75zM6.22 7.22a.75.75 0 011.06 0L8.5 8.44l1.22-1.22a.75.75 0 111.06 1.06l-1.75 1.75a.75.75 0 01-1.06 0l-1.75-1.75a.75.75 0 010-1.06zM5 11.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75z" />
  </svg>
)

const SparklesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
  </svg>
)

export function ChatPlaceholder({ agent }: ChatPlaceholderProps) {
  const avatarColor = getAvatarColor(agent.name)
  const initials = getInitials(agent.name)

  return (
    <div className="flex items-center justify-center h-full bg-main">
      <div className="text-center max-w-md px-8">
        {/* Agent Avatar */}
        <div className="flex justify-center mb-4">
          <div
            className="relative w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg"
            style={{ backgroundColor: avatarColor }}
          >
            {initials}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-3 border-main" />
          </div>
        </div>

        {/* Agent Name */}
        <h2 className="text-2xl font-bold mb-1">{agent.name}</h2>
        <p className="text-secondary mb-6">AI Agent</p>

        {/* Coming soon card */}
        <div className="bg-input border border-default rounded-xl p-5 mb-6">
          <div className="flex items-center justify-center gap-2 text-accent mb-3">
            <SparklesIcon />
            <span className="font-semibold">Chat Coming Soon</span>
          </div>
          <p className="text-sm text-muted">
            Agent chat functionality will be available in Feature 1.
            You'll be able to have conversations with this agent right here.
          </p>
        </div>

        {/* Agent file info */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-hover text-sm">
          <span className="text-muted">
            <FileCodeIcon />
          </span>
          <span className="font-mono text-accent">
            {agent.filePath.split('/').slice(-3).join('/')}
          </span>
        </div>

        {/* Placeholder for future chat input */}
        <div className="mt-8 opacity-50">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-input border border-default">
            <span className="text-muted">
              <MessageIcon />
            </span>
            <span className="text-muted text-sm">Message {agent.name}...</span>
          </div>
        </div>
      </div>
    </div>
  )
}
