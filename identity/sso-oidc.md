---
title: Generic OIDC
parent: Identity and access
nav_order: 7
---

# OpenID Connect: Okta and other providers

OpenCTEM uses OpenID Connect (OIDC) in three places. Which one you need depends on who signs in.

| Who signs in | Supported providers | Configured by | Section |
|---|---|---|---|
| Members of one organization (organization SSO) | Microsoft Entra ID, Google Workspace, **Okta** | Platform administrator, approved by the organization owner | [Okta](#organization-sso-with-okta) |
| Platform administrators (admin console) | **Any** OIDC provider with discovery (for example Okta, Keycloak, Entra ID) | Super admin in the admin console | [Platform administrator sign-in](#platform-administrator-sign-in) |
| API clients with tokens from your own realm | Keycloak | Operator, environment variables | [External provider mode](#external-provider-mode-keycloak) |

Organization SSO does not accept an arbitrary OIDC issuer: each provider type has fixed endpoints and
issuer rules. For any other identity provider, use [SAML 2.0](sso-saml.md), which most providers
support (including Keycloak, Okta, Entra ID, ADFS).

Every sign-in token is verified the same way: an id_token is required, its signature is checked
against the provider's published keys (RS256, PS256 or ES256 only; never RS384/RS512, `none` or
HMAC), then the issuer, the audience (and `azp` when there are several audiences), the expiry and a
nonce bound to the sign-in. A provider set to sign id_tokens with another algorithm must be switched
to RS256. Key fetches go through an outbound guard that refuses private and loopback addresses.

## Organization SSO with Okta

### Step 1: Create the app in Okta

1. **Applications > Create App Integration > OIDC - OpenID Connect > Web Application.**
2. **Grant type:** Authorization Code.
3. **Sign-in redirect URI:** `https://<app>/auth/sso/callback/okta`, where `<app>` is the public
   origin of OpenCTEM, the address people open in the browser (`APP_URL`; not the platform admin
   console's own site).
4. **Assignments:** assign the users or groups who may sign in.
5. Copy the **Client ID**, the **Client secret** and your Okta org URL (for example
   `https://example.okta.com`).

OpenCTEM uses Okta's **default authorization server** (`<org-url>/oauth2/default`). The ID token's
issuer must be exactly that; a custom authorization server is not supported.

### Step 2: Configure it in OpenCTEM

A platform administrator (super admin) opens **Admin console > Organizations >** the organization
**> Single sign-on** (tab; every change needs a fresh authenticator code):

1. **Verified domains:** add the organization's email domain and publish the TXT record shown
   (`_openctem-verify.<domain>`, value `openctem-domain-verification=<token>`), then **Verify now**.
2. **Identity providers:** open **Okta** and fill in:

   | Field | Value |
   |---|---|
   | Display name | Button label |
   | Okta Org URL | Your Okta org URL, `https://...` (required: it locates the signing keys) |
   | Client ID, Client secret | From Okta. The secret is stored encrypted with `APP_ENCRYPTION_KEY`. |
   | Allowed email domains | Optional narrowing of the verified domains |
   | Auto-provision users, Default role | Just-in-time provisioning; default role `viewer` or `member` |

   The console form has no scopes field. The built-in default list is `openid email profile User.Read`;
   send `scopes` (`openid`, `email`, `profile`) with the admin API
   (`POST /api/v1/admin/tenants/{tenantId}/sso/identity-providers`) if your provider rejects the
   Microsoft-only `User.Read`.

3. An organization owner approves the change under **Settings > SSO approvals** (unless the
   organization has no owner yet).

Users sign in at `https://<app>/login?org=<organization-slug>`. The email comes from Okta's
userinfo endpoint and must be verified there (`email_verified`). Admission, account binding, SSO
enforcement and the redirect URI allow-list (`SSO_ALLOWED_REDIRECT_URIS`) work as described for
[Entra ID](sso-entra-id.md#who-is-admitted).

### Back-channel logout

If your Okta plan supports OIDC back-channel logout, point it at
`https://<api-host>/api/v1/auth/backchannel-logout`. Sessions are revoked when the signed logout
token's issuer and audience match a configured provider.

## Platform administrator sign-in

Platform administrators can sign in to the admin console through one platform-wide OIDC provider
instead of a password. Any provider that publishes OpenID discovery
(`/.well-known/openid-configuration`) works.

1. In your provider, create a confidential web client with the redirect URI
   `https://<console-origin>/login/callback`, where `<console-origin>` is the admin console's own
   site (its own host name, or the gateway's console port, `OPENCTEM_ADMIN_PORT`, 8443 by default;
   the shipped default is `https://<OPENCTEM_HOSTNAME>:8443`).
2. In the platform console, **Security › Admin sign-in** (super admins only), turn the provider on and
   enter the **Button label**, **Issuer URL** (https, as published in the discovery document),
   **Client ID**, **Client secret**, **Redirect URI** and **Scopes**.
3. Each administrator is matched by email at the first provider sign-in and bound to the provider's
   subject after that.

By default the console still asks for its own second step (authenticator code, recovery code or
security key) after the provider sign-in. If your provider enforces phishing-resistant MFA and
reports it in the token, list its **Trusted acr values** or **Trusted amr values** to skip the
console code for those tokens. **Require the identity provider** refuses password sign-in for every
administrator except break-glass accounts, which stay local (add an active break-glass super admin
first). Organization identity providers are never trusted for the admin console.

## External provider mode (Keycloak)

`AUTH_PROVIDER` selects how the API authenticates bearer tokens:

| Value | Meaning |
|---|---|
| `local` | Built-in accounts and sessions (email and password, organization SSO, social sign-in). This is what the web console uses; the shipped compose files set it. |
| `oidc` | The API accepts only access tokens issued by one Keycloak realm. |
| `hybrid` | Both. |

The default is `local` (up to v0.8.0 it was `oidc`). The web console signs
in through the built-in accounts only, so the external mode is for API clients that obtain tokens from
your realm.

| Variable | Meaning |
|---|---|
| `KEYCLOAK_BASE_URL` | Base URL of Keycloak, https in production |
| `KEYCLOAK_REALM` | Realm name; the issuer must be `<base>/realms/<realm>` |
| `KEYCLOAK_CLIENT_ID` | Must be in the token's `aud`, or equal to `azp` |
| `KEYCLOAK_JWKS_REFRESH_INTERVAL` | How often signing keys are refreshed |
| `KEYCLOAK_HTTP_TIMEOUT` | Timeout for calls to Keycloak |

The organization and role are read from the verified token claims `tenant_id`, `tenant_role` and
`tenant_roles`, which you add with protocol mappers in the realm. Step-up re-authentication uses the
token's `auth_time` claim.
