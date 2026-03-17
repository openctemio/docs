# RFC: Campaign Detail Sheet — Inline Editing

**Created:** 2026-03-17
**Status:** PLANNED
**Priority:** P1 (UX)
**Scope:** Replace Edit dialog with inline editing in Campaign Detail Sheet

---

## Problem

Current flow to edit a campaign:
1. Open campaign detail sheet
2. Click "Edit" button → sheet closes → Edit dialog opens
3. Edit dialog only has basic fields (name, description, type, priority, dates, methodology)
4. Cannot edit: scope, team members, rules of engagement, objectives, tags
5. Close dialog → reopen sheet to verify

This is slow (3+ clicks), loses context, and missing fields force users to use raw API.

## Solution

Each section in the detail sheet becomes directly editable. Click an "Edit" icon on a card → card switches to edit mode → user makes changes → click "Save" → PATCH API → card returns to view mode.

---

## Design

### UX Pattern: Inline Edit Cards

```
┌─────────────────────────────────────────┐
│ Description                    [Edit] │  ← view mode
│ Comprehensive security assessment...    │
└─────────────────────────────────────────┘

  ↓ click Edit

┌─────────────────────────────────────────┐
│ Description                            │  ← edit mode
│ ┌─────────────────────────────────────┐ │
│ │ Comprehensive security assessment...│ │  ← Textarea
│ └─────────────────────────────────────┘ │
│                      [Cancel] [Save]  │
└─────────────────────────────────────────┘
```

### Per-Tab Breakdown

#### Tab 1: Overview (6 editable sections)

| Section | View Mode | Edit Mode | API Field |
|---------|-----------|-----------|-----------|
| Description | Text paragraph | `<Textarea>` | `description` |
| Timeline | Start/End date display | 2x `<Input type="date">` | `start_date`, `end_date` |
| Methodology | Badge | `<CreatableSelect>` (reuse from create form) | `methodology` |
| Tags | Badge list | Tag input (type + Enter to add) | `tags[]` |
| Objectives | Numbered list | Dynamic text input list (add/remove) | `objectives[]` |
| Findings | Severity grid (read-only) | Not editable (derived from data) | — |

**Save strategy:** Each section saves independently via `PUT /api/v1/pentest/campaigns/{id}`. Send full campaign payload with the changed field.

#### Tab 2: Scope (1 editable section)

| Section | View Mode | Edit Mode | API Field |
|---------|-----------|-----------|-----------|
| Scope Items | In-scope / Out-of-scope cards | Dynamic list: type select + value input + notes input + in_scope toggle. Add/remove buttons. | `scope_items[]` |

**Scope item fields:**
- `type`: Select (domain, ip, cidr, url, application)
- `value`: Text input
- `notes`: Text input (optional)
- `inScope`: Toggle (in-scope vs out-of-scope)

#### Tab 3: Team (1 editable section)

| Section | View Mode | Edit Mode | API Field |
|---------|-----------|-----------|-----------|
| Team Members | Avatar + name + email + role | User search/select combobox + role select. Remove button per member. | `team_user_ids[]` |

**Team edit UX:**
- Search existing tenant users by name/email via combobox
- Select role (lead, tester, reviewer, observer)
- Lead auto-assigned as first member (already implemented)
- Remove member via X button

**Requires:** User search API — `GET /api/v1/tenants/{id}/members?search=` (already exists as tenant members endpoint)

#### Tab 4: Rules of Engagement (5 editable sections)

| Section | View Mode | Edit Mode | API Field (JSONB) |
|---------|-----------|-----------|-----------|
| Testing Hours | Badge | Text input | `rules_of_engagement.testingHours` |
| Allowed Methods | Badge list | Tag-style input (add/remove) | `rules_of_engagement.allowedMethods[]` |
| Restricted Methods | Badge list | Tag-style input (add/remove) | `rules_of_engagement.restrictedMethods[]` |
| Emergency Contact | Text | Text input | `rules_of_engagement.emergencyContact` |
| Communication Channel | Text | Text input | `rules_of_engagement.communicationChannel` |

**Save strategy:** Build full `rules_of_engagement` JSONB object and send in campaign update.

---

## Implementation Plan

### Phase 1: Infrastructure (shared components)

| # | Task | Estimate |
|---|------|----------|
| 1.1 | `EditableCard` wrapper component — handles view/edit toggle, save/cancel buttons, loading state | S |
| 1.2 | `TagInput` component — type text + Enter to add, X to remove, badge display | S |
| 1.3 | `DynamicListInput` component — add/remove text inputs (for objectives, scope items) | S |
| 1.4 | Campaign update hook — `useUpdateCampaignField(id)` that PATCHes and revalidates SWR | S |

### Phase 2: Overview Tab Inline Edit

| # | Task | Estimate |
|---|------|----------|
| 2.1 | Description — EditableCard + Textarea | S |
| 2.2 | Timeline — EditableCard + 2x date inputs | S |
| 2.3 | Methodology — EditableCard + CreatableSelect | S |
| 2.4 | Tags — EditableCard + TagInput | S |
| 2.5 | Objectives — EditableCard + DynamicListInput | S |

### Phase 3: Scope Tab Inline Edit

| # | Task | Estimate |
|---|------|----------|
| 3.1 | Scope items — add/remove/edit scope entries with type/value/notes/inScope fields | M |
| 3.2 | Empty state → add first scope item inline | S |

### Phase 4: Team Tab Inline Edit

| # | Task | Estimate |
|---|------|----------|
| 4.1 | User search combobox (search tenant members API) | M |
| 4.2 | Role select per member | S |
| 4.3 | Add/remove team members | S |

### Phase 5: Rules of Engagement Tab Inline Edit

| # | Task | Estimate |
|---|------|----------|
| 5.1 | Testing Hours + Emergency Contact + Communication Channel — simple text EditableCards | S |
| 5.2 | Allowed/Restricted Methods — TagInput-style | S |
| 5.3 | Empty state → create RoE inline | S |

### Phase 6: Remove Edit Dialog

| # | Task | Estimate |
|---|------|----------|
| 6.1 | Remove Edit Campaign dialog from campaigns page | S |
| 6.2 | Remove "Edit" button from table dropdown (keep "View Details" which opens sheet) | S |
| 6.3 | Update footer buttons: remove "Edit", keep status + export + findings | S |

---

## Shared Components Spec

### `EditableCard`

```tsx
interface EditableCardProps {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode          // view mode content
  editContent: React.ReactNode       // edit mode content
  onSave: () => Promise<void>
  badge?: React.ReactNode            // optional badge next to title
  emptyText?: string                 // shown when no content
}
```

Behavior:
- Default: view mode, "Edit" pencil icon on hover (top-right of card header)
- Click Edit → switches to edit mode, shows Save/Cancel buttons in card footer
- Save → calls onSave, shows loading spinner, returns to view mode
- Cancel → discards changes, returns to view mode
- Only 1 card editable at a time (optional, prevents confusion)

### `TagInput`

```tsx
interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}
```

Behavior:
- Text input + Enter → add tag
- Comma also adds tag
- X button on each tag to remove
- Renders as flex-wrap badges

### `DynamicListInput`

```tsx
interface DynamicListInputProps {
  items: string[]
  onChange: (items: string[]) => void
  placeholder?: string
  numbered?: boolean
}
```

Behavior:
- Renders inputs for each item, numbered if `numbered=true`
- "Add" button at bottom
- X button on each to remove
- Empty item auto-focused

---

## API Changes Required

**None.** Existing `PUT /api/v1/pentest/campaigns/{id}` accepts all fields. Each inline save sends the full campaign payload with the updated section.

The only exception: **Team Members** — currently `team_user_ids` is just an array of UUIDs. The user search needs the existing members API: `GET /api/v1/tenants/{id}/members?search=`.

---

## Migration Path

1. Implement inline editing alongside existing Edit dialog
2. Test all sections work correctly
3. Remove Edit dialog
4. Remove Edit button from footer (replace with just status actions)

---

## Dependencies

| Dependency | Status |
|-----------|--------|
| Campaign CRUD API | Done |
| Team members enrichment (name/email) | Done |
| CreatableSelect component | Done |
| Tenant members search API | Exists |
| Campaign detail sheet | Done |

---

## Estimates

| Phase | Tasks | Estimate |
|-------|-------|----------|
| Phase 1: Infrastructure | 4 | 2h |
| Phase 2: Overview | 5 | 2h |
| Phase 3: Scope | 2 | 1.5h |
| Phase 4: Team | 3 | 2h |
| Phase 5: Rules | 3 | 1h |
| Phase 6: Cleanup | 3 | 0.5h |
| **Total** | **20** | **~9h** |
