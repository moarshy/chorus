# Testing Plan: Automated Git Operations

## Overview

This document outlines the testing strategy for the automated git operations feature and its P1 enhancements (E-1, E-2, E-6).

---

## Test Environment Setup

### Prerequisites
- A workspace with an existing git repository
- At least one `agent/*` branch with commits
- Remote "origin" configured (for push tests)
- Multiple branches available (main, master, feature branches)

### Test Workspace Setup

```bash
# Create test workspace
mkdir test-workspace && cd test-workspace
git init
git checkout -b main
echo "initial" > file.txt
git add . && git commit -m "Initial commit"

# Create agent branch with changes
git checkout -b agent/test-agent/abc123
echo "modified by agent" > file.txt
echo "new file" > new-file.ts
git add . && git commit -m "[Agent] Test changes"

# Return to main
git checkout main
```

---

## Feature Tests

### 1. Bug Fixes (Pre-requisite Tests)

#### BF-1: Push Function Fix

**Test Case:** Push agent branch with setUpstream

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create agent branch locally | Branch created |
| 2 | Click "Push" on the branch | Shows loading state |
| 3 | Observe git command | Should be `git push -u origin agent/...` (not `origin origin`) |
| 4 | Check result | Success message or appropriate error |

**Verification:**
```bash
# In test repo, check the actual command would be:
git push -u origin agent/test-agent/abc123
# NOT: git push -u origin origin agent/test-agent/abc123
```

#### BF-2: Error Propagation in Diff Functions

**Test Case:** Diff with invalid branch

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Manually call API with non-existent branch | Should return error, not empty array |
| 2 | Check UI shows error message | "Error: ..." displayed |

---

### 2. E-1: Inline Diff Viewer

#### Test Case 2.1: View Changes Shows File List

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to workspace with agent branches | Agent Sessions panel visible |
| 2 | Expand an agent branch | Actions visible |
| 3 | Click "View Changes" | Loading indicator appears |
| 4 | Wait for load | File list displays with status icons |

#### Test Case 2.2: Expand File to See Diff

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | With diff visible, click on file row | File expands |
| 2 | Observe diff content | Shows line-by-line diff |
| 3 | Verify line numbers | Old and new line numbers displayed |
| 4 | Verify colors | Green for additions, red for deletions |

#### Test Case 2.3: Expand All / Collapse All

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | With multiple files in diff | Files are collapsed |
| 2 | Click "Expand All" | All files expand, showing diffs |
| 3 | Click "Collapse" | All files collapse |

#### Test Case 2.4: Open File from Diff

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | With diff visible | File row shows ↗ button |
| 2 | Click ↗ button | File opens in editor tab |
| 3 | For deleted files | ↗ button not shown |

#### Test Case 2.5: Diff Hunk Display

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Expand a modified file | Shows hunk headers (@@...@@) |
| 2 | Scroll through diff | Line numbers are continuous |
| 3 | Context lines visible | Gray/neutral color |
| 4 | Added lines visible | Green background, + prefix |
| 5 | Deleted lines visible | Red background, - prefix |

---

### 3. E-2: Branch Comparison Selector

#### Test Case 3.1: Dropdown Shows Available Branches

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "View Changes" on agent branch | Diff loads |
| 2 | Observe "Comparing to:" dropdown | Shows non-agent branches |
| 3 | Dropdown excludes | agent/* branches |
| 4 | Default selection | main (or master if no main) |

#### Test Case 3.2: Change Comparison Branch

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | With diff visible | Dropdown shows current base |
| 2 | Change dropdown to different branch | Loading indicator |
| 3 | Wait for load | Diff updates with new comparison |
| 4 | Files may change | Based on new base branch |

#### Test Case 3.3: Comparison Persists

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Change comparison to "feature/x" | Diff shows comparison to feature/x |
| 2 | Close diff (Hide Changes) | Diff hidden |
| 3 | Open diff again (View Changes) | Still comparing to feature/x |

---

### 4. E-6: Push Error Handling

#### Test Case 4.1: Successful Push

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Have unpushed agent branch | Branch shows in list |
| 2 | Click "Push" | Loading state |
| 3 | Wait for completion | "Pushed!" message |
| 4 | Message auto-dismisses | After 3 seconds |

#### Test Case 4.2: Push Rejected (Remote Has Changes)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Push branch that's behind remote | Click Push |
| 2 | Wait for error | Error message appears |
| 3 | Check suggestion | "Remote has new changes. Pull first..." |

**Setup:**
```bash
# On another machine/clone, push changes to same branch
# Then try to push from Chorus
```

#### Test Case 4.3: No Remote Configured

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Use repo with no "origin" remote | `git remote -v` shows nothing |
| 2 | Click "Push" | Error appears |
| 3 | Check suggestion | "No remote 'origin' configured..." |

#### Test Case 4.4: Authentication Required

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Clear git credentials | Or use repo requiring auth |
| 2 | Click "Push" | Error appears |
| 3 | Check suggestion | "Git authentication required..." |

#### Test Case 4.5: Error Auto-Dismisses

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger any push error | Error message shown |
| 2 | Wait 10 seconds | Error auto-dismisses |

---

### 5. Core Git Operations (Regression Tests)

#### Test Case 5.1: Checkout Agent Branch

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Expand non-current agent branch | Checkout button visible |
| 2 | Click "Checkout" | Loading state |
| 3 | Wait | Branch becomes current |
| 4 | Workspace status updates | Shows new branch name |

#### Test Case 5.2: Merge to Main

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Expand agent branch | Merge button visible |
| 2 | Click "Merge to main" | Loading state |
| 3 | Wait | Merge completes |
| 4 | Check git log | Squash commit on main |

#### Test Case 5.3: Delete Branch

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Expand non-current agent branch | Delete button visible |
| 2 | Click "Delete" | Confirmation dialog appears |
| 3 | Click "Delete" in dialog | Branch removed from list |

#### Test Case 5.4: Current Branch Cannot Delete

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Checkout an agent branch | Branch is current |
| 2 | Expand the branch | No Delete button |
| 3 | Shows message | "Currently checked out..." |

---

## Edge Cases

### Edge Case 1: Empty Diff

| Scenario | Expected |
|----------|----------|
| Agent branch identical to main | "No differences from main branch" |
| UI state | No file list, just message |

### Edge Case 2: Binary Files

| Scenario | Expected |
|----------|----------|
| Agent branch modifies binary file | File shows in list |
| Expand binary file | "Binary file or no diff available" |

### Edge Case 3: Large Diff

| Scenario | Expected |
|----------|----------|
| >100 changed files | All files listed (scrollable) |
| >1000 lines in single file | Scrollable diff viewer |

### Edge Case 4: Renamed Files

| Scenario | Expected |
|----------|----------|
| File renamed in agent branch | Status shows "R" (blue) |
| Diff shows | Old path → New path |

### Edge Case 5: No Agent Branches

| Scenario | Expected |
|----------|----------|
| Workspace has no agent/* branches | Agent Sessions panel not shown |

---

## Performance Tests

### Performance 1: Large Number of Branches

| Metric | Target |
|--------|--------|
| Load 20+ agent branches | < 2 seconds |
| UI remains responsive | No freezing |

### Performance 2: Large Diff

| Metric | Target |
|--------|--------|
| Load diff with 50 files | < 3 seconds |
| Expand all files | < 1 second |
| Scroll performance | 60 FPS |

---

## Manual Testing Checklist

### Pre-Release Checklist

- [ ] Push fix verified (no duplicate "origin")
- [ ] View Changes shows files correctly
- [ ] Inline diff displays properly
- [ ] Line numbers are accurate
- [ ] Colors are correct (green/red)
- [ ] Expand All/Collapse work
- [ ] Comparison dropdown appears
- [ ] Changing comparison updates diff
- [ ] Push success shows "Pushed!"
- [ ] Push errors show helpful messages
- [ ] Error auto-dismisses after 10s
- [ ] Checkout works
- [ ] Merge to main works
- [ ] Delete with confirmation works
- [ ] Current branch protected from delete
- [ ] Empty diff shows message
- [ ] Binary files handled gracefully

### Browser Compatibility

- [ ] Tested in Electron (primary)
- [ ] Dark theme renders correctly
- [ ] Fonts are readable
- [ ] Icons display properly

---

## Automated Test Suggestions

```typescript
// Unit tests for DiffHunkViewer
describe('DiffHunkViewer', () => {
  it('renders additions in green', () => {
    const hunk = { content: '+added line', ... }
    // Render and check classes
  })

  it('renders deletions in red', () => {
    const hunk = { content: '-deleted line', ... }
    // Render and check classes
  })

  it('handles empty hunks', () => {
    // Render with empty array
  })
})

// Unit tests for push error parsing
describe('Push Error Handling', () => {
  it('suggests pull for rejected push', () => {
    const error = 'rejected non-fast-forward'
    // Check suggestion contains 'pull'
  })

  it('suggests auth for credential errors', () => {
    const error = 'could not read Username'
    // Check suggestion contains 'authentication'
  })
})
```

---

## Known Limitations

1. **No real-time updates** - Branch list requires manual refresh or IPC events
2. **No conflict preview** - Merge conflicts not detected before merge
3. **No cherry-pick** - Full branch merge only
4. **No undo** - Cannot undo merge from UI

These are addressed in P2/P3 enhancements (see feature-enhancement.md).
