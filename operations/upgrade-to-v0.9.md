# Upgrading from v0.8.x to v0.9.0

> **Applies to** a running OpenCTEM **v0.8.x** (api/ui `v0.8.x`, Helm chart
> `openctem-0.4.x`, database migration **000224**) upgrading to **v0.9.0**
> (database migrations **000225 → 000230**).
> Coming from an older release? Read [Skipping versions](#skipping-versions) first.
>
> This page lists only what is specific to v0.9.0. The generic procedure
> (image names and tags, Helm hooks, maintenance window template) is in
> the [Upgrade Guide](upgrade-guide.md). The agent → sensor rename has its own
> page, [Upgrading to the Sensor release](upgrade-agent-to-sensor.md); this page
> links to it instead of repeating it.

v0.9.0 is the biggest behaviour change since v0.4: **who can get in, and how,
changes**. Self-registration is off, only the platform administrator creates
organizations, platform administrators become people with
two-factor sign-in, SSO set-up moves to a platform admin console, organization
access policies that were only stored are now enforced, and *agents* become
*sensors* everywhere. Plan a maintenance window of about 30 minutes, and do the
[pre-upgrade checklist](#pre-upgrade-checklist) a few days before it: some
items need a decision from you or from organization owners.

## Table of Contents

- [What's new](#whats-new)
- [Breaking and behaviour changes](#breaking-and-behaviour-changes)
- [Configuration changes](#configuration-changes)
- [Removed endpoints and tools](#removed-endpoints-and-tools)
- [Pre-upgrade checklist](#pre-upgrade-checklist)
- [Upgrade procedure — Docker Compose](#upgrade-procedure--docker-compose)
- [Upgrade procedure — Kubernetes / Helm](#upgrade-procedure--kubernetes--helm)
- [After the upgrade](#after-the-upgrade)
- [Verification checklist](#verification-checklist)
- [Rollback](#rollback)
- [Skipping versions](#skipping-versions)
- [Not in v0.9.0 yet](#not-in-v090-yet)
- [Troubleshooting](#troubleshooting)

---

## What's new

- **Platform admin console** at `/admin` on the UI: organizations, per-organization
  SSO, administrators, system logs, admin sign-in settings
  ([RFC-022](https://github.com/openctemio/openctem/blob/develop/api/docs/rfcs/RFC-022-platform-admin-console.md)).
  A platform administrator is a normal account that belongs to no organization;
  it signs in on `/login` and opens the console with an authenticator code.
  **Break-glass** administrators and an optional **platform identity provider**
  (OIDC) for administrators.
- **Two-factor authentication for users** (TOTP + recovery codes) under
  *My account → Security*, and the organization setting *Require two-factor
  authentication* is now enforced
  ([RFC-024](https://github.com/openctemio/openctem/blob/develop/api/docs/rfcs/RFC-024-user-two-factor-authentication.md)).
  Signing out a session now takes effect on the next request.
- **Administrators create users** (*Settings → Members → Add user*, or from the
  console), with a one-time set-password link; no open self-registration
  ([RFC-025](https://github.com/openctemio/openctem/blob/develop/api/docs/rfcs/RFC-025-user-onboarding.md)).
- **Agents are now sensors** across the database, API, permissions, audit, logs,
  metrics and UI. Deployed agents keep working unchanged
  ([details](upgrade-agent-to-sensor.md)).
- **Scans dispatch every target** (only the first was sent before), asset-group
  scans dispatch their members, scope exclusions are enforced on the server, and
  jobs no longer fall back silently to shared platform scanners.
- **Security fixes**: invitation tokens hidden from non-admins (viewer → admin
  escalation), bounded zstd decompression on ingest (one 22 KB chunk could OOM
  the API), heartbeat could undo an admin revoke, auto-resolve tool spoofing,
  unauthenticated validation outcomes, `oct_` key scope escalation, SAML sign-in
  that could never succeed, IPv6 SSRF blocklist, grpc CVE-2026-84445.
- UI: redesigned asset detail sheet, new sidebar, sign-up hidden when
  registration is off.

## Breaking and behaviour changes

Each item says **who is affected**, what to do **before** the upgrade, and what
to do **after**. The [inventory queries](#3-run-the-inventory-queries) show you
which of them apply to your installation.

### 1. Self-registration is off by default

`AUTH_ALLOW_REGISTRATION` now defaults to `false` (it defaulted to `true` in
v0.8). `POST /api/v1/auth/register` answers **403 "Registration is not
available"** and the UI hides *Sign up*. People still get in by:

- an administrator creating them (*Settings → Members → Add user*, or the console);
- an **invitation** — invited people can register even with registration off;
- their organization's **SSO** (see [item 5](#5-sso-just-in-time-provisioning-needs-a-dns-verified-domain)).

**Affected:** installations where people sign themselves up (trial or
open-signup instances), and scripts that call `/auth/register`.
**Before:** run [inventory query 1](#3-run-the-inventory-queries). If you
really run an open instance, set `AUTH_ALLOW_REGISTRATION=true` explicitly.
**After:** nothing, unless you chose to keep it open. Registration is checked
in [verification](#verification-checklist).

Related: who may create *organizations* also changes; see
[item 13](#13-only-the-platform-administrator-creates-organizations).

### 2. Platform administrators are people: admin API keys are removed

In v0.8 a platform administrator was an `admin_users` row with an API key
(`X-Admin-API-Key`, used by the `openctem-admin` CLI). In v0.9.0:

- an administrator is a **sign-in account in no organization**, linked to an
  `admin_users` row that holds the role (`super_admin`, `ops_admin`,
  `readonly`);
- it signs in on **`/login`**, is sent to the console, and must enter a **TOTP
  code** (enrolled on first use); temporary passwords must be changed first;
- **admin API keys are gone.** Migration 000227 revokes every key and
  **deactivates every v0.8 admin row** (none of them has a sign-in account).
  `X-Admin-API-Key` and Bearer admin keys get 401. There is no key-based
  replacement: the console is the replacement, and its endpoints accept only a
  console session.

**Affected:** everyone who used `openctem-admin`, `X-Admin-API-Key`, or the
`admin-cli` image for anything other than `bootstrap-admin`.
**Before:** pick **two email addresses that have no OpenCTEM account yet** —
one for the primary administrator, one for the break-glass backup. An address
that already has an account (for example an organization owner's) is refused:
an administrator gets a new, dedicated account. Plan where to store the
break-glass credentials offline.
**After:** [create the administrators](#step-a--create-the-platform-administrators)
with `bootstrap-admin`. To keep an old administrator's email and role instead,
`bootstrap-admin -email=<old admin> -link` gives it a sign-in account and
reactivates it — only possible when that email has no account yet. Old rows you
do not link stay deactivated (kept for the admin audit trail).

### 3. SSO, SAML, identity providers and verified domains move to the platform admin console

| v0.8 (tenant admin) | v0.9.0 |
|---|---|
| *Settings → Integrations → SAML / Identity providers / Verified domains* | **Admin console → Organizations → *org* → Single sign-on** (super admin to change, any admin to view) |
| `/api/v1/settings/saml`, `/api/v1/settings/identity-providers`, `/api/v1/settings/verified-domains` | **Removed.** `/api/v1/admin/tenants/{tenantId}/sso/{saml,identity-providers,verified-domains,enforcement}` |
| Owner sets *SSO enforced* in *Settings → Security* | `PATCH …/settings/security` with `sso_enforced` → **403**; only the platform admin sets enforcement |

Existing SAML and OIDC configurations, verified domains and enforcement are
**kept as they are**; only who may change them moves. Sign-in through SSO is
unchanged (`/api/v1/auth/sso/*`, `/api/v1/auth/saml/{org}/*`). Old UI bookmarks
to the SAML / verified-domain pages redirect to the console.

**Affected:** organization owners/admins who maintain their own SSO, and
automation calling the removed routes.
**Before:** tell organization owners that SSO changes now go through you.
**After:** nothing to migrate.

Also: **SAML sign-in works now.** In v0.8 every signed SAML response was
rejected (the ACS handler never parsed the form). If you gave up on SAML,
try it again.

### 4. SCIM stays with the organization admin

SCIM provisioning (`/api/v1/scim-tokens`, *Settings → Integrations → SCIM
Provisioning*) is still an organization-admin feature. No change.

### 5. SSO just-in-time provisioning needs a DNS-verified domain

A user who signs in through an organization's OIDC or SAML provider and has no
account is created only if **all** hold: the provider is active with
auto-provisioning on, the email domain is **DNS-verified for that
organization**, it is in the provider's allowed domains, and in the
organization's allowed domains. Otherwise: a generic 403 and no account. JIT no
longer depends on `AUTH_ALLOW_REGISTRATION`. The default JIT role is now
**viewer** (was member), including `SSO_ENTRA_DEFAULT_ROLE`. Existing members
keep signing in.

**Affected:** organizations whose new joiners arrive through SSO JIT without a
verified domain ([inventory query 8](#3-run-the-inventory-queries)).
**Before:** add and verify the domain (DNS TXT record
`_openctem-verify.<domain>`) — on v0.8 the tenant admin can still do it in
*Settings → Verified domains*; after the upgrade the platform admin does it in
the console. If JIT users should get more than viewer, set the provider's
default role.
**After:** test one JIT sign-in per affected organization.

### 6. Allowed email domains and the IP allowlist are enforced

Both settings (*Settings → Organization → Security*, owner only) were stored but
never enforced in v0.8.

- **Allowed domains** now restrict invitations (send and accept), invited
  registration, administrator-created users, adding an existing user, SCIM and
  SSO JIT. Existing members are not removed.
- **IP allowlist**: every request made with a user's token for that organization
  must come from a listed IP/CIDR, or it gets **403 `IP_NOT_ALLOWED`**. Not
  applied to sensor keys, `oct_` keys, the admin console or the platform admin.
  Saving a list that does not include your own IP is refused (lockout guard);
  the settings show the IP the server sees.

**The trap:** the API sees the client IP only if a proxy it trusts tells it.
Browsers reach the API through the UI's server-side proxy, so without extra
configuration **the API sees the UI container's IP for everyone**, and an
allowlist of office IPs locks the whole organization out at the first request
after the upgrade. Correct client IPs need all three:

1. a reverse proxy (nginx, ingress, load balancer) in front of the UI that
   **overwrites** `X-Real-IP` and `X-Forwarded-For` with the real client address;
2. `TRUST_PROXY_HEADERS=true` on the **UI**, so its proxy forwards them;
3. `SERVER_TRUSTED_PROXIES=<UI address or network>` on the **API**.

Never set `TRUST_PROXY_HEADERS=true` when browsers can reach the UI directly:
they could then claim any IP.

**Affected:** organizations with a non-empty IP allowlist
([inventory query 5](#3-run-the-inventory-queries)).
**Before:** either configure the three items above, or ask the owner to clear
the list, or clear it yourself (SQL below) and re-enter it after the upgrade
once the API sees real IPs.
**After:** an owner of each such organization opens *Settings → Security* and
checks *Your current IP* is their real address before saving a list.

Recovery when everyone is locked out (takes effect within 30 s, or restart the API):

```sql
UPDATE tenants
   SET settings = jsonb_set(settings, '{security,ip_whitelist}', '[]'::jsonb)
 WHERE slug = '<org-slug>';
```

### 7. "Require two-factor authentication" is enforced

The organization setting `security.mfa_required` existed in v0.8 but did
nothing. Now a member who signs in with a local password and has not enrolled
TOTP is taken through enrollment at sign-in and gets no session until it is
done; token refresh is refused with `403 MFA_ENROLLMENT_REQUIRED`. SSO, SAML and
social sign-ins are exempt (the IdP owns the second factor).

**Affected:** members of organizations with it on ([inventory query 7](#3-run-the-inventory-queries)).
**Before:** tell those members they will be asked to set up an authenticator
app at their next sign-in, or turn the setting off.
**After:** nothing. Owners see a *2FA* column (On / Off / Via SSO) in the
members list.

### 8. Agents are sensors: permissions, API paths, module, events, metrics, logs

Migration 000230 renames everything; effective access is unchanged. In short:

- permissions `agents:*` → `sensors:*` (converted in every role, group,
  permission set and `oct_` key scope; scripts that **create** roles or keys
  must send the new ids);
- `/api/v1/agents/*` → **308** to `/api/v1/sensors/*` until 1 April 2027;
  JSON fields `agent_id` → `sensor_id`, `agent_preference` →
  `sensor_preference`, Tenable `execution_mode: "agent"` → `"sensor"` (the old
  value is now **rejected**);
- module id `agents` → `sensors` (toggles keep their state);
- notification/webhook event types `agent.offline`, `agent.error` →
  `sensor.offline`, `sensor.error` (converted in webhooks, notification
  integrations and muted types);
- audit actions `sensor.*` for new events (history keeps `agent.*`), log fields
  `sensor_id`/`sensor_name`, metrics `sensors_online`,
  `sensor_commands_executed_total`, …;
- API settings `AGENT_*` → `SENSOR_*` (old names still read, with a warning).

**Deployed agents keep working without any change** — the agent protocol
(`/api/v1/agent/*`) is frozen and still served; agent v0.2.2 was tested.

**The API and the UI must be upgraded together.** The v0.8 UI on the v0.9.0
API hides *Sensors* from members and sends `agent_preference` /
`execution_mode: agent`, which the API rejects; the v0.9.0 UI on a v0.8 API
cannot find `/api/v1/sensors`.

Full field-by-field list, SIEM and dashboard changes, and what is deliberately
not rewritten: **[Upgrading to the Sensor release](upgrade-agent-to-sensor.md)**.

**Affected:** automation calling `/api/v1/agents`, SIEM rules on `agent.*`,
dashboards on `agent_*` metrics and log fields, scripts creating roles/keys.
**Before:** inventory queries 2, 3, 4, 11, 12.
**After:** run the upgrade check ([Compose step 5](#upgrade-procedure--docker-compose)), flush the
permission cache (the procedure does it), update dashboards and rules.

### 9. Platform admins, break-glass and the admin console session

- The console session is separate from the organization session: 8 h absolute,
  30 min idle, its own `admin_session` / `admin_csrf` cookies scoped to
  `/api/v1/admin`.
- `bootstrap-admin` now **requires** `-backup-email` (a break-glass
  `super_admin`) unless you pass `-no-backup`. Every break-glass sign-in is
  audited with severity *high*, logged as `WARN … alert=break_glass_sign_in`,
  and e-mailed to the other administrators when system SMTP is configured.
  Another super admin confirms test sign-ins; the roster flags a test overdue
  after 90 days.
- The server refuses any change that would leave no active local super admin
  (409), or — while *Require the identity provider* is on — no break-glass super
  admin.
- An optional **platform IdP** (OIDC) for administrators lives in *System →
  Admin sign-in*. It never admits by just-in-time provisioning, and console
  TOTP is still asked after it unless you trust specific `acr`/`amr` values.

### 10. `APP_ENCRYPTION_KEY` now protects TOTP secrets

User and administrator TOTP secrets and the platform IdP client secret are
encrypted with `APP_ENCRYPTION_KEY` (as integration credentials already were).
It is already mandatory with `APP_ENV=production`. **Do not change or lose it**:
every enrolled authenticator would stop working. If you rotate it some day,
users must reset two-factor authentication.

### 11. Sessions are revoked immediately; password change keeps your session

Signing out a session, *sign out all others*, password change/reset, enabling
2FA and suspension now block the session's access token on the next request
(Redis-backed; if Redis errors, the check fails open and logs it). A password
change keeps the current session and ends the others (v0.8 ended all of them,
including the current one). A wrong current password or 2FA code on a signed-in
call returns **400** (not 401).

### 12. Other behaviour changes

| Change | Who notices |
|---|---|
| Invitation list: `token` only returned to owners/admins | Scripts that read invite tokens as a member/viewer |
| An invitation's membership role is derived from its RBAC roles (viewer-only invitation → viewer, not member) | Organizations that relied on the old mapping |
| `oct_` keys: creating a key with a scope you do not hold → 403; the key's `rate_limit` (requests/hour, default 1000) is enforced → 429 | MCP clients and scripts |
| Report ingest: more than 8 concurrent ingests per organization → 429; the ingest body limit is really 50 MB (was effectively 10 MB) | Bulk importers, CI pipelines |
| `/api/v1/agent/renew`: burst 5, then one per 2 minutes per agent → 429 | Custom agents that renew in a loop |
| `/api/v1/agent/commands/{id}/fail`: 400 for an unclaimed command not assigned to you, 409 for a finished one | Custom agents |
| `POST /api/v1/validation/evidence` without `command_id` is stored as advisory and no longer changes the finding status | Custom validation tooling |
| Auto-resolve: an agent that declares tools can only auto-resolve findings of those tools; reserved names (`pentest`, `manual`, `defectdojo`, …) never auto-resolve from an agent | Custom agents that report other tools' names |
| Scans: every target dispatched, asset groups expanded, exclusions removed server-side; a run whose targets are all excluded is refused (`ALL_TARGETS_EXCLUDED`); a failed exclusion lookup stops the dispatch | Everyone running scans — expect more targets scanned |
| *Auto* sensor preference no longer falls back to shared platform scanners when no tenant scanner is free; internal targets (private, loopback, `.internal`, `.local`, …) never go to platform scanners | Tenants without their own scanner — jobs now wait instead of running on shared scanners |
| Scanner `scanner_type` values from the SDK (`dependency`, `secret_detection`) are normalized; an unknown value is dropped instead of failing with 500 | Custom agents (this fixed scan-session registration) |
| `X-Request-ID` values outside `^[A-Za-z0-9._-]{1,64}$` are replaced | Log correlation tooling |
| IPv6 `::` and `ff00::/8` are always blocked as webhook/integration/scan targets | Rare |
| Heartbeat no longer blanks `version`/`hostname`/IP when an agent omits them | — |
| Tenant security settings no longer return `sso_enabled`, `sso_provider`, `sso_config_url` (dead fields) | Scripts reading them |
| SMTP: TLS 1.2 is the explicit minimum for both mail senders (Go already defaulted to it) | Mail servers that only speak TLS 1.0/1.1 |
| Permissions ETag is SHA-256 (was MD5): each client gets one `200` instead of `304` on its first permissions poll after the upgrade | — |
| Password reset e-mails link to `/reset-password` (was a non-existent `/auth/reset-password`) | — |
| Members (not owners/admins) may get 403 on sensor routes for up to 5 minutes after the migration unless the permission cache is flushed | Handled by the procedure |

### 13. Only the platform administrator creates organizations

`TENANT_CREATION_MODE` now defaults to **`admin_only`**, on new installs and on
upgrades. Only the platform administrator creates organizations: in the console
(*Organizations → Create*) or with `bootstrap-admin -org-name … -org-owner-email …`.
`POST /api/v1/tenants` and `POST /api/v1/auth/create-first-team` answer **403**,
the UI no longer offers *Create team*, and a signed-in user who belongs to no
organization sees *ask your administrator* instead of the *Create Team* page.
Existing organizations, their owners and members are not affected.

`self_service` (the v0.8 behaviour: any signed-in user may create organizations
and becomes their owner) is now an explicit opt-in for SaaS and trial installs.

**Affected:** installations where users create their own organizations or
teams, and scripts that call `POST /tenants` or `/auth/create-first-team`.
**Before:** decide. To keep self-service creation, set
`TENANT_CREATION_MODE=self_service` (Helm: `api.tenantCreationMode: self_service`).
**After:** nothing, unless you kept self-service.

The first-organization tooling changes with it:

- `bootstrap-admin` gains optional `-org-name`, `-org-slug`, `-org-owner-email`
  and `-org-owner-name` (or `ORG_NAME`, `ORG_SLUG`, `ORG_OWNER_EMAIL`,
  `ORG_OWNER_NAME`). Name and owner email go together. The organization is
  created through the audited organization service; its owner gets a one-time
  set-password link (valid 24 hours), emailed when SMTP is configured,
  otherwise printed once. Re-running skips existing administrators and an
  existing organization with the same slug. The owner must not be a platform
  administrator's address.
- `bootstrap-tenant` (raw SQL, no audit, ignored `TENANT_CREATION_MODE`) is
  **removed** from the API image.
- Helm: `api.bootstrapTenant` is **removed**, and the chart refuses to render
  with `api.bootstrapTenant.enabled=true`; use `api.bootstrapAdmin.org.*`. New
  value `api.tenantCreationMode` (default `admin_only`). The bootstrap-admin Job
  is now kept after it succeeds so its one-time credentials can be read
  (`kubectl logs job/<fullname>-api-bootstrap-admin`, then `kubectl delete` it),
  a failed Job fails the install instead of being ignored, and the Job gets
  `api.extraEnv` / `api.extraEnvFrom` (for `SMTP_*`).

## Configuration changes

### API

| Variable | v0.8 | v0.9.0 | Action |
|---|---|---|---|
| `AUTH_ALLOW_REGISTRATION` | default `true` | default **`false`** | Set `true` only for an open instance. **If your env file sets `true` explicitly (many copies of the old examples do), registration stays open** — remove or change it. |
| `SERVER_TRUSTED_PROXIES` | optional | **recommended**: the UI's address/network | Without it the API sees the UI's IP for every browser request: login rate limits (5/min) become one bucket for everyone, the IP allowlist cannot work, audit logs record the UI's IP. |
| `APP_ENCRYPTION_KEY` | required in production | required; also encrypts TOTP secrets | Keep the same value. |
| `TENANT_CREATION_MODE` | — (behaved as `self_service`) | new, default **`admin_only`**; or `self_service` | Set `self_service` only to keep users creating organizations ([item 13](#13-only-the-platform-administrator-creates-organizations)). Helm: `api.tenantCreationMode`. An invalid value fails startup. |
| `SSO_ENTRA_DEFAULT_ROLE` | default `member` | default **`viewer`** | Set it if JIT users should be members. |
| `AGENT_CONFIG_TEMPLATES_DIR`, `AGENT_PUBLIC_API_URL`, `AGENT_KEY_TTL`, `AGENT_LB_*` | | renamed `SENSOR_*` | Old names still work with `WARN deprecated configuration`; the API refuses to start only if old and new are both set and differ. Rename when convenient — table in [the sensor guide](upgrade-agent-to-sensor.md#step-1--upgrade-the-platform). |
| `CORS_ALLOWED_HEADERS` default | included `X-Admin-API-Key` | no longer does | Remove it if you set the list yourself. |
| `AUTH_COOKIE_SECURE` | default `false` | default **`true`** unless `APP_ENV=development`; production refuses `false` for every auth provider (v0.8 only refused it for local/hybrid) | Nothing to do behind HTTPS. **A non-development stack served over plain `http://` must set `false`**, or browsers drop the session cookies and nobody can stay signed in. All session, CSRF, tenant, admin console and 2FA cookies follow it. |

No new variable is required: a v0.8 env file starts v0.9.0 as is, apart from the
registration and organization-creation defaults and, for a staging stack on
plain `http://`, `AUTH_COOKIE_SECURE=false`.

### UI

| Variable | Action |
|---|---|
| `TRUST_PROXY_HEADERS` (new, default `false`) | Set `true` **only** when a reverse proxy in front of the UI overwrites `X-Real-IP` / `X-Forwarded-For`; pair it with `SERVER_TRUSTED_PROXIES` on the API. The bundled `nginx.conf` now overwrites `X-Forwarded-For` instead of appending. |

## Removed endpoints and tools

| Removed | Replacement |
|---|---|
| `X-Admin-API-Key` / Bearer admin keys on `/api/v1/admin/*` | Console session (`/login` → TOTP) |
| `POST /api/v1/admin/users` (create admin by key) | `POST /api/v1/admin/administrators` (console, super admin) or `bootstrap-admin` |
| `POST /api/v1/admin/users/{id}/rotate-key` | — (no keys) |
| `openctem-admin` CLI (binary, release assets, CI build) | Admin console; the `admin-cli` image now contains only `bootstrap-admin` |
| `bootstrap-tenant` CLI (`/app/bootstrap-tenant`) and the Helm `api.bootstrapTenant` Job | `bootstrap-admin -org-name … -org-owner-email …` / Helm `api.bootstrapAdmin.org.*`, or *Organizations → Create* in the console |
| `/api/v1/settings/saml` (GET, PUT) | `/api/v1/admin/tenants/{tenantId}/sso/saml` |
| `/api/v1/settings/identity-providers` (+ `/{id}`) | `/api/v1/admin/tenants/{tenantId}/sso/identity-providers` |
| `/api/v1/settings/verified-domains` (+ `/{id}/verify`) | `/api/v1/admin/tenants/{tenantId}/sso/verified-domains` |
| `/api/v1/agents/*` | `/api/v1/sensors/*` (old path answers 308 until 2027-04-01) |
| `sso_enabled`, `sso_provider`, `sso_config_url` in tenant security settings | — (were never used) |

New endpoints (selection): `/api/v1/users/me/2fa*`, `/api/v1/auth/mfa/*`,
`/api/v1/tenants/{tenant}/users` (+ `/{userId}/setup-link`),
`/api/v1/admin/auth/{session,mfa,logout,password,idp*}`,
`/api/v1/admin/administrators`, `/api/v1/admin/tenants*`,
`/api/v1/admin/platform-idp`, `/api/v1/admin/users/{id}/{reset-credentials,break-glass-test,idp-binding}`.

---

## Pre-upgrade checklist

### 1. Check the version and the migration state

```bash
curl -s https://<api-host>/health
# Compose
docker compose exec postgres psql -U openctem -d openctem -c \
  "SELECT version, dirty FROM schema_migrations;"
```

Expect `224 | f`. If `dirty` is `t`, a previous migration failed half-way:
fix that first ([Upgrade Guide → Migration Stuck or Dirty](upgrade-guide.md#migration-stuck-or-dirty)).
If the version is lower than 224 you are not on v0.8.x — see
[Skipping versions](#skipping-versions).

### 2. Back up the database

```bash
docker compose exec -T postgres pg_dump -U openctem -d openctem --format=custom \
  > pre-v0.9-$(date +%Y%m%d-%H%M).dump
ls -lh pre-v0.9-*.dump        # non-zero size
pg_restore --list pre-v0.9-*.dump | head   # readable (any host with pg_restore)
```

See [Backup & Restore](backup-restore.md) for off-site copies. This backup is
the only way back for data the down migrations cannot restore (see
[Rollback](#rollback)).

### 3. Run the inventory queries

Read-only. They tell you which breaking changes apply. Save the output; you
will compare after the upgrade.

```bash
docker compose exec -T postgres psql -U openctem -d openctem < v0.9-inventory.sql
```

<details markdown="1">
<summary><code>v0.9-inventory.sql</code> (click to expand)</summary>

```sql
-- OpenCTEM v0.8.x -> v0.9.0 pre-upgrade inventory. Read-only.
-- Run against the v0.8.x database BEFORE upgrading.

\echo '== 0. Schema version (expect 224, dirty = f)'
SELECT version, dirty FROM schema_migrations;

\echo '== 1. Self-registration in use? Local accounts created recently, and whether they were invited (registration is OFF by default from v0.9)'
SELECT date_trunc('month', u.created_at)::date AS month, count(*) AS local_accounts,
       count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM tenant_members m WHERE m.user_id = u.id AND m.invited_by IS NOT NULL)) AS not_via_invitation
FROM users u WHERE u.auth_provider = 'local' AND u.created_at > now() - interval '180 days'
GROUP BY 1 ORDER BY 1;

\echo '== 2. Custom roles granting agents:* (converted to sensors:* by 000230)'
SELECT t.slug AS org, r.slug AS role, string_agg(rp.permission_id, ', ' ORDER BY rp.permission_id) AS agent_permissions
FROM roles r JOIN role_permissions rp ON rp.role_id = r.id
LEFT JOIN tenants t ON t.id = r.tenant_id
WHERE rp.permission_id LIKE 'agents:%' AND NOT r.is_system
GROUP BY t.slug, r.slug ORDER BY 1, 2;

\echo '== 3. Groups and permission sets granting agents:*'
SELECT 'group' AS kind, g.name, gp.permission_id FROM group_permissions gp JOIN groups g ON g.id = gp.group_id
WHERE gp.permission_id LIKE 'agents:%'
UNION ALL
SELECT 'permission set', ps.name, psi.permission_id FROM permission_set_items psi JOIN permission_sets ps ON ps.id = psi.permission_set_id
WHERE psi.permission_id LIKE 'agents:%' ORDER BY 1, 2, 3;

\echo '== 4. oct_ API keys with agents:* scopes (scopes converted; scripts that CREATE keys must use sensors:*)'
SELECT t.slug AS org, k.name, k.key_prefix, k.scopes, k.status, k.last_used_at
FROM api_keys k JOIN tenants t ON t.id = k.tenant_id
WHERE EXISTS (SELECT 1 FROM unnest(k.scopes) s WHERE s LIKE 'agents:%') ORDER BY 1, 2;

\echo '== 5. Organizations with an IP allowlist (ENFORCED from v0.9; may lock users out)'
SELECT slug, settings->'security'->'ip_whitelist' AS ip_allowlist
FROM tenants WHERE jsonb_array_length(COALESCE(settings->'security'->'ip_whitelist', '[]')) > 0;

\echo '== 6. Organizations with allowed email domains (ENFORCED from v0.9 for invites, new users, SCIM, SSO JIT)'
SELECT slug, settings->'security'->'allowed_domains' AS allowed_domains
FROM tenants WHERE jsonb_array_length(COALESCE(settings->'security'->'allowed_domains', '[]')) > 0;

\echo '== 7. Organizations with "Require MFA" on (ENFORCED from v0.9: local-password members must enroll TOTP at next sign-in)'
SELECT t.slug, count(m.*) AS members
FROM tenants t LEFT JOIN tenant_members m ON m.tenant_id = t.id
WHERE (t.settings->'security'->>'mfa_required')::boolean IS TRUE GROUP BY t.slug;

\echo '== 8. SSO providers with just-in-time provisioning but NO verified domain (JIT refused from v0.9)'
SELECT t.slug AS org, 'oidc:' || p.provider AS provider, p.display_name, p.allowed_domains
FROM tenant_identity_providers p JOIN tenants t ON t.id = p.tenant_id
WHERE p.is_active AND p.auto_provision
  AND NOT EXISTS (SELECT 1 FROM verified_domains d WHERE d.tenant_id = p.tenant_id AND d.status = 'verified')
UNION ALL
SELECT t.slug, 'saml', s.idp_entity_id, s.allowed_domains
FROM saml_providers s JOIN tenants t ON t.id = s.tenant_id
WHERE s.enabled AND s.auto_provision
  AND NOT EXISTS (SELECT 1 FROM verified_domains d WHERE d.tenant_id = s.tenant_id AND d.status = 'verified')
ORDER BY 1;

\echo '== 9. Organizations that set SSO enforcement themselves (now only the platform admin can change it)'
SELECT slug FROM tenants WHERE (settings->'security'->>'sso_enforced')::boolean IS TRUE;

\echo '== 10. Platform admins and their API keys (all keys are REVOKED by 000227; every one of these rows is DEACTIVATED)'
SELECT a.email, a.role, a.is_active, a.last_used_at,
       EXISTS (SELECT 1 FROM users u WHERE lower(u.email) = lower(a.email)) AS email_has_user_account
FROM admin_users a ORDER BY a.role, a.email;

\echo '== 11. Webhooks / notification integrations subscribed to agent.offline / agent.error (converted to sensor.*)'
SELECT 'webhook' AS kind, t.slug, w.name, w.event_types::text AS events FROM webhooks w JOIN tenants t ON t.id = w.tenant_id
WHERE w.event_types && ARRAY['agent.offline', 'agent.error']
UNION ALL
SELECT 'notification', t.slug, i.name, e.enabled_event_types::text
FROM integration_notification_extensions e JOIN integrations i ON i.id = e.integration_id JOIN tenants t ON t.id = i.tenant_id
WHERE e.enabled_event_types ?| ARRAY['agent.offline', 'agent.error'];

\echo '== 12. Tenable integrations running through an agent (execution_mode agent -> sensor)'
SELECT t.slug, i.name, i.config->>'execution_mode' AS execution_mode, i.config->>'agent_id' AS agent_id
FROM integrations i JOIN tenants t ON t.id = i.tenant_id
WHERE i.provider = 'tenable' AND i.config->>'execution_mode' = 'agent';

\echo '== 13. Agents (sensors) and their last heartbeat'
SELECT t.slug AS org, a.name, a.type, a.status, a.health, a.version, a.last_seen_at
FROM agents a LEFT JOIN tenants t ON t.id = a.tenant_id ORDER BY 1, 2;

\echo '== 14. Commands still in flight (let them finish or expect them to be re-queued/expired)'
SELECT status, count(*) FROM commands WHERE status IN ('pending', 'acknowledged', 'running') GROUP BY status;

\echo '== 15. Database size (plan disk for the backup)'
SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size;
```

</details>

What to do with each result:

| Query | If it returns rows |
|---|---|
| 1 | Accounts that were not invited → people sign themselves up. Decide on `AUTH_ALLOW_REGISTRATION` ([item 1](#1-self-registration-is-off-by-default)). |
| 2, 3, 4 | Converted automatically. Find the scripts that create such roles/keys and switch them to `sensors:*`. |
| 5 | **Act before upgrading** ([item 6](#6-allowed-email-domains-and-the-ip-allowlist-are-enforced)): configure the proxy chain or clear the list. |
| 6 | Make sure the list covers every domain you invite from. |
| 7 | Warn members ([item 7](#7-require-two-factor-authentication-is-enforced)). |
| 8 | Verify the domain, or JIT stops admitting new users ([item 5](#5-sso-just-in-time-provisioning-needs-a-dns-verified-domain)). |
| 9 | Nothing to do; only the platform admin can change it afterwards. |
| 10 | Every row is deactivated and its key revoked. Rows with `email_has_user_account = f` can be revived with `bootstrap-admin -link`; for the others pick new addresses. |
| 11, 12 | Converted automatically; SIEM rules matching `agent.*` need `sensor.*` too. |
| 13 | Note the sensors and their last heartbeat; compare after the upgrade. |
| 14 | Let in-flight commands finish, or accept they may fail and be re-run. |
| 15 | You need at least this much free disk for the backup, plus the new images (~1 GB). |

### 4. Check disk space

```bash
df -h /var/lib/docker .     # keep >= 20 % free: Postgres stops if the disk fills
```

### 5. Prepare configuration

- Decide registration (`AUTH_ALLOW_REGISTRATION`); check your env file does not
  set `true` by accident.
- Decide organization creation: keep the new `admin_only` default, or set
  `TENANT_CREATION_MODE=self_service` if users must keep creating organizations.
- Helm: remove `api.bootstrapTenant` from your values (the chart no longer
  renders with it enabled).
- Staging or test stacks served over plain `http://` (not `APP_ENV=development`):
  set `AUTH_COOKIE_SECURE=false`, otherwise sign-in silently fails.
- If any organization uses an IP allowlist, set up the proxy chain
  (`SERVER_TRUSTED_PROXIES` + `TRUST_PROXY_HEADERS`) or clear the lists.
- Pick the two administrator emails (no existing account).
- Optional: rename `AGENT_*` API settings to `SENSOR_*`.

### 6. Tell people

Organization owners: SSO changes now go through the platform administrator; IP
allowlists and Require-2FA become real; members may be asked to enroll an
authenticator. Script owners: `/api/v1/agents` redirects, `agents:*` →
`sensors:*`, `execution_mode: agent` is rejected.

---

## Upgrade procedure — Docker Compose

The API and the database must change together: the v0.9.0 API refuses to start
on a schema older than 000230, and the v0.8 API fails on the renamed schema.
**Stop the API, migrate, start the new API and UI**, back to back. Expect 5–10
minutes of downtime; the migrations themselves take seconds (000230 renames
tables and rewrites stored values, all in one transaction).

The commands assume the production compose layout with services `postgres`,
`redis`, `migrate`, `api`, `ui` and versions in an env file. Set `DC` to the way
you normally call compose, for example:

```bash
cd /opt/openctem
DC="docker compose -f docker-compose.prod.yml --env-file .env.versions.prod"
# (the API's docker-compose.prod.yml names the API service `app`;
#  replace `api` with `app` below if you use it)
# (that file is api/docker-compose.prod.yml in the openctem repository now)
```

**1. Set the new versions and configuration.**

```bash
cp .env.versions.prod .env.versions.prod.backup-$(date +%Y%m%d)
# .env.versions.prod
API_VERSION=v0.9.0
MIGRATIONS_VERSION=v0.9.0
UI_VERSION=v0.9.0
```

Apply the [configuration changes](#configuration-changes) to your API and UI
env files.

{: .note }
v0.9.0 is the first release from the merged
[openctemio/openctem](https://github.com/openctemio/openctem) repository, and
its images have new names: `ghcr.io/openctemio/openctem-api` and
`ghcr.io/openctemio/openctem-web`. The old names `ghcr.io/openctemio/api` and
`ghcr.io/openctemio/ui` still receive identical copies of v0.9.0 and the next
release, so a compose file that uses them keeps working; switch to the new
names during this upgrade (see [Images](upgrade-guide.md#images)).

**2. Pull the images** (no downtime yet; v0.9.0 images are about 700 MB in total):

```bash
$DC pull migrate api ui
```

**3. Stop the UI and the API.** Sensors deployed in your network keep running;
they retry until the API is back.

```bash
$DC stop ui api
```

**4. Apply migrations 000225 → 000230.**

```bash
$DC run --rm migrate
$DC exec postgres psql -U openctem -d openctem -c \
  "SELECT version, dirty FROM schema_migrations;"      # expect 230 | f
```

The `migrate` service prints one line per migration (`225/u admin_console_auth`
… `230/u rename_agent_to_sensor`).

**5. Check the database upgrade** (before starting the API):

```bash
$DC run --rm --no-deps api -sensor-upgrade-check
```

Expect every line `ok` or `kept`, the last line *Upgrade complete*, exit code 0.
`LEFTOVER` lines mean 000230 did not convert something: do not continue; see
[Troubleshooting](#troubleshooting).

**6. Flush the permission cache.** Cached permission sets still hold `agents:*`
for up to 5 minutes; without this, members are refused sensor pages until it
expires.

```bash
$DC exec redis sh -c 'redis-cli --no-auth-warning -a "$0" --scan --pattern "user_perms:*" \
  | xargs -r redis-cli --no-auth-warning -a "$0" DEL' "$REDIS_PASSWORD"
```

(`REDIS_PASSWORD` is the password in your env file; drop both `-a "$0"` if
Redis has none.)

**7. Start the API**, then the UI:

```bash
$DC up -d api        # also re-runs the one-shot migrate service: a no-op now
$DC ps api           # healthy
$DC logs --since 5m api | grep -E 'level=(ERROR|WARN)'
$DC up -d ui
```

Expected warnings: `deprecated configuration` for each `AGENT_*` setting you
have not renamed yet. There must be no `ERROR` and no `pre-sensor vocabulary
left after upgrade`.

Then continue with [After the upgrade](#after-the-upgrade).

## Upgrade procedure — Kubernetes / Helm

The chart's migration Job is a `pre-upgrade` hook, so `helm upgrade` migrates
before the new pods start — but the **old API pods keep serving during the
migration and fail on the renamed schema**. Scale the API to zero first.

**1. Use a chart whose `appVersion` is `v0.9.0`**, or pin every image (the
chart defaults image tags to its `appVersion`):

```bash
helm repo update
helm search repo openctemio/openctem --versions | head -3
```

If the newest chart still says `appVersion v0.8.0`, add
`--set api.image.tag=v0.9.0 --set api.migrations.image.tag=v0.9.0 --set ui.image.tag=v0.9.0`
below.

**2. Set configuration** in your values (examples):

```yaml
api:
  extraEnv:
    - name: AUTH_ALLOW_REGISTRATION   # only for an open, self-signup instance
      value: "true"
  # tenantCreationMode: self_service  # only to keep users creating organizations (default admin_only)
    - name: SERVER_TRUSTED_PROXIES    # the UI pods' network
      value: "10.42.0.0/16"
ui:
  extraEnv:
    - name: TRUST_PROXY_HEADERS       # only behind an ingress that overwrites X-Forwarded-For
      value: "true"
```

**3. Back up**, then **scale the API (and UI) to zero**:

```bash
NS=openctem; REL=openctem; FN=openctem   # FN: see step 4
kubectl -n $NS scale deploy -l app.kubernetes.io/instance=$REL,app.kubernetes.io/component=api --replicas=0
kubectl -n $NS scale deploy -l app.kubernetes.io/instance=$REL,app.kubernetes.io/component=ui  --replicas=0
```

An HPA does not scale a deployment up from zero, and `helm upgrade` restores
the replica count.

**4. Upgrade:**

```bash
helm upgrade $REL openctemio/openctem -n $NS -f values.yaml --wait --timeout 15m
# while it waits: the migration Job prints 225/u … 230/u (it is deleted on success)
kubectl -n $NS logs -f job/$FN-api-migrations
```

`$FN` is the chart's full name: the release name when it contains `openctem`
(`openctem` → `openctem-api`, `openctem-api-migrations`), otherwise
`<release>-openctem`. `kubectl -n $NS get deploy,job` shows the real names.

**5. Check and flush:**

```bash
kubectl -n $NS exec deploy/$FN-api -- ./server -sensor-upgrade-check
# bundled Redis (bitnami): the pod has REDIS_PASSWORD set
kubectl -n $NS exec $FN-redis-master-0 -- sh -c 'redis-cli --no-auth-warning -a "$REDIS_PASSWORD" --scan --pattern "user_perms:*" | xargs -r redis-cli --no-auth-warning -a "$REDIS_PASSWORD" DEL'
```

The chart's bootstrap-admin Job is a **post-install** hook: it does not run on
`helm upgrade`. Create the administrators by hand ([Step A](#step-a--create-the-platform-administrators)).
On new installs the Job now needs `api.bootstrapAdmin.backupEmail` (or
`noBackup: true`), can create the first organization (`api.bootstrapAdmin.org.*`),
and is kept after it succeeds: read its log, then delete it.

## After the upgrade

### Step A — Create the platform administrators

v0.8 admins are deactivated by the upgrade, so do this now. Use two addresses
with **no existing account**:

```bash
# Compose
$DC exec api ./bootstrap-admin -email=secops-admin@example.com -backup-email=breakglass@example.com
# Kubernetes
kubectl -n $NS exec deploy/$FN-api -- ./bootstrap-admin -email=… -backup-email=…
```

It prints a temporary password for each, once. Store the break-glass one
offline. Then, for each administrator:

1. Sign in on `/login` with the email and temporary password; you are sent to
   the console.
2. Set a new password (required before anything else).
3. Sign in again; scan the QR code with an authenticator app and enter the code.

Re-running `bootstrap-admin` skips administrators that already exist, so it is
safe to add a backup later (`-email=<existing> -backup-email=<new>`).

To revive a **v0.8 administrator** (same email and role) instead of creating a
new one: `./bootstrap-admin -email=<old admin> -link`. It prints a temporary
password and `Status: reactivated`. A plain run with an old administrator's
email is refused with a pointer to `-link`; an email that already belongs to an
account (for example an organization owner) cannot be linked — use a new
address.

### Step B — Re-enable what the organizations need

- IP allowlists cleared before the upgrade: once `SERVER_TRUSTED_PROXIES` and
  `TRUST_PROXY_HEADERS` are set, owners re-enter them (check *Your current IP*
  first).
- SSO changes requested by owners: the platform admin makes them in
  *Admin console → Organizations → org → Single sign-on*.
- Optional: *System → Admin sign-in* to put administrators on your IdP; confirm
  a break-glass test sign-in.

### Step C — Update integrations

Scripts on `/api/v1/agents`, roles/keys created with `agents:*`, Tenable
`execution_mode`, SIEM rules on `agent.*`, dashboards on `agent_*` metrics:
[Upgrading to the Sensor release → Step 2](upgrade-agent-to-sensor.md#step-2--update-integrations).

## Verification checklist

Run as an owner, a member and a viewer of one organization:

- [ ] `curl -s https://<api>/health` → `healthy`; `schema_migrations` = `230 | f`.
- [ ] `./server -sensor-upgrade-check` exits 0.
- [ ] No `ERROR` in the API log since the start: `$DC logs --since 30m api | grep level=ERROR` prints nothing.
- [ ] Each person still signs in and sees the same things (assets, findings,
      scans; *Settings → Sensors* for those who saw *Agents* before; a viewer
      still cannot create a sensor).
- [ ] A deployed sensor (agent) still shows *online* and completes a job.
- [ ] `curl -s -o /dev/null -D - -H "Authorization: Bearer <token>" https://<api>/api/v1/agents`
      → `308`, `Location: /api/v1/sensors`.
- [ ] Registration is refused: `curl -s -X POST https://<api>/api/v1/auth/register -H 'Content-Type: application/json' -d '{"email":"probe@example.com","password":"Probe-Passw0rd!","name":"x"}'`
      → `403` (unless you kept it open), and `/login` shows no *Sign up*.
- [ ] Administrators sign in on `/login` and reach `/admin` after the TOTP step;
      *Administrators* lists both, one marked break-glass.
- [ ] Organization creation matches your choice: with `admin_only` (default),
      `POST /api/v1/tenants` as an organization owner returns `403` and only
      *Organizations → Create* in the console works.
- [ ] A user can enroll 2FA in *My account → Security*.
- [ ] Organizations with an IP allowlist: an owner is not refused, and
      *Settings → Security* shows their real IP.
- [ ] `oct_` keys and MCP clients still work.

## Rollback

Prefer **restoring the pre-upgrade backup** if the upgrade has just failed: it
is exact. Use the down migrations when you must keep data written since the
upgrade. All six down migrations were tested (up → down to 224 → up, on a
database with real v0.8 data); the schema after the round trip is identical to
the v0.8 schema.

**What the down migrations cannot give back:**

| Down migration | Loses |
|---|---|
| 230 → 229 | Nothing: every renamed table, column, permission, scope, module, event type and setting is renamed back. Audit rows written after the upgrade keep `sensor.*` (history is never rewritten; v0.8 shows them as unknown actions). |
| 229 → 228 | Platform IdP configuration, break-glass markers, admin session auth method, admin audit severity. |
| 228 → 227 | **Every user's 2FA enrollment and recovery codes.** |
| 227 → 226 | Admin keys are **not** restored and admins stay deactivated (see below). |
| 226 → 225 | The link between administrators and their sign-in accounts. The accounts stay as users in no organization. |
| 225 → 224 | Console credentials and sessions. |

**Compose:**

```bash
$DC stop ui api
# down migrations must come from the v0.9.0 image (v0.8 does not have them)
$DC run --rm migrate -path=/migrations \
  -database "postgres://openctem:${DB_PASSWORD}@postgres:5432/openctem?sslmode=require" down 6
# (use the same user, database and sslmode as your migrate service)
$DC exec postgres psql -U openctem -d openctem -c "SELECT version, dirty FROM schema_migrations;"   # 224 | f
cp .env.versions.prod.backup-YYYYMMDD .env.versions.prod      # back to v0.8.x
$DC exec redis sh -c 'redis-cli --no-auth-warning -a "$0" --scan --pattern "user_perms:*" | xargs -r redis-cli --no-auth-warning -a "$0" DEL' "$REDIS_PASSWORD"
$DC up -d api ui
```

**Helm:** run the down Job from the **v0.9.0** release *before* rolling the
chart back (`helm rollback` never touches the schema):

```bash
kubectl -n $NS scale deploy -l app.kubernetes.io/instance=$REL,app.kubernetes.io/component=api --replicas=0
kubectl -n $NS scale deploy -l app.kubernetes.io/instance=$REL,app.kubernetes.io/component=ui  --replicas=0
# render ONLY the down Job from the v0.9.0 chart and values, and apply it
helm template $REL openctemio/openctem -n $NS -f values.yaml --version <v0.9.0 chart> \
  --set api.migrations.image.tag=v0.9.0 \
  --set api.migrations.downMigration.enabled=true --set api.migrations.downMigration.steps=6 \
  --show-only templates/api-migrations-down-job.yaml | kubectl -n $NS apply -f -
kubectl -n $NS wait --for=condition=complete job/$FN-api-migrations-down --timeout=10m
kubectl -n $NS logs job/$FN-api-migrations-down        # 230/d … 225/d
kubectl -n $NS delete job/$FN-api-migrations-down
helm rollback $REL <revision-before-the-upgrade> -n $NS --wait
```

(Do not enable the down Job with `helm upgrade`: that also starts the v0.9.0
API pods again while the schema goes down.)

**Platform admins after a rollback:** the v0.8 admin keys stay revoked and the
rows inactive. Create a new v0.8 admin key with the **v0.8** `bootstrap-admin`:
`bootstrap-admin -email=<new address> -role=super_admin` (or `-force` with an
old address to replace that row).

**Upgrading again after a rollback:** the 226 down migration drops the link
between administrators and their accounts, so on the next upgrade 000227
deactivates the administrators you created in v0.9.0, and their accounts block
re-creating them (`an account with email … already exists`). Before running
`bootstrap-admin` again, delete those accounts (they belong to no organization),
then re-create both administrators with `-force`:

```sql
DELETE FROM users u
 WHERE lower(u.email) IN ('<admin email>', '<break-glass email>')
   AND NOT EXISTS (SELECT 1 FROM tenant_members m WHERE m.user_id = u.id);
```

```bash
$DC exec api ./bootstrap-admin -email=<admin email> -backup-email=<break-glass email> -force
```

**Sensors** need nothing: they speak the same protocol to both versions.

## Skipping versions

Migrations apply in order, so upgrading from an older release straight to
v0.9.0 works, but you take every older release's breaking changes at once.

- **From v0.7.x:** also read the v0.8.0 release notes; migrations 000214–000224
  run first. The inventory queries are written for the v0.8 schema; they are
  read-only, so run them anyway and treat a query that errors as not applicable.
- **From v0.6.x or older:** read each release's notes. Run
  `api/scripts/preflight-migrate.sh --check-only` from the openctem repository against
  the database first: migrations 000170 and 000171 validate existing data and
  fail half-way on violations. `000194_widen_epss_percentile` rewrites a large
  table under an exclusive lock; size the window for it.
- **Builds of `develop` between v0.8.0 and v0.9.0:** if you set
  `PLATFORM_ADMIN_EMAILS`, remove it (no longer read); administrators created
  with the console password flow need `bootstrap-admin -email=<email> -link`.

## Not in v0.9.0 yet

These ship later; this page will gain a section for each when they do.

- **Scan zones** (RFC-023 Phase 1): routing scans to sensors by network zone.
  *If included in v0.9.0: add migration numbers, the zone set-up step and its
  verification here.*
- **The new sensor binary, images and Helm `sensor.*` values** (renamed
  `openctemio/agent`) and the renamed SDK: a later sensor release.
  [Upgrading to the Sensor release → Step 3](upgrade-agent-to-sensor.md#step-3--upgrade-sensors-when-the-new-sensor-release-ships)
  describes it. Agent v0.2.x keeps working with v0.9.0.
- Console pages for target mappings, scanning and diagnostics (the admin
  target-mapping API remains, behind a console session).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| API restarts with `database schema is behind` | Migrations not applied | Step 4, then start the API |
| `migrate` reports `Dirty database version 2xx` | A migration failed half-way | Read its log; fix; `UPDATE schema_migrations SET dirty=false` only after checking what applied; re-run. 000230 is idempotent and safe to re-run. |
| `-sensor-upgrade-check` prints `LEFTOVER` | Data written by an old API after the migration, or a partial manual run | Stop every v0.8 API, re-run `migrate up` (000230 re-applies cleanly), re-check |
| API refuses to start: `deprecated configuration` conflict | `AGENT_X` and `SENSOR_X` both set to different values | Keep only `SENSOR_X` |
| Everyone in one organization gets `403 IP_NOT_ALLOWED` | IP allowlist enforced, API sees the UI's IP | Recovery SQL in [item 6](#6-allowed-email-domains-and-the-ip-allowlist-are-enforced), then configure the proxy chain |
| Everybody hits `429` on login | All logins share the UI's IP bucket | Set `SERVER_TRUSTED_PROXIES` (+ `TRUST_PROXY_HEADERS` behind a proxy) |
| Members see *Sensors* forbidden | Permission cache, or UI and API on different versions | Step 6; upgrade both to v0.9.0 |
| `bootstrap-admin`: `an account with email … already exists` | Administrators get a new, dedicated account | Use another address |
| `bootstrap-admin`: `admin_users still requires an API key` | Run before migrating | Apply migrations first |
| Administrator stuck on *change password* | Temporary password gate | Change it in the console form, sign in again |
| Lost TOTP for every administrator | | Sign in with the break-glass account; or `bootstrap-admin -email=<new> -no-backup` from the server |
| SSO users no longer get accounts | Domain not DNS-verified, or outside allowed domains | [Item 5](#5-sso-just-in-time-provisioning-needs-a-dns-verified-domain) |
| Saving a Tenable integration: `invalid execution_mode` | A client still sends `"agent"` | Send `"sensor"` |
