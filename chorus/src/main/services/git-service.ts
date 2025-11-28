import { execSync, spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

export interface GitChange {
  status: 'M' | 'A' | 'D' | '?' | 'R' | string
  file: string
}

export interface GitStatus {
  isDirty: boolean
  changes: GitChange[]
}

export interface GitCommit {
  hash: string
  message: string
  author?: string
  date?: string
}

export interface CloneProgress {
  phase: string
  percent: number
  message: string
}

// Track active clone process for cancellation
let activeCloneProcess: ChildProcess | null = null

/**
 * Helper to run git commands synchronously
 */
function runGit(cwd: string, args: string): string {
  const output = execSync(`git ${args}`, {
    cwd,
    encoding: 'utf-8',
    timeout: 10000,
    stdio: ['pipe', 'pipe', 'pipe']
  })
  return output.trim()
}

/**
 * Check if path is a git repository
 */
export async function isRepo(path: string): Promise<boolean> {
  const gitDir = join(path, '.git')
  return existsSync(gitDir)
}

/**
 * Get current branch name
 */
export async function getBranch(path: string): Promise<string | null> {
  try {
    return runGit(path, 'branch --show-current')
  } catch {
    // Might be a new repo with no commits
    try {
      // Try to get HEAD reference
      runGit(path, 'rev-parse HEAD')
      return 'HEAD'
    } catch {
      return null
    }
  }
}

/**
 * Get git status
 */
export async function getStatus(path: string): Promise<GitStatus> {
  try {
    const output = runGit(path, 'status --porcelain')
    const lines = output.split('\n').filter(Boolean)

    const changes: GitChange[] = lines.map((line) => {
      const status = line.substring(0, 2).trim()
      const file = line.substring(3)
      return { status: status || '?', file }
    })

    return {
      isDirty: changes.length > 0,
      changes
    }
  } catch {
    return { isDirty: false, changes: [] }
  }
}

/**
 * Get recent commits
 */
export async function getLog(path: string, count: number = 10): Promise<GitCommit[]> {
  try {
    const output = runGit(path, `log --oneline -n ${count}`)
    const lines = output.split('\n').filter(Boolean)

    return lines.map((line) => {
      const [hash, ...messageParts] = line.split(' ')
      return {
        hash,
        message: messageParts.join(' ')
      }
    })
  } catch {
    return []
  }
}

/**
 * Get commits for a specific branch
 */
export async function getLogForBranch(
  path: string,
  branch: string,
  count: number = 10
): Promise<GitCommit[]> {
  try {
    // Use format to get hash, message, author, and date
    const output = runGit(path, `log ${branch} -n ${count} --format="%H|%s|%an|%ai"`)
    const lines = output.split('\n').filter(Boolean)

    return lines.map((line) => {
      const [hash, message, author, date] = line.split('|')
      return {
        hash,
        message,
        author,
        date
      }
    })
  } catch {
    return []
  }
}

/**
 * Clone a repository with progress tracking
 */
export async function clone(
  url: string,
  targetDir: string,
  onProgress: (progress: CloneProgress) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    activeCloneProcess = spawn('git', ['clone', '--progress', url, targetDir], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // Git outputs progress to stderr
    activeCloneProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString()

      // Parse progress output
      // Examples:
      // Cloning into 'repo'...
      // Receiving objects:  50% (100/200)
      // Resolving deltas:  25% (50/200)

      const progressMatch = output.match(
        /(Receiving objects|Resolving deltas|Counting objects|Compressing objects):\s*(\d+)%/
      )

      if (progressMatch) {
        const [, phase, percent] = progressMatch
        onProgress({
          phase,
          percent: parseInt(percent, 10),
          message: output.trim()
        })
      } else if (output.includes('Cloning into')) {
        onProgress({
          phase: 'Cloning',
          percent: 0,
          message: output.trim()
        })
      }
    })

    activeCloneProcess.on('close', (code) => {
      activeCloneProcess = null
      if (code === 0) {
        onProgress({
          phase: 'Complete',
          percent: 100,
          message: 'Clone complete'
        })
        resolve()
      } else {
        reject(new Error(`Git clone failed with code ${code}`))
      }
    })

    activeCloneProcess.on('error', (error) => {
      activeCloneProcess = null
      reject(error)
    })
  })
}

/**
 * Cancel active clone operation
 */
export function cancelClone(): void {
  if (activeCloneProcess) {
    activeCloneProcess.kill('SIGTERM')
    activeCloneProcess = null
  }
}

export interface GitBranch {
  name: string
  isCurrent: boolean
  isRemote: boolean
}

/**
 * List all branches (local and remote)
 */
export async function listBranches(path: string): Promise<GitBranch[]> {
  try {
    // Get local branches
    const localOutput = runGit(path, 'branch')
    const localBranches: GitBranch[] = localOutput
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const isCurrent = line.startsWith('*')
        const name = line.replace(/^\*?\s+/, '').trim()
        return { name, isCurrent, isRemote: false }
      })

    // Get remote branches
    const remoteOutput = runGit(path, 'branch -r')
    const remoteBranches: GitBranch[] = remoteOutput
      .split('\n')
      .filter(Boolean)
      .filter((line) => !line.includes('HEAD'))
      .map((line) => {
        const name = line.trim()
        return { name, isCurrent: false, isRemote: true }
      })

    return [...localBranches, ...remoteBranches]
  } catch {
    return []
  }
}

/**
 * Checkout a branch
 */
export async function checkout(path: string, branch: string): Promise<void> {
  // If it's a remote branch (e.g., origin/feature), create a local tracking branch
  if (branch.includes('/')) {
    const localBranchName = branch.split('/').slice(1).join('/')
    try {
      // Try to checkout existing local branch first
      runGit(path, `checkout ${localBranchName}`)
    } catch {
      // Create a new local branch tracking the remote
      runGit(path, `checkout -b ${localBranchName} ${branch}`)
    }
  } else {
    runGit(path, `checkout ${branch}`)
  }
}
