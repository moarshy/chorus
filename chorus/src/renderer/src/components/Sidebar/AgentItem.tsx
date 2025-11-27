import { useWorkspaceStore } from '../../stores/workspace-store'
import type { Agent } from '../../types'

interface AgentItemProps {
  agent: Agent
}

export function AgentItem({ agent }: AgentItemProps): JSX.Element {
  const { selectedAgentId, selectAgent } = useWorkspaceStore()
  const isSelected = selectedAgentId === agent.id

  const handleClick = () => {
    selectAgent(agent.id)
  }

  return (
    <div
      className={`
        flex items-center gap-2 px-2 py-1 mx-2 rounded cursor-pointer text-sm
        ${isSelected ? 'bg-selected' : 'hover:bg-hover'}
      `}
      onClick={handleClick}
    >
      <span className="text-muted">🤖</span>
      <span className="truncate">{agent.name}</span>
    </div>
  )
}
