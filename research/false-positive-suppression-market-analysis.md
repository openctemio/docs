---
layout: default
title: False Positive Suppression - Market Analysis
parent: Research
nav_order: 1
---

# False Positive Suppression: Market Analysis

**Date**: January 2026
**Author**: Security Engineering Team
**Status**: Research Complete

---

## Executive Summary

This document analyzes how leading security tools handle false positive suppression and finding management. The research covers 10+ tools across SAST, SCA, secrets detection, and vulnerability management categories.

**Key Finding**: The industry is moving toward **platform-controlled suppression with approval workflows**, away from simple in-code annotations. GitHub's Delegated Alert Dismissal (GA July 2025) and Snyk's Consistent Ignores (default June 2025) exemplify this trend.

---

## Tool-by-Tool Analysis

### 1. Snyk

**Source**: [Snyk Ignore Issues Docs](https://docs.snyk.io/manage-risk/prioritize-issues-for-fixing/ignore-issues)

#### Suppression Methods

| Method | Control Level | Audit Trail |
|--------|---------------|-------------|
| `.snyk` policy file | Repository | Limited |
| `snyk ignore` CLI | Repository | Limited |
| Web UI ignore | Platform | Full |
| API ignore | Platform | Full |

#### Key Features (2025)

- **Consistent Ignores** (Default since June 19, 2025): Once an ignore is created, it is consistently respected regardless of how/where the test is run and what branch is being tested
- **Admin-Only Ignores**: Can restrict ignore capability to Group and Org Admin users only
- **Required Justification**: Can require a reason for each ignore
- **Expiration Dates**: CLI supports `--expiry` parameter

#### Administrative Controls

```
Organization Settings > General > Ignores:
- "Group and Org Admin users (Default user roles only)"
- "Require reason for each ignore" = Required
```

#### Verdict

| Aspect | Rating | Notes |
|--------|--------|-------|
| Developer Control | Configurable | Can be admin-only |
| Audit Trail | Good | Platform tracks who/when |
| Expiration | Yes | Via CLI `--expiry` |
| Approval Workflow | Partial | Admin-only setting acts as gate |

---

### 2. SonarQube

**Source**: [SonarQube Managing Issues](https://docs.sonarsource.com/sonarqube-server/10.6/user-guide/issues/managing)

#### Suppression Methods

| Method | Control Level | Audit Trail |
|--------|---------------|-------------|
| Mark as "False Positive" | Platform | Full |
| Mark as "Won't Fix" | Platform | Full |
| In-code `// NOSONAR` | Repository | None |

#### Key Features

- **Status Change Comments**: Optional comment box when changing status
- **Reopening**: Can reopen Accepted or False Positive issues
- **Permission Required**: "Administer Issues" permission needed
- **Branch Sync Issues**: FP/Won't Fix may not sync between branches (known issue)

#### Issue States

```
To Verify → Confirmed → Fixed
         ↘ False Positive
         ↘ Won't Fix (Accepted)
```

#### Verdict

| Aspect | Rating | Notes |
|--------|--------|-------|
| Developer Control | Restricted | Requires permission |
| Audit Trail | Good | Comments tracked |
| Expiration | No | Manual review needed |
| Approval Workflow | None | Single-step action |

---

### 3. GitHub Advanced Security (Code Scanning)

**Source**: [GitHub Delegated Alert Dismissal](https://github.blog/changelog/2025-07-01-delegated-alert-dismissal-for-code-scanning-is-now-generally-available/)

#### Suppression Methods

| Method | Control Level | Audit Trail |
|--------|---------------|-------------|
| Dismiss Alert (standard) | Repository | Basic |
| Delegated Dismissal | Organization | Full |
| SARIF suppression data | Tool | Via import |

#### Key Features (2025)

- **Delegated Alert Dismissal** (GA July 2025): Requires approval before alerts are dismissed
- **Custom Roles**: Two permission levels:
  - "View code scanning alert dismissal requests"
  - "Review code scanning alert dismissal requests"
- **REST API**: `GET /orgs/{org}/dismissal-requests/code-scanning`
- **Dismissal Comments**: Optional context for audit

#### Dismissal Reasons

```
- False positive
- Used in tests
- Won't fix
```

#### Verdict

| Aspect | Rating | Notes |
|--------|--------|-------|
| Developer Control | Configurable | Delegated dismissal available |
| Audit Trail | Excellent | Full API access |
| Expiration | No | Manual review |
| Approval Workflow | Yes | Delegated dismissal feature |

---

### 4. GitLab Security

**Source**: [GitLab Vulnerability Details](https://docs.gitlab.com/user/application_security/vulnerabilities/)

#### Suppression Methods

| Method | Control Level | Audit Trail |
|--------|---------------|-------------|
| Dismiss vulnerability | Project | Full |
| Auto-dismiss policy | Group/Project | Full |
| Vulnerability management policy | Group | Full |

#### Key Features (2025)

- **Vulnerability Management Policies** (18.8+): Auto-dismiss by CVE with "False positive" reason
- **Warn Mode** (18.7): Test policies before enforcement
- **Audit Log**: Who dismissed, when, reason
- **Role Requirement**: Maintainer role minimum

#### Vulnerability States

```
Needs triage → Confirmed → Resolved
            ↘ Dismissed (with reason)
```

#### Verdict

| Aspect | Rating | Notes |
|--------|--------|-------|
| Developer Control | Restricted | Maintainer+ only |
| Audit Trail | Excellent | Cannot delete records |
| Expiration | No | Via policies only |
| Approval Workflow | Partial | Warn mode for testing |

---

### 5. Checkmarx One

**Source**: [Checkmarx Managing Vulnerabilities](https://docs.checkmarx.com/en/34965-68516-managing--triaging--vulnerabilities.html)

#### Suppression Methods

| Method | Control Level | Audit Trail |
|--------|---------------|-------------|
| Not Exploitable | Platform | Full |
| Proposed Not Exploitable | Platform | Full |
| Custom States | Platform | Full |

#### Key Features (2025)

- **Two-Step Process**: "Proposed Not Exploitable" → Review → "Not Exploitable"
- **Required Notes**: Note required when marking Not Exploitable
- **Custom States** (2025): Tailored triage process
- **Scope Levels**: Project or Application level
- **Recurrent Handling**: Predicate (state, severity, comments) preserved across scans

#### Triage States

```
To Verify → Confirmed → Urgent
         ↘ Not Exploitable
         ↘ Proposed Not Exploitable (pending review)
```

#### Permissions

```
- update-result-not-exploitable
- update-result-state-propose-not-exploitable
- add-notes
```

#### Verdict

| Aspect | Rating | Notes |
|--------|--------|-------|
| Developer Control | Restricted | Separate propose/approve |
| Audit Trail | Excellent | Change log per result |
| Expiration | No | Manual review |
| Approval Workflow | Yes | Proposed → Approved flow |

---

### 6. Veracode

**Source**: [Veracode Mitigate Findings](https://docs.veracode.com/r/improve_mitigation)

#### Suppression Methods

| Method | Control Level | Audit Trail |
|--------|---------------|-------------|
| Potential False Positive | Platform | Full |
| Mitigation Accepted | Platform | Full |
| Mitigate by Design | Platform | Full |

#### Key Features

- **Two-Step Approval**: Dev proposes → Security approves
- **Required Comment**: Up to 1024 characters
- **Check-in/Check-out**: Flaw locking mechanism
- **Mitigation Approver Role**: Specific role for approvals
- **1% False Positive Rate**: Claimed out-of-box accuracy

#### Mitigation Workflow

```
Developer: Identify as "Potential False Positive"
    ↓
Security: Review and "Mitigation Accepted"
    ↓
Flaw removed from published report
```

#### Bulk Operations

```bash
# Bulk mitigation tool available
# - Mitigate by Design
# - False Positive
# - Approve action
```

#### Verdict

| Aspect | Rating | Notes |
|--------|--------|-------|
| Developer Control | Restricted | Can only propose |
| Audit Trail | Excellent | Central repository |
| Expiration | No | Manual review |
| Approval Workflow | Yes | Explicit approve step |

---

### 7. Semgrep

**Source**: [Semgrep Ignoring Findings](https://semgrep.dev/docs/ignoring-findings/)

#### Suppression Methods

| Method | Control Level | Audit Trail |
|--------|---------------|-------------|
| `// nosemgrep: rule-id` | Repository | None |
| `.semgrepignore` | Repository | None |
| Policies page (disable rules) | Platform | Limited |
| Triage as Ignored | Platform | Full |
| AI Auto-Ignore | Platform | Full |

#### Key Features (2025)

- **March 2025**: nosemgrep comments now show why finding was ignored
- **June 2025**: nosemgrep comments no longer require exactly one leading space
- **Global Path Ignores**: Apply to all projects in organization
- **AI Auto-Triage**: Automatically mark findings as provisionally ignored

#### In-Code Annotation

```python
# nosemgrep: rule-id-1, rule-id-2
vulnerable_code()
```

#### Best Practices

> "Exclude only particular findings in your comments rather than disabling all rules with a generic `// nosemgrep` comment. Explain why you disabled a rule."

#### Verdict

| Aspect | Rating | Notes |
|--------|--------|-------|
| Developer Control | High | In-code comments allowed |
| Audit Trail | Mixed | Platform triage has trail |
| Expiration | No | Manual review |
| Approval Workflow | No | Direct suppression |

---

### 8. Trivy

**Source**: [Trivy Filtering](https://trivy.dev/docs/latest/configuration/filtering/)

#### Suppression Methods

| Method | Control Level | Audit Trail |
|--------|---------------|-------------|
| `.trivyignore` | Repository | None |
| `.trivyignore.yaml` | Repository | None |
| OPA Rego Policy | Repository | None |
| `--ignore-unfixed` | CLI | None |

#### Key Features

- **YAML Format** (Experimental): More granular control
- **OPA Rego**: Policy-as-code for complex rules
- **No Platform Mode**: Tool-level only

#### .trivyignore.yaml Example

```yaml
vulnerabilities:
  - id: CVE-2022-40897
    statement: "Not exploitable in our context"

misconfigurations:
  - id: AVD-DS-0002
    paths:
      - Dockerfile.dev
```

#### OPA Rego Example

```rego
package trivy
import rego.v1

cve_list := {"CVE-2022-40897", "CVE-2023-12345"}

default ignore := false
ignore if input.VulnerabilityID in cve_list
```

#### Verdict

| Aspect | Rating | Notes |
|--------|--------|-------|
| Developer Control | High | File-based suppression |
| Audit Trail | None | No platform integration |
| Expiration | No | Manual review |
| Approval Workflow | No | Direct suppression |

---

### 9. Gitleaks

**Source**: [Gitleaks Configuration](https://github.com/gitleaks/gitleaks#configuration)

#### Suppression Methods

| Method | Control Level | Audit Trail |
|--------|---------------|-------------|
| `.gitleaks.toml` allowlist | Repository | None |
| `.gitleaksignore` | Repository | None |
| Inline `# gitleaks:allow` | Repository | None |

#### Key Features

- **Regex Patterns**: Allowlist by pattern
- **Path Patterns**: Exclude directories
- **No Platform Mode**: Tool-level only

#### .gitleaks.toml Example

```toml
[allowlist]
paths = [
    '''_test\.go$''',
    '''\.md$''',
    '''examples/''',
]
regexes = [
    '''example[_-]?token''',
    '''test[_-]?token''',
]
```

#### Verdict

| Aspect | Rating | Notes |
|--------|--------|-------|
| Developer Control | High | File-based suppression |
| Audit Trail | None | No platform integration |
| Expiration | No | Manual review |
| Approval Workflow | No | Direct suppression |

---

### 10. DefectDojo (Aggregator)

**Source**: [DefectDojo Risk Acceptances](https://docs.defectdojo.com/en/working_with_findings/findings_workflows/risk_acceptances/)

#### Suppression Methods

| Method | Control Level | Audit Trail |
|--------|---------------|-------------|
| Full Risk Acceptance | Platform | Full |
| Simple Risk Acceptance | Platform | Basic |
| False Positive status | Platform | Full |

#### Key Features

- **Full Risk Acceptance**: Complete documentation with file uploads
- **Simple Risk Acceptance**: Quick status change (must be enabled)
- **Expiration Dates**: Auto-reactivate findings when expired
- **SLA Integration**: Ties to security SLA
- **JIRA Integration**: Comments and notifications

#### Risk Acceptance Object

```
- Findings associated
- Security team recommendation
- Stakeholder decision
- Expiration date
- Supporting documents
- Reactivate or Restart SLA on expiry
```

#### Verdict

| Aspect | Rating | Notes |
|--------|--------|-------|
| Developer Control | Configurable | Simple vs Full mode |
| Audit Trail | Excellent | Full documentation |
| Expiration | Yes | Auto-reactivation |
| Approval Workflow | Yes | Full risk acceptance flow |

---

## Comparative Matrix

| Tool | In-Code Suppress | Config File | Platform Suppress | Approval Workflow | Expiration | Audit Trail |
|------|------------------|-------------|-------------------|-------------------|------------|-------------|
| **Snyk** | No | .snyk | Yes | Partial (admin-only) | Yes | Good |
| **SonarQube** | NOSONAR | No | Yes | No | No | Good |
| **GitHub GHAS** | No | No | Yes | Yes (Delegated) | No | Excellent |
| **GitLab** | No | No | Yes | Partial (Warn mode) | No | Excellent |
| **Checkmarx** | No | No | Yes | Yes (Propose/Approve) | No | Excellent |
| **Veracode** | No | No | Yes | Yes (2-step) | No | Excellent |
| **Semgrep** | nosemgrep | .semgrepignore | Yes | No | No | Mixed |
| **Trivy** | No | .trivyignore | No | No | No | None |
| **Gitleaks** | gitleaks:allow | .gitleaks.toml | No | No | No | None |
| **DefectDojo** | N/A | N/A | Yes | Yes (Full RA) | Yes | Excellent |

---

## Industry Trends (2025-2026)

### 1. Platform-Controlled Suppression

**Trend**: Moving away from in-code annotations toward platform-managed suppressions.

**Evidence**:
- GitHub Delegated Alert Dismissal (GA July 2025)
- Snyk Consistent Ignores (Default June 2025)
- Checkmarx Proposed Not Exploitable workflow

### 2. Approval Workflows

**Trend**: Requiring security team approval before findings are suppressed.

**Evidence**:
- Veracode's Mitigation Approver role
- Checkmarx's two-step Not Exploitable flow
- GitHub's delegated dismissal with custom roles

### 3. Expiration and Auto-Reactivation

**Trend**: Time-limited suppressions that auto-expire.

**Evidence**:
- DefectDojo's Risk Acceptance expiration
- Snyk's CLI `--expiry` parameter
- Industry best practice for risk acceptance

### 4. AI-Assisted Triage

**Trend**: Using AI to auto-classify false positives.

**Evidence**:
- Semgrep's AI Auto-Ignore
- Claims of 80-90% false positive reduction

### 5. Policy-as-Code

**Trend**: Using policy languages for suppression rules.

**Evidence**:
- Trivy's OPA Rego support
- GitLab's Vulnerability Management Policies

---

## Recommendations for OpenCTEM

Based on this analysis, we recommend:

### Tier 1: Must Have

1. **Platform-Only Suppression**: No in-code annotations respected
2. **Approval Workflow**: Developer requests → Security approves
3. **Expiration Dates**: Maximum 1 year, recommended 90 days
4. **Full Audit Trail**: Who, when, why, approved_by

### Tier 2: Should Have

1. **Role-Based Permissions**: Separate request/approve permissions
2. **Bulk Operations**: Suppress similar findings at once
3. **API Access**: REST API for automation
4. **Notification Integration**: Alert on pending requests

### Tier 3: Nice to Have

1. **AI Auto-Triage**: Suggest likely false positives
2. **Policy-as-Code**: OPA/Rego for complex rules
3. **JIRA/Ticket Integration**: Create tickets for review
4. **SLA Integration**: Tie to security SLAs

---

## Sources

### Official Documentation
- [Snyk Ignore Issues](https://docs.snyk.io/manage-risk/prioritize-issues-for-fixing/ignore-issues)
- [Snyk Consistent Ignores](https://docs.snyk.io/manage-risk/prioritize-issues-for-fixing/ignore-issues/consistent-ignores-for-snyk-code)
- [SonarQube Managing Issues](https://docs.sonarsource.com/sonarqube-server/10.6/user-guide/issues/managing)
- [GitHub Resolving Code Scanning Alerts](https://docs.github.com/en/code-security/code-scanning/managing-code-scanning-alerts/resolving-code-scanning-alerts)
- [GitHub Delegated Alert Dismissal](https://github.blog/changelog/2025-07-01-delegated-alert-dismissal-for-code-scanning-is-now-generally-available/)
- [GitLab Vulnerability Details](https://docs.gitlab.com/user/application_security/vulnerabilities/)
- [GitLab Vulnerability Management Policy](https://docs.gitlab.com/user/application_security/policies/vulnerability_management_policy/)
- [Checkmarx Managing Vulnerabilities](https://docs.checkmarx.com/en/34965-68516-managing--triaging--vulnerabilities.html)
- [Checkmarx Triaging SAST Results](https://docs.checkmarx.com/en/34965-373312-triaging-sast-results.html)
- [Veracode Mitigate Findings](https://docs.veracode.com/r/improve_mitigation)
- [Veracode Mitigation Management](https://www.veracode.com/mitigation-management/)
- [Semgrep Ignoring Findings](https://semgrep.dev/docs/ignoring-findings/)
- [Semgrep Triage and Remediation](https://semgrep.dev/docs/semgrep-code/triage-remediation)
- [Trivy Filtering](https://trivy.dev/docs/latest/configuration/filtering/)
- [DefectDojo Risk Acceptances](https://docs.defectdojo.com/en/working_with_findings/findings_workflows/risk_acceptances/)
- [DefectDojo Finding Status Definitions](https://docs.defectdojo.com/en/working_with_findings/findings_workflows/finding_status_definitions/)

### Industry Research
- [Snyk: Minimizing False Positives](https://snyk.io/blog/minimizing-false-positives-enhancing-security-efficiency/)
- [OWASP Top 10:2025](https://owasp.org/Top10/2025/)
- [OWASP Establishing a Modern Application Security Program](https://owasp.org/Top10/2025/0x03_2025-Establishing_a_Modern_Application_Security_Program/)

---

## Appendix: False Positive Statistics

From [Snyk Research (May 2025)](https://snyk.io/blog/minimizing-false-positives-enhancing-security-efficiency/):

> "70% of a security team's time is spent investigating alerts that are false positives, wasting massive amounts of time in the investigation rather than working on proactive security measures."

> "33% of companies have been late in responding to actual cyberattacks because their teams were busy with these phantom threats."

This underscores the importance of effective false positive management in security operations.
