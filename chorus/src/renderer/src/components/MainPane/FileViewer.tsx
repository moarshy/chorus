import { useEffect, useState } from 'react'
import { Highlight, themes } from 'prism-react-renderer'

interface FileViewerProps {
  filePath: string
}

export function FileViewer({ filePath }: FileViewerProps): JSX.Element {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Extract filename and extension
  const filename = filePath.split('/').pop() || ''
  const extension = filename.split('.').pop()?.toLowerCase() || ''

  useEffect(() => {
    setIsLoading(true)
    setError(null)

    window.api.fs
      .readFile(filePath)
      .then((result) => {
        if (result.success && result.data !== undefined) {
          setContent(result.data)
        } else {
          setError(result.error || 'Failed to read file')
        }
      })
      .catch((err) => {
        setError(String(err))
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [filePath])

  // Get breadcrumb path
  const breadcrumbs = filePath.split('/').slice(-3)

  // Map extension to Prism language
  const language = getLanguage(extension)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted">
        Loading file...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-status-error mb-2">Error loading file</p>
          <p className="text-sm text-muted">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb header */}
      <div className="px-4 py-2 border-b border-default flex items-center gap-1 text-sm">
        {breadcrumbs.map((part, i) => (
          <span key={i} className="flex items-center">
            {i > 0 && <span className="mx-1 text-muted">/</span>}
            <span className={i === breadcrumbs.length - 1 ? 'text-primary' : 'text-muted'}>
              {part}
            </span>
          </span>
        ))}
      </div>

      {/* File content with syntax highlighting */}
      <div className="flex-1 overflow-auto">
        <Highlight theme={themes.vsDark} code={content || ''} language={language}>
          {({ style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className="code-block p-4 m-0 min-h-full"
              style={{ ...style, background: 'transparent' }}
            >
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })} className="table-row">
                  <span className="table-cell pr-4 text-right text-muted select-none w-12">
                    {i + 1}
                  </span>
                  <span className="table-cell">
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </span>
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </div>
    </div>
  )
}

function getLanguage(extension: string): string {
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    json: 'json',
    md: 'markdown',
    css: 'css',
    scss: 'scss',
    html: 'html',
    py: 'python',
    yml: 'yaml',
    yaml: 'yaml',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    sql: 'sql',
    graphql: 'graphql',
    gql: 'graphql',
    rs: 'rust',
    go: 'go',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    rb: 'ruby',
    php: 'php',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp'
  }
  return languageMap[extension] || 'text'
}
