// Agent types
export interface Agent {
  id: string
  name: string
  repoPath: string
  status: 'ready' | 'busy' | 'offline'
  hasUnread: boolean
}

// Message types
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// Conversation for an agent
export interface Conversation {
  agentId: string
  messages: Message[]
}
