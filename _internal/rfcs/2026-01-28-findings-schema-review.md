# RFC: Findings Table Schema Review & Cleanup

**Date**: 2026-01-28
**Status**: Draft
**Author**: Claude (AI Assistant)

---

## 1. Executive Summary

Bảng `findings` hiện có **69 cột** - quá nhiều và có một số vấn đề:
- Cột trùng lặp/không cần thiết
- Bug: `resolved_by` không được set khi resolve
- Thiếu nhất quán giữa các cột actor tracking

**Đề xuất**: Loại bỏ 8 cột, sửa bug, chuẩn hóa schema.

---

## 2. Schema Analysis

### 2.1. CORE IDENTIFIERS ✅ (Giữ nguyên)

| Column | Type | Purpose | Verdict |
|--------|------|---------|---------|
| `id` | uuid | Primary key | ✅ Keep |
| `tenant_id` | uuid | Multi-tenancy | ✅ Keep |
| `fingerprint` | varchar(512) | Deduplication key | ✅ Keep |

### 2.2. RELATIONSHIPS ✅ (Giữ nguyên)

| Column | Type | Purpose | Verdict |
|--------|------|---------|---------|
| `vulnerability_id` | uuid | Link to CVE database | ✅ Keep |
| `asset_id` | uuid | Parent asset | ✅ Keep |
| `branch_id` | uuid | Git branch (repo assets) | ✅ Keep |
| `component_id` | uuid | SCA component | ✅ Keep |
| `agent_id` | uuid | Scanner agent | ✅ Keep |
| `duplicate_of` | uuid | Original finding if duplicate | ✅ Keep |

### 2.3. TOOL/SCANNER INFO

| Column | Type | Purpose | Verdict |
|--------|------|---------|---------|
| `source` | varchar(20) | sast/dast/sca/etc | ✅ Keep |
| `tool_name` | varchar(100) | "semgrep", "trivy" | ✅ Keep |
| `tool_version` | varchar(50) | "1.52.0" | ⚠️ **Review** |
| `rule_id` | varchar(255) | "javascript.express.security.xss" | ✅ Keep |
| `rule_name` | varchar(500) | Human-readable rule name | ⚠️ **Review** |
| `scan_id` | varchar(100) | Link to scan run | ✅ Keep |

**Về `tool_version`:**
- **Có ích khi**: Debug, track regression khi upgrade tool
- **Ít dùng khi**: Day-to-day operations
- **Verdict**: ✅ Keep - nhẹ, có giá trị trong edge cases

**Về `rule_name`:**
- `rule_id`: "go.grpc.security.grpc-server-insecure-connection"
- `rule_name`: "Insecure gRPC server connection"
- **Verdict**: ✅ Keep - UI cần hiển thị human-readable

### 2.4. LOCATION INFO ✅ (Giữ nguyên)

| Column | Type | Purpose | Verdict |
|--------|------|---------|---------|
| `file_path` | varchar(1000) | File location | ✅ Keep |
| `start_line` | int | Line number | ✅ Keep |
| `end_line` | int | Line number | ✅ Keep |
| `start_column` | int | Column | ✅ Keep |
| `end_column` | int | Column | ✅ Keep |
| `snippet` | text | Code snippet | ✅ Keep |

### 2.5. CONTENT - ⚠️ CẦN REVIEW

| Column | Type | Purpose | Verdict |
|--------|------|---------|---------|
| `title` | varchar(500) | Short title | ✅ Keep |
| `message` | text | Scanner message (required) | ✅ Keep |
| `description` | text | Detailed description | ⚠️ **Review** |
| `recommendation` | text | How to fix | ✅ Keep |

**`message` vs `description`:**

```
message (required):     "SQL injection vulnerability detected"
description (optional): "This code directly concatenates user input into SQL query.
                        An attacker could inject malicious SQL to bypass authentication,
                        read sensitive data, or modify/delete database records.

                        Impact: High - Full database compromise possible

                        Example attack: ' OR '1'='1' --

                        References:
                        - OWASP SQL Injection
                        - CWE-89"
```

| Field | Source | Use |
|-------|--------|-----|
| `message` | Scanner output (raw) | List view, quick glance |
| `description` | Enriched/AI/manual | Detail page, full context |

**Verdict**: ✅ Keep both - different purposes

### 2.6. CLASSIFICATION ✅ (Giữ nguyên)

| Column | Type | Purpose | Verdict |
|--------|------|---------|---------|
| `severity` | varchar(20) | critical/high/medium/low/none | ✅ Keep |
| `cvss_score` | numeric(3,1) | 0.0-10.0 | ✅ Keep |
| `cvss_vector` | varchar(100) | CVSS string | ✅ Keep |
| `cve_id` | varchar(20) | CVE-2024-xxxx | ✅ Keep |
| `cwe_ids` | text[] | CWE-89, CWE-79 | ✅ Keep |
| `owasp_ids` | text[] | A1, A3 | ✅ Keep |
| `tags` | text[] | Custom tags | ✅ Keep |

### 2.7. WORKFLOW STATUS - ⚠️ CÓ BUG

| Column | Type | Purpose | Verdict |
|--------|------|---------|---------|
| `status` | varchar(30) | new/confirmed/resolved/etc | ✅ Keep |
| `resolution` | text | How it was resolved | ✅ Keep |
| `resolved_at` | timestamp | When resolved | ✅ Keep |
| `resolved_by` | varchar(255) | Who resolved | 🐛 **BUG** |

**BUG**: `resolved_by` là `varchar(255)` nhưng nên là `uuid` FK to `users(id)`!

Hiện tại code đang pass string (có thể là user ID hoặc name) nhưng không có FK constraint.

**Fix cần thiết:**
```sql
-- Change to UUID with FK
ALTER TABLE findings
    ALTER COLUMN resolved_by TYPE uuid USING resolved_by::uuid,
    ADD CONSTRAINT findings_resolved_by_fkey
        FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL;
```

### 2.8. ASSIGNMENT ✅ (Giữ nguyên)

| Column | Type | Purpose | Verdict |
|--------|------|---------|---------|
| `assigned_to` | uuid | Assignee | ✅ Keep |
| `assigned_at` | timestamp | When assigned | ✅ Keep |
| `assigned_by` | uuid | Who assigned | ✅ Keep |
| `assigned_group_id` | uuid | Team assignment | ✅ Keep |
| `assignment_rule_id` | uuid | Auto-assignment rule | ✅ Keep |

### 2.9. VERIFICATION ✅ (Giữ nguyên)

| Column | Type | Purpose | Verdict |
|--------|------|---------|---------|
| `verified_at` | timestamp | When fix verified | ✅ Keep |
| `verified_by` | uuid | Who verified | ✅ Keep |

### 2.10. SLA ✅ (Giữ nguyên)

| Column | Type | Purpose | Verdict |
|--------|------|---------|---------|
| `sla_deadline` | timestamp | Due date | ✅ Keep |
| `sla_status` | varchar(20) | on_track/warning/overdue | ✅ Keep |

### 2.11. DETECTION TRACKING ✅ (Giữ nguyên)

| Column | Type | Purpose | Verdict |
|--------|------|---------|---------|
| `first_detected_at` | timestamp | First seen | ✅ Keep |
| `last_seen_at` | timestamp | Last scan that found it | ✅ Keep |
| `first_detected_branch` | varchar | Branch first found | ✅ Keep |
| `first_detected_commit` | varchar | Commit first found | ✅ Keep |
| `last_seen_branch` | varchar | Branch last found | ✅ Keep |
| `last_seen_commit` | varchar | Commit last found | ✅ Keep |

### 2.12. INTEGRATION ✅ (Giữ nguyên)

| Column | Type | Purpose | Verdict |
|--------|------|---------|---------|
| `related_issue_url` | varchar(1000) | Jira/GitHub issue | ✅ Keep |
| `related_pr_url` | varchar(1000) | Fix PR | ✅ Keep |

### 2.13. COUNTERS - ⚠️ COUNTER CACHE

| Column | Type | Purpose | Verdict |
|--------|------|---------|---------|
| `duplicate_count` | int | Number of duplicates | ✅ Keep |
| `comments_count` | int | Number of comments | ✅ Keep (counter cache) |

**Về `comments_count`:**

Đây là **Counter Cache Pattern** - một optimization phổ biến:

```
Without counter cache:
SELECT *, (SELECT COUNT(*) FROM finding_comments WHERE finding_id = f.id)
FROM findings f
WHERE tenant_id = ?
-- Chậm với hàng triệu findings!

With counter cache:
SELECT * FROM findings WHERE tenant_id = ?
-- Nhanh, comments_count đã có sẵn
```

**Verdict**: ✅ Keep - performance optimization

### 2.14. CTEM (Continuous Threat Exposure Management) - ⚠️ REVIEW

| Column | Type | Purpose | Verdict |
|--------|------|---------|---------|
| `exposure_vector` | varchar(50) | network/local/physical | ⚠️ Keep (enterprise) |
| `is_network_accessible` | bool | Can reach from network | ⚠️ Keep (enterprise) |
| `is_internet_accessible` | bool | Internet-facing | ⚠️ Keep (enterprise) |
| `attack_prerequisites` | text | Auth required? | ⚠️ Keep (enterprise) |
| `remediation_type` | varchar(50) | patch/upgrade/workaround | ⚠️ Keep (enterprise) |
| `estimated_fix_time` | int | Minutes to fix | ⚠️ Keep (enterprise) |
| `fix_complexity` | varchar(20) | simple/moderate/complex | ⚠️ Keep (enterprise) |
| `remedy_available` | bool | Is fix available | ⚠️ Keep (enterprise) |
| `data_exposure_risk` | varchar(20) | Data at risk level | ⚠️ Keep (enterprise) |
| `reputational_impact` | bool | Reputation risk | ⚠️ Keep (enterprise) |
| `compliance_impact` | text[] | PCI-DSS, HIPAA, etc | ⚠️ Keep (enterprise) |

**Nhận xét**: CTEM columns là enterprise features cho risk prioritization. Có thể move to separate table nhưng không urgent.

### 2.15. TIMESTAMPS ✅

| Column | Type | Purpose | Verdict |
|--------|------|---------|---------|
| `created_at` | timestamp | Row created | ✅ Keep |
| `updated_at` | timestamp | Row updated | ✅ Keep |
| `acceptance_expires_at` | timestamp | Risk acceptance expiry | ✅ Keep |

### 2.16. METADATA ✅

| Column | Type | Purpose | Verdict |
|--------|------|---------|---------|
| `metadata` | jsonb | Extra scanner data | ✅ Keep |

---

## 3. Issues Found

### 3.1. 🐛 BUG: `resolved_by` không được set

**Problem**: Khi user click "Resolved", `resolved_by` không được lưu.

**Root cause**: Trong `UpdateFindingStatusInput`, `ResolvedBy` được pass nhưng có thể là empty string.

**Fix needed in handler:**
```go
// vulnerability_handler.go
func (h *VulnerabilityHandler) UpdateFindingStatus(...) {
    actorID := middleware.GetUserID(r.Context())

    input := app.UpdateFindingStatusInput{
        Status:     req.Status,
        Resolution: req.Resolution,
        ResolvedBy: actorID,  // Always use actorID
        ActorID:    actorID,
    }
}
```

### 3.2. 🐛 BUG: `resolved_by` type mismatch

**Problem**: Column là `varchar(255)` nhưng nên là `uuid` với FK.

**Fix**: Migration để change type.

### 3.3. ⚠️ Inconsistent actor tracking

| Action | Actor Column | Type | Has FK |
|--------|--------------|------|--------|
| Assign | `assigned_by` | uuid | ✅ Yes |
| Verify | `verified_by` | uuid | ✅ Yes |
| Resolve | `resolved_by` | varchar | ❌ No |

**Fix**: Chuẩn hóa `resolved_by` thành uuid với FK.

---

## 4. Recommendations

### 4.1. KHÔNG XÓA (Keep all columns)

Sau khi review, tất cả các cột đều có purpose:

- `tool_version`: Debug, regression tracking
- `rule_name`: Human-readable display
- `description`: Detailed context (vs `message` = scanner output)
- `comments_count`: Counter cache for performance
- CTEM columns: Enterprise risk prioritization

### 4.2. FIX BUGS

1. **Fix `resolved_by` type**: varchar → uuid với FK
2. **Fix handler**: Always set `resolved_by` từ `actorID`

---

## 5. Implementation Plan

### Phase 1: Fix resolved_by Bug (Priority: HIGH)

**Step 1.1**: Update handler to always pass actorID
```go
// vulnerability_handler.go
input := app.UpdateFindingStatusInput{
    Status:     req.Status,
    Resolution: req.Resolution,
    ResolvedBy: actorID,  // Fix: use actorID instead of req.ResolvedBy
    ActorID:    actorID,
}
```

**Step 1.2**: Create migration to fix column type
```sql
-- 000121_fix_resolved_by_type.up.sql
-- Step 1: Add new column
ALTER TABLE findings ADD COLUMN resolved_by_user_id uuid;

-- Step 2: Try to migrate existing data (if they're UUIDs)
UPDATE findings
SET resolved_by_user_id = resolved_by::uuid
WHERE resolved_by IS NOT NULL
  AND resolved_by ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Step 3: Drop old column
ALTER TABLE findings DROP COLUMN resolved_by;

-- Step 4: Rename new column
ALTER TABLE findings RENAME COLUMN resolved_by_user_id TO resolved_by;

-- Step 5: Add FK constraint
ALTER TABLE findings
    ADD CONSTRAINT findings_resolved_by_fkey
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL;

-- Step 6: Add index
CREATE INDEX idx_findings_resolved_by ON findings(resolved_by) WHERE resolved_by IS NOT NULL;
```

**Step 1.3**: Update domain model
```go
// finding.go
resolvedBy *shared.ID  // Change from string to *shared.ID
```

**Step 1.4**: Update repository
```go
// finding_repository.go
resolvedBy sql.NullString → parseNullID(row.resolvedBy)
```

### Phase 2: Verify All Actor Tracking (Priority: MEDIUM)

Ensure consistent pattern across all actions:
- `assigned_by` ✅
- `verified_by` ✅
- `resolved_by` (after fix) ✅

---

## 6. Files to Modify

### Code Changes:
1. `api/internal/infra/http/handler/vulnerability_handler.go` - Fix handler
2. `api/internal/domain/vulnerability/finding.go` - Change `resolvedBy` type
3. `api/internal/infra/postgres/finding_repository.go` - Update scan/reconstruct

### Migrations:
1. `api/migrations/000121_fix_resolved_by_type.up.sql`
2. `api/migrations/000121_fix_resolved_by_type.down.sql`

---

## 7. Summary

| Category | Columns | Action |
|----------|---------|--------|
| Keep | 67 | No change |
| Fix bug | 1 (`resolved_by`) | Change type + fix handler |
| Remove | 0 | None needed |

**Key insight**: Bảng findings có nhiều cột nhưng đều có purpose. Vấn đề chính là bug `resolved_by` không được set và type không đúng.
