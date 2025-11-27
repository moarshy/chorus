import { useEffect } from 'react'
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
    clearChat
  } = useChatStore()

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

  return (
    <div className="flex h-full bg-main">
      {/* Chat Sidebar */}
      <ChatSidebar
        collapsed={chatSidebarCollapsed}
        workspaceId={workspace.id}
        agentId={agent.id}
      />

      {/* Chat Area */}
      <ChatArea
        agent={agent}
        workspace={workspace}
      />
    </div>
  )
}
