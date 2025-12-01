# Streaming

The Claude Agent SDK supports real-time message streaming for responsive UIs. This document covers streaming configuration, partial messages, and interruption.

## Default Behavior

By default, the SDK emits complete messages only:

```typescript
for await (const message of query({ prompt: "Task" })) {
  // Only complete SDKAssistantMessage, SDKUserMessage, etc.
  // No partial/streaming chunks
}
```

This means text appears all at once after Claude finishes generating.

---

## Enabling Real-Time Streaming

Use `includePartialMessages: true` for character-by-character streaming:

```typescript
const stream = query({
  prompt: "Analyze this codebase",
  options: {
    includePartialMessages: true
  }
});

for await (const message of stream) {
  if (message.type === 'stream_event') {
    // Partial streaming chunk
    const event = message.event;

    if (event.type === 'content_block_delta') {
      const delta = event.delta;

      if (delta.type === 'text_delta') {
        process.stdout.write(delta.text);  // Real-time text
      }

      if (delta.type === 'thinking_delta') {
        process.stdout.write(delta.thinking);  // Extended thinking
      }
    }
  }

  if (message.type === 'assistant') {
    // Complete message - use for tool_use processing
  }
}
```

---

## Stream Event Types

When `includePartialMessages: true`, you receive `SDKPartialAssistantMessage`:

```typescript
interface SDKPartialAssistantMessage {
  type: 'stream_event';
  uuid: UUID;
  session_id: string;
  parent_tool_use_id: string | null;
  event: RawMessageStreamEvent;
}
```

### Event Types

| Event | Description |
|-------|-------------|
| `message_start` | Beginning of new message |
| `content_block_start` | Start of content block (text, tool_use) |
| `content_block_delta` | Incremental content chunks |
| `content_block_stop` | End of content block |
| `message_delta` | Message-level updates (usage) |
| `message_stop` | Message complete |

### Delta Types

| Delta Type | Content |
|------------|---------|
| `text_delta` | `{ text: string }` |
| `thinking_delta` | `{ thinking: string }` |
| `input_json_delta` | `{ partial_json: string }` (tool input) |

---

## Complete Streaming Example

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

async function streamWithUI() {
  let currentText = '';

  const stream = query({
    prompt: "Explain how promises work in JavaScript",
    options: {
      includePartialMessages: true
    }
  });

  for await (const message of stream) {
    switch (message.type) {
      case 'stream_event':
        handleStreamEvent(message.event);
        break;

      case 'assistant':
        // Complete message - process tool_use blocks
        for (const block of message.message.content) {
          if (block.type === 'tool_use') {
            console.log('\nTool:', block.name);
          }
        }
        break;

      case 'result':
        console.log('\nCost:', message.total_cost_usd);
        break;
    }
  }

  function handleStreamEvent(event: RawMessageStreamEvent) {
    switch (event.type) {
      case 'content_block_delta':
        if (event.delta.type === 'text_delta') {
          currentText += event.delta.text;
          process.stdout.write(event.delta.text);
        }
        break;

      case 'content_block_stop':
        // Block finished
        if (event.index === 0) {
          // First block (usually text) done
        }
        break;
    }
  }
}
```

---

## Interruption

Stop execution mid-stream:

### Using interrupt()

```typescript
const stream = query({ prompt: "Long task" });

// Set up timeout
setTimeout(() => {
  stream.interrupt();
}, 30000);

// Or on user action
cancelButton.onclick = () => stream.interrupt();

try {
  for await (const message of stream) {
    // Process messages
  }
} catch (err) {
  if (err.name === 'AbortError') {
    console.log('Interrupted by user');
  } else {
    throw err;
  }
}
```

### Using AbortController

```typescript
const controller = new AbortController();

const stream = query({
  prompt: "Task",
  options: {
    abortController: controller
  }
});

// Cancel from anywhere
controller.abort();
```

---

## Mid-Stream Control

### Change Permission Mode

```typescript
const stream = query({ prompt: "Task" });

// After some messages, escalate permissions
stream.setPermissionMode('acceptEdits');
```

### Change Model

```typescript
const stream = query({ prompt: "Complex task" });

// Switch to more capable model
stream.setModel('opus');
```

### Set Thinking Limit

```typescript
const stream = query({ prompt: "Reasoning task" });

// Limit thinking tokens
stream.setMaxThinkingTokens(5000);

// Remove limit
stream.setMaxThinkingTokens(null);
```

---

## Query Metadata Methods

### Get Available Commands

```typescript
const stream = query({ prompt: "Hello" });
const commands = await stream.supportedCommands();
// [{ name: 'help', description: '...', argumentHint: '' }, ...]
```

### Get Available Models

```typescript
const models = await stream.supportedModels();
// [{ value: 'claude-sonnet-4-20250514', displayName: 'Sonnet 4', ... }]
```

### Get MCP Server Status

```typescript
const status = await stream.mcpServerStatus();
// [{ name: 'filesystem', status: 'connected', serverInfo: {...} }]
```

### Get Account Info

```typescript
const account = await stream.accountInfo();
// { email: '...', organization: '...', subscriptionType: '...' }
```

---

## Chorus Implementation

### Real-Time Text Streaming

```typescript
// chorus/src/main/services/agent-sdk-service.ts

const stream = query({
  prompt: message,
  options: {
    includePartialMessages: true,
    // ...other options
  }
});

let streamingText = '';

for await (const msg of stream) {
  if (msg.type === 'stream_event') {
    const event = msg.event;

    if (event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta') {
      streamingText += event.delta.text;

      // Send to renderer for immediate display
      mainWindow.webContents.send('agent:stream-delta', {
        conversationId,
        text: event.delta.text
      });
    }
  }

  if (msg.type === 'assistant') {
    // Flush streaming text as complete message
    if (streamingText) {
      mainWindow.webContents.send('agent:stream-clear', { conversationId });
      // Store complete message
      await storeMessage(conversationId, msg);
      streamingText = '';
    }

    // Handle tool_use blocks
    for (const block of msg.message.content) {
      if (block.type === 'tool_use') {
        mainWindow.webContents.send('agent:tool-use', {
          conversationId,
          tool: block.name,
          input: block.input
        });
      }
    }
  }
}
```

### Renderer Streaming Display

```typescript
// chorus/src/renderer/src/components/Chat/StreamingBubble.tsx

function StreamingBubble({ conversationId }) {
  const [streamingText, setStreamingText] = useState('');

  useEffect(() => {
    const unsubscribeDelta = window.api.agent.onStreamDelta((event) => {
      if (event.conversationId === conversationId) {
        setStreamingText(prev => prev + event.text);
      }
    });

    const unsubscribeClear = window.api.agent.onStreamClear((event) => {
      if (event.conversationId === conversationId) {
        setStreamingText('');
      }
    });

    return () => {
      unsubscribeDelta();
      unsubscribeClear();
    };
  }, [conversationId]);

  if (!streamingText) return null;

  return (
    <div className="streaming-bubble">
      <MarkdownContent content={streamingText} />
      <span className="cursor">|</span>
    </div>
  );
}
```

### Interleaved Text and Tools

The key challenge is displaying text interleaved with tool calls:

```
Text: "Let me analyze..."  → displayed
Tool calls (3x)            → displayed as collapsible group
Text: "Now I understand..." → displayed
Tool calls (5x)            → displayed as another group
Text: "Here's the report..." → displayed
```

**Solution:** Flush streaming text to permanent message before processing tool_use:

```typescript
if (msg.type === 'assistant') {
  const hasToolUse = msg.message.content.some(b => b.type === 'tool_use');

  if (hasToolUse && streamingText) {
    // Flush text FIRST
    emitTextMessage(streamingText);
    streamingText = '';
  }

  // Then process tool_use blocks
  for (const block of msg.message.content) {
    if (block.type === 'tool_use') {
      emitToolUse(block);
    }
  }
}
```

### Interruption Support

```typescript
// chorus/src/main/services/agent-sdk-service.ts

const activeStreams = new Map<string, Query>();

export async function sendMessage(conversationId: string, message: string) {
  const stream = query({ prompt: message, options });

  // Store for interruption
  activeStreams.set(conversationId, stream);

  try {
    for await (const msg of stream) {
      // Process messages
    }
  } finally {
    activeStreams.delete(conversationId);
  }
}

export function interruptAgent(conversationId: string) {
  const stream = activeStreams.get(conversationId);
  if (stream) {
    stream.interrupt();
  }
}

// IPC handler
ipcMain.handle('agent:interrupt', (_, { conversationId }) => {
  interruptAgent(conversationId);
});
```

```typescript
// Renderer
const handleStop = () => {
  window.api.agent.interrupt(conversationId);
};
```

---

## Best Practices

### 1. Always Handle Both Message Types

```typescript
for await (const message of stream) {
  if (message.type === 'stream_event') {
    // Real-time display
  }
  if (message.type === 'assistant') {
    // Complete processing (tool_use, storage)
  }
}
```

### 2. Clear Streaming State

```typescript
// Clear streaming buffer when:
// - Complete message received
// - Tool use starts
// - Session ends
// - Error occurs
```

### 3. Debounce UI Updates

```typescript
// For very fast streaming, debounce renders
const debouncedUpdate = debounce((text) => {
  setDisplayText(text);
}, 16);  // ~60fps
```

### 4. Handle Partial JSON

Tool input streams as partial JSON. Wait for complete:

```typescript
// Don't try to parse input_json_delta
// Wait for assistant message with complete tool_use block
```

---

## References

- [SDK Streaming Documentation](https://platform.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)
- [Anthropic Streaming API](https://docs.anthropic.com/en/api/messages-streaming)
