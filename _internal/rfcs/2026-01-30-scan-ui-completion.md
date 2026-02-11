# Scan UI Completion Plan

**Created:** 2026-01-30
**Status:** PARTIALLY COMPLETE (Phases 1 & 3 done)
**Priority:** P0 (Critical)
**Last Updated:** 2026-01-30

---

## Executive Summary

The Scan system backend is complete, but the frontend UI has several gaps that prevent full CRUD operations. This RFC documents the implementation plan to complete the Scan UI.

---

## Current State Analysis

### What's Working (API Layer)

| Hook | Status | Description |
|------|--------|-------------|
| `useScanConfigs(filters?)` | ✅ | List scan configurations |
| `useScanConfig(id)` | ✅ | Get single config |
| `useScanConfigStats()` | ✅ | Get statistics |
| `useCreateScanConfig()` | ✅ | Create new config |
| `useUpdateScanConfig(id)` | ✅ | Update config |
| `useDeleteScanConfig(id)` | ✅ | Delete config |
| `useTriggerScan(id)` | ✅ | Trigger execution |
| `useCloneScanConfig(id)` | ✅ | Clone config |
| `useActivateScanConfig(id)` | ✅ | Set status active |
| `usePauseScanConfig(id)` | ✅ | Set status paused |
| `useDisableScanConfig(id)` | ✅ | Set status disabled |

### UI Gaps

| Feature | Current State | Priority |
|---------|--------------|----------|
| **NewScanDialog → API** | ✅ COMPLETE - Connected to createScanConfig API | **P0** |
| **ScanConfig Edit Form** | Missing entirely | **P0** |
| **Trigger Scan** | ✅ COMPLETE - Connected to real API | **P0** |
| **Delete Scan** | ✅ COMPLETE - With confirmation dialog | **P0** |
| **Pause/Activate Scan** | ✅ COMPLETE - Connected to real API | **P0** |
| **Clone Scan** | Handler exists but mock | **P1** |
| **ScanSession List (RunsTab)** | ✅ COMPLETE - Connected to useScanSessions API | **P0** |
| **ScanSession Detail** | ✅ COMPLETE - SessionDetailSheet component | **P1** |
| **Quick Scan UI** | API hook exists, no UI | **P1** |
| **Pipeline Trigger** | Hook exists, UI not connected | **P2** |
| **PipelineRun Detail** | List only, no detail view | **P2** |

---

## Implementation Plan

### Phase 1: Connect NewScanDialog to API (P0) ✅ COMPLETE

**Goal:** Make the multi-step wizard actually create scans via API

**Status:** ✅ Implemented on 2026-01-30

**Files Modified:**
- `ui/src/features/scans/components/new-scan/new-scan-dialog.tsx`
- `ui/src/app/(dashboard)/(discovery)/scans/page.tsx`

**Implementation Details:**
1. ✅ Imported `useCreateScanConfig` hook
2. ✅ Replaced mock `handleSubmit` with actual API call
3. ✅ Created `mapFormDataToRequest()` to convert form state to API format
4. ✅ Handles loading states with `isCreating` flag
5. ✅ Invalidates cache on success via `invalidateScanConfigsCache()`
6. ✅ Shows success toast and closes dialog
7. ✅ Triggers scan immediately if `runImmediately` is selected

**API Request Mapping:**
```typescript
// Form State → API Request
{
  name: formData.name,
  description: formData.description,
  scan_type: formData.mode === 'pipeline' ? 'workflow' : 'single',
  pipeline_id: formData.workflowId,    // if workflow
  scanner_name: formData.scannerName,  // if single
  asset_group_id: formData.assetGroupId,
  schedule_type: formData.scheduleType,
  schedule_crontab: formData.crontab,  // if crontab
  agent_preference: formData.agentPreference,
  notifications: formData.notifications,
}
```

### Phase 2: Create ScanConfig Edit Dialog (P0)

**Goal:** Allow editing existing scan configurations

**Files to Create:**
- `ui/src/features/scans/components/edit-scan-dialog.tsx`

**Files to Modify:**
- `ui/src/app/(dashboard)/(discovery)/scans/page.tsx`
- `ui/src/features/scans/index.ts`

**Component Structure:**
```tsx
interface EditScanDialogProps {
  scanConfig: ScanConfig
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}
```

**Features:**
- Pre-populate form with existing config data
- Show diff indicator for changed fields
- Use `useUpdateScanConfig()` hook
- Validate before submission
- Handle optimistic updates

### Phase 3: Connect Action Handlers (P0) ✅ COMPLETE

**Goal:** Wire up Trigger, Delete, Clone, Status actions

**Status:** ✅ Implemented on 2026-01-30

**Files Modified:**
- `ui/src/app/(dashboard)/(discovery)/scans/page.tsx`
  - ConfigurationsTab: `handleAction` callback for table actions
  - ConfigDetailSheet: `handleTriggerScan`, `handlePauseConfig`, `handleActivateConfig`
  - Delete confirmation dialog with `AlertDialog`

**Implementation Details:**

#### 3.1 Trigger Scan ✅
- Connected via `post(scanEndpoints.trigger(config.id), {})`
- Shows loading spinner while triggering
- Invalidates cache on success

#### 3.2 Delete Scan ✅
- Delete confirmation dialog with `AlertDialog`
- Connected via `del(scanEndpoints.delete(config.id))`
- Available from both table row actions and detail sheet
- Clears selection after delete

#### 3.3 Clone Scan ⏳ (Pending)
- API hook exists but UI not connected

#### 3.4 Status Changes ✅
- Activate: `post(scanEndpoints.activate(config.id), {})`
- Pause: `post(scanEndpoints.pause(config.id), {})`
- All buttons show loading state
- Cache invalidation on success

### Phase 4: ScanSession Detail View (P1)

**Goal:** View detailed results of a scan execution

**Files to Create:**
- `ui/src/features/scans/components/scan-session-detail.tsx`

**Features:**
- Show scan run metadata (duration, agent, status)
- Display findings breakdown by severity
- Show step-by-step progress (for workflow scans)
- Link to findings filtered by this scan session
- Real-time status updates (polling or SSE)

### Phase 5: Quick Scan UI (P1)

**Goal:** Allow users to run ad-hoc scans on targets

**Files to Create:**
- `ui/src/features/scans/components/quick-scan-dialog.tsx`

**Features:**
- Target input (URLs, IPs, domains - comma/newline separated)
- Scanner selection dropdown
- OR Pipeline/workflow selection
- Agent preference toggle
- Immediate execution (no scheduling)
- Navigate to run status after trigger

**API Integration:**
```tsx
const { trigger: quickScan } = useQuickScan()

const handleQuickScan = async (targets: string[], scannerId: string) => {
  const result = await quickScan({ targets, scanner_name: scannerId })
  // Navigate to pipeline run or scan session
  router.push(`/scans?tab=runs&run=${result.pipeline_run_id}`)
}
```

### Phase 6: Pipeline UI Enhancements (P2)

**Goal:** Complete pipeline management UI

**6.1 Trigger Pipeline Run**
- Connect `useTriggerPipelineRun()` to UI buttons
- Add "Run Now" button to pipeline cards and detail sheet

**6.2 PipelineRun Detail View**
- Show step-by-step execution progress
- Display logs/output per step
- Show findings generated by run
- Real-time status updates

**6.3 Step Reordering**
- Add drag-and-drop reorder in step list
- Update `order` field on drop
- Persist changes via `useUpdateStep()`

---

## File Structure After Implementation

```
ui/src/features/scans/
├── components/
│   ├── new-scan/
│   │   ├── new-scan-dialog.tsx      # ✅ Exists, connect to API
│   │   ├── basic-info-step.tsx      # ✅ Exists
│   │   ├── targets-step.tsx         # ✅ Exists
│   │   ├── options-step.tsx         # ✅ Exists
│   │   ├── schedule-step.tsx        # ✅ Exists
│   │   └── index.ts
│   ├── edit-scan-dialog.tsx         # 🆕 Create
│   ├── quick-scan-dialog.tsx        # 🆕 Create
│   ├── scan-session-detail.tsx      # 🆕 Create
│   ├── scan-sessions-tab.tsx        # ✅ Exists
│   ├── platform-usage-card.tsx      # ✅ Exists
│   └── index.ts                     # Update exports
├── types/
│   └── scan.types.ts
├── lib/
│   └── mock-data.ts                 # Remove after API connection
└── index.ts
```

---

## Testing Plan

### Unit Tests
- [ ] NewScanDialog form validation
- [ ] EditScanDialog pre-population
- [ ] API request mapping correctness

### Integration Tests
- [ ] Create → List → Edit → Delete flow
- [ ] Trigger → View Run → Check Status
- [ ] Clone → Verify duplicated config

### E2E Tests
- [ ] Full scan creation wizard
- [ ] Quick scan execution
- [ ] Pipeline trigger and monitor

---

## Timeline Estimate

| Phase | Tasks | Estimate |
|-------|-------|----------|
| Phase 1 | Connect NewScanDialog | 2-3 hours |
| Phase 2 | Create EditScanDialog | 3-4 hours |
| Phase 3 | Connect action handlers | 1-2 hours |
| Phase 4 | ScanSession detail | 3-4 hours |
| Phase 5 | Quick Scan UI | 2-3 hours |
| Phase 6 | Pipeline enhancements | 4-5 hours |
| **Total** | | **15-21 hours** |

---

## Dependencies

### Required APIs (All Available)
- `POST /api/v1/scans` - Create scan config
- `PUT /api/v1/scans/{id}` - Update scan config
- `DELETE /api/v1/scans/{id}` - Delete scan config
- `POST /api/v1/scans/{id}/trigger` - Trigger scan
- `POST /api/v1/scans/{id}/clone` - Clone scan
- `POST /api/v1/scans/{id}/activate` - Activate
- `POST /api/v1/scans/{id}/pause` - Pause
- `POST /api/v1/scans/{id}/disable` - Disable
- `POST /api/v1/quick-scan` - Quick scan
- `GET /api/v1/scan-sessions/{id}` - Session detail

### UI Components (All Available)
- Dialog, Sheet, Form components from shadcn/ui
- Toast notifications (sonner)
- Data tables with TanStack Table
- SWR for data fetching

---

## Success Criteria

1. ✅ Users can create scan configurations via wizard - **DONE**
2. ⏳ Users can edit existing scan configurations - Pending (Phase 2)
3. ✅ Users can trigger, pause, activate, disable scans - **DONE**
4. ✅ Users can delete scan configurations - **DONE**
5. ⏳ Users can clone scan configurations - Pending
6. ✅ Users can view scan session list (RunsTab) - **DONE**
7. ✅ Users can view scan session details - **DONE** (SessionDetailSheet)
8. ⏳ Users can run quick ad-hoc scans - Pending (Phase 5)
9. ⚠️ Most actions connected to real API (ConfigDetailSheet ✅, RunsTab ✅, Bulk actions still mock)

---

## Notes

- The existing `mock-data.ts` should be removed after Phase 3
- Consider adding optimistic updates for better UX
- Real-time updates for scan progress would enhance UX (future SSE integration)

---

## Implementation Log

### 2026-01-30 - Phase 1 & 3 Implementation

**Changes Made:**

1. **NewScanDialog API Integration** (`new-scan-dialog.tsx`)
   - Added `mapScheduleFrequency()` to convert form frequency to API schedule type
   - Added `mapAgentPreference()` to convert form preference to API format
   - Added `mapFormDataToRequest()` to convert full form data to `CreateScanConfigRequest`
   - Connected to `useCreateScanConfig()` hook
   - Auto-triggers scan after creation if `runImmediately` is true
   - Cache invalidation via `invalidateScanConfigsCache()`

2. **ConfigurationsTab API Integration** (`scans/page.tsx`)
   - `handleAction` callback now calls real API endpoints
   - Added `AlertDialog` for delete confirmation
   - Added state: `deleteConfirmOpen`, `configToDelete`, `isDeleting`
   - Connected delete via `del(scanEndpoints.delete(config.id))`

3. **ConfigDetailSheet API Integration** (`scans/page.tsx`)
   - Converted mock handlers to async API calls
   - Added loading states: `isTriggering`, `isPausing`, `isActivating`
   - Connected trigger/pause/activate via `post(scanEndpoints.*)`
   - Delete now uses parent's `onDelete` prop for confirmation dialog
   - Buttons show loading spinner during API calls

4. **Performance Optimization**
   - Memoized `totalRunsCount` calculation
   - Removed inline `.reduce()` from template

**Remaining Work:**

- Phase 2: Edit Scan Dialog
- Phase 3 (partial): Clone Scan, Bulk Actions
- Phase 5: Quick Scan UI
- Phase 6: Pipeline Enhancements

### 2026-01-30 - RunsTab API Integration

**Changes Made:**

1. **RunsTab Complete Rewrite** (`scans/page.tsx`)
   - Replaced mock data with real API hooks (`useScanSessions`, `useScanSessionStats`)
   - Created `mapSessionStatusToUI()` function to convert API status to UI badge status
   - Rewrote table columns for `ScanSession` type
   - Added findings by severity display (Critical, High, Medium, Low badges)
   - Added new/fixed findings indicators
   - Auto-refresh every 30s for running scans

2. **SessionDetailSheet Component** (new, replacing RunDetailSheet)
   - Shows scanner info, target info, findings breakdown by severity
   - Timeline with created/started/completed dates
   - Error message display for failed scans
   - Actions: Stop (running), Retry (failed), View Findings (completed)

3. **Button Label Unified**
   - Changed dynamic label to single "New Scan" button for both tabs

4. **Removed Mock Data Dependencies**
   - Removed `mockScans`, `getScanStats` imports
   - Removed `SCAN_TYPE_CONFIG`, `AGENT_TYPE_CONFIG` imports
   - Removed unused `Scan`, `ScanType` mock types

5. **Code Cleanup**
   - Removed unused `ScannerFilter` type
   - Removed unused `formatDuration` function (SessionDetailSheet has own `formatDurationMs`)
   - Removed unused `displayName` in `RunActionsCell`
   - Removed unused `isLoading` in `RunsTab`
   - Removed unused `Cloud`, `Server` icon imports
