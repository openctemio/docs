# RFC: Documentation — Open-Source Release Readiness

**Created:** 2026-03-16
**Status:** PLANNED
**Priority:** P0
**Timeline:** 4 weeks
**Scope:** API docs, user guide, deployment guide, contributor guide

---

## Summary

OpenCTEM MVP 1 is feature-complete. Before open-source release, documentation must be production-quality: clear onboarding for users, comprehensive API reference, deployment guides for multiple environments, and contributor documentation for community growth.

---

## Current Documentation State

### What Exists

| Area | Files | Quality |
|------|-------|---------|
| Architecture docs | 10+ files in `/docs/architecture/` | Good — covers core systems |
| Feature docs | 33 files in `/docs/features/` | Good — covers implemented features |
| ADRs | 10+ files in `/docs/decisions/` | Good — documents key decisions |
| GETTING_STARTED.md | 128 lines | Basic — needs expansion |
| ROADMAP.md | 814 lines | Comprehensive but outdated |
| README.md (root) | 213 lines | Basic project overview |
| API CLAUDE.md | Extensive | Dev-focused, not user-facing |
| UI CLAUDE.md | Extensive | Dev-focused, not user-facing |
| Helm chart docs | 1 feature doc | Basic K8s deployment |
| CONTRIBUTING.md | Exists in 4 repos | Basic contribution guidelines |

### What's Missing

| Area | Status | Priority |
|------|--------|----------|
| **API Reference (OpenAPI)** | Scalar UI exists at `/docs`, but no hosted static docs | P0 |
| **User Guide** | None — no end-user documentation | P0 |
| **Deployment Guide** | Scattered across files, no unified guide | P0 |
| **CHANGELOG** | Not maintained | P0 |
| **CODE_OF_CONDUCT** | Missing | P0 |
| **SECURITY.md** | Missing (vulnerability disclosure process) | P0 |
| **Configuration Reference** | Env vars documented in .env.example only | P1 |
| **SDK Documentation** | README exists, no tutorial/guide | P1 |
| **Agent Guide** | README exists, no comprehensive guide | P1 |
| **Troubleshooting Guide** | Partial in operations/ | P1 |
| **FAQ** | None | P2 |
| **Video/Screenshots** | None | P2 |

---

## Phase 1: Essential Open-Source Files (Week 1)

### 1.1 Root README.md Rewrite

**Target:** First impression for GitHub visitors. Must answer: What is it? Why use it? How to start?

**Structure:**
```markdown
# OpenCTEM — Open-Source Continuous Threat Exposure Management

[Badges: License, CI, Release, Docker, Go, TypeScript]

[1-2 sentence description]
[Screenshot of dashboard]

## Why OpenCTEM?
- 5-stage CTEM: Scoping → Discovery → Prioritization → Validation → Mobilization
- 30+ scanner integrations (Nuclei, Trivy, Semgrep, Gitleaks, ...)
- AI-powered triage with LLM integration
- Multi-tenant with fine-grained RBAC (126 permissions)
- Real-time notifications (Slack, Teams, Telegram, Email)
- ITSM integration (Jira, Linear, Asana)

## Quick Start
[Docker Compose one-liner]

## Documentation
[Links to docs site]

## Community
[Discord/Discussions/Issues links]

## License
MIT
```

### 1.2 CHANGELOG.md

**Action:** Create from git history, following [Keep a Changelog](https://keepachangelog.com/) format.

```markdown
# Changelog

## [1.0.0] - 2026-03-XX

### Added
- Complete CTEM pipeline (Scoping, Discovery, Prioritization, Validation, Mobilization)
- Asset management with 16 asset types and relationship mapping
- Scan orchestration with 30+ tool integrations
- Finding management with AI-powered triage
- Multi-channel notifications (Slack, Teams, Telegram, Email)
- ITSM integration (Jira, Linear, Asana)
- Workflow automation engine
- Multi-tenant architecture with RBAC (126 permissions)
- Real-time WebSocket updates
- Go SDK for custom scanner integration
- Docker and Kubernetes deployment support
```

### 1.3 SECURITY.md

**Structure:**
```markdown
# Security Policy

## Supported Versions
## Reporting a Vulnerability
## Responsible Disclosure
## Security Features
- AES-256-GCM credential encryption
- Multi-tenant isolation
- RBAC with 126 permissions
- Audit logging with trigger protection
- Rate limiting on public endpoints
```

### 1.4 CODE_OF_CONDUCT.md

**Action:** Adopt Contributor Covenant v2.1 (industry standard for OSS).

---

## Phase 2: Deployment Guide (Week 2)

### 2.1 Unified Deployment Guide

**Location:** `/docs/getting-started/deployment.md`

**Sections:**

#### Quick Start (Docker Compose)
```bash
git clone https://github.com/openctemio/openctem.git
cd openctem
cp .env.example .env
docker compose up -d
# Open http://localhost:3000
```

#### Production Deployment (Docker Compose)
- `.env` configuration reference
- TLS/HTTPS setup with reverse proxy (nginx/caddy)
- PostgreSQL tuning for production
- Redis configuration
- Backup and restore procedures
- Monitoring with Prometheus + Grafana

#### Kubernetes (Helm)
- Prerequisites (K8s 1.28+, Helm 3.12+)
- Installation steps
- Values.yaml reference
- Ingress configuration
- Scaling and HPA
- Persistent volumes

#### Cloud-Specific
- AWS (ECS/EKS)
- GCP (Cloud Run/GKE)
- Azure (Container Apps/AKS)

### 2.2 Configuration Reference

**Location:** `/docs/getting-started/configuration.md`

**Document every environment variable:**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis connection string |
| `JWT_SECRET` | Yes | — | JWT signing secret |
| `APP_ENCRYPTION_KEY` | Prod only | — | AES-256-GCM key for credentials |
| `OIDC_ISSUER_URL` | No | — | OIDC provider URL |
| `AI_TRIAGE_PROVIDER` | No | — | LLM provider (openai, anthropic) |
| `AI_TRIAGE_API_KEY` | No | — | LLM API key |
| `SMTP_*` | No | — | Email configuration |
| ... | ... | ... | ... |

---

## Phase 3: User Guide (Week 3)

### 3.1 Getting Started Guide

**Location:** `/docs/guides/getting-started.md`

**Flow:** Follows CTEM 5 stages as tutorial.

1. **First Login & Team Setup**
   - Create account, create team
   - Invite members, assign roles

2. **Scoping — Define Your Attack Surface**
   - Add assets (manual, import, API)
   - Create asset groups
   - Configure scope rules (tag-based, group-based)
   - Identify crown jewels

3. **Discovery — Set Up Scanning**
   - Deploy an agent (Docker)
   - Configure scan profiles
   - Create and trigger a scan
   - Review scan results

4. **Prioritization — Triage Findings**
   - Review findings dashboard
   - Use AI triage for severity assessment
   - Configure SLA policies
   - Set up assignment rules

5. **Validation — Verify Remediation**
   - Create workflow for finding lifecycle
   - Configure approval process
   - Track remediation progress

6. **Mobilization — Integrate & Notify**
   - Connect Slack/Teams for alerts
   - Set up Jira integration for tickets
   - Configure notification routing by severity

### 3.2 Feature Guides

**One page per major feature:**

| Guide | Location | Content |
|-------|----------|---------|
| Asset Management | `/docs/guides/assets.md` | Types, relationships, tags, groups, state history |
| Scanning | `/docs/guides/scanning.md` | Profiles, pipelines, agents, smart filtering |
| Findings | `/docs/guides/findings.md` | Lifecycle, severity, SLA, approvals, AI triage |
| Access Control | `/docs/guides/access-control.md` | Roles, permissions, groups, scope rules |
| Integrations | `/docs/guides/integrations.md` | Slack, Teams, Jira, GitHub, webhooks |
| Notifications | `/docs/guides/notifications.md` | Channels, routing, templates, outbox |
| Workflows | `/docs/guides/workflows.md` | Builder, triggers, actions, execution |
| API Keys | `/docs/guides/api-keys.md` | Create, rotate, permissions |

### 3.3 API Reference

**Option A: Auto-generated from OpenAPI spec**
- Export `openapi.yaml` from running API
- Host via Scalar, Redoc, or Swagger UI
- Publish to docs site

**Option B: Static API docs**
- Document each endpoint group
- Include request/response examples
- Authentication requirements
- Error codes reference

**Recommended:** Option A (auto-generated) — less maintenance, always up-to-date.

**Action:**
- Ensure `/openapi.yaml` endpoint is complete and accurate
- Set up Scalar or Redoc static site generation in CI
- Publish to `docs.openctem.io/api`

---

## Phase 4: Contributor & Developer Documentation (Week 4)

### 4.1 CONTRIBUTING.md Enhancement

**Structure:**
```markdown
# Contributing to OpenCTEM

## Development Setup
- Prerequisites (Go 1.25+, Node 20+, Docker)
- Clone and setup
- Running locally
- Running tests

## Architecture Overview
- [Link to architecture docs]
- Backend structure (DDD + repository pattern)
- Frontend structure (Next.js 16 + feature-based)

## Code Standards
- Go: golangci-lint rules
- TypeScript: ESLint + Prettier
- Commit messages: Conventional Commits
- PR process: Draft → Review → Approval → Merge

## Testing
- Unit tests: `go test ./tests/unit/...`
- Integration tests: `go test ./tests/integration/...`
- Frontend tests: `npm test`
- E2E tests: `npm run e2e`

## Adding a New Feature
1. Create RFC in `docs/_internal/rfcs/`
2. Discuss in GitHub issue
3. Implement with tests
4. Submit PR

## Adding a New Scanner Integration
1. Create tool definition
2. Implement SDK adapter
3. Add scanner template
4. Test with agent

## Reporting Issues
## Code of Conduct
```

### 4.2 SDK Documentation

**Location:** `/docs/guides/sdk-development.md`

**Content:**
- SDK architecture overview
- Creating a custom scanner
- Creating a custom adapter
- Publishing findings via CTIS format
- Error handling and retries
- Examples walkthrough

### 4.3 Agent Documentation

**Location:** `/docs/guides/agent-deployment.md`

**Content:**
- Agent architecture
- Docker deployment
- Kubernetes DaemonSet deployment
- Supported scanners
- Custom scanner integration
- Heartbeat and health monitoring
- Troubleshooting

---

## Phase 5: Docs Site Setup (Ongoing)

### 5.1 Documentation Site

**Current:** Jekyll + just-the-docs theme (GitHub Pages)

**Enhancements:**
- Search functionality
- Versioning (v1.0, v1.1, etc.)
- API reference section (auto-generated)
- Dark mode support
- Edit on GitHub links
- Last updated timestamps

### 5.2 Screenshots & Visuals

**Create screenshots for:**
- Dashboard overview
- Asset inventory
- Finding detail view
- Scan configuration
- Workflow builder
- Integration setup
- Group management with scope rules
- Notification center

**Tool:** Use Playwright to auto-capture screenshots (stays updated).

---

## Deliverables Checklist

### Week 1: Essential Files
- [ ] README.md rewrite with badges and screenshots
- [ ] CHANGELOG.md from git history
- [ ] SECURITY.md with disclosure process
- [ ] CODE_OF_CONDUCT.md (Contributor Covenant)
- [ ] Update ROADMAP.md to reflect actual status

### Week 2: Deployment
- [ ] Unified deployment guide (Docker + K8s + Cloud)
- [ ] Configuration reference (all env vars)
- [ ] Backup and restore guide
- [ ] Monitoring setup guide

### Week 3: User Guide
- [ ] Getting started tutorial (CTEM 5-stage walkthrough)
- [ ] 8 feature-specific guides
- [ ] API reference (auto-generated from OpenAPI)
- [ ] Error codes reference

### Week 4: Developer Docs
- [ ] Enhanced CONTRIBUTING.md
- [ ] SDK development guide
- [ ] Agent deployment guide
- [ ] Architecture deep-dive updates
- [ ] Screenshots for all major features

---

## Success Criteria

| Criteria | Target |
|----------|--------|
| New user can deploy in < 15 minutes | Docker Compose guide verified |
| New user can complete CTEM tutorial in < 1 hour | Walkthrough tested |
| API reference covers 100% of endpoints | Auto-generated from OpenAPI |
| All env vars documented | Configuration reference complete |
| Community files present | README, CHANGELOG, SECURITY, CODE_OF_CONDUCT, CONTRIBUTING |
| Docs site searchable and navigable | Jekyll site with search |
