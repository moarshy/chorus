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

### 7. Error Handling

**Test 7.1: Git Operations with Worktree**
- [ ] Create file changes via agent
- [ ] Run `git status` in worktree - verify changes shown
- [ ] Verify auto-commit works correctly (if enabled)
- [ ] Check commit appears on worktree branch

**Test 7.2: Worktree Cleanup**
- [ ] Delete a conversation that has a worktree
- [ ] Verify worktree directory still exists (manual cleanup expected)
- [ ] Future: Verify "Prune worktrees" functionality (if implemented)

### 8. Edge Cases

**Test 8.1: Repo Without .gitignore**
- [ ] Test with a repo that has no .gitignore
- [ ] Start agent conversation
- [ ] Verify `.gitignore` is created with `.chorus-worktrees/` entry

**Test 8.2: Non-Git Directory**
- [ ] Create workspace pointing to non-git directory
- [ ] Attempt to enable worktrees
- [ ] Verify graceful failure (falls back to standard execution)

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
