---
title: Security
parent: Platform console
nav_order: 2
---

# Console security
{: .no_toc }

The **Security** group of the [platform console](index.md): who administers the
installation, how they sign in, the second-approval rule for the most dangerous
actions, and the record of what administrators did.

1. TOC
{:toc}

---

## Administrators

**Administrators** (super admin only) lists the people who administer the
installation, with their role, how they sign in (**Password**, **Temporary
password**, **Identity provider**), when a break-glass account was last tested,
their status and last activity.

![The Administrators page listing two super admins, an operations admin, a read-only admin and a break-glass account]({{ site.baseurl }}/assets/images/console/administrators.png)
*Figure: Platform console, Administrators.*

- **New administrator**: name, email and base role. The account is created with
  no password and the new administrator is e-mailed a single-use set-password
  link that expires after 24 hours; they choose their own password and set up
  two-step verification. Nobody else ever sees a password.
- **Without platform e-mail** the console shows the link once (**Copy invitation
  link**) for a role below super admin, or for any role while approvals are off;
  showing it writes a critical `admin.invitation_link_disclosed` row. While
  approvals are on, adding a super admin without working e-mail is refused
  (`409 INVITATION_NEEDS_EMAIL`) before any approval is used: run
  `bootstrap-admin invite -email=... -role=...` on the host instead, which prints
  the link once (critical audit row, roster notice). A failed send never falls back
  to showing the link.
- The new administrator's first console sign-in is announced by e-mail to every
  other administrator.
- A row's menu (never on your own account): **Make {role}**, **Mark as
  break-glass** / **Unmark break-glass**, **Confirm last sign-in was a test**,
  **Remove identity provider binding**, **Reset two-step verification**, and
  **Deactivate** / **Reactivate**. Each action asks for confirmation; making or
  removing a super admin, and resetting another administrator's two-step
  verification, also need a second super admin's approval ([Approvals](#approvals)).

Every change to the roster (an administrator added, changed or removed, a sign-in
reset, the identity provider or the security-key policy changed) is emailed to
every other active administrator and logged with `alert=admin_roster_change`.

**Break-glass** accounts are local super admins that may still use a password
when the identity provider is required. Every break-glass sign-in alerts all
administrators and shows a banner in that session; record planned test sign-ins
so that real ones stand out. The Overview warns when a break-glass account has
not been tested for 90 days. A break-glass account never approves a second-approval
request, cannot be a member of an organization (an account that is a member cannot
be marked break-glass: 409), holds only its base platform role, and is refused on
every main-site sign-in with the same answer as a wrong password (logged with
`alert=break_glass_main_site_sign_in`).

## Roles

**Roles** (any administrator reads it) lists the platform roles, what each allows
and how many administrators hold it. Administrators who read the roster also see
who holds which role.

- A platform owner gives an **additional role** (Operator, Support, Security
  auditor, Billing) with **Give a role**, or takes one with the cross on its
  badge. Each change asks for a reason and a fresh confirmation, is in the admin
  activity log and is emailed to the other administrators. Nobody changes their
  own roles or gives a role with permissions they do not hold.
- A break-glass account holds its base role only: giving it an additional role is
  refused (409), also by the database. Repeating a grant changes and audits nothing.
- The **base role** (Platform owner, Platform admin, Read-only) is changed on
  [Administrators](#administrators); making someone a platform owner needs a
  second owner's approval.
- The page warns while fewer than two named platform owners (not counting
  break-glass accounts) exist: with one, approvals have no second approver.
- Platform roles never apply inside an organization, and an organization never
  sees them.

Every console page and action needs a platform permission; the generated
reference lists them per role and per route (`api/docs/architecture/platform-permissions.md`
in the source).

## Sessions

**Sessions** (super admin) lists every open console session with the
administrator, role, how they signed in, the IP address, when it started and when
it was last seen. **End** signs that administrator out at once (with a fresh code;
recorded in the admin activity log). The session rules (15 minutes idle, 8 hours
at most, three per administrator) are on the [console page](index.md#sessions).

## Approvals

The console's most dangerous actions need a **second super admin** (four-eyes):

| Action | Where |
|---|---|
| Make a super admin, remove a super admin | [Administrators](#administrators) |
| Reset another administrator's two-step verification | [Administrators](#administrators) |
| Stop requiring security keys | [Admin sign-in](#admin-sign-in) |
| Remove the administrators' identity provider, switch it off or stop requiring it | [Admin sign-in](#admin-sign-in) |
| Give the administrators' identity provider a new issuer or client, or new trusted acr or amr values | [Admin sign-in](#admin-sign-in) |
| Open sign-up (a wider sign-up policy) | [Sign-up](settings.md#sign-up) |
| Point platform e-mail at another mail server (host, port, connection security or SMTP user name) | [E-mail](settings.md#e-mail) |
| Send platform AI data to another destination (provider, server address, private-network switch or API key) | [AI provider](settings.md#ai-provider) |
| Reset a user's two-factor authentication | [Users](organizations-and-users.md#users) |
| Re-sign an organization's audit chain | [Organizations](organizations-and-users.md#one-organization) |
| Delete an organization now | [Organizations](organizations-and-users.md#delete-an-organization) |

How it works:

1. A super admin tries the action. The API answers
   `428 SECOND_APPROVAL_REQUIRED`, naming the action and its exact target, and the
   console offers **Ask for approval**: give a reason and confirm. The other super
   admins are emailed.
2. Another super admin opens **Security › Approvals**, checks the request with the
   person who asked, and clicks **Approve** (with a fresh code) or **Reject**.
3. The requester repeats the action within **24 hours**. The approval is bound to
   the requester, the action and the exact target, works once and then shows as
   **Used**. The requester can **Withdraw** a request.

An approval for a mail server or an AI destination is bound to that exact
destination (for an AI key, a keyed fingerprint of the key), so a different change
cannot ride on it.

Nobody approves their own request (the database refuses it as well), and
break-glass accounts can ask and reject but never approve; they also do not count
as a second super admin. Every step is recorded as critical in the admin activity
log and emailed to the administrators.

**With one named super admin**, approvals are off: the actions run on that
administrator's confirmation alone, recorded as critical (`approval.single_admin`)
and announced to every administrator. The page says so and explains how to add a
second super admin. Plan for at least two named super admins in production.

![The Approvals page seen by a second super admin: a waiting request to delete Example Retail now with Approve and Reject buttons, and an approved request]({{ site.baseurl }}/assets/images/console/approvals-approver.png)
*Figure: Security, Approvals, seen by the approving super admin.*

## Admin sign-in

**Admin sign-in** (super admin only) sets how administrators sign in to the
console, separately from organization sign-in.

- **Identity provider (OIDC)**: **Offer on the console sign-in page**, with the
  **Button label**, **Issuer URL**, **Client ID**, **Client secret**, the
  **Redirect URI** to register with the provider (`<console origin>/login/callback`)
  and **Scopes** (must include `openid`; the email claim must be verified for the
  first sign-in). Only existing administrators can sign in this way.
- **Second factor**: by default the console asks for its own code after the
  identity provider. **Trusted acr values** and **Trusted amr values** let a token
  that carries one of them skip the console code.
- **Require the identity provider**: password sign-in is refused for everyone
  except break-glass accounts. It needs an active break-glass super admin first.
- **Require security keys**: administrators who hold a security key or passkey
  must use it; the authenticator app is refused at sign-in and for sensitive
  actions. To turn it on you must hold at least two keys and unused recovery codes
  yourself. Other administrators are asked to register keys before the rest of the
  console opens, and may use the authenticator app for 7 more days; nobody can
  remove a key below two; break-glass administrators keep the authenticator app.

Every change or removal of the identity provider, and the sign-up and platform
e-mail settings, need a fresh authenticator code each time (the five-minute step-up
window does not count). Identity provider changes and the security-key policy are
audited at critical severity with the configuration before the change. Removing,
relaxing or repointing the identity provider and turning off the security-key
requirement need a second super admin ([Approvals](#approvals)).

The sign-in page gives every refused password sign-in the same answer, "Wrong email
or password", also when the identity provider is required; it then shows the
provider's hint and button.

An administrator who signs in only through the identity provider has no console
authenticator, so protected actions answer `403 STEP_UP_UNAVAILABLE`: keep at least
one super admin with a console authenticator or security key (every break-glass
account has one).

## Admin activity

**Admin activity** records every action of the platform administrators, including
sign-ins, elevations and refused attempts. Filter by action (for example
`console.login`), administrator, outcome and time; open an entry for the request,
resource and client; **Export** downloads the filtered list.

![The Admin activity page listing administrator actions with their result and IP address]({{ site.baseurl }}/assets/images/console/activity.png)
*Figure: Platform console, Admin activity.*

The log is append-only (the API's database role cannot update or delete it) and a
hash chain whose state the console shows. Request bodies are stored with secrets,
passwords, keys, tokens and codes redacted, and address fields (`url`, `*url`,
`*webhook*`) keep only their scheme and host. Rows written before v0.16.0 may still
hold a full webhook address: rotate the alert webhook after upgrading. The network
address, user agent and request body of an entry are shown only to administrators
whose roles read the administrators or the Users directory (platform owner,
platform admin, support, security auditor); a read-only administrator sees the
action, the actor, the time and the result. To keep a copy off the machine, set
`ADMIN_AUDIT_SINK` (an `https://` collector, `syslog+tls://` or a `file://` path);
a managed service (`MANAGED_SERVICE=true` in production) must set it, or the API
does not start. See [Audit log](../security/audit-log.md).

## My security keys

**My security keys** (sidebar footer) registers security keys and passkeys for
your own account; they are the preferred way to sign in and to confirm sensitive
actions. **Add security key** asks you to confirm first, then your browser asks you
to touch the key or use your fingerprint, face or PIN. Register at least two (one
is a spare). **Generate recovery codes** creates ten one-time codes, shown once
(copy or download them); they sign you in when no key is at hand but never confirm
an action. Adding a key or new codes emails you.

A key is bound to the console's address (`ADMIN_PUBLIC_URL`): changing the host
makes registered keys unusable (sign in with the authenticator app or a recovery
code and register again). Without `ADMIN_PUBLIC_URL` set on the API, security keys
are not available.
