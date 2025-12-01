# Sprint 10: Implementation Plan - Slash Commands

## Overview

This document describes the implementation plan for slash commands support in Chorus. The feature enables users to discover and execute reusable prompt templates defined in workspace repositories.

## Phase 1: Backend - Command Discovery Service

### File: `chorus/src/main/services/slash-command-service.ts` (new)

Create a new service to handle slash command discovery and parsing.

```typescript
import * as fs from 'fs'
import * as path from 'path'
import matter from 'gray-matter'  // Need to add dependency

interface SlashCommand {
  name: string
  path: string
  filePath: string
  description?: string
  argumentHint?: string
  allowedTools?: string
  model?: string
  content: string
}

export async function discoverCommands(repoPath: string): Promise<SlashCommand[]> {
  const commandsDir = path.join(repoPath, '.claude', 'commands')

  if (!fs.existsSync(commandsDir)) {
    return []
  }

  const commands: SlashCommand[] = []
  await scanDirectory(commandsDir, commandsDir, commands)
  return commands
}

async function scanDirectory(
  baseDir: string,
  currentDir: string,
  commands: SlashCommand[]
): Promise<void> {
  const entries = await fs.promises.readdir(currentDir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name)

    if (entry.isDirectory()) {
      await scanDirectory(baseDir, fullPath, commands)
    } else if (entry.name.endsWith('.md')) {
      const command = await parseCommandFile(baseDir, fullPath)
      if (command) {
        commands.push(command)
      }
    }
  }
}

async function parseCommandFile(
  baseDir: string,
  filePath: string
): Promise<SlashCommand | null> {
  try {
    const fileContent = await fs.promises.readFile(filePath, 'utf-8')

    if (!fileContent.trim()) {
      console.warn(`Empty command file: ${filePath}`)
      return null
    }

    const { data: frontmatter, content } = matter(fileContent)

    // Derive command name from path
    const relativePath = path.relative(baseDir, filePath)
    const name = relativePath
      .replace(/\.md$/, '')
      .replace(/\\/g, '/')  // Normalize path separators

    return {
      name,
      path: relativePath,
      filePath,
      description: frontmatter.description,
      argumentHint: frontmatter['argument-hint'],
      allowedTools: frontmatter['allowed-tools'],
      model: frontmatter.model,
      content: content.trim()
    }
  } catch (error) {
    console.error(`Failed to parse command file: ${filePath}`, error)
    return null
  }
}

export function substituteArguments(template: string, args: string): string {
  const argList = args.trim().split(/\s+/).filter(Boolean)

  let result = template

  // Replace $ARGUMENTS with full argument string
  result = result.replace(/\$ARGUMENTS/g, args.trim())

  // Replace positional arguments $1, $2, etc.
  for (let i = 0; i < 9; i++) {
    const placeholder = `$${i + 1}`
    const value = argList[i] || ''
    result = result.replace(new RegExp(`\\$${i + 1}`, 'g'), value)
  }

  return result
}
```

### Dependencies

Add `gray-matter` for YAML frontmatter parsing:

```bash
cd chorus && bun add gray-matter
```

## Phase 2: IPC Layer

### File: `chorus/src/main/index.ts`

Add IPC handlers for slash command operations:

```typescript
import { discoverCommands, substituteArguments } from './services/slash-command-service'

// In registerIpcHandlers():

ipcMain.handle('workspace:get-commands', async (_event, workspaceId: string) => {
  try {
    const workspace = store.get('workspaces', []).find(w => w.id === workspaceId)
    if (!workspace) {
      return { success: false, error: 'Workspace not found' }
    }

    const commands = await discoverCommands(workspace.path)
    return { success: true, data: commands }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('workspace:refresh-commands', async (_event, workspaceId: string) => {
  // Same implementation as get-commands (always re-scans)
  // Could add caching in future
})

ipcMain.handle('workspace:execute-command', async (
  _event,
  workspaceId: string,
  commandName: string,
  args: string
) => {
  try {
    const workspace = store.get('workspaces', []).find(w => w.id === workspaceId)
    if (!workspace) {
      return { success: false, error: 'Workspace not found' }
    }

    const commands = await discoverCommands(workspace.path)
    const command = commands.find(c => c.name === commandName)

    if (!command) {
      return { success: false, error: `Command not found: ${commandName}` }
    }

    const renderedPrompt = substituteArguments(command.content, args)
    return { success: true, data: renderedPrompt }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})
```

### File: `chorus/src/preload/index.ts`

Expose slash command APIs to renderer:

```typescript
// Add to contextBridge.exposeInMainWorld('api', { ... }):

workspace: {
  // ... existing methods ...

  getCommands: (workspaceId: string) =>
    ipcRenderer.invoke('workspace:get-commands', workspaceId),

  refreshCommands: (workspaceId: string) =>
    ipcRenderer.invoke('workspace:refresh-commands', workspaceId),

  executeCommand: (workspaceId: string, commandName: string, args: string) =>
    ipcRenderer.invoke('workspace:execute-command', workspaceId, commandName, args),
}
```

### File: `chorus/src/preload/index.d.ts`

Add type definitions:

```typescript
interface SlashCommand {
  name: string
  path: string
  filePath: string
  description?: string
  argumentHint?: string
  allowedTools?: string
  model?: string
  content: string
}

interface WorkspaceAPI {
  // ... existing methods ...
  getCommands: (workspaceId: string) => Promise<Result<SlashCommand[]>>
  refreshCommands: (workspaceId: string) => Promise<Result<SlashCommand[]>>
  executeCommand: (workspaceId: string, commandName: string, args: string) => Promise<Result<string>>
}
```

## Phase 3: State Management

### File: `chorus/src/renderer/src/stores/workspace-store.ts`

Add slash commands state and actions:

```typescript
interface WorkspaceStore {
  // ... existing fields ...

  workspaceCommands: Map<string, SlashCommand[]>

  // Actions
  loadCommands: (workspaceId: string) => Promise<void>
  refreshCommands: (workspaceId: string) => Promise<void>
  getCommands: (workspaceId: string) => SlashCommand[]
}

// In store implementation:

workspaceCommands: new Map(),

loadCommands: async (workspaceId: string) => {
  const result = await window.api.workspace.getCommands(workspaceId)
  if (result.success && result.data) {
    set((state) => {
      const newMap = new Map(state.workspaceCommands)
      newMap.set(workspaceId, result.data)
      return { workspaceCommands: newMap }
    })
  }
},

refreshCommands: async (workspaceId: string) => {
  const result = await window.api.workspace.refreshCommands(workspaceId)
  if (result.success && result.data) {
    set((state) => {
      const newMap = new Map(state.workspaceCommands)
      newMap.set(workspaceId, result.data)
      return { workspaceCommands: newMap }
    })
  }
},

getCommands: (workspaceId: string) => {
  return get().workspaceCommands.get(workspaceId) || []
},
```

### Load Commands on Workspace Selection

In `selectWorkspace` action, add:

```typescript
selectWorkspace: async (workspaceId: string) => {
  // ... existing code ...

  // Load slash commands
  get().loadCommands(workspaceId)
}
```

### Refresh on Branch Change

In git checkout handler or branch change logic:

```typescript
// After successful branch checkout:
get().refreshCommands(workspaceId)
```

## Phase 4: UI Components

### File: `chorus/src/renderer/src/components/Chat/SlashCommandAutocomplete.tsx` (new)

```typescript
import React, { useState, useEffect, useRef } from 'react'
import { useWorkspaceStore } from '../../stores/workspace-store'

interface Props {
  workspaceId: string
  inputValue: string
  onSelect: (command: SlashCommand, args: string) => void
  onClose: () => void
}

export function SlashCommandAutocomplete({
  workspaceId,
  inputValue,
  onSelect,
  onClose
}: Props) {
  const commands = useWorkspaceStore((s) => s.getCommands(workspaceId))
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Parse input to get command prefix for filtering
  const match = inputValue.match(/^\/(\S*)/)
  const searchTerm = match ? match[1].toLowerCase() : ''

  // Filter commands by search term
  const filteredCommands = commands.filter((cmd) =>
    cmd.name.toLowerCase().includes(searchTerm) ||
    cmd.description?.toLowerCase().includes(searchTerm)
  )

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchTerm])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && filteredCommands.length > 0) {
        e.preventDefault()
        const selected = filteredCommands[selectedIndex]
        // Extract args from input (everything after command name)
        const args = inputValue.replace(/^\/\S*\s*/, '')
        onSelect(selected, args)
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [filteredCommands, selectedIndex, inputValue, onSelect, onClose])

  if (filteredCommands.length === 0) {
    return (
      <div className="absolute bottom-full left-0 w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-400">
        No commands found
      </div>
    )
  }

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 w-full max-h-64 overflow-y-auto bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg"
    >
      {filteredCommands.map((cmd, index) => (
        <div
          key={cmd.name}
          className={`px-3 py-2 cursor-pointer ${
            index === selectedIndex ? 'bg-zinc-700' : 'hover:bg-zinc-700/50'
          }`}
          onClick={() => {
            const args = inputValue.replace(/^\/\S*\s*/, '')
            onSelect(cmd, args)
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-blue-400 font-mono">/{cmd.name}</span>
            {cmd.argumentHint && (
              <span className="text-zinc-500 text-sm">{cmd.argumentHint}</span>
            )}
          </div>
          {cmd.description && (
            <div className="text-zinc-400 text-sm mt-0.5 truncate">
              {cmd.description}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

### File: `chorus/src/renderer/src/components/Chat/ChatInput.tsx`

Integrate autocomplete into chat input:

```typescript
import { SlashCommandAutocomplete } from './SlashCommandAutocomplete'

// In component:
const [showAutocomplete, setShowAutocomplete] = useState(false)

// Detect slash command input
useEffect(() => {
  const shouldShow = inputValue.startsWith('/') && !inputValue.includes('\n')
  setShowAutocomplete(shouldShow)
}, [inputValue])

// Handle command selection
const handleCommandSelect = async (command: SlashCommand, args: string) => {
  setShowAutocomplete(false)

  // Execute command to get rendered prompt
  const result = await window.api.workspace.executeCommand(
    workspaceId,
    command.name,
    args
  )

  if (result.success && result.data) {
    // Send as user message
    // Optionally show "Executed /command-name args" indicator
    onSendMessage(result.data)
    setInputValue('')
  } else {
    // Show error toast
    toast.error(result.error || 'Failed to execute command')
  }
}

// In render:
<div className="relative">
  {showAutocomplete && (
    <SlashCommandAutocomplete
      workspaceId={workspaceId}
      inputValue={inputValue}
      onSelect={handleCommandSelect}
      onClose={() => setShowAutocomplete(false)}
    />
  )}
  <textarea ... />
</div>
```

### File: `chorus/src/renderer/src/components/MainPane/WorkspaceOverview.tsx`

Add commands section to workspace overview:

```typescript
import { useWorkspaceStore } from '../../stores/workspace-store'

// In component:
const commands = useWorkspaceStore((s) =>
  s.selectedWorkspace ? s.getCommands(s.selectedWorkspace.id) : []
)

// In render (add new section):
{commands.length > 0 && (
  <section className="mt-6">
    <h3 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      Slash Commands ({commands.length})
    </h3>
    <div className="space-y-1">
      {commands.slice(0, 5).map((cmd) => (
        <div key={cmd.name} className="flex items-center gap-3 text-sm">
          <span className="text-blue-400 font-mono">/{cmd.name}</span>
          <span className="text-zinc-500 truncate">{cmd.description}</span>
        </div>
      ))}
      {commands.length > 5 && (
        <div className="text-zinc-500 text-sm">
          +{commands.length - 5} more commands
        </div>
      )}
    </div>
  </section>
)}
```

## Phase 5: Testing

### Manual Testing Checklist

- [ ] Workspace without `.claude/commands/` shows empty commands list
- [ ] Workspace with commands shows correct count
- [ ] Typing `/` shows autocomplete dropdown
- [ ] Autocomplete filters as user types
- [ ] Keyboard navigation (↑/↓) works in autocomplete
- [ ] Enter selects command and sends rendered prompt
- [ ] Escape closes autocomplete
- [ ] Click outside closes autocomplete
- [ ] `$ARGUMENTS` substitution works
- [ ] Positional args (`$1`, `$2`) work
- [ ] Missing args become empty string
- [ ] Invalid command shows error toast
- [ ] Commands refresh on branch change
- [ ] Nested commands (subdirectories) appear correctly
- [ ] Frontmatter parsing handles missing fields
- [ ] Empty `.md` files are skipped

### Test Data

Create test commands in a workspace:

```bash
mkdir -p .claude/commands/frontend

# Simple command
cat > .claude/commands/review-pr.md << 'EOF'
---
description: Review a pull request for code quality
argument-hint: [pr-number]
---

Review pull request #$1. Focus on:
- Code quality and best practices
- Potential bugs or edge cases
- Security vulnerabilities
- Performance implications

$ARGUMENTS
EOF

# Nested command
cat > .claude/commands/frontend/component.md << 'EOF'
---
description: Generate a React component
argument-hint: [component-name]
---

Create a new React component named $1 with:
- TypeScript types
- Tailwind CSS styling
- Unit tests
EOF
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      Main Process                                │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              slash-command-service.ts                        │ │
│  │  ┌─────────────────┐    ┌─────────────────┐                 │ │
│  │  │ discoverCommands│    │ substituteArgs  │                 │ │
│  │  │ (scan .claude/) │    │ ($1, $ARGS)     │                 │ │
│  │  └────────┬────────┘    └────────┬────────┘                 │ │
│  └───────────┼──────────────────────┼──────────────────────────┘ │
│              │                      │                            │
│              ▼                      ▼                            │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    IPC Handlers                              │ │
│  │  workspace:get-commands   workspace:execute-command          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Preload Bridge                              │
│  window.api.workspace.getCommands / executeCommand               │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Renderer Process                            │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    workspace-store                           │ │
│  │  workspaceCommands: Map<workspaceId, SlashCommand[]>         │ │
│  └─────────────────────────────────────────────────────────────┘ │
│              │                      │                            │
│              ▼                      ▼                            │
│  ┌─────────────────────┐  ┌─────────────────────────┐           │
│  │ WorkspaceOverview   │  │ SlashCommandAutocomplete │           │
│  │ (commands section)  │  │ (dropdown in ChatInput)  │           │
│  └─────────────────────┘  └─────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `chorus/src/main/services/slash-command-service.ts` | Create | Command discovery and parsing |
| `chorus/src/main/index.ts` | Modify | Add IPC handlers |
| `chorus/src/preload/index.ts` | Modify | Expose APIs |
| `chorus/src/preload/index.d.ts` | Modify | Add type definitions |
| `chorus/src/renderer/src/stores/workspace-store.ts` | Modify | Add commands state |
| `chorus/src/renderer/src/components/Chat/SlashCommandAutocomplete.tsx` | Create | Autocomplete UI |
| `chorus/src/renderer/src/components/Chat/ChatInput.tsx` | Modify | Integrate autocomplete |
| `chorus/src/renderer/src/components/MainPane/WorkspaceOverview.tsx` | Modify | Commands section |

## Dependencies

```bash
cd chorus && bun add gray-matter
```

## Known Limitations

1. **No Personal Commands**: Only workspace commands (`.claude/commands/`) are supported. Personal commands (`~/.claude/commands/`) are not scanned.

2. **No Bash Execution**: The `!` prefix for executing bash commands before the prompt is not supported. Templates with `!` prefixed lines will include them literally.

3. **No File Includes**: The `@` prefix for including file contents is not supported.

4. **Simple Argument Parsing**: Arguments are split by whitespace. Quoted strings like `"arg with spaces"` are not parsed as single arguments.

5. **No Tool Restrictions**: The `allowed-tools` frontmatter is displayed but not enforced.

6. **No Model Override**: The `model` frontmatter is displayed but not used to change the agent's model.

## Future Enhancements

1. Add personal commands support (`~/.claude/commands/`)
2. Support `@file` includes in templates
3. Add quoted string argument parsing
4. Command preview on hover/click
5. Command editing within Chorus UI
6. Command usage analytics
