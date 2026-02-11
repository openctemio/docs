---
title: Finding Detail UI Improvements
status: planned
author: UI Team
date: 2026-01-28
category: ui
---

# RFC: Finding Detail UI Improvements

## Summary

Improve the Finding Detail page with two key enhancements:
1. **Compact Header Layout**: Reduce whitespace in the finding header section
2. **Resizable Activity Panel**: Allow users to drag-resize the Activity panel width

---

## Current State Analysis

### Screenshots Reference

| Area | Current Issue |
|------|---------------|
| Red Box (Header) | Excessive vertical whitespace, each element on separate line |
| Green Box (Activity) | Fixed width (320px/380px), cannot be resized |
| Black Box (Reference) | Shows desired resizable panel behavior from other UI |

### Current Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Header (fixed)                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────┐  ┌────────────────────────┐  │
│  │ Finding Header Card (RED AREA)           │  │ Activity Panel         │  │
│  │ - ID (line 1)                            │  │ (GREEN AREA)           │  │
│  │ - Title (line 2)                         │  │                        │  │
│  │ - Status/Severity (line 3)               │  │ Fixed: 320px (lg)      │  │
│  │ - Meta info (line 4)                     │  │        380px (xl)      │  │
│  │ - Repository (line 5)                    │  │                        │  │
│  │                                          │  │ Cannot resize ✗        │  │
│  │ space-y-4 = too much vertical gap        │  │                        │  │
│  └──────────────────────────────────────────┤  │                        │  │
│  ┌──────────────────────────────────────────┤  │                        │  │
│  │ Tabs Card                                │  │                        │  │
│  │ [Overview] [Evidence] [Remediation]...   │  │                        │  │
│  │                                          │  │                        │  │
│  │ Tab content area (scrollable)            │  │                        │  │
│  │                                          │  │                        │  │
│  └──────────────────────────────────────────┘  └────────────────────────┘  │
│                                                                             │
│  gap-4 (lg:gap-6) between panels                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Current Code Location

| Component | File |
|-----------|------|
| Main Page | `ui/src/app/(dashboard)/findings/[id]/page.tsx` |
| Finding Header | `ui/src/features/findings/components/detail/finding-header.tsx` |
| Activity Panel | `ui/src/features/findings/components/detail/activity-panel.tsx` |

### Current Header Code (Problem)

```tsx
// finding-header.tsx line 153-154
<div className="space-y-4">  // ← 16px gap between ALL sections
  {/* Title and ID */}
  <div>...</div>           // Line 1-2

  {/* Status and Severity Row */}
  <div>...</div>           // Line 3

  {/* Meta Row */}
  <div>...</div>           // Line 4

  {/* Tags */}
  {finding.tags && <div>...</div>}  // Line 5

  {/* Affected Assets */}
  {finding.assets && <div>...</div>}  // Line 6
</div>
```

### Current Panel Layout (Problem)

```tsx
// page.tsx line 346-395
<div className="flex h-full gap-4 lg:gap-6">
  {/* Left Panel - Main Content */}
  <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
    ...
  </div>

  {/* Right Panel - Activity (FIXED WIDTH) */}
  <Card className="hidden w-[320px] flex-shrink-0 xl:w-[380px] lg:flex">
    ...
  </Card>
</div>
```

---

## Proposed Solution

### Part 1: Compact Header Layout

#### Design Goals
- Reduce vertical space by ~40%
- Group related information on same line
- Maintain readability and accessibility
- Keep responsive behavior

#### New Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ f2000002-0000-0000-0000-800000000002  [CVE-2024-xxxx] [CWE-89]          │  ← Row 1
│ SQL injection vulnerability in database query                            │  ← Row 2
│ [False Positive ▼] [● Critical ▼]  👤 Unassigned  📅 Jan 23, 2026  🔧 SAST │  ← Row 3
│ 📁 vnsecurity/scanner                                                    │  ← Row 4
└──────────────────────────────────────────────────────────────────────────┘
```

#### Implementation Changes

**File: `ui/src/features/findings/components/detail/finding-header.tsx`**

```tsx
// BEFORE
<div className="space-y-4">

// AFTER
<div className="space-y-2">  // Reduce from 16px to 8px

// Row 1: ID + CVE/CWE badges (no change needed)

// Row 2: Title (no change needed)

// Row 3: COMBINE Status + Severity + Meta into one row
<div className="flex flex-wrap items-center gap-3">
  {/* Status Dropdown */}
  <DropdownMenu>...</DropdownMenu>

  {/* Severity Dropdown */}
  <DropdownMenu>...</DropdownMenu>

  {/* Divider */}
  <div className="h-4 w-px bg-border" />

  {/* Assignee - inline */}
  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
    <User className="h-3.5 w-3.5" />
    <span>{finding.assignee?.name || 'Unassigned'}</span>
  </div>

  {/* Discovered Date - inline */}
  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
    <Calendar className="h-3.5 w-3.5" />
    <span>{formatDate(finding.discoveredAt)}</span>
  </div>

  {/* Source - inline */}
  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
    <ExternalLink className="h-3.5 w-3.5" />
    <span>{SOURCE_LABELS[finding.source]}</span>
  </div>
</div>

// Row 4: Repository only (move tags to Overview tab)
{finding.assets.length > 0 && (
  <div className="flex items-center gap-2 text-sm">
    <span className="text-muted-foreground">Repository:</span>
    <span className="font-medium">{finding.assets[0].name}</span>
  </div>
)}

// REMOVE: Tags section from header (move to Overview tab)
// REMOVE: Full assets list from header (keep only primary)
```

#### CSS Changes Summary

| Property | Before | After | Reason |
|----------|--------|-------|--------|
| `space-y-4` | 16px | `space-y-2` (8px) | Reduce vertical gaps |
| Meta row | Separate div | Inline with status | Consolidate rows |
| Tags | In header | Move to Overview | Reduce clutter |
| Assets list | Full list | Primary only | Simplify header |

---

### Part 2: Resizable Activity Panel

#### Design Goals
- Allow horizontal drag-resize of Activity panel
- Remember user preference (localStorage)
- Minimum/maximum width constraints
- Smooth resize experience with visual handle

#### Package

Already installed: `react-resizable-panels@^3.0.6`

#### Implementation

**File: `ui/src/app/(dashboard)/findings/[id]/page.tsx`**

```tsx
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'

// Replace current flex layout with PanelGroup
<PanelGroup
  direction="horizontal"
  autoSaveId="finding-detail-panels"  // Auto-save to localStorage
  className="h-full"
>
  {/* Left Panel - Main Content */}
  <Panel
    defaultSize={70}
    minSize={50}
    className="flex flex-col overflow-hidden"
  >
    {/* Finding Header Card */}
    <Card className="mb-4 flex-shrink-0">
      <CardContent className="pt-6">
        <FindingHeader finding={finding} />
      </CardContent>
    </Card>

    {/* Tabs */}
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Tabs>...</Tabs>
    </Card>
  </Panel>

  {/* Resize Handle */}
  <PanelResizeHandle className="group relative w-1.5 bg-transparent">
    {/* Visual indicator */}
    <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2
                    rounded-full bg-border
                    transition-colors duration-150
                    group-hover:bg-primary/50
                    group-active:bg-primary
                    group-data-[resize-handle-active]:bg-primary" />
    {/* Drag handle icon (visible on hover) */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                    opacity-0 group-hover:opacity-100 transition-opacity">
      <GripVertical className="h-4 w-4 text-muted-foreground" />
    </div>
  </PanelResizeHandle>

  {/* Right Panel - Activity */}
  <Panel
    defaultSize={30}
    minSize={20}  // ~250px minimum
    maxSize={50}  // ~600px maximum
    className="hidden lg:flex"
  >
    <Card className="flex h-full w-full flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 pb-2">
        <CardTitle className="text-base">Activity</CardTitle>
      </CardHeader>
      <div className="flex-1 overflow-hidden">
        <ActivityPanel activities={allActivities} onAddComment={handleAddComment} />
      </div>
    </Card>
  </Panel>
</PanelGroup>
```

#### Resize Handle Styling Options

**Option A: Subtle Line (Recommended)**
```tsx
<PanelResizeHandle className="w-1 mx-1">
  <div className="h-full w-full rounded-full bg-border
                  hover:bg-primary/50 active:bg-primary
                  transition-colors cursor-col-resize" />
</PanelResizeHandle>
```

**Option B: Grabber with Dots**
```tsx
<PanelResizeHandle className="w-2 flex items-center justify-center
                              bg-muted/50 hover:bg-muted cursor-col-resize">
  <GripVertical className="h-4 w-4 text-muted-foreground" />
</PanelResizeHandle>
```

**Option C: Invisible with Hover Effect (like screenshot)**
```tsx
<PanelResizeHandle className="w-4 -mx-2 group cursor-col-resize">
  <div className="mx-auto h-full w-0.5 bg-transparent
                  group-hover:bg-primary/30 group-active:bg-primary
                  transition-colors" />
</PanelResizeHandle>
```

#### Mobile/Responsive Behavior

```tsx
// On screens < lg: Activity panel hidden, no resize needed
// On screens >= lg: Show resizable panels

<PanelGroup direction="horizontal" className="h-full">
  <Panel defaultSize={100} minSize={50}>
    {/* Main content - takes full width on mobile */}
  </Panel>

  {/* Only render resize handle and activity on lg+ */}
  <PanelResizeHandle className="hidden lg:block ..." />
  <Panel defaultSize={30} className="hidden lg:flex ...">
    {/* Activity panel */}
  </Panel>
</PanelGroup>
```

---

## Implementation Plan

### Phase 1: Compact Header (Low Risk)

| Step | Task | File | Est. |
|------|------|------|------|
| 1.1 | Change `space-y-4` to `space-y-2` | `finding-header.tsx` | 5m |
| 1.2 | Merge meta row into status row | `finding-header.tsx` | 15m |
| 1.3 | Simplify assets display | `finding-header.tsx` | 10m |
| 1.4 | Move tags to Overview tab | `overview-tab.tsx` | 10m |
| 1.5 | Test responsive behavior | Manual | 10m |

**Estimated: 50 minutes**

### Phase 2: Resizable Panel (Medium Risk)

| Step | Task | File | Est. |
|------|------|------|------|
| 2.1 | Import react-resizable-panels | `page.tsx` | 2m |
| 2.2 | Replace flex layout with PanelGroup | `page.tsx` | 20m |
| 2.3 | Add PanelResizeHandle with styling | `page.tsx` | 15m |
| 2.4 | Add localStorage persistence | `page.tsx` | 5m |
| 2.5 | Handle responsive breakpoints | `page.tsx` | 15m |
| 2.6 | Test resize behavior | Manual | 15m |
| 2.7 | Update LoadingSkeleton | `page.tsx` | 10m |

**Estimated: 1.5 hours**

### Phase 3: Polish & Testing

| Step | Task | Est. |
|------|------|------|
| 3.1 | Cross-browser testing | 20m |
| 3.2 | Accessibility check (keyboard resize) | 15m |
| 3.3 | Performance check (no layout thrashing) | 10m |
| 3.4 | Update storybook if exists | 15m |

**Estimated: 1 hour**

---

## Files to Modify

| File | Changes |
|------|---------|
| `ui/src/app/(dashboard)/findings/[id]/page.tsx` | Add PanelGroup, resize handle |
| `ui/src/features/findings/components/detail/finding-header.tsx` | Compact layout |
| `ui/src/features/findings/components/detail/overview-tab.tsx` | Add tags section |

## Dependencies

| Package | Version | Status |
|---------|---------|--------|
| `react-resizable-panels` | ^3.0.6 | ✅ Already installed |

## Testing Checklist

- [ ] Header displays compactly without losing information
- [ ] Resize handle appears on hover
- [ ] Panel can be dragged to resize
- [ ] Minimum width constraints work
- [ ] Maximum width constraints work
- [ ] Size persists after page refresh (localStorage)
- [ ] Responsive: Activity panel hidden on mobile
- [ ] Responsive: No resize handle on mobile
- [ ] Keyboard accessible (arrow keys for resize)
- [ ] No layout shift during resize
- [ ] Loading skeleton matches new layout

---

## Visual Mockup

### After Implementation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Back   f2000002-0000-0000-0000-800000000002                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────┐ │ ┌───────────────────┐ │
│  │ f2000002-...  [CVE-2024-xxx] [CWE-89]         │ │ │ Activity          │ │
│  │ SQL injection vulnerability in database query │ │ │                   │ │
│  │ [FP ▼] [Critical ▼] | 👤 Unas | 📅 Jan 23 | 🔧│ │ │ ○ System  4h ago  │ │
│  │ 📁 vnsecurity/scanner                         │ ║ │   Changed status  │ │
│  ├───────────────────────────────────────────────┤ ║ │   In Progress → ✓ │ │
│  │ [Overview] [Evidence (0)] [Remediation] [Rel] │ ║ │                   │ │
│  ├───────────────────────────────────────────────┤ ║ │ ○ System  4d ago  │ │
│  │                                               │ ║ │   Discovered by   │ │
│  │  Description                                  │ ║ │   bandit          │ │
│  │  SQL injection vulnerability...               │ ║ │                   │ │
│  │                                               │ ║ ├───────────────────┤ │
│  │  Scanner Details                              │ ║ │ Add a comment...  │ │
│  │  Scanner: bandit  Source: Sast                │ ║ │ [📎] [🖼] [🔒] [→]│ │
│  │                                               │ ║ └───────────────────┘ │
│  │  Affected Assets (1)                          │ │                       │
│  │  📁 vnsecurity/scanner                        │ │   ← Draggable handle │
│  └───────────────────────────────────────────────┘   (resize here)        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

Legend:
- `║` = Resize handle (draggable)
- Compact header: 4 rows instead of 6
- Activity panel: Resizable width (20%-50% of viewport)

---

## Rollback Plan

If issues arise:
1. Revert to fixed-width Activity panel (`w-[320px]`)
2. Revert header to `space-y-4` layout
3. Both changes are independent and can be rolled back separately

---

## Success Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Header height | ~180px | ~120px | -30% |
| Activity panel | Fixed 320px | 250-600px | Flexible |
| User control | None | Resize + persist | Full |

---

## Approval

- [ ] UI/UX Review
- [ ] Code Review
- [ ] QA Testing
- [ ] Product Approval
