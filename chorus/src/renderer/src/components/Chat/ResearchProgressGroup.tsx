import { useState } from 'react'
import type { ConversationMessage, ResearchPhase } from '../../types'

interface ResearchProgressGroupProps {
  messages: ConversationMessage[]
}

// Phase icons (smaller inline versions)
const phaseIcons: Record<ResearchPhase, string> = {
  analyzing: '🔍',
  searching: '🌐',
  reasoning: '🤔',
  synthesizing: '✍️',
  complete: '✅'
}

const phaseColors: Record<ResearchPhase, string> = {
  analyzing: 'bg-blue-500',
  searching: 'bg-yellow-500',
  reasoning: 'bg-purple-500',
  synthesizing: 'bg-green-500',
  complete: 'bg-green-600'
}

// Globe icon for the group header
const GlobeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
)

const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

// Format timestamp
function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function ResearchProgressGroup({ messages }: ResearchProgressGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (messages.length === 0) return null

  // Get latest phase and stats
  const latestMessage = messages[messages.length - 1]
  const latestPhase = latestMessage.researchPhase || 'analyzing'
  const totalSearches = Math.max(...messages.map(m => m.searchCount || 0))
  const totalSources = messages
    .flatMap(m => m.researchSources || [])
    .filter(s => s.url)
    .length

  // Get time range
  const startTime = messages[0].timestamp
  const endTime = latestMessage.timestamp
  const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime()
  const durationSec = Math.round(durationMs / 1000)

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-blue-400 shrink-0">
        <div className="animate-pulse">
          <GlobeIcon />
        </div>
      </div>
      <div className="bg-input/50 border border-border rounded-lg rounded-tl-none px-3 py-2 max-w-[80%]">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 w-full text-left"
        >
          <span className="text-muted">
            {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </span>
          <span className="text-sm text-white font-medium">
            Research Progress
          </span>
          <span className="text-xs text-muted ml-auto flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${phaseColors[latestPhase]} animate-pulse`} />
            {latestPhase}
            {totalSearches > 0 && ` • ${totalSearches} searches`}
            {totalSources > 0 && ` • ${totalSources} sources`}
            {durationSec > 0 && ` • ${durationSec}s`}
          </span>
        </button>

        {isExpanded && (
          <div className="mt-2 border-t border-border pt-2 space-y-1">
            {messages.map((msg) => {
              const phase = msg.researchPhase || 'analyzing'
              return (
                <div
                  key={msg.uuid}
                  className="flex items-start gap-2 text-xs"
                >
                  <span className="text-muted w-16 shrink-0">
                    {formatTime(msg.timestamp)}
                  </span>
                  <span className="shrink-0">{phaseIcons[phase]}</span>
                  <span className="text-secondary truncate flex-1">
                    {String(msg.content)}
                  </span>
                  {msg.searchCount !== undefined && msg.searchCount > 0 && (
                    <span className="text-muted shrink-0">
                      ({msg.searchCount} searches)
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
