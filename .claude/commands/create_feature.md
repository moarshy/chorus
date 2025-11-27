# Create Feature Command

You are tasked with discovering, defining, and creating comprehensive feature specifications through collaborative conversation and iterative requirements gathering. Your role is to guide the user through feature ideation, problem understanding, and requirements definition to produce a complete feature specification document for the Chorus desktop app.

## Initial Response

When this command is invoked:

1. **Check if parameters were provided**:
   - If a feature idea, description, context, or rough specification was provided as a parameter, begin the discovery process with that context
   - If files are referenced, read them FULLY first to understand existing context
   - If no parameters provided, respond with the default prompt below

2. **If no parameters provided**, respond with:
```
I'll help you discover, define, and specify a new feature for Chorus through collaborative conversation. Let's start by understanding what you have in mind.

What feature or capability are you considering? This could be:
- A rough idea ("users need better ways to...")
- A specific feature request ("add support for...")
- A problem you've observed ("it's hard to...")
- A workflow improvement ("when switching between agents...")

Don't worry about having all the details - we'll explore, refine, and create comprehensive specifications together!

Tip: You can also invoke this command with context: `/create_feature agent status notifications` or `/create_feature based on docs/feature-ideas/sidebar-improvements.md`
```

Then wait for the user's input.

## Process Overview

This command combines feature discovery and requirements specification into a unified workflow:

1. **Discovery Phase**: Collaborative exploration to understand the problem and define the feature
2. **Requirements Phase**: Detailed specification creation with user stories and technical requirements
3. **Document Creation**: Single comprehensive `feature.md` document

## Phase 1: Discovery & Problem Understanding

### Step 1: Context Gathering

1. **Read all referenced files immediately and FULLY**:
   - Research documents related to the feature area
   - Related implementation plans, customer feedback, technical notes
   - Existing documentation in `docs/`
   - Use the Read tool WITHOUT limit/offset parameters to read entire files

2. **Spawn focused research agents** (only if needed for complex features):
   ```
   Task 1 - Research current implementation:
   Find how [the feature area] currently works in the Chorus codebase.
   1. Locate relevant files and components
   2. Identify data models and existing patterns
   3. Look for similar features to model after
   Return: Key files and patterns with file:line references
   ```

### Step 2: Problem Exploration

1. **Understand the core concept**:
   - What problem are we trying to solve?
   - Who are the primary users (Richard, developers, non-technical users)?
   - What triggered this feature idea?
   - Any constraints or assumptions?

2. **Deep dive into the problem**:
   - What pain points does this address?
   - How do users currently handle this situation?
   - What makes the current approach insufficient?

3. **Acknowledge and probe deeper**:
   ```
   I understand you're thinking about [summarize their idea].

   Let me ask some clarifying questions:
   - What specific problem does this solve for [user type]?
   - Can you walk me through a scenario where someone would need this?
   - Are there any existing approaches to this problem that aren't working well?
   ```

### Step 3: Solution Brainstorming & Scope Definition

1. **Explore solution space**:
   - What are different ways we could approach this?
   - Are there analogous features in Slack/Discord/other tools?
   - What would the ideal solution look like?
   - Any technical approaches to consider?

2. **Define the core feature**:
   - What's the minimum valuable solution?
   - What would make this feature successful?
   - How would users discover and use this?
   - What does the user experience flow look like?

3. **Consider Chorus architecture**:
   - How does this fit with Electron main/renderer split?
   - Does this need IPC communication?
   - Does this affect SDK client management?
   - UI/UX considerations for Slack-like interface?

## Phase 2: Requirements Specification

### Step 1: Core User Stories

1. **Focus on primary user flows**:
   - Main user workflow
   - Critical edge cases
   - Error scenarios that break functionality

2. **Write stories in given/when/then format**:
   ```
   Key user stories:

   1. **Given** [context], **when** [action], **then** [expected result]
   2. **Given** [edge case], **when** [action], **then** [handle gracefully]

   Do these cover the core functionality?
   ```

### Step 2: Essential Requirements

1. **Define what must work**:
   - Core functionality
   - Critical integrations
   - UI components needed
   - State management needs

2. **Note constraints**:
   - Existing patterns to follow
   - Security requirements (Electron security model)
   - Performance considerations

## Phase 3: Feature Document Creation

### Step 1: Create Comprehensive Feature Document

Write the document directly using this template:

```markdown
---
date: [Current date in YYYY-MM-DD format]
author: [Author name]
status: draft
type: feature
---

# [Feature Name] Feature

## Overview
[2-3 sentence description of what this feature enables and why it matters for Chorus users]

## Business Value

### For Power Users (like Richard)
- [How this helps manage multiple agents]
- [Workflow improvements]
- [Time savings]

### For New Users
- [How this makes Chorus more accessible]
- [Reduced learning curve]
- [Better onboarding]

## Current State
[Description of what currently exists, limitations, or pain points]

## User Stories
(in given/when/then format)

### Agent Management
1. **User**: **Given** [context], **when** [action], **then** [expected result] - [Acceptance criteria]

### UI/UX
2. **User**: **Given** [context], **when** [action], **then** [expected result] - [Acceptance criteria]

## Core Functionality

### [Major Capability 1]
- Key behaviors and features
- User interactions
- System capabilities

### [Major Capability 2]
- Additional functionality areas
- Integration points

## Technical Requirements

### Electron Architecture
- Main process requirements
- Renderer process requirements
- IPC communication needs
- Preload script considerations

### UI Components
- React components needed
- Tailwind styling approach
- Slack-like design patterns

### State Management
- Zustand store changes
- Persistence requirements
- Cross-process state sync

### SDK Integration
- Claude Agent SDK usage
- Hook implementations
- Session management

## Design Considerations

### Layout & UI
- Specific layout requirements
- Visual hierarchy guidelines
- Slack-inspired patterns

### Responsive Behavior
- Window resizing behavior
- Minimum window sizes
- Component adaptations

## Implementation Considerations

### Technical Architecture
- High-level technical approach
- Integration with existing systems
- Data flow

### Dependencies
- Other features this depends on
- External packages needed

## Success Criteria

### Core Functionality
- Feature works as expected
- Error handling prevents crashes

### User Experience
- Intuitive to use
- Consistent with Slack-like design
- Fast and responsive

## Scope Boundaries

### Definitely In Scope
- Core functionality that must be included
- Essential user workflows

### Definitely Out of Scope
- Functionality explicitly excluded
- Future enhancements not in initial version

### Future Considerations
- Potential enhancements for later versions
- MCP server deployment (Phase 3)
- Inter-agent communication

## Open Questions & Risks

### Questions Needing Resolution
- Technical decisions to be made
- UX details to clarify

### Identified Risks
- Potential implementation challenges
- Performance concerns

## Next Steps
- Ready for implementation planning
```

### Step 2: Document Location & Review

1. **Save document to**:
   - `docs/features/[feature-name].md` for new features
   - Ask user for preferred location if unclear

2. **Ask for focused feedback**:
   ```
   Feature specification created at: docs/features/[feature-name].md

   This document captures both the feature definition and detailed requirements:
   - Problem statement and business value
   - User stories covering main workflow and edge cases
   - Technical requirements and implementation considerations
   - Success criteria and scope boundaries

   Quick check:
   - Does this accurately represent what we discussed?
   - Any missing core functionality or requirements?
   - Ready to create implementation plan or need adjustments?
   ```

## Conversation Guidelines

### Be Conversational & Collaborative
- Ask open-ended questions to encourage exploration
- Build on the user's ideas
- Use "What if..." and "How might we..." framing
- Ask for user feedback often

### Probe for Depth
- Ask "Why is this important?" multiple times
- Explore edge cases and failure modes
- Challenge assumptions gently
- Look for unstated requirements

### Stay User-Focused
- Always bring conversation back to user value
- Consider both power users and new users
- Question feature ideas that don't clearly solve problems

### Consider Chorus Context
- How does this advance Chorus's vision?
- Does this help with multi-agent orchestration?
- How does this fit with the Slack-like UX?
- What are the Electron-specific considerations?

## Quality Checklist

Before finalizing the feature specification:

- [ ] Clear problem statement that explains user pain
- [ ] Distinct value propositions for different user types
- [ ] User stories cover core workflow and critical edge cases
- [ ] Requirements are implementable and specific
- [ ] Technical considerations appropriate for Electron + React
- [ ] Clear boundaries between in-scope and out-of-scope
- [ ] Success metrics that can actually be measured
- [ ] Document follows template structure

## Common Patterns for Chorus

### Electron Architecture
- Main process handles SDK clients and file system
- Renderer process handles UI and user interaction
- IPC for communication between processes
- Preload script for security bridge

### UI Components
- Slack-like sidebar for agent list
- Chat interface for agent communication
- Tab system for Messages/Files/Docs
- Status indicators for agent state

### State Management
- Zustand for React state
- electron-store for persistence
- IPC for cross-process sync

### SDK Integration
- One client per repo
- Hooks for status updates
- Session persistence for resume
