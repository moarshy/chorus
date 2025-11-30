import type { ConversationMessage } from '../types'

// Default context window when not available from result message
const DEFAULT_CONTEXT_WINDOW = 200_000

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

export interface ContextMetrics {
  // From result message - cumulative for the turn
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  totalCost: number
  // Context usage from result message
  contextLimit: number
  estimatedUsage: number  // input + cache tokens = context used
  estimatedPercentage: number
  // Additional info from result
  numTurns: number
  durationMs: number
}

/**
 * Extract context metrics from the latest result message in the conversation.
 *
 * The result message (type: 'result') at the end of each Claude turn contains:
 * - usage: { input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens }
 * - modelUsage: { [model]: { contextWindow, inputTokens, outputTokens, ... } }
 * - num_turns, duration_ms, total_cost_usd
 *
 * This is the single source of truth for context metrics.
 */
export function calculateContextMetrics(messages: ConversationMessage[]): ContextMetrics {
  // Find the most recent system message with token data (result message)
  let latestResult: ConversationMessage | null = null

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    // Result messages are stored as 'system' type with token data
    if (m.type === 'system' && (m.inputTokens || m.outputTokens)) {
      latestResult = m
      break
    }
  }

  if (!latestResult) {
    return {
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
  }

  const inputTokens = latestResult.inputTokens || 0
  const outputTokens = latestResult.outputTokens || 0
  const cacheReadTokens = latestResult.cacheReadTokens || 0
  const cacheCreationTokens = latestResult.cacheCreationTokens || 0
  const totalCost = latestResult.costUsd || 0
  const numTurns = latestResult.numTurns || 0
  const durationMs = latestResult.durationMs || 0

  // Use contextWindow from result message, fallback to default
  const contextLimit = latestResult.contextWindow || DEFAULT_CONTEXT_WINDOW

  // Context usage = input tokens + cache read + cache creation
  // This represents total tokens in the context window for this turn
  const estimatedUsage = inputTokens + cacheReadTokens + cacheCreationTokens
  const estimatedPercentage = contextLimit > 0
    ? Math.min((estimatedUsage / contextLimit) * 100, 100)
    : 0

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    totalCost,
    contextLimit,
    estimatedUsage,
    estimatedPercentage,
    numTurns,
    durationMs
  }
}
