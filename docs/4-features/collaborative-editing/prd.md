# Collaborative Editing: Product Requirements Document

## User Flows

### Primary Flow: Agent-Assisted Rewrite

**Scenario**: User requests a tone change for part of their document

1. **User Action**: Creates a new workspace (chat)

2. **System Response**: Spawns `branch_agent_funny_intro` for the workspace

3. **User Request**: "Rewrite the intro to be funny."

4. **Agent Execution**:
   - Reads the document
   - Generates new text for Block #1 and #2
   - Works in isolation on the virtual branch

5. **System Commit**: Commits changes to `branch_agent_funny_intro`

6. **UI Presentation**: Shows the user a "Review Changes" modal (or inline diff)
   - Displays semantic diff highlighting meaning changes
   - Shows original vs. proposed text
   - Explains what changed (e.g., "Changed tone to humorous")

7. **User Decision (within conversation)**:
   - **Accept**: Marks the proposal as approved for later application
   - **Reject**: Marks the proposal as rejected, won't be applied

8. **End of Conversation Thread**:
   - **Apply**: All accepted proposals are merged into the main branch
   - **Unapply**: Changes are reverted (in Git terms)
   - User has final control over what gets committed to trunk

9. **Result**: User's trunk remains unchanged until the conversation thread concludes and accepted changes are applied
