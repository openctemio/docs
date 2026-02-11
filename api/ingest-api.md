---
layout: default
title: Ingest API Reference
nav_order: 10
---

# Ingest API Reference

API endpoints để nhập dữ liệu security (assets, findings) vào hệ thống OpenCTEM.

**Base URL**: `/api/v1`

**Authentication**: Tất cả endpoints yêu cầu API Key qua header:
- `Authorization: Bearer <api_key>` (khuyên dùng)
- `X-API-Key: <api_key>` (thay thế)

---

## Tổng quan Endpoints

| Endpoint | Method | Mô tả |
|----------|--------|-------|
| [`/agent/ingest/ctis`](#1-ingest-ctis) | POST | Nhập báo cáo CTIS (định dạng chuẩn) |
| [`/agent/ingest/sarif`](#2-ingest-sarif) | POST | Nhập kết quả SARIF 2.1.0 |
| [`/agent/ingest/recon`](#3-ingest-recon) | POST | Nhập kết quả reconnaissance |
| [`/agent/ingest/chunk`](#4-ingest-chunk) | POST | Nhập báo cáo lớn theo từng chunk |
| [`/ingest/check`](#5-check-fingerprints) | POST | Kiểm tra fingerprint đã tồn tại |
| [`/agent/heartbeat`](#6-heartbeat) | POST | Agent heartbeat |

---

## 1. Ingest CTIS

Nhập báo cáo theo định dạng CTIS (CTEM Ingest Schema).

```
POST /api/v1/agent/ingest/ctis
```

### Request Headers

```http
Authorization: Bearer <api_key>
Content-Type: application/json
Content-Encoding: gzip  # Tùy chọn, hỗ trợ gzip/zstd
```

### Input Fields

| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| `version` | string | **Yes** | Schema version (`"1.0"`) |
| `metadata.timestamp` | string | **Yes** | ISO 8601 timestamp |
| `metadata.id` | string | No | Report ID (auto-generated nếu trống) |
| `metadata.source_type` | string | No | `scanner`, `manual`, `api` |
| `metadata.coverage_type` | string | No | `full`, `incremental`, `partial` |
| `metadata.branch` | object | No | Git branch info |
| `tool.name` | string | No | Tên scanner |
| `tool.version` | string | No | Version scanner |
| `tool.capabilities[]` | array | No | Scanner capabilities |
| `assets[]` | array | No | Danh sách assets |
| `findings[]` | array | No | Danh sách findings |
| `dependencies[]` | array | No | SBOM dependencies |

### Response Fields

| Field | Type | Mô tả |
|-------|------|-------|
| `scan_id` | string | ID của scan (từ metadata.id hoặc auto-generated) |
| `assets_created` | int | Số assets mới tạo |
| `assets_updated` | int | Số assets đã cập nhật |
| `findings_created` | int | Số findings mới tạo |
| `findings_updated` | int | Số findings đã cập nhật (enriched) |
| `findings_skipped` | int | Số findings bị skip (duplicate) |
| `errors[]` | array | Danh sách lỗi (nếu có) |

---

### Asset Auto-Creation

Khi request có findings nhưng **không có assets**, hệ thống sẽ tự động tạo asset theo thứ tự ưu tiên sau:

| # | Nguồn | Điều kiện | Asset Type | Ví dụ |
|---|-------|-----------|------------|-------|
| 1 | `metadata.branch.repository_url` | URL hợp lệ | `repository` | `github.com/org/repo` |
| 2 | `findings[].asset_value` | Tất cả findings cùng 1 giá trị | Từ `asset_type` hoặc `repository` | `github.com/myorg/api` |
| 3 | `metadata.scope.name` | Scope được định nghĩa | Từ `scope.type` | `production-cluster` |
| 4 | File path inference | Paths chứa git host pattern | `repository` | `https://github.com/org/repo` |
| 5 | Tool+ScanID fallback | Tool name có sẵn | `other` | `scan:semgrep:scan-123` |

**Lưu ý quan trọng:**

1. **Priority 1 (Branch Info)**: Đây là nguồn đáng tin cậy nhất cho CI/CD scans. Luôn cung cấp `metadata.branch.repository_url` khi có thể.

2. **Priority 2 (Finding Values)**: Chỉ tạo asset nếu TẤT CẢ findings có cùng `asset_value`. Nếu findings có nhiều giá trị khác nhau, hệ thống sẽ bỏ qua priority này.

3. **Priority 4 (Path Inference)**: Hỗ trợ các patterns:
   - `github.com/org/repo/...`
   - `gitlab.com/org/repo/...`
   - `bitbucket.org/org/repo/...`
   - Common path prefix detection cho local scans

4. **Priority 5 (Fallback)**: Đảm bảo findings không bao giờ bị orphan. Asset được tạo với format `scan:<tool_name>:<scan_id>`.

**Auto-created assets có properties:**
```json
{
  "auto_created": true,
  "source": "branch_info|finding_asset_value|scope|path_inference|tool_fallback"
}
```

---

### Ví dụ 1: Minimal Report (Chỉ metadata bắt buộc)

**Request:**
```json
{
  "version": "1.0",
  "metadata": {
    "timestamp": "2026-01-29T10:00:00Z"
  }
}
```

**Response (201 Created):**
```json
{
  "scan_id": "auto-generated-uuid",
  "assets_created": 0,
  "assets_updated": 0,
  "findings_created": 0,
  "findings_updated": 0,
  "findings_skipped": 0,
  "errors": []
}
```

---

### Ví dụ 2: SAST Finding với DataFlow (SQL Injection)

**Request:**
```json
{
  "version": "1.0",
  "metadata": {
    "id": "sast-scan-001",
    "timestamp": "2026-01-29T10:00:00Z",
    "source_type": "scanner",
    "coverage_type": "full",
    "branch": {
      "name": "main",
      "is_default_branch": true,
      "commit_sha": "abc123def456789",
      "commit_author": "dev@example.com",
      "commit_message": "Add user authentication",
      "repository_url": "github.com/myorg/myrepo"
    }
  },
  "tool": {
    "name": "codeql",
    "version": "2.15.0",
    "vendor": "GitHub",
    "capabilities": ["sast", "taint_tracking", "cross_file_analysis", "interprocedural_analysis"]
  },
  "findings": [
    {
      "type": "vulnerability",
      "title": "SQL Injection in user lookup",
      "severity": "critical",
      "confidence": 95,
      "rule_id": "go/sql-injection",
      "message": "User-controlled data from HTTP request flows to SQL query without sanitization",
      "location": {
        "path": "internal/handlers/user.go",
        "start_line": 45,
        "end_line": 45,
        "start_column": 12,
        "end_column": 35,
        "snippet": "db.Query(\"SELECT * FROM users WHERE name='\" + username + \"'\")"
      },
      "vulnerability": {
        "cwe_ids": ["CWE-89"],
        "cvss_score": 9.8,
        "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
        "owasp_category": "A03:2021-Injection"
      },
      "data_flow": {
        "sources": [
          {
            "path": "internal/handlers/user.go",
            "line": 25,
            "column": 15,
            "type": "source",
            "function": "GetUser",
            "content": "username := r.URL.Query().Get(\"username\")",
            "label": "username"
          }
        ],
        "intermediates": [
          {
            "path": "internal/handlers/user.go",
            "line": 30,
            "type": "propagator",
            "content": "sanitized := strings.TrimSpace(username)",
            "label": "sanitized"
          },
          {
            "path": "internal/handlers/user.go",
            "line": 40,
            "type": "propagator",
            "function": "buildQuery",
            "content": "query := \"SELECT * FROM users WHERE name='\" + sanitized + \"'\"",
            "label": "query"
          }
        ],
        "sinks": [
          {
            "path": "internal/handlers/user.go",
            "line": 45,
            "column": 12,
            "type": "sink",
            "function": "Query",
            "content": "db.Query(query)",
            "label": "db.Query"
          }
        ],
        "tainted": true,
        "interprocedural": false,
        "cross_file": false,
        "call_path": ["GetUser", "buildQuery", "db.Query"],
        "summary": "User input from URL query parameter flows through string concatenation to SQL query"
      },
      "recommendation": "Use parameterized queries: db.Query(\"SELECT * FROM users WHERE name = $1\", username)",
      "references": [
        "https://owasp.org/www-community/attacks/SQL_Injection",
        "https://cwe.mitre.org/data/definitions/89.html"
      ],
      "tags": ["sql-injection", "user-input", "database"]
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "scan_id": "sast-scan-001",
  "assets_created": 0,
  "assets_updated": 0,
  "findings_created": 1,
  "findings_updated": 0,
  "findings_skipped": 0,
  "errors": []
}
```

---

### Ví dụ 3: Cross-File DataFlow (Interprocedural Analysis)

**Request:**
```json
{
  "version": "1.0",
  "metadata": {
    "id": "cross-file-scan",
    "timestamp": "2026-01-29T10:00:00Z",
    "coverage_type": "full",
    "branch": {
      "name": "main",
      "is_default_branch": true
    }
  },
  "tool": {
    "name": "codeql",
    "version": "2.15.0"
  },
  "findings": [
    {
      "type": "vulnerability",
      "title": "Command Injection via user input",
      "severity": "critical",
      "rule_id": "go/command-injection",
      "location": {
        "path": "pkg/executor/runner.go",
        "start_line": 78,
        "snippet": "exec.Command(\"bash\", \"-c\", cmd)"
      },
      "vulnerability": {
        "cwe_ids": ["CWE-78"],
        "cvss_score": 9.8
      },
      "data_flow": {
        "sources": [
          {
            "path": "internal/api/handler.go",
            "line": 42,
            "type": "source",
            "function": "HandleRequest",
            "content": "userCmd := req.Body.Command",
            "label": "userCmd"
          }
        ],
        "intermediates": [
          {
            "path": "internal/api/handler.go",
            "line": 50,
            "type": "propagator",
            "function": "ProcessCommand",
            "content": "processed := ProcessCommand(userCmd)",
            "label": "processed"
          },
          {
            "path": "internal/service/command.go",
            "line": 25,
            "type": "propagator",
            "function": "ValidateCommand",
            "content": "validated := ValidateCommand(processed)",
            "label": "validated"
          },
          {
            "path": "pkg/executor/runner.go",
            "line": 65,
            "type": "propagator",
            "function": "PrepareExecution",
            "content": "cmd := PrepareExecution(validated)",
            "label": "cmd"
          }
        ],
        "sinks": [
          {
            "path": "pkg/executor/runner.go",
            "line": 78,
            "type": "sink",
            "function": "Command",
            "content": "exec.Command(\"bash\", \"-c\", cmd)"
          }
        ],
        "tainted": true,
        "interprocedural": true,
        "cross_file": true,
        "call_path": [
          "HandleRequest (internal/api/handler.go:42)",
          "ProcessCommand (internal/api/handler.go:50)",
          "ValidateCommand (internal/service/command.go:25)",
          "PrepareExecution (pkg/executor/runner.go:65)",
          "exec.Command (pkg/executor/runner.go:78)"
        ],
        "summary": "User input from API request flows through 3 files to shell command execution"
      }
    }
  ]
}
```

---

### Ví dụ 4: Secret Detection

**Request:**
```json
{
  "version": "1.0",
  "metadata": {
    "id": "secret-scan-001",
    "timestamp": "2026-01-29T10:00:00Z",
    "source_type": "scanner"
  },
  "tool": {
    "name": "gitleaks",
    "version": "8.18.0",
    "capabilities": ["secret_detection"]
  },
  "findings": [
    {
      "type": "secret",
      "title": "AWS Access Key exposed in source code",
      "severity": "critical",
      "confidence": 100,
      "rule_id": "aws-access-key-id",
      "message": "AWS Access Key ID found in configuration file",
      "location": {
        "path": "config/aws.go",
        "start_line": 15,
        "snippet": "AccessKeyID: \"AKIA...[REDACTED]\""
      },
      "secret": {
        "type": "aws_access_key",
        "service": "AWS",
        "masked_value": "AKIA************WXYZ",
        "entropy": 4.5,
        "verified": true,
        "verification_status": "active",
        "revoked": false,
        "commit_sha": "abc123",
        "commit_author": "dev@example.com",
        "commit_date": "2026-01-15T08:30:00Z",
        "first_detected_at": "2026-01-29T10:00:00Z"
      },
      "recommendation": "1. Immediately rotate the AWS credentials\n2. Use AWS Secrets Manager or environment variables\n3. Add config/*.go to .gitignore",
      "tags": ["aws", "credentials", "high-entropy"]
    },
    {
      "type": "secret",
      "title": "GitHub Personal Access Token",
      "severity": "high",
      "rule_id": "github-pat",
      "location": {
        "path": ".env.example",
        "start_line": 8,
        "snippet": "GITHUB_TOKEN=ghp_...[REDACTED]"
      },
      "secret": {
        "type": "github_pat",
        "service": "GitHub",
        "masked_value": "ghp_****************************abcd",
        "verified": true,
        "verification_status": "active",
        "scopes": ["repo", "read:org"],
        "expires_at": "2026-06-01T00:00:00Z"
      }
    },
    {
      "type": "secret",
      "title": "Private RSA Key",
      "severity": "critical",
      "rule_id": "private-key",
      "location": {
        "path": "deploy/ssh_key",
        "start_line": 1,
        "snippet": "-----BEGIN RSA PRIVATE KEY-----"
      },
      "secret": {
        "type": "private_key",
        "service": "SSH",
        "algorithm": "RSA",
        "key_size": 2048,
        "verified": false
      }
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "scan_id": "secret-scan-001",
  "assets_created": 0,
  "assets_updated": 0,
  "findings_created": 3,
  "findings_updated": 0,
  "findings_skipped": 0,
  "errors": []
}
```

---

### Ví dụ 5: SCA (Software Composition Analysis) với Dependencies

**Request:**
```json
{
  "version": "1.0",
  "metadata": {
    "id": "sca-scan-001",
    "timestamp": "2026-01-29T10:00:00Z"
  },
  "tool": {
    "name": "trivy",
    "version": "0.50.0",
    "capabilities": ["sca", "vulnerability_scanning", "sbom"]
  },
  "dependencies": [
    {
      "id": "dep-001",
      "name": "lodash",
      "version": "4.17.20",
      "ecosystem": "npm",
      "purl": "pkg:npm/lodash@4.17.20",
      "licenses": ["MIT"],
      "relationship": "direct",
      "path": "package.json",
      "location": {
        "path": "package.json",
        "line": 15
      }
    },
    {
      "id": "dep-002",
      "name": "minimist",
      "version": "1.2.5",
      "ecosystem": "npm",
      "purl": "pkg:npm/minimist@1.2.5",
      "licenses": ["MIT"],
      "relationship": "transitive",
      "depends_on": ["dep-001"],
      "path": "package-lock.json"
    },
    {
      "id": "dep-003",
      "name": "log4j-core",
      "version": "2.14.1",
      "ecosystem": "maven",
      "purl": "pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1",
      "licenses": ["Apache-2.0"],
      "relationship": "direct",
      "path": "pom.xml",
      "properties": {
        "groupId": "org.apache.logging.log4j",
        "artifactId": "log4j-core",
        "scope": "compile"
      }
    }
  ],
  "findings": [
    {
      "type": "vulnerability",
      "title": "CVE-2021-44228: Log4Shell RCE in log4j-core",
      "severity": "critical",
      "rule_id": "CVE-2021-44228",
      "message": "Remote code execution vulnerability in Apache Log4j 2.x",
      "vulnerability": {
        "cve_id": "CVE-2021-44228",
        "cwe_ids": ["CWE-502", "CWE-400", "CWE-20"],
        "cvss_score": 10.0,
        "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
        "epss_score": 0.97565,
        "epss_percentile": 99.9,
        "package_name": "log4j-core",
        "purl": "pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1",
        "installed_version": "2.14.1",
        "fixed_version": "2.17.1",
        "dependency_path": ["my-app", "log4j-core"],
        "exploit_available": true,
        "exploit_maturity": "weaponized",
        "cisa_kev": true,
        "cisa_kev_date": "2021-12-10"
      },
      "recommendation": "Upgrade log4j-core to version 2.17.1 or later",
      "references": [
        "https://nvd.nist.gov/vuln/detail/CVE-2021-44228",
        "https://logging.apache.org/log4j/2.x/security.html"
      ]
    },
    {
      "type": "vulnerability",
      "title": "CVE-2021-23337: Prototype Pollution in lodash",
      "severity": "high",
      "rule_id": "CVE-2021-23337",
      "vulnerability": {
        "cve_id": "CVE-2021-23337",
        "cwe_ids": ["CWE-1321"],
        "cvss_score": 7.2,
        "package_name": "lodash",
        "purl": "pkg:npm/lodash@4.17.20",
        "installed_version": "4.17.20",
        "fixed_version": "4.17.21",
        "dependency_path": ["my-app", "lodash"]
      }
    }
  ]
}
```

---

### Ví dụ 6: IaC Misconfiguration (Terraform)

**Request:**
```json
{
  "version": "1.0",
  "metadata": {
    "id": "iac-scan-001",
    "timestamp": "2026-01-29T10:00:00Z"
  },
  "tool": {
    "name": "checkov",
    "version": "3.0.0",
    "capabilities": ["iac", "misconfiguration"]
  },
  "findings": [
    {
      "type": "misconfiguration",
      "title": "S3 bucket has public read access",
      "severity": "high",
      "rule_id": "CKV_AWS_20",
      "message": "S3 bucket allows public read access via ACL",
      "location": {
        "path": "terraform/s3.tf",
        "start_line": 10,
        "end_line": 15,
        "snippet": "resource \"aws_s3_bucket\" \"data\" {\n  bucket = \"my-data-bucket\"\n  acl    = \"public-read\"\n}"
      },
      "misconfiguration": {
        "policy_id": "CKV_AWS_20",
        "policy_name": "S3 Bucket Public Read ACL",
        "framework": "terraform",
        "resource_type": "aws_s3_bucket",
        "resource_name": "data",
        "resource_address": "aws_s3_bucket.data",
        "expected_value": "acl should not be 'public-read' or 'public-read-write'",
        "actual_value": "acl = 'public-read'",
        "remediation_code": "resource \"aws_s3_bucket\" \"data\" {\n  bucket = \"my-data-bucket\"\n  acl    = \"private\"\n}"
      },
      "compliance": {
        "frameworks": ["CIS-AWS-1.4", "SOC2", "PCI-DSS"],
        "controls": ["CIS-AWS-1.4-2.1.1", "SOC2-CC6.1", "PCI-DSS-3.4"]
      }
    },
    {
      "type": "misconfiguration",
      "title": "EC2 instance has no IMDSv2",
      "severity": "medium",
      "rule_id": "CKV_AWS_79",
      "location": {
        "path": "terraform/ec2.tf",
        "start_line": 1
      },
      "misconfiguration": {
        "policy_id": "CKV_AWS_79",
        "framework": "terraform",
        "resource_type": "aws_instance",
        "resource_name": "web_server",
        "expected_value": "metadata_options.http_tokens should be 'required'",
        "actual_value": "metadata_options.http_tokens is not set (defaults to 'optional')"
      }
    },
    {
      "type": "misconfiguration",
      "title": "Security group allows unrestricted SSH access",
      "severity": "critical",
      "rule_id": "CKV_AWS_24",
      "location": {
        "path": "terraform/security_groups.tf",
        "start_line": 20,
        "snippet": "ingress {\n  from_port   = 22\n  to_port     = 22\n  protocol    = \"tcp\"\n  cidr_blocks = [\"0.0.0.0/0\"]\n}"
      },
      "misconfiguration": {
        "policy_id": "CKV_AWS_24",
        "framework": "terraform",
        "resource_type": "aws_security_group",
        "expected_value": "SSH (port 22) should not be open to 0.0.0.0/0",
        "actual_value": "cidr_blocks = [\"0.0.0.0/0\"]"
      }
    }
  ]
}
```

---

### Ví dụ 7: Compliance Finding

**Request:**
```json
{
  "version": "1.0",
  "metadata": {
    "id": "compliance-scan-001",
    "timestamp": "2026-01-29T10:00:00Z"
  },
  "tool": {
    "name": "prowler",
    "version": "4.0.0",
    "capabilities": ["compliance", "cloud_security"]
  },
  "findings": [
    {
      "type": "compliance",
      "title": "MFA not enabled for root account",
      "severity": "critical",
      "rule_id": "CIS-1.5",
      "message": "Root account does not have MFA enabled",
      "compliance": {
        "framework": "CIS-AWS-1.5",
        "control_id": "1.5",
        "control_title": "Ensure MFA is enabled for the root account",
        "section": "1. Identity and Access Management",
        "result": "fail",
        "severity_source": "cis",
        "rationale": "The root account has unrestricted access. MFA adds an extra layer of protection.",
        "remediation_steps": [
          "Sign in to AWS Console as root user",
          "Navigate to IAM Dashboard",
          "Click 'Activate MFA on your root account'",
          "Choose virtual MFA device or hardware MFA"
        ],
        "evidence": {
          "account_id": "123456789012",
          "mfa_enabled": false,
          "last_login": "2026-01-28T15:30:00Z"
        }
      }
    },
    {
      "type": "compliance",
      "title": "CloudTrail not enabled in all regions",
      "severity": "high",
      "rule_id": "CIS-3.1",
      "compliance": {
        "framework": "CIS-AWS-1.5",
        "control_id": "3.1",
        "control_title": "Ensure CloudTrail is enabled in all regions",
        "section": "3. Logging",
        "result": "fail",
        "evidence": {
          "trails_found": 1,
          "multi_region_enabled": false,
          "regions_without_trail": ["eu-west-1", "ap-southeast-1", "sa-east-1"]
        }
      }
    }
  ]
}
```

---

### Ví dụ 8: Web3/Smart Contract Finding

**Request:**
```json
{
  "version": "1.0",
  "metadata": {
    "id": "web3-scan-001",
    "timestamp": "2026-01-29T10:00:00Z"
  },
  "tool": {
    "name": "slither",
    "version": "0.10.0",
    "capabilities": ["smart_contract", "solidity"]
  },
  "findings": [
    {
      "type": "vulnerability",
      "title": "Reentrancy vulnerability in withdraw function",
      "severity": "critical",
      "rule_id": "SWC-107",
      "message": "External call to msg.sender before state update",
      "location": {
        "path": "contracts/Vault.sol",
        "start_line": 45,
        "snippet": "msg.sender.call{value: amount}(\"\");\nbalances[msg.sender] = 0;"
      },
      "vulnerability": {
        "cwe_ids": ["CWE-841"]
      },
      "web3": {
        "vulnerability_class": "reentrancy",
        "swc_id": "SWC-107",
        "contract_address": "0x1234567890abcdef1234567890abcdef12345678",
        "chain_id": 1,
        "chain": "ethereum",
        "function_signature": "withdraw(uint256)",
        "function_selector": "0x2e1a7d4d",
        "exploitable_on_mainnet": true,
        "estimated_impact_usd": 5000000,
        "affected_value_usd": 15000000,
        "detection_tool": "slither",
        "detection_confidence": "high",
        "reentrancy": {
          "type": "single_function",
          "external_call": "msg.sender.call{value: amount}(\"\")",
          "state_modified_after_call": "balances[msg.sender]",
          "entry_point": "withdraw",
          "max_depth": 10
        },
        "poc": {
          "type": "foundry_test",
          "code": "function testReentrancy() public {\n  AttackContract attacker = new AttackContract(vault);\n  attacker.attack{value: 1 ether}();\n  assertGt(address(attacker).balance, 1 ether);\n}",
          "expected_outcome": "Drain contract balance",
          "tested_on": "mainnet_fork",
          "fork_block_number": 18500000
        }
      },
      "recommendation": "Use checks-effects-interactions pattern: update state before external call"
    },
    {
      "type": "vulnerability",
      "title": "Missing oracle staleness check",
      "severity": "high",
      "rule_id": "oracle-staleness",
      "location": {
        "path": "contracts/LendingPool.sol",
        "start_line": 123
      },
      "web3": {
        "vulnerability_class": "oracle_manipulation",
        "function_signature": "liquidate(address,uint256)",
        "oracle_manipulation": {
          "oracle_type": "chainlink",
          "oracle_address": "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
          "manipulation_method": "time_manipulation",
          "missing_checks": ["staleness_check", "sequencer_check"]
        }
      }
    }
  ]
}
```

---

### Ví dụ 9: Multiple Assets với Technical Details

**Request:**
```json
{
  "version": "1.0",
  "metadata": {
    "id": "asset-discovery-001",
    "timestamp": "2026-01-29T10:00:00Z"
  },
  "tool": {
    "name": "nuclei",
    "version": "3.0.0"
  },
  "assets": [
    {
      "type": "domain",
      "value": "api.example.com",
      "name": "API Gateway",
      "status": "active",
      "criticality": "critical",
      "environment": "production",
      "tags": ["api", "public-facing", "pci-scope"],
      "technical": {
        "domain": {
          "registrar": "Cloudflare",
          "created_at": "2020-01-15T00:00:00Z",
          "expires_at": "2027-01-15T00:00:00Z",
          "nameservers": ["ns1.cloudflare.com", "ns2.cloudflare.com"],
          "dnssec": true
        }
      },
      "services": [
        {
          "port": 443,
          "protocol": "tcp",
          "service": "https",
          "product": "nginx",
          "version": "1.24.0",
          "tls_version": "TLS 1.3",
          "certificate_issuer": "Let's Encrypt"
        }
      ]
    },
    {
      "type": "ip_address",
      "value": "203.0.113.50",
      "name": "Web Server 1",
      "status": "active",
      "criticality": "high",
      "technical": {
        "ip": {
          "version": "ipv4",
          "asn": 13335,
          "asn_org": "Cloudflare Inc",
          "isp": "Cloudflare",
          "country": "US",
          "city": "San Francisco",
          "is_cloud": true,
          "cloud_provider": "cloudflare"
        }
      },
      "services": [
        {
          "port": 443,
          "protocol": "tcp",
          "service": "https"
        },
        {
          "port": 22,
          "protocol": "tcp",
          "service": "ssh",
          "product": "OpenSSH",
          "version": "8.9"
        }
      ]
    },
    {
      "type": "repository",
      "value": "github.com/myorg/backend-api",
      "name": "Backend API Repository",
      "status": "active",
      "criticality": "critical",
      "technical": {
        "repository": {
          "platform": "github",
          "visibility": "private",
          "default_branch": "main",
          "languages": {"Go": 75.5, "Python": 20.0, "Shell": 4.5},
          "topics": ["api", "microservices", "go"],
          "stars": 0,
          "forks": 0,
          "open_issues": 5,
          "last_commit_at": "2026-01-28T18:30:00Z",
          "branch_protection": true,
          "require_reviews": true,
          "require_signed_commits": false
        }
      }
    },
    {
      "type": "certificate",
      "value": "api.example.com:443",
      "name": "API SSL Certificate",
      "status": "active",
      "technical": {
        "certificate": {
          "subject_cn": "api.example.com",
          "issuer_cn": "R3",
          "issuer_org": "Let's Encrypt",
          "serial_number": "0123456789abcdef",
          "not_before": "2026-01-01T00:00:00Z",
          "not_after": "2026-04-01T00:00:00Z",
          "signature_algorithm": "SHA256-RSA",
          "key_algorithm": "RSA",
          "key_size": 2048,
          "san": ["api.example.com", "*.api.example.com"],
          "is_expired": false,
          "is_self_signed": false,
          "is_wildcard": true,
          "days_until_expiry": 62
        }
      }
    },
    {
      "type": "cloud_resource",
      "value": "arn:aws:s3:::my-app-data",
      "name": "Application Data Bucket",
      "status": "active",
      "criticality": "critical",
      "technical": {
        "cloud": {
          "provider": "aws",
          "service": "s3",
          "region": "us-east-1",
          "account_id": "123456789012",
          "resource_id": "my-app-data",
          "arn": "arn:aws:s3:::my-app-data",
          "tags": {
            "Environment": "production",
            "Owner": "platform-team"
          }
        }
      }
    }
  ]
}
```

---

### Ví dụ 10: Incremental Scan (Diff-based)

**Request:**
```json
{
  "version": "1.0",
  "metadata": {
    "id": "pr-scan-12345",
    "timestamp": "2026-01-29T10:00:00Z",
    "source_type": "scanner",
    "coverage_type": "incremental",
    "branch": {
      "name": "feature/user-auth",
      "is_default_branch": false,
      "commit_sha": "def456abc789",
      "base_branch": "main",
      "base_commit_sha": "abc123def456",
      "repository_url": "github.com/myorg/myrepo",
      "pull_request_id": "12345",
      "pull_request_url": "https://github.com/myorg/myrepo/pull/12345"
    },
    "scope": {
      "paths": [
        "internal/auth/",
        "internal/handlers/login.go"
      ],
      "changed_files": 5,
      "added_lines": 150,
      "removed_lines": 20
    }
  },
  "tool": {
    "name": "semgrep",
    "version": "1.50.0"
  },
  "findings": [
    {
      "type": "vulnerability",
      "title": "Hardcoded JWT secret",
      "severity": "critical",
      "rule_id": "go/jwt-hardcoded-secret",
      "location": {
        "path": "internal/auth/jwt.go",
        "start_line": 15,
        "snippet": "secret := \"super-secret-key-123\""
      },
      "message": "JWT secret is hardcoded in source code"
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "scan_id": "pr-scan-12345",
  "assets_created": 0,
  "assets_updated": 0,
  "findings_created": 1,
  "findings_updated": 0,
  "findings_skipped": 0,
  "errors": []
}
```

> **Note**: Vì `coverage_type=incremental` và `is_default_branch=false`, auto-resolve KHÔNG được kích hoạt.

---

### Ví dụ 11: Wrapped Format (Alternative)

API hỗ trợ 2 format: flat (ví dụ trên) và wrapped.

**Request (Wrapped):**
```json
{
  "report": {
    "version": "1.0",
    "metadata": {
      "timestamp": "2026-01-29T10:00:00Z"
    },
    "tool": {
      "name": "custom-scanner"
    },
    "findings": [
      {
        "type": "vulnerability",
        "title": "Test finding",
        "severity": "medium",
        "rule_id": "test-001"
      }
    ]
  }
}
```

---

### Ví dụ 12: Error Responses

**401 Unauthorized - Missing API Key:**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "API key required"
  }
}
```

**401 Unauthorized - Invalid API Key:**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid API key"
  }
}
```

**400 Bad Request - Invalid JSON:**
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid JSON request body"
  }
}
```

**400 Bad Request - Validation Error:**
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Validation failed",
    "details": {
      "findings[0].severity": "must be one of: critical, high, medium, low, info",
      "findings[0].type": "must be one of: vulnerability, secret, misconfiguration, compliance"
    }
  }
}
```

**Response với Partial Errors:**
```json
{
  "scan_id": "scan-001",
  "assets_created": 8,
  "assets_updated": 2,
  "findings_created": 45,
  "findings_updated": 5,
  "findings_skipped": 3,
  "errors": [
    "Finding at index 12: invalid CWE format 'CWE89', expected 'CWE-89'",
    "Finding at index 25: missing required field 'title'",
    "Asset at index 5: property 'metadata.custom' exceeds 1MB limit"
  ]
}
```

---

## 2. Ingest SARIF

Nhập kết quả scan ở định dạng SARIF 2.1.0 (Static Analysis Results Interchange Format).

```
POST /api/v1/agent/ingest/sarif
```

### Request Headers

```http
Authorization: Bearer <api_key>
Content-Type: application/json
```

---

### Ví dụ 1: Basic SARIF từ CodeQL

**Request:**
```json
{
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "CodeQL",
          "version": "2.15.0",
          "semanticVersion": "2.15.0",
          "rules": [
            {
              "id": "go/sql-injection",
              "name": "SqlInjection",
              "shortDescription": {
                "text": "SQL query built from user-controlled sources"
              },
              "fullDescription": {
                "text": "Building SQL queries from user-controlled sources enables attackers to execute malicious SQL statements."
              },
              "defaultConfiguration": {
                "level": "error"
              },
              "properties": {
                "security-severity": "9.8",
                "precision": "high",
                "kind": "path-problem",
                "tags": [
                  "security",
                  "external/cwe/cwe-89"
                ]
              },
              "help": {
                "text": "Use parameterized queries instead of string concatenation.",
                "markdown": "# SQL Injection\n\nUse parameterized queries instead of string concatenation."
              }
            }
          ]
        }
      },
      "results": [
        {
          "ruleId": "go/sql-injection",
          "ruleIndex": 0,
          "level": "error",
          "kind": "fail",
          "message": {
            "text": "This query depends on a user-provided value."
          },
          "locations": [
            {
              "physicalLocation": {
                "artifactLocation": {
                  "uri": "handlers/user.go",
                  "uriBaseId": "%SRCROOT%"
                },
                "region": {
                  "startLine": 45,
                  "startColumn": 12,
                  "endLine": 45,
                  "endColumn": 35,
                  "snippet": {
                    "text": "db.Query(query)"
                  }
                },
                "contextRegion": {
                  "startLine": 43,
                  "endLine": 47,
                  "snippet": {
                    "text": "func GetUser(w http.ResponseWriter, r *http.Request) {\n    username := r.URL.Query().Get(\"username\")\n    query := \"SELECT * FROM users WHERE name = '\" + username + \"'\"\n    rows, err := db.Query(query)\n    // ..."
                  }
                }
              },
              "logicalLocations": [
                {
                  "name": "GetUser",
                  "fullyQualifiedName": "handlers.GetUser",
                  "kind": "function"
                }
              ]
            }
          ],
          "codeFlows": [
            {
              "message": {
                "text": "Taint flow from user input to SQL query"
              },
              "threadFlows": [
                {
                  "locations": [
                    {
                      "location": {
                        "physicalLocation": {
                          "artifactLocation": {
                            "uri": "handlers/user.go"
                          },
                          "region": {
                            "startLine": 25,
                            "startColumn": 5
                          }
                        },
                        "message": {
                          "text": "User input enters here"
                        }
                      },
                      "kinds": ["source"],
                      "nestingLevel": 0,
                      "importance": "essential"
                    },
                    {
                      "location": {
                        "physicalLocation": {
                          "artifactLocation": {
                            "uri": "handlers/user.go"
                          },
                          "region": {
                            "startLine": 30
                          }
                        },
                        "message": {
                          "text": "Tainted data propagates"
                        }
                      },
                      "kinds": ["pass-through"],
                      "nestingLevel": 0,
                      "importance": "important"
                    },
                    {
                      "location": {
                        "physicalLocation": {
                          "artifactLocation": {
                            "uri": "handlers/user.go"
                          },
                          "region": {
                            "startLine": 45,
                            "startColumn": 12
                          }
                        },
                        "message": {
                          "text": "Tainted data reaches SQL query"
                        }
                      },
                      "kinds": ["sink"],
                      "nestingLevel": 0,
                      "importance": "essential"
                    }
                  ]
                }
              ]
            }
          ],
          "partialFingerprints": {
            "primaryLocationLineHash": "abc123def456",
            "primaryLocationStartColumnFingerprint": "12"
          },
          "fingerprints": {
            "codeql/go/sql-injection/1": "xyz789"
          },
          "relatedLocations": [
            {
              "id": 1,
              "physicalLocation": {
                "artifactLocation": {
                  "uri": "handlers/user.go"
                },
                "region": {
                  "startLine": 25
                }
              },
              "message": {
                "text": "User input source"
              }
            }
          ]
        }
      ],
      "artifacts": [
        {
          "location": {
            "uri": "handlers/user.go"
          },
          "sourceLanguage": "go",
          "length": 2500
        }
      ]
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "scan_id": "sarif-20260129-100000",
  "assets_created": 0,
  "assets_updated": 0,
  "findings_created": 1,
  "findings_updated": 0,
  "findings_skipped": 0,
  "errors": []
}
```

---

### Ví dụ 2: SARIF từ Semgrep

**Request:**
```json
{
  "version": "2.1.0",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "Semgrep",
          "version": "1.50.0",
          "informationUri": "https://semgrep.dev",
          "rules": [
            {
              "id": "javascript.express.security.audit.xss.mustache.var-in-href",
              "name": "var-in-href",
              "shortDescription": {
                "text": "Detected a template variable in an anchor tag href"
              },
              "defaultConfiguration": {
                "level": "warning"
              },
              "properties": {
                "security-severity": "6.1",
                "tags": ["security", "xss", "owasp-a7"]
              }
            }
          ]
        }
      },
      "results": [
        {
          "ruleId": "javascript.express.security.audit.xss.mustache.var-in-href",
          "level": "warning",
          "message": {
            "text": "Detected a template variable in an anchor tag href. This allows JavaScript URIs, potentially leading to XSS."
          },
          "locations": [
            {
              "physicalLocation": {
                "artifactLocation": {
                  "uri": "views/profile.mustache"
                },
                "region": {
                  "startLine": 15,
                  "startColumn": 10,
                  "endLine": 15,
                  "endColumn": 45,
                  "snippet": {
                    "text": "<a href=\"{{userUrl}}\">Profile</a>"
                  }
                }
              }
            }
          ]
        }
      ]
    }
  ]
}
```

---

### Ví dụ 3: Multiple Runs (Multi-tool SARIF)

**Request:**
```json
{
  "version": "2.1.0",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "ESLint",
          "version": "8.50.0"
        }
      },
      "results": [
        {
          "ruleId": "no-eval",
          "level": "error",
          "message": { "text": "eval() is harmful" },
          "locations": [{
            "physicalLocation": {
              "artifactLocation": { "uri": "src/utils.js" },
              "region": { "startLine": 25 }
            }
          }]
        }
      ]
    },
    {
      "tool": {
        "driver": {
          "name": "Bandit",
          "version": "1.7.5"
        }
      },
      "results": [
        {
          "ruleId": "B101",
          "level": "warning",
          "message": { "text": "Use of assert detected" },
          "locations": [{
            "physicalLocation": {
              "artifactLocation": { "uri": "tests/test_auth.py" },
              "region": { "startLine": 42 }
            }
          }]
        }
      ]
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "scan_id": "sarif-multi-20260129",
  "assets_created": 0,
  "assets_updated": 0,
  "findings_created": 2,
  "findings_updated": 0,
  "findings_skipped": 0,
  "errors": []
}
```

---

### SARIF Mapping Reference

| SARIF Field | CTIS Field | Notes |
|-------------|-----------|-------|
| `tool.driver.name` | `tool.name` | |
| `tool.driver.version` | `tool.version` | |
| `results[].ruleId` | `finding.rule_id` | |
| `results[].level` | `finding.severity` | error→critical/high, warning→medium, note→low |
| `results[].message.text` | `finding.message` | |
| `results[].locations[].physicalLocation.artifactLocation.uri` | `finding.location.path` | |
| `results[].locations[].physicalLocation.region.startLine` | `finding.location.start_line` | |
| `results[].codeFlows` | `finding.data_flow` | Full taint tracking |
| `rules[].properties.security-severity` | `finding.cvss_score` | 0.0-10.0 |
| `rules[].properties.tags` | CWE extraction | Pattern: `external/cwe/cwe-XXX` |

---

## 3. Ingest Recon

Nhập kết quả reconnaissance (subdomain, DNS, port scan, HTTP probe).

```
POST /api/v1/agent/ingest/recon
```

---

### Ví dụ 1: Subdomain Enumeration

**Request:**
```json
{
  "scanner_name": "subfinder",
  "scanner_version": "2.6.3",
  "recon_type": "subdomain",
  "target": "example.com",
  "started_at": 1706522400,
  "finished_at": 1706522520,
  "duration_ms": 120000,
  "subdomains": [
    {
      "host": "www.example.com",
      "domain": "example.com",
      "source": "crtsh",
      "ips": ["93.184.216.34"]
    },
    {
      "host": "api.example.com",
      "domain": "example.com",
      "source": "virustotal",
      "ips": ["93.184.216.35", "93.184.216.36"]
    },
    {
      "host": "mail.example.com",
      "domain": "example.com",
      "source": "dnsdumpster"
    },
    {
      "host": "dev.example.com",
      "domain": "example.com",
      "source": "github-subdomains"
    },
    {
      "host": "staging.example.com",
      "domain": "example.com",
      "source": "wayback"
    },
    {
      "host": "internal.example.com",
      "domain": "example.com",
      "source": "bruteforce"
    }
  ]
}
```

---

### Ví dụ 2: DNS Records

**Request:**
```json
{
  "scanner_name": "dnsx",
  "scanner_version": "1.1.5",
  "recon_type": "dns",
  "target": "example.com",
  "dns_records": [
    {
      "host": "example.com",
      "record_type": "A",
      "values": ["93.184.216.34"],
      "ttl": 300,
      "resolver": "8.8.8.8",
      "status_code": "NOERROR"
    },
    {
      "host": "example.com",
      "record_type": "AAAA",
      "values": ["2606:2800:220:1:248:1893:25c8:1946"],
      "ttl": 300
    },
    {
      "host": "example.com",
      "record_type": "MX",
      "values": ["10 mail.example.com", "20 mail2.example.com"],
      "ttl": 3600
    },
    {
      "host": "example.com",
      "record_type": "TXT",
      "values": [
        "v=spf1 include:_spf.google.com ~all",
        "google-site-verification=abc123"
      ],
      "ttl": 3600
    },
    {
      "host": "example.com",
      "record_type": "NS",
      "values": ["ns1.example.com", "ns2.example.com"],
      "ttl": 86400
    },
    {
      "host": "_dmarc.example.com",
      "record_type": "TXT",
      "values": ["v=DMARC1; p=reject; rua=mailto:dmarc@example.com"],
      "ttl": 3600
    },
    {
      "host": "example.com",
      "record_type": "CAA",
      "values": ["0 issue \"letsencrypt.org\""],
      "ttl": 3600
    }
  ]
}
```

---

### Ví dụ 3: Port Scan

**Request:**
```json
{
  "scanner_name": "naabu",
  "scanner_version": "2.1.9",
  "recon_type": "port",
  "target": "example.com",
  "open_ports": [
    {
      "host": "example.com",
      "ip": "93.184.216.34",
      "port": 22,
      "protocol": "tcp",
      "service": "ssh",
      "version": "OpenSSH 8.9p1 Ubuntu-3ubuntu0.1",
      "banner": "SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.1"
    },
    {
      "host": "example.com",
      "ip": "93.184.216.34",
      "port": 80,
      "protocol": "tcp",
      "service": "http",
      "version": "nginx 1.24.0"
    },
    {
      "host": "example.com",
      "ip": "93.184.216.34",
      "port": 443,
      "protocol": "tcp",
      "service": "https",
      "version": "nginx 1.24.0",
      "banner": "HTTP/1.1 200 OK\r\nServer: nginx/1.24.0"
    },
    {
      "host": "example.com",
      "ip": "93.184.216.34",
      "port": 3306,
      "protocol": "tcp",
      "service": "mysql",
      "version": "MySQL 8.0.32"
    },
    {
      "host": "example.com",
      "ip": "93.184.216.34",
      "port": 6379,
      "protocol": "tcp",
      "service": "redis",
      "version": "Redis 7.0.8"
    },
    {
      "host": "example.com",
      "ip": "93.184.216.34",
      "port": 27017,
      "protocol": "tcp",
      "service": "mongodb"
    }
  ]
}
```

---

### Ví dụ 4: HTTP Probe (Live Hosts)

**Request:**
```json
{
  "scanner_name": "httpx",
  "scanner_version": "1.3.7",
  "recon_type": "http_probe",
  "target": "example.com",
  "live_hosts": [
    {
      "url": "https://example.com",
      "host": "example.com",
      "ip": "93.184.216.34",
      "port": 443,
      "scheme": "https",
      "status_code": 200,
      "content_length": 1256,
      "title": "Example Domain",
      "web_server": "nginx/1.24.0",
      "content_type": "text/html; charset=UTF-8",
      "technologies": ["nginx", "PHP", "WordPress"],
      "cdn": "cloudflare",
      "tls_version": "TLS 1.3",
      "response_time_ms": 45
    },
    {
      "url": "https://api.example.com",
      "host": "api.example.com",
      "ip": "93.184.216.35",
      "port": 443,
      "scheme": "https",
      "status_code": 200,
      "content_length": 25,
      "title": "",
      "web_server": "nginx/1.24.0",
      "content_type": "application/json",
      "technologies": ["nginx", "Go"],
      "tls_version": "TLS 1.3",
      "response_time_ms": 12
    },
    {
      "url": "http://staging.example.com",
      "host": "staging.example.com",
      "ip": "93.184.216.40",
      "port": 80,
      "scheme": "http",
      "status_code": 401,
      "title": "401 Unauthorized",
      "web_server": "Apache/2.4.52",
      "response_time_ms": 150
    },
    {
      "url": "https://admin.example.com",
      "host": "admin.example.com",
      "ip": "93.184.216.41",
      "port": 443,
      "scheme": "https",
      "status_code": 302,
      "redirect": "https://admin.example.com/login",
      "tls_version": "TLS 1.2",
      "response_time_ms": 85
    }
  ]
}
```

---

### Ví dụ 5: URL Discovery (Crawling)

**Request:**
```json
{
  "scanner_name": "katana",
  "scanner_version": "1.0.4",
  "recon_type": "url_crawl",
  "target": "https://example.com",
  "urls": [
    {
      "url": "https://example.com/",
      "method": "GET",
      "source": "crawler",
      "status_code": 200,
      "depth": 0,
      "type": "page"
    },
    {
      "url": "https://example.com/login",
      "method": "GET",
      "source": "crawler",
      "status_code": 200,
      "depth": 1,
      "parent": "https://example.com/",
      "type": "page"
    },
    {
      "url": "https://example.com/api/v1/users",
      "method": "GET",
      "source": "js-parsing",
      "status_code": 401,
      "depth": 2,
      "parent": "https://example.com/static/app.js",
      "type": "endpoint",
      "extension": "json"
    },
    {
      "url": "https://example.com/api/v1/auth/login",
      "method": "POST",
      "source": "js-parsing",
      "depth": 2,
      "type": "endpoint"
    },
    {
      "url": "https://example.com/uploads/document.pdf",
      "method": "GET",
      "source": "crawler",
      "status_code": 200,
      "depth": 3,
      "type": "file",
      "extension": "pdf"
    },
    {
      "url": "https://example.com/admin/dashboard",
      "method": "GET",
      "source": "robots.txt",
      "status_code": 403,
      "depth": 1,
      "type": "page"
    },
    {
      "url": "https://example.com/.env",
      "method": "GET",
      "source": "wordlist",
      "status_code": 200,
      "depth": 1,
      "type": "file",
      "extension": "env"
    },
    {
      "url": "https://example.com/backup.sql",
      "method": "GET",
      "source": "wordlist",
      "status_code": 200,
      "depth": 1,
      "type": "file",
      "extension": "sql"
    }
  ]
}
```

---

### Ví dụ 6: Combined Recon (All Types)

**Request:**
```json
{
  "scanner_name": "recon-pipeline",
  "scanner_version": "1.0.0",
  "recon_type": "full",
  "target": "example.com",
  "started_at": 1706522400,
  "finished_at": 1706526000,
  "duration_ms": 3600000,

  "subdomains": [
    {"host": "api.example.com", "source": "crtsh"},
    {"host": "www.example.com", "source": "crtsh"}
  ],

  "dns_records": [
    {"host": "example.com", "record_type": "A", "values": ["93.184.216.34"]}
  ],

  "open_ports": [
    {"host": "example.com", "port": 443, "service": "https"}
  ],

  "live_hosts": [
    {
      "url": "https://example.com",
      "status_code": 200,
      "technologies": ["nginx", "React"]
    }
  ],

  "urls": [
    {"url": "https://example.com/api/v1/health", "type": "endpoint"}
  ]
}
```

---

## 4. Ingest Chunk

Nhập báo cáo lớn theo từng phần (chunked upload).

```
POST /api/v1/agent/ingest/chunk
```

---

### Ví dụ 1: First Chunk (với Metadata)

**Request:**
```json
{
  "report_id": "large-scan-20260129-abc123",
  "chunk_index": 0,
  "total_chunks": 3,
  "compression": "zstd",
  "data": "KLUv/QBYZQEA... (base64-encoded zstd-compressed JSON)",
  "is_final": false
}
```

**Decoded Data (sau decompress):**
```json
{
  "metadata": {
    "id": "large-scan-20260129-abc123",
    "timestamp": "2026-01-29T10:00:00Z",
    "coverage_type": "full",
    "branch": {
      "name": "main",
      "is_default_branch": true
    }
  },
  "tool": {
    "name": "enterprise-scanner",
    "version": "5.0.0"
  },
  "findings": [
    {"type": "vulnerability", "title": "Finding 1", "severity": "high", "rule_id": "rule-001"},
    {"type": "vulnerability", "title": "Finding 2", "severity": "medium", "rule_id": "rule-002"}
  ]
}
```

**Response (201 Created):**
```json
{
  "chunk_id": "550e8400-e29b-41d4-a716-446655440000",
  "report_id": "large-scan-20260129-abc123",
  "chunk_index": 0,
  "status": "accepted",
  "assets_created": 0,
  "assets_updated": 0,
  "findings_created": 2,
  "findings_updated": 0,
  "findings_skipped": 0
}
```

---

### Ví dụ 2: Middle Chunk

**Request:**
```json
{
  "report_id": "large-scan-20260129-abc123",
  "chunk_index": 1,
  "total_chunks": 3,
  "compression": "zstd",
  "data": "KLUv/QBYZQEB... (base64-encoded)",
  "is_final": false
}
```

**Decoded Data:**
```json
{
  "findings": [
    {"type": "vulnerability", "title": "Finding 3", "severity": "low", "rule_id": "rule-003"},
    {"type": "secret", "title": "API Key exposed", "severity": "critical", "rule_id": "secret-001"}
  ],
  "assets": [
    {"type": "domain", "value": "api.example.com"}
  ]
}
```

---

### Ví dụ 3: Final Chunk

**Request:**
```json
{
  "report_id": "large-scan-20260129-abc123",
  "chunk_index": 2,
  "total_chunks": 3,
  "compression": "zstd",
  "data": "KLUv/QBYZQEC... (base64-encoded)",
  "is_final": true
}
```

**Response (201 Created):**
```json
{
  "chunk_id": "660e8400-e29b-41d4-a716-446655440002",
  "report_id": "large-scan-20260129-abc123",
  "chunk_index": 2,
  "status": "accepted",
  "assets_created": 5,
  "assets_updated": 0,
  "findings_created": 100,
  "findings_updated": 0,
  "findings_skipped": 3
}
```

---

### Ví dụ 4: Gzip Compression

**Request:**
```json
{
  "report_id": "gzip-report-001",
  "chunk_index": 0,
  "total_chunks": 1,
  "compression": "gzip",
  "data": "H4sIAAAAAAAA... (base64-encoded gzip)",
  "is_final": true
}
```

---

### Ví dụ 5: No Compression

**Request:**
```json
{
  "report_id": "small-report-001",
  "chunk_index": 0,
  "total_chunks": 1,
  "compression": "none",
  "data": "eyJmaW5kaW5ncyI6W3sidHlwZSI6InZ1bG5lcmFiaWxpdHkiLCJ0aXRsZSI6IlRlc3QifV19",
  "is_final": true
}
```

**Decoded Data (base64 only):**
```json
{"findings":[{"type":"vulnerability","title":"Test"}]}
```

---

### Ví dụ 6: Error - Invalid Report ID

**Request:**
```json
{
  "report_id": "invalid<script>alert(1)</script>",
  "chunk_index": 0,
  "total_chunks": 1,
  "compression": "zstd",
  "data": "...",
  "is_final": true
}
```

**Response (400 Bad Request):**
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "report_id contains invalid characters"
  }
}
```

---

### Ví dụ 7: Error - Chunk Index Out of Range

**Request:**
```json
{
  "report_id": "test-report",
  "chunk_index": 5,
  "total_chunks": 3,
  "compression": "zstd",
  "data": "...",
  "is_final": false
}
```

**Response (400 Bad Request):**
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "chunk_index out of range"
  }
}
```

---

## 5. Check Fingerprints

Kiểm tra fingerprints đã tồn tại (deduplication).

```
POST /api/v1/ingest/check
```

---

### Ví dụ 1: Basic Check

**Request:**
```json
{
  "fingerprints": [
    "a1b2c3d4e5f6789012345678901234567890abcd",
    "b2c3d4e5f678901234567890123456789012bcde",
    "c3d4e5f6789012345678901234567890123cdef0"
  ]
}
```

**Response (200 OK):**
```json
{
  "existing": [
    "a1b2c3d4e5f6789012345678901234567890abcd"
  ],
  "missing": [
    "b2c3d4e5f678901234567890123456789012bcde",
    "c3d4e5f6789012345678901234567890123cdef0"
  ]
}
```

---

### Ví dụ 2: All New (None Existing)

**Request:**
```json
{
  "fingerprints": [
    "new-fingerprint-001",
    "new-fingerprint-002"
  ]
}
```

**Response (200 OK):**
```json
{
  "existing": [],
  "missing": [
    "new-fingerprint-001",
    "new-fingerprint-002"
  ]
}
```

---

### Ví dụ 3: All Existing (Duplicates)

**Request:**
```json
{
  "fingerprints": [
    "existing-fp-001",
    "existing-fp-002",
    "existing-fp-003"
  ]
}
```

**Response (200 OK):**
```json
{
  "existing": [
    "existing-fp-001",
    "existing-fp-002",
    "existing-fp-003"
  ],
  "missing": []
}
```

---

### Ví dụ 4: Empty Input

**Request:**
```json
{
  "fingerprints": []
}
```

**Response (200 OK):**
```json
{
  "existing": [],
  "missing": []
}
```

---

### Use Case: SDK Deduplication Flow

```
1. Scanner tạo findings với fingerprints
2. SDK gọi /ingest/check với danh sách fingerprints
3. SDK loại bỏ findings có fingerprint trong "existing"
4. SDK gọi /ingest/ctis với findings còn lại (chỉ "missing")
5. Giảm payload size và processing time
```

---

## 6. Heartbeat

Agent gửi heartbeat định kỳ.

```
POST /api/v1/agent/heartbeat
```

---

### Ví dụ 1: Full Heartbeat

**Request:**
```json
{
  "name": "scanner-agent-prod-01",
  "status": "running",
  "version": "2.5.0",
  "hostname": "scanner-pod-abc123-xyz",
  "message": "Processing 3 scan jobs",
  "scanners": ["semgrep", "trivy", "codeql", "gitleaks", "checkov"],
  "collectors": ["github", "gitlab", "bitbucket"],
  "uptime_seconds": 604800,
  "total_scans": 15234,
  "errors": 42,
  "cpu_percent": 65.5,
  "memory_percent": 72.3,
  "active_jobs": 3,
  "region": "us-east-1"
}
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "agent_id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "660e8400-e29b-41d4-a716-446655440001"
}
```

---

### Ví dụ 2: Minimal Heartbeat (Empty Body)

**Request:**
```http
POST /api/v1/agent/heartbeat
Authorization: Bearer <api_key>
Content-Type: application/json
Content-Length: 0
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "agent_id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "660e8400-e29b-41d4-a716-446655440001"
}
```

---

### Ví dụ 3: Agent in Error State

**Request:**
```json
{
  "status": "error",
  "message": "Database connection lost, retrying...",
  "errors": 150,
  "active_jobs": 0
}
```

---

### Ví dụ 4: Agent Stopping

**Request:**
```json
{
  "status": "stopping",
  "message": "Graceful shutdown initiated, draining queue",
  "active_jobs": 1
}
```

---

## Limits & Constraints

### Report Limits

| Limit | Value |
|-------|-------|
| Max Assets per Report | 100,000 |
| Max Findings per Report | 100,000 |
| Max Property Size | 1 MB |
| Max Properties per Asset | 100 |
| Max Tags per Asset | 50 |
| Max Errors Returned | 100 |
| Database Batch Size | 500 |

### Chunk Limits

| Limit | Value |
|-------|-------|
| Max Chunks per Report | 10,000 |
| Max Chunk Data Size | 10 MB (base64) |
| Max Report ID Length | 256 chars |
| Allowed Report ID Chars | `a-z`, `A-Z`, `0-9`, `-`, `_` |

### Compression Support

| Algorithm | Content-Encoding | Chunk Compression Field |
|-----------|------------------|------------------------|
| gzip | `Content-Encoding: gzip` | `"compression": "gzip"` |
| zstd | `Content-Encoding: zstd` | `"compression": "zstd"` |
| none | (không có) | `"compression": "none"` |

### Coverage Types & Auto-Resolve

| Coverage Type | Auto-Resolve | Điều kiện |
|---------------|--------------|-----------|
| `full` | **Có** | `is_default_branch=true` |
| `full` | Không | `is_default_branch=false` |
| `incremental` | Không | Luôn luôn |
| `partial` | Không | Luôn luôn |
| (không set) | Không | Mặc định an toàn |

---

## Error Reference

| HTTP Status | Code | Mô tả | Nguyên nhân |
|-------------|------|-------|-------------|
| 400 | BAD_REQUEST | Invalid request | JSON syntax error, missing fields, validation |
| 401 | UNAUTHORIZED | Auth failed | Missing/invalid API key |
| 403 | FORBIDDEN | Access denied | Module not licensed |
| 413 | PAYLOAD_TOO_LARGE | Request too large | Exceeds size limits |
| 429 | TOO_MANY_REQUESTS | Rate limited | Too many requests |
| 500 | INTERNAL_ERROR | Server error | Database/internal failure |

---

## SDK Examples

### Go SDK

#### Installation

```bash
go get github.com/openctemio/sdk-go
```

#### Example 1: Basic CTIS Ingestion

```go
package main

import (
    "context"
    "fmt"
    "log"
    "time"

    "github.com/openctemio/sdk-go/pkg/ingest"
    "github.com/openctemio/sdk-go/pkg/ctis"
)

func main() {
    // Create client
    client := ingest.NewClient(
        "https://api.openctem.io",
        "your-api-key-here",
    )

    // Build report
    report := &ctis.Report{
        Version: "1.0",
        Metadata: ctis.Metadata{
            ID:           "scan-" + time.Now().Format("20060102-150405"),
            Timestamp:    time.Now(),
            SourceType:   "scanner",
            CoverageType: "full",
            Branch: &ctis.BranchInfo{
                Name:            "main",
                IsDefaultBranch: true,
                CommitSHA:       "abc123def456",
                RepositoryURL:   "github.com/myorg/myrepo",
            },
        },
        Tool: &ctis.Tool{
            Name:    "my-scanner",
            Version: "1.0.0",
        },
        Findings: []ctis.Finding{
            {
                Type:     "vulnerability",
                Title:    "SQL Injection",
                Severity: "critical",
                RuleID:   "sql-injection-001",
                Location: &ctis.Location{
                    Path:      "handlers/user.go",
                    StartLine: 45,
                },
            },
        },
    }

    // Ingest
    ctx := context.Background()
    result, err := client.IngestCTIS(ctx, report)
    if err != nil {
        log.Fatalf("Ingestion failed: %v", err)
    }

    fmt.Printf("Scan ID: %s\n", result.ScanID)
    fmt.Printf("Findings created: %d\n", result.FindingsCreated)
    fmt.Printf("Findings updated: %d\n", result.FindingsUpdated)
}
```

#### Example 2: SAST Finding với DataFlow

```go
package main

import (
    "context"
    "log"

    "github.com/openctemio/sdk-go/pkg/ingest"
    "github.com/openctemio/sdk-go/pkg/ctis"
)

func main() {
    client := ingest.NewClient("https://api.openctem.io", "api-key")

    finding := ctis.Finding{
        Type:       "vulnerability",
        Title:      "SQL Injection in GetUser",
        Severity:   "critical",
        Confidence: 95,
        RuleID:     "go/sql-injection",
        Message:    "User input flows to SQL query without sanitization",
        Location: &ctis.Location{
            Path:        "internal/handlers/user.go",
            StartLine:   45,
            EndLine:     45,
            StartColumn: 12,
            EndColumn:   35,
            Snippet:     `db.Query("SELECT * FROM users WHERE name='" + username + "'")`,
        },
        Vulnerability: &ctis.VulnerabilityDetails{
            CWEIDs:     []string{"CWE-89"},
            CVSSScore:  9.8,
            CVSSVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
        },
        DataFlow: &ctis.DataFlow{
            Sources: []ctis.DataFlowLocation{
                {
                    Path:     "internal/handlers/user.go",
                    Line:     25,
                    Type:     "source",
                    Function: "GetUser",
                    Content:  `username := r.URL.Query().Get("username")`,
                    Label:    "username",
                },
            },
            Intermediates: []ctis.DataFlowLocation{
                {
                    Path:     "internal/handlers/user.go",
                    Line:     40,
                    Type:     "propagator",
                    Function: "buildQuery",
                    Content:  `query := "SELECT * FROM users WHERE name='" + username + "'"`,
                    Label:    "query",
                },
            },
            Sinks: []ctis.DataFlowLocation{
                {
                    Path:     "internal/handlers/user.go",
                    Line:     45,
                    Column:   12,
                    Type:     "sink",
                    Function: "Query",
                    Content:  "db.Query(query)",
                    Label:    "db.Query",
                },
            },
            Tainted:         true,
            Interprocedural: false,
            CrossFile:       false,
            CallPath:        []string{"GetUser", "buildQuery", "db.Query"},
            Summary:         "User input flows from URL query to SQL execution",
        },
        Recommendation: "Use parameterized queries: db.Query(\"SELECT * FROM users WHERE name = $1\", username)",
        References: []string{
            "https://owasp.org/www-community/attacks/SQL_Injection",
            "https://cwe.mitre.org/data/definitions/89.html",
        },
        Tags: []string{"sql-injection", "user-input", "database"},
    }

    report := &ctis.Report{
        Version: "1.0",
        Metadata: ctis.Metadata{
            Timestamp:    time.Now(),
            CoverageType: "full",
            Branch: &ctis.BranchInfo{
                Name:            "main",
                IsDefaultBranch: true,
            },
        },
        Tool: &ctis.Tool{
            Name:         "codeql",
            Version:      "2.15.0",
            Capabilities: []string{"sast", "taint_tracking"},
        },
        Findings: []ctis.Finding{finding},
    }

    result, err := client.IngestCTIS(context.Background(), report)
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Created %d findings with dataflow", result.FindingsCreated)
}
```

#### Example 3: Secret Detection

```go
package main

import (
    "context"
    "time"

    "github.com/openctemio/sdk-go/pkg/ingest"
    "github.com/openctemio/sdk-go/pkg/ctis"
)

func main() {
    client := ingest.NewClient("https://api.openctem.io", "api-key")

    secrets := []ctis.Finding{
        {
            Type:       "secret",
            Title:      "AWS Access Key exposed",
            Severity:   "critical",
            Confidence: 100,
            RuleID:     "aws-access-key-id",
            Location: &ctis.Location{
                Path:      "config/aws.go",
                StartLine: 15,
                Snippet:   `AccessKeyID: "AKIA..."`,
            },
            Secret: &ctis.SecretDetails{
                Type:               "aws_access_key",
                Service:            "AWS",
                MaskedValue:        "AKIA************WXYZ",
                Entropy:            4.5,
                Verified:           true,
                VerificationStatus: "active",
                Revoked:            false,
                CommitSHA:          "abc123",
                CommitAuthor:       "dev@example.com",
            },
        },
        {
            Type:     "secret",
            Title:    "GitHub Personal Access Token",
            Severity: "high",
            RuleID:   "github-pat",
            Location: &ctis.Location{
                Path:      ".env.example",
                StartLine: 8,
            },
            Secret: &ctis.SecretDetails{
                Type:               "github_pat",
                Service:            "GitHub",
                MaskedValue:        "ghp_****************************abcd",
                Verified:           true,
                VerificationStatus: "active",
                Scopes:             []string{"repo", "read:org"},
            },
        },
        {
            Type:     "secret",
            Title:    "Private RSA Key",
            Severity: "critical",
            RuleID:   "private-key",
            Location: &ctis.Location{
                Path:      "deploy/ssh_key",
                StartLine: 1,
            },
            Secret: &ctis.SecretDetails{
                Type:      "private_key",
                Service:   "SSH",
                Algorithm: "RSA",
                KeySize:   2048,
            },
        },
    }

    report := &ctis.Report{
        Version: "1.0",
        Metadata: ctis.Metadata{
            Timestamp: time.Now(),
        },
        Tool: &ctis.Tool{
            Name:         "gitleaks",
            Version:      "8.18.0",
            Capabilities: []string{"secret_detection"},
        },
        Findings: secrets,
    }

    client.IngestCTIS(context.Background(), report)
}
```

#### Example 4: SCA với Dependencies (SBOM)

```go
package main

import (
    "context"
    "time"

    "github.com/openctemio/sdk-go/pkg/ingest"
    "github.com/openctemio/sdk-go/pkg/ctis"
)

func main() {
    client := ingest.NewClient("https://api.openctem.io", "api-key")

    report := &ctis.Report{
        Version: "1.0",
        Metadata: ctis.Metadata{
            Timestamp: time.Now(),
        },
        Tool: &ctis.Tool{
            Name:         "trivy",
            Version:      "0.50.0",
            Capabilities: []string{"sca", "sbom"},
        },
        Dependencies: []ctis.Dependency{
            {
                ID:           "dep-001",
                Name:         "lodash",
                Version:      "4.17.20",
                Ecosystem:    "npm",
                PURL:         "pkg:npm/lodash@4.17.20",
                Licenses:     []string{"MIT"},
                Relationship: "direct",
                Path:         "package.json",
            },
            {
                ID:           "dep-002",
                Name:         "log4j-core",
                Version:      "2.14.1",
                Ecosystem:    "maven",
                PURL:         "pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1",
                Licenses:     []string{"Apache-2.0"},
                Relationship: "direct",
                Path:         "pom.xml",
            },
        },
        Findings: []ctis.Finding{
            {
                Type:     "vulnerability",
                Title:    "CVE-2021-44228: Log4Shell",
                Severity: "critical",
                RuleID:   "CVE-2021-44228",
                Vulnerability: &ctis.VulnerabilityDetails{
                    CVEID:            "CVE-2021-44228",
                    CWEIDs:           []string{"CWE-502", "CWE-400"},
                    CVSSScore:        10.0,
                    CVSSVector:       "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
                    EPSSScore:        0.97565,
                    PackageName:      "log4j-core",
                    PURL:             "pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1",
                    InstalledVersion: "2.14.1",
                    FixedVersion:     "2.17.1",
                    ExploitAvailable: true,
                    ExploitMaturity:  "weaponized",
                    CISAKEV:          true,
                },
            },
        },
    }

    client.IngestCTIS(context.Background(), report)
}
```

#### Example 5: IaC Misconfiguration

```go
package main

import (
    "context"
    "time"

    "github.com/openctemio/sdk-go/pkg/ingest"
    "github.com/openctemio/sdk-go/pkg/ctis"
)

func main() {
    client := ingest.NewClient("https://api.openctem.io", "api-key")

    findings := []ctis.Finding{
        {
            Type:     "misconfiguration",
            Title:    "S3 bucket has public read access",
            Severity: "high",
            RuleID:   "CKV_AWS_20",
            Message:  "S3 bucket allows public read access via ACL",
            Location: &ctis.Location{
                Path:      "terraform/s3.tf",
                StartLine: 10,
                EndLine:   15,
                Snippet:   `resource "aws_s3_bucket" "data" { acl = "public-read" }`,
            },
            Misconfiguration: &ctis.MisconfigurationDetails{
                PolicyID:        "CKV_AWS_20",
                PolicyName:      "S3 Bucket Public Read ACL",
                Framework:       "terraform",
                ResourceType:    "aws_s3_bucket",
                ResourceName:    "data",
                ResourceAddress: "aws_s3_bucket.data",
                ExpectedValue:   "acl should be 'private'",
                ActualValue:     "acl = 'public-read'",
                RemediationCode: `resource "aws_s3_bucket" "data" { acl = "private" }`,
            },
            Compliance: &ctis.ComplianceDetails{
                Frameworks: []string{"CIS-AWS-1.4", "SOC2", "PCI-DSS"},
                Controls:   []string{"CIS-AWS-1.4-2.1.1", "SOC2-CC6.1"},
            },
        },
        {
            Type:     "misconfiguration",
            Title:    "Security group allows unrestricted SSH",
            Severity: "critical",
            RuleID:   "CKV_AWS_24",
            Location: &ctis.Location{
                Path:      "terraform/security_groups.tf",
                StartLine: 20,
            },
            Misconfiguration: &ctis.MisconfigurationDetails{
                PolicyID:      "CKV_AWS_24",
                Framework:     "terraform",
                ResourceType:  "aws_security_group",
                ExpectedValue: "SSH should not be open to 0.0.0.0/0",
                ActualValue:   `cidr_blocks = ["0.0.0.0/0"]`,
            },
        },
    }

    report := &ctis.Report{
        Version: "1.0",
        Metadata: ctis.Metadata{
            Timestamp: time.Now(),
        },
        Tool: &ctis.Tool{
            Name:         "checkov",
            Version:      "3.0.0",
            Capabilities: []string{"iac", "misconfiguration"},
        },
        Findings: findings,
    }

    client.IngestCTIS(context.Background(), report)
}
```

#### Example 6: Web3/Smart Contract

```go
package main

import (
    "context"
    "time"

    "github.com/openctemio/sdk-go/pkg/ingest"
    "github.com/openctemio/sdk-go/pkg/ctis"
)

func main() {
    client := ingest.NewClient("https://api.openctem.io", "api-key")

    finding := ctis.Finding{
        Type:     "vulnerability",
        Title:    "Reentrancy vulnerability in withdraw",
        Severity: "critical",
        RuleID:   "SWC-107",
        Message:  "External call before state update",
        Location: &ctis.Location{
            Path:      "contracts/Vault.sol",
            StartLine: 45,
            Snippet:   "msg.sender.call{value: amount}(\"\");\nbalances[msg.sender] = 0;",
        },
        Vulnerability: &ctis.VulnerabilityDetails{
            CWEIDs: []string{"CWE-841"},
        },
        Web3: &ctis.Web3Details{
            VulnerabilityClass:  "reentrancy",
            SWCID:               "SWC-107",
            ContractAddress:     "0x1234567890abcdef1234567890abcdef12345678",
            ChainID:             1,
            Chain:               "ethereum",
            FunctionSignature:   "withdraw(uint256)",
            FunctionSelector:    "0x2e1a7d4d",
            ExploitableOnMainnet: true,
            EstimatedImpactUSD:  5000000,
            AffectedValueUSD:    15000000,
            DetectionTool:       "slither",
            DetectionConfidence: "high",
            Reentrancy: &ctis.ReentrancyIssue{
                Type:                   "single_function",
                ExternalCall:           `msg.sender.call{value: amount}("")`,
                StateModifiedAfterCall: "balances[msg.sender]",
                EntryPoint:             "withdraw",
                MaxDepth:               10,
            },
            POC: &ctis.Web3POC{
                Type:            "foundry_test",
                Code:            "function testReentrancy() public { ... }",
                ExpectedOutcome: "Drain contract balance",
                TestedOn:        "mainnet_fork",
                ForkBlockNumber: 18500000,
            },
        },
    }

    report := &ctis.Report{
        Version: "1.0",
        Metadata: ctis.Metadata{
            Timestamp: time.Now(),
        },
        Tool: &ctis.Tool{
            Name:         "slither",
            Version:      "0.10.0",
            Capabilities: []string{"smart_contract", "solidity"},
        },
        Findings: []ctis.Finding{finding},
    }

    client.IngestCTIS(context.Background(), report)
}
```

#### Example 7: Asset Discovery

```go
package main

import (
    "context"
    "time"

    "github.com/openctemio/sdk-go/pkg/ingest"
    "github.com/openctemio/sdk-go/pkg/ctis"
)

func main() {
    client := ingest.NewClient("https://api.openctem.io", "api-key")

    assets := []ctis.Asset{
        {
            Type:        "domain",
            Value:       "api.example.com",
            Name:        "API Gateway",
            Status:      "active",
            Criticality: "critical",
            Environment: "production",
            Tags:        []string{"api", "public-facing"},
            Technical: &ctis.TechnicalDetails{
                Domain: &ctis.DomainDetails{
                    Registrar:   "Cloudflare",
                    Nameservers: []string{"ns1.cloudflare.com", "ns2.cloudflare.com"},
                    DNSSEC:      true,
                },
            },
            Services: []ctis.Service{
                {
                    Port:     443,
                    Protocol: "tcp",
                    Service:  "https",
                    Product:  "nginx",
                    Version:  "1.24.0",
                },
            },
        },
        {
            Type:        "ip_address",
            Value:       "203.0.113.50",
            Name:        "Web Server 1",
            Status:      "active",
            Criticality: "high",
            Technical: &ctis.TechnicalDetails{
                IP: &ctis.IPDetails{
                    Version:       "ipv4",
                    ASN:           13335,
                    ASNOrg:        "Cloudflare Inc",
                    Country:       "US",
                    IsCloud:       true,
                    CloudProvider: "cloudflare",
                },
            },
            Services: []ctis.Service{
                {Port: 443, Protocol: "tcp", Service: "https"},
                {Port: 22, Protocol: "tcp", Service: "ssh", Product: "OpenSSH", Version: "8.9"},
            },
        },
        {
            Type:        "repository",
            Value:       "github.com/myorg/backend-api",
            Name:        "Backend API Repository",
            Criticality: "critical",
            Technical: &ctis.TechnicalDetails{
                Repository: &ctis.RepositoryDetails{
                    Platform:          "github",
                    Visibility:        "private",
                    DefaultBranch:     "main",
                    Languages:         map[string]float64{"Go": 75.5, "Python": 20.0},
                    BranchProtection:  true,
                    RequireReviews:    true,
                },
            },
        },
        {
            Type:  "certificate",
            Value: "api.example.com:443",
            Name:  "API SSL Certificate",
            Technical: &ctis.TechnicalDetails{
                Certificate: &ctis.CertificateDetails{
                    SubjectCN:          "api.example.com",
                    IssuerOrg:          "Let's Encrypt",
                    NotAfter:           time.Now().AddDate(0, 3, 0),
                    SignatureAlgorithm: "SHA256-RSA",
                    KeySize:            2048,
                    SAN:                []string{"api.example.com", "*.api.example.com"},
                    IsWildcard:         true,
                    DaysUntilExpiry:    90,
                },
            },
        },
        {
            Type:        "cloud_resource",
            Value:       "arn:aws:s3:::my-app-data",
            Name:        "Application Data Bucket",
            Criticality: "critical",
            Technical: &ctis.TechnicalDetails{
                Cloud: &ctis.CloudDetails{
                    Provider:   "aws",
                    Service:    "s3",
                    Region:     "us-east-1",
                    AccountID:  "123456789012",
                    ResourceID: "my-app-data",
                    ARN:        "arn:aws:s3:::my-app-data",
                },
            },
        },
    }

    report := &ctis.Report{
        Version: "1.0",
        Metadata: ctis.Metadata{
            Timestamp: time.Now(),
        },
        Tool: &ctis.Tool{
            Name:    "asset-discovery",
            Version: "1.0.0",
        },
        Assets: assets,
    }

    client.IngestCTIS(context.Background(), report)
}
```

#### Example 8: Chunked Upload (Large Reports)

```go
package main

import (
    "context"
    "fmt"
    "log"
    "time"

    "github.com/openctemio/sdk-go/pkg/chunk"
    "github.com/openctemio/sdk-go/pkg/ingest"
    "github.com/openctemio/sdk-go/pkg/ctis"
)

func main() {
    client := ingest.NewClient("https://api.openctem.io", "api-key")

    // Generate large report with many findings
    findings := make([]ctis.Finding, 50000)
    for i := range findings {
        findings[i] = ctis.Finding{
            Type:     "vulnerability",
            Title:    fmt.Sprintf("Finding %d", i),
            Severity: "medium",
            RuleID:   fmt.Sprintf("rule-%d", i),
            Location: &ctis.Location{
                Path:      fmt.Sprintf("file%d.go", i%100),
                StartLine: i % 1000,
            },
        }
    }

    report := &ctis.Report{
        Version: "1.0",
        Metadata: ctis.Metadata{
            ID:           "large-scan-" + time.Now().Format("20060102-150405"),
            Timestamp:    time.Now(),
            CoverageType: "full",
            Branch: &ctis.BranchInfo{
                Name:            "main",
                IsDefaultBranch: true,
            },
        },
        Tool: &ctis.Tool{
            Name:    "enterprise-scanner",
            Version: "5.0.0",
        },
        Findings: findings,
    }

    // Create chunker
    chunker := chunk.NewChunker(report, chunk.Options{
        ChunkSize:   5 * 1024 * 1024, // 5MB per chunk
        Compression: "zstd",          // Use zstd compression
    })

    ctx := context.Background()
    totalCreated := 0

    // Upload chunks
    for chunker.HasNext() {
        chunkData, err := chunker.Next()
        if err != nil {
            log.Fatalf("Failed to create chunk: %v", err)
        }

        result, err := client.IngestChunk(ctx, chunkData)
        if err != nil {
            log.Fatalf("Failed to upload chunk %d: %v", chunkData.Index, err)
        }

        totalCreated += result.FindingsCreated
        fmt.Printf("Chunk %d/%d: created %d findings\n",
            chunkData.Index+1, chunkData.Total, result.FindingsCreated)
    }

    fmt.Printf("Total findings created: %d\n", totalCreated)
}
```

#### Example 9: Fingerprint Deduplication

```go
package main

import (
    "context"
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "log"

    "github.com/openctemio/sdk-go/pkg/ingest"
    "github.com/openctemio/sdk-go/pkg/ctis"
)

// generateFingerprint creates a fingerprint for a finding
func generateFingerprint(f ctis.Finding) string {
    h := sha256.New()
    h.Write([]byte(f.RuleID))
    if f.Location != nil {
        h.Write([]byte(f.Location.Path))
        h.Write([]byte(fmt.Sprintf("%d", f.Location.StartLine)))
    }
    h.Write([]byte(f.Title))
    return hex.EncodeToString(h.Sum(nil))[:32]
}

func main() {
    client := ingest.NewClient("https://api.openctem.io", "api-key")
    ctx := context.Background()

    // Findings from scanner
    allFindings := []ctis.Finding{
        {Type: "vulnerability", Title: "SQL Injection", RuleID: "sql-001",
            Location: &ctis.Location{Path: "user.go", StartLine: 45}},
        {Type: "vulnerability", Title: "XSS", RuleID: "xss-001",
            Location: &ctis.Location{Path: "view.go", StartLine: 100}},
        {Type: "vulnerability", Title: "SSRF", RuleID: "ssrf-001",
            Location: &ctis.Location{Path: "http.go", StartLine: 200}},
    }

    // Generate fingerprints
    fingerprints := make([]string, len(allFindings))
    fingerprintMap := make(map[string]ctis.Finding)
    for i, f := range allFindings {
        fp := generateFingerprint(f)
        fingerprints[i] = fp
        fingerprintMap[fp] = f
    }

    // Check which fingerprints already exist
    checkResult, err := client.CheckFingerprints(ctx, fingerprints)
    if err != nil {
        log.Fatalf("Fingerprint check failed: %v", err)
    }

    fmt.Printf("Existing: %d, Missing: %d\n",
        len(checkResult.Existing), len(checkResult.Missing))

    // Only ingest new findings
    var newFindings []ctis.Finding
    for _, fp := range checkResult.Missing {
        if f, ok := fingerprintMap[fp]; ok {
            f.Fingerprint = fp // Set fingerprint on finding
            newFindings = append(newFindings, f)
        }
    }

    if len(newFindings) == 0 {
        fmt.Println("No new findings to ingest")
        return
    }

    // Ingest only new findings
    report := &ctis.Report{
        Version:  "1.0",
        Metadata: ctis.Metadata{Timestamp: time.Now()},
        Findings: newFindings,
    }

    result, err := client.IngestCTIS(ctx, report)
    if err != nil {
        log.Fatalf("Ingestion failed: %v", err)
    }

    fmt.Printf("Created %d new findings (skipped %d duplicates)\n",
        result.FindingsCreated, len(checkResult.Existing))
}
```

#### Example 10: PR/Incremental Scan

```go
package main

import (
    "context"
    "os"
    "time"

    "github.com/openctemio/sdk-go/pkg/ingest"
    "github.com/openctemio/sdk-go/pkg/ctis"
)

func main() {
    client := ingest.NewClient("https://api.openctem.io", "api-key")

    // Get PR context from CI environment
    prNumber := os.Getenv("PR_NUMBER")
    branchName := os.Getenv("BRANCH_NAME")
    commitSHA := os.Getenv("COMMIT_SHA")
    baseBranch := os.Getenv("BASE_BRANCH")
    baseCommit := os.Getenv("BASE_COMMIT")
    repoURL := os.Getenv("REPO_URL")

    report := &ctis.Report{
        Version: "1.0",
        Metadata: ctis.Metadata{
            ID:           "pr-scan-" + prNumber,
            Timestamp:    time.Now(),
            SourceType:   "scanner",
            CoverageType: "incremental", // Important: incremental for PR scans
            Branch: &ctis.BranchInfo{
                Name:            branchName,
                IsDefaultBranch: false, // PR branch is not default
                CommitSHA:       commitSHA,
                BaseBranch:      baseBranch,
                BaseCommitSHA:   baseCommit,
                RepositoryURL:   repoURL,
                PullRequestID:   prNumber,
                PullRequestURL:  repoURL + "/pull/" + prNumber,
            },
            Scope: &ctis.Scope{
                Paths: []string{
                    "internal/auth/",
                    "internal/handlers/login.go",
                },
                ChangedFiles: 5,
                AddedLines:   150,
                RemovedLines: 20,
            },
        },
        Tool: &ctis.Tool{
            Name:    "semgrep",
            Version: "1.50.0",
        },
        Findings: []ctis.Finding{
            {
                Type:     "vulnerability",
                Title:    "Hardcoded JWT secret",
                Severity: "critical",
                RuleID:   "go/jwt-hardcoded-secret",
                Location: &ctis.Location{
                    Path:      "internal/auth/jwt.go",
                    StartLine: 15,
                    Snippet:   `secret := "super-secret-key-123"`,
                },
            },
        },
    }

    // Auto-resolve will NOT trigger because:
    // 1. coverage_type = "incremental"
    // 2. is_default_branch = false
    result, _ := client.IngestCTIS(context.Background(), report)

    // Post results as PR comment (pseudo-code)
    // github.PostPRComment(prNumber, formatResults(result))
}
```

#### Example 11: Recon Ingestion

```go
package main

import (
    "context"
    "time"

    "github.com/openctemio/sdk-go/pkg/ingest"
    "github.com/openctemio/sdk-go/pkg/ctis"
)

func main() {
    client := ingest.NewClient("https://api.openctem.io", "api-key")

    reconInput := &ctis.ReconToCTISInput{
        ScannerName:    "subfinder",
        ScannerVersion: "2.6.3",
        ReconType:      "subdomain",
        Target:         "example.com",
        StartedAt:      time.Now().Add(-2 * time.Minute).Unix(),
        FinishedAt:     time.Now().Unix(),
        DurationMs:     120000,

        Subdomains: []ctis.SubdomainInput{
            {Host: "www.example.com", Domain: "example.com", Source: "crtsh",
                IPs: []string{"93.184.216.34"}},
            {Host: "api.example.com", Domain: "example.com", Source: "virustotal",
                IPs: []string{"93.184.216.35"}},
            {Host: "mail.example.com", Domain: "example.com", Source: "dnsdumpster"},
            {Host: "dev.example.com", Domain: "example.com", Source: "github-subdomains"},
        },

        DNSRecords: []ctis.DNSRecordInput{
            {Host: "example.com", RecordType: "A", Values: []string{"93.184.216.34"}, TTL: 300},
            {Host: "example.com", RecordType: "MX", Values: []string{"10 mail.example.com"}, TTL: 3600},
            {Host: "example.com", RecordType: "TXT",
                Values: []string{"v=spf1 include:_spf.google.com ~all"}, TTL: 3600},
        },

        OpenPorts: []ctis.OpenPortInput{
            {Host: "example.com", IP: "93.184.216.34", Port: 22, Protocol: "tcp",
                Service: "ssh", Version: "OpenSSH 8.9"},
            {Host: "example.com", IP: "93.184.216.34", Port: 80, Protocol: "tcp",
                Service: "http", Version: "nginx 1.24.0"},
            {Host: "example.com", IP: "93.184.216.34", Port: 443, Protocol: "tcp",
                Service: "https", Version: "nginx 1.24.0"},
        },

        LiveHosts: []ctis.LiveHostInput{
            {
                URL:          "https://example.com",
                Host:         "example.com",
                IP:           "93.184.216.34",
                Port:         443,
                Scheme:       "https",
                StatusCode:   200,
                Title:        "Example Domain",
                WebServer:    "nginx/1.24.0",
                Technologies: []string{"nginx", "PHP", "WordPress"},
                CDN:          "cloudflare",
                TLSVersion:   "TLS 1.3",
                ResponseTime: 45,
            },
        },

        URLs: []ctis.DiscoveredURLInput{
            {URL: "https://example.com/", Method: "GET", Source: "crawler", StatusCode: 200},
            {URL: "https://example.com/login", Method: "GET", Source: "crawler", StatusCode: 200},
            {URL: "https://example.com/api/v1/users", Method: "GET", Source: "js-parsing", StatusCode: 401},
            {URL: "https://example.com/.env", Method: "GET", Source: "wordlist", StatusCode: 200},
        },
    }

    result, _ := client.IngestRecon(context.Background(), reconInput)
    fmt.Printf("Assets created: %d\n", result.AssetsCreated)
}
```

#### Example 12: Error Handling

```go
package main

import (
    "context"
    "errors"
    "log"
    "net/http"
    "time"

    "github.com/openctemio/sdk-go/pkg/ingest"
    "github.com/openctemio/sdk-go/pkg/ctis"
)

func main() {
    client := ingest.NewClient("https://api.openctem.io", "api-key")

    report := &ctis.Report{
        Version: "1.0",
        Metadata: ctis.Metadata{
            Timestamp: time.Now(),
        },
        Findings: []ctis.Finding{
            {Type: "vulnerability", Title: "Test", Severity: "high", RuleID: "test-001"},
        },
    }

    ctx := context.Background()
    result, err := client.IngestCTIS(ctx, report)

    if err != nil {
        // Check error type
        var apiErr *ingest.APIError
        if errors.As(err, &apiErr) {
            switch apiErr.StatusCode {
            case http.StatusUnauthorized:
                log.Fatal("Invalid API key - check your credentials")
            case http.StatusBadRequest:
                log.Fatalf("Invalid request: %s\nDetails: %v", apiErr.Message, apiErr.Details)
            case http.StatusForbidden:
                log.Fatal("Access denied - module not licensed")
            case http.StatusTooManyRequests:
                log.Println("Rate limited - retrying after delay...")
                time.Sleep(time.Duration(apiErr.RetryAfter) * time.Second)
                // Retry...
            case http.StatusInternalServerError:
                log.Fatalf("Server error: %s", apiErr.Message)
            default:
                log.Fatalf("API error %d: %s", apiErr.StatusCode, apiErr.Message)
            }
        }

        // Network or other error
        log.Fatalf("Request failed: %v", err)
    }

    // Handle partial success (some items failed)
    if len(result.Errors) > 0 {
        log.Printf("Warning: %d errors during ingestion:", len(result.Errors))
        for _, e := range result.Errors {
            log.Printf("  - %s", e)
        }
    }

    log.Printf("Success: created %d findings", result.FindingsCreated)
}
```

#### Example 13: Scanner Integration (CodeQL)

```go
package main

import (
    "context"
    "log"
    "os/exec"
    "path/filepath"
    "time"

    "github.com/openctemio/sdk-go/pkg/ingest"
    "github.com/openctemio/sdk-go/pkg/ctis"
    "github.com/openctemio/sdk-go/pkg/scanners/codeql"
)

func main() {
    // Initialize CodeQL scanner
    scanner := codeql.NewSecurityScanner(codeql.LanguageGo)
    scanner.Verbose = true

    // Run scan
    ctx := context.Background()
    scanResult, err := scanner.Scan(ctx, "/path/to/code", nil)
    if err != nil {
        log.Fatalf("Scan failed: %v", err)
    }

    // Convert to CTIS report
    report := &ctis.Report{
        Version: "1.0",
        Metadata: ctis.Metadata{
            Timestamp:    time.Now(),
            CoverageType: "full",
            Branch: &ctis.BranchInfo{
                Name:            "main",
                IsDefaultBranch: true,
            },
        },
        Tool: &ctis.Tool{
            Name:         scanner.Name(),
            Version:      scanner.Version(),
            Capabilities: scanner.Capabilities(),
        },
        Findings: scanResult.Findings,
    }

    // Ingest to OpenCTEM
    client := ingest.NewClient("https://api.openctem.io", "api-key")
    result, err := client.IngestCTIS(ctx, report)
    if err != nil {
        log.Fatalf("Ingestion failed: %v", err)
    }

    log.Printf("Ingested %d findings from CodeQL scan", result.FindingsCreated)
}
```

#### Example 14: Heartbeat (Agent Lifecycle)

```go
package main

import (
    "context"
    "log"
    "os"
    "runtime"
    "time"

    "github.com/openctemio/sdk-go/pkg/ingest"
    "github.com/shirou/gopsutil/v3/cpu"
    "github.com/shirou/gopsutil/v3/mem"
)

type Agent struct {
    client       *ingest.Client
    startTime    time.Time
    totalScans   int64
    errorCount   int64
    activeJobs   int
    stopCh       chan struct{}
}

func NewAgent(apiKey string) *Agent {
    return &Agent{
        client:    ingest.NewClient("https://api.openctem.io", apiKey),
        startTime: time.Now(),
        stopCh:    make(chan struct{}),
    }
}

func (a *Agent) StartHeartbeat(interval time.Duration) {
    ticker := time.NewTicker(interval)
    defer ticker.Stop()

    for {
        select {
        case <-ticker.C:
            a.sendHeartbeat()
        case <-a.stopCh:
            a.sendHeartbeat() // Final heartbeat
            return
        }
    }
}

func (a *Agent) sendHeartbeat() {
    ctx := context.Background()

    // Collect metrics
    cpuPercent, _ := cpu.Percent(time.Second, false)
    memInfo, _ := mem.VirtualMemory()
    hostname, _ := os.Hostname()

    var cpuPct float64
    if len(cpuPercent) > 0 {
        cpuPct = cpuPercent[0]
    }

    heartbeat := &ingest.HeartbeatRequest{
        Name:          "scanner-agent-" + hostname,
        Status:        a.getStatus(),
        Version:       "2.5.0",
        Hostname:      hostname,
        Message:       a.getMessage(),
        Scanners:      []string{"semgrep", "trivy", "codeql", "gitleaks"},
        Collectors:    []string{"github", "gitlab"},
        UptimeSeconds: int64(time.Since(a.startTime).Seconds()),
        TotalScans:    a.totalScans,
        Errors:        a.errorCount,
        CPUPercent:    cpuPct,
        MemoryPercent: memInfo.UsedPercent,
        ActiveJobs:    a.activeJobs,
        Region:        os.Getenv("AWS_REGION"),
    }

    resp, err := a.client.SendHeartbeat(ctx, heartbeat)
    if err != nil {
        log.Printf("Heartbeat failed: %v", err)
        return
    }

    log.Printf("Heartbeat OK: agent_id=%s", resp.AgentID)
}

func (a *Agent) getStatus() string {
    if a.activeJobs > 0 {
        return "running"
    }
    return "idle"
}

func (a *Agent) getMessage() string {
    if a.activeJobs > 0 {
        return fmt.Sprintf("Processing %d scan jobs", a.activeJobs)
    }
    return "Waiting for jobs"
}

func (a *Agent) Stop() {
    close(a.stopCh)
}

func main() {
    agent := NewAgent(os.Getenv("OPENCTEM_API_KEY"))

    // Start heartbeat every 30 seconds
    go agent.StartHeartbeat(30 * time.Second)

    // ... run agent workload ...

    // Graceful shutdown
    agent.Stop()
}
```

---

### Python SDK (Coming Soon)

```python
# Installation: pip install openctem-sdk

from openctem import Client, CTISReport, Finding, Location

client = Client(
    base_url="https://api.openctem.io",
    api_key="your-api-key"
)

# Create report
report = CTISReport(
    version="1.0",
    metadata={
        "timestamp": "2026-01-29T10:00:00Z",
        "coverage_type": "full",
        "branch": {
            "name": "main",
            "is_default_branch": True
        }
    },
    tool={"name": "semgrep", "version": "1.50.0"},
    findings=[
        Finding(
            type="vulnerability",
            title="SQL Injection",
            severity="critical",
            rule_id="python/sql-injection",
            location=Location(
                path="app/db.py",
                start_line=45
            )
        )
    ]
)

# Ingest
result = client.ingest_ris(report)
print(f"Created {result.findings_created} findings")
```

---

### cURL Examples

#### Basic CTIS Ingestion

```bash
curl -X POST https://api.openctem.io/api/v1/agent/ingest/ctis \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0",
    "metadata": {
      "timestamp": "2026-01-29T10:00:00Z",
      "coverage_type": "full",
      "branch": {
        "name": "main",
        "is_default_branch": true
      }
    },
    "tool": {"name": "scanner", "version": "1.0"},
    "findings": [
      {
        "type": "vulnerability",
        "title": "SQL Injection",
        "severity": "critical",
        "rule_id": "sql-001",
        "location": {"path": "app.go", "start_line": 45}
      }
    ]
  }'
```

#### With Gzip Compression

```bash
# Compress and send
cat report.json | gzip | curl -X POST https://api.openctem.io/api/v1/agent/ingest/ctis \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Content-Encoding: gzip" \
  --data-binary @-
```

#### SARIF Ingestion

```bash
curl -X POST https://api.openctem.io/api/v1/agent/ingest/sarif \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d @codeql-results.sarif
```

#### Check Fingerprints

```bash
curl -X POST https://api.openctem.io/api/v1/ingest/check \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"fingerprints": ["fp1", "fp2", "fp3"]}'
```

#### Heartbeat

```bash
curl -X POST https://api.openctem.io/api/v1/agent/heartbeat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "running",
    "version": "2.5.0",
    "active_jobs": 3,
    "cpu_percent": 45.5,
    "memory_percent": 62.3
  }'
```

---

## Related Documentation

- [CTIS Schema Reference](../schemas/ctis-schema-reference.md)
- [Finding Schema](../schemas/ctis-finding.md)
- [Asset Schema](../schemas/ctis-asset.md)
- [Web3 Finding Schema](../schemas/ctis-web3-finding.md)
- [Data Flow Tracking](../features/data-flow-tracking.md)
