import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { sendToAgent, stopAgent, clearAgentSession } from './agent-service'
import {
  getAgents,
  addAgent,
  removeAgent,
  getMessages,
  addMessage,
  clearMessages,
  getSessionId,
  setSessionId,
  clearSessionId,
  type StoredAgent,
  type StoredMessage
} from './store'

// Store reference to main window for IPC
let mainWindow: BrowserWindow | null = null

// Helper to run git commands
function runGit(cwd: string, args: string): { success: boolean; output?: string; error?: string } {
  try {
    const output = execSync(`git ${args}`, { cwd, encoding: 'utf-8', timeout: 10000 })
    return { success: true, output: output.trim() }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // ============================================
  // IPC HANDLERS (Module 2: IPC Communication)
  // ============================================

  // Pattern 1: invoke/handle - Read a file
  ipcMain.handle('read-file', async (_event, filePath: string) => {
    try {
      const content = readFileSync(filePath, 'utf-8')
      return { success: true, content }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Pattern 1: invoke/handle - List directory contents
  ipcMain.handle('list-directory', async (_event, dirPath: string) => {
    try {
      const entries = readdirSync(dirPath).map((name) => {
        const fullPath = join(dirPath, name)
        const stats = statSync(fullPath)
        return {
          name,
          path: fullPath,
          isDirectory: stats.isDirectory()
        }
      })
      return { success: true, entries }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Pattern 1: invoke/handle - Open file dialog
  ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Text Files', extensions: ['txt', 'md', 'json', 'ts', 'tsx', 'js'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled) {
      return { success: false, error: 'Cancelled' }
    }
    return { success: true, filePath: result.filePaths[0] }
  })

  // Pattern 1: invoke/handle - Open directory dialog
  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (result.canceled) {
      return { success: false, error: 'Cancelled' }
    }
    return { success: true, dirPath: result.filePaths[0] }
  })

  // ============================================
  // GIT HANDLERS (Module 4: File System & Git)
  // ============================================

  // Check if directory is a git repo
  ipcMain.handle('git-is-repo', async (_event, repoPath: string) => {
    const gitDir = join(repoPath, '.git')
    return { success: true, isRepo: existsSync(gitDir) }
  })

  // Get git status
  ipcMain.handle('git-status', async (_event, repoPath: string) => {
    const result = runGit(repoPath, 'status --porcelain')
    if (!result.success) return result

    // Parse status output
    const files = (result.output || '').split('\n').filter(Boolean).map((line) => {
      const status = line.substring(0, 2)
      const file = line.substring(3)
      return { status, file }
    })

    return { success: true, files, hasChanges: files.length > 0 }
  })

  // Get git log (recent commits)
  ipcMain.handle('git-log', async (_event, repoPath: string, count = 10) => {
    const result = runGit(repoPath, `log --oneline -n ${count}`)
    if (!result.success) return result

    const commits = (result.output || '').split('\n').filter(Boolean).map((line) => {
      const [hash, ...messageParts] = line.split(' ')
      return { hash, message: messageParts.join(' ') }
    })

    return { success: true, commits }
  })

  // Get current branch
  ipcMain.handle('git-branch', async (_event, repoPath: string) => {
    const result = runGit(repoPath, 'branch --show-current')
    return result.success
      ? { success: true, branch: result.output }
      : result
  })

  // Check for CLAUDE.md (agent config)
  ipcMain.handle('check-claude-config', async (_event, repoPath: string) => {
    const claudeMdPath = join(repoPath, 'CLAUDE.md')
    const claudeDir = join(repoPath, '.claude')

    return {
      success: true,
      hasClaudeMd: existsSync(claudeMdPath),
      hasClaudeDir: existsSync(claudeDir),
      claudeMdPath,
      claudeDir
    }
  })

  // ============================================
  // AGENT HANDLERS (Module 5: Claude Agent SDK)
  // ============================================

  // Send message to agent
  ipcMain.handle(
    'send-to-agent',
    async (_event, agentId: string, repoPath: string, message: string) => {
      console.log('[IPC] send-to-agent received:', { agentId, repoPath, message: message?.substring(0, 50) })
      if (mainWindow) {
        await sendToAgent(agentId, repoPath, message, mainWindow)
        return { success: true }
      }
      console.log('[IPC] No mainWindow available!')
      return { success: false, error: 'No window available' }
    }
  )

  // Stop agent's current operation
  ipcMain.handle('stop-agent', async (_event, agentId: string) => {
    stopAgent(agentId)
    return { success: true }
  })

  // Clear agent session (start fresh)
  ipcMain.handle('clear-agent-session', async (_event, agentId: string) => {
    clearAgentSession(agentId)
    return { success: true }
  })

  // ============================================
  // STORE HANDLERS (Module 7: State Management)
  // ============================================

  // Get all agents
  ipcMain.handle('store-get-agents', async () => {
    return { success: true, agents: getAgents() }
  })

  // Add an agent
  ipcMain.handle('store-add-agent', async (_event, agent: StoredAgent) => {
    addAgent(agent)
    return { success: true }
  })

  // Remove an agent
  ipcMain.handle('store-remove-agent', async (_event, agentId: string) => {
    removeAgent(agentId)
    return { success: true }
  })

  // Get messages for an agent
  ipcMain.handle('store-get-messages', async (_event, agentId: string) => {
    return { success: true, messages: getMessages(agentId) }
  })

  // Add a message
  ipcMain.handle('store-add-message', async (_event, agentId: string, message: StoredMessage) => {
    addMessage(agentId, message)
    return { success: true }
  })

  // Clear messages for an agent
  ipcMain.handle('store-clear-messages', async (_event, agentId: string) => {
    clearMessages(agentId)
    return { success: true }
  })

  // Get session ID for an agent
  ipcMain.handle('store-get-session', async (_event, agentId: string) => {
    return { success: true, sessionId: getSessionId(agentId) }
  })

  // Set session ID for an agent
  ipcMain.handle('store-set-session', async (_event, agentId: string, sessionId: string) => {
    setSessionId(agentId, sessionId)
    return { success: true }
  })

  // Clear session ID for an agent
  ipcMain.handle('store-clear-session', async (_event, agentId: string) => {
    clearSessionId(agentId)
    return { success: true }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
