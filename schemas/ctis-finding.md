---
layout: default
title: CTIS Finding Schema
parent: CTIS Schema Reference
nav_order: 3
---

# CTIS Finding Schema

The Finding schema represents security findings including vulnerabilities, secrets, misconfigurations, compliance issues, and Web3 vulnerabilities.

**Schema Location**: `schemas/ctis/v1/finding.json`

---

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | enum | Finding type: `vulnerability`, `secret`, `misconfiguration`, `compliance`, `web3` |
| `title` | string | Short title |
| `severity` | enum | Severity level: `critical`, `high`, `medium`, `low`, `info` |

---

## All Fields

### Core Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | No | Unique identifier within the report |
| `type` | [FindingType](#findingtype) | **Yes** | Finding type |
| `title` | string | **Yes** | Short title |
| `description` | string | No | Detailed description |
| `severity` | [Severity](#severity) | **Yes** | Severity level |
| `confidence` | integer (0-100) | No | Confidence score |
| `impact` | enum | No | Impact level: `critical`, `high`, `medium`, `low` |
| `likelihood` | enum | No | Likelihood: `high`, `medium`, `low` |
| `category` | string | No | Finding category/class |
| `vulnerability_class` | array[string] | No | Vulnerability classes (e.g., SQL Injection, XSS) |
| `subcategory` | array[string] | No | Subcategories |
| `rule_id` | string | No | Rule/check ID that detected this finding |
| `rule_name` | string | No | Rule name |

### Asset Reference

| Field | Type | Description |
|-------|------|-------------|
| `asset_ref` | string | Reference to asset ID within this report |
| `asset_value` | string | Direct asset value (if not using asset_ref) |
| `asset_type` | string | Asset type (if using asset_value) |

### Location

| Field | Type | Description |
|-------|------|-------------|
| `location` | [FindingLocation](#findinglocation) | Primary code location |
| `related_locations` | array[[FindingLocation](#findinglocation)] | Additional related locations |

### Type-Specific Details

| Field | Type | Description |
|-------|------|-------------|
| `vulnerability` | [VulnerabilityDetails](#vulnerabilitydetails) | Vulnerability-specific details |
| `secret` | [SecretDetails](#secretdetails) | Secret-specific details |
| `misconfiguration` | [MisconfigurationDetails](#misconfigurationdetails) | Misconfiguration details |
| `compliance` | [ComplianceDetails](#compliancedetails) | Compliance details |
| `web3` | [Web3Finding](ctis-web3-finding.md) | Web3 vulnerability details |
| `data_flow` | [DataFlow](#dataflow) | Taint tracking data flow |

### Metadata and Lifecycle

| Field | Type | Description |
|-------|------|-------------|
| `remediation` | [Remediation](#remediation) | Remediation guidance |
| `references` | array[string (uri)] | Reference URLs |
| `tags` | array[string] | Tags |
| `fingerprint` | string | Primary fingerprint for deduplication |
| `partial_fingerprints` | object | Contributing identity components |
| `correlation_id` | string | Groups logically identical results across runs |
| `baseline_state` | enum | Status relative to previous scan: `new`, `unchanged`, `updated`, `absent` |
| `kind` | enum | Evaluation state: `not_applicable`, `pass`, `fail`, `review`, `open`, `informational` |
| `rank` | number (0-100) | Priority/importance score |
| `occurrence_count` | integer | Number of times observed |
| `status` | enum | Finding status: `open`, `resolved`, `suppressed`, `false_positive`, `accepted_risk`, `in_progress` |

### SARIF Compatibility

| Field | Type | Description |
|-------|------|-------------|
| `stacks` | array[[StackTrace](#stacktrace)] | Call stacks relevant to the finding |
| `attachments` | array[[Attachment](#attachment)] | Relevant artifacts or evidence files |
| `work_item_uris` | array[string (uri)] | URIs of work items (issues, tickets) |
| `hosted_viewer_uri` | string (uri) | URI to view in hosted viewer |

### CTEM Fields

| Field | Type | Description |
|-------|------|-------------|
| `exposure` | [FindingExposure](#findingexposure) | Exposure information |
| `remediation_context` | [RemediationContext](#remediationcontext) | Remediation context |
| `business_impact` | [BusinessImpact](#businessimpact) | Business impact assessment |
| `suppression` | [Suppression](#suppression) | Suppression information |

### Git Context

| Field | Type | Description |
|-------|------|-------------|
| `author` | string | Git author name |
| `author_email` | string (email) | Git author email |
| `commit_date` | string (date-time) | Git commit date |
| `first_seen_at` | string (date-time) | When first seen |
| `last_seen_at` | string (date-time) | When last seen |

---

## Enums

### FindingType

| Value | Description |
|-------|-------------|
| `vulnerability` | Code vulnerability or CVE |
| `secret` | Exposed credential or secret |
| `misconfiguration` | IaC/configuration issue |
| `compliance` | Compliance violation |
| `web3` | Smart contract vulnerability |

### Severity

| Value | Description | CVSS Range |
|-------|-------------|------------|
| `critical` | Immediate action required | 9.0 - 10.0 |
| `high` | High priority | 7.0 - 8.9 |
| `medium` | Medium priority | 4.0 - 6.9 |
| `low` | Low priority | 0.1 - 3.9 |
| `info` | Informational | 0.0 |

---

## Object Definitions

### FindingLocation

Location information for code-based findings.

| Field | Type | Description |
|-------|------|-------------|
| `path` | string | File path |
| `start_line` | integer (1+) | Start line (1-indexed) |
| `end_line` | integer (1+) | End line |
| `start_column` | integer (1+) | Start column |
| `end_column` | integer (1+) | End column |
| `snippet` | string | Code snippet |
| `context_snippet` | string | Broader context snippet |
| `branch` | string | Git branch |
| `commit_sha` | string | Git commit SHA |
| `logical_location` | [LogicalLocation](#logicallocation) | Logical code location |

### LogicalLocation

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Symbol name (function, class, method) |
| `kind` | enum | `function`, `method`, `class`, `module`, `namespace`, `type`, `property` |
| `fully_qualified_name` | string | Fully qualified name |

---

### DataFlow

Taint tracking data flow from source to sink (maps to SARIF codeFlows).

| Field | Type | Description |
|-------|------|-------------|
| `sources` | array[[DataFlowLocation](#dataflowlocation)] | Taint source locations (where untrusted data enters) |
| `intermediates` | array[[DataFlowLocation](#dataflowlocation)] | Intermediate propagation steps |
| `sinks` | array[[DataFlowLocation](#dataflowlocation)] | Taint sink locations (where data reaches dangerous function) |
| `sanitizers` | array[[DataFlowLocation](#dataflowlocation)] | Sanitizer locations (where data is cleaned/escaped) |
| `tainted` | boolean | Whether data is still tainted at the sink |
| `taint_type` | enum | Type of taint origin |
| `vulnerability_type` | enum | Vulnerability type this flow leads to |
| `confidence` | integer (0-100) | Flow confidence score |
| `interprocedural` | boolean | Whether flow crosses function boundaries |
| `cross_file` | boolean | Whether data flows across multiple files |
| `call_path` | array[string] | Call graph path (function names in order) |
| `summary` | string | Human-readable summary of the flow |

**taint_type** values:
- `user_input`, `file_read`, `env_var`, `network`, `database`, `header`, `cookie`, `session`, `argv`, `external`

**vulnerability_type** values:
- `sql_injection`, `xss`, `command_injection`, `path_traversal`, `ssrf`, `ldap_injection`, `xpath_injection`, `code_injection`, `template_injection`, `deserialization`, `open_redirect`, `log_injection`, `header_injection`, `xxe`, `regex_dos`

### DataFlowLocation

Location in data flow trace (maps to SARIF threadFlowLocation).

| Field | Type | Description |
|-------|------|-------------|
| `path` | string | File path |
| `line` | integer (1+) | Line number (1-indexed) |
| `end_line` | integer (1+) | End line for multi-line spans |
| `column` | integer (1+) | Column number (1-indexed) |
| `end_column` | integer (1+) | End column |
| `content` | string | Code content at this location |
| `label` | string | Variable or expression name being tracked |
| `index` | integer (0+) | Step index in the flow (0-indexed) |
| `type` | enum | `source`, `sink`, `propagator`, `sanitizer`, `transform` |
| `function` | string | Function/method name containing this location |
| `class` | string | Class/struct name (if applicable) |
| `module` | string | Module/namespace |
| `operation` | string | Operation performed: `assignment`, `call`, `return`, `parameter`, `concat`, etc. |
| `called_function` | string | For function calls: the function being called |
| `parameter_index` | integer (0+) | For parameters: the parameter index (0-indexed) |
| `taint_state` | enum | `tainted`, `sanitized`, `unknown` |
| `transformation` | string | Transformation applied: `encode`, `decode`, `escape`, `hash`, `encrypt`, etc. |
| `notes` | string | Notes for human understanding |

---

### VulnerabilityDetails

Vulnerability-specific details for `type: vulnerability`.

| Field | Type | Description |
|-------|------|-------------|
| `cve_id` | string | CVE identifier (e.g., `CVE-2024-1234`) |
| `cwe_id` | string | Primary CWE identifier (e.g., `CWE-89`) |
| `cwe_ids` | array[string] | All related CWE identifiers |
| `owasp_ids` | array[string] | OWASP Top 10 identifiers (e.g., `A01:2021`) |
| `cvss_version` | enum | `2.0`, `3.0`, `3.1`, `4.0` |
| `cvss_score` | number (0-10) | CVSS score |
| `cvss_vector` | string | CVSS vector string |
| `cvss_source` | enum | `nvd`, `ghsa`, `redhat`, `bitnami`, `vendor` |
| `package` | string | Affected package |
| `purl` | string | Package URL (purl spec) |
| `affected_version` | string | Affected version |
| `fixed_version` | string | Fixed version |
| `ecosystem` | enum | `npm`, `pip`, `maven`, `gradle`, `nuget`, `cargo`, `go`, `composer`, `rubygems`, `hex`, `pub`, `swift`, `cocoapods` |
| `dependency_path` | array[string] | Dependency path from root to vulnerable package |
| `exploit_available` | boolean | Exploit is available |
| `exploit_maturity` | enum | `none`, `poc`, `functional`, `weaponized` |
| `in_cisa_kev` | boolean | In CISA Known Exploited Vulnerabilities |
| `epss_score` | number (0-1) | EPSS score |
| `epss_percentile` | number (0-100) | EPSS percentile ranking |
| `cpe` | string | CPE identifier |

---

### SecretDetails

Secret-specific details for `type: secret`.

| Field | Type | Description |
|-------|------|-------------|
| `secret_type` | enum | `api_key`, `password`, `token`, `certificate`, `private_key`, `oauth`, `jwt`, `ssh_key`, `aws_key`, `gcp_key`, `azure_key`, `generic_secret`, `database_credential`, `encryption_key` |
| `service` | string | Associated service (aws, github, stripe, etc.) |
| `masked_value` | string | Masked value (first/last chars) |
| `length` | integer | Secret length |
| `entropy` | number | Entropy score |
| `valid` | boolean | Secret is valid (if verified) |
| `revoked` | boolean | Secret is revoked |
| `scopes` | array[string] | API scopes/permissions |
| `expires_at` | string (date-time) | When the secret expires |
| `rotation_due_at` | string (date-time) | When rotation is due |
| `in_history_only` | boolean | Secret only exists in git history |

---

### MisconfigurationDetails

Misconfiguration-specific details for `type: misconfiguration`.

| Field | Type | Description |
|-------|------|-------------|
| `policy_id` | string | Policy ID |
| `policy_name` | string | Policy name |
| `resource_type` | string | Resource type |
| `resource_name` | string | Resource name |
| `expected` | string | Expected value |
| `actual` | string | Actual value |
| `cause` | string | Cause of misconfiguration |

---

### ComplianceDetails

Compliance-specific details for `type: compliance`.

| Field | Type | Description |
|-------|------|-------------|
| `framework` | enum | `pci-dss`, `hipaa`, `soc2`, `cis`, `nist`, `iso27001`, `gdpr`, `fedramp` |
| `framework_version` | string | Framework version |
| `control_id` | string | Control ID |
| `control_name` | string | Control name |
| `control_description` | string | Control description |
| `result` | enum | `pass`, `fail`, `manual`, `not_applicable` |

---

### Remediation

Remediation guidance.

| Field | Type | Description |
|-------|------|-------------|
| `recommendation` | string | Recommendation text |
| `steps` | array[string] | Step-by-step remediation |
| `effort` | enum | `trivial`, `low`, `medium`, `high` |
| `fix_available` | boolean | Fix is available |
| `auto_fixable` | boolean | Can be auto-fixed |
| `references` | array[string (uri)] | Reference URLs |

---

### StackTrace

Call stack trace (SARIF stack).

| Field | Type | Description |
|-------|------|-------------|
| `message` | string | Stack description |
| `frames` | array[[StackFrame](#stackframe)] | Stack frames from innermost to outermost |

### StackFrame

| Field | Type | Description |
|-------|------|-------------|
| `location` | [FindingLocation](#findinglocation) | Frame location |
| `module` | string | Module/library name |
| `thread_id` | integer | Thread ID |
| `parameters` | array[string] | Function parameters |

---

### Suppression

Finding suppression information.

| Field | Type | Description |
|-------|------|-------------|
| `state` | enum | `suppressed`, `accepted`, `under_review` |
| `reason` | string | Reason for suppression |
| `justification` | string | Detailed justification |
| `suppressed_by` | string | Who suppressed (user/email) |
| `suppressed_at` | string (date-time) | When suppressed |
| `expires_at` | string (date-time) | When suppression expires |

---

### FindingExposure

CTEM exposure information.

| Field | Type | Description |
|-------|------|-------------|
| `vector` | enum | `network`, `local`, `physical`, `adjacent_net` |
| `is_network_accessible` | boolean | Reachable from network |
| `is_internet_accessible` | boolean | Reachable from internet |
| `attack_prerequisites` | string | Prerequisites: `auth_required`, `mfa_required`, `local_access`, etc. |

---

### RemediationContext

CTEM remediation context.

| Field | Type | Description |
|-------|------|-------------|
| `type` | enum | `patch`, `upgrade`, `workaround`, `config_change`, `mitigate`, `accept_risk` |
| `estimated_minutes` | integer | Estimated time to fix |
| `complexity` | enum | `simple`, `moderate`, `complex` |
| `remedy_available` | boolean | Remedy (patch/fix) is available |

---

### BusinessImpact

CTEM business impact assessment.

| Field | Type | Description |
|-------|------|-------------|
| `data_exposure_risk` | enum | `none`, `low`, `medium`, `high`, `critical` |
| `reputational_impact` | boolean | Has potential reputational impact |
| `compliance_impact` | array[string] | Compliance frameworks impacted: `PCI-DSS`, `HIPAA`, `SOC2`, `GDPR`, `ISO27001` |

---

### Attachment

Artifact or evidence attachment (SARIF attachment).

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | Attachment description |
| `artifact_location` | object | `{uri, uri_base_id}` |
| `regions` | array[[FindingLocation](#findinglocation)] | Relevant regions within the artifact |
| `rectangles` | array | Relevant rectangular areas (for images) |

---

## Examples

### SAST Finding with DataFlow

```json
{
  "type": "vulnerability",
  "title": "SQL Injection",
  "severity": "critical",
  "confidence": 95,
  "rule_id": "go/sql-injection",
  "location": {
    "path": "handlers/user.go",
    "start_line": 35,
    "start_column": 10,
    "snippet": "db.Query(query)",
    "logical_location": {
      "name": "CreateUser",
      "kind": "function",
      "fully_qualified_name": "main.CreateUser"
    }
  },
  "vulnerability": {
    "cwe_ids": ["CWE-89"],
    "owasp_ids": ["A03:2021"],
    "cvss_score": 9.8,
    "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
  },
  "data_flow": {
    "sources": [
      {
        "path": "handlers/user.go",
        "line": 25,
        "type": "source",
        "function": "CreateUser",
        "content": "username := r.FormValue(\"username\")",
        "taint_state": "tainted"
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
    "taint_type": "user_input",
    "vulnerability_type": "sql_injection",
    "interprocedural": false,
    "cross_file": false,
    "summary": "User input from FormValue flows to SQL query without sanitization"
  },
  "remediation": {
    "recommendation": "Use parameterized queries instead of string concatenation",
    "steps": [
      "Replace fmt.Sprintf with parameterized query",
      "Use db.Query(\"SELECT * FROM users WHERE name = $1\", username)"
    ],
    "effort": "low",
    "auto_fixable": false
  }
}
```

### Secret Finding

```json
{
  "type": "secret",
  "title": "AWS Access Key Exposed",
  "severity": "critical",
  "rule_id": "aws-access-key",
  "location": {
    "path": "config/aws.go",
    "start_line": 15,
    "snippet": "accessKey := \"AKIA...\""
  },
  "secret": {
    "secret_type": "aws_key",
    "service": "aws",
    "masked_value": "AKIA****WXYZ",
    "length": 20,
    "entropy": 4.5,
    "valid": true,
    "revoked": false,
    "scopes": ["s3:*", "ec2:*"]
  }
}
```

### SCA Finding

```json
{
  "type": "vulnerability",
  "title": "CVE-2024-1234 in lodash",
  "severity": "high",
  "rule_id": "CVE-2024-1234",
  "location": {
    "path": "package-lock.json",
    "start_line": 1234
  },
  "vulnerability": {
    "cve_id": "CVE-2024-1234",
    "cwe_ids": ["CWE-400"],
    "cvss_score": 7.5,
    "package": "lodash",
    "purl": "pkg:npm/lodash@4.17.20",
    "affected_version": "4.17.20",
    "fixed_version": "4.17.21",
    "ecosystem": "npm",
    "dependency_path": ["my-app", "express", "lodash"],
    "exploit_available": true,
    "exploit_maturity": "poc",
    "in_cisa_kev": false,
    "epss_score": 0.15,
    "epss_percentile": 85
  }
}
```

---

## Related Schemas

- [Web3 Finding Schema](ctis-web3-finding.md) - Smart contract vulnerabilities
- [Data Flow Tracking](../features/data-flow-tracking.md) - DataFlow field documentation
