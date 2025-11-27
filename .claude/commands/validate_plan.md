# Validate Plan

You are tasked with validating that an implementation plan was correctly executed, verifying all success criteria and identifying any deviations or issues in the Chorus codebase.

## Initial Setup

When invoked:
1. **Determine context** - Are you in an existing conversation or starting fresh?
   - If existing: Review what was implemented in this session
   - If fresh: Need to discover what was done through git and codebase analysis

2. **Locate the plan**:
   - If plan path provided, use it
   - Otherwise, search recent commits for plan references or ask user
   - Look in `docs/implementation/` for implementation plans

3. **Gather implementation evidence**:
   ```bash
   # Check recent commits
   git log --oneline -n 20
   git diff HEAD~N..HEAD  # Where N covers implementation commits

   # Run Chorus checks
   npm run lint
   npm run typecheck
   npm run build
   ```

## Validation Process

### Step 1: Context Discovery

If starting fresh or need more context:

1. **Read the implementation plan** completely using Read tool (WITHOUT limit/offset)
2. **Identify what should have changed**:
   - List all files that should be modified
   - Note all success criteria (automated and manual)
   - Identify key functionality to verify

3. **Spawn parallel research tasks** to discover implementation:
   ```
   Task 1 - Verify Electron main process changes:
   Research if main process changes were implemented as specified.
   Check: electron/main.ts, electron/ipc/, electron/preload.ts
   Look for: new IPC handlers, SDK client changes, hook implementations
   Return: What was implemented vs what plan specified
   ```

   ```
   Task 2 - Verify React component changes:
   Check if React components were added/modified as specified.
   Look in: src/components/, src/store/, src/hooks/
   Check: new components, state management, IPC calls
   Return: Component implementation vs plan requirements
   ```

   ```
   Task 3 - Verify TypeScript and build:
   Check if TypeScript compiles and build succeeds.
   Run: npm run typecheck, npm run build
   Look for: type errors, build errors
   Return: Build status and any errors
   ```

### Step 2: Systematic Validation

For each phase in the implementation plan:

1. **Check completion status**:
   - Look for checkmarks in the plan (- [x])
   - Verify the actual code matches claimed completion

2. **Run automated verification**:
   - Execute each command from "Automated Verification" section
   - Document pass/fail status
   - If failures, investigate root cause

3. **Assess manual criteria**:
   - List what needs manual testing
   - Check IPC communication works
   - Verify UI renders correctly
   - Test error handling

4. **Think deeply about Chorus patterns**:
   - Are IPC handlers properly structured?
   - Do React components follow patterns?
   - Is state management correctly implemented?
   - Are SDK clients properly managed?
   - Does the UI follow Slack-like patterns?

### Step 3: Generate Validation Report

Create comprehensive validation summary:

```markdown
## Validation Report: [Plan Name]

### Implementation Status
✅ Phase 1: [Name] - Fully implemented
✅ Phase 2: [Name] - Fully implemented
⚠️ Phase 3: [Name] - Partially implemented (see issues)

### Automated Verification Results
✅ TypeScript compiles: `npm run typecheck`
✅ Build succeeds: `npm run build`
✅ Lint passes: `npm run lint`
❌ Tests fail: `npm test` (2 failures)

### Code Review Findings

#### Matches Plan:
- IPC handler correctly implements [functionality]
- React component follows specified structure
- Zustand store manages state as described
- SDK integration works as expected

#### Deviations from Plan:
- Used different component name in [file:line] (cosmetic)
- Added extra validation in [file:line] (improvement)
- Skipped intermediate step in favor of more direct approach

#### Chorus Pattern Compliance:
✅ IPC handlers use proper async patterns
✅ React components use TypeScript properly
✅ Zustand store follows conventions
✅ Tailwind classes match design system
❌ Missing error boundary in [component:line]

#### Potential Issues:
- Missing error handling in [file:line]
- No loading state for async operation in [file]
- IPC channel name doesn't match constant

### Manual Testing Required:
1. **UI Testing**:
   - [ ] Navigate to feature and verify it appears correctly
   - [ ] Test error states with invalid input
   - [ ] Check responsive behavior

2. **IPC Testing**:
   - [ ] Verify main process receives messages
   - [ ] Check renderer receives responses
   - [ ] Test streaming if applicable

3. **SDK Testing**:
   - [ ] Agent queries work correctly
   - [ ] Status updates propagate to UI
   - [ ] Session resume functions properly

### Recommendations:
- Address TypeScript warnings before merge
- Add missing error boundaries for better UX
- Consider adding integration tests for [scenario]
- Update documentation if new patterns were established
```

## Working with Existing Context

If you were part of the implementation:
- Review the conversation history for what was actually done
- Check your todo list (if any) for completed items
- Focus validation on work done in this session
- Be honest about any shortcuts or incomplete items
- Note any decisions that deviated from the plan and why

## Chorus-Specific Checks

Always verify Chorus patterns:

### Electron Main Process
- [ ] IPC handlers in electron/ipc/ or electron/main.ts
- [ ] Proper async/await patterns
- [ ] Error handling with proper responses
- [ ] SDK client lifecycle management

### React Renderer
- [ ] Components in src/components/
- [ ] Proper TypeScript types
- [ ] Zustand store integration
- [ ] Tailwind styling follows patterns

### IPC Communication
- [ ] Channel names defined consistently
- [ ] Request/response patterns correct
- [ ] Streaming patterns if applicable
- [ ] Error propagation works

### State Management
- [ ] Zustand stores properly structured
- [ ] Actions handle errors
- [ ] Selectors memoized if needed
- [ ] Persistence if required

### SDK Integration
- [ ] Client options correctly configured
- [ ] Hooks properly implemented
- [ ] Session IDs stored/retrieved
- [ ] Cost tracking if applicable

## Important Guidelines

1. **Be thorough but practical** - Focus on what matters for shipping
2. **Run all automated checks** - Don't skip TypeScript/build verification
3. **Document everything** - Both successes and issues
4. **Think critically** - Question if implementation truly solves the problem
5. **Consider maintenance** - Will this be maintainable long-term?

## Validation Checklist

Always verify:
- [ ] All phases marked complete are actually done
- [ ] TypeScript compiles without errors
- [ ] Build succeeds
- [ ] Code follows Chorus patterns
- [ ] No regressions in existing functionality
- [ ] Error handling is robust
- [ ] Manual test steps are clear
- [ ] IPC communication works correctly

## Common Issues to Check

### IPC Issues
- Channel name mismatch between main/renderer
- Missing async handling
- Error not propagated to renderer
- Response format incorrect

### React Component Issues
- Missing TypeScript types
- Incorrect hook dependencies
- State not updating properly
- Missing error boundaries

### SDK Integration Issues
- Client not initialized before use
- Hooks not configured correctly
- Session not persisted
- Streaming not handled properly

### State Management Issues
- Store not updating UI
- Missing actions for operations
- Persistence not working
- Cross-process sync broken

Remember: Good validation catches issues before they reach users. Be constructive but thorough in identifying gaps or improvements that align with Chorus's patterns and quality standards.
