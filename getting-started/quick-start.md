---
layout: default
title: Quick Start
parent: Getting Started
nav_order: 1
---

# 5-Minute Quick Start

Get OpenCTEM CTEM platform running in 5 minutes.

---

## What is OpenCTEM?

OpenCTEM is a **Continuous Threat Exposure Management (CTEM)** platform that helps you:

- 🔍 **Discover** assets across repos, cloud, and infrastructure
- 🛡️ **Scan** for vulnerabilities (SAST, SCA, secrets, IaC)
- 📊 **Prioritize** using AI-powered risk scoring
- 🔗 **Integrate** findings from Wiz, Tenable, CrowdStrike, and more

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Docker | 20.10+ |
| Docker Compose | 2.0+ |
| Git | 2.30+ |

---

## Step 1: Clone the Platform

```bash
# Clone the meta-repository
git clone https://github.com/openctemio.openctem-platform.git.openctemio
cd.openctemio

# Initialize all sub-repositories
make setup
```

This clones API, Agent, UI, and SDK repositories.

---

## Step 2: Start Services

```bash
# Start all services
make up

# Watch logs (optional)
make logs
```

**Services starting:**

| Service | URL | Purpose |
|---------|-----|---------|
| API | http://localhost:8080 | Backend REST API |
| UI | http://localhost:3000 | Tenant dashboard |
| Admin UI | http://localhost:3001 | Platform admin (optional) |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache & queues |

Wait ~30 seconds for all services to be healthy.

---

## Step 3: Login

**URL:** [http://localhost:3000](http://localhost:3000)

**Default credentials:**
```
Email: admin@openctem.io
Password: Admin123!
```

---

## Step 4: Run Your First Scan

See **[First Scan Tutorial](./first-scan.md)** for detailed instructions.

**Quick version:**

```bash
# Run agent with Docker
docker run --rm \
  -v $(pwd):/scan \
  -e API_URL=http://host.docker.internal:8080 \
  -e API_KEY=your-api-key \
  openctemio/agent:latest \
  -tools semgrep,gitleaks,trivy -target /scan -push
```

---

## Common Commands

```bash
make up        # Start platform
make down      # Stop platform
make logs      # View logs
make restart   # Restart services
make status    # Check health
```

---

## Next Steps

| Goal | Guide |
|------|-------|
| Run first scan | [First Scan Tutorial](./first-scan.md) |
| Understand architecture | [System Overview](../architecture/overview.md) |
| Deploy to production | [Production Guide](../operations/PRODUCTION_DEPLOYMENT.md) |
| Build custom tools | [SDK Development](../guides/sdk-development.md) |

---

## Troubleshooting

### Port 3000 in use

```bash
lsof -ti:3000 | xargs kill -9
```

### Database connection failed

```bash
docker compose restart postgres
```

### API not responding

```bash
curl http://localhost:8080/health
# Expected: {"status":"ok"}
```

---

**Ready? Continue to [First Scan Tutorial →](./first-scan.md)**
