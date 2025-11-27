# Module 7: State Management & Persistence

Persisting agents and message history across app restarts using electron-store.

---

## What We Built

- **Typed persistent store** using electron-store
- **Agent persistence** - agents survive app restarts
- **Message history** - conversations are saved per agent
- **Session persistence** - Claude session IDs saved for continuity
- **IPC bridge** - store operations accessible from renderer

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              RENDERER (App.tsx)                               │
│                                                                               │
│  On startup:                                                                 │
│    const agents = await window.api.store.getAgents()                        │
│    const messages = await window.api.store.getMessages(agentId)             │
│                                                                               │
│  On add agent:                                                               │
│    await window.api.store.addAgent({ id, name, repoPath, createdAt })       │
│                                                                               │
│  On send/receive message:                                                    │
│    await window.api.store.addMessage(agentId, message)                      │
│                                                                               │
└────────────────────────────────────────────┼──────────────────────────────────┘
                                             │
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                               PRELOAD                                         │
│                                                                               │
│  store: {                                                                    │
│    getAgents: () => ipcRenderer.invoke('store-get-agents'),                 │
│    addAgent: (agent) => ipcRenderer.invoke('store-add-agent', agent),       │
│    getMessages: (id) => ipcRenderer.invoke('store-get-messages', id),       │
│    addMessage: (id, msg) => ipcRenderer.invoke('store-add-message', id, msg)│
│    // ... more operations                                                    │
│  }                                                                           │
│                                                                               │
└────────────────────────────────────────────┼──────────────────────────────────┘
                                             │
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                            MAIN PROCESS                                       │
│                                                                               │
│  ipcMain.handle('store-get-agents', () => getAgents())                      │
│  ipcMain.handle('store-add-agent', (_, agent) => addAgent(agent))           │
│  ipcMain.handle('store-get-messages', (_, id) => getMessages(id))           │
│  ipcMain.handle('store-add-message', (_, id, msg) => addMessage(id, msg))   │
│                                                                               │
└────────────────────────────────────────────┼──────────────────────────────────┘
                                             │
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                            STORE (store.ts)                                   │
│                                                                               │
│  const store = new Store<StoreSchema>({                                     │
│    name: 'chorus-data',                                                      │
│    defaults: { agents: [], messages: {}, sessionIds: {} }                   │
│  })                                                                          │
│                                                                               │
│  Data persisted to:                                                          │
│  ~/Library/Application Support/chorus/chorus-data.json (macOS)              │
│  %APPDATA%/chorus/chorus-data.json (Windows)                                │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Store Implementation

```typescript
// src/main/store.ts

import Store from 'electron-store'

// Types for stored data
export interface StoredAgent {
  id: string
  name: string
  repoPath: string
  createdAt: string
}

export interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string  // ISO string for serialization
}

interface StoreSchema {
  agents: StoredAgent[]
  messages: Record<string, StoredMessage[]>  // agentId -> messages
  sessionIds: Record<string, string>          // agentId -> sessionId
}

// Create typed store
const store = new Store<StoreSchema>({
  name: 'chorus-data',
  defaults: {
    agents: [],
    messages: {},
    sessionIds: {}
  }
})

// Agent operations
export function getAgents(): StoredAgent[] {
  return store.get('agents', [])
}

export function addAgent(agent: StoredAgent): void {
  const agents = getAgents()
  agents.push(agent)
  store.set('agents', agents)
}

export function removeAgent(agentId: string): void {
  const agents = getAgents().filter((a) => a.id !== agentId)
  store.set('agents', agents)
  // Also clean up related data
  const messages = store.get('messages', {})
  delete messages[agentId]
  store.set('messages', messages)
}

// Message operations
export function getMessages(agentId: string): StoredMessage[] {
  const messages = store.get('messages', {})
  return messages[agentId] || []
}

export function addMessage(agentId: string, message: StoredMessage): void {
  const messages = store.get('messages', {})
  if (!messages[agentId]) {
    messages[agentId] = []
  }
  messages[agentId].push(message)
  store.set('messages', messages)
}
```

---

## IPC Handlers

```typescript
// src/main/index.ts

// Get all agents
ipcMain.handle('store-get-agents', async () => {
  return { success: true, agents: getAgents() }
})

// Add an agent
ipcMain.handle('store-add-agent', async (_event, agent: StoredAgent) => {
  addAgent(agent)
  return { success: true }
})

// Get messages for an agent
ipcMain.handle('store-get-messages', async (_event, agentId: string) => {
  return { success: true, messages: getMessages(agentId) }
})

// Add a message
ipcMain.handle('store-add-message', async (_event, agentId: string, message: StoredMessage) => {
  addMessage(agentId, message)
  return { success: true }
})
```

---

## Preload API

```typescript
// src/preload/index.ts

store: {
  // Agent persistence
  getAgents: () => ipcRenderer.invoke('store-get-agents'),
  addAgent: (agent) => ipcRenderer.invoke('store-add-agent', agent),
  removeAgent: (agentId) => ipcRenderer.invoke('store-remove-agent', agentId),

  // Message persistence
  getMessages: (agentId) => ipcRenderer.invoke('store-get-messages', agentId),
  addMessage: (agentId, message) => ipcRenderer.invoke('store-add-message', agentId, message),
  clearMessages: (agentId) => ipcRenderer.invoke('store-clear-messages', agentId),

  // Session persistence
  getSession: (agentId) => ipcRenderer.invoke('store-get-session', agentId),
  setSession: (agentId, sessionId) => ipcRenderer.invoke('store-set-session', agentId, sessionId),
  clearSession: (agentId) => ipcRenderer.invoke('store-clear-session', agentId)
}
```

---

## Renderer Integration

```tsx
// src/renderer/src/App.tsx

// Load on startup
useEffect(() => {
  async function loadFromStore() {
    // Load agents
    const agentsResult = await window.api.store.getAgents()
    if (agentsResult.success && agentsResult.agents) {
      const loadedAgents = agentsResult.agents.map((stored) => ({
        id: stored.id,
        name: stored.name,
        repoPath: stored.repoPath,
        status: 'ready' as const,
        hasUnread: false
      }))
      setAgents(loadedAgents)

      // Load messages for each agent
      for (const agent of agentsResult.agents) {
        const messagesResult = await window.api.store.getMessages(agent.id)
        if (messagesResult.success && messagesResult.messages) {
          // Convert ISO strings back to Date objects
          const messages = messagesResult.messages.map((stored) => ({
            ...stored,
            timestamp: new Date(stored.timestamp)
          }))
          setConversations((prev) => ({ ...prev, [agent.id]: messages }))
        }
      }
    }
  }
  loadFromStore()
}, [])

// Persist when adding agent
const handleAddAgent = async () => {
  // ... create agent ...
  await window.api.store.addAgent({
    id: newAgent.id,
    name: newAgent.name,
    repoPath: newAgent.repoPath,
    createdAt: new Date().toISOString()
  })
}

// Persist messages
const persistMessage = useCallback(async (agentId: string, message: Message) => {
  await window.api.store.addMessage(agentId, {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp.toISOString()
  })
}, [])
```

---

## Key Concepts

### Why electron-store?

| Feature | electron-store | localStorage | fs |
|---------|---------------|--------------|-----|
| Main process access | Yes | No | Yes |
| Renderer access | Via IPC | Yes | No (sandboxed) |
| Type safety | Yes | No | Manual |
| Auto JSON handling | Yes | Yes | Manual |
| File location | App data dir | Browser storage | Manual |

### Date Serialization

```typescript
// Storing: Date -> ISO string
timestamp: message.timestamp.toISOString()

// Loading: ISO string -> Date
timestamp: new Date(stored.timestamp)
```

### Data Cleanup

When removing an agent, clean up associated data:
```typescript
export function removeAgent(agentId: string): void {
  // Remove agent
  const agents = getAgents().filter((a) => a.id !== agentId)
  store.set('agents', agents)

  // Remove messages
  const messages = store.get('messages', {})
  delete messages[agentId]
  store.set('messages', messages)

  // Remove session
  const sessions = store.get('sessionIds', {})
  delete sessions[agentId]
  store.set('sessionIds', sessions)
}
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/main/store.ts` | New - electron-store wrapper |
| `src/main/index.ts` | Added store IPC handlers |
| `src/preload/index.ts` | Exposed store APIs |
| `src/preload/index.d.ts` | Added store types |
| `src/renderer/src/App.tsx` | Load/save agents and messages |

---

## Testing

1. Run `bun run dev`
2. Add an agent by selecting a directory
3. Send a few messages
4. Close the app completely (Cmd+Q on macOS)
5. Restart the app
6. Verify:
   - Agent appears in sidebar
   - Previous messages are restored
   - Can continue the conversation

---

## Data Location

The store file is located at:

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/chorus/chorus-data.json` |
| Windows | `%APPDATA%/chorus/chorus-data.json` |
| Linux | `~/.config/chorus/chorus-data.json` |

You can inspect/edit this file directly for debugging.

---

## For Chorus

This enables:
- Persistent agent configurations
- Message history across sessions
- Session continuity with Claude
- User preferences storage (future)
- Multi-workspace support (future)
