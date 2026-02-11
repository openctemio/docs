---
layout: default
title: Platform Agents v3.2 Architecture
parent: Architecture
nav_order: 15
---

# Platform Agents v3.2 Architecture

## Overview

Platform Agents v3.2 is a multi-tenant agent architecture that provides OpenCTEM-managed execution infrastructure shared across all tenants. Key features include:

- **Self-registration** via bootstrap tokens
- **Kubernetes-style lease-based** health monitoring
- **Weighted Fair Queuing** for job scheduling
- **Tier-based resource isolation** (Shared/Dedicated/Premium)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PLATFORM AGENTS POOL                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Premium Tier          Dedicated Tier           Shared Tier                │
│   ┌──────────┐          ┌──────────┐            ┌──────────┐               │
│   │Agent-P1  │          │Agent-D1  │            │Agent-S1  │               │
│   │Enterprise│          │Business  │            │Free/Team │               │
│   └────┬─────┘          └────┬─────┘            └────┬─────┘               │
│        │                     │                       │                      │
│        └─────────────────────┴───────────────────────┘                      │
│                              │                                               │
│                    ┌─────────┴─────────┐                                    │
│                    │    JOB QUEUE      │                                    │
│                    │ (WFQ Scheduling)  │                                    │
│                    └─────────┬─────────┘                                    │
│                              │                                               │
│     ┌────────────────────────┼────────────────────────┐                     │
│     ▼                        ▼                        ▼                     │
│ ┌────────────┐        ┌────────────┐          ┌────────────┐               │
│ │ Enterprise │        │  Business  │          │  Free/Team │               │
│ │ Priority:  │        │ Priority:  │          │ Priority:  │               │
│ │   100      │        │    75      │          │   25-50    │               │
│ └────────────┘        └────────────┘          └────────────┘               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Types

### Platform vs Tenant Agents

| Property | Tenant Agent | Platform Agent |
|----------|--------------|----------------|
| `tenant_id` | Required (NOT NULL) | NULL |
| `is_platform_agent` | false | true |
| Execution Mode | Configurable | Always Daemon |
| Tier | N/A | shared/dedicated/premium |
| Management | Customer self-managed | OpenCTEM-managed |
| Creation | `NewAgent()` | `NewPlatformAgent()` |

### Database Constraint

```sql
CHECK (
    (is_platform_agent = FALSE AND tenant_id IS NOT NULL) OR
    (is_platform_agent = TRUE AND tenant_id IS NULL)
)
```

---

## Platform Agent Tiers

### Tier Hierarchy

| Tier | Priority | Target Plan |
|------|----------|-------------|
| `premium` | 100 | Enterprise |
| `dedicated` | 50 | Business |
| `shared` | 0 | Free/Team |

### Plan-to-Tier Mapping

| Plan | Max Tier | Concurrent Jobs | Queued Jobs | Priority Base |
|------|----------|-----------------|-------------|---------------|
| Free | shared | 1 | 5 | 25 |
| Team | shared | 3 | 20 | 50 |
| Business | dedicated | 10 | 50 | 75 |
| Enterprise | premium | 50 | 200 | 100 |

### Tier Access Control

```go
// Premium plan can access: premium, dedicated, shared
// Dedicated plan can access: dedicated, shared
// Shared plan can access: shared only

func (t PlatformAgentTier) CanAccessTier(target PlatformAgentTier) bool
```

---

## Bootstrap Token System

### Purpose

Kubeadm-style tokens for agent self-registration without manual API key provisioning.

### Token Format

```
Prefix:  oc-bt- (7 chars)
Length:  32 bytes (256 bits) random hex
Example: oc-bt-3c4f5a6b7c8d9e0f1a2b3c4d5e6f7g8h
Storage: SHA256 hash (never plaintext)
```

### Token Entity

```go
type BootstrapToken struct {
    ID          string
    TokenHash   string    // SHA256 of full token
    TokenPrefix string    // "oc-bt-abc123de"
    Description string

    ExpiresAt   time.Time
    MaxUses     int
    CurrentUses int

    // Constraints
    RequiredCapabilities []string
    RequiredTools        []string
    RequiredRegion       string

    // Audit
    CreatedBy   *string
    RevokedBy   *string
    RevokedAt   *time.Time
}
```

### Token Lifecycle

```
active → expired    (time expires)
       → exhausted  (max_uses reached)
       → revoked    (manually revoked)
```

### Security Measures

1. **Constant-Time Comparison** - Prevents timing attacks
2. **Generic Error Messages** - No state leakage
3. **Hash-Only Storage** - Raw token shown only once
4. **Token Prefix** - For identification without exposing full value

---

## Agent Registration Flow

### Endpoint

```
POST /api/v1/platform/register
Content-Type: application/json
```

### Request

```json
{
  "bootstrap_token": "oc-bt-...",
  "name": "us-east-1-scanner",
  "capabilities": ["sast", "sca"],
  "tools": ["semgrep", "trivy"],
  "region": "us-east-1",
  "tier": "shared",
  "hostname": "ip-10-0-1-234",
  "metadata": {}
}
```

### Response

```json
{
  "agent_id": "550e8400-e29b-41d4-a716-446655440000",
  "api_key": "oc-ak-...",
  "api_base_url": "https://api.openctem.io"
}
```

### Registration Steps

1. **Token Lookup** - Hash token, find in DB
2. **Token Validation** - Check status, expiry, usage
3. **Constraint Check** - Verify agent meets token requirements
4. **Agent Creation** - Create platform agent entity
5. **API Key Generation** - Generate and hash API key
6. **Record Registration** - Log in audit table
7. **Increment Usage** - Update token usage counter

---

## Lease-Based Heartbeat System

### Kubernetes-Style Leases

The system implements K8s Lease API for agent health monitoring:

```sql
CREATE TABLE agent_leases (
    agent_id UUID PRIMARY KEY,
    holder_identity VARCHAR(255),        -- hostname/container ID
    lease_duration_seconds INT DEFAULT 60,
    renew_time TIMESTAMPTZ,             -- last heartbeat
    current_jobs INT,
    max_jobs INT,
    cpu_percent DECIMAL(5,2),
    memory_percent DECIMAL(5,2),
    disk_percent DECIMAL(5,2),
    resource_version INT                -- optimistic locking
);
```

### Lease Renewal

```
PUT /api/v1/platform/lease
Authorization: Bearer {api_key}
```

```json
{
  "holder_identity": "hostname-or-container-id",
  "lease_duration_seconds": 60,
  "current_jobs": 2,
  "max_jobs": 5,
  "cpu_percent": 45.3,
  "memory_percent": 62.1,
  "disk_percent": 38.0
}
```

### Health Status Determination

```
Online:   lease exists AND renew_time + lease_duration > NOW()
Offline:  lease missing OR lease expired
Degraded: lease exists but metrics show issues
```

### Lease Bounds

```go
// Enforced limits
if leaseDurationSeconds <= 0 { leaseDurationSeconds = 60 }
if leaseDurationSeconds > 300 { leaseDurationSeconds = 300 }  // Max 5 min
if maxJobs <= 0 { maxJobs = 5 }
if maxJobs > 100 { maxJobs = 100 }
```

---

## Weighted Fair Queuing (WFQ)

### Priority Calculation

```
queue_priority = base_priority + age_bonus

Where:
- base_priority = CASE plan
    WHEN 'enterprise' THEN 100
    WHEN 'business' THEN 75
    WHEN 'team' THEN 50
    WHEN 'free' THEN 25
  END

- age_bonus = MIN(age_minutes, 75)  // Max 75 points
```

### Priority Aging

- **Base:** Plan determines starting priority (25-100)
- **Aging:** +1 point per minute waiting, max +75 points
- **Effect:** After 75 minutes, any job moves ahead of newer high-priority jobs
- **Fairness:** Prevents starvation of low-tier jobs

### Queue Ordering

```sql
ORDER BY queue_priority DESC,  -- Higher priority first
         queued_at ASC         -- FIFO within same priority
```

---

## Load Balancing

### Load Score Formula

```
LoadScore = (0.30 × job_load) + (0.40 × cpu) + (0.15 × memory)
          + (0.10 × disk_io) + (0.05 × network)

Where:
- job_load = (current_jobs / max_concurrent_jobs) × 100
- cpu = CPUPercent (0-100)
- memory = MemoryPercent (0-100)
- disk_io = min(100, (disk_read_mbps + disk_write_mbps) / 500 × 100)
- network = min(100, (rx_mbps + tx_mbps) / 1000 × 100)

Lower score = better candidate
```

### Agent Selection Algorithm

```sql
SELECT * FROM agents
WHERE is_platform_agent = TRUE
  AND status = 'active'
  AND health = 'online'
  AND current_jobs < max_concurrent_jobs
  AND tier IN (accessible_tiers)
ORDER BY
  CASE tier WHEN 'premium' THEN 100
            WHEN 'dedicated' THEN 50
            ELSE 0 END DESC,
  CASE WHEN region = preferred THEN 0 ELSE 1 END ASC,
  load_score ASC,
  current_jobs ASC
LIMIT 1
```

### Selection Priority

1. **Tier Preference** - Premium > Dedicated > Shared
2. **Region** - Soft preference (not hard requirement)
3. **Load Score** - Lower is better
4. **Job Count** - Fewer jobs preferred for tie-breaking

---

## Job Lifecycle

```
Submit Job
    │
    ▼
Agent Available?
├─ Yes → Assign + Acknowledge
├─ No, Allow Queue → Queue + Return QueuePosition
└─ No, Deny → 409 Conflict

While Queued:
    ├─ Priority ages (1 point/minute)
    ├─ Dispatch attempts every N seconds
    ├─ If stuck (agent offline): Recover to queue
    └─ If timeout: Expire with error

Assigned:
    ├─ Agent acknowledges
    ├─ Agent starts execution
    └─ Agent reports result

Completed/Failed → Record metrics
```

### Stuck Job Recovery

```sql
-- A job is "stuck" if:
-- 1. Status is acknowledged or running
-- 2. Agent went offline (health != 'online')
-- 3. OR dispatch_attempts < 3 AND last_dispatch_at > 30 min ago

UPDATE commands SET
    platform_agent_id = NULL,
    status = 'pending',
    acknowledged_at = NULL
WHERE is_platform_job = TRUE
  AND dispatch_attempts < 3  -- Max 3 retries
  AND (agent_offline OR stuck_too_long)
```

---

## API Endpoints

### Agent Registration (Public)

```
POST /api/v1/platform/register
```

### Agent Communication (API Key Auth)

```
PUT    /api/v1/platform/lease              # Heartbeat
DELETE /api/v1/platform/lease              # Graceful shutdown
GET    /api/v1/platform/commands           # Poll for jobs
POST   /api/v1/platform/commands/{id}/ack  # Acknowledge
POST   /api/v1/platform/commands/{id}/result # Report result
```

### Tenant Job Submission (JWT Auth)

```
POST   /api/v1/platform-jobs/              # Submit job
GET    /api/v1/platform-jobs/              # List jobs
GET    /api/v1/platform-jobs/{id}          # Get job status
POST   /api/v1/platform-jobs/{id}/cancel   # Cancel job
```

### Admin Management

```
GET    /api/v1/platform-agents             # List agents
POST   /api/v1/bootstrap-tokens            # Create token
GET    /api/v1/bootstrap-tokens            # List tokens
POST   /api/v1/bootstrap-tokens/{id}/revoke # Revoke token
```

---

## Security Controls

### Data Isolation

| Aspect | Control |
|--------|---------|
| Tenant Data | Platform jobs filtered by tenant_id |
| Platform Metrics | Aggregate stats only |
| Auth Tokens | Per-job tokens signed independently |

### Authentication

| Layer | Method |
|-------|--------|
| API Key Auth | Agent identifies itself |
| Job Auth Token | Proves authorization for specific job |
| Agent Status | Must be active, not disabled |

### Encryption

| Secret | Method |
|--------|--------|
| Bootstrap Token | SHA256 hash |
| API Key | SHA256 hash |
| Job Auth Token | SHA256 hash |
| Credentials | AES-256-GCM |

### Rate Limiting

| Endpoint | Limit |
|----------|-------|
| Registration | 10 req/min per IP |
| Auth Failure | 5 attempts per 5 min |

---

## Database Schema

### Key Tables

| Table | Purpose |
|-------|---------|
| `agents` | Agent registry (is_platform_agent, tier, load_score) |
| `commands` | Job queue (is_platform_job, queue_priority) |
| `agent_leases` | Health tracking (renew_time, lease_duration) |
| `platform_agent_bootstrap_tokens` | Self-registration tokens |
| `platform_agent_registrations` | Audit log |

### Critical Indexes

```sql
-- Find available platform agents
CREATE INDEX idx_agents_platform_available ON agents(...)
    WHERE is_platform_agent = TRUE AND status = 'active';

-- Poll pending jobs
CREATE INDEX idx_commands_platform_queue
    ON commands(queue_priority DESC, queued_at ASC)
    WHERE is_platform_job = TRUE AND status = 'pending';

-- Detect expired leases
CREATE INDEX idx_agent_leases_expiry ON agent_leases(renew_time);
```

---

## Monitoring

### Key Metrics

| Metric | Description |
|--------|-------------|
| `platform_agents_total` | Total registered platform agents |
| `platform_agents_online` | Agents with valid lease |
| `platform_jobs_queued` | Jobs waiting in queue |
| `platform_jobs_active` | Jobs currently executing |
| `platform_queue_wait_p95` | 95th percentile wait time |
| `platform_agent_load_avg` | Average agent load score |

### Alerts

| Alert | Condition |
|-------|-----------|
| NoAgentsAvailable | All agents offline > 5 min |
| HighQueueDepth | Queue > 1000 jobs for 10 min |
| AgentOverloaded | Load score > 90 for 15 min |
| StuckJobsDetected | Stuck jobs > 10 |

---

## Related Documentation

- [Platform Agents Feature](../features/platform-agents.md)
- [Scan Pipeline Design](scan-pipeline-design.md)
- [Agent Configuration Guide](../guides/agent-configuration.md)
