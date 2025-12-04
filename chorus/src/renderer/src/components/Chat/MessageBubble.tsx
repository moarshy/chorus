import type { ConversationMessage } from '../../types'
import { ToolUseIndicator } from './ToolUseIndicator'
import { MarkdownContent } from './MarkdownContent'
import { ResearchProgress } from './ResearchProgress'
import { ResearchResult } from './ResearchResult'

interface MessageBubbleProps {
  message: ConversationMessage
}

// Format timestamp
function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// SVG Icons
const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const SparklesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
  </svg>
)

const AlertCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)

export function MessageBubble({ message }: MessageBubbleProps) {
  const { type, content, timestamp, toolName, toolInput } = message

  // Handle research progress messages
  if (type === 'research_progress') {
    return <ResearchProgress message={message} />
  }

  // Handle research result messages
  if (type === 'research_result') {
    return <ResearchResult message={message} />
  }

  // Handle tool_use messages
  if (type === 'tool_use') {
    return (
      <ToolUseIndicator
        toolName={toolName || 'Unknown Tool'}
        toolInput={toolInput}
      />
    )
  }

  // Handle error messages
  if (type === 'error') {
    return (
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 shrink-0">
          <AlertCircleIcon />
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg rounded-tl-none px-4 py-3 max-w-[80%]">
          <p className="text-sm text-red-400">{String(content)}</p>
          <p className="text-xs text-red-400/60 mt-1">{formatTime(timestamp)}</p>
        </div>
      </div>
    )
  }

  // User messages
  if (type === 'user') {
    return (
      <div className="flex gap-3 justify-end">
        <div className="bg-accent rounded-lg rounded-tr-none px-4 py-3 max-w-[80%]">
          <MarkdownContent content={String(content)} className="text-sm text-white" />
          <p className="text-xs text-white/60 mt-1 text-right">{formatTime(timestamp)}</p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-accent/30 flex items-center justify-center text-accent shrink-0">
          <UserIcon />
        </div>
      </div>
    )
  }

  // Assistant messages
  if (type === 'assistant') {
    return (
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-accent shrink-0">
          <SparklesIcon />
        </div>
        <div className="bg-input rounded-lg rounded-tl-none px-4 py-3 max-w-[80%]">
          <MarkdownContent content={String(content)} className="text-sm text-white" />
          <p className="text-xs text-muted mt-1">{formatTime(timestamp)}</p>
        </div>
      </div>
    )
  }

  // System messages
  if (type === 'system') {
    return (
      <div className="flex justify-center">
        <div className="px-3 py-1.5 rounded-full bg-hover text-xs text-muted">
          {String(content)}
        </div>
      </div>
    )
  }

  // Fallback for unknown types
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-lg bg-input flex items-center justify-center text-muted shrink-0">
        ?
      </div>
      <div className="bg-input rounded-lg px-4 py-3 max-w-[80%]">
        <pre className="whitespace-pre-wrap font-sans text-sm text-white">
          {String(content)}
        </pre>
      </div>
    </div>
  )
}
