# Slash Commands

Slash commands are predefined prompts that users invoke with `/command-name`. They provide shortcuts for common tasks and custom workflows.

---

## Overview

| Aspect | Description |
|--------|-------------|
| What | Predefined prompts triggered by `/name` |
| Why | Shortcuts for repetitive tasks, standardized workflows |
| Where | Chat input → Type `/` to trigger autocomplete |

---

## Features

### 1. Command Discovery ✅

Commands are automatically discovered from the workspace.

**Discovery Locations:**
```
workspace/
└── .claude/
    └── commands/
        ├── review.md      → /review
        ├── test-plan.md   → /test-plan
        └── docs.md        → /docs
```

**Naming:**
- Filename (without `.md`) becomes command name
- Hyphens allowed: `code-review.md` → `/code-review`
- Lowercase recommended

---

### 2. Command Autocomplete ✅

Interactive dropdown when typing `/`.

**Trigger:**
- Type `/` at start of message
- Dropdown appears with matching commands

**Navigation:**
| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate list |
| `Enter` | Execute command |
| `Tab` | Complete command name |
| `Escape` | Close dropdown |

**Filtering:**
- Fuzzy search on command name
- Also searches description

---

### 3. Command File Format ✅

Each `.md` file defines a command with optional YAML frontmatter.

#### Simple Command (no frontmatter)

```markdown
Review the code changes and provide feedback on:
- Code quality and best practices
- Potential bugs or edge cases
- Performance considerations
- Security concerns
```

#### Command with Metadata

```markdown
---
description: Review code for quality issues
allowed-tools:
  - Read
  - Grep
  - Glob
argument-hint: <file-path>
model: claude-opus-4-5-20250514
---

Review the following file thoroughly:

File: $ARGUMENTS

Focus on:
1. Type safety
2. Error handling
3. Edge cases
```

#### Frontmatter Options

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | Shown in autocomplete dropdown |
| `allowed-tools` | string[] | Restrict tools for this command |
| `argument-hint` | string | Placeholder shown in input |
| `model` | string | Override model for this command |

---

### 4. Argument Substitution ✅

Pass arguments to commands via placeholders.

#### `$ARGUMENTS` - All Arguments

```markdown
Explain this code in detail:

$ARGUMENTS
```

**Usage:** `/explain src/utils/parser.ts`

**Result:**
```
Explain this code in detail:

src/utils/parser.ts
```

#### Positional Arguments

```markdown
Compare $1 with $2 and highlight differences.
```

**Usage:** `/compare file1.ts file2.ts`

**Result:**
```
Compare file1.ts with file2.ts and highlight differences.
```

#### Argument Patterns

| Placeholder | Meaning |
|-------------|---------|
| `$ARGUMENTS` | All arguments as single string |
| `$1` | First argument |
| `$2` | Second argument |
| `$N` | Nth argument |

---

### 5. Built-in Commands

Commands that come with Claude Code (when using `claude_code` preset):

| Command | Description |
|---------|-------------|
| `/bug` | Analyze and fix a bug |
| `/explain` | Explain code or concepts |
| `/init` | Initialize a new project |
| `/compact` | Summarize conversation context |
| `/review` | Code review |
| `/test` | Generate tests |
| `/docs` | Generate documentation |
| `/help` | Show available commands |

---

### 6. Custom Commands ✅

Create workspace-specific commands.

#### Example: PR Review Command

**File:** `.claude/commands/pr-review.md`
```markdown
---
description: Review PR changes comprehensively
allowed-tools:
  - Read
  - Grep
  - Bash
argument-hint: <branch-name>
---

Review the changes in branch `$ARGUMENTS` compared to main:

1. Run `git diff main..$ARGUMENTS` to see changes
2. Analyze each changed file for:
   - Breaking changes
   - Missing tests
   - Documentation needs
3. Provide a summary with approval recommendation
```

**Usage:** `/pr-review feature/new-auth`

#### Example: Component Generator

**File:** `.claude/commands/component.md`
```markdown
---
description: Generate a React component
argument-hint: <ComponentName>
---

Create a new React component called `$1`:

1. Create `src/components/$1/$1.tsx`
2. Create `src/components/$1/$1.test.tsx`
3. Create `src/components/$1/index.ts` (barrel export)
4. Follow existing component patterns in the codebase
```

**Usage:** `/component UserProfile`

---

## SDK Configuration

For slash commands to work, the SDK needs specific configuration:

```typescript
const options = {
  // Load commands from .claude/commands/
  settingSources: ['project', 'user'],

  // Enable command recognition
  systemPrompt: {
    type: 'preset',
    preset: 'claude_code'
  }
}
```

**Both options required:**
- `settingSources` - Loads command files from disk
- `systemPrompt` preset - Enables `/command` parsing

---

## Data Model

```typescript
interface SlashCommand {
  name: string           // Command name (from filename)
  description?: string   // From frontmatter
  content: string        // Prompt template
  filePath: string       // Full path to .md file
  allowedTools?: string[]
  argumentHint?: string
  model?: string
}
```

---

## UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `SlashCommandDropdown` | Chat | Autocomplete dropdown |
| `MessageInput` | Chat | Detects `/` trigger |

---

## User Flows

### Execute Built-in Command
1. Type `/` in chat input
2. Select command from dropdown (e.g., `/review`)
3. Press Enter
4. Command sent to agent

### Execute with Arguments
1. Type `/explain `
2. Add arguments: `/explain src/auth/login.ts`
3. Press Enter
4. Agent receives expanded prompt

### Create Custom Command
1. Create `.claude/commands/` folder in workspace
2. Create `my-command.md` file
3. Write prompt template with optional frontmatter
4. Reload workspace (or restart app)
5. Command appears in autocomplete

---

## Troubleshooting

### Commands Not Appearing

**Cause:** Command file not in correct location

**Fix:**
- Ensure file is at `.claude/commands/your-command.md`
- File must have `.md` extension
- Reload workspace

### Commands Not Executing

**Cause:** SDK missing configuration

**Fix:** Ensure SDK options include:
```typescript
settingSources: ['project', 'user'],
systemPrompt: { type: 'preset', preset: 'claude_code' }
```

### Arguments Not Substituted

**Cause:** Missing placeholder in template

**Fix:** Use `$ARGUMENTS` or `$1`, `$2`, etc. in command file

---

## Related Files

**Services:**
- `src/main/services/command-service.ts` - Command discovery

**Components:**
- `src/renderer/src/components/Chat/SlashCommandDropdown.tsx`
- `src/renderer/src/components/Chat/MessageInput.tsx`

**Hooks:**
- `src/renderer/src/hooks/useSlashCommandTrigger.ts`

**Store:**
- `src/renderer/src/stores/workspace-store.ts` - `slashCommands` Map
