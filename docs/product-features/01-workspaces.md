# Workspaces

Workspaces are the top-level organizational unit in Chorus. Each workspace corresponds to a GitHub repository.

---

## Overview

| Aspect | Description |
|--------|-------------|
| What | A GitHub repository added to Chorus |
| Why | Organize agents and conversations by project |
| Where | Sidebar → Workspaces panel |

---

## Features

### 1. Add Local Repository ✅

Add an existing local Git repository to Chorus.

**User Flow:**
1. Click "+" button in sidebar header
2. Select "Add local folder" tab
3. Browse to repository folder
4. Click "Add Workspace"

**Validation:**
- Must be a valid directory
- Must be a Git repository (has `.git/` folder)
- Cannot add duplicate paths

**Implementation:**
- `AddWorkspaceDialog.tsx` - UI dialog
- `workspace-service.ts` - Validation logic
- `store/index.ts` - Persistence

---

### 2. Clone from GitHub URL ✅

Clone a repository directly from GitHub.

**User Flow:**
1. Click "+" button in sidebar header
2. Select "Clone from GitHub" tab
3. Enter GitHub URL (HTTPS or SSH)
4. Click "Clone"
5. Progress indicator shows clone status

**Supported URL Formats:**
- `https://github.com/owner/repo`
- `https://github.com/owner/repo.git`
- `git@github.com:owner/repo.git`

**Clone Location:**
- Clones to `{rootWorkspaceDir}/{repo-name}/`
- Root workspace directory configurable in settings

**Implementation:**
- `AddWorkspaceDialog.tsx` - Clone UI with progress
- `git-service.ts` - `cloneRepository()` with progress callback
- IPC: `git:clone` handler

---

### 3. Root Workspace Directory ✅

Configure where cloned repositories are stored.

**User Flow:**
1. Click settings icon in sidebar header
2. Browse to desired directory
3. Click "Save"

**Default:** User's home directory

**Implementation:**
- `SettingsDialog.tsx` - Settings UI
- `store/index.ts` - `rootWorkspaceDir` in ChorusSettings

---

### 4. Workspace Settings (Defaults) ✅

Configure default settings for all new conversations in a workspace. These defaults apply automatically when creating new conversations with any agent in the workspace.

---

#### 4.1 Permission Mode

Controls how the agent requests approval for tool usage.

| Mode | Behavior | Use Case |
|------|----------|----------|
| `default` | Prompts for each tool first use | Safe exploration, learning |
| `acceptEdits` | Auto-approves file edits (Write, Edit) | Trusted development work |
| `plan` | Read-only mode, no file modifications | Code review, analysis |
| `bypassPermissions` | Skips all permission prompts | CI/CD, automated pipelines |

**Permission Dialog:**
When in `default` mode, a dialog appears showing:
- Tool name (e.g., "Write", "Bash")
- Tool input (file path, command, etc.)
- Approve / Deny buttons
- Optional denial reason (fed back to agent)

---

#### 4.2 Allowed Tools

Whitelist of tools the agent can use. Restricting tools limits agent capabilities.

| Tool | Purpose | Risk Level |
|------|---------|------------|
| `Bash` | Execute shell commands | High - can run any command |
| `Edit` | Modify existing files | Medium - changes code |
| `Write` | Create new files | Medium - creates files |
| `WebFetch` | Fetch URLs | Low - read-only network |
| `WebSearch` | Search the web | Low - read-only search |
| `NotebookEdit` | Edit Jupyter notebooks | Medium - changes notebooks |

**Default:** All tools enabled

**Common Configurations:**
- **Read-only analysis:** Disable Bash, Edit, Write
- **No network:** Disable WebFetch, WebSearch
- **Code only:** Enable Edit, Write; disable Bash

---

#### 4.3 Model Selection

Choose which Claude model powers the agent.

| Model | Context | Strengths | Cost |
|-------|---------|-----------|------|
| `claude-sonnet-4-5-20250514` | 200K | Balanced speed/quality | $$ |
| `claude-opus-4-5-20250514` | 200K | Highest quality reasoning | $$$$ |
| `claude-sonnet-4-5-20250514-extended-thinking` | 1M | Large context, deep thinking | $$$ |

**Recommendations:**
- **Daily coding:** Sonnet 4.5 (fast, cost-effective)
- **Complex architecture:** Opus 4.5 (best reasoning)
- **Large codebase analysis:** Extended Thinking (1M context)

---

#### 4.4 Settings Hierarchy

Settings cascade from global to specific:

```
┌─────────────────────────────────────────────────────────┐
│ 1. Global Defaults (hardcoded)                          │
│    └─ permissionMode: 'default'                         │
│    └─ allowedTools: [all]                               │
│    └─ model: 'claude-sonnet-4-5-20250514'              │
├─────────────────────────────────────────────────────────┤
│ 2. Workspace Defaults (configured here)                 │
│    └─ Override globals for this workspace              │
│    └─ Apply to all new conversations                   │
├─────────────────────────────────────────────────────────┤
│ 3. Per-Conversation Settings (in chat toolbar)          │
│    └─ Override workspace defaults                       │
│    └─ Only affects this conversation                   │
└─────────────────────────────────────────────────────────┘
```

**Resolution Order:**
1. Check conversation settings → if set, use it
2. Check workspace settings → if set, use it
3. Fall back to global defaults

---

#### 4.5 User Flow

**Configure Workspace Defaults:**
1. Click workspace name in sidebar
2. Workspace Overview opens in main pane
3. Scroll to "Workspace Settings" section
4. Select desired Permission Mode from dropdown
5. Toggle tools on/off in Allowed Tools
6. Select Model from dropdown
7. Changes auto-save immediately

**Override in Conversation:**
1. Open any conversation
2. Use dropdowns in ConversationToolbar (chat header)
3. Changes apply to this conversation only
4. Workspace defaults unchanged

---

#### 4.6 Storage

Workspace settings are stored in two places:

**1. Central Config (`~/.chorus/config.json`):**
```json
{
  "workspaces": [
    {
      "id": "abc-123",
      "name": "my-project",
      "path": "/path/to/repo",
      "settings": {
        "permissionMode": "acceptEdits",
        "allowedTools": ["Edit", "Write", "Bash"],
        "model": "claude-opus-4-5-20250514"
      }
    }
  ]
}
```

**2. Conversation Index (`~/.chorus/sessions/{workspaceId}/{agentId}/conversations.json`):**
```json
{
  "conversations": [
    {
      "id": "conv-456",
      "settings": {
        "permissionMode": "default"  // Override for this conversation
      }
    }
  ]
}
```

---

#### 4.7 Implementation Details

**Components:**
- `WorkspaceSettings.tsx` - Settings UI in Workspace Overview
- `ConversationToolbar.tsx` - Per-conversation settings dropdowns

**Store Actions:**
```typescript
// workspace-store.ts
updateWorkspaceSettings(workspaceId: string, settings: WorkspaceSettings)

// chat-store.ts
updateConversationSettings(conversationId: string, settings: ConversationSettings)
```

**SDK Integration:**
Settings are passed to the Claude Agent SDK:
```typescript
const options = {
  permissionMode: resolvedSettings.permissionMode,
  allowedTools: resolvedSettings.allowedTools,
  model: resolvedSettings.model,
  // ...
}
```

---

## Data Model

```typescript
interface Workspace {
  id: string              // UUID
  name: string            // Repository name
  path: string            // Absolute path on disk
  gitBranch: string       // Current branch
  agents: Agent[]         // Discovered agents
  settings?: {            // Workspace defaults
    permissionMode?: PermissionMode
    allowedTools?: string[]
    model?: string
  }
}
```

---

## UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `WorkspacesPanel` | Sidebar | List all workspaces |
| `WorkspaceItem` | Sidebar | Single workspace row (collapsible) |
| `WorkspaceOverview` | MainPane | Workspace details when selected |
| `WorkspaceSettings` | MainPane | Default settings configuration |
| `AddWorkspaceDialog` | Dialog | Add/clone workspace |
| `SettingsDialog` | Dialog | Root directory config |

---

## Related Files

**Services:**
- `src/main/services/workspace-service.ts` - Workspace CRUD
- `src/main/services/git-service.ts` - Git operations

**Store:**
- `src/renderer/src/stores/workspace-store.ts` - State management
- `src/main/store/index.ts` - Persistence

**Components:**
- `src/renderer/src/components/Sidebar/WorkspacesPanel.tsx`
- `src/renderer/src/components/MainPane/WorkspaceOverview.tsx`
- `src/renderer/src/components/dialogs/AddWorkspaceDialog.tsx`
