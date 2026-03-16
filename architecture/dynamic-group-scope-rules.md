# Dynamic Group Scope Rules

**Status:** Implemented (2026-03-16)

---

## Overview

Groups in Access Control support two methods of asset assignment:

1. **Manual assignment** — Admin explicitly assigns assets to a group (`source = 'manual'`)
2. **Dynamic scope rules** — Rules automatically assign assets based on tags or asset group membership (`source = 'scope_rule'`)

The system uses a **hybrid architecture**: event-driven hooks for real-time updates (< 1 second) + periodic reconciliation as a self-healing safety net (every 30 minutes).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  HOOK TYPE A: Asset Tag Changes — < 1 second                   │
│                                                                 │
│  AssetService.CreateAsset() ──┐                                 │
│  AssetService.UpdateAsset() ──┼─► goroutine ─► EvaluateAsset()  │
│  (only if tags changed)       │   (async)     (1 asset × N rules│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  HOOK TYPE B: Asset Group Membership Changes — < 1 second      │
│                                                                 │
│  AssetGroupService.AddAssetsToGroup() ──┐                       │
│  AssetGroupService.RemoveAssetsFromGroup()─► goroutine          │
│                                              │                  │
│  1. Find scope rules referencing this asset group               │
│  2. For each target group: ReconcileGroup()                     │
│  Complexity: O(affected_groups), NOT O(assets × rules)          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  SAFETY NET: Periodic Reconciliation — every 30 min            │
│                                                                 │
│  ScopeReconciliationController                                  │
│  ├─ Lists all tenants with active scope rules                   │
│  ├─ For each tenant, lists groups with active rules             │
│  └─ ReconcileGroup() for each (add new + remove stale)          │
│                                                                 │
│  Catches: missed events, crash recovery, bulk imports           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ON-DEMAND: Manual Reconciliation                               │
│  POST /api/v1/groups/{id}/reconcile                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Rule Types

### Tag Match (`tag_match`)

Assigns assets whose tags match the rule's `match_tags` array.

- **Match logic `any` (OR)**: Asset has at least one matching tag
- **Match logic `all` (AND)**: Asset has all matching tags
- Limits: max 10 tags per rule

### Asset Group Match (`asset_group_match`)

Assigns assets that belong to specified asset groups.

- `match_asset_group_ids`: Array of asset group UUIDs
- Cross-tenant validation enforced (all IDs must belong to same tenant)
- Limits: max 5 asset groups per rule

### Limits

- Max 20 rules per group
- Safety cap: 50,000 matching assets per rule
- Ownership types: `primary`, `secondary`, `stakeholder`, `informed`

---

## Database Schema

### Migration 000074: Core Tables

```sql
CREATE TABLE group_asset_scope_rules (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_type VARCHAR(30) NOT NULL,           -- 'tag_match' | 'asset_group_match'
    match_tags TEXT[] DEFAULT '{}',
    match_logic VARCHAR(5) DEFAULT 'any',     -- 'any' (OR) | 'all' (AND)
    match_asset_group_ids UUID[] DEFAULT '{}',
    ownership_type VARCHAR(50) NOT NULL DEFAULT 'secondary',
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, created_by UUID
);

-- Source tracking on asset_owners
ALTER TABLE asset_owners
    ADD COLUMN assignment_source VARCHAR(30) DEFAULT 'manual',
    ADD COLUMN scope_rule_id UUID REFERENCES group_asset_scope_rules(id);
```

### Migration 000087: Composite Indexes

Performance indexes for scope rule queries (tenant + active + group, asset group match lookup, etc.).

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/groups/{id}/scope-rules` | GET | List scope rules |
| `/api/v1/groups/{id}/scope-rules` | POST | Create scope rule + initial reconciliation |
| `/api/v1/groups/{id}/scope-rules/{ruleId}` | GET | Get scope rule |
| `/api/v1/groups/{id}/scope-rules/{ruleId}` | PUT | Update scope rule + re-reconcile |
| `/api/v1/groups/{id}/scope-rules/{ruleId}` | DELETE | Delete scope rule + cleanup |
| `/api/v1/groups/{id}/scope-rules/{ruleId}/preview` | GET | Preview matching assets (dry run) |
| `/api/v1/groups/{id}/reconcile` | POST | On-demand full reconciliation |

---

## Key Implementation Files

### Backend

| File | Purpose |
|------|---------|
| `pkg/domain/accesscontrol/scope_rule.go` | Domain entity with validation |
| `internal/app/scope_rule_service.go` | Business logic (CRUD, reconciliation, evaluation) |
| `internal/infra/postgres/access_control_repository.go` | Repository (scope rule queries) |
| `internal/infra/http/handler/scope_rule_handler.go` | HTTP endpoints |
| `internal/infra/controller/scope_reconciliation.go` | Background reconciliation controller |
| `internal/app/asset_service.go` | Hook Type A (tag change → EvaluateAsset) |
| `internal/app/asset_group_service.go` | Hook Type B (group change → ReconcileByAssetGroup) |
| `cmd/server/services.go` | Service wiring |
| `cmd/server/workers.go` | Controller registration |

### Frontend

| File | Purpose |
|------|---------|
| `ui/src/features/access-control/types/scope-rule.types.ts` | TypeScript types |
| `ui/src/features/access-control/api/use-scope-rules.ts` | SWR hooks |
| `ui/src/features/access-control/components/group-detail-sheet/scope-rules-tab.tsx` | Rules list UI |
| `ui/src/features/access-control/components/group-detail-sheet/scope-rule-dialog.tsx` | Create/edit dialog |

### Tests

| File | Coverage |
|------|----------|
| `tests/unit/scope_rule_service_test.go` | Service CRUD, reconciliation, evaluation (1,409 lines) |
| `tests/unit/scope_rule_hooks_test.go` | Hook tests, tagsEqual helper (486 lines) |
| `tests/unit/scope_reconciliation_controller_test.go` | Controller tests (373 lines) |

---

## Service Wiring

```go
// services.go
s.ScopeRule = app.NewScopeRuleService(repos.AccessControl, repos.Group, log)
s.Asset.SetScopeRuleEvaluator(s.ScopeRule.EvaluateAsset)
s.AssetGroup.SetScopeRuleReconciler(s.ScopeRule.ReconcileByAssetGroup)

// workers.go
w.ControllerManager.Register(controller.NewScopeReconciliationController(
    repos.AccessControl, svc.ScopeRule,
    &controller.ScopeReconciliationControllerConfig{
        Interval: 30 * time.Minute,
    },
))
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Hybrid: event-driven + periodic | Real-time access control is critical; periodic-only has unacceptable delay |
| Two hook strategies | Tag changes → EvaluateAsset (O(1×rules)). Asset group changes → ReconcileGroup (O(groups)) |
| Async goroutines | Non-blocking to HTTP response; follows existing callback pattern |
| 30-minute controller interval | Safety net only, not primary mechanism |
| Manual assignments protected | Only `source='scope_rule'` entries are managed; `manual` entries never touched |
| Safety cap at 50K assets | Prevents runaway queries from overly broad rules |
| `ON CONFLICT DO NOTHING` | Concurrent goroutines won't cause duplicates |
| Panic recovery in goroutines | One bad evaluation must not crash the server |

---

## Data Flow Examples

### Asset tagged "production" → auto-assigned to Security Team

```
PUT /api/v1/assets/{id} { "tags": ["production", "web"] }
  → AssetService.UpdateAsset() detects tag change
  → Spawns goroutine (async, HTTP responds immediately)
  → EvaluateAsset() finds matching rule: tag_match "production" → Security Team
  → BulkCreateAssetOwnersWithSource() (source='scope_rule')
  → Result: Asset accessible to Security Team in < 1 second
```

### Asset loses "production" tag → auto-removed

```
PUT /api/v1/assets/{id} { "tags": ["staging"] }
  → EvaluateAsset() finds no matching rules
  → Current auto-assigned: [Security Team], Expected: []
  → DeleteAutoAssignedForAsset() removes stale entry
  → Result: Asset removed from Security Team in < 1 second
```

### Manual assignment is protected

```
POST /api/v1/groups/{id}/assets { "asset_id": "..." }
  → Creates asset_owner with source='manual'
  → Controller/hooks see source='manual' → SKIP
  → Manual assignments are permanent
```

---

## References

- [CrowdStrike Falcon Policy Management](https://www.crowdstrike.com/blog/tech-center/policy-management-remote-systems/)
- [Azure Entra ID Dynamic Groups](https://learn.microsoft.com/en-us/azure/active-directory/enterprise-users/groups-dynamic-membership)
- [Kubernetes Labels & Selectors](https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/)
- Related RFCs: `2026-01-21-group-access-control.md`, `2026-03-12-asset-ownership.md`
