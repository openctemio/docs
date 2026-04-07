# RFC: Campaign Team Roles & RBAC

**Created:** 2026-03-17
**Updated:** 2026-03-21 (v5 — final corrections)
**Status:** PLANNED
**Priority:** P1 (Security + UX)
**Scope:** Per-campaign role-based access control for pentest team members
**Review:** PM / Tech Lead / Security / UX — 2026-03-21 (final)

---

## Problem

Current state (from codebase analysis):
- `team_user_ids UUID[]` — flat list, no roles
- `lead_user_id UUID` — single lead, nullable
- Any user with `pentest:campaigns:read` sees ALL campaigns (no visibility filter)
- `PentestService.UpdateCampaign()` — no check if caller is lead/team member
- `PentestService.UpdateCampaignStatus()` — no role-based restriction
- `PentestService.DeleteFinding()` — no ownership check
- Frontend: `canEdit = hasPermission(PentestCampaignsWrite)` — purely RBAC, no campaign-level role

This means:
1. A tester can delete findings created by another tester
2. A tester can change campaign status to completed
3. No peer review enforcement (tester can confirm own findings)
4. Observers (managers, clients) can modify data
5. No visibility isolation between campaigns
6. Any Member-role user can edit ANY campaign (not just campaigns they belong to)

---

## Multi-Perspective Review

### PM / Tech Lead Assessment

**Scope creep risks:**
- Findings hiện split 2 bảng (`pentest_findings` deprecated + `findings` with `source='pentest'`). Role check chỉ áp dụng cho unified findings. Legacy endpoints bị deprecate trong cùng RFC.
- `enrichCampaignResponse()` hiện batch-load user names cho `team_user_ids`. Khi chuyển sang members table, giữ batch pattern (JOIN trong 1 query), không N+1.
- Frontend adapter `adaptCampaign()` hiện suy luận role từ `lead_user_id`. Sau RFC này, dùng `team_members[].role` trực tiếp từ API.

**Edge cases covered:**
- Campaign `completed`/`cancelled` → lock writes
- Campaign `on_hold` → block tạo finding mới, cho phép update finding đang có
- Tester `assigned_to` ≠ `created_by` → ownership check dùng `created_by`
- User xóa khỏi tenant → cascade safety cho lead integrity
- Duplicate add → UNIQUE constraint + meaningful error

### Security Expert Assessment

**Issues addressed:**

1. **IDOR**: Finding-direct routes verify `finding.pentest_campaign_id` → user membership via `resolveCampaignRoleForFinding()`.

2. **Role escalation**: Authorization PHẢI ở service layer. Handler chỉ extract userID/tenantID.

3. **Error messages**: Generic errors. Non-member nhận 404 (không 403). Không leak role info.

4. **Self-removal**: Lead cannot remove self. Phải assign lead khác trước.

5. **Retest bypass**: Tester submit retest "passed" → finding stays `retest`. Chỉ reviewer/lead mới transition → `verified`.

6. **Cascade safety**: User bị xóa khỏi tenant → `ON DELETE CASCADE` xóa member row → trigger check lead count.

### UX Assessment

**Key improvements:**
- Role badge ở campaign detail header: "Your role: Lead"
- Disabled + tooltip (không hidden) cho actions ngoài quyền tester
- Observer: banner "You have view-only access"
- Status dropdown chỉ show valid transitions cho role hiện tại
- Team tab: inline editable cho lead, read-only cho others

### Database & Query Performance Assessment

**Campaign list**: 3 queries (unchanged) — visibility JOIN merged into campaign query, user names merged into members batch query.
**Campaign detail**: 2 queries — campaign + members.
**Campaign-scoped role check**: 0 extra queries (middleware cache).
**Finding-direct role check**: finding fetch + 1 role query (finding fetch needed anyway for ownership).

### CTEM Framework Alignment

Pentest campaigns thuộc **Phase 4: Validation** trong CTEM 5-phase framework. RFC này cần đảm bảo pentest findings flow đúng qua Phase 4 → Phase 5 (Mobilization).

**Vấn đề 1: Dual Status Lifecycle — chồng chéo**

Cùng bảng `findings`, 2 lifecycle tồn tại song song:
```
CTEM Mobilization (automated):  new → confirmed → in_progress → fix_applied → resolved
Pentest Validation (manual):    draft → in_review → confirmed → remediation → retest → verified
```

Chúng share `confirmed`, `false_positive`, `accepted_risk` nhưng sau đó phân nhánh. Vấn đề: pentest `verified` (pentester confirmed fix works) **không map** sang CTEM `resolved` (scanner/security verified). Dashboard counting bị sai.

**Giải pháp — Status Equivalence Map:**

| Pentest Status | CTEM Equivalent | Dashboard Treatment |
|---------------|-----------------|-------------------|
| `draft` | — (Phase 4 internal) | **Ẩn** khỏi CTEM dashboard. Chỉ show trong pentest module |
| `in_review` | — (Phase 4 internal) | **Ẩn** khỏi CTEM dashboard |
| `confirmed` | `confirmed` | Hiện trên dashboard. Đây là điểm finding "xuất hiện" ở Phase 5 |
| `remediation` | `in_progress` | Hiện — dev đang fix |
| `retest` | `fix_applied` | Hiện — fix done, chờ pentester verify lại |
| `verified` | `resolved` | Hiện — **đếm là resolved** cho CTEM metrics |
| `false_positive` | `false_positive` | Same behavior |
| `accepted_risk` | `accepted_risk` | Same behavior |

**Implementation**: Dashboard queries cần thêm status mapping:
```sql
-- CTEM dashboard: count pentest "verified" as resolved
CASE
  WHEN source = 'pentest' AND status = 'verified' THEN 'resolved'
  WHEN source = 'pentest' AND status IN ('draft', 'in_review') THEN NULL  -- exclude
  WHEN source = 'pentest' AND status = 'remediation' THEN 'in_progress'
  WHEN source = 'pentest' AND status = 'retest' THEN 'fix_applied'
  ELSE status
END AS ctem_status
```

Hoặc tốt hơn: thêm computed column / view `ctem_status` để tránh logic rải rác.

**Vấn đề 2: Draft/In_review leak lên dashboard**

Hiện tại `GetStats()` **đếm `draft`** findings vào CTEM metrics. Pentester đang viết dở → hiện lên dashboard → sai metrics. Theo CTEM, findings chỉ nên "xuất hiện" khi **confirmed** (chuyển từ Phase 4 sang Phase 5).

**Giải pháp**: Dashboard filter:
```sql
WHERE NOT (source = 'pentest' AND status IN ('draft', 'in_review'))
```

Pentest module vẫn show draft/in_review findings (nội bộ Phase 4).

**Vấn đề 3: Finding scope validation**

`CreateUnifiedFinding()` yêu cầu `AssetID` nhưng **không validate** asset thuộc campaign scope. Tester có thể tạo finding cho asset ngoài scope → sai CTEM scoping metrics.

**Giải pháp**: Soft validation (warn, không block):
```go
func (s *PentestService) validateFindingScope(campaign *Campaign, assetID shared.ID) string {
    if len(campaign.AssetIDs()) == 0 && len(campaign.AssetGroupIDs()) == 0 {
        return "" // no scope defined → skip validation
    }
    if !slices.Contains(campaign.AssetIDs(), assetID.String()) {
        return "Warning: asset is not in campaign scope"
    }
    return ""
}
```

Không block vì pentester thường phát hiện assets ngoài scope ban đầu (scope creep là bình thường trong pentest). Warn để lead review.

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
| View all findings in campaign | Y | Y | Y | Y |
| Create findings | Y | Y | - | - |
| Edit own/assigned findings | Y | Y | - | - |
| Edit any finding | Y | - | - | - |
| Delete own findings (creator only) | Y | Y | - | - |
| Delete any finding | Y | - | - | - |
| draft → confirmed (skip review) | Y | - | - | - |
| draft → in_review | Y | Y* | - | - |
| in_review → confirmed | Y | - | Y | - |
| confirmed → remediation/retest | Y | Y | Y | - |
| → false_positive / accepted_risk | Y | - | Y | - |
| retest → verified | Y | - | Y | - |
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

*Tester chỉ thao tác trên finding mình tạo hoặc được assign (`created_by` OR `assigned_to`)

### Ownership Rules

"Own" finding = `created_by = currentUserID` **HOẶC** `assigned_to = currentUserID`.

Lý do: Lead tạo finding → assign cho tester B. Tester B cần update finding (remediation notes, status). Nếu chỉ check `created_by`, tester B bị block → workflow bế tắc.

| Action | Ownership Check |
|--------|----------------|
| Edit finding | `created_by` OR `assigned_to` |
| Delete finding | `created_by` only (assignee không nên xóa) |
| Status transition | `created_by` OR `assigned_to` (within role's allowed transitions) |

```go
func (s *PentestService) requireFindingOwnership(finding *vulnerability.Finding, userID shared.ID, role, action string) error {
    if role == "lead" {
        return nil
    }
    isCreator := finding.CreatedBy() != nil && *finding.CreatedBy() == userID
    isAssignee := finding.AssignedTo() != nil && *finding.AssignedTo() == userID

    switch action {
    case "delete":
        if !isCreator {
            return fmt.Errorf("%w: only the creator can delete this finding", shared.ErrForbidden)
        }
    default: // edit, status change
        if !isCreator && !isAssignee {
            return fmt.Errorf("%w: insufficient permissions for this finding", shared.ErrForbidden)
        }
    }
    return nil
}
```

**Edge case — Role thay đổi**: Nếu tester bị đổi role → observer, tester KHÔNG thể edit findings mình tạo nữa. Role quyết định trước, ownership chỉ kiểm tra SAU khi role cho phép. Flow:
```
requireCampaignAccess(role, "lead", "tester")  ← observer fails here, never reaches ownership check
    → requireFindingOwnership(finding, userID, role, action)
```

**Edge case — `created_by` NULL** (user bị xóa khỏi hệ thống): Không ai "own" finding → chỉ lead có thể edit/delete.

### Assignment Validation

`AssignFinding` phải validate assignee là campaign member với role `lead`, `tester`, hoặc `reviewer`. Không cho assign cho `observer` (observer không thể thao tác → finding bế tắc).

```go
func (s *PentestService) validateAssignee(ctx context.Context, tenantID, campaignID string, assigneeID shared.ID) error {
    role, err := s.memberRepo.GetUserRole(ctx, tenantID, campaignID, assigneeID.String())
    if err != nil {
        return fmt.Errorf("%w: user is not a member of this campaign", shared.ErrValidation)
    }
    if role == "observer" {
        return fmt.Errorf("%w: cannot assign to observer (read-only role)", shared.ErrValidation)
    }
    return nil
}
```

### Campaign Status Lock Rules

| Campaign Status | Create finding | Update finding | Change campaign | Manage team |
|----------------|:--------------:|:--------------:|:---------------:|:-----------:|
| planning | Y | Y | Y | Y |
| in_progress | Y | Y | Y | Y |
| on_hold | **N** (blocked) | Y (existing only) | Y (lead) | Y (lead) |
| completed | N | N | reopen only (lead) | N |
| cancelled | N | N | reopen only (lead) | N |

```go
func (s *PentestService) requireCampaignWritable(campaign *pentest.Campaign, allowExistingUpdates bool) error {
    switch campaign.Status() {
    case pentest.CampaignStatusCompleted, pentest.CampaignStatusCancelled:
        return fmt.Errorf("%w: campaign is %s", shared.ErrForbidden, campaign.Status())
    case pentest.CampaignStatusOnHold:
        if !allowExistingUpdates {
            return fmt.Errorf("%w: campaign is on hold, cannot create new items", shared.ErrForbidden)
        }
    }
    return nil
}
```

Usage:
- Create finding → `requireCampaignWritable(campaign, false)` — blocked on on_hold
- Update finding → `requireCampaignWritable(campaign, true)` — allowed on on_hold
- Change campaign status → separate check (lead only, no writable guard — must be able to resume)

**Cancelled → Planning (undo cancel)**: Thêm transition `cancelled → planning` trong domain. Cancelled không phải terminal nữa — lead có thể reopen campaign bị huỷ nhầm. Đây là change nhỏ trong `CampaignStatusTransitions`:
```go
CampaignStatusCancelled: {CampaignStatusPlanning}, // lead only, undo accidental cancel
```

**Completion warning**: Khi lead transition campaign → `completed`, service trả response kèm warning nếu có findings chưa terminal:
```go
type StatusChangeResult struct {
    Campaign *Campaign
    Warning  string // "12 findings are still in non-terminal status (in_progress, remediation, etc.)"
}
```
Không block — lead quyết định. Một số engagement kết thúc theo thời gian, không theo completion.

### Retest → Finding Status Rules

Hiện tại `CreateRetest(passed)` tự động set finding = `verified` — **security gap** (tester bypasses reviewer).

**Fix**: Finding status depends on submitter's campaign role:

| Retest Result | Submitter Role | Finding Status Change |
|--------------|----------------|----------------------|
| passed | lead, reviewer | → `verified` |
| passed | tester | stays at `retest` (chờ reviewer verify) |
| failed | any | → `remediation` |
| partial | any | no change (recorded only) |

```go
func (s *PentestService) applyRetestResult(finding, retest, role) {
    switch retest.Status() {
    case "passed":
        if role == "lead" || role == "reviewer" {
            finding.TransitionStatus("verified")
        }
        // tester: finding stays at "retest"
    case "failed":
        finding.TransitionStatus("remediation")
    case "partial":
        // no status change
    }
}
```

### Visibility Rules

| System Role | Campaign Visibility |
|------------|-------------------|
| Owner / Admin | All campaigns (bypass team check) |
| Member / Viewer | Only campaigns where user is in `pentest_campaign_members` |

Finding visibility: Finding chỉ trả về nếu user là member của campaign chứa finding. Non-member nhận **404** (không 403) để tránh confirm existence.

---

## Edge Cases & Mitigations

### Team Membership Edge Cases

| # | Scenario | Behavior | Rationale |
|---|----------|----------|-----------|
| E1 | Tester role → observer. Tester có 5 findings | Observer KHÔNG edit findings mình tạo | Role quyết định trước ownership. Observer = read-only, bất kể created_by |
| E2 | Remove tester đang assigned_to 3 findings | `assigned_to` giữ nguyên. Response đánh dấu `assignee_is_member: false` | Lead reassign thủ công. Không auto-clear vì giữ context ai đang xử lý |
| E3 | Remove tất cả reviewer, findings kẹt ở `in_review` | Lead có `in_review→confirmed`. Findings không kẹt | Warn khi remove last reviewer nếu có findings ở `in_review` |
| E4 | Lead self-downgrade (2 leads, 1 downgrade thành tester) | Cho phép (còn 1 lead). Lead cũ không tự upgrade được | Correct. Lead còn lại phải promote nếu cần |
| E5 | Add member đã tồn tại trong campaign | UNIQUE constraint → trả error "User is already a member" | Không silent ignore, user cần biết |
| E6 | Add member không thuộc tenant | Validate user.tenant membership trước insert | Trả 400 "User is not a member of this tenant" |

### Finding Ownership Edge Cases

| # | Scenario | Behavior | Rationale |
|---|----------|----------|-----------|
| E7 | Lead tạo finding → assign cho tester B. B muốn update | B có quyền edit (assignee) | Ownership = created_by OR assigned_to cho edit |
| E8 | Tester B (assignee) muốn delete finding | Bị chặn. Delete chỉ cho creator + lead | Assignee là "người xử lý", không phải "chủ sở hữu" |
| E9 | Finding `created_by` = NULL (user bị xóa) | Chỉ lead edit/delete | Không ai "own", lead là fallback |
| E10 | Tester bị remove, re-add lại. Edit finding cũ? | Cho phép nếu role là tester + created_by match | Membership mới, ownership không đổi |

### Campaign Lifecycle Edge Cases

| # | Scenario | Behavior | Rationale |
|---|----------|----------|-----------|
| E11 | Complete campaign với 10 findings đang open | Warn (không block). Response kèm count | Lead quyết định. Engagement có deadline |
| E12 | Cancel campaign nhầm | `cancelled → planning` (lead only) | Cancelled là reversible, không mất data |
| E13 | Delete campaign → unified findings? | `pentest_campaign_id` SET NULL (FK behavior). Findings trở thành orphaned | Findings vẫn tồn tại trong CTEM pipeline, mất campaign link |
| E14 | Delete campaign có unified findings | Cho phép (SET NULL). Warn kèm count | Findings không bị xóa, chỉ mất campaign context |
| E15 | On_hold: lead thêm team member | Cho phép (manage team OK trên on_hold) | On_hold chỉ block tạo finding mới |

### Orphaned & Legacy Data Edge Cases

| # | Scenario | Behavior | Rationale |
|---|----------|----------|-----------|
| E16 | Old finding không có `pentest_campaign_id` | `resolveCampaignRoleForFinding()` trả 404 cho non-admin. Admin access OK | Admin bypass không cần campaign role |
| E17 | Finding orphaned (campaign đã bị xóa, campaign_id = NULL) | Giống E16 — admin only | Finding vẫn visible trong CTEM dashboard (source='pentest') |
| E18 | Legacy `pentest_findings` table access | Routes deprecated. Service methods giữ cho internal migration | Giảm attack surface |

### CTEM Integration Edge Cases

| # | Scenario | Behavior | Rationale |
|---|----------|----------|-----------|
| E22 | Pentest finding `verified` → CTEM dashboard shows as? | `resolved` (via status mapping) | Pentest verified = fix confirmed by manual retest = CTEM resolved |
| E23 | Draft finding visible on CTEM dashboard? | **NO** — filtered out | Draft = Phase 4 internal. Only `confirmed`+ should appear in Phase 5 |
| E24 | Scanner finds same vuln as pentester → 2 findings? | Separate findings (different source + fingerprint) | Scanner fingerprint ≠ pentest fingerprint. Dedup is future scope |
| E25 | Tester creates finding for asset outside campaign scope | Allowed with warning in response | Scope creep normal in pentest. Lead reviews |
| E26 | Campaign deleted → findings still on CTEM dashboard? | Yes, as orphaned pentest findings (source='pentest', campaign_id=NULL) | Findings survive in CTEM pipeline. Admin can manage |
| E27 | Pentest `remediation` status → CTEM dashboard shows? | `in_progress` (via mapping) | Semantically equivalent — dev is fixing |
| E28 | Pentest `retest` status → CTEM dashboard shows? | `fix_applied` (via mapping) | Fix done, chờ verify = CTEM fix_applied |
| E29 | Lead assign finding cho observer | Bị chặn. Assignee phải là lead/tester/reviewer | Observer không thể thao tác, assignment vô nghĩa |
| E30 | Tester được assign finding → submit for review | Cho phép (assignee = owner cho status transition) | Workflow: lead tạo draft → assign tester → tester submit review |

### Concurrent Operation Edge Cases

| # | Scenario | Behavior | Rationale |
|---|----------|----------|-----------|
| E19 | 2 leads remove nhau đồng thời | `SELECT FOR UPDATE` on campaign row → serialize | Chỉ 1 thành công, còn lại bị "must have at least one lead" |
| E20 | Tester edit finding, lead mark campaign completed đồng thời | Tester nhận error khi save | `requireCampaignWritable()` check tại write time |
| E21 | 2 reviewers confirm cùng finding | Last write wins (no optimistic locking) | Cả 2 đều valid. Kết quả giống nhau |

---

## Database Design

### New Table: `pentest_campaign_members`

```sql
CREATE TABLE pentest_campaign_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    campaign_id UUID NOT NULL REFERENCES pentest_campaigns(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(20) NOT NULL DEFAULT 'tester',
    added_by    UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(campaign_id, user_id)
);

-- Visibility query: "campaigns user X belongs to"
CREATE INDEX idx_pcm_user_campaign ON pentest_campaign_members(user_id, campaign_id);
-- Batch enrichment: "members of campaigns [A,B,C]"
CREATE INDEX idx_pcm_campaign_role ON pentest_campaign_members(campaign_id, role);
-- Tenant isolation
CREATE INDEX idx_pcm_tenant ON pentest_campaign_members(tenant_id);
```

Valid roles: `lead`, `tester`, `reviewer`, `observer`

### Lead Integrity

Ít nhất 1 lead trong mỗi campaign. 3 scenarios cần guard:

**1. Remove member / Change role (application-level):**
```go
func (s *PentestService) ensureLeadExists(ctx context.Context, tx *sql.Tx, tenantID, campaignID string) error {
    _, err := s.campaignRepo.GetByIDForUpdate(ctx, tx, tenantID, campaignID)
    if err != nil { return err }
    count, err := s.memberRepo.CountByRoleInTx(ctx, tx, tenantID, campaignID, "lead")
    if err != nil { return err }
    if count == 0 {
        return fmt.Errorf("%w: campaign must have at least one lead", shared.ErrValidation)
    }
    return nil
}
```

**2. User deleted from tenant (CASCADE safety):**
```sql
-- Trigger: after deleting a member, check if campaign lost its last lead
CREATE OR REPLACE FUNCTION check_campaign_lead_after_member_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- If the deleted member was a lead, check if campaign still has leads
    IF OLD.role = 'lead' THEN
        IF NOT EXISTS (
            SELECT 1 FROM pentest_campaign_members
            WHERE campaign_id = OLD.campaign_id AND role = 'lead'
        ) THEN
            -- Auto-promote oldest tester to lead (if any)
            UPDATE pentest_campaign_members
            SET role = 'lead'
            WHERE id = (
                SELECT id FROM pentest_campaign_members
                WHERE campaign_id = OLD.campaign_id AND role = 'tester'
                ORDER BY created_at ASC
                LIMIT 1
            );
        END IF;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_campaign_lead
AFTER DELETE ON pentest_campaign_members
FOR EACH ROW EXECUTE FUNCTION check_campaign_lead_after_member_delete();
```

**3. Self-removal**: Lead cannot remove self — service check before delete.

### Migration Strategy

```sql
-- 1. Create table + indexes
CREATE TABLE pentest_campaign_members (...);

-- 2. Migrate existing team members as testers
INSERT INTO pentest_campaign_members (tenant_id, campaign_id, user_id, role)
SELECT c.tenant_id, c.id, unnest(c.team_user_ids), 'tester'
FROM pentest_campaigns c
WHERE c.team_user_ids IS NOT NULL AND array_length(c.team_user_ids, 1) > 0
ON CONFLICT (campaign_id, user_id) DO NOTHING;

-- 3. Ensure lead is in members table
INSERT INTO pentest_campaign_members (tenant_id, campaign_id, user_id, role)
SELECT c.tenant_id, c.id, c.lead_user_id, 'lead'
FROM pentest_campaigns c
WHERE c.lead_user_id IS NOT NULL
ON CONFLICT (campaign_id, user_id) DO UPDATE SET role = 'lead';

-- 4. Campaigns without lead: promote first team member
UPDATE pentest_campaign_members SET role = 'lead'
WHERE id IN (
    SELECT DISTINCT ON (campaign_id) id
    FROM pentest_campaign_members pcm
    WHERE NOT EXISTS (
        SELECT 1 FROM pentest_campaign_members
        WHERE campaign_id = pcm.campaign_id AND role = 'lead'
    )
    ORDER BY campaign_id, created_at ASC
);

-- 5. Create trigger for cascade safety
CREATE OR REPLACE FUNCTION check_campaign_lead_after_member_delete() ...;
CREATE TRIGGER trg_check_campaign_lead ...;

-- 6. Mark deprecated columns
COMMENT ON COLUMN pentest_campaigns.team_user_ids IS 'DEPRECATED: Use pentest_campaign_members table';
COMMENT ON COLUMN pentest_campaigns.lead_user_id IS 'DEPRECATED: Use pentest_campaign_members table with role=lead';
```

### Domain Entity Deprecation

Sau migration, `Campaign.teamUserIDs` và `Campaign.leadUserID` **không còn là source of truth**:

- **Service layer**: KHÔNG gọi `Campaign.SetTeam()` để set team members nữa. Dùng `CampaignMemberRepository`.
- **Khi đọc**: `team_members` lấy từ `pentest_campaign_members JOIN users`, KHÔNG từ column cũ.
- **`SetTeam()`**: Rename → `SetAssets(assetIDs, assetGroupIDs)`. Xóa `leadUserID`, `teamUserIDs` params.
- **Column cũ**: Giữ cho rollback. Drop sau 2 migration cycles.

### API Response Change

Campaign response adds `team_members` with role info and `current_user_role`:

```json
{
  "team_members": [
    { "id": "uuid", "name": "Admin User", "email": "admin@openctem.io", "role": "lead" },
    { "id": "uuid", "name": "John Tester", "email": "john@company.com", "role": "tester" }
  ],
  "current_user_role": "lead",
  "team_user_ids": ["uuid1", "uuid2"],
  "lead_user_id": "uuid1"
}
```

- `current_user_role`: role hiện tại, `null` nếu admin bypass
- `team_user_ids` + `lead_user_id`: **vẫn trả về** (derived từ members table) cho backward compat. Frontend chuyển sang dùng `team_members[].role` ngay trong release này. Old fields sẽ drop ở release sau.

---

## Service Layer Design

### Legacy vs Unified Findings — Decision

- **Legacy**: `CreateFinding()` / `UpdateFinding()` → bảng `pentest_findings` (deprecated từ migration 000095)
- **Unified**: `CreateUnifiedFinding()` / `UpdateUnifiedFinding()` → bảng `findings` với `source='pentest'`

**Quyết định**: RFC này **chỉ thêm role check cho unified endpoints**. Legacy endpoints **deprecate** trong cùng RFC:
- Xóa legacy routes khỏi `pentest.go`
- Giữ legacy service methods (internal use cho migration nếu cần)
- Frontend đã dùng unified API

### Authorization Architecture

```
Handler (HTTP) → extracts userID, tenantID from JWT
    ↓
Middleware → CampaignRoleMiddleware (campaign-scoped routes only, admin short-circuit)
    ↓
Service Layer → requireCampaignAccess() + requireFindingOwnership() + requireCampaignWritable()
    ↓
Repository → tenant-scoped queries only
```

### Two Route Patterns — Two Role Resolution Strategies

**Pattern 1: Campaign-scoped routes** (`/campaigns/{id}/...`):
- `CampaignRoleMiddleware` lấy `campaign_id` từ URL, query role 1 lần, cache vào context
- Admin short-circuit: nếu `isAdmin`, skip role query, set role = "" (bypass anyway)

**Pattern 2: Finding-direct routes** (`/findings/{findingId}/...`):
- Middleware không có campaign_id → service tự resolve
- Service fetch finding → lấy `pentest_campaign_id` → query role
- = 2 queries nhưng finding fetch cần thiết cho ownership check

```go
func (s *PentestService) resolveCampaignRoleForFinding(ctx context.Context, tenantID string, finding *vulnerability.Finding) (string, error) {
    if role := getCampaignRole(ctx); role != "" {
        return role, nil
    }
    campaignID := finding.PentestCampaignID()
    if campaignID == nil {
        return "", fmt.Errorf("%w: finding not linked to campaign", shared.ErrNotFound)
    }
    userID := middleware.GetUserID(ctx)
    return s.memberRepo.GetUserRole(ctx, tenantID, campaignID.String(), userID)
}
```

### Campaign Role Middleware

```go
func CampaignRoleMiddleware(memberRepo CampaignMemberRepository) func(next http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            campaignID := chi.URLParam(r, "id")
            if campaignID == "" {
                next.ServeHTTP(w, r)
                return
            }
            // Admin short-circuit: skip DB query
            if middleware.IsAdmin(r.Context()) {
                next.ServeHTTP(w, r)
                return
            }
            userID := middleware.GetUserID(r.Context())
            tenantID := middleware.GetTenantID(r.Context())
            role, _ := memberRepo.GetUserRole(r.Context(), tenantID, campaignID, userID)
            ctx := context.WithValue(r.Context(), campaignRoleKey, role)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}
```

### Authorization Helper

```go
func (s *PentestService) requireCampaignAccess(ctx context.Context, tenantID, campaignID string, requiredRoles ...string) error {
    if middleware.IsAdmin(ctx) {
        return nil
    }
    role := getCampaignRole(ctx)
    if role == "" {
        return fmt.Errorf("%w: not found", shared.ErrNotFound) // 404, not 403
    }
    if len(requiredRoles) > 0 && !slices.Contains(requiredRoles, role) {
        return fmt.Errorf("%w: insufficient permissions for this campaign", shared.ErrForbidden)
    }
    return nil
}
```

### Endpoint → Role Mapping

| Endpoint | Required Role | Extra Check | Role Source |
|----------|--------------|-------------|-------------|
| **Campaign-scoped** | | | |
| GET /campaigns | any member | Filter query by membership | query-level |
| GET /campaigns/{id} | any member | — | middleware |
| PUT /campaigns/{id} | lead | `requireCampaignWritable(false)` | middleware |
| PATCH /campaigns/{id}/status | lead | — (must be able to resume from on_hold) | middleware |
| DELETE /campaigns/{id} | lead | — | middleware |
| POST /campaigns/{id}/findings | lead, tester | `requireCampaignWritable(false)` | middleware |
| POST /campaigns/{id}/reports | lead | — | middleware |
| POST /campaigns/{id}/members | lead | `requireCampaignWritable(false)` | middleware |
| DELETE /campaigns/{id}/members/{userId} | lead | `ensureLeadExists` + no self-remove | middleware |
| PATCH /campaigns/{id}/members/{userId} | lead | `ensureLeadExists` if downgrading | middleware |
| **Finding-direct** | | | |
| GET /pentest/findings | any member | Filter by user's campaigns | query-level |
| GET /findings/{findingId} | any member | — | `resolveCampaignRoleForFinding()` |
| PUT /findings/{findingId} | lead, tester | `requireFindingOwnership` + `requireCampaignWritable(true)` | `resolveCampaignRoleForFinding()` |
| DELETE /findings/{findingId} | lead, tester | `requireFindingOwnership` | `resolveCampaignRoleForFinding()` |
| PATCH /findings/{findingId}/status | depends | See transition table + `requireCampaignWritable(true)` | `resolveCampaignRoleForFinding()` |
| POST /findings/{findingId}/retests | lead, tester, reviewer | `requireCampaignWritable(true)` | `resolveCampaignRoleForFinding()` |

### Status Transition × Role Map

```go
var pentestStatusTransitionRoles = map[string][]string{
    "draft->confirmed":            {"lead"},
    "draft->in_review":            {"lead", "tester"},
    "in_review->confirmed":        {"lead", "reviewer"},
    "confirmed->remediation":      {"lead", "tester", "reviewer"},
    "remediation->retest":         {"lead", "tester", "reviewer"},
    "retest->verified":            {"lead", "reviewer"},
    "any->false_positive":         {"lead", "reviewer"},
    "any->accepted_risk":          {"lead", "reviewer"},
    "false_positive->draft":       {"lead", "reviewer"},
    "accepted_risk->draft":        {"lead", "reviewer"},
    "verified->remediation":       {"lead", "reviewer"},
}
```

Tester submit `draft→in_review`: finding mình tạo hoặc được assign (`created_by` OR `assigned_to`).

### Team Change Notifications

Khi team membership thay đổi, gửi in-app notification (fire-and-forget, dùng `notifyUser()` pattern hiện có):

| Event | Recipient | Message |
|-------|-----------|---------|
| Member added | New member | "You were added to campaign '{name}' as {role}" |
| Member removed | Removed member | "You were removed from campaign '{name}'" |
| Role changed | Affected member | "Your role in campaign '{name}' changed to {newRole}" |

Không gửi notification cho người thực hiện action (lead tự thêm người → notification cho người được thêm, không cho lead).

### Audit Logging

Team changes ghi audit log (pattern hiện có trong `PentestService`):

```go
event := NewSuccessEvent(audit.ActionCampaignMemberAdded, audit.ResourceTypeCampaign, campaignID).
    WithResourceName(campaign.Name()).
    WithMessage(fmt.Sprintf("Added %s as %s", userName, role)).
    WithMetadata("member_user_id", userID).
    WithMetadata("role", role)
s.logAudit(ctx, actx, event)
```

---

## Frontend Changes

### Campaign Response → UI Mapping

```tsx
const { currentUserRole } = campaign;
const isLead = currentUserRole === 'lead';
const isTester = currentUserRole === 'tester';
const isReviewer = currentUserRole === 'reviewer';
const isObserver = currentUserRole === 'observer';
const isAdmin = useIsAdmin();

const canEdit = isLead || isAdmin;
const canCreateFinding = (isLead || isTester) && !isCampaignLocked;
const canManageTeam = (isLead || isAdmin) && !isCampaignLocked;
const isCampaignLocked = ['completed', 'cancelled'].includes(campaign.status);
```

### Campaign Detail Sheet — Header

```
┌─────────────────────────────────────────────────────────┐
│ External Pentest — Client Corp                           │
│ Status: In Progress    Priority: High                    │
│ Your role: Lead                          [Edit] [Delete] │
└─────────────────────────────────────────────────────────┘
```

- Badge colors: Lead (purple) / Tester (blue) / Reviewer (green) / Observer (gray)
- Admin sees "Admin access" badge
- Completed/Cancelled campaign: lock icon + "(read-only)" text

### Team Tab

**Lead view** (editable):
```
┌─────────────────────────────────────────────────────┐
│ Team Members (4)                          [+ Add]   │
├─────────────────────────────────────────────────────┤
│ Admin User        admin@openctem.io    [Lead ▼]     │
│ John Tester       john@company.com     [Tester▼] ✕  │
│ Jane Reviewer     jane@company.com   [Reviewer▼] ✕  │
│ Client PM         pm@client.com      [Observer▼] ✕  │
└─────────────────────────────────────────────────────┘
```

**Non-lead view** (read-only):
```
┌─────────────────────────────────────────────────────┐
│ Team Members (4)                                     │
├─────────────────────────────────────────────────────┤
│ Admin User        admin@openctem.io    Lead          │
│ John Tester       john@company.com     Tester        │
│ Jane Reviewer     jane@company.com     Reviewer      │
│ Client PM         pm@client.com        Observer      │
└─────────────────────────────────────────────────────┘
```

Rules:
- Add: Combobox searching tenant members
- Last lead: role dropdown disabled + tooltip "At least one lead required"
- Lead self-remove: button hidden + tooltip "Assign another lead first"
- Locked campaign: entire tab read-only

### Finding Actions — Role-Aware

| Role | Edit/Delete | Status Transitions | Tooltip (disabled) |
|------|------------|-------------------|-------------------|
| **Lead** | All findings | All transitions | — |
| **Tester** | Own findings only | "Submit for Review" (own findings) | "You can only edit findings you created" |
| **Reviewer** | None | "Confirm", "False Positive", "Accept Risk", "Verify" | — |
| **Observer** | None | None | Banner: "You have view-only access" |

Key: disabled + tooltip better than hidden — user knows feature exists but needs different role.

### Campaign List

- "My Campaigns" toggle (default ON cho non-admin, OFF cho admin)
- Cột Team: avatar stack + user's own role badge if member

### Create Campaign Flow

1. Creator auto-added as `lead`
2. Dialog: optional team member picker with role selector
3. Each member: user combobox + role dropdown

---

## Query Optimization Plan

### Campaign List (3 queries, unchanged):
```
1. SELECT campaigns [JOIN members WHERE user_id = ?] (visibility)
2. SELECT members JOIN users WHERE campaign_id = ANY(?) (batch enrich)
3. GetStatsByCampaignIDs (finding stats, existing)
```

### Campaign Detail (2 queries):
```
1. SELECT campaign WHERE id = ? (role already in context from middleware)
2. SELECT members JOIN users WHERE campaign_id = ?
```

### Role Check:
- Campaign-scoped routes: 0 extra queries (middleware, admin short-circuit)
- Finding-direct routes: finding fetch (needed for ownership) + 1 role query

---

## Implementation Plan

### Phase 1: Database + Domain (Foundation)

| # | Task | Size | Details |
|---|------|------|---------|
| 1.1 | Migration: `pentest_campaign_members` table | S | CREATE TABLE + indexes + migrate data + cascade trigger |
| 1.2 | Domain: `CampaignRole` value object | S | lead/tester/reviewer/observer + IsValid() |
| 1.3 | Domain: `CampaignMember` entity | S | ID, tenantID, campaignID, userID, role, addedBy, createdAt |
| 1.4 | Domain: `CampaignMemberRepository` interface | S | CRUD + GetUserRole + ListByCampaign + ListByUser + CountByRoleInTx + BatchListByCampaignIDs |
| 1.5 | Domain: `pentestStatusTransitionRoles` map | S | Status transition × role matrix |
| 1.6 | Rename `Campaign.SetTeam()` → `SetAssets()` | S | Remove teamUserIDs/leadUserID params |

### Phase 2: Repository + Middleware (Infrastructure)

| # | Task | Size | Details |
|---|------|------|---------|
| 2.1 | PostgreSQL `CampaignMemberRepository` | M | All CRUD, tenant-scoped, GetUserRole, BatchListByCampaignIDs (JOIN users) |
| 2.2 | `CampaignRoleMiddleware` | S | Cache role in context, admin short-circuit |
| 2.3 | `resolveCampaignRoleForFinding()` | S | Fallback for finding-direct routes |
| 2.4 | `requireCampaignAccess()` | S | Role check, admin bypass, 404 for non-members |
| 2.5 | `requireFindingOwnership()` | S | created_by check, lead bypass |
| 2.6 | `requireCampaignWritable()` | S | Block per status (completed/cancelled/on_hold) |

### Phase 3: Service Layer Authorization (Core Logic)

| # | Task | Size | Details |
|---|------|------|---------|
| 3.1 | `CreateCampaign` — creator as lead | S | Transaction: create campaign + insert member |
| 3.2 | `ListCampaigns` — visibility filter | M | JOIN for non-admin, bypass for admin |
| 3.3 | `ListAllPentestFindings` — filter by campaigns | M | Sub-query on membership |
| 3.4 | Campaign write — role checks | M | lead for edit/delete/status |
| 3.5 | Finding CRUD — role + ownership | M | lead/tester for write, ownership for tester |
| 3.6 | Finding status — transition × role | M | pentestStatusTransitionRoles map |
| 3.7 | Retest → finding status fix | S | Role-based auto-status (tester ≠ verified) |
| 3.8 | `ensureLeadExists` + no self-remove | S | FOR UPDATE + count in transaction |
| 3.9 | Campaign lock (on_hold/completed/cancelled) | S | `requireCampaignWritable(allowExisting)` |
| 3.10 | Deprecate legacy finding routes | S | Remove from `pentest.go`, keep service methods |
| 3.11 | Add `cancelled → planning` transition | S | Update `CampaignStatusTransitions` in domain |
| 3.12 | Completion warning (non-terminal findings count) | S | Return `StatusChangeResult` with warning string |
| 3.13 | CTEM dashboard filter: exclude draft/in_review | S | Update `GetStats()` and dashboard queries to skip pentest draft/in_review |
| 3.14 | CTEM status mapping: verified→resolved, remediation/retest→in_progress | M | DB view or computed mapping for dashboard counts |
| 3.15 | Finding scope validation (soft warn) | S | Warn if asset not in campaign scope, don't block |
| 3.16 | Assign finding validation | S | Validate assignee is campaign member with non-observer role |

### Phase 4: Team API + Response + Notifications

| # | Task | Size | Details |
|---|------|------|---------|
| 4.1 | `POST /campaigns/{id}/members` | S | lead only, validate user in tenant, notification |
| 4.2 | `DELETE /campaigns/{id}/members/{userId}` | S | lead only, no self-remove, ensureLeadExists, notification, warn if last reviewer with in_review findings |
| 4.3 | `PATCH /campaigns/{id}/members/{userId}` | S | lead only, ensureLeadExists if downgrading, notification |
| 4.4 | `GET /campaigns/{id}/members` | S | any member, 404 for non-member |
| 4.5 | Enrich response — batch from members table | M | Replace team_user_ids lookup, add current_user_role, assignee_is_member flag |
| 4.6 | Enrich response (list) — batch for N campaigns | M | 1 query: members JOIN users WHERE campaign_id = ANY($1) |
| 4.7 | Backward compat: derive old fields from members table | S | `team_user_ids` + `lead_user_id` still in response |
| 4.8 | Audit logging for team changes | S | member added/removed/role changed events |

### Phase 5: Frontend

| # | Task | Size | Details |
|---|------|------|---------|
| 5.1 | Update `adaptCampaign()` — use API role directly | S | Remove lead_user_id inference |
| 5.2 | Campaign detail header — role badge | S | "Your role: Lead" + locked indicator |
| 5.3 | Team Tab — lead editable, others read-only | M | EditableCard, role dropdown, add/remove, lock state |
| 5.4 | Create Campaign — team member picker | M | Member list with role in create dialog |
| 5.5 | Finding actions — role-aware | M | disabled+tooltip for non-owner, hidden for observer |
| 5.6 | Status buttons — role-aware transitions | S | Show only valid per role |
| 5.7 | Campaign list — "My Campaigns" toggle | S | Default ON for non-admin |
| 5.8 | Observer banner | S | "View-only access" message |

### Phase 6: Tests

| # | Task | Size | Details |
|---|------|------|---------|
| 6.1 | Role authorization matrix | M | 4 roles × all campaign endpoints |
| 6.2 | Status transition × role | M | Each transition × each role |
| 6.3 | Finding ownership | S | Tester own/other, lead any |
| 6.4 | Visibility filtering | S | Admin all, member own |
| 6.5 | Lead integrity | S | Remove/downgrade last lead, self-remove, cascade |
| 6.6 | Campaign lock (on_hold/completed/cancelled) | S | Create blocked, update allowed/blocked per status |
| 6.7 | Retest → status per role | S | Tester passed ≠ verified |
| 6.8 | IDOR prevention | S | Non-member cannot access finding |
| 6.9 | Duplicate member add | S | UNIQUE constraint → meaningful error |
| 6.10 | Assignee ownership | S | Assignee can edit but not delete, creator can both |
| 6.11 | Role change → ownership loss | S | Tester→observer loses edit on own findings |
| 6.12 | Orphaned findings | S | No campaign_id → admin only, non-admin 404 |
| 6.13 | Cancelled→planning reopen | S | Lead can undo cancel |
| 6.14 | Completion warning | S | Non-terminal findings count in response |
| 6.15 | Remove last reviewer warning | S | Warn if in_review findings exist |
| 6.16 | CTEM: dashboard excludes draft/in_review | S | Pentest draft not in CTEM stats |
| 6.17 | CTEM: verified maps to resolved | S | Dashboard counts verified as resolved |
| 6.18 | CTEM: scope validation warning | S | Out-of-scope asset → warning in response |
| 6.19 | Assign to observer blocked | S | Cannot assign finding to observer role |
| 6.20 | Assignee can submit for review | S | Assigned tester can draft→in_review |

---

## Dependency Graph

```
Phase 1 (DB + Domain)
  └→ Phase 2 (Repo + Middleware)
       └→ Phase 3 (Service Auth) ←── critical path
            ├→ Phase 4 (Team API + Response + Notifications)
            │    └→ Phase 5 (Frontend)
            └→ Phase 6 (Tests) — parallel with Phase 4
```

---

## Migration Safety

- **Backward compatible**: old columns kept (deprecated, not dropped)
- **Data migrated**: team_user_ids + lead_user_id → members table automatically
- **No orphaned campaigns**: migration step 4 promotes tester→lead if no lead exists
- **Cascade safety**: DB trigger auto-promotes tester when last lead deleted via CASCADE
- **No downtime**: additive migration
- **Rollback**: DROP TABLE + DROP TRIGGER → re-migrate from old columns
- **API backward compat**: old fields derived from members table, frontend switches immediately

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration: campaigns with no team AND no lead | 0 members | Admin can still access. Step 4 promotes if possible |
| Concurrent lead removal | 0 leads | `SELECT FOR UPDATE` serializes |
| User deleted → last lead gone | Campaign orphaned | DB trigger auto-promotes oldest tester |
| Finding-direct routes 2 queries | Slower response | Finding fetch needed anyway for ownership |
| Legacy endpoints without role check | Security gap | Deprecate in same release (3.10) |
| Admin is also campaign member | Role confusion | Admin bypass takes precedence |
| Remove tester with assigned findings | Orphaned assignee | Keep assigned_to, flag `assignee_is_member: false` |
| All reviewers removed | Findings stuck in_review | Lead can confirm. Warn on last reviewer removal |
| Cancelled campaign no undo | Data loss (recreate needed) | Add `cancelled → planning` transition |
| Campaign deleted with findings | Findings lose context | ON DELETE SET NULL. Findings survive in CTEM |

---

## Acceptance Criteria

### Security

- [ ] Non-member cannot view campaign details (receives 404)
- [ ] Non-member cannot access finding via direct findingId (receives 404)
- [ ] Tester cannot edit finding created by another tester (unless assigned_to)
- [ ] Tester cannot delete finding created by another tester (even if assigned_to)
- [ ] Tester cannot transition finding status beyond draft→in_review (own findings)
- [ ] Assignee (tester) can edit finding but cannot delete it
- [ ] Tester retest "passed" does NOT auto-verify finding
- [ ] Observer cannot modify anything (receives 403)
- [ ] Tester→observer role change removes edit access on own findings
- [ ] Error messages do not reveal user's campaign role
- [ ] Legacy finding endpoints return 404 (deprecated)
- [ ] Orphaned findings (no campaign_id) → admin only access
- [ ] Cannot assign finding to observer (validation error)
- [ ] Assignee (not creator) can submit finding for review (draft→in_review)

### Data Integrity

- [ ] Campaign always has at least 1 lead
- [ ] Lead cannot remove self
- [ ] User deleted from tenant → cascade trigger promotes next tester to lead
- [ ] Completed/Cancelled campaign blocks all writes (except lead reopen)
- [ ] Cancelled campaign can be reopened (cancelled → planning)
- [ ] On_hold campaign blocks new finding creation, allows existing updates
- [ ] Completing campaign with open findings returns warning (not block)
- [ ] Removing last reviewer with in_review findings returns warning
- [ ] Concurrent lead removal serialized via SELECT FOR UPDATE
- [ ] Campaign deletion → unified findings keep existing (pentest_campaign_id SET NULL)
- [ ] Duplicate member add → meaningful error (not raw DB constraint)

### Performance

- [ ] Campaign list: ≤3 DB queries regardless of number of campaigns
- [ ] Campaign detail: ≤2 DB queries
- [ ] Campaign-scoped role check: 0 extra queries (middleware cache, admin short-circuit)
- [ ] Finding-direct role check: finding fetch (needed anyway) + 1 role query

### CTEM Integration

- [ ] Pentest `draft` and `in_review` findings excluded from CTEM dashboard stats
- [ ] Pentest `verified` counted as `resolved` in CTEM metrics
- [ ] Pentest `remediation` counted as `in_progress` in CTEM metrics
- [ ] Pentest `retest` counted as `fix_applied` in CTEM metrics
- [ ] Finding for out-of-scope asset returns warning (not error)
- [ ] Pentest findings visible in CTEM dashboard from `confirmed` status onward
- [ ] Orphaned findings (campaign deleted) still visible on CTEM dashboard

### UX

- [ ] User sees their role badge in campaign detail header
- [ ] Tester sees disabled (not hidden) edit button on others' findings with tooltip
- [ ] Assignee sees edit button for assigned finding (not own)
- [ ] Observer sees "view-only" banner
- [ ] Status dropdown shows only valid transitions for user's role
- [ ] Team tab: lead can edit, others read-only
- [ ] Finding response includes `assignee_is_member` flag
- [ ] Notifications sent when added/removed/role changed

---

## Estimates

| Phase | Tasks | Estimate |
|-------|-------|----------|
| Phase 1: DB + Domain | 6 | 2h |
| Phase 2: Repo + Middleware | 6 | 4h |
| Phase 3: Service Auth + CTEM | 16 | 10h |
| Phase 4: Team API + Response | 8 | 5h |
| Phase 5: Frontend | 8 | 5h |
| Phase 6: Tests | 20 | 9h |
| **Total** | **64** | **~35h** |
