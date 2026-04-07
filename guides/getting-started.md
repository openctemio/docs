# Getting Started Guide

Complete guide to deploy and configure OpenCTEM for first-time use.

## Table of Contents

1. [Deployment](#1-deployment)
2. [First-Time Setup](#2-first-time-setup)
3. [Create Your First Team](#3-create-your-first-team)
4. [Add Users](#4-add-users)
5. [Configure Integrations](#5-configure-integrations)
6. [Add Your First Assets](#6-add-your-first-assets)
7. [Run Your First Scan](#7-run-your-first-scan)
8. [Daily Operations](#8-daily-operations)

---

## 1. Deployment

### Option A: Docker Compose (Recommended for getting started)

```bash
git clone https://github.com/openctemio/openctemio.git
cd openctemio/setup

# Initialize config files
make init-prod

# Generate secrets (copy output to .env files)
make generate-secrets

# Setup SSL
make auto-ssl

# Start
make prod-up
```

**URLs after startup:**
- UI: https://localhost (or your configured domain)
- API: https://api.localhost (or your configured domain)
- Health: http://localhost:8080/health

### Option B: Kubernetes (Helm)

```bash
# Create namespace
kubectl create namespace openctem

# Create secrets
kubectl create secret generic openctem-api-secrets \
  --namespace openctem \
  --from-literal=AUTH_JWT_SECRET=$(openssl rand -base64 48) \
  --from-literal=APP_ENCRYPTION_KEY=$(openssl rand -hex 32) \
  --from-literal=DB_USER=openctem \
  --from-literal=DB_PASSWORD=$(openssl rand -hex 24) \
  --from-literal=DB_NAME=openctem

kubectl create secret generic openctem-db-secrets \
  --namespace openctem \
  --from-literal=username=openctem \
  --from-literal=password=<same-db-password>

kubectl create secret generic openctem-redis-secrets \
  --namespace openctem \
  --from-literal=password=$(openssl rand -hex 24)

# Install
helm install openctem ./setup/kubernetes/helm/openctem \
  --namespace openctem \
  --set ingress.hosts[0].host=openctem.yourdomain.com
```

**Important:** Verify probes are set to `/health`, not `/`:

```yaml
api:
  readinessProbe:
    httpGet:
      path: /health   # NOT /
      port: 8080
  livenessProbe:
    httpGet:
      path: /health   # NOT /
      port: 8080
```

### Verify deployment

```bash
# Docker Compose
curl http://localhost:8080/health
# {"status":"healthy"}

# Kubernetes
kubectl exec -it deploy/openctem-api -n openctem -- wget -qO- http://localhost:8080/health
```

---

## 2. First-Time Setup

### Create the first admin account

There is no default account. You must create the first admin manually.

**Docker Compose:**
```bash
cd setup
make bootstrap-admin-prod email=admin@yourcompany.com
```

**Kubernetes:**
```bash
kubectl exec -it deploy/openctem-api -n openctem -- \
  /app/bootstrap-admin -email=admin@yourcompany.com
```

**Output:**
```
=== Bootstrap Admin Created ===
  ID:    019d1234-5678-...
  Name:  admin
  Email: admin@yourcompany.com
  Role:  super_admin

API Key (save this, it won't be shown again):
  oc-admin-a1b2c3d4e5f6789...
```

**Save the API key** — you will need it for CLI and API access.

### Alternative: Use registration (temporary)

If `bootstrap-admin` is not available in your image:

```bash
# Kubernetes: temporarily enable registration
kubectl set env deploy/openctem-api -n openctem AUTH_ALLOW_REGISTRATION=true

# Wait for pod restart
kubectl rollout status deploy/openctem-api -n openctem

# Register via API
curl -X POST https://api.yourdomain.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourcompany.com",
    "password": "YourStr0ngP@ss123!",
    "name": "Admin User"
  }'

# IMPORTANT: Disable registration after creating admin
kubectl set env deploy/openctem-api -n openctem AUTH_ALLOW_REGISTRATION=false
```

---

## 3. Create Your First Team

1. Open the UI in your browser (https://yourdomain.com)
2. Login with the email and password you created
3. You will be redirected to **Create Team** page
4. Enter:
   - **Team Name**: Your company or project name
   - **Team URL** (slug): e.g., `my-company` (lowercase, hyphens only)
5. Click **Create Team**
6. You are now the **Owner** of this team

---

## 4. Add Users

### Disable public registration (production)

Set this environment variable so new users can only join via invitation:

```env
AUTH_ALLOW_REGISTRATION=false
```

### Invite users

1. Go to **Settings** → **Users**
2. Click **Invite User**
3. Enter:
   - **Email**: user@yourcompany.com
   - **Role**: Select a role
4. Click **Send Invitation**

**Available roles:**

| Role | Access |
|---|---|
| **Admin** | Full access except team deletion |
| **Member** | Read/write access to assets, findings, scans |
| **Viewer** | Read-only access |

The invited user will:
1. Receive an email with invitation link
2. Click link → create account (or login if account exists)
3. Automatically join your team with the assigned role

### SSO Login (optional)

If you want users to login with Microsoft (Entra ID), Google, or Okta:

1. Go to **Settings** → **Identity Providers**
2. Click **Add Provider**
3. Select provider (Entra ID, Okta, or Google Workspace)
4. Enter client ID, client secret, tenant ID
5. See [SSO Guide](sso-entra-id.md) for detailed setup

---

## 5. Configure Integrations

### Email (SMTP)

Required for sending invitations and notifications.

**System-wide (env vars):**
```env
SMTP_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@yourcompany.com
SMTP_PASSWORD=app-password
SMTP_FROM=noreply@yourcompany.com
```

**Per-tenant (via UI):**
Settings → Integrations → Notifications → Add → Email

See [SMTP Guide](smtp-configuration.md) for details.

### Notifications (optional)

1. Go to **Settings** → **Integrations** → **Notifications**
2. Add channels:
   - **Slack**: Webhook URL
   - **Microsoft Teams**: Webhook URL
   - **Telegram**: Bot token + chat ID
   - **Email**: SMTP settings
   - **Webhook**: Custom HTTP endpoint

### Source Code (optional)

1. Go to **Settings** → **Integrations** → **SCM**
2. Add provider:
   - **GitHub**: Personal access token or OAuth app
   - **GitLab**: Access token
3. Repositories will be synced as assets automatically

### Ticketing (optional)

1. Go to **Settings** → **Integrations** → **Ticketing**
2. Add provider:
   - **Jira**: API token + project key
   - **Linear**: API key
   - **Asana**: OAuth

---

## 6. Add Your First Assets

### Manual creation

1. Go to **Discovery** → **Assets** → select asset type (e.g., Domains)
2. Click **Add Asset**
3. Enter:
   - **Name**: e.g., `example.com`
   - **Criticality**: Critical / High / Medium / Low
4. Click **Create**

### Supported asset types (35+)

| Category | Types |
|---|---|
| External | Domains, Certificates, IP Addresses |
| Applications | Websites, APIs, Mobile Apps |
| Cloud | Cloud Accounts, Compute, Storage, Serverless |
| Infrastructure | Hosts, Containers, Databases, Networks, Kubernetes |
| Identity | IAM Users, IAM Roles, Service Accounts |
| Code | Repositories |

### Bulk import

Upload assets via the ingest API:

```bash
curl -X POST https://api.yourdomain.com/api/v1/ingest/ctis \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assets": [
      {"name": "example.com", "type": "domain", "criticality": "high"},
      {"name": "api.example.com", "type": "domain", "criticality": "medium"}
    ]
  }'
```

### Asset Groups

Organize assets by environment or business unit:

1. Go to **Scoping** → **Asset Groups**
2. Click **Create Group**
3. Set name, environment (Production/Staging/Dev), criticality
4. Add assets to the group

---

## 7. Run Your First Scan

### Prerequisites

- At least one asset created
- Scan agent running (platform agent or tenant agent)

### Create a scan

1. Go to **Discovery** → **Scans**
2. Click **New Scan**
3. Select:
   - **Target**: Choose assets or asset groups
   - **Scan Profile**: Select tools (Nuclei, Trivy, Semgrep, etc.)
   - **Agent**: Auto / Platform / Tenant
4. Click **Start Scan**

### View results

1. Scan results appear in **Findings** page
2. Each finding shows:
   - Severity (Critical/High/Medium/Low/Info)
   - CVSS score
   - Affected asset
   - Remediation guidance

---

## 8. Daily Operations

### Dashboard

The CTEM Dashboard (home page) shows:
- Total assets and high-risk count
- Open findings by severity
- Scan activity
- Risk score trends

### Finding management

1. **Triage**: Review new findings, assign severity
2. **Assign**: Assign findings to team members
3. **Fix**: Mark as fix applied when patched
4. **Verify**: Security team verifies the fix
5. **Resolve**: Close the finding

### Monitoring

- **Health**: `GET /health` — liveness check
- **Ready**: `GET /ready` — database + Redis status
- **Metrics**: `GET /metrics` — Prometheus metrics

### Backup

**Database backup (Docker Compose):**
```bash
docker compose exec -T postgres pg_dump -U openctem -d openctem -Fc > backup.dump
```

**Database backup (Kubernetes):**
```bash
kubectl exec -it statefulset/openctem-postgres -n openctem -- \
  pg_dump -U openctem -d openctem -Fc > backup.dump
```

### Migration rollback

If a migration fails:

```bash
# Docker Compose
docker run --rm --network openctemio_openctem-network \
  openctemio/migrations:latest \
  -path=/migrations \
  -database "postgres://openctem:PASSWORD@postgres:5432/openctem?sslmode=disable" \
  force <previous-version>

# Kubernetes
kubectl run migrate-fix --rm -it --restart=Never -n openctem \
  --image=openctemio/migrations:latest -- \
  -path=/migrations \
  -database "postgresql://openctem:PASSWORD@openctem-postgres:5432/openctem?sslmode=disable" \
  force <previous-version>
```

---

## Quick Reference

| Action | Where |
|---|---|
| Login | https://yourdomain.com/login |
| View assets | Discovery → Assets |
| View findings | Findings |
| Run scan | Discovery → Scans → New Scan |
| Invite user | Settings → Users → Invite |
| Add integration | Settings → Integrations |
| Configure SSO | Settings → Identity Providers |
| View audit log | Settings → Audit Log |
| API docs | https://api.yourdomain.com/docs |

## Guides

- [SSO with Entra ID](sso-entra-id.md)
- [SMTP Configuration](smtp-configuration.md)
- [Deployment Guide](../DEPLOYMENT.md)
