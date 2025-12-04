# Security

The Claude Agent SDK provides tools for file operations, command execution, and web access. Understanding security boundaries and implementing proper safeguards is critical.

## Working Directory (cwd) Limitation

### The Problem

**The `cwd` option does NOT enforce strict directory boundaries.** It only sets the working directory for the agent, but does not prevent file operations outside that directory.

```typescript
// This does NOT restrict file operations to /my/workspace
options: {
  cwd: '/my/workspace'
}
```

The agent can still:
- Read files anywhere using absolute paths: `Read({ file_path: '/etc/passwd' })`
- Write files outside cwd: `Write({ file_path: '/tmp/malicious.sh', content: '...' })`
- Execute commands that access other directories: `Bash({ command: 'cat ~/.ssh/id_rsa' })`

### Known Issues

This is a documented limitation with multiple GitHub issues:

| Issue | Description |
|-------|-------------|
| [#7150](https://github.com/anthropics/claude-code/issues/7150) | Agents editing files outside assigned working directory |
| [#3275](https://github.com/anthropics/claude-code/issues/3275) | Delete files outside working directory using absolute paths |
| [#5773](https://github.com/anthropics/claude-code/issues/5773) | Unauthorized file modification outside working directory |

**Anthropic's official response**: "Claude Code doesn't implement sandboxing for Bash commands"

---

## Path Validation (Recommended)

Since `cwd` doesn't enforce boundaries, implement path validation in the `canUseTool` callback:

### Implementation

```typescript
import * as path from 'path';

// Tools that operate on file paths
const FILE_PATH_TOOLS = ['Read', 'Write', 'Edit', 'MultiEdit'];

/**
 * Check if a file path is within the allowed workspace directory.
 */
function isPathWithinWorkspace(filePath: string, workspacePath: string): boolean {
  const resolvedFile = path.resolve(workspacePath, filePath);
  const resolvedWorkspace = path.resolve(workspacePath);
  const normalizedWorkspace = resolvedWorkspace + path.sep;

  return resolvedFile.startsWith(normalizedWorkspace) ||
         resolvedFile === resolvedWorkspace;
}

/**
 * Extract file path from tool input
 */
function getFilePathFromToolInput(
  toolName: string,
  toolInput: Record<string, unknown>
): string | null {
  if (['Read', 'Write', 'Edit', 'MultiEdit'].includes(toolName)) {
    return (toolInput.file_path as string) || null;
  }
  return null;
}
```

### Using in canUseTool

```typescript
const workspacePath = '/path/to/workspace';

options.canUseTool = async (toolName, toolInput) => {
  // Validate file paths before allowing operation
  if (FILE_PATH_TOOLS.includes(toolName)) {
    const filePath = getFilePathFromToolInput(toolName, toolInput);

    if (filePath && !isPathWithinWorkspace(filePath, workspacePath)) {
      console.warn(`Blocked ${toolName} outside workspace: ${filePath}`);
      return {
        behavior: 'deny',
        message: `Security: File path "${filePath}" is outside the workspace.`
      };
    }
  }

  // Continue with normal permission flow
  return { behavior: 'allow', updatedInput: toolInput };
};
```

### What This Catches

| Scenario | Blocked? |
|----------|----------|
| `Write({ file_path: '/etc/passwd' })` | Yes |
| `Read({ file_path: '../../secrets.txt' })` | Yes |
| `Edit({ file_path: '/home/user/.bashrc' })` | Yes |
| `Write({ file_path: 'src/app.ts' })` | No (within workspace) |
| `Bash({ command: 'cat /etc/passwd' })` | No (Bash not validated) |

---

## Bash Command Limitations

**Bash commands cannot be fully validated** because:

1. Commands can be arbitrarily complex
2. Pipes, redirections, and subshells obscure intent
3. Scripts can do anything

### Partial Mitigations

Use `allowedTools` patterns to restrict Bash:

```typescript
options: {
  allowedTools: [
    'Bash(git *)',        // Only git commands
    'Bash(npm install)',  // Specific npm command
    'Bash(npm test)',
    'Bash(bun *)',
  ],
  disallowedTools: [
    'Bash(rm *)',         // Block rm
    'Bash(sudo *)',       // Block sudo
    'Bash(curl *)',       // Block network access
    'Bash(wget *)',
  ]
}
```

### High-Risk Commands to Block

```typescript
disallowedTools: [
  'Bash(rm -rf *)',
  'Bash(sudo *)',
  'Bash(chmod *)',
  'Bash(chown *)',
  'Bash(curl *)',
  'Bash(wget *)',
  'Bash(ssh *)',
  'Bash(scp *)',
  'Bash(nc *)',          // netcat
  'Bash(dd *)',
  'Bash(mkfs *)',
  'Bash(> /dev/*)',      // Device access
]
```

---

## OS-Level Sandboxing

For stronger isolation, Claude Code supports OS-level sandboxing:

### Enabling Sandbox

```bash
# In Claude Code CLI
/sandbox
```

### Sandbox Capabilities

| Platform | Technology | Filesystem | Network |
|----------|------------|------------|---------|
| Linux | bubblewrap | Isolated | Blocked |
| macOS | Seatbelt | Isolated | Blocked |
| Windows | Not supported | - | - |

### SDK Configuration

```typescript
// Sandboxing is configured at the Claude Code level, not SDK
// The SDK inherits the sandbox from the Claude Code process
```

**Note**: Sandboxing is NOT enabled by default and requires explicit activation.

---

## Chorus Implementation

Chorus implements path validation in `agent-sdk-service.ts`:

### Location

```
chorus/src/main/services/agent-sdk-service.ts
```

### Key Functions

```typescript
// Line 96-107: Path validation helper
function isPathWithinWorkspace(filePath: string, workspacePath: string): boolean

// Line 109-121: Extract file path from tool input
function getFilePathFromToolInput(toolName: string, toolInput: Record<string, unknown>): string | null

// Line 688-698: Validation in canUseTool callback
if (FILE_PATH_TOOLS.includes(toolName)) {
  const filePath = getFilePathFromToolInput(toolName, toolInput);
  if (filePath && !isPathWithinWorkspace(filePath, agentCwd)) {
    // Auto-deny with security message
  }
}
```

### Workspace Boundaries

When worktrees are enabled:
- `agentCwd` = `.chorus-worktrees/{conversationId}/`
- Files restricted to worktree directory

When worktrees are disabled:
- `agentCwd` = main repository path
- Files restricted to repository directory

---

## Security Checklist

### Minimum Security

- [ ] Implement path validation in `canUseTool`
- [ ] Use `permissionMode: 'default'` (not `bypassPermissions`)
- [ ] Block dangerous Bash commands via `disallowedTools`

### Enhanced Security

- [ ] Use explicit `allowedTools` allowlist instead of denylist
- [ ] Enable OS-level sandboxing where available
- [ ] Run agents in containers/VMs for untrusted workloads
- [ ] Log all tool calls for auditing
- [ ] Implement rate limiting on file operations

### Production Security

- [ ] Never use `bypassPermissions` outside isolated environments
- [ ] Review and audit `allowedTools` patterns regularly
- [ ] Monitor for path traversal attempts in logs
- [ ] Consider network isolation for sensitive workloads

---

## Best Practices

### 1. Defense in Depth

Don't rely on a single security mechanism:

```typescript
options: {
  // Layer 1: Permission mode
  permissionMode: 'default',

  // Layer 2: Tool restrictions
  allowedTools: ['Read', 'Write(src/*)', 'Bash(git *)'],
  disallowedTools: ['Bash(rm *)', 'Bash(sudo *)'],

  // Layer 3: Path validation in callback
  canUseTool: async (toolName, input) => {
    // Validate paths...
  }
}
```

### 2. Principle of Least Privilege

Start restrictive, expand as needed:

```typescript
// Start with read-only
allowedTools: ['Read', 'Glob', 'Grep']

// Add write access only when needed
allowedTools: ['Read', 'Glob', 'Grep', 'Write(src/*)']
```

### 3. Audit Trail

Log security-relevant events:

```typescript
canUseTool: async (toolName, input) => {
  // Log all permission requests
  console.log(`[Security] Tool: ${toolName}, Input:`, JSON.stringify(input));

  // Log denials
  if (shouldDeny) {
    console.warn(`[Security] DENIED: ${toolName} - ${reason}`);
  }

  return result;
}
```

### 4. User Education

Make security decisions visible:

```typescript
// When blocking an operation, explain why
return {
  behavior: 'deny',
  message: `Security: Cannot write to "${filePath}" - outside workspace boundary. ` +
           `Operations are restricted to: ${workspacePath}`
};
```

---

## References

- [Claude Code Security Documentation](https://code.claude.com/docs/en/security)
- [Claude Code Sandboxing](https://code.claude.com/docs/en/sandboxing)
- [GitHub Issue #7150](https://github.com/anthropics/claude-code/issues/7150) - Agents editing outside directory
- [GitHub Issue #3275](https://github.com/anthropics/claude-code/issues/3275) - Delete files using absolute paths
- [GitHub Issue #5773](https://github.com/anthropics/claude-code/issues/5773) - Unauthorized file modification
