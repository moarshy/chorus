# Claude Code - Documentation Summary

## Overview

Claude Code is Anthropic's terminal-based agentic coding tool that transforms natural language into functional code. It integrates into developer workflows via CLI, emphasizing Unix philosophy principles of composability and scriptability.

**Official Docs:** https://code.claude.com/docs/en/overview

---

## Core Documentation Pages

### 1. Overview
**URL:** https://code.claude.com/docs/en/overview

**What it covers:**
- Installation methods (Shell, Homebrew, PowerShell, NPM)
- Core capabilities: feature development, debugging, codebase navigation, task automation
- Enterprise deployment (AWS/GCP)
- MCP extensibility for external tools

**Key for CC-Slack:** Terminal-based operation enables easy programmatic control and automation.

---

### 2. Common Workflows
**URL:** https://code.claude.com/docs/en/common-workflows

**What it covers:**
- Codebase analysis, bug fixing, refactoring, testing, documentation, PR generation
- **Plan Mode**: Read-only analysis before making edits (`--permission-mode plan`)
- File referencing with `@` syntax
- Extended thinking mode (Tab key)
- Conversation continuation (`--continue`, `--resume`)
- Unix integration with structured output (text, JSON, stream-JSON)
- Custom slash commands in `.claude/commands/`
- Git worktrees for parallel sessions

**Key for CC-Slack:**
- Subagents automatically handle specific tasks
- Resume functionality allows agents to continue each other's work
- Custom slash commands provide standardized multi-agent interactions

---

### 3. Sub-agents
**URL:** https://code.claude.com/docs/en/sub-agents

**What it covers:**
- Specialized AI assistants with independent context windows
- Automatic or explicit delegation
- Configuration via markdown in `.claude/agents/` (project) or `~/.claude/agents/` (user)
- Configuration fields: `name`, `description`, `tools`, `model`, `permissionMode`
- Built-in subagents: General-purpose, Plan, Explore
- Tool restrictions per subagent
- Chaining support for multi-step workflows

**Key for CC-Slack:**
- **Primary mechanism for task decomposition**
- Custom system prompts enable domain-specific expertise
- Context preservation enables long-running interactions

---

### 4. Hooks Guide
**URL:** https://code.claude.com/docs/en/hooks-guide

**What it covers:**
- User-defined shell commands at lifecycle points
- **10 Hook Events:**
  - `PreToolUse` - Before tool calls (can block)
  - `PostToolUse` - After tool completion
  - `UserPromptSubmit` - Before processing input
  - `Stop` - When Claude finishes
  - `SubagentStop` - When subagent completes
  - `PreCompact` - Before compaction
  - `SessionStart` / `SessionEnd` - Session lifecycle
  - `Notification` - When sending notifications
  - `PermissionRequest` - During permission dialogs
- Configuration via `/hooks` command
- Storage in `~/.claude/settings.json`

**Key for CC-Slack:**
- **Critical for integration** - external systems can intercept agent actions
- `SubagentStop` hooks provide coordination points
- Git Butler uses `PreToolUse`/`PostToolUse` for auto-commits

---

### 5. Headless Mode
**URL:** https://code.claude.com/docs/en/headless

**What it covers:**
- Programmatic execution via CLI (`claude -p 'task'`)
- Output formats: `text`, `json`, `stream-json`
- Session management: `--resume`, `--continue`
- Tool restrictions: `--allowedTools`, `--disallowedTools`
- MCP configuration: `--mcp-config`
- Custom instructions: `--append-system-prompt`
- Multi-turn conversations with session IDs
- JSON output includes cost metrics, duration, turn count

**Key for CC-Slack:**
- **Primary interface for programmatic control**
- Structured output (JSON) enables parsing by orchestrators
- Session persistence enables long-running interactions
- This is how CC-Slack will spawn and control agents

---

### 6. MCP Integration
**URL:** https://code.claude.com/docs/en/mcp

**What it covers:**
- Model Context Protocol for connecting external services
- Three transport options: HTTP (recommended), SSE (deprecated), Stdio (local)
- Configuration: `claude mcp add --transport [type] [name] [endpoint]`
- Three scope levels: Local, Project (`.mcp.json`), User
- OAuth 2.0 support for authentication
- Resources become `@mentions`, prompts become `/commands`
- Enterprise allowlist/denylist configuration

**Key for CC-Slack:**
- **Critical for extensibility** - standardized agent-to-tool protocol
- HTTP transport enables remote agent-to-agent communication
- Project-level `.mcp.json` allows orchestration systems to configure agent capabilities
- This is how agents could communicate in Richard's decentralized vision

---

### 7. Plugins
**URL:** https://code.claude.com/docs/en/plugins

**What it covers:**
- Extend Claude Code with custom components
- Plugin manifest: `.claude-plugin/plugin.json`
- Component types: commands, agents, skills, hooks, MCP servers
- Installation: `/plugin` command or `/plugin install name@marketplace`
- Team configuration via `.claude/settings.json`

**Key for CC-Slack:** Plugins can bundle agents + skills + hooks into distributable units.

---

### 8. Skills
**URL:** https://code.claude.com/docs/en/skills

**What it covers:**
- Modular capabilities Claude autonomously invokes (unlike slash commands)
- Storage: `~/.claude/skills/` (personal) or `.claude/skills/` (project)
- Structure: `SKILL.md` with YAML frontmatter
- Tool restrictions via `allowed-tools` field
- Can be composed and distributed via plugins

**Key for CC-Slack:** Skills demonstrate autonomous capability selection - similar to agent decision-making.

---

### 9. Output Styles
**URL:** https://code.claude.com/docs/en/output-styles

**What it covers:**
- Modify Claude's behavior/communication patterns
- Built-in: Default, Explanatory, Learning
- Custom styles as markdown files in `.claude/output-styles`
- Configuration via `/output-style` command

**Key for CC-Slack:** Different styles for different agent roles (researcher, coder, reviewer).

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude Code CLI                          │
├─────────────────────────────────────────────────────────────┤
│  Headless Mode (-p)  │  Interactive Mode  │  Plan Mode      │
├─────────────────────────────────────────────────────────────┤
│                      Hooks System                            │
│  PreToolUse → PostToolUse → SubagentStop → SessionEnd       │
├─────────────────────────────────────────────────────────────┤
│  Subagents        │  Skills          │  Slash Commands      │
│  .claude/agents/  │  .claude/skills/ │  .claude/commands/   │
├─────────────────────────────────────────────────────────────┤
│                      MCP Protocol                            │
│  Stdio (local)  │  HTTP (remote)  │  Resources & Prompts   │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Patterns for CC-Slack

### 1. Spawning Agents
```bash
# Headless mode with JSON output
claude -p "Your task here" --output-format json --allowedTools Read,Write,Bash

# With custom system prompt
claude -p "Task" --append-system-prompt "You are a product agent..."

# Resume a session
claude -p "Continue" --resume session-id-here
```

### 2. Git Butler Integration (Hooks)
```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "*", "command": "but claude pre-tool" }],
    "PostToolUse": [{ "matcher": "*", "command": "but claude post-tool" }],
    "Stop": [{ "command": "but claude stop" }]
  }
}
```

### 3. Inter-Agent Communication via MCP
- Deploy agents as MCP servers
- Use HTTP transport for remote communication
- Resources for shared state
- Prompts for standardized commands

---

## Sources

- https://code.claude.com/docs/en/overview
- https://code.claude.com/docs/en/common-workflows
- https://code.claude.com/docs/en/sub-agents
- https://code.claude.com/docs/en/hooks-guide
- https://code.claude.com/docs/en/headless
- https://code.claude.com/docs/en/mcp
- https://code.claude.com/docs/en/plugins
- https://code.claude.com/docs/en/skills
- https://code.claude.com/docs/en/output-styles
