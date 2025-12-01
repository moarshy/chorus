import { useEffect, useRef } from 'react'
import type { SlashCommand } from '../../types'

interface SlashCommandDropdownProps {
  commands: SlashCommand[]
  selectedIndex: number
  position: { top: number; left: number }
  onSelect: (command: SlashCommand) => void
  onClose: () => void
}

// Command icon
function CommandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-blue-400">
      <path
        d="M13 10V3L4 14h7v7l9-11h-7z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SlashCommandDropdown({
  commands,
  selectedIndex,
  position,
  onSelect,
  onClose
}: SlashCommandDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const selectedItemRef = useRef<HTMLButtonElement>(null)

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Scroll selected item into view
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (commands.length === 0) {
    return (
      <div
        ref={dropdownRef}
        className="fixed z-50 bg-sidebar border border-default rounded-lg shadow-lg py-2 px-3 w-96"
        style={{ top: position.top, left: position.left }}
      >
        <span className="text-muted text-sm">No commands found</span>
      </div>
    )
  }

  return (
    <div
      ref={dropdownRef}
      className="fixed z-50 bg-sidebar border border-default rounded-lg shadow-lg py-1 w-96 max-h-72 overflow-y-auto"
      style={{ top: position.top, left: position.left }}
      role="listbox"
      id="command-listbox"
    >
      {commands.map((command, index) => (
        <button
          key={command.name}
          ref={index === selectedIndex ? selectedItemRef : null}
          className={`w-full flex flex-col gap-0.5 px-3 py-2 text-left transition-colors ${
            index === selectedIndex ? 'bg-hover' : 'hover:bg-hover/50'
          }`}
          onClick={() => onSelect(command)}
          role="option"
          aria-selected={index === selectedIndex}
          id={`command-option-${index}`}
        >
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0">
              <CommandIcon />
            </span>
            <span className="text-blue-400 font-mono text-sm">/{command.name}</span>
            {command.argumentHint && (
              <span className="text-muted text-xs">{command.argumentHint}</span>
            )}
          </div>
          {command.description && (
            <div className="text-muted text-xs ml-6 truncate">
              {command.description}
            </div>
          )}
        </button>
      ))}
    </div>
  )
}
