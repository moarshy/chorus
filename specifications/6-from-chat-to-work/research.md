# Sprint 6: Details Panel - Research Document

## Overview

This document contains research findings for implementing a comprehensive "Details" tab in the chat sidebar, showing file changes, todo lists, tool call summaries, and context metrics.

---

## 1. Current Implementation Analysis

### Chat Sidebar Structure

**File:** `chorus/src/renderer/src/components/Chat/ChatSidebar.tsx`

The sidebar currently has two tabs:
- **Chats** - Shows `ConversationList` component
- **Details** - Shows placeholder: "Agent details coming soon"

```tsx
{chatSidebarTab === 'details' ? (
  <div className="flex items-center justify-center h-full text-muted text-sm">
    <div className="text-center px-4">
      <InfoIcon />
      <p className="mt-2">Agent details coming soon</p>
    </div>
  </div>
) : (
  <ConversationList />
)}
```

### Available Data in Chat Store

**File:** `chorus/src/renderer/src/stores/chat-store.ts`

The store already tracks:
- `messages: ConversationMessage[]` - Full message history
- `conversations: Conversation[]` - Conversation metadata
- `activeConversationId` - Current conversation

### Message Structure

**File:** `chorus/src/preload/index.d.ts`

Each `ConversationMessage` contains:
```typescript
interface ConversationMessage {
  uuid: string
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'error' | 'system'
  content: string | ContentBlock[]
  timestamp: string

  // Tool execution fields
  toolName?: string
  toolInput?: Record<string, unknown>
  toolUseId?: string
  isToolError?: boolean

  // Token/cost metadata
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
  durationMs?: number

  // Raw Claude message (preserved)
  claudeMessage?: ClaudeCodeMessage
}
```

---

## 2. Data Currently Captured

### Tool Calls

**Location:** `agent-sdk-service.ts:322-376`

Tool executions are tracked via:
1. **tool_use messages** (lines 325-340):
   - `toolName` - Name of the tool (e.g., "Read", "Write", "Bash")
   - `toolInput` - Input parameters as JSON
   - `toolUseId` - Unique ID to link with result

2. **tool_result messages** (lines 359-376):
   - `toolUseId` - Links to corresponding tool_use
   - `isToolError` - Boolean indicating success/failure
   - `content` - Tool output or error message

### Token Usage & Costs

**Location:** `agent-sdk-service.ts:413-416`

Captured from `ClaudeAssistantMessage.message.usage`:
- `inputTokens` - Input token count
- `outputTokens` - Output token count
- `costUsd` - Cost from `ClaudeResultMessage.total_cost_usd`
- `durationMs` - Duration from `ClaudeResultMessage.duration_ms`

### File Changes

**Location:** `agent-sdk-service.ts:229-253`

The `PostToolUse` hook already emits file changes:
```typescript
options.hooks = {
  PostToolUse: [{
    hooks: [async (input, _toolUseId, _options) => {
      if (input.hook_event_name === 'PostToolUse') {
        const filePath = input.tool_input?.file_path
        const toolName = input.tool_name
        if (filePath && (toolName === 'Write' || toolName === 'Edit')) {
          mainWindow.webContents.send('agent:file-changed', {
            conversationId,
            filePath,
            toolName
          })
        }
      }
      return { continue: true }
    }]
  }]
}
```

**Current Status:** Event is emitted but NOT consumed in renderer.

---

## 3. Data NOT Currently Captured

### TodoWrite Tool Calls

The `TodoWrite` tool is built into Claude Code for task tracking. When the agent creates/updates todos, it emits a `tool_use` block:

```json
{
  "type": "tool_use",
  "id": "toolu_01ABC123",
  "name": "TodoWrite",
  "input": {
    "todos": [
      {
        "content": "Fix the bug in user authentication",
        "status": "completed",
        "activeForm": "Fixing the bug in user authentication"
      },
      {
        "content": "Write unit tests",
        "status": "in_progress",
        "activeForm": "Writing unit tests"
      }
    ]
  }
}
```

**Key Insight:** TodoWrite sends the **complete todo list** each time (full replacement, not delta updates).

### Cache Token Metrics

Available in `ClaudeAssistantMessage.message.usage` but not stored:
- `cache_creation_input_tokens`
- `cache_read_input_tokens`

---

## 4. TodoWrite SDK Integration

### How It Works

From the Claude Agent SDK documentation:

1. **Automatic Triggering**: TodoWrite is invoked for:
   - Complex multi-step tasks (3+ steps)
   - User-provided lists of tasks
   - Non-trivial operations benefiting from progress tracking

2. **Message Format**: Arrives as `tool_use` block in assistant messages

3. **Data Schema**:
   ```typescript
   interface TodoItem {
     content: string          // Task description (imperative form)
     status: 'pending' | 'in_progress' | 'completed'
     activeForm: string       // Present continuous form (shown during execution)
   }
   ```

### Interception Pattern

```typescript
// In SDK stream processing (agent-sdk-service.ts)
for (const block of assistantMsg.message.content) {
  if (block.type === 'tool_use' && block.name === 'TodoWrite') {
    const todos = block.input.todos
    // 1. Persist to JSONL
    // 2. Send IPC event to renderer
    mainWindow.webContents.send('agent:todo-update', {
      conversationId,
      todos,
      timestamp: new Date().toISOString()
    })
  }
}
```

---

## 5. Existing Patterns to Follow

### IPC Event Pattern

**Preload Registration** (`preload/index.ts`):
```typescript
onStreamDelta: (callback: (event: AgentStreamDelta) => void) => {
  const handler = (_event: unknown, data: AgentStreamDelta) => callback(data)
  ipcRenderer.on('agent:stream-delta', handler)
  return () => ipcRenderer.removeListener('agent:stream-delta', handler)
}
```

**Store Consumption** (`chat-store.ts`):
```typescript
const unsubscribe = window.api.agent.onStreamDelta((event) => {
  if (event.conversationId === activeConversationId) {
    get().appendStreamDelta(event.delta)
  }
})
```

### State Management Pattern

Maps for per-conversation state:
```typescript
// Existing pattern
unreadCounts: Map<string, number>
agentStatuses: Map<string, AgentStatus>

// New (to add)
conversationTodos: Map<string, TodoItem[]>
conversationFiles: Map<string, FileChange[]>
```

---

## 6. UI Component Patterns

### Section Header Pattern

From existing components:
```tsx
<div className="flex items-center justify-between px-3 py-2 border-b border-default">
  <span className="text-sm font-medium text-secondary">Section Name</span>
  <span className="text-xs text-muted">Count</span>
</div>
```

### List Item Pattern

From `ConversationItem.tsx`:
```tsx
<div
  onClick={handleClick}
  className="px-3 py-2 cursor-pointer hover:bg-hover transition-colors"
>
  <div className="flex items-center gap-2">
    <Icon />
    <span className="truncate">{title}</span>
  </div>
</div>
```

### Status Indicator Pattern

From `AgentItem.tsx`:
```tsx
// Status dot
<span className={`w-2 h-2 rounded-full ${
  status === 'ready' ? 'bg-green-500' :
  status === 'busy' ? 'bg-yellow-500 animate-pulse' :
  'bg-red-500'
}`} />
```

---

## 7. Persistence Strategy

### JSONL Message Storage

Store todos and file changes as messages for session resumption:

**TodoWrite Message:**
```json
{
  "uuid": "...",
  "type": "tool_use",
  "content": "TodoWrite update",
  "timestamp": "2024-11-29T...",
  "toolName": "TodoWrite",
  "toolInput": { "todos": [...] }
}
```

**File Change Message:**
```json
{
  "uuid": "...",
  "type": "system",
  "content": "File edited: src/app.ts",
  "timestamp": "2024-11-29T...",
  "toolName": "Edit",
  "toolInput": { "file_path": "/path/to/src/app.ts" }
}
```

### Reconstruction on Load

When loading a conversation:
1. Filter messages for `toolName === 'TodoWrite'`
2. Take the **last** TodoWrite message (full replacement semantics)
3. Extract `toolInput.todos` array

For files:
1. Filter messages where `toolName === 'Write' || toolName === 'Edit'`
2. Deduplicate by file path (keep latest)

---

## 8. Related Files

| File | Purpose |
|------|---------|
| `chorus/src/main/services/agent-sdk-service.ts` | SDK stream processing, hooks |
| `chorus/src/preload/index.ts` | IPC event handlers |
| `chorus/src/preload/index.d.ts` | TypeScript type definitions |
| `chorus/src/renderer/src/stores/chat-store.ts` | Chat state management |
| `chorus/src/renderer/src/components/Chat/ChatSidebar.tsx` | Sidebar with Details tab |
| `chorus/src/renderer/src/components/Chat/ConversationList.tsx` | Existing conversation list |
| `chorus/src/renderer/src/components/Sidebar/AgentItem.tsx` | Status indicator pattern |

---

## 9. References

- [Claude Agent SDK - Todo Tracking](https://platform.claude.com/docs/en/agent-sdk/todo-tracking)
- [Claude Agent SDK - TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [GitHub: claude-agent-sdk-typescript](https://github.com/anthropics/claude-agent-sdk-typescript)
- [GitHub Issue #2250 - TodoWrite Full Replacement](https://github.com/anthropics/claude-code/issues/2250)
