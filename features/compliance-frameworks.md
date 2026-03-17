---
layout: default
title: Compliance Framework Mapping
parent: Features
nav_order: 35
---

# Compliance Framework Mapping

> **Status**: Implemented
> **Version**: v1.0
> **Released**: 2026-03-17

## Overview

Compliance Framework Mapping connects security findings to regulatory and industry compliance controls. Map findings to frameworks like SOC2, ISO 27001, PCI-DSS, NIST, HIPAA, GDPR, OWASP Top 10, and CIS Controls to track compliance posture and generate audit-ready reports.

## Architecture

```
┌────────────────────────────────────────────────────┐
│                Compliance Module                     │
│                                                      │
│  Framework ──► Controls ──► Finding Mappings          │
│  (SOC2...)     (CC6.1...)    (finding ↔ control)     │
│                                                      │
│  Assessment ──► Control Status                        │
│  (per-framework compliance snapshot)                  │
└────────────────────────────────────────────────────┘
```

## Database Schema (Migration 000092-094)

### Tables

| Table | Purpose |
|-------|---------|
| `compliance_frameworks` | Framework definitions (SOC2, ISO27001, etc.) |
| `compliance_controls` | Individual controls within a framework |
| `compliance_assessments` | Assessment status per control per tenant |
| `compliance_finding_mappings` | Maps findings to controls with impact type |

### Seeded Frameworks (Migration 000094)

| Framework | Controls | Description |
|-----------|----------|-------------|
| OWASP Top 10 (2021) | 10 | Web application security risks |
| SOC 2 Type II | 17 | Service organization controls |
| ISO 27001:2022 | 14 | Information security management |
| PCI-DSS v4.0 | 12 | Payment card industry |
| NIST CSF 2.0 | 14 | Cybersecurity framework |
| HIPAA Security Rule | 9 | Healthcare data protection |
| GDPR (Technical) | 12 | EU data protection |
| CIS Controls v8 | 15 | Critical security controls |

Total: 8 frameworks, 103 controls pre-seeded.

## Security Guards

### Tenant Isolation

- Framework queries: `WHERE id = $1 AND (tenant_id IS NULL OR tenant_id = $2)` — system frameworks visible to all, custom frameworks scoped to tenant
- Update/delete: `AND is_system = FALSE` — system frameworks cannot be modified
- `ListControls` verifies framework ownership before returning controls

### Draft Finding Guard

Draft and in-review findings cannot be mapped to compliance controls:

```go
if finding.Status() == "draft" || finding.Status() == "in_review" {
    return fmt.Errorf("cannot map unconfirmed findings to compliance controls")
}
```

## Permissions (7)

| Permission | Description |
|-----------|-------------|
| `compliance:frameworks:read` | View frameworks and controls |
| `compliance:frameworks:write` | Create/edit custom frameworks |
| `compliance:frameworks:delete` | Delete custom frameworks |
| `compliance:assessments:read` | View assessments |
| `compliance:assessments:write` | Create/update assessments |
| `compliance:mappings:read` | View finding-control mappings |
| `compliance:mappings:write` | Create/delete mappings |

## API Endpoints

### Frameworks

| Method | Path | Permission |
|--------|------|-----------|
| GET | `/api/v1/compliance/frameworks` | frameworks:read |
| POST | `/api/v1/compliance/frameworks` | frameworks:write |
| GET | `/api/v1/compliance/frameworks/{id}` | frameworks:read |
| PUT | `/api/v1/compliance/frameworks/{id}` | frameworks:write |
| DELETE | `/api/v1/compliance/frameworks/{id}` | frameworks:delete |

### Controls

| Method | Path | Permission |
|--------|------|-----------|
| GET | `/api/v1/compliance/frameworks/{id}/controls` | frameworks:read |
| POST | `/api/v1/compliance/frameworks/{id}/controls` | frameworks:write |
| GET | `/api/v1/compliance/controls/{id}` | frameworks:read |
| PUT | `/api/v1/compliance/controls/{id}` | frameworks:write |
| DELETE | `/api/v1/compliance/controls/{id}` | frameworks:delete |

### Assessments

| Method | Path | Permission |
|--------|------|-----------|
| GET | `/api/v1/compliance/frameworks/{id}/assessments` | assessments:read |
| PUT | `/api/v1/compliance/assessments/{controlId}` | assessments:write |
| GET | `/api/v1/compliance/frameworks/{id}/stats` | assessments:read |

### Finding Mappings

| Method | Path | Permission |
|--------|------|-----------|
| POST | `/api/v1/compliance/mappings` | mappings:write |
| DELETE | `/api/v1/compliance/mappings/{id}` | mappings:write |
| GET | `/api/v1/compliance/findings/{id}/controls` | mappings:read |
| GET | `/api/v1/compliance/controls/{id}/findings` | mappings:read |

## Frontend

### API Hooks (`use-compliance-api.ts`)

10 SWR hooks for frameworks, controls, assessments, and mappings.

### Sidebar

Compliance appears under the Scoping section with `ClipboardCheck` icon.
