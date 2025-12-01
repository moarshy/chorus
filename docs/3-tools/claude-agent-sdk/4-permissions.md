# Permissions

The Claude Agent SDK provides multiple mechanisms for controlling tool execution: permission modes, the `canUseTool` callback, and permission rules.

## Permission Modes

Set the overall permission behavior:

```typescript
options: {
  permissionMode: 'default'  // 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk'
}
```

| Mode | Behavior |
|------|----------|
| `'default'` | Ask for permission on sensitive operations |
| `'acceptEdits'` | Auto-accept file edits (`Write`, `Edit`), ask for others |
| `'bypassPermissions'` | Skip all permission checks (**dangerous**) |
| `'plan'` | Read-only mode, no modifications allowed |
| `'dontAsk'` | Don't prompt, just deny if not pre-allowed |

### Warning: bypassPermissions

Only use in isolated environments (containers, VMs). The agent can:
- Delete files
- Execute arbitrary commands
- Modify system files

---

## canUseTool Callback

The primary SDK mechanism for programmatic permission approval. Fires when a permission prompt would normally show.

### Basic Usage

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const stream = query({
  prompt: "Edit the config file",
  options: {
    canUseTool: async (toolName, input, options) => {
      console.log(`Tool: ${toolName}`);
      console.log(`Input:`, input);

      // Approve
      return {
        behavior: 'allow',
        updatedInput: input
      };
    }
  }
});
```

### Callback Signature

```typescript
type CanUseTool = (
  toolName: string,
  input: Record<string, unknown>,
  options: {
    signal: AbortSignal;
    suggestions?: PermissionUpdate[];
    blockedPath?: string;
    decisionReason?: string;
    toolUseID: string;
    agentID?: string;
  }
) => Promise<PermissionResult>;
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `toolName` | `string` | Tool being called: `'Read'`, `'Write'`, `'Bash'`, etc. |
| `input` | `Record<string, unknown>` | Tool-specific input (e.g., `{ file_path: '...' }`) |
| `options.signal` | `AbortSignal` | Abort signal if operation cancelled |
| `options.suggestions` | `PermissionUpdate[]` | Suggested permission rules to add |
| `options.blockedPath` | `string` | Path that triggered the permission (if applicable) |
| `options.decisionReason` | `string` | Why this permission was requested |
| `options.toolUseID` | `string` | Unique ID for this tool call |
| `options.agentID` | `string` | Subagent ID if from Task tool |

### Return Value: PermissionResult

**Allow:**

```typescript
{
  behavior: 'allow',
  updatedInput: input,  // Can modify input before execution
  updatedPermissions?: PermissionUpdate[]  // Optional: add to allowlist
}
```

**Deny:**

```typescript
{
  behavior: 'deny',
  message: 'User rejected this action',  // Feedback to agent
  interrupt?: boolean  // true = stop execution entirely
}
```

### Complete Example with UI

```typescript
const stream = query({
  prompt: "Update the config",
  options: {
    canUseTool: async (toolName, input, { signal, suggestions, toolUseID }) => {
      // Show dialog to user
      const result = await showPermissionDialog({
        tool: toolName,
        input: input,
        suggestions: suggestions
      });

      if (result.approved) {
        return {
          behavior: 'allow',
          updatedInput: result.modifiedInput || input,
          // Use suggestions for "always allow" feature
          updatedPermissions: result.alwaysAllow ? suggestions : undefined
        };
      } else {
        return {
          behavior: 'deny',
          message: result.reason || 'User rejected',
          interrupt: result.stopCompletely
        };
      }
    }
  }
});
```

---

## Tool Allowlist/Denylist

Pre-approve or block tools without callbacks:

```typescript
options: {
  allowedTools: [
    'Read',              // All Read operations
    'Write(src/*)',      // Write only in src/
    'Bash(git *)',       // Git commands
    'Bash(npm install)', // Specific command
  ],
  disallowedTools: [
    'Bash(rm *)',        // Block rm commands
    'Bash(sudo *)',      // Block sudo
  ]
}
```

### Pattern Syntax

| Pattern | Matches |
|---------|---------|
| `'Read'` | All Read tool calls |
| `'Write(src/*)'` | Write to files in src/ |
| `'Bash(git *)'` | Any git command |
| `'Bash(git commit:*)'` | Git commits with any message |
| `'Bash(npm install)'` | Exact npm install command |
| `'mcp__server__*'` | All tools from MCP server |
| `'mcp__github__list_issues'` | Specific MCP tool |

---

## Permission Processing Order

When a tool is called, permissions are evaluated in this order:

```
1. PreToolUse Hook (can block)
        ↓
2. Deny Rules (disallowedTools)
        ↓
3. Allow Rules (allowedTools)
        ↓
4. Ask Rules (permission prompts)
        ↓
5. Permission Mode
        ↓
6. canUseTool Callback
        ↓
7. PostToolUse Hook
```

**Note:** Hooks take precedence and can override even `bypassPermissions` mode.

---

## Permission Updates (Always Allow)

The `suggestions` parameter in `canUseTool` provides rules to add for "always allow":

```typescript
interface PermissionUpdate {
  type: 'addRules' | 'replaceRules' | 'removeRules' | 'setMode' | 'addDirectories' | 'removeDirectories';
  rules?: PermissionRuleValue[];
  behavior?: 'allow' | 'deny' | 'ask';
  destination: 'userSettings' | 'projectSettings' | 'localSettings' | 'session' | 'cliArg';
}

interface PermissionRuleValue {
  toolName: string;
  ruleContent?: string;  // Pattern like "src/*"
}
```

### Using Suggestions

```typescript
canUseTool: async (toolName, input, { suggestions }) => {
  const result = await showDialog(toolName, input);

  if (result.approved && result.alwaysAllow) {
    // Return suggestions to enable "always allow"
    return {
      behavior: 'allow',
      updatedInput: input,
      updatedPermissions: suggestions
    };
  }

  return { behavior: 'allow', updatedInput: input };
}
```

---

## Chorus Implementation

### Permission Dialog

```typescript
// chorus/src/renderer/src/components/dialogs/PermissionDialog.tsx

interface PermissionDialogProps {
  tool: string;
  input: Record<string, unknown>;
  onApprove: (modifiedInput?: Record<string, unknown>) => void;
  onDeny: (reason?: string, interrupt?: boolean) => void;
}

function PermissionDialog({ tool, input, onApprove, onDeny }: PermissionDialogProps) {
  const [reason, setReason] = useState('');

  return (
    <Dialog>
      <DialogTitle>Permission Request</DialogTitle>
      <DialogContent>
        <p>Claude wants to use: <strong>{tool}</strong></p>
        <pre>{JSON.stringify(input, null, 2)}</pre>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onApprove()}>Allow</Button>
        <Button onClick={() => onDeny(reason, false)}>Deny</Button>
        <Button onClick={() => onDeny(reason, true)}>Deny & Stop</Button>
      </DialogActions>
    </Dialog>
  );
}
```

### IPC Flow

```typescript
// Main process: agent-sdk-service.ts
canUseTool: async (toolName, input, options) => {
  return new Promise((resolve) => {
    // Request permission from renderer
    mainWindow.webContents.send('agent:permission-request', {
      conversationId,
      toolName,
      input,
      toolUseId: options.toolUseID
    });

    // Wait for response
    ipcMain.once(`agent:permission-response:${options.toolUseID}`, (_, result) => {
      resolve(result);
    });
  });
}

// Renderer: chat-store.ts
window.api.agent.onPermissionRequest((event) => {
  // Show dialog
  setPermissionRequest({
    conversationId: event.conversationId,
    tool: event.toolName,
    input: event.input,
    toolUseId: event.toolUseId
  });
});

// User responds
function handlePermissionResponse(approved: boolean, reason?: string) {
  window.api.agent.respondToPermission({
    toolUseId: permissionRequest.toolUseId,
    result: approved
      ? { behavior: 'allow', updatedInput: permissionRequest.input }
      : { behavior: 'deny', message: reason, interrupt: false }
  });
}
```

### Settings Storage

```typescript
// Conversation-level settings
interface ConversationSettings {
  permissionMode: PermissionMode;
  allowedTools: string[];
  model: string;
}

// Stored in conversation and passed to SDK
const options = {
  permissionMode: conversation.settings.permissionMode,
  allowedTools: conversation.settings.allowedTools,
  canUseTool: onPermissionRequest
};
```

---

## Best Practices

### 1. Default to Restrictive

Start with `'default'` mode and explicit allowlist:

```typescript
options: {
  permissionMode: 'default',
  allowedTools: ['Read', 'Glob', 'Grep']  // Read-only by default
}
```

### 2. Provide Feedback on Denial

Help the agent understand what to do instead:

```typescript
return {
  behavior: 'deny',
  message: 'Cannot delete files. Please suggest an alternative approach.',
  interrupt: false  // Let agent continue
};
```

### 3. Use interrupt Sparingly

`interrupt: true` stops all execution. Use only when:
- User explicitly wants to stop
- Dangerous operation attempted

### 4. Log Permission Decisions

Track for auditing:

```typescript
canUseTool: async (toolName, input, options) => {
  const result = await getPermission(toolName, input);

  logPermissionDecision({
    tool: toolName,
    input: input,
    decision: result.behavior,
    timestamp: new Date()
  });

  return result;
}
```

---

## References

- [SDK Permissions Documentation](https://platform.claude.com/docs/en/agent-sdk/permissions)
- [Claude Code Settings](https://code.claude.com/docs/en/settings)
