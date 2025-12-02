import type { EditorFontFamily } from '../types'

// Font family CSS stacks
export const FONT_STACKS: Record<EditorFontFamily, string> = {
  'default': "'SF Mono', Menlo, Monaco, 'Courier New', monospace",
  'jetbrains-mono': "'JetBrains Mono', monospace",
  'fira-code': "'Fira Code', monospace",
  'sf-mono': "'SF Mono', monospace",
  'consolas': "Consolas, monospace"
}

// Get CSS font-family string for a given font family setting
export function getFontStack(fontFamily: EditorFontFamily | undefined): string {
  return FONT_STACKS[fontFamily || 'default']
}
