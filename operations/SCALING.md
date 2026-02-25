---
layout: default
title: Scaling Guide
parent: Operations
nav_order: 15
---

# Scaling Guide

Guide for scaling OpenCTEM platform components for production workloads.

---

## Horizontal Scaling

### API Service

The Go API is stateless and can be scaled horizontally:

```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: openctem-api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: openctem-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

### Frontend (UI)

Next.js instances are also stateless:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: openctem-ui
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: openctem-ui
  minReplicas: 2
  maxReplicas: 5
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 80
```

---

## Database Scaling

### PostgreSQL

| Strategy | When to Use |
|----------|-------------|
| **Vertical scaling** | First approach — increase CPU/RAM |
| **Connection pooling** (PgBouncer) | > 100 concurrent connections |
| **Read replicas** | Read-heavy workloads |
| **Table partitioning** | > 10M findings per tenant |

### Key Configuration

```
# postgresql.conf adjustments for scale
max_connections = 200
shared_buffers = 4GB           # 25% of RAM
effective_cache_size = 12GB    # 75% of RAM
work_mem = 64MB
maintenance_work_mem = 512MB
```

### Redis

| Strategy | When to Use |
|----------|-------------|
| **Vertical scaling** | First approach |
| **Redis Sentinel** | High availability |
| **Redis Cluster** | > 16GB data or > 100K ops/sec |

---

## Capacity Planning

### Sizing Guidelines

| Workload | API Pods | PostgreSQL | Redis | Storage |
|----------|----------|------------|-------|---------|
| Small (< 10 tenants) | 2 | 2 vCPU, 4GB | 1GB | 50GB |
| Medium (10-100 tenants) | 4 | 4 vCPU, 16GB | 4GB | 200GB |
| Large (100+ tenants) | 8+ | 8 vCPU, 32GB | 8GB | 1TB+ |

### Key Metrics to Monitor

- API response latency (p95 < 500ms)
- Database connection pool utilization (< 80%)
- Redis memory usage (< 70% of maxmemory)
- Finding ingestion throughput (findings/sec)
- Scan queue depth

---

## Related Documentation

- [Production Deployment](./PRODUCTION_DEPLOYMENT.md) — Initial production setup
- [Monitoring Guide](./MONITORING.md) — Metrics and alerting
- [Platform Agent Runbook](./platform-agent-runbook.md) — Agent scaling
