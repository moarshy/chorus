import type { ConversationMessage } from '../types'

// Default context window when not available from result message
const DEFAULT_CONTEXT_WINDOW = 200_000

// ============================================
// Context Level Types and Helpers
// ============================================

export type ContextLevel = 'low' | 'medium' | 'high' | 'critical'

export function getContextLevel(percentage: number): ContextLevel {
  if (percentage >= 90) return 'critical'
  if (percentage >= 75) return 'high'
  if (percentage >= 50) return 'medium'
  return 'low'
}

export function getContextLevelColor(level: ContextLevel): string {
  switch (level) {
    case 'critical':
      return 'text-red-400 bg-red-500/20 border-red-500/30'
    case 'high':
      return 'text-orange-400 bg-orange-500/20 border-orange-500/30'
    case 'medium':
      return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30'
    case 'low':
      return 'text-green-400 bg-green-500/20 border-green-500/30'
  }
}

export function getProgressBarColor(level: ContextLevel): string {
  switch (level) {
    case 'critical':
      return 'bg-red-500'
    case 'high':
      return 'bg-orange-500'
    case 'medium':
      return 'bg-yellow-500'
    case 'low':
      return 'bg-green-500'
  }
}

// ============================================
// Context Metrics
// ============================================

export interface ContextMetrics {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  totalCost: number
  contextLimit: number
  estimatedUsage: number
  estimatedPercentage: number
  numTurns: number
  durationMs: number
}

const EMPTY_METRICS: ContextMetrics = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  totalCost: 0,
  contextLimit: DEFAULT_CONTEXT_WINDOW,
  estimatedUsage: 0,
  estimatedPercentage: 0,
  numTurns: 0,
  durationMs: 0
}

// ============================================
// Claude Result Message Types (for parsing claudeMessage)
// ============================================

interface ClaudeResultUsage {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

interface ClaudeModelUsageEntry {
  inputTokens?: number
  cacheReadInputTokens?: number
  contextWindow?: number
}

interface ClaudeResultMessage {
  type: 'result'
  usage?: ClaudeResultUsage
  modelUsage?: Record<string, ClaudeModelUsageEntry>
  num_turns?: number
  duration_ms?: number
  total_cost_usd?: number
}

// ============================================
// Metric Extraction
// ============================================

/**
 * Extract metrics from a nested claudeMessage object.
 * Used for backwards compatibility with older stored messages.
 */
function extractFromClaudeMessage(claudeMessage: unknown): ContextMetrics | null {
  if (!claudeMessage || typeof claudeMessage !== 'object') return null

  const msg = claudeMessage as ClaudeResultMessage
  if (msg.type !== 'result' || !msg.usage) return null

  const usage = msg.usage

  // Find context window from the model with most token usage
  let contextLimit = DEFAULT_CONTEXT_WINDOW
  if (msg.modelUsage) {
    let maxTokens = 0
    for (const modelData of Object.values(msg.modelUsage)) {
      const tokens = (modelData.inputTokens || 0) + (modelData.cacheReadInputTokens || 0)
      if (tokens > maxTokens && modelData.contextWindow) {
        maxTokens = tokens
        contextLimit = modelData.contextWindow
      }
    }
  }

  const inputTokens = usage.input_tokens || 0
  const outputTokens = usage.output_tokens || 0
  const cacheReadTokens = usage.cache_read_input_tokens || 0
  const cacheCreationTokens = usage.cache_creation_input_tokens || 0
  const estimatedUsage = inputTokens + cacheReadTokens + cacheCreationTokens

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    totalCost: msg.total_cost_usd || 0,
    contextLimit,
    estimatedUsage,
    estimatedPercentage: contextLimit > 0 ? Math.min((estimatedUsage / contextLimit) * 100, 100) : 0,
    numTurns: msg.num_turns || 0,
    durationMs: msg.duration_ms || 0
  }
}

/**
 * Extract metrics from top-level message fields.
 * Used for new format where fields are extracted at storage time.
 */
function extractFromMessageFields(m: ConversationMessage): ContextMetrics | null {
  if (!m.inputTokens && !m.outputTokens) return null

  const inputTokens = m.inputTokens || 0
  const outputTokens = m.outputTokens || 0
  const cacheReadTokens = m.cacheReadTokens || 0
  const cacheCreationTokens = m.cacheCreationTokens || 0
  const contextLimit = m.contextWindow || DEFAULT_CONTEXT_WINDOW
  const estimatedUsage = inputTokens + cacheReadTokens + cacheCreationTokens

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    totalCost: m.costUsd || 0,
    contextLimit,
    estimatedUsage,
    estimatedPercentage: contextLimit > 0 ? Math.min((estimatedUsage / contextLimit) * 100, 100) : 0,
    numTurns: m.numTurns || 0,
    durationMs: m.durationMs || 0
  }
}

/**
 * Calculate context metrics from conversation messages.
 *
 * Finds the latest result message (type: 'system') and extracts token usage.
 * Supports both new format (top-level fields) and old format (nested claudeMessage).
 */
export function calculateContextMetrics(messages: ConversationMessage[]): ContextMetrics {
  // Search from end for the most recent system message with result data
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.type !== 'system') continue

    // Try new format first (top-level fields)
    const fromFields = extractFromMessageFields(m)
    if (fromFields) return fromFields

    // Fallback to old format (nested claudeMessage)
    const fromClaude = extractFromClaudeMessage(m.claudeMessage)
    if (fromClaude) return fromClaude
  }

  return EMPTY_METRICS
}
