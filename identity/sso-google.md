---
title: Google
parent: Identity and access
nav_order: 5
---

# Single sign-on with Google

OpenCTEM supports Google in two independent ways:

| | Organization SSO with Google Workspace | Social "Sign in with Google" |
|---|---|---|
| Purpose | Members of one organization sign in with their Workspace accounts | A generic button on the login page for the whole installation |
| Configured by | Platform administrator in the admin console, approved by the organization owner | Operator, with `OAUTH_GOOGLE_*` environment variables |
| Accounts accepted | Only accounts of a Google Workspace (or Cloud Identity) organization | Any Google account with a verified email |
| Joins people to an organization | Yes, just-in-time for DNS-verified domains, if enabled | No |
| Redirect URI | `https://<console>/auth/sso/callback/google_workspace` | `https://<console>/auth/callback/google` |

`<console>` is the public origin of the web console (`NEXT_PUBLIC_APP_URL`; with the bundled gateway,
`OPENCTEM_PUBLIC_URL`).

## Step 1: Create the OAuth client in Google Cloud

1. In the Google Cloud console, open (or create) a project.
2. **APIs & Services > OAuth consent screen:** for organization SSO choose **Internal** (only users
   of your Workspace). Add the scopes `openid`, `email` and `profile`.
3. **APIs & Services > Credentials > Create credentials > OAuth client ID**, application type
   **Web application**.
4. **Authorized redirect URIs:** add the URI from the table above, exactly.
5. Copy the **Client ID** and **Client secret**.

## Step 2: Configure organization SSO

A **platform administrator** (super admin) configures it in the admin console:

1. **Admin console > Organizations >** the organization **> Single sign-on**.
2. **Verified domains:** add the Workspace domain and publish the TXT record shown
   (`_openctem-verify.<domain>`, value `openctem-domain-verification=<token>`), then **Verify**.
3. **Identity providers:** add a provider:

   | Field | Value |
   |---|---|
   | Provider | `google_workspace` |
   | Display name | Button label |
   | Client ID, Client secret | From step 1. The secret is stored encrypted. |
   | Scopes | `openid`, `email`, `profile`. Set them explicitly: the built-in default list also contains a Microsoft-only scope. |
   | Allowed domains | Optional. If set, only these Workspace domains may sign in. |
   | Auto-provision, Default role | As for [Entra ID](sso-entra-id.md#step-2-configure-organization-sso): default role `viewer` or `member` |

4. An organization owner approves the change under **Settings > SSO approvals** (unless the
   organization has no owner yet).

Users sign in at `https://<console>/login?org=<organization-slug>`.

### The hosted-domain check

Every Google Workspace sign-in must carry the `hd` (hosted domain) claim in the verified ID token,
which Google sends only for Workspace and Cloud Identity accounts. The sign-in is refused, and no
account, membership or session is created, when:

- `hd` is missing (a consumer Google account, even one registered with a company email address);
- the provider has allowed domains and `hd` is not one of them;
- the provider has no allowed domains and `hd` is not DNS-verified for the organization.

Existing members are held to the same rule as new ones. Just-in-time provisioning, account binding and
SSO enforcement work as described for [Entra ID](sso-entra-id.md#who-is-admitted).

## Social sign-in with Google

Set on the API and restart:

```bash
OAUTH_ENABLED=true
OAUTH_GOOGLE_ENABLED=true
OAUTH_GOOGLE_CLIENT_ID=<client-id>
OAUTH_GOOGLE_CLIENT_SECRET=<client-secret>
OAUTH_FRONTEND_CALLBACK_URL=https://app.example.com/auth/callback
OAUTH_STATE_SECRET=<openssl rand -hex 32>
```

Register `https://<console>/auth/callback/google` as an authorized redirect URI; its origin must
match `OAUTH_FRONTEND_CALLBACK_URL`. Only Google accounts with a verified email are accepted.

Social sign-in creates an account only when self-registration is allowed (see
[Sign-up and invitations](sign-up-and-invitations.md)) or the person was invited. It never adds anyone
to an organization, and it does not satisfy an organization's SSO enforcement or 2FA requirement.

GitHub works the same way with `OAUTH_GITHUB_ENABLED`, `OAUTH_GITHUB_CLIENT_ID` and
`OAUTH_GITHUB_CLIENT_SECRET`, and the callback `https://<console>/auth/callback/github`. GitHub
accounts must have a verified primary email.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `redirect_uri_mismatch` from Google | The authorized redirect URI does not exactly match the one in the table. |
| `invalid_scope` from Google | The provider uses the default scope list. Set scopes to `openid`, `email`, `profile`. |
| Sign-in refused with "domain not allowed" | The account is not a Workspace account (`hd` missing), or its domain is neither verified for the organization nor in the allowed domains. |
| "not a member of this organization" | Just-in-time provisioning was not allowed; verify the domain, turn on auto-provision, or invite the user. |
