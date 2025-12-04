import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import { useChatStore } from '../../stores/chat-store'
import { MessageBubble } from './MessageBubble'
import { ToolCallsGroup } from './ToolCallsGroup'
import { ResearchProgressGroup } from './ResearchProgressGroup'
import type { ConversationMessage } from '../../types'

// Tool execution pair
interface ToolExecution {
  toolUse: ConversationMessage
  toolResult: ConversationMessage | null
}

// Grouped message type for rendering
type GroupedMessage =
  | { type: 'tool_calls_group'; executions: ToolExecution[]; key: string }
  | { type: 'research_progress_group'; messages: ConversationMessage[]; key: string }
  | { type: 'regular'; message: ConversationMessage; key: string }

// SVG Icons
const SparklesIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
  </svg>
)

export function MessageList() {
  const { messages, isStreaming, streamingContent, isLoading, activeConversationId, streamingConversationId } = useChatStore()
  // Only show streaming UI if THIS conversation is the one streaming
  const isThisConversationStreaming = isStreaming && streamingConversationId === activeConversationId
  const scrollRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  // Track if user is near bottom - only auto-scroll if they are
  const [isNearBottom, setIsNearBottom] = useState(true)

  // Check scroll position to determine if user is near bottom
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    // Consider "near bottom" if within 100px of the bottom
    const nearBottom = scrollHeight - scrollTop - clientHeight < 100
    setIsNearBottom(nearBottom)
  }, [])

  // Group tool_use messages with their corresponding tool_result, then group consecutive tool executions
  const groupedMessages = useMemo((): GroupedMessage[] => {
    const result: GroupedMessage[] = []
    const processedResultIds = new Set<string>()

    // Build a map of tool_use_id to tool_result for quick lookup (for new messages with IDs)
    const resultByToolUseId = new Map<string, ConversationMessage>()
    for (const msg of messages) {
      if (msg.type === 'tool_result' && msg.toolUseId) {
        resultByToolUseId.set(msg.toolUseId, msg)
      }
    }

    // First pass: pair tool_use with tool_result
    const pairedMessages: Array<{ type: 'tool_execution'; exec: ToolExecution } | { type: 'regular'; message: ConversationMessage }> = []

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]

      if (msg.type === 'tool_use') {
        let toolResult: ConversationMessage | null = null

        if (msg.toolUseId) {
          // New format: match by toolUseId
          toolResult = resultByToolUseId.get(msg.toolUseId) || null
        } else {
          // Legacy format: match with next tool_result positionally
          for (let j = i + 1; j < messages.length; j++) {
            const nextMsg = messages[j]
            if (nextMsg.type === 'tool_result' && !nextMsg.toolUseId && !processedResultIds.has(nextMsg.uuid)) {
              toolResult = nextMsg
              break
            }
            if (nextMsg.type === 'tool_use') break
          }
        }

        if (toolResult) {
          processedResultIds.add(toolResult.uuid)
        }

        pairedMessages.push({
          type: 'tool_execution',
          exec: { toolUse: msg, toolResult }
        })
      } else if (msg.type === 'tool_result') {
        // Skip if already grouped with its tool_use
        if (processedResultIds.has(msg.uuid)) {
          continue
        }
        // Orphaned tool_result - render as regular message
        pairedMessages.push({ type: 'regular', message: msg })
      } else {
        pairedMessages.push({ type: 'regular', message: msg })
      }
    }

    // Second pass: group consecutive tool executions and research progress
    let currentToolGroup: ToolExecution[] = []
    let currentResearchProgressGroup: ConversationMessage[] = []

    const flushToolGroup = () => {
      if (currentToolGroup.length > 0) {
        result.push({
          type: 'tool_calls_group',
          executions: currentToolGroup,
          key: currentToolGroup[0].toolUse.uuid
        })
        currentToolGroup = []
      }
    }

    const flushResearchProgressGroup = () => {
      if (currentResearchProgressGroup.length > 0) {
        result.push({
          type: 'research_progress_group',
          messages: currentResearchProgressGroup,
          key: currentResearchProgressGroup[0].uuid
        })
        currentResearchProgressGroup = []
      }
    }

    for (const item of pairedMessages) {
      if (item.type === 'tool_execution') {
        flushResearchProgressGroup()
        currentToolGroup.push(item.exec)
      } else if (item.message.type === 'research_progress') {
        flushToolGroup()
        currentResearchProgressGroup.push(item.message)
      } else {
        // Flush any pending groups
        flushToolGroup()
        flushResearchProgressGroup()
        result.push({ type: 'regular', message: item.message, key: item.message.uuid })
      }
    }

    // Flush remaining groups
    flushToolGroup()
    flushResearchProgressGroup()

    return result
  }, [messages])

  // Auto-scroll to bottom when new content arrives, but only if user is near bottom
  useEffect(() => {
    if (isNearBottom && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingContent, isNearBottom])

  // Always scroll to bottom when switching conversations
  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'instant' })
    }
    setIsNearBottom(true)
  }, [activeConversationId])

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
    <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto px-4 py-4 space-y-4">
      {groupedMessages.map((item) => {
        if (item.type === 'tool_calls_group') {
          return (
            <ToolCallsGroup
              key={item.key}
              executions={item.executions}
            />
          )
        }
        if (item.type === 'research_progress_group') {
          return (
            <ResearchProgressGroup
              key={item.key}
              messages={item.messages}
            />
          )
        }
        return <MessageBubble key={item.key} message={item.message} />
      })}

      {/* Streaming content indicator */}
      {isThisConversationStreaming && streamingContent && (
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-accent shrink-0">
            <SparklesIcon />
          </div>
          <div className="bg-input rounded-lg rounded-tl-none px-4 py-3 max-w-[80%]">
            <div className="text-sm text-white whitespace-pre-wrap">
              {streamingContent}
              <span className="inline-block w-2 h-4 bg-accent/50 animate-pulse ml-0.5" />
            </div>
          </div>
        </div>
      )}

      {/* Typing indicator when streaming but no content yet */}
      {isThisConversationStreaming && !streamingContent && (
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
