import { useEffect, useCallback } from 'react'
import type { Agent, Workspace } from '../../types'
import { useChatStore } from '../../stores/chat-store'
import { ChatSidebar } from './ChatSidebar'
import { ChatArea } from './ChatArea'

interface ChatViewProps {
  agent: Agent
  workspace: Workspace
}

export function ChatView({ agent, workspace }: ChatViewProps) {
  const {
    chatSidebarCollapsed,
    loadConversations,
    initEventListeners,
    clearChat,
    createConversation,
    isStreaming,
    streamingConversationId,
    activeConversationId,
    stopAgent
  } = useChatStore()

  // Only respond to escape if THIS conversation is streaming
  const isThisConversationStreaming = isStreaming && streamingConversationId === activeConversationId

  // Load conversations when agent changes
  useEffect(() => {
    loadConversations(workspace.id, agent.id)
  }, [workspace.id, agent.id, loadConversations])

  // Initialize event listeners
  useEffect(() => {
    const cleanup = initEventListeners()
    return cleanup
  }, [initEventListeners])

  // Clear chat when unmounting
  useEffect(() => {
    return () => {
      clearChat()
    }
  }, [clearChat])

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Cmd/Ctrl+N: New conversation
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault()
      createConversation(workspace.id, agent.id)
    }

    // Escape: Stop streaming (only if this conversation is streaming)
    if (e.key === 'Escape' && isThisConversationStreaming) {
      stopAgent(agent.id)
    }
  }, [workspace.id, agent.id, createConversation, isThisConversationStreaming, stopAgent])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="flex h-full bg-main">
      {/* Chat Sidebar */}
      <ChatSidebar
        collapsed={chatSidebarCollapsed}
        workspaceId={workspace.id}
        agentId={agent.id}
        repoPath={workspace.path}
      />

      {/* Chat Area */}
      <ChatArea
        agent={agent}
        workspace={workspace}
      />
    </div>
  )
}
