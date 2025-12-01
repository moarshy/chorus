# Slash Commands

Slash commands are predefined prompts that users invoke with `/command-name`. They provide shortcuts for common tasks.

## SDK Configuration

For slash commands to work via the SDK, configure these options:

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const stream = query({
  prompt: "/my-command arg1 arg2",
  options: {
    // Required: Load command definitions
    settingSources: ['project', 'user'],

    // Required: Enable command recognition
    systemPrompt: {
      type: 'preset',
      preset: 'claude_code'
    }
  }
});
```

| Option | Purpose |
|--------|---------|
| `settingSources: ['project', 'user']` | Loads `.claude/commands/` |
| `systemPrompt: { preset: 'claude_code' }` | Enables command execution |

**Without these**, `/command` is treated as plain text.

---

## Built-in Commands

| Command | Description |
|---------|-------------|
| `/bug` | Analyze and fix a bug |
| `/explain` | Explain code or concepts |
| `/init` | Initialize new project |
| `/compact` | Summarize conversation context |
| `/review` | Code review |
| `/test` | Generate tests |
| `/docs` | Generate documentation |
| `/help` | Show available commands |
| `/clear` | Clear conversation |

---

## Creating Custom Commands

### File Location

```
workspace/
├── .claude/
│   └── commands/
│       ├── review.md       # /review
│       ├── test-plan.md    # /test-plan
│       └── deploy.md       # /deploy
└── src/
```

User-level commands: `~/.claude/commands/`

### File Format

The filename (without `.md`) becomes the command name.

**Simple Command (`review.md`):**
```markdown
Review the code changes in this conversation and provide feedback on:
- Code quality and best practices
- Potential bugs or edge cases
- Performance considerations
- Security concerns

Be specific and provide line references where applicable.
```

**Command with Arguments (`explain.md`):**
```markdown
Explain the following code in detail:

$ARGUMENTS

Focus on:
- What the code does
- How it works step by step
- Design patterns used
- Potential improvements
```

### $ARGUMENTS Placeholder

User input after the command replaces `$ARGUMENTS`:

```
/explain src/utils/parser.ts
```

Becomes:
```
Explain the following code in detail:

src/utils/parser.ts

Focus on:
...
```

---

## Discovering Commands

### Via SDK

```typescript
const stream = query({ prompt: "Hello" });
const commands = await stream.supportedCommands();

for (const cmd of commands) {
  console.log(`/${cmd.name} - ${cmd.description}`);
  if (cmd.argumentHint) {
    console.log(`  Usage: /${cmd.name} ${cmd.argumentHint}`);
  }
}
```

### SlashCommand Type

```typescript
interface SlashCommand {
  name: string;         // Command name (without /)
  description: string;  // What it does
  argumentHint: string; // Argument placeholder (e.g., "<file>")
}
```

---

## Chorus Implementation

### Loading Commands

```typescript
// chorus/src/main/services/workspace-service.ts

async function getSlashCommands(workspacePath: string): Promise<SlashCommand[]> {
  const commands: SlashCommand[] = [];

  // Project commands
  const projectDir = path.join(workspacePath, '.claude', 'commands');
  if (await fs.exists(projectDir)) {
    const files = await fs.readdir(projectDir);
    for (const file of files) {
      if (file.endsWith('.md')) {
        const name = path.basename(file, '.md');
        const content = await fs.readFile(path.join(projectDir, file), 'utf-8');
        commands.push({
          name,
          description: extractDescription(content),
          argumentHint: content.includes('$ARGUMENTS') ? '<args>' : ''
        });
      }
    }
  }

  // User commands
  const userDir = path.join(os.homedir(), '.claude', 'commands');
  if (await fs.exists(userDir)) {
    const files = await fs.readdir(userDir);
    for (const file of files) {
      if (file.endsWith('.md')) {
        const name = path.basename(file, '.md');
        // Skip if project has same command
        if (!commands.find(c => c.name === name)) {
          const content = await fs.readFile(path.join(userDir, file), 'utf-8');
          commands.push({
            name,
            description: extractDescription(content),
            argumentHint: content.includes('$ARGUMENTS') ? '<args>' : ''
          });
        }
      }
    }
  }

  return commands;
}

function extractDescription(content: string): string {
  // First line or first sentence
  const firstLine = content.trim().split('\n')[0];
  return firstLine.slice(0, 100);
}
```

### Workspace Store

```typescript
// chorus/src/renderer/src/stores/workspace-store.ts

interface WorkspaceStore {
  slashCommands: Map<string, SlashCommand[]>;

  loadCommands: async (workspaceId: string) => {
    const workspace = get().workspaces.find(w => w.id === workspaceId);
    if (!workspace) return;

    const result = await window.api.workspace.getSlashCommands(workspace.path);
    if (result.success && result.data) {
      set((state) => {
        state.slashCommands.set(workspaceId, result.data);
      });
    }
  }
}
```

### Command Autocomplete

```typescript
// chorus/src/renderer/src/components/Chat/SlashCommandDropdown.tsx

function SlashCommandDropdown({ input, onSelect, workspaceId }) {
  const commands = useSlashCommands(workspaceId);
  const [filtered, setFiltered] = useState<SlashCommand[]>([]);

  useEffect(() => {
    if (input.startsWith('/')) {
      const query = input.slice(1).toLowerCase();
      setFiltered(
        commands.filter(cmd =>
          cmd.name.toLowerCase().startsWith(query)
        )
      );
    } else {
      setFiltered([]);
    }
  }, [input, commands]);

  if (filtered.length === 0) return null;

  return (
    <div className="slash-command-dropdown">
      {filtered.map(cmd => (
        <button
          key={cmd.name}
          onClick={() => onSelect(cmd)}
          className="command-option"
        >
          <span className="command-name">/{cmd.name}</span>
          <span className="command-desc">{cmd.description}</span>
        </button>
      ))}
    </div>
  );
}
```

### Executing Commands

```typescript
// chorus/src/renderer/src/components/Chat/MessageInput.tsx

function MessageInput({ workspaceId, agentId }) {
  const [message, setMessage] = useState('');

  const executeSlashCommand = async (command: SlashCommand) => {
    // Build full command message
    const commandWithSlash = `/${command.name}`;
    let commandMessage = commandWithSlash;

    // Extract arguments if present
    if (message.startsWith(commandWithSlash)) {
      const args = message.slice(commandWithSlash.length).trim();
      if (args) {
        commandMessage = `${commandWithSlash} ${args}`;
      }
    }

    // Send to SDK - it handles expansion
    setMessage('');
    await sendMessage(commandMessage, workspaceId, agentId);
  };

  // ... input handling
}
```

---

## Best Practices

### 1. Descriptive Names

```
/review-security    ✓ Clear purpose
/rs                 ✗ Cryptic
```

### 2. Focused Commands

Each command should do one thing well:

```markdown
<!-- Good: Focused -->
Review this code for security vulnerabilities...

<!-- Bad: Too broad -->
Review code, fix bugs, add tests, and deploy...
```

### 3. Document in Command

Add context at the top:

```markdown
<!-- Security Review Command -->
<!-- Analyzes code for common security vulnerabilities -->

Review the following code for security issues:
$ARGUMENTS

Check for:
- SQL injection
- XSS vulnerabilities
...
```

### 4. Use Arguments

Make commands flexible:

```markdown
Generate unit tests for:
$ARGUMENTS

Use the existing test patterns in this project.
```

Usage: `/test src/utils/parser.ts`

### 5. Workspace vs User

| Location | Use For |
|----------|---------|
| `.claude/commands/` | Project-specific commands |
| `~/.claude/commands/` | Personal commands across projects |

---

## Troubleshooting

### Commands Not Recognized

**Symptom:** `/command` sent as plain text.

**Fix:**
```typescript
options: {
  settingSources: ['project', 'user'],
  systemPrompt: { type: 'preset', preset: 'claude_code' }
}
```

### Commands Not in Autocomplete

**Symptom:** Custom commands don't appear.

**Causes:**
1. File not in `.claude/commands/`
2. Wrong extension (must be `.md`)
3. Workspace not refreshed

### Resumed Session Ignores Commands

System prompt is only set for new sessions. Resumed sessions use original config.

---

## References

- [SDK Slash Commands](https://platform.claude.com/docs/en/agent-sdk/slash-commands)
- [Claude Code Custom Commands](https://code.claude.com/docs/en/custom-commands)
