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
   (`GET /api/v1/auth/oauth/<provider>/authorize`) and sends the browser there.
2. The provider returns the browser to **`https://<app>/auth/callback/<provider>`** with a code.
3. The web app posts the code to the API, which exchanges it (with PKCE), reads the provider's
   identity and signs the person in.

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
| Where | **Settings > Sign-in > Social login** in the platform console: client ID, write-only client secret, the redirect URI to register, a test button. Applied live. | `OAUTH_*` variables of the API, applied on restart |
| Availability | From the release that adds it | All releases |
| Precedence | A variable set in the environment overrides the console and locks the field there | |

Each provider guide shows both. The console steps apply only from the release that includes the
feature; on an earlier release use the environment variables.

## Rules that apply to every provider

### Who may sign in

- The provider must report a **verified email**. A GitHub account without a verified primary email, a
  Google account with an unverified email and a Microsoft account without the `xms_edov` claim are
  refused.
- A person with an existing account is signed in. A person without one gets an account only when the
  [sign-up policy](sign-up-and-invitations.md#creating-organizations) admits them or they have a
  **pending invitation** to that email address. Otherwise the sign-in fails with "Your organization isn't set up yet. Ask your
  administrator to invite you." (error code `SIGNUP_NOT_AVAILABLE`) and nothing is created.
- An email address on a domain whose organization requires SSO cannot create an account with social
  login (the answer is "Your organization requires single sign-on for this address").
- A platform administrator cannot sign in this way. The attempt fails with the generic provider error.
- A blocked or suspended account gets no session.

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
| The identity is already bound to an account | Signed in. The account follows the provider's email if it changed and no other account uses it. |
| The email belongs to an account with a **password** | Linked automatically when all the conditions below hold; otherwise refused with `OAUTH_ACCOUNT_EXISTS`: the sign-in page says an account with this email already exists, to sign in with the password and link the provider in **My account > Security**. |
| The email belongs to an account made by another provider (for example Google, now GitHub) | Refused with `OAUTH_ACCOUNT_EXISTS`. Sign in with the first provider and link the second one in **My account > Security**. |
| The email belongs to an invited account that has not set a password yet | Adopted only when every organization it belongs to has DNS-verified the email's domain; otherwise refused. |
| No account | Created if the sign-up policy or a pending invitation admits it. |

#### Linking a provider to your account

Signed in, open **My account > Security > Connected sign-in methods** and click **Link** next to Google,
GitHub or Microsoft. You confirm it is you (authenticator code or password), sign in at the provider,
and come back with the provider linked. The provider account does not need the same email address.
**Unlink** removes it after the same confirmation; your only remaining way to sign in cannot be
removed. Each link and unlink is recorded in the audit log and e-mailed to you.

#### Automatic linking

A Google or Microsoft sign-in links itself to an existing password account with the same address
only when all of these hold:

- the provider runs the address: a `gmail.com` or `googlemail.com` address, a Google Workspace
  account whose domain is the address's domain, or a Microsoft address whose domain is verified
  in its Entra tenant (GitHub never links automatically);
- the provider verified the address, and the account's own address is verified;
- the platform allows it: **Console > Settings > Sign-up**, **Link Google and Microsoft sign-in to
  existing accounts** (on by default).

Every other session of the account is then signed out, a pending password reset link stops working,
and the account's mailbox gets a notice. Turn the setting off if accounts on your platform were ever
created without a verified address (for example administrator-created accounts with a temporary
password, or a period without working e-mail).

#### Two-factor authentication still applies

A password account signed into through a linked provider (linked by hand or automatically) is asked
for its second factor exactly as after the password: the provider replaces the password, never the
authentication code. Organizations that enforce their own SSO or require two-factor authentication
treat the session as before.

## Troubleshooting (all providers)

| Symptom | Cause and fix |
|---|---|
| No button on the login page | The provider is not enabled, or client ID or secret is missing, or `OAUTH_ENABLED=false`. The button appears only when all are set. Check `GET /api/v1/auth/providers`. |
| "Sign-in could not be started" (`start_failed`) | The API refused the redirect URI: the web app's public origin differs from the origin of `OAUTH_FRONTEND_CALLBACK_URL`. |
| "Sign-in could not be completed" (`callback_failed`) with an invalid state | The `state` is single use and expires after `OAUTH_STATE_DURATION` (10 minutes). Causes: the person waited too long, used the Back button, opened the login on one host name and returned on another (the state cookie is host specific), or blocked cookies. Start again from the login page. |
| `callback_failed` right after consent | The code exchange failed: wrong client secret, a redirect URI that differs from the one registered, or the API cannot reach the provider (egress). The API log names the provider and the reason. |
| `provider_error` | The person cancelled at the provider, or the provider returned an error (for example an app in testing mode). |
| "Your organization isn't set up yet" | The sign-up policy is closed and the person has no invitation. Invite them, or change the policy. |
| "An account with this email already exists" (`OAUTH_ACCOUNT_EXISTS`) | The address has a password account (or an account of another provider). Sign in with it, then link the provider in **My account > Security**. See [Existing accounts](#existing-accounts). Earlier releases showed an internal error instead. |
| The person signs in but sees no organization | Expected without a membership or invitation. See [What happens after sign-in](#what-happens-after-sign-in). |

Every error that returns to the login page carries a fixed code, never the provider's own text.
