import { create } from 'zustand'
import type {
  Conversation,
  ConversationMessage,
  ChatSidebarTab,
  AgentStatus
} from '../types'

interface ChatStore {
  // State
  activeConversationId: string | null
  conversations: Conversation[]
  messages: ConversationMessage[]
  isLoading: boolean
  isStreaming: boolean
  streamingContent: string
  agentStatus: AgentStatus
  chatSidebarCollapsed: boolean
  chatSidebarTab: ChatSidebarTab
  error: string | null

  // Actions
  loadConversations: (workspaceId: string, agentId: string) => Promise<void>
  selectConversation: (conversationId: string | null) => Promise<void>
  createConversation: (workspaceId: string, agentId: string) => Promise<string | null>
  deleteConversation: (conversationId: string) => Promise<void>
  sendMessage: (content: string, workspaceId: string, agentId: string, repoPath: string) => Promise<void>
  appendStreamDelta: (delta: string) => void
  appendMessage: (message: ConversationMessage) => void
  setAgentStatus: (status: AgentStatus) => void
  stopAgent: (agentId: string) => Promise<void>
  setChatSidebarCollapsed: (collapsed: boolean) => void
  setChatSidebarTab: (tab: ChatSidebarTab) => void
  initEventListeners: () => () => void
  clearChat: () => void
  setError: (error: string | null) => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  // Initial state
  activeConversationId: null,
  conversations: [],
  messages: [],
  isLoading: false,
  isStreaming: false,
  streamingContent: '',
  agentStatus: 'ready',
  chatSidebarCollapsed: false,
  chatSidebarTab: 'conversations',
  error: null,

  // Load conversations for a workspace/agent
  loadConversations: async (workspaceId: string, agentId: string) => {
    set({ isLoading: true, error: null })
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
        set({
          activeConversationId: conversationId,
          messages: result.data.messages || [],
          isLoading: false,
          streamingContent: ''
        })
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
  sendMessage: async (content: string, workspaceId: string, agentId: string, repoPath: string) => {
    let conversationId = get().activeConversationId

    // Create conversation if none active
    if (!conversationId) {
      conversationId = await get().createConversation(workspaceId, agentId)
      if (!conversationId) {
        set({ error: 'Failed to create conversation' })
        return
      }
    }

    // Set streaming state
    set({ isStreaming: true, streamingContent: '', error: null })

    try {
      // Get session ID from the active conversation
      const conversation = get().conversations.find(c => c.id === conversationId)
      const sessionId = conversation?.sessionId || undefined

      // Send message - response comes via events
      await window.api.agent.send(conversationId, content, repoPath, sessionId)
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
      set({ isStreaming: false, agentStatus: 'ready' })
    } catch (error) {
      console.error('Failed to stop agent:', error)
    }
  },

  // Toggle chat sidebar
  setChatSidebarCollapsed: (collapsed: boolean) => {
    set({ chatSidebarCollapsed: collapsed })
    // Persist to settings
    window.api.settings.set({ chatSidebarCollapsed: collapsed }).catch(console.error)
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
      const { activeConversationId } = get()
      if (event.conversationId === activeConversationId) {
        get().appendMessage(event.message as ConversationMessage)
      }
    })

    // Status listener
    const unsubscribeStatus = window.api.agent.onStatus((event) => {
      get().setAgentStatus(event.status)
      if (event.error) {
        set({ error: event.error })
      }
    })

    // Load chatSidebarCollapsed from settings
    window.api.settings.get().then(result => {
      if (result.success && result.data) {
        set({ chatSidebarCollapsed: result.data.chatSidebarCollapsed || false })
      }
    }).catch(console.error)

    // Return cleanup function
    return () => {
      unsubscribeDelta()
      unsubscribeMessage()
      unsubscribeStatus()
    }
  },

  // Clear chat state (when switching agents)
  clearChat: () => {
    set({
      activeConversationId: null,
      conversations: [],
      messages: [],
      streamingContent: '',
      isStreaming: false,
      error: null
    })
  },

  // Set error
  setError: (error: string | null) => {
    set({ error })
  }
}))
