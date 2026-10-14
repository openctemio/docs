---
title: "CI pipelines permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 21
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# CI pipelines: permissions

CI runner identity, trust configurations, the central gate and its overrides.

- **CTEM stages:** discovery, mobilization
- **Modules:** `scans` (the routes answer `403 MODULE_NOT_ENABLED` when the module is off)
- **Permissions:** `scans:ci:override`, `scans:ci:policy`, `scans:ci:read`, `scans:ci:write`

## Who can do it

Built-in roles and role templates whose permissions pass each route. Owner and administrator are included where the route allows them.

| Permission | Roles |
|---|---|
| `scans:ci:override` | Owner, Administrator, AppSec engineer |
| `scans:ci:policy` | Owner, Administrator, AppSec engineer |
| `scans:ci:read` | Owner, Administrator, Member, Viewer, AppSec engineer |
| `scans:ci:write` | Owner, Administrator |

## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| GET | `/api/v1/ci/code-scanning/repositories` | `scans:ci:read` | scoped: code scanning: repositories listed with an SQL data-scope condition; by id out of scope is 404 (RFC-091) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| GET | `/api/v1/ci/code-scanning/repositories/{id}` | `scans:ci:read` | scoped: code scanning: repositories listed with an SQL data-scope condition; by id out of scope is 404 (RFC-091) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| POST | `/api/v1/ci/code-scanning/repositories/{id}/baseline` | `scans:ci:write` | scoped: code scanning: repositories listed with an SQL data-scope condition; by id out of scope is 404 (RFC-091) |  | Owner, Administrator |
| DELETE | `/api/v1/ci/code-scanning/repositories/{id}/settings` | `scans:ci:write` | scoped: code scanning: repositories listed with an SQL data-scope condition; by id out of scope is 404 (RFC-091) |  | Owner, Administrator |
| PUT | `/api/v1/ci/code-scanning/repositories/{id}/settings` | `scans:ci:write` | scoped: code scanning: repositories listed with an SQL data-scope condition; by id out of scope is 404 (RFC-091) |  | Owner, Administrator |
| GET | `/api/v1/ci/code-scanning/settings` | `scans:ci:read` | config: code scanning template: tenant configuration (RFC-091) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| PUT | `/api/v1/ci/code-scanning/settings` | `scans:ci:write` | config: code scanning template: tenant configuration (RFC-091) |  | Owner, Administrator |
| GET | `/api/v1/ci/coverage` | `scans:ci:read` | scoped: CI coverage: repositories listed and marked only within the caller's data scope, 404 otherwise (RFC-051) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| DELETE | `/api/v1/ci/coverage/expectations/{id}` | `scans:ci:policy` | scoped: CI coverage: repositories listed and marked only within the caller's data scope, 404 otherwise (RFC-051) |  | Owner, Administrator, AppSec engineer |
| PUT | `/api/v1/ci/coverage/expectations/{id}` | `scans:ci:policy` | scoped: CI coverage: repositories listed and marked only within the caller's data scope, 404 otherwise (RFC-051) |  | Owner, Administrator, AppSec engineer |
| GET | `/api/v1/ci/gate-overrides` | `scans:ci:read` | scoped: break-glass overrides: listed and created only on repositories in the caller's data scope, 404 otherwise (RFC-051) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| POST | `/api/v1/ci/gate-overrides` | `scans:ci:override` | scoped: break-glass overrides: listed and created only on repositories in the caller's data scope, 404 otherwise (RFC-051) | yes | Owner, Administrator, AppSec engineer |
| POST | `/api/v1/ci/gate-overrides/{id}/revoke` | `scans:ci:override` | scoped: break-glass overrides: listed and created only on repositories in the caller's data scope, 404 otherwise (RFC-051) |  | Owner, Administrator, AppSec engineer |
| GET | `/api/v1/ci/gate-policies` | `scans:ci:read` | scoped: CI gate policies: a repository policy is listed and managed only for a repository in the caller's data scope (404 otherwise); organization and business unit policies are changed only with an unrestricted scope (RFC-051) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| POST | `/api/v1/ci/gate-policies` | `scans:ci:policy` | scoped: CI gate policies: a repository policy is listed and managed only for a repository in the caller's data scope (404 otherwise); organization and business unit policies are changed only with an unrestricted scope (RFC-051) |  | Owner, Administrator, AppSec engineer |
| DELETE | `/api/v1/ci/gate-policies/{id}` | `scans:ci:policy` | scoped: CI gate policies: a repository policy is listed and managed only for a repository in the caller's data scope (404 otherwise); organization and business unit policies are changed only with an unrestricted scope (RFC-051) |  | Owner, Administrator, AppSec engineer |
| PATCH | `/api/v1/ci/gate-policies/{id}` | `scans:ci:policy` | scoped: CI gate policies: a repository policy is listed and managed only for a repository in the caller's data scope (404 otherwise); organization and business unit policies are changed only with an unrestricted scope (RFC-051) |  | Owner, Administrator, AppSec engineer |
| POST | `/api/v1/ci/oidc/exchange` | no permission: public: a CI provider's signed OIDC token is the credential, verified against the tenant's trust configurations; per-IP rate limit; every refusal is the same 401 | system: CI token exchange: the CI provider's OIDC token is the credential (RFC-051) |  | see Requires |
| GET | `/api/v1/ci/pipelines` | `scans:ci:read` | scoped: CI pipelines: SQL data-scope condition on the repository asset; by id out of scope is 404 (RFC-051) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| GET | `/api/v1/ci/pipelines/{id}` | `scans:ci:read` | scoped: CI pipelines: SQL data-scope condition on the repository asset; by id out of scope is 404 (RFC-051) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| POST | `/api/v1/ci/pipelines/{id}/retire` | `scans:ci:write` | scoped: CI pipelines: SQL data-scope condition on the repository asset; by id out of scope is 404 (RFC-051) |  | Owner, Administrator |
| GET | `/api/v1/ci/runs` | `scans:ci:read` | scoped: CI runs: SQL data-scope condition on the repository asset; by id out of scope is 404 (RFC-051) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| GET | `/api/v1/ci/runs/{id}` | `scans:ci:read` | scoped: CI runs: SQL data-scope condition on the repository asset; by id out of scope is 404 (RFC-051) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| POST | `/api/v1/ci/runs/{id}/baseline-diff` | no permission: CI run token (AuthenticateRun): the run's repository only | system: CI run token: the run's repository only (RFC-051) |  | see Requires |
| POST | `/api/v1/ci/runs/{id}/evaluate` | no permission: CI run token (AuthenticateRun): the run's own verdict | system: CI run token: the run's own verdict (RFC-051) |  | see Requires |
| POST | `/api/v1/ci/runs/{id}/results` | no permission: CI run token (AuthenticateRun): 15-minute token bound to one run on one repository asset; tenant from the token | system: CI run token: write to the run's repository only (RFC-051) |  | see Requires |
| GET | `/api/v1/ci/scm-apps` | `scans:ci:read` | config: code-host app installations the organization bound for CI checks and comments: tenant configuration (RFC-077) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| POST | `/api/v1/ci/scm-apps/github/install-url` | `scans:ci:write` | config: code-host app installations the organization bound for CI checks and comments: tenant configuration (RFC-077) |  | Owner, Administrator |
| POST | `/api/v1/ci/scm-apps/github/installations` | `scans:ci:write` | config: code-host app installations the organization bound for CI checks and comments: tenant configuration (RFC-077) | yes | Owner, Administrator |
| POST | `/api/v1/ci/scm-apps/gitlab-connections` | `scans:ci:write` | config: code-host app installations the organization bound for CI checks and comments: tenant configuration (RFC-077) | yes | Owner, Administrator |
| DELETE | `/api/v1/ci/scm-apps/gitlab-connections/{id}` | `scans:ci:write` | config: code-host app installations the organization bound for CI checks and comments: tenant configuration (RFC-077) |  | Owner, Administrator |
| DELETE | `/api/v1/ci/scm-apps/installations/{id}` | `scans:ci:write` | config: code-host app installations the organization bound for CI checks and comments: tenant configuration (RFC-077) |  | Owner, Administrator |
| GET | `/api/v1/ci/settings` | `scans:ci:read` | config: CI settings: tenant configuration (RFC-051) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| PUT | `/api/v1/ci/settings` | `scans:ci:write` | config: CI settings: tenant configuration (RFC-051) | yes | Owner, Administrator |
| GET | `/api/v1/ci/trust-configs` | `scans:ci:read` | config: CI trust configurations: tenant configuration (RFC-051) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| POST | `/api/v1/ci/trust-configs` | `scans:ci:write` | config: CI trust configurations: tenant configuration (RFC-051) | yes | Owner, Administrator |
| POST | `/api/v1/ci/trust-configs/preview` | `scans:ci:write` | config: CI trust configurations: tenant configuration (RFC-051) |  | Owner, Administrator |
| DELETE | `/api/v1/ci/trust-configs/{id}` | `scans:ci:write` | config: CI trust configurations: tenant configuration (RFC-051) |  | Owner, Administrator |
| GET | `/api/v1/ci/trust-configs/{id}` | `scans:ci:read` | config: CI trust configurations: tenant configuration (RFC-051) |  | Owner, Administrator, Member, Viewer, AppSec engineer |
| PUT | `/api/v1/ci/trust-configs/{id}` | `scans:ci:write` | config: CI trust configurations: tenant configuration (RFC-051) | yes | Owner, Administrator |
| GET | `/api/v1/ci/trust-refusals` | `scans:ci:write` | config: refused CI token exchanges from the audit log: CI trust administration (scans:ci:write), RFC-051 |  | Owner, Administrator |
| POST | `/api/v1/hooks/github-app` | no permission: public: the GitHub App webhook secret (HMAC-SHA256 over the raw body) is the credential, verified before anything is read; per-IP limit; only installation status events change anything (RFC-077) | system: GitHub App webhook: HMAC-verified installation status events (RFC-077) |  | see Requires |
