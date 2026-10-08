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
  SSO, integrations, notification channels, scan settings. Platform-wide settings
  (organizations, platform sensors) are in the admin console (`/admin`).

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
| Who creates organizations | `TENANT_CREATION_MODE` | `admin_only` |
| When active scans need a verified domain | `SCOPE_ACTIVE_PROOF` | `off` (`platform_sensors` with self-service organizations) |
| Ranges and names no organization may scan | `SCOPE_DENY_EXTRA` | none (built-in deny list only) |
| System email | `SMTP_*` | off |
| Metrics | `METRICS_TOKEN` | off |
| Audit log retention | `AUDIT_RETENTION_DAYS`, `AUDIT_ARCHIVE_DIR`, `ADMIN_AUDIT_RETENTION_*` | keep everything; admin audit pruning in dry run |
| Attachment storage | `STORAGE_PROVIDER` | `local` |

Generate every secret (`AUTH_JWT_SECRET`, `APP_ENCRYPTION_KEY`, database and
Redis passwords) once, store it in a secret store, and back it up
with the database.
