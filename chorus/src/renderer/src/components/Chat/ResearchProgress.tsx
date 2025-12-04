import type { ConversationMessage, ResearchPhase } from '../../types'

interface ResearchProgressProps {
  message: ConversationMessage
}

// Phase icons
const AnalyzingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
)

const SearchingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)

const ReasoningIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a8 8 0 0 0-8 8c0 4.4 3.6 8 8 8s8-3.6 8-8a8 8 0 0 0-8-8z" />
    <path d="M12 6v6l4 2" />
  </svg>
)

const SynthesizingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
)

const phaseConfig: Record<ResearchPhase, { icon: React.ReactNode; label: string; color: string }> = {
  analyzing: {
    icon: <AnalyzingIcon />,
    label: 'Analyzing',
    color: 'text-blue-400'
  },
  searching: {
    icon: <SearchingIcon />,
    label: 'Searching',
    color: 'text-yellow-400'
  },
  reasoning: {
    icon: <ReasoningIcon />,
    label: 'Reasoning',
    color: 'text-purple-400'
  },
  synthesizing: {
    icon: <SynthesizingIcon />,
    label: 'Synthesizing',
    color: 'text-green-400'
  },
  complete: {
    icon: <SynthesizingIcon />,
    label: 'Complete',
    color: 'text-green-400'
  }
}

// Format timestamp
function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ResearchProgress({ message }: ResearchProgressProps) {
  const phase = message.researchPhase || 'analyzing'
  const config = phaseConfig[phase]
  const searchCount = message.searchCount || 0
  const sources = message.researchSources || []

  // Count unique URLs discovered
  const urlCount = sources.filter(s => s.url).length

  return (
    <div className="flex gap-3">
      <div className={`w-8 h-8 rounded-lg bg-input flex items-center justify-center shrink-0 ${config.color}`}>
        <div className="animate-pulse">
          {config.icon}
        </div>
      </div>
      <div className="bg-input/50 border border-border rounded-lg rounded-tl-none px-4 py-3 max-w-[80%]">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-medium ${config.color}`}>
            {config.label}
          </span>
          {phase === 'searching' && searchCount > 0 && (
            <span className="text-xs text-muted">
              • {searchCount} {searchCount === 1 ? 'search' : 'searches'}
            </span>
          )}
          {urlCount > 0 && (
            <span className="text-xs text-muted">
              • {urlCount} {urlCount === 1 ? 'source' : 'sources'} found
            </span>
          )}
        </div>
        <p className="text-sm text-secondary">{String(message.content)}</p>
        <p className="text-xs text-muted mt-1">{formatTime(message.timestamp)}</p>
      </div>
    </div>
  )
}
