---
title: Team and access
parent: User guide
nav_order: 2
---

# Team and access

How to bring people into your organization and control what they can do and
what they can see. These pages are in the settings area (**Settings** in the
sidebar footer), under **Access** and **Organization**. Most actions need an
**Admin** or **Owner** role; some are owner-only.

Access control has three layers that work together:

- **Roles** decide what a member can **do** (permissions).
- **Teams** and **assignment rules** decide which assets and findings a member
  can **see** (data scope).
- **Members** is where you invite people and give them roles.

For the full model see [Roles, groups and permissions](../identity/roles-and-permissions.md).

## Members

**Settings › Access › Members** (`/settings/members`) lists the people in the
organization, their roles and pending invitations.

![The Members settings page with five members, their roles, two-factor status and a pending invitation]({{ site.baseurl }}/assets/images/identity/members.png)
*Figure: Settings, Members.*

### Add people

There are two ways:

- **Invite user**: enter the **Email address**, tick one or more roles under
  **Assign roles** and send. The invitation link is shown once with a copy
  button; when email is configured the person also receives it by email. They
  join with the roles you chose when they open the link.
- **Add user**: create the account yourself with a **Name**, **Email** and
  roles. The person receives a link to set their password (see
  [Accounts created by an administrator](01-getting-started.md#accounts-created-by-an-administrator)).
  If they lose it, the member's menu offers **Get setup link** while setup is
  pending.

A member can hold several roles (up to ten). At least one role is required. Only
the organization **owner** can make someone an administrator.

Pending invitations are listed under **Pending invitations**, with **Resend
email**, **Cancel invitation** and a copy-link action.

### Manage members

The metric strip at the top (**Members**, **Active**, **Disabled**,
**Offboarded**, **Pending invitations**) doubles as a quick filter. Each member's
menu offers:

- **View details**: their roles, what they own and what they can access (access
  groups, direct grants, API keys, owned assets and schedules, assigned
  findings, pentest engagements).
- **Change roles**: add or remove roles, then save.
- **Reset 2FA**: signs the member out everywhere and lets them sign in with their
  password alone until they set up two-factor authentication again (at their
  next sign-in if the organization requires it). Use it only after confirming
  their identity. The member is notified by email and the reset is audited.
- **Disable** / **Re-enable**: disabling ends the member's access at once
  (sessions end, API keys are suspended, the scans, report schedules and
  workflows they own are paused) but keeps their groups, grants and ownership so
  you can re-enable them later.
- **Offboard...**: ends access for good. API keys are revoked and their access
  groups, grants, pentest engagements and roles are removed. The wizard asks you
  to hand their work to someone else (**Choose a new owner**) or return it to the
  queue unassigned. The membership stays as a record so history keeps their
  name; inviting them again later starts from zero.
- **Erase personal data** (owner only, offboarded members): replaces the
  person's name and email with an anonymous label everywhere and clears their
  credentials. Findings, comments and audit history stay, attributed to the
  label. This cannot be undone.

Protections:

- The **owner** cannot be disabled, offboarded or removed.
- Only the owner can change, disable or offboard another **administrator**, or
  reset an administrator's or owner's two-factor authentication. Other
  administrators see these actions disabled with that explanation.

## Roles

OpenCTEM uses **allow-only, role-based access control**: a member's abilities are
the union of the permissions their roles grant. There are no deny rules.

![The Roles settings page with the four system roles]({{ site.baseurl }}/assets/images/identity/roles.png)
*Figure: Settings, Roles: the built-in roles and their permission counts.*

**Settings › Access › Roles** (`/settings/roles`) lists the roles. The cards
**Roles**, **System roles** and **Custom roles** also act as filters. Columns:
**Role**, **Permissions** (the count, limited to the modules your organization
has enabled), **Level** and **Created**.

The four built-in **system roles**, from most to least powerful:

| Role | Can do |
|---|---|
| **Owner** | Everything, including deleting the organization and owner-only settings |
| **Admin** | Manage members, roles and most settings |
| **Member** | Create and edit resources (assets, findings, scans, ...) |
| **Viewer** | Read only |

System roles cannot be edited or deleted.

### Create a custom role

1. Click **Create Role**.
2. Enter a **Role Name** and an optional description.
3. Choose the **Permissions** (search, or use the shortcuts to select all read
   or all write permissions).
4. Decide on **Full Data Access**: on, the role sees every asset; off, it sees
   only the assets of the member's teams.
5. Save. The role can now be assigned when you invite or manage members.

You can only put permissions into a role that you hold yourself, so you cannot
create or edit a role more powerful than you. **Edit role** and **Delete role**
are available on custom roles only; deleting a role removes its permissions from
everyone who holds it.

Permissions come **only** from roles. Teams decide which data a member sees,
never what they can do.

## Teams and assignment rules

**Settings › Access › Teams** (`/settings/teams`) organizes members into teams
that control which assets they can see.

> Members who are in no team see no assets or findings until you add them to a
> team or grant them an asset. Owners, admins and roles with full data access
> see everything.

### Teams

- Click **Create team**, enter a **Team name** (for example "Security Team" or
  "DevOps") and an optional description.
- Click a team to open its details, with the tabs **Overview**, **Members**,
  **Assets** and **Scope rules**:
  - **Members**: **Add Member** (pick the member and their role in the group) or
    remove one.
  - **Assets**: **Assign Asset** or **Bulk Add**, choosing an **Ownership Type**:
    **Primary** (main owner with full access and responsibility),
    **Secondary** (co-owner), **Stakeholder** (view access, receives critical
    notifications) or **Informed** (no direct access, receives summary
    notifications). Removing an asset removes the team's access to it.
  - **Scope rules**: **Add Rule** to assign assets to the team automatically,
    either by **Tag Match** (up to ten tags, **Any (OR)** or **All (AND)**) or by
    **Asset Group Match** (up to five asset groups), with an ownership type and a
    priority (0 to 100, higher first). **Preview** shows how many assets a rule
    matches, are already assigned and would be added; **Reconcile** applies it.
- Each row shows the team's **Members** and **Assets**. **Edit team** and
  **Delete team** are in the row menu (deleting asks for confirmation).

### Assignment rules

The **Assignment rules** tab routes matching assets and findings to a team
automatically, so you do not have to assign everything by hand.

1. Click **Create assignment rule**.
2. Enter a **Name** and an optional description.
3. Set the **Priority**. Lower numbers have higher priority; rules are evaluated
   in priority order.
4. Pick the **Target team**.
5. Add **Conditions** (optional): **Asset Type** and/or **Severity**.
6. Save.

From a rule's menu, **Test rule** reports how many findings the rule matches.
Rules can be **Active** or **Inactive**, edited and deleted.

## Sign-in policy

**Settings › Access › Authentication** (`/settings/authentication`) holds the
organization's sign-in rules. Changing them needs an owner or admin.

![The Authentication settings page with the two-factor and sensor identity switches]({{ site.baseurl }}/assets/images/identity/authentication.png)
*Figure: Settings, Authentication.*

- **Require two-factor authentication**: members who sign in with a password
  must set up an authenticator app at their next sign-in. Members who sign in
  through SSO use their identity provider's two-factor settings.
- **Email verification**: **Auto (Recommended)** requires verification only when
  email (SMTP) is configured; **Always require** forces it (SMTP must work);
  **Never require** skips it. Use **Never require** only on closed internal
  deployments: it lets anyone register with any address.
- **Access restrictions**: **Allowed email domains** and an **IP allowlist**
  (one IP address or CIDR range per line; empty means no IP restriction). The
  page shows your current IP so you do not lock yourself out.
- **Private targets need a sensor-local policy** and **Require key-bound sensor
  identity**: sensor policies explained in [Sensors](../sensors/index.md).

**Single sign-on** (SAML or OIDC) and verified domains are configured per
organization by the **platform administrator**, not on this page; the page says
so and tells you whom to contact. When the platform administrator proposes an SSO
change, an owner approves or rejects it under **Settings › Access › SSO
approvals** (`/settings/sso-approvals`); nothing takes effect until an owner
approves it. See [Identity and access](../identity/index.md).

## Directory sync (SCIM)

**Settings › Access › Directory sync (SCIM)** (`/settings/scim`) lets your
identity provider create and remove accounts automatically.

1. Click **Generate SCIM token**, give it a **Name** (for example the identity
   provider's name) and copy the token. It is shown once.
2. Configure your identity provider with the **SCIM endpoint** shown on the page
   and the token.
3. Revoke a token from its row when you no longer need it.

The cards show **Total tokens**, **Active tokens** and **Revoked tokens**. See
[SCIM](../identity/scim.md).

## API keys

**Settings › Access › API keys** (`/settings/api-keys`) creates keys for scripts
and tools that call the API.

![The API keys page listing two keys with their scopes and expiry, key prefixes blurred]({{ site.baseurl }}/assets/images/api/api-keys.png)
*Figure: Settings, API keys.*

1. Click **Generate API key**.
2. Enter a **Name** and an optional description.
3. Tick the **Scopes** the key needs (for example `assets:read`,
   `findings:read`, `scans:write`). Scope each key to the minimum it needs.
4. Choose when it **Expires** (30 days, 90 days, 1 year or never).
5. Copy the key. It is shown once.

Each key shows its scopes, expiry and last use; you can **Revoke** or **Delete**
it. See [Authentication and API keys](../api/authentication.md).

## AI access (MCP)

**Settings › Access › AI access (MCP)** (`/settings/mcp`) connects an AI
assistant (any Model Context Protocol client) to your organization's data,
read-only.

1. Click **Generate MCP connection key**.
2. Give it a **Name** (for example "Claude on my laptop"), pick the **Purpose**
   (**General read access** or **Pentest report writing**) and an expiry.
3. Copy the key (shown once) and the **Client configuration** snippet into your
   client.

See [MCP server](../api/mcp.md).

## Audit log

**Settings › Organization › Audit log** (`/settings/audit-log`) records who did
what, when and with what result. Reading it needs the audit permission; without
it the page shows **Access denied**.

![The Audit log page listing recent actions with actor, resource, result and severity]({{ site.baseurl }}/assets/images/security/audit-log.png)
*Figure: Settings, Audit log.*

- Cards for the last seven days: **Events (7 days)**, **Successful**, **Failed**
  and **Denied**.
- Search by actor, action or resource, hide events performed by the system
  itself, and filter by **Result** and **Severity**.
- Click an event to see who did it and when, the request (IP address, request
  ID), the changes and the metadata. Request and resource IDs can be copied.

See [Audit log](../security/audit-log.md).
