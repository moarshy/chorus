import { existsSync, readdirSync, readFileSync } from 'fs'
import { join, relative } from 'path'
import matter from 'gray-matter'

/**
 * Slash command parsed from .claude/commands/*.md files
 */
export interface SlashCommand {
  name: string              // Derived from filename (without .md)
  path: string              // Relative path within .claude/commands/
  filePath: string          // Absolute path to .md file
  description?: string      // From frontmatter
  argumentHint?: string     // From frontmatter
  allowedTools?: string     // From frontmatter
  model?: string            // From frontmatter
  content: string           // Full Markdown content (without frontmatter)
}

/**
 * Discover all slash commands in a repository's .claude/commands/ directory
 */
export async function discoverCommands(repoPath: string): Promise<SlashCommand[]> {
  const commandsDir = join(repoPath, '.claude', 'commands')

  if (!existsSync(commandsDir)) {
    return []
  }

  const commands: SlashCommand[] = []
  await scanDirectory(commandsDir, commandsDir, commands)

  // Sort commands alphabetically by name
  commands.sort((a, b) => a.name.localeCompare(b.name))

  return commands
}

/**
 * Recursively scan directory for .md command files
 */
async function scanDirectory(
  baseDir: string,
  currentDir: string,
  commands: SlashCommand[]
): Promise<void> {
  try {
    const entries = readdirSync(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)

      if (entry.isDirectory()) {
        // Recurse into subdirectories
        await scanDirectory(baseDir, fullPath, commands)
      } else if (entry.name.endsWith('.md')) {
        const command = parseCommandFile(baseDir, fullPath)
        if (command) {
          commands.push(command)
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning commands directory: ${currentDir}`, error)
  }
}

/**
 * Parse a single command file
 */
function parseCommandFile(baseDir: string, filePath: string): SlashCommand | null {
  try {
    const fileContent = readFileSync(filePath, 'utf-8')

    if (!fileContent.trim()) {
      console.warn(`Empty command file: ${filePath}`)
      return null
    }

    // Parse frontmatter and content
    const { data: frontmatter, content } = matter(fileContent)

    // Derive command name from path
    const relativePath = relative(baseDir, filePath)
    const name = relativePath
      .replace(/\.md$/, '')
      .replace(/\\/g, '/')  // Normalize path separators for Windows

    return {
      name,
      path: relativePath,
      filePath,
      description: frontmatter.description as string | undefined,
      argumentHint: frontmatter['argument-hint'] as string | undefined,
      allowedTools: frontmatter['allowed-tools'] as string | undefined,
      model: frontmatter.model as string | undefined,
      content: content.trim()
    }
  } catch (error) {
    console.error(`Failed to parse command file: ${filePath}`, error)
    return null
  }
}

/**
 * Substitute arguments into a command template
 * - $ARGUMENTS: replaced with full argument string
 * - $1, $2, etc.: replaced with positional arguments
 */
export function substituteArguments(template: string, args: string): string {
  const argList = args.trim().split(/\s+/).filter(Boolean)

  let result = template

  // Replace $ARGUMENTS with full argument string
  result = result.replace(/\$ARGUMENTS/g, args.trim())

  // Replace positional arguments $1 through $9
  for (let i = 1; i <= 9; i++) {
    const placeholder = new RegExp(`\\$${i}`, 'g')
    const value = argList[i - 1] || ''
    result = result.replace(placeholder, value)
  }

  return result
}

/**
 * Execute a slash command by name
 * Returns the rendered prompt with arguments substituted
 */
export async function executeCommand(
  repoPath: string,
  commandName: string,
  args: string
): Promise<{ success: true; prompt: string } | { success: false; error: string }> {
  const commands = await discoverCommands(repoPath)
  const command = commands.find(c => c.name === commandName)

  if (!command) {
    return { success: false, error: `Command not found: /${commandName}` }
  }

  const renderedPrompt = substituteArguments(command.content, args)
  return { success: true, prompt: renderedPrompt }
}
