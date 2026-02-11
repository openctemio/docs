---
layout: default
title: Finding Repository Queries
parent: Database
nav_order: 5
---

# Finding Repository SQL Queries

This document details the SQL queries used in the Finding Repository, with focus on performance optimization and the ingestion flow.

## Query Overview

| Method | Query Type | Performance | Use Case |
|--------|-----------|-------------|----------|
| `CheckFingerprintsExist` | SELECT | O(1) batch | Deduplication check |
| `CreateBatch` | INSERT (tx) | O(1) transaction | Bulk insert findings |
| `UpdateScanIDBatchByFingerprints` | UPDATE | O(1) batch | Update existing findings |
| `AutoReopenByFingerprintsBatch` | UPDATE | O(1) batch | Reopen auto-resolved |
| `AutoResolveStale` | UPDATE + JOIN | O(1) | Close missing findings |

## Ingestion Flow

When processing a scan report with N findings, the system executes approximately **5 queries** regardless of N:

```
ProcessBatch(report with 500 findings)
    │
    ├─ Query 1: CheckFingerprintsExist(500 fingerprints)
    │           → SELECT fingerprint WHERE fingerprint IN ($1..$500)
    │           → Returns: 300 existing, 200 new
    │
    ├─ Query 2: AutoReopenByFingerprintsBatch(300 existing)
    │           → UPDATE ... WHERE fingerprint = ANY($2) AND resolution='auto_fixed'
    │           → Returns: map[fingerprint]→ID for reopened ones
    │
    ├─ Query 3: CreateBatch(200 new findings)
    │           → INSERT ... (in single transaction)
    │
    ├─ Query 4: UpdateScanIDBatchByFingerprints(300 existing)
    │           → UPDATE ... SET scan_id=$1 WHERE fingerprint = ANY($3)
    │
    └─ Query 5: AutoResolveStale (if applicable)
                → UPDATE ... WHERE scan_id != $4 AND rb.is_default=true
```

## Key Queries

### 1. CheckFingerprintsExist

Checks which fingerprints already exist in the database.

```sql
SELECT fingerprint
FROM findings
WHERE tenant_id = $1 AND fingerprint IN ($2, $3, ..., $N)
```

**Index Used**: `idx_findings_tenant_fingerprint` (tenant_id, fingerprint)

**Performance**: Single query for N fingerprints, returns map[string]bool.

### 2. CreateBatch

Batch inserts new findings in a single transaction.

```sql
BEGIN;
INSERT INTO findings (id, tenant_id, asset_id, ..., fingerprint, ...)
VALUES ($1, $2, $3, ..., $N);
-- Repeat for each finding
COMMIT;
```

**Performance**: Single transaction, atomic operation. Uses prepared statements internally.

### 3. UpdateScanIDBatchByFingerprints

Updates scan metadata for existing findings without changing their status.

```sql
UPDATE findings
SET scan_id = $1, updated_at = NOW(), last_seen_at = NOW()
WHERE tenant_id = $2 AND fingerprint = ANY($3)
```

**Key Point**: Status is **NOT** updated to preserve user-set values (false_positive, accepted, etc.)

**Index Used**: `idx_findings_tenant_fingerprint`

### 4. AutoReopenByFingerprintsBatch

Reopens previously auto-resolved findings when they reappear in a scan.

```sql
UPDATE findings
SET status = 'open',
    resolution = NULL,
    resolved_at = NULL,
    resolved_by = NULL,
    updated_at = NOW()
WHERE tenant_id = $1
    AND fingerprint = ANY($2)
    AND status = 'resolved'
    AND resolution = 'auto_fixed'
RETURNING id, fingerprint
```

**Key Points**:
- Only reopens findings with `resolution = 'auto_fixed'`
- Protected resolutions (`false_positive`, `accepted_risk`) are NEVER reopened
- Returns map of fingerprint → reopened finding ID

**Performance Improvement**: Replaced N individual queries with 1 batch query.

| Before | After |
|--------|-------|
| 500 findings = 500 queries | 500 findings = 1 query |

### 5. AutoResolveStale

Auto-resolves findings that are no longer detected on the default branch.

```sql
UPDATE findings f
SET status = 'resolved',
    resolution = 'auto_fixed',
    resolved_at = NOW(),
    updated_at = NOW()
FROM repository_branches rb
WHERE f.tenant_id = $1
    AND f.asset_id = $2
    AND f.tool_name = $3
    AND f.scan_id != $4
    AND f.branch_id = rb.id
    AND rb.is_default = true
    AND f.status IN ('new', 'open', 'confirmed', 'in_progress')
RETURNING f.id
```

**Key Points**:
- Only affects findings on **default branches** (via JOIN with repository_branches)
- Protected statuses are excluded from auto-resolve
- Uses `scan_id != $4` to identify stale findings

### 6. ExpireFeatureBranchFindings

Background job to expire stale feature branch findings.

```sql
UPDATE findings f
SET status = 'resolved',
    resolution = 'branch_expired',
    resolved_at = NOW(),
    updated_at = NOW()
FROM repository_branches rb
WHERE f.tenant_id = $1
    AND f.branch_id = rb.id
    AND rb.is_default = false
    AND rb.keep_when_inactive = false
    AND f.status IN ('new', 'open')
    AND f.last_seen_at < NOW() - INTERVAL '1 day' * COALESCE(rb.expiry_days, $2)
```

**Key Points**:
- Per-branch expiry configuration via `rb.expiry_days`
- `keep_when_inactive = false` allows opting out of expiry
- Resolution is `branch_expired` (distinct from `auto_fixed`)

## Indexes

Critical indexes for the ingestion flow:

```sql
-- Primary deduplication index
CREATE INDEX idx_findings_tenant_fingerprint
ON findings(tenant_id, fingerprint);

-- Auto-resolve queries
CREATE INDEX idx_findings_auto_resolve
ON findings(tenant_id, asset_id, tool_name, status)
WHERE status IN ('new', 'open', 'confirmed', 'in_progress');

-- Branch lifecycle
CREATE INDEX idx_findings_branch_status
ON findings(branch_id, status)
WHERE branch_id IS NOT NULL;
```

## Performance Metrics

For a typical scan with 500 findings:

| Scenario | Before Optimization | After Optimization |
|----------|--------------------|--------------------|
| All new findings | ~503 queries | ~3 queries |
| All existing findings | ~1003 queries | ~4 queries |
| Mixed (300 exist, 200 new) | ~803 queries | ~5 queries |

**Reduction**: 99%+ fewer database queries.

## Branch-Aware Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    Default Branch Scan                       │
├─────────────────────────────────────────────────────────────┤
│  Finding detected    →  status = 'open'                     │
│  Finding not in scan →  status = 'resolved'                 │
│                         resolution = 'auto_fixed'           │
│  Finding reappears   →  status = 'open' (auto-reopen)      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   Feature Branch Scan                        │
├─────────────────────────────────────────────────────────────┤
│  Finding detected    →  status = 'open'                     │
│  Branch merged/stale →  status = 'resolved'                 │
│                         resolution = 'branch_expired'       │
│  (No auto-reopen for expired branches)                      │
└─────────────────────────────────────────────────────────────┘
```

## Protected Resolutions

These resolutions are NEVER automatically changed:

| Resolution | Description |
|------------|-------------|
| `false_positive` | Manually marked as not a real issue |
| `accepted_risk` | Risk acknowledged by security team |
| `wont_fix` | Intentionally not fixing |
| `duplicate` | Duplicate of another finding |

Only `auto_fixed` and `branch_expired` resolutions can be reopened automatically.
