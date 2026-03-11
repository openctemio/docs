---
layout: default
title: SSO Identity Providers
parent: Features
nav_order: 20
---

# SSO Identity Providers

## Overview

Single Sign-On (SSO) allows organizations to authenticate users through their existing identity providers instead of managing separate credentials in OpenCTEM. This enables centralized access control, enforces corporate security policies, and simplifies user onboarding for enterprise teams.

Each tenant configures its own identity providers independently. Users authenticate through their organization's identity provider and are automatically mapped to the correct tenant based on the organization slug.

## Supported Providers

| Provider | Type Key | Description |
|----------|----------|-------------|
| **Microsoft Entra ID** | `entra_id` | Azure Active Directory / Microsoft 365 |
| **Okta** | `okta` | Okta Identity Platform |
| **Google Workspace** | `google_workspace` | Google Cloud Identity |

All three providers use the standard OAuth 2.0 Authorization Code flow. OpenCTEM handles the provider-specific endpoint URLs, token exchange, and user info parsing automatically.

## Architecture

### Per-Tenant Configuration

SSO is configured at the tenant level. Each tenant can have one identity provider per provider type (e.g., one Entra ID configuration and one Okta configuration).

```
Tenant A ─── Entra ID config
         └── Okta config

Tenant B ─── Google Workspace config
```

### Tenant Isolation

All identity provider queries are scoped by `tenant_id`. A tenant can only view, modify, or delete its own configurations. The public login endpoints resolve the tenant from the `org` query parameter (the organization slug).

### Credential Encryption

Client secrets are encrypted at rest using AES-256-GCM before being stored in the database. The encryption key is configured via the `APP_ENCRYPTION_KEY` environment variable. Secrets are never returned in API responses.

## Admin Configuration

Administrators manage SSO identity providers through **Settings > Identity Providers** or via the admin API.

### Adding an Identity Provider

To configure a new SSO provider, supply the following fields:

**Required Fields:**

| Field | Description |
|-------|-------------|
| `provider` | Provider type: `entra_id`, `okta`, or `google_workspace` |
| `display_name` | Friendly name shown on the login page (e.g., "Sign in with Contoso") |
| `client_id` | OAuth client/application ID from your identity provider |
| `client_secret` | OAuth client secret (encrypted at rest, never returned in API responses) |

**Provider-Specific Fields:**

| Field | Required For | Description |
|-------|-------------|-------------|
| `tenant_identifier` | Entra ID, Okta | For Entra ID: the directory/tenant ID (GUID or domain). For Okta: the org URL (e.g., `https://dev-123456.okta.com`) |
| `issuer_url` | Optional | Custom issuer URL if your provider uses a non-standard endpoint |

**Optional Fields:**

| Field | Default | Description |
|-------|---------|-------------|
| `allowed_domains` | (empty = all) | List of allowed email domains. If set, only users with matching email domains can authenticate. |
| `auto_provision` | `false` | When enabled, users who authenticate via SSO are automatically added as tenant members |
| `default_role` | `member` | Role assigned to auto-provisioned users. Valid values: `admin`, `member`, `viewer`. Owner cannot be set via SSO. |
| `scopes` | (provider defaults) | OAuth scopes to request. Most deployments can leave this empty to use provider defaults. |

### Provider Setup Guides

#### Microsoft Entra ID

1. In the Azure Portal, go to **Entra ID > App registrations > New registration**
2. Set the redirect URI to `https://your-domain.com/auth/sso/callback/entra_id`
3. Under **Certificates & secrets**, create a new client secret
4. Note the **Application (client) ID** and **Directory (tenant) ID**
5. Under **API permissions**, ensure `openid`, `profile`, and `email` are granted
6. In OpenCTEM, create the provider with `tenant_identifier` set to your Directory (tenant) ID

#### Okta

1. In the Okta Admin Console, go to **Applications > Create App Integration**
2. Select **OIDC - OpenID Connect** and **Web Application**
3. Set the redirect URI to `https://your-domain.com/auth/sso/callback/okta`
4. Note the **Client ID** and **Client Secret**
5. In OpenCTEM, create the provider with `tenant_identifier` set to your Okta org URL (e.g., `https://dev-123456.okta.com`). Only `.okta.com` and `.oktapreview.com` domains are accepted.

#### Google Workspace

1. In the Google Cloud Console, go to **APIs & Services > Credentials**
2. Create an **OAuth 2.0 Client ID** of type Web application
3. Set the authorized redirect URI to `https://your-domain.com/auth/sso/callback/google_workspace`
4. Note the **Client ID** and **Client secret**
5. In OpenCTEM, create the provider. Optionally set `allowed_domains` to restrict to your organization's domain.

### Activating and Deactivating

Providers are created in an inactive state. To activate a provider, update the `is_active` field to `true` via the API or toggle it in the Settings UI. Only active providers appear on the login page.

Deactivating a provider immediately prevents new SSO logins through that provider. Existing sessions are not affected.

### Deleting a Provider

Deleting a provider permanently removes its configuration, including the encrypted client secret. This cannot be undone. Existing sessions for users who authenticated through the deleted provider remain valid until they expire.

## User Login Flow

### Step 1: Navigate to Login with Organization

Users access the login page with their organization slug:

```
https://your-domain.com/login?org=acme-corp
```

The `org` parameter identifies the tenant. When present, the login page queries for active SSO providers and displays SSO buttons alongside the standard login form.

### Step 2: Click SSO Button

Each active provider is shown as a button with its `display_name` (e.g., "Sign in with Contoso"). Clicking the button initiates the OAuth flow:

1. The frontend calls `GET /api/v1/auth/sso/{provider}/authorize?org={slug}&redirect_uri={callback_url}`
2. The API returns an `authorization_url` with a signed `state` token
3. The browser redirects to the identity provider's login page

### Step 3: Authenticate with Identity Provider

The user authenticates with their corporate credentials at the identity provider. Upon success, the provider redirects back to OpenCTEM's callback URL with an authorization `code` and the `state` token.

### Step 4: Callback Processing

The callback page at `/auth/sso/callback/{provider}` processes the response:

1. Validates the provider type
2. Checks for OAuth errors from the provider
3. Sends the `code` and `state` to `POST /api/v1/auth/sso/{provider}/callback`
4. The API validates the HMAC-signed state, exchanges the code for tokens, fetches user info, and creates a session
5. On success, the user is redirected to the dashboard

### Auto-Provisioning

When `auto_provision` is enabled on a provider:

- If the SSO user does not yet have an account in OpenCTEM, one is created automatically using their email and name from the identity provider
- If the user is not yet a member of the tenant, they are added with the configured `default_role`
- If the user already exists and is already a member, they simply log in

When `auto_provision` is disabled, users must be invited to the tenant before they can log in via SSO. The SSO login will still create a user account if one does not exist, but tenant membership must be granted separately.

## API Reference

### Public Endpoints (No Authentication Required)

These endpoints are used by the login page to initiate and complete SSO authentication.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/auth/sso/providers?org={slug}` | List active SSO providers for an organization |
| `GET` | `/api/v1/auth/sso/{provider}/authorize?org={slug}&redirect_uri={uri}` | Get the OAuth authorization URL |
| `POST` | `/api/v1/auth/sso/{provider}/callback` | Exchange authorization code for session tokens |

**List Providers Response:**

```json
{
  "providers": [
    {
      "id": "ip-uuid",
      "provider": "entra_id",
      "display_name": "Sign in with Contoso"
    }
  ]
}
```

**Authorize Response:**

```json
{
  "authorization_url": "https://login.microsoftonline.com/...",
  "state": "eyJ..."
}
```

**Callback Request Body:**

```json
{
  "code": "authorization-code-from-provider",
  "state": "state-token-from-authorize",
  "redirect_uri": "https://your-domain.com/auth/sso/callback/entra_id"
}
```

**Callback Response:**

```json
{
  "access_token": "jwt-access-token",
  "refresh_token": "jwt-refresh-token",
  "token_type": "Bearer",
  "expires_in": 3600,
  "tenant_id": "tenant-uuid",
  "tenant_slug": "acme-corp",
  "user": {
    "id": "user-uuid",
    "email": "jane@contoso.com",
    "name": "Jane Smith"
  }
}
```

### Admin Endpoints (Authenticated, Tenant-Scoped)

These endpoints require authentication and are scoped to the current tenant.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/settings/identity-providers` | Create a new identity provider |
| `GET` | `/api/v1/settings/identity-providers` | List all identity providers for the tenant |
| `GET` | `/api/v1/settings/identity-providers/{id}` | Get a single identity provider |
| `PUT` | `/api/v1/settings/identity-providers/{id}` | Update an identity provider |
| `DELETE` | `/api/v1/settings/identity-providers/{id}` | Delete an identity provider |

**Create/Update Request Body:**

```json
{
  "provider": "entra_id",
  "display_name": "Sign in with Contoso",
  "client_id": "app-client-id",
  "client_secret": "app-client-secret",
  "tenant_identifier": "directory-tenant-id",
  "allowed_domains": ["contoso.com"],
  "auto_provision": true,
  "default_role": "member",
  "scopes": ["openid", "profile", "email"]
}
```

For update requests, all fields are optional. Only the fields included in the request body are modified.

**Provider Detail Response:**

```json
{
  "id": "ip-uuid",
  "tenant_id": "tenant-uuid",
  "provider": "entra_id",
  "display_name": "Sign in with Contoso",
  "client_id": "app-client-id",
  "issuer_url": "",
  "tenant_identifier": "directory-tenant-id",
  "scopes": ["openid", "profile", "email"],
  "allowed_domains": ["contoso.com"],
  "auto_provision": true,
  "default_role": "member",
  "is_active": true,
  "created_at": "2026-03-01T10:00:00Z",
  "updated_at": "2026-03-01T10:00:00Z",
  "created_by": "user-uuid"
}
```

Note: `client_secret` is never included in responses.

## Security

### State Token Protection

The OAuth state parameter is a JSON payload containing the organization slug, provider type, a random nonce, and a 10-minute expiration timestamp. The payload is Base64-encoded and signed with HMAC-SHA256 using the application's JWT secret. On callback, the signature and expiration are validated before processing.

### Domain Restrictions

When `allowed_domains` is configured on a provider, the API checks the email domain returned by the identity provider against the allow list. Users with non-matching email domains receive a "domain not allowed" error and cannot authenticate.

### Redirect URI Validation

The `redirect_uri` parameter is validated to prevent open redirect attacks. It must use `http` or `https` scheme, include a host, and not exceed 2000 characters.

### Tenant Isolation

All identity provider operations enforce tenant isolation at the database query level. Admin endpoints extract the tenant ID from the authenticated user's JWT. Public endpoints resolve the tenant from the organization slug. There is no way to access another tenant's SSO configuration.

### SSRF Prevention

Okta tenant identifiers are validated to ensure they point to known Okta domains (`.okta.com` or `.oktapreview.com`). Entra ID tenant identifiers are limited to 128 characters. This prevents server-side request forgery through crafted tenant identifier values.

### Client Secret Handling

Client secrets are encrypted with AES-256-GCM immediately upon receipt and stored only in encrypted form. They are decrypted in memory only when needed for OAuth token exchange. Secrets are never logged or returned in API responses.

### Race Condition Handling

Concurrent SSO logins for the same new user are handled safely. If two requests attempt to create the same user simultaneously, the second request catches the unique constraint violation and retries the lookup, returning the user created by the first request.

## Troubleshooting

### "No SSO providers configured"

The tenant has no active identity providers. Verify that:
- An identity provider has been created for the tenant
- The provider's `is_active` field is set to `true`
- The `org` query parameter matches the tenant's slug

### "SSO provider is not active"

The specific provider exists but is deactivated. An admin must activate it by setting `is_active` to `true`.

### "Invalid or expired state token"

The state token has expired (tokens are valid for 10 minutes) or has been tampered with. This can happen if:
- The user took too long to complete authentication at the identity provider
- The browser session was interrupted
- The state token was modified in transit

Ask the user to try again from the login page.

### "Your email domain is not allowed for this organization"

The user's email domain does not match the `allowed_domains` list configured on the provider. Either add the user's domain to the allow list or remove the domain restriction.

### "Failed to complete SSO authentication"

The authorization code exchange with the identity provider failed. Common causes:
- The `client_secret` is incorrect or has been rotated at the provider
- The `redirect_uri` does not match what is registered at the identity provider
- The authorization code has expired (codes are typically valid for a few minutes)

### "Failed to retrieve user information"

The user info endpoint at the identity provider returned an error. Verify that:
- The OAuth application has the correct API permissions/scopes (`openid`, `profile`, `email`)
- The user's account is active at the identity provider

### "Identity provider already configured for this tenant and provider type"

Each tenant can have only one configuration per provider type. To reconfigure, update the existing provider or delete it and create a new one.
