---
layout: default
title: Module Access Control
parent: Architecture
nav_order: 15
---

# Module Access Control

This document describes the module-based access control system that restricts API and UI access based on tenant module configuration.

---

## Overview

OpenCTEM implements a **3-layer access control architecture**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 1: MODULES (Tenant)                     │
├─────────────────────────────────────────────────────────────────┤
│  Tenant → Enabled Modules                                        │
│  "What modules can this tenant access?"                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 2: RBAC (User)                          │
├─────────────────────────────────────────────────────────────────┤
│  User → Roles → Permissions                                      │
│  "What can this user do within allowed modules?"                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 3: DATA SCOPE (Groups)                  │
├─────────────────────────────────────────────────────────────────┤
│  User → Groups → Assets/Data                                     │
│  "What data can this user see?"                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Layer 1 (Module Access Control)** ensures that tenants can only access features included in their enabled modules.

---

## Module Definitions

Modules are defined in `api/internal/domain/licensing/module.go`:

| Module ID | Description | Category |
|-----------|-------------|----------|
| `dashboard` | Main dashboard | Core |
| `assets` | Asset management | Feature |
| `findings` | Vulnerability findings | Feature |
| `scans` | Security scans | Feature |
| `agents` | Scan agents | Feature |
| `integrations` | Third-party integrations | Feature |
| `audit` | Audit logging | Feature |
| `team` | Team management | Core |
| `groups` | Team groups | Core |
| `roles` | Role management | Core |
| `components` | SBOM/Components (sub-module of assets) | Feature |

### Core vs Feature Modules

- **Core modules** (dashboard, team, groups, roles, settings) are always available to all tenants
- **Feature modules** require explicit activation for the tenant

---

## Backend Implementation

### Middleware

The `RequireModule` middleware checks if a tenant has access to a specific module:

```go
// api/internal/infra/http/middleware/module.go

func RequireModule(checker ModuleChecker, moduleID string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            tenantID := GetTenantID(r.Context())

            hasModule, err := checker.TenantHasModule(r.Context(), tenantID, moduleID)
            if err != nil || !hasModule {
                apierror.New(
                    http.StatusForbidden,
                    "MODULE_NOT_ENABLED",
                    "This feature is not available in your current plan.",
                ).WriteJSON(w)
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}
```

### Route Registration

Module check is applied at the route group level:

```go
// api/internal/infra/http/routes.go

func registerAssetRoutes(
    router Router,
    h *handler.AssetHandler,
    authMiddleware Middleware,
    userSyncMiddleware Middleware,
    moduleService *app.ModuleService,
) {
    middlewares := buildTokenTenantMiddlewares(authMiddleware, userSyncMiddleware)

    // Add module check middleware
    if moduleService != nil {
        middlewares = append(middlewares,
            middleware.RequireModule(moduleService, licensing.ModuleAssets))
    }

    router.Group("/api/v1/assets", func(r Router) {
        // All routes in this group require "assets" module
        r.GET("/", h.List, middleware.Require(permission.AssetsRead))
        r.POST("/", h.Create, middleware.Require(permission.AssetsWrite))
        // ...
    }, middlewares...)
}
```

### Protected Routes

| Module | Protected Routes |
|--------|------------------|
| `assets` | `/api/v1/assets/*`, `/api/v1/asset-groups/*`, `/api/v1/components/*` |
| `findings` | `/api/v1/findings/*` |
| `scans` | `/api/v1/scans/*`, `/api/v1/scan-profiles/*` |
| `agents` | `/api/v1/agents/*` |
| `integrations` | `/api/v1/integrations/*` |
| `audit` | `/api/v1/audit-logs/*` |

---

## Frontend Implementation

### ModuleGate Component

The `ModuleGate` component wraps UI pages to check module access:

```tsx
// ui/src/features/licensing/components/module-gate.tsx

export function ModuleGate({ module, children, fallback }: ModuleGateProps) {
  const { moduleIds, isLoading } = useTenantModules()

  if (isLoading) {
    return <LoadingSkeleton />
  }

  const hasModule = moduleIds.includes(module)

  if (hasModule) {
    return children
  }

  return fallback ?? <UpgradePrompt module={module} />
}
```

### Layout-Level Protection

Module checks are applied at the layout level for route groups:

```tsx
// ui/src/app/(dashboard)/(discovery)/assets/layout.tsx

export default function AssetsLayout({ children }) {
  return <ModuleGate module="assets">{children}</ModuleGate>
}
```

### Protected UI Routes

| Module | Protected Routes |
|--------|------------------|
| `assets` | `/assets/*`, `/asset-groups/*`, `/components/*` |
| `findings` | `/findings/*` |
| `scans` | `/scans/*`, `/scan-profiles/*` |
| `agents` | `/agents/*` |
| `integrations` | `/settings/integrations/*` |
| `audit` | `/settings/audit/*` |

---

## API Response

When a tenant tries to access a module not in their plan:

```json
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "code": "MODULE_NOT_ENABLED",
  "message": "This feature is not available in your current plan. Please upgrade to access this module."
}
```

---

## Checking Module Access

### Backend (Go)

```go
// Check if tenant has module
hasModule, err := moduleService.TenantHasModule(ctx, tenantID, "assets")
if !hasModule {
    return ErrModuleNotEnabled
}
```

### Frontend (React)

```tsx
// Using hook
const { hasModule, isLoading } = useModuleAccess('assets')

// Using component
<ModuleGate module="assets">
  <AssetsPage />
</ModuleGate>
```

---

## Security Considerations

1. **Defense in Depth**: Module checks are applied at both API and UI levels
2. **Backend is Source of Truth**: Even if UI is bypassed, API will reject unauthorized requests
3. **Graceful Degradation**: UI shows upgrade prompts instead of errors
4. **Caching**: Module access is cached but invalidated when subscription changes

---

## Related Documentation

- [Route-Level Permission Protection](route-level-permission-protection.md)
- [Permission Realtime Sync](permission-realtime-sync.md)
