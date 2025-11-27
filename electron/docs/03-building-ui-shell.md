# Module 3: Building the UI Shell

A Slack-like interface for Chorus using React + Tailwind CSS.

---

## What We Built

```
┌─────────────────────────────────────────────────────────────────┐
│                         Chorus                                  │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                  │
│   Chorus     │              Welcome to Chorus                   │
│   ─────────  │                                                  │
│              │   Select an agent from the sidebar or add        │
│   AGENTS     │   a new one to get started.                      │
│              │                                                  │
│  ● Product   │──────────────────────────────────────────────────│
│  ◐ Research  │                                                  │
│  ● Journal   │   User: Can you help me with...                  │
│              │                                                  │
│              │   Agent: This is a simulated response...         │
│              │                                                  │
│  [+ Add]     │  ┌────────────────────────────────────────────┐  │
│              │  │ Message the agent...                       │  │
└──────────────┴──└────────────────────────────────────────────┘──┘
```

---

## Files Created

```
src/renderer/src/
├── types.ts                 # Agent, Message types
├── components/
│   ├── Sidebar.tsx          # Agent list with status
│   ├── ChatPanel.tsx        # Messages and header
│   └── MessageInput.tsx     # Text input with send
├── assets/
│   └── main.css             # Tailwind + dark theme
└── App.tsx                  # Main composition
```

---

## Tailwind CSS v4 Setup

Tailwind v4 uses a simpler setup - just import in CSS:

```css
/* main.css */
@import "tailwindcss";

:root {
  --sidebar-bg: #1a1d21;
  --chat-bg: #222529;
  --accent: #4f46e5;
  /* ... */
}
```

---

## Component Structure

### Sidebar

```tsx
function Sidebar({ agents, selectedAgentId, onSelectAgent, onAddAgent }) {
  return (
    <div className="w-64 h-full bg-[var(--sidebar-bg)]">
      {/* Header */}
      <div className="p-4 border-b">
        <h1>Chorus</h1>
      </div>

      {/* Agent List */}
      {agents.map(agent => (
        <button onClick={() => onSelectAgent(agent.id)}>
          <StatusDot status={agent.status} />
          <span>{agent.name}</span>
        </button>
      ))}

      {/* Add Button */}
      <button onClick={onAddAgent}>+ Add Agent</button>
    </div>
  )
}
```

### ChatPanel

```tsx
function ChatPanel({ agent, messages, onSendMessage, isStreaming }) {
  return (
    <div className="flex-1 flex flex-col">
      {/* Header with agent info */}
      <Header agent={agent} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.map(msg => <Message key={msg.id} {...msg} />)}
      </div>

      {/* Input */}
      <MessageInput onSend={onSendMessage} disabled={isStreaming} />
    </div>
  )
}
```

### MessageInput

```tsx
function MessageInput({ onSend, disabled }) {
  const [content, setContent] = useState('')

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend(content)
      setContent('')
    }
  }

  return (
    <textarea
      value={content}
      onChange={(e) => setContent(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Message the agent..."
    />
  )
}
```

---

## State Management

Currently using React useState for simplicity:

```tsx
function App() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Record<string, Message[]>>({})
  const [isStreaming, setIsStreaming] = useState(false)

  // Derived state
  const selectedAgent = agents.find(a => a.id === selectedAgentId)
  const currentMessages = conversations[selectedAgentId] || []
}
```

In future modules, we'll:
- Persist to electron-store
- Sync with main process
- Add proper streaming from Claude Agent SDK

---

## Adding an Agent (IPC Integration)

The "+ Add Agent" button uses IPC from Module 2:

```tsx
const handleAddAgent = async () => {
  // Opens native directory picker (via IPC)
  const result = await window.api.selectDirectory()

  if (result.success && result.dirPath) {
    const name = result.dirPath.split('/').pop()
    const newAgent = {
      id: Date.now().toString(),
      name,
      repoPath: result.dirPath,
      status: 'ready'
    }
    setAgents(prev => [...prev, newAgent])
  }
}
```

---

## Status Indicators

```tsx
// Green dot = ready
// Yellow dot = busy (agent working)
// Gray dot = offline

<div className={`
  w-3 h-3 rounded-full
  ${status === 'ready' ? 'bg-green-500' :
    status === 'busy' ? 'bg-yellow-500' : 'bg-gray-500'}
`} />
```

---

## Dark Theme Colors

| Variable | Value | Usage |
|----------|-------|-------|
| `--sidebar-bg` | #1a1d21 | Sidebar background |
| `--chat-bg` | #222529 | Main chat area |
| `--input-bg` | #2c2f33 | Input field background |
| `--border-color` | #383a3e | Dividers |
| `--accent` | #4f46e5 | Buttons, highlights |
| `--text-primary` | #e5e7eb | Main text |
| `--text-secondary` | #9ca3af | Muted text |

---

## Next Steps

In Module 4, we'll:
- Add file system operations to browse agent repos
- Implement git status display
- Add tabs (Messages, Files, Docs)

In Module 5, we'll:
- Integrate Claude Agent SDK
- Stream real responses
- Handle agent lifecycle
