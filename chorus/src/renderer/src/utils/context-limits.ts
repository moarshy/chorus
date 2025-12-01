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
  // Token breakdown from the LAST message (current context window state)
  inputTokens: number           // Tokens after last cache breakpoint (uncached)
  outputTokens: number          // Claude's response tokens
  cacheReadTokens: number       // Tokens retrieved from cache
  cacheCreationTokens: number   // Tokens written to cache
  // Context window calculation
  // Context = input_tokens + cache_read_input_tokens + cache_creation_input_tokens
  // (output_tokens are NOT included - they're Claude's response, not context sent to Claude)
  contextUsed: number           // Total tokens in context window
  contextLimit: number          // Max context window (e.g., 200,000)
  contextPercentage: number     // contextUsed / contextLimit * 100
  // Session info (from result message - cumulative)
  totalCost: number
  numTurns: number
  durationMs: number
}

const EMPTY_METRICS: ContextMetrics = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  contextUsed: 0,
  contextLimit: DEFAULT_CONTEXT_WINDOW,
  contextPercentage: 0,
  totalCost: 0,
  numTurns: 0,
  durationMs: 0
}

// ============================================
// Types for parsing SDK messages
// ============================================

interface UsageData {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

interface ClaudeResultMessage {
  type: 'result'
  num_turns?: number
  duration_ms?: number
  total_cost_usd?: number
  usage?: UsageData
}

// ============================================
// Metric Extraction
// ============================================

/**
 * Extract context usage from the last assistant/tool_use message.
 *
 * IMPORTANT: This gives us the CURRENT context window state, not cumulative billing tokens.
 * The result message contains CUMULATIVE usage across all turns, which can exceed context limit.
 * The per-message usage shows actual context consumed for that turn.
 */
function extractContextFromLastMessage(messages: ConversationMessage[]): ContextMetrics | null {
  // Search from end for the most recent assistant or tool_use message with usage data
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.type !== 'assistant' && m.type !== 'tool_use') continue

    // Check for usage in claudeMessage.message.usage (SDK format)
    const claudeMsg = m.claudeMessage as { message?: { usage?: UsageData } } | undefined
    const usage = claudeMsg?.message?.usage
    if (!usage) continue

    const inputTokens = usage.input_tokens || 0
    const outputTokens = usage.output_tokens || 0
    const cacheReadTokens = usage.cache_read_input_tokens || 0
    const cacheCreationTokens = usage.cache_creation_input_tokens || 0

    // Context = input_tokens + cache_read_input_tokens + cache_creation_input_tokens
    const contextUsed = inputTokens + cacheReadTokens + cacheCreationTokens
    const contextLimit = DEFAULT_CONTEXT_WINDOW

    const contextPercentage = contextLimit > 0
      ? Math.min((contextUsed / contextLimit) * 100, 100)
      : 0

    return {
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      contextUsed,
      contextLimit,
      contextPercentage,
      totalCost: 0,
      numTurns: 0,
      durationMs: 0
    }
  }

  return null
}

/**
 * Extract session stats (cost, turns, duration, output tokens) from result message.
 * These are cumulative stats for billing/analytics, not context calculation.
 *
 * NOTE: Output tokens must come from the result message, not assistant messages.
 * Assistant message usage may show partial/streaming counts that don't reflect
 * the actual total output tokens generated.
 */
function extractSessionStats(messages: ConversationMessage[]): {
  totalCost: number
  numTurns: number
  durationMs: number
  outputTokens: number
} {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.type !== 'system') continue

    // Check top-level fields first (new format)
    if (m.costUsd !== undefined || m.numTurns !== undefined) {
      // Get output tokens from claudeMessage.usage (result message)
      const claudeMsg = m.claudeMessage as ClaudeResultMessage | undefined
      return {
        totalCost: m.costUsd || 0,
        numTurns: m.numTurns || 0,
        durationMs: m.durationMs || 0,
        outputTokens: claudeMsg?.usage?.output_tokens || m.outputTokens || 0
      }
    }

    // Fallback to claudeMessage (old format)
    const claudeMsg = m.claudeMessage as ClaudeResultMessage | undefined
    if (claudeMsg?.type === 'result') {
      return {
        totalCost: claudeMsg.total_cost_usd || 0,
        numTurns: claudeMsg.num_turns || 0,
        durationMs: claudeMsg.duration_ms || 0,
        outputTokens: claudeMsg.usage?.output_tokens || 0
      }
    }
  }

  return { totalCost: 0, numTurns: 0, durationMs: 0, outputTokens: 0 }
}

/**
 * Calculate context metrics from conversation messages.
 *
 * IMPORTANT: Context usage (input tokens, cache) comes from the LAST assistant/tool_use
 * message, not from the result message. The result message contains CUMULATIVE billing
 * tokens across all turns, which can exceed the context limit. The per-message
 * usage shows the actual context window state for that turn.
 *
 * However, OUTPUT tokens must come from the result message, as assistant message
 * usage may show partial/streaming counts that don't reflect actual totals.
 */
export function calculateContextMetrics(messages: ConversationMessage[]): ContextMetrics {
  // Get current context usage from last assistant/tool_use message
  const contextMetrics = extractContextFromLastMessage(messages)

  // Get session stats from result message (for cost/turns/duration/output tokens)
  const sessionStats = extractSessionStats(messages)

  if (contextMetrics) {
    return {
      ...contextMetrics,
      // Output tokens from result message (not assistant message)
      outputTokens: sessionStats.outputTokens || contextMetrics.outputTokens,
      totalCost: sessionStats.totalCost,
      numTurns: sessionStats.numTurns,
      durationMs: sessionStats.durationMs
    }
  }

  return EMPTY_METRICS
}
