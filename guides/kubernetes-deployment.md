---
layout: default
title: Kubernetes Deployment with Helm
parent: Guides
nav_order: 20
---

# Kubernetes Deployment with Helm

This guide covers deploying OpenCTEM to a Kubernetes cluster using the official Helm chart located at `setup/kubernetes/helm/openctem/`. It walks through every step from cluster prerequisites to production hardening.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Quick Start](#2-quick-start)
3. [values.yaml Reference](#3-valuesyaml-reference)
4. [Namespace and RBAC Setup](#4-namespace-and-rbac-setup)
5. [Secret Management](#5-secret-management)
6. [Ingress Configuration](#6-ingress-configuration)
7. [Persistent Volumes](#7-persistent-volumes)
8. [HPA and Autoscaling](#8-hpa-and-autoscaling)
9. [Network Policies](#9-network-policies)
10. [Staging vs Production Values](#10-staging-vs-production-values)
11. [Health Checks and Readiness Verification](#11-health-checks-and-readiness-verification)
12. [Upgrading](#12-upgrading)
13. [Rollback](#13-rollback)
14. [Troubleshooting](#14-troubleshooting)
15. [Production Checklist](#15-production-checklist)

---

## 1. Prerequisites

### Required Tools

| Tool | Minimum Version | Verify |
|------|----------------|--------|
| kubectl | 1.25+ | `kubectl version --client` |
| Helm | 3.12+ | `helm version` |
| openssl | any | `openssl version` |

### Cluster Requirements

- **Kubernetes**: v1.25 or later (EKS, GKE, AKS, or self-managed)
- **Nodes**: at least 2 worker nodes with a combined 4 CPU / 8 GB RAM available
- **Storage**: a default StorageClass that provisions `ReadWriteOnce` PersistentVolumes (or specify one explicitly in values)
- **Ingress controller**: NGINX Ingress Controller installed in the cluster
- **cert-manager** (optional but recommended): for automatic Let's Encrypt TLS certificates
- **Metrics Server**: required if you enable HorizontalPodAutoscaler (HPA)

Install the NGINX Ingress Controller and cert-manager if they are not already present:

```bash
# NGINX Ingress Controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace

# cert-manager
helm repo add jetstack https://charts.jetstack.io
helm repo update
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.crds.yaml
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace

# Metrics Server (if not already present)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

---

## 2. Quick Start

The fastest path from zero to a running OpenCTEM instance. This section creates secrets with generated values and installs the chart with minimal overrides. See subsequent sections for production-grade configuration.

```bash
# 1. Create namespace
kubectl create namespace openctem

# 2. Generate secrets
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
ENCRYPTION_KEY=$(openssl rand -hex 32)

# 3. Create Kubernetes secrets
kubectl create secret generic openctem-api-secrets \
  --namespace openctem \
  --from-literal=AUTH_JWT_SECRET="$JWT_SECRET" \
  --from-literal=APP_ENCRYPTION_KEY="$ENCRYPTION_KEY" \
  --from-literal=DB_USER=openctem \
  --from-literal=DB_PASSWORD="$DB_PASSWORD" \
  --from-literal=DB_NAME=openctem

kubectl create secret generic openctem-db-secrets \
  --namespace openctem \
  --from-literal=username=openctem \
  --from-literal=password="$DB_PASSWORD"

kubectl create secret generic openctem-redis-secrets \
  --namespace openctem \
  --from-literal=password="$REDIS_PASSWORD"

# 4. Install the chart from local source
helm install openctem ./setup/kubernetes/helm/openctem \
  --namespace openctem \
  --set ingress.hosts[0].host=openctem.example.com \
  --set ingress.tls[0].hosts[0]=openctem.example.com \
  --wait --timeout 10m

# 5. Verify
kubectl get pods --namespace openctem
```

When all pods show `Running` and `READY 1/1`, the platform is up. Point your DNS at the Ingress external IP and open `https://openctem.example.com`.

---

## 3. values.yaml Reference

The chart ships with a `values.yaml` that contains every configurable parameter. Below is the full breakdown.

### 3.1 global

```yaml
global:
  imageRegistry: ""        # Override registry for all images (e.g., "registry.internal.corp")
  imagePullSecrets: []     # List of Kubernetes secret names for private registry auth
```

- `imageRegistry` -- Prepended to every image repository. Leave empty to pull from Docker Hub.
- `imagePullSecrets` -- Reference secrets created with `kubectl create secret docker-registry`. Example: `[{name: regcred}]`.

### 3.2 api

```yaml
api:
  replicaCount: 2                      # Ignored when autoscaling.enabled is true
  image:
    repository: openctemio/api         # Container image for the Go API server
    tag: "latest"                      # Image tag; pin to a release in production
    pullPolicy: IfNotPresent           # IfNotPresent, Always, or Never
  service:
    type: ClusterIP                    # Service type (ClusterIP for internal access via Ingress)
    port: 8080                         # HTTP port the API listens on
    grpcPort: 9090                     # gRPC port for agent communication
  resources:
    requests:
      cpu: 250m
      memory: 256Mi
    limits:
      cpu: "2"
      memory: 1Gi
  env:                                 # Non-sensitive environment variables
    APP_ENV: production                # Runtime environment identifier
    LOG_LEVEL: info                    # debug, info, warn, error
    LOG_FORMAT: json                   # json or text
    SERVER_PORT: "8080"                # Must match service.port
    GRPC_PORT: "9090"                  # Must match service.grpcPort
    RATE_LIMIT_ENABLED: "true"         # Enable per-IP rate limiting
    RATE_LIMIT_RPS: "100"              # Requests per second per IP
    RATE_LIMIT_BURST: "200"            # Burst allowance above RPS
    AUTH_PROVIDER: local               # "local" or "oidc" (for Keycloak/Okta)
    AUTH_REQUIRE_EMAIL_VERIFICATION: "false"
    AUTH_ALLOW_REGISTRATION: "true"    # Set "false" for invite-only
  envFromSecret: openctem-api-secrets  # Secret name containing sensitive vars
  readinessProbe:                      # Used by K8s to determine if pod can receive traffic
    httpGet:
      path: /health
      port: 8080
    initialDelaySeconds: 10
    periodSeconds: 10
  livenessProbe:                       # Used by K8s to restart unhealthy pods
    httpGet:
      path: /health
      port: 8080
    initialDelaySeconds: 30
    periodSeconds: 30
  autoscaling:
    enabled: true                      # Enable HPA for the API deployment
    minReplicas: 2                     # Minimum pod count
    maxReplicas: 10                    # Maximum pod count
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80
```

When `autoscaling.enabled` is `true`, the `replicaCount` field is ignored and the HPA manages replica count.

### 3.3 ui

```yaml
ui:
  replicaCount: 2
  image:
    repository: openctemio/ui
    tag: "latest"
    pullPolicy: IfNotPresent
  service:
    type: ClusterIP
    port: 3000
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: "1"
      memory: 512Mi
  env:
    NEXT_PUBLIC_API_URL: ""            # Set if API is on a different domain; usually blank when using Ingress path routing
  readinessProbe:
    httpGet:
      path: /api/health
      port: 3000
    initialDelaySeconds: 10
    periodSeconds: 10
  livenessProbe:
    httpGet:
      path: /api/health
      port: 3000
    initialDelaySeconds: 30
    periodSeconds: 30
```

The UI container automatically receives `INTERNAL_API_URL` pointing at the in-cluster API service. No manual wiring is needed.

### 3.4 postgres

```yaml
postgres:
  enabled: true                        # Set false to use an external database
  image:
    repository: postgres
    tag: "17-alpine"
  storage:
    size: 50Gi                         # PVC size for data directory
    storageClass: ""                   # Empty string uses the cluster default StorageClass
  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: "2"
      memory: 2Gi
  auth:
    existingSecret: openctem-db-secrets  # Must contain keys "username" and "password"
    database: openctem                   # Database name to create
    username: openctem                   # Database user (must match secret)
```

Set `postgres.enabled: false` when using an external managed database (RDS, Cloud SQL, Azure Database for PostgreSQL). When disabled, configure `DB_HOST`, `DB_PORT`, and credentials via `api.env` and `api.envFromSecret`.

### 3.5 redis

```yaml
redis:
  enabled: true                        # Set false to use an external Redis
  image:
    repository: redis
    tag: "7-alpine"
  storage:
    size: 5Gi
    storageClass: ""
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: "1"
      memory: 1Gi
  auth:
    existingSecret: openctem-redis-secrets  # Must contain key "password"
```

The Redis StatefulSet runs with `--appendonly yes` for persistence. Set `redis.enabled: false` when using ElastiCache, Memorystore, or Azure Cache for Redis.

### 3.6 ingress

```yaml
ingress:
  enabled: true
  className: nginx                     # IngressClass name
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
  hosts:
    - host: openctem.example.com
      paths:
        - path: /
          pathType: Prefix
          service: ui                  # Routes to the UI service
        - path: /api
          pathType: Prefix
          service: api                 # Routes to the API service
        - path: /metrics
          pathType: Prefix
          service: api                 # Prometheus metrics endpoint
  tls:
    - secretName: openctem-tls         # cert-manager populates this automatically
      hosts:
        - openctem.example.com
```

Path routing directs `/` to the Next.js UI and `/api` plus `/metrics` to the Go API. Both services run behind `ClusterIP` services and are only reachable through the Ingress.

### 3.7 migrations

```yaml
migrations:
  image:
    repository: migrate/migrate
    tag: "v4.17.0"
  resources:
    requests:
      cpu: 100m
      memory: 64Mi
    limits:
      cpu: 500m
      memory: 256Mi
```

Migrations run as an init container inside the API deployment. The init container waits for PostgreSQL to become available, then runs `migrate up` before the API container starts.

### 3.8 serviceAccount

```yaml
serviceAccount:
  create: true     # Create a dedicated ServiceAccount
  name: ""         # Override name; defaults to release fullname
  annotations: {}  # AWS IRSA or GCP Workload Identity annotations go here
```

### 3.9 podDisruptionBudget

```yaml
podDisruptionBudget:
  enabled: true
  minAvailable: 1  # At least 1 API pod must remain available during voluntary disruptions
```

### 3.10 networkPolicy

```yaml
networkPolicy:
  enabled: false   # Enable to restrict pod-to-pod traffic (see Section 9)
```

---

## 4. Namespace and RBAC Setup

### Create the namespace with labels

```bash
kubectl create namespace openctem
kubectl label namespace openctem app.kubernetes.io/part-of=openctem
```

### Restricted RBAC for CI/CD

Create a Role and RoleBinding scoped to the `openctem` namespace for your CI/CD pipeline service account. This grants permission to manage deployments and secrets but nothing cluster-wide.

```yaml
# rbac-ci.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: openctem-deployer
  namespace: openctem
rules:
  - apiGroups: ["", "apps", "batch", "networking.k8s.io", "autoscaling", "policy"]
    resources:
      - pods
      - deployments
      - statefulsets
      - services
      - configmaps
      - secrets
      - ingresses
      - horizontalpodautoscalers
      - poddisruptionbudgets
      - jobs
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: openctem-deployer-binding
  namespace: openctem
subjects:
  - kind: ServiceAccount
    name: ci-deployer
    namespace: openctem
roleRef:
  kind: Role
  name: openctem-deployer
  apiGroup: rbac.authorization.k8s.io
```

```bash
kubectl apply -f rbac-ci.yaml
```

---

## 5. Secret Management

The chart expects three Kubernetes secrets to exist before `helm install`. Secrets are not created by the chart itself -- this is intentional to prevent sensitive values from being stored in Helm release history.

### 5.1 Required Secrets

**openctem-api-secrets** -- consumed by the API deployment via `envFrom`:

| Key | Description | Generation |
|-----|-------------|------------|
| `AUTH_JWT_SECRET` | JWT signing key, minimum 64 characters | `openssl rand -base64 64` |
| `APP_ENCRYPTION_KEY` | 32-byte hex key for encrypting sensitive fields at rest | `openssl rand -hex 32` |
| `DB_USER` | PostgreSQL username | `openctem` |
| `DB_PASSWORD` | PostgreSQL password | `openssl rand -base64 32` |
| `DB_NAME` | PostgreSQL database name | `openctem` |

**openctem-db-secrets** -- consumed by the PostgreSQL StatefulSet:

| Key | Description |
|-----|-------------|
| `username` | Must match `DB_USER` above |
| `password` | Must match `DB_PASSWORD` above |

**openctem-redis-secrets** -- consumed by the Redis StatefulSet:

| Key | Description |
|-----|-------------|
| `password` | Redis authentication password |

### 5.2 Create All Secrets

```bash
# Generate values
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
ENCRYPTION_KEY=$(openssl rand -hex 32)

# API secrets
kubectl create secret generic openctem-api-secrets \
  --namespace openctem \
  --from-literal=AUTH_JWT_SECRET="$JWT_SECRET" \
  --from-literal=APP_ENCRYPTION_KEY="$ENCRYPTION_KEY" \
  --from-literal=DB_USER=openctem \
  --from-literal=DB_PASSWORD="$DB_PASSWORD" \
  --from-literal=DB_NAME=openctem

# Database secrets (password must match api-secrets)
kubectl create secret generic openctem-db-secrets \
  --namespace openctem \
  --from-literal=username=openctem \
  --from-literal=password="$DB_PASSWORD"

# Redis secrets
kubectl create secret generic openctem-redis-secrets \
  --namespace openctem \
  --from-literal=password="$REDIS_PASSWORD"
```

### 5.3 Using External Secret Managers

For production environments, use an external secrets operator to sync secrets from Vault, AWS Secrets Manager, or GCP Secret Manager:

```yaml
# Example: External Secrets Operator with AWS Secrets Manager
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: openctem-api-secrets
  namespace: openctem
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: openctem-api-secrets
  data:
    - secretKey: AUTH_JWT_SECRET
      remoteRef:
        key: openctem/production
        property: jwt_secret
    - secretKey: APP_ENCRYPTION_KEY
      remoteRef:
        key: openctem/production
        property: encryption_key
    - secretKey: DB_USER
      remoteRef:
        key: openctem/production
        property: db_user
    - secretKey: DB_PASSWORD
      remoteRef:
        key: openctem/production
        property: db_password
    - secretKey: DB_NAME
      remoteRef:
        key: openctem/production
        property: db_name
```

### 5.4 Rotating Secrets

To rotate the JWT secret or database password:

```bash
# 1. Update the Kubernetes secret
kubectl create secret generic openctem-api-secrets \
  --namespace openctem \
  --from-literal=AUTH_JWT_SECRET="$(openssl rand -base64 64 | tr -d '\n')" \
  --from-literal=APP_ENCRYPTION_KEY="$ENCRYPTION_KEY" \
  --from-literal=DB_USER=openctem \
  --from-literal=DB_PASSWORD="$DB_PASSWORD" \
  --from-literal=DB_NAME=openctem \
  --dry-run=client -o yaml | kubectl apply -f -

# 2. Restart the API deployment to pick up the new values
kubectl rollout restart deployment/openctem-api --namespace openctem

# 3. Wait for the rollout to complete
kubectl rollout status deployment/openctem-api --namespace openctem --timeout=5m
```

When rotating the database password, update both `openctem-api-secrets` and `openctem-db-secrets`, then alter the PostgreSQL user password before restarting pods.

---

## 6. Ingress Configuration

### 6.1 Basic Ingress with NGINX

The chart creates an Ingress resource that routes paths to the appropriate backend services:

| Path | Backend | Port |
|------|---------|------|
| `/` | `openctem-ui` | 3000 |
| `/api` | `openctem-api` | 8080 |
| `/metrics` | `openctem-api` | 8080 |

### 6.2 Setting Up cert-manager for Let's Encrypt

Create a ClusterIssuer for Let's Encrypt:

```yaml
# cluster-issuer.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@yourcompany.com
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
      - http01:
          ingress:
            class: nginx
```

```bash
kubectl apply -f cluster-issuer.yaml
```

With the ClusterIssuer in place and the default `ingress.annotations` in `values.yaml` referencing `letsencrypt-prod`, cert-manager will automatically provision and renew TLS certificates. The certificate is stored in the secret named in `ingress.tls[0].secretName` (`openctem-tls` by default).

### 6.3 Custom Domain Configuration

Override the host in your values file:

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "120"
  hosts:
    - host: ctem.yourcompany.com
      paths:
        - path: /
          pathType: Prefix
          service: ui
        - path: /api
          pathType: Prefix
          service: api
        - path: /metrics
          pathType: Prefix
          service: api
  tls:
    - secretName: openctem-tls
      hosts:
        - ctem.yourcompany.com
```

After deploying, retrieve the Ingress external IP and create a DNS A record:

```bash
kubectl get ingress --namespace openctem -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}'
```

If your cloud provider assigns a hostname instead of an IP (common on AWS ELB), create a CNAME record instead:

```bash
kubectl get ingress --namespace openctem -o jsonpath='{.items[0].status.loadBalancer.ingress[0].hostname}'
```

### 6.4 Restricting /metrics Access

The `/metrics` endpoint should not be publicly accessible. Remove the path from Ingress and access it through `kubectl port-forward` instead:

```yaml
# Remove /metrics from Ingress hosts paths
ingress:
  hosts:
    - host: ctem.yourcompany.com
      paths:
        - path: /
          pathType: Prefix
          service: ui
        - path: /api
          pathType: Prefix
          service: api
```

```bash
# Access metrics locally via port-forward
kubectl port-forward svc/openctem-api --namespace openctem 9090:8080
curl http://localhost:9090/metrics
```

---

## 7. Persistent Volumes

### 7.1 PostgreSQL Storage

PostgreSQL uses a StatefulSet with a `volumeClaimTemplate`. The PVC is named `data-openctem-postgres-0` and is bound to the pod's lifecycle.

Default configuration:

| Setting | Value |
|---------|-------|
| Size | 50Gi |
| Access mode | ReadWriteOnce |
| Mount path | `/var/lib/postgresql/data` |
| PGDATA subdirectory | `/var/lib/postgresql/data/pgdata` |

To use a specific StorageClass (for example, SSD-backed storage):

```yaml
postgres:
  storage:
    size: 100Gi
    storageClass: gp3-encrypted   # AWS example
```

Common StorageClass names by provider:

| Provider | StorageClass |
|----------|-------------|
| AWS EKS | `gp3`, `gp3-encrypted`, `io2` |
| GCP GKE | `standard`, `premium-rwo` |
| Azure AKS | `managed-premium`, `managed-csi-premium` |
| Self-managed | Depends on CSI driver (e.g., `local-path`, `longhorn`) |

### 7.2 Redis Storage

Redis also uses a StatefulSet with persistent storage for its append-only file (AOF):

| Setting | Value |
|---------|-------|
| Size | 5Gi |
| Access mode | ReadWriteOnce |
| Mount path | `/data` |

```yaml
redis:
  storage:
    size: 10Gi
    storageClass: gp3-encrypted
```

### 7.3 Expanding PVCs

If you need more storage after initial deployment, and your StorageClass supports volume expansion:

```bash
# Check if expansion is allowed
kubectl get storageclass <your-sc> -o jsonpath='{.allowVolumeExpansion}'

# Patch the PVC
kubectl patch pvc data-openctem-postgres-0 --namespace openctem \
  -p '{"spec": {"resources": {"requests": {"storage": "100Gi"}}}}'
```

### 7.4 Using External Databases

When using a managed database, disable the in-cluster PostgreSQL and provide connection details:

```yaml
postgres:
  enabled: false

api:
  env:
    DB_HOST: "your-rds-instance.region.rds.amazonaws.com"
    DB_PORT: "5432"
```

Ensure `DB_USER`, `DB_PASSWORD`, and `DB_NAME` are set in `openctem-api-secrets`.

---

## 8. HPA and Autoscaling

### 8.1 How it Works

The chart deploys a `HorizontalPodAutoscaler` (autoscaling/v2) for the API deployment when `api.autoscaling.enabled` is `true`. The HPA scales based on CPU and memory utilization with conservative policies to prevent flapping:

- **Scale up**: add up to 2 pods per 60-second evaluation window, with a 60-second stabilization period.
- **Scale down**: remove 1 pod per 60-second evaluation window, with a 300-second (5-minute) stabilization period.

A `PodDisruptionBudget` is also created (when `podDisruptionBudget.enabled` is `true`) to ensure at least 1 API pod remains available during node drains and cluster upgrades.

### 8.2 Tuning Autoscaling

```yaml
api:
  autoscaling:
    enabled: true
    minReplicas: 3           # Higher minimum for production
    maxReplicas: 20          # Allow more headroom for traffic spikes
    targetCPUUtilizationPercentage: 60     # Scale earlier
    targetMemoryUtilizationPercentage: 75

podDisruptionBudget:
  enabled: true
  minAvailable: 2            # Keep at least 2 pods during disruptions
```

### 8.3 Verifying HPA Status

```bash
# Check HPA status and current metrics
kubectl get hpa --namespace openctem

# Expected output:
# NAME            REFERENCE              TARGETS           MINPODS   MAXPODS   REPLICAS
# openctem-api    Deployment/openctem-api 35%/70%, 42%/80%  2         10        3

# Detailed view with events
kubectl describe hpa openctem-api --namespace openctem
```

If the `TARGETS` column shows `<unknown>/70%`, the Metrics Server is not installed or not reporting data. Install it per Section 1.

### 8.4 Disabling Autoscaling

Set `api.autoscaling.enabled: false` and specify a fixed `replicaCount`:

```yaml
api:
  replicaCount: 4
  autoscaling:
    enabled: false
```

---

## 9. Network Policies

Network policies restrict which pods can communicate with each other. Enable them with `networkPolicy.enabled: true`.

The chart does not include built-in NetworkPolicy templates, so you should create them manually. Below is a recommended set:

```yaml
# network-policies.yaml

# Allow API pods to reach PostgreSQL
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: postgres-allow-api
  namespace: openctem
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/component: postgres
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app.kubernetes.io/component: api
      ports:
        - protocol: TCP
          port: 5432
---
# Allow API pods to reach Redis
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: redis-allow-api
  namespace: openctem
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/component: redis
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app.kubernetes.io/component: api
      ports:
        - protocol: TCP
          port: 6379
---
# Allow Ingress to reach API and UI
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-ingress-to-services
  namespace: openctem
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: openctem
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: ingress-nginx
      ports:
        - protocol: TCP
          port: 8080
        - protocol: TCP
          port: 3000
---
# Default deny all ingress in namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: openctem
spec:
  podSelector: {}
  policyTypes:
    - Ingress
```

```bash
kubectl apply -f network-policies.yaml
```

Verify that the ingress-nginx namespace has the expected label:

```bash
kubectl label namespace ingress-nginx kubernetes.io/metadata.name=ingress-nginx --overwrite
```

---

## 10. Staging vs Production Values

### 10.1 Staging: `values-staging.yaml`

```yaml
api:
  replicaCount: 1
  image:
    tag: "develop"
    pullPolicy: Always
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: "1"
      memory: 512Mi
  env:
    APP_ENV: staging
    LOG_LEVEL: debug
    LOG_FORMAT: text
    RATE_LIMIT_ENABLED: "false"
    AUTH_ALLOW_REGISTRATION: "true"
  autoscaling:
    enabled: false

ui:
  replicaCount: 1
  image:
    tag: "develop"
    pullPolicy: Always
  resources:
    requests:
      cpu: 50m
      memory: 64Mi
    limits:
      cpu: 500m
      memory: 256Mi

postgres:
  storage:
    size: 10Gi
  resources:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      cpu: "1"
      memory: 1Gi

redis:
  storage:
    size: 1Gi
  resources:
    requests:
      cpu: 50m
      memory: 64Mi
    limits:
      cpu: 500m
      memory: 256Mi

ingress:
  hosts:
    - host: staging.openctem.yourcompany.com
      paths:
        - path: /
          pathType: Prefix
          service: ui
        - path: /api
          pathType: Prefix
          service: api
  tls:
    - secretName: openctem-staging-tls
      hosts:
        - staging.openctem.yourcompany.com

podDisruptionBudget:
  enabled: false

networkPolicy:
  enabled: false
```

```bash
helm install openctem ./setup/kubernetes/helm/openctem \
  --namespace openctem-staging --create-namespace \
  --values values-staging.yaml \
  --wait --timeout 10m
```

### 10.2 Production: `values-production.yaml`

```yaml
api:
  image:
    tag: "v1.2.0"
    pullPolicy: IfNotPresent
  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: "4"
      memory: 2Gi
  env:
    APP_ENV: production
    LOG_LEVEL: info
    LOG_FORMAT: json
    RATE_LIMIT_ENABLED: "true"
    RATE_LIMIT_RPS: "200"
    RATE_LIMIT_BURST: "400"
    AUTH_ALLOW_REGISTRATION: "false"
    AUTH_REQUIRE_EMAIL_VERIFICATION: "true"
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 20
    targetCPUUtilizationPercentage: 60
    targetMemoryUtilizationPercentage: 75

ui:
  replicaCount: 3
  image:
    tag: "v1.2.0"
    pullPolicy: IfNotPresent
  resources:
    requests:
      cpu: 200m
      memory: 256Mi
    limits:
      cpu: "2"
      memory: 1Gi

postgres:
  storage:
    size: 200Gi
    storageClass: gp3-encrypted
  resources:
    requests:
      cpu: "1"
      memory: 2Gi
    limits:
      cpu: "4"
      memory: 8Gi

redis:
  storage:
    size: 10Gi
    storageClass: gp3-encrypted
  resources:
    requests:
      cpu: 250m
      memory: 256Mi
    limits:
      cpu: "2"
      memory: 2Gi

ingress:
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "200"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
  hosts:
    - host: ctem.yourcompany.com
      paths:
        - path: /
          pathType: Prefix
          service: ui
        - path: /api
          pathType: Prefix
          service: api
  tls:
    - secretName: openctem-prod-tls
      hosts:
        - ctem.yourcompany.com

podDisruptionBudget:
  enabled: true
  minAvailable: 2

networkPolicy:
  enabled: true
```

```bash
helm install openctem ./setup/kubernetes/helm/openctem \
  --namespace openctem \
  --values values-production.yaml \
  --wait --timeout 10m
```

---

## 11. Health Checks and Readiness Verification

### 11.1 Built-in Probes

The chart configures both readiness and liveness probes for every component:

| Component | Probe Path | Port | Readiness Delay | Liveness Delay |
|-----------|-----------|------|-----------------|----------------|
| API | `/health` | 8080 | 10s | 30s |
| UI | `/api/health` | 3000 | 10s | 30s |
| PostgreSQL | `pg_isready` | 5432 | 10s | 30s |
| Redis | `redis-cli ping` | 6379 | 5s | 15s |

### 11.2 Post-Deploy Verification

Run through these checks after every install or upgrade:

```bash
# 1. All pods running and ready
kubectl get pods --namespace openctem
# Every pod should show READY 1/1 and STATUS Running

# 2. Services have endpoints
kubectl get endpoints --namespace openctem
# Each service should list at least one IP

# 3. Ingress has an external address
kubectl get ingress --namespace openctem
# ADDRESS column should show an IP or hostname

# 4. API health check
kubectl exec -it deployment/openctem-api --namespace openctem -- \
  wget -qO- http://localhost:8080/health
# Should return {"status":"ok"} or similar

# 5. UI health check
kubectl exec -it deployment/openctem-ui --namespace openctem -- \
  wget -qO- http://localhost:3000/api/health

# 6. Database connectivity from API pod
kubectl exec -it deployment/openctem-api --namespace openctem -- \
  sh -c 'nc -z openctem-postgres 5432 && echo "DB reachable" || echo "DB unreachable"'

# 7. Redis connectivity from API pod
kubectl exec -it deployment/openctem-api --namespace openctem -- \
  sh -c 'nc -z openctem-redis 6379 && echo "Redis reachable" || echo "Redis unreachable"'

# 8. TLS certificate validity
kubectl get certificate --namespace openctem
# READY should be True

# 9. External health check (from outside the cluster)
curl -s https://ctem.yourcompany.com/api/health
```

### 11.3 Monitoring Init Container Progress

The API deployment has two init containers: `wait-for-db` and `migrate`. If a pod is stuck in `Init:0/2` or `Init:1/2`:

```bash
# Check init container logs
kubectl logs deployment/openctem-api --namespace openctem -c wait-for-db
kubectl logs deployment/openctem-api --namespace openctem -c migrate
```

---

## 12. Upgrading

### 12.1 Standard Upgrade

```bash
# 1. Review what will change
helm diff upgrade openctem ./setup/kubernetes/helm/openctem \
  --namespace openctem \
  --values values-production.yaml

# (Install helm-diff plugin if not present: helm plugin install https://github.com/databus23/helm-diff)

# 2. Perform the upgrade
helm upgrade openctem ./setup/kubernetes/helm/openctem \
  --namespace openctem \
  --values values-production.yaml \
  --wait --timeout 10m

# 3. Verify the rollout
kubectl rollout status deployment/openctem-api --namespace openctem --timeout=5m
kubectl rollout status deployment/openctem-ui --namespace openctem --timeout=5m

# 4. Check the new revision
helm history openctem --namespace openctem
```

### 12.2 Image-Only Upgrade

To update only the container image without changing values:

```bash
helm upgrade openctem ./setup/kubernetes/helm/openctem \
  --namespace openctem \
  --values values-production.yaml \
  --set api.image.tag=v1.3.0 \
  --set ui.image.tag=v1.3.0 \
  --wait --timeout 10m
```

### 12.3 Database Migration Considerations

Migrations run automatically via the init container on every pod start. When upgrading to a version with new migrations:

- The first pod to start will run `migrate up` and apply new migrations.
- Subsequent pods will find no pending migrations and start immediately.
- Migrations are transactional -- if one fails, the database rolls back to its previous state.

If a migration fails and leaves the schema in a dirty state:

```bash
# 1. Connect to the database
kubectl exec -it statefulset/openctem-postgres --namespace openctem -- \
  psql -U openctem -d openctem

# 2. Check migration status
SELECT * FROM schema_migrations;

# 3. Fix the dirty flag (after resolving the underlying issue)
UPDATE schema_migrations SET dirty = false;
\q

# 4. Restart the API deployment to retry
kubectl rollout restart deployment/openctem-api --namespace openctem
```

---

## 13. Rollback

### 13.1 Identify the Target Revision

```bash
helm history openctem --namespace openctem

# Output:
# REVISION    UPDATED                     STATUS      CHART           APP VERSION   DESCRIPTION
# 1           2026-03-01 10:00:00         superseded  openctem-0.1.0  1.0.0         Install complete
# 2           2026-03-05 14:30:00         superseded  openctem-0.1.0  1.0.0         Upgrade complete
# 3           2026-03-12 09:00:00         deployed    openctem-0.1.0  1.0.0         Upgrade complete
```

### 13.2 Roll Back

```bash
# Roll back to revision 2
helm rollback openctem 2 --namespace openctem --wait --timeout 10m

# Verify
helm status openctem --namespace openctem
kubectl get pods --namespace openctem
```

### 13.3 Rollback Limitations

- **Database migrations cannot be rolled back automatically.** The `migrate` init container only runs `up`. If a new migration has already been applied, rolling back the Helm release will not reverse the database schema change. In most cases, new migrations are backward-compatible and the previous application version will work with the new schema. If not, you must manually run `migrate down` steps:

```bash
kubectl exec -it statefulset/openctem-postgres --namespace openctem -- \
  psql -U openctem -d openctem -c "SELECT version, dirty FROM schema_migrations;"
```

- **PVC data is not affected by rollback.** Volume data for PostgreSQL and Redis is preserved across rollbacks.

---

## 14. Troubleshooting

### 14.1 Pods Stuck in `Pending`

**Cause**: Insufficient cluster resources or no matching nodes.

```bash
kubectl describe pod <pod-name> --namespace openctem
# Look at Events section for scheduling failures

# Check node resources
kubectl top nodes
kubectl describe nodes | grep -A 5 "Allocated resources"
```

**Fix**: Add nodes to the cluster, or reduce resource requests in values.

### 14.2 Pods in `CrashLoopBackOff`

```bash
# Check container logs
kubectl logs <pod-name> --namespace openctem --previous
kubectl logs <pod-name> --namespace openctem -c api

# Common causes:
# - Missing secrets: "secret openctem-api-secrets not found"
# - Database unreachable: init container wait-for-db never completes
# - Migration failure: init container migrate exits with error
```

### 14.3 Init Container `wait-for-db` Never Completes

**Cause**: PostgreSQL pod is not running or the service name is incorrect.

```bash
# Check postgres pod status
kubectl get pods --namespace openctem -l app.kubernetes.io/component=postgres

# Check postgres logs
kubectl logs statefulset/openctem-postgres --namespace openctem

# Test connectivity from within the namespace
kubectl run debug --rm -it --image=busybox --namespace openctem -- \
  nc -zv openctem-postgres 5432
```

### 14.4 Init Container `migrate` Fails

```bash
kubectl logs deployment/openctem-api --namespace openctem -c migrate

# Common errors:
# "dirty database version X": migration was partially applied
# "no change": not an error, means migrations are already up to date
# "connection refused": database not accepting connections yet
```

Fix dirty migrations:

```bash
kubectl exec -it statefulset/openctem-postgres --namespace openctem -- \
  psql -U openctem -d openctem -c "UPDATE schema_migrations SET dirty = false;"
kubectl rollout restart deployment/openctem-api --namespace openctem
```

### 14.5 Ingress Returns 502 Bad Gateway

**Cause**: Backend pods are not ready or service endpoints are empty.

```bash
# Check endpoints
kubectl get endpoints openctem-api openctem-ui --namespace openctem

# If endpoints show <none>, pods are not passing readiness probes
kubectl describe deployment openctem-api --namespace openctem

# Check readiness probe manually
kubectl exec -it deployment/openctem-api --namespace openctem -- \
  wget -qO- http://localhost:8080/health
```

### 14.6 TLS Certificate Not Issued

```bash
# Check certificate status
kubectl get certificate --namespace openctem
kubectl describe certificate openctem-tls --namespace openctem

# Check cert-manager logs
kubectl logs -l app.kubernetes.io/name=cert-manager --namespace cert-manager --tail=50

# Common causes:
# - DNS not pointing to ingress IP yet
# - ClusterIssuer "letsencrypt-prod" does not exist
# - HTTP-01 challenge solver cannot reach the cluster (firewall/security group)
```

### 14.7 HPA Not Scaling

```bash
kubectl describe hpa openctem-api --namespace openctem

# If targets show <unknown>:
# - Metrics Server is not installed
# - Resource requests are not set (HPA needs requests to calculate utilization)
kubectl top pods --namespace openctem
```

### 14.8 PVC Stuck in `Pending`

```bash
kubectl describe pvc data-openctem-postgres-0 --namespace openctem

# Common causes:
# - No StorageClass matches the requested storageClassName
# - StorageClass cannot provision volumes in the current zone
# - Insufficient cloud provider quota for persistent disks
kubectl get storageclass
```

---

## 15. Production Checklist

Complete every item before considering the deployment production-ready.

### Secrets and Security

- [ ] All three Kubernetes secrets created with strong, randomly generated values
- [ ] JWT secret is at least 64 characters
- [ ] Encryption key is a 32-byte hex string (64 hex characters)
- [ ] Database password uses at least 32 random characters
- [ ] Secrets are managed via External Secrets Operator or sealed-secrets (not plain `kubectl create`)
- [ ] `AUTH_ALLOW_REGISTRATION` set to `"false"` (invite-only)
- [ ] `AUTH_REQUIRE_EMAIL_VERIFICATION` set to `"true"`

### TLS and Networking

- [ ] Ingress has valid TLS certificate (cert-manager or manually provisioned)
- [ ] `nginx.ingress.kubernetes.io/ssl-redirect: "true"` is set
- [ ] `nginx.ingress.kubernetes.io/force-ssl-redirect: "true"` is set
- [ ] Rate limiting is enabled at the ingress level
- [ ] `/metrics` endpoint is not publicly accessible
- [ ] Network policies are enabled and applied
- [ ] DNS A/CNAME record points to the Ingress external address

### High Availability

- [ ] API `minReplicas` is at least 3
- [ ] UI `replicaCount` is at least 2
- [ ] Pod Disruption Budget is enabled with `minAvailable: 2`
- [ ] HPA is enabled and tested under load
- [ ] Pods are spread across multiple nodes (use pod anti-affinity if needed)

### Storage and Data

- [ ] PostgreSQL PVC uses encrypted storage class
- [ ] PostgreSQL PVC size is appropriate for expected data volume
- [ ] Redis PVC uses persistent storage with AOF enabled (default)
- [ ] Database backup strategy is in place (CronJob or cloud-native snapshots)
- [ ] Backup restore procedure has been tested

### Resources

- [ ] API resource requests and limits are tuned based on load testing
- [ ] PostgreSQL resource limits allow for query spikes (minimum 2Gi memory)
- [ ] All containers have both requests and limits set

### Observability

- [ ] `LOG_FORMAT` set to `json` for structured log ingestion
- [ ] `LOG_LEVEL` set to `info` (not `debug`)
- [ ] Prometheus scraping `/metrics` endpoint
- [ ] Alerting configured for pod restarts, high error rates, and resource exhaustion
- [ ] Log aggregation pipeline configured (Loki, ELK, CloudWatch, etc.)

### Operations

- [ ] `helm history` shows clean revision history
- [ ] Rollback procedure documented and tested
- [ ] Image tags are pinned to specific versions (not `latest`)
- [ ] CI/CD pipeline deploys via `helm upgrade --wait`
- [ ] RBAC restricts who can deploy to the namespace

### Container Security

- [ ] API pods run as non-root (`runAsUser: 1000`)
- [ ] PostgreSQL pods run as user 999
- [ ] Redis pods run as user 999
- [ ] API containers use read-only root filesystem
- [ ] `allowPrivilegeEscalation: false` is set on all containers
- [ ] Image pull policy set to `IfNotPresent` (not `Always`) for tagged releases

---

## Appendix: Chart Template Reference

| Template File | Resource | Condition |
|--------------|----------|-----------|
| `api-deployment.yaml` | Deployment (API) | Always |
| `api-service.yaml` | Service (API) | Always |
| `ui-deployment.yaml` | Deployment + Service (UI) | Always |
| `postgres-statefulset.yaml` | StatefulSet + Service (PostgreSQL) | `postgres.enabled` |
| `redis-deployment.yaml` | StatefulSet + Service (Redis) | `redis.enabled` |
| `ingress.yaml` | Ingress | `ingress.enabled` |
| `hpa.yaml` | HPA + PDB | `api.autoscaling.enabled` / `podDisruptionBudget.enabled` |
| `configmap.yaml` | ConfigMap | Always |
| `secrets.yaml` | ServiceAccount | `serviceAccount.create` |
