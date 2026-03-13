---
layout: default
title: Platform Overview
parent: Features
nav_order: 1
permalink: /features/platform-overview/
---

# Platform Overview

OpenCTEM is a Continuous Threat Exposure Management (CTEM) platform with 511K+ LOC, 44 domain entities, 54 route groups, 161 UI pages, and 14,000+ tests.

---

## Platform Capabilities

### Testing & Quality

| Metric | Value |
|--------|-------|
| API service test files | 60+ |
| API test functions | 2,000+ |
| UI test files | 127 |
| SDK adapter test coverage | 5/5 adapters |

All API services have dedicated unit tests covering CRUD operations, validation, tenant isolation (IDOR prevention), error handling, and business logic edge cases.

### Feature Completeness

All 161 UI pages are fully implemented — zero placeholder pages remain. Every feature has complete backend API, frontend UI, and test coverage.

### Observability & Monitoring

| Component | Implementation |
|-----------|---------------|
| Distributed tracing | OpenTelemetry with HTTP + DB tracing |
| Dashboards | 3 Grafana dashboards (API overview, PostgreSQL, notification pipeline) |
| Alerts | AlertManager rules with Prometheus scrape config |
| Structured logging | Request ID propagation via middleware + context extraction |

Key files:
- `api/internal/infra/telemetry/tracer.go` — OTel tracer
- `api/internal/infra/telemetry/db_tracer.go` — DB query tracing
- `api/internal/infra/http/middleware/tracing.go` — HTTP trace middleware
- `setup/monitoring/` — Prometheus, Grafana, AlertManager configs

### Production Infrastructure

| Component | Implementation |
|-----------|---------------|
| Kubernetes | 12 Helm templates (API, UI, PostgreSQL StatefulSet, Redis, HPA, Ingress, Secrets) |
| Database backup | Automated pg_dump with rotation, WAL archiving, restore procedures |
| Performance | Incremental access refresh for scope rule operations (< 100 assets uses per-asset stored procedures) |

Key files:
- `setup/kubernetes/helm/openctem/` — Helm chart
- `setup/backup/` — Backup scripts + crontab

### SDK & Integrations

5 scanner adapters with full test coverage:

| Adapter | Format |
|---------|--------|
| Trivy | JSON |
| Semgrep | JSON |
| Nuclei | JSON |
| Gitleaks | JSON |
| SARIF | SARIF 2.1.0 (generic) |

All adapters convert scanner output to the CTIS (Common Threat Intelligence Schema) format for normalized ingestion.

### User Notification System

Full in-app notification system:

**Backend:**
- Fan-out-on-read pattern with watermark-based read tracking
- 6 API endpoints with 64KB body limit and URL sanitization
- Event hooks: vulnerability_service fires notifications on new findings
- Background worker: daily cleanup with 90-day retention
- Migration 000084: notifications, notification_reads, notification_state, notification_preferences

**Frontend:**
- SWR hooks for list, unread count, preferences, and mutations
- Bell component with WebSocket real-time refresh
- Inbox page with pagination, severity/read filters
- Preferences page wired to real API

**Security:** tenant isolation, request body limits, relative-URL-only links, input validation

### Access Control

2-layer access control architecture:

1. **RBAC (Layer 1):** User → Roles → Permissions (126 permissions, 4 role levels)
2. **Data Scope (Layer 2):** User → Groups → Assets (scope rules with tag/group matching)

Performance optimization: incremental access refresh for scope rule changes uses per-asset stored procedures (`refresh_access_for_asset_assign`, `refresh_access_for_asset_unassign`) when batch size ≤ 100, falling back to full materialized view refresh for larger batches.

### Security Features

| Feature | Description |
|---------|-------------|
| Credential encryption | AES-256-GCM for integration credentials |
| Tenant isolation | All queries scoped by tenant_id |
| IDOR prevention | Ownership verification on all mutations |
| Rate limiting | Per-IP rate limiting on public endpoints |
| Constant-time comparison | `crypto/subtle` for secret comparison |
| Audit logging | All security-relevant actions logged |
| Permission real-time sync | JWT version tracking + Redis cache |

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                 │
│  161 pages, SWR hooks, WebSocket, Zustand stores     │
└─────────────────────────┬───────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────┐
│                    API (Go + Chi)                     │
│  54 route groups, 44 domain entities, DDD arch       │
│  OpenTelemetry tracing, structured logging           │
└───────┬─────────────────┬───────────────────┬───────┘
        │                 │                   │
┌───────▼───────┐ ┌───────▼───────┐ ┌────────▼──────┐
│  PostgreSQL   │ │    Redis      │ │  SDK (Go)     │
│  84 migrations│ │  Sessions     │ │  5 adapters   │
│  53+ indexes  │ │  Permissions  │ │  CTIS format  │
└───────────────┘ └───────────────┘ └───────────────┘
```

---

## Related Documentation

- [Architecture Overview](../architecture/overview.md)
- [Getting Started](../getting-started/)
- [API Documentation](../api/)
