---
layout: default
title: Integration Sub-Modules
parent: Features
nav_order: 11
---

# Integration Sub-Modules

> **Status**: Implemented
> **Released**: 2026-01-29
> **Author**: Claude Code

## Overview

Extends the hierarchical module system (originally created for assets) to the integrations module. This allows SCM connections, notifications, webhooks, and other integration features to be managed as sub-modules with independent licensing and release control.

## Background

The sub-module pattern was first implemented for asset types (see [Asset Sub-Modules](./asset-sub-modules.md)). This document covers applying the same pattern to integrations.

## Problem Statement

1. SCM connections was checking for a non-existent `'scm'` module instead of being part of integrations
2. Inconsistency: Notifications had a module (`ModuleNotifications`), but SCM did not
3. Need flexibility to license integration features separately (e.g., plan has integrations but not SCM)
4. No "coming soon" indicators for future integration types (SIEM, ticketing, etc.)

## Solution: Integration Sub-Modules

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  TENANT LEVEL (tenant_modules)                    │
│                                                                  │
│  Tenant A → NO integrations module                               │
│  Tenant B → integrations + integrations.scm (3 max)             │
│  Tenant C → integrations + all sub-modules                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ Inheritance + tenant_modules
┌─────────────────────────────────────────────────────────────────┐
│                 MODULE LEVEL (modules table)                     │
│                                                                  │
│  Parent: integrations (category: platform)                      │
│    │                                                            │
│    ├── integrations.scm           │ released     │ SCM          │
│    ├── integrations.notifications │ released     │ Notifications│
│    ├── integrations.webhooks      │ released     │ Webhooks     │
│    ├── integrations.api           │ released     │ API Keys     │
│    ├── integrations.pipelines     │ coming_soon  │ CI/CD        │
│    ├── integrations.ticketing     │ coming_soon  │ Jira, etc.   │
│    └── integrations.siem          │ coming_soon  │ SIEM/SOAR    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Sub-Modules Defined

| Module ID | Slug | Name | Status | Description |
|-----------|------|------|--------|-------------|
| `integrations.scm` | `integrations-scm` | SCM Connections | Released | GitHub, GitLab, Bitbucket, Azure DevOps |
| `integrations.notifications` | `integrations-notifications` | Notifications | Released | Slack, Teams, Email, Telegram |
| `integrations.webhooks` | `integrations-webhooks` | Webhooks | Released | Outgoing webhook configurations |
| `integrations.api` | `integrations-api` | API Keys | Released | API key management |
| `integrations.pipelines` | `integrations-pipelines` | CI/CD Pipelines | Coming Soon | GitHub Actions, GitLab CI, Jenkins |
| `integrations.ticketing` | `integrations-ticketing` | Ticketing | Coming Soon | Jira, ServiceNow, Linear |
| `integrations.siem` | `integrations-siem` | SIEM/SOAR | Coming Soon | Security event integrations |

> **Note**: The naming convention is:
> - **ID**: `{parent}.{child}` (e.g., `integrations.scm`)
> - **Slug**: `{parent}-{child}` (e.g., `integrations-scm`)

## Implementation

### Database Migration

**Files**:
- `api/migrations/000129_add_integrations_sub_modules.up.sql` - Initial sub-module setup
- `api/migrations/000130_standardize_integration_submodules.up.sql` - Standardize naming convention

```sql
-- Migration 000130: Standardize naming convention
-- Modules now follow pattern: integrations.{name} for ID, integrations-{name} for slug

-- Example of standardized sub-modules:
INSERT INTO modules (id, slug, name, ...)
VALUES
  ('integrations.scm', 'integrations-scm', 'SCM Connections', ...),
  ('integrations.notifications', 'integrations-notifications', 'Notifications', ...),
  ('integrations.webhooks', 'integrations-webhooks', 'Webhooks', ...),
  ('integrations.api', 'integrations-api', 'API Keys', ...),
  ('integrations.pipelines', 'integrations-pipelines', 'CI/CD Pipelines', ...),
  ('integrations.ticketing', 'integrations-ticketing', 'Ticketing', ...),
  ('integrations.siem', 'integrations-siem', 'SIEM/SOAR', ...)
ON CONFLICT (id) DO UPDATE SET ...;

-- Enable sub-modules for tenants
INSERT INTO tenant_modules (tenant_id, module_id, limits)
VALUES ($1, 'integrations.scm', '{"max_connections": 3}'::jsonb);
```

### Backend Constants

**File**: `api/internal/domain/module/module.go`

```go
// Integration sub-module IDs (children of ModuleIntegrations)
const (
    ModuleIntegrationsSCM           = "integrations.scm"
    ModuleIntegrationsNotifications = "integrations.notifications"
    ModuleIntegrationsWebhooks      = "integrations.webhooks"
    ModuleIntegrationsAPI           = "integrations.api"
    ModuleIntegrationsPipelines     = "integrations.pipelines"
    ModuleIntegrationsTicketing     = "integrations.ticketing"
    ModuleIntegrationsSIEM          = "integrations.siem"
)

// Module permission mapping
var ModulePermissionMapping = map[string]string{
    // ... existing mappings ...

    // Integration sub-modules
    ModuleIntegrationsSCM:           "integrations:scm:read",
    ModuleIntegrationsNotifications: "integrations:notifications:read",
    ModuleIntegrationsWebhooks:      "integrations:webhooks:read",
    ModuleIntegrationsAPI:           "integrations:api:read",
    ModuleIntegrationsPipelines:     "integrations:pipelines:read",
    ModuleIntegrationsTicketing:     "integrations:ticketing:read",
    ModuleIntegrationsSIEM:          "integrations:siem:read",
}
```

### Frontend Usage

**Using SubModuleGate component:**

```tsx
import { SubModuleGate } from '@/features/licensing'

// Gate entire page
<SubModuleGate parentModule="integrations" subModule="scm">
  <SCMConnectionsPage />
</SubModuleGate>
```

**Using useSubModuleAccess hook:**

```tsx
import { useSubModuleAccess } from '@/features/licensing'

function SCMConnectionsBanner() {
  const { hasSubModule, isComingSoon, isLoading } = useSubModuleAccess(
    'integrations',
    'scm'
  )

  if (isLoading) return <Skeleton />
  if (!hasSubModule) return null

  return <Banner />
}
```

### Files Modified

**Backend:**
- `api/migrations/000129_add_integrations_sub_modules.up.sql` (NEW)
- `api/migrations/000129_add_integrations_sub_modules.down.sql` (NEW)
- `api/migrations/000130_standardize_integration_submodules.up.sql` (NEW)
- `api/migrations/000130_standardize_integration_submodules.down.sql` (NEW)
- `api/internal/domain/licensing/module.go`

**Frontend:**
- `ui/src/features/licensing/components/index.ts`
- `ui/src/features/licensing/index.ts`
- `ui/src/app/(dashboard)/settings/integrations/scm/page.tsx`
- `ui/src/features/scm-connections/components/scm-connections-section.tsx`
- `ui/src/app/(dashboard)/(discovery)/assets/repositories/page.tsx`

## Access Control Flow

```
User requests /settings/integrations/scm
    │
    ▼
useSubModuleAccess('integrations', 'scm')
    │
    ▼
useTenantModules() → GET /api/v1/me/modules
    │
    ▼
Backend checks:
  1. Tenant has 'integrations' module enabled? (tenant_modules)
  2. Get sub-modules where parent_module_id = 'integrations'
  3. Filter by user's RBAC permissions
    │
    ▼
Response includes sub_modules: {
  "integrations": [
    { "id": "integrations.scm", "slug": "integrations-scm", "release_status": "released", ... },
    { "id": "integrations.notifications", "slug": "integrations-notifications", "release_status": "released", ... },
    ...
  ]
}
    │
    ▼
Frontend checks:
  1. Sub-module exists in response?
  2. is_active = true?
  3. release_status = 'released' OR 'beta'?
    │
    ▼
If all true → Show content
If false → Show UpgradePrompt or hide section
```

## Admin Operations

### Enable a sub-module for all tenants

```sql
UPDATE modules
SET release_status = 'released', is_active = true
WHERE id = 'integrations.pipelines';
```

### Check sub-module status

```sql
SELECT id, name, release_status, is_active
FROM modules
WHERE parent_module_id = 'integrations'
ORDER BY display_order;
```

### Enable sub-module for a tenant

```sql
INSERT INTO tenant_modules (tenant_id, module_id, limits)
VALUES ($1, 'integrations.pipelines', '{"max_pipelines": 5}'::jsonb)
ON CONFLICT (tenant_id, module_id) DO UPDATE SET limits = EXCLUDED.limits;
```

### Disable sub-module for a tenant

```sql
DELETE FROM tenant_modules
WHERE module_id = 'integrations.scm'
AND tenant_id = $1;
```

## Permissions

Integration sub-modules use hierarchical permissions:

| Permission | Description |
|------------|-------------|
| `integrations:scm:read` | View SCM connections |
| `integrations:scm:write` | Create/update SCM connections |
| `integrations:scm:delete` | Delete SCM connections |
| `integrations:notifications:read` | View notification channels |
| `integrations:notifications:write` | Create/update notification channels |
| `integrations:notifications:delete` | Delete notification channels |
| `integrations:webhooks:read` | View webhooks |
| `integrations:webhooks:write` | Create/update webhooks |
| `integrations:webhooks:delete` | Delete webhooks |

## Migration Path

### From old `useHasModule('scm')` to new pattern

**Before:**
```tsx
import { useHasModule } from '@/features/integrations/api/use-tenant-modules'

const { hasModule, isLoading } = useHasModule('scm')
```

**After:**
```tsx
import { useSubModuleAccess } from '@/features/licensing'

const { hasSubModule, isLoading } = useSubModuleAccess('integrations', 'scm')
```

## Caching Architecture

### ModuleCacheService

Tenant modules are cached in Redis for performance. This avoids repeated database queries on every request.

**Key format:** `tenant_modules:{tenant_id}`
**TTL:** 5 minutes
**Invalidation:** Explicit on plan change + TTL expiration

```go
type CachedTenantModules struct {
    ModuleIDs  []string                   `json:"module_ids"`
    Modules    []*CachedModule            `json:"modules"`
    SubModules map[string][]*CachedModule `json:"sub_modules,omitempty"`
    EventTypes map[string][]string        `json:"event_types,omitempty"`
    CachedAt   time.Time                  `json:"cached_at"`
}
```

### Cache Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Request    │────▶│   Cache     │────▶│  Response   │
│  Modules    │     │   Hit?      │     │  (fast)     │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           │ Cache Miss
                           ▼
                    ┌─────────────┐
                    │  Database   │
                    │  Query      │
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Store in   │
                    │  Cache      │
                    └─────────────┘
```

### Cache Invalidation

When a tenant's plan changes:

```go
// In ModuleService.UpdateTenantModules()
if s.moduleCacheInvalid != nil {
    if err := s.moduleCacheInvalid.Invalidate(ctx, tenantID); err != nil {
        // Log error but don't fail - cache will self-heal via TTL
        s.logger.Error("failed to invalidate module cache", "error", err)
    }
}
```

**Invalidation includes retry logic:**
- 3 attempts with exponential backoff (50ms, 100ms)
- On failure, logs error but operation continues
- Cache self-heals via 5-minute TTL

### Database Indexes

Migration `000131_add_module_indexes.up.sql` adds performance indexes:

```sql
-- Sub-module lookups
CREATE INDEX idx_modules_parent_module_id ON modules(parent_module_id)
    WHERE parent_module_id IS NOT NULL;

-- Composite for active sub-modules with ordering
CREATE INDEX idx_modules_parent_active_order
    ON modules(parent_module_id, is_active, display_order)
    WHERE parent_module_id IS NOT NULL;

-- Event types batch lookup
CREATE INDEX idx_module_event_types_module_id ON module_event_types(module_id);

-- Tenant modules lookup
CREATE INDEX idx_tenant_modules_tenant_module ON tenant_modules(tenant_id, module_id);
```

## Security Considerations

### SQL Injection Prevention

Dynamic query conditions use whitelist validation:

```go
func (r *LicensingRepository) getPlanByCondition(ctx context.Context, condition string, arg any) (*licensing.Plan, error) {
    allowedConditions := map[string]bool{
        "id = $1":   true,
        "slug = $1": true,
    }
    if !allowedConditions[condition] {
        return nil, fmt.Errorf("security: disallowed query condition: %s", condition)
    }
    // ... execute query
}
```

### N+1 Query Prevention

Event types are fetched in batch instead of per-module:

```go
// Single query for all modules
eventTypesMap, err := s.repo.GetEventTypesForModulesBatch(ctx, moduleIDs)
```

## Future Enhancements

1. **Admin UI for sub-module management** - Toggle release status without SQL
2. **Per-tenant sub-module overrides** - Allow specific tenants to have sub-modules outside their plan
3. **Usage tracking** - Track usage against limits (connections, channels, etc.)
4. **Audit logging** - Log sub-module access and configuration changes

## Related Documentation

- [Asset Sub-Modules](./asset-sub-modules.md) - Original sub-module implementation
- [Roles & Permissions](../guides/roles-and-permissions.md) - RBAC system

---

**Last Updated**: 2026-01-29
