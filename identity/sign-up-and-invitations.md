---
title: Sign-up and invitations
parent: Identity and access
nav_order: 1
---

# Sign-up and invitations

This page explains who may create an account or an organization, and how people join an existing
organization.

## Creating accounts

| Path | When it works |
|---|---|
| **Invitation** | Always. The invited person registers (or signs in) with the invited email address. |
| **Created by an organization admin** | Always for addresses on a domain the organization has verified; anyone else is invited instead. The admin enters an email and roles; the person gets a one-time set-password link. |
| **Just-in-time SSO** | When the organization's identity provider allows it (see [Verified domains and just-in-time provisioning](#verified-domains-and-just-in-time-provisioning)). |
| **SCIM** | When the organization provisions from its identity provider (see [SCIM](scim.md)). |
| **Public sign-up** (the register page, social sign-in buttons) | Only when the [sign-up policy](#creating-organizations) allows it: anyone, or only people on an organization's verified domain. Closed by default. |

Every way in passes one admission rule. When it refuses, the API answers 403 `SIGNUP_NOT_AVAILABLE`
and the web console shows one page, "Your organization isn't set up yet", whatever the reason; no
account is written. A person with a pending invitation, or on an organization's SSO, is always
admitted. In the open and domain modes, disposable email addresses cannot sign up.

Registering creates an account only. A signed-in account that belongs to no organization sees its
options (the onboarding page): its pending invitations, the organization that claims its verified
email domain (**Join** or **Ask to join**, then **Waiting for approval**), and a form to create an
organization when the installation allows it. Offers carry no organization id or slug.

Public sign-in endpoints answer the same way whether or not an email has an account, so they cannot
be used to find out who is registered. Registering again with an address whose password was never
verified emails that address a set-password link; following it verifies the address and replaces the
password.

### Passwords and email verification

- A new password must have at least `AUTH_PASSWORD_MIN_LENGTH` characters (default 12), meet the
  composition rules (`AUTH_PASSWORD_REQUIRE_UPPERCASE`, `_LOWERCASE`, `_NUMBER`, `_SPECIAL`; by
  default upper case, lower case and a number) and must not be on an embedded list of about 47,000
  commonly breached passwords.
- Passwords are stored with bcrypt (cost 12).
- Every self-registered account (sign-up mode `domain` or `open`) must verify its email address before it can
  sign in. A verified address belongs to the **account**, not to one organization, so no organization
  can skip verification for the others.
- An organization's **email verification** setting (`auto` or `always`; under **Settings > Security >
  Authentication**) decides who may **enter that organization**: with `always`, a member must have a
  verified address, and entering is refused until it is verified (the account's other organizations
  are not affected); with `auto` (the default), verification is required when the installation can
  send email. The former `never` value is retired: saving it is refused and a stored `never` reads as
  `auto`. When the setting cannot be read, an unverified account is refused, and accepting an
  invitation applies the same rule.
- An invitation token does **not** prove the invitee's mailbox (the inviting organization holds the
  token). An account registered with an invitation token is created unverified and verifies through a
  link the platform mails to the address; until then it sees no other organization's invitations and
  cannot join by domain. An invitation from an organization that has verified the address's domain
  still verifies the account at once.
- Verification links are valid for 24 hours (`AUTH_EMAIL_VERIFICATION_DURATION`); password reset links
  for 1 hour (`AUTH_PASSWORD_RESET_DURATION`). A reset link works once, also when two requests present
  it at the same moment. **Send a new verification link** (`POST /api/v1/auth/resend-verification`)
  sends the link again: the answer is always 202, and an address gets at most one email every two
  minutes. The verification failure page and a sign-in refused with `EMAIL_NOT_VERIFIED` offer it.
- After `AUTH_MAX_LOGIN_ATTEMPTS` (5) wrong passwords or codes, the account is locked for
  `AUTH_LOCKOUT_DURATION` (15 minutes).

### A server that cannot send email

`GET /api/v1/auth/providers` and `GET /api/v1/me/bootstrap` report `email_delivery`. While the platform
e-mail does not work:

- the forgot-password page says "This server cannot send email. Ask your administrator for a reset
  link." instead of promising an email;
- **Settings > Access > Members** shows **This server cannot send email**, and each invitation offers
  **Copy new link** (a new token, the old link stops working, nothing is mailed;
  `POST /api/v1/tenants/{tenant}/invitations/{id}/link`) and, for an expired invitation, **Renew**
  (`.../renew`);
- in the platform console a platform owner can copy a one-hour password reset link for an account or
  mark its email verified (see [Users](../console/organizations-and-users.md#users)).

## Creating organizations

Who may sign up and who may create an organization is decided in two layers.

**1. The server ceiling, `SIGNUP_MODE`** (environment variable, read at start; default `disabled`).
No API or console session can open sign-up beyond it:

| `SIGNUP_MODE` | Meaning |
|---|---|
| `disabled` (default) | No public account creation. People get accounts from a platform administrator, an invitation or their organization's SSO. Only platform administrators create organizations: in the admin console, or with `bootstrap-admin -org-name ... -org-owner-email ...` at installation. |
| `domain` | Public sign-up only for addresses on an organization's verified domain; those people join that organization and never create one. |
| `open` | Anyone may sign up and create an organization (the hosted service). |

`domain` and `open` need the platform e-mail (**Settings › E-mail** in the platform console, or
`BOOTSTRAP_SMTP_*` for `bootstrap-admin`) and local accounts, or the server refuses to start, and
public sign-up closes while the platform e-mail does not work. Open sign-up also stays closed until a
CAPTCHA is set up: the Cloudflare Turnstile keys in the console (**Settings › CAPTCHA**) or on the
server (`CAPTCHA_TURNSTILE_SECRET` and `CAPTCHA_TURNSTILE_SITE_KEY`), unless the server sets
`SIGNUP_CAPTCHA=off-i-understand` (the API logs a warning while it is closed for this reason). Self-service organizations start with the limits in
`SELF_SERVICE_START_LIMITS` until a super admin saves limits under **Settings › Limits** in the platform console. The old
`TENANT_CREATION_MODE` and `AUTH_ALLOW_REGISTRATION` variables are gone: remove them from the
environment (`TENANT_CREATION_MODE` stops start-up while set).

**2. The sign-up policy**, a runtime switch below the ceiling. A super admin changes it in the admin
console under **Settings › Sign-up** (a fresh authenticator code is required; every change is audited at
critical severity and emailed to the other administrators; opening sign-up needs a second super admin's
approval when there is one, see [Approvals](../console/security.md#approvals)). Any administrator can read it. The page
shows the server setting and what is in force.

| Setting | Choices |
|---|---|
| **Who can create an account?** | Nobody by public sign-up; People on an organization's verified domain; Anyone |
| **Who can create an organization?** | Only platform administrators; Anyone who signs up (needs "Anyone" above) |
| **Let people request access** | When only administrators create organizations, people who cannot sign in may ask for one. |

![The Sign-up page of the admin console with the server setting and the two choices]({{ site.baseurl }}/assets/images/identity/admin-system-signup.png)
*Figure: Platform console, Settings, Sign-up.*

A choice the ceiling does not allow is shown as locked (**Locked by the server configuration**) and
saving it answers 409 `SIGNUP_LOCKED_BY_DEPLOYMENT`. Changing the policy never affects existing
organizations, members, invitations or sessions. If the stored value cannot be read, the policy is
the safe default (only platform administrators).

### Requesting access

With organization creation limited to administrators and **Let people request access** on, the "not
set up" page offers a request form (`/request-access`). Every accepted submission gets the same
answer; limits per address (3 an hour) and per domain (5 a day) and disposable addresses drop
requests silently, and the requester confirms by an emailed link first. Platform administrators see
the queue under **Customers › Access requests** in the platform console; an ops admin approves (the
organization is created with the requester as its owner) or rejects (a neutral email). An existing
account becomes the owner only when the requester confirmed the address by email; without that (for
example on a server without email) the approval is refused with 409, and a confirmed existing account
is emailed that the request was approved. An administrator cannot decide a request made by their own
account or with their own email. Unconfirmed requests are deleted after 24 hours and decided ones
after 90 days.

### Joining by domain

An organization owner decides, per domain the organization has verified for SSO, who may join with
it (**Settings > Security > Domains**; owners change, admins read; saving asks for step-up):

| Setting | Meaning |
|---|---|
| **Who can join with an example.com address?** | **Only people we invite** (default), **Anyone, after an administrator approves**, or **Anyone, automatically**; the person **Joins as** Viewer or Member |
| **Show the organization to colleagues who sign up** | People with a verified address on the domain see the organization's name on the onboarding page |
| **Require single sign-on for every account on the domain** | Password and social sign-up for these addresses are refused (403 `SSO_REQUIRED`); the person is sent to their organization's sign-in |
| **Block new organizations for accounts on the domain** | People on the domain cannot create their own organizations |
| **Include subdomains** | The settings also cover subdomains |

![The Domains settings page with the join, discoverability and single sign-on options of a verified domain]({{ site.baseurl }}/assets/images/identity/settings-domains.png)
*Figure: Settings, Security, Domains.*

Everything is off until an owner turns it on, and stops at once when the domain claim lapses. Join
requests wait under **Requests to join** on **Settings > Access > Members**: an administrator approves them as
viewer or member, or rejects them. One request per person and organization is pending, a person may
ask 5 times a day, and requests expire after 30 days. Nobody becomes an administrator by request.

### The first owner of an organization

A platform administrator creates an organization's first owner in the admin console
(**Organizations**, open the organization, **Members** tab, or when creating the organization with an owner email). The
owner receives a one-time link to set a password (emailed when the installation can send email; shown
once otherwise). An owner email that already has an account is refused with 409: nobody becomes the
owner of an organization they did not ask for, and that person creates the organization after signing
in. From then on the owner and their admins invite or create users; the platform administrator cannot
add further users to an organization that has an owner. The installation command
`bootstrap-admin -org-name ... -org-owner-email ...` may name an existing account, including the
installing administrator (never the break-glass one).

If no owner of an organization can act (every owner's membership is suspended, or their account is
blocked or erased), a super admin can create a recovery owner. The link is only emailed, never shown,
and the action is audited at critical severity in the organization.

## Inviting people

Owners and admins invite from **Settings > Access > Members** (`POST /api/v1/tenants/{tenant}/invitations`):

- An invitation names one or more roles. **Owner** is never offered; only an owner can invite an
  **admin**.
- Invitations expire after **7 days**. They can be resent or deleted.
- The invite dialog can add the invitee to teams (up to 20; only teams the inviter may add people
  to), so the person does not join with no data. It previews, before sending, whether the policy
  allows the address, whether the person is outside, and whether step-up and two-factor will apply.
- Invitations are single use. A resend waits at least 10 minutes and happens at most 5 times; one
  person sends at most 50 invitations an hour. Seats are checked when the invitation is created.
  Cancelled or declined invitations are kept as revoked (so the daily invitation limit counts them)
  and purged after 30 days.
- Accepting re-checks the inviter: an invitation from someone who has since left, been suspended or
  been demoted grants nothing.
- The invitation email links to `https://<your OpenCTEM address>/invitations#token=...`. The token is in the URL
  fragment, so it is never sent to a server or recorded in access logs or `Referer` headers.
- The invitee registers or signs in with the **same email address** and accepts. Declining is
  possible without an account, and only while the invitation is pending (otherwise 409).
- If the address reaches the same mailbox as an existing member's (dots or `+tags` in Gmail-style
  addresses), the admin gets a look-alike warning.

### People outside the organization

Anyone may be invited, to any role except owner, unless the organization restricts invitations
(**Settings > Security > Authentication**, **Who can be invited**: **Anyone** (default), **Verified domains
only**, or **Verified and allowed domains**; an organization with allowed email domains reads as the
last). A person whose email domain the organization does not hold is **outside** the organization:

- They join only by accepting an invitation addressed to them. An admin cannot add their existing
  account directly or create one for them; direct add and create need an address on a domain the
  organization has verified.
- They are marked as outside (an **External** badge) wherever members are listed, and for external
  members owners and admins see the name of their home organization. They can never be owner, and
  never get full data access through a team. A trust with their home organization caps their role.
- Inviting an outside address with a role above member, or accepting such an invitation, needs the
  inviter's recent re-authentication (step-up), and the person must prove a second factor every time
  they open the organization (**Two-factor required** in the invitation list).
- An end of access is optional. With **Require an end of access for people outside** on, it is
  mandatory for outside people no organization manages (for example personal addresses): 90 days by
  default, 365 at most. Expired memberships are suspended automatically.
- Invitation refusals carry a code that the invite dialog explains: `INVITEE_NOT_ON_VERIFIED_DOMAIN`,
  `INVITEE_DOMAIN_NOT_ALLOWED`, `PERSONAL_ACCOUNTS_BLOCKED`, `INVITATION_NO_LONGER_VALID`,
  `INVITATION_ALREADY_MEMBER`, `INVITATION_MEMBERSHIP_SUSPENDED` (the invitee's own membership is
  suspended) and `MEMBERSHIP_SUSPENDED_REACTIVATE` (reactivate the member instead of inviting).

For the rules in one place, including how to give an outside member full access, see
[Outside members](access/outside-members.md).

### Personal email addresses

The organization's **personal accounts** policy (owner; security settings API
`personal_accounts`) decides whether addresses at public email providers may join:

| Value | Meaning |
|---|---|
| `allowed` | Personal addresses may join. Organizations that never chose keep this value. |
| `allowed_with_mfa` | They may join, but get access only with a proven second factor. The default for new organizations. |
| `blocked` | Personal addresses cannot be invited, cannot accept an invitation, and get no access token. |

## Organization access policies

Owners set these under **Settings > Security > Authentication**
(`PATCH /api/v1/tenants/{tenant}/settings/security`, step-up required):

- **Allowed email domains.** When set, only these exact domains (`example.com` does not admit
  `eu.example.com`) can be invited, accept invitations, be created by an admin, be added, be
  provisioned by SCIM or be provisioned just in time by SSO. Existing members are not removed.
- **IP allowlist.** When set, every request with a member's access token or an organization API key
  must come from a listed address or CIDR range, or it gets `403 IP_NOT_ALLOWED`. Saving a list that
  does not contain your own address is refused. It does not apply to sensors, SCIM or inbound
  integration webhooks. For correct client addresses behind proxies, see
  [Hardening](../security/hardening.md#cookies-cors-csrf-and-proxies).
- **Require two-factor authentication** and **SSO enforcement**: see
  [Two-factor authentication](two-factor.md) and [Entra ID](sso-entra-id.md#enforcing-sso).

## Verified domains and just-in-time provisioning

An organization proves it owns an email domain with a DNS TXT record:

| Host | Type | Value |
|---|---|---|
| `_openctem-verify.<domain>` | TXT | `openctem-domain-verification=<token>` |

A domain verified **for SSO** is set up by a platform administrator in the admin console, and it lets
the organization's identity provider admit people from that domain:

- A domain can be verified for SSO by **one organization** on the installation. A second organization
  can add it but not verify it. If the holder's TXT record disappears, another organization can claim
  the domain only after a 7-day window, so a DNS outage does not move the claim.
- Public suffixes, free email providers and disposable-email domains cannot be added.
- Just-in-time provisioning happens at the first SSO sign-in only when the provider has
  auto-provision on, the email domain is DNS-verified for SSO, and it is inside the provider's and the
  organization's allowed domains. New members get the provider's default role, `viewer` or `member`.

A domain an organization verifies for attack surface scanning is proof for scanning only; it never
admits anyone (see [Scope](../scanning/scope.md)).

## Removing people

| Action | Effect | Who |
|---|---|---|
| **Suspend** | Access stops at once (sessions and API keys stop working); everything the member holds is kept. Reversible. | owner or admin |
| **Offboard** | Access removed: keys revoked, teams, grants and roles removed. Work assigned to the person must be reassigned first. The membership remains as a record. | owner or admin, step-up |
| **Erase** | Anonymises the account (see [Data handling](../security/data-handling.md#deleting-people-and-organizations)). Only once the person is offboarded from every organization. | owner, step-up |

Removing someone in one organization does not affect their other organizations.
