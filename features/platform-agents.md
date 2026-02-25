---
layout: default
title: Platform Agents
parent: Features
nav_order: 5
---

# Platform Agents

OpenCTEM-managed agents running on shared infrastructure, available to tenants who cannot deploy their own agents.

---

## Overview

Platform Agents are **shared scan agents** managed by the OpenCTEM platform operator. They provide scanning capability to tenants without requiring them to deploy and maintain their own agent infrastructure.

### Key Characteristics

| Feature | Description |
|---------|-------------|
| **Shared Infrastructure** | Agents run on OpenCTEM infrastructure, shared across tenants |
| **Tenant Isolation** | Jobs are isolated per tenant; agents never mix tenant data |
| **Fair Queuing** | Weighted Fair Queuing with age bonus ensures fair resource allocation |
| **Auto-Recovery** | Stuck jobs are automatically recovered and re-queued |
| **Lease-Based Health** | K8s-inspired lease system for agent health monitoring |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Tenant Dashboard                     │
│  Submit Job → Queue → Platform Agent → Results        │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              Platform Agent Pool                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Agent 1  │  │ Agent 2  │  │ Agent N  │          │
│  │ (lease)  │  │ (lease)  │  │ (lease)  │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│         ↕              ↕              ↕              │
│  ┌──────────────────────────────────────────────┐   │
│  │         Job Queue (PostgreSQL)                │   │
│  │  FOR UPDATE SKIP LOCKED + WFQ Priority       │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## Agent Lifecycle

1. **Registration** — Agent registers using a bootstrap token
2. **Lease Acquisition** — Agent acquires a lease (heartbeat)
3. **Job Polling** — Agent long-polls for jobs matching its capabilities
4. **Job Execution** — Agent runs the scan and reports results
5. **Lease Renewal** — Periodic heartbeat keeps the lease active
6. **Graceful Shutdown** — Agent releases its lease

---

## API Endpoints

### Agent Registration (Public, Rate Limited)

```
POST /api/v1/platform/register         — Self-registration with bootstrap token
```

### Agent Communication (API Key Auth)

```
PUT    /api/v1/platform/lease              — Renew lease (heartbeat)
DELETE /api/v1/platform/lease              — Release lease (graceful shutdown)
POST   /api/v1/platform/poll               — Long-poll for jobs
POST   /api/v1/platform/jobs/{id}/ack      — Acknowledge job receipt
POST   /api/v1/platform/jobs/{id}/result   — Report job result
POST   /api/v1/platform/jobs/{id}/progress — Report job progress
```

### Tenant Job Submission (JWT Auth)

```
POST /api/v1/platform-jobs/            — Submit job
GET  /api/v1/platform-jobs/            — List jobs
GET  /api/v1/platform-jobs/{id}        — Get job status
POST /api/v1/platform-jobs/{id}/cancel — Cancel job
```

---

## Implementation Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0: Database Schema | Complete | migrations 000043 |
| Phase 1: Domain Layer | Complete | agent, lease, admin domains |
| Phase 2: Infrastructure Layer | Complete | All repositories |
| Phase 3: Application Services | Complete | LeaseService, PlatformAgentService |
| Phase 4: HTTP Handlers | Complete | All endpoints wired |
| Phase 5: Routes & Main.go | Complete | Routes registered, DI wired |
| Phase 6: Background Controllers | Complete | Health, recovery, cleanup workers |
| Phase 7: Admin CLI | Pending | `openctem-admin` CLI tool |
| Phase 8: Testing & Documentation | Pending | |

---

## Related Documentation

- [Platform Admin Guide](../guides/platform-admin.md) — Bootstrap and manage platform agents
- [Platform Agent Runbook](../operations/platform-agent-runbook.md) — Operations guide
- [Admin UI User Guide](../admin-ui/user-guide.md) — Web-based administration
- [Agent Key Management](../architecture/agent-key-management.md) — API keys and registration tokens
