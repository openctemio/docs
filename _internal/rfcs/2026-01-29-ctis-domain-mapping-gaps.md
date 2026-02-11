# RFC: CTIS to Domain Mapping Gaps Fix

**Date:** 2026-01-29
**Status:** In Progress
**Author:** Claude Code
**Related:** SDK-API Integration, Finding Type System

---

## Summary

This RFC documents the identified gaps in CTIS (CTEM Ingest Schema) to domain entity mapping and provides the implementation plan to fix them. The goal is to ensure **zero data loss** when ingesting security findings from agents.

---

## Problem Statement

During the analysis of SDK -> Agent -> API data flow, we identified **20+ fields** in the CTIS schema that are NOT being mapped to domain entities during ingestion. This results in data loss for:

1. **Secret findings** - 8 fields not mapped (expires_at, verified_at, scopes, etc.)
2. **Compliance findings** - 2 fields not mapped (framework_version, control_description)
3. **Web3 findings** - 3 fields not mapped (function_selector, tx_hash, bytecode_offset)
4. **Misconfiguration findings** - 2 fields not mapped (policy_name, cause)
5. **Remediation details** - 5 fields not mapped (steps, effort, fix_available, auto_fixable, references)

---

## Current Architecture

```
Scanner Output -> SDK Parser -> CTIS Report -> API Ingest -> Domain Entity -> Database
                    |              |              |
              [COMPLETE]     [COMPLETE]    [DATA LOSS HERE]
```

The SDK parsers correctly populate all CTIS fields, but `processor_findings.go` in the API does not map all fields to the domain `Finding` entity.

---

## Detailed Gap Analysis

### Gap #1: Secret Fields (8 fields)

| CTIS Field | Domain Field | Current Setter | Status |
|-----------|-------------|----------------|--------|
| `secret.expires_at` | `secretExpiresAt` | `SetSecretExpiresAt()` | EXISTS but NOT CALLED |
| `secret.verified_at` | - | - | MISSING |
| `secret.rotation_due_at` | - | - | MISSING |
| `secret.age_in_days` | - | - | MISSING |
| `secret.scopes` | - | - | MISSING |
| `secret.masked_value` | - | - | MISSING |
| `secret.in_history_only` | - | - | MISSING |
| `secret.commit_count` | - | - | MISSING |

**Files to modify:**
- `api/internal/domain/vulnerability/finding.go` - Add fields and setters
- `api/internal/app/ingest/processor_findings.go` - Call setters in `setSecretFields()`

### Gap #2: Compliance Fields (2 fields)

| CTIS Field | Domain Field | Status |
|-----------|-------------|--------|
| `compliance.framework_version` | - | MISSING |
| `compliance.control_description` | - | MISSING |

**Files to modify:**
- `api/internal/domain/vulnerability/finding.go` - Add fields and setters
- `api/internal/app/ingest/processor_findings.go` - Call in `setComplianceFields()`

### Gap #3: Web3 Fields (3 fields)

| CTIS Field | Domain Field | Current Setter | Status |
|-----------|-------------|----------------|--------|
| `web3.function_selector` | - | - | MISSING |
| `web3.tx_hash` | `web3TxHash` | `SetWeb3TxHash()` | EXISTS but NOT CALLED |
| `web3.bytecode_offset` | - | - | MISSING |

**Files to modify:**
- `api/internal/domain/vulnerability/finding.go` - Add fields and setters
- `api/internal/app/ingest/processor_findings.go` - Call in `setWeb3Fields()`

### Gap #4: Misconfiguration Fields (2 fields)

| CTIS Field | Domain Field | Status |
|-----------|-------------|--------|
| `misconfiguration.policy_name` | - | MISSING |
| `misconfiguration.cause` | - | MISSING |

**Files to modify:**
- `api/internal/domain/vulnerability/finding.go` - Add fields and setters
- `api/internal/app/ingest/processor_findings.go` - Call in `setMisconfigFields()`

### Gap #5: Remediation Fields (5 fields)

| CTIS Field | Domain Field | Status |
|-----------|-------------|--------|
| `remediation.steps` | - | MISSING |
| `remediation.effort` | - | MISSING |
| `remediation.fix_available` | - | MISSING |
| `remediation.auto_fixable` | - | MISSING |
| `remediation.references` | - | MISSING |

**Files to modify:**
- `api/internal/domain/vulnerability/finding.go` - Add fields and setters
- `api/internal/app/ingest/processor_findings.go` - Add new function `setRemediationFields()`

---

## Implementation Plan

### Phase 1: Domain Entity Updates

**File:** `api/internal/domain/vulnerability/finding.go`

Add new private fields:
```go
// Secret extended fields
secretVerifiedAt    *time.Time
secretRotationDueAt *time.Time
secretAgeInDays     int
secretScopes        []string
secretMaskedValue   string
secretInHistoryOnly bool
secretCommitCount   int

// Compliance extended fields
complianceFrameworkVersion   string
complianceControlDescription string

// Web3 extended fields
web3FunctionSelector string
web3BytecodeOffset   int

// Misconfiguration extended fields
misconfigPolicyName string
misconfigCause      string

// Remediation extended fields
remediationSteps      []string
remediationEffort     string
remediationFixAvailable bool
remediationAutoFixable  bool
remediationReferences []string
```

Add corresponding setters following existing pattern.

### Phase 2: Processor Mapping Updates

**File:** `api/internal/app/ingest/processor_findings.go`

Update `setSecretFields()`:
```go
func (p *FindingProcessor) setSecretFields(f *vulnerability.Finding, secret *ctis.SecretDetails) {
    // ... existing fields ...

    // NEW: Extended secret fields
    if secret.ExpiresAt != nil {
        f.SetSecretExpiresAt(secret.ExpiresAt)
    }
    if secret.VerifiedAt != nil {
        f.SetSecretVerifiedAt(secret.VerifiedAt)
    }
    if secret.RotationDueAt != nil {
        f.SetSecretRotationDueAt(secret.RotationDueAt)
    }
    if secret.AgeInDays > 0 {
        f.SetSecretAgeInDays(secret.AgeInDays)
    }
    if len(secret.Scopes) > 0 {
        f.SetSecretScopes(secret.Scopes)
    }
    if secret.MaskedValue != "" {
        f.SetSecretMaskedValue(secret.MaskedValue)
    }
    f.SetSecretInHistoryOnly(secret.InHistoryOnly)
    if secret.CommitCount > 0 {
        f.SetSecretCommitCount(secret.CommitCount)
    }
}
```

Similar updates for other setter functions.

### Phase 3: Database Migration (if needed)

If domain fields map to database columns (not JSONB metadata), create migration:

**File:** `api/migrations/000XXX_finding_extended_fields.up.sql`

```sql
-- Secret extended columns
ALTER TABLE findings ADD COLUMN IF NOT EXISTS secret_verified_at TIMESTAMPTZ;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS secret_rotation_due_at TIMESTAMPTZ;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS secret_age_in_days INTEGER;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS secret_scopes TEXT[];
ALTER TABLE findings ADD COLUMN IF NOT EXISTS secret_masked_value VARCHAR(100);
ALTER TABLE findings ADD COLUMN IF NOT EXISTS secret_in_history_only BOOLEAN DEFAULT FALSE;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS secret_commit_count INTEGER;

-- Compliance extended columns
ALTER TABLE findings ADD COLUMN IF NOT EXISTS compliance_framework_version VARCHAR(50);
ALTER TABLE findings ADD COLUMN IF NOT EXISTS compliance_control_description TEXT;

-- Web3 extended columns
ALTER TABLE findings ADD COLUMN IF NOT EXISTS web3_function_selector VARCHAR(10);
ALTER TABLE findings ADD COLUMN IF NOT EXISTS web3_bytecode_offset INTEGER;

-- Misconfiguration extended columns
ALTER TABLE findings ADD COLUMN IF NOT EXISTS misconfig_policy_name VARCHAR(255);
ALTER TABLE findings ADD COLUMN IF NOT EXISTS misconfig_cause TEXT;

-- Remediation extended columns
ALTER TABLE findings ADD COLUMN IF NOT EXISTS remediation_steps TEXT[];
ALTER TABLE findings ADD COLUMN IF NOT EXISTS remediation_effort VARCHAR(20);
ALTER TABLE findings ADD COLUMN IF NOT EXISTS remediation_fix_available BOOLEAN;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS remediation_auto_fixable BOOLEAN;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS remediation_references TEXT[];

-- Indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_findings_secret_verified ON findings(secret_verified_at) WHERE secret_verified_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_findings_compliance_version ON findings(compliance_framework_version) WHERE compliance_framework_version IS NOT NULL;
```

### Phase 4: Repository Updates

Update `finding_repository.go` to persist new fields in `Create`, `Update`, and `mapToEntity` functions.

### Phase 5: Verification

1. Run `go build ./api/...` - verify compilation
2. Run `go test ./api/...` - verify tests pass
3. Create integration test for field mapping verification
4. Manual verification with sample CTIS reports

---

## Test Plan

### Unit Tests

```go
func TestFinding_SecretExtendedFields(t *testing.T) {
    f := vulnerability.NewFinding(...)

    expiresAt := time.Now().Add(30 * 24 * time.Hour)
    f.SetSecretExpiresAt(&expiresAt)
    assert.Equal(t, expiresAt, *f.SecretExpiresAt())

    f.SetSecretScopes([]string{"repo", "admin:org"})
    assert.Equal(t, []string{"repo", "admin:org"}, f.SecretScopes())

    // ... test all new setters
}
```

### Integration Tests

```go
func TestIngest_AllFieldsPreserved_Secret(t *testing.T) {
    report := createCTISReport(
        withFinding(
            withSecretDetails(
                expiresAt: time.Now().Add(30*24*time.Hour),
                verifiedAt: time.Now(),
                scopes: []string{"read:user", "write:repo"},
                maskedValue: "ghp_****WXYZ",
                inHistoryOnly: true,
                commitCount: 5,
            ),
        ),
    )

    output, err := service.Ingest(ctx, agent, input)
    require.NoError(t, err)

    // Retrieve and verify all fields preserved
    finding, _ := repo.GetByID(ctx, findingID)
    assert.Equal(t, report.Findings[0].Secret.ExpiresAt, finding.SecretExpiresAt())
    assert.Equal(t, report.Findings[0].Secret.Scopes, finding.SecretScopes())
    // ... verify all fields
}
```

---

## Rollout Plan

1. **Development**: Implement and test locally
2. **Staging**: Deploy with feature flag if needed
3. **Production**: Rolling update during low-traffic window
4. **Monitoring**: Watch for increased DB storage, query performance

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| DB schema changes break existing queries | Use NULLABLE columns, add indexes only where needed |
| Increased storage requirements | Monitor and archive old findings if needed |
| Performance impact | Benchmark queries before/after |

---

## Success Criteria

- [ ] All 20 identified fields mapped correctly
- [ ] Build passes: `go build ./api/...`
- [ ] Tests pass: `go test ./api/...`
- [ ] Integration test verifies field preservation
- [ ] No performance regression in ingest pipeline

---

## References

- [CTIS Schema Types](/home/ubuntu/projects/openctemio/sdk/pkg/ctis/types.go)
- [Domain Finding Entity](/home/ubuntu/projects/openctemio/api/internal/domain/vulnerability/finding.go)
- [Ingest Processor](/home/ubuntu/projects/openctemio/api/internal/app/ingest/processor_findings.go)
- [JSON Schemas](/home/ubuntu/projects/openctemio/schemas/ctis/v1/)
