# Agents

Agents are Claude Code instances that operate within a workspace. Each agent has its own system prompt and can have multiple conversations.

---

## Overview

| Aspect | Description |
|--------|-------------|
| What | A Claude Code instance with a specific persona/role |
| Why | Different agents for different tasks (coding, research, planning) |
| Where | Sidebar → Under each workspace |

---

## Features

### 1. General "Chorus" Agent ✅

Every workspace automatically has a general-purpose agent.

**Characteristics:**
- Name: "Chorus"
- Auto-created when workspace is added
- Uses workspace's `CLAUDE.md` as system prompt
- Cannot be deleted
- Always appears first in agent list
- Distinct visual appearance (special icon)

**Stable ID:**
- Generated as UUID when workspace is added
- Stored in workspace's `chorusAgentId` field
- Survives workspace refresh

**Implementation:**
- `workspace-service.ts` - Creates Chorus agent on workspace add
- `AgentItem.tsx` - `isGeneral` flag for special rendering

---

### 2. Custom Agents ✅

User-defined agents from markdown files.

**Discovery:**
- Located in `.claude/agents/*.md` within workspace
- File name (without `.md`) becomes agent name
- File content becomes system prompt

**Example:**
```
workspace/
└── .claude/
    └── agents/
        ├── researcher.md    → "researcher" agent
        ├── code-reviewer.md → "code-reviewer" agent
        └── planner.md       → "planner" agent
```

**Agent File Format:**
```markdown
You are a code reviewer specializing in TypeScript and React.

Focus on:
- Type safety
- Component patterns
- Performance considerations
```

**Implementation:**
- `workspace-service.ts` - `discoverAgents()` scans `.claude/agents/`
- Glob pattern: `**/.claude/agents/*.md`

---

### 3. Stable Agent IDs ✅

Agent IDs are deterministic, not random.

**Why:**
- Conversations link to agent by ID
- Random IDs break links on workspace refresh
- Stable IDs preserve conversation history

**How:**
- Custom agents: SHA-256 hash of file path
- Chorus agent: UUID stored in workspace

**Caveat:**
- Renaming/moving agent `.md` file creates new ID
- Old conversations become orphaned
- Content changes are safe (don't affect ID)

**Implementation:**
- `workspace-service.ts` - `generateStableId()` using SHA-256

---

### 4. Agent Status Tracking ✅

Real-time status visibility for each agent.

**Status States:**
| Status | Meaning | Visual |
|--------|---------|--------|
| Idle | No active conversation | Gray dot |
| Busy | Currently processing | Green pulsing dot |
| Error | Last request failed | Red dot |

**Tracked Per:**
- Agent level (aggregate of conversations)
- Conversation level (specific chat)

**Implementation:**
- `chat-store.ts` - `agentStatuses` Map
- `AgentItem.tsx` - Status indicator rendering

---

## Data Model

```typescript
interface Agent {
  id: string           // Stable ID (SHA-256 hash or UUID)
  name: string         // Display name
  workspaceId: string  // Parent workspace
  filePath?: string    // Path to .md file (custom agents only)
  isGeneral?: boolean  // True for Chorus agent
}

// Status tracking (in chat-store)
agentStatuses: Map<string, AgentStatus>

type AgentStatus = 'idle' | 'busy' | 'error'
```

---

## UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `AgentItem` | Sidebar | Single agent row with status |
| `AgentConversationsPanel` | Sidebar | Conversations list when agent selected |
| `ChatHeader` | Chat | Agent name and status in chat |

---

## User Flows

### View Agent Conversations
1. Expand workspace in sidebar
2. Click on agent
3. Sidebar switches to conversations list
4. Click conversation to open chat tab

### Create New Conversation
1. Click agent in sidebar
2. Click "New Conversation" button
3. New chat tab opens
4. Start typing

---

## Related Files

**Services:**
- `src/main/services/workspace-service.ts` - Agent discovery
- `src/main/services/agent-sdk-service.ts` - Agent execution

**Store:**
- `src/renderer/src/stores/workspace-store.ts` - Agent state
- `src/renderer/src/stores/chat-store.ts` - Status tracking

**Components:**
- `src/renderer/src/components/Sidebar/AgentItem.tsx`
- `src/renderer/src/components/Sidebar/AgentConversationsPanel.tsx`
- `src/renderer/src/components/Chat/ChatHeader.tsx`
