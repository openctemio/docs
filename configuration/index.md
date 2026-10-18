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
  settings (organizations, sign-up, platform sensors, system e-mail, scan
  approval) are in the platform console, its own application on its own address
  (`https://<host>:8443` or the host name you set; see the
  [Docker Compose guide](../install/docker-compose.md)).

| Page | Covers |
|---|---|
| [Environment variables reference](environment-variables.md) | Every variable the API, the web console, the gateway, the Compose stack and the all-in-one image read, with defaults, and the checks production enforces. |
| [Email (SMTP)](email.md) | System SMTP and per-organization relays. |
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
| Whether platform sensors need a verified domain | Platform console, **System > Platform scanning** | off |
| Whether scans need approval | Platform console, **System > Scan approval** (each organization decides by default) | off |
| Ranges and names no organization may scan | `SCOPE_DENY_EXTRA` | none (built-in deny list only) |
| System email | Platform console, **System > E-mail** (`BOOTSTRAP_SMTP_*` for headless installs) | off |
| Sensor mTLS listener (protocol v3) | `SENSOR_MTLS_LISTEN_ADDR`; the gateway routes it on port 443 | `:9443` |
| Free-space, backup and certificate checks on the console System page | `SYSTEM_STORAGE_PATHS`, `SYSTEM_BACKUP_STATUS_FILE`, `SYSTEM_TLS_CERT_FILES` | local attachments and sensor CA only |
| Metrics | `METRICS_TOKEN` | off |
| Audit log retention | `AUDIT_RETENTION_DAYS`, `AUDIT_ARCHIVE_DIR`, `ADMIN_AUDIT_RETENTION_*` | keep everything; admin audit pruning in dry run |
| Attachment storage ([File storage](file-storage.md)) | `STORAGE_PROVIDER`, `STORAGE_SSE`, `STORAGE_CLAMD_ADDRESS` | `local`, bucket default, no malware scan |

Generate every secret (`AUTH_JWT_SECRET`, `APP_ENCRYPTION_KEY`, `FINGERPRINT_KEY`, database and
Redis passwords) once, store it in a secret store, and back it up
with the database.
