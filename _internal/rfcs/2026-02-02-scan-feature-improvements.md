# Scan Feature Improvements - Implementation Plan

**Created:** 2026-02-02
**Status:** IN PROGRESS
**Priority:** HIGH
**Estimated Effort:** 4-6 weeks
**Author:** Security Engineering Team
**Last Updated:** 2026-02-02

---

## Executive Summary

Based on comprehensive evaluation, the Scan feature scores **6.6/10**. While core functionality is solid, significant gaps exist in:
- Rate limiting (security risk)
- UI/UX polish (clone, bulk operations)
- CI/CD integration (DevSecOps adoption)
- Observability (operational visibility)

This RFC outlines a phased implementation plan to reach **9/10** production readiness.

---

## Implementation Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1.1 Rate Limiting | **EXISTING** | Already implemented (`TriggerRateLimiter`) |
| 1.2 Database Indexes | **DONE** | Migration 000150 created |
| 1.3 Scheduler Metrics | **DONE** | Added to `internal/metrics/metrics.go` |
| 2.1 Clone Scan UI | **DONE** | `CloneScanDialog` component created |
| 2.2 Bulk Operations | **DONE** | Backend + Frontend implemented |
| 2.3 Advanced Filters | **DONE** | Schedule type + tag filters added |
| 2.4 Asset-Scanner Matching | **PLANNED** | See RFC `2026-02-02-asset-types-cleanup.md` |
| 3.1 GitHub Actions | Pending | - |
| 3.2 PR Status Checks | Pending | - |
| 4.1 Export Results | **DONE** | CSV/JSON export added to Runs tab |
| 4.2 Config Import/Export | Pending | - |
| 5.1 Test Coverage | Pending | - |
| 5.2 Documentation | Pending | - |

---

## Completed Work (2026-02-02)

### Phase 1: Security & Performance

#### 1.1 Rate Limiting
**Status:** Already exists as `TriggerRateLimiter` middleware
- Scan triggers: 20 per minute per tenant
- Quick scans: 10 per minute per tenant
- Applied to `/scans/{id}/trigger`, `/quick-scan`, `/pipelines/{id}/runs`

#### 1.2 Database Indexes
**Status:** COMPLETED

Created migration `000150_scan_performance_indexes.up.sql`:
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scans_tenant_status ON scans(tenant_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scans_tenant_created ON scans(tenant_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scans_active_scheduled ON scans(next_run_at)
    WHERE status = 'active' AND schedule_type != 'manual' AND next_run_at IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scan_sessions_tenant_status ON scan_sessions(tenant_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scan_sessions_tenant_created ON scan_sessions(tenant_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scan_sessions_scanner ON scan_sessions(tenant_id, scanner_name);
```

#### 1.3 Scheduler Observability
**Status:** COMPLETED

Added metrics to `api/internal/metrics/metrics.go`:
- `openctem_scans_trigger_duration_seconds` - Histogram for trigger latency
- `openctem_scans_scheduler_errors_total` - Counter for scheduler errors
- `openctem_scans_scheduler_lag_seconds` - Gauge for scheduler lag
- `openctem_scans_concurrent_runs` - Gauge for concurrent runs per tenant
- `openctem_scans_quality_gate_results_total` - Counter for quality gate results

Re-exported in `api/internal/app/metrics.go` for backward compatibility.

---

### Phase 2: UI/UX Improvements

#### 2.1 Clone Scan Dialog
**Status:** COMPLETED

Created `ui/src/features/scans/components/clone-scan-dialog.tsx`:
- Shows configuration summary (type, schedule, targets, tags)
- Input for new name with validation
- Uses existing `useCloneScanConfig` hook
- Integrated into scan actions dropdown

#### 2.2 Bulk Operations
**Status:** COMPLETED

**Backend:**
- Added `BulkActionResult` type to `scan/crud.go`
- Implemented `BulkActivate`, `BulkPause`, `BulkDisable`, `BulkDelete` methods
- Added handlers to `scan_handler.go`
- Registered routes: `/api/v1/scans/bulk/{activate,pause,disable,delete}`

**Frontend:**
- Added bulk hooks: `useBulkActivateScanConfigs`, `useBulkPauseScanConfigs`, etc.
- Added bulk action handlers in ConfigurationsTab
- Updated selection dropdown with real API calls
- Shows loading state during bulk operations

#### 2.3 Advanced Filtering
**Status:** COMPLETED

Added to ConfigurationsTab:
- Schedule type filter (Manual, Daily, Weekly, Monthly, Custom)
- Tag filter (text input)
- Active filter badges with clear buttons
- Filters passed to API via query parameters

---

### Phase 4: Export & Reporting

#### 4.1 Scan Results Export
**Status:** COMPLETED

Added export utilities to `ui/src/lib/utils.ts`:
- `exportToCSV<T>()` - Export data to CSV with custom column mapping
- `exportToJSON<T>()` - Export data to JSON
- `escapeCSVField()` - Proper CSV escaping
- `downloadFile()` - Browser file download trigger

Added to RunsTab:
- Export dropdown with CSV and JSON options
- Exports filtered sessions or all sessions
- Custom column labels for CSV export
- Includes timestamp in filename

---

## Remaining Work

### Phase 2.4: Asset-Scanner Compatibility (NEW - High Priority)
**RFC:** `2026-02-02-asset-types-cleanup.md`

**Problem Identified:**
- 5 duplicate/legacy asset types causing confusion
- No validation between tool `supported_targets` and asset types
- `SupportsTarget()` method is dead code (never called)

**Implementation Plan:**
- [ ] 2.4.1 Asset Types Cleanup Migration (1 day)
  - Remove: `code_repo`, `application`, `endpoint`, `cloud`, `other`
  - Migrate existing assets to correct types
- [ ] 2.4.2 Target Mapping Module (1 day)
  - Create `tool/target_mapping.go` with bidirectional mapping
  - Map tool targets (`url`, `domain`, `ip`) to asset types (`website`, `domain`, `ip_address`)
- [ ] 2.4.3 Compatibility Validation (1 day)
  - Add `CheckAssetCompatibility()` to scan trigger
  - Return warning (not blocking) for incompatible assets
- [ ] 2.4.4 UI Warning Component (0.5 day)
  - Display compatibility warning when triggering scan
  - Show which asset types will be skipped

### Phase 3: CI/CD Integration (Not Started)
- [ ] 3.1 GitHub Actions integration
- [ ] 3.2 PR Status Checks

### Phase 4: Export & Reporting
- [ ] 4.2 Scan Configuration Import/Export

### Phase 5: Testing & Documentation (Not Started)
- [ ] 5.1 Test Coverage (target: >70%)
- [ ] 5.2 Documentation updates

---

## Files Modified

### Backend
- `api/internal/app/scan/crud.go` - Bulk operations
- `api/internal/infra/http/handler/scan_handler.go` - Bulk handlers
- `api/internal/infra/http/routes/scanning.go` - Bulk routes
- `api/internal/metrics/metrics.go` - Scheduler metrics
- `api/internal/app/metrics.go` - Metrics re-export
- `api/migrations/000150_scan_performance_indexes.up.sql` - NEW
- `api/migrations/000150_scan_performance_indexes.down.sql` - NEW

### Frontend
- `ui/src/features/scans/components/clone-scan-dialog.tsx` - NEW
- `ui/src/features/scans/components/index.ts` - Export barrel
- `ui/src/app/(dashboard)/(discovery)/scans/page.tsx` - Bulk ops, filters, export
- `ui/src/lib/api/scan-hooks.ts` - Bulk hooks
- `ui/src/lib/api/scan-types.ts` - Bulk types
- `ui/src/lib/api/endpoints.ts` - Bulk endpoints
- `ui/src/lib/utils.ts` - Export utilities

---

## Success Metrics Progress

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Feature Score | 6.6/10 | 8.0/10 | 9/10 |
| Rate Limiting | None | Exists | Done |
| Clone UI | None | Done | Done |
| Bulk Operations | None | Done | Done |
| Advanced Filters | Basic | Done | Done |
| Export Results | None | Done | Done |

---

---

## Related RFCs

- **`2026-02-02-asset-types-cleanup.md`** - Asset types cleanup and scanner matching implementation details

---

## Expert Review Notes

### Phase 2.4 Risk Assessment

See full review in `2026-02-02-asset-types-cleanup.md` Section "Expert Review & Risk Assessment".

**Key Risks Identified:**
1. Migration rollback risk (HIGH) - Need backup + staging test
2. UX confusion with "other" type - Rename to "Unclassified"
3. Security: Add input validation + audit logging for admin APIs
4. Performance: Benchmark filtering with 10k+ assets

**Pre-Implementation Checklist:**
- [ ] Database backup configured
- [ ] Staging has production data snapshot
- [ ] Feature flag ready for filtering
- [ ] Monitoring alerts configured

---

*Document Version: 1.3*
*Last Updated: 2026-02-02*
*Changes in v1.3: Added Expert Review Notes section with risk summary*
