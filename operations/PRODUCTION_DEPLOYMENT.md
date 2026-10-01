---
layout: default
title: Production Deployment
parent: Operations
nav_order: 13
---

# Production Deployment Guide

Deploy the OpenCTEM platform to production environments using Kubernetes, Docker Compose, or cloud-managed services.

---

## Architecture Overview

```
                    ┌─────────────────────────────────┐
                    │    Load Balancer / Ingress      │
                    │    (TLS Termination)             │
                    └─────────────────┬───────────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            │                         │                         │
            ▼                         ▼                         ▼
    ┌───────────────┐      ┌───────────────┐      ┌───────────────┐
    │  UI (Next.js) │      │   API (Go)    │      │  External IdP │
    │   Replicas: 2 │      │   Replicas: 3 │      │  (SSO, opt.)  │
    └───────────────┘      └───────────────┘      └───────────────┘
            │                         │                         │
            └─────────────────────────┼─────────────────────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            │                         │                         │
            ▼                         ▼                         ▼
    ┌───────────────┐      ┌───────────────┐      ┌───────────────┐
    │  PostgreSQL   │      │     Redis     │      │  External IdP │
    │  Primary +    │      │   Cluster     │      │  (SAML/OIDC/  │
    │  Replicas     │      │   Sentinel    │      │   Entra ID)   │
    └───────────────┘      └───────────────┘      └───────────────┘
```

---

## Deployment Options

### Option 1: Kubernetes with Helm (Recommended)

**Best for:** Production, Auto-scaling, High Availability

### Option 2: Docker Compose

**Best for:** Small teams, Single-server deployments

### Option 3: Cloud Managed Services

**Best for:** Minimal operations overhead

---

## Option 1: Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (v1.25+)
- Helm 3
- kubectl configured
- Domain name with DNS access
- SSL/TLS certificate (or cert-manager)

---

### Step 1: Prepare Namespace

```bash
# Create namespace
kubectl create namespace openctem

# Set as default
kubectl config set-context --current --namespace openctem
```

---

### Step 2: Create Secrets

```bash
# Generate secure secrets
export JWT_SECRET=$(openssl rand -base64 64)
export CSRF_SECRET=$(openssl rand -base64 32)
export DB_PASSWORD=$(openssl rand -base64 32)
export REDIS_PASSWORD=$(openssl rand -base64 32)

# Create Kubernetes secrets
kubectl create secret generic openctem-secrets \
  --from-literal=jwt-secret=$JWT_SECRET \
  --from-literal=csrf-secret=$CSRF_SECRET \
  --from-literal=db-password=$DB_PASSWORD \
  --from-literal=redis-password=$REDIS_PASSWORD \
  --namespace openctem
```

---

### Step 3: Configure Values

Create `values.yaml`:

```yaml
# values.yaml
global:
  domain: your-domain.com
  tlsEnabled: true

api:
  replicaCount: 3
  image:
    repository: openctemio/api
    tag: latest
  resources:
    requests:
      memory: "512Mi"
      cpu: "250m"
    limits:
      memory: "2Gi"
      cpu: "1000m"
  env:
    AUTH_PROVIDER: local  # "local", "oidc", or "hybrid" (per-tenant SSO: Entra ID / Okta / Google)
    CORS_ALLOWED_ORIGINS: "https://your-domain.com"
    LOG_LEVEL: info

ui:
  replicaCount: 2
  image:
    repository: openctemio/ui
    tag: latest
  resources:
    requests:
      memory: "256Mi"
      cpu: "100m"
    limits:
      memory: "1Gi"
      cpu: "500m"

postgresql:
  enabled: true
  auth:
    existingSecret: openctem-secrets
    secretKeys:
      adminPasswordKey: db-password
  primary:
    persistence:
      size: 50Gi
  readReplicas:
    replicaCount: 1

redis:
  enabled: true
  auth:
    existingSecret: openctem-secrets
    existingSecretPasswordKey: redis-password
  master:
    persistence:
      size: 10Gi

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
  hosts:
    - host: your-domain.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: openctem-tls
      hosts:
        - your-domain.com
```

{: .important }
An Ingress that sends `/` only to the UI breaks sensors, API-key clients, SCIM
and MCP. Chart 0.7.0 and later render the single-origin path rules of the
[gateway](./single-https-port.md#routing) (or bundle the same Caddy gateway);
see the [chart README](https://github.com/openctemio/helm-charts/tree/main/charts/openctem#readme)
for the values instead of the simplified `ingress` block above.

---

### Step 4: Install Helm Chart

```bash
# Add OpenCTEM Helm repository
helm repo add openctemio https://charts.openctem.io
helm repo update

# Install
helm install openctem openctemio/openctem \
  --namespace openctem \
  --values values.yaml \
  --wait --timeout 10m

# Check status
helm status openctem --namespace openctem
```

---

### Step 5: Verify Deployment

```bash
# Check all pods are running
kubectl get pods --namespace openctem

# Expected output:
# NAME                          READY   STATUS    RESTARTS   AGE
# openctem-api-xxx               1/1     Running   0          2m
# openctem-api-yyy               1/1     Running   0          2m
# openctem-api-zzz               1/1     Running   0          2m
# openctem-ui-xxx                1/1     Running   0          2m
# openctem-ui-yyy                1/1     Running   0          2m
# openctem-postgresql-0          1/1     Running   0          2m
# openctem-redis-master-0        1/1     Running   0          2m

# Check services
kubectl get svc --namespace openctem

# Check ingress
kubectl get ingress --namespace openctem
```

---

### Step 6: Run Database Migrations

```bash
# Run migrations job
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: openctem-migrate
  namespace: openctem
spec:
  template:
    spec:
      containers:
      - name: migrate
        image: openctemio/api:latest
        command: ["migrate", "-path", "/app/migrations", "-database", "\$(DATABASE_URL)", "up"]
        env:
        - name: DATABASE_URL
          value: "postgres://openctem:\$(DB_PASSWORD)@openctem-postgresql:5432/openctem?sslmode=disable"
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: openctem-secrets
              key: db-password
      restartPolicy: OnFailure
EOF

# Wait for completion
kubectl wait --for=condition=complete job/openctem-migrate --namespace openctem --timeout=5m
```

---

### Step 7: Seed Initial Data (Optional)

```bash
# Seed test data for staging
kubectl exec -it deployment/openctem-api --namespace openctem -- \
  psql \$DATABASE_URL -f /app/seeds/seed_required.sql
```

---

### Step 8: Access the Platform

1. Update your DNS to point to the Ingress IP:
   ```bash
   kubectl get ingress openctem-ingress --namespace openctem
   ```

2. Navigate to your domain: `https://your-domain.com`

3. Create the first admin account — there is no seeded default account:
   ```bash
   make bootstrap-admin-prod email=admin@yourcompany.com
   ```
   The command prints a one-time API key. Log in with that admin account.

---

## Option 2: Docker Compose Deployment

Docker Compose installs run behind the built-in gateway, which exposes **one
HTTPS port (443)** for the web UI, the REST API, sensors, SCIM, MCP and
webhooks. Follow **[Exposing OpenCTEM: one HTTPS port](./single-https-port.md)**:
it covers the compose files in the api repository's `deploy/` directory, the
four TLS modes (internal CA, Let's Encrypt, your own certificate, behind your
own proxy), sensor configuration and migration from older two-port installs.

{: .warning }
Earlier versions of this page shipped a hand-written `docker-compose.prod.yml`
with an nginx proxy that sent every path to the web UI. That configuration
breaks sensors (the web UI answers sensor requests with `421 WRONG_ENDPOINT`),
API-key clients and SCIM. Replace it with the gateway; see
[Migrating from the two-port setup](./single-https-port.md#migrating-from-the-two-port-setup).
If you must keep your own reverse proxy, run the gateway in `http` mode behind
it and forward **all** paths to the gateway instead of splitting them yourself.

---

## Option 3: Cloud Managed Services

### AWS (ECS Fargate)

Use AWS Copilot or ECS Task Definitions with:
- **RDS PostgreSQL** - Managed database
- **ElastiCache Redis** - Managed cache
- **ALB** - Load balancer
- **ACM** - SSL certificates

### GCP (Cloud Run)

Deploy containers to Cloud Run with:
- **Cloud SQL PostgreSQL**
- **Memorystore Redis**
- **Cloud Load Balancing**
- **Google-managed certificates**

### Azure (Container Instances)

Deploy with:
- **Azure Database for PostgreSQL**
- **Azure Cache for Redis**
- **Application Gateway**
- **Azure-managed certificates**

---

## Security Checklist

### Pre-Deployment

- [ ] Change all default passwords
- [ ] Generate secure JWT/CSRF secrets (min 64 chars)
- [ ] Enable TLS/SSL for all endpoints
- [ ] Configure firewall rules (whitelist only required ports)
- [ ] Enable audit logging
- [ ] Set up backup strategy for PostgreSQL
- [ ] Configure Redis persistence
- [ ] Review CORS allowed origins

### Post-Deployment

- [ ] Force password change for default admin account
- [ ] Enable 2FA for admin users
- [ ] Configure rate limiting
- [ ] Set up monitoring and alerting
- [ ] Enable database encryption at rest
- [ ] Configure automated backups
- [ ] Set up log aggregation (ELK/Loki)
- [ ] Enable metrics collection (Prometheus)

---

## Monitoring & Observability

### Health Checks

The API's liveness endpoint is public on the single origin; readiness and
metrics are internal only (the gateway answers 404):

```bash
curl https://your-domain.com/health
```

See [Health checks](./single-https-port.md#health-checks).

### Metrics (Prometheus)

API exposes metrics at `/metrics`, reachable only from inside the cluster or
Docker network:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'openctem-api'
    static_configs:
      - targets: ['openctem-api:8080']
```

### Logging

Configure structured JSON logging:

```yaml
# API environment
LOG_LEVEL: info
LOG_FORMAT: json
```

Ship logs to:
- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Loki + Grafana**
- **Cloud provider logs** (CloudWatch, Stackdriver, Azure Monitor)

---

## Scaling

### Horizontal Pod Autoscaling (HPA)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: openctem-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: openctem-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Database Scaling

- **Read replicas** for PostgreSQL
- **Connection pooling** with PgBouncer
- **Redis Cluster** for high availability

---

## Backup Strategy

### PostgreSQL Backups

```bash
# Daily automated backups
kubectl create cronjob openctem-backup \
  --image=postgres:17 \
  --schedule="0 2 * * *" \
  -- pg_dump -h postgres -U openctem openctem | gzip > /backups/backup-$(date +%Y%m%d).sql.gz
```

### Retention Policy

- **Daily backups:** 7 days
- **Weekly backups:** 4 weeks
- **Monthly backups:** 12 months

---

## Disaster Recovery

### RTO/RPO Targets

- **RTO (Recovery Time Objective):** < 1 hour
- **RPO (Recovery Point Objective):** < 15 minutes

### Recovery Procedure

1. Restore PostgreSQL from latest backup
2. Redeploy application containers
3. Run health checks
4. Verify data integrity
5. Resume normal operations

---

## Troubleshooting

### Pods in CrashLoopBackOff

```bash
# Check logs
kubectl logs -l app=openctem-api --namespace openctem --tail=100

# Common causes:
# - Database not ready
# - Missing secrets
# - Migration failure
```

### Database Connection Issues

```bash
# Test connection from API pod
kubectl exec -it deployment/openctem-api --namespace openctem -- sh
pg_isready -h postgres -U openctem
```

### UI Not Loading

```bash
# Check API is reachable from UI
kubectl exec -it deployment/openctem-ui --namespace openctem -- curl http://openctem-api:8080/health
```

---

## Next Steps

### Further Reading

- **[Security Best Practices](../guides/SECURITY.md)** - Authentication, secrets management, access control
- **[Monitoring & Alerting](./MONITORING.md)** - Prometheus, Grafana, Loki, SLIs/SLOs
- **[Scaling Guide](./SCALING.md)** - Performance optimization (Coming in future release)

### Related Guides

- [Architecture Overview](../architecture/overview.md)
- [End-to-End Workflow](../guides/END_TO_END_WORKFLOW.md)
- [Agent Quick Start](https://github.com/openctemio/sensor#quick-start)

---

**Your platform is production-ready! 🚀**
