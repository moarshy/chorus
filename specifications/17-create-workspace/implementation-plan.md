---
date: 2025-12-04
author: Claude
status: draft
type: implementation-plan
feature: Create New Workspace
issue: https://github.com/NapthaAI/chorus/issues/13
---

# Create New Workspace - Implementation Plan

## Overview

Implement a "Create New" tab in the AddWorkspaceDialog that allows users to create GitHub repositories directly from Chorus, automatically initialized with default Claude Code commands.

## Current State Analysis

### AddWorkspaceDialog (`AddWorkspaceDialog.tsx:1-192`)
- Uses tab-based mode switching with `Mode = 'local' | 'clone'`
- Local component state for form values, loading, and errors
- Error display uses `border-status-error text-status-error` styling
- Clone operation closes dialog immediately; progress shown in sidebar

### Git Service (`git-service.ts`)
- `execSync` via `runGit()` helper for synchronous operations (10s timeout)
- `spawn` with progress callback for clone operations
- All functions throw errors, caught at IPC handler level

### IPC Pattern (`index.ts:498-509`)
- Handlers return `{ success: boolean, data?: T, error?: string }`
- Progress events via `mainWindow.webContents.send()`
- Event listeners in preload return cleanup functions

### Default Commands Location
- Development: `chorus/.claude/commands/` contains `create_agent_command.md` and `create_claude_md.md`
- Production: Will bundle in `resources/default-commands/` (asarUnpack already configured)

## What We're NOT Doing

- Custom templates or template selection
- Organization repository support (personal repos only)
- Non-GitHub providers (GitLab, Bitbucket)
- Repository settings beyond name/description/visibility
- Retry logic for failed operations (just cleanup and show error)

## Implementation Approach

Multi-step creation with progress shown **in the dialog** (unlike clone which shows progress in sidebar). This keeps the user focused on the creation flow and provides clear feedback for each discrete step.

---

## Phase 1: Backend Git Functions

### Overview
Add GitHub CLI helper functions to check installation/auth status and create repositories.

### Changes Required:

#### 1. Git Service Functions
**File**: `chorus/src/main/services/git-service.ts`

**Add `checkGhCli()` function:**
- Run `which gh` to check if installed (use `execSync` with try/catch)
- If installed, run `gh auth status` to check authentication
- If authenticated, run `gh api user --jq '.login'` to get username
- Return `{ installed: boolean, authenticated: boolean, username?: string }`

**Add `createGitHubRepo()` function:**
- Accept `name: string`, `options: { description?: string, isPrivate: boolean }`
- Run `gh repo create {name} --private|--public --add-readme` with optional `--description`
- Parse output to extract repo URL (format: `https://github.com/{username}/{name}`)
- Return `{ repoUrl: string, cloneUrl: string }`
- Handle common errors: name already exists, auth failure, network error

**Add `getDefaultCommandsDir()` function:**
- Use `is.dev` from `@electron-toolkit/utils` to detect environment
- Development: resolve from `__dirname` to `../../.claude/commands` (relative to `out/main/`)
- Production: use `process.resourcesPath` + `app.asar.unpacked/resources/default-commands`
- Return absolute path to commands directory

### Success Criteria:

**Automated verification**
- [ ] TypeScript compiles without errors
- [ ] Functions export correctly from git-service.ts

**Manual Verification**
- [ ] `checkGhCli()` correctly detects gh installation
- [ ] `checkGhCli()` correctly detects auth status
- [ ] `createGitHubRepo()` creates repo on GitHub with correct visibility
- [ ] `getDefaultCommandsDir()` returns valid path in development

---

## Phase 2: Backend IPC + Initialize Function

### Overview
Register IPC handlers and add function to initialize workspace with default commands.

### Changes Required:

#### 1. Initialize Workspace Function
**File**: `chorus/src/main/services/git-service.ts`

**Add `initializeWorkspaceCommands()` function:**
- Accept `repoPath: string`
- Get default commands dir via `getDefaultCommandsDir()`
- Create `.claude/commands/` directory in repo using `mkdirSync` with `recursive: true`
- Copy each `.md` file from default commands to new workspace
- Run `git add .claude/commands/`
- Run `git commit -m "Initialize workspace with default Claude Code commands"`
- Run `git push`
- Handle errors at each step with descriptive messages

#### 2. IPC Handler Registration
**File**: `chorus/src/main/index.ts`

**Add `git:check-gh-cli` handler:**
- Call `checkGhCli()` from git-service
- Return `{ success: true, data: { installed, authenticated, username } }`

**Add `git:create-repo` handler:**
- Accept `name: string, options: { description?: string, isPrivate: boolean }`
- Call `createGitHubRepo()` from git-service
- Return `{ success: true, data: { repoUrl, cloneUrl } }` or error

**Add `git:initialize-workspace` handler:**
- Accept `repoPath: string`
- Call `initializeWorkspaceCommands()` from git-service
- Return `{ success: true }` or error

#### 3. Preload API Exposure
**File**: `chorus/src/preload/index.ts`

**Add to git API object:**
- `checkGhCli: () => ipcRenderer.invoke('git:check-gh-cli')`
- `createRepo: (name, options) => ipcRenderer.invoke('git:create-repo', name, options)`
- `initializeWorkspace: (repoPath) => ipcRenderer.invoke('git:initialize-workspace', repoPath)`

#### 4. Type Definitions
**File**: `chorus/src/preload/index.d.ts`

**Add new types:**
- `GhCliStatus` interface: `{ installed: boolean, authenticated: boolean, username?: string }`
- `CreateRepoResult` interface: `{ repoUrl: string, cloneUrl: string }`
- Update `GitAPI` interface with new method signatures

### Success Criteria:

**Automated verification**
- [ ] TypeScript compiles without errors
- [ ] IPC handlers registered without runtime errors

**Manual Verification**
- [ ] `window.api.git.checkGhCli()` returns correct status from renderer
- [ ] `window.api.git.createRepo()` creates repo on GitHub
- [ ] `window.api.git.initializeWorkspace()` copies commands and pushes

---

## Phase 3: Frontend UI

### Overview
Extend AddWorkspaceDialog with "Create New" tab, form fields, validation, and step-based progress view.

### Changes Required:

#### 1. Dialog Mode Extension
**File**: `chorus/src/renderer/src/components/dialogs/AddWorkspaceDialog.tsx`

**Update Mode type:**
- Change from `'local' | 'clone'` to `'local' | 'clone' | 'create'`

**Add new state variables:**
- `repoName: string` - Repository name input
- `repoDescription: string` - Optional description input
- `isPrivate: boolean` - Visibility toggle (default: true)
- `createStep: 'form' | 'creating'` - Current UI state
- `currentStepIndex: number` - Progress indicator (0-4)
- `ghCliStatus: GhCliStatus | null` - Cached gh CLI status

**Define creation steps constant:**
```typescript
const CREATION_STEPS = [
  { id: 'create', label: 'Creating GitHub repository' },
  { id: 'clone', label: 'Cloning to local machine' },
  { id: 'init', label: 'Initializing default commands' },
  { id: 'commit', label: 'Committing and pushing' },
  { id: 'add', label: 'Adding to Chorus' }
]
```

#### 2. Tab UI Extension

**Add third tab button:**
- Label: "Create New"
- Same styling as existing tabs (`bg-selected text-primary` when active)
- Position after "Clone from URL"

#### 3. Create Form UI

**Render when `mode === 'create' && createStep === 'form'`:**

**Repository Name field:**
- Required text input with label
- Real-time validation as user types
- Transform input: lowercase, replace invalid chars with empty string
- Show target path hint: `Will be created at: {rootWorkspaceDir}/{repoName}`
- Show validation error if invalid

**Description field:**
- Optional text input with label
- Max length 350 characters
- Placeholder: "A new agent workspace"

**Visibility toggle:**
- Radio button group: Public / Private
- Default to Private
- Use `accent-accent` for radio styling

**Validation helper function:**
- Check not empty
- Check max 100 characters
- Check starts with letter or number
- Check ends with letter or number
- Check only lowercase letters, numbers, hyphens
- Check no consecutive hyphens
- Return error message string or null

#### 4. Progress UI

**Render when `mode === 'create' && createStep === 'creating'`:**

**Step list:**
- Map over CREATION_STEPS
- Show checkmark (✓) for completed steps (index < currentStepIndex)
- Show spinner (●) for current step (index === currentStepIndex)
- Show empty circle (○) for pending steps
- Use `text-status-success` for checkmarks
- Use `animate-spin` for spinner (or simple ● without animation)
- Use `text-muted` for pending steps

#### 5. GH CLI Status Check

**Add useEffect:**
- Trigger when `mode` changes to 'create'
- Call `window.api.git.checkGhCli()`
- Store result in `ghCliStatus` state
- If not installed: set error "GitHub CLI is not installed..."
- If not authenticated: set error "Please authenticate with GitHub CLI..."

#### 6. Create Handler

**Add `handleCreate()` async function:**

1. Validate repo name, return early if invalid
2. Check `settings.rootWorkspaceDir` is set
3. Set `createStep = 'creating'`, `currentStepIndex = 0`
4. Clear any existing errors

**Step 0 - Create repo:**
- Call `window.api.git.createRepo(repoName, { description, isPrivate })`
- On error: throw with message
- On success: increment `currentStepIndex`

**Step 1 - Clone:**
- Build `targetDir = ${rootWorkspaceDir}/${repoName}`
- Call `window.api.git.clone(cloneUrl, targetDir)`
- On error: throw with message
- On success: increment `currentStepIndex`

**Step 2-3 - Initialize:**
- Call `window.api.git.initializeWorkspace(targetDir)`
- On error: throw with message
- On success: set `currentStepIndex = 4`

**Step 4 - Add to Chorus:**
- Call `addWorkspace(targetDir)` from store
- On success: call `closeAddWorkspace()`

**Error handling:**
- Wrap all in try/catch
- On error: cleanup local directory if it exists
- Set error message and reset `createStep = 'form'`

#### 7. Button States

**Submit button:**
- Text: "Create Workspace" (form) or "Creating..." (creating)
- Disabled when: no repo name, loading, gh not authenticated, no rootWorkspaceDir

**Cancel button:**
- Disabled during creation (`createStep === 'creating'`)

### Success Criteria:

**Automated verification**
- [ ] TypeScript compiles without errors
- [ ] No React warnings in console

**Manual Verification**
- [ ] Third tab appears and switches correctly
- [ ] Form validates repo name in real-time
- [ ] Visibility toggle works
- [ ] GH CLI status check runs on tab switch
- [ ] Progress view shows during creation
- [ ] Steps update as creation progresses
- [ ] Workspace appears in sidebar on success
- [ ] Error displays on failure

---

## Phase 4: Error Handling & Cleanup

### Overview
Improve error messages and implement cleanup when creation fails partway through.

### Changes Required:

#### 1. Error Message Parsing
**File**: `chorus/src/main/services/git-service.ts`

**Add `parseGhError()` helper function:**
- Input: raw error string from gh CLI
- Map common errors to user-friendly messages:
  - "Name already exists" → "A repository with this name already exists. Please choose a different name."
  - "command not found" → "GitHub CLI is not installed. Please install it from https://cli.github.com/"
  - "not logged in" / "authentication" → "Please authenticate with GitHub CLI by running: gh auth login"
  - "Could not resolve host" → "Network error. Please check your internet connection."
- Return original error if no match

**Use in `createGitHubRepo()`:**
- Catch errors from `execSync`
- Parse with `parseGhError()` before throwing

#### 2. Cleanup Function
**File**: `chorus/src/main/services/git-service.ts`

**Add `cleanupFailedWorkspace()` function:**
- Accept `localPath: string`
- If directory exists, delete it recursively using `rmSync` with `{ recursive: true, force: true }`
- Wrap in try/catch, ignore errors (best effort cleanup)

#### 3. Frontend Cleanup Integration
**File**: `chorus/src/renderer/src/components/dialogs/AddWorkspaceDialog.tsx`

**Update error handler in `handleCreate()`:**
- In catch block, call `window.api.fs.delete(targetDir)` if targetDir was set
- Ignore errors from cleanup (fire and forget)
- Always show the original error to user

#### 4. Root Directory Validation

**Add check in create mode UI:**
- If `!settings?.rootWorkspaceDir`, show message: "Please set a root workspace directory in Settings first"
- Disable Create button until set

### Success Criteria:

**Automated verification**
- [ ] TypeScript compiles without errors

**Manual Verification**
- [ ] "gh not installed" shows helpful error with install link
- [ ] "not authenticated" shows gh auth login instruction
- [ ] "name taken" suggests choosing different name
- [ ] Network error shows connection message
- [ ] Failed creation cleans up local directory
- [ ] Missing root dir shows settings prompt

---

## File Summary

| File | Changes |
|------|---------|
| `chorus/src/main/services/git-service.ts` | Add `checkGhCli()`, `createGitHubRepo()`, `getDefaultCommandsDir()`, `initializeWorkspaceCommands()`, `parseGhError()`, `cleanupFailedWorkspace()` |
| `chorus/src/main/index.ts` | Register `git:check-gh-cli`, `git:create-repo`, `git:initialize-workspace` handlers |
| `chorus/src/preload/index.ts` | Expose `checkGhCli`, `createRepo`, `initializeWorkspace` methods |
| `chorus/src/preload/index.d.ts` | Add `GhCliStatus`, `CreateRepoResult` types, update `GitAPI` interface |
| `chorus/src/renderer/src/components/dialogs/AddWorkspaceDialog.tsx` | Add create mode, form, progress UI, validation, error handling |

---

## Testing Strategy

### Manual Testing Checklist

**Happy Path:**
1. Open Add Workspace dialog
2. Click "Create New" tab
3. Enter valid repo name (e.g., "test-agent-project")
4. Optionally add description
5. Select Public or Private
6. Click "Create Workspace"
7. Verify progress steps complete
8. Verify workspace appears in sidebar
9. Verify `.claude/commands/` exists with default commands
10. Verify repo exists on GitHub with README

**Error Scenarios:**
1. GH CLI not installed → Shows install instructions
2. Not authenticated → Shows `gh auth login` command
3. Invalid repo name → Real-time validation error
4. Name already exists → Shows name conflict error
5. Network failure → Shows connection error
6. Missing root dir → Shows settings prompt
7. Clone fails midway → Local directory cleaned up

**Edge Cases:**
1. Very long repo name (100 chars) → Validates correctly
2. Name with consecutive hyphens → Rejected
3. Name starting/ending with hyphen → Rejected
4. Empty description → Creates without description
5. Cancel during creation → Button disabled

---

## References

* Feature spec: `specifications/17-create-workspace/feature.md`
* AddWorkspaceDialog: `chorus/src/renderer/src/components/dialogs/AddWorkspaceDialog.tsx`
* Git service: `chorus/src/main/services/git-service.ts`
* IPC handlers: `chorus/src/main/index.ts:432-876`
* Clone progress pattern: `chorus/src/main/index.ts:498-509`
* Default commands: `chorus/.claude/commands/`
