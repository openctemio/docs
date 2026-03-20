# RFC: Dynamic Template Categories

**Created:** 2026-03-18
**Status:** PLANNED (not started)
**Priority:** P2 (Enhancement)
**Scope:** Allow tenants to customize pentest template categories via settings

---

## Problem

Template categories are hardcoded as a TypeScript union type:

```typescript
type TemplateCategory = 'injection' | 'authentication' | 'authorization' | 'cryptographic' |
  'configuration' | 'disclosure' | 'session' | 'input_validation' | 'logic' | 'other'
```

Tenants cannot add custom categories. A healthcare pentest team needs HIPAA-specific categories, a cloud team needs AWS/Azure categories, an IoT team needs firmware/protocol categories — all stuck with the same 10.

## Existing Pattern

Campaign types and methodologies are already dynamic via the same mechanism:

```
Frontend: usePentestConfig() hook
    ↓
API: GET /api/v1/tenants/{id}/settings/pentest
    ↓
DB: tenant_settings.pentest_settings (JSONB)
    ↓
Returns: { campaign_types: [...], methodologies: [...] }
```

Template categories should follow this exact pattern — no new architecture needed.

---

## Implementation Plan

### Phase 1: Backend — Add template_categories to pentest settings

**Files:**
- `api/pkg/domain/tenant/settings.go` — Add `TemplateCategories` to `PentestSettings` struct
- `api/internal/app/tenant_service.go` — Handle in GET/PATCH settings

**Changes:**

```go
// tenant/settings.go
type PentestSettings struct {
    CampaignTypes      []ConfigOption `json:"campaign_types"`
    Methodologies      []ConfigOption `json:"methodologies"`
    TemplateCategories []ConfigOption `json:"template_categories"`  // NEW
}
```

No migration needed — JSONB field auto-accepts new keys. Existing tenants get `null` for `template_categories`, frontend falls back to defaults.

| Step | Action | Risk |
|------|--------|------|
| 1.1 | Add `TemplateCategories` to `PentestSettings` struct | Low |
| 1.2 | Ensure PATCH handler preserves existing categories when not provided | Low |
| 1.3 | Verify: GET returns categories, PATCH updates them | Low |

### Phase 2: Frontend — Extend usePentestConfig hook

**File:** `ui/src/features/pentest/hooks/use-pentest-config.ts`

**Changes:**

```typescript
// Add to PentestConfig interface
export interface PentestConfig {
  campaignTypes: ConfigOption[]
  methodologies: ConfigOption[]
  templateCategories: ConfigOption[]    // NEW
  isLoading: boolean
  addType: (option: ConfigOption) => Promise<void>
  addMethodology: (option: ConfigOption) => Promise<void>
  addCategory: (option: ConfigOption) => Promise<void>  // NEW
}

// Add defaults
const DEFAULT_TEMPLATE_CATEGORIES: ConfigOption[] = [
  { value: 'injection', label: 'Injection' },
  { value: 'authentication', label: 'Authentication' },
  { value: 'authorization', label: 'Authorization' },
  { value: 'cryptographic', label: 'Cryptographic' },
  { value: 'configuration', label: 'Configuration' },
  { value: 'disclosure', label: 'Information Disclosure' },
  { value: 'session', label: 'Session Management' },
  { value: 'input_validation', label: 'Input Validation' },
  { value: 'logic', label: 'Business Logic' },
  { value: 'other', label: 'Other' },
]

// Add to hook return
const templateCategories = settings?.pentest_settings?.template_categories?.length
  ? settings.pentest_settings.template_categories
  : DEFAULT_TEMPLATE_CATEGORIES

const addCategory = async (option: ConfigOption) => {
  const updated = [...templateCategories, option]
  if (tenantId) {
    await patch(`/api/v1/tenants/${tenantId}/settings/pentest`, {
      campaign_types: campaignTypes,
      methodologies,
      template_categories: updated,
    })
    await mutate()
  }
}
```

| Step | Action | Risk |
|------|--------|------|
| 2.1 | Add `DEFAULT_TEMPLATE_CATEGORIES` constant | Low |
| 2.2 | Add `templateCategories` and `addCategory` to hook | Low |
| 2.3 | Parse from settings response with fallback | Low |

### Phase 3: Frontend — Template pages use CreatableSelect

**Files:**
- `ui/src/app/(dashboard)/(validation)/pentest/templates/new/page.tsx`
- `ui/src/app/(dashboard)/(validation)/pentest/templates/[id]/edit/page.tsx`

**Changes:**

Replace hardcoded `<Select>` with `<CreatableSelect>`:

```tsx
// BEFORE
<Select
  value={formData.category}
  onValueChange={(v) => updateField('category', v as TemplateCategory)}
>
  <SelectContent>
    {(Object.keys(TEMPLATE_CATEGORY_LABELS) as TemplateCategory[]).map(...)}
  </SelectContent>
</Select>

// AFTER
const { templateCategories, addCategory } = usePentestConfig()

<CreatableSelect
  options={templateCategories}
  value={formData.category}
  onChange={(v) => updateField('category', v)}
  onCreateOption={addCategory}
  placeholder="Select category..."
  searchPlaceholder="Search or create category..."
/>
```

Also update `TemplateCategory` type from union to `string` (since categories are now dynamic):

```typescript
// BEFORE
export type TemplateCategory = 'injection' | 'authentication' | ... | 'other'

// AFTER
export type TemplateCategory = string
```

Keep `TEMPLATE_CATEGORY_LABELS` as a Record for display — but use it as fallback for default categories only. Dynamic categories use `option.label` from the config.

| Step | Action | Risk |
|------|--------|------|
| 3.1 | Change `TemplateCategory` type from union to `string` | Low — may break exhaustive checks |
| 3.2 | Replace `<Select>` with `<CreatableSelect>` in new page | Low |
| 3.3 | Same for edit page | Low |
| 3.4 | Update `categoryIcons` to handle unknown categories with fallback icon | Low |
| 3.5 | Update templates list page category filter to use dynamic categories | Low |

### Phase 4: Settings UI — Category management

**File:** `ui/src/app/(dashboard)/settings/pentest/page.tsx`

This page already manages campaign types and methodologies. Add a third section for template categories — same `CreatableSelect` pattern.

| Step | Action | Risk |
|------|--------|------|
| 4.1 | Add "Template Categories" section to settings page | Low |
| 4.2 | Same add/remove UX as campaign types | Low |

---

## Type Change Impact

Changing `TemplateCategory` from union to `string` affects:

| File | Usage | Action |
|------|-------|--------|
| `pentest.types.ts` | Type definition | Change to `string` |
| `pentest.types.ts` | `TEMPLATE_CATEGORY_LABELS` | Keep as Record, use for defaults |
| `templates/new/page.tsx` | `categoryIcons` | Add fallback: `icons[cat] \|\| <FileQuestion />` |
| `templates/[id]/edit/page.tsx` | Same | Same fallback |
| `template-manager.tsx` | Category display | Use `option.label` from config, fallback to `TEMPLATE_CATEGORY_LABELS` |
| `pentest_service.go` | `ParseTemplateCategory` | Already accepts any string (just validates non-empty) |

---

## Summary

| Phase | Effort | Files |
|-------|--------|-------|
| 1. Backend settings | 30 min | 2 Go files |
| 2. Hook extension | 30 min | 1 TS file |
| 3. Template pages | 1 hour | 3 TS files |
| 4. Settings UI | 30 min | 1 TS file |
| **Total** | **~2.5 hours** | **7 files** |

Zero new endpoints, zero migrations, zero new tables. Just extends existing pattern.
