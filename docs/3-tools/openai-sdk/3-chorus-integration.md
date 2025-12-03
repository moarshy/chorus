# Chorus Integration

This document details how the OpenAI Deep Research agent integrates into Chorus as a built-in agent alongside the existing Chorus (Claude) agent.

## Architecture Overview

Deep Research is a built-in agent that appears in every workspace's agent list, similar to the Chorus agent. When selected, it uses the OpenAI Agents SDK instead of the Claude Agent SDK.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Chorus (Electron)                           │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                      Renderer Process                           │ │
│  │                                                                 │ │
│  │  ┌──────────────┐  ┌──────────────────────────────────────┐    │ │
│  │  │ Sidebar      │  │ MainPane                              │    │ │
│  │  │              │  │                                       │    │ │
│  │  │ Agents:      │  │ ConversationToolbar                   │    │ │
│  │  │ 🎵 Chorus    │  │ ┌─────────────────────────────────┐   │    │ │
│  │  │ 🔬 Deep Res. │◄─┼─│ Model: [O4 Mini ▼]              │   │    │ │
│  │  │ ──────────── │  │ └─────────────────────────────────┘   │    │ │
│  │  │ 📄 custom... │  │                                       │    │ │
│  │  └──────────────┘  │ ChatPane (streaming, messages)        │    │ │
│  │                    └──────────────────────────────────────┘    │ │
│  └─────────────────────────────────┬──────────────────────────────┘ │
│                                    │ IPC Bridge                     │
│  ┌─────────────────────────────────┼──────────────────────────────┐ │
│  │                    Main Process │                               │ │
│  │                                 ▼                               │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │               agent-service.ts (Router)                   │  │ │
│  │  │                                                           │  │ │
│  │  │   if (agent.type === 'claude') → agent-sdk-service.ts    │  │ │
│  │  │   if (agent.type === 'openai-research') → openai-svc.ts  │  │ │
│  │  └───────────────────────┬───────────────────────────────────┘  │ │
│  │                          │                                      │ │
│  │     ┌────────────────────┴────────────────────┐                │ │
│  │     │                                          │                │ │
│  │     ▼                                          ▼                │ │
│  │  ┌─────────────────────┐  ┌─────────────────────────────────┐  │ │
│  │  │ agent-sdk-service   │  │ openai-research-service         │  │ │
│  │  │                     │  │                                 │  │ │
│  │  │ @anthropic-ai/      │  │ @openai/agents                  │  │ │
│  │  │ claude-agent-sdk    │  │ + WebSearchTool                 │  │ │
│  │  └──────────┬──────────┘  └──────────┬──────────────────────┘  │ │
│  │             │                        │                          │ │
│  └─────────────┼────────────────────────┼──────────────────────────┘ │
│                │                        │                            │
└────────────────┼────────────────────────┼────────────────────────────┘
                 │                        │
                 ▼                        ▼
          ┌────────────┐           ┌────────────┐
          │ Anthropic  │           │  OpenAI    │
          │    API     │           │    API     │
          └────────────┘           └────────────┘
```

## Built-in Agents

Chorus provides two built-in agents per workspace:

| Agent | Type | SDK | Purpose |
|-------|------|-----|---------|
| **Chorus** | `claude` | Claude Agent SDK | Coding tasks, file editing, terminal |
| **Deep Research** | `openai-research` | OpenAI Agents SDK | Multi-step research, web search |

```typescript
// chorus/src/main/services/workspace-service.ts

const BUILT_IN_AGENTS: Agent[] = [
  {
    id: 'chorus',
    name: 'Chorus',
    type: 'claude',
    description: 'General-purpose coding assistant'
  },
  {
    id: 'deep-research',
    name: 'Deep Research',
    type: 'openai-research',
    description: 'OpenAI Deep Research for comprehensive analysis'
  }
];
```

## Agent Type System

The `AgentType` field determines which backend service handles the conversation:

```typescript
// chorus/src/preload/index.d.ts

type AgentType = 'claude' | 'openai-research';

interface Agent {
  id: string;
  name: string;
  type: AgentType;
  description?: string;
  filePath?: string;       // Only for custom .claude/agents/*.md
  systemPrompt?: string;   // Only for custom agents
}
```

## Model Configuration

Each agent type has its own set of available models:

```typescript
// chorus/src/renderer/src/constants/models.ts

export const CLAUDE_MODELS = [
  { id: 'claude-sonnet-4-5-20250929', name: 'Sonnet 4.5', default: true },
  { id: 'claude-opus-4-0-20250514', name: 'Opus 4' },
  { id: 'claude-sonnet-4-20250514', name: 'Sonnet 4' },
];

export const OPENAI_RESEARCH_MODELS = [
  { id: 'o4-mini-deep-research-2025-06-26', name: 'O4 Mini (faster)', default: true },
  { id: 'o3-deep-research-2025-06-26', name: 'O3 (thorough)' },
];

export function getModelsForAgentType(type: AgentType) {
  return type === 'openai-research' ? OPENAI_RESEARCH_MODELS : CLAUDE_MODELS;
}
```

The `ConversationToolbar` dynamically switches model options based on the agent type:

```typescript
// chorus/src/renderer/src/components/Chat/ConversationToolbar.tsx

function ModelSelector({ conversation, agent }) {
  const models = getModelsForAgentType(agent.type);

  return (
    <select value={conversation.settings?.model || models[0].id}>
      {models.map((model) => (
        <option key={model.id} value={model.id}>{model.name}</option>
      ))}
    </select>
  );
}
```

## Settings Configuration

### API Key Setup

OpenAI API key is configured in a dedicated Settings tab:

```typescript
// chorus/src/renderer/src/components/Settings/SettingsPage.tsx

export function SettingsPage() {
  const [openaiKey, setOpenaiKey] = useState('');
  const [keyStatus, setKeyStatus] = useState<'valid' | 'invalid' | 'not-set'>('not-set');

  const handleKeyChange = async (key: string) => {
    const result = await window.api.settings.setOpenaiKey(key);
    setKeyStatus(result.valid ? 'valid' : 'invalid');
  };

  return (
    <section>
      <h2>API Keys</h2>
      <label>OpenAI API Key</label>
      <input
        type="password"
        value={openaiKey}
        onChange={(e) => handleKeyChange(e.target.value)}
        placeholder="sk-..."
      />
      <span>{keyStatus === 'valid' ? '✓ Valid' : keyStatus === 'invalid' ? '✗ Invalid' : ''}</span>
    </section>
  );
}
```

### Research Output Directory

Per-workspace setting for where research reports are saved:

```typescript
interface ChorusSettings {
  openaiApiKey?: string;
  researchOutputDirectory: string;  // Default: './research'
}
```

## OpenAI Research Service

The research service handles communication with OpenAI's Deep Research models:

```typescript
// chorus/src/main/services/openai-research-service.ts

import { Agent, run, WebSearchTool } from '@openai/agents';
import OpenAI from 'openai';
import { setDefaultOpenAIClient } from '@openai/agents';

export async function sendMessage(
  conversationId: string,
  workspaceId: string,
  message: string,
  options: {
    model: string;
    apiKey: string;
    outputDir: string;
    previousContext?: string;
  },
  mainWindow: BrowserWindow
): Promise<void> {
  const controller = new AbortController();
  activeSessions.set(conversationId, controller);

  // Configure OpenAI client with extended timeout
  const client = new OpenAI({
    apiKey: options.apiKey,
    timeout: 600000,  // 10 minutes for deep research
  });
  setDefaultOpenAIClient(client);

  // Build prompt with context for follow-ups
  const prompt = options.previousContext
    ? `Previous research:\n\n${options.previousContext}\n\n---\n\nFollow-up question: ${message}`
    : message;

  // Create research agent
  const agent = new Agent({
    name: 'Deep Researcher',
    model: options.model,
    tools: [new WebSearchTool()],
    instructions: `You perform deep empirical research.
      - Search multiple authoritative sources
      - Cross-reference information for accuracy
      - Provide citations with URLs
      - Synthesize into actionable insights`
  });

  // Stream research
  const stream = await run(agent, prompt, {
    stream: true,
    signal: controller.signal
  });

  let fullText = '';

  for await (const event of stream) {
    // Handle text streaming
    if (event.type === 'raw_model_stream_event') {
      const delta = event.data?.delta;
      if (delta?.type === 'text_delta' && delta.text) {
        fullText += delta.text;
        mainWindow.webContents.send('research:delta', {
          conversationId,
          text: delta.text
        });
      }
    }

    // Handle web searches
    if (event.type === 'run_item_stream_event' && event.name === 'tool_called') {
      mainWindow.webContents.send('research:search', {
        conversationId,
        query: event.item.input?.query
      });
    }
  }

  await stream.completed;

  // Auto-save to output directory
  const outputPath = await saveResearchOutput(workspaceId, options.outputDir, message, fullText);

  mainWindow.webContents.send('research:complete', {
    conversationId,
    outputPath,
    text: fullText
  });
}
```

## Agent Service Router

The main agent service routes to the appropriate backend:

```typescript
// chorus/src/main/services/agent-service.ts

import * as claudeService from './agent-sdk-service';
import * as openaiService from './openai-research-service';

export async function sendMessage(
  conversationId: string,
  workspaceId: string,
  agentId: string,
  message: string,
  mainWindow: BrowserWindow
): Promise<void> {
  const agent = await getAgent(workspaceId, agentId);

  if (agent.type === 'openai-research') {
    const apiKey = store.get('openaiApiKey');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const outputDir = store.get('researchOutputDirectory', './research');
    const previousContext = await getPreviousResearchContext(conversationId);

    await openaiService.sendMessage(conversationId, workspaceId, message, {
      model: conversation.settings?.model || 'o4-mini-deep-research-2025-06-26',
      apiKey,
      outputDir,
      previousContext
    }, mainWindow);
  } else {
    // Claude agent flow
    await claudeService.sendMessage(...);
  }
}
```

## Follow-up Context

Since OpenAI's API is stateless, follow-up questions inject previous research as context:

```typescript
async function getPreviousResearchContext(conversationId: string): Promise<string | undefined> {
  const messages = await getConversationMessages(conversationId);

  const assistantMessages = messages
    .filter(m => m.role === 'assistant')
    .map(m => m.content);

  if (assistantMessages.length === 0) return undefined;

  // Return last research output as context
  return assistantMessages[assistantMessages.length - 1];
}
```

When a follow-up is sent, the prompt becomes:

```
Previous research:

[Full text of previous research report]

---

Follow-up question: [User's new question]
```

## IPC Events

### Main → Renderer Events

| Event | Payload | Description |
|-------|---------|-------------|
| `research:delta` | `{ conversationId, text }` | Streaming text chunk |
| `research:search` | `{ conversationId, query }` | Web search being performed |
| `research:complete` | `{ conversationId, outputPath, text }` | Research finished |
| `research:error` | `{ conversationId, error }` | Error occurred |

### Renderer → Main Handlers

| Handler | Signature | Description |
|---------|-----------|-------------|
| `settings:get-openai-key` | `() => string \| null` | Get stored API key |
| `settings:set-openai-key` | `(key) => { valid }` | Set and validate key |
| `research:stop` | `(conversationId) => void` | Cancel research |

## Output File Format

Research reports are auto-saved with timestamp and query slug:

```
research/
├── 2025-12-03T14-30-00-electron-security-best-practices.md
├── 2025-12-03T15-45-00-react-performance-optimization.md
└── 2025-12-03T16-00-00-ai-agents-production.md
```

File content:

```markdown
# Research: [Original query]

Generated: 2025-12-03T14:30:00.000Z
Model: o4-mini-deep-research-2025-06-26

---

[Full research report content]
```

## UI Components

### Agent List (Sidebar)

```
┌─────────────────────────────────┐
│ my-project                       │
│ main ▼                           │
├─────────────────────────────────┤
│ Agents                           │
│                                  │
│ 🎵 Chorus                        │  ← Built-in Claude agent
│ 🔬 Deep Research                 │  ← Built-in OpenAI agent
│ ─────────────────────────────── │
│ 📄 backend-expert                │  ← Custom agents
│ 📄 code-reviewer                 │
└─────────────────────────────────┘
```

### Research Message Component

```typescript
// chorus/src/renderer/src/components/Chat/ResearchMessage.tsx

export function ResearchMessage({ conversationId, isStreaming }: Props) {
  const [text, setText] = useState('');
  const [searches, setSearches] = useState<string[]>([]);
  const [outputPath, setOutputPath] = useState<string | null>(null);

  useEffect(() => {
    const unsubDelta = window.api.research.onDelta((data) => {
      if (data.conversationId === conversationId) {
        setText(prev => prev + data.text);
      }
    });

    const unsubSearch = window.api.research.onSearch((data) => {
      if (data.conversationId === conversationId) {
        setSearches(prev => [...prev, data.query]);
      }
    });

    // ... cleanup
  }, [conversationId]);

  return (
    <div className="research-message">
      {/* Search activity */}
      {searches.map((query, i) => (
        <div key={i}>🔍 Searching: {query}</div>
      ))}

      {/* Streaming content */}
      <MarkdownContent content={text} />
      {isStreaming && <span className="cursor">█</span>}

      {/* Output path after completion */}
      {outputPath && (
        <div className="saved-to">
          📄 Saved to: {outputPath}
          <button onClick={() => openFile(outputPath)}>Open File</button>
        </div>
      )}
    </div>
  );
}
```

## Comparison: Claude vs Deep Research

| Aspect | Chorus (Claude) | Deep Research (OpenAI) |
|--------|-----------------|------------------------|
| **SDK** | `@anthropic-ai/claude-agent-sdk` | `@openai/agents` |
| **Purpose** | Coding, file editing, terminal | Research, web search, synthesis |
| **Session** | Persistent via `resume` | Stateless (context injection) |
| **Models** | Sonnet, Opus, Haiku | O4 Mini, O3 |
| **Tools** | File ops, bash, MCP | WebSearchTool |
| **Output** | Chat + file edits | Chat + auto-saved report |
| **Permissions** | `canUseTool` callback | Not applicable |

## Dependencies

```bash
cd chorus && bun add @openai/agents openai zod@3
```

## References

- [OpenAI Agents SDK](https://github.com/openai/openai-agents-js)
- [Deep Research Models](https://platform.openai.com/docs/models/o4-mini-deep-research)
- [Feature Specification](../../../specifications/15-openai-deep-research/feature.md)
- [Implementation Plan](../../../specifications/15-openai-deep-research/implementation-plan.md)
- [Claude Agent SDK Integration](../claude-agent-sdk/0-overview.md)
