---
layout: default
title: Platform Agents
parent: Features
nav_order: 1
---

# Platform Agents

> **Status**: ✅ Implemented
> **Version**: v3.2
> **Released**: 2026-01-24

## Overview

Platform Agents are Rediver-managed, shared scanning agents that can be used by any tenant. This provides a scalable, shared scanning infrastructure for tenants who don't want to manage their own agents.

## Problem Statement

Previously, each tenant needed to deploy and manage their own agents. This created challenges:
1. **Operational overhead** for tenants to maintain agent infrastructure
2. **Underutilization** of scanning capacity across tenants
3. **No SaaS-native option** for customers who want a fully managed experience

## Solution: Hybrid Agent Model

```
┌─────────────────────────────────────────────────────────────────┐
│                     PLATFORM AGENTS                              │
│                 (Managed by Rediver)                            │
│                                                                  │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│   │Agent-US1│  │Agent-US2│  │Agent-EU1│  │Agent-AP1│          │
│   │us-east-1│  │us-west-2│  │eu-west-1│  │ap-south │          │
│   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘          │
│        └────────────┴────────────┴────────────┘                 │
│                          │                                       │
│              ┌───────────┴───────────┐                          │
│              │    JOB QUEUE          │                          │
│              │  (Fair Weighted)      │                          │
│              └───────────────────────┘                          │
│                          │                                       │
│     ┌────────────────────┼────────────────────┐                 │
│     ▼                    ▼                    ▼                 │
│ ┌────────┐          ┌────────┐          ┌────────┐             │
│ │Tenant A│          │Tenant B│          │Tenant C│             │
│ │ Jobs   │          │ Jobs   │          │ Jobs   │             │
│ └────────┘          └────────┘          └────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. System Tenant

All platform agents are owned by a special "System Tenant":
- **ID**: `00000000-0000-0000-0000-000000000001`
- Regular tenants cannot use this ID
- Platform agents have `is_platform_agent = true`

### 2. Job Queue with Fair Scheduling

Jobs from all tenants are queued and scheduled fairly:

```
Queue Priority = Base Priority + Age Bonus

Where:
- Base Priority: critical=1000, high=750, normal=500, low=250
- Age Bonus: minutes_in_queue × 10 (capped at 500)
```

This ensures:
- Older jobs get priority over newer ones
- Higher priority jobs still get processed first
- No tenant can starve others

### 3. Bootstrap Tokens

Platform agents self-register using kubeadm-style tokens:

```
Format: xxxxxx.yyyyyyyyyyyyyyyy
Example: abc123.0123456789abcdef

Features:
- Configurable expiration (1-168 hours)
- Usage limits (1-100 uses per token)
- Capability/tool/region constraints
- Audit trail of registrations
```

### 4. Per-Plan Limits

Each subscription plan has different limits:

| Plan | Max Concurrent Jobs | Max Queue Size |
|------|---------------------|----------------|
| Free | 2 | 10 |
| Starter | 5 | 50 |
| Pro | 10 | 100 |
| Enterprise | 50 | 500 |

## API Endpoints

### Admin Endpoints

```http
# Platform Agents
GET    /api/v1/admin/platform-agents           # List agents
GET    /api/v1/admin/platform-agents/stats     # Statistics
GET    /api/v1/admin/platform-agents/{id}      # Get agent
POST   /api/v1/admin/platform-agents           # Create agent
POST   /api/v1/admin/platform-agents/{id}/disable
POST   /api/v1/admin/platform-agents/{id}/enable
DELETE /api/v1/admin/platform-agents/{id}

# Bootstrap Tokens
GET    /api/v1/admin/bootstrap-tokens          # List tokens
POST   /api/v1/admin/bootstrap-tokens          # Create token
POST   /api/v1/admin/bootstrap-tokens/{id}/revoke

# Queue Stats
GET    /api/v1/admin/platform-jobs/stats
```

### Tenant Endpoints

```http
POST   /api/v1/platform-jobs                   # Submit job
GET    /api/v1/platform-jobs                   # List jobs
GET    /api/v1/platform-jobs/{id}              # Get status
POST   /api/v1/platform-jobs/{id}/cancel       # Cancel job
```

### Agent Endpoints (Public)

```http
POST   /api/v1/platform-agents/register        # Self-registration
```

### Platform Agent Endpoints (API Key Auth)

```http
POST   /api/v1/platform-agent/heartbeat            # Heartbeat
POST   /api/v1/platform-agent/poll                 # Long-poll for jobs
POST   /api/v1/platform-agent/jobs/{id}/ack        # Acknowledge job
POST   /api/v1/platform-agent/jobs/{id}/progress   # Report progress
POST   /api/v1/platform-agent/jobs/{id}/result     # Submit result
```

### Long-Polling for Jobs

Platform agents use long-polling to efficiently wait for new jobs:

```
Agent                          API Server                    Redis
  │                                │                           │
  │  POST /platform-agent/poll     │                           │
  │  timeout=30s                   │                           │
  │───────────────────────────────>│                           │
  │                                │                           │
  │                                │  Check for pending jobs   │
  │                                │  (none available)         │
  │                                │                           │
  │                                │  SUBSCRIBE job_queue      │
  │                                │<─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─>│
  │                                │                           │
  │                                │       (new job queued)    │
  │                                │<──────── PUBLISH ─────────│
  │                                │                           │
  │  Response: { jobs: [...] }     │                           │
  │<───────────────────────────────│                           │
```

**Benefits:**
- Near real-time job delivery (< 100ms latency)
- Reduced API calls by ~90%
- Scales horizontally via Redis Pub/Sub

## Usage Examples

### Creating a Bootstrap Token (Admin)

```bash
curl -X POST /api/v1/admin/bootstrap-tokens \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "description": "Production agents - US region",
    "expires_in_hours": 24,
    "max_uses": 10,
    "required_region": "us-east-1",
    "required_capabilities": ["nuclei", "nmap"]
  }'

# Response:
{
  "token": {
    "id": "...",
    "token_prefix": "abc123",
    "status": "active",
    ...
  },
  "raw_token": "abc123.0123456789abcdef"  // Save this! Only shown once
}
```

### Registering an Agent

```bash
curl -X POST /api/v1/platform-agents/register \
  -d '{
    "bootstrap_token": "abc123.0123456789abcdef",
    "name": "scanner-us-east-1-01",
    "capabilities": ["nuclei", "nmap", "subfinder"],
    "tools": ["nuclei", "nmap", "subfinder"],
    "region": "us-east-1",
    "max_concurrent": 10,
    "version": "1.0.0"
  }'

# Response:
{
  "agent": { ... },
  "api_key": "rdv_agent_..."  // Save this! Only shown once
}
```

### Submitting a Job (Tenant)

```bash
curl -X POST /api/v1/platform-jobs \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -d '{
    "type": "scan",
    "priority": "normal",
    "payload": {
      "target": "example.com",
      "tool": "nuclei",
      "templates": ["cves", "exposures"]
    },
    "capabilities": ["nuclei"],
    "preferred_region": "us-east-1"
  }'

# Response:
{
  "job": { ... },
  "auth_token": "...",  // For agent to authenticate status updates
  "status": "queued",   // or "assigned" if agent available
  "queue": {
    "position": 5
  }
}
```

### Agent Long-Polling for Jobs

```bash
# Agent long-polls for work (waits up to 30s)
curl -X POST /api/v1/platform-agent/poll \
  -H "X-API-Key: rdv_agent_..." \
  -d '{
    "capabilities": ["nuclei", "nmap"],
    "tools": ["nuclei", "nmap"],
    "timeout": 30
  }'

# Response when job available:
{
  "jobs": [{
    "id": "job-uuid",
    "type": "scan",
    "tenant_id": "tenant-uuid",
    "payload": { ... },
    "auth_token": "job-specific-token",
    "timeout": 1800
  }]
}

# Response when no job:
{
  "jobs": []
}
```

### Agent Job Lifecycle

```bash
# 1. Acknowledge job (start processing)
curl -X POST /api/v1/platform-agent/jobs/{job_id}/ack \
  -H "X-API-Key: rdv_agent_..." \
  -H "X-Job-Token: job-specific-token"

# 2. Report progress (optional, keeps job alive)
curl -X POST /api/v1/platform-agent/jobs/{job_id}/progress \
  -H "X-API-Key: rdv_agent_..." \
  -H "X-Job-Token: job-specific-token" \
  -d '{
    "progress": 50,
    "message": "Scanning 50% complete"
  }'

# 3. Submit result (complete job)
curl -X POST /api/v1/platform-agent/jobs/{job_id}/result \
  -H "X-API-Key: rdv_agent_..." \
  -H "X-Job-Token: job-specific-token" \
  -d '{
    "status": "completed",
    "result": {
      "findings": [...],
      "summary": "Found 5 vulnerabilities"
    }
  }'
```

> **Note**: Platform agents are authenticated via their API key (`X-API-Key` header). Each job also has a unique `X-Job-Token` for additional security.

## Background Workers

Two workers maintain queue health:

### PlatformQueueWorker
- **Recovery** (1min): Recovers stuck jobs
- **Expiry** (5min): Expires old queued jobs
- **Priority Update** (30s): Recalculates queue priorities

### PlatformAgentHealthChecker
- **Health Check** (30s): Marks stale agents offline
- **Stats Logging** (5min): Logs aggregate statistics

## Database Schema

### Platform Agent Fields (agents table)

```sql
ALTER TABLE agents ADD COLUMN is_platform_agent BOOLEAN DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN region VARCHAR(50);
```

### Bootstrap Tokens

```sql
CREATE TABLE bootstrap_tokens (
    id UUID PRIMARY KEY,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    token_prefix VARCHAR(10) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active',
    max_uses INT DEFAULT 1,
    current_uses INT DEFAULT 0,
    required_capabilities TEXT[],
    required_tools TEXT[],
    required_region VARCHAR(50),
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES users(id),
    revoked_by UUID REFERENCES users(id),
    revoked_at TIMESTAMPTZ,
    revoke_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Platform Job Fields (commands table)

```sql
ALTER TABLE commands ADD COLUMN is_platform_job BOOLEAN DEFAULT FALSE;
ALTER TABLE commands ADD COLUMN platform_agent_id UUID REFERENCES agents(id);
ALTER TABLE commands ADD COLUMN queued_at TIMESTAMPTZ;
ALTER TABLE commands ADD COLUMN queue_priority INT DEFAULT 0;
ALTER TABLE commands ADD COLUMN auth_token_hash VARCHAR(64);
ALTER TABLE commands ADD COLUMN auth_token_expires_at TIMESTAMPTZ;
ALTER TABLE commands ADD COLUMN retry_count INT DEFAULT 0;
```

## Security Considerations

### 1. Bootstrap Token Security
- Tokens are hashed before storage (SHA-256)
- Only shown once at creation
- Can be revoked anytime
- Have configurable constraints (region, capabilities, tools)
- Audit trail of all registrations

### 2. Job Authentication
- Each job has a unique auth token
- Token lifetime = job timeout + 10 minutes (not 24 hours)
- Agents must provide token to update status
- Prevents unauthorized status updates

### 3. Tenant Isolation
- Jobs are always scoped to tenant
- Agents cannot access other tenants' data
- Queue limits per tenant
- Platform agents get tenant context from job, not from agent itself

### 4. Input Validation (P0 Security)

**Scanner Name Whitelist:**
Only these scanners are allowed to prevent command injection:
```
semgrep, gitleaks, trivy, trivy-fs, trivy-config,
trivy-image, trivy-full, nuclei, bandit, gosec,
brakeman, eslint, tfsec, checkov, grype, dependency
```

**Job Type Whitelist:**
```
scan, collect, health_check
```

**Path Traversal Prevention:**
- Target paths cannot contain `../`
- Prevents directory traversal attacks

**Payload Limits:**
- Maximum payload size: 1MB
- Maximum job timeout: 2 hours

### 5. Rate Limiting (P2 Security)

**Auth Failure Rate Limiter:**
Protects against brute-force attacks on agent authentication.

| Setting | Value |
|---------|-------|
| Max failures before ban | 5 |
| Ban duration | 15 minutes |
| Window duration | 15 minutes |
| Cleanup interval | 5 minutes |

```go
// Configuration in middleware/ratelimit.go
cfg := AuthFailureLimiterConfig{
    MaxFailures:     5,
    BanDuration:     15 * time.Minute,
    WindowDuration:  15 * time.Minute,
    CleanupInterval: 5 * time.Minute,
}
```

### 6. Security Monitoring

**Security Event Types:**
All security events are logged with structured types for monitoring/alerting:

| Event Type | Description |
|------------|-------------|
| `security.auth.failure` | Authentication failure |
| `security.agent.not_found` | Unknown agent ID attempt |
| `security.apikey.invalid` | Invalid API key |
| `security.agent.inactive` | Inactive agent attempt |
| `security.agent.type_mismatch` | Non-platform agent trying platform auth |
| `security.job.access_denied` | Unauthorized job access attempt |
| `security.token.invalid` | Invalid/expired job token |

**Prometheus Metrics:**

| Metric | Type | Description |
|--------|------|-------------|
| `security_events_total` | Counter | Total security events by type |
| `auth_failures_total` | Counter | Auth failures by reason |
| `banned_ips_current` | Gauge | Currently banned IPs |
| `platform_jobs_submitted_total` | Counter | Jobs by type and status |
| `job_validation_failures_total` | Counter | Validation failures by reason |

**Example Prometheus Queries:**
```promql
# Alert on high auth failure rate
rate(auth_failures_total[5m]) > 10

# Alert on security events
increase(security_events_total{event_type="security.job.access_denied"}[1h]) > 5

# Dashboard: Banned IPs
banned_ips_current
```

## Deployment Guide

### Prerequisites

1. Redis server (for job notifications via Pub/Sub)
2. PostgreSQL with migrations applied
3. API server with platform agent endpoints enabled

### Step 1: Apply Database Migrations

```bash
# Run migrations 000080-000081
make migrate-up
```

### Step 2: Create Bootstrap Token

```bash
# Via Admin API
curl -X POST /api/v1/admin/bootstrap-tokens \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "description": "Production agents",
    "expires_in_hours": 24,
    "max_uses": 10,
    "required_region": "us-east-1"
  }'

# Save the raw_token from response
```

### Step 3: Deploy Platform Agent

```bash
# Environment variables for agent
export EXPLOOP_API_URL=https://api.exploop.io
export REDIVER_BOOTSTRAP_TOKEN=abc123.0123456789abcdef
export AGENT_NAME=scanner-us-east-1-01
export AGENT_REGION=us-east-1
export AGENT_CAPABILITIES=nuclei,nmap,trivy

# Run agent
./exploop-agent --platform
```

### Step 4: Configure Tenant Plan Limits

Update tenant subscription plans in the database or via Admin UI:
- Free: 2 concurrent jobs, 10 queue size
- Starter: 5 concurrent jobs, 50 queue size
- Pro: 10 concurrent jobs, 100 queue size
- Enterprise: 50 concurrent jobs, 500 queue size

## Operations

### Monitoring Dashboards

Import Grafana dashboards for:
- Platform agent health status
- Job queue depth and latency
- Security events and auth failures
- Per-tenant usage statistics

### Alerting Rules

```yaml
# Example Prometheus alerting rules
groups:
  - name: platform-agents
    rules:
      - alert: HighAuthFailureRate
        expr: rate(auth_failures_total[5m]) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High authentication failure rate

      - alert: SecurityEventDetected
        expr: increase(security_events_total{event_type="security.job.access_denied"}[1h]) > 5
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: Unauthorized job access attempts detected

      - alert: AllAgentsOffline
        expr: count(agent_status{type="platform", status="online"}) == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: All platform agents are offline
```

### Troubleshooting

**Agent not receiving jobs:**
1. Check agent is online: `GET /api/v1/admin/platform-agents/{id}`
2. Check agent capabilities match job requirements
3. Check Redis Pub/Sub connectivity
4. Check agent logs for authentication errors

**Jobs stuck in queue:**
1. Check `PlatformQueueWorker` is running
2. Check for available agents with matching capabilities
3. Check tenant hasn't exceeded queue limits
4. Review job priority calculation

**High auth failure rate:**
1. Check for misconfigured agents
2. Review banned IPs: query `banned_ips_current` metric
3. Check for credential leaks or brute-force attempts

## Migration Notes

For existing deployments:
1. Run migrations 000080 and 000081
2. Create bootstrap tokens for agent registration
3. Deploy platform agents with bootstrap tokens
4. Configure tenant plan limits

## Related Documentation

- [Architecture: Platform Agents](../architecture/platform-agents-implementation-plan.md)
- [Guide: Agent Configuration](../guides/agent-configuration.md)
- [Guide: Running Agents](../guides/running-agents.md)
