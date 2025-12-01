import { useState, useRef, useEffect } from 'react'
import type { PermissionMode, WorkspaceSettings as WorkspaceSettingsType, GitSettings } from '../../types'

// Default git settings
const DEFAULT_GIT_SETTINGS: GitSettings = {
  autoBranch: true,
  autoCommit: true
}

// Default settings
const DEFAULT_SETTINGS: WorkspaceSettingsType = {
  defaultPermissionMode: 'default',
  defaultAllowedTools: [],
  defaultModel: 'default',
  git: DEFAULT_GIT_SETTINGS
}

// Available models (using aliases that resolve to latest versions)
const MODELS = [
  { id: 'default', name: 'Default', description: 'Sonnet 4.5 - Recommended' },
  { id: 'opus', name: 'Opus', description: 'Opus 4.5 - Most capable' },
  { id: 'sonnet', name: 'Sonnet (1M)', description: 'Sonnet 4.5 - Long context' },
  { id: 'haiku', name: 'Haiku', description: 'Haiku 4.5 - Fastest' }
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
const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z" />
    <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z" />
  </svg>
)

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

const GitBranchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5z" />
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
        className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-input border border-default hover:bg-hover transition-colors"
      >
        <span className="text-muted">{label}:</span>
        <span className="text-primary font-medium">{value}</span>
        <ChevronDownIcon />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-sidebar border border-default rounded-lg shadow-lg z-50 py-1">
          {children}
        </div>
      )}
    </div>
  )
}

interface WorkspaceSettingsProps {
  workspaceId: string
}

export function WorkspaceSettings({ workspaceId }: WorkspaceSettingsProps) {
  const [settings, setSettings] = useState<WorkspaceSettingsType>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [hasSettings, setHasSettings] = useState(false)

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true)
      try {
        const hasResult = await window.api.workspaceSettings.has(workspaceId)
        setHasSettings(hasResult.success && hasResult.data === true)

        const result = await window.api.workspaceSettings.get(workspaceId)
        if (result.success && result.data) {
          setSettings(result.data)
        }
      } catch (error) {
        console.error('Failed to load workspace settings:', error)
      }
      setIsLoading(false)
    }
    loadSettings()
  }, [workspaceId])

  const updateSettings = async (updates: Partial<WorkspaceSettingsType>) => {
    try {
      const result = await window.api.workspaceSettings.set(workspaceId, updates)
      if (result.success && result.data) {
        setSettings(result.data)
        setHasSettings(true)
      }
    } catch (error) {
      console.error('Failed to update workspace settings:', error)
    }
  }

  const handleModelChange = (model: string) => {
    updateSettings({ defaultModel: model })
  }

  const handlePermissionChange = (permissionMode: PermissionMode) => {
    updateSettings({ defaultPermissionMode: permissionMode })
  }

  const handleToolToggle = (toolId: string) => {
    const currentTools = settings.defaultAllowedTools || []
    const newTools = currentTools.includes(toolId)
      ? currentTools.filter(t => t !== toolId)
      : [...currentTools, toolId]
    updateSettings({ defaultAllowedTools: newTools })
  }

  const handleGitSettingToggle = (key: keyof GitSettings) => {
    const currentGit = settings.git || DEFAULT_GIT_SETTINGS
    updateSettings({
      git: {
        ...currentGit,
        [key]: !currentGit[key]
      }
    })
  }

  const selectedModel = MODELS.find(m => m.id === settings.defaultModel) || MODELS[0]
  const selectedPermission = PERMISSION_MODES.find(p => p.id === settings.defaultPermissionMode) || PERMISSION_MODES[0]
  const enabledToolsCount = settings.defaultAllowedTools?.length || 0

  if (isLoading) {
    return (
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-3">
          Default Settings
        </h2>
        <div className="p-4 rounded-lg bg-input border border-default">
          <p className="text-muted text-sm">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
        <SettingsIcon />
        Default Settings
      </h2>
      <div className="p-4 rounded-lg bg-input border border-default">
        <p className="text-sm text-muted mb-4">
          Default settings for new conversations in this workspace.
          {!hasSettings && (
            <span className="text-secondary"> Settings will be saved to <code className="text-accent">.chorus/config.json</code>.</span>
          )}
        </p>

        <div className="flex flex-wrap gap-3">
          {/* Model Selector */}
          <Dropdown label="Model" value={selectedModel.name}>
            {MODELS.map(model => (
              <button
                key={model.id}
                onClick={() => handleModelChange(model.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-hover text-left"
              >
                <span className="w-4">
                  {settings.defaultModel === model.id && <CheckIcon />}
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
                  {settings.defaultPermissionMode === mode.id && <CheckIcon />}
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
                Select tools to auto-approve by default. Empty = ask for permission.
              </div>
            </div>
            {PERMISSION_TOOLS.map(tool => (
              <button
                key={tool.id}
                onClick={() => handleToolToggle(tool.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-hover text-left"
              >
                <span className={`w-4 h-4 flex items-center justify-center rounded border ${
                  settings.defaultAllowedTools?.includes(tool.id)
                    ? 'bg-accent border-accent text-white'
                    : 'border-default'
                }`}>
                  {settings.defaultAllowedTools?.includes(tool.id) && <CheckIcon />}
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

        {/* Git Automation Settings */}
        <div className="mt-6 pt-6 border-t border-default">
          <h3 className="text-sm font-semibold text-secondary flex items-center gap-2 mb-3">
            <GitBranchIcon />
            Git Automation
          </h3>
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer group">
              <button
                onClick={() => handleGitSettingToggle('autoBranch')}
                className={`mt-0.5 w-5 h-5 flex-shrink-0 flex items-center justify-center rounded border transition-colors ${
                  (settings.git?.autoBranch ?? DEFAULT_GIT_SETTINGS.autoBranch)
                    ? 'bg-accent border-accent text-white'
                    : 'border-default group-hover:border-secondary'
                }`}
              >
                {(settings.git?.autoBranch ?? DEFAULT_GIT_SETTINGS.autoBranch) && <CheckIcon />}
              </button>
              <div>
                <p className="text-primary text-sm font-medium">Auto-create branch for each agent session</p>
                <p className="text-xs text-muted mt-0.5">
                  Creates <code className="text-accent">agent/{'{agentName}'}/{'{sessionId}'}</code> branches to isolate agent work
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <button
                onClick={() => handleGitSettingToggle('autoCommit')}
                className={`mt-0.5 w-5 h-5 flex-shrink-0 flex items-center justify-center rounded border transition-colors ${
                  (settings.git?.autoCommit ?? DEFAULT_GIT_SETTINGS.autoCommit)
                    ? 'bg-accent border-accent text-white'
                    : 'border-default group-hover:border-secondary'
                }`}
              >
                {(settings.git?.autoCommit ?? DEFAULT_GIT_SETTINGS.autoCommit) && <CheckIcon />}
              </button>
              <div>
                <p className="text-primary text-sm font-medium">Auto-commit after each conversation turn</p>
                <p className="text-xs text-muted mt-0.5">
                  Automatically commits file changes with the prompt as the commit message
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
