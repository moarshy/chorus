import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

export interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
}

// Max file size to read (1MB)
const MAX_FILE_SIZE = 1024 * 1024

// Hidden files/directories to always hide (except .claude)
const HIDDEN_PATTERNS = [
  /^\.git$/,
  /^\.DS_Store$/,
  /^\.vscode$/,
  /^\.idea$/,
  /^node_modules$/,
  /^\.next$/,
  /^\.nuxt$/,
  /^dist$/,
  /^build$/,
  /^out$/,
  /^\.cache$/,
  /^\.parcel-cache$/,
  /^coverage$/,
  /^__pycache__$/,
  /^\.pytest_cache$/,
  /^\.mypy_cache$/,
  /^\.tox$/,
  /^\.eggs$/,
  /^\.egg-info$/,
  /^\.venv$/,
  /^venv$/,
  /^env$/,
  /^\.env\.local$/
]

function shouldHide(name: string): boolean {
  // Always show .claude directory
  if (name === '.claude') return false

  // Hide files matching patterns
  return HIDDEN_PATTERNS.some((pattern) => pattern.test(name))
}

/**
 * List directory contents, sorted with directories first
 */
export async function listDirectory(dirPath: string): Promise<DirectoryEntry[]> {
  const entries: DirectoryEntry[] = []

  const items = readdirSync(dirPath)

  for (const name of items) {
    if (shouldHide(name)) continue

    const fullPath = join(dirPath, name)
    try {
      const stats = statSync(fullPath)
      entries.push({
        name,
        path: fullPath,
        isDirectory: stats.isDirectory()
      })
    } catch {
      // Skip files we can't stat
    }
  }

  // Sort: directories first, then alphabetically
  entries.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })

  return entries
}

/**
 * Read file contents
 */
export async function readFile(filePath: string): Promise<string> {
  const stats = statSync(filePath)

  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(
      `File too large (${Math.round(stats.size / 1024)}KB). Maximum size is ${MAX_FILE_SIZE / 1024}KB.`
    )
  }

  // Check if file is binary
  const content = readFileSync(filePath)

  // Simple binary detection: check for null bytes in first 8KB
  const sample = content.slice(0, 8192)
  const hasNullByte = sample.includes(0)

  if (hasNullByte) {
    throw new Error('Binary file cannot be displayed')
  }

  return content.toString('utf-8')
}
