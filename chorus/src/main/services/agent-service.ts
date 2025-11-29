import { BrowserWindow } from 'electron'
import { ConversationSettings } from './conversation-service'
import {
  sendMessageSDK,
  stopAgentSDK,
  getSessionIdSDK,
  clearSessionSDK,
  resolvePermission
} from './agent-sdk-service'

// Export for IPC handler to resolve permissions
export { resolvePermission }

// ============================================
// Agent Communication (SDK Only)
// ============================================

/**
 * Send a message to a Claude agent using the SDK
 */
export async function sendMessage(
  conversationId: string,
  agentId: string,
  repoPath: string,
  message: string,
  sessionId: string | null,
  sessionCreatedAt: string | null,
  agentFilePath: string | null,
  mainWindow: BrowserWindow,
  settings?: ConversationSettings
): Promise<void> {
  return sendMessageSDK(
    conversationId,
    agentId,
    repoPath,
    message,
    sessionId,
    sessionCreatedAt,
    agentFilePath,
    mainWindow,
    settings
  )
}

/**
 * Stop an agent's current operation
 */
export function stopAgent(_agentId: string, conversationId?: string): void {
  if (conversationId) {
    stopAgentSDK(conversationId)
  }
}

/**
 * Get session ID for an agent
 */
export function getSessionId(agentId: string): string | null {
  return getSessionIdSDK(agentId)
}

/**
 * Clear an agent's session (start fresh conversation)
 */
export function clearSession(agentId: string): void {
  clearSessionSDK(agentId)
}

/**
 * Check if SDK is available (always returns true since SDK is bundled)
 */
export function isClaudeAvailable(): string | null {
  return 'sdk'
}
