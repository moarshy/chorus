# Query API

The `query()` function is the primary entry point for the Claude Agent SDK. It returns an async generator that yields messages as Claude processes your request.

## Function Signature

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

function query(params: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}): Query;

// Query extends AsyncGenerator with control methods
interface Query extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>;
  setPermissionMode(mode: PermissionMode): Promise<void>;
  setModel(model?: string): Promise<void>;
  setMaxThinkingTokens(maxThinkingTokens: number | null): Promise<void>;
  supportedCommands(): Promise<SlashCommand[]>;
  supportedModels(): Promise<ModelInfo[]>;
  mcpServerStatus(): Promise<McpServerStatus[]>;
  accountInfo(): Promise<AccountInfo>;
  streamInput(stream: AsyncIterable<SDKUserMessage>): Promise<void>;
}
```

## Basic Usage

```typescript
// Simple query
for await (const message of query({ prompt: "What files are here?" })) {
  console.log(message);
}

// With options
const stream = query({
  prompt: "Analyze this codebase",
  options: {
    cwd: '/path/to/workspace',
    model: 'sonnet'
  }
});

for await (const message of stream) {
  // Process messages
}
```

---

## Options Reference

### Working Directory

```typescript
options: {
  cwd: '/path/to/workspace'  // Agent starts here
}
```

The agent's working directory. File operations default to this path.

> **Security Warning**: The `cwd` option does **NOT** enforce strict directory boundaries. Agents can use absolute paths to access files outside the workspace. Implement path validation in `canUseTool` to enforce boundaries. See [11-security.md](./11-security.md) for details.

---

### Model Selection

```typescript
options: {
  model: 'sonnet'  // Model alias or full ID
}
```

| Alias | Full Model ID |
|-------|---------------|
| `'sonnet'` | `claude-sonnet-4-20250514` |
| `'opus'` | `claude-opus-4-20250514` |
| `'haiku'` | `claude-haiku-3-5-20241022` |

You can also use full model IDs directly.

---

### Permission Mode

```typescript
options: {
  permissionMode: 'default'
}
```

| Mode | Behavior |
|------|----------|
| `'default'` | Ask for permission on sensitive operations |
| `'acceptEdits'` | Auto-accept file edits, ask for other ops |
| `'bypassPermissions'` | Skip all permission checks (dangerous) |
| `'plan'` | Read-only mode, no modifications |
| `'dontAsk'` | Don't ask, just deny if not allowed |

---

### Tool Control

```typescript
options: {
  allowedTools: ['Read', 'Write', 'Bash(git *)'],
  disallowedTools: ['Bash(rm *)']
}
```

**Pattern Syntax:**

| Pattern | Description |
|---------|-------------|
| `'Read'` | Allow all Read operations |
| `'Bash(git *)'` | Allow any git command |
| `'Bash(npm install)'` | Specific command only |
| `'Write(src/*)'` | Write only in src/ |
| `'mcp__server__*'` | All tools from MCP server |

---

### Session Management

```typescript
options: {
  resume: 'session-id',     // Resume specific session
  continue: true,           // Resume most recent
  forkSession: true,        // Branch from resumed session
  resumeSessionAt: 'msg-uuid'  // Resume from specific message
}
```

See [3-sessions.md](./3-sessions.md) for details.

---

### Execution Limits

```typescript
options: {
  maxTurns: 10,           // Max conversation turns
  maxBudgetUsd: 1.00      // Max spend in USD
}
```

When limits are hit, the result message has subtype `'error_max_turns'` or `'error_max_budget_usd'`.

---

### System Prompt

```typescript
// Use Claude Code preset (recommended)
options: {
  systemPrompt: {
    type: 'preset',
    preset: 'claude_code'
  }
}

// Append to preset
options: {
  systemPrompt: {
    type: 'preset',
    preset: 'claude_code',
    append: 'Additional instructions here...'
  }
}

// Custom system prompt (replaces default)
options: {
  systemPrompt: 'You are a helpful assistant...'
}
```

**Important:** Without `systemPrompt`, the agent won't have Claude Code capabilities.

---

### Settings Sources

```typescript
options: {
  settingSources: ['project', 'user', 'local']
}
```

| Source | Location | Purpose |
|--------|----------|---------|
| `'project'` | `.claude/settings.json` | Project-shared settings |
| `'user'` | `~/.claude/settings.json` | User-wide settings |
| `'local'` | `.claude/settings.local.json` | Local overrides (gitignored) |

**Important:** SDK loads NO settings by default. You must explicitly include sources to load `CLAUDE.md`, slash commands, etc.

---

### Permission Callback

```typescript
options: {
  canUseTool: async (toolName, input, options) => {
    const approved = await showDialog(toolName, input);

    if (approved) {
      return {
        behavior: 'allow',
        updatedInput: input
      };
    } else {
      return {
        behavior: 'deny',
        message: 'User rejected',
        interrupt: true  // Stop execution
      };
    }
  }
}
```

See [4-permissions.md](./4-permissions.md) for details.

---

### Hooks

```typescript
options: {
  hooks: {
    PreToolUse: [{
      matcher: 'Write',  // Optional filter
      hooks: [async (input, toolUseId, { signal }) => {
        console.log('Writing:', input.file_path);
        return { continue: true };
      }],
      timeout: 60000
    }],
    PostToolUse: [{
      hooks: [async (input, toolUseId, { signal }) => {
        return { continue: true };
      }]
    }]
  }
}
```

See [5-hooks.md](./5-hooks.md) for details.

---

### Subagents

```typescript
options: {
  agents: {
    'reviewer': {
      description: 'Code review specialist',
      prompt: 'You are a senior reviewer...',
      tools: ['Read', 'Grep', 'Glob'],
      model: 'sonnet'
    },
    'researcher': {
      description: 'Research and analysis',
      prompt: 'You are a researcher...',
      tools: ['Read', 'WebSearch'],
      model: 'haiku'
    }
  }
}
```

See [6-subagents.md](./6-subagents.md) for details.

---

### MCP Servers

```typescript
import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';

options: {
  mcpServers: {
    'custom': createSdkMcpServer({
      name: 'custom',
      tools: [/* ... */]
    })
  }
}
```

See [7-tools.md](./7-tools.md) for details.

---

### Streaming Options

```typescript
options: {
  includePartialMessages: true  // Enable real-time text streaming
}
```

See [8-streaming.md](./8-streaming.md) for details.

---

### Extended Thinking

```typescript
options: {
  maxThinkingTokens: 10000  // Limit thinking tokens (opus models)
}
```

---

### Structured Output

```typescript
options: {
  outputFormat: {
    type: 'json_schema',
    schema: {
      type: 'object',
      properties: {
        answer: { type: 'string' },
        confidence: { type: 'number' }
      },
      required: ['answer']
    }
  }
}
```

Access via `resultMessage.structured_output`.

---

### Environment Variables

```typescript
options: {
  env: {
    'MY_API_KEY': 'value',
    'DEBUG': 'true'
  }
}
```

Additional environment variables for the session.

---

### Additional Directories

```typescript
options: {
  additionalDirectories: ['/shared/libs', '/data']
}
```

Extra directories the agent can access beyond `cwd`.

---

### Abort Controller

```typescript
const controller = new AbortController();

const stream = query({
  prompt: "Long task",
  options: {
    abortController: controller
  }
});

// Later: cancel the query
controller.abort();
```

---

## Complete Options Type

```typescript
type Options = {
  abortController?: AbortController;
  additionalDirectories?: string[];
  agents?: Record<string, AgentDefinition>;
  allowedTools?: string[];
  canUseTool?: CanUseTool;
  continue?: boolean;
  cwd?: string;
  disallowedTools?: string[];
  env?: { [envVar: string]: string | undefined };
  executable?: 'bun' | 'deno' | 'node';
  executableArgs?: string[];
  extraArgs?: Record<string, string | null>;
  fallbackModel?: string;
  forkSession?: boolean;
  hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
  includePartialMessages?: boolean;
  maxThinkingTokens?: number;
  maxTurns?: number;
  maxBudgetUsd?: number;
  mcpServers?: Record<string, McpServerConfig>;
  model?: string;
  outputFormat?: OutputFormat;
  pathToClaudeCodeExecutable?: string;
  permissionMode?: PermissionMode;
  allowDangerouslySkipPermissions?: boolean;
  permissionPromptToolName?: string;
  plugins?: SdkPluginConfig[];
  resume?: string;
  resumeSessionAt?: string;
  settingSources?: SettingSource[];
  stderr?: (data: string) => void;
  strictMcpConfig?: boolean;
  systemPrompt?: string | {
    type: 'preset';
    preset: 'claude_code';
    append?: string;
  };
};
```

---

## Query Control Methods

### interrupt()

Stop the current execution:

```typescript
const stream = query({ prompt: "Long task" });

setTimeout(() => {
  stream.interrupt();
}, 30000);

try {
  for await (const msg of stream) {
    // Process messages
  }
} catch (err) {
  if (err.name === 'AbortError') {
    console.log('Interrupted');
  }
}
```

### setPermissionMode()

Change permission mode mid-stream:

```typescript
const stream = query({ prompt: "Task" });

// Escalate after initial review
stream.setPermissionMode('acceptEdits');
```

### setModel()

Change model mid-stream:

```typescript
stream.setModel('opus');  // Switch to more capable model
```

### supportedCommands()

Get available slash commands:

```typescript
const stream = query({ prompt: "Hello" });
const commands = await stream.supportedCommands();
console.log(commands);
// [{ name: 'help', description: '...', argumentHint: '' }, ...]
```

### supportedModels()

Get available models:

```typescript
const models = await stream.supportedModels();
// [{ value: 'claude-sonnet-4-20250514', displayName: 'Sonnet 4', description: '...' }]
```

---

## Chorus Implementation

### SDK Service Configuration

```typescript
// chorus/src/main/services/agent-sdk-service.ts

import { query } from '@anthropic-ai/claude-agent-sdk';

export async function* sendMessageStream(
  repoPath: string,
  message: string,
  settings: ConversationSettings,
  sessionId?: string,
  onPermissionRequest?: PermissionCallback
) {
  const abortController = new AbortController();

  const options: Parameters<typeof query>[0]['options'] = {
    cwd: repoPath,
    abortController,
    settingSources: ['project', 'user'],
    includePartialMessages: true,
  };

  // Model
  if (settings.model) {
    options.model = settings.model;
  }

  // Permission mode
  if (settings.permissionMode) {
    options.permissionMode = settings.permissionMode;
  }

  // Allowed tools
  if (settings.allowedTools?.length) {
    options.allowedTools = settings.allowedTools;
  }

  // Session resumption
  if (sessionId) {
    options.resume = sessionId;
  }

  // System prompt (only for new sessions)
  if (!sessionId) {
    options.systemPrompt = {
      type: 'preset',
      preset: 'claude_code'
    };
  }

  // Permission callback
  if (onPermissionRequest) {
    options.canUseTool = async (toolName, input, opts) => {
      const result = await onPermissionRequest(toolName, input, opts);
      return result;
    };
  }

  // Hooks for file tracking
  options.hooks = {
    PostToolUse: [{
      hooks: [async (input, toolUseId) => {
        if (input.tool_name === 'Write' || input.tool_name === 'Edit') {
          // Emit file change event
          mainWindow.webContents.send('agent:file-changed', {
            file: input.tool_input?.file_path
          });
        }
        return { continue: true };
      }]
    }]
  };

  const stream = query({ prompt: message, options });

  for await (const msg of stream) {
    yield msg;
  }
}
```

---

## References

- [SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [Options Documentation](https://platform.claude.com/docs/en/agent-sdk/overview)
