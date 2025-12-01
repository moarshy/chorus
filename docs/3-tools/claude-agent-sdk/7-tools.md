# Tools

Claude Code agents have access to built-in tools for file operations, code search, and command execution. You can also create custom tools via MCP.

## Built-in Tools

| Tool | Description |
|------|-------------|
| `Read` | Read file contents |
| `Write` | Create or overwrite files |
| `Edit` | Make targeted edits to files |
| `Bash` | Execute shell commands |
| `Glob` | Find files by pattern |
| `Grep` | Search file contents |
| `LS` | List directory contents |
| `Task` | Delegate to subagents |
| `TodoWrite` | Manage task lists |
| `WebFetch` | Fetch web content |
| `WebSearch` | Search the web |
| `NotebookEdit` | Edit Jupyter notebooks |
| `AskUserQuestion` | Prompt for user input |

---

## Tool Control

### Allowlist

Pre-approve specific tools:

```typescript
options: {
  allowedTools: [
    'Read',              // All Read operations
    'Write(src/*)',      // Write only in src/
    'Bash(git *)',       // Git commands only
    'Bash(npm install)', // Specific command
  ]
}
```

### Denylist

Block specific tools:

```typescript
options: {
  disallowedTools: [
    'Bash(rm *)',        // Block rm commands
    'Bash(sudo *)',      // Block sudo
    'mcp__*',            // Block all MCP tools
  ]
}
```

### Pattern Syntax

| Pattern | Matches |
|---------|---------|
| `'Read'` | All Read tool calls |
| `'Write(src/*)'` | Write to src/ directory |
| `'Bash(git *)'` | Any git command |
| `'Bash(git commit:*)'` | Git commits with any message |
| `'Bash(npm install)'` | Exact command |
| `'mcp__server__*'` | All tools from MCP server |
| `'mcp__github__list_issues'` | Specific MCP tool |

---

## Custom MCP Tools

Create in-process tools using the SDK's MCP helpers.

### Basic Tool Definition

```typescript
import { tool, createSdkMcpServer, query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

// Define a tool with Zod schema
const getWeather = tool(
  'get_weather',                              // Tool name
  'Get current weather for a location',       // Description
  {
    location: z.string().describe('City name'),
    units: z.enum(['celsius', 'fahrenheit']).default('celsius')
  },
  async (args) => {                           // Handler
    const data = await fetchWeatherAPI(args.location, args.units);
    return {
      content: [{ type: 'text', text: JSON.stringify(data) }]
    };
  }
);
```

### Creating MCP Server

```typescript
// Create server with tools
const weatherServer = createSdkMcpServer({
  name: 'weather',
  version: '1.0.0',
  tools: [getWeather]
});

// Use in query
const stream = query({
  prompt: "What's the weather in London?",
  options: {
    mcpServers: {
      weather: weatherServer
    },
    allowedTools: ['mcp__weather__get_weather']
  }
});
```

### Tool Naming Convention

MCP tools follow the pattern: `mcp__{server_name}__{tool_name}`

Example: `mcp__weather__get_weather`

---

## Tool Handler Return Types

```typescript
interface ToolResult {
  content: ToolResultContent[];
  isError?: boolean;
}

type ToolResultContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'resource'; resource: { uri: string; text?: string } };
```

### Text Result

```typescript
return {
  content: [{ type: 'text', text: 'Operation completed successfully' }]
};
```

### Error Result

```typescript
return {
  content: [{ type: 'text', text: 'Failed: Invalid input' }],
  isError: true
};
```

### Image Result

```typescript
return {
  content: [{
    type: 'image',
    data: base64EncodedImage,
    mimeType: 'image/png'
  }]
};
```

---

## Complete Custom Tool Example

```typescript
import { tool, createSdkMcpServer, query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

// Database query tool
const queryDatabase = tool(
  'query_database',
  'Execute a read-only SQL query against the database',
  {
    query: z.string().describe('SQL SELECT query'),
    limit: z.number().default(100).describe('Max rows to return')
  },
  async (args, extra) => {
    // Validate query is SELECT only
    if (!args.query.trim().toLowerCase().startsWith('select')) {
      return {
        content: [{ type: 'text', text: 'Error: Only SELECT queries allowed' }],
        isError: true
      };
    }

    try {
      const results = await db.query(args.query, { limit: args.limit });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(results, null, 2)
        }]
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Database error: ${err.message}` }],
        isError: true
      };
    }
  }
);

// Create MCP server
const dbServer = createSdkMcpServer({
  name: 'database',
  version: '1.0.0',
  tools: [queryDatabase]
});

// Use in query
const stream = query({
  prompt: "List all users who signed up this month",
  options: {
    mcpServers: { database: dbServer },
    allowedTools: ['Read', 'mcp__database__query_database']
  }
});
```

---

## External MCP Servers

### Stdio Transport

```typescript
options: {
  mcpServers: {
    'filesystem': {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/path']
    }
  }
}
```

### HTTP Transport

```typescript
options: {
  mcpServers: {
    'remote-service': {
      type: 'http',
      url: 'https://mcp.example.com/api',
      headers: {
        'Authorization': 'Bearer token'
      }
    }
  }
}
```

### SSE Transport (Deprecated)

```typescript
options: {
  mcpServers: {
    'sse-service': {
      type: 'sse',
      url: 'https://mcp.example.com/sse'
    }
  }
}
```

---

## Tool Timeout

For long-running MCP tools, set timeout:

```typescript
// Set environment variable
process.env.CLAUDE_CODE_STREAM_CLOSE_TIMEOUT = '120000';  // 2 minutes

// Or handle in tool
const longRunningTool = tool(
  'long_task',
  'A task that takes time',
  { input: z.string() },
  async (args) => {
    // Long operation
    await someSlowOperation(args.input);
    return { content: [{ type: 'text', text: 'Done' }] };
  }
);
```

---

## Built-in Tool Details

### Read

```typescript
{
  "name": "Read",
  "input": {
    "file_path": "/path/to/file.ts",
    "offset": 0,      // Optional: start line
    "limit": 2000     // Optional: max lines
  }
}
```

### Write

```typescript
{
  "name": "Write",
  "input": {
    "file_path": "/path/to/file.ts",
    "content": "file contents here"
  }
}
```

### Edit

```typescript
{
  "name": "Edit",
  "input": {
    "file_path": "/path/to/file.ts",
    "old_string": "text to replace",
    "new_string": "replacement text",
    "replace_all": false  // Optional: replace all occurrences
  }
}
```

### Bash

```typescript
{
  "name": "Bash",
  "input": {
    "command": "git status",
    "description": "Check git status",
    "timeout": 120000,  // Optional: timeout in ms
    "run_in_background": false
  }
}
```

### Glob

```typescript
{
  "name": "Glob",
  "input": {
    "pattern": "**/*.ts",
    "path": "/optional/base/path"
  }
}
```

### Grep

```typescript
{
  "name": "Grep",
  "input": {
    "pattern": "function.*export",  // Regex
    "path": "/search/path",
    "glob": "*.ts",                 // Optional file filter
    "output_mode": "content"        // "content" | "files_with_matches" | "count"
  }
}
```

### Task (Subagent)

```typescript
{
  "name": "Task",
  "input": {
    "subagent_type": "reviewer",
    "prompt": "Review the auth module",
    "description": "Code review task"
  }
}
```

### TodoWrite

```typescript
{
  "name": "TodoWrite",
  "input": {
    "todos": [
      {
        "content": "Implement feature X",
        "status": "in_progress",
        "activeForm": "Implementing feature X"
      },
      {
        "content": "Write tests",
        "status": "pending",
        "activeForm": "Writing tests"
      }
    ]
  }
}
```

---

## Chorus Implementation

### Tool Tracking via Hooks

```typescript
// chorus/src/main/services/agent-sdk-service.ts

hooks: {
  PostToolUse: [{
    hooks: [async (input, toolUseId) => {
      // Track tool calls for Details panel
      mainWindow.webContents.send('agent:tool-call', {
        conversationId,
        toolName: input.tool_name,
        toolInput: input.tool_input,
        toolResponse: input.tool_response,
        toolUseId,
        isError: input.tool_response?.is_error
      });

      // Track file changes specifically
      if (input.tool_name === 'Write' || input.tool_name === 'Edit') {
        mainWindow.webContents.send('agent:file-changed', {
          conversationId,
          file: input.tool_input?.file_path
        });
      }

      return { continue: true };
    }]
  }]
}
```

### Tool Call Display

```typescript
// chorus/src/renderer/src/components/Chat/ToolCallsGroup.tsx

function ToolCallsGroup({ toolCalls }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="tool-calls-group">
      <button onClick={() => setExpanded(!expanded)}>
        {toolCalls.length} tool calls
      </button>

      {expanded && toolCalls.map(call => (
        <ToolCallItem
          key={call.id}
          name={call.name}
          input={call.input}
          output={call.output}
          isError={call.isError}
        />
      ))}
    </div>
  );
}
```

---

## Best Practices

### 1. Minimal Tool Access

Start restrictive, add as needed:

```typescript
// Start with read-only
allowedTools: ['Read', 'Glob', 'Grep']

// Add write access only when needed
allowedTools: ['Read', 'Glob', 'Grep', 'Write(src/*)']
```

### 2. Scope Bash Commands

Never allow unrestricted Bash:

```typescript
// Bad
allowedTools: ['Bash']

// Good
allowedTools: [
  'Bash(git *)',
  'Bash(npm install)',
  'Bash(npm test)'
]
```

### 3. Validate Custom Tool Input

```typescript
const safeTool = tool(
  'process_data',
  'Process user data',
  {
    userId: z.string().uuid(),  // Validate UUID format
    action: z.enum(['read', 'update'])  // Restrict values
  },
  async (args) => {
    // Input is already validated by Zod
    // ...
  }
);
```

### 4. Handle Tool Errors

```typescript
async (args) => {
  try {
    const result = await operation(args);
    return { content: [{ type: 'text', text: result }] };
  } catch (err) {
    // Return error to agent, don't throw
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true
    };
  }
}
```

---

## References

- [SDK MCP Documentation](https://platform.claude.com/docs/en/agent-sdk/mcp)
- [MCP Specification](https://modelcontextprotocol.io/)
- [Claude Code Tools](https://code.claude.com/docs/en/tools)
