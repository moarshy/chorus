# Cost Tracking

The Claude Agent SDK provides detailed token usage and cost information at both per-turn and session levels.

## Usage Locations

| Location | Scope | Use For |
|----------|-------|---------|
| `assistant.message.usage` | Per-turn | Context window tracking |
| `result.usage` | Aggregate | Session billing totals |
| `result.modelUsage` | Per-model | Multi-model cost breakdown |
| `result.total_cost_usd` | Session | **Authoritative total cost** |

---

## Per-Turn Usage

Each assistant message includes usage for that turn:

```typescript
for await (const message of stream) {
  if (message.type === 'assistant') {
    const usage = message.message.usage;

    console.log({
      input: usage.input_tokens,
      output: usage.output_tokens,
      cacheRead: usage.cache_read_input_tokens,
      cacheWrite: usage.cache_creation_input_tokens
    });
  }
}
```

### BetaUsage Fields

```typescript
interface BetaUsage {
  input_tokens: number;              // Tokens sent to model (uncached)
  output_tokens: number;             // Tokens generated
  cache_read_input_tokens?: number;  // Tokens read from cache
  cache_creation_input_tokens?: number;  // Tokens written to cache
}
```

---

## Session Totals (Result Message)

The result message contains aggregate statistics:

```typescript
for await (const message of stream) {
  if (message.type === 'result') {
    console.log('Session Statistics:');
    console.log('  Total Cost:', message.total_cost_usd);
    console.log('  Turns:', message.num_turns);
    console.log('  Duration:', message.duration_ms, 'ms');
    console.log('  API Time:', message.duration_api_ms, 'ms');

    console.log('Aggregate Usage:');
    console.log('  Input:', message.usage.input_tokens);
    console.log('  Output:', message.usage.output_tokens);
    console.log('  Cache Read:', message.usage.cache_read_input_tokens);
    console.log('  Cache Write:', message.usage.cache_creation_input_tokens);
  }
}
```

### Per-Model Breakdown

```typescript
if (message.type === 'result') {
  for (const [model, usage] of Object.entries(message.modelUsage)) {
    console.log(`Model: ${model}`);
    console.log(`  Input: ${usage.inputTokens}`);
    console.log(`  Output: ${usage.outputTokens}`);
    console.log(`  Cost: $${usage.costUSD}`);
    console.log(`  Context: ${usage.contextWindow}`);
  }
}
```

### ModelUsage Fields

```typescript
interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
  costUSD: number;
  contextWindow: number;
}
```

---

## Context Window Calculation

**Important:** Use per-turn usage (not result aggregate) for context window:

```typescript
// Context = input_tokens + cache_read + cache_creation
// (Output tokens don't count toward context)

function calculateContextUsage(usage: BetaUsage): number {
  return (
    usage.input_tokens +
    (usage.cache_read_input_tokens || 0) +
    (usage.cache_creation_input_tokens || 0)
  );
}

// Get from LAST assistant message
let lastUsage: BetaUsage;

for await (const message of stream) {
  if (message.type === 'assistant') {
    lastUsage = message.message.usage;
  }
}

const contextUsed = calculateContextUsage(lastUsage);
const contextLimit = 200000;  // Sonnet/Opus
const contextPercent = (contextUsed / contextLimit) * 100;
```

### Why Not Use Result Usage?

The result message's usage is **cumulative across all turns**:

```
Turn 1: 10,000 tokens
Turn 2: 15,000 tokens (includes turn 1 context)
Turn 3: 20,000 tokens (includes turn 1+2 context)

Result.usage.input_tokens = 10,000 + 15,000 + 20,000 = 45,000 (cumulative billing)
Last turn context = 20,000 (actual context window state)
```

---

## Context Window Limits

| Model | Context Window |
|-------|---------------|
| Claude Opus 4 | 200,000 tokens |
| Claude Sonnet 4 | 200,000 tokens |
| Claude Haiku 3.5 | 200,000 tokens |

---

## Pricing

### Current Pricing (Subject to Change)

**Claude Sonnet 4:**
| Token Type | Price per Million |
|------------|-------------------|
| Input | $3.00 |
| Output | $15.00 |
| Cache Read | $0.30 (90% discount) |
| Cache Write | $3.75 (25% premium) |

**Claude Opus 4:**
| Token Type | Price per Million |
|------------|-------------------|
| Input | $15.00 |
| Output | $75.00 |
| Cache Read | $1.50 (90% discount) |
| Cache Write | $18.75 (25% premium) |

**Claude Haiku 3.5:**
| Token Type | Price per Million |
|------------|-------------------|
| Input | $0.80 |
| Output | $4.00 |
| Cache Read | $0.08 (90% discount) |
| Cache Write | $1.00 (25% premium) |

### Cost Calculation

```typescript
const SONNET_PRICING = {
  inputPerMillion: 3.00,
  outputPerMillion: 15.00,
  cacheReadPerMillion: 0.30,
  cacheWritePerMillion: 3.75
};

function calculateCost(usage: BetaUsage): number {
  const input = (usage.input_tokens / 1_000_000) * SONNET_PRICING.inputPerMillion;
  const output = (usage.output_tokens / 1_000_000) * SONNET_PRICING.outputPerMillion;
  const cacheRead = ((usage.cache_read_input_tokens || 0) / 1_000_000) * SONNET_PRICING.cacheReadPerMillion;
  const cacheWrite = ((usage.cache_creation_input_tokens || 0) / 1_000_000) * SONNET_PRICING.cacheWritePerMillion;

  return input + output + cacheRead + cacheWrite;
}
```

**Note:** Always use `result.total_cost_usd` for authoritative cost. The SDK accounts for current pricing.

---

## Message ID Deduplication

Messages with the same `id` report identical usage. Track unique IDs to avoid double-counting:

```typescript
const processedIds = new Set<string>();
let totalTokens = 0;

for await (const message of stream) {
  if (message.type === 'assistant') {
    const msgId = message.message.id;

    if (!processedIds.has(msgId)) {
      processedIds.add(msgId);
      totalTokens += message.message.usage.input_tokens;
      totalTokens += message.message.usage.output_tokens;
    }
  }
}
```

---

## Chorus Implementation

### Metrics Display

```typescript
// chorus/src/renderer/src/components/Chat/ConversationDetails.tsx

function ContextMetrics({ conversationId }) {
  const messages = useConversationMessages(conversationId);
  const metrics = useMemo(() => calculateMetrics(messages), [messages]);

  return (
    <div className="metrics">
      <div className="metric">
        <span className="label">Context</span>
        <span className="value">{formatPercent(metrics.contextPercent)}%</span>
        <ProgressBar value={metrics.contextPercent} max={100} />
      </div>

      <div className="metric">
        <span className="label">Cost</span>
        <span className="value">${metrics.totalCost.toFixed(4)}</span>
      </div>

      <div className="metric">
        <span className="label">Tokens</span>
        <span className="value">
          {formatNumber(metrics.inputTokens)} in /
          {formatNumber(metrics.outputTokens)} out
        </span>
      </div>
    </div>
  );
}
```

### Metrics Calculation

```typescript
// chorus/src/renderer/src/utils/context-limits.ts

interface ConversationMetrics {
  contextUsed: number;
  contextLimit: number;
  contextPercent: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

function calculateMetrics(messages: StoredMessage[]): ConversationMetrics {
  // Find result message for authoritative totals
  const resultMsg = messages.find(m =>
    m.claudeMessage?.type === 'result'
  )?.claudeMessage;

  if (resultMsg?.type === 'result') {
    return {
      totalCost: resultMsg.total_cost_usd,
      inputTokens: resultMsg.usage.input_tokens,
      outputTokens: resultMsg.usage.output_tokens,
      cacheReadTokens: resultMsg.usage.cache_read_input_tokens,
      cacheWriteTokens: resultMsg.usage.cache_creation_input_tokens,
      contextUsed: 0,  // Calculate from last assistant
      contextLimit: 200000,
      contextPercent: 0
    };
  }

  // Find last assistant message for context window
  const lastAssistant = [...messages]
    .reverse()
    .find(m => m.claudeMessage?.type === 'assistant');

  if (lastAssistant?.claudeMessage?.type === 'assistant') {
    const usage = lastAssistant.claudeMessage.message.usage;
    const contextUsed = (
      usage.input_tokens +
      (usage.cache_read_input_tokens || 0) +
      (usage.cache_creation_input_tokens || 0)
    );
    const contextLimit = 200000;

    return {
      contextUsed,
      contextLimit,
      contextPercent: Math.min((contextUsed / contextLimit) * 100, 100),
      totalCost: 0,  // Not available until result
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadTokens: usage.cache_read_input_tokens || 0,
      cacheWriteTokens: usage.cache_creation_input_tokens || 0
    };
  }

  return {
    contextUsed: 0,
    contextLimit: 200000,
    contextPercent: 0,
    totalCost: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0
  };
}
```

### Cost Tracking Per Conversation

```typescript
// Store cost in conversation when result received

if (message.type === 'result') {
  await updateConversation(conversationId, {
    lastCost: message.total_cost_usd,
    totalCost: (conversation.totalCost || 0) + message.total_cost_usd,
    lastDuration: message.duration_ms
  });
}
```

---

## Budget Limits

Prevent runaway costs:

```typescript
const stream = query({
  prompt: "Complex task",
  options: {
    maxBudgetUsd: 1.00  // Stop if cost exceeds $1
  }
});

for await (const message of stream) {
  if (message.type === 'result' && message.subtype === 'error_max_budget_usd') {
    console.log('Budget limit reached');
  }
}
```

---

## Best Practices

### 1. Use result.total_cost_usd

Don't calculate cost manually; use the authoritative value:

```typescript
// Good
const cost = resultMessage.total_cost_usd;

// Less accurate
const cost = calculateCost(usage);  // May use outdated pricing
```

### 2. Track Context Per-Turn

Use last assistant message, not aggregate:

```typescript
// Good: Current context state
const context = lastAssistantMessage.message.usage;

// Wrong: Cumulative billing
const context = resultMessage.usage;  // Exceeds context limit!
```

### 3. Set Budget Limits

For automated systems:

```typescript
options: {
  maxBudgetUsd: 5.00,  // Safety limit
  maxTurns: 20         // Additional protection
}
```

### 4. Monitor Cache Efficiency

High `cache_read_input_tokens` = good caching:

```typescript
const cacheEfficiency = cacheReadTokens / (cacheReadTokens + inputTokens);
// Higher is better (more cache hits)
```

---

## References

- [Anthropic Pricing](https://www.anthropic.com/pricing)
- [Prompt Caching Documentation](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [SDK Cost Tracking](https://platform.claude.com/docs/en/agent-sdk/cost-tracking)
