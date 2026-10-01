# OpenCTEM v0.9.0 release notes (draft)

> **Draft for the release owner.** The api and ui repositories publish their
> notes as GitHub releases. The tag workflow writes the image list and appends
> the generated PR list, and the curated text goes in the release PR body
> (`Release v0.9.0: develop → main`). The two sections below can be pasted
> there as they are. Nothing here is tagged or released.

**Components:** api `v0.9.0`, ui `v0.9.0` (released together; they must be
deployed together). Unchanged: agent `v0.2.2`, sdk-go `v0.6.0`. Helm chart: a
chart with `appVersion: v0.9.0` is needed. Until one is published, pin the image
tags (see the upgrade guide).

**Upgrading from v0.8.x:** read **[Upgrading from v0.8 to v0.9](upgrade-to-v0.9.md)**
before you upgrade. This release changes who can sign in and how, and it renames
agents to sensors in the database.

---

## api v0.9.0

### Highlights

- **Platform admin console** (RFC-022). Platform administrators are user
  accounts that belong to no organization. They sign in on `/login` and open
  the console with a mandatory TOTP code, in server-side sessions (8 h absolute,
  30 min idle). The console has Organizations, per-organization SSO
  (SAML, OIDC, verified domains, enforcement), organization users,
  administrators, break-glass administrators and an optional platform OIDC
  identity provider for administrators. #547 #548 #549 #551 #561 #564
- **User two-factor authentication** (RFC-024): TOTP with 10 recovery codes,
  replay protection and lockout. The organization setting *Require two-factor
  authentication* is now enforced, also on token refresh. Session revocation
  takes effect immediately. #560 #566
- **Onboarding without self-registration** (RFC-025). Administrators create
  users, who get a one-time set-password link. An invitation lets someone
  register even when registration is off. SSO admits new users only from
  DNS-verified domains. Allowed email domains and the IP allowlist are now
  enforced. #562 #565
- **Agents are now sensors** (RFC-023 §9.5). The rename covers the database
  (migration 000230), the API, permissions, the module, events, audit, logs,
  metrics and settings. `/api/v1/agents` answers 308 until 2027-04-01. Protocol
  v1 (`/api/v1/agent/*`) is unchanged, so deployed agents keep working.
  `./server -sensor-upgrade-check`. #563
- **Scan dispatch** (RFC-023 Phase 0). Every target is dispatched, not only the
  first one. Asset groups are expanded. Exclusions are enforced on the server
  and fail closed. Jobs no longer fall back silently to platform scanners. #555

### Breaking changes

- `AUTH_ALLOW_REGISTRATION` now defaults to `false`. #562
- Admin API keys, `X-Admin-API-Key`, `POST /admin/users`,
  `POST /admin/users/{id}/rotate-key` and the `openctem-admin` CLI are removed.
  Migration 000227 revokes every key and deactivates every v0.8 administrator.
  Create new administrators with `bootstrap-admin -email=… -backup-email=…`,
  or revive an old one with `-link`. #550 #575
- `/api/v1/settings/{saml,identity-providers,verified-domains}` are removed.
  SSO setup is now under `/api/v1/admin/tenants/{tenantId}/sso/*` (platform
  admin). Organization owners can no longer set `sso_enforced` (403). SCIM
  stays with the tenant admin. #545 #546 #548 #549
- SSO just-in-time provisioning requires a DNS-verified domain. The default JIT
  role is `viewer`, and `SSO_ENTRA_DEFAULT_ROLE` also defaults to `viewer`. #562
- Allowed email domains, the IP allowlist (`403 IP_NOT_ALLOWED`) and Require-MFA
  are enforced. The IP allowlist needs `SERVER_TRUSTED_PROXIES`, plus the UI's
  `TRUST_PROXY_HEADERS` behind a reverse proxy. #560 #562
- Permissions `agents:*` are now `sensors:*`, module `agents` is now `sensors`,
  and events `agent.offline` / `agent.error` are now `sensor.*`. JSON fields
  `agent_id` / `agent_preference` are now `sensor_*`, and Tenable
  `execution_mode: "agent"` is rejected. Log fields and metric names are
  renamed. `AGENT_*` settings are now `SENSOR_*`; the old names still work with
  a warning. Stored data is converted by migration 000230. #563
- Behaviour tightened:
  - Invitation tokens are returned only to owners and admins. #552
  - `oct_` key scope escalation now returns 403, and the per-key `rate_limit` is
    enforced. #556
  - There is a cap of 8 concurrent ingests per tenant. #556
  - `/agent/renew` is throttled. #556
  - Command `fail` returns 400 or 409. #556
  - Validation evidence without `command_id` is advisory only. #556

### Security

- A zstd decompression bomb on chunk ingest could OOM the API (HIGH). #554
- Viewers could read invitation tokens and accept an invitation to admin. #552
- A sensor-surface review found 10 issues, now fixed: a heartbeat could undo a
  revoke, auto-resolve tool spoofing, unauthenticated validation outcomes,
  rate limiting applied after decompression, `oct_` scope escalation, audit
  gaps, and more. #556
- A provisioning takeover through a pre-registered email, and console hardening. #551
- IPv6 `::` and `ff00::/8` are now hard-blocked by the SSRF guard. #557
- grpc is bumped to v1.83.2 (CVE-2026-84445). #558
- Log-injection hardening in the email service. #565

### Fixes

- SAML sign-in never worked: the ACS handler did not parse the form. #562
- Invitations created a `member` membership for viewer-only invitations. #562
- Password-reset links pointed to a missing page. #562
- `POST /api/v1/agent/scans` returned 500 for an empty or SDK-style
  `scanner_type`. #567
- A wrong 2FA code or wrong current password on a signed-in call returned 401,
  which signed the user out; it now returns 400. #566
- Password change revoked the current session; it now keeps it. #560
- `bootstrap-admin` now reactivates v0.8 administrators on `-link`. #575

### Database

Migrations **000225 → 000230**:

| Migration | Effect | Down |
|---|---|---|
| 000225 `admin_console_auth` | new tables `admin_credentials`, `admin_sessions` | drops them |
| 000226 `admin_users_link_user` | `admin_users.user_id` + trigger: administrators cannot be organization members | drops them |
| 000227 `admin_users_drop_api_keys` | revokes all admin keys, deactivates unlinked admins, key columns nullable | keys **not** restored |
| 000228 `user_mfa` | new tables `user_mfa`, `user_mfa_recovery_codes`, `user_mfa_challenges` | drops them (**2FA enrollments lost**) |
| 000229 `admin_breakglass_platform_idp` | break-glass and IdP columns, `platform_identity_provider`, `admin_idp_login_states`, audit severity | drops them |
| 000230 `rename_agent_to_sensor` | the agent → sensor rename of schema and stored values | exact reverse |

Stop the API, migrate, then start the new API and UI. There are no
compatibility views. Up → down to 224 → up was tested on a database with
v0.8.0 data.

### Images

`ghcr.io/openctemio/{api,migrations,seed,admin-cli}:v0.9.0`. The `admin-cli`
image now contains only `bootstrap-admin`.

---

## ui v0.9.0

### Highlights

- **Admin console** (`/admin`): its own shell and sidebar. It has
  Organizations (with SSO and Users tabs), Administrators (break-glass, test
  confirmation, IdP binding), System logs, and *System → Admin sign-in*
  (platform IdP). Administrators sign in on `/login`, then enter a TOTP code;
  the first sign-in asks for a password change. #501 #504 #505 #506 #508
- **My account → Security**: two-factor authentication (QR code enrollment and
  recovery codes), the session list with sign-out, and password change. Login
  asks for a code step and, where required, forced enrollment. The members list
  has a *2FA* column. #510 #511
- **Admin-created users**: *Settings → Users → Add user* gives a one-time
  set-password link, plus `/set-password`. *Sign up* is hidden when
  registration is off, and invitation pages offer *Create your account*. The
  security settings show *Your current IP* and explain the lockout guard. #509
- **Sensors (formerly Agents)**: `/agents` redirects (308) to `/sensors`, with
  All, Scanners and Collectors tabs. Pages are gated on the `sensors` module and
  `sensors:*`. Cached permissions and browser storage are migrated once. Audit
  labels cover both spellings. #513
- **Asset detail sheet redesign** (risk, ownership, exposure, discovery,
  properties) and a smoother sidebar. #503 #507
- SCIM stays in tenant settings, while SAML and verified domains move to the
  console; the old URLs redirect. #500 #502

### Breaking changes

- Requires api v0.9.0, and the API requires this UI. Deploy them together.
- New optional setting `TRUST_PROXY_HEADERS` (default `false`). Set it to
  `true` only behind a reverse proxy that overwrites `X-Real-IP` and
  `X-Forwarded-For`. The bundled `nginx.conf` now overwrites `X-Forwarded-For`.
  #509
- New dependency `uqr` (QR codes). It is in the image; checkouts that run
  `next dev` need `npm ci`. #505

### Images

`ghcr.io/openctemio/ui:v0.9.0`.
