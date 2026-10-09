---
title: "Members, roles and teams permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 27
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# Members, roles and teams: permissions

Members, invitations, roles, teams (access groups) and their data scope, trusted organizations and SCIM provisioning.

- **Permissions:** `team:groups:assets`, `team:groups:delete`, `team:groups:members`, `team:groups:read`, `team:groups:write`, `team:members:read`, `team:members:write`, `team:roles:assign`, `team:roles:delete`, `team:roles:read`, `team:roles:write`

## Who can do it

Built-in roles and role templates whose permissions pass each route. Owner and administrator are included where the route allows them.

| Permission | Roles |
|---|---|
| `team:groups:assets` | Owner, Administrator |
| `team:groups:delete` | Owner, Administrator |
| `team:groups:members` | Owner, Administrator |
| `team:groups:read` | Owner, Administrator, Member, Viewer, Auditor |
| `team:groups:write` | Owner, Administrator |
| `team:members:read` | Owner, Administrator, Member, Viewer, CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec engineer, Scan operator, Validation engineer, Threat intelligence analyst, Risk approver, Auditor |
| `team:members:write` | Owner, Administrator |
| `team:roles:assign` | Owner, Administrator |
| `team:roles:delete` | Owner, Administrator |
| `team:roles:read` | Owner, Administrator, Member, Viewer, Auditor |
| `team:roles:write` | Owner, Administrator |

## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| GET | `/api/v1/groups` | `team:groups:read` | config: access groups: membership and scope administration (D13 cap) |  | Owner, Administrator, Member, Viewer, Auditor |
| POST | `/api/v1/groups` | `team:groups:write` | config: access groups: membership and scope administration (D13 cap) |  | Owner, Administrator |
| POST | `/api/v1/groups/sync` | `team:groups:write` | config: access groups: membership and scope administration (D13 cap) |  | Owner, Administrator |
| DELETE | `/api/v1/groups/{groupId}` | `team:groups:delete` + team role owner | config: access groups: membership and scope administration (D13 cap) |  | Owner |
| GET | `/api/v1/groups/{groupId}` | `team:groups:read` | config: access groups: membership and scope administration (D13 cap) |  | Owner, Administrator, Member, Viewer, Auditor |
| PUT | `/api/v1/groups/{groupId}` | `team:groups:write` | config: access groups: membership and scope administration (D13 cap) |  | Owner, Administrator |
| GET | `/api/v1/groups/{groupId}/assets` | `team:groups:read` | scoped: only the group's assets in the caller's scope (L-10) |  | Owner, Administrator, Member, Viewer, Auditor |
| POST | `/api/v1/groups/{groupId}/assets` | `team:groups:assets`, `team:groups:write` | config: access groups: membership and scope administration (D13 cap) |  | Owner, Administrator |
| POST | `/api/v1/groups/{groupId}/assets/bulk` | `team:groups:assets`, `team:groups:write` | config: access groups: membership and scope administration (D13 cap) |  | Owner, Administrator |
| DELETE | `/api/v1/groups/{groupId}/assets/{assetId}` | `team:groups:assets`, `team:groups:write` | config: access groups: membership and scope administration (D13 cap) |  | Owner, Administrator |
| PUT | `/api/v1/groups/{groupId}/assets/{assetId}` | `team:groups:assets`, `team:groups:write` | config: access groups: membership and scope administration (D13 cap) |  | Owner, Administrator |
| GET | `/api/v1/groups/{groupId}/members` | `team:groups:read` | config: access groups: membership and scope administration (D13 cap) |  | Owner, Administrator, Member, Viewer, Auditor |
| POST | `/api/v1/groups/{groupId}/members` | `team:groups:members` | config: access groups: membership and scope administration (D13 cap) |  | Owner, Administrator |
| DELETE | `/api/v1/groups/{groupId}/members/{userId}` | `team:groups:members` | config: access groups: membership and scope administration (D13 cap) |  | Owner, Administrator |
| PUT | `/api/v1/groups/{groupId}/members/{userId}` | `team:groups:members` | config: access groups: membership and scope administration (D13 cap) |  | Owner, Administrator |
| GET | `/api/v1/groups/{groupId}/scope-rules` | `team:groups:read` | config: access groups: membership and scope administration (D13 cap) |  | Owner, Administrator, Member, Viewer, Auditor |
| POST | `/api/v1/groups/{groupId}/scope-rules` | `team:groups:write` | config: access groups: membership and scope administration (D13 cap) |  | Owner, Administrator |
| POST | `/api/v1/groups/{groupId}/scope-rules/reconcile` | `team:groups:write` | config: access groups: membership and scope administration (D13 cap) |  | Owner, Administrator |
| DELETE | `/api/v1/groups/{groupId}/scope-rules/{ruleId}` | `team:groups:write` | config: access groups: membership and scope administration (D13 cap) |  | Owner, Administrator |
| GET | `/api/v1/groups/{groupId}/scope-rules/{ruleId}` | `team:groups:read` | config: access groups: membership and scope administration (D13 cap) |  | Owner, Administrator, Member, Viewer, Auditor |
| PUT | `/api/v1/groups/{groupId}/scope-rules/{ruleId}` | `team:groups:write` | config: access groups: membership and scope administration (D13 cap) |  | Owner, Administrator |
| POST | `/api/v1/groups/{groupId}/scope-rules/{ruleId}/preview` | `team:groups:read` | config: access groups: membership and scope administration (D13 cap) |  | Owner, Administrator, Member, Viewer, Auditor |
| GET | `/api/v1/me/assets` | no permission: self-scoped: /me/* reads the caller's own perms/modules/roles | system: the caller's own permissions, groups and assets |  | see Requires |
| GET | `/api/v1/me/groups` | no permission: self-scoped: /me/* reads the caller's own perms/modules/roles | system: the caller's own permissions, groups and assets |  | see Requires |
| GET | `/api/v1/me/permissions` | no permission: self-scoped: /me/* reads the caller's own perms/modules/roles | system: the caller's own permissions, groups and assets |  | see Requires |
| GET | `/api/v1/me/permissions/sync` | no permission: self-scoped: /me/* reads the caller's own perms/modules/roles | system: the caller's own permissions, groups and assets |  | see Requires |
| GET | `/api/v1/me/roles` | no permission: self-scoped: /me/* reads the caller's own perms/modules/roles | system: the caller's own permissions, groups and assets |  | see Requires |
| PATCH | `/api/v1/organization/members/{member_id}/access` | `team:members:write` + team role admin | config: organization settings |  | Owner, Administrator |
| GET | `/api/v1/organization/members/{member_id}/access-report` | `team:members:read` + team role admin | config: organization settings |  | Owner, Administrator |
| POST | `/api/v1/organization/members/{member_id}/erase` | team role owner | config: organization settings | yes | Owner |
| DELETE | `/api/v1/organization/members/{member_id}/mfa` | team role admin | config: organization settings | yes | Owner, Administrator |
| POST | `/api/v1/organization/members/{member_id}/offboard` | `team:members:write` + team role admin | config: organization settings | yes | Owner, Administrator |
| GET | `/api/v1/organization/trusts` | `team:members:read` + team role admin | config: organization settings |  | Owner, Administrator |
| POST | `/api/v1/organization/trusts` | team role owner | config: organization settings | yes | Owner |
| DELETE | `/api/v1/organization/trusts/{trust_id}` | team role owner | config: organization settings | yes | Owner |
| PATCH | `/api/v1/organization/trusts/{trust_id}` | team role owner | config: organization settings | yes | Owner |
| POST | `/api/v1/organization/trusts/{trust_id}/approve` | team role owner | config: organization settings | yes | Owner |
| GET | `/api/v1/permissions` | `team:roles:read` | system: permission catalog |  | Owner, Administrator, Member, Viewer, Auditor |
| GET | `/api/v1/permissions/modules` | `team:roles:read` | system: permission catalog |  | Owner, Administrator, Member, Viewer, Auditor |
| GET | `/api/v1/roles` | `team:roles:read` | config: roles |  | Owner, Administrator, Member, Viewer, Auditor |
| POST | `/api/v1/roles` | `team:roles:write` | config: roles |  | Owner, Administrator |
| GET | `/api/v1/roles/templates` | `team:roles:read` | config: roles |  | Owner, Administrator, Member, Viewer, Auditor |
| DELETE | `/api/v1/roles/{roleId}` | `team:roles:delete` | config: roles |  | Owner, Administrator |
| GET | `/api/v1/roles/{roleId}` | `team:roles:read` | config: roles |  | Owner, Administrator, Member, Viewer, Auditor |
| PUT | `/api/v1/roles/{roleId}` | `team:roles:write` | config: roles |  | Owner, Administrator |
| GET | `/api/v1/roles/{roleId}/members` | `team:roles:read` | config: roles |  | Owner, Administrator, Member, Viewer, Auditor |
| POST | `/api/v1/roles/{roleId}/members/bulk` | `team:roles:assign` | config: roles |  | Owner, Administrator |
| GET | `/api/v1/scim-tokens` | team role admin | config: SCIM tokens |  | Owner, Administrator |
| POST | `/api/v1/scim-tokens` | team role owner | config: SCIM tokens | yes | Owner |
| GET | `/api/v1/scim-tokens/group-mappings` | team role admin | config: SCIM tokens |  | Owner, Administrator |
| PUT | `/api/v1/scim-tokens/group-mappings` | team role admin | config: SCIM tokens |  | Owner, Administrator |
| DELETE | `/api/v1/scim-tokens/{id}` | team role owner | config: SCIM tokens |  | Owner |
| GET | `/api/v1/users/{userId}/roles` | `team:roles:read` | system: the caller's own account |  | Owner, Administrator, Member, Viewer, Auditor |
| POST | `/api/v1/users/{userId}/roles` | `team:roles:assign` | system: the caller's own account |  | Owner, Administrator |
| PUT | `/api/v1/users/{userId}/roles` | `team:roles:assign` | system: the caller's own account |  | Owner, Administrator |
| DELETE | `/api/v1/users/{userId}/roles/{roleId}` | `team:roles:assign` | system: the caller's own account |  | Owner, Administrator |
| GET | `/scim/v2/Groups` | no permission: SCIM per-tenant bearer token auth (routes live at /scim/v2, not /api/v1) | system: SCIM provisioning (per-tenant bearer) |  | see Requires |
| POST | `/scim/v2/Groups` | no permission: SCIM per-tenant bearer token auth (routes live at /scim/v2, not /api/v1) | system: SCIM provisioning (per-tenant bearer) |  | see Requires |
| DELETE | `/scim/v2/Groups/{id}` | no permission: SCIM per-tenant bearer token auth (routes live at /scim/v2, not /api/v1) | system: SCIM provisioning (per-tenant bearer) |  | see Requires |
| GET | `/scim/v2/Groups/{id}` | no permission: SCIM per-tenant bearer token auth (routes live at /scim/v2, not /api/v1) | system: SCIM provisioning (per-tenant bearer) |  | see Requires |
| PATCH | `/scim/v2/Groups/{id}` | no permission: SCIM per-tenant bearer token auth (routes live at /scim/v2, not /api/v1) | system: SCIM provisioning (per-tenant bearer) |  | see Requires |
| PUT | `/scim/v2/Groups/{id}` | no permission: SCIM per-tenant bearer token auth (routes live at /scim/v2, not /api/v1) | system: SCIM provisioning (per-tenant bearer) |  | see Requires |
| GET | `/scim/v2/ResourceTypes` | no permission: SCIM per-tenant bearer token auth (routes live at /scim/v2, not /api/v1) | system: SCIM provisioning (per-tenant bearer) |  | see Requires |
| GET | `/scim/v2/Schemas` | no permission: SCIM per-tenant bearer token auth (routes live at /scim/v2, not /api/v1) | system: SCIM provisioning (per-tenant bearer) |  | see Requires |
| GET | `/scim/v2/ServiceProviderConfig` | no permission: SCIM per-tenant bearer token auth (routes live at /scim/v2, not /api/v1) | system: SCIM provisioning (per-tenant bearer) |  | see Requires |
| GET | `/scim/v2/Users` | no permission: SCIM per-tenant bearer token auth (routes live at /scim/v2, not /api/v1) | system: SCIM provisioning (per-tenant bearer) |  | see Requires |
| POST | `/scim/v2/Users` | no permission: SCIM per-tenant bearer token auth (routes live at /scim/v2, not /api/v1) | system: SCIM provisioning (per-tenant bearer) |  | see Requires |
| DELETE | `/scim/v2/Users/{id}` | no permission: SCIM per-tenant bearer token auth (routes live at /scim/v2, not /api/v1) | system: SCIM provisioning (per-tenant bearer) |  | see Requires |
| GET | `/scim/v2/Users/{id}` | no permission: SCIM per-tenant bearer token auth (routes live at /scim/v2, not /api/v1) | system: SCIM provisioning (per-tenant bearer) |  | see Requires |
| PATCH | `/scim/v2/Users/{id}` | no permission: SCIM per-tenant bearer token auth (routes live at /scim/v2, not /api/v1) | system: SCIM provisioning (per-tenant bearer) |  | see Requires |
| PUT | `/scim/v2/Users/{id}` | no permission: SCIM per-tenant bearer token auth (routes live at /scim/v2, not /api/v1) | system: SCIM provisioning (per-tenant bearer) |  | see Requires |
