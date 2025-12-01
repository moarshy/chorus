import { useEffect } from 'react'
import { ChangesPanel } from './ChangesPanel'
import { BranchCommitsGrid } from './BranchCommitsGrid'
import { WorkspaceSettings } from './WorkspaceSettings'
import { useUIStore } from '../../stores/ui-store'
import { useWorkspaceStore } from '../../stores/workspace-store'
import type { Workspace } from '../../types'

interface WorkspaceOverviewProps {
  workspace: Workspace
}

// SVG Icons
const RepoIcon = () => (
  <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8zM5 12.25v3.25a.25.25 0 00.4.2l1.45-1.087a.25.25 0 01.3 0L8.6 15.7a.25.25 0 00.4-.2v-3.25a.25.25 0 00-.25-.25h-3.5a.25.25 0 00-.25.25z" />
  </svg>
)


const DiffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8.75 1.75a.75.75 0 00-1.5 0V5H4a.75.75 0 000 1.5h3.25v3.25a.75.75 0 001.5 0V6.5H12A.75.75 0 0012 5H8.75V1.75zM4 13a.75.75 0 000 1.5h8a.75.75 0 100-1.5H4z" />
  </svg>
)

const DocumentIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3.75 1.5a.25.25 0 00-.25.25v11.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75zm5.75.56v2.19c0 .138.112.25.25.25h2.19L9.5 2.06zM2 1.75C2 .784 2.784 0 3.75 0h5.086c.464 0 .909.184 1.237.513l3.414 3.414c.329.328.513.773.513 1.237v8.086A1.75 1.75 0 0112.25 15h-8.5A1.75 1.75 0 012 13.25V1.75z" />
  </svg>
)

const FolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

const CommandIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)

// Sparkle icon for Chorus (general) agent
const SparkleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8zm10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.414a.5.5 0 1 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707zM4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708z"/>
    <circle cx="8" cy="8" r="3" />
  </svg>
)

// Generate a consistent color based on agent name
function getAvatarColor(name: string): string {
  const colors = [
    '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
    '#00bcd4', '#009688', '#4caf50', '#ff9800', '#ff5722'
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

// Get initials from agent name
function getInitials(name: string): string {
  const words = name.split(/[-_\s]+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function WorkspaceOverview({ workspace }: WorkspaceOverviewProps) {
  const { setRightPanelTab, setRightPanelCollapsed } = useUIStore()
  const { selectAgent, refreshWorkspace, loadCommands, getCommands } = useWorkspaceStore()

  // Load slash commands on mount
  useEffect(() => {
    loadCommands(workspace.id)
  }, [workspace.id, loadCommands])

  const commands = getCommands(workspace.id)

  const handleBranchChange = async () => {
    await refreshWorkspace(workspace.id)
    // Also refresh commands after branch change
    loadCommands(workspace.id)
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="text-muted">
            <RepoIcon />
          </div>
          <h1 className="text-2xl font-bold">{workspace.name}</h1>
        </div>
        <p className="text-sm text-muted font-mono ml-9">{workspace.path}</p>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2 mb-6">
        {workspace.isDirty && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-sm text-amber-400">
            <DiffIcon />
            <span>Uncommitted changes</span>
          </div>
        )}
        {workspace.hasSystemPrompt && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-input border border-default text-sm">
            <span className="text-muted">
              <DocumentIcon />
            </span>
            <span>CLAUDE.md</span>
          </div>
        )}
      </div>

      {/* Uncommitted changes section */}
      {workspace.gitBranch && (
        <ChangesPanel workspacePath={workspace.path} />
      )}

      {/* Branches with commits grid */}
      {workspace.gitBranch && (
        <div className="mb-8">
          <BranchCommitsGrid
            workspacePath={workspace.path}
            onBranchChange={handleBranchChange}
          />
        </div>
      )}

      {/* Workspace default settings */}
      <WorkspaceSettings workspaceId={workspace.id} />

      {/* Slash Commands section */}
      {commands.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
            <CommandIcon />
            Slash Commands ({commands.length})
          </h2>
          <div className="p-4 rounded-lg bg-input border border-default">
            <div className="space-y-2">
              {commands.slice(0, 5).map((cmd) => (
                <div key={cmd.name} className="flex items-start gap-3">
                  <span className="text-blue-400 font-mono text-sm whitespace-nowrap">/{cmd.name}</span>
                  {cmd.argumentHint && (
                    <span className="text-muted text-sm whitespace-nowrap">{cmd.argumentHint}</span>
                  )}
                  {cmd.description && (
                    <span className="text-secondary text-sm truncate">{cmd.description}</span>
                  )}
                </div>
              ))}
              {commands.length > 5 && (
                <p className="text-muted text-sm pt-2">
                  +{commands.length - 5} more commands
                </p>
              )}
            </div>
            <p className="text-xs text-muted mt-4 pt-3 border-t border-default">
              Use <kbd className="px-1.5 py-0.5 rounded bg-hover font-mono">/</kbd> in chat to invoke commands
            </p>
          </div>
        </div>
      )}

      {/* Agents section */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-3">
          Agents
        </h2>
        {workspace.agents.length === 0 ? (
          <div className="p-4 rounded-lg bg-input border border-default">
            <p className="text-secondary mb-2">No agents found in this workspace.</p>
            <p className="text-sm text-muted">
              Create agents by adding <code className="text-accent bg-hover px-1.5 py-0.5 rounded">.md</code> files to{' '}
              <code className="text-accent bg-hover px-1.5 py-0.5 rounded">.claude/agents/</code>
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {/* Sort: Chorus (isGeneral) first, then alphabetically */}
            {[...workspace.agents]
              .sort((a, b) => {
                if (a.isGeneral) return -1
                if (b.isGeneral) return 1
                return a.name.localeCompare(b.name)
              })
              .map((agent) => {
                const avatarColor = agent.isGeneral ? '#8b5cf6' : getAvatarColor(agent.name)  // Purple for Chorus
                const initials = getInitials(agent.name)
                return (
                  <div
                    key={agent.id}
                    onClick={() => selectAgent(agent.id, workspace.id)}
                    className="flex items-center gap-3 p-3 rounded-lg bg-input border border-default hover:bg-hover hover:border-accent/30 transition-all cursor-pointer group"
                  >
                    {/* Avatar */}
                    <div
                      className="relative flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-semibold"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {agent.isGeneral ? <SparkleIcon /> : initials}
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-input" />
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium group-hover:text-accent transition-colors">{agent.name}</p>
                      <p className="text-xs text-muted font-mono truncate">
                        {agent.isGeneral ? 'Default agent' : agent.filePath.split('/').pop()}
                      </p>
                    </div>
                    {/* Arrow */}
                    <div className="text-muted group-hover:text-accent transition-colors">
                      <ChevronRightIcon />
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      
      {/* Quick actions */}
      <div className="flex gap-3">
        <button
          onClick={() => {
            setRightPanelTab('files')
            setRightPanelCollapsed(false)
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-input border border-default text-secondary hover:bg-hover hover:text-primary hover:border-accent/30 transition-all"
        >
          <FolderIcon />
          Browse Files
        </button>
      </div>
    </div>
  )
}
