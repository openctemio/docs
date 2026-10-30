---
title: Troubleshooting
parent: Operations
nav_order: 7
---

# Troubleshooting
{: .no_toc }

Start with the state of the services and the API log; most start-up problems
name the setting at fault. Commands assume the Compose stack in `api/deploy`;
see [Log reference](logs.md) for the other deployments.

1. TOC
{:toc}

---

## First checks

```bash
docker compose ps -a
docker compose logs --tail=100 api
curl --cacert ca/openctem-root-ca.crt https://ctem.example.com/health
docker compose exec api wget -qO- localhost:8080/ready
```

- The one-shot jobs `datastore-tls`, `db-roles` and `migrate` must show
  `Exited (0)`. A non-zero exit stops everything after it: read its log.
- `/ready` reports the database and Redis checks separately.
- Every API response carries `X-Request-ID`; search the API log for it to find
  the lines of one request.

## The API does not start

| Log message | Cause | Fix |
|---|---|---|
| `failed to load configuration` with `... is required` or `... must be ...` | A missing or invalid setting. In production several settings are enforced. | Fix the variable named in `error`. See [Production checks](../configuration/environment-variables.md#production-checks). |
| `retired environment variables are set and no longer read: AGENT_...` | A pre-sensor variable name. | Rename it as the message says (`AGENT_` to `SENSOR_`). |
| `AUTH_JWT_SECRET is a known development default` / `APP_ENCRYPTION_KEY is the docker-compose default` | A published example secret outside `APP_ENV=development`. | Generate real values (`openssl rand -hex 64` / `openssl rand -hex 32`). Changing the encryption key on an existing database needs a [key rotation](backup-restore.md#rotating-the-encryption-key). |
| `KEYCLOAK_BASE_URL must be set in production` | `AUTH_PROVIDER` is `oidc` or `hybrid` (the default is `local`) without a Keycloak URL. | Set `AUTH_PROVIDER=local`, or set the Keycloak variables. |
| `FINGERPRINT_KEY is required when APP_ENV="production"` (or `must be at least 32 characters`) | The secret that keys the identity of secret findings is missing or short. | Generate one with `openssl rand -hex 32`. On an installation that already stores secret findings set it to the current `APP_ENCRYPTION_KEY` value, and never change it afterwards. |
| `MANAGED_SERVICE in production requires the off-box administrators' audit sink` | `MANAGED_SERVICE=true` without `ADMIN_AUDIT_SINK`. | Set `ADMIN_AUDIT_SINK` to an `https://`, `syslog+tls://` or `file:///` destination (the Ansible kit: `openctem_admin_audit_sink`), or unset `MANAGED_SERVICE` on a self-managed installation. See [Hardening](../security/hardening.md#platform-console). |
| `database schema check failed — refusing to start` | Migrations did not run, failed (dirty), or the database predates the migration baseline. | See [Migrations](#migrations). |
| `failed to connect to database` | Host, credentials, or TLS (`DB_SSLMODE`). | Check `DB_*`; production refuses `DB_SSLMODE=disable`. |
| `failed to connect to redis` | Host, password, or TLS. | Check `REDIS_*`; production requires TLS and a 32+ character password. |
| `jira webhook preflight: connected Jira integrations have no webhook secret` (warning) | A connected Jira integration without a webhook secret; its inbound webhooks are refused. | The organization sets the secret in **Settings > Integrations > Ticketing > Inbound webhook**. |

## Migrations

Since v0.16.0 the migration runner (`openctem-migrate`) records every applied
migration in `schema_migrations_applied`; `schema_migrations` keeps one row, a
fence version while the database is clean, or the failed migration's version and
`dirty = t`. Read the state:

```bash
set -a; . ./.env; set +a
DBURL="postgres://${DB_MIGRATE_USER:-$DB_USER}:${DB_MIGRATE_PASSWORD:-$DB_PASSWORD}@postgres:5432/${DB_NAME:-openctem}?sslmode=${DB_SSLMODE:-require}"
docker compose run --rm migrate -path=/migrations -database "$DBURL" status
docker compose logs migrate
```

- **Behind** (a shipped migration is not applied; the API names it): run
  `docker compose up -d` again; the `migrate` job applies every missing migration
  before the API.
- **Dirty**: a migration failed midway. The `migrate` log names the version and
  the error, usually data that violates a new constraint. Fix the cause, then
  clear the flag and run the migrations again. `force` runs no SQL:

  ```bash
  # the failed migration applied nothing (or you undid it): clear the flag, up runs it again
  docker compose run --rm migrate -path=/migrations -database "$DBURL" force -1
  # it is in fact complete (you finished it by hand): record it instead
  #   ... force <version>
  docker compose up -d
  ```

  If the failed migration created objects outside its transaction, remove them by
  hand first. When in doubt, restore the pre-upgrade backup.
- **Refused on the first run after v0.16.0** (no release matches the database): the
  database was migrated by a development build or left dirty by the earlier
  runner. Check the schema, list every applied version one per line in a file and
  run the runner once with `-assume-applied FILE ... up`. See
  [safe-deploy-and-migrations.md](https://github.com/openctemio/openctem/blob/develop/api/docs/deployment/safe-deploy-and-migrations.md#dirty-migration-recovery).
- **`no migration found for version 9223372036854775807`**: an older migrations
  image ran against a database a newer release migrated. Roll back the API image
  only, never the migration job (see [Rollback](upgrade.md#rollback)).
- **Older than the baseline**: the database is from a release before the
  migration baseline. Upgrade in two steps as described in the release's
  [upgrade guide](upgrade.md#release-specific-guides).

Never set `SKIP_SCHEMA_CHECK=true` to get past these: the API would serve
requests against a schema it does not match.

## `permission denied` (SQLSTATE 42501) in the API log

The API's role (`openctem_app`) lacks a grant, usually after a restore or after
a migration was applied as another role. Re-run the roles job, which repairs
ownership and grants:

```bash
docker compose run --rm db-roles
docker compose restart api
```

If you use the console database role (`DB_ADMIN_USER`), a release can add console tables
(v0.11.0 adds `admin_approvals`). The `db-grants` job in the Compose stack re-grants after
every migration; elsewhere run `least-privilege-roles.sql` again with `admin_user` and
`admin_password` set. Without it the console fails with `permission denied` on those tables.

## Cannot sign in

| Symptom | Cause | Fix |
|---|---|---|
| The sign-in page loops back, or the session is lost at once | Cookies are `Secure` and the browser is on `http://`. | Use the HTTPS URL. |
| Live updates never connect; `websocket upgrade rejected: origin not allowed` in the API log | `OPENCTEM_PUBLIC_URL` (or `CORS_ALLOWED_ORIGINS`) differs from the browser's origin, often by the port. | Set it to the exact origin and restart. |
| `401 Session has expired` soon after sign-in | Clock skew between hosts, or a short `SESSION_TIMEOUT_MINUTES`. | Sync time (NTP); check the setting. |
| An account is locked | `AUTH_MAX_LOGIN_ATTEMPTS` failures within the lockout window. | Wait for `AUTH_LOCKOUT_DURATION` (default 15 minutes). |
| No user can sign in on a new install | No accounts exist yet. | Create them with [`bootstrap-admin`](../install/first-admin.md). |
| A platform administrator lost the authenticator or password | The platform console requires the password and a second factor (an authenticator code or a security key). | Another platform administrator (for example the break-glass one) resets the credentials in the platform console, under **Security > Administrators**. |
| A platform administrator cannot sign in on the organization site | By design: an administrator's account is refused there with the same answer as a wrong password, and the API logs `alert=platform_admin_main_site_sign_in`. | Sign in at the platform console (`https://<host>:8443` or your console host name). |
| The platform console answers `403` | Your address is outside the console's allowed networks (`OPENCTEM_ADMIN_ALLOWED_CIDRS`, private ranges by default). | Reach it from an allowed network (VPN) or widen the list on the server. |
| Signed out of the console after a few minutes | Console sessions end after 15 minutes without use and 8 hours at most; an administrator holds at most 3 sessions, and opening a fourth ends the oldest. | Sign in again. Page refreshes in an idle tab do not count as activity. |
| A console change fails with `401` right after an upgrade or restart | The session-bound CSRF token no longer matches (a different `AUTH_JWT_SECRET`, or a console tab open across an upgrade). | Reload the page, or sign in again. With several API replicas every one must hold the same `AUTH_JWT_SECRET` ([Scaling](scaling.md#the-consoles-csrf-key-must-be-shared)). |
| A console change fails with `503 AUDIT_UNAVAILABLE` | A super administrator's write is recorded before it runs; the audit log could not be written, so nothing changed. | Check the database and the API log, then repeat the change. |
| A console change fails with `428 SECOND_APPROVAL_REQUIRED` | The action needs a second super admin ([four-eyes approvals](../security/hardening.md#four-eyes-approvals)). | Ask for approval in the dialog; the other super admin approves under **Security > Approvals**; then repeat the action within 24 hours. |

## Users see no assets or findings

A member sees only the assets of their access groups and explicit grants; a
member in no group sees nothing. Owners, administrators and roles with full data
access see everything. Add the user to a group that holds the assets: see
[Roles, groups and permissions](../identity/roles-and-permissions.md).

## Email is not delivered

When no platform SMTP server is set (**Settings > E-mail** in the platform console, or `BOOTSTRAP_SMTP_*` on a headless install), the API logs `email service not configured, skipping ... email`
each time it would have sent one (verification, password reset, ...).
See [Email (SMTP)](../configuration/email.md#troubleshooting).

## Gateway and TLS

Certificate errors, port conflicts, `413` on uploads and wrong client addresses
are covered in [TLS and the gateway](../install/tls-and-gateway.md#troubleshooting).

## Sensors

Offline sensors, rejected keys and certificate errors on sensor hosts are covered
in [Sensors: troubleshooting](../sensors/troubleshooting.md).

## Scans

| Symptom | What to check |
|---|---|
| A task stays queued | Open **Why waiting?** on the task in the run. The usual reasons are another task scanning the same hosts, a scan window, or no sensor in the zone with the tool. See [Why a task waits](../scanning/why-waiting.md). |
| Run refused when triggered | **Run now** shows the refusal code and its fix (for example `NO_SENSOR_FOR_TOOL`, `ALL_TARGETS_EXCLUDED`, `SCAN_WINDOW_NEVER_OPENS`, `MAX_CONCURRENT_RUNS`). See [Starting a run](../scanning/scans-and-runs.md#starting-a-run). |
| A step `DEADLINE_TOO_CLOSE` | Too little time was left before the run's deadline for that step. Its targets roll over to the next scheduled run; raise or clear the scan's **Max duration** if the run should finish in one go ([Run deadline](../scanning/scans-and-runs.md#run-deadline)). |
| A task was re-queued as stalled | Nothing moved in the task for its stall window (no target finished, no output, no CPU time). Its sensor was asked to hand back what it finished, and only the unfinished targets run again ([Liveness and stalls](../scanning/scans-and-runs.md#liveness-and-stalls)). Check the sensor's log for the tool. |
| A step failed with `COMMAND_EXHAUSTED` | The task was handed out the maximum number of times and never finished. Check the sensor's logs for the task, then run the scan again. |
| A run is `partial` with skipped targets | The task list shows which targets were skipped and why (outside the sensor's policy, not a valid target, refused) and which hosts were not fully covered. |

## Requests refused

| Status | Cause |
|---|---|
| `429` | Rate limit: `RATE_LIMIT_RPS` / `RATE_LIMIT_BURST` per client, `RATE_LIMIT_READ_PER_MIN` per user for reads, stricter limits on sign-in, and for an API key or MCP connection its hourly limit and a burst of 60. An organization's ingest queue is full (`INGEST_MAX_PENDING_PER_TENANT`; code `INGEST_QUEUE_FULL`, with `Retry-After`) for a CI upload, an import or (in `INGEST_MODE=async`) a scan result. |
| `503 Server at capacity, please retry later` | More than `MAX_CONCURRENT_REQUESTS` requests in progress. |
| `413` | Body larger than the route's limit or the gateway's `GATEWAY_MAX_BODY_SIZE`. |
| `404` on `/metrics` | No `METRICS_TOKEN` set or the wrong token, or the request went through the gateway (which never serves it). |

## Disk full

PostgreSQL stops accepting writes when its disk fills, and the API then fails
every request that writes. Free space first (old container logs, images with
`docker image prune`, old backups on the same disk), then check that
`postgres` is healthy. Watch disk space with the
[monitoring stack](monitoring.md) (`HostDiskLow`, `HostDiskFillingFast`).

## Collecting information for a report

```bash
docker compose ps -a > report-ps.txt
docker compose images > report-images.txt
docker compose logs --since 1h api web gateway migrate > report-logs.txt
```

Review the files before sharing them: logs contain email addresses, host names
and IP addresses. Never share `.env`. Report security issues privately, as
described in [Vulnerability disclosure](../security/vulnerability-disclosure.md).
