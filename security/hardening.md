---
title: Production hardening
parent: Security
nav_order: 2
---

# Production hardening checklist

Work through this list before you expose an installation to users. Every item names the real
setting; defaults are the values in the API code unless the row says otherwise. The bundled
production compose file (`api/deploy/docker-compose.yml` with `api/deploy/.env.example`) already
applies most of them; the checklist tells you what to confirm.

## Run in production mode

Keep `APP_ENV=production`. It is also the API's default when the variable is unset, so an image
started without configuration runs the checks below and refuses to start until they pass. The
checks run **only** when the value is `production` (or unset): any other value, such as `staging`,
skips them, and `development` also accepts the published development secrets. The bundled compose
file and the Helm chart set `production`.

Run `server -check-config` before each deploy to see the first problem without starting the API
(see [Check the configuration without starting](../configuration/environment-variables.md#check-the-configuration-without-starting)).

In production mode the API refuses to start when:

- `AUTH_JWT_SECRET` is shorter than 64 characters or is a known development value;
- `APP_ENCRYPTION_KEY` is missing, malformed or the known development value;
- `FINGERPRINT_KEY` is missing or shorter than 32 characters (required in every environment except
  `development`);
- `AUTH_COOKIE_SECURE` is not `true`, or `AUTH_COOKIE_SAMESITE` is not `strict`, `lax` or `none`;
- `CORS_ALLOWED_ORIGINS` contains `*`;
- `DB_SSLMODE` is `disable`;
- `REDIS_PASSWORD` is shorter than 32 characters, `REDIS_TLS_ENABLED` is not `true`, or
  `REDIS_TLS_SKIP_VERIFY` is `true`;
- the Redis pool size is outside 10 to 500;
- `RATE_LIMIT_ENABLED` is `false`, `APP_DEBUG` is `true` or `LOG_LEVEL` is `debug`;
- with local accounts: `AUTH_PASSWORD_MIN_LENGTH` is below 8 or `AUTH_REQUIRE_EMAIL_VERIFICATION`
  is not `true`;
- with an OAuth social provider enabled: `OAUTH_STATE_SECRET` is missing;
- `SIGNUP_MODE=open` without the Turnstile keys (`CAPTCHA_TURNSTILE_SECRET`,
  `CAPTCHA_TURNSTILE_SITE_KEY`) or `SIGNUP_CAPTCHA=off-i-understand`, and `SIGNUP_MODE=domain` or
  `open` without the platform e-mail configured.

A failed start prints the reason; fix the setting rather than working around the check.

## Generate the secrets

Generate every secret fresh for each installation. Never reuse the example values. A secret that
still holds example-file text (`openssl rand -hex 32`, `<CHANGE_ME...>`, `changeme`) is refused at
start-up in every environment, with a message naming the variable.

| Secret | Generate with | Notes |
|---|---|---|
| `APP_ENCRYPTION_KEY` | `openssl rand -hex 32` | 32 bytes (64 hex, 44 base64 or 32 raw characters). Encrypts stored credentials and keys hashes of API keys, SCIM tokens and sensor keys. Losing it makes stored secrets unreadable; see [Encryption key](#protect-and-rotate-the-encryption-key). |
| `FINGERPRINT_KEY` | `openssl rand -hex 32` | At least 32 characters. Keys the identity of every secret finding. Never rotate it with the encryption key. On an installation that already stores secret findings, set it to the current `APP_ENCRYPTION_KEY` value. Back it up with the database. |
| `AUTH_JWT_SECRET` | `openssl rand -hex 64` | At least 64 characters in production. Changing it signs everyone out. |
| `DB_PASSWORD`, `DB_MIGRATE_PASSWORD`, `DB_SUPERUSER_PASSWORD` (and `DB_ADMIN_PASSWORD` if you set `DB_ADMIN_USER`) | `openssl rand -hex 24` | All different. The API does not check database password strength. |
| `REDIS_PASSWORD` | `openssl rand -hex 24` | At least 32 characters in production. |
| `METRICS_TOKEN` | `openssl rand -hex 32` | Only if you scrape `/metrics` (section 9). |
| `OAUTH_STATE_SECRET` | `openssl rand -hex 32` | Only if you enable a social login provider. |

Optional: `APP_TEMPLATE_SIGNING_KEY` and `SENSOR_KEY_PEPPER` are derived from `APP_ENCRYPTION_KEY`
when unset. Set them only if you want them independent; `APP_TEMPLATE_SIGNING_KEY` must differ from
the encryption key.

Keep secrets in a file readable only by the service account (`chmod 600 .env`) or in your
platform's secret store (Kubernetes Secrets, a vault). With Helm in production, the chart refuses to
render if it would have to generate `APP_ENCRYPTION_KEY` or `AUTH_JWT_SECRET` itself: supply them.

## Terminate TLS in front of the API

The API and the web console serve plain HTTP inside the deployment; TLS ends at the gateway (Caddy,
in the compose file) or at your ingress controller.

| Setting (gateway) | Default | Use |
|---|---|---|
| `OPENCTEM_TLS_MODE` | `internal` | `acme` (public certificate, needs `ACME_EMAIL`), `files` (your certificate: `TLS_CERT_DIR`, `TLS_CERT_FILE`, `TLS_KEY_FILE`) or `internal` (Caddy's private CA, for internal installations whose clients trust it). `http` is refused unless `OPENCTEM_ALLOW_PLAIN_HTTP=true`. |
| `OPENCTEM_HOSTNAME`, `OPENCTEM_PUBLIC_URL` | required | The public name and URL. |
| `GATEWAY_BIND`, `GATEWAY_HTTPS_PORT` | `0.0.0.0`, `443` | Bind to a specific address if the host has several. |

In production the API sends `Strict-Transport-Security: max-age=31536000; includeSubDomains`. Do
not run production over plain HTTP: session cookies are `Secure` and will not be sent.

See [TLS and the gateway](../install/tls-and-gateway.md) for the full setup.

## Limit network exposure

- Publish only the gateway: 443, 80 if you use the HTTP-to-HTTPS redirect overlay, and the platform
  console's port (see [Platform console](#platform-console)). In the bundled production compose file
  the web console, the platform console app, the API, PostgreSQL and Redis are not published.
- Never use the development compose files (`api/docker-compose.yml`, `api/docker-compose.dev.yml`)
  in production: they publish PostgreSQL, Redis and a debugger port on all interfaces with
  development credentials.
- The gateway answers `404` for `/ready`, `/metrics` and `/debug/*`. `/health` is public and returns
  only status.
- The API reference (`/docs`, `/openapi.yaml`) is always served and reachable through the gateway.
  It contains no data, but block it at your edge if you do not want to publish the API surface.
- Outbound calls of the API (webhooks, integrations, SMTP) cannot reach private addresses unless you
  list a range in `OPENCTEM_HTTPSEC_ALLOW_PRIVATE_CIDRS`. List only the subnets of the services you
  integrate with: the list applies to every organization. `OPENCTEM_HTTPSEC_ALLOW_PRIVATE=1` (every
  private range) stops the API outside `APP_ENV=development`.
- Sensors using protocol v3 reach the API's mTLS listener (`:9443`) through the gateway: with the
  sensor overlay (`api/deploy/docker-compose.sensor-passthrough.yml`) the gateway passes TLS
  connections that offer the sensor ALPN id through on the main HTTPS port, and can route a
  dedicated sensor host name by SNI. Do not publish `:9443` of the API container directly.
- Sensors only make outbound connections to the platform; they need no inbound access. See
  [Network requirements](../sensors/network.md).
- Restrict SSH and management access to the host, and keep the container runtime and host OS
  patched.

## Platform console

The platform console (organizations, sign-up policy, system settings, platform sensors) is its own
app with its own API listener, served by the gateway on a site of its own and never on the main
site (the main site answers `404` for `/api/v1/admin`).

| Setting | Default | Use |
|---|---|---|
| `OPENCTEM_ADMIN_SITE` | `port` in the compose file | `host` serves the console on its own DNS name (`OPENCTEM_ADMIN_HOST`, recommended for production: a separate origin), `port` on `https://<OPENCTEM_HOSTNAME>:<OPENCTEM_ADMIN_PORT>` (default `8443`), `off` not at all. |
| `OPENCTEM_ADMIN_BIND` | `GATEWAY_BIND` | Publish the console port on one private or VPN address only: a published port is not filtered by the host firewall. |
| `OPENCTEM_ADMIN_ALLOWED_CIDRS` | private networks | Client networks that may reach the console site; everyone else gets `403`. The compose file passes the same list to the API as `ADMIN_ALLOWED_CIDRS`. Open it to the internet only if you must. |
| `ADMIN_LISTEN_ADDR` | `<net>.12:8081` in the compose file | The console API's own internal listener (plain HTTP on the private stack network). |
| `DB_ADMIN_USER`, `DB_ADMIN_PASSWORD` | unset | A separate database role that alone writes the console's identity tables (administrators, console sessions). |

Console sessions last 8 hours at most and end after 15 minutes idle, and every sign-in needs a TOTP
code. Enrol a security key or passkey too, and keep at least two `super_admin` accounts.

## Use least-privilege database roles

Run the API as a role that can only read and write rows, and migrations as a separate schema owner:

| Variable | Role | May |
|---|---|---|
| `DB_SUPERUSER`, `DB_SUPERUSER_PASSWORD` | superuser | only used by the one-shot `db-roles` job |
| `DB_MIGRATE_USER`, `DB_MIGRATE_PASSWORD` | `openctem_migrator` | owns the schema, runs migrations |
| `DB_USER`, `DB_PASSWORD` | `openctem_app` | `SELECT`, `INSERT`, `UPDATE`, `DELETE`; no DDL, no superuser, no `BYPASSRLS`, no server-file access |

The compose file creates and repairs both roles with `deploy/postgres/least-privilege-roles.sql`
whenever `DB_MIGRATE_USER` is set (the production `.env.example` sets it). If `DB_MIGRATE_USER` is
unset, everything connects as `DB_USER`. For an external database, run the script once as a
superuser. The guide with the migration path for existing installations is
[database-roles.md](https://github.com/openctemio/openctem/blob/develop/api/docs/deployment/database-roles.md).

Also:

- `DB_SSLMODE`: use `verify-full` (or at least `require`) for an external database. The bundled
  PostgreSQL runs TLS with a private CA created by the `datastore-tls` job.
- Do not publish PostgreSQL to untrusted networks.

## Secure Redis

Redis holds session revocations, rate-limit counters, permission caches and job queues.

- Set `REDIS_PASSWORD` (32+ characters) and `REDIS_TLS_ENABLED=true`. For a private CA, set
  `REDIS_TLS_CA_FILE` (client certificates: `REDIS_TLS_CERT_FILE`, `REDIS_TLS_KEY_FILE`). Keep
  `REDIS_TLS_SKIP_VERIFY=false`.
- The bundled Redis listens on TLS only. The Helm chart's bundled Redis cannot do TLS: use a managed
  or external Redis with TLS for production on Kubernetes.
- Without Redis, immediate session revocation is off (revoked access tokens stay valid until they
  expire, 15 minutes by default) and rate limits are per process.

## Protect and rotate the encryption key

`APP_ENCRYPTION_KEY` encrypts integration credentials, SSO client secrets, TOTP secrets and other
stored secrets (AES-256-GCM), and keys the hashes of API keys, SCIM tokens and sensor keys.

- Store it with the same care as the database backups, but **separately** from them: a backup plus
  the key gives back every stored secret.
- Losing it makes those secrets unrecoverable (users must re-enrol 2FA, integrations must be
  reconfigured, tokens re-issued).
- Rotate it with the `rekey` tool and `APP_ENCRYPTION_KEY_PREVIOUS` (a grace list of old keys while
  tokens move to the new key). Follow
  [encryption-key-rotation.md](https://github.com/openctemio/openctem/blob/develop/api/docs/deployment/encryption-key-rotation.md).
  Remove `APP_ENCRYPTION_KEY_PREVIOUS` when `rekey -status` reports zero.

## Cookies, CORS, CSRF and proxies

| Setting | Default | Recommendation |
|---|---|---|
| `AUTH_COOKIE_SECURE` | `true` unless `APP_ENV=development` | Keep `true`. |
| `AUTH_COOKIE_SAMESITE` | `lax` | Keep `lax` (or `strict`). `none` requires `Secure`. |
| `AUTH_COOKIE_DOMAIN` | empty (current host) | Leave empty unless the console and API are on different subdomains. |
| `SECURE_COOKIES` (web) | `true` | Keep `true`. |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | Your public console origin only (the compose file uses `OPENCTEM_PUBLIC_URL`). |
| `SSO_ALLOWED_REDIRECT_URIS` | derived from CORS origins, `OAUTH_FRONTEND_CALLBACK_URL` and `SMTP_BASE_URL` | Set explicitly when you use SSO. Exact match only. |
| `SERVER_TRUSTED_PROXIES` | empty | The addresses of the gateway and the web container, so client IPs are correct for the IP allowlist, rate limits and the audit log. Forwarding headers from any other peer are ignored. |
| `OPENCTEM_TRUSTED_PROXIES` (gateway) | `127.0.0.1/32` | Add your load balancer if one sits in front of the gateway. |
| `TRUST_PROXY_HEADERS` (web) | `false` | `true` only when a proxy that overwrites `X-Forwarded-For` sits in front of the console (as in the compose file). Never when browsers reach the console directly. |

Cookie-authenticated requests carry a double-submit CSRF token (`csrf_token` cookie and
`X-CSRF-Token` header). Requests with a bearer token or API key need none. Every write to the web
console (pre-login forms included) must also be same-origin: keep the gateway passing the
original `Host` (or `X-Forwarded-Host`) to the console, or the console refuses its own forms.

## Rate limits and lockout

| Setting | Default |
|---|---|
| `RATE_LIMIT_ENABLED` | `true` (required in production) |
| `RATE_LIMIT_RPS`, `RATE_LIMIT_BURST` | `100`, `200` per client IP |
| `RATE_LIMIT_READ_PER_MIN` | `120` per user for reads |
| `AUTH_MAX_LOGIN_ATTEMPTS`, `AUTH_LOCKOUT_DURATION` | `5`, `15m` |
| `AUTH_MAX_ACTIVE_SESSIONS` | `10` per user |
| `MAX_CONCURRENT_REQUESTS` | `1000` |

Authentication endpoints have fixed per-IP limits (for example 5 sign-in attempts per minute), stored
in Redis so all replicas share them. API keys have a per-key hourly limit set when the key is
created. Make sure `SERVER_TRUSTED_PROXIES` is right, or every user appears to come from the
gateway's address and shares one bucket.

## Security headers

The API always sends `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy: default-src 'none';
frame-ancestors 'none'`, a `Permissions-Policy` and `Cache-Control: no-store`. The web console sends
a per-request nonce-based Content Security Policy, frame denial and the same referrer and content-type
headers. The gateway removes `Server` and `Via`. No configuration is needed; if you add your own
proxy, do not strip these headers.

## Metrics and logs

- `/metrics` is off unless `METRICS_TOKEN` is set (or `METRICS_PUBLIC=true`, which you should not use
  on an exposed port). Scrapers send `Authorization: Bearer <token>`. In the bundled compose file,
  set `METRICS_TOKEN` in `.env`; the gateway never routes `/metrics`, so scrape `api:8080` from inside
  the Compose network.
- Keep `LOG_LEVEL` at `info` or above. Logs contain email addresses and IP addresses of users
  (see [Data handling](data-handling.md#personal-data-in-logs)); ship them to a store with access
  control and retention.

## Accounts and sign-in

- Create the first administrator with the documented bootstrap procedure
  ([First administrator](../install/first-admin.md)) and enrol their authenticator.
- Keep `SIGNUP_MODE=disabled` (the default) unless you run a public service. `domain` lets people
  with an address on an organization's verified domain join that organization; `open` lets anyone
  create an organization. No console setting can exceed it. See
  [Sign-up and invitations](../identity/sign-up-and-invitations.md).
- Require 2FA in each organization (**Settings > Authentication > Require two-factor authentication**), or SSO
  through the organization's identity provider.
- Set an IP allowlist for organizations whose users work from known networks.
- Review API keys, SCIM tokens and sensor keys periodically; revoke what is unused.

## Backups

The platform does not back itself up: schedule a backup job. Back up:

- PostgreSQL (`pg_dump -Fc` or your platform's snapshots), encrypted and stored off the host;
- the `api-data` volume (uploaded evidence and attachments when stored locally, and the sensor CA in `SENSOR_MTLS_CA_DIR`, which every sensor trusts: losing it means re-pairing or reconfiguring every sensor);
- `AUDIT_ARCHIVE_DIR`, if you prune the audit log;
- the gateway's `gateway-data` volume (it holds the internal CA in `internal` TLS mode);
- your `.env` or secret store, **separately** from the database backups.

For the Compose deployment, `api/deploy/backup.sh` does all of this except the audit archive,
the encryption and the off-host copy, writes its files with mode `0600`, and has a `verify` command that restores the
newest backup into a throwaway PostgreSQL. A backup it makes holds `.env`, so it is as sensitive as
the database plus every stored credential: encrypt it before it leaves the host.

The monitoring rules include `BackupStale` and `BackupFailed` alerts that read a metric the backup
job writes (`backup.sh` writes it when `METRICS_TEXTFILE_DIR` is set). Test a restore regularly. See
[Backup and restore](../operations/backup-restore.md).

## Upgrades

- The API does not migrate the database on start. It checks the schema and refuses to start when the
  database is behind or a migration is dirty. Migrations run as a separate step (the compose `migrate`
  service, the Helm pre-upgrade job, or the all-in-one image's start-up) with the migrator role.
- Back up before every upgrade. Read the release notes for upgrade steps.
- Verify the image signatures and SBOM attestations before you deploy a release (see
  [Verify a release](../operations/versioning.md#verify-a-release)), and pin exact tags.
- Subscribe to security advisories on the GitHub repositories and upgrade promptly when one is
  published. See [Upgrading](../operations/upgrade.md).

## Sensors

- Pair sensors (key-bound identity) instead of using long-lived bearer keys, and require key-bound
  identity for the organization once all sensors are paired.
- Give each sensor the narrowest grant it needs.
- On sensors that reach internal networks, install a sensor-local policy file that lists the ranges,
  ports and tools the sensor may scan.
- Run sensors on dedicated, patched hosts with egress limited to the platform and the networks they
  scan.

See [Sensors](../sensors/index.md) and [Pairing and enrollment](../sensors/pairing.md).
