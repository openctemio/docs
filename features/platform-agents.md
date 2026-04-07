---
layout: default
title: Platform Agents
parent: Features
nav_order: 5
---
{% raw %}

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
| **Modular Executors** | Enable/disable scan capabilities per agent deployment |

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

## Modular Executor Architecture

Each agent is a single binary with pluggable executors that can be enabled/disabled via configuration.

```
┌──────────────────────────────────────────────────────────┐
│                    Platform Agent                          │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                  Core (Always On)                    │ │
│  │  LeaseManager │ JobPoller │ MetricsCollector        │ │
│  │  CTISReportBuilder │ ExecutorRouter                 │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │   Recon       │ │  VulnScan    │ │  SecretScan  │    │
│  │ --enable-recon│ │--enable-vuln │ │--enable-sec  │    │
│  │              │ │              │ │              │    │
│  │ Subfinder    │ │ Nuclei       │ │ Gitleaks     │    │
│  │ DNSX        │ │ Trivy        │ │ TruffleHog   │    │
│  │ Naabu       │ │ Semgrep      │ │              │    │
│  │ HTTPX       │ │              │ │              │    │
│  │ Katana      │ │              │ │              │    │
│  └──────────────┘ └──────────────┘ └──────────────┘    │
└──────────────────────────────────────────────────────────┘
```

### Executor Interfaces

```go
// Base executor interface
type Executor interface {
    Execute(ctx context.Context, job *Job) (*Result, error)
    Capabilities() []string
    InstalledTools() []string
}

// Produces CTIS reports from scan results
type CTISProducer interface {
    Executor
    ProduceCTIS(ctx context.Context, result *Result) (*ctis.Report, error)
}

// Produces asset-focused CTIS reports (recon tools)
type AssetProducer interface {
    CTISProducer
    ProduceAssets(ctx context.Context, result *Result) ([]ctis.Asset, error)
}
```

### ExecutorRouter

Routes jobs to the correct executor based on job type:

| Job Type | Executor | Description |
|----------|----------|-------------|
| `recon` | ReconExecutor | Subdomain, DNS, port scanning |
| `scan` | VulnScanExecutor | Vulnerability scanning |
| `pipeline` | PipelineExecutor | Multi-step pipeline execution |

### Agent Configuration

```yaml
agent:
  name: "scanner-us-east-001"
  region: "us-east-1"
  max_jobs: 5
  lease_duration: 60s
  renew_interval: 20s

api:
  base_url: "https://api.your-domain.com"

executors:
  recon:
    enabled: true
    tools: [subfinder, dnsx, naabu, httpx, katana]
    capabilities: [subdomain, dns, portscan, http, crawler]
  vulnscan:
    enabled: true
    tools: [nuclei, trivy, semgrep]
    capabilities: [dast, sca, iac, container]
  secrets:
    enabled: false
  assets:
    enabled: false
```

---

## CTIS Asset Mapping

Recon tools produce results that are converted to CTIS (CTEM Ingest Schema) format and pushed to the API.

```
Recon Tool Output → CTIS Asset Converter → POST /api/v1/agent/ingest/ctis
```

### Tool to CTIS Type Mapping

| Tool | CTIS Asset Type | Key Fields |
|------|----------------|------------|
| **Subfinder** | `domain` | DNSRecords (subdomains as A records) |
| **DNSX** | `domain` | DNSRecords (A, AAAA, MX, NS, TXT, CNAME) |
| **Naabu** | `ip_address` | Ports (Port, Protocol, State, Service) |
| **HTTPX** | `service` | Name, Version, Port, TLS, Banner, Technologies |
| **Katana** | properties | URLs, endpoints, forms |
| **Nuclei** | finding | CVE, CVSS, affected component |

### Storage Strategy

CTIS technical details are stored in the `assets.properties` JSONB column. No new database tables needed.

```sql
-- Find assets with open port 443
SELECT * FROM assets
WHERE properties->'ip_address'->'ports' @> '[{"port": 443, "state": "open"}]';

-- Find domains with specific DNS record
SELECT * FROM assets
WHERE properties->'domain'->'dns_records' @> '[{"type": "A", "value": "1.2.3.4"}]';
```

---

## Deployment Configurations

### Recon-Only Agent (Kubernetes)

```yaml
replicas: 3
resources:
  requests: { cpu: 500m, memory: 512Mi }
  limits: { cpu: 2000m, memory: 2Gi }
securityContext:
  capabilities:
    add: [NET_RAW]  # Required for naabu port scanning
args: ["--enable-recon", "--disable-vulnscan", "--disable-secrets"]
```

### VulnScan Agent (Kubernetes)

```yaml
replicas: 5
resources:
  requests: { cpu: 1000m, memory: 2Gi }
  limits: { cpu: 4000m, memory: 8Gi }  # Nuclei/Trivy need more memory
args: ["--disable-recon", "--enable-vulnscan"]
```

### Full-Featured Agent (Development)

```yaml
replicas: 2
resources:
  limits: { cpu: 4000m, memory: 8Gi }
securityContext:
  capabilities:
    add: [NET_RAW]
args: ["--enable-recon", "--enable-vulnscan", "--enable-secrets", "--enable-assets"]
```

---

## API Endpoints

### Agent Registration (Public, Rate Limited)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/platform/register` | Self-registration with bootstrap token |

### Agent Communication (API Key Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `PUT` | `/api/v1/platform/lease` | Renew lease (heartbeat) |
| `DELETE` | `/api/v1/platform/lease` | Release lease (graceful shutdown) |
| `POST` | `/api/v1/platform/poll` | Long-poll for jobs |
| `POST` | `/api/v1/platform/jobs/{id}/ack` | Acknowledge job receipt |
| `POST` | `/api/v1/platform/jobs/{id}/result` | Report job result |
| `POST` | `/api/v1/platform/jobs/{id}/progress` | Report job progress |

### Tenant Job Submission (JWT Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/platform-jobs/` | Submit job |
| `GET` | `/api/v1/platform-jobs/` | List jobs |
| `GET` | `/api/v1/platform-jobs/{id}` | Get job status |
| `POST` | `/api/v1/platform-jobs/{id}/cancel` | Cancel job |

---

## Key Files

| File | Description |
|------|-------------|
| `agent/internal/executor/interface.go` | Executor interfaces |
| `agent/internal/executor/router.go` | ExecutorRouter (job routing) |
| `agent/internal/executor/recon.go` | ReconExecutor with 5 tool wrappers |
| `agent/internal/config/config.go` | Modular executor configuration |
| `sdk/pkg/ctis/recon_converter.go` | Recon to CTIS conversion |
| `api/internal/app/ctis_ingest_service.go` | Batch asset/finding ingestion |

---

## Implementation Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0: Database Schema | Complete | Migration 000043 |
| Phase 1: Domain Layer | Complete | Agent, lease, admin domains |
| Phase 2: Infrastructure Layer | Complete | All repositories |
| Phase 3: Application Services | Complete | LeaseService, PlatformAgentService |
| Phase 4: HTTP Handlers | Complete | All endpoints wired |
| Phase 5: Routes & DI | Complete | Routes registered, DI wired |
| Phase 6: Background Controllers | Complete | Health, recovery, cleanup workers |
| Phase 7: Executor System | Complete | Modular executors, CTIS converters |
| Phase 8: CTIS Asset Ingestion | Complete | Asset upsert, JSONB indexes |

---

## Related Documentation

- [Platform Admin Guide](../guides/platform-admin.md) - Bootstrap and manage platform agents
- [Agent Key Management](../architecture/agent-key-management.md) - API keys and registration tokens
- [Agent Resource Management](../architecture/agent-resource-management.md) - Auto-cleanup, throttling
- [SDK & API Integration](../architecture/sdk-api-integration.md) - Agent to API communication
- [CTIS Domain Mapping](../architecture/ctis-domain-mapping.md) - How CTIS fields map to domain entities

{% endraw %}
