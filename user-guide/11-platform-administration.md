---
title: Platform administration
parent: User guide
nav_order: 11
---

# Platform administration

**Platform administrators** run the installation as a whole: they create
organizations, set up single sign-on for them, manage the other administrators
and decide who may sign up. They work in the **admin console**, a separate
application with its own sign-in page and its own site, not a part of the
organization web app. An administrator account belongs to no organization and is
separate from organization accounts.

## Where the console is

The console is served by the gateway on its own origin, so a script in the
organization app can never reach it:

- **Port mode** (the default of the Compose stack and the all-in-one image):
  `https://<hostname>:8443`. Change the port with `OPENCTEM_ADMIN_PORT`.
- **Host mode** (recommended for production): its own DNS name,
  `https://<OPENCTEM_ADMIN_HOST>`, with `OPENCTEM_ADMIN_SITE=host`.
- `OPENCTEM_ADMIN_SITE=off` does not serve it at all.

Only client addresses in `ADMIN_ALLOWED_CIDRS` (private networks by default) and
`OPENCTEM_ADMIN_ALLOWED_CIDRS` on the gateway can reach it; other clients get a
refusal. There is no `/admin` area in the organization app. See the
[environment variables](../configuration/environment-variables.md).

The sidebar groups its pages as follows. Items marked with a role are hidden
from lower roles.

| Group | Pages |
|---|---|
| (top) | **Overview** |
| **Customers** | **Organizations**, **Users** (operations admin and above), **Support access** (operations admin and above) |
| **Requests** | **Access requests** |
| **Scanning** | **Target mappings** |
| **Security** | **Admin activity**, **My security keys**, **Sessions** (super admin), **Administrators** (super admin) |
| **System** | **Sign-up**, **E-mail**, **Legal**, **Scan approval**, **Shared sensors**, **Platform scanning**, **Admin sign-in** (super admin), **Limits**, **Content packs**, **Threat intelligence**, **Announcements**, **Software updates**, **AI applications** |
| **Operations** | **Health**, **System** |

## Administrator roles

| Role | Can do |
|---|---|
| **Super admin** | Everything, including administrators, sessions, SSO and policies |
| **Operations admin** | Create organizations, set organization limits, look up users, open support sessions, manage scanning |
| **Read-only admin** | View only (member lists show counts, not people) |

By default (`ADMIN_ELEVATION=required`) every administrator acts as read-only
until they **Elevate** the console session: choose a role no higher than your
own and a duration of 15 to 60 minutes, give a reason and confirm. Every
elevation is audited. With `ADMIN_ELEVATION=off`, administrators act as their
own role from sign-in.

## The first administrator

The first administrators (a primary super admin and a break-glass backup) are
created on the server with the `bootstrap-admin` command, which prints a
temporary password for each, once. It can also create the first organization and
its owner. See [First administrator](../install/first-admin.md).

Who may sign up and create organizations is set by the server setting
`SIGNUP_MODE` (`disabled` by default, `domain` or `open`), which is a ceiling no
console setting can exceed, and by the **Sign-up** policy below, which can only
stay at or below it. `SIGNUP_MODE` replaces the older `TENANT_CREATION_MODE`.

## Sign in to the admin console

1. Open the console address and sign in with your administrator email and
   password (or **Sign in with {provider}** when the installation has an
   identity provider for administrators, see [Admin sign-in](#admin-sign-in)).
2. Confirm it is you: enter the six-digit **Verification code** from your
   authenticator app and click **Continue**, or choose **Use security key or
   passkey** or **Use a recovery code**. Two-step verification is required for
   every administrator: the first time, scan the QR code (or enter the **Setup
   key**) and click **Verify and finish setup**.
3. If you still have a temporary password, the console asks you to **Change your
   temporary password** before anything else. Changing it signs you out
   everywhere; sign in again with the new password.

When the identity provider is required, password sign-in remains for
break-glass accounts only.

## Overview

**Overview** is a "Needs attention" list plus the state of the installation. The
list shows what an administrator should act on now: access requests waiting,
organizations without an owner, break-glass sign-ins and overdue break-glass
tests, refused administrator actions, offline platform sensors, sensor jobs and
scan runs that are waiting too long, notifications that gave up, and a database
schema that is behind or ahead of the release. Below it are the number of
organizations, platform sensors online, the schema state and the most recent
administrator activity.

## Organizations

**Organizations** lists every organization on the installation with its owner,
members, limits, single sign-on setup and creation date. Search by name or slug
and filter by owner.

![The Organizations page of the admin console]({{ site.baseurl }}/assets/images/user-guide/admin-organizations.png)
*Figure: Admin console, Organizations.*

**Create an organization** (operations admin or above):

1. Click **New organization**.
2. Enter the **Name**, the **Slug** (used in URLs, including the SAML sign-in
   addresses), the **Owner email** (an existing account or a new person, for whom
   an account is created) and, optionally, the owner name and a description.
3. Click **Create organization**. A new owner receives a one-time link to set a
   password (by email when email is configured).

Organizations created here have no limits. Open an organization for its tabs:

- **Overview**: slug, ID, creation date, active members, owners, verified
  domains, single sign-on, limits and usage, and recent administrator actions.
- **Members**: the organization's members (a read-only admin sees only the
  count). While an organization has no owner, **Create first owner** adds one.
  When every owner is suspended, a super admin can use **Recover ownership**: it
  creates a new owner account and the set-password link goes to that person only
  by email. Other members are added by the owner and the organization's own
  administrators, not from the console.
- **Limits**: caps for this organization, such as seats, assets, findings,
  sensors, API keys and platform scans a day. No limit applies unless one is set.
  A lower limit never removes anything: additions over it are refused. Changing a
  limit needs an operations admin, a reason and is audited.
- **Single sign-on** (changes need a super admin):
  - **SAML 2.0** (for example Okta, Entra ID, ADFS) and OIDC identity providers;
  - **Verified domains** (proved by a DNS TXT record), which automatic sign-in
    joining depends on;
  - **Require single sign-on**, available once SAML or an OIDC provider is set up
    (the organization owner can always still use a password).

  SSO changes proposed here take effect only after the organization's owner
  approves them under **Settings › Access › SSO approvals**. See
  [Identity and access](../identity/index.md).
- **Scope**: the organization's scan approval policy and its modules. Modules are
  available unless denied here; the organization then switches on or off what is
  available. Core modules are always on.
- **Activity**: administrator actions on this organization.
- **Audit chain**: checks the integrity of the organization's audit log. **Re-check**
  verifies the chain and lists entries that do not verify. A super admin can
  rebaseline the chain when every break is explained; this is irreversible and
  asks you to type the organization's name.

## Users

**Users** (operations admin and above) finds an account in any organization by
email, name or user ID (type at least three characters; accounts are looked up,
not listed). It shows account details only, never what an organization holds:
organizations, linked identities, active sessions and administrator actions on
the account. The actions are **Send password reset**, **Resend verification**,
**Unlock** and **Sign out everywhere**. Platform administrator accounts are
managed under **Administrators**.

## Support access

**Support access** (operations admin and above) lists the organizations whose
owner granted you read-only access to help them (an owner grants it under
**Settings › Support access**, naming your email). **Open support session** reads
that organization's data read-only; the owners are emailed, every member sees a
banner and every page you open is recorded in the organization's audit log.

## Access requests

When sign-up is closed and **Let people request access** is on, people who cannot
sign in may ask for an organization. **Access requests** lists them (Pending,
Email not confirmed, Approved, Rejected). An operations admin approves a request,
which creates the organization with the requester as its owner, or rejects it.
The Overview lists waiting requests.

## Target mappings

**Target mappings** decide which asset types each scanner target type can scan.
Scans skip assets that no active mapping covers.

- The cards: **Mappings**, **Active**, **Inactive**, **Target types mapped** and
  **Asset types covered**; filter by target and asset type.
- **New mapping** (operations admin or above): the target type (for example URL,
  domain, IP, host, repository, container, cloud account, service, port,
  database, API, certificate), the asset type, whether it is the primary mapping,
  its priority and whether it is active. The pair cannot be changed later.
- Edit, activate or deactivate a mapping (operations admin); delete it (super
  admin). Each confirmation explains which assets scans would skip.

## Admin activity

**Admin activity** records every action taken by platform administrators,
including sign-ins and refused attempts. Filter by action (for example
`console.login`) and administrator email. The administrators' log is a hash
chain whose state is shown in the console; set `ADMIN_AUDIT_SINK` to stream it
off the machine.

![The Admin activity page of the admin console listing administrator actions]({{ site.baseurl }}/assets/images/operations/admin-system-logs.png)
*Figure: Admin console, Admin activity.*

## My security keys

**My security keys** registers security keys and passkeys for your own account;
they are the preferred way to sign in and to confirm sensitive actions. A key is
bound to the console's host, so changing the host makes registered keys unusable
(sign in with the authenticator app or a recovery code and register again). A
super admin can turn on **Require security keys**: administrators who hold a key
must then use it, and the authenticator app is refused.

## Sessions

**Sessions** (super admin) lists every open console session. **End** signs that
administrator out at once.

## Administrators

**Administrators** (super admin only) lists the people who administer the
installation, with their role, how they sign in, when a break-glass account was
last tested, their status and last activity.

![The Administrators page of the admin console with the platform and break-glass administrators]({{ site.baseurl }}/assets/images/user-guide/admin-administrators.png)
*Figure: Admin console, Administrators.*

- **New administrator**: name, email (an address that is not a member of any
  organization) and role. If an account had to be created, its temporary password
  is shown once.
- A row's menu (never on your own account): change the role, **Mark as
  break-glass** / **Unmark break-glass**, **Record test** (confirms that the last
  sign-in was a planned test), **Remove identity provider binding**,
  **Reset two-step verification**, and **Deactivate** / **Reactivate**. Each
  action asks for confirmation.

**Break-glass** accounts are local super admins that may still use a password
when the identity provider is required. Every break-glass sign-in alerts all
administrators; record test sign-ins so real ones stand out.

## System settings

### Sign-up

**Sign-up** decides who may sign up. It applies to email sign-up, Google,
Microsoft and GitHub sign-in and creating a team; signing in to an existing
organization through SSO is not affected.

- **Who can create an account?**: **Nobody by public sign-up**, **People on an
  organization's verified domain** (they join that organization and never create
  one) or **Anyone** (every address is verified by email).
- **Who can create an organization?**: **Only platform administrators** or
  **Anyone who signs up** (which needs **Anyone** above).
- **Let people request access**: when only administrators create organizations,
  people who cannot sign in may ask for one.

The server's `SIGNUP_MODE` is the ceiling: the console can stay at or below it,
and options above it are locked. `domain` and `open` need the platform e-mail
set up first, and `open` in production needs the Turnstile keys or
`SIGNUP_CAPTCHA`. Saving needs a super admin and a code from your authenticator;
the other administrators are emailed. Existing organizations, users and sessions
are not changed.

### E-mail

**E-mail** is the platform SMTP server for sign-up, invitation, verification and
password emails. An organization with its own email integration sends through
that instead. See [Email](../configuration/email.md).

### Legal

**Legal** sets what visitors see before they sign in: the links on the sign-in
and sign-up pages, the built-in legal pages and `/.well-known/security.txt`.
Empty fields use the defaults (and the `BRAND_*` settings).

### Scan approval

**Scan approval** sets whether organizations choose their own scan approval
(**The organization decides**, off by default) or the platform sets it
(**Off**, **At least on**, **Strict**). An organization can also be set
individually on its **Scope** tab. In every mode, widening scope still needs
re-authentication and passes the platform deny list. Changes need a super admin.

### Shared sensors

**Shared sensors** are the sensors this installation runs for the organizations
you allow. The page shows their state and queue and lets you **Pause** or
**Retire** one, enroll a new one (a single-use token that you give to the sensor
as `SENSOR_INSTANCE_ENROLLMENT_TOKEN`), list the egress addresses organizations
can allowlist, set anomaly alert thresholds and define **Instance scan zones**
(private ranges shared sensors may scan, for the organizations each zone is
assigned to). Results and findings are never shown here.

### Platform scanning

**Platform scanning** sets whether an organization must prove it owns a domain
before platform sensors scan it. It is off by
default, and on by default when the server runs with `MANAGED_SERVICE=true`; a
value saved here always wins.

### Admin sign-in

**Admin sign-in** (super admin only) sets how administrators sign in to the
console, separately from organization sign-in.

- **Identity provider (OIDC)**: offer it on the console sign-in page, with the
  button label, issuer URL, client ID and secret, redirect URI and scopes (which
  must include `openid`).
- **Second factor**: trusted `acr` and `amr` values; a token that carries one of
  them skips the console code.
- **Require the identity provider**: refuses password sign-in for everyone except
  break-glass accounts. It needs an active break-glass super admin first.

### Limits

**Limits** sets the limits a self-service organization starts with (seats,
assets, findings, sensors, API keys, organizations per person, platform scans
and more). Leave a value empty for no limit. Existing organizations and
organizations created in the console are not changed. Saving needs a super admin
and a code from your authenticator. Limits of one organization are set on its
**Limits** tab.

### Content packs

**Content packs** are the templates, rules and wordlists the platform ships to
sensors. Adding a pack (upload an archive or import from a URL) lints it, leaves
out the files that fail, classifies it and signs it; sensors run only signed
packs. A pack is **pinned to a channel**; point a channel at a version to roll it
out, or **Revoke** a pack to stop sensors from running it (irreversible).

### Threat intelligence

**Threat intelligence** shows the platform-wide feeds every organization uses to
prioritize findings (EPSS and the known-exploited list among them): last and next
sync and record counts. **Sync now** runs a feed immediately, for example after
an outage; each feed can be switched off on a schedule.

### Announcements

**Announcements** publishes a one-line notice (Information, Maintenance or
Warning, with optional start and end) that every signed-in user sees as a banner
while it is active.

### Software updates

**Software updates** shows newer releases and security advisories for this
installation from the signed release feed.

### AI applications

**AI applications** lists every MCP client known to the platform (published
metadata, registered by an organization, or self-registered and unverified) with
its active connections and the number of organizations using it, counts only. An
operations admin can **block** an application everywhere: it can no longer be
authorized and its tokens stop working. See
[Connect an AI assistant](12-connect-an-ai-assistant.md).

## Operations

**Health** shows the state of the installation as the API sees it: build,
database, Redis, work queues, the sensor fleet, how sensors connect (gRPC or
HTTPS, with the reason when it falls back), background jobs and the database
schema. **System** shows services, free space of the data volumes (warning below
20%, critical below 10%; administrators are emailed), the last backup, certificate
expiry and the version check. It is read-only: backup, restore and upgrade run
from the kit on the host.
