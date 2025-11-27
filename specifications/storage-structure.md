# Chorus Storage Structure

All Chorus data is stored in the `.chorus/` directory at the project root.

## Directory Layout

```
.chorus/
├── config.json                              # App settings + workspaces list
└── sessions/
    └── {workspaceId}/
        └── {agentId}/
            ├── conversations.json           # Index of all conversations for this agent
            └── {conversationId}-messages.jsonl  # Messages for each conversation
```

## File Formats

### `config.json`

Main configuration file managed by `electron-store`. Contains workspaces and application settings.

```typescript
interface StoreSchema {
  workspaces: Workspace[]
  settings: ChorusSettings
}

interface Workspace {
  id: string
  name: string
  path: string
  isExpanded: boolean
  gitBranch: string | null
  isDirty: boolean
  hasSystemPrompt: boolean
  agents: Agent[]
}

interface Agent {
  id: string
  name: string
  filePath: string
  workspaceId: string
}

interface ChorusSettings {
  rootWorkspaceDir: string
  theme: 'dark' | 'light'
  chatSidebarCollapsed: boolean
  chatSidebarWidth: number
}
```

### `conversations.json`

Index file for each workspace/agent pair. Located at `.chorus/sessions/{workspaceId}/{agentId}/conversations.json`.

```typescript
interface ConversationsIndex {
  conversations: Conversation[]
}

interface Conversation {
  id: string
  sessionId: string | null   // Claude Code SDK session ID (for resuming)
  agentId: string
  workspaceId: string
  title: string
  createdAt: string          // ISO 8601 timestamp
  updatedAt: string          // ISO 8601 timestamp
  messageCount: number
}
```

### `{conversationId}-messages.jsonl`

Messages stored as newline-delimited JSON (JSONL). Each line is a complete JSON object representing one message.

```typescript
interface ConversationMessage {
  uuid: string
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'error' | 'system'
  content: string | ContentBlock[]
  timestamp: string          // ISO 8601 timestamp
  sessionId?: string         // Claude Code SDK session ID
  toolName?: string          // For tool_use/tool_result messages
  toolInput?: Record<string, unknown>
}

interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  name?: string
  input?: Record<string, unknown>
}
```

## Implementation References

- **Store initialization**: `chorus/src/main/store/index.ts`
- **Conversation service**: `chorus/src/main/services/conversation-service.ts`
- **Path helpers**: `getChorusDir()`, `getSessionsDir()`, `getMessagesFilePath()`

## Design Decisions

1. **JSONL for messages**: Enables append-only writes for performance and crash safety. Each message is a complete JSON object on its own line.

2. **Separate index files**: `conversations.json` keeps metadata for quick listing without parsing all messages.

3. **Hierarchical structure**: `sessions/{workspaceId}/{agentId}/` allows easy cleanup when workspaces or agents are removed.

4. **In-memory cache**: `conversationPathCache` maps conversation IDs to their workspace/agent location for fast lookups.
