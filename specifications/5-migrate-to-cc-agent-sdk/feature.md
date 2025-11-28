---
date: 2025-01-28
author: Claude
status: complete
type: feature
---

# Migrate to Claude Agent SDK Feature

## Overview

Migrate Chorus from spawning Claude Code via CLI subprocess (`spawn('claude', args)`) to using the Claude Agent SDK directly (`@anthropic-ai/claude-agent-sdk`). This enables programmatic permission handling, in-process hooks, cleaner interruption, and eliminates manual JSON parsing.

## Business Value

### For Power Users (like Richard)
- **Programmatic permission dialogs** - Show custom approval UI in Electron instead of relying on CLI flags
- **Smoother interruption** - Cancel agent mid-task via `stream.interrupt()` instead of killing process
- **Better error handling** - Built-in exceptions instead of parsing stderr
- **In-process hooks** - React to file changes and tool calls with TypeScript callbacks

### For New Users
- **More reliable experience** - No subprocess management edge cases
- **Faster startup** - No CLI spawn overhead
- **Cleaner architecture** - Simpler mental model (no inter-process communication for agent control)

## Current State

Chorus currently spawns Claude Code via CLI with `--output-format stream-json`:

```typescript
// Current: chorus/src/main/services/agent-service.ts
const claudeProcess = spawn(claudePath, [
  '-p', '--verbose', '--output-format', 'stream-json',
  '--permission-mode', permissionMode,
  '--allowedTools', tools.join(','),
  '--model', model,
  '--resume', sessionId,
  message
], { cwd: repoPath })

claudeProcess.stdout?.on('data', (chunk) => {
  // Manual JSON line parsing
  const lines = buffer.split('\n')
  for (const line of lines) {
    const msg = JSON.parse(line)
    // Handle different message types...
  }
})
```

**Current limitations:**
1. No programmatic permission prompts (`canUseTool` callback unavailable)
2. Interruption requires killing process (`process.kill()`)
3. Manual JSONL parsing prone to buffer edge cases
4. Subprocess management complexity
5. CLI detection and PATH issues
6. Settings persistence bugs require workarounds (always passing flags)

## User Stories

### Core Migration

1. **Developer**: **Given** the SDK is installed, **when** a user sends a message to an agent, **then** the message is processed via `query()` instead of CLI spawn - Verify streaming works identically

2. **Developer**: **Given** an active agent conversation, **when** user clicks stop, **then** `stream.interrupt()` is called and agent stops gracefully - No orphaned processes

3. **Developer**: **Given** a conversation with an existing sessionId, **when** user sends a follow-up, **then** session resumes via `options.resume` - Session continuity preserved

### Permission Handling

4. **User**: **Given** an agent wants to write a file, **when** permission is required, **then** Electron shows a custom approval dialog via `canUseTool` callback - User can approve/deny with context

5. **User**: **Given** `bypassPermissions` mode is off, **when** agent calls a sensitive tool, **then** UI shows tool name and input for review - User makes informed decision

### Hooks Integration

6. **Developer**: **Given** agent writes a file, **when** `PostToolUse` fires, **then** main process notifies renderer of file change - File browser can refresh

7. **Developer**: **Given** a subagent completes, **when** `SubagentStop` fires, **then** UI updates agent status - Multi-agent coordination

### Error Handling

8. **Developer**: **Given** SDK throws an error, **when** error occurs, **then** error is caught and displayed in UI - No silent failures

9. **Developer**: **Given** agent is interrupted, **when** `AbortError` is caught, **then** UI shows "Stopped by user" - Clear feedback

## Core Functionality

### SDK Integration

Replace CLI spawning with direct SDK `query()` calls:

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const stream = query({
  prompt: message,
  options: {
    cwd: repoPath,
    model: settings.model,
    permissionMode: settings.permissionMode,
    allowedTools: settings.allowedTools,
    resume: sessionId,
    settingSources: ['project'],  // Load .claude/settings.json, CLAUDE.md
    systemPrompt: agentFilePath ? { type: 'file', path: agentFilePath } : undefined,

    canUseTool: async (toolName, toolInput) => {
      // Show Electron permission dialog
      const approved = await showPermissionDialog(toolName, toolInput);
      return { behavior: approved ? 'allow' : 'deny' };
    },

    hooks: {
      PostToolUse: [{
        hook: async (input, toolUseId, context) => {
          notifyFileChange(input.tool_input?.file_path);
          return { continue: true };
        }
      }]
    }
  }
});

for await (const msg of stream) {
  // Typed messages - no JSON parsing needed
  handleMessage(msg);
}
```

### Message Streaming

Process typed SDK messages instead of parsing JSON lines:

| CLI Output | SDK Message Type |
|------------|------------------|
| `{"type": "system", "subtype": "init"}` | `msg.type === 'system' && msg.subtype === 'init'` |
| `{"type": "assistant", "message": {...}}` | `msg.type === 'assistant'` |
| `{"type": "tool_use", ...}` | Within `assistant` message content blocks |
| `{"type": "user", ...}` (tool results) | `msg.type === 'user'` |
| `{"type": "result", ...}` | `msg.type === 'result'` |

### Session Management

SDK session handling:

```typescript
let sessionId: string | undefined;

for await (const msg of stream) {
  if (msg.type === 'system' && msg.subtype === 'init') {
    sessionId = msg.session_id;
    // Store for later resumption
  }
}

// Resume later
const resumed = query({
  prompt: "Continue",
  options: { resume: sessionId }
});
```

### Interruption

Clean interruption via SDK method:

```typescript
// Store active streams
const activeStreams = new Map<string, Query>();

export function startAgent(conversationId: string, ...) {
  const stream = query({ prompt, options });
  activeStreams.set(conversationId, stream);
  // Process stream...
}

export function stopAgent(conversationId: string) {
  const stream = activeStreams.get(conversationId);
  if (stream) {
    stream.interrupt();  // Clean interruption
    activeStreams.delete(conversationId);
  }
}
```

### Permission Dialogs

Custom Electron permission UI via `canUseTool`:

```typescript
canUseTool: async (toolName, toolInput) => {
  // Show dialog in renderer via IPC
  const result = await new Promise((resolve) => {
    mainWindow.webContents.send('permission:request', {
      conversationId,
      tool: toolName,
      input: toolInput
    });

    ipcMain.once('permission:response', (_, response) => {
      resolve(response);
    });
  });

  return {
    behavior: result.approved ? 'allow' : 'deny',
    message: result.reason,
    interrupt: result.stopCompletely
  };
}
```

## Technical Requirements

### Electron Architecture

**Main Process:**
- Install SDK: `bun add @anthropic-ai/claude-agent-sdk`
- Replace `agent-service.ts` spawn logic with SDK `query()` calls
- Store active `Query` objects for interruption
- Handle `canUseTool` callbacks with IPC to renderer
- Implement SDK hooks for file change notifications

**Renderer Process:**
- Add permission dialog component
- Handle `permission:request` IPC events
- Send `permission:response` back to main
- No changes to message display (same message types)

**Preload Script:**
- Add `permission.request` and `permission.respond` to context bridge
- Expose interruption API: `window.api.agent.interrupt(conversationId)`

### Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.1.x"
  }
}
```

**Note:** SDK bundles Claude Code CLI internally - no separate CLI installation needed.

### Breaking Changes to Handle

From SDK v0.1.0 migration guide:
1. Must explicitly set `settingSources: ['project']` to load `.claude/settings.json`
2. Must specify system prompt explicitly (no default)
3. Package is `@anthropic-ai/claude-agent-sdk` (not `claude-code`)

### Message Format Compatibility

SDK messages use the same structure as CLI stream-json:
- No changes to `ConversationMessage` type
- No changes to message storage format (JSONL)
- `claudeMessage` field can store SDK message directly

### Files to Modify

| File | Changes |
|------|---------|
| `chorus/src/main/services/agent-service.ts` | Replace spawn with SDK query() |
| `chorus/src/main/index.ts` | Add permission IPC handlers |
| `chorus/src/preload/index.ts` | Add permission bridge APIs |
| `chorus/src/preload/index.d.ts` | Add permission TypeScript types |
| `chorus/src/renderer/src/components/Chat/PermissionDialog.tsx` | New component |
| `chorus/package.json` | Add SDK dependency |

### Files to Remove

| File | Reason |
|------|--------|
| None | CLI detection code can remain as fallback |

## Design Considerations

### Permission Dialog UI

The permission dialog should:
- Show tool name prominently
- Display tool input (file path, command, etc.)
- Offer "Allow", "Deny", "Allow all for session" options
- Match Chorus's Slack-like design
- Be modal but not blocking other conversations

### Error States

Handle SDK-specific errors:
- `AbortError` - User interrupted
- Connection errors - SDK internal issues
- Permission denied - User rejected tool

### Migration Strategy

Support both CLI and SDK during transition:
1. Add SDK as new code path
2. Feature flag to switch between CLI and SDK
3. Verify SDK behavior matches CLI
4. Remove CLI code path after validation

## Implementation Considerations

### Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Chorus Main Process                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   agent-service.ts                       ││
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ ││
│  │  │ query()     │    │ query()     │    │ query()     │ ││
│  │  │ Agent A     │    │ Agent B     │    │ Agent C     │ ││
│  │  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘ ││
│  │         │                  │                  │         ││
│  │         └──────────────────┼──────────────────┘         ││
│  │                            │                             ││
│  │                    ┌───────▼───────┐                    ││
│  │                    │ canUseTool    │                    ││
│  │                    │ callback      │                    ││
│  │                    └───────┬───────┘                    ││
│  └────────────────────────────┼─────────────────────────────┘│
│                               │ IPC                          │
├───────────────────────────────┼──────────────────────────────┤
│                    Renderer Process                          │
│                               ▼                              │
│                    ┌─────────────────┐                       │
│                    │ PermissionDialog│                       │
│                    │ Component       │                       │
│                    └─────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. User sends message
2. Main process calls `query({ prompt, options })`
3. SDK streams messages back
4. On tool requiring permission:
   - SDK calls `canUseTool` callback
   - Main sends IPC to renderer
   - Renderer shows permission dialog
   - User responds
   - Main returns response to SDK
   - SDK continues or stops based on response
5. Messages streamed to renderer via existing IPC
6. On completion, `result` message captured

### Performance

- SDK runs in-process: faster than subprocess spawn
- No CLI detection on each message
- Streaming performance should be equivalent or better
- Memory: SDK may use more memory than spawned process

## Success Criteria

### Core Functionality
- [ ] Messages stream identically to CLI approach
- [ ] Session resumption works correctly
- [ ] Interruption stops agent cleanly
- [ ] All current conversation settings work (model, permission mode, tools)

### Permission System
- [ ] `canUseTool` callback fires for tools requiring approval
- [ ] Custom permission dialog displays in Electron
- [ ] User can approve, deny, or stop entirely
- [ ] Approved tools execute, denied tools report failure to Claude

### Hooks
- [ ] `PostToolUse` fires after tool completion
- [ ] File change notifications reach renderer
- [ ] `SubagentStop` fires for subagent completion (if using subagents)

### Error Handling
- [ ] SDK errors are caught and displayed
- [ ] Interruption produces clear user feedback
- [ ] No orphaned processes or streams

### Backwards Compatibility
- [ ] Existing conversations continue to work
- [ ] Session IDs from CLI sessions can be resumed
- [ ] Message storage format unchanged

## Scope Boundaries

### Definitely In Scope
- Replace CLI spawn with SDK `query()` in agent-service.ts
- Implement `canUseTool` callback with Electron permission dialog
- Implement `PostToolUse` hook for file change notifications
- Handle interruption via `stream.interrupt()`
- Support all existing conversation settings

### Definitely Out of Scope
- Custom MCP tools via `tool()` and `createSdkMcpServer()` (future sprint)
- Subagent definitions via `agents` option (future sprint)
- Structured output validation (future sprint)
- Multi-agent orchestration patterns (future sprint)

### Future Considerations
- Custom in-process MCP tools for inter-agent communication
- Subagent definitions for specialized tasks
- Session forking for parallel exploration
- Cost tracking dashboard with per-agent attribution

## Open Questions & Risks

### Questions Needing Resolution
1. **SDK in Electron main process**: Does the SDK work correctly in Electron's main process? May need testing.
2. **Permission dialog blocking**: How to handle permission requests while allowing other conversations to continue?
3. **Session migration**: Can existing CLI sessions be resumed with SDK, or do they need fresh starts?
4. **System prompt handling**: How to pass agent markdown files as system prompts? (file path vs content)

### Identified Risks
1. **SDK maturity**: SDK is relatively new (v0.1.x). May encounter bugs or missing features.
2. **Electron compatibility**: SDK may have assumptions about Node.js environment that differ in Electron.
3. **Breaking changes**: Future SDK versions may introduce breaking changes.
4. **Memory usage**: In-process SDK may use more memory than subprocess approach.

### Mitigation Strategies
- Keep CLI code as fallback during transition
- Pin SDK version to avoid unexpected updates
- Test thoroughly in Electron environment before full migration
- Monitor memory usage in development

## Next Steps

1. Install SDK and verify basic `query()` works in Electron main process
2. Create minimal proof-of-concept replacing one agent call
3. Implement permission dialog component
4. Full migration of agent-service.ts
5. Testing and validation
6. Remove CLI fallback code (optional, keep if valuable)

## Sources

- [SDK Migration Guide](docs/3-tools/claude-code/sdk-migration-guide.md)
- [Claude Agent SDK Documentation](docs/3-tools/claude-code/claude-agent-sdk.md)
- [Session Management](docs/3-tools/claude-code/session-management.md)
- [Permissions](docs/3-tools/claude-code/permissions.md)
- [Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [Agent SDK Permissions](https://platform.claude.com/docs/en/agent-sdk/permissions)
- [NPM: @anthropic-ai/claude-agent-sdk](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)
