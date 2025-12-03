import Store from 'electron-store'
import { v4 as uuidv4 } from 'uuid'
import { basename, resolve } from 'path'
import { existsSync, mkdirSync } from 'fs'

// Agent type - determines which backend service handles the agent
export type AgentType = 'claude' | 'openai-research'

// Types
export interface Agent {
  id: string
  name: string
  filePath: string
  workspaceId: string
  isGeneral?: boolean  // True for auto-created Chorus agent
  type?: AgentType     // 'claude' (default) or 'openai-research'
  description?: string // Agent description for display
}

// Git automation settings
export interface GitSettings {
  autoBranch: boolean      // Create branch per agent session (default: true)
  autoCommit: boolean      // Commit per turn (default: true)
}

export interface WorkspaceSettings {
  defaultPermissionMode: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions'
  defaultAllowedTools: string[]
  defaultModel: string
  git?: GitSettings        // Git automation settings
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

// Editor font options
export type EditorFontFamily = 'default' | 'jetbrains-mono' | 'fira-code' | 'sf-mono' | 'consolas'
export type EditorFontSize = 12 | 13 | 14 | 15 | 16

export interface ChorusSettings {
  rootWorkspaceDir: string
  theme: 'dark' | 'light'
  chatSidebarCollapsed: boolean
  chatSidebarWidth: number
  openTabs?: OpenTabsState
  editorFontFamily?: EditorFontFamily
  editorFontSize?: EditorFontSize
  // OpenAI settings
  openaiApiKey?: string
  researchOutputDirectory?: string  // Default: './research'
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
        chatSidebarWidth: 240,
        editorFontFamily: 'default',
        editorFontSize: 14,
        researchOutputDirectory: './research'
      }
    }
  })

  // Log store location for debugging
  console.log('Store location:', store.path)

  // Migration: Add built-in agents (Chorus, Deep Research) to existing workspaces
  migrateWorkspacesWithBuiltInAgents()
}

/**
 * Migration: Ensure all workspaces have built-in agents (Chorus and Deep Research).
 * Runs on every app start but only modifies workspaces lacking these agents.
 */
function migrateWorkspacesWithBuiltInAgents(): void {
  const workspaces = store.get('workspaces', [])
  let migrated = false

  const updatedWorkspaces = workspaces.map((workspace) => {
    let agents = [...workspace.agents]

    // Check if workspace already has a Chorus agent
    const hasChorusAgent = agents.some((a) => a.isGeneral && a.type !== 'openai-research')
    if (!hasChorusAgent) {
      console.log(`Migration: Adding Chorus agent to workspace "${workspace.name}"`)
      migrated = true
      agents = [createChorusAgent(workspace.id), ...agents]
    }

    // Check if workspace already has a Deep Research agent
    const hasDeepResearchAgent = agents.some((a) => a.type === 'openai-research')
    if (!hasDeepResearchAgent) {
      console.log(`Migration: Adding Deep Research agent to workspace "${workspace.name}"`)
      migrated = true
      // Insert after Chorus agent (index 1)
      const chorusIndex = agents.findIndex((a) => a.isGeneral && a.type !== 'openai-research')
      const insertIndex = chorusIndex >= 0 ? chorusIndex + 1 : 0
      agents.splice(insertIndex, 0, createDeepResearchAgent(workspace.id))
    }

    // Ensure existing Chorus agent has type field
    agents = agents.map((a) => {
      if (a.isGeneral && !a.type && a.name === 'Chorus') {
        return { ...a, type: 'claude' as AgentType, description: 'General-purpose coding assistant' }
      }
      return a
    })

    return { ...workspace, agents }
  })

  if (migrated) {
    store.set('workspaces', updatedWorkspaces)
    console.log('Migration: Built-in agents migration complete')
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
    isGeneral: true,
    type: 'claude',
    description: 'General-purpose coding assistant'
  }
}

/**
 * Creates a Deep Research agent object for a workspace.
 * Uses OpenAI's Deep Research models for comprehensive analysis.
 */
export function createDeepResearchAgent(workspaceId: string): Agent {
  return {
    id: `deep-research-${workspaceId}`, // Stable ID per workspace
    name: 'Deep Research',
    filePath: '',
    workspaceId,
    isGeneral: true,
    type: 'openai-research',
    description: 'OpenAI Deep Research for comprehensive analysis'
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

  // Create the built-in agents
  const chorusAgent = createChorusAgent(id)
  const deepResearchAgent = createDeepResearchAgent(id)

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
    // Built-in agents first (Chorus, Deep Research), then discovered agents
    agents: [chorusAgent, deepResearchAgent, ...discoveredAgents]
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

  // Handle agents update - preserve existing built-in agents (Chorus, Deep Research)
  let updatedAgents = workspace.agents
  if (updates.agents) {
    // Find existing built-in agents
    const existingChorus = workspace.agents.find((a) => a.isGeneral && a.type !== 'openai-research')
    const existingDeepResearch = workspace.agents.find((a) => a.type === 'openai-research')

    // Map discovered agents to include workspaceId
    const discoveredAgents = updates.agents.map((a) => ({ ...a, workspaceId: id }))

    // Build agents array with built-in agents first
    const builtInAgents: Agent[] = []
    if (existingChorus) {
      builtInAgents.push(existingChorus)
    } else {
      builtInAgents.push(createChorusAgent(id))
    }
    if (existingDeepResearch) {
      builtInAgents.push(existingDeepResearch)
    } else {
      builtInAgents.push(createDeepResearchAgent(id))
    }

    updatedAgents = [...builtInAgents, ...discoveredAgents]
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

export const DEFAULT_GIT_SETTINGS: GitSettings = {
  autoBranch: true,
  autoCommit: true
}

const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  defaultPermissionMode: 'default',
  defaultAllowedTools: [],
  defaultModel: 'default',
  git: DEFAULT_GIT_SETTINGS
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

// ============================================
// OPENAI SETTINGS OPERATIONS
// ============================================

export function getOpenAIApiKey(): string | null {
  return store.get('settings.openaiApiKey', null) as string | null
}

export function setOpenAIApiKey(key: string): void {
  const settings = getSettings()
  store.set('settings', { ...settings, openaiApiKey: key })
}

export function getResearchOutputDirectory(): string {
  return store.get('settings.researchOutputDirectory', './research') as string
}

export function setResearchOutputDirectory(dir: string): void {
  const settings = getSettings()
  store.set('settings', { ...settings, researchOutputDirectory: dir })
}
