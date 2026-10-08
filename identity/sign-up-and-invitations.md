---
title: Sign-up and invitations
parent: Identity and access
nav_order: 1
---

# Sign-up and invitations

This page explains who may create an account or an organization, and how people join an existing
organization.

{: .note }
Sign-up admission is being reworked: one admission rule for every sign-up path, access requests when
sign-up is closed, and email-first sign-in that finds the organization's SSO are planned. This page
describes the current behaviour; check the release notes of your version.

## Creating accounts

| Path | When it works |
|---|---|
| **Invitation** | Always. The invited person registers (or signs in) with the invited email address. |
| **Created by an organization admin** | Always. The admin enters an email and roles; the person gets a one-time set-password link. |
| **Just-in-time SSO** | When the organization's identity provider allows it (see [Verified domains and just-in-time provisioning](#verified-domains-and-just-in-time-provisioning)). |
| **SCIM** | When the organization provisions from its identity provider (see [SCIM](scim.md)). |
| **Open registration** (`POST /api/v1/auth/register`, social sign-in buttons) | Only when `AUTH_ALLOW_REGISTRATION=true`. The default is `false`. |

Registering creates an account only; it does not create or join an organization. Public sign-in
endpoints answer the same way whether or not an email has an account, so they cannot be used to find
out who is registered.

### Passwords and email verification

- A new password must have at least `AUTH_PASSWORD_MIN_LENGTH` characters (default 12), meet the
  composition rules (`AUTH_PASSWORD_REQUIRE_UPPERCASE`, `_LOWERCASE`, `_NUMBER`, `_SPECIAL`; by
  default upper case, lower case and a number) and must not be on an embedded list of about 47,000
  commonly breached passwords.
- Passwords are stored with bcrypt (cost 12).
- Whether a new account must verify its email follows the organization's **email verification**
  setting (`always`, `never` or `auto`; under **Settings > Authentication**). With `auto`, verification
  is required when the installation can send email. People who register through an invitation are
  verified by it. Verification links are valid for 24 hours (`AUTH_EMAIL_VERIFICATION_DURATION`);
  password reset links for 1 hour (`AUTH_PASSWORD_RESET_DURATION`).
- After `AUTH_MAX_LOGIN_ATTEMPTS` (5) wrong passwords or codes, the account is locked for
  `AUTH_LOCKOUT_DURATION` (15 minutes).

## Creating organizations

Who may create an organization is one platform setting, the **sign-up policy**, changed by a super
admin in the admin console under **System > Sign-up** (a fresh authenticator code is required; every
change is audited at critical severity and emailed to the other administrators):

| Policy | Meaning |
|---|---|
| `admin_only` (default) | Only platform administrators create organizations: in the admin console, or with `bootstrap-admin -org-name ... -org-owner-email ...` at installation. People sign in only to organizations that exist. |
| `self_service` | Any signed-in person may create an organization, and becomes its owner. An installation can cap how many self-created organizations one person may own (one by default). |

`TENANT_CREATION_MODE` (`admin_only` or `self_service`) only seeds the policy at the first start; after
that the console value applies. If the stored value cannot be read, the policy is `admin_only`.
Changing the policy never affects existing organizations, members, invitations or sessions.

### The first owner of an organization

A platform administrator creates an organization's first owner in the admin console
(**Organizations > organization > Users**, or when creating the organization with an owner email). The
owner receives a one-time link to set a password (emailed when the installation can send email; shown
once otherwise). From then on the owner and their admins invite or create users; the platform
administrator cannot add further users to an organization that has an owner.

If every owner of an organization is suspended, a super admin can create a recovery owner. The link is
only emailed, never shown, and the action is audited at critical severity in the organization.

## Inviting people

Owners and admins invite from **Settings > Members** (`POST /api/v1/tenants/{tenant}/invitations`):

- An invitation names one or more roles. **Owner** is never offered; only an owner can invite an
  **admin**.
- Invitations expire after **7 days**. They can be resent or deleted.
- The invitation email links to `https://<console>/invitations#token=...`. The token is in the URL
  fragment, so it is never sent to a server or recorded in access logs or `Referer` headers.
- The invitee registers or signs in with the **same email address** and accepts. Declining is
  possible without an account.
- If the address reaches the same mailbox as an existing member's (dots or `+tags` in Gmail-style
  addresses), the admin gets a look-alike warning.

### External members

A person whose email domain does not belong to the organization is an **external member**:

- They join only by accepting an invitation addressed to them; an admin cannot add their existing
  account directly or create one for them.
- They join as **viewer**, with no data until an admin adds them to a team. They can never be owner,
  admin, or hold a full-data-access role.
- If no organization on the installation has verified their email domain (for example a personal
  address), their access ends after **90 days** by default (at most 365). An admin can set a new end
  date. Expired memberships are suspended automatically.
- Owners and admins see each member's kind and, for external members, the name of their home
  organization.

### Personal email addresses

The organization's **personal accounts** policy (owner; security settings API
`personal_accounts`) decides whether addresses at public email providers may join:

| Value | Meaning |
|---|---|
| `allowed` | Personal addresses may join. Existing organizations keep this value. |
| `allowed_with_mfa` | They may join, but get access only with a proven second factor. The default for new organizations. |
| `blocked` | Personal addresses cannot be invited, cannot accept an invitation, and get no access token. |

## Organization access policies

Owners set these under **Settings > Authentication**
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
