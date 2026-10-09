---
title: "Organization settings and audit permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 28
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# Organization settings and audit: permissions

The organization, its settings (security, SSO, evidence, retests), plan and the audit log.

- **Permissions:** `audit:read`, `settings:read`, `settings:write`, `team:delete`, `team:members:invite`, `team:members:read`, `team:members:write`, `team:read`, `team:update`

## Who can do it

Built-in roles and role templates whose permissions pass each route. Owner and administrator are included where the route allows them.

| Permission | Roles |
|---|---|
| `audit:read` | Owner, Administrator, Auditor |
| `settings:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor |
| `settings:write` | Owner, Administrator |
| `team:delete` | Owner, Administrator |
| `team:members:invite` | Owner, Administrator |
| `team:members:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor |
| `team:members:write` | Owner, Administrator |
| `team:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| `team:update` | Owner, Administrator |

## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| GET | `/api/v1/audit-logs` | `audit:read` | config: audit log (admin) |  | Owner, Administrator, Auditor |
| GET | `/api/v1/audit-logs/resource/{type}/{id}` | `audit:read` | config: audit log (admin) |  | Owner, Administrator, Auditor |
| GET | `/api/v1/audit-logs/stats` | `audit:read` | config: audit log (admin) |  | Owner, Administrator, Auditor |
| GET | `/api/v1/audit-logs/user/{id}` | `audit:read` + the permission, or the caller's own record | config: audit log (admin) |  | Owner, Administrator, Auditor |
| GET | `/api/v1/audit-logs/verify` | team role admin | config: audit log (admin) |  | Owner, Administrator |
| GET | `/api/v1/audit-logs/{id}` | `audit:read` | config: audit log (admin) |  | Owner, Administrator, Auditor |
| POST | `/api/v1/invitations/accept` | no permission: invitation token IS the authorization | system: invitation acceptance (token) |  | see Requires |
| POST | `/api/v1/invitations/accept-with-refresh` | no permission: invitation token IS the authorization | system: invitation acceptance (token) |  | see Requires |
| POST | `/api/v1/invitations/decline` | no permission: invitation token IS the authorization | system: invitation acceptance (token) |  | see Requires |
| POST | `/api/v1/invitations/lookup` | no permission: invitation token IS the authorization | system: invitation acceptance (token) |  | see Requires |
| GET | `/api/v1/invitations/{token}` | no permission: invitation token IS the authorization | system: invitation acceptance (token) |  | see Requires |
| POST | `/api/v1/invitations/{token}/accept` | no permission: invitation token IS the authorization | system: invitation acceptance (token) |  | see Requires |
| POST | `/api/v1/invitations/{token}/accept-with-refresh` | no permission: invitation token IS the authorization | system: invitation acceptance (token) |  | see Requires |
| POST | `/api/v1/invitations/{token}/decline` | no permission: invitation token IS the authorization | system: invitation acceptance (token) |  | see Requires |
| GET | `/api/v1/invitations/{token}/preview` | no permission: invitation token IS the authorization | system: invitation acceptance (token) |  | see Requires |
| GET | `/api/v1/module-presets` | no permission: auth-only catalog read (public preset list) | system: module preset catalog |  | see Requires |
| GET | `/api/v1/organization/plan` | `settings:read` + team role admin | config: organization settings |  | Owner, Administrator |
| GET | `/api/v1/organization/settings/evidence` | team role admin | config: organization settings |  | Owner, Administrator |
| PUT | `/api/v1/organization/settings/evidence` | team role admin | config: organization settings |  | Owner, Administrator |
| GET | `/api/v1/organization/settings/retest` | team role admin | config: organization settings |  | Owner, Administrator |
| PUT | `/api/v1/organization/settings/retest` | team role admin | config: organization settings |  | Owner, Administrator |
| GET | `/api/v1/tenants` | no permission: base-auth + RequireMembership/RequireTeam* (role-gated, not permission-gated) | config: organization administration (team roles) |  | see Requires |
| POST | `/api/v1/tenants` | no permission: base-auth + RequireMembership/RequireTeam* (role-gated, not permission-gated) | config: organization administration (team roles) |  | see Requires |
| DELETE | `/api/v1/tenants/{tenant}` | `team:delete` + team role owner | config: organization administration (team roles) | yes | Owner |
| GET | `/api/v1/tenants/{tenant}` | `team:read` | config: organization administration (team roles) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, External tester, Threat intelligence analyst, Risk approver, Auditor, Executive viewer |
| PATCH | `/api/v1/tenants/{tenant}` | `team:update` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| GET | `/api/v1/tenants/{tenant}/invitations` | `team:members:read` | config: organization administration (team roles) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor |
| POST | `/api/v1/tenants/{tenant}/invitations` | `team:members:invite` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| DELETE | `/api/v1/tenants/{tenant}/invitations/{invitationId}` | `team:members:invite` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| POST | `/api/v1/tenants/{tenant}/invitations/{invitationId}/resend` | `team:members:invite` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| GET | `/api/v1/tenants/{tenant}/members` | `team:members:read` | config: organization administration (team roles) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor |
| POST | `/api/v1/tenants/{tenant}/members` | `team:members:write` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| GET | `/api/v1/tenants/{tenant}/members/stats` | `team:members:read` | config: organization administration (team roles) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor |
| PATCH | `/api/v1/tenants/{tenant}/members/{userId}` | `team:members:write` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| POST | `/api/v1/tenants/{tenant}/members/{userId}/reactivate` | `team:members:write` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| POST | `/api/v1/tenants/{tenant}/members/{userId}/suspend` | `team:members:write` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| GET | `/api/v1/tenants/{tenant}/settings` | `settings:read` | config: organization administration (team roles) |  | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor |
| GET | `/api/v1/tenants/{tenant}/settings/asset-identity` | `settings:read` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| PATCH | `/api/v1/tenants/{tenant}/settings/asset-identity` | `settings:write` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| GET | `/api/v1/tenants/{tenant}/settings/asset-lifecycle` | `settings:read` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| PUT | `/api/v1/tenants/{tenant}/settings/asset-lifecycle` | `settings:write` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| POST | `/api/v1/tenants/{tenant}/settings/asset-lifecycle/dry-run` | `settings:write` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| PATCH | `/api/v1/tenants/{tenant}/settings/branding` | `settings:write` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| PATCH | `/api/v1/tenants/{tenant}/settings/general` | `settings:write` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| GET | `/api/v1/tenants/{tenant}/settings/modules` | `settings:read` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| PATCH | `/api/v1/tenants/{tenant}/settings/modules` | `settings:write` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| GET | `/api/v1/tenants/{tenant}/settings/modules/bundles` | `settings:read` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| POST | `/api/v1/tenants/{tenant}/settings/modules/bundles` | `settings:write` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| GET | `/api/v1/tenants/{tenant}/settings/modules/graph` | `settings:read` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| GET | `/api/v1/tenants/{tenant}/settings/modules/presets` | `settings:read` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| POST | `/api/v1/tenants/{tenant}/settings/modules/presets/{presetId}/apply` | `settings:write` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| POST | `/api/v1/tenants/{tenant}/settings/modules/presets/{presetId}/preview` | `settings:write` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| POST | `/api/v1/tenants/{tenant}/settings/modules/reset` | `settings:write` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| POST | `/api/v1/tenants/{tenant}/settings/modules/validate` | `settings:write` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| GET | `/api/v1/tenants/{tenant}/settings/pentest` | `settings:read` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| PATCH | `/api/v1/tenants/{tenant}/settings/pentest` | `settings:write` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| GET | `/api/v1/tenants/{tenant}/settings/risk-scoring` | `settings:read` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| PATCH | `/api/v1/tenants/{tenant}/settings/risk-scoring` | `settings:write` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| GET | `/api/v1/tenants/{tenant}/settings/risk-scoring/presets` | `settings:read` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| POST | `/api/v1/tenants/{tenant}/settings/risk-scoring/preview` | `settings:write` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| POST | `/api/v1/tenants/{tenant}/settings/risk-scoring/recalculate` | `settings:write` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| PATCH | `/api/v1/tenants/{tenant}/settings/security` | `settings:write` + team role owner | config: organization administration (team roles) | yes | Owner |
| GET | `/api/v1/tenants/{tenant}/settings/sso/changes` | team role owner | config: organization administration (team roles) |  | Owner |
| POST | `/api/v1/tenants/{tenant}/settings/sso/changes/{changeId}/approve` | team role owner | config: organization administration (team roles) | yes | Owner |
| POST | `/api/v1/tenants/{tenant}/settings/sso/changes/{changeId}/reject` | team role owner | config: organization administration (team roles) |  | Owner |
| POST | `/api/v1/tenants/{tenant}/users` | `team:members:write` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
| POST | `/api/v1/tenants/{tenant}/users/{userId}/setup-link` | `team:members:write` + team role admin | config: organization administration (team roles) |  | Owner, Administrator |
