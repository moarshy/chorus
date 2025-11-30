# Sprint 9: Implementation Plan - Context Usage Indicator

## Summary

Add context usage visibility with:
1. Compact badge in chat header showing estimated percentage
2. Enhanced details panel with full token breakdown
3. Warning states when approaching limits

## References

- **Feature Spec**: `specifications/9-context-indicator/feature.md`
- **GitHub Issue**: [NapthaAI/chorus#7](https://github.com/NapthaAI/chorus/issues/7)
- **SDK Limitation**: [anthropics/claude-agent-sdk-typescript#66](https://github.com/anthropics/claude-agent-sdk-typescript/issues/66)

## Implementation Overview

### Phase 1: Extract Cache Tokens from Messages

**Files Modified:**
- `chorus/src/main/services/agent-sdk-service.ts`
- `chorus/src/preload/index.d.ts`

**Changes:**

1. **Update ConversationMessage type** (`index.d.ts`):
```typescript
interface ConversationMessage {
  // ... existing fields
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number      // NEW
  cacheCreationTokens?: number  // NEW
  costUsd?: number
  durationMs?: number
  claudeMessage?: ClaudeCodeMessage
}
```

2. **Extract cache tokens** (`agent-sdk-service.ts`):
```typescript
const assistantMessage: ConversationMessage = {
  // ... existing fields
  inputTokens: currentAssistantMessage?.message?.usage?.input_tokens,
  outputTokens: currentAssistantMessage?.message?.usage?.output_tokens,
  cacheReadTokens: currentAssistantMessage?.message?.usage?.cache_read_input_tokens,
  cacheCreationTokens: currentAssistantMessage?.message?.usage?.cache_creation_input_tokens,
  // ...
}
```

### Phase 2: Add Model Context Limits

**Files Created:**
- `chorus/src/renderer/src/utils/context-limits.ts`

**Changes:**

```typescript
// Model context window limits (tokens)
export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  default: 200_000,
  opus: 200_000,
  sonnet: 1_000_000,  // Extended context variant
  haiku: 200_000
}

export function getContextLimit(model: string | undefined): number {
  return MODEL_CONTEXT_LIMITS[model || 'default'] || 200_000
}

export type ContextLevel = 'low' | 'medium' | 'high' | 'critical'

export function getContextLevel(percentage: number): ContextLevel {
  if (percentage >= 90) return 'critical'
  if (percentage >= 75) return 'high'
  if (percentage >= 50) return 'medium'
  return 'low'
}

export function getContextColor(level: ContextLevel): string {
  switch (level) {
    case 'critical': return 'text-red-400 bg-red-500/20'
    case 'high': return 'text-orange-400 bg-orange-500/20'
    case 'medium': return 'text-yellow-400 bg-yellow-500/20'
    case 'low': return 'text-green-400 bg-green-500/20'
  }
}
```

### Phase 3: Context Metrics Helper

**Files Modified:**
- `chorus/src/renderer/src/stores/chat-store.ts`

**Changes:**

Add helper function to calculate context metrics:

```typescript
interface ContextMetrics {
  inputTokens: number
  outputTokens: number
  totalTokens: number           // input + output
  cacheReadTokens: number
  cacheCreationTokens: number
  totalCost: number
  contextLimit: number
  estimatedUsage: number        // input tokens as proxy for context
  estimatedPercentage: number   // (estimatedUsage / contextLimit) * 100
}

// Helper function (not in store, can be in utils or component)
export function calculateContextMetrics(
  messages: ConversationMessage[],
  model: string | undefined
): ContextMetrics {
  let inputTokens = 0
  let outputTokens = 0
  let cacheReadTokens = 0
  let cacheCreationTokens = 0
  let totalCost = 0

  messages.forEach(m => {
    if (m.inputTokens) inputTokens += m.inputTokens
    if (m.outputTokens) outputTokens += m.outputTokens
    if (m.cacheReadTokens) cacheReadTokens += m.cacheReadTokens
    if (m.cacheCreationTokens) cacheCreationTokens += m.cacheCreationTokens
    if (m.costUsd) totalCost += m.costUsd
  })

  const contextLimit = getContextLimit(model)
  // Use input tokens as proxy for context usage
  // Note: This is cumulative and doesn't account for SDK compaction
  const estimatedUsage = inputTokens
  const estimatedPercentage = Math.min((estimatedUsage / contextLimit) * 100, 100)

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    totalCost,
    contextLimit,
    estimatedUsage,
    estimatedPercentage
  }
}
```

### Phase 4: Context Badge in Toolbar

**Files Modified:**
- `chorus/src/renderer/src/components/Chat/ConversationToolbar.tsx`

**Changes:**

1. Add ContextBadge component:

```typescript
import { calculateContextMetrics, getContextLevel, getContextColor } from '../../utils/context-limits'

const WarningIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

interface ContextBadgeProps {
  messages: ConversationMessage[]
  model: string | undefined
}

function ContextBadge({ messages, model }: ContextBadgeProps) {
  const metrics = useMemo(
    () => calculateContextMetrics(messages, model),
    [messages, model]
  )

  const level = getContextLevel(metrics.estimatedPercentage)
  const colorClass = getContextColor(level)
  const showWarning = level === 'high' || level === 'critical'

  const tooltip = `~${metrics.estimatedUsage.toLocaleString()} / ${metrics.contextLimit.toLocaleString()} tokens (estimated)\n` +
    `Total: ${metrics.totalTokens.toLocaleString()} tokens\n` +
    `Cache read: ${metrics.cacheReadTokens.toLocaleString()} (not counted)`

  return (
    <div
      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${colorClass}`}
      title={tooltip}
    >
      {showWarning && <WarningIcon />}
      <span>Context: ~{Math.round(metrics.estimatedPercentage)}%</span>
    </div>
  )
}
```

2. Add to toolbar layout (after Tools dropdown):

```typescript
{/* Context Badge */}
<ContextBadge messages={messages} model={settings?.model} />
```

### Phase 5: Enhanced Details Panel

**Files Modified:**
- `chorus/src/renderer/src/components/Chat/ConversationDetails.tsx`

**Changes:**

Replace `ContextMetricsSection` with enhanced version:

```typescript
function ContextMetricsSection({ messages, model }: { messages: ConversationMessage[], model?: string }) {
  const metrics = useMemo(
    () => calculateContextMetrics(messages, model),
    [messages, model]
  )

  const level = getContextLevel(metrics.estimatedPercentage)
  const progressColor = {
    low: 'bg-green-500',
    medium: 'bg-yellow-500',
    high: 'bg-orange-500',
    critical: 'bg-red-500'
  }[level]

  if (metrics.totalTokens === 0) {
    return (
      <div className="p-4 text-sm text-muted">
        No token metrics available yet
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Progress Bar */}
      <div>
        <div className="flex justify-between text-xs text-muted mb-1">
          <span>Estimated Context Usage</span>
          <span>~{Math.round(metrics.estimatedPercentage)}%</span>
        </div>
        <div className="h-2 bg-hover rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColor} transition-all`}
            style={{ width: `${Math.min(metrics.estimatedPercentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Token Breakdown */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Input tokens</span>
          <span className="text-primary font-mono">{metrics.inputTokens.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Output tokens</span>
          <span className="text-primary font-mono">{metrics.outputTokens.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Total tokens</span>
          <span className="text-primary font-mono font-semibold">{metrics.totalTokens.toLocaleString()}</span>
        </div>

        {/* Cache tokens */}
        {(metrics.cacheReadTokens > 0 || metrics.cacheCreationTokens > 0) && (
          <>
            <div className="border-t border-default my-2" />
            <div className="flex justify-between">
              <span className="text-muted">Cache read</span>
              <span className="text-green-400 font-mono">
                {metrics.cacheReadTokens.toLocaleString()}
                <span className="text-xs text-muted ml-1">(free)</span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Cache creation</span>
              <span className="text-primary font-mono">{metrics.cacheCreationTokens.toLocaleString()}</span>
            </div>
          </>
        )}

        {/* Context limit */}
        <div className="border-t border-default my-2" />
        <div className="flex justify-between">
          <span className="text-muted">Est. context</span>
          <span className="text-primary font-mono">
            {metrics.estimatedUsage.toLocaleString()} / {metrics.contextLimit.toLocaleString()}
          </span>
        </div>

        {/* Cost */}
        <div className="flex justify-between">
          <span className="text-muted">Total cost</span>
          <span className="text-primary font-mono">${metrics.totalCost.toFixed(4)}</span>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="text-xs text-muted bg-hover rounded p-2">
        <span className="text-secondary">Note:</span> Estimated from cumulative input tokens.
        Actual context may vary due to SDK management.
        <a
          href="https://github.com/anthropics/claude-agent-sdk-typescript/issues/66"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline ml-1"
        >
          Learn more
        </a>
      </div>
    </div>
  )
}
```

### Phase 6: Warning Banner (Optional)

**Files Modified:**
- `chorus/src/renderer/src/components/MainPane/ChatTab.tsx`

**Changes:**

Add warning banner when context is high:

```typescript
function ContextWarningBanner({ percentage, onDismiss }: { percentage: number, onDismiss: () => void }) {
  if (percentage < 75) return null

  const isCritical = percentage >= 90

  return (
    <div className={`px-4 py-2 flex items-center justify-between text-sm ${
      isCritical ? 'bg-red-500/20 text-red-300' : 'bg-orange-500/20 text-orange-300'
    }`}>
      <div className="flex items-center gap-2">
        <WarningIcon />
        <span>
          {isCritical
            ? `Context window ~${Math.round(percentage)}% full. Starting a new conversation recommended.`
            : `Context window ~${Math.round(percentage)}% full. Consider starting a new conversation soon.`
          }
        </span>
      </div>
      <button onClick={onDismiss} className="text-muted hover:text-white">
        <CloseIcon />
      </button>
    </div>
  )
}
```

## File Summary

### New Files
| File | Purpose |
|------|---------|
| `utils/context-limits.ts` | Model limits, level calculation, color helpers |

### Modified Files
| File | Changes |
|------|---------|
| `preload/index.d.ts` | Add `cacheReadTokens`, `cacheCreationTokens` to ConversationMessage |
| `agent-sdk-service.ts` | Extract cache tokens when saving messages |
| `ConversationToolbar.tsx` | Add ContextBadge component |
| `ConversationDetails.tsx` | Enhanced ContextMetricsSection with progress bar, full breakdown |
| `ChatTab.tsx` | Optional warning banner |

## Data Flow

```
Assistant message received
    ↓
agent-sdk-service.ts extracts all token fields:
  - input_tokens
  - output_tokens
  - cache_read_input_tokens
  - cache_creation_input_tokens
    ↓
Stored in ConversationMessage, persisted to JSONL
    ↓
Messages loaded in chat-store
    ↓
calculateContextMetrics() aggregates all messages:
  - Sum all token types
  - Calculate total tokens (input + output)
  - Get model context limit
  - Calculate estimated percentage
    ↓
ContextBadge displays in toolbar (compact)
ContextMetricsSection displays in details (full breakdown)
```

## Testing Checklist

### Token Extraction
- [ ] New messages capture cache_read_input_tokens
- [ ] New messages capture cache_creation_input_tokens
- [ ] Existing messages without cache tokens don't break (optional fields)

### Context Badge
- [ ] Shows ~percentage with tilde
- [ ] Green at 0-50%
- [ ] Yellow at 50-75%
- [ ] Orange with warning icon at 75-90%
- [ ] Red with warning icon at 90%+
- [ ] Tooltip shows full breakdown
- [ ] Updates after each assistant response

### Details Panel
- [ ] Progress bar shows correct percentage
- [ ] Progress bar color matches level
- [ ] All token types displayed
- [ ] Total tokens calculated correctly
- [ ] Cache read shows "(free)" indicator
- [ ] Context limit shown for selected model
- [ ] Cost displayed
- [ ] Disclaimer with link to SDK issue

### Model-Specific Limits
- [ ] Default model uses 200k
- [ ] Sonnet (1M) uses 1,000,000
- [ ] Changing model in settings updates percentage

### Warning Banner
- [ ] Appears at 75%+
- [ ] Different messaging at 90%+
- [ ] Can be dismissed
- [ ] Stays dismissed for that conversation

## Known Limitations

1. **Estimation only** - SDK doesn't expose actual context window state
2. **Cumulative counting** - We sum all input tokens but SDK may compact
3. **No compaction detection** - Can't know when SDK summarizes context
4. **Per-turn input tokens** - Each turn's input_tokens includes previous context, so our sum is an overestimate

## Future Improvements

1. Listen for `SDKCompactBoundaryMessage` to detect compaction
2. Track only the latest turn's input_tokens as current context size
3. Update when Anthropic resolves SDK issue #66 with official guidance
4. Add "New conversation" quick action button when context high
