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
    refresh: (id: string) => ipcRenderer.invoke('workspace:refresh', id)
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
    walkDirectory: (path: string, maxDepth?: number) => ipcRenderer.invoke('fs:walk-directory', path, maxDepth)
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
    checkout: (path: string, branch: string) => ipcRenderer.invoke('git:checkout', path, branch),
    log: (path: string, count?: number) => ipcRenderer.invoke('git:log', path, count),
    logForBranch: (path: string, branch: string, count?: number) => ipcRenderer.invoke('git:log-branch', path, branch, count),
    clone: (url: string, targetDir: string) => ipcRenderer.invoke('git:clone', url, targetDir),
    cancelClone: () => ipcRenderer.invoke('git:cancel-clone'),

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
    }
  },

  // Conversation operations
  conversation: {
    list: (workspaceId: string, agentId: string) =>
      ipcRenderer.invoke('conversation:list', workspaceId, agentId),
    create: (workspaceId: string, agentId: string) =>
      ipcRenderer.invoke('conversation:create', workspaceId, agentId),
    load: (conversationId: string) =>
      ipcRenderer.invoke('conversation:load', conversationId),
    delete: (conversationId: string) =>
      ipcRenderer.invoke('conversation:delete', conversationId),
    updateSettings: (conversationId: string, settings: { permissionMode?: string; allowedTools?: string[]; model?: string }) =>
      ipcRenderer.invoke('conversation:update-settings', conversationId, settings)
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
