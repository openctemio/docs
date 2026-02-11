---
layout: default
title: API Optimization Plan
parent: Implementation Plans
grand_parent: Architecture
nav_order: 1
---

# API Optimization Plan - Reduce Initial Load Requests

> Optimize from 4+ API calls to 1 call after login

**Status:** ✅ Completed
**Priority:** Medium
**Estimated Effort:** 1-2 weeks
**Impact:** 60-70% faster initial load
**Last Updated:** 2026-01-26
**Completed:** 2026-01-26

---

## Implementation Summary

**Completed:** 2026-01-26

### Files Implemented

**Backend:**
- `api/internal/infra/http/handler/bootstrap_handler.go` - Bootstrap handler with concurrent data fetching
- `api/internal/infra/http/routes/misc.go` - Route registration for `/api/v1/me/bootstrap`

**Frontend:**
- `ui/src/context/bootstrap-provider.tsx` - Bootstrap context provider with hooks
- Integration with `PermissionProvider` for permissions from bootstrap
- Integration with `useTenantSubscription` for subscription data
- Integration with `useTenantModules` for modules data

### Design Decisions

1. **Dashboard excluded from bootstrap** - Dashboard stats are NOT included to reduce query load. Dashboard should be fetched separately via `/api/v1/dashboard/stats` when needed.

2. **Concurrent fetching** - Uses `errgroup` for parallel fetching of permissions, subscription, and modules.

3. **Graceful degradation** - Non-fatal errors (subscription, modules) return partial data rather than failing the entire request.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Current State Analysis](#current-state-analysis)
3. [Solution Comparison](#solution-comparison)
4. [Recommended Solution](#recommended-solution)
5. [Implementation Plan](#implementation-plan)
6. [API Specification](#api-specification)
7. [Migration Strategy](#migration-strategy)

---

## Problem Statement

### Symptoms
- 18+ requests immediately after login
- Sequential waterfall pattern (not parallel)
- Duplicate data fetching (subscription vs modules)
- Slow Time to Interactive (TTI)

### Impact
- Poor user experience on slow networks
- Unnecessary server load
- Wasted bandwidth

### Goal
Reduce initial API calls from 4 to 1, improving load time by 60-70%.

---

## Current State Analysis

### API Calls After Login

| # | Endpoint | Provider | Cache | Purpose |
|---|----------|----------|-------|---------|
| 1 | `GET /api/v1/me/permissions/sync` | PermissionProvider | localStorage 24h + SWR | Authorization |
| 2 | `GET /api/v1/me/subscription` | useTenantSubscription | SWR 1min | Billing, limits |
| 3 | `GET /api/v1/me/modules` | useTenantModules | SWR 1min | Feature gates |
| 4 | `GET /api/v1/dashboard/stats` | useDashboardStats | SWR 30s | Dashboard |

### Data Flow (Current - Waterfall)

```
Login Success
    │
    ▼
TenantProvider (read cookie)
    │
    ▼ ─────────────────────────────────────────┐
PermissionProvider                              │
    │ GET /api/v1/me/permissions/sync (200ms)  │
    ▼                                          │ Sequential
Components Mount                               │ Waterfall
    │ GET /api/v1/me/subscription (200ms)      │ = SLOW
    │ GET /api/v1/me/modules (200ms)           │
    │ GET /api/v1/dashboard/stats (200ms)      │
    ▼ ─────────────────────────────────────────┘
Dashboard Ready (800ms total)
```

### Data Redundancy Issue

```typescript
// subscription response ALREADY includes modules:
{
  "plan": {
    "modules": [
      { "id": "dashboard", "name": "Dashboard", ... },
      { "id": "assets", "name": "Assets", ... },
      // ...
    ]
  }
}

// BUT we ALSO call /me/modules which returns:
{
  "module_ids": ["dashboard", "assets", ...],
  "modules": [
    { "id": "dashboard", "name": "Dashboard", ... },  // DUPLICATE!
    { "id": "assets", "name": "Assets", ... },
    // ...
  ]
}
```

**Waste:** ~2KB duplicate data per request

---

## Solution Comparison

### Evaluated Approaches

| Approach | Requests | Latency | Backend Changes | Frontend Changes | Recommendation |
|----------|----------|---------|-----------------|------------------|----------------|
| **A. Bootstrap Endpoint** | 4 → 1 | -60-70% | New endpoint | New hook + context | ✅ **BEST** |
| B. GraphQL Batching | 4 → 1 | -50-60% | New batch endpoint | Complex parsing | ❌ Overkill |
| C. Server Components | 4 → 0 | -100% | None | Major refactor | ❌ Too complex |
| D. Parallel Only | 4 → 4 | -30% | None | Minor changes | ❌ Not enough |

### Why Bootstrap Endpoint is Best

1. **Single RTT**: 1 request vs 4 = 75% reduction
2. **Atomic Data**: All data from same moment = consistency
3. **Server Validation**: Permission check once, include/exclude data
4. **Future-proof**: Easy to add more bootstrap data
5. **Backward Compatible**: Individual hooks still work as fallback

---

## Recommended Solution

### Architecture: Bootstrap Endpoint + Progressive Enhancement

```
Login Success
    │
    ▼
TenantProvider (read cookie)
    │
    ▼
BootstrapProvider
    │ GET /api/v1/me/bootstrap (200ms)  ← SINGLE REQUEST
    │
    ▼
┌─────────────────────────────────────────┐
│ Bootstrap Response                       │
├─────────────────────────────────────────┤
│ ├── permissions: { list, version }      │
│ ├── subscription: { plan, status, ... } │
│ ├── modules: { ids, modules, events }   │
│ └── dashboard?: { stats }  (optional)   │
└─────────────────────────────────────────┘
    │
    ▼
Dashboard Ready (200ms total) ← 4x FASTER!
```

### Key Design Decisions

1. **Dashboard data is optional**: Only include if user has `dashboard:read` permission
2. **Backward compatible**: Individual hooks work as fallback if bootstrap fails
3. **Cache strategy**: Bootstrap cached 1 minute, individual hooks can refresh independently
4. **Permission-aware**: Server validates permissions before including sensitive data

---

## Implementation Plan

### Phase 1: Backend - Bootstrap Endpoint ✅ Completed

#### 1.1 Create Bootstrap Handler

```go
// api/internal/infra/http/handler/bootstrap_handler.go

package handler

import (
    "encoding/json"
    "net/http"
    "sync"

    "github.com/openctemio/api/internal/app"
    "github.com/openctemio/api/internal/domain/shared"
    "github.com/openctemio/api/internal/infra/http/middleware"
    "github.com/openctemio/api/pkg/apierror"
    "github.com/openctemio/api/pkg/logger"
    "golang.org/x/sync/errgroup"
)

type BootstrapHandler struct {
    permissionService *app.PermissionService
    licensingService  *app.LicensingService
    dashboardService  *app.DashboardService
    logger            *logger.Logger
}

func NewBootstrapHandler(
    permissionService *app.PermissionService,
    licensingService *app.LicensingService,
    dashboardService *app.DashboardService,
    logger *logger.Logger,
) *BootstrapHandler {
    return &BootstrapHandler{
        permissionService: permissionService,
        licensingService:  licensingService,
        dashboardService:  dashboardService,
        logger:            logger,
    }
}

// BootstrapResponse combines all initial data needed after login
type BootstrapResponse struct {
    Permissions  PermissionsData   `json:"permissions"`
    Subscription *SubscriptionData `json:"subscription,omitempty"`
    Modules      ModulesData       `json:"modules"`
    Dashboard    *DashboardData    `json:"dashboard,omitempty"`
}

type PermissionsData struct {
    List    []string `json:"list"`
    Version int      `json:"version"`
}

type SubscriptionData struct {
    PlanID         string                 `json:"plan_id"`
    Plan           interface{}            `json:"plan"`
    Status         string                 `json:"status"`
    BillingCycle   string                 `json:"billing_cycle"`
    LimitsOverride map[string]interface{} `json:"limits_override,omitempty"`
}

type ModulesData struct {
    ModuleIDs  []string      `json:"module_ids"`
    Modules    []interface{} `json:"modules"`
    EventTypes []string      `json:"event_types,omitempty"`
}

type DashboardData struct {
    Stats interface{} `json:"stats"`
}

// Bootstrap returns all initial data needed after login
// GET /api/v1/me/bootstrap
func (h *BootstrapHandler) Bootstrap(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    actx := middleware.GetAuthContext(ctx)

    if actx == nil {
        apierror.Unauthorized("Not authenticated").WriteJSON(w)
        return
    }

    var (
        permissions  []string
        permVersion  int
        subscription *app.TenantSubscriptionOutput
        modules      *app.TenantModulesOutput
        dashboard    *app.DashboardStatsOutput
        mu           sync.Mutex
    )

    g, gctx := errgroup.WithContext(ctx)

    // Fetch permissions (always required)
    g.Go(func() error {
        perms, version, err := h.permissionService.SyncPermissions(gctx, actx)
        if err != nil {
            return err
        }
        mu.Lock()
        permissions = perms
        permVersion = version
        mu.Unlock()
        return nil
    })

    // Fetch subscription
    g.Go(func() error {
        sub, err := h.licensingService.GetTenantSubscription(gctx, actx.TenantID)
        if err != nil {
            // Non-fatal: subscription might not exist for new tenants
            h.logger.Warn("bootstrap: failed to get subscription", "error", err)
            return nil
        }
        mu.Lock()
        subscription = sub
        mu.Unlock()
        return nil
    })

    // Fetch modules
    g.Go(func() error {
        mods, err := h.licensingService.GetTenantEnabledModules(gctx, actx.TenantID)
        if err != nil {
            h.logger.Warn("bootstrap: failed to get modules", "error", err)
            return nil
        }
        mu.Lock()
        modules = mods
        mu.Unlock()
        return nil
    })

    // Fetch dashboard stats (only if has permission)
    g.Go(func() error {
        // Check permission first
        hasPermission := false
        for _, p := range permissions {
            if p == "dashboard:read" {
                hasPermission = true
                break
            }
        }
        // Wait for permissions to be fetched first
        // In practice, we'd check actx.Permissions or similar

        if !hasPermission && !actx.IsAdmin {
            return nil // Skip dashboard for users without permission
        }

        stats, err := h.dashboardService.GetStats(gctx, actx.TenantID)
        if err != nil {
            h.logger.Warn("bootstrap: failed to get dashboard stats", "error", err)
            return nil
        }
        mu.Lock()
        dashboard = &app.DashboardStatsOutput{Stats: stats}
        mu.Unlock()
        return nil
    })

    // Wait for all goroutines
    if err := g.Wait(); err != nil {
        h.logger.Error("bootstrap: failed", "error", err)
        apierror.InternalError(err).WriteJSON(w)
        return
    }

    // Build response
    resp := BootstrapResponse{
        Permissions: PermissionsData{
            List:    permissions,
            Version: permVersion,
        },
    }

    if subscription != nil {
        resp.Subscription = &SubscriptionData{
            PlanID:         subscription.PlanID,
            Plan:           subscription.Plan,
            Status:         subscription.Status,
            BillingCycle:   subscription.BillingCycle,
            LimitsOverride: subscription.LimitsOverride,
        }
    }

    if modules != nil {
        resp.Modules = ModulesData{
            ModuleIDs:  modules.ModuleIDs,
            Modules:    modules.Modules,
            EventTypes: modules.EventTypes,
        }
    }

    if dashboard != nil {
        resp.Dashboard = &DashboardData{
            Stats: dashboard.Stats,
        }
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(resp)
}
```

#### 1.2 Register Route

```go
// api/internal/infra/http/routes.go

// In the authenticated routes section:
r.Route("/me", func(r chi.Router) {
    r.Use(middleware.UnifiedAuth(authConfig, jwtValidator, oidcValidator))

    // Existing routes...
    r.Get("/permissions/sync", permissionHandler.SyncPermissions)
    r.Get("/subscription", licensingHandler.GetTenantSubscription)
    r.Get("/modules", licensingHandler.GetTenantModules)

    // NEW: Bootstrap endpoint
    r.Get("/bootstrap", bootstrapHandler.Bootstrap)
})
```

### Phase 2: Frontend - Bootstrap Hook ✅ Completed

#### 2.1 Create Bootstrap Hook

```typescript
// ui/src/features/core/api/use-bootstrap.ts

import useSWR from 'swr'
import { apiClient } from '@/lib/api/client'
import { useTenant } from '@/context/tenant-provider'

export interface BootstrapPermissions {
  list: string[]
  version: number
}

export interface BootstrapSubscription {
  plan_id: string
  plan: {
    id: string
    slug: string
    name: string
    modules: Array<{
      id: string
      name: string
      limits?: Record<string, number>
    }>
  }
  status: 'active' | 'trial' | 'past_due' | 'cancelled' | 'expired'
  billing_cycle: 'monthly' | 'yearly'
  limits_override?: Record<string, number>
}

export interface BootstrapModules {
  module_ids: string[]
  modules: Array<{
    id: string
    slug: string
    name: string
    description?: string
    category: string
    is_active: boolean
    release_status: string
  }>
  event_types?: string[]
}

export interface BootstrapDashboard {
  stats: {
    total_assets: number
    total_findings: number
    critical_findings: number
    // ... other stats
  }
}

export interface BootstrapData {
  permissions: BootstrapPermissions
  subscription?: BootstrapSubscription
  modules: BootstrapModules
  dashboard?: BootstrapDashboard
}

const fetcher = async (): Promise<BootstrapData> => {
  const response = await apiClient.get('/me/bootstrap')
  return response.data
}

export function useBootstrap() {
  const { currentTenant } = useTenant()

  const { data, error, isLoading, mutate } = useSWR<BootstrapData>(
    currentTenant ? ['bootstrap', currentTenant.id] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000, // 1 minute
      errorRetryCount: 2,
    }
  )

  return {
    data,
    permissions: data?.permissions,
    subscription: data?.subscription,
    modules: data?.modules,
    dashboard: data?.dashboard,
    isLoading,
    error,
    refresh: mutate,
  }
}
```

#### 2.2 Create Bootstrap Context

```typescript
// ui/src/context/bootstrap-provider.tsx

'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useBootstrap, type BootstrapData } from '@/features/core/api/use-bootstrap'

interface BootstrapContextValue {
  data: BootstrapData | undefined
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

const BootstrapContext = createContext<BootstrapContextValue | null>(null)

export function BootstrapProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, error, refresh } = useBootstrap()

  return (
    <BootstrapContext.Provider
      value={{
        data,
        isLoading,
        error: error ?? null,
        refresh: async () => { await refresh() },
      }}
    >
      {children}
    </BootstrapContext.Provider>
  )
}

export function useBootstrapContext() {
  const context = useContext(BootstrapContext)
  if (!context) {
    throw new Error('useBootstrapContext must be used within BootstrapProvider')
  }
  return context
}

// Helper hook to get permissions from bootstrap
export function useBootstrapPermissions() {
  const { data, isLoading } = useBootstrapContext()
  return {
    permissions: data?.permissions?.list ?? [],
    version: data?.permissions?.version ?? 0,
    isLoading,
  }
}

// Helper hook to get subscription from bootstrap
export function useBootstrapSubscription() {
  const { data, isLoading } = useBootstrapContext()
  return {
    subscription: data?.subscription,
    isLoading,
  }
}

// Helper hook to get modules from bootstrap
export function useBootstrapModules() {
  const { data, isLoading } = useBootstrapContext()
  return {
    moduleIds: data?.modules?.module_ids ?? [],
    modules: data?.modules?.modules ?? [],
    eventTypes: data?.modules?.event_types ?? [],
    isLoading,
  }
}
```

### Phase 3: Integration ✅ Completed

#### 3.1 Update Providers

```typescript
// ui/src/components/layout/dashboard-providers.tsx

'use client'

import { TenantProvider } from '@/context/tenant-provider'
import { BootstrapProvider } from '@/context/bootstrap-provider'
import { PermissionProvider } from '@/context/permission-provider'
// ... other imports

export function DashboardProviders({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <BootstrapProvider>
        <PermissionProvider>
          {children}
        </PermissionProvider>
      </BootstrapProvider>
    </TenantProvider>
  )
}
```

#### 3.2 Update Permission Provider to Use Bootstrap

```typescript
// ui/src/context/permission-provider.tsx (updated)

'use client'

import { useBootstrapContext } from './bootstrap-provider'
// ... existing imports

export function PermissionProvider({ children }: { children: ReactNode }) {
  const bootstrap = useBootstrapContext()

  // Use bootstrap data as initial value
  const [permissions, setPermissions] = useState<string[]>(
    bootstrap.data?.permissions?.list ?? []
  )
  const [version, setVersion] = useState(
    bootstrap.data?.permissions?.version ?? 0
  )

  // Sync from bootstrap when it loads
  useEffect(() => {
    if (bootstrap.data?.permissions) {
      setPermissions(bootstrap.data.permissions.list)
      setVersion(bootstrap.data.permissions.version)
    }
  }, [bootstrap.data?.permissions])

  // ... rest of existing logic (polling, stale header handling, etc.)
}
```

#### 3.3 Update Individual Hooks as Fallbacks

```typescript
// ui/src/features/licensing/api/use-subscription.ts (updated)

export function useTenantSubscription() {
  // Try bootstrap first
  const bootstrap = useBootstrapContext?.() // Optional chaining for backward compat

  if (bootstrap?.data?.subscription) {
    return {
      subscription: bootstrap.data.subscription,
      plan: bootstrap.data.subscription.plan,
      status: bootstrap.data.subscription.status,
      isActive: bootstrap.data.subscription.status === 'active',
      isLoading: false,
      error: null,
    }
  }

  // Fallback to direct API call (for components outside BootstrapProvider)
  const { data, error, isLoading } = useSWR(
    '/api/v1/me/subscription',
    fetcher,
    { revalidateOnFocus: false }
  )

  return {
    subscription: data,
    plan: data?.plan,
    status: data?.status,
    isActive: data?.status === 'active',
    isLoading,
    error,
  }
}
```

---

## API Specification

### Endpoint

```
GET /api/v1/me/bootstrap
Authorization: Bearer <access_token>
```

### Response

```json
{
  "permissions": {
    "list": ["dashboard:read", "assets:read", "assets:write", ...],
    "version": 42
  },
  "subscription": {
    "plan_id": "plan_team",
    "plan": {
      "id": "plan_team",
      "slug": "team",
      "name": "Team",
      "price_monthly": 49,
      "modules": [...]
    },
    "status": "active",
    "billing_cycle": "monthly",
    "limits_override": null
  },
  "modules": {
    "module_ids": ["dashboard", "assets", "findings", "scans"],
    "modules": [
      {
        "id": "dashboard",
        "slug": "dashboard",
        "name": "Dashboard",
        "category": "core",
        "is_active": true,
        "release_status": "released"
      }
    ],
    "event_types": ["findings", "exposures", "scans"]
  },
  "dashboard": {
    "stats": {
      "total_assets": 150,
      "total_findings": 42,
      "critical_findings": 3,
      "high_findings": 12,
      "medium_findings": 15,
      "low_findings": 12
    }
  }
}
```

### Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 401 | Not authenticated |
| 403 | Tenant access denied |
| 500 | Internal error |

---

## Migration Strategy

### Rollout Plan

1. **Week 1**: Deploy backend endpoint (behind feature flag if needed)
2. **Week 2**: Deploy frontend with bootstrap hook
3. **Week 3**: Monitor metrics, fix issues
4. **Week 4**: Remove individual API calls, keep as fallback only

### Backward Compatibility

- Individual endpoints (`/me/permissions/sync`, `/me/subscription`, `/me/modules`) remain active
- Individual hooks work as fallback when outside BootstrapProvider
- No breaking changes to existing components

### Monitoring

Track these metrics before/after:
- **API call count** per session
- **Time to Interactive (TTI)**
- **First Contentful Paint (FCP)**
- **Bootstrap endpoint latency**
- **Error rate** on bootstrap endpoint

---

## Expected Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| API calls on login | 4 | 1 | -75% |
| Network latency | 800ms | 200ms | -75% |
| Duplicate data | ~2KB | 0 | -100% |
| Time to Interactive | ~2s | ~1.2s | -40% |

---

## References

- [SWR Documentation](https://swr.vercel.app/)
- [Next.js Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
- [errgroup Package](https://pkg.go.dev/golang.org/x/sync/errgroup)
