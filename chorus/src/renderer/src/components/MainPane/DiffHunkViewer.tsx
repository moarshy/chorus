import type { DiffHunk } from '../../types'

interface DiffHunkViewerProps {
  hunks: DiffHunk[]
  maxHeight?: string
}

interface DiffLineData {
  type: 'add' | 'del' | 'context' | 'header'
  content: string
  oldNum: number | null
  newNum: number | null
}

/**
 * Parse diff hunk content into structured line data
 */
function parseDiffLines(hunk: DiffHunk): DiffLineData[] {
  const lines: DiffLineData[] = []
  const contentLines = hunk.content.split('\n')

  let oldNum = hunk.oldStart
  let newNum = hunk.newStart

  for (const line of contentLines) {
    // Skip empty lines at the end
    if (line === '') continue

    // Handle hunk header line (@@...@@)
    if (line.startsWith('@@')) {
      lines.push({
        type: 'header',
        content: line,
        oldNum: null,
        newNum: null
      })
      continue
    }

    if (line.startsWith('+')) {
      lines.push({
        type: 'add',
        content: line.slice(1), // Remove the + prefix
        oldNum: null,
        newNum: newNum++
      })
    } else if (line.startsWith('-')) {
      lines.push({
        type: 'del',
        content: line.slice(1), // Remove the - prefix
        oldNum: oldNum++,
        newNum: null
      })
    } else if (line.startsWith(' ') || line.startsWith('\t')) {
      // Context line (starts with space)
      lines.push({
        type: 'context',
        content: line.slice(1), // Remove the leading space
        oldNum: oldNum++,
        newNum: newNum++
      })
    } else {
      // Plain context line (no prefix, shouldn't happen in standard diff)
      lines.push({
        type: 'context',
        content: line,
        oldNum: oldNum++,
        newNum: newNum++
      })
    }
  }

  return lines
}

function DiffLine({ line }: { line: DiffLineData }) {
  if (line.type === 'header') {
    return (
      <div className="flex bg-blue-500/10 text-blue-400 text-[11px]">
        <span className="w-10 text-right px-1 select-none border-r border-default bg-blue-500/5" />
        <span className="w-10 text-right px-1 select-none border-r border-default bg-blue-500/5" />
        <span className="flex-1 px-2 font-medium">{line.content}</span>
      </div>
    )
  }

  const bgClass =
    line.type === 'add'
      ? 'bg-green-500/10'
      : line.type === 'del'
        ? 'bg-red-500/10'
        : ''

  const textClass =
    line.type === 'add'
      ? 'text-green-400'
      : line.type === 'del'
        ? 'text-red-400'
        : 'text-primary/80'

  const gutterBgClass =
    line.type === 'add'
      ? 'bg-green-500/5'
      : line.type === 'del'
        ? 'bg-red-500/5'
        : 'bg-surface'

  const prefix = line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '

  return (
    <div className={`flex ${bgClass} hover:brightness-110 transition-all`}>
      {/* Old line number */}
      <span
        className={`w-10 text-right px-1 text-muted/60 select-none border-r border-default ${gutterBgClass}`}
      >
        {line.oldNum || ''}
      </span>
      {/* New line number */}
      <span
        className={`w-10 text-right px-1 text-muted/60 select-none border-r border-default ${gutterBgClass}`}
      >
        {line.newNum || ''}
      </span>
      {/* Prefix (+/-/space) */}
      <span className={`w-4 text-center select-none ${textClass}`}>{prefix}</span>
      {/* Content */}
      <span className={`flex-1 pr-2 ${textClass}`}>
        <span className="whitespace-pre">{line.content || ' '}</span>
      </span>
    </div>
  )
}

export function DiffHunkViewer({ hunks, maxHeight = '300px' }: DiffHunkViewerProps) {
  if (hunks.length === 0) {
    return <div className="text-xs text-muted p-2">No changes to display</div>
  }

  return (
    <div
      className="font-mono text-[11px] bg-surface rounded border border-default overflow-hidden"
      style={{ maxHeight }}
    >
      <div className="overflow-auto" style={{ maxHeight }}>
        {hunks.map((hunk, i) => {
          const lines = parseDiffLines(hunk)
          return (
            <div key={i} className="border-b border-default last:border-0">
              {lines.map((line, j) => (
                <DiffLine key={j} line={line} />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
