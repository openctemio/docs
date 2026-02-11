# Retry Queue Implementation Plan

**Status:** 📋 Planning
**Created:** 2026-01-18

---

## Executive Summary

This document outlines the implementation plan for a **persistent retry queue** in the OpenCTEM SDK. The goal is to ensure that scan data is never lost due to temporary network failures or server unavailability.

---

## Problem Statement

**Current Behavior:**
- When `PushFindings()` fails after 3 retries (2s, 4s, 8s), the data is **permanently lost**
- No mechanism to store and retry failed uploads later
- No offline support for agents running in unreliable network environments

**Impact:**
- Lost security findings = incomplete vulnerability data
- Wasted compute resources (scans run but results not saved)
- Poor reliability in edge deployments (CI/CD runners, on-prem agents)

---

## Proposed Solution

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           RETRY SYSTEM ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐│
│  │   Scanner    │────▶│    Client    │────▶│   OpenCTEM Backend        ││
│  │   /Agent     │     │  PushFindings│     │   /api/v1/agent/ingest   ││
│  └──────────────┘     └──────┬───────┘     └──────────────────────────┘│
│                              │                                          │
│                         FAIL │ (after retries)                          │
│                              ▼                                          │
│                    ┌─────────────────┐                                  │
│                    │   RetryQueue    │                                  │
│                    │  ──────────────  │                                  │
│                    │  Interface:     │                                  │
│                    │  - Enqueue()    │                                  │
│                    │  - Dequeue()    │                                  │
│                    │  - Peek()       │                                  │
│                    │  - Size()       │                                  │
│                    │  - Cleanup()    │                                  │
│                    └────────┬────────┘                                  │
│                             │                                           │
│         ┌───────────────────┴───────────────────┐                      │
│         │                                       │                      │
│         ▼                                       ▼                      │
│  ┌─────────────────┐                   ┌─────────────────┐             │
│  │ FileRetryQueue  │                   │ SQLiteRetryQueue│             │
│  │ (Simple/Light)  │                   │ (Future/Heavy)  │             │
│  │                 │                   │                 │             │
│  │ - JSON files    │                   │ - SQLite DB     │             │
│  │ - Per-item file │                   │ - Single file   │             │
│  │ - No deps       │                   │ - Better query  │             │
│  └─────────────────┘                   └─────────────────┘             │
│                                                                         │
│                    ┌─────────────────┐                                  │
│                    │   RetryWorker   │                                  │
│                    │  ──────────────  │                                  │
│                    │  Background     │                                  │
│                    │  goroutine that │                                  │
│                    │  processes the  │                                  │
│                    │  queue          │                                  │
│                    └─────────────────┘                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Design

### 1. Core Types

```go
// pkg/retry/types.go

package retry

import (
    "time"
    "github.com/openctemio/sdk-go/pkg/ctis"
)

// QueueItem represents an item in the retry queue.
type QueueItem struct {
    ID          string       `json:"id"`           // Unique identifier
    Type        ItemType     `json:"type"`         // findings, assets, heartbeat
    Report      *ctis.Report  `json:"report"`       // The data to push
    Fingerprint string       `json:"fingerprint"`  // For deduplication

    // Retry tracking
    Attempts    int          `json:"attempts"`     // Number of retry attempts
    MaxAttempts int          `json:"max_attempts"` // Max retry attempts (default: 10)
    LastError   string       `json:"last_error"`   // Last error message
    LastAttempt time.Time    `json:"last_attempt"` // Last attempt timestamp
    NextRetry   time.Time    `json:"next_retry"`   // Scheduled next retry

    // Metadata
    CreatedAt   time.Time    `json:"created_at"`   // When item was queued
    WorkerID    string       `json:"worker_id"`    // Source worker
    ScannerName string       `json:"scanner_name"` // Source scanner
}

// ItemType defines the type of queued item.
type ItemType string

const (
    ItemTypeFindings  ItemType = "findings"
    ItemTypeAssets    ItemType = "assets"
    ItemTypeHeartbeat ItemType = "heartbeat"
)

// QueueStats provides queue statistics.
type QueueStats struct {
    TotalItems   int       `json:"total_items"`
    PendingItems int       `json:"pending_items"`
    FailedItems  int       `json:"failed_items"`
    OldestItem   time.Time `json:"oldest_item"`
    LastRetry    time.Time `json:"last_retry"`
}
```

### 2. RetryQueue Interface

```go
// pkg/retry/queue.go

package retry

import "context"

// RetryQueue defines the interface for retry queue implementations.
type RetryQueue interface {
    // Enqueue adds an item to the queue.
    // Returns the item ID or error.
    Enqueue(ctx context.Context, item *QueueItem) (string, error)

    // Dequeue removes and returns the next item ready for retry.
    // Returns nil if no items are ready.
    Dequeue(ctx context.Context) (*QueueItem, error)

    // Peek returns items ready for retry without removing them.
    Peek(ctx context.Context, limit int) ([]*QueueItem, error)

    // Update updates an existing item (after retry attempt).
    Update(ctx context.Context, item *QueueItem) error

    // Delete removes an item from the queue (after success).
    Delete(ctx context.Context, id string) error

    // Size returns the number of items in the queue.
    Size(ctx context.Context) (int, error)

    // Stats returns queue statistics.
    Stats(ctx context.Context) (*QueueStats, error)

    // Cleanup removes expired items (older than TTL).
    Cleanup(ctx context.Context, ttl time.Duration) (int, error)

    // Close closes the queue and releases resources.
    Close() error
}
```

### 3. FileRetryQueue Implementation

```go
// pkg/retry/file_queue.go

package retry

import (
    "context"
    "encoding/json"
    "os"
    "path/filepath"
    "sort"
    "sync"
    "time"
)

// FileRetryQueue implements RetryQueue using JSON files.
// Each queue item is stored as a separate JSON file.
// This provides simplicity and no external dependencies.
type FileRetryQueue struct {
    dir     string      // Directory to store queue files
    mu      sync.RWMutex
    verbose bool
}

// FileQueueConfig configures the file-based queue.
type FileQueueConfig struct {
    Dir     string // Directory path (default: ~/.openctem/retry-queue)
    Verbose bool   // Verbose logging
}

// NewFileRetryQueue creates a new file-based retry queue.
func NewFileRetryQueue(cfg *FileQueueConfig) (*FileRetryQueue, error) {
    if cfg.Dir == "" {
        home, _ := os.UserHomeDir()
        cfg.Dir = filepath.Join(home, ".openctem", "retry-queue")
    }

    // Ensure directory exists
    if err := os.MkdirAll(cfg.Dir, 0755); err != nil {
        return nil, err
    }

    return &FileRetryQueue{
        dir:     cfg.Dir,
        verbose: cfg.Verbose,
    }, nil
}

// File format: {timestamp}_{id}.json
// This allows natural sorting by creation time
```

### 4. RetryWorker (Background Processor)

```go
// pkg/retry/worker.go

package retry

import (
    "context"
    "sync"
    "time"

    "github.com/openctemio/sdk-go/pkg/core"
)

// RetryWorker processes the retry queue in the background.
type RetryWorker struct {
    queue       RetryQueue
    pusher      core.Pusher

    // Configuration
    interval    time.Duration // How often to check queue (default: 5m)
    batchSize   int           // Max items per batch (default: 10)
    maxAttempts int           // Max retry attempts (default: 10)
    ttl         time.Duration // Item TTL before cleanup (default: 7d)

    // State
    running     bool
    stopCh      chan struct{}
    wg          sync.WaitGroup
    mu          sync.Mutex

    // Callbacks
    onSuccess   func(item *QueueItem)
    onFail      func(item *QueueItem, err error)

    verbose     bool
}

// RetryWorkerConfig configures the retry worker.
type RetryWorkerConfig struct {
    Interval    time.Duration `yaml:"interval" json:"interval"`         // Default: 5m
    BatchSize   int           `yaml:"batch_size" json:"batch_size"`     // Default: 10
    MaxAttempts int           `yaml:"max_attempts" json:"max_attempts"` // Default: 10
    TTL         time.Duration `yaml:"ttl" json:"ttl"`                   // Default: 7d (168h)
    Verbose     bool          `yaml:"verbose" json:"verbose"`
}

// Exponential backoff calculation:
// attempt 1: 5 minutes
// attempt 2: 10 minutes
// attempt 3: 20 minutes
// attempt 4: 40 minutes
// attempt 5: 80 minutes (~1.3 hours)
// attempt 6: 160 minutes (~2.6 hours)
// attempt 7: 320 minutes (~5.3 hours)
// attempt 8: 640 minutes (~10.6 hours)
// attempt 9: 1280 minutes (~21 hours)
// attempt 10: 2560 minutes (~42 hours) - max
func calculateNextRetry(attempts int, baseInterval time.Duration) time.Time {
    backoff := baseInterval * time.Duration(1<<attempts)
    maxBackoff := 48 * time.Hour
    if backoff > maxBackoff {
        backoff = maxBackoff
    }
    return time.Now().Add(backoff)
}
```

### 5. Integration with Client

```go
// Updated pkg/client/client.go

type Client struct {
    // ... existing fields ...

    // Retry queue (optional)
    retryQueue  retry.RetryQueue
    retryWorker *retry.RetryWorker
}

type Config struct {
    // ... existing fields ...

    // Retry configuration
    EnableRetryQueue bool          `yaml:"enable_retry_queue" json:"enable_retry_queue"`
    RetryQueueDir    string        `yaml:"retry_queue_dir" json:"retry_queue_dir"`
    RetryInterval    time.Duration `yaml:"retry_interval" json:"retry_interval"`
    RetryMaxAttempts int           `yaml:"retry_max_attempts" json:"retry_max_attempts"`
    RetryTTL         time.Duration `yaml:"retry_ttl" json:"retry_ttl"`
}

// PushFindings with retry queue support
func (c *Client) PushFindings(ctx context.Context, report *ctis.Report) (*core.PushResult, error) {
    result, err := c.pushFindingsInternal(ctx, report)

    if err != nil && c.retryQueue != nil {
        // Queue for retry
        item := &retry.QueueItem{
            ID:          generateID(),
            Type:        retry.ItemTypeFindings,
            Report:      report,
            Fingerprint: report.Fingerprint(),
            CreatedAt:   time.Now(),
            WorkerID:    c.workerID,
        }

        if queueErr := c.retryQueue.Enqueue(ctx, item); queueErr != nil {
            // Log but don't fail - original error is more important
            if c.verbose {
                fmt.Printf(".openctem] Failed to queue for retry: %v\n", queueErr)
            }
        } else if c.verbose {
            fmt.Printf(".openctem] Queued for retry: %s\n", item.ID)
        }
    }

    return result, err
}
```

---

## Configuration

### YAML Config Example

```yaml
# agent.yaml

agent:
  name: "my-agent"
  scan_interval: 1h
  verbose: true

openctem:
  base_url: ${API_URL}
  api_key: ${API_KEY}
  worker_id: ${WORKER_ID}

  # Retry queue configuration
  enable_retry_queue: true
  retry_queue_dir: /var/lib/openctem/retry-queue  # Default: ~/.openctem/retry-queue
  retry_interval: 5m       # How often to process queue
  retry_max_attempts: 10   # Max retries per item
  retry_ttl: 168h          # 7 days - items older than this are deleted

scanners:
  - name: semgrep
    enabled: true
```

### Environment Variables

```bash
# Enable retry queue
export ENABLE_RETRY_QUEUE=true

# Custom queue directory
export RETRY_QUEUE_DIR=/var/lib/openctem/retry-queue

# Retry settings
export RETRY_INTERVAL=5m
export RETRY_MAX_ATTEMPTS=10
export RETRY_TTL=168h
```

---

## File Structure

```
sdk/
├── pkg/
│   ├── retry/
│   │   ├── types.go        # Core types (QueueItem, QueueStats, etc.)
│   │   ├── queue.go        # RetryQueue interface
│   │   ├── file_queue.go   # FileRetryQueue implementation
│   │   ├── worker.go       # RetryWorker (background processor)
│   │   ├── backoff.go      # Backoff calculation utilities
│   │   └── retry_test.go   # Tests
│   ├── client/
│   │   └── client.go       # Updated with retry integration
│   └── core/
│       └── base_agent.go   # Updated with retry integration
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Priority: High)
1. Create `pkg/retry/types.go` - Core types
2. Create `pkg/retry/queue.go` - Interface definition
3. Create `pkg/retry/file_queue.go` - File-based implementation
4. Create `pkg/retry/backoff.go` - Backoff utilities

### Phase 2: Background Processing (Priority: High)
1. Create `pkg/retry/worker.go` - Background worker
2. Add worker lifecycle (Start/Stop)
3. Add cleanup routine

### Phase 3: Integration (Priority: High)
1. Update `pkg/client/client.go` - Add retry queue support
2. Update `pkg/client/config.go` - Add config options
3. Update `pkg/core/base_agent.go` - Integrate with agent

### Phase 4: Testing & Documentation (Priority: Medium)
1. Unit tests for queue implementations
2. Integration tests with mock server
3. Update README and examples

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Data Loss | 0% (all failed uploads queued) |
| Retry Success Rate | >95% (within 24h) |
| Queue Overhead | <100MB disk for 1000 items |
| Memory Usage | <50MB for queue management |
| CPU Usage | <1% idle, <5% during retry |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Disk space exhaustion | Max queue size limit (default: 1000 items) |
| Duplicate data on retry | Fingerprint-based deduplication |
| Queue corruption | Atomic file writes, cleanup on error |
| Performance impact | Batch processing, configurable intervals |

---

## Alternatives Considered

1. **SQLite Queue**: More complex, better for large queues. Deferred to future.
2. **Redis Queue**: External dependency. Not suitable for embedded SDK.
3. **In-memory Queue**: Not persistent. Data lost on restart.
4. **WAL-based Queue**: Complex implementation. Overkill for this use case.

**Decision**: File-based queue is the best balance of simplicity, reliability, and no external dependencies.

---

## Timeline Estimate

| Phase | Duration |
|-------|----------|
| Phase 1: Core | 2-3 hours |
| Phase 2: Worker | 1-2 hours |
| Phase 3: Integration | 1-2 hours |
| Phase 4: Testing | 1-2 hours |
| **Total** | **5-9 hours** |

---

## Approval

- [ ] Architecture reviewed
- [ ] Implementation plan approved
- [ ] Ready to proceed

---

*Document Version: 1.0*
*Last Updated: 2026-01-18*
