# Feature: Git Worktree Integration for Concurrent Agent Isolation

## Overview

Implement git worktree support to enable true parallel agent execution. Each active agent conversation gets its own isolated working directory (worktree), allowing multiple agents to work on different branches simultaneously without filesystem conflicts.

**Supported Agent Types:**
- **Claude SDK Agents** (Chorus, custom agents) - File operations via SDK tools (Write, Edit, etc.)
- **OpenAI Deep Research Agents** - Research reports saved to files

**Integration with Existing Features:**
- **Builds on Spec 12** (Automated Git Operations) - Worktrees enhance the existing auto-branch and auto-commit functionality
- **Works with Spec 15** (OpenAI Deep Research) - Research output goes to worktree directory

## Problem Statement

### Current Architecture Limitation

When multiple agents run concurrently in the same workspace:

1. **All agents share the same working directory** (`cwd: repoPath`)
2. **Git branch checkout is global** - the last agent to start "wins" the working tree
3. **File changes from Agent A may apply to Agent B's branch**
4. **Auto-commits can go to the wrong branch**

```
Current Flow (Broken for Concurrent Agents):

Agent A starts → creates branch agent/feature/abc → checks out
Agent B starts → creates branch agent/bugfix/def → checks out (OVERWRITES Agent A's checkout!)
Agent A writes file → file lands on Agent B's branch (WRONG!)
```

### Root Cause

Git repositories can only have **one branch checked out per working directory**. Without worktrees, all agents sharing `cwd: /path/to/repo` will conflict.

## Solution: Git Worktrees

Git worktrees allow a single repository to have **multiple working directories**, each with its own checked-out branch.

```
Solution with Worktrees:

Main repo: /workspace/myproject (main branch)
├── .git/worktrees/conv-abc/  (metadata only)
├── .git/worktrees/conv-def/  (metadata only)

Worktree A: /workspace/.chorus-worktrees/conv-abc (agent/feature/abc branch)
  └── Agent A operates here safely

Worktree B: /workspace/.chorus-worktrees/conv-def (agent/bugfix/def branch)
  └── Agent B operates here safely
```

Each agent's SDK client runs with its own `cwd`, providing complete isolation.

## User Stories

### US-1: Automatic Worktree Creation for Conversations
**As a** user starting a conversation with an agent
**I want** the conversation to get its own isolated worktree
**So that** my agent can work without interfering with other agents

**Acceptance Criteria:**
- [ ] When a conversation starts (with auto-branch enabled), create a worktree
- [ ] Worktree created at `.chorus-worktrees/{conversationId}/`
- [ ] Worktree checks out the conversation's branch
- [ ] Agent SDK uses worktree path as `cwd`
- [ ] User notified of worktree creation in chat

### US-2: Concurrent Agent Execution
**As a** user running multiple agent conversations simultaneously
**I want** each agent to work in isolation
**So that** they don't interfere with each other's branches or files

**Acceptance Criteria:**
- [ ] Agent A and Agent B can run concurrently
- [ ] Each agent's file changes stay in its own worktree
- [ ] Auto-commits go to the correct branch
- [ ] No git conflicts from concurrent operations

### US-3: Worktree Cleanup on Conversation End
**As a** user finishing a conversation
**I want** the worktree to be cleaned up appropriately
**So that** disk space is not wasted on unused worktrees

**Acceptance Criteria:**
- [ ] Option to auto-remove worktree when conversation ends
- [ ] Option to keep worktree for review
- [ ] Manual cleanup via "Delete Worktree" action
- [ ] Cleanup removes both worktree directory and git metadata

### US-4: Resume Conversation in Existing Worktree
**As a** user resuming a previous conversation
**I want** the agent to continue working in the same worktree
**So that** my work in progress is preserved

**Acceptance Criteria:**
- [ ] Resuming conversation detects existing worktree
- [ ] Agent resumes with same `cwd` as before
- [ ] Any uncommitted changes are preserved
- [ ] Session continuity maintained

### US-5: View Active Worktrees
**As a** user managing multiple agent sessions
**I want** to see all active worktrees for a workspace
**So that** I can understand resource usage and manage sessions

**Acceptance Criteria:**
- [ ] Workspace Overview shows "Active Worktrees" section
- [ ] Each worktree shows: branch, conversation link, disk usage
- [ ] Actions: Open in file browser, Delete, Merge to main

### US-6: Manual Worktree Control
**As a** power user
**I want** to manually create/remove worktrees
**So that** I have fine-grained control over isolation

**Acceptance Criteria:**
- [ ] Toggle in settings: "Use worktrees for agent isolation"
- [ ] Manual "Create Worktree" action for any conversation
- [ ] Manual "Remove Worktree" action
- [ ] Warning when removing worktree with uncommitted changes

### US-7: Worktree-Free Mode (Fallback)
**As a** user who doesn't want worktree complexity
**I want** to disable worktrees
**So that** I can use the simpler (but less concurrent) branch-per-conversation mode

**Acceptance Criteria:**
- [ ] Settings toggle: "Enable worktree isolation" (default: true)
- [ ] When disabled, falls back to current branch-switching behavior
- [ ] Warning displayed about concurrent agent limitations

### US-8: Open Worktree Files in Editor
**As a** user reviewing agent work
**I want** to open files from the agent's worktree
**So that** I can see exactly what the agent sees

**Acceptance Criteria:**
- [ ] Files in Details panel link to worktree path (not main repo)
- [ ] File tabs show worktree indicator when viewing worktree file
- [ ] Editor shows correct file content from worktree

## Technical Design

### Worktree Location Strategy

```
/workspace/myproject/                    # Main repository (stays on main/dev branch)
├── .git/
├── .chorus-worktrees/                   # Worktrees directory (gitignored)
│   ├── conv-abc1234/                    # Worktree for conversation abc1234
│   │   ├── src/
│   │   ├── package.json
│   │   └── ...                          # Full working tree
│   └── conv-def5678/                    # Worktree for conversation def5678
│       └── ...
├── src/
└── package.json
```

**Rationale:**
- `.chorus-worktrees/` is inside the repo for easy discovery
- Added to `.gitignore` to prevent tracking
- Conversation ID in path for clear association
- Alternative: `~/.chorus/worktrees/{workspaceId}/{conversationId}/` (outside repo)

### Git Commands

```bash
# Create worktree for a conversation
git worktree add .chorus-worktrees/conv-abc1234 -b agent/feature-dev/abc1234

# Or create worktree for existing branch
git worktree add .chorus-worktrees/conv-abc1234 agent/feature-dev/abc1234

# List worktrees
git worktree list

# Remove worktree (keeps branch)
git worktree remove .chorus-worktrees/conv-abc1234

# Prune stale worktree entries
git worktree prune
```

### Conversation-Worktree Mapping

```typescript
interface ConversationWorktree {
  conversationId: string
  worktreePath: string           // Absolute path to worktree
  branchName: string             // Branch checked out in worktree
  createdAt: string
  lastAccessedAt: string
  diskUsageBytes?: number
}

// Store mapping in conversation metadata
interface Conversation {
  // ... existing fields ...
  branchName: string | null
  worktreePath: string | null    // NEW: Path to worktree if active
}
```

### Agent SDK Integration

```typescript
// In agent-sdk-service.ts
async function getAgentWorkingDirectory(
  conversationId: string,
  repoPath: string,
  branchName: string,
  gitSettings: GitSettings
): Promise<string> {
  if (!gitSettings.useWorktrees) {
    // Fallback: use main repo path (current behavior)
    return repoPath
  }

  // Check for existing worktree
  const existingWorktree = await getConversationWorktree(conversationId)
  if (existingWorktree) {
    return existingWorktree.worktreePath
  }

  // Create new worktree
  const worktreePath = path.join(repoPath, '.chorus-worktrees', conversationId)
  await gitService.createWorktree(repoPath, worktreePath, branchName)

  // Store mapping
  updateConversation(conversationId, { worktreePath })

  return worktreePath
}

// Use worktree path as cwd for SDK
const options: QueryOptions = {
  cwd: await getAgentWorkingDirectory(conversationId, repoPath, branchName, gitSettings),
  // ... other options
}
```

### Lifecycle Events

| Event | Action |
|-------|--------|
| Conversation created + auto-branch enabled | Create worktree |
| Conversation resumed | Use existing worktree |
| Conversation deleted | Prompt to delete worktree |
| Agent session ends | Keep worktree (for review) |
| Branch merged to main | Offer to cleanup worktree |
| Workspace removed | Cleanup all worktrees |

### IPC Events

```typescript
// New IPC events for worktree management
'git:worktree-created'    // { conversationId, worktreePath, branchName }
'git:worktree-removed'    // { conversationId, worktreePath }
'git:worktree-list'       // Returns WorktreeInfo[]
```

## UI Design

### Workspace Overview - Active Worktrees Section

```
┌─────────────────────────────────────────────────────────────────┐
│ ACTIVE WORKTREES (3)                                    [Prune] │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ agent/feature-auth/abc1234                           45 MB  │ │
│ │ Conversation: "Add user authentication"                     │ │
│ │ Last active: 2 hours ago                                    │ │
│ │ [Open Files] [View Conversation] [Merge] [Delete]           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ agent/bugfix-api/def5678                             12 MB  │ │
│ │ Conversation: "Fix API timeout issue"               Active  │ │
│ │ [Open Files] [View Conversation]                            │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Workspace Settings - Worktree Configuration

```
┌─────────────────────────────────────────────────────────────────┐
│ AGENT ISOLATION                                                  │
├─────────────────────────────────────────────────────────────────┤
│ ● Use git worktrees for agent isolation (Recommended)           │
│   Each conversation gets its own working directory.             │
│   Enables true parallel agent execution.                        │
│                                                                 │
│ ○ Use branch switching (Legacy)                                 │
│   All agents share one working directory.                       │
│   ⚠️ Concurrent agents may interfere with each other.           │
│                                                                 │
│ Worktree location: .chorus-worktrees/                           │
│                                                                 │
│ ☑ Auto-cleanup worktrees after branch merge                     │
│ ☐ Prompt before deleting worktree with uncommitted changes      │
└─────────────────────────────────────────────────────────────────┘
```

### Chat Header - Worktree Indicator

```
┌─────────────────────────────────────────────────────────────────┐
│ Feature Agent                                                    │
│ agent/feature-auth/abc1234 • Worktree: .chorus-worktrees/abc... │
└─────────────────────────────────────────────────────────────────┘
```

### Details Panel - Files with Worktree Context

```
┌─────────────────────────────────────────────────────────────────┐
│ FILES CHANGED (3)                               [Open Worktree] │
├─────────────────────────────────────────────────────────────────┤
│ ✎ src/auth/login.ts                        (in worktree)        │
│ ✎ src/routes/api.ts                        (in worktree)        │
│ + src/models/user.ts                       (in worktree)        │
└─────────────────────────────────────────────────────────────────┘
```

## Edge Cases

### 1. Worktree Already Exists for Branch
**Scenario:** User manually created a worktree for the same branch.
**Solution:** Detect existing worktree via `git worktree list`, reuse it.

### 2. Disk Full During Worktree Creation
**Scenario:** Not enough disk space to create worktree.
**Solution:** Catch error, show user-friendly message, fall back to branch-switching.

### 3. Worktree Directory Deleted Manually
**Scenario:** User deleted `.chorus-worktrees/conv-abc/` but git metadata remains.
**Solution:** Run `git worktree prune` on startup to clean stale entries.

### 4. Branch Deleted While Worktree Active
**Scenario:** Branch `agent/feature/abc` deleted but worktree still exists.
**Solution:** Detect orphaned worktree, offer to recreate branch or delete worktree.

### 5. Uncommitted Changes in Worktree
**Scenario:** User wants to delete worktree but there are uncommitted changes.
**Solution:** Warn user, offer to commit/stash/discard before deletion.

### 6. Main Repo Has Uncommitted Changes
**Scenario:** Main repo is dirty when trying to create worktree.
**Solution:** Worktrees don't require clean main repo - proceed normally.

### 7. Nested Worktrees
**Scenario:** User tries to create worktree inside another worktree.
**Solution:** Detect and prevent, show error message.

### 8. Cross-Platform Path Issues
**Scenario:** Worktree paths with spaces or special characters on Windows.
**Solution:** Use proper path quoting in git commands, test on Windows.

## Dependencies

- Existing `git-service.ts` for git operations
- `agent-sdk-service.ts` for SDK configuration
- `conversation-service.ts` for conversation metadata
- `workspace-store.ts` for UI state
- Specification 12 (Automated Git Operations) for branch management

## Success Metrics

- Multiple agents can run truly in parallel without file conflicts
- Each conversation's worktree is isolated and independent
- Worktree creation/cleanup is transparent to users
- No regression for single-agent workflows
- Disk usage is manageable (worktrees cleaned up appropriately)

## Out of Scope

- Cross-repository worktrees (each workspace manages its own)
- Worktree sharing between workspaces
- Remote worktrees
- Worktree templates/presets
