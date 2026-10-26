---
title: Google Workspace
parent: Identity and access
nav_order: 6
---

# Organization SSO with Google Workspace (OpenID Connect)
{: .no_toc }

Lets the members of one organization sign in with their Google Workspace (or Cloud Identity) accounts.
It is configured per organization by a platform administrator and is different from the installation-wide
[Sign in with Google button](social-google.md).

| | Organization SSO with Google Workspace | [Social "Sign in with Google"](social-google.md) |
|---|---|---|
| Purpose | Members of one organization sign in with their Workspace accounts | A generic button for the whole installation |
| Configured by | Platform administrator in the platform console, approved by the organization owner | Operator: platform console or `OAUTH_GOOGLE_*` variables |
| Accounts accepted | Only accounts of a Google Workspace or Cloud Identity organization (`hd` claim) | Any Google account with a verified email |
| Joins people to an organization | Yes, just in time for DNS-verified domains, if enabled | No |
| Counts as the organization's SSO (enforcement, 2FA) | Yes | No |
| Redirect URI | `https://<app>/auth/sso/callback/google_workspace` | `https://<app>/auth/callback/google` |

`<app>` is the public origin of OpenCTEM, the address people open in the browser (`APP_URL`; with the
bundled gateway `OPENCTEM_PUBLIC_URL`, by default `https://<OPENCTEM_HOSTNAME>`). It is not the
platform console's own site. Other providers: [Entra ID](sso-entra-id.md), [Okta](sso-oidc.md),
[SAML 2.0](sso-saml.md). Overview: [Sign-in methods](sign-in-methods.md).

1. TOC
{:toc}

## Step 1: Create the OAuth client in Google Cloud

1. In the Google Cloud console, open (or create) a project owned by your Workspace organization.
2. **APIs & Services > OAuth consent screen:** choose **Internal**, so only users of your Workspace
   can authorize. Add the scopes `openid`, `email` and `profile`.
3. **APIs & Services > Credentials > Create credentials > OAuth client ID**, application type
   **Web application**.
4. **Authorized redirect URIs:** add exactly `https://<app>/auth/sso/callback/google_workspace`.
5. Copy the **Client ID** and **Client secret**.

## Step 2: Prove the email domain

Organization SSO admits people only for email domains the organization has proven with DNS. A
platform administrator (super admin, with a fresh authenticator code for each change) opens
**Platform console > Organizations >** the organization **> Single sign-on** and, under **Verified
domains**, adds the Workspace domain. Publish the TXT record shown, then select **Verify now**:

| Host | Type | Value |
|---|---|---|
| `_openctem-verify.example.com` | TXT | `openctem-domain-verification=<token>` |

A domain can be verified for SSO by one organization only; public email providers, disposable-email
domains and public suffixes are refused.

## Step 3: Add the identity provider

On the same tab, under **Identity providers**, add a provider:

| Field | Value |
|---|---|
| Provider | `google_workspace` |
| Display name | The button label |
| Client ID, Client secret | From step 1. The secret is stored encrypted. |
| Scopes | `openid`, `email`, `profile`. Set them explicitly: the built-in default list also contains a Microsoft-only scope. |
| Allowed domains | Optional. If set, only these Workspace domains may sign in (see [Domain restriction](#domain-restriction)). |
| Auto-provision users | On to create memberships at the first sign-in (just in time) |
| Default role | `viewer` (default) or `member`. SSO never provisions admins or owners. |

If the organization already has an owner, the change is **pending** until an owner approves it in the
organization under **Settings > SSO approvals** (with step-up re-authentication). Pending changes
expire after 7 days. An organization with no owner yet gets the change applied directly.

Users then sign in at `https://<app>/login?org=<organization-slug>` and choose the provider.

The API also checks the redirect URI against an exact-match allow-list, `SSO_ALLOWED_REDIRECT_URIS`.
When unset, it is derived from `CORS_ALLOWED_ORIGINS`, `OAUTH_FRONTEND_CALLBACK_URL` and
`SMTP_BASE_URL`, which is right when the web app is at `APP_URL`. `APP_ENCRYPTION_KEY` must be set.

## Domain restriction

Every Workspace sign-in must carry the `hd` (hosted domain) claim in the verified ID token, which
Google sends only for Workspace and Cloud Identity accounts. The sign-in is refused, and no account,
membership or session is created, when:

- `hd` is missing (a consumer Google account, even one registered with a company email address);
- the provider has allowed domains and `hd` is not one of them;
- the provider has no allowed domains and `hd` is not DNS-verified for the organization.

Existing members are held to the same rule as new ones. A new person is also admitted only if their
email domain is in the organization's allowed email domains, when it has any.

## Who is admitted, and just-in-time provisioning

- An **existing member** signs in when the Google account's verified email matches their account, or the
  account is already bound to this Google user.
- A **new person** is provisioned just in time only when auto-provision is on, the domain is DNS-verified
  for the organization, and the allowed-domain rules above hold. They get the provider's default role.
  Otherwise they must be [invited](sign-up-and-invitations.md). The platform administrator can also set,
  per verified domain, whether new people are admitted and in which role.
- An owner can turn on **Approve new SSO members**: first-time people wait with no access until an
  administrator approves them under **Settings > Members**.

## Enforcing SSO and break-glass

When a working provider exists and at least one of the organization's domains is verified, a platform
administrator can turn on **SSO enforcement** (same tab). Members must then sign in through the
organization's identity provider; a password session, a social login or another organization's SSO is
refused for this organization.

Plan the way back in before you enforce:

- The organization **owner** can always sign in with a password, so the organization cannot be locked out.
  Keep at least one owner with a password and 2FA.
- The owner can grant time-limited exceptions to named members (at most 90 days, 2FA required), for
  example for a service person without a Workspace account.
- If a verified domain later fails its daily DNS check it stops admitting new people, but enforcement
  stays on, so removing the DNS record cannot reopen password sign-in.
- Platform administrators are unaffected: they sign in on the platform console, and keep a break-glass
  administrator ([First administrator](../install/first-admin.md)).

## Existing password accounts

An SSO sign-in never takes over an account that has a password, even when the email matches: it is
refused with "an account with this email already exists". There is no self-service link action. What to
do:

- **People who have never signed in** (invited, or created by an admin and no password set yet) are
  claimed by their first SSO sign-in when the email domain is DNS-verified for the organization.
- **People with a password account** keep using it until SSO enforcement applies; the owner can grant a
  time-limited exception while you plan the move.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `redirect_uri_mismatch` from Google | The authorized redirect URI does not exactly match `https://<app>/auth/sso/callback/google_workspace`. |
| `404 SSO provider not configured` | Wrong or missing `?org=` slug, no active provider, or a pending change not yet approved by the owner. |
| `invalid redirect URI` | The callback is not in `SSO_ALLOWED_REDIRECT_URIS`. |
| `invalid_scope` from Google | The provider uses the default scope list. Set scopes to `openid`, `email`, `profile`. |
| Sign-in refused with "domain not allowed" | The account is not a Workspace account (`hd` missing), or its domain is neither verified for the organization nor in the allowed domains. |
| "You do not have access to this organization" | Just-in-time provisioning was not allowed: verify the domain, turn on auto-provision, or invite the user. |
| "email is registered with a different login method" | The account belongs to another sign-in method or another Google user. This is the account-takeover guard. |
| "waiting for an administrator's approval" | **Approve new SSO members** is on. An administrator approves the person under **Settings > Members**. |
