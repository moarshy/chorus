import { create } from 'zustand'
import type {
  Conversation,
  ConversationMessage,
  ChatSidebarTab,
  AgentStatus,
  ConversationSettings,
  PermissionRequestEvent,
  TodoItem,
  FileChange
} from '../types'

interface ChatStore {
  // State
  activeConversationId: string | null
  conversations: Conversation[]
  messages: ConversationMessage[]
  isLoading: boolean
  isStreaming: boolean
  streamingConversationId: string | null  // Which conversation is currently streaming
  streamingContent: string
  agentStatus: AgentStatus
  agentStatuses: Map<string, AgentStatus>  // Per-agent status tracking
  chatSidebarCollapsed: boolean
  chatSidebarTab: ChatSidebarTab
  error: string | null
  claudePath: string | null
  isClaudeChecked: boolean
  // Unread tracking
  unreadCounts: Map<string, number>       // conversationId → count
  unreadByAgent: Map<string, number>      // agentId → total count
  // Permission request (SDK mode)
  pendingPermissionRequest: PermissionRequestEvent | null
  // Details panel state - per conversation
  conversationTodos: Map<string, TodoItem[]>
  conversationFiles: Map<string, FileChange[]>

  // Actions
  loadConversations: (workspaceId: string, agentId: string) => Promise<void>
  selectConversation: (conversationId: string | null) => Promise<void>
  createConversation: (workspaceId: string, agentId: string) => Promise<string | null>
  deleteConversation: (conversationId: string) => Promise<void>
  sendMessage: (content: string, workspaceId: string, agentId: string, repoPath: string, agentFilePath?: string) => Promise<void>
  appendStreamDelta: (delta: string) => void
  appendMessage: (message: ConversationMessage) => void
  setAgentStatus: (status: AgentStatus) => void
  stopAgent: (agentId: string) => Promise<void>
  setChatSidebarCollapsed: (collapsed: boolean) => void
  setChatSidebarTab: (tab: ChatSidebarTab) => void
  initEventListeners: () => () => void
  clearChat: () => void
  setError: (error: string | null) => void
  checkClaudeAvailable: () => Promise<void>
  // Unread actions
  incrementUnread: (conversationId: string, agentId: string) => void
  clearUnread: (conversationId: string) => void
  getUnreadCount: (conversationId: string) => number
  getAgentUnreadCount: (agentId: string) => number
  // Agent status helper
  getAgentStatus: (agentId: string) => AgentStatus
  // Conversation settings
  updateConversationSettings: (conversationId: string, settings: Partial<ConversationSettings>) => Promise<void>
  getActiveConversationSettings: () => ConversationSettings | undefined
  // Permission handling (SDK mode)
  respondToPermission: (approved: boolean, reason?: string) => Promise<void>
  // Details panel actions
  updateTodos: (conversationId: string, todos: TodoItem[]) => void
  addFileChange: (conversationId: string, change: FileChange) => void
  getTodos: (conversationId: string) => TodoItem[]
  getFileChanges: (conversationId: string) => FileChange[]
}

export const useChatStore = create<ChatStore>((set, get) => ({
  // Initial state
  activeConversationId: null,
  conversations: [],
  messages: [],
  isLoading: false,
  isStreaming: false,
  streamingConversationId: null,
  streamingContent: '',
  agentStatus: 'ready',
  agentStatuses: new Map<string, AgentStatus>(),
  chatSidebarCollapsed: false,
  chatSidebarTab: 'conversations',
  error: null,
  claudePath: null,
  isClaudeChecked: false,
  // Unread tracking
  unreadCounts: new Map<string, number>(),
  unreadByAgent: new Map<string, number>(),
  // Permission request (SDK mode)
  pendingPermissionRequest: null,
  // Details panel state
  conversationTodos: new Map<string, TodoItem[]>(),
  conversationFiles: new Map<string, FileChange[]>(),

  // Load conversations for a workspace/agent
  loadConversations: async (workspaceId: string, agentId: string) => {
    // Clear existing state when switching agents
    set({
      isLoading: true,
      error: null,
      activeConversationId: null,
      messages: [],
      streamingContent: ''
    })
    try {
      const result = await window.api.conversation.list(workspaceId, agentId)
      if (result.success && result.data) {
        const conversations = result.data
        set({ conversations, isLoading: false })

        // Auto-select most recent conversation if any
        if (conversations.length > 0 && !get().activeConversationId) {
          await get().selectConversation(conversations[0].id)
        }
      } else {
        set({ conversations: [], isLoading: false, error: result.error })
      }
    } catch (error) {
      set({ conversations: [], isLoading: false, error: String(error) })
    }
  },

  // Select a conversation and load its messages
  selectConversation: async (conversationId: string | null) => {
    if (!conversationId) {
      set({ activeConversationId: null, messages: [], streamingContent: '' })
      return
    }

    set({ isLoading: true, error: null })
    try {
      const result = await window.api.conversation.load(conversationId)
      if (result.success && result.data) {
        // Sync sessionId and sessionCreatedAt from backend to local state
        // This ensures session resumption works even if the renderer was restarted
        const loadedConv = result.data.conversation
        const { conversations } = get()
        const updatedConversations = loadedConv
          ? conversations.map(conv =>
              conv.id === conversationId
                ? {
                    ...conv,
                    sessionId: loadedConv.sessionId,
                    sessionCreatedAt: loadedConv.sessionCreatedAt
                  }
                : conv
            )
          : conversations

        const loadedMessages = result.data.messages || []

        // Reconstruct todos from TodoWrite messages
        const todoMessages = loadedMessages.filter(m => m.toolName === 'TodoWrite')
        const lastTodoMsg = todoMessages[todoMessages.length - 1]
        const todosFromMsg = lastTodoMsg?.toolInput?.todos as TodoItem[] | undefined
        const reconstructedTodos: TodoItem[] = todosFromMsg || []

        // Reconstruct file changes from system messages with Write/Edit toolName
        const fileMessages = loadedMessages.filter(m =>
          m.type === 'system' && (m.toolName === 'Write' || m.toolName === 'Edit')
        )
        // Deduplicate by path (keep latest)
        const fileMap = new Map<string, FileChange>()
        fileMessages.forEach(m => {
          const filePath = m.toolInput?.file_path as string | undefined
          if (filePath) {
            fileMap.set(filePath, {
              path: filePath,
              toolName: m.toolName as 'Write' | 'Edit',
              timestamp: m.timestamp
            })
          }
        })
        const reconstructedFiles = Array.from(fileMap.values())

        // Update state with reconstructed data
        const { conversationTodos, conversationFiles } = get()
        const newTodos = new Map(conversationTodos)
        const newFiles = new Map(conversationFiles)
        if (reconstructedTodos.length > 0) {
          newTodos.set(conversationId, reconstructedTodos)
        }
        if (reconstructedFiles.length > 0) {
          newFiles.set(conversationId, reconstructedFiles)
        }

        set({
          activeConversationId: conversationId,
          messages: loadedMessages,
          conversations: updatedConversations,
          conversationTodos: newTodos,
          conversationFiles: newFiles,
          isLoading: false,
          streamingContent: ''
        })
        // Clear unread count when selecting a conversation
        get().clearUnread(conversationId)
      } else {
        set({ isLoading: false, error: result.error })
      }
    } catch (error) {
      set({ isLoading: false, error: String(error) })
    }
  },

  // Create a new conversation
  createConversation: async (workspaceId: string, agentId: string) => {
    try {
      const result = await window.api.conversation.create(workspaceId, agentId)
      if (result.success && result.data) {
        const { conversations } = get()
        set({
          conversations: [result.data, ...conversations],
          activeConversationId: result.data.id,
          messages: [],
          streamingContent: ''
        })
        return result.data.id
      }
      return null
    } catch (error) {
      set({ error: String(error) })
      return null
    }
  },

  // Delete a conversation
  deleteConversation: async (conversationId: string) => {
    try {
      const result = await window.api.conversation.delete(conversationId)
      if (result.success) {
        const { conversations, activeConversationId } = get()
        const newConversations = conversations.filter(c => c.id !== conversationId)
        const newActiveId = activeConversationId === conversationId
          ? (newConversations[0]?.id || null)
          : activeConversationId

        set({ conversations: newConversations })

        if (newActiveId !== activeConversationId) {
          await get().selectConversation(newActiveId)
        }
      }
    } catch (error) {
      set({ error: String(error) })
    }
  },

  // Send a message to the agent
  sendMessage: async (content: string, workspaceId: string, agentId: string, repoPath: string, agentFilePath?: string) => {
    let conversationId = get().activeConversationId

    // Create conversation if none active
    if (!conversationId) {
      // Settings are fetched by workspaceId on the backend
      conversationId = await get().createConversation(workspaceId, agentId)
      if (!conversationId) {
        set({ error: 'Failed to create conversation' })
        return
      }
    }

    // Set streaming state - track which conversation is streaming
    set({ isStreaming: true, streamingConversationId: conversationId, streamingContent: '', error: null })

    try {
      // Get session ID from the active conversation
      const conversation = get().conversations.find(c => c.id === conversationId)
      const sessionId = conversation?.sessionId || undefined

      // Send message - response comes via events
      // Pass agentFilePath to load the agent's system prompt
      await window.api.agent.send(conversationId, content, repoPath, sessionId, agentFilePath)
    } catch (error) {
      set({ isStreaming: false, error: String(error) })
    }
  },

  // Append streaming delta
  appendStreamDelta: (delta: string) => {
    set(state => ({ streamingContent: state.streamingContent + delta }))
  },

  // Append a complete message
  appendMessage: (message: ConversationMessage) => {
    const { messages, conversations, activeConversationId } = get()

    // Update messages
    set({ messages: [...messages, message] })

    // If this is an assistant message, clear streaming content
    if (message.type === 'assistant') {
      set({ streamingContent: '' })
    }

    // Update conversation in list if title changed or message count increased
    if (activeConversationId) {
      const updatedConversations = conversations.map(conv => {
        if (conv.id === activeConversationId) {
          return {
            ...conv,
            messageCount: conv.messageCount + 1,
            updatedAt: new Date().toISOString()
          }
        }
        return conv
      })
      set({ conversations: updatedConversations })
    }
  },

  // Set agent status
  setAgentStatus: (status: AgentStatus) => {
    set({ agentStatus: status })
    if (status === 'ready' || status === 'error') {
      set({ isStreaming: false })
    }
  },

  // Stop the agent
  stopAgent: async (agentId: string) => {
    try {
      await window.api.agent.stop(agentId)
      const { agentStatuses, streamingConversationId, conversations } = get()

      // Update per-agent status
      const newStatuses = new Map(agentStatuses)
      newStatuses.set(agentId, 'ready')

      // Clear streaming if this agent was streaming
      const streamingConv = conversations.find(c => c.id === streamingConversationId)
      if (streamingConv?.agentId === agentId) {
        set({ isStreaming: false, streamingConversationId: null, agentStatus: 'ready', agentStatuses: newStatuses })
      } else {
        set({ agentStatuses: newStatuses })
      }
    } catch {
      // Silently fail - agent may already be stopped
    }
  },

  // Toggle chat sidebar
  setChatSidebarCollapsed: (collapsed: boolean) => {
    set({ chatSidebarCollapsed: collapsed })
    // Persist to settings
    window.api.settings.set({ chatSidebarCollapsed: collapsed }).catch(() => {})
  },

  // Set chat sidebar tab
  setChatSidebarTab: (tab: ChatSidebarTab) => {
    set({ chatSidebarTab: tab })
  },

  // Initialize event listeners for agent communication
  initEventListeners: () => {
    // Stream delta listener
    const unsubscribeDelta = window.api.agent.onStreamDelta((event) => {
      const { activeConversationId } = get()
      if (event.conversationId === activeConversationId) {
        get().appendStreamDelta(event.delta)
      }
    })

    // Message listener
    const unsubscribeMessage = window.api.agent.onMessage((event) => {
      const { activeConversationId, incrementUnread } = get()
      if (event.conversationId === activeConversationId) {
        get().appendMessage(event.message as ConversationMessage)
      } else {
        // Track unread for non-active conversations (only assistant/error messages)
        const messageType = event.message.type
        if (messageType === 'assistant' || messageType === 'error') {
          incrementUnread(event.conversationId, event.agentId)
        }
      }
    })

    // Status listener - track per-agent status
    const unsubscribeStatus = window.api.agent.onStatus((event) => {
      const { agentStatuses, streamingConversationId, conversations } = get()

      // Update per-agent status map
      const newStatuses = new Map(agentStatuses)
      newStatuses.set(event.agentId, event.status)
      set({ agentStatuses: newStatuses })

      // Update global status (for backward compatibility)
      get().setAgentStatus(event.status)

      // Clear streaming state if the streaming conversation's agent is no longer busy
      if (event.status === 'ready' || event.status === 'error') {
        if (streamingConversationId) {
          const streamingConv = conversations.find(c => c.id === streamingConversationId)
          if (streamingConv?.agentId === event.agentId) {
            set({ isStreaming: false, streamingConversationId: null })
          }
        }
      }

      if (event.error) {
        set({ error: event.error })
      }
    })

    // Session update listener - sync sessionId when new session is created
    const unsubscribeSessionUpdate = window.api.agent.onSessionUpdate((event) => {
      const { conversations } = get()
      const updatedConversations = conversations.map(conv =>
        conv.id === event.conversationId
          ? { ...conv, sessionId: event.sessionId, sessionCreatedAt: event.sessionCreatedAt }
          : conv
      )
      set({ conversations: updatedConversations })
    })

    // Permission request listener (SDK mode)
    const unsubscribePermission = window.api.agent.onPermissionRequest((event) => {
      set({ pendingPermissionRequest: event })
    })

    // Todo update listener (SDK mode)
    const unsubscribeTodo = window.api.agent.onTodoUpdate((event) => {
      get().updateTodos(event.conversationId, event.todos)
    })

    // File change listener (SDK mode)
    const unsubscribeFileChange = window.api.agent.onFileChanged((event) => {
      get().addFileChange(event.conversationId, {
        path: event.filePath,
        toolName: event.toolName as 'Write' | 'Edit',
        timestamp: new Date().toISOString()
      })
    })

    // Load chatSidebarCollapsed from settings
    window.api.settings.get().then(result => {
      if (result.success && result.data) {
        set({ chatSidebarCollapsed: result.data.chatSidebarCollapsed || false })
      }
    }).catch(() => {})

    // Check Claude CLI availability
    get().checkClaudeAvailable()

    // Return cleanup function
    return () => {
      unsubscribeDelta()
      unsubscribeMessage()
      unsubscribeStatus()
      unsubscribeSessionUpdate()
      unsubscribePermission()
      unsubscribeTodo()
      unsubscribeFileChange()
    }
  },

  // Clear chat state (when switching agents)
  clearChat: () => {
    set({
      activeConversationId: null,
      conversations: [],
      messages: [],
      streamingContent: '',
      streamingConversationId: null,
      isStreaming: false,
      error: null
    })
  },

  // Set error
  setError: (error: string | null) => {
    set({ error })
  },

  // Check if Claude CLI is available
  checkClaudeAvailable: async () => {
    try {
      const result = await window.api.agent.checkAvailable()
      if (result.success) {
        set({ claudePath: result.data || null, isClaudeChecked: true })
      } else {
        set({ claudePath: null, isClaudeChecked: true })
      }
    } catch {
      set({ claudePath: null, isClaudeChecked: true })
    }
  },

  // Increment unread count for a conversation
  incrementUnread: (conversationId: string, agentId: string) => {
    const { unreadCounts, unreadByAgent } = get()

    // Update conversation count
    const newConvCounts = new Map(unreadCounts)
    newConvCounts.set(conversationId, (newConvCounts.get(conversationId) || 0) + 1)

    // Update agent count
    const newAgentCounts = new Map(unreadByAgent)
    newAgentCounts.set(agentId, (newAgentCounts.get(agentId) || 0) + 1)

    set({ unreadCounts: newConvCounts, unreadByAgent: newAgentCounts })
  },

  // Clear unread count for a conversation
  clearUnread: (conversationId: string) => {
    const { unreadCounts, unreadByAgent, conversations } = get()

    const count = unreadCounts.get(conversationId) || 0
    if (count === 0) return

    // Find the agent for this conversation
    const conversation = conversations.find(c => c.id === conversationId)
    const agentId = conversation?.agentId

    // Update conversation count
    const newConvCounts = new Map(unreadCounts)
    newConvCounts.delete(conversationId)

    // Update agent count
    const newAgentCounts = new Map(unreadByAgent)
    if (agentId) {
      const agentCount = newAgentCounts.get(agentId) || 0
      const newAgentCount = agentCount - count
      if (newAgentCount <= 0) {
        newAgentCounts.delete(agentId)
      } else {
        newAgentCounts.set(agentId, newAgentCount)
      }
    }

    set({ unreadCounts: newConvCounts, unreadByAgent: newAgentCounts })
  },

  // Get unread count for a conversation
  getUnreadCount: (conversationId: string) => {
    return get().unreadCounts.get(conversationId) || 0
  },

  // Get total unread count for an agent
  getAgentUnreadCount: (agentId: string) => {
    return get().unreadByAgent.get(agentId) || 0
  },

  // Get status for a specific agent
  getAgentStatus: (agentId: string) => {
    return get().agentStatuses.get(agentId) || 'ready'
  },

  // Update conversation settings
  updateConversationSettings: async (conversationId: string, settings: Partial<ConversationSettings>) => {
    try {
      const result = await window.api.conversation.updateSettings(conversationId, settings)
      if (result.success && result.data) {
        const updatedConversation = result.data
        // Update the conversation in local state
        const { conversations } = get()
        const updatedConversations = conversations.map(conv => {
          if (conv.id === conversationId) {
            return updatedConversation
          }
          return conv
        })
        set({ conversations: updatedConversations })
      }
    } catch (error) {
      set({ error: String(error) })
    }
  },

  // Get settings for the active conversation
  getActiveConversationSettings: () => {
    const { activeConversationId, conversations } = get()
    if (!activeConversationId) return undefined
    const conversation = conversations.find(c => c.id === activeConversationId)
    return conversation?.settings
  },

  // Respond to a permission request (SDK mode)
  respondToPermission: async (approved: boolean, reason?: string) => {
    const { pendingPermissionRequest } = get()
    if (!pendingPermissionRequest) return

    try {
      await window.api.agent.respondPermission(pendingPermissionRequest.requestId, {
        approved,
        reason
      })
    } catch (error) {
      console.error('Failed to respond to permission:', error)
    } finally {
      // Clear the pending request
      set({ pendingPermissionRequest: null })
    }
  },

  // Update todos for a conversation (full replacement)
  updateTodos: (conversationId: string, todos: TodoItem[]) => {
    const { conversationTodos } = get()
    const newTodos = new Map(conversationTodos)
    newTodos.set(conversationId, todos)
    set({ conversationTodos: newTodos })
  },

  // Add a file change for a conversation
  addFileChange: (conversationId: string, change: FileChange) => {
    const { conversationFiles } = get()
    const newFiles = new Map(conversationFiles)
    const existing = newFiles.get(conversationId) || []

    // Deduplicate by path - update if same path, otherwise append
    const index = existing.findIndex(f => f.path === change.path)
    if (index >= 0) {
      // Update existing entry with latest timestamp
      const updated = [...existing]
      updated[index] = change
      newFiles.set(conversationId, updated)
    } else {
      newFiles.set(conversationId, [...existing, change])
    }
    set({ conversationFiles: newFiles })
  },

  // Get todos for a conversation
  getTodos: (conversationId: string) => {
    return get().conversationTodos.get(conversationId) || []
  },

  // Get file changes for a conversation
  getFileChanges: (conversationId: string) => {
    return get().conversationFiles.get(conversationId) || []
  }
}))
