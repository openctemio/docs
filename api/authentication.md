---
title: Authentication and API keys
parent: API
nav_order: 1
---

# Authentication and API keys

OpenCTEM has one credential per audience. Use the one that matches what you are building:

| You are | Use | Can write? |
|---|---|---|
| A person in the web console | a session (cookies, managed by the console) | yes, within your role |
| A script, report job or dashboard reading data | a tenant API key `oct_...` | no, keys are read-only |
| An AI assistant | a tenant API key `oct_...` on the [MCP server](mcp.md) | no |
| A sensor | a sensor key `octs_...` (obtained by pairing or an enrollment token `octe_...`) | sensor results only |
| A CI job | the CI system's OIDC identity, exchanged for a short-lived run token | CI results only |
| Your identity provider (provisioning) | a SCIM token | SCIM only |

A credential is accepted only on its own [plane](index.md#planes). Credentials are never read from
the URL query string.

## Console sessions

The web console signs in through `/api/v1/auth/...` (local password, OAuth, OIDC or SAML single
sign-on, depending on how the organization is configured). For a local sign-in:

1. `POST /api/v1/auth/login` with `email` and `password` checks the password (and asks for a
   second factor when the user has one). On success it sets a long-lived refresh token in an
   `httpOnly` cookie (`refresh_token`) and a `csrf_token` cookie, and returns the user and the
   organizations they belong to. The refresh token is never returned in the body.
2. `POST /api/v1/auth/token` with `tenant_id` exchanges the refresh token for a short-lived,
   organization-scoped access token (a JWT, 15 minutes by default) and rotates the refresh token.
3. `POST /api/v1/auth/refresh` renews the access token before it expires.

The console keeps the access token in a cookie (`auth_token`) and calls the API through its own
server, which adds the session. Token lifetimes are set with `AUTH_ACCESS_TOKEN_DURATION` (default
`15m`) and `AUTH_REFRESH_TOKEN_DURATION` (default `168h`); see
[Environment variables](../configuration/environment-variables.md).

Sessions are meant for people. For automation, use an API key. Some session-only areas never
accept a key: your own account (`/api/v1/me`, `/api/v1/users`), notifications, the WebSocket
(`/api/v1/ws`), API key and SCIM token management, organization and membership management, and
the admin console.

### CSRF protection

A request authenticated by the session cookie is an ambient-credential request, so every
state-changing call (`POST`, `PUT`, `PATCH`, `DELETE`) must carry the double-submit CSRF token:
the value of the `csrf_token` cookie echoed in the `X-CSRF-Token` header. A missing or mismatched
token is `403`. `GET`, `HEAD` and `OPTIONS` are exempt. Requests authenticated by a header
(`Authorization: Bearer ...`, `X-API-Key`) need no CSRF token, because a cross-site page cannot
set those headers.

### Step-up for sensitive actions

Some actions (for example creating or deleting an API key, creating a CI gate override) require a
recent re-authentication. Without one the API answers `403` with code `STEP_UP_REQUIRED`; the
console then asks for your password or second factor again (`POST /api/v1/auth/step-up`) and
retries. A credential that cannot step up, such as an API key, gets `STEP_UP_UNAVAILABLE`.

## Tenant API keys

An API key is a long-lived credential for scripts and AI clients. It belongs to one organization
and acts as the user who created it.

### Create a key

In the console: **Settings > API keys > Generate API key**. Choose a name, an expiry (30 days,
90 days or 1 year) and the scopes. The secret (`oct_...`) is shown **once**; store it in your
secret manager.

![The API keys page listing two keys with their scopes and expiry, key prefixes blurred]({{ site.baseurl }}/assets/images/api/api-keys.png)
*Figure: Settings, API keys.*

**Settings > AI access (MCP)** creates a key with the scopes the MCP tools need; see
[MCP server](mcp.md).

You need `integrations:api_keys:write` to create keys and `integrations:api_keys:read` to list
them. By default only Owners and Administrators hold the write permission. Owners and
Administrators see every key of the organization; other members see only their own keys.

With the API (session only, step-up required):

```bash
curl -X POST https://openctem.example.com/api/v1/api-keys \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" --cookie "$SESSION_COOKIES" \
  -d '{"name":"weekly-report","scopes":["findings:read","assets:read"],"expires_in_days":90}'
```

| Field | Rules |
|---|---|
| `name` | required, 1 to 255 characters |
| `description` | optional, up to 1,000 characters |
| `scopes` | up to 50 permission names; each must exist and you must hold it yourself |
| `expires_in_days` | required, 1 to 365. Every key expires. |
| `rate_limit` | optional, requests per hour (0 = no per-key limit), up to 100,000 |

The response contains the key's metadata and, only in this response, `key`.

| Route | Purpose |
|---|---|
| `GET /api/v1/api-keys` | list keys (metadata only: prefix, scopes, last used, expiry) |
| `GET /api/v1/api-keys/{id}` | one key |
| `POST /api/v1/api-keys/{id}/revoke` | revoke (the key stops working immediately) |
| `DELETE /api/v1/api-keys/{id}` | delete (step-up required) |

### Use a key

Send the key in the `Authorization` header (or `X-API-Key`):

```bash
export OPENCTEM_API_KEY=oct_...   # from your secret manager
curl -H "Authorization: Bearer $OPENCTEM_API_KEY" \
  "https://openctem.example.com/api/v1/findings?severity=critical&is_in_kev=true"

curl -H "X-API-Key: $OPENCTEM_API_KEY" \
  "https://openctem.example.com/api/v1/assets?per_page=50"
```

If both headers are present they must carry the same key. A request that presents a key is
decided by the key alone: an invalid key is `401` even if the request also carries a session
cookie.

### What a key can and cannot do

- **Read-only.** On the REST API a key may use `GET`, `HEAD` and `OPTIONS` only. Any other method
  is `403 API keys are read-only`, whatever its scopes. Writing through the API needs a console
  session; sending results needs a sensor or CI runner (see [Ingesting results](ingest.md)).
- **Scoped.** On every request the key's effective permissions are recomputed:

  ```
  effective = key scopes ∩ permissions its user holds now
  ```

  If the user loses a permission, the key loses it on the next request. A key is never an
  administrator: the Owner/Administrator bypass does not apply, so a route the key has no scope
  for is `403`.
- **Data scope applies.** A key sees only the data its user may see (asset groups, pentest
  campaign membership).
- **Refused areas.** A key is refused (`403`) on `/api/v1/api-keys`, `/api/v1/scim-tokens`,
  `/api/v1/me`, `/api/v1/notifications`, `/api/v1/ws`, `/api/v1/platform`, `/api/v1/users`,
  `/api/v1/auth`, `/api/v1/admin`, `/api/v1/tenants` and `/api/v1/invitations`. A key can never
  mint, list or revoke keys, change a password or reach the admin console.
- **Network policy.** The organization's IP allowlist applies to keys exactly as to sessions
  (`403 IP_NOT_ALLOWED` from outside it).
- **Stops working** (`401`, the same answer in every case) when it is revoked or expired, when its
  user is suspended or removed from the organization, or when the user's account is disabled.

The scopes the console offers for general keys are `assets:read`, `findings:read`, `scans:read`,
`integrations:read`, `assets:write`, `findings:write` and `scans:write`. Write scopes are stored
but have no effect on the REST API today, because keys are read-only. The full permission list is
in [Roles, groups and permissions](../identity/roles-and-permissions.md).

### Limits and audit

- Each key has one token bucket sized from its `rate_limit` (requests per hour, a full hour's
  budget as burst), shared by the REST API and MCP. When it is exhausted the API answers `429`.
  The general rate limits in [Conventions](conventions.md#rate-limits) apply as well.
- Every request records the key's last use time and address. Audit entries written during a key
  request name the key's user as the actor and add `auth_method=api_key`, the key id and its
  prefix.
- Keys are stored as an HMAC-SHA256 hash peppered with `APP_ENCRYPTION_KEY`; the plaintext is
  never stored.

### Good practice

- Give each integration its own key with the narrowest scopes it needs.
- Prefer short expiries and rotate by creating a new key, switching the integration, then revoking
  the old one.
- Never put a key in a URL, a repository or a log. The gateway strips `X-API-Key` from its access
  log; your own proxies should too.

## Sensor credentials

Sensors authenticate on the sensor plane (`/api/v2/sensor`) only, with a sensor key (`octs_...`,
sent as `Authorization: Bearer` or `X-API-Key`). A sensor obtains its key by interactive pairing or
with a one-time enrollment token (`octe_...`) that an administrator creates in the console. User
sessions and `oct_` keys are refused on the sensor plane, and sensor keys are refused everywhere
else. See [Pairing and enrollment](../sensors/pairing.md).

## Admin console and SCIM

- The platform admin console (`/api/v1/admin/...`) accepts only an admin console session, signed
  in at `/admin`. It has no API key.
- SCIM provisioning (`/scim/v2/...`) uses a SCIM bearer token created by an organization Owner.
  See [SCIM](../identity/scim.md).
