---
layout: default
title: Platform Admin System Implementation Plan
nav_order: 99
---

# Platform Admin System - Complete Implementation Plan

**Date:** 2026-01-25
**Status:** COMPLETED
**Version:** 3.0
**Last Updated:** 2026-01-26 (All phases completed - Phase 0-8 done)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Control Plane Design](#3-control-plane-design)
4. [Platform Agent Design](#4-platform-agent-design)
5. [Admin CLI (kubectl-style)](#5-admin-cli-kubectl-style)
6. [Security & Compliance](#6-security--compliance)
7. [Database Schema](#7-database-schema)
8. [Implementation Phases](#8-implementation-phases)
9. [Best Practices Checklist](#9-best-practices-checklist)
10. [Security Review (Cybersecurity Expert)](#10-security-review-cybersecurity-expert-evaluation) ⚠️ **Must Read**
11. [Plan Evaluation (PM/Tech Lead/BA)](#11-plan-evaluation-pmtech-leadba-review)
12. [References](#12-references)

---

## 1. Executive Summary

### 1.1 Goals

Build a **Platform Agents** system for OpenCTEM Security Platform with:
- **K8s-inspired architecture**: Control Plane + Worker pattern
- **Self-healing**: Automatic recovery on errors
- **Multi-tenant isolation**: Complete separation from tenant data
- **Enterprise-grade security**: Audit trail, encryption, compliance

### 1.2 Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | K8s-inspired Hybrid | Self-healing + manageable complexity |
| State Store | PostgreSQL + Redis | Proven, sufficient for scale |
| Agent Communication | Long-poll + Lease | Near real-time, efficient |
| Admin Auth | Individual API keys | Audit trail, revocation |
| CLI Design | kubectl-style | Familiar, powerful |
| Job Assignment | Pull-based with priority queue | Fair, scalable |

### 1.3 Non-Goals (Out of Scope)

- Full Kubernetes deployment (overkill)
- gRPC/Protobuf (REST sufficient)
- Distributed etcd cluster (PostgreSQL sufficient)
- Real-time WebSocket streaming (Long-poll sufficient)

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CONTROL PLANE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                         API LAYER                                   │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │ │
│  │  │  Tenant API  │  │  Admin API   │  │  Platform Agent API      │  │ │
│  │  │  (JWT Auth)  │  │  (API Key)   │  │  (Agent Key + Lease)     │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│  ┌─────────────────────────────────┼─────────────────────────────────┐  │
│  │                         SERVICE LAYER                              │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │  │
│  │  │ AgentSvc    │  │ JobQueueSvc │  │ TokenSvc    │  │ AdminSvc  │ │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘ │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│  ┌─────────────────────────────────┼─────────────────────────────────┐  │
│  │                      CONTROLLER LAYER (K8s-style)                  │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │  │
│  │  │ AgentHealth     │  │ JobRecovery     │  │ QueuePriority   │    │  │
│  │  │ Controller      │  │ Controller      │  │ Controller      │    │  │
│  │  │ (every 30s)     │  │ (every 1m)      │  │ (every 1m)      │    │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘    │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                         │  │
│  │  │ TokenCleanup    │  │ MetricsExporter │                         │  │
│  │  │ Controller      │  │ Controller      │                         │  │
│  │  │ (every 1h)      │  │ (every 15s)     │                         │  │
│  │  └─────────────────┘  └─────────────────┘                         │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│  ┌─────────────────────────────────┼─────────────────────────────────┐  │
│  │                        DATA LAYER                                  │  │
│  │  ┌─────────────────────┐    ┌─────────────────────────────────┐   │  │
│  │  │     PostgreSQL      │    │            Redis                 │   │  │
│  │  │  ┌───────────────┐  │    │  ┌───────────────────────────┐  │   │  │
│  │  │  │ agents        │  │    │  │ agent:lease:{id}          │  │   │  │
│  │  │  │ commands      │  │    │  │ agent:state:{id}          │  │   │  │
│  │  │  │ admin_users   │  │    │  │ queue:jobs:pending        │  │   │  │
│  │  │  │ audit_logs    │  │    │  │ pubsub:job:assigned       │  │   │  │
│  │  │  │ leases        │  │    │  │ cache:agent:stats         │  │   │  │
│  │  │  └───────────────┘  │    │  └───────────────────────────┘  │   │  │
│  │  └─────────────────────┘    └─────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        │  Long-Poll (Jobs)         │  Heartbeat (Lease)        │
        │  POST /platform/poll      │  PUT /platform/lease      │
        ▼                           ▼                           ▼
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│  Platform Agent   │  │  Platform Agent   │  │  Platform Agent   │
│  ┌─────────────┐  │  │  ┌─────────────┐  │  │  ┌─────────────┐  │
│  │ Job Runner  │  │  │  │ Job Runner  │  │  │  │ Job Runner  │  │
│  │ Heartbeat   │  │  │  │ Heartbeat   │  │  │  │ Heartbeat   │  │
│  │ Reporter    │  │  │  │ Reporter    │  │  │  │ Reporter    │  │
│  └─────────────┘  │  └─────────────┘  │  │  └─────────────┘  │
│  Region: us-e1    │  │  Region: eu-w1    │  │  Region: ap-se1   │
│  Caps: sast,sca   │  │  Caps: dast,api   │  │  Caps: sast,sca   │
└───────────────────┘  └───────────────────┘  └───────────────────┘
```

### 2.2 Agent Selection Mechanism

When tenant creates a scan job, the system needs to decide whether to use Platform Agent or Tenant Agent.

#### Selection Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    AGENT SELECTION DECISION FLOW                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. TENANT CREATES SCAN                                                  │
│     POST /api/v1/scans                                                   │
│     {                                                                    │
│       "target": "github.com/org/repo",                                   │
│       "scan_type": "sast",                                              │
│       "agent_preference": "auto"  // auto | platform | tenant           │
│     }                                                                    │
│                           │                                              │
│                           ▼                                              │
│  2. CHECK AGENT PREFERENCE                                               │
│     ┌─────────────────────────────────────────────────────────────────┐ │
│     │                                                                   │ │
│     │  agent_preference = "tenant"?                                     │ │
│     │  ┌─YES─► Use tenant's own agents only                            │ │
│     │  │       (fail if no capable agent available)                    │ │
│     │  │                                                                │ │
│     │  │  agent_preference = "platform"?                               │ │
│     │  ├─YES─► Use platform agents only                                │ │
│     │  │       (requires platform_agents module enabled)               │ │
│     │  │                                                                │ │
│     │  │  agent_preference = "auto" (default)?                         │ │
│     │  └─YES─► Smart selection (see below)                             │ │
│     │                                                                   │ │
│     └─────────────────────────────────────────────────────────────────┘ │
│                           │                                              │
│                           ▼                                              │
│  3. SMART SELECTION (agent_preference = "auto")                          │
│     ┌─────────────────────────────────────────────────────────────────┐ │
│     │                                                                   │ │
│     │  Step 3.1: Check tenant agents first                              │ │
│     │  ┌─────────────────────────────────────────────────────────────┐ │ │
│     │  │ SELECT * FROM agents                                         │ │ │
│     │  │ WHERE tenant_id = :tenant_id                                 │ │ │
│     │  │   AND status = 'online'                                      │ │ │
│     │  │   AND capabilities @> ARRAY[:required_capability]            │ │ │
│     │  │   AND current_jobs < max_concurrent_jobs                     │ │ │
│     │  │ ORDER BY load_factor ASC, last_seen_at DESC                  │ │ │
│     │  │ LIMIT 1                                                      │ │ │
│     │  └─────────────────────────────────────────────────────────────┘ │ │
│     │                           │                                       │ │
│     │                           ▼                                       │ │
│     │  ┌─ Tenant agent found? ─┬─ YES ─► Assign to tenant agent        │ │
│     │  │                       │                                        │ │
│     │  │                       └─ NO ─► Step 3.2                        │ │
│     │  │                                                                │ │
│     │  │  Step 3.2: Fallback to platform agents (if enabled)            │ │
│     │  │  ┌─────────────────────────────────────────────────────────┐  │ │
│     │  │  │ // Check if tenant has platform_agents module            │  │ │
│     │  │  │ IF NOT TenantHasModule("platform_agents") THEN           │  │ │
│     │  │  │     RETURN "No available agents, please deploy an agent" │  │ │
│     │  │  │ END IF                                                   │  │ │
│     │  │  │                                                          │  │ │
│     │  │  │ // Check platform agent quota                            │  │ │
│     │  │  │ IF TenantExceedsQuota("platform_jobs") THEN              │  │ │
│     │  │  │     RETURN "Platform quota exceeded, please wait"        │  │ │
│     │  │  │ END IF                                                   │  │ │
│     │  │  │                                                          │  │ │
│     │  │  │ // Queue for platform agent                               │  │ │
│     │  │  │ CreatePlatformJob(scan, priority)                        │  │ │
│     │  │  └─────────────────────────────────────────────────────────┘  │ │
│     │  │                                                                │ │
│     │  └────────────────────────────────────────────────────────────────┘ │
│     │                                                                   │ │
│     └─────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Selection Priority Rules

| Priority | Condition | Action |
|----------|-----------|--------|
| 1 | `agent_preference = "tenant"` | Only tenant agents, fail if unavailable |
| 2 | `agent_preference = "platform"` | Only platform agents, check quota |
| 3 | `agent_preference = "auto"` | Tenant first, platform fallback |
| 4 | Tenant agent available + online | Use tenant agent immediately |
| 5 | No tenant agent, platform enabled | Queue for platform agent |
| 6 | No tenant agent, platform disabled | Error: "Deploy an agent" |

#### Agent Matching Criteria

```go
// AgentSelector determines the best agent for a scan job
type AgentSelector struct {
    agentRepo    agent.Repository
    licensingService licensing.Service
}

type SelectionCriteria struct {
    TenantID        shared.ID
    RequiredCaps    []string   // ["sast", "sca"]
    PreferredRegion string     // "ap-southeast-1"
    Preference      string     // "auto", "tenant", "platform"
}

type SelectionResult struct {
    AgentID        *shared.ID
    AgentType      string     // "tenant" or "platform"
    IsPlatformJob  bool
    QueuePosition  int        // 0 if immediate, >0 if queued
    EstimatedWait  time.Duration
}

func (s *AgentSelector) SelectAgent(ctx context.Context, criteria SelectionCriteria) (*SelectionResult, error) {
    // 1. Check preference
    switch criteria.Preference {
    case "tenant":
        return s.selectTenantAgent(ctx, criteria)
    case "platform":
        return s.selectPlatformAgent(ctx, criteria)
    default: // "auto"
        // Try tenant first
        result, err := s.selectTenantAgent(ctx, criteria)
        if err == nil && result.AgentID != nil {
            return result, nil
        }
        // Fallback to platform
        return s.selectPlatformAgent(ctx, criteria)
    }
}

func (s *AgentSelector) selectTenantAgent(ctx context.Context, c SelectionCriteria) (*SelectionResult, error) {
    agents, err := s.agentRepo.FindAvailableByTenant(ctx, c.TenantID, agent.FindCriteria{
        Capabilities: c.RequiredCaps,
        Status:       agent.StatusOnline,
        HasCapacity:  true,
    })
    if err != nil {
        return nil, err
    }

    if len(agents) == 0 {
        if c.Preference == "tenant" {
            return nil, fmt.Errorf("no available tenant agents with capabilities: %v", c.RequiredCaps)
        }
        return &SelectionResult{AgentType: "none"}, nil
    }

    // Sort by: region match > load factor > last seen
    best := s.rankAgents(agents, c.PreferredRegion)
    return &SelectionResult{
        AgentID:   &best.ID,
        AgentType: "tenant",
    }, nil
}

func (s *AgentSelector) selectPlatformAgent(ctx context.Context, c SelectionCriteria) (*SelectionResult, error) {
    // Check module access
    if !s.licensingService.TenantHasModule(ctx, c.TenantID, "platform_agents") {
        return nil, fmt.Errorf("platform agents module not enabled for tenant")
    }

    // Check quota
    limits := s.licensingService.GetPlatformLimits(ctx, c.TenantID)
    pending := s.jobRepo.CountPendingPlatformJobs(ctx, c.TenantID)
    if pending >= limits.MaxQueuedPlatformJobs {
        return nil, fmt.Errorf("platform job quota exceeded (%d/%d)", pending, limits.MaxQueuedPlatformJobs)
    }

    // Don't assign specific agent yet - queue for assignment
    position, wait := s.estimateQueuePosition(ctx, c.TenantID, c.RequiredCaps)
    return &SelectionResult{
        AgentType:     "platform",
        IsPlatformJob: true,
        QueuePosition: position,
        EstimatedWait: wait,
    }, nil
}
```

#### UI/UX for Agent Selection

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CREATE NEW SCAN - AGENT SELECTION                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Target Repository                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ github.com/acme/web-app                                       [▼]  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Scan Type                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ ● SAST (Static Analysis)                                            │ │
│  │ ○ SCA (Dependency Scan)                                             │ │
│  │ ○ Secrets Detection                                                 │ │
│  │ ○ Full Security Scan                                                │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Agent Selection                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                                                                      │ │
│  │  ● Auto-select (Recommended)                                        │ │
│  │    Uses your agents if available, falls back to platform agents     │ │
│  │                                                                      │ │
│  │  ○ Use my agents only                                               │ │
│  │    ┌──────────────────────────────────────────────────────────────┐│ │
│  │    │ ✓ agent-prod-1 (online, 2/5 jobs)                            ││ │
│  │    │ ✓ agent-prod-2 (online, 0/5 jobs)                            ││ │
│  │    │ ✗ agent-dev-1 (offline)                                      ││ │
│  │    └──────────────────────────────────────────────────────────────┘│ │
│  │                                                                      │ │
│  │  ○ Use platform agents                                              │ │
│  │    ┌──────────────────────────────────────────────────────────────┐│ │
│  │    │ ℹ 3 agents available | ~5 min estimated wait                  ││ │
│  │    │ Quota: 2/10 concurrent jobs | 5/50 daily jobs                ││ │
│  │    └──────────────────────────────────────────────────────────────┘│ │
│  │                                                                      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                           [Start Scan]                               │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Comparison: Tenant Agent vs Platform Agent

| Aspect | Tenant Agent | Platform Agent |
|--------|--------------|----------------|
| **Setup** | Self-deployed by tenant | Managed by OpenCTEM |
| **Cost** | Infrastructure cost to tenant | Included in plan (with limits) |
| **Latency** | Immediate if online | Queue-based (may wait) |
| **Capacity** | Limited by tenant's infra | Shared pool (auto-scaling) |
| **Network** | Inside tenant's network | Public internet access only |
| **Private Repos** | Direct access | Needs credentials/token |
| **Compliance** | Full control | Shared infrastructure |
| **Best For** | Enterprise, high volume | SMB, occasional scans |

#### Default Behavior by Plan

| Plan | Default `agent_preference` | Platform Agents Access |
|------|---------------------------|------------------------|
| Free | N/A | No platform access |
| Starter | `"platform"` | Limited quota |
| Professional | `"auto"` | Standard quota |
| Enterprise | `"auto"` | Unlimited (priority queue) |

### 2.3 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        JOB LIFECYCLE                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. Tenant requests scan                                                 │
│     POST /api/v1/scans { agent_preference: "auto" }                     │
│                           │                                              │
│                           ▼                                              │
│  2. Job created with status=PENDING                                      │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ commands: { id, tenant_id, status=PENDING, queue_priority } │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                           │                                              │
│                           ▼                                              │
│  3. QueuePriority Controller calculates priority                         │
│     priority = plan_base (25-100) + age_bonus (0-75)                    │
│                           │                                              │
│                           ▼                                              │
│  4. Agent long-polls for job                                             │
│     POST /api/v1/platform/poll { capabilities, timeout: 30s }           │
│                           │                                              │
│                           ▼                                              │
│  5. Best match selected, job assigned                                    │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ commands: { status=ASSIGNED, platform_agent_id, auth_token }│     │
│     └─────────────────────────────────────────────────────────────┘     │
│                           │                                              │
│                           ▼                                              │
│  6. Agent executes job, reports progress                                 │
│     PUT /api/v1/platform/jobs/:id/status { progress, logs }             │
│                           │                                              │
│                           ▼                                              │
│  7. Job completed                                                        │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ commands: { status=COMPLETED, completed_at, result }        │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Control Plane Design

### 3.1 Controller Workers (K8s-style Reconciliation)

**Pattern**: Continuously reconcile actual state → desired state

```go
// Controller interface
type Controller interface {
    Name() string
    Interval() time.Duration
    Reconcile(ctx context.Context) error
}

// Controller Manager runs all controllers
type ControllerManager struct {
    controllers []Controller
    logger      *logger.Logger
}

func (m *ControllerManager) Start(ctx context.Context) {
    for _, c := range m.controllers {
        go m.runController(ctx, c)
    }
}

func (m *ControllerManager) runController(ctx context.Context, c Controller) {
    ticker := time.NewTicker(c.Interval())
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            if err := c.Reconcile(ctx); err != nil {
                m.logger.Error("controller reconcile failed",
                    "controller", c.Name(),
                    "error", err)
            }
        }
    }
}
```

### 3.2 Controllers List

| Controller | Interval | Responsibility |
|------------|----------|----------------|
| `AgentHealthController` | 30s | Check leases, mark offline agents |
| `JobRecoveryController` | 1m | Recover stuck/orphaned jobs |
| `QueuePriorityController` | 1m | Recalculate job priorities |
| `TokenCleanupController` | 1h | Expire/cleanup old tokens |
| `MetricsExporterController` | 15s | Export Prometheus metrics |
| `AuditRetentionController` | 24h | Cleanup old audit logs |

### 3.3 AgentHealth Controller

```go
type AgentHealthController struct {
    agentRepo    agent.Repository
    leaseRepo    LeaseRepository
    jobRepo      command.Repository
    interval     time.Duration
    leaseTimeout time.Duration // 2x heartbeat interval
}

func (c *AgentHealthController) Reconcile(ctx context.Context) error {
    // 1. Find agents with expired leases
    expiredAgents, err := c.leaseRepo.FindExpired(ctx, c.leaseTimeout)
    if err != nil {
        return err
    }

    for _, agentID := range expiredAgents {
        // 2. Mark agent as offline
        c.agentRepo.UpdateHealth(ctx, agentID, agent.HealthOffline)

        // 3. Reassign any jobs from this agent
        jobs, _ := c.jobRepo.FindByAgent(ctx, agentID, command.StatusRunning)
        for _, job := range jobs {
            // Reset job to pending for reassignment
            c.jobRepo.ResetToPending(ctx, job.ID)
        }

        // 4. Log event
        c.logger.Info("agent marked offline due to expired lease",
            "agent_id", agentID)
    }

    return nil
}
```

### 3.4 Job State Machine

```
                                    ┌──────────────┐
                                    │   CREATED    │
                                    └──────┬───────┘
                                           │ validate & enqueue
                                           ▼
┌──────────────┐  timeout/cancel   ┌──────────────┐
│   EXPIRED    │◄──────────────────│   PENDING    │
└──────────────┘                   └──────┬───────┘
                                          │ agent polls
                                          ▼
┌──────────────┐  agent offline    ┌──────────────┐
│   PENDING    │◄──────────────────│   ASSIGNED   │
│  (reassign)  │   (recovery)      └──────┬───────┘
└──────────────┘                          │ agent acks
                                          ▼
                                   ┌──────────────┐
                              ┌────│   RUNNING    │────┐
                              │    └──────────────┘    │
                              │           │            │
                     success  │           │ timeout    │ failure
                              ▼           ▼            ▼
                       ┌──────────┐ ┌──────────┐ ┌──────────┐
                       │COMPLETED │ │ TIMEOUT  │ │  FAILED  │
                       └──────────┘ └──────────┘ └──────────┘
```

---

## 4. Platform Agent Design

### 4.1 Agent Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PLATFORM AGENT LIFECYCLE                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. BOOTSTRAP (one-time)                                                 │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ Admin creates bootstrap token:                               │     │
│     │   openctem-admin create token --max-uses=5 --expires=24h     │     │
│     │   → oc-bt-abc123...                                         │     │
│     │                                                              │     │
│     │ Agent starts with token:                                     │     │
│     │   openctem-agent --bootstrap-token=oc-bt-abc123...          │     │
│     │                                                              │     │
│     │ Agent registers:                                             │     │
│     │   POST /api/v1/platform/register                            │     │
│     │   → Returns: agent_id, api_key                               │     │
│     │                                                              │     │
│     │ Agent stores credentials locally                             │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                           │                                              │
│                           ▼                                              │
│  2. RUNNING (continuous)                                                 │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │                                                              │     │
│     │  ┌─────────────────┐    ┌─────────────────┐                 │     │
│     │  │ Heartbeat Loop  │    │ Job Poll Loop   │                 │     │
│     │  │                 │    │                 │                 │     │
│     │  │ Every 30s:      │    │ Long-poll:      │                 │     │
│     │  │ PUT /lease      │    │ POST /poll      │                 │     │
│     │  │ - renew lease   │    │ - timeout=30s   │                 │     │
│     │  │ - report status │    │ - get job       │                 │     │
│     │  │ - metrics       │    │ - execute       │                 │     │
│     │  │                 │    │ - report        │                 │     │
│     │  └─────────────────┘    └─────────────────┘                 │     │
│     │                                                              │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                           │                                              │
│                           ▼                                              │
│  3. SHUTDOWN (graceful)                                                  │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ - Finish current jobs                                        │     │
│     │ - Stop accepting new jobs (drain)                            │     │
│     │ - Release lease                                              │     │
│     │ - Exit                                                       │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Lease-based Heartbeat

```go
// Agent-side: heartbeat loop
func (a *Agent) heartbeatLoop(ctx context.Context) {
    ticker := time.NewTicker(30 * time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            a.releaseLease()
            return
        case <-ticker.C:
            err := a.renewLease(ctx)
            if err != nil {
                a.logger.Error("failed to renew lease", "error", err)
                // Retry or shutdown
            }
        }
    }
}

func (a *Agent) renewLease(ctx context.Context) error {
    return a.client.RenewLease(ctx, &RenewLeaseRequest{
        AgentID:        a.id,
        LeaseDuration:  60, // seconds
        CurrentJobs:    a.runningJobs.Count(),
        MaxJobs:        a.maxConcurrentJobs,
        CPUPercent:     a.metrics.CPU(),
        MemoryPercent:  a.metrics.Memory(),
    })
}
```

### 4.3 Long-Poll Job Assignment

```go
// Server-side: job polling endpoint
func (h *Handler) PollJob(w http.ResponseWriter, r *http.Request) {
    agentID := r.Context().Value("agent_id").(string)
    timeout := parseDuration(r.URL.Query().Get("timeout"), 30*time.Second)

    ctx, cancel := context.WithTimeout(r.Context(), timeout)
    defer cancel()

    // Try to get job immediately
    job, err := h.jobService.AssignNextJob(ctx, agentID)
    if err == nil && job != nil {
        json.NewEncoder(w).Encode(job)
        return
    }

    // No job available, subscribe and wait
    jobChan := h.jobQueue.Subscribe(ctx, agentID)

    select {
    case job := <-jobChan:
        json.NewEncoder(w).Encode(job)
    case <-ctx.Done():
        // Timeout, return 204 No Content
        w.WriteHeader(http.StatusNoContent)
    }
}
```

### 4.4 SDK/Agent Changes Required

Based on analysis of current SDK (`/sdk/`) and Agent (`/agent/`) architecture:

#### Current Architecture Analysis

| Component | Current State | Status |
|-----------|--------------|--------|
| Heartbeat | REST POST every 1m, simple timestamp | ✅ Works, needs lease upgrade |
| Job Polling | GET /agent/commands with limit | ✅ Works, needs long-poll upgrade |
| Authentication | API key (X-API-Key header) | ✅ Works, needs bootstrap support |
| Retry Queue | File-based persistent queue | ✅ Excellent, reuse |
| Docker | Multi-target (slim/full/ci) | ✅ Excellent, reuse |
| gRPC | Implemented but unused | ⏸️ Not needed for platform agents |

#### Changes Required

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     SDK CHANGES REQUIRED                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. NEW: Platform Agent Mode (sdk/pkg/platform/)                         │
│     ┌────────────────────────────────────────────────────────────────┐  │
│     │ // PlatformAgent wraps BaseAgent with platform-specific logic   │  │
│     │ type PlatformAgent struct {                                     │  │
│     │     *core.BaseAgent                                             │  │
│     │     leaseManager   *LeaseManager                                │  │
│     │     jobPoller      *PlatformJobPoller                           │  │
│     │     bootstrapper   *Bootstrapper                                │  │
│     │ }                                                               │  │
│     │                                                                  │  │
│     │ // Mode detection                                                │  │
│     │ func (a *PlatformAgent) IsPlatformMode() bool                   │  │
│     │                                                                  │  │
│     │ // Graceful shutdown with lease release                          │  │
│     │ func (a *PlatformAgent) Shutdown(ctx context.Context) error     │  │
│     └────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  2. NEW: Lease Manager (sdk/pkg/platform/lease.go)                      │
│     ┌────────────────────────────────────────────────────────────────┐  │
│     │ type LeaseManager struct {                                      │  │
│     │     client          *client.Client                              │  │
│     │     agentID         string                                      │  │
│     │     holderIdentity  string  // hostname/container-id            │  │
│     │     leaseDuration   time.Duration                               │  │
│     │     renewInterval   time.Duration  // 30s (< leaseDuration)     │  │
│     │     metrics         *AgentMetrics                               │  │
│     │ }                                                               │  │
│     │                                                                  │  │
│     │ func (m *LeaseManager) Start(ctx context.Context) error         │  │
│     │ func (m *LeaseManager) Renew(ctx context.Context) error         │  │
│     │ func (m *LeaseManager) Release() error                          │  │
│     │ func (m *LeaseManager) OnLeaseLost(callback func())             │  │
│     └────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  3. NEW: Bootstrap Client (sdk/pkg/platform/bootstrap.go)               │
│     ┌────────────────────────────────────────────────────────────────┐  │
│     │ type Bootstrapper struct {                                      │  │
│     │     serverURL       string                                      │  │
│     │     bootstrapToken  string                                      │  │
│     │     credentialStore CredentialStore                             │  │
│     │ }                                                               │  │
│     │                                                                  │  │
│     │ func (b *Bootstrapper) Register(ctx context.Context) (*Creds)   │  │
│     │ func (b *Bootstrapper) LoadCredentials() (*Creds, error)        │  │
│     │ func (b *Bootstrapper) SaveCredentials(creds *Creds) error      │  │
│     │                                                                  │  │
│     │ // Credential storage (file or env)                              │  │
│     │ type CredentialStore interface {                                 │  │
│     │     Load() (*Creds, error)                                      │  │
│     │     Save(creds *Creds) error                                    │  │
│     │     Clear() error                                               │  │
│     │ }                                                               │  │
│     └────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  4. NEW: Platform Job Poller (sdk/pkg/platform/job_poller.go)           │
│     ┌────────────────────────────────────────────────────────────────┐  │
│     │ // Long-poll instead of regular polling                          │  │
│     │ type PlatformJobPoller struct {                                  │  │
│     │     client         *client.Client                               │  │
│     │     capabilities   []string                                     │  │
│     │     maxConcurrent  int                                          │  │
│     │     pollTimeout    time.Duration  // 30s                        │  │
│     │     jobHandler     JobHandler                                   │  │
│     │ }                                                               │  │
│     │                                                                  │  │
│     │ func (p *PlatformJobPoller) Poll(ctx context.Context) (*Job)    │  │
│     │ func (p *PlatformJobPoller) ReportProgress(jobID, progress)     │  │
│     │ func (p *PlatformJobPoller) Complete(jobID, result)             │  │
│     │ func (p *PlatformJobPoller) Fail(jobID, error)                  │  │
│     └────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  5. UPDATE: Client (sdk/pkg/client/client.go)                           │
│     ┌────────────────────────────────────────────────────────────────┐  │
│     │ // Add platform agent endpoints                                  │  │
│     │ func (c *Client) Register(token string) (*RegisterResponse)     │  │
│     │ func (c *Client) RenewLease(req *RenewLeaseRequest) error       │  │
│     │ func (c *Client) ReleaseLease() error                           │  │
│     │ func (c *Client) PollJob(timeout time.Duration) (*Job, error)   │  │
│     │ func (c *Client) ReportJobProgress(jobID, progress int)         │  │
│     │ func (c *Client) CompleteJob(jobID string, result *Result)      │  │
│     │ func (c *Client) FailJob(jobID string, err error)               │  │
│     │                                                                  │  │
│     │ // Job auth token support                                        │  │
│     │ func (c *Client) SetJobToken(token string)                      │  │
│     │ func (c *Client) ClearJobToken()                                │  │
│     └────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Agent Binary Changes

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     AGENT BINARY CHANGES                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. NEW FLAGS:                                                           │
│     ┌────────────────────────────────────────────────────────────────┐  │
│     │ --platform              Enable platform agent mode              │  │
│     │ --bootstrap-token       Bootstrap token for registration       │  │
│     │ --credentials-dir       Where to store credentials (~/.openctem)│  │
│     │ --lease-duration        Lease duration (default: 60s)          │  │
│     │ --holder-identity       Override holder identity (auto-detect) │  │
│     └────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  2. MODE DETECTION:                                                      │
│     ┌────────────────────────────────────────────────────────────────┐  │
│     │ if *platformMode || os.Getenv("OPENCTEM_PLATFORM_AGENT") {      │  │
│     │     // Run as platform agent                                    │  │
│     │     agent := platform.NewPlatformAgent(config)                  │  │
│     │     if err := agent.Bootstrap(ctx); err != nil {               │  │
│     │         log.Fatal("bootstrap failed:", err)                     │  │
│     │     }                                                           │  │
│     │     agent.Run(ctx)                                              │  │
│     │ } else {                                                        │  │
│     │     // Run as tenant agent (existing behavior)                  │  │
│     │     agent := core.NewBaseAgent(config)                          │  │
│     │     agent.Run(ctx)                                              │  │
│     │ }                                                               │  │
│     └────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  3. DOCKER SUPPORT:                                                      │
│     ┌────────────────────────────────────────────────────────────────┐  │
│     │ # Platform agent Docker deployment                              │  │
│     │ docker run -d \                                                 │  │
│     │   --name openctem-platform-agent \                               │  │
│     │   -e OPENCTEM_PLATFORM_AGENT=true \                              │  │
│     │   -e OPENCTEM_API_URL=https://api.openctem.io \                   │  │
│     │   -e OPENCTEM_BOOTSTRAP_TOKEN=oc-bt-xxx... \                    │  │
│     │   -e OPENCTEM_CAPABILITIES=sast,sca,dast \                       │  │
│     │   -e OPENCTEM_REGION=ap-southeast-1 \                            │  │
│     │   -v /var/lib.openctem:/data \                                   │  │
│     │   openctem/agent:latest                                          │  │
│     │                                                                  │  │
│     │ # Credentials are stored in:                                     │  │
│     │ # /data/credentials.json (agent_id, api_key, registered_at)     │  │
│     └────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  4. GRACEFUL SHUTDOWN:                                                   │
│     ┌────────────────────────────────────────────────────────────────┐  │
│     │ // Platform agent handles SIGTERM/SIGINT                         │  │
│     │ func (a *PlatformAgent) handleSignals() {                       │  │
│     │     signals := make(chan os.Signal, 1)                          │  │
│     │     signal.Notify(signals, syscall.SIGTERM, syscall.SIGINT)     │  │
│     │                                                                  │  │
│     │     <-signals                                                    │  │
│     │     log.Info("Shutting down gracefully...")                     │  │
│     │                                                                  │  │
│     │     // 1. Stop accepting new jobs                                │  │
│     │     a.drainMode = true                                          │  │
│     │                                                                  │  │
│     │     // 2. Wait for current jobs (with timeout)                   │  │
│     │     a.waitForJobs(30 * time.Second)                             │  │
│     │                                                                  │  │
│     │     // 3. Release lease                                          │  │
│     │     a.leaseManager.Release()                                    │  │
│     │                                                                  │  │
│     │     // 4. Exit                                                   │  │
│     │     os.Exit(0)                                                  │  │
│     │ }                                                               │  │
│     └────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Backward Compatibility

| Feature | Tenant Agent | Platform Agent |
|---------|--------------|----------------|
| Mode | Default | `--platform` flag |
| Authentication | API key (static) | Bootstrap → API key |
| Heartbeat | POST /agent/heartbeat | PUT /platform/lease |
| Job Polling | GET /agent/commands | POST /platform/poll (long-poll) |
| Job Token | N/A | Per-job auth token |
| Credentials | Config file | Auto-registered, stored locally |
| Graceful Shutdown | Send final heartbeat | Release lease + drain jobs |

**Key Principle**: Existing tenant agents work unchanged. Platform mode is opt-in.

---

## 5. Admin CLI (kubectl-style)

### 5.0 Docker Deployment Considerations

When platform runs in Docker, admin CLI needs to be designed for flexible operation:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ADMIN CLI DEPLOYMENT OPTIONS                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Option A: CLI Outside Docker (Recommended for Ops)                      │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                                                                    │   │
│  │   Operator Machine                    Docker Host                  │   │
│  │  ┌──────────────────┐              ┌─────────────────────────┐   │   │
│  │  │ openctem-admin    │──HTTPS:443──▶│ Platform API Container  │   │   │
│  │  │ ~/.openctem/      │              │ :8080                   │   │   │
│  │  │   config.yaml    │              └─────────────────────────┘   │   │
│  │  └──────────────────┘                                            │   │
│  │                                                                    │   │
│  │   ✓ Best for daily operations                                     │   │
│  │   ✓ Uses contexts/profiles for multi-environment                  │   │
│  │   ✓ Shell completion, history                                     │   │
│  │                                                                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Option B: CLI Inside API Container (docker exec)                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                                                                    │   │
│  │   $ docker exec -it openctem-api openctem-admin get agents          │   │
│  │                                                                    │   │
│  │   ✓ No port exposure needed for admin                             │   │
│  │   ✓ Good for quick troubleshooting                                │   │
│  │   ✓ Uses same binary as server                                    │   │
│  │   ✗ No shell history/completion                                   │   │
│  │                                                                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Option C: Sidecar CLI Container (docker-compose)                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                                                                    │   │
│  │   services:                                                        │   │
│  │     api:                                                           │   │
│  │       image: openctem/platform:latest                               │   │
│  │       networks: [internal]                                         │   │
│  │                                                                    │   │
│  │     admin-cli:                                                     │   │
│  │       image: openctem/admin-cli:latest                              │   │
│  │       environment:                                                 │   │
│  │         - OPENCTEM_API_URL=http://api:8080                          │   │
│  │         - OPENCTEM_API_KEY_FILE=/run/secrets/admin_key              │   │
│  │       networks: [internal]                                         │   │
│  │       stdin_open: true                                             │   │
│  │       tty: true                                                    │   │
│  │                                                                    │   │
│  │   $ docker-compose exec admin-cli openctem-admin get agents         │   │
│  │                                                                    │   │
│  │   ✓ Isolated CLI environment                                       │   │
│  │   ✓ Can have different config per environment                     │   │
│  │   ✓ Secrets management via Docker secrets                          │   │
│  │                                                                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Option D: Kubernetes (kubectl plugin style)                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                                                                    │   │
│  │   # Install as kubectl plugin                                      │   │
│  │   $ kubectl krew install.openctem                                   │   │
│  │   $ kubectl.openctem get agents                                     │   │
│  │                                                                    │   │
│  │   # Or run as Job                                                  │   │
│  │   $ kubectl run admin-task --rm -it --image=openctem/admin-cli \    │   │
│  │       -- openctem-admin get agents                                  │   │
│  │                                                                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Configuration Priority (kubectl-style)

```yaml
# Priority order (highest to lowest):
# 1. Command line flags: --api-url, --api-key
# 2. Environment variables: OPENCTEM_API_URL, OPENCTEM_API_KEY
# 3. Config file: ~/.openctem/config.yaml (or /etc/openctem/config.yaml in container)
# 4. In-cluster detection (for sidecar mode)

# Example: ~/.openctem/config.yaml
apiVersion: admin.openctem.io/v1
kind: Config
current-context: production

contexts:
  - name: production
    context:
      api-url: https://api.openctem.io
      api-key-file: ~/.openctem/prod-key  # Store key separately

  - name: staging
    context:
      api-url: https://api.staging.openctem.io
      api-key-file: ~/.openctem/staging-key

  - name: local-docker
    context:
      api-url: http://localhost:8080
      # No api-key for local dev, uses OPENCTEM_API_KEY env var
```

#### Docker-Compose Full Example

```yaml
# docker-compose.admin.yaml
version: '3.8'

services:
  # Main API service
  api:
    image: openctem/platform:latest
    ports:
      - "8080:8080"          # Main API (tenant)
      - "8081:8081"          # Admin API (restricted)
    environment:
      - DATABASE_URL=postgres://...
      - REDIS_URL=redis://redis:6379
      - ADMIN_API_ENABLED=true
    networks:
      - internal
      - external
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Admin CLI sidecar (optional)
  admin:
    image: openctem/admin-cli:latest
    environment:
      - OPENCTEM_API_URL=http://api:8081
      - OPENCTEM_API_KEY=${ADMIN_API_KEY}
    networks:
      - internal
    profiles:
      - admin  # Only start with: docker-compose --profile admin up
    stdin_open: true
    tty: true
    depends_on:
      api:
        condition: service_healthy

networks:
  internal:
    internal: true  # Not exposed to host
  external:
```

#### In-Container Detection

```go
// pkg/admincli/config.go
func detectInCluster() bool {
    // Check if running inside Docker/K8s
    _, err := os.Stat("/var/run/secrets/kubernetes.io/serviceaccount/token")
    if err == nil {
        return true // K8s pod
    }

    // Check Docker
    _, err = os.Stat("/.dockerenv")
    if err == nil {
        return true // Docker container
    }

    return false
}

func defaultAPIURL() string {
    if url := os.Getenv("OPENCTEM_API_URL"); url != "" {
        return url
    }

    if detectInCluster() {
        // Default for in-cluster: use service name
        return "http://api:8081"
    }

    // Default for local dev
    return "http://localhost:8080"
}
```

### 5.1 Command Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  COMMAND PATTERN: openctem-admin <verb> <resource> [name] [flags]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Verbs:                                                              │
│    get      - List or retrieve resources                            │
│    describe - Show detailed information                             │
│    create   - Create new resource                                   │
│    apply    - Create or update from file                            │
│    delete   - Remove resource                                       │
│    edit     - Edit resource in editor                               │
│    logs     - View resource logs                                    │
│                                                                      │
│  Resources:                                                          │
│    agent (ag)   - Platform agents                                   │
│    token (tok)  - Bootstrap tokens                                  │
│    job          - Platform jobs                                     │
│    admin        - Admin users                                       │
│    audit        - Audit logs                                        │
│                                                                      │
│  Global Flags:                                                       │
│    -o, --output    Output format (json|yaml|wide|name)             │
│    -w, --watch     Watch for changes                                │
│    -c, --context   Use specific context                             │
│    --dry-run       Validate without applying                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Command Examples

```bash
# ═══════════════════════════════════════════════════════════════════
# CONFIG MANAGEMENT
# ═══════════════════════════════════════════════════════════════════

# Setup contexts
openctem-admin config set-context prod --api-url=https://api.openctem.io
openctem-admin config set-context staging --api-url=https://api.staging.openctem.io
openctem-admin config use-context prod
openctem-admin config current-context
openctem-admin config get-contexts

# ═══════════════════════════════════════════════════════════════════
# AGENT MANAGEMENT
# ═══════════════════════════════════════════════════════════════════

# List & Get
openctem-admin get agents                     # List all
openctem-admin get agents -o wide             # Extended info
openctem-admin get agents -o json             # JSON output
openctem-admin get agents --status=online     # Filter
openctem-admin get agent agent-us-e1          # Get by name
openctem-admin describe agent agent-us-e1     # Detailed view

# Create
openctem-admin create agent \
  --name=agent-us-east-1 \
  --region=us-east-1 \
  --capabilities=sast,sca \
  --max-jobs=10

# Or from file
openctem-admin apply -f agent.yaml

# Operations
openctem-admin drain agent agent-us-e1        # Stop new jobs
openctem-admin uncordon agent agent-us-e1     # Resume
openctem-admin delete agent agent-us-e1

# Watch
openctem-admin get agents -w                  # Real-time updates

# ═══════════════════════════════════════════════════════════════════
# TOKEN MANAGEMENT
# ═══════════════════════════════════════════════════════════════════

openctem-admin get tokens
openctem-admin create token --max-uses=5 --expires=24h
openctem-admin revoke token tok-abc123 --reason="Compromised"

# ═══════════════════════════════════════════════════════════════════
# JOB MANAGEMENT
# ═══════════════════════════════════════════════════════════════════

openctem-admin get jobs --status=pending
openctem-admin describe job job-xyz
openctem-admin logs job job-xyz -f            # Follow logs
openctem-admin delete job job-xyz             # Cancel

# ═══════════════════════════════════════════════════════════════════
# ADMIN MANAGEMENT (super_admin only)
# ═══════════════════════════════════════════════════════════════════

openctem-admin get admins
openctem-admin create admin --email=ops@openctem.io --role=ops_admin
openctem-admin rotate-key admin admin-xyz

# ═══════════════════════════════════════════════════════════════════
# SYSTEM STATUS
# ═══════════════════════════════════════════════════════════════════

openctem-admin cluster-info                   # Overview
openctem-admin top agents                     # Resource usage
openctem-admin top jobs                       # Queue stats
openctem-admin api-resources                  # List resources
openctem-admin explain agent                  # Schema help
```

### 5.3 YAML Configuration Format

```yaml
# agent.yaml
apiVersion: admin.openctem.io/v1
kind: Agent
metadata:
  name: agent-us-east-1
  labels:
    environment: production
    team: security
spec:
  region: us-east-1
  capabilities:
    - sast
    - sca
    - secrets
  tools:
    - semgrep
    - trivy
    - gitleaks
  maxConcurrentJobs: 10
  config:
    scanTimeout: 30m
---
# token.yaml
apiVersion: admin.openctem.io/v1
kind: BootstrapToken
metadata:
  name: prod-deploy-token
spec:
  maxUses: 10
  expiresIn: 24h
  requiredCapabilities:
    - sast
```

### 5.4 Admin Web UI (Separate Project)

**Decision: Create Separate `admin-ui` Project**

To ensure complete separation of permissions and reduce management complexity, Admin UI will be a separate project.

#### Rationale

```
┌─────────────────────────────────────────────────────────────────────────┐
│                ADMIN WEB UI: SEPARATE PROJECT APPROACH                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  KEY BENEFITS OF SEPARATION:                                             │
│                                                                          │
│  1. PERMISSION ISOLATION                                                 │
│     ┌──────────────────────────────────────────────────────────────┐   │
│     │ ✓ No risk of tenant permission logic leaking to admin routes  │   │
│     │ ✓ Simpler auth model - just API key, no JWT/OAuth complexity │   │
│     │ ✓ No conditional permission checks based on user type        │   │
│     │ ✓ Clear boundary: admin-ui → Admin API only                   │   │
│     └──────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  2. INDEPENDENT DEPLOYMENT                                               │
│     ┌──────────────────────────────────────────────────────────────┐   │
│     │ ✓ Can deploy admin-ui to internal network only               │   │
│     │ ✓ Different scaling requirements than tenant UI              │   │
│     │ ✓ Can update admin features without touching tenant UI       │   │
│     │ ✓ Smaller attack surface (not exposed to public)              │   │
│     └──────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  3. SIMPLER CODEBASE                                                     │
│     ┌──────────────────────────────────────────────────────────────┐   │
│     │ ✓ No "if admin" / "if tenant" conditionals                    │   │
│     │ ✓ No shared state between two different user types           │   │
│     │ ✓ Easier to reason about, easier to maintain                  │   │
│     │ ✓ Different tech choices if needed (simpler stack)            │   │
│     └──────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  4. SECURITY MODEL                                                       │
│     ┌──────────────────────────────────────────────────────────────┐   │
│     │ ✓ Stricter CSP headers                                        │   │
│     │ ✓ IP allowlist for admin access                               │   │
│     │ ✓ VPN-only access possible                                    │   │
│     │ ✓ No third-party integrations needed                           │   │
│     └──────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  TRADE-OFFS (Acceptable):                                                │
│  ─────────────────────────────────────────────────────────────────────│
│  • Code duplication of basic components → Use shared UI library        │
│  • Two builds to maintain → Minimal overhead (admin UI is small)       │
│  • Two deployments → Can share Docker compose / K8s namespace          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Project Structure (Feature-Based, Inspired by ui/)

```
openctemio/
├── ui/                              # Tenant UI (existing - unchanged)
│
├── admin-ui/                        # NEW: Separate Admin UI project
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── postcss.config.js
│   ├── components.json             # shadcn/ui config
│   ├── Dockerfile
│   │
│   ├── public/
│   │   ├── favicon.ico
│   │   └── logo.svg
│   │
│   └── src/
│       │
│       ├── app/                     # Next.js App Router
│       │   ├── layout.tsx           # Root layout (providers, fonts)
│       │   ├── loading.tsx          # Global loading
│       │   ├── error.tsx            # Global error boundary
│       │   ├── not-found.tsx        # 404 page
│       │   │
│       │   ├── (auth)/              # Auth routes (public)
│       │   │   ├── layout.tsx       # Auth layout (centered, minimal)
│       │   │   └── login/
│       │   │       └── page.tsx     # Login page
│       │   │
│       │   ├── (dashboard)/         # Dashboard routes (protected)
│       │   │   ├── layout.tsx       # Dashboard layout (sidebar + content)
│       │   │   ├── page.tsx         # Overview/home dashboard
│       │   │   │
│       │   │   ├── agents/
│       │   │   │   ├── page.tsx                    # List agents
│       │   │   │   ├── loading.tsx
│       │   │   │   └── [id]/
│       │   │   │       ├── page.tsx                # Agent details
│       │   │   │       └── loading.tsx
│       │   │   │
│       │   │   ├── jobs/
│       │   │   │   ├── page.tsx                    # Job queue
│       │   │   │   └── [id]/
│       │   │   │       └── page.tsx                # Job details
│       │   │   │
│       │   │   ├── tokens/
│       │   │   │   └── page.tsx                    # Bootstrap tokens
│       │   │   │
│       │   │   ├── admins/
│       │   │   │   └── page.tsx                    # Admin users (super_admin only)
│       │   │   │
│       │   │   ├── audit/
│       │   │   │   └── page.tsx                    # Audit logs
│       │   │   │
│       │   │   └── settings/
│       │   │       └── page.tsx                    # System settings
│       │   │
│       │   └── api/                 # API routes (proxy to backend)
│       │       ├── health/route.ts  # Health check
│       │       └── admin/
│       │           └── [...path]/route.ts  # Proxy all admin API calls
│       │
│       ├── features/                # Feature-based organization
│       │   │
│       │   ├── agents/              # Platform agents feature
│       │   │   ├── components/
│       │   │   │   ├── agent-list.tsx
│       │   │   │   ├── agent-card.tsx
│       │   │   │   ├── agent-status-badge.tsx
│       │   │   │   ├── agent-details-panel.tsx
│       │   │   │   ├── agent-metrics-chart.tsx
│       │   │   │   ├── create-agent-dialog.tsx
│       │   │   │   └── drain-agent-dialog.tsx
│       │   │   ├── hooks/
│       │   │   │   ├── use-agents.ts
│       │   │   │   ├── use-agent.ts
│       │   │   │   └── use-agent-metrics.ts
│       │   │   ├── types/
│       │   │   │   └── index.ts
│       │   │   ├── schemas/
│       │   │   │   └── agent-schemas.ts
│       │   │   └── lib/
│       │   │       └── agent-utils.ts
│       │   │
│       │   ├── jobs/                # Platform jobs feature
│       │   │   ├── components/
│       │   │   │   ├── job-queue-table.tsx
│       │   │   │   ├── job-status-badge.tsx
│       │   │   │   ├── job-details-panel.tsx
│       │   │   │   ├── job-logs-viewer.tsx
│       │   │   │   ├── job-timeline.tsx
│       │   │   │   └── retry-job-dialog.tsx
│       │   │   ├── hooks/
│       │   │   │   ├── use-jobs.ts
│       │   │   │   ├── use-job.ts
│       │   │   │   └── use-job-logs.ts
│       │   │   ├── types/
│       │   │   │   └── index.ts
│       │   │   └── schemas/
│       │   │       └── job-schemas.ts
│       │   │
│       │   ├── tokens/              # Bootstrap tokens feature
│       │   │   ├── components/
│       │   │   │   ├── token-list.tsx
│       │   │   │   ├── create-token-dialog.tsx
│       │   │   │   └── revoke-token-dialog.tsx
│       │   │   ├── hooks/
│       │   │   │   └── use-tokens.ts
│       │   │   ├── types/
│       │   │   │   └── index.ts
│       │   │   └── schemas/
│       │   │       └── token-schemas.ts
│       │   │
│       │   ├── admins/              # Admin users feature
│       │   │   ├── components/
│       │   │   │   ├── admin-list.tsx
│       │   │   │   ├── create-admin-dialog.tsx
│       │   │   │   └── rotate-key-dialog.tsx
│       │   │   ├── hooks/
│       │   │   │   └── use-admins.ts
│       │   │   ├── types/
│       │   │   │   └── index.ts
│       │   │   └── schemas/
│       │   │       └── admin-schemas.ts
│       │   │
│       │   ├── audit/               # Audit logs feature
│       │   │   ├── components/
│       │   │   │   ├── audit-log-table.tsx
│       │   │   │   ├── audit-filters.tsx
│       │   │   │   └── audit-detail-drawer.tsx
│       │   │   ├── hooks/
│       │   │   │   └── use-audit-logs.ts
│       │   │   └── types/
│       │   │       └── index.ts
│       │   │
│       │   └── auth/                # Authentication feature
│       │       ├── components/
│       │       │   ├── login-form.tsx
│       │       │   └── logout-button.tsx
│       │       ├── hooks/
│       │       │   └── use-auth.ts
│       │       └── lib/
│       │           └── auth-utils.ts
│       │
│       ├── components/              # Shared components
│       │   ├── ui/                  # shadcn/ui components
│       │   │   ├── button.tsx
│       │   │   ├── card.tsx
│       │   │   ├── dialog.tsx
│       │   │   ├── dropdown-menu.tsx
│       │   │   ├── input.tsx
│       │   │   ├── table.tsx
│       │   │   ├── badge.tsx
│       │   │   ├── skeleton.tsx
│       │   │   ├── toast.tsx
│       │   │   └── ...
│       │   │
│       │   ├── layout/              # Layout components
│       │   │   ├── sidebar.tsx
│       │   │   ├── sidebar-nav.tsx
│       │   │   ├── header.tsx
│       │   │   ├── user-nav.tsx
│       │   │   ├── breadcrumbs.tsx
│       │   │   └── page-header.tsx
│       │   │
│       │   └── shared/              # Shared non-UI components
│       │       ├── data-table/      # Reusable data table
│       │       │   ├── data-table.tsx
│       │       │   ├── pagination.tsx
│       │       │   └── column-header.tsx
│       │       ├── charts/
│       │       │   ├── area-chart.tsx
│       │       │   ├── bar-chart.tsx
│       │       │   └── stat-card.tsx
│       │       ├── empty-state.tsx
│       │       ├── loading-state.tsx
│       │       └── error-boundary.tsx
│       │
│       ├── lib/                     # Core utilities
│       │   ├── api/
│       │   │   ├── client.ts        # API client with auth
│       │   │   ├── endpoints.ts     # Admin API endpoints
│       │   │   └── types.ts         # API response types
│       │   │
│       │   ├── auth/
│       │   │   ├── store.ts         # Zustand auth store
│       │   │   └── middleware.ts    # Next.js middleware
│       │   │
│       │   ├── hooks/
│       │   │   ├── use-debounce.ts
│       │   │   └── use-local-storage.ts
│       │   │
│       │   ├── utils/
│       │   │   ├── cn.ts            # classnames utility
│       │   │   ├── date.ts          # Date formatting
│       │   │   └── format.ts        # Number/string formatting
│       │   │
│       │   └── constants.ts         # App constants
│       │
│       ├── config/                  # Configuration
│       │   ├── sidebar.ts           # Sidebar navigation config
│       │   └── routes.ts            # Route constants
│       │
│       ├── stores/                  # Zustand stores
│       │   └── auth-store.ts        # Auth state
│       │
│       ├── context/                 # React contexts
│       │   └── theme-provider.tsx   # Dark/light theme
│       │
│       └── types/                   # Global types
│           └── index.ts
│
└── packages/                        # OPTIONAL: Shared packages (future)
    └── ui-kit/                      # If we need to share components
        └── ...
```

#### Feature Module Pattern (Same as ui/)

```typescript
// features/agents/index.ts - Public API
export * from './components/agent-list';
export * from './components/agent-card';
export * from './hooks/use-agents';
export * from './types';

// Usage in page
import { AgentList, useAgents } from '@/features/agents';
```

#### Key Patterns from ui/ to Follow

| Pattern | Description | Example |
|---------|-------------|---------|
| **Feature-based** | Group by domain, not by type | `/features/agents/{components,hooks,types}` |
| **Colocation** | Keep related files together | Hooks next to components that use them |
| **Index exports** | Clean public API per feature | `export * from './component'` |
| **Hooks for data** | SWR/TanStack Query in hooks | `useAgents()` returns `{ data, isLoading }` |
| **Schemas with Zod** | Validation at boundaries | `/features/agents/schemas/` |
| **Type safety** | Strong typing everywhere | `/features/agents/types/index.ts` |

#### Technology Stack (Same as Tenant UI)

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Framework | **Next.js 16+** (App Router) | Same as tenant UI |
| React | **React 19** | Latest features |
| Styling | **Tailwind CSS v4** + shadcn/ui | Consistent with tenant UI |
| State | Zustand (minimal) | Simple auth state only |
| Data Fetching | SWR | Simple and effective |
| Auth | API Key (cookie-based) | No OAuth needed |
| Charts | Recharts | Metrics visualization |
| Tables | TanStack Table | Agent/job lists |
| Forms | react-hook-form + Zod | Validation |
| Package Manager | pnpm | Same as tenant UI |

#### Authentication Flow (Simplified)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  ADMIN UI AUTHENTICATION (SIMPLIFIED)                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  STEP 1: LOGIN                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                                                                      │ │
│  │  ┌──────────────────────────────────────────────────────────┐      │ │
│  │  │           Platform Admin Console                          │      │ │
│  │  │                                                           │      │ │
│  │  │   Email:    [admin@openctem.io            ]               │      │ │
│  │  │   API Key:  [oc-admin-xxxxxxxxxxxxxx    ]               │      │ │
│  │  │                                                           │      │ │
│  │  │             [Sign In]                                     │      │ │
│  │  └──────────────────────────────────────────────────────────┘      │ │
│  │                                                                      │ │
│  │  POST /api/v1/admin/auth/login                                      │ │
│  │  { "email": "...", "api_key": "oc-admin-xxx" }                     │ │
│  │  → { "token": "jwt...", "admin": {...}, "expires_at": "..." }      │ │
│  │                                                                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                           │                                              │
│                           ▼                                              │
│  STEP 2: SESSION STORAGE                                                 │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  • JWT stored in HttpOnly cookie (same-site strict)                 │ │
│  │  • Session duration: 8 hours (no refresh - security policy)         │ │
│  │  • Zustand stores admin info (email, role) for UI                   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                           │                                              │
│                           ▼                                              │
│  STEP 3: API REQUESTS                                                    │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  // Next.js proxy route: /api/admin/[...path]/route.ts              │ │
│  │  export async function GET(req) {                                   │ │
│  │    const token = cookies().get('admin_token');                      │ │
│  │    return fetch(ADMIN_API_URL + path, {                             │ │
│  │      headers: { Authorization: `Bearer ${token}` }                  │ │
│  │    });                                                              │ │
│  │  }                                                                  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  STEP 4: LOGOUT                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  • Clear cookie                                                     │ │
│  │  • Clear Zustand state                                              │ │
│  │  • Redirect to /login                                               │ │
│  │  • (Server: log logout event in audit log)                          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Deployment Options

```yaml
# docker-compose.admin.yaml
version: '3.8'

services:
  # Admin UI - Internal only
  admin-ui:
    image: openctem/admin-ui:latest
    build:
      context: ./admin-ui
      dockerfile: Dockerfile
    ports:
      - "3001:3000"           # Different port from tenant UI
    environment:
      - ADMIN_API_URL=http://api:8080/api/v1/admin
      - NEXT_PUBLIC_APP_NAME=OpenCTEM Admin
    networks:
      - internal
    # Security: Only accessible from internal network
    # Can add IP allowlist at nginx/load balancer level

  # Tenant UI - Public
  ui:
    image: openctem/ui:latest
    ports:
      - "3000:3000"
    networks:
      - internal
      - external

  # API
  api:
    image: openctem/api:latest
    ports:
      - "8080:8080"
    networks:
      - internal
      - external

networks:
  internal:
    internal: true
  external:
```

#### Shared UI Components Strategy

Option 1: **Copy common components** (simpler)
- Copy shadcn/ui components to admin-ui
- Independent versioning, no coupling

Option 2: **Create shared package** (cleaner, more work)
```json
// packages/ui-kit/package.json
{
  "name": "@openctem/ui-kit",
  "version": "1.0.0",
  "exports": {
    "./button": "./src/button.tsx",
    "./table": "./src/table.tsx"
  }
}

// admin-ui/package.json
{
  "dependencies": {
    "@openctem/ui-kit": "workspace:*"
  }
}
```

**Recommendation**: Start with Option 1 (copy), refactor to Option 2 later if needed.

#### Key UI Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PLATFORM ADMIN DASHBOARD                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌──────────────────────────────────────────────────┐ │
│  │ Navigation   │  │                                                   │ │
│  │              │  │  Platform Overview                                │ │
│  │ ┌──────────┐ │  │  ─────────────────                                │ │
│  │ │ Overview │ │  │                                                   │ │
│  │ └──────────┘ │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │ │
│  │ ┌──────────┐ │  │  │ Agents  │ │  Jobs   │ │ Tenants │ │ Tokens  │ │ │
│  │ │ Agents   │ │  │  │  24     │ │  156    │ │   89    │ │   12    │ │ │
│  │ └──────────┘ │  │  │ online  │ │ pending │ │ active  │ │ active  │ │ │
│  │ ┌──────────┐ │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ │ │
│  │ │ Jobs     │ │  │                                                   │ │
│  │ └──────────┘ │  │  Agent Pool Health                                │ │
│  │ ┌──────────┐ │  │  ┌─────────────────────────────────────────────┐ │ │
│  │ │ Tokens   │ │  │  │ ████████████████████░░░░░ 85% capacity      │ │ │
│  │ └──────────┘ │  │  │ 24/28 agents online | 156 jobs in queue     │ │ │
│  │ ┌──────────┐ │  │  └─────────────────────────────────────────────┘ │ │
│  │ │ Admins   │ │  │                                                   │ │
│  │ └──────────┘ │  │  Recent Activity                                  │ │
│  │ ┌──────────┐ │  │  ┌─────────────────────────────────────────────┐ │ │
│  │ │ Audit    │ │  │  │ 10:32 Agent agent-us-e1 went offline        │ │ │
│  │ └──────────┘ │  │  │ 10:30 Job scan-123 completed                 │ │ │
│  │              │  │  │ 10:28 Token tok-abc expired                  │ │ │
│  │ ──────────── │  │  │ 10:25 Admin john@openctem.io logged in        │ │ │
│  │ Settings     │  │  └─────────────────────────────────────────────┘ │ │
│  │              │  │                                                   │ │
│  └──────────────┘  └──────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Pages to Implement

| Page | Route | Features |
|------|-------|----------|
| Dashboard | `/admin` | Overview stats, agent health, recent activity |
| Agents List | `/admin/agents` | Table with status, capabilities, region, actions |
| Agent Details | `/admin/agents/[id]` | Metrics, jobs history, logs, configuration |
| Jobs Queue | `/admin/jobs` | Queue table, filters, bulk actions |
| Job Details | `/admin/jobs/[id]` | Status, logs, timeline, retry options |
| Tokens | `/admin/tokens` | Create, list, revoke tokens |
| Admins | `/admin/admins` | Manage admin users (super_admin only) |
| Audit Logs | `/admin/audit` | Searchable audit log viewer |
| Settings | `/admin/settings` | System configuration |

#### Reusable Components from Existing UI

| Component | Reuse % | Notes |
|-----------|---------|-------|
| shadcn/ui library | 100% | All components directly usable |
| Data tables | 90% | Extend for admin-specific columns |
| Forms/validation | 100% | Zod schemas, react-hook-form |
| Charts (Recharts) | 100% | For metrics visualization |
| Layout components | 80% | Adapt sidebar for admin navigation |
| Theme system | 100% | Same dark/light mode |
| Permission gates | 70% | Extend for platform permissions |

---

## 6. Security & Compliance

### 6.1 Authentication Matrix

| Actor | Method | Token Type | Validation |
|-------|--------|------------|------------|
| Tenant User | JWT | Access Token | Keycloak |
| Admin User | API Key | `oc-admin-xxx` | Hash lookup |
| Platform Agent | API Key + Lease | `oc-agent-xxx` | Hash + Lease valid |
| Bootstrap Agent | Token | `oc-bt-xxx` | Hash + Not expired + Uses left |

### 6.2 Authorization (RBAC)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ADMIN ROLES & PERMISSIONS                         │
├──────────────┬──────────────────────────────────────────────────────┤
│ Role         │ Permissions                                          │
├──────────────┼──────────────────────────────────────────────────────┤
│ super_admin  │ ALL (including admin user management)                │
├──────────────┼──────────────────────────────────────────────────────┤
│ ops_admin    │ agents: CRUD                                         │
│              │ tokens: CRUD                                         │
│              │ jobs: Read, Cancel                                   │
│              │ audit: Read                                          │
│              │ admins: Read (self only)                             │
├──────────────┼──────────────────────────────────────────────────────┤
│ readonly     │ agents: Read                                         │
│              │ tokens: Read                                         │
│              │ jobs: Read                                           │
│              │ audit: Read                                          │
└──────────────┴──────────────────────────────────────────────────────┘
```

### 6.3 Audit Logging

**Every admin action is logged:**

```json
{
  "id": "uuid",
  "timestamp": "2026-01-25T10:30:00Z",
  "admin_id": "uuid",
  "admin_email": "ops@openctem.io",
  "action": "agent.create",
  "resource_type": "agent",
  "resource_id": "uuid",
  "request": {
    "method": "POST",
    "path": "/admin/agents",
    "body": { "name": "agent-1", "region": "us-east-1" }
  },
  "response": {
    "status": 201
  },
  "ip_address": "1.2.3.4",
  "user_agent": "openctem-admin/1.0"
}
```

### 6.4 Security Best Practices

| Category | Implementation |
|----------|----------------|
| **API Keys** | SHA-256 hashed, 32-byte random, prefix for identification |
| **Secrets** | Never logged, masked in audit, encrypted at rest |
| **Transport** | TLS 1.3 required, HSTS enabled |
| **Rate Limiting** | 100 req/min per admin, 1000 req/min per agent |
| **Input Validation** | All inputs validated, parameterized queries |
| **Audit Retention** | 90 days default, immutable logs |

---

## 7. Database Schema

### 7.1 New Tables (Migration 000082-083)

```sql
-- ═══════════════════════════════════════════════════════════════════
-- ADMIN USERS
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,

    -- Authentication
    api_key_hash VARCHAR(64) NOT NULL,
    api_key_prefix VARCHAR(12) NOT NULL,

    -- Authorization
    role VARCHAR(50) NOT NULL DEFAULT 'readonly'
        CHECK (role IN ('super_admin', 'ops_admin', 'readonly')),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Tracking
    last_used_at TIMESTAMPTZ,
    last_used_ip INET,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES admin_users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- ADMIN AUDIT LOGS
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Who
    admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    admin_email VARCHAR(255) NOT NULL,

    -- What
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,

    -- Request details (sanitized)
    request_method VARCHAR(10),
    request_path TEXT,
    request_body JSONB,
    response_status INT,

    -- Context
    ip_address INET,
    user_agent TEXT,

    -- Result
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partition by month for performance
-- CREATE TABLE admin_audit_logs_2026_01 PARTITION OF admin_audit_logs
--     FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- ═══════════════════════════════════════════════════════════════════
-- AGENT LEASES (K8s-style)
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE agent_leases (
    agent_id UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,

    -- Lease holder
    holder_identity VARCHAR(255) NOT NULL,

    -- Lease timing
    lease_duration_seconds INT NOT NULL DEFAULT 60,
    acquire_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    renew_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Agent status at lease renewal
    current_jobs INT DEFAULT 0,
    max_jobs INT DEFAULT 5,
    cpu_percent DECIMAL(5,2),
    memory_percent DECIMAL(5,2)
);

CREATE INDEX idx_agent_leases_expiry
    ON agent_leases(renew_time);
```

### 7.2 Existing Tables Updates (Already Done)

- `agents.is_platform_agent` - Boolean flag
- `agents.tenant_id` - Made nullable with constraint
- `commands` - Platform job fields (queue_priority, auth_token, etc.)
- `platform_agent_bootstrap_tokens` - Bootstrap token table
- `platform_agent_registrations` - Registration audit

---

## 8. Implementation Phases

### Phase 0: Database & Foundation (Week 1) ✅ COMPLETED

| # | Task | Priority | Status |
|---|------|----------|--------|
| 0.1 | Create migration 000082 (admin_users, audit_logs) | P0 | ✅ Done |
| 0.2 | Create migration 000083 (agent_leases) | P0 | ✅ Done |
| 0.3 | Create AdminUser domain entity | P0 | ✅ Done |
| 0.4 | Create AdminUserRepository | P0 | ✅ Done |
| 0.5 | Create admin auth middleware | P0 | ✅ Done |
| 0.6 | Create audit logging middleware | P0 | ✅ Done |
| 0.7 | Create Lease domain entity | P0 | ✅ Done |
| 0.8 | Create LeaseRepository | P0 | ✅ Done |

**Phase 0 Implementation Notes:**
- AdminUser entity: `api/internal/domain/admin/entity.go` - Uses private fields with getters for security
- AdminUser repository: `api/internal/infra/postgres/admin_repository.go` - Includes 2-step API key auth (prefix lookup + hash verify)
- Audit logs: `api/internal/domain/admin/audit.go` - Immutable append-only logs with sensitive field redaction
- Admin auth middleware: `api/internal/infra/http/middleware/admin_auth.go` - API key auth with role/permission checks
- **Security hardened IP extraction**: Uses RemoteAddr (TCP-level) by default, optional trusted proxy support with CIDR validation
- Audit middleware: `api/internal/infra/http/middleware/admin_audit.go` - Async audit logging with response capture
- Lease entity: `api/internal/domain/lease/entity.go` - K8s-style agent health tracking with resource version
- Lease repository: `api/internal/infra/postgres/lease_repository.go` - Uses database functions for atomic operations

### Phase 1: Controller Workers (Week 2) ✅ COMPLETED

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1.1 | Create Controller interface & manager | P0 | ✅ Done |
| 1.2 | Implement AgentHealthController | P0 | ✅ Done |
| 1.3 | Implement JobRecoveryController | P0 | ✅ Done |
| 1.4 | Implement QueuePriorityController | P1 | ✅ Done |
| 1.5 | Implement TokenCleanupController | P2 | ✅ Done |
| 1.6 | Implement AuditRetentionController | P2 | ✅ Done |
| 1.7 | Add controller Prometheus metrics | P1 | ✅ Done |

**Phase 1 Implementation Notes:**
- Created `api/internal/infra/controller/` package with K8s-style reconciliation loop controllers
- Controller interface with Name(), Interval(), Reconcile() methods
- Manager runs multiple controllers in parallel goroutines with graceful shutdown
- **AgentHealthController**: Marks stale agents as offline using MarkStaleAsOffline, finds expired leases
- **JobRecoveryController**: Recovers stuck jobs, expires old platform jobs, expires old commands
- **QueuePriorityController**: Recalculates queue priorities for fair scheduling across tenants
- **TokenCleanupController**: Cleans up expired bootstrap tokens with configurable retention
- **AuditRetentionController**: Deletes old audit logs based on retention policy (default 365 days)
- PrometheusMetrics for controller observability (reconcile count, errors, duration, items processed)
- Added `NewNop()` to logger package for no-op logging in tests
- Added `DeleteOlderThan()` and `CountOlderThan()` to AuditLogRepository interface

### Phase 2: Agent Communication & Lease (Week 3) - COMPLETED

| # | Task | Priority | Status |
|---|------|----------|--------|
| 2.1 | Create Lease service | P0 | ✅ Done |
| 2.2 | Implement PUT /platform/lease endpoint | P0 | ✅ Done |
| 2.3 | Implement POST /platform/poll long-poll endpoint | P0 | ✅ Done |
| 2.4 | Implement POST /platform/register endpoint | P0 | ✅ Done |
| 2.5 | Add Redis pub/sub for job notification | P1 | [ ] Deferred |
| 2.6 | Create platform agent authentication middleware | P0 | ✅ Done |

**Phase 2 Implementation Notes:**
- Created `api/internal/app/lease_service.go` - LeaseService for K8s-style lease management
- Created `api/internal/infra/http/middleware/platform_auth.go` - PlatformAgentAuth middleware
  - Authenticates using X-Agent-ID header and Bearer token
  - Verifies agent is a platform agent and is active
  - Uses constant-time comparison to prevent timing attacks
- Created `api/internal/infra/http/handler/platform_handler.go` - PlatformHandler
  - PUT /api/v1/platform/lease - Renew agent lease (heartbeat with metrics)
  - DELETE /api/v1/platform/lease - Release lease (graceful shutdown)
  - POST /api/v1/platform/poll - Long-poll for jobs
  - POST /api/v1/platform/jobs/{jobID}/ack - Acknowledge job receipt
  - POST /api/v1/platform/jobs/{jobID}/result - Report job result
  - POST /api/v1/platform/jobs/{jobID}/progress - Report job progress
- Created `api/internal/infra/http/handler/platform_register_handler.go`
  - POST /api/v1/platform/register - Agent self-registration with bootstrap token
- Wired up routes in `api/internal/infra/http/routes/platform.go`
- Task 2.5 (Redis pub/sub) deferred as long-poll is sufficient for initial implementation

**Phase 2.5: Migration Fixes** - Completed 2026-01-25
- Fixed migration 000083: View column reference `a.agent_type` → `a.type as agent_type` in `platform_agent_status` view
- Created migration 000084: Fixed `recover_stuck_platform_jobs` function (removed invalid `updated_at` column reference)
- Fixed `bootstrap_token_repository.go`: Table names `bootstrap_tokens` → `platform_agent_bootstrap_tokens`, `agent_registrations` → `platform_agent_registrations`
- Fixed `command_repository.go`: `RecoverStuckJobs` function call (2 args → 1 arg to match DB function)
- Updated `docs/architecture/database-notes.md`: Added comprehensive PostgreSQL Functions documentation section
- Updated `docs/development/migrations.md`: Added PostgreSQL Functions Convention section with best practices

### Phase 3: Agent Selection & Scan Integration (Week 4) ✅ COMPLETED

| # | Task | Priority | Status |
|---|------|----------|--------|
| 3.1 | Create AgentSelector service | P0 | ✅ Done |
| 3.2 | Update ScanService with agent_preference | P0 | ✅ Done |
| 3.3 | Implement tenant agent first, platform fallback | P0 | ✅ Done |
| 3.4 | Add platform quota checking | P0 | ✅ Done |
| 3.5 | Add queue position estimation | P1 | ✅ Done |
| 3.6 | Update CommandService for platform jobs | P0 | ✅ Done |
| 3.7 | Add job auth token generation | P0 | ✅ Done |

**Phase 3 Implementation Notes:**
- Created `api/internal/app/agent_selector.go` with:
  - `AgentSelector` service with 4 selection modes: `tenant_only`, `platform_only`, `tenant_first`, `any`
  - `SelectAgent()` - Main selection logic with fallback support
  - `checkPlatformAccess()` - Plan-based platform access validation
  - `checkPlatformQuota()` - Per-tenant concurrent job limits
  - `estimateQueuePosition()` - Queue position and wait time estimation
  - `GetPlatformStats()` - Platform statistics for UI display
  - `CanUsePlatformAgents()` - Quick check for platform eligibility
- Plan-based limits: Enterprise=50, Team=10, Free=0 concurrent jobs
- Unit tests in `api/tests/unit/agent_selector_test.go`
- Task 3.2 completed - ScanService already integrated with `AgentPreference` field and `shouldUsePlatformAgent` logic

### Phase 4: SDK/Agent Updates (Week 5) ✅ COMPLETED

| # | Task | Priority | Status |
|---|------|----------|--------|
| 4.1 | Create `sdk/pkg/platform/` package | P0 | ✅ Done |
| 4.2 | Implement LeaseManager | P0 | ✅ Done |
| 4.3 | Implement Bootstrapper | P0 | ✅ Done |
| 4.4 | Implement PlatformJobPoller (long-poll) | P0 | ✅ Done |
| 4.5 | Update Client with platform endpoints | P0 | ✅ Done |
| 4.6 | Add --platform flag to agent binary | P0 | ✅ Done |
| 4.7 | Implement graceful shutdown with lease release | P1 | ✅ Done |
| 4.8 | Update agent Dockerfile for platform mode | P1 | ✅ Done |

**Phase 4 Implementation Notes:**
- Created `sdk/pkg/platform/` package with:
  - `platform.go` - Core types (AgentCredentials, JobInfo, LeaseInfo, SystemMetrics)
  - `lease.go` - LeaseManager with K8s-style lease renewal and HTTP client
  - `bootstrap.go` - Bootstrapper for agent registration with bootstrap tokens
  - `poller.go` - JobPoller with long-poll support for job fetching
  - `client.go` - PlatformClient combining all functionality + AgentBuilder pattern
- LeaseManager supports: periodic renewal, metrics reporting, graceful release
- Bootstrapper supports: EnsureRegistered helper for credential persistence
- JobPoller supports: concurrent job execution, progress reporting, callbacks
- Agent binary (`agent/main.go`):
  - Added `-platform` flag to enable platform mode
  - Added `-bootstrap-token`, `-name`, `-region` flags for platform agent config
  - Platform mode calls `runPlatformAgent()` which uses SDK's platform package
- Agent Dockerfile (`agent/Dockerfile`):
  - Added `builder-platform` stage that builds with `-tags platform`
  - Added `platform` target for managed platform agent image
  - Platform image includes all scanners + platform mode binary
  - Entrypoint: `["/usr/local/bin/agent"]` with CMD `["-platform", "-verbose"]`

### Phase 5: Admin CLI (Week 6-7) ✅ MOSTLY COMPLETE

| # | Task | Priority | Status |
|---|------|----------|--------|
| 5.1 | Setup CLI structure (cobra) in cmd/openctem-admin/ | P0 | ✅ Done |
| 5.2 | Implement config/context management | P0 | ✅ Done |
| 5.3 | Implement `get agents/jobs/tokens/admins` | P0 | ✅ Done |
| 5.4 | Implement `describe agent/job/token` | P1 | ✅ Done |
| 5.5 | Implement `create agent/token/admin` | P0 | ✅ Done |
| 5.6 | Implement `apply -f` from YAML | P1 | ✅ Done |
| 5.7 | Implement `delete agent/token` | P0 | ✅ Done |
| 5.8 | Implement `drain/uncordon agent` | P1 | ✅ Done |
| 5.9 | Implement `logs job` | P1 | ✅ Done |
| 5.10 | Implement output formatters (json/yaml/wide) | P1 | ✅ Done |
| 5.11 | Add shell completion (bash/zsh/fish) | P2 | [ ] |
| 5.12 | Build Docker image for CLI | P1 | ✅ Done |

**Phase 5 Implementation Notes:**
- Created `api/cmd/openctem-admin/` with Cobra CLI structure:
  - `main.go` - Entry point
  - `cmd/root.go` - Root command with version, completion subcommands
  - `cmd/config.go` - Context management (set-context, use-context, current-context)
  - `cmd/client.go` - HTTP client with API key auth, output formatters
  - `cmd/get.go` - List resources (agents, jobs, tokens, admins)
  - `cmd/describe.go` - Detailed resource view
  - `cmd/create.go` - Create token, admin commands
  - `cmd/delete.go` - Delete agent, token commands
  - `cmd/operations.go` - Agent operations (drain, uncordon, cordon)
- Created `api/cmd/bootstrap-admin/main.go` - Direct database bootstrap tool
- Created `api/Dockerfile.admin-cli` - Multi-binary distroless image
- Output formats: table (default), json, yaml, wide
- Config stored in `~/.openctem/config.yaml`
- `cmd/apply.go` - Declarative resource creation from YAML manifests (kubectl-style)
  - Supports Agent, Token, Admin resource types
  - Reads from file or stdin (`-f -`)
- `cmd/logs.go` - View and follow job logs
  - `logs job <id>` - View job logs
  - `logs job <id> -f` - Follow logs in real-time until completion
  - Shows status, progress, timeline, output, and errors
- **Remaining**: 5.11 (shell completion)

### Phase 6: Admin Web UI - Separate Project (Week 8-9) ✅ COMPLETED

| # | Task | Priority | Status |
|---|------|----------|--------|
| 6.1 | Initialize admin-ui Next.js project | P0 | ✅ Done |
| 6.2 | Setup Tailwind + shadcn/ui | P0 | ✅ Done |
| 6.3 | Create API client & auth store (Zustand) | P0 | ✅ Done |
| 6.4 | Create login page with API key auth | P0 | ✅ Done |
| 6.5 | Create dashboard layout & sidebar | P0 | ✅ Done |
| 6.6 | Create platform overview dashboard | P0 | ✅ Done |
| 6.7 | Create agents list page | P0 | ✅ Done |
| 6.8 | Create agent details page | P1 | ✅ Done |
| 6.9 | Create jobs queue page | P0 | ✅ Done |
| 6.10 | Create job details page | P1 | ✅ Done |
| 6.11 | Create tokens management page | P0 | ✅ Done |
| 6.12 | Create admins management page (super_admin) | P1 | ✅ Done |
| 6.13 | Create audit logs viewer | P1 | ✅ Done |
| 6.14 | Create Dockerfile for admin-ui | P1 | ✅ Done |

**Phase 6 Implementation Notes:**
- Created `admin-ui/` Next.js 16 (canary) project with:
  - TypeScript + Tailwind CSS v4 + shadcn/ui components
  - Zustand for state management (auth store)
  - API client (`src/lib/api-client.ts`) with all admin endpoints
  - Auth types and API types (`src/types/api.ts`)
- Pages implemented:
  - `/login` - API key authentication
  - `/` - Platform overview dashboard with stats, recent agents/jobs
  - `/agents` - Agents list with status filter, drain/uncordon actions
  - `/agents/[id]` - Agent details with resource usage, capabilities
  - `/jobs` - Jobs queue with status filter, cancel/retry actions
  - `/jobs/[id]` - Job details with progress, error message
  - `/tokens` - Bootstrap tokens management with create/revoke
  - `/admins` - Admin management (super_admin only) with role assignment
  - `/audit-logs` - Audit logs viewer with filters (action, actor, resource, date range)
- Features:
  - Responsive sidebar navigation
  - Auto-refresh for dashboard (30s) and jobs (10s)
  - Toast notifications for actions
  - Delete/revoke confirmation dialogs
  - Copy-to-clipboard for tokens and API keys
  - Audit log detail dialog with JSON details view
- Docker support:
  - `Dockerfile` with multi-stage build
  - Standalone output for optimized production image
  - Health check endpoint `/api/health`

### Phase 7: Tenant UI Updates (Week 10) ✅ COMPLETED

| # | Task | Priority | Status |
|---|------|----------|--------|
| 7.1 | Update Create Scan form with agent selection | P0 | [x] |
| 7.2 | Add platform agent status indicator | P1 | [x] |
| 7.3 | Show queue position for platform jobs | P1 | [x] |
| 7.4 | Update Scan Details for platform job info | P1 | [x] |
| 7.5 | Add platform quota usage display | P2 | [x] |

**Implementation Notes:**
- `ui/src/features/scans/types/scan.types.ts`: Added `AgentPreference`, `AgentType`, `AGENT_TYPE_CONFIG`
- `ui/src/features/scans/components/new-scan/basic-info-step.tsx`: Agent preference selection (Auto/Your Agent/Platform Agent)
- `ui/src/app/(dashboard)/(discovery)/scans/page.tsx`: Agent column in Runs table with platform/tenant icons
- `ui/src/features/scans/components/platform-usage-card.tsx`: Platform quota usage card component
- Scan detail sheet shows agent info (type, name, queue position)
- Mock data updated with agent fields for testing

### Phase 8: Testing & Documentation (Week 11-12) - IN PROGRESS

| # | Task | Priority | Status |
|---|------|----------|--------|
| 8.1 | Integration tests for admin API | P0 | ✅ Done |
| 8.2 | Integration tests for agent communication | P0 | ✅ Done |
| 8.3 | Integration tests for agent selection | P0 | ✅ Done |
| 8.4 | E2E tests for platform agent flow | P0 | ✅ Done |
| 8.5 | Load testing for queue | P1 | ✅ Done |
| 8.6 | Security testing | P0 | ✅ Done |
| 8.7 | CLI documentation | P0 | ✅ Done |
| 8.8 | Admin UI documentation | P1 | ✅ Done |
| 8.9 | Runbook for operations | P1 | ✅ Done |
| 8.10 | Update architecture documentation | P1 | ✅ Done |

**Progress: 10/10 tasks completed (100%) - PHASE 8 COMPLETE**

#### Phase 8 Notes

**Integration Tests Created:**
- `api/tests/integration/platform_admin_test.go` - Comprehensive admin API tests
  - `TestPlatformAgentAdmin_*` - Agent CRUD, enable/disable, stats
  - `TestAgentSelection_*` - Capability matching, region filtering
  - `TestJobLifecycle_*` - Submit to completion, failure handling

**Unit Tests Updated (SEC-C03):**
- Updated `api/tests/unit/platform_handler_test.go` for JWT job token authentication
  - Added `generateTestJobToken()` helper for test token generation
  - All `ReportJobResult` and `ReportJobProgress` tests include valid tokens

**Completed Documentation (2026-01-26):**

- **8.5: Load testing** - Created `api/tests/load/platform_queue_test.go`:
  - `TestPlatformQueueLoad` - Tests queue under configurable load
  - `TestPlatformQueueConcurrency` - Tests high concurrency (1000 jobs, 100 goroutines)
  - `TestHTTPEndpointLoad` - Tests HTTP endpoint throughput
  - `BenchmarkJobSubmission` - Benchmarks job submission rate
  - Added `make test-load` and `make test-load-bench` targets

- **8.7: CLI documentation** - Updated `docs/guides/platform-admin.md`:
  - Command reference with global flags
  - Job logs viewing (`logs job <id> -f`)
  - Declarative configuration (`apply -f manifest.yaml`)
  - Delete resources with confirmation
  - Quick reference cheat sheet
  - Resource aliases and status values

- **8.8: Admin UI documentation** - Created `docs/admin-ui/user-guide.md`:
  - Complete guide for all Admin UI pages
  - Role-based access matrix
  - Step-by-step instructions for all features
  - Keyboard shortcuts
  - Troubleshooting section

- **8.9: Operations Runbook** - Created `docs/operations/platform-agent-runbook.md`:
  - Quick diagnostics commands
  - Docker and Kubernetes deployment guides
  - Configuration reference with env variables
  - Monitoring and alerting (Prometheus alerts, Grafana panels)
  - Comprehensive troubleshooting guide
  - Common operations procedures
  - Scaling guide (horizontal, vertical, auto-scaling)
  - Incident response procedures
  - Maintenance procedures

- **8.10: Architecture documentation** - Updated:
  - `docs/architecture/index.md` - Added platform agents explanation section
  - `docs/operations/index.md` - Reorganized with new runbook link
  - `docs/admin-ui/index.md` - Added user guide link

### Implementation Summary

| Phase | Weeks | Focus | Key Deliverables |
|-------|-------|-------|------------------|
| 0 | 1 | Database | Migrations, domain entities |
| 1 | 2 | Controllers | Self-healing, background workers |
| 2 | 3 | Communication | Lease, long-poll, auth |
| 3 | 4 | Integration | Agent selection, scan flow |
| 4 | 5 | SDK | Platform agent mode |
| 5 | 6-7 | CLI | kubectl-style admin tool |
| 6 | 8-9 | Admin UI | Web management interface |
| 7 | 10 | Tenant UI | User-facing updates |
| 8 | 11-12 | Quality | Testing, docs |

**Total Estimated Duration: 12 weeks**

---

## 9. Best Practices Checklist

### 9.1 Security Platform Best Practices

| Category | Requirement | Status |
|----------|-------------|--------|
| **Multi-tenancy** | Complete tenant isolation | ✅ Done |
| | Platform agents don't access tenant data | ✅ Done |
| | Tenant limits enforced | ✅ Done |
| **Authentication** | JWT for tenant users | ✅ Done |
| | API keys for admins (individual) | ✅ Done |
| | Bootstrap tokens (time-limited) | ✅ Done |
| | Lease-based agent auth | ✅ Done |
| **Authorization** | RBAC for admins | ✅ Done |
| | Permission checks on every request | ✅ Done |
| | Tenant scoping on all queries | ✅ Done |
| **Audit** | All admin actions logged | ✅ Done |
| | Immutable audit logs | ✅ Done |
| | Retention policy | 📋 Planned |
| **Encryption** | TLS in transit | ✅ Done |
| | Secrets hashed (bcrypt/SHA-256) | ✅ Done |
| | Sensitive data masked in logs | ✅ Done |
| **Input Validation** | All inputs validated | ✅ Done |
| | SQL injection prevention | ✅ Done |
| | XSS prevention | ✅ Done |

### 9.2 Reliability Best Practices

| Category | Requirement | Status |
|----------|-------------|--------|
| **Self-healing** | Controller reconciliation loops | ✅ Done |
| | Automatic job recovery | ✅ Done |
| | Lease-based failure detection | ✅ Done |
| **Graceful degradation** | Queue backpressure | ✅ Done |
| | Rate limiting | ✅ Done |
| | Circuit breakers | 📋 TODO |
| **Data integrity** | Transactions for critical ops | ✅ Done |
| | Idempotent operations | ✅ Done |
| | Optimistic locking | ✅ Done |

### 9.3 Observability Best Practices

| Category | Requirement | Status |
|----------|-------------|--------|
| **Metrics** | Prometheus metrics | ✅ Done (controllers) |
| | Agent health metrics | ✅ Done (controllers) |
| | Queue depth metrics | 📋 Planned |
| | Latency histograms | 📋 Planned |
| **Logging** | Structured logging (JSON) | ✅ Done |
| | Request ID tracing | ✅ Done |
| | Sensitive data masking | ✅ Done |
| **Alerting** | Agent offline alerts | 📋 Planned |
| | Queue backlog alerts | 📋 Planned |
| | Error rate alerts | 📋 Planned |

### 9.4 Operational Best Practices

| Category | Requirement | Status |
|----------|-------------|--------|
| **CLI** | kubectl-style interface | ✅ Done |
| | Multiple output formats | ✅ Done |
| | Context/environment support | ✅ Done |
| | Declarative config (YAML) | ✅ Done |
| **Documentation** | API documentation | ✅ Done |
| | CLI documentation | ⬜ Pending |
| | Runbooks | ⬜ Pending |
| | Architecture docs | ✅ Done |

---

## 10. Security Review (Cybersecurity Expert Evaluation)

### 10.1 Critical Security Issues

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CRITICAL SECURITY FINDINGS                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  🔴 CRITICAL (Must fix before production)                                │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  SEC-C01: API Key Hash Algorithm                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Issue: SHA-256 for API key hashing is fast, vulnerable to brute    │ │
│  │        force attacks with modern GPUs                               │ │
│  │                                                                      │ │
│  │ Current:  api_key_hash VARCHAR(64) -- SHA-256                       │ │
│  │                                                                      │ │
│  │ Fix: Use bcrypt or Argon2id for API key hashing                     │ │
│  │      api_key_hash VARCHAR(100) -- bcrypt/argon2                     │ │
│  │                                                                      │ │
│  │ Implementation:                                                      │ │
│  │   // Use bcrypt with cost factor 12                                 │ │
│  │   hash, _ := bcrypt.GenerateFromPassword([]byte(apiKey), 12)        │ │
│  │   // Or Argon2id for even better security                           │ │
│  │   hash := argon2.IDKey([]byte(apiKey), salt, 1, 64*1024, 4, 32)    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  SEC-C02: Bootstrap Token Entropy                                        │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Issue: Need to ensure bootstrap tokens have sufficient entropy      │ │
│  │        (minimum 256 bits for cryptographic security)                │ │
│  │                                                                      │ │
│  │ Fix: Enforce minimum token length and use crypto/rand               │ │
│  │      token := make([]byte, 32) // 256 bits                          │ │
│  │      crypto.Read(token)                                              │ │
│  │      return "oc-bt-" + base64.URLEncoding.EncodeToString(token)   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  SEC-C03: Job Auth Token Security                                        │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Issue: Job auth tokens grant access to tenant data. Need:           │ │
│  │        - Short TTL (max 1 hour)                                     │ │
│  │        - Scope limitation (specific job only)                       │ │
│  │        - One-time use or usage counter                              │ │
│  │        - Binding to specific agent                                   │ │
│  │                                                                      │ │
│  │ Fix: Implement JWT with claims:                                      │ │
│  │   {                                                                  │ │
│  │     "sub": "job_id",                                                │ │
│  │     "aud": "platform_agent",                                        │ │
│  │     "iss": .openctem",                                               │ │
│  │     "exp": now + 1h,                                                │ │
│  │     "iat": now,                                                     │ │
│  │     "jti": unique_token_id, // For revocation                       │ │
│  │     "agent_id": assigned_agent_id,                                   │ │
│  │     "tenant_id": tenant_id,                                         │ │
│  │     "scopes": ["ingest:findings", "read:target"]                    │ │
│  │   }                                                                  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  SEC-C04: Tenant Data Isolation in Platform Agents                       │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Issue: Platform agents process code from multiple tenants.          │ │
│  │        Must prevent:                                                 │ │
│  │        - Cross-tenant data leakage                                   │ │
│  │        - Residual data from previous scans                          │ │
│  │        - Memory/disk forensics                                       │ │
│  │                                                                      │ │
│  │ Fix:                                                                 │ │
│  │   1. Use ephemeral containers per job (preferred)                   │ │
│  │   2. Or: Secure cleanup after each job                              │ │
│  │      - Securely delete cloned repo (shred -u)                       │ │
│  │      - Clear environment variables                                   │ │
│  │      - Flush memory-mapped files                                     │ │
│  │   3. Use separate network namespaces per job                        │ │
│  │   4. Never cache tenant credentials on disk                          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.2 High Severity Issues

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    HIGH SEVERITY SECURITY FINDINGS                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  🟠 HIGH (Should fix before production)                                  │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  SEC-H01: Admin API Rate Limiting                                        │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Issue: No rate limiting mentioned for admin API                     │ │
│  │        Risk: Brute force API key attacks                            │ │
│  │                                                                      │ │
│  │ Fix: Implement strict rate limiting:                                 │ │
│  │   - Login attempts: 5/minute per IP, 10/hour per email              │ │
│  │   - API calls: 100/minute per admin                                 │ │
│  │   - Failed auth: Progressive delay (1s, 2s, 4s, 8s...)             │ │
│  │   - Account lockout after 10 failed attempts (30 min)               │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  SEC-H02: Admin Session Security                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Issue: 8-hour session without re-authentication is too long         │ │
│  │        for privileged operations                                    │ │
│  │                                                                      │ │
│  │ Fix:                                                                 │ │
│  │   - Reduce session to 4 hours max                                   │ │
│  │   - Require re-authentication for sensitive operations:            │ │
│  │     * Creating new admin users                                      │ │
│  │     * Rotating API keys                                              │ │
│  │     * Deleting agents                                                │ │
│  │   - Implement session binding (IP + User-Agent fingerprint)         │ │
│  │   - Add "sudo mode" requiring API key re-entry                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  SEC-H03: Audit Log Tampering Prevention                                 │ │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Issue: Audit logs could be modified by super_admin with DB access   │ │
│  │                                                                      │ │
│  │ Fix:                                                                 │ │
│  │   - Add hash chain for log integrity                                 │ │
│  │     previous_hash VARCHAR(64) REFERENCES admin_audit_logs(hash)     │ │
│  │     hash VARCHAR(64) = SHA256(id + action + previous_hash)          │ │
│  │   - Stream logs to external SIEM (Splunk, ELK, etc.)                │ │
│  │   - Use append-only table (revoke DELETE on admin_audit_logs)       │ │
│  │   - Consider PostgreSQL SECURITY LABEL for row-level security       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  SEC-H04: Bootstrap Token Scope Validation                               │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Issue: Bootstrap tokens should strictly limit what agent can do     │ │
│  │                                                                      │ │
│  │ Fix: Add constraints to bootstrap_tokens:                           │ │
│  │   - allowed_regions: Only register from specific regions            │ │
│  │   - allowed_ips: CIDR ranges that can use this token               │ │
│  │   - required_capabilities: Must match exactly                       │ │
│  │   - max_concurrent_jobs: Upper limit enforceable                    │ │
│  │   - Validate all constraints at registration time                   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  SEC-H05: Long-Poll Connection Security                                  │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Issue: Long-poll endpoints can be used for DoS                      │ │
│  │                                                                      │ │
│  │ Fix:                                                                 │ │
│  │   - Limit concurrent connections per agent (max 2)                  │ │
│  │   - Enforce maximum poll timeout (30s, not configurable by client)  │ │
│  │   - Validate agent lease before accepting connection                │ │
│  │   - Use request coalescing to prevent thundering herd               │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Medium Severity Issues

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   MEDIUM SEVERITY SECURITY FINDINGS                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  🟡 MEDIUM (Should address)                                              │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  SEC-M01: API Key Rotation                                               │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Issue: No mechanism for graceful API key rotation                   │ │
│  │                                                                      │ │
│  │ Fix: Support dual-key period during rotation:                       │ │
│  │   - Add: api_key_hash_old, old_key_expires_at                       │ │
│  │   - Accept both old and new key during transition (24h max)         │ │
│  │   - Log all uses of old key for monitoring                          │ │
│  │   - Auto-expire old key after transition period                     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  SEC-M02: Lease Renewal Request Validation                               │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Issue: Agent-reported metrics (CPU, memory) are trusted             │ │
│  │        Could be used to game job distribution                       │ │
│  │                                                                      │ │
│  │ Fix:                                                                 │ │
│  │   - Add plausibility checks (0-100% range)                          │ │
│  │   - Compare with historical patterns                                 │ │
│  │   - Flag anomalies for investigation                                │ │
│  │   - Consider server-side health probes for critical agents          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  SEC-M03: Admin UI CSRF Protection                                       │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Issue: Admin UI needs strong CSRF protection                        │ │
│  │                                                                      │ │
│  │ Fix:                                                                 │ │
│  │   - Use SameSite=Strict cookies                                     │ │
│  │   - Implement CSRF tokens for state-changing operations             │ │
│  │   - Verify Origin/Referer headers                                   │ │
│  │   - Use custom header requirement (X-Requested-With)                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  SEC-M04: Error Information Disclosure                                   │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Issue: Detailed error messages may leak implementation details      │ │
│  │                                                                      │ │
│  │ Fix:                                                                 │ │
│  │   - Return generic errors to clients (error codes, not stack traces)│ │
│  │   - Log detailed errors server-side only                            │ │
│  │   - Never expose: DB errors, file paths, internal IPs              │ │
│  │   - Different error detail level for admin vs tenant API           │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  SEC-M05: Redis Security                                                 │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Issue: Redis used for lease/state but security not specified        │ │
│  │                                                                      │ │
│  │ Fix:                                                                 │ │
│  │   - Enable Redis AUTH with strong password                          │ │
│  │   - Use TLS for Redis connections                                   │ │
│  │   - Disable dangerous commands (FLUSHALL, CONFIG, DEBUG)            │ │
│  │   - Use separate Redis instance/database for platform data          │ │
│  │   - Set appropriate key expiration to prevent memory exhaustion     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.4 Security Implementation Checklist

| # | Security Control | Priority | Status | Notes |
|---|-----------------|----------|--------|-------|
| **Authentication** |
| 1 | Use bcrypt/Argon2 for API keys | 🔴 Critical | ✅ Done | `admin/entity.go` - bcrypt cost 12 |
| 2 | Minimum 256-bit token entropy | 🔴 Critical | ✅ Done | `bootstrap_token.go` - 32 bytes |
| 3 | Rate limiting on auth endpoints | 🟠 High | ✅ Done | Via account lockout |
| 4 | Account lockout mechanism | 🟠 High | ✅ Done | 10 attempts → 30min lockout |
| 5 | Session timeout (4 hours max) | 🟠 High | ⬜ TODO | Reduce from 8h |
| 6 | API key rotation support | 🟡 Medium | ⬜ TODO | Dual-key period |
| **Authorization** |
| 7 | Job token scope limitation | 🔴 Critical | ✅ Done | JWT with agent_id, job_id, tenant_id, scopes |
| 8 | Job token short TTL (1 hour) | 🔴 Critical | ✅ Done | TTL = job_timeout + 10min buffer |
| 9 | Re-auth for sensitive ops | 🟠 High | ⬜ TODO | Sudo mode |
| 10 | Bootstrap token IP restriction | 🟠 High | ⬜ TODO | CIDR allowlist |
| **Data Protection** |
| 11 | Tenant isolation in agents | 🔴 Critical | ⬜ TODO | Ephemeral containers |
| 12 | Secure cleanup after jobs | 🔴 Critical | ⬜ TODO | shred, memory flush |
| 13 | Redis TLS + AUTH | 🟡 Medium | ⬜ TODO | Encrypt in transit |
| 14 | Audit log integrity | 🟠 High | ⬜ TODO | Hash chain |
| **Network Security** |
| 15 | Long-poll connection limits | 🟠 High | ⬜ TODO | Max 2 per agent |
| 16 | Admin UI IP allowlist | 🟡 Medium | ⬜ TODO | VPN/internal only |
| 17 | CORS strict configuration | 🟡 Medium | ⬜ TODO | No wildcards |
| **Input Validation** |
| 18 | Metrics plausibility check | 🟡 Medium | ✅ Done | `lease_service.go` - validation |
| 19 | Request size limits | 🟡 Medium | ⬜ TODO | Max body size |
| 20 | CSRF protection | 🟡 Medium | ⬜ TODO | SameSite=Strict |

**Security Fixes Applied (2026-01-26):**
- Migration 000085 adds security hardening schema changes
- SEC-C01: bcrypt with cost factor 12 for API keys (replaces SHA-256)
- SEC-C02: Bootstrap tokens now use 32 bytes (256 bits) entropy
- SEC-C03: JWT job tokens with scopes (agent_id, job_id, tenant_id, scopes)
  - Implemented in `pkg/jwt/jwt.go` (JobTokenClaims, GenerateJobToken, ValidateJobToken)
  - Token generation in `app/platform_job_service.go` (SubmitJob, ClaimNextJob)
  - Token validation in `handler/platform_handler.go` (ReportJobResult, ReportJobProgress)
  - Token validation in `handler/platform_job_handler.go` (UpdateJobStatus)
  - Scopes: job:status, job:result, job:ingest
  - Short TTL (job timeout + 10 min buffer)
- SEC-H01: Account lockout after 10 failed attempts (30 min duration)
- SEC-M02: Metrics validation with plausibility checks in LeaseService

### 10.5 Security Architecture Recommendations

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  RECOMMENDED SECURITY ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. NETWORK SEGMENTATION                                                 │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                                                                      │ │
│  │  ┌─────────────────┐     ┌─────────────────┐     ┌──────────────┐  │ │
│  │  │   Public Zone   │     │  Internal Zone  │     │  Data Zone   │  │ │
│  │  │  ─────────────  │     │  ─────────────  │     │  ──────────  │  │ │
│  │  │  • Tenant UI    │────▶│  • API Server   │────▶│  • PostgreSQL│  │ │
│  │  │  • Tenant API   │     │  • Admin API    │     │  • Redis     │  │ │
│  │  │                 │     │  • Controllers  │     │              │  │ │
│  │  └─────────────────┘     └─────────────────┘     └──────────────┘  │ │
│  │          │                       │                                  │ │
│  │          │              ┌────────┴────────┐                        │ │
│  │          │              │   Agent Zone    │                        │ │
│  │          │              │  ─────────────  │                        │ │
│  │          └─────────────▶│  • Admin UI     │ (VPN only)             │ │
│  │                         │  • Platform Agt │                        │ │
│  │                         └─────────────────┘                        │ │
│  │                                                                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  2. SECRET MANAGEMENT                                                    │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                                                                      │ │
│  │  NEVER store in code or config files:                                │ │
│  │  • Admin API keys                                                    │ │
│  │  • Database credentials                                              │ │
│  │  • Redis password                                                    │ │
│  │  • JWT signing keys                                                  │ │
│  │                                                                      │ │
│  │  Use:                                                                │ │
│  │  • HashiCorp Vault (preferred)                                       │ │
│  │  • AWS Secrets Manager / GCP Secret Manager                          │ │
│  │  • Kubernetes Secrets (with encryption at rest)                      │ │
│  │  • Environment variables (development only)                          │ │
│  │                                                                      │ │
│  │  Rotation policy:                                                    │ │
│  │  • Admin API keys: 90 days                                           │ │
│  │  • Platform agent keys: 30 days                                      │ │
│  │  • JWT signing keys: 7 days (with key ID for verification)           │ │
│  │  • Database passwords: 90 days                                       │ │
│  │                                                                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  3. PLATFORM AGENT ISOLATION                                             │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                                                                      │ │
│  │  Option A: Container-per-Job (Recommended)                           │ │
│  │  ┌──────────────────────────────────────────────────────────────┐   │ │
│  │  │ Platform Agent (orchestrator)                                 │   │ │
│  │  │   │                                                           │   │ │
│  │  │   ├── Job Container 1 (Tenant A scan)                         │   │ │
│  │  │   │   └── Ephemeral, destroyed after job                      │   │ │
│  │  │   │                                                           │   │ │
│  │  │   ├── Job Container 2 (Tenant B scan)                         │   │ │
│  │  │   │   └── No network access to Container 1                    │   │ │
│  │  │   │                                                           │   │ │
│  │  │   └── Cleanup: Volumes shredded, containers removed           │   │ │
│  │  └──────────────────────────────────────────────────────────────┘   │ │
│  │                                                                      │ │
│  │  Option B: Process Isolation (if containers not possible)           │ │
│  │  ┌──────────────────────────────────────────────────────────────┐   │ │
│  │  │ • Run each job as separate Linux user                         │   │ │
│  │  │ • Use cgroups for resource limits                             │   │ │
│  │  │ • Use seccomp for syscall filtering                           │   │ │
│  │  │ • Use namespaces for network isolation                        │   │ │
│  │  │ • tmpfs for temporary files (auto-cleared)                    │   │ │
│  │  └──────────────────────────────────────────────────────────────┘   │ │
│  │                                                                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  4. MONITORING & ALERTING                                                │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                                                                      │ │
│  │  Security Events to Monitor:                                         │ │
│  │  • Failed admin login attempts (> 3 in 5 min → alert)               │ │
│  │  • API key usage from new IP (alert)                                │ │
│  │  • Bootstrap token usage (all uses → log)                           │ │
│  │  • Admin privilege escalation (any role change → alert)             │ │
│  │  • Mass agent offline (> 50% → critical alert)                      │ │
│  │  • Unusual job patterns (spike in failures → alert)                 │ │
│  │  • Audit log gaps (missing sequence → critical alert)               │ │
│  │                                                                      │ │
│  │  Integrate with:                                                     │ │
│  │  • SIEM (Splunk, ELK, Datadog)                                      │ │
│  │  • PagerDuty / OpsGenie for on-call                                 │ │
│  │  • Slack/Teams for non-critical alerts                              │ │
│  │                                                                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.6 Migration Security Fixes Required

```sql
-- ============================================================================
-- SECURITY FIXES FOR MIGRATION 000082 (admin_users)
-- ============================================================================

-- Fix 1: Change API key hash field to support bcrypt (longer hash)
ALTER TABLE admin_users
ALTER COLUMN api_key_hash TYPE VARCHAR(100);

-- Fix 2: Add fields for key rotation
ALTER TABLE admin_users
ADD COLUMN api_key_hash_old VARCHAR(100),
ADD COLUMN old_key_expires_at TIMESTAMPTZ;

-- Fix 3: Add failed login tracking
ALTER TABLE admin_users
ADD COLUMN failed_login_count INT DEFAULT 0,
ADD COLUMN locked_until TIMESTAMPTZ,
ADD COLUMN last_failed_login_at TIMESTAMPTZ,
ADD COLUMN last_failed_login_ip INET;

-- Fix 4: Add session binding
ALTER TABLE admin_users
ADD COLUMN session_fingerprint VARCHAR(64);  -- Hash of IP + User-Agent

-- Fix 5: Audit log integrity
ALTER TABLE admin_audit_logs
ADD COLUMN previous_log_id UUID REFERENCES admin_audit_logs(id),
ADD COLUMN integrity_hash VARCHAR(64);  -- SHA256(id + action + previous_hash)

-- Fix 6: Revoke DELETE on audit logs
REVOKE DELETE ON admin_audit_logs FROM PUBLIC;
-- Note: May need to adjust for specific roles

-- ============================================================================
-- SECURITY FIXES FOR MIGRATION 000083 (agent_leases)
-- ============================================================================

-- Fix 1: Add IP binding for lease
ALTER TABLE agent_leases
ADD COLUMN bound_ip INET,
ADD COLUMN bound_ip_validated BOOLEAN DEFAULT FALSE;

-- Fix 2: Add anomaly detection fields
ALTER TABLE agent_leases
ADD COLUMN metrics_anomaly_score DECIMAL(3,2) DEFAULT 0,
ADD COLUMN last_anomaly_at TIMESTAMPTZ;
```

---

## 11. Plan Evaluation (PM/Tech Lead/BA Review)

### 10.1 Executive Assessment

| Perspective | Rating | Status |
|-------------|--------|--------|
| PM (Timeline/Resources) | 🟡 7/10 | Good structure, missing resource allocation |
| Tech Lead (Architecture) | 🟢 8/10 | Solid K8s-inspired design |
| BA (Requirements) | 🟡 7/10 | Needs edge cases & acceptance criteria |

### 10.2 PM Perspective: Gaps & Recommendations

#### ❌ Missing Elements

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| **Resource allocation** | High | Add team size, skill requirements |
| **Dependencies mapping** | High | Add explicit phase dependencies |
| **Risk register** | Medium | Add risks with mitigation strategies |
| **Success metrics/KPIs** | Medium | Define measurable success criteria |
| **Rollback plan** | High | What if we need to revert? |
| **Feature flags** | Medium | How to gradually rollout? |

#### ✅ To Add: Risk Register

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           RISK REGISTER                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Risk                        │ Impact │ Probability │ Mitigation        │
│  ───────────────────────────┼────────┼─────────────┼──────────────────│
│  Platform agent              │ High   │ Medium      │ Circuit breaker,  │
│  pool exhaustion             │        │             │ queue limits      │
│                              │        │             │                   │
│  Noisy neighbor              │ High   │ High        │ Weighted fair     │
│  (one tenant uses all)       │        │             │ queuing, quotas   │
│                              │        │             │                   │
│  Admin API key leak          │ Critical│ Low        │ Audit logs,       │
│                              │        │             │ IP allowlist,     │
│                              │        │             │ rotation support  │
│                              │        │             │                   │
│  Controller crash loop       │ Medium │ Low         │ Backoff, health   │
│                              │        │             │ checks, alerts    │
│                              │        │             │                   │
│  Long-poll connection        │ Medium │ Medium      │ Timeout limits,   │
│  exhaustion                  │        │             │ connection pool   │
│                              │        │             │                   │
│  Database migration          │ High   │ Low         │ Test in staging,  │
│  failure                     │        │             │ rollback scripts  │
│                              │        │             │                   │
└─────────────────────────────────────────────────────────────────────────┘
```

#### ✅ To Add: Success Metrics (KPIs)

| KPI | Target | Measurement |
|-----|--------|-------------|
| Platform job wait time | < 5 min (P95) | Queue metrics |
| Agent utilization | > 70% | Jobs per agent per hour |
| Job success rate | > 99% | Completed / Total |
| Admin API latency | < 200ms (P95) | Response time |
| Controller recovery time | < 2 min | Time from failure to healthy |
| Zero security incidents | 0 | Audit log anomalies |

### 10.3 Tech Lead Perspective: Architecture Gaps

#### ❌ Missing Technical Details

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| **Connection pool sizing** | High | Define for PostgreSQL, Redis |
| **Error handling patterns** | Medium | Standardize error codes |
| **Retry strategies** | Medium | Exponential backoff config |
| **Caching strategy** | Medium | What to cache, TTLs |
| **Database indexes** | Medium | Performance optimization plan |
| **API versioning** | Medium | How to version admin API? |

#### ✅ To Add: Connection Pool Sizing

```go
// config/platform.go
type PlatformConfig struct {
    // PostgreSQL
    DBMaxOpenConns     int           `env:"DB_MAX_OPEN_CONNS" default:"50"`
    DBMaxIdleConns     int           `env:"DB_MAX_IDLE_CONNS" default:"10"`
    DBConnMaxLifetime  time.Duration `env:"DB_CONN_MAX_LIFETIME" default:"1h"`

    // Redis
    RedisPoolSize      int           `env:"REDIS_POOL_SIZE" default:"100"`
    RedisMinIdleConns  int           `env:"REDIS_MIN_IDLE_CONNS" default:"10"`

    // Long-poll
    MaxLongPollConns   int           `env:"MAX_LONG_POLL_CONNS" default:"1000"`
    LongPollTimeout    time.Duration `env:"LONG_POLL_TIMEOUT" default:"30s"`

    // Controllers
    ControllerWorkers  int           `env:"CONTROLLER_WORKERS" default:"1"`
}
```

#### ✅ To Add: Error Code Registry

```go
// domain/shared/errors_platform.go
var (
    // 4xx Client Errors
    ErrPlatformAgentNotFound  = NewCodedError("PLAT001", "platform agent not found")
    ErrLeaseExpired           = NewCodedError("PLAT002", "lease has expired")
    ErrBootstrapTokenInvalid  = NewCodedError("PLAT003", "bootstrap token invalid or expired")
    ErrQuotaExceeded          = NewCodedError("PLAT004", "platform job quota exceeded")
    ErrNoCapableAgents        = NewCodedError("PLAT005", "no agents with required capabilities")
    ErrAdminUnauthorized      = NewCodedError("PLAT006", "admin authorization failed")
    ErrJobAlreadyAssigned     = NewCodedError("PLAT007", "job already assigned to another agent")

    // 5xx Server Errors
    ErrLeaseRenewalFailed     = NewCodedError("PLAT101", "failed to renew lease")
    ErrJobAssignmentFailed    = NewCodedError("PLAT102", "failed to assign job")
    ErrControllerError        = NewCodedError("PLAT103", "controller reconciliation error")
)
```

### 10.4 BA Perspective: Requirements Gaps

#### ❌ Missing User Stories / Acceptance Criteria

| Missing | Impact | Recommendation |
|---------|--------|----------------|
| **User stories** | High | Add formal user stories |
| **Acceptance criteria** | High | Add per-feature AC |
| **Edge cases** | Medium | Document boundary conditions |
| **Error messages** | Medium | User-friendly error text |
| **Admin permissions matrix** | Medium | Detailed CRUD per role |

#### ✅ To Add: User Stories

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER STORIES                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  As a TENANT USER, I want to...                                          │
│  ───────────────────────────────────────────────────────────────────── │
│  US-T01: Create a scan using platform agents when I don't have          │
│          my own agent deployed, so that I can still scan my repos       │
│                                                                          │
│  US-T02: See estimated wait time when my scan is queued for             │
│          platform agent, so I can plan my work                          │
│                                                                          │
│  US-T03: View my platform agent quota usage, so I can manage            │
│          my scans within the limit                                      │
│                                                                          │
│  US-T04: Choose between my agents and platform agents when creating     │
│          a scan, so I have control over where my code is processed      │
│                                                                          │
│  As a PLATFORM ADMIN (ops_admin), I want to...                           │
│  ───────────────────────────────────────────────────────────────────── │
│  US-A01: View all platform agents and their status in real-time,        │
│          so I can monitor system health                                 │
│                                                                          │
│  US-A02: Create bootstrap tokens for deploying new agents, so I can     │
│          scale the platform without direct database access              │
│                                                                          │
│  US-A03: Drain an agent before maintenance, so jobs are migrated        │
│          gracefully without losing work                                 │
│                                                                          │
│  US-A04: View the job queue and manually retry failed jobs, so I can    │
│          handle edge cases and recover from failures                    │
│                                                                          │
│  US-A05: View audit logs of admin actions, so I can investigate         │
│          security incidents                                             │
│                                                                          │
│  As a SUPER ADMIN, I want to...                                          │
│  ───────────────────────────────────────────────────────────────────── │
│  US-S01: Create and manage other admin users, so I can delegate         │
│          operations without sharing my credentials                      │
│                                                                          │
│  US-S02: Rotate admin API keys, so I can respond to key compromises     │
│                                                                          │
│  US-S03: Configure platform-wide settings (quotas, limits), so I can    │
│          control resource usage                                         │
│                                                                          │
│  As a PLATFORM AGENT (system), I want to...                              │
│  ───────────────────────────────────────────────────────────────────── │
│  US-AG01: Self-register using a bootstrap token, so I can join the      │
│           platform without manual configuration                         │
│                                                                          │
│  US-AG02: Maintain my lease automatically, so the control plane knows   │
│           I'm healthy                                                   │
│                                                                          │
│  US-AG03: Receive jobs that match my capabilities, so I process only    │
│           work I can handle                                             │
│                                                                          │
│  US-AG04: Report job progress and results, so tenants see real-time     │
│           status                                                        │
│                                                                          │
│  US-AG05: Gracefully shutdown and release my lease, so my jobs can be   │
│           reassigned to other agents                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### ✅ To Add: Edge Cases

| Scenario | Expected Behavior |
|----------|------------------|
| All platform agents offline | Return error "Platform temporarily unavailable, please try later" |
| Tenant exceeds queue limit | Return error "Queue limit reached, please wait for pending scans" |
| Agent goes offline mid-job | Job auto-reassigned within 2 minutes by controller |
| Bootstrap token exhausted | Return error "Token has reached max uses, request new token" |
| Admin attempts self-deletion | Block with error "Cannot delete your own admin account" |
| Long-poll timeout without job | Return 204 No Content, agent retries immediately |
| Job auth token expired | Return 401, agent must re-poll for fresh token |
| Concurrent lease renewal | Use optimistic locking, retry on conflict |
| Agent reports wrong tenant data | Block with error "Job auth token invalid for this tenant" |
| Controller reconciliation overlap | Use distributed lock or single-instance |

### 10.5 Overall Verdict & Action Items

#### Score Summary

| Area | Score | Notes |
|------|-------|-------|
| Architecture completeness | 8/10 | Solid K8s-inspired design |
| Technical specifications | 7/10 | Missing configs, error codes |
| Requirements coverage | 6/10 | Missing user stories, edge cases |
| Project management | 5/10 | Missing risks, dependencies, metrics |
| Security considerations | 9/10 | Well-designed audit, auth |
| Operational readiness | 7/10 | Missing runbooks, alerts |

**Overall Score: 7/10 - Good foundation, needs PM/BA supplements**

#### Action Items Before Implementation

| # | Action | Priority | Owner |
|---|--------|----------|-------|
| 1 | Add risk register with mitigation | P0 | PM |
| 2 | Define success metrics/KPIs | P0 | PM |
| 3 | Add connection pool configuration | P1 | Tech Lead |
| 4 | Create error code registry | P1 | Tech Lead |
| 5 | Write user stories with acceptance criteria | P0 | BA |
| 6 | Document edge cases and expected behavior | P1 | BA |
| 7 | Create rollback plan | P1 | Tech Lead |
| 8 | Define feature flag strategy | P2 | Tech Lead |
| 9 | Create alerting rules | P1 | DevOps |
| 10 | Define API versioning strategy | P2 | Tech Lead |

---

## 12. References

### 12.1 Kubernetes Patterns

- [Kubernetes Controller Pattern](https://kubernetes.io/docs/concepts/architecture/controller/)
- [Kubernetes Lease API](https://kubernetes.io/docs/concepts/architecture/leases/)
- [kubectl Design](https://kubectl.docs.kubernetes.io/guides/introduction/kubectl/)
- [kubeadm Token Design](https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-token/)

### 12.2 Security Standards

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [SOC 2 Compliance](https://www.aicpa.org/soc2)

### 12.3 Internal References

- Migration 000080: Platform Agents Support ✅
- Migration 000081: Bootstrap Tokens ✅
- Migration 000082: Admin Users ✅ (created)
- Migration 000083: Agent Leases ✅ (created)

### 12.4 Key File Locations

```
API (Go Backend):
├── api/migrations/
│   ├── 000080_add_platform_agents.up.sql    # Platform agent schema
│   ├── 000081_add_bootstrap_tokens.up.sql   # Bootstrap tokens
│   ├── 000082_admin_users.up.sql            # Admin users & audit
│   └── 000083_agent_leases.up.sql           # K8s-style leases
│
├── api/internal/domain/
│   ├── agent/entity.go                      # Platform agent entity
│   ├── agent/bootstrap_token.go             # Bootstrap token entity
│   ├── admin/entity.go                      # Admin user entity (TODO)
│   └── lease/entity.go                      # Lease entity (TODO)
│
├── api/internal/app/
│   ├── platform_agent_service.go            # Platform agent service (TODO)
│   ├── admin_service.go                     # Admin user service (TODO)
│   └── controller/                          # Controller workers (TODO)
│
└── api/cmd/
    └── openctem-admin/main.go                # Admin CLI (TODO)

SDK (Go):
├── sdk/pkg/
│   ├── client/client.go                     # API client (update needed)
│   ├── core/base_agent.go                   # Base agent
│   └── platform/                            # Platform agent mode (TODO)
│       ├── agent.go
│       ├── lease.go
│       ├── bootstrap.go
│       └── job_poller.go

Agent (Go Binary):
└── agent/main.go                            # --platform flag (TODO)

Tenant UI (Next.js - existing, minimal changes):
├── ui/src/app/(dashboard)/(discovery)/scans/
│   └── new/page.tsx                         # Update: Add agent selection
└── ui/src/features/scans/
    └── components/scan-form.tsx             # Update: agent_preference field

Admin UI (Next.js - NEW SEPARATE PROJECT):
├── admin-ui/
│   ├── package.json
│   ├── next.config.ts
│   ├── Dockerfile
│   │
│   ├── src/app/
│   │   ├── (auth)/login/page.tsx            # Admin login
│   │   └── (dashboard)/                     # Dashboard routes
│   │       ├── page.tsx                     # Overview
│   │       ├── agents/page.tsx              # Agents management
│   │       ├── jobs/page.tsx                # Jobs queue
│   │       ├── tokens/page.tsx              # Bootstrap tokens
│   │       ├── admins/page.tsx              # Admin users
│   │       └── audit/page.tsx               # Audit logs
│   │
│   ├── src/features/
│   │   ├── agents/                          # Agent feature
│   │   ├── jobs/                            # Jobs feature
│   │   ├── tokens/                          # Tokens feature
│   │   ├── admins/                          # Admin users feature
│   │   ├── audit/                           # Audit logs feature
│   │   └── auth/                            # Auth feature
│   │
│   ├── src/components/
│   │   ├── ui/                              # shadcn/ui components
│   │   ├── layout/                          # Sidebar, header
│   │   └── shared/                          # Data table, charts
│   │
│   ├── src/lib/
│   │   ├── api/                             # API client
│   │   └── auth/                            # Auth store
│   │
│   └── src/config/
│       └── sidebar.ts                       # Navigation config

Docs:
└── docs/implement/
    └── 2026-01-25-platform-admin-system.md  # This document
```
