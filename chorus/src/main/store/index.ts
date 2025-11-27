import Store from 'electron-store'
import { v4 as uuidv4 } from 'uuid'
import { basename, join } from 'path'
import { app } from 'electron'

// Types
export interface Agent {
  id: string
  name: string
  filePath: string
  workspaceId: string
}

export interface Workspace {
  id: string
  name: string
  path: string
  isExpanded: boolean
  gitBranch: string | null
  isDirty: boolean
  hasSystemPrompt: boolean
  agents: Agent[]
}

export interface ChorusSettings {
  rootWorkspaceDir: string
  theme: 'dark' | 'light'
}

interface StoreSchema {
  workspaces: Workspace[]
  settings: ChorusSettings
}

let store: Store<StoreSchema>

export function initStore(): void {
  const isDev = !app.isPackaged

  store = new Store<StoreSchema>({
    name: 'chorus-data',
    // In development, store in project root for easy inspection
    // In production, use default OS location
    ...(isDev && {
      cwd: join(__dirname, '..', '..', '..')
    }),
    defaults: {
      workspaces: [],
      settings: {
        rootWorkspaceDir: '',
        theme: 'dark'
      }
    }
  })

  // Log store location for debugging
  console.log('Store location:', store.path)
}

// ============================================
// SETTINGS OPERATIONS
// ============================================

export function getSettings(): ChorusSettings {
  return store.get('settings')
}

export function setSettings(updates: Partial<ChorusSettings>): void {
  const current = getSettings()
  store.set('settings', { ...current, ...updates })
}

// ============================================
// WORKSPACE OPERATIONS
// ============================================

export function getWorkspaces(): Workspace[] {
  return store.get('workspaces', [])
}

export function addWorkspace(
  path: string,
  info: {
    gitBranch: string | null
    isDirty: boolean
    hasSystemPrompt: boolean
    agents: Omit<Agent, 'workspaceId'>[]
  }
): Workspace {
  const workspaces = getWorkspaces()
  const name = basename(path)
  const id = uuidv4()

  const workspace: Workspace = {
    id,
    name,
    path,
    isExpanded: true,
    gitBranch: info.gitBranch,
    isDirty: info.isDirty,
    hasSystemPrompt: info.hasSystemPrompt,
    agents: info.agents.map((a) => ({ ...a, workspaceId: id }))
  }

  workspaces.push(workspace)
  store.set('workspaces', workspaces)
  return workspace
}

export function removeWorkspace(id: string): void {
  const workspaces = getWorkspaces().filter((ws) => ws.id !== id)
  store.set('workspaces', workspaces)
}

export function updateWorkspace(
  id: string,
  updates: {
    gitBranch?: string | null
    isDirty?: boolean
    hasSystemPrompt?: boolean
    isExpanded?: boolean
    agents?: Omit<Agent, 'workspaceId'>[]
  }
): Workspace | null {
  const workspaces = getWorkspaces()
  const index = workspaces.findIndex((ws) => ws.id === id)
  if (index === -1) return null

  const workspace = workspaces[index]

  // Build the updated workspace, converting agents to include workspaceId
  const updated: Workspace = {
    ...workspace,
    gitBranch: updates.gitBranch !== undefined ? updates.gitBranch : workspace.gitBranch,
    isDirty: updates.isDirty !== undefined ? updates.isDirty : workspace.isDirty,
    hasSystemPrompt:
      updates.hasSystemPrompt !== undefined ? updates.hasSystemPrompt : workspace.hasSystemPrompt,
    isExpanded: updates.isExpanded !== undefined ? updates.isExpanded : workspace.isExpanded,
    agents: updates.agents ? updates.agents.map((a) => ({ ...a, workspaceId: id })) : workspace.agents
  }

  workspaces[index] = updated
  store.set('workspaces', workspaces)
  return updated
}

export function toggleWorkspaceExpanded(id: string): void {
  const workspaces = getWorkspaces()
  const workspace = workspaces.find((ws) => ws.id === id)
  if (workspace) {
    workspace.isExpanded = !workspace.isExpanded
    store.set('workspaces', workspaces)
  }
}
