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
  OpenTabsState,
  getOpenAIApiKey,
  setOpenAIApiKey,
  getResearchOutputDirectory,
  setResearchOutputDirectory
} from './store'

// Import services
import {
  validateGitRepo,
  discoverAgents,
  getWorkspaceInfo
} from './services/workspace-service'
import {
  discoverCommands,
  executeCommand
} from './services/slash-command-service'
import { listDirectory, readFile, writeFile, walkDirectory, deleteFile, renameFile, createFile, createDirectory, pathExists } from './services/fs-service'
import {
  isRepo,
  getStatus,
  getDetailedStatus,
  getBranch,
  getLog,
  getLogForBranch,
  getLogForBranchOnly,
  getDefaultBranch,
  clone,
  cancelClone,
  listBranches,
  checkout,
  createBranch,
  stageAll,
  commit,
  getStructuredDiff,
  getStructuredDiffBetweenBranches,
  merge,
  deleteBranch,
  branchExists,
  getAgentBranches,
  stash,
  stashPop,
  push,
  discardChanges,
  stageFile,
  unstageFile,
  unstageAll,
  discardAll,
  getFileDiff,
  getStagedFileDiff,
  getBranchSyncStatus,
  pushSetUpstream,
  pull,
  pullRebase,
  fetchAll,
  analyzeMerge,
  // Worktree functions (Sprint 16)
  listWorktrees,
  createWorktree,
  removeWorktree,
  pruneWorktrees,
  getWorktreeStatus,
  isWorktree as isWorktreeFn
} from './services/git-service'
import {
  listConversations,
  createConversation,
  loadConversation,
  deleteConversation,
  updateConversationSettings,
  ConversationSettings,
  getConversationBranchName,
  deleteConversationsByBranch
} from './services/conversation-service'
import {
  sendMessage,
  stopAgent,
  isClaudeAvailable,
  getSessionId,
  clearSession,
  resolvePermission
} from './services/agent-service'
import { validateOpenAIApiKey } from './services/openai-research-service'

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
  // OPENAI SETTINGS IPC HANDLERS
  // ============================================

  ipcMain.handle('openai:get-api-key', async () => {
    return { success: true, data: getOpenAIApiKey() }
  })

  ipcMain.handle('openai:set-api-key', async (_event, key: string) => {
    console.log('[OpenAI] Setting API key, length:', key?.length)
    setOpenAIApiKey(key)
    // Verify it was saved
    const saved = getOpenAIApiKey()
    console.log('[OpenAI] Verified saved key length:', saved?.length)
    return { success: true, data: { valid: true } }
  })

  ipcMain.handle('openai:validate-api-key', async (_event, key: string) => {
    try {
      const isValid = await validateOpenAIApiKey(key)
      return { success: true, data: isValid }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('openai:get-research-output-dir', async () => {
    return { success: true, data: getResearchOutputDirectory() }
  })

  ipcMain.handle('openai:set-research-output-dir', async (_event, dir: string) => {
    setResearchOutputDirectory(dir)
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
  // SLASH COMMAND IPC HANDLERS
  // ============================================

  ipcMain.handle('commands:discover', async (_event, workspaceId: string) => {
    try {
      const workspace = getWorkspaces().find(w => w.id === workspaceId)
      if (!workspace) {
        return { success: false, error: 'Workspace not found' }
      }
      const commands = await discoverCommands(workspace.path)
      return { success: true, data: commands }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('commands:execute', async (_event, workspaceId: string, commandName: string, args: string) => {
    try {
      const workspace = getWorkspaces().find(w => w.id === workspaceId)
      if (!workspace) {
        return { success: false, error: 'Workspace not found' }
      }
      const result = await executeCommand(workspace.path, commandName, args)
      if (result.success) {
        return { success: true, data: result.prompt }
      } else {
        return { success: false, error: result.error }
      }
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

  ipcMain.handle('fs:delete', async (_event, path: string) => {
    try {
      await deleteFile(path)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('fs:rename', async (_event, oldPath: string, newPath: string) => {
    try {
      await renameFile(oldPath, newPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('fs:create-file', async (_event, path: string, content?: string) => {
    try {
      await createFile(path, content || '')
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('fs:create-directory', async (_event, path: string) => {
    try {
      await createDirectory(path)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('fs:exists', async (_event, path: string) => {
    try {
      const exists = await pathExists(path)
      return { success: true, data: exists }
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

  ipcMain.handle('git:log-branch-only', async (_event, path: string, branch: string, baseBranch: string, count = 50) => {
    try {
      const result = await getLogForBranchOnly(path, branch, baseBranch, count)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:get-default-branch', async (_event, path: string) => {
    try {
      const result = await getDefaultBranch(path)
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

  ipcMain.handle('git:checkout', async (_event, path: string, branch: string, isRemote?: boolean) => {
    try {
      await checkout(path, branch, isRemote ?? false)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:create-branch', async (_event, path: string, branchName: string) => {
    try {
      await createBranch(path, branchName)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:commit', async (_event, path: string, message: string) => {
    try {
      await stageAll(path)
      const hash = await commit(path, message)
      return { success: true, data: hash }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:get-diff', async (_event, path: string, commitHash?: string) => {
    try {
      const diff = await getStructuredDiff(path, commitHash)
      return { success: true, data: diff }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(
    'git:get-diff-between-branches',
    async (_event, path: string, baseBranch: string, targetBranch: string) => {
      try {
        const diff = await getStructuredDiffBetweenBranches(path, baseBranch, targetBranch)
        return { success: true, data: diff }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle('git:merge', async (_event, path: string, sourceBranch: string, options?: { squash?: boolean }) => {
    try {
      await merge(path, sourceBranch, options)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // E-3: Merge analysis for preview dialog
  ipcMain.handle(
    'git:analyze-merge',
    async (_event, path: string, sourceBranch: string, targetBranch: string) => {
      try {
        const analysis = await analyzeMerge(path, sourceBranch, targetBranch)
        return { success: true, data: analysis }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle('git:delete-branch', async (_event, path: string, branchName: string, force?: boolean, workspaceId?: string) => {
    try {
      const result = await deleteBranch(path, branchName, force)

      if (!result.deleted) {
        return { success: false, error: result.reason || 'Could not delete branch' }
      }

      // Cascade delete: also delete conversations associated with this branch
      if (workspaceId && branchName.startsWith('agent/')) {
        const deletedConversations = deleteConversationsByBranch(workspaceId, branchName)
        if (deletedConversations.length > 0) {
          console.log(`[Git] Cascade deleted ${deletedConversations.length} conversation(s) for branch ${branchName}`)
          // Notify renderer about deleted conversations
          mainWindow?.webContents.send('conversations:deleted', {
            conversationIds: deletedConversations,
            reason: 'branch-deleted'
          })
        }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:branch-exists', async (_event, path: string, branchName: string) => {
    try {
      const exists = await branchExists(path, branchName)
      return { success: true, data: exists }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:get-agent-branches', async (_event, path: string) => {
    try {
      const branches = await getAgentBranches(path)
      return { success: true, data: branches }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:stash', async (_event, path: string, message?: string) => {
    try {
      await stash(path, message)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:stash-pop', async (_event, path: string) => {
    try {
      await stashPop(path)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(
    'git:push',
    async (
      _event,
      path: string,
      branchName?: string,
      options?: { setUpstream?: boolean; force?: boolean }
    ) => {
      try {
        await push(path, branchName, options)
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle('git:discard-changes', async (_event, repoPath: string, filePath: string) => {
    try {
      await discardChanges(repoPath, filePath)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:stage-file', async (_event, repoPath: string, filePath: string) => {
    try {
      await stageFile(repoPath, filePath)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:unstage-file', async (_event, repoPath: string, filePath: string) => {
    try {
      await unstageFile(repoPath, filePath)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:detailed-status', async (_event, path: string) => {
    try {
      const status = await getDetailedStatus(path)
      return { success: true, data: status }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:stage-all', async (_event, path: string) => {
    try {
      await stageAll(path)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:unstage-all', async (_event, path: string) => {
    try {
      await unstageAll(path)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:discard-all', async (_event, path: string) => {
    try {
      await discardAll(path)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:file-diff', async (_event, repoPath: string, filePath: string, staged: boolean) => {
    try {
      const diff = staged
        ? await getStagedFileDiff(repoPath, filePath)
        : await getFileDiff(repoPath, filePath)
      return { success: true, data: diff }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Get changed files for @ mention suggestions
  ipcMain.handle('git:get-changed-files', async (_event, repoPath: string) => {
    try {
      const status = await getStatus(repoPath)
      const changedFiles = status.changes.map((change) => ({
        path: change.file,
        status: change.status as 'M' | 'A' | 'D' | '?'
      }))
      return { success: true, data: changedFiles }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Remote sync operations
  ipcMain.handle('git:sync-status', async (_event, path: string) => {
    try {
      const status = await getBranchSyncStatus(path)
      return { success: true, data: status }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(
    'git:push-set-upstream',
    async (_event, path: string, remote: string, branch: string) => {
      try {
        await pushSetUpstream(path, remote, branch)
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle('git:pull', async (_event, path: string) => {
    try {
      await pull(path)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:pull-rebase', async (_event, path: string) => {
    try {
      await pullRebase(path)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:fetch', async (_event, path: string) => {
    try {
      await fetchAll(path)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // ============================================
  // WORKTREE IPC HANDLERS (Sprint 16)
  // ============================================

  ipcMain.handle('git:list-worktrees', async (_event, repoPath: string) => {
    try {
      const worktrees = await listWorktrees(repoPath)
      return { success: true, data: worktrees }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(
    'git:create-worktree',
    async (_event, repoPath: string, worktreePath: string, branch: string, baseBranch?: string) => {
      try {
        await createWorktree(repoPath, worktreePath, branch, baseBranch)
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(
    'git:remove-worktree',
    async (_event, repoPath: string, worktreePath: string, force?: boolean) => {
      try {
        await removeWorktree(repoPath, worktreePath, force)
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle('git:prune-worktrees', async (_event, repoPath: string) => {
    try {
      await pruneWorktrees(repoPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:get-worktree-status', async (_event, worktreePath: string) => {
    try {
      const status = await getWorktreeStatus(worktreePath)
      return { success: true, data: status }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('git:is-worktree', async (_event, path: string) => {
    try {
      const result = await isWorktreeFn(path)
      return { success: true, data: result }
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

  ipcMain.handle('conversation:delete', async (_event, conversationId: string, repoPath?: string) => {
    try {
      // Get the branchName before deleting (for cascade delete)
      const branchName = getConversationBranchName(conversationId)

      // Delete the conversation
      deleteConversation(conversationId)

      // Cascade delete: also delete the branch if it exists
      if (branchName && repoPath) {
        const result = await deleteBranch(repoPath, branchName, true)
        if (result.deleted) {
          console.log(`[Conversation] Cascade deleted branch ${branchName}`)
        } else {
          // Branch might be checked out in another worktree - that's okay
          console.log(`[Conversation] Skipped branch deletion: ${result.reason}`)
        }
      }

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
        const workspaceId = data?.conversation?.workspaceId

        // Get workspace git settings if workspaceId is available
        const gitSettings = workspaceId ? getWorkspaceSettings(workspaceId).git : undefined

        // Find the agent type from the workspace
        let agentType: 'claude' | 'openai-research' | undefined
        if (workspaceId) {
          const workspace = getWorkspaces().find((ws) => ws.id === workspaceId)
          const agent = workspace?.agents.find((a) => a.id === agentId)
          agentType = agent?.type
        }

        // Fire and forget - response comes via events
        sendMessage(
          conversationId,
          agentId,
          workspaceId || '',
          repoPath,
          message,
          sessionId,
          sessionCreatedAt,
          agentFilePath || null,
          mainWindow,
          settings,
          gitSettings,
          agentType
        )
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle('agent:stop', async (_event, agentId: string, conversationId?: string) => {
    try {
      // Find the agent type from the conversation
      let agentType: 'claude' | 'openai-research' | undefined
      if (conversationId) {
        const { conversation } = loadConversation(conversationId)
        if (conversation?.workspaceId) {
          const workspace = getWorkspaces().find((ws) => ws.id === conversation.workspaceId)
          const agent = workspace?.agents.find((a) => a.id === agentId)
          agentType = agent?.type
        }
      }
      stopAgent(agentId, conversationId, agentType)
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
