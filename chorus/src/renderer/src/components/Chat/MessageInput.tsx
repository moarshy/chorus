import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import type { Agent, Workspace } from '../../types'
import { useChatStore } from '../../stores/chat-store'

interface MessageInputProps {
  agent: Agent
  workspace: Workspace
}

// SVG Icons
const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

export function MessageInput({ agent, workspace }: MessageInputProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { isStreaming, isLoading, sendMessage } = useChatStore()

  const isDisabled = isStreaming || isLoading

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const newHeight = Math.min(textarea.scrollHeight, 150) // Max 4 lines approx
      textarea.style.height = `${newHeight}px`
    }
  }, [message])

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSubmit = async () => {
    const trimmed = message.trim()
    if (!trimmed || isDisabled) return

    // Clear input immediately
    setMessage('')

    // Send message
    await sendMessage(trimmed, workspace.id, agent.id, workspace.path)

    // Refocus
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send, Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }

    // Escape to stop streaming
    if (e.key === 'Escape' && isStreaming) {
      useChatStore.getState().stopAgent(agent.id)
    }
  }

  return (
    <div className="p-4 border-t border-default bg-sidebar">
      <div className="flex items-end gap-3 bg-input rounded-xl border border-default focus-within:border-accent transition-colors">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${agent.name}...`}
          disabled={isDisabled}
          rows={1}
          className="flex-1 bg-transparent px-4 py-3 text-sm text-white placeholder:text-muted resize-none outline-none disabled:opacity-50 max-h-[150px]"
        />
        <button
          onClick={handleSubmit}
          disabled={isDisabled || !message.trim()}
          className="p-3 text-accent hover:text-accent-hover disabled:text-muted disabled:cursor-not-allowed transition-colors"
        >
          <SendIcon />
        </button>
      </div>
      <div className="flex justify-between mt-2 text-xs text-muted px-1">
        <span>
          Press <kbd className="px-1.5 py-0.5 rounded bg-hover font-mono">Enter</kbd> to send
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-hover font-mono">Shift+Enter</kbd> for new line
        </span>
      </div>
    </div>
  )
}
