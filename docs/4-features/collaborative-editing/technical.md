# Collaborative Editing: Technical Architecture

## Philosophy

Unlike traditional real-time editors where every keystroke is immediately broadcast to all users (a "shared memory" model), an agentic editor should adopt a "Virtual Branch" model. This concept, popularized by tools like Git Butler, allows multiple divergent states of the working directory to exist simultaneously without forcing the user to context-switch.

## 2.1 The "Lanes" Model for Agents

In a standard editor, the document has one single state. In an Agentic Editor, the document is a collection of parallel "Lanes" or Virtual Branches.

**The Trunk (Main Lane)**: The canonical, user-verified state of the document. This is what is "published."

**The Agent Lanes (Virtual Branches)**: When an agent is tasked with work (e.g., "Summarize this section" or "Fix the tone"), it does not edit the Trunk directly. It forks the relevant blocks into a private Virtual Branch.

- **Isolation**: The agent can rewrite, delete, or halluncinate on this branch without disrupting the user's view of the Trunk.

- **Parallelism**: Multiple agents can work on different tasks (Grammar, Fact-Checking, Styling) on separate branches simultaneously.

## 2.2 The "Diff" as the Primary Interaction Primitive

Because agents operate on branches, the primary mode of interaction changes from "co-typing" to "reviewing."

**Proposal**: When an agent finishes its task, it presents the Virtual Branch as a "Proposal" (conceptually similar to a Pull Request, but UI-optimized for prose).

**Semantic Diff**: The user sees a visualization of what changed. Standard red/green line diffs are insufficient for prose rewrites. We require Semantic Diffs that highlight changes in meaning (e.g., "Changed tone to formal," "Removed paragraph about X").

**Merge**: The user "Accepts" the change, which triggers a merge of the Virtual Branch into the Trunk.

## 2.3 Why Git-Style Branches Beat Pure CRDTs for Agents

| Feature | Pure Real-Time CRDT (Notion/Google Docs) | Virtual Branching (Git Butler Model) | Advantage for Agents |
|---------|------------------------------------------|--------------------------------------|----------------------|
| Edit Visibility | Immediate. Agent edits appear as they generate. | Deferred. Agent edits are isolated until reviewed. | Prevents "clippy" distractions; allows agents to "think" and draft safely. |
| Undo/Redo | Global linear history. Hard to undo just the agent's work if you typed after it. | Branch-scoped. You can discard an entire agent attempt without affecting your manual edits. | Preserves User Agency. "Reject" is a single atomic action. |
| Conflicts | Character-level interleaving (scrambled text). | Block-level conflict detection. | Prevents "Frankenstein" sentences where human and AI type over each other. |
| Review | Hard. Changes are lost in the stream of edits. | Native. Every agent action is a reviewable diff. | Essential for trust in AI-generated content. |
