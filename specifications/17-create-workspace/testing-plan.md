---
date: 2025-12-04
author: Claude
status: draft
type: testing-plan
feature: Create New Workspace
issue: https://github.com/NapthaAI/chorus/issues/13
---

# Create New Workspace - Testing Plan

## Overview

This document outlines the testing strategy for the Create New Workspace feature, covering unit tests, integration tests, and manual testing procedures.

---

## Prerequisites

Before testing, ensure:
- GitHub CLI (`gh`) is installed: `brew install gh`
- GitHub CLI is authenticated: `gh auth login`
- Root workspace directory is set in Chorus Settings
- Network connectivity is available
- A GitHub account with permission to create repositories

---

## Test Categories

### 1. Unit Tests

#### 1.1 Repo Name Validation

**File**: `chorus/src/renderer/src/components/dialogs/__tests__/AddWorkspaceDialog.test.ts`

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Empty name | `""` | "Repository name is required" |
| Too long | `"a".repeat(101)` | "Repository name must be 100 characters or less" |
| Starts with hyphen | `"-myrepo"` | "Repository name must start with a letter or number" |
| Ends with hyphen | `"myrepo-"` | "Repository name must end with a letter or number" |
| Contains uppercase | `"MyRepo"` | Should auto-convert to lowercase |
| Contains spaces | `"my repo"` | Should strip spaces |
| Contains special chars | `"my_repo!"` | Should strip invalid chars |
| Consecutive hyphens | `"my--repo"` | "Repository name cannot contain consecutive hyphens" |
| Valid simple name | `"myrepo"` | `null` (valid) |
| Valid with hyphens | `"my-agent-project"` | `null` (valid) |
| Valid with numbers | `"agent2024"` | `null` (valid) |
| Single character | `"a"` | `null` (valid) |
| Max length (100) | `"a".repeat(100)` | `null` (valid) |

#### 1.2 GH CLI Status Parsing

**File**: `chorus/src/main/services/__tests__/git-service.test.ts`

| Test Case | Mock Output | Expected Result |
|-----------|-------------|-----------------|
| GH not installed | `which gh` throws | `{ installed: false, authenticated: false }` |
| GH installed, not authed | `gh auth status` fails | `{ installed: true, authenticated: false }` |
| GH installed and authed | `gh api user` returns `{"login":"testuser"}` | `{ installed: true, authenticated: true, username: "testuser" }` |

#### 1.3 Error Message Parsing

**File**: `chorus/src/main/services/__tests__/git-service.test.ts`

| Test Case | Raw Error | Expected Message |
|-----------|-----------|------------------|
| Name exists | "Name already exists on this account" | "A repository with this name already exists..." |
| Command not found | "gh: command not found" | "GitHub CLI is not installed..." |
| Not logged in | "not logged into any GitHub hosts" | "Please authenticate with GitHub CLI..." |
| Network error | "Could not resolve host: github.com" | "Network error. Please check your internet connection." |
| Unknown error | "Something unexpected happened" | "Something unexpected happened" (passthrough) |

---

### 2. Integration Tests

#### 2.1 IPC Handler Tests

**File**: `chorus/src/main/__tests__/ipc-handlers.test.ts`

**`git:check-gh-cli` handler:**
```typescript
test('returns correct status when gh is installed and authenticated', async () => {
  const result = await ipcMain.handle('git:check-gh-cli')
  expect(result.success).toBe(true)
  expect(result.data.installed).toBe(true)
  expect(result.data.authenticated).toBe(true)
  expect(result.data.username).toBeDefined()
})
```

**`git:create-repo` handler:**
```typescript
test('creates public repo successfully', async () => {
  const result = await ipcMain.handle('git:create-repo',
    'test-repo-public',
    { description: 'Test', isPrivate: false }
  )
  expect(result.success).toBe(true)
  expect(result.data.repoUrl).toContain('github.com')
  // Cleanup: delete the created repo
})

test('creates private repo successfully', async () => {
  const result = await ipcMain.handle('git:create-repo',
    'test-repo-private',
    { isPrivate: true }
  )
  expect(result.success).toBe(true)
  // Cleanup: delete the created repo
})

test('returns error for duplicate repo name', async () => {
  // First create a repo
  await ipcMain.handle('git:create-repo', 'duplicate-test', { isPrivate: true })
  // Try to create again
  const result = await ipcMain.handle('git:create-repo', 'duplicate-test', { isPrivate: true })
  expect(result.success).toBe(false)
  expect(result.error).toContain('already exists')
  // Cleanup
})
```

**`git:initialize-workspace` handler:**
```typescript
test('initializes workspace with default commands', async () => {
  // Setup: create and clone a test repo
  const repoPath = '/tmp/test-workspace'

  const result = await ipcMain.handle('git:initialize-workspace', repoPath)

  expect(result.success).toBe(true)
  expect(existsSync(join(repoPath, '.claude/commands/create_agent_command.md'))).toBe(true)
  expect(existsSync(join(repoPath, '.claude/commands/create_claude_md.md'))).toBe(true)

  // Verify commit was pushed
  const log = execSync('git log --oneline -1', { cwd: repoPath, encoding: 'utf-8' })
  expect(log).toContain('Initialize workspace')

  // Cleanup
})
```

---

### 3. Manual Testing Procedures

#### 3.1 Happy Path - Complete Flow

**Test ID**: `CREATE-001`
**Priority**: Critical

**Preconditions:**
- GH CLI installed and authenticated
- Root workspace directory set to `~/chorus`
- No existing repo named `test-manual-create`

**Steps:**
1. Open Chorus application
2. Click "+" button to open Add Workspace dialog
3. Click "Create New" tab
4. Enter repository name: `test-manual-create`
5. Enter description: "Manual testing repo"
6. Select "Private" visibility
7. Click "Create Workspace"

**Expected Results:**
- [ ] Progress view appears with 5 steps
- [ ] Each step shows checkmark as it completes
- [ ] "Creating GitHub repository" completes (~2-3 seconds)
- [ ] "Cloning to local machine" completes (~2-3 seconds)
- [ ] "Initializing default commands" completes (~1-2 seconds)
- [ ] "Committing and pushing" completes (~1-2 seconds)
- [ ] "Adding to Chorus" completes (~1 second)
- [ ] Dialog closes automatically
- [ ] New workspace appears in sidebar
- [ ] Workspace is selected/highlighted

**Verification:**
- [ ] Check GitHub: repo exists at `github.com/<username>/test-manual-create`
- [ ] Check GitHub: repo is private
- [ ] Check GitHub: README.md exists
- [ ] Check GitHub: `.claude/commands/` directory exists with 2 files
- [ ] Check local: `~/chorus/test-manual-create` directory exists
- [ ] Check local: `.claude/commands/create_agent_command.md` exists
- [ ] Check local: `.claude/commands/create_claude_md.md` exists

**Cleanup:**
```bash
# Delete local directory
rm -rf ~/chorus/test-manual-create

# Delete GitHub repo
gh repo delete test-manual-create --yes
```

---

#### 3.2 Public Repository Creation

**Test ID**: `CREATE-002`
**Priority**: High

**Steps:**
1. Open Add Workspace dialog → "Create New" tab
2. Enter repository name: `test-public-repo`
3. Select "Public" visibility
4. Click "Create Workspace"

**Expected Results:**
- [ ] Repo created successfully
- [ ] Repo is PUBLIC on GitHub (verify in browser)
- [ ] Workspace added to Chorus

**Cleanup:** Delete repo after test

---

#### 3.3 GH CLI Not Installed

**Test ID**: `CREATE-003`
**Priority**: High

**Preconditions:**
- Temporarily rename/remove gh: `sudo mv /opt/homebrew/bin/gh /opt/homebrew/bin/gh.bak`

**Steps:**
1. Open Add Workspace dialog
2. Click "Create New" tab

**Expected Results:**
- [ ] Error message appears immediately: "GitHub CLI is not installed"
- [ ] Message includes link to https://cli.github.com/
- [ ] "Create Workspace" button is disabled

**Cleanup:** Restore gh: `sudo mv /opt/homebrew/bin/gh.bak /opt/homebrew/bin/gh`

---

#### 3.4 GH CLI Not Authenticated

**Test ID**: `CREATE-004`
**Priority**: High

**Preconditions:**
- Log out of gh: `gh auth logout`

**Steps:**
1. Open Add Workspace dialog
2. Click "Create New" tab

**Expected Results:**
- [ ] Error message appears: "Please authenticate with GitHub CLI"
- [ ] Message shows command: `gh auth login`
- [ ] "Create Workspace" button is disabled

**Cleanup:** Re-authenticate: `gh auth login`

---

#### 3.5 Repository Name Already Exists

**Test ID**: `CREATE-005`
**Priority**: High

**Preconditions:**
- Create a repo first: `gh repo create test-duplicate --private --add-readme`

**Steps:**
1. Open Add Workspace dialog → "Create New" tab
2. Enter repository name: `test-duplicate`
3. Click "Create Workspace"

**Expected Results:**
- [ ] Progress starts, then fails at "Creating GitHub repository"
- [ ] Error message: "A repository with this name already exists"
- [ ] Dialog returns to form view
- [ ] No local directory created

**Cleanup:** `gh repo delete test-duplicate --yes`

---

#### 3.6 Invalid Repository Names (Real-time Validation)

**Test ID**: `CREATE-006`
**Priority**: Medium

**Steps & Expected Results:**

| Input | Expected Behavior |
|-------|-------------------|
| Type `-test` | Error: "must start with a letter or number" |
| Type `test-` | Error: "must end with a letter or number" |
| Type `test--repo` | Error: "cannot contain consecutive hyphens" |
| Type `TEST` | Auto-converts to `test` |
| Type `my repo` | Auto-converts to `myrepo` (strips space) |
| Type `my_repo!` | Auto-converts to `myrepo` (strips invalid chars) |
| Paste 101 chars | Error: "must be 100 characters or less" |

- [ ] All validation errors appear below the input field
- [ ] "Create Workspace" button stays disabled while errors exist
- [ ] Target path hint updates in real-time as name changes

---

#### 3.7 Missing Root Workspace Directory

**Test ID**: `CREATE-007`
**Priority**: Medium

**Preconditions:**
- Clear root workspace directory in Settings (if possible) or test with fresh install

**Steps:**
1. Open Add Workspace dialog → "Create New" tab

**Expected Results:**
- [ ] Message appears: "Please set a root workspace directory in Settings first"
- [ ] "Create Workspace" button is disabled
- [ ] Target path hint shows "(set in settings)"

---

#### 3.8 Network Failure During Clone

**Test ID**: `CREATE-008`
**Priority**: Medium

**Preconditions:**
- Be ready to disable network after step 4

**Steps:**
1. Open Add Workspace dialog → "Create New" tab
2. Enter repository name: `test-network-fail`
3. Click "Create Workspace"
4. When "Creating GitHub repository" completes, **disable network**
5. Wait for clone to fail

**Expected Results:**
- [ ] Error appears after clone timeout
- [ ] Error message mentions network/connection
- [ ] Dialog returns to form view
- [ ] Local directory (if created) is cleaned up
- [ ] GitHub repo still exists (partial state)

**Cleanup:**
- Re-enable network
- `gh repo delete test-network-fail --yes`

---

#### 3.9 Cancel Button States

**Test ID**: `CREATE-009`
**Priority**: Low

**Steps:**
1. Open Add Workspace dialog → "Create New" tab
2. Verify Cancel button is enabled
3. Click "Create Workspace" with valid input
4. While progress is showing, observe Cancel button

**Expected Results:**
- [ ] Cancel button is **disabled** during creation
- [ ] Cancel button has disabled styling (grayed out)

---

#### 3.10 Tab Switching

**Test ID**: `CREATE-010`
**Priority**: Low

**Steps:**
1. Open Add Workspace dialog
2. Click "Create New" tab
3. Enter some form data
4. Click "Local Path" tab
5. Click "Create New" tab again

**Expected Results:**
- [ ] Form data is preserved when switching back
- [ ] GH CLI status check runs again on tab switch
- [ ] No errors or glitches

---

#### 3.11 Description Field

**Test ID**: `CREATE-011`
**Priority**: Low

**Steps:**
1. Create repo WITHOUT description
2. Verify on GitHub
3. Create repo WITH description: "Test description for Chorus"
4. Verify on GitHub

**Expected Results:**
- [ ] Repo without description shows no description on GitHub
- [ ] Repo with description shows "Test description for Chorus" on GitHub

**Cleanup:** Delete both test repos

---

### 4. Edge Case Tests

#### 4.1 Very Long Repository Name

**Test ID**: `EDGE-001`

**Steps:**
1. Enter exactly 100 character name: `a` repeated 100 times
2. Attempt to create

**Expected Results:**
- [ ] Validation passes
- [ ] Repo creates successfully (if name doesn't already exist)

---

#### 4.2 Single Character Name

**Test ID**: `EDGE-002`

**Steps:**
1. Enter single character name: `x`
2. Attempt to create

**Expected Results:**
- [ ] Validation passes
- [ ] Repo creates successfully

---

#### 4.3 Name with Many Hyphens

**Test ID**: `EDGE-003`

**Steps:**
1. Enter name: `a-b-c-d-e-f-g`
2. Attempt to create

**Expected Results:**
- [ ] Validation passes (no consecutive hyphens)
- [ ] Repo creates successfully

---

#### 4.4 Rapid Create Attempts

**Test ID**: `EDGE-004`

**Steps:**
1. Enter valid repo name
2. Click "Create Workspace"
3. Immediately click again (before progress starts)

**Expected Results:**
- [ ] Only one creation process starts
- [ ] No duplicate API calls
- [ ] Button becomes disabled on first click

---

### 5. Regression Tests

After implementation, verify these existing features still work:

#### 5.1 Local Path Addition

- [ ] "Local Path" tab still works
- [ ] Browse button opens directory picker
- [ ] Adding local workspace succeeds
- [ ] Error handling for non-git directories works

#### 5.2 Clone from URL

- [ ] "Clone from URL" tab still works
- [ ] Clone progress appears in sidebar
- [ ] Clone completion adds workspace
- [ ] URL validation still works

#### 5.3 Dialog Behavior

- [ ] Clicking overlay closes dialog
- [ ] Escape key closes dialog (if implemented)
- [ ] Error clears when switching modes
- [ ] Dialog closes on successful operations

---

## Test Execution Checklist

### Pre-Release Testing

| Test ID | Description | Status | Tester | Date |
|---------|-------------|--------|--------|------|
| CREATE-001 | Happy path complete flow | ⬜ | | |
| CREATE-002 | Public repo creation | ⬜ | | |
| CREATE-003 | GH CLI not installed | ⬜ | | |
| CREATE-004 | GH CLI not authenticated | ⬜ | | |
| CREATE-005 | Duplicate repo name | ⬜ | | |
| CREATE-006 | Invalid name validation | ⬜ | | |
| CREATE-007 | Missing root directory | ⬜ | | |
| CREATE-008 | Network failure | ⬜ | | |
| CREATE-009 | Cancel button states | ⬜ | | |
| CREATE-010 | Tab switching | ⬜ | | |
| CREATE-011 | Description field | ⬜ | | |
| EDGE-001 | 100 char name | ⬜ | | |
| EDGE-002 | Single char name | ⬜ | | |
| EDGE-003 | Many hyphens | ⬜ | | |
| EDGE-004 | Rapid clicks | ⬜ | | |

### Regression Tests

| Feature | Status | Tester | Date |
|---------|--------|--------|------|
| Local Path tab | ⬜ | | |
| Clone from URL tab | ⬜ | | |
| Dialog overlay close | ⬜ | | |
| Error display/clearing | ⬜ | | |

---

## Known Limitations

1. **No automated E2E tests** - GitHub API interactions require real credentials
2. **Network failure testing** - Requires manual network toggle
3. **GH CLI tests** - Require temporarily modifying system PATH
4. **Cleanup required** - Most tests create real GitHub repos that must be deleted

---

## Test Environment Requirements

- macOS (primary development platform)
- Node.js 18+
- Bun package manager
- GitHub CLI 2.x
- Active GitHub account
- Internet connectivity
