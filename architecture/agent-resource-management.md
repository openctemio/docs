---
layout: default
title: Agent Resource Management
parent: Architecture
nav_order: 15
---
# Agent Resource Management Architecture

This document describes the agent-side resource management system including auto-cleanup, async upload pipeline, and CPU/memory throttling.

---

## Overview

Agents running as daemons need to manage local resources efficiently to prevent:
- **Disk bloat** from accumulated chunk data
- **Upload blocking** where scans wait for uploads to complete
- **Resource exhaustion** when CPU/memory usage is too high

The SDK provides three integrated solutions:

| Component | Purpose | Location |
|-----------|---------|----------|
| **Auto-Cleanup** | Prevent disk bloat | `sdk/pkg/chunk/` |
| **Async Pipeline** | Non-blocking uploads | `sdk/pkg/pipeline/` |
| **Resource Controller** | CPU/Memory throttling | `sdk/pkg/resource/` |
| **Audit Logger** | Comprehensive logging | `sdk/pkg/audit/` |

---

## Architecture Diagram

```
                    ┌────────────────────────┐
                    │   Resource Controller   │
                    │   (CPU/Memory Monitor)  │
                    └────────────┬───────────┘
                                 │ AcquireSlot()
                    ┌────────────▼───────────┐
                    │      Job Poller         │
                    │  (Respects capacity)    │
                    └────────────┬───────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           │                     │                     │
           ▼                     ▼                     ▼
    ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
    │   Scanner 1   │     │   Scanner 2   │     │   Scanner N   │
    └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
           │                     │                     │
           └──────────────┬──────┴──────────────┬──────┘
                          │                     │
                          ▼                     ▼
                   ┌──────────────┐     ┌──────────────────┐
                   │   Pipeline    │     │  Chunk Manager    │
                   │ (Async Queue) │     │ (Large Reports)   │
                   └──────┬───────┘     └────────┬─────────┘
                          │                      │
                          └─────────┬────────────┘
                                    │
                          ┌─────────▼─────────┐
                          │   Upload Workers   │
                          │ (Background Upload)│
                          └─────────┬─────────┘
                                    │
                          ┌─────────▼─────────┐
                          │   Auto-Cleanup     │
                          │ (Storage Manager)  │
                          └─────────┬─────────┘
                                    │
                          ┌─────────▼─────────┐
                          │   Audit Logger     │
                          │ (Event Tracking)   │
                          └───────────────────┘
```

---

## Auto-Cleanup Mechanism

### Problem
Agents processing large security reports accumulate chunk data on disk. Without cleanup, disk usage grows unbounded.

### Solution
Layered auto-cleanup strategy with multiple triggers:

```
Upload Success → Delete chunk data blob (keep metadata)
Report Complete → Delete all chunks for report
Every 15 min → Run retention cleanup (delete > 24h old)
Storage > MaxMB → Aggressive cleanup (oldest first)
```

### Configuration

```go
import "github.com/openctemio/sdk-go/pkg/chunk"

cfg := &chunk.Config{
    // Auto-cleanup (all enabled by default)
    AutoCleanupOnUpload:     true,   // Delete data after upload
    CleanupOnReportComplete: true,   // Delete all when done
    CleanupIntervalMinutes:  15,     // Periodic cleanup
    AggressiveCleanup:       true,   // Cleanup when over limit

    // Storage limits
    MaxStorageMB:   500,    // 500MB max storage
    RetentionHours: 24,     // Keep data for 24h max
}

manager, _ := chunk.NewManager(cfg)
```

### Cleanup Events

| Event | Action | Condition |
|-------|--------|-----------|
| Chunk uploaded | Delete chunk data | `AutoCleanupOnUpload=true` |
| Report complete | Delete all chunks | `CleanupOnReportComplete=true` |
| Periodic (15m) | Delete old chunks | Age > `RetentionHours` |
| Storage exceeded | Delete oldest | Size > `MaxStorageMB` |

### Storage Methods

```go
// Delete chunk data blob (keep metadata for tracking)
storage.DeleteChunkData(ctx, chunkID)

// Delete all chunks for a report
deleted, _ := storage.DeleteReportChunks(ctx, reportID)

// Aggressive cleanup to target size
deleted, _ := storage.CleanupToSize(ctx, maxBytes)
```

---

## Async Upload Pipeline

### Problem
Scans block waiting for uploads to complete. This is especially problematic when:
- Agent runs as daemon with many concurrent jobs
- Network is slow or unreliable
- Large reports take significant time to upload

### Solution
Queue-based async pipeline that separates scan and upload processes.

```
Scanner → Pipeline.Submit() → Queue → Workers → Uploader → API
    ↓                           ↓
(Returns immediately)    (Background processing)
```

### Configuration

```go
import "github.com/openctemio/sdk-go/pkg/pipeline"

cfg := &pipeline.PipelineConfig{
    QueueSize:     1000,             // Max pending uploads
    Workers:       3,                // Concurrent upload workers
    RetryAttempts: 3,                // Retry failed uploads
    RetryDelay:    5 * time.Second,  // Base retry delay
    UploadTimeout: 2 * time.Minute,  // Per-upload timeout

    // Callbacks
    OnSubmitted: func(item *pipeline.QueueItem) {
        log.Printf("Queued: %s", item.ID)
    },
    OnCompleted: func(item *pipeline.QueueItem, result *pipeline.Result) {
        log.Printf("Uploaded: %s, findings=%d", item.ID, result.FindingsCreated)
    },
    OnFailed: func(item *pipeline.QueueItem, err error) {
        log.Printf("Failed: %s, error=%v", item.ID, err)
    },
}

p := pipeline.NewPipeline(cfg, uploader)
p.Start(ctx)
```

### Usage

```go
// Submit report (non-blocking)
id, err := p.Submit(report,
    pipeline.WithJobID("job-123"),
    pipeline.WithTenantID("tenant-456"),
    pipeline.WithPriority(10),
)
if err != nil {
    // Queue full
}

// Continue scanning immediately
nextReport := scanner.Scan(target)

// Optionally wait for all uploads
p.Flush(ctx)

// Get statistics
stats := p.GetStats()
// {Submitted: 100, Completed: 95, Failed: 2, InProgress: 3}
```

### Retry Strategy

Failed uploads are retried with exponential backoff:

```
Attempt 1 → Immediate
Attempt 2 → Wait 5s (base delay)
Attempt 3 → Wait 10s (2x backoff)
Attempt 4 → Wait 20s (2x backoff)
```

After all retries exhausted, the `OnFailed` callback is invoked.

---

## Resource Controller

### Problem
Agents consuming too much CPU/memory can destabilize the host system or degrade scan quality.

### Solution
Resource monitoring with job admission control.

```go
import "github.com/openctemio/sdk-go/pkg/resource"

cfg := &resource.ControllerConfig{
    CPUThreshold:      85.0,              // Pause above 85% CPU
    MemoryThreshold:   85.0,              // Pause above 85% memory
    MaxConcurrentJobs: runtime.NumCPU(),  // Max parallel jobs
    MinConcurrentJobs: 1,                 // Always allow 1 job
    SampleInterval:    5 * time.Second,   // Check every 5s
    CooldownDuration:  30 * time.Second,  // Wait before resuming

    // Callbacks
    OnThresholdExceeded: func(metrics *resource.SystemMetrics, reason string) {
        log.Printf("Throttling: %s", reason)
    },
    OnThresholdCleared: func(metrics *resource.SystemMetrics) {
        log.Printf("Resuming normal operation")
    },
}

controller := resource.NewController(cfg)
controller.Start(ctx)
```

### Job Admission

```go
// Non-blocking: try to acquire slot
if controller.AcquireSlot(ctx) {
    defer controller.ReleaseSlot()
    executeJob()
} else {
    // Throttled or at capacity - retry later
    requeue(job)
}

// Blocking: wait for slot
if err := controller.AcquireSlotBlocking(ctx); err == nil {
    defer controller.ReleaseSlot()
    executeJob()
}
```

### Status Monitoring

```go
status := controller.GetStatus()
// {
//   Throttled: true,
//   ThrottleReason: "CPU 90% >= 85%",
//   ActiveJobs: 4,
//   PendingJobs: 2,
//   RejectedJobs: 15,
//   MaxJobs: 4,
//   Metrics: { CPUPercent: 90.5, MemoryPercent: 72.3, ... }
// }
```

### Adaptive Scaling

```go
// Get recommended max jobs based on current load
recommended := controller.AdaptiveMaxJobs()

// Dynamically adjust
controller.SetMaxConcurrentJobs(recommended)
```

### Metrics Collected

| Metric | Source | Description |
|--------|--------|-------------|
| `CPUPercent` | Goroutine heuristic | Estimated CPU usage |
| `MemoryPercent` | `runtime.MemStats` | Heap allocation percentage |
| `MemoryUsedMB` | `runtime.MemStats` | Current heap usage |
| `NumGoroutines` | `runtime.NumGoroutine()` | Active goroutines |

---

## Audit Logger

### Problem
Agent errors and state changes need to be logged for debugging and compliance.

### Solution
Structured audit logging with buffered writes and optional remote collection.

```go
import "github.com/openctemio/sdk-go/pkg/audit"

cfg := &audit.LoggerConfig{
    AgentID:       "agent-001",
    TenantID:      "tenant-123",
    LogFile:       "~/.openctem/audit.log",
    MaxSizeMB:     100,           // Rotate at 100MB
    MaxAgeDays:    30,            // Keep logs for 30 days
    BufferSize:    100,           // Buffer 100 events
    FlushInterval: 5 * time.Second,
    Verbose:       true,          // Console output
}

logger, _ := audit.NewLogger(cfg)
logger.Start()
defer logger.Stop()
```

### Event Types

```go
// Lifecycle events
audit.EventAgentStart    // Agent started
audit.EventAgentStop     // Agent stopped
audit.EventAgentError    // Agent error

// Job events
audit.EventJobReceived   // Job received from server
audit.EventJobStarted    // Job execution started
audit.EventJobCompleted  // Job completed successfully
audit.EventJobFailed     // Job failed
audit.EventJobTimeout    // Job timed out

// Scan events
audit.EventScanStarted   // Scan started
audit.EventScanCompleted // Scan completed
audit.EventScanFailed    // Scan failed

// Upload events
audit.EventUploadStarted   // Upload started
audit.EventUploadCompleted // Upload completed
audit.EventUploadFailed    // Upload failed
audit.EventUploadRetry     // Upload retry

// Chunk events
audit.EventChunkCreated   // Chunk created
audit.EventChunkUploaded  // Chunk uploaded
audit.EventChunkFailed    // Chunk failed
audit.EventChunkCleanup   // Chunk cleanup

// Resource events
audit.EventResourceThrottle // Resource throttling activated
audit.EventResourceResume   // Resource throttling cleared
audit.EventResourceWarning  // Resource warning

// Security events
audit.EventAuthFailed      // Authentication failed
audit.EventRateLimited     // Rate limited
audit.EventValidationError // Validation error
```

### Logging Methods

```go
// Convenience methods
logger.Info(audit.EventJobStarted, "Starting scan", map[string]interface{}{
    "target": "/path/to/project",
    "tool": "semgrep",
})

logger.Error(audit.EventJobFailed, "Scan failed", err, map[string]interface{}{
    "exit_code": 1,
})

// Specialized methods
logger.JobStarted(jobID, "scan", details)
logger.JobCompleted(jobID, duration, details)
logger.JobFailed(jobID, err, details)
logger.ChunkUploaded(reportID, chunkIndex, totalChunks, size)
logger.ResourceThrottle("CPU 90% >= 85%", metrics)
```

### Context Logger

```go
// Create context-aware logger for a job
jobLogger := logger.WithContext(ctx, jobID, reportID)

jobLogger.Info(audit.EventScanStarted, "Scan started", nil)
// Automatically includes jobID and reportID
```

### Log Format

Events are written as JSON lines:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "type": "job_completed",
  "severity": "INFO",
  "agent_id": "agent-001",
  "tenant_id": "tenant-123",
  "job_id": "job-456",
  "message": "Job completed successfully",
  "duration_ms": 45000,
  "details": {
    "findings_count": 23,
    "tool": "semgrep"
  }
}
```

---

## Integration Example

Complete example integrating all components:

```go
package main

import (
    "context"
    "os"
    "os/signal"
    "syscall"

    "github.com/openctemio/sdk-go/pkg/audit"
    "github.com/openctemio/sdk-go/pkg/chunk"
    "github.com/openctemio/sdk-go/pkg/pipeline"
    "github.com/openctemio/sdk-go/pkg/resource"
)

func main() {
    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    // Handle signals
    sigCh := make(chan os.Signal, 1)
    signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
    go func() {
        <-sigCh
        cancel()
    }()

    // 1. Initialize audit logger
    auditLogger, _ := audit.NewLogger(&audit.LoggerConfig{
        AgentID:  "agent-001",
        LogFile:  "~/.openctem/audit.log",
        Verbose:  true,
    })
    auditLogger.Start()
    defer auditLogger.Stop()

    // 2. Initialize resource controller
    controller := resource.NewController(&resource.ControllerConfig{
        CPUThreshold:      85.0,
        MemoryThreshold:   85.0,
        MaxConcurrentJobs: 4,
        OnThresholdExceeded: func(metrics *resource.SystemMetrics, reason string) {
            auditLogger.ResourceThrottle(reason, map[string]interface{}{
                "cpu":    metrics.CPUPercent,
                "memory": metrics.MemoryPercent,
            })
        },
    })
    controller.Start(ctx)
    defer controller.Stop()

    // 3. Initialize chunk manager (for large reports)
    chunkManager, _ := chunk.NewManager(&chunk.Config{
        AutoCleanupOnUpload:     true,
        CleanupOnReportComplete: true,
        MaxStorageMB:            500,
    })
    defer chunkManager.Close()

    // 4. Initialize async pipeline
    uploadPipeline := pipeline.NewPipeline(&pipeline.PipelineConfig{
        QueueSize: 1000,
        Workers:   3,
        OnCompleted: func(item *pipeline.QueueItem, result *pipeline.Result) {
            auditLogger.Info(audit.EventUploadCompleted, "Upload completed", map[string]interface{}{
                "report_id": result.ReportID,
                "findings":  result.FindingsCreated,
            })
        },
    }, uploader)
    uploadPipeline.Start(ctx)
    defer uploadPipeline.Stop(ctx)

    // 5. Main job loop
    for {
        select {
        case <-ctx.Done():
            return
        case job := <-jobQueue:
            // Check resource availability
            if !controller.AcquireSlot(ctx) {
                auditLogger.Info(audit.EventResourceWarning, "Job queued due to resource limits", nil)
                requeue(job)
                continue
            }

            go func(j Job) {
                defer controller.ReleaseSlot()

                auditLogger.JobStarted(j.ID, j.Type, nil)

                // Execute scan
                report, err := executeJob(ctx, j)
                if err != nil {
                    auditLogger.JobFailed(j.ID, err, nil)
                    return
                }

                // Submit to async pipeline (non-blocking)
                if _, err := uploadPipeline.Submit(report, pipeline.WithJobID(j.ID)); err != nil {
                    // Queue full, use chunk manager for persistence
                    chunkManager.SubmitReport(ctx, report)
                }

                auditLogger.JobCompleted(j.ID, time.Since(start), nil)
            }(job)
        }
    }
}
```

---

## Configuration Reference

### Chunk Manager Config

| Option | Default | Description |
|--------|---------|-------------|
| `MinFindingsForChunking` | 2000 | Minimum findings to trigger chunking |
| `MinAssetsForChunking` | 200 | Minimum assets to trigger chunking |
| `MinSizeForChunking` | 5MB | Minimum raw size to trigger chunking |
| `MaxFindingsPerChunk` | 500 | Max findings per chunk |
| `MaxAssetsPerChunk` | 100 | Max assets per chunk |
| `MaxChunkSizeBytes` | 2MB | Max uncompressed chunk size |
| `UploadDelayMs` | 100 | Delay between chunk uploads |
| `MaxConcurrentUploads` | 2 | Max concurrent upload workers |
| `MaxRetries` | 3 | Max retries per chunk |
| `DatabasePath` | `~/.openctem/chunks.db` | SQLite database path |
| `RetentionHours` | 24 | Keep completed chunks for N hours |
| `MaxStorageMB` | 500 | Max storage for chunk DB |
| `CompressionLevel` | 3 | ZSTD compression level (1-9) |
| `AutoCleanupOnUpload` | true | Delete chunk after upload |
| `CleanupOnReportComplete` | true | Delete all chunks when done |
| `CleanupIntervalMinutes` | 15 | Periodic cleanup interval |
| `AggressiveCleanup` | true | Cleanup when over limit |

### Pipeline Config

| Option | Default | Description |
|--------|---------|-------------|
| `QueueSize` | 1000 | Max pending uploads |
| `Workers` | 3 | Concurrent upload workers |
| `RetryAttempts` | 3 | Retry attempts for failed uploads |
| `RetryDelay` | 5s | Base delay between retries |
| `UploadTimeout` | 2m | Timeout per upload |
| `Verbose` | false | Enable debug logging |

### Resource Controller Config

| Option | Default | Description |
|--------|---------|-------------|
| `CPUThreshold` | 85.0 | CPU percentage to trigger throttle |
| `MemoryThreshold` | 85.0 | Memory percentage to trigger throttle |
| `MaxConcurrentJobs` | `runtime.NumCPU()` | Max parallel jobs |
| `MinConcurrentJobs` | 1 | Minimum jobs even under load |
| `SampleInterval` | 5s | Metric sampling interval |
| `CooldownDuration` | 30s | Wait before resuming after throttle |
| `Verbose` | false | Enable debug logging |

### Audit Logger Config

| Option | Default | Description |
|--------|---------|-------------|
| `AgentID` | "" | Agent identifier for all events |
| `TenantID` | "" | Tenant identifier |
| `LogFile` | `~/.openctem/audit.log` | Audit log file path |
| `MaxSizeMB` | 100 | Max log file size before rotation |
| `MaxAgeDays` | 30 | Max age before deletion |
| `BufferSize` | 100 | Events to buffer before flush |
| `FlushInterval` | 5s | Auto-flush interval |
| `RemoteEndpoint` | "" | Optional remote log collection URL |
| `Verbose` | false | Console output |

---

## Security Considerations

### Zipbomb Protection

The chunk decompression includes protection against zipbombs:

```go
// Limits in decompress middleware
MaxCompressedSize:   10 * 1024 * 1024  // 10MB max compressed
MaxDecompressedSize: 50 * 1024 * 1024  // 50MB max decompressed
MaxCompressionRatio: 100.0              // 100:1 max ratio
```

### Input Validation

Server-side validation prevents DoS:

```go
MaxTotalChunks   = 10000        // Max chunks per report
MaxChunkDataSize = 10 * 1024 * 1024  // 10MB per chunk
MaxReportIDLen   = 256          // Report ID length limit
```

### Tenant Isolation

- Chunks are stored with tenant context
- Report IDs are validated for allowed characters
- Cross-tenant access is prevented at storage layer

### Audit Trail

All operations are logged with:
- Agent ID and Tenant ID
- Operation type and timestamp
- Request/response sizes
- Error details

---

## Related Documentation

- [SDK Development Guide](../guides/sdk-development.md) - Full SDK documentation
- [Running Agents](../guides/running-agents.md) - Agent deployment guide
- [Scan Pipeline Design](scan-pipeline-design.md) - Server-side pipeline
- [Server-Agent Communication](server-agent-command.md) - Command protocol
