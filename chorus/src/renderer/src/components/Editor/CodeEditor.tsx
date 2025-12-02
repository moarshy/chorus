import { useMemo, useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { vscodeDark } from '@uiw/codemirror-theme-vscode'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { bracketMatching } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { search, searchKeymap } from '@codemirror/search'
import { getLanguageExtension } from './languageSupport'
import { useWorkspaceStore } from '../../stores/workspace-store'
import { getFontStack } from '../../utils/editorFonts'

interface CodeEditorProps {
  content: string
  language: string
  onChange?: (value: string) => void
  onSave?: () => void
  readOnly?: boolean
}

export function CodeEditor({
  content,
  language,
  onChange,
  onSave,
  readOnly = false
}: CodeEditorProps) {
  // Get font settings from store - subscribe to specific values for reactivity
  const fontFamily = useWorkspaceStore((state) => state.settings?.editorFontFamily || 'default')
  const fontSize = useWorkspaceStore((state) => state.settings?.editorFontSize || 14)

  // Build extensions array, memoized to prevent re-renders
  const extensions = useMemo(() => {
    const fontStack = getFontStack(fontFamily)

    const exts = [
      EditorView.lineWrapping,
      bracketMatching(),
      closeBrackets(),
      search(),
      // Apply custom font settings
      EditorView.theme({
        '&': {
          fontFamily: fontStack,
          fontSize: `${fontSize}px`
        },
        '.cm-content': {
          fontFamily: fontStack,
          fontSize: `${fontSize}px`
        },
        '.cm-gutters': {
          fontFamily: fontStack,
          fontSize: `${fontSize}px`
        }
      })
    ]

    // Add language-specific extension if available
    const langExt = getLanguageExtension(language)
    if (langExt) {
      exts.push(langExt)
    }

    // Build keymap with save handler first (higher priority)
    const saveKeymap = onSave
      ? [{
          key: 'Mod-s',
          preventDefault: true,
          run: () => {
            onSave()
            return true
          }
        }]
      : []

    // Add combined keymap - save first for higher priority
    exts.push(keymap.of([
      ...saveKeymap,
      ...defaultKeymap,
      ...closeBracketsKeymap,
      ...searchKeymap,
      indentWithTab
    ]))

    // Add read-only state if needed
    if (readOnly) {
      exts.push(EditorState.readOnly.of(true))
    }

    return exts
  }, [language, onSave, readOnly, fontFamily, fontSize])

  // Handle content changes
  const handleChange = useCallback(
    (value: string) => {
      if (onChange) {
        onChange(value)
      }
    },
    [onChange]
  )

  return (
    <CodeMirror
      value={content}
      height="100%"
      style={{ height: '100%', overflow: 'hidden' }}
      theme={vscodeDark}
      extensions={extensions}
      onChange={handleChange}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLineGutter: true,
        highlightActiveLine: true,
        foldGutter: false,
        dropCursor: true,
        allowMultipleSelections: true,
        indentOnInput: true,
        bracketMatching: false, // We add our own
        closeBrackets: false, // We add our own
        autocompletion: false,
        rectangularSelection: true,
        crosshairCursor: false,
        highlightSelectionMatches: true,
        closeBracketsKeymap: false, // We add our own
        searchKeymap: false, // We add our own
        foldKeymap: false,
        completionKeymap: false,
        lintKeymap: false
      }}
    />
  )
}
