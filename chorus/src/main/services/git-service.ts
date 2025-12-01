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
      // Porcelain format: XY PATH where XY is exactly 2 chars, then space, then path
      // Example outputs:
      //   " M file.txt"     - modified in working tree
      //   "M  file.txt"     - modified in index (staged)
      //   "?? file.txt"     - untracked
      //   " D file.txt"     - deleted in working tree
      //   "R  old -> new"   - renamed
      if (line.length < 3) {
        return { status: '?', file: line.trim() }
      }

      // First 2 chars are always the status (XY format)
      const status = line.substring(0, 2).trim()
      // Take everything after position 2 and trim leading whitespace
      // This handles both "XY file" and "XY  file" formats
      const file = line.substring(2).trimStart()

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

// ============================================
// New functions for automated git operations
// ============================================

/**
 * Create a new branch from current HEAD
 */
export async function createBranch(path: string, branchName: string): Promise<void> {
  runGit(path, `checkout -b ${branchName}`)
}

/**
 * Stage all changes
 */
export async function stageAll(path: string): Promise<void> {
  runGit(path, 'add -A')
}

/**
 * Stage specific files
 */
export async function stageFiles(path: string, files: string[]): Promise<void> {
  const escapedFiles = files.map((f) => `"${f}"`).join(' ')
  runGit(path, `add ${escapedFiles}`)
}

/**
 * Commit staged changes
 * Returns commit hash
 */
export async function commit(path: string, message: string): Promise<string> {
  // Escape double quotes and handle multiline
  const escapedMessage = message.replace(/"/g, '\\"')
  runGit(path, `commit -m "${escapedMessage}"`)
  return runGit(path, 'rev-parse HEAD')
}

/**
 * Get diff for uncommitted changes or specific commit
 */
export async function getDiff(path: string, commitHash?: string): Promise<string> {
  if (commitHash) {
    return runGit(path, `show ${commitHash} --format="" --patch`)
  }
  return runGit(path, 'diff')
}

/**
 * Get diff between two branches (or commits)
 * Shows what changes are in targetBranch that are not in baseBranch
 */
export async function getDiffBetweenBranches(
  path: string,
  baseBranch: string,
  targetBranch: string
): Promise<string> {
  // Use three-dot diff to show changes on targetBranch since it diverged from baseBranch
  return runGit(path, `diff ${baseBranch}...${targetBranch}`)
}

/**
 * Diff hunk structure
 */
export interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  content: string
}

/**
 * File diff structure
 */
export interface FileDiff {
  filePath: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  additions: number
  deletions: number
  hunks: DiffHunk[]
}

/**
 * Parse a unified diff string into structured FileDiff objects
 */
function parseDiff(diffOutput: string): FileDiff[] {
  const files: FileDiff[] = []
  const fileBlocks = diffOutput.split(/(?=^diff --git)/m).filter(Boolean)

  for (const block of fileBlocks) {
    const lines = block.split('\n')
    const headerMatch = lines[0]?.match(/^diff --git a\/(.+) b\/(.+)$/)
    if (!headerMatch) continue

    const filePath = headerMatch[2]
    let status: FileDiff['status'] = 'modified'
    let additions = 0
    let deletions = 0
    const hunks: DiffHunk[] = []

    // Determine status from diff headers
    if (block.includes('new file mode')) {
      status = 'added'
    } else if (block.includes('deleted file mode')) {
      status = 'deleted'
    } else if (block.includes('rename from')) {
      status = 'renamed'
    }

    // Parse hunks
    let currentHunk: DiffHunk | null = null
    let hunkContent: string[] = []

    for (const line of lines) {
      const hunkMatch = line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/)
      if (hunkMatch) {
        // Save previous hunk
        if (currentHunk) {
          currentHunk.content = hunkContent.join('\n')
          hunks.push(currentHunk)
        }
        currentHunk = {
          oldStart: parseInt(hunkMatch[1], 10),
          oldLines: parseInt(hunkMatch[2] || '1', 10),
          newStart: parseInt(hunkMatch[3], 10),
          newLines: parseInt(hunkMatch[4] || '1', 10),
          content: ''
        }
        hunkContent = [line]
      } else if (currentHunk) {
        hunkContent.push(line)
        if (line.startsWith('+') && !line.startsWith('+++')) {
          additions++
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          deletions++
        }
      }
    }

    // Save last hunk
    if (currentHunk) {
      currentHunk.content = hunkContent.join('\n')
      hunks.push(currentHunk)
    }

    files.push({ filePath, status, additions, deletions, hunks })
  }

  return files
}

/**
 * Get structured diff with file-level breakdown
 */
export async function getStructuredDiff(path: string, commitHash?: string): Promise<FileDiff[]> {
  try {
    const diff = await getDiff(path, commitHash)
    return parseDiff(diff)
  } catch {
    return []
  }
}

/**
 * Get structured diff between two branches
 */
export async function getStructuredDiffBetweenBranches(
  path: string,
  baseBranch: string,
  targetBranch: string
): Promise<FileDiff[]> {
  try {
    const diff = await getDiffBetweenBranches(path, baseBranch, targetBranch)
    return parseDiff(diff)
  } catch {
    return []
  }
}

/**
 * Merge a branch into current branch
 */
export async function merge(
  path: string,
  sourceBranch: string,
  options?: { squash?: boolean; noCommit?: boolean }
): Promise<void> {
  let args = `merge ${sourceBranch}`
  if (options?.squash) args += ' --squash'
  if (options?.noCommit) args += ' --no-commit'
  runGit(path, args)
}

/**
 * Delete a branch
 */
export async function deleteBranch(path: string, branchName: string, force?: boolean): Promise<void> {
  const flag = force ? '-D' : '-d'
  runGit(path, `branch ${flag} ${branchName}`)
}

/**
 * Check if branch exists
 */
export async function branchExists(path: string, branchName: string): Promise<boolean> {
  try {
    runGit(path, `rev-parse --verify ${branchName}`)
    return true
  } catch {
    return false
  }
}

/**
 * Agent branch info structure
 */
export interface AgentBranchInfo {
  name: string
  agentName: string
  sessionId: string
  lastCommitDate: string
  commitCount: number
  isCurrent: boolean
}

/**
 * Get all agent branches (matching agent/* pattern)
 */
export async function getAgentBranches(path: string): Promise<AgentBranchInfo[]> {
  try {
    const branches = await listBranches(path)
    const agentBranches = branches.filter((b) => b.name.startsWith('agent/') && !b.isRemote)

    const results: AgentBranchInfo[] = []
    for (const branch of agentBranches) {
      // Parse branch name: agent/{agentName}/{sessionId}
      const parts = branch.name.split('/')
      if (parts.length >= 3) {
        const agentName = parts[1]
        const sessionId = parts.slice(2).join('/')

        try {
          // Get commit count and last commit date
          const countOutput = runGit(path, `rev-list --count ${branch.name}`)
          const dateOutput = runGit(path, `log -1 --format=%ai ${branch.name}`)

          results.push({
            name: branch.name,
            agentName,
            sessionId,
            lastCommitDate: dateOutput,
            commitCount: parseInt(countOutput, 10),
            isCurrent: branch.isCurrent
          })
        } catch {
          // Skip branches we can't get info for
        }
      }
    }

    // Sort by last commit date descending
    return results.sort(
      (a, b) => new Date(b.lastCommitDate).getTime() - new Date(a.lastCommitDate).getTime()
    )
  } catch {
    return []
  }
}

/**
 * Stash current changes
 */
export async function stash(path: string, message?: string): Promise<void> {
  const args = message ? `stash push -m "${message}"` : 'stash'
  runGit(path, args)
}

/**
 * Pop stashed changes
 */
export async function stashPop(path: string): Promise<void> {
  runGit(path, 'stash pop')
}

/**
 * Push branch to remote
 */
export async function push(
  path: string,
  branchName?: string,
  options?: { setUpstream?: boolean; force?: boolean }
): Promise<void> {
  let args = 'push'
  if (options?.setUpstream) args += ' -u origin'
  if (options?.force) args += ' --force'
  if (branchName) args += ` origin ${branchName}`
  runGit(path, args)
}

/**
 * Get current branch name (sync version for internal use)
 */
export function getCurrentBranchSync(path: string): string | null {
  try {
    return runGit(path, 'branch --show-current')
  } catch {
    return null
  }
}

/**
 * Discard changes to a file (restore to last commit)
 * Works for modified files, deleted files, and untracked files
 */
export async function discardChanges(repoPath: string, filePath: string): Promise<void> {
  // Get file status first
  const status = await getStatus(repoPath)
  const fileChange = status.changes.find(c => c.file === filePath)

  if (!fileChange) {
    throw new Error(`No changes found for ${filePath}`)
  }

  if (fileChange.status === '??' || fileChange.status === 'A') {
    // Untracked or newly added file - just delete it
    const { unlinkSync } = await import('fs')
    const { join } = await import('path')
    unlinkSync(join(repoPath, filePath))
  } else {
    // Modified or deleted file - restore from HEAD
    runGit(repoPath, `checkout HEAD -- "${filePath}"`)
  }
}

/**
 * Unstage a file (remove from staging area)
 */
export async function unstageFile(repoPath: string, filePath: string): Promise<void> {
  runGit(repoPath, `reset HEAD -- "${filePath}"`)
}

/**
 * Stage a specific file
 */
export async function stageFile(repoPath: string, filePath: string): Promise<void> {
  runGit(repoPath, `add "${filePath}"`)
}
