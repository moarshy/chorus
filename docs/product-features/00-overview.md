# Chorus Product Features

A comprehensive overview of all features in Chorus - a Slack-like desktop app for orchestrating Claude Code agents across GitHub repositories.

---

## Feature Hierarchy

```
Chorus
├── 1. Workspaces (GitHub Repositories)
│   ├── Add local repository
│   ├── Clone from GitHub URL
│   ├── Configure root workspace directory
│   └── Workspace settings (defaults)
│
├── 2. Agents
│   ├── General "Chorus" agent (auto-created)
│   ├── Custom agents (.claude/agents/*.md)
│   ├── Agent discovery & stable IDs
│   └── Agent status tracking (Idle/Busy/Error)
│
├── 3. Conversations (Agent Sessions)
│   ├── Chat interface
│   │   ├── Message streaming
│   │   ├── Markdown rendering
│   │   ├── Code syntax highlighting
│   │   ├── Mermaid diagrams
│   │   └── Tool calls grouping
│   ├── Session management
│   │   ├── Session resumption
│   │   ├── Session persistence (JSONL)
│   │   └── Context tracking
│   ├── Input features
│   │   └── @ file mentions
│   ├── Per-conversation settings
│   │   ├── Permission mode
│   │   ├── Tool allowlist
│   │   └── Model selection
│   ├── Details panel
│   │   ├── Files changed
│   │   ├── Todo list
│   │   ├── Tool calls summary
│   │   └── Context metrics
│   └── Automatic git operations (if enabled) 📋
│       ├── Auto-branch per session
│       ├── Auto-commit per turn
│       └── Commit on stop
│
├── 4. Git Operations
│   ├── Branch management
│   │   ├── Branch selector
│   │   ├── Branch checkout
│   │   ├── Branch deletion
│   │   └── Remote branch tracking
│   ├── Changes tracking
│   │   ├── Uncommitted changes panel
│   │   ├── Stage/discard changes
│   │   └── Dirty state indicators
│   ├── Commits
│   │   ├── Recent commits view
│   │   └── Branch commits grid
│   └── Auto-git (planned)
│       ├── Auto-branch per session
│       └── Auto-commit per turn
│
├── 5. File Browser
│   ├── Directory tree
│   ├── File viewer with syntax highlighting
│   ├── Create new file/folder
│   └── Context menus
│
├── 6. Slash Commands
│   ├── Command discovery (.claude/commands/)
│   ├── Autocomplete dropdown
│   ├── YAML frontmatter configuration
│   ├── Argument substitution ($ARGUMENTS, $1, $2)
│   ├── Built-in commands
│   └── Custom commands
│
└── 7. UI & Navigation
    ├── Tab system
    │   ├── Workspace tabs
    │   ├── Chat tabs
    │   ├── File tabs
    │   └── Tab persistence
    ├── Split pane view
    │   ├── Horizontal/vertical split
    │   ├── Drag-and-drop tabs
    │   └── Resizable divider
    ├── Right panel (contextual)
    │   ├── Details (for chat)
    │   └── Files browser (for files)
    └── Sidebar navigation
        ├── Workspaces panel
        ├── Conversations list
        └── File tree
```

---

## Feature Status Legend

| Status | Meaning |
|--------|---------|
| ✅ Complete | Fully implemented and working |
| 🔄 In Progress | Currently being implemented |
| 📋 Planned | Specified but not started |
| 💡 Idea | Conceptual, not yet specified |

---

## Quick Reference

| Feature Area | Document | Status |
|--------------|----------|--------|
| Workspaces | [01-workspaces.md](./01-workspaces.md) | ✅ Complete |
| Agents | [02-agents.md](./02-agents.md) | ✅ Complete |
| Conversations | [03-conversations.md](./03-conversations.md) | ✅ Complete |
| Git Operations | [04-git-operations.md](./04-git-operations.md) | ✅ Complete |
| File Browser | [05-file-browser.md](./05-file-browser.md) | ✅ Complete |
| Slash Commands | [06-slash-commands.md](./06-slash-commands.md) | ✅ Complete |
| UI & Navigation | [07-ui-navigation.md](./07-ui-navigation.md) | ✅ Complete |

---

## Implementation Timeline

| Sprint | Feature | Status |
|--------|---------|--------|
| 0 | Foundation: Layout, Workspaces, Files, Git basics | ✅ |
| 1 | Claude Code Integration: Chat, Streaming, Persistence | ✅ |
| 2 | Settings: Permission modes, Tools, Models | ✅ |
| 3 | General "Chorus" Agent per workspace | ✅ |
| 4 | @ File Mentions | ✅ |
| 5 | Migrate to Claude Agent SDK | ✅ |
| 6 | Details Panel: Files, Todos, Tools, Context | ✅ |
| 7 | Tab Navigation | ✅ |
| 8 | UI Restructure: Chat as Tabs | ✅ |
| 9 | Context Usage Indicator | ✅ |
| 10 | Slash Commands | ✅ |
| 11 | Split Pane View | ✅ |
| 12 | Automated Git Operations | 📋 |

---

## Core Value Proposition

Chorus solves the pain of managing multiple Claude Code agents across scattered windows:

**Before Chorus:**
- 10+ Cursor windows with different agents
- No unified view of agent status
- Manual switching between workspaces
- Copy-pasting output between apps
- No persistent conversation history

**With Chorus:**
- Single interface for all agents
- Real-time status visibility
- Built-in file browser
- Git integration
- Persistent, resumable sessions
- Side-by-side chat and code review
