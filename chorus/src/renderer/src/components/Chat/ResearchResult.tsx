import { useState } from 'react'
import type { ConversationMessage, ResearchSource } from '../../types'
import { MarkdownContent } from './MarkdownContent'

interface ResearchResultProps {
  message: ConversationMessage
}

// Icons
const GlobeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
)

const FileTextIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
)

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)

const LinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
)

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const ChevronUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
)

// Format duration in human readable form
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

// Format timestamp
function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Estimate reading time (average 200 words per minute)
function estimateReadingTime(wordCount: number): string {
  const minutes = Math.ceil(wordCount / 200)
  return `${minutes} min read`
}

// Sources panel component
function SourcesPanel({ sources }: { sources: ResearchSource[] }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const urlSources = sources.filter(s => s.url)
  const querySources = sources.filter(s => s.query && !s.url)

  if (urlSources.length === 0 && querySources.length === 0) {
    return null
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs text-muted hover:text-secondary transition-colors w-full"
      >
        <LinkIcon />
        <span>{urlSources.length} sources</span>
        {querySources.length > 0 && (
          <span className="text-muted">• {querySources.length} searches</span>
        )}
        <span className="ml-auto">
          {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          {urlSources.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted font-medium">Sources:</p>
              <ul className="space-y-1">
                {urlSources.map((source, i) => (
                  <li key={i} className="text-xs">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline truncate block"
                      title={source.url}
                    >
                      {source.title || source.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {querySources.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted font-medium">Search queries:</p>
              <ul className="space-y-0.5">
                {querySources.slice(0, 10).map((source, i) => (
                  <li key={i} className="text-xs text-secondary truncate" title={source.query}>
                    • {source.query}
                  </li>
                ))}
                {querySources.length > 10 && (
                  <li className="text-xs text-muted">
                    ... and {querySources.length - 10} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ResearchResult({ message }: ResearchResultProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const content = String(message.content)
  const wordCount = message.wordCount || content.split(/\s+/).filter(w => w.length > 0).length
  const sourceCount = message.sourceCount || 0
  const searchCount = message.searchCount || 0
  const duration = message.durationMs || 0
  const outputPath = message.outputPath
  const sources = message.researchSources || []

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-blue-400 shrink-0">
        <GlobeIcon />
      </div>
      <div className="bg-input rounded-lg rounded-tl-none overflow-hidden max-w-[85%] w-full">
        {/* Header with metadata */}
        <div className="px-4 py-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <span>Research Complete</span>
            </h3>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-muted hover:text-secondary transition-colors"
            >
              {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </button>
          </div>

          {/* Metadata row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1">
              <FileTextIcon />
              {wordCount.toLocaleString()} words • {estimateReadingTime(wordCount)}
            </span>
            {searchCount > 0 && (
              <span className="flex items-center gap-1">
                <SearchIcon />
                {searchCount} searches
              </span>
            )}
            {sourceCount > 0 && (
              <span className="flex items-center gap-1">
                <LinkIcon />
                {sourceCount} sources
              </span>
            )}
            {duration > 0 && (
              <span className="flex items-center gap-1">
                <ClockIcon />
                {formatDuration(duration)}
              </span>
            )}
          </div>

          {outputPath && (
            <div className="mt-2 text-xs text-muted flex items-center gap-1">
              <FileTextIcon />
              <span>Saved to: {outputPath}</span>
            </div>
          )}
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="px-4 py-3">
            <MarkdownContent content={content} className="text-sm text-white" />
            <SourcesPanel sources={sources} />
            <p className="text-xs text-muted mt-3 pt-2 border-t border-border">
              {formatTime(message.timestamp)}
            </p>
          </div>
        )}

        {/* Collapsed preview */}
        {!isExpanded && (
          <div className="px-4 py-2">
            <p className="text-sm text-secondary line-clamp-2">
              {content.slice(0, 200)}...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
