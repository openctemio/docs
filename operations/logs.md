---
title: Log reference
parent: Operations
nav_order: 8
---

# Log reference
{: .no_toc }

Where each component logs, what the lines look like, and the messages worth
knowing. Every component writes to standard output; there is no log file inside
the containers. For the audit trail of user and administrator actions, which is
stored in the database, see [Audit log](../security/audit-log.md).

1. TOC
{:toc}

---

## Where to find the logs

| Deployment | Command |
|---|---|
| Docker Compose | `docker compose logs -f api` (or `web`, `gateway`, `migrate`, `db-roles`, `postgres`, `redis`) |
| All-in-one | `docker logs -f openctem`. Each line is prefixed `[api]`, `[web]`, `[gateway]`, `[migrate]` or `[supervise]`. |
| Kubernetes | `kubectl -n openctem logs deploy/openctem-api` (or `deploy/openctem-ui`, `deploy/openctem-gateway`, `job/openctem-api-migrations`) |

The Compose stack rotates container logs with Docker's `json-file` driver: 50 MB
per file, 5 files per container. To keep logs longer, ship them with your log
collector (Docker logging driver, Fluent Bit, Vector, the Kubernetes node agent).

## API

### Format

`LOG_FORMAT=json` (the default outside `APP_ENV=development`) writes one JSON
object per line:

```json
{"time":"2026-10-08T07:29:08.0031889Z","level":"INFO","msg":"starting application","app":"openctem","env":"production"}
```

`time`, `level` and `msg` are always present; the rest are attributes of the
event. `LOG_FORMAT=text` writes the same as `key=value` pairs.

### Levels

`LOG_LEVEL` sets the minimum level: `debug`, `info` (default outside
development), `warn` or `error`. Production refuses `debug`.

### Request log

Each HTTP request writes one `http request` line after it completes:

```json
{"time":"2026-10-08T07:30:24.413037991Z","level":"WARN","msg":"http request","method":"GET","path":"/api/v1/assets","status":401,"duration":820294,"request_id":"4af35544-ddcb-4e9a-bda4-0645bb34062e","remote_addr":"198.51.100.10:50446","user_agent":"curl/8.5.0"}
```

| Field | Meaning |
|---|---|
| `method`, `path` | The request. Secret path segments of legacy invitation links are replaced with `{redacted}`; the query string is not logged. |
| `status` | Response status. |
| `duration` | Handling time, in nanoseconds in JSON. |
| `request_id` | See [Request IDs](#request-ids). |
| `remote_addr` | The TCP peer (the gateway or the console in a gateway deployment). The client address used for audit and rate limits is resolved separately from trusted proxies. |
| `user_agent` | Client User-Agent, up to 200 characters. Sensors identify as `openctemio-sensor/<version> openctem-sdk-go/<version>`. |

The level follows the outcome: 5xx at ERROR, 4xx at WARN, a request slower than
`LOG_SLOW_REQUEST_SECONDS` (default 5) at WARN as `slow http request`, everything
else at INFO. Health, readiness, metrics and WebSocket requests (`/health`,
`/ready`, `/metrics`, `/api/v1/ws` and similar) are never logged.

### Request IDs

Every response carries an `X-Request-ID` header. A client may send its own
(1 to 64 characters from `A-Z a-z 0-9 . _ -`); anything else is replaced with a
new UUID. The same ID appears in the request log line and in every log line the
request produces, so quote it when reporting a problem.

### Redaction

Attribute values whose key names a credential are written as `[REDACTED]`: for
example `password`, `secret`, `token`, `authorization`, `api_key`,
`private_key`, `access_token`, `refresh_token`, `cookie`, `session`, `csrf`,
`client_secret`, `dsn`, `database_url`, and keys containing them such as
`db_password`. In production, recovered panics are logged without a stack trace.

### Sampling

With `LOG_SAMPLING_ENABLED=true`, records with the same level and message beyond
`LOG_SAMPLING_THRESHOLD` per second are sampled at `LOG_SAMPLING_RATE`
(`LOG_ERROR_SAMPLING_RATE` for errors). The `openctem_log_records_total` metric
counts WARN and ERROR records before sampling, labelled by `component`.

### Messages worth knowing

Start-up, in order:

| Message | Level | Meaning |
|---|---|---|
| `starting application` | INFO | Configuration loaded; `env` shows `APP_ENV`. |
| `database connected` | INFO | |
| `database schema up to date` | INFO | `applied_version` equals `latest_migration`. |
| `redis connected` | INFO | `tls` shows whether TLS is on. |
| `credentials encryption enabled` | INFO | `APP_ENCRYPTION_KEY` is in use. |
| `application started` | INFO | Listening; `http_addr` shows the address. |

Problems:

| Message | Level | Meaning |
|---|---|---|
| `failed to load configuration` | ERROR | A setting is invalid or missing; `error` names it. The API exits. See [Production checks](../configuration/environment-variables.md#production-checks). |
| `database schema check failed — refusing to start` | ERROR | The schema is behind, dirty or older than the migration baseline. Run the migrations; see [Upgrading](upgrade.md). |
| `failed to connect to database` / `failed to connect to redis` | ERROR | Host, credentials or TLS settings. |
| `jira webhook preflight failed` | ERROR | Production only: a connected Jira integration has no webhook secret. Set one for the organization or `JIRA_WEBHOOK_SECRET`. |
| `email service not configured - email features will be disabled` | WARN | No system SMTP; invitation and password-reset email is not sent. See [Email (SMTP)](../configuration/email.md). |
| `email task handlers NOT registered - SMTP is not configured; other job handlers still run` | WARN | Same cause. |
| `panic recovered` | ERROR | A handler or background task panicked; the request got 500. Counted by `openctem_panics_recovered_total`. |
| `shutting down...`, `application stopped` | INFO | Graceful shutdown (`SERVER_SHUTDOWN_TIMEOUT`). |

## Web console

The Next.js server writes plain-text lines: its start-up banner (`Ready in ...`),
configuration warnings (for example when `CSRF_SECRET` is missing or short), and
errors from its API proxy. It has no request log; the gateway's access log and
the API's request log cover requests.

## Gateway

Caddy writes its runtime log and one access-log line per request, in readable
console format (not JSON):

```text
2026/10/08 07:30:24.415	INFO	http.log.access.log0	handled request	{"request": {"remote_ip": "203.0.113.7", "client_ip": "203.0.113.7", "proto": "HTTP/2.0", "method": "GET", "host": "ctem.example.com", "uri": "/login", ...}, "status": 200, ...}
```

Before a line is written the gateway redacts the `Authorization` and `Cookie`
headers, deletes `X-API-Key`, `X-Sensor-Api-Key` and `X-CSRF-Token`, and replaces
invitation tokens in legacy paths and WebSocket `ticket` query values with
`REDACTED`. Start-up problems are reported as `openctem-gateway: <message>` with
exit code 64.

## Migrations

The `migrate` job (Compose), the migration Job (Helm) and the `[migrate]` lines
of the all-in-one image print each applied migration as
`<version>/u <name> (<duration>)`, or `no change` when the schema is current. A
failure leaves the schema dirty; see [Troubleshooting](troubleshooting.md#migrations).
