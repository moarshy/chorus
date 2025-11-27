import Store from 'electron-store'

// Types for stored data
export interface StoredAgent {
  id: string
  name: string
  repoPath: string
  createdAt: string
}

export interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface StoreSchema {
  agents: StoredAgent[]
  messages: Record<string, StoredMessage[]> // agentId -> messages
  sessionIds: Record<string, string> // agentId -> sessionId
}

// Create typed store
const store = new Store<StoreSchema>({
  name: 'chorus-data',
  defaults: {
    agents: [],
    messages: {},
    sessionIds: {}
  }
})

// ============================================
// AGENT OPERATIONS
// ============================================

export function getAgents(): StoredAgent[] {
  return store.get('agents', [])
}

export function addAgent(agent: StoredAgent): void {
  const agents = getAgents()
  agents.push(agent)
  store.set('agents', agents)
}

export function removeAgent(agentId: string): void {
  const agents = getAgents().filter((a) => a.id !== agentId)
  store.set('agents', agents)
  // Also remove messages and session
  const messages = store.get('messages', {})
  delete messages[agentId]
  store.set('messages', messages)
  const sessions = store.get('sessionIds', {})
  delete sessions[agentId]
  store.set('sessionIds', sessions)
}

export function updateAgent(agentId: string, updates: Partial<StoredAgent>): void {
  const agents = getAgents().map((a) => (a.id === agentId ? { ...a, ...updates } : a))
  store.set('agents', agents)
}

// ============================================
// MESSAGE OPERATIONS
// ============================================

export function getMessages(agentId: string): StoredMessage[] {
  const messages = store.get('messages', {})
  return messages[agentId] || []
}

export function addMessage(agentId: string, message: StoredMessage): void {
  const messages = store.get('messages', {})
  if (!messages[agentId]) {
    messages[agentId] = []
  }
  messages[agentId].push(message)
  store.set('messages', messages)
}

export function clearMessages(agentId: string): void {
  const messages = store.get('messages', {})
  messages[agentId] = []
  store.set('messages', messages)
}

// ============================================
// SESSION OPERATIONS
// ============================================

export function getSessionId(agentId: string): string | undefined {
  const sessions = store.get('sessionIds', {})
  return sessions[agentId]
}

export function setSessionId(agentId: string, sessionId: string): void {
  const sessions = store.get('sessionIds', {})
  sessions[agentId] = sessionId
  store.set('sessionIds', sessions)
}

export function clearSessionId(agentId: string): void {
  const sessions = store.get('sessionIds', {})
  delete sessions[agentId]
  store.set('sessionIds', sessions)
}

// ============================================
// UTILITY
// ============================================

export function clearAllData(): void {
  store.clear()
}

export function getStorePath(): string {
  return store.path
}
