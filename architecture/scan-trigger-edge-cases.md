---
layout: default
title: Scan Trigger Edge Cases
parent: Architecture
nav_order: 9
---

# Scan Trigger Edge Cases

> **Last Updated**: January 31, 2026
> **Implementation Status**: Complete ✅

## Overview

This document describes edge cases in the scan trigger flow and their solutions. These fixes address race conditions, validation gaps, and UX issues that could cause silent failures or unexpected behavior.

## Edge Cases Fixed

### 1. Concurrent Run Limit Race Condition

**Problem**: Multiple simultaneous scan triggers could bypass the concurrent run limit, allowing more runs than intended.

**Example Scenario**:
```
Time T1: Request A checks count=1, limit=2 ✓
Time T2: Request B checks count=1, limit=2 ✓
Time T3: Request A creates run (count=2)
Time T4: Request B creates run (count=3) ← Limit exceeded!
```

**Solution**: Use atomic database operation with `FOR UPDATE` row locking.

**Implementation**:
```go
// api/internal/infra/postgres/run_repository.go
func (r *RunRepository) CreateRunIfUnderLimit(ctx context.Context, run *Run, maxPerScan, maxPerTenant int) error {
    tx, _ := r.db.BeginTx(ctx, nil)
    defer tx.Rollback()

    // Lock the scan row to prevent concurrent modifications
    tx.Exec("SELECT 1 FROM scans WHERE id = $1 FOR UPDATE", run.ScanID)

    // Count within transaction
    var count int
    tx.QueryRow("SELECT COUNT(*) FROM runs WHERE scan_id = $1 AND status IN ('pending','running')",
        run.ScanID).Scan(&count)

    if count >= maxPerScan {
        return ErrConcurrentLimitExceeded
    }

    // Create run within same transaction
    tx.Exec("INSERT INTO runs ...")

    return tx.Commit()
}
```

**Files Modified**:
- `api/internal/infra/postgres/run_repository.go`

---

### 2. Agent Offline Between Check and Assign

**Problem**: Agent could go offline between availability check and command assignment, leaving commands stuck in "pending" state forever.

**Example Scenario**:
```
Time T1: Check agent A health = 'online' ✓
Time T2: Assign command to agent A
Time T3: Agent A crashes/disconnects
Time T4: Command stuck - other agents can't pick it up
```

**Solution**: Two PostgreSQL functions work together for recovery:
1. `recover_stuck_tenant_commands()` - Returns commands to pool for retry
2. `fail_exhausted_commands()` - Marks commands as failed after max retries

#### Function 1: `recover_stuck_tenant_commands()`

**Purpose**: Clears `agent_id` from commands assigned to offline agents, allowing other agents to pick them up.

**Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `p_stuck_threshold_minutes` | INT | 10 | Minutes before considering command stuck |
| `p_max_retries` | INT | 3 | Maximum dispatch attempts before giving up |

**Returns**: Number of commands recovered (INT)

**Implementation**:
```sql
-- api/migrations/000145_recover_stuck_tenant_commands.up.sql
CREATE OR REPLACE FUNCTION recover_stuck_tenant_commands(
    p_stuck_threshold_minutes INT DEFAULT 10,
    p_max_retries INT DEFAULT 3
) RETURNS INT AS $$
DECLARE
    recovered_count INT;
BEGIN
    WITH recovered AS (
        UPDATE commands c
        SET agent_id = NULL,           -- Clear assignment
            last_dispatch_at = NOW(),
            dispatch_attempts = dispatch_attempts + 1
        WHERE c.is_platform_job = FALSE  -- Tenant commands only
          AND c.agent_id IS NOT NULL      -- Assigned to specific agent
          AND c.status = 'pending'        -- Still waiting
          AND c.dispatch_attempts < p_max_retries
          AND (
              -- Agent is offline or has unknown health
              NOT EXISTS (
                  SELECT 1 FROM agents a
                  WHERE a.id = c.agent_id
                  AND a.health = 'online'
                  AND a.status = 'active'
              )
              OR
              -- Command stuck too long (no acknowledgment)
              (
                  c.created_at < NOW() - (p_stuck_threshold_minutes || ' minutes')::INTERVAL
                  AND c.acknowledged_at IS NULL
              )
          )
        RETURNING 1
    )
    SELECT COUNT(*) INTO recovered_count FROM recovered;
    RETURN recovered_count;
END;
$$ LANGUAGE plpgsql;
```

**When a command is recovered**:
1. Agent is offline (`health != 'online'`)
2. Agent is inactive (`status != 'active'`)
3. Command has been pending for longer than threshold without acknowledgment

#### Function 2: `fail_exhausted_commands()`

**Purpose**: Marks commands as permanently failed after exceeding maximum retry attempts.

**Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `p_max_retries` | INT | 3 | Maximum dispatch attempts threshold |

**Returns**: Number of commands failed (INT)

**Implementation**:
```sql
-- api/migrations/000145_recover_stuck_tenant_commands.up.sql
CREATE OR REPLACE FUNCTION fail_exhausted_commands(
    p_max_retries INT DEFAULT 3
) RETURNS INT AS $$
DECLARE
    failed_count INT;
BEGIN
    WITH failed AS (
        UPDATE commands c
        SET status = 'failed',
            error_message = 'Command exceeded maximum retry attempts (' || p_max_retries || ')'
        WHERE c.status = 'pending'
          AND c.dispatch_attempts >= p_max_retries
        RETURNING 1
    )
    SELECT COUNT(*) INTO failed_count FROM failed;
    RETURN failed_count;
END;
$$ LANGUAGE plpgsql;
```

#### Recovery Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Command Recovery Workflow                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Command Created                                                    │
│        │                                                             │
│        ▼                                                             │
│   Assigned to Agent A                                                │
│        │                                                             │
│        ▼                                                             │
│   Agent A goes offline ─────┐                                        │
│                             │                                        │
│                             ▼                                        │
│               ┌─────────────────────────────┐                        │
│               │ recover_stuck_tenant_commands│ (runs every 1 min)    │
│               └─────────────────────────────┘                        │
│                             │                                        │
│            dispatch_attempts < max_retries?                          │
│                    │                │                                │
│                   YES              NO                                │
│                    │                │                                │
│                    ▼                ▼                                │
│          Clear agent_id      ┌──────────────────┐                    │
│          (back to pool)      │fail_exhausted_   │                    │
│                │             │commands          │                    │
│                ▼             └──────────────────┘                    │
│          Re-assigned to              │                               │
│          Agent B (online)            ▼                               │
│                │               status='failed'                       │
│                ▼               error_message set                     │
│          Command executed                                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### Database Indexes

Two indexes are created to optimize the recovery queries:

```sql
-- Index for finding stuck tenant commands
CREATE INDEX idx_commands_tenant_stuck
ON commands(agent_id, status, created_at)
WHERE is_platform_job = FALSE
  AND agent_id IS NOT NULL
  AND status = 'pending';

-- Index for finding commands by dispatch attempts
CREATE INDEX idx_commands_dispatch_retries
ON commands(dispatch_attempts, status)
WHERE dispatch_attempts > 0
  AND status = 'pending';
```

**Files Modified**:
- `api/migrations/000145_recover_stuck_tenant_commands.up.sql`
- `api/migrations/000145_recover_stuck_tenant_commands.down.sql`
- `api/internal/domain/command/repository.go`
- `api/internal/infra/postgres/command_repository.go`
- `api/internal/infra/controller/job_recovery.go`

---

### 3. Multiple Asset Groups Loss in Frontend

**Problem**: UI allowed selecting multiple asset groups but only sent the first one to the API.

**Example Scenario**:
```
User selects: [GroupA, GroupB, GroupC]
API receives: asset_group_id: "GroupA"  ← GroupB and GroupC lost!
```

**Solution**: Added `asset_group_ids` array field to support multiple asset groups.

**API Changes**:
```typescript
// ui/src/lib/api/scan-types.ts
interface CreateScanConfigRequest {
  asset_group_id?: string;      // Primary (legacy, optional)
  asset_group_ids?: string[];   // Multiple groups (NEW)
  targets?: string[];           // Direct targets
  // ...
}
```

**Database Migration**:
```sql
-- api/migrations/000146_scan_multiple_asset_groups.up.sql
ALTER TABLE scans
    ADD COLUMN asset_group_ids UUID[] DEFAULT '{}';

-- Migrate existing data
UPDATE scans
SET asset_group_ids = ARRAY[asset_group_id]
WHERE asset_group_id IS NOT NULL;
```

**Files Modified**:
- `api/migrations/000146_scan_multiple_asset_groups.up.sql`
- `api/internal/domain/scan/entity.go`
- `api/internal/infra/postgres/scan_repository.go`
- `api/internal/infra/http/handler/scan_handler.go`
- `api/internal/app/scan_service.go`
- `ui/src/lib/api/scan-types.ts`
- `ui/src/features/scans/components/new-scan/new-scan-dialog.tsx`

---

### 4. Tool Validation at Trigger Time

**Problem**: Tools could be disabled or deleted between scan creation and trigger, causing runtime failures.

**Example Scenario**:
```
Day 1: Create scan with scanner="nuclei" ✓
Day 2: Admin disables nuclei tool
Day 3: Scan trigger fails with cryptic error
```

**Solution**: Validate tools are still available and active before triggering.

**Implementation**:
```go
// api/internal/app/scan_service.go
func (s *ScanService) validateToolsAtTriggerTime(ctx context.Context, sc *scan.Scan) error {
    if sc.ScanType == scan.ScanTypeSingle {
        tool, err := s.toolRepo.GetByName(ctx, sc.ScannerName)
        if err != nil {
            return shared.NewDomainError("TOOL_NOT_FOUND",
                fmt.Sprintf("Scanner '%s' is no longer available", sc.ScannerName),
                shared.ErrValidation)
        }
        if !tool.IsActive {
            return shared.NewDomainError("TOOL_DISABLED",
                fmt.Sprintf("Scanner '%s' is currently disabled", sc.ScannerName),
                shared.ErrValidation)
        }
    }
    // Similar checks for workflow pipeline steps...
    return nil
}
```

**Files Modified**:
- `api/internal/app/scan_service.go`

---

### 5. Agent Health='unknown' Issue

**Problem**: Agents with `health='unknown'` (never sent heartbeat) were considered available for job dispatch.

**Example Scenario**:
```
Agent registers but never starts heartbeat
Query: WHERE health IN ('online', 'unknown') ← Unknown agents selected
Job dispatched to agent that may not exist
Job hangs forever
```

**Solution**: Only select agents with `health='online'` for job dispatch.

**Before**:
```sql
-- Would select agents that never sent a heartbeat
WHERE status = 'active' AND health IN ('online', 'unknown')
```

**After**:
```sql
-- Only select agents with confirmed online status
WHERE status = 'active' AND health = 'online'
```

**Files Modified**:
- `api/internal/infra/postgres/agent_repository.go`

---

### 6. Template/Pipeline Validation

**Problem**: Scans could reference deleted or disabled pipeline templates, or empty pipelines with no steps.

**Example Scenario**:
```
Case 1: Pipeline deleted after scan created → "Pipeline not found"
Case 2: Pipeline disabled → Scan runs but fails mysteriously
Case 3: Pipeline has no steps → Runtime error in executor
```

**Solution**: Added comprehensive validation in `triggerWorkflow()`.

**Implementation**:
```go
// api/internal/app/scan_service.go
func (s *ScanService) triggerWorkflow(ctx context.Context, sc *scan.Scan, ...) (*Run, error) {
    // Check pipeline exists
    template, err := s.templateRepo.GetByID(ctx, *sc.PipelineID)
    if err != nil {
        return nil, shared.NewDomainError("PIPELINE_NOT_FOUND",
            "Pipeline template not found. It may have been deleted.",
            shared.ErrNotFound)
    }

    // Check pipeline is active
    if !template.IsActive {
        return nil, shared.NewDomainError("PIPELINE_DISABLED",
            "Pipeline is disabled. Please enable it or use a different pipeline.",
            shared.ErrValidation)
    }

    // Check pipeline has steps
    steps, _ := s.stepRepo.GetByPipelineID(ctx, template.ID)
    if len(steps) == 0 {
        return nil, shared.NewDomainError("PIPELINE_EMPTY",
            "Pipeline has no steps. Please add at least one step.",
            shared.ErrValidation)
    }

    // Continue with execution...
}
```

**Files Modified**:
- `api/internal/app/scan_service.go`

---

### 7. Trigger Failure UX Improvement

**Problem**: When scan trigger fails after creation, users might miss the warning toast and not realize their scan didn't start.

**Solution**: Show persistent error toast with "View Scan" action button.

**Implementation**:
```typescript
// ui/src/features/scans/components/new-scan/new-scan-dialog.tsx
catch (triggerError) {
  toast.error(
    `Scan "${formData.name}" was created but failed to start: ${errorMsg}`,
    {
      duration: 10000, // Keep visible for 10 seconds
      action: {
        label: "View Scan",
        onClick: () => {
          window.location.href = `/scans/${scanConfig.id}`;
        },
      },
      description: "You can manually trigger the scan from the scan details page.",
    }
  );
}
```

**Files Modified**:
- `ui/src/features/scans/components/new-scan/new-scan-dialog.tsx`

---

## Key Patterns

### Pattern 1: Atomic Check-and-Create

Prevent race conditions by doing check and create in a single atomic transaction:

```go
func CreateIfUnderLimit(ctx context.Context, ...) error {
    tx := db.BeginTx(ctx, nil)
    defer tx.Rollback()

    tx.Exec("SELECT 1 FROM table WHERE id = ? FOR UPDATE") // Lock row

    count := tx.QueryRow("SELECT COUNT(*) ...")
    if count >= limit {
        return ErrLimitExceeded
    }

    tx.Exec("INSERT INTO ...")
    return tx.Commit()
}
```

### Pattern 2: Periodic Recovery

Handle transient failures with periodic reconciliation:

```go
func RecoverStuckItems(ctx context.Context) (int64, error) {
    return db.Exec(`
        UPDATE items
        SET assigned_to = NULL, retry_count = retry_count + 1
        WHERE assigned_to IS NOT NULL
          AND status = 'pending'
          AND retry_count < max_retries
          AND NOT EXISTS (
              SELECT 1 FROM workers w
              WHERE w.id = items.assigned_to
              AND w.health = 'online'
          )
    `)
}
```

### Pattern 3: Pre-flight Validation

Validate dependencies before execution to fail fast with clear messages:

```go
func TriggerScan(ctx context.Context, scan *Scan) error {
    // Validate tools
    if err := validateToolsExist(ctx, scan); err != nil {
        return err // "Tool 'X' no longer available"
    }

    // Validate agents
    if err := validateAgentsAvailable(ctx, scan); err != nil {
        return err // "No agents available"
    }

    // Validate limits
    if err := validateConcurrentLimits(ctx, scan); err != nil {
        return err // "Concurrent limit reached"
    }

    // Now safe to proceed
    return executeScan(ctx, scan)
}
```

## Testing

### Manual Test Cases

| Scenario | Expected Result |
|----------|-----------------|
| Trigger scan when concurrent limit reached | Error: "Concurrent scan limit reached" |
| Trigger scan with deleted tool | Error: "Scanner 'X' is no longer available" |
| Trigger scan with disabled tool | Error: "Scanner 'X' is currently disabled" |
| Agent goes offline after command assigned | Command recovered within 10 minutes |
| Select multiple asset groups | All groups saved and returned in response |
| Trigger fails after scan created | Persistent error toast with "View Scan" action |

### Automated Tests

```bash
# Run all edge case integration tests
cd api && go test ./tests/integration/... -v -run "TestRecoverStuck\|TestFailExhausted\|TestScan"

# Run unit tests for scan entity
cd api && go test ./tests/unit -v -run TestScan

# Run frontend type check
cd ui && npm run type-check
```

---

### Command Recovery Tests

**Test File**: `api/tests/integration/command_recovery_test.go`

#### TestRecoverStuckTenantCommands

Tests the `recover_stuck_tenant_commands()` PostgreSQL function.

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| `RecoverCommandsFromOfflineAgent` | Command assigned to offline agent | Command recovered, `agent_id = NULL`, `dispatch_attempts++` |
| `DontRecoverCommandsFromOnlineAgent_WhenRecent` | Recent command assigned to online agent | Command NOT recovered, stays assigned |
| `RespectMaxRetries` | Command with `dispatch_attempts >= max_retries` | Command NOT recovered (max retries reached) |
| `DontRecoverRunningCommands` | Running command assigned to offline agent | Command NOT recovered (not pending) |
| `DontRecoverPlatformCommands` | Platform command (`is_platform_job=true`) | Command NOT recovered (handled separately) |

**Test Code Example**:
```go
t.Run("RecoverCommandsFromOfflineAgent", func(t *testing.T) {
    // Create a command assigned to offline agent
    cmdID := createTestCommand(t, db, tenantID, offlineAgentID, "pending", 0)

    // Run recovery function
    var recovered int
    db.QueryRow("SELECT recover_stuck_tenant_commands(10, 3)").Scan(&recovered)

    // Verify: 1 command recovered
    if recovered != 1 {
        t.Errorf("Expected 1 recovered command, got %d", recovered)
    }

    // Verify: agent_id cleared, dispatch_attempts incremented
    var agentID sql.NullString
    var attempts int
    db.QueryRow("SELECT agent_id, dispatch_attempts FROM commands WHERE id = $1", cmdID).
        Scan(&agentID, &attempts)

    if agentID.Valid {
        t.Error("Expected agent_id to be NULL")
    }
    if attempts != 1 {
        t.Errorf("Expected dispatch_attempts=1, got %d", attempts)
    }
})
```

#### TestFailExhaustedCommands

Tests the `fail_exhausted_commands()` PostgreSQL function.

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| `FailCommandsAtMaxRetries` | Command with `dispatch_attempts >= max_retries` | Command failed, error message set |
| `DontFailCommandsUnderMaxRetries` | Command with `dispatch_attempts < max_retries` | Command NOT failed, stays pending |
| `DontFailAlreadyFailedCommands` | Already failed command | Command NOT modified |
| `DontFailCompletedCommands` | Completed command with high attempts | Command NOT failed, stays completed |

**Test Code Example**:
```go
t.Run("FailCommandsAtMaxRetries", func(t *testing.T) {
    // Create command that has reached max retries
    cmdID := createTestCommand(t, db, tenantID, offlineAgentID, "pending", 3)

    // Run fail function with max_retries=3
    var failed int
    db.QueryRow("SELECT fail_exhausted_commands(3)").Scan(&failed)

    // Verify: 1 command failed
    if failed != 1 {
        t.Errorf("Expected 1 failed command, got %d", failed)
    }

    // Verify: status='failed', error_message set
    var status, errorMsg string
    db.QueryRow("SELECT status, error_message FROM commands WHERE id = $1", cmdID).
        Scan(&status, &errorMsg)

    if status != "failed" {
        t.Errorf("Expected status 'failed', got '%s'", status)
    }
    if errorMsg == "" {
        t.Error("Expected error_message to be set")
    }
})
```

#### TestRecoveryAndFailIntegration

Tests the full recovery workflow from assignment to failure.

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| `FullRecoveryWorkflow` | Command goes through 3 recovery attempts then fails | After 3 recoveries: `dispatch_attempts=3`, then `status='failed'` |

**Workflow Tested**:
```
1. Create command assigned to offline agent (dispatch_attempts=0)
2. Recovery #1: agent_id=NULL, dispatch_attempts=1
3. Re-assign to offline agent
4. Recovery #2: agent_id=NULL, dispatch_attempts=2
5. Re-assign to offline agent
6. Recovery #3: agent_id=NULL, dispatch_attempts=3
7. Recovery #4: NOT recovered (max_retries=3 reached)
8. fail_exhausted_commands(): status='failed'
```

---

### Scan Entity Tests

**Test File**: `api/tests/unit/scan_entity_test.go`

#### TestScanAssetGroupIDs

Tests the `AssetGroupIDs` field functionality.

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| `NewScan_InitializesEmptyAssetGroupIDs` | Create scan with `NewScan()` | `AssetGroupIDs` initialized as empty slice |
| `NewScanWithTargets_InitializesEmptyAssetGroupIDs` | Create scan with targets | `AssetGroupIDs` initialized as empty slice |
| `SetAssetGroupIDs_SetsMultipleGroups` | Call `SetAssetGroupIDs()` | All IDs stored correctly |
| `SetAssetGroupIDs_SetsPrimaryIfNotSet` | Set IDs when no primary | First ID becomes `AssetGroupID` |
| `SetAssetGroupIDs_DoesntOverridePrimary` | Set IDs when primary exists | Primary unchanged |
| `SetAssetGroupIDs_HandlesNil` | Pass nil to setter | Converts to empty slice |
| `GetAllAssetGroupIDs_CombinesPrimaryAndMultiple` | Get all IDs | Returns primary + additional IDs |
| `GetAllAssetGroupIDs_AvoidsDuplicates` | Primary ID also in array | No duplicate in result |
| `GetAllAssetGroupIDs_HandlesOnlyPrimary` | Only `AssetGroupID` set | Returns single ID |
| `GetAllAssetGroupIDs_HandlesOnlyMultiple` | Only `AssetGroupIDs` set | Returns all IDs |
| `GetAllAssetGroupIDs_HandlesEmpty` | No asset groups | Returns empty slice |

#### TestScanValidation

Tests the `Validate()` method with different target combinations.

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| `ValidWithAssetGroupID` | Only `AssetGroupID` set | Validation passes |
| `ValidWithAssetGroupIDs` | Only `AssetGroupIDs` set | Validation passes |
| `ValidWithTargets` | Only `Targets` set | Validation passes |
| `ValidWithBothAssetGroupAndTargets` | Both asset group and targets | Validation passes |
| `InvalidWithoutAnyTargetSource` | No targets at all | Validation fails: "either asset_group_id/asset_group_ids or targets must be provided" |
| `InvalidWithoutName` | Empty name | Validation fails: "name is required" |

#### TestScanHasAssetGroup

Tests the `HasAssetGroup()` helper method.

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| `TrueWithAssetGroupID` | Only `AssetGroupID` set | Returns `true` |
| `TrueWithAssetGroupIDs` | Only `AssetGroupIDs` set | Returns `true` |
| `FalseWithoutAssetGroups` | Neither set | Returns `false` |

#### TestScanClone

Tests that `Clone()` properly copies all target fields.

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| `CloneCopiesAssetGroupIDs` | Clone scan with multiple groups | All IDs copied |
| `CloneCopiesTargets` | Clone scan with targets | All targets copied |
| `CloneIsIndependent` | Modify original after clone | Clone unaffected |

---

### Running Tests

```bash
# Run all command recovery tests
DATABASE_URL="postgres://openctem:openctem@localhost:5432/openctem?sslmode=disable" \
  go test ./api/tests/integration -run "TestRecoverStuck\|TestFailExhausted\|TestRecoveryAndFail" -v

# Run all scan entity unit tests
go test ./api/tests/unit -run TestScan -v

# Run with coverage
go test ./api/tests/... -cover -coverprofile=coverage.out
go tool cover -html=coverage.out
```

### Test Prerequisites

For integration tests:
1. PostgreSQL database running with migrations applied
2. Migration 000145 applied (recovery functions)
3. Database user with appropriate permissions

```sql
-- Verify functions exist
SELECT proname FROM pg_proc
WHERE proname IN ('recover_stuck_tenant_commands', 'fail_exhausted_commands');
```

## Monitoring

### Key Metrics to Watch

| Metric | Alert Threshold |
|--------|-----------------|
| `commands_recovered_total` | > 10/hour |
| `scan_trigger_failures_total` | > 5/minute |
| `agents_health_unknown_count` | > 0 for > 1 hour |
| `concurrent_limit_exceeded_total` | Log for investigation |

### Log Patterns

```bash
# Check for stuck command recovery
grep "recovered stuck tenant commands" /var/log/api/*.log

# Check for tool validation failures
grep "TOOL_NOT_FOUND\|TOOL_DISABLED" /var/log/api/*.log

# Check for concurrent limit issues
grep "concurrent.*limit\|LIMIT_EXCEEDED" /var/log/api/*.log
```

## References

- [Scan Orchestration Architecture](./scan-orchestration.md)
- [Agent Configuration Guide](../guides/agent-configuration.md)
- [Platform Agents](../features/platform-agents.md)
