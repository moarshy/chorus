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

export interface DetailedGitStatus {
  staged: GitChange[]
  unstaged: GitChange[]
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
  // Use trimEnd() to preserve leading whitespace which is significant in git status --porcelain
  // The format " M file" means unstaged, "M  file" means staged - leading space matters!
  return output.trimEnd()
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
 * Get detailed git status with staged/unstaged separation
 * Uses `git status --porcelain` XY format:
 *   X = index status, Y = worktree status
 *   ' ' = unmodified, M = modified, A = added, D = deleted, ? = untracked
 */
export async function getDetailedStatus(path: string): Promise<DetailedGitStatus> {
  try {
    const output = runGit(path, 'status --porcelain')
    const lines = output.split('\n').filter(Boolean)

    const staged: GitChange[] = []
    const unstaged: GitChange[] = []

    for (const line of lines) {
      if (line.length < 3) continue

      const indexStatus = line[0] // X - staged status
      const workStatus = line[1] // Y - unstaged status
      // Use substring(2).trimStart() to handle variable spacing in porcelain output
      const file = line.substring(2).trimStart()

      // Staged changes (X is not space or ?)
      if (indexStatus !== ' ' && indexStatus !== '?') {
        staged.push({ file, status: indexStatus })
      }

      // Unstaged changes (Y is not space, or untracked ??)
      if (workStatus !== ' ' || indexStatus === '?') {
        const status = indexStatus === '?' ? '?' : workStatus
        unstaged.push({ file, status })
      }
    }

    return { staged, unstaged }
  } catch {
    return { staged: [], unstaged: [] }
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
 * Get commits unique to a branch (commits since it diverged from base)
 * This is like GitButler - shows only new commits on the branch, not parent commits
 */
export async function getLogForBranchOnly(
  path: string,
  branch: string,
  baseBranch: string,
  count: number = 50
): Promise<GitCommit[]> {
  try {
    // Use two-dot notation: baseBranch..branch shows commits reachable from branch but not from baseBranch
    const output = runGit(path, `log ${baseBranch}..${branch} -n ${count} --format="%H|%s|%an|%ai"`)
    if (!output) return []

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

  // Check if target directory already exists
  if (existsSync(targetDir)) {
    // Check if it's already a git repo
    const gitDir = join(targetDir, '.git')
    if (existsSync(gitDir)) {
      throw new Error(`Directory already exists and is a git repository: ${targetDir}\n\nTry adding it as a local workspace instead.`)
    } else {
      throw new Error(`Directory already exists: ${targetDir}\n\nPlease choose a different location or remove the existing directory.`)
    }
  }

  // Track stderr for error messages
  let stderrOutput = ''

  return new Promise((resolve, reject) => {
    activeCloneProcess = spawn('git', ['clone', '--progress', url, targetDir], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // Git outputs progress to stderr
    activeCloneProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString()
      stderrOutput += output  // Capture all stderr for error messages

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
        // Parse common git clone errors for better messages
        let errorMessage = `Git clone failed (code ${code})`

        if (stderrOutput.includes('already exists and is not an empty directory')) {
          errorMessage = `Directory already exists: ${targetDir}\n\nPlease choose a different location or remove the existing directory.`
        } else if (stderrOutput.includes('Repository not found')) {
          errorMessage = `Repository not found: ${url}\n\nCheck the URL and your access permissions.`
        } else if (stderrOutput.includes('Permission denied') || stderrOutput.includes('publickey')) {
          errorMessage = `Permission denied.\n\nMake sure you have access to this repository and your SSH keys are configured correctly.`
        } else if (stderrOutput.includes('Could not resolve host')) {
          errorMessage = `Could not connect to host.\n\nCheck your internet connection and the repository URL.`
        } else if (stderrOutput.trim()) {
          errorMessage = stderrOutput.trim()
        }

        reject(new Error(errorMessage))
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
        // Remove leading markers: * (current), + (worktree), and any spaces
        // Format: "* main" or "+ branch-in-worktree" or "  regular-branch"
        const name = line.replace(/^[\s*+]+/, '').trim()
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
 * @param path - Repository path
 * @param branch - Branch name to checkout
 * @param isRemote - Whether this is a remote branch (e.g., origin/feature).
 *                   If true, creates a local tracking branch by stripping the remote prefix.
 */
export async function checkout(path: string, branch: string, isRemote: boolean = false): Promise<void> {
  if (isRemote) {
    // Remote branch: strip remote prefix to create local tracking branch
    const slashIndex = branch.indexOf('/')
    const localBranchName = slashIndex > 0 ? branch.substring(slashIndex + 1) : branch
    try {
      // Try to checkout existing local branch first
      runGit(path, `checkout ${localBranchName}`)
    } catch {
      // Create a new local branch tracking the remote
      runGit(path, `checkout -b ${localBranchName} ${branch}`)
    }
  } else {
    // Local branch: use name as-is (supports branches with slashes like agent/name/id)
    runGit(path, `checkout ${branch}`)
  }
}

// ============================================
// New functions for automated git operations
// ============================================

/**
 * Get the default branch name (main or master)
 * Returns 'main' if it exists, otherwise 'master', or null if neither exists
 */
export async function getDefaultBranch(path: string): Promise<string | null> {
  try {
    // First check if 'main' exists
    runGit(path, 'rev-parse --verify main')
    return 'main'
  } catch {
    try {
      // Fall back to 'master'
      runGit(path, 'rev-parse --verify master')
      return 'master'
    } catch {
      return null
    }
  }
}

/**
 * Create a new branch from current HEAD
 */
export async function createBranch(path: string, branchName: string): Promise<void> {
  runGit(path, `checkout -b ${branchName}`)
}

/**
 * Create a new branch from a specific base branch
 * First checks out the base, then creates the new branch
 */
export async function createBranchFrom(
  path: string,
  branchName: string,
  baseBranch: string
): Promise<void> {
  // Create branch from specific base without checking it out first
  runGit(path, `branch ${branchName} ${baseBranch}`)
  // Then checkout the new branch
  runGit(path, `checkout ${branchName}`)
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
  // Let errors propagate so the caller can handle them properly
  const diff = await getDiff(path, commitHash)
  return parseDiff(diff)
}

/**
 * Get structured diff between two branches
 */
export async function getStructuredDiffBetweenBranches(
  path: string,
  baseBranch: string,
  targetBranch: string
): Promise<FileDiff[]> {
  // Let errors propagate so the caller can handle them properly
  const diff = await getDiffBetweenBranches(path, baseBranch, targetBranch)
  return parseDiff(diff)
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
 * Check if a branch is checked out in any worktree (including main repo)
 * Returns the worktree path if checked out, null otherwise
 */
export function isBranchCheckedOut(path: string, branchName: string): string | null {
  try {
    const output = runGit(path, 'worktree list --porcelain')
    const worktrees = output.split('\n\n').filter(Boolean)

    for (const worktree of worktrees) {
      const lines = worktree.split('\n')
      let worktreePath = ''
      let branch = ''

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          worktreePath = line.substring(9)
        } else if (line.startsWith('branch refs/heads/')) {
          branch = line.substring(18)
        }
      }

      if (branch === branchName) {
        return worktreePath
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Delete a branch
 * Returns { deleted: boolean, reason?: string } to indicate success or why it was skipped
 * When force=true and branch is in a worktree, the worktree is removed first
 */
export async function deleteBranch(path: string, branchName: string, force?: boolean): Promise<{ deleted: boolean; reason?: string }> {
  // Check if branch exists first
  const exists = await branchExists(path, branchName)
  if (!exists) {
    return {
      deleted: false,
      reason: `Branch does not exist`
    }
  }

  // Check if branch is checked out in any worktree
  const checkedOutIn = isBranchCheckedOut(path, branchName)
  if (checkedOutIn) {
    if (force) {
      // Force delete: remove the worktree first, then delete the branch
      try {
        await removeWorktree(path, checkedOutIn, true)
      } catch (error) {
        return {
          deleted: false,
          reason: `Failed to remove worktree: ${error}`
        }
      }
    } else {
      return {
        deleted: false,
        reason: `Branch is checked out in worktree: ${checkedOutIn}`
      }
    }
  }

  const flag = force ? '-D' : '-d'
  runGit(path, `branch ${flag} ${branchName}`)
  return { deleted: true }
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
  if (options?.setUpstream) {
    // -u sets upstream tracking; specify origin and branch
    args += ` -u origin ${branchName || ''}`
  } else if (branchName) {
    // Push specific branch to origin
    args += ` origin ${branchName}`
  }
  if (options?.force) args += ' --force'
  runGit(path, args.trim())
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
 * Uses `git restore --staged` which works for both modified and new files
 */
export async function unstageFile(repoPath: string, filePath: string): Promise<void> {
  try {
    // Try git restore --staged first (works in git 2.23+)
    runGit(repoPath, `restore --staged -- "${filePath}"`)
  } catch {
    // Fallback: try reset HEAD (works for modified files)
    try {
      runGit(repoPath, `reset HEAD -- "${filePath}"`)
    } catch {
      // Last resort: for new files, use rm --cached
      runGit(repoPath, `rm --cached -- "${filePath}"`)
    }
  }
}

/**
 * Stage a specific file
 */
export async function stageFile(repoPath: string, filePath: string): Promise<void> {
  runGit(repoPath, `add "${filePath}"`)
}

/**
 * Unstage all files (reset index to HEAD)
 */
export async function unstageAll(repoPath: string): Promise<void> {
  try {
    runGit(repoPath, 'reset HEAD')
  } catch {
    // reset HEAD may fail if there are no commits yet, ignore
  }
}

/**
 * Discard all changes (reset working tree to HEAD)
 * WARNING: Destructive - loses all uncommitted work
 */
export async function discardAll(repoPath: string): Promise<void> {
  // Reset all tracked files to HEAD
  runGit(repoPath, 'checkout -- .')
  // Remove untracked files and directories
  runGit(repoPath, 'clean -fd')
}

/**
 * Get diff for a specific unstaged file
 */
export async function getFileDiff(repoPath: string, filePath: string): Promise<string> {
  try {
    return runGit(repoPath, `diff -- "${filePath}"`)
  } catch {
    return ''
  }
}

/**
 * Get diff for a specific staged file
 */
export async function getStagedFileDiff(repoPath: string, filePath: string): Promise<string> {
  try {
    return runGit(repoPath, `diff --cached -- "${filePath}"`)
  } catch {
    return ''
  }
}

// ============================================================================
// Remote Sync Operations
// ============================================================================

export interface BranchSyncStatus {
  ahead: number
  behind: number
  upstream: string | null // e.g., "origin/main"
  remote: string | null // e.g., "origin"
  branch: string
}

/**
 * Get sync status for current branch (ahead/behind upstream)
 */
export async function getBranchSyncStatus(path: string): Promise<BranchSyncStatus> {
  const branch = await getBranch(path)
  if (!branch) {
    return { ahead: 0, behind: 0, upstream: null, remote: null, branch: '' }
  }

  // Try to get upstream
  let upstream: string | null = null
  let remote: string | null = null
  try {
    upstream = runGit(path, 'rev-parse --abbrev-ref @{upstream}')
    // Extract remote name from upstream (e.g., "origin/main" -> "origin")
    const slashIndex = upstream.indexOf('/')
    if (slashIndex > 0) {
      remote = upstream.substring(0, slashIndex)
    }
  } catch {
    // No upstream configured
    return { ahead: 0, behind: 0, upstream: null, remote: null, branch }
  }

  // Get ahead/behind counts
  try {
    const output = runGit(path, 'rev-list --count --left-right @{upstream}...HEAD')
    const [behind, ahead] = output.split('\t').map(Number)
    return { ahead: ahead || 0, behind: behind || 0, upstream, remote, branch }
  } catch {
    return { ahead: 0, behind: 0, upstream, remote, branch }
  }
}

/**
 * Push and set upstream tracking branch (simple version for sync UI)
 */
export async function pushSetUpstream(
  path: string,
  remote: string,
  branch: string
): Promise<void> {
  runGit(path, `push -u ${remote} ${branch}`)
}

/**
 * Pull from upstream (merge)
 */
export async function pull(path: string): Promise<void> {
  runGit(path, 'pull')
}

/**
 * Pull from upstream (rebase)
 */
export async function pullRebase(path: string): Promise<void> {
  runGit(path, 'pull --rebase')
}

/**
 * Fetch from all remotes
 */
export async function fetchAll(path: string): Promise<void> {
  runGit(path, 'fetch --all')
}

/**
 * Check if repo has any remotes configured
 */
export async function hasRemotes(path: string): Promise<boolean> {
  try {
    const output = runGit(path, 'remote')
    return output.length > 0
  } catch {
    return false
  }
}

// ============================================================================
// Merge Analysis Functions (E-3)
// ============================================================================

/**
 * Get count of commits that target branch has ahead of source
 * Used to show "main has X new commits since branch was created"
 */
export async function getCommitsBehind(
  path: string,
  sourceBranch: string,
  targetBranch: string
): Promise<number> {
  try {
    // Count commits in target that aren't in source
    const output = runGit(path, `rev-list --count ${sourceBranch}..${targetBranch}`)
    return parseInt(output, 10) || 0
  } catch {
    return 0
  }
}

/**
 * Check for files that are modified in both branches (potential conflicts)
 * Returns list of file paths that might conflict during merge
 */
export async function checkMergeConflicts(
  path: string,
  sourceBranch: string,
  targetBranch: string
): Promise<string[]> {
  try {
    // Get merge base (common ancestor)
    const mergeBase = runGit(path, `merge-base ${sourceBranch} ${targetBranch}`)

    // Files changed in source since merge base
    const sourceFilesOutput = runGit(path, `diff --name-only ${mergeBase} ${sourceBranch}`)
    const sourceFiles = sourceFilesOutput.split('\n').filter(Boolean)

    // Files changed in target since merge base
    const targetFilesOutput = runGit(path, `diff --name-only ${mergeBase} ${targetBranch}`)
    const targetFiles = targetFilesOutput.split('\n').filter(Boolean)

    // Intersection = files modified in both branches = potential conflicts
    return sourceFiles.filter((f) => targetFiles.includes(f))
  } catch {
    return []
  }
}

/**
 * Merge analysis result for preview
 */
export interface MergeAnalysis {
  canMerge: boolean
  behindCount: number // How many commits target is ahead
  conflictFiles: string[] // Files modified in both branches
  changedFiles: FileDiff[] // Files that will be merged
  error?: string
}

/**
 * Analyze a potential merge without performing it
 * Used for merge preview dialog
 */
export async function analyzeMerge(
  path: string,
  sourceBranch: string,
  targetBranch: string
): Promise<MergeAnalysis> {
  try {
    // Get how far behind the source is from target
    const behindCount = await getCommitsBehind(path, sourceBranch, targetBranch)

    // Check for potential conflicts
    const conflictFiles = await checkMergeConflicts(path, sourceBranch, targetBranch)

    // Get the files that will be merged (diff from target to source)
    const changedFiles = await getStructuredDiffBetweenBranches(path, targetBranch, sourceBranch)

    return {
      canMerge: true,
      behindCount,
      conflictFiles,
      changedFiles
    }
  } catch (error) {
    return {
      canMerge: false,
      behindCount: 0,
      conflictFiles: [],
      changedFiles: [],
      error: String(error)
    }
  }
}

// ============================================================================
// Worktree Management (Sprint 16)
// ============================================================================

/**
 * Worktree information structure
 */
export interface WorktreeInfo {
  path: string // Absolute path to worktree
  branch: string // Branch checked out (or 'HEAD' if detached)
  commit: string // Current HEAD commit
  isMain: boolean // Is this the main working tree?
  isLocked: boolean // Is worktree locked?
  prunable: boolean // Can be safely pruned?
}

/**
 * List all worktrees for a repository
 */
export async function listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
  try {
    const output = runGit(repoPath, 'worktree list --porcelain')
    return parseWorktreeList(output)
  } catch {
    return []
  }
}

/**
 * Parse git worktree list --porcelain output
 */
function parseWorktreeList(output: string): WorktreeInfo[] {
  const worktrees: WorktreeInfo[] = []
  // Split by double newlines (entries are separated by blank lines)
  const entries = output.split('\n\n').filter(Boolean)

  for (const entry of entries) {
    const lines = entry.split('\n')
    const info: Partial<WorktreeInfo> = {
      isLocked: false,
      prunable: false,
      isMain: false
    }

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        info.path = line.slice(9)
      } else if (line.startsWith('HEAD ')) {
        info.commit = line.slice(5)
      } else if (line.startsWith('branch refs/heads/')) {
        info.branch = line.slice(18)
      } else if (line === 'bare') {
        // Skip bare repos
        continue
      } else if (line === 'locked') {
        info.isLocked = true
      } else if (line.startsWith('locked ')) {
        info.isLocked = true
      } else if (line === 'prunable') {
        info.prunable = true
      } else if (line.startsWith('prunable ')) {
        info.prunable = true
      } else if (line === 'detached') {
        info.branch = 'HEAD (detached)'
      }
    }

    if (info.path) {
      worktrees.push({
        path: info.path,
        branch: info.branch || 'HEAD',
        commit: info.commit || '',
        isMain: worktrees.length === 0, // First entry is main worktree
        isLocked: info.isLocked || false,
        prunable: info.prunable || false
      })
    }
  }

  return worktrees
}

/**
 * Create a new worktree
 * @param repoPath - Path to main repository
 * @param worktreePath - Path where worktree will be created
 * @param branch - Branch to checkout (created if doesn't exist)
 * @param baseBranch - Base branch for new branch (optional, defaults to HEAD)
 */
export async function createWorktree(
  repoPath: string,
  worktreePath: string,
  branch: string,
  baseBranch?: string
): Promise<void> {
  // Check if branch exists
  const exists = await branchExists(repoPath, branch)

  if (exists) {
    // Checkout existing branch in new worktree
    runGit(repoPath, `worktree add "${worktreePath}" ${branch}`)
  } else {
    // Create new branch from base
    const base = baseBranch || 'HEAD'
    runGit(repoPath, `worktree add -b ${branch} "${worktreePath}" ${base}`)
  }
}

/**
 * Remove a worktree
 * @param repoPath - Path to main repository
 * @param worktreePath - Path to worktree to remove
 * @param force - Force removal even with uncommitted changes
 */
export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
  force: boolean = false
): Promise<void> {
  const flag = force ? '--force' : ''
  runGit(repoPath, `worktree remove ${flag} "${worktreePath}"`)
}

/**
 * Prune stale worktree entries
 * Cleans up metadata for worktrees whose directories were deleted
 */
export async function pruneWorktrees(repoPath: string): Promise<void> {
  runGit(repoPath, 'worktree prune')
}

/**
 * Lock a worktree to prevent accidental removal
 */
export async function lockWorktree(
  repoPath: string,
  worktreePath: string,
  reason?: string
): Promise<void> {
  const reasonArg = reason ? `--reason "${reason}"` : ''
  runGit(repoPath, `worktree lock ${reasonArg} "${worktreePath}"`)
}

/**
 * Unlock a worktree
 */
export async function unlockWorktree(repoPath: string, worktreePath: string): Promise<void> {
  runGit(repoPath, `worktree unlock "${worktreePath}"`)
}

/**
 * Check if a path is inside a worktree (not the main repo)
 */
export async function isWorktree(path: string): Promise<boolean> {
  try {
    const gitDir = runGit(path, 'rev-parse --git-dir')
    // Main repo: .git is a directory
    // Worktree: .git is a file pointing to main repo's .git/worktrees/
    return gitDir.includes('.git/worktrees/')
  } catch {
    return false
  }
}

/**
 * Get the main repository path from a worktree
 */
export async function getMainRepoPath(worktreePath: string): Promise<string> {
  const gitCommonDir = runGit(worktreePath, 'rev-parse --git-common-dir')
  // Returns something like /path/to/repo/.git
  // We want /path/to/repo
  const { dirname } = await import('path')
  return dirname(gitCommonDir)
}

/**
 * Get worktree status (has uncommitted changes?)
 */
export async function getWorktreeStatus(worktreePath: string): Promise<{
  isDirty: boolean
  untrackedFiles: number
  modifiedFiles: number
  stagedFiles: number
}> {
  const status = await getStatus(worktreePath)
  return {
    isDirty: status.isDirty,
    untrackedFiles: status.changes.filter((f) => f.status === '??').length,
    modifiedFiles: status.changes.filter((f) => f.status === 'M' || f.status === ' M').length,
    stagedFiles: status.changes.filter(
      (f) => f.status.startsWith('A') || f.status.startsWith('M')
    ).length
  }
}

/**
 * Find worktree by conversation ID (checks .chorus-worktrees/{conversationId})
 */
export async function findWorktreeByConversationId(
  repoPath: string,
  conversationId: string
): Promise<WorktreeInfo | null> {
  const worktrees = await listWorktrees(repoPath)
  return worktrees.find((w) => w.path.endsWith(`/${conversationId}`)) || null
}

// ============================================================================
// GitHub CLI Operations (Sprint 17 - Create Workspace)
// ============================================================================

export interface GhCliStatus {
  installed: boolean
  authenticated: boolean
  username?: string
}

export interface CreateRepoResult {
  repoUrl: string
  cloneUrl: string
}

/**
 * Check if GitHub CLI is installed and authenticated
 */
export async function checkGhCli(): Promise<GhCliStatus> {
  // Check if gh is installed
  try {
    execSync('which gh', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
  } catch {
    return { installed: false, authenticated: false }
  }

  // Check if authenticated
  try {
    execSync('gh auth status', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
  } catch {
    return { installed: true, authenticated: false }
  }

  // Get username
  try {
    const username = execSync('gh api user --jq ".login"', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim()
    return { installed: true, authenticated: true, username }
  } catch {
    // Authenticated but couldn't get username - still consider it authenticated
    return { installed: true, authenticated: true }
  }
}

/**
 * Parse GitHub CLI errors into user-friendly messages
 */
function parseGhError(error: string): string {
  if (error.includes('already exists') || error.includes('Name already exists')) {
    return 'A repository with this name already exists. Please choose a different name.'
  }
  if (error.includes('command not found') || error.includes('not found')) {
    return 'GitHub CLI is not installed. Please install it from https://cli.github.com/'
  }
  if (error.includes('not logged in') || error.includes('authentication') || error.includes('auth login')) {
    return 'Please authenticate with GitHub CLI by running: gh auth login'
  }
  if (error.includes('Could not resolve host') || error.includes('network')) {
    return 'Network error. Please check your internet connection.'
  }
  return error
}

/**
 * Create a new GitHub repository using gh CLI
 */
export async function createGitHubRepo(
  name: string,
  options: { description?: string; isPrivate: boolean }
): Promise<CreateRepoResult> {
  try {
    // Build the command
    let cmd = `gh repo create ${name}`
    cmd += options.isPrivate ? ' --private' : ' --public'
    cmd += ' --add-readme' // Ensures repo has initial commit
    if (options.description) {
      // Escape double quotes in description
      const escapedDesc = options.description.replace(/"/g, '\\"')
      cmd += ` --description "${escapedDesc}"`
    }

    // Create the repo
    const output = execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000
    }).trim()

    // Output is the repo URL: https://github.com/username/reponame
    const repoUrl = output
    const cloneUrl = `${repoUrl}.git`

    return { repoUrl, cloneUrl }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(parseGhError(errorMessage))
  }
}

/**
 * Get the path to default commands directory
 * In development: chorus/.claude/commands/
 * In production: bundled in resources/default-commands/
 */
export function getDefaultCommandsDir(): string {
  // Check if we're in development or production
  // In development, __dirname is chorus/out/main
  // We want to get to chorus/.claude/commands/
  const devPath = join(__dirname, '../../.claude/commands')
  if (existsSync(devPath)) {
    return devPath
  }

  // Production: check for unpacked resources
  const unpackedPath = join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'default-commands')
  if (existsSync(unpackedPath)) {
    return unpackedPath
  }

  // Fallback to packed resources path
  const packedPath = join(process.resourcesPath, 'resources', 'default-commands')
  if (existsSync(packedPath)) {
    return packedPath
  }

  // Last resort - try relative to __dirname for various build configurations
  const altPath = join(__dirname, '../../../.claude/commands')
  if (existsSync(altPath)) {
    return altPath
  }

  throw new Error('Default commands directory not found')
}

/**
 * Initialize a new workspace with default Claude Code commands
 * - Creates .claude/commands/ directory
 * - Copies default commands
 * - Commits and pushes changes
 */
export async function initializeWorkspaceCommands(repoPath: string): Promise<void> {
  const { mkdirSync, copyFileSync, readdirSync } = await import('fs')

  // Get default commands directory
  const defaultCommandsDir = getDefaultCommandsDir()

  // Create .claude/commands/ in the new workspace
  const targetDir = join(repoPath, '.claude', 'commands')
  mkdirSync(targetDir, { recursive: true })

  // Copy all .md files from default commands
  const files = readdirSync(defaultCommandsDir)
  for (const file of files) {
    if (file.endsWith('.md')) {
      const srcPath = join(defaultCommandsDir, file)
      const destPath = join(targetDir, file)
      copyFileSync(srcPath, destPath)
    }
  }

  // Stage the new files
  runGit(repoPath, 'add .claude/commands/')

  // Commit
  runGit(repoPath, 'commit -m "Initialize workspace with default Claude Code commands"')

  // Push
  runGit(repoPath, 'push')
}

/**
 * Clean up a failed workspace creation
 * Deletes local directory if it exists (best effort)
 */
export async function cleanupFailedWorkspace(localPath: string): Promise<void> {
  const { rmSync } = await import('fs')
  try {
    if (existsSync(localPath)) {
      rmSync(localPath, { recursive: true, force: true })
    }
  } catch {
    // Ignore cleanup errors - best effort
  }
}
