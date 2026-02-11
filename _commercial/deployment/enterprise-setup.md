---
layout: default
title: Enterprise Setup
parent: Getting Started
nav_order: 3
---

# Enterprise Setup Guide

Deploy Rediver in your organization with multi-tenancy, SSO, and production configuration.

---

## Overview

This guide covers enterprise deployment with:
- Multi-tenant architecture
- SSO/OIDC authentication (Keycloak)
- Kubernetes deployment
- High availability configuration

**Time required:** 1-2 hours

---

## Prerequisites

| Requirement | Purpose |
|-------------|---------|
| Kubernetes cluster | Production runtime |
| PostgreSQL 14+ | Database |
| Redis 7+ | Cache & queues |
| Keycloak (optional) | SSO/OIDC provider |
| Domain + TLS certs | Production access |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer (TLS)                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
    ┌───────┐    ┌───────┐    ┌───────┐
    │  UI   │    │  API  │    │ Admin │
    │ (3000)│    │(8080) │    │(3001) │
    └───────┘    └───┬───┘    └───────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
    ┌────────┐  ┌─────────┐  ┌───────┐
    │Postgres│  │  Redis  │  │Keycloak│
    └────────┘  └─────────┘  └───────┘
```

---

## Step 1: Infrastructure Setup

### 1.1 Database

```yaml
# PostgreSQL with required extensions
CREATE DATABASE.exploop;
\c.exploop
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### 1.2 Redis

```yaml
# Redis 7+ with persistence
redis:
  image: redis:7-alpine
  command: redis-server --appendonly yes
  volumes:
    - redis-data:/data
```

### 1.3 Keycloak (Optional)

For SSO/OIDC authentication:

```yaml
keycloak:
  image: quay.io/keycloak/keycloak:25.0
  environment:
    KEYCLOAK_ADMIN: admin
    KEYCLOAK_ADMIN_PASSWORD: admin
  command: start-dev
```

See [Keycloak Setup Guide](../ui/features/auth/KEYCLOAK_SETUP.md) for full configuration.

---

## Step 2: Kubernetes Deployment

### 2.1 Create Namespace

```bash
kubectl create namespace.exploop
```

### 2.2 Configure Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name:.exploop-secrets
  namespace: exploop
type: Opaque
stringData:
  DATABASE_URL: "postgres://user:pass@postgres:5432/exploop?sslmode=require"
  REDIS_URL: "redis://redis:6379"
  APP_ENCRYPTION_KEY: "your-32-byte-encryption-key-hex"
  JWT_SECRET: "your-jwt-secret-key"
```

### 2.3 Deploy Services

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/
```

See [Production Deployment Guide](../operations/PRODUCTION_DEPLOYMENT.md) for full manifests.

---

## Step 3: Multi-Tenancy Configuration

### 3.1 Create Tenants

Tenants are created via the API or Admin UI:

```bash
# Create tenant via API
curl -X POST https://api.exploop.io/api/v1/tenants \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name": "Acme Corp",
    "slug": "acme",
    "plan_id": "enterprise"
  }'
```

### 3.2 Configure Plans

| Plan | Features | Agent Limit |
|------|----------|-------------|
| Free | Basic scanning | 1 |
| Pro | + Notifications, Integrations | 5 |
| Enterprise | + SSO, Unlimited agents | Unlimited |

See [Plans & Licensing](../operations/plans-licensing.md) for configuration.

### 3.3 Group-Based Access Control

Configure role-based access within tenants:

```
Tenant: Acme Corp
├── Groups
│   ├── Security Team (full access)
│   ├── Developers (findings read, scans write)
│   └── Managers (dashboard view only)
└── Members
    ├── admin@acme.com (Owner)
    ├── secops@acme.com (Security Team)
    └── dev@acme.com (Developers)
```

See [Group-Based Access Control](../guides/group-based-access-control.md).

---

## Step 4: SSO Configuration

### 4.1 OIDC Setup

Configure OIDC provider (Keycloak, Okta, Azure AD):

```env
# API Configuration
AUTH_MODE=oidc
OIDC_ISSUER_URL=https://keycloak.example.com/realms.exploop
OIDC_CLIENT_ID=exploop-api
OIDC_CLIENT_SECRET=your-client-secret

# UI Configuration
NEXT_PUBLIC_AUTH_MODE=oidc
NEXT_PUBLIC_OIDC_AUTHORITY=https://keycloak.example.com/realms.exploop
NEXT_PUBLIC_OIDC_CLIENT_ID.exploop-ui
```

### 4.2 Role Mapping

Map OIDC roles to Rediver permissions:

| OIDC Role | Rediver Role | Permissions |
|-----------|--------------|-------------|
| `exploop-admin` | Owner | Full access |
| .exploop-user` | Member | Standard access |
| .exploop-viewer` | Viewer | Read-only |

See [Authentication Guide](../guides/authentication.md) for details.

---

## Step 5: High Availability

### 5.1 API Scaling

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: exploop-api
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

### 5.2 Database Replication

Configure PostgreSQL with read replicas:

```yaml
primary:
  host: postgres-primary.exploop.svc

replicas:
  - host: postgres-replica-1.exploop.svc
  - host: postgres-replica-2.exploop.svc
```

### 5.3 Redis Cluster

For high availability caching:

```yaml
redis:
  mode: cluster
  replicas: 3
```

---

## Step 6: Monitoring & Observability

### 6.1 Health Checks

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
```

### 6.2 Metrics

Prometheus metrics exposed at `/metrics`:

| Metric | Description |
|--------|-------------|
| .exploop_findings_total` | Total findings by severity |
| .exploop_scans_total` | Scans by status |
| .exploop_api_request_duration` | API latency |

### 6.3 Logging

```env
LOG_LEVEL=info
LOG_FORMAT=json
LOG_OUTPUT=stdout
```

See [Monitoring Guide](../operations/MONITORING.md).

---

## Production Checklist

Before going live:

- [ ] TLS certificates configured
- [ ] Database backups enabled
- [ ] Encryption key securely stored
- [ ] Rate limiting configured
- [ ] CORS properly set
- [ ] Audit logging enabled
- [ ] Health checks passing
- [ ] Monitoring configured
- [ ] Incident response plan ready

See [Production Checklist](../ui/ops/PRODUCTION_CHECKLIST.md) for complete list.

---

## Next Steps

| Topic | Guide |
|-------|-------|
| **Platform Administration** | [Platform Admin Guide](../guides/platform-admin.md) |
| **Agent Deployment** | [Running Agents](../guides/running-agents.md) |
| **Integration Setup** | [Notification Integrations](../guides/notification-integrations.md) |
| **Security Hardening** | [Security Best Practices](../guides/SECURITY.md) |

---

## Support

For enterprise support:
- **Email:** enterprise@exploop.io
- **Documentation:** [docs.exploop.io](https://docs.exploop.io)
- **GitHub:** [github.com/exploopio](https://github.com/exploopio)
