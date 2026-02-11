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

## Related Documentation

- [Finding Types & Fingerprinting](finding-types.md) - Type-aware deduplication and specialized fields
- [RFC: Finding Lifecycle & Auto-Resolve](/docs/_internal/rfcs/2026-01-28-finding-lifecycle-auto-resolve.md)
- [Scan Profiles](scan-profiles.md)
- [Agent Configuration](../guides/agent-configuration.md)
