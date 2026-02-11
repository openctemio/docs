---
layout: default
title: Suppression Rules
parent: Platform Guides
nav_order: 8
permalink: /guides/suppression-rules/
---

# Suppression Rules & Finding Lifecycle

Platform-controlled rules to suppress false positives and auto-resolve fixed vulnerabilities.

---

## Overview

OpenCTEM provides two key features for managing finding lifecycle:

1. **Suppression Rules**: Mark findings as false positives, accepted risks, or "won't fix" centrally
2. **Auto-Resolve**: Automatically close findings when they're fixed in code

Both features are designed based on industry best practices from [SonarQube](https://docs.sonarsource.com/sonarqube-server/10.4/user-guide/issues), [Semgrep](https://semgrep.dev/docs/semgrep-code/findings), [GitHub Advanced Security](https://docs.github.com/en/code-security/code-scanning/managing-code-scanning-alerts/resolving-code-scanning-alerts), and [DefectDojo](https://docs.defectdojo.com/en/working_with_findings/finding_deduplication/about_deduplication/).

### Why Platform-Controlled?

Traditional approaches like `.semgrepignore` files or `// nosemgrep` comments have significant drawbacks:

| Approach | Problem |
|----------|---------|
| `.semgrepignore` in repo | Developers can bypass security without oversight |
| `// nosemgrep` comments | No audit trail, no expiration, scattered across codebase |
| Tool-specific ignore files | Inconsistent across tools, hard to manage at scale |

**OpenCTEM's approach**: All suppressions are managed through the platform with:
- **Centralized control**: Security team owns suppression rules
- **Full audit trail**: Who, when, why for every change
- **Expiration and review**: Rules can expire, forcing periodic review
- **Approval workflow**: Permanent suppressions require security team approval

---

## Finding Lifecycle

### Status Flow

```
┌──────────┐         ┌───────────┐         ┌──────────┐
│   NEW    │────────►│   OPEN    │────────►│ CONFIRMED│
└──────────┘         └───────────┘         └──────────┘
     │                    │                      │
     │                    │                      │
     ▼                    ▼                      ▼
┌─────────────────────────────────────────────────────┐
│                    RESOLUTION                        │
│                                                      │
│   ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│   │   RESOLVED   │  │FALSE_POSITIVE│  │ACCEPTED   │ │
│   │  (auto/manual)│  │   (manual)   │  │   RISK    │ │
│   └──────────────┘  └──────────────┘  └───────────┘ │
│          │                 │                 │       │
│          ▼                 │                 │       │
│   ┌──────────────┐        │                 │       │
│   │ RE-OPENED    │◄───────┼─────────────────┘       │
│   │(if reappears)│        │                         │
│   └──────────────┘        │                         │
│                           │                         │
│                    NOT auto-reopened                │
│                    (protected status)               │
└─────────────────────────────────────────────────────┘
```

### Auto-Resolve Behavior

When a finding is no longer detected in a subsequent full scan:

| Previous Status | New Status | Behavior |
|-----------------|------------|----------|
| `open` | `resolved` | Auto-resolved with reason "auto_fixed" |
| `confirmed` | `resolved` | Auto-resolved |
| `in_progress` | `resolved` | Auto-resolved |
| `false_positive` | `false_positive` | **No change** (protected) |
| `accepted_risk` | `accepted_risk` | **No change** (protected) |

### Auto-Reopen Behavior

When a previously resolved finding reappears:

| Previous Resolution | Behavior |
|--------------------|----------|
| `auto_fixed` | Auto-reopened to `open` |
| `manual_fixed` | Auto-reopened to `open` |
| `false_positive` | **No reopen** (protected) |
| `accepted_risk` | **No reopen** (protected) |

---

## Suppression Rules

Suppression rules allow security teams to mark findings as false positives, accepted risks, or "won't fix" without requiring developers to add inline comments or modify code.

### Key Features

- **Centralized management**: Rules are stored in the platform, not scattered across codebases
- **Approval workflow**: Rules can require security team approval before becoming active
- **Expiration support**: Set rules to expire automatically after a certain date
- **Flexible matching**: Match by rule ID, tool name, file path patterns, or asset
- **Audit trail**: All rule changes are logged for compliance

---

## Suppression Types

| Type | Description | Use Case |
|------|-------------|----------|
| `false_positive` | Finding is not a real vulnerability | Scanner misidentified safe code |
| `accepted_risk` | Risk is acknowledged but accepted | Low-risk finding in non-critical code |
| `wont_fix` | Won't be fixed for valid reasons | Legacy code, third-party dependency |

---

## Rule Matching Criteria

Rules can match findings using one or more criteria:

### Rule ID Pattern

Match by the scanner's rule identifier. Supports wildcards.

```json
{
  "rule_id": "semgrep.sql-injection"
}
```

Wildcard example:
```json
{
  "rule_id": "semgrep.sql-*"
}
```

### Tool Name

Match findings from a specific scanner tool.

```json
{
  "tool_name": "gitleaks"
}
```

### Path Pattern

Match findings in specific file paths. Uses glob patterns.

```json
{
  "path_pattern": "tests/**"
}
```

Common patterns:
- `tests/**` - All files under tests directory
- `**/*.test.go` - All test files
- `vendor/**` - Third-party dependencies
- `docs/**` - Documentation files

### Asset ID

Limit rule to a specific asset (repository).

```json
{
  "asset_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Combined Criteria

All specified criteria must match (AND logic):

```json
{
  "tool_name": "semgrep",
  "rule_id": "hardcoded-password",
  "path_pattern": "tests/**"
}
```

---

## Approval Workflow

### Rule Lifecycle

```
[Created] --> [Pending] --> [Approved] --> [Active]
                  |
                  +--> [Rejected]

[Approved] --> [Expired] (when expires_at is reached)
```

### Status Definitions

| Status | Description |
|--------|-------------|
| `pending` | Awaiting approval from security team |
| `approved` | Active and being applied to findings |
| `rejected` | Denied by security team |
| `expired` | Was approved but has expired |

### Permissions

| Permission | Description | Typical Role |
|------------|-------------|--------------|
| `findings:suppressions:read` | View rules | All users |
| `findings:suppressions:request` | Create pending rules | Developers |
| `findings:suppressions:approve` | Approve/reject rules | Security team |
| `findings:suppressions:write` | Full rule management | Security leads |
| `findings:suppressions:delete` | Delete rules | Admins |

---

## API Reference

### List All Rules

```bash
GET /api/v1/suppressions
```

Query parameters:
- `status` - Filter by status (pending, approved, rejected, expired)
- `tool_name` - Filter by tool name

Example:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/api/v1/suppressions?status=pending"
```

### List Active Rules (for Agents)

```bash
GET /api/v1/suppressions/active
```

Returns simplified format optimized for agent consumption:

```json
{
  "rules": [
    {
      "rule_id": "semgrep.sql-injection",
      "tool_name": "semgrep",
      "path_pattern": null,
      "asset_id": null,
      "expires_at": null
    }
  ],
  "count": 1
}
```

### Get Rule by ID

```bash
GET /api/v1/suppressions/{id}
```

### Create Rule

```bash
POST /api/v1/suppressions
```

Request body:
```json
{
  "name": "Suppress test file false positives",
  "description": "Test fixtures contain intentional vulnerable patterns",
  "suppression_type": "false_positive",
  "rule_id": "hardcoded-password",
  "tool_name": "semgrep",
  "path_pattern": "tests/**",
  "expires_at": "2025-12-31T23:59:59Z"
}
```

### Approve Rule

```bash
POST /api/v1/suppressions/{id}/approve
```

### Reject Rule

```bash
POST /api/v1/suppressions/{id}/reject
```

Request body:
```json
{
  "reason": "This finding is a real vulnerability that should be fixed"
}
```

### Delete Rule

```bash
DELETE /api/v1/suppressions/{id}
```

---

## Agent Integration

The agent automatically fetches and applies suppression rules when:
1. Running with `--push` flag (connected to platform)
2. Using `--fail-on` flag (security gate enabled)

### How It Works

1. Agent completes scans and collects findings
2. Before security gate check, agent fetches active suppressions from platform
3. Findings matching suppression rules are excluded from gate evaluation
4. Suppressed count is displayed in output

### Example Output

```
Scans complete: 42 findings

✅ Security gate PASSED: no findings >= high severity
  (Suppressed: 5 findings)
```

### Manual Testing

You can test suppression matching without the platform:

```go
import "github.com/openctemio/agent/internal/gate"

rules := []client.SuppressionRule{
    {RuleID: "sql-injection", ToolName: "semgrep"},
    {PathPattern: "tests/**"},
}

result, _ := gate.CheckWithSuppressions(reports, "high", 5, rules)
fmt.Printf("Passed: %v, Total: %d\n", result.Passed, result.Total)
```

---

## Best Practices

### Do

- **Be specific**: Use multiple criteria to avoid over-suppressing
- **Set expiration dates**: For accepted risks, set a review date
- **Document reasoning**: Use the description field to explain why
- **Review periodically**: Audit suppression rules quarterly

### Don't

- **Suppress entire tools**: Avoid `{"tool_name": "semgrep"}` without other criteria
- **Use overly broad paths**: Avoid `{"path_pattern": "**"}`
- **Skip approval workflow**: Always require security team review
- **Forget about expirations**: Set reminders to review expired rules

### Example: Good Rule

```json
{
  "name": "Test fixtures - intentional vulnerable patterns",
  "description": "Files in tests/fixtures contain intentional SQL injection patterns for testing the parser. These are not executed in production.",
  "suppression_type": "false_positive",
  "rule_id": "semgrep.sql-injection",
  "tool_name": "semgrep",
  "path_pattern": "tests/fixtures/**",
  "expires_at": "2026-06-30T00:00:00Z"
}
```

### Example: Bad Rule

```json
{
  "name": "Suppress all SQL injection",
  "rule_id": "sql-*"
}
```

This is too broad and will suppress legitimate findings.

---

## Database Schema

For administrators, the suppression system uses three tables:

### suppression_rules

Main table storing rule definitions.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tenant_id | UUID | Tenant ownership |
| rule_id | VARCHAR(500) | Rule ID pattern |
| tool_name | VARCHAR(100) | Tool name filter |
| path_pattern | VARCHAR(1000) | File path glob |
| asset_id | UUID | Optional asset filter |
| name | VARCHAR(255) | Human-readable name |
| description | TEXT | Explanation |
| suppression_type | VARCHAR(50) | Type of suppression |
| status | VARCHAR(20) | Workflow status |
| requested_by | UUID | User who created |
| approved_by | UUID | User who approved |
| expires_at | TIMESTAMP | Expiration date |

### finding_suppressions

Junction table tracking which findings were suppressed by which rules.

### suppression_rule_audit

Audit log of all rule changes for compliance.

---

## Troubleshooting

### Rule Not Being Applied

1. **Check status**: Rule must be `approved`
2. **Check expiration**: Rule must not be expired
3. **Check criteria**: All criteria must match (AND logic)
4. **Check tenant**: Rule must belong to same tenant as scan

### Agent Not Fetching Rules

1. **Check connectivity**: Agent must be able to reach API
2. **Check auth**: API key must have `findings:suppressions:read` permission
3. **Check flags**: Must use `--push` flag

### View Audit Log

```sql
SELECT * FROM suppression_rule_audit
WHERE suppression_rule_id = 'your-rule-id'
ORDER BY created_at DESC;
```

---

## Industry Comparison

How OpenCTEM compares to other platforms:

| Feature | OpenCTEM | SonarQube | Semgrep | GitHub GHAS | DefectDojo |
|---------|---------|-----------|---------|-------------|------------|
| Auto-resolve when fixed | ✅ | ✅ | ✅ | ✅ | ✅ |
| Auto-reopen when reappears | ✅ | ✅ | ✅ | Manual | Configurable |
| Platform-controlled suppression | ✅ | ✅ | ✅ | ✅ | ✅ |
| Approval workflow | ✅ | ✅ | ✅ | - | - |
| Expiration support | ✅ | - | - | - | - |
| In-code suppression | ❌ Disabled | `//NOSONAR` | `nosemgrep` | - | - |
| Cross-scanner dedup | Planned | - | - | - | ✅ |

### Key Differences

- **SonarQube**: Allows `//NOSONAR` but recommends against it
- **Semgrep**: Uses platform triage, in-code suppression optional
- **GitHub**: SARIF-based suppression sync available
- **DefectDojo**: Most configurable, supports cross-scanner deduplication
- **OpenCTEM**: Disables in-code suppression by default for maximum governance

---

## Migrating from In-Code Suppressions

If you have existing `.semgrepignore` or inline comments:

### Step 1: Identify Existing Suppressions

```bash
# Find semgrep ignore files
find . -name ".semgrepignore" -o -name ".gitleaksignore"

# Find inline suppressions
grep -r "nosemgrep" --include="*.py" --include="*.js"
grep -r "gitleaks:allow" --include="*"
```

### Step 2: Create Platform Rules

For each suppression, create an equivalent platform rule:

```bash
# Convert .semgrepignore entry to API call
curl -X POST https://api.openctem.io/api/v1/suppressions \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "path_pattern": "tests/fixtures/**",
    "suppression_type": "false_positive",
    "description": "Migrated from .semgrepignore"
  }'
```

### Step 3: Remove In-Code Suppressions

After platform rules are active:

1. Delete `.semgrepignore`, `.gitleaksignore` files
2. Remove inline `// nosemgrep` comments
3. Verify CI still passes with platform suppressions

---

## Related Documentation

- [Agent Usage: CI/CD Integration](agent-usage.md#cicd-integration)
- [Finding Lifecycle RFC](../_internal/rfcs/2026-01-28-finding-lifecycle-auto-resolve.md)
- [Security Gate Configuration](agent-usage.md#security-gate-cicd-pipeline-control)
