import { useState, memo } from 'react'
import { Highlight, themes } from 'prism-react-renderer'
import { MermaidDiagram } from './MermaidDiagram'

interface CodeBlockProps {
  code: string
  language: string
}

// SVG Icons
const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
)

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export const CodeBlock = memo(function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  // Handle mermaid diagrams
  if (language === 'mermaid') {
    return <MermaidDiagram code={code} />
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Normalize language for prism
  const normalizedLanguage = normalizeLanguage(language)

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-default">
      {/* Header with language and copy button */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-sidebar text-xs">
        <span className="text-muted font-mono">{language || 'text'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-muted hover:text-primary transition-colors"
          title="Copy code"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      {/* Code content */}
      <Highlight theme={themes.vsDark} code={code} language={normalizedLanguage}>
        {({ style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className="code-block p-4 m-0 overflow-x-auto text-sm"
            style={{ ...style, background: 'var(--input-bg)' }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  )
})

function normalizeLanguage(lang: string): string {
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
    shell: 'bash',
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
    'c++': 'cpp',
    h: 'c',
    hpp: 'cpp',
    diff: 'diff',
    dockerfile: 'docker',
    docker: 'docker',
  }
  return languageMap[lang?.toLowerCase()] || lang || 'text'
}
