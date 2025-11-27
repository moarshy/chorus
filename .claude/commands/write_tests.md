# Write Tests Command

You are tasked with writing tests for the referenced feature, code defined by an implementation plan, or referenced file(s) in the Chorus desktop app.

## Initial Response

When this command is invoked:

1. **Check if parameters were provided**:
   - If a feature, implementation plan, or file path was provided, begin the discovery process with that context
   - If files are referenced, read them FULLY first to understand existing context
   - If no parameters provided, respond with the default prompt below

2. **If no parameters provided**, respond with:
```
I'm ready to help you write tests. Please provide a feature, implementation plan, file path(s), and I will analyze it thoroughly and proceed to write tests for it.

What would you like me to test? This could be:
- A feature spec ("docs/features/agent-notifications.md")
- An implementation plan ("docs/implementation/sidebar-plan.md")
- Specific files ("electron/ipc/agent-handlers.ts")
- A component ("src/components/Sidebar/AgentList.tsx")

Tip: You can invoke this command with context: `/write_tests electron/ipc/agent-handlers.ts`
```

Then wait for the user's input.

## Core Testing Principles for Chorus

### 1. Test What Matters
- **DO** test IPC communication between main/renderer
- **DO** test SDK client integration
- **DO** test state management logic
- **DO** test React component behavior
- **DON'T** test Electron/React framework internals

### 2. Integration Over Unit
- Test complete flows where possible
- If testing IPC, test both handler and caller
- Test state changes end-to-end

### 3. One Test File Per Feature
- Name test files after the feature, not implementation details
- Place tests in `__tests__/` directories
- All test files should end with `.test.ts` or `.test.tsx`

## Test Setup

### Electron Main Process Tests
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Electron's ipcMain
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  BrowserWindow: vi.fn(),
}));

// Mock SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

describe('Agent Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle agent query', async () => {
    // Test implementation
  });
});
```

### React Component Tests
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentList } from './AgentList';

// Mock IPC
vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}));

describe('AgentList Component', () => {
  it('should render list of agents', () => {
    render(<AgentList agents={mockAgents} />);
    expect(screen.getByText('Product Agent')).toBeInTheDocument();
  });
});
```

### Zustand Store Tests
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useAgentStore } from './agentStore';

describe('Agent Store', () => {
  beforeEach(() => {
    // Reset store state
    useAgentStore.setState({
      agents: [],
      activeAgentId: null,
    });
  });

  it('should add agent', () => {
    const { addAgent, agents } = useAgentStore.getState();
    addAgent({ id: '1', name: 'Test Agent', repoPath: '/path' });
    expect(useAgentStore.getState().agents).toHaveLength(1);
  });
});
```

## Test Structure

### Good Test File Structure
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Feature: Agent Management', () => {
  // Setup and teardown
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup test state
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Adding Agents', () => {
    it('should add agent via IPC', async () => {
      // Arrange
      const mockAgent = { name: 'Test', repoPath: '/test' };

      // Act
      await addAgentHandler(mockEvent, mockAgent);

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle invalid repo path', async () => {
      // Test error case
    });
  });

  describe('Agent Status Updates', () => {
    it('should update status on SDK hook', () => {
      // Test status updates
    });
  });
});
```

## Testing Patterns for Chorus

### IPC Handler Tests
```typescript
describe('IPC Handler: agent:query', () => {
  it('should stream messages to renderer', async () => {
    const mockSend = vi.fn();
    const mockEvent = {
      sender: { send: mockSend },
    };

    // Mock SDK query
    const mockQuery = vi.fn().mockImplementation(async function* () {
      yield { type: 'assistant', content: 'Hello' };
      yield { type: 'result', total_cost_usd: 0.01 };
    });

    await handleAgentQuery(mockEvent, { agentId: '1', prompt: 'test' });

    expect(mockSend).toHaveBeenCalledWith('agent:message', expect.anything());
    expect(mockSend).toHaveBeenCalledWith('agent:complete', expect.anything());
  });
});
```

### SDK Integration Tests
```typescript
describe('SDK Client Management', () => {
  it('should create client with correct options', () => {
    const repoPath = '/path/to/repo';
    const client = createSDKClient(repoPath);

    expect(client.options.cwd).toBe(repoPath);
    expect(client.options.settingSources).toContain('project');
  });

  it('should configure hooks for status updates', () => {
    const client = createSDKClient('/path');
    expect(client.options.hooks.SubagentStop).toBeDefined();
  });
});
```

### State Management Tests
```typescript
describe('Agent Store Actions', () => {
  it('should update agent status', () => {
    const store = useAgentStore.getState();
    store.addAgent({ id: '1', name: 'Test', status: 'idle' });
    store.setAgentStatus('1', 'busy');

    expect(useAgentStore.getState().agents[0].status).toBe('busy');
  });

  it('should persist active agent', () => {
    const store = useAgentStore.getState();
    store.setActiveAgent('1');

    expect(useAgentStore.getState().activeAgentId).toBe('1');
  });
});
```

### React Component Tests
```typescript
describe('Chat Component', () => {
  it('should send message on form submit', async () => {
    const mockSendMessage = vi.fn();
    render(<ChatInput onSend={mockSendMessage} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Hello');
    await userEvent.keyboard('{Enter}');

    expect(mockSendMessage).toHaveBeenCalledWith('Hello');
  });

  it('should display agent messages', () => {
    const messages = [
      { type: 'user', content: 'Hello' },
      { type: 'assistant', content: 'Hi there!' },
    ];

    render(<MessageList messages={messages} />);

    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });
});
```

## What NOT to Do

### Bad Example - Over-mocking
```typescript
// DON'T DO THIS - mocking everything defeats the purpose
const mockStore = {
  agents: [],
  addAgent: vi.fn(),
  setStatus: vi.fn(),
};

// This doesn't test the actual store logic
```

### Bad Example - Testing Implementation Details
```typescript
// DON'T DO THIS - testing internal state structure
it('should set _internalFlag to true', () => {
  // This tests implementation, not behavior
});
```

### Bad Example - Separate Files for Each Layer
```typescript
// DON'T create these separate files:
// - agent-handlers.test.ts (just handlers)
// - agent-store.test.ts (just store)
// - agent-ipc.test.ts (just IPC)

// DO create one file:
// - agent-management.test.ts (tests the complete feature)
```

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test agent-management.test.ts

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

## Test Organization

```
cc-slack/
├── electron/
│   ├── __tests__/
│   │   ├── agent-handlers.test.ts
│   │   └── sdk-client.test.ts
│   └── ipc/
│       └── agent-handlers.ts
├── src/
│   ├── components/
│   │   ├── __tests__/
│   │   │   ├── AgentList.test.tsx
│   │   │   └── ChatWindow.test.tsx
│   │   └── Sidebar/
│   │       └── AgentList.tsx
│   └── store/
│       ├── __tests__/
│       │   └── agentStore.test.ts
│       └── agentStore.ts
```

## Key Reminders

1. **Test behavior, not implementation** - Focus on what the code does, not how
2. **Mock at boundaries** - Mock IPC, SDK, file system - not internal functions
3. **Test error cases** - Ensure errors are handled gracefully
4. **Keep tests focused** - One concept per test
5. **Use descriptive names** - Test names should explain the scenario
6. **Clean up after tests** - Reset state, clear mocks
7. **Test async properly** - Use async/await, handle promises correctly
8. **Consider Electron context** - Main vs renderer process differences

## Vitest Configuration Reference

Chorus uses Vitest for testing. Key configuration:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom', // for React components
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
});
```

Remember: **Test the real behavior. Mock at system boundaries. Focus on user-visible functionality.**
