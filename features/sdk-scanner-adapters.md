---
layout: default
title: SDK Scanner Adapters
parent: Features
nav_order: 23
---

# SDK Scanner Adapters

> **Status**: Implemented
> **Version**: v1.0
> **Released**: 2026-03

## Overview

Pre-built adapters in the Go SDK that normalize output from popular open-source security scanners into the OpenCTEM unified finding format. Each adapter parses the scanner's native output and produces structured findings ready for ingestion.

## Supported Adapters

| Adapter | Scanner | Input Format | Finding Types | Tests |
|---------|---------|-------------|---------------|-------|
| **Trivy** | Trivy | JSON | Vulnerability (CVE), Misconfiguration, Secret | Yes |
| **Semgrep** | Semgrep | JSON | SAST findings with data flow | Yes |
| **Nuclei** | Nuclei | JSONL | DAST findings with request/response | Yes |
| **Gitleaks** | Gitleaks | JSON | Secret/credential detection | Yes |
| **SARIF** | Any SARIF-compatible tool | SARIF v2.1.0 | Generic (adapts to source tool) | Planned |

## Architecture

```
Scanner Output (JSON/JSONL/SARIF)
         │
         ▼
┌─────────────────┐
│  SDK Adapter     │  Parses native format
│  (e.g., Trivy)   │  Maps fields to OpenCTEM schema
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Unified Finding │  title, severity, cve_id, fingerprint,
│  Format          │  affected_asset, remediation, evidence
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Ingest API      │  POST /api/v1/ingest/findings
│  (Bulk)          │  Deduplication, enrichment, storage
└─────────────────┘
```

## Location

All adapters are in `sdk-go/pkg/adapters/`:

```
sdk-go/pkg/adapters/
├── trivy/
│   ├── adapter.go          # Trivy JSON → findings
│   └── adapter_test.go
├── semgrep/
│   ├── adapter.go          # Semgrep JSON → findings
│   └── adapter_test.go
├── nuclei/
│   ├── adapter.go          # Nuclei JSONL → findings
│   └── adapter_test.go
├── gitleaks/
│   ├── adapter.go          # Gitleaks JSON → findings
│   └── adapter_test.go
└── sarif/
    └── adapter.go          # Generic SARIF → findings
```

## Usage

### Trivy Adapter

```go
import "github.com/openctemio/sdk-go/pkg/adapters/trivy"

adapter := trivy.NewAdapter()
findings, err := adapter.Parse(trivyOutputBytes)
// findings is []openctem.Finding
```

### Semgrep Adapter

```go
import "github.com/openctemio/sdk-go/pkg/adapters/semgrep"

adapter := semgrep.NewAdapter()
findings, err := adapter.Parse(semgrepOutputBytes)
```

### Nuclei Adapter

```go
import "github.com/openctemio/sdk-go/pkg/adapters/nuclei"

adapter := nuclei.NewAdapter()
// Nuclei outputs JSONL (one JSON object per line)
findings, err := adapter.Parse(nucleiOutputBytes)
```

### Generic SARIF Adapter

```go
import "github.com/openctemio/sdk-go/pkg/adapters/sarif"

adapter := sarif.NewAdapter()
// Works with any SARIF v2.1.0 output (CodeQL, Snyk, Checkmarx, etc.)
findings, err := adapter.Parse(sarifOutputBytes)
```

## Adapter Interface

All adapters implement a common interface:

```go
type Adapter interface {
    // Parse converts scanner-specific output to unified findings
    Parse(data []byte) ([]Finding, error)
    // Name returns the adapter name (e.g., "trivy")
    Name() string
}
```

## Field Mapping

### Trivy

| Trivy Field | OpenCTEM Field |
|-------------|----------------|
| `VulnerabilityID` | `cve_id` |
| `Severity` | `severity` |
| `Title` | `title` |
| `Description` | `description` |
| `FixedVersion` | `remediation` |
| `PkgName` + `InstalledVersion` | `affected_component` |
| `PrimaryURL` | `references` |

### Semgrep

| Semgrep Field | OpenCTEM Field |
|---------------|----------------|
| `check_id` | `rule_id` |
| `extra.severity` | `severity` |
| `extra.message` | `description` |
| `path` + `start.line` | `location` |
| `extra.dataflow_trace` | `data_flow` (SARIF codeFlows) |

### Nuclei

| Nuclei Field | OpenCTEM Field |
|-------------|----------------|
| `template-id` | `rule_id` |
| `info.severity` | `severity` |
| `info.name` | `title` |
| `matched-at` | `affected_asset` |
| `curl-command` | `evidence` |
| `info.reference` | `references` |

## Integration with Platform Agents

Adapters are used inside platform agent scan jobs:

```
Platform Agent receives scan job
  → Runs scanner (e.g., trivy image myapp:latest -f json)
    → Adapter parses output
      → Agent submits findings via Ingest API
```

## Adding a New Adapter

1. Create directory `sdk-go/pkg/adapters/{scanner}/`
2. Implement `Adapter` interface in `adapter.go`
3. Map scanner fields to OpenCTEM finding schema
4. Add tests with sample scanner output in `adapter_test.go`
5. Register in adapter registry (if using auto-detection)

## Related Documentation

- [Platform Agents](platform-agents.md) — Agent architecture and job execution
- [Finding Types & Fingerprinting](finding-types.md) — How findings are stored and deduplicated
- [Data Flow Tracking](data-flow-tracking.md) — SARIF codeFlows support
