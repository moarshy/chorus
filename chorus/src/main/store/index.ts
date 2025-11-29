import Store from 'electron-store'
import { v4 as uuidv4 } from 'uuid'
import { basename, resolve } from 'path'
import { existsSync, mkdirSync } from 'fs'

// Types
export interface Agent {
  id: string
  name: string
  filePath: string
  workspaceId: string
  isGeneral?: boolean  // True for auto-created Chorus agent
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

// Tab type for persistence
export interface Tab {
  id: string
  type: 'chat' | 'file'
  workspaceId?: string
  agentId?: string
  filePath?: string
  title: string
}

export interface OpenTabsState {
  tabs: Tab[]
  activeTabId: string | null
}

export interface ChorusSettings {
  rootWorkspaceDir: string
  theme: 'dark' | 'light'
  chatSidebarCollapsed: boolean
  chatSidebarWidth: number
  openTabs?: OpenTabsState
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
  // Ensure .chorus/ directory exists in repo root
  ensureChorusDir()

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

  // Migration: Add Chorus agent to existing workspaces that don't have one
  migrateWorkspacesWithChorusAgent()
}

/**
 * Migration: Ensure all workspaces have a Chorus agent.
 * Runs on every app start but only modifies workspaces lacking a Chorus agent.
 */
function migrateWorkspacesWithChorusAgent(): void {
  const workspaces = store.get('workspaces', [])
  let migrated = false

  const updatedWorkspaces = workspaces.map((workspace) => {
    // Check if workspace already has a Chorus agent (isGeneral === true)
    const hasChorusAgent = workspace.agents.some((a) => a.isGeneral)

    if (!hasChorusAgent) {
      console.log(`Migration: Adding Chorus agent to workspace "${workspace.name}"`)
      migrated = true
      // Create Chorus agent and prepend to agents array
      const chorusAgent: Agent = {
        id: uuidv4(),
        name: 'Chorus',
        filePath: '',
        workspaceId: workspace.id,
        isGeneral: true
      }
      return {
        ...workspace,
        agents: [chorusAgent, ...workspace.agents]
      }
    }

    return workspace
  })

  if (migrated) {
    store.set('workspaces', updatedWorkspaces)
    console.log('Migration: Chorus agent migration complete')
  }
}

// ============================================
// CHORUS AGENT HELPER
// ============================================

/**
 * Creates a Chorus agent object for a workspace.
 * The Chorus agent is the default general-purpose agent without a system prompt file.
 */
export function createChorusAgent(workspaceId: string): Agent {
  return {
    id: uuidv4(),
    name: 'Chorus',
    filePath: '',
    workspaceId,
    isGeneral: true
  }
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

  // Create the Chorus agent (default general-purpose agent)
  const chorusAgent = createChorusAgent(id)

  // Discovered agents get workspaceId assigned
  const discoveredAgents = info.agents.map((a) => ({ ...a, workspaceId: id }))

  const workspace: Workspace = {
    id,
    name,
    path,
    isExpanded: true,
    gitBranch: info.gitBranch,
    isDirty: info.isDirty,
    hasSystemPrompt: info.hasSystemPrompt,
    // Chorus agent first, then discovered agents
    agents: [chorusAgent, ...discoveredAgents]
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

  // Handle agents update - preserve existing Chorus agent
  let updatedAgents = workspace.agents
  if (updates.agents) {
    // Find existing Chorus agent (isGeneral === true)
    const existingChorus = workspace.agents.find((a) => a.isGeneral)
    // Map discovered agents to include workspaceId
    const discoveredAgents = updates.agents.map((a) => ({ ...a, workspaceId: id }))

    if (existingChorus) {
      // Preserve existing Chorus agent ID
      updatedAgents = [existingChorus, ...discoveredAgents]
    } else {
      // No Chorus agent exists (shouldn't happen, but defensive) - create one
      updatedAgents = [createChorusAgent(id), ...discoveredAgents]
    }
  }

  // Build the updated workspace
  const updated: Workspace = {
    ...workspace,
    gitBranch: updates.gitBranch !== undefined ? updates.gitBranch : workspace.gitBranch,
    isDirty: updates.isDirty !== undefined ? updates.isDirty : workspace.isDirty,
    hasSystemPrompt:
      updates.hasSystemPrompt !== undefined ? updates.hasSystemPrompt : workspace.hasSystemPrompt,
    isExpanded: updates.isExpanded !== undefined ? updates.isExpanded : workspace.isExpanded,
    agents: updatedAgents
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
