---
title: Audit log
parent: Security
nav_order: 6
---

# Audit log

OpenCTEM keeps two audit trails:

| Trail | What it records | Who reads it |
|---|---|---|
| Organization audit log (`audit_logs`) | Actions inside an organization, and sign-in events | Organization owners and admins (`audit:read`) whose data access is full, because entries name assets and findings; every user sees their own actions under **Account > Activity** |
| Administrators' audit log, also called the platform audit log (`admin_audit_logs`) | Actions taken in the platform console, and sign-in events of the console | Platform administrators (any console role), in the platform console under **Security > Admin activity** |

The two are separate on purpose. The organization log belongs to the organization and is read by its
owners and administrators. The administrators' log records what the people who run the platform did;
no organization can read it, and no organization member (owner included) can change it. An action a
platform administrator takes inside an organization is written to both.

Every organization audit entry is also linked into a per-organization SHA-256 hash chain, so that
editing or deleting entries afterwards is detectable.

## What is audited

The organization audit log covers security-relevant and configuration changes across the product.
The main groups of actions are:

| Area | Examples |
|---|---|
| Authentication | sign-in success and failure, 2FA enabled, disabled, reset or failed, recovery code used, password changed, session revoked, step-up success and failure |
| Members and access | invitations, member created, suspended, re-enabled, offboarded or erased, role changes, custom role changes, group membership, SCIM token and group-mapping changes, API key create, revoke and delete |
| Organization settings | security settings (2FA requirement, IP allowlist, allowed domains, SSO enforcement), SSO configuration and SSO change approvals, module changes |
| Sensors | pairing approved, denied and completed, key revoked, grant narrowed or widened, refused claims and pushes, identity policy changes, refusals by a sensor's local policy |
| Scanning and scope | scope targets and exclusions (including approvals of widening), scans, scan workflows, scan profiles, scan zones, tools, scanner templates, commands created over the API |
| Data | assets, findings (status, triage, suppression), credentials revealed, ingest events, AI triage requests |

Each entry records:

- the actor (user id and email, or `system`; API key and SCIM requests also carry the key or token
  id and prefix in `metadata`), with IP address and user agent;
- the action, resource type, resource id and name;
- the result (`success`, `failure` or `denied`) and a severity (`low`, `medium`, `high`, `critical`);
- before and after values for changes where available, a message, free-form metadata;
- the request id and session id, and the time.

Actions taken by a platform administrator inside an organization (for example creating the first
owner or rebaselining the chain) are written to that organization's log with the actor
`platform-admin:<email>`, and to the platform audit log.

Secrets are never written to audit entries: tokens, keys and codes appear only as ids or prefixes.

## Reading and exporting

In the web console: **Settings > Audit log** (owners and admins), and **Account > Activity** for
your own actions.

![The Audit log page listing recent actions with actor, resource, result and severity]({{ site.baseurl }}/assets/images/security/audit-log.png)
*Figure: The audit log in the console.*

Over the API (tenant from the access token):

| Method and path | Permission | Purpose |
|---|---|---|
| `GET /api/v1/audit-logs` | `audit:read` and full data access | List and filter. Query parameters: `actor_id`, `action`, `resource_type`, `resource_id`, `result`, `severity`, `request_id`, `search`, `since`, `until`, `exclude_system`, `sort_by`, `sort_order`, pagination (`page`, `per_page`) |
| `GET /api/v1/audit-logs/export` (`format` is `csv` or `jsonl`) | `audit:read` and full data access | Download the log. Same filters as the list; newest first; up to 50,000 rows (the response header `X-Export-Truncated: true` says more rows match: narrow the filter or use `since`/`until`). |
| `GET /api/v1/audit-logs/stats` | `audit:read` and full data access | Counts |
| `GET /api/v1/audit-logs/{id}` | `audit:read` and full data access | One entry |
| `GET /api/v1/audit-logs/resource/{type}/{id}` | `audit:read` and full data access | History of one resource |
| `GET /api/v1/audit-logs/user/{id}` | `audit:read` and full data access, or the caller's own id | Activity of one user |
| `GET /api/v1/audit-logs/verify` | owner or admin | Verify the hash chain |

**Export.** The audit log page has an **Export** button (CSV or JSON lines) that applies the
filters currently on screen. CSV cells that start with a formula character (`=`, `+`, `-`, `@`) are
neutralised so a spreadsheet does not run them. Each export is itself recorded as an
`audit_log.exported` event, with who exported and the filters. To archive the log in another system
on a schedule, call the export or page through `GET /api/v1/audit-logs` with a `since` filter.
Organization API keys are read-only and can call these routes if the key has the `audit:read` scope
(see [API authentication](../api/authentication.md)).

Platform administrators read the administrators' audit log in the platform console (**Security >
Admin activity**) or with `GET /api/v1/admin/audit-logs`.

## Hash chain

Every organization audit entry gets a row in `audit_log_chain`:

```
hash = SHA-256(prev_hash | audit_log_id | action|resource_type|resource_id|result | timestamp)
```

The timestamp is rounded to microseconds, as PostgreSQL stores it. Events without an organization
(for example failed sign-ins for an unknown account) go into a separate system chain. Chain rows
reference their audit rows with `ON DELETE RESTRICT`, so a plain `DELETE` of an audit row fails.

### Verifying

- **On demand:** `GET /api/v1/audit-logs/verify` (owner or admin) walks the chain and answers
  `200` with `ok: true` when it is intact, or `409` with a `breaks[]` list naming each position
  that does not verify.
- **Hourly:** the API walks the chain of every active organization. A break is logged at `ERROR`
  level with the text `audit chain break`, the organization and the position, and is exposed as a
  metric. A break that persists is alerted once, not every hour. Point your log alerting at that
  text.

### Limits

Read these before relying on the chain as evidence:

- The chain is **tamper-evident, not tamper-proof**. It is unkeyed SHA-256: someone with write
  access to the database can rewrite rows and recompute the chain consistently. Keep database write
  access to the API's own role (see [Hardening](hardening.md)) and copy the log to a separate system
  if you need evidence that survives a database compromise.
- The hash covers the action, resource type, resource id, result and time. The actor, message,
  metadata and change values are stored with the entry but are not part of the hash.
- A **rebaseline** re-signs an organization's chain from the current rows. It exists only to repair
  breaks left by a historical timestamp-precision defect. It is available only to a platform
  super admin in the platform console (**Organizations**, open the organization, **Audit chain** tab), after a
  classification shows that every break is explained, with a fresh authenticator code. Every
  rebaseline keeps the overwritten hashes in `audit_chain_rebaselines` and
  `audit_chain_rebaseline_entries` and writes a critical `audit.chain_rebaselined` event.
  Organization owners cannot rebaseline their own chain.

The design reference is
[audit-hash-chain.md](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/audit-hash-chain.md).

## The administrators' audit log and its off-box copy

The administrators' log is append-only: database triggers refuse updates, deletes and truncation
of `admin_audit_logs`, the application role has no grant to change it, and every row is linked
into a SHA-256 hash chain computed by the database. **Security > Admin activity** shows whether
every entry verifies, and `bootstrap-admin verify-audit [-json]` (the `admin-cli` image) checks it
from the command line and exits 1 on a break. Before a super administrator's write runs, the API
writes an `admin.write_started` row with the redacted request body; if that row cannot be written
the write is refused with `503 AUDIT_UNAVAILABLE`.

Someone who controls the database could still rewrite the chain. `ADMIN_AUDIT_SINK` closes that
gap by sending every row, as written, to a place the database administrator does not control:

| `ADMIN_AUDIT_SINK` | Delivery |
|---|---|
| `https://collector.example.com/path` | JSON batch per POST, signed with `ADMIN_AUDIT_SINK_SECRET` (at least 32 bytes, HMAC-SHA256 in `X-OpenCTEM-Signature` over the timestamp and body, with `X-OpenCTEM-Timestamp` and `X-OpenCTEM-Batch-Id`). No redirects. The URL must not carry credentials. |
| `syslog+tls://collector.example.com:6514` | RFC 5424 over TLS. Optional `ADMIN_AUDIT_SINK_SYSLOG_CA_FILE`, and for mutual TLS `ADMIN_AUDIT_SINK_SYSLOG_CLIENT_CERT` with `ADMIN_AUDIT_SINK_SYSLOG_CLIENT_KEY`. |
| `file:///var/lib/openctem-admin-audit/admin-audit.jsonl` | One JSON batch per line, file mode `0600`. Same host as the database: it protects against rewrites inside the database, and it leaves the host only with your backups. |

Plaintext `syslog+tcp://` and `syslog+udp://` are not supported, and the API refuses to start with
them, with a sink it cannot use, or with a secret that does not match the destination. A row is sent
with its chain position and hash (not the request body or user agent), together with the chain head
every `ADMIN_AUDIT_SINK_HEAD_INTERVAL` (default `15m`) and the chain verification state, so a later
re-signing of the chain cannot match a head already sent. Delivery is at least once from a durable
cursor that moves only after the destination accepted the batch, with backoff; it never slows the
console. A batch that does not continue the last delivered row is still sent, flagged with a `gap`
field. Metrics: `openctem_admin_audit_forward_*` and `openctem_admin_audit_chain_ok`.

The sink is off by default. **With `MANAGED_SERVICE=true` in production the API refuses to
start without it.** The Ansible kit sets it with `openctem_admin_audit_sink` (`file` or an
`https://` URL; `syslog+tls://` is not supported by the kit). Back up a `file` sink with the
database ([Backup and restore](../operations/backup-restore.md)).

## Retention

| Setting | Default | Effect |
|---|---|---|
| `AUDIT_RETENTION_DAYS` | `365` (minimum 365) | Age after which organization audit entries may be pruned |
| `AUDIT_ARCHIVE_DIR` | empty | Directory for the archive files. **While empty, nothing is pruned**: entries stay in the database indefinitely and the API logs one warning |
| `ADMIN_AUDIT_RETENTION_ENABLED` | `true` | Runs the administrators' audit log retention job |
| `ADMIN_AUDIT_RETENTION_DRY_RUN` | `true` | Only reports what it would delete. Set `false` to delete |
| `ADMIN_AUDIT_RETENTION_DAYS` | `365` | Age threshold for the administrators' audit log. Deletion never removes an entry newer than one year, whatever the value, and re-anchors the chain where it stopped |
| `ADMIN_AUDIT_RETENTION_INTERVAL` | `24h` | How often the job runs |

When `AUDIT_ARCHIVE_DIR` is set, an hourly job takes the oldest entries of each chain that are past
the retention period, writes them (chain row and audit row) to
`AUDIT_ARCHIVE_DIR/<organization>/audit-<first>-<last>-<time>.jsonl.gz` (file mode 0600), records an
anchor row with the archive's SHA-256 and the last pruned hash, and deletes them. It only ever
removes the oldest contiguous prefix, so the remaining chain still verifies from the anchor. To
check a pruned period, recompute the hashes from the archive lines, oldest first; the last hash must
equal the anchor.

Keep the archive directory on durable storage and include it in your backups: it is the only copy
of pruned entries.
