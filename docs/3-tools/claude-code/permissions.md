# Claude Code Permissions

How Claude Code handles tool permissions, including CLI flags, interactive prompts, and SDK-only features.

## Overview

Claude Code uses a permission system to control which tools can execute and when. The system works differently depending on whether you're using the CLI interactively, spawning it programmatically, or using the SDK directly.

| Method | Permission Control |
|--------|-------------------|
| CLI (interactive) | Terminal prompts, keyboard shortcuts |
| CLI (spawned) | Flags: `--allowedTools`, `--permission-mode` |
| Agent SDK | `canUseTool` callback, hooks |

## Interactive Permission Prompts

When a tool wants to execute, users see a prompt with three options:

1. **Yes** - Approve this single action
2. **Yes, and don't ask again for [similar commands/this session]** - Approve and remember (Shift+Tab)
3. **No, and tell Claude what to do differently** - Reject and provide alternative (Esc)

Example prompt:
```
Claude wants to run: rm -rf node_modules

  1. Yes
  2. Yes, and don't ask again for this session (shift+tab)
  3. No, and tell Claude what to do differently (esc)
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Shift+Tab** or **Alt+M** | Cycle through permission modes |
| **Esc** | Stop Claude / reject current action |
| **Esc + Esc** | Open rewind menu (restore previous states) |
| **Ctrl+C** | Cancel current input or generation |
| **?** | Show available shortcuts |

## Permission Modes

Four modes control how permissions are handled:

### `default`
Standard permission behavior. Claude can read files freely but asks before modifications.

### `acceptEdits`
Auto-approves file operations without prompting:
- `Edit`, `Write` tools
- Bash filesystem commands: `mkdir`, `touch`, `rm`, `mv`, `cp`

### `plan`
Read-only mode. Claude can analyze but cannot modify files or execute commands. Currently unsupported in SDK.

### `bypassPermissions`
All tools run without prompts. **Use with extreme caution** - only in isolated environments (containers, VMs, preferably offline).

## CLI Flags

### --allowedTools
Pre-approve specific tools without prompting:
```bash
claude --allowedTools "Read" "Edit" "Bash(git *)"
```

### --disallowedTools
Block specific tools from executing:
```bash
claude --disallowedTools "Bash(rm *)" "Bash(sudo *)"
```

### --permission-mode
Start session in a specific mode:
```bash
claude --permission-mode acceptEdits
```

### --dangerously-skip-permissions
Skip all permission prompts. Only use in sandboxed environments:
```bash
claude --dangerously-skip-permissions
```

### --permission-prompt-tool
Designate an MCP tool for handling permissions in non-interactive mode:
```bash
claude -p --permission-prompt-tool mcp_auth_tool "query"
```

## Tool Permission Patterns

The `--allowedTools` and `--disallowedTools` flags support patterns:

| Pattern | Description |
|---------|-------------|
| `Edit` | Allow all Edit operations |
| `Read` | Allow all Read operations |
| `Bash(*)` | Allow any bash command (risky) |
| `Bash(git *)` | Allow any git command |
| `Bash(git commit:*)` | Git commits with any message |
| `Bash(npm install)` | Specific npm command only |
| `WriteFile(src/*)` | Write only inside src/ directory |
| `mcp__filesystem__*` | All tools from filesystem MCP server |
| `mcp__github__list_issues` | Specific MCP tool |

## Settings File Configuration

Permissions can be configured in settings files. Higher priority overrides lower:

1. **Enterprise**: `/Library/Application Support/ClaudeCode/managed-settings.json` (macOS)
2. **Local project**: `.claude/settings.local.json` (gitignored, personal)
3. **Project**: `.claude/settings.json` (shared, checked into git)
4. **User**: `~/.claude/settings.json` (applies to all projects)

Example configuration:
```json
{
  "permissions": {
    "defaultMode": "acceptEdits",
    "allowedTools": [
      "Read",
      "Write(src/**)",
      "Bash(git *)",
      "Bash(npm *)"
    ],
    "deny": [
      "Read(.env*)",
      "Write(production.config.*)",
      "Bash(rm *)",
      "Bash(sudo *)"
    ]
  }
}
```

## SDK-Only Features

These features are only available when using the Claude Agent SDK directly (not when spawning CLI):

### canUseTool Callback
Fires when a permission prompt would normally show. Allows programmatic approval/denial:

```typescript
const stream = query({
  prompt: "...",
  options: {
    canUseTool: async (toolName, toolInput) => {
      const approved = await showApprovalDialog(toolName, toolInput);

      if (approved) {
        return { behavior: "allow", updatedInput: toolInput };
      } else {
        return { behavior: "deny", message: "User rejected", interrupt: true };
      }
    }
  }
});
```

### Hooks
`PreToolUse` and `PostToolUse` hooks can allow, deny, or modify tool calls:
- Hooks always take precedence over permission modes
- Can override even `bypassPermissions` mode

## Chorus Implementation

Chorus spawns Claude via CLI with `--output-format stream-json`, so SDK features like `canUseTool` are not available.

Current approach:
- Permission mode stored in `conversation.settings.permissionMode`
- Allowed tools stored in `conversation.settings.allowedTools`
- Passed to `agent-service.ts` when spawning:
  ```bash
  claude --permission-mode acceptEdits --allowedTools "Edit" "Bash(git *)"
  ```

Files:
- `src/main/services/agent-service.ts` - Spawns Claude with flags
- `src/main/services/conversation-service.ts` - Stores conversation settings
- `src/renderer/src/components/Chat/ConversationToolbar.tsx` - UI for changing settings

## Sources

- [Claude Code Settings](https://code.claude.com/docs/en/settings)
- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference)
- [Agent SDK Permissions](https://platform.claude.com/docs/en/agent-sdk/permissions)
- [Interactive Mode](https://code.claude.com/docs/en/interactive-mode)
- [Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices)
