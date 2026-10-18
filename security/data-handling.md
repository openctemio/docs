---
title: Data handling and privacy
parent: Security
nav_order: 5
---

# Data handling and privacy

This page describes, for operators and data protection officers, what an OpenCTEM installation
stores, where, for how long, how it is deleted, and what leaves the installation. It describes the
software. Whoever runs an installation decides how it is used and is responsible for it as a data
controller; the [privacy policy](../legal/privacy-policy.md) covers the general terms.

OpenCTEM sends no usage telemetry to the project, and the web console loads no third-party analytics or tracking. The one automatic outbound request is the daily version check (see [What leaves the installation](#what-leaves-the-installation)), which you can turn off.

## What is stored, and where

| Store | Contents |
|---|---|
| PostgreSQL | Everything durable: accounts (email, name, password hash, optional avatar and phone, preferences), memberships and roles, sessions (IP address, user agent, times), requests for access (email address, a hash of the requester's IP address), organization settings, assets, findings, evidence, scan configuration and results, sensor records, integrations, AI assistant (MCP) connections, audit logs, notifications. |
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
| Platform console sessions | 8 hours absolute, 15 minutes idle, at most 3 per administrator | no |
| Organization audit log | Indefinitely, unless `AUDIT_ARCHIVE_DIR` is set; then entries older than `AUDIT_RETENTION_DAYS` (default and minimum 365) are archived to that directory and deleted | yes |
| Administrators' audit log | Indefinitely by default: the retention job only reports (`ADMIN_AUDIT_RETENTION_DRY_RUN=true`). With dry-run off, entries older than `ADMIN_AUDIT_RETENTION_DAYS` are deleted, never any newer than one year. A copy sent to `ADMIN_AUDIT_SINK` is kept by whoever runs the destination | yes |
| Requests for access (when sign-up is closed) | Unconfirmed requests 24 hours; decided requests 90 days | no |
| Sign-up events (the platform console's sign-up feed and burst alerts) | 90 days. An event keeps only the registrable e-mail domain, the client network prefix (/24 for IPv4, /48 for IPv6), the kind and the time: never the address, a name or a user agent | no |
| Deleted accounts | Personal data erased 14 days after a person deletes their account, unless they sign in again | no |
| Organizations an owner deleted | Closed at once, data purged 14 days later unless an owner cancels | no |
| Suspended organizations and blocked accounts | Kept as they are: suspension and blocking delete nothing | no |
| Priority classification history | 180 days | no |
| In-app notifications | 90 days | no |
| Notification delivery queue | Delivered 7 days, failed 30 days, event history 90 days | no |
| Soft-deleted assets | Permanently deleted after 30 days, unless findings still reference them | no |
| Scanner output stored on findings | Cleared 365 days after the finding was closed (the finding stays) | no |
| Evidence files of deleted findings or campaigns, and uploads never linked to one | 7 days after the deletion (`STORAGE_ORPHAN_GRACE_DAYS`); unlinked uploads 24 hours (`STORAGE_UNLINKED_RETENTION_HOURS`); `0` keeps them | yes |
| Report data a sensor abandoned, or that expired or failed | Payloads emptied when abandoned or expired; the rows deleted after 7 days | no |
| Secret values captured as evidence | 30 days | per organization, 1 to 365 days |
| Evidence records | 365 days | no |
| Per-task sensor logs | 14 days | no |
| Scan run timelines | 30 days | no |
| Sensor activity events | 90 days | no |
| Sensor heartbeat history | 48 hours | no |
| CI runs | Findings of a CI run 90 days; runs 400 days (the latest runs are kept) | no |
| Discovered web endpoints | Marked gone after 30 days unseen, deleted 365 days later; change events 90 days | no |
| Assets, findings, scans and scan runs, imported reports, attachments | Until deleted by a user or with the organization | no |
| Invitations | Expire after 7 days but are not deleted; cancelled or declined invitations are kept as revoked for 30 days | no |

Email verification and password reset tokens expire (24 hours and 1 hour) but are not removed from the
account row until replaced or used.

## Deleting people and organizations

### People

A person can delete their own account under **My account > Security > Delete account**
(`DELETE /api/v1/me/account`, step-up). Every session ends and the account's API keys are revoked
at once. Signing in again within 14 days cancels the deletion; after that the account leaves every
organization and its personal data is erased. It is refused while the person is the only owner of an
organization. A person can also leave one organization (**Leave this organization**,
`POST /api/v1/organization/leave`), which runs the same offboarding an administrator would.

An organization removes a person with these actions:

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
step-up required). The deletion has a **14-day grace period**:

- The request answers `202` with `deletion_due_at`. From that moment the organization is closed to
  every credential, the same gate as a suspension: sessions, API keys, MCP tokens, sensor keys, SCIM
  tokens, CI tokens and inbound webhooks are refused, and scheduled work stops. Nothing is deleted yet.
- Any active owner can **cancel** until the 14 days end, from the sign-in page
  (`POST /api/v1/auth/organization-deletion/cancel`). Everything works again as before.
- When the 14 days end, the `organization-delete` worker purges the organization.
- A platform administrator can purge an organization at once from the platform console
  (**Organizations > Delete now**: super admin, a fresh authenticator code, a reason, a critical
  audit row, and a second super admin's approval when four-eyes approvals apply).

The purge is **permanent**:

- all organization-owned data in the database is deleted (assets, findings, scans, sensors,
  integrations, settings, memberships);
- the organization's audit log entries are kept, detached from the organization, and the deletion is
  recorded in the platform's system audit chain;
- accounts are global and are not deleted; members of other organizations are unaffected;
- the organization's files (attachments and evidence) are deleted first, from local storage, the
  server bucket and the organization's own bucket (the `<tenant id>/` namespace). If a storage
  backend cannot be erased, the deletion is refused with `503` and nothing else changes, so the
  owner can retry. Files of organizations deleted before this behaviour existed are not removed:
  delete the directory `<STORAGE_LOCAL_PATH>/<tenant id>/` or bucket prefix yourself;
- remove its data from backups according to your backup retention.

### Suspension and deletion

A platform administrator can **suspend** an organization or **block** an account (platform console,
operations admin or super admin, with a fresh authenticator code and a reason). It stops access and
deletes nothing: the data stays exactly as it is until the suspension is lifted or the organization
is deleted. Suspension is the tool for an abuse report or a legal hold; deletion is the tool for an
erasure request.

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
| Version check | One anonymous download a day of the signed release feed (no instance id, version or counts); the host of the file (GitHub by default) sees the source address | on by default; `VERSION_CHECK_ENABLED=false` stops it |
| Email (SMTP) | Invitations, password and set-password links, security notices, notifications | operator / organization |
| Notification channels (Slack, Microsoft Teams, Telegram, email, webhooks, Splunk HEC) | By default only the event type, severity and a link. With **Include details in notifications** on for a channel: finding titles, descriptions and asset names | organization admins |
| AI assistants (MCP) | What a connected application asks for through the MCP server, limited to what the person who connected it can see and to the organization's settings under **Settings > AI assistants (MCP)** | each person connects an application; organization owners can turn AI assistants off |
| CAPTCHA (Cloudflare Turnstile) on registration, request access and sign-in after repeated failures | The visitor's browser contacts Cloudflare when the keys are set | platform administrator (Console > Settings > CAPTCHA) or the environment |
| Administrator alert webhook | Alert text about the platform itself (low disk, stale backups, expiring certificates, setting changes, sign-up bursts): counts and names of checks, no organization data | platform administrator (Console > Settings > Alerts) |
| Administrators' audit copy | Every administrators' audit row (no request body), to your own collector | operator (`ADMIN_AUDIT_SINK`) |
| Ticketing (Jira) and source control (GitHub, GitLab) | Finding details for tickets; repository metadata | organization admins |
| AI triage providers (Anthropic Claude, OpenAI, Google Gemini) | Finding details sent for analysis | available when a platform administrator sets a provider and key (Console > Settings > AI provider, or `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `GEMINI_API_KEY` in the environment) or an organization stores its own key; each organization chooses platform AI, its own API key, or off |
| Identity providers | Sign-in requests; SCIM is inbound | platform administrator |
| Error reporting (Sentry) | Errors from the web console server, with request context | off unless the operator sets `NEXT_PUBLIC_SENTRY_DSN` |
| Threat-intelligence feeds (EPSS, CISA KEV) | Nothing about you: the API downloads public data | platform administrator |

Data sent to a third-party service is subject to that service's terms. Review them before you enable
an integration, in particular AI triage.

## Backups

OpenCTEM has no built-in backup job (the Compose stack and the Ansible kit ship scripts). Back up PostgreSQL, the file storage, `AUDIT_ARCHIVE_DIR` and
your secrets yourself, encrypt the backups, and keep `APP_ENCRYPTION_KEY` separate from them. Deletion
and erasure do not reach existing backups: expire backups on a schedule that matches your retention
policy. See [Backup and restore](../operations/backup-restore.md).

## Not implemented

So that you can plan around them:

- a personal data export;
- a configurable retention period for assets, findings, scans or notifications;
- automatic deletion of expired invitations;
- application-level encryption of personal data other than the secrets listed above;
- anonymisation of audit log entries.
