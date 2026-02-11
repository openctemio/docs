---
layout: default
title: Notification Outbox Pattern
parent: Architecture
nav_order: 21
---

# Notification Outbox Pattern

## Overview

This document describes the implementation of the **Transactional Outbox Pattern** for reliable notification delivery in the OpenCTEM.io platform.

> **Important Note**: This system focuses on tenant-facing features. Admin features (system-wide monitoring, cross-tenant management) will be developed in a separate backend and frontend later.

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Solution Architecture](#solution-architecture)
3. [Database Schema](#database-schema)
4. [Processing Flows](#processing-flows)
5. [Integration Points](#integration-points)
6. [Admin Management](#admin-management)
7. [UI Features](#ui-features)
8. [Configuration](#configuration)
9. [Monitoring](#monitoring)
10. [Troubleshooting](#troubleshooting)
11. [Testing](#testing)

---

## Problem Statement

When an event occurs (e.g., a new finding is created), we need to:
1. Save the business data to the database
2. Send notifications to all configured channels (Slack, Teams, Email, etc.)

The challenge is ensuring **atomicity** - if we save the data but the notification fails, or vice versa, we end up with inconsistent state.

### Previous Approach (Issues)

```go
// Old approach - Fire-and-forget goroutine
if s.findingNotifier != nil {
    go s.findingNotifier.NotifyNewFinding(...) // Unreliable!
}
```

**Problems:**
- Lost notifications if server crashes before goroutine completes
- No retry mechanism for failed notifications
- No persistence - notifications lost on restart
- Difficult to monitor and debug
- No rate limiting or backpressure

---

## Solution Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BUSINESS EVENT                                   │
│                    (e.g., New Finding Created)                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    SAME DATABASE TRANSACTION                             │
├─────────────────────────────────────────────────────────────────────────┤
│  1. INSERT INTO findings (...)           -- Business data               │
│  2. INSERT INTO notification_outbox      -- Notification task           │
│     (status='pending', event_type='new_finding', ...)                   │
│  3. COMMIT                               -- Both or neither             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION SCHEDULER (Background)                   │
├─────────────────────────────────────────────────────────────────────────┤
│  Every 5 seconds:                                                        │
│  1. SELECT ... FROM notification_outbox                                  │
│     WHERE status='pending' AND scheduled_at <= NOW()                     │
│     FOR UPDATE SKIP LOCKED                                               │
│     LIMIT 50                                                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION SERVICE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  For each outbox entry:                                                  │
│  1. Get all notification integrations for tenant                         │
│  2. Filter by event_type and severity                                    │
│  3. Send to each matching integration (Slack, Teams, Email, etc.)        │
│  4. Archive to notification_events (audit log)                           │
│  5. Update outbox status (completed/failed)                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Why Polling over LISTEN/NOTIFY?

PostgreSQL LISTEN/NOTIFY has scalability limitations:

> "When a NOTIFY query is issued during a transaction, it acquires a global lock on the entire database during the commit phase, effectively serializing all commits."

**Polling with FOR UPDATE SKIP LOCKED:**
- No global locks
- Concurrent workers supported
- Reliable under high load
- Simple to implement and debug

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              API Server                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │ VulnerabilityService│    │  ExposureService │    │  Other Services  │  │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘  │
│           │                       │                        │            │
│           └───────────────────────┼────────────────────────┘            │
│                                   │                                      │
│                                   ▼                                      │
│                    ┌──────────────────────────┐                          │
│                    │   NotificationService    │                          │
│                    │  EnqueueNotificationInTx │                          │
│                    └──────────────────────────┘                          │
│                                   │                                      │
│           ┌───────────────────────┼───────────────────────┐             │
│           │                       │                       │             │
│           ▼                       ▼                       ▼             │
│  ┌─────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐ │
│  │ OutboxRepository│  │NotificationExtension│  │ NotificationHistory │ │
│  │   (PostgreSQL)  │  │    Repository       │  │    Repository       │ │
│  └─────────────────┘  └─────────────────────┘  └─────────────────────┘ │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│                    ┌──────────────────────────┐                          │
│                    │  NotificationScheduler   │                          │
│                    │   (Background Worker)    │                          │
│                    └──────────────────────────┘                          │
│                              │                                           │
│                              ▼                                           │
│                    ┌──────────────────────────┐                          │
│                    │   Notification Clients   │                          │
│                    │ Slack│Teams│Telegram│... │                          │
│                    └──────────────────────────┘                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### notification_outbox Table

```sql
CREATE TABLE notification_outbox (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Event Source (following Debezium convention)
    event_type VARCHAR(100) NOT NULL,       -- 'new_finding', 'scan_completed'
    aggregate_type VARCHAR(100) NOT NULL,   -- 'finding', 'scan', 'asset'
    aggregate_id UUID,                      -- ID of source entity (nullable for system events)

    -- Notification Payload
    title VARCHAR(500) NOT NULL,
    body TEXT,
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    url VARCHAR(2000),
    metadata JSONB DEFAULT '{}',

    -- Processing State
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    last_error TEXT,

    -- Scheduling
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMPTZ,
    locked_by VARCHAR(100),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT notification_outbox_status_check
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead'))
);

-- Indexes for efficient polling
CREATE INDEX idx_notification_outbox_pending
    ON notification_outbox (scheduled_at)
    WHERE status = 'pending';

CREATE INDEX idx_notification_outbox_tenant
    ON notification_outbox (tenant_id);

CREATE INDEX idx_notification_outbox_status
    ON notification_outbox (status);
```

### Status Lifecycle

```
                    ┌─────────────────────────────────────────────┐
                    │                                             │
                    │     ┌─────────┐                             │
                    │     │ pending │ ◄────────────────────────┐  │
                    │     └────┬────┘                          │  │
                    │          │                               │  │
                    │          │ Worker picks up               │  │
                    │          │ (FOR UPDATE SKIP LOCKED)      │  │
                    │          ▼                               │  │
                    │     ┌────────────┐                       │  │
                    │     │ processing │                       │  │
                    │     └─────┬──────┘                       │  │
                    │           │                              │  │
                    │      ┌────┴────┐                         │  │
                    │      │         │                         │  │
                    │      ▼         ▼                         │  │
                    │ ┌─────────┐ ┌────────┐                   │  │
                    │ │completed│ │ failed │ ──────────────────┘  │
                    │ └─────────┘ └────┬───┘   Retry             │
                    │                  │       (if retry_count   │
                    │                  │        < max_retries)   │
                    │                  │                         │
                    │                  │ Retries exhausted       │
                    │                  ▼                         │
                    │              ┌──────┐                      │
                    │              │ dead │                      │
                    │              └──────┘                      │
                    │         (Manual intervention               │
                    │          required)                         │
                    │                                             │
                    └─────────────────────────────────────────────┘
```

### Status Descriptions

| Status | Description | Next State |
|--------|-------------|------------|
| `pending` | Waiting to be processed | `processing` |
| `processing` | Currently being handled by a worker | `completed`, `failed` |
| `completed` | Successfully sent to all matching integrations | Terminal |
| `failed` | Failed but retries available, scheduled for retry | `pending` |
| `dead` | All retries exhausted, requires manual intervention | `pending` (via admin retry) |

---

## Processing Flows

### Flow 1: Creating a Finding with Notification

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    VulnerabilityService.CreateFinding()                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. Begin Transaction                                                     │
│    tx, err := s.db.BeginTx(ctx, nil)                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. Create Finding in Transaction                                         │
│    finding, err := s.findingRepo.CreateInTx(ctx, tx, finding)           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. Enqueue Notification in SAME Transaction                              │
│    err = s.notificationService.EnqueueNotificationInTx(ctx, tx, params) │
│                                                                          │
│    params:                                                               │
│      - TenantID: finding.TenantID                                       │
│      - EventType: "new_finding"                                         │
│      - AggregateType: "finding"                                         │
│      - AggregateID: &finding.ID                                         │
│      - Title: "New Critical Finding: SQL Injection"                     │
│      - Severity: "critical"                                             │
│      - URL: "/findings/abc-123"                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. Commit Transaction                                                    │
│    err = tx.Commit()                                                    │
│                                                                          │
│    Result: Both finding AND outbox entry created atomically             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Flow 2: Processing Outbox Entries

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    NotificationScheduler (Every 5 seconds)               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. Fetch Pending Batch                                                   │
│    entries, err := outboxRepo.FetchPendingBatch(ctx, workerID, 50)      │
│                                                                          │
│    SQL:                                                                  │
│    SELECT * FROM notification_outbox                                     │
│    WHERE status = 'pending' AND scheduled_at <= NOW()                    │
│    ORDER BY scheduled_at ASC                                             │
│    LIMIT 50                                                              │
│    FOR UPDATE SKIP LOCKED                                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. For Each Entry: Process                                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│   Entry 1     │          │   Entry 2     │          │   Entry N     │
│  (Finding)    │          │  (Exposure)   │          │    (...)      │
└───────┬───────┘          └───────┬───────┘          └───────┬───────┘
        │                           │                           │
        ▼                           ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. Get Notification Integrations for Tenant                              │
│    integrations := getNotificationIntegrationsForTenant(tenantID)       │
│                                                                          │
│    Returns all channels: Slack, Teams, Telegram, Email, Webhook         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. Filter by Event Type and Severity                                     │
│                                                                          │
│    for each integration:                                                 │
│      if !ext.ShouldNotifyEventType(entry.EventType) → SKIP              │
│      if !ext.ShouldNotify(entry.Severity) → SKIP                        │
│      → SEND                                                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. Send to Each Matching Integration                                     │
│                                                                          │
│    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│    │   Slack     │  │   Teams     │  │  Telegram   │  │   Email     │  │
│    │  #alerts    │  │  Security   │  │  @devops    │  │  ops@co.com │  │
│    └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │
│           │                │                │                │         │
│           ▼                ▼                ▼                ▼         │
│        SUCCESS          SUCCESS          FAILED           SUCCESS      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 6. Record History & Update Status                                        │
│                                                                          │
│    - Archive results to notification_events                              │
│    - If at least 1 success → Mark outbox entry as COMPLETED             │
│    - If all failed → Mark as FAILED (schedule retry with backoff)       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Flow 3: Multi-Channel Routing

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TENANT: "Acme Corp"                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Integration 1: Telegram "Security Team"                                 │
│    - enabledEventTypes: ["new_finding", "finding_confirmed"]            │
│    - enabledSeverities: ["critical", "high"]                            │
│                                                                          │
│  Integration 2: Telegram "DevOps Team"                                   │
│    - enabledEventTypes: ["scan_started", "scan_completed", "scan_failed"]│
│    - enabledSeverities: ["critical", "high", "medium"]                  │
│                                                                          │
│  Integration 3: Email "security@acme.com"                                │
│    - enabledEventTypes: ["new_exposure", "exposure_resolved"]           │
│    - enabledSeverities: ["critical", "high", "medium", "low"]           │
│                                                                          │
│  Integration 4: Slack "#all-alerts"                                      │
│    - enabledEventTypes: [] (empty = ALL events)                         │
│    - enabledSeverities: ["critical"]                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  Event: New Finding (Critical SQL Injection)                             │
│    - event_type: "new_finding"                                          │
│    - severity: "critical"                                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Routing Result:                                                         │
│                                                                          │
│  ✅ Integration 1 (Telegram Security)                                    │
│     - Event "new_finding" ∈ ["new_finding", "finding_confirmed"] ✓      │
│     - Severity "critical" ∈ ["critical", "high"] ✓                      │
│     → SEND                                                               │
│                                                                          │
│  ❌ Integration 2 (Telegram DevOps)                                      │
│     - Event "new_finding" ∉ ["scan_started", "scan_completed", ...] ✗   │
│     → SKIP                                                               │
│                                                                          │
│  ❌ Integration 3 (Email security@)                                      │
│     - Event "new_finding" ∉ ["new_exposure", "exposure_resolved"] ✗     │
│     → SKIP                                                               │
│                                                                          │
│  ✅ Integration 4 (Slack #all-alerts)                                    │
│     - Event types empty = ALL events ✓                                  │
│     - Severity "critical" ∈ ["critical"] ✓                              │
│     → SEND                                                               │
│                                                                          │
│  Result: 2 channels receive the notification                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Flow 4: Retry with Exponential Backoff

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Initial Attempt (retry_count = 0)                     │
│                    scheduled_at = NOW()                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ FAILED
┌─────────────────────────────────────────────────────────────────────────┐
│                    Retry 1 (retry_count = 1)                             │
│                    scheduled_at = NOW() + 2 minutes                      │
│                    Backoff: 2^1 = 2 minutes                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ FAILED
┌─────────────────────────────────────────────────────────────────────────┐
│                    Retry 2 (retry_count = 2)                             │
│                    scheduled_at = NOW() + 4 minutes                      │
│                    Backoff: 2^2 = 4 minutes                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ FAILED
┌─────────────────────────────────────────────────────────────────────────┐
│                    Retry 3 (retry_count = 3)                             │
│                    scheduled_at = NOW() + 8 minutes                      │
│                    Backoff: 2^3 = 8 minutes                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ FAILED (retry_count >= max_retries)
┌─────────────────────────────────────────────────────────────────────────┐
│                    Status: FAILED → DEAD                                 │
│                    Requires manual intervention via Admin API            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Integration Points

### Business Services Integration

Currently integrated with:

| Service | Event Types | File |
|---------|-------------|------|
| VulnerabilityService | `new_finding` | `api/internal/app/vulnerability_service.go` |
| ExposureService | `new_exposure` | `api/internal/app/exposure_service.go` |

### Adding New Integration

To integrate a new service with transactional notifications:

```go
// 1. Add CreateInTx method to repository interface
type MyRepository interface {
    Create(ctx context.Context, entity *MyEntity) error
    CreateInTx(ctx context.Context, tx *sql.Tx, entity *MyEntity) error
    // ...
}

// 2. Implement CreateInTx in postgres repository
func (r *MyRepository) CreateInTx(ctx context.Context, tx *sql.Tx, entity *MyEntity) error {
    query := `INSERT INTO my_table (...) VALUES (...)`
    _, err := tx.ExecContext(ctx, query, ...)
    return err
}

// 3. Add notification service to your service
type MyService struct {
    repo                MyRepository
    db                  *sql.DB
    notificationService *NotificationService
    log                 *logger.Logger
}

func (s *MyService) SetNotificationService(db *sql.DB, svc *NotificationService) {
    s.db = db
    s.notificationService = svc
}

// 4. Use transactional pattern
func (s *MyService) Create(ctx context.Context, input CreateInput) (*MyEntity, error) {
    // Check if notification service is available
    if s.db == nil || s.notificationService == nil {
        // Fallback to non-transactional create
        return s.repo.Create(ctx, entity)
    }

    // Begin transaction
    tx, err := s.db.BeginTx(ctx, nil)
    if err != nil {
        return nil, fmt.Errorf("begin transaction: %w", err)
    }
    defer func() { _ = tx.Rollback() }()

    // Create entity in transaction
    if err := s.repo.CreateInTx(ctx, tx, entity); err != nil {
        return nil, err
    }

    // Enqueue notification in SAME transaction
    err = s.notificationService.EnqueueNotificationInTx(ctx, tx, EnqueueNotificationParams{
        TenantID:      input.TenantID,
        EventType:     "my_event_type",
        AggregateType: "my_entity",
        AggregateID:   &entity.ID,
        Title:         fmt.Sprintf("New Entity: %s", entity.Name),
        Severity:      "medium",
        URL:           fmt.Sprintf("/my-entities/%s", entity.ID),
    })
    if err != nil {
        return nil, fmt.Errorf("enqueue notification: %w", err)
    }

    // Commit transaction
    if err := tx.Commit(); err != nil {
        return nil, fmt.Errorf("commit transaction: %w", err)
    }

    return entity, nil
}

// 5. Wire up in main.go
myService.SetNotificationService(db.DB, notificationService)
```

---

## Tenant Management

> **Note**: This API is designed for tenant-facing features. Tenants can only view and manage their own notifications (tenant-scoped). System-wide admin features will be developed later in a separate backend.

### API Endpoints (Tenant-Scoped)

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/api/v1/notification-outbox` | `integrations:notifications:read` | List outbox entries for current tenant |
| GET | `/api/v1/notification-outbox/stats` | `integrations:notifications:read` | Get statistics for current tenant |
| GET | `/api/v1/notification-outbox/{id}` | `integrations:notifications:read` | Get single entry (must belong to tenant) |
| POST | `/api/v1/notification-outbox/{id}/retry` | `integrations:notifications:write` | Retry failed/dead entry (must belong to tenant) |
| DELETE | `/api/v1/notification-outbox/{id}` | `integrations:notifications:delete` | Delete entry (must belong to tenant) |

### Query Parameters for List

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `status` | string | Filter by status (pending, processing, completed, failed, dead) | - |
| `page` | int | Page number | 1 |
| `page_size` | int | Items per page (max 100) | 20 |

> **Note**: `tenant_id` parameter is no longer required as the API automatically filters by tenant from JWT token.

### Statistics Response

```json
{
  "pending": 10,
  "processing": 2,
  "completed": 1500,
  "failed": 5,
  "dead": 1,
  "total": 1518
}
```

### Outbox Entry Response

```json
{
  "id": "abc-123",
  "event_type": "new_finding",
  "aggregate_type": "finding",
  "aggregate_id": "finding-789",
  "title": "Critical SQL Injection Found",
  "body": "SQL injection vulnerability in login endpoint",
  "severity": "critical",
  "url": "/findings/finding-789",
  "status": "failed",
  "retry_count": 3,
  "max_retries": 3,
  "last_error": "connection timeout to Slack webhook",
  "scheduled_at": "2026-01-23T10:00:00Z",
  "locked_at": null,
  "processed_at": "2026-01-23T10:15:00Z",
  "created_at": "2026-01-23T10:00:00Z",
  "updated_at": "2026-01-23T10:15:00Z",
  "metadata": {}
}
```

> **Note**: `tenant_id` is not returned in the response as all entries belong to the current tenant.

### Tenant Flow: Retry Failed Entry

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Tenant user identifies failed entry via UI or API                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  POST /api/v1/notification-outbox/{id}/retry                            │
│  (JWT token contains tenant_id)                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Server validates:                                                       │
│    - Entry exists                                                       │
│    - Entry belongs to current tenant                                    │
│    - Entry status is 'failed' or 'dead'                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Server calls entry.ResetForRetry():                                    │
│    - status = "pending"                                                 │
│    - retry_count = 0                                                    │
│    - scheduled_at = NOW()                                               │
│    - locked_at = nil                                                    │
│    - locked_by = ""                                                     │
│    - processed_at = nil                                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Entry will be picked up by scheduler in next poll cycle                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## UI Features

### User Features (Implemented)

| Feature | Page | Status |
|---------|------|--------|
| Manage Notification Channels | `/settings/integrations/notifications` | ✅ |
| Add New Channel | Dialog | ✅ |
| Edit Channel | Dialog | ✅ |
| Delete Channel | Dialog | ✅ |
| Configure Event Types | Dialog | ✅ |
| Configure Severities | Dialog | ✅ |
| Send Test Notification | Button | ✅ |
| View Notification History | `/settings/integrations/notifications/history` | ✅ |

### Tenant Outbox Features (Proposed)

> **Note**: API backend is complete. UI can be added at `/settings/notifications/outbox` or similar.

| Feature | Proposed Page | API Endpoint | Status |
|---------|---------------|--------------|--------|
| View Outbox Queue | `/settings/notifications/outbox` | `GET /api/v1/notification-outbox` | ✅ API |
| View Outbox Statistics | `/settings/notifications/outbox` | `GET /api/v1/notification-outbox/stats` | ✅ API |
| Retry Failed Entry | Action button | `POST /api/v1/notification-outbox/{id}/retry` | ✅ API |
| Delete Entry | Action button | `DELETE /api/v1/notification-outbox/{id}` | ✅ API |

### Admin Features (Future - Separate Backend)

> **Note**: System-wide admin features will be developed in a separate admin backend and frontend.

| Feature | Description |
|---------|-------------|
| Cross-tenant outbox monitoring | View all tenants' outbox entries |
| System-wide statistics | Aggregated stats across all tenants |
| Bulk operations | Bulk retry/delete across tenants |
| Worker health monitoring | Monitor scheduler and worker status |

---

## Configuration

### Scheduler Configuration

```go
// Default configuration
config := app.DefaultNotificationSchedulerConfig()
// Returns:
// {
//     ProcessInterval:        5 * time.Second,
//     CleanupInterval:        24 * time.Hour,
//     UnlockInterval:         1 * time.Minute,
//     BatchSize:              50,
//     CompletedRetentionDays: 7,
//     FailedRetentionDays:    30,
//     StaleMinutes:           10,
// }

// Custom configuration
scheduler := app.NewNotificationScheduler(
    notificationService,
    app.NotificationSchedulerConfig{
        ProcessInterval:        5 * time.Second,   // Poll every 5 seconds
        CleanupInterval:        24 * time.Hour,    // Cleanup daily
        UnlockInterval:         1 * time.Minute,   // Unlock stale entries every minute
        BatchSize:              50,                // Process 50 entries per batch
        CompletedRetentionDays: 7,                 // Keep completed for 7 days
        FailedRetentionDays:    30,                // Keep failed for 30 days
        StaleMinutes:           10,                // Unlock after 10 minutes
    },
    log,
)
```

### Cleanup Strategy

| Status | Retention | Reason |
|--------|-----------|--------|
| completed | 7 days | Short-term debugging |
| failed | 30 days | Investigation time |
| dead | 30 days | Manual review needed |

---

## Monitoring

### Key Metrics to Track

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `pending_count` | Number of pending entries | > 1000 for > 5 minutes |
| `processing_time_p95` | 95th percentile processing time | > 30 seconds |
| `failure_rate` | Percentage of failed notifications | > 1% |
| `retry_rate` | Percentage of retried notifications | > 5% |
| `dead_count` | Number of dead entries | > 0 (requires attention) |
| `stale_locked_count` | Processing entries locked > 10 min | > 0 |

### Recommended Alerts

1. **High Pending Count**: `pending > 1000` for more than 5 minutes
2. **High Failure Rate**: `failed / total > 1%` in last hour
3. **Dead Entries**: Any entry in `dead` status
4. **Stale Processing**: Entries in `processing` for > 10 minutes

### Logging

The scheduler logs important events:

```
level=INFO msg="notification scheduler started"
level=DEBUG msg="processing notification batch" worker_id=worker-123 batch_size=50
level=DEBUG msg="processed outbox entry" outbox_id=abc-123 success=true
level=WARN msg="some integrations failed" outbox_id=abc-123 success_count=2 errors=["slack: timeout"]
level=ERROR msg="failed to process outbox entry" outbox_id=abc-123 error="all integrations failed"
level=INFO msg="cleanup completed" deleted_completed=100 deleted_failed=5
level=INFO msg="unlocked stale entries" count=2
```

---

## Troubleshooting

### Common Issues

#### 1. Notifications Not Being Sent

**Symptoms**: New findings created but no notifications received.

**Checklist**:
1. Check if notification integrations exist and are connected
2. Check event type filter on the integration
3. Check severity filter on the integration
4. Check outbox for pending/failed entries
5. Check scheduler is running (logs)

**Commands**:
```bash
# Check outbox status (tenant-scoped)
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/v1/notification-outbox/stats"

# List pending entries (tenant-scoped)
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/v1/notification-outbox?status=pending"
```

#### 2. High Number of Failed Entries

**Symptoms**: Many entries in `failed` or `dead` status.

**Possible Causes**:
- Integration credentials expired
- Network connectivity issues
- Rate limiting from notification providers
- Invalid webhook URLs

**Actions**:
1. Check `last_error` field for specific error messages
2. Verify integration credentials
3. Test connectivity to notification providers
4. Review rate limiting settings

#### 3. Entries Stuck in Processing

**Symptoms**: Entries remain in `processing` status.

**Possible Causes**:
- Worker crashed during processing
- Deadlock in database
- Very slow network calls

**Actions**:
1. Wait for `UnlockStale` job to release locks (every 1 minute)
2. Manually check and restart the scheduler if needed
3. Review database locks

#### 4. Duplicate Notifications

**Symptoms**: Same notification received multiple times.

**Possible Causes**:
- Entry processed but status update failed
- Multiple scheduler instances without proper locking

**Prevention**:
- `FOR UPDATE SKIP LOCKED` ensures exclusive processing
- Idempotency keys in notification providers (where supported)

---

## Code Structure

### Domain Layer

```
api/internal/domain/notification/
├── outbox.go       # Outbox entity with state transitions
├── repository.go   # Repository interface
└── errors.go       # Domain errors (ErrOutboxNotFound)
```

### Infrastructure Layer

```
api/internal/infra/
├── postgres/
│   └── notification_outbox_repository.go  # PostgreSQL implementation
└── notification/
    ├── client.go      # Client interface & factory
    ├── slack.go       # Slack webhook client
    ├── teams.go       # Microsoft Teams client
    ├── telegram.go    # Telegram bot client
    ├── webhook.go     # Generic webhook client
    └── email.go       # SMTP email client
```

### Application Layer

```
api/internal/app/
├── notification_service.go     # Business logic, processing
└── notification_scheduler.go   # Background worker
```

### HTTP Handler

```
api/internal/infra/http/handler/
└── notification_outbox_handler.go  # Admin API endpoints
```

---

## Testing

### E2E Test Script

A script is provided to test the complete notification outbox flow end-to-end.

**Script location**: `api/scripts/test_notification_outbox_e2e.sh`

#### Prerequisites

- PostgreSQL client (`psql`) installed
- Database running (can use Docker Compose)
- At least one notification integration configured for the tenant

#### Docker Compose Database

If you're using Docker Compose (file `api/docker-compose.yml`), the default database is:

```
Host:     localhost
Port:     5432
User:    .openctem
Password: secret
Database:.openctem

DATABASE_URL: postgres:/.openctem:secret@localhost:5432.openctem
```

#### Usage

```bash
# Ensure script has execute permission
chmod +x api/scripts/test_notification_outbox_e2e.sh

# Option 1: Pass DATABASE_URL directly
./api/scripts/test_notification_outbox_e2e.sh <tenant_id> 'postgres:/.openctem:secret@localhost:5432.openctem'

# Option 2: Set environment variable first
export DATABASE_URL='postgres:/.openctem:secret@localhost:5432.openctem'
./api/scripts/test_notification_outbox_e2e.sh <tenant_id>
```

#### Getting Tenant ID

If you don't know the tenant_id, you can query the database:

```bash
psql 'postgres:/.openctem:secret@localhost:5432.openctem' -c "SELECT id, name FROM tenants LIMIT 5;"
```

#### How the Script Works

1. **Check integrations**: Confirm tenant has notification integrations
2. **Create test notification**: Insert an entry into `notification_outbox` table
3. **Wait for scheduler**: Poll status every 2 seconds, max 30 seconds
4. **Check results**: View status and notification history
5. **Cleanup**: Delete test data from database

#### Expected Output

```
==========================================
Notification Outbox E2E Test
==========================================
Tenant ID: 123e4567-e89b-12d3-a456-426614174000

1. Checking tenant has notification integrations...
   Found 2 connected notification integration(s)

2. Inserting test notification into outbox...
   Outbox entry created: abc-123-def-456

3. Waiting for scheduler to process...
   Status: PENDING (0s elapsed)...
   Status: PROCESSING (2s elapsed)...
   Status: COMPLETED (after 4s)

4. Fetching final outbox entry details...
   [table output]

5. Checking notification history...
   Found 2 notification history entries
   [table output]

6. Cleanup - Deleting test entries...
   Test entries cleaned up

==========================================
Test Summary
==========================================
Outbox ID: abc-123-def-456
Final Status: completed
Integrations Found: 2
History Entries: 2

Result: SUCCESS - Notification was processed and sent
```

#### Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Status PENDING after 30s | Scheduler not running | Check API server is running and scheduler is started |
| Status FAILED | Integration error | Check `last_error` in outbox entry |
| History = 0 | No matching filters | Check event_type and severity filters on integrations |
| No integrations | Not configured | Add notification integration via UI or API |

---

## References

- [Microservices.io - Transactional Outbox](https://microservices.io/patterns/data/transactional-outbox.html)
- [Debezium - Outbox Pattern](https://debezium.io/blog/2019/02/19/reliable-microservices-data-exchange-with-the-outbox-pattern/)
- [PostgreSQL + Outbox Pattern Revamped](https://dev.to/msdousti/postgresql-outbox-pattern-revamped-part-1-3lai)
- [SeatGeek - Transactional Outbox Pattern](https://chairnerd.seatgeek.com/transactional-outbox-pattern/)

---

## Implementation Status

### Backend (Completed)

- [x] Database migration (`000071_notification_outbox.up.sql`)
- [x] Domain entity (`notification/outbox.go`)
- [x] Repository interface (`notification/repository.go`)
- [x] Domain errors (`notification/errors.go`)
- [x] PostgreSQL repository (`postgres/notification_outbox_repository.go`)
- [x] Notification service (`app/notification_service.go`)
- [x] Notification scheduler (`app/notification_scheduler.go`)
- [x] Worker registration and scheduling (`main.go`)
- [x] Integration with VulnerabilityService
- [x] Integration with ExposureService
- [x] Tenant-scoped API endpoints (`/api/v1/notification-outbox`)
- [x] API documentation
- [x] Test script (`scripts/test_notification_outbox.sh`)
- [x] E2E test script (`scripts/test_notification_outbox_e2e.sh`)

### Tenant UI (Completed)

- [x] Outbox queue view page (`/settings/integrations/notifications/outbox`)
- [x] Outbox statistics dashboard (stats cards)
- [x] Retry/Delete actions with permissions
- [x] Status filtering
- [x] Pagination
- [x] Link from notifications page

**Key UI Files:**
- `ui/src/app/(dashboard)/settings/integrations/notifications/outbox/page.tsx` - Main page
- `ui/src/features/notifications/api/use-notification-outbox-api.ts` - API hooks
- `ui/src/features/notifications/types/notification-outbox.types.ts` - Types

### Admin System (Future - Separate Backend)

> **Note**: Admin features will be developed in a separate backend later.

- [ ] Cross-tenant monitoring
- [ ] System-wide statistics
- [ ] Bulk operations
- [ ] Prometheus metrics
- [ ] Grafana dashboard

---

**Last Updated**: 2026-01-23
