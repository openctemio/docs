---
layout: default
title: Platform Administration
parent: Platform Guides
nav_order: 20
---
# Platform Administration Guide

This guide covers how to set up and manage the OpenCTEM platform, including bootstrapping admin credentials, managing platform agents, and using the admin CLI.

---

## Overview

The OpenCTEM platform has two types of administration:

| Type | Purpose | Tools |
|------|---------|-------|
| **Tenant Admin** | Manage assets, scans, users within a tenant | Web UI, Tenant API |
| **Platform Admin** | Manage platform infrastructure, agents, quotas | Admin CLI, Admin API |

This guide focuses on **Platform Administration**.

---

## Initial Setup (Bootstrap)

When deploying OpenCTEM for the first time, you need to create the first admin user. This is done using the `bootstrap-admin` tool which connects directly to the database.

### Prerequisites

1. Database migrations have been applied
2. API container running (or direct database access)

### Bootstrap First Admin

The `bootstrap-admin` tool is included in the API Docker image. Since it needs database access, you run it from within the API container.

#### Option 1: Using Setup Makefile (Recommended)

If you're using the `setup/` deployment:

```bash
cd setup

# Staging environment
make bootstrap-admin-staging email=admin@yourcompany.com

# Production environment
make bootstrap-admin-prod email=admin@yourcompany.com

# With specific role
make bootstrap-admin-staging email=ops@yourcompany.com role=ops_admin
```

#### Option 2: Using docker-compose exec

```bash
# Run bootstrap-admin from within the API container
# The container already has DB_HOST, DB_USER, etc. configured
docker-compose exec api ./bootstrap-admin \
  -email "admin@yourcompany.com" \
  -role "super_admin"

# Note: The service name may be 'api' or 'app' depending on your compose file
```

#### Option 3: Using docker exec

```bash
# If using plain docker (not compose)
docker exec -it openctem-api ./bootstrap-admin \
  -email "admin@yourcompany.com" \
  -role "super_admin"
```

#### Option 4: Using standalone admin-cli image

```bash
# For environments where API container isn't accessible
# Must have network access to the database
docker run --rm \
  --network your-network \
  --entrypoint /usr/local/bin/bootstrap-admin \
  -e DATABASE_URL="postgres://user:pass@db:5432/openctem?sslmode=disable" \
  -e ADMIN_EMAIL="admin@yourcompany.com" \
  openctemio/admin-cli:latest
```

#### Option 5: Kubernetes Job (Recommended for K8s)

```yaml
# bootstrap-admin-job.yaml
apiVersion: v1
kind: Secret
metadata:
  name: bootstrap-admin-config
  namespace: openctem
type: Opaque
stringData:
  ADMIN_EMAIL: "admin@yourcompany.com"
---
apiVersion: batch/v1
kind: Job
metadata:
  name: bootstrap-admin
  namespace: openctem
spec:
  ttlSecondsAfterFinished: 300  # Clean up after 5 minutes
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: bootstrap-admin
          image: openctemio/api:latest
          command: ["./bootstrap-admin"]
          args: ["-role", "super_admin"]
          env:
            - name: DB_HOST
              valueFrom:
                secretKeyRef:
                  name: openctem-db-credentials
                  key: host
            - name: DB_PORT
              value: "5432"
            - name: DB_USER
              valueFrom:
                secretKeyRef:
                  name: openctem-db-credentials
                  key: username
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: openctem-db-credentials
                  key: password
            - name: DB_NAME
              value: openctem
            - name: DB_SSLMODE
              value: require
            - name: ADMIN_EMAIL
              valueFrom:
                secretKeyRef:
                  name: bootstrap-admin-config
                  key: ADMIN_EMAIL
```

```bash
# Apply the job
kubectl apply -f bootstrap-admin-job.yaml

# Watch for completion and get the API key from logs
kubectl logs -f job/bootstrap-admin -n openctem

# Clean up (or wait for ttlSecondsAfterFinished)
kubectl delete job bootstrap-admin -n openctem
```

#### Option 6: kubectl exec (Quick method for K8s)

```bash
# If API pod is already running
kubectl exec -it deploy/openctem-api -n openctem -- \
  ./bootstrap-admin -email "admin@yourcompany.com" -role "super_admin"
```

#### Option 7: Using Binary (development)

```bash
# Only for local development with direct DB access
./bootstrap-admin \
  -db "postgres://user:pass@localhost:5432/openctem?sslmode=disable" \
  -email "admin@yourcompany.com" \
  -role "super_admin"
```

### Bootstrap Output

```
=== Bootstrap Admin Created ===
  ID:    550e8400-e29b-41d4-a716-446655440000
  Email: admin@yourcompany.com
  Role:  super_admin

API Key (save this, it won't be shown again):
  oc-admin-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6

Configure the CLI:
  export OPENCTEM_API_KEY=oc-admin-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
  export OPENCTEM_API_URL=https://your-api-url

  # Or save to config file:
  openctem-admin config set-context prod --api-url=https://your-api-url --api-key=oc-admin-...
  openctem-admin config use-context prod

Test the connection:
  openctem-admin cluster-info
```

> **Important**: Save the API key immediately! It cannot be retrieved later.

### Admin Roles

| Role | Permissions |
|------|-------------|
| `super_admin` | Full access: manage admins, agents, tokens, all operations |
| `ops_admin` | Manage agents and tokens, view queue stats |
| `viewer` | Read-only access to platform status |

---

## Admin CLI (openctem-admin)

The `openctem-admin` CLI provides kubectl-style commands for platform management.

### Installation

#### Binary Installation

```bash
# Download from releases
curl -LO https://github.com/openctemio/api/releases/latest/download/openctem-admin-linux-amd64
chmod +x openctem-admin-linux-amd64
sudo mv openctem-admin-linux-amd64 /usr/local/bin/openctem-admin

# Verify installation
openctem-admin version
```

#### Using Docker

```bash
# Create alias for convenience
alias openctem-admin='docker run --rm -it \
  -e OPENCTEM_API_URL=$OPENCTEM_API_URL \
  -e OPENCTEM_API_KEY=$OPENCTEM_API_KEY \
  -v ~/.openctem:/root/.openctem \
  openctemio/admin-cli:latest'

# Use normally
openctem-admin get agents
```

### Configuration

The CLI supports three configuration methods (in priority order):

#### 1. Command Line Flags (Highest Priority)

```bash
openctem-admin --api-url=https://api.openctem.io --api-key=oc-admin-xxx get agents
```

#### 2. Environment Variables

```bash
export OPENCTEM_API_URL=https://api.openctem.io
export OPENCTEM_API_KEY=oc-admin-a1b2c3d4e5f6...
openctem-admin get agents
```

#### 3. Config File (~/.openctem/config.yaml)

```bash
# Create context
openctem-admin config set-context prod \
  --api-url=https://api.openctem.io \
  --api-key=oc-admin-a1b2c3d4e5f6...

# Or use key file for security
echo "oc-admin-a1b2c3d4e5f6..." > ~/.openctem/prod-key
chmod 600 ~/.openctem/prod-key
openctem-admin config set-context prod \
  --api-url=https://api.openctem.io \
  --api-key-file=~/.openctem/prod-key

# Switch contexts
openctem-admin config use-context prod

# List contexts
openctem-admin config get-contexts
```

**Config file format:**

```yaml
# ~/.openctem/config.yaml
apiVersion: admin.openctem.io/v1
kind: Config
current-context: prod

contexts:
  - name: prod
    context:
      api-url: https://api.openctem.io
      api-key-file: ~/.openctem/prod-key

  - name: staging
    context:
      api-url: https://api.staging.openctem.io
      api-key-file: ~/.openctem/staging-key

  - name: local
    context:
      api-url: http://localhost:8080
      api-key: oc-admin-local_dev_key
```

### Command Reference

#### Global Flags

All commands support these global flags:

| Flag | Short | Description |
|------|-------|-------------|
| `--output` | `-o` | Output format: `json`, `yaml`, `wide`, `name` |
| `--api-url` | | Override API URL from config |
| `--api-key` | | Override API key from config |
| `--context` | `-c` | Use specific context from config |
| `--verbose` | `-v` | Enable verbose output |

### Common Commands

#### Cluster Overview

```bash
# Get platform status
openctem-admin cluster-info

# Output:
# Platform Cluster Info
# =====================
#
# Agents:
#   Total:    5
#   Online:   4
#   Offline:  1
#   Drained:  0
#
# Capacity:
#   Total:    50 jobs
#   Used:     12 jobs (24.0%)
#   Free:     38 jobs
#
# Job Queue:
#   Pending:    3
#   Running:    12
#   Completed:  156 (24h)
#   Failed:     2 (24h)
```

#### Agent Management

```bash
# List agents
openctem-admin get agents
openctem-admin get agents -o wide
openctem-admin get agents -o json

# Get specific agent
openctem-admin describe agent agent-us-east-1

# Create agent (for manual registration)
openctem-admin create agent \
  --name=agent-us-east-1 \
  --region=us-east-1 \
  --capabilities=sast,sca,secrets \
  --max-jobs=10

# Maintenance operations
openctem-admin drain agent agent-us-east-1      # Stop accepting new jobs
openctem-admin uncordon agent agent-us-east-1   # Resume operations
openctem-admin delete agent agent-us-east-1     # Remove agent
```

#### Bootstrap Token Management

```bash
# List tokens
openctem-admin get tokens
openctem-admin get tokens -o wide

# Create token for agent registration
openctem-admin create token --max-uses=5 --expires=24h

# Output:
# token/tok-abc123 created
#
# Token Details:
#   ID:        tok-abc123
#   Max Uses:  5
#   Expires:   2026-01-27 15:04:05
#
# Bootstrap Token (save this, it won't be shown again):
#   abc123.xxxxxxxxxxxxxxxx
#
# Use this token to register a platform agent:
#   ./agent -platform -bootstrap-token=abc123.xxxxxxxxxxxxxxxx -api-url=https://api.openctem.io

# Revoke token
openctem-admin revoke token tok-abc123 --reason="No longer needed"
```

#### Admin User Management (super_admin only)

```bash
# List admins
openctem-admin get admins

# Create new admin
openctem-admin create admin --email=ops@company.com --role=ops_admin

# Output includes the new admin's API key
```

#### Job Queue Monitoring

```bash
# List jobs
openctem-admin get jobs
openctem-admin get jobs --status=pending
openctem-admin get jobs --status=running
openctem-admin get jobs -o wide

# Job details
openctem-admin describe job job-xyz123

# View job logs
openctem-admin logs job job-xyz123

# Follow job logs in real-time (updates every 2s)
openctem-admin logs job job-xyz123 -f

# Show last N lines
openctem-admin logs job job-xyz123 --tail=100
```

#### Declarative Configuration (apply)

Similar to `kubectl apply`, you can create resources from YAML files:

```bash
# Apply from file
openctem-admin apply -f agent.yaml

# Apply from stdin
cat agent.yaml | openctem-admin apply -f -
```

**Agent manifest example:**

```yaml
# agent.yaml
apiVersion: admin.openctem.io/v1
kind: Agent
metadata:
  name: agent-us-east-1
  labels:
    environment: production
spec:
  region: us-east-1
  capabilities:
    - sast
    - sca
    - secrets
  maxJobs: 10
```

**Bootstrap Token manifest example:**

```yaml
# token.yaml
apiVersion: admin.openctem.io/v1
kind: Token
metadata:
  name: bootstrap-token-prod
spec:
  maxUses: 5
  expiresIn: 24h
```

**Admin manifest example:**

```yaml
# admin.yaml
apiVersion: admin.openctem.io/v1
kind: Admin
metadata:
  name: ops-team
spec:
  email: ops@company.com
  role: ops_admin
```

#### Delete Resources

```bash
# Delete an agent (with confirmation prompt)
openctem-admin delete agent agent-us-east-1

# Force delete without confirmation
openctem-admin delete agent agent-us-east-1 --force

# Delete a token
openctem-admin delete token tok-abc123 --force
```

### Output Formats

```bash
# Default table format
openctem-admin get agents

# Wide table with more columns
openctem-admin get agents -o wide

# JSON output (for scripting)
openctem-admin get agents -o json

# YAML output
openctem-admin get agents -o yaml

# Just names (for scripting)
openctem-admin get agents -o name
```

### Watch Mode

```bash
# Real-time updates (refreshes every 2s)
openctem-admin get agents -w
```

---

## Platform Agent Setup

Platform agents are OpenCTEM-managed agents that can be used by multiple tenants.

### Registration Methods

#### Method 1: Bootstrap Token (Recommended)

```bash
# 1. Create bootstrap token (on admin machine)
openctem-admin create token --max-uses=1 --expires=1h

# 2. Start agent with token (on agent machine)
./agent -platform \
  -bootstrap-token=abc123.xxxxxxxxxxxxxxxx \
  -api-url=https://api.openctem.io \
  -region=us-east-1 \
  -capabilities=sast,sca,secrets

# Agent will:
# 1. Register using bootstrap token
# 2. Receive permanent API key
# 3. Start polling for jobs
```

#### Method 2: Pre-created Agent

```bash
# 1. Create agent record (on admin machine)
openctem-admin create agent \
  --name=agent-us-east-1 \
  --region=us-east-1 \
  --capabilities=sast,sca

# 2. Get the agent's API key from output
# 3. Start agent with key (on agent machine)
./agent -platform \
  -api-key=ragent_xxxxx \
  -api-url=https://api.openctem.io
```

### Docker Deployment

```bash
# Using bootstrap token
docker run -d \
  --name openctem-platform-agent \
  --restart unless-stopped \
  -e API_URL=https://api.openctem.io \
  -e BOOTSTRAP_TOKEN=abc123.xxxxxxxxxxxxxxxx \
  -v agent-data:/home/openctem/.openctem \
  openctemio/agent:platform

# Using pre-assigned API key
docker run -d \
  --name openctem-platform-agent \
  --restart unless-stopped \
  -e API_URL=https://api.openctem.io \
  -e API_KEY=ragent_xxxxx \
  openctemio/agent:platform
```

### Kubernetes Deployment

#### Option A: Using Pre-assigned API Key (Recommended for Production)

```bash
# 1. Create agent and get API key
openctem-admin create agent --name=agent-k8s-pool --region=us-east-1 --capabilities=sast,sca,secrets

# 2. Create secret with the API key
kubectl create secret generic openctem-agent-credentials \
  --from-literal=api-key=ragent_xxxxx \
  -n openctem
```

```yaml
# platform-agent-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: openctem-platform-agent
  namespace: openctem
spec:
  replicas: 3
  selector:
    matchLabels:
      app: openctem-platform-agent
  template:
    metadata:
      labels:
        app: openctem-platform-agent
    spec:
      containers:
        - name: agent
          image: openctemio/agent:platform
          env:
            - name: API_URL
              value: "https://api.openctem.io"
            - name: API_KEY
              valueFrom:
                secretKeyRef:
                  name: openctem-agent-credentials
                  key: api-key
            - name: REGION
              value: "us-east-1"
            - name: CAPABILITIES
              value: "sast,sca,secrets"
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "2Gi"
              cpu: "2000m"
          volumeMounts:
            - name: agent-data
              mountPath: /home/openctem/.openctem
      volumes:
        - name: agent-data
          emptyDir: {}
```

#### Option B: Using Bootstrap Token (Auto-registration)

For dynamic scaling where each pod registers independently:

```bash
# 1. Create bootstrap token with enough uses for your replicas
openctem-admin create token --max-uses=10 --expires=24h

# 2. Create secret with the bootstrap token
kubectl create secret generic.openctem-bootstrap-token \
  --from-literal=token=abc123.xxxxxxxxxxxxxxxx \
  -n openctem
```

```yaml
# platform-agent-bootstrap.yaml
apiVersion: apps/v1
kind: StatefulSet  # StatefulSet ensures unique agent names
metadata:
  name: openctem-platform-agent
  namespace: openctem
spec:
  serviceName: openctem-platform-agent
  replicas: 3
  selector:
    matchLabels:
      app: openctem-platform-agent
  template:
    metadata:
      labels:
        app: openctem-platform-agent
    spec:
      containers:
        - name: agent
          image: openctemio/agent:platform
          env:
            - name: API_URL
              value: "https://api.openctem.io"
            - name: BOOTSTRAP_TOKEN
              valueFrom:
                secretKeyRef:
                  name:.openctem-bootstrap-token
                  key: token
            - name: REGION
              value: "us-east-1"
            - name: CAPABILITIES
              value: "sast,sca,secrets"
            # Use pod name as agent name for uniqueness
            - name: AGENT_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "2Gi"
              cpu: "2000m"
          volumeMounts:
            - name: agent-data
              mountPath: /home/openctem/.openctem
  volumeClaimTemplates:
    - metadata:
        name: agent-data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 1Gi
```

#### Option C: Using Helm (Recommended)

Helm chart simplifies deployment with sensible defaults and easy configuration.

**Add Repository:**

```bash
helm repo add.openctem https://charts.openctem.io
helm repo update
```

**Method 1: Bootstrap Token (Auto-registration)**

Best for dynamic scaling where each pod registers as a unique agent.

```bash
# 1. Create bootstrap token
openctem-admin create token --max-uses=10 --expires=24h

# 2. Install with bootstrap token
helm install platform-agent openctem/platform-agent \
  --namespace.openctem \
  --create-namespace \
  --set apiUrl=https://api.openctem.io \
  --set bootstrapToken=abc123.xxxxxxxxxxxxxxxx \
  --set replicaCount=3 \
  --set agent.region=us-east-1 \
  --set agent.capabilities=sast,sca,secrets
```

**Method 2: Pre-assigned API Key (Shared Identity)**

Best for production with fixed replicas sharing the same agent identity.

```bash
# 1. Create agent
openctem-admin create agent --name=k8s-pool --region=us-east-1 --capabilities=sast,sca,secrets

# 2. Install with API key (uses Deployment instead of StatefulSet)
helm install platform-agent openctem/platform-agent \
  --namespace.openctem \
  --create-namespace \
  --set apiUrl=https://api.openctem.io \
  --set apiKey=ragent_xxxxx \
  --set useStatefulSet=false \
  --set replicaCount=3
```

**Method 3: Existing Secret**

Use credentials stored in an existing Kubernetes secret.

```bash
# 1. Create secret with credentials
kubectl create secret generic openctem-agent-creds \
  --from-literal=api-key=ragent_xxxxx \
  -n openctem

# 2. Install using existing secret
helm install platform-agent openctem/platform-agent \
  --namespace.openctem \
  --set apiUrl=https://api.openctem.io \
  --set existingSecret.enabled=true \
  --set existingSecret.name=openctem-agent-creds \
  --set useStatefulSet=false
```

**Key Configuration Options:**

| Parameter | Description | Default |
|-----------|-------------|---------|
| `apiUrl` | OpenCTEM API URL (required) | `""` |
| `bootstrapToken` | Bootstrap token for auto-registration | `""` |
| `apiKey` | Pre-assigned API key | `""` |
| `replicaCount` | Number of agent replicas | `3` |
| `useStatefulSet` | Use StatefulSet for unique agent names | `true` |
| `agent.region` | Agent region identifier | `""` |
| `agent.capabilities` | Comma-separated capabilities | `"sast,sca,secrets"` |
| `agent.maxJobs` | Max concurrent jobs per agent | `5` |
| `persistence.enabled` | Enable persistent storage (StatefulSet) | `true` |
| `persistence.size` | Storage size | `5Gi` |

**Upgrade & Maintenance:**

```bash
# Scale up
helm upgrade platform-agent openctem/platform-agent \
  --namespace.openctem \
  --reuse-values \
  --set replicaCount=5

# Upgrade chart version
helm upgrade platform-agent openctem/platform-agent \
  --namespace.openctem \
  --reuse-values

# Uninstall
helm uninstall platform-agent -n openctem

# If using StatefulSet, also delete PVCs
kubectl delete pvc -l app.kubernetes.io/instance=platform-agent -n openctem
```

For full documentation, see the [Helm chart README](https://github.com/openctemio/charts/tree/main/charts/platform-agent).

---

## Deployment Architecture

### Single-Server Deployment

```
┌─────────────────────────────────────────────────────────────┐
│                     Single Server                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   API        │  │   Redis      │  │  PostgreSQL  │      │
│  │   :8080      │  │   :6379      │  │   :5432      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │   Agent 1    │  │   Agent 2    │                         │
│  │   (platform) │  │   (platform) │                         │
│  └──────────────┘  └──────────────┘                         │
│                                                              │
│  Admin CLI connects via: http://localhost:8080              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Multi-Server Production

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Production Architecture                           │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Operator Workstation              Load Balancer                          │
│  ┌─────────────────┐              ┌─────────────────┐                    │
│  │ openctem-admin   │──HTTPS:443──▶│   nginx/ALB     │                    │
│  │ ~/.openctem/     │              │   :443          │                    │
│  │   config.yaml   │              └────────┬────────┘                    │
│  └─────────────────┘                       │                              │
│                                            ▼                              │
│                              ┌─────────────────────────┐                 │
│                              │     API Cluster         │                 │
│                              │  ┌─────┐ ┌─────┐ ┌─────┐│                 │
│                              │  │ API │ │ API │ │ API ││                 │
│                              │  │  1  │ │  2  │ │  3  ││                 │
│                              │  └─────┘ └─────┘ └─────┘│                 │
│                              └────────────┬────────────┘                 │
│                                           │                              │
│                    ┌──────────────────────┴──────────────────────┐      │
│                    ▼                                              ▼      │
│          ┌─────────────────┐                          ┌─────────────────┐│
│          │   PostgreSQL    │                          │     Redis       ││
│          │   (Primary)     │                          │   (Cluster)     ││
│          └─────────────────┘                          └─────────────────┘│
│                                                                           │
│  Region: us-east-1                        Region: eu-west-1              │
│  ┌──────────────────────┐                ┌──────────────────────┐        │
│  │  Platform Agents     │                │  Platform Agents     │        │
│  │  ┌─────┐ ┌─────┐    │                │  ┌─────┐ ┌─────┐    │        │
│  │  │ Ag1 │ │ Ag2 │    │──Long Poll───▶ │  │ Ag1 │ │ Ag2 │    │        │
│  │  └─────┘ └─────┘    │                │  └─────┘ └─────┘    │        │
│  └──────────────────────┘                └──────────────────────┘        │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Security Best Practices

### API Key Management

1. **Never commit API keys to version control**
2. **Use key files instead of inline keys in config**
   ```bash
   # Good: key in separate file with restricted permissions
   echo "oc-admin-xxx" > ~/.openctem/prod-key
   chmod 600 ~/.openctem/prod-key

   # Bad: key directly in config.yaml
   ```

3. **Rotate keys periodically**
   ```bash
   openctem-admin rotate-key admin <admin-id>
   ```

4. **Use least-privilege roles**
   - `viewer` for monitoring dashboards
   - `ops_admin` for day-to-day operations
   - `super_admin` only for initial setup and emergency access

### Bootstrap Token Security

1. **Use short expiration times** (1h - 24h)
2. **Limit max uses** (1-5 for production)
3. **Revoke unused tokens immediately**
4. **Monitor token usage in audit logs**

### Network Security

1. **Use TLS for all connections**
2. **Restrict admin API to internal network**
3. **Use VPN for remote admin access**
4. **Enable IP allowlisting if possible**

---

## Troubleshooting

### CLI Cannot Connect

```bash
# Check configuration
openctem-admin config view

# Test with verbose output
openctem-admin --verbose get agents

# Verify network connectivity
curl -v https://api.openctem.io/health
```

### Agent Not Registering

```bash
# Check token validity
openctem-admin get tokens

# Check agent logs
docker logs openctem-platform-agent

# Verify bootstrap token format: xxxxxx.yyyyyyyyyyyyyyyy
```

### Permission Denied

```bash
# Verify your role
openctem-admin get admins | grep your-email

# Check if operation requires super_admin
# Operations like "create admin" require super_admin role
```

---

## Quick Reference

### Command Cheat Sheet

```bash
# === CLUSTER INFO ===
openctem-admin cluster-info              # Platform overview
openctem-admin version                   # CLI version

# === AGENTS ===
openctem-admin get agents                # List all agents
openctem-admin get agents -o wide        # Detailed list
openctem-admin get agents -w             # Watch mode (auto-refresh)
openctem-admin describe agent <name>     # Agent details
openctem-admin create agent --name=<n> --region=<r> --capabilities=sast,sca
openctem-admin drain agent <name>        # Stop accepting new jobs
openctem-admin uncordon agent <name>     # Resume operations
openctem-admin delete agent <name>       # Remove agent

# === TOKENS ===
openctem-admin get tokens                # List bootstrap tokens
openctem-admin create token --max-uses=5 --expires=24h
openctem-admin describe token <id>       # Token details
openctem-admin revoke token <id> --reason="..."
openctem-admin delete token <id>         # Remove token

# === JOBS ===
openctem-admin get jobs                  # List platform jobs
openctem-admin get jobs --status=pending # Filter by status
openctem-admin describe job <id>         # Job details
openctem-admin logs job <id>             # View job logs
openctem-admin logs job <id> -f          # Follow logs in real-time

# === ADMINS ===
openctem-admin get admins                # List admin users
openctem-admin create admin --email=<e> --role=ops_admin

# === CONFIG ===
openctem-admin config set-context <name> --api-url=<url> --api-key=<key>
openctem-admin config use-context <name> # Switch context
openctem-admin config current-context    # Show current
openctem-admin config get-contexts       # List all contexts
openctem-admin config view               # Show full config

# === DECLARATIVE ===
openctem-admin apply -f agent.yaml       # Apply from file
cat manifest.yaml | openctem-admin apply -f -  # Apply from stdin
```

### Resource Aliases

| Resource | Aliases |
|----------|---------|
| `agents` | `agent`, `ag` |
| `tokens` | `token`, `tok` |
| `jobs` | `job` |
| `admins` | `admin` |

### Status Values

**Agent Status:**
- `online` - Agent is connected and accepting jobs
- `offline` - Agent is disconnected
- `draining` - Agent finishing current jobs, not accepting new ones

**Job Status:**
- `pending` - Waiting in queue
- `running` - Being processed by an agent
- `completed` - Successfully finished
- `failed` - Finished with errors
- `cancelled` - Cancelled by user/admin
- `expired` - Timed out

---

## Development Environment Setup

This section covers how to set up admin access in a local development environment.

### Prerequisites

1. PostgreSQL database running with migrations applied
2. API server running (either via Docker or directly)

### Method 1: Using bootstrap-admin Binary (Recommended for Dev)

Build and run the bootstrap-admin tool directly:

```bash
cd api

# Build the bootstrap-admin binary
go build -o ./bin/bootstrap-admin ./cmd/bootstrap-admin

# Run with database connection
./bin/bootstrap-admin \
  -db "postgres:/.openctem.openctem@localhost:5432/openctem?sslmode=disable" \
  -email "admin@localhost" \
  -name "Dev Admin" \
  -role "super_admin"
```

**Output:**
```
=== Bootstrap Admin Created ===
  ID:    550e8400-e29b-41d4-a716-446655440000
  Email: admin@localhost
  Name:  Dev Admin
  Role:  super_admin

API Key (save this, it won't be shown again):
  oc-admin-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

Use this key to authenticate with the Admin UI or API.
```

### Method 2: Using Docker Compose (setup folder)

If you're using the `setup/` deployment with docker-compose:

```bash
cd setup

# For staging environment
make bootstrap-admin-staging email=admin@localhost

# For production environment
make bootstrap-admin-prod email=admin@localhost

# With custom role and name
make bootstrap-admin-staging email=ops@localhost role=ops_admin name="Ops User"
```

### Method 3: Direct Docker Exec

If API container is already running:

```bash
# Find your API container name
docker ps | grep api

# Execute bootstrap-admin inside the container
docker exec -it <container_name> /app/bootstrap-admin \
  -email "admin@localhost" \
  -role "super_admin"
```

### Method 4: Using psql (Emergency/Manual)

If the bootstrap-admin tool is unavailable, you can insert directly via SQL:

```bash
# Generate a bcrypt hash for your API key
# Use this Go snippet or an online bcrypt generator:
# echo -n "oc-admin-your-secret-key-here" | htpasswd -bnBC 12 "" - | tr -d ':\n'

# Or generate in Go:
go run -e 'import "golang.org/x/crypto/bcrypt"; hash, _ := bcrypt.GenerateFromPassword([]byte("oc-admin-testsecretkey123456789012345678901234567890123456"), 12); print(string(hash))'
```

```sql
-- Connect to database
psql -h localhost -U.openctem -d.openctem

-- Insert admin user
INSERT INTO admin_users (
  id, email, name, role, api_key_hash, api_key_prefix, is_active, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'admin@localhost',
  'Dev Admin',
  'super_admin',
  '$2a$12$your-bcrypt-hash-here',  -- bcrypt hash of your API key
  'oc-admin-testsecr...',          -- first 20 chars of your key
  true,
  NOW(),
  NOW()
);
```

**Warning**: This method is not recommended. Use bootstrap-admin when possible.

### Using the Admin API Key

Once you have the API key, you can use it in several ways:

#### 1. Admin UI Login

1. Open Admin UI at `http://localhost:3001` (or your configured port)
2. Enter the API key in the login form
3. Click "Sign In"

#### 2. API Requests with curl

```bash
# Set your API key
export ADMIN_API_KEY="oc-admin-your-key-here"

# Validate the key
curl -X GET http://localhost:8080/api/v1/admin/auth/validate \
  -H "X-Admin-API-Key: $ADMIN_API_KEY"

# List platform agents
curl -X GET http://localhost:8080/api/v1/admin/platform-agents \
  -H "X-Admin-API-Key: $ADMIN_API_KEY"

# Get agent stats
curl -X GET http://localhost:8080/api/v1/admin/platform-agents/stats \
  -H "X-Admin-API-Key: $ADMIN_API_KEY"

# List bootstrap tokens
curl -X GET http://localhost:8080/api/v1/admin/bootstrap-tokens \
  -H "X-Admin-API-Key: $ADMIN_API_KEY"
```

#### 3. Admin CLI (openctem-admin)

```bash
# Set environment variables
export OPENCTEM_API_URL=http://localhost:8080
export OPENCTEM_API_KEY=oc-admin-your-key-here

# Or create a config context
openctem-admin config set-context local \
  --api-url=http://localhost:8080 \
  --api-key=oc-admin-your-key-here

openctem-admin config use-context local

# Now use commands
openctem-admin get agents
openctem-admin get tokens
```

### Environment Variables for Development

Create a `.env.local` file for easy development:

```bash
# .env.local
ADMIN_API_KEY=oc-admin-your-key-here
ADMIN_API_URL=http://localhost:8080
```

Then source it:

```bash
source .env.local
curl -X GET $ADMIN_API_URL/api/v1/admin/auth/validate \
  -H "X-Admin-API-Key: $ADMIN_API_KEY"
```

### Admin UI Development Configuration

For the Admin UI, set the API URL in `.env.local`:

```bash
# admin-ui/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### Troubleshooting Development Setup

#### "Invalid admin API key" error

1. Check if the key was copied correctly (no extra spaces)
2. Verify the admin user exists in database:
   ```sql
   SELECT id, email, role, is_active, api_key_prefix FROM admin_users;
   ```
3. Check if the key prefix matches what's stored

#### "CORS error" in Admin UI

Ensure your API has CORS configured for localhost:

```bash
# In .env.api.local or environment
CORS_ALLOWED_ORIGINS=*
# Or specific origins:
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
CORS_ALLOWED_HEADERS=Accept,Authorization,Content-Type,X-Request-ID,X-Admin-API-Key
```

Then restart the API server.

#### "404 Not Found" on /api/v1/admin/auth/validate

1. Ensure API server was rebuilt after adding admin routes
2. Check that admin routes are registered:
   ```bash
   # If API has route listing
   ./server -routes | grep admin
   ```

#### Database connection failed in bootstrap-admin

Check your connection string format:
```bash
# Correct format
-db "postgres://user:pass@host:5432/dbname?sslmode=disable"

# Common mistakes:
# - Missing sslmode parameter
# - Wrong port (default is 5432)
# - Password with special characters needs URL encoding
```

### Quick Start Script

Create a `scripts/dev-setup-admin.sh` for convenience:

```bash
#!/bin/bash
# scripts/dev-setup-admin.sh

set -e

DB_URL="${DB_URL:-postgres:/.openctem.openctem@localhost:5432/openctem?sslmode=disable}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@localhost}"
ADMIN_ROLE="${ADMIN_ROLE:-super_admin}"

echo "Building bootstrap-admin..."
cd api
go build -o ./bin/bootstrap-admin ./cmd/bootstrap-admin

echo "Creating admin user..."
./bin/bootstrap-admin \
  -db "$DB_URL" \
  -email "$ADMIN_EMAIL" \
  -role "$ADMIN_ROLE"

echo ""
echo "Done! Save the API key above."
echo ""
echo "To use with Admin UI:"
echo "  1. Open http://localhost:3001"
echo "  2. Enter the API key"
echo ""
echo "To use with curl:"
echo "  export ADMIN_API_KEY='oc-admin-...'"
echo "  curl -H 'X-Admin-API-Key: \$ADMIN_API_KEY' http://localhost:8080/api/v1/admin/auth/validate"
```

Make it executable and run:

```bash
chmod +x scripts/dev-setup-admin.sh
./scripts/dev-setup-admin.sh
```

---

## Related Documentation

- [Authentication Guide](./authentication.md) - Tenant API key management
- [Running Agents](./running-agents.md) - Tenant agent setup
- [Docker Deployment](./docker-deployment.md) - Container deployment
- [API Reference](../backend/api-reference.md) - Full API documentation
