# Subagents

Subagents are specialized AI assistants with independent context windows. Claude can delegate tasks to subagents via the Task tool, enabling focused expertise and parallel work.

## How Subagents Work

```
┌─────────────────────────────────────────────────────────────┐
│                    Main Agent                                │
│  query({ prompt: "Complex task" })                          │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ tool_use: Task                                       │    │
│  │   subagent_type: "reviewer"                         │    │
│  │   prompt: "Review the authentication module"        │    │
│  └─────────────────────────────────────────────────────┘    │
│                              │                              │
│                              ▼                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Subagent: reviewer                                   │    │
│  │   - Independent context window                       │    │
│  │   - Restricted tools: Read, Grep, Glob              │    │
│  │   - Custom system prompt                            │    │
│  │   - Returns result to main agent                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                              │                              │
│                              ▼                              │
│  Main agent continues with subagent's result               │
└─────────────────────────────────────────────────────────────┘
```

---

## Defining Agents Programmatically

Pass agents via the `agents` option:

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const stream = query({
  prompt: "Analyze and improve this codebase",
  options: {
    agents: {
      'reviewer': {
        description: 'Code review specialist for quality and best practices',
        prompt: 'You are a senior code reviewer. Focus on:\n- Code quality\n- Security issues\n- Performance\n- Best practices',
        tools: ['Read', 'Grep', 'Glob'],
        model: 'sonnet'
      },
      'security-auditor': {
        description: 'Security vulnerability analysis',
        prompt: 'You are a security expert. Look for:\n- SQL injection\n- XSS\n- Authentication flaws\n- Data exposure',
        tools: ['Read', 'Grep', 'Glob', 'Bash(grep *)'],
        model: 'opus'
      },
      'documenter': {
        description: 'Documentation writer',
        prompt: 'You write clear, comprehensive documentation.',
        tools: ['Read', 'Write', 'Glob'],
        model: 'haiku'
      }
    }
  }
});
```

### AgentDefinition Interface

```typescript
interface AgentDefinition {
  description: string;           // Shown to main agent for delegation decisions
  prompt: string;                // System prompt for the subagent
  tools?: string[];              // Allowed tools (default: all)
  disallowedTools?: string[];    // Blocked tools
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';  // Model (default: inherit)
}
```

---

## Defining Agents via Filesystem

Create markdown files in `.claude/agents/`:

### File Location

```
workspace/
├── .claude/
│   └── agents/
│       ├── reviewer.md         # /reviewer or Task(reviewer)
│       ├── security-auditor.md
│       └── documenter.md
└── src/
```

### File Format

```markdown
---
description: Code review specialist for quality and best practices
tools:
  - Read
  - Grep
  - Glob
model: sonnet
---

You are a senior code reviewer. When reviewing code, focus on:

- Code quality and readability
- Security vulnerabilities
- Performance implications
- Adherence to best practices
- Test coverage

Provide specific, actionable feedback with line references.
```

### YAML Frontmatter Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | `string` | **Required**. Brief description for delegation |
| `tools` | `string[]` | Allowed tools |
| `disallowedTools` | `string[]` | Blocked tools |
| `model` | `string` | Model: `sonnet`, `opus`, `haiku`, or `inherit` |

The markdown body becomes the system prompt.

---

## Built-in Agents

Claude Code includes built-in agents:

| Agent | Description | Use Case |
|-------|-------------|----------|
| `Explore` | Fast codebase exploration | Finding files, searching code |
| `Plan` | Planning and design | Breaking down complex tasks |
| `general-purpose` | General tasks | Default for unmatched descriptions |

These are available without configuration.

---

## Task Tool Delegation

The main agent uses the Task tool to delegate:

```json
{
  "type": "tool_use",
  "name": "Task",
  "input": {
    "subagent_type": "reviewer",
    "prompt": "Review the authentication module in src/auth/",
    "description": "Code review for auth module"
  }
}
```

### Task Tool Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `subagent_type` | `string` | **Required**. Agent name |
| `prompt` | `string` | **Required**. Task for the subagent |
| `description` | `string` | Short description (3-5 words) |
| `model` | `string` | Override model for this task |
| `resume` | `string` | Resume previous agent session |

---

## Agent Selection

Claude chooses agents based on their `description`:

```typescript
agents: {
  'security': {
    description: 'Security vulnerability analysis',  // ← Claude reads this
    // ...
  },
  'performance': {
    description: 'Performance optimization and profiling',
    // ...
  }
}
```

**Tip:** Write clear, specific descriptions to help Claude choose the right agent.

---

## Tool Restrictions

### Whitelist Approach

```typescript
'reviewer': {
  description: '...',
  prompt: '...',
  tools: ['Read', 'Grep', 'Glob']  // Only these tools
}
```

### Blacklist Approach

```typescript
'documenter': {
  description: '...',
  prompt: '...',
  disallowedTools: ['Bash', 'mcp__*']  // Block these
}
```

### Pattern Syntax

Same as main agent tool patterns:

| Pattern | Effect |
|---------|--------|
| `'Read'` | Allow all Read |
| `'Bash(git *)'` | Allow git commands only |
| `'mcp__*'` | All MCP tools |

---

## Model Selection

```typescript
'quick-checker': {
  model: 'haiku'    // Fast, cheap model
}

'deep-analyst': {
  model: 'opus'     // Most capable
}

'inherit-model': {
  model: 'inherit'  // Same as main agent (default)
}
```

---

## Subagent Messages

Subagent messages include `parent_tool_use_id`:

```typescript
for await (const message of stream) {
  if (message.type === 'assistant') {
    if (message.parent_tool_use_id) {
      // This is from a subagent
      console.log('Subagent response');
    } else {
      // This is from the main agent
      console.log('Main agent response');
    }
  }
}
```

---

## Subagent Hooks

Track subagent lifecycle:

```typescript
hooks: {
  SubagentStart: [{
    hooks: [async (input) => {
      console.log('Subagent starting:', input.agent_id, input.agent_type);
      return { continue: true };
    }]
  }],
  SubagentStop: [{
    hooks: [async (input) => {
      console.log('Subagent completed:', input.agent_id);
      console.log('Transcript:', input.agent_transcript_path);
      return { continue: true };
    }]
  }]
}
```

---

## Concurrent Subagents

Multiple subagents can run in parallel:

```typescript
// Main agent can spawn multiple Task calls
// Each gets independent context
// Results are collected when all complete
```

---

## Chorus Implementation

### Agent Discovery

Chorus discovers agents from workspace files:

```typescript
// chorus/src/main/services/workspace-service.ts

async function discoverAgents(workspacePath: string): Promise<Agent[]> {
  const agentsDir = path.join(workspacePath, '.claude', 'agents');
  const files = await fs.readdir(agentsDir);

  return Promise.all(
    files
      .filter(f => f.endsWith('.md'))
      .map(async (file) => {
        const content = await fs.readFile(path.join(agentsDir, file), 'utf-8');
        const { frontmatter, body } = parseMarkdown(content);

        return {
          id: generateStableId(path.join(agentsDir, file)),
          name: path.basename(file, '.md'),
          description: frontmatter.description,
          tools: frontmatter.tools,
          model: frontmatter.model,
          prompt: body
        };
      })
  );
}
```

### Stable Agent IDs

Agent IDs are deterministic hashes of file path:

```typescript
// chorus/src/main/services/workspace-service.ts

function generateStableId(filePath: string): string {
  return crypto
    .createHash('sha256')
    .update(filePath)
    .digest('hex')
    .substring(0, 16);
}
```

**Note:** Renaming/moving an agent file creates a new ID, orphaning old conversations.

### Agent Display

```typescript
// chorus/src/renderer/src/components/Sidebar/AgentItem.tsx

function AgentItem({ agent, workspace }) {
  const conversations = useConversationsForAgent(agent.id);
  const status = useAgentStatus(agent.id);

  return (
    <div className="agent-item">
      <span className="agent-name">{agent.name}</span>
      <span className="agent-status">{status}</span>
      {conversations.length > 0 && (
        <span className="conversation-count">{conversations.length}</span>
      )}
    </div>
  );
}
```

---

## Best Practices

### 1. Focused Agents

Each agent should have a single, clear purpose:

```typescript
// Good: Focused
'security-auditor': {
  description: 'Security vulnerability analysis',
  prompt: 'Focus exclusively on security issues...',
  tools: ['Read', 'Grep']
}

// Bad: Too broad
'code-helper': {
  description: 'Helps with all code tasks',
  prompt: 'Do anything with code...',
}
```

### 2. Minimal Tool Access

Give agents only the tools they need:

```typescript
// Read-only analysis
'analyzer': {
  tools: ['Read', 'Grep', 'Glob']  // No Write, no Bash
}
```

### 3. Clear Descriptions

Help Claude choose the right agent:

```typescript
// Good: Specific
description: 'TypeScript type error analysis and fixing'

// Bad: Vague
description: 'Code helper'
```

### 4. Model Matching

Match model to task complexity:

```typescript
// Quick checks: haiku
'linter': { model: 'haiku' }

// Complex analysis: opus
'architect': { model: 'opus' }

// General tasks: sonnet
'developer': { model: 'sonnet' }
```

---

## References

- [SDK Subagents Documentation](https://platform.claude.com/docs/en/agent-sdk/subagents)
- [Claude Code Sub-agents](https://code.claude.com/docs/en/sub-agents)
