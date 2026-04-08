---
layout: default
title: Observability & Monitoring
parent: Features
nav_order: 22
---

# Observability & Monitoring

> **Status**: Implemented
> **Version**: v1.0
> **Released**: 2026-03

## Overview

Full observability stack providing distributed tracing, metrics dashboards, alerting, and structured logging with request correlation across all API services.

## Components

### Distributed Tracing (OpenTelemetry)

End-to-end request tracing using OpenTelemetry, covering HTTP handlers, middleware, and database queries.

**Key Files:**

| File | Purpose |
|------|---------|
| `api/internal/infra/telemetry/tracer.go` | OTel tracer initialization and configuration |
| `api/internal/infra/telemetry/db_tracer.go` | Database query tracing with span attributes |
| `api/internal/infra/http/middleware/tracing.go` | HTTP request tracing middleware |

**Capabilities:**

- Automatic span creation for every HTTP request
- Database query tracing with query text and duration
- Trace context propagation across service boundaries
- Configurable exporter (Jaeger, OTLP, stdout)

**Configuration:**

```bash
# Environment variables
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4317
OTEL_SERVICE_NAME=openctem-api
```

### Grafana Dashboards

Three pre-built dashboards for operational monitoring, auto-provisioned via Grafana provisioning.

| Dashboard | File | Panels |
|-----------|------|--------|
| API Overview | `setup/monitoring/grafana/dashboards/api-overview.json` | Request rate, latency percentiles, error rate, active connections |
| PostgreSQL Performance | `setup/monitoring/grafana/dashboards/postgres-performance.json` | Query duration, connection pool, cache hit ratio, table sizes |
| Notification Pipeline | `setup/monitoring/grafana/dashboards/notification-pipeline.json` | Outbox queue depth, delivery rate, failure rate, retry counts |

**Provisioning:**

```
setup/monitoring/
├── prometheus/
│   └── prometheus.yml          # Scrape targets and intervals
├── grafana/
│   ├── dashboards/             # Dashboard JSON definitions
│   └── provisioning/           # Auto-provision config
└── alertmanager/
    └── alerts.yml              # Alert rules
```

### AlertManager Rules

Pre-configured alerts for critical operational conditions:

| Alert | Condition | Severity |
|-------|-----------|----------|
| High Error Rate | > 5% 5xx responses over 5 min | critical |
| High Latency | p99 > 2s over 5 min | warning |
| Database Connection Pool | > 80% utilization | warning |
| Notification Queue Backlog | > 100 pending entries | warning |
| Disk Usage | > 85% on any volume | critical |

### Structured Logging

All API logs include structured fields for correlation and filtering.

**Key Implementation:**

| File | Purpose |
|------|---------|
| `api/pkg/logger/logger.go` | Logger with automatic `request_id` extraction from context |
| `api/internal/infra/http/middleware/request_id.go` | Generates UUID per request, propagates via `ContextKeyRequestID` |

**Log Fields:**

```json
{
  "level": "info",
  "msg": "request completed",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "method": "GET",
  "path": "/api/v1/findings",
  "status": 200,
  "duration_ms": 42,
  "tenant_id": "dea68fbc-...",
  "user_id": "a1b2c3d4-..."
}
```

**Correlation Flow:**

```
Client Request
  → RequestID middleware (generates UUID, sets X-Request-ID header)
    → Logger extracts request_id from context automatically
      → All log entries include request_id
        → Trace spans linked to same request_id
```

## Architecture

```
┌──────────┐     ┌────────────┐     ┌──────────┐
│  API     │────▶│ Prometheus │────▶│ Grafana  │
│  Server  │     └────────────┘     └──────────┘
│          │
│ OTel SDK │────▶┌────────────┐
│          │     │  Jaeger    │
└──────────┘     └────────────┘
     │
     │ logs
     ▼
┌──────────┐     ┌──────────────┐
│  stdout  │────▶│ Loki / ELK   │
└──────────┘     └──────────────┘
```

## Metrics Exposed

The API exposes Prometheus metrics at `/metrics`:

- `http_requests_total` — Counter by method, path, status
- `http_request_duration_seconds` — Histogram of request latency
- `db_query_duration_seconds` — Histogram of database query latency
- `websocket_connections_active` — Gauge of active WebSocket clients
- `notification_outbox_pending` — Gauge of pending notification entries

## Deployment

```bash
# Start monitoring stack
docker compose -f docker-compose.monitoring.yml up -d

# Access dashboards
# Grafana:     http://localhost:3001
# Prometheus:  http://localhost:9090
# Jaeger:      http://localhost:16686
```

## Related Documentation

- [Monitoring Operations Guide](../operations/MONITORING.md) — Day-to-day monitoring procedures
- [Production Deployment](../operations/PRODUCTION_guides/getting-started.md) — Full stack deployment
- [Notification System](../architecture/notification-system.md) — Notification pipeline details
