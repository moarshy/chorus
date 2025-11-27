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
  updateWorkspace
} from './store'

// Import services
import {
  validateGitRepo,
  discoverAgents,
  getWorkspaceInfo
} from './services/workspace-service'
import { listDirectory, readFile } from './services/fs-service'
import { isRepo, getStatus, getBranch, getLog, clone, cancelClone } from './services/git-service'

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

  // ============================================
  // WORKSPACE IPC HANDLERS
  // ============================================

  ipcMain.handle('workspace:list', async () => {
    try {
      const workspaces = getWorkspaces()
      // Refresh workspace info for each workspace
      const refreshedWorkspaces = await Promise.all(
        workspaces.map(async (ws) => {
          const info = await getWorkspaceInfo(ws.path)
          return { ...ws, ...info }
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
