---
title: Two-factor authentication
parent: Identity and access
nav_order: 4
---

# Two-factor authentication and step-up

Local accounts (email and password) can protect their sign-in with a time-based one-time password
(TOTP, RFC 6238) from any authenticator app. Organizations can require it. Separately, a few sensitive
actions ask for a fresh proof of identity even inside a signed-in session (step-up).

Accounts that sign in only through SSO have no password in OpenCTEM; their second factor is the
identity provider's. The platform admin console has its own second step, which is always required (see [Platform administrators](#platform-administrators)).

## Turning on 2FA

In **Settings > My account > Security**:

1. Next to **Two-factor authentication**, select **Set up**. Scan the QR code (or enter the secret)
   in your authenticator app.
2. Enter your current password and a code from the app.
3. Save the **10 recovery codes** shown. Each works once. They are shown only now.

![The Set up two-factor authentication dialog with the QR code blurred]({{ site.baseurl }}/assets/images/identity/two-factor-setup.png)
*Figure: Setting up an authenticator app (QR code and key blurred).*

Turning 2FA on signs out every other session of your account.

From then on, sign-in asks for a code after the password. **Use a recovery code instead** switches to
a recovery code; using one is audited and emailed to you.

### Entering a code

Every screen that asks for a code (sign-in, set-up, step-up, self-approvals, the platform console)
uses the same field:

- The six digits show in separate boxes, but it is one field: paste the whole code (spaces or dashes
  are ignored), or let your phone or password manager fill it in.
- When the code is the last thing the screen asks for, it is sent as soon as the sixth digit is in;
  otherwise select the button.
- A refused code is cleared so you can type the next one; wait for the app to show a new code rather
  than retyping the same one (a code works once).
- A recovery code is typed in one field, with or without its dash (`abcde-fghjk`).

| Action (Settings > My account > Security) | Needs |
|---|---|
| Turn 2FA on | password and a code |
| Turn 2FA off | password and a code, or **Use a recovery code instead**; you are emailed |
| New recovery codes (replaces all) | a code from the app |
| Change password | current password; other sessions are signed out and you are emailed |
| See and sign out sessions | signed in; one session or all except the current one |

Codes are single-use: a code from a time step that was already used is refused. Wrong codes count
toward the account lockout (`AUTH_MAX_LOGIN_ATTEMPTS`, default 5; `AUTH_LOCKOUT_DURATION`, default
15 minutes), the same counter as wrong passwords. A sign-in challenge expires after 5 minutes and is
cancelled after 5 wrong codes.

Storage: the TOTP secret is encrypted with `APP_ENCRYPTION_KEY` (AES-256-GCM); recovery codes are
stored as bcrypt hashes.

## Requiring 2FA in an organization

An owner turns on **Require two-factor authentication** under **Settings > Authentication** (in the
**Access** group). **Require two-factor authentication for owners and admins** is a narrower switch
that is on for every organization created from now on (organizations created before keep it off until
an owner turns it on; it is on and locked while the first switch is on). The creator of a new
organization without 2FA gets the organization but no access token (`403 MFA_ENROLLMENT_REQUIRED`) and
enrols at the next sign-in. Other rules can also demand 2FA: a person outside the organization who
holds a role above member, or whose personal address is allowed only with 2FA, must prove a second
factor every time they open the organization (see
[Sign-up and invitations](sign-up-and-invitations.md#people-outside-the-organization)). With the
switch on:

- A member who has not enrolled is asked to enrol at their next sign-in and gets no session until they
  do.
- An access token for the organization is refused (`403 MFA_ENROLLMENT_REQUIRED`) for a password
  session without 2FA. The console signs the user out and back in, which leads to enrolment. A
  requirement turned on mid-session takes effect within one access-token lifetime (15 minutes by
  default).
- A session from **this organization's own** SSO (OIDC or SAML) passes: the organization's identity
  provider owns the second factor, unless **SSO must prove two-factor** is on (below).
- Any other federated session (social sign-in with Google, GitHub or Microsoft, or another
  organization's SSO) is refused for this organization; the person signs in with password and 2FA, or
  through this organization's SSO.
- Owners and admins see each member's 2FA status in the members list (`enabled`, `disabled`, or
  `idp` for SSO users).

![The Authentication settings with the switches that require two-factor authentication]({{ site.baseurl }}/assets/images/identity/authentication.png)
*Figure: Settings, Authentication.*

### SSO must prove two-factor

By default, a sign-in through the organization's own identity provider counts as two-factor: the
provider is trusted to have asked for a second factor. An owner can turn on **SSO must prove
two-factor** under **Settings > Authentication > Two-factor authentication** (with step-up). With it
on, a member who must use 2FA and signs in through the organization's SSO gets access only if the
provider says, in its signed response, that a second factor was used:

- OIDC: the id_token's `amr` claim contains `mfa`.
- SAML: the assertion's authentication context is a multi-factor one (for example
  `http://schemas.microsoft.com/claims/multipleauthn` or `https://refeds.org/profile/mfa`).

Otherwise the token is refused (`403 MFA_ENROLLMENT_REQUIRED`), and the person signs in again
through the provider with multi-factor authentication. Turn multi-factor authentication on in the
identity provider before turning this on. Sessions that already exist without that proof end
within one access-token lifetime. Members who do not have to use 2FA are not affected. Turning the
switch off is recorded as a High audit event and the owners and admins are told.

## Recovery

- **Lost device, recovery codes available:** sign in with a recovery code, then turn 2FA off and on
  again with the new device (or generate new codes).
- **Lost device and codes:** an owner or admin of the organization resets it under
  **Settings > Members**, row menu **Reset 2FA** (step-up required). The reset removes the factor and
  recovery codes, signs the person out everywhere, is audited and emailed to them. If the organization
  requires 2FA, they enrol again at the next sign-in.

Rules for the reset:

- nobody resets their own factor this way (use the self-service flow, which needs the password and a
  code);
- resetting an owner or admin needs an owner;
- because the factor belongs to the account and not to one organization, the caller needs the same
  authority in **every** organization the person belongs to.

## Platform administrators

The admin console has its own sign-in on its own site: email and password (or the platform identity
provider, see [OIDC](sso-oidc.md#platform-administrator-sign-in)), then a second step every time.
There is no way to turn it off.

- **Authenticator app.** Every administrator enrols a TOTP authenticator at first sign-in.
- **Security keys and passkeys** (**My security keys** in the console, under Security). The console
  offers them before the authenticator code. A key is bound to the console's own origin
  (`ADMIN_PUBLIC_URL`; changing the host makes registered keys unusable). Register at least two keys
  (one as a spare).
- **Recovery codes.** Ten one-time codes per administrator, shown once, used at sign-in when no key
  is at hand. They never confirm a sensitive action.
- **Require security keys** (**Security › Admin sign-in** in the platform console, super admin): administrators who hold a key
  must use it and the authenticator app is refused for them, after a 7-day grace period for those
  who have none. It turns on only when the administrator enabling it has two keys and recovery codes.
  Break-glass administrators keep the authenticator app.
- Sensitive console actions ask for a fresh code or key confirmation. With `ADMIN_ELEVATION=required`
  (the default) a console session is read-only until the administrator presses **Elevate** (a role
  no higher than their own, 15 to 60 minutes, with a reason).

## Step-up re-authentication

Some actions could hand the organization to someone who has stolen a session. For those, the API
requires that the session proved the user's identity within the last **10 minutes**:

- creating or deleting an API key; creating a SCIM token;
- changing organization security settings (2FA requirement, IP allowlist, allowed domains, SSO
  settings); approving an SSO change;
- deleting the organization; offboarding or erasing a member; removing a member's 2FA;
- making someone an admin; transferring ownership; renaming the organization's slug;
- changing who may join with a verified domain (**Settings > Domains**); inviting someone outside the
  organization to a role above member; binding a role with administrative permissions to a team;
- creating a sensor or regenerating its key; approving a sensor pairing; widening a sensor's grant;
  allowing bearer-key sensors again;
- revealing a stored credential; reading or rotating an inbound webhook secret; changing where
  evidence files are stored; overriding the CI security gate;
- widening scope (creating, approving or extending scope entries, turning on discovery, removing
  exclusions).

When needed, the console shows one dialog and retries the action:

| Account | Proof |
|---|---|
| Has an authenticator | a current TOTP code (a password or recovery code is not accepted) |
| Local account without an authenticator | the password |
| SSO account without an authenticator | "Sign in again" at the identity provider, which is asked for a fresh authentication (`prompt=login` and `max_age=0` for OIDC, `ForceAuthn` for SAML). The provider's signed authentication time (`auth_time` or `AuthnInstant`) must be under 5 minutes old. For Entra ID, add the `auth_time` optional claim. |

The window is stored on the server for that one session and is not extended by use. A session created
by the organization's SSO counts the identity provider's authentication time, not the session's
creation, so a silent sign-in from a remembered provider session opens no window. Wrong proofs count
toward the account lockout; the step-up endpoint is limited to 5 attempts per minute per IP.

API: `GET /api/v1/auth/step-up` tells which proof the account needs; `POST /api/v1/auth/step-up` with
`{"totp": "123456"}` or `{"password": "..."}` opens the window. Protected routes answer
`403 STEP_UP_REQUIRED` (with `window_seconds`) outside the window, and `403 STEP_UP_UNAVAILABLE` for
callers that cannot step up, such as API keys.

The engineering reference is
[step-up-reauth.md](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/step-up-reauth.md).
