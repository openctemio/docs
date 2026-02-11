# Platform Stats API for Tenants

**Created:** 2026-01-30
**Status:** TODO
**Priority:** P1
**Last Updated:** 2026-01-30

---

## Summary

The frontend `PlatformStatsCard` component needs a backend endpoint to fetch platform agent statistics for the current tenant. This RFC documents the required API endpoint.

---

## Current State

### Frontend (Completed)
- `PlatformStatsCard` component created
- `usePlatformStats()` hook implemented
- Endpoint defined: `GET /api/v1/platform/stats`
- Currently shows "Coming Soon" when API returns error

### Backend (Missing)
- No `GET /api/v1/platform/stats` endpoint for tenants
- Existing platform routes are for:
  - Agent registration/heartbeat
  - Job submission/claiming (tenant → platform)
  - Admin management

---

## Required API Endpoint

### `GET /api/v1/platform/stats`

**Authentication:** JWT token (tenant-scoped)

**Response:**
```json
{
  "enabled": true,
  "max_tier": "dedicated",
  "max_concurrent": 5,
  "max_queued": 10,
  "current_active": 2,
  "current_queued": 1,
  "available_slots": 3,
  "accessible_tiers": ["shared", "dedicated"],
  "tier_stats": {
    "shared": {
      "total_agents": 10,
      "online_agents": 8,
      "available_slots": 5
    },
    "dedicated": {
      "total_agents": 3,
      "online_agents": 3,
      "available_slots": 2
    },
    "premium": {
      "total_agents": 0,
      "online_agents": 0,
      "available_slots": 0
    }
  }
}
```

---

## Implementation Plan

### Step 1: Add Handler Method

**File:** `api/internal/infra/http/handler/platform_handler.go`

```go
// GetTenantStats returns platform agent statistics for the tenant
func (h *PlatformHandler) GetTenantStats(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    tenantID := middleware.GetTenantID(ctx)

    // Get tenant's plan to determine tier access
    tenant, err := h.tenantRepo.GetByID(ctx, tenantID)
    if err != nil {
        httputil.Error(w, err)
        return
    }

    // Get platform stats based on tenant's plan
    stats, err := h.platformService.GetTenantStats(ctx, tenantID, tenant.Plan)
    if err != nil {
        httputil.Error(w, err)
        return
    }

    httputil.JSON(w, http.StatusOK, stats)
}
```

### Step 2: Add Service Method

**File:** `api/internal/app/platform_service.go`

```go
type TenantPlatformStats struct {
    Enabled         bool                       `json:"enabled"`
    MaxTier         string                     `json:"max_tier"`
    MaxConcurrent   int                        `json:"max_concurrent"`
    MaxQueued       int                        `json:"max_queued"`
    CurrentActive   int                        `json:"current_active"`
    CurrentQueued   int                        `json:"current_queued"`
    AvailableSlots  int                        `json:"available_slots"`
    AccessibleTiers []string                   `json:"accessible_tiers"`
    TierStats       map[string]TierStats       `json:"tier_stats"`
}

type TierStats struct {
    TotalAgents     int `json:"total_agents"`
    OnlineAgents    int `json:"online_agents"`
    AvailableSlots  int `json:"available_slots"`
}

func (s *PlatformService) GetTenantStats(ctx context.Context, tenantID uuid.UUID, plan string) (*TenantPlatformStats, error) {
    // Determine access based on plan
    tierConfig := s.getTierConfigForPlan(plan)

    // Get current job counts
    activeJobs, err := s.jobRepo.CountActiveByTenant(ctx, tenantID)
    if err != nil {
        return nil, err
    }

    queuedJobs, err := s.jobRepo.CountQueuedByTenant(ctx, tenantID)
    if err != nil {
        return nil, err
    }

    // Get agent stats by tier
    tierStats := make(map[string]TierStats)
    for _, tier := range []string{"shared", "dedicated", "premium"} {
        stats, err := s.agentRepo.GetTierStats(ctx, tier)
        if err != nil {
            return nil, err
        }
        tierStats[tier] = TierStats{
            TotalAgents:    stats.Total,
            OnlineAgents:   stats.Online,
            AvailableSlots: stats.Available,
        }
    }

    available := tierConfig.MaxConcurrent - activeJobs
    if available < 0 {
        available = 0
    }

    return &TenantPlatformStats{
        Enabled:         tierConfig.Enabled,
        MaxTier:         tierConfig.MaxTier,
        MaxConcurrent:   tierConfig.MaxConcurrent,
        MaxQueued:       tierConfig.MaxQueued,
        CurrentActive:   activeJobs,
        CurrentQueued:   queuedJobs,
        AvailableSlots:  available,
        AccessibleTiers: tierConfig.AccessibleTiers,
        TierStats:       tierStats,
    }, nil
}
```

### Step 3: Register Route

**File:** `api/internal/infra/http/routes/platform.go`

```go
// Add to registerPlatformJobRoutes or create new function
func registerPlatformTenantRoutes(
    router Router,
    h *handler.PlatformHandler,
    authMiddleware Middleware,
    userSyncMiddleware Middleware,
) {
    tenantMiddlewares := buildTokenTenantMiddlewares(authMiddleware, userSyncMiddleware)

    router.Group("/api/v1/platform", func(r Router) {
        r.GET("/stats", h.GetTenantStats, middleware.Require(permission.ScansRead))
    }, tenantMiddlewares...)
}
```

---

## Tier Configuration by Plan

| Plan | Enabled | Max Tier | Max Concurrent | Max Queued | Accessible Tiers |
|------|---------|----------|----------------|------------|------------------|
| free | false | - | 0 | 0 | [] |
| starter | true | shared | 2 | 5 | [shared] |
| professional | true | dedicated | 5 | 10 | [shared, dedicated] |
| enterprise | true | premium | 10 | 20 | [shared, dedicated, premium] |

---

## Frontend Types (Already Defined)

**File:** `ui/src/lib/api/platform-types.ts`

```typescript
export interface PlatformStatsResponse {
  enabled: boolean
  max_tier: PlatformAgentTier
  max_concurrent: number
  max_queued: number
  current_active: number
  current_queued: number
  available_slots: number
  accessible_tiers: PlatformAgentTier[]
  tier_stats: Record<PlatformAgentTier, TierStats>
}

export interface TierStats {
  total_agents: number
  online_agents: number
  available_slots: number
}
```

---

## Testing

1. Test with different tenant plans (free, starter, pro, enterprise)
2. Test concurrent job limits
3. Test when no platform agents are online
4. Test tier stats aggregation

---

## Notes

- Frontend currently shows "Coming Soon" card when API fails
- After backend implementation, remove the graceful error handling
- Consider caching stats with short TTL (30s) to reduce DB load
