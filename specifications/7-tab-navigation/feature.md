# Sprint 7: Tab Navigation

## Overview

Add VS Code-style tab navigation to enable seamless switching between chat conversations and files. When navigating from chat to a file (e.g., via Details panel), both views remain accessible via tabs.

## User Stories

### US-1: Navigate Between Chat and Files
**As a** user reviewing agent work
**I want to** click files from the Details panel and easily return to chat
**So that** I can review changes without losing my conversation context

**Acceptance Criteria:**
- Clicking a file in Details panel opens it in a new tab
- Chat tab remains accessible
- Clicking tabs switches views instantly
- Tab shows icon (chat/file) and title

### US-2: Close Tabs
**As a** user with multiple tabs open
**I want to** close tabs I no longer need
**So that** I can keep my workspace organized

**Acceptance Criteria:**
- Close button (×) appears on hover
- Closing active tab activates adjacent tab
- Middle-click closes tab
- Closing last tab returns to workspace overview

### US-3: Persistent Tabs
**As a** returning user
**I want** my tabs to restore when I reopen the app
**So that** I can continue where I left off

**Acceptance Criteria:**
- Open tabs saved on each change
- Tabs restored on app launch
- Active tab restored correctly
- Stale tabs (deleted files/agents) handled gracefully

## UI Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [titlebar]                                                               │
├─────────────────────────────────────────────────────────────────────────┤
│ [💬 Chorus ×] [📄 app.ts ×] [📄 types.ts ×]                              │ ← Tab bar
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                         Content Area                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Tab States
- **Active**: Highlighted background, accent border-bottom, visible close button
- **Inactive**: Muted text, close button on hover
- **Hover**: Lighter background

## Technical Implementation

### State Management
New fields in `workspace-store.ts`:
```typescript
tabs: Tab[]
activeTabId: string | null
```

### Tab Interface
```typescript
interface Tab {
  id: string
  type: 'chat' | 'file'
  workspaceId?: string
  agentId?: string
  filePath?: string
  title: string
}
```

### Actions
- `openTab(tab)`: Creates new tab or activates existing
- `closeTab(tabId)`: Removes tab, activates adjacent
- `activateTab(tabId)`: Switches active tab
- `loadTabs()`: Restores from persistence
- `saveTabs()`: Persists to electron-store

### Persistence
Stored in `ChorusSettings.openTabs`:
```typescript
interface OpenTabsState {
  tabs: Tab[]
  activeTabId: string | null
}
```

## Files Modified

| File | Changes |
|------|---------|
| `workspace-store.ts` | Added tabs state, tab actions, modified selectFile/selectAgent |
| `main/store/index.ts` | Added Tab, OpenTabsState types and settings field |
| `main/index.ts` | Added `settings:set-open-tabs` IPC handler |
| `preload/index.ts` | Added `setOpenTabs` method |
| `preload/index.d.ts` | Added Tab, OpenTabsState types |
| `MainPane.tsx` | Integrated TabBar, tab-based rendering |
| `TabBar.tsx` | New component |

## Deduplication

When opening a tab that already exists (same file path or same agent):
1. Find existing tab by matching criteria
2. Activate existing tab instead of creating duplicate
3. This prevents tab proliferation
