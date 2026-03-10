---
layout: default
title: Tenant Module Management
parent: Features
nav_order: 25
---

# Tenant Module Management

> **Status**: Implemented
> **Version**: v1.0
> **Released**: 2026-03-10

## Overview

Tenant admins can enable/disable optional modules for their organization. This controls sidebar visibility and feature access, keeping the UI clean and focused on modules the tenant actually uses.

Core modules required for platform operation are always enabled and cannot be disabled.

## 3-Layer Visibility Model

Module visibility is determined by three layers. A user sees a module only if **all three** pass:

```
┌─────────────────────────────────────────────────────────┐
│                 Module Visibility Flow                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Global Module Status (modules.is_active)             │
│     └─ Platform admin controls via DB                    │
│                                                          │
│  2. Tenant Module Config (tenant_modules)                │
│     └─ Tenant admin toggles via API/UI                   │
│                                                          │
│  3. User Permission Filtering (RBAC)                     │
│     └─ User sees only modules they have permission for   │
│                                                          │
│  Result: User sees module only if ALL 3 layers pass      │
└─────────────────────────────────────────────────────────┘
```

## Module Classification

### Core Modules (Always Enabled)

| Module ID | Name | Reason |
|-----------|------|--------|
| `dashboard` | Dashboard | Entry point, overview metrics |
| `assets` | Assets | Fundamental - all other features depend on assets |
| `findings` | Findings | Core security output, referenced everywhere |
| `scans` | Scans | Primary data ingestion mechanism |
| `team` | Team/Organization | User/member management, required for RBAC |
| `roles` | Roles | RBAC permission system |
| `audit` | Audit Log | Compliance requirement, security traceability |
| `settings` | Settings | Platform configuration |

### Optional Modules (Admin Can Toggle)

| Module ID | Name | Category | Default |
|-----------|------|----------|---------|
| `credentials` | Credential Leaks | Discovery | enabled |
| `components` | Components (SBOM) | Discovery | enabled |
| `branches` | Branches | Discovery | enabled |
| `vulnerabilities` | Vulnerabilities | Discovery | enabled |
| `exposures` | Exposures | Prioritization | enabled |
| `threat_intel` | Threat Intelligence | Prioritization | enabled |
| `ai_triage` | AI Triage | Prioritization | enabled |
| `sla` | SLA Policies | Prioritization | enabled |
| `pentest` | Penetration Testing | Validation | enabled |
| `remediation` | Remediation | Mobilization | enabled |
| `suppressions` | Suppressions | Mobilization | enabled |
| `policies` | Policies | Mobilization | enabled |
| `reports` | Reports | Insights | enabled |
| `integrations` | Integrations | Settings | enabled |
| `agents` | Agents | Settings | enabled |
| `webhooks` | Webhooks | Settings | enabled |
| `api_keys` | API Keys | Settings | enabled |
| `notification_settings` | Notifications | Settings | enabled |
| `pipelines` | Scan Pipelines | Operations | enabled |
| `tools` | Tools | Operations | enabled |
| `scan_profiles` | Scan Profiles | Operations | enabled |
| `scope` | Scope Config | Data | enabled |
| `sources` | Data Sources | Data | enabled |
| `secrets` | Secret Store | Data | enabled |
| `iocs` | IOCs | Operations | enabled |
| `commands` | Commands | Operations | enabled |
| `groups` | Teams/Groups | Settings | enabled |

> **Note:** Sub-modules inherit the enabled/disabled state of their parent module. For example, disabling `integrations` also hides all sub-modules (SCM, notifications, ticketing, etc.).

## Database Schema

### `tenant_modules` Table

```sql
CREATE TABLE tenant_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module_id VARCHAR(50) NOT NULL REFERENCES modules(id),
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    enabled_at TIMESTAMPTZ,
    disabled_at TIMESTAMPTZ,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, module_id)
);
```

**Default behavior:** If no row exists for a given module, the module is **enabled** (backward compatible, fail-open for existing tenants).

**Migrations:** 000079, 000080, 000081 (also adds `is_core` column to `modules` table).

## API Endpoints

All endpoints require `RequireTeamAdmin()` middleware.

### `GET /api/v1/team/settings/modules`

Returns all modules with their tenant-specific enabled/disabled state.

```json
{
  "modules": [
    {
      "id": "dashboard",
      "name": "Dashboard",
      "description": "Overview metrics and quick access",
      "icon": "layout-dashboard",
      "category": "core",
      "display_order": 1,
      "is_core": true,
      "is_enabled": true,
      "release_status": "released",
      "sub_modules": [...]
    }
  ],
  "summary": {
    "total": 30,
    "enabled": 25,
    "disabled": 5,
    "core": 8
  }
}
```

### `PATCH /api/v1/team/settings/modules`

Toggle one or more modules. Core modules cannot be disabled.

```json
{
  "modules": [
    { "module_id": "pentest", "is_enabled": false },
    { "module_id": "credentials", "is_enabled": true }
  ]
}
```

**Validation:**
- Cannot disable core modules → 400
- Module ID must exist in `modules` table → 400
- Module must be globally active → 400
- Sub-module IDs not accepted (they inherit parent state)

### `POST /api/v1/team/settings/modules/reset`

Re-enables all modules (deletes all tenant_modules overrides).

## Key Files

### Backend

| File | Purpose |
|------|---------|
| `api/pkg/domain/module/module.go` | Module entity, `CoreModuleIDs`, `IsCoreModule()` |
| `api/pkg/domain/module/tenant_module.go` | TenantModule entity |
| `api/pkg/domain/module/repository.go` | TenantModuleRepository interface |
| `api/internal/infra/postgres/tenant_module_repository.go` | Repository implementation |
| `api/internal/app/module_service.go` | `GetTenantModuleConfig()`, `UpdateTenantModules()`, `ResetTenantModules()` |
| `api/internal/infra/http/handler/tenant_handler.go` | HTTP handlers |
| `api/internal/infra/http/routes/tenant.go` | Route registration |
| `api/pkg/domain/audit/value_objects.go` | `ActionTenantModulesUpdated` audit action |

### Frontend

| File | Purpose |
|------|---------|
| `ui/src/features/settings/api/use-tenant-modules-api.ts` | SWR hooks (GET, PATCH, POST reset) |
| `ui/src/features/settings/types/tenant-module.types.ts` | TypeScript types |
| `ui/src/app/(dashboard)/settings/modules/page.tsx` | Module Management page |
| `ui/src/config/sidebar-data.ts` | "Modules" sidebar entry (Settings > Organization) |
| `ui/src/lib/permissions/use-filtered-sidebar.ts` | Sidebar module filtering |
| `ui/src/components/layout/nav-group.tsx` | `useFilteredSubItems()` for sub-module visibility |

## Sub-Module Filtering

Sidebar items can specify a `subModuleKey` property that maps to a sub-module slug from the bootstrap API. The `useFilteredSubItems()` hook in `nav-group.tsx` checks the tenant's enabled modules and hides sub-items whose parent module is disabled.

## Sidebar Integration

The `GetTenantEnabledModules()` service method filters modules by tenant overrides before returning them in the bootstrap API response. The existing `use-filtered-sidebar.ts` hook consumes this data, so no additional sidebar changes were needed beyond the bootstrap query update.

An optimized `buildTenantModuleConfig()` query combines module + tenant override data in a single query for bootstrap, avoiding N+1 patterns.

## Impact When Module Is Disabled

| Area | Impact |
|------|--------|
| **Sidebar** | Module and sub-items hidden |
| **Bootstrap API** | Module excluded from `module_ids` |
| **Direct URL access** | Page still accessible (no ModuleGate yet) |
| **API endpoints** | Still accessible (no server-side gating) |
| **Notifications** | Disabled module events still processed |
| **Scan results** | Scans still run, results still stored |

> **Note:** Disabling a module only hides the UI. Data remains intact and accessible when re-enabled.

## Audit Logging

All module changes are logged with:
- Action: `tenant.modules_updated`
- Before/after state for each changed module
- User who made the change

## Security

- **Permission**: `team:update` (RequireTeamAdmin) for all endpoints
- **Core module protection**: Server-side validation prevents disabling core modules
- **Tenant isolation**: UNIQUE constraint on `(tenant_id, module_id)`
- **No data loss**: Disabling only hides UI, data remains intact

## Future Enhancements

- **ModuleGate component**: Wrap pages under optional modules to show "Module not enabled" for direct URL access
- **Server-side module gating**: `middleware.RequireModule("pentest")` to reject API requests for disabled modules
- **Module-level quotas**: Per-tenant usage limits per module
- **Trial periods**: Time-limited module access

## Related

- [Configurable Risk Scoring](configurable-risk-scoring.md) -- Similar settings pattern
- [Approval Workflow](approval-workflow.md) -- Governed state transitions
