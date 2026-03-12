# Monitoring Stack Setup Guide

Complete guide for deploying and configuring the OpenCTEM monitoring stack with Prometheus, Grafana, AlertManager, and infrastructure exporters.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Docker Compose Setup](#2-docker-compose-setup)
3. [Prometheus Configuration](#3-prometheus-configuration)
4. [Grafana Setup](#4-grafana-setup)
5. [AlertManager Configuration](#5-alertmanager-configuration)
6. [Available Dashboards](#6-available-dashboards)
7. [Key Metrics Reference](#7-key-metrics-reference)
8. [Alert Rules Reference](#8-alert-rules-reference)
9. [Custom Dashboards](#9-custom-dashboards)
10. [Kubernetes Monitoring](#10-kubernetes-monitoring)
11. [Log Aggregation with Loki](#11-log-aggregation-with-loki)
12. [Performance Baselines and SLI/SLO Targets](#12-performance-baselines-and-slislo-targets)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Overview

The OpenCTEM monitoring stack provides full observability across the application layer, database, cache, and host infrastructure.

### Stack Components

| Component | Image | Port | Purpose |
|---|---|---|---|
| **Prometheus** | `prom/prometheus:v2.51.0` | 9090 | Metrics collection, storage, and alerting rules |
| **Grafana** | `grafana/grafana:11.0.0` | 3001 | Dashboard visualization and exploration |
| **AlertManager** | `prom/alertmanager:v0.27.0` | 9093 | Alert routing, grouping, and notification dispatch |
| **postgres-exporter** | `prometheuscommunity/postgres-exporter:v0.15.0` | 9187 | PostgreSQL metrics exporter |
| **redis-exporter** | `oliver006/redis_exporter:v1.58.0` | 9121 | Redis metrics exporter |
| **node-exporter** | `prom/node-exporter:v1.7.0` | 9100 | Host-level CPU, memory, disk, and network metrics |

### Architecture

```
                    ┌──────────────────────────────┐
                    │          Grafana :3001        │
                    │   (Dashboards & Exploration)  │
                    └──────────┬───────────────────┘
                               │ queries
                    ┌──────────▼───────────────────┐
                    │       Prometheus :9090        │
                    │  (Scrape, Store, Evaluate)    │
                    └──┬───────┬────────┬──────┬───┘
                       │       │        │      │
          ┌────────────▼┐  ┌──▼────┐ ┌─▼────┐ ┌▼──────────┐
          │ API :8080    │  │PG Exp │ │Redis │ │Node Exp   │
          │ /metrics     │  │:9187  │ │Exp   │ │:9100      │
          └──────────────┘  └───────┘ │:9121 │ └───────────┘
                                      └──────┘
                    ┌──────────────────────────────┐
                    │     AlertManager :9093        │
                    │  (Slack, Email, PagerDuty)    │
                    └──────────────────────────────┘
```

---

## 2. Docker Compose Setup

Create a file named `docker-compose.monitoring.yml` alongside your production compose file. This stack connects to the same `app-network` used by the production services.

```yaml
# docker-compose.monitoring.yml
# Usage:
#   docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml up -d

services:
  # ---------------------------------------------------------------------------
  # Prometheus - Metrics Collection & Storage
  # ---------------------------------------------------------------------------
  prometheus:
    image: prom/prometheus:v2.51.0
    restart: always
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.path=/prometheus"
      - "--storage.tsdb.retention.time=30d"
      - "--storage.tsdb.retention.size=10GB"
      - "--web.enable-lifecycle"
      - "--web.enable-admin-api"
    volumes:
      - ./setup/monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./setup/monitoring/alertmanager/alerts.yml:/etc/prometheus/alerts.yml:ro
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - app-network
    security_opt:
      - no-new-privileges:true
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 2G
        reservations:
          cpus: '0.25'
          memory: 512M
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:9090/-/healthy"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "3"

  # ---------------------------------------------------------------------------
  # Grafana - Dashboards & Visualization
  # ---------------------------------------------------------------------------
  grafana:
    image: grafana/grafana:11.0.0
    restart: always
    environment:
      GF_SECURITY_ADMIN_USER: ${GRAFANA_ADMIN_USER:-admin}
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-changeme}
      GF_USERS_ALLOW_SIGN_UP: "false"
      GF_SERVER_ROOT_URL: ${GRAFANA_ROOT_URL:-http://localhost:3001}
      GF_INSTALL_PLUGINS: grafana-clock-panel,grafana-piechart-panel
    volumes:
      - ./setup/monitoring/grafana/provisioning/datasources.yml:/etc/grafana/provisioning/datasources/datasources.yml:ro
      - ./setup/monitoring/grafana/provisioning/dashboards.yml:/etc/grafana/provisioning/dashboards/dashboards.yml:ro
      - ./setup/monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro
      - grafana_data:/var/lib/grafana
    ports:
      - "3001:3000"
    depends_on:
      prometheus:
        condition: service_healthy
    networks:
      - app-network
    security_opt:
      - no-new-privileges:true
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.1'
          memory: 128M
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "3"

  # ---------------------------------------------------------------------------
  # AlertManager - Alert Routing & Notifications
  # ---------------------------------------------------------------------------
  alertmanager:
    image: prom/alertmanager:v0.27.0
    restart: always
    command:
      - "--config.file=/etc/alertmanager/alertmanager.yml"
      - "--storage.path=/alertmanager"
    volumes:
      - ./setup/monitoring/alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
      - alertmanager_data:/alertmanager
    ports:
      - "9093:9093"
    networks:
      - app-network
    security_opt:
      - no-new-privileges:true
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.1'
          memory: 64M
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:9093/-/healthy"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "3"

  # ---------------------------------------------------------------------------
  # PostgreSQL Exporter
  # ---------------------------------------------------------------------------
  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:v0.15.0
    restart: always
    environment:
      DATA_SOURCE_NAME: "postgresql://${DB_USER:-openctem}:${DB_PASSWORD}@postgres:5432/${DB_NAME:-openctem}?sslmode=disable"
    expose:
      - "9187"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - app-network
    security_opt:
      - no-new-privileges:true
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 128M
    logging:
      driver: "json-file"
      options:
        max-size: "20m"
        max-file: "3"

  # ---------------------------------------------------------------------------
  # Redis Exporter
  # ---------------------------------------------------------------------------
  redis-exporter:
    image: oliver006/redis_exporter:v1.58.0
    restart: always
    environment:
      REDIS_ADDR: "redis://redis:6379"
      REDIS_PASSWORD: ${REDIS_PASSWORD}
    expose:
      - "9121"
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - app-network
    security_opt:
      - no-new-privileges:true
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 128M
    logging:
      driver: "json-file"
      options:
        max-size: "20m"
        max-file: "3"

  # ---------------------------------------------------------------------------
  # Node Exporter - Host Metrics
  # ---------------------------------------------------------------------------
  node-exporter:
    image: prom/node-exporter:v1.7.0
    restart: always
    command:
      - "--path.rootfs=/host"
      - "--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)"
    volumes:
      - /:/host:ro,rslave
    expose:
      - "9100"
    networks:
      - app-network
    pid: host
    security_opt:
      - no-new-privileges:true
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 128M
    logging:
      driver: "json-file"
      options:
        max-size: "20m"
        max-file: "3"

volumes:
  prometheus_data:
    driver: local
  grafana_data:
    driver: local
  alertmanager_data:
    driver: local

networks:
  app-network:
    external: true
```

### Launching the Stack

```bash
# Start the production stack first (creates the app-network)
docker compose -f docker-compose.prod.yml up -d

# Start the monitoring stack, joining the same network
docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml up -d

# Verify all monitoring services are healthy
docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml ps
```

### Environment Variables

Set these in a `.env.monitoring` file or export them before starting:

```bash
# Grafana
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=<strong-password>
GRAFANA_ROOT_URL=https://grafana.yourdomain.com

# Reuses existing database and redis credentials from .env.db.prod
# DB_USER, DB_PASSWORD, DB_NAME, REDIS_PASSWORD
```

---

## 3. Prometheus Configuration

The Prometheus configuration lives at `setup/monitoring/prometheus/prometheus.yml`.

### Current Scrape Targets

| Job Name | Target | Interval | Description |
|---|---|---|---|
| `openctem-api` | `api:8080/metrics` | 10s | Application HTTP and business metrics |
| `postgres-exporter` | `postgres-exporter:9187` | 15s (global) | PostgreSQL statistics |
| `redis-exporter` | `redis-exporter:9121` | 15s (global) | Redis memory, connections, commands |
| `node-exporter` | `node-exporter:9100` | 15s (global) | Host CPU, memory, disk, network |

### Global Settings

```yaml
global:
  scrape_interval: 15s        # Default interval for all jobs
  evaluation_interval: 15s    # How often alert rules are evaluated
  scrape_timeout: 10s         # Per-scrape timeout
```

The API job overrides the global interval with a 10s scrape for higher resolution on HTTP metrics.

### Retention Configuration

Set via Prometheus command-line flags in the compose file:

| Flag | Value | Description |
|---|---|---|
| `--storage.tsdb.retention.time` | `30d` | Keep metrics for 30 days |
| `--storage.tsdb.retention.size` | `10GB` | Cap storage at 10 GB |

Prometheus applies whichever limit is reached first. For longer retention, consider using Thanos or Cortex as a remote write backend.

### Adding a New Scrape Target

Edit `setup/monitoring/prometheus/prometheus.yml` and add a new entry under `scrape_configs`:

```yaml
  - job_name: "my-custom-service"
    metrics_path: /metrics
    static_configs:
      - targets: ["my-service:8080"]
        labels:
          service: "my-service"
          environment: "production"
    scrape_interval: 30s
```

Reload Prometheus without restarting (requires `--web.enable-lifecycle`):

```bash
curl -X POST http://localhost:9090/-/reload
```

---

## 4. Grafana Setup

### Accessing the UI

After starting the monitoring stack:

1. Open `http://localhost:3001` in your browser.
2. Log in with the credentials configured via environment variables (default: `admin` / `changeme`).
3. Change the default password immediately on first login.

### Provisioned Data Source

Grafana is automatically configured with a Prometheus data source via `setup/monitoring/grafana/provisioning/datasources.yml`:

- **Name:** Prometheus
- **URL:** `http://prometheus:9090` (internal Docker network)
- **Default:** Yes
- **Min interval:** 15s (matches Prometheus scrape interval)

The data source is set to `editable: true`, so you can modify settings through the UI if needed.

### Provisioned Dashboards

Dashboards are loaded from JSON files in `setup/monitoring/grafana/dashboards/` via the provisioning config at `setup/monitoring/grafana/provisioning/dashboards.yml`:

- **Provider name:** OpenCTEM
- **Folder:** OpenCTEM
- **Auto-refresh interval:** 30 seconds
- **Editable:** Yes (changes are not persisted back to the JSON files)

The dashboards are mounted read-only into the Grafana container at `/var/lib/grafana/dashboards`.

---

## 5. AlertManager Configuration

### Configuration File

Create `setup/monitoring/alertmanager/alertmanager.yml` with routing rules for your notification channels.

### Slack Integration

```yaml
global:
  resolve_timeout: 5m
  slack_api_url: "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"

route:
  group_by: ["alertname", "severity"]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: "slack-critical"
  routes:
    - match:
        severity: critical
      receiver: "pagerduty-critical"
      continue: true
    - match:
        severity: critical
      receiver: "slack-critical"
    - match:
        severity: warning
      receiver: "slack-warnings"

receivers:
  - name: "slack-critical"
    slack_configs:
      - channel: "#openctem-alerts-critical"
        title: '{{ .GroupLabels.alertname }} - {{ .Status | toUpper }}'
        text: >-
          {{ range .Alerts }}
          *Alert:* {{ .Annotations.summary }}
          *Description:* {{ .Annotations.description }}
          *Severity:* {{ .Labels.severity }}
          *Started:* {{ .StartsAt | since }}
          {{ end }}
        send_resolved: true
        color: '{{ if eq .Status "firing" }}danger{{ else }}good{{ end }}'

  - name: "slack-warnings"
    slack_configs:
      - channel: "#openctem-alerts-warnings"
        title: '{{ .GroupLabels.alertname }}'
        text: >-
          {{ range .Alerts }}
          {{ .Annotations.summary }}: {{ .Annotations.description }}
          {{ end }}
        send_resolved: true
        color: "warning"

  - name: "pagerduty-critical"
    pagerduty_configs:
      - service_key: "YOUR_PAGERDUTY_INTEGRATION_KEY"
        severity: '{{ .CommonLabels.severity }}'
        description: '{{ .CommonAnnotations.summary }}'
```

### Email Integration

Add an email receiver for daily digest or non-urgent alerts:

```yaml
  - name: "email-oncall"
    email_configs:
      - to: "oncall@yourcompany.com"
        from: "openctem-alerts@yourcompany.com"
        smarthost: "smtp.yourcompany.com:587"
        auth_username: "alerts@yourcompany.com"
        auth_password: "smtp-password"
        send_resolved: true
        headers:
          Subject: 'OpenCTEM Alert: {{ .GroupLabels.alertname }}'
```

### Validating Configuration

```bash
# Using amtool (ships inside the alertmanager container)
docker compose exec alertmanager amtool check-config /etc/alertmanager/alertmanager.yml

# Reload after changes
curl -X POST http://localhost:9093/-/reload
```

---

## 6. Available Dashboards

Three dashboards are provisioned out of the box in the "OpenCTEM" folder.

### API Overview (`api-overview.json`)

Provides a real-time view of application health.

| Panel | Metric | Description |
|---|---|---|
| Request Rate | `sum(rate(http_requests_total[5m])) by (method)` | Requests per second, broken down by HTTP method |
| Error Rate | `sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))` | Percentage of 5xx responses with color thresholds (green < 1%, yellow 1-5%, red > 5%) |
| Latency Percentiles | `histogram_quantile(0.95, ...)` | P50, P95, P99 response time distributions |
| In-Flight Requests | `http_requests_in_flight` | Current concurrency level |

### PostgreSQL Performance (`postgres-performance.json`)

Tracks database health and query performance.

| Panel | Metric | Description |
|---|---|---|
| Active Connections | `pg_stat_activity_count` vs `pg_settings_max_connections` | Current connections relative to the configured limit |
| Transaction Rate | `rate(pg_stat_database_xact_commit{datname="openctem"}[5m])` | Commits per second on the openctem database |
| Query Duration | `pg_stat_statements_mean_exec_time_ms` | Average query execution time |
| Lock Waits | `pg_locks_count` | Database lock contention |

### Notification Pipeline (`notification-pipeline.json`)

Monitors the outbox-based notification system.

| Panel | Metric | Description |
|---|---|---|
| Processing Rate | `rate(openctem_notifications_processed_total[5m])` | Notifications processed per second, by status |
| Outbox Queue Depth | `openctem_notification_outbox_pending` | Number of pending notifications waiting to be sent |
| Delivery Success Rate | processed vs failed ratio | Overall notification reliability |

---

## 7. Key Metrics Reference

### HTTP Metrics (from API)

| Metric | Type | Description | Alert Threshold |
|---|---|---|---|
| `http_requests_total` | Counter | Total HTTP requests by method, path, status | Error ratio > 5% |
| `http_request_duration_seconds` | Histogram | Request latency distribution | P99 > 5s |
| `http_requests_in_flight` | Gauge | Currently processing requests | > 100 |

**Useful PromQL queries:**

```promql
# Request rate per endpoint
sum(rate(http_requests_total[5m])) by (method, path)

# P95 latency by endpoint
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, path))

# Error rate as percentage
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100
```

### Application Metrics

| Metric | Type | Description |
|---|---|---|
| `auth_failures_total` | Counter | Failed authentication attempts |
| `security_events_total` | Counter | Security-relevant events (permission violations, suspicious activity) |
| `openctem_scan_scheduler_lag_seconds` | Gauge | Time since last scheduler execution |
| `openctem_scans_total` | Counter | Total scans by status (completed, failed) |
| `platform_agents_active` | Gauge | Number of connected platform agents |
| `openctem_notifications_processed_total` | Counter | Notification delivery by status |
| `openctem_notification_outbox_pending` | Gauge | Pending notification queue depth |

### PostgreSQL Metrics (from postgres-exporter)

| Metric | Description | Watch For |
|---|---|---|
| `pg_stat_activity_count` | Active database connections | Approaching `max_connections` |
| `pg_settings_max_connections` | Configured connection limit | Baseline reference |
| `pg_stat_database_xact_commit` | Transaction commit rate | Sudden drops |
| `pg_stat_statements_mean_exec_time_ms` | Average query execution time | > 1000ms |
| `pg_stat_database_deadlocks` | Deadlock count | Any non-zero increase |

### Redis Metrics (from redis-exporter)

| Metric | Description | Watch For |
|---|---|---|
| `redis_memory_used_bytes` | Current memory consumption | > 85% of `redis_memory_max_bytes` |
| `redis_memory_max_bytes` | Configured maxmemory | Baseline reference |
| `redis_connected_clients` | Current client connections | Sudden spikes or drops |
| `redis_commands_processed_total` | Command throughput | Throughput drops |
| `redis_keyspace_hits_total` / `redis_keyspace_misses_total` | Cache hit ratio | Hit ratio dropping below 90% |

### Host Metrics (from node-exporter)

| Metric | Description | Watch For |
|---|---|---|
| `node_cpu_seconds_total` | CPU usage by mode | Sustained > 80% utilization |
| `node_memory_MemAvailable_bytes` | Available memory | < 10% of total |
| `node_filesystem_avail_bytes` | Free disk space | < 10% of total |
| `node_network_receive_bytes_total` | Network ingress | Anomalous spikes |

---

## 8. Alert Rules Reference

Alert rules are defined in `setup/monitoring/alertmanager/alerts.yml` across five groups.

### Group: `openctem-api`

| Alert | Expression | Duration | Severity | Trigger Condition |
|---|---|---|---|---|
| **HighErrorRate** | `sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05` | 5m | Critical | More than 5% of requests returning 5xx errors |
| **HighLatencyP99** | `histogram_quantile(0.99, ...) > 5` | 10m | Warning | 99th percentile latency exceeds 5 seconds |
| **APIDown** | `up{job="openctem-api"} == 0` | 1m | Critical | Prometheus cannot reach the API metrics endpoint |
| **HighConcurrency** | `http_requests_in_flight > 100` | 5m | Warning | Over 100 simultaneous requests being processed |
| **AuthFailureSpike** | `rate(auth_failures_total[5m]) > 10` | 5m | Warning | More than 10 authentication failures per second, possible brute force |
| **SecurityEventSpike** | `rate(security_events_total[5m]) > 5` | 5m | Critical | More than 5 security events per second |

### Group: `openctem-scans`

| Alert | Expression | Duration | Severity | Trigger Condition |
|---|---|---|---|---|
| **ScanSchedulerLag** | `openctem_scan_scheduler_lag_seconds > 300` | 10m | Warning | Scan scheduler has not run for over 5 minutes |
| **ScanFailureRate** | `sum(rate(openctem_scans_total{status="failed"}[1h])) / sum(rate(openctem_scans_total[1h])) > 0.3` | 30m | Warning | More than 30% of scans failing over the past hour |

### Group: `openctem-agents`

| Alert | Expression | Duration | Severity | Trigger Condition |
|---|---|---|---|---|
| **NoActiveAgents** | `platform_agents_active == 0` | 15m | Warning | All platform agents offline for 15 minutes |

### Group: `openctem-database`

| Alert | Expression | Duration | Severity | Trigger Condition |
|---|---|---|---|---|
| **PostgresConnectionsHigh** | `pg_stat_activity_count > 80` | 5m | Warning | Active connections approaching the default limit of 100 |
| **SlowQueries** | `rate(pg_stat_statements_mean_exec_time_ms[5m]) > 1000` | 10m | Warning | Average query execution time exceeds 1 second |

### Group: `openctem-redis`

| Alert | Expression | Duration | Severity | Trigger Condition |
|---|---|---|---|---|
| **RedisMemoryHigh** | `redis_memory_used_bytes / redis_memory_max_bytes > 0.85` | 10m | Warning | Redis memory usage exceeds 85% of configured maximum |

---

## 9. Custom Dashboards

### Creating a New Dashboard

1. Open Grafana at `http://localhost:3001`.
2. Click **+ New Dashboard** from the sidebar.
3. Add panels using the visual editor or write PromQL directly.
4. Set appropriate time ranges and refresh intervals.

### Exporting a Dashboard for Version Control

1. Open the dashboard you want to export.
2. Click the **Share** icon (or gear icon > JSON Model).
3. Click **Export** and toggle **Export for sharing externally** (this sets `id` to `null` and removes instance-specific references).
4. Save the JSON file to the dashboards directory:

```bash
# Save the exported JSON
cp ~/Downloads/my-dashboard.json \
  setup/monitoring/grafana/dashboards/my-dashboard.json
```

The provisioning config automatically picks up new JSON files from `/var/lib/grafana/dashboards` (refreshes every 30 seconds).

### Dashboard Best Practices

- Use template variables (`$interval`, `$instance`) for flexibility.
- Set meaningful thresholds with color coding (green/yellow/red).
- Group related panels into rows with descriptive titles.
- Include a "Status" row at the top with stat panels for at-a-glance health.
- Use `$__rate_interval` instead of hardcoded intervals to respect scrape frequency.

### Example: Adding a Business Metrics Dashboard

```json
{
  "annotations": { "list": [] },
  "editable": true,
  "title": "OpenCTEM Business Metrics",
  "panels": [
    {
      "title": "Open Findings by Severity",
      "type": "piechart",
      "gridPos": { "h": 8, "w": 8, "x": 0, "y": 0 },
      "targets": [
        {
          "expr": "sum by (severity) (openctem_findings_total{status=\"open\"})",
          "legendFormat": "{{ severity }}",
          "refId": "A"
        }
      ]
    },
    {
      "title": "Active Scans",
      "type": "stat",
      "gridPos": { "h": 8, "w": 4, "x": 8, "y": 0 },
      "targets": [
        {
          "expr": "openctem_scans_active",
          "legendFormat": "Active",
          "refId": "A"
        }
      ]
    }
  ],
  "schemaVersion": 39,
  "timezone": "browser"
}
```

Save this as `setup/monitoring/grafana/dashboards/business-metrics.json`.

---

## 10. Kubernetes Monitoring

For Kubernetes deployments, use the Prometheus Operator and ServiceMonitor CRDs instead of static scrape configs.

### Install Prometheus Operator via Helm

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
  --set grafana.adminPassword="<strong-password>" \
  --set alertmanager.config.global.resolve_timeout=5m
```

### ServiceMonitor for OpenCTEM API

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: openctem-api
  namespace: openctem
  labels:
    release: monitoring    # Must match Prometheus Operator selector
spec:
  selector:
    matchLabels:
      app: openctem-api
  namespaceSelector:
    matchNames:
      - openctem
  endpoints:
    - port: metrics
      interval: 10s
      path: /metrics
      metricRelabelings:
        - sourceLabels: [__name__]
          regex: "go_.*"
          action: drop       # Optional: drop verbose Go runtime metrics
```

### ServiceMonitor for PostgreSQL Exporter

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: openctem-postgres
  namespace: openctem
spec:
  selector:
    matchLabels:
      app: postgres-exporter
  endpoints:
    - port: metrics
      interval: 30s
```

### PrometheusRule for Alerts

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: openctem-alerts
  namespace: monitoring
  labels:
    release: monitoring
spec:
  groups:
    - name: openctem-api
      rules:
        - alert: HighErrorRate
          expr: |
            (sum(rate(http_requests_total{status=~"5.."}[5m]))
            / sum(rate(http_requests_total[5m]))) > 0.05
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "High HTTP error rate (> 5%)"
        - alert: APIDown
          expr: up{job="openctem-api"} == 0
          for: 1m
          labels:
            severity: critical
          annotations:
            summary: "OpenCTEM API is down"
```

### Accessing Grafana in Kubernetes

```bash
kubectl port-forward -n monitoring svc/monitoring-grafana 3001:80

# Open http://localhost:3001
# User: admin
# Password: (the value set during helm install)
```

---

## 11. Log Aggregation with Loki

Grafana Loki provides log aggregation alongside metrics, queried through the same Grafana interface.

### Add Loki to the Monitoring Stack

Append the following services to `docker-compose.monitoring.yml`:

```yaml
  loki:
    image: grafana/loki:2.9.4
    restart: always
    command: -config.file=/etc/loki/loki.yml
    volumes:
      - ./setup/monitoring/loki/loki.yml:/etc/loki/loki.yml:ro
      - loki_data:/loki
    ports:
      - "3100:3100"
    networks:
      - app-network
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G

  promtail:
    image: grafana/promtail:2.9.4
    restart: always
    command: -config.file=/etc/promtail/promtail.yml
    volumes:
      - ./setup/monitoring/promtail/promtail.yml:/etc/promtail/promtail.yml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    depends_on:
      - loki
    networks:
      - app-network
```

Add `loki_data` to the volumes section.

### Minimal Loki Configuration

Create `setup/monitoring/loki/loki.yml`:

```yaml
auth_enabled: false

server:
  http_listen_port: 3100

common:
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2024-01-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

limits_config:
  retention_period: 168h    # 7 days
```

### Minimal Promtail Configuration

Create `setup/monitoring/promtail/promtail.yml`:

```yaml
server:
  http_listen_port: 9080

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      - source_labels: ["__meta_docker_container_name"]
        target_label: "container"
      - source_labels: ["__meta_docker_container_log_stream"]
        target_label: "stream"
```

### Add Loki as a Grafana Data Source

Append to `setup/monitoring/grafana/provisioning/datasources.yml`:

```yaml
  - name: Loki
    type: loki
    access: proxy
    orgId: 1
    url: http://loki:3100
    editable: true
```

### Useful LogQL Queries

```logql
# All API errors
{container="api"} |= "error"

# Failed logins with JSON parsing
{container="api"} | json | msg="login failed"

# Slow requests (over 1 second)
{container="api"} | json | latency_ms > 1000

# Error rate by container (last 5 minutes)
sum by (container) (rate({container=~"api|ui"} |= "error" [5m]))
```

---

## 12. Performance Baselines and SLI/SLO Targets

### Service Level Indicators (SLIs)

| SLI | Measurement | PromQL |
|---|---|---|
| **Availability** | Successful responses / Total responses | `1 - (sum(rate(http_requests_total{status=~"5.."}[30d])) / sum(rate(http_requests_total[30d])))` |
| **Latency (P95)** | 95th percentile response time | `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))` |
| **Latency (P99)** | 99th percentile response time | `histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))` |
| **Throughput** | Requests processed per second | `sum(rate(http_requests_total[5m]))` |

### Recommended SLO Targets

| Service | SLO | Target | Error Budget (30 days) |
|---|---|---|---|
| **API Availability** | Successful requests | 99.9% | 43.2 minutes downtime |
| **API Latency (P95)** | Responses under 500ms | 95% | 5% of requests may exceed |
| **API Latency (P99)** | Responses under 2s | 99% | 1% of requests may exceed |
| **Error Rate** | Non-5xx responses | 99.9% | 0.1% of requests may fail |
| **Scan Completion** | Scans finishing successfully | 95% | 5% may fail |
| **Notification Delivery** | Notifications sent | 99.5% | 0.5% may fail |

### Error Budget Policy

| Budget Remaining | Action |
|---|---|
| 100% - 75% | Normal operations, deploy freely |
| 75% - 50% | Increased monitoring, cautious deployments |
| 50% - 25% | Deployment freeze for non-critical changes |
| 25% - 0% | Full deployment freeze, all effort on reliability |

### Baseline Performance Expectations

These baselines assume a single-node deployment with the resource limits defined in `docker-compose.prod.yml`:

| Metric | Baseline | Investigate If |
|---|---|---|
| API P50 Latency | < 50ms | > 100ms |
| API P95 Latency | < 200ms | > 500ms |
| API P99 Latency | < 1s | > 2s |
| Error Rate | < 0.1% | > 1% |
| DB Active Connections | 10-30 | > 60 |
| DB Avg Query Time | < 50ms | > 200ms |
| Redis Memory Usage | < 50% | > 75% |
| Redis Hit Ratio | > 95% | < 90% |
| Host CPU Usage | < 50% | > 80% |
| Host Memory Available | > 30% | < 15% |
| Disk Usage | < 70% | > 85% |

---

## 13. Troubleshooting

### Prometheus Not Scraping Targets

**Symptom:** Targets show as `DOWN` in Prometheus UI at `http://localhost:9090/targets`.

```bash
# Check Prometheus logs
docker compose logs prometheus --tail=50

# Verify network connectivity from Prometheus to the target
docker compose exec prometheus wget -qO- http://api:8080/metrics | head -5

# Common causes:
# 1. Target container not on the same Docker network
# 2. Metrics endpoint not exposed (check the API exposes :8080)
# 3. Firewall or security group blocking internal traffic
```

### Grafana Shows "No Data"

```bash
# 1. Verify Prometheus has the metric
curl -s 'http://localhost:9090/api/v1/query?query=up' | python3 -m json.tool

# 2. Check datasource connectivity in Grafana
#    Go to: Configuration > Data Sources > Prometheus > "Save & Test"

# 3. Verify time range in dashboard is not set to a period before metrics existed

# 4. Check Grafana logs for data source errors
docker compose logs grafana --tail=50
```

### AlertManager Not Sending Notifications

```bash
# Validate configuration
docker compose exec alertmanager amtool check-config /etc/alertmanager/alertmanager.yml

# List active alerts
docker compose exec alertmanager amtool alert --alertmanager.url=http://localhost:9093

# Test a notification (send a test alert)
curl -X POST http://localhost:9093/api/v2/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {"alertname": "TestAlert", "severity": "warning"},
    "annotations": {"summary": "This is a test alert"},
    "startsAt": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }]'

# Check AlertManager logs
docker compose logs alertmanager --tail=50

# Common causes:
# 1. Slack webhook URL expired or incorrect
# 2. PagerDuty service key not valid
# 3. SMTP credentials wrong for email
# 4. Route matchers not matching alert labels
```

### postgres-exporter Connection Errors

```bash
# Check exporter logs
docker compose logs postgres-exporter --tail=20

# Verify connection string
docker compose exec postgres-exporter env | grep DATA_SOURCE

# Test database connectivity from the exporter container
docker compose exec postgres-exporter pg_isready -h postgres -U openctem

# Common causes:
# 1. DB_PASSWORD not passed to the monitoring compose file
# 2. PostgreSQL pg_hba.conf not allowing connections from exporter IP
# 3. SSL mode mismatch (use sslmode=disable for internal Docker connections)
```

### redis-exporter Connection Errors

```bash
# Check exporter logs
docker compose logs redis-exporter --tail=20

# Verify Redis is reachable
docker compose exec redis-exporter redis-cli -h redis -a "${REDIS_PASSWORD}" ping

# Common causes:
# 1. REDIS_PASSWORD not set or mismatched
# 2. Redis requirepass enabled but exporter not configured with password
```

### High Disk Usage from Prometheus

```bash
# Check current TSDB disk usage
docker compose exec prometheus du -sh /prometheus

# Check TSDB stats via API
curl -s http://localhost:9090/api/v1/status/tsdb | python3 -m json.tool

# Force a compaction (use sparingly)
curl -X POST http://localhost:9090/api/v1/admin/tsdb/clean_tombstones

# Reduce retention if needed (restart required)
# Edit --storage.tsdb.retention.time and --storage.tsdb.retention.size flags

# Delete specific series (requires --web.enable-admin-api)
curl -X POST 'http://localhost:9090/api/v1/admin/tsdb/delete_series?match[]=go_gc_duration_seconds'
```

### Grafana Dashboard Not Updating

```bash
# Check provisioning logs
docker compose logs grafana 2>&1 | grep -i provision

# Force dashboard re-provisioning
docker compose restart grafana

# Verify dashboard files are mounted correctly
docker compose exec grafana ls -la /var/lib/grafana/dashboards/

# Check for JSON syntax errors in dashboard files
python3 -m json.tool setup/monitoring/grafana/dashboards/api-overview.json > /dev/null
```

### General Health Check

Run this sequence to verify the entire monitoring stack:

```bash
# 1. All services running
docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml ps

# 2. Prometheus healthy and scraping
curl -s http://localhost:9090/-/healthy && echo "Prometheus OK"
curl -s http://localhost:9090/api/v1/targets | python3 -c "
import json, sys
data = json.load(sys.stdin)
for target in data['data']['activeTargets']:
    status = 'OK' if target['health'] == 'up' else 'FAIL'
    print(f\"  [{status}] {target['labels'].get('job', 'unknown')}: {target['lastError'] or 'healthy'}\")"

# 3. Grafana healthy
curl -s http://localhost:3001/api/health | python3 -m json.tool

# 4. AlertManager healthy
curl -s http://localhost:9093/-/healthy && echo "AlertManager OK"

# 5. Exporters responding
curl -s http://localhost:9090/api/v1/query?query=up | python3 -c "
import json, sys
data = json.load(sys.stdin)
for result in data['data']['result']:
    job = result['metric']['job']
    up = 'UP' if result['value'][1] == '1' else 'DOWN'
    print(f'  [{up}] {job}')"
```

---

**Last Updated:** 2026-03-12
**Version:** 1.0
