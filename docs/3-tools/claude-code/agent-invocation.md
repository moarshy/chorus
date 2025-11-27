# Agent Invocation Patterns

How to invoke Claude Code agents from CLI and SDK.

---

## CLI Invocation

### Basic Commands

```bash
# Interactive REPL
claude

# Start with initial prompt
claude "your prompt here"

# Continue most recent conversation
claude -c

# Resume specific session
claude -r "<session-id>"

# Non-interactive (print mode) - run once and exit
claude -p "query"

# With JSON output
claude -p --output-format json "query"

# Process piped input
cat file.txt | claude -p "analyze this"
```

### Key Flags

| Flag | Purpose |
|------|---------|
| `-p, --print` | Non-interactive mode, output to stdout |
| `-c, --continue` | Resume most recent conversation |
| `-r, --resume <id>` | Resume specific session by ID |
| `--agents <json>` | Define custom subagents |
| `--system-prompt <text>` | Custom system instructions |
| `--system-prompt-file <path>` | Load system prompt from file |
| `--permission-mode <mode>` | `default`, `acceptEdits`, `plan`, `bypassPermissions` |
| `--max-turns <n>` | Limit conversation turns |
| `--allowedTools <list>` | Whitelist specific tools |
| `--disallowedTools <list>` | Block specific tools |
| `--model <name>` | Model selection |
| `--verbose` | Detailed logging |
| `--output-format <fmt>` | `text`, `json`, `stream-json` |

### Agent Definition via CLI

```bash
claude --agents '{
  "reviewer": {
    "description": "Code review specialist",
    "prompt": "You are a senior code reviewer...",
    "tools": ["Read", "Grep", "Glob"],
    "model": "sonnet"
  }
}' "Review the authentication module"
```

---

## Conversation Flow

When you invoke an agent, this is the flow:

```
┌─────────────────────────────────────────────────────────────┐
│                    User Invocation                           │
│            claude "create a new feature"                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Initialization                            │
│  - Load CLAUDE.md (if settingSources includes 'project')    │
│  - Load .claude/settings.json                                │
│  - Set up tool permissions                                   │
│  - Initialize MCP servers                                    │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Context Gathering                           │
│  - Read relevant files                                       │
│  - Load conversation history (if resuming)                   │
│  - Analyze working directory                                 │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Agent Execution Loop                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  1. Gather context (read, search, analyze)           │   │
│  │  2. Take action (write, run commands, call tools)    │   │
│  │  3. Verify work (check results, run tests)           │   │
│  │  4. Decide: continue or complete?                    │   │
│  │                     │                                │   │
│  │                     ▼                                │   │
│  │            [Continue? Loop back to 1]                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Result & Cleanup                           │
│  - Report cost (total_cost_usd)                             │
│  - Save session for potential resume                         │
│  - Return final message                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## SDK Invocation

### TypeScript

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

// Basic query
for await (const message of query({ prompt: "your task" })) {
  switch (message.type) {
    case 'system':
      console.log('Session ID:', message.session_id);
      break;
    case 'assistant':
      console.log('Assistant:', message.message.content);
      break;
    case 'tool_use':
      console.log('Tool:', message.tool_name);
      break;
    case 'tool_result':
      console.log('Result:', message.result);
      break;
    case 'result':
      console.log('Cost: $', message.total_cost_usd);
      break;
  }
}
```

### With Full Options

```typescript
const stream = query({
  prompt: "your task",
  options: {
    // Working directory
    cwd: '/path/to/workspace',

    // Session management
    resume: sessionId,           // Resume specific session
    continue: true,              // Resume most recent
    forkSession: true,           // Branch from existing

    // Configuration
    model: 'sonnet',
    maxTurns: 10,
    permissionMode: 'acceptEdits',

    // Load project settings
    settingSources: ['project'],  // Loads CLAUDE.md

    // Tool control
    allowedTools: ['Read', 'Write', 'Bash'],
    disallowedTools: ['mcp__*'],

    // System prompt
    systemPrompt: {
      type: 'preset',
      preset: 'claude_code'
    },

    // Subagents
    agents: {
      'reviewer': {
        description: 'Code review specialist',
        prompt: 'You are a senior reviewer...',
        tools: ['Read', 'Grep', 'Glob'],
        model: 'sonnet'
      }
    },

    // Hooks for coordination
    hooks: {
      SubagentStop: [{
        hook: async (result, agentName, context) => {
          console.log(`${agentName} completed`);
          return { continue: true };
        }
      }],
      PreToolUse: [{
        matcher: 'Write',
        hook: async (input, toolUseId, context) => {
          console.log('Writing to:', input.file_path);
          return { continue: true };
        }
      }]
    }
  }
});
```

### Python

```python
from claude_agent_sdk import query, ClaudeAgentOptions, ClaudeSDKClient

# Ephemeral (one-off)
async for message in query(prompt="analyze this code"):
    print(message)

# Stateful (multi-turn)
async with ClaudeSDKClient() as client:
    await client.connect()

    # First query
    await client.query("start the task")
    async for msg in client.receive_response():
        print(msg)

    # Follow-up (remembers context)
    await client.query("now do the next step")
    async for msg in client.receive_response():
        print(msg)
```

---

## Subagent Definition Methods

### Method 1: Programmatic (SDK)

Pass agents directly to `query()`:

```typescript
agents: {
  'security-auditor': {
    description: 'Security vulnerability analysis',
    prompt: 'You are a security expert...',
    tools: ['Read', 'Grep', 'Glob'],
    model: 'claude-opus-4-20250514'
  }
}
```

### Method 2: Filesystem

Create `.claude/agents/{name}.md` with YAML frontmatter:

```markdown
---
description: Security vulnerability analysis
tools:
  - Read
  - Grep
  - Glob
model: claude-opus-4-20250514
---

You are a security expert. Analyze code for vulnerabilities including:
- SQL injection
- XSS
- Authentication bypasses
```

### Method 3: CLI Interactive

Use `/agents` command in Claude REPL:
```
> /agents
Available agents:
- reviewer: Code review specialist
- security: Security analysis
```

---

## Message Types

The SDK yields these message types:

| Type | Description | Key Fields |
|------|-------------|------------|
| `system` | Initialization | `session_id` |
| `assistant` | Claude's response | `message.content` |
| `tool_use` | Tool invocation | `tool_name`, `input` |
| `tool_result` | Tool output | `result`, `is_error` |
| `result` | Final summary | `total_cost_usd`, `duration_ms` |

---

## Session Management

### Start New Session

```typescript
const stream = query({ prompt: "start task" });
let sessionId: string;

for await (const msg of stream) {
  if (msg.type === 'system') {
    sessionId = msg.session_id;  // Save for later
  }
}
```

### Resume Session

```typescript
query({
  prompt: "continue",
  options: { resume: sessionId }
});
```

### Fork Session (Parallel Exploration)

```typescript
query({
  prompt: "try alternative approach",
  options: {
    resume: sessionId,
    forkSession: true  // Creates new branch
  }
});
```

---

## Key Insights for Chorus

1. **Agents are invoked automatically** - When you define agents, Claude decides when to spawn them based on their `description`

2. **Each workspace needs its own SDK client** with `cwd` set to the workspace path

3. **Session IDs enable persistence** - Store them in `.chorus/sessions/` to resume later

4. **Hooks are essential for UI integration**:
   - `SubagentStop` - Know when agent completes
   - `PreToolUse` - Track file changes
   - `PostToolUse` - Update UI after actions

5. **Streaming mode required** for real-time updates and interruption support

6. **CLAUDE.md auto-loads** when `settingSources: ['project']` is set

---

## Sources

- https://code.claude.com/docs/en/cli-reference
- https://platform.claude.com/docs/en/agent-sdk/overview
- https://platform.claude.com/docs/en/agent-sdk/typescript
- https://platform.claude.com/docs/en/agent-sdk/python
- https://platform.claude.com/docs/en/agent-sdk/subagents
- https://platform.claude.com/docs/en/agent-sdk/sessions
- https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk
- https://www.anthropic.com/engineering/claude-code-best-practices
