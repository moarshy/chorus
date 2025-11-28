import Store from 'electron-store'
import { v4 as uuidv4 } from 'uuid'
import { basename, resolve } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { migrateIfNeeded } from '../services/migration-service'

// Types
export interface Agent {
  id: string
  name: string
  filePath: string
  workspaceId: string
}

export interface WorkspaceSettings {
  defaultPermissionMode: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions'
  defaultAllowedTools: string[]
  defaultModel: string
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
  settings?: WorkspaceSettings
}

export interface ChorusSettings {
  rootWorkspaceDir: string
  theme: 'dark' | 'light'
  chatSidebarCollapsed: boolean
  chatSidebarWidth: number
}

interface StoreSchema {
  workspaces: Workspace[]
  settings: ChorusSettings
}

let store: Store<StoreSchema>

/**
 * Get the .chorus/ directory path in the project root (cc-slack/.chorus)
 */
export function getChorusDir(): string {
  // In development, __dirname is chorus/out/main
  // In production, it would be inside the app bundle
  // We want cc-slack/.chorus (one level up from chorus/)
  return resolve(__dirname, '../../../.chorus')
}

/**
 * Ensure the .chorus/ directory exists
 */
function ensureChorusDir(): void {
  const chorusDir = getChorusDir()
  if (!existsSync(chorusDir)) {
    mkdirSync(chorusDir, { recursive: true })
    console.log('Created .chorus directory:', chorusDir)
  }
}

export function initStore(): void {
  // Ensure ~/.chorus/ directory exists
  ensureChorusDir()

  // Run migration if old data exists
  migrateIfNeeded()

  store = new Store<StoreSchema>({
    name: 'config',
    cwd: getChorusDir(),
    defaults: {
      workspaces: [],
      settings: {
        rootWorkspaceDir: '',
        theme: 'dark',
        chatSidebarCollapsed: false,
        chatSidebarWidth: 240
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

// ============================================
// WORKSPACE SETTINGS OPERATIONS
// ============================================

const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  defaultPermissionMode: 'default',
  defaultAllowedTools: [],
  defaultModel: 'default'
}

export function getWorkspaceSettings(workspaceId: string): WorkspaceSettings {
  const workspaces = getWorkspaces()
  const workspace = workspaces.find((ws) => ws.id === workspaceId)
  if (!workspace?.settings) {
    return { ...DEFAULT_WORKSPACE_SETTINGS }
  }
  return {
    ...DEFAULT_WORKSPACE_SETTINGS,
    ...workspace.settings
  }
}

export function setWorkspaceSettings(workspaceId: string, settings: Partial<WorkspaceSettings>): WorkspaceSettings {
  const workspaces = getWorkspaces()
  const index = workspaces.findIndex((ws) => ws.id === workspaceId)
  if (index === -1) {
    return { ...DEFAULT_WORKSPACE_SETTINGS }
  }

  const current = workspaces[index].settings || { ...DEFAULT_WORKSPACE_SETTINGS }
  const updated: WorkspaceSettings = {
    ...current,
    ...settings
  }

  workspaces[index].settings = updated
  store.set('workspaces', workspaces)
  return updated
}

export function hasWorkspaceSettings(workspaceId: string): boolean {
  const workspaces = getWorkspaces()
  const workspace = workspaces.find((ws) => ws.id === workspaceId)
  return !!workspace?.settings
}
