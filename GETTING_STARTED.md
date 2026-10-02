---
layout: default
title: Getting Started
nav_order: 1
---

# Getting Started with OpenCTEM Platform

Get your security platform running in **5 minutes**.

## What is OpenCTEM?

OpenCTEM is a **Continuous Threat Exposure Management (CTEM)** platform that helps you discover assets, scan for vulnerabilities, and prioritize remediation across your entire attack surface.

**Key Capabilities:**
- 🔍 **Asset Discovery** - Auto-discover repositories, cloud resources, cloud resources
- 🛡️ **Security Scanning** - SAST, SCA, secrets, IaC misconfigurations, infrastructure vulnerabilities  
- 📊 **Risk Prioritization** - Configurable risk scoring with CTEM factors
- 🔗 **Multi-Source Integration** - 8 built-in scanner integrations via Agent SDK

---

## Prerequisites

- **Docker & Docker Compose** (required)
- **Git** (required)
- **Go 1.26+** (optional, for development)

---

## 5-Minute Quickstart

### Step 1: Get the Compose Files

```bash
git clone https://github.com/openctemio/api.git
cd api/deploy
cp .env.example .env
```

Edit `.env`: set `OPENCTEM_VERSION`, `OPENCTEM_HOSTNAME`, `OPENCTEM_PUBLIC_URL`,
`OPENCTEM_TLS_MODE` and the generated secrets. See
[Exposing OpenCTEM: one HTTPS port](operations/single-https-port.md#quick-start-docker-compose)
for the minimum settings.

---

### Step 2: Start the Platform

```bash
docker compose up -d
docker compose ps -a
```

**Services Starting:**
- 🔐 Gateway (the only published port: `https://<OPENCTEM_HOSTNAME>`)
- 🎨 Web UI and 🔧 API (behind the gateway; the API is under `/api/v1`)
- 🗄️ PostgreSQL and 🔴 Redis (internal only)
- 🧱 `migrate` (runs the database migrations, then exits 0; the API waits for it)

Wait ~30 seconds for services to be healthy.

---

### Step 3: Create the First Administrator and Organization

There is no seeded default account and no default organization. Create the
platform administrator, its break-glass backup and the first organization with
the `bootstrap-admin` command in the API container:

```bash
docker compose exec api /app/bootstrap-admin \
  -email=admin@yourcompany.com \
  -backup-email=breakglass@yourcompany.com \
  -org-name="Your Company" \
  -org-owner-email=owner@yourcompany.com
```

Use three different addresses: a platform administrator belongs to no
organization, so it cannot be the organization owner. The command prints each
administrator's temporary password once, and the owner's one-time set-password
link (emailed instead when SMTP is configured). Then:

1. The administrator signs in at `https://<your-host>/login` with the
   temporary password, sets a new one, and enrolls an authenticator app (TOTP)
   when the admin console (`/admin`) opens. Store the break-glass credentials
   offline.
2. The owner opens the set-password link (valid 24 hours), chooses a password
   and signs in to the organization.
3. The owner adds users under **Settings → Members**; the administrator creates
   more organizations and per-organization SSO in the console.

See [First-Time Setup](guides/getting-started.md#2-first-time-setup) for every
flag, the Helm values and the self-service alternative.

---

### Step 4: Run Your First Scan

#### 4a. Create an Agent

1. Sign in to the UI as the organization owner
2. Navigate to **Settings > Agents**
3. Click **"Create Agent"**
4. Choose type: **Runner** (for CI/CD one-shot scans)
5. Copy the **API Key**

#### 4b. Run the Agent with Docker

```bash
docker run --rm \
  -v $(pwd):/scan \
  -e API_URL=https://ctem.example.com \
  -e API_KEY=your-api-key-here \
  openctemio/agent:latest \
  -tools semgrep,betterleaks,trivy -target /scan -push -verbose
```

Replace `your-api-key-here` with the key from step 4a.

{: .note }
`API_URL` is the gateway URL (your `OPENCTEM_PUBLIC_URL`, no `:8080`). With the
internal CA (`OPENCTEM_TLS_MODE=internal`), also mount the root certificate and
set `SSL_CERT_DIR`. See [Connecting sensors](operations/single-https-port.md#connecting-sensors).

This scans the current directory for:
- **semgrep** - Code vulnerabilities (SAST)
- **betterleaks** - Exposed secrets
- **trivy** - Package vulnerabilities (SCA)

#### 4c. View Results

1. Go to **Findings** in the UI
2. Filter by your repository/agent
3. Review detected vulnerabilities
4. Assign severity and remediation

---

## What's Next?

### Learn the Platform

| Topic | Guide |
|-------|-------|
| **Architecture** | [System Overview](./architecture/overview.md) |
| **End-to-End Workflow** | [Complete Scan Workflow](./guides/END_TO_END_WORKFLOW.md) |
| **API Reference** | [API Endpoints](./backend/api-reference.md) |
| **Agent Guide** | [Agent Quick Start](../agent/docs/QUICK_START.md) |

### Deploy to Production

| Topic | Guide |
|-------|-------|
| **Kubernetes** | [Production Deployment](./operations/PRODUCTION_DEPLOYMENT.md) |
| **Environment Config** | [Environment Variables](./ui/ops/ENVIRONMENT_VARIABLES.md) |
| **Security Hardening** | [Production Checklist](./ui/ops/PRODUCTION_CHECKLIST.md) |

### Platform Administration

| Topic | Guide |
|-------|-------|
| **Admin console & bootstrap** | [Platform Admin Guide](./guides/platform-admin.md) |
| **Organizations** | [Multi-Tenancy](./guides/multi-tenancy.md#who-can-create-organizations) |
| **Platform Agents** | [Shared Agent Architecture](./features/platform-agents.md) |

### Integrate CI/CD

| Platform | Example |
|----------|---------|
| **GitHub Actions** | [Agent README](../agent/README.md#github-actions) |
| **GitLab CI** | [Agent README](../agent/README.md#gitlab-ci) |
| **Custom** | [SDK Documentation](../sdk-go/README.md) |

---

## Common Commands

```bash
# Start platform
make prod-up

# Stop platform
make prod-down

# View logs
make logs

# Update all repositories
make pull-all

# Check status
make status

# Restart services
make restart
```

---

## Troubleshooting

### "Port 3000 already in use"

```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9

# Or change the port in docker-compose
```

### "Database connection failed"

```bash
# Check PostgreSQL is running
docker compose ps

# Restart database
docker compose restart postgres
```

### "Cannot connect to API"

Check API is running:
```bash
curl http://localhost:8080/health
```

Expected response: `{"status":"ok"}`

---

## Need Help?

- 📚 **Documentation:** [docs.openctem.io](https://docs.openctem.io)
- 💬 **Discord:** [discord.gg/openctemio](https://discord.gg/openctemio)
- 🐛 **Issues:** [GitHub Issues](https://github.com/openctemio/openctemio/issues)

---

**Ready to scan? Let's go! 🚀**
