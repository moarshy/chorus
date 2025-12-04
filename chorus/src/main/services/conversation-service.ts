import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, unlinkSync, rmdirSync, readdirSync } from 'fs'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { getChorusDir, getWorkspaceSettings as getWorkspaceSettingsFromStore } from '../store'

// ============================================
// Claude Code Message Types (Raw Format)
// ============================================

// Content block types from Claude Code stream-json output
export interface TextBlock {
  type: 'text'
  text: string
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error: boolean
}

export interface ThinkingBlock {
  type: 'thinking'
  thinking: string
}

export interface ImageBlock {
  type: 'image'
  source: {
    type: 'base64'
    media_type: string
    data: string
  }
}

export type ClaudeContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | ThinkingBlock | ImageBlock

// Claude Code system init message
export interface ClaudeSystemMessage {
  type: 'system'
  subtype: 'init'
  session_id: string
  tools: string[]
  mcp_servers: string[]
  model: string
  cwd: string
  permissionMode: string
}

// Claude Code assistant message
export interface ClaudeAssistantMessage {
  type: 'assistant'
  message: {
    id: string
    type: 'message'
    role: 'assistant'
    content: ClaudeContentBlock[]
    model: string
    stop_reason: string
    stop_sequence: string | null
    usage: {
      input_tokens: number
      output_tokens: number
      cache_creation_input_tokens: number
      cache_read_input_tokens: number
    }
  }
}

// Claude Code user message (tool results)
export interface ClaudeUserMessage {
  type: 'user'
  message: {
    role: 'user'
    content: ClaudeContentBlock[]
  }
}

// Model usage breakdown from result message
export interface ModelUsageEntry {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
  webSearchRequests: number
  costUSD: number
  contextWindow: number
}

// Claude Code result message
export interface ClaudeResultMessage {
  type: 'result'
  result: string
  subtype: 'success' | 'error' | 'error_max_turns' | 'error_during_execution'
  session_id: string
  total_cost_usd: number
  duration_ms: number
  duration_api_ms: number
  num_turns: number
  is_error: boolean
  // Cumulative token usage for the entire turn
  usage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens: number
    cache_read_input_tokens: number
  }
  // Per-model breakdown with context window info
  modelUsage: Record<string, ModelUsageEntry>
}

// Union of all Claude Code message types
export type ClaudeCodeMessage = ClaudeSystemMessage | ClaudeAssistantMessage | ClaudeUserMessage | ClaudeResultMessage

// ============================================
// Conversation Types
// ============================================

// Simplified content block for display
export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  name?: string
  input?: Record<string, unknown>
}

// Research progress phase types
export type ResearchPhase = 'analyzing' | 'searching' | 'reasoning' | 'synthesizing' | 'complete'

// Research source discovered during web search
export interface ResearchSource {
  url?: string
  title?: string
  query?: string
}

// Stored message format - includes both raw Claude message and display-friendly data
export interface ConversationMessage {
  uuid: string
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'error' | 'system' | 'research_progress' | 'research_result'
  content: string | ContentBlock[]
  timestamp: string
  sessionId?: string
  toolName?: string
  toolInput?: Record<string, unknown>
  // Tool execution linking - allows pairing tool_use with its tool_result
  toolUseId?: string
  // For tool_result: indicates if the tool execution failed
  isToolError?: boolean
  // Raw Claude Code message (preserved exactly as received)
  claudeMessage?: ClaudeCodeMessage
  // Metadata from result messages
  costUsd?: number
  durationMs?: number
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
  // Context window from the model used (from result.modelUsage)
  contextWindow?: number
  // Number of turns in this session
  numTurns?: number
  // Research-specific fields (for type 'research_progress' and 'research_result')
  researchPhase?: ResearchPhase
  researchSources?: ResearchSource[]
  searchCount?: number
  // Research result metadata
  outputPath?: string
  wordCount?: number
  sourceCount?: number
}

// Conversation Settings Types
export type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions'

export interface ConversationSettings {
  permissionMode: PermissionMode
  allowedTools: string[]
  model: string
}

// Default settings for new conversations
export const DEFAULT_CONVERSATION_SETTINGS: ConversationSettings = {
  permissionMode: 'default',
  allowedTools: [], // Empty = Claude Code's default behavior (asks for permission)
  model: 'default' // Uses alias that resolves to latest Sonnet
}

// Tools that require permissions - user can enable/disable these
export const PERMISSION_TOOLS = ['Bash', 'Edit', 'Write', 'WebFetch', 'WebSearch', 'NotebookEdit']

// Tools always available (no permissions needed)
export const ALWAYS_AVAILABLE_TOOLS = ['Read', 'Glob', 'Grep', 'Task', 'TodoWrite', 'AskUserQuestion']

export interface Conversation {
  id: string
  sessionId: string | null
  sessionCreatedAt: string | null  // ISO timestamp when session was created (for expiry tracking)
  branchName: string | null  // Git branch name associated with this conversation (for auto-branch feature)
  worktreePath: string | null  // Path to worktree if using worktree isolation (Sprint 16)
  agentId: string
  workspaceId: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
  settings?: ConversationSettings
}

interface ConversationsIndex {
  conversations: Conversation[]
}

// In-memory cache for conversation -> path mapping
const conversationPathCache: Map<string, { workspaceId: string; agentId: string }> = new Map()

// ============================================
// Path Helpers
// ============================================

/**
 * Get the sessions directory for a workspace/agent
 * Returns: ~/.chorus/sessions/{workspaceId}/{agentId}/
 */
export function getSessionsDir(workspaceId: string, agentId: string): string {
  return join(getChorusDir(), 'sessions', workspaceId, agentId)
}

/**
 * Ensure the sessions directory exists
 */
export function ensureSessionsDir(workspaceId: string, agentId: string): void {
  const dir = getSessionsDir(workspaceId, agentId)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

/**
 * Get path to conversations.json index file
 */
function getConversationsIndexPath(workspaceId: string, agentId: string): string {
  return join(getSessionsDir(workspaceId, agentId), 'conversations.json')
}

/**
 * Get path to messages JSONL file for a conversation
 */
function getMessagesFilePath(workspaceId: string, agentId: string, conversationId: string): string {
  return join(getSessionsDir(workspaceId, agentId), `${conversationId}-messages.jsonl`)
}

// ============================================
// Index Operations
// ============================================

/**
 * Read the conversations index file
 */
function readConversationsIndex(workspaceId: string, agentId: string): ConversationsIndex {
  const indexPath = getConversationsIndexPath(workspaceId, agentId)
  if (!existsSync(indexPath)) {
    return { conversations: [] }
  }
  try {
    const content = readFileSync(indexPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return { conversations: [] }
  }
}

/**
 * Write the conversations index file
 */
function writeConversationsIndex(workspaceId: string, agentId: string, index: ConversationsIndex): void {
  ensureSessionsDir(workspaceId, agentId)
  const indexPath = getConversationsIndexPath(workspaceId, agentId)
  writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8')
}

// ============================================
// Conversation CRUD Operations
// ============================================

/**
 * List all conversations for a workspace/agent, sorted by updatedAt desc
 */
export function listConversations(workspaceId: string, agentId: string): Conversation[] {
  const index = readConversationsIndex(workspaceId, agentId)

  // Update cache for all conversations
  for (const conv of index.conversations) {
    conversationPathCache.set(conv.id, { workspaceId, agentId })
  }

  // Sort by updatedAt descending (most recent first)
  return index.conversations.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

/**
 * Create a new conversation
 * @param workspaceId - The workspace ID
 * @param agentId - The agent ID
 */
export function createConversation(workspaceId: string, agentId: string): Conversation {
  ensureSessionsDir(workspaceId, agentId)

  // Get default settings from workspace (stored in central config.json)
  let defaultSettings = { ...DEFAULT_CONVERSATION_SETTINGS }
  try {
    const workspaceSettings = getWorkspaceSettingsFromStore(workspaceId)
    // Convert workspace settings to conversation settings
    defaultSettings = {
      permissionMode: workspaceSettings.defaultPermissionMode,
      allowedTools: workspaceSettings.defaultAllowedTools,
      model: workspaceSettings.defaultModel
    }
  } catch {
    // Fall back to global defaults on error
  }

  const now = new Date().toISOString()
  const conversation: Conversation = {
    id: uuidv4(),
    sessionId: null,
    sessionCreatedAt: null,
    branchName: null,
    worktreePath: null,
    agentId,
    workspaceId,
    title: 'New Conversation',
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    settings: defaultSettings
  }

  // Add to index
  const index = readConversationsIndex(workspaceId, agentId)
  index.conversations.push(conversation)
  writeConversationsIndex(workspaceId, agentId, index)

  // Update cache
  conversationPathCache.set(conversation.id, { workspaceId, agentId })

  return conversation
}

/**
 * Load a conversation with its messages
 */
export function loadConversation(conversationId: string): { conversation: Conversation | null; messages: ConversationMessage[] } {
  const location = getConversationPath(conversationId)
  if (!location) {
    return { conversation: null, messages: [] }
  }

  const { workspaceId, agentId } = location
  const index = readConversationsIndex(workspaceId, agentId)
  const conversation = index.conversations.find(c => c.id === conversationId)

  if (!conversation) {
    return { conversation: null, messages: [] }
  }

  // Read messages from JSONL file
  const messagesPath = getMessagesFilePath(workspaceId, agentId, conversationId)
  const messages: ConversationMessage[] = []

  if (existsSync(messagesPath)) {
    try {
      const content = readFileSync(messagesPath, 'utf-8')
      const lines = content.trim().split('\n').filter(line => line.trim())
      for (const line of lines) {
        try {
          messages.push(JSON.parse(line))
        } catch {
          // Skip malformed lines
        }
      }
    } catch {
      // Return empty messages on error
    }
  }

  return { conversation, messages }
}

/**
 * Update conversation metadata
 */
export function updateConversation(
  conversationId: string,
  updates: Partial<Pick<Conversation, 'title' | 'sessionId' | 'sessionCreatedAt' | 'branchName' | 'worktreePath' | 'messageCount' | 'settings'>>
): Conversation | null {
  const location = getConversationPath(conversationId)
  if (!location) {
    return null
  }

  const { workspaceId, agentId } = location
  const index = readConversationsIndex(workspaceId, agentId)
  const conversationIndex = index.conversations.findIndex(c => c.id === conversationId)

  if (conversationIndex === -1) {
    return null
  }

  // Update fields
  const conversation = index.conversations[conversationIndex]
  if (updates.title !== undefined) conversation.title = updates.title
  if (updates.sessionId !== undefined) conversation.sessionId = updates.sessionId
  if (updates.sessionCreatedAt !== undefined) conversation.sessionCreatedAt = updates.sessionCreatedAt
  if (updates.branchName !== undefined) conversation.branchName = updates.branchName
  if (updates.messageCount !== undefined) conversation.messageCount = updates.messageCount
  if (updates.settings !== undefined) conversation.settings = updates.settings
  conversation.updatedAt = new Date().toISOString()

  index.conversations[conversationIndex] = conversation
  writeConversationsIndex(workspaceId, agentId, index)

  return conversation
}

/**
 * Update conversation settings (permission mode, allowed tools, model)
 */
export function updateConversationSettings(
  conversationId: string,
  settings: Partial<ConversationSettings>
): Conversation | null {
  const location = getConversationPath(conversationId)
  if (!location) {
    return null
  }

  const { workspaceId, agentId } = location
  const index = readConversationsIndex(workspaceId, agentId)
  const conversationIndex = index.conversations.findIndex(c => c.id === conversationId)

  if (conversationIndex === -1) {
    return null
  }

  // Update settings, merging with existing
  const conversation = index.conversations[conversationIndex]
  const currentSettings = conversation.settings || { ...DEFAULT_CONVERSATION_SETTINGS }

  conversation.settings = {
    ...currentSettings,
    ...settings
  }
  conversation.updatedAt = new Date().toISOString()

  index.conversations[conversationIndex] = conversation
  writeConversationsIndex(workspaceId, agentId, index)

  return conversation
}

/**
 * Delete a conversation and its messages file
 * Cleans up empty directories when the last conversation is deleted
 */
export function deleteConversation(conversationId: string): boolean {
  const location = getConversationPath(conversationId)
  if (!location) {
    return false
  }

  const { workspaceId, agentId } = location
  const index = readConversationsIndex(workspaceId, agentId)
  const conversationIndex = index.conversations.findIndex(c => c.id === conversationId)

  if (conversationIndex === -1) {
    return false
  }

  // Remove from index
  index.conversations.splice(conversationIndex, 1)

  // Delete messages file
  const messagesPath = getMessagesFilePath(workspaceId, agentId, conversationId)
  if (existsSync(messagesPath)) {
    try {
      unlinkSync(messagesPath)
    } catch {
      // Ignore deletion errors
    }
  }

  // Remove from cache
  conversationPathCache.delete(conversationId)

  // Clean up empty directories if no conversations left
  if (index.conversations.length === 0) {
    const agentDir = getSessionsDir(workspaceId, agentId)
    const indexPath = getConversationsIndexPath(workspaceId, agentId)

    // Delete conversations.json
    try {
      if (existsSync(indexPath)) {
        unlinkSync(indexPath)
      }
    } catch {
      // Ignore errors
    }

    // Remove agent directory if empty
    try {
      if (existsSync(agentDir) && readdirSync(agentDir).length === 0) {
        rmdirSync(agentDir)
      }
    } catch {
      // Ignore errors
    }

    // Remove workspace directory if empty
    const workspaceDir = join(getChorusDir(), 'sessions', workspaceId)
    try {
      if (existsSync(workspaceDir) && readdirSync(workspaceDir).length === 0) {
        rmdirSync(workspaceDir)
      }
    } catch {
      // Ignore errors
    }
  } else {
    // Still have conversations, update the index
    writeConversationsIndex(workspaceId, agentId, index)
  }

  return true
}

/**
 * Get the branchName for a conversation (for cascade delete)
 */
export function getConversationBranchName(conversationId: string): string | null {
  const location = getConversationPath(conversationId)
  if (!location) {
    return null
  }

  const { workspaceId, agentId } = location
  const index = readConversationsIndex(workspaceId, agentId)
  const conversation = index.conversations.find(c => c.id === conversationId)

  return conversation?.branchName || null
}

/**
 * Find and delete all conversations associated with a git branch
 * Returns the IDs of deleted conversations
 */
export function deleteConversationsByBranch(workspaceId: string, branchName: string): string[] {
  const deletedIds: string[] = []
  const chorusDir = getChorusDir()
  const workspaceSessionsDir = join(chorusDir, 'sessions', workspaceId)

  if (!existsSync(workspaceSessionsDir)) {
    return deletedIds
  }

  // Iterate through all agent directories in this workspace
  try {
    const agentDirs = readdirSync(workspaceSessionsDir)
    for (const agentId of agentDirs) {
      const index = readConversationsIndex(workspaceId, agentId)

      // Find conversations with this branch name
      const toDelete = index.conversations.filter(c => c.branchName === branchName)

      for (const conversation of toDelete) {
        if (deleteConversation(conversation.id)) {
          deletedIds.push(conversation.id)
        }
      }
    }
  } catch {
    // Ignore errors reading directories
  }

  return deletedIds
}

// ============================================
// Message Operations
// ============================================

/**
 * Append a message to a conversation's JSONL file
 */
export function appendMessage(conversationId: string, message: ConversationMessage): boolean {
  const location = getConversationPath(conversationId)
  if (!location) {
    return false
  }

  const { workspaceId, agentId } = location
  ensureSessionsDir(workspaceId, agentId)

  const messagesPath = getMessagesFilePath(workspaceId, agentId, conversationId)
  const line = JSON.stringify(message) + '\n'

  try {
    appendFileSync(messagesPath, line, 'utf-8')

    // Update message count and timestamp
    const index = readConversationsIndex(workspaceId, agentId)
    const conversation = index.conversations.find(c => c.id === conversationId)
    if (conversation) {
      conversation.messageCount++
      conversation.updatedAt = new Date().toISOString()
      writeConversationsIndex(workspaceId, agentId, index)
    }

    return true
  } catch {
    return false
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get the workspace/agent location for a conversation
 * Uses in-memory cache for quick lookups
 */
export function getConversationPath(conversationId: string): { workspaceId: string; agentId: string } | null {
  // Check cache first
  if (conversationPathCache.has(conversationId)) {
    return conversationPathCache.get(conversationId)!
  }

  // If not in cache, we'd need to scan all conversations
  // For now, return null - callers should ensure conversations are loaded first
  return null
}

/**
 * Generate a title from the first user message
 */
export function generateTitleFromMessage(content: string): string {
  // Strip newlines and truncate
  const clean = content.replace(/\n/g, ' ').trim()
  if (clean.length <= 50) {
    return clean
  }
  return clean.substring(0, 47) + '...'
}
