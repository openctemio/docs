---
layout: default
title: "RFC-003: Custom Capabilities Management UI"
parent: Decisions
nav_order: 3
---

# RFC-003: Custom Capabilities Management UI

**Status:** Implemented
**Date:** 2025-01-30 (Implemented: 2026-01-30)
**Authors:** Engineering Team

---

## Summary

Add a UI page for tenants to manage custom tool capabilities. Backend API already exists but has no corresponding UI.

---

## Background

### Current State

| Component | Status |
|-----------|--------|
| Database schema | ✅ `capabilities` table with `tenant_id` support |
| Backend API | ✅ `/api/v1/custom-capabilities` (CRUD) |
| Security controls | ✅ 50 limit/tenant, validation, XSS prevention |
| Frontend hooks | ✅ `useCreateCapability`, `useUpdateCapability`, `useDeleteCapability` |
| **Management UI** | ❌ **Missing** |

### Problem Statement

1. **No validation when creating tools**: Users can enter any capability name without checking if it exists
2. **No visibility**: Users cannot see what custom capabilities they've created
3. **No management**: Cannot edit/delete custom capabilities without using API directly
4. **Orphaned capabilities**: Capabilities created via tools have no management interface

### Current Pain Points

```
User creates tool with capability "my-custom-scan"
     ↓
System accepts it (no validation)
     ↓
User has no way to:
  - See all their custom capabilities
  - Edit the display name/icon/color
  - Delete unused capabilities
  - Know if it already exists
```

---

## Proposal

### Add Settings Page: Tool Capabilities

**Location:** `Settings > Scanning > Capabilities` (URL: `/capabilities`)

**Rationale for location:**
- Same navigation group as Tools (`/tools`), Agents (`/agents`), Scan Profiles (`/scan-profiles`)
- Capabilities describe tool abilities → logical to be near Tools
- Uses existing `(scoping)` route group pattern
- User expectation: scanning-related config in one place

**Features:**

1. **List View**
   - Show all capabilities (platform + custom)
   - Group by category (security, recon, analysis)
   - Visual distinction: platform (locked) vs custom (editable)
   - Search/filter

2. **Create Custom Capability**
   - Name (slug): lowercase, alphanumeric with hyphens
   - Display name: Human readable
   - Description: Optional
   - Icon: Lucide icon picker
   - Color: Color picker (from predefined palette)
   - Category: Dropdown (security, recon, analysis, custom)

3. **Edit Custom Capability**
   - Can only edit tenant's own custom capabilities
   - Cannot modify platform capabilities
   - Cannot change name (slug) after creation

4. **Delete Custom Capability**
   - Soft validation: warn if capability is in use by tools
   - Hard validation: prevent deletion if assigned to tools

---

## UI Design

### Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Settings > Scanning > Tool Capabilities                         │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [Search capabilities...]           [+ Add Capability]       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─ Security ─────────────────────────────────────────────────┐  │
│ │ 🔒 sast      Static Analysis         [code]    purple      │  │
│ │ 🔒 sca       Composition Analysis    [package] blue        │  │
│ │ 🔒 dast      Dynamic Testing         [zap]     orange      │  │
│ │ ✏️ custom-ml ML Security Scanner     [brain]   pink    [...] │ │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ ┌─ Recon ────────────────────────────────────────────────────┐  │
│ │ 🔒 recon     Reconnaissance          [search]  yellow      │  │
│ │ 🔒 subdomain Subdomain Enumeration   [layers]  lime        │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ Legend: 🔒 Platform (read-only)  ✏️ Custom (editable)           │
└─────────────────────────────────────────────────────────────────┘
```

### Create/Edit Dialog

```
┌─────────────────────────────────────────────────────────────────┐
│ Create Custom Capability                              [X]       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Name (slug) *                                                    │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ custom-ml-scanner                                           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ Lowercase letters, numbers, and hyphens only                     │
│                                                                  │
│ Display Name *                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ML Security Scanner                                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Description                                                      │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Machine learning model security analysis                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Category                           Icon          Color          │
│ ┌───────────────────┐  ┌─────────────┐  ┌─────────────────┐    │
│ │ security       ▼  │  │ 🧠 brain   │  │ ● pink          │    │
│ └───────────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                                  │
│ Preview:  [🧠 ML Security Scanner]                              │
│                                                                  │
│                                    [Cancel]  [Create Capability] │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Basic UI (MVP)

**Files to create:**

```
ui/src/app/(dashboard)/(scoping)/capabilities/
├── page.tsx                    # Main page
└── layout.tsx                  # Optional module gate

ui/src/features/capabilities/
├── components/
│   ├── capabilities-section.tsx    # Main section component
│   ├── capability-list.tsx         # List with grouping
│   ├── capability-card.tsx         # Single capability card
│   ├── create-capability-dialog.tsx
│   └── edit-capability-dialog.tsx
└── index.ts
```

**Sidebar update** (`ui/src/config/sidebar-data.ts`):
```typescript
// In Settings > Scanning group, after Tools:
{
  title: 'Capabilities',
  url: '/capabilities',
  icon: Zap,
  permission: Permission.CapabilitiesRead,
}
```

**Tasks:**

1. Create page route at `/settings/scanning/capabilities`
2. Add navigation link in settings sidebar
3. Implement list view with platform/custom distinction
4. Implement create dialog with validation
5. Implement edit dialog (custom only)
6. Implement delete with confirmation

### Phase 2: Enhanced UX

1. Icon picker component (Lucide icons)
2. Color picker component (predefined palette)
3. Live preview in create/edit dialog
4. Search and filter
5. "In use" badge showing tool count

### Phase 3: Integration

1. Validate capabilities in Add Tool dialog
2. Autocomplete suggestions from registry
3. Link from tool capabilities to management page
4. Audit log for capability changes

---

## API Reference

Existing endpoints to use:

```typescript
// Read
GET  /api/v1/capabilities           // List all (platform + tenant custom)
GET  /api/v1/capabilities/all       // Unpaginated for dropdowns
GET  /api/v1/capabilities/:id       // Single capability
GET  /api/v1/capabilities/categories

// Write (custom only)
POST   /api/v1/custom-capabilities      // Create
PUT    /api/v1/custom-capabilities/:id  // Update
DELETE /api/v1/custom-capabilities/:id  // Delete
```

---

## Security Considerations

Already implemented in backend:

| Control | Implementation |
|---------|----------------|
| Rate limiting | Max 50 custom capabilities per tenant |
| Name validation | ASCII only, lowercase alphanumeric + hyphens |
| Reserved names | Cannot use: admin, system, platform, root, all, any, none, null |
| XSS prevention | Display names HTML-escaped |
| Tenant isolation | Can only CRUD own capabilities |
| Audit logging | All CRUD operations logged |

---

## Alternatives Considered

### 1. Inline creation in Add Tool dialog
- **Rejected:** Too complex, mixes concerns
- Better to manage capabilities separately

### 2. Auto-create capabilities when tools use unknown names
- **Rejected:** Creates orphaned/duplicate capabilities
- Explicit creation is cleaner

### 3. No UI, API only
- **Rejected:** Poor UX, current pain point
- Users need visibility into what exists

---

## Success Metrics

1. **Reduced API errors**: Fewer "invalid capability" errors when creating tools
2. **User adoption**: >50% of tenants with custom tools use capability management
3. **Support tickets**: Reduce "how do I add custom capability" questions

---

## Timeline

| Phase | Scope | Estimate |
|-------|-------|----------|
| Phase 1 | Basic CRUD UI | 2-3 days |
| Phase 2 | Enhanced UX | 1-2 days |
| Phase 3 | Integration | 1-2 days |

---

## Implementation Notes (2026-01-30)

### Implemented Components

| Component | Status | File |
|-----------|--------|------|
| Page route | ✅ | `ui/src/app/(dashboard)/(scoping)/capabilities/page.tsx` |
| Main section | ✅ | `ui/src/features/capabilities/components/capabilities-section.tsx` |
| Card view | ✅ | `ui/src/features/capabilities/components/capability-card.tsx` |
| Table view | ✅ | `ui/src/features/capabilities/components/capability-table.tsx` |
| Create dialog | ✅ | `ui/src/features/capabilities/components/create-capability-dialog.tsx` |
| Edit dialog | ✅ | `ui/src/features/capabilities/components/edit-capability-dialog.tsx` |
| Sidebar nav | ✅ | `ui/src/config/sidebar-data.ts` |
| Route permissions | ✅ | `ui/src/config/route-permissions.ts` |

### Features Implemented

1. **Platform/Custom tabs** - Clear separation between read-only platform capabilities and editable custom capabilities
2. **Grid/Table toggle** - Two view modes for different preferences
3. **Category filtering** - Filter by security, recon, analysis categories
4. **Search** - Filter by name, display name, or description
5. **Stats cards** - Overview of total, platform, custom counts
6. **CRUD operations** - Create, edit, delete custom capabilities
7. **Delete confirmation** - Warning dialog before deletion

### Technical Decisions

1. **Icon loading**: Dynamic icon loading from lucide-react using PascalCase conversion
2. **Color mapping**: Predefined color palette with Tailwind classes
3. **Form validation**: Zod schema with auto-generated code name from display name
4. **Permission control**: Uses `Permission.ToolsWrite` for create/edit/delete operations

### UX Improvements Over Original Design

- Added responsive grid layout (1/2/3 columns based on screen size)
- Added empty state with call-to-action
- Added loading skeletons for better perceived performance
- Tooltip on disabled "Add Capability" button explains why it's disabled

---

## Related

- [ADR-001: Finding Sources vs Tool Capabilities](001-finding-sources-vs-capabilities.md)
- [RFC-002: Rename Capabilities to Tool Capabilities](002-tool-capabilities-rename-proposal.md)
- [Capabilities Registry Feature](../features/capabilities-registry.md)
