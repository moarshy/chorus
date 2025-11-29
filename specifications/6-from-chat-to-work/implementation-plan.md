# Sprint 6: Implementation Plan - Details Panel

## Overview

This document describes the implementation completed for the Details Panel feature, transforming the placeholder "Details" tab into a comprehensive conversation details panel.

## Implementation Summary

### Phase 1: Backend - TodoWrite Interception ✅

**File: `chorus/src/main/services/agent-sdk-service.ts`**

1. Added TodoWrite interception in the message stream processing loop
2. When `tool_use` block has `name === 'TodoWrite'`:
   - Extract `input.todos` array
   - Persist as a message in JSONL for session resumption
   - Emit `agent:todo-update` IPC event to renderer
   - Skip normal tool_use handling (TodoWrite is internal)

```typescript
// Key code pattern (lines 325-357)
if (toolBlock.name === 'TodoWrite') {
  const todoInput = toolBlock.input as { todos?: TodoItem[] }
  if (todoInput.todos) {
    // Persist and emit
    mainWindow.webContents.send('agent:todo-update', {
      conversationId,
      todos: todoInput.todos,
      timestamp: new Date().toISOString()
    })
  }
  continue // Skip normal handling
}
```

### Phase 2: Backend - File Change Tracking ✅

**File: `chorus/src/main/services/agent-sdk-service.ts`**

1. Enhanced existing `PostToolUse` hook
2. When `Write` or `Edit` tool completes:
   - Extract file path from tool input
   - Persist as system message in JSONL
   - Emit `agent:file-changed` IPC event

```typescript
// Key code pattern (lines 240-257)
if (filePath && (toolName === 'Write' || toolName === 'Edit')) {
  const fileChangeMessage: ConversationMessage = {
    uuid: uuidv4(),
    type: 'system',
    content: `File ${toolName.toLowerCase()}d: ${filePath}`,
    timestamp: new Date().toISOString(),
    toolName: toolName,
    toolInput: { file_path: filePath }
  }
  appendMessage(conversationId, fileChangeMessage)
  mainWindow.webContents.send('agent:file-changed', {
    conversationId,
    filePath,
    toolName
  })
}
```

### Phase 3: IPC Layer ✅

**File: `chorus/src/preload/index.d.ts`**

Added type definitions:
- `TodoItem` interface with `content`, `status`, `activeForm`
- `TodoUpdateEvent` interface
- `FileChange` interface
- Extended `AgentAPI` with `onTodoUpdate` and `onFileChanged`

**File: `chorus/src/preload/index.ts`**

Added IPC handlers:
- `onTodoUpdate` - listens for `agent:todo-update` events
- `onFileChanged` - listens for `agent:file-changed` events

### Phase 4: State Management ✅

**File: `chorus/src/renderer/src/stores/chat-store.ts`**

1. Added state fields:
   - `conversationTodos: Map<string, TodoItem[]>`
   - `conversationFiles: Map<string, FileChange[]>`

2. Added actions:
   - `updateTodos(conversationId, todos)` - replaces todo list
   - `addFileChange(conversationId, change)` - appends file change
   - `getTodos(conversationId)` - retrieves todos
   - `getFileChanges(conversationId)` - retrieves files

3. Added event listeners in `initEventListeners()`:
   - Subscribe to `onTodoUpdate` and `onFileChanged`

4. Added reconstruction logic in `selectConversation()`:
   - Parse JSONL messages on load
   - Find last TodoWrite message for todos
   - Aggregate file change messages

### Phase 5: UI Components ✅

**File: `chorus/src/renderer/src/components/Chat/ConversationDetails.tsx`**

Created new component with four sections:

1. **FilesChangedSection**
   - Lists files with Write/Edit icons
   - Shows relative paths (relative to repo root)
   - Clickable to open in FileViewer via `selectFile()`

2. **TodoListSection**
   - Shows task count as "completed/total"
   - Three states: pending (circle), in_progress (spinner), completed (checkmark)
   - In-progress shows `activeForm`, completed shows `content` with strikethrough

3. **ToolSummarySection**
   - Counts tool_use messages (excludes TodoWrite)
   - Shows total, successful (green), failed (red if > 0)

4. **ContextMetricsSection**
   - Aggregates `inputTokens`, `outputTokens`, `costUsd` from messages
   - Formats with thousands separators
   - Shows cost with 4 decimal places

**File: `chorus/src/renderer/src/components/Chat/ChatSidebar.tsx`**

- Imports and renders `ConversationDetails` in Details tab
- Passes `conversationId` and `repoPath` props

**File: `chorus/src/renderer/src/components/Chat/ChatView.tsx`**

- Passes `repoPath={workspace.path}` to ChatSidebar

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent SDK Service                         │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ TodoWrite       │    │ PostToolUse     │                     │
│  │ Interception    │    │ Hook            │                     │
│  └────────┬────────┘    └────────┬────────┘                     │
│           │                      │                               │
│           ▼                      ▼                               │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ Persist JSONL   │    │ Persist JSONL   │                     │
│  │ + IPC Event     │    │ + IPC Event     │                     │
│  └────────┬────────┘    └────────┬────────┘                     │
└───────────┼──────────────────────┼──────────────────────────────┘
            │                      │
            ▼                      ▼
┌───────────────────────────────────────────────────────────────────┐
│                         Preload Bridge                            │
│  onTodoUpdate()                  onFileChanged()                  │
└───────────────────────────────────────────────────────────────────┘
            │                      │
            ▼                      ▼
┌───────────────────────────────────────────────────────────────────┐
│                          Chat Store                               │
│  ┌─────────────────┐    ┌─────────────────┐                      │
│  │ conversationTodos│    │ conversationFiles│                     │
│  │ Map<id, Todo[]> │    │ Map<id, File[]> │                      │
│  └────────┬────────┘    └────────┬────────┘                      │
└───────────┼──────────────────────┼───────────────────────────────┘
            │                      │
            ▼                      ▼
┌───────────────────────────────────────────────────────────────────┐
│                    ConversationDetails Component                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐    │
│  │Files       │ │Todos       │ │Tool Calls  │ │Context     │    │
│  │Section     │ │Section     │ │Section     │ │Section     │    │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘    │
└───────────────────────────────────────────────────────────────────┘
```

## Session Resumption

When a conversation is loaded:

1. `selectConversation()` is called
2. Messages are already loaded from JSONL
3. Reconstruction logic scans messages:
   - Find last `tool_use` message with `toolName === 'TodoWrite'`
   - Extract `toolInput.todos` as current todo state
   - Filter messages with `type === 'system'` and `toolName in ['Write', 'Edit']`
   - Build file changes list from `toolInput.file_path`

## Testing Checklist

- [ ] New conversation shows empty sections
- [ ] TodoWrite updates appear in real-time
- [ ] In-progress task shows spinner and activeForm text
- [ ] Completed tasks show strikethrough
- [ ] File changes appear after Write/Edit tools
- [ ] File clicks open in FileViewer
- [ ] Tool call counts exclude TodoWrite
- [ ] Failed tool calls show in red
- [ ] Token metrics aggregate correctly
- [ ] Cost displays with 4 decimal places
- [ ] Session reload reconstructs todos and files
- [ ] Switching conversations shows correct data

## Known Limitations

1. **TodoWrite Full Replacement**: The SDK sends the entire todo list on each update, not deltas. This is handled correctly but means we can't track individual task history.

2. **File Deduplication**: If the same file is edited multiple times, it appears multiple times in the list. Consider deduplicating by path in a future enhancement.

3. **No Cache Metrics**: The current implementation doesn't track cache_read_input_tokens separately. This could be added by parsing the usage field more granularly.

4. **Cost Calculation**: Cost is only shown if the messages include `costUsd`. The SDK may not always provide this field.
