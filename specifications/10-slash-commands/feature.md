# Sprint 10: Slash Commands Support

## Overview

Enable users to discover and execute slash commands defined in workspace repositories. Slash commands are Markdown files stored in `.claude/commands/` that serve as reusable prompt templates, allowing teams to standardize common workflows like code reviews, testing, and documentation.

## User Stories

### US-1: Discover Slash Commands in Workspace
**As a** user loading a workspace
**I want** Chorus to automatically find slash commands in the repository
**So that** I can use team-defined commands without manual setup

**Acceptance Criteria:**
- On workspace load, scan `.claude/commands/` directory recursively
- Parse each `.md` file to extract command metadata (frontmatter)
- Store discovered commands per-workspace
- Show command count in workspace overview
- Handle missing `.claude/commands/` directory gracefully (no error)

### US-2: View Available Commands
**As a** user in a chat conversation
**I want** to see available slash commands
**So that** I can discover what commands are available

**Acceptance Criteria:**
- Typing `/` in chat input shows command autocomplete dropdown
- Commands display name, description (from frontmatter), and argument hint
- Commands are filtered as user types (fuzzy match)
- Keyboard navigation (↑/↓) and Enter to select
- Escape or clicking outside dismisses dropdown
- Show "(workspace)" label to indicate source

### US-3: Execute Slash Command
**As a** user chatting with an agent
**I want** to invoke a slash command like `/review-pr 123`
**So that** the predefined prompt is sent with my arguments

**Acceptance Criteria:**
- Command syntax: `/command-name [arguments]`
- Arguments substituted into `$ARGUMENTS` placeholder
- Positional args available as `$1`, `$2`, etc.
- Rendered prompt sent as user message to agent
- Original command shown in chat (e.g., "Executed /review-pr 123")
- Invalid command shows error toast

### US-4: View Command Details
**As a** user exploring commands
**I want** to see the full command definition
**So that** I can understand what it does before using it

**Acceptance Criteria:**
- Clicking command name in autocomplete shows preview
- Preview displays full Markdown content
- Shows frontmatter fields (description, allowed-tools, model)
- Shows argument placeholders highlighted
- Close button or click outside dismisses preview

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Command scope | Workspace only | Personal commands (~/.claude/commands/) not supported initially; keeps scope clear |
| Discovery timing | On workspace load | Ensures commands available immediately; refresh on branch change |
| Autocomplete trigger | Single `/` at start | Matches Claude Code behavior |
| Argument parsing | Simple split on spaces | Covers common cases; quoted strings not initially supported |
| Command execution | Substitute and send as user message | Agent receives full prompt naturally |

## UI Layout

### Autocomplete Dropdown
```
┌─────────────────────────────────────────────┐
│ /                                           │  ← Chat input
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ /review-pr [pr-number]                  │ │  ← Selected (highlighted)
│ │ Review a pull request for code quality  │ │
│ ├─────────────────────────────────────────┤ │
│ │ /test [file-pattern]                    │ │
│ │ Run tests matching pattern              │ │
│ ├─────────────────────────────────────────┤ │
│ │ /docs [component]                       │ │
│ │ Generate documentation for component    │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Workspace Overview (Commands Section)
```
┌─────────────────────────────────────────────┐
│ ⚡ Slash Commands (3)                       │
├─────────────────────────────────────────────┤
│ /review-pr    Review a pull request...      │
│ /test         Run tests matching pattern    │
│ /docs         Generate documentation...     │
└─────────────────────────────────────────────┘
```

## Technical Requirements

### Slash Command File Format

Commands are Markdown files with optional YAML frontmatter:

```markdown
---
description: Brief description shown in autocomplete
allowed-tools: Bash(git:*), Edit, Write
argument-hint: [pr-number] [priority]
model: claude-sonnet-4-5-20250929
---

# Review Pull Request

Review PR #$1 with the following criteria:

$ARGUMENTS

Focus on:
- Code quality
- Security issues
- Performance implications
```

### Frontmatter Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | Short description for autocomplete (required for good UX) |
| `allowed-tools` | string | Tool restrictions (informational only in Chorus) |
| `argument-hint` | string | Shows expected arguments in autocomplete |
| `model` | string | Suggested model (informational only) |

### Data Model

```typescript
interface SlashCommand {
  name: string              // Derived from filename (without .md)
  path: string              // Relative path within .claude/commands/
  filePath: string          // Absolute path to .md file
  description?: string      // From frontmatter
  argumentHint?: string     // From frontmatter
  allowedTools?: string     // From frontmatter
  model?: string            // From frontmatter
  content: string           // Full Markdown content (without frontmatter)
}

interface WorkspaceCommands {
  workspaceId: string
  commands: SlashCommand[]
  lastScanned: string       // ISO timestamp
}
```

### IPC API

| Handler | Direction | Signature |
|---------|-----------|-----------|
| `workspace:get-commands` | Renderer → Main | `(workspaceId: string) => SlashCommand[]` |
| `workspace:refresh-commands` | Renderer → Main | `(workspaceId: string) => SlashCommand[]` |
| `workspace:execute-command` | Renderer → Main | `(workspaceId: string, commandName: string, args: string) => string` |

### State Management

New fields in workspace-store:
```typescript
workspaceCommands: Map<string, SlashCommand[]>  // Per-workspace commands
```

Actions:
- `loadCommands(workspaceId)`: Fetches commands from main process
- `refreshCommands(workspaceId)`: Re-scans .claude/commands/
- `getCommands(workspaceId)`: Returns cached commands

### Argument Substitution

When executing a command:
1. Split arguments by whitespace: `"123 high"` → `["123", "high"]`
2. Replace `$ARGUMENTS` with full argument string
3. Replace `$1`, `$2`, etc. with positional args
4. Unreplaced positional vars become empty string

Example:
- Command: `/review-pr 123 high`
- Template: `Review PR #$1 with priority $2. $ARGUMENTS`
- Result: `Review PR #123 with priority high. 123 high`

## Edge Cases

| Case | Behavior |
|------|----------|
| No `.claude/commands/` directory | Empty commands list, no error |
| Empty `.md` file | Skip, log warning |
| Missing description | Use filename as description |
| Nested subdirectories | Include with path prefix (e.g., `/frontend/component`) |
| Duplicate command names | Last wins (alphabetical by path) |
| Invalid frontmatter | Parse what's possible, log warning |
| Command not found on execute | Show error toast |
| Branch switch | Auto-refresh commands |

## Out of Scope

- Personal commands (`~/.claude/commands/`)
- Bash command execution (`!` prefix in templates)
- File includes (`@` prefix in templates)
- Quoted argument parsing (`"arg with spaces"`)
- Command editing within Chorus
- Creating new commands from UI
- Tool restrictions enforcement (informational only)
- Model override enforcement (informational only)
