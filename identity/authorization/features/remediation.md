---
title: "Remediation and automation permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 17
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# Remediation and automation: permissions

Remediation campaigns, suppression and exception rules, assignment rules and automation workflows.

- **CTEM stages:** mobilization
- **Modules:** `remediation`, `suppressions`, `workflows` (the routes answer `403 MODULE_NOT_ENABLED` when the module is off)
- **Permissions:** `findings:read`, `findings:remediation:read`, `findings:remediation:write`, `findings:suppressions:approve`, `findings:suppressions:delete`, `findings:suppressions:read`, `findings:suppressions:write`, `findings:workflows:read`, `findings:workflows:write`, `team:assignment_rules:delete`, `team:assignment_rules:read`, `team:assignment_rules:write`

## Who can do it

Built-in roles and role templates whose permissions pass each route. Owner and administrator are included where the route allows them.

| Permission | Roles |
|---|---|
| `findings:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| `findings:remediation:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| `findings:remediation:write` | Owner, Administrator, Member, Vulnerability manager |
| `findings:suppressions:approve` | Owner, Administrator, CTEM program lead, Risk approver |
| `findings:suppressions:delete` | Owner, Administrator |
| `findings:suppressions:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, AppSec engineer, Risk approver, Auditor |
| `findings:suppressions:write` | Owner, Administrator, Security analyst, Vulnerability manager, AppSec engineer |
| `findings:workflows:read` | Owner, Administrator, Member, Viewer, Security analyst, Vulnerability manager |
| `findings:workflows:write` | Owner, Administrator, Vulnerability manager |
| `team:assignment_rules:delete` | Owner, Administrator |
| `team:assignment_rules:read` | Owner, Administrator, Vulnerability manager |
| `team:assignment_rules:write` | Owner, Administrator, Vulnerability manager |

## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| GET | `/api/v1/assignment-rules` | `team:assignment_rules:read` | config: finding assignment rules |  | Owner, Administrator, Vulnerability manager |
| POST | `/api/v1/assignment-rules` | `team:assignment_rules:write` | config: finding assignment rules |  | Owner, Administrator, Vulnerability manager |
| DELETE | `/api/v1/assignment-rules/{id}` | `team:assignment_rules:delete` + team role owner | config: finding assignment rules |  | Owner |
| GET | `/api/v1/assignment-rules/{id}` | `team:assignment_rules:read` | config: finding assignment rules |  | Owner, Administrator, Vulnerability manager |
| PUT | `/api/v1/assignment-rules/{id}` | `team:assignment_rules:write` | config: finding assignment rules |  | Owner, Administrator, Vulnerability manager |
| POST | `/api/v1/assignment-rules/{id}/test` | `team:assignment_rules:read` | config: finding assignment rules |  | Owner, Administrator, Vulnerability manager |
| GET | `/api/v1/remediation/campaigns` | `findings:remediation:read` | scoped: resolve scoped; campaign progress counts follow the reader (L-18, research 24) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| POST | `/api/v1/remediation/campaigns` | `findings:remediation:write` | scoped: resolve scoped; campaign progress counts follow the reader (L-18, research 24) |  | Owner, Administrator, Member, Vulnerability manager |
| DELETE | `/api/v1/remediation/campaigns/{id}` | `findings:remediation:write` | scoped: resolve scoped; campaign progress counts follow the reader (L-18, research 24) |  | Owner, Administrator, Member, Vulnerability manager |
| GET | `/api/v1/remediation/campaigns/{id}` | `findings:remediation:read` | scoped: resolve scoped; campaign progress counts follow the reader (L-18, research 24) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| PATCH | `/api/v1/remediation/campaigns/{id}` | `findings:remediation:write` | scoped: resolve scoped; campaign progress counts follow the reader (L-18, research 24) |  | Owner, Administrator, Member, Vulnerability manager |
| POST | `/api/v1/remediation/campaigns/{id}/create-ticket` | `findings:remediation:write` | scoped: resolve scoped; campaign progress counts follow the reader (L-18, research 24) |  | Owner, Administrator, Member, Vulnerability manager |
| GET | `/api/v1/remediation/campaigns/{id}/findings` | `findings:read`, `findings:remediation:read` | scoped: resolve scoped; campaign progress counts follow the reader (L-18, research 24) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| POST | `/api/v1/remediation/campaigns/{id}/refresh` | `findings:remediation:write` | scoped: resolve scoped; campaign progress counts follow the reader (L-18, research 24) |  | Owner, Administrator, Member, Vulnerability manager |
| POST | `/api/v1/remediation/campaigns/{id}/resolve` | `findings:remediation:write` | scoped: resolve scoped; campaign progress counts follow the reader (L-18, research 24) |  | Owner, Administrator, Member, Vulnerability manager |
| PATCH | `/api/v1/remediation/campaigns/{id}/status` | `findings:remediation:write` | scoped: resolve scoped; campaign progress counts follow the reader (L-18, research 24) |  | Owner, Administrator, Member, Vulnerability manager |
| GET | `/api/v1/suppressions` | `findings:suppressions:read` | gap: §1.3 suppression rules |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, AppSec engineer, Risk approver, Auditor |
| POST | `/api/v1/suppressions` | `findings:suppressions:write` | gap: §1.3 suppression rules |  | Owner, Administrator, Security analyst, Vulnerability manager, AppSec engineer |
| GET | `/api/v1/suppressions/active` | `findings:suppressions:read` | gap: §1.3 suppression rules |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, AppSec engineer, Risk approver, Auditor |
| DELETE | `/api/v1/suppressions/{id}` | `findings:suppressions:delete` | gap: §1.3 suppression rules |  | Owner, Administrator |
| GET | `/api/v1/suppressions/{id}` | `findings:suppressions:read` | gap: §1.3 suppression rules |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, AppSec engineer, Risk approver, Auditor |
| PUT | `/api/v1/suppressions/{id}` | `findings:suppressions:write` | gap: §1.3 suppression rules |  | Owner, Administrator, Security analyst, Vulnerability manager, AppSec engineer |
| POST | `/api/v1/suppressions/{id}/approve` | `findings:suppressions:approve` | gap: §1.3 suppression rules |  | Owner, Administrator, CTEM program lead, Risk approver |
| POST | `/api/v1/suppressions/{id}/reject` | `findings:suppressions:approve` | gap: §1.3 suppression rules |  | Owner, Administrator, CTEM program lead, Risk approver |
| GET | `/api/v1/workflow-runs` | `findings:workflows:read` | gap: L-18 (trigger data) |  | Owner, Administrator, Member, Viewer, Security analyst, Vulnerability manager |
| GET | `/api/v1/workflow-runs/{id}` | `findings:workflows:read` | gap: L-18 (trigger data) |  | Owner, Administrator, Member, Viewer, Security analyst, Vulnerability manager |
| POST | `/api/v1/workflow-runs/{id}/cancel` | `findings:workflows:write` | gap: L-18 (trigger data) |  | Owner, Administrator, Vulnerability manager |
| GET | `/api/v1/workflows` | `findings:workflows:read` | config: workflow definitions |  | Owner, Administrator, Member, Viewer, Security analyst, Vulnerability manager |
| POST | `/api/v1/workflows` | `findings:workflows:write` | config: workflow definitions |  | Owner, Administrator, Vulnerability manager |
| DELETE | `/api/v1/workflows/{id}` | `findings:workflows:write` | config: workflow definitions |  | Owner, Administrator, Vulnerability manager |
| GET | `/api/v1/workflows/{id}` | `findings:workflows:read` | config: workflow definitions |  | Owner, Administrator, Member, Viewer, Security analyst, Vulnerability manager |
| PUT | `/api/v1/workflows/{id}` | `findings:workflows:write` | config: workflow definitions |  | Owner, Administrator, Vulnerability manager |
| POST | `/api/v1/workflows/{id}/edges` | `findings:workflows:write` | config: workflow definitions |  | Owner, Administrator, Vulnerability manager |
| DELETE | `/api/v1/workflows/{id}/edges/{edgeId}` | `findings:workflows:write` | config: workflow definitions |  | Owner, Administrator, Vulnerability manager |
| PUT | `/api/v1/workflows/{id}/graph` | `findings:workflows:write` | config: workflow definitions |  | Owner, Administrator, Vulnerability manager |
| POST | `/api/v1/workflows/{id}/nodes` | `findings:workflows:write` | config: workflow definitions |  | Owner, Administrator, Vulnerability manager |
| DELETE | `/api/v1/workflows/{id}/nodes/{nodeId}` | `findings:workflows:write` | config: workflow definitions |  | Owner, Administrator, Vulnerability manager |
| PUT | `/api/v1/workflows/{id}/nodes/{nodeId}` | `findings:workflows:write` | config: workflow definitions |  | Owner, Administrator, Vulnerability manager |
| POST | `/api/v1/workflows/{id}/runs` | `findings:workflows:write` | config: workflow definitions |  | Owner, Administrator, Vulnerability manager |
