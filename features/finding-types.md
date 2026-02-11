---
layout: default
title: Finding Types & Fingerprinting
parent: Features
nav_order: 7
---

# Finding Types & Fingerprinting

> **Status**: ✅ Implemented
> **Version**: v1.0
> **Released**: 2026-01-29

## Overview

The Finding Type System provides polymorphic behavior for security findings, enabling type-aware fingerprinting, specialized queryable fields, and attack path analysis through data flow tracking.

## Problem Statement

Different security finding types have different characteristics:

| Finding Type | Unique Identifier | Key Fields |
|--------------|-------------------|------------|
| SAST Vulnerability | Code location + rule | File path, line, snippet |
| SCA Vulnerability | Package + CVE | PURL, version, CVE ID |
| Secret | Credential type + value | Service, masked value, validity |
| Compliance | Framework + control | Framework, control ID, result |
| Web3 | Contract + vulnerability | Chain, address, SWC ID |
| Misconfiguration | Policy + resource | Resource type, path, expected/actual |

A single fingerprinting algorithm cannot accurately deduplicate all types.

## Solution: Type-Aware Architecture

### Finding Type Discriminator

Every finding has a `finding_type` field that determines its behavior:

```go
type FindingType string

const (
    FindingTypeVulnerability    FindingType = "vulnerability"
    FindingTypeSecret           FindingType = "secret"
    FindingTypeMisconfiguration FindingType = "misconfiguration"
    FindingTypeCompliance       FindingType = "compliance"
    FindingTypeWeb3             FindingType = "web3"
)
```

### Type Inference

Finding type is inferred during ingestion:

```go
func inferFindingType(source FindingSource, risFinding *ctis.Finding) FindingType {
    // Explicit type in CTIS takes precedence
    if risFinding.Type != "" {
        return mapRISType(risFinding.Type)
    }

    // Infer from source
    switch source {
    case FindingSourceSecret:
        return FindingTypeSecret
    case FindingSourceIaC:
        return FindingTypeMisconfiguration
    }

    // Infer from specialized fields
    if risFinding.Compliance != nil {
        return FindingTypeCompliance
    }
    if risFinding.Web3 != nil {
        return FindingTypeWeb3
    }

    return FindingTypeVulnerability
}
```

## Fingerprint Strategies

Each finding type uses a different fingerprinting algorithm for optimal deduplication:

### Strategy Pattern

```go
type FingerprintStrategy interface {
    Generate(f *Finding) string
    Name() string
}

func GetFingerprintStrategy(findingType FindingType, source FindingSource) FingerprintStrategy
```

### Available Strategies

| Strategy | Version | Components | Resilience |
|----------|---------|------------|------------|
| SAST | `sast/v1` | assetID + ruleID + filePath + normalizedSnippet | Line shifts |
| SCA | `sca/v1` | assetID + PURL + CVE + filePath | Version changes |
| DAST | `dast/v1` | assetID + ruleID + endpoint + parameter | URL variations |
| Secret | `secret/v1` | assetID + secretType + service + hash(maskedValue) | Full value changes |
| Compliance | `compliance/v1` | assetID + framework + controlID + filePath | Control updates |
| Misconfig | `misconfig/v1` | assetID + policyID + resourceType + resourcePath | Resource changes |
| Web3 | `web3/v1` | chainID + contractAddress + SWCID + functionSelector | Contract upgrades |

> **Security Note**: The secret fingerprint strategy uses a hash of the masked value (not the raw secret) to prevent credential exposure. If no masked value is available, it falls back to ruleID + line number.

### Snippet Normalization (SAST)

SAST fingerprints use normalized snippets instead of line numbers:

```go
func normalizeSnippet(snippet string) string {
    // Remove leading/trailing whitespace per line
    // Join lines with single space
    // Collapse multiple spaces to one
    // Result: "if (user.input) { execute(user.input); }"
}
```

This makes fingerprints resilient to code reformatting and line shifts.

### Partial Fingerprints

All fingerprints are stored in `partial_fingerprints` JSONB for traceability:

```json
{
  "sast/v1": "abc123def456...",
  "default/v1": "xyz789..."
}
```

This enables:
- Multi-algorithm matching
- Backward compatibility
- Algorithm migration

## Specialized Columns

Each finding type has dedicated columns for common queries:

### Secret Findings

```sql
secret_type      VARCHAR(50)   -- api_key, token, password, private_key
secret_service   VARCHAR(100)  -- aws, github, stripe, slack
secret_valid     BOOLEAN       -- Is the secret currently valid
secret_revoked   BOOLEAN       -- Has it been explicitly revoked
secret_entropy   DECIMAL(5,2)  -- Shannon entropy score
secret_expires_at TIMESTAMPTZ  -- Expiration time if known
```

### Compliance Findings

```sql
compliance_framework    VARCHAR(50)   -- CIS, SOC2, PCI-DSS, HIPAA
compliance_control_id   VARCHAR(100)  -- CIS-1.1.1, PCI-DSS-6.5.1
compliance_control_name VARCHAR(500)  -- Human-readable name
compliance_result       VARCHAR(20)   -- pass, fail, manual, not_applicable
compliance_section      VARCHAR(100)  -- Section within framework
```

### Web3 Findings

```sql
web3_chain              VARCHAR(50)   -- ethereum, polygon, bsc
web3_chain_id           BIGINT        -- 1 (mainnet), 137 (polygon)
web3_contract_address   VARCHAR(66)   -- 0x prefixed, 42 chars
web3_swc_id             VARCHAR(20)   -- SWC-101, SWC-107
web3_function_signature VARCHAR(500)  -- transfer(address,uint256)
web3_tx_hash            VARCHAR(66)   -- Transaction hash
```

### Misconfiguration Findings

```sql
misconfig_policy_id     VARCHAR(100)  -- CKV_AWS_1, AVD-AWS-0001
misconfig_resource_type VARCHAR(200)  -- aws_s3_bucket, azurerm_storage
misconfig_resource_name VARCHAR(500)  -- Resource name in IaC
misconfig_resource_path VARCHAR(1000) -- Full path to resource
misconfig_expected      TEXT          -- Expected configuration
misconfig_actual        TEXT          -- Actual configuration found
```

## Data Flow Tracking

### SARIF codeFlows Support

SAST tools like Semgrep and CodeQL produce taint tracking paths showing how data flows from source to sink. This is stored in normalized tables:

```
┌─────────────────────────────────────┐
│       finding_data_flows            │
├─────────────────────────────────────┤
│ id (PK)                             │
│ finding_id (FK → findings)          │
│ flow_index (order within finding)   │
│ message (flow description)          │
│ importance (essential/important)    │
└─────────────────────────────────────┘
              │ 1
              │
              │ n
┌─────────────────────────────────────┐
│     finding_flow_locations          │
├─────────────────────────────────────┤
│ id (PK)                             │
│ data_flow_id (FK)                   │
│ step_index (order in flow)          │
│ location_type (source/sink/...)     │
│ file_path, start_line, end_line     │
│ function_name, class_name           │
│ label, message, snippet             │
└─────────────────────────────────────┘
```

### Location Types

| Type | Description | Example |
|------|-------------|---------|
| `source` | Where tainted data enters | `user_input = request.form['name']` |
| `intermediate` | Data transformation steps | `processed = validate(user_input)` |
| `sink` | Where vulnerability occurs | `execute(processed)` |
| `sanitizer` | Where data is cleaned (safe path) | `escaped = html.escape(data)` |

### Attack Path Analysis

The normalized structure enables powerful queries:

```sql
-- Find all data flows through a specific file
SELECT f.id, f.title, df.message, fl.location_type, fl.function_name
FROM findings f
JOIN finding_data_flows df ON df.finding_id = f.id
JOIN finding_flow_locations fl ON fl.data_flow_id = df.id
WHERE fl.file_path = '/src/controllers/auth.go'
ORDER BY f.id, df.flow_index, fl.step_index;

-- Find all sources and sinks for SQL injection findings
SELECT f.id, fl.location_type, fl.file_path, fl.function_name, fl.snippet
FROM findings f
JOIN finding_data_flows df ON df.finding_id = f.id
JOIN finding_flow_locations fl ON fl.data_flow_id = df.id
WHERE f.rule_id LIKE '%sql-injection%'
  AND fl.location_type IN ('source', 'sink');

-- Find functions that appear in multiple vulnerability flows
SELECT fl.function_name, COUNT(DISTINCT f.id) as vuln_count
FROM findings f
JOIN finding_data_flows df ON df.finding_id = f.id
JOIN finding_flow_locations fl ON fl.data_flow_id = df.id
WHERE f.status = 'open'
  AND fl.function_name IS NOT NULL
GROUP BY fl.function_name
HAVING COUNT(DISTINCT f.id) > 1
ORDER BY vuln_count DESC;
```

## API Reference

### Filter Findings by Type

```
GET /api/v1/findings?finding_type=secret&secret_service=aws
```

### Filter Secret Findings

```
GET /api/v1/findings?finding_type=secret&secret_valid=true
```

### Filter Compliance Findings

```
GET /api/v1/findings?finding_type=compliance&compliance_framework=CIS&compliance_result=fail
```

### Filter Web3 Findings

```
GET /api/v1/findings?finding_type=web3&web3_chain=ethereum&web3_swc_id=SWC-107
```

### Get Data Flows for a Finding

```
GET /api/v1/findings/{id}/data-flows
```

Response:
```json
{
  "data_flows": [
    {
      "id": "...",
      "flow_index": 0,
      "message": "SQL injection from user input to database query",
      "importance": "essential",
      "locations": [
        {
          "step_index": 0,
          "location_type": "source",
          "file_path": "src/handlers/user.go",
          "start_line": 42,
          "function_name": "CreateUser",
          "label": "username",
          "message": "User input received from HTTP request"
        },
        {
          "step_index": 1,
          "location_type": "intermediate",
          "file_path": "src/handlers/user.go",
          "start_line": 45,
          "function_name": "CreateUser",
          "message": "Concatenated into SQL string"
        },
        {
          "step_index": 2,
          "location_type": "sink",
          "file_path": "src/handlers/user.go",
          "start_line": 48,
          "function_name": "CreateUser",
          "label": "query",
          "message": "Executed without parameterization"
        }
      ]
    }
  ]
}
```

## Database Schema

### Migrations

| Migration | Description |
|-----------|-------------|
| `000126_finding_type_discriminator` | Adds `finding_type` column with backfill |
| `000127_finding_data_flows` | Creates data flow tables with indexes |
| `000128_finding_specialized_columns` | Adds secret/compliance/web3/misconfig columns |

### Indexes

The specialized columns have optimized partial indexes:

```sql
-- Secret indexes
CREATE INDEX idx_findings_secret_type ON findings(secret_type)
WHERE secret_type IS NOT NULL;

CREATE INDEX idx_findings_secret_service_valid ON findings(secret_service, secret_valid)
WHERE finding_type = 'secret';

-- Compliance indexes
CREATE INDEX idx_findings_compliance_framework_result ON findings(compliance_framework, compliance_result)
WHERE finding_type = 'compliance';

-- Web3 indexes
CREATE INDEX idx_findings_web3_chain_contract ON findings(web3_chain, web3_contract_address)
WHERE finding_type = 'web3';

-- Data flow indexes
CREATE INDEX idx_flow_locations_file ON finding_flow_locations(file_path);
CREATE INDEX idx_flow_locations_function ON finding_flow_locations(function_name)
WHERE function_name IS NOT NULL;
CREATE INDEX idx_flow_locations_type ON finding_flow_locations(location_type);
```

## Security Considerations

### Secret Fingerprinting

The secret fingerprint strategy is designed with security in mind:

1. **Never use raw secrets** - The snippet field may contain the full secret value, but it is NEVER used in fingerprint generation
2. **Use pre-masked values** - Scanners should provide a `masked_value` in metadata (e.g., `ghp_****XXXX`)
3. **Hash the masked value** - Even the masked value is hashed before use in the fingerprint
4. **Fallback safely** - If no masked value exists, use ruleID + line number instead

```go
// SECURE: Only uses hash of masked value
if masked, ok := f.metadata["masked_value"].(string); ok && len(masked) >= 8 {
    maskedHash := sha256.Sum256([]byte(masked))
    h.Write(maskedHash[:8])
} else {
    // Fallback: no secret exposure
    h.Write([]byte(f.ruleID))
    fmt.Fprintf(h, "%d", f.startLine)
}
```

### Tenant Isolation for Data Flows

All data flow queries enforce tenant isolation:

1. **File-based queries** - `ListFlowLocationsByFile(ctx, tenantID, filePath, page)` requires tenantID
2. **Function-based queries** - `ListFlowLocationsByFunction(ctx, tenantID, functionName, page)` requires tenantID
3. **JOIN enforcement** - Queries JOIN with `findings` table to filter by `tenant_id`

```sql
-- SECURE: Always filtered by tenant_id
SELECT fl.* FROM finding_flow_locations fl
JOIN finding_data_flows df ON df.id = fl.data_flow_id
JOIN findings f ON f.id = df.finding_id
WHERE fl.file_path = $1 AND f.tenant_id = $2
```

### Location Type Validation

Location types are validated at the domain layer:

```go
const (
    LocationTypeSource       = "source"
    LocationTypeIntermediate = "intermediate"
    LocationTypeSink         = "sink"
    LocationTypeSanitizer    = "sanitizer"
)

// Validation on creation
if !IsValidLocationType(locationType) {
    return nil, shared.ErrValidation
}
```

## Best Practices

1. **Set explicit type in CTIS reports** - Avoids inference ambiguity
2. **Include specialized fields** - Enables efficient filtering and aggregation
3. **Preserve data flows** - Critical for understanding vulnerability context
4. **Use partial fingerprints** - Store all algorithm versions for migration
5. **Always provide masked_value for secrets** - Ensures secure fingerprinting
6. **Validate location types** - Use constants instead of raw strings

## Related Documentation

- [Finding Lifecycle](finding-lifecycle.md) - Auto-resolve and branch awareness
- [CTEM Finding Fields](ctem-fields.md) - Exposure and impact fields
- [Database Schema](../database/schema.md) - Full schema reference
