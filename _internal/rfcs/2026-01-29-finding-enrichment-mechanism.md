# RFC: Finding Enrichment Mechanism

**Date:** 2026-01-29
**Status:** Draft
**Author:** Claude Code Assistant

---

## 1. Problem Statement

Hiện tại khi một finding đã tồn tại (matched by fingerprint), hệ thống chỉ update:
- `scan_id` - ID của scan mới nhất
- `last_seen_at` - Thời điểm nhìn thấy lần cuối
- `updated_at` - Thời điểm update

**Vấn đề:** Nếu tool A scan trước và gửi 5 fields, sau đó tool B scan và gửi 3 fields khác, các fields từ tool B sẽ bị **bỏ qua** vì finding đã tồn tại.

---

## 2. Use Cases

### UC1: Multi-Tool Enrichment
```
Tool A (Slither) → chain, contract_address, swc_id
Tool B (Mythril) → bytecode_offset, function_selector, vulnerability_class
Tool C (Manual Review) → estimated_impact_usd, attack_vector
```
**Expected:** Finding có đầy đủ data từ cả 3 tools.

### UC2: Progressive Data Collection
```
Scan 1 → Basic detection: title, severity, location
Scan 2 → Verified: secret_valid = true, verified_at = now
Scan 3 → Revoked: secret_revoked = true, revoked_at = now
```
**Expected:** Finding được enriched qua từng scan.

### UC3: CVSS/EPSS Update
```
Day 1 → CVE detected: cvss_score = 7.5
Day 30 → NVD update: cvss_score = 9.8, epss_score = 0.95
```
**Expected:** Finding được update với data mới từ vulnerability database.

---

## 3. Proposed Solution: Selective Field Enrichment

### 3.1 Enrichment Strategy

**Principle:** "Non-null writes, null preserves"

```go
// EnrichmentRule defines how a field should be merged
type EnrichmentRule int

const (
    // FirstWins - Keep first non-null value (current behavior for status)
    FirstWins EnrichmentRule = iota

    // LastWins - Replace with new non-null value (most fields)
    LastWins

    // MaxValue - Keep maximum value (e.g., cvss_score)
    MaxValue

    // Append - Append to array (e.g., tags, references)
    Append

    // Merge - Deep merge for objects (e.g., metadata)
    Merge

    // Protected - Never overwrite (status, resolution)
    Protected
)
```

### 3.2 Field-Level Enrichment Config

```go
var FindingEnrichmentRules = map[string]EnrichmentRule{
    // Protected fields - user decisions
    "status":     Protected,
    "resolution": Protected,
    "resolved_by": Protected,
    "resolved_at": Protected,
    "suppression": Protected,

    // LastWins - latest scan data
    "severity":     LastWins,
    "title":        LastWins,
    "description":  LastWins,
    "snippet":      LastWins,
    "tool_name":    LastWins,  // Last tool to touch
    "tool_version": LastWins,

    // Specialized fields - only write if not already set
    "secret_type":        FirstWins,  // Type doesn't change
    "secret_service":     FirstWins,
    "compliance_framework": FirstWins,
    "web3_chain":         FirstWins,
    "web3_contract_address": FirstWins,

    // Enrichment fields - update with new data
    "secret_valid":       LastWins,  // Verification result
    "secret_revoked":     LastWins,  // Revocation status
    "secret_verified_at": LastWins,
    "cvss_score":         MaxValue,  // Keep highest score
    "epss_score":         LastWins,  // Always latest EPSS

    // Array fields - accumulate
    "tags":        Append,
    "references":  Append,
    "cwe_ids":     Append,
    "owasp_ids":   Append,

    // Object fields - merge
    "metadata":           Merge,
    "partial_fingerprints": Merge,
}
```

### 3.3 Implementation: EnrichFinding Method

```go
// api/internal/domain/vulnerability/finding.go

// EnrichFrom updates this finding with non-null values from another finding
// using the configured enrichment rules.
func (f *Finding) EnrichFrom(other *Finding) {
    // Protected fields - never touch
    // (status, resolution, resolved_by, resolved_at)

    // LastWins fields
    if other.description != "" {
        f.description = other.description
    }
    if other.snippet != "" {
        f.snippet = other.snippet
    }

    // Secret enrichment (FirstWins for type, LastWins for verification)
    if f.secretType == "" && other.secretType != "" {
        f.secretType = other.secretType
    }
    if other.secretValid != nil {
        f.secretValid = other.secretValid
        f.secretVerifiedAt = other.secretVerifiedAt
    }
    if other.secretRevoked != nil && *other.secretRevoked {
        f.secretRevoked = other.secretRevoked
    }

    // MaxValue for CVSS
    if other.cvssScore != nil && (f.cvssScore == nil || *other.cvssScore > *f.cvssScore) {
        f.cvssScore = other.cvssScore
        f.cvssVector = other.cvssVector
    }

    // Append for arrays
    f.tags = appendUnique(f.tags, other.tags)
    f.cweIDs = appendUnique(f.cweIDs, other.cweIDs)

    // Merge metadata
    f.metadata = mergeMetadata(f.metadata, other.metadata)

    // Update tracking
    f.updatedAt = time.Now().UTC()
    f.lastSeenAt = time.Now().UTC()
}
```

### 3.4 Repository: EnrichBatchByFingerprints

```go
// api/internal/domain/vulnerability/repository.go

// EnrichBatchByFingerprints enriches existing findings with new data.
// Returns the count of enriched findings.
EnrichBatchByFingerprints(ctx context.Context, tenantID shared.ID, findings []*Finding) (int64, error)
```

```sql
-- PostgreSQL implementation with COALESCE for selective update
UPDATE findings SET
    -- LastWins: update if new value is not null
    description = COALESCE(NULLIF(excluded.description, ''), findings.description),
    snippet = COALESCE(NULLIF(excluded.snippet, ''), findings.snippet),

    -- MaxValue for CVSS
    cvss_score = GREATEST(COALESCE(excluded.cvss_score, 0), COALESCE(findings.cvss_score, 0)),
    cvss_vector = CASE
        WHEN COALESCE(excluded.cvss_score, 0) > COALESCE(findings.cvss_score, 0)
        THEN excluded.cvss_vector
        ELSE findings.cvss_vector
    END,

    -- FirstWins: only set if currently null
    secret_type = COALESCE(findings.secret_type, excluded.secret_type),
    web3_chain = COALESCE(findings.web3_chain, excluded.web3_chain),

    -- Array append (PostgreSQL array_cat + array_distinct)
    tags = array_distinct(array_cat(findings.tags, excluded.tags)),
    cwe_ids = array_distinct(array_cat(findings.cwe_ids, excluded.cwe_ids)),

    -- JSONB merge
    metadata = findings.metadata || excluded.metadata,

    -- Always update tracking
    scan_id = excluded.scan_id,
    updated_at = NOW(),
    last_seen_at = NOW()
FROM (VALUES
    ($1, $2, $3, ...), -- fingerprint, description, snippet, ...
    ($4, $5, $6, ...)
) AS excluded(fingerprint, description, snippet, ...)
WHERE findings.tenant_id = $tenant_id
  AND findings.fingerprint = excluded.fingerprint
```

---

## 4. Modified Ingestion Flow

### Current Flow
```
1. Generate fingerprints
2. Check existing (CheckFingerprintsExist)
3. IF new: CreateBatch
   IF existing: UpdateScanIDBatchByFingerprints (scan_id only)
```

### New Flow
```
1. Generate fingerprints
2. Check existing (CheckFingerprintsExist)
3. IF new: CreateBatch
   IF existing:
     a. Build partial Finding with new data only
     b. EnrichBatchByFingerprints (selective field update)
```

### Code Change in processor_findings.go

```go
func (p *FindingProcessor) ProcessBatch(...) error {
    // ... existing fingerprint generation ...

    for _, fm := range validFindings {
        if existsMap[fm.fingerprint] {
            // CHANGED: Build finding for enrichment instead of just updating scan_id
            f, err := p.buildFinding(tenantID, fm.assetID, fm.branchID, agt.ID, report, &fm.finding, fm.fingerprint)
            if err != nil {
                continue
            }
            existingToEnrich = append(existingToEnrich, f)

            // ... auto-reopen logic ...
        } else {
            // ... create new finding ...
        }
    }

    // CHANGED: Enrich existing findings instead of just updating scan_id
    if len(existingToEnrich) > 0 {
        enriched, err := p.repo.EnrichBatchByFingerprints(ctx, tenantID, existingToEnrich)
        if err != nil {
            p.logger.Warn("failed to enrich existing findings", "error", err)
        } else {
            output.FindingsUpdated = int(enriched)
        }
    }

    return nil
}
```

---

## 5. Configuration Options

### 5.1 Report-Level Enrichment Mode

```go
// CTIS Report Metadata
type ReportMetadata struct {
    // ...existing fields...

    // EnrichmentMode controls how findings are merged
    // - "none": Only update scan_id (current behavior)
    // - "selective": Update non-protected fields (recommended)
    // - "full": Replace all fields except protected (aggressive)
    EnrichmentMode string `json:"enrichment_mode,omitempty"`
}
```

### 5.2 Tenant-Level Settings

```sql
-- tenant_settings table
INSERT INTO tenant_settings (tenant_id, key, value) VALUES
($1, 'finding_enrichment_mode', 'selective'),
($1, 'finding_enrichment_protected_fields', '["status","resolution","tags"]');
```

---

## 6. Integration Test Scenarios

### Test 1: Basic Multi-Tool Enrichment
```go
func TestMultiToolEnrichment(t *testing.T) {
    // Scan 1: Slither finds reentrancy
    report1 := ctis.Report{
        Tool: &ctis.Tool{Name: "slither"},
        Findings: []ctis.Finding{{
            Title: "Reentrancy",
            Severity: "high",
            Web3: &ctis.Web3VulnerabilityDetails{
                Chain: "ethereum",
                SWCID: "SWC-107",
            },
        }},
    }
    result1 := ingest(report1)
    assert.Equal(t, 1, result1.FindingsCreated)

    // Scan 2: Mythril adds bytecode analysis
    report2 := ctis.Report{
        Tool: &ctis.Tool{Name: "mythril"},
        Findings: []ctis.Finding{{
            Title: "Reentrancy",  // Same finding
            Severity: "high",
            Web3: &ctis.Web3VulnerabilityDetails{
                Chain: "ethereum",           // Same
                SWCID: "SWC-107",            // Same
                BytecodeOffset: 0x1234,      // NEW
                FunctionSelector: "0xa9059cbb", // NEW
            },
        }},
    }
    result2 := ingest(report2)
    assert.Equal(t, 0, result2.FindingsCreated)
    assert.Equal(t, 1, result2.FindingsUpdated)

    // Verify enriched finding
    finding := getFindingByFingerprint(fp)
    assert.Equal(t, "ethereum", finding.Web3Chain)
    assert.Equal(t, "SWC-107", finding.Web3SWCID)
    assert.Equal(t, 0x1234, finding.Web3BytecodeOffset)
    assert.Equal(t, "0xa9059cbb", finding.Web3FunctionSelector)
}
```

### Test 2: Protected Status Not Overwritten
```go
func TestProtectedStatusPreserved(t *testing.T) {
    // Create finding and mark as false positive
    createFinding(severity: "high")
    markAsFalsePositive(findingID)

    // New scan tries to update severity
    report := ctis.Report{
        Findings: []ctis.Finding{{
            Severity: "critical",  // Higher severity
        }},
    }
    ingest(report)

    // Status should still be false_positive
    finding := getFinding(findingID)
    assert.Equal(t, "false_positive", finding.Status)
    assert.Equal(t, "critical", finding.Severity)  // Severity CAN update
}
```

### Test 3: MaxValue for CVSS
```go
func TestCVSSMaxValue(t *testing.T) {
    // Day 1: Initial CVE with CVSS 7.5
    report1 := createReportWithCVSS(7.5)
    ingest(report1)

    // Day 30: NVD updates to 9.8
    report2 := createReportWithCVSS(9.8)
    ingest(report2)

    finding := getFinding(fp)
    assert.Equal(t, 9.8, *finding.CVSSScore)

    // Day 60: Another tool reports 8.0 (lower)
    report3 := createReportWithCVSS(8.0)
    ingest(report3)

    // Should keep 9.8 (max)
    finding = getFinding(fp)
    assert.Equal(t, 9.8, *finding.CVSSScore)
}
```

### Test 4: Secret Verification Flow
```go
func TestSecretVerificationEnrichment(t *testing.T) {
    // Scan 1: gitleaks detects secret
    report1 := ctis.Report{
        Tool: &ctis.Tool{Name: "gitleaks"},
        Findings: []ctis.Finding{{
            Title: "AWS Key Detected",
            Secret: &ctis.SecretDetails{
                SecretType: "aws_key",
                Service: "aws",
                MaskedValue: "AKIA****XXXX",
            },
        }},
    }
    ingest(report1)

    // Scan 2: Secret verifier checks validity
    report2 := ctis.Report{
        Tool: &ctis.Tool{Name: "secret-verifier"},
        Findings: []ctis.Finding{{
            Title: "AWS Key Detected",
            Secret: &ctis.SecretDetails{
                SecretType: "aws_key",
                Valid: boolPtr(true),
                VerifiedAt: timePtr(time.Now()),
                Scopes: []string{"s3:*", "ec2:*"},
            },
        }},
    }
    ingest(report2)

    // Verify enrichment
    finding := getFinding(fp)
    assert.Equal(t, "aws_key", finding.SecretType)
    assert.Equal(t, "aws", finding.SecretService)
    assert.True(t, *finding.SecretValid)
    assert.NotNil(t, finding.SecretVerifiedAt)
    assert.Equal(t, []string{"s3:*", "ec2:*"}, finding.SecretScopes)
}
```

---

## 7. Migration Path

### Phase 1: Add EnrichBatchByFingerprints (Non-Breaking)
1. Add `EnrichBatchByFingerprints` method to repository
2. Add `EnrichFrom` method to Finding domain entity
3. Default enrichment_mode = "none" (keep current behavior)

### Phase 2: Enable Selective Enrichment
1. Change default enrichment_mode to "selective"
2. Update processor to use EnrichBatchByFingerprints
3. Add integration tests

### Phase 3: Tenant Configuration
1. Add tenant_settings for enrichment preferences
2. Allow per-tool enrichment rules
3. Add audit logging for enriched fields

---

## 8. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Performance: More fields to update | Batch updates, selective COALESCE |
| Data conflicts: Different tools report different values | Enrichment rules define merge strategy |
| Status corruption: Tool updates protected field | Protected fields list, never updated |
| Array explosion: Unbounded tag/reference growth | Max array size limits |

---

## 9. Alternatives Considered

### A. Separate Enrichment Table
- Store enrichments in `finding_enrichments` table with source tracking
- **Rejected:** Adds complexity, query overhead

### B. Versioned Findings
- Keep history of all finding states
- **Rejected:** Storage explosion, most use cases don't need history

### C. Tool-Priority System
- Define tool hierarchy, higher priority overwrites lower
- **Rejected:** Hard to configure, doesn't handle different fields well

---

## 10. Decision

**Recommended:** Implement **Selective Field Enrichment** with configurable rules.

- Simple to understand
- Non-breaking (default to current behavior)
- Flexible (rules can be adjusted per field)
- Efficient (single batch UPDATE)

---

## Appendix: Full Field Enrichment Rules

| Category | Field | Rule | Rationale |
|----------|-------|------|-----------|
| **Protected** | status | Protected | User decision |
| | resolution | Protected | User decision |
| | resolved_by | Protected | Audit trail |
| | resolved_at | Protected | Audit trail |
| **Identity** | fingerprint | Protected | Never changes |
| | tenant_id | Protected | Never changes |
| | asset_id | Protected | Never changes |
| **Detection** | rule_id | FirstWins | Original detection |
| | rule_name | FirstWins | Original detection |
| **Content** | title | LastWins | May improve |
| | description | LastWins | May improve |
| | snippet | LastWins | May improve |
| **Severity** | severity | MaxValue | Escalate only |
| | cvss_score | MaxValue | Keep highest |
| | epss_score | LastWins | Always latest |
| **Classification** | cve_id | FirstWins | Doesn't change |
| | cwe_ids | Append | Accumulate |
| | owasp_ids | Append | Accumulate |
| **Secret** | secret_type | FirstWins | Type fixed |
| | secret_service | FirstWins | Service fixed |
| | secret_valid | LastWins | Latest check |
| | secret_revoked | LastWins | Latest status |
| **Web3** | web3_chain | FirstWins | Chain fixed |
| | web3_contract | FirstWins | Address fixed |
| | web3_swc_id | FirstWins | ID fixed |
| | bytecode_offset | LastWins | May refine |
| **Arrays** | tags | Append | Accumulate |
| | references | Append | Accumulate |
| **Objects** | metadata | Merge | Deep merge |
| | partial_fingerprints | Merge | Accumulate |
