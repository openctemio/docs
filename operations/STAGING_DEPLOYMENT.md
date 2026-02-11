---
layout: default
title: Staging Deployment
parent: Operations
nav_order: 12
---
{% raw %}

# Staging Deployment Guide

**Last Updated:** 2026-01-14

Deploy OpenCTEM Platform to a Staging environment.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Step-by-Step Deployment](#step-by-step-deployment)
- [Configuration](#configuration)
- [Seeding Data](#seeding-data)
- [Management Commands](#management-commands)
- [Troubleshooting](#troubleshooting)
- [Remote Server Deployment](#remote-server-deployment)

---

## Prerequisites

### Local Machine (Development)

```bash
# Required
- Docker >= 24.0
- Docker Compose >= 2.20
- Make (optional, for convenience commands)
- Git

# Check versions
docker --version
docker compose version
```

### Remote Server (Staging)

```bash
# Minimum requirements
- Ubuntu 22.04 LTS (or equivalent)
- 4 CPU cores
- 8GB RAM
- 50GB SSD
- Docker & Docker Compose installed
- Ports: 3000 (UI), 5432 (DB - optional), 6379 (Redis - optional)
```

---

## Quick Start

### 5-Minute Deployment

```bash
# 1. Clone repository
git clone <your-repo-url>
cd.openctemio

# 2. Create environment file
cp .env.staging.example .env.staging

# 3. Generate secure secrets
make generate-secrets
# Copy the generated values to .env.staging

# 4. Start all services with test data
make staging-up-seed

# 5. Access application
open http://localhost:3000

# Login credentials:
# Email: admin@openctem.io
# Password: Password123
```

---

## Step-by-Step Deployment

### Step 1: Clone Repository

```bash
# Clone the project
git clone <your-repo-url>
cd.openctemio

# Verify structure
ls -la
# Should see: docker-compose.staging.yml, Makefile, api/, ui/
```

### Step 2: Configure Environment

```bash
# Copy example environment file
cp .env.staging.example .env.staging

# Generate secure secrets
make generate-secrets
```

Output example:
```
JWT Secret (copy to AUTH_JWT_SECRET):
abc123def456ghi789...

CSRF Secret (copy to CSRF_SECRET):
xyz789abc123...

DB Password (copy to DB_PASSWORD):
secure_password_here...
```

### Step 3: Update .env.staging

Edit `.env.staging` with your values:

```bash
nano .env.staging
# or
vim .env.staging
```

**Critical values to update:**

```env
# Database (REQUIRED)
DB_PASSWORD=<generated_password>

# Authentication (REQUIRED)
AUTH_JWT_SECRET=<generated_jwt_secret>

# Security (REQUIRED)
CSRF_SECRET=<generated_csrf_secret>

# URLs (update for your server)
NEXT_PUBLIC_APP_URL=http://localhost:3000
# For remote server: http://your-server-ip:3000
```

### Step 4: Start Services

```bash
# Option 1: Start without test data
make staging-up

# Option 2: Start with test data (RECOMMENDED for staging)
make staging-up-seed
```

### Step 5: Verify Deployment

```bash
# Check running services
make staging-ps

# View logs
make staging-logs

# Check health
curl http://localhost:3000/api/health
```

### Step 6: Seed VN Security Assets (Optional)

```bash
# Seed comprehensive asset data for VN Security Team
cd api
make docker-seed-vnsecurity
```

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_USER` | Yes |.openctem | Database username |
| `DB_PASSWORD` | Yes | - | Database password |
| `DB_NAME` | Yes |.openctem | Database name |
| `AUTH_JWT_SECRET` | Yes | - | JWT signing secret (min 64 chars) |
| `CSRF_SECRET` | Yes | - | CSRF token secret (min 32 chars) |
| `NEXT_PUBLIC_APP_URL` | Yes | http://localhost:3000 | Public URL |
| `AUTH_PROVIDER` | No | local | Auth mode: local, oidc, hybrid |
| `SECURE_COOKIES` | No | false | Set true for HTTPS |
| `LOG_LEVEL` | No | info | Log level: debug, info, warn, error |

### Port Configuration

| Service | Internal Port | External Port | Configurable |
|---------|---------------|---------------|--------------|
| UI (Next.js) | 3000 | 3000 | `UI_PORT` |
| API (Go) | 8080 | Not exposed | Internal only |
| PostgreSQL | 5432 | 5432 | `DB_EXTERNAL_PORT` |
| Redis | 6379 | 6379 | `REDIS_EXTERNAL_PORT` |

### Architecture

```
                    Internet/Browser
                          │
                          ▼
                 ┌─────────────────┐
                 │   UI (Next.js)  │ :3000 (public)
                 │   BFF Proxy     │
                 └────────┬────────┘
                          │
            Docker Network (internal)
                          │
                          ▼
                 ┌─────────────────┐
                 │   API (Go)      │ :8080 (internal)
                 └────────┬────────┘
                          │
           ┌──────────────┼──────────────┐
           ▼              ▼              ▼
    ┌───────────┐  ┌───────────┐  ┌───────────┐
    │ PostgreSQL│  │   Redis   │  │  Migrate  │
    │   :5432   │  │   :6379   │  │  (one-off)│
    └───────────┘  └───────────┘  └───────────┘
```

---

## Seeding Data

### Available Seed Options

| Seed File | Description | Command |
|-----------|-------------|---------|
| `seed_required.sql` | Required system data | Auto on startup |
| `seed_test.sql` | Test users & sample data | `--profile seed` |
| `seed_vnsecurity_assets.sql` | Full asset inventory | `make docker-seed-vnsecurity` |

### Seed Test Data

```bash
# During startup
make staging-up-seed

# Or manually after startup
make db-seed
```

### Seed VN Security Assets

```bash
cd api
make docker-seed-vnsecurity

# Verify
docker compose exec postgres psql -U.openctem -d.openctem -c \
  "SELECT asset_type, COUNT(*) FROM assets GROUP BY asset_type ORDER BY asset_type;"
```

### Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@openctem.io | Password123 |
| User | nguyen.an@techviet.vn | Password123 |

---

## Management Commands

### Service Management

```bash
# Start
make staging-up          # Without test data
make staging-up-seed     # With test data

# Stop
make staging-down

# Restart
make staging-restart
make staging-restart-api  # API only
make staging-restart-ui   # UI only

# Status
make staging-ps
make status
```

### Logs

```bash
# All logs
make staging-logs

# Specific service
make staging-logs-api
make staging-logs-ui

# Docker compose directly
docker compose -f docker-compose.staging.yml logs -f api
docker compose -f docker-compose.staging.yml logs -f ui --tail=100
```

### Database

```bash
# Open psql shell
make db-shell

# Run migrations
make db-migrate

# Rollback migration
make db-migrate-down

# Seed test data
make db-seed

# Reset database (WARNING: deletes all data)
make db-reset
```

### Build

```bash
# Build all
make staging-build

# Force rebuild
make staging-rebuild

# Build specific service
make build-api
make build-ui
```

### Cleanup

```bash
# Stop and remove containers + volumes
make staging-clean

# Prune unused Docker resources
make staging-prune
```

---

## Troubleshooting

### Common Issues

#### 1. "Error: .env.staging not found"

```bash
# Solution: Create environment file
cp .env.staging.example .env.staging
# Then update secrets
```

#### 2. "Database connection refused"

```bash
# Check PostgreSQL is running
docker compose -f docker-compose.staging.yml ps postgres

# Check logs
docker compose -f docker-compose.staging.yml logs postgres

# Verify credentials in .env.staging match
```

#### 3. "Migration failed"

```bash
# Check migration logs
docker compose -f docker-compose.staging.yml logs migrate

# Reset and try again
make staging-clean
make staging-up-seed
```

#### 4. "UI shows blank page / API errors"

```bash
# Check API health
curl http://localhost:8080/health  # Won't work - API is internal

# Check via UI proxy
curl http://localhost:3000/api/health

# Check API logs
make staging-logs-api
```

#### 5. "Seed failed - duplicate key"

```bash
# This is usually OK - data already exists
# If you need fresh data:
make staging-clean
make staging-up-seed
```

#### 6. "Port already in use"

```bash
# Find what's using the port
lsof -i :3000
lsof -i :5432

# Change port in .env.staging
UI_PORT=3001
DB_EXTERNAL_PORT=5433
```

### Debug Mode

```bash
# Enable debug logging
# Edit .env.staging:
APP_DEBUG=true
LOG_LEVEL=debug

# Restart
make staging-restart
```

### Health Checks

```bash
# Check all services
docker compose -f docker-compose.staging.yml ps

# Expected output:
# postgres   healthy
# redis      healthy
# api        healthy
# ui         healthy

# API Health
docker compose -f docker-compose.staging.yml exec api wget -qO- http://localhost:8080/health

# UI Health
curl http://localhost:3000/api/health
```

---

## Remote Server Deployment

### Step 1: Prepare Server

```bash
# SSH to server
ssh user@your-server-ip

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Logout and login again
exit
ssh user@your-server-ip

# Verify Docker
docker --version
docker compose version
```

### Step 2: Transfer Code

```bash
# Option 1: Git clone
git clone <your-repo-url>
cd.openctemio

# Option 2: rsync from local
rsync -avz --exclude 'node_modules' --exclude '.git' \
  /path/to/openctemio/ user@server:/home/user/openctemio/
```

### Step 3: Configure for Server

```bash
# Create .env.staging
cp .env.staging.example .env.staging
nano .env.staging

# Update these values:
NEXT_PUBLIC_APP_URL=http://your-server-ip:3000
CORS_ALLOWED_ORIGINS=http://your-server-ip:3000

# If using domain with HTTPS:
NEXT_PUBLIC_APP_URL=https://staging.yourdomain.com
CORS_ALLOWED_ORIGINS=https://staging.yourdomain.com
SECURE_COOKIES=true
```

### Step 4: Start on Server

```bash
# Start with test data
make staging-up-seed

# Verify
make status
curl http://localhost:3000/api/health
```

### Step 5: Configure Firewall

```bash
# Ubuntu UFW
sudo ufw allow 3000/tcp    # UI
sudo ufw allow 22/tcp      # SSH
sudo ufw enable
```

### Step 6: (Optional) Setup Nginx Reverse Proxy

```bash
# Install Nginx
sudo apt install nginx

# Create config
sudo nano /etc/nginx/sites-available.openctem

# Add:
server {
    listen 80;
    server_name staging.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available.openctem /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 7: (Optional) Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d staging.yourdomain.com

# Update .env.staging
NEXT_PUBLIC_APP_URL=https://staging.yourdomain.com
SECURE_COOKIES=true

# Restart
make staging-restart
```

---

## CI/CD Integration

### GitHub Actions Deployment (Example)

Create `.github/workflows/deploy-staging.yml`:

```yaml
name: Deploy to Staging

on:
  push:
    branches: [develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to staging server
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          script: |
            cd ~.openctemio
            git pull origin develop
            make staging-rebuild
```

---

## Checklist

### Pre-Deployment

- [ ] Docker & Docker Compose installed
- [ ] `.env.staging` created from example
- [ ] Secrets generated (`make generate-secrets`)
- [ ] `AUTH_JWT_SECRET` updated (min 64 chars)
- [ ] `CSRF_SECRET` updated (min 32 chars)
- [ ] `DB_PASSWORD` updated
- [ ] `NEXT_PUBLIC_APP_URL` set correctly

### Post-Deployment

- [ ] All services healthy (`make staging-ps`)
- [ ] UI accessible at configured URL
- [ ] Can login with test credentials
- [ ] API health check passes
- [ ] Database has seeded data (if using `--profile seed`)

### For Remote Server

- [ ] Firewall configured
- [ ] (Optional) Nginx reverse proxy setup
- [ ] (Optional) SSL certificate installed
- [ ] `SECURE_COOKIES=true` if using HTTPS

---

## Support

- **Issues:** https://github.com/your-org/openctem/issues
- **Documentation:** Check `docs/` folder in each service
- **API Docs:** http://localhost:3000/api/docs (when running)
{% endraw %}
