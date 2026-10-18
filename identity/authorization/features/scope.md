---
title: "Scope permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 14
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# Scope: permissions

What the organization may scan: scope targets, exclusions, approvals and scope settings.

- **CTEM stages:** scoping
- **Modules:** `scope_config` (the routes answer `403 MODULE_NOT_ENABLED` when the module is off)
- **Permissions:** `attack_surface:scope:approve`, `attack_surface:scope:delete`, `attack_surface:scope:exclusions:approve`, `attack_surface:scope:read`, `attack_surface:scope:write`

## Who can do it

Built-in roles and role templates whose permissions pass each route. Owner and administrator are included where the route allows them.

| Permission | Roles |
|---|---|
| `attack_surface:scope:approve` | Owner, Administrator, CTEM program lead |
| `attack_surface:scope:delete` | Owner, Administrator |
| `attack_surface:scope:exclusions:approve` | Owner, Administrator, CTEM program lead |
| `attack_surface:scope:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Scan operator, Sensor operator, Validation engineer, External tester, Bug-bounty triager, Threat intelligence analyst, Auditor |
| `attack_surface:scope:write` | Owner, Administrator, Member |

## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| POST | `/api/v1/scope/check` | `attack_surface:scope:read` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Scan operator, Sensor operator, Validation engineer, External tester, Bug-bounty triager, Threat intelligence analyst, Auditor |
| GET | `/api/v1/scope/exclusions` | `attack_surface:scope:read` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Scan operator, Sensor operator, Validation engineer, External tester, Bug-bounty triager, Threat intelligence analyst, Auditor |
| POST | `/api/v1/scope/exclusions` | `attack_surface:scope:write` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, Member |
| POST | `/api/v1/scope/exclusions/bulk` | `attack_surface:scope:write` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, Member |
| POST | `/api/v1/scope/exclusions/bulk/delete` | `attack_surface:scope:delete` | config: scope targets, exclusions (two-person, L-07) and schedules | yes | Owner, Administrator |
| POST | `/api/v1/scope/exclusions/bulk/preview` | `attack_surface:scope:read` | scoped: counts and names only the caller's visible inventory assets (research/124) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Scan operator, Sensor operator, Validation engineer, External tester, Bug-bounty triager, Threat intelligence analyst, Auditor |
| DELETE | `/api/v1/scope/exclusions/{id}` | `attack_surface:scope:delete` | config: scope targets, exclusions (two-person, L-07) and schedules | yes | Owner, Administrator |
| GET | `/api/v1/scope/exclusions/{id}` | `attack_surface:scope:read` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Scan operator, Sensor operator, Validation engineer, External tester, Bug-bounty triager, Threat intelligence analyst, Auditor |
| PUT | `/api/v1/scope/exclusions/{id}` | `attack_surface:scope:write` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, Member |
| POST | `/api/v1/scope/exclusions/{id}/activate` | `attack_surface:scope:write` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, Member |
| POST | `/api/v1/scope/exclusions/{id}/approve` | `attack_surface:scope:exclusions:approve` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, CTEM program lead |
| POST | `/api/v1/scope/exclusions/{id}/deactivate` | `attack_surface:scope:write` | config: scope targets, exclusions (two-person, L-07) and schedules | yes | Owner, Administrator, Member |
| POST | `/api/v1/scope/exclusions/{id}/reject` | `attack_surface:scope:exclusions:approve` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, CTEM program lead |
| PUT | `/api/v1/scope/exclusions/{id}/testing` | `attack_surface:scope:exclusions:approve` | config: scope targets, exclusions (two-person, L-07) and schedules | yes | Owner, Administrator, CTEM program lead |
| GET | `/api/v1/scope/letters` | `attack_surface:scope:read` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Scan operator, Sensor operator, Validation engineer, External tester, Bug-bounty triager, Threat intelligence analyst, Auditor |
| POST | `/api/v1/scope/letters` | `attack_surface:scope:write` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, Member |
| GET | `/api/v1/scope/letters/{id}/file` | `attack_surface:scope:read` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Scan operator, Sensor operator, Validation engineer, External tester, Bug-bounty triager, Threat intelligence analyst, Auditor |
| POST | `/api/v1/scope/letters/{id}/revoke` | `attack_surface:scope:approve` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, CTEM program lead |
| GET | `/api/v1/scope/settings` | `attack_surface:scope:read` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Scan operator, Sensor operator, Validation engineer, External tester, Bug-bounty triager, Threat intelligence analyst, Auditor |
| PUT | `/api/v1/scope/settings` | `attack_surface:scope:approve` | config: scope targets, exclusions (two-person, L-07) and schedules | yes | Owner, Administrator, CTEM program lead |
| PUT | `/api/v1/scope/settings/intrusive` | `attack_surface:scope:approve` + team role owner | config: scope targets, exclusions (two-person, L-07) and schedules | yes | Owner |
| GET | `/api/v1/scope/stats` | `attack_surface:scope:read` | scoped: inventory coverage counted in SQL over the caller's data scope (research/53 S-3) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Scan operator, Sensor operator, Validation engineer, External tester, Bug-bounty triager, Threat intelligence analyst, Auditor |
| GET | `/api/v1/scope/targets` | `attack_surface:scope:read` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Scan operator, Sensor operator, Validation engineer, External tester, Bug-bounty triager, Threat intelligence analyst, Auditor |
| POST | `/api/v1/scope/targets` | `attack_surface:scope:write` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, Member |
| POST | `/api/v1/scope/targets/bulk` | `attack_surface:scope:write` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, Member |
| POST | `/api/v1/scope/targets/bulk/delete` | `attack_surface:scope:delete` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator |
| POST | `/api/v1/scope/targets/preview` | `attack_surface:scope:write` | scoped: names an entry would confirm, counted over the caller's data scope (RFC-054 §4.3) |  | Owner, Administrator, Member |
| DELETE | `/api/v1/scope/targets/{id}` | `attack_surface:scope:delete` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator |
| GET | `/api/v1/scope/targets/{id}` | `attack_surface:scope:read` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Scan operator, Sensor operator, Validation engineer, External tester, Bug-bounty triager, Threat intelligence analyst, Auditor |
| PUT | `/api/v1/scope/targets/{id}` | `attack_surface:scope:write` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, Member |
| POST | `/api/v1/scope/targets/{id}/activate` | `attack_surface:scope:write` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, Member |
| POST | `/api/v1/scope/targets/{id}/approve` | `attack_surface:scope:approve` | config: scope targets, exclusions (two-person, L-07) and schedules | yes | Owner, Administrator, CTEM program lead |
| POST | `/api/v1/scope/targets/{id}/attest` | `attack_surface:scope:approve` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, CTEM program lead |
| POST | `/api/v1/scope/targets/{id}/deactivate` | `attack_surface:scope:write` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, Member |
| POST | `/api/v1/scope/targets/{id}/reject` | `attack_surface:scope:approve` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, CTEM program lead |
| POST | `/api/v1/scope/targets/{id}/remind` | `attack_surface:scope:write` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, Member |
| POST | `/api/v1/scope/targets/{id}/self-approve` | `attack_surface:scope:approve` | config: scope targets, exclusions (two-person, L-07) and schedules |  | Owner, Administrator, CTEM program lead |
