# Create Implementation Plan

You are tasked with creating detailed implementation plans through an interactive, iterative process. These documents bridge the gap between feature requirements and actual code implementation for the Chorus desktop app. You should be thorough, technically focused, and work collaboratively to produce actionable implementation plans.

## Initial Response

When this command is invoked:

1. **Check if parameters were provided**:
   - If a feature document path was provided as a parameter, skip the default message
   - Immediately read the feature document FULLY
   - Begin the analysis process

2. **If no parameters provided**, respond with:
```
I'll help you create a detailed implementation plan. Let me start by understanding the requirements.

Please provide:
1. The feature document path (e.g., docs/features/agent-notifications.md)
2. Any existing research or related implementations
3. Any technical constraints or preferences

I'll analyze the requirements and work with you to create a comprehensive implementation plan.

Tip: You can invoke this command with a feature doc: `/create_implementation_plan docs/features/agent-notifications.md`
```

Then wait for the user's input.

## Process Steps

### Step 1: Requirements Analysis & Research

1. **Read feature document completely**:
   - Use the Read tool WITHOUT limit/offset parameters
   - Understand all user stories and functional requirements
   - Note any design considerations and constraints
   - Identify success criteria

2. **Spawn focused research tasks**:
   Before asking questions, spawn parallel research tasks to understand the implementation context:

   ```
   Task 1 - Research current implementation:
   Research how the areas mentioned in the requirements currently work in Chorus.
   1. Find existing components, pages, and patterns related to [feature area]
   2. Identify current patterns and conventions being used
   3. Look for similar features that can be used as templates
   4. Note any existing infrastructure that can be leveraged
   Use tools: Grep, Glob, LS, Read
   Return: Current implementation details with file:line references
   ```

   ```
   Task 2 - Identify technical patterns:
   Research the technical patterns needed for this implementation.
   1. Find IPC handler examples and patterns in electron/
   2. Identify React component patterns in src/components/
   3. Look for Zustand store patterns in src/store/
   4. Find SDK integration examples
   Return: Technical patterns and examples with file references
   ```

   ```
   Task 3 - Research dependencies and integration points:
   1. Find where [feature] would need to integrate
   2. Check for any existing interfaces we need to implement
   3. Look for configuration or feature flags
   4. Identify potential breaking changes
   Return: Integration requirements and constraints
   ```

3. **Wait for ALL sub-tasks to complete** before proceeding

4. **Read all files identified by research**:
   - Read relevant files completely into main context
   - Understand existing patterns and conventions
   - Identify reusable components and utilities

5. **Present analysis and ask clarifications**:
   ```
   Based on the requirements and my research, I understand we need to implement [summary].

   **Current State:**
   - [Key discovery about existing code]
   - [Pattern or convention to follow]
   - [Technical constraints discovered]

   Questions to finalize the plan:
   - [Critical technical decision]
   - [Implementation approach preference]
   - [Any missing context from requirements]

   **Design Options:**
   1. [Option A] - [pros/cons]
   2. [Option B] - [pros/cons]

   Which approach aligns best with your vision?
   ```

### Step 2: Plan Development

1. **Design the implementation approach**:
   - Determine phase breakdown strategy
   - Identify dependencies and sequencing
   - Choose technical patterns to follow
   - Plan component hierarchy

2. **Present plan outline**:
   ```
   Here's my proposed implementation plan:

   ## Overview
   [1-2 sentence summary of approach]

   ## Phases:
   1. [Phase name] - [what it establishes]
   2. [Phase name] - [what it builds on phase 1]
   3. [Phase name] - [what it completes]

   Does this phasing approach make sense? Any adjustments needed?
   ```

3. **Get feedback on plan** before writing detailed document

### Step 3: Write Implementation Plan

Generate implementation plan document:

```markdown
---
date: [Current date in YYYY-MM-DD format]
author: [Author name]
status: draft
type: implementation_plan
feature: [Feature name]
---

# [Feature Name] Implementation Plan

## Overview

[Brief description of what we're implementing and why]

## Current State Analysis

[What exists now, what's missing, key constraints discovered]

### Key Discoveries:
- [Important finding with file:line reference]
- [Pattern to follow]
- [Constraint to work within]

## What We're NOT Doing

[Explicitly list out-of-scope items to prevent scope creep]

## Implementation Approach

[High-level strategy and reasoning]

## Phase 1: [Descriptive Name]

### Overview
[What this phase accomplishes]

### Changes Required:

#### 1. [Component/File Group]
**File**: `path/to/file.ext`
**Changes**: [Summary of changes]

**Implementation Requirements:**
- [High-level description of what needs to be implemented]
- [Key functionality and behavior requirements]
- [Integration points and dependencies]
- [UI/UX specifications without code]
- [Error handling and edge cases to consider]

#### 2. [Next Component]
[Similar structure...]

### Success Criteria:

**Automated verification**
- [ ] TypeScript compiles without errors
- [ ] Tests pass

**Manual Verification**
- [ ] Feature works as expected in UI
- [ ] Edge cases handled correctly
- [ ] No regressions in related features

## Phase 2: [Descriptive Name]
[Similar structure with both automated and manual success criteria...]

## Phase 3: [Descriptive Name]
[If needed...]

## Electron-Specific Considerations

### Main Process Changes
- [Changes to electron/main.ts or electron/ipc/]
- [New IPC handlers needed]
- [SDK client management changes]

### Renderer Process Changes
- [React component changes]
- [State management updates]
- [IPC calls from renderer]

### Preload Script Changes
- [New APIs to expose]
- [Security considerations]

## Performance Considerations
[Any performance implications or optimizations needed]

## Testing Strategy

### Unit Tests
- [Key components to test]

### Integration Tests
- [IPC communication tests]
- [SDK integration tests]

### Manual Testing
- [User flow to verify]
- [Edge cases to check]

## References
* Feature spec: `docs/features/[feature-name].md`
* Related research: `docs/research/[topic].md`
* Similar implementation: `path/to/file.ext:line`
```

### Step 4: Review & Refinement

1. **Save document to**: `docs/implementation/[feature-name]-plan.md`

2. **Present for review**:
   ```
   Implementation plan created at: docs/implementation/[feature-name]-plan.md

   Please review:
   - Do the phases make sense and build on each other?
   - Are the tasks specific enough to be actionable?
   - Any technical decisions that need adjustment?
   - Ready to begin implementation?
   ```

3. **Iterate based on feedback**:
   - Adjust phase sequencing
   - Add missing technical details
   - Clarify task descriptions
   - Update architectural decisions

## Guidelines

### Be Skeptical
- Question vague requirements
- Identify potential issues early
- Ask "why" and "what about"
- Don't assume - verify with code

### Be Interactive
- Don't write the full plan in one shot
- Get buy-in at each major step
- Allow course corrections
- Work collaboratively

### Be Thorough
- Read all context files COMPLETELY before planning
- Research actual code patterns using parallel sub-tasks
- Include specific file paths and line numbers
- Write measurable success criteria

### Be Practical
- Focus on incremental, testable changes
- Consider error handling
- Think about edge cases
- Include "what we're NOT doing"

### No Open Questions in Final Plan
- If you encounter open questions during planning, STOP
- Research or ask for clarification immediately
- Do NOT write the plan with unresolved questions
- The implementation plan must be complete and actionable

### Avoid Code Snippets in Implementation Plans
- Implementation plans should contain instructions and requirements, NOT actual code
- Use high-level descriptions instead of code examples
- Focus on architectural decisions and integration requirements
- Include references to existing code patterns by file:line

## Chorus-Specific Patterns

### Electron Architecture
- Main process: electron/main.ts, electron/ipc/
- Renderer process: src/ (React app)
- Preload: electron/preload.ts
- Always consider IPC boundaries

### IPC Communication
- Use ipcMain.handle for request/response
- Use ipcMain.on/event.sender.send for streaming
- Define channels in shared constants
- Handle errors properly in both processes

### SDK Integration
- One ClaudeSDKClient per repo
- Configure with cwd pointing to repo path
- Set up hooks for status updates
- Store session IDs for resume

### State Management
- Zustand stores in src/store/
- Actions for mutations
- Selectors for derived state
- Persist with electron-store when needed

### React Components
- Functional components with hooks
- Tailwind for styling
- Slack-like design patterns
- Proper TypeScript types

## Quality Checklist

Before finalizing:

- [ ] Requirements are clearly understood and addressed
- [ ] Tasks are specific and actionable
- [ ] Technical patterns follow existing conventions
- [ ] Phases build logically on each other
- [ ] File paths and references are accurate
- [ ] Success criteria match requirements
- [ ] Electron architecture respected
- [ ] No open questions remain
