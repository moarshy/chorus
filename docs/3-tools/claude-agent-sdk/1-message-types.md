# SDK Message Types

The Claude Agent SDK emits typed messages through an async generator. This document provides a complete reference for all message types.

## Message Type Hierarchy

```typescript
type SDKMessage =
  | SDKSystemMessage           // type: 'system', subtype: 'init'
  | SDKCompactBoundaryMessage  // type: 'system', subtype: 'compact_boundary'
  | SDKStatusMessage           // type: 'system', subtype: 'status'
  | SDKHookResponseMessage     // type: 'system', subtype: 'hook_response'
  | SDKAssistantMessage        // type: 'assistant'
  | SDKUserMessage             // type: 'user'
  | SDKUserMessageReplay       // type: 'user', isReplay: true
  | SDKResultMessage           // type: 'result'
  | SDKPartialAssistantMessage // type: 'stream_event'
  | SDKToolProgressMessage     // type: 'tool_progress'
  | SDKAuthStatusMessage;      // type: 'auth_status'
```

## Basic Usage

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

for await (const message of query({ prompt: "Hello" })) {
  switch (message.type) {
    case 'system':
      if (message.subtype === 'init') {
        console.log('Session:', message.session_id);
      }
      break;
    case 'assistant':
      console.log('Response:', message.message.content);
      break;
    case 'user':
      console.log('User/Tool result');
      break;
    case 'result':
      console.log('Cost:', message.total_cost_usd);
      break;
  }
}
```

---

## 1. System Init Message (`SDKSystemMessage`)

The first message emitted when a session starts. Contains session configuration.

### Structure

```typescript
interface SDKSystemMessage {
  type: 'system';
  subtype: 'init';
  uuid: UUID;
  session_id: string;

  // Session configuration
  model: string;
  cwd: string;
  permissionMode: PermissionMode;
  apiKeySource: ApiKeySource;
  claude_code_version: string;

  // Available capabilities
  tools: string[];
  mcp_servers: { name: string; status: string }[];
  slash_commands: string[];
  agents?: string[];
  skills: string[];
  plugins: { name: string; path: string }[];

  // Output configuration
  output_style: string;
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'system'` | Message type identifier |
| `subtype` | `'init'` | Always "init" for initialization |
| `uuid` | `UUID` | Unique message identifier |
| `session_id` | `string` | **Critical**: Store this to resume conversations later |
| `model` | `string` | Model being used (e.g., `claude-sonnet-4-20250514`) |
| `cwd` | `string` | Working directory for the session |
| `permissionMode` | `PermissionMode` | `'default'` \| `'acceptEdits'` \| `'bypassPermissions'` \| `'plan'` \| `'dontAsk'` |
| `apiKeySource` | `ApiKeySource` | `'user'` \| `'project'` \| `'org'` \| `'temporary'` |
| `claude_code_version` | `string` | SDK version |
| `tools` | `string[]` | Available tools: `['Read', 'Write', 'Edit', 'Bash', ...]` |
| `mcp_servers` | `array` | Connected MCP servers with status |
| `slash_commands` | `string[]` | Available slash commands |
| `agents` | `string[]` | Available agent types (optional) |
| `skills` | `string[]` | Available skills |
| `plugins` | `array` | Loaded plugins |
| `output_style` | `string` | Output formatting style |

### Example

```json
{
  "type": "system",
  "subtype": "init",
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "session_id": "abc123-def456-ghi789",
  "model": "claude-sonnet-4-20250514",
  "cwd": "/Users/dev/myproject",
  "permissionMode": "default",
  "apiKeySource": "user",
  "claude_code_version": "1.0.0",
  "tools": ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Task"],
  "mcp_servers": [{ "name": "filesystem", "status": "connected" }],
  "slash_commands": ["/help", "/clear", "/compact"],
  "skills": [],
  "plugins": [],
  "output_style": "streaming"
}
```

---

## 2. Assistant Message (`SDKAssistantMessage`)

Claude's response. Contains content blocks and **per-turn usage metrics**.

### Structure

```typescript
interface SDKAssistantMessage {
  type: 'assistant';
  uuid: UUID;
  session_id: string;
  parent_tool_use_id: string | null;
  error?: SDKAssistantMessageError;
  message: APIAssistantMessage;
}

interface APIAssistantMessage {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  content: ContentBlock[];
  stop_reason: string;
  stop_sequence: string | null;
  usage: BetaUsage;
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'assistant'` | Message type identifier |
| `uuid` | `UUID` | Unique message ID. Use for `resumeSessionAt` option. |
| `session_id` | `string` | Session this message belongs to |
| `parent_tool_use_id` | `string \| null` | If from subagent (Task tool), the parent tool call ID |
| `error` | `SDKAssistantMessageError` | Optional: `'authentication_failed'` \| `'billing_error'` \| `'rate_limit'` \| `'invalid_request'` \| `'server_error'` \| `'unknown'` |
| `message.id` | `string` | API message ID (e.g., `msg_01ABCdef...`) |
| `message.model` | `string` | Model that generated this response |
| `message.content` | `ContentBlock[]` | Array of text, tool_use, thinking blocks |
| `message.stop_reason` | `string` | `'end_turn'` \| `'tool_use'` \| `'max_tokens'` \| `'stop_sequence'` |
| `message.usage` | `BetaUsage` | **Per-turn token usage** |

### Usage Object

```typescript
interface BetaUsage {
  input_tokens: number;              // Tokens sent to model this turn
  output_tokens: number;             // Tokens generated this turn
  cache_read_input_tokens?: number;  // Tokens read from cache (90% cheaper)
  cache_creation_input_tokens?: number; // Tokens written to cache
}
```

### Content Block Types

```typescript
// Text content
interface TextBlock {
  type: 'text';
  text: string;
}

// Tool invocation
interface ToolUseBlock {
  type: 'tool_use';
  id: string;           // Match with tool_result
  name: string;         // 'Read', 'Write', 'Bash', etc.
  input: Record<string, unknown>;
}

// Extended thinking (opus models)
interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
}
```

### Example

```json
{
  "type": "assistant",
  "uuid": "660e8400-e29b-41d4-a716-446655440001",
  "session_id": "abc123-def456-ghi789",
  "parent_tool_use_id": null,
  "message": {
    "id": "msg_01XYZ123abc",
    "type": "message",
    "role": "assistant",
    "model": "claude-sonnet-4-20250514",
    "content": [
      { "type": "text", "text": "I'll read that file for you." },
      {
        "type": "tool_use",
        "id": "toolu_01ABC",
        "name": "Read",
        "input": { "file_path": "/src/index.ts" }
      }
    ],
    "stop_reason": "tool_use",
    "stop_sequence": null,
    "usage": {
      "input_tokens": 1523,
      "output_tokens": 87,
      "cache_read_input_tokens": 1200,
      "cache_creation_input_tokens": 0
    }
  }
}
```

---

## 3. User Message (`SDKUserMessage`)

User input or tool execution results.

### Structure

```typescript
interface SDKUserMessage {
  type: 'user';
  uuid?: UUID;
  session_id: string;
  parent_tool_use_id: string | null;
  isSynthetic?: boolean;
  tool_use_result?: unknown;
  message: APIUserMessage;
}

interface APIUserMessage {
  role: 'user';
  content: UserContentBlock[];
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'user'` | Message type identifier |
| `uuid` | `UUID` | Optional unique identifier |
| `session_id` | `string` | Session this message belongs to |
| `parent_tool_use_id` | `string \| null` | Parent tool ID if in subagent context |
| `isSynthetic` | `boolean` | `true` if system-generated (not from actual user) |
| `tool_use_result` | `unknown` | Parsed JSON result for easier display |
| `message.content` | `UserContentBlock[]` | Text or tool_result blocks |

### User Content Block Types

```typescript
// Direct user text
interface TextBlock {
  type: 'text';
  text: string;
}

// Tool execution result
interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;    // Matches tool_use block's id
  content: string;        // Result as string
  is_error: boolean;      // Whether tool execution failed
}

// Image input
interface ImageBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;   // 'image/png', 'image/jpeg'
    data: string;         // Base64-encoded
  };
}
```

### Examples

**User Text Input:**
```json
{
  "type": "user",
  "session_id": "abc123",
  "parent_tool_use_id": null,
  "message": {
    "role": "user",
    "content": [{ "type": "text", "text": "Read my package.json" }]
  }
}
```

**Tool Result:**
```json
{
  "type": "user",
  "uuid": "770e8400-...",
  "session_id": "abc123",
  "parent_tool_use_id": null,
  "isSynthetic": true,
  "tool_use_result": { "content": "{\"name\": \"my-app\"}" },
  "message": {
    "role": "user",
    "content": [{
      "type": "tool_result",
      "tool_use_id": "toolu_01ABC",
      "content": "{\"name\": \"my-app\"}",
      "is_error": false
    }]
  }
}
```

---

## 4. Result Message (`SDKResultMessage`)

The **final message** when a session completes. Contains aggregate statistics.

### Structure (Success)

```typescript
interface SDKResultMessageSuccess {
  type: 'result';
  subtype: 'success';
  uuid: UUID;
  session_id: string;

  // Final output
  result: string;
  structured_output?: unknown;

  // Statistics
  is_error: false;
  num_turns: number;
  duration_ms: number;
  duration_api_ms: number;

  // Cost and usage
  total_cost_usd: number;
  usage: NonNullableUsage;
  modelUsage: { [modelName: string]: ModelUsage };

  // Permission tracking
  permission_denials: SDKPermissionDenial[];
}
```

### Structure (Error)

```typescript
interface SDKResultMessageError {
  type: 'result';
  subtype: 'error_during_execution' | 'error_max_turns' | 'error_max_budget_usd' | 'error_max_structured_output_retries';
  uuid: UUID;
  session_id: string;

  is_error: true;
  errors: string[];

  // Statistics still provided
  num_turns: number;
  duration_ms: number;
  duration_api_ms: number;
  total_cost_usd: number;
  usage: NonNullableUsage;
  modelUsage: { [modelName: string]: ModelUsage };
  permission_denials: SDKPermissionDenial[];
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | `'result'` | Message type identifier |
| `subtype` | `string` | `'success'` or error type |
| `uuid` | `UUID` | Unique message identifier |
| `session_id` | `string` | Session ID |
| `result` | `string` | Final text output (success only) |
| `structured_output` | `unknown` | Parsed JSON if using `outputFormat` |
| `is_error` | `boolean` | `false` for success, `true` for errors |
| `errors` | `string[]` | Error messages (error subtypes only) |
| `num_turns` | `number` | Total conversation turns |
| `duration_ms` | `number` | Total wall-clock time |
| `duration_api_ms` | `number` | Time in API calls |
| `total_cost_usd` | `number` | **Total session cost in USD** |
| `usage` | `NonNullableUsage` | **Aggregate token counts** |
| `modelUsage` | `object` | **Per-model breakdown** |
| `permission_denials` | `array` | Tools that were denied |

### Aggregate Usage

```typescript
interface NonNullableUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}
```

### Per-Model Usage

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

### Example (Success)

```json
{
  "type": "result",
  "subtype": "success",
  "uuid": "880e8400-...",
  "session_id": "abc123",
  "result": "Updated package.json successfully.",
  "is_error": false,
  "num_turns": 3,
  "duration_ms": 12456,
  "duration_api_ms": 8234,
  "total_cost_usd": 0.0156,
  "usage": {
    "input_tokens": 4521,
    "output_tokens": 892,
    "cache_read_input_tokens": 3200,
    "cache_creation_input_tokens": 500
  },
  "modelUsage": {
    "claude-sonnet-4-20250514": {
      "inputTokens": 4521,
      "outputTokens": 892,
      "cacheReadInputTokens": 3200,
      "cacheCreationInputTokens": 500,
      "webSearchRequests": 0,
      "costUSD": 0.0156,
      "contextWindow": 200000
    }
  },
  "permission_denials": []
}
```

---

## 5. Stream Event (`SDKPartialAssistantMessage`)

Partial streaming chunks. Only emitted when `includePartialMessages: true`.

### Structure

```typescript
interface SDKPartialAssistantMessage {
  type: 'stream_event';
  uuid: UUID;
  session_id: string;
  parent_tool_use_id: string | null;
  event: RawMessageStreamEvent;
}
```

### Stream Event Types

| Event Type | Description |
|------------|-------------|
| `message_start` | Beginning of new message |
| `content_block_start` | Start of content block |
| `content_block_delta` | Incremental content (text chunks) |
| `content_block_stop` | End of content block |
| `message_delta` | Message-level updates |
| `message_stop` | End of message |

### Example

```json
{
  "type": "stream_event",
  "uuid": "aa0e8400-...",
  "session_id": "abc123",
  "parent_tool_use_id": null,
  "event": {
    "type": "content_block_delta",
    "index": 0,
    "delta": { "type": "text_delta", "text": "I'll help " }
  }
}
```

---

## 6. Tool Progress Message (`SDKToolProgressMessage`)

Progress updates for long-running tools.

### Structure

```typescript
interface SDKToolProgressMessage {
  type: 'tool_progress';
  uuid: UUID;
  session_id: string;
  tool_use_id: string;
  tool_name: string;
  parent_tool_use_id: string | null;
  elapsed_time_seconds: number;
}
```

### Example

```json
{
  "type": "tool_progress",
  "uuid": "bb0e8400-...",
  "session_id": "abc123",
  "tool_use_id": "toolu_01DEF",
  "tool_name": "Bash",
  "parent_tool_use_id": null,
  "elapsed_time_seconds": 15.5
}
```

---

## 7. Other System Messages

### Compact Boundary

Marks when context was compacted (summarized).

```typescript
interface SDKCompactBoundaryMessage {
  type: 'system';
  subtype: 'compact_boundary';
  uuid: UUID;
  session_id: string;
  compact_metadata: {
    trigger: 'manual' | 'auto';
    pre_tokens: number;
  };
}
```

### Status Update

```typescript
interface SDKStatusMessage {
  type: 'system';
  subtype: 'status';
  uuid: UUID;
  session_id: string;
  status: 'compacting' | null;
}
```

### Hook Response

```typescript
interface SDKHookResponseMessage {
  type: 'system';
  subtype: 'hook_response';
  uuid: UUID;
  session_id: string;
  hook_name: string;
  hook_event: string;
  stdout: string;
  stderr: string;
  exit_code?: number;
}
```

---

## 8. Auth Status Message (`SDKAuthStatusMessage`)

Authentication state changes.

```typescript
interface SDKAuthStatusMessage {
  type: 'auth_status';
  uuid: UUID;
  session_id: string;
  isAuthenticating: boolean;
  output: string[];
  error?: string;
}
```

---

## TypeScript Type Guards

```typescript
import type {
  SDKMessage,
  SDKSystemMessage,
  SDKAssistantMessage,
  SDKUserMessage,
  SDKResultMessage,
  SDKPartialAssistantMessage
} from '@anthropic-ai/claude-agent-sdk';

function isSystemInit(msg: SDKMessage): msg is SDKSystemMessage {
  return msg.type === 'system' && 'subtype' in msg && msg.subtype === 'init';
}

function isAssistant(msg: SDKMessage): msg is SDKAssistantMessage {
  return msg.type === 'assistant';
}

function isUser(msg: SDKMessage): msg is SDKUserMessage {
  return msg.type === 'user';
}

function isResult(msg: SDKMessage): msg is SDKResultMessage {
  return msg.type === 'result';
}

function isSuccess(msg: SDKResultMessage): boolean {
  return msg.subtype === 'success';
}

function isStreamEvent(msg: SDKMessage): msg is SDKPartialAssistantMessage {
  return msg.type === 'stream_event';
}
```

---

## Message Flow Examples

### Simple Question/Answer

```
1. system (init)      → Session starts, get session_id
2. assistant          → Claude's response
3. result (success)   → Final stats and cost
```

### With Tool Use

```
1. system (init)      → Session starts
2. assistant          → "I'll read that file" + tool_use(Read)
3. user               → tool_result with file contents
4. assistant          → "Here's what I found..."
5. result (success)   → Final stats
```

### Multi-Turn with Subagent

```
1. system (init)      → Session starts
2. assistant          → tool_use(Task) for subagent
3. tool_progress      → Task running (5s)
4. tool_progress      → Task running (10s)
5. user               → tool_result from subagent
6. assistant          → "Based on my search..."
7. result (success)   → Final stats (includes subagent costs)
```

---

## Chorus Implementation

### Message Storage

Chorus stores messages in JSONL format with the raw SDK message preserved:

```typescript
// chorus/src/main/services/conversation-service.ts

interface StoredMessage {
  id: string;                    // UUID
  conversationId: string;        // Links to conversation
  agentId: string;               // Which agent
  timestamp: string;             // ISO timestamp
  claudeMessage: SDKMessage;     // Original SDK message preserved
  costUSD?: number;
  durationMs?: number;
}
```

**File Location:** `~/.chorus/sessions/{workspaceId}/{agentId}/{conversationId}-messages.jsonl`

### Session ID Sync

The renderer must sync session ID from backend after first message:

```typescript
// Main process emits
mainWindow.webContents.send('agent:session-update', {
  conversationId,
  sessionId: message.session_id,
  sessionCreatedAt: new Date().toISOString()
});

// Renderer listens
window.api.agent.onSessionUpdate((event) => {
  updateConversation(event.conversationId, {
    sessionId: event.sessionId,
    sessionCreatedAt: event.sessionCreatedAt
  });
});
```

---

## References

- [Claude Agent SDK Types](https://github.com/anthropics/claude-code-sdk)
- [Anthropic Messages API](https://docs.anthropic.com/en/api/messages)
- [Streaming Documentation](https://docs.anthropic.com/en/api/messages-streaming)
