---
date: 2025-01-28
author: Claude
status: draft
type: implementation_plan
feature: Migrate to Claude Agent SDK
---

# Claude Agent SDK Migration Implementation Plan

## Overview

Migrate Chorus from spawning Claude Code via CLI subprocess to using the Claude Agent SDK directly. This enables programmatic permission handling, cleaner interruption, in-process hooks, and eliminates manual JSON parsing while preserving all existing functionality including session management, message storage, and conversation settings.

## Current State Analysis

### Key Discoveries

1. **CLI Spawning** (`chorus/src/main/services/agent-service.ts:167-176`): Uses Node.js `spawn()` with `--output-format stream-json`

2. **Session Management** (`agent-service.ts:80-89, 218-244`):
   - Session ID captured from `system.init` message
   - Stored in conversation with `sessionCreatedAt` for expiry tracking (25 days)
   - Resume via `--resume` flag, always passes settings due to CLI bugs

3. **Message Storage** (`conversation-service.ts:504-532`):
   - JSONL format at `~/.chorus/sessions/{workspaceId}/{agentId}/{conversationId}-messages.jsonl`
   - Preserves raw Claude messages in `claudeMessage` field
   - Links tool_use to tool_result via `toolUseId`

4. **IPC Events** (4 main channels):
   - `agent:stream-delta` - Real-time text streaming
   - `agent:message` - Complete messages (user, assistant, tool_use, tool_result, error, system)
   - `agent:status` - Agent status changes (ready, busy, error)
   - `agent:session-update` - Session ID sync to renderer

5. **Settings Management**: Permission mode, allowed tools, model passed as CLI flags on every invocation

### What Must Be Preserved

- Session resumption with existing session IDs
- JSONL message storage format with `claudeMessage` field
- All 4 IPC event channels and their payloads
- Per-agent and per-conversation status tracking
- Unread badge counts
- Conversation settings (model, permission mode, tools)
- Tool call grouping in UI (via `toolUseId` linking)

## What We're NOT Doing

- Custom MCP tools via `tool()` and `createSdkMcpServer()` (future sprint)
- Subagent definitions via `agents` option (future sprint)
- Structured output validation (future sprint)
- Session forking for parallel exploration (future sprint)
- Multi-agent orchestration patterns (future sprint)

## Implementation Approach

Phased migration with feature flag to switch between CLI and SDK:

1. **Phase 1**: Install SDK, create new service file, implement core `query()` call
2. **Phase 2**: Add permission dialog UI and `canUseTool` callback
3. **Phase 3**: Add hooks, interruption, and finalize migration
4. **Phase 4**: Testing, validation, and cleanup

---

## Phase 1: Core SDK Integration

### Overview

Install the SDK, create a new `agent-sdk-service.ts` alongside existing `agent-service.ts`, and implement basic message streaming that mirrors current behavior. Add feature flag to switch between implementations.

### Changes Required

#### 1. Add SDK Dependency

**File**: `chorus/package.json`

**Implementation Requirements:**
- Add `@anthropic-ai/claude-agent-sdk` as a dependency (version ^0.1.x)
- Run `bun install` to install the package
- Verify SDK works in Electron main process environment

#### 2. Create SDK Service

**File**: `chorus/src/main/services/agent-sdk-service.ts` (NEW)

**Implementation Requirements:**
- Import `query` from `@anthropic-ai/claude-agent-sdk`
- Create `sendMessageSDK()` function with same signature as existing `sendMessage()`
- Map SDK options to current settings:
  - `cwd: repoPath` - Workspace directory
  - `model: settings.model` - Model selection
  - `permissionMode: settings.permissionMode` - Permission mode
  - `allowedTools: settings.allowedTools` - Tool allowlist
  - `resume: sessionId` - Session resumption (when sessionId provided)
  - `settingSources: ['project']` - Load .claude/settings.json and CLAUDE.md
  - `systemPrompt: { type: 'file', path: agentFilePath }` - Agent system prompt (only for new sessions)
- Store active `Query` objects in a Map keyed by conversationId for interruption
- Iterate over `query()` async generator and process messages
- Handle SDK message types and emit same IPC events as CLI implementation:
  - `system.init` → capture sessionId, emit `agent:session-update`
  - `assistant` → extract text blocks, emit `agent:stream-delta` for each
  - `assistant` with tool_use blocks → emit `agent:message` with tool_use type
  - `user` with tool_result blocks → emit `agent:message` with tool_result type
  - `result` → capture cost/duration, emit final `agent:message` and `agent:status: ready`
- Create `stopAgentSDK()` function that calls `stream.interrupt()` on active query
- Handle `AbortError` for interruption - emit "Stopped by user" message
- Handle other errors - emit error messages via `agent:message`

**Session Management Requirements:**
- Capture session_id from `system.init` message
- Only update `sessionCreatedAt` for NEW sessions (not resumed)
- Check session expiry (25 days) before resuming
- Store sessionId in conversation via `updateConversation()`
- Emit `agent:session-update` IPC event for renderer sync

**Message Storage Requirements:**
- Create `ConversationMessage` objects for each event type
- Preserve raw SDK message in `claudeMessage` field
- Extract `toolUseId` from tool_use blocks for linking
- Extract usage tokens from assistant message
- Extract cost/duration from result message
- Call `appendMessage()` for each stored message

#### 3. Add Feature Flag

**File**: `chorus/src/main/services/agent-service.ts`

**Implementation Requirements:**
- Add `USE_SDK` constant at top of file (default: false for safe rollout)
- Modify `sendMessage()` to check flag and delegate to `sendMessageSDK()` when enabled
- Modify `stopAgent()` to check flag and call `stopAgentSDK()` when enabled
- Keep existing CLI implementation intact for fallback
- Log which implementation is being used for debugging

#### 4. Export SDK Functions

**File**: `chorus/src/main/services/index.ts` (if exists, or update imports in main/index.ts)

**Implementation Requirements:**
- Export `sendMessageSDK`, `stopAgentSDK` alongside existing functions
- Ensure IPC handlers can access both implementations

### Success Criteria

**Automated Verification:**
- [ ] `bun run typecheck` passes with no errors
- [ ] `bun run build` completes successfully
- [ ] SDK package is listed in package.json dependencies

**Manual Verification:**
- [ ] With `USE_SDK=false`: Existing CLI behavior works unchanged
- [ ] With `USE_SDK=true`: Messages stream to UI correctly
- [ ] With `USE_SDK=true`: Session ID captured and stored in conversation
- [ ] With `USE_SDK=true`: Session resumption works (send second message, verify context preserved)
- [ ] With `USE_SDK=true`: Messages stored in JSONL with `claudeMessage` field
- [ ] With `USE_SDK=true`: Tool calls display correctly with input/output
- [ ] With `USE_SDK=true`: Stop button calls `stream.interrupt()` and stops agent
- [ ] Console shows which implementation is active

---

## Phase 2: Permission Dialog UI

### Overview

Implement the `canUseTool` callback with an Electron permission dialog. This is a key SDK-only feature that enables interactive tool approval.

### Changes Required

#### 1. Add Permission IPC Channels

**File**: `chorus/src/preload/index.ts`

**Implementation Requirements:**
- Add `onPermissionRequest` event listener registration to agent API
- Add `respondPermission(requestId, response)` invoke method to agent API
- Response type: `{ approved: boolean, reason?: string, stopCompletely?: boolean }`
- Follow existing pattern for event listener cleanup (return unsubscribe function)

#### 2. Add Permission TypeScript Types

**File**: `chorus/src/preload/index.d.ts`

**Implementation Requirements:**
- Add `PermissionRequest` interface:
  - `requestId: string` - Unique ID for this request
  - `conversationId: string` - Which conversation triggered this
  - `toolName: string` - Name of tool (e.g., "Write", "Bash")
  - `toolInput: Record<string, unknown>` - Tool input parameters
- Add `PermissionResponse` interface:
  - `approved: boolean` - User's decision
  - `reason?: string` - Optional denial reason
  - `stopCompletely?: boolean` - Stop entire agent execution
- Add method signatures to `AgentAPI` interface

#### 3. Add Permission IPC Handlers

**File**: `chorus/src/main/index.ts`

**Implementation Requirements:**
- Add `ipcMain.handle('agent:respond-permission', ...)` handler
- Handler resolves a pending Promise in the SDK service
- Store pending permission requests in a Map keyed by requestId
- Handle timeout (e.g., 5 minutes) - auto-deny if user doesn't respond

#### 4. Implement canUseTool Callback

**File**: `chorus/src/main/services/agent-sdk-service.ts`

**Implementation Requirements:**
- Add `pendingPermissions: Map<string, { resolve, reject }>` to track pending requests
- In `sendMessageSDK()`, add `canUseTool` callback to query options
- Callback implementation:
  - Generate unique requestId
  - Emit `permission:request` IPC event to renderer with tool details
  - Create Promise and store resolve/reject in pendingPermissions Map
  - Wait for response via IPC (or timeout)
  - Return `{ behavior: 'allow' | 'deny', message?, interrupt? }` based on response
- Add function to resolve pending permission (called by IPC handler)
- Handle edge case: agent stops while permission pending (reject with AbortError)

#### 5. Add Permission State to Chat Store

**File**: `chorus/src/renderer/src/stores/chat-store.ts`

**Implementation Requirements:**
- Add `permissionRequest: PermissionRequest | null` state
- Add `showPermissionDialog(request)` action
- Add `respondToPermission(requestId, response)` action that:
  - Calls `window.api.agent.respondPermission(requestId, response)`
  - Clears `permissionRequest` state
- Register `onPermissionRequest` listener in `initEventListeners()`
- Listener calls `showPermissionDialog(event)`

#### 6. Create Permission Dialog Component

**File**: `chorus/src/renderer/src/components/Chat/PermissionDialog.tsx` (NEW)

**Implementation Requirements:**
- Modal overlay component (similar to existing dialogs in codebase)
- Display:
  - Tool name prominently (e.g., "Claude wants to use Write")
  - Tool input details (file path for Write, command for Bash, etc.)
  - Format tool input nicely based on tool type
- Buttons:
  - "Allow" - approve this tool call
  - "Deny" - reject this tool call
  - "Stop Agent" - deny and stop entire execution
- Keyboard shortcuts: Enter=Allow, Escape=Deny
- Styling: Match Chorus Slack-like design
- Accessibility: Focus trap, aria labels

#### 7. Integrate Dialog in ChatArea

**File**: `chorus/src/renderer/src/components/Chat/ChatArea.tsx`

**Implementation Requirements:**
- Import and render `PermissionDialog` component
- Conditionally show when `permissionRequest !== null`
- Pass handlers for allow/deny/stop responses
- Dialog should overlay the chat area, not block other conversations

### Success Criteria

**Automated Verification:**
- [ ] `bun run typecheck` passes
- [ ] `bun run build` succeeds

**Manual Verification:**
- [ ] Tool requiring permission (e.g., Write) triggers dialog
- [ ] Dialog shows correct tool name and input
- [ ] "Allow" button approves and tool executes
- [ ] "Deny" button rejects and Claude receives rejection message
- [ ] "Stop Agent" stops entire execution
- [ ] Keyboard shortcuts work (Enter/Escape)
- [ ] Multiple permission requests queue correctly
- [ ] Permission timeout works (auto-deny after 5 minutes)
- [ ] Dialog doesn't block other agent conversations

---

## Phase 3: Hooks and Finalization

### Overview

Add SDK hooks for file change notifications, finalize interruption handling, and prepare for production use.

### Changes Required

#### 1. Add PostToolUse Hook

**File**: `chorus/src/main/services/agent-sdk-service.ts`

**Implementation Requirements:**
- Add `hooks` configuration to query options
- Implement `PostToolUse` hook:
  - Check if tool was Write, Edit, or file-modifying Bash command
  - Extract file path from tool input
  - Emit `agent:file-changed` IPC event with conversationId and file path
  - Return `{ continue: true }` to allow execution to proceed
- Hook timeout: use default (60s) or configure as needed

#### 2. Add File Change IPC Channel

**File**: `chorus/src/preload/index.ts`

**Implementation Requirements:**
- Add `onFileChanged` event listener to agent API
- Event payload: `{ conversationId: string, filePath: string, toolName: string }`

#### 3. Handle File Change in Renderer

**File**: `chorus/src/renderer/src/stores/chat-store.ts`

**Implementation Requirements:**
- Register `onFileChanged` listener in `initEventListeners()`
- For now, just log the event (future: could refresh file browser, show toast)
- Could emit to workspace store if file browser needs refresh

#### 4. Improve Error Handling

**File**: `chorus/src/main/services/agent-sdk-service.ts`

**Implementation Requirements:**
- Catch and handle specific error types:
  - `AbortError` → "Agent stopped by user" message
  - SDK connection errors → "Failed to connect to Claude" message
  - Timeout errors → "Request timed out" message
  - Unknown errors → Log full error, show generic message
- Always emit `agent:status: ready` on completion (success or error)
- Always clean up active stream from Map on completion
- Log errors with context (conversationId, sessionId) for debugging

#### 5. Remove CLI Detection Code (Optional)

**File**: `chorus/src/main/services/agent-service.ts`

**Implementation Requirements:**
- Once SDK is validated, consider removing or deprecating:
  - `detectClaudePath()` function
  - `isClaudeAvailable()` function
  - CLI spawn logic
- Or keep as fallback behind feature flag
- Decision: Keep for now, remove in future cleanup sprint

#### 6. Update Documentation

**File**: `CLAUDE.md`

**Implementation Requirements:**
- Update "Claude Code Integration" section to mention SDK
- Document new permission dialog feature
- Update "Session Resumption" section with SDK approach
- Add note about `USE_SDK` feature flag during transition

### Success Criteria

**Automated Verification:**
- [ ] `bun run typecheck` passes
- [ ] `bun run build` succeeds
- [ ] `bun run dev` starts without errors

**Manual Verification:**
- [ ] PostToolUse hook fires for Write/Edit tools
- [ ] File change events logged in console
- [ ] Interruption shows "Stopped by user" message
- [ ] Errors display appropriate messages in UI
- [ ] No orphaned streams or processes after stop
- [ ] Memory usage reasonable during long conversations
- [ ] SDK works with all three models (Sonnet, Opus, Haiku)

---

## Phase 4: Testing and Validation

### Overview

Comprehensive testing to ensure SDK implementation matches CLI behavior exactly, then enable by default.

### Changes Required

#### 1. Create Test Scenarios Document

**File**: `specifications/5-migrate-to-cc-agent-sdk/test-scenarios.md` (NEW)

**Test Scenarios to Document:**
- New conversation (no session)
- Session resumption (existing session)
- Session expiry (>25 days old)
- Model selection (all three models)
- Permission modes (default, acceptEdits, bypassPermissions)
- Allowed tools configuration
- Tool execution (Read, Write, Bash, Grep, etc.)
- Permission dialog flow (allow, deny, stop)
- Interruption mid-stream
- Error handling (various error types)
- Multi-conversation (two agents running simultaneously)
- Long conversation (many messages)
- Large file operations

#### 2. Validate Message Format Compatibility

**Implementation Requirements:**
- Compare JSONL output from CLI vs SDK for same conversation
- Verify `claudeMessage` field structure is identical
- Verify tool_use/tool_result linking works correctly
- Verify cost/duration/usage tracking matches
- Document any differences found

#### 3. Enable SDK by Default

**File**: `chorus/src/main/services/agent-service.ts`

**Implementation Requirements:**
- Change `USE_SDK` constant to `true`
- Test in development for several days
- Monitor for issues
- Consider environment variable override: `CHORUS_USE_CLI=true`

#### 4. Cleanup and Documentation

**Implementation Requirements:**
- Remove any debug logging
- Update all documentation references
- Add migration notes for users
- Consider adding SDK version to "About" dialog

### Success Criteria

**Automated Verification:**
- [ ] All test scenarios documented
- [ ] Type checking passes
- [ ] Build succeeds

**Manual Verification:**
- [ ] All test scenarios pass with SDK
- [ ] No regression from CLI behavior
- [ ] Performance acceptable (startup, streaming, completion)
- [ ] Memory usage stable
- [ ] Ready for production use

---

## Electron-Specific Considerations

### Main Process Changes

1. **SDK runs in main process**: The SDK `query()` function runs in Electron's main process
2. **Async/await**: SDK uses async generators, compatible with Electron's event loop
3. **Process isolation**: Unlike CLI subprocess, SDK runs in-process (no separate Node.js process)
4. **Memory**: Monitor memory usage since SDK doesn't have subprocess isolation

### Renderer Process Changes

1. **Permission dialog**: New modal component in renderer
2. **State management**: New permission state in chat-store
3. **No direct SDK access**: All communication via IPC (security boundary)

### Preload Script Changes

1. **New IPC channels**: `permission:request`, `agent:respond-permission`, `agent:file-changed`
2. **Type definitions**: Updated `index.d.ts` with permission types
3. **Security**: All new APIs follow existing contextBridge pattern

### IPC Communication Summary

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `agent:send` | R→M | Send message (unchanged) |
| `agent:stop` | R→M | Stop agent (unchanged, calls SDK interrupt) |
| `agent:stream-delta` | M→R | Stream text (unchanged) |
| `agent:message` | M→R | Complete message (unchanged) |
| `agent:status` | M→R | Status change (unchanged) |
| `agent:session-update` | M→R | Session ID sync (unchanged) |
| `permission:request` | M→R | Show permission dialog (NEW) |
| `agent:respond-permission` | R→M | User permission response (NEW) |
| `agent:file-changed` | M→R | File change notification (NEW) |

---

## Performance Considerations

1. **Startup time**: SDK may have initialization overhead vs CLI spawn
2. **Memory usage**: Monitor in-process SDK memory vs CLI subprocess
3. **Streaming latency**: Should be equivalent or better than CLI
4. **Concurrent agents**: Test multiple agents running simultaneously
5. **Long conversations**: Verify no memory leaks over extended use

---

## Testing Strategy

### Unit Tests

- SDK service functions (mock SDK `query()`)
- Permission request/response flow
- Message type conversion
- Session expiry calculation

### Integration Tests

- IPC communication for permissions
- Store state updates
- Event listener registration/cleanup

### Manual Testing

- All test scenarios in Phase 4 document
- Edge cases: network errors, timeouts, concurrent operations
- Cross-platform: macOS, Windows, Linux (if supported)

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SDK bugs | High | Feature flag to fall back to CLI |
| Electron incompatibility | High | Test early in Phase 1, before heavy investment |
| Breaking changes in SDK | Medium | Pin version, monitor releases |
| Memory leaks | Medium | Monitor usage, test long sessions |
| Performance regression | Medium | Benchmark against CLI, optimize if needed |

---

## References

- Feature spec: `specifications/5-migrate-to-cc-agent-sdk/feature.md`
- SDK Migration Guide: `docs/3-tools/claude-code/sdk-migration-guide.md`
- Current agent service: `chorus/src/main/services/agent-service.ts`
- Conversation service: `chorus/src/main/services/conversation-service.ts`
- Chat store: `chorus/src/renderer/src/stores/chat-store.ts`
- Preload types: `chorus/src/preload/index.d.ts`
