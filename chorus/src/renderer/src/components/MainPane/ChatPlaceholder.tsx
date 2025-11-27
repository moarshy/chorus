import type { Agent } from '../../types'

interface ChatPlaceholderProps {
  agent: Agent
}

export function ChatPlaceholder({ agent }: ChatPlaceholderProps): JSX.Element {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md">
        <div className="text-4xl mb-4">🤖</div>
        <h2 className="text-xl font-semibold mb-2">{agent.name}</h2>
        <p className="text-secondary mb-4">
          Agent chat functionality coming in Feature 1
        </p>
        <div className="p-4 rounded bg-input text-sm text-muted">
          <p>This agent is defined in:</p>
          <p className="font-mono text-accent mt-1">{agent.filePath.split('/').slice(-3).join('/')}</p>
        </div>
      </div>
    </div>
  )
}
