# Claude Code Message Format

This document describes the message format used by Claude Code when run with `--output-format stream-json`. Understanding this format is essential for Chorus to properly capture, store, and replay conversations.

## Overview

Claude Code outputs messages as newline-delimited JSON (JSONL) when using the `stream-json` output format:

```bash
claude --output-format stream-json -p "your prompt"
```

Each line is a complete JSON object representing a message event.

## Message Types

### 1. System Init Message

The first message in any session. Contains session metadata and configuration.

```json
{
  "type": "system",
  "subtype": "init",
  "session_id": "abc123-def456-...",
  "tools": ["Read", "Write", "Edit", "Bash", "Glob", "Grep", ...],
  "mcp_servers": [],
  "model": "claude-sonnet-4-20250514",
  "cwd": "/path/to/workspace",
  "permissionMode": "default"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"system"` | Message type identifier |
| `subtype` | `"init"` | System message subtype |
| `session_id` | `string` | Unique session ID for resumption |
| `tools` | `string[]` | Available tools for this session |
| `mcp_servers` | `string[]` | Connected MCP servers |
| `model` | `string` | Claude model being used |
| `cwd` | `string` | Current working directory |
| `permissionMode` | `string` | Permission mode (default, auto-accept, etc.) |

### 2. Assistant Messages

Claude's responses, which may contain multiple content blocks.

```json
{
  "type": "assistant",
  "message": {
    "id": "msg_01ABC...",
    "type": "message",
    "role": "assistant",
    "content": [
      {
        "type": "text",
        "text": "I'll help you with that. Let me first read the file..."
      },
      {
        "type": "tool_use",
        "id": "toolu_01XYZ...",
        "name": "Read",
        "input": {
          "file_path": "/path/to/file.ts"
        }
      }
    ],
    "model": "claude-sonnet-4-20250514",
    "stop_reason": "tool_use",
    "stop_sequence": null,
    "usage": {
      "input_tokens": 1234,
      "output_tokens": 567,
      "cache_creation_input_tokens": 0,
      "cache_read_input_tokens": 0
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"assistant"` | Message type identifier |
| `message.id` | `string` | Unique message ID from Anthropic API |
| `message.content` | `ContentBlock[]` | Array of content blocks |
| `message.model` | `string` | Model that generated this response |
| `message.stop_reason` | `string` | Why generation stopped (`end_turn`, `tool_use`, etc.) |
| `message.usage` | `object` | Token usage statistics |

### 3. User Messages

User input and tool results. These appear after tool executions.

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "tool_use_id": "toolu_01XYZ...",
        "content": "File contents here...",
        "is_error": false
      }
    ]
  }
}
```

For direct user input:

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "text",
        "text": "User's message here"
      }
    ]
  }
}
```

### 4. Result Message

The final message in a session, containing summary statistics.

```json
{
  "type": "result",
  "result": "Successfully completed the task...",
  "subtype": "success",
  "session_id": "abc123-def456-...",
  "total_cost_usd": 0.0234,
  "duration_ms": 45678,
  "duration_api_ms": 12345,
  "num_turns": 5,
  "is_error": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"result"` | Message type identifier |
| `result` | `string` | Final text result/summary |
| `subtype` | `string` | `"success"` or `"error"` |
| `session_id` | `string` | Session ID (for resumption) |
| `total_cost_usd` | `number` | Total API cost in USD |
| `duration_ms` | `number` | Total wall-clock time |
| `duration_api_ms` | `number` | Time spent in API calls |
| `num_turns` | `number` | Number of conversation turns |
| `is_error` | `boolean` | Whether session ended in error |

## Content Block Types

Content blocks appear in `message.content` arrays.

### Text Block

```json
{
  "type": "text",
  "text": "The actual text content..."
}
```

### Tool Use Block

```json
{
  "type": "tool_use",
  "id": "toolu_01ABC...",
  "name": "Read",
  "input": {
    "file_path": "/path/to/file"
  }
}
```

### Tool Result Block

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_01ABC...",
  "content": "Result of the tool execution...",
  "is_error": false
}
```

### Thinking Block (Extended Thinking)

When using models with extended thinking (like Claude Opus 4):

```json
{
  "type": "thinking",
  "thinking": "Let me analyze this problem step by step..."
}
```

### Image Block

For image inputs:

```json
{
  "type": "image",
  "source": {
    "type": "base64",
    "media_type": "image/png",
    "data": "base64-encoded-data..."
  }
}
```

## Session Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ Session Start                                                │
├─────────────────────────────────────────────────────────────┤
│ 1. system (init)     → Session ID, tools, model, cwd        │
├─────────────────────────────────────────────────────────────┤
│ 2. assistant         → Claude's response with content blocks│
│ 3. user              → Tool results or user input           │
│ ... (repeat 2-3)                                            │
├─────────────────────────────────────────────────────────────┤
│ N. result            → Final stats, cost, duration          │
└─────────────────────────────────────────────────────────────┘
```

## Session Resumption

To resume a session, use the `session_id` from the init or result message:

```bash
claude --resume abc123-def456-... -p "continue with..."
```

## Claude's Native Storage Format

Claude Code stores conversations in `~/.claude/projects/<project-hash>/` as JSONL files. Each message includes additional metadata:

```json
{
  "uuid": "unique-message-uuid",
  "parentUuid": "parent-message-uuid",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "type": "assistant",
  "message": { ... },
  "costUSD": 0.0123,
  "durationMs": 2345
}
```

## Chorus Storage Recommendations

### Message Storage Schema

For Chorus, we should store the complete Claude Code messages in JSONL format:

```typescript
interface StoredMessage {
  // Chorus metadata
  id: string;                    // UUID for this stored message
  conversationId: string;        // Links to conversation
  agentId: string;               // Which agent generated this
  timestamp: string;             // ISO timestamp

  // Original Claude Code message (preserved exactly)
  claudeMessage: SystemMessage | AssistantMessage | UserMessage | ResultMessage;

  // Derived data (for quick access)
  costUSD?: number;
  durationMs?: number;
}
```

### File Structure

```
.chorus/
├── config.json              # App settings, workspace list
└── conversations/
    └── {workspace-id}/
        └── {agent-id}/
            └── {conversation-id}.jsonl
```

### Benefits of Full Message Storage

1. **Complete History**: Retains all tool uses, results, and thinking
2. **Session Resumption**: Can resume conversations using stored session_id
3. **Cost Tracking**: Accurate cost per conversation from result messages
4. **Debugging**: Full visibility into what Claude did and why
5. **Replay**: Can reconstruct exact conversation flow

## TypeScript Types

```typescript
// Message types
type MessageType = 'system' | 'assistant' | 'user' | 'result';

interface SystemInitMessage {
  type: 'system';
  subtype: 'init';
  session_id: string;
  tools: string[];
  mcp_servers: string[];
  model: string;
  cwd: string;
  permissionMode: string;
}

interface AssistantMessage {
  type: 'assistant';
  message: {
    id: string;
    type: 'message';
    role: 'assistant';
    content: ContentBlock[];
    model: string;
    stop_reason: string;
    stop_sequence: string | null;
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
    };
  };
}

interface UserMessage {
  type: 'user';
  message: {
    role: 'user';
    content: ContentBlock[];
  };
}

interface ResultMessage {
  type: 'result';
  result: string;
  subtype: 'success' | 'error';
  session_id: string;
  total_cost_usd: number;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  is_error: boolean;
}

// Content block types
type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | ThinkingBlock | ImageBlock;

interface TextBlock {
  type: 'text';
  text: string;
}

interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error: boolean;
}

interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
}

interface ImageBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}
```

## References

- [Claude Code CLI Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Anthropic Messages API](https://docs.anthropic.com/en/api/messages)
- [Claude Agent SDK](https://github.com/anthropics/claude-code-sdk)
