# RFC: Campaign Team Roles & RBAC

**Created:** 2026-03-17
**Status:** PLANNED
**Priority:** P1 (Security + UX)
**Scope:** Per-campaign role-based access control for pentest team members

---

## Problem

Current state:
- `team_user_ids UUID[]` — flat list, no roles
- `lead_user_id UUID` — single lead
- Any user with `pentest:campaigns:read` permission sees ALL campaigns
- Any team member can do anything (create/edit/delete findings, change status, generate reports)

This means:
1. A tester can delete findings created by another tester
2. A tester can change campaign status to completed
3. No peer review enforcement (tester can confirm own findings)
4. Observers (managers, clients) can modify data
5. No visibility isolation between campaigns

---

## Solution

### 4 Campaign Roles

| Role | Purpose | Who |
|------|---------|-----|
| **lead** | Full control, project owner | Senior pentester, engagement manager |
| **tester** | Create and manage own findings | Pentesters doing the work |
| **reviewer** | Quality assurance, verify findings | Senior pentesters, QA |
| **observer** | Read-only access | Managers, client contacts, stakeholders |

### Permission Matrix

| Action | Lead | Tester | Reviewer | Observer |
|--------|:----:|:------:|:--------:|:--------:|
| **Campaign** | | | | |
| View campaign details | Y | Y | Y | Y |
| Edit campaign (name, description, dates) | Y | - | - | - |
| Change campaign status | Y | - | - | - |
| Manage scope & RoE | Y | - | - | - |
| Manage team members | Y | - | - | - |
| Delete campaign | Y | - | - | - |
| **Findings** | | | | |
| View all findings | Y | Y | Y | Y |
| Create findings | Y | Y | - | - |
| Edit own findings | Y | Y | - | - |
| Edit any finding | Y | - | - | - |
| Delete own findings | Y | Y | - | - |
| Delete any finding | Y | - | - | - |
| draft → in_review | Y | Y* | - | - |
| in_review → confirmed | Y | - | Y | - |
| confirmed → remediation/retest | Y | Y | Y | - |
| → false_positive / accepted_risk | Y | - | Y | - |
| → verified (from retest) | Y | - | Y | - |
| **Retests** | | | | |
| Submit retests | Y | Y | Y | - |
| **Reports** | | | | |
| View reports | Y | Y | Y | Y |
| Generate reports | Y | - | - | - |
| Delete reports | Y | - | - | - |
| **Evidence** | | | | |
| Upload evidence | Y | Y | Y | - |
| Delete own evidence | Y | Y | - | - |
| Delete any evidence | Y | - | - | - |

*Y = tester can only submit own findings for review

### Visibility Rules

| System Role | Campaign Visibility |
|------------|-------------------|
| Owner / Admin | All campaigns (bypass team check) |
| Member / Viewer | Only campaigns where user is in `pentest_campaign_members` |

---

## Database Design

### New Table: `pentest_campaign_members`

```sql
CREATE TABLE pentest_campaign_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES pentest_campaigns(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(20) NOT NULL DEFAULT 'tester',
    added_by    UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(campaign_id, user_id)
);

CREATE INDEX idx_pcm_campaign ON pentest_campaign_members(campaign_id);
CREATE INDEX idx_pcm_user ON pentest_campaign_members(user_id);
CREATE INDEX idx_pcm_user_role ON pentest_campaign_members(user_id, role);
```

Valid roles: `lead`, `tester`, `reviewer`, `observer`

### Migration Strategy

```sql
-- Migrate existing data from team_user_ids + lead_user_id
INSERT INTO pentest_campaign_members (campaign_id, user_id, role)
SELECT c.id, unnest(c.team_user_ids), 'tester'
FROM pentest_campaigns c
WHERE c.team_user_ids IS NOT NULL AND array_length(c.team_user_ids, 1) > 0
ON CONFLICT (campaign_id, user_id) DO NOTHING;

-- Set lead role for existing leads
UPDATE pentest_campaign_members pcm
SET role = 'lead'
FROM pentest_campaigns c
WHERE pcm.campaign_id = c.id AND pcm.user_id = c.lead_user_id;

-- Keep team_user_ids and lead_user_id columns for backward compat
-- Mark as deprecated via COMMENT
COMMENT ON COLUMN pentest_campaigns.team_user_ids IS 'DEPRECATED: Use pentest_campaign_members table';
COMMENT ON COLUMN pentest_campaigns.lead_user_id IS 'DEPRECATED: Use pentest_campaign_members table with role=lead';
```

### API Response Change

Campaign response adds `team_members` with role info (already partially implemented):

```json
{
  "team_members": [
    { "id": "uuid", "name": "Admin User", "email": "admin@openctem.io", "role": "lead" },
    { "id": "uuid", "name": "John Tester", "email": "john@company.com", "role": "tester" }
  ]
}
```

---

## Service Layer Design

### Campaign Member Service Methods

```go
type CampaignMemberInput struct {
    CampaignID string
    UserID     string
    Role       string // lead, tester, reviewer, observer
}

// CRUD
AddCampaignMember(ctx, tenantID string, input CampaignMemberInput) error
RemoveCampaignMember(ctx, tenantID, campaignID, userID string) error
UpdateCampaignMemberRole(ctx, tenantID, campaignID, userID, newRole string) error
ListCampaignMembers(ctx, tenantID, campaignID string) ([]CampaignMember, error)

// Auth checks
GetUserCampaignRole(ctx, tenantID, campaignID, userID string) (string, error)
RequireCampaignRole(ctx, tenantID, campaignID, userID string, roles ...string) error
```

### Authorization Helper

```go
func (s *PentestService) requireCampaignAccess(ctx context.Context, tenantID, campaignID, userID string, requiredRoles ...string) error {
    // Admin/Owner bypass
    if middleware.IsAdmin(ctx) {
        return nil
    }
    role, err := s.memberRepo.GetUserRole(ctx, tenantID, campaignID, userID)
    if err != nil {
        return fmt.Errorf("%w: not a member of this campaign", shared.ErrForbidden)
    }
    if len(requiredRoles) > 0 && !slices.Contains(requiredRoles, role) {
        return fmt.Errorf("%w: requires role %v, got %s", shared.ErrForbidden, requiredRoles, role)
    }
    return nil
}
```

### Where to Check Roles

| Endpoint | Required Role | Check |
|----------|--------------|-------|
| GET /campaigns | any member | Filter query by membership |
| GET /campaigns/{id} | any member | `requireCampaignAccess(id, userID)` |
| PUT /campaigns/{id} | lead | `requireCampaignAccess(id, userID, "lead")` |
| PATCH /campaigns/{id}/status | lead | `requireCampaignAccess(id, userID, "lead")` |
| DELETE /campaigns/{id} | lead | `requireCampaignAccess(id, userID, "lead")` |
| POST /campaigns/{id}/findings | lead, tester | `requireCampaignAccess(id, userID, "lead", "tester")` |
| PATCH /findings/{id}/status | depends on transition | See status transition rules below |
| POST /findings/{id}/retests | lead, tester, reviewer | `requireCampaignAccess(id, userID, "lead", "tester", "reviewer")` |
| POST /campaigns/{id}/reports | lead | `requireCampaignAccess(id, userID, "lead")` |
| GET /pentest/findings | any member | Filter by campaigns user belongs to |

### Status Transition Authorization

```go
var statusTransitionRoles = map[string][]string{
    "draft->in_review":            {"lead", "tester"},
    "in_review->confirmed":        {"lead", "reviewer"},
    "confirmed->remediation":      {"lead", "tester", "reviewer"},
    "remediation->retest":         {"lead", "tester", "reviewer"},
    "retest->verified":            {"lead", "reviewer"},
    "any->false_positive":         {"lead", "reviewer"},
    "any->accepted_risk":          {"lead", "reviewer"},
    "false_positive->draft":       {"lead", "reviewer"},
    "accepted_risk->draft":        {"lead", "reviewer"},
    "verified->remediation":       {"lead", "reviewer"},  // regression
}
```

---

## Frontend Changes

### Campaign Detail Sheet — Team Tab

Current: Read-only list of team members
New: Inline editable with role management

```
┌─────────────────────────────────────────────────────┐
│ Team Members                              [+ Add]   │
├─────────────────────────────────────────────────────┤
│ 👤 Admin User        admin@openctem.io    [Lead ▼]  │
│ 👤 John Tester       john@company.com     [Tester▼] │
│ 👤 Jane Reviewer     jane@company.com   [Reviewer▼] │
│ 👤 Client PM         pm@client.com      [Observer▼] │
└─────────────────────────────────────────────────────┘
```

- Add Member: Combobox searching tenant users (`GET /api/v1/tenants/{id}/members?search=`)
- Role dropdown: lead, tester, reviewer, observer
- Remove: X button (lead only)
- At least 1 lead required

### Status Buttons

Status change buttons shown/hidden based on user's campaign role:
- Observer: no status buttons
- Tester: only "Submit for Review" (draft→in_review)
- Reviewer: "Confirm", "False Positive", "Verified"
- Lead: all buttons

### Create Campaign Flow

Creator is auto-added as `lead`. Can add other members during creation or after.

---

## Implementation Plan

### Phase 1: Database + Domain

| # | Task | Size | Details |
|---|------|------|---------|
| 1.1 | Migration: `pentest_campaign_members` table | S | CREATE TABLE + indexes + migrate existing data |
| 1.2 | Domain entity: `CampaignMember` | S | Entity with role validation |
| 1.3 | Domain: `CampaignRole` type + validation | S | lead/tester/reviewer/observer enum |
| 1.4 | Repository interface: `CampaignMemberRepository` | S | CRUD + GetUserRole + ListByCampaign + ListByUser |

### Phase 2: Repository + Service

| # | Task | Size | Details |
|---|------|------|---------|
| 2.1 | PostgreSQL repository implementation | M | All CRUD + role queries |
| 2.2 | `requireCampaignAccess` helper on PentestService | S | Role check with admin bypass |
| 2.3 | Update `CreateCampaign` — auto-add creator as lead | S | Insert into members table |
| 2.4 | Update `ListCampaigns` — filter by membership | M | JOIN with members table, admin bypass |
| 2.5 | Update `ListAllPentestFindings` — filter by user's campaigns | M | Sub-query on membership |

### Phase 3: Endpoint Authorization

| # | Task | Size | Details |
|---|------|------|---------|
| 3.1 | Campaign CRUD — add role checks | M | lead for write, any member for read |
| 3.2 | Finding CRUD — add role checks | M | lead/tester for write, transition rules |
| 3.3 | Status transition — role-based validation | M | Merge transition map with role map |
| 3.4 | Reports — lead only for generate/delete | S | |
| 3.5 | Retests — lead/tester/reviewer | S | |

### Phase 4: Team Management API

| # | Task | Size | Details |
|---|------|------|---------|
| 4.1 | `POST /campaigns/{id}/members` — add member | S | |
| 4.2 | `DELETE /campaigns/{id}/members/{userId}` — remove member | S | |
| 4.3 | `PATCH /campaigns/{id}/members/{userId}` — change role | S | |
| 4.4 | `GET /campaigns/{id}/members` — list members | S | |
| 4.5 | Update `enrichCampaignResponse` — use members table | S | Replace team_user_ids lookup |

### Phase 5: Frontend

| # | Task | Size | Details |
|---|------|------|---------|
| 5.1 | Team Tab inline editing (add/remove/role change) | M | Combobox + role select + save |
| 5.2 | Create Campaign — add team members during creation | M | Member list in create dialog |
| 5.3 | Role-aware status buttons in detail sheet | S | Hide buttons based on user's role |
| 5.4 | Role-aware action buttons (edit, delete) | S | Disable/hide based on role |
| 5.5 | "My Campaigns" vs "All Campaigns" toggle (admin) | S | |

### Phase 6: Tests

| # | Task | Size | Details |
|---|------|------|---------|
| 6.1 | Unit tests — role authorization | M | All role combinations |
| 6.2 | Unit tests — status transition + role | M | Matrix test |
| 6.3 | Unit tests — visibility filtering | S | Admin sees all, member sees own |

---

## Dependency Graph

```
Phase 1 (DB + Domain)
  └→ Phase 2 (Repo + Service)
       ├→ Phase 3 (Endpoint Auth)
       │    └→ Phase 6 (Tests)
       └→ Phase 4 (Team API)
            └→ Phase 5 (Frontend)
```

---

## Migration Safety

- **Backward compatible**: `team_user_ids` and `lead_user_id` columns kept (deprecated, not dropped)
- **Data migrated**: Existing team members auto-inserted into new table
- **No downtime**: Migration is additive (new table + INSERT from existing data)
- **Rollback**: DROP TABLE pentest_campaign_members (data can be re-migrated from team_user_ids)

---

## Estimates

| Phase | Tasks | Size |
|-------|-------|------|
| Phase 1: DB + Domain | 4 | 2h |
| Phase 2: Repo + Service | 5 | 4h |
| Phase 3: Endpoint Auth | 5 | 4h |
| Phase 4: Team API | 5 | 2h |
| Phase 5: Frontend | 5 | 4h |
| Phase 6: Tests | 3 | 3h |
| **Total** | **27** | **~19h** |
