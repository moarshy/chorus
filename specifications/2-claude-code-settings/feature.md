# Claude Code Settings

## Overview
Dynamic configuration for Claude Code agents allowing users to customize permission modes, tools, and model selection per conversation.

## Features

### 1. Permission Mode Selection
Control how Claude Code handles tool permissions:

| Mode | Description |
|------|-------------|
| **default** | Prompts for permission on first use of each tool |
| **acceptEdits** | Auto-accepts file edit permissions |
| **plan** | Read-only mode - no file modifications or command execution |
| **bypassPermissions** | Skip all permission prompts (use with caution) |

### 2. Tool Allowlist
Enable specific tools to auto-approve. Tools that require permissions:

| Tool | Description |
|------|-------------|
| `Bash` | Execute shell commands |
| `Edit` | Modify existing files |
| `Write` | Create new files |
| `WebFetch` | Fetch web content |
| `WebSearch` | Search the web |
| `NotebookEdit` | Edit Jupyter notebooks |

**Always available tools** (no permissions needed): Read, Glob, Grep, Task, TodoWrite, AskUserQuestion

### 3. Model Selection
Choose which Claude model to use:
- `claude-sonnet-4-20250514` (default) - Fast & capable
- `claude-opus-4-20250514` - Most powerful
- `claude-haiku-3-5-20241022` - Fastest & cheapest

## UI Design

### Conversation Toolbar
Located below the chat header, shows three dropdown selectors:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Model: [Sonnet 4 ▾]  Permission: [Default ▾]  Tools: [0 enabled ▾]  │
└─────────────────────────────────────────────────────────────────────┘
```

- **Model dropdown**: Radio selection of available models
- **Permission dropdown**: Radio selection of permission modes
- **Tools dropdown**: Checkbox list of tools to enable

## Settings Storage

Settings are stored per-conversation in `conversations.json`:

```json
{
  "id": "conv-uuid",
  "settings": {
    "permissionMode": "default",
    "allowedTools": ["Bash", "Edit"],
    "model": "claude-sonnet-4-20250514"
  }
}
```

## CLI Integration

Settings are passed to Claude Code via CLI flags:
- `--permission-mode <mode>` - Set permission mode
- `--allowedTools <tools>` - Comma-separated list of tools to enable
- `--model <model>` - Select model

### 4. Workspace-Level Default Settings

Each workspace can have default settings that apply to new conversations. These are stored in `.chorus/workspace-settings.json` within the workspace.

**Settings hierarchy:**
1. **Global defaults** - Hardcoded defaults in the app
2. **Workspace defaults** - Per-workspace settings in `.chorus/workspace-settings.json`
3. **Per-conversation overrides** - Modified via the conversation toolbar

**Workspace settings file** (`.chorus/workspace-settings.json`):
```json
{
  "defaultPermissionMode": "acceptEdits",
  "defaultAllowedTools": ["Bash", "Edit", "Write"],
  "defaultModel": "claude-sonnet-4-20250514"
}
```

**Workspace Settings UI:**
Located in the Workspace Overview page, allows users to configure default settings:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⚙ Default Settings                                                           │
│                                                                              │
│ Default settings for new conversations in this workspace.                   │
│                                                                              │
│ [Model: Sonnet 4 ▾]  [Permission: Default ▾]  [Tools: 0 enabled ▾]          │
└──────────────────────────────────────────────────────────────────────────────┘
```

When creating a new conversation:
1. Check for workspace settings in `.chorus/workspace-settings.json`
2. Fall back to global defaults if not present
3. Allow per-conversation overrides via the toolbar

## Implementation Files

| File | Purpose |
|------|---------|
| `src/preload/index.d.ts` | Type definitions for ConversationSettings, WorkspaceSettings |
| `src/main/services/conversation-service.ts` | Per-conversation settings storage |
| `src/main/services/workspace-settings-service.ts` | Workspace default settings service |
| `src/main/services/agent-service.ts` | Build CLI args from settings |
| `src/main/index.ts` | IPC handlers for settings |
| `src/renderer/src/stores/chat-store.ts` | Frontend state management |
| `src/renderer/src/components/Chat/ConversationToolbar.tsx` | Per-conversation settings UI |
| `src/renderer/src/components/MainPane/WorkspaceSettings.tsx` | Workspace default settings UI |

## Future Enhancements

1. **Global defaults** - Add app-level settings page for managing global defaults
2. **Tool presets** - Quick-select common tool combinations (e.g., "Read-only", "Full Access", "Code Review")
3. **Settings import/export** - Share workspace settings across machines
