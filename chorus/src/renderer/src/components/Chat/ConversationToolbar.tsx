import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '../../stores/chat-store'
import type { ConversationSettings, PermissionMode } from '../../types'

// Default settings
const DEFAULT_SETTINGS: ConversationSettings = {
  permissionMode: 'default',
  allowedTools: [],
  model: 'claude-sonnet-4-20250514'
}

// Available models
const MODELS = [
  { id: 'claude-sonnet-4-20250514', name: 'Sonnet 4', description: 'Fast & capable' },
  { id: 'claude-opus-4-20250514', name: 'Opus 4', description: 'Most powerful' },
  { id: 'claude-haiku-3-5-20241022', name: 'Haiku 3.5', description: 'Fastest & cheapest' }
]

// Permission modes
const PERMISSION_MODES: { id: PermissionMode; name: string; description: string }[] = [
  { id: 'default', name: 'Default', description: 'Prompts for permission' },
  { id: 'acceptEdits', name: 'Accept Edits', description: 'Auto-accept file edits' },
  { id: 'plan', name: 'Plan Only', description: 'Read-only, no modifications' },
  { id: 'bypassPermissions', name: 'Bypass All', description: 'Skip all prompts (dangerous)' }
]

// Tools that require permissions
const PERMISSION_TOOLS = [
  { id: 'Bash', name: 'Bash', description: 'Execute shell commands' },
  { id: 'Edit', name: 'Edit', description: 'Modify existing files' },
  { id: 'Write', name: 'Write', description: 'Create new files' },
  { id: 'WebFetch', name: 'WebFetch', description: 'Fetch web content' },
  { id: 'WebSearch', name: 'WebSearch', description: 'Search the web' },
  { id: 'NotebookEdit', name: 'NotebookEdit', description: 'Edit Jupyter notebooks' }
]

// SVG Icons
const ChevronDownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z" />
  </svg>
)

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
  </svg>
)

interface DropdownProps {
  label: string
  value: string
  children: React.ReactNode
}

function Dropdown({ label, value, children }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-input border border-default hover:bg-hover transition-colors"
      >
        <span className="text-muted">{label}:</span>
        <span className="text-primary font-medium">{value}</span>
        <ChevronDownIcon />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-sidebar border border-default rounded-lg shadow-lg z-50 py-1">
          {children}
        </div>
      )}
    </div>
  )
}

interface ConversationToolbarProps {
  conversationId: string
}

export function ConversationToolbar({ conversationId }: ConversationToolbarProps) {
  const { conversations, updateConversationSettings } = useChatStore()
  const conversation = conversations.find(c => c.id === conversationId)
  const settings = conversation?.settings || DEFAULT_SETTINGS

  const handleModelChange = (model: string) => {
    updateConversationSettings(conversationId, { model })
  }

  const handlePermissionChange = (permissionMode: PermissionMode) => {
    updateConversationSettings(conversationId, { permissionMode })
  }

  const handleToolToggle = (toolId: string) => {
    const currentTools = settings.allowedTools || []
    const newTools = currentTools.includes(toolId)
      ? currentTools.filter(t => t !== toolId)
      : [...currentTools, toolId]
    updateConversationSettings(conversationId, { allowedTools: newTools })
  }

  const selectedModel = MODELS.find(m => m.id === settings.model) || MODELS[0]
  const selectedPermission = PERMISSION_MODES.find(p => p.id === settings.permissionMode) || PERMISSION_MODES[0]
  const enabledToolsCount = settings.allowedTools?.length || 0

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-default bg-sidebar/50">
      {/* Model Selector */}
      <Dropdown label="Model" value={selectedModel.name}>
        {MODELS.map(model => (
          <button
            key={model.id}
            onClick={() => handleModelChange(model.id)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-hover text-left"
          >
            <span className="w-4">
              {settings.model === model.id && <CheckIcon />}
            </span>
            <div>
              <div className="text-primary font-medium">{model.name}</div>
              <div className="text-xs text-muted">{model.description}</div>
            </div>
          </button>
        ))}
      </Dropdown>

      {/* Permission Selector */}
      <Dropdown label="Permission" value={selectedPermission.name}>
        {PERMISSION_MODES.map(mode => (
          <button
            key={mode.id}
            onClick={() => handlePermissionChange(mode.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-hover text-left ${
              mode.id === 'bypassPermissions' ? 'text-red-400' : ''
            }`}
          >
            <span className="w-4">
              {settings.permissionMode === mode.id && <CheckIcon />}
            </span>
            <div>
              <div className={`font-medium ${mode.id === 'bypassPermissions' ? 'text-red-400' : 'text-primary'}`}>
                {mode.name}
              </div>
              <div className="text-xs text-muted">{mode.description}</div>
            </div>
          </button>
        ))}
      </Dropdown>

      {/* Tools Selector */}
      <Dropdown label="Tools" value={enabledToolsCount > 0 ? `${enabledToolsCount} enabled` : 'Default'}>
        <div className="px-3 py-2 border-b border-default">
          <div className="text-xs text-muted">
            Select tools to auto-approve. Empty = ask for permission.
          </div>
        </div>
        {PERMISSION_TOOLS.map(tool => (
          <button
            key={tool.id}
            onClick={() => handleToolToggle(tool.id)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-hover text-left"
          >
            <span className={`w-4 h-4 flex items-center justify-center rounded border ${
              settings.allowedTools?.includes(tool.id)
                ? 'bg-accent border-accent text-white'
                : 'border-default'
            }`}>
              {settings.allowedTools?.includes(tool.id) && <CheckIcon />}
            </span>
            <div>
              <div className="text-primary font-medium">{tool.name}</div>
              <div className="text-xs text-muted">{tool.description}</div>
            </div>
          </button>
        ))}
        <div className="px-3 py-2 border-t border-default">
          <div className="text-xs text-muted">
            Read, Glob, Grep, Task are always available.
          </div>
        </div>
      </Dropdown>
    </div>
  )
}
