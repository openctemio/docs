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
| An AI assistant | an OAuth connection a person approves, or a tenant API key `oct_...`, on the [MCP server](mcp.md) | only through a person's OAuth connection: comments the person confirms, proposals and pentest drafts another person decides |
| An integration that needs its own identity (SIEM export, ticketing bridge) | an API key minted for a [service account](#service-accounts) | no, keys are read-only |
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

The token from step 1 (and from a social or SSO sign-in) is bound to no organization. Routes that
name the organization in the URL (`/api/v1/tenants/{tenant}/...`) refuse it with
`403 ACCOUNT_TOKEN_NOT_ALLOWED`; exchange it first. On those routes the URL organization's
requirements (two-factor, personal-account policy, the factor an SSO exception needs) are applied to
the token's own session on every request, whatever organization the token was issued for (cached 15
seconds per session and organization, failing closed).

The console keeps the access token in a cookie (`auth_token`) and calls the API through its own
server, which adds the session. Token lifetimes are set with `AUTH_ACCESS_TOKEN_DURATION` (default
`15m`) and `AUTH_REFRESH_TOKEN_DURATION` (default `168h`); see
[Environment variables](../configuration/environment-variables.md).

Sessions are meant for people. For automation, use an API key. Some session-only areas never
accept a key: your own account (`/api/v1/me`, `/api/v1/users`), notifications, the WebSocket
(`/api/v1/ws`), API key and SCIM token management, organization and membership management, and
the admin console.

### Sign-in refusal codes

Every refusal of a sign-in, SSO, SAML, social sign-in, link or invitation request carries a stable
`code`; the web console words each one in the person's language and never shows the server's
sentence for a known code. Answers given before the password is proven stay generic, and none names
another organization. The ones a client most often needs:

| Code | Status | Meaning |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Wrong email or password (also a break-glass administrator account on the main site) |
| `ACCOUNT_LOCKED`, `ACCOUNT_SUSPENDED`, `EMAIL_NOT_VERIFIED` | 403 | Raised only after the password was proven. `EMAIL_NOT_VERIFIED` comes with an offer to send a new link (`POST /api/v1/auth/resend-verification`) |
| `SIGNUP_NOT_AVAILABLE` | 403 | No account may be created for this person |
| `SSO_REQUIRED` | 403 | The organization requires single sign-on |
| `SSO_BREAK_GLASS_NEEDS_MFA` | 403 | An owner's password sign-in to an organization that requires SSO needs their second factor |
| `ORGANIZATION_SUSPENDED` | 403 | The organization is suspended |
| `MFA_ENROLLMENT_REQUIRED` | 403 | Two-factor authentication must be set up first |
| `MFA_IDP_EVIDENCE_REQUIRED` | 403 | The organization requires the identity provider to prove a second factor |
| `SSO_AWAITING_APPROVAL`, `SSO_NOT_A_MEMBER`, `SSO_DOMAIN_NOT_ALLOWED`, `SSO_DIFFERENT_METHOD`, `EMAIL_UNVERIFIED_AT_IDP` | 403 | Organization SSO refusals after the provider authenticated the person |
| `LIMIT_REACHED` | 403 | No free seat |
| `OAUTH_ACCOUNT_EXISTS` | 409 | The address already has an account; sign in to it, then link the provider |
| `OAUTH_NO_EMAIL` | 400 | The provider returned no address |
| `OAUTH_INVALID_STATE` | 400 | The state is unknown, used, expired or from another browser |
| `EMAIL_NOT_AUTHORITATIVE`, `ACCOUNT_LINK_REQUIRED` | 403 | The provider cannot prove the mailbox, or an account exists: sign in another way and link the provider |
| `LINK_PROOF_REQUIRED`, `LINK_PROOF_FAILED`, `LINK_PROOF_UNAVAILABLE` | 403 | Linking or unlinking a sign-in method needs a typed authenticator code (or password) |
| `LAST_SIGN_IN_METHOD` | 409 | The only way to sign in cannot be removed |
| `INVITATION_ALREADY_MEMBER`, `INVITATION_MEMBERSHIP_SUSPENDED`, `MEMBERSHIP_SUSPENDED_REACTIVATE` | 400 | Invitation refusals |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many attempts; the sign-in form asks the person to wait a minute |

A SAML failure redirects to `/login?error=<code>`. The full table is
`api/internal/infra/http/handler/auth_error_codes.go` in the source.

### CSRF protection

A request authenticated by the session cookie is an ambient-credential request, so every
state-changing call (`POST`, `PUT`, `PATCH`, `DELETE`) must carry the double-submit CSRF token:
the value of the `csrf_token` cookie echoed in the `X-CSRF-Token` header. A missing or mismatched
token is `403`. `GET`, `HEAD` and `OPTIONS` are exempt. Requests authenticated by a header
(`Authorization: Bearer ...`, `X-API-Key`) need no CSRF token, because a cross-site page cannot
set those headers.

The web console's server (the console origin, as opposed to the API) applies a stricter rule to
every write it answers, signed in or not: the request must be same-origin (`Sec-Fetch-Site`
`same-origin` or `none`, and `Origin` or else `Referer` naming the console's host), and
`X-CSRF-Token` must equal the `csrf_token` cookie, which must be present. The console sets that
cookie on every page it serves. A script that posts to the console instead of the API must send
an `Origin` header and the cookie/header pair; scripts that call the API with a bearer token or an
API key are not affected. The API's pre-session endpoints (`/api/v1/auth/login`, `/register`,
`/token`, `/refresh`, MFA, password reset, email verification, the OAuth and SSO callbacks, and
the admin console sign-in steps) refuse a write that a browser sent for another site: an `Origin`
that is neither the request's host nor listed in `CORS_ALLOWED_ORIGINS`, `Origin: null`, or no
`Origin` with a cross-site `Sec-Fetch-Site`. A request with neither header (a script) passes.

### Step-up for sensitive actions

Some actions (for example creating or deleting an API key, creating a CI gate override, approving
an MCP consent) require a recent re-authentication. Without one the API answers `403` with code `STEP_UP_REQUIRED`; the
console then asks for your password or second factor again (`POST /api/v1/auth/step-up`) and
retries. A credential that cannot step up, such as an API key, gets `STEP_UP_UNAVAILABLE`.

## Tenant API keys

An API key is a long-lived credential for scripts and AI clients. It belongs to one organization
and acts as the user who created it.

### Create a key

In the console: **Settings > Access & security > API keys > Generate API Key**. Choose a name, an expiry (30 days,
90 days or 1 year) and the scopes. The secret (`oct_...`) is shown **once**; store it in your
secret manager.

![The API keys page listing two keys with their scopes and expiry, key prefixes blurred]({{ site.baseurl }}/assets/images/api/api-keys.png)
*Figure: Settings, API keys.*

**Settings > Access & security > AI assistants (MCP)** creates a key with the scopes the MCP tools need; see
[MCP server](mcp.md). Most assistants connect with OAuth and need no key.

You need `integrations:api_keys:write` to create keys and `integrations:api_keys:read` to list
them. By default only Owners and Administrators hold the write permission. Owners and
Administrators see every key of the organization; other members see only their own keys.

Creating a key also needs an enrolled second factor whenever the organization's rule or the
platform's [two-factor floor](../identity/two-factor.md#the-platform-two-factor-floor) covers you,
even during the floor's grace period (`403 MFA_ENROLLMENT_REQUIRED`).

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
  `/api/v1/service-accounts`, `/api/v1/me`, `/api/v1/notifications`, `/api/v1/ws`,
  `/api/v1/platform`, `/api/v1/users`, `/api/v1/auth`, `/api/v1/admin`, `/api/v1/tenants`,
  `/api/v1/invitations`, `/api/v1/oauth` and `/api/v1/mcp-access`. A key can never mint, list or
  revoke keys, change a password, change the MCP policy or reach the admin console.
- **Network policy.** The organization's IP allowlist applies to keys exactly as to sessions
  (`403 IP_NOT_ALLOWED` from outside it).
- **Stops working** (`401`, the same answer in every case) when it is revoked or expired, when its
  user is suspended or removed from the organization, when the membership passes its end date (at
  once, not at the next sweep), or when the user's account is disabled or blocked. A password reset,
  a password change and `DELETE /api/v1/users/me/sessions?revoke_api_keys=true` revoke the keys the
  person owns when `revoke_api_keys` is set (the web dialogs tick **Also revoke API keys** by
  default); `GET /api/v1/users/me/sessions` returns `active_api_keys`.

The scopes the console offers for general keys are `assets:read`, `findings:read`, `scans:read`,
`integrations:read`, `assets:write`, `findings:write` and `scans:write`. Write scopes are stored
but have no effect on the REST API today, because keys are read-only. The full permission list is
in [Roles, groups and permissions](../identity/roles-and-permissions.md).

### Limits and audit

- Each key has one token bucket sized from its `rate_limit` (requests per hour), shared by the
  REST API and MCP. The bucket is at most 60 deep: a key (or an MCP connection) can make at most 60
  requests at once, then continues at the hourly rate. When it is exhausted the API answers `429`.
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

## Service accounts

A service account is an organization-owned identity for an integration. It has no password and
never signs in, starts with no role, takes custom roles and teams like a member, and can never be an
Owner or Administrator or hold full data access. It acts only through API keys minted for it; such
a key carries at most what the account holds and, like every key, is read-only on the REST API.
Create one in **Settings > Access & security > Service accounts**.

| Route | Needs |
|---|---|
| `GET /api/v1/service-accounts` | `team:members:read` |
| `POST /api/v1/service-accounts`, `DELETE /api/v1/service-accounts/{id}` | `service_accounts:manage` (owners and administrators); deleting needs a recent sign-in |
| `GET /api/v1/service-accounts/{id}/api-keys` | owners and administrators with `team:members:read` and `integrations:api_keys:read` |
| `POST /api/v1/service-accounts/{id}/api-keys`, `DELETE .../{key_id}` | `service_accounts:manage` together with `integrations:api_keys:write` or `:delete`; minting and deleting need a recent sign-in, and you must hold every scope you grant |

Deleting the account removes its roles, team memberships and keys at once.

## Sensor credentials

Sensors authenticate on the sensor plane (`/api/v2/sensor`) only, with a sensor key (`octs_...`,
sent as `Authorization: Bearer` or `X-API-Key`). A sensor obtains its key by interactive pairing or
with a one-time enrollment token (`octe_...`) that an administrator creates in the console. User
sessions and `oct_` keys are refused on the sensor plane, and sensor keys are refused everywhere
else. See [Pairing and enrollment](../sensors/pairing.md).

## Admin console and SCIM

- The platform admin console (`/api/v1/admin/...`) accepts only an admin console session, signed
  in on the console's own site (`OPENCTEM_ADMIN_SITE`, see
  [Environment variables](../configuration/environment-variables.md)); the tenant web app no longer
  serves `/admin`. It has no API key.
- SCIM provisioning (`/scim/v2/...`) uses a SCIM bearer token created by an organization Owner.
  See [SCIM](../identity/scim.md).
