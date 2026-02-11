---
layout: default
title: CTIS Schema Reference
nav_order: 20
has_children: true
---

# CTIS Schema Reference

> **Version**: 1.0
> **Last Updated**: 2026-01-29

CTEM Ingest Schema (CTIS) is the standard format for ingesting security data into OpenCTEM. This document provides comprehensive documentation of all schema fields.

---

## Schema Files

| Schema | Description | Location |
|--------|-------------|----------|
| [Report](ctis-report.md) | Root document containing assets and findings | `schemas/ctis/v1/report.json` |
| [Asset](ctis-asset.md) | Discovered assets (domains, IPs, repos, etc.) | `schemas/ctis/v1/asset.json` |
| [Finding](ctis-finding.md) | Security findings (vulnerabilities, secrets, etc.) | `schemas/ctis/v1/finding.json` |
| [Dependency](ctis-dependency.md) | Software dependencies (SBOM) | `schemas/ctis/v1/dependency.json` |
| [Web3 Asset](ctis-web3-asset.md) | Web3/blockchain asset details | `schemas/ctis/v1/web3-asset.json` |
| [Web3 Finding](ctis-web3-finding.md) | Smart contract vulnerabilities | `schemas/ctis/v1/web3-finding.json` |

---

## Quick Start

### Minimal Report Example

```json
{
  "version": "1.0",
  "metadata": {
    "timestamp": "2026-01-29T10:00:00Z",
    "source_type": "scanner"
  },
  "tool": {
    "name": "semgrep",
    "version": "1.50.0"
  },
  "findings": [
    {
      "type": "vulnerability",
      "title": "SQL Injection",
      "severity": "high",
      "rule_id": "go/sql-injection",
      "location": {
        "path": "handlers/user.go",
        "start_line": 35
      }
    }
  ]
}
```

### Full Report Example with DataFlow

```json
{
  "version": "1.0",
  "metadata": {
    "id": "scan-123",
    "timestamp": "2026-01-29T10:00:00Z",
    "source_type": "scanner",
    "coverage_type": "full",
    "branch": {
      "name": "main",
      "is_default_branch": true,
      "commit_sha": "abc123",
      "repository_url": "github.com/org/repo"
    }
  },
  "tool": {
    "name": "codeql",
    "version": "2.15.0",
    "capabilities": ["sast", "taint_tracking", "cross_file_analysis"]
  },
  "findings": [
    {
      "type": "vulnerability",
      "title": "SQL Injection",
      "severity": "critical",
      "confidence": 95,
      "rule_id": "go/sql-injection",
      "location": {
        "path": "handlers/user.go",
        "start_line": 35,
        "snippet": "db.Query(query)"
      },
      "vulnerability": {
        "cwe_ids": ["CWE-89"],
        "cvss_score": 9.8
      },
      "data_flow": {
        "sources": [
          {
            "path": "handlers/user.go",
            "line": 25,
            "type": "source",
            "function": "CreateUser",
            "content": "username := r.FormValue(\"username\")"
          }
        ],
        "intermediates": [
          {
            "path": "handlers/user.go",
            "line": 30,
            "type": "propagator",
            "content": "query := fmt.Sprintf(\"SELECT * FROM users WHERE name='%s'\", username)"
          }
        ],
        "sinks": [
          {
            "path": "handlers/user.go",
            "line": 35,
            "type": "sink",
            "function": "Query",
            "content": "db.Query(query)"
          }
        ],
        "tainted": true,
        "interprocedural": false,
        "cross_file": false,
        "summary": "User input flows from FormValue to SQL query"
      }
    }
  ]
}
```

---

## Schema Overview

### Report Structure

```
Report
├── version (required)
├── metadata (required)
│   ├── timestamp (required)
│   ├── id, source_type, coverage_type
│   ├── branch (git context)
│   └── scope
├── tool
│   ├── name (required)
│   ├── version, vendor, capabilities
├── assets[]
│   ├── type, value (required)
│   ├── technical (type-specific details)
│   └── services[], compliance
├── findings[]
│   ├── type, title, severity (required)
│   ├── location, vulnerability, secret, compliance
│   ├── data_flow (taint tracking)
│   └── exposure, remediation_context, business_impact
└── dependencies[]
    ├── name, version (required)
    └── ecosystem, purl, licenses
```

### Finding Types

| Type | Description | Details Object |
|------|-------------|----------------|
| `vulnerability` | Code vulnerabilities, CVEs | `vulnerability` |
| `secret` | Exposed credentials | `secret` |
| `misconfiguration` | IaC/config issues | `misconfiguration` |
| `compliance` | Compliance violations | `compliance` |
| `web3` | Smart contract issues | `web3` |

### Severity Levels

| Level | Description | CVSS Range |
|-------|-------------|------------|
| `critical` | Immediate action required | 9.0 - 10.0 |
| `high` | High priority | 7.0 - 8.9 |
| `medium` | Medium priority | 4.0 - 6.9 |
| `low` | Low priority | 0.1 - 3.9 |
| `info` | Informational | 0.0 |

---

## Related Documentation

- [Data Flow Tracking](../features/data-flow-tracking.md) - DataFlow schema usage
- [Finding Types](../features/finding-types.md) - Finding type system
- [SDK Quick Start](../guides/sdk-quick-start.md) - Using CTIS with the SDK
