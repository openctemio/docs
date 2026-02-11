---
layout: default
title: OpenCTEM CTEM Platform
nav_exclude: true
search_exclude: true
---

# OpenCTEM CTEM Platform

**Continuous Threat Exposure Management Platform**

Unified Attack Surface Management & Vulnerability Management

[![Go Version](https://img.shields.io/badge/Go-1.25+-00ADD8?logo=go)](https://github.com/openctemio/api)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://github.com/openctemio/ui)
[![Docker](https://img.shields.io/badge/Docker-Hub-2496ED?logo=docker)](https://hub.docker.com/u.openctemio)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Website](https://openctem.io) | [Platform](https://app.openctem.io) | [API Docs](https://api.openctem.io/docs) | [Getting Started](./getting-started/)

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
| **Asset Management** | 6 asset types (Domains, Websites, Services, Repositories, Cloud, Credentials) |
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
│   │  │  Semgrep  │  │   Trivy   │  │ Gitleaks  │  │   Custom Tools    │ │  │
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
| [CTIS Schema](https://github.com/openctemio/schemas) | CTEM Ingest Schema |

### Operations
| Document | Description |
|----------|-------------|
| [Troubleshooting](./operations/troubleshooting) | Common issues |
| [Docker Deployment](./guides/docker-deployment) | Container deployment |

---

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/openctemio.openctem.git
cd.openctem

# Configure
cd api && cp .env.example .env && cd ..
cd ui && cp .env.example .env.local && cd ..

# Start with Docker
docker compose up -d
```

| Service | Local | Production |
|---------|-------|------------|
| Frontend | http://localhost:3000 | https://app.openctem.io |
| Backend API | http://localhost:8080 | https://api.openctem.io |
| API Docs | http://localhost:8080/docs | https://api.openctem.io/docs |

---

## 🛠 Tech Stack

| Component | Technologies |
|-----------|-------------|
| **Backend** | Go 1.25, Chi Router, PostgreSQL 17, Redis 7 |
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind 4 |
| **Auth** | JWT (local) / Keycloak (OIDC) |
| **SDK** | Go SDK with Scanner/Parser/Collector interfaces |

---

## 📦 Repositories

| Repository | Description |
|------------|-------------|
| [api](https://github.com/openctemio/api) | Backend REST API (Go) |
| [ui](https://github.com/openctemio/ui) | Frontend Application (Next.js) |
| [sdk](https://github.com/openctemio/sdk-go) | Go SDK for building tools |
| [agent](https://github.com/openctemio/agent) | Security scanning agent |
| [setup](https://github.com/openctemio/setup) | Deployment & Docker Compose |
| [schemas](https://github.com/openctemio/schemas) | CTIS JSON Schemas |
| [keycloak](https://github.com/openctemio/keycloak) | Keycloak Configuration |
| [docs](https://github.com/openctemio/docs) | Documentation (this repo) |

---

## 🤝 Contributing

We welcome contributions! Please see:

- [Contributing Guide](https://github.com/openctemio/api/blob/main/CONTRIBUTING.md)
- [Code of Conduct](https://github.com/openctemio/api/blob/main/CODE_OF_CONDUCT.md)
- [Security Policy](https://github.com/openctemio/api/blob/main/SECURITY.md)

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

MIT License - see [LICENSE](https://github.com/openctemio/api/blob/main/LICENSE)
