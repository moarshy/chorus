# Conversations (Agent Sessions)

Conversations are chat sessions between a user and an agent. They support message streaming, session resumption, and rich content rendering.

---

## Overview

| Aspect | Description |
|--------|-------------|
| What | A chat session with a Claude Code agent |
| Why | Interact with agents, track work, resume context |
| Where | MainPane → Chat tabs |

---

## Features

### 1. Chat Interface ✅

Real-time messaging with Claude Code agents.

#### Message Streaming ✅
- Messages stream in real-time as agent responds
- Visual indicator shows agent is "thinking"
- Can interrupt streaming with Escape key

#### Markdown Rendering ✅
- Full GitHub-flavored markdown support
- Headers, lists, tables, blockquotes
- Inline formatting (bold, italic, code)

**Implementation:** `react-markdown` + `remark-gfm`

#### Code Syntax Highlighting ✅
- Language-aware highlighting
- Copy-to-clipboard button
- Line numbers for long blocks

**Supported Languages:** TypeScript, JavaScript, Python, Rust, Go, and 50+ more

**Implementation:** `prism-react-renderer`

#### Mermaid Diagrams ✅
- Renders flowcharts, sequence diagrams, etc.
- Auto-detected from ```mermaid code blocks
- Lazy-loaded for performance

**Implementation:** `mermaid` (dynamic import)

#### Tool Calls Grouping ✅
- Consecutive tool calls grouped into collapsible sections
- Shows tool name + input preview
- Expandable to see full input/output
- Success/failure indicators

---

### 2. Session Management ✅

Persistent sessions that can be resumed.

#### Session Resumption ✅
- Sessions persist across app restarts
- Uses SDK's `options.resume` with session ID
- Session ID captured from `system.init` message

**Session Lifecycle:**
```
New conversation → SDK creates session → sessionId stored
App restart → Load conversation → Resume with sessionId
```

**Expiry:** Sessions expire after ~25 days

#### Session Persistence ✅
- Messages stored in JSONL format
- Location: `~/.chorus/sessions/{workspaceId}/{agentId}/`
- Index: `conversations.json`
- Messages: `{conversationId}-messages.jsonl`

**JSONL Benefits:**
- Append-only (fast writes)
- Stream-friendly (process line by line)
- Preserves raw Claude messages for debugging

#### Context Tracking ✅
- Tracks cumulative input/output tokens
- Calculates context usage percentage
- Visual badge in toolbar (color-coded)

**Context Limits:**
| Model | Limit |
|-------|-------|
| Sonnet 4.5 | 200,000 tokens |
| Opus 4.5 | 200,000 tokens |
| Sonnet Extended | 1,000,000 tokens |

**Colors:**
- Green: 0-50%
- Yellow: 50-75%
- Orange: 75-90%
- Red: 90%+

---

### 3. Input Features ✅

Enhanced message input capabilities.

#### @ File Mentions ✅
- Type `@` to trigger file autocomplete
- Fuzzy search across workspace files
- Keyboard navigation (↑/↓/Enter/Escape)
- Inserts relative path: `@src/components/App.tsx`

**How it works:**
1. User types `@`
2. Dropdown appears with file list
3. Typing filters results (fuzzy search)
4. Selection inserts `@path/to/file`
5. Claude Code processes @ references natively

#### / Slash Commands ✅
- Type `/` to trigger command autocomplete
- Commands from `.claude/commands/` directory
- YAML frontmatter for metadata

**Command File Format:**
```markdown
---
description: Review code for issues
allowed-tools: [Read, Grep]
argument-hint: <file-path>
---

Review the following code and identify:
- Potential bugs
- Performance issues
- Security concerns

File: $ARGUMENTS
```

**Argument Substitution:**
- `$ARGUMENTS` - All arguments as string
- `$1`, `$2`, etc. - Positional arguments

---

### 4. Per-Conversation Settings ✅

Customize behavior per conversation.

| Setting | Options | Description |
|---------|---------|-------------|
| Permission Mode | default, acceptEdits, plan, bypassPermissions | How tool calls are approved |
| Allowed Tools | Bash, Edit, Write, WebFetch, WebSearch, NotebookEdit | Which tools can be used |
| Model | Sonnet 4.5, Opus 4.5, Extended Thinking | AI model to use |

**Permission Modes:**
- `default` - Prompt for each tool (safest)
- `acceptEdits` - Auto-approve file edits
- `plan` - Read-only mode (no writes)
- `bypassPermissions` - Skip all prompts (dangerous)

**Settings Hierarchy:**
```
Global Defaults → Workspace Defaults → Conversation Settings
```

---

### 5. Details Panel ✅

Real-time conversation insights in right panel.

#### Files Changed ✅
- List of files modified by agent
- Tracked via Write/Edit tool calls
- Clickable to open in file tab

#### Todo List ✅
- Agent's task tracking (from TodoWrite tool)
- Status icons: pending, in_progress, completed
- Real-time updates during conversation

#### Tool Calls Summary ✅
- Breakdown by tool type
- Success/failure counts
- Total tool calls

#### Context Metrics ✅
- Input tokens (cumulative)
- Output tokens (cumulative)
- Cache read tokens (separate)
- Estimated cost
- Progress bar visualization

---

### 6. Automatic Git Operations 📋 (Planned)

Optional automatic version control for agent work.

#### Auto-Branch Creation
When enabled, automatically creates a dedicated branch for each agent session:

```
agent/{agentName}/{sessionShortId}
```

**Example:** `agent/chorus/a1b2c3d4`

**Triggers:**
- First file change in a new conversation
- Isolates agent work from main branch
- Safe to experiment without affecting main

#### Auto-Commit per Turn
Automatically commits after each conversation turn:

**Commit Message Format:**
```
[Agent] {user prompt summary}

Files: src/auth.ts, src/utils.ts
```

**Triggers:**
- After agent completes response
- Only if files were changed
- Groups all changes from that turn

#### Commit on Stop
Commits any uncommitted changes when agent stops:

**Commit Message:**
```
[Agent] Work in progress

Files: {list of changed files}
```

**Triggers:**
- User stops agent mid-task
- App closes with pending changes
- Prevents losing work

#### Configuration

**Per-Workspace Settings:**
| Setting | Default | Description |
|---------|---------|-------------|
| Auto-branch | Off | Create branch per session |
| Auto-commit | Off | Commit after each turn |

**Enable via:**
1. Workspace Overview → Workspace Settings
2. Toggle "Auto-branch" and/or "Auto-commit"

#### Agent Sessions Panel
View and manage agent branches:

- List of `agent/*` branches in workspace
- Commit count per branch
- Quick actions:
  - **Checkout** - Switch to branch
  - **Merge** - Merge to main
  - **Delete** - Remove branch

---

## Data Model

```typescript
interface Conversation {
  id: string
  agentId: string
  workspaceId: string
  title: string
  createdAt: string
  updatedAt: string
  sessionId?: string        // For SDK resumption
  sessionCreatedAt?: string // For expiry detection
  settings?: {
    permissionMode?: PermissionMode
    allowedTools?: string[]
    model?: string
  }
}

interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  claudeMessage?: SDKMessage  // Raw SDK message (preserved)
  toolCalls?: ToolCall[]
}
```

---

## UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `ChatArea` | MainPane | Main chat container |
| `ChatHeader` | Chat | Agent name, status |
| `ConversationToolbar` | Chat | Settings dropdowns, context badge |
| `MessageList` | Chat | Scrollable message container |
| `MessageBubble` | Chat | Single message display |
| `MarkdownContent` | Chat | Markdown renderer |
| `CodeBlock` | Chat | Syntax highlighted code |
| `MermaidDiagram` | Chat | Diagram renderer |
| `ToolCallsGroup` | Chat | Collapsed tool calls |
| `MessageInput` | Chat | Text input with @/command support |
| `MentionDropdown` | Chat | @ file autocomplete |
| `SlashCommandDropdown` | Chat | / command autocomplete |
| `ConversationDetails` | RightPanel | Files, todos, tools, metrics |
| `PermissionDialog` | Dialog | Tool approval prompt |

---

## User Flows

### Start New Conversation
1. Click agent in sidebar
2. Click "New Conversation"
3. Chat tab opens
4. Type message and press Enter
5. Agent streams response

### Resume Existing Conversation
1. Click agent in sidebar
2. Click existing conversation in list
3. Chat tab opens with history
4. New messages continue from context

### Change Conversation Settings
1. Open conversation
2. Click dropdowns in toolbar (Permission/Tools/Model)
3. Select new value
4. Takes effect on next message

### View Conversation Details
1. Open conversation
2. Details panel shows in right sidebar
3. Click tabs: Files, Todos, Tools, Context

---

## Related Files

**Services:**
- `src/main/services/agent-sdk-service.ts` - SDK integration
- `src/main/services/conversation-service.ts` - JSONL persistence
- `src/main/services/command-service.ts` - Slash commands

**Store:**
- `src/renderer/src/stores/chat-store.ts` - Conversation state
- `src/renderer/src/stores/workspace-store.ts` - Commands

**Components:**
- `src/renderer/src/components/Chat/` - All chat components
- `src/renderer/src/components/RightPanel/DetailsSection.tsx`
- `src/renderer/src/components/dialogs/PermissionDialog.tsx`
