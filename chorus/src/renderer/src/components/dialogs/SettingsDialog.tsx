import { useState, useEffect } from 'react'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useUIStore } from '../../stores/ui-store'
import type { EditorFontFamily, EditorFontSize } from '../../types'

// Eye Icon (for showing API key)
const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

// Eye Off Icon (for hiding API key)
const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

// Font family options
const FONT_FAMILIES: { value: EditorFontFamily; label: string; stack: string }[] = [
  { value: 'default', label: 'Default (System)', stack: "'SF Mono', Menlo, Monaco, 'Courier New', monospace" },
  { value: 'jetbrains-mono', label: 'JetBrains Mono', stack: "'JetBrains Mono', monospace" },
  { value: 'fira-code', label: 'Fira Code', stack: "'Fira Code', monospace" },
  { value: 'sf-mono', label: 'SF Mono', stack: "'SF Mono', monospace" },
  { value: 'consolas', label: 'Consolas', stack: "Consolas, monospace" }
]

// Font size options
const FONT_SIZES: EditorFontSize[] = [12, 13, 14, 15, 16]

// Check Icon
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

// X Icon
const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

export function SettingsDialog() {
  const { settings, setRootWorkspaceDir, loadSettings } = useWorkspaceStore()
  const { closeSettings } = useUIStore()
  const [rootDir, setRootDir] = useState(settings?.rootWorkspaceDir || '')
  const [isSaving, setIsSaving] = useState(false)
  const [claudePath, setClaudePath] = useState<string | null>(null)
  const [isCheckingClaude, setIsCheckingClaude] = useState(true)
  const [fontFamily, setFontFamily] = useState<EditorFontFamily>(settings?.editorFontFamily || 'default')
  const [fontSize, setFontSize] = useState<EditorFontSize>(settings?.editorFontSize || 14)

  // OpenAI settings state
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [openaiApiKeyMasked, setOpenaiApiKeyMasked] = useState(true)
  const [researchOutputDir, setResearchOutputDir] = useState('./research')
  const [hasExistingApiKey, setHasExistingApiKey] = useState(false)

  useEffect(() => {
    if (settings?.rootWorkspaceDir) {
      setRootDir(settings.rootWorkspaceDir)
    }
    if (settings?.editorFontFamily) {
      setFontFamily(settings.editorFontFamily)
    }
    if (settings?.editorFontSize) {
      setFontSize(settings.editorFontSize)
    }
  }, [settings])

  // Check Claude CLI availability
  useEffect(() => {
    const checkClaude = async () => {
      setIsCheckingClaude(true)
      try {
        const result = await window.api.agent.checkAvailable()
        setClaudePath(result.success && result.data ? result.data : null)
      } catch {
        setClaudePath(null)
      }
      setIsCheckingClaude(false)
    }
    checkClaude()
  }, [])

  // Load OpenAI settings
  useEffect(() => {
    const loadOpenAISettings = async () => {
      try {
        const [apiKeyResult, outputDirResult] = await Promise.all([
          window.api.openai.getApiKey(),
          window.api.openai.getResearchOutputDir()
        ])

        if (apiKeyResult.success && apiKeyResult.data) {
          setHasExistingApiKey(true)
          setOpenaiApiKey('sk-...existing')
        }

        if (outputDirResult.success && outputDirResult.data) {
          setResearchOutputDir(outputDirResult.data)
        }
      } catch (error) {
        console.error('Failed to load OpenAI settings:', error)
      }
    }
    loadOpenAISettings()
  }, [])

  // Handle API key change
  const handleApiKeyChange = (value: string): void => {
    setOpenaiApiKey(value)
    if (value !== 'sk-...existing') {
      setHasExistingApiKey(false)
    }
  }

  const handleSelectDirectory = async () => {
    const result = await window.api.dialog.selectDirectory()
    if (result.success && result.data) {
      setRootDir(result.data)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)

    // Save all settings
    if (rootDir) {
      await setRootWorkspaceDir(rootDir)
    }

    // Save editor font settings
    await window.api.settings.set({
      editorFontFamily: fontFamily,
      editorFontSize: fontSize
    })

    // Save OpenAI settings
    console.log('[Settings] Saving OpenAI key, value:', openaiApiKey?.substring(0, 10) + '...', 'length:', openaiApiKey?.length)
    if (openaiApiKey && openaiApiKey !== 'sk-...existing') {
      console.log('[Settings] Calling setApiKey...')
      const result = await window.api.openai.setApiKey(openaiApiKey)
      console.log('[Settings] setApiKey result:', result)
    } else {
      console.log('[Settings] Skipped saving - key is empty or placeholder')
    }
    await window.api.openai.setResearchOutputDir(researchOutputDir)

    // Reload settings to update the store
    await loadSettings()

    setIsSaving(false)
    closeSettings()
  }

  const handleClose = () => {
    closeSettings()
  }

  return (
    <div className="dialog-overlay" onClick={handleClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-4">Settings</h2>

        <div className="space-y-6">
          {/* Claude Code Status */}
          <div>
            <label className="block text-sm text-secondary mb-2">
              Claude Code CLI
            </label>
            {isCheckingClaude ? (
              <div className="text-sm text-muted animate-pulse">Checking...</div>
            ) : claudePath ? (
              <div className="flex items-center gap-2">
                <span className="text-green-400"><CheckIcon /></span>
                <span className="text-sm text-green-300">Installed</span>
                <span className="text-xs text-muted ml-2 font-mono">{claudePath}</span>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5"><XIcon /></span>
                <div>
                  <span className="text-sm text-red-300">Not found</span>
                  <p className="text-xs text-muted mt-1">
                    Claude Code CLI is required to chat with agents.{' '}
                    <a
                      href="https://docs.anthropic.com/en/docs/claude-code"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      Install Claude Code
                    </a>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Root workspace directory */}
          <div>
            <label className="block text-sm text-secondary mb-2">
              Root Workspace Directory
            </label>
            <p className="text-xs text-muted mb-2">
              This is where cloned repositories will be saved
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={rootDir}
                onChange={(e) => setRootDir(e.target.value)}
                placeholder="/path/to/workspaces"
                className="input flex-1"
                readOnly
              />
              <button onClick={handleSelectDirectory} className="btn btn-secondary">
                Browse
              </button>
            </div>
          </div>

          {/* Editor Font Settings */}
          <div>
            <label className="block text-sm text-secondary mb-3">
              Editor Appearance
            </label>
            <div className="space-y-4">
              {/* Font Family */}
              <div>
                <label className="block text-xs text-muted mb-2">Font Family</label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value as EditorFontFamily)}
                  className="input w-full"
                >
                  {FONT_FAMILIES.map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Font Size */}
              <div>
                <label className="block text-xs text-muted mb-2">Font Size</label>
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value) as EditorFontSize)}
                  className="input w-full"
                >
                  {FONT_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}px
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview */}
              <div
                className="p-3 rounded-md bg-sidebar border border-default"
                style={{
                  fontFamily: FONT_FAMILIES.find(f => f.value === fontFamily)?.stack,
                  fontSize: `${fontSize}px`
                }}
              >
                <div className="text-muted text-xs mb-1" style={{ fontFamily: 'inherit', fontSize: 'inherit' }}>Preview:</div>
                <code>const greeting = "Hello, World!";</code>
              </div>
            </div>
          </div>

          {/* OpenAI Settings (for Deep Research) */}
          <div>
            <label className="block text-sm text-secondary mb-3">
              OpenAI Deep Research
            </label>
            <p className="text-xs text-muted mb-3">
              Configure OpenAI API access for the Deep Research agent
            </p>
            <div className="space-y-4">
              {/* API Key */}
              <div>
                <label className="block text-xs text-muted mb-2">API Key</label>
                <div className="relative">
                  <input
                    type={openaiApiKeyMasked ? 'password' : 'text'}
                    value={openaiApiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    onFocus={() => {
                      if (openaiApiKey === 'sk-...existing') {
                        setOpenaiApiKey('')
                      }
                    }}
                    placeholder="sk-..."
                    className="input w-full pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setOpenaiApiKeyMasked(!openaiApiKeyMasked)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-secondary"
                  >
                    {openaiApiKeyMasked ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                </div>
                {hasExistingApiKey && openaiApiKey === 'sk-...existing' && (
                  <p className="text-xs text-muted mt-1">API key is configured. Click to change.</p>
                )}
              </div>

              {/* Research Output Directory */}
              <div>
                <label className="block text-xs text-muted mb-2">Research Output Directory</label>
                <input
                  type="text"
                  value={researchOutputDir}
                  onChange={(e) => setResearchOutputDir(e.target.value)}
                  placeholder="./research"
                  className="input w-full"
                />
                <p className="text-xs text-muted mt-1">
                  Relative path from workspace root where research outputs are saved
                </p>
              </div>
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div>
            <label className="block text-sm text-secondary mb-3">
              Keyboard Shortcuts
            </label>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center py-1.5 border-b border-default">
                <span className="text-white">New conversation</span>
                <kbd className="px-2 py-1 rounded bg-hover text-xs font-mono text-muted">
                  {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+N
                </kbd>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-default">
                <span className="text-white">Stop agent</span>
                <kbd className="px-2 py-1 rounded bg-hover text-xs font-mono text-muted">
                  Esc
                </kbd>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-default">
                <span className="text-white">Send message</span>
                <kbd className="px-2 py-1 rounded bg-hover text-xs font-mono text-muted">
                  Enter
                </kbd>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-white">New line in message</span>
                <kbd className="px-2 py-1 rounded bg-hover text-xs font-mono text-muted">
                  Shift+Enter
                </kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={handleClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
