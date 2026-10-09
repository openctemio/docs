---
title: "Prioritization and SLAs permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 16
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# Prioritization and SLAs: permissions

Priority rules and SLA policies that decide what is fixed first and by when.

- **CTEM stages:** prioritization
- **Modules:** `priority_rules`, `sla` (the routes answer `403 MODULE_NOT_ENABLED` when the module is off)
- **Permissions:** `assets:read`, `ctem:priority_rules:read`, `ctem:priority_rules:write`, `settings:sla:delete`, `settings:sla:read`, `settings:sla:write`

## Who can do it

Built-in roles and role templates whose permissions pass each route. Owner and administrator are included where the route allows them.

| Permission | Roles |
|---|---|
| `assets:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| `ctem:priority_rules:read` | Owner, Administrator, CTEM program lead, Vulnerability manager, Auditor |
| `ctem:priority_rules:write` | Owner, Administrator, CTEM program lead |
| `settings:sla:delete` | Owner, Administrator |
| `settings:sla:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Risk approver, Auditor, Executive viewer |
| `settings:sla:write` | Owner, Administrator, CTEM program lead |

## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| GET | `/api/v1/assets/{assetId}/sla-policy` | `assets:read` | scoped: route guard on /assets/{id}/**, list, stats and facets scoped (RFC-042 F10) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| GET | `/api/v1/priority-rules` | `ctem:priority_rules:read` | config: priority rules |  | Owner, Administrator, CTEM program lead, Vulnerability manager, Auditor |
| POST | `/api/v1/priority-rules` | `ctem:priority_rules:write` | config: priority rules |  | Owner, Administrator, CTEM program lead |
| POST | `/api/v1/priority-rules/dry-run` | `ctem:priority_rules:read` | config: priority rules |  | Owner, Administrator, CTEM program lead, Vulnerability manager, Auditor |
| DELETE | `/api/v1/priority-rules/{id}` | `ctem:priority_rules:write` | config: priority rules |  | Owner, Administrator, CTEM program lead |
| GET | `/api/v1/priority-rules/{id}` | `ctem:priority_rules:read` | config: priority rules |  | Owner, Administrator, CTEM program lead, Vulnerability manager, Auditor |
| PUT | `/api/v1/priority-rules/{id}` | `ctem:priority_rules:write` | config: priority rules |  | Owner, Administrator, CTEM program lead |
| GET | `/api/v1/sla-policies` | `settings:sla:read` | config: SLA policies |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Risk approver, Auditor, Executive viewer |
| POST | `/api/v1/sla-policies` | `settings:sla:write` | config: SLA policies |  | Owner, Administrator, CTEM program lead |
| GET | `/api/v1/sla-policies/default` | `settings:sla:read` | config: SLA policies |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Risk approver, Auditor, Executive viewer |
| DELETE | `/api/v1/sla-policies/{id}` | `settings:sla:delete` | config: SLA policies |  | Owner, Administrator |
| GET | `/api/v1/sla-policies/{id}` | `settings:sla:read` | config: SLA policies |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Risk approver, Auditor, Executive viewer |
| PUT | `/api/v1/sla-policies/{id}` | `settings:sla:write` | config: SLA policies |  | Owner, Administrator, CTEM program lead |
