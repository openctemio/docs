---
layout: default
title: CTIS Domain Mapping
parent: Architecture
nav_order: 27
---

# CTIS Domain Mapping

> **Status**: ✅ Implemented
> **Version**: v1.1
> **Last Updated**: 2026-03-04

## Overview

CTIS (CTEM Ingest Schema) is the normalized format that agents use to submit scan results to the API. The ingest pipeline converts CTIS findings into domain `Finding` entities. This document describes how every CTIS field maps to the domain layer, including fields stored in dedicated columns vs. JSONB metadata.

## Architecture

```
┌──────────┐     CTIS Report     ┌──────────────────┐     Domain Entity     ┌───────────┐
│  Agent   │ ──────────────────► │  Ingest Pipeline  │ ───────────────────► │  Postgres │
│ (Scanner)│     (JSON)          │                    │    (Finding)          │           │
└──────────┘                     │  processor_        │                      │ findings  │
                                 │  findings.go       │                      │  table    │
                                 └──────────────────┘                      └───────────┘
```

### Two Storage Strategies

| Strategy | When Used | Queryable | Example Fields |
|----------|-----------|-----------|----------------|
| **Dedicated columns** | Frequently queried, indexed, or filtered | Yes (SQL WHERE) | `severity`, `status`, `web3_chain`, `secret_type` |
| **JSONB metadata** | Rarely queried, informational, or complex nested data | Yes (JSONB operators) | `web3_gas_issue`, `web3_attack_vector`, `secret_revoked_at` |

## Finding Type Mapping

### Common Fields (All Finding Types)

| CTIS Field | Domain Field | Storage |
|------------|-------------|---------|
| `id` | — | Used for dedup only |
| `title` | `title` | Column |
| `description` | `description` | Column |
| `severity` | `severity` | Column |
| `type` | `findingType` | Column |
| `fingerprint` | `fingerprint` | Column (indexed) |
| `location.path` | `filePath` | Column |
| `location.line_start` | `lineStart` | Column |
| `location.line_end` | `lineEnd` | Column |

### Secret Findings

| CTIS Field | Domain Field | Storage | Notes |
|------------|-------------|---------|-------|
| `secret.type` | `secretType` | Column | e.g., "github_token" |
| `secret.service` | `secretService` | Column | e.g., "GitHub" |
| `secret.valid` | `secretValid` | Column | Credential still works? |
| `secret.revoked` | `secretRevoked` | Column | Has been revoked? |
| `secret.entropy` | `secretEntropy` | Column | Shannon entropy |
| `secret.expires_at` | `secretExpiresAt` | Column | Token expiration |
| `secret.verified_at` | `secretVerifiedAt` | Column | Last verification |
| `secret.rotation_due_at` | `secretRotationDueAt` | Column | Next rotation |
| `secret.age_in_days` | `secretAgeInDays` | Column | Age since creation |
| `secret.scopes` | `secretScopes` | Column (TEXT[]) | Permission scopes |
| `secret.masked_value` | `secretMaskedValue` | Column | e.g., "ghp_****WXYZ" |
| `secret.in_history_only` | `secretInHistoryOnly` | Column | Only in git history |
| `secret.commit_count` | `secretCommitCount` | Column | Commits containing secret |
| `secret.revoked_at` | metadata `secret_revoked_at` | JSONB | When revoked (RFC3339) |
| `secret.length` | metadata `secret_length` | JSONB | Secret length in chars |

### Web3 Findings

| CTIS Field | Domain Field | Storage | Notes |
|------------|-------------|---------|-------|
| `web3.chain` | `web3Chain` | Column | e.g., "ethereum" |
| `web3.chain_id` | `web3ChainID` | Column | e.g., 1 |
| `web3.contract_address` | `web3ContractAddress` | Column | Indexed |
| `web3.swc_id` | `web3SWCID` | Column | SWC classification |
| `web3.function_signature` | `web3FunctionSignature` | Column | e.g., "withdraw(uint256)" |
| `web3.function_selector` | `web3FunctionSelector` | Column | First 4 bytes |
| `web3.bytecode_offset` | `web3BytecodeOffset` | Column | Offset in bytecode |
| `web3.related_tx_hashes` | metadata `web3_related_tx_hashes` | JSONB | Transaction hashes |
| `web3.vulnerable_pattern` | metadata `web3_vulnerable_pattern` | JSONB | e.g., "delegatecall in loop" |
| `web3.exploitable_on_mainnet` | metadata `web3_exploitable_on_mainnet` | JSONB | Only stored if `true` |
| `web3.estimated_impact_usd` | metadata `web3_estimated_impact_usd` | JSONB | Financial impact estimate |
| `web3.affected_value_usd` | metadata `web3_affected_value_usd` | JSONB | Value at risk |
| `web3.attack_vector` | metadata `web3_attack_vector` | JSONB | e.g., "flash_loan" |
| `web3.attacker_addresses` | metadata `web3_attacker_addresses` | JSONB | Known attacker addresses |
| `web3.detection_tool` | metadata `web3_detection_tool` | JSONB | e.g., "slither" |
| `web3.detection_confidence` | metadata `web3_detection_confidence` | JSONB | e.g., "high" |
| `web3.gas_issue` | metadata `web3_gas_issue` | JSONB | Nested struct as RawJSON |
| `web3.access_control` | metadata `web3_access_control` | JSONB | Nested struct as RawJSON |
| `web3.reentrancy` | metadata `web3_reentrancy` | JSONB | Nested struct as RawJSON |

### Compliance Findings

| CTIS Field | Domain Field | Storage |
|------------|-------------|---------|
| `compliance.framework` | `complianceFramework` | Column |
| `compliance.framework_version` | `complianceFrameworkVersion` | Column |
| `compliance.control_id` | `complianceControlID` | Column |
| `compliance.control_name` | `complianceControlName` | Column |
| `compliance.control_description` | `complianceControlDescription` | Column |
| `compliance.result` | `complianceResult` | Column |

### Misconfiguration Findings

| CTIS Field | Domain Field | Storage |
|------------|-------------|---------|
| `misconfiguration.policy_id` | `misconfigPolicyID` | Column |
| `misconfiguration.policy_name` | `misconfigPolicyName` | Column |
| `misconfiguration.resource_type` | `misconfigResourceType` | Column |
| `misconfiguration.cause` | `misconfigCause` | Column |

## Zero-Value Guards

The processor only stores values that are non-zero/non-empty. This prevents JSONB bloat:

```go
// String fields: only if non-empty
if ctisFinding.Web3.AttackVector != "" {
    f.SetMetadata("web3_attack_vector", ctisFinding.Web3.AttackVector)
}

// Numeric fields: only if > 0
if ctisFinding.Web3.EstimatedImpactUSD > 0 {
    f.SetMetadata("web3_estimated_impact_usd", ctisFinding.Web3.EstimatedImpactUSD)
}

// Boolean fields: only store true (false = absent)
if ctisFinding.Web3.ExploitableOnMainnet {
    f.SetMetadata("web3_exploitable_on_mainnet", true)
}

// Slice fields: only if non-empty
if len(ctisFinding.Web3.RelatedTxHashes) > 0 {
    f.SetMetadata("web3_related_tx_hashes", ctisFinding.Web3.RelatedTxHashes)
}

// Nested structs: marshal to json.RawMessage
if ctisFinding.Web3.GasIssue != nil {
    if data, err := json.Marshal(ctisFinding.Web3.GasIssue); err == nil {
        f.SetMetadata("web3_gas_issue", json.RawMessage(data))
    }
}
```

## Querying Metadata Fields

Metadata fields stored in JSONB can be queried using PostgreSQL operators:

```sql
-- Find all Web3 findings with flash loan attack vector
SELECT * FROM findings
WHERE metadata->>'web3_attack_vector' = 'flash_loan';

-- Find all Web3 findings with estimated impact > $1M
SELECT * FROM findings
WHERE (metadata->>'web3_estimated_impact_usd')::float > 1000000;

-- Find secrets that have been revoked
SELECT * FROM findings
WHERE metadata->>'secret_revoked_at' IS NOT NULL;
```

## Key Files

| File | Description |
|------|-------------|
| `api/internal/app/ingest/processor_findings.go` | CTIS to domain mapping logic |
| `api/pkg/domain/vulnerability/finding.go` | Finding entity with all setters |
| `api/tests/unit/ctis_mapping_test.go` | 15 unit tests for mapping correctness |

## Design Decisions

### Why JSONB for Web3 Extended Fields?

1. **Low query frequency** — Fields like `gas_issue` and `reentrancy` are rarely used in filters
2. **Complex nested structures** — `GasIssue`, `AccessControl`, `Reentrancy` are nested objects
3. **No schema migration** — Adding new fields doesn't require `ALTER TABLE`
4. **Flexible** — Agents can send new fields without API changes

### Why Dedicated Columns for Core Fields?

1. **Indexed for search** — `severity`, `status`, `fingerprint` are in WHERE clauses
2. **Type safety** — PostgreSQL enforces types (INT, TIMESTAMP, BOOLEAN)
3. **Performance** — Direct column access is faster than JSONB extraction

## Related Documentation

- [SDK-API Integration](sdk-api-integration.md) - Agent to API communication flow
- [Finding Types & Fingerprinting](../features/finding-types.md) - Type-aware deduplication
- [Finding Lifecycle](../features/finding-lifecycle.md) - Auto-resolve and activity logging
