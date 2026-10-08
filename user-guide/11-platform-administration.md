---
title: Platform administration
parent: User guide
nav_order: 11
---

# Platform administration

**Platform administrators** run the installation as a whole: they create
organizations, set up single sign-on for them, manage the other administrators
and decide who may create organizations. They work in the **admin console** at
`/admin` in the same web console. An administrator account belongs to no
organization and is separate from organization accounts.

The admin console sidebar has:

- **Overview**
- **Manage**: **Organizations**, **Administrators** (super admin only)
- **Scanning**: **Target mappings**
- **System**: **Admin sign-in** (super admin only), **Sign-up**, **System logs**

## Administrator roles

| Role | Can do |
|---|---|
| **Super admin** | Everything, including administrators and SSO |
| **Operations admin** | Create organizations, manage scanning |
| **Read-only admin** | View only |

## The first administrator

The first administrators (a primary super admin and a break-glass backup) are
created on the server with the `bootstrap-admin` command, which prints a
temporary password for each, once. It can also create the first organization and
its owner. See [First administrator](../install/first-admin.md).

Who may create organizations is set by the sign-up policy below. Its initial
value comes from the `TENANT_CREATION_MODE` setting (`admin_only` by default, or
`self_service`); once the policy is saved in the console, the console value wins.

## Sign in to the admin console

1. Sign in on the normal sign-in page (`/login`) with your administrator email
   and password. You are sent to the admin console.
2. Enter the six-digit **Verification code** from your authenticator app and
   click **Continue**. Two-step verification is required for every
   administrator: the first time, scan the QR code (or enter the setup key) and
   click **Verify and finish setup**.
3. If you still have a temporary password, the console asks you to **Change your
   temporary password** before anything else. Changing it signs you out
   everywhere; sign in again with the new password.

If the installation has an identity provider for administrators
(see [Admin sign-in](#admin-sign-in)), the console sign-in page also offers **Sign in with
{provider}**. Password sign-in then remains for break-glass accounts.

## Overview

**Overview** (`/admin`) shows the number of organizations and administrators,
failed administrator actions, and the most recent administrator activity, with a
link to the full log.

## Organizations

**Organizations** (`/admin/organizations`) lists every organization on the
installation with its owner, member count, single sign-on setup and creation
date. Search by name or slug.

![The Organizations page of the admin console]({{ site.baseurl }}/assets/images/user-guide/admin-organizations.png)
*Figure: Admin console, Organizations.*

**Create an organization** (operations admin or above):

1. Click **New organization**.
2. Enter the **Name**, the **Slug** (used in URLs, including the SAML sign-in
   addresses), the **Owner email** (an existing account or a new person, for whom
   an account is created) and, optionally, the owner name and a description.
3. Click **Create organization**. A new owner receives a one-time link to set a
   password (by email when email is configured).

Open an organization for its tabs:

- **Overview**: slug, creation date, active members, owners and SSO status.
- **Users**: the organization's members. While an organization has no owner,
  **Create first owner** adds one. Other members are added by the owner and the
  organization's own administrators, not from the console.
- **Single sign-on** (changes need a super admin):
  - **SAML 2.0** (for example Okta, Entra ID, ADFS) and OIDC identity providers;
  - **Verified domains** (proved by a DNS TXT record), which automatic sign-in
    joining depends on;
  - **Require single sign-on**, available once SAML or an OIDC provider is set up
    (the organization owner can always still use a password).

  SSO changes proposed here take effect only after the organization's owner
  approves them under **Settings › Access › SSO approvals**. See
  [Identity and access](../identity/index.md).
- **Audit chain**: checks the integrity of the organization's audit log. **Re-check**
  verifies the chain and lists entries that do not verify. A super admin can
  rebaseline the chain when every break is explained; this is irreversible and
  asks you to type the organization's name.

## Administrators

**Administrators** (`/admin/administrators`, super admin only) lists the people
who administer the installation, with their role, how they sign in, when a
break-glass account was last tested, their status and last activity.

![The Administrators page of the admin console with the platform and break-glass administrators]({{ site.baseurl }}/assets/images/user-guide/admin-administrators.png)
*Figure: Admin console, Administrators.*

- **New administrator**: name, email (an address that is not a member of any
  organization) and role. If an account had to be created, its temporary password
  is shown once.
- A row's menu (never on your own account): change the role, **Mark as
  break-glass** / **Unmark break-glass**, **Confirm last sign-in was a test**,
  **Remove identity provider binding**, **Reset two-step verification**, and
  **Deactivate** / **Reactivate**. Each action asks for confirmation.

**Break-glass** accounts are local super admins that may still use a password
when the identity provider is required. Every break-glass sign-in alerts all
administrators; confirm test sign-ins so real ones stand out.

## Admin sign-in

**Admin sign-in** (`/admin/system/admin-sign-in`, super admin only) sets how
administrators sign in to the console, separately from organization sign-in.

- **Identity provider (OIDC)**: offer it on the console sign-in page, with the
  button label, issuer URL, client ID and secret, redirect URI and scopes (which
  must include `openid`).
- **Second factor**: trusted `acr` and `amr` values; a token that carries one of
  them skips the console code.
- **Require the identity provider**: refuses password sign-in for everyone except
  break-glass accounts. It needs an active break-glass super admin first.

## Sign-up

**Sign-up** (`/admin/system/sign-up`) decides who may create an organization:
**Only platform administrators** or **Anyone who signs up**, and whether people
may request access. It applies to email sign-up, social sign-in and creating a
team; signing in to an existing organization through SSO is not affected. Saving
needs a super admin and a code from your authenticator; the other administrators
are emailed. Existing organizations, users and sessions are not changed.

## System logs

**System logs** (`/admin/system-logs`) records every action taken by platform
administrators, including sign-ins and refused attempts. Filter by action (for
example `console.login`) and administrator email.

![The System logs page of the admin console listing administrator actions]({{ site.baseurl }}/assets/images/operations/admin-system-logs.png)
*Figure: Admin console, System logs.*

## Target mappings

**Target mappings** (`/admin/scanning/target-mappings`) decide which asset types
each scanner target type can scan. Scans skip assets that no active mapping
covers.

- The cards: **Mappings**, **Active**, **Inactive**, **Target types mapped** and
  **Asset types covered**; filter by target and asset type.
- **New mapping** (operations admin or above): the target type (for example URL,
  domain, IP, host, repository, container, cloud account, service, port,
  database, API, certificate), the asset type, whether it is the primary mapping,
  its priority and whether it is active. The pair cannot be changed later.
- Edit, activate or deactivate a mapping (operations admin); delete it (super
  admin). Each confirmation explains which assets scans would skip.
