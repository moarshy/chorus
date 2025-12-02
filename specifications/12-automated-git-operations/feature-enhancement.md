# Feature Enhancement: Automated Git Operations

## Overview

This document describes enhancements to the existing automated git operations feature (spec 12) based on user feedback and usability improvements.

## Bug Fixes Applied

### BF-1: Push Function Duplicate Origin Bug
**Issue:** The `push()` function in `git-service.ts` produced invalid commands when both `setUpstream: true` and `branchName` were specified, resulting in `git push -u origin origin <branch>`.

**Fix:** Restructured the argument building logic to correctly handle the combination of options.

### BF-2: Silent Error Swallowing in Diff Functions
**Issue:** `getStructuredDiff()` and `getStructuredDiffBetweenBranches()` silently returned empty arrays on error, making debugging difficult.

**Fix:** Removed try-catch so errors propagate to callers and can be shown in UI.

---

## Proposed Enhancements

### E-1: Full Diff Viewer with Line-by-Line Display

**Current State:** View Changes shows only a list of changed files with +/- counts.

**Enhancement:** Add expandable inline diff viewer showing actual line changes.

**User Story:**
> As a user reviewing agent changes, I want to see the actual code diff inline without opening files individually, so I can quickly review what the agent modified.

**Acceptance Criteria:**
- [ ] Clicking a file expands to show diff hunks inline
- [ ] Syntax highlighting for code
- [ ] Green for additions, red for deletions
- [ ] Context lines shown around changes
- [ ] Collapse/expand toggle per file

### E-2: Branch Comparison Target Selection

**Current State:** Diff always compares against `main` or `master`.

**Enhancement:** Allow user to select which branch to compare against.

**User Story:**
> As a user working on a feature branch, I want to compare agent changes against my feature branch (not main), so I can see changes relative to my current work.

**Acceptance Criteria:**
- [ ] Dropdown to select comparison branch (default: main/master)
- [ ] Persist selection per workspace
- [ ] Option to compare against "parent" branch (where agent branch was created from)

### E-3: Merge Preview with Conflict Detection

**Current State:** Merge to main happens immediately with no preview or conflict check.

**Enhancement:** Show merge preview with potential conflict detection before merging.

**User Story:**
> As a user, I want to see what files will be merged and if there are potential conflicts, so I can handle issues before they happen.

**Acceptance Criteria:**
- [ ] "Preview Merge" step before actual merge
- [ ] List of files that will be changed
- [ ] Conflict detection (files modified in both branches)
- [ ] Option to abort or proceed
- [ ] Show warning if main has moved forward since branch creation

### E-4: Cherry-Pick Individual Commits

**Current State:** Only full branch merge is available.

**Enhancement:** Allow cherry-picking specific commits from an agent branch.

**User Story:**
> As a user, I want to pick only certain commits from the agent's work, so I can selectively incorporate changes.

**Acceptance Criteria:**
- [ ] Expand branch to see individual commits
- [ ] "Cherry-pick" button per commit
- [ ] Cherry-pick to current branch (whatever is checked out)
- [ ] Handle cherry-pick conflicts gracefully

### E-5: Undo Last Merge

**Current State:** No way to undo a merge from the UI.

**Enhancement:** Add undo capability for the most recent merge.

**User Story:**
> As a user who made a mistake, I want to undo the last merge operation, so I can recover from errors.

**Acceptance Criteria:**
- [ ] "Undo last merge" button appears after successful merge
- [ ] Uses `git reset --hard HEAD~1` (for squash merge)
- [ ] Confirmation dialog with warning
- [ ] Only available until next commit is made

### E-6: Push Status and Error Display

**Current State:** Push shows "Pushed!" on success but no details on failure.

**Enhancement:** Show detailed push status and helpful error messages.

**User Story:**
> As a user, I want to know why a push failed and how to fix it, so I can resolve issues without using terminal.

**Acceptance Criteria:**
- [ ] Show "needs pull first" if rejected
- [ ] Show "no remote configured" if no origin
- [ ] Show authentication errors clearly
- [ ] Suggest next steps for common errors

### E-7: Stash Before Checkout Warning

**Current State:** Checkout may fail if there are uncommitted changes.

**Enhancement:** Detect uncommitted changes and offer to stash them.

**User Story:**
> As a user with uncommitted work, I want the app to handle my changes safely when switching branches, so I don't lose work.

**Acceptance Criteria:**
- [ ] Detect uncommitted changes before checkout
- [ ] Offer: "Stash changes and checkout" / "Cancel"
- [ ] Auto-restore stash when returning to original branch
- [ ] Show stash indicator in UI

### E-8: Branch Cleanup Workflow

**Current State:** Delete removes branch immediately with no cleanup guidance.

**Enhancement:** Smart cleanup that handles merged/unmerged states.

**User Story:**
> As a user cleaning up old branches, I want guidance on which branches are safe to delete, so I don't lose important work.

**Acceptance Criteria:**
- [ ] Show "merged" / "unmerged" status per branch
- [ ] Different confirmation for merged vs unmerged
- [ ] Option to "delete all merged" in one action
- [ ] Prevent deleting currently checked out branch

### E-9: Refresh Agent Branches Button

**Current State:** Branch list updates via IPC events but no manual refresh.

**Enhancement:** Add explicit refresh button for branch list.

**User Story:**
> As a user, I want to manually refresh the branch list, so I can see changes made outside Chorus.

**Acceptance Criteria:**
- [ ] Refresh button in Agent Sessions header
- [ ] Loading indicator during refresh
- [ ] Also fetches from remote (optional toggle)

### E-10: Push All Agent Branches

**Current State:** Must push each branch individually.

**Enhancement:** Batch push all unpushed agent branches.

**User Story:**
> As a user with multiple agent branches, I want to push them all at once, so I can share my work efficiently.

**Acceptance Criteria:**
- [ ] "Push All" button in Agent Sessions header
- [ ] Shows count of unpushed branches
- [ ] Progress indicator during batch push
- [ ] Summary of results (X succeeded, Y failed)

---

## Priority Matrix

| Enhancement | Impact | Effort | Priority |
|-------------|--------|--------|----------|
| E-1: Inline Diff Viewer | High | High | P1 |
| E-2: Branch Comparison Target | Medium | Low | P1 |
| E-3: Merge Preview | High | Medium | P1 |
| E-6: Push Error Display | Medium | Low | P1 |
| E-7: Stash Warning | Medium | Medium | P2 |
| E-4: Cherry-Pick | Medium | Medium | P2 |
| E-8: Branch Cleanup | Medium | Low | P2 |
| E-5: Undo Merge | Low | Low | P3 |
| E-9: Refresh Button | Low | Low | P3 |
| E-10: Push All | Low | Medium | P3 |

---

## UI Mockups

### Enhanced Agent Session Card (E-1, E-4)

```
┌─────────────────────────────────────────────────────────────────┐
│ ▼ agent/chorus/a1b2c3d                               [current]  │
│   Chorus • 2 hours ago • 5 commits                              │
├─────────────────────────────────────────────────────────────────┤
│ [Checkout] [View Changes ▾] [Push] [Merge to main] [Delete]     │
├─────────────────────────────────────────────────────────────────┤
│ Changed Files (vs main ▾)                           [Expand All]│
├─────────────────────────────────────────────────────────────────┤
│ ▼ M  src/components/App.tsx                          +12 -3     │
│   ┌─────────────────────────────────────────────────────────────│
│   │  10 │   import { useState } from 'react'                    │
│   │  11 │ - import { helper } from './utils'                    │
│   │  11 │ + import { helper, newFunc } from './utils'           │
│   │  12 │ + import { Feature } from './Feature'                 │
│   └─────────────────────────────────────────────────────────────│
│ ▶ A  src/components/Feature.tsx                      +45 -0     │
│ ▶ M  src/utils/index.ts                              +8 -2      │
├─────────────────────────────────────────────────────────────────┤
│ Commits                                              [Expand]   │
│   ○ a1b2c3d Add feature component                    [Cherry]   │
│   ○ d4e5f6g Update utils                             [Cherry]   │
└─────────────────────────────────────────────────────────────────┘
```

### Merge Preview Dialog (E-3)

```
┌─────────────────────────────────────────────────────────────────┐
│ Merge Preview: agent/chorus/a1b2c3d → main                      │
├─────────────────────────────────────────────────────────────────┤
│ ⚠ Warning: main has 2 new commits since this branch was created │
├─────────────────────────────────────────────────────────────────┤
│ Files to be merged:                                             │
│   ✓ src/components/App.tsx (no conflicts)                       │
│   ✓ src/components/Feature.tsx (new file)                       │
│   ⚠ src/utils/index.ts (modified in both branches)              │
├─────────────────────────────────────────────────────────────────┤
│ Merge Options:                                                  │
│   ● Squash merge (recommended)                                  │
│   ○ Regular merge (preserves commit history)                    │
├─────────────────────────────────────────────────────────────────┤
│                                    [Cancel] [Proceed with Merge]│
└─────────────────────────────────────────────────────────────────┘
```

---

## Dependencies

- Existing `git-service.ts` functions
- `prism-react-renderer` for syntax highlighting (already in project)
- Split pane system for full diff view

## Success Metrics

- Reduced time to review and merge agent changes
- Fewer merge conflicts due to preview
- Lower error rate from push operations
- Increased user confidence in git operations
