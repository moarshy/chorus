import { useEffect, useRef, useState } from 'react'
import { Agent, Message } from '../types'
import { MessageInput } from './MessageInput'
import { FilesPanel } from './FilesPanel'

interface ChatPanelProps {
  agent: Agent | null
  messages: Message[]
  onSendMessage: (content: string) => void
  isStreaming: boolean
  onStopAgent?: () => void
}

type TabType = 'messages' | 'files'

export function ChatPanel({ agent, messages, onSendMessage, isStreaming, onStopAgent }: ChatPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('messages')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Reset to messages tab when agent changes
  useEffect(() => {
    setActiveTab('messages')
  }, [agent?.id])

  if (!agent) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--chat-bg)]">
        <div className="text-center">
          <div className="text-6xl mb-4">🎭</div>
          <h2 className="text-xl font-semibold text-white mb-2">Welcome to Chorus</h2>
          <p className="text-[var(--text-secondary)]">
            Select an agent from the sidebar or add a new one to get started.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-[var(--chat-bg)]">
      {/* Header with Tabs */}
      <div className="border-b border-[var(--border-color)]">
        {/* Agent Info */}
        <div className="h-14 px-4 flex items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[var(--accent)] flex items-center justify-center text-white font-medium">
              {agent.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="font-semibold text-white">{agent.name}</h2>
              <p className="text-xs text-[var(--text-secondary)] truncate max-w-md">
                {agent.repoPath}
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {agent.status === 'busy' && onStopAgent && (
              <button
                onClick={onStopAgent}
                className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                Stop
              </button>
            )}
            <span
              className={`text-xs px-2 py-1 rounded ${
                agent.status === 'ready'
                  ? 'bg-green-500/20 text-green-400'
                  : agent.status === 'busy'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              {agent.status === 'busy' ? 'Working...' : 'Ready'}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 flex gap-1">
          <button
            onClick={() => setActiveTab('messages')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'messages'
                ? 'border-[var(--accent)] text-white'
                : 'border-transparent text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            Messages
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'files'
                ? 'border-[var(--accent)] text-white'
                : 'border-transparent text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            Files
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'messages' ? (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-secondary)]">
                <p>No messages yet. Start a conversation with {agent.name}!</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--input-bg)] text-[var(--text-primary)]'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs mt-1 opacity-60">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}

            {/* Streaming indicator */}
            {isStreaming && (
              <div className="flex justify-start">
                <div className="bg-[var(--input-bg)] rounded-lg px-4 py-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-[var(--text-secondary)] rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-[var(--text-secondary)] rounded-full animate-bounce [animation-delay:0.1s]" />
                    <span className="w-2 h-2 bg-[var(--text-secondary)] rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <MessageInput onSend={onSendMessage} disabled={isStreaming || agent.status === 'busy'} />
        </>
      ) : (
        <FilesPanel agent={agent} />
      )}
    </div>
  )
}
