---
title: Roles, groups and permissions
parent: Identity and access
nav_order: 2
---

# Roles, groups and permissions

Access inside an organization is decided by three independent checks:

| Layer | Question it answers | Set by |
|---|---|---|
| Roles and permissions | *What kind of action* may this person take (read findings, run scans, manage members)? | Built-in and custom roles, directly or through a team |
| Data scope | *Which assets* (and the findings and other records linked to them) may they see and act on? | Teams and direct asset grants |
| Modules | Is this *feature* enabled for the organization at all? | Organization module settings |

A request must pass all three. Some actions also need a recent sign-in (step-up) or a second person's
approval. The [authorization reference](authorization/index.md)
is generated from the source:
- the [role and permission matrix](authorization/roles-matrix.md), with the role templates;
- [personas](authorization/personas.md), with the roles, team and data scope recommended for each;
- one permissions page per feature.

The design rules are in
[authorization-matrix.md](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/authorization-matrix.md).

## Built-in roles

Every organization has four system roles. They cannot be edited or deleted.

![The Roles settings page with the four system roles]({{ site.baseurl }}/assets/images/identity/roles.png)
*Figure: The built-in roles.*

| Role | Level (sort order) | Sees all data | Summary |
|---|---|---|---|
| Owner | 100 | yes | Everything, including deleting the organization, approving SSO changes, minting SCIM tokens, changing administrators and transferring ownership. |
| Administrator (`admin`) | 80 | yes | Everything an owner can do except the owner-only actions. |
| Member | 50 | no (data scope applies) | Day-to-day work: read and write assets, findings, scans and scope; no deletes, no member or role management, no sensor, secret store or content management, no audit log. |
| Viewer | 20 | no (data scope applies) | Read-only, without the audit log, the secret store or assignment rules. Every new member (invitation, SSO or SCIM) starts here. |

The built-in roles nest: viewer within member within administrator within owner. The level is only a
display and sort order. Beyond these four, the
[role templates](authorization/roles-matrix.md) are starting points for custom roles.

- Owners and admins pass every permission check. Actions reserved for owners are checked
  separately (for example deleting a group, deleting an assignment rule, deleting the organization,
  changing the 2FA requirement).
- A system role (admin, member or viewer) is changed only on the member (**Settings > Members**,
  change the role in the organization; `PATCH /api/v1/tenants/{tenant}/members/{id}`), never through
  the Roles API. Nobody is made owner by a role change: the owner hands the organization over with
  **Transfer ownership** on the Members page (to an active member with two-factor on, who accepts
  within 72 hours with their own step-up). Invitations can offer admin, member or viewer, never owner.
- Making someone an admin needs an owner and a recent re-authentication
  ([step-up](two-factor.md#step-up-re-authentication)). Only an owner can change the role of
  another admin. An organization always keeps exactly one owner.
- Permission changes take effect on the next request: permissions are re-read per request (cached
  in Redis and invalidated on change).

## Custom roles

Owners and admins (or anyone with `team:roles:write`) create custom roles under
**Settings > Roles** (`/api/v1/roles`). **New role > Start from a template** begins from one of the
role templates (CTEM program lead, Security analyst, Vulnerability manager, Remediation owner, AppSec
engineer, CI integrator, Scan operator, Sensor operator, Validation engineer, External tester,
Researcher, Bug-bounty triager, Threat intelligence analyst, Risk approver, Auditor, Executive viewer;
see the [matrix](authorization/roles-matrix.md)). A template grants nothing until a role is created
from it. The role records the template and its version; when the template changes later the role
shows **Template update available** with what it adds and removes, and your own edits are kept when
you apply it. Every role shows a risk tier and what it views or changes.

A custom role has a name, a slug, a description, a level below 80, a list of permissions and a
**full data access** flag. Rules:

- You cannot put a permission into a role that you do not hold yourself, nor full data access unless
  you have it (owners are exempt).
- A custom role never makes someone an admin. The organization-level role (owner, admin, member,
  viewer) comes only from the system roles, and the Roles API takes custom roles only: granting or
  removing `owner`, `admin`, `member` or `viewer` there is refused with 400.
- Some permissions are reserved for owners and admins and can never be part of a custom role:
  sensor management (`sensors:write`, `sensors:delete`, `sensors:zones:write`,
  `sensors:zones:delete`, `sensors:pair`, `sensors:approve`, `sensors:revoke`,
  `sensors:grant:narrow`, `sensors:grant:widen`) and CI trust
  (`scans:ci:write`: trust configurations, CI settings and code host connections, which admit
  upload credentials). The database refuses them too. CI gate policies and expected scans
  (`scans:ci:policy`) and break-glass (`scans:ci:override`, with step-up and an alert to every
  administrator) can be delegated: the **AppSec engineer** [role template](authorization/roles-matrix.md) carries both, with
  `scans:ci:read`. Reading sensors, zones and commands (`sensors:read`, `sensors:zones:read`,
  `sensors:commands:read`) and queuing commands (`sensors:commands:write`) can be delegated (the
  **Sensor operator** template), but the commands `collect`, `config_update` and `cancel` stay with
  owners and administrators.
- A person can hold several roles. Their permissions are the union of all their roles, and they see
  all data if any of their roles has full data access.
- Custom roles belong to one organization.
- People outside the organization (an email domain it does not hold) can never be owner, and never
  get full data access through a team. A trust with their home organization can cap their role at
  member or viewer.
- A role that carries full data access or member, team, role, API key, secret store or settings
  administration is bound to a team, and the team's members changed, by the owner only, with a recent
  sign-in.

Assign custom roles under **Settings > Members** (**Change roles**, which also has the role in the
organization), or with `PUT /api/v1/users/{userId}/roles` (replaces the custom roles, keeps the
system role, accepts an empty list) and `POST /api/v1/roles/{roleId}/members/bulk`, which need
`team:roles:assign`. A custom role can also be bound to a team (below).

## Permissions

Permissions are named `module[:resource]:action`, for example `findings:triage` or
`attack_surface:scope:approve`. There are 171. The groups:

| Group | Resources and actions |
|---|---|
| Core | `dashboard:read`, `dashboard:aggregate`, `audit:read`, `settings:read`, `settings:write` |
| Assets | `assets:read/write/delete/import/export`; `assets:groups:*`; `assets:components:*` |
| Findings | `findings:read/write/delete/assign/comment/triage/severity/status/export/bulk_update/approve/fix_apply/verify`; `findings:lifecycles:write`; `findings:exposures:*` and `findings:exposures:triage`; `findings:suppressions:read/write/delete/approve`; `findings:vulnerabilities:read`; `findings:credentials:read/write/reveal`; `findings:evidence:reveal`; `findings:remediation:read/write`; `findings:workflows:read/write` |
| Scans | `scans:read/write/delete/execute/approve`; `scans:profiles:*`, `scans:sources:*`, `scans:tools:*`, `scans:templates:*`, `scans:secret_store:*`, `scans:workflows:*`; `scans:content:read/write`; `scans:tenant_tools:read/write`; `scans:windows:manage/override`; `scans:ci:read/write/policy/override` |
| Content catalog | `content:read`, `content:install`, `content:publish` |
| Sensors | `sensors:read/write/delete`; `sensors:commands:read/write`; `sensors:zones:*`; `sensors:pair`, `sensors:approve`, `sensors:revoke`; `sensors:grant:narrow`, `sensors:grant:widen` |
| Team | `team:read/update/delete`; `team:members:read/invite/write`; `team:groups:read/write/delete/members/assets`; `team:roles:read/write/delete/assign`; `team:assignment_rules:*` |
| Integrations | `integrations:read/manage`; `integrations:scm:*`; `integrations:notifications:*`; `integrations:api_keys:read/write/delete` |
| Settings | `settings:sla:*` |
| Attack surface | `attack_surface:scope:read/write/delete/approve`; `attack_surface:scope:exclusions:approve`; `attack_surface:programs:read/write` |
| Validation and pentest | `validation:read/write`; `pentest:campaigns:*`, `pentest:findings:*`, `pentest:retests:read/write`, `pentest:templates:read/write`, `pentest:checklists:manage`, `pentest:reports:write` |
| Compliance | `compliance:frameworks:read`; `compliance:assessments:read/write`; `compliance:mappings:read/write` |
| Reports, threat intel | `reports:read/write`; `threat_intel:read/write` |
| CTEM | `ctem:cycles`, `ctem:attacker_profiles`, `ctem:business_services`, `ctem:compensating_controls`, `ctem:priority_rules`, `ctem:verification_checklists` (each read and write) |
| AI triage | `ai_triage:read`, `ai_triage:trigger` |

`*` stands for the read, write and delete actions of that resource. AI assistants (MCP) have their own
access settings (**Settings > AI assistants (MCP)**); see [MCP](../api/mcp.md). The authoritative list is
`api/pkg/domain/permission/permission.go`; `GET /api/v1/permissions` returns it, and
`GET /api/v1/me/permissions` returns what you hold.

## Groups and data scope

Groups (shown as **Teams** under **Settings > Teams**) decide which assets their members can see. A
team grants no permissions by itself, unless a custom role is bound to it (see below). A group has a
type (`security_team`, `team`, `department`, `project`, `external`) and its own member roles (`owner`,
`lead`, `member`). An inactive team grants nothing; switching a team on re-grants its bound roles, so
it is checked like any other grant.

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
- Role assignments and direct grants do not expire. Team memberships and outside members can carry
  an end date; a membership past its end date stops granting scope at once. When the organization
  requires an end of access for outside people no organization manages, it is 90 days by default (at
  most 365; see [Sign-up and invitations](sign-up-and-invitations.md#people-outside-the-organization)).
- Counts on teams, business units and the scoping and attack surface summaries cover only the assets
  the reader can see.
- Dashboards and their summaries (finding counts, the executive summary, MTTR, threat-intel EPSS and
  KEV counts, validation and scan coverage, attack-path summaries) count the reader's own scope. A
  restricted reader whose role holds `dashboard:aggregate` gets the organization's totals instead,
  with breakdown buckets under 5 left out; lists of findings (top risks, recent activity) stay in
  their own scope either way. Organization-wide history (risk trend, program metrics, CTEM cycle
  trends and a cycle's charter evaluation) needs `dashboard:aggregate` or full data access. See
  [Whose data the dashboard shows](../user-guide/01-getting-started.md#whose-data-the-dashboard-shows).
- Pentest findings follow the campaign: anyone who is not an owner or admin sees and counts a pentest
  finding only as a member of its campaign, and the campaign's client role never sees a draft or
  in-review finding. This holds on dashboards too.
- The audit log needs full data access in addition to `audit:read`, and API keys never read it.

### Teams that carry roles

A custom role can be bound to a team (**Settings > Teams**, team roles; `POST
/api/v1/groups/{groupId}/roles`): every active member of the team holds it. Binding a role, and
changing who is in a team that carries roles, are grants: the person acting must be able to grant each
role and hold the team's assets, and nobody but the owner adds themselves. Only custom roles of the
organization can be bound, and a bound role cannot be deleted. Permission changes reach team members
at once.

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
