import { memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from './CodeBlock'

interface MarkdownContentProps {
  content: string
  className?: string
}

// Memoize to prevent re-renders during streaming
export const MarkdownContent = memo(function MarkdownContent({
  content,
  className = ''
}: MarkdownContentProps) {
  // Handle empty or invalid content gracefully
  if (!content || typeof content !== 'string') {
    return null
  }

  const components = useMemo(() => ({
    // Code blocks with syntax highlighting
    code: ({ className: codeClassName, children, node, ...props }: any) => {
      const match = /language-(\w+)/.exec(codeClassName || '')
      const language = match ? match[1] : ''

      // Check if this is inside a <pre> tag (i.e., a code block, not inline)
      const isCodeBlock = node?.position && node?.tagName === 'code' &&
        (language || String(children).includes('\n'))

      if (isCodeBlock || language) {
        return (
          <CodeBlock
            code={String(children).replace(/\n$/, '')}
            language={language}
          />
        )
      }

      // Inline code
      return (
        <code
          className="px-1.5 py-0.5 rounded bg-sidebar text-accent text-[0.9em] font-mono"
          {...props}
        >
          {children}
        </code>
      )
    },

    // Let pre pass through - code component handles everything
    pre: ({ children }: any) => <>{children}</>,

    // Other markdown elements styled for dark theme
    p: ({ children }: any) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
    h1: ({ children }: any) => <h1 className="text-xl font-bold mb-3 mt-4 first:mt-0">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h3>,
    h4: ({ children }: any) => <h4 className="text-sm font-bold mb-2 mt-2 first:mt-0">{children}</h4>,
    h5: ({ children }: any) => <h5 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h5>,
    h6: ({ children }: any) => <h6 className="text-sm font-medium mb-1 mt-2 first:mt-0 text-secondary">{children}</h6>,
    ul: ({ children }: any) => <ul className="list-disc list-inside mb-3 space-y-1 ml-1">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal list-inside mb-3 space-y-1 ml-1">{children}</ol>,
    li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-accent pl-4 italic text-secondary my-3">
        {children}
      </blockquote>
    ),
    a: ({ href, children }: any) => (
      <a
        href={href}
        className="text-accent hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    table: ({ children }: any) => (
      <div className="overflow-x-auto my-3">
        <table className="min-w-full border border-default">{children}</table>
      </div>
    ),
    thead: ({ children }: any) => <thead className="bg-sidebar">{children}</thead>,
    tbody: ({ children }: any) => <tbody>{children}</tbody>,
    tr: ({ children }: any) => <tr className="border-b border-default">{children}</tr>,
    th: ({ children }: any) => (
      <th className="px-3 py-2 border border-default text-left font-semibold text-sm">
        {children}
      </th>
    ),
    td: ({ children }: any) => (
      <td className="px-3 py-2 border border-default text-sm">{children}</td>
    ),
    hr: () => <hr className="my-4 border-default" />,
    strong: ({ children }: any) => <strong className="font-bold">{children}</strong>,
    em: ({ children }: any) => <em className="italic">{children}</em>,
    del: ({ children }: any) => <del className="line-through text-muted">{children}</del>,
    // Task list items (GFM)
    input: ({ checked, ...props }: any) => (
      <input
        type="checkbox"
        checked={checked}
        readOnly
        className="mr-2 accent-accent"
        {...props}
      />
    ),
  }), [])

  return (
    <div className={`prose-chat ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})
