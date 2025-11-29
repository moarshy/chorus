# Sprint 6: Details Panel - From Chat to Work

## Overview

Transform the placeholder "Details" tab in the chat sidebar into a comprehensive conversation details panel showing real-time information about the agent's work:

1. **Files Changed** - Files edited/written by the agent with clickable links
2. **Todo List** - Agent's task list with real-time status updates
3. **Tool Call Summary** - Success/failure counts for tool executions
4. **Context Metrics** - Token usage and costs

## User Stories

### US-1: View Files Changed by Agent
**As a** user working with a Claude agent
**I want to** see a list of files the agent has modified
**So that** I can quickly navigate to and review the changes

**Acceptance Criteria:**
- Files are listed in order of modification
- Each file shows the modification type (Write/Edit)
- Clicking a file opens it in the FileViewer
- Relative paths are shown (relative to repo root)
- List persists across app restarts (stored in JSONL)

### US-2: View Agent's Todo List
**As a** user tracking complex tasks
**I want to** see the agent's current task list
**So that** I can understand progress and what the agent is working on

**Acceptance Criteria:**
- Tasks show three states: pending, in_progress, completed
- Visual indicators: checkbox (pending), spinner (in_progress), checkmark (completed)
- In-progress tasks show the `activeForm` (present tense)
- Completed tasks show the `content` with strikethrough
- Progress summary shown in header (e.g., "3/7")
- List updates in real-time as agent works
- List persists across app restarts

### US-3: View Tool Call Summary
**As a** user monitoring agent behavior
**I want to** see a summary of tool calls
**So that** I can understand how the agent is working and spot issues

**Acceptance Criteria:**
- Shows total tool call count
- Shows successful count (green)
- Shows failed count (red, only if > 0)
- TodoWrite calls excluded from count (internal tool)
- Updates in real-time as conversation progresses

### US-4: View Context Metrics
**As a** user monitoring usage
**I want to** see token counts and costs
**So that** I can understand resource consumption

**Acceptance Criteria:**
- Shows total input tokens
- Shows total output tokens
- Shows total cost in USD (if available)
- Values formatted with thousands separators
- Updates after each agent response

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| File click action | Open in FileViewer | Keeps user in app context |
| Todo list editing | Read-only | Simplicity; agent owns the list |
| Persistence | Store in JSONL | Enables session resumption |
| Section order | Files → Todos → Tools → Context | Most actionable first |

## UI Layout

```
┌─────────────────────────────────────┐
│ [Chats] [Details]                   │  ← Tabs
├─────────────────────────────────────┤
│ 📁 Files Changed (3)                │  ← Section header
│ ────────────────────────────────────│
│ ✏️  src/app.ts          Edit        │
│ ➕  src/types.ts        Write       │
│ ✏️  tests/app.test.ts   Edit        │
├─────────────────────────────────────┤
│ ☑️  Tasks (3/5)                     │
│ ────────────────────────────────────│
│ ✓ Analyze codebase                  │  ← completed
│ ⟳ Implementing feature...           │  ← in_progress
│ ○ Write unit tests                  │  ← pending
│ ○ Run type checker                  │
│ ○ Update documentation              │
├─────────────────────────────────────┤
│ 🔧 Tool Calls (12)                  │
│ ────────────────────────────────────│
│ Total          12                   │
│ Successful     10                   │
│ Failed          2                   │
├─────────────────────────────────────┤
│ 📊 Context                          │
│ ────────────────────────────────────│
│ Input tokens    4,532               │
│ Output tokens   1,234               │
│ Cost            $0.0142             │
└─────────────────────────────────────┘
```

## Technical Requirements

### Data Capture

1. **TodoWrite Interception**
   - Intercept `tool_use` blocks with `name === 'TodoWrite'`
   - Extract `input.todos` array
   - Store as message in JSONL
   - Emit `agent:todo-update` IPC event

2. **File Change Tracking**
   - Use existing `PostToolUse` hook
   - Track `Write` and `Edit` tool calls
   - Store as system message in JSONL
   - Emit `agent:file-changed` IPC event

### State Management

1. **Per-Conversation State**
   - `conversationTodos: Map<string, TodoItem[]>`
   - `conversationFiles: Map<string, FileChange[]>`

2. **Reconstruction on Load**
   - Parse JSONL messages on conversation load
   - Extract last TodoWrite message for todos
   - Aggregate file change messages

### IPC Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `agent:todo-update` | Main → Renderer | `{ conversationId, todos[], timestamp }` |
| `agent:file-changed` | Main → Renderer | `{ conversationId, filePath, toolName }` |

## Out of Scope

- User editing of todo list
- Per-tool breakdown in tool summary
- Cache token metrics
- Time-series visualizations
- Export/share functionality
