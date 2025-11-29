import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// Import store
import {
  initStore,
  getSettings,
  setSettings,
  getWorkspaces,
  addWorkspace,
  removeWorkspace,
  updateWorkspace,
  getChorusDir,
  getWorkspaceSettings,
  setWorkspaceSettings,
  hasWorkspaceSettings,
  WorkspaceSettings,
  OpenTabsState
} from './store'

// Import services
import {
  validateGitRepo,
  discoverAgents,
  getWorkspaceInfo
} from './services/workspace-service'
import { listDirectory, readFile, writeFile, walkDirectory } from './services/fs-service'
import { isRepo, getStatus, getBranch, getLog, getLogForBranch, clone, cancelClone, listBranches, checkout } from './services/git-service'
import {
  listConversations,
  createConversation,
  loadConversation,
  deleteConversation,
  updateConversationSettings,
  ConversationSettings
} from './services/conversation-service'
import {
  sendMessage,
  stopAgent,
  isClaudeAvailable,
  getSessionId,
  clearSession,
  resolvePermission
} from './services/agent-service'

// Store reference to main window for IPC events
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#1a1d21',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 10 },
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for development or load file for production
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.chorus.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize store
  initStore()

  // ============================================
  // SETTINGS IPC HANDLERS
  // ============================================

  ipcMain.handle('settings:get', async () => {
    return { success: true, data: getSettings() }
  })

  ipcMain.handle(
    'settings:set',
    async (_event, settings: { rootWorkspaceDir?: string; theme?: 'dark' | 'light' }) => {
      setSettings(settings)
      return { success: true }
    }
  )

  ipcMain.handle('settings:get-root-dir', async () => {
    const settings = getSettings()
    return { success: true, data: settings.rootWorkspaceDir }
  })

  ipcMain.handle('settings:set-root-dir', async (_event, path: string) => {
    setSettings({ rootWorkspaceDir: path })
    return { success: true }
  })

  ipcMain.handle('settings:set-open-tabs', async (_event, openTabs: OpenTabsState) => {
    setSettings({ openTabs })
    return { success: true }
  })

  // ============================================
  // WORKSPACE IPC HANDLERS
  // ============================================

  ipcMain.handle('workspace:list', async () => {
    try {
      const workspaces = getWorkspaces()
      // Refresh git status but preserve agents from storage (they have workspaceId)
      const refreshedWorkspaces = await Promise.all(
        workspaces.map(async (ws) => {
          const info = await getWorkspaceInfo(ws.path)
          // Only update git info, preserve agents from storage
          return {
            ...ws,
            gitBranch: info.gitBranch,
            isDirty: info.isDirty,
            hasSystemPrompt: info.hasSystemPrompt
            // Note: agents are NOT overwritten - they come from storage with workspaceId
          }
        })
      )
      return { success: true, data: refreshedWorkspaces }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('workspace:add', async (_event, path: string) => {
    try {
      const isValid = await validateGitRepo(path)
      if (!isValid) {
        return { success: false, error: 'Not a valid git repository' }
      }
      const info = await getWorkspaceInfo(path)
      const workspace = addWorkspace(path, info)
      return { success: true, data: workspace }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('workspace:remove', async (_event, id: string) => {
    try {
      removeWorkspace(id)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('workspace:refresh', async (_event, id: string) => {
    try {
      const workspaces = getWorkspaces()
      const workspace = workspaces.find((ws) => ws.id === id)
      if (!workspace) {
        return { success: false, error: 'Workspace not found' }
      }
      const info = await getWorkspaceInfo(workspace.path)
      const updated = updateWorkspace(id, info)
      return { success: true, data: updated }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // ============================================
  // AGENT DISCOVERY IPC HANDLERS
  // ============================================

  ipcMain.handle('agents:discover', async (_event, repoPath: string) => {
    try {
      const agents = await discoverAgents(repoPath)
      return { success: true, data: agents }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // ============================================
  // FILE SYSTEM IPC HANDLERS
  // ============================================

  ipcMain.handle('fs:list-directory', async (_event, path: string) => {
    try {
      const entries = await listDirectory(path)
      return { success: true, data: entries }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('fs:read-file', async (_event, path: string) => {
    try {
      const content = await readFile(path)
      return { success: true, data: content }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('fs:write-file', async (_event, path: string, content: string) => {
    try {
      await writeFile(path, content)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('fs:walk-directory', async (_event, path: string, maxDepth?: number) => {
    try {
      const entries = await walkDirectory(path, maxDepth)
      return { success: true, data: entries }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // ============================================
  // DIALOG IPC HANDLERS
  // ============================================

  ipcMain.handle('dialog:select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled) {
      return { success: false, error: 'Cancelled' }
    }
    return { success: true, data: result.filePaths[0] }
  })

  // ============================================
  // GIT IPC HANDLERS
  // ============================================

  ipcMain.handle('git:is-repo', async (_event, path: string) => {
    try {
      const result = await isRepo(path)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:status', async (_event, path: string) => {
    try {
      const result = await getStatus(path)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:branch', async (_event, path: string) => {
    try {
      const result = await getBranch(path)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:log', async (_event, path: string, count = 10) => {
    try {
      const result = await getLog(path, count)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:log-branch', async (_event, path: string, branch: string, count = 10) => {
    try {
      const result = await getLogForBranch(path, branch, count)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:clone', async (_event, url: string, targetDir: string) => {
    try {
      await clone(url, targetDir, (progress) => {
        mainWindow?.webContents.send('git:clone-progress', progress)
      })
      mainWindow?.webContents.send('git:clone-complete', { success: true, targetDir })
      return { success: true }
    } catch (error) {
      mainWindow?.webContents.send('git:clone-complete', { success: false, error: String(error) })
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:cancel-clone', async () => {
    cancelClone()
    return { success: true }
  })

  ipcMain.handle('git:list-branches', async (_event, path: string) => {
    try {
      const result = await listBranches(path)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:checkout', async (_event, path: string, branch: string) => {
    try {
      await checkout(path, branch)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // ============================================
  // CONVERSATION IPC HANDLERS
  // ============================================

  ipcMain.handle('conversation:list', async (_event, workspaceId: string, agentId: string) => {
    try {
      const conversations = listConversations(workspaceId, agentId)
      return { success: true, data: conversations }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('conversation:create', async (_event, workspaceId: string, agentId: string) => {
    try {
      // Settings are now fetched from store by workspaceId inside createConversation
      const conversation = createConversation(workspaceId, agentId)
      return { success: true, data: conversation }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('conversation:load', async (_event, conversationId: string) => {
    try {
      const result = loadConversation(conversationId)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('conversation:delete', async (_event, conversationId: string) => {
    try {
      deleteConversation(conversationId)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('conversation:update-settings', async (_event, conversationId: string, settings: Partial<ConversationSettings>) => {
    try {
      const conversation = updateConversationSettings(conversationId, settings)
      if (!conversation) {
        return { success: false, error: 'Conversation not found' }
      }
      return { success: true, data: conversation }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('settings:get-chorus-dir', async () => {
    return { success: true, data: getChorusDir() }
  })

  // ============================================
  // AGENT IPC HANDLERS
  // ============================================

  ipcMain.handle(
    'agent:send',
    async (
      _event,
      conversationId: string,
      message: string,
      repoPath: string,
      _sessionId?: string,  // Deprecated: now loaded from backend conversation
      agentFilePath?: string
    ) => {
      try {
        if (!mainWindow) {
          return { success: false, error: 'Main window not available' }
        }
        // Extract agentId, sessionId, sessionCreatedAt, and settings from the conversation
        const { data } = await (async () => {
          const result = loadConversation(conversationId)
          return { data: result }
        })()

        const agentId = data?.conversation?.agentId || conversationId
        const sessionId = data?.conversation?.sessionId || null
        const sessionCreatedAt = data?.conversation?.sessionCreatedAt || null
        const settings = data?.conversation?.settings

        // Fire and forget - response comes via events
        sendMessage(
          conversationId,
          agentId,
          repoPath,
          message,
          sessionId,
          sessionCreatedAt,
          agentFilePath || null,
          mainWindow,
          settings
        )
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle('agent:stop', async (_event, agentId: string, conversationId?: string) => {
    try {
      stopAgent(agentId, conversationId)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Permission response handler for SDK canUseTool callback
  ipcMain.handle(
    'agent:respond-permission',
    async (
      _event,
      requestId: string,
      response: { approved: boolean; reason?: string; stopCompletely?: boolean }
    ) => {
      try {
        const resolved = resolvePermission(requestId, response)
        if (!resolved) {
          return { success: false, error: 'No pending permission request found' }
        }
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle('agent:check-available', async () => {
    try {
      const claudePath = isClaudeAvailable()
      return { success: true, data: claudePath }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('session:get', async (_event, agentId: string) => {
    try {
      const sessionId = getSessionId(agentId)
      return { success: true, data: sessionId }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('session:clear', async (_event, agentId: string) => {
    try {
      clearSession(agentId)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // ============================================
  // WORKSPACE SETTINGS IPC HANDLERS
  // ============================================

  ipcMain.handle('workspace-settings:get', async (_event, workspaceId: string) => {
    try {
      const settings = getWorkspaceSettings(workspaceId)
      return { success: true, data: settings }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('workspace-settings:set', async (_event, workspaceId: string, settings: Partial<WorkspaceSettings>) => {
    try {
      const updated = setWorkspaceSettings(workspaceId, settings)
      return { success: true, data: updated }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('workspace-settings:has', async (_event, workspaceId: string) => {
    try {
      const has = hasWorkspaceSettings(workspaceId)
      return { success: true, data: has }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
