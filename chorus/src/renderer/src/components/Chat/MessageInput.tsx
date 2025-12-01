import { useState, useRef, useEffect, KeyboardEvent, useMemo } from 'react'
import type { Agent, Workspace, SlashCommand } from '../../types'
import { useChatStore } from '../../stores/chat-store'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useFileSearch } from '../../hooks/useFileSearch'
import { useMentionTrigger } from '../../hooks/useMentionTrigger'
import { useSlashCommandTrigger } from '../../hooks/useSlashCommandTrigger'
import { MentionDropdown } from './MentionDropdown'
import { SlashCommandDropdown } from './SlashCommandDropdown'

interface MessageInputProps {
  agent: Agent
  workspace: Workspace
}

// SVG Icons
const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

export function MessageInput({ agent, workspace }: MessageInputProps) {
  const [message, setMessage] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { isStreaming, isLoading, sendMessage, activeConversationId, streamingConversationId } = useChatStore()
  const { getCommands, loadCommands } = useWorkspaceStore()

  // Load slash commands when workspace changes
  useEffect(() => {
    loadCommands(workspace.id)
  }, [workspace.id, loadCommands])

  // File search for @ mentions
  const { search } = useFileSearch(workspace.path)

  // Mention trigger detection
  const { isOpen, query, triggerIndex, position, close } = useMentionTrigger(
    textareaRef,
    message
  )

  // Slash command trigger detection
  const {
    isOpen: isCommandOpen,
    query: commandQuery,
    position: commandPosition,
    close: closeCommand
  } = useSlashCommandTrigger(textareaRef, message)

  // Get and filter slash commands
  const allCommands = getCommands(workspace.id)
  const filteredCommands = useMemo(() => {
    if (!isCommandOpen) return []
    const q = commandQuery.toLowerCase()
    return allCommands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(q) ||
        cmd.description?.toLowerCase().includes(q)
    )
  }, [isCommandOpen, commandQuery, allCommands])

  // Filter files based on query
  const filteredFiles = useMemo(() => {
    if (!isOpen) return []
    return search(query)
  }, [isOpen, query, search])

  // Reset selected index when query changes or dropdown opens
  useEffect(() => {
    setSelectedIndex(0)
  }, [query, isOpen])

  // Reset command selected index when command query changes
  useEffect(() => {
    setCommandSelectedIndex(0)
  }, [commandQuery, isCommandOpen])

  // Only disable if THIS conversation is streaming
  const isThisConversationStreaming = isStreaming && streamingConversationId === activeConversationId
  const isDisabled = isThisConversationStreaming || isLoading

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const newHeight = Math.min(textarea.scrollHeight, 150) // Max 4 lines approx
      textarea.style.height = `${newHeight}px`
    }
  }, [message])

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Insert mention into message
  const insertMention = (item: { relativePath: string; isDirectory: boolean }) => {
    const path = item.isDirectory ? `${item.relativePath}/` : item.relativePath
    const before = message.slice(0, triggerIndex)
    const after = message.slice(textareaRef.current?.selectionStart ?? message.length)
    const newMessage = `${before}@${path}${after}`

    setMessage(newMessage)
    close()

    // Set cursor position after the inserted path
    const newCursorPos = triggerIndex + path.length + 1 // +1 for @
    setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  // Execute slash command
  const executeSlashCommand = async (command: SlashCommand) => {
    closeCommand()

    // Extract args from message (everything after command name)
    const commandWithSlash = `/${command.name}`
    const fullMessage = message.trim()

    // Check if message starts with the command
    let args = ''
    if (fullMessage.startsWith(commandWithSlash)) {
      args = fullMessage.slice(commandWithSlash.length).trim()
    }

    try {
      const result = await window.api.commands.execute(workspace.id, command.name, args)
      if (result.success && result.data) {
        // Clear input and send the rendered prompt
        setMessage('')
        await sendMessage(result.data, workspace.id, agent.id, workspace.path, agent.filePath)
      } else {
        // Show error - for now just log it
        console.error('Failed to execute command:', result.error)
      }
    } catch (error) {
      console.error('Failed to execute command:', error)
    }

    // Refocus
    textareaRef.current?.focus()
  }

  const handleSubmit = async () => {
    const trimmed = message.trim()
    if (!trimmed || isDisabled) return

    // Clear input immediately
    setMessage('')

    // Send message with agent's system prompt file
    await sendMessage(trimmed, workspace.id, agent.id, workspace.path, agent.filePath)

    // Refocus
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle slash command dropdown navigation when open
    if (isCommandOpen && filteredCommands.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setCommandSelectedIndex((prev) => (prev + 1) % filteredCommands.length)
          return
        case 'ArrowUp':
          e.preventDefault()
          setCommandSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length)
          return
        case 'Enter':
          e.preventDefault()
          executeSlashCommand(filteredCommands[commandSelectedIndex])
          return
        case 'Tab':
          e.preventDefault()
          // Tab completes the command name in the input
          const selectedCmd = filteredCommands[commandSelectedIndex]
          setMessage(`/${selectedCmd.name} `)
          closeCommand()
          setTimeout(() => {
            const pos = selectedCmd.name.length + 2
            textareaRef.current?.setSelectionRange(pos, pos)
          }, 0)
          return
        case 'Escape':
          e.preventDefault()
          closeCommand()
          return
      }
    }

    // Handle mention dropdown navigation when open
    if (isOpen && filteredFiles.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % filteredFiles.length)
          return
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + filteredFiles.length) % filteredFiles.length)
          return
        case 'Enter':
          e.preventDefault()
          insertMention(filteredFiles[selectedIndex])
          return
        case 'Tab':
          e.preventDefault()
          insertMention(filteredFiles[selectedIndex])
          return
        case 'Escape':
          e.preventDefault()
          close()
          return
      }
    }

    // Enter to send, Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }

    // Escape to stop streaming (only if this conversation is streaming)
    if (e.key === 'Escape' && isThisConversationStreaming) {
      useChatStore.getState().stopAgent(agent.id)
    }
  }

  return (
    <div className="p-4 border-t border-default bg-sidebar">
      <div className="flex items-end gap-3 bg-input rounded-xl border border-default focus-within:border-accent transition-colors">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${agent.name}...`}
          disabled={isDisabled}
          rows={1}
          className="flex-1 bg-transparent px-4 py-3 text-sm text-white placeholder:text-muted resize-none outline-none disabled:opacity-50 max-h-[150px]"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="mention-listbox"
          aria-activedescendant={isOpen ? `mention-option-${selectedIndex}` : undefined}
        />
        <button
          onClick={handleSubmit}
          disabled={isDisabled || !message.trim()}
          className="p-3 text-accent hover:text-accent-hover disabled:text-muted disabled:cursor-not-allowed transition-colors"
        >
          <SendIcon />
        </button>
      </div>

      {/* Slash command dropdown */}
      {isCommandOpen && (
        <SlashCommandDropdown
          commands={filteredCommands}
          selectedIndex={commandSelectedIndex}
          position={commandPosition}
          onSelect={executeSlashCommand}
          onClose={closeCommand}
        />
      )}

      {/* Mention dropdown */}
      {isOpen && (
        <MentionDropdown
          items={filteredFiles}
          selectedIndex={selectedIndex}
          position={position}
          onSelect={insertMention}
          onClose={close}
        />
      )}

      <div className="flex justify-between mt-2 text-xs text-muted px-1">
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-hover font-mono">/</kbd> commands
          {' '}
          <kbd className="px-1.5 py-0.5 rounded bg-hover font-mono">@</kbd> mention files
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-hover font-mono">Enter</kbd> send
          {' '}
          <kbd className="px-1.5 py-0.5 rounded bg-hover font-mono">Shift+Enter</kbd> new line
        </span>
      </div>
    </div>
  )
}
