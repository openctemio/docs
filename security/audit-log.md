---
title: Audit log
parent: Security
nav_order: 5
---

# Audit log

OpenCTEM keeps two audit trails:

| Trail | What it records | Who reads it |
|---|---|---|
| Organization audit log (`audit_logs`) | Actions inside an organization, and sign-in events | Organization owners and admins (`audit:read`); every user sees their own actions under **Account > Activity** |
| Platform audit log (`admin_audit_logs`) | Actions taken in the platform admin console | Platform administrators (any console role) |

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

Over the API (tenant from the access token):

| Method and path | Permission | Purpose |
|---|---|---|
| `GET /api/v1/audit-logs` | `audit:read` | List and filter. Query parameters: `actor_id`, `action`, `resource_type`, `resource_id`, `result`, `severity`, `request_id`, `search`, `since`, `until`, `exclude_system`, `sort_by`, `sort_order`, pagination (`page`, `per_page`) |
| `GET /api/v1/audit-logs/stats` | `audit:read` | Counts |
| `GET /api/v1/audit-logs/{id}` | `audit:read` | One entry |
| `GET /api/v1/audit-logs/resource/{type}/{id}` | `audit:read` | History of one resource |
| `GET /api/v1/audit-logs/user/{id}` | `audit:read`, or the caller's own id | Activity of one user |
| `GET /api/v1/audit-logs/verify` | owner or admin | Verify the hash chain |

There is no bulk export button. To archive the log in another system, page through
`GET /api/v1/audit-logs` with a `since` filter from a scheduled job. Organization API keys are
read-only and can call these routes if the key has the `audit:read` scope (see
[API authentication](../api/authentication.md)).

Platform administrators read the platform audit log in the admin console (**System logs**) or with
`GET /api/v1/admin/audit-logs`.

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
  super admin in the admin console (**Organizations > organization > Audit chain**), after a
  classification shows that every break is explained, with a fresh authenticator code. Every
  rebaseline keeps the overwritten hashes in `audit_chain_rebaselines` and
  `audit_chain_rebaseline_entries` and writes a critical `audit.chain_rebaselined` event.
  Organization owners cannot rebaseline their own chain.

The design reference is
[audit-hash-chain.md](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/audit-hash-chain.md).

## Retention

| Setting | Default | Effect |
|---|---|---|
| `AUDIT_RETENTION_DAYS` | `365` (minimum 365) | Age after which organization audit entries may be pruned |
| `AUDIT_ARCHIVE_DIR` | empty | Directory for the archive files. **While empty, nothing is pruned**: entries stay in the database indefinitely and the API logs one warning |
| `ADMIN_AUDIT_RETENTION_ENABLED` | `true` | Runs the platform audit log retention job |
| `ADMIN_AUDIT_RETENTION_DRY_RUN` | `true` | Only reports what it would delete. Set `false` to delete |
| `ADMIN_AUDIT_RETENTION_DAYS` | `365` | Age threshold for the platform audit log |
| `ADMIN_AUDIT_RETENTION_INTERVAL` | `24h` | How often the platform job runs |

When `AUDIT_ARCHIVE_DIR` is set, an hourly job takes the oldest entries of each chain that are past
the retention period, writes them (chain row and audit row) to
`AUDIT_ARCHIVE_DIR/<organization>/audit-<first>-<last>-<time>.jsonl.gz` (file mode 0600), records an
anchor row with the archive's SHA-256 and the last pruned hash, and deletes them. It only ever
removes the oldest contiguous prefix, so the remaining chain still verifies from the anchor. To
check a pruned period, recompute the hashes from the archive lines, oldest first; the last hash must
equal the anchor.

Keep the archive directory on durable storage and include it in your backups: it is the only copy
of pruned entries.
