---
title: Social login
parent: Identity and access
nav_order: 3
has_children: true
---

# Social login (Google, GitHub, Microsoft)
{: .no_toc }

Social login adds "Sign in with Google", "Sign in with GitHub" and "Sign in with Microsoft" buttons to
the login page. It is configured once for the whole installation. Each provider has its own guide:

- [Google](social-google.md)
- [GitHub](social-github.md)
- [Microsoft](social-microsoft.md)

1. TOC
{:toc}

## How it works

1. The person selects a button. The web app asks the API for the provider's authorization URL
   (`GET /api/v1/auth/oauth/<provider>/authorize`). The API also returns a one-time
   `browser_binding` secret, which the web app keeps in an HttpOnly cookie, and the web app opens the
   provider only when the address is an `https` address.
2. The provider returns the browser to **`https://<app>/auth/callback/<provider>`** with a code.
3. The web app posts the code, the state and the browser binding to the API
   (`POST /api/v1/auth/oauth/<provider>/callback`), which consumes the single-use state record,
   exchanges the code (with PKCE), reads the provider's identity and signs the person in.

`<app>` is the public origin of OpenCTEM, the address people open in the browser (`APP_URL`; with the
bundled gateway, `OPENCTEM_PUBLIC_URL`, by default `https://<OPENCTEM_HOSTNAME>`). `<provider>` is
`google`, `github` or `microsoft`.

| Provider | Redirect URI to register at the provider |
|---|---|
| Google | `https://<app>/auth/callback/google` |
| GitHub | `https://<app>/auth/callback/github` |
| Microsoft | `https://<app>/auth/callback/microsoft` |

The redirect URI is built by the web app from its own public origin (`NEXT_PUBLIC_APP_URL`, which the
Compose, Helm and Ansible deployments set from the same public URL as `APP_URL`). The API accepts it only
when its scheme and host (with port) equal those of `OAUTH_FRONTEND_CALLBACK_URL`, which defaults to
`APP_URL/auth/callback`. Otherwise the button fails with "Sign-in could not be started". There is no
separate allow-list for social login: if the web app is served from a different origin than
`APP_URL`, set `OAUTH_FRONTEND_CALLBACK_URL` to that origin.

## Two ways to configure it

| | Platform console | Environment variables |
|---|---|---|
| For | Most installations | Automated installs and infrastructure-as-code |
| Where | **Settings > Social login** in the platform console: client ID, write-only client secret, scopes, **Offer on the sign-in page**, the redirect URI to register, **Test configuration**. Applied live on every replica. | `OAUTH_*` variables of the API, applied on restart |
| Availability | From v0.16.0 | All releases |
| Precedence | While `OAUTH_<PROVIDER>_CLIENT_SECRET` is set, that provider is pinned to the environment and read-only in the console. Remove the variables to manage it in the console. `OAUTH_ENABLED=false` still switches every provider off. | |

Each provider guide shows both. On a release before v0.16.0 use the environment variables.

Rules of the console page:

- Changing a provider needs a super admin, a fresh confirmation and a reason. Every change is audited
  at critical severity (never the secret) and announced to the other administrators.
- Changing a provider's client ID needs its client secret in the same save: a stored secret is never
  reused with a new client ID.
- **Test configuration** checks the stored client ID and secret, or an ID and secret entered
  together, against the provider's token endpoint. It never tests a new client ID with the stored
  secret. Each check is audited (provider, client ID and result) and rate limited like a sign-in
  attempt.
- The secrets are covered by key rotation (`rekey`).

## Rules that apply to every provider

### Who may sign in

- The provider must report a **verified email**. A GitHub account without a verified primary email, a
  Google account with an unverified email and a Microsoft account without the `xms_edov` claim are
  refused. A provider that returns no address is refused with `400 OAUTH_NO_EMAIL`.
- A verified email is not always **proof that the person owns the mailbox**. The platform treats the
  address as proved only where the provider runs it:

  | Provider | The address is proved when |
  |---|---|
  | Google | it is on `gmail.com` or `googlemail.com`, or the account's Workspace domain (the `hd` claim) equals the address's domain. A personal Google account created on a company address proves nothing. |
  | Microsoft | always (the sign-in already requires the domain-owner-verified `xms_edov` claim) |
  | GitHub | never. Only the primary verified address is read, and it is used to sign in only. |

  Without that proof a social sign-in cannot join an organization by its domain policy, claim an
  invitation, or claim an account an administrator created for the address. Only an account already
  bound to that provider identity signs in; otherwise the answer is `403 EMAIL_NOT_AUTHORITATIVE`
  ("This provider cannot prove that you own this email address") and the person signs in with their
  password, or asks an administrator, then links the provider. Where sign-up is open, a new account is
  still created, unverified, with no domain join and no invitation claim.
- A person with an existing account is signed in. A person without one gets an account only when the
  [sign-up policy](sign-up-and-invitations.md#creating-organizations) admits them or they have a
  **pending invitation** to that email address. Otherwise the sign-in fails with "Your organization isn't set up yet. Ask your
  administrator to invite you." (error code `SIGNUP_NOT_AVAILABLE`) and nothing is created.
- An email address on a domain whose organization requires SSO cannot create an account with social
  login (the answer is "Your organization requires single sign-on for this address").
- A break-glass platform administrator account cannot sign in this way: the answer is the same as for
  a wrong password. Any other administrator account may sign in to the main site like anyone else and
  acts there with its organization role only; the platform role counts only in the platform console.
- A blocked or suspended account gets no session (`ACCOUNT_SUSPENDED`).

### What happens after sign-in

Social login gives the person an account and a session. It does **not** add them to any organization.
They then land in one of these places:

- their organization, when they are already a member of exactly one or choose one;
- onboarding, when they have no organization: accept a pending invitation, create an organization if
  the sign-up policy allows it, or ask for access.

"User lands without organization" is therefore normal for a new person who has no invitation. Invite
them to the email address of their provider account (the invitation is matched by email).

When an organization enforces SSO, or requires 2FA, a social session does not satisfy it: the person
must sign in with password and 2FA, or through that organization's own SSO. See
[Two-factor authentication](two-factor.md).

### Existing accounts

On the first social sign-in the account is bound to the provider's identity. Matching rules:

| Situation | Result |
|---|---|
| The identity is already bound to an account | Signed in. The account follows the provider's email if it changed and no other account uses it; the new address counts as verified only where the provider proves it (see [Who may sign in](#who-may-sign-in)). |
| The email belongs to an account with a **password** | Refused with `OAUTH_ACCOUNT_EXISTS`; nothing on the account changes. The sign-in page says an account with this email already exists. Sign in with the password (and your second factor); the app then offers to link the provider (see below). It is never linked automatically. |
| The email belongs to an account made by another provider (for example Google, now GitHub) | Refused with `OAUTH_ACCOUNT_EXISTS`. Sign in with the first provider; the app then offers to link the second one. |
| The email belongs to an invited account that has not set a password yet | Adopted only when the provider proves the address and every organization the account belongs to has DNS-verified the email's domain; otherwise refused. |
| The email belongs to an older account of the same provider that was never bound to an identity | Bound on this sign-in only for GitHub or a proved address; otherwise refused with `EMAIL_NOT_AUTHORITATIVE`. |
| No account | Created if the sign-up policy or a pending invitation admits it. |

#### Linking a provider to your account

A provider is never linked without your explicit confirmation, and every confirmation asks for a
proof typed in the dialog at that moment:

- the **code from your authenticator app** when two-factor authentication is on (a recovery code is
  not accepted, and neither is the code you just used to sign in: wait for the next one);
- otherwise your **password**.

Having signed in a moment ago does not count. An account that signs in only through a provider and
has no two-factor authentication must turn it on (**My account > Security**) before it can link or
unlink a provider. Wrong codes or passwords count towards the account lockout.

There are two ways to link:

- **After a refused sign-in.** You tried to sign in with Google and the address already has an
  account. Sign in to that account the usual way; the app asks **Link Google to your account?** with
  the code (or password) field. **Link** links it and signs out your other sessions; **Not now**
  forgets it. The offer lasts 10 minutes and works once, in the same browser.
- **From your settings.** Open **My account > Security > Connected sign-in methods**, click **Link**
  next to Google, GitHub or Microsoft, enter the code (or password), sign in at the provider, and come
  back with the provider linked. The provider account does not need the same email address. The link
  starts on the web server: its one-time browser binding stays in an HttpOnly cookie and never
  reaches page scripts, so the link must be finished in the browser that started it (otherwise
  `400 OAUTH_INVALID_STATE`). The link state is single use and expires with it.

Confirming a link signs out the account's other sessions first; if they cannot be signed out, nothing
is linked. A mistyped code or password keeps the pending offer, so you can try again within its 10
minutes.

**Unlink** removes a provider after the same proof; your only remaining way to sign in cannot be
removed. Each link and unlink is recorded in the audit log (with the kind of proof used) and e-mailed
to you.

#### No automatic linking

A sign-in never links itself to an existing account, whichever provider vouches for the address, and
no setting turns that on. Linking always needs your own proof (see above).

#### Two-factor authentication still applies

A password account signed into through a linked provider is asked
for its second factor exactly as after the password: the provider replaces the password, never the
authentication code. Organizations that enforce their own SSO or require two-factor authentication
treat the session as before.

## Troubleshooting (all providers)

| Symptom | Cause and fix |
|---|---|
| No button on the login page | The provider is not enabled, or client ID or secret is missing, or `OAUTH_ENABLED=false`. The button appears only when all are set. Check `GET /api/v1/auth/providers`. |
| "Sign-in could not be started" (`start_failed`) | The API refused the redirect URI: the web app's public origin differs from the origin of `OAUTH_FRONTEND_CALLBACK_URL`. |
| "Sign-in could not be completed" (`callback_failed`) with an invalid state (`OAUTH_INVALID_STATE`) | The `state` is single use, bound to the browser that started the sign-in, and expires after `OAUTH_STATE_DURATION` (10 minutes). Causes: the person waited too long, used the Back button, finished in another browser, opened the login on one host name and returned on another (the binding cookie is host specific), or blocked cookies. Start again from the login page. |
| `callback_failed` right after consent | The code exchange failed: wrong client secret, a redirect URI that differs from the one registered, or the API cannot reach the provider (egress). The API log names the provider and the reason. |
| `provider_error` | The person cancelled at the provider, or the provider returned an error (for example an app in testing mode). |
| "Your organization isn't set up yet" | The sign-up policy is closed and the person has no invitation. Invite them, or change the policy. |
| "This provider cannot prove that you own this email address" (`EMAIL_NOT_AUTHORITATIVE`) | A personal Google account on a company address, or a GitHub account, tried to claim an account, an invitation or a domain join. Sign in with the password (or ask an administrator), then link the provider. See [Who may sign in](#who-may-sign-in). |
| "An account with this email already exists" (`OAUTH_ACCOUNT_EXISTS`) | The address has a password account (or an account of another provider). Sign in with it, then confirm the link the app offers, or link the provider in **My account > Security**. See [Existing accounts](#existing-accounts). Earlier releases showed an internal error instead. |
| "The code or password is not correct" when linking (`LINK_PROOF_FAILED`) | A wrong password, a wrong code, a recovery code, or the code already used to sign in. Wait for the next code and try again; repeated failures lock the account like failed sign-ins. |
| "Turn on two-factor authentication before you change sign-in methods" (`LINK_PROOF_UNAVAILABLE`) | The account has no password and no authenticator app. Turn on two-factor authentication in **My account > Security**, then link or unlink. |
| The person signs in but sees no organization | Expected without a membership or invitation. See [What happens after sign-in](#what-happens-after-sign-in). |

Every error that returns to the login page carries a fixed code, never the provider's own text.
