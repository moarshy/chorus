# Session Management

Sessions preserve conversation history and context across multiple interactions. The SDK provides session IDs for resuming, forking, and managing long-running agent conversations.

## Session Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    New Session                               │
│  query({ prompt: "Start task" })                            │
│                                                              │
│  1. system (init) message → session_id: "abc-123"           │
│  2. assistant messages                                       │
│  3. result message → session_id: "abc-123"                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
              Store session_id for later
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Resume Session                              │
│  query({ prompt: "Continue", options: { resume: "abc-123" }})│
│                                                              │
│  1. system (init) → session_id: "abc-123" (same ID)         │
│  2. Previous context restored                                │
│  3. Continue conversation                                    │
└─────────────────────────────────────────────────────────────┘
```

## Capturing Session ID

The session ID is available in the `system` init message:

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

let sessionId: string | undefined;

for await (const message of query({ prompt: "Start task" })) {
  if (message.type === 'system' && message.subtype === 'init') {
    sessionId = message.session_id;
    console.log('Session started:', sessionId);
  }

  if (message.type === 'result') {
    // Also available in result message
    console.log('Session ended:', message.session_id);
  }
}

// Store sessionId for later resumption
```

---

## Resuming Sessions

### Basic Resume

```typescript
const stream = query({
  prompt: "Continue where we left off",
  options: {
    resume: sessionId  // Session ID from previous conversation
  }
});
```

### Verify Resume Success

Compare returned session ID with expected:

```typescript
let expectedSessionId = storedSessionId;
let newSessionId: string | undefined;

for await (const message of query({
  prompt: "Continue",
  options: { resume: expectedSessionId }
})) {
  if (message.type === 'system' && message.subtype === 'init') {
    newSessionId = message.session_id;

    if (newSessionId === expectedSessionId) {
      console.log('Resume SUCCESS - continuing session');
    } else {
      console.log('Resume FAILED - new session started');
      // Update stored session ID
      expectedSessionId = newSessionId;
    }
  }
}
```

---

## Forking Sessions

Fork creates a new session branching from an existing session's state. Useful for exploring alternatives.

```typescript
// Original session
const original = query({ prompt: "Analyze codebase" });
let sessionId: string;

for await (const msg of original) {
  if (msg.type === 'system') sessionId = msg.session_id;
}

// Fork: try alternative approach
const fork = query({
  prompt: "Try a different approach",
  options: {
    resume: sessionId,
    forkSession: true  // Creates new session from this point
  }
});

// fork gets a NEW session_id but starts with same context
```

---

## Resume from Specific Message

Resume from a specific point in conversation history:

```typescript
const stream = query({
  prompt: "Continue from here",
  options: {
    resume: sessionId,
    resumeSessionAt: messageUuid  // SDKAssistantMessage.uuid
  }
});
```

This is useful for "rewinding" to an earlier state.

---

## Session Expiration

Sessions expire after approximately **25-30 days**. Track creation time:

```typescript
const SESSION_MAX_AGE_DAYS = 25;

interface StoredSession {
  sessionId: string;
  sessionCreatedAt: string;  // ISO timestamp
}

function isSessionExpired(session: StoredSession): boolean {
  const createdAt = new Date(session.sessionCreatedAt);
  const ageMs = Date.now() - createdAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays > SESSION_MAX_AGE_DAYS;
}

// Before resuming
if (storedSession && !isSessionExpired(storedSession)) {
  options.resume = storedSession.sessionId;
} else {
  // Start fresh - don't pass resume
  storedSession = null;
}
```

---

## Session Storage Location

Claude Code stores session data in:

```
~/.claude/projects/<project-hash>/
```

Sessions are managed by the SDK internally. You only need to store:
- `session_id` - For resumption
- `sessionCreatedAt` - For expiry tracking

---

## Best Practices

### 1. Always Pass Settings When Resuming

Settings don't persist across sessions. Always pass explicitly:

```typescript
// Wrong - settings may revert
query({
  prompt: "Continue",
  options: { resume: sessionId }
});

// Correct - always pass settings
query({
  prompt: "Continue",
  options: {
    resume: sessionId,
    model: settings.model,
    permissionMode: settings.permissionMode,
    allowedTools: settings.allowedTools
  }
});
```

### 2. Don't Pass System Prompt When Resuming

Resumed sessions use the original system prompt:

```typescript
const options: Options = {
  cwd: workspace,
  resume: sessionId
};

// Only set systemPrompt for NEW sessions
if (!sessionId) {
  options.systemPrompt = {
    type: 'preset',
    preset: 'claude_code'
  };
}
```

### 3. Track Session Age, Not Just ID

```typescript
interface ConversationSession {
  sessionId: string | null;
  sessionCreatedAt: string | null;  // Track this!
}
```

### 4. Update Creation Time Only for New Sessions

```typescript
for await (const message of stream) {
  if (message.type === 'system' && message.subtype === 'init') {
    const isNewSession = !expectedSessionId ||
                         message.session_id !== expectedSessionId;

    if (isNewSession) {
      // New session - update creation time
      updateConversation({
        sessionId: message.session_id,
        sessionCreatedAt: new Date().toISOString()
      });
    } else {
      // Resumed - only update sessionId (keep original createdAt)
      updateConversation({
        sessionId: message.session_id
      });
    }
  }
}
```

### 5. Model Changes Are Expensive

Switching models mid-session causes reprocessing of history:

```typescript
// Warn user before model change on active session
if (sessionId && newModel !== currentModel) {
  console.warn('Changing models will reprocess conversation history');
}
```

---

## Chorus Implementation

### Conversation State

```typescript
// chorus/src/renderer/src/stores/chat-store.ts

interface Conversation {
  id: string;
  agentId: string;
  workspaceId: string;
  sessionId: string | null;        // Claude session ID
  sessionCreatedAt: string | null; // ISO timestamp for expiry
  // ...
}
```

### Session Sync via IPC

The main process captures session IDs and syncs to renderer:

```typescript
// Main process: agent-sdk-service.ts
for await (const message of stream) {
  if (message.type === 'system' && message.subtype === 'init') {
    // Notify renderer of session
    mainWindow.webContents.send('agent:session-update', {
      conversationId,
      sessionId: message.session_id,
      sessionCreatedAt: new Date().toISOString()
    });
  }
}

// Renderer: chat-store.ts
window.api.agent.onSessionUpdate((event) => {
  const conversation = conversations.get(event.conversationId);
  if (!conversation) return;

  // Only update createdAt for new sessions
  const isNewSession = !conversation.sessionId ||
                       conversation.sessionId !== event.sessionId;

  updateConversation(event.conversationId, {
    sessionId: event.sessionId,
    sessionCreatedAt: isNewSession ? event.sessionCreatedAt : undefined
  });
});
```

### Pre-Send Session Check

```typescript
// Before sending message
async function sendMessage(conversationId: string, message: string) {
  const conversation = getConversation(conversationId);

  let effectiveSessionId = conversation.sessionId;

  // Check expiry
  if (conversation.sessionCreatedAt) {
    const ageDays = getSessionAgeDays(conversation.sessionCreatedAt);
    if (ageDays > 25) {
      effectiveSessionId = null;  // Start fresh
    }
  }

  // Pass to SDK service
  await window.api.agent.sendMessage({
    conversationId,
    message,
    sessionId: effectiveSessionId,
    settings: conversation.settings
  });
}
```

---

## Common Issues

### Resume Fails Silently

**Symptom:** New session created instead of resuming.

**Causes:**
- Session expired (>30 days)
- Session data deleted from `~/.claude/`
- Invalid session ID format

**Solution:** Always verify by comparing returned session ID.

### Context Lost After Resume

**Symptom:** Agent doesn't remember previous conversation.

**Causes:**
- Resume actually failed (new session)
- Context was compacted (summarized)

**Solution:** Check if session IDs match. If compacted, context summary is still available.

### Settings Don't Persist

**Symptom:** Model/permissions revert after resume.

**Solution:** Always pass settings explicitly on every call.

---

## References

- [SDK Sessions Documentation](https://platform.claude.com/docs/en/agent-sdk/sessions)
- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
