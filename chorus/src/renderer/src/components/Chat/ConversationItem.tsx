import { useState } from 'react'
import { useChatStore } from '../../stores/chat-store'
import type { Conversation } from '../../types'

interface ConversationItemProps {
  conversation: Conversation
}

// Helper function to get relative time
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

// Truncate title
function truncateTitle(title: string, maxLength = 50): string {
  if (title.length <= maxLength) return title
  return title.substring(0, maxLength - 3) + '...'
}

// SVG Icons
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
)

export function ConversationItem({ conversation }: ConversationItemProps) {
  const { activeConversationId, selectConversation, deleteConversation } = useChatStore()
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 })

  const isActive = activeConversationId === conversation.id

  const handleClick = () => {
    selectConversation(conversation.id)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenuPos({ x: e.clientX, y: e.clientY })
    setShowContextMenu(true)
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowContextMenu(false)
    await deleteConversation(conversation.id)
  }

  // Close context menu when clicking outside
  const handleCloseMenu = () => {
    setShowContextMenu(false)
  }

  return (
    <>
      <button
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={`w-full text-left px-3 py-2 transition-colors ${
          isActive
            ? 'bg-accent/20 border-l-2 border-accent'
            : 'hover:bg-hover border-l-2 border-transparent'
        }`}
      >
        <div className="text-sm text-white truncate">
          {truncateTitle(conversation.title)}
        </div>
        <div className="text-xs text-muted mt-0.5">
          {getRelativeTime(conversation.updatedAt)}
        </div>
      </button>

      {/* Context Menu */}
      {showContextMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50"
            onClick={handleCloseMenu}
          />
          {/* Menu */}
          <div
            className="fixed z-50 bg-input border border-default rounded-lg shadow-lg py-1 min-w-[140px]"
            style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
          >
            <button
              onClick={handleDelete}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-hover transition-colors"
            >
              <TrashIcon />
              <span>Delete</span>
            </button>
          </div>
        </>
      )}
    </>
  )
}
