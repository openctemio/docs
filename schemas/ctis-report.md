---
layout: default
title: CTIS Report Schema
parent: CTIS Schema Reference
nav_order: 1
---

# CTIS Report Schema

The Report schema is the root document for CTIS. It contains metadata, tool information, assets, findings, and dependencies.

**Schema Location**: `schemas/ctis/v1/report.json`

---

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Schema version. Must be `"1.0"` |
| `metadata` | object | Report metadata (see [ReportMetadata](#reportmetadata)) |

---

## All Fields

### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | **Yes** | Schema version (const: `"1.0"`) |
| `$schema` | string | No | JSON Schema URL for validation |
| `metadata` | [ReportMetadata](#reportmetadata) | **Yes** | Report metadata |
| `tool` | [Tool](#tool) | No | Tool that generated this report |
| `assets` | array[[Asset](ctis-asset.md)] | No | Discovered assets |
| `findings` | array[[Finding](ctis-finding.md)] | No | Security findings |
| `dependencies` | array[[Dependency](ctis-dependency.md)] | No | Software dependencies (SBOM) |
| `properties` | object | No | Custom properties (any key-value) |

---

## Object Definitions

### ReportMetadata

Report metadata containing timestamp, source information, and scan context.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | No | Unique report/scan identifier |
| `timestamp` | string (date-time) | **Yes** | When the report was generated (ISO 8601) |
| `duration_ms` | integer | No | Scan duration in milliseconds |
| `source_type` | enum | No | Type of data source |
| `source_ref` | string | No | External reference (job ID, scan ID) |
| `coverage_type` | enum | No | Coverage type for finding lifecycle |
| `branch` | [BranchInfo](#branchinfo) | No | Git branch context |
| `scope` | [Scope](#scope) | No | Target scope of the scan |
| `properties` | object | No | Custom properties |

**source_type** values:
- `scanner` - Automated security scanner
- `collector` - Asset/data collector
- `integration` - Third-party integration
- `manual` - Manual submission

**coverage_type** values:
- `full` - Complete scan of entire scope (enables auto-resolve)
- `incremental` - Diff scan of changed files only (no auto-resolve)
- `partial` - Partial scan of specific directories (no auto-resolve)

---

### BranchInfo

Git branch context for CI/CD scans. Used for branch-aware finding lifecycle management.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Branch name (e.g., `"main"`, `"feature/xyz"`) |
| `is_default_branch` | boolean | No | Whether this is the default branch. Auto-resolve only applies to default branch scans. |
| `commit_sha` | string | No | Commit SHA being scanned |
| `base_branch` | string | No | Base branch for PR/MR scans (e.g., `"main"` when scanning a PR targeting main) |
| `pull_request_number` | integer | No | PR/MR number if this is a pull request scan |
| `pull_request_url` | string (uri) | No | PR/MR URL if this is a pull request scan |
| `repository_url` | string | No | Repository URL. Format: `domain/owner/repo` (e.g., `github.com/org/repo`) |

**Example:**
```json
{
  "name": "main",
  "is_default_branch": true,
  "commit_sha": "abc123def456",
  "repository_url": "github.com/myorg/myrepo"
}
```

---

### Scope

Target scope of the scan/collection.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Scope name or identifier |
| `type` | enum | No | Scope type |
| `includes` | array[string] | No | Included targets |
| `excludes` | array[string] | No | Excluded targets |

**type** values:
- `domain` - Domain/subdomain scope
- `network` - Network/IP range scope
- `repository` - Repository scope
- `cloud_account` - Cloud account scope
- `blockchain` - Blockchain/Web3 scope

---

### Tool

Tool that generated this report.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **Yes** | Tool name (e.g., `"semgrep"`, `"codeql"`, `"trivy"`) |
| `version` | string | No | Tool version |
| `vendor` | string | No | Tool vendor/organization |
| `info_url` | string (uri) | No | Tool information URL |
| `capabilities` | array[string] | No | Tool capabilities |
| `properties` | object | No | Custom properties |

**capabilities** values:
- `vulnerability` - Vulnerability detection
- `secret` - Secret detection
- `misconfiguration` - Misconfiguration detection
- `compliance` - Compliance checking
- `web3` - Web3/smart contract analysis
- `domain`, `ip_address`, `repository`, `certificate` - Asset discovery
- `cloud`, `container` - Cloud/container scanning
- `sast`, `code_analysis`, `vulnerability_detection`, `code_quality` - Code analysis
- `taint_tracking`, `cross_file_analysis` - Dataflow analysis
- `secrets_detection` - Secret scanning
- `supply_chain`, `sca`, `dependency_scanning` - SCA
- `iac` - Infrastructure as Code

**Example:**
```json
{
  "name": "codeql",
  "version": "2.15.0",
  "vendor": "GitHub",
  "capabilities": [
    "sast",
    "vulnerability_detection",
    "taint_tracking",
    "cross_file_analysis"
  ]
}
```

---

## Complete Example

```json
{
  "version": "1.0",
  "$schema": "https://schemas.openctem.io/ctis/v1/report.json",
  "metadata": {
    "id": "scan-2026-01-29-001",
    "timestamp": "2026-01-29T10:30:00Z",
    "duration_ms": 45000,
    "source_type": "scanner",
    "source_ref": "github-action-123",
    "coverage_type": "full",
    "branch": {
      "name": "main",
      "is_default_branch": true,
      "commit_sha": "abc123def456789",
      "repository_url": "github.com/myorg/myrepo"
    },
    "scope": {
      "name": "myrepo",
      "type": "repository",
      "includes": ["src/**", "cmd/**"],
      "excludes": ["vendor/**", "test/**"]
    }
  },
  "tool": {
    "name": "codeql",
    "version": "2.15.0",
    "vendor": "GitHub",
    "capabilities": ["sast", "taint_tracking"]
  },
  "assets": [],
  "findings": [],
  "dependencies": []
}
```

---

## Related Schemas

- [Asset Schema](ctis-asset.md) - Asset definitions
- [Finding Schema](ctis-finding.md) - Finding definitions
- [Dependency Schema](ctis-dependency.md) - SBOM dependencies
