import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer - these are the ONLY APIs renderer can access
const api = {
  // File operations (invoke/handle pattern)
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  listDirectory: (dirPath: string) => ipcRenderer.invoke('list-directory', dirPath),
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),

  // Git operations (Module 4)
  gitIsRepo: (repoPath: string) => ipcRenderer.invoke('git-is-repo', repoPath),
  gitStatus: (repoPath: string) => ipcRenderer.invoke('git-status', repoPath),
  gitLog: (repoPath: string, count?: number) => ipcRenderer.invoke('git-log', repoPath, count),
  gitBranch: (repoPath: string) => ipcRenderer.invoke('git-branch', repoPath),
  checkClaudeConfig: (repoPath: string) => ipcRenderer.invoke('check-claude-config', repoPath),

  // Agent operations (Module 5: Claude Agent SDK)
  sendToAgent: (agentId: string, repoPath: string, message: string) =>
    ipcRenderer.invoke('send-to-agent', agentId, repoPath, message),
  stopAgent: (agentId: string) => ipcRenderer.invoke('stop-agent', agentId),
  clearAgentSession: (agentId: string) => ipcRenderer.invoke('clear-agent-session', agentId),

  // Agent event listeners (main -> renderer streaming)
  onAgentMessage: (callback: (message: unknown) => void) => {
    const handler = (_event: unknown, message: unknown) => callback(message)
    ipcRenderer.on('agent-message', handler)
    // Return cleanup function
    return () => ipcRenderer.removeListener('agent-message', handler)
  },
  onAgentStatus: (callback: (status: unknown) => void) => {
    const handler = (_event: unknown, status: unknown) => callback(status)
    ipcRenderer.on('agent-status', handler)
    return () => ipcRenderer.removeListener('agent-status', handler)
  },

  // Store operations (Module 7: State Management)
  store: {
    // Agent persistence
    getAgents: () => ipcRenderer.invoke('store-get-agents'),
    addAgent: (agent: { id: string; name: string; repoPath: string; createdAt: string }) =>
      ipcRenderer.invoke('store-add-agent', agent),
    removeAgent: (agentId: string) => ipcRenderer.invoke('store-remove-agent', agentId),

    // Message persistence
    getMessages: (agentId: string) => ipcRenderer.invoke('store-get-messages', agentId),
    addMessage: (
      agentId: string,
      message: { id: string; role: 'user' | 'assistant'; content: string; timestamp: string }
    ) => ipcRenderer.invoke('store-add-message', agentId, message),
    clearMessages: (agentId: string) => ipcRenderer.invoke('store-clear-messages', agentId),

    // Session persistence
    getSession: (agentId: string) => ipcRenderer.invoke('store-get-session', agentId),
    setSession: (agentId: string, sessionId: string) =>
      ipcRenderer.invoke('store-set-session', agentId, sessionId),
    clearSession: (agentId: string) => ipcRenderer.invoke('store-clear-session', agentId)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
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
