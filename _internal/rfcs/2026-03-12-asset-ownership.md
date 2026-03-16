# Asset Ownership — Wiring the Missing Layer

**Created:** 2026-03-12
**Status:** DONE (Layer 3 deferred)
**Priority:** P0
**Last Updated:** 2026-03-12

---

## Summary

Asset inventory has no way to identify who is responsible for an asset. When a vulnerability is found on Asset A, there's no mechanism to alert the responsible person or assign remediation tasks. The database infrastructure exists (`asset_owners` table, `assets.owner_id`) but is completely disconnected from the API and frontend. This RFC wires the existing infrastructure to API and UI layers.

---

## Problem Statement

1. **No accountability**: Assets exist in inventory without any responsible party
2. **Can't notify**: When `finding.created` fires, notification system has no way to target asset-specific recipients
3. **Can't assign**: Remediation tasks need a responsible person — currently requires manual lookup
4. **Data exists but is invisible**: `owner_id` is stored in DB, entity reads/writes it, but API and frontend completely ignore it

---

## Current State Analysis

### What EXISTS (DB + Domain + Repository — fully functional)

```
┌─────────────────────────────────────────────────────────────────┐
│ assets table                                                     │
│   owner_id UUID FK → users(id)           ← stored, never exposed│
│   regulatory_owner_id UUID FK → users(id) ← stored, never exposed│
├─────────────────────────────────────────────────────────────────┤
│ asset_owners table                                               │
│   asset_id UUID FK → assets(id)                                  │
│   group_id UUID FK → groups(id)          ← team ownership        │
│   user_id  UUID FK → users(id)           ← individual ownership  │
│   ownership_type: primary|secondary|stakeholder|informed         │
│   assigned_at, assigned_by                                       │
│   assignment_source: manual|rule                                 │
│   scope_rule_id UUID FK → group_asset_scope_rules(id)            │
├─────────────────────────────────────────────────────────────────┤
│ Constraints (migration 000060):                                  │
│   UNIQUE(asset_id, group_id) WHERE group_id IS NOT NULL          │
│   UNIQUE(asset_id, user_id)  WHERE user_id  IS NOT NULL          │
│   CHECK: group_id IS NOT NULL OR user_id IS NOT NULL             │
└─────────────────────────────────────────────────────────────────┘
```

**Domain entity** (`pkg/domain/asset/entity.go`):
- `ownerID *shared.ID` — getter/setter exist (lines 501-554)
- `regulatoryOwnerID *shared.ID` — getter/setter exist (lines 765-774)

**Repository** (`internal/infra/postgres/asset_repository.go`):
- `selectQuery()` includes `owner_id`, `regulatory_owner_id` (line 189, 200)
- `Create()` inserts `owner_id` (line 46)
- `Update()` updates `owner_id` (line 233)
- `reconstructAsset()` maps `ownerIDStr` parameter (line 1018)

### What's IMPLEMENTED (as of 2026-03-12)

**API Handler** (`internal/infra/http/handler/asset_handler.go`):
- ✅ `AssetResponse` includes `PrimaryOwner *OwnerBriefResponse` field
- ✅ `OwnerBriefResponse` struct (id, type, name, email)
- ✅ `toAssetResponse()` + `toOwnerBriefResponse()` + `batchFetchPrimaryOwners()`
- ✅ `List()` batch-fetches primary owners via `GetPrimaryOwnersByAssetIDs()` (single query per page)
- ✅ `Get()` fetches primary owner via `GetPrimaryOwnerBrief()`
- ✅ `SetAccessControlRepo()` wired in `handlers.go`
- ✅ Dedicated owner CRUD endpoints via `asset_owner_handler.go`

**API Handler** (`internal/infra/http/handler/asset_owner_handler.go`):
- ✅ `ListOwners` (GET `/api/v1/assets/{id}/owners`)
- ✅ `AddOwner` (POST `/api/v1/assets/{id}/owners`)
- ✅ `UpdateOwner` (PUT `/api/v1/assets/{id}/owners/{ownerID}`)
- ✅ `RemoveOwner` (DELETE `/api/v1/assets/{id}/owners/{ownerID}`)
- ✅ Routes wired in `routes/assets.go` with proper permissions

**Repository** (`internal/infra/postgres/access_control_repository.go`):
- ✅ `ListAssetOwnersWithNames()` — with user/group name resolution
- ✅ `GetPrimaryOwnerBrief()` — single asset primary owner
- ✅ `GetPrimaryOwnersByAssetIDs()` — batch query with `DISTINCT ON` + `ANY($1)`
- ✅ `RefreshAccessForDirectOwnerAdd()` / `RefreshAccessForDirectOwnerRemove()`

**Repository Interface** (`pkg/domain/accesscontrol/repository.go`):
- ✅ `GetPrimaryOwnerBrief`, `GetPrimaryOwnersByAssetIDs`
- ✅ `ListAssetOwnersWithNames`, `GetAssetOwnerByID`, `GetAssetOwnerByUser`
- ✅ `DeleteAssetOwnerByID`, `DeleteAssetOwnerByUser`
- ✅ `RefreshAccessForDirectOwnerAdd`, `RefreshAccessForDirectOwnerRemove`

**Migration** (`api/migrations/000083_asset_ownership_wiring.up.sql`):
- ✅ Added 'regulatory' to ownership_type CHECK constraint
- ✅ Fixed `refresh_user_accessible_assets()` to include direct user ownership (Path B)
- ✅ New incremental functions: `refresh_access_for_direct_owner_add/remove()`

**Frontend** (`ui/src/features/assets/`):
- ✅ `Asset` interface includes `primaryOwner?: OwnerBrief`
- ✅ `OwnershipType`, `AssetOwner`, `OwnerBrief`, `AddAssetOwnerInput`, `UpdateAssetOwnerInput` types
- ✅ `OWNERSHIP_TYPE_LABELS`, `OWNERSHIP_TYPE_COLORS` constants
- ✅ `BackendAsset` includes `primary_owner`, `transformAsset()` maps it
- ✅ `useAssetOwners()` SWR hook with `addAssetOwner`, `updateAssetOwner`, `removeAssetOwner`
- ✅ `AssetOwnersTab` component with full CRUD UI (add/edit/remove dialogs)
- ✅ Asset table: Owner column (User/Users icon + truncated name) — enabled by default
- ✅ API endpoints: `listOwners`, `addOwner`, `updateOwner`, `removeOwner`

### What's REMAINING

- ⏭ `CreateAssetInput` / `UpdateAssetInput`: NO owner fields (Phase 5c — skipped, owners managed via dedicated tab)
- ⏭ Asset form: NO owner selector (Phase 5c — skipped, owners managed via dedicated tab)
- 🔮 **Layer 3: Object-Level Permission**: Deferred — implement after ownership is fully validated in production

### Duplication Analysis — Design Decision

There are 2 places to store individual ownership:

| Mechanism | Location | Purpose |
|-----------|----------|---------|
| `assets.owner_id` | Column on asset | Quick access to primary individual owner |
| `asset_owners` (user_id, type=primary) | Separate table | Flexible multi-owner + team ownership |

**Decision: Use ONLY `asset_owners` as single source of truth.**

Rationale:
- `asset_owners` already supports both individual (`user_id`) and team (`group_id`) ownership
- `ownership_type` distinguishes primary/secondary/stakeholder/informed
- Using both creates sync issues — two sources of truth for the same data
- Adding `'regulatory'` to `ownership_type` replaces `assets.regulatory_owner_id`
- `asset_owners` has unique constraints, assignment tracking, scope rule linking
- One LEFT JOIN is acceptable query cost for consistency

**`assets.owner_id` and `assets.regulatory_owner_id` will be IGNORED (not dropped).** No migration to remove columns — they can remain as legacy fields. All new code reads/writes exclusively through `asset_owners`.

---

## Design Proposal

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      ASSET OWNERSHIP                          │
│                                                                │
│  Single Source of Truth: asset_owners table                    │
│                                                                │
│  ┌─────────────┐     ┌──────────────┐     ┌───────────────┐  │
│  │ Individual   │     │ Team         │     │ Regulatory    │  │
│  │ user_id=X    │     │ group_id=Y   │     │ user_id=Z     │  │
│  │ type=primary │     │ type=primary │     │ type=regulatory│  │
│  └─────────────┘     └──────────────┘     └───────────────┘  │
│                                                                │
│  Notification Flow:                                            │
│  finding.created → asset_id → asset_owners → user_ids →       │
│  notification_preferences → send (email/slack/teams)           │
└──────────────────────────────────────────────────────────────┘
```

### Ownership ↔ Permission Relationship (Critical Gap)

The system has 2 permission layers. Ownership interacts with **Layer 2 only**:

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: RBAC — "Does user have PERMISSION?"                 │
│                                                               │
│  middleware.Require(permission.AssetsRead)                    │
│  → Checks JWT permissions[] or isAdmin flag                  │
│  → 403 if no permission                                      │
│                                                               │
│  ⚠ Ownership does NOT affect Layer 1.                        │
│  Asset owner still needs Member+ role to have assets:write.  │
│  Viewer who is an owner can SEE but NOT edit.                │
└──────────────────────────────┬──────────────────────────────┘
                               │ passed
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Data Scope — "Which assets can user SEE?"           │
│                                                               │
│  3 paths to asset visibility:                                │
│                                                               │
│  Path A: Group membership (existing, working)                │
│    User ∈ group_members → group ∈ asset_owners(group_id)     │
│    → user sees asset                                         │
│                                                               │
│  Path B: Direct ownership (⚠ BROKEN — must fix)             │
│    User ∈ asset_owners(user_id) directly                     │
│    → user SHOULD see asset but currently DOES NOT             │
│    → refresh function only checks group_id, ignores user_id  │
│                                                               │
│  Path C: Admin/Owner bypass (existing, working)              │
│    isAdmin=true → sees ALL assets                            │
│                                                               │
│  Materialized in: user_accessible_assets table               │
└─────────────────────────────────────────────────────────────┘
```

**The Bug:** `refresh_user_accessible_assets()` (migration 000041) only resolves group-based ownership:

```sql
-- CURRENT (broken for direct user ownership):
SELECT gm.user_id, g.tenant_id, ao.asset_id, ao.ownership_type
FROM group_members gm
JOIN groups g ON g.id = gm.group_id
JOIN asset_owners ao ON ao.group_id = gm.group_id
-- ^^^ Only group_id path! Direct user_id in asset_owners is IGNORED
```

**The Fix** (included in Phase 1 migration):

```sql
-- FIXED: include BOTH paths
-- Path A: group-based access (existing)
SELECT gm.user_id, g.tenant_id, ao.asset_id, ao.ownership_type
FROM group_members gm
JOIN groups g ON g.id = gm.group_id AND g.is_active = TRUE
JOIN asset_owners ao ON ao.group_id = gm.group_id

UNION

-- Path B: direct user-based access (NEW)
SELECT ao.user_id, a.tenant_id, ao.asset_id, ao.ownership_type
FROM asset_owners ao
JOIN assets a ON a.id = ao.asset_id
WHERE ao.user_id IS NOT NULL
```

Also fix the 4 incremental refresh functions in migration 000071:
- `refresh_access_for_asset_assign()` — add direct user path
- `refresh_access_for_asset_unassign()` — remove direct user access
- `refresh_access_for_member_add()` — no change (group-only)
- `refresh_access_for_member_remove()` — no change (group-only)
- NEW: `refresh_access_for_direct_owner_add(asset_id, user_id)` — insert into user_accessible_assets
- NEW: `refresh_access_for_direct_owner_remove(asset_id, user_id)` — remove if no other path grants access

**Ownership ↔ Permission Matrix:**

| Scenario | Layer 1 (RBAC) | Layer 2 (Data Scope) | Result |
|----------|---------------|---------------------|--------|
| Member + group owns asset | assets:read,write ✅ | group path ✅ | Can see & edit |
| Member + direct owner | assets:read,write ✅ | direct path ✅ (after fix) | Can see & edit |
| Viewer + direct owner | assets:read only ✅ | direct path ✅ (after fix) | Can see, NOT edit |
| Member + NOT owner + NOT in group | assets:read,write ✅ | no path ❌ | Cannot see asset |
| Admin/Owner (any) | all permissions ✅ | bypass ✅ | Full access always |

### Phase 1: Database Migration ✅ DONE

**Migration (next available number): ownership type + access control fix**

```sql
-- 1. Add 'regulatory' to ownership_type CHECK constraint
ALTER TABLE asset_owners DROP CONSTRAINT IF EXISTS chk_ownership_type;
ALTER TABLE asset_owners ADD CONSTRAINT chk_ownership_type
    CHECK (ownership_type IN ('primary', 'secondary', 'stakeholder', 'informed', 'regulatory'));

-- 2. Fix refresh_user_accessible_assets to include direct user ownership
CREATE OR REPLACE FUNCTION refresh_user_accessible_assets()
RETURNS void AS $$
BEGIN
    DELETE FROM user_accessible_assets;
    INSERT INTO user_accessible_assets (user_id, tenant_id, asset_id, ownership_type)
    -- Path A: group-based access
    SELECT DISTINCT gm.user_id, g.tenant_id, ao.asset_id, ao.ownership_type
    FROM group_members gm
    JOIN groups g ON g.id = gm.group_id AND g.is_active = TRUE
    JOIN asset_owners ao ON ao.group_id = gm.group_id
    UNION
    -- Path B: direct user-based access
    SELECT DISTINCT ao.user_id, a.tenant_id, ao.asset_id, ao.ownership_type
    FROM asset_owners ao
    JOIN assets a ON a.id = ao.asset_id
    WHERE ao.user_id IS NOT NULL
    ON CONFLICT (user_id, tenant_id, asset_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 3. Incremental refresh: direct owner add
CREATE OR REPLACE FUNCTION refresh_access_for_direct_owner_add(
    p_asset_id UUID, p_user_id UUID, p_ownership_type VARCHAR
) RETURNS void AS $$
BEGIN
    INSERT INTO user_accessible_assets (user_id, tenant_id, asset_id, ownership_type)
    SELECT p_user_id, a.tenant_id, a.id, p_ownership_type
    FROM assets a WHERE a.id = p_asset_id
    ON CONFLICT (user_id, tenant_id, asset_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 4. Incremental refresh: direct owner remove
CREATE OR REPLACE FUNCTION refresh_access_for_direct_owner_remove(
    p_asset_id UUID, p_user_id UUID
) RETURNS void AS $$
BEGIN
    DELETE FROM user_accessible_assets uaa
    WHERE uaa.user_id = p_user_id AND uaa.asset_id = p_asset_id
      -- Only remove if no other path grants access
      AND NOT EXISTS (
          SELECT 1 FROM group_members gm
          JOIN groups g ON g.id = gm.group_id AND g.is_active = TRUE
          JOIN asset_owners ao ON ao.group_id = gm.group_id AND ao.asset_id = p_asset_id
          WHERE gm.user_id = p_user_id
      )
      AND NOT EXISTS (
          SELECT 1 FROM asset_owners ao
          WHERE ao.asset_id = p_asset_id AND ao.user_id = p_user_id
      );
END;
$$ LANGUAGE plpgsql;

-- 5. Refresh existing data
SELECT refresh_user_accessible_assets();
```

### Phase 2: Backend — Domain & Repository ✅ DONE

**2a. New entity: `pkg/domain/asset/owner.go`**

```go
type OwnershipType string

const (
    OwnershipPrimary     OwnershipType = "primary"
    OwnershipSecondary   OwnershipType = "secondary"
    OwnershipStakeholder OwnershipType = "stakeholder"
    OwnershipInformed    OwnershipType = "informed"
    OwnershipRegulatory  OwnershipType = "regulatory"
)

type AssetOwner struct {
    id              shared.ID
    assetID         shared.ID
    groupID         *shared.ID
    userID          *shared.ID
    ownershipType   OwnershipType
    assignedAt      time.Time
    assignedBy      *shared.ID
    assignmentSource string  // "manual" or "rule"
    scopeRuleID     *shared.ID
}
```

**2b. Repository interface: `pkg/domain/asset/repository.go`** (add methods)

```go
type OwnerRepository interface {
    ListByAssetID(ctx context.Context, tenantID, assetID shared.ID) ([]*AssetOwner, error)
    ListByUserID(ctx context.Context, tenantID, userID shared.ID) ([]*AssetOwner, error)
    ListByGroupID(ctx context.Context, tenantID, groupID shared.ID) ([]*AssetOwner, error)
    Add(ctx context.Context, tenantID shared.ID, owner *AssetOwner) error
    Remove(ctx context.Context, tenantID, ownerID shared.ID) error
    GetPrimaryOwner(ctx context.Context, tenantID, assetID shared.ID) (*AssetOwner, error)
}
```

**2c. Repository implementation: `internal/infra/postgres/asset_owner_repository.go`**

All queries MUST include tenant isolation via:
```sql
JOIN assets a ON a.id = ao.asset_id AND a.tenant_id = $1
```
(`asset_owners` has no `tenant_id` column — must JOIN through `assets`)

### Phase 3: Backend — API Handler ✅ DONE

**3a. Update `AssetResponse`** (asset_handler.go):

```go
type AssetResponse struct {
    // ... existing fields ...
    PrimaryOwner *AssetOwnerBrief `json:"primary_owner,omitempty"`
}

type AssetOwnerBrief struct {
    ID    string `json:"id"`
    Type  string `json:"type"`  // "user" or "group"
    Name  string `json:"name"`
    Email string `json:"email,omitempty"` // only for user type
}
```

**3b. Update `toAssetResponse()`**: LEFT JOIN to fetch primary owner in list query, or separate query in detail endpoint.

**3c. Add owner management endpoints:**

```
GET    /api/v1/assets/{id}/owners          → List all owners of an asset
POST   /api/v1/assets/{id}/owners          → Add owner (user or group)
DELETE /api/v1/assets/{id}/owners/{ownerID} → Remove owner
PUT    /api/v1/assets/{id}/owners/{ownerID} → Update ownership type
```

**Request/Response:**

```go
type AddAssetOwnerRequest struct {
    UserID        *string `json:"user_id" validate:"required_without=GroupID"`
    GroupID       *string `json:"group_id" validate:"required_without=UserID"`
    OwnershipType string  `json:"ownership_type" validate:"required,oneof=primary secondary stakeholder informed regulatory"`
}

type AssetOwnerResponse struct {
    ID              string    `json:"id"`
    UserID          *string   `json:"user_id,omitempty"`
    UserName        *string   `json:"user_name,omitempty"`
    UserEmail       *string   `json:"user_email,omitempty"`
    GroupID         *string   `json:"group_id,omitempty"`
    GroupName       *string   `json:"group_name,omitempty"`
    OwnershipType   string    `json:"ownership_type"`
    AssignedAt      time.Time `json:"assigned_at"`
    AssignedByName  *string   `json:"assigned_by_name,omitempty"`
}
```

**Permissions:**
- `assets:read` for GET
- `assets:write` for POST/PUT/DELETE

### Phase 4: Frontend — Types & API Hooks ✅ DONE

**4a. Update `Asset` interface** (asset.types.ts):

```typescript
export interface AssetOwnerBrief {
  id: string
  type: 'user' | 'group'
  name: string
  email?: string
}

export interface Asset {
  // ... existing fields ...
  primaryOwner?: AssetOwnerBrief
}
```

**4b. New API hooks** (`ui/src/features/assets/api/use-asset-owners.ts`):

```typescript
export function useAssetOwners(assetId: string) {
  return useSWR<AssetOwner[]>(`/api/v1/assets/${assetId}/owners`)
}

export function useAddAssetOwner(assetId: string) { ... }
export function useRemoveAssetOwner(assetId: string) { ... }
```

### Phase 5: Frontend — UI Components ✅ DONE (5a, 5b) / ⏭ SKIPPED (5c)

**5a. Asset table — Add owner column:**

```typescript
{
  accessorKey: 'primaryOwner',
  header: 'Owner',
  cell: ({ row }) => {
    const owner = row.original.primaryOwner
    if (!owner) return <span className="text-muted-foreground">Unassigned</span>
    return (
      <div className="flex items-center gap-2">
        <Avatar className="h-5 w-5">
          <AvatarFallback>{owner.name[0]}</AvatarFallback>
        </Avatar>
        <span className="truncate max-w-[120px]">{owner.name}</span>
      </div>
    )
  }
}
```

**5b. Asset detail sheet — Owners tab:**

New tab in `asset-detail-sheet.tsx` showing all owners with add/remove functionality:
- List all owners (user avatar + name + type badge)
- "Add Owner" button → dialog with member/group selector
- Remove button per owner (with confirmation)
- Ownership type selector (primary/secondary/stakeholder/informed/regulatory)

**5c. Asset form — Primary owner field:**

Add optional owner selector to create/edit forms using existing `useMembers()` hook.

### Phase 6: Notification Integration ✅ DONE (metadata enrichment)

**6a. Add owner-aware notification routing:**

When `finding.created` event fires for an asset:

```go
func (s *NotificationService) notifyAssetOwners(ctx context.Context, tenantID, assetID shared.ID, finding *Finding) error {
    owners, err := s.ownerRepo.ListByAssetID(ctx, tenantID, assetID)
    if err != nil {
        return err
    }

    for _, owner := range owners {
        if owner.UserID() != nil {
            // Send personal notification based on user's notification preferences
            s.sendUserNotification(ctx, *owner.UserID(), finding)
        }
        if owner.GroupID() != nil {
            // Send to group's configured channel (Slack, Teams, etc.)
            s.sendGroupNotification(ctx, *owner.GroupID(), finding)
        }
    }
    return nil
}
```

**6b. Update `BroadcastNotification` to include owner resolution** as optional enrichment.

---

## Implementation Order

| Step | Scope | Effort | Dependencies | Status |
|------|-------|--------|--------------|--------|
| 1. Migration (000083) | DB | Small | None | ✅ DONE |
| 2. Domain entity + repository interface | Backend | Medium | Step 1 | ✅ DONE |
| 3. API CRUD endpoints (asset_owner_handler) | Backend | Medium | Step 2 | ✅ DONE |
| 4. Update AssetResponse + batch query | Backend | Small | Step 2 | ✅ DONE |
| 5. Frontend types + hooks | Frontend | Small | Step 3 | ✅ DONE |
| 6. Owner column in asset table | Frontend | Small | Step 5 | ✅ DONE |
| 7. Owners tab in detail sheet | Frontend | Medium | Step 5 | ✅ DONE |
| 8. Owner field in create/edit form | Frontend | Small | Step 5 | ⏭ SKIPPED (owners managed via tab) |
| 9. Notification integration | Backend | Medium | Step 2 | ✅ DONE |

**Implementation notes:**
- Step 4 uses batch-fetch pattern (like repository extensions) instead of LEFT JOIN in selectQuery, avoiding changes to the 40+ column scan chain
- Step 8 skipped — owners are managed via the dedicated Owners tab, not inline in create/edit forms. Can be added later if needed.

---

## Query Performance

### Asset list with owner (most critical query)

```sql
SELECT a.*,
       ao_user.id as owner_id,
       u.display_name as owner_name,
       u.email as owner_email,
       ao_group.id as owner_group_id,
       g.name as owner_group_name
FROM assets a
LEFT JOIN asset_owners ao_user ON ao_user.asset_id = a.id
    AND ao_user.user_id IS NOT NULL
    AND ao_user.ownership_type = 'primary'
LEFT JOIN users u ON u.id = ao_user.user_id
LEFT JOIN asset_owners ao_group ON ao_group.asset_id = a.id
    AND ao_group.group_id IS NOT NULL
    AND ao_group.ownership_type = 'primary'
LEFT JOIN groups g ON g.id = ao_group.group_id
WHERE a.tenant_id = $1
ORDER BY a.created_at DESC
LIMIT $2 OFFSET $3
```

**Indexes already exist:**
- `idx_asset_owners_asset` on `asset_owners(asset_id)`
- `idx_uq_asset_owners_asset_user` unique on `(asset_id, user_id)`
- `idx_uq_asset_owners_asset_group` unique on `(asset_id, group_id)`

Performance impact: negligible — LEFT JOIN on indexed columns with unique constraint.

---

## Testing Strategy

### Unit Tests (TDD — write FIRST)

**Backend:**
1. `asset_owner_repository_test.go` — CRUD, tenant isolation, unique constraints
2. `asset_owner_service_test.go` — business logic, validation
3. `asset_handler_owners_test.go` — HTTP endpoints, permissions
4. `notification_owner_routing_test.go` — owner resolution for notifications

**Frontend:**
1. `use-asset-owners.test.ts` — hook behavior
2. Asset table owner column rendering
3. Owner management dialog interactions

### Key Test Cases

- Add user as primary owner → appears in asset list
- Add group as primary owner → appears in asset list
- Same user can't be added twice (unique constraint)
- Remove owner → no longer appears
- Tenant isolation: tenant A can't see tenant B's owners
- Asset deletion cascades to asset_owners (FK ON DELETE CASCADE)
- User deletion sets NULL (FK ON DELETE CASCADE on user_id)
- Group deletion sets NULL (FK ON DELETE CASCADE on group_id)
- List assets sorted by owner name
- Filter assets by "has owner" / "unassigned"

---

## Ownership vs Access vs Assignment — Three Distinct Concepts

A common question: "An asset has many devs working on it, but only 1-2 owners. How to distinguish?"

The answer: **three separate mechanisms for three separate concerns.**

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. OWNERSHIP (asset_owners)                                      │
│    "Who is ACCOUNTABLE for this asset?"                          │
│                                                                   │
│    primary    → Tech Lead / Asset Owner (auto-notified, all sev) │
│    secondary  → Senior Dev / Backup (notified critical+high)     │
│    stakeholder→ Manager / PM (notified critical only)            │
│    informed   → Team channel (no auto-notification)              │
│    regulatory → Compliance officer (regulatory alerts only)      │
│                                                                   │
│    Stored in: asset_owners table                                  │
│    Used for:  notification routing, accountability, reporting     │
└─────────────────────────────────────────────────────────────────┘
                              ↕ independent
┌─────────────────────────────────────────────────────────────────┐
│ 2. ACCESS (groups → asset_groups / asset_owners with group_id)   │
│    "Who can SEE and WORK on this asset?"                         │
│                                                                   │
│    User → Group → Assets (Layer 2 Data Scope)                    │
│    Dev joins "backend-team" group → sees all backend assets      │
│                                                                   │
│    Stored in: group_members + asset_groups / asset_owners        │
│    Used for:  data visibility, RBAC Layer 2                      │
└─────────────────────────────────────────────────────────────────┘
                              ↕ independent
┌─────────────────────────────────────────────────────────────────┐
│ 3. ASSIGNMENT (findings.assigned_to)                             │
│    "Who is FIXING this specific issue right now?"                │
│                                                                   │
│    Owner assigns finding to a dev → dev gets notified            │
│    Any user with access can be assigned                          │
│                                                                   │
│    Stored in: findings.assigned_to, assigned_at, assigned_by     │
│    Used for:  task tracking, SLA, remediation workflow           │
└─────────────────────────────────────────────────────────────────┘
```

### Example Scenario

Asset "api-gateway" — 10 devs, 2 owners:

```
asset_owners:
  Alice (user)      → type=primary      ← accountable, auto-notified
  Bob (user)        → type=secondary    ← backup, notified on critical/high
  backend-team (group) → type=informed  ← team knows about asset

group_members (backend-team):
  Alice, Bob, Charlie, Dave, Eve, Frank, Grace, Hank, Iris, Jack
  → All 10 can SEE the asset in inventory (Layer 2 access)

When CVE-2026-1234 found on api-gateway:
  1. Alice (primary owner)  → auto-notified immediately
  2. Bob (secondary owner)  → auto-notified (severity=critical)
  3. Alice assigns finding to Charlie → Charlie gets notification
  4. Charlie fixes it → marks finding as resolved
```

**Key insight: Devs do NOT need to be in `asset_owners`.** They access assets through group membership and receive notifications only when specifically assigned a finding.

---

## Industry Analysis: How Major Platforms Handle Asset-Level Permissions

### Pattern Comparison

| Pattern | Used By | Scope Mechanism | Fit for CTEM? |
|---------|---------|----------------|---------------|
| **A: Role + Tag/Scope** | Tenable, Qualys | Tags define asset boundary | **Best fit** — same domain |
| B: Project-Based | Wiz, Snyk | Project = scope boundary | Limited — asset locked to 1 project |
| C: Hierarchical Binding | AWS IAM, GCP IAM, K8s | Resource hierarchy + conditions | Too complex for CTEM |
| D: ReBAC (Zanzibar) | Google Drive, YouTube | Relationship graph traversal | Overkill — needs SpiceDB/OpenFGA |
| E: Ownership-Based | GitHub, ServiceNow | Owner role on resource | Too simple — doesn't scale |

### Pattern A: Role + Tag/Scope — Industry Standard for Security Platforms

**Tenable Vulnerability Management:**
- **Roles** = what actions: Can View, Can Scan, Can Edit, Can Use
- **Permissions** = which data via Tags: user/group gets permission config scoped to tagged assets
- Admin bypasses all restrictions
- Source: [Tenable Permissions Docs](https://docs.tenable.com/vulnerability-management/Content/Settings/access-control/Permissions.htm)

**Qualys (Tag-Based User Scoping — TBUS):**
- Manager assigns **tags** to each user → user's scope = union of all tag matches
- Static tags (manual), Dynamic tags (auto-match criteria), Asset Group tags, Business Unit tags
- Coexists with legacy Asset Group model
- Source: [Qualys TBUS](https://qualysguard.qg2.apps.qualys.com/qwebhelp/fo_portal/tbus/tag_based_user_scoping.htm)

### Pattern B: Project-Based — Cloud Security Platforms

**Wiz:**
- Projects group cloud resources by ownership/business purpose
- Custom roles scoped per-project
- Source: [Wiz Custom Roles](https://www.wiz.io/blog/cloud-security-custom-roles-democratization)

**Snyk:**
- Hierarchy: Group → Organization → Project
- Custom RBAC at each level (Enterprise plan)
- Source: [Snyk User Roles](https://docs.snyk.io/snyk-platform-administration/user-roles)

### Pattern C: Hierarchical — Cloud Infrastructure

**AWS IAM:**
- Identity-based policies (attached to user/role) + Resource-based policies (attached to resource)
- Evaluation = union. Supports ABAC via resource tags in conditions
- Source: [AWS IAM Policies](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_identity-vs-resource.html)

**GCP IAM:**
- Org → Folder → Project → Resource hierarchy
- Role bindings with IAM Conditions for attribute-based filtering
- Inheritance flows down
- Source: [GCP IAM Overview](https://docs.cloud.google.com/iam/docs/overview)

**Kubernetes:**
- Role (namespaced) + ClusterRole (global)
- RoleBinding: (user, role, namespace). Namespace = scope boundary
- Source: [K8s RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)

### Pattern D: ReBAC — Google-Scale Authorization

**Google Zanzibar / SpiceDB:**
- Relationship tuples: (user, relation, object)
- Permission check = graph traversal
- Can model ALL other patterns (RBAC, ABAC, ownership)
- 10M+ queries/sec, <10ms latency
- Requires dedicated infrastructure (SpiceDB, OpenFGA)
- Source: [Zanzibar Paper](https://research.google/pubs/zanzibar-googles-consistent-global-authorization-system/), [SpiceDB](https://authzed.com/docs/spicedb/concepts/zanzibar)

### Pattern E: Ownership-Based — Simple Platforms

**GitHub:** Org → Team → Repository roles (Read/Triage/Write/Maintain/Admin). CODEOWNERS for file-level.
**ServiceNow CMDB:** CI Owner (full edit) / CI User (limited) / Config Manager (all CIs).
Source: [GitHub Roles](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization)

### Conclusion: OpenCTEM Already Implements Pattern A

Direct mapping between OpenCTEM's existing infrastructure and the Tenable/Qualys model:

| Concept | Tenable | Qualys | OpenCTEM (exists, needs wiring) |
|---------|---------|--------|-------------------------------|
| Role = actions | Can View/Scan/Edit/Use | Manager/Reader/etc | `permission.go`: AssetsRead/Write/Delete |
| Scope = data boundary | Tags on assets | Tags assigned to users (TBUS) | `ScopeType`: owned_assets, asset_type, asset_tags |
| Scope assignment | Permission config → user/group | Manager assigns tags → user | `GroupPermission`: group_id + scope_type + scope_value |
| Dynamic scope | Dynamic tags | Dynamic tags | `ScopeRule`: tag_match, asset_group_match |
| Admin bypass | Admin sees all | Manager sees all | `isAdmin=true` bypasses Layer 2+3 |

**No architecture change needed. No new pattern. Just wire the existing code.**

Why NOT Zanzibar/ReBAC now:
- Needs SpiceDB/OpenFGA — additional infrastructure
- OpenCTEM handles thousands of assets, not billions — PostgreSQL is sufficient
- Migration effort: weeks vs days
- Can always migrate later if scale demands it

---

## Layer 3: Object-Level Permission (Future-Ready Design)

### Problem

Currently, if a user has `assets:delete` permission (Layer 1), they can delete **any** asset they can see (Layer 2). There's no way to say "dev can only delete assets they own."

```
CURRENT (no Layer 3):
  Layer 1: Member has assets:delete → ✅
  Layer 2: User can see asset-X   → ✅
  Result: User can delete asset-X → ✅ (even if not owner!)

DESIRED (with Layer 3):
  Layer 1: Member has assets:delete → ✅
  Layer 2: User can see asset-X   → ✅
  Layer 3: User is owner of asset-X? → ❌
  Result: User CANNOT delete asset-X → ❌
```

### Approach Evaluation

| # | Approach | Verdict | Reason |
|---|----------|---------|--------|
| 1 | Check ownership in each service method | ❌ Rejected | Copy-paste across 20+ methods. Easy to forget. DRY violation |
| 2 | Middleware-level ownership check | ❌ Rejected | Middleware must parse asset_id from URL (varies per route). Couples HTTP layer to domain. Wrong abstraction level |
| 3 | New "Capability" abstraction | ❌ Rejected | Over-engineering. New concept, new mapping table, new resolver — for a problem solvable with existing infrastructure |
| 4 | **Use existing GroupPermission + ScopeType** | ✅ Chosen | Zero new tables. Uses `group_permissions` + `ScopeOwnedAssets` already defined in codebase. Opt-in — no breaking change |

### Why Approach 4 wins: Everything already exists

The codebase already defines all the building blocks:

```go
// pkg/domain/accesscontrol/entity.go — ALREADY EXISTS
type ScopeType string
const (
    ScopeAll         ScopeType = "all"
    ScopeOwnedAssets ScopeType = "owned_assets"  // ← THIS
    ScopeAssetType   ScopeType = "asset_type"
    ScopeAssetTags   ScopeType = "asset_tags"
)

// GroupPermission — ALREADY EXISTS
type GroupPermission struct {
    groupID      shared.ID
    permissionID string           // e.g., "assets:delete"
    effect       PermissionEffect // allow | deny
    scopeType    *ScopeType       // e.g., ScopeOwnedAssets
    scopeValue   *ScopeValue
}

// group_permissions table — ALREADY EXISTS (migration 000041)
// PermissionResolver — ALREADY EXISTS (resolver.go)
```

**No new migration. No new table. No new middleware. No new abstraction.**

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ Full Authorization Flow (3 Layers)                           │
│                                                               │
│ Request: DELETE /assets/{id}                                 │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ Layer 1: RBAC (Middleware)                               │  │
│ │ HasPermission("assets:delete") → check JWT permissions   │  │
│ │ Admin/Owner → bypass ALL ✅                              │  │
│ │ Member with assets:delete → ✅ proceed                   │  │
│ │ Viewer → ❌ 403 Forbidden (stop here)                    │  │
│ └───────────────────────────┬─────────────────────────────┘  │
│                             │ passed                          │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ Layer 2: Data Scope (Service)                            │  │
│ │ CanAccessAsset(userID, assetID)                          │  │
│ │ → Check user_accessible_assets table                     │  │
│ │ → User can see this asset? ✅ proceed                    │  │
│ │ → Cannot see? → ❌ 404 Not Found (stop here)             │  │
│ └───────────────────────────┬─────────────────────────────┘  │
│                             │ passed                          │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ Layer 3: Object Permission (Service) — NEW              │  │
│ │ AuthorizeAssetAction(userID, assetID, "assets:delete")  │  │
│ │                                                          │  │
│ │ Step 1: Query group_permissions for this action          │  │
│ │   SELECT effect, scope_type FROM group_permissions gp    │  │
│ │   JOIN group_members gm ON gm.group_id = gp.group_id    │  │
│ │   WHERE gm.user_id = ? AND gp.permission_id = ?         │  │
│ │                                                          │  │
│ │ Step 2: Evaluate                                         │  │
│ │   No rows found?                                         │  │
│ │     → No restriction configured → ✅ ALLOW (opt-in)     │  │
│ │   Any row has effect=deny?                               │  │
│ │     → ❌ DENY (explicit deny wins)                       │  │
│ │   Row has scope=all?                                     │  │
│ │     → ✅ ALLOW (unrestricted)                            │  │
│ │   Row has scope=owned_assets?                            │  │
│ │     → Check asset_owners for this user+asset             │  │
│ │     → Is primary/secondary owner? → ✅ ALLOW             │  │
│ │     → Not owner? → ❌ DENY                               │  │
│ │   Row has scope=asset_type, value="domain"?              │  │
│ │     → Check asset.type == "domain"? → ✅ or ❌           │  │
│ │   Row has scope=asset_tags, value="production"?          │  │
│ │     → Check "production" ∈ asset.tags? → ✅ or ❌        │  │
│ └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Principle: Opt-In

**When admin has NOT configured any `group_permissions` → system behaves exactly as today.** Layer 3 only activates when admin explicitly sets scope restrictions.

| group_permissions configured? | Behavior |
|------------------------------|----------|
| No rows for "assets:delete" | Layer 1 decides. Current behavior. No breaking change |
| `effect=allow, scope=all` | Same as current — all visible assets can be deleted |
| `effect=allow, scope=owned_assets` | **Restricted** — only owned assets |
| `effect=allow, scope=asset_type, value=domain` | **Restricted** — only domain-type assets |
| `effect=deny` | **Blocked** — group members cannot delete any asset |

### Real-World Example

Admin wants: "Backend team members can edit all their visible assets, but can only DELETE assets they own."

```sql
-- Configure via API or admin UI:
INSERT INTO group_permissions (group_id, permission_id, effect, scope_type)
VALUES
  -- No restriction on edit (don't insert = fall back to Layer 1)
  -- Restrict delete to owned assets only:
  ('backend-team-id', 'assets:delete', 'allow', 'owned_assets');
```

Result:
```
Charlie (member of backend-team):
  Edit asset-X (not owner)   → Layer 1 ✅, Layer 2 ✅, Layer 3: no restriction → ✅
  Delete asset-X (not owner) → Layer 1 ✅, Layer 2 ✅, Layer 3: scope=owned → ❌
  Delete asset-Y (is owner)  → Layer 1 ✅, Layer 2 ✅, Layer 3: scope=owned → ✅
```

### Implementation — 3 Changes Only

**Change 1: Repository** — Add `AuthorizeAssetAction` to `accesscontrol.Repository`

```go
// accesscontrol/repository.go — add to interface
AuthorizeAssetAction(ctx context.Context, userID, assetID shared.ID, action string) error

// access_control_repository.go — implementation
func (r *Repo) AuthorizeAssetAction(ctx context.Context, userID, assetID shared.ID, action string) error {
    // 1. Query group_permissions for user's groups + this action
    // 2. No rows → return nil (no restriction)
    // 3. Any deny → return ErrForbidden
    // 4. scope=all → return nil
    // 5. scope=owned_assets → query asset_owners → found? nil : ErrForbidden
    // 6. scope=asset_type → query asset.type → match? nil : ErrForbidden
    // 7. scope=asset_tags → query asset.tags → overlap? nil : ErrForbidden
}
```

**Change 2: Service** — Pass `actingUserID` + `isAdmin`, call authorize

```go
// asset_service.go — update signatures (currently missing actingUserID)
func (s *AssetService) DeleteAsset(ctx, assetID, tenantID, actingUserID string, isAdmin bool) error {
    // ... existing code ...

    // Layer 3 (opt-in)
    if !isAdmin && s.accessControlRepo != nil && actingUserID != "" {
        uid, _ := shared.IDFromString(actingUserID)
        if err := s.accessControlRepo.AuthorizeAssetAction(ctx, uid, parsedID, "assets:delete"); err != nil {
            return err
        }
    }

    // ... existing delete logic unchanged ...
}
```

**Change 3: Handler** — Extract user context (currently missing for mutations)

```go
// asset_handler.go — add 2 lines to Delete, Update, etc.
func (h *AssetHandler) Delete(w http.ResponseWriter, r *http.Request) {
    tenantID := middleware.MustGetTenantID(r.Context())
    userID := middleware.GetUserID(r.Context())   // ← add
    isAdmin := middleware.IsAdmin(r.Context())     // ← add
    id := r.PathValue("id")

    if err := h.service.DeleteAsset(r.Context(), id, tenantID, userID, isAdmin); err != nil {
        // ...
    }
}
```

### Scope Types Already Supported

| ScopeType | Meaning | Use Case |
|-----------|---------|----------|
| `all` | No restriction | "Team can delete any asset" |
| `owned_assets` | Only assets user/group owns | "Team can only delete their own assets" |
| `asset_type` | Only specific asset types | "Team can only delete domains" |
| `asset_tags` | Only assets with specific tags | "Team can only delete staging assets" |

### Implementation Timeline

This is **NOT part of the initial ownership wiring** (Phases 1-9 above). It should be implemented AFTER ownership is fully wired and working. Estimated as a separate follow-up:

| Step | Change | Effort |
|------|--------|--------|
| 1 | `AuthorizeAssetAction` in repository | Medium |
| 2 | Update service signatures (actingUserID, isAdmin) | Small |
| 3 | Update handler calls | Small |
| 4 | Admin UI for group_permissions management | Medium |
| 5 | Test coverage | Medium |

---

## What This RFC Does NOT Cover

- **Unregistered owners**: All owners must have accounts. For external stakeholders, use the invite flow to create accounts first.
- **Auto-assignment rules**: `assignment_rules` table already exists — wiring it to `asset_owners` is a separate effort.
- **Dropping `assets.owner_id`**: Column remains but is ignored. Removal is a future cleanup task.

---

## References

- DB Schema: `api/migrations/000008_assets.up.sql` (asset_owners table)
- Constraints: `api/migrations/000060_schema_fixes.up.sql` (unique indexes, CHECK)
- Scope rules: `api/migrations/000074_group_asset_scope_rules.up.sql` (assignment_source)
- Domain entity: `api/pkg/domain/asset/entity.go` (ownerID field)
- Repository: `api/internal/infra/postgres/asset_repository.go` (owner_id in queries)
- API Handler: `api/internal/infra/http/handler/asset_handler.go` (AssetResponse — missing owner)
- Frontend types: `ui/src/features/assets/types/asset.types.ts` (Asset — missing owner)
- Notification: `api/internal/app/integration_service.go` (BroadcastNotification)
- Access control: `api/migrations/000071_incremental_access_refresh.up.sql` (uses asset_owners for access)
