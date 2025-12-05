import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Types for streaming events
interface AgentStreamDelta {
  conversationId: string
  delta: string
}

interface AgentMessageEvent {
  conversationId: string
  message: unknown
}

interface AgentStatusEvent {
  agentId: string
  status: 'ready' | 'busy' | 'error'
  error?: string
}

interface AgentSessionUpdateEvent {
  conversationId: string
  sessionId: string
  sessionCreatedAt: string
}

// Permission request event from SDK canUseTool callback
interface PermissionRequestEvent {
  requestId: string
  conversationId: string
  toolName: string
  toolInput: Record<string, unknown>
}

// File change event from SDK PostToolUse hook
interface FileChangedEvent {
  conversationId: string
  filePath: string
  toolName: string
}

// Todo item from TodoWrite tool
interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm: string
}

// Todo update event from TodoWrite tool interception
interface TodoUpdateEvent {
  conversationId: string
  todos: TodoItem[]
  timestamp: string
}

// Git branch created event (from auto-branch)
interface GitBranchCreatedEvent {
  conversationId: string
  branchName: string
  agentName: string
}

// Git commit created event (from auto-commit)
interface GitCommitCreatedEvent {
  conversationId: string
  branchName: string
  commitHash: string
  message: string
  files: string[]
  type: 'turn' | 'stop'
}

// Conversations deleted event (from branch cascade deletion)
interface ConversationsDeletedEvent {
  conversationIds: string[]
  reason: 'branch-deleted'
}

// Research-specific events
interface ResearchSearchEvent {
  conversationId: string
  query: string
}

interface ResearchCompleteEvent {
  conversationId: string
  outputPath: string
  text: string
}

interface ResearchErrorEvent {
  conversationId: string
  error: string
}

// Custom APIs for renderer - these are the ONLY APIs renderer can access
const api = {
  // Settings operations
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings: { rootWorkspaceDir?: string; theme?: 'dark' | 'light'; chatSidebarCollapsed?: boolean; chatSidebarWidth?: number }) =>
      ipcRenderer.invoke('settings:set', settings),
    getRootDir: () => ipcRenderer.invoke('settings:get-root-dir'),
    setRootDir: (path: string) => ipcRenderer.invoke('settings:set-root-dir', path),
    setOpenTabs: (openTabs: { tabs: unknown[]; activeTabId: string | null }) =>
      ipcRenderer.invoke('settings:set-open-tabs', openTabs),
    getChorusDir: () => ipcRenderer.invoke('settings:get-chorus-dir')
  },

  // Workspace operations
  workspace: {
    list: () => ipcRenderer.invoke('workspace:list'),
    add: (path: string) => ipcRenderer.invoke('workspace:add', path),
    remove: (id: string) => ipcRenderer.invoke('workspace:remove', id),
    refresh: (id: string) => ipcRenderer.invoke('workspace:refresh', id),
    toggleExpanded: (id: string) => ipcRenderer.invoke('workspace:toggleExpanded', id)
  },

  // Agent operations
  agents: {
    discover: (repoPath: string) => ipcRenderer.invoke('agents:discover', repoPath)
  },

  // File system operations
  fs: {
    listDirectory: (path: string) => ipcRenderer.invoke('fs:list-directory', path),
    readFile: (path: string) => ipcRenderer.invoke('fs:read-file', path),
    writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:write-file', path, content),
    walkDirectory: (path: string, maxDepth?: number) => ipcRenderer.invoke('fs:walk-directory', path, maxDepth),
    delete: (path: string) => ipcRenderer.invoke('fs:delete', path),
    rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
    createFile: (path: string, content?: string) => ipcRenderer.invoke('fs:create-file', path, content),
    createDirectory: (path: string) => ipcRenderer.invoke('fs:create-directory', path),
    exists: (path: string) => ipcRenderer.invoke('fs:exists', path)
  },

  // Dialog operations
  dialog: {
    selectDirectory: () => ipcRenderer.invoke('dialog:select-directory')
  },

  // Git operations
  git: {
    isRepo: (path: string) => ipcRenderer.invoke('git:is-repo', path),
    status: (path: string) => ipcRenderer.invoke('git:status', path),
    branch: (path: string) => ipcRenderer.invoke('git:branch', path),
    listBranches: (path: string) => ipcRenderer.invoke('git:list-branches', path),
    checkout: (path: string, branch: string, isRemote?: boolean) => ipcRenderer.invoke('git:checkout', path, branch, isRemote),
    log: (path: string, count?: number) => ipcRenderer.invoke('git:log', path, count),
    logForBranch: (path: string, branch: string, count?: number) => ipcRenderer.invoke('git:log-branch', path, branch, count),
    logForBranchOnly: (path: string, branch: string, baseBranch: string, count?: number) => ipcRenderer.invoke('git:log-branch-only', path, branch, baseBranch, count),
    getDefaultBranch: (path: string) => ipcRenderer.invoke('git:get-default-branch', path),
    clone: (url: string, targetDir: string) => ipcRenderer.invoke('git:clone', url, targetDir),
    cancelClone: () => ipcRenderer.invoke('git:cancel-clone'),

    // New automated git operations
    createBranch: (path: string, branchName: string) =>
      ipcRenderer.invoke('git:create-branch', path, branchName),
    commit: (path: string, message: string) =>
      ipcRenderer.invoke('git:commit', path, message),
    getDiff: (path: string, commitHash?: string) =>
      ipcRenderer.invoke('git:get-diff', path, commitHash),
    getDiffBetweenBranches: (path: string, baseBranch: string, targetBranch: string) =>
      ipcRenderer.invoke('git:get-diff-between-branches', path, baseBranch, targetBranch),
    merge: (path: string, sourceBranch: string, options?: { squash?: boolean }) =>
      ipcRenderer.invoke('git:merge', path, sourceBranch, options),
    analyzeMerge: (path: string, sourceBranch: string, targetBranch: string) =>
      ipcRenderer.invoke('git:analyze-merge', path, sourceBranch, targetBranch),
    deleteBranch: (path: string, branchName: string, force?: boolean, workspaceId?: string) =>
      ipcRenderer.invoke('git:delete-branch', path, branchName, force, workspaceId),
    branchExists: (path: string, branchName: string) =>
      ipcRenderer.invoke('git:branch-exists', path, branchName),
    getAgentBranches: (path: string) =>
      ipcRenderer.invoke('git:get-agent-branches', path),
    stash: (path: string, message?: string) =>
      ipcRenderer.invoke('git:stash', path, message),
    stashPop: (path: string) =>
      ipcRenderer.invoke('git:stash-pop', path),
    push: (path: string, branchName?: string, options?: { setUpstream?: boolean; force?: boolean }) =>
      ipcRenderer.invoke('git:push', path, branchName, options),

    // File-level git operations (like GitLens)
    discardChanges: (repoPath: string, filePath: string) =>
      ipcRenderer.invoke('git:discard-changes', repoPath, filePath),
    stageFile: (repoPath: string, filePath: string) =>
      ipcRenderer.invoke('git:stage-file', repoPath, filePath),
    unstageFile: (repoPath: string, filePath: string) =>
      ipcRenderer.invoke('git:unstage-file', repoPath, filePath),

    // Enhanced git operations for staging workflow
    detailedStatus: (path: string) =>
      ipcRenderer.invoke('git:detailed-status', path),
    stageAll: (path: string) =>
      ipcRenderer.invoke('git:stage-all', path),
    unstageAll: (path: string) =>
      ipcRenderer.invoke('git:unstage-all', path),
    discardAll: (path: string) =>
      ipcRenderer.invoke('git:discard-all', path),
    fileDiff: (repoPath: string, filePath: string, staged: boolean) =>
      ipcRenderer.invoke('git:file-diff', repoPath, filePath, staged),

    // Remote sync operations
    syncStatus: (path: string) => ipcRenderer.invoke('git:sync-status', path),
    pushSetUpstream: (path: string, remote: string, branch: string) =>
      ipcRenderer.invoke('git:push-set-upstream', path, remote, branch),
    pull: (path: string) => ipcRenderer.invoke('git:pull', path),
    pullRebase: (path: string) => ipcRenderer.invoke('git:pull-rebase', path),
    fetch: (path: string) => ipcRenderer.invoke('git:fetch', path),

    // Get changed files for @ mention suggestions
    getChangedFiles: (path: string) => ipcRenderer.invoke('git:get-changed-files', path),

    // Clone progress events
    onCloneProgress: (callback: (progress: CloneProgress) => void) => {
      const handler = (_event: unknown, progress: CloneProgress) => callback(progress)
      ipcRenderer.on('git:clone-progress', handler)
      return () => ipcRenderer.removeListener('git:clone-progress', handler)
    },
    onCloneComplete: (callback: (result: CloneResult) => void) => {
      const handler = (_event: unknown, result: CloneResult) => callback(result)
      ipcRenderer.on('git:clone-complete', handler)
      return () => ipcRenderer.removeListener('git:clone-complete', handler)
    },

    // Git commit events (from agent auto-commits)
    onBranchCreated: (callback: (event: GitBranchCreatedEvent) => void) => {
      const handler = (_event: unknown, data: GitBranchCreatedEvent) => callback(data)
      ipcRenderer.on('git:branch-created', handler)
      return () => ipcRenderer.removeListener('git:branch-created', handler)
    },
    onCommitCreated: (callback: (event: GitCommitCreatedEvent) => void) => {
      const handler = (_event: unknown, data: GitCommitCreatedEvent) => callback(data)
      ipcRenderer.on('git:commit-created', handler)
      return () => ipcRenderer.removeListener('git:commit-created', handler)
    },

    // Worktree management (Sprint 16)
    listWorktrees: (repoPath: string) =>
      ipcRenderer.invoke('git:list-worktrees', repoPath),
    createWorktree: (repoPath: string, worktreePath: string, branch: string, baseBranch?: string) =>
      ipcRenderer.invoke('git:create-worktree', repoPath, worktreePath, branch, baseBranch),
    removeWorktree: (repoPath: string, worktreePath: string, force?: boolean) =>
      ipcRenderer.invoke('git:remove-worktree', repoPath, worktreePath, force),
    pruneWorktrees: (repoPath: string) =>
      ipcRenderer.invoke('git:prune-worktrees', repoPath),
    getWorktreeStatus: (worktreePath: string) =>
      ipcRenderer.invoke('git:get-worktree-status', worktreePath),
    isWorktree: (path: string) =>
      ipcRenderer.invoke('git:is-worktree', path),

    // Create Workspace (Sprint 17)
    checkGhCli: () => ipcRenderer.invoke('git:check-gh-cli'),
    createRepo: (name: string, options: { description?: string; isPrivate: boolean }) =>
      ipcRenderer.invoke('git:create-repo', name, options),
    initializeWorkspace: (repoPath: string) =>
      ipcRenderer.invoke('git:initialize-workspace', repoPath)
  },

  // Conversation operations
  conversation: {
    list: (workspaceId: string, agentId: string) =>
      ipcRenderer.invoke('conversation:list', workspaceId, agentId),
    create: (workspaceId: string, agentId: string) =>
      ipcRenderer.invoke('conversation:create', workspaceId, agentId),
    load: (conversationId: string) =>
      ipcRenderer.invoke('conversation:load', conversationId),
    delete: (conversationId: string, repoPath?: string) =>
      ipcRenderer.invoke('conversation:delete', conversationId, repoPath),
    updateSettings: (conversationId: string, settings: { permissionMode?: string; allowedTools?: string[]; model?: string }) =>
      ipcRenderer.invoke('conversation:update-settings', conversationId, settings),
    // Event: conversations cascade-deleted when branch was deleted
    onDeleted: (callback: (event: ConversationsDeletedEvent) => void) => {
      const handler = (_event: unknown, data: ConversationsDeletedEvent) => callback(data)
      ipcRenderer.on('conversations:deleted', handler)
      return () => ipcRenderer.removeListener('conversations:deleted', handler)
    }
  },

  // Agent operations (for Claude CLI/SDK communication)
  agent: {
    send: (
      conversationId: string,
      message: string,
      repoPath: string,
      sessionId?: string,
      agentFilePath?: string
    ) =>
      ipcRenderer.invoke('agent:send', conversationId, message, repoPath, sessionId, agentFilePath),
    stop: (agentId: string, conversationId?: string) =>
      ipcRenderer.invoke('agent:stop', agentId, conversationId),
    checkAvailable: () =>
      ipcRenderer.invoke('agent:check-available'),

    // Permission response (for SDK canUseTool callback)
    respondPermission: (
      requestId: string,
      response: { approved: boolean; reason?: string; stopCompletely?: boolean }
    ) =>
      ipcRenderer.invoke('agent:respond-permission', requestId, response),

    // Event listeners with cleanup
    onStreamDelta: (callback: (event: AgentStreamDelta) => void) => {
      const handler = (_event: unknown, data: AgentStreamDelta) => callback(data)
      ipcRenderer.on('agent:stream-delta', handler)
      return () => ipcRenderer.removeListener('agent:stream-delta', handler)
    },
    onStreamClear: (callback: (event: { conversationId: string }) => void) => {
      const handler = (_event: unknown, data: { conversationId: string }) => callback(data)
      ipcRenderer.on('agent:stream-clear', handler)
      return () => ipcRenderer.removeListener('agent:stream-clear', handler)
    },
    onMessage: (callback: (event: AgentMessageEvent) => void) => {
      const handler = (_event: unknown, data: AgentMessageEvent) => callback(data)
      ipcRenderer.on('agent:message', handler)
      return () => ipcRenderer.removeListener('agent:message', handler)
    },
    onStatus: (callback: (event: AgentStatusEvent) => void) => {
      const handler = (_event: unknown, data: AgentStatusEvent) => callback(data)
      ipcRenderer.on('agent:status', handler)
      return () => ipcRenderer.removeListener('agent:status', handler)
    },
    onSessionUpdate: (callback: (event: AgentSessionUpdateEvent) => void) => {
      const handler = (_event: unknown, data: AgentSessionUpdateEvent) => callback(data)
      ipcRenderer.on('agent:session-update', handler)
      return () => ipcRenderer.removeListener('agent:session-update', handler)
    },
    // Permission request event (SDK only)
    onPermissionRequest: (callback: (event: PermissionRequestEvent) => void) => {
      const handler = (_event: unknown, data: PermissionRequestEvent) => callback(data)
      ipcRenderer.on('permission:request', handler)
      return () => ipcRenderer.removeListener('permission:request', handler)
    },
    // File change event (SDK only)
    onFileChanged: (callback: (event: FileChangedEvent) => void) => {
      const handler = (_event: unknown, data: FileChangedEvent) => callback(data)
      ipcRenderer.on('agent:file-changed', handler)
      return () => ipcRenderer.removeListener('agent:file-changed', handler)
    },
    // Todo update event (SDK only - from TodoWrite tool)
    onTodoUpdate: (callback: (event: TodoUpdateEvent) => void) => {
      const handler = (_event: unknown, data: TodoUpdateEvent) => callback(data)
      ipcRenderer.on('agent:todo-update', handler)
      return () => ipcRenderer.removeListener('agent:todo-update', handler)
    }
  },

  // Session operations
  session: {
    get: (agentId: string) =>
      ipcRenderer.invoke('session:get', agentId),
    clear: (agentId: string) =>
      ipcRenderer.invoke('session:clear', agentId)
  },

  // Workspace settings operations (uses workspaceId, stored in central config.json)
  workspaceSettings: {
    get: (workspaceId: string) =>
      ipcRenderer.invoke('workspace-settings:get', workspaceId),
    set: (workspaceId: string, settings: { defaultPermissionMode?: string; defaultAllowedTools?: string[]; defaultModel?: string }) =>
      ipcRenderer.invoke('workspace-settings:set', workspaceId, settings),
    has: (workspaceId: string) =>
      ipcRenderer.invoke('workspace-settings:has', workspaceId)
  },

  // Slash commands operations
  commands: {
    discover: (workspaceId: string) =>
      ipcRenderer.invoke('commands:discover', workspaceId),
    execute: (workspaceId: string, commandName: string, args: string) =>
      ipcRenderer.invoke('commands:execute', workspaceId, commandName, args)
  },

  // OpenAI settings operations
  openai: {
    getApiKey: () => ipcRenderer.invoke('openai:get-api-key'),
    setApiKey: (key: string) => ipcRenderer.invoke('openai:set-api-key', key),
    validateApiKey: (key: string) => ipcRenderer.invoke('openai:validate-api-key', key),
    getResearchOutputDir: () => ipcRenderer.invoke('openai:get-research-output-dir'),
    setResearchOutputDir: (dir: string) => ipcRenderer.invoke('openai:set-research-output-dir', dir)
  },

  // Research events (for OpenAI Deep Research agent)
  research: {
    onSearch: (callback: (event: ResearchSearchEvent) => void) => {
      const handler = (_event: unknown, data: ResearchSearchEvent) => callback(data)
      ipcRenderer.on('research:search', handler)
      return () => ipcRenderer.removeListener('research:search', handler)
    },
    onComplete: (callback: (event: ResearchCompleteEvent) => void) => {
      const handler = (_event: unknown, data: ResearchCompleteEvent) => callback(data)
      ipcRenderer.on('research:complete', handler)
      return () => ipcRenderer.removeListener('research:complete', handler)
    },
    onError: (callback: (event: ResearchErrorEvent) => void) => {
      const handler = (_event: unknown, data: ResearchErrorEvent) => callback(data)
      ipcRenderer.on('research:error', handler)
      return () => ipcRenderer.removeListener('research:error', handler)
    }
  }
}

// Types for clone events
interface CloneProgress {
  phase: string
  percent: number
  message: string
}

interface CloneResult {
  success: boolean
  targetDir?: string
  error?: string
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
