---
layout: default
title: "RFC-008: Scope Configuration Hardening & Completion"
parent: Decisions
nav_order: 8
---

# RFC-008: Scope Configuration Hardening & Completion

**Status:** Proposed
**Date:** 2026-03-03
**Authors:** Security Review Team

---

## Context

Code review of the Scope Configuration feature (CTEM Phase 1) revealed several security and functional issues:

1. **CRITICAL - IDOR Cross-Tenant Deletion**: The `Delete` methods on `TargetRepository`, `ExclusionRepository`, and `ScheduleRepository` accept only `id` without `tenant_id`, allowing potential cross-tenant data deletion. The service layer uses a TOCTOU (Time-of-Check-Time-of-Use) pattern with separate `GetByID` + tenant compare + `Delete` calls, which is not atomic.

2. **Missing Tenant Verification**: The `Activate/Deactivate/Enable/Disable/Approve` handlers do not extract or pass `tenantID` to service methods, allowing cross-tenant state mutations.

3. **Fake Run Now**: The "Run Now" button on scan schedules only shows a toast notification without making any API call.

4. **Incomplete Edit Target**: The Edit Target form does not send `priority` and `tags` fields to the API.

5. **No CRON Validation**: Cron expressions are accepted without validation, allowing invalid schedules.

6. **Missing Swagger Docs**: 10+ endpoints lack proper Swagger documentation.

## Decision

Implement a 4-phase hardening plan:

### Phase 1: Security Fixes (CRITICAL)
- Add `tenantID` parameter to all `Delete` interface signatures
- Update DELETE SQL queries to include `WHERE tenant_id = $1 AND id = $2`
- Remove TOCTOU pattern from service Delete methods - use atomic DB delete
- Add `tenantID` parameter to Activate/Deactivate/Enable/Disable/Approve service methods
- Update handlers to extract and pass `tenantID` from JWT context

### Phase 2: Functional Completions (HIGH)
- Implement `RunScheduleNow` backend endpoint (service + handler + route)
- Wire frontend "Run Now" button to actual API call
- Fix Edit Target to include `priority` and `tags` in update payload

### Phase 3: Validation & UX (MEDIUM)
- Add CRON expression validation using `github.com/robfig/cron/v3`
- Add Swagger documentation for undocumented endpoints

### Phase 4: Polish (LOW)
- Pattern conflict detection for overlapping scope targets

## Implementation Details

### Files Modified

| File | Changes |
|------|---------|
| `api/pkg/domain/scope/repository.go` | Add `tenantID` to Delete interfaces |
| `api/pkg/domain/scope/entity.go` | Add `SetCronSchedule` error return, `ValidateCronExpression` |
| `api/internal/infra/postgres/scope_target_repository.go` | Fix Delete SQL with tenant_id |
| `api/internal/infra/postgres/scope_exclusion_repository.go` | Fix Delete SQL with tenant_id |
| `api/internal/infra/postgres/scope_schedule_repository.go` | Fix Delete SQL with tenant_id |
| `api/internal/app/scope_service.go` | Atomic deletes, tenant verification, RunScheduleNow, CRON validation, pattern overlap |
| `api/internal/infra/http/handler/scope_handler.go` | Pass tenantID, RunScheduleNow handler, Swagger docs |
| `api/internal/infra/http/routes/assets.go` | Register RunScheduleNow route |
| `api/tests/unit/scope_service_test.go` | Update mocks for new Delete signatures |
| `ui/src/features/scope/api/use-scope-api.ts` | Add `runScheduleNow` function |
| `ui/src/app/(dashboard)/(scoping)/scope-config/page.tsx` | Wire Run Now, fix edit target payload |

### Security Pattern (Delete)

**Before (vulnerable):**
```go
func (s *ScopeService) DeleteTarget(ctx, targetID, tenantID string) error {
    target, _ := s.targetRepo.GetByID(ctx, parsedID) // TOCTOU window
    if target.TenantID() != parsedTenantID { return ErrNotFound }
    return s.targetRepo.Delete(ctx, parsedID) // No tenant check in SQL
}
```

**After (secure):**
```go
func (s *ScopeService) DeleteTarget(ctx, targetID, tenantID string) error {
    return s.targetRepo.Delete(ctx, parsedTenantID, parsedID) // Atomic
}
```

**SQL Change:**
```sql
-- Before
DELETE FROM scope_targets WHERE id = $1

-- After
DELETE FROM scope_targets WHERE tenant_id = $1 AND id = $2
```

## Consequences

### Positive
- Eliminates IDOR cross-tenant deletion vulnerability
- Atomic delete operations prevent TOCTOU race conditions
- Run Now functionality actually works
- CRON validation prevents invalid schedules
- Better API documentation

### Negative
- Interface change requires updating all callers and mocks
- Additional parameter in Delete methods slightly more verbose

## Test Scenarios

1. Delete target with wrong tenant_id returns 404 (not deleted)
2. Delete target with correct tenant_id succeeds
3. Activate/Deactivate with wrong tenant returns 404
4. Run Now creates a schedule run record
5. Invalid cron expression returns 400 error
6. Edit Target saves priority and tags

## Related

- CTEM Phase 1: Scoping module
- OWASP A01:2021 - Broken Access Control (IDOR)
- [RFC-006](006-scan-targets-flexibility.md) - Flexible Scan Target Selection
