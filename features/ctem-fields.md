---
layout: default
title: CTEM Finding Fields
parent: Features
nav_order: 7
---

# CTEM Finding Fields

## Overview

OpenCTEM implements the **Continuous Threat Exposure Management (CTEM)** framework by extending finding records with specialized fields that enable risk-based prioritization. These fields capture exposure context, remediation difficulty, and business impact beyond traditional CVSS scores.

## CTEM Field Categories

OpenCTEM findings include three categories of CTEM-specific fields:

| Category | Purpose | Fields |
|----------|---------|--------|
| **Exposure Vector** | How the vulnerability can be exploited | `exposure_vector`, `is_network_accessible`, `is_internet_accessible`, `attack_prerequisites` |
| **Remediation Context** | Difficulty and approach for fixing | `remediation_type`, `estimated_fix_time`, `fix_complexity`, `remedy_available` |
| **Business Impact** | Organizational risk from exploitation | `data_exposure_risk`, `reputational_impact`, `compliance_impact` |

---

## Exposure Vector Fields

These fields describe how an attacker could exploit the vulnerability.

### exposure_vector

The attack vector required to exploit the vulnerability.

| Value | Description | Risk Multiplier |
|-------|-------------|-----------------|
| `network` | Remotely exploitable over network | 1.5x |
| `adjacent_net` | Same network segment required | 1.3x |
| `local` | Local system access required | 1.0x |
| `physical` | Physical access to device required | 0.8x |
| `unknown` | Attack vector not determined | 1.0x |

**API Field:** `exposure_vector`
**Type:** `string` (enum)

### is_network_accessible

Whether the vulnerable component can be reached over a network.

| Value | Description |
|-------|-------------|
| `true` | Accessible via network (LAN/WAN) |
| `false` | Only accessible locally |

**API Field:** `is_network_accessible`
**Type:** `boolean`

### is_internet_accessible

Whether the vulnerable component is directly internet-facing.

| Value | Description |
|-------|-------------|
| `true` | Directly accessible from the internet |
| `false` | Internal only or behind firewall |

**API Field:** `is_internet_accessible`
**Type:** `boolean`

### attack_prerequisites

Text description of prerequisites needed to exploit (authentication, permissions, etc.).

**Examples:**
- `"Requires authenticated user session"`
- `"No authentication required"`
- `"Admin privileges required"`
- `"MFA bypass needed"`

**API Field:** `attack_prerequisites`
**Type:** `string`

---

## Remediation Context Fields

These fields describe the effort required to fix the vulnerability.

### remediation_type

The type of fix required to remediate the vulnerability.

| Value | Description |
|-------|-------------|
| `patch` | Apply a security patch |
| `upgrade` | Upgrade to a newer version |
| `workaround` | Apply a temporary workaround |
| `config_change` | Modify configuration settings |
| `mitigate` | Apply mitigation controls (compensating) |
| `accept_risk` | Formally accept the risk |

**API Field:** `remediation_type`
**Type:** `string` (enum)

### estimated_fix_time

Estimated time to fix in minutes.

**Examples:**
- `15` - Quick config change
- `60` - Standard patch application
- `480` - Full day for complex upgrade
- `null` - Unknown/not estimated

**API Field:** `estimated_fix_time`
**Type:** `integer` (nullable)

### fix_complexity

The complexity level of implementing the fix.

| Value | Description | Typical Time |
|-------|-------------|--------------|
| `simple` | Straightforward fix | < 1 hour |
| `moderate` | Requires planning and testing | 1-8 hours |
| `complex` | Significant effort, may require change window | > 8 hours |

**API Field:** `fix_complexity`
**Type:** `string` (enum)

### remedy_available

Whether a fix or patch is currently available.

| Value | Description |
|-------|-------------|
| `true` | Patch/fix is available from vendor |
| `false` | No fix available (zero-day, EOL software) |

**API Field:** `remedy_available`
**Type:** `boolean` (default: `true`)

---

## Business Impact Fields

These fields capture the organizational impact if the vulnerability is exploited.

### data_exposure_risk

Risk level for sensitive data exposure if exploited.

| Value | Description | Risk Multiplier |
|-------|-------------|-----------------|
| `none` | No data exposure risk | 1.0x |
| `low` | Non-sensitive data only | 1.1x |
| `medium` | Some sensitive data | 1.4x |
| `high` | Significant sensitive data (PII, financial) | 1.7x |
| `critical` | Highly sensitive data (PHI, credentials, PCI) | 2.0x |

**API Field:** `data_exposure_risk`
**Type:** `string` (enum)

### reputational_impact

Whether exploitation could cause reputational damage.

| Value | Description |
|-------|-------------|
| `true` | Potential for public disclosure, brand damage |
| `false` | Internal impact only |

**API Field:** `reputational_impact`
**Type:** `boolean`

### compliance_impact

List of compliance frameworks potentially affected.

**Common Values:**
- `PCI-DSS` - Payment Card Industry
- `HIPAA` - Healthcare data
- `SOC2` - Service organization controls
- `GDPR` - EU data protection
- `ISO27001` - Information security
- `SOX` - Financial reporting
- `FedRAMP` - US government

**API Field:** `compliance_impact`
**Type:** `array[string]`

---

## CTEM Risk Calculation

OpenCTEM calculates a CTEM risk factor by combining these fields:

```
CTEM Risk Factor = Base × Exposure × Data Risk × Availability × Compliance × Reputation

Where:
- Base = 1.0
- Exposure = 2.0 (internet) or 1.5 (network) or 1.0 (local)
- Data Risk = data_exposure_risk.risk_multiplier (1.0 - 2.0)
- Availability = 1.3 if no remedy available, else 1.0
- Compliance = 1.0 + (0.1 × number of frameworks)
- Reputation = 1.2 if reputational_impact, else 1.0
```

### High-Priority CTEM Criteria

A finding is flagged as high-priority CTEM if ANY of:
- Internet-accessible AND high/critical severity
- Network-accessible AND critical severity
- Data exposure risk is high or critical
- Compliance impact includes PCI-DSS, HIPAA, or SOC2

---

## API Usage

### Set CTEM Fields on Finding

```bash
# Update exposure information
curl -X PATCH /api/v1/findings/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "exposure_vector": "network",
    "is_network_accessible": true,
    "is_internet_accessible": true,
    "attack_prerequisites": "No authentication required"
  }'
```

### Set Remediation Context

```bash
curl -X PATCH /api/v1/findings/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "remediation_type": "upgrade",
    "estimated_fix_time": 120,
    "fix_complexity": "moderate",
    "remedy_available": true
  }'
```

### Set Business Impact

```bash
curl -X PATCH /api/v1/findings/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data_exposure_risk": "high",
    "reputational_impact": true,
    "compliance_impact": ["PCI-DSS", "SOC2"]
  }'
```

### Filter by CTEM Fields

```bash
# Get internet-accessible critical findings
curl "/api/v1/findings?is_internet_accessible=true&severity=critical" \
  -H "Authorization: Bearer $TOKEN"

# Get findings with high data exposure risk
curl "/api/v1/findings?data_exposure_risk=high,critical" \
  -H "Authorization: Bearer $TOKEN"

# Get findings affecting PCI-DSS compliance
curl "/api/v1/findings?compliance_impact=PCI-DSS" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Automatic Population

Some CTEM fields can be automatically populated based on scan results:

| Field | Auto-Populated From |
|-------|---------------------|
| `exposure_vector` | CVSS vector string (AV:N = network, AV:L = local) |
| `remediation_type` | SCA tools (upgrade vs patch based on fix version) |
| `remedy_available` | SCA tools (fixed version exists) |
| `is_network_accessible` | DAST tools (network reachable target) |

### Scanner-Specific Mapping

**Trivy (SCA):**
```yaml
# Mapped from advisory data
remediation_type: "upgrade"      # When FixedVersion exists
remedy_available: true           # When FixedVersion exists
```

**Nuclei (DAST):**
```yaml
# Mapped from network scan
exposure_vector: "network"
is_network_accessible: true
is_internet_accessible: true     # When scanning external target
```

**Semgrep (SAST):**
```yaml
# Defaults (requires manual assessment)
exposure_vector: "unknown"
is_network_accessible: false     # Code-level finding
```

---

## UI Display

CTEM fields are displayed in the finding detail view:

### Exposure Panel

```
┌─ Exposure ──────────────────────────────────────┐
│ Vector:        Network (remotely exploitable)    │
│ Internet:      ● Yes - directly accessible       │
│ Network:       ● Yes                             │
│ Prerequisites: No authentication required        │
└─────────────────────────────────────────────────┘
```

### Remediation Panel

```
┌─ Remediation ───────────────────────────────────┐
│ Type:          Upgrade to v2.3.1                 │
│ Complexity:    Moderate (1-8 hours)              │
│ Est. Time:     2 hours                           │
│ Fix Available: ● Yes                             │
└─────────────────────────────────────────────────┘
```

### Impact Panel

```
┌─ Business Impact ───────────────────────────────┐
│ Data Risk:     High (PII exposure possible)      │
│ Reputation:    ● Potential brand impact          │
│ Compliance:    PCI-DSS, SOC2                     │
│ CTEM Factor:   3.4x                              │
└─────────────────────────────────────────────────┘
```

---

## Best Practices

### 1. Prioritize Internet-Facing

Always assess `is_internet_accessible` first - these findings have the highest real-world risk.

### 2. Set Compliance Impact Early

Tag compliance-relevant findings immediately to enable compliance reporting and prioritization.

### 3. Track Remedy Availability

Monitor `remedy_available: false` findings closely - these may require compensating controls.

### 4. Use Fix Complexity for Planning

Use `fix_complexity` and `estimated_fix_time` for sprint planning and resource allocation.

### 5. Review High CTEM Factors

Regularly review findings with CTEM risk factor > 2.0 - these represent your highest real-world risk.

---

## Related Documentation

- [Findings Management](../guides/findings-management.md)
- [Risk Scoring](../architecture/risk-scoring.md)
- [SLA Policies](../guides/sla-policies.md)
- [Compliance Reporting](../guides/compliance-reporting.md)
