# Hooks

Hooks are in-process callbacks that fire at specific points in the agent lifecycle. They enable logging, modification, and coordination without external shell commands.

## Available Hook Events

| Event | When | Can Block? |
|-------|------|------------|
| `PreToolUse` | Before tool execution | Yes |
| `PostToolUse` | After tool completion | No |
| `UserPromptSubmit` | User submits prompt | Yes |
| `Stop` | Agent finishes responding | No |
| `SubagentStart` | Subagent begins | No |
| `SubagentStop` | Subagent completes | No |
| `PreCompact` | Before context compaction | No |
| `SessionStart` | Session begins | No |
| `SessionEnd` | Session ends | No |
| `Notification` | Agent sends notification | No |
| `PermissionRequest` | During permission prompt | Yes |

---

## Hook Configuration

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const stream = query({
  prompt: "Task",
  options: {
    hooks: {
      PreToolUse: [{
        matcher: 'Write',  // Optional: filter by tool name
        hooks: [async (input, toolUseId, { signal }) => {
          console.log('Writing to:', input.tool_input?.file_path);
          return { continue: true };
        }],
        timeout: 60000  // Default 60 seconds
      }],
      PostToolUse: [{
        hooks: [async (input, toolUseId, { signal }) => {
          console.log('Tool completed:', input.tool_name);
          return { continue: true };
        }]
      }]
    }
  }
});
```

---

## Hook Callback Signature

```typescript
type HookCallback = (
  input: HookInput,
  toolUseID: string | undefined,
  options: { signal: AbortSignal }
) => Promise<HookJSONOutput>;
```

---

## Hook Input Types

### PreToolUse

```typescript
interface PreToolUseHookInput {
  hook_event_name: 'PreToolUse';
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode?: string;
  tool_name: string;
  tool_input: unknown;
  tool_use_id: string;
}
```

### PostToolUse

```typescript
interface PostToolUseHookInput {
  hook_event_name: 'PostToolUse';
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode?: string;
  tool_name: string;
  tool_input: unknown;
  tool_response: unknown;
  tool_use_id: string;
}
```

### SubagentStop

```typescript
interface SubagentStopHookInput {
  hook_event_name: 'SubagentStop';
  session_id: string;
  transcript_path: string;
  cwd: string;
  stop_hook_active: boolean;
  agent_id: string;
  agent_transcript_path: string;
}
```

### UserPromptSubmit

```typescript
interface UserPromptSubmitHookInput {
  hook_event_name: 'UserPromptSubmit';
  session_id: string;
  transcript_path: string;
  cwd: string;
  prompt: string;
}
```

### SessionStart

```typescript
interface SessionStartHookInput {
  hook_event_name: 'SessionStart';
  session_id: string;
  transcript_path: string;
  cwd: string;
  source: 'startup' | 'resume' | 'clear' | 'compact';
}
```

### SessionEnd

```typescript
interface SessionEndHookInput {
  hook_event_name: 'SessionEnd';
  session_id: string;
  transcript_path: string;
  cwd: string;
  reason: string;  // Exit reason
}
```

### Stop

```typescript
interface StopHookInput {
  hook_event_name: 'Stop';
  session_id: string;
  transcript_path: string;
  cwd: string;
  stop_hook_active: boolean;
}
```

### PreCompact

```typescript
interface PreCompactHookInput {
  hook_event_name: 'PreCompact';
  session_id: string;
  transcript_path: string;
  cwd: string;
  trigger: 'manual' | 'auto';
  custom_instructions: string | null;
}
```

---

## Hook Output Types

### Basic Output

```typescript
interface SyncHookJSONOutput {
  continue?: boolean;        // Continue execution
  suppressOutput?: boolean;  // Hide from output
  stopReason?: string;       // Reason if stopping
  decision?: 'approve' | 'block';
  systemMessage?: string;    // Add system message
  reason?: string;           // Reason for decision
  hookSpecificOutput?: HookSpecificOutput;
}
```

### PreToolUse Specific Output

```typescript
hookSpecificOutput: {
  hookEventName: 'PreToolUse';
  permissionDecision?: 'allow' | 'deny' | 'ask';
  permissionDecisionReason?: string;
  updatedInput?: Record<string, unknown>;  // Modify tool input
}
```

### PostToolUse Specific Output

```typescript
hookSpecificOutput: {
  hookEventName: 'PostToolUse';
  additionalContext?: string;
  updatedMCPToolOutput?: unknown;  // Modify MCP tool output
}
```

### UserPromptSubmit Specific Output

```typescript
hookSpecificOutput: {
  hookEventName: 'UserPromptSubmit';
  additionalContext?: string;  // Add context to prompt
}
```

---

## Common Hook Patterns

### Log File Changes

```typescript
hooks: {
  PostToolUse: [{
    matcher: 'Write|Edit',  // Match Write or Edit
    hooks: [async (input) => {
      console.log('File changed:', input.tool_input?.file_path);
      // Notify UI
      emitFileChange(input.tool_input?.file_path);
      return { continue: true };
    }]
  }]
}
```

### Track Todo Updates

```typescript
hooks: {
  PostToolUse: [{
    matcher: 'TodoWrite',
    hooks: [async (input) => {
      const todos = input.tool_input?.todos;
      // Update UI with todo state
      emitTodoUpdate(todos);
      return { continue: true };
    }]
  }]
}
```

### Block Dangerous Commands

```typescript
hooks: {
  PreToolUse: [{
    matcher: 'Bash',
    hooks: [async (input) => {
      const command = input.tool_input?.command;

      if (command?.includes('rm -rf')) {
        return {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: 'Dangerous command blocked'
          }
        };
      }

      return { continue: true };
    }]
  }]
}
```

### Modify Tool Input

```typescript
hooks: {
  PreToolUse: [{
    matcher: 'Write',
    hooks: [async (input) => {
      // Add header to all written files
      const content = input.tool_input?.content;
      const modifiedContent = `// Auto-generated\n${content}`;

      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          updatedInput: {
            ...input.tool_input,
            content: modifiedContent
          }
        }
      };
    }]
  }]
}
```

### Subagent Coordination

```typescript
hooks: {
  SubagentStop: [{
    hooks: [async (input) => {
      console.log('Subagent completed:', input.agent_id);
      // Notify orchestrator
      notifyAgentComplete(input.agent_id, input.agent_transcript_path);
      return { continue: true };
    }]
  }]
}
```

### Add Context to Prompts

```typescript
hooks: {
  UserPromptSubmit: [{
    hooks: [async (input) => {
      // Add current time context
      return {
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: `Current time: ${new Date().toISOString()}`
        }
      };
    }]
  }]
}
```

---

## Hook Matchers

The `matcher` field filters which tools trigger the hook:

| Pattern | Matches |
|---------|---------|
| `'Write'` | Write tool only |
| `'Write\|Edit'` | Write or Edit |
| `'mcp__*'` | All MCP tools |
| `'*'` or omitted | All tools |

---

## Timeouts

Default timeout is 60 seconds. Override per hook:

```typescript
hooks: {
  PreToolUse: [{
    hooks: [/* ... */],
    timeout: 120000  // 2 minutes
  }]
}
```

---

## Async Hooks

For long-running operations, return async output:

```typescript
interface AsyncHookJSONOutput {
  async: true;
  asyncTimeout?: number;  // Override timeout
}
```

---

## Chorus Implementation

### File Change Tracking

```typescript
// chorus/src/main/services/agent-sdk-service.ts

hooks: {
  PostToolUse: [{
    hooks: [async (input, toolUseId) => {
      const toolName = input.tool_name;

      if (toolName === 'Write' || toolName === 'Edit') {
        const filePath = input.tool_input?.file_path;

        // Emit to renderer
        mainWindow.webContents.send('agent:file-changed', {
          conversationId,
          file: filePath,
          toolUseId
        });
      }

      return { continue: true };
    }]
  }]
}
```

### TodoWrite Interception

```typescript
// Track todo state from TodoWrite tool calls

hooks: {
  PostToolUse: [{
    matcher: 'TodoWrite',
    hooks: [async (input) => {
      const todos = input.tool_input?.todos;

      // Emit to renderer
      mainWindow.webContents.send('agent:todo-update', {
        conversationId,
        todos
      });

      return { continue: true };
    }]
  }]
}
```

### Renderer State Updates

```typescript
// chorus/src/renderer/src/stores/chat-store.ts

// File changes
window.api.agent.onFileChanged((event) => {
  const files = conversationFiles.get(event.conversationId) || [];
  if (!files.includes(event.file)) {
    conversationFiles.set(event.conversationId, [...files, event.file]);
  }
});

// Todo updates
window.api.agent.onTodoUpdate((event) => {
  conversationTodos.set(event.conversationId, event.todos);
});
```

### ConversationDetails Display

```typescript
// chorus/src/renderer/src/components/Chat/ConversationDetails.tsx

function ConversationDetails({ conversationId }) {
  const files = useConversationFiles(conversationId);
  const todos = useConversationTodos(conversationId);

  return (
    <div>
      <section>
        <h3>Files Changed</h3>
        {files.map(file => (
          <FileItem key={file} path={file} onClick={openFile} />
        ))}
      </section>

      <section>
        <h3>Todo List</h3>
        {todos.map(todo => (
          <TodoItem
            key={todo.content}
            content={todo.content}
            status={todo.status}
          />
        ))}
      </section>
    </div>
  );
}
```

---

## Best Practices

### 1. Keep Hooks Fast

Hooks block execution. Keep them lightweight:

```typescript
// Good: Quick notification
hooks: [async (input) => {
  emit('file-changed', input.tool_input?.file_path);
  return { continue: true };
}]

// Bad: Heavy processing
hooks: [async (input) => {
  await analyzeFileContents(input.tool_response);  // Slow!
  return { continue: true };
}]
```

### 2. Handle Errors Gracefully

```typescript
hooks: [async (input) => {
  try {
    await notify(input);
  } catch (err) {
    console.error('Hook error:', err);
    // Don't block execution
  }
  return { continue: true };
}]
```

### 3. Use Matchers to Reduce Overhead

```typescript
// Good: Only runs for Write tools
matcher: 'Write',
hooks: [/* ... */]

// Less efficient: Runs for all tools, then filters
hooks: [async (input) => {
  if (input.tool_name !== 'Write') return { continue: true };
  // ...
}]
```

### 4. Respect AbortSignal

```typescript
hooks: [async (input, toolUseId, { signal }) => {
  // Check if aborted
  if (signal.aborted) {
    return { continue: false };
  }

  // Pass to async operations
  await fetch(url, { signal });

  return { continue: true };
}]
```

---

## References

- [SDK Hooks Documentation](https://platform.claude.com/docs/en/agent-sdk/plugins)
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide)
