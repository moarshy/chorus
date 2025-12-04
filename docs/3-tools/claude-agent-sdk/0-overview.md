# Claude Agent SDK Overview

The Claude Agent SDK is a TypeScript/JavaScript library for building AI agents powered by Claude. It provides the same infrastructure that powers Claude Code, enabling programmatic control over agent sessions.

## Installation

```bash
bun add @anthropic-ai/claude-agent-sdk
```

**Requirements:**
- Node.js 18+ (or Bun/Deno)
- Valid Anthropic API key (set `ANTHROPIC_API_KEY` environment variable)

## Quick Start

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

// Simple one-shot query
for await (const message of query({ prompt: "What files are in this directory?" })) {
  if (message.type === 'assistant') {
    console.log(message.message.content);
  }
  if (message.type === 'result') {
    console.log(`Cost: $${message.total_cost_usd}`);
  }
}
```

## Key Features

| Feature | Description |
|---------|-------------|
| **Streaming** | Real-time message streaming with interruption support |
| **Sessions** | Resume, fork, and manage conversation history |
| **Permissions** | Programmatic approval via `canUseTool` callback |
| **Hooks** | In-process callbacks for tool lifecycle events |
| **Subagents** | Delegate tasks to specialized agents |
| **Custom Tools** | Create MCP tools with `tool()` and `createSdkMcpServer()` |
| **Cost Tracking** | Per-turn and aggregate token usage and cost |

## Benefits Over CLI Spawning

| Aspect | CLI Spawning | SDK Direct |
|--------|-------------|------------|
| Process model | Subprocess (`spawn`) | In-process |
| Message handling | Manual JSONL parsing | Typed objects |
| Permission control | `--allowedTools` flag only | `canUseTool` callback |
| Interruption | Kill process | `query.interrupt()` |
| Hooks | Shell commands (external) | In-process callbacks |
| Custom tools | MCP subprocess | `tool()` + `createSdkMcpServer()` |
| Type safety | Parse JSON manually | Full TypeScript types |
| Error handling | Parse stderr | Built-in exceptions |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Application                          │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │ query() call   │  │ canUseTool     │  │ hooks          │ │
│  │                │  │ callback       │  │ callbacks      │ │
│  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘ │
│          │                   │                   │          │
├──────────┼───────────────────┼───────────────────┼──────────┤
│          │                   │                   │          │
│  ┌───────▼───────────────────▼───────────────────▼────────┐ │
│  │              Claude Agent SDK                           │ │
│  │  - Session management                                   │ │
│  │  - Tool execution                                       │ │
│  │  - Permission handling                                  │ │
│  │  - Message streaming                                    │ │
│  └───────────────────────────┬────────────────────────────┘ │
│                              │                              │
└──────────────────────────────┼──────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Anthropic API     │
                    │   (Claude Models)   │
                    └─────────────────────┘
```

## Chorus Architecture

Chorus uses the SDK in the Electron main process to manage agent conversations:

```
┌─────────────────────────────────────────────────────────────┐
│                    Chorus (Electron)                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  Renderer Process                     │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │ ChatPane   │  │ Permission │  │ Details    │     │   │
│  │  │            │  │ Dialog     │  │ Panel      │     │   │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘     │   │
│  └────────┼───────────────┼───────────────┼─────────────┘   │
│           │               │               │                  │
│           │         IPC Bridge (preload)                    │
│           │               │               │                  │
│  ┌────────┼───────────────┼───────────────┼─────────────┐   │
│  │        │    Main Process               │             │   │
│  │        ▼               ▼               ▼             │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │           agent-sdk-service.ts               │   │   │
│  │  │                                              │   │   │
│  │  │  - query() with options                      │   │   │
│  │  │  - canUseTool → IPC → PermissionDialog       │   │   │
│  │  │  - PostToolUse hooks → agent:file-changed    │   │   │
│  │  │  - TodoWrite hooks → agent:todo-update       │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
│                              │                              │
└──────────────────────────────┼──────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Workspace Directory │
                    │ (Git Repository)    │
                    └─────────────────────┘
```

**Key Integration Points:**

| Component | File | Purpose |
|-----------|------|---------|
| SDK Service | `chorus/src/main/services/agent-sdk-service.ts` | Calls `query()`, handles streaming |
| Agent Service | `chorus/src/main/services/agent-service.ts` | API facade, delegates to SDK service |
| Conversation Service | `chorus/src/main/services/conversation-service.ts` | JSONL message storage |
| Chat Store | `chorus/src/renderer/src/stores/chat-store.ts` | UI state management |
| Permission Dialog | `chorus/src/renderer/src/components/dialogs/PermissionDialog.tsx` | User approval UI |

## Configuration Essentials

> **Security Warning**: The `cwd` option does NOT enforce strict directory boundaries. Agents can use absolute paths to read/write files outside the workspace. See [11-security.md](./11-security.md) for implementing path validation.

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const stream = query({
  prompt: "Your task here",
  options: {
    // Working directory (agent starts here, but NOT restricted to)
    cwd: '/path/to/workspace',

    // Model selection
    model: 'sonnet',  // 'sonnet' | 'opus' | 'haiku'

    // Permission handling
    permissionMode: 'default',  // or 'acceptEdits', 'bypassPermissions'
    canUseTool: async (toolName, input) => {
      // Programmatic approval
      return { behavior: 'allow', updatedInput: input };
    },

    // Session management
    resume: 'session-id',  // Resume existing session

    // Load project settings
    settingSources: ['project', 'user'],

    // System prompt
    systemPrompt: {
      type: 'preset',
      preset: 'claude_code'
    }
  }
});
```

## Documentation Index

| Doc | Description |
|-----|-------------|
| [1-message-types](./1-message-types.md) | Complete SDK message type reference |
| [2-query-api](./2-query-api.md) | `query()` function and all options |
| [3-sessions](./3-sessions.md) | Session management, resume, fork |
| [4-permissions](./4-permissions.md) | `canUseTool` callback and permission modes |
| [5-hooks](./5-hooks.md) | Hook events and callbacks |
| [6-subagents](./6-subagents.md) | Agent definitions and Task tool |
| [7-tools](./7-tools.md) | Built-in tools and custom MCP tools |
| [8-streaming](./8-streaming.md) | Real-time streaming and interruption |
| [9-cost-tracking](./9-cost-tracking.md) | Token usage and cost calculation |
| [10-slash-commands](./10-slash-commands.md) | Slash command configuration |
| [11-security](./11-security.md) | Security considerations, path validation, sandboxing |

## External References

- [Claude Agent SDK GitHub](https://github.com/anthropics/claude-code-sdk)
- [Official Documentation](https://platform.claude.com/docs/en/agent-sdk/overview)
- [NPM Package](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)
- [Building Agents with Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
