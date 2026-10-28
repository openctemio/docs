---
title: "Authorization reference"
parent: "Identity and access"
nav_order: 3
has_children: true
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# Authorization reference

Every request inside an organization passes up to five checks, in this order:

1. **Permission** (what you may do): the union of the permissions of your roles. Owners and administrators pass every permission check.
2. **Module**: the feature is enabled for the organization. A module switch is a feature setting, not a security boundary.
3. **Data scope** (what you may see): the assets of your teams, plus any per-asset grant, unless a role gives full data access. An asset outside your scope answers 404, never 403.
4. **Step-up**: some actions need a recent sign-in.
5. **Approval**: some changes need a second person (risk acceptance, false positives, suppression rules, scope changes).

A refused permission answers 403 with `details.missing_permissions` (or `details.any_of`, `details.required_role`), so you can tell an administrator exactly what to grant.

- [Role and permission matrix](roles-matrix.md): the built-in roles, the role templates and every permission.
- [Personas](personas.md): who uses OpenCTEM and the roles, team and data scope recommended for each.

## Features

| Feature | Modules | Routes |
|---|---|---|
| [Findings](features/findings.md) | `ai_triage` | 157 |
| [Exposures and leaked credentials](features/exposures.md) | `credentials`, `exposures` | 30 |
| [Assets and inventory](features/assets.md) | `branches`, `components`, `relationships` | 133 |
| [Attack surface and EASM](features/attack-surface.md) | `attack_surface` | 31 |
| [Scope](features/scope.md) | `scope_config` | 37 |
| [Bug-bounty programs](features/programs.md) | `scope_config` | 20 |
| [CTEM program](features/ctem-program.md) | `attacker_profiles`, `business_services`, `business_units`, `compensating_controls`, `ctem_cycles`, `threat_model` | 46 |
| [Prioritization and SLAs](features/prioritization.md) | `priority_rules` | 13 |
| [Remediation and automation](features/remediation.md) | `remediation`, `suppressions`, `workflows` | 95 |
| [Scans and workflows](features/scans.md) | `scan_workflows`, `scanner_templates`, `scans`, `template_sources` | 182 |
| [Sensors and scan zones](features/sensors.md) |  | 102 |
| [CI pipelines](features/ci.md) | `scans` | 47 |
| [Penetration testing](features/pentest.md) | `pentest` | 42 |
| [Validation and simulation](features/validation.md) | `attack_simulation`, `control_testing` | 18 |
| [Threat intelligence](features/threat-intel.md) | `iocs`, `threat_intel` | 22 |
| [Compliance](features/compliance.md) | `compliance` | 12 |
| [Dashboards and reports](features/dashboards-reports.md) | `reports` | 43 |
| [Integrations and API keys](features/integrations.md) | `integrations`, `scans` | 67 |
| [Members, roles and teams](features/access.md) |  | 95 |
| [Organization settings and audit](features/organization.md) |  | 90 |
| [MCP and AI clients](features/mcp.md) |  | 28 |
| [Sign-in and own account](features/account.md) |  | 60 |
| [Platform admin console](features/admin-console.md) |  | 200 |
| [System endpoints](features/system.md) |  | 14 |

## Data scope classes

| Class | Meaning |
|---|---|
| `scoped` | Rows come from assets and are limited to the caller's data scope; another asset by id answers 404. |
| `partial` | Rows are limited to the data scope; some counts or summaries are organization-wide by design. |
| `gap` | Asset-derived data not yet limited to the data scope (tracked). |
| `separate` | Another access model decides (for example pentest campaign membership). |
| `config` | Organization configuration or administration, not asset data; the permission alone decides. |
| `system` | Authentication, the caller's own data, machine protocols, catalogs or public endpoints. |
