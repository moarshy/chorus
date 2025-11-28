# Chorus

A Slack-like Electron desktop app for orchestrating Claude Code agents across GitHub repositories.

## Specification-Driven Development

All work follows specs in `specifications/`. Each sprint has a `feature.md` (requirements) and `implementation-plan.md` (how to build).

| Sprint | Status | Summary |
|--------|--------|---------|
| **0-chorus-setup** | ✅ Complete | Foundation: Electron app, two-pane layout, workspace management, file browser, git integration |
| **1-claude-code-integration** | ✅ Complete | Claude Code agent spawning, streaming output, conversation storage |
| **Git branch switching** | ✅ Complete | Branch selector in sidebar, 5-column commits grid in workspace overview, checkout support |
| **Markdown rendering** | ✅ Complete | Chat messages render markdown, code blocks with syntax highlighting, mermaid diagrams |

**Before implementing**: Read the relevant spec files for requirements and implementation guidance.

- `specifications/0-chorus-setup/feature.md` - User stories, acceptance criteria
- `specifications/0-chorus-setup/implementation-plan.md` - Phased build approach, patterns to follow
- `specifications/1-claude-code-integration/implementation-plan.md` - Claude Code integration plan

## Architecture

```
chorus/
├── src/
│   ├── main/           # Electron main process (Node.js)
│   │   ├── index.ts    # App entry, IPC handlers, window management
│   │   ├── store/      # Persistence layer (electron-store)
│   │   └── services/   # fs, git, workspace operations
│   ├── preload/        # Context bridge (exposes window.api)
│   └── renderer/       # React UI (browser context)
│       └── src/
│           ├── components/  # Sidebar, MainPane, dialogs
│           ├── stores/      # Zustand state management
│           └── types/       # Shared TypeScript types
└── package.json
```

## Tech Stack

- **Runtime**: Electron 38, React 19, TypeScript
- **Build**: electron-vite, Bun (not npm/yarn)
- **State**: Zustand (renderer), electron-store (persistence)
- **Styling**: Tailwind CSS v4

## Key Patterns

**IPC Communication**: Main process exposes APIs via `chorus/src/preload/index.ts`. Renderer calls them via `window.api.*`. Example: `window.api.fs.readDir(path)`.

**Result Objects**: All IPC handlers return `{ success: boolean, data?: T, error?: string }`.

**Store Location**: In development, data persists to `chorus-data.json` in project root. In production, uses OS default location.

**Component Structure**: Components use inline SVG icons. No icon library.

**Claude Code Integration**: Agents are spawned via `claude` CLI with `--output-format stream-json`. Messages are parsed and stored in JSONL format at `~/.chorus/sessions/{workspaceId}/{agentId}/`. See `docs/3-tools/claude-code/message-format.md` for the full message format spec.

**Conversation Storage**: Each conversation has an index entry in `conversations.json` and messages in `{conversationId}-messages.jsonl`. Raw Claude Code messages are preserved in the `claudeMessage` field for session resumption.

**Markdown Rendering**: Chat uses `react-markdown` + `remark-gfm` for markdown, `prism-react-renderer` for code syntax highlighting, and `mermaid` (lazy-loaded) for diagrams. Components: `MarkdownContent.tsx`, `CodeBlock.tsx`, `MermaidDiagram.tsx`.

**Stable Agent IDs**: Agent IDs are deterministic hashes of the file path (SHA-256), not random UUIDs. This ensures conversations stay linked to agents when workspaces are refreshed. Note: renaming/moving an agent `.md` file creates a new ID (orphaning old conversations). Content changes are fine. See `generateStableId()` in `workspace-service.ts`.

**Git Branch Switching**: Users can switch branches via `BranchSelector` dropdown in sidebar or `BranchCommitsGrid` in workspace overview. The grid shows 5 branches with 10 commits each, with pagination arrows. Both local and remote branches are shown. Checking out a remote branch creates a local tracking branch.

## Development

```bash
cd chorus
bun install        # Install deps (not npm)
bun run dev        # Start dev server
bun run build      # Build for production
bun run typecheck  # Type check all code
```

## Important Files

- `chorus/src/main/index.ts` - IPC handler registration
- `chorus/src/main/store/index.ts` - Data persistence schema
- `chorus/src/main/services/agent-service.ts` - Claude CLI spawning, streaming JSON parsing
- `chorus/src/main/services/conversation-service.ts` - Conversation CRUD, JSONL message storage
- `chorus/src/main/services/git-service.ts` - Git operations (status, branches, checkout, clone)
- `chorus/src/renderer/src/stores/workspace-store.ts` - Main UI state
- `chorus/src/renderer/src/components/Sidebar/BranchSelector.tsx` - Branch dropdown in sidebar
- `chorus/src/renderer/src/components/MainPane/BranchCommitsGrid.tsx` - 5-column branch/commits grid
- `chorus/src/renderer/src/components/Chat/MarkdownContent.tsx` - Markdown renderer for chat
- `chorus/src/main/services/workspace-service.ts` - Agent discovery with stable IDs
- `chorus/src/preload/index.ts` - API surface exposed to renderer
- `chorus/src/preload/index.d.ts` - Type definitions including Claude Code message types
- `docs/3-tools/claude-code/message-format.md` - Claude Code stream-json format documentation
