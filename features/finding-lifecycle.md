---
layout: default
title: Finding Lifecycle
parent: Features
nav_order: 6
---

# Finding Lifecycle

> **Status**: ✅ Implemented
> **Version**: v1.0
> **Released**: 2026-01-28

## Overview

Finding Lifecycle manages the automatic status transitions of security findings based on scan results and branch context. This includes auto-resolving fixed vulnerabilities, auto-reopening recurring issues, and expiring stale feature branch findings.

## Problem Statement

Without lifecycle management:

1. **Fixed findings remain open** - Developers fix code but findings stay "open" indefinitely
2. **Dashboard clutter** - Stale feature branch findings pollute the main dashboard
3. **No audit trail** - Status changes happen without explanation
4. **Manual overhead** - Security teams must manually close fixed findings

## Solution: Branch-Aware Auto-Resolve

```
┌──────────────────────────────────────────────────────────────────┐
│                    FINDING LIFECYCLE                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  NEW ──► OPEN ──► CONFIRMED                                       │
│   │        │          │                                           │
│   └────────┴──────────┴────────────┐                              │
│                                    ▼                              │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│   │  RESOLVED    │  │FALSE_POSITIVE│  │ACCEPTED_RISK │           │
│   │ (auto/manual)│  │   (manual)   │  │   (manual)   │           │
│   └──────┬───────┘  └──────────────┘  └──────────────┘           │
│          │                  │                                     │
│          ▼                  │                                     │
│   ┌──────────────┐          │                                     │
│   │  RE-OPENED   │◄─────────┘ (only if auto-resolved)            │
│   └──────────────┘                                                │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Key Concepts

### Branch-Aware Resolution

Findings are linked to branches via `findings.branch_id` FK to `asset_branches` table. This enables:

| Scan Type | Branch | Auto-Resolve | Auto-Reopen |
|-----------|--------|--------------|-------------|
| Full | Default (main/master) | ✅ Yes | ✅ Yes |
| Full | Feature branch | ❌ No | ✅ Yes |
| Incremental | Any | ❌ No | ✅ Yes |

**Why only default branch?** Default branch is the source of truth. Feature branch findings are temporary and may be intentionally incomplete during development.

### Feature Branch Expiry

Findings on feature branches automatically expire after a configurable period:

- **Default**: 30 days since last seen
- **Configurable**: Per-branch via `asset_branches.retention_days`
- **Preserve option**: Set `keep_when_inactive = true` to prevent expiry

This prevents abandoned feature branches from cluttering the dashboard.

## How It Works

### 1. Branch Detection During Ingestion

When the agent submits scan results, it includes branch context from CI:

```go
// Agent detects from CI environment (GitHub Actions, GitLab CI)
BranchInfo{
    Name:            "feature/add-login",  // From GITHUB_REF_NAME
    IsDefaultBranch: false,                // Compared with default branch
    CommitSHA:       "abc123...",          // From GITHUB_SHA
    BaseBranch:      "main",               // For PRs: target branch
}
```

### 2. Branch Record Lookup/Create

The ingestion service looks up or creates the branch record:

```sql
-- Lookup existing branch
SELECT id FROM asset_branches WHERE asset_id = $1 AND name = $2;

-- Or create new branch
INSERT INTO asset_branches (asset_id, name, branch_type, is_default)
VALUES ($1, $2, 'feature', false);
```

### 3. Auto-Resolve on Default Branch

After a full scan completes on the default branch, findings not seen in the scan are auto-resolved:

```sql
UPDATE findings f SET
    status = 'resolved',
    resolution = 'auto_fixed',
    resolved_at = NOW()
FROM asset_branches ab
WHERE f.branch_id = ab.id
  AND ab.is_default = true          -- Only default branch
  AND f.status IN ('new', 'open')   -- Only active findings
  AND f.scan_id != $current_scan    -- Not in current scan
```

### 4. Auto-Reopen on Recurrence

If a finding reappears in a subsequent scan, it's automatically reopened:

```sql
UPDATE findings SET
    status = 'open',
    resolution = NULL,
    resolved_at = NULL
WHERE fingerprint = $1
  AND status = 'resolved'
  AND resolution = 'auto_fixed'     -- Only auto-resolved, not manual
```

### 5. Feature Branch Expiry (Background Job)

A background scheduler runs hourly to expire stale feature branch findings:

```sql
UPDATE findings f SET
    status = 'resolved',
    resolution = 'branch_expired'
FROM asset_branches ab
WHERE f.branch_id = ab.id
  AND ab.is_default = false             -- Only feature branches
  AND ab.keep_when_inactive = false     -- Respect retention settings
  AND f.last_seen_at < NOW() - (COALESCE(ab.retention_days, 30) || ' days')::INTERVAL
```

## Protected Statuses

The following statuses are **never** auto-resolved or auto-reopened:

| Status | Reason |
|--------|--------|
| `false_positive` | Manual triage decision by security team |
| `accepted_risk` | Explicit risk acceptance with justification |
| `duplicate` | Linked to another finding |

## Resolution Types

| Resolution | Description | Auto-Reopen? |
|------------|-------------|--------------|
| `auto_fixed` | System resolved (not in scan) | ✅ Yes |
| `manual_fixed` | User marked as fixed | ❌ No |
| `false_positive` | Manual triage | ❌ No |
| `accepted_risk` | Risk accepted | ❌ No |
| `branch_expired` | Feature branch expired | ✅ Yes |

## Configuration

### Branch Retention Settings

Configure via API or UI per branch:

```json
{
  "keep_when_inactive": false,  // Allow expiry
  "retention_days": 14          // Expire after 14 days
}
```

### Scheduler Configuration

The `FindingLifecycleScheduler` can be configured:

```go
FindingLifecycleSchedulerConfig{
    CheckInterval:     1 * time.Hour,  // How often to run
    DefaultExpiryDays: 30,             // Default if branch has no retention_days
    Enabled:           true,           // Enable/disable scheduler
}
```

## CI Integration

### GitHub Actions

```yaml
- name: Run Security Scan
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    # Agent auto-detects:
    # - GITHUB_REF_NAME (branch name)
    # - GITHUB_SHA (commit)
    # - GITHUB_EVENT_NAME (push/pull_request)
    # - Default branch from GITHUB_EVENT_PATH
    openctem-agent scan --target .
```

### GitLab CI

```yaml
security_scan:
  script:
    # Agent auto-detects:
    # - CI_COMMIT_BRANCH (branch name)
    # - CI_COMMIT_SHA (commit)
    # - CI_DEFAULT_BRANCH (default branch)
    # - CI_MERGE_REQUEST_IID (MR number)
    - openctem-agent scan --target .
```

## Metrics

The following Prometheus metrics are exported:

| Metric | Description | Labels |
|--------|-------------|--------|
| `findings_expired_total` | Findings expired by lifecycle rules | `tenant_id`, `reason` |
| `findings_auto_resolved_total` | Findings auto-resolved by full scans | `tenant_id` |

## API Reference

### Get Finding with Lifecycle Info

```
GET /api/v1/findings/{id}
```

Response includes:

```json
{
  "id": "...",
  "status": "resolved",
  "resolution": "auto_fixed",
  "resolved_at": "2026-01-28T10:00:00Z",
  "branch_id": "...",
  "first_detected_branch": "feature/add-login",
  "last_seen_branch": "main",
  "last_seen_at": "2026-01-27T10:00:00Z"
}
```

### Configure Branch Retention

```
PATCH /api/v1/branches/{id}
```

Request:

```json
{
  "keep_when_inactive": false,
  "retention_days": 14
}
```

## Best Practices

1. **Use full scans on default branch** - Enables auto-resolve
2. **Set appropriate retention** - Balance between cleanup and preserving context
3. **Review auto-resolved findings** - Periodically audit the `auto_fixed` resolutions
4. **Protect important branches** - Set `keep_when_inactive = true` for release branches

## Troubleshooting

### Findings not auto-resolving

1. Check scan coverage type: `coverage_type` must be `full`
2. Check branch: Auto-resolve only works on default branch
3. Check `branch_id`: Finding must have a linked branch record

### Feature branch findings not expiring

1. Check `keep_when_inactive`: Must be `false`
2. Check `last_seen_at`: Must be older than retention period
3. Check scheduler: `FindingLifecycleScheduler` must be running

## Activity Logging (Audit Trail)

Every auto-resolve and auto-reopen event creates an immutable activity record for compliance and debugging.

### Activity Types

| Type | Trigger | Actor | Source |
|------|---------|-------|--------|
| `auto_resolved` | Finding not in full scan | `system` | `auto` |
| `auto_reopened` | Resolved finding reappears | `system` | `auto` |
| `status_changed` | Manual status change | `user` | `api` |

### How It Works

```
┌──────────────────────────────────────────────────────────────┐
│                    INGEST PIPELINE                              │
│                                                                │
│  For each asset:                                               │
│    AutoResolveStale() ──► collect resolved IDs                 │
│                                                                │
│  After all assets processed:                                   │
│    RecordBatchAutoResolved(allResolvedIDs) ──► single batch    │
│                                                INSERT          │
│                                                                │
│  For each new finding:                                         │
│    AutoReopenByFingerprint() ──► collect reopened IDs          │
│    RecordBatchAutoReopened(reopenedIDs)                        │
└──────────────────────────────────────────────────────────────┘
```

### Activity Record Structure

```json
{
  "id": "act-abc123",
  "finding_id": "fnd-xyz789",
  "activity_type": "auto_resolved",
  "actor_type": "system",
  "actor_id": null,
  "source": "auto",
  "changes": {
    "scanner": "nuclei",
    "scan_id": "scan-456",
    "reason": "not_found_in_full_scan"
  },
  "created_at": "2026-03-04T10:00:00Z"
}
```

### Performance: Batched INSERT

Activity records are written in batches to avoid N+1 query issues:

- **Collection phase**: All resolved/reopened finding IDs are collected across assets
- **Write phase**: Single `CreateBatch()` call with chunked INSERTs (100 per chunk)
- **Result**: ~200 findings resolved = 2-3 INSERT queries (not 200)

### API Reference

```
GET /api/v1/findings/{id}/activities?limit=20
```

Response:

```json
{
  "data": [
    {
      "id": "act-abc123",
      "activity_type": "auto_resolved",
      "actor_type": "system",
      "changes": {"scanner": "nuclei", "reason": "not_found_in_full_scan"},
      "created_at": "2026-03-04T10:00:00Z"
    },
    {
      "id": "act-def456",
      "activity_type": "auto_reopened",
      "actor_type": "system",
      "changes": {"reason": "finding_detected_again"},
      "created_at": "2026-03-05T10:00:00Z"
    }
  ],
  "total": 2
}
```

### Key Files

| File | Description |
|------|-------------|
| `api/internal/app/finding_activity_service.go` | `RecordBatchAutoResolved()`, `RecordBatchAutoReopened()` |
| `api/internal/infra/postgres/finding_activity_repository.go` | `CreateBatch()` with chunked INSERT |
| `api/internal/app/ingest/service.go` | Activity service wiring in ingest pipeline |
| `api/tests/unit/finding_lifecycle_activity_test.go` | 12 unit tests |
| `api/scripts/tests/test_e2e_finding_activities.sh` | E2E test script |

---

## v2.0: Closed-Loop Remediation Lifecycle

> **Status**: ✅ Implemented
> **Version**: v2.0
> **Released**: 2026-03-20

### Overview

Extends v1.0 with a **closed-loop workflow** where developers mark findings as fixed, then scanners or security team verify before closing. Prevents premature resolution and provides trusted progress tracking.

### Status Flow

```
new → confirmed → in_progress → fix_applied → resolved
                                     ↑              ↑
                                  Dev/Owner      Scanner verify
                                  (fix_apply)    OR Security approve
                                     │
                               fix_applied → in_progress (reject)
                               resolved → confirmed (regression)
```

**Key rule:** `in_progress → resolved` is **blocked**. Developers cannot self-close findings — they must go through `fix_applied` → scanner/security verification.

### New Status: `fix_applied`

| Field | Value |
|-------|-------|
| Status | `fix_applied` |
| Category | `in_progress` (active, not closed) |
| Who can set | Assignee, group member, or asset owner (`findings:fix_apply` permission) |
| Requires | Note describing what was done (mandatory) |
| Next steps | Scanner verify → `resolved` OR Security reject → `in_progress` |

### Resolution Method Tracking

When a finding is resolved, `resolution_method` records how:

| Method | Description |
|--------|-------------|
| `legacy` | Resolved before v2.0 (backward compat) |
| `scan_verified` | Scanner confirmed vulnerability is gone |
| `security_reviewed` | Security team manually approved |
| `admin_direct` | Admin/Owner direct resolve (escape hatch) |

### Permissions

| Permission | Who | Purpose |
|-----------|-----|---------|
| `findings:fix_apply` | Owner, Admin, Member | Mark findings as fix applied |
| `findings:verify` | Owner, Admin only | Verify/reject fix-applied findings, direct resolve |

### Multi-Dimension Group View

Group findings by 7 dimensions to handle any remediation scenario:

| Dimension | Use Case |
|-----------|----------|
| `cve_id` | "CVE-2021-44228 affects 1000 hosts" |
| `asset_id` | "Host C has 4 vulnerabilities" |
| `owner_id` | "Alice responsible for 7 findings" |
| `component_id` | "log4j-core@2.14.0 has 3 CVEs" |
| `severity` | "500 critical, 300 high" |
| `source` | "SCA: 400, SAST: 200" |
| `finding_type` | "800 vulns, 100 secrets" |

### Multi-Owner Authorization

Multiple people can mark fix_applied on the same finding:

1. **Direct assignee** — user assigned to the finding
2. **Group member** — any member of the group assigned to the finding
3. **Asset owner** — owner of the asset where the finding exists

### Related CVEs

When marking a CVE as fixed, the system suggests related CVEs on the same component that would also be fixed by the same upgrade. Example: upgrading log4j-core also fixes CVE-2021-45046 and CVE-2021-45105.

### Auto-Assign to Owners

Bulk-assign unassigned findings to their asset owners with one click. Skips findings already assigned.

### API Reference

```
GET  /api/v1/findings/groups?group_by=cve_id&severities=critical,high
GET  /api/v1/findings/related-cves/{cveId}
POST /api/v1/findings/actions/fix-applied
POST /api/v1/findings/actions/verify
POST /api/v1/findings/actions/reject-fix
POST /api/v1/findings/actions/assign-to-owners
```

### Dashboard Progress

4-column progress bar per group:

```
🔴 Open | 🔵 Fixing | 🟡 Fix Applied | ✅ Resolved
  400      100           300              200
```

Progress % = Resolved / Total (only scanner-verified counts).

### Key Files

| File | Description |
|------|-------------|
| `api/internal/app/finding_lifecycle_service.go` | Business logic (6 methods) |
| `api/internal/infra/postgres/finding_group_repository.go` | 7 GROUP BY queries + bulk ops |
| `api/internal/infra/http/handler/finding_lifecycle_handler.go` | 6 REST endpoints |
| `api/internal/infra/http/routes/finding_lifecycle.go` | Route registration |
| `api/pkg/domain/vulnerability/finding_lifecycle_test.go` | 38 unit tests |
| `api/migrations/000096_fix_applied_status.up.sql` | Migration (column + 3 indexes + permissions) |
| `ui/src/features/findings/components/finding-groups-tab.tsx` | Groups tab UI |
| `ui/src/features/findings/components/mark-fixed-dialog.tsx` | Mark Fixed dialog |
| `ui/src/features/findings/components/pending-review-tab.tsx` | Pending Review tab |

---

## Related Documentation

- [Finding Types & Fingerprinting](finding-types.md) - Type-aware deduplication and specialized fields
- [CTIS Domain Mapping](../architecture/ctis-domain-mapping.md) - How CTIS fields map to domain entities
- [Scan Configurations](scan-configs.md) - Scan setup and scheduling
- [Agent Configuration](../guides/agent-configuration.md)
