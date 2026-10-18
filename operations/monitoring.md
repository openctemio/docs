---
title: Monitoring
parent: Operations
nav_order: 5
---

# Monitoring
{: .no_toc }

How to know the platform itself is healthy: health checks, Prometheus metrics,
and the optional monitoring stack with alert rules and a runbook per alert. The
full operator guide, with every alert's runbook, is
[monitoring.md](https://github.com/openctemio/openctem/blob/develop/api/docs/operations/monitoring.md)
in the openctem repository.

What organizations are told about their own data (new findings, SLA breaches)
is a different feature: [Notification channels](../configuration/notifications.md).

1. TOC
{:toc}

---

## Health endpoints

| Endpoint | Reachable from | Answers |
|---|---|---|
| `GET /health` | Public, through the gateway | `200 {"status":"healthy",...}` while the API process is up. No version or detail. Use it for load balancers and uptime checks. |
| `GET /ready` | Inside the deployment only (404 at the gateway) | `200` with a check per dependency (`database`, `redis`) when both answer. |
| `GET /metrics` | Inside the deployment only (404 at the gateway) | Prometheus metrics, with a token. |

The API serves all three on its own port, 8080. From the Compose host:

```bash
docker compose exec api wget -qO- localhost:8080/ready
```

The web console answers `GET /api/health` on port 3000; the gateway container's
health check uses Caddy's admin API, which listens on `127.0.0.1:2019` inside
the container only.

## Metrics

`/metrics` is off until you set a token. The API then requires
`Authorization: Bearer <METRICS_TOKEN>` (or the header `X-Metrics-Token`) and
answers 404 to anything else. `METRICS_PUBLIC=true` removes the token check; use
it only when port 8080 is reachable from a private scrape network alone.

| Deployment | How to set `METRICS_TOKEN` |
|---|---|
| Docker Compose | `METRICS_TOKEN=...` in `.env`; the `api` service passes it on (empty: metrics off). |
| All-in-one | `METRICS_TOKEN=...` in the env file. |
| Helm | `monitoring.enabled: true` generates it into a Secret, optionally with a `ServiceMonitor` and a `PrometheusRule` (`monitoring.serviceMonitor.enabled`, `monitoring.prometheusRule.enabled`). |

Generate it with `openssl rand -hex 32`. A Prometheus scrape job for your own
server:

```yaml
scrape_configs:
  - job_name: openctem-api
    metrics_path: /metrics
    authorization:
      type: Bearer
      credentials_file: /etc/prometheus/openctem-metrics-token
    static_configs:
      - targets: ["api:8080"]
```

Besides the Go runtime and process metrics, the API exposes among others:

| Metric | What |
|---|---|
| `http_requests_total`, `http_request_duration_seconds` | Every response, labelled with method, route pattern and status. |
| `openctem_log_records_total{level,component}` | WARN and ERROR log records written. |
| `openctem_panics_recovered_total{where}` | Recovered panics. |
| `openctem_auth_login_failures_total{reason}` | Refused password sign-ins. |
| `openctem_automation_runs_total`, `openctem_automations_auto_paused_total` | Automation runs and automations paused after repeated failures. |
| `openctem_storage_operations_total{op,backend,result}`, `openctem_storage_operation_seconds`, `openctem_storage_bytes_written_total` | File storage uploads, downloads, deletes and signed links, on the server storage or organizations' own buckets ([File storage](../configuration/file-storage.md)). |
| `openctem_storage_events_total{event}` | Quota rejections, retention purges and malware scan results. |
| `openctem_schema_version`, `openctem_schema_dirty` | Database migration state (applied and shipped). |
| `openctem_build_info{version,commit}` | The running build. |
| `openctem_sensors`, `openctem_sensors_unhardened`, `openctem_command_queue_depth`, `openctem_command_oldest_pending_seconds`, `openctem_scan_runs_open` | Active sensors, sensors with weak settings, and the sensor command and scan run queues (platform-wide counts). |
| `openctem_outbox_entries`, `openctem_outbox_oldest_pending_seconds` | The notification outbox. |
| `openctem_security_audit_chain_breaks_total{reason}` | New breaks of the audit log hash chain. |
| `openctem_signup_events_total{kind,source}` | Sign-up events recorded for the console's sign-up feed. |
| `openctem_signup_burst_alerts_total{dimension,kind}` | Sign-up burst alerts raised: many sign-ups of one kind from one network (`ip_prefix`) or one e-mail domain (`email_domain`) within the window. The prefix or domain is in the administrators' audit log, never a label. The `SignupBurst` rule alerts on it. |

Metric labels never carry organization, user, sensor or target identifiers, so
alerts can be sent to chat tools safely.

## The Health page (no monitoring stack needed)

The platform console's **Monitoring > Health** page (`/health` on the console site;
read-only, every platform administrator role) is the one place to see whether the installation is
well. It shows service health (API, web, gateway), free space of the data volumes in
`SYSTEM_STORAGE_PATHS`, the database size, the last successful backup
(`SYSTEM_BACKUP_STATUS_FILE`), certificate expiry (the sensor CA and `SYSTEM_TLS_CERT_FILES`),
the schema state and the running version, and what the API reports about its own work: sensor
transport and counts, command and scan queues and background jobs. The two halves load
independently, so one failing read never hides the other. The older System and Operations pages
no longer exist; `/system` and `/operations` do not redirect.

A watcher checks the host values every `SYSTEM_WATCH_INTERVAL` (5 minutes), sets the
`openctem_system_*` metrics (`storage_free_ratio`, `storage_level`, `database_bytes`,
`backup_age_seconds`, `backup_level`, `certificate_expiry_seconds`, `certificate_level`; levels 0
ok, 1 warning, 2 critical) and alerts the platform administrators when a check gets worse. Warnings
start at 20% free space, a backup older than 26 hours, and a certificate within 30 days; critical
at 10% free space and 7 days. The page holds no action: backup, restore, upgrade and key rotation
stay on the command line. The same findings appear in the console Overview's "Needs attention"
list.

### Where administrator alerts go

Alerts reach the active platform administrators by e-mail (which needs the platform e-mail in
**Settings > E-mail**) and, when you turn it on, an HTTPS webhook set in **Settings > Alerts**:

- The webhook address is a credential: it is stored encrypted, shown only as its host, and never
  read back. An optional signing secret adds `X-OpenCTEM-Timestamp` and `X-OpenCTEM-Signature:
  sha256=<hex>`, the HMAC-SHA256 of `timestamp + "." + body` under the secret.
- **Send a test alert** posts to the saved address and reports whether the receiver accepted it.
- Only a super admin changes it, with a fresh confirmation and a reason. The change is a critical
  entry in the administrators' audit log and notifies every administrator.
- Without e-mail and without a webhook, the WARN log lines (`alert=system_storage`,
  `system_backup`, `system_cert`, `signup_burst`) and the metrics are the alert. A failed webhook
  delivery logs `alert=alert_webhook_failed`.

The Alertmanager receivers of the monitoring stack below are separate: they carry the Prometheus
alerts.

## The monitoring stack

`deploy/observability/` in the openctem repository is a Compose stack with
Prometheus, Alertmanager (Telegram and Slack receivers), node-exporter, cAdvisor,
PostgreSQL and Redis exporters, blackbox probes of `/health`, the sign-in page
and the public URL (including certificate expiry), and an optional Grafana
dashboard. It publishes nothing on a public interface: the UIs bind to
`127.0.0.1` (Prometheus `9091`, Alertmanager `9093`, Grafana `3001`). It needs
under 1 GB of memory.

It joins the OpenCTEM Compose network to scrape the API. For the production
stack in `api/deploy` (project `openctem`), add the overlay
`deploy/observability/docker-compose.openctem.yml`: it sets that stack's
network (`openctem_openctem`), the `web` service, PostgreSQL with
`sslmode=require`, and Redis over TLS (`rediss://`) verified against the stack's
datastore CA, mounted read-only from the `openctem_datastore-tls` volume. Every
value can still be overridden from the environment.

Set in the `.env` you pass to it (the stack's own `api/deploy/.env` already holds
`METRICS_TOKEN` and `REDIS_PASSWORD`):

```bash
OBS_PUBLIC_URL=https://ctem.example.com
OBS_PUBLIC_PROBE_MODULE=http_2xx_internal_ca   # http_2xx with a publicly trusted certificate
OBS_PG_MONITOR_PASSWORD=...                    # openssl rand -hex 24
```

plus the receivers (`ALERT_TELEGRAM_BOT_TOKEN` and `ALERT_TELEGRAM_CHAT_ID`, or
`ALERT_SLACK_WEBHOOK_URL`). Create the exporter's PostgreSQL role as the
superuser, from `api/deploy`. It gets `pg_monitor` and `CONNECT` on the
database only, no table access (the least-privilege roles revoke `CONNECT` from
`PUBLIC`):

```bash
export OBS_PG_MONITOR_PASSWORD=...   # the value from .env
docker compose exec -T postgres psql -U postgres -d openctem \
  -v pw="$OBS_PG_MONITOR_PASSWORD" -f - < ../../deploy/observability/postgres/monitor-role.sql
```

The script is idempotent: re-run it to change the password, or after upgrading
from a release whose script did not grant `CONNECT` (the exporter then reports
`pg_up` 0).

Start it from the repository root:

```bash
docker compose -p openctem-obs --env-file api/deploy/.env \
  -f deploy/observability/docker-compose.yml \
  -f deploy/observability/docker-compose.openctem.yml \
  --profile observability up -d
```

For the `BackupStale` and `BackupFailed` alerts, run
[`backup.sh`](backup-restore.md#back-up-docker-compose) with
`METRICS_TEXTFILE_DIR` set to the node-exporter textfile directory
(`OBS_TEXTFILE_DIR`, default `/var/lib/node_exporter/textfile`).

The variables, the alert list and a runbook per alert (API down, error bursts,
schema behind or dirty, sensors offline, stuck queues, audit chain breaks, disk,
memory, backups and more) are in the
[full guide](https://github.com/openctemio/openctem/blob/develop/api/docs/operations/monitoring.md).
On Kubernetes the chart ships the same rules for the API (see above).

## What to watch first

- `/health` from outside, and certificate expiry of the public URL.
- 5xx rate and latency of `http_requests_total` /
  `http_request_duration_seconds`.
- `openctem_log_records_total{level="error"}` and recovered panics.
- Disk space of the PostgreSQL volume: PostgreSQL stops when it fills.
- Sensors offline, from the console's Sensors page or the `SensorsOffline` alert.
- Backup freshness, certificate expiry and free space: the console's Monitoring > Health page.
- `SignupBurst` on an open or domain sign-up installation: bots registering from one network.

Logs are described in the [Log reference](logs.md).
