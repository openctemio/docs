---
layout: default
title: Platform Administration
parent: Platform Guides
nav_order: 20
---
# Platform Administration Guide

This guide covers how to set up and manage the OpenCTEM platform: bootstrapping
the platform administrators and the first organization, and running the
installation from the admin console.

---

## Overview

The OpenCTEM platform has two types of administration:

| Type | Purpose | Tools |
|------|---------|-------|
| **Organization (tenant) admin** | Owners and admins of one organization: assets, scans, findings, members, roles, SCIM | Web UI (**Settings**), tenant API |
| **Platform admin** | Runs the installation: organizations, per-organization SSO, administrators, system logs, platform sign-in | Admin console at `/admin` in the web UI, `bootstrap-admin` |

A platform administrator is a normal sign-in account that **belongs to no
organization** and does not see organization data. It signs in on `/login` like
everyone else and opens the console with an authenticator (TOTP) code.
Administrators have no API keys.

This guide focuses on **Platform Administration**.

---

## Initial Setup (Bootstrap)

A new install has no accounts and no organizations. The `bootstrap-admin`
command, shipped in the API image at `/app/bootstrap-admin`, creates in one
run:

- the **platform administrator**,
- a **break-glass** backup super admin (required unless `-no-backup`): a local
  account for when the identity provider or the primary administrator is
  unavailable; every sign-in with it is audited and alerted,
- optionally, the **first organization** and its **owner**.

It connects to the database directly, using `-db`, `DATABASE_URL`, or the
`DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` / `DB_SSLMODE`
variables the API container already has.

### Prerequisites

1. Database migrations applied (Docker Compose and Helm run them
   automatically before the API starts)
2. Three different email addresses: administrator, break-glass administrator,
   organization owner. The owner cannot be an administrator's address, because
   a platform administrator cannot be an organization member.

### Docker Compose

From the `api/deploy` directory of a running stack:

```bash
docker compose exec api /app/bootstrap-admin \
  -email=admin@yourcompany.com \
  -backup-email=breakglass@yourcompany.com \
  -org-name="Your Company" \
  -org-owner-email=owner@yourcompany.com
```

### Kubernetes (Helm)

Set the values before `helm install`; the chart runs the command in a
post-install Job after the migrations:

```yaml
api:
  tenantCreationMode: admin_only        # the default
  bootstrapAdmin:
    enabled: true
    email: admin@yourcompany.com
    backupEmail: breakglass@yourcompany.com
    org:
      name: Your Company
      ownerEmail: owner@yourcompany.com
```

The completed Job is kept so you can read the one-time credentials. Read them,
store them, then delete the Job (release `openctem`; the name is
`<fullname>-api-bootstrap-admin`):

```bash
kubectl logs -n openctem job/openctem-api-bootstrap-admin
kubectl delete -n openctem job/openctem-api-bootstrap-admin
```

A failed Job fails the install. The Job receives `api.extraEnv` and
`api.extraEnvFrom`, so `SMTP_*` settings there let it email the owner's link.
On an existing release (the Job runs on install only), run the command in the
API pod instead:

```bash
kubectl exec -n openctem deploy/openctem-api -- /app/bootstrap-admin \
  -email=admin@yourcompany.com -backup-email=breakglass@yourcompany.com
```

### Flags

| Flag | Environment variable | Meaning |
|------|----------------------|---------|
| `-email` | `ADMIN_EMAIL` | Platform administrator (required). |
| `-name` | `ADMIN_NAME` | Display name (default: the part of the email before `@`). |
| `-role` | | `super_admin` (default), `ops_admin` or `readonly`. |
| `-backup-email` | `ADMIN_BACKUP_EMAIL` | Break-glass backup super admin. Required unless `-no-backup`. |
| `-backup-name` | `ADMIN_BACKUP_NAME` | Its display name. |
| `-no-backup` | | Skip the break-glass administrator (not recommended; prints a warning). |
| `-org-name` | `ORG_NAME` | First organization's name. Goes with `-org-owner-email`. |
| `-org-slug` | `ORG_SLUG` | Its URL slug (default: derived from the name). |
| `-org-owner-email` | `ORG_OWNER_EMAIL` | The organization owner. Goes with `-org-name`. |
| `-org-owner-name` | `ORG_OWNER_NAME` | The owner's display name. |
| `-link` | | Give an administrator created by v0.8 or older a sign-in account and reactivate it (keeps role and authenticator). |
| `-force` | | Delete and re-create an existing administrator with the same email. |
| `-db` | `DATABASE_URL` | Database URL, when the `DB_*` variables are not set. |

### What it prints

Once, and never again:

- a **temporary password** for each new administrator, and
- the organization owner's **one-time set-password link** (valid 24 hours),
  unless SMTP is configured, in which case the link is emailed to the owner.

Store the break-glass credentials offline. Running the command again is safe:
existing administrators are reported and left unchanged, and an organization
with the same slug is skipped. The organization is created through the normal,
audited organization service.

### First sign-in

1. Each administrator signs in on `/login` with the temporary password, sets a
   new password (required before anything else) and signs in again.
2. The console (`/admin`) asks them to scan a QR code with an authenticator app
   and enter the code. The console asks for a code at every sign-in.
3. The organization owner opens the set-password link, chooses a password,
   signs in, and adds users under **Settings → Members** (*Add user* or
   *Invite user*).

The full walkthrough is in [Getting Started](getting-started.md#2-first-time-setup).

### Admin Roles

| Role | Permissions |
|------|-------------|
| `super_admin` | Full access: administrators, organizations, per-organization SSO, platform sign-in settings |
| `ops_admin` | Operations: create organizations and organization users, day-to-day platform operations |
| `readonly` | Read-only access to the console |

### Organizations

By default only the platform administrator creates organizations
(`TENANT_CREATION_MODE=admin_only`, Helm `api.tenantCreationMode`). In the
console, **Organizations → Create** takes the organization name and the owner's
email; a new owner account gets a one-time set-password link (emailed with
SMTP, otherwise shown once). Per-organization SSO (OIDC, SAML, verified
domains, enforcement) is under **Organizations** → the organization →
**Single sign-on**. `TENANT_CREATION_MODE=self_service` lets any signed-in user
create organizations; use it only for SaaS or trial installs. See
[Multi-Tenancy](multi-tenancy.md#who-can-create-organizations).

{: .note }
`bootstrap-tenant` and the Helm `api.bootstrapTenant` values were removed. Use
the `-org-*` flags (Helm `api.bootstrapAdmin.org.*`) or the console.

---

## Admin CLI (openctem-admin)

{: .warning }
**Removed in v0.9.0.** The `openctem-admin` CLI, admin API keys
(`X-Admin-API-Key`) and `POST /api/v1/admin/users` no longer exist (migration
000227 revoked every key). The sections from here to
[Development Environment Setup](#development-environment-setup) describe that
older interface and are kept only for installations still on v0.8. Use the
admin console at `/admin` instead; see
[Upgrading from v0.8 to v0.9](../operations/upgrade-to-v0.9.md#2-platform-administrators-are-people-admin-api-keys-are-removed).


The `openctem-admin` CLI provides kubectl-style commands for platform management.

### Installation

#### Binary Installation

```bash
# v0.8.0 was the last release with this CLI
curl -sSL https://github.com/openctemio/openctem/releases/download/v0.8.0/openctem-admin-v0.8.0-linux-amd64.tar.gz | tar xz
chmod +x openctem-admin
sudo mv openctem-admin /usr/local/bin/openctem-admin

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
  ghcr.io/openctemio/admin-cli:v0.8.0'

# Use normally
openctem-admin get agents
```

### Configuration

The CLI supports three configuration methods (in priority order):

#### 1. Command Line Flags (Highest Priority)

```bash
openctem-admin --api-url=https://your-domain.com --api-key=oc-admin-xxx get agents
```

#### 2. Environment Variables

```bash
export OPENCTEM_API_URL=https://your-domain.com
export OPENCTEM_API_KEY=oc-admin-a1b2c3d4e5f6...
openctem-admin get agents
```

#### 3. Config File (~/.openctem/config.yaml)

```bash
# Create context
openctem-admin config set-context prod \
  --api-url=https://your-domain.com \
  --api-key=oc-admin-a1b2c3d4e5f6...

# Or use key file for security
echo "oc-admin-a1b2c3d4e5f6..." > ~/.openctem/prod-key
chmod 600 ~/.openctem/prod-key
openctem-admin config set-context prod \
  --api-url=https://your-domain.com \
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
      api-url: https://your-domain.com
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
#   ./agent -platform -bootstrap-token=abc123.xxxxxxxxxxxxxxxx -api-url=https://your-domain.com

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
  -api-url=https://your-domain.com \
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
  -api-url=https://your-domain.com
```

### Docker Deployment

```bash
# Using bootstrap token
docker run -d \
  --name openctem-platform-agent \
  --restart unless-stopped \
  -e API_URL=https://your-domain.com \
  -e BOOTSTRAP_TOKEN=abc123.xxxxxxxxxxxxxxxx \
  -v agent-data:/home/openctem/.openctem \
  openctemio/agent:platform

# Using pre-assigned API key
docker run -d \
  --name openctem-platform-agent \
  --restart unless-stopped \
  -e API_URL=https://your-domain.com \
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
              value: "https://your-domain.com"
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
kubectl create secret generic openctem-bootstrap-token \
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
              value: "https://your-domain.com"
            - name: BOOTSTRAP_TOKEN
              valueFrom:
                secretKeyRef:
                  name: openctem-bootstrap-token
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
helm repo add openctem https://charts.openctem.io
helm repo update
```

**Method 1: Bootstrap Token (Auto-registration)**

Best for dynamic scaling where each pod registers as a unique agent.

```bash
# 1. Create bootstrap token
openctem-admin create token --max-uses=10 --expires=24h

# 2. Install with bootstrap token
helm install platform-agent openctem/platform-agent \
  --namespace openctem \
  --create-namespace \
  --set apiUrl=https://your-domain.com \
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
  --namespace openctem \
  --create-namespace \
  --set apiUrl=https://your-domain.com \
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
  --namespace openctem \
  --set apiUrl=https://your-domain.com \
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
  --namespace openctem \
  --reuse-values \
  --set replicaCount=5

# Upgrade chart version
helm upgrade platform-agent openctem/platform-agent \
  --namespace openctem \
  --reuse-values

# Uninstall
helm uninstall platform-agent -n openctem

# If using StatefulSet, also delete PVCs
kubectl delete pvc -l app.kubernetes.io/instance=platform-agent -n openctem
```

For full documentation, see the [Helm chart README](https://github.com/openctemio/helm-charts/tree/main/charts/openctem#readme).

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
curl -v https://your-domain.com/health
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

Local development uses the same `bootstrap-admin` command, built from `api/`
in the [openctem repository](https://github.com/openctemio/openctem) and pointed
at your development database (migrations applied):

```bash
cd openctem/api
go build -o ./bin/bootstrap-admin ./cmd/bootstrap-admin

./bin/bootstrap-admin \
  -db "postgres://openctem:openctem@localhost:5432/openctem?sslmode=disable" \
  -email admin@localhost \
  -backup-email breakglass@localhost \
  -org-name "Dev Org" \
  -org-owner-email owner@localhost
```

From v0.9.0 every release also attaches prebuilt binaries,
`bootstrap-admin-<version>-<os>-<arch>.tar.gz` (`.zip` for Windows), with
`checksums-sha256.txt`, on the
[openctem releases page](https://github.com/openctemio/openctem/releases), and
the `ghcr.io/openctemio/admin-cli` image runs the same command.

Without SMTP the owner's set-password link is printed. Sign in on the UI's
`/login` as described in [First sign-in](#first-sign-in). If the API runs in
Docker, use `docker compose exec api /app/bootstrap-admin …` instead (the
service is `app` in some development compose files).

There is no admin API key or separate admin UI: the console is `/admin` in the
main web UI, and the API authenticates administrators with the console session.

---

## Related Documentation

- [Authentication Guide](./authentication.md) - Tenant API key management
- [Running Agents](./running-agents.md) - Tenant agent setup
- [Docker Deployment](./docker-deployment.md) - Container deployment
- [API Reference](../backend/api-reference.md) - Full API documentation
