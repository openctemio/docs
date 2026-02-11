# Scan System Implementation Plan

**Created:** 2026-01-26
**Status:** COMPLETED (Backend + Visual Builder)
**Last Updated:** 2026-01-30
**Note:** CRUD UI completion tracked in `2026-01-30-scan-ui-completion.md`

---

## Summary

OpenCTEM already has good backend architecture. Implementation completed:
1. ✅ Completed orchestration (scheduler, cron)
2. ✅ Added Quick Scan and Stats API
3. ✅ Backend support for Visual Workflow Builder
4. ✅ Visual Workflow Builder (UI/Frontend with React Flow)

---

## Implementation Tasks

### Phase 1: Core Orchestration ✅ COMPLETED

#### 1.1 Scheduler Executor ✅
- [x] `api/internal/app/scan_scheduler.go` - Already existed
- [x] Background goroutine polls due scans every minute
- [x] Auto-trigger scans where `next_run_at <= NOW()`
- [x] Update `next_run_at` after trigger
- [x] Started in `api/cmd/server/workers.go`

#### 1.2 Cron Parser Integration ✅
- [x] `github.com/robfig/cron/v3` already in go.mod
- [x] Fixed `calculateNextRun()` in `scan/entity.go` for ScheduleCrontab
- [x] Uses proper cron expression parsing

### Phase 2: Quick Scan Feature ✅ COMPLETED

#### 2.1 Quick Scan API ✅
- [x] Added `QuickScan()` method to `scan_service.go`
- [x] Creates ephemeral asset group with targets
- [x] Creates ephemeral scan config
- [x] Triggers immediately
- [x] Returns `pipeline_run_id`

#### 2.2 Quick Scan Handler ✅
- [x] Added `POST /api/v1/quick-scan` endpoint
- [x] Accepts: targets[], scanner_name OR workflow_id
- [x] Route registered in `routes/scanning.go`

### Phase 3: Enhanced Stats API ✅ COMPLETED

#### 3.1 Stats Aggregation ✅
- [x] Added `GetOverviewStats()` to `scan_service.go`
- [x] Queries pipeline_runs, step_runs, commands
- [x] Groups by status
- [x] Returns aggregated counts

#### 3.2 Stats Endpoint ✅
- [x] Added `GET /api/v1/scan-management/stats`
- [x] Returns: pipelines, scans, jobs with status breakdown

### Phase 4: Visual Workflow Builder Backend ✅ COMPLETED

#### 4.1 Backend Support ✅
- [x] Added `UIPosition` struct to `pipeline/step.go`
- [x] Added `ui_position_x`, `ui_position_y` columns to `pipeline_steps` table
- [x] Created migration `000087_pipeline_steps_ui_position.up.sql`
- [x] Updated repository CRUD operations for UIPosition
- [x] Added UIPosition to API request/response types
- [x] `SetUIPosition(x, y)` method on Step entity

#### 4.2 Frontend (React Flow) ✅ COMPLETED
- [x] @xyflow/react already installed
- [x] Created `WorkflowBuilder` component with backend integration
- [x] Created `ScannerNode` custom node component with multiple types
- [x] Created `NodePalette` component for drag-and-drop
- [x] Map nodes ↔ pipeline_steps with UIPosition
- [x] Map edges ↔ depends_on relationships
- [x] Created pipeline API types, hooks, and endpoints
- [x] Created `/pipelines` page with real API integration

### Phase 5: Feature Activation ✅ COMPLETED

#### 5.1 Parallel Step Control ✅
- [x] Track running steps per pipeline run
- [x] Enforce `MaxParallelSteps` before queuing new steps
- [x] Updated `scheduleRunnableSteps()` in `pipeline_service.go`

#### 5.2 Basic Condition Evaluation ✅
- [x] Already implemented in `evaluateCondition()`
- [x] Supports `always`, `never`, `asset_type`, `expression`, `step_result` conditions

---

## API Endpoints

### Existing
- `GET/POST/PUT/DELETE /api/v1/scans`
- `POST /api/v1/scans/{id}/trigger`
- `GET /api/v1/scans/stats` - Scan config stats
- `GET/POST/PUT/DELETE /api/v1/pipelines`
- `GET /api/v1/pipeline-runs`

### New (Implemented)
- `POST /api/v1/quick-scan` - Quick scan targets ✅
- `GET /api/v1/scan-management/stats` - Overview stats (pipelines/scans/jobs) ✅

---

## Files Modified

### Phase 1-3
- `api/internal/domain/scan/entity.go` - Added cron parser integration
- `api/internal/app/scan_service.go` - Added QuickScan(), GetOverviewStats()
- `api/internal/infra/http/handler/scan_handler.go` - Added QuickScan, GetOverviewStats handlers
- `api/internal/infra/http/routes/scanning.go` - Registered new routes

### Phase 4-5 Backend
- `api/internal/domain/pipeline/step.go` - Added UIPosition struct and SetUIPosition()
- `api/internal/app/pipeline_service.go` - Added UIPosition to AddStepInput, parallel step control
- `api/internal/infra/postgres/pipeline_repository.go` - Updated all CRUD for ui_position
- `api/internal/infra/http/handler/pipeline_handler.go` - Added UIPosition to request/response types
- `api/migrations/000087_pipeline_steps_ui_position.up.sql` - New migration

### Phase 4-5 Frontend
- `ui/src/lib/api/pipeline-types.ts` - Pipeline TypeScript types
- `ui/src/lib/api/pipeline-hooks.ts` - SWR hooks for pipeline API
- `ui/src/lib/api/endpoints.ts` - Added pipeline, pipelineRun, scanManagement endpoints
- `ui/src/features/pipelines/components/scanner-node.tsx` - Custom React Flow node
- `ui/src/features/pipelines/components/workflow-builder.tsx` - Main workflow builder component
- `ui/src/features/pipelines/components/node-palette.tsx` - Drag-and-drop node palette
- `ui/src/app/(dashboard)/(mobilization)/pipelines/page.tsx` - Pipelines page with API integration

---

## Architecture (Kept As-Is)

```
Scan (config) ─────────────────────────────────────────────
     │
     ├── ScanType: workflow OR single
     ├── AssetGroupID: target assets
     ├── PipelineID: workflow template (if workflow type)
     ├── ScannerName: tool name (if single type)
     └── Schedule: manual/daily/weekly/monthly/crontab

PipelineTemplate ──────────────────────────────────────────
     │
     ├── Triggers: [manual, schedule, webhook, api, on_asset_discovery]
     ├── Settings: MaxParallelSteps, FailFast, Timeout
     └── Steps: [Step1, Step2, ...]
            │
            └── UIPosition: {x, y} for visual builder

PipelineRun (execution) ───────────────────────────────────
     │
     └── StepRun → Command → Agent
            │
            └── Parallel control enforced by MaxParallelSteps
```

---

## Progress Summary

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Scheduler + Cron | ✅ Done | Already existed, cron fixed |
| 2. Quick Scan | ✅ Done | API implemented |
| 3. Stats API | ✅ Done | Overview stats implemented |
| 4. Visual Builder Backend | ✅ Done | UIPosition, migration, CRUD |
| 5. Feature Activation | ✅ Done | Parallel control, conditions |
| Frontend (React Flow) | ✅ Done | WorkflowBuilder, ScannerNode, NodePalette |
