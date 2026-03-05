---
layout: default
title: Finding Enrichment
parent: Features
nav_order: 10
---

# Finding Enrichment

> **Status**: Implemented
> **Version**: v1.0
> **Released**: 2026-03-05

## Overview

Finding Enrichment automatically merges new scan data into existing findings when scanners re-scan the same target. Previously, re-scanning only updated `scan_id`, `last_seen_at`, and `updated_at` — all other new data (severity upgrades, new CWEs, updated descriptions, remediation info) was silently discarded.

With enrichment enabled, the domain method `EnrichFrom()` applies field-level merge rules to selectively update findings while protecting user decisions (status, resolution, assignments).

## Problem Statement

Without enrichment:

1. **Severity upgrades lost** — NVD updates a CVE from 7.5 to 9.8, but the finding stays at 7.5
2. **CWE/OWASP data discarded** — A second scan adds CWE-89 classification, but it's thrown away
3. **Multi-tool data ignored** — Tool A finds the vulnerability, Tool B adds remediation details, but Tool B's data is lost
4. **Progressive scanning broken** — Secret detection finds a key, secret verifier confirms it's valid, but the validation result is never stored

## Solution: Selective Field Enrichment

When a finding already exists (matched by fingerprint), the processor now:

1. Builds a `Finding` domain entity from the new scan data
2. Loads the existing finding from the database
3. Calls `existing.EnrichFrom(newData)` which applies field-level merge rules
4. Batch-updates all enrichable columns in a single transaction

### Enrichment Rules

Each field follows one of six merge strategies:

| Rule | Fields | Behavior |
|------|--------|----------|
| **Protected** | status, resolution, resolved_by/at, assigned_to/by/at, verified_by/at | Never touched by enrichment |
| **LastWins** | title, description, snippet, message, impact, likelihood | Replaced with new non-empty value |
| **MaxValue** | severity, cvss_score, confidence, rank | Keep the highest value (severity never downgrades) |
| **FirstWins** | cve_id, rule_id, rule_name, secret_type, web3_chain, web3_contract_address, file_path | Only set if currently empty |
| **Append** | cwe_ids, owasp_ids, tags, vulnerability_class, subcategory, compliance_impact, work_item_uris | Unique accumulation (capped at 500 items) |
| **Merge** | metadata, partial_fingerprints | Deep merge (new keys added, existing keys preserved) |

### Graceful Fallback

If enrichment fails for any reason (DB error, marshalling error), the system gracefully falls back to the previous scan-id-only update (`UpdateScanIDBatchByFingerprints`). This ensures no breakage.

If `buildFinding()` fails for a specific finding (e.g., invalid data), that fingerprint also falls back to scan-id-only update while other findings are still enriched.

## Architecture

### Data Flow

```
Scanner Report
    │
    ▼
ProcessBatch()
    │
    ├─ Step 1-2: Generate fingerprints, check existence
    │
    ├─ Step 3: Separate new vs existing
    │   ├─ New findings → buildFinding() → CreateBatchWithResult()
    │   └─ Existing findings → buildFinding() for enrichment data
    │
    ├─ Step 3b: Auto-reopen previously auto-resolved findings
    │
    ├─ Step 4: Batch create new findings
    │
    └─ Step 5: Enrich existing findings
        ├─ EnrichBatchByFingerprints()
        │   ├─ GetByFingerprintsBatch() — load existing from DB
        │   ├─ existing.EnrichFrom(newData) — apply domain rules
        │   └─ Batch UPDATE enrichable columns
        │
        └─ Fallback: UpdateScanIDBatchByFingerprints()
            (for findings where buildFinding or enrichment failed)
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| `EnrichFrom()` | `pkg/domain/vulnerability/finding.go` | Domain logic: field-level merge rules |
| `GetByFingerprintsBatch()` | `internal/infra/postgres/finding_repository.go` | Batch-load existing findings by fingerprint |
| `EnrichBatchByFingerprints()` | `internal/infra/postgres/finding_repository.go` | Load, enrich, and batch-update findings |
| `ProcessBatch()` | `internal/app/ingest/processor_findings.go` | Orchestrates enrichment during ingestion |

### Repository Interface

```go
// FindingRepository (additions)
GetByFingerprintsBatch(ctx context.Context, tenantID shared.ID, fingerprints []string) (map[string]*Finding, error)
EnrichBatchByFingerprints(ctx context.Context, tenantID shared.ID, newFindings []*Finding, scanID string) (int64, error)
```

### Protected Columns (Never Updated by Enrichment)

The enrichment UPDATE query explicitly excludes these columns:

- `status`, `resolution` — User/workflow decisions
- `resolved_at`, `resolved_by` — Resolution audit trail
- `assigned_to`, `assigned_by`, `assigned_at` — Assignment workflow
- `verified_at`, `verified_by` — Verification audit trail
- `id`, `tenant_id`, `asset_id`, `fingerprint` — Identity columns
- `created_at`, `first_detected_at` — Creation audit trail

## Examples

### Severity Upgrade

```
Scan 1: Finding created with severity=medium, no CWEs
Scan 2: Same fingerprint, severity=critical, CWE-89

Result:
  severity = critical    (MaxValue: upgraded)
  cwe_ids = ["CWE-89"]  (Append: added)
  status = open          (Protected: unchanged)
```

### Multi-Tool Enrichment

```
Tool A (Slither):  chain=ethereum, swc_id=SWC-107
Tool B (Mythril):  chain=ethereum, bytecode_offset=0x1234, function_selector=0xa9059cbb

Result:
  web3_chain = ethereum           (FirstWins: kept from Tool A)
  web3_swc_id = SWC-107           (FirstWins: kept from Tool A)
  web3_bytecode_offset = 0x1234   (LastWins: added by Tool B)
  web3_function_selector = 0xa9   (LastWins: added by Tool B)
```

### CVSS MaxValue

```
Day 1:  cvss_score=7.5
Day 30: cvss_score=9.8 (NVD update)
Day 60: cvss_score=8.0 (different tool)

Result: cvss_score = 9.8  (MaxValue: kept highest)
```

### Idempotent Re-scan

```
Scan 1: severity=high, tags=["sql-injection"]
Scan 2: severity=high, tags=["sql-injection"] (identical)

Result: 0 created, N enriched (no data change, timestamps updated)
```

## Performance

### Query Count (per ProcessBatch, existing findings path)

| Step | Query | Count |
|------|-------|-------|
| CheckFingerprintsExist | `SELECT fingerprint WHERE fingerprint IN (...)` | 1 |
| AutoReopenByFingerprintsBatch | `UPDATE ... WHERE fingerprint = ANY(...)` | 1 |
| GetByFingerprintsBatch | `SELECT * WHERE fingerprint = ANY(...)` (no subquery) | 1 |
| Enrichment UPDATEs | Batch VALUES-based UPDATE, 1 query per 1000 findings | ceil(N/1000) |
| Fallback (if needed) | `UPDATE scan_id WHERE fingerprint = ANY(...)` | 0-1 |
| **Total** | | **ceil(N/1000) + 3** |

For typical batches (< 1000 findings): **4 queries total** regardless of batch size.

### Optimizations Applied

- **Batch VALUES UPDATE**: Instead of N individual UPDATE statements, enrichment uses a single `UPDATE ... FROM (VALUES ...) AS d(...)` query per chunk of up to 1000 findings. This reduces N round-trips to 1, with PostgreSQL executing a single query plan for the entire batch.
- **No correlated subquery**: `selectQueryForEnrichment()` uses `FALSE AS has_data_flow` instead of the `EXISTS(SELECT 1 FROM finding_data_flows ...)` subquery, avoiding N extra lookups during batch load
- **Chunked parameter safety**: Each batch chunk uses up to 50,000 parameters (1000 rows x 50 columns), staying safely under PostgreSQL's 65,535 parameter limit
- **Snippet update eliminated**: `EnrichFrom()` already handles snippet via LastWins, so the separate `UpdateSnippetBatchByFingerprints` is only called for unenriched fallback fingerprints
- **Array size cap**: `appendUniqueStrings` caps at 500 elements per array field, preventing unbounded growth from malicious scanners
- **Domain-side logic**: `EnrichFrom()` runs in Go (not SQL), keeping the UPDATE query simple and predictable

## Related Features

- [Finding Deduplication](finding-deduplication.md) — Fingerprint-based matching that determines which findings get enriched
- [Finding Lifecycle](finding-lifecycle.md) — Auto-resolve/reopen runs alongside enrichment in the same processing pipeline
- [Finding Types](finding-types.md) — Type-specific fields (secret, web3, compliance, misconfig) all support enrichment
- [CTEM Fields](ctem-fields.md) — Exposure and remediation fields enriched via LastWins strategy
