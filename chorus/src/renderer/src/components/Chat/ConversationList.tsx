import { useChatStore } from '../../stores/chat-store'
import { ConversationItem } from './ConversationItem'
import type { Conversation } from '../../types'

// Helper function to group conversations by date
function groupConversationsByDate(conversations: Conversation[]): Record<string, Conversation[]> {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  const groups: Record<string, Conversation[]> = {
    'Today': [],
    'Yesterday': [],
    'This Week': [],
    'Older': []
  }

  for (const conv of conversations) {
    const date = new Date(conv.updatedAt)
    if (date >= today) {
      groups['Today'].push(conv)
    } else if (date >= yesterday) {
      groups['Yesterday'].push(conv)
    } else if (date >= weekAgo) {
      groups['This Week'].push(conv)
    } else {
      groups['Older'].push(conv)
    }
  }

  // Remove empty groups
  for (const key of Object.keys(groups)) {
    if (groups[key].length === 0) {
      delete groups[key]
    }
  }

  return groups
}

export function ConversationList() {
  const { conversations, isLoading } = useChatStore()

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-hover rounded w-3/4 mb-2" />
            <div className="h-3 bg-hover rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <div className="text-muted text-sm">
          <p className="mb-2">No conversations yet</p>
          <p className="text-xs">Start a new chat to begin</p>
        </div>
      </div>
    )
  }

  const groupedConversations = groupConversationsByDate(conversations)

  return (
    <div className="overflow-y-auto h-full">
      {Object.entries(groupedConversations).map(([group, convs]) => (
        <div key={group} className="py-2">
          <div className="px-3 py-1 text-xs font-medium text-muted uppercase tracking-wider">
            {group}
          </div>
          {convs.map(conversation => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
