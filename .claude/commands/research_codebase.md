# Research Codebase

You are tasked with conducting comprehensive research across the Chorus codebase to answer user questions by spawning parallel sub-agents and synthesizing their findings.

## Initial Setup:

When this command is invoked, respond with:
```
I'm ready to research the Chorus codebase. Please provide your research question or area of interest, and I'll analyze it thoroughly by exploring relevant components and connections.

Example questions:
- "How does IPC communication work between main and renderer?"
- "Where are SDK clients managed?"
- "How does the sidebar agent list get updated?"
```

Then wait for the user's research query.

## Steps to follow after receiving the research query:

1. **Read any directly mentioned files first:**
   - If the user mentions specific files (docs, code files), read them FULLY first
   - **IMPORTANT**: Use the Read tool WITHOUT limit/offset parameters to read entire files
   - **CRITICAL**: Read these files yourself in the main context before spawning any sub-tasks
   - This ensures you have full context before decomposing the research

2. **Analyze and decompose the research question:**
   - Break down the user's query into composable research areas
   - Identify specific components, patterns, or concepts to investigate
   - Create a research plan using TodoWrite to track all subtasks
   - Consider which directories, files, or architectural patterns are relevant

3. **Spawn parallel sub-agent tasks for comprehensive research:**
   - Create multiple Task agents to research different aspects concurrently
   - Always include these parallel tasks:
     - **Electron main process task** (electron/ directory)
     - **React renderer task** (src/ directory)
     - **Documentation task** (docs/ directory)
   - Each sub-agent should focus on a specific area
   - Write detailed prompts for each sub-agent following these guidelines:
     - Instruct them to use READ-ONLY tools (Read, Grep, Glob, LS)
     - Ask for specific file paths and line numbers
     - Request they identify connections between components
     - Have them note architectural patterns and conventions

   Example sub-agent prompts:

   ```
   Research Electron main process for [topic]:
   1. Find all files in electron/ related to [topic]
   2. Identify IPC handlers that handle [functionality]
   3. Look for SDK client management code
   4. Find hook implementations
   5. Note any patterns or conventions used
   6. Use only READ-ONLY tools (Read, Grep, Glob, LS)
   Return: File paths, line numbers, code patterns found, and concise explanations
   ```

   ```
   Research React renderer for [topic]:
   1. Find components in src/ related to [topic]
   2. Identify state management patterns (Zustand stores)
   3. Look for IPC calls from renderer
   4. Find UI patterns and Tailwind usage
   5. Note component composition patterns
   Return: File paths, line numbers, patterns, and explanations
   ```

   ```
   Research documentation for [topic]:
   1. Search docs/ for relevant information
   2. Look for feature specs, implementation plans
   3. Find architecture decisions or design docs
   4. Check product plan for context
   Return: Relevant documentation with references
   ```

4. **Wait for all sub-agents to complete and synthesize findings:**
   - IMPORTANT: Wait for ALL sub-agent tasks to complete before proceeding
   - Compile all sub-agent results
   - Connect findings across different components (main ↔ renderer ↔ docs)
   - Include specific file paths and line numbers for reference
   - Highlight patterns, connections, and architectural decisions
   - Answer the user's specific questions with concrete evidence

5. **Generate research document:**
   - Structure the document with clear sections:

   ```markdown
   ---
   date: [Current date in YYYY-MM-DD format]
   author: [Author name]
   topic: "[User's Question/Topic]"
   type: research
   ---

   # Research: [User's Question/Topic]

   ## Research Question
   [Original user query]

   ## Summary
   [High-level findings answering the user's question]

   ## Detailed Findings

   ### Electron Main Process
   - Finding with reference (`electron/file.ts:line`)
   - Connection to renderer process
   - Implementation details

   ### React Renderer
   - Component findings (`src/components/File.tsx:line`)
   - State management patterns
   - IPC usage

   ### Architecture Insights
   [Patterns, conventions, and design decisions discovered]

   ## Code References
   - `electron/main.ts:123` - Description of what's there
   - `src/components/Sidebar.tsx:45-67` - Description of the code block

   ## Documentation Context
   [Relevant insights from docs/ with references]

   ## Related Files
   - `path/to/related/file.ts` - Why it's related

   ## Open Questions
   [Any areas that need further investigation]
   ```

6. **Save and present findings:**
   - Save to `docs/research/[topic]-[date].md`
   - Present a concise summary of findings to the user
   - Include key file references for easy navigation
   - Ask if they have follow-up questions

7. **Handle follow-up questions:**
   - If the user has follow-up questions, append to the same research document
   - Add a new section: `## Follow-up Research [timestamp]`
   - Spawn new sub-agents as needed for additional investigation

## Chorus-Specific Research Areas

### Electron Main Process (electron/)
- `electron/main.ts` - Main entry point, window creation
- `electron/preload.ts` - Preload script for IPC bridge
- `electron/ipc/` - IPC handlers for various features
- SDK client management
- File system operations

### React Renderer (src/)
- `src/App.tsx` - Main app component
- `src/components/` - React components
  - Sidebar components (agent list)
  - Chat components (message display, input)
  - Tab components (Files, Docs)
- `src/store/` - Zustand stores
- `src/hooks/` - Custom React hooks
- `src/types/` - TypeScript type definitions

### Documentation (docs/)
- `docs/0-product-plan/` - Product vision and plan
- `docs/1-meeting-notes/` - Meeting transcripts
- `docs/2-competitors/` - Competitor analysis
- `docs/3-tools/` - Tool documentation (SDK, Git Butler)
- `docs/features/` - Feature specifications
- `docs/implementation/` - Implementation plans

## Important Notes:

- Always use parallel Task agents to maximize efficiency
- The docs/ directory provides context for understanding decisions
- Focus on finding concrete file paths and line numbers
- Research documents should be self-contained with all necessary context
- Each sub-agent prompt should be specific and focused on read-only operations
- Consider cross-component connections (main ↔ renderer via IPC)
- Keep the main agent focused on synthesis, not deep file reading
- Encourage sub-agents to find examples and usage patterns

## Common Research Patterns

### IPC Communication Research
- Find ipcMain handlers in electron/
- Find ipcRenderer calls in src/
- Match channel names between processes
- Trace data flow across IPC boundary

### SDK Integration Research
- Find SDK imports and client creation
- Identify hook configurations
- Trace message streaming flow
- Find session management code

### UI Component Research
- Find component definitions
- Identify props and state
- Trace data flow from store to UI
- Find Tailwind class patterns

### State Management Research
- Find Zustand store definitions
- Identify actions and selectors
- Trace state updates
- Find persistence patterns
