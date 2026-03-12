---
layout: default
title: Kubernetes & Helm
parent: Features
nav_order: 25
---

# Kubernetes & Helm Deployment

> **Status**: Implemented
> **Version**: v1.0
> **Released**: 2026-03

## Overview

Production-ready Helm chart for deploying the full OpenCTEM stack on Kubernetes. Includes API server, UI, PostgreSQL, Redis, with horizontal pod autoscaling, ingress, secrets management, and configurable resource limits.

## Helm Chart Structure

```
setup/kubernetes/helm/openctem/
├── Chart.yaml                  # Chart metadata (name, version, dependencies)
├── values.yaml                 # Default configuration (182 lines)
├── templates/
│   ├── _helpers.tpl            # Template helper functions
│   ├── api-deployment.yaml     # API server Deployment
│   ├── api-service.yaml        # API ClusterIP Service
│   ├── ui-deployment.yaml      # UI (Next.js) Deployment
│   ├── postgres-statefulset.yaml # PostgreSQL StatefulSet with PVC
│   ├── redis-deployment.yaml   # Redis Deployment
│   ├── hpa.yaml                # HorizontalPodAutoscaler
│   ├── ingress.yaml            # Ingress with TLS
│   ├── secrets.yaml            # Secret definitions
│   └── configmap.yaml          # ConfigMap for app config
└── charts/                     # Sub-chart dependencies
```

## Key Features

### Horizontal Pod Autoscaling

```yaml
# values.yaml
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80
```

### Ingress with TLS

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: app.openctem.io
      paths:
        - path: /
          pathType: Prefix
          service: ui
        - path: /api
          pathType: Prefix
          service: api
  tls:
    - secretName: openctem-tls
      hosts:
        - app.openctem.io
```

### PostgreSQL StatefulSet

- Persistent volume claim for data durability
- Configurable storage class and size
- Init container for schema migrations
- Backup CronJob integration

### Resource Limits

```yaml
api:
  resources:
    requests:
      cpu: 250m
      memory: 256Mi
    limits:
      cpu: 1000m
      memory: 512Mi

ui:
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 500m
      memory: 256Mi
```

## Deployment

```bash
# Install
helm install openctem ./setup/kubernetes/helm/openctem \
  --namespace openctem \
  --create-namespace \
  -f values-production.yaml

# Upgrade
helm upgrade openctem ./setup/kubernetes/helm/openctem \
  --namespace openctem \
  -f values-production.yaml

# Rollback
helm rollback openctem 1 --namespace openctem
```

## Environment-Specific Values

| File | Environment | Notes |
|------|-------------|-------|
| `values.yaml` | Default | Development defaults |
| `values-staging.yaml` | Staging | 1 replica, smaller resources |
| `values-production.yaml` | Production | HPA enabled, TLS, backups |

## Related Documentation

- [Production Deployment](../operations/PRODUCTION_DEPLOYMENT.md) — Full deployment procedures
- [Backup & Disaster Recovery](backup-disaster-recovery.md) — Backup automation
- [Scaling Guide](../operations/SCALING.md) — Scaling strategies
