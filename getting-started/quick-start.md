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
- 🔗 **Integrate** findings from Nuclei, Trivy, Semgrep, Betterleaks, and more

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Docker | 20.10+ |
| Docker Compose | 2.0+ |
| Git | 2.30+ |

---

## Step 1: Get the Compose Files

```bash
git clone https://github.com/openctemio/openctem.git
cd openctem/api/deploy
cp .env.example .env
```

Edit `.env`: set `OPENCTEM_VERSION`, `OPENCTEM_HOSTNAME`, `OPENCTEM_PUBLIC_URL`,
`OPENCTEM_TLS_MODE` and the generated secrets. See
[Exposing OpenCTEM: one HTTPS port](../operations/single-https-port.md#quick-start-docker-compose)
for the minimum settings.

---

## Step 2: Start Services

```bash
docker compose up -d
docker compose ps -a
```

**Services starting:**

| Service | Address | Purpose |
|---------|---------|---------|
| gateway | `https://<OPENCTEM_HOSTNAME>` | The only published port: web UI, API (`/api/v1`), sensors |
| web | internal | Web UI, including the admin console at `/admin` |
| api | internal | Backend REST API |
| migrate | one-shot | Runs the database migrations, then exits 0; the API waits for it |
| postgres, redis | internal | Database, cache and queues |

Wait ~30 seconds for all services to be healthy.

---

## Step 3: Create the First Administrator and Organization

There are **no default credentials** and no default organization. Create the
platform administrator, its break-glass backup and the first organization with
its owner (three different addresses):

```bash
docker compose exec api /app/bootstrap-admin \
  -email=admin@yourcompany.com \
  -backup-email=breakglass@yourcompany.com \
  -org-name="Your Company" \
  -org-owner-email=owner@yourcompany.com
```

The command prints each administrator's temporary password once, and the
owner's one-time set-password link (emailed instead when SMTP is configured).

1. The administrator signs in at `https://<your-host>/login`, sets a new
   password and enrolls an authenticator (TOTP) in the admin console (`/admin`).
   Store the break-glass credentials offline.
2. The owner opens the set-password link (valid 24 hours), chooses a password
   and signs in to the organization.
3. The owner adds users under **Settings → Members**.

Details, Helm values and the self-service alternative:
[First-Time Setup](../guides/getting-started.md#2-first-time-setup).

---

## Step 4: Run Your First Scan

See **[First Scan Tutorial](./first-scan.md)** for detailed instructions.

**Quick version:**

```bash
# Run the sensor with Docker
docker run --rm \
  -v $(pwd):/scan \
  -e API_URL=https://ctem.example.com \
  -e API_KEY=your-api-key \
  ghcr.io/openctemio/sensor:latest \
  -tools semgrep,betterleaks,trivy -target /scan -push
```

{: .note }
`API_URL` is the gateway URL (your `OPENCTEM_PUBLIC_URL`, no `:8080`). With the
internal CA (`OPENCTEM_TLS_MODE=internal`), also mount the root certificate and
set `SSL_CERT_DIR`. See [Connecting sensors](../operations/single-https-port.md#connecting-sensors).

---

## Common Commands

Run from `api/deploy`:

```bash
docker compose up -d       # Start platform
docker compose down        # Stop platform (keeps the data volumes)
docker compose logs -f api # View logs
docker compose restart     # Restart services
docker compose ps -a       # Check status
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
