---
layout: default
title: Module Permission Filtering
parent: Architecture
nav_order: 20
---

# Module Permission Filtering

## Technical Specification Document

**Version:** 1.0
**Status:** Implemented
**Author:** Engineering Team
**Created:** 2026-01-24
**Last Updated:** 2026-01-24

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Design](#3-solution-design)
4. [Implementation Details](#4-implementation-details)
5. [Module-Permission Mapping](#5-module-permission-mapping)
6. [System Role Permissions](#6-system-role-permissions)
7. [API Changes](#7-api-changes)
8. [Frontend Integration](#8-frontend-integration)
9. [Migration Guide](#9-migration-guide)

---

## 1. Executive Summary

### 1.1 Overview

This document describes the implementation of module-based permission filtering for the sidebar navigation. The system ensures that users only see modules they have permission to access, implementing a proper separation between:

1. **Module Layer** (Tenant-level): What modules the tenant's configuration includes
2. **RBAC Layer** (User-level): What modules the user has permission to access within the tenant

### 1.2 Key Benefits

| Benefit | Description |
|---------|-------------|
| **Security** | Users cannot see modules they don't have access to |
| **Clean UX** | Sidebar only shows relevant modules for each user's role |
| **Proper RBAC** | Enforced at both frontend and backend levels |
| **Maintainable** | Centralized module-permission mapping |

---

## 2. Problem Statement

### 2.1 Previous Behavior

The API endpoint `GET /api/v1/me/modules` returned all modules enabled for the tenant's module configuration, regardless of the user's individual permissions.

```
Previous Flow:
───────────────────────────────────────────────────────────────────
User (Member role) → API /me/modules
                          ↓
                   [Tenant Plan Check]
                   Returns: ALL 43 modules
                          ↓
                   Frontend renders ALL modules in sidebar
                          ↓
                   User sees Audit, Billing, etc. (shouldn't have access!)
───────────────────────────────────────────────────────────────────
```

### 2.2 Issues

1. **Security Concern**: Users could see menu items for features they couldn't access
2. **Confusing UX**: Clicking restricted items resulted in 403 errors
3. **Inconsistent**: Frontend filtering was bypassed during loading states

---

## 3. Solution Design

### 3.1 Architecture

The solution implements a 2-layer filtering system:

```
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 1: LICENSING                            │
│                    (Tenant Subscription)                         │
├─────────────────────────────────────────────────────────────────┤
│  Tenant → Plan → Modules                                         │
│  "What modules does this tenant's plan include?"                 │
│                                                                  │
│  Example: Enterprise Plan → 43 modules                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 2: RBAC                                 │
│                    (User Permissions)                            │
├─────────────────────────────────────────────────────────────────┤
│  User → Role → Permissions → Filtered Modules                    │
│  "What modules can this user access within the tenant?"          │
│                                                                  │
│  Example: Member role → 25 modules (no audit, billing, etc.)     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    RESULT: FILTERED MODULES                      │
├─────────────────────────────────────────────────────────────────┤
│  API returns intersection of:                                    │
│  - Modules in tenant's plan                                      │
│  - Modules user has permission for                               │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Flow Diagram

```
Request: GET /api/v1/me/modules
         Authorization: Bearer <JWT with permissions>

         ↓
┌─────────────────────────────────────────┐
│ 1. Extract tenant_id from JWT           │
│ 2. Get modules from tenant's plan       │
│    Result: 43 modules                   │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 3. Extract permissions from JWT         │
│ 4. Extract isAdmin flag from JWT        │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 5. Filter modules by permissions        │
│    - Admin/Owner: bypass (see all)      │
│    - Others: check module→permission    │
│    Result: 25 modules (for Member)      │
└─────────────────────────────────────────┘
         ↓
Response: { module_ids: [...], modules: [...] }
```

---

## 4. Implementation Details

### 4.1 Backend Changes

#### File: `api/internal/domain/licensing/module.go`

Added module-permission mapping and filter functions:

```go
// ModulePermissionMapping maps module IDs to their required read permissions.
var ModulePermissionMapping = map[string]string{
    ModuleDashboard:     "dashboard:read",
    ModuleAssets:        "assets:read",
    ModuleFindings:      "findings:read",
    ModuleScans:         "scans:read",
    ModuleAudit:         "audit:read",
    ModuleBilling:       "settings:billing:read",
    // ... more mappings
}

// FilterModulesByPermissions filters modules based on user's permissions.
func FilterModulesByPermissions(modules []*Module, userPermissions []string, isAdmin bool) []*Module {
    // Admin/Owner bypass permission checks
    if isAdmin {
        return modules
    }

    // Filter based on permissions
    filtered := make([]*Module, 0, len(modules))
    for _, m := range modules {
        requiredPerm := GetRequiredPermission(m.ID())
        if requiredPerm == "" || hasPermission(userPermissions, requiredPerm) {
            filtered = append(filtered, m)
        }
    }
    return filtered
}
```

#### File: `api/internal/infra/http/handler/licensing_handler.go`

Updated `GetTenantModules()` to apply filtering:

```go
func (h *LicensingHandler) GetTenantModules(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Layer 1: Get modules from tenant's plan
    output, _ := h.service.GetTenantEnabledModules(ctx, tenantID)

    // Layer 2: Filter by user permissions
    userPermissions := middleware.GetPermissions(ctx)
    isAdmin := middleware.IsAdmin(ctx)

    filteredModules := licensing.FilterModulesByPermissions(
        output.Modules, userPermissions, isAdmin)
    filteredModuleIDs := licensing.FilterModuleIDsByPermissions(
        output.ModuleIDs, userPermissions, isAdmin)

    // Return filtered result
    json.NewEncoder(w).Encode(TenantModulesResponse{
        ModuleIDs: filteredModuleIDs,
        Modules:   filteredModules,
        // ...
    })
}
```

---

## 5. Module-Permission Mapping

### 5.1 Complete Mapping Table

| Module ID | Required Permission | Description |
|-----------|-------------------|-------------|
| `dashboard` | `dashboard:read` | Main dashboard |
| `assets` | `assets:read` | Asset inventory |
| `findings` | `findings:read` | Security findings |
| `scans` | `scans:read` | Scan management |
| `agents` | `agents:read` | Agent management |
| `reports` | `reports:read` | Report generation |
| `integrations` | `integrations:read` | Integration settings |
| `notifications` | `integrations:notifications:read` | Notification channels |
| `team` | `team:read` | Team settings |
| `groups` | `team:groups:read` | Group management |
| `roles` | `team:roles:read` | Role management |
| `audit` | `audit:read` | Audit logs |
| `billing` | `settings:billing:read` | Billing settings |
| `credentials` | `findings:credentials:read` | Credential leaks |
| `components` | `assets:components:read` | SBOM components |
| `threat_intel` | `findings:read` | Threat intelligence |
| `pentest` | `validation:read` | Penetration testing |
| `remediation` | `findings:remediation:read` | Remediation tasks |
| `policies` | `findings:policies:read` | Security policies |
| `settings` | `team:read` | General settings |

### 5.2 Module Visibility by Role

| Module | Owner | Admin | Member | Viewer |
|--------|:-----:|:-----:|:------:|:------:|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Assets | ✅ | ✅ | ✅ | ✅ |
| Findings | ✅ | ✅ | ✅ | ✅ |
| Scans | ✅ | ✅ | ✅ | ✅ |
| Reports | ✅ | ✅ | ✅ | ✅ |
| Integrations | ✅ | ✅ | ✅ | ✅ |
| **Audit Log** | ✅ | ✅ | ❌ | ❌ |
| **Billing** | ✅ | ✅ | ❌ | ❌ |
| **Roles** | ✅ | ✅ | ✅ | ✅ |
| **Members** | ✅ | ✅ | ✅ | ✅ |

---

## 6. System Role Permissions

### 6.1 Permission Counts

| Role | Total Permissions | Key Differences |
|------|:-----------------:|-----------------|
| **Owner** | 215 | All permissions |
| **Admin** | 213 | All except `team:delete`, `settings:billing:write` |
| **Member** | 86 | Read + Write, no admin features |
| **Viewer** | 66 | Read-only access |

### 6.2 Migration

Migration `000076_fix_system_role_permissions.up.sql` resets permissions:

```sql
-- Owner gets ALL permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000001', id
FROM permissions;

-- Admin gets all except owner-only operations
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000002', id
FROM permissions
WHERE id NOT IN ('team:delete', 'settings:billing:write');

-- Member gets specific permissions (no audit, billing, etc.)
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000003', id
FROM permissions
WHERE id IN ('dashboard:read', 'assets:read', 'assets:write', ...);

-- Viewer gets read-only permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000004', id
FROM permissions
WHERE id LIKE '%:read'
  AND id NOT IN ('settings:billing:read', 'audit:read');
```

---

## 7. API Changes

### 7.1 Endpoint: GET /api/v1/me/modules

**Request:**
```http
GET /api/v1/me/modules
Authorization: Bearer <jwt_token>
X-Tenant-ID: <tenant_id>
```

**Response (Before - All modules):**
```json
{
  "module_ids": ["dashboard", "assets", "findings", "audit", "billing", ...],
  "modules": [/* 43 modules */]
}
```

**Response (After - Filtered for Member role):**
```json
{
  "module_ids": ["dashboard", "assets", "findings", "scans", ...],
  "modules": [/* 25 modules - no audit, billing */]
}
```

### 7.2 Response Differences by Role

| Role | module_ids count | Excluded modules |
|------|:----------------:|------------------|
| Owner | 43 | None |
| Admin | 43 | None |
| Member | ~30 | audit, billing, roles:write related |
| Viewer | ~28 | audit, billing, all write-related |

---

## 8. Frontend Integration

### 8.1 Sidebar Filtering Hook

The frontend uses `useFilteredSidebarData()` hook which combines:

```typescript
// File: ui/src/lib/permissions/use-filtered-sidebar.ts

export function useFilteredSidebarData(sidebarData: SidebarData) {
  const { can, tenantRole } = usePermissions()
  const { moduleIds, modules } = useTenantModules() // API /me/modules

  // Filter items based on:
  // 1. Module access (from API - already filtered by backend)
  // 2. Permission check (additional frontend check)
  // 3. Role requirements
}
```

### 8.2 Frontend Caching

- Modules are cached via SWR with 1-minute deduplication
- Permission sync triggers re-fetch when version changes
- Hard refresh or logout/login clears all caches

---

## 9. Migration Guide

### 9.1 For Existing Deployments

1. **Deploy Backend Changes**
   ```bash
   docker compose up -d --build app
   ```

2. **Run Migration**
   ```bash
   migrate -path=/app/migrations -database "$DB_URL" up
   ```

3. **Verify Permissions**
   ```sql
   SELECT r.slug, COUNT(rp.permission_id) as count
   FROM roles r
   JOIN role_permissions rp ON r.id = rp.role_id
   WHERE r.id IN (
     '00000000-0000-0000-0000-000000000001',
     '00000000-0000-0000-0000-000000000002',
     '00000000-0000-0000-0000-000000000003',
     '00000000-0000-0000-0000-000000000004'
   )
   GROUP BY r.slug;
   ```

4. **Users Must Re-login**
   - Existing JWT tokens contain old permissions
   - Users need to logout and login to get updated permissions

### 9.2 Rollback

If issues occur, rollback the migration:

```bash
migrate -path=/app/migrations -database "$DB_URL" down 1
```

This restores the previous (broader) permission set for Member role.

---

## Related Documents

- [Roles and Permissions Guide](../guides/roles-and-permissions.md)
- [Permission Real-time Sync](./permission-realtime-sync.md)
- [Access Control Implementation](./access-control-flows-and-data.md)
