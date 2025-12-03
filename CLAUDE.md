# Chorus

A Slack-like Electron desktop app for orchestrating Claude Code agents across GitHub repositories.

## Specification-Driven Development

All work follows specs in `specifications/`. Each sprint has a `feature.md` (requirements) and `implementation-plan.md` (how to build).

| Sprint | Status | Summary |
|--------|--------|---------|
| **0-chorus-setup** | ✅ Complete | Foundation: Electron app, two-pane layout, workspace management, file browser, git integration |
| **1-claude-code-integration** | ✅ Complete | Claude Code agent spawning, streaming output, conversation storage |
| **2-claude-code-settings** | ✅ Complete | Per-conversation and workspace-level settings for permission mode, tool allowlist, and model selection |
| **Git branch switching** | ✅ Complete | Branch selector in sidebar, 5-column commits grid in workspace overview, checkout support |
| **Markdown rendering** | ✅ Complete | Chat messages render markdown, code blocks with syntax highlighting, mermaid diagrams |
| **Tool calls UI** | ✅ Complete | Consecutive tool calls grouped into collapsible sections with input/output display |
| **Multi-conversation support** | ✅ Complete | Unread badges, per-agent status tracking (Busy/Error), parallel agent conversations |
| **5-migrate-to-cc-agent-sdk** | ✅ Complete | Migrated from CLI spawning to Claude Agent SDK for direct API integration |
| **6-from-chat-to-work** | ✅ Complete | Details Panel with files changed, todo list, tool calls breakdown, and context metrics |
| **7-tab-navigation** | ✅ Complete | VS Code-style tabs for switching between chat and files with persistence |

**Before implementing**: Read the relevant spec files for requirements and implementation guidance.

- `specifications/0-chorus-setup/feature.md` - User stories, acceptance criteria
- `specifications/0-chorus-setup/implementation-plan.md` - Phased build approach, patterns to follow
- `specifications/1-claude-code-integration/implementation-plan.md` - Claude Code integration plan
- `specifications/2-claude-code-settings/feature.md` - Permission modes, tool selection, model configuration
- `specifications/6-from-chat-to-work/feature.md` - Details Panel UI spec
- `specifications/6-from-chat-to-work/implementation-plan.md` - TodoWrite interception, file tracking, IPC events
- `specifications/7-tab-navigation/feature.md` - Tab navigation for chat/file switching

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

**Claude Agent SDK Integration**: Agents communicate via `@anthropic-ai/claude-agent-sdk` using the `query()` function directly (no CLI spawning). The SDK provides streaming messages, session management via `options.resume`, permission handling via `canUseTool` callback, and file change notifications via `PostToolUse` hooks. Messages are stored in JSONL format at `~/.chorus/sessions/{workspaceId}/{agentId}/`. See `docs/3-tools/claude-agent-sdk/` for comprehensive SDK documentation.

**Conversation Storage**: Each conversation has an index entry in `conversations.json` and messages in `{conversationId}-messages.jsonl`. Raw Claude Code messages are preserved in the `claudeMessage` field for session resumption.

**Markdown Rendering**: Chat uses `react-markdown` + `remark-gfm` for markdown, `prism-react-renderer` for code syntax highlighting, and `mermaid` (lazy-loaded) for diagrams. Components: `MarkdownContent.tsx`, `CodeBlock.tsx`, `MermaidDiagram.tsx`.

**Stable Agent IDs**: Agent IDs are deterministic hashes of the file path (SHA-256), not random UUIDs. This ensures conversations stay linked to agents when workspaces are refreshed. Note: renaming/moving an agent `.md` file creates a new ID (orphaning old conversations). Content changes are fine. See `generateStableId()` in `workspace-service.ts`.

**Git Branch Switching**: Users can switch branches via `BranchSelector` dropdown in sidebar or `BranchCommitsGrid` in workspace overview. The grid shows 5 branches with 10 commits each, with pagination arrows. Both local and remote branches are shown. Checking out a remote branch creates a local tracking branch.

**Multi-Agent Conversations**: Multiple agents can run simultaneously. State is tracked per-conversation (`streamingConversationId`) and per-agent (`agentStatuses` Map). Unread counts are tracked per-conversation and aggregated per-agent. Components: `ToolCallsGroup.tsx`, `AgentItem.tsx`, `ConversationItem.tsx`.

**Conversation Settings**: Each conversation can have custom settings for permission mode, allowed tools, and model selection. Settings are stored in the conversation's `settings` field and passed to the SDK via `options.permissionMode`, `options.allowedTools`, and `options.model`. The `ConversationToolbar` component in the chat header provides dropdowns for changing these settings. See `specifications/2-claude-code-settings/feature.md` for details.

**Workspace Default Settings**: Each workspace can have default settings stored in the central `.chorus/config.json` (under each workspace's `settings` field) that apply to new conversations. The settings hierarchy is: Global defaults → Workspace defaults → Per-conversation overrides. The `WorkspaceSettings` component in the Workspace Overview page allows users to configure defaults for permission mode, allowed tools, and model selection.

**Session Resumption**: Conversations use the SDK's `options.resume` with session ID to continue sessions. The sessionId is captured from the `system.init` message and stored in the conversation's `sessionId` field. The `sessionCreatedAt` timestamp tracks when the session was created for expiry detection (sessions expire after ~25 days). CRITICAL: The renderer must sync sessionId from backend after first message - this is done via the `agent:session-update` IPC event. See `docs/3-tools/claude-agent-sdk/3-sessions.md` for detailed documentation.

**Workspace Isolation**: Each agent runs in its workspace directory (the cloned repo path), NOT the parent Chorus directory. For example, if `mcplatform` repo is added to Chorus at `cc-slack/mcplatform`, Claude Code sessions run with `cwd: cc-slack/mcplatform`. The agent should NOT have access to `cc-slack/` parent. This is enforced in `agent-sdk-service.ts` via the `cwd: repoPath` option.

**Permission Handling**: The SDK's `canUseTool` callback intercepts tool calls that require user approval. When triggered, a `PermissionDialog` component displays the tool name and input, allowing users to approve or deny. The dialog supports custom denial reasons that are fed back to the agent. See `chorus/src/renderer/src/components/dialogs/PermissionDialog.tsx`.

**Details Panel**: The chat sidebar has a "Details" tab showing real-time conversation info: files changed (clickable to open in FileViewer), agent's todo list with status icons (pending/in_progress/completed), tool calls breakdown by tool type with success/failure counts, and context metrics (input/output tokens, cost). TodoWrite tool calls are intercepted and emitted via `agent:todo-update` IPC event. File changes from Write/Edit tools are tracked via `agent:file-changed` IPC event. State is stored in chat-store (`conversationTodos`, `conversationFiles` Maps) and reconstructed from JSONL on conversation load. See `ConversationDetails.tsx` and `specifications/6-from-chat-to-work/`.

**Tab Navigation**: VS Code-style tabs enable switching between chat and file views. Clicking a file from Details panel opens it in a new tab while keeping the chat accessible. State is managed in workspace-store (`tabs`, `activeTabId`) and persisted via `ChorusSettings.openTabs`. The `selectFile` and `selectAgent` actions automatically create/activate tabs. Duplicate tabs are prevented by checking existing tabs. Tabs show workspace name in tooltip. See `TabBar.tsx` and `specifications/7-tab-navigation/`.

**Automated Git Operations**: Both Claude and OpenAI Research agents support automated git operations controlled by workspace settings (`gitSettings.autoBranch` and `gitSettings.autoCommit`). When enabled:
- **Auto-branching**: Creates a dedicated branch from main/master when a new conversation starts. Branch naming: `agent/{agentName}/{sessionId}` for Claude, `agent/deep-research/{conversationId}` for OpenAI Research. Existing uncommitted changes are stashed and restored after branch creation.
- **Auto-committing**: Claude agents commit per-turn (when a `result` event fires) and on stop. OpenAI Research commits after saving each research output. Commit messages include the user prompt and changed files.
- Branches are tracked per-conversation in `conversationBranches` Map and stored in `conversation.branchName` for cascade delete support.
- Git operations notify renderer via `git:branch-created` and `git:commit-created` IPC events.
- Shared infrastructure in `agent-sdk-service.ts`: `ensureAgentBranch()`, `commitAgentChanges()`.

**OpenAI Deep Research Integration**: The "Deep Research" agent uses OpenAI's `@openai/agents` SDK for comprehensive web research. Key features:
- **Models**: `o4-mini-deep-research-2025-06-26` (default) or `o3-deep-research-2025-06-26`
- **API Key**: Stored in `ChorusSettings.openaiApiKey`, configured via Settings dialog
- **Output**: Research results are saved to markdown files in the configured output directory (default: `./research`), with automatic git commit
- **Streaming**: Shows real-time status ("🔍 Searching the web...", "🤔 Analyzing...") during the extensive search/reasoning phase
- **Follow-ups**: Previous research outputs are included as context for follow-up questions (max 2 recent outputs)
- **Routing**: `agent-service.ts` routes messages based on `agent.type` ('claude' vs 'openai-research')
- **No session resumption**: Unlike Claude, OpenAI Research is stateless - each query is independent
- See `chorus/src/main/services/openai-research-service.ts` and Settings dialog for OpenAI API key configuration.

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
- `chorus/src/main/services/agent-service.ts` - Agent API facade (routes to SDK or OpenAI based on agent type)
- `chorus/src/main/services/agent-sdk-service.ts` - Claude Agent SDK integration, streaming, permissions, shared git operations
- `chorus/src/main/services/openai-research-service.ts` - OpenAI Deep Research integration using @openai/agents SDK
- `chorus/src/main/services/conversation-service.ts` - Conversation CRUD, JSONL message storage
- `chorus/src/main/services/git-service.ts` - Git operations (status, branches, checkout, clone)
- `chorus/src/renderer/src/stores/workspace-store.ts` - Main UI state
- `chorus/src/renderer/src/components/Sidebar/BranchSelector.tsx` - Branch dropdown in sidebar
- `chorus/src/renderer/src/components/MainPane/BranchCommitsGrid.tsx` - 5-column branch/commits grid
- `chorus/src/renderer/src/components/Chat/MarkdownContent.tsx` - Markdown renderer for chat
- `chorus/src/main/services/workspace-service.ts` - Agent discovery with stable IDs
- `chorus/src/preload/index.ts` - API surface exposed to renderer
- `chorus/src/preload/index.d.ts` - Type definitions including Claude Code message types
- `chorus/src/renderer/src/components/Chat/ConversationToolbar.tsx` - Settings toolbar with model/permission/tools dropdowns
- `chorus/src/renderer/src/components/MainPane/WorkspaceSettings.tsx` - Workspace settings UI in overview
- `chorus/src/renderer/src/components/dialogs/PermissionDialog.tsx` - SDK permission request dialog
- `chorus/src/renderer/src/components/Chat/ConversationDetails.tsx` - Details panel with files, todos, tool calls, metrics
- `docs/3-tools/claude-agent-sdk/` - Claude Agent SDK documentation (message types, sessions, permissions, hooks, etc.)
- `specifications/5-migrate-to-cc-agent-sdk/feature.md` - SDK migration requirements and known limitations
