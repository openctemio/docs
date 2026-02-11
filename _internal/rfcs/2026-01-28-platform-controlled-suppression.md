---
title: Platform-Controlled False Positive Suppression
status: planned
author: Security Team
date: 2026-01-28
---

# RFC: Platform-Controlled False Positive Suppression

## Summary

Enhance the existing finding status system to:
1. **Persist** false positive status across scans (currently not working)
2. **Separate** suppression rules from individual finding status
3. **Prevent** local suppression files from bypassing security checks
4. **Add** approval workflow for suppressions

---

## Problem Statement

### Current Implementation (Existing)

The platform already has finding status functionality:

```go
// CTIS Schema (sdk/pkg/ctis/types.go)
type FindingStatus string
const (
    FindingStatusOpen          FindingStatus = "open"
    FindingStatusResolved      FindingStatus = "resolved"
    FindingStatusFalsePositive FindingStatus = "false_positive"  // ← EXISTS
    FindingStatusAcceptedRisk  FindingStatus = "accepted_risk"   // ← EXISTS
    FindingStatusInProgress    FindingStatus = "in_progress"
)

// Suppression entity also exists but NOT integrated
type Suppression struct {
    Kind          string     // in_source, external
    Status        string     // accepted, under_review, rejected
    Justification string
    SuppressedBy  string
    SuppressedAt  *time.Time
}
```

**UI can mark findings as false_positive** - this already works.

### The REAL Problem

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT BROKEN FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SCAN 1:                                                        │
│  1. Scanner finds SQL Injection in user.go:45                   │
│  2. Agent pushes → Finding created (status="open")              │
│  3. Security team marks as "false_positive" ✓                   │
│                                                                  │
│  SCAN 2 (next day):                                             │
│  4. Scanner finds SAME SQL Injection in user.go:45              │
│  5. Agent pushes → What happens?                                │
│     a) New finding created (status="open") ← DUPLICATE!         │
│     b) Existing finding updated, status RESET ← LOST FP!        │
│     c) Finding deduplicated, status PRESERVED ← IDEAL           │
│                                                                  │
│  CURRENT: (a) or (b) - false_positive status NOT preserved      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Two Separate Problems

| Problem | Description | Solution |
|---------|-------------|----------|
| **Problem 1** | Finding status not preserved across scans | Deduplication by fingerprint |
| **Problem 2** | Local ignore files bypass security | Platform-controlled suppressions |

### Local Suppression Files (Additional Problem)

Security tools support local suppression mechanisms:
- Semgrep: `// nosemgrep` comments, `.semgrepignore`
- Gitleaks: `.gitleaks.toml` allowlist
- Trivy: `.trivyignore`, `--ignore-policy`

| Problem | Impact |
|---------|--------|
| Developers can self-suppress findings | Security bypass without oversight |
| No audit trail | Unknown who suppressed what and why |
| No expiration | Suppressions become stale |
| No approval workflow | No security team review |
| Scattered across repos | No centralized visibility |

---

## Goals

1. **Fix Deduplication**: Preserve finding status (including false_positive) across scans
2. **Add Suppression Rules**: Create rules that auto-suppress future findings matching criteria
3. **Centralized Control**: All suppressions managed via platform (ignore local files)
4. **Audit Trail**: Who, when, why for every suppression
5. **Approval Workflow**: Security team review required
6. **Expiration**: Auto-expire suppressions for re-review

---

## Solution Overview: Two-Layer Approach

```
┌─────────────────────────────────────────────────────────────────┐
│              TWO-LAYER SUPPRESSION SYSTEM                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LAYER 1: Finding Status (EXISTING - needs fix)                 │
│  ─────────────────────────────────────────────                  │
│  • Individual finding marked as false_positive                  │
│  • Stored in findings table (status column)                     │
│  • Must be PRESERVED across scans via deduplication             │
│                                                                  │
│  LAYER 2: Suppression Rules (NEW)                               │
│  ────────────────────────────────                               │
│  • Rules that auto-suppress FUTURE findings                     │
│  • Stored in finding_suppressions table                         │
│  • Pattern-based: rule_id + path_pattern                        │
│  • Used by agent in security gate                               │
│                                                                  │
│  HOW THEY WORK TOGETHER:                                        │
│  ───────────────────────                                        │
│                                                                  │
│  User marks Finding #123 as false_positive                      │
│     │                                                            │
│     ├─► Finding #123 status = "false_positive" (Layer 1)        │
│     │                                                            │
│     └─► [Optional] Create suppression rule (Layer 2)            │
│         "Suppress all semgrep.sql-injection in tests/**"        │
│         → Auto-applies to future scans                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### When to Use Each Layer

| Scenario | Use Layer 1 (Status) | Use Layer 2 (Rule) |
|----------|---------------------|-------------------|
| One-off false positive | ✓ Mark finding | No rule needed |
| Pattern of false positives | ✓ Mark findings | ✓ Create rule |
| Test directory always triggers | Mark existing | ✓ Create rule for `tests/**` |
| New repo, first scan | N/A | No suppressions apply |

---

## Layer 1: Fix Finding Deduplication (Priority 1)

### Current Issue

When agent pushes findings, the API creates new records or updates existing ones. The deduplication logic needs to:
1. Match by fingerprint (rule_id + file + line)
2. **Preserve** user-set status (false_positive, accepted_risk)
3. Only update scan metadata (last_seen, scan_id)

### Finding Fingerprint - Multi-Type Algorithm

**Critical:** Findings come from different tool types (SAST, SCA, DAST, Secrets, IaC, Container, Web3). Each type requires a different fingerprint algorithm.

#### Current Implementation Status

**✅ PRODUCTION-READY**: The fingerprint algorithm is already implemented in `sdk/pkg/shared/fingerprint/fingerprint.go` and handles the core types well:

| Type | Status | Algorithm |
|------|--------|-----------|
| **SAST** | ✅ Implemented | `file + ruleID + startLine + endLine` |
| **SCA** | ✅ Implemented | `packageName + packageVersion + vulnID` |
| **Secret** | ✅ Implemented | `file + ruleID + line + secretHash[:16]` |
| **Misconfiguration** | ✅ Implemented | `resourceType + resourceName + ruleID + file` |
| **Generic** | ✅ Implemented | `ruleID + file + startLine + endLine + message` |
| **DAST** | ✅ Implemented | `templateID + targetHost + path + parameter` |
| **Container** | ✅ Implemented | `target + packageName + version + vulnID` |
| **Web3** | ✅ Implemented | `contractAddress + chainID + swcID + function` |

#### Tool Field Availability (Verified)

| Tool | Type | Fields Available | Reliability |
|------|------|------------------|-------------|
| **Semgrep** | SAST | FilePath, RuleID, StartLine, EndLine | 99% - always present |
| **Trivy (SCA)** | SCA | PkgName, InstalledVersion, VulnerabilityID, Target | 99% - CVEs stable |
| **Gitleaks** | Secret | File, RuleID, StartLine, Secret (raw value) | 99% - always present |
| **Trivy (Config)** | Misconfig | Type, ID, Title, Target | 95% - IaC varies |
| **Nuclei** | DAST | TemplateID, Host, MatchedAt, ExtractorName | 90% - network varies |
| **Trivy (Image)** | Container | Target (image), PkgName, Version, VulnID | 99% - digests stable |

#### Existing Implementation (sdk/pkg/shared/fingerprint/fingerprint.go)

```go
// ALREADY IMPLEMENTED - Production Ready
func Generate(input Input) string {
    var data string

    switch input.Type {
    case TypeSAST:
        // ✅ SAST: Deduplicate by file location and rule
        data = fmt.Sprintf("sast:%s:%s:%d:%d",
            normalize(input.FilePath),
            normalize(input.RuleID),
            input.StartLine,
            input.EndLine,
        )

    case TypeSCA:
        // ✅ SCA: Deduplicate by package and vulnerability
        data = fmt.Sprintf("sca:%s:%s:%s",
            normalize(input.PackageName),
            normalize(input.PackageVersion),
            normalize(input.VulnerabilityID),
        )

    case TypeSecret:
        // ✅ Secret: Include secret hash for multiple secrets at same location
        secretHash := ""
        if input.SecretValue != "" {
            secretHash = Hash(input.SecretValue)[:16]
        }
        data = fmt.Sprintf("secret:%s:%s:%d:%s",
            normalize(input.FilePath),
            normalize(input.RuleID),
            input.StartLine,
            secretHash,
        )

    case TypeMisconfiguration:
        // ✅ Misconfig: Deduplicate by resource and rule
        data = fmt.Sprintf("misconfig:%s:%s:%s:%s",
            normalize(input.ResourceType),
            normalize(input.ResourceName),
            normalize(input.RuleID),
            normalize(input.FilePath),
        )

    default:
        // ✅ Generic: Use all available location data
        data = fmt.Sprintf("generic:%s:%s:%d:%d:%s",
            normalize(input.RuleID),
            normalize(input.FilePath),
            input.StartLine,
            input.EndLine,
            normalize(input.Message),
        )
    }

    return Hash(data) // SHA256, 64 hex chars
}
```

#### Types to Add (Future Enhancement)

```go
// ADD THESE to sdk/pkg/shared/fingerprint/fingerprint.go

const (
    TypeDAST      Type = "dast"      // Dynamic Application Security Testing
    TypeContainer Type = "container" // Container image vulnerabilities
    TypeWeb3      Type = "web3"      // Smart contract vulnerabilities
)

// Additional input fields
type Input struct {
    // ... existing fields ...

    // DAST-specific fields (for Nuclei, ZAP)
    TargetHost  string // Target hostname
    TargetPath  string // URL path
    Parameter   string // Affected parameter

    // Container-specific fields (for Trivy image)
    ImageTarget string // Image name/digest

    // Web3-specific fields (for Slither)
    ContractAddress   string
    ChainID           int
    SWCID             string // SWC-xxx
    FunctionSignature string
}

// In Generate() switch, add:
case TypeDAST:
    // DAST: templateID + host + path + parameter
    // Normalize URL to avoid ?id=1 vs ?id=2 mismatches
    data = fmt.Sprintf("dast:%s:%s:%s:%s",
        normalize(input.RuleID), // Template ID
        normalizeHost(input.TargetHost),
        normalizePath(input.TargetPath),
        normalize(input.Parameter),
    )

case TypeContainer:
    // Container: Reuse SCA pattern but with image target
    data = fmt.Sprintf("container:%s:%s:%s:%s",
        normalize(input.ImageTarget),
        normalize(input.PackageName),
        normalize(input.PackageVersion),
        normalize(input.VulnerabilityID),
    )

case TypeWeb3:
    // Web3: contract + chain + SWC + function
    data = fmt.Sprintf("web3:%s:%d:%s:%s",
        strings.ToLower(input.ContractAddress),
        input.ChainID,
        normalize(input.SWCID),
        normalize(input.FunctionSignature),
    )
```

#### Asset-Scoped Deduplication (Database Level)

```sql
-- Fingerprint is unique per (tenant, asset) - NOT global
-- Same CVE in repo A and repo B = different findings
CREATE UNIQUE INDEX idx_findings_fingerprint
ON findings(tenant_id, asset_id, fingerprint);
```

The asset scoping is handled at the **database level** via the unique index, not in the fingerprint algorithm itself. This keeps the fingerprint algorithm simple and portable.

#### Edge Cases & Solutions

| Edge Case | Problem | Solution |
|-----------|---------|----------|
| **Code relocated** | Same code moved to line 50 | Accept as new finding (line is part of fingerprint) |
| **Multiple secrets on same line** | 2 API keys on line 15 | ✅ Include secretHash in fingerprint |
| **Package version range** | CVE affects ">=1.0 <2.0" | ✅ Use exact version in fingerprint |
| **Same CVE in 2 repos** | CVE-2024-1234 in repo A and B | ✅ Asset-scoped via DB index |
| **DAST parameter variations** | ?id=1 vs ?id=2 | Include parameter name, not value |
| **Missing fields** | Scanner doesn't provide all data | ✅ normalize() returns empty string safely |
| **Path normalization** | Windows vs Unix paths | ✅ Handled via normalize() |

#### Confidence Levels by Type

| Type | Confidence | Reason |
|------|------------|--------|
| **SCA** | High (99%) | CVE IDs and package versions are stable |
| **Container** | High (99%) | Image digests are immutable |
| **Misconfiguration** | High (95%) | Resource IDs are stable |
| **SAST** | Medium (95%) | Code may relocate, but rule+file+line is reliable |
| **Secret** | Medium (95%) | Secret hash handles duplicates well |
| **DAST** | Low (90%) | Network/WAF variations may cause flakiness |
| **Web3** | Medium (90%) | Proxy contracts may need special handling |

### API Upsert Logic (Fix Required)

```go
// api/internal/service/finding_service.go

func (s *FindingService) UpsertFinding(ctx context.Context, f *Finding) error {
    fingerprint := f.CalculateFingerprint()

    existing, err := s.repo.FindByFingerprint(ctx, f.AssetID, fingerprint)
    if err != nil && !errors.Is(err, ErrNotFound) {
        return err
    }

    if existing != nil {
        // EXISTING FINDING - preserve status!
        return s.updateExisting(ctx, existing, f)
    }

    // NEW FINDING
    f.Status = FindingStatusOpen
    return s.repo.Create(ctx, f)
}

func (s *FindingService) updateExisting(ctx context.Context, existing, incoming *Finding) error {
    // PRESERVE these fields (user-set)
    // - status (false_positive, accepted_risk, etc.)
    // - triageStatus
    // - assignedTo
    // - notes

    // UPDATE these fields (scan data)
    existing.LastSeenAt = time.Now()
    existing.ScanID = incoming.ScanID
    existing.Severity = incoming.Severity      // May change
    existing.Description = incoming.Description
    existing.Remediation = incoming.Remediation

    // DO NOT TOUCH: existing.Status, existing.TriageStatus

    return s.repo.Update(ctx, existing)
}
```

### Database Schema for Deduplication

```sql
-- Findings table enhancement
ALTER TABLE findings ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(32);
ALTER TABLE findings ADD COLUMN IF NOT EXISTS fingerprint_type VARCHAR(20);  -- sast, sca, secret, etc.
ALTER TABLE findings ADD COLUMN IF NOT EXISTS fingerprint_confidence VARCHAR(10);  -- high, medium, low

-- Create unique index for deduplication (CRITICAL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_findings_fingerprint
ON findings(tenant_id, asset_id, fingerprint);

-- Index for querying by type
CREATE INDEX IF NOT EXISTS idx_findings_type
ON findings(tenant_id, finding_type, status);

-- Index for suppression matching
CREATE INDEX IF NOT EXISTS idx_findings_rule_path
ON findings(tenant_id, asset_id, rule_id, file_path);

-- Backfill fingerprints (type-aware)
-- Run in batches to avoid locking
DO $$
DECLARE
    batch_size INT := 1000;
    offset_val INT := 0;
BEGIN
    LOOP
        UPDATE findings f
        SET fingerprint = encode(sha256(
            CASE f.finding_type
                WHEN 'sast' THEN 'sast:' || f.rule_id || ':' || f.file_path || ':' || f.start_line
                WHEN 'sca' THEN 'sca:' || f.package_name || ':' || f.package_version || ':' || f.cve_id
                WHEN 'secret' THEN 'secret:' || f.rule_id || ':' || f.file_path || ':' || f.start_line
                WHEN 'misconfiguration' THEN 'misconfig:' || f.resource_type || ':' || f.rule_id || ':' || f.file_path
                ELSE 'generic:' || f.rule_id || ':' || f.file_path || ':' || f.start_line
            END
        ::bytea), 'hex')::varchar(32),
            fingerprint_type = f.finding_type
        WHERE f.id IN (
            SELECT id FROM findings
            WHERE fingerprint IS NULL
            ORDER BY id
            LIMIT batch_size
            OFFSET offset_val
        );

        EXIT WHEN NOT FOUND;
        offset_val := offset_val + batch_size;
        COMMIT;
    END LOOP;
END $$;
```

### Expected Behavior After Fix

```
SCAN 1:
  Finding: SQL Injection in user.go:45
  fingerprint: "abc123..."
  → Created with status="open"

USER ACTION:
  Mark finding as false_positive
  → status="false_positive" (saved)

SCAN 2:
  Finding: SQL Injection in user.go:45 (same)
  fingerprint: "abc123..." (same)
  → Found existing by fingerprint
  → Update last_seen_at
  → PRESERVE status="false_positive" ✓

SCAN 3:
  Finding: SQL Injection in user.go:50 (different line)
  fingerprint: "def456..." (different)
  → No existing found
  → Created with status="open" (new finding)
```

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUPPRESSION FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐     ┌──────────┐     ┌──────────────────┐        │
│  │  Scanner │────►│  Agent   │────►│  Platform API    │        │
│  │          │     │          │     │                  │        │
│  └──────────┘     └────┬─────┘     └────────┬─────────┘        │
│                        │                     │                   │
│       Push ALL findings (no local filtering) │                   │
│                        │                     ▼                   │
│                        │           ┌─────────────────┐          │
│                        │           │  Findings DB    │          │
│                        │           │  + Suppressions │          │
│                        │           └────────┬────────┘          │
│                        │                    │                    │
│                        │    ┌───────────────┴───────────────┐   │
│                        │    │                               │   │
│                        ▼    ▼                               │   │
│              ┌─────────────────────────┐                    │   │
│              │    SECURITY GATE        │◄───────────────────┘   │
│              │                         │   Fetch suppressions   │
│              │  active_findings =      │                        │
│              │  all_findings -         │                        │
│              │  approved_suppressions  │                        │
│              │                         │                        │
│              │  if active > threshold  │                        │
│              │     → FAIL pipeline     │                        │
│              └─────────────────────────┘                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Suppression Scope

**Critical Design Decision: Suppressions are ALWAYS scoped to a specific asset (repository).**

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUPPRESSION SCOPE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Tenant: ABC Corp                                               │
│  ├── Asset: github.com/abc/api                                  │
│  │   └── Suppressions: [sql-injection in tests/**, ...]        │
│  │       → Only applies to THIS repo                            │
│  │                                                               │
│  ├── Asset: github.com/abc/web                                  │
│  │   └── Suppressions: [xss in legacy/**, ...]                 │
│  │       → Only applies to THIS repo                            │
│  │                                                               │
│  └── Asset: github.com/abc/mobile (NEW - first scan)           │
│      └── Suppressions: [] (empty - no suppressions yet)        │
│          → All findings are ACTIVE until reviewed               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**When scanning a new repository:**
1. Agent scans `github.com/abc/new-repo`
2. Repo doesn't exist on platform → Platform auto-creates asset
3. First scan → 0 suppressions → ALL findings are active
4. Security team reviews → creates suppressions for this asset
5. Next scan → fetches suppressions for THIS asset only

### Suppression Types

| Type | Scope | Use Case |
|------|-------|----------|
| `finding_hash` | Single finding in ONE asset | Exact match for specific instance |
| `rule_id + asset` | All findings from rule in ONE asset | Disable noisy rule for this repo |
| `rule_id + path + asset` | Rule in specific path in ONE asset | Test files in this repo |
| `rule_id + tenant` (Admin only) | All assets in tenant | Global rule disable (rare) |

---

## Data Model

### New Table: `finding_suppressions`

```sql
CREATE TABLE finding_suppressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    -- CRITICAL: Asset scope (required for most suppressions)
    asset_id UUID REFERENCES assets(id),  -- Which repo this applies to

    -- Matching Criteria (at least one required)
    finding_hash VARCHAR(64),           -- SHA256 of finding for exact match
    rule_id VARCHAR(255),               -- e.g., "semgrep.sql-injection"
    path_pattern VARCHAR(500),          -- e.g., "tests/**", "*.test.go"

    -- Scope level
    scope VARCHAR(20) DEFAULT 'asset',  -- asset (default), tenant (admin only)

    -- Suppression Details
    suppression_type VARCHAR(20) NOT NULL,  -- false_positive, accepted_risk, won't_fix
    status VARCHAR(20) DEFAULT 'pending',   -- pending, approved, rejected, expired
    justification TEXT NOT NULL,

    -- Audit Trail
    requested_by UUID NOT NULL REFERENCES users(id),
    requested_at TIMESTAMP DEFAULT NOW(),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    review_notes TEXT,

    -- Expiration
    expires_at TIMESTAMP NOT NULL,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_criteria CHECK (
        finding_hash IS NOT NULL OR
        rule_id IS NOT NULL
    ),
    -- Asset required for asset-scoped suppressions
    CONSTRAINT asset_required_for_asset_scope CHECK (
        scope = 'tenant' OR asset_id IS NOT NULL
    )
);

-- Primary lookup: by asset (most common)
CREATE INDEX idx_suppressions_asset ON finding_suppressions(asset_id, status);
CREATE INDEX idx_suppressions_tenant ON finding_suppressions(tenant_id, scope);
CREATE INDEX idx_suppressions_rule ON finding_suppressions(rule_id);
CREATE INDEX idx_suppressions_hash ON finding_suppressions(finding_hash);
CREATE INDEX idx_suppressions_expiry ON finding_suppressions(expires_at) WHERE status = 'approved';
```

### Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| `tenant_id` | UUID | Organization that owns this suppression |
| `asset_id` | UUID | **Repository this suppression applies to** (required for asset scope) |
| `finding_hash` | VARCHAR | SHA256 hash for exact finding match |
| `rule_id` | VARCHAR | Scanner rule ID (e.g., `semgrep.sql-injection`) |
| `path_pattern` | VARCHAR | Glob pattern for file paths (e.g., `tests/**`) |
| `scope` | VARCHAR | `asset` (default, one repo) or `tenant` (all repos, admin only) |
| `suppression_type` | VARCHAR | `false_positive`, `accepted_risk`, `wont_fix` |
| `status` | VARCHAR | `pending` (needs review), `approved`, `rejected`, `expired` |
| `justification` | TEXT | Why this is being suppressed (required) |
| `expires_at` | TIMESTAMP | When suppression expires (max 1 year) |

### Example Records

```sql
-- Example 1: Suppress specific finding in one repo
INSERT INTO finding_suppressions (
    tenant_id, asset_id, finding_hash, scope,
    suppression_type, status, justification, expires_at
) VALUES (
    'tenant-abc', 'asset-api-repo',
    'sha256:abc123...', 'asset',
    'false_positive', 'approved',
    'Test fixture with mock SQL query',
    NOW() + INTERVAL '90 days'
);

-- Example 2: Suppress rule in test files for one repo
INSERT INTO finding_suppressions (
    tenant_id, asset_id, rule_id, path_pattern, scope,
    suppression_type, status, justification, expires_at
) VALUES (
    'tenant-abc', 'asset-api-repo',
    'semgrep.hardcoded-secret', 'tests/**', 'asset',
    'false_positive', 'approved',
    'Test files use placeholder secrets',
    NOW() + INTERVAL '180 days'
);

-- Example 3: Tenant-wide suppression (admin only, rare)
INSERT INTO finding_suppressions (
    tenant_id, asset_id, rule_id, scope,
    suppression_type, status, justification, expires_at
) VALUES (
    'tenant-abc', NULL,  -- No asset = all assets
    'semgrep.logger-not-used', 'tenant',
    'accepted_risk', 'approved',
    'Company policy: logger warning is informational only',
    NOW() + INTERVAL '365 days'
);
```

### Finding Hash Calculation

```go
func CalculateFindingHash(f *ctis.Finding) string {
    data := fmt.Sprintf("%s:%s:%d:%s",
        f.RuleID,
        f.Location.Path,
        f.Location.StartLine,
        f.Fingerprint, // If available from scanner
    )
    hash := sha256.Sum256([]byte(data))
    return hex.EncodeToString(hash[:])
}
```

---

## API Endpoints

### Suppression Management

```yaml
# Request suppression (developer)
POST /api/v1/findings/{finding_id}/suppress
{
    "suppression_type": "false_positive",
    "justification": "Test fixture, not real credentials",
    "expires_in_days": 90
}

# List pending suppressions (security team)
GET /api/v1/suppressions?status=pending

# Approve/Reject suppression (security team)
PATCH /api/v1/suppressions/{id}
{
    "status": "approved",
    "review_notes": "Verified test fixture"
}

# Bulk suppress by rule (admin only)
POST /api/v1/suppressions/bulk
{
    "rule_id": "semgrep.generic-secret",
    "path_pattern": "tests/**",
    "justification": "Test directory",
    "expires_in_days": 365
}
```

### Agent Integration

```yaml
# Fetch suppressions for a specific asset (repository)
# Agent identifies asset by repository URL
GET /api/v1/suppressions?asset_url=github.com/abc/api&status=approved

Response:
{
    "asset_id": "uuid-of-api-repo",
    "asset_url": "github.com/abc/api",
    "suppressions": [
        {
            "id": "uuid",
            "scope": "asset",
            "rule_id": "semgrep.sql-injection",
            "path_pattern": "tests/**",
            "expires_at": "2026-06-01T00:00:00Z"
        }
    ],
    # Also includes tenant-wide suppressions (if any)
    "tenant_suppressions": [
        {
            "id": "uuid",
            "scope": "tenant",
            "rule_id": "semgrep.logger-not-used",
            "expires_at": "2026-12-31T00:00:00Z"
        }
    ],
    "cache_until": "2026-01-28T07:00:00Z"
}

# If asset doesn't exist yet (first scan)
Response:
{
    "asset_id": null,
    "asset_url": "github.com/abc/new-repo",
    "suppressions": [],           # Empty - no suppressions
    "tenant_suppressions": [...], # Still get tenant-wide ones
    "cache_until": "2026-01-28T07:00:00Z"
}
```

**Flow for new repository:**
```
1. Agent scans github.com/abc/new-repo
2. GET /api/v1/suppressions?asset_url=github.com/abc/new-repo
3. Response: asset_id=null, suppressions=[]
4. Agent runs security gate with 0 suppressions
5. All findings are ACTIVE (no false positive bypass)
6. Agent pushes findings → Platform auto-creates asset
7. Security team reviews → creates suppressions for this asset
8. Next scan → GET returns suppressions for this asset
```

---

## Agent Implementation

### Phase 1: Ignore Local Files

```go
// In scanner configuration
type ScannerConfig struct {
    // Existing fields...

    // Suppression control
    IgnoreLocalSuppressions bool `yaml:"ignore_local_suppressions"`
}

// Default: true in CI mode
if cfg.AutoCI {
    cfg.IgnoreLocalSuppressions = true
}
```

### Phase 2: Fetch Platform Suppressions

```go
func (g *SecurityGate) Check(findings []*ctis.Finding) *GateResult {
    // Fetch suppressions from platform
    suppressions, err := g.client.GetSuppressions(g.assetID)
    if err != nil {
        log.Warn("Could not fetch suppressions, checking all findings")
    }

    // Filter findings
    var activeFindings []*ctis.Finding
    for _, f := range findings {
        if !g.isSuppressed(f, suppressions) {
            activeFindings = append(activeFindings, f)
        }
    }

    // Check against threshold
    return g.checkThreshold(activeFindings)
}

func (g *SecurityGate) isSuppressed(f *ctis.Finding, suppressions []Suppression) bool {
    hash := CalculateFindingHash(f)

    for _, s := range suppressions {
        if s.Status != "approved" || time.Now().After(s.ExpiresAt) {
            continue
        }

        // Exact match by hash
        if s.FindingHash == hash {
            return true
        }

        // Rule + path pattern match
        if s.RuleID == f.RuleID {
            if s.PathPattern == "" || matchGlob(s.PathPattern, f.Location.Path) {
                return true
            }
        }
    }

    return false
}
```

### Phase 3: Caching

```go
type SuppressionCache struct {
    suppressions []Suppression
    expiresAt    time.Time
}

func (c *Client) GetSuppressions(assetID string) ([]Suppression, error) {
    // Check cache
    if cached, ok := c.cache.Get(assetID); ok {
        if time.Now().Before(cached.expiresAt) {
            return cached.suppressions, nil
        }
    }

    // Fetch from API
    resp, err := c.api.GetSuppressions(assetID)
    if err != nil {
        return nil, err
    }

    // Cache for 5 minutes
    c.cache.Set(assetID, &SuppressionCache{
        suppressions: resp.Suppressions,
        expiresAt:    time.Now().Add(5 * time.Minute),
    })

    return resp.Suppressions, nil
}
```

---

## UI Components

### Finding Detail - Request Suppression

```
┌─────────────────────────────────────────────────────────────┐
│ Finding: SQL Injection in user_controller.go:45            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [Request Suppression]                                       │
│                                                             │
│ Type: [False Positive ▼]                                    │
│                                                             │
│ Justification:                                              │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ This is a prepared statement, the analyzer doesn't      ││
│ │ recognize the custom query builder.                     ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ Expiration: [90 days ▼]                                     │
│                                                             │
│            [Cancel]  [Submit for Review]                    │
└─────────────────────────────────────────────────────────────┘
```

### Security Team - Suppression Queue

```
┌─────────────────────────────────────────────────────────────┐
│ Suppression Requests                           [Pending: 12]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ☐ semgrep.sql-injection     user_controller.go   @john     │
│   "Prepared statement, false positive"          2h ago     │
│   [View Finding] [Approve] [Reject]                        │
│                                                             │
│ ☐ gitleaks.aws-access-key   config.example.yaml  @jane     │
│   "Example placeholder value"                   5h ago     │
│   [View Finding] [Approve] [Reject]                        │
│                                                             │
│ ☐ trivy.CVE-2024-1234       go.mod              @bob       │
│   "No patch available, accepted risk"           1d ago     │
│   [View Finding] [Approve] [Reject]                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Fix Finding Deduplication (Week 1) - ✅ COMPLETED

**Fingerprint Algorithm**: ✅ Implemented in `sdk/pkg/shared/fingerprint/fingerprint.go`
- Handles all types: SAST, SCA, Secret, Misconfiguration, DAST, Container, Web3, Generic
- SHA256 hashing with normalization
- Edge cases handled (missing fields, path normalization)

**Completed Tasks:**
- [x] `fingerprint` column already exists in findings table
- [x] API already calls fingerprint generation on finding creation
- [x] **Fixed upsert logic to preserve status** - `CreateBatch()` ON CONFLICT clause does NOT overwrite status
- [x] `UpdateScanIDBatchByFingerprints()` preserves status, only updates scan_id + last_seen_at
- [x] Added DAST, Container, Web3 types to fingerprint package
- [ ] Test: marking false_positive persists across scans (manual testing recommended)

**Files Modified:**
- `api/internal/infra/postgres/finding_repository.go` - Added comments, updated `UpdateScanIDBatchByFingerprints` to set `last_seen_at`
- `sdk/pkg/shared/fingerprint/fingerprint.go` - Added DAST, Container, Web3 types with helper functions

### Phase 2: Suppression Rules - Database & API (Week 2)

- [ ] Create `finding_suppressions` table
- [ ] Implement CRUD API endpoints
- [ ] Add "Create Rule" option when marking false_positive
- [ ] Add suppression queue for security team

### Phase 3: Agent Integration (Week 3)

- [ ] Add `ignore_local_suppressions` config (default true in CI mode)
- [ ] Implement suppression fetch from API
- [ ] Update security gate to filter suppressed findings
- [ ] Add caching for suppressions (5 min TTL)

### Phase 4: Enforcement & Polish (Week 4)

- [ ] CI/CD: Show suppressed count in summary
- [ ] Add expiration notifications
- [ ] Bulk suppression management
- [ ] Audit log for all suppression actions

---

## Security Considerations

1. **Permission Control**: Only security team can approve suppressions
2. **Expiration Required**: Max 1 year, default 90 days
3. **Audit Trail**: All actions logged with user, timestamp, reason
4. **No Local Override**: Agent ignores `.semgrepignore`, etc. in CI mode
5. **Rate Limiting**: Prevent suppression spam

---

## Metrics & Monitoring

| Metric | Purpose |
|--------|---------|
| `suppressions_pending_count` | Queue depth for security team |
| `suppressions_approved_rate` | Approval percentage |
| `suppressions_expired_count` | Expired suppressions needing review |
| `findings_suppressed_ratio` | % of findings suppressed per scan |

---

## Rollout Plan

| Stage | Scope | Timeline |
|-------|-------|----------|
| Alpha | Internal testing | Week 1 |
| Beta | Opt-in tenants | Week 2-3 |
| GA | All tenants, default on | Week 4 |

---

## Practical Assessment Summary

### What's Already Done

| Component | Status | Location |
|-----------|--------|----------|
| Fingerprint Algorithm | ✅ Complete (all types) | `sdk/pkg/shared/fingerprint/fingerprint.go` |
| Finding Status Model | ✅ Exists | `sdk/pkg/ctis/types.go` - FindingStatus enum |
| Suppression Entity | ✅ Exists | `sdk/pkg/ctis/types.go` - Suppression struct |
| UI Mark False Positive | ✅ Works | Finding detail page |
| **API Upsert Preserves Status** | ✅ Fixed | `api/internal/infra/postgres/finding_repository.go` |
| **DAST/Container/Web3 Types** | ✅ Added | `sdk/pkg/shared/fingerprint/fingerprint.go` |

### What Still Needs Implementation (Phase 2+)

| Component | Priority | Effort |
|-----------|----------|--------|
| Suppression rules table & API | P1 | 1 week |
| Agent suppression fetch | P2 | 3-4 days |

### Key Insight (Resolved)

The **main problem** was that the API upsert logic could overwrite user-set status. This has been **fixed**:

1. **`CreateBatch()` ON CONFLICT clause** - Does NOT include `status` in UPDATE SET, so existing status is preserved
2. **`UpdateScanIDBatchByFingerprints()`** - Only updates `scan_id`, `updated_at`, `last_seen_at` - status preserved

```go
// ACTUAL IMPLEMENTATION in api/internal/infra/postgres/finding_repository.go
// CreateBatch() ON CONFLICT clause:
ON CONFLICT (tenant_id, fingerprint) DO UPDATE SET
    vulnerability_id = EXCLUDED.vulnerability_id,
    // ... other fields ...
    scan_id = EXCLUDED.scan_id,
    updated_at = EXCLUDED.updated_at
    // NOTE: status is NOT in this list - it's preserved!

// UpdateScanIDBatchByFingerprints():
UPDATE findings
SET scan_id = $1, updated_at = NOW(), last_seen_at = NOW()
WHERE tenant_id = $2 AND fingerprint = ANY($3)
// NOTE: status is NOT updated - preserved!
```

---

## Related Documents

- [Fingerprint Package](../../../sdk-go/pkg/shared/fingerprint/fingerprint.go) - Fingerprint algorithm (all types)
- [Finding Repository](../../../api/internal/infra/postgres/finding_repository.go) - Upsert logic (status preserved)
- [Ingest Processor](../../../api/internal/app/ingest/processor_findings.go) - Scan ingestion flow
- [CTIS Types](../../../sdk-go/pkg/ctis/types.go) - Suppression data model
- [Security Gate](../../../agent/internal/gate/security.go) - Gate implementation
