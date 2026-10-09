---
title: "Dashboards and reports permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 25
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# Dashboards and reports: permissions

Dashboards, personal dashboards and scheduled reports.

- **CTEM stages:** mobilization
- **Modules:** `reports` (the routes answer `403 MODULE_NOT_ENABLED` when the module is off)
- **Permissions:** `dashboard:read`, `reports:read`, `reports:write`

## Who can do it

Built-in roles and role templates whose permissions pass each route. Owner and administrator are included where the route allows them.

| Permission | Roles |
|---|---|
| `dashboard:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| `reports:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, AppSec engineer, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| `reports:write` | Owner, Administrator, Member, CTEM program lead, Vulnerability manager, Risk approver |

## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| GET | `/api/v1/dashboard/data-quality` | `dashboard:read` | partial: activity and top risks scoped; counts and trends tenant-wide until P1-4 (D6) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| GET | `/api/v1/dashboard/executive-summary` | `dashboard:read` | partial: activity and top risks scoped; counts and trends tenant-wide until P1-4 (D6) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| GET | `/api/v1/dashboard/executive-summary/export` | `dashboard:read` | partial: activity and top risks scoped; counts and trends tenant-wide until P1-4 (D6) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| GET | `/api/v1/dashboard/mttr` | `dashboard:read` | partial: activity and top risks scoped; counts and trends tenant-wide until P1-4 (D6) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| GET | `/api/v1/dashboard/mttr-analytics` | `dashboard:read` | partial: activity and top risks scoped; counts and trends tenant-wide until P1-4 (D6) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| GET | `/api/v1/dashboard/process-metrics` | `dashboard:read` | partial: activity and top risks scoped; counts and trends tenant-wide until P1-4 (D6) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| GET | `/api/v1/dashboard/program-metrics` | `dashboard:read` | partial: activity and top risks scoped; counts and trends tenant-wide until P1-4 (D6) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| GET | `/api/v1/dashboard/risk-trend` | `dashboard:read` | partial: activity and top risks scoped; counts and trends tenant-wide until P1-4 (D6) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| GET | `/api/v1/dashboard/stats` | `dashboard:read` | partial: activity and top risks scoped; counts and trends tenant-wide until P1-4 (D6) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| GET | `/api/v1/dashboard/velocity` | `dashboard:read` | partial: activity and top risks scoped; counts and trends tenant-wide until P1-4 (D6) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| GET | `/api/v1/me/dashboards` | no permission: self-scoped: /me/* reads the caller's own perms/modules/roles | system: the caller's own permissions, groups and assets |  | see Requires |
| POST | `/api/v1/me/dashboards` | no permission: self-scoped: /me/* reads the caller's own perms/modules/roles | system: the caller's own permissions, groups and assets |  | see Requires |
| DELETE | `/api/v1/me/dashboards/{id}` | no permission: self-scoped: /me/* reads the caller's own perms/modules/roles | system: the caller's own permissions, groups and assets |  | see Requires |
| GET | `/api/v1/me/dashboards/{id}` | no permission: self-scoped: /me/* reads the caller's own perms/modules/roles | system: the caller's own permissions, groups and assets |  | see Requires |
| PUT | `/api/v1/me/dashboards/{id}` | no permission: self-scoped: /me/* reads the caller's own perms/modules/roles | system: the caller's own permissions, groups and assets |  | see Requires |
| POST | `/api/v1/me/dashboards/{id}/default` | no permission: self-scoped: /me/* reads the caller's own perms/modules/roles | system: the caller's own permissions, groups and assets |  | see Requires |
| GET | `/api/v1/reports/schedules` | `reports:read` | gap: L-19 (scheduled reports; P1-4/P1-5) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, AppSec engineer, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| POST | `/api/v1/reports/schedules` | `reports:write` | gap: L-19 (scheduled reports; P1-4/P1-5) |  | Owner, Administrator, Member, CTEM program lead, Vulnerability manager, Risk approver |
| DELETE | `/api/v1/reports/schedules/{id}` | `reports:write` | gap: L-19 (scheduled reports; P1-4/P1-5) |  | Owner, Administrator, Member, CTEM program lead, Vulnerability manager, Risk approver |
| GET | `/api/v1/reports/schedules/{id}` | `reports:read` | gap: L-19 (scheduled reports; P1-4/P1-5) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, AppSec engineer, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| PATCH | `/api/v1/reports/schedules/{id}/toggle` | `reports:write` | gap: L-19 (scheduled reports; P1-4/P1-5) |  | Owner, Administrator, Member, CTEM program lead, Vulnerability manager, Risk approver |
