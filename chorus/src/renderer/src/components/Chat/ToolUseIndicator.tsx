import { useState } from 'react'

interface ToolUseIndicatorProps {
  toolName: string
  toolInput?: Record<string, unknown>
}

// SVG Icons
const ToolIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
)

const ChevronDownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
)

// Format tool name for display
function formatToolName(name: string): string {
  // Convert snake_case or camelCase to Title Case
  return name
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\s/, '')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

// Summarize tool input for brief display
function summarizeInput(input?: Record<string, unknown>): string {
  if (!input) return ''
  const keys = Object.keys(input)
  if (keys.length === 0) return ''

  // Get the most relevant key to show
  const relevantKeys = ['path', 'file', 'command', 'query', 'content', 'name']
  for (const key of relevantKeys) {
    if (input[key] && typeof input[key] === 'string') {
      const value = String(input[key])
      return value.length > 40 ? value.substring(0, 37) + '...' : value
    }
  }

  // Fallback to first string value
  for (const key of keys) {
    if (typeof input[key] === 'string') {
      const value = String(input[key])
      return value.length > 40 ? value.substring(0, 37) + '...' : value
    }
  }

  return `${keys.length} parameter${keys.length > 1 ? 's' : ''}`
}

export function ToolUseIndicator({ toolName, toolInput }: ToolUseIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const summary = summarizeInput(toolInput)

  return (
    <div className="flex gap-3 my-2">
      <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-400 shrink-0">
        <ToolIcon />
      </div>
      <div className="flex-1 min-w-0">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/15 transition-colors w-full text-left"
        >
          <span className="text-yellow-400">
            {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </span>
          <span className="text-sm font-medium text-yellow-400">
            {formatToolName(toolName)}
          </span>
          {summary && !isExpanded && (
            <span className="text-xs text-yellow-400/60 truncate ml-1">
              {summary}
            </span>
          )}
        </button>

        {/* Expanded details */}
        {isExpanded && toolInput && (
          <div className="mt-2 ml-5 p-3 rounded-lg bg-input border border-default">
            <pre className="text-xs text-muted overflow-x-auto">
              {JSON.stringify(toolInput, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
