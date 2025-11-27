import { useState, useEffect } from 'react'
import { Agent } from '../types'

interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
}

interface GitCommit {
  hash: string
  message: string
}

interface FilesPanelProps {
  agent: Agent | null
}

export function FilesPanel({ agent }: FilesPanelProps) {
  const [entries, setEntries] = useState<DirectoryEntry[]>([])
  const [currentPath, setCurrentPath] = useState('')
  const [fileContent, setFileContent] = useState('')
  const [selectedFile, setSelectedFile] = useState('')
  const [branch, setBranch] = useState('')
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [hasClaudeMd, setHasClaudeMd] = useState(false)
  const [loading, setLoading] = useState(false)

  // Load repo info when agent changes
  useEffect(() => {
    if (agent?.repoPath) {
      loadRepoInfo(agent.repoPath)
    }
  }, [agent?.repoPath])

  const loadRepoInfo = async (repoPath: string) => {
    setLoading(true)
    setCurrentPath(repoPath)

    // Load directory
    const dirResult = await window.api.listDirectory(repoPath)
    if (dirResult.success && dirResult.entries) {
      const sorted = dirResult.entries
        .filter((e) => !e.name.startsWith('.') || e.name === '.claude')
        .sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1
          if (!a.isDirectory && b.isDirectory) return 1
          return a.name.localeCompare(b.name)
        })
      setEntries(sorted)
    }

    // Load git info
    const branchResult = await window.api.gitBranch(repoPath)
    if (branchResult.success) {
      setBranch(branchResult.branch || '')
    }

    const logResult = await window.api.gitLog(repoPath, 5)
    if (logResult.success && logResult.commits) {
      setCommits(logResult.commits)
    }

    // Check for CLAUDE.md
    const configResult = await window.api.checkClaudeConfig(repoPath)
    if (configResult.success) {
      setHasClaudeMd(configResult.hasClaudeMd || false)
    }

    setLoading(false)
  }

  const handleEntryClick = async (entry: DirectoryEntry) => {
    if (entry.isDirectory) {
      setCurrentPath(entry.path)
      const result = await window.api.listDirectory(entry.path)
      if (result.success && result.entries) {
        const sorted = result.entries
          .filter((e) => !e.name.startsWith('.') || e.name === '.claude')
          .sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1
            if (!a.isDirectory && b.isDirectory) return 1
            return a.name.localeCompare(b.name)
          })
        setEntries(sorted)
      }
    } else {
      setSelectedFile(entry.path)
      const result = await window.api.readFile(entry.path)
      if (result.success) {
        setFileContent(result.content || '')
      } else {
        setFileContent(`Error: ${result.error}`)
      }
    }
  }

  const handleGoUp = async () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/')
    if (parentPath && agent?.repoPath && parentPath.startsWith(agent.repoPath.split('/').slice(0, -1).join('/'))) {
      setCurrentPath(parentPath)
      const result = await window.api.listDirectory(parentPath)
      if (result.success && result.entries) {
        const sorted = result.entries
          .filter((e) => !e.name.startsWith('.') || e.name === '.claude')
          .sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1
            if (!a.isDirectory && b.isDirectory) return 1
            return a.name.localeCompare(b.name)
          })
        setEntries(sorted)
      }
    }
  }

  if (!agent) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--chat-bg)]">
        <p className="text-[var(--text-secondary)]">Select an agent to view files</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-[var(--chat-bg)]">
      {/* Header */}
      <div className="h-14 px-4 flex items-center border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-white">Files</h2>
          {branch && (
            <span className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-400">
              {branch}
            </span>
          )}
          {hasClaudeMd && (
            <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
              CLAUDE.md
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[var(--text-secondary)]">Loading...</p>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* File Tree */}
          <div className="w-64 border-r border-[var(--border-color)] overflow-y-auto">
            {/* Path bar */}
            <div className="p-2 border-b border-[var(--border-color)] flex items-center gap-2">
              {currentPath !== agent.repoPath && (
                <button
                  onClick={handleGoUp}
                  className="text-xs px-2 py-1 bg-[var(--input-bg)] rounded hover:bg-white/10"
                >
                  ..
                </button>
              )}
              <span className="text-xs text-[var(--text-secondary)] truncate">
                {currentPath.replace(agent.repoPath, '~') || '~'}
              </span>
            </div>

            {/* Entries */}
            <div className="py-1">
              {entries.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() => handleEntryClick(entry)}
                  className={`w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/5 text-left ${
                    entry.path === selectedFile ? 'bg-white/10' : ''
                  }`}
                >
                  <span>{entry.isDirectory ? '📁' : '📄'}</span>
                  <span className="text-sm truncate">{entry.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* File Content / Git Info */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedFile ? (
              <>
                <div className="p-2 border-b border-[var(--border-color)]">
                  <span className="text-xs text-[var(--text-secondary)]">
                    {selectedFile.split('/').pop()}
                  </span>
                </div>
                <pre className="flex-1 p-4 overflow-auto text-sm font-mono text-[var(--text-primary)]">
                  {fileContent}
                </pre>
              </>
            ) : (
              <div className="p-4">
                <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">
                  Recent Commits
                </h3>
                {commits.length === 0 ? (
                  <p className="text-[var(--text-secondary)] text-sm">No commits found</p>
                ) : (
                  <div className="space-y-2">
                    {commits.map((commit) => (
                      <div
                        key={commit.hash}
                        className="flex items-start gap-2 text-sm"
                      >
                        <code className="text-yellow-500 font-mono">{commit.hash}</code>
                        <span className="text-[var(--text-primary)]">{commit.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
