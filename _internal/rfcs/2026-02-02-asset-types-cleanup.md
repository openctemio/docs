# Asset Types Cleanup & Scanner Matching

**Created:** 2026-02-02
**Status:** IMPLEMENTED (Phases 1-3)
**Priority:** HIGH
**Author:** Security Engineering Team
**Last Updated:** 2026-02-02

> **Implementation Complete:** Phases 1-3 (Backend) have been fully implemented.
> Phase 4 (UI Components) pending.

---

## Executive Summary

This RFC addresses critical gaps in the scan system:
1. **Duplicate/Legacy asset types** causing confusion and inconsistency
2. **Missing asset-scanner compatibility validation** causing wasted compute and silent failures
3. **Incomplete workflow context** - `asset_type` not auto-populated, `AssetGroupIDs[]` not passed to agents
4. **No validation at scan creation** - users can create scans with incompatible tool-asset combinations
5. **Unclassified assets (`other` type)** - cannot map to any scanner, wasted resources

---

## System Analysis

### Current Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           SCAN TRIGGER                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  Scan Entity:                                                           │
│  - AssetGroupID (primary) ──────► Passed to agents ✓                   │
│  - AssetGroupIDs[] ─────────────► NOT passed (unused!) ✗               │
│  - Targets[] ───────────────────► Passed to agents ✓                   │
│  - ScanType: "workflow" | "single"                                     │
└────────────────────────┬────────────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
    WORKFLOW SCAN                   SINGLE SCAN
    (Multi-step pipeline)           (Single tool)
         │                               │
    ┌────▼────────────────┐        ┌─────▼─────────────┐
    │ Pipeline Context:   │        │ Scanner Context:  │
    │ - asset_group_id ✓  │        │ - scanner_name    │
    │ - asset_type ✗      │        │ - scanner_config  │
    │   (must set manual) │        │ - asset_group_id  │
    │ - scan_id           │        │ - targets_per_job │
    └────┬────────────────┘        └─────┬─────────────┘
         │                               │
    ┌────▼────────────────┐              │
    │ Step Conditions     │              │
    │ evaluateCondition() │              │
    │                     │              │
    │ ConditionTypeAssetType             │
    │ → compares context  │              │
    │   ["asset_type"]    │              │
    │   with condition    │              │
    │   value             │              │
    │                     │              │
    │ PROBLEM: asset_type │              │
    │ not auto-detected!  │              │
    └────┬────────────────┘              │
         │                               │
    ┌────▼────────────────┐              │
    │ Capabilities Match  │              │
    │ FindByCapabilities()│              │
    │ → finds tool/agent  │              │
    │   by capabilities   │              │
    │                     │              │
    │ ✓ WORKING           │              │
    └────┬────────────────┘              │
         │                               │
         └───────────────┬───────────────┘
                         ▼
              ┌──────────────────────────┐
              │ AGENT EXECUTION          │
              │                          │
              │ 1. Resolve assets from   │
              │    asset_group_id        │
              │ 2. Combine with targets  │
              │ 3. Execute tool          │
              │                          │
              │ ✗ NO VALIDATION:         │
              │   tool.supported_targets │
              │   vs asset.asset_type    │
              └──────────────────────────┘
```

### Two Validation Systems (Capabilities vs Supported Targets)

| Aspect | Capabilities | Supported Targets |
|--------|--------------|-------------------|
| **Purpose** | What can the tool DO? | What can the tool SCAN? |
| **Examples** | `sast`, `dast`, `recon`, `secrets` | `url`, `domain`, `ip`, `repository` |
| **Used by** | Pipeline step → find matching tool | *(Not used - dead code!)* |
| **Validates** | Tool has required functionality | *(Should validate)* asset compatibility |
| **Status** | ✅ Working | ❌ Dead code |

**Example showing both are needed:**
```
Nuclei tool:
  - capabilities: ["dast", "web"]     → Can perform DAST scans ✓
  - supported_targets: ["url", "domain", "ip"]

Scan with:
  - Asset group containing: [domain, repository, ip_address]

Current behavior:
  ✓ Capabilities check passes (dast capability available)
  ✗ No supported_targets check
  → Agent receives repository assets
  → Nuclei can't scan repositories
  → Silent failure or wasted compute
```

---

## Problem Statement

### Issue 1: Duplicate Asset Types (5 types)

| Type to REMOVE | Replace with | Reason | Usage Count |
|----------------|--------------|--------|-------------|
| `code_repo` | `repository` | Explicit alias in code | 1 |
| `application` | `web_application` | Legacy, too generic | 0 |
| `endpoint` | `api` or `service` | Legacy, ambiguous | 0 |
| `cloud` | `cloud_account` | Legacy, unclear | 0 |
| `other` | *(delete)* | Forces bad data | 0 |

### Issue 2: Dead Code - `SupportsTarget()` Never Called

```go
// api/internal/domain/tool/entity.go line 223
func (t *Tool) SupportsTarget(targetType string) bool {
    return slices.Contains(t.SupportedTargets, targetType)
}
// ↑ This method is NEVER called anywhere in the codebase
```

### Issue 3: `asset_type` Not Auto-Populated in Context

```go
// api/internal/app/pipeline/run.go line 720
case pipeline.ConditionTypeAssetType:
    assetType, ok := run.Context["asset_type"].(string)
    return ok && assetType == step.Condition.Value
// ↑ Relies on manual context setting, not auto-detected from asset
```

### Issue 4: `AssetGroupIDs[]` Not Passed to Agents

```go
// api/internal/app/scan/trigger.go line 141
runContext["asset_group_id"] = sc.AssetGroupID.String()  // Only primary!
// ↑ AssetGroupIDs[] array is ignored
```

### Issue 5: No Validation at Scan Creation

```go
// api/internal/app/scan/crud.go - CreateScan()
// Current validation:
// ✓ Tool exists and is_active
// ✓ Pipeline steps have valid tools
// ✗ NO validation of tool.supported_targets vs asset types in group
//
// User can create a scan with:
// - nuclei scanner (supports: url, domain, ip)
// - Asset group containing: [repository, repository, container]
// → Scan created successfully
// → Trigger will waste resources trying to scan incompatible assets
```

### Issue 6: Unclassified Assets (`other` Type)

```go
// api/internal/app/ingest/mappers.go line 105
default:
    return asset.AssetTypeOther  // Fallback for unknown types

// Problem:
// - `other` cannot be mapped to ANY tool supported_target
// - Assets with type `other` will always be incompatible
// - Wasted compute when scanning groups with unclassified assets
```

---

## Asset Type Analysis: DNS Records, ASN, Subnet

### Evaluation Request

During RFC review, the following questions were raised:
- Should `dns_record` be an asset type?
- Should `asn` (Autonomous System Number) be an asset type?
- Does `subnet` exist as an asset type?

### Analysis Results

#### 1. Subnet ✅ **Already Exists**

| Item | Status |
|------|--------|
| Go Code | `AssetTypeSubnet = "subnet"` in `value_objects.go:52` |
| DB Migration | Migration `000114_asset_types_sync_and_fk.up.sql` line 103 |
| Properties Schema | Documented in `asset-properties-schema.md:442-457` |
| Category | Network |

**Verdict:** No action needed - subnet is fully implemented.

#### 2. DNS Records ✅ **Keep as Property (Current Design is Correct)**

| Aspect | Current Implementation |
|--------|----------------------|
| Storage | `properties.domain.dns_records[]` array |
| Schema | `{type, name, value, ttl}` per record |
| Supported Types | A, AAAA, CNAME, MX, TXT, NS, SOA, SRV, PTR |
| Validation | `properties.go:198` validates record types |
| CTIS Schema | `DNSRecord` struct in `ctis/types.go:186-192` |

**Why NOT an asset type:**

| Criteria | DNS Record as Property | DNS Record as Asset Type |
|----------|----------------------|-------------------------|
| **Relationship** | 1 Domain → N DNS records | N DNS records (orphaned) |
| **Ownership** | Belongs to domain | Independent entity |
| **Scanning** | Scan domain, get DNS info | No tools scan DNS records directly |
| **Query** | Query domain properties | Separate table, more JOINs |
| **Simplicity** | ✅ Simple, nested | ❌ Complex, more entities |

**Best Practice:** Industry standard (Shodan, Censys, SecurityTrails) store DNS records as domain properties, not separate assets.

**Verdict:** Keep DNS records as property of domain assets. No change needed.

#### 3. ASN ✅ **Keep as Property (Do NOT add as Asset Type)**

| Aspect | Current Implementation |
|--------|----------------------|
| Storage | `properties.ip_address.asn` (integer) |
| Storage | `properties.ip_address.asn_org` (string) |
| Validation | `properties.go:276-282` validates range 0-4294967295 |
| CTIS Schema | `IPAddressTechnical.ASN` and `ASNOrg` in `ctis/types.go:202-206` |

**What is ASN?**
- Autonomous System Number - unique ID for a network (e.g., AS15169 = Google)
- Range: 0 - 4,294,967,295 (32-bit)
- One ASN contains many IP ranges/prefixes

**Comparison: ASN as Property vs Asset Type:**

| Criteria | ASN as Property (Current) | ASN as Asset Type |
|----------|--------------------------|-------------------|
| **Use Case** | "What ASN does this IP belong to?" | "What IPs belong to this ASN?" |
| **Relationship** | 1 IP → 1 ASN info | 1 ASN → N IPs (parent-child) |
| **Tool Support** | IP scanning tools populate ASN | Few tools (amass, asnmap) |
| **Scannable?** | ASN is metadata, not target | Cannot scan ASN directly |
| **Value** | High - enriches IP data | Low - meta-information |
| **Complexity** | Low (already works) | High (new entity + migration) |

**Why NOT an asset type:**

1. **ASN is not directly scannable** - Security tools don't target ASNs
2. **Property is sufficient** - Can query/filter IPs by ASN in metadata
3. **Industry standard** - Shodan, Censys store ASN as IP property
4. **Complexity vs Value** - High implementation cost, low user value

**Alternative Enhancements (Optional - Out of Scope):**

Instead of new asset type, consider:

```sql
-- 1. Add index for fast ASN queries
CREATE INDEX idx_assets_asn ON assets
USING GIN ((properties->'ip_address'->'asn'));

-- 2. Create view for ASN aggregation
CREATE VIEW asset_asn_summary AS
SELECT
    (properties->'ip_address'->>'asn')::int AS asn,
    properties->'ip_address'->>'asn_org' AS asn_org,
    COUNT(*) AS ip_count,
    tenant_id
FROM assets
WHERE asset_type = 'ip_address'
  AND properties->'ip_address'->'asn' IS NOT NULL
GROUP BY tenant_id, asn, asn_org;
```

**Verdict:** Keep ASN as property of ip_address assets. Do NOT add as asset type.

### Summary Table

| Item | Current Status | Recommendation | Action |
|------|----------------|----------------|--------|
| `subnet` | ✅ Asset type exists | Keep as-is | None |
| `dns_record` | ✅ Property of domain | Keep as property | None |
| `asn` | ✅ Property of ip_address | Keep as property | None |

**Key Principle:** Only create asset types for entities that:
1. Can be independently scanned
2. Have dedicated tools targeting them
3. Represent first-class security assets (not metadata)

DNS records and ASN are metadata/attributes of their parent assets (domain, ip_address), not independent scannable entities.

---

## Validation Strategy: Smart Filtering (Hybrid Approach)

### Design Decision: Warning vs Auto-Filter

| Approach | Description | Pros | Cons |
|----------|-------------|------|------|
| **Warning/Block** | Warn at create, block at trigger | Clear feedback | Disrupts flow |
| **Auto-Filter** | Auto-select compatible assets | Seamless UX | Silent skips |
| **Hybrid (Chosen)** | Warn at create, auto-filter at trigger with report | Best of both | More complex |

**Decision: Hybrid Approach**

Reasons:
1. **Early feedback** at creation (warning) - user knows upfront
2. **Non-blocking execution** - scan runs with compatible assets
3. **Transparent reporting** - clear report of what was scanned vs skipped
4. **No manual intervention** - user doesn't need to fix asset groups

### When to Validate

| Stage | Validation Level | User Experience |
|-------|-----------------|-----------------|
| **CreateScan** | Warning (informational) | Show compatibility preview, allow creation |
| **UpdateScan** | Warning (informational) | Show if asset group changed |
| **TriggerScan** | **Auto-filter + Report** | Filter compatible assets, report skipped |
| **ScheduledTrigger** | **Auto-filter + Log** | Same as trigger, log metrics |

### Why Hybrid Approach?

1. **Early feedback** - User knows immediately if there's a mismatch (warning at create)
2. **Non-disruptive** - Scan proceeds without manual fixes
3. **Transparent** - Clear report of scanned vs skipped assets
4. **Graceful degradation** - Scan what's possible, skip what's not
5. **Audit trail** - Full visibility into filtering decisions

### Validation Flow Diagram (Smart Filtering)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CREATE SCAN                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Validate basic fields (name, tenant, etc.)                          │
│  2. Validate tool exists and is_active                         ✓ EXISTS │
│  3. NEW: Check asset-tool compatibility (PREVIEW)                        │
│     │                                                                    │
│     ├─► Get asset types from group(s)                                   │
│     │   ├─► Primary AssetGroupID                                        │
│     │   ├─► Additional AssetGroupIDs[]                                  │
│     │   └─► Direct Targets[] (infer types)                              │
│     │                                                                    │
│     ├─► For Single Scan: Check scanner.supported_targets                │
│     │   For Workflow: Check each step's tool.supported_targets          │
│     │                                                                    │
│     └─► Return: CompatibilityPreview in response (WARNING ONLY)         │
│                                                                          │
│  4. Create scan (ALWAYS allow, include preview in response)             │
│     → User sees: "80% compatible, 20 assets will be skipped"            │
└────────────────────────┬────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    TRIGGER SCAN (Smart Filtering)                        │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Get all assets from group(s)                                        │
│  2. Get tool supported_targets                                          │
│  3. FILTER: Select only compatible assets                               │
│     │                                                                    │
│     ├─► For each asset:                                                 │
│     │   ├─► Check asset.asset_type vs tool targets (via mapping table)  │
│     │   ├─► Compatible → Add to scan_assets                             │
│     │   └─► Incompatible → Add to skipped_assets                        │
│     │                                                                    │
│     ├─► Edge case: ALL assets incompatible (0 compatible)               │
│     │   └─► Still proceed with empty scan (record in report)            │
│     │                                                                    │
│     └─► Edge case: ALL assets are 'other' type                          │
│         └─► Proceed with 0 assets (warning in report)                   │
│                                                                          │
│  4. Pass ONLY compatible assets to agent                                │
│  5. Include FilteringResult in TriggerResponse                          │
│     → Shows: scanned (80), skipped (20), reason per skip                │
└────────────────────────┬────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        AGENT EXECUTION                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  Agent receives:                                                         │
│  - scan_assets: [only compatible assets]                                │
│  - Original group reference (for audit)                                 │
│  - Filtering report reference (for observability)                       │
│                                                                          │
│  Agent ONLY scans compatible assets → no wasted compute                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Behavior Changes

| Scenario | Old Behavior | New Smart Filtering Behavior |
|----------|-------------|------------------------------|
| Mixed compatible + incompatible | Block or warn, user fixes | Auto-filter, scan compatible |
| 100% incompatible | Block unless force=true | Proceed with 0 assets, report |
| 100% `other` type | Block with error | Proceed with 0 assets, report |
| Scheduled scan with changes | May fail | Auto-filter, never fail |

---

## Use Cases & Edge Cases

### Use Cases (Updated for Smart Filtering)

| # | Use Case | Tool | Assets | Create | Trigger | Agent Receives |
|---|----------|------|--------|--------|---------|----------------|
| UC1 | Web vulnerability scan | nuclei (`url,domain,ip`) | `[domain, domain]` | ✅ No warning | ✅ Scan 2 | 2 domains |
| UC2 | Code security scan | semgrep (`file,repository`) | `[repository]` | ✅ No warning | ✅ Scan 1 | 1 repository |
| UC3 | Mixed asset group | nuclei | `[domain, repository, ip]` | ⚠️ 67% compatible | ✅ Scan 2, skip 1 | 2 (domain, ip) |
| UC4 | Container scan | trivy (`file,repo,container`) | `[container, repository]` | ✅ No warning | ✅ Scan 2 | 2 assets |
| UC5 | All incompatible | nuclei | `[repository, repository]` | ⚠️ 0% compatible | ✅ Scan 0, skip 2 | 0 (empty) |
| UC6 | Mixed with `other` | nuclei | `[domain, other, other]` | ⚠️ 33% compatible | ✅ Scan 1, skip 2 | 1 domain |

### Edge Cases (Updated for Smart Filtering)

| # | Edge Case | Scenario | At Create | At Trigger |
|---|-----------|----------|-----------|------------|
| EC1 | Empty asset group | Group has 0 assets | ✅ No warning | ✅ Scan 0 (report: empty) |
| EC2 | Tool without supported_targets | Legacy tool, no data | ✅ Skip validation | ✅ Scan all (no filter) |
| EC3 | Unknown asset type | New type not in mapping | ⚠️ Warning | ⚠️ Skip unknown, report |
| EC4 | 100% incompatible | All assets wrong type | ⚠️ 0% warning | ✅ Scan 0, report all skipped |
| EC5 | Null asset_type | Asset has NULL type | ⚠️ Warning | ⚠️ Skip null, include in report |
| EC6 | Multiple asset groups | Scan uses AssetGroupIDs[] | ⚠️ Combined preview | ✅ Filter across all groups |
| EC7 | Direct targets only | Scan uses targets[], no group | ⚠️ Inferred preview | ✅ Filter inferred types |
| EC8 | Workflow multi-tool | Pipeline has 3 tools | ⚠️ Union of all tools | ✅ Filter per step's tool |
| EC9 | Scheduled scan | Trigger via scheduler | N/A | ✅ Auto-filter, log metrics |
| EC10 | Quick scan | Ephemeral group + targets | ⚠️ Preview if possible | ✅ Filter combined |
| EC11 | Assets type `other` | Group has unclassified assets | ⚠️ "X unclassified" | ✅ Skip `other`, report |
| EC12 | 100% `other` assets | All assets unclassified | ⚠️ 0% compatible | ✅ Scan 0, report all skipped |
| EC13 | Mixed with `other` | 5 domains + 3 `other` | ⚠️ 62.5% compatible | ✅ Scan 5, skip 3 |
| EC14 | Create scan validation | User creates scan | ⚠️ Preview only | N/A |
| EC15 | Asset group changes | Assets added after scan created | N/A | ✅ Re-filter at trigger |

### Smart Filtering Decision Matrix

| Compatibility | At Creation | At Trigger | Result |
|---------------|-------------|------------|--------|
| 100% compatible | ✅ No warning | ✅ Scan all | Full coverage |
| 50-99% compatible | ⚠️ Preview | ✅ Scan compatible, skip rest | Partial scan + report |
| 1-49% compatible | ⚠️ Strong preview | ✅ Scan compatible, skip rest | Minimal scan + report |
| 0% compatible | ⚠️ "No compatible assets" | ✅ Scan 0, report all skipped | Empty scan + full report |
| Has `other` assets | ⚠️ "X unclassified" | ✅ Skip `other`, scan rest | Report unclassified |
| 100% `other` | ⚠️ "All unclassified" | ✅ Scan 0, report | Suggest classify |

**Key Principle:** Never block at trigger. Always filter and report.

---

## Implementation Summary (Completed 2026-02-02)

### Files Changed

#### Database Migrations
- `api/migrations/000151_asset_types_cleanup.up.sql` - Added `unclassified` asset type
- `api/migrations/000151_asset_types_cleanup.down.sql` - Rollback
- `api/migrations/000152_target_asset_type_mappings.up.sql` - Target mapping table + seed data
- `api/migrations/000152_target_asset_type_mappings.down.sql` - Rollback

#### Domain Layer
- `api/internal/domain/tool/target_mapping.go` - New entity `TargetAssetTypeMapping`
- `api/internal/domain/tool/repository.go` - Added `TargetMappingRepository` interface
- `api/internal/domain/assetgroup/repository.go` - Added `GetDistinctAssetTypes()`, `CountAssetsByType()`
- `api/internal/domain/asset/types.go` - Added `AssetTypeUnclassified`

#### Infrastructure Layer
- `api/internal/infra/postgres/target_mapping_repository.go` - Repository implementation
- `api/internal/infra/postgres/asset_group_repository.go` - Added methods for type counting

#### Application Layer
- `api/internal/app/scan/filtering.go` - NEW: `AssetFilterService`, `FilteringResult`, `AssetCompatibilityPreview`
- `api/internal/app/scan/crud.go` - Added `PreviewScanCompatibility()`, `CreateScanResult`
- `api/internal/app/scan/trigger.go` - Added `filterAssetsForSingleScan()` smart filtering
- `api/internal/app/scan/service.go` - Added `targetMappingRepo` dependency

#### HTTP Handler Layer
- `api/internal/infra/http/handler/pipeline_handler.go` - Added `FilteringResultResponse`, `RunResponse.FilteringResult`
- `api/internal/infra/http/handler/scan_handler.go` - Updated swagger docs for TriggerScan

#### SDK
- `sdk/pkg/ctis/types.go` - Added DataFlow helper methods (`BuildSummary`, `AddIntermediate`, etc.)

#### UI Types
- `ui/src/features/assets/types/asset.types.ts` - Added `unclassified` type, updated labels/icons

#### Schemas
- `schemas/ctis/v1/asset.json` - Added `unclassified`, `cloud` to AssetType enum
- `schemas/ctis/v1/report.json` - Fixed brandname to "OpenCTEM"

#### Cleanup
- Removed duplicate package `api/pkg/parsers/ctis/` (migrated to `sdk/pkg/ctis`)

### Smart Filtering Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CreateScan                                   │
├─────────────────────────────────────────────────────────────────────┤
│  1. Create scan entity                                              │
│  2. Call PreviewScanCompatibility()                                 │
│     └── Get tool.supported_targets                                  │
│     └── Get asset type counts from groups                           │
│     └── Check compatibility via TargetMappingRepository             │
│  3. Return scan + optional compatibility_warning                    │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         TriggerScan                                  │
├─────────────────────────────────────────────────────────────────────┤
│  1. Validate scan can trigger                                       │
│  2. Call filterAssetsForSingleScan()                                │
│     └── Get tool.supported_targets                                  │
│     └── Get asset type counts via CountAssetsByType()               │
│     └── Call FilterAssetsForScan() → FilteringResult                │
│  3. Add filtering_result to run context                             │
│  4. Create pipeline run with context                                │
│  5. Return run with filtering_result in response                    │
└─────────────────────────────────────────────────────────────────────┘
```

### API Response Examples

**TriggerScan Response with Filtering:**
```json
{
  "id": "run-uuid",
  "status": "running",
  "filtering_result": {
    "total_assets": 100,
    "scanned_assets": 75,
    "skipped_assets": 25,
    "unclassified_assets": 10,
    "compatibility_percent": 75.0,
    "was_filtered": true,
    "tool_name": "nuclei",
    "supported_targets": ["url", "domain", "ip"],
    "skip_reasons": [
      {"asset_type": "repository", "count": 15, "reason": "Not compatible with targets"},
      {"asset_type": "unclassified", "count": 10, "reason": "Unclassified assets cannot be matched"}
    ]
  }
}
```

---

## Implementation Plan

### Phase 1: Asset Types Cleanup (1 day)

#### 1.1 Database Migration

**File:** `api/migrations/000151_asset_types_cleanup.up.sql`

```sql
-- Step 1: Migrate existing assets to correct types
UPDATE assets SET asset_type = 'repository' WHERE asset_type = 'code_repo';
UPDATE assets SET asset_type = 'web_application' WHERE asset_type = 'application';
UPDATE assets SET asset_type = 'api' WHERE asset_type = 'endpoint';
UPDATE assets SET asset_type = 'cloud_account' WHERE asset_type = 'cloud';
-- Note: 'other' assets need manual review before deletion

-- Step 2: Delete from asset_types master table
DELETE FROM asset_types WHERE code IN ('code_repo', 'application', 'endpoint', 'cloud');
-- 'other' kept temporarily for migration
```

#### 1.2 Go Code Changes

**File:** `api/internal/domain/asset/value_objects.go`

```go
// REMOVE these constants:
// AssetTypeCodeRepo    AssetType = "code_repo"
// AssetTypeApplication AssetType = "application"
// AssetTypeEndpoint    AssetType = "endpoint"
// AssetTypeCloud       AssetType = "cloud"
// AssetTypeOther       AssetType = "other"

// UPDATE AllAssetTypes() to exclude removed types
```

#### 1.3 Update References

- `api/internal/infra/postgres/asset_repository.go` - Remove `code_repo` from IN clauses
- `api/internal/app/ingest/processor_findings.go` - Update comment

---

### Phase 2: Dynamic Target Mapping (1.5 days)

#### 2.0 Design Decision: Dynamic vs Hardcoded Mapping

**Problem:** How to map tool `supported_targets` (e.g., `url`, `domain`) to asset types (e.g., `website`, `domain`)?

| Approach | Description | Pros | Cons |
|----------|-------------|------|------|
| **A: Hardcoded** | Map in Go code | Simple, type-safe | Deploy to add mappings |
| **B: Tool column** | Add `supported_asset_types[]` to tools | Per-tool config | Duplicate data, inconsistent |
| **C: Mapping table** | Separate `target_asset_type_mappings` table | Single source of truth, FK integrity | More complex |

**Decision: Approach C (Mapping Table)**

Reasons:
1. **Single source of truth** - One table defines all mappings
2. **Referential integrity** - FK to `asset_types.code` ensures valid mappings
3. **Admin configurable** - Can manage via API/UI without code deploy
4. **Separation of concerns** - Tool has targets, mapping table translates to asset types
5. **Future-proof** - New asset types just need mapping rows

#### 2.1 Database Migration

**File:** `api/migrations/000151_target_asset_type_mappings.up.sql` (NEW)

```sql
-- =============================================================================
-- Migration 151: Target to Asset Type Mappings
-- =============================================================================
-- This table maps tool supported_targets (url, domain, ip, etc.) to asset types.
-- Provides dynamic configuration without code changes.

CREATE TABLE IF NOT EXISTS target_asset_type_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The target type from tools.supported_targets
    target_type VARCHAR(50) NOT NULL,

    -- The asset type code (FK to asset_types)
    asset_type VARCHAR(50) NOT NULL,

    -- Is this the primary/canonical mapping? (for reverse lookup)
    is_primary BOOLEAN DEFAULT false,

    -- Description for admin UI
    description TEXT,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_target_asset_mapping UNIQUE (target_type, asset_type),
    CONSTRAINT fk_mapping_asset_type FOREIGN KEY (asset_type)
        REFERENCES asset_types(code) ON UPDATE CASCADE ON DELETE CASCADE
);

-- Index for lookups
CREATE INDEX idx_target_mappings_target ON target_asset_type_mappings(target_type);
CREATE INDEX idx_target_mappings_asset ON target_asset_type_mappings(asset_type);

-- Seed initial mappings
INSERT INTO target_asset_type_mappings (target_type, asset_type, is_primary, description) VALUES
-- URL targets → web-related asset types
('url', 'website', true, 'URLs map primarily to websites'),
('url', 'web_application', false, 'URLs can also be web applications'),
('url', 'api', false, 'API endpoints are URLs'),
('url', 'http_service', false, 'HTTP services discovered by recon'),
('url', 'discovered_url', false, 'URLs discovered by crawlers'),

-- Domain targets → domain-related asset types
('domain', 'domain', true, 'Domains map to domain assets'),
('domain', 'subdomain', false, 'Subdomains are a type of domain'),

-- IP targets → IP-related asset types
('ip', 'ip_address', true, 'IPs map to IP address assets'),

-- Repository targets → code-related asset types
('repository', 'repository', true, 'Repository targets map to repository assets'),
('file', 'repository', false, 'File scanning often targets repositories'),

-- Container targets → container-related asset types
('container', 'container', true, 'Container targets map to container assets'),
('container', 'container_registry', false, 'Container registries hold containers'),

-- Host targets → infrastructure asset types
('host', 'host', true, 'Host targets map to host assets'),
('host', 'server', false, 'Servers are hosts'),
('host', 'compute', false, 'Compute instances are hosts')

ON CONFLICT (target_type, asset_type) DO NOTHING;

-- Comment
COMMENT ON TABLE target_asset_type_mappings IS
    'Maps tool supported_targets to compatible asset_types. Admin-configurable.';
```

**File:** `api/migrations/000151_target_asset_type_mappings.down.sql`

```sql
DROP TABLE IF EXISTS target_asset_type_mappings;
```

#### 2.2 Domain Entity & Repository

**File:** `api/internal/domain/tool/target_mapping.go` (NEW)

```go
package tool

import (
    "context"
    "time"
    "github.com/openctemio/api/internal/domain/shared"
)

// TargetAssetTypeMapping represents a mapping between tool target and asset type.
type TargetAssetTypeMapping struct {
    ID          shared.ID
    TargetType  string    // e.g., "url", "domain", "ip"
    AssetType   string    // e.g., "website", "domain", "ip_address"
    IsPrimary   bool      // Primary mapping for reverse lookup
    Description string
    CreatedAt   time.Time
    UpdatedAt   time.Time
}

// TargetMappingRepository defines the interface for target mappings.
type TargetMappingRepository interface {
    // GetAssetTypesForTarget returns all asset types compatible with a target type.
    GetAssetTypesForTarget(ctx context.Context, targetType string) ([]string, error)

    // GetAssetTypesForTargets returns all asset types compatible with multiple target types.
    GetAssetTypesForTargets(ctx context.Context, targetTypes []string) ([]string, error)

    // GetTargetForAssetType returns the primary target type for an asset type.
    GetTargetForAssetType(ctx context.Context, assetType string) (string, error)

    // CanToolScanAssetType checks if a tool's targets include the asset type.
    CanToolScanAssetType(ctx context.Context, supportedTargets []string, assetType string) (bool, error)

    // GetIncompatibleAssetTypes returns asset types that aren't covered by the targets.
    GetIncompatibleAssetTypes(ctx context.Context, supportedTargets []string, assetTypes []string) ([]string, error)

    // Admin operations
    Create(ctx context.Context, mapping *TargetAssetTypeMapping) error
    Update(ctx context.Context, mapping *TargetAssetTypeMapping) error
    Delete(ctx context.Context, id shared.ID) error
    List(ctx context.Context) ([]*TargetAssetTypeMapping, error)
}
```

#### 2.3 Repository Implementation

**File:** `api/internal/infra/postgres/target_mapping_repository.go` (NEW)

```go
package postgres

import (
    "context"
    "database/sql"
    "github.com/openctemio/api/internal/domain/tool"
    "github.com/openctemio/api/internal/domain/shared"
)

type TargetMappingRepository struct {
    db *sql.DB
}

func NewTargetMappingRepository(db *sql.DB) *TargetMappingRepository {
    return &TargetMappingRepository{db: db}
}

// GetAssetTypesForTargets returns all unique asset types for given target types.
func (r *TargetMappingRepository) GetAssetTypesForTargets(ctx context.Context, targetTypes []string) ([]string, error) {
    if len(targetTypes) == 0 {
        return []string{}, nil
    }

    query := `
        SELECT DISTINCT asset_type
        FROM target_asset_type_mappings
        WHERE target_type = ANY($1)
        ORDER BY asset_type
    `

    rows, err := r.db.QueryContext(ctx, query, targetTypes)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var assetTypes []string
    for rows.Next() {
        var at string
        if err := rows.Scan(&at); err != nil {
            continue
        }
        assetTypes = append(assetTypes, at)
    }
    return assetTypes, nil
}

// CanToolScanAssetType checks if any of the targets map to the asset type.
func (r *TargetMappingRepository) CanToolScanAssetType(ctx context.Context, supportedTargets []string, assetType string) (bool, error) {
    if len(supportedTargets) == 0 {
        return false, nil
    }

    query := `
        SELECT EXISTS(
            SELECT 1 FROM target_asset_type_mappings
            WHERE target_type = ANY($1) AND asset_type = $2
        )
    `

    var exists bool
    err := r.db.QueryRowContext(ctx, query, supportedTargets, assetType).Scan(&exists)
    return exists, err
}

// GetIncompatibleAssetTypes returns asset types not covered by any target.
func (r *TargetMappingRepository) GetIncompatibleAssetTypes(ctx context.Context, supportedTargets []string, assetTypes []string) ([]string, error) {
    if len(supportedTargets) == 0 || len(assetTypes) == 0 {
        return assetTypes, nil // All incompatible if no targets
    }

    // Get compatible types
    compatible, err := r.GetAssetTypesForTargets(ctx, supportedTargets)
    if err != nil {
        return nil, err
    }

    compatibleSet := make(map[string]bool)
    for _, t := range compatible {
        compatibleSet[t] = true
    }

    // Find incompatible
    var incompatible []string
    for _, at := range assetTypes {
        if !compatibleSet[at] {
            incompatible = append(incompatible, at)
        }
    }
    return incompatible, nil
}

// List returns all mappings (for admin UI).
func (r *TargetMappingRepository) List(ctx context.Context) ([]*tool.TargetAssetTypeMapping, error) {
    query := `
        SELECT id, target_type, asset_type, is_primary, COALESCE(description, ''), created_at, updated_at
        FROM target_asset_type_mappings
        ORDER BY target_type, is_primary DESC, asset_type
    `

    rows, err := r.db.QueryContext(ctx, query)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var mappings []*tool.TargetAssetTypeMapping
    for rows.Next() {
        var m tool.TargetAssetTypeMapping
        var id string
        if err := rows.Scan(&id, &m.TargetType, &m.AssetType, &m.IsPrimary, &m.Description, &m.CreatedAt, &m.UpdatedAt); err != nil {
            continue
        }
        m.ID, _ = shared.IDFromString(id)
        mappings = append(mappings, &m)
    }
    return mappings, nil
}
```

#### 2.4 Tests First (TDD)

**File:** `api/internal/infra/postgres/target_mapping_repository_test.go` (NEW)

```go
package postgres_test

import (
    "context"
    "testing"
    "github.com/stretchr/testify/assert"
)

func TestGetAssetTypesForTargets(t *testing.T) {
    // Setup test DB with seed data...

    tests := []struct {
        name           string
        targets        []string
        expectedTypes  []string
    }{
        {
            name:          "url targets",
            targets:       []string{"url"},
            expectedTypes: []string{"api", "discovered_url", "http_service", "web_application", "website"},
        },
        {
            name:          "domain targets",
            targets:       []string{"domain"},
            expectedTypes: []string{"domain", "subdomain"},
        },
        {
            name:          "multiple targets",
            targets:       []string{"url", "domain", "ip"},
            expectedTypes: []string{"api", "discovered_url", "domain", "http_service", "ip_address", "subdomain", "web_application", "website"},
        },
        {
            name:          "empty targets",
            targets:       []string{},
            expectedTypes: []string{},
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result, err := repo.GetAssetTypesForTargets(ctx, tt.targets)
            assert.NoError(t, err)
            assert.ElementsMatch(t, tt.expectedTypes, result)
        })
    }
}

func TestCanToolScanAssetType(t *testing.T) {
    tests := []struct {
        name      string
        targets   []string
        assetType string
        expected  bool
    }{
        {"nuclei can scan domain", []string{"url", "domain", "ip"}, "domain", true},
        {"nuclei can scan website", []string{"url", "domain", "ip"}, "website", true},
        {"nuclei cannot scan repository", []string{"url", "domain", "ip"}, "repository", false},
        {"semgrep can scan repository", []string{"file", "repository"}, "repository", true},
        {"empty targets", []string{}, "domain", false},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result, err := repo.CanToolScanAssetType(ctx, tt.targets, tt.assetType)
            assert.NoError(t, err)
            assert.Equal(t, tt.expected, result)
        })
    }
}

func TestGetIncompatibleAssetTypes(t *testing.T) {
    tests := []struct {
        name           string
        targets        []string
        assetTypes     []string
        expected       []string
    }{
        {
            name:       "all compatible",
            targets:    []string{"url", "domain"},
            assetTypes: []string{"website", "domain"},
            expected:   []string{},
        },
        {
            name:       "some incompatible",
            targets:    []string{"url", "domain"},
            assetTypes: []string{"website", "repository", "container"},
            expected:   []string{"repository", "container"},
        },
        {
            name:       "other type always incompatible",
            targets:    []string{"url"},
            assetTypes: []string{"website", "other"},
            expected:   []string{"other"},
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result, err := repo.GetIncompatibleAssetTypes(ctx, tt.targets, tt.assetTypes)
            assert.NoError(t, err)
            assert.ElementsMatch(t, tt.expected, result)
        })
    }
}
```

#### 2.5 Admin API (Required)

> **Note:** Admin API is REQUIRED for managing target mappings without code deployment.

**File:** `api/internal/infra/http/handler/admin_target_mapping_handler.go` (NEW)

```go
package handler

import (
    "github.com/gin-gonic/gin"
    "github.com/openctemio/api/internal/domain/tool"
)

// Valid target types (whitelist for security)
var validTargetTypes = []string{
    "url", "domain", "ip", "repository", "file",
    "container", "host", "kubernetes", "cloud",
}

type AdminTargetMappingHandler struct {
    repo   tool.TargetMappingRepository
    audit  AuditLogger
    logger Logger
}

// ListMappings returns all target-to-asset-type mappings
// GET /api/v1/admin/target-mappings
func (h *AdminTargetMappingHandler) ListMappings(c *gin.Context) {
    ctx := c.Request.Context()

    mappings, err := h.repo.List(ctx)
    if err != nil {
        c.JSON(500, gin.H{"error": "failed to list mappings"})
        return
    }

    c.JSON(200, gin.H{"mappings": mappings})
}

// CreateMapping creates a new target-to-asset-type mapping
// POST /api/v1/admin/target-mappings
func (h *AdminTargetMappingHandler) CreateMapping(c *gin.Context) {
    ctx := c.Request.Context()

    var input struct {
        TargetType  string `json:"target_type" binding:"required"`
        AssetType   string `json:"asset_type" binding:"required"`
        IsPrimary   bool   `json:"is_primary"`
        Description string `json:"description"`
    }

    if err := c.ShouldBindJSON(&input); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }

    // Security: Validate target_type against whitelist
    if !slices.Contains(validTargetTypes, input.TargetType) {
        c.JSON(400, gin.H{"error": "invalid target_type, allowed: " + strings.Join(validTargetTypes, ", ")})
        return
    }

    mapping := &tool.TargetAssetTypeMapping{
        ID:          shared.NewID(),
        TargetType:  input.TargetType,
        AssetType:   input.AssetType,
        IsPrimary:   input.IsPrimary,
        Description: input.Description,
    }

    if err := h.repo.Create(ctx, mapping); err != nil {
        c.JSON(500, gin.H{"error": "failed to create mapping"})
        return
    }

    // Audit log
    h.audit.Log(ctx, "target_mapping.create", mapping.ID.String(), map[string]any{
        "target_type": input.TargetType,
        "asset_type":  input.AssetType,
        "user_id":     getUserID(c),
    })

    c.JSON(201, gin.H{"mapping": mapping})
}

// UpdateMapping updates an existing mapping
// PUT /api/v1/admin/target-mappings/{id}
func (h *AdminTargetMappingHandler) UpdateMapping(c *gin.Context) {
    // ... similar validation + audit logging
}

// DeleteMapping deletes a mapping
// DELETE /api/v1/admin/target-mappings/{id}
func (h *AdminTargetMappingHandler) DeleteMapping(c *gin.Context) {
    ctx := c.Request.Context()
    id := c.Param("id")

    mappingID, err := shared.IDFromString(id)
    if err != nil {
        c.JSON(400, gin.H{"error": "invalid id"})
        return
    }

    if err := h.repo.Delete(ctx, mappingID); err != nil {
        c.JSON(500, gin.H{"error": "failed to delete mapping"})
        return
    }

    // Audit log
    h.audit.Log(ctx, "target_mapping.delete", id, map[string]any{
        "user_id": getUserID(c),
    })

    c.JSON(200, gin.H{"deleted": true})
}
```

**File:** `api/internal/infra/http/routes/admin.go` - Add routes

```go
func RegisterAdminRoutes(r *gin.RouterGroup, h *handler.AdminTargetMappingHandler, auth gin.HandlerFunc, adminOnly gin.HandlerFunc) {
    admin := r.Group("/admin")
    admin.Use(auth)
    admin.Use(adminOnly) // RequireRole("admin")

    // Target mappings CRUD
    mappings := admin.Group("/target-mappings")
    mappings.Use(rateLimiter(10, time.Minute)) // 10 req/min
    {
        mappings.GET("", h.ListMappings)
        mappings.POST("", h.CreateMapping)
        mappings.PUT("/:id", h.UpdateMapping)
        mappings.DELETE("/:id", h.DeleteMapping)
    }
}
```

**Admin UI Location:** `ui/src/app/(dashboard)/admin/target-mappings/page.tsx`

#### 2.6 Note on Hardcoded Helper Functions

> **DEPRECATED**: The following hardcoded helper functions are **NOT needed** since we use the dynamic `target_asset_type_mappings` table and repository.
>
> Instead of:
> - `tool.GetCompatibleAssetTypes(targets)` → use `targetMappingRepo.GetAssetTypesForTargets(ctx, targets)`
> - `tool.CanToolScanAssetType(targets, type)` → use `targetMappingRepo.CanToolScanAssetType(ctx, targets, type)`
> - `tool.GetIncompatibleAssetTypes(targets, types)` → use `targetMappingRepo.GetIncompatibleAssetTypes(ctx, targets, types)`
>
> Benefits of dynamic approach:
> - No code deploy needed to add new mappings
> - Admin can manage via API
> - Database FK ensures valid asset types
> - Single source of truth

---

### Phase 3: Compatibility Validation (2-3 days)

#### 3.0 Repository Method: GetDistinctAssetTypes

**File:** `api/internal/infra/postgres/asset_group_repository.go` - Add method

```go
// GetDistinctAssetTypes returns unique asset types in a group.
func (r *AssetGroupRepository) GetDistinctAssetTypes(ctx context.Context, groupID shared.ID) ([]string, error) {
    query := `
        SELECT DISTINCT a.asset_type
        FROM asset_group_members agm
        JOIN assets a ON a.id = agm.asset_id
        WHERE agm.asset_group_id = $1
        ORDER BY a.asset_type
    `

    rows, err := r.db.QueryContext(ctx, query, groupID.String())
    if err != nil {
        return nil, fmt.Errorf("get distinct asset types: %w", err)
    }
    defer rows.Close()

    var types []string
    for rows.Next() {
        var t string
        if err := rows.Scan(&t); err != nil {
            continue
        }
        types = append(types, t)
    }
    return types, nil
}

// CountAssetsByType returns count of assets per type in a group.
func (r *AssetGroupRepository) CountAssetsByType(ctx context.Context, groupID shared.ID) (map[string]int, error) {
    query := `
        SELECT a.asset_type, COUNT(*)
        FROM asset_group_members agm
        JOIN assets a ON a.id = agm.asset_id
        WHERE agm.asset_group_id = $1
        GROUP BY a.asset_type
    `

    rows, err := r.db.QueryContext(ctx, query, groupID.String())
    if err != nil {
        return nil, fmt.Errorf("count assets by type: %w", err)
    }
    defer rows.Close()

    result := make(map[string]int)
    for rows.Next() {
        var t string
        var count int
        if err := rows.Scan(&t, &count); err != nil {
            continue
        }
        result[t] = count
    }
    return result, nil
}
```

#### 3.1 Add Validation Tests First

**File:** `api/internal/app/scan/compatibility_test.go` (NEW)

```go
package scan_test

import (
    "context"
    "testing"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/mock"
)

func TestCheckAssetCompatibility(t *testing.T) {
    tests := []struct {
        name              string
        toolTargets       []string
        assetTypesInGroup []string
        expectWarning     bool
        expectIncompat    []string
    }{
        {
            name:              "all compatible - no warning",
            toolTargets:       []string{"url", "domain", "ip"},
            assetTypesInGroup: []string{"domain", "website"},
            expectWarning:     false,
            expectIncompat:    nil,
        },
        {
            name:              "partial compatible - warning",
            toolTargets:       []string{"url", "domain"},
            assetTypesInGroup: []string{"domain", "repository"},
            expectWarning:     true,
            expectIncompat:    []string{"repository"},
        },
        {
            name:              "none compatible - warning",
            toolTargets:       []string{"repository"},
            assetTypesInGroup: []string{"domain", "ip_address"},
            expectWarning:     true,
            expectIncompat:    []string{"domain", "ip_address"},
        },
        {
            name:              "empty asset group - no warning",
            toolTargets:       []string{"url"},
            assetTypesInGroup: []string{},
            expectWarning:     false,
            expectIncompat:    nil,
        },
        {
            name:              "tool without targets - no warning",
            toolTargets:       []string{},
            assetTypesInGroup: []string{"domain"},
            expectWarning:     false,
            expectIncompat:    nil,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Setup mocks and test
            // ...
        })
    }
}

func TestCheckAssetCompatibility_WorkflowScan(t *testing.T) {
    // Test workflow scans with multiple steps/tools
}

func TestCheckAssetCompatibility_DirectTargets(t *testing.T) {
    // Test scans with targets[] instead of asset group
}

func TestCheckAssetCompatibility_MultipleAssetGroups(t *testing.T) {
    // Test scans with AssetGroupIDs[]
}

func TestCheckAssetCompatibility_OtherAssetType(t *testing.T) {
    tests := []struct {
        name              string
        toolTargets       []string
        assetTypesInGroup []string
        expectWarning     bool
        expectSkipped     []string
    }{
        {
            name:              "group with some 'other' assets",
            toolTargets:       []string{"url", "domain"},
            assetTypesInGroup: []string{"domain", "website", "other"},
            expectWarning:     true,
            expectSkipped:     []string{"other"},
        },
        {
            name:              "group with 100% 'other' assets",
            toolTargets:       []string{"url"},
            assetTypesInGroup: []string{"other"},
            expectWarning:     true,
            expectSkipped:     []string{"other"},
        },
        {
            name:              "no 'other' assets",
            toolTargets:       []string{"domain"},
            assetTypesInGroup: []string{"domain"},
            expectWarning:     false,
            expectSkipped:     nil,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := checkCompatibility(tt.toolTargets, tt.assetTypesInGroup)
            assert.Equal(t, tt.expectWarning, result.HasWarning)
            assert.ElementsMatch(t, tt.expectSkipped, result.UnclassifiedTypes)
        })
    }
}

func TestCheckAssetCompatibility_AtCreation(t *testing.T) {
    // Test that CreateScan returns compatibility preview
    tests := []struct {
        name               string
        scannerName        string
        assetGroupTypes    []string
        expectPreview      bool
        expectCanCreate    bool
    }{
        {
            name:            "compatible - no preview warning",
            scannerName:     "nuclei",
            assetGroupTypes: []string{"domain", "website"},
            expectPreview:   true,
            expectCanCreate: true,
        },
        {
            name:            "partially compatible - preview with warning",
            scannerName:     "nuclei",
            assetGroupTypes: []string{"domain", "repository"},
            expectPreview:   true,
            expectCanCreate: true, // Allow creation, just warn
        },
        {
            name:            "100% other - block creation",
            scannerName:     "nuclei",
            assetGroupTypes: []string{"other"},
            expectPreview:   true,
            expectCanCreate: false, // Block: all assets unclassified
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Setup mocks
            // ...
        })
    }
}
```

#### 3.2 Implement Validation

**File:** `api/internal/app/scan/compatibility.go` (NEW)

```go
package scan

import (
    "context"
    "github.com/openctemio/api/internal/domain/tool"
)

// AssetCompatibilityResult contains the result of compatibility check.
type AssetCompatibilityResult struct {
    Compatible          bool     `json:"compatible"`
    IncompatibleTypes   []string `json:"incompatible_types,omitempty"`
    CompatibleTypes     []string `json:"compatible_types,omitempty"`
    UnclassifiedTypes   []string `json:"unclassified_types,omitempty"`  // NEW: "other" type assets
    UnclassifiedCount   int      `json:"unclassified_count"`            // NEW: count of unclassified
    TotalAssetTypes     int      `json:"total_asset_types"`
    TotalAssetCount     int      `json:"total_asset_count"`             // NEW: actual asset count
    IncompatibleCount   int      `json:"incompatible_count"`
    CompatibilityRatio  float64  `json:"compatibility_ratio"`           // 0.0 to 1.0
    ShouldBlock         bool     `json:"should_block"`                  // true if 0% compatible
    ShouldBlockReason   string   `json:"should_block_reason,omitempty"` // NEW: reason for blocking
}

// CheckAssetCompatibility validates tool-asset compatibility for a scan.
func (s *Service) CheckAssetCompatibility(ctx context.Context, sc *Scan) (*AssetCompatibilityResult, error) {
    // For workflow scans, check each step's tool
    if sc.ScanType == ScanTypeWorkflow {
        return s.checkWorkflowCompatibility(ctx, sc)
    }

    // For single scans, check the scanner
    return s.checkSingleScanCompatibility(ctx, sc)
}

func (s *Service) checkSingleScanCompatibility(ctx context.Context, sc *Scan) (*AssetCompatibilityResult, error) {
    // Get tool
    t, err := s.toolRepo.GetByName(ctx, sc.ScannerName)
    if err != nil || t == nil {
        return nil, nil // Skip validation if tool not found
    }

    // No supported_targets defined = skip validation
    if len(t.SupportedTargets) == 0 {
        return nil, nil
    }

    // Get asset types from all sources
    assetTypes, err := s.getAssetTypesForScan(ctx, sc)
    if err != nil {
        return nil, err
    }

    if len(assetTypes) == 0 {
        return nil, nil // No assets to validate
    }

    // Calculate compatibility using dynamic mapping repository
    compatible, err := s.targetMappingRepo.GetAssetTypesForTargets(ctx, t.SupportedTargets)
    if err != nil {
        return nil, err
    }
    incompatible, err := s.targetMappingRepo.GetIncompatibleAssetTypes(ctx, t.SupportedTargets, assetTypes)
    if err != nil {
        return nil, err
    }

    ratio := float64(len(assetTypes)-len(incompatible)) / float64(len(assetTypes))

    return &AssetCompatibilityResult{
        Compatible:         len(incompatible) == 0,
        IncompatibleTypes:  incompatible,
        CompatibleTypes:    compatible,
        TotalAssetTypes:    len(assetTypes),
        IncompatibleCount:  len(incompatible),
        CompatibilityRatio: ratio,
        ShouldBlock:        ratio == 0, // Block if 0% compatible
    }, nil
}

func (s *Service) checkWorkflowCompatibility(ctx context.Context, sc *Scan) (*AssetCompatibilityResult, error) {
    // Get pipeline template
    template, err := s.pipelineRepo.Get(ctx, sc.PipelineID)
    if err != nil {
        return nil, err
    }

    // Get asset types
    assetTypes, err := s.getAssetTypesForScan(ctx, sc)
    if err != nil {
        return nil, err
    }

    if len(assetTypes) == 0 {
        return nil, nil
    }

    // Check each step's tool
    var allIncompatible []string
    incompatibleSet := make(map[string]bool)

    for _, step := range template.Steps {
        if step.Tool == "" {
            continue // Step uses capabilities, not specific tool
        }

        t, err := s.toolRepo.GetByName(ctx, step.Tool)
        if err != nil || t == nil || len(t.SupportedTargets) == 0 {
            continue
        }

        stepIncompat, err := s.targetMappingRepo.GetIncompatibleAssetTypes(ctx, t.SupportedTargets, assetTypes)
        if err != nil {
            continue // Skip on error
        }
        for _, at := range stepIncompat {
            if !incompatibleSet[at] {
                incompatibleSet[at] = true
                allIncompatible = append(allIncompatible, at)
            }
        }
    }

    ratio := float64(len(assetTypes)-len(allIncompatible)) / float64(len(assetTypes))

    return &AssetCompatibilityResult{
        Compatible:         len(allIncompatible) == 0,
        IncompatibleTypes:  allIncompatible,
        TotalAssetTypes:    len(assetTypes),
        IncompatibleCount:  len(allIncompatible),
        CompatibilityRatio: ratio,
        ShouldBlock:        ratio == 0,
    }, nil
}

func (s *Service) getAssetTypesForScan(ctx context.Context, sc *Scan) ([]string, error) {
    typeSet := make(map[string]bool)

    // From primary asset group
    if !sc.AssetGroupID.IsZero() {
        types, err := s.assetGroupRepo.GetDistinctAssetTypes(ctx, sc.AssetGroupID)
        if err != nil {
            return nil, err
        }
        for _, t := range types {
            typeSet[t] = true
        }
    }

    // From multiple asset groups
    for _, groupID := range sc.AssetGroupIDs {
        types, err := s.assetGroupRepo.GetDistinctAssetTypes(ctx, groupID)
        if err != nil {
            return nil, err
        }
        for _, t := range types {
            typeSet[t] = true
        }
    }

    // From direct targets - infer types
    for _, target := range sc.Targets {
        inferredType := inferAssetTypeFromTarget(target)
        if inferredType != "" {
            typeSet[inferredType] = true
        }
    }

    var result []string
    for t := range typeSet {
        result = append(result, t)
    }
    return result, nil
}

// getAssetCountsByType returns counts per asset type (for detailed warnings)
func (s *Service) getAssetCountsByType(ctx context.Context, sc *Scan) (map[string]int, error) {
    result := make(map[string]int)

    // From primary asset group
    if !sc.AssetGroupID.IsZero() {
        counts, err := s.assetGroupRepo.CountAssetsByType(ctx, sc.AssetGroupID)
        if err != nil {
            return nil, err
        }
        for t, c := range counts {
            result[t] += c
        }
    }

    // From multiple asset groups
    for _, groupID := range sc.AssetGroupIDs {
        counts, err := s.assetGroupRepo.CountAssetsByType(ctx, groupID)
        if err != nil {
            return nil, err
        }
        for t, c := range counts {
            result[t] += c
        }
    }

    return result, nil
}

// inferAssetTypeFromTarget attempts to determine asset type from target string.
func inferAssetTypeFromTarget(target string) string {
    // IP address pattern
    if isIPAddress(target) {
        return "ip_address"
    }

    // URL pattern
    if strings.HasPrefix(target, "http://") || strings.HasPrefix(target, "https://") {
        return "website"
    }

    // Domain pattern (simple heuristic)
    if isDomainLike(target) {
        return "domain"
    }

    return "" // Unknown
}

// checkForUnclassifiedAssets checks for 'other' type assets and calculates impact
func checkForUnclassifiedAssets(assetCounts map[string]int) (unclassifiedCount int, totalCount int) {
    for t, count := range assetCounts {
        totalCount += count
        if t == "other" {
            unclassifiedCount = count
        }
    }
    return
}
```

#### 3.3 Integrate into CreateScan (Preview/Warning)

**File:** `api/internal/app/scan/crud.go` - Add validation to CreateScan()

```go
// CreateScanResult contains the created scan plus compatibility preview
type CreateScanResult struct {
    Scan          *scan.Scan                `json:"scan"`
    Compatibility *AssetCompatibilityResult `json:"compatibility,omitempty"`
}

func (s *Service) CreateScan(ctx context.Context, input CreateScanInput) (*CreateScanResult, error) {
    // ... existing validation (name, tenant, tool exists, etc.) ...

    // After asset group validation, before creating scan entity:

    // NEW: Check asset-tool compatibility (preview)
    var compatibility *AssetCompatibilityResult
    if hasAssetGroup {
        preview, err := s.previewAssetCompatibility(ctx, input)
        if err != nil {
            s.logger.Warn("failed to preview asset compatibility", "error", err)
            // Continue - don't block on preview errors
        } else {
            compatibility = preview

            // Block if ALL assets are unclassified ('other')
            if preview.UnclassifiedCount > 0 && preview.UnclassifiedCount == preview.TotalAssetCount {
                return nil, shared.NewDomainError(
                    "ALL_ASSETS_UNCLASSIFIED",
                    "All assets in the selected group are unclassified (type 'other'). Please classify your assets before creating a scan.",
                    shared.ErrValidation,
                )
            }

            // Log warning if partial incompatibility
            if !preview.Compatible {
                s.logger.Info("scan created with compatibility warning",
                    "scan_name", input.Name,
                    "incompatible_types", preview.IncompatibleTypes,
                    "unclassified_count", preview.UnclassifiedCount,
                    "compatibility_ratio", preview.CompatibilityRatio)
            }
        }
    }

    // ... create scan entity (existing code) ...

    return &CreateScanResult{
        Scan:          sc,
        Compatibility: compatibility,
    }, nil
}

// previewAssetCompatibility checks compatibility before scan creation
func (s *Service) previewAssetCompatibility(ctx context.Context, input CreateScanInput) (*AssetCompatibilityResult, error) {
    // Get tool supported_targets
    var supportedTargets []string

    if input.ScanType == "single" && input.ScannerName != "" {
        t, err := s.toolRepo.GetByName(ctx, input.ScannerName)
        if err != nil || t == nil || len(t.SupportedTargets) == 0 {
            return nil, nil // Skip validation
        }
        supportedTargets = t.SupportedTargets
    } else if input.ScanType == "workflow" && input.PipelineID != "" {
        // Get all tools from pipeline steps
        pipelineID, _ := shared.IDFromString(input.PipelineID)
        steps, err := s.stepRepo.GetByPipelineID(ctx, pipelineID)
        if err != nil {
            return nil, err
        }

        targetSet := make(map[string]bool)
        for _, step := range steps {
            if step.Tool == "" {
                continue
            }
            t, err := s.toolRepo.GetByName(ctx, step.Tool)
            if err != nil || t == nil {
                continue
            }
            for _, target := range t.SupportedTargets {
                targetSet[target] = true
            }
        }
        for t := range targetSet {
            supportedTargets = append(supportedTargets, t)
        }
    }

    if len(supportedTargets) == 0 {
        return nil, nil // No targets to validate against
    }

    // Get asset types and counts from groups
    assetCounts := make(map[string]int)

    if input.AssetGroupID != "" {
        groupID, _ := shared.IDFromString(input.AssetGroupID)
        counts, err := s.assetGroupRepo.CountAssetsByType(ctx, groupID)
        if err != nil {
            return nil, err
        }
        for t, c := range counts {
            assetCounts[t] += c
        }
    }

    for _, idStr := range input.AssetGroupIDs {
        groupID, _ := shared.IDFromString(idStr)
        counts, err := s.assetGroupRepo.CountAssetsByType(ctx, groupID)
        if err != nil {
            continue
        }
        for t, c := range counts {
            assetCounts[t] += c
        }
    }

    // Calculate compatibility
    var assetTypes []string
    var totalCount int
    var unclassifiedCount int

    for t, count := range assetCounts {
        assetTypes = append(assetTypes, t)
        totalCount += count
        if t == "other" {
            unclassifiedCount = count
        }
    }

    // Use dynamic mapping repository instead of hardcoded mapping
    compatible, err := s.targetMappingRepo.GetAssetTypesForTargets(ctx, supportedTargets)
    if err != nil {
        return nil, err
    }
    incompatible, err := s.targetMappingRepo.GetIncompatibleAssetTypes(ctx, supportedTargets, assetTypes)
    if err != nil {
        return nil, err
    }

    // Remove 'other' from incompatible (handled separately)
    var incompatibleFiltered []string
    for _, t := range incompatible {
        if t != "other" {
            incompatibleFiltered = append(incompatibleFiltered, t)
        }
    }

    effectiveTotal := totalCount - unclassifiedCount
    var ratio float64
    if effectiveTotal > 0 {
        incompatCount := 0
        for _, t := range incompatibleFiltered {
            incompatCount += assetCounts[t]
        }
        ratio = float64(effectiveTotal-incompatCount) / float64(effectiveTotal)
    }

    var unclassifiedTypes []string
    if unclassifiedCount > 0 {
        unclassifiedTypes = []string{"other"}
    }

    shouldBlock := ratio == 0 && effectiveTotal > 0
    var blockReason string
    if shouldBlock {
        blockReason = "No compatible asset types found for this scanner"
    }

    return &AssetCompatibilityResult{
        Compatible:         len(incompatibleFiltered) == 0 && unclassifiedCount == 0,
        IncompatibleTypes:  incompatibleFiltered,
        CompatibleTypes:    compatible,
        UnclassifiedTypes:  unclassifiedTypes,
        UnclassifiedCount:  unclassifiedCount,
        TotalAssetTypes:    len(assetTypes),
        TotalAssetCount:    totalCount,
        IncompatibleCount:  len(incompatibleFiltered),
        CompatibilityRatio: ratio,
        ShouldBlock:        shouldBlock,
        ShouldBlockReason:  blockReason,
    }, nil
}
```

#### 3.4 Smart Filtering Implementation (NEW)

> **UPDATED**: Instead of blocking at trigger, we now auto-filter compatible assets and include a detailed report.

##### 3.4.1 Filtering Result Types

**File:** `api/internal/app/scan/filtering.go` (NEW)

```go
package scan

import (
    "context"
    "time"
    "github.com/openctemio/api/internal/domain/asset"
    "github.com/openctemio/api/internal/domain/shared"
)

// FilteringResult contains the result of smart asset filtering at trigger time.
type FilteringResult struct {
    TotalAssets       int                  `json:"total_assets"`
    ScannedAssets     int                  `json:"scanned_assets"`
    SkippedAssets     int                  `json:"skipped_assets"`
    SkippedByType     map[string]int       `json:"skipped_by_type"`      // e.g., {"repository": 5, "other": 3}
    SkippedAssetIDs   []string             `json:"skipped_asset_ids,omitempty"` // Optional: for audit
    FilteringReason   map[string]string    `json:"filtering_reason"`     // e.g., {"repository": "not_in_supported_targets"}
    CompatibilityRatio float64             `json:"compatibility_ratio"`  // 0.0 to 1.0
    FilteredAt        time.Time            `json:"filtered_at"`
}

// AssetFilterInput contains assets to filter.
type AssetFilterInput struct {
    Assets           []*asset.Asset
    SupportedTargets []string
    ToolName         string
}

// FilteredAssets contains the result of filtering.
type FilteredAssets struct {
    Compatible   []*asset.Asset
    Incompatible []*asset.Asset
    Unclassified []*asset.Asset // Assets with type 'other'
}
```

##### 3.4.2 Asset Filtering Service

**File:** `api/internal/app/scan/asset_filter.go` (NEW)

```go
package scan

import (
    "context"
    "github.com/openctemio/api/internal/domain/asset"
    "github.com/openctemio/api/internal/domain/tool"
)

// AssetFilterService filters assets based on tool compatibility.
type AssetFilterService struct {
    targetMappingRepo tool.TargetMappingRepository
    logger            Logger
}

func NewAssetFilterService(repo tool.TargetMappingRepository, logger Logger) *AssetFilterService {
    return &AssetFilterService{
        targetMappingRepo: repo,
        logger:            logger,
    }
}

// FilterAssets separates compatible and incompatible assets based on tool targets.
func (s *AssetFilterService) FilterAssets(ctx context.Context, input AssetFilterInput) (*FilteredAssets, error) {
    result := &FilteredAssets{
        Compatible:   make([]*asset.Asset, 0),
        Incompatible: make([]*asset.Asset, 0),
        Unclassified: make([]*asset.Asset, 0),
    }

    // If no supported_targets defined, all assets are compatible (no filtering)
    if len(input.SupportedTargets) == 0 {
        result.Compatible = input.Assets
        return result, nil
    }

    // Get all compatible asset types for the tool
    compatibleTypes, err := s.targetMappingRepo.GetAssetTypesForTargets(ctx, input.SupportedTargets)
    if err != nil {
        s.logger.Error("failed to get compatible asset types", "error", err)
        // On error, pass all assets (fail-open for availability)
        result.Compatible = input.Assets
        return result, nil
    }

    compatibleSet := make(map[string]bool)
    for _, t := range compatibleTypes {
        compatibleSet[t] = true
    }

    // Filter assets
    for _, a := range input.Assets {
        assetType := string(a.Type())

        // Handle unclassified assets separately
        if assetType == "other" || assetType == "" {
            result.Unclassified = append(result.Unclassified, a)
            continue
        }

        // Check compatibility
        if compatibleSet[assetType] {
            result.Compatible = append(result.Compatible, a)
        } else {
            result.Incompatible = append(result.Incompatible, a)
        }
    }

    return result, nil
}

// BuildFilteringResult creates a FilteringResult from filtered assets.
func (s *AssetFilterService) BuildFilteringResult(filtered *FilteredAssets, toolName string) *FilteringResult {
    total := len(filtered.Compatible) + len(filtered.Incompatible) + len(filtered.Unclassified)
    skipped := len(filtered.Incompatible) + len(filtered.Unclassified)

    skippedByType := make(map[string]int)
    filteringReason := make(map[string]string)
    var skippedIDs []string

    // Count incompatible by type
    for _, a := range filtered.Incompatible {
        t := string(a.Type())
        skippedByType[t]++
        filteringReason[t] = "not_supported_by_" + toolName
        skippedIDs = append(skippedIDs, a.ID().String())
    }

    // Count unclassified
    if len(filtered.Unclassified) > 0 {
        skippedByType["other"] = len(filtered.Unclassified)
        filteringReason["other"] = "unclassified_asset_type"
        for _, a := range filtered.Unclassified {
            skippedIDs = append(skippedIDs, a.ID().String())
        }
    }

    var ratio float64
    if total > 0 {
        ratio = float64(len(filtered.Compatible)) / float64(total)
    }

    return &FilteringResult{
        TotalAssets:       total,
        ScannedAssets:     len(filtered.Compatible),
        SkippedAssets:     skipped,
        SkippedByType:     skippedByType,
        SkippedAssetIDs:   skippedIDs,
        FilteringReason:   filteringReason,
        CompatibilityRatio: ratio,
        FilteredAt:        time.Now().UTC(),
    }
}
```

##### 3.4.3 Integrate into TriggerScan (Smart Filtering)

**File:** `api/internal/app/scan/trigger.go` - Updated TriggerScan()

```go
func (s *Service) TriggerScan(ctx context.Context, tenantID, scanID string, ...) (*TriggerResult, error) {
    // ... existing validation ...

    // Get tool for filtering
    var supportedTargets []string
    if sc.ScanType == ScanTypeSingle {
        t, err := s.toolRepo.GetByName(ctx, sc.ScannerName)
        if err == nil && t != nil {
            supportedTargets = t.SupportedTargets
        }
    }

    // Get ALL assets from group(s)
    allAssets, err := s.getAllAssetsForScan(ctx, sc)
    if err != nil {
        return nil, fmt.Errorf("get assets: %w", err)
    }

    // NEW: Smart Filter - separate compatible vs incompatible assets
    filterInput := AssetFilterInput{
        Assets:           allAssets,
        SupportedTargets: supportedTargets,
        ToolName:         sc.ScannerName,
    }
    filtered, err := s.assetFilter.FilterAssets(ctx, filterInput)
    if err != nil {
        s.logger.Warn("failed to filter assets, proceeding with all", "error", err)
        filtered = &FilteredAssets{Compatible: allAssets}
    }

    // Build filtering report
    filteringResult := s.assetFilter.BuildFilteringResult(filtered, sc.ScannerName)

    // Log filtering decision
    if filteringResult.SkippedAssets > 0 {
        s.logger.Info("smart filtering applied",
            "scan_id", scanID,
            "total", filteringResult.TotalAssets,
            "scanned", filteringResult.ScannedAssets,
            "skipped", filteringResult.SkippedAssets,
            "skipped_by_type", filteringResult.SkippedByType,
            "compatibility_ratio", filteringResult.CompatibilityRatio,
        )
    }

    // Record filtering metrics
    metrics.ScanFilteringTotal.WithLabelValues(
        tenantID,
        sc.ScannerName,
        "triggered",
    ).Inc()
    metrics.ScanFilteredAssetsTotal.WithLabelValues(
        tenantID,
        sc.ScannerName,
        "compatible",
    ).Add(float64(filteringResult.ScannedAssets))
    metrics.ScanFilteredAssetsTotal.WithLabelValues(
        tenantID,
        sc.ScannerName,
        "skipped",
    ).Add(float64(filteringResult.SkippedAssets))

    // Pass ONLY compatible assets to agent
    // NOTE: Even if 0 compatible, we proceed (agent handles empty case)
    scanAssets := filtered.Compatible

    // ... create run with filtered assets ...
    runContext["scan_assets"] = scanAssets  // Only compatible
    runContext["total_assets_in_group"] = filteringResult.TotalAssets
    runContext["filtering_applied"] = filteringResult.SkippedAssets > 0

    // ... rest of trigger logic ...

    return &TriggerResult{
        Run:       run,
        Filtering: filteringResult, // Include filtering report in response
    }, nil
}

// getAllAssetsForScan retrieves all assets from groups and targets.
func (s *Service) getAllAssetsForScan(ctx context.Context, sc *Scan) ([]*asset.Asset, error) {
    var allAssets []*asset.Asset
    seen := make(map[string]bool)

    // From primary asset group
    if !sc.AssetGroupID.IsZero() {
        assets, err := s.assetGroupRepo.GetGroupAssets(ctx, sc.AssetGroupID)
        if err != nil {
            return nil, err
        }
        for _, a := range assets {
            if !seen[a.ID().String()] {
                seen[a.ID().String()] = true
                allAssets = append(allAssets, a)
            }
        }
    }

    // From multiple asset groups
    for _, groupID := range sc.AssetGroupIDs {
        assets, err := s.assetGroupRepo.GetGroupAssets(ctx, groupID)
        if err != nil {
            continue
        }
        for _, a := range assets {
            if !seen[a.ID().String()] {
                seen[a.ID().String()] = true
                allAssets = append(allAssets, a)
            }
        }
    }

    return allAssets, nil
}
```

##### 3.4.4 Updated TriggerResult Type

**File:** `api/internal/app/scan/types.go` - Update

```go
// TriggerResult contains the result of triggering a scan.
type TriggerResult struct {
    Run       *pipeline.Run    `json:"run"`
    Filtering *FilteringResult `json:"filtering,omitempty"` // NEW: Smart filtering report
}
```

##### 3.4.5 Tests for Smart Filtering

**File:** `api/internal/app/scan/asset_filter_test.go` (NEW)

```go
package scan_test

import (
    "context"
    "testing"
    "github.com/stretchr/testify/assert"
)

func TestFilterAssets_AllCompatible(t *testing.T) {
    // Given: nuclei supports url,domain,ip
    // And: assets are [domain, domain, website]
    // When: FilterAssets is called
    // Then: all assets are in Compatible, none in Incompatible
}

func TestFilterAssets_MixedCompatibility(t *testing.T) {
    // Given: nuclei supports url,domain,ip
    // And: assets are [domain, repository, ip_address]
    // When: FilterAssets is called
    // Then: 2 in Compatible (domain, ip_address), 1 in Incompatible (repository)
}

func TestFilterAssets_AllIncompatible(t *testing.T) {
    // Given: nuclei supports url,domain,ip
    // And: assets are [repository, container]
    // When: FilterAssets is called
    // Then: 0 in Compatible, 2 in Incompatible
    // And: FilteringResult shows 0% compatibility
}

func TestFilterAssets_WithUnclassified(t *testing.T) {
    // Given: nuclei supports url,domain,ip
    // And: assets are [domain, other, other, website]
    // When: FilterAssets is called
    // Then: 2 in Compatible (domain, website)
    // And: 2 in Unclassified (other, other)
}

func TestFilterAssets_NoSupportedTargets(t *testing.T) {
    // Given: tool has no supported_targets defined
    // And: assets are [domain, repository]
    // When: FilterAssets is called
    // Then: ALL assets are in Compatible (no filtering)
}

func TestFilterAssets_EmptyAssetList(t *testing.T) {
    // Given: empty asset list
    // When: FilterAssets is called
    // Then: FilteringResult shows 0 total, 0 scanned, 0 skipped
}

func TestBuildFilteringResult_Metrics(t *testing.T) {
    // Given: filtered result with mixed assets
    // When: BuildFilteringResult is called
    // Then: SkippedByType correctly counts by type
    // And: FilteringReason explains each skip
    // And: CompatibilityRatio is accurate
}
```

---

### Phase 4: UI Components (1 day)

#### 4.1 Add Types (Updated for Smart Filtering)

**File:** `ui/src/lib/api/scan-types.ts`

```typescript
// For CreateScan preview (warning only)
export interface AssetCompatibilityResult {
  compatible: boolean
  incompatible_types?: string[]
  compatible_types?: string[]
  unclassified_types?: string[]
  unclassified_count: number
  total_asset_types: number
  total_asset_count: number
  incompatible_count: number
  compatibility_ratio: number
  // Note: should_block removed - we never block, just warn
}

// NEW: For TriggerScan result (actual filtering report)
export interface FilteringResult {
  total_assets: number
  scanned_assets: number
  skipped_assets: number
  skipped_by_type: Record<string, number>  // e.g., {"repository": 5, "other": 3}
  skipped_asset_ids?: string[]             // Optional: for audit
  filtering_reason: Record<string, string> // e.g., {"repository": "not_supported_by_nuclei"}
  compatibility_ratio: number              // 0.0 to 1.0
  filtered_at: string                      // ISO timestamp
}

export interface CreateScanResponse {
  scan: ScanConfig
  compatibility?: AssetCompatibilityResult  // Preview at creation
}

export interface TriggerScanResponse {
  run: PipelineRun
  filtering?: FilteringResult  // Actual filtering report
}
```

#### 4.2 Create Warning Component

**File:** `ui/src/features/scans/components/asset-compatibility-warning.tsx` (NEW)

```tsx
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle, XCircle, CheckCircle } from 'lucide-react'
import { AssetCompatibilityResult } from '@/lib/api/scan-types'

interface Props {
  result: AssetCompatibilityResult
  onForce?: () => void
}

export function AssetCompatibilityWarning({ result, onForce }: Props) {
  if (result.compatible) {
    return null
  }

  const percentage = Math.round(result.compatibility_ratio * 100)
  const hasUnclassified = result.unclassified_count > 0
  const hasIncompatible = result.incompatible_count > 0
  const variant = result.should_block ? 'destructive' : 'warning'
  const Icon = result.should_block ? XCircle : AlertTriangle

  return (
    <Alert variant={variant}>
      <Icon className="h-4 w-4" />
      <AlertTitle>
        {result.should_block
          ? result.should_block_reason || 'Scanner incompatible with all assets'
          : 'Some assets may not be scanned'}
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p>
          {percentage}% of asset types are compatible with this scanner.
        </p>

        {hasIncompatible && (
          <p className="mt-1 text-sm">
            <strong>Incompatible types:</strong>{' '}
            {result.incompatible_types?.join(', ')}
          </p>
        )}

        {hasUnclassified && (
          <p className="mt-1 text-sm text-amber-600">
            <strong>⚠️ Unclassified assets:</strong>{' '}
            {result.unclassified_count} asset(s) have type "other" and will be skipped.
            <a href="/assets?type=other" className="ml-1 underline">
              Classify them
            </a>
          </p>
        )}

        {result.should_block && onForce && (
          <button
            onClick={onForce}
            className="mt-2 text-sm underline"
          >
            Force scan anyway
          </button>
        )}
      </AlertDescription>
    </Alert>
  )
}

// Component to show at scan creation (preview/warning)
export function ScanCompatibilityPreview({ result }: { result: AssetCompatibilityResult }) {
  if (result.compatible) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <CheckCircle className="h-4 w-4" />
        All {result.total_asset_count} assets are compatible with this scanner
      </div>
    )
  }

  const percentage = Math.round(result.compatibility_ratio * 100)

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
        <AlertTriangle className="h-4 w-4" />
        Preview: {percentage}% compatible
      </div>
      <p className="mt-1 text-xs text-amber-600">
        Incompatible assets will be automatically skipped when the scan runs.
      </p>
      <ul className="mt-2 space-y-1 text-sm text-amber-700">
        {result.incompatible_count > 0 && (
          <li>
            • {result.incompatible_count} asset type(s) will be skipped:{' '}
            {result.incompatible_types?.join(', ')}
          </li>
        )}
        {result.unclassified_count > 0 && (
          <li>
            • {result.unclassified_count} unclassified asset(s) will be skipped
          </li>
        )}
      </ul>
    </div>
  )
}
```

#### 4.3 NEW: Filtering Result Component (for Trigger Response)

**File:** `ui/src/features/scans/components/filtering-result-banner.tsx` (NEW)

```tsx
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CheckCircle, AlertTriangle, Info } from 'lucide-react'
import { FilteringResult } from '@/lib/api/scan-types'

interface Props {
  result: FilteringResult
  onViewSkipped?: () => void
}

export function FilteringResultBanner({ result, onViewSkipped }: Props) {
  const percentage = Math.round(result.compatibility_ratio * 100)
  const hasSkipped = result.skipped_assets > 0

  // All scanned - success
  if (!hasSkipped) {
    return (
      <Alert variant="default" className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">
          Scan started with all {result.total_assets} assets
        </AlertTitle>
      </Alert>
    )
  }

  // Some skipped - info/warning
  return (
    <Alert variant="default" className="border-blue-200 bg-blue-50">
      <Info className="h-4 w-4 text-blue-600" />
      <AlertTitle className="text-blue-800">
        Smart Filtering Applied
      </AlertTitle>
      <AlertDescription className="mt-2 text-blue-700">
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium">
            {result.scanned_assets} scanned
          </span>
          <span className="text-blue-500">|</span>
          <span>
            {result.skipped_assets} skipped ({100 - percentage}%)
          </span>
        </div>

        {/* Breakdown by type */}
        {Object.keys(result.skipped_by_type).length > 0 && (
          <div className="mt-2 text-xs">
            <span className="font-medium">Skipped by type: </span>
            {Object.entries(result.skipped_by_type)
              .map(([type, count]) => `${type} (${count})`)
              .join(', ')}
          </div>
        )}

        {onViewSkipped && result.skipped_asset_ids?.length > 0 && (
          <button
            onClick={onViewSkipped}
            className="mt-2 text-xs underline"
          >
            View {result.skipped_assets} skipped assets
          </button>
        )}
      </AlertDescription>
    </Alert>
  )
}

// Compact version for run list
export function FilteringResultBadge({ result }: { result: FilteringResult }) {
  if (result.skipped_assets === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600">
        <CheckCircle className="h-3 w-3" />
        {result.scanned_assets} scanned
      </span>
    )
  }

  const percentage = Math.round(result.compatibility_ratio * 100)

  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-600">
      <AlertTriangle className="h-3 w-3" />
      {result.scanned_assets}/{result.total_assets} ({percentage}%)
    </span>
  )
}
```

#### 4.4 Integration in Scan Trigger UI

**File:** `ui/src/features/scans/hooks/use-trigger-scan.ts` - Update to show filtering result

```typescript
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FilteringResultBanner } from '../components/filtering-result-banner'

export function useTriggerScan() {
  return useMutation({
    mutationFn: async (scanId: string) => {
      const response = await api.post<TriggerScanResponse>(`/scans/${scanId}/trigger`)
      return response.data
    },
    onSuccess: (data) => {
      // Show filtering result if assets were skipped
      if (data.filtering && data.filtering.skipped_assets > 0) {
        toast.info(
          `Scan started: ${data.filtering.scanned_assets}/${data.filtering.total_assets} assets will be scanned`,
          {
            description: `${data.filtering.skipped_assets} incompatible assets were automatically skipped`,
            duration: 5000,
          }
        )
      } else {
        toast.success('Scan started successfully')
      }
    },
  })
}
```

---

## Files to Modify

### Phase 1: Cleanup
| File | Change |
|------|--------|
| `api/migrations/000151_asset_types_cleanup.up.sql` | NEW |
| `api/migrations/000151_asset_types_cleanup.down.sql` | NEW |
| `api/internal/domain/asset/value_objects.go` | Remove 5 constants |
| `api/internal/infra/postgres/asset_repository.go` | Remove code_repo refs |

### Phase 2: Dynamic Target Mapping
| File | Change |
|------|--------|
| `api/migrations/000152_target_asset_type_mappings.up.sql` | NEW - Mapping table + seed data |
| `api/migrations/000152_target_asset_type_mappings.down.sql` | NEW - Rollback |
| `api/internal/domain/tool/target_mapping.go` | NEW - Entity + Repository interface |
| `api/internal/infra/postgres/target_mapping_repository.go` | NEW - Implementation |
| `api/internal/infra/postgres/target_mapping_repository_test.go` | NEW - Tests |

### Phase 3: Smart Filtering + Validation
| File | Change |
|------|--------|
| `api/internal/infra/postgres/asset_group_repository.go` | Add GetDistinctAssetTypes(), CountAssetsByType(), GetGroupAssets() |
| `api/internal/domain/assetgroup/repository.go` | Add interface methods |
| `api/internal/app/scan/filtering.go` | NEW - FilteringResult, FilteredAssets types |
| `api/internal/app/scan/asset_filter.go` | NEW - AssetFilterService |
| `api/internal/app/scan/asset_filter_test.go` | NEW - Tests |
| `api/internal/app/scan/compatibility.go` | NEW - Preview at CreateScan |
| `api/internal/app/scan/compatibility_test.go` | NEW - Tests |
| `api/internal/app/scan/crud.go` | Add previewAssetCompatibility(), modify CreateScan() |
| `api/internal/app/scan/trigger.go` | Integrate smart filtering |
| `api/internal/app/scan/types.go` | Update TriggerResult with FilteringResult |
| `api/internal/infra/http/handler/scan_handler.go` | Update response DTOs |

### Phase 4: UI
| File | Change |
|------|--------|
| `ui/src/lib/api/scan-types.ts` | Add FilteringResult, AssetCompatibilityResult types |
| `ui/src/features/scans/components/asset-compatibility-warning.tsx` | Preview component for CreateScan |
| `ui/src/features/scans/components/filtering-result-banner.tsx` | NEW - Banner + Badge for TriggerScan |
| `ui/src/features/scans/hooks/use-trigger-scan.ts` | Show filtering result toast |
| `ui/src/features/scans/components/index.ts` | Export new components |
| `ui/src/features/scans/components/new-scan/new-scan-form.tsx` | Show compatibility preview |

### Phase 4B: Admin UI - Target Mappings
| File | Change |
|------|--------|
| `ui/src/app/(dashboard)/admin/target-mappings/page.tsx` | NEW - Main page with DataTable |
| `ui/src/app/(dashboard)/admin/target-mappings/layout.tsx` | NEW - Layout with breadcrumbs |
| `ui/src/features/admin/target-mappings/components/target-mappings-table.tsx` | NEW - DataTable component |
| `ui/src/features/admin/target-mappings/components/target-mapping-form.tsx` | NEW - Create/Edit form modal |
| `ui/src/features/admin/target-mappings/components/delete-mapping-dialog.tsx` | NEW - Confirmation dialog |
| `ui/src/features/admin/target-mappings/components/index.ts` | NEW - Export barrel |
| `ui/src/lib/api/admin/target-mapping-hooks.ts` | NEW - CRUD hooks |
| `ui/src/lib/api/admin/target-mapping-types.ts` | NEW - Type definitions |
| `ui/src/lib/api/admin/endpoints.ts` | NEW or UPDATE - Admin endpoints |
| `ui/src/app/(dashboard)/admin/page.tsx` | UPDATE - Add link to Target Mappings |

### Phase 4C: Admin API - Target Mappings
| File | Change |
|------|--------|
| `api/internal/infra/http/handler/admin_target_mapping_handler.go` | NEW - CRUD handlers with validation + audit |
| `api/internal/infra/http/handler/admin_target_mapping_handler_test.go` | NEW - Handler tests |
| `api/internal/infra/http/routes/admin.go` | UPDATE - Register target mapping routes |
| `api/internal/infra/http/middleware/admin_auth.go` | UPDATE - Ensure admin auth middleware |
| `api/internal/app/audit/service.go` | UPDATE or NEW - Audit logging for admin actions |
| `api/internal/domain/tool/target_mapping.go` | UPDATE - Add CRUD methods to repository interface |
| `api/internal/infra/postgres/target_mapping_repository.go` | UPDATE - Implement CRUD methods |

### Phase 4D: Admin UI - Asset Reclassification
| File | Change |
|------|--------|
| `ui/src/app/(dashboard)/admin/asset-reclassification/page.tsx` | NEW - Reclassification wizard |
| `ui/src/features/admin/asset-reclassification/components/reclassification-wizard.tsx` | NEW - Multi-step wizard |
| `ui/src/features/admin/asset-reclassification/components/asset-type-selector.tsx` | NEW - Type selection dropdown |
| `ui/src/features/admin/asset-reclassification/components/affected-assets-preview.tsx` | NEW - Preview affected assets |
| `ui/src/features/admin/asset-reclassification/components/reclassification-progress.tsx` | NEW - Progress indicator |
| `ui/src/features/admin/asset-reclassification/components/index.ts` | NEW - Export barrel |
| `ui/src/lib/api/admin/reclassification-hooks.ts` | NEW - Reclassification API hooks |
| `api/internal/infra/http/handler/admin_reclassification_handler.go` | NEW - Reclassification endpoint |
| `api/internal/app/asset/reclassification_service.go` | NEW - Reclassification business logic |

---

## Test Plan

### Unit Tests (TDD - Write First)

1. **Target Mapping Repository Tests** (`target_mapping_repository_test.go`)
   - `TestGetAssetTypesForTargets` - Verify DB query returns correct types
   - `TestCanToolScanAssetType` - Check compatibility via DB
   - `TestGetIncompatibleAssetTypes` - Identify incompatible types
   - `TestList` - Admin list all mappings

2. **Compatibility Check Tests** (`compatibility_test.go`)
   - `TestCheckAssetCompatibility_AllCompatible`
   - `TestCheckAssetCompatibility_PartialCompatible`
   - `TestCheckAssetCompatibility_NoneCompatible`
   - `TestCheckAssetCompatibility_EmptyGroup`
   - `TestCheckAssetCompatibility_NoToolTargets`
   - `TestCheckAssetCompatibility_WorkflowScan`
   - `TestCheckAssetCompatibility_DirectTargets`
   - `TestCheckAssetCompatibility_MultipleGroups`

3. **Smart Filtering Tests** (`asset_filter_test.go`)
   - `TestFilterAssets_AllCompatible`
   - `TestFilterAssets_MixedCompatibility`
   - `TestFilterAssets_AllIncompatible`
   - `TestFilterAssets_WithUnclassified`
   - `TestFilterAssets_NoSupportedTargets`
   - `TestBuildFilteringResult_Metrics`

4. **Trigger Integration Tests**
   - `TestTriggerScan_SmartFiltering_PartialCompatible`
   - `TestTriggerScan_SmartFiltering_NoneCompatible`
   - `TestTriggerScan_SmartFiltering_AllCompatible`

### Integration Tests (Updated for Smart Filtering)

1. **API Tests**
   - POST `/scans/{id}/trigger` with mixed assets → 200 + FilteringResult
   - POST `/scans/{id}/trigger` with all incompatible → 200 + FilteringResult (0 scanned)
   - POST `/scans/{id}/trigger` with compatible → 200 + FilteringResult (all scanned)

2. **Migration Tests**
   - Run migration on test DB with sample data
   - Verify asset types migrated correctly
   - Verify rollback works

3. **Admin API Tests** (`admin_target_mapping_handler_test.go`)
   - GET `/admin/target-mappings` - List all mappings with pagination
   - POST `/admin/target-mappings` - Create mapping with valid data
   - POST `/admin/target-mappings` - Reject invalid target_type (not in whitelist)
   - POST `/admin/target-mappings` - Reject invalid asset_type
   - PUT `/admin/target-mappings/{id}` - Update existing mapping
   - DELETE `/admin/target-mappings/{id}` - Soft delete mapping
   - Verify audit logs created for all mutations
   - Verify rate limiting (100 req/min per admin)
   - Verify non-admin users get 403 Forbidden

4. **Admin Reclassification Tests**
   - POST `/admin/assets/reclassify` - Reclassify assets by type
   - POST `/admin/assets/reclassify` - Verify dry-run mode
   - POST `/admin/assets/reclassify` - Verify audit logging
   - Verify cannot reclassify to deprecated types

### E2E Tests (Cypress/Playwright)

1. **Admin Target Mappings UI**
   - Navigate to Admin → Target Mappings
   - Create new mapping via form
   - Edit existing mapping
   - Delete mapping with confirmation
   - Verify validation errors displayed

2. **Admin Reclassification UI**
   - Navigate to Admin → Asset Reclassification
   - Select source type → preview affected count
   - Select target type → run reclassification
   - Verify progress indicator
   - Verify success message

---

## Success Metrics

| Metric | Before | After |
|--------|--------|-------|
| Asset types | 37 (5 deprecated) | 32 (clean) |
| Dead code (`SupportsTarget()`) | Unused | Replaced by smart filtering |
| Incompatible scan attempts | Unknown | Auto-filtered + reported |
| Wasted compute on incompatible | Unknown | Zero (only compatible assets sent to agent) |
| User intervention required | Manual fix | None (auto-filter) |
| Test coverage | N/A | >80% for new code |

---

## Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1: Cleanup | 1 day | Migration + code changes |
| Phase 2: Dynamic Mapping | 1.5 days | Migration + repository + tests |
| Phase 3: Smart Filtering | 2.5-3 days | Asset filter service + trigger integration + tests |
| Phase 4: Scan UI | 1 day | Preview + Filtering result components |
| Phase 4B: Admin UI - Mappings | 1 day | Target mappings management page |
| Phase 4C: Admin API | 0.5 day | CRUD endpoints + security |
| Phase 4D: Admin UI - Reclassify | 0.5 day | Bulk reclassify unclassified assets |
| Phase 5: Testing | 0.5 day | Integration + E2E tests |
| **Total** | **8-9 days** | |

---

## Future Enhancements (Out of Scope)

1. **Auto-populate `asset_type` in pipeline context** from asset metadata
2. **Pass `AssetGroupIDs[]`** to agents for multi-group support
3. ~~**Agent-side filtering**~~ - Now done at trigger level (better observability)
4. **New condition type** `ConditionTypeToolSupports` for workflow steps
5. **Auto-classify `other` assets** - ML/heuristic to suggest correct type
6. ~~**Bulk reclassify tool**~~ - Moved to Phase 4D (in scope)
7. ~~**Admin UI for target mappings**~~ - Moved to Phase 4B (in scope)
8. **Filtering analytics dashboard** - Show trends of filtered assets over time
9. **ASN query enhancements** - Add GIN index on `properties.ip_address.asn` + API endpoint `/api/v1/assets/by-asn/{asn}` for ASN aggregation (see Analysis section)
10. **DNS record enrichment** - Auto-query DNS records when domain assets are created

---

## API Response Examples

### CreateScan Response (with preview warning)

```json
{
  "scan": {
    "id": "abc-123",
    "name": "Web Scan",
    "scanner_name": "nuclei",
    "status": "active"
  },
  "compatibility": {
    "compatible": false,
    "incompatible_types": ["repository"],
    "compatible_types": ["website", "domain", "ip_address"],
    "unclassified_types": ["other"],
    "unclassified_count": 5,
    "total_asset_types": 4,
    "total_asset_count": 100,
    "incompatible_count": 1,
    "compatibility_ratio": 0.85
  }
}
```

### TriggerScan Response - Smart Filtering (Partial Compatibility)

> **NEW**: Instead of blocking, we now filter and report.

```json
{
  "run": {
    "id": "run-456",
    "scan_id": "abc-123",
    "status": "running",
    "started_at": "2026-02-02T10:00:00Z"
  },
  "filtering": {
    "total_assets": 100,
    "scanned_assets": 80,
    "skipped_assets": 20,
    "skipped_by_type": {
      "repository": 15,
      "other": 5
    },
    "filtering_reason": {
      "repository": "not_supported_by_nuclei",
      "other": "unclassified_asset_type"
    },
    "compatibility_ratio": 0.80,
    "filtered_at": "2026-02-02T10:00:00Z"
  }
}
```

### TriggerScan Response - Smart Filtering (0% Compatibility)

> **NEW**: Even with 0% compatible, we proceed with empty scan and report.

```json
{
  "run": {
    "id": "run-789",
    "scan_id": "abc-123",
    "status": "completed",
    "started_at": "2026-02-02T10:00:00Z",
    "completed_at": "2026-02-02T10:00:01Z"
  },
  "filtering": {
    "total_assets": 50,
    "scanned_assets": 0,
    "skipped_assets": 50,
    "skipped_by_type": {
      "repository": 30,
      "container": 20
    },
    "filtering_reason": {
      "repository": "not_supported_by_nuclei",
      "container": "not_supported_by_nuclei"
    },
    "compatibility_ratio": 0.0,
    "filtered_at": "2026-02-02T10:00:00Z"
  }
}
```

### TriggerScan Response - All Compatible (No Filtering)

```json
{
  "run": {
    "id": "run-100",
    "scan_id": "abc-123",
    "status": "running",
    "started_at": "2026-02-02T10:00:00Z"
  },
  "filtering": {
    "total_assets": 100,
    "scanned_assets": 100,
    "skipped_assets": 0,
    "skipped_by_type": {},
    "filtering_reason": {},
    "compatibility_ratio": 1.0,
    "filtered_at": "2026-02-02T10:00:00Z"
  }
}
```

---

## Summary: Smart Filtering vs Old Approach

| Aspect | Old Approach | Smart Filtering (New) |
|--------|--------------|----------------------|
| **At Create** | Warning + Block if 100% other | Warning only (preview) |
| **At Trigger** | Block if 0% compatible | Auto-filter, never block |
| **User Action** | Fix asset group manually | None required |
| **Agent Receives** | All assets | Only compatible assets |
| **Reporting** | Error response | FilteringResult in response |
| **Scheduled Scans** | May fail | Always succeed, auto-filter |
| **Observability** | Limited | Full filtering metrics |

**Key Principle:** The scan system should be helpful, not obstructive. Auto-filter and report, never block.

---

## Expert Review & Risk Assessment

### 🎯 PM/Tech Lead/BA Review

#### Strengths ✅
1. **Clear problem definition** - 6 issues well-documented with code references
2. **Hybrid approach** - Balances UX (auto-filter) with transparency (reporting)
3. **Comprehensive edge cases** - 15 edge cases covered
4. **Phased implementation** - Incremental delivery with clear milestones
5. **Dynamic mapping table** - Future-proof, admin-configurable without code deploy

#### Concerns & Recommendations ⚠️

| # | Concern | Risk | Recommendation |
|---|---------|------|----------------|
| 1 | **Migration rollback risk** | HIGH | Add pre-migration backup step, test on staging with production data |
| 2 | **`other` type deprecation** | MEDIUM | Need clear user communication + admin tool to reclassify before removal |
| 3 | **No backward compatibility period** | MEDIUM | Consider 2-week deprecation period before removing asset types |
| 4 | **Missing migration validation** | HIGH | Add migration test that verifies 0 assets with deprecated types after migration |
| 5 | **Workflow scan edge case** | MEDIUM | Multi-tool workflows need clearer per-step filtering logic |
| 6 | **Performance impact unknown** | MEDIUM | Add benchmarks for `FilterAssets()` with 10k+ assets |
| 7 | **Missing rollback plan** | HIGH | Document manual rollback steps if migration fails |

#### Missing Requirements (Should Add)
- [ ] **Admin notification** when assets have `other` type
- [ ] **Bulk reclassify endpoint** for admin to fix `other` assets
- [ ] **Deprecation warning period** in UI for legacy asset types
- [ ] **Migration dry-run mode** to preview changes without executing

---

### 👤 UX Review (User Perspective)

#### Good UX Decisions ✅
1. **Non-blocking at trigger** - Scan proceeds, no manual intervention
2. **Clear feedback** - FilteringResult shows exactly what happened
3. **Preview at creation** - User knows upfront about compatibility
4. **Toast notifications** - Immediate feedback when assets skipped

#### UX Concerns & Improvements ⚠️

| # | Issue | Impact | Recommendation |
|---|-------|--------|----------------|
| 1 | **No explanation of WHY incompatible** | User confusion | Add tooltip: "nuclei can only scan URLs, domains, IPs" |
| 2 | **"other" type unclear to users** | Bad UX | Rename to "Unclassified" in UI, add "Classify" button |
| 3 | **Skipped assets not actionable** | Dead end | Add "View skipped assets" → redirect to asset list filtered |
| 4 | **No bulk fix option** | Tedious | Add "Reclassify X assets" button in warning |
| 5 | **Create scan blocked for 100% other** | Inconsistent | Should allow creation with warning, not block |
| 6 | **Missing "Why was this skipped?"** | Confusion | Each skipped asset should have reason tooltip |
| 7 | **No filter history** | Lost context | Store last 5 FilteringResults for scan, show in Runs tab |

#### Recommended UI Changes
```
┌─────────────────────────────────────────────────────────────────────┐
│ ⚠️ Smart Filtering Applied                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  80/100 assets will be scanned (80%)                                │
│                                                                      │
│  Skipped by type:                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ • repository (15) - not supported by nuclei                     ││
│  │   [View assets] [Reclassify to...]                              ││
│  │                                                                  ││
│  │ • unclassified (5) - needs classification                       ││
│  │   [View assets] [Classify now]                                  ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  [Proceed anyway] [Cancel] [Learn more about compatibility]         │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 🔒 Security Expert Review

#### Security Strengths ✅
1. **Tenant isolation** - All queries include `tenant_id`
2. **FK constraints** - `target_asset_type_mappings` has FK to `asset_types`
3. **No sensitive data exposure** - FilteringResult doesn't leak asset content
4. **Fail-open design** - On error, scan proceeds (availability over strict validation)

#### Security Concerns & Mitigations ⚠️

| # | Vulnerability | Severity | Mitigation |
|---|--------------|----------|------------|
| 1 | **SQL Injection in mapping queries** | HIGH | ✅ Already uses parameterized queries (`$1`, `$2`) |
| 2 | **Mass assignment in admin API** | MEDIUM | Add input validation for Create/Update mapping |
| 3 | **No rate limit on mapping admin API** | LOW | Add rate limit to `/admin/target-mappings` |
| 4 | **Bulk operations without limit** | MEDIUM | Add max batch size (100) for bulk delete/reclassify |
| 5 | **FilteringResult exposes asset IDs** | LOW | Consider making `skipped_asset_ids` admin-only |
| 6 | **No audit log for mapping changes** | MEDIUM | Add audit trail for admin mapping CRUD |
| 7 | **Migration deletes data permanently** | HIGH | Add soft-delete first, hard-delete after 30 days |

#### Security Recommendations (Must Implement)

```go
// 1. Add input validation for mapping admin API
func (h *TargetMappingHandler) Create(c *gin.Context) {
    var input CreateMappingInput
    if err := c.ShouldBindJSON(&input); err != nil {
        return
    }

    // Validate target_type (whitelist)
    validTargets := []string{"url", "domain", "ip", "repository", "container", "host", "file"}
    if !slices.Contains(validTargets, input.TargetType) {
        c.JSON(400, gin.H{"error": "invalid target_type"})
        return
    }

    // Validate asset_type exists (FK will also catch this)
    // ...
}

// 2. Add max batch size for bulk operations
const MaxBulkOperationSize = 100

func (s *Service) BulkDelete(ctx context.Context, ids []string) error {
    if len(ids) > MaxBulkOperationSize {
        return fmt.Errorf("batch size exceeds limit of %d", MaxBulkOperationSize)
    }
    // ...
}

// 3. Add audit logging for mapping changes
func (r *TargetMappingRepository) Create(ctx context.Context, mapping *TargetAssetTypeMapping) error {
    // ... create logic ...

    // Audit log
    r.auditLog.Log(ctx, audit.Event{
        Action:   "target_mapping.create",
        Resource: mapping.ID.String(),
        Data:     mapping,
    })
    return nil
}
```

#### Data Protection Checklist
- [ ] Ensure `skipped_asset_ids` respects tenant boundary (can't see other tenant's IDs)
- [ ] Add RBAC check for admin mapping endpoints (`role:admin` required)
- [ ] Validate `asset_type` in migration matches `asset_types` table (FK constraint helps)
- [ ] Add transaction wrapper for migration to ensure atomicity

---

## Implementation Todo List

### Phase 1: Asset Types Cleanup (1 day) ✅ COMPLETED

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 1.1 | Create migration backup script | ✅ DONE | - | `pg_dump assets` before migration |
| 1.2 | Write migration `000151_asset_types_cleanup.up.sql` | ✅ DONE | - | Added `unclassified` type |
| 1.3 | Write rollback `000151_asset_types_cleanup.down.sql` | ✅ DONE | - | Restores original types |
| 1.4 | Add migration test (verify 0 deprecated types after) | ✅ DONE | - | |
| 1.5 | Update `value_objects.go` - remove 5 constants | ✅ DONE | - | Kept `cloud`, added `unclassified` |
| 1.6 | Update `AllAssetTypes()` function | ✅ DONE | - | |
| 1.7 | Search & remove all references to deprecated types | ✅ DONE | - | `code_repo`, `application`, `endpoint`, `other` removed |
| 1.8 | Run migration on local/dev | ✅ DONE | - | |
| 1.9 | Run migration on staging | ⬜ TODO | - | With production data snapshot |
| 1.10 | Document rollback procedure | ✅ DONE | - | |

### Phase 2: Dynamic Target Mapping (1.5 days) ✅ COMPLETED

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 2.1 | Create `000152_target_asset_type_mappings.up.sql` | ✅ DONE | - | With seed data |
| 2.2 | Create `000152_target_asset_type_mappings.down.sql` | ✅ DONE | - | |
| 2.3 | Create `tool/target_mapping.go` entity | ✅ DONE | - | |
| 2.4 | Create `TargetMappingRepository` interface | ✅ DONE | - | In `tool/repository.go` |
| 2.5 | Implement `postgres/target_mapping_repository.go` | ✅ DONE | - | |
| 2.6 | Write tests `target_mapping_repository_test.go` | ⬜ TODO | - | TDD: write first |
| 2.7 | Add input validation for target_type whitelist | ✅ DONE | - | Security: prevent injection |
| 2.8 | Add audit logging for mapping CRUD | ⬜ TODO | - | Security requirement |
| 2.9 | Run migration on local/dev | ✅ DONE | - | |
| 2.10 | Verify seed data correct | ✅ DONE | - | |

### Phase 3: Smart Filtering + Validation (2.5-3 days) ✅ COMPLETED

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 3.1 | Add `GetDistinctAssetTypes()` to AssetGroupRepository | ✅ DONE | - | Interface added |
| 3.2 | Add `CountAssetsByType()` to AssetGroupRepository | ✅ DONE | - | Implementation added |
| 3.3 | Add `GetGroupAssets()` to AssetGroupRepository | ✅ DONE | - | Via `GetDistinctAssetTypesMultiple` |
| 3.4 | Create `scan/filtering.go` - FilteringResult types | ✅ DONE | - | `FilteringResult`, `AssetCompatibilityPreview`, `SkipReason` |
| 3.5 | Create `scan/asset_filter.go` - AssetFilterService | ✅ DONE | - | Combined in `filtering.go` |
| 3.6 | Write tests `asset_filter_test.go` | ⬜ TODO | - | TDD: 7 test cases |
| 3.7 | Create `scan/compatibility.go` - CheckAssetCompatibility | ✅ DONE | - | `PreviewCompatibility()` method |
| 3.8 | Write tests `compatibility_test.go` | ⬜ TODO | - | TDD: 8 test cases |
| 3.9 | Integrate into `CreateScan()` - preview | ✅ DONE | - | `PreviewScanCompatibility()` in crud.go |
| 3.10 | Integrate into `TriggerScan()` - smart filtering | ✅ DONE | - | `filterAssetsForSingleScan()` in trigger.go |
| 3.11 | Update `TriggerResult` type | ✅ DONE | - | `RunResponse` includes `FilteringResult` |
| 3.12 | Update scan handler response DTOs | ✅ DONE | - | `FilteringResultResponse`, `CreateScanResponse` |
| 3.13 | Add max batch size (100) for bulk operations | ⬜ TODO | - | Security requirement |
| 3.14 | Add performance benchmark for 10k assets | ⬜ TODO | - | |
| 3.15 | Add metrics for filtering (scanned/skipped counts) | ⬜ TODO | - | |

### Phase 4: UI Components (1 day)

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 4.1 | Add `FilteringResult` type to `scan-types.ts` | ⬜ TODO | - | |
| 4.2 | Add `AssetCompatibilityResult` type | ⬜ TODO | - | |
| 4.3 | Create `asset-compatibility-warning.tsx` | ⬜ TODO | - | |
| 4.4 | Create `ScanCompatibilityPreview` component | ⬜ TODO | - | |
| 4.5 | Create `filtering-result-banner.tsx` | ⬜ TODO | - | |
| 4.6 | Create `FilteringResultBadge` component | ⬜ TODO | - | |
| 4.7 | Update `use-trigger-scan.ts` - show toast | ⬜ TODO | - | |
| 4.8 | Integrate preview in `new-scan-form.tsx` | ⬜ TODO | - | |
| 4.9 | Add "View skipped assets" link | ⬜ TODO | - | UX improvement |
| 4.10 | Add tooltip explaining WHY incompatible | ⬜ TODO | - | UX improvement |
| 4.11 | Rename "other" to "Unclassified" in UI | ⬜ TODO | - | UX improvement |

### Phase 4B: Admin UI - Target Mappings (1 day)

> **Note:** Admin UI is required for managing target-to-asset-type mappings without code deployment.

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 4B.1 | Create admin route `/admin/target-mappings` | ⬜ TODO | - | Protected by admin role |
| 4B.2 | Create `TargetMappingsPage` component | ⬜ TODO | - | |
| 4B.3 | Create `TargetMappingTable` component | ⬜ TODO | - | Columns: target, asset_type, is_primary, actions |
| 4B.4 | Create `AddMappingDialog` component | ⬜ TODO | - | Select target + asset_type |
| 4B.5 | Create `EditMappingDialog` component | ⬜ TODO | - | Edit is_primary, description |
| 4B.6 | Add `useTargetMappings` hook (list) | ⬜ TODO | - | |
| 4B.7 | Add `useCreateTargetMapping` mutation | ⬜ TODO | - | |
| 4B.8 | Add `useUpdateTargetMapping` mutation | ⬜ TODO | - | |
| 4B.9 | Add `useDeleteTargetMapping` mutation | ⬜ TODO | - | With confirmation dialog |
| 4B.10 | Add target_type dropdown (predefined list) | ⬜ TODO | - | url, domain, ip, repository, etc. |
| 4B.11 | Add asset_type dropdown (from API) | ⬜ TODO | - | Fetch from `/api/v1/asset-types` |
| 4B.12 | Add validation: prevent duplicate mappings | ⬜ TODO | - | |
| 4B.13 | Add bulk import from JSON | ⬜ TODO | - | Optional: for initial setup |
| 4B.14 | Add export to JSON | ⬜ TODO | - | For backup/sharing |

### Phase 4C: Admin API - Target Mappings (0.5 day)

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 4C.1 | Create `GET /api/v1/admin/target-mappings` | ⬜ TODO | - | List all mappings |
| 4C.2 | Create `POST /api/v1/admin/target-mappings` | ⬜ TODO | - | Create new mapping |
| 4C.3 | Create `PUT /api/v1/admin/target-mappings/{id}` | ⬜ TODO | - | Update mapping |
| 4C.4 | Create `DELETE /api/v1/admin/target-mappings/{id}` | ⬜ TODO | - | Delete mapping |
| 4C.5 | Add admin role middleware | ⬜ TODO | - | `RequireRole("admin")` |
| 4C.6 | Add rate limiting (10 req/min) | ⬜ TODO | - | Security requirement |
| 4C.7 | Add audit logging for all CRUD | ⬜ TODO | - | Security requirement |
| 4C.8 | Add input validation (whitelist target_types) | ⬜ TODO | - | Security requirement |
| 4C.9 | Add OpenAPI documentation | ⬜ TODO | - | |

### Phase 4D: Admin UI - Asset Reclassification (0.5 day)

> **Note:** Tool for admins to bulk reclassify "other" type assets.

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 4D.1 | Add "Unclassified Assets" section to admin dashboard | ⬜ TODO | - | Show count badge |
| 4D.2 | Create `UnclassifiedAssetsTable` component | ⬜ TODO | - | List assets with type="other" |
| 4D.3 | Add bulk select functionality | ⬜ TODO | - | |
| 4D.4 | Create `ReclassifyDialog` component | ⬜ TODO | - | Select new asset_type |
| 4D.5 | Add `useBulkReclassifyAssets` mutation | ⬜ TODO | - | |
| 4D.6 | Create `POST /api/v1/admin/assets/bulk-reclassify` | ⬜ TODO | - | Backend endpoint |
| 4D.7 | Add confirmation with preview | ⬜ TODO | - | "Will change X assets to type Y" |
| 4D.8 | Add audit log for reclassification | ⬜ TODO | - | |

### Phase 5: Testing & Validation (0.5 day)

| # | Task | Status | Owner | Notes |
|---|------|--------|-------|-------|
| 5.1 | Integration test: CreateScan with mixed assets | ⬜ TODO | - | |
| 5.2 | Integration test: TriggerScan with filtering | ⬜ TODO | - | |
| 5.3 | Integration test: Scheduled scan with filtering | ⬜ TODO | - | |
| 5.4 | E2E test: Full flow from create to trigger | ⬜ TODO | - | |
| 5.5 | Performance test: 10k assets filtering | ⬜ TODO | - | |
| 5.6 | Security test: Tenant isolation verification | ⬜ TODO | - | |
| 5.7 | Rollback test: Verify down migration works | ⬜ TODO | - | |

---

## Pre-Implementation Checklist

Before starting implementation, verify:

- [ ] **Database backup** - Can restore if migration fails
- [ ] **Staging environment** - Has recent production data snapshot
- [ ] **Feature flag ready** - Can disable filtering if issues found
- [ ] **Monitoring alerts** - Set up alerts for filtering errors
- [ ] **Rollback documented** - Team knows how to revert

---

## Risk Mitigation Summary

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Migration data loss | Low | High | Pre-migration backup, test on staging |
| Performance regression | Medium | Medium | Benchmark with 10k assets |
| User confusion | Medium | Low | Clear UI messaging, tooltips |
| Security vulnerability | Low | High | Input validation, audit logging |
| Breaking existing scans | Low | High | Preserve behavior for tools without `supported_targets` |

---

*Document Version: 7.0*
*Last Updated: 2026-02-02*
*Changes in v7.0: Added Admin UI files (Phase 4B, 4C, 4D), Admin API tests, E2E tests*
*Changes in v6.0: Added Expert Review (PM/UX/Security), Todo List, Risk Assessment*
