---
title: Data handling and privacy
parent: Security
nav_order: 4
---

# Data handling and privacy

This page describes, for operators and data protection officers, what an OpenCTEM installation
stores, where, for how long, how it is deleted, and what leaves the installation. It describes the
software. Whoever runs an installation decides how it is used and is responsible for it as a data
controller; the [privacy policy](../legal/privacy-policy.md) covers the general terms.

OpenCTEM sends no usage telemetry to the project, and the web console loads no third-party analytics or tracking.

## What is stored, and where

| Store | Contents |
|---|---|
| PostgreSQL | Everything durable: accounts (email, name, password hash, optional avatar and phone, preferences), memberships and roles, sessions (IP address, user agent, times), organization settings, assets, findings, evidence, scan configuration and results, sensor records, integrations, audit logs, notifications. |
| Redis | Short-lived state: session revocations, refresh-token and permission caches, rate-limit counters, sensor heartbeat state and request nonces, the background job queue (email jobs include the recipient address). |
| File storage | Uploaded attachments and evidence files. Local disk by default (`STORAGE_PROVIDER=local`, `STORAGE_LOCAL_PATH`), or S3-compatible storage (`STORAGE_PROVIDER=s3` or `minio`, with `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ENDPOINT` and credentials). An organization can point its own files at its own bucket. |
| `AUDIT_ARCHIVE_DIR` | Archives of pruned audit log entries (gzip JSON lines), when audit retention is enabled. |
| Logs (standard output) | Request logs with method, path, status, client IP address and user agent; application events. |

Personal data in an installation is mostly account data of the people who use it, plus whatever the
scanned systems and imported reports contain (host names, email addresses found in certificates or
leaks, user names in findings).

## Encryption

| Data | Protection |
|---|---|
| In transit | TLS at the gateway or ingress; TLS to PostgreSQL and Redis in the production deployment |
| Integration credentials, webhook secrets, SSO client secrets, TOTP secrets, file-storage credentials, AI provider keys, the secret store, leaked-credential values kept as evidence | AES-256-GCM with `APP_ENCRYPTION_KEY` |
| Passwords | bcrypt, cost 12 |
| 2FA recovery codes | bcrypt, cost 10 |
| API keys, SCIM tokens, sensor keys | HMAC-SHA256 with a server-side pepper; plaintext shown once |
| Session, refresh, password-reset, email-verification and invitation tokens | SHA-256 |
| Everything else (names, emails, IP addresses, findings, assets, audit logs, uploaded files) | Not encrypted by the application. Use encrypted disks or database storage encryption, and server-side encryption on your bucket. |

## Retention

Retention is automatic only where the table says so. Everything else stays until someone deletes it.

| Data | Kept | Configurable |
|---|---|---|
| Sessions and refresh tokens | Session ends after `AUTH_SESSION_DURATION` (30 days); refresh tokens after `AUTH_REFRESH_TOKEN_DURATION` (7 days). Expired and revoked rows are deleted hourly. | lifetimes only |
| 2FA sign-in challenges | Deleted hourly after expiry (5 minutes) | no |
| Organization audit log | Indefinitely, unless `AUDIT_ARCHIVE_DIR` is set; then entries older than `AUDIT_RETENTION_DAYS` (default and minimum 365) are archived to that directory and deleted | yes |
| Platform audit log | Indefinitely by default: the retention job only reports (`ADMIN_AUDIT_RETENTION_DRY_RUN=true`). With dry-run off, entries older than `ADMIN_AUDIT_RETENTION_DAYS` (365) are deleted | yes |
| In-app notifications | 90 days | no |
| Notification delivery queue | Delivered 7 days, failed 30 days, event history 90 days | no |
| Soft-deleted assets | Permanently deleted after 30 days, unless findings still reference them | no |
| Scanner output stored on findings | Cleared 365 days after the finding was closed (the finding stays) | no |
| Secret values captured as evidence | 30 days | per organization, 1 to 365 days |
| Evidence records | 365 days | no |
| Per-task sensor logs | 14 days | no |
| Scan run timelines | 30 days | no |
| Sensor activity events | 90 days | no |
| Sensor heartbeat history | 48 hours | no |
| CI runs | Findings of a CI run 90 days; runs 400 days (the latest runs are kept) | no |
| Discovered web endpoints | Marked gone after 30 days unseen, deleted 365 days later; change events 90 days | no |
| Assets, findings, scans and scan runs, imported reports, attachments | Until deleted by a user or with the organization | no |
| Invitations | Expire after 7 days but are not deleted | no |

Email verification and password reset tokens expire (24 hours and 1 hour) but are not removed from the
account row until replaced or used.

## Deleting people and organizations

### People

There is no self-service account deletion. Removing a person is done by the organization:

| Action | Effect |
|---|---|
| Suspend | Access stops at once; nothing is deleted. Reversible. |
| Offboard (`POST /api/v1/organization/members/{id}/offboard`, admin, step-up) | Access removed: API keys revoked, teams, direct grants and roles removed. Work assigned to the person must be reassigned first. The membership remains as a record. |
| Erase (`POST /api/v1/organization/members/{id}/erase`, owner, step-up) | Anonymises the account. Allowed only once the person is offboarded from every organization and is not a platform administrator. |

Erasure keeps the account row so that references from findings, comments and history stay valid, and:

- replaces the name with `Deleted user #<hash>` and the email with `erased-<hash>@erased.invalid`;
- clears the avatar, phone, preferences, password hash, identity-provider ids and pending tokens, and
  deactivates the account;
- deletes the 2FA factor and the linked identity-provider identities, and revokes all sessions.

Erasure does **not** rewrite the audit log: existing audit entries keep the actor email, IP address and
user agent recorded at the time, so the history remains verifiable. The erasure itself is audited at
critical severity. If you must remove personal data from audit entries, that is a database operation
that breaks the hash chain from that point; plan it with your auditors.

People provisioned by SCIM are offboarded when the identity provider deletes them; erasure is still a
separate owner action.

### Organizations

An owner deletes an organization under **Settings > General** (`DELETE /api/v1/tenants/{tenant}`,
step-up required). The deletion is **immediate and permanent**, with no grace period:

- all organization-owned data in the database is deleted (assets, findings, scans, sensors,
  integrations, settings, memberships);
- the organization's audit log entries are kept, detached from the organization, and the deletion is
  recorded in the platform's system audit chain;
- accounts are global and are not deleted; members of other organizations are unaffected;
- **files in file storage are not removed**: delete the organization's directory (`<tenant id>/` under
  `STORAGE_LOCAL_PATH`) or bucket prefix yourself, and remove its data from backups according to your
  backup retention.

## Personal data in logs

- Log fields named like passwords, tokens, secrets, cookies, sessions, API keys, email addresses,
  phone numbers and credentials are replaced with `[REDACTED]`.
- Request logs record the client IP address and user agent in clear, and the request path without the
  query string. Invitation tokens in legacy URLs are redacted.
- Free-text error messages are not scrubbed and may contain an email address or host name.

Treat logs as personal data: send them to a store with access control, and set its retention.

## What leaves the installation

Nothing leaves the installation unless an administrator configures it:

| Destination | Data | Configured by |
|---|---|---|
| Email (SMTP) | Invitations, password and set-password links, security notices, notifications | operator / organization |
| Notification channels (Slack, Microsoft Teams, Telegram, email, webhooks, Splunk HEC) | Notification summaries: finding titles, severities, asset names, links | organization admins |
| Ticketing (Jira) and source control (GitHub, GitLab) | Finding details for tickets; repository metadata | organization admins |
| AI triage providers (Anthropic Claude, OpenAI, Google Gemini) | Finding details sent for analysis | off by default; the operator enables it (`AI_TRIAGE_ENABLED`) and each organization chooses platform AI, its own API key, or off |
| Identity providers | Sign-in requests; SCIM is inbound | platform administrator |
| Error reporting (Sentry) | Errors from the web console server, with request context | off unless the operator sets `NEXT_PUBLIC_SENTRY_DSN` |
| Threat-intelligence feeds (EPSS, CISA KEV) | Nothing about you: the API downloads public data | platform administrator |

Data sent to a third-party service is subject to that service's terms. Review them before you enable
an integration, in particular AI triage.

## Backups

OpenCTEM has no built-in backup job. Back up PostgreSQL, the file storage, `AUDIT_ARCHIVE_DIR` and
your secrets yourself, encrypt the backups, and keep `APP_ENCRYPTION_KEY` separate from them. Deletion
and erasure do not reach existing backups: expire backups on a schedule that matches your retention
policy. See [Backup and restore](../operations/backup-restore.md).

## Not implemented

So that you can plan around them:

- self-service account deletion and a personal data export;
- a configurable retention period for assets, findings, scans or notifications;
- a grace period or undo for organization deletion, and removal of the organization's files;
- automatic deletion of expired invitations;
- application-level encryption of personal data other than the secrets listed above;
- anonymisation of audit log entries.
