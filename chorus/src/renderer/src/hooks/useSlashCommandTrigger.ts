import { useState, useEffect, useCallback, RefObject } from 'react'
import getCaretCoordinates from 'textarea-caret'

interface SlashCommandTriggerState {
  isOpen: boolean
  query: string
  position: { top: number; left: number }
}

interface UseSlashCommandTriggerResult {
  isOpen: boolean
  query: string
  position: { top: number; left: number }
  close: () => void
}

export function useSlashCommandTrigger(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  value: string
): UseSlashCommandTriggerResult {
  const [state, setState] = useState<SlashCommandTriggerState>({
    isOpen: false,
    query: '',
    position: { top: 0, left: 0 }
  })

  // Check if the input starts with / and extract the query
  const findTrigger = useCallback(
    (text: string, cursorPos: number): { query: string } | null => {
      // Only trigger if message starts with /
      if (!text.startsWith('/')) {
        return null
      }

      // Don't show if there's a newline (user started a new line)
      if (text.includes('\n')) {
        return null
      }

      // Extract the command part (everything after / up to first space or end)
      const spaceIndex = text.indexOf(' ')
      const commandEnd = spaceIndex === -1 ? text.length : spaceIndex

      // Only show dropdown if cursor is within the command part
      if (cursorPos > commandEnd) {
        return null
      }

      // Query is everything after / up to cursor (excluding /)
      const query = text.slice(1, cursorPos)

      return { query }
    },
    []
  )

  // Calculate dropdown position
  const calculatePosition = useCallback(
    (): { top: number; left: number } => {
      const textarea = textareaRef.current
      if (!textarea) return { top: 0, left: 0 }

      // Get caret coordinates at position 0 (the / character)
      const coords = getCaretCoordinates(textarea, 0)
      const rect = textarea.getBoundingClientRect()

      // Position above the textarea
      const dropdownHeight = 300 // approximate max height
      let top = rect.top - dropdownHeight - 4
      let left = rect.left + coords.left

      // Ensure dropdown doesn't go off-screen (right)
      const dropdownWidth = 384 // w-96 = 24rem = 384px
      if (left + dropdownWidth > window.innerWidth - 16) {
        left = window.innerWidth - dropdownWidth - 16
      }

      // If not enough room above, show below
      if (top < 16) {
        top = rect.top + coords.top + coords.height + 4
      }

      // Ensure dropdown doesn't go off-screen (left)
      if (left < 16) {
        left = 16
      }

      return { top, left }
    },
    [textareaRef]
  )

  // Update state when value or cursor changes
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const handleUpdate = () => {
      const cursorPos = textarea.selectionStart
      const trigger = findTrigger(value, cursorPos)

      if (trigger) {
        const position = calculatePosition()
        setState({
          isOpen: true,
          query: trigger.query,
          position
        })
      } else {
        setState((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev))
      }
    }

    // Run on value change
    handleUpdate()

    // Also listen for cursor movement
    textarea.addEventListener('select', handleUpdate)
    textarea.addEventListener('click', handleUpdate)
    textarea.addEventListener('keyup', handleUpdate)

    return () => {
      textarea.removeEventListener('select', handleUpdate)
      textarea.removeEventListener('click', handleUpdate)
      textarea.removeEventListener('keyup', handleUpdate)
    }
  }, [value, textareaRef, findTrigger, calculatePosition])

  // Close handler
  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }))
  }, [])

  return {
    isOpen: state.isOpen,
    query: state.query,
    position: state.position,
    close
  }
}
