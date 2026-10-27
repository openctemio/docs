---
title: Sign-in configuration reference
parent: Identity and access
nav_order: 11
---

# Sign-in configuration reference
{: .no_toc }

Every setting that controls how people sign in, with the way to set it in Docker Compose, Helm and the
Ansible kit. The complete variable list of the API is in the
[environment variables reference](../configuration/environment-variables.md); this page covers the
sign-in subset. Guides: [Sign-in methods](sign-in-methods.md), [Social login](social-login.md),
[Google Workspace](sso-google.md), [Entra ID](sso-entra-id.md).

1. TOC
{:toc}

## Social login (platform-wide)

All are API variables.

| Variable | Default | Meaning |
|---|---|---|
| `OAUTH_ENABLED` | `true` | Master switch for social login. A provider is offered only when its own `*_ENABLED`, client ID and client secret are all set. |
| `OAUTH_FRONTEND_CALLBACK_URL` | `APP_URL/auth/callback`, else `http://localhost:3000/auth/callback` | Where the web app is. The redirect URI of a social sign-in must have the same scheme and host (with port) as this URL. Set it only when the web app is not at `APP_URL`. |
| `OAUTH_STATE_SECRET` | derived from the session secret | Secret that signs the `state` parameter. Optional: unset, a separate key is derived from `AUTH_JWT_SECRET` (or `APP_ENCRYPTION_KEY`). Set it only to share one value across replicas of an older setup. |
| `OAUTH_STATE_DURATION` | `10m` | Lifetime of a `state` (and the sign-in attempt). |
| `OAUTH_GOOGLE_ENABLED` | `false` | Offer Google. |
| `OAUTH_GOOGLE_CLIENT_ID` | empty | Google OAuth client ID. |
| `OAUTH_GOOGLE_CLIENT_SECRET` | empty | Google OAuth client secret (secret). |
| `OAUTH_GOOGLE_SCOPES` | `openid,email,profile` | Requested scopes; keep `openid`. |
| `OAUTH_GITHUB_ENABLED` | `false` | Offer GitHub. |
| `OAUTH_GITHUB_CLIENT_ID` | empty | GitHub OAuth App client ID. |
| `OAUTH_GITHUB_CLIENT_SECRET` | empty | GitHub OAuth App client secret (secret). |
| `OAUTH_GITHUB_SCOPES` | `read:user,user:email` | Requested scopes. |
| `OAUTH_MICROSOFT_ENABLED` | `false` | Offer Microsoft. |
| `OAUTH_MICROSOFT_CLIENT_ID` | empty | Application (client) ID. |
| `OAUTH_MICROSOFT_CLIENT_SECRET` | empty | Client secret value (secret). |
| `OAUTH_MICROSOFT_SCOPES` | `openid,email,profile,User.Read` | Requested scopes; keep `openid`. |

The redirect URIs to register are `https://<app>/auth/callback/google`, `/github` and `/microsoft`.
From the release that adds **Settings > Sign-in > Social login** in the platform console, the same
values can be entered there (secrets write-only, applied live); a variable set in the environment
overrides the console and locks the field.

## Organization SSO (per organization)

Provider settings (issuer, client ID and secret, allowed domains, auto-provision, default role) and
SSO enforcement are stored per organization and edited in the platform console; they are not
environment variables. These variables support them:

| Variable | Default | Meaning |
|---|---|---|
| `APP_URL` | empty | The public origin. SAML service-provider URLs and the default of the three variables below are built from it. Set it in every deployment. |
| `SSO_ALLOWED_REDIRECT_URIS` | derived | Exact-match allow-list of the redirect URIs of the SSO flow: origins, or origin plus a path prefix ending in `/`. Unset: derived from `CORS_ALLOWED_ORIGINS`, `OAUTH_FRONTEND_CALLBACK_URL` and `SMTP_BASE_URL`. |
| `CORS_ALLOWED_ORIGINS` | `APP_URL` origin | Browser origins allowed to call the API. |
| `SMTP_BASE_URL` | `APP_URL` | Base of the links in e-mails. |
| `APP_ENCRYPTION_KEY` | none (required in production) | Encrypts stored identity-provider secrets and protects the PKCE verifier in the signed state. |
| `SSO_ENTRA_ENABLED`, `SSO_ENTRA_CLIENT_ID`, `SSO_ENTRA_CLIENT_SECRET`, `SSO_ENTRA_TENANT_ID`, `SSO_ENTRA_ALLOWED_DOMAINS`, `SSO_ENTRA_DEFAULT_ROLE`, `SSO_ENTRA_AUTO_PROVISION`, `SSO_ENTRA_DISPLAY_NAME`, `SSO_ENTRA_ALLOWED_TENANTS` | off | Optional shared Entra app for chosen organizations. See [Entra ID](sso-entra-id.md#step-3-optional-one-shared-entra-app-for-selected-organizations). |

## Accounts and sign-up

| Variable | Default | Meaning |
|---|---|---|
| `SIGNUP_MODE` | `disabled` | Sign-up ceiling: `disabled`, `domain` or `open`. Decides whether a social sign-in can create an account. See [Sign-up and invitations](sign-up-and-invitations.md#creating-organizations). |
| `AUTH_PROVIDER` | `local` | `local` (built-in password), `oidc` (external Keycloak realm) or `hybrid`. |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | `true` | Require a verified e-mail address (production refuses `false` with `local` or `hybrid`). Social and SSO sign-ins are verified by the provider. |
| `ADMIN_PUBLIC_URL` | origin of `APP_URL` | Origin of the platform console, used for its security keys. The platform administrators' identity provider is set in the console, not here. |

## Setting the variables

### Docker Compose

The stack does not pass the `OAUTH_*` variables by default. Put them in a
`docker-compose.override.yml` next to `docker-compose.yml`, which Compose reads automatically, and keep
the secret in `.env` (mode 600):

```yaml
services:
  api:
    environment:
      OAUTH_GOOGLE_ENABLED: "true"
      OAUTH_GOOGLE_CLIENT_ID: "<client-id>.apps.googleusercontent.com"
      OAUTH_GOOGLE_CLIENT_SECRET: ${OAUTH_GOOGLE_CLIENT_SECRET}
```

```bash
# .env
OAUTH_GOOGLE_CLIENT_SECRET=<client-secret>
```

Apply with `docker compose up -d api`. `APP_URL` comes from `OPENCTEM_PUBLIC_URL` (else
`https://<OPENCTEM_HOSTNAME>`); the stack derives `OAUTH_FRONTEND_CALLBACK_URL` and
`NEXT_PUBLIC_APP_URL` from it, so you do not set them unless the web app is on another origin.

### Helm

Set non-secret values in `api.extraEnv` and the secrets from a Kubernetes Secret with
`api.extraEnvFrom`:

```yaml
api:
  extraEnv:
    - name: OAUTH_GOOGLE_ENABLED
      value: "true"
    - name: OAUTH_GOOGLE_CLIENT_ID
      value: "<client-id>.apps.googleusercontent.com"
  extraEnvFrom:
    - secretRef:
        name: openctem-oauth   # holds OAUTH_GOOGLE_CLIENT_SECRET
```

```bash
kubectl -n openctem create secret generic openctem-oauth \
  --from-literal=OAUTH_GOOGLE_CLIENT_SECRET='<client-secret>'
helm upgrade openctem openctem/openctem -n openctem -f values.yaml
```

The chart sets `APP_URL` and the web app's `NEXT_PUBLIC_APP_URL` from the gateway's public URL
(`gateway.publicUrl`), so the redirect URIs follow your public host name.

### Ansible kit

`openctem_api_env` passes non-secret settings to the API. The kit **refuses names that contain
`PASSWORD`, `SECRET`, `TOKEN` or end in `KEY`**, and generates the secrets on the host, so
`OAUTH_*_CLIENT_SECRET` cannot be set through the inventory. What you can set there:

```yaml
openctem_api_env:
  OAUTH_GOOGLE_ENABLED: "true"
  OAUTH_GOOGLE_CLIENT_ID: "<client-id>.apps.googleusercontent.com"
```

`OAUTH_STATE_SECRET` is not needed (it is derived). For the client secret, use the platform console's
**Settings > Sign-in > Social login** from the release that adds it. `APP_URL` is set by the kit from the
host name and is not passed through `openctem_api_env`. Organization SSO needs no variable in the kit;
it is configured in the console.

### Binary installs and the all-in-one image

Write the variables into the API's environment file (`openctem.env` for the all-in-one image, `server.env`
for binaries) and restart the service. The all-in-one image sets
`NEXT_PUBLIC_APP_URL` from `APP_URL`.
