import { useState, useEffect, useRef, useCallback } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatPanel } from './components/ChatPanel'
import { Agent, Message } from './types'

function App(): React.JSX.Element {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Record<string, Message[]>>({})
  const [isStreaming, setIsStreaming] = useState(false)
  const [, setIsLoaded] = useState(false)

  // Track current streaming message for accumulation
  const streamingMessageRef = useRef<{ agentId: string; messageId: string; content: string } | null>(
    null
  )

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || null
  const currentMessages = selectedAgentId ? conversations[selectedAgentId] || [] : []

  // Load agents and messages from store on startup
  useEffect(() => {
    async function loadFromStore() {
      try {
        // Load agents
        const agentsResult = await window.api.store.getAgents()
        if (agentsResult.success && agentsResult.agents) {
          const loadedAgents: Agent[] = agentsResult.agents.map((stored) => ({
            id: stored.id,
            name: stored.name,
            repoPath: stored.repoPath,
            status: 'ready' as const,
            hasUnread: false
          }))
          setAgents(loadedAgents)

          // Load messages for each agent
          const loadedConversations: Record<string, Message[]> = {}
          for (const agent of agentsResult.agents) {
            const messagesResult = await window.api.store.getMessages(agent.id)
            if (messagesResult.success && messagesResult.messages) {
              loadedConversations[agent.id] = messagesResult.messages.map((stored) => ({
                id: stored.id,
                role: stored.role,
                content: stored.content,
                timestamp: new Date(stored.timestamp)
              }))
            }
          }
          setConversations(loadedConversations)

          // Select first agent if any
          if (loadedAgents.length > 0) {
            setSelectedAgentId(loadedAgents[0].id)
          }
        }
      } catch (error) {
        console.error('Failed to load from store:', error)
      } finally {
        setIsLoaded(true)
      }
    }
    loadFromStore()
  }, [])

  // Helper to persist a message
  const persistMessage = useCallback(async (agentId: string, message: Message) => {
    try {
      await window.api.store.addMessage(agentId, {
        id: message.id,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp.toISOString()
      })
    } catch (error) {
      console.error('Failed to persist message:', error)
    }
  }, [])

  // Set up listeners for agent messages from main process
  useEffect(() => {
    // Listen for agent messages (streaming responses)
    const cleanupMessage = window.api.onAgentMessage((message) => {
      const { agentId, type, content } = message

      if (type === 'text') {
        // Accumulate streaming text
        if (
          streamingMessageRef.current &&
          streamingMessageRef.current.agentId === agentId
        ) {
          // Append to existing streaming message
          streamingMessageRef.current.content += content

          setConversations((prev) => {
            const messages = prev[agentId] || []
            const lastIdx = messages.length - 1
            if (lastIdx >= 0 && messages[lastIdx].id === streamingMessageRef.current?.messageId) {
              const updated = [...messages]
              updated[lastIdx] = {
                ...updated[lastIdx],
                content: streamingMessageRef.current!.content
              }
              return { ...prev, [agentId]: updated }
            }
            return prev
          })
        } else {
          // Start new streaming message
          const messageId = Date.now().toString()
          streamingMessageRef.current = { agentId, messageId, content }

          const assistantMessage: Message = {
            id: messageId,
            role: 'assistant',
            content,
            timestamp: new Date()
          }

          setConversations((prev) => ({
            ...prev,
            [agentId]: [...(prev[agentId] || []), assistantMessage]
          }))
        }
      } else if (type === 'tool_use') {
        // Show tool usage as a system-style message
        const toolMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `🔧 ${content}`,
          timestamp: new Date()
        }
        setConversations((prev) => ({
          ...prev,
          [agentId]: [...(prev[agentId] || []), toolMessage]
        }))
      } else if (type === 'done') {
        // Response complete - persist final streamed message
        if (streamingMessageRef.current) {
          const finalMessage: Message = {
            id: streamingMessageRef.current.messageId,
            role: 'assistant',
            content: streamingMessageRef.current.content,
            timestamp: new Date()
          }
          persistMessage(streamingMessageRef.current.agentId, finalMessage)
        }
        streamingMessageRef.current = null
        setIsStreaming(false)
      } else if (type === 'error') {
        // Show error message
        const errorMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `❌ Error: ${content}`,
          timestamp: new Date()
        }
        setConversations((prev) => ({
          ...prev,
          [agentId]: [...(prev[agentId] || []), errorMessage]
        }))
        streamingMessageRef.current = null
        setIsStreaming(false)
      }
    })

    // Listen for agent status changes
    const cleanupStatus = window.api.onAgentStatus((statusUpdate) => {
      const { agentId, status } = statusUpdate
      setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, status } : a)))

      if (status === 'busy') {
        setIsStreaming(true)
      } else {
        setIsStreaming(false)
      }
    })

    // Cleanup listeners on unmount
    return () => {
      cleanupMessage()
      cleanupStatus()
    }
  }, [persistMessage])

  const handleSelectAgent = (id: string) => {
    setSelectedAgentId(id)
    // Clear unread indicator
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, hasUnread: false } : a)))
  }

  const handleAddAgent = async () => {
    const result = await window.api.selectDirectory()
    if (result.success && result.dirPath) {
      const name = result.dirPath.split('/').pop() || 'New Agent'
      const newAgent: Agent = {
        id: Date.now().toString(),
        name,
        repoPath: result.dirPath,
        status: 'ready',
        hasUnread: false
      }
      setAgents((prev) => [...prev, newAgent])
      setSelectedAgentId(newAgent.id)

      // Persist agent to store
      await window.api.store.addAgent({
        id: newAgent.id,
        name: newAgent.name,
        repoPath: newAgent.repoPath,
        createdAt: new Date().toISOString()
      })
    }
  }

  const handleSendMessage = async (content: string) => {
    if (!selectedAgentId || !selectedAgent) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    }

    // Add user message immediately
    setConversations((prev) => ({
      ...prev,
      [selectedAgentId]: [...(prev[selectedAgentId] || []), userMessage]
    }))

    // Persist user message
    persistMessage(selectedAgentId, userMessage)

    // Send to agent via IPC - main process will stream responses back
    setIsStreaming(true)
    try {
      await window.api.sendToAgent(selectedAgentId, selectedAgent.repoPath, content)
    } catch (error) {
      console.error('Failed to send message:', error)
      setIsStreaming(false)
    }
  }

  const handleStopAgent = async () => {
    if (!selectedAgentId) return
    await window.api.stopAgent(selectedAgentId)
  }

  return (
    <div className="flex h-screen w-screen">
      <Sidebar
        agents={agents}
        selectedAgentId={selectedAgentId}
        onSelectAgent={handleSelectAgent}
        onAddAgent={handleAddAgent}
      />
      <ChatPanel
        agent={selectedAgent}
        messages={currentMessages}
        onSendMessage={handleSendMessage}
        isStreaming={isStreaming}
        onStopAgent={handleStopAgent}
      />
    </div>
  )
}

export default App
