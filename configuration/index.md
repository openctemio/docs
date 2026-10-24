---
title: Configuration
nav_order: 5
has_children: true
permalink: /configuration/
---

# Configuration

OpenCTEM is configured in two places:

- **Environment variables**, set by the operator, for everything about the
  installation: database and Redis, secrets, TLS and the public URL, sign-in
  policy, system email, limits, background jobs. They are read at start; restart
  the service after changing one.
- **The web console**, for everything about an organization: users and roles,
  SSO, integrations, notification channels, scan settings, limits. Platform-wide
  settings (organizations, sign-up, limits, CAPTCHA, platform sensors, e-mail, alerts,
  AI provider, scan approval) are in the platform console, its own application on its own address
  (`https://<host>:8443` or the host name you set; see the
  [Docker Compose guide](../install/docker-compose.md)).

Settings the platform console manages apply without a restart. A server variable that
covers the same setting (the CAPTCHA keys, `DEPLOYMENT_REGION`, the platform AI keys)
pins it, and the console shows it as locked. Remove the variable to manage the setting in
the console. The console's Settings > Configuration page lists every operator setting with
its source.

| Page | Covers |
|---|---|
| [Environment variables reference](environment-variables.md) | Every variable the API, the web console, the gateway, the Compose stack and the all-in-one image read, with defaults, and the checks production enforces. |
| [Email (SMTP)](email.md) | Platform e-mail in the console, headless `BOOTSTRAP_SMTP_*`, and per-organization relays. |
| [File storage](file-storage.md) | Attachment storage backends, quotas, encryption and malware scanning. |
| [Notification channels](notifications.md) | Slack, Microsoft Teams, Telegram, email and webhook channels, and the events they carry. |

Related: [TLS and the gateway](../install/tls-and-gateway.md),
[Identity and access](../identity/index.md) for SSO and sign-in,
[Sensors](../sensors/index.md) for sensor settings.

## Settings to decide before going live

| Decision | Variable | Default |
|---|---|---|
| Public origin | `OPENCTEM_PUBLIC_URL` (Compose) or `APP_URL`, `CORS_ALLOWED_ORIGINS`, `SMTP_BASE_URL` | none |
| TLS mode | `OPENCTEM_TLS_MODE` | `internal` |
| Who may sign up and create organizations | `SIGNUP_MODE` (`disabled`, `domain`, `open`); the console sign-up policy can only stay at or below it | `disabled` |
| Fingerprint key for secret findings | `FINGERPRINT_KEY` (at least 32 characters; required outside development) | none |
| Whether platform sensors need a verified domain | Platform console, **Scanning > Platform scanning** | off |
| Whether scans need approval | Platform console, **Scanning > Scan approval** (each organization decides by default) | off |
| Ranges and names no organization may scan | `SCOPE_DENY_EXTRA` | none (built-in deny list only) |
| System email | Platform console, **Settings > E-mail** (`BOOTSTRAP_SMTP_*` for headless installs) | off |
| Sensor mTLS listener (protocol v3) | `SENSOR_MTLS_LISTEN_ADDR`; the gateway routes it on port 443 | `:9443` |
| Free-space, backup and certificate checks on the console Health page (Monitoring > Health) | `SYSTEM_STORAGE_PATHS`, `SYSTEM_BACKUP_STATUS_FILE`, `SYSTEM_TLS_CERT_FILES` | local attachments and sensor CA only |
| Platform console address and who may reach it | `OPENCTEM_ADMIN_SITE` (`port`, `host`, `off`), `OPENCTEM_ADMIN_HOST` or `OPENCTEM_ADMIN_PORT`, `OPENCTEM_ADMIN_BIND`, `OPENCTEM_ADMIN_ALLOWED_CIDRS` | `port` on `8443`, private networks only (Compose) |
| Off-box copy of the administrators' audit log (required with `MANAGED_SERVICE=true`) | `ADMIN_AUDIT_SINK` | off |
| Metrics | `METRICS_TOKEN` | off |
| Audit log retention | `AUDIT_RETENTION_ENABLED`, `AUDIT_RETENTION_DAYS`, `ADMIN_AUDIT_RETENTION_*` | 365 days, then archived through the storage provider; admin audit pruning in dry run |
| Attachment storage ([File storage](file-storage.md)) | `STORAGE_PROVIDER`, `STORAGE_SSE`, `STORAGE_CLAMD_ADDRESS`; the per-organization quota is in the console, **Settings > Limits** | `local`, bucket default, no malware scan, 20 GiB per organization |

Generate every secret (`AUTH_JWT_SECRET`, `APP_ENCRYPTION_KEY`, `FINGERPRINT_KEY`, database and
Redis passwords) once, store it in a secret store, and back it up
with the database.
