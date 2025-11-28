import { useEffect, useRef } from 'react'
import { useChatStore } from '../../stores/chat-store'
import { MessageBubble } from './MessageBubble'
import { MarkdownContent } from './MarkdownContent'

// SVG Icons
const SparklesIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
  </svg>
)

export function MessageList() {
  const { messages, isStreaming, streamingContent, isLoading } = useChatStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingContent])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-muted">Loading messages...</div>
      </div>
    )
  }

  if (messages.length === 0 && !streamingContent) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted max-w-md px-4">
          <div className="mb-4 text-accent">
            <SparklesIcon />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Start a conversation</h3>
          <p className="text-sm">
            Send a message to begin chatting with this agent.
            They can help you with code, answer questions, and more.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((message) => (
        <MessageBubble key={message.uuid} message={message} />
      ))}

      {/* Streaming content indicator */}
      {isStreaming && streamingContent && (
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-accent shrink-0">
            <SparklesIcon />
          </div>
          <div className="bg-input rounded-lg rounded-tl-none px-4 py-3 max-w-[80%]">
            <div className="text-sm text-white">
              <MarkdownContent content={streamingContent} />
              <span className="inline-block w-2 h-4 bg-accent/50 animate-pulse ml-0.5" />
            </div>
          </div>
        </div>
      )}

      {/* Typing indicator when streaming but no content yet */}
      {isStreaming && !streamingContent && (
        <div className="flex gap-3 items-start">
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-accent shrink-0 animate-pulse">
            <SparklesIcon />
          </div>
          <div className="bg-input rounded-lg rounded-tl-none px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-secondary">Thinking</span>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scroll anchor */}
      <div ref={endRef} />
    </div>
  )
}
