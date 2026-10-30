---
title: Two-factor requirements
parent: Who can see and do what
grand_parent: Identity and access
nav_order: 3
---

# Two-factor requirements

Several independent rules can ask a person for a second factor before they can open an organization.
They add up: one satisfied rule does not switch off another.

## The rules

| Rule | Who it applies to | Set by |
|---|---|---|
| **Require two-factor authentication** (`mfa_required`) | Every member who signs in with a password | Owner, **Settings > Security > Authentication** |
| **Require two-factor authentication for owners and administrators** (`mfa_required_for_admins`) | Owners and administrators. On for every organization created recently; older organizations keep it off until an owner turns it on. It is on and locked while the first switch is on. | Owner, **Settings > Security > Authentication** |
| **Personal accounts: Allowed with two-factor** (`allowed_with_mfa`) | Members with a personal address. The default for new organizations. The other values are **Allowed** and **Blocked**. | Owner, **Settings > Security > Authentication** |
| **SSO must prove two-factor** | Members who must use two-factor and sign in through the organization's own identity provider | Owner, **Settings > Security > Authentication** |
| **Platform two-factor floor** (`auth.mfa`: `none`, `admins` or `everyone`) | With `admins`: owners, administrators and members holding a privileged role. With `everyone`: every member. After a grace period (14 days for existing members, 7 for new accounts). | The platform owner ([details](../two-factor.md#the-platform-two-factor-floor)). An organization can require more, never less. |
| **Always on: a privileged outside member** | An [outside member](outside-members.md) who holds a privileged role (owner or admin, full data access, or a privileged permission), directly or through a team. There is no setting to turn this off. | The platform |

A second factor counts when the person signed in with a password and has an authenticator app turned
on, or when their identity provider proved one in the sign-in. Creating credentials (API keys, sensor keys and enrollment tokens,
stored secrets, integrations) needs an enrolled second factor whenever one of these rules covers the
person, even during the platform floor's grace period. Two-factor belongs to the account,
not to one organization: a person who already turned it on in another organization has it here too.

The always-on rule is checked every time an access token is issued for the organization, so it also
applies to sessions that were already open and to the refresh of an access token. On routes that name the organization in
the URL (`/api/v1/tenants/{tenant}/...`), the organization's two-factor rule, personal-account policy
and SSO-exception factor are applied to the caller's session on every request too, whatever
organization the token was issued for. It fails closed: if
the platform cannot read the person's roles or factor, it refuses.

## What the person sees

- Without a second factor, the person signs in to their account but cannot open the organization.
  The token request is refused with `403 MFA_ENROLLMENT_REQUIRED` and the console takes them to
  two-factor set-up when it can.
- The invitation dialog tells the inviter beforehand ("They must use two-factor authentication to
  open the organization") and the invitation list shows **Two-factor required**. The invitation page
  tells the invitee: "You will set up two-factor authentication before you can open the organization:
  your roles are privileged and you are outside the organization".
- A person who already has two-factor turned on is asked for a code at every sign-in and notices
  nothing else.

## Recovering a blocked person

From v0.15.4 a person whose session is refused for two-factor is taken to set-up (see
[Set-up at the next sign-in](#set-up-at-the-next-sign-in)). On v0.15.3 and earlier, the always-on rule for privileged
outside members and the personal-accounts rule did not lead the person to set-up: a new outside
administrator who accepts an invitation could end up with a membership but no way into the
organization. To recover on those releases:

1. As owner, open **Settings > Access > Members**, find the person, **Change roles**, and give them
   **Viewer** only (replace the privileged role). This is allowed without their second factor,
   unless another rule in the table above also applies to them.
2. The person signs in and opens **Settings > My account > Security > Two-factor authentication >
   Set up** ([how](../two-factor.md#turning-on-2fa)). They scan the code, confirm with a code and
   save the recovery codes. They must sign out and in again so the new session carries the factor.
3. As owner, **Change roles** again and restore the privileged role. The console asks you to confirm
   your identity. From now on the person is asked for a code at every sign-in.

Notes:

- If the person is a personal-address member and **Personal accounts** is **Allowed with
  two-factor**, or **Require two-factor authentication** is on, the viewer step does not help,
  because those rules apply to every role. They need two-factor first: for example by turning it on
  in another organization they belong to (it follows the account), or by upgrading to v0.15.4 or later.
- Never weaken an organization-wide switch to let one person in.
- To lose a device and recovery codes later, an owner or administrator resets their two-factor
  under **Members > Reset 2FA** ([Recovery](../two-factor.md#recovery)).

### Set-up at the next sign-in

From v0.15.4 the console offers set-up in place. After accepting an invitation that needs two-factor, the
person sees "You have joined the organization" and the set-up step right away, then opens the
organization. A person whose session is refused for two-factor stays signed in and is taken to a full
set-up page, which names the organization that requires it, and then returns to the page they were
on. Password sign-in also offers set-up when only the outside-member or personal-account rule
applies. Sessions from a social sign-in cannot set up in place and are told so.
The temporary Viewer step is then no longer needed; use the steps above only on v0.15.3 and earlier.
