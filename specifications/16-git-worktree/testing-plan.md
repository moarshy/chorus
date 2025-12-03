# Sprint 16: Git Worktree Integration - Testing Plan

## Overview

This document outlines the testing strategy for verifying git worktree integration works correctly for both Claude SDK agents and OpenAI Deep Research agents.

## Prerequisites

- [x] Chorus app builds successfully (`bun run build`)
- [x] TypeScript type check passes (`bun run typecheck`)
- [x] A test repository with at least one agent configured

## Test Cases

### 1. Settings UI

**Test 1.1: Worktree Toggle Visibility**
- [x] Open Workspace Overview for any workspace
- [x] Scroll to "Git Automation" section in Default Settings
- [x] Verify "Use worktrees for agent isolation" toggle is visible
- [x] Verify toggle shows "Recommended" badge
- [x] Verify description mentions `.chorus-worktrees/`

**Test 1.2: Toggle State Persistence**
- [x] Toggle the worktree setting ON
- [x] Refresh the app or navigate away and back
- [x] Verify setting remains ON
- [x] Toggle OFF and verify persistence

### 2. Claude SDK Agent - Worktree Creation

**Test 2.1: First Message Creates Worktree**
- [x] Ensure "Use worktrees" is enabled in workspace settings
- [x] Start a new conversation with any Claude agent
- [x] Send a message (e.g., "Create a file called test.txt with hello world")
- [x] Check terminal/file explorer:
  - [x] `.chorus-worktrees/` directory exists in repo root
  - [x] Subdirectory named with conversation ID exists
  - [x] Files created by agent are in worktree, NOT main repo
- [x] Verify `.gitignore` includes `.chorus-worktrees/`

**Test 2.2: Worktree Uses Separate Branch**
- [x] In the worktree directory, run `git branch --show-current`
- [x] Verify branch name follows pattern: `agent/{agentName}/{sessionId}`
- [x] Verify main repo is still on its original branch

**Test 2.3: Follow-up Messages Use Same Worktree**
- [x] Continue the conversation with another message
- [x] Verify new files go to the SAME worktree (not creating new one)
- [x] Verify worktree count remains at 1 for this conversation

### 3. OpenAI Deep Research Agent - Worktree Creation

**Test 3.1: Research Output Goes to Worktree**
- [x] Ensure "Use worktrees" is enabled
- [x] Start a new Deep Research conversation
- [x] Send a research query (e.g., "Research best practices for React state management")
- [x] Wait for research to complete
- [x] Verify research markdown file is in `.chorus-worktrees/{conversationId}/` directory
- [x] Verify research output is NOT in main repo

**Test 3.2: Research Branch Naming**
- [x] Check worktree branch name follows pattern: `agent/deep-research/{sessionId}`

### 4. Parallel Agent Execution

**Test 4.1: Two Agents Simultaneously**
- [ ] Start a Claude agent conversation (Agent A) - send a message
- [ ] While Agent A is busy, start another agent conversation (Agent B)
- [ ] Send a message to Agent B
- [ ] Verify BOTH agents create separate worktrees:
  - [ ] `.chorus-worktrees/{conversationA-id}/` exists
  - [ ] `.chorus-worktrees/{conversationB-id}/` exists
- [ ] Verify each worktree has a different branch checked out
- [ ] Verify main repo branch is unchanged

**Test 4.2: Files Don't Conflict**
- [ ] Ask both agents to create a file with the same name (e.g., "test.md")
- [ ] Verify each agent's file is in its own worktree
- [ ] Verify no git conflicts occur

### 5. Session Resumption

**Test 5.1: Resuming Uses Existing Worktree**
- [ ] Close the Chorus app after creating an agent conversation with worktree
- [ ] Reopen the app
- [ ] Navigate to the same conversation
- [ ] Send a follow-up message
- [ ] Verify agent uses the EXISTING worktree (doesn't create new one)
- [ ] Verify worktree list shows same count as before

### 6. Legacy Mode (Worktrees Disabled)

**Test 6.1: Branch-Only Mode**
- [ ] Disable "Use worktrees" in workspace settings
- [ ] Start a new agent conversation
- [ ] Verify `.chorus-worktrees/` is NOT created/used
- [ ] Verify agent creates branch in main repo (legacy behavior)
- [ ] Verify file changes happen in main repo working directory

### 7. Auto-Commit with Worktrees

**Test 7.1: Auto-Commit Creates Commits in Worktree**
- [ ] Ensure "Auto-commit after each conversation turn" is enabled
- [ ] Start a new Claude agent conversation
- [ ] Send a message that creates/modifies files
- [ ] After agent completes, run in worktree: `git log --oneline -5`
- [ ] Verify commit was created with message including the prompt
- [ ] Verify commit is on the agent branch, NOT main

**Test 7.2: Auto-Commit for OpenAI Research**
- [ ] Ensure "Auto-commit" is enabled
- [ ] Start a new Deep Research conversation
- [ ] Wait for research to complete
- [ ] Run in worktree: `git log --oneline -5`
- [ ] Verify commit was created with "[Deep Research]" prefix
- [ ] Verify research output file is included in commit

**Test 7.3: Console Logging**
- [ ] Check Electron dev tools console during agent execution
- [ ] Verify no "No branch for this conversation" warnings
- [ ] Verify commit success message shows hash

### 8. Agent Sessions Panel

**Test 8.1: Sessions Panel Visibility**
- [ ] Open Workspace Overview (click workspace name in sidebar)
- [ ] Go to "Overview" tab (not Settings)
- [ ] Verify "Agent Sessions" section appears if agent branches exist
- [ ] Verify count shows correctly (e.g., "Agent Sessions (2)")

**Test 8.2: Session Actions**
- [ ] Expand an agent session
- [ ] Verify "Checkout", "View Changes", "Push", "Merge", "Delete" buttons work
- [ ] Click "View Changes" and verify diff is shown

### 9. Error Handling

**Test 9.1: Git Operations with Worktree**
- [ ] Create file changes via agent
- [ ] Run `git status` in worktree - verify changes shown
- [ ] Verify auto-commit works correctly (if enabled)
- [ ] Check commit appears on worktree branch

**Test 9.2: Worktree Cleanup**
- [ ] Delete a conversation that has a worktree
- [ ] Verify worktree directory still exists (manual cleanup expected)
- [ ] Future: Verify "Prune worktrees" functionality (if implemented)

### 10. Edge Cases

**Test 10.1: Repo Without .gitignore**
- [ ] Test with a repo that has no .gitignore
- [ ] Start agent conversation
- [ ] Verify `.gitignore` is created with `.chorus-worktrees/` entry

**Test 10.2: Non-Git Directory**
- [ ] Create workspace pointing to non-git directory
- [ ] Attempt to enable worktrees
- [ ] Verify graceful failure (falls back to standard execution)

**Test 10.3: Delete Branch with Active Worktree**
- [ ] Create agent conversation (worktree + branch created)
- [ ] Try to delete the agent branch from Branch list
- [ ] Verify worktree is automatically removed first
- [ ] Verify branch is successfully deleted
- [ ] Verify conversation is cascade-deleted

**Test 10.4: Delete Branch from AgentSessionsPanel**
- [ ] Open Workspace Overview > Overview tab
- [ ] Find an agent session and click Delete
- [ ] Verify deletion succeeds (worktree removed, branch deleted)
- [ ] Verify session disappears from the panel

**Test 10.5: Delete Branch from BranchSelector (Sidebar)**
- [ ] Click the branch dropdown in the sidebar
- [ ] Find an agent branch and click the delete icon
- [ ] Verify deletion succeeds
- [ ] Verify branch no longer appears in the list

**Test 10.6: Worktree Directory Cleanup**
- [ ] After deleting an agent branch
- [ ] Verify `.chorus-worktrees/{conversationId}/` directory is removed
- [ ] Run `git worktree list` to confirm worktree is gone

## Verification Commands

```bash
# List all worktrees for a repo
git worktree list

# Check branch in worktree
cd .chorus-worktrees/{conversationId}
git branch --show-current

# Check if .gitignore includes worktrees
grep -r ".chorus-worktrees" .gitignore

# Check worktree status
cd .chorus-worktrees/{conversationId}
git status
```

## Expected Behavior Summary

| Scenario | Worktrees Enabled | Worktrees Disabled |
|----------|-------------------|-------------------|
| Agent cwd | `.chorus-worktrees/{id}/` | Main repo path |
| Branch checkout | In worktree only | In main repo |
| File changes | Isolated per conversation | Shared in main repo |
| Parallel agents | Each in own worktree | Last checkout wins |
| Main repo state | Unchanged | Switched branches |

## Sign-off

- [ ] All test cases pass
- [ ] No regressions in existing functionality
- [ ] Performance acceptable (worktree creation < 2s)
- [ ] UI clearly communicates worktree state
