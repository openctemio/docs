# SSO with Microsoft Entra ID (Azure AD)

Configure per-tenant Single Sign-On with Microsoft Entra ID for your OpenCTEM platform.

Each tenant can have its own Entra ID configuration — different Azure AD tenants, client IDs, and domain restrictions.

## Prerequisites

- OpenCTEM platform running (API + UI)
- Azure subscription with Microsoft Entra ID
- Tenant owner or admin role in OpenCTEM
- `APP_ENCRYPTION_KEY` configured (for encrypting client secrets)

## Step 1: Register App in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Microsoft Entra ID** → **App registrations** → **New registration**
3. Fill in:

| Field | Value |
|---|---|
| **Name** | `OpenCTEM SSO` (or your preferred name) |
| **Supported account types** | `Accounts in this organizational directory only` |
| **Redirect URI (Web)** | `https://your-domain.com/auth/sso/callback` |

4. Click **Register**

### Get credentials

After registration, note down:

| Value | Where to find | Example |
|---|---|---|
| **Application (client) ID** | Overview page | `11111111-2222-3333-4444-555555555555` |
| **Directory (tenant) ID** | Overview page | `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee` |
| **Client secret** | Certificates & secrets → New client secret | `abc123~xyz789...` |

### Configure API permissions

1. Go to **API permissions** → **Add a permission**
2. Select **Microsoft Graph** → **Delegated permissions**
3. Add these permissions:
   - `openid`
   - `email`
   - `profile`
   - `User.Read`
4. Click **Grant admin consent** (if required by your org)

### Configure redirect URIs

Add all environments:

```
https://app.yourcompany.com/auth/sso/callback      # Production
https://staging.yourcompany.com/auth/sso/callback   # Staging
http://localhost:3000/auth/sso/callback              # Development
```

## Step 2: Configure in OpenCTEM

### Option A: Via API

```bash
curl -X POST https://api.yourcompany.com/api/v1/settings/identity-providers \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "entra_id",
    "display_name": "Microsoft Login",
    "client_id": "11111111-2222-3333-4444-555555555555",
    "client_secret": "abc123~xyz789...",
    "tenant_identifier": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "allowed_domains": ["yourcompany.com"],
    "auto_provision": true,
    "default_role": "member",
    "scopes": ["openid", "email", "profile", "User.Read"]
  }'
```

### Option B: Via UI

1. Login as tenant **Owner** or **Admin**
2. Go to **Settings** → **Identity Providers**
3. Click **Add Provider**
4. Select **Microsoft Entra ID**
5. Fill in the form with values from Step 1
6. Click **Save**

## Step 3: Test the login flow

1. Open login page in incognito browser
2. You should see **"Sign in with Microsoft"** button
3. Click it → redirected to Microsoft login
4. Authenticate with your Azure AD account
5. Redirected back to OpenCTEM dashboard

If `auto_provision` is enabled, a new OpenCTEM account is created automatically on first login.

## Configuration Reference

| Field | Required | Description | Default |
|---|---|---|---|
| `provider` | Yes | Must be `entra_id` | — |
| `display_name` | Yes | Button text on login page (e.g., "Microsoft Login") | — |
| `client_id` | Yes | Azure App Registration client ID | — |
| `client_secret` | Yes | Azure client secret (encrypted at rest with AES-256-GCM) | — |
| `tenant_identifier` | No | Azure AD tenant ID or domain. Use `common` for multi-org | `common` |
| `allowed_domains` | No | Only allow emails from these domains (e.g., `["yourcompany.com"]`). Empty = all domains | `[]` |
| `auto_provision` | No | Create OpenCTEM account on first SSO login | `true` |
| `default_role` | No | Role for auto-provisioned users: `member` or `viewer` | `member` |
| `scopes` | No | OAuth scopes to request | `openid email profile User.Read` |
| `is_active` | No | Enable/disable this provider | `true` |

## Multi-Tenant Setup

Each OpenCTEM tenant can connect to a **different** Azure AD tenant:

```
OpenCTEM Tenant "Contoso"
  → Entra ID: contoso.onmicrosoft.com
  → Client ID: aaa-111
  → Allowed: @contoso.com

OpenCTEM Tenant "Fabrikam"
  → Entra ID: fabrikam.onmicrosoft.com
  → Client ID: bbb-222
  → Allowed: @fabrikam.com

OpenCTEM Tenant "Startup"
  → No SSO (local auth only)
```

Configuration is fully isolated per tenant. Changing one tenant's SSO has no effect on others.

## API Endpoints

### Public (Login page)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/auth/sso/providers?org={slug}` | List active SSO providers for a tenant |
| `GET` | `/api/v1/auth/sso/{provider}/authorize?org={slug}&redirect_uri={url}` | Generate authorization URL |
| `POST` | `/api/v1/auth/sso/{provider}/callback` | Handle OAuth callback |

### Admin (Settings)

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/api/v1/settings/identity-providers` | Team Admin | List all providers |
| `POST` | `/api/v1/settings/identity-providers` | Team Admin | Create provider |
| `GET` | `/api/v1/settings/identity-providers/{id}` | Team Admin | Get provider details |
| `PUT` | `/api/v1/settings/identity-providers/{id}` | Team Admin | Update provider |
| `DELETE` | `/api/v1/settings/identity-providers/{id}` | Team Admin | Delete provider |

## Security

### What's protected

- **Client secret**: Encrypted with AES-256-GCM at rest, never returned in API responses
- **State token**: HMAC-SHA256 signed with JWT secret, 10-minute expiry, random nonce
- **Redirect URI**: Validated (http/https only, max 2000 chars)
- **Domain restriction**: Email domain checked before account creation
- **Response body limit**: 1MB max from Microsoft API (prevents memory exhaustion)
- **Provider match**: State token includes provider name to prevent provider swap attacks

### What to configure in Azure

- Set **Supported account types** to `Single tenant` (not multi-tenant) for strictest security
- Enable **MFA** in Azure AD for all users
- Set **token lifetime** policies as needed
- Review **Conditional Access** policies
- Rotate client secrets periodically (Azure supports up to 2 years)

## Troubleshooting

### "SSO provider not configured"

- Verify the provider exists: `GET /api/v1/settings/identity-providers`
- Check `is_active` is `true`
- Ensure the `org` query parameter matches your tenant slug

### "Email domain not allowed"

- Check `allowed_domains` includes the user's email domain
- Set `allowed_domains` to `[]` (empty array) to allow all domains

### "Failed to exchange authorization code"

- Verify `client_id` and `client_secret` match Azure Portal
- Check the redirect URI matches exactly (including trailing slash)
- Ensure the Azure app has `openid` and `email` permissions

### "Failed to get user info"

- Ensure `User.Read` permission is granted in Azure
- Check if admin consent is required and granted
- Verify the Azure app token is not expired

### User not auto-provisioned

- Check `auto_provision` is `true`
- Verify the email domain is in `allowed_domains` (or list is empty)
- Check API logs for detailed error messages

### Client secret decryption error

- Ensure `APP_ENCRYPTION_KEY` is set and hasn't changed since the provider was created
- If the key changed, delete and recreate the provider

## Other Supported Providers

The same per-tenant SSO system supports:

### Okta

```json
{
  "provider": "okta",
  "display_name": "Okta Login",
  "client_id": "your-okta-client-id",
  "client_secret": "your-okta-secret",
  "tenant_identifier": "https://your-org.okta.com"
}
```

### Google Workspace

```json
{
  "provider": "google_workspace",
  "display_name": "Google Login",
  "client_id": "your-google-client-id.apps.googleusercontent.com",
  "client_secret": "your-google-secret",
  "allowed_domains": ["yourcompany.com"]
}
```
