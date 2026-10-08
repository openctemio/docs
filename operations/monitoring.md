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
| Docker Compose | Add it to the `api` service in `docker-compose.override.yml` (see [Setting other variables](../install/docker-compose.md#setting-other-variables)) and to `.env`. The `api` service does not pass it on by default. |
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

Metric labels never carry organization, user, sensor or target identifiers, so
alerts can be sent to chat tools safely.

## The monitoring stack

`deploy/observability/` in the openctem repository is a Compose stack with
Prometheus, Alertmanager (Telegram and Slack receivers), node-exporter, cAdvisor,
PostgreSQL and Redis exporters, blackbox probes of `/health`, the sign-in page
and the public URL (including certificate expiry), and an optional Grafana
dashboard. It publishes nothing on a public interface: the UIs bind to
`127.0.0.1` (Prometheus `9091`, Alertmanager `9093`, Grafana `3001`). It needs
under 1 GB of memory.

It joins the OpenCTEM Compose network to scrape the API. For the production
stack in `api/deploy` (project `openctem`), set in the `.env` you pass to it:

```bash
OBS_APP_NETWORK=openctem_openctem
OBS_API_UPSTREAM=api:8080
OBS_WEB_UPSTREAM=web:3000
OBS_PUBLIC_URL=https://ctem.example.com
OBS_PUBLIC_PROBE_MODULE=http_2xx_internal_ca   # http_2xx with a publicly trusted certificate
```

plus `METRICS_TOKEN`, the receivers (`ALERT_TELEGRAM_BOT_TOKEN` and
`ALERT_TELEGRAM_CHAT_ID`, or `ALERT_SLACK_WEBHOOK_URL`) and
`OBS_PG_MONITOR_PASSWORD`. Create the exporter's PostgreSQL role (`pg_monitor`
only, no table access) as the superuser, from `api/deploy`:

```bash
docker compose exec -T postgres psql -U postgres -d openctem \
  -v pw="$OBS_PG_MONITOR_PASSWORD" -f - < ../../deploy/observability/postgres/monitor-role.sql
```

Start it from the repository root:

```bash
docker compose -p openctemio-obs --env-file api/deploy/.env \
  -f deploy/observability/docker-compose.yml --profile observability up -d
```

{: .note }
The Redis exporter in this stack connects without TLS, so it cannot scrape the
TLS-only Redis of the production Compose stack.

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
- Backup freshness.

Logs are described in the [Log reference](logs.md).
