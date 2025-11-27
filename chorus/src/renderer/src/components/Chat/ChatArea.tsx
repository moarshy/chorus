import type { Agent, Workspace } from '../../types'
import { ChatHeader } from './ChatHeader'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'

interface ChatAreaProps {
  agent: Agent
  workspace: Workspace
}

export function ChatArea({ agent, workspace }: ChatAreaProps) {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <ChatHeader agent={agent} workspace={workspace} />
      <MessageList />
      <MessageInput agent={agent} workspace={workspace} />
    </div>
  )
}
