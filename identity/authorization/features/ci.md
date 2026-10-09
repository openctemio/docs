---
title: "CI pipelines permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 20
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# CI pipelines: permissions

CI runner identity, trust configurations, the central gate and its overrides.

- **CTEM stages:** discovery, mobilization
- **Modules:** `scans` (the routes answer `403 MODULE_NOT_ENABLED` when the module is off)
- **Permissions:** `scans:ci:override`, `scans:ci:read`, `scans:ci:write`

## Who can do it

Built-in roles and role templates whose permissions pass each route. Owner and administrator are included where the route allows them.

| Permission | Roles |
|---|---|
| `scans:ci:override` | Owner, Administrator |
| `scans:ci:read` | Owner, Administrator, Member, Viewer, AppSec engineer |
| `scans:ci:write` | Owner, Administrator |

## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| GET | `/api/v1/ci/coverage` | `scans:ci:read` | scoped: CI coverage: repositories listed and marked only within the caller's data scope, 404 otherwise (RFC-051) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| DELETE | `/api/v1/ci/coverage/expectations/{id}` | `scans:ci:write` | scoped: CI coverage: repositories listed and marked only within the caller's data scope, 404 otherwise (RFC-051) |  | Owner, Administrator |
| PUT | `/api/v1/ci/coverage/expectations/{id}` | `scans:ci:write` | scoped: CI coverage: repositories listed and marked only within the caller's data scope, 404 otherwise (RFC-051) |  | Owner, Administrator |
| GET | `/api/v1/ci/gate-overrides` | `scans:ci:read` | scoped: break-glass overrides: listed and created only on repositories in the caller's data scope, 404 otherwise (RFC-051) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| POST | `/api/v1/ci/gate-overrides` | `scans:ci:override` | scoped: break-glass overrides: listed and created only on repositories in the caller's data scope, 404 otherwise (RFC-051) | yes | Owner, Administrator |
| POST | `/api/v1/ci/gate-overrides/{id}/revoke` | `scans:ci:override` | scoped: break-glass overrides: listed and created only on repositories in the caller's data scope, 404 otherwise (RFC-051) |  | Owner, Administrator |
| GET | `/api/v1/ci/gate-policies` | `scans:ci:read` | config: CI gate policies: tenant configuration (RFC-051) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| POST | `/api/v1/ci/gate-policies` | `scans:ci:write` | config: CI gate policies: tenant configuration (RFC-051) |  | Owner, Administrator |
| DELETE | `/api/v1/ci/gate-policies/{id}` | `scans:ci:write` | config: CI gate policies: tenant configuration (RFC-051) |  | Owner, Administrator |
| PATCH | `/api/v1/ci/gate-policies/{id}` | `scans:ci:write` | config: CI gate policies: tenant configuration (RFC-051) |  | Owner, Administrator |
| POST | `/api/v1/ci/oidc/exchange` | no permission: public: a CI provider's signed OIDC token is the credential, verified against the tenant's trust configurations; per-IP rate limit; every refusal is the same 401 | system: CI token exchange: the CI provider's OIDC token is the credential (RFC-051) |  | see Requires |
| GET | `/api/v1/ci/pipelines` | `scans:ci:read` | scoped: CI pipelines: SQL data-scope condition on the repository asset; by id out of scope is 404 (RFC-051) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| GET | `/api/v1/ci/pipelines/{id}` | `scans:ci:read` | scoped: CI pipelines: SQL data-scope condition on the repository asset; by id out of scope is 404 (RFC-051) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| POST | `/api/v1/ci/pipelines/{id}/retire` | `scans:ci:write` | scoped: CI pipelines: SQL data-scope condition on the repository asset; by id out of scope is 404 (RFC-051) |  | Owner, Administrator |
| GET | `/api/v1/ci/runs` | `scans:ci:read` | scoped: CI runs: SQL data-scope condition on the repository asset; by id out of scope is 404 (RFC-051) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| GET | `/api/v1/ci/runs/{id}` | `scans:ci:read` | scoped: CI runs: SQL data-scope condition on the repository asset; by id out of scope is 404 (RFC-051) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| POST | `/api/v1/ci/runs/{id}/baseline-diff` | no permission: CI run token (AuthenticateRun): the run's repository only | system: CI run token: the run's repository only (RFC-051) |  | see Requires |
| POST | `/api/v1/ci/runs/{id}/evaluate` | no permission: CI run token (AuthenticateRun): the run's own verdict | system: CI run token: the run's own verdict (RFC-051) |  | see Requires |
| POST | `/api/v1/ci/runs/{id}/results` | no permission: CI run token (AuthenticateRun): 15-minute token bound to one run on one repository asset; tenant from the token | system: CI run token: write to the run's repository only (RFC-051) |  | see Requires |
| GET | `/api/v1/ci/settings` | `scans:ci:read` | config: CI settings: tenant configuration (RFC-051) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| PUT | `/api/v1/ci/settings` | `scans:ci:write` | config: CI settings: tenant configuration (RFC-051) |  | Owner, Administrator |
| GET | `/api/v1/ci/trust-configs` | `scans:ci:read` | config: CI trust configurations: tenant configuration (RFC-051) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| POST | `/api/v1/ci/trust-configs` | `scans:ci:write` | config: CI trust configurations: tenant configuration (RFC-051) |  | Owner, Administrator |
| POST | `/api/v1/ci/trust-configs/preview` | `scans:ci:write` | config: CI trust configurations: tenant configuration (RFC-051) |  | Owner, Administrator |
| DELETE | `/api/v1/ci/trust-configs/{id}` | `scans:ci:write` | config: CI trust configurations: tenant configuration (RFC-051) |  | Owner, Administrator |
| GET | `/api/v1/ci/trust-configs/{id}` | `scans:ci:read` | config: CI trust configurations: tenant configuration (RFC-051) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| PUT | `/api/v1/ci/trust-configs/{id}` | `scans:ci:write` | config: CI trust configurations: tenant configuration (RFC-051) |  | Owner, Administrator |
