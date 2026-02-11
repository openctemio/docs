---
layout: default
title: Building Ingestion Tools
parent: Platform Guides
nav_order: 9
---
# Building Ingestion Tools

Guide for developers who want to build custom collectors, scanners, or integrations to push data into OpenCTEM.

---

## Overview

OpenCTEM supports multiple data sources through a flexible ingestion system:

| Source Type | Direction | Description | Examples |
|-------------|-----------|-------------|----------|
| `integration` | PULL | Server pulls data from external APIs | GitHub, AWS, GCP |
| `collector` | PUSH | Agent passively collects data | K8s agent, Log collector |
| `scanner` | PUSH | Agent actively scans and pushes results | Nuclei, Trivy, Slither |
| `manual` | - | User-created via UI/API | Direct API calls |

This guide focuses on building **PUSH-based tools** (collectors and scanners).

---

## Quick Start

### 1. Register Your Data Source

```bash
curl -X POST https://api.openctem.io/api/v1/sources \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-custom-scanner",
    "type": "scanner",
    "description": "Custom vulnerability scanner",
    "capabilities": ["vulnerability", "misconfiguration"]
  }'
```

Response:
```json
{
  "id": "src_abc123",
  "api_key": "oc_live_xxxxxxxxxxxxxxxxxxxx",
  "api_key_prefix": "oc_live_xxxx"
}
```

> **Important:** Save the `api_key` immediately - it's only shown once!

### 2. Push Data Using CTIS Format

```bash
curl -X POST https://api.openctem.io/api/v1/agent/ingest/ctis \
  -H "Authorization: Bearer oc_live_xxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"report": ...}'
```

**Available Ingestion Endpoints:**
| Endpoint | Format | Description |
|----------|--------|-------------|
| `/api/v1/agent/ingest/ctis` | CTIS | Native format (recommended) |
| `/api/v1/agent/ingest/sarif` | SARIF 2.1.0 | Industry standard format |
| `/api/v1/agent/ingest/recon` | Recon | Discovery/reconnaissance data |
| `/api/v1/agent/ingest/check` | - | Pre-flight fingerprint check |

---

## CTIS (CTEM Ingest Schema)

CTIS is the standard JSON format for pushing data to OpenCTEM. All collectors and scanners should output data in this format.

### Schema Structure

```json
{
  "version": "1.0",
  "metadata": {
    "id": "scan-12345",
    "timestamp": "2024-01-16T10:00:00Z",
    "duration_ms": 5000,
    "source_type": "scanner",
    "source_ref": "job-abc"
  },
  "tool": {
    "name": "my-scanner",
    "version": "1.0.0",
    "capabilities": ["vulnerability", "secret"]
  },
  "assets": [...],
  "findings": [...]
}
```

---

## Asset Schema

### Basic Asset Structure

```json
{
  "id": "asset-1",
  "type": "domain",
  "value": "api.example.com",
  "name": "API Server",
  "criticality": "high",
  "confidence": 100,
  "tags": ["production", "external"],
  "technical": {
    "domain": {
      "nameservers": ["ns1.example.com"],
      "dns_records": [
        {"type": "A", "name": "@", "value": "1.2.3.4"}
      ]
    }
  }
}
```

### Supported Asset Types

| Type | Value Example | Description |
|------|---------------|-------------|
| `domain` | `example.com` | Domain names |
| `ip_address` | `192.168.1.1` | IPv4/IPv6 addresses |
| `repository` | `github.com/org/repo` | Code repositories |
| `certificate` | `SHA256:abc123` | SSL/TLS certificates |
| `cloud_account` | `aws:123456789` | Cloud accounts |
| `compute` | `i-abc123` | Compute instances |
| `storage` | `s3://bucket` | Storage resources |
| `database` | `db-prod-01` | Database instances |
| `service` | `api-gateway` | Running services |
| `container` | `sha256:abc` | Container images |
| `kubernetes` | `ns/deployment/app` | K8s resources |
| `network` | `vpc-123` | Network resources |

### Web3 Asset Types

| Type | Value Example | Description |
|------|---------------|-------------|
| `smart_contract` | `0x1234...abcd` | Smart contracts |
| `wallet` | `0xabcd...1234` | Crypto wallets |
| `token` | `0x5678...efgh` | ERC-20/721/1155 tokens |
| `nft_collection` | `0x9abc...5678` | NFT collections |
| `defi_protocol` | `uniswap-v3` | DeFi protocols |
| `blockchain` | `ethereum` | Blockchain networks |

### Web3 Asset Example

```json
{
  "type": "smart_contract",
  "value": "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
  "name": "Uniswap Token (UNI)",
  "criticality": "critical",
  "technical": {
    "web3": {
      "chain": "ethereum",
      "chain_id": 1,
      "network_type": "mainnet",
      "address": "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
      "contract": {
        "name": "Uniswap",
        "verified": true,
        "compiler_version": "v0.5.16",
        "contract_type": "erc20",
        "is_proxy": false,
        "interfaces": ["ERC20"]
      }
    }
  }
}
```

---

## Finding Schema

### Basic Finding Structure

```json
{
  "id": "finding-1",
  "type": "vulnerability",
  "title": "SQL Injection in login handler",
  "description": "User input is directly concatenated into SQL query...",
  "severity": "critical",
  "confidence": 95,
  "rule_id": "CWE-89",
  "asset_ref": "asset-1",
  "location": {
    "path": "src/auth/login.go",
    "start_line": 45,
    "end_line": 47,
    "snippet": "query := \"SELECT * FROM users WHERE id = \" + userID"
  },
  "vulnerability": {
    "cwe_id": "CWE-89",
    "cvss_score": 9.8,
    "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
  },
  "remediation": {
    "recommendation": "Use parameterized queries",
    "steps": [
      "Replace string concatenation with prepared statements",
      "Use the database/sql placeholder syntax"
    ]
  },
  "references": [
    "https://cwe.mitre.org/data/definitions/89.html"
  ]
}
```

### Finding Types

| Type | Description | Details Field |
|------|-------------|---------------|
| `vulnerability` | Code/infra vulnerabilities | `vulnerability` |
| `secret` | Exposed secrets/credentials | `secret` |
| `misconfiguration` | IaC/config issues | `misconfiguration` |
| `compliance` | Compliance violations | `compliance` |
| `web3` | Smart contract vulnerabilities | `web3` |

### Finding Status

Track the lifecycle of findings:

| Status | Description |
|--------|-------------|
| `open` | Finding is active and needs attention |
| `resolved` | Finding has been fixed |
| `suppressed` | Finding is suppressed (won't be shown) |
| `false_positive` | Finding was a false positive |
| `accepted_risk` | Risk has been accepted |
| `in_progress` | Fix is in progress |

### Data Flow (Taint Tracking)

For SAST findings, include data flow traces from source to sink:

```json
{
  "data_flow": {
    "sources": [
      {"path": "src/api/user.go", "line": 25, "column": 12, "content": "req.Query(\"id\")", "label": "source", "index": 0}
    ],
    "intermediates": [
      {"path": "src/api/user.go", "line": 28, "column": 5, "content": "userID := sanitize(id)", "label": "intermediate", "index": 1}
    ],
    "sinks": [
      {"path": "src/db/query.go", "line": 45, "column": 10, "content": "db.Query(sql)", "label": "sink", "index": 2}
    ]
  }
}
```

### Suppression Info

Track why a finding was suppressed:

```json
{
  "suppression": {
    "state": "suppressed",
    "reason": "Test code only",
    "justification": "This code is only used in test environment and not accessible in production",
    "suppressed_by": "security@example.com",
    "suppressed_at": "2024-01-16T10:00:00Z",
    "expires_at": "2024-07-16T10:00:00Z"
  }
}
```

### Severity Levels

| Severity | Score | Description |
|----------|-------|-------------|
| `critical` | 10.0 | Immediate action required |
| `high` | 7.5 | Should be fixed soon |
| `medium` | 5.0 | Should be planned |
| `low` | 2.5 | Low priority |
| `info` | 0.0 | Informational |

---

## Web3 Findings

### Web3 Finding Example

```json
{
  "type": "web3",
  "title": "Reentrancy Vulnerability in withdraw()",
  "severity": "critical",
  "confidence": 95,
  "rule_id": "SWC-107",
  "location": {
    "path": "contracts/Vault.sol",
    "start_line": 45,
    "snippet": "msg.sender.call{value: amount}(\"\");"
  },
  "web3": {
    "vulnerability_class": "reentrancy",
    "swc_id": "SWC-107",
    "contract_address": "0x1234...abcd",
    "chain_id": 1,
    "chain": "ethereum",
    "function_signature": "withdraw(uint256)",
    "function_selector": "0x2e1a7d4d",
    "detection_tool": "slither",
    "detection_confidence": "high",
    "exploitable_on_mainnet": true,
    "estimated_impact_usd": 1000000,
    "reentrancy": {
      "type": "cross_function",
      "external_call": "msg.sender.call{value: amount}(\"\")",
      "state_modified_after_call": "balances[msg.sender]",
      "entry_point": "withdraw",
      "max_depth": 10
    }
  },
  "remediation": {
    "recommendation": "Follow checks-effects-interactions pattern",
    "steps": [
      "Update state before external call",
      "Use ReentrancyGuard from OpenZeppelin",
      "Consider using pull payment pattern"
    ]
  }
}
```

### Web3 Vulnerability Classes

#### Basic Vulnerabilities (SWC Registry)
| Class | SWC ID | Description |
|-------|--------|-------------|
| `reentrancy` | SWC-107 | Reentrancy attacks |
| `integer_overflow` | SWC-101 | Integer overflow |
| `integer_underflow` | SWC-101 | Integer underflow |
| `access_control` | SWC-105 | Missing access control |
| `unchecked_call` | SWC-104 | Unchecked return value |
| `delegate_call` | SWC-112 | Dangerous delegatecall |
| `self_destruct` | SWC-106 | Unprotected selfdestruct |
| `tx_origin` | SWC-115 | tx.origin authentication |
| `timestamp_dependence` | SWC-116 | Block timestamp manipulation |
| `weak_randomness` | SWC-120 | Weak sources of randomness |

#### DeFi-Specific Vulnerabilities
| Class | Description |
|-------|-------------|
| `flash_loan_attack` | Flash loan exploitation |
| `oracle_manipulation` | Price oracle manipulation |
| `front_running` | Transaction ordering exploitation |
| `sandwich_attack` | Sandwich attack vulnerability |
| `slippage_attack` | Slippage manipulation |
| `price_manipulation` | Price manipulation |
| `governance_attack` | Governance token attacks |
| `liquidity_drain` | Liquidity pool exploitation |
| `mev_vulnerability` | MEV extraction vulnerability |

#### Token-Specific Vulnerabilities
| Class | Description |
|-------|-------------|
| `honeypot` | Token is a honeypot |
| `hidden_mint` | Hidden minting capability |
| `hidden_fee` | Hidden transfer fees |
| `blacklist_abuse` | Blacklist function abuse |
| `fake_renounce` | Fake ownership renouncement |

---

## Supported Input Formats

### SARIF (Static Analysis Results Interchange Format)

CTIS can convert SARIF output from popular tools:

**Supported SAST Tools:**
- Semgrep
- CodeQL
- Bandit
- Gosec
- ESLint
- SonarQube

**Supported Secret Scanners:**
- Gitleaks
- TruffleHog
- Detect-secrets

**Supported IaC Scanners:**
- Trivy
- Checkov
- TFSec
- Terrascan
- KICS

**Supported Web3 Scanners:**
- Slither (Trail of Bits)
- Mythril (ConsenSys)
- Securify (ETH Zurich)
- Manticore (Trail of Bits)
- Echidna (Trail of Bits)
- Aderyn (Cyfrin)
- Foundry
- MythX
- Certora

### Direct SARIF Ingestion (Recommended)

OpenCTEM supports direct SARIF 2.1.0 ingestion - no conversion needed:

```bash
# Push SARIF directly to OpenCTEM
curl -X POST https://api.openctem.io/api/v1/ingest/sarif \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "ws-abc123",
    "sarif": {...},
    "options": {
      "auto_resolve_assets": true,
      "dedup_strategy": "fingerprint"
    }
  }'
```

### SARIF Structure

Standard SARIF 2.1.0 format supported:

```json
{
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "semgrep",
          "version": "1.45.0",
          "rules": [
            {
              "id": "python.security.sql-injection",
              "name": "SQL Injection",
              "shortDescription": { "text": "SQL Injection vulnerability" },
              "fullDescription": { "text": "User input is directly concatenated..." },
              "defaultConfiguration": { "level": "error" },
              "properties": {
                "tags": ["security", "injection", "cwe-89"]
              }
            }
          ]
        }
      },
      "results": [
        {
          "ruleId": "python.security.sql-injection",
          "level": "error",
          "message": { "text": "Possible SQL injection" },
          "locations": [
            {
              "physicalLocation": {
                "artifactLocation": { "uri": "src/db/query.py" },
                "region": {
                  "startLine": 45,
                  "endLine": 47,
                  "snippet": { "text": "cursor.execute(f\"SELECT * FROM users WHERE id = {user_id}\")" }
                }
              }
            }
          ],
          "fingerprints": {
            "primaryLocationLineHash": "abc123def456"
          }
        }
      ]
    }
  ]
}
```

### SARIF Level to Severity Mapping

| SARIF Level | CTIS Severity |
|-------------|--------------|
| `error` | `high` |
| `warning` | `medium` |
| `note` | `low` |
| `none` | `info` |

### Tool-Specific SARIF Examples

**Semgrep:**
```bash
# Run Semgrep with SARIF output
semgrep --config auto --sarif -o results.sarif .

# Push to OpenCTEM
curl -X POST https://api.openctem.io/api/v1/ingest/sarif \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"sarif\": $(cat results.sarif)}"
```

**CodeQL:**
```bash
# Run CodeQL with SARIF output
codeql database analyze /path/to/db --format=sarif-latest --output=results.sarif

# Push to OpenCTEM
curl -X POST https://api.openctem.io/api/v1/ingest/sarif \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"sarif\": $(cat results.sarif)}"
```

**Trivy:**
```bash
# Run Trivy with SARIF output
trivy fs --format sarif --output results.sarif .

# Push to OpenCTEM
curl -X POST https://api.openctem.io/api/v1/ingest/sarif \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"sarif\": $(cat results.sarif)}"
```

**Gitleaks:**
```bash
# Run Gitleaks with SARIF output
gitleaks detect --report-format sarif --report-path results.sarif

# Push to OpenCTEM
curl -X POST https://api.openctem.io/api/v1/ingest/sarif \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"sarif\": $(cat results.sarif)}"
```

### SARIF Ingestion Options

```json
{
  "sarif": {...},
  "options": {
    "auto_resolve_assets": true,
    "dedup_strategy": "fingerprint",
    "asset_type": "repository",
    "asset_value": "github.com/org/repo",
    "workspace_id": "ws-abc123"
  }
}
```

| Option | Description | Default |
|--------|-------------|---------|
| `auto_resolve_assets` | Automatically create assets from locations | `true` |
| `dedup_strategy` | `fingerprint` or `rule_location` | `fingerprint` |
| `asset_type` | Default asset type if not resolved | `repository` |
| `asset_value` | Default asset value if not resolved | - |
| `workspace_id` | Target workspace | Required |

### Converting SARIF to CTIS (Alternative)

If you prefer programmatic conversion:

```go
import (
    "github.com/openctemio/sdk-go/pkg/ctis"
    "github.com/openctemio/sdk-go/pkg/ctis/sarif"
)

// Parse SARIF
sarifParser := sarif.NewParser(nil)
sarifLog, err := sarifParser.ParseFile("semgrep-results.sarif")

// Convert to CTIS
ctisReport := ctis.FromSARIF(sarifLog, &ctis.SARIFConvertOptions{
    AssetValue:   "github.com/org/repo",
    AssetType:    ctis.AssetTypeRepository,
    IncludeAsset: true,
})

// Send to OpenCTEM
// ... POST to /api/v1/ingest/findings
```

---

## Building with Go

### Using the CTIS Package

```go
package main

import (
    "github.com/openctemio/sdk-go/pkg/ctis"
)

func main() {
    // Build a report programmatically
    report := ctis.NewReportBuilder().
        WithTool("my-scanner", "1.0.0").
        WithToolCapabilities("vulnerability", "web3").
        WithMetadata("scan-001", "scanner", "job-123").
        AddAsset(
            ctis.NewAssetBuilder(ctis.AssetTypeSmartContract, "0x1234...abcd").
                WithName("MyToken").
                WithCriticality(ctis.CriticalityCritical).
                WithProperty("chain_id", 1).
                Build(),
        ).
        AddFinding(
            ctis.NewFindingBuilder(ctis.FindingTypeWeb3, "Reentrancy Vulnerability", ctis.SeverityCritical).
                WithRuleID("SWC-107").
                WithDescription("External call before state update").
                WithLocation("contracts/Token.sol", 45, 50).
                WithConfidence(95).
                Build(),
        ).
        Build()

    // Serialize to JSON
    data, _ := json.Marshal(report)

    // Send to OpenCTEM API
    // ...
}
```

### Web3 Scanner Example

```go
package main

import (
    "github.com/openctemio/sdk-go/pkg/ctis"
)

func buildWeb3Finding() ctis.Finding {
    return ctis.NewFindingBuilder(
        ctis.FindingTypeWeb3,
        "Flash Loan Attack Vector",
        ctis.SeverityCritical,
    ).
    WithRuleID("DEFI-001").
    WithDescription("Protocol is vulnerable to flash loan price manipulation").
    WithLocation("contracts/Lending.sol", 120, 145).
    WithConfidence(90).
    WithProperty("web3", map[string]any{
        "vulnerability_class": string(ctis.Web3VulnFlashLoan),
        "contract_address":    "0x1234...abcd",
        "chain_id":            1,
        "chain":               "ethereum",
        "function_signature":  "borrow(uint256,uint256)",
        "detection_tool":      "custom-analyzer",
        "exploitable_on_mainnet": true,
        "estimated_impact_usd": 5000000,
        "flash_loan": map[string]any{
            "provider":            "aave",
            "attack_type":         "price_manipulation",
            "required_capital_usd": 0,
            "potential_profit_usd": 500000,
            "attack_steps": []string{
                "Take flash loan from Aave",
                "Swap large amount to manipulate price",
                "Borrow at manipulated price",
                "Swap back to original token",
                "Repay flash loan with profit",
            },
        },
    }).
    Build()
}
```

---

## Building with Python

### Basic Scanner

```python
import json
import requests
from datetime import datetime

def create_ctis_report(findings):
    """Create a CTIS report from findings."""
    return {
        "version": "1.0",
        "metadata": {
            "id": f"scan-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "source_type": "scanner"
        },
        "tool": {
            "name": "my-python-scanner",
            "version": "1.0.0",
            "capabilities": ["vulnerability"]
        },
        "findings": findings
    }

def push_to.openctem(report, api_key):
    """Push CTIS report to OpenCTEM."""
    response = requests.post(
        "https://api.openctem.io/api/v1/ingest/findings",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        json=report
    )
    return response.json()

# Example finding
finding = {
    "type": "vulnerability",
    "title": "Hardcoded Password",
    "severity": "high",
    "confidence": 100,
    "rule_id": "SEC-001",
    "location": {
        "path": "src/config.py",
        "start_line": 10
    },
    "vulnerability": {
        "cwe_id": "CWE-798"
    }
}

report = create_ctis_report([finding])
result = push_to.openctem(report, "oc_live_xxxx")
print(result)
```

### Web3 Scanner with Slither Integration

```python
import subprocess
import json
from datetime import datetime

def run_slither(contract_path):
    """Run Slither and get results."""
    result = subprocess.run(
        ["slither", contract_path, "--json", "-"],
        capture_output=True,
        text=True
    )
    return json.loads(result.stdout)

def convert_slither_to_ctis(slither_output, contract_address, chain_id=1):
    """Convert Slither output to CTIS format."""
    findings = []

    for detector in slither_output.get("results", {}).get("detectors", []):
        finding = {
            "type": "web3",
            "title": detector["check"],
            "description": detector["description"],
            "severity": map_slither_impact(detector["impact"]),
            "confidence": map_slither_confidence(detector["confidence"]),
            "rule_id": f"SLITHER-{detector['check'].upper()}",
            "location": {
                "path": detector["elements"][0]["source_mapping"]["filename_short"],
                "start_line": detector["elements"][0]["source_mapping"]["lines"][0]
            } if detector.get("elements") else None,
            "web3": {
                "vulnerability_class": map_slither_to_swc(detector["check"]),
                "swc_id": detector.get("id"),
                "contract_address": contract_address,
                "chain_id": chain_id,
                "detection_tool": "slither",
                "detection_confidence": detector["confidence"]
            }
        }
        findings.append(finding)

    return {
        "version": "1.0",
        "metadata": {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "source_type": "scanner"
        },
        "tool": {
            "name": "slither",
            "version": slither_output.get("version", "unknown"),
            "capabilities": ["web3"]
        },
        "findings": findings
    }

def map_slither_impact(impact):
    """Map Slither impact to CTIS severity."""
    mapping = {
        "High": "critical",
        "Medium": "high",
        "Low": "medium",
        "Informational": "info"
    }
    return mapping.get(impact, "medium")

def map_slither_confidence(confidence):
    """Map Slither confidence to CTIS confidence."""
    mapping = {"High": 95, "Medium": 70, "Low": 40}
    return mapping.get(confidence, 70)

def map_slither_to_swc(check):
    """Map Slither check to vulnerability class."""
    mapping = {
        "reentrancy-eth": "reentrancy",
        "reentrancy-no-eth": "reentrancy",
        "arbitrary-send": "access_control",
        "controlled-delegatecall": "delegate_call",
        "suicidal": "self_destruct",
        "tx-origin": "tx_origin",
        "timestamp": "timestamp_dependence"
    }
    return mapping.get(check, "vulnerability")
```

---

## API Reference

### Register Agent (Data Source)

```
POST /api/v1/agents
Authorization: Bearer <user_access_token>

{
  "name": "my-scanner",
  "type": "scanner",
  "description": "Custom vulnerability scanner",
  "capabilities": ["vulnerability", "secret", "web3"]
}
```

Response:
```json
{
  "id": "agt_abc123",
  "api_key": "oc_live_xxxxxxxxxxxxxxxxxxxx",
  "api_key_prefix": "oc_live_xxxx"
}
```

### Ingest CTIS Report (Primary)

```
POST /api/v1/agent/ingest/ctis
Authorization: Bearer <agent_api_key>
Content-Type: application/json

{
  "report": {
    "version": "1.0",
    "metadata": {...},
    "tool": {...},
    "assets": [...],
    "findings": [...]
  }
}
```

### Ingest SARIF Report

```
POST /api/v1/agent/ingest/sarif
Authorization: Bearer <agent_api_key>
Content-Type: application/json

<raw SARIF 2.1.0 JSON>
```

### Ingest Recon Data

```
POST /api/v1/agent/ingest/recon
Authorization: Bearer <agent_api_key>
Content-Type: application/json

{
  "scanner_name": "subfinder",
  "recon_type": "subdomain",
  "target": "example.com",
  "subdomains": [...]
}
```

### Check Fingerprints (Deduplication)

```
POST /api/v1/agent/ingest/check
Authorization: Bearer <agent_api_key>
Content-Type: application/json

{
  "fingerprints": ["fp1", "fp2", "fp3"]
}
```

Response:
```json
{
  "existing": ["fp1"],
  "missing": ["fp2", "fp3"]
}
```

### Heartbeat

```
POST /api/v1/agent/heartbeat
Authorization: Bearer <agent_api_key>

{
  "status": "active",
  "version": "1.0.0",
  "hostname": "scanner-01"
}
```

---

## Best Practices

### 1. Idempotent Submissions

Use unique IDs and fingerprints to enable deduplication:

```json
{
  "id": "finding-abc123",
  "fingerprint": "sha256:xxxx",
  ...
}
```

### 2. Batch Submissions

Send findings in batches for efficiency:

```json
{
  "findings": [
    {"id": "1", ...},
    {"id": "2", ...},
    // Up to 1000 findings per batch
  ]
}
```

### 3. Heartbeats

Send regular heartbeats to indicate source is active:

```python
import time
import threading

def heartbeat_loop(api_key, interval=60):
    while True:
        requests.post(
            "https://api.openctem.io/api/v1/ingest/heartbeat",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"status": "active"}
        )
        time.sleep(interval)

# Run in background
threading.Thread(target=heartbeat_loop, args=(API_KEY,), daemon=True).start()
```

### 4. Error Handling

Handle API errors gracefully:

```python
response = requests.post(url, json=data)

if response.status_code == 429:
    # Rate limited - exponential backoff
    time.sleep(2 ** retry_count)
elif response.status_code == 401:
    # Invalid/expired API key
    refresh_api_key()
elif response.status_code >= 500:
    # Server error - retry
    retry_with_backoff()
```

### 5. Asset Linking

Link findings to specific assets:

```json
{
  "assets": [
    {"id": "asset-1", "type": "smart_contract", "value": "0x1234..."}
  ],
  "findings": [
    {"asset_ref": "asset-1", "title": "Reentrancy", ...}
  ]
}
```

---

## Example: Complete Web3 Scanner

See the full example at: [github.com/openctemio/examples/web3-scanner](https://github.com/openctemio/examples)

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
    "os"
    "os/exec"

    "github.com/openctemio/sdk-go/pkg/ctis"
)

func main() {
    apiKey := os.Getenv("API_KEY")
    contractPath := os.Args[1]
    contractAddress := os.Args[2]
    chainID := 1 // Ethereum mainnet

    // Run Slither
    slitherOutput := runSlither(contractPath)

    // Build CTIS report
    report := ctis.NewReportBuilder().
        WithTool("web3-scanner", "1.0.0").
        WithToolCapabilities("web3").
        AddAsset(
            ctis.NewAssetBuilder(ctis.AssetTypeSmartContract, contractAddress).
                WithCriticality(ctis.CriticalityCritical).
                WithProperty("chain_id", chainID).
                Build(),
        ).
        Build()

    // Convert Slither findings
    for _, detector := range slitherOutput.Detectors {
        finding := convertSlitherDetector(detector, contractAddress, chainID)
        report.Findings = append(report.Findings, finding)
    }

    // Push to OpenCTEM
    pushToOpenCTEM(report, apiKey)
}

func pushToOpenCTEM(report *ctis.Report, apiKey string) error {
    data, _ := json.Marshal(report)

    req, _ := http.NewRequest("POST",
        "https://api.openctem.io/api/v1/ingest/findings",
        bytes.NewBuffer(data))
    req.Header.Set("Authorization", "Bearer "+apiKey)
    req.Header.Set("Content-Type", "application/json")

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("API error: %d", resp.StatusCode)
    }
    return nil
}
```

---

## Related Documentation

- [Data Sources Architecture](../architecture/)
- [API Reference](../backend/api-reference.md)
- [Authentication Guide](./authentication.md)
