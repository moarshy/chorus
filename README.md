# Chorus

A Slack-like desktop app for orchestrating Claude Code agents across GitHub repositories.

## Features

- **Workspace Management**: Add local repos or clone from GitHub
- **Agent Discovery**: Automatically discovers agents defined in `.claude/agents/*.md`
- **Chat Interface**: Slack-style conversations with Claude Code agents
- **Multi-Agent Support**: Switch between different specialized agents per workspace
- **Session Persistence**: Conversations are saved and can be resumed

## Tech Stack

- Electron 38
- React 19
- TypeScript
- Tailwind CSS v4
- Zustand (state management)

## Prerequisites

- [Bun](https://bun.sh) (package manager)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated

## Development

```bash
cd chorus

# Install dependencies
bun install

# Start dev server
bun run dev

# Type check
bun run typecheck

# Build for production
bun run build
```

## Project Structure

```
chorus/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts    # App entry, IPC handlers
│   │   ├── store/      # Persistence (electron-store)
│   │   └── services/   # fs, git, agent, conversation
│   ├── preload/        # Context bridge (window.api)
│   └── renderer/       # React UI
│       └── src/
│           ├── components/  # Sidebar, Chat, MainPane
│           ├── stores/      # Zustand stores
│           └── types/       # TypeScript types
├── specifications/     # Feature specs and implementation plans
└── docs/               # Documentation
```

## Defining Agents

Create markdown files in `.claude/agents/` within any workspace:

```markdown
---
name: Code Reviewer
description: Reviews code for best practices
---

You are a code reviewer. Focus on:
- Code quality and readability
- Security vulnerabilities
- Performance optimizations
```
