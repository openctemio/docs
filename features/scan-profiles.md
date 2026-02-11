---
layout: default
title: Scan Profiles
parent: Features
nav_order: 5
---

# Scan Profiles

## Overview

Scan Profiles are reusable configurations that define how security scans should be executed. They control which tools are enabled, their settings, intensity levels, and quality gate thresholds.

## Profile Types

### System Profiles (Platform-Provided)

System profiles are pre-configured by the platform and available to all tenants. They cannot be edited or deleted, but can be:
- **Used directly** in scans
- **Cloned** to create a customized tenant profile

| Profile | Use Case | Tools | Quality Gate |
|---------|----------|-------|--------------|
| **Quick Discovery** | Fast recon | subfinder, httpx | Disabled |
| **Full SAST** | Code analysis | semgrep | MaxCritical: 0, MaxHigh: 5 |
| **Secret Detection** | Find secrets | gitleaks, trufflehog | FailOnCritical |
| **Container Security** | Image scanning | trivy | MaxCritical: 0 |
| **Web Vulnerability** | Web app testing | nuclei | MaxCritical: 0, MaxHigh: 10 |
| **CI/CD Strict** | Pipeline gates | semgrep, gitleaks, trivy | FailOnCritical, FailOnHigh |
| **Compliance Scan** | Regulatory | all tools | MaxTotal: 0 |

### Tenant Profiles (User-Created)

Tenants can create custom profiles with full control over:
- Tool selection and configuration
- Quality gate thresholds
- Template selection (default, custom, or both)

## Quality Gates

Quality Gates enable CI/CD pass/fail decisions based on finding thresholds.

### Configuration Options

```json
{
  "quality_gate": {
    "enabled": true,
    "fail_on_critical": true,
    "fail_on_high": false,
    "max_critical": 0,
    "max_high": 5,
    "max_medium": -1,
    "max_total": -1,
    "new_findings_only": false,
    "baseline_branch": "main"
  }
}
```

### Threshold Values

| Setting | Description | Default |
|---------|-------------|---------|
| `enabled` | Enable quality gate evaluation | `false` |
| `fail_on_critical` | Fail immediately if any critical | `false` |
| `fail_on_high` | Fail immediately if any high | `false` |
| `max_critical` | Maximum critical findings (-1 = unlimited) | `-1` |
| `max_high` | Maximum high findings | `-1` |
| `max_medium` | Maximum medium findings | `-1` |
| `max_total` | Maximum total findings | `-1` |
| `new_findings_only` | Only count new findings | `false` |
| `baseline_branch` | Branch for comparison | `""` |

### Quality Gate Presets

#### Strict (CI/CD Blocking)
```json
{
  "fail_on_critical": true,
  "fail_on_high": true,
  "max_critical": 0,
  "max_high": 0,
  "max_medium": 5
}
```

#### Moderate (Warning on High)
```json
{
  "fail_on_critical": true,
  "max_critical": 0,
  "max_high": 10,
  "max_medium": -1
}
```

#### Lenient (Critical Only)
```json
{
  "fail_on_critical": true,
  "max_critical": 5,
  "max_high": -1,
  "max_medium": -1
}
```

## Template Modes

Scan profiles support three template modes for tools that use templates (Nuclei, Semgrep, Gitleaks):

### Default Templates Only
Use the tool's built-in/official templates.
```json
{
  "template_mode": "default"
}
```

### Custom Templates Only
Use only tenant-uploaded custom templates.
```json
{
  "template_mode": "custom",
  "custom_template_ids": ["tpl-1", "tpl-2"]
}
```

### Both (Merged)
Run both default and custom templates together.
```json
{
  "template_mode": "both",
  "custom_template_ids": ["tpl-1", "tpl-2"]
}
```

## API Reference

### Create Profile
```http
POST /api/v1/scan-profiles
Content-Type: application/json

{
  "name": "My CI Profile",
  "description": "For CI/CD pipelines",
  "intensity": "medium",
  "tools_config": {
    "semgrep": {
      "enabled": true,
      "severity": "high",
      "template_mode": "both",
      "custom_template_ids": []
    },
    "gitleaks": {
      "enabled": true,
      "template_mode": "default"
    }
  },
  "quality_gate": {
    "enabled": true,
    "fail_on_critical": true,
    "max_critical": 0,
    "max_high": 5
  }
}
```

### Update Quality Gate
```http
PUT /api/v1/scan-profiles/{id}/quality-gate
Content-Type: application/json

{
  "enabled": true,
  "fail_on_critical": true,
  "fail_on_high": false,
  "max_critical": 0,
  "max_high": 10,
  "max_medium": -1,
  "max_total": -1
}
```

### Evaluate Quality Gate
```http
POST /api/v1/scan-profiles/{id}/evaluate-quality-gate
Content-Type: application/json

{
  "counts": {
    "critical": 2,
    "high": 5,
    "medium": 10,
    "low": 20,
    "info": 50
  }
}
```

Response:
```json
{
  "passed": false,
  "reason": "Quality gate thresholds exceeded",
  "breaches": [
    {"metric": "critical", "limit": 0, "actual": 2}
  ],
  "counts": {
    "critical": 2,
    "high": 5,
    "medium": 10,
    "low": 20,
    "info": 50,
    "total": 87
  }
}
```

### Clone System Profile
```http
POST /api/v1/scan-profiles/{system_profile_id}/clone
Content-Type: application/json

{
  "name": "My Custom Profile"
}
```

### List Profiles
```http
GET /api/v1/scan-profiles?include_system=true
```

Response includes both system and tenant profiles:
```json
{
  "items": [
    {
      "id": "...",
      "name": "CI/CD Strict",
      "is_system": true,
      "is_default": false,
      "quality_gate": {...}
    },
    {
      "id": "...",
      "name": "My Custom Profile",
      "is_system": false,
      "is_default": true,
      "quality_gate": {...}
    }
  ]
}
```

## Pipeline Integration

When a scan completes, the quality gate is automatically evaluated:

```
Pipeline Run Completed
    │
    ▼
Get Scan Profile
    │
    ▼
QualityGate.Enabled?
    │
    ├── No → Pass (no evaluation)
    │
    └── Yes → Get Finding Counts
              │
              ▼
        Evaluate Thresholds
              │
              ▼
        Store Result in Run
              │
              ▼
        Return in API Response
```

### Checking Results

Pipeline run response includes quality gate result:
```json
{
  "id": "run-123",
  "status": "completed",
  "quality_gate_result": {
    "passed": false,
    "breaches": [
      {"metric": "critical", "limit": 0, "actual": 3}
    ]
  }
}
```

## Profile Ownership & Access Control

### System Profiles
- **Cannot be modified**: Any attempt to update or delete a system profile will return a 403 Forbidden error
- **Available to all tenants**: System profiles are visible and usable by all tenants
- **Clone to customize**: To customize a system profile, clone it first to create a tenant-owned copy

### Tenant Profiles
- **Tenant-scoped**: Each profile belongs to a specific tenant
- **Owner validation**: Only the owning tenant can modify or delete their profiles
- **Cross-tenant isolation**: Tenants cannot see or access other tenants' profiles

### API Validation
When trying to modify a profile:
```json
// Attempting to edit a system profile
PUT /api/v1/scan-profiles/{system-profile-id}
Response: 403 Forbidden
{
  "error": "System profiles cannot be modified; clone it first to customize"
}

// Attempting to edit another tenant's profile
PUT /api/v1/scan-profiles/{other-tenant-profile-id}
Response: 403 Forbidden
{
  "error": "Profile belongs to another tenant"
}
```

## Best Practices

1. **Start with System Profiles**: Use platform profiles as starting points
2. **Clone for Customization**: Clone system profiles rather than creating from scratch
3. **Use Quality Gates in CI/CD**: Enable strict gates for production branches
4. **Set Realistic Thresholds**: Don't set all limits to 0 initially
5. **Use `new_findings_only`**: Avoid breaking builds on existing issues
6. **Review Breaches**: When quality gate fails, review specific breaches
7. **Template Mode Selection**: Use "default" for standard coverage, "custom" for specialized rules, "both" for comprehensive scanning

## Permissions

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| View System Profiles | ✓ | ✓ | ✓ | ✓ |
| Use System Profiles | ✓ | ✓ | ✓ | ✗ |
| Clone System Profiles | ✓ | ✓ | ✓ | ✗ |
| Create Custom Profiles | ✓ | ✓ | ✗ | ✗ |
| Edit Own Profiles | ✓ | ✓ | ✓ | ✗ |
| Delete Own Profiles | ✓ | ✓ | ✗ | ✗ |
| Set Default Profile | ✓ | ✓ | ✗ | ✗ |
