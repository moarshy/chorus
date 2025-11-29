# Sprint 7: Tab Navigation - Implementation Plan

## Overview

Add a VS Code-style tab bar to MainPane enabling navigation between open chats and files. When a user clicks a file from the Details panel, it opens in a new tab while keeping the chat tab available. Tabs persist across app restarts.

## UI Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [titlebar drag region]                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ [💬 Agent Chat ×] [📄 app.ts ×] [📄 types.ts ×]                         │  ← Tab bar
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                         Content Area                                     │
│                    (ChatView or FileViewer)                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Tab Appearance
- **Chat tabs**: 💬 icon + agent name (or "New Chat")
- **File tabs**: 📄 icon + filename only (full path in tooltip)
- **Active tab**: Highlighted background, border accent
- **Close button**: × on hover, always visible on active tab
- **Overflow**: Horizontal scroll when too many tabs

## Data Model

### Tab Interface
```typescript
interface Tab {
  id: string                    // Unique ID (uuid)
  type: 'chat' | 'file'

  // For chat tabs
  workspaceId?: string
  agentId?: string
  conversationId?: string       // Optional - specific conversation

  // For file tabs
  filePath?: string

  // Display
  title: string                 // Displayed in tab
  icon?: 'chat' | 'file'
}
```

### State Management (workspace-store)
```typescript
// New state fields
tabs: Tab[]
activeTabId: string | null

// New actions
openTab: (tab: Omit<Tab, 'id'>) => string  // Returns new tab ID
closeTab: (tabId: string) => void
activateTab: (tabId: string) => void
reorderTabs: (fromIndex: number, toIndex: number) => void
```

## Implementation Phases

### Phase 1: State Management
**File: `workspace-store.ts`**

1. Add `tabs` and `activeTabId` to store state
2. Implement `openTab` action:
   - Check if tab with same content already exists (dedup by filePath or agentId)
   - If exists, activate existing tab
   - If new, create tab with uuid, add to array, set as active
3. Implement `closeTab` action:
   - Remove from array
   - If closed tab was active, activate adjacent tab (prefer left, then right)
   - If no tabs left, set activeTabId to null
4. Implement `activateTab` action:
   - Set activeTabId
5. Modify `selectFile` to use `openTab` instead of direct state set
6. Modify `selectAgent` to use `openTab` instead of direct state set

### Phase 2: Persistence
**Files: `workspace-store.ts`, `main/store/index.ts`**

1. Add `openTabs` to electron-store schema
2. On tab changes, persist to store
3. On app load, restore tabs from store
4. Handle stale tabs (file deleted, agent removed)

### Phase 3: Tab Bar Component
**File: `components/MainPane/TabBar.tsx`** (new)

1. Create `TabBar` component
2. Render list of tabs with:
   - Icon (chat or file)
   - Title (truncated if needed)
   - Close button (× on hover)
   - Active state styling
3. Click handler to activate tab
4. Close button handler
5. Middle-click to close

### Phase 4: MainPane Integration
**File: `components/MainPane/MainPane.tsx`**

1. Import and render `TabBar` between titlebar and content
2. Modify `renderContent` to use active tab:
   ```typescript
   const activeTab = tabs.find(t => t.id === activeTabId)
   if (!activeTab) return <WelcomeView />

   if (activeTab.type === 'file') {
     return <FileViewer filePath={activeTab.filePath!} />
   }
   if (activeTab.type === 'chat') {
     // Need to pass workspace and agent from activeTab
     return <ChatView ... />
   }
   ```
3. Remove old `selectedFilePath`, `selectedAgentId` based rendering

### Phase 5: Update Navigation Sources
**Files: `ConversationDetails.tsx`, `Sidebar`, etc.**

1. Update `selectFile` calls to create file tabs
2. Update agent selection to create chat tabs
3. Ensure sidebar agent click creates/activates chat tab

## Edge Cases

1. **Duplicate prevention**: Opening same file twice activates existing tab
2. **Orphan cleanup**: On workspace load, remove tabs for deleted files/agents
3. **Tab limit**: Optional max tabs (e.g., 20) - close oldest inactive when exceeded
4. **Unsaved changes**: FileViewer has edit mode - warn before closing if dirty
5. **Chat context**: When chat tab activated, need to restore full chat state (conversation, messages)

## Migration

The existing `selectedFilePath`, `selectedAgentId`, `selectedWorkspaceId` pattern needs to be replaced with the tab system. During migration:

1. Keep `selectedWorkspaceId` - it's still needed for workspace context
2. Replace `selectedFilePath` and `selectedAgentId` with tab-based selection
3. MainPane reads from `activeTab` instead of individual selection states

## Files to Modify

| File | Changes |
|------|---------|
| `workspace-store.ts` | Add tabs state, tab actions, modify select actions |
| `main/store/index.ts` | Add openTabs to persistence schema |
| `MainPane.tsx` | Add TabBar, use activeTab for rendering |
| `TabBar.tsx` | New component |
| `ConversationDetails.tsx` | Use openTab for file clicks |
| `Sidebar` components | Use openTab for agent selection |
| `preload/index.d.ts` | Add Tab type if needed for IPC |

## Testing Checklist

- [ ] Click file in Details → opens in new tab, chat tab stays
- [ ] Click same file again → activates existing tab (no duplicate)
- [ ] Click × on tab → closes, activates adjacent
- [ ] Click chat tab → returns to chat view
- [ ] Restart app → tabs restored
- [ ] Delete file externally → stale tab handled gracefully
- [ ] Many tabs → horizontal scroll works
- [ ] Middle-click tab → closes it
