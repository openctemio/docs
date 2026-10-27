---
title: Team and access
parent: User guide
nav_order: 2
---

# Team and access

How to bring people into your organization and control what they can do and
what they can see. These pages are in the settings area (**Settings** in the
sidebar footer), under **Access** and **Security**. Most actions need an
**Admin** or **Owner** role; some are owner-only.

Access control has three layers that work together:

- **Roles** decide what a member can **do** (permissions).
- **Teams** and **assignment rules** decide which assets and findings a member
  can **see** (data scope). A team can also carry what its members can do, with
  no role to manage: see [Give a team access](#give-a-team-access).
- **Members** is where you invite people and give them roles.

For the full model see [Roles, groups and permissions](../identity/roles-and-permissions.md).
Common situations (a member who sees nothing, outside members, two-factor rules, refused changes) are
explained in [Who can see and do what](../identity/access/index.md).

## Members

**Settings › Access › Members** (`/settings/members`) lists the people in the
organization, their roles and pending invitations.

![The Members settings page with five members, their roles, two-factor status and a pending invitation]({{ site.baseurl }}/assets/images/identity/members.png)
*Figure: Settings, Members.*

### Add people

There are two ways:

- **Invite user**: enter the **Email address**, choose the **Role** (use **Add
  another role** only when the person needs more) and, optionally, the
  **Teams** they join (without a team, a member who does not see all data sees
  nothing). Roles are grouped as **Built-in roles** and **Custom roles**, each
  with a risk label from **Low risk** to **Full control**. Send the invitation:
  its link is shown once with a copy button, and when email is configured the
  person also receives it by email. They join with the roles and teams you
  chose when they open the link. For an address outside your organization the
  dialog says so and asks for an **End of access** date (required when the
  organization's invitation policy says so, see **Who can be invited** under [Sign-in policy](#sign-in-policy));
  such people are marked **External** wherever members are listed, and a role
  above member makes them use two-factor authentication. A role above member
  also asks you to confirm your identity when you send. The dialog warns when the
  address reaches the same mailbox as an existing member.
- **Add user**: create the account yourself with a **Name**, **Email** and
  roles. The person receives a link to set their password (see
  [Accounts created by an administrator](01-getting-started.md#accounts-created-by-an-administrator)).
  If they lose it, the member's menu offers **Get setup link** while setup is
  pending.

A member can hold several roles (up to ten). At least one role is required. Only
the organization **owner** can make someone an administrator.

Pending invitations are listed under **Pending invitations**, with **Resend
email**, **Cancel invitation** and a copy-link action.

When the organization lets people with a verified address on its domain ask to
join (**Settings › Security › Domains**), **Requests to join** appears above
the list: choose a role (viewer or member, never administrator) and **Approve**
or **Reject**. Requests expire after 30 days. See
[Sign-up and invitations](../identity/sign-up-and-invitations.md#joining-by-domain).

### Manage members

The metric strip at the top (**Members**, **Active**, **Disabled**,
**Offboarded**, **Pending invitations**) doubles as a quick filter; the filters
next to the search box narrow by status (**Current members**, **Active**,
**Disabled**, **Offboarded**, **Everyone**), by **Internal** or **External**
people and by role. Each member's menu offers:

- **View details**: their roles, what they own and what they can access (access
  groups, direct grants, API keys, owned assets and schedules, assigned
  findings, pentest engagements).
- **Change roles**: add or remove roles, then save. Giving someone a privileged
  custom role (one that carries full data access or manages members, teams,
  roles, API keys, the secret store or settings) asks you to confirm your
  identity again.
- **Reset 2FA**: signs the member out everywhere and lets them sign in with their
  password alone until they set up two-factor authentication again (at their
  next sign-in if the organization requires it). Use it only after confirming
  their identity. The member is notified by email and the reset is audited.
- **Transfer ownership...** (owner only, on another active member who has
  two-factor authentication on): see [Transfer ownership](#transfer-ownership).
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

- The **owner** cannot be disabled, offboarded or removed, and the owner role
  is never granted through **Change roles**: ownership moves only with
  **Transfer ownership**.
- Only the owner can change, disable or offboard another **administrator**, or
  reset an administrator's or owner's two-factor authentication. Other
  administrators see these actions disabled with that explanation.

### Transfer ownership

An owner asks another active member to become the owner: **Transfer
ownership...** in that member's menu, then choose what you become afterwards
(administrator, member or viewer) and **Ask to transfer**. Nothing changes until
the person accepts, within 72 hours, after signing in again; a banner on
**Members** shows the request to both of you, with **Accept ownership**,
**Decline** and, for the current owner, **Cancel transfer**. The new owner must
be active, have two-factor authentication on and not be managed by another
organization. A service account cannot own an organization.

### Leave the organization

Any member, whatever their role, can leave from **Settings › My account ›
Profile**, **Leave organization** under **Organization membership**: access
ends at once and the member's API keys for this organization are revoked. The
only owner cannot leave: the button is disabled and says to transfer ownership
first.

## Roles

OpenCTEM uses **allow-only, role-based access control**: a member's abilities are
the union of the permissions their roles grant. There are no deny rules.

![The Roles settings page with the four system roles]({{ site.baseurl }}/assets/images/identity/roles.png)
*Figure: Settings, Roles: the built-in roles and their permission counts.*

**Settings › Access › Roles** (`/settings/roles`) lists the roles. The cards
**Roles**, **System roles** and **Custom roles** also act as filters. Columns:
**Role**, **Risk** (a label from **Low risk** to **Full control** with a line
such as "Changes assets, findings and 2 more"), **Data access**, **Level** and
**Created**.

The four built-in **system roles**, from most to least powerful:

| Role | Can do |
|---|---|
| **Owner** | Everything, including deleting the organization and owner-only settings |
| **Admin** | Manage members, roles and most settings |
| **Member** | Create and edit resources (assets, findings, scans, ...) |
| **Viewer** | Read only |

System roles cannot be edited or deleted.

### Create a custom role

1. Click **Create Role**. Optionally **Start from a template** (for example
   Security analyst, Remediation owner, AppSec engineer or Auditor): it fills in
   the description, permissions and data access, which you can still change.
   The templates are listed in the
   [role and permission matrix](../identity/authorization/roles-matrix.md).
2. Enter a **Role Name** and an optional description.
3. Choose the **Permissions** (search, or use the shortcuts to select all read
   or all write permissions).
4. Decide on **Full Data Access**: on, the role sees every asset; off, it sees
   only the assets of the member's teams.
5. Save. The role can now be assigned when you invite or manage members.

You can only put permissions into a role that you hold yourself, so you cannot
create or edit a role more powerful than you. **Edit role** and **Delete role**
are available on custom roles only; deleting a role removes its permissions from
everyone who holds it. A role created from a template never changes when the
template does: when a newer template version exists, the role shows **Template
update available** with what it would add and remove, and **Apply update** keeps
your own changes (full data access is never changed by an update).

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
  **Access**, **Roles**, **Assets** and **Scope rules**:
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

### Give a team access

Instead of creating a role first, let a team carry what its members can do and
which assets they see. Everyone you add to the team inherits both at once, and
loses both when they leave the team or their membership ends.

1. Open the team and go to the **Access** tab (the **Create team** form has the
   same **Access** section).
2. Under **What members can do**, tick one or more **presets**. Each preset is a
   ready-made set of permissions for one kind of person, such as Security
   analyst, Vulnerability manager, Remediation owner, Auditor or CTEM program
   lead, and shows what it is for. Several presets combine: members get
   everything any of them allows. Tick none for a team that only scopes data.
3. Under **What members can see**, keep **Specific assets** (the team's scope
   rules and assigned assets) or choose **All assets** (only an owner can).
4. **Save access**, then add people on the **Members** tab, with an optional end
   date. A member's profile lists what they inherit under **Access from teams**.

A team that sees all assets, or whose preset sees all assets, is marked
**Elevated access**. Only an owner sets or changes it (after signing in again),
every change is audited, and adding or removing people needs the members
permission, so a team lead cannot put someone in. People from outside your
organization and service accounts cannot join a team that sees all assets, and
owner and administrator are never granted through a team.

When a preset's template changes, the team shows **Update available**; review it
and choose **Apply update**. Nothing changes until you do. The role behind a
preset is managed by the team: it does not appear in **Settings › Access ›
Roles** and cannot be edited or assigned by hand. The **Roles** tab of the team
still lists roles you bound by hand, with presets marked **Preset**.

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

**Settings › Security › Authentication** (`/settings/authentication`) holds the
organization's sign-in rules. Administrators can read them; only the owner can
change them, after signing in again (step-up). The page saves with the bar at
the bottom, shows who changed it last, and lists any change that weakens
protection (for example two-factor no longer required or an emptied IP
allowlist) for confirmation before saving. Every owner and administrator gets an
in-app notice naming who changed what, and the audit log records such a change
with **High** severity.

![The Authentication settings page]({{ site.baseurl }}/assets/images/identity/authentication.png)
*Figure: Settings, Authentication.*

**Two-factor authentication** and **New members**:

- **Require for everyone**: members who sign in with a password
  must set up an authenticator app at their next sign-in. Members who sign in
  through SSO use their identity provider's two-factor settings.
- **Require for owners and administrators**: the same for the
  roles that can change the organization, even when other members do not need
  it. On for every new organization; an organization created before the setting
  existed keeps it off until an owner turns it on.
- **Approve new SSO members**: people your SSO admits for the first time wait,
  with no access, until an administrator approves them in **Members** (their
  menu offers **Approve** instead of **Re-enable**).
- **Email verification**: **Auto (recommended)** requires verification only when
  email (SMTP) is configured; **Always require** forces it (SMTP must work);
  **Never require** skips it. Use **Never require** only on closed internal
  deployments: it lets anyone register with any address. It governs accounts
  invited into this organization; under public sign-up the platform verifies
  every address regardless.

Further cards:

- **Access restrictions**: **Allowed email domains** and an **IP allowlist**
  (one IP address or CIDR range per line; empty means no IP restriction). The
  page shows your current IP so you do not lock yourself out, and refuses a list
  that would lock you out.
- **Who can be invited**: **Anyone**,
  **Verified domains only** or **Verified and allowed domains**. It applies when
  an invitation is sent and when it is accepted; people outside the organization
  are always marked as such. **Require an end of access for people outside**
  asks for an end date (90 days by default, 365 at most) for outside people no
  organization manages, such as personal addresses.
- **Personal accounts**: **Allowed with two-factor** (they prove a second factor
  at every sign-in), **Allowed** or **Blocked** (they cannot be invited, and
  existing ones cannot open the organization; nothing is deleted). When the
  organization enforces SSO, an owner can add a member as an **SSO exception**
  (with a **Reason** and an **Until** date) so they can sign in without it.

What scan jobs may do on your sensors (private targets, out-of-band callbacks,
custom templates, the tool User-Agent and TLS, sensor identity and key binding,
shared sensors) is on **Settings › Scanning ›
[Sensor job safety](10-settings-and-integrations.md#sensor-job-safety)**.

**Single sign-on** (SAML or OIDC) and verified domains are configured per
organization by the **platform administrator**, not on this page; the page says
so and tells you whom to contact. When the platform administrator proposes an SSO
change, an owner approves or rejects it under **Settings › Security › SSO
approvals** (`/settings/sso-approvals`); nothing takes effect until an owner
approves it. Once a domain is verified for SSO, an owner decides under
**Settings › Security › Domains** who may join with it (see
[Sign-up and invitations](../identity/sign-up-and-invitations.md#joining-by-domain)).
See [Identity and access](../identity/index.md).

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
4. Choose when it **Expires**: 30 days, 90 days (the default) or 1 year. Every
   key expires.
5. Copy the key. It is shown once.

Each key shows its scopes, expiry and last use; you can **Revoke** or **Delete**
it. See [Authentication and API keys](../api/authentication.md).

## AI assistants (MCP)

**Settings › Access › AI assistants (MCP)** (`/settings/mcp`) connects an AI
assistant (any Model Context Protocol client) to your organization's data, as
the person who connects it and never beyond what that person can see. A strip
under the title shows the state: **On** or **Off**, **Read-only** or **Read and
comment**, **Approved applications only**, how long connections last and the
highest TLP. The tabs:

- **Connect**: the server URL and the **Client configuration** for your
  assistant. Most people connect with the sign-in flow here: no key to copy. If
  your organization has not approved the application, choose **Request access**
  on the consent screen. For a script without a person, **Generate key** (the
  button in the page header) creates an API key: give it a **Name** (for example
  "Claude on my laptop"), pick the **Purpose** (**General read access** or
  **Pentest report writing**) and an expiry, then copy the key (shown once) and
  the snippet into your client.
- **Applications** (people who can read settings): the **Access requests**
  members made, which an administrator **Approves** (every member can then
  connect applications from that publisher, each person still approving what it
  may do) or **Declines**; the **Approved publishers** (host names, plus the
  ones the platform trusts); and, under **Advanced**, whether **Allow
  unverified applications** (not recommended).
- **Connections** (owners and administrators): every connected application in
  the organization, each of which can be disconnected.
- **Policy** (people who can read settings; saving needs the settings write
  permission and a recent sign-in): **AI assistants** on or off, **What
  assistants may do** (what they may read; whether they may add comments), and
  the limits **Connections last (days)**, **Highest TLP sent to AI applications**,
  **API keys on the MCP server** and **Require proof of possession (DPoP)**.
  Changes apply to existing connections at once.

Your own connections are under **Settings › My account › Connected
applications**. See [Connect an AI assistant](12-connect-an-ai-assistant.md) and
[MCP server](../api/mcp.md).

## Audit log

**Settings › Security › Audit log** (`/settings/audit-log`) records who did
what, when and with what result. Reading it needs the audit permission (owners
and administrators) and **full data access**, because the log names assets and
findings: without the permission the page shows **Access denied**, and with a
restricted data scope it shows **Full data access required**; ask an
administrator to widen your data access.

![The Audit log page listing recent actions with actor, resource, result and severity]({{ site.baseurl }}/assets/images/security/audit-log.png)
*Figure: Settings, Audit log.*

- Cards for the last seven days: **Events (7 days)**, **Successful**, **Failed**
  and **Denied**.
- Search by actor, action or resource, hide events performed by the system
  itself, and filter by **Result** and **Severity**.
- Click an event to see who did it and when, the request (IP address, request
  ID), the changes and the metadata. Request and resource IDs can be copied.
- **Export** downloads the events that match the current filters as **CSV** or
  **JSON lines**, newest first and at most 50,000 events (narrow the filters for
  more). The export itself is recorded in the audit log. Spreadsheet formulas
  in the CSV are neutralised.

See [Audit log](../security/audit-log.md).
