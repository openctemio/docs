---
title: "Attack surface and EASM permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 13
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# Attack surface and EASM: permissions

External attack surface management: discovery candidates, verified domains, sweeps, attack paths and the scoping summary.

- **CTEM stages:** scoping, discovery, prioritization
- **Modules:** `attack_surface` (the routes answer `403 MODULE_NOT_ENABLED` when the module is off)
- **Permissions:** `assets:read`, `assets:write`, `attack_surface:scope:delete`, `attack_surface:scope:read`, `attack_surface:scope:write`, `settings:read`, `settings:write`

## Who can do it

Built-in roles and role templates whose permissions pass each route. Owner and administrator are included where the route allows them.

| Permission | Roles |
|---|---|
| `assets:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| `assets:write` | Owner, Administrator, Member, AppSec engineer |
| `attack_surface:scope:delete` | Owner, Administrator |
| `attack_surface:scope:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Auditor |
| `attack_surface:scope:write` | Owner, Administrator, Member |
| `settings:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor |
| `settings:write` | Owner, Administrator |

## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| GET | `/api/v1/attack-surface/attack-paths` | `assets:read` | partial: chains dropped unless every hop is in scope; summaries graph-wide |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| GET | `/api/v1/attack-surface/exposure-chains` | `assets:read` | partial: chains dropped unless every hop is in scope; summaries graph-wide |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| GET | `/api/v1/attack-surface/stats` | `assets:read` | partial: chains dropped unless every hop is in scope; summaries graph-wide |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| GET | `/api/v1/easm/candidates` | `assets:read` | partial: summary scoped; candidates are tenant discovery output |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| POST | `/api/v1/easm/candidates/decisions` | `assets:write` | partial: summary scoped; candidates are tenant discovery output |  | Owner, Administrator, Member, AppSec engineer |
| POST | `/api/v1/easm/candidates/rules` | `assets:write` | partial: summary scoped; candidates are tenant discovery output |  | Owner, Administrator, Member, AppSec engineer |
| POST | `/api/v1/easm/candidates/rules/preview` | `assets:read` | partial: summary scoped; candidates are tenant discovery output |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| GET | `/api/v1/easm/candidates/suggestions` | `assets:read` | partial: summary scoped; candidates are tenant discovery output |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| GET | `/api/v1/easm/settings` | `settings:read` | partial: summary scoped; candidates are tenant discovery output |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor |
| PUT | `/api/v1/easm/settings` | `settings:write` | partial: summary scoped; candidates are tenant discovery output |  | Owner, Administrator |
| GET | `/api/v1/easm/summary` | `assets:read` | partial: summary scoped; candidates are tenant discovery output |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| POST | `/api/v1/easm/sweeps` | `attack_surface:scope:write` | partial: summary scoped; candidates are tenant discovery output |  | Owner, Administrator, Member |
| GET | `/api/v1/easm/verified-domains` | `attack_surface:scope:read` | partial: summary scoped; candidates are tenant discovery output |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Auditor |
| POST | `/api/v1/easm/verified-domains` | `attack_surface:scope:write` | partial: summary scoped; candidates are tenant discovery output |  | Owner, Administrator, Member |
| DELETE | `/api/v1/easm/verified-domains/{id}` | `attack_surface:scope:delete` | partial: summary scoped; candidates are tenant discovery output |  | Owner, Administrator |
| POST | `/api/v1/easm/verified-domains/{id}/verify` | `attack_surface:scope:write` | partial: summary scoped; candidates are tenant discovery output |  | Owner, Administrator, Member |
| GET | `/api/v1/scoping/summary` | `assets:read` | config: scoping summary (counts, tenant-wide by design) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
