# Feature: Automated Git Operations for Agent Sessions

## Overview

Implement GitButler-style automatic commit management for agent sessions without requiring external tools. Each agent session gets its own branch with automatic commits after each conversation turn, providing clean version control of agent work.

**Related Issues:**
- GitHub Issue #10: Split-Pane View (dependency - already implemented)
- GitHub Issue #11: Rich Markdown Diff Viewer (builds on this feature)

## Problem Statement

When Claude agents make file changes in Chorus:
1. All changes land on the current branch (may be `main`)
2. Multiple agents' work gets mixed together
3. No automatic commit points - users must manually commit
4. Hard to review/revert specific agent sessions
5. No visibility into what the agent changed per conversation turn

GitButler solves this with:
- One branch per Claude Code session
- One commit per chat round
- Visual branch management
- No manual git commands needed

## Solution: Native Implementation

Build GitButler-like functionality directly into Chorus using existing `git-service.ts`:

### Core Features

1. **Branch-per-Session**: Auto-create `agent/{agentId}/{shortSessionId}` branches
2. **Commit-per-Turn**: Auto-commit after each conversation turn (like GitButler's `post-tool` hook)
3. **Commit-on-Stop**: Final commit when agent stops to catch any uncommitted changes (like GitButler's `stop` hook)
4. **Visual Git Panel**: Show agent branches and commits in WorkspaceOverview
5. **Diff Viewer**: Preview changes before/after agent operations

### Integration Points

- SDK PostToolUse hooks for file change tracking
- Agent stop event (user stops or task completes) for auto-commit
- WorkspaceOverview for branch visualization
- Split pane for side-by-side diff viewing

## User Stories

### US-1: Automatic Branch Creation
**As a** user starting a conversation with an agent
**I want** the agent's work to go to a dedicated branch
**So that** I can isolate and review changes separately

**Acceptance Criteria:**
- [ ] When conversation starts, create/switch to `agent/{agentName}/{sessionShortId}` branch
- [ ] Branch created from current HEAD
- [ ] User notified of branch creation in chat
- [ ] Option to disable auto-branching per workspace

### US-2: Automatic Commit per Turn
**As a** user chatting with an agent
**I want** each conversation turn to be committed automatically
**So that** I have incremental checkpoints and can see what each prompt accomplished

**Acceptance Criteria:**
- [ ] After agent completes a turn (result event), commit staged changes
- [ ] Commit message includes: user prompt summary + files changed
- [ ] Format: `[Agent] {prompt summary}\n\nFiles: {list}`
- [ ] Only commit if there are actual file changes
- [ ] Show commit notification in chat

### US-2b: Automatic Commit on Agent Stop
**As a** user working with an agent
**I want** any uncommitted changes committed when the agent stops
**So that** no work is lost even if interrupted mid-turn

**Acceptance Criteria:**
- [ ] When agent stops (Stop hook fires), commit any remaining changes
- [ ] Works for natural completion, user interrupt, or error
- [ ] Commit message indicates it was a stop: `[Agent - Stopped] {summary}`
- [ ] Only commit if there are uncommitted file changes
- [ ] Cleanup tracking state after commit

### US-3: Agent Branches in Workspace Overview
**As a** user viewing a workspace
**I want** to see all agent-created branches with their commits
**So that** I can review and manage agent work

**Acceptance Criteria:**
- [ ] New "Agent Sessions" section in WorkspaceOverview
- [ ] Shows branches matching `agent/*` pattern
- [ ] Each branch shows: agent name, session date, commit count
- [ ] Click to expand and see commits
- [ ] Quick actions: checkout, merge to main, delete

### US-4: Visual Diff for Agent Changes
**As a** user reviewing agent work
**I want** to see a visual diff of changes made
**So that** I can understand and verify the modifications

**Acceptance Criteria:**
- [ ] Clicking a commit opens diff viewer in split pane
- [ ] Shows side-by-side or unified diff
- [ ] Syntax highlighting for code
- [ ] Rich rendering for markdown (optional)
- [ ] Accept/reject buttons for file-level changes

### US-5: Merge Agent Work to Main
**As a** user satisfied with agent changes
**I want** to merge the agent branch back to main
**So that** the changes become part of the main codebase

**Acceptance Criteria:**
- [ ] "Merge to main" button in agent branch view
- [ ] Shows merge preview (files to be added/modified)
- [ ] Handles merge conflicts gracefully
- [ ] Option to squash commits
- [ ] Cleans up agent branch after merge (optional)

### US-6: Workspace Tab Navigation from Split View
**As a** user in split view working with files
**I want** to click on workspace/repo to see the overview
**So that** I can access git operations without losing context

**Acceptance Criteria:**
- [ ] Clicking workspace in sidebar exits split view
- [ ] Opens workspace overview as a tab
- [ ] "Return to split view" button or keyboard shortcut
- [ ] Remembers split pane state for restoration

### US-7: Disable/Enable Auto-Git per Workspace
**As a** user who may not want auto-commits for some projects
**I want** to configure git automation per workspace
**So that** I have control over the behavior

**Acceptance Criteria:**
- [ ] Toggle in WorkspaceSettings: "Auto-commit agent changes"
- [ ] Toggle: "Auto-branch per session"
- [ ] Settings persist per workspace
- [ ] Default: enabled

### US-8: GitButler Hook Forwarding (Optional)
**As a** user who already uses GitButler
**I want** Chorus to forward hooks to GitButler CLI
**So that** I can use GitButler's full UI alongside Chorus

**Acceptance Criteria:**
- [ ] Detect if `but` CLI is available
- [ ] Option in settings: "Use GitButler for commits"
- [ ] Forward `pre-tool`, `post-tool`, `stop` hooks
- [ ] Falls back to native if GitButler unavailable

## UI Design

### Workspace Overview - Agent Sessions Section

```
┌─────────────────────────────────────────────────────────────────┐
│ AGENT SESSIONS                                          [View All]│
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🌿 agent/chorus/a1b2c3d                              Active │ │
│ │    Chorus • Started 2 hours ago • 5 commits                 │ │
│ │    Latest: "Add user authentication endpoint"               │ │
│ │    [Checkout] [Merge to main] [View Diff]                   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🌿 agent/feature-agent/x9y8z7                               │ │
│ │    Feature Agent • 1 day ago • 3 commits                    │ │
│ │    Latest: "Refactor database queries"                      │ │
│ │    [Checkout] [Merge to main] [Delete]                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Expanded Branch View with Commits

```
┌─────────────────────────────────────────────────────────────────┐
│ 🌿 agent/chorus/a1b2c3d                                         │
│    Chorus • Started 2 hours ago                                 │
├─────────────────────────────────────────────────────────────────┤
│ │ ○ a1b2c3d Add user authentication endpoint                   │
│ │   └─ src/auth/login.ts, src/routes/api.ts                    │
│ │                                                              │
│ │ ○ d4e5f6g Create user model and migrations                   │
│ │   └─ src/models/user.ts, migrations/001_users.sql            │
│ │                                                              │
│ │ ○ h7i8j9k Initial session setup                              │
│ │   └─ .claude/sessions/...                                    │
├─────────────────────────────────────────────────────────────────┤
│ [Checkout this branch] [Merge all to main] [Cherry-pick] [Delete]│
└─────────────────────────────────────────────────────────────────┘
```

### Diff Viewer in Split Pane

```
┌─────────────────────────────────────────────────────────────────┐
│ [Chat: Chorus] [src/auth/login.ts (diff)]                        │
├───────────────────────────┬─────────────────────────────────────┤
│ Chat conversation         │ Diff View                           │
│ ...                       │ ┌─────────────────────────────────┐ │
│                           │ │ src/auth/login.ts        [Raw]  │ │
│                           │ ├─────────────────────────────────┤ │
│                           │ │ - old code                      │ │
│                           │ │ + new code                      │ │
│                           │ │ + more new code                 │ │
│                           │ └─────────────────────────────────┘ │
│                           │ [Accept] [Reject] [Edit]            │
└───────────────────────────┴─────────────────────────────────────┘
```

### Workspace Settings - Git Automation

```
┌─────────────────────────────────────────────────────────────────┐
│ GIT AUTOMATION                                                   │
├─────────────────────────────────────────────────────────────────┤
│ ☑ Auto-create branch for each agent session                     │
│   Branch pattern: agent/{agentName}/{sessionId}                 │
│                                                                 │
│ ☑ Auto-commit after each conversation turn                      │
│   Include prompt in commit message                              │
│                                                                 │
│ ☐ Use GitButler for commit management                           │
│   (Requires GitButler CLI: `but`)                               │
└─────────────────────────────────────────────────────────────────┘
```

## Technical Considerations

### New Git Service Functions

```typescript
// git-service.ts additions
export async function createBranch(path: string, branchName: string): Promise<void>
export async function stageAll(path: string): Promise<void>
export async function commit(path: string, message: string): Promise<string> // returns hash
export async function getDiff(path: string, commitHash?: string): Promise<FileDiff[]>
export async function merge(path: string, sourceBranch: string, squash?: boolean): Promise<void>
export async function deleteBranch(path: string, branchName: string): Promise<void>
export async function getAgentBranches(path: string): Promise<AgentBranch[]>
```

### SDK Hook Integration

```typescript
// agent-sdk-service.ts modifications
options.hooks = {
  PreToolUse: [{
    matcher: /Edit|MultiEdit|Write/,
    hooks: [async (input) => {
      // Ensure agent branch exists and is checked out
      await ensureAgentBranch(conversationId, sessionId, agentName)
      return { continue: true }
    }]
  }],
  PostToolUse: [{
    matcher: /Edit|MultiEdit|Write/,
    hooks: [async (input) => {
      // Track file for commit
      trackFileChange(conversationId, input.tool_input.file_path)
      return { continue: true }
    }]
  }]
}

// On result event (end of turn):
// - Stage all tracked files
// - Commit with generated message
// - Notify UI via IPC
```

### State Management

```typescript
// New types
interface AgentBranch {
  name: string              // e.g., "agent/chorus/a1b2c3d"
  agentName: string         // e.g., "chorus"
  sessionId: string         // e.g., "a1b2c3d"
  createdAt: string
  commits: GitCommit[]
  isActive: boolean
}

interface WorkspaceGitSettings {
  autoBranch: boolean       // Create branch per session
  autoCommit: boolean       // Commit per turn
  useGitButler: boolean     // Forward to GitButler CLI
}

// Workspace store additions
agentBranches: Map<string, AgentBranch[]>  // workspaceId -> branches
loadAgentBranches: (workspaceId: string) => Promise<void>
```

### IPC Events

```typescript
// New IPC events
'git:branch-created'    // { workspaceId, branchName, agentName }
'git:commit-created'    // { workspaceId, branchName, commitHash, message }
'git:merge-completed'   // { workspaceId, sourceBranch, targetBranch }
```

## Edge Cases

1. **Uncommitted changes before starting**: Warn user, offer to stash
2. **Branch already exists**: Append counter (e.g., `agent/chorus/a1b2c3d-2`)
3. **Merge conflicts**: Show conflict UI, allow manual resolution
4. **Session interrupted**: Commit whatever is staged with "[Incomplete]" prefix
5. **Disk full / git errors**: Show error, offer to retry or skip
6. **No git repo**: Skip all git operations, show warning

## Dependencies

- Existing `git-service.ts` for git operations
- `agent-sdk-service.ts` for SDK hooks
- `WorkspaceOverview.tsx` for UI
- Split pane system (already implemented)
- Tab navigation (already implemented)

## Success Metrics

- Agent changes are automatically isolated to branches
- Each conversation turn produces a meaningful commit
- Users can review agent work through visual diff
- Merge workflow is smooth and intuitive
- No regression in non-git workspaces
- Optional GitButler integration works when available

## Implementation Phases

### Phase 1: Core Git Operations
- Add new git-service functions (branch, commit, diff)
- Implement agent branch naming and creation
- Auto-commit on turn completion

### Phase 2: UI Integration
- Agent Sessions section in WorkspaceOverview
- Branch list with commit history
- Basic actions (checkout, delete)

### Phase 3: Diff Viewer
- File diff component
- Integration with split pane
- Accept/reject UI

### Phase 4: Merge Workflow
- Merge preview
- Conflict handling
- Branch cleanup

### Phase 5: Settings & Polish
- Per-workspace git settings
- GitButler hook forwarding (optional)
- Edge case handling
