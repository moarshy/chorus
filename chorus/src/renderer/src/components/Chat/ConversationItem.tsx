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
  const { activeConversationId, selectConversation, deleteConversation, getUnreadCount } = useChatStore()
  const [isHovered, setIsHovered] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const isActive = activeConversationId === conversation.id
  const unreadCount = getUnreadCount(conversation.id)

  const handleClick = () => {
    selectConversation(conversation.id)
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = async () => {
    setShowDeleteConfirm(false)
    await deleteConversation(conversation.id)
  }

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false)
  }

  return (
    <>
      <div
        className="relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <button
          onClick={handleClick}
          className={`w-full text-left px-3 py-2 pr-8 transition-colors ${
            isActive
              ? 'bg-accent/20 border-l-2 border-accent'
              : 'hover:bg-hover border-l-2 border-transparent'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-white truncate flex-1">
              {truncateTitle(conversation.title)}
            </span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-accent text-white rounded-full min-w-[18px] text-center shrink-0">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div className="text-xs text-muted mt-0.5">
            {getRelativeTime(conversation.updatedAt)}
          </div>
        </button>

        {/* Delete icon on hover */}
        {isHovered && (
          <button
            onClick={handleDeleteClick}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-red-400 transition-colors rounded"
            title="Delete conversation"
          >
            <TrashIcon />
          </button>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/50"
            onClick={handleCancelDelete}
          />
          {/* Dialog */}
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-sidebar border border-default rounded-lg shadow-xl p-4 min-w-[280px]">
            <h3 className="text-white font-medium mb-2">Delete conversation?</h3>
            <p className="text-muted text-sm mb-4">This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancelDelete}
                className="px-3 py-1.5 text-sm text-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
