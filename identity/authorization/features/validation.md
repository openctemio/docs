---
title: "Validation and simulation permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 23
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# Validation and simulation: permissions

Exploitability validation, attack simulations and control tests.

- **CTEM stages:** validation
- **Modules:** `attack_simulation`, `control_testing` (the routes answer `403 MODULE_NOT_ENABLED` when the module is off)
- **Permissions:** `findings:read`, `findings:write`, `validation:read`, `validation:write`

## Who can do it

Built-in roles and role templates whose permissions pass each route. Owner and administrator are included where the route allows them.

| Permission | Roles |
|---|---|
| `findings:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, Remediation lead, AppSec engineer, CI integrator, Scan operator, Validation engineer, Validation lead, Detection engineer, Researcher, Bug-bounty triager, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| `findings:write` | Owner, Administrator, Member, Security analyst, Vulnerability manager, Remediation owner, Remediation lead, AppSec engineer, Validation engineer, Validation lead, Researcher, Bug-bounty triager, Threat intelligence analyst |
| `validation:read` | Owner, Administrator, Member, Viewer, Validation engineer, Validation lead, Detection engineer, Auditor |
| `validation:write` | Owner, Administrator, Member, Validation engineer, Validation lead |

## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| GET | `/api/v1/control-tests` | `validation:read` | config: compensating control tests |  | Owner, Administrator, Member, Viewer, Validation engineer, Validation lead, Detection engineer, Auditor |
| POST | `/api/v1/control-tests` | `validation:write` | config: compensating control tests |  | Owner, Administrator, Member, Validation engineer, Validation lead |
| GET | `/api/v1/control-tests/stats` | `validation:read` | config: compensating control tests |  | Owner, Administrator, Member, Viewer, Validation engineer, Validation lead, Detection engineer, Auditor |
| DELETE | `/api/v1/control-tests/{id}` | `validation:write` | config: compensating control tests |  | Owner, Administrator, Member, Validation engineer, Validation lead |
| PATCH | `/api/v1/control-tests/{id}/result` | `validation:write` | config: compensating control tests |  | Owner, Administrator, Member, Validation engineer, Validation lead |
| GET | `/api/v1/findings/{id}/evidence` | `findings:read` | scoped: route guard on /findings/{id}/**, lists and bulk paths scoped |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, Remediation lead, AppSec engineer, CI integrator, Scan operator, Validation engineer, Validation lead, Detection engineer, Researcher, Bug-bounty triager, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| POST | `/api/v1/findings/{id}/evidence` | `findings:write` | scoped: route guard on /findings/{id}/**, lists and bulk paths scoped |  | Owner, Administrator, Member, Security analyst, Vulnerability manager, Remediation owner, Remediation lead, AppSec engineer, Validation engineer, Validation lead, Researcher, Bug-bounty triager, Threat intelligence analyst |
| GET | `/api/v1/findings/{id}/evidence/notes` | `findings:read` | scoped: route guard on /findings/{id}/**, lists and bulk paths scoped |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, Remediation lead, AppSec engineer, CI integrator, Scan operator, Validation engineer, Validation lead, Detection engineer, Researcher, Bug-bounty triager, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| DELETE | `/api/v1/findings/{id}/evidence/notes/{noteId}` | `findings:write` | scoped: route guard on /findings/{id}/**, lists and bulk paths scoped |  | Owner, Administrator, Member, Security analyst, Vulnerability manager, Remediation owner, Remediation lead, AppSec engineer, Validation engineer, Validation lead, Researcher, Bug-bounty triager, Threat intelligence analyst |
| GET | `/api/v1/simulations` | `validation:read` | gap: §1.3 validation and simulation |  | Owner, Administrator, Member, Viewer, Validation engineer, Validation lead, Detection engineer, Auditor |
| POST | `/api/v1/simulations` | `validation:write` | gap: §1.3 validation and simulation |  | Owner, Administrator, Member, Validation engineer, Validation lead |
| DELETE | `/api/v1/simulations/{id}` | `validation:write` | gap: §1.3 validation and simulation |  | Owner, Administrator, Member, Validation engineer, Validation lead |
| GET | `/api/v1/simulations/{id}` | `validation:read` | gap: §1.3 validation and simulation |  | Owner, Administrator, Member, Viewer, Validation engineer, Validation lead, Detection engineer, Auditor |
| PUT | `/api/v1/simulations/{id}` | `validation:write` | gap: §1.3 validation and simulation |  | Owner, Administrator, Member, Validation engineer, Validation lead |
| POST | `/api/v1/simulations/{id}/run` | `validation:write` | gap: §1.3 validation and simulation |  | Owner, Administrator, Member, Validation engineer, Validation lead |
| GET | `/api/v1/simulations/{id}/runs` | `validation:read` | gap: §1.3 validation and simulation |  | Owner, Administrator, Member, Viewer, Validation engineer, Validation lead, Detection engineer, Auditor |
| GET | `/api/v1/validation/coverage` | `findings:read` | gap: §1.3 validation coverage |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, Remediation lead, AppSec engineer, CI integrator, Scan operator, Validation engineer, Validation lead, Detection engineer, Researcher, Bug-bounty triager, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| POST | `/api/v1/validation/evidence` | no permission: sensor API-key auth | system: sensor evidence upload (sensor key) |  | see Requires |
