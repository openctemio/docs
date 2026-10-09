---
title: "CTEM program permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 15
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# CTEM program: permissions

The program layer: CTEM cycles, business services and units, attacker profiles, compensating controls and threat models.

- **CTEM stages:** scoping, prioritization
- **Modules:** `attacker_profiles`, `business_services`, `business_units`, `compensating_controls`, `ctem_cycles`, `threat_model` (the routes answer `403 MODULE_NOT_ENABLED` when the module is off)
- **Permissions:** `assets:read`, `assets:write`, `ctem:attacker_profiles:read`, `ctem:attacker_profiles:write`, `ctem:business_services:read`, `ctem:business_services:write`, `ctem:compensating_controls:read`, `ctem:compensating_controls:write`, `ctem:cycles:read`, `ctem:cycles:write`

## Who can do it

Built-in roles and role templates whose permissions pass each route. Owner and administrator are included where the route allows them.

| Permission | Roles |
|---|---|
| `assets:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| `assets:write` | Owner, Administrator, Member, AppSec engineer |
| `ctem:attacker_profiles:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Validation engineer, Threat intelligence analyst |
| `ctem:attacker_profiles:write` | Owner, Administrator, CTEM program lead, Threat intelligence analyst |
| `ctem:business_services:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Risk approver, Auditor, Executive viewer |
| `ctem:business_services:write` | Owner, Administrator, Member, CTEM program lead |
| `ctem:compensating_controls:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Validation engineer, Risk approver, Auditor |
| `ctem:compensating_controls:write` | Owner, Administrator, Member, CTEM program lead |
| `ctem:cycles:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Risk approver, Auditor, Executive viewer |
| `ctem:cycles:write` | Owner, Administrator, Member, CTEM program lead |

## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| GET | `/api/v1/attacker-profiles` | `ctem:attacker_profiles:read` | config: attacker profiles |  | Owner, Administrator, Member, Viewer, CTEM program lead, Validation engineer, Threat intelligence analyst |
| POST | `/api/v1/attacker-profiles` | `ctem:attacker_profiles:write` | config: attacker profiles |  | Owner, Administrator, CTEM program lead, Threat intelligence analyst |
| DELETE | `/api/v1/attacker-profiles/{id}` | `ctem:attacker_profiles:write` | config: attacker profiles |  | Owner, Administrator, CTEM program lead, Threat intelligence analyst |
| GET | `/api/v1/attacker-profiles/{id}` | `ctem:attacker_profiles:read` | config: attacker profiles |  | Owner, Administrator, Member, Viewer, CTEM program lead, Validation engineer, Threat intelligence analyst |
| PUT | `/api/v1/attacker-profiles/{id}` | `ctem:attacker_profiles:write` | config: attacker profiles |  | Owner, Administrator, CTEM program lead, Threat intelligence analyst |
| GET | `/api/v1/business-services` | `ctem:business_services:read` | partial: asset links scoped (L-10); the service list is tenant configuration |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Risk approver, Auditor, Executive viewer |
| POST | `/api/v1/business-services` | `ctem:business_services:write` | partial: asset links scoped (L-10); the service list is tenant configuration |  | Owner, Administrator, Member, CTEM program lead |
| DELETE | `/api/v1/business-services/{id}` | `ctem:business_services:write` | partial: asset links scoped (L-10); the service list is tenant configuration |  | Owner, Administrator, Member, CTEM program lead |
| GET | `/api/v1/business-services/{id}` | `ctem:business_services:read` | partial: asset links scoped (L-10); the service list is tenant configuration |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Risk approver, Auditor, Executive viewer |
| PUT | `/api/v1/business-services/{id}` | `ctem:business_services:write` | partial: asset links scoped (L-10); the service list is tenant configuration |  | Owner, Administrator, Member, CTEM program lead |
| GET | `/api/v1/business-services/{id}/assets` | `ctem:business_services:read` | partial: asset links scoped (L-10); the service list is tenant configuration |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Risk approver, Auditor, Executive viewer |
| POST | `/api/v1/business-services/{id}/assets` | `ctem:business_services:write` | partial: asset links scoped (L-10); the service list is tenant configuration |  | Owner, Administrator, Member, CTEM program lead |
| DELETE | `/api/v1/business-services/{id}/assets/{assetId}` | `ctem:business_services:write` | partial: asset links scoped (L-10); the service list is tenant configuration |  | Owner, Administrator, Member, CTEM program lead |
| GET | `/api/v1/business-units` | `assets:read` | partial: asset links scoped (L-10); the unit list and counts are tenant-wide |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| POST | `/api/v1/business-units` | `assets:write` | partial: asset links scoped (L-10); the unit list and counts are tenant-wide |  | Owner, Administrator, Member, AppSec engineer |
| DELETE | `/api/v1/business-units/{id}` | `assets:write` + team role admin | partial: asset links scoped (L-10); the unit list and counts are tenant-wide |  | Owner, Administrator |
| GET | `/api/v1/business-units/{id}` | `assets:read` | partial: asset links scoped (L-10); the unit list and counts are tenant-wide |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| PUT | `/api/v1/business-units/{id}` | `assets:write` | partial: asset links scoped (L-10); the unit list and counts are tenant-wide |  | Owner, Administrator, Member, AppSec engineer |
| POST | `/api/v1/business-units/{id}/assets` | `assets:write` | partial: asset links scoped (L-10); the unit list and counts are tenant-wide |  | Owner, Administrator, Member, AppSec engineer |
| DELETE | `/api/v1/business-units/{id}/assets/{assetId}` | `assets:write` | partial: asset links scoped (L-10); the unit list and counts are tenant-wide |  | Owner, Administrator, Member, AppSec engineer |
| GET | `/api/v1/compensating-controls` | `ctem:compensating_controls:read` | config: compensating controls |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Validation engineer, Risk approver, Auditor |
| POST | `/api/v1/compensating-controls` | `ctem:compensating_controls:write` | config: compensating controls |  | Owner, Administrator, Member, CTEM program lead |
| DELETE | `/api/v1/compensating-controls/{id}` | `ctem:compensating_controls:write` | config: compensating controls |  | Owner, Administrator, Member, CTEM program lead |
| GET | `/api/v1/compensating-controls/{id}` | `ctem:compensating_controls:read` | config: compensating controls |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Validation engineer, Risk approver, Auditor |
| PUT | `/api/v1/compensating-controls/{id}` | `ctem:compensating_controls:write` | config: compensating controls |  | Owner, Administrator, Member, CTEM program lead |
| POST | `/api/v1/compensating-controls/{id}/assets` | `ctem:compensating_controls:write` | config: compensating controls |  | Owner, Administrator, Member, CTEM program lead |
| POST | `/api/v1/compensating-controls/{id}/findings` | `ctem:compensating_controls:write` | config: compensating controls |  | Owner, Administrator, Member, CTEM program lead |
| POST | `/api/v1/compensating-controls/{id}/test` | `ctem:compensating_controls:write` | config: compensating controls |  | Owner, Administrator, Member, CTEM program lead |
| GET | `/api/v1/ctem-cycles` | `ctem:cycles:read` | partial: scope snapshot scoped (L-10); cycle metrics are tenant-wide counts |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Risk approver, Auditor, Executive viewer |
| POST | `/api/v1/ctem-cycles` | `ctem:cycles:write` | partial: scope snapshot scoped (L-10); cycle metrics are tenant-wide counts |  | Owner, Administrator, Member, CTEM program lead |
| GET | `/api/v1/ctem-cycles/metrics/trend` | `ctem:cycles:read` | partial: scope snapshot scoped (L-10); cycle metrics are tenant-wide counts |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Risk approver, Auditor, Executive viewer |
| GET | `/api/v1/ctem-cycles/{id}` | `ctem:cycles:read` | partial: scope snapshot scoped (L-10); cycle metrics are tenant-wide counts |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Risk approver, Auditor, Executive viewer |
| PUT | `/api/v1/ctem-cycles/{id}` | `ctem:cycles:write` | partial: scope snapshot scoped (L-10); cycle metrics are tenant-wide counts |  | Owner, Administrator, Member, CTEM program lead |
| POST | `/api/v1/ctem-cycles/{id}/activate` | `ctem:cycles:write` | partial: scope snapshot scoped (L-10); cycle metrics are tenant-wide counts |  | Owner, Administrator, Member, CTEM program lead |
| POST | `/api/v1/ctem-cycles/{id}/close` | `ctem:cycles:write` | partial: scope snapshot scoped (L-10); cycle metrics are tenant-wide counts |  | Owner, Administrator, Member, CTEM program lead |
| GET | `/api/v1/ctem-cycles/{id}/metrics` | `ctem:cycles:read` | partial: scope snapshot scoped (L-10); cycle metrics are tenant-wide counts |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Risk approver, Auditor, Executive viewer |
| GET | `/api/v1/ctem-cycles/{id}/profiles` | `ctem:cycles:read` | partial: scope snapshot scoped (L-10); cycle metrics are tenant-wide counts |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Risk approver, Auditor, Executive viewer |
| POST | `/api/v1/ctem-cycles/{id}/profiles` | `ctem:cycles:write` | partial: scope snapshot scoped (L-10); cycle metrics are tenant-wide counts |  | Owner, Administrator, Member, CTEM program lead |
| DELETE | `/api/v1/ctem-cycles/{id}/profiles/{profileId}` | `ctem:cycles:write` | partial: scope snapshot scoped (L-10); cycle metrics are tenant-wide counts |  | Owner, Administrator, Member, CTEM program lead |
| GET | `/api/v1/ctem-cycles/{id}/scope` | `ctem:cycles:read` | partial: scope snapshot scoped (L-10); cycle metrics are tenant-wide counts |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Risk approver, Auditor, Executive viewer |
| POST | `/api/v1/ctem-cycles/{id}/scope-refinement` | `ctem:cycles:write` | partial: scope snapshot scoped (L-10); cycle metrics are tenant-wide counts |  | Owner, Administrator, Member, CTEM program lead |
| POST | `/api/v1/ctem-cycles/{id}/start-review` | `ctem:cycles:write` | partial: scope snapshot scoped (L-10); cycle metrics are tenant-wide counts |  | Owner, Administrator, Member, CTEM program lead |
| GET | `/api/v1/threat-models` | `assets:read` | scoped: threat model scope (L-10) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| POST | `/api/v1/threat-models/generate` | `assets:write` | scoped: threat model scope (L-10) |  | Owner, Administrator, Member, AppSec engineer |
| GET | `/api/v1/threat-models/{id}` | `assets:read` | scoped: threat model scope (L-10) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| GET | `/api/v1/threat-models/{id}/coverage` | `assets:read` | scoped: threat model scope (L-10) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
