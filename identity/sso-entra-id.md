---
title: Microsoft Entra ID
parent: Identity and access
nav_order: 4
---

# Single sign-on with Microsoft Entra ID

OpenCTEM has two independent ways to sign in with Microsoft. They do not share configuration.

| | Organization SSO (recommended) | Social "Sign in with Microsoft" |
|---|---|---|
| Purpose | Members of one organization sign in through that organization's Entra directory | A generic button on the login page for the whole installation |
| Configured by | Platform administrator in the admin console, approved by the organization owner | Operator, with `OAUTH_MICROSOFT_*` environment variables |
| Directory | The organization's own directory (single tenant) | Any Entra directory (`/common`) |
| Joins people to an organization | Yes, just-in-time for DNS-verified domains, if enabled | No |
| Counts as the organization's SSO (SSO enforcement, 2FA requirement) | Yes | No |
| Redirect URI | `https://<console>/auth/sso/callback/entra_id` | `https://<console>/auth/callback/microsoft` |

`<console>` is the public origin of the web console (`NEXT_PUBLIC_APP_URL`; with the bundled gateway,
`OPENCTEM_PUBLIC_URL`).

You can also connect Entra ID with [SAML 2.0](sso-saml.md) instead of OIDC, and provision users with
[SCIM](scim.md).

## Step 1: Register the application in Entra ID

In the Azure portal, **Microsoft Entra ID > App registrations > New registration**:

1. **Name:** for example `OpenCTEM`.
2. **Supported account types:** *Accounts in this organizational directory only* for organization
   SSO. Choose *Accounts in any organizational directory* only for the social button.
3. **Redirect URI**, platform **Web**: the URI from the table above, exactly (scheme, host, port and
   path). A mismatch gives Azure error `AADSTS50011`.
4. **Certificates & secrets > New client secret.** Copy the secret **Value** (not the Secret ID).
   Note its expiry date: sign-in stops when it expires.
5. **Overview:** copy the **Application (client) ID** and the **Directory (tenant) ID**.
6. **API permissions:** delegated Microsoft Graph `openid`, `email`, `profile` and `User.Read`.
   Grant admin consent if your directory requires it. No application permissions are needed.
7. **Token configuration > Add optional claim > ID**, and add:
   - `xms_edov` (required): "email domain owner verified". OpenCTEM trusts the email address of an
     Entra sign-in only when this claim is `true`. Without it, every Microsoft sign-in is refused.
     Accept the prompt to turn on the Microsoft Graph email permission.
   - `auth_time` (recommended): needed for [step-up re-authentication](two-factor.md#step-up-re-authentication)
     of SSO users who have no authenticator. Without it they cannot perform protected actions.
   - `sid` (recommended): lets back-channel logout end the exact session (step 4).

Because `xms_edov` must be true, personal Microsoft accounts (outlook.com, hotmail.com, live.com)
and guest users whose email domain is not verified in the signing directory are refused.

## Step 2: Configure organization SSO

Organization SSO is configured by a **platform administrator** (super admin) in the admin console, not
by the organization's own admins:

1. **Admin console > Organizations >** the organization **> Single sign-on**.
2. Under **Verified domains**, add the organization's email domain. Publish the TXT record shown:

   | Host | Type | Value |
   |---|---|---|
   | `_openctem-verify.example.com` | TXT | `openctem-domain-verification=<token>` |

   Then select **Verify**. A domain can be verified for SSO by only one organization on the
   installation; public email providers, disposable-email domains and public suffixes are refused.
3. Under **Identity providers**, add a provider:

   | Field | Value |
   |---|---|
   | Provider | `entra_id` (Microsoft Entra ID) |
   | Display name | The button label, for example `Sign in with Contoso` |
   | Client ID | Application (client) ID |
   | Client secret | The secret value. It is stored encrypted with `APP_ENCRYPTION_KEY`. |
   | Tenant identifier | Directory (tenant) ID. Do not use `common`. |
   | Scopes | Leave empty for the default `openid email profile User.Read`. A custom list must include `openid`. |
   | Allowed domains | Optional. Narrows which verified domains may sign in. |
   | Auto-provision | On to create memberships at first sign-in (just-in-time) |
   | Default role | `viewer` (default) or `member`. SSO never provisions admins or owners. |

4. If the organization already has an owner, the change is **pending** until an owner approves it in
   the organization under **Settings > SSO approvals** (with step-up re-authentication). The owner
   sees the change and is notified in the app and by email. Pending changes expire after 7 days. An
   organization with no owner yet gets the change applied directly.

Users then sign in at `https://<console>/login?org=<organization-slug>` and choose the provider.

### Who is admitted

- An **existing member** of the organization signs in when the Entra account's verified email
  matches their account (or the account is already bound to this Entra user).
- A **new person** is provisioned just in time only when auto-provision is on, their email domain is
  DNS-verified for the organization, it is in the provider's allowed domains (if set), and it is in
  the organization's allowed email domains (if set). They get the provider's default role.
  Otherwise they must be [invited](sign-up-and-invitations.md).
- An account created by another method (for example a password account) is not taken over by an SSO
  sign-in with the same email.
- After the first sign-in the account is bound to the Entra object id (`oid`), so a later email
  change in Entra follows the same account.

### Enforcing SSO

A platform administrator can turn on **SSO enforcement** for the organization (admin console, same
tab), once a working provider exists. Members must then sign in through the organization's identity
provider; a password session or another organization's SSO is refused for this organization. The
organization **owner** can always sign in with a password, so the organization cannot be locked out.
The owner can grant time-limited exceptions to named members (`sso_exceptions`, at most 90 days, 2FA
required).

## Step 3: Optional: one shared Entra app for selected organizations

An operator can run one Entra app registration for several organizations with environment variables.
The fallback applies only to organizations listed in `SSO_ENTRA_ALLOWED_TENANTS` that have no Entra
provider of their own, and the same admission rules apply.

| Variable | Default | Meaning |
|---|---|---|
| `SSO_ENTRA_ENABLED` | `false` | Turns the fallback on |
| `SSO_ENTRA_CLIENT_ID`, `SSO_ENTRA_CLIENT_SECRET` | | App registration credentials |
| `SSO_ENTRA_TENANT_ID` | `common` | Directory id. With `common`, `organizations` or `consumers`, `SSO_ENTRA_ALLOWED_DOMAINS` is required and auto-provisioning is turned off |
| `SSO_ENTRA_ALLOWED_DOMAINS` | empty | Comma-separated email domains |
| `SSO_ENTRA_DEFAULT_ROLE` | `viewer` | `viewer` or `member` |
| `SSO_ENTRA_AUTO_PROVISION` | `true` | Just-in-time provisioning |
| `SSO_ENTRA_DISPLAY_NAME` | `Microsoft Entra ID` | Button label |
| `SSO_ENTRA_ALLOWED_TENANTS` | empty (fallback off) | Comma-separated organization slugs allowed to use the fallback |

## Step 4: Back-channel logout

OpenCTEM supports OpenID Connect Back-Channel Logout. When a user signs out of Entra, or is disabled
or deleted there, Entra sends a signed logout token and OpenCTEM revokes the matching sessions at
once.

In the app registration, **Authentication > Front-channel logout URL**, set:

```
https://<api-host>/api/v1/auth/backchannel-logout
```

With the bundled gateway, `<api-host>` is the same host as the console. The token is verified against
the directory's signing keys, audience and issuer; no secret is configured. With the `sid` optional
claim a logout ends one session; without it, all of that user's sessions from the directory end.

## Step 5: Redirect URI allow-list

The API accepts only redirect URIs on an exact-match allow-list. Set it explicitly:

```bash
SSO_ALLOWED_REDIRECT_URIS=https://app.example.com/auth/sso/callback/entra_id
```

When unset, it is derived from `CORS_ALLOWED_ORIGINS`, `OAUTH_FRONTEND_CALLBACK_URL` and
`SMTP_BASE_URL`. `APP_ENCRYPTION_KEY` must be set: it protects the PKCE verifier carried in the
signed state.

## Social sign-in with Microsoft

Set on the API and restart:

```bash
OAUTH_ENABLED=true
OAUTH_MICROSOFT_ENABLED=true
OAUTH_MICROSOFT_CLIENT_ID=<application-client-id>
OAUTH_MICROSOFT_CLIENT_SECRET=<client-secret-value>
OAUTH_FRONTEND_CALLBACK_URL=https://app.example.com/auth/callback
OAUTH_STATE_SECRET=<openssl rand -hex 32>
```

Register `https://<console>/auth/callback/microsoft` as the redirect URI; its origin must match
`OAUTH_FRONTEND_CALLBACK_URL`. The `xms_edov` claim is required here too. Social sign-in creates an
account only when self-registration is allowed (see
[Sign-up and invitations](sign-up-and-invitations.md)); it never adds anyone to an organization, and
it does not satisfy an organization's SSO enforcement or 2FA requirement.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `404 SSO provider not configured` | Wrong or missing `?org=` slug, no active `entra_id` provider for the organization, or a pending change not yet approved by the owner. For the env fallback: the slug is not in `SSO_ENTRA_ALLOWED_TENANTS`. |
| `AADSTS50011` | The redirect URI in Azure does not exactly match `https://<console>/auth/sso/callback/entra_id`. |
| `invalid redirect URI` | The callback is not in `SSO_ALLOWED_REDIRECT_URIS`. |
| Sign-in refused after Microsoft authentication | `xms_edov` claim missing or false; the token's directory does not match the configured tenant identifier; `openid` missing from the scopes. |
| "not a member of this organization" | Just-in-time provisioning was not allowed: verify the domain, turn on auto-provision, or invite the user. |
| "email is registered with a different login method" | The account belongs to another sign-in method or another Entra user. This is the account-takeover guard. |
| Protected actions say "sign in again" and then fail | Add the `auth_time` optional claim, or have the user enrol an authenticator. |

The engineering reference is
[sso-authentication.md](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/sso-authentication.md).
