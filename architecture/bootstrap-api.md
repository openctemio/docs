---
layout: default
title: Bootstrap API
parent: Architecture
nav_order: 28
---

# Bootstrap API

> **Status**: Implemented
> **Version**: v1.0
> **Completed**: 2026-01-26

## Overview

The Bootstrap API consolidates multiple initial API calls after login into a single endpoint, reducing network latency by ~75% and improving Time to Interactive by ~40%.

## Problem

After login, the frontend made 4+ sequential API calls in a waterfall pattern:

```
Login Complete
  ├── GET /me/permissions/sync     (~200ms)
  ├── GET /me/subscription         (~200ms)
  ├── GET /me/modules              (~200ms)
  └── GET /dashboard/stats         (~200ms)
                                   ────────
                               Total: ~800ms
```

Issues:
- **Sequential waterfall** — Each call waited for the previous one
- **Duplicate data** — ~2KB duplicated across responses (subscription includes modules)
- **18+ requests** total on page load including dependent calls

## Solution

Single `GET /api/v1/me/bootstrap` endpoint that fetches all data concurrently on the server side using Go's `errgroup`.

```
Login Complete
  └── GET /me/bootstrap            (~200ms, all data concurrent)
                                   ────────
                               Total: ~200ms
```

## Architecture

### Backend

```
┌──────────────────────────────────────────────────────────────────┐
│                    Bootstrap Handler                              │
│                                                                   │
│   errgroup.WithContext(ctx)                                       │
│   ┌──────────────────┐  ┌──────────────────┐                    │
│   │ permissionService │  │ licensingService  │   concurrent      │
│   │   .SyncPerms()   │  │ .GetSubscription()│   goroutines      │
│   └────────┬─────────┘  └────────┬─────────┘                    │
│            │                      │                               │
│   ┌────────┴─────────┐  ┌────────┴─────────┐                    │
│   │  modulesService   │  │ dashboardService  │   (optional)      │
│   │  .GetModules()   │  │ .GetStats()       │                    │
│   └────────┬─────────┘  └────────┬─────────┘                    │
│            │                      │                               │
│            └──────────┬───────────┘                               │
│                       ▼                                           │
│              BootstrapResponse                                    │
│              (JSON, single response)                              │
└──────────────────────────────────────────────────────────────────┘
```

### Frontend

```
┌──────────────────────────────────────────────────────────────┐
│                    Provider Hierarchy                          │
│                                                               │
│   TenantProvider                                              │
│     └── BootstrapProvider (fetches /me/bootstrap)            │
│           ├── PermissionProvider (reads from bootstrap)       │
│           ├── useTenantSubscription (reads from bootstrap)   │
│           └── useTenantModules (reads from bootstrap)        │
└──────────────────────────────────────────────────────────────┘
```

## API Reference

### GET /api/v1/me/bootstrap

Returns all user context data in a single response.

**Response:**

```json
{
  "permissions": {
    "permissions": ["findings:read", "scans:write", "..."],
    "version": 42
  },
  "subscription": {
    "plan": "enterprise",
    "status": "active",
    "billing_cycle": "annual",
    "features": ["ai_triage", "platform_agents"]
  },
  "modules": {
    "module_ids": ["discovery", "prioritization", "mobilization"],
    "modules": [
      {"id": "discovery", "name": "Discovery", "is_active": true}
    ],
    "event_types": ["finding.created", "scan.completed"]
  },
  "dashboard": {
    "total_findings": 1250,
    "critical": 12,
    "high": 45,
    "medium": 180,
    "low": 1013
  }
}
```

## Design Decisions

### Dashboard Data is Optional

Dashboard stats require additional database queries. They are only included when the user has `dashboard:read` permission. The frontend fetches dashboard data separately when needed.

### Graceful Degradation

Non-fatal errors (subscription service down, modules service unavailable) return partial data with defaults. Only permission sync failure is considered fatal (returns 500).

```go
// Non-fatal: return defaults
if err := g.Go(func() error {
    sub, err := h.licensingService.GetSubscription(ctx, tenantID)
    if err != nil {
        // Log warning, use default subscription
        return nil
    }
    // ...
}); err != nil { ... }
```

### Backward Compatible

Individual hooks (`useTenantSubscription`, `useTenantModules`) still work as direct API calls. If bootstrap fails, the frontend falls back to individual endpoints.

### Cache Strategy

- Bootstrap response cached for 1 minute (SWR `dedupingInterval`)
- Individual hooks can refresh independently without re-fetching the full bootstrap

## Performance Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| API calls on login | 4 | 1 | -75% |
| Network latency | ~800ms | ~200ms | -75% |
| Duplicate data | ~2KB | 0 | -100% |
| Time to Interactive | ~2s | ~1.2s | -40% |

## Key Files

| File | Description |
|------|-------------|
| `api/internal/infra/http/handler/bootstrap_handler.go` | Bootstrap endpoint handler |
| `api/internal/infra/http/routes/misc.go` | Route registration |
| `ui/src/context/bootstrap-provider.tsx` | Frontend provider with SWR |
| `ui/src/features/core/api/use-bootstrap.ts` | Bootstrap API hook |

## Related Documentation

- [SDK & API Integration](sdk-api-integration.md) - Agent authentication and ingest
- [Module Permission Filtering](module-permission-filtering.md) - Module access control
