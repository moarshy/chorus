# Module 4: File System & Git

Integrating file system operations and git commands into Chorus.

---

## What We Built

- **Files tab** in the chat panel
- **File tree** navigation within agent repos
- **Git integration**: branch, commits, status
- **CLAUDE.md detection** to identify agent repos

---

## IPC Handlers Added

### Git Operations (main process)

```typescript
// Helper to run git commands
function runGit(cwd: string, args: string) {
  const output = execSync(`git ${args}`, { cwd, encoding: 'utf-8' })
  return { success: true, output: output.trim() }
}

// Check if directory is a git repo
ipcMain.handle('git-is-repo', async (_event, repoPath) => {
  const gitDir = join(repoPath, '.git')
  return { success: true, isRepo: existsSync(gitDir) }
})

// Get git status (changed files)
ipcMain.handle('git-status', async (_event, repoPath) => {
  const result = runGit(repoPath, 'status --porcelain')
  const files = result.output.split('\n').map(line => ({
    status: line.substring(0, 2),
    file: line.substring(3)
  }))
  return { success: true, files, hasChanges: files.length > 0 }
})

// Get recent commits
ipcMain.handle('git-log', async (_event, repoPath, count = 10) => {
  const result = runGit(repoPath, `log --oneline -n ${count}`)
  const commits = result.output.split('\n').map(line => {
    const [hash, ...msg] = line.split(' ')
    return { hash, message: msg.join(' ') }
  })
  return { success: true, commits }
})

// Get current branch
ipcMain.handle('git-branch', async (_event, repoPath) => {
  const result = runGit(repoPath, 'branch --show-current')
  return { success: true, branch: result.output }
})

// Check for CLAUDE.md
ipcMain.handle('check-claude-config', async (_event, repoPath) => {
  return {
    hasClaudeMd: existsSync(join(repoPath, 'CLAUDE.md')),
    hasClaudeDir: existsSync(join(repoPath, '.claude'))
  }
})
```

---

## Preload API

```typescript
const api = {
  // ... file operations from Module 2

  // Git operations (Module 4)
  gitIsRepo: (repoPath) => ipcRenderer.invoke('git-is-repo', repoPath),
  gitStatus: (repoPath) => ipcRenderer.invoke('git-status', repoPath),
  gitLog: (repoPath, count?) => ipcRenderer.invoke('git-log', repoPath, count),
  gitBranch: (repoPath) => ipcRenderer.invoke('git-branch', repoPath),
  checkClaudeConfig: (repoPath) => ipcRenderer.invoke('check-claude-config', repoPath)
}
```

---

## FilesPanel Component

```tsx
function FilesPanel({ agent }) {
  const [entries, setEntries] = useState([])
  const [branch, setBranch] = useState('')
  const [commits, setCommits] = useState([])

  useEffect(() => {
    if (agent?.repoPath) {
      loadRepoInfo(agent.repoPath)
    }
  }, [agent?.repoPath])

  const loadRepoInfo = async (repoPath) => {
    // Load directory
    const dirResult = await window.api.listDirectory(repoPath)
    setEntries(dirResult.entries)

    // Load git info
    const branchResult = await window.api.gitBranch(repoPath)
    setBranch(branchResult.branch)

    const logResult = await window.api.gitLog(repoPath, 5)
    setCommits(logResult.commits)
  }

  return (
    <div className="flex-1 flex">
      {/* File tree on left */}
      <div className="w-64">
        {entries.map(entry => (
          <button onClick={() => handleEntryClick(entry)}>
            {entry.isDirectory ? '📁' : '📄'} {entry.name}
          </button>
        ))}
      </div>

      {/* Content on right */}
      <div className="flex-1">
        {selectedFile ? (
          <pre>{fileContent}</pre>
        ) : (
          <div>
            <h3>Recent Commits</h3>
            {commits.map(c => <div>{c.hash} {c.message}</div>)}
          </div>
        )}
      </div>
    </div>
  )
}
```

---

## ChatPanel with Tabs

```tsx
function ChatPanel({ agent, messages, onSendMessage }) {
  const [activeTab, setActiveTab] = useState<'messages' | 'files'>('messages')

  return (
    <div>
      {/* Header with agent info */}
      <div className="h-14">
        <h2>{agent.name}</h2>
        <span className="badge">{agent.status}</span>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button onClick={() => setActiveTab('messages')}>Messages</button>
        <button onClick={() => setActiveTab('files')}>Files</button>
      </div>

      {/* Content */}
      {activeTab === 'messages' ? (
        <>
          <MessageList messages={messages} />
          <MessageInput onSend={onSendMessage} />
        </>
      ) : (
        <FilesPanel agent={agent} />
      )}
    </div>
  )
}
```

---

## Git Status Codes

| Code | Meaning |
|------|---------|
| `M ` | Modified (staged) |
| ` M` | Modified (unstaged) |
| `A ` | Added (staged) |
| `??` | Untracked |
| `D ` | Deleted |

---

## Files Created/Modified

| File | Changes |
|------|---------|
| `src/main/index.ts` | Added git IPC handlers |
| `src/preload/index.ts` | Exposed git APIs |
| `src/preload/index.d.ts` | Added git types |
| `src/renderer/src/components/FilesPanel.tsx` | New component |
| `src/renderer/src/components/ChatPanel.tsx` | Added tabs |

---

## For Chorus

This enables:
- Browsing agent repo files without leaving the app
- Seeing git status at a glance
- Detecting CLAUDE.md to verify agent setup
- Future: viewing diffs, committing changes
