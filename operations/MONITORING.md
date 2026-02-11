---
layout: default
title: Monitoring & Observability
parent: Operations
nav_order: 7
---
{% raw %}

# Monitoring & Observability Guide

Complete guide for monitoring and observability in production OpenCTEM deployments.

---

## Table of Contents

- [Overview](#overview)
- [Metrics (Prometheus)](#metrics-prometheus)
- [Logging (Loki/ELK)](#logging-lokilelk)
- [Tracing (Jaeger)](#tracing-jaeger)
- [Alerting](#alerting)
- [Dashboards](#dashboards)
- [SLIs & SLOs](#slis--slos)

---

## Overview

### Observability Stack

```
┌─────────────────────────────────────────────────────────┐
│                  OBSERVABILITY STACK                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  METRICS          LOGS              TRACES               │
│  ───────          ────              ───────              │
│  Prometheus  →    Loki         →    Jaeger               │
│     ↓             ↓                  ↓                   │
│     └──────────── Grafana ───────────┘                   │
│                      ↓                                   │
│                  Alertmanager                            │
│                      ↓                                   │
│              PagerDuty / Slack                           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Components

| Component | Purpose | Port |
|-----------|---------|------|
| Prometheus | Metrics collection & storage | 9090 |
| Grafana | Visualization & dashboards | 3000 |
| Loki | Log aggregation | 3100 |
| Jaeger | Distributed tracing | 16686 |
| Alertmanager | Alert routing & grouping | 9093 |

---

## Metrics (Prometheus)

### API Metrics Endpoint

**Enable metrics in API:**

```go
// main.go
import "github.com/prometheus/client_golang/prometheus/promhttp"

func main() {
    // ... setup

    // Expose /metrics endpoint
    http.Handle("/metrics", promhttp.Handler())
    
    go http.ListenAndServe(":2112", nil)
}
```

### Kubernetes ServiceMonitor

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: openctem-api
  namespace: openctem
spec:
  selector:
    matchLabels:
      app: openctem-api
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
```

### Key Metrics to Track

#### HTTP Metrics

```promql
# Request rate
rate(http_requests_total[5m])

# Request duration (p95, p99)
histogram_quantile(0.95, http_request_duration_seconds_bucket)
histogram_quantile(0.99, http_request_duration_seconds_bucket)

# Error rate
rate(http_requests_total{status=~"5.."}[5m])
```

#### Application Metrics

```promql
# Active findings
openctem_findings_total{status="open"}

# Scan queue depth
openctem_scan_queue_depth

# Agent heartbeats
rate.openctem_agent_heartbeats_total[5m])

# Database connections
openctem_db_connections{state="active"}
```

#### Infrastructure Metrics

```promql
# CPU usage
rate(container_cpu_usage_seconds_total[5m])

# Memory usage
container_memory_usage_bytes / container_spec_memory_limit_bytes

# Disk usage
(node_filesystem_size_bytes - node_filesystem_free_bytes) / node_filesystem_size_bytes
```

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'openctem-api'
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names: .openctem]
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        regex: openctem-api
        action: keep

  - job_name: .openctem-ui'
    static_configs:
      - targets: [.openctem-ui:3000']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
```

---

## Logging (Loki/ELK)

### Structured Logging

**Enable JSON logging in API:**

```go
// logger.go
import "log/slog"

func NewLogger() *slog.Logger {
    return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
        Level: slog.LevelInfo,
    }))
}

// Usage
logger.Info("User logged in",
    "user_id", user.ID,
    "tenant_id", tenant.ID,
    "ip_address", req.RemoteAddr,
)
```

### Loki Configuration

**Deploy Loki with Promtail:**

```yaml
# loki-stack.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: loki-config
data:
  loki.yaml: |
    auth_enabled: false
    server:
      http_listen_port: 3100
    ingester:
      lifecycler:
        ring:
          kvstore:
            store: inmemory
          replication_factor: 1
    schema_config:
      configs:
        - from: 2020-10-24
          store: boltdb-shipper
          object_store: filesystem
          schema: v11
          index:
            prefix: index_
            period: 24h
```

**Promtail for log collection:**

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: promtail
spec:
  selector:
    matchLabels:
      app: promtail
  template:
    spec:
      containers:
      - name: promtail
        image: grafana/promtail:latest
        volumeMounts:
        - name: logs
          mountPath: /var/log
        - name: promtail-config
          mountPath: /etc/promtail
      volumes:
      - name: logs
        hostPath:
          path: /var/log
```

### LogQL Queries

```logql
# All API errors
{app="openctem-api"} |= "error"

# Failed logins
{app="openctem-api"} |= "login" |= "failed"

# Slow queries (>1s)
{app="openctem-api"} | json | duration > 1s

# Top errors by tenant
topk(10, sum by (tenant_id) (
  rate({app="openctem-api"} |= "error" [5m])
))
```

---

## Tracing (Jaeger)

### Enable Distributed Tracing

```go
// tracing.go
import (
    "github.com/opentelemetry/opentelemetry-go/sdk/trace"
    "go.opentelemetry.io/otel"
)

func InitTracing() {
    exporter, _ := jaeger.New(jaeger.WithCollectorEndpoint())
    tp := trace.NewTracerProvider(
        trace.WithBatcher(exporter),
        trace.WithResource(resource.NewWithAttributes(
            semconv.ServiceNameKey.String("openctem-api"),
        )),
    )
    otel.SetTracerProvider(tp)
}

// Instrument HTTP handler
func (h *Handler) GetFinding(c *gin.Context) {
    ctx, span := otel.Tracer("api").Start(c.Request.Context(), "GetFinding")
    defer span.End()
    
    // ... handler logic
}
```

### Jaeger Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jaeger
spec:
  template:
    spec:
      containers:
      - name: jaeger
        image: jaegertracing/all-in-one:latest
        ports:
        - containerPort: 16686  # UI
        - containerPort: 14268  # Collector
        env:
        - name: COLLECTOR_ZIPKIN_HOST_PORT
          value: ":9411"
```

---

## Alerting

### Alert Rules

**Create Prometheus alert rules:**

```yaml
# alerts.yaml
groups:
  - name:.openctem_api
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "{{ $value | humanizePercentage }} error rate"

      # API down
      - alert: APIDown
        expr: up{job="openctem-api"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "API is down"

      # High response time
      - alert: HighLatency
        expr: |
          histogram_quantile(0.95,
            rate(http_request_duration_seconds_bucket[5m])
          ) > 1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High latency (p95 > 1s)"

      # Database connection pool exhausted
      - alert: DBConnectionPoolExhausted
        expr: |
         .openctem_db_connections{state="in_use"} 
          /.openctem_db_connections_max > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Database connection pool nearly exhausted"

      # Disk space low
      - alert: DiskSpaceLow
        expr: |
          (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Disk space < 10%"
```

### Alertmanager Configuration

```yaml
# alertmanager.yml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'cluster']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'slack-critical'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty'
    - match:
        severity: warning
      receiver: 'slack-warnings'

receivers:
  - name: 'slack-critical'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK'
        channel: '#alerts-critical'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ end }}'

  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_KEY'

  - name: 'slack-warnings'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK'
        channel: '#alerts-warnings'
```

---

## Dashboards

### Grafana Setup

**Deploy Grafana:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
spec:
  template:
    spec:
      containers:
      - name: grafana
        image: grafana/grafana:latest
        ports:
        - containerPort: 3000
        env:
        - name: GF_SECURITY_ADMIN_PASSWORD
          valueFrom:
            secretKeyRef:
              name: grafana-secret
              key: admin-password
```

### Dashboard Examples

#### 1. API Overview Dashboard

**Panels:**
- Request rate (requests/sec)
- Error rate (%)
- P50/P95/P99 latency
- Active connections
- Top endpoints by request count

**PromQL queries:**
```promql
# Request rate
sum(rate(http_requests_total[5m]))

# Error rate
sum(rate(http_requests_total{status=~"5.."}[5m])) 
/ sum(rate(http_requests_total[5m]))

# P95 latency
histogram_quantile(0.95, 
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
)
```

#### 2. Database Dashboard

**Panels:**
- Active connections
- Query duration (P95)
- Transaction rate
- Lock waits
- Replication lag

#### 3. Business Metrics Dashboard

**Panels:**
- Total findings (by severity)
- Active scans
- Agent heartbeats
- Findings resolved (rate)
- New users (rate)

```promql
# Total findings by severity
sum by (severity) .openctem_findings_total{status="open"})

# Scan completion rate
rate.openctem_scans_total{status="completed"}[1h])
```

---

## SLIs & SLOs

### Service Level Indicators (SLIs)

| SLI | Target | Measurement |
|-----|--------|-------------|
| **Availability** | 99.9% | Successful requests / Total requests |
| **Latency (P95)** | < 500ms | 95th percentile response time |
| **Error Rate** | < 0.1% | 5xx errors / Total requests |
| **Uptime** | 99.9% | Service healthy checks |

### Service Level Objectives (SLOs)

**API SLO:**

```yaml
SLO: 99.9% availability over 30 days
Error Budget: 0.1% = 43.2 minutes downtime/month

Alert when error budget consumed > 50%:
  - 21.6 minutes downtime in 30 days
  - Triggers: Incident review, deployment freeze
```

**Latency SLO:**
```yaml
SLO: 95% of requests complete in < 500ms
Measurement window: 7 days

Alert when:
  - P95 latency > 500ms for 10 minutes
  - P99 latency > 1s for 5 minutes
```

### Error Budget Policy

```
Error Budget Status:
  - 100-75%: Normal operations, deploy anytime
  - 75-50%: Deployment caution, increase monitoring
  - 50-25%: Deployment freeze for non-critical changes
  - 25-0%: Full deployment freeze, focus on reliability
```

---

## Production Deployment

### Helm Chart (Monitoring Stack)

```bash
# Add Prometheus community helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install kube-prometheus-stack (Prometheus + Grafana + Alertmanager)
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
  --set grafana.adminPassword=your-secure-password
```

### Access Dashboards

```bash
# Port-forward Grafana
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80

# Access at http://localhost:3000
# Default user: admin
# Password: (from --set grafana.adminPassword)
```

---

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)
- [The Golden Signals](https://sre.google/sre-book/monitoring-distributed-systems/)

---

**Last Updated:** 2026-01-22  
**Version:** 1.0
{% endraw %}
