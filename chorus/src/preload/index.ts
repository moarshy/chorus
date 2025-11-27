import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer - these are the ONLY APIs renderer can access
const api = {
  // Settings operations
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings: { rootWorkspaceDir?: string; theme?: 'dark' | 'light' }) =>
      ipcRenderer.invoke('settings:set', settings),
    getRootDir: () => ipcRenderer.invoke('settings:get-root-dir'),
    setRootDir: (path: string) => ipcRenderer.invoke('settings:set-root-dir', path)
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
    readFile: (path: string) => ipcRenderer.invoke('fs:read-file', path)
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
    log: (path: string, count?: number) => ipcRenderer.invoke('git:log', path, count),
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
