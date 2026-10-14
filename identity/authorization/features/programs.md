---
title: "Bug-bounty programs permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 15
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# Bug-bounty programs: permissions

Programs the organization tests under their published rules: import with an attestation, re-import, pause, resume and end (RFC-065).

- **CTEM stages:** scoping
- **Modules:** `scope_config` (the routes answer `403 MODULE_NOT_ENABLED` when the module is off)
- **Permissions:** `attack_surface:programs:read`, `attack_surface:programs:write`, `integrations:manage`

## Who can do it

Built-in roles and role templates whose permissions pass each route. Owner and administrator are included where the route allows them.

| Permission | Roles |
|---|---|
| `attack_surface:programs:read` | Owner, Administrator, Researcher |
| `attack_surface:programs:write` | Owner, Administrator, Researcher |
| `integrations:manage` | Owner, Administrator |

## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| GET | `/api/v1/programs` | `attack_surface:programs:read` | scoped: bug-bounty programs (RFC-065): a caller sees only programs whose group has them unless full-data; another program is 404 |  | Owner, Administrator, Researcher |
| POST | `/api/v1/programs` | `attack_surface:programs:write` | scoped: bug-bounty programs (RFC-065): a caller sees only programs whose group has them unless full-data; another program is 404 | yes | Owner, Administrator, Researcher |
| GET | `/api/v1/programs/catalog` | `attack_surface:programs:read` | scoped: bug-bounty programs (RFC-065): a caller sees only programs whose group has them unless full-data; another program is 404 |  | Owner, Administrator, Researcher |
| POST | `/api/v1/programs/preview` | `attack_surface:programs:write` | scoped: bug-bounty programs (RFC-065): a caller sees only programs whose group has them unless full-data; another program is 404 |  | Owner, Administrator, Researcher |
| POST | `/api/v1/programs/subscriptions` | `attack_surface:programs:write` | scoped: bug-bounty programs (RFC-065): a caller sees only programs whose group has them unless full-data; another program is 404 |  | Owner, Administrator, Researcher |
| GET | `/api/v1/programs/{id}` | `attack_surface:programs:read` | scoped: bug-bounty programs (RFC-065): a caller sees only programs whose group has them unless full-data; another program is 404 |  | Owner, Administrator, Researcher |
| POST | `/api/v1/programs/{id}/attest` | `attack_surface:programs:read` | scoped: bug-bounty programs (RFC-065): a caller sees only programs whose group has them unless full-data; another program is 404 |  | Owner, Administrator, Researcher |
| GET | `/api/v1/programs/{id}/delivery` | `attack_surface:programs:read` | scoped: bug-bounty programs (RFC-065): a caller sees only programs whose group has them unless full-data; another program is 404 |  | Owner, Administrator, Researcher |
| POST | `/api/v1/programs/{id}/end` | `attack_surface:programs:write` | scoped: bug-bounty programs (RFC-065): a caller sees only programs whose group has them unless full-data; another program is 404 |  | Owner, Administrator, Researcher |
| DELETE | `/api/v1/programs/{id}/notification-channels/{integration_id}` | `attack_surface:programs:write`, `integrations:manage` | scoped: bug-bounty programs (RFC-065): a caller sees only programs whose group has them unless full-data; another program is 404 |  | Owner, Administrator |
| PUT | `/api/v1/programs/{id}/notification-channels/{integration_id}` | `attack_surface:programs:write`, `integrations:manage` | scoped: bug-bounty programs (RFC-065): a caller sees only programs whose group has them unless full-data; another program is 404 | yes | Owner, Administrator |
| PUT | `/api/v1/programs/{id}/org-channels` | `attack_surface:programs:write` | scoped: bug-bounty programs (RFC-065): a caller sees only programs whose group has them unless full-data; another program is 404 | yes | Owner, Administrator, Researcher |
| GET | `/api/v1/programs/{id}/pending` | `attack_surface:programs:read` | scoped: bug-bounty programs (RFC-065): a caller sees only programs whose group has them unless full-data; another program is 404 |  | Owner, Administrator, Researcher |
| POST | `/api/v1/programs/{id}/pending/apply` | `attack_surface:programs:write` | scoped: bug-bounty programs (RFC-065): a caller sees only programs whose group has them unless full-data; another program is 404 | yes | Owner, Administrator, Researcher |
| POST | `/api/v1/programs/{id}/reactivate` | `attack_surface:programs:write` | scoped: bug-bounty programs (RFC-065): a caller sees only programs whose group has them unless full-data; another program is 404 | yes | Owner, Administrator, Researcher |
| PUT | `/api/v1/programs/{id}/scope` | `attack_surface:programs:write` | scoped: bug-bounty programs (RFC-065): a caller sees only programs whose group has them unless full-data; another program is 404 | yes | Owner, Administrator, Researcher |
| PUT | `/api/v1/programs/{id}/source` | `attack_surface:programs:write` | scoped: bug-bounty programs (RFC-065): a caller sees only programs whose group has them unless full-data; another program is 404 | yes | Owner, Administrator, Researcher |
| POST | `/api/v1/programs/{id}/suspend` | `attack_surface:programs:write` | scoped: bug-bounty programs (RFC-065): a caller sees only programs whose group has them unless full-data; another program is 404 |  | Owner, Administrator, Researcher |
| POST | `/api/v1/programs/{id}/sync` | `attack_surface:programs:write` | scoped: bug-bounty programs (RFC-065): a caller sees only programs whose group has them unless full-data; another program is 404 |  | Owner, Administrator, Researcher |
| POST | `/api/v1/programs/{id}/targets/approve` | `attack_surface:programs:write` | scoped: bug-bounty programs (RFC-065): a caller sees only programs whose group has them unless full-data; another program is 404 |  | Owner, Administrator, Researcher |
