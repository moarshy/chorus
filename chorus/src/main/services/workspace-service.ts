import { existsSync, readdirSync, statSync } from 'fs'
import { join, basename } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { getBranch, getStatus } from './git-service'
import type { Agent } from '../store'

/**
 * Validates if the given path is a git repository
 */
export async function validateGitRepo(path: string): Promise<boolean> {
  const gitDir = join(path, '.git')
  return existsSync(gitDir) && statSync(gitDir).isDirectory()
}

/**
 * Discovers agents from .claude/agents/*.md files
 */
export async function discoverAgents(repoPath: string): Promise<Omit<Agent, 'workspaceId'>[]> {
  const agentsDir = join(repoPath, '.claude', 'agents')

  if (!existsSync(agentsDir)) {
    return []
  }

  try {
    const files = readdirSync(agentsDir)
    const agents: Omit<Agent, 'workspaceId'>[] = []

    for (const file of files) {
      if (file.endsWith('.md')) {
        const filePath = join(agentsDir, file)
        const stats = statSync(filePath)

        if (stats.isFile()) {
          const name = basename(file, '.md')
          agents.push({
            id: uuidv4(),
            name,
            filePath
          })
        }
      }
    }

    return agents
  } catch {
    return []
  }
}

/**
 * Checks if the repository has a CLAUDE.md system prompt file
 */
export async function checkSystemPrompt(repoPath: string): Promise<boolean> {
  const claudeMdPath = join(repoPath, 'CLAUDE.md')
  return existsSync(claudeMdPath)
}

/**
 * Gets complete workspace info including git status, agents, and system prompt
 */
export async function getWorkspaceInfo(path: string): Promise<{
  gitBranch: string | null
  isDirty: boolean
  hasSystemPrompt: boolean
  agents: Omit<Agent, 'workspaceId'>[]
}> {
  const [branch, status, hasSystemPrompt, agents] = await Promise.all([
    getBranch(path).catch(() => null),
    getStatus(path).catch(() => ({ isDirty: false, changes: [] })),
    checkSystemPrompt(path),
    discoverAgents(path)
  ])

  return {
    gitBranch: branch,
    isDirty: status.isDirty,
    hasSystemPrompt,
    agents
  }
}
