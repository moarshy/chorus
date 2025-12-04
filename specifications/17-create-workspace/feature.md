---
date: 2025-12-04
author: Claude
status: draft
type: feature
issue: https://github.com/NapthaAI/chorus/issues/13
---

# Create New Workspace Feature

## Overview

Allow users to create new GitHub repositories directly from Chorus, eliminating the friction of manual repo setup. New workspaces are automatically initialized with default Claude Code commands that help developers bootstrap agent repositories.

## Business Value

### For Power Users (like Richard)
- Rapid workspace creation without leaving Chorus
- Consistent agent repo structure across projects
- Default commands pre-loaded for immediate agent development

### For New Users
- Zero-friction onboarding to agent development
- Guided repo structure with helpful defaults
- No need to understand git/GitHub setup before getting started

## Current State

The Add Workspace dialog currently supports two options:
1. **Local Path** - Add an existing local git repository
2. **Clone from URL** - Clone an existing GitHub repository to `rootWorkspaceDir`

Users who want to start a new project must:
1. Manually create a GitHub repository
2. Clone it locally
3. Set up the `.claude/commands/` directory structure
4. Copy any default commands they want
5. Then add it to Chorus

This friction discourages experimentation and slows down new project creation.

## User Stories

### Primary Flow
1. **User**: **Given** I'm in Chorus, **when** I click "Add Workspace" and select "Create New", **then** I see a form to create a new GitHub repository - *Form has repo name (required), description (optional), and public/private toggle*

2. **User**: **Given** I've filled out the create form, **when** I click "Create", **then** Chorus creates the repo on GitHub, clones it locally, initializes it with default commands, and adds it to my sidebar - *Shows progress during multi-step process*

### Validation & Error Handling
3. **User**: **Given** I enter an invalid repo name (spaces, special chars), **when** I try to submit, **then** I see a clear validation error before any API calls - *Real-time validation as I type*

4. **User**: **Given** GitHub CLI is not installed, **when** I try to create a repo, **then** I see a helpful error explaining I need to install `gh` - *Include install instructions link*

5. **User**: **Given** I'm not authenticated with GitHub CLI, **when** I try to create, **then** I see an error telling me to run `gh auth login` - *Clear remediation steps*

6. **User**: **Given** a repo with the same name already exists, **when** I try to create, **then** I see an error suggesting I choose a different name - *Don't fail silently*

7. **User**: **Given** network issues occur during creation, **when** the process fails, **then** any partial state is cleaned up and I see a clear error - *No orphaned repos or directories*

### Progress & Feedback
8. **User**: **Given** creation is in progress, **when** each step completes, **then** I see visual progress feedback - *Steps: Creating repo, Cloning, Initializing commands, Committing*

9. **User**: **Given** creation succeeds, **when** the workspace appears in sidebar, **then** it's automatically selected so I can start working immediately - *Smooth transition*

## Core Functionality

### Create Workspace Form

**New tab in AddWorkspaceDialog:**
- Tab label: "Create New"
- Position: Third tab after "Local Path" and "Clone from URL"

**Form fields:**
| Field | Type | Required | Validation | Default |
|-------|------|----------|------------|---------|
| Repository Name | text input | Yes | GitHub repo naming rules (lowercase, alphanumeric, hyphens) | Empty |
| Description | text input | No | Max 350 chars | Empty |
| Visibility | toggle/switch | Yes | N/A | Private |

**Submit button:** "Create Workspace"

### GitHub Repository Creation

Uses GitHub CLI (`gh`) to create the repository:
```bash
gh repo create <name> --private|--public --add-readme --description "<desc>"
```

The `--add-readme` flag ensures the repo has an initial commit and HEAD reference.

### Clone to Local

After creation, clone to `rootWorkspaceDir` (configured in Settings):
```bash
git clone https://github.com/<user>/<name>.git {rootWorkspaceDir}/<name>
```

Clone target is: `{rootWorkspaceDir}/{repoName}` (e.g., `~/chorus/my-agent-project` if rootWorkspaceDir is `~/chorus`)

### Initialize Default Commands

Copy default commands from Chorus's own `.claude/commands/` directory:
```
chorus/.claude/commands/
├── create_agent_command.md   # For creating new Claude Code commands
└── create_claude_md.md       # For creating CLAUDE.md files
```

These are copied to the new workspace:
```
<new-workspace>/.claude/commands/
├── create_agent_command.md
└── create_claude_md.md
```

### Initial Commit & Push

After copying commands:
```bash
git add .claude/commands/
git commit -m "Initialize workspace with default Claude Code commands"
git push
```

### Add to Chorus

Finally, call existing `workspace:add` to register in Chorus and discover agents.

## Technical Requirements

### Electron Architecture

**Main Process (new IPC handlers):**

1. `git:check-gh-cli` - Check if `gh` CLI is installed and authenticated
   ```typescript
   // Returns: { installed: boolean, authenticated: boolean, username?: string }
   ```

2. `git:create-repo` - Create GitHub repository
   ```typescript
   // Input: { name: string, description?: string, isPrivate: boolean }
   // Returns: { success: boolean, repoUrl?: string, error?: string }
   ```

3. `git:initialize-workspace` - Initialize workspace with default commands
   ```typescript
   // Input: { repoPath: string, chorusCommandsPath: string }
   // Copies commands, commits, and pushes
   // Returns: { success: boolean, error?: string }
   ```

**Renderer Process:**
- Extended `AddWorkspaceDialog` component with third tab
- Form validation logic
- Progress state management
- Error display

**Preload:**
- Expose new IPC methods via `window.api.git.*`

### UI Components

**AddWorkspaceDialog extensions:**
- New "Create New" tab with form
- Progress overlay during creation
- Error state display with remediation hints

**Form validation:**
- Real-time repo name validation
- GitHub naming rules: `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`
- Cannot start/end with hyphen
- Max 100 characters

### State Management

No new Zustand stores needed. Use local component state for:
- Form values
- Loading/progress state
- Error messages
- Current step indicator

### Error Handling Strategy

| Error | Detection | User Message | Remediation |
|-------|-----------|--------------|-------------|
| `gh` not installed | `which gh` fails | "GitHub CLI is not installed" | Link to install instructions |
| Not authenticated | `gh auth status` fails | "Please authenticate with GitHub CLI" | Show `gh auth login` command |
| Repo name taken | `gh repo create` returns error | "Repository name already exists" | Suggest different name |
| Network failure | Clone/push fails | "Network error during creation" | Retry button |
| Permission denied | SSH/auth failure | "Permission denied" | Check SSH keys message |

### Cleanup on Failure

If any step fails after repo creation:
1. Delete local clone directory if it exists
2. Attempt to delete GitHub repo if it was created
3. Show error with clear state (nothing half-created)

## Design Considerations

### Layout & UI

The dialog maintains current styling but adds third tab:

```
┌─────────────────────────────────────────────────┐
│ Add Workspace                                   │
├─────────────────────────────────────────────────┤
│ [Local Path] [Clone from URL] [Create New]      │
├─────────────────────────────────────────────────┤
│                                                 │
│  Repository Name *                              │
│  ┌───────────────────────────────────────────┐  │
│  │ my-agent-project                          │  │
│  └───────────────────────────────────────────┘  │
│  Will be created at: ~/chorus/my-agent-project  │
│                                                 │
│  Description (optional)                         │
│  ┌───────────────────────────────────────────┐  │
│  │                                           │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ○ Public   ● Private                           │
│                                                 │
│           [Cancel]  [Create Workspace]          │
└─────────────────────────────────────────────────┘
```

**Progress state:**
```
┌─────────────────────────────────────────────────┐
│ Creating Workspace...                           │
├─────────────────────────────────────────────────┤
│                                                 │
│  ✓ Creating GitHub repository                   │
│  ✓ Cloning to local machine                     │
│  ● Initializing default commands                │
│  ○ Committing and pushing                       │
│  ○ Adding to Chorus                             │
│                                                 │
│            [Cancel] (disabled)                  │
└─────────────────────────────────────────────────┘
```

### Accessibility

- Form labels properly associated
- Error messages announced to screen readers
- Progress updates accessible
- Keyboard navigation works

## Implementation Considerations

### GitHub CLI Dependency

Chorus already uses `gh` for some operations. This feature makes it a hard requirement for repo creation. Need to:
1. Check for `gh` availability before showing create option
2. Provide clear installation instructions if missing
3. Guide through authentication if not logged in

### Default Commands Source

The default commands are stored in the Chorus app itself:
- Development: `chorus/.claude/commands/`
- Production: Need to bundle with app or load from resources

Use `app.getAppPath()` to locate bundled commands in production.

### Root Directory Requirement

Like clone, create requires `rootWorkspaceDir` to be set. If not set:
- Show message prompting user to set it in Settings
- Disable the Create button until set

## Success Criteria

### Core Functionality
- [ ] New "Create New" tab appears in Add Workspace dialog
- [ ] Form validates repo name per GitHub rules
- [ ] Public/private toggle works correctly
- [ ] Repo created on GitHub under user's account
- [ ] Repo cloned to `~/chorus/<repo-name>` (or configured root dir)
- [ ] `.claude/commands/` created with default commands
- [ ] Initial commit pushed to main
- [ ] Workspace appears in sidebar immediately after creation

### Error Handling
- [ ] Clear error when `gh` CLI not installed
- [ ] Clear error when not authenticated with GitHub
- [ ] Clear error when repo name already exists
- [ ] Clear error on network failure
- [ ] Cleanup occurs on partial failure (no orphaned repos/directories)

### User Experience
- [ ] Progress indicator shows current step
- [ ] Validation feedback is real-time
- [ ] Newly created workspace is auto-selected
- [ ] Total flow takes <30 seconds on good network

## Scope Boundaries

### Definitely In Scope
- Create new GitHub repository via `gh` CLI
- Clone to local machine
- Initialize with default Claude Code commands
- Commit and push initial setup
- Add to Chorus sidebar
- Form validation and error handling

### Definitely Out of Scope
- Custom templates beyond default commands
- Organization repositories (only personal repos)
- Non-GitHub providers (GitLab, Bitbucket)
- Repository settings beyond name/description/visibility
- Branch protection or other repo configuration

### Future Considerations
- Template selection from multiple starter templates
- Organization repository support
- Custom command set selection
- Project scaffolding (creating agent.md files)

## Open Questions & Risks

### Questions Needing Resolution
1. **Production command bundling**: How to package default commands with Electron app?
   - Consider: Use `app.getPath('appData')` or embed in asar

2. **GitHub username discovery**: How to get authenticated user's GitHub username for the clone URL?
   - Solution: Use `gh api user --jq '.login'` or parse from `gh auth status`

### Identified Risks
1. **GitHub CLI version differences**: Different `gh` versions may have slightly different output formats
   - Mitigation: Test with multiple versions, use structured output flags

2. **Rate limiting**: Creating many repos quickly could hit GitHub rate limits
   - Mitigation: Not a typical user pattern, but add note if error occurs

3. **Network reliability**: Multi-step process vulnerable to network issues mid-way
   - Mitigation: Implement cleanup on failure, consider retry logic

## Next Steps

1. Create implementation plan with phased approach
2. Implement backend IPC handlers
3. Extend AddWorkspaceDialog UI
4. Add error handling and cleanup logic
5. Test with various network conditions and error scenarios
