# RFC: Finding Lifecycle & Auto-Resolve

**Date:** 2026-01-28
**Status:** Draft
**Author:** Security Engineering Team

---

## Summary

This RFC defines the finding lifecycle management system, including auto-resolve for fixed vulnerabilities, branch-aware finding tracking, and platform-controlled suppression rules. The design is based on industry best practices from SonarQube, Semgrep, GitHub Advanced Security, GitLab SAST, and DefectDojo.

---

## Problem Statement

### Current Issues

1. **No Auto-Resolve**: Findings that no longer appear in scans remain "open" indefinitely
2. **In-Code Suppression Risk**: Developers can bypass security checks via `.semgrepignore`, `// nosemgrep` comments
3. **No Audit Trail**: No tracking of who suppressed what and why
4. **No Expiration**: Suppressions are permanent without review

### Goals

- Auto-resolve findings when code is fixed (detected by subsequent scans)
- Centralize suppression control on platform (not in code)
- Maintain full audit trail for compliance
- Support expiration and periodic review of suppressions

---

## Industry Research

### How Leading Platforms Handle This

| Platform | Auto-Resolve | Suppression Control | Re-open | Key Feature |
|----------|--------------|---------------------|---------|-------------|
| **SonarQube** | ✅ When not found | Platform manual | ✅ Auto | `//NOSONAR` disabled by default |
| **Semgrep** | ✅ "Removed" status | Platform triage | ✅ Auto | Triage applies across branches |
| **GitHub** | ✅ "Fixed" status | Platform dismiss | ✅ Manual | SARIF suppression sync |
| **DefectDojo** | ✅ `close_old_findings` | Platform + configurable | ✅ Configurable | Cross-scanner dedup |
| **Veracode** | ✅ SCA work items | Ticket system | - | Azure DevOps integration |
| **GitLab** | ✅ 90-day expiry | Platform | ✅ On merge | Finding vs Vulnerability distinction |

### Key Insights

1. **Platform is source of truth** - All platforms centralize suppression control
2. **Auto-resolve requires full scan** - Only when scanner covers same scope
3. **Manual status is protected** - `false_positive` not auto-reopened
4. **Audit trail is mandatory** - Who, when, why for every status change
5. **Default branch is authoritative** - GitHub/GitLab treat default branch as source of truth
6. **Feature branch findings are temporary** - GitLab expires findings after 90 days if not merged

### Branch Handling: GitHub vs GitLab

#### GitHub Code Scanning
- Default branch is source of truth for alert status
- Alerts on non-default branches show as "in pull request" or "in branch" (grey)
- PR scans show only new alerts introduced by the PR
- Auto-dismiss when code is fixed on default branch
- Cross-branch visibility: same alert can be fixed on one branch but open on another

#### GitLab SAST
- **Finding**: Detected on feature branch (temporary)
- **Vulnerability**: When merged to default branch (confirmed)
- 90-day expiry for findings not merged
- MR widget shows newly introduced or resolved findings
- Diff-based scanning for MRs (since GitLab 18.6)

---

## Proposed Design

### Branch-Aware Finding Strategy

Based on GitHub and GitLab best practices, OpenCTEM implements a **normalized approach** leveraging the existing `asset_branches` infrastructure:

#### Core Principles

1. **Default branch is source of truth** (like GitHub)
   - Findings on default branch = confirmed vulnerabilities
   - Auto-resolve only applies to default branch scans
   - Dashboard metrics focus on default branch findings

2. **Leverage existing `asset_branches` table** (optimal)
   - `findings.branch_id` FK → `asset_branches.id` already exists
   - `asset_branches.is_default` is the single source of truth
   - No denormalized `is_default_branch` column needed on findings
   - Simpler data model, no sync issues when default branch changes

3. **Branch-scoped tracking with fingerprint deduplication**
   - Same fingerprint = same finding (across branches)
   - `first_detected_branch`, `last_seen_branch` track discovery/history (string names)
   - `branch_id` FK links to full branch entity for accurate queries

4. **Feature branch findings have TTL** (like GitLab)
   - Non-default branch findings expire after configurable period
   - Uses `asset_branches.retention_days` (existing column!)
   - Prevents stale feature branch findings from cluttering dashboard

5. **PR/MR scan mode**
   - `coverage_type: incremental` for PR scans
   - Only report new findings in the diff
   - Never auto-resolve on incremental scans

#### Why NOT Denormalize `is_default_branch`?

| Approach | Pros | Cons |
|----------|------|------|
| **Denormalized column** | Faster queries (no JOIN) | Data can become stale, duplication, needs sync job |
| **FK + JOIN** ✅ | Single source of truth, auto-updates | JOIN required for queries |

The JOIN cost is negligible since we already have indexes on `branch_id` and `asset_branches.is_default`.
If performance becomes an issue, we can add a materialized view or denormalize later.

#### Branch Context in Ingestion

```go
// Input includes branch context from CI
type Input struct {
    Report       *ctis.Report
    CoverageType CoverageType // full, incremental, partial
    BranchInfo   *BranchInfo  // Branch context from CI
}

type BranchInfo struct {
    Name            string `json:"name"`              // "main", "feature/xyz"
    IsDefaultBranch bool   `json:"is_default_branch"` // Hint from CI (may differ from DB)
    CommitSHA       string `json:"commit_sha"`
    BaseBranch      string `json:"base_branch,omitempty"` // For PRs: "main"
}
```

**Note**: `BranchInfo.IsDefaultBranch` is a hint from CI. The ingest service will:
1. Look up or create `asset_branches` record
2. Use `asset_branches.is_default` as authoritative source
3. Set `findings.branch_id` FK to the branch record

#### Auto-Resolve Rules by Branch Type

| Scan Type | Branch | Auto-Resolve | Auto-Reopen |
|-----------|--------|--------------|-------------|
| Full | Default (main/master) | ✅ Yes | ✅ Yes |
| Full | Feature branch | ❌ No | ✅ Yes |
| Incremental | Any | ❌ No | ✅ Yes |
| Partial | Any | ❌ No | ✅ Yes |

### Finding Status Lifecycle

```
                    ┌─────────────────────────────────────────┐
                    │           FINDING LIFECYCLE              │
                    └─────────────────────────────────────────┘

     ┌──────────┐         ┌───────────┐         ┌──────────┐
     │   NEW    │────────►│   OPEN    │────────►│ CONFIRMED│
     └──────────┘         └───────────┘         └──────────┘
          │                    │                      │
          │                    │                      │
          ▼                    ▼                      ▼
     ┌─────────────────────────────────────────────────────┐
     │                    RESOLUTION                        │
     │                                                      │
     │   ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
     │   │   RESOLVED   │  │FALSE_POSITIVE│  │ACCEPTED   │ │
     │   │  (auto/manual)│  │   (manual)   │  │   CTISK    │ │
     │   └──────────────┘  └──────────────┘  └───────────┘ │
     │          │                 │                 │       │
     │          │                 │                 │       │
     │          ▼                 │                 │       │
     │   ┌──────────────┐        │                 │       │
     │   │ RE-OPENED    │◄───────┼─────────────────┘       │
     │   │(if reappears)│        │                         │
     │   └──────────────┘        │                         │
     │                           │                         │
     │                    NOT auto-reopened                │
     │                    (protected status)               │
     └─────────────────────────────────────────────────────┘
```

### Auto-Resolve Logic

```sql
-- Auto-resolve findings not seen in current full scan
-- CRITICAL: Only for default branch scans (using JOIN to asset_branches)
UPDATE findings f SET
    status = 'resolved',
    resolution = 'auto_fixed',
    resolved_at = NOW(),
    updated_at = NOW()
FROM asset_branches ab
WHERE
    f.tenant_id = $1
    AND f.asset_id = $2
    AND f.tool_name = $3
    AND f.branch_id = ab.id              -- JOIN to asset_branches
    AND ab.is_default = true             -- Only default branch findings
    AND f.status IN ('new', 'open', 'confirmed', 'in_progress')
    AND f.scan_id != $4                  -- Not in current scan
RETURNING f.id
```

**Alternative for findings without branch_id** (legacy/global findings):
```sql
-- For findings where branch_id IS NULL, we DON'T auto-resolve
-- (unknown branch context = unknown if default or not)
-- Only auto-resolve if we KNOW it's on default branch
```

**Conditions for Auto-Resolve:**
1. Scan must be `coverage_type = 'full'` (not incremental/diff)
2. Finding must have `branch_id` pointing to a branch where `is_default = true`
3. Same `asset_id` + `tool_name` combination
4. Finding status is "active" (new, open, confirmed, in_progress)
5. Finding not updated by current scan (via scan_id mismatch)

**Protected Statuses (never auto-resolved):**
- `false_positive` - Manual triage decision
- `accepted_risk` - Explicit risk acceptance
- `duplicate` - Linked to another finding
- `resolved` - Already resolved

### Auto-Reopen Logic

```sql
-- Check if finding with same fingerprint was previously resolved
-- If exists and resolution = 'auto_fixed', reopen it
UPDATE findings SET
    status = 'open',
    resolution = NULL,
    resolved_at = NULL,
    updated_at = NOW()
WHERE
    tenant_id = $1
    AND fingerprint = $2
    AND status = 'resolved'
    AND resolution = 'auto_fixed'  -- Only reopen auto-resolved
RETURNING id
```

**Protected Statuses (never auto-reopened):**
- `false_positive` - Manual triage decision
- `accepted_risk` - Explicit risk acceptance
- `duplicate` - Linked to another finding

### Branch Tracking Fields

Findings track branch history for traceability:

```go
type Finding struct {
    // Existing fields...

    // Branch reference (normalized)
    BranchID            *shared.ID // FK to asset_branches.id - authoritative branch link

    // Branch tracking (denormalized for history/audit)
    FirstDetectedBranch string     // Branch NAME where finding was first discovered
    FirstDetectedCommit string     // Commit SHA of first detection
    LastSeenBranch      string     // Most recent branch NAME where finding was seen
    LastSeenCommit      string     // Most recent commit SHA

    // Timestamps
    FirstDetectedAt     time.Time  // When first detected
    LastSeenAt          time.Time  // When last seen in a scan
}
```

**Key Design Decisions:**
- `BranchID` is FK to `asset_branches.id` - use for queries requiring `is_default` check
- `FirstDetectedBranch`, `LastSeenBranch` are string names - for audit/history only
- No `IsDefaultBranch` boolean on finding - derive from JOIN when needed

### Feature Branch Finding Expiry

Non-default branch findings expire automatically using `asset_branches.retention_days`:

```sql
-- Background job: Clean up stale feature branch findings
-- Uses existing retention_days from asset_branches table
UPDATE findings f SET
    status = 'resolved',
    resolution = 'branch_expired',
    resolved_at = NOW(),
    updated_at = NOW()
FROM asset_branches ab
WHERE
    f.tenant_id = $1
    AND f.branch_id = ab.id
    AND ab.is_default = false                        -- Only non-default branches
    AND ab.keep_when_inactive = false                -- Respect branch retention settings
    AND f.status IN ('new', 'open')
    AND f.last_seen_at < NOW() - (COALESCE(ab.retention_days, 30) || ' days')::INTERVAL
RETURNING f.id
```

**Benefits of using existing infrastructure:**
- `asset_branches.retention_days` already exists - configurable per branch
- `asset_branches.keep_when_inactive` flag - some branches should never expire
- No new columns needed on findings table

This prevents feature branches that are abandoned from polluting the finding dashboard.

### Suppression Rules (Platform-Controlled)

#### Database Schema

```sql
CREATE TABLE suppression_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    -- Scope (at least one required)
    asset_id UUID REFERENCES assets(id),      -- NULL = all assets
    asset_group_id UUID REFERENCES asset_groups(id),

    -- Matching criteria
    tool_name VARCHAR(100),                   -- NULL = all tools
    rule_id VARCHAR(255),                     -- Supports wildcard: "semgrep.security.*"
    path_pattern VARCHAR(500),                -- Glob: "tests/**", "*.test.go"
    severity VARCHAR(20),                     -- NULL = all severities

    -- Suppression details
    suppression_type VARCHAR(30) NOT NULL,    -- false_positive, accepted_risk, wont_fix
    justification TEXT NOT NULL,
    ticket_url VARCHAR(500),                  -- Optional: link to Jira/GitHub issue

    -- Approval workflow
    status VARCHAR(20) DEFAULT 'pending',     -- pending, approved, rejected, expired
    requested_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    rejected_reason TEXT,

    -- Expiration
    expires_at TIMESTAMP,                     -- NULL = permanent (requires elevated permission)

    -- Audit
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT at_least_one_criteria CHECK (
        tool_name IS NOT NULL OR
        rule_id IS NOT NULL OR
        path_pattern IS NOT NULL
    )
);

CREATE INDEX idx_suppression_rules_tenant ON suppression_rules(tenant_id);
CREATE INDEX idx_suppression_rules_asset ON suppression_rules(asset_id);
CREATE INDEX idx_suppression_rules_status ON suppression_rules(status) WHERE status = 'approved';
```

#### Suppression Rule Matching

```go
// SuppressionRule represents a platform-controlled suppression rule.
type SuppressionRule struct {
    ID              string     `json:"id"`
    ToolName        string     `json:"tool_name,omitempty"`
    RuleID          string     `json:"rule_id,omitempty"`      // Supports "semgrep.*" wildcard
    PathPattern     string     `json:"path_pattern,omitempty"` // Glob pattern
    Severity        string     `json:"severity,omitempty"`
    SuppressionType string     `json:"suppression_type"`
    Justification   string     `json:"justification"`
    ExpiresAt       *time.Time `json:"expires_at,omitempty"`
}

// Matching priority (all conditions must match if specified):
// 1. tool_name - exact match (case-insensitive)
// 2. rule_id - exact or wildcard suffix match
// 3. path_pattern - glob match with ** support
// 4. severity - exact match
```

### Activity Logging

Every status change creates an immutable activity record:

```go
// Activity types for finding lifecycle
const (
    ActivityCreated         = "created"
    ActivityStatusChanged   = "status_changed"
    ActivityAutoResolved    = "auto_resolved"    // System resolved (not in scan)
    ActivityAutoReopened    = "auto_reopened"    // System reopened (reappeared)
    ActivityManualResolved  = "manual_resolved"  // User resolved
    ActivitySuppressed      = "suppressed"       // Matched suppression rule
    ActivityUnsuppressed    = "unsuppressed"     // Rule expired/removed
)

// Activity record
type FindingActivity struct {
    ID           string                 `json:"id"`
    FindingID    string                 `json:"finding_id"`
    ActivityType string                 `json:"activity_type"`
    ActorType    string                 `json:"actor_type"`  // user, system, scanner
    ActorID      *string                `json:"actor_id"`
    Changes      map[string]interface{} `json:"changes"`
    Source       string                 `json:"source"`      // api, ci, scheduled
    CreatedAt    time.Time              `json:"created_at"`
}
```

---

## API Design

### Suppression Rules API

```yaml
# List suppression rules
GET /api/v1/suppression-rules
Query params: asset_id, tool_name, status, page, limit

# Create suppression rule (requires approval if permanent)
POST /api/v1/suppression-rules
{
  "asset_id": "uuid",           # Optional
  "tool_name": "semgrep",       # Optional
  "rule_id": "security.*",      # Wildcard supported
  "path_pattern": "tests/**",   # Glob supported
  "suppression_type": "false_positive",
  "justification": "Test fixtures, not production code",
  "expires_at": "2026-07-01T00:00:00Z"  # Optional
}

# Approve/Reject rule (security admin only)
POST /api/v1/suppression-rules/{id}/approve
POST /api/v1/suppression-rules/{id}/reject
{
  "reason": "Insufficient justification"
}

# Get rules for agent (used by CI)
GET /api/v1/suppression-rules/for-scan
Query params: asset_id, tool_name
Returns: Active, approved rules matching criteria
```

### Agent Integration

```go
// Agent fetches suppression rules before security gate
func (a *Agent) runSecurityGate(reports []*ctis.Report, failOn string) int {
    // Fetch suppressions from platform
    suppressions, err := a.client.GetSuppressionRules(ctx, GetSuppressionRulesInput{
        AssetID:  a.assetID,
        ToolName: a.toolName,
    })
    if err != nil {
        // Log warning but continue without suppressions
        log.Warn("failed to fetch suppression rules", "error", err)
        suppressions = nil
    }

    // Apply suppressions to security gate
    return gate.CheckWithSuppressions(reports, failOn, a.verbose, suppressions)
}
```

---

## Implementation Plan

### Phase 1: Auto-Resolve (Complete ✅)

1. ✅ Add `coverage_type` field to scan metadata (CTIS schema)
2. ✅ Implement auto-resolve logic in ingest service
3. ✅ Implement auto-reopen logic for recurring findings
4. ✅ Add activity logging for auto_resolved/auto_reopened

### Phase 2: Branch-Aware Lifecycle (Complete ✅)

1. ✅ Add `BranchInfo` to ingest Input struct (sdk/pkg/ctis/types.go)
2. ~~Add `is_default_branch` field to findings table~~ **REMOVED** - use `branch_id` FK instead
3. ✅ Update auto-resolve to use JOIN with `asset_branches.is_default`
4. ✅ Add branch info to CTIS Report metadata
5. ✅ Update agent to pass branch context from CI
   - `sdk/pkg/core/interfaces.go`: Added `BranchInfo` to `ParseOptions`
   - `sdk/pkg/ctis/sarif.go`: Added `BranchInfo` to `ConvertOptions`, set `report.Metadata.Branch`
   - `agent/main.go`: Added `buildBranchInfo()` to create `BranchInfo` from CI env (GitHub Actions, GitLab CI)
6. ✅ Look up/create `asset_branches` record during ingestion
7. ✅ Set `findings.branch_id` FK during ingestion

### Phase 3: Branch Cleanup & Expiry (Complete ✅)

1. ✅ Add background job for feature branch finding expiry
   - `api/internal/app/finding_lifecycle_scheduler.go`: `FindingLifecycleScheduler` runs hourly
   - Calls `ExpireFeatureBranchFindings()` for each tenant
2. ✅ Use existing `asset_branches.retention_days` and `keep_when_inactive` columns
3. ✅ Add `resolution = 'branch_expired'` type (in `finding_repository.go`)
4. ✅ Add metrics: `findings_expired_total`, `findings_auto_resolved_total`
5. ✅ Unit tests for branch-aware lifecycle (`api/tests/unit/branch_lifecycle_test.go`)

### Phase 4: Suppression Rules API

1. Create `suppression_rules` table
2. Implement CRUD API endpoints
3. Add approval workflow for permanent rules
4. Integrate with agent security gate

### Phase 5: UI & Management

1. Suppression rules management page
2. Approval queue for security admins
3. Expiration notifications
4. Audit log viewer

---

## Security Considerations

1. **Developers cannot bypass**: No in-code suppression (`.semgrepignore` in repo is ignored)
2. **Approval required for permanent**: Rules without `expires_at` require security admin approval
3. **Audit trail**: All changes are logged with actor, timestamp, reason
4. **Expiration enforcement**: Expired rules are automatically deactivated
5. **Scope limitation**: Rules can be scoped to specific assets/groups

---

## Migration

### Existing Findings

- All existing `status = 'open'` findings remain unchanged
- Auto-resolve only applies to findings that existed before current scan
- No retroactive auto-resolve for historical scans

### Existing `.semgrepignore` Files

- Files in repositories are ignored by platform
- Notify users to migrate to platform suppression rules
- Provide migration tool: `agent migrate-suppressions` to convert files to API calls

---

## Alternatives Considered

### Option A: Trust In-Code Annotations
**Rejected**: Developers can bypass security checks without oversight

### Option B: Signed Config Files
**Deferred**: More complex, requires key management. May revisit for offline scenarios.

### Option C: Time-Based Staleness Only
**Rejected**: Too slow (30+ days), findings already fixed remain visible

---

## References

- [SonarQube Issue Lifecycle](https://docs.sonarsource.com/sonarqube-server/10.4/user-guide/issues)
- [Semgrep Finding Status](https://semgrep.dev/docs/semgrep-code/findings)
- [GitHub Code Scanning Alerts](https://docs.github.com/en/code-security/code-scanning/managing-code-scanning-alerts/resolving-code-scanning-alerts)
- [DefectDojo Deduplication](https://docs.defectdojo.com/en/working_with_findings/finding_deduplication/about_deduplication/)
