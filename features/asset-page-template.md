---
layout: default
title: Asset Page Template System
parent: Features
nav_order: 23
---

# Asset Page Template System

> **Status**: Implemented
> **Released**: 2026-03-09
> **Author**: Engineering Team

## Overview

A config-driven template system that consolidates 14+ individual asset pages (each 800-1,400 LOC) into a single reusable `AssetPage` component driven by declarative `AssetPageConfig` objects. Reduces total asset page code by 65% while fixing 5 security vulnerabilities and eliminating N+1 query performance issues.

## Problem Statement

The asset management module had 15 individual asset pages totaling ~22,900 LOC with significant problems:

- **Code duplication**: 8 pages followed identical patterns with 85%+ shared code
- **Security vulnerabilities**: CSV formula injection, no bulk delete limits, blob URL memory leaks
- **Performance**: N+1 queries on repository listing (42 queries for 20 repos)
- **Inconsistency**: 3 pages used mock data with different HTML table layouts, missing tags display, varying empty/error states
- **Maintenance burden**: Bug fixes required updating 15+ files

## Architecture

### Three-Layer Design

```
Layer 3: AssetPage Template (796 LOC)
  ├── Renders complete page from AssetPageConfig
  ├── Stats cards, filters, data table, pagination
  ├── Detail sheet, form dialogs, delete confirmation
  └── Bulk actions, export, scope coverage

Layer 2: Shared UI Components
  ├── AssetFormDialogShared (244 LOC) — dynamic form from FormFieldConfig[]
  └── AssetDeleteDialogShared (54 LOC) — delete confirmation

Layer 1: Shared Hooks
  ├── useAssetCRUD — create/update/delete/bulkDelete with error handling
  ├── useAssetScope — scope target/exclusion matching
  ├── useAssetDialogs — dialog open/close state management
  ├── useAssetExport — CSV export with formula injection prevention
  └── useDebounce — debounced search input (300ms)
```

### Config-Driven Pattern

Each asset page provides only a config object. All shared behavior is derived from it:

```tsx
// Example: services/config.tsx (219 LOC instead of 1,257)
export const servicesConfig: AssetPageConfig = {
  type: 'service',
  label: 'Service',
  labelPlural: 'Services',
  description: 'Manage network services and endpoints',
  icon: Server,
  iconColor: 'text-blue-500',
  gradientFrom: 'from-blue-500/20',
  gradientVia: 'via-blue-500/10',
  columns: [/* type-specific columns */],
  formFields: [/* form field configs */],
  exportFields: [/* CSV export fields */],
  statsCards: [/* stats card definitions */],
  detailSections: [/* detail sheet sections */],
  detailStats: [/* detail sheet stat cards */],
  copyAction: { label: 'Copy Address', getValue: (a) => /* ... */ },
  defaultSort: { field: 'name', direction: 'asc' },
}

// services/page.tsx (8 LOC)
import { AssetPage } from '../components/asset-page'
import { servicesConfig } from './config'
export default function ServicesPage() {
  return <AssetPage config={servicesConfig} />
}
```

### AssetPageConfig Type

```typescript
interface AssetPageConfig {
  type: string                          // Asset type identifier
  types?: string[]                      // Multi-type fetch (e.g., cloud = compute+storage+serverless)
  label: string                         // Singular display name
  labelPlural: string                   // Plural display name
  description: string                   // Page header description
  icon: React.ComponentType             // Icon component
  iconColor: string                     // Icon color class
  gradientFrom: string                  // Header gradient start
  gradientVia: string                   // Header gradient middle
  columns: ColumnDef<Asset>[]           // Type-specific table columns
  formFields: FormFieldConfig[]         // Create/edit form fields
  exportFields: ExportFieldConfig[]     // CSV export configuration
  statsCards?: StatsCardConfig[]        // Header stats cards
  detailSections?: DetailSectionConfig[] // Detail sheet sections
  detailStats?: DetailStatConfig[]      // Detail sheet stats
  customFilter?: CustomFilterConfig     // Additional filter dropdown
  copyAction?: { label; getValue }      // Row action: copy to clipboard
  defaultSort?: { field; direction }    // Default sort
  includeGroupSelect?: boolean          // Group select in forms
  dataTransform?: (assets) => Asset[]   // Pre-render transformation
}
```

## Migration Strategy

Three strategies based on page complexity:

### Strategy 1: Full Template Migration (14 pages)

Standard pages with identical structure migrated to config + `AssetPage`:

| Page | Before | After | Reduction |
|------|--------|-------|-----------|
| services | 1,257 | 227 | 82% |
| compute | 836 | 302 | 64% |
| serverless | 1,068 | 313 | 71% |
| cloud | 1,301 | 280 | 78% |
| mobile | 1,331 | 380 | 71% |
| databases | 1,419 | 329 | 77% |
| hosts | 1,445 | 289 | 80% |
| certificates | 1,307 | 310 | 76% |
| ip-addresses | 1,194 | 225 | 81% |
| websites | 1,372 | 280 | 80% |
| cloud-accounts | 260 | 287 | Real API (was mock) |
| networks | 331 | 237 | Real API (was mock) |
| storage | 309 | 372 | Real API (was mock) |
| domains | 1,346 | 239 | 82% (with dataTransform) |

### Strategy 2: Shared Hooks Only (3 complex pages)

Pages with fundamentally different architectures that cannot use the template:

- **repositories** — Custom `useRepositories` hook, SCM integration, router navigation
- **containers** — Multi-tab architecture (clusters/workloads/images), 3 entity types
- **apis** — Custom `ApiDetailSheet` with nested endpoints tab

Applied `useAssetExport` (CSV sanitization) and `useDebounce` (search) where compatible.

## Key Features

### Auto-Generated Tags Column

All template-driven pages automatically display asset tags between Classification and Findings columns:

- Shows first 2 tags as `Badge` components
- `+N` overflow badge for additional tags
- Dash placeholder for assets without tags

### Multi-Type Fetching

The `types?: string[]` config option allows a single page to fetch multiple asset types:

```tsx
// Cloud page fetches compute + storage + serverless
export const cloudConfig: AssetPageConfig = {
  type: 'cloud',
  types: ['compute', 'storage', 'serverless'],
  // ...
}
```

### Data Transform

The `dataTransform` option enables pre-render data transformation:

```tsx
// Domains page flattens tree hierarchy for table display
export const domainsConfig: AssetPageConfig = {
  type: 'domain',
  dataTransform: flattenDomainTreeForTable,
  // ...
}
```

### CSV Export Security

All exports use `sanitizeCsvCell()` to prevent formula injection:

- Prefixes dangerous characters (`=`, `+`, `-`, `@`, `\t`, `\r`) with `'`
- Adds UTF-8 BOM for Excel compatibility
- Revokes blob URLs after download to prevent memory leaks

## Security Fixes

| Issue | Severity | Fix |
|-------|----------|-----|
| CSV formula injection | HIGH | `sanitizeCsvCell()` prefixes dangerous chars |
| No bulk delete limit | MEDIUM | Max 100 items per bulk delete |
| Blob URL memory leak | LOW | `URL.revokeObjectURL()` after download |
| Client-side only validation | MEDIUM | Server-side validation + client feedback |
| Clipboard API fallback | LOW | Error handling for non-HTTPS contexts |

## Backend Optimization

### N+1 Query Fix

Repository listing previously executed `2 + (2 * N)` queries (42 for 20 repos).

**Fix**: Added `GetByAssetIDs(ctx, assetIDs []shared.ID)` batch method using `WHERE ar.asset_id = ANY($1)`.

**Result**: 42 queries reduced to 4 queries per page load.

## File Structure

```
ui/src/features/assets/
├── types/
│   └── page-config.types.ts          # AssetPageConfig + sub-types (142 LOC)
├── hooks/
│   ├── use-asset-crud.ts             # CRUD operations
│   ├── use-asset-scope.ts            # Scope matching
│   ├── use-asset-dialogs.ts          # Dialog state
│   └── use-asset-export.ts           # CSV export + sanitization
├── components/
│   ├── asset-page.tsx                # Main template (796 LOC)
│   ├── asset-form-dialog-shared.tsx  # Dynamic form (244 LOC)
│   └── asset-delete-dialog-shared.tsx # Delete dialog (54 LOC)
└── [type]/
    ├── config.tsx                     # Type-specific config (~200-370 LOC)
    └── page.tsx                       # 8 LOC wrapper
```

## Test Coverage

### UI Tests (52 tests)

| File | Tests | Coverage |
|------|-------|---------|
| `use-asset-export.test.ts` | 20 | CSV sanitization, formula injection, BOM, URL cleanup |
| `use-asset-crud.test.ts` | 14 | CRUD operations, bulk delete limit |
| `use-asset-dialogs.test.ts` | 9 | Dialog state management |
| `use-debounce.test.ts` | 8 | Debounce timing, cleanup on unmount |

### API Tests (263+ tests)

| File | Tests | Coverage |
|------|-------|---------|
| `asset_service_test.go` | 133 | Full CRUD, batch fetch, cross-tenant isolation |
| `vulnerability_service_test.go` | 130+ | Bulk ops, comments, severity, classification |

## Adding a New Asset Page

1. Create `features/assets/[type]/config.tsx` with `AssetPageConfig`
2. Create `features/assets/[type]/page.tsx` (8 lines):
   ```tsx
   import { AssetPage } from '../components/asset-page'
   import { myTypeConfig } from './config'
   export default function MyTypePage() {
     return <AssetPage config={myTypeConfig} />
   }
   ```
3. Add route in app router
4. Add sidebar entry in `config/sidebar-data.ts`

No other code changes needed — the template handles all shared behavior automatically.

## Impact Summary

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Total asset page LOC | ~22,900 | ~8,124 | **-65%** |
| Standard pages LOC | ~12,530 | ~2,935 | **-77%** |
| Shared infrastructure | 0 | ~1,497 | New reusable code |
| Security vulnerabilities | 5 | 0 | All fixed |
| N+1 queries | 42/page | 4/page | **-90%** |
| Mock data pages | 3 | 0 | All use real API |
| UI tests | 0 | 52 | New coverage |
| API tests | 0 | 263+ | New coverage |
