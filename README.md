---
layout: default
title: OpenCTEM CTEM Platform
nav_exclude: true
search_exclude: true
---

# OpenCTEM CTEM Platform

**Continuous Threat Exposure Management Platform**

Unified Attack Surface Management & Vulnerability Management

[![Go Version](https://img.shields.io/badge/Go-1.26+-00ADD8?logo=go)](https://github.com/openctemio/openctem/tree/main/api)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://github.com/openctemio/openctem/tree/main/web)
[![Images](https://img.shields.io/badge/Images-GHCR-2496ED?logo=docker)](https://github.com/orgs/openctemio/packages)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](https://github.com/openctemio/openctem/blob/main/LICENSE)

[Website](https://openctem.io) | [GitHub](https://github.com/openctemio) | [Getting Started](./guides/getting-started.md)

## Documentation

| Guide | Audience | Description |
|-------|----------|-------------|
| [User Guide](USER_GUIDE.md) | Security teams, analysts | How to use the platform day-to-day |
| [Admin Guide](ADMIN_GUIDE.md) | DevOps, SRE, admins | Deployment, configuration, operations |
| [Developer Guide](DEVELOPER_GUIDE.md) | Contributors, integrators | Architecture, API, SDK, contributing |

---

## What is OpenCTEM?

OpenCTEM is an enterprise-grade **Continuous Threat Exposure Management (CTEM)** platform that helps security teams continuously monitor, assess, and remediate security risks across their digital infrastructure.

### The CTEM 5-Stage Process

```
┌─────────────┐    ┌─────────────┐    ┌──────────────────┐    ┌─────────────┐    ┌──────────────┐
│   SCOPING   │───▶│  DISCOVERY  │───▶│  PRIORITIZATION  │───▶│  VALIDATION │───▶│ MOBILIZATION │
│             │    │             │    │                  │    │             │    │              │
│ Define your │    │ Find assets │    │ Rank by risk &   │    │ Verify with │    │ Remediate &  │
│ attack      │    │ & exposures │    │ business impact  │    │ scanning    │    │ track tasks  │
│ surface     │    │             │    │                  │    │             │    │              │
└─────────────┘    └─────────────┘    └──────────────────┘    └─────────────┘    └──────────────┘
```

---

## Key Features

| Category | Features |
|----------|----------|
| **Asset Management** | 35+ asset types (Domains, IPs, Certificates, Cloud, Containers, K8s, IAM, Repositories, and more) |
| **Vulnerability Management** | Findings, CVE tracking, CVSS scoring, SLA policies |
| **Scan Management** | Agents, Scan Profiles, Pipelines, Tool Categories |
| **Multi-tenancy** | Teams, Role-based access (Owner/Admin/Member/Viewer) |
| **Integrations** | SDK for custom tools, Agent for CI/CD, SCM connections |
| **Security** | JWT/OIDC auth, CSRF protection, audit logging |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              OpenCTEM Platform                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│   │   Web UI    │    │   REST API  │    │  Database   │    │    Cache    │ │
│   │  (Next.js)  │───▶│    (Go)     │───▶│ (PostgreSQL)│    │   (Redis)   │ │
│   │  Port 3000  │    │  Port 8080  │    │             │    │             │ │
│   └─────────────┘    └──────┬──────┘    └─────────────┘    └─────────────┘ │
│                             │                                               │
│                             ▼                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                        Agent / SDK Integration                       │  │
│   │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────────┐ │  │
│   │  │  Semgrep  │  │   Trivy   │  │ Betterleaks  │  │   Custom Tools    │ │  │
│   │  │   (SAST)  │  │   (SCA)   │  │ (Secrets) │  │   (SDK-built)     │ │  │
│   │  └───────────┘  └───────────┘  └───────────┘  └───────────────────┘ │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📚 Documentation

### Getting Started
| Guide | Description |
|-------|-------------|
| [Quick Start](./getting-started/quick-start) | Get up and running in 10 minutes |
| [First Scan](./getting-started/first-scan) | Run your first security scan |
| [Configuration](./operations/configuration) | Environment variables |

### Guides
| Guide | Description |
|-------|-------------|
| [Authentication](./guides/authentication) | Login flow, JWT, sessions |
| [Multi-tenancy](./guides/multi-tenancy) | Teams, tenant switching |
| [Permissions](./guides/permissions) | Role-based access control |
| [Notification Integrations](./guides/notification-integrations) | Slack, Teams, Telegram, Email alerts |
| [Running Agents](./guides/running-agents) | Setup and run scanning agents |
| [SDK Development](./guides/sdk-development) | Build custom scanners |
| [Building Ingestion Tools](./guides/building-ingestion-tools) | Custom data collectors |

### Architecture
| Document | Description |
|----------|-------------|
| [Overview](./architecture/overview) | System design |
| [Deployment Modes](./architecture/deployment-modes) | Standalone, distributed |
| [Server-Agent Communication](./architecture/server-agent-command) | Command & control |
| [Agent Key Management](./architecture/agent-key-management) | API keys, registration tokens |
| [Scan Pipeline Design](./architecture/scan-pipeline-design) | Workflow execution |
| [Notification System](./architecture/notification-system) | Real-time alerts, async patterns |

### Security
| Document | Description |
|----------|-------------|
| [Security Guide](./guides/SECURITY) | Security features and best practices |
| [Agent Configuration](./guides/agent-configuration) | Secure agent configuration |

### Reference
| Document | Description |
|----------|-------------|
| [API Reference](./backend/api-reference) | Complete API endpoints |
| [CTIS Schema](https://github.com/openctemio/ctis) | CTEM Ingest Schema |

### Operations
| Document | Description |
|----------|-------------|
| [Troubleshooting](./operations/troubleshooting) | Common issues |
| [Docker Deployment](./guides/docker-deployment) | Container deployment |

---

## 🚀 Quick Start

Run the released images with Docker Compose. The stack publishes one HTTPS
port (a gateway in front of the web console and the API):

```bash
git clone https://github.com/openctemio/openctem.git
cd openctem/api/deploy
cp .env.example .env   # set OPENCTEM_VERSION, OPENCTEM_HOSTNAME, OPENCTEM_TLS_MODE, secrets
docker compose up -d
```

Then create the first administrator and organization: see the
[Quick Start](./getting-started/quick-start). For Kubernetes, use the
[Helm chart](https://github.com/openctemio/helm-charts).

| Service | Address |
|---------|---------|
| Web console | `https://<OPENCTEM_HOSTNAME>` |
| API | `https://<OPENCTEM_HOSTNAME>/api/v1` |
| API docs | `https://<OPENCTEM_HOSTNAME>/docs` |

To develop on the platform, clone the same repository and run `make setup`,
then `make dev-api` and `make dev-web`; see the
[Development Guide](./operations/DEVELOPMENT).

---

## 🛠 Tech Stack

| Component | Technologies |
|-----------|-------------|
| **Backend** | Go 1.26, Chi Router, PostgreSQL 17, Redis 7 |
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind 4 |
| **Auth** | Local JWT + OAuth social (Google/GitHub/Microsoft) + enterprise SSO (SAML / per-tenant OIDC / Entra ID) |
| **SDK** | Go SDK with Scanner/Parser/Collector interfaces |

---

## 📦 Repositories

| Repository | Description |
|------------|-------------|
| [openctem](https://github.com/openctemio/openctem) | The platform: `api/` (Go API) and `web/` (Next.js web console), released together, plus the Docker Compose stack (`api/deploy/`) |
| [sensor](https://github.com/openctemio/sensor) | Security scanning sensor (formerly "agent") |
| [sdk-go](https://github.com/openctemio/sdk-go) | Go SDK for building tools |
| [ctis](https://github.com/openctemio/ctis) | CTIS JSON Schemas (the ingest contract) |
| [helm-charts](https://github.com/openctemio/helm-charts) | Kubernetes Helm chart |
| [docs](https://github.com/openctemio/docs) | Documentation (this repo) |

`openctemio/openctem` was named `openctemio/api` until the API and the web
console were merged into one repository; old links redirect. The former
`openctemio/ui` repository is archived.

### Images

One `vX.Y.Z` tag releases every image from the same commit, all on GHCR:

| Image | Contents |
|-------|----------|
| `ghcr.io/openctemio/openctem-api` | API server |
| `ghcr.io/openctemio/openctem-web` | Web console |
| `ghcr.io/openctemio/openctem` | All-in-one: API + web + gateway |
| `ghcr.io/openctemio/migrations`, `seed`, `admin-cli` | Database migrations, demo data, admin CLI |
| `ghcr.io/openctemio/sensor` | Scanning sensor (released from the sensor repository) |

The `openctem-api`, `openctem-web` and `openctem` names start with v0.9.0.
v0.8.0 and earlier are published as `ghcr.io/openctemio/api` and
`ghcr.io/openctemio/ui`, and those names keep receiving identical copies for
two more releases.

---

## 🤝 Contributing

We welcome contributions! Please see:

- [Contributing Guide](https://github.com/openctemio/openctem/blob/main/CONTRIBUTING.md)
- [Security Policy](https://github.com/openctemio/openctem/blob/main/SECURITY.md)

---

## 💖 Support

If you find OpenCTEM useful, consider supporting the project:

**BSC Network (BEP-20):**

```
0x97f0891b4a682904a78e6Bc854a58819Ea972454
```

---

## 📧 Contact

- **Website:** https://openctem.io
- **Email:** openctemio@gmail.com
- **GitHub:** https://github.com/openctemio

---

## 📄 License

GPL-3.0 License - see [LICENSE](https://github.com/openctemio/openctem/blob/main/LICENSE)
