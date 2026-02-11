---
layout: default
title: Finding Suppression System
parent: Architecture
nav_order: 15
---

# Finding Suppression System

## Overview

This document describes the architecture for managing false positive suppressions in security scans. The system is designed to prevent developers from bypassing security checks while providing a controlled mechanism for security teams to manage legitimate false positives.

**Key Principle**: Developers cannot suppress findings directly via code or config files. All suppressions must be approved through the platform.

---

## Problem Statement

### Current Tool-Level Suppression Methods

| Tool | Method | Risk |
|------|--------|------|
| Semgrep | `// nosemgrep: rule-id` comments | Dev can add anywhere |
| Semgrep | `.semgrepignore` file | Committed to repo, anyone can edit |
| Gitleaks | `.gitleaks.toml` allowlist | Committed to repo |
| Gitleaks | `.gitleaksignore` file | Committed to repo |
| Trivy | `.trivyignore` file | Committed to repo |
| Trivy | `--ignore-policy` OPA file | Can be manipulated |

### Risks of In-Code Suppression

1. **No audit trail** - Who suppressed? When? Why?
2. **No approval workflow** - Dev decides unilaterally
3. **No expiration** - Suppressions live forever
4. **Scattered management** - Different files per tool
5. **Security bypass** - Malicious suppression goes unnoticed

---

## Architecture Options

### Option A: Full Platform Control (Recommended)

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUPPRESSION FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐                │
│  │  Scanner │────►│  Agent   │────►│ Platform │                │
│  │          │     │          │     │   API    │                │
│  └──────────┘     └────┬─────┘     └────┬─────┘                │
│                        │                 │                       │
│           Push ALL findings              │                       │
│           (no local filtering)           │                       │
│                        │                 ▼                       │
│                        │    ┌─────────────────────┐             │
│                        │    │  Suppression DB     │             │
│                        │    │  - rule_id          │             │
│                        │    │  - path_pattern     │             │
│                        │    │  - status           │             │
│                        │    │  - justification    │             │
│                        │    │  - approved_by      │             │
│                        │    │  - expires_at       │             │
│                        │    └─────────────────────┘             │
│                        │                 │                       │
│                        ▼                 ▼                       │
│              ┌───────────────────────────────────┐              │
│              │     SECURITY GATE (CI/CD)         │              │
│              │                                   │              │
│              │  1. Fetch suppressions from API   │              │
│              │  2. Filter: findings - suppressed │              │
│              │  3. Check threshold               │              │
│              │  4. Pass/Fail pipeline            │              │
│              └───────────────────────────────────┘              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Workflow:**
1. Scanner finds vulnerability
2. Agent pushes ALL findings to platform (no local filtering)
3. Platform stores finding with status = "open"
4. Security team reviews → marks as "false_positive" with justification
5. Next scan: Agent fetches suppressions from platform
6. Security gate: excludes approved suppressions from blocking

**Pros:**
- Dev CANNOT self-suppress
- Full audit trail (who, when, why)
- Expiration dates for risk acceptance
- Centralized management
- Works across all tools

**Cons:**
- Requires API call to fetch suppressions
- Needs platform UI for management
- Offline mode needs caching

---

### Option B: Signed Config File

```yaml
# suppression-policy.yaml (generated and signed by platform)
version: 1
signature: "sha256:abc123..."  # Signed by platform private key
generated_at: "2026-01-28T10:00:00Z"
expires_at: "2026-02-28T10:00:00Z"

rules:
  - id: "supp-001"
    rule_id: "semgrep.sql-injection"
    path_pattern: "tests/**"
    justification: "Test fixtures with intentional SQL patterns"
    approved_by: "security@company.com"
    approved_at: "2026-01-15T10:00:00Z"
    expires_at: "2026-06-01T00:00:00Z"

  - id: "supp-002"
    rule_id: "gitleaks.generic-api-key"
    path_pattern: "docs/examples/**"
    justification: "Example API keys in documentation"
    approved_by: "security@company.com"
    approved_at: "2026-01-20T10:00:00Z"
    expires_at: "2026-07-01T00:00:00Z"
```

**Workflow:**
1. Security team creates suppression in platform UI
2. Platform generates signed config file
3. File is downloaded/synced to repository (or fetched at runtime)
4. Agent validates signature before applying
5. Invalid/tampered file → suppressions ignored

**Pros:**
- Works offline (file cached locally)
- Auditable (signature verification)
- Fast (no API call per finding)
- Can be version controlled (for visibility, not editing)

**Cons:**
- File can be deleted (but not modified without detection)
- Requires key management
- Sync mechanism needed

---

### Option C: Server-Side Only (Simplest)

```
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER-SIDE FILTERING                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐     ┌──────────┐     ┌──────────────────┐        │
│  │  Agent   │────►│ Platform │────►│ Response:        │        │
│  │          │     │   API    │     │ {                │        │
│  │ Push all │     │          │     │   total: 10      │        │
│  │ findings │     │ Filter   │     │   blocking: 5    │        │
│  │          │     │ server-  │     │   suppressed: 3  │        │
│  │          │     │ side     │     │   below_threshold: 2│     │
│  └──────────┘     └──────────┘     │ }                │        │
│                                     └──────────────────┘        │
│                                              │                   │
│                                              ▼                   │
│                                     ┌──────────────────┐        │
│                                     │ Agent decides:   │        │
│                                     │ blocking > 0?    │        │
│                                     │ → Exit code 1    │        │
│                                     └──────────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Workflow:**
1. Scanner finds vulnerabilities
2. Agent pushes ALL findings to platform
3. Platform applies suppressions server-side
4. API returns: `{ blocking: 5, suppressed: 3 }`
5. Agent fails if blocking > 0

**Pros:**
- Simplest implementation
- No local state or caching
- Always uses latest suppressions
- No signature/key management

**Cons:**
- Requires API connectivity
- No true offline support
- Latency on every scan

---

### Option D: Hybrid (Recommended Implementation)

Combine Option A + C with local caching for resilience:

```
Phase 1: Push findings
  Agent → Platform: POST /findings (all findings)

Phase 2: Get suppression status
  Agent → Platform: GET /suppressions?asset_id=xxx
  Platform → Agent: [list of approved suppressions]
  Agent: Cache suppressions locally (TTL: 1 hour)

Phase 3: Security gate
  Agent: Apply suppressions to findings
  Agent: Check threshold
  Agent: Return exit code

Offline fallback:
  If API unreachable:
    Use cached suppressions (warn if stale)
    Or: Fail open/closed based on config
```

---

## Data Model

### Existing CTIS Schema (sdk/pkg/ctis/types.go)

```go
// Finding status types
type FindingStatus string

const (
    FindingStatusOpen          FindingStatus = "open"
    FindingStatusResolved      FindingStatus = "resolved"
    FindingStatusFalsePositive FindingStatus = "false_positive"
    FindingStatusAcceptedRisk  FindingStatus = "accepted_risk"
    FindingStatusInProgress    FindingStatus = "in_progress"
)

// Suppression metadata on Finding
type Suppression struct {
    Kind          string     `json:"kind"`           // "platform", "rule_based"
    Status        string     `json:"status"`         // "pending", "approved", "rejected"
    Justification string     `json:"justification"`
    SuppressedBy  string     `json:"suppressed_by"`
    SuppressedAt  *time.Time `json:"suppressed_at"`
}
```

### New Database Schema

```sql
-- Suppression rules table
CREATE TABLE finding_suppressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    -- Scope (optional - if null, applies to all)
    asset_id UUID REFERENCES assets(id),

    -- Matching criteria (at least one required)
    tool_name VARCHAR(50),              -- e.g., "semgrep", "gitleaks"
    rule_id VARCHAR(255),               -- e.g., "sql-injection", supports wildcards
    path_pattern VARCHAR(500),          -- e.g., "tests/**", "*.test.go"
    finding_hash VARCHAR(64),           -- Exact match for specific finding

    -- Suppression details
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    justification TEXT NOT NULL,

    -- Audit trail
    requested_by UUID NOT NULL REFERENCES users(id),
    requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,

    -- Lifecycle
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    CONSTRAINT has_criteria CHECK (
        rule_id IS NOT NULL OR
        path_pattern IS NOT NULL OR
        finding_hash IS NOT NULL
    ),
    CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Indexes
CREATE INDEX idx_suppressions_tenant ON finding_suppressions(tenant_id);
CREATE INDEX idx_suppressions_asset ON finding_suppressions(asset_id);
CREATE INDEX idx_suppressions_status ON finding_suppressions(status);
CREATE INDEX idx_suppressions_expires ON finding_suppressions(expires_at);

-- Audit log for suppression changes
CREATE TABLE suppression_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suppression_id UUID NOT NULL REFERENCES finding_suppressions(id),
    action VARCHAR(20) NOT NULL,  -- created, approved, rejected, expired, deleted
    actor_id UUID REFERENCES users(id),
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

## API Design

### Endpoints

```yaml
# List suppressions for an asset
GET /api/v1/assets/{asset_id}/suppressions
Query params:
  - status: pending|approved|rejected|expired
  - include_expired: bool (default: false)
Response:
  - rules: SuppressionRule[]
  - cache_ttl: int (seconds)

# Create suppression request
POST /api/v1/assets/{asset_id}/suppressions
Body:
  - tool_name: string (optional)
  - rule_id: string (optional, supports wildcards)
  - path_pattern: string (optional)
  - finding_hash: string (optional, for exact match)
  - justification: string (required)
  - expires_at: timestamp (required, max 1 year)
Response:
  - id: uuid
  - status: "pending"

# Approve/reject suppression (requires security role)
PATCH /api/v1/suppressions/{id}
Body:
  - status: approved|rejected
  - notes: string (optional)
Response:
  - suppression object

# Get suppression audit log
GET /api/v1/suppressions/{id}/audit
Response:
  - entries: AuditEntry[]
```

### Client SDK Types (sdk/pkg/client)

```go
// SuppressionRule represents a platform-approved suppression
type SuppressionRule struct {
    ID            string     `json:"id"`
    ToolName      string     `json:"tool_name,omitempty"`
    RuleID        string     `json:"rule_id,omitempty"`
    PathPattern   string     `json:"path_pattern,omitempty"`
    FindingHash   string     `json:"finding_hash,omitempty"`
    Justification string     `json:"justification"`
    ApprovedBy    string     `json:"approved_by"`
    ApprovedAt    *time.Time `json:"approved_at"`
    ExpiresAt     *time.Time `json:"expires_at"`
}

// Client methods
func (c *Client) GetSuppressions(ctx context.Context, assetID string) ([]SuppressionRule, error)
func (c *Client) CreateSuppressionRequest(ctx context.Context, req SuppressionRequest) (*SuppressionRule, error)
```

---

## Agent Integration

### Security Gate with Suppressions

```go
// agent/internal/gate/security.go

// CheckWithSuppressions evaluates reports against threshold,
// filtering out platform-approved suppressions.
func CheckWithSuppressions(
    reports []*ctis.Report,
    threshold string,
    maxBlocked int,
    suppressions []client.SuppressionRule,
) (*Result, error) {
    // ... implementation
}

// isSuppressed checks if a finding matches any suppression rule
func isSuppressed(f ctis.Finding, toolName string, rules []SuppressionRule) bool {
    for _, rule := range rules {
        if matchesRule(f, toolName, rule) {
            return true
        }
    }
    return false
}

// matchesRule checks if a finding matches a specific rule
func matchesRule(f ctis.Finding, toolName string, rule SuppressionRule) bool {
    // Check tool name
    if rule.ToolName != "" && !strings.EqualFold(rule.ToolName, toolName) {
        return false
    }

    // Check rule ID (supports wildcard suffix)
    if rule.RuleID != "" {
        if strings.HasSuffix(rule.RuleID, "*") {
            prefix := strings.TrimSuffix(rule.RuleID, "*")
            if !strings.HasPrefix(f.RuleID, prefix) {
                return false
            }
        } else if rule.RuleID != f.RuleID {
            return false
        }
    }

    // Check path pattern (glob matching)
    if rule.PathPattern != "" && f.Location != nil {
        if !matchGlob(rule.PathPattern, f.Location.Path) {
            return false
        }
    }

    // Check exact finding hash
    if rule.FindingHash != "" && rule.FindingHash != f.Hash {
        return false
    }

    return true
}
```

### Agent Main Flow

```go
// agent/main.go - runOnce function

func runOnce(...) {
    // ... scan and collect findings ...

    // Fetch suppressions from platform
    var suppressions []client.SuppressionRule
    if apiClient != nil && assetID != "" {
        suppressions, err = apiClient.GetSuppressions(ctx, assetID)
        if err != nil {
            log.Printf("[warn] Failed to fetch suppressions: %v", err)
            // Continue without suppressions (fail closed)
        }
    }

    // Security gate with suppressions
    if failOn != "" && len(allReports) > 0 {
        exitCode := gate.CheckAndPrintWithSuppressions(
            allReports,
            failOn,
            cfg.Agent.Verbose,
            suppressions,
        )
        if exitCode != 0 {
            os.Exit(exitCode)
        }
    }
}
```

---

## Matching Criteria

### Rule ID Patterns

| Pattern | Matches |
|---------|---------|
| `sql-injection` | Exact match only |
| `sql-*` | `sql-injection`, `sql-concat`, etc. |
| `semgrep.*` | All semgrep rules |
| `*` | All rules (use with caution) |

### Path Patterns

| Pattern | Matches |
|---------|---------|
| `tests/**` | All files under tests/ |
| `**/*_test.go` | All Go test files |
| `src/legacy/**` | All files under src/legacy/ |
| `*.md` | All markdown files |
| `docs/examples/*` | Direct children of docs/examples/ |

### Tool Names

| Tool Name | Description |
|-----------|-------------|
| `semgrep` | Semgrep SAST findings |
| `gitleaks` | Gitleaks secret findings |
| `trivy` | Trivy SCA findings |
| `trivy-config` | Trivy IaC findings |
| `nuclei` | Nuclei DAST findings |

---

## Security Considerations

### Who Can Suppress?

| Role | Can Request | Can Approve |
|------|-------------|-------------|
| Developer | Yes | No |
| Tech Lead | Yes | No |
| Security Engineer | Yes | Yes |
| Security Admin | Yes | Yes |

### Expiration Policy

- **Maximum expiration**: 1 year
- **Recommended**: 90 days for most suppressions
- **Auto-expire notification**: 14 days before expiry
- **Expired suppressions**: Findings become blocking again

### Audit Requirements

All suppression actions are logged:
- Who requested
- Who approved/rejected
- When
- Justification provided
- Any modifications

---

## UI Requirements

### Suppression Request Form

```
┌─────────────────────────────────────────────────────────┐
│ Request Suppression                                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Finding: SQL Injection in src/db/query.go:45            │
│ Tool: semgrep                                           │
│ Rule: sql-injection                                     │
│ Severity: HIGH                                          │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Scope:                                              │ │
│ │ ○ This specific finding only                        │ │
│ │ ○ All findings with this rule in this file         │ │
│ │ ○ All findings with this rule in tests/**          │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ Justification: [                                    ]   │
│ (Required - explain why this is a false positive)       │
│                                                          │
│ Expires: [2026-04-28] (max 1 year)                     │
│                                                          │
│ [Cancel]                          [Request Suppression] │
└─────────────────────────────────────────────────────────┘
```

### Suppression Queue (Security Team)

```
┌─────────────────────────────────────────────────────────┐
│ Suppression Requests                     [Filter ▼]     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ⏳ Pending (3)                                          │
│ ├─ sql-injection in tests/** - "Test fixtures"         │
│ │   Requested by: john@co.com | 2h ago                  │
│ │   [View] [Approve] [Reject]                           │
│ │                                                        │
│ ├─ generic-api-key in docs/** - "Example keys"         │
│ │   Requested by: jane@co.com | 1d ago                  │
│ │   [View] [Approve] [Reject]                           │
│ │                                                        │
│ └─ hardcoded-password - "Integration test"             │
│     Requested by: bob@co.com | 3d ago                   │
│     [View] [Approve] [Reject]                           │
│                                                          │
│ ✅ Approved (15)  ❌ Rejected (2)  ⚠️ Expiring Soon (1) │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core API & Agent (MVP)

1. Create `finding_suppressions` table
2. Add API endpoints: GET/POST/PATCH suppressions
3. Update agent gate to fetch and apply suppressions
4. Add `-fetch-suppressions` flag (default: true when connected)

**Deliverables:**
- Database migration
- API handlers
- Agent integration
- Basic permission check (security role only)

### Phase 2: UI & Workflow

1. Add suppression request form in Findings view
2. Create suppression queue for security team
3. Add approval/rejection workflow
4. Email notifications for pending requests

**Deliverables:**
- Findings page: "Request Suppression" button
- Security queue page
- Notification system integration

### Phase 3: Advanced Features

1. Bulk suppression (suppress all similar findings)
2. Suppression templates (common patterns)
3. Auto-expire notifications
4. Audit log viewer
5. Suppression analytics dashboard

**Deliverables:**
- Bulk actions
- Template library
- Enhanced reporting

---

## Verification

### Test Cases

1. **Suppression applies correctly**
   - Create suppression for `rule_id: sql-injection`
   - Run scan with SQL injection finding
   - Verify finding is not blocking

2. **Expired suppression doesn't apply**
   - Create suppression with past expiry
   - Run scan
   - Verify finding is blocking

3. **Path pattern matching**
   - Create suppression for `tests/**`
   - Verify matches `tests/foo.go`
   - Verify doesn't match `src/foo.go`

4. **Wildcard rule ID**
   - Create suppression for `sql-*`
   - Verify matches `sql-injection`, `sql-concat`
   - Verify doesn't match `xss-injection`

5. **Offline fallback**
   - Cache suppressions
   - Disconnect API
   - Verify cached suppressions still apply

---

## References

- [CTIS Types](../sdk-go/pkg/ctis/types.go) - Existing suppression schema
- [Security Gate](../agent/internal/gate/security.go) - Gate implementation
- [Agent Main](../agent/main.go) - Agent entry point
