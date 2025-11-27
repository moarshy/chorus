---
date: 2025-11-27
author: Claude
status: draft
type: implementation_plan
feature: Claude Code Integration
---

# Claude Code Integration Implementation Plan

## Overview

Implement real-time chat with Claude Code agents in Chorus. Each agent can have multiple conversations persisted in `~/.chorus/` directory. The chat interface includes a collapsible sidebar for conversation management, streaming message display, and session resume functionality.

## Current State Analysis

### What Exists:
- Electron app with two-pane layout (sidebar + main pane)
- Workspace and agent management working
- `ChatPlaceholder.tsx` shows placeholder when agent selected (`chorus/src/renderer/src/components/MainPane/ChatPlaceholder.tsx:48-104`)
- IPC patterns established with request/response and event streaming (`chorus/src/main/index.ts:80-265`)
- Zustand stores for state management (`chorus/src/renderer/src/stores/workspace-store.ts`)
- Working POC with Claude CLI integration (`electron/chorus/src/main/agent-service.ts`)
- Git clone streaming pattern as template for agent streaming (`chorus/src/main/index.ts:249-260`)

### Key Discoveries:
- POC `agent-service.ts` has working `spawn('claude', ['-p', '--verbose', '--output-format', 'stream-json'])` pattern
- Session ID captured from `{ type: 'system', subtype: 'init', session_id }` event
- Resume via `--resume {sessionId}` flag
- `mainWindow` reference stored globally for event emission (`chorus/src/main/index.ts:27`)
- Store location in dev: project root `chorus-data.json` (`chorus/src/main/store/index.ts:44-46`)

## What We're NOT Doing

- Agent-to-agent communication (Phase 3)
- MCP server integration (Phase 3)
- File editing from chat
- Code diff viewer in chat
- Voice input/output
- Multiple models (only Claude Code)
- Conversation search
- Conversation export (beyond JSONL)
- Conversation sharing
- Tab 2 "Details" content (placeholder only)
- Resizable chat sidebar (fixed width for now)

## Implementation Approach

Four phases building incrementally:
1. **Data Layer & Migration** - Foundation with `.chorus/` structure
2. **Agent Communication** - Claude CLI spawning and streaming
3. **Chat UI Components** - React components for chat interface
4. **Wiring & Polish** - Connect everything, handle errors

Each phase is independently testable before moving to the next.

---

## Phase 1: Data Layer & Migration

### Overview
Set up the `~/.chorus/` directory structure, migrate existing `chorus-data.json` data, and create the conversation persistence service.

### Changes Required:

#### 1. Update Store Configuration
**File**: `chorus/src/main/store/index.ts`
**Changes**: Update store to use `~/.chorus/config.json` instead of project root

**Implementation Requirements:**
- Import `app` from electron and `homedir` from `os`
- Create `getChorusDir()` function returning `~/.chorus/` path
- Ensure directory exists on init (create if missing)
- Change store path from project root to `~/.chorus/config.json`
- Update `initStore()` to call migration if old file exists
- Add new settings fields: `chatSidebarCollapsed: boolean`, `chatSidebarWidth: number`
- Export `getChorusDir()` for use by other services

#### 2. Create Migration Service
**File**: `chorus/src/main/services/migration-service.ts` (new file)
**Changes**: One-time migration from old to new location

**Implementation Requirements:**
- Check if `chorus-data.json` exists at old location (project root in dev, or old electron-store location)
- Read existing data
- Write to new `~/.chorus/config.json` location
- Rename old file to `chorus-data.json.backup`
- Log migration status
- Handle case where new location already has data (skip migration)
- Export `migrateIfNeeded()` function

#### 3. Create Conversation Service
**File**: `chorus/src/main/services/conversation-service.ts` (new file)
**Changes**: CRUD operations for conversations and JSONL message storage

**Implementation Requirements:**
- `getSessionsDir(workspaceId, agentId)`: Returns `~/.chorus/sessions/{workspaceId}/{agentId}/`
- `ensureSessionsDir(workspaceId, agentId)`: Creates directory if not exists
- `listConversations(workspaceId, agentId)`: Read `conversations.json`, return sorted by updatedAt desc
- `createConversation(workspaceId, agentId)`: Create new conversation entry, return Conversation object
- `loadConversation(conversationId)`: Read conversation metadata + parse JSONL messages file
- `updateConversation(conversationId, updates)`: Update metadata (title, updatedAt, messageCount, sessionId)
- `deleteConversation(conversationId)`: Remove from index and delete JSONL file
- `appendMessage(conversationId, message)`: Append JSON line to `{sessionId}-messages.jsonl`
- `getConversationPath(conversationId)`: Helper to find conversation across workspaces/agents
- Store conversation->path mapping in memory for quick lookups
- Handle file not found errors gracefully (return empty arrays)

#### 4. Add Type Definitions
**File**: `chorus/src/preload/index.d.ts`
**Changes**: Add conversation and message types

**Implementation Requirements:**
- Add `Conversation` interface (id, sessionId, agentId, workspaceId, title, createdAt, updatedAt, messageCount)
- Add `ConversationMessage` interface (uuid, type, content, timestamp, sessionId?, toolName?, toolInput?)
- Add `ContentBlock` interface (type, text?, name?, input?)
- Add `ConversationAPI` interface with list, create, load, delete methods
- Update `ChorusSettings` to include `chatSidebarCollapsed` and `chatSidebarWidth`
- Update `CustomAPI` to include `conversation` namespace

#### 5. Register Conversation IPC Handlers
**File**: `chorus/src/main/index.ts`
**Changes**: Add IPC handlers for conversation operations

**Implementation Requirements:**
- Import conversation service functions
- Add `conversation:list` handler - calls `listConversations(workspaceId, agentId)`
- Add `conversation:create` handler - calls `createConversation(workspaceId, agentId)`
- Add `conversation:load` handler - calls `loadConversation(conversationId)`
- Add `conversation:delete` handler - calls `deleteConversation(conversationId)`
- Add `settings:get-chorus-dir` handler - returns `getChorusDir()` path
- Follow existing handler pattern with try/catch and `{ success, data?, error? }` returns

#### 6. Expose Conversation API in Preload
**File**: `chorus/src/preload/index.ts`
**Changes**: Add conversation methods to API object

**Implementation Requirements:**
- Add `conversation` namespace to api object
- Add `list(workspaceId, agentId)` method
- Add `create(workspaceId, agentId)` method
- Add `load(conversationId)` method
- Add `delete(conversationId)` method
- Add `settings.getChorusDir()` method

### Success Criteria:

**Automated Verification:**
- [ ] TypeScript compiles without errors (`bun run typecheck`)
- [ ] App starts without errors (`bun run dev`)

**Manual Verification:**
- [ ] On first launch, `~/.chorus/` directory is created
- [ ] If `chorus-data.json` existed, data is migrated and file renamed to `.backup`
- [ ] `~/.chorus/config.json` contains workspaces and settings
- [ ] Can create a conversation via IPC (test in dev tools console)
- [ ] Conversation appears in `~/.chorus/sessions/{workspaceId}/{agentId}/conversations.json`
- [ ] Can load conversation and get empty messages array
- [ ] Can delete conversation and files are removed

---

## Phase 2: Agent Communication

### Overview
Implement the agent service for Claude CLI communication with streaming responses, session management, and JSONL logging.

### Changes Required:

#### 1. Create Agent Service
**File**: `chorus/src/main/services/agent-service.ts` (new file)
**Changes**: Port and enhance POC agent service

**Implementation Requirements:**
- Store active processes in `Map<string, ChildProcess>` keyed by agentId
- Store session IDs in `Map<string, string>` keyed by agentId (runtime cache)
- `detectClaudePath()`: Check if `claude` exists in PATH using `which claude`, return path or null
- `sendMessage(conversationId, agentId, repoPath, message, sessionId, mainWindow)`:
  - Kill any existing process for this agent
  - Send `agent:status` event with `busy` status
  - Build args: `['-p', '--verbose', '--output-format', 'stream-json']`
  - Add `--resume {sessionId}` if sessionId provided
  - Add message as final arg
  - Spawn `claude` process with `cwd: repoPath`
  - Parse streaming JSON from stdout line by line
  - Extract session_id from `{ type: 'system', subtype: 'init' }` event
  - Send `agent:stream-delta` events for text chunks
  - Send `agent:message` events for complete tool_use blocks
  - Call conversation service to append messages to JSONL
  - Send `agent:status` event with `ready` on completion
  - Handle errors and send `agent:message` with type `error`
- `stopAgent(agentId)`: Kill process with SIGTERM, clean up maps
- `getSessionId(agentId)`: Return cached session ID
- `clearSession(agentId)`: Remove from session map
- `isClaudeAvailable()`: Return result of `detectClaudePath()`

#### 2. Add Agent Message Types
**File**: `chorus/src/preload/index.d.ts`
**Changes**: Add streaming event types

**Implementation Requirements:**
- Add `AgentStreamDelta` interface (conversationId, delta: string)
- Add `AgentMessageEvent` interface (conversationId, message: ConversationMessage)
- Add `AgentStatusEvent` interface (agentId, status: 'ready' | 'busy' | 'error', error?: string)
- Add `AgentAPI` interface with send, stop, onStreamDelta, onMessage, onStatus methods

#### 3. Register Agent IPC Handlers
**File**: `chorus/src/main/index.ts`
**Changes**: Add IPC handlers for agent communication

**Implementation Requirements:**
- Import agent service functions
- Add `agent:send` handler - calls `sendMessage()`, returns immediately (streaming via events)
- Add `agent:stop` handler - calls `stopAgent(agentId)`
- Add `agent:check-available` handler - calls `isClaudeAvailable()`
- Add `session:get` handler - calls `getSessionId(agentId)`
- Add `session:clear` handler - calls `clearSession(agentId)`

#### 4. Expose Agent API in Preload
**File**: `chorus/src/preload/index.ts`
**Changes**: Add agent methods and event listeners

**Implementation Requirements:**
- Add `agent` namespace to api object
- Add `send(conversationId, message, repoPath)` method
- Add `stop(agentId)` method
- Add `checkAvailable()` method
- Add `onStreamDelta(callback)` with cleanup return function
- Add `onMessage(callback)` with cleanup return function
- Add `onStatus(callback)` with cleanup return function
- Add `session` namespace with `get(agentId)` and `clear(agentId)` methods

### Success Criteria:

**Automated Verification:**
- [ ] TypeScript compiles without errors
- [ ] App starts without errors

**Manual Verification:**
- [ ] `agent:check-available` returns claude path (or null if not installed)
- [ ] Can send message via `agent:send` IPC call
- [ ] Receive `agent:status` event with `busy` immediately
- [ ] Receive `agent:stream-delta` events with text chunks
- [ ] Receive `agent:message` events for tool use
- [ ] Receive `agent:status` event with `ready` on completion
- [ ] Session ID is captured and `session:get` returns it
- [ ] Messages are appended to JSONL file
- [ ] Can stop agent mid-response with `agent:stop`
- [ ] Can resume conversation with session ID

---

## Phase 3: Chat UI Components

### Overview
Build the React components for the chat interface including the chat view container, sidebar with conversation list, message display, and input area.

### Changes Required:

#### 1. Create Chat Store
**File**: `chorus/src/renderer/src/stores/chat-store.ts` (new file)
**Changes**: Zustand store for chat state management

**Implementation Requirements:**
- State: `activeConversationId`, `conversations`, `messages`, `isLoading`, `isStreaming`, `streamingContent`, `agentStatus`
- State: `chatSidebarCollapsed`, `chatSidebarTab` ('conversations' | 'details')
- `loadConversations(workspaceId, agentId)`: Call API, set conversations, auto-select most recent
- `selectConversation(conversationId)`: Call API to load, set messages
- `createConversation(workspaceId, agentId)`: Call API, add to list, select it
- `deleteConversation(conversationId)`: Call API, remove from list, select next or null
- `sendMessage(content, workspaceId, agentId, repoPath)`:
  - Create conversation if none active
  - Add user message to messages array
  - Set isStreaming true
  - Call agent.send API
- `appendStreamDelta(delta)`: Append to streamingContent
- `appendMessage(message)`: Add to messages array, clear streamingContent if assistant
- `setAgentStatus(status)`: Update status, set isStreaming false if ready
- `stopAgent(agentId)`: Call API
- `setChatSidebarCollapsed(collapsed)`: Update state, persist to settings
- `setChatSidebarTab(tab)`: Update state
- `initEventListeners()`: Set up agent event listeners, return cleanup function
- Load `chatSidebarCollapsed` from settings on init

#### 2. Create ChatView Container
**File**: `chorus/src/renderer/src/components/Chat/ChatView.tsx` (new file)
**Changes**: Main chat view replacing ChatPlaceholder when chatting

**Implementation Requirements:**
- Accept `agent` and `workspace` props
- Use chat store for state and actions
- Call `loadConversations` on mount and when agent changes
- Call `initEventListeners` on mount, cleanup on unmount
- Render two-column layout: ChatSidebar (left) + ChatArea (right)
- Handle collapsed state for sidebar (0 width when collapsed)
- Show loading state while conversations load

#### 3. Create ChatSidebar Component
**File**: `chorus/src/renderer/src/components/Chat/ChatSidebar.tsx` (new file)
**Changes**: Collapsible sidebar with tabs

**Implementation Requirements:**
- Fixed width 240px (or 0 when collapsed)
- Two tabs at top: "Conversations" (active), "Details" (coming soon)
- Tab switching via chat store
- Render ConversationList for tab 1
- Render "Coming Soon" placeholder for tab 2
- "New Conversation" button at bottom
- Collapse toggle button (chevron icon)
- Smooth width transition animation (CSS transition)

#### 4. Create ConversationList Component
**File**: `chorus/src/renderer/src/components/Chat/ConversationList.tsx` (new file)
**Changes**: List of conversations grouped by date

**Implementation Requirements:**
- Group conversations by date: Today, Yesterday, This Week, Older
- Use helper function to categorize by date
- Render section headers for each group
- Render ConversationItem for each conversation
- Handle empty state: "No conversations yet"
- Scroll container for long lists

#### 5. Create ConversationItem Component
**File**: `chorus/src/renderer/src/components/Chat/ConversationItem.tsx` (new file)
**Changes**: Single conversation in list

**Implementation Requirements:**
- Show title (truncated to 50 chars)
- Show relative time (e.g., "2h ago", "Yesterday")
- Highlight if active (selected)
- Click to select conversation
- Right-click context menu with "Delete" option
- Hover state styling

#### 6. Create ChatArea Component
**File**: `chorus/src/renderer/src/components/Chat/ChatArea.tsx` (new file)
**Changes**: Message display and input area

**Implementation Requirements:**
- Flex column layout filling available space
- ChatHeader at top (agent name, status, workspace path)
- MessageList in middle (scrollable, flex-1)
- MessageInput at bottom (fixed height)
- Pass relevant state and actions to children

#### 7. Create ChatHeader Component
**File**: `chorus/src/renderer/src/components/Chat/ChatHeader.tsx` (new file)
**Changes**: Agent info and status display

**Implementation Requirements:**
- Agent avatar (reuse helper from ChatPlaceholder)
- Agent name
- Status badge: green dot for "Ready", yellow spinner for "Busy", red dot for "Error"
- Workspace path (truncated)
- Stop button (visible only when busy)

#### 8. Create MessageList Component
**File**: `chorus/src/renderer/src/components/Chat/MessageList.tsx` (new file)
**Changes**: Scrollable message container

**Implementation Requirements:**
- Scroll container with flex-1
- Auto-scroll to bottom on new messages
- Use ref and useEffect for scroll behavior
- Render MessageBubble for each message
- Render streaming indicator when isStreaming and have streamingContent
- Handle empty state: "Send a message to start"

#### 9. Create MessageBubble Component
**File**: `chorus/src/renderer/src/components/Chat/MessageBubble.tsx` (new file)
**Changes**: Individual message display

**Implementation Requirements:**
- Different styles based on message type (user, assistant, tool_use, error)
- User messages: right-aligned, accent background, rounded corners
- Assistant messages: left-aligned, dark background, rounded corners
- Tool use: inline indicator with tool icon and name
- Error: red-tinted background with error icon
- Streaming: show with typing cursor animation
- Support markdown rendering in assistant messages (optional, can use plain text initially)
- Timestamp on hover (tooltip)

#### 10. Create ToolUseIndicator Component
**File**: `chorus/src/renderer/src/components/Chat/ToolUseIndicator.tsx` (new file)
**Changes**: Shows tool being used inline

**Implementation Requirements:**
- Compact inline display
- Tool icon (generic or tool-specific)
- Tool name and brief input summary
- Subtle background styling
- Collapsible full input details (optional for v1)

#### 11. Create MessageInput Component
**File**: `chorus/src/renderer/src/components/Chat/MessageInput.tsx` (new file)
**Changes**: Input field and send button

**Implementation Requirements:**
- Textarea that grows with content (max 4 lines)
- Enter to send, Shift+Enter for newline
- Send button with arrow icon
- Disabled state when streaming or loading
- Clear input after send
- Focus management (auto-focus on mount)
- Placeholder text: "Message {agentName}..."

#### 12. Update MainPane to Render ChatView
**File**: `chorus/src/renderer/src/components/MainPane/MainPane.tsx`
**Changes**: Switch from ChatPlaceholder to ChatView when agent selected

**Implementation Requirements:**
- Import ChatView component
- In `renderContent()`, when agent is selected, render ChatView instead of ChatPlaceholder
- Pass agent and workspace props to ChatView

#### 13. Add Chat Types to Renderer
**File**: `chorus/src/renderer/src/types/index.ts`
**Changes**: Re-export chat-related types

**Implementation Requirements:**
- Re-export Conversation, ConversationMessage, ContentBlock from preload types
- Add ChatSidebarTab type: 'conversations' | 'details'

### Success Criteria:

**Automated Verification:**
- [ ] TypeScript compiles without errors
- [ ] App starts without errors

**Manual Verification:**
- [ ] Selecting an agent shows ChatView (not ChatPlaceholder)
- [ ] Chat sidebar shows with Conversations tab active
- [ ] Can collapse/expand chat sidebar
- [ ] Collapsed state persists across agent switches
- [ ] Can create new conversation via button
- [ ] Conversation appears in list
- [ ] Can select conversation from list
- [ ] Message input is functional (typing, enter to send)
- [ ] Sending message creates user bubble
- [ ] Agent response streams in real-time
- [ ] Tool use shows inline indicator
- [ ] Auto-scroll works during streaming
- [ ] Stop button appears when agent is busy
- [ ] Stop button stops the agent
- [ ] Switching agents loads their conversations
- [ ] Can delete conversation from context menu

---

## Phase 4: Wiring & Polish

### Overview
Connect all components, handle edge cases, improve error handling, and polish the user experience.

### Changes Required:

#### 1. Error State Handling
**File**: `chorus/src/renderer/src/components/Chat/ChatView.tsx`
**Changes**: Handle and display errors gracefully

**Implementation Requirements:**
- Show error banner when agent errors
- "Claude not installed" state with install instructions link
- Network error retry functionality
- Session expired handling (auto-create new conversation, preserve messages display)
- Process crash recovery (show error, allow retry)

#### 2. Loading States
**File**: Multiple chat components
**Changes**: Add loading indicators

**Implementation Requirements:**
- Skeleton loading for conversation list
- Loading spinner when loading conversation messages
- Typing indicator before first token arrives
- Disabled states for inputs during loading

#### 3. Empty States
**File**: Multiple chat components
**Changes**: Improve empty state messaging

**Implementation Requirements:**
- No workspaces: Guide to add workspace
- No agents in workspace: Explain how to create agents
- No conversations: Encourage starting first chat
- Empty conversation: Show welcome message with suggestions

#### 4. Keyboard Navigation
**File**: `chorus/src/renderer/src/components/Chat/`
**Changes**: Add keyboard shortcuts

**Implementation Requirements:**
- Escape to stop streaming
- Cmd/Ctrl+N for new conversation
- Up/Down to navigate conversation list
- Focus management between sidebar and chat area

#### 5. Settings Integration
**File**: `chorus/src/renderer/src/components/dialogs/SettingsDialog.tsx` (if exists) or create
**Changes**: Show Claude CLI status in settings

**Implementation Requirements:**
- Display detected Claude CLI path
- Show "Not found" with install link if not detected
- Read-only for now (future: allow path override)

#### 6. Conversation Title Generation
**File**: `chorus/src/main/services/conversation-service.ts`
**Changes**: Auto-generate title from first message

**Implementation Requirements:**
- When first user message sent, extract first 50 chars as title
- Strip newlines, truncate with ellipsis
- Update conversation metadata

#### 7. Performance Optimization
**File**: Multiple files
**Changes**: Optimize for large conversations

**Implementation Requirements:**
- Virtualized message list for conversations with 100+ messages (can defer if needed)
- Debounce JSONL writes (batch within 100ms window)
- Memoize message components
- Lazy load message content for collapsed tool results

#### 8. Cleanup and Code Quality
**File**: All new files
**Changes**: Final polish

**Implementation Requirements:**
- Remove any console.log statements (except errors)
- Ensure consistent error messages
- Verify all cleanup functions are called
- Test memory for leaks (process cleanup, event listeners)
- Verify TypeScript strict mode compliance

### Success Criteria:

**Automated Verification:**
- [ ] TypeScript compiles without errors
- [ ] No console warnings in dev mode
- [ ] All event listeners properly cleaned up (verify in React DevTools)

**Manual Verification:**
- [ ] Error states display correctly with actionable messages
- [ ] Loading states feel smooth and informative
- [ ] Empty states guide users appropriately
- [ ] Keyboard shortcuts work as expected
- [ ] Settings show Claude CLI status
- [ ] Conversation titles generate from first message
- [ ] Large conversations (50+ messages) perform well
- [ ] No memory leaks after extended use
- [ ] App feels polished and responsive

---

## Electron-Specific Considerations

### Main Process Changes
- New services: `migration-service.ts`, `conversation-service.ts`, `agent-service.ts`
- Store location change from project root to `~/.chorus/`
- New IPC handlers for conversations and agent communication
- Child process management for Claude CLI

### Renderer Process Changes
- New Zustand store: `chat-store.ts`
- New component tree under `components/Chat/`
- Event listener setup and cleanup for agent streaming
- MainPane conditional rendering update

### Preload Script Changes
- New API namespaces: `conversation`, `agent`, `session`
- Event listener methods with cleanup returns for `agent:stream-delta`, `agent:message`, `agent:status`
- Type definitions for all new interfaces

### Security Considerations
- All file operations through main process only
- No direct filesystem access from renderer
- Claude CLI spawned with controlled arguments
- JSONL content not evaluated, only stored/displayed

## Performance Considerations

- **Streaming batching**: Accumulate deltas for 16ms before updating UI (requestAnimationFrame)
- **JSONL writes**: Debounce to batch writes within 100ms
- **Message list**: Consider virtualization for 100+ messages
- **Event listeners**: Always clean up on unmount
- **Process cleanup**: Kill Claude process on conversation switch or agent stop

## Testing Strategy

### Unit Tests (Future)
- Conversation service CRUD operations
- Message parsing and formatting
- Date grouping logic
- Title generation

### Integration Tests (Future)
- IPC roundtrip for conversation operations
- Agent message flow end-to-end
- Session resume functionality

### Manual Testing
- Full chat flow: create conversation, send message, receive response
- Session resume: close app, reopen, continue conversation
- Error handling: stop Claude, test network issues
- Edge cases: rapid message sending, very long messages
- Multi-agent: switch between agents, verify isolation

## References

* Feature spec: `specifications/1-claude-code-integration/feature.md`
* POC agent service: `electron/chorus/src/main/agent-service.ts`
* Existing IPC patterns: `chorus/src/main/index.ts:80-265`
* Store patterns: `chorus/src/main/store/index.ts`
* Zustand patterns: `chorus/src/renderer/src/stores/workspace-store.ts`
* Event streaming pattern: `chorus/src/main/index.ts:249-260` (git clone)
