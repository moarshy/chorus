import { Agent } from '../types'

interface SidebarProps {
  agents: Agent[]
  selectedAgentId: string | null
  onSelectAgent: (id: string) => void
  onAddAgent: () => void
}

export function Sidebar({ agents, selectedAgentId, onSelectAgent, onAddAgent }: SidebarProps) {
  return (
    <div className="w-64 h-full bg-[var(--sidebar-bg)] flex flex-col border-r border-[var(--border-color)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-color)]">
        <h1 className="text-lg font-bold text-white">Chorus</h1>
        <p className="text-xs text-[var(--text-secondary)]">Multi-Agent Orchestrator</p>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-3 py-2">
          <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Agents
          </span>
        </div>

        {agents.length === 0 ? (
          <div className="px-4 py-8 text-center text-[var(--text-secondary)] text-sm">
            No agents yet.
            <br />
            Click + to add one.
          </div>
        ) : (
          agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => onSelectAgent(agent.id)}
              className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-white/5 transition-colors ${
                selectedAgentId === agent.id ? 'bg-white/10' : ''
              }`}
            >
              {/* Status indicator */}
              <div className="relative">
                <div className="w-8 h-8 rounded bg-[var(--accent)] flex items-center justify-center text-white font-medium text-sm">
                  {agent.name.charAt(0).toUpperCase()}
                </div>
                <div
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--sidebar-bg)] ${
                    agent.status === 'ready'
                      ? 'bg-[var(--online)]'
                      : agent.status === 'busy'
                        ? 'bg-[var(--busy)]'
                        : 'bg-gray-500'
                  }`}
                />
              </div>

              {/* Agent info */}
              <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-medium text-white truncate">{agent.name}</div>
                <div className="text-xs text-[var(--text-secondary)] truncate">
                  {agent.status === 'busy' ? 'Working...' : 'Ready'}
                </div>
              </div>

              {/* Unread indicator */}
              {agent.hasUnread && (
                <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
              )}
            </button>
          ))
        )}
      </div>

      {/* Add Agent Button */}
      <div className="p-3 border-t border-[var(--border-color)]">
        <button
          onClick={onAddAgent}
          className="w-full py-2 px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <span className="text-lg">+</span>
          Add Agent
        </button>
      </div>
    </div>
  )
}
