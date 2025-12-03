import type { AgentType } from '../../../preload/index.d'

export interface ModelOption {
  id: string
  name: string
  description?: string
  default?: boolean
}

// Claude models for Chorus agent
export const CLAUDE_MODELS: ModelOption[] = [
  { id: 'default', name: 'Default', description: 'Sonnet 4.5 - Recommended', default: true },
  { id: 'opus', name: 'Opus', description: 'Opus 4 - Most capable' },
  { id: 'sonnet', name: 'Sonnet', description: 'Sonnet 4.5' },
  { id: 'haiku', name: 'Haiku', description: 'Haiku - Fastest' }
]

// OpenAI Deep Research models
export const OPENAI_RESEARCH_MODELS: ModelOption[] = [
  {
    id: 'o4-mini-deep-research-2025-06-26',
    name: 'O4 Mini',
    description: 'Faster, more affordable',
    default: true
  },
  {
    id: 'o3-deep-research-2025-06-26',
    name: 'O3',
    description: 'Full capabilities, thorough'
  }
]

/**
 * Get available models for a given agent type
 */
export function getModelsForAgentType(type: AgentType | undefined): ModelOption[] {
  switch (type) {
    case 'openai-research':
      return OPENAI_RESEARCH_MODELS
    case 'claude':
    default:
      return CLAUDE_MODELS
  }
}

/**
 * Get the default model ID for an agent type
 */
export function getDefaultModelForAgentType(type: AgentType | undefined): string {
  const models = getModelsForAgentType(type)
  const defaultModel = models.find((m) => m.default)
  return defaultModel?.id || models[0]?.id || 'default'
}
