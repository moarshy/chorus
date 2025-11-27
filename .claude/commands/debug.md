# Debug

You are tasked with helping debug issues during development or manual testing of Chorus. This command allows you to investigate problems by examining logs, process state, and git history without editing files. Think of this as a way to bootstrap a debugging session without using the primary window's context.

## Initial Response

When invoked WITH a context file:
```
I'll help debug issues with [file name]. Let me understand the current state.

What specific problem are you encountering?
- What were you trying to test/implement?
- What went wrong?
- Any error messages?

I'll investigate the logs, process state, and git state to help figure out what's happening.
```

When invoked WITHOUT parameters:
```
I'll help debug your current issue.

Please describe what's going wrong:
- What are you working on?
- What specific problem occurred?
- When did it last work?

I can investigate logs, process state, and recent changes to help identify the issue.
```

## Environment Information

You have access to these key locations and tools:

**Electron Process State**:
- Main process: `electron/main.ts`
- Renderer process: React app in `src/`
- IPC handlers: `electron/ipc/`
- Check running processes: `ps aux | grep -E "electron|node"`

**SDK Client State**:
- SDK clients managed in main process
- Each agent = separate SDK client with own cwd
- Session IDs stored for resume capability

**Git State**:
- Check current branch, recent commits, uncommitted changes
- Main branch: `main`

## Process Steps

### Step 1: Understand the Problem

After the user describes the issue:

1. **Read any provided context** (doc or ticket file):
   - Understand what they're implementing/testing
   - Note which component they're working on
   - Identify expected vs actual behavior

2. **Quick state check**:
   - Current git branch and recent commits
   - Any uncommitted changes
   - When the issue started occurring

### Step 2: Investigate the Issue

Spawn parallel Task agents for efficient investigation:

```
Task 1 - Check Application State:
Analyze the Chorus app state:
1. Check if Electron processes are running
2. Look for TypeScript compilation errors
3. Check for build errors in dist/
4. Look for console errors in dev tools
5. Check IPC channel registrations
Return: Key errors/warnings with context
```

```
Task 2 - SDK Client State:
Check the SDK client configuration and state:
1. Verify @anthropic-ai/claude-agent-sdk is installed
2. Check SDK client initialization code
3. Look for session management issues
4. Check hook configurations
Return: SDK-related findings
```

```
Task 3 - Git and File State:
Understand what changed recently:
1. Check git status and current branch
2. Look at recent commits: git log --oneline -10
3. Check uncommitted changes: git diff
4. Verify key files exist (electron/main.ts, src/App.tsx)
5. Check for TypeScript errors: npx tsc --noEmit
Return: Git state and any file issues
```

### Step 3: Present Findings

Based on the investigation, present a focused debug report:

```markdown
## Debug Report

### What's Wrong
[Clear statement of the issue based on evidence]

### Evidence Found

**From Application State**:
- [Error/warning from build or runtime]
- [Process state issues]
- [IPC communication problems]

**From SDK Client**:
- [SDK configuration issues]
- [Session management problems]
- [Hook-related errors]

**From Git/Files**:
- [Recent changes that might be related]
- [TypeScript or build errors]

### Root Cause
[Most likely explanation based on evidence]

### Next Steps

1. **Try This First**:
   ```bash
   [Specific command or action]
   ```

2. **If That Doesn't Work**:
   - Check Electron main process logs
   - Verify SDK API key is set
   - Clear build cache: `rm -rf dist/`
   - Reinstall dependencies: `npm install`
   - Check IPC channel names match between main/renderer

### Can't Access?
Some issues might be outside my reach:
- Browser DevTools console (F12 in Electron window)
- Real-time IPC message flow
- SDK API responses

Would you like me to investigate something specific further?
```

## Important Notes

- **Focus on development/testing scenarios** - This is for debugging during implementation
- **Always require problem description** - Can't debug without knowing what's wrong
- **Read files completely** - No limit/offset when reading context
- **Understand Electron architecture** - Main process vs renderer process
- **No file editing** - Pure investigation only

## Quick Reference

**Check Electron State**:
```bash
# Check if Electron is running
ps aux | grep electron

# Check Node processes
ps aux | grep node

# Check for port conflicts
lsof -i :3000
```

**Check Build State**:
```bash
# TypeScript errors
npx tsc --noEmit

# Check dist folder
ls -la dist/

# Check dependencies
npm ls @anthropic-ai/claude-agent-sdk
```

**Git State**:
```bash
git status
git log --oneline -10
git diff
```

**Common Issues**:
- IPC channel mismatch between main/renderer
- SDK client not initialized before query
- Session ID not stored/retrieved properly
- Hooks not configured correctly
- Missing contextIsolation/preload setup

## Chorus Architecture Quick Reference

```
┌─────────────────────────────────────────────────────────────┐
│                    Chorus (Electron)                         │
├─────────────────────────────────────────────────────────────┤
│  Main Process (electron/main.ts)                            │
│  - Creates BrowserWindow                                    │
│  - Spawns SDK clients per agent/repo                        │
│  - Handles IPC from renderer                                │
├─────────────────────────────────────────────────────────────┤
│  Preload Script (electron/preload.ts)                       │
│  - Exposes IPC API to renderer                              │
│  - contextBridge for security                               │
├─────────────────────────────────────────────────────────────┤
│  Renderer Process (src/)                                    │
│  - React app with Slack-like UI                             │
│  - Uses exposed IPC API                                     │
│  - State management (Zustand)                               │
└─────────────────────────────────────────────────────────────┘
```

Remember: This command helps you investigate without burning the primary window's context. Perfect for when you hit an issue during development and need to dig into logs, process state, or configuration.
