# Claude Agent SDK - Documentation Summary

## Overview

The Claude Agent SDK is a production-ready framework for building custom AI agents, leveraging the same infrastructure that powers Claude Code. Rebranded from "Claude Code SDK" to reflect its evolution beyond just coding tasks.

**Key Docs:**
- Overview: https://platform.claude.com/docs/en/agent-sdk/overview
- Python: https://platform.claude.com/docs/en/agent-sdk/python
- TypeScript: https://platform.claude.com/docs/en/agent-sdk/typescript

---

## Installation

**TypeScript:**
```bash
npm install @anthropic-ai/claude-agent-sdk
```

**Python:**
```bash
pip install claude-agent-sdk
```

---

## Core Patterns

### Pattern 1: `query()` - Ephemeral Sessions

For one-off tasks without conversation memory:

**TypeScript:**
```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

for await (const message of query({ prompt: "Analyze this codebase" })) {
  console.log(message);
}
```

**Python:**
```python
from claude_agent_sdk import query

async for message in query("What files are in this directory?"):
    print(message)
```

### Pattern 2: `ClaudeSDKClient` - Stateful Conversations (Python)

For multi-turn interactions with context retention:

```python
from claude_agent_sdk import ClaudeSDKClient

async with ClaudeSDKClient() as client:
    await client.connect()
    await client.query("First question")
    async for msg in client.receive_response():
        print(msg)

    await client.query("Follow-up question")  # Remembers context
    async for msg in client.receive_response():
        print(msg)
```

---

## Configuration Options

| Option | Purpose |
|--------|---------|
| `allowedTools` | Whitelist permitted tools |
| `disallowedTools` | Block specific tools |
| `permissionMode` | `default` / `acceptEdits` / `plan` / `bypassPermissions` |
| `systemPrompt` | Custom instructions or preset |
| `mcpServers` | MCP server configurations |
| `agents` | Subagent definitions |
| `hooks` | Event interception handlers |
| `settingSources` | Filesystem config sources |
| `outputFormat` | JSON Schema validation |

**Important (v0.1.0 Breaking Change):**
- SDK now loads **no settings by default**
- Must explicitly set `settingSources: ['project']` to load `.claude/settings.json`

---

## Documentation Pages

### 1. Overview
**URL:** https://platform.claude.com/docs/en/agent-sdk/overview

**What it covers:**
- File-system based configuration model
- Authentication (API Key, Bedrock, Vertex AI)
- Production features: context management, tool ecosystem, permissions, caching
- Multi-agent support via subagents and plugins

---

### 2. Python SDK
**URL:** https://platform.claude.com/docs/en/agent-sdk/python

**Key APIs:**
- `query()` - Ephemeral sessions
- `ClaudeSDKClient` - Stateful conversations
- `ClaudeAgentOptions` - Configuration dataclass
- `@tool` decorator - Custom MCP tools
- `create_sdk_mcp_server()` - In-process MCP servers
- Hook events: `PreToolUse`, `PostToolUse`, `SubagentStop`, etc.

---

### 3. TypeScript SDK
**URL:** https://platform.claude.com/docs/en/agent-sdk/typescript

**Key APIs:**
- `query()` - Primary entry point with interruption support
- `tool()` - Create type-safe MCP tools with Zod
- `createSdkMcpServer()` - In-process MCP servers
- Full TypeScript types for all message types

---

### 4. Subagents
**URL:** https://platform.claude.com/docs/en/agent-sdk/subagents

**What it covers:**
- Specialized agents with independent context
- Programmatic definition via `agents` option
- Filesystem definition via `.claude/agents/`
- Tool restrictions per agent
- Concurrent execution support

**Example:**
```typescript
agents: {
  'security-auditor': {
    description: 'Security analysis',
    tools: ['Read', 'Grep', 'Glob'],
    prompt: 'Focus on vulnerabilities',
    model: 'claude-opus-4-20250514'
  }
}
```

---

### 5. Sessions
**URL:** https://platform.claude.com/docs/en/agent-sdk/sessions

**What it covers:**
- Session IDs for context preservation
- Three modes: new, resume, fork
- Forking enables parallel exploration from same starting point

**Key for CC-Slack:** Session forking supports tree-based agent exploration strategies.

---

### 6. Permissions
**URL:** https://platform.claude.com/docs/en/agent-sdk/permissions

**What it covers:**
- Four control mechanisms: permission modes, `canUseTool` callback, hooks, rules
- Processing order: hooks → deny → allow → ask → mode → callback
- `bypassPermissions` for isolated CI environments

**Key for CC-Slack:** Per-agent permission isolation critical for multi-agent security.

---

### 7. Hooks
**URL:** https://platform.claude.com/docs/en/agent-sdk/plugins (hooks section)

**Hook Events:**
- `PreToolUse` - Before tool execution (can block)
- `PostToolUse` - After tool completion
- `SubagentStop` - When subagent completes
- `UserPromptSubmit` - User input received
- `Stop` - Execution stopped
- `PreCompact` - Before context compaction
- `SessionStart` / `SessionEnd`

**Key for CC-Slack:** `SubagentStop` hook enables orchestration coordination.

---

### 8. MCP Integration
**URL:** https://platform.claude.com/docs/en/agent-sdk/mcp

**What it covers:**
- Transport options: stdio, HTTP/SSE, SDK (in-process)
- Configuration via `.mcp.json` or programmatic
- Tool naming: `mcp__[server]__[tool]`
- Resource and prompt exposure

---

### 9. Structured Outputs
**URL:** https://platform.claude.com/docs/en/agent-sdk/structured-outputs

**What it covers:**
- JSON Schema validation for agent responses
- Type-safe with Zod (TS) or Pydantic (Python)
- Accessed via `message.structured_output`

**Key for CC-Slack:** Standardized inter-agent communication through validated schemas.

---

### 10. Hosting
**URL:** https://platform.claude.com/docs/en/agent-sdk/hosting

**What it covers:**
- Deployment patterns: ephemeral, long-running, hybrid, single-container
- Requirements: 1GiB RAM, 5GiB disk, 1 CPU minimum
- Sandbox providers: Cloudflare, Modal, Daytona, E2B, Fly, Vercel
- **Single-container pattern explicitly supports multi-agent collaboration**

---

### 11. Cost Tracking
**URL:** https://platform.claude.com/docs/en/agent-sdk/cost-tracking

**What it covers:**
- Token usage per message
- `total_cost_usd` in final result message
- Message ID deduplication to prevent overcharging

**Key for CC-Slack:** Per-agent cost attribution for budgeting.

---

### 12. Streaming vs Single Mode
**URL:** https://platform.claude.com/docs/en/agent-sdk/streaming-vs-single-mode

**What it covers:**
- Streaming: image attachments, message queuing, interruption, hooks
- Single: one-shot queries, no images/hooks/interruption

**Key for CC-Slack:** Streaming essential for dynamic inter-agent message passing.

---

### 13. System Prompts
**URL:** https://platform.claude.com/docs/en/agent-sdk/modifying-system-prompts

**What it covers:**
- CLAUDE.md files (requires `settingSources: ['project']`)
- Output styles
- Append mode (extends Claude Code default)
- Custom prompts (complete replacement)

---

### 14. Migration Guide
**URL:** https://platform.claude.com/docs/en/agent-sdk/migration-guide

**Breaking Changes in v0.1.0:**
1. Package renamed: `claude-code-sdk` → `claude-agent-sdk`
2. Python type renamed: `ClaudeCodeOptions` → `ClaudeAgentOptions`
3. No default system prompt (must explicitly use preset)
4. No default settings loading (must specify `settingSources`)

---

## Architecture for CC-Slack

```
┌─────────────────────────────────────────────────────────────┐
│                    CC-Slack (Electron)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Agent View  │  │ Agent View  │  │ Agent View  │         │
│  │ (Product)   │  │ (Legal)     │  │ (Research)  │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
├─────────┼────────────────┼────────────────┼─────────────────┤
│         │                │                │                  │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐         │
│  │ SDK Client  │  │ SDK Client  │  │ SDK Client  │         │
│  │ (Session A) │  │ (Session B) │  │ (Session C) │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
├─────────┼────────────────┼────────────────┼─────────────────┤
│         │                │                │                  │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐         │
│  │ Repo A      │  │ Repo B      │  │ Repo C      │         │
│  │ .claude/    │  │ .claude/    │  │ .claude/    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  MCP Protocol   │
                    │  (Future: Inter-│
                    │  agent comms)   │
                    └─────────────────┘
```

---

## Code Examples for CC-Slack

### Spawning an Agent (TypeScript)

```typescript
import { query, ClaudeAgentOptions } from '@anthropic-ai/claude-agent-sdk';

const options: ClaudeAgentOptions = {
  cwd: '/path/to/agent/repo',
  systemPrompt: { type: 'preset', preset: 'claude_code' },
  settingSources: ['project'],  // Load .claude/settings.json
  allowedTools: ['Read', 'Write', 'Bash', 'Grep', 'Glob'],
  permissionMode: 'acceptEdits'
};

for await (const msg of query({ prompt: "Create product brief", options })) {
  if (msg.type === 'assistant') {
    // Stream to UI
  } else if (msg.type === 'result') {
    console.log(`Cost: $${msg.total_cost_usd}`);
  }
}
```

### Multi-Agent with Subagents

```typescript
const options = {
  agents: {
    'product': {
      description: 'Product strategy and planning',
      tools: ['Read', 'Write', 'Grep'],
      prompt: 'You are a product manager...'
    },
    'researcher': {
      description: 'Market and user research',
      tools: ['Read', 'WebSearch', 'WebFetch'],
      prompt: 'You are a researcher...'
    }
  }
};

// Main agent can delegate via Task tool
for await (const msg of query({
  prompt: "Use the researcher to analyze competitors, then create a product brief",
  options
})) {
  // Handle messages
}
```

### Hooks for Coordination

```typescript
const options = {
  hooks: {
    SubagentStop: [{
      hook: async (result, _, context) => {
        // Notify CC-Slack UI that agent finished
        notifyUI(context.session_id, 'completed');
        return { continue: true };
      }
    }],
    PreToolUse: [{
      matcher: 'Write',
      hook: async (input, toolUseId, context) => {
        // Log file changes for Git Butler integration
        logFileChange(input.file_path);
        return { continue: true };
      }
    }]
  }
};
```

### Session Management

```typescript
// Start new session
const result1 = query({ prompt: "Start task" });
let sessionId: string;

for await (const msg of result1) {
  if (msg.type === 'system') {
    sessionId = msg.session_id;  // Store for later
  }
}

// Resume later
const result2 = query({
  prompt: "Continue where we left off",
  options: { resume: sessionId }
});

// Fork for parallel exploration
const result3 = query({
  prompt: "Try alternative approach",
  options: { resume: sessionId, forkSession: true }
});
```

---

## Key Takeaways for CC-Slack

1. **SDK provides the programmatic interface** to spawn and control Claude Code agents
2. **Each agent = separate SDK client** with its own `cwd` (repo path)
3. **Hooks enable UI integration** - notify on completion, track file changes
4. **Session management** allows pause/resume/fork
5. **Structured outputs** for standardized inter-agent data
6. **Cost tracking** per agent for budget visibility
7. **MCP for future inter-agent communication**

---

## Sources

- https://platform.claude.com/docs/en/agent-sdk/overview
- https://platform.claude.com/docs/en/agent-sdk/python
- https://platform.claude.com/docs/en/agent-sdk/typescript
- https://platform.claude.com/docs/en/agent-sdk/migration-guide
- https://platform.claude.com/docs/en/agent-sdk/subagents
- https://platform.claude.com/docs/en/agent-sdk/sessions
- https://platform.claude.com/docs/en/agent-sdk/permissions
- https://platform.claude.com/docs/en/agent-sdk/streaming-vs-single-mode
- https://platform.claude.com/docs/en/agent-sdk/structured-outputs
- https://platform.claude.com/docs/en/agent-sdk/modifying-system-prompts
- https://platform.claude.com/docs/en/agent-sdk/hosting
- https://platform.claude.com/docs/en/agent-sdk/cost-tracking
- https://platform.claude.com/docs/en/agent-sdk/mcp
- https://platform.claude.com/docs/en/agent-sdk/slash-commands
- https://platform.claude.com/docs/en/agent-sdk/skills
- https://platform.claude.com/docs/en/agent-sdk/plugins
- https://platform.claude.com/docs/en/agent-sdk/todo-tracking
