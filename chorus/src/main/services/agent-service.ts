import { BrowserWindow } from 'electron'
import { ConversationSettings } from './conversation-service'
import { GitSettings, AgentType } from '../store'
import {
  sendMessageSDK,
  stopAgentSDK,
  getSessionIdSDK,
  clearSessionSDK,
  resolvePermission
} from './agent-sdk-service'
import {
  sendResearchMessage,
  stopResearchAgent
} from './openai-research-service'

// Export for IPC handler to resolve permissions
export { resolvePermission }

// ============================================
// Agent Communication (Router by Agent Type)
// ============================================

/**
 * Send a message to an agent, routing to appropriate backend based on agent type
 */
export async function sendMessage(
  conversationId: string,
  agentId: string,
  workspaceId: string,
  repoPath: string,
  message: string,
  sessionId: string | null,
  sessionCreatedAt: string | null,
  agentFilePath: string | null,
  mainWindow: BrowserWindow,
  settings?: ConversationSettings,
  gitSettings?: GitSettings,
  agentType?: AgentType
): Promise<void> {
  // Route based on agent type
  if (agentType === 'openai-research') {
    return sendResearchMessage(
      conversationId,
      agentId,
      workspaceId,
      repoPath,
      message,
      mainWindow,
      settings,
      gitSettings
    )
  }

  // Default: Claude agent (SDK)
  return sendMessageSDK(
    conversationId,
    agentId,
    repoPath,
    message,
    sessionId,
    sessionCreatedAt,
    agentFilePath,
    mainWindow,
    settings,
    gitSettings
  )
}

/**
 * Stop an agent's current operation
 */
export function stopAgent(_agentId: string, conversationId?: string, agentType?: AgentType): void {
  if (!conversationId) return

  if (agentType === 'openai-research') {
    stopResearchAgent(conversationId)
  } else {
    stopAgentSDK(conversationId)
  }
}

/**
 * Get session ID for an agent (Claude only - OpenAI is stateless)
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
