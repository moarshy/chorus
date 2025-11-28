import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { ConversationSettings, DEFAULT_CONVERSATION_SETTINGS } from './conversation-service'

/**
 * Workspace-level default settings for Claude Code
 * Stored in {workspacePath}/.chorus/workspace-settings.json
 */
export interface WorkspaceSettings {
  defaultPermissionMode: ConversationSettings['permissionMode']
  defaultAllowedTools: string[]
  defaultModel: string
}

// Default workspace settings (falls back to conversation defaults)
export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  defaultPermissionMode: DEFAULT_CONVERSATION_SETTINGS.permissionMode,
  defaultAllowedTools: DEFAULT_CONVERSATION_SETTINGS.allowedTools,
  defaultModel: DEFAULT_CONVERSATION_SETTINGS.model
}

/**
 * Get the .chorus directory path for a workspace
 */
function getWorkspaceChorusDir(workspacePath: string): string {
  return join(workspacePath, '.chorus')
}

/**
 * Get the workspace settings file path
 */
function getWorkspaceSettingsPath(workspacePath: string): string {
  return join(getWorkspaceChorusDir(workspacePath), 'workspace-settings.json')
}

/**
 * Ensure the .chorus directory exists in a workspace
 */
function ensureWorkspaceChorusDir(workspacePath: string): void {
  const chorusDir = getWorkspaceChorusDir(workspacePath)
  if (!existsSync(chorusDir)) {
    mkdirSync(chorusDir, { recursive: true })
  }
}

/**
 * Read workspace settings from .chorus/workspace-settings.json
 * Returns default settings if file doesn't exist
 */
export function getWorkspaceSettings(workspacePath: string): WorkspaceSettings {
  const settingsPath = getWorkspaceSettingsPath(workspacePath)

  if (!existsSync(settingsPath)) {
    return { ...DEFAULT_WORKSPACE_SETTINGS }
  }

  try {
    const content = readFileSync(settingsPath, 'utf-8')
    const parsed = JSON.parse(content)

    // Merge with defaults to ensure all fields exist
    return {
      defaultPermissionMode: parsed.defaultPermissionMode || DEFAULT_WORKSPACE_SETTINGS.defaultPermissionMode,
      defaultAllowedTools: parsed.defaultAllowedTools || DEFAULT_WORKSPACE_SETTINGS.defaultAllowedTools,
      defaultModel: parsed.defaultModel || DEFAULT_WORKSPACE_SETTINGS.defaultModel
    }
  } catch {
    // Return defaults on parse error
    return { ...DEFAULT_WORKSPACE_SETTINGS }
  }
}

/**
 * Save workspace settings to .chorus/workspace-settings.json
 */
export function setWorkspaceSettings(workspacePath: string, settings: Partial<WorkspaceSettings>): WorkspaceSettings {
  ensureWorkspaceChorusDir(workspacePath)

  // Merge with existing settings
  const current = getWorkspaceSettings(workspacePath)
  const updated: WorkspaceSettings = {
    ...current,
    ...settings
  }

  const settingsPath = getWorkspaceSettingsPath(workspacePath)
  writeFileSync(settingsPath, JSON.stringify(updated, null, 2), 'utf-8')

  return updated
}

/**
 * Convert workspace settings to conversation settings
 * Used when creating a new conversation
 */
export function workspaceSettingsToConversationSettings(workspaceSettings: WorkspaceSettings): ConversationSettings {
  return {
    permissionMode: workspaceSettings.defaultPermissionMode,
    allowedTools: workspaceSettings.defaultAllowedTools,
    model: workspaceSettings.defaultModel
  }
}

/**
 * Check if a workspace has custom settings (vs defaults)
 */
export function hasWorkspaceSettings(workspacePath: string): boolean {
  const settingsPath = getWorkspaceSettingsPath(workspacePath)
  return existsSync(settingsPath)
}
