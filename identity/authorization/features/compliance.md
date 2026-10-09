---
title: "Compliance permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 24
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# Compliance: permissions

Compliance frameworks, assessments and control mappings.

- **CTEM stages:** mobilization
- **Modules:** `compliance` (the routes answer `403 MODULE_NOT_ENABLED` when the module is off)
- **Permissions:** `compliance:assessments:read`, `compliance:assessments:write`, `compliance:frameworks:read`, `compliance:mappings:read`, `compliance:mappings:write`

## Who can do it

Built-in roles and role templates whose permissions pass each route. Owner and administrator are included where the route allows them.

| Permission | Roles |
|---|---|
| `compliance:assessments:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Risk approver, Auditor |
| `compliance:assessments:write` | Owner, Administrator, Member, Risk approver |
| `compliance:frameworks:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Risk approver, Auditor |
| `compliance:mappings:read` | Owner, Administrator, Member, Viewer, Risk approver, Auditor |
| `compliance:mappings:write` | Owner, Administrator, Member, Risk approver |

## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| GET | `/api/v1/compliance/assessments` | `compliance:assessments:read` | config: framework and control catalog, assessments |  | Owner, Administrator, Member, Viewer, CTEM program lead, Risk approver, Auditor |
| GET | `/api/v1/compliance/controls/{id}` | `compliance:frameworks:read` | config: framework and control catalog, assessments |  | Owner, Administrator, Member, Viewer, CTEM program lead, Risk approver, Auditor |
| POST | `/api/v1/compliance/controls/{id}/assess` | `compliance:assessments:write` | config: framework and control catalog, assessments |  | Owner, Administrator, Member, Risk approver |
| GET | `/api/v1/compliance/findings/{findingId}/controls` | `compliance:mappings:read` | scoped: route guard on /compliance/findings/{id}/** |  | Owner, Administrator, Member, Viewer, Risk approver, Auditor |
| POST | `/api/v1/compliance/findings/{findingId}/controls` | `compliance:mappings:write` | scoped: route guard on /compliance/findings/{id}/** |  | Owner, Administrator, Member, Risk approver |
| POST | `/api/v1/compliance/findings/{findingId}/controls/auto-map` | `compliance:mappings:write` | scoped: route guard on /compliance/findings/{id}/** |  | Owner, Administrator, Member, Risk approver |
| DELETE | `/api/v1/compliance/findings/{findingId}/controls/{mappingId}` | `compliance:mappings:write` | scoped: route guard on /compliance/findings/{id}/** |  | Owner, Administrator, Member, Risk approver |
| GET | `/api/v1/compliance/frameworks` | `compliance:frameworks:read` | config: framework and control catalog, assessments |  | Owner, Administrator, Member, Viewer, CTEM program lead, Risk approver, Auditor |
| GET | `/api/v1/compliance/frameworks/{id}` | `compliance:frameworks:read` | config: framework and control catalog, assessments |  | Owner, Administrator, Member, Viewer, CTEM program lead, Risk approver, Auditor |
| GET | `/api/v1/compliance/frameworks/{id}/controls` | `compliance:frameworks:read` | config: framework and control catalog, assessments |  | Owner, Administrator, Member, Viewer, CTEM program lead, Risk approver, Auditor |
| GET | `/api/v1/compliance/frameworks/{id}/stats` | `compliance:frameworks:read` | config: framework and control catalog, assessments |  | Owner, Administrator, Member, Viewer, CTEM program lead, Risk approver, Auditor |
| GET | `/api/v1/compliance/stats` | `compliance:frameworks:read` | config: framework and control catalog, assessments |  | Owner, Administrator, Member, Viewer, CTEM program lead, Risk approver, Auditor |
