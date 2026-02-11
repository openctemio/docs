---
layout: default
parent: Architecture
---
---
layout: default
title: Scan Orchestration Architecture
parent: Architecture
nav_order: 8
---

# Scan Orchestration Architecture

> **Last Updated**: January 20, 2026
> **Implementation Status**: Phase 1 Complete ✅ (100%)

## Overview

Scan Orchestration enables automated, scheduled, and pipeline-driven scan execution across the OpenCTEM CTEM platform. The architecture follows a **pull-based, event-driven** model inspired by Kubernetes but simplified for multi-tenant isolation.

## Design Principles

1. **Pull-Based Polling** - Workers poll for commands (not pushed)
2. **Event-Driven Progression** - Pipeline steps progress on command completion
3. **Tenant Isolation** - Each tenant's workers only see their commands
4. **Simple Tool Matching** - Route commands to workers with required tools
5. **No Over-Engineering** - K8s-style controllers not needed due to tenant isolation

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SCAN ORCHESTRATION ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         CONTROL PLANE                                 │   │
│  │                                                                       │   │
│  │  ┌──────────────┐   ┌──────────────┐   ┌────────────────────────┐    │   │
│  │  │  API Server  │   │Scan Scheduler│   │   Pipeline Service     │    │   │
│  │  │              │   │              │   │                        │    │   │
│  │  │  - REST API  │   │  - Cron loop │   │  - OnStepCompleted()   │    │   │
│  │  │  - Auth      │   │  - Batched   │   │  - scheduleRunnable()  │    │   │
│  │  │  - Multi-    │   │  - 1 min     │   │  - findWorkerForStep() │    │   │
│  │  │    tenant    │   │    interval  │   │                        │    │   │
│  │  └──────────────┘   └──────────────┘   └────────────────────────┘    │   │
│  │                                                                       │   │
│  │  ┌───────────────────────────────────────────────────────────────┐   │   │
│  │  │                    Command Handler                             │   │   │
│  │  │                                                                │   │   │
│  │  │  POST /complete ───► triggerPipelineProgression()             │   │   │
│  │  │  POST /fail ───────► triggerPipelineFailed()                  │   │   │
│  │  │                                                                │   │   │
│  │  └───────────────────────────────────────────────────────────────┘   │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         DATABASE                                      │   │
│  │                                                                       │   │
│  │  Commands Table (tenant_id, worker_id, status, priority)              │   │
│  │  Workers Table (tenant_id, tools[], status, health)                   │   │
│  │  Scans Table (next_run_at, schedule_type, status)                     │   │
│  │  Pipeline Runs / Step Runs                                            │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         WORKERS (Per Tenant)                          │   │
│  │                                                                       │   │
│  │  Tenant A                    Tenant B                                 │   │
│  │  ┌───────────────────┐      ┌───────────────────┐                    │   │
│  │  │ Workers [W1, W2]  │      │ Workers [W1]      │                    │   │
│  │  │ Tools: nuclei,    │      │ Tools: semgrep    │                    │   │
│  │  │        semgrep    │      │                   │                    │   │
│  │  │       │           │      │       │           │                    │   │
│  │  │       ▼           │      │       ▼           │                    │   │
│  │  │ Poll own commands │      │ Poll own commands │                    │   │
│  │  └───────────────────┘      └───────────────────┘                    │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Scheduled Scan Trigger

```
┌───────────────┐     every 1 min     ┌───────────────────┐
│ ScanScheduler │ ─────────────────► │ ListDueForExec()  │
└───────┬───────┘                     └─────────┬─────────┘
        │                                       │
        │ due scans                             │
        ▼                                       │
┌───────────────┐                               │
│ TriggerScan() │◄──────────────────────────────┘
└───────┬───────┘
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│ Create PipelineRun + StepRuns                              │
│ Call scheduleWorkflowSteps()                               │
│   └─► For each ready step:                                │
│       └─► findWorkerForStep(tool) → worker_id             │
│       └─► Create command with worker_id                   │
└───────────────────────────────────────────────────────────┘
```

### 2. Command Execution

```
┌───────────────┐     GET /commands      ┌───────────────────┐
│    Worker     │ ─────────────────────► │   API Server      │
│ (polls every  │                        │                   │
│  30 seconds)  │◄───────────────────────│ Filter by tenant  │
└───────┬───────┘     commands[]         │ + worker_id       │
        │                                └───────────────────┘
        │ execute
        ▼
┌───────────────┐
│ Run scanner   │
│ (nuclei, etc) │
└───────┬───────┘
        │
        ▼
┌───────────────┐     POST /complete     ┌───────────────────┐
│ Report result │ ─────────────────────► │ CommandHandler    │
│ {findings_cnt}│                        │                   │
└───────────────┘                        └─────────┬─────────┘
                                                   │
                                                   ▼
                                         ┌───────────────────┐
                                         │ triggerPipeline   │
                                         │ Progression()     │
                                         │   │               │
                                         │   ▼               │
                                         │ OnStepCompleted() │
                                         │   │               │
                                         │   ▼               │
                                         │ Schedule next     │
                                         │ dependent steps   │
                                         └───────────────────┘
```

## Key Components

### Scan Scheduler (`api/internal/app/scan_scheduler.go`)

Runs every minute to trigger due scans:

```go
func (s *ScanScheduler) checkAndTrigger() {
    // Find scans where next_run_at <= NOW
    dueScans, _ := s.scanRepo.ListDueForExecution(ctx, now)

    for _, sc := range dueScans {
        // Prevent double-trigger
        if s.isRunning(sc.ID) {
            continue
        }

        // Trigger and update next_run_at
        go s.triggerScan(sc)
    }
}
```

### Pipeline Progression (`api/internal/app/pipeline_service.go`)

Called when command completes:

```go
func (s *PipelineService) OnStepCompleted(ctx, runID, stepKey, findingsCount, output) {
    // Update step run status
    stepRun.Complete(findingsCount, output)

    // Check pipeline completion
    if run.AllStepsCompleted() {
        run.Complete()
        return
    }

    // Schedule dependent steps
    s.scheduleRunnableSteps(ctx, run)
}
```

### Worker-Tool Matching (`api/internal/infra/postgres/worker_repository.go`)

Routes commands to capable workers:

```go
func (r *WorkerRepository) FindAvailableWithTool(ctx, tenantID, tool) (*Worker, error) {
    // Find least-loaded worker with required tool
    query := `
        SELECT * FROM workers
        WHERE tenant_id = $1
          AND status = 'active'
          AND health IN ('online', 'unknown')
          AND $2 = ANY(tools)
        ORDER BY total_scans ASC
        LIMIT 1
    `
}
```

### Command Handler Wiring (`api/internal/infra/http/handler/command_handler.go`)

Triggers pipeline progression:

```go
func (h *CommandHandler) Complete(w, r) {
    // ... complete command ...

    // Trigger pipeline progression if pipeline command
    h.triggerPipelineProgression(ctx, cmd)
}

func (h *CommandHandler) triggerPipelineProgression(ctx, cmd) {
    // Extract pipeline info from payload
    var payload struct {
        PipelineRunID string `json:"pipeline_run_id"`
        StepKey       string `json:"step_key"`
    }
    json.Unmarshal(cmd.Payload, &payload)

    // Call OnStepCompleted asynchronously
    go h.pipelineService.OnStepCompleted(ctx, payload.PipelineRunID, ...)
}
```

## Why Not Kubernetes-Style Controllers?

| K8s Pattern | OpenCTEM Equivalent | Why Simpler |
|-------------|---------------------|-------------|
| Scheduler (Filter→Score→Bind) | `FindAvailableWithTool()` | Simple query, tenant isolation |
| Controller reconciliation loops | Event-driven `OnStepCompleted()` | More efficient, no polling |
| Shared worker pool | Per-tenant workers | Natural load isolation |
| Complex affinity rules | Tool matching | Workers declare their tools |

## SDK Compatibility

The SDK is **fully compatible** with this architecture:

| SDK Component | Compatibility | Notes |
|---------------|---------------|-------|
| `Command.Payload` | ✅ | Uses `json.RawMessage` - accepts any payload |
| `CommandResult.FindingsCount` | ✅ | Server uses this for pipeline progression |
| `CommandResult.Metadata` | ✅ | Can be used for output data |
| Poll mechanism | ✅ | Standard GET /commands |
| Complete mechanism | ✅ | Standard POST /commands/{id}/complete |

SDK doesn't need pipeline awareness - server handles all orchestration logic.

## Implementation Status

| Component | Status | Files |
|-----------|--------|-------|
| Scan Scheduler | ✅ Done | `api/internal/app/scan_scheduler.go` |
| Pipeline Progression | ✅ Done | `api/internal/app/pipeline_service.go` |
| Command Handler Wiring | ✅ Done | `api/internal/infra/http/handler/command_handler.go` |
| Worker-Tool Matching | ✅ Done | `api/internal/infra/postgres/worker_repository.go` |
| step_run_id on Commands | ✅ Done | `api/migrations/000043_scan_orchestration_indexes.up.sql` |
| Index Optimization | ✅ Done | `api/migrations/000043_scan_orchestration_indexes.up.sql` |
| End-to-end Testing | ⏳ Pending | Phase 2 |

### Phase 1 Complete ✅

All core components are implemented. Next steps:
1. Run migration 000043 on database
2. End-to-end testing with real scans
3. Edge case handling (no worker available, worker offline)

## Related Documentation

- [Scan Pipeline Design](./scan-pipeline-design)
- [Server-Agent Command Protocol](./server-agent-command)
- [SDK Integration Guide](/sdk/docs/README.md)
