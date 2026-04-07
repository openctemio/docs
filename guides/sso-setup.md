---
layout: default
title: SSO / Identity Provider Setup
parent: Platform Guides
nav_order: 22
---

# SSO / Identity Provider Setup Guide

Step-by-step instructions for configuring Single Sign-On (SSO) with Microsoft Entra ID, Okta, or Google Workspace in OpenCTEM.

---

## 1. Overview

OpenCTEM supports per-tenant SSO via the OAuth 2.0 Authorization Code flow. Each tenant configures its own identity providers independently through **Settings > Identity Providers** or the admin API. Users authenticate through their organization's identity provider and are mapped to the correct tenant based on the organization slug in the login URL.

Key characteristics:

- **Per-tenant isolation** -- each tenant manages its own SSO configuration; tenants cannot see or modify each other's providers.
- **One provider per type per tenant** -- a tenant can have at most one Entra ID configuration, one Okta configuration, and one Google Workspace configuration simultaneously.
- **Client secrets encrypted at rest** using AES-256-GCM via the `APP_ENCRYPTION_KEY` environment variable. Secrets are never returned in API responses.
- **Auto-provisioning** (optional) -- new users who authenticate via SSO can be automatically added to the tenant with a configurable default role.

## 2. Supported Providers

| Provider | Type Key | OAuth Endpoints |
|----------|----------|-----------------|
| Microsoft Entra ID (Azure AD) | `entra_id` | `login.microsoftonline.com` |
| Okta | `okta` | `{your-org}.okta.com` |
| Google Workspace | `google_workspace` | `accounts.google.com` |

## 3. Prerequisites

Before configuring SSO you need:

1. **OpenCTEM admin access** -- you must have the `admin` or `owner` role on the tenant where you are configuring SSO.
2. **Identity provider admin account** -- you need administrative access to your organization's Entra ID, Okta, or Google Workspace console to register an OAuth application.
3. **`APP_ENCRYPTION_KEY` set on the API** -- this 32-byte hex key is required to encrypt client secrets. Generate one with:

   ```bash
   openssl rand -hex 32
   ```

   Set it in your API environment (`.env`, Kubernetes secret, etc.):

   ```
   APP_ENCRYPTION_KEY=<your-64-character-hex-string>
   ```

4. **Your OpenCTEM base URL** -- you need to know the public URL of your deployment (e.g., `https://your-domain.com`) to configure redirect URIs.

---

## 4. Microsoft Entra ID Setup

### 4.1 Register an Application in Azure Portal

1. Sign in to the [Azure Portal](https://portal.azure.com).
2. Navigate to **Microsoft Entra ID** (formerly Azure Active Directory).
3. In the left sidebar, select **App registrations**, then click **New registration**.
4. Fill in the registration form:
   - **Name**: `OpenCTEM SSO` (or any descriptive name)
   - **Supported account types**: Select the option appropriate for your organization. For most cases, choose "Accounts in this organizational directory only (Single tenant)".
   - **Redirect URI**: Select **Web** and enter:
     ```
     https://your-domain.com/auth/sso/callback/entra_id
     ```
     Replace `your-domain.com` with your actual OpenCTEM domain.
5. Click **Register**.

### 4.2 Note Your Application IDs

After registration, the **Overview** page displays two values you will need:

- **Application (client) ID** -- a UUID like `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- **Directory (tenant) ID** -- a UUID like `f0e1d2c3-b4a5-6789-0abc-def123456789`

Record both values.

### 4.3 Create a Client Secret

1. In the app registration, go to **Certificates & secrets** in the left sidebar.
2. Under **Client secrets**, click **New client secret**.
3. Add a description (e.g., `OpenCTEM SSO`) and select an expiration period.
4. Click **Add**.
5. **Copy the secret value immediately** -- it is only shown once. This is your `client_secret`.

### 4.4 Set API Permissions

1. Go to **API permissions** in the left sidebar.
2. Click **Add a permission** > **Microsoft Graph** > **Delegated permissions**.
3. Search for and add the following permissions:
   - `openid`
   - `profile`
   - `email`
4. If the permissions require admin consent, click **Grant admin consent for [your organization]**.

### 4.5 Configure in OpenCTEM

Using the admin API or the Settings UI, create the identity provider:

```bash
curl -X POST https://your-domain.com/api/v1/settings/identity-providers \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "entra_id",
    "display_name": "Sign in with Microsoft",
    "client_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "client_secret": "your-client-secret-value",
    "tenant_identifier": "f0e1d2c3-b4a5-6789-0abc-def123456789",
    "allowed_domains": ["yourcompany.com"],
    "auto_provision": true,
    "default_role": "member"
  }'
```

The `tenant_identifier` field is the **Directory (tenant) ID** from step 4.2. It can also be a verified domain name.

---

## 5. Okta Setup

### 5.1 Create an OIDC Application

1. Sign in to the [Okta Admin Console](https://admin.okta.com).
2. Navigate to **Applications** > **Applications** > **Create App Integration**.
3. Select:
   - **Sign-in method**: OIDC - OpenID Connect
   - **Application type**: Web Application
4. Click **Next**.

### 5.2 Configure the Application

1. **App integration name**: `OpenCTEM SSO`
2. **Grant type**: Ensure **Authorization Code** is checked.
3. **Sign-in redirect URIs**: Add:
   ```
   https://your-domain.com/auth/sso/callback/okta
   ```
4. **Sign-out redirect URIs**: (optional) Add your OpenCTEM login page URL.
5. **Controlled access**: Choose the assignment option for your organization (e.g., "Allow everyone in your organization to access" or limit to specific groups).
6. Click **Save**.

### 5.3 Note Your Credentials

After saving, the **General** tab shows:

- **Client ID** -- copy this value
- **Client Secret** -- copy this value (click the eye icon to reveal)

Also note your **Okta org URL**, visible in the browser address bar. It looks like:

```
https://dev-123456.okta.com
```

### 5.4 Assign Users or Groups

1. Go to the **Assignments** tab of the application.
2. Click **Assign** and select either **Assign to People** or **Assign to Groups**.
3. Add the users or groups that should have SSO access to OpenCTEM.

### 5.5 Configure in OpenCTEM

```bash
curl -X POST https://your-domain.com/api/v1/settings/identity-providers \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "okta",
    "display_name": "Sign in with Okta",
    "client_id": "0oa1bcdefghijklmn2o3",
    "client_secret": "your-okta-client-secret",
    "tenant_identifier": "https://dev-123456.okta.com",
    "allowed_domains": ["yourcompany.com"],
    "auto_provision": true,
    "default_role": "member"
  }'
```

The `tenant_identifier` must be your full Okta org URL. Only `.okta.com` and `.oktapreview.com` domains are accepted (SSRF prevention).

---

## 6. Google Workspace Setup

### 6.1 Create OAuth 2.0 Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com).
2. Select or create a project for your organization.
3. Navigate to **APIs & Services** > **Credentials**.
4. Click **Create Credentials** > **OAuth client ID**.

### 6.2 Configure the Consent Screen

If prompted, configure the OAuth consent screen first:

1. Go to **APIs & Services** > **OAuth consent screen**.
2. Select **Internal** (recommended for Google Workspace organizations -- limits access to your domain).
3. Fill in the required fields:
   - **App name**: `OpenCTEM`
   - **User support email**: your admin email
   - **Developer contact information**: your admin email
4. On the **Scopes** page, add:
   - `openid`
   - `email`
   - `profile`
5. Click **Save and Continue** through the remaining steps.

### 6.3 Create the OAuth Client ID

1. Return to **Credentials** > **Create Credentials** > **OAuth client ID**.
2. Select **Web application** as the application type.
3. **Name**: `OpenCTEM SSO`
4. Under **Authorized redirect URIs**, add:
   ```
   https://your-domain.com/auth/sso/callback/google_workspace
   ```
5. Click **Create**.
6. Copy the **Client ID** and **Client secret** from the confirmation dialog.

### 6.4 Configure in OpenCTEM

```bash
curl -X POST https://your-domain.com/api/v1/settings/identity-providers \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "google_workspace",
    "display_name": "Sign in with Google",
    "client_id": "123456789-abcdefg.apps.googleusercontent.com",
    "client_secret": "GOCSPX-your-google-secret",
    "allowed_domains": ["yourcompany.com"],
    "auto_provision": true,
    "default_role": "member"
  }'
```

Google Workspace does not require a `tenant_identifier`. Use the `allowed_domains` field to restrict authentication to your organization's domain.

---

## 7. OpenCTEM Configuration

### 7.1 Required Environment Variables

The following environment variables must be set on the API service for SSO to function:

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_ENCRYPTION_KEY` | Yes | 32-byte hex key for encrypting client secrets. Generate with `openssl rand -hex 32`. |
| `AUTH_JWT_SECRET` | Yes | JWT signing secret (min 64 chars). Used to sign OAuth state tokens (HMAC-SHA256). |
| `CORS_ALLOWED_ORIGINS` | Yes | Must include your OpenCTEM frontend domain. |

Example `.env` excerpt:

```bash
APP_ENCRYPTION_KEY=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
AUTH_JWT_SECRET=your-64-character-minimum-jwt-secret-here-make-it-long-enough-please
CORS_ALLOWED_ORIGINS=https://your-domain.com
```

### 7.2 Admin API Endpoints

All admin endpoints require authentication and are scoped to the current tenant.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/settings/identity-providers` | Create a new identity provider |
| `GET` | `/api/v1/settings/identity-providers` | List all identity providers for the tenant |
| `GET` | `/api/v1/settings/identity-providers/{id}` | Get a single identity provider |
| `PUT` | `/api/v1/settings/identity-providers/{id}` | Update an identity provider |
| `DELETE` | `/api/v1/settings/identity-providers/{id}` | Delete an identity provider |

### 7.3 Public SSO Endpoints

These endpoints are unauthenticated and used by the login page:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/auth/sso/providers?org={slug}` | List active SSO providers for an organization |
| `GET` | `/api/v1/auth/sso/{provider}/authorize?org={slug}&redirect_uri={uri}` | Get the OAuth authorization URL |
| `POST` | `/api/v1/auth/sso/{provider}/callback` | Exchange authorization code for session tokens |

### 7.4 Admin UI Configuration

1. Log in to OpenCTEM as an admin or owner.
2. Navigate to **Settings** > **Identity Providers**.
3. Click **Add Provider**.
4. Select the provider type (Microsoft Entra ID, Okta, or Google Workspace).
5. Fill in the required fields (client ID, client secret, tenant identifier where applicable).
6. Optionally configure allowed domains, auto-provisioning, and default role.
7. Save the provider. It is created in an **inactive** state by default.
8. Toggle the provider to **Active** when ready.

### 7.5 Activating a Provider

Providers are created inactive. To activate via the API:

```bash
curl -X PUT https://your-domain.com/api/v1/settings/identity-providers/{id} \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"is_active": true}'
```

Only active providers appear as SSO buttons on the login page.

---

## 8. Testing the SSO Login Flow

After configuring and activating a provider, verify the flow end to end:

1. **Open the login page with your org slug**:

   ```
   https://your-domain.com/login?org=your-org-slug
   ```

   You should see SSO buttons alongside the standard email/password form. Each button shows the `display_name` you configured (e.g., "Sign in with Microsoft").

2. **Click the SSO button**. The browser should redirect to the identity provider's login page (Microsoft, Okta, or Google).

3. **Authenticate** with valid corporate credentials.

4. **After successful authentication**, the provider redirects back to OpenCTEM at:

   ```
   https://your-domain.com/auth/sso/callback/{provider}?code=...&state=...
   ```

5. **OpenCTEM processes the callback**:
   - Validates the HMAC-signed state token
   - Exchanges the authorization code for tokens
   - Fetches user info from the identity provider
   - Creates a session (and optionally auto-provisions the user)
   - Redirects to the dashboard

6. **Verify the user session** by checking the dashboard loads correctly and the user's name/email matches what the identity provider returned.

### Quick Verification via API

You can also verify the provider listing endpoint works:

```bash
curl https://your-domain.com/api/v1/auth/sso/providers?org=your-org-slug
```

Expected response:

```json
{
  "providers": [
    {
      "id": "provider-uuid",
      "provider": "entra_id",
      "display_name": "Sign in with Microsoft"
    }
  ]
}
```

If the response is an empty array, the provider is either not created, not active, or the org slug is wrong.

---

## 9. User Provisioning and Role Mapping

### Auto-Provisioning

When `auto_provision` is set to `true` on a provider:

- **New user, no account**: A user account is created using the email and name returned by the identity provider. The user is added as a member of the tenant with the `default_role`.
- **Existing user, not a tenant member**: The user is added to the tenant with the `default_role`.
- **Existing user, already a member**: The user simply logs in. Their role is not changed.

When `auto_provision` is `false`:

- Users must be invited to the tenant before they can log in via SSO.
- SSO login will still create a user account if one does not exist, but it will not grant tenant membership.
- Attempting to log in without membership results in an error.

### Default Roles

The `default_role` field accepts: `admin`, `member`, or `viewer`. The `owner` role cannot be assigned via SSO auto-provisioning.

### Domain Restrictions

The `allowed_domains` field is a list of email domains (e.g., `["yourcompany.com", "subsidiary.com"]`). When set:

- Only users whose email domain matches an entry in the list can authenticate.
- Users with non-matching domains receive: "Your email domain is not allowed for this organization."

When `allowed_domains` is empty or omitted, all email domains are accepted.

### Manual Role Assignment

Auto-provisioned users receive the `default_role`. To change a user's role after provisioning, use the tenant member management UI or API:

```bash
curl -X PUT https://your-domain.com/api/v1/team/members/{user-id} \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

---

## 10. Troubleshooting

### "No SSO providers configured"

The tenant has no active identity providers. Check:

- An identity provider has been created for the tenant.
- The provider's `is_active` field is `true`.
- The `org` query parameter in the login URL matches the tenant's slug exactly.

### "Redirect URI mismatch"

The redirect URI registered at the identity provider does not match what OpenCTEM sends. Verify:

- **Entra ID**: The redirect URI is `https://your-domain.com/auth/sso/callback/entra_id`
- **Okta**: The redirect URI is `https://your-domain.com/auth/sso/callback/okta`
- **Google**: The redirect URI is `https://your-domain.com/auth/sso/callback/google_workspace`
- The protocol (`https` vs `http`) matches exactly.
- There are no trailing slashes or extra path segments.

### "Invalid or expired state token"

The OAuth state token has a 10-minute lifetime. Causes:

- The user took too long to complete authentication at the identity provider.
- The `AUTH_JWT_SECRET` changed between issuing the state and validating it (e.g., during a deployment).
- Browser session was interrupted (back button, duplicate tabs).

Resolution: Ask the user to try again from the login page.

### "Failed to complete SSO authentication"

The authorization code exchange failed. Common causes:

- The `client_secret` stored in OpenCTEM is incorrect or has been rotated at the provider.
- The authorization code expired (codes are typically valid for only a few minutes).
- Network connectivity issues between the OpenCTEM API and the identity provider.

Check API logs for the specific error from the identity provider's token endpoint.

### "Failed to retrieve user information"

The user info endpoint returned an error. Check:

- The OAuth application has the correct scopes/permissions (`openid`, `profile`, `email`).
- The user account is active at the identity provider.
- For Entra ID, admin consent has been granted for the required permissions.

### "Your email domain is not allowed for this organization"

The user's email domain does not match the `allowed_domains` list. Either add the domain to the list or remove the domain restriction entirely.

### "Identity provider already configured for this tenant and provider type"

Each tenant can have only one configuration per provider type. To reconfigure, either update the existing provider or delete it and create a new one.

### Clock Skew Issues

If tokens are being rejected intermittently, clock skew between your OpenCTEM server and the identity provider may be the cause. Ensure NTP is configured on the server running the OpenCTEM API:

```bash
# Check time synchronization status
timedatectl status

# Force NTP sync
sudo systemctl restart systemd-timesyncd
```

### CORS Errors on SSO Callback

If the browser console shows CORS errors during the callback, verify that `CORS_ALLOWED_ORIGINS` includes the frontend domain. The callback page makes a POST request from the frontend to the API.

---

## 11. Security Considerations

### Secret Storage

- Client secrets are encrypted using AES-256-GCM before storage in the `tenant_identity_providers` table (column: `client_secret_encrypted`).
- The encryption key (`APP_ENCRYPTION_KEY`) must be kept secure. If it is compromised, rotate it and re-encrypt all stored secrets.
- In production (`APP_ENV=production`), the encryption key is required. Without it, the API will not start.
- Secrets are decrypted in memory only during OAuth token exchange and are never logged or returned in API responses.

### State Token Protection

- The OAuth `state` parameter is a JSON payload containing the organization slug, provider type, a random nonce, and a 10-minute expiration.
- The payload is Base64-encoded and signed with HMAC-SHA256 using the `AUTH_JWT_SECRET`.
- On callback, both the signature and expiration are validated before processing.

### Redirect URI Validation

- The `redirect_uri` must use `http` or `https` scheme, include a host, and not exceed 2000 characters.
- This prevents open redirect attacks through crafted redirect URIs.

### SSRF Prevention

- Okta `tenant_identifier` values are validated to only allow `.okta.com` and `.oktapreview.com` domains.
- Entra ID `tenant_identifier` values are limited to 128 characters.
- This prevents server-side request forgery through crafted tenant identifiers.

### Session Management

- SSO login produces the same JWT access/refresh token pair as local authentication.
- Access tokens expire after 15 minutes; refresh tokens after 7 days.
- Revoking a user's sessions (via admin action or password reset) invalidates all tokens, including those created via SSO.

### Race Condition Handling

- Concurrent SSO logins for the same new user are handled safely using database unique constraints and retry logic.
- If two requests attempt to create the same user simultaneously, the second catches the constraint violation and retries the lookup.

### Tenant Isolation

- All identity provider queries include a `WHERE tenant_id = ?` clause.
- Admin endpoints extract the tenant ID from the authenticated user's JWT.
- Public endpoints resolve the tenant from the organization slug.
- The database enforces a unique constraint on `(tenant_id, provider)`.

---

## 12. Disabling or Removing an Identity Provider

### Deactivating (Reversible)

Deactivating a provider prevents new SSO logins but preserves the configuration:

```bash
curl -X PUT https://your-domain.com/api/v1/settings/identity-providers/{id} \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"is_active": false}'
```

Existing sessions for users who authenticated through the deactivated provider remain valid until they expire.

### Deleting (Permanent)

Deleting a provider permanently removes its configuration, including the encrypted client secret. This cannot be undone.

```bash
curl -X DELETE https://your-domain.com/api/v1/settings/identity-providers/{id} \
  -H "Authorization: Bearer <your-jwt-token>"
```

Existing sessions remain valid until they expire, but users will not be able to create new sessions via this provider.

### After Disabling SSO

Users who were auto-provisioned via SSO and do not have a local password set will need to use the **Forgot Password** flow (`POST /api/v1/auth/forgot-password`) to set a local password before they can log in again.

---

## Database Schema Reference

The `tenant_identity_providers` table (migration `000082`):

```sql
CREATE TABLE tenant_identity_providers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider                VARCHAR(50) NOT NULL,
    display_name            VARCHAR(255) NOT NULL,
    client_id               VARCHAR(500) NOT NULL,
    client_secret_encrypted TEXT NOT NULL,
    issuer_url              VARCHAR(500),
    tenant_identifier       VARCHAR(255),
    scopes                  TEXT[] DEFAULT ARRAY['openid','email','profile','User.Read'],
    allowed_domains         TEXT[],
    auto_provision          BOOLEAN DEFAULT true,
    default_role            VARCHAR(50) DEFAULT 'member',
    is_active               BOOLEAN DEFAULT true,
    metadata                JSONB DEFAULT '{}',
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    created_by              UUID REFERENCES users(id),
    CONSTRAINT uq_tenant_provider UNIQUE(tenant_id, provider)
);
```

Key indexes:

- `idx_tip_tenant_id` -- queries by tenant
- `idx_tip_provider` -- queries by provider type
- `idx_tip_active` -- partial index for active providers per tenant
