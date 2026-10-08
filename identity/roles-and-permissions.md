---
title: Roles, groups and permissions
parent: Identity and access
nav_order: 2
---

# Roles, groups and permissions

Access inside an organization is decided by three independent checks:

| Layer | Question it answers | Set by |
|---|---|---|
| Roles and permissions | *What kind of action* may this person take (read findings, run scans, manage members)? | Built-in and custom roles |
| Data scope | *Which assets* (and the findings and other records linked to them) may they see and act on? | Groups and direct asset grants |
| Modules | Is this *feature* enabled for the organization at all? | Organization module settings |

A request must pass all three. The full route-by-route matrix is in
[authorization-matrix.md](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/authorization-matrix.md).

## Built-in roles

Every organization has four system roles. They cannot be edited or deleted.

![The Roles settings page with the four system roles]({{ site.baseurl }}/assets/images/identity/roles.png)
*Figure: The built-in roles.*

| Role | Level | Sees all data | Summary |
|---|---|---|---|
| Owner | 100 | yes | Everything, including deleting the organization, approving suppressions, approving SSO changes, minting SCIM tokens and changing administrators. |
| Admin | 80 | yes | Everything an owner can do except the owner-only actions. |
| Member | 50 | no (data scope applies) | Day-to-day work: read and write assets, findings, scans and scope; no deletes, no member or role management, no sensor management, no audit log. |
| Viewer | 20 | no (data scope applies) | Read-only, without the audit log. |

- Owners and admins pass every permission check. Actions reserved for owners are checked
  separately (for example deleting a group, deleting an assignment rule, deleting the organization,
  changing the 2FA requirement).
- An owner can assign any role except owner through the role picker; an admin can assign member or
  viewer. Invitations can offer admin, member or viewer, never owner.
- Making someone an admin or owner needs an owner and a recent re-authentication
  ([step-up](two-factor.md#step-up-re-authentication)). Only an owner can change the roles of an
  owner or of another admin. An organization always keeps at least one owner.
- Permission changes take effect on the next request: permissions are re-read per request (cached
  in Redis and invalidated on change).

## Custom roles

Owners and admins (or anyone with `team:roles:write`) create custom roles under
**Settings > Roles** (`/api/v1/roles`).

A custom role has a name, a slug, a description, a level below 80, a list of permissions and a
**full data access** flag. Rules:

- You cannot put a permission into a role that you do not hold yourself, nor full data access unless
  you have it (owners are exempt).
- A custom role never makes someone an admin. The organization-level role (owner, admin, member,
  viewer) comes only from the system roles.
- Some permissions are reserved for owners and admins and can never be part of a custom role:
  sensor management (`sensors:write`, `sensors:delete`, `sensors:commands:delete`,
  `sensors:zones:write`, `sensors:zones:delete`, `sensors:pair`, `sensors:approve`,
  `sensors:revoke`, `sensors:grant:narrow`, `sensors:grant:widen`) and CI gate configuration
  (`scans:ci:write`, `scans:ci:override`). The database refuses them too.
- A person can hold several roles. Their permissions are the union of all their roles, and they see
  all data if any of their roles has full data access.
- Custom roles belong to one organization.
- External members (people whose email domain belongs to another organization) can never hold owner,
  admin or a full-data-access role.

Assign roles under **Settings > Members**, or with `PUT /api/v1/users/{userId}/roles` (replaces the
list) and `POST /api/v1/roles/{roleId}/members/bulk`, which need `team:roles:assign`.

## Permissions

Permissions are named `module[:resource]:action`, for example `findings:triage` or
`attack_surface:scope:approve`. There are about 160. The groups:

| Group | Resources and actions |
|---|---|
| Core | `dashboard:read`, `dashboard:aggregate`, `audit:read`, `settings:read`, `settings:write` |
| Assets | `assets:read/write/delete/import/export`; `assets:groups:*`; `assets:components:*` |
| Findings | `findings:read/write/delete/assign/triage/status/export/bulk_update/approve/fix_apply/verify`; `findings:exposures:*`; `findings:suppressions:read/write/delete/approve`; `findings:vulnerabilities:read`; `findings:credentials:read/write/reveal`; `findings:evidence:reveal`; `findings:remediation:*`; `findings:workflows:*` |
| Scans | `scans:read/write/delete/execute`; `scans:profiles:*`, `scans:sources:*`, `scans:tools:*`, `scans:templates:*`, `scans:secret_store:*`, `scans:workflows:*`; `scans:tenant_tools:*`; `scans:ci:read/write/override`; `scans:freeze:override` |
| Sensors | `sensors:read/write/delete`; `sensors:commands:*`; `sensors:zones:*`; `sensors:pair`, `sensors:approve`, `sensors:revoke`; `sensors:grant:narrow`, `sensors:grant:widen` |
| Team | `team:read/update/delete`; `team:members:read/invite/write`; `team:groups:read/write/delete/members/assets`; `team:roles:read/write/delete/assign`; `team:assignment_rules:*` |
| Integrations | `integrations:read/manage`; `integrations:scm:*`; `integrations:notifications:*`; `integrations:api_keys:read/write/delete` |
| Settings | `settings:sla:*` |
| Attack surface | `attack_surface:scope:read/write/delete/approve`; `attack_surface:scope:exclusions:approve` |
| Validation and pentest | `validation:read/write`; `pentest:campaigns:*`, `pentest:findings:*`, `pentest:retests:*`, `pentest:templates:*`, `pentest:reports:write` |
| Compliance | `compliance:frameworks:read`; `compliance:assessments:*`; `compliance:mappings:*` |
| Reports, threat intel | `reports:read/write`; `threat_intel:read/write` |
| CTEM | `ctem:cycles`, `ctem:attacker_profiles`, `ctem:business_services`, `ctem:compensating_controls`, `ctem:priority_rules`, `ctem:verification_checklists` (each read and write) |
| AI triage | `ai_triage:read`, `ai_triage:trigger` |

`*` stands for the read, write and delete actions of that resource. The authoritative list is
`api/pkg/domain/permission/permission.go`; `GET /api/v1/permissions` returns it, and
`GET /api/v1/me/permissions` returns what you hold.

## Groups and data scope

Groups (shown as **Teams** under **Settings > Teams**) grant **no permissions**. They decide which
assets their members can see. A group has a type (`security_team`, `team`, `department`,
`project`, `external`) and its own member roles (`owner`, `lead`, `member`).

A member or viewer sees an asset, and everything linked to it (findings, exposures, components),
only when one of these holds:

- the asset is assigned to one of their active groups: directly (**Teams > group > Assets**), by an
  **assignment rule** that routes matching assets to the group, or by a group scope rule;
- someone gave them a **direct grant** on that asset (asset page, **Owners** tab, **Direct access**;
  API `POST /api/v1/assets/{id}/access-grants`). You cannot grant yourself access.

| Caller | Sees |
|---|---|
| Owner or admin | Everything in the organization |
| Custom role with full data access | Everything (not through an API key) |
| Member or viewer with at least one assignment | Only their assigned assets and linked records |
| Member or viewer with no assignment | Nothing |

Notes:

- Naming someone an **asset owner** does not give them access. Owners are accountable: findings are
  assigned to them and they get notifications, but they see the asset only through a group or a
  grant.
- You can only hand out scope you hold: a restricted user can assign only assets they can see and
  cannot add themselves to a group.
- Out-of-scope records answer `404`, not `403`, so their existence is not revealed.
- Scope ends when the membership is suspended or the account is disabled.
- Grants, group memberships and role assignments do not expire. The one exception is external
  members without a home organization, whose access ends after 90 days by default (at most 365);
  an admin can set a new end date.

Plan the rollout: create teams, assign assets (rules scale better than one-by-one), and make sure
analysts who need the whole inventory are admins, hold a full-data-access custom role, or are in a
team that holds every asset.

## Modules

Owners and admins can turn optional modules on or off per organization under **Settings > Modules**
(`/api/v1/tenants/{tenant}/settings/modules`). Routes of a disabled module answer
`403 MODULE_NOT_ENABLED` for everyone, owners included. The core modules (dashboard, assets,
findings, scans, team, roles, audit, settings) cannot be disabled.

Modules are a product switch, not a security boundary: if the module state cannot be read, the
request is allowed through and the permission and data-scope checks still apply.

## API keys

Organization API keys (`oct_...`) act as the user who created them, with a chosen subset of that
user's permissions, and are read-only on the REST API. A key never gets the owner/admin bypass or
full data access. See [API authentication](../api/authentication.md).

## Platform administrators

Platform administrators are not organization roles. They use the separate admin console with their
own roles (`super_admin`, `ops_admin`, `readonly`), and an organization token never works on admin
routes or the other way round. See [Identity and access](index.md#platform-administrators-and-organization-users).
