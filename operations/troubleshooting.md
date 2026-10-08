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
| `KEYCLOAK_BASE_URL must be set in production` | `AUTH_PROVIDER` is unset (default `oidc`) or `oidc`/`hybrid` without Keycloak. | Set `AUTH_PROVIDER=local` unless you use Keycloak. |
| `database schema check failed — refusing to start` | Migrations did not run, failed (dirty), or the database predates the migration baseline. | See [Migrations](#migrations). |
| `failed to connect to database` | Host, credentials, or TLS (`DB_SSLMODE`). | Check `DB_*`; production refuses `DB_SSLMODE=disable`. |
| `failed to connect to redis` | Host, password, or TLS. | Check `REDIS_*`; production requires TLS and a 32+ character password. |
| `jira webhook preflight failed` | Production, a connected Jira integration without a webhook secret. | Set the organization's Jira webhook secret, or `JIRA_WEBHOOK_SECRET`. |

## Migrations

Read the migration state:

```bash
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT version, dirty FROM schema_migrations"'
docker compose logs migrate
```

- **Behind** (`version` lower than the release's newest migration): run
  `docker compose up -d` again; the `migrate` job applies them before the API.
- **Dirty** (`dirty = t`): a migration failed midway. The `migrate` log names the
  version and the error, usually data that violates a new constraint. Fix the
  cause, then mark the last cleanly applied version and run the migrations again.
  `force` only rewrites the version marker; it runs no SQL:

  ```bash
  set -a; . ./.env; set +a
  DBURL="postgres://${DB_MIGRATE_USER:-$DB_USER}:${DB_MIGRATE_PASSWORD:-$DB_PASSWORD}@postgres:5432/${DB_NAME:-openctem}?sslmode=${DB_SSLMODE:-require}"
  docker compose run --rm migrate -path=/migrations -database "$DBURL" version
  docker compose run --rm migrate -path=/migrations -database "$DBURL" force <last-good-version>
  docker compose up -d
  ```

  If the failed migration created objects outside its transaction, remove them by
  hand first. When in doubt, restore the pre-upgrade backup.
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

## Cannot sign in

| Symptom | Cause | Fix |
|---|---|---|
| The sign-in page loops back, or the session is lost at once | Cookies are `Secure` and the browser is on `http://`. | Use the HTTPS URL. |
| Live updates never connect; `websocket upgrade rejected: origin not allowed` in the API log | `OPENCTEM_PUBLIC_URL` (or `CORS_ALLOWED_ORIGINS`) differs from the browser's origin, often by the port. | Set it to the exact origin and restart. |
| `401 Session has expired` soon after sign-in | Clock skew between hosts, or a short `SESSION_TIMEOUT_MINUTES`. | Sync time (NTP); check the setting. |
| An account is locked | `AUTH_MAX_LOGIN_ATTEMPTS` failures within the lockout window. | Wait for `AUTH_LOCKOUT_DURATION` (default 15 minutes). |
| No user can sign in on a new install | No accounts exist yet. | Create them with [`bootstrap-admin`](../install/first-admin.md). |
| A platform administrator lost the authenticator or password | The admin console requires the password and a TOTP code. | Another platform administrator (for example the break-glass one) resets the credentials in the admin console, under **Administrators**. |

## Users see no assets or findings

A member sees only the assets of their access groups and explicit grants; a
member in no group sees nothing. Owners, administrators and roles with full data
access see everything. Add the user to a group that holds the assets: see
[Roles, groups and permissions](../identity/roles-and-permissions.md).

## Email is not delivered

The API logs `email service not configured` at start when system SMTP is off.
See [Email (SMTP)](../configuration/email.md#troubleshooting).

## Gateway and TLS

Certificate errors, port conflicts, `413` on uploads and wrong client addresses
are covered in [TLS and the gateway](../install/tls-and-gateway.md#troubleshooting).

## Sensors

Offline sensors, rejected keys and certificate errors on sensor hosts are covered
in [Sensors: troubleshooting](../sensors/troubleshooting.md).

## Requests refused

| Status | Cause |
|---|---|
| `429` | Rate limit: `RATE_LIMIT_RPS` / `RATE_LIMIT_BURST` per client, `RATE_LIMIT_READ_PER_MIN` per user for reads, stricter limits on sign-in. In `INGEST_MODE=async`, an organization's ingest queue is full (`INGEST_MAX_PENDING_PER_TENANT`). |
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
