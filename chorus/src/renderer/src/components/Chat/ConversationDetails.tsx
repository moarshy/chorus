import { useMemo } from 'react'
import { useChatStore } from '../../stores/chat-store'
import { useWorkspaceStore } from '../../stores/workspace-store'
import type { TodoItem, FileChange, ConversationMessage } from '../../types'

interface ConversationDetailsProps {
  conversationId: string | null
  repoPath?: string
}

// SVG Icons
const FileIcon = ({ type }: { type: 'Write' | 'Edit' }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={type === 'Write' ? 'text-green-400' : 'text-blue-400'}
  >
    {type === 'Write' ? (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </>
    ) : (
      <>
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      </>
    )}
  </svg>
)

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const CircleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
    <circle cx="12" cy="12" r="10" />
  </svg>
)

const SpinnerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400 animate-spin">
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
  </svg>
)

const ToolIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
)

const ChartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
)

const FolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
)

const TaskIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
)

// Helper to get relative path from repo path
function getRelativePath(fullPath: string, repoPath?: string): string {
  if (!repoPath) return fullPath
  if (fullPath.startsWith(repoPath)) {
    const relative = fullPath.substring(repoPath.length)
    return relative.startsWith('/') ? relative.substring(1) : relative
  }
  return fullPath
}

// Status icon for todo items
function TodoStatusIcon({ status }: { status: TodoItem['status'] }) {
  switch (status) {
    case 'completed':
      return <CheckIcon />
    case 'in_progress':
      return <SpinnerIcon />
    default:
      return <CircleIcon />
  }
}

// Section component
function Section({
  title,
  icon,
  count,
  children,
  emptyMessage
}: {
  title: string
  icon: React.ReactNode
  count?: number | string
  children: React.ReactNode
  emptyMessage?: string
}) {
  const hasContent = count !== undefined ? (typeof count === 'number' ? count > 0 : count !== '0') : true

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-default">
        {icon}
        <span className="text-sm font-medium text-secondary flex-1">{title}</span>
        {count !== undefined && (
          <span className="text-xs text-muted">{count}</span>
        )}
      </div>
      <div className="py-2">
        {hasContent ? children : (
          <p className="px-3 text-xs text-muted">{emptyMessage || 'None'}</p>
        )}
      </div>
    </div>
  )
}

// Files Changed Section
function FilesChangedSection({ files, repoPath }: { files: FileChange[]; repoPath?: string }) {
  const { selectFile } = useWorkspaceStore()

  const handleFileClick = (filePath: string) => {
    selectFile(filePath)
  }

  if (files.length === 0) {
    return (
      <Section title="Files Changed" icon={<FolderIcon />} count={0} emptyMessage="No files modified">
        <></>
      </Section>
    )
  }

  return (
    <Section title="Files Changed" icon={<FolderIcon />} count={files.length}>
      <div className="space-y-0.5">
        {files.map((file) => (
          <div
            key={file.path}
            onClick={() => handleFileClick(file.path)}
            className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-hover transition-colors"
          >
            <FileIcon type={file.toolName} />
            <span className="text-sm text-primary truncate flex-1">
              {getRelativePath(file.path, repoPath)}
            </span>
            <span className="text-xs text-muted">{file.toolName}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}

// Todo List Section
function TodoListSection({ todos }: { todos: TodoItem[] }) {
  const completed = todos.filter(t => t.status === 'completed').length
  const countStr = todos.length > 0 ? `${completed}/${todos.length}` : '0'

  if (todos.length === 0) {
    return (
      <Section title="Tasks" icon={<TaskIcon />} count="0" emptyMessage="No tasks">
        <></>
      </Section>
    )
  }

  return (
    <Section title="Tasks" icon={<TaskIcon />} count={countStr}>
      <div className="space-y-0.5">
        {todos.map((todo, index) => (
          <div
            key={index}
            className={`flex items-start gap-2 px-3 py-1.5 ${
              todo.status === 'completed' ? 'opacity-60' : ''
            }`}
          >
            <div className="mt-0.5">
              <TodoStatusIcon status={todo.status} />
            </div>
            <span className={`text-sm ${
              todo.status === 'completed' ? 'text-muted line-through' : 'text-primary'
            }`}>
              {todo.status === 'in_progress' ? todo.activeForm : todo.content}
            </span>
          </div>
        ))}
      </div>
    </Section>
  )
}

// Tool Summary Section
function ToolSummarySection({ messages }: { messages: ConversationMessage[] }) {
  const stats = useMemo(() => {
    const toolUses = messages.filter(m => m.type === 'tool_use' && m.toolName !== 'TodoWrite')
    const toolResults = messages.filter(m => m.type === 'tool_result')

    const successful = toolResults.filter(r => !r.isToolError).length
    const failed = toolResults.filter(r => r.isToolError).length

    // Group by tool name
    const byTool: Record<string, { total: number; failed: number }> = {}
    toolUses.forEach(m => {
      const name = m.toolName || 'Unknown'
      if (!byTool[name]) {
        byTool[name] = { total: 0, failed: 0 }
      }
      byTool[name].total++
    })

    // Count failures per tool by matching tool_result to preceding tool_use
    toolResults.forEach(r => {
      if (r.isToolError && r.toolUseId) {
        const toolUse = toolUses.find(t => t.toolUseId === r.toolUseId)
        if (toolUse?.toolName && byTool[toolUse.toolName]) {
          byTool[toolUse.toolName].failed++
        }
      }
    })

    // Sort by count descending
    const sortedTools = Object.entries(byTool)
      .sort((a, b) => b[1].total - a[1].total)

    return { total: toolUses.length, successful, failed, byTool: sortedTools }
  }, [messages])

  return (
    <Section title="Tool Calls" icon={<ToolIcon />} count={stats.total}>
      <div className="px-3 space-y-2">
        {/* Summary row */}
        <div className="flex justify-between text-sm pb-1 border-b border-default">
          <span className="text-muted">
            Total: <span className="text-primary">{stats.total}</span>
          </span>
          <span>
            <span className="text-green-400">{stats.successful}</span>
            {stats.failed > 0 && (
              <span className="text-red-400 ml-2">{stats.failed} failed</span>
            )}
          </span>
        </div>

        {/* Breakdown by tool */}
        {stats.byTool.length > 0 ? (
          <div className="space-y-0.5">
            {stats.byTool.map(([toolName, counts]) => (
              <div key={toolName} className="flex justify-between text-sm">
                <span className="text-secondary truncate flex-1 mr-2">{toolName}</span>
                <span className="text-primary">
                  {counts.total}
                  {counts.failed > 0 && (
                    <span className="text-red-400 ml-1">({counts.failed})</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted">No tool calls yet</p>
        )}
      </div>
    </Section>
  )
}

// Context Metrics Section
function ContextMetricsSection({ messages }: { messages: ConversationMessage[] }) {
  const metrics = useMemo(() => {
    let totalInput = 0
    let totalOutput = 0
    let totalCost = 0

    messages.forEach(m => {
      if (m.inputTokens) totalInput += m.inputTokens
      if (m.outputTokens) totalOutput += m.outputTokens
      if (m.costUsd) totalCost += m.costUsd
    })

    return { totalInput, totalOutput, totalCost }
  }, [messages])

  const hasMetrics = metrics.totalInput > 0 || metrics.totalOutput > 0 || metrics.totalCost > 0

  return (
    <Section title="Context" icon={<ChartIcon />}>
      <div className="px-3 space-y-1">
        {hasMetrics ? (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Input tokens</span>
              <span className="text-primary">{metrics.totalInput.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Output tokens</span>
              <span className="text-primary">{metrics.totalOutput.toLocaleString()}</span>
            </div>
            {metrics.totalCost > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Cost</span>
                <span className="text-primary">${metrics.totalCost.toFixed(4)}</span>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted">No metrics available</p>
        )}
      </div>
    </Section>
  )
}

export function ConversationDetails({ conversationId, repoPath }: ConversationDetailsProps) {
  const { messages, getTodos, getFileChanges } = useChatStore()

  if (!conversationId) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        <p>Select a conversation to view details</p>
      </div>
    )
  }

  const todos = getTodos(conversationId)
  const files = getFileChanges(conversationId)

  return (
    <div className="h-full overflow-y-auto">
      <FilesChangedSection files={files} repoPath={repoPath} />
      <TodoListSection todos={todos} />
      <ToolSummarySection messages={messages} />
      <ContextMetricsSection messages={messages} />
    </div>
  )
}
