import { useEffect, useRef, useState, memo } from 'react'

interface MermaidDiagramProps {
  code: string
}

// Lazy load mermaid - singleton pattern
let mermaidPromise: Promise<typeof import('mermaid')> | null = null
const loadMermaid = () => {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          primaryColor: '#4a9eff',
          primaryTextColor: '#e5e7eb',
          primaryBorderColor: '#383a3e',
          lineColor: '#6b7280',
          secondaryColor: '#2c2f33',
          tertiaryColor: '#1a1d21',
          background: '#222529',
          mainBkg: '#2c2f33',
          nodeBorder: '#4a9eff',
          clusterBkg: '#1a1d21',
          clusterBorder: '#383a3e',
          titleColor: '#e5e7eb',
          edgeLabelBackground: '#2c2f33',
        },
        flowchart: {
          htmlLabels: true,
          curve: 'basis',
        },
        sequence: {
          actorMargin: 50,
          showSequenceNumbers: false,
        },
      })
      return m
    })
  }
  return mermaidPromise
}

// SVG Icons
const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 shrink-0 mt-0.5">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)

export const MermaidDiagram = memo(function MermaidDiagram({ code }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const renderDiagram = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const mermaid = await loadMermaid()

        if (cancelled) return

        // Generate unique ID for this diagram
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        // Render the diagram
        const { svg: renderedSvg } = await mermaid.default.render(id, code)

        if (cancelled) return

        setSvg(renderedSvg)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to render diagram')
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    renderDiagram()

    return () => {
      cancelled = true
    }
  }, [code])

  if (isLoading) {
    return (
      <div className="my-3 p-4 rounded-lg border border-default bg-input flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted">
          <div className="w-4 h-4 border-2 border-muted border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Rendering diagram...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="my-3 p-4 rounded-lg border border-red-500/30 bg-red-500/10">
        <div className="flex items-start gap-2">
          <AlertIcon />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-red-400">Failed to render diagram</p>
            <p className="text-xs text-red-400/70 mt-1">{error}</p>
            <pre className="mt-2 text-xs text-muted font-mono bg-input p-2 rounded overflow-x-auto">
              {code}
            </pre>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="my-3 p-4 rounded-lg border border-default bg-input overflow-x-auto">
      <div
        ref={containerRef}
        className="flex justify-center [&>svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: svg || '' }}
      />
    </div>
  )
})
