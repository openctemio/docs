# Implementation Review: Source Code Security Feature

> **Date**: January 28, 2026
> **Reviewed by**: PM/Tech Lead/BA/Security Expert Perspectives
> **Status**: Implementation in Progress

---

## Executive Summary

Implementation Plan cho Source Code Security feature được đánh giá **SOLID (7.5/10)** với một số vấn đề bảo mật cần khắc phục ngay.

### Quick Assessment

| Category | Score | Notes |
|----------|-------|-------|
| Architecture | 8/10 | Good module reuse decision |
| Security | 6/10 | Several issues need immediate fix |
| Code Quality | 8/10 | Clean, follows patterns |
| Completeness | 7/10 | Core done, gaps remain |
| Maintainability | 8/10 | Well-structured, documented |

---

## Part 1: PM/Tech Lead Assessment

### 1.1 What's Been Implemented

| Feature | Status | Quality |
|---------|--------|---------|
| Finding Activities - Migration | ✅ Done | Good |
| Finding Activities - Domain | ✅ Done | Good |
| Finding Activities - Service | ✅ Done | Good |
| Finding Activities - Repository | ✅ Done | Good |
| Finding Activities - Handler | ✅ Done | Needs security review |
| Finding Activities - UI Hook | ✅ Done | Good |
| Agent -fail-on flag | ✅ Done | Good |
| Agent -output-format sarif | ✅ Done | Good |
| GitLab CI Templates | ✅ Done | Good |

### 1.2 Gaps and Missing Features

| Gap | Priority | Impact |
|-----|----------|--------|
| **Authorization check in ListActivities** | P0 - Critical | Security vulnerability |
| **Rate limiting on activity endpoints** | P1 - High | DoS risk |
| **Input validation on filter params** | P1 - High | Security |
| Source context storage | P2 - Medium | Feature incomplete |
| Scan runs tracking | P2 - Medium | Feature incomplete |
| AI Triage | P3 - Low | Future feature |

### 1.3 Architecture Decision Review

**Good Decisions:**
1. ✅ Reusing existing modules instead of creating new ones - reduces complexity
2. ✅ Append-only activity table - good audit trail design
3. ✅ Separation of comments (mutable) vs activities (immutable)
4. ✅ Agent CLI enhancement vs new tool - consistent UX

**Concerns:**
1. ⚠️ Large main.go file (1600+ lines) - should refactor
2. ⚠️ SARIF output duplicates CTIS format - potential maintenance burden
3. ⚠️ No explicit tenant isolation check in repository layer

### 1.4 Technical Debt Introduced

1. **Agent main.go size**: 1600+ lines, should split into packages
2. **Duplicate SARIF struct**: Already exists in SDK, redefined in agent
3. **Hardcoded severity levels**: Should use shared constants

---

## Part 2: Security Expert Assessment

### 2.1 Critical Security Issues (MUST FIX)

#### Issue #1: Missing Tenant Authorization in Activity Listing

**Location**: `finding_activity_handler.go:89-94`

**Current Code:**
```go
// IDOR prevention
tenantID := middleware.MustGetTenantID(r.Context())
if f.TenantID().String() != tenantID {
    apierror.NotFound("Finding").WriteJSON(w)
    return
}
```

**Problem**: Only checks finding ownership, but doesn't verify in the ListActivities query that all returned activities belong to the tenant.

**Risk**: Information disclosure if there's a bug in the activity-finding relationship.

**Fix Required**:
```go
// Add tenant_id filter to activity query
filter = filter.WithTenantID(tenantID)
```

#### Issue #2: No Rate Limiting on Activity Endpoints

**Location**: All activity endpoints

**Problem**: No rate limiting means attackers can:
- Enumerate finding IDs
- DoS the database with repeated queries
- Cause high cloud costs

**Risk**: DoS, enumeration attack, cost attack

**Fix Required**:
```go
// Add rate limiter middleware
router.Use(ratelimit.Middleware(ratelimit.Config{
    RequestsPerMinute: 60,
    BurstSize: 10,
}))
```

#### Issue #3: Unbounded JSONB in Changes Field

**Location**: `finding_activity.go` - Changes field

**Problem**: No size limit on `changes` JSONB field. Attacker could create activities with massive JSON payloads.

**Risk**: Database bloat, DoS

**Fix Required**:
```go
// Limit changes size
if len(changesJSON) > 10*1024 { // 10KB limit
    return fmt.Errorf("changes too large")
}
```

### 2.2 High Priority Security Issues

#### Issue #4: SQL Injection Risk in Filter Building

**Location**: `finding_activity_repository.go:320-388`

**Current Code:**
```go
func (r *FindingActivityRepository) buildWhereClause(filter vulnerability.FindingActivityFilter, findingID shared.ID) (string, []any) {
    // Using parameterized queries - GOOD
    conditions = append(conditions, fmt.Sprintf("fa.finding_id = $%d", argIndex))
```

**Assessment**: Currently safe due to parameterized queries. However, if anyone adds string concatenation, it becomes vulnerable.

**Recommendation**: Add security comment and code review checklist.

#### Issue #5: No Pagination Limit Enforcement at Repository Level

**Location**: `finding_activity_repository.go:104`

**Current Code:**
```go
baseQuery += fmt.Sprintf(" LIMIT %d OFFSET %d", page.Limit(), page.Offset())
```

**Problem**: If `page.Limit()` returns a very large number, it could cause memory issues.

**Fix Required**:
```go
limit := page.Limit()
if limit > 100 {
    limit = 100 // Enforce max
}
```

#### Issue #6: Agent SARIF Output Contains Sensitive Data

**Location**: `agent/main.go` - outputSARIF function

**Problem**: SARIF output may contain:
- Code snippets with secrets
- File paths revealing internal structure
- CVE data that could be used for attacks

**Risk**: Information disclosure

**Mitigation**:
```go
// Add option to redact sensitive data
if *redactSecrets {
    finding.Location.Snippet = "[REDACTED]"
}
```

### 2.3 Medium Priority Security Issues

#### Issue #7: No Audit Log for Activity API Access

**Problem**: No logging of who accessed which activities. Needed for security auditing.

**Fix Required**:
```go
// Add access logging
h.logger.Info("activities accessed",
    "user_id", userID,
    "finding_id", findingID,
    "ip", r.RemoteAddr,
)
```

#### Issue #8: CI Template Exposes API Key Pattern

**Location**: `ci/gitlab/openctem-security.yml`

**Problem**: Template shows where API keys are stored (`$OPENCTEM_API_TOKEN`), making it easier for attackers to target.

**Mitigation**: Use masked variables and document security best practices.

#### Issue #9: No Integrity Check on SARIF Output

**Problem**: SARIF files could be modified after generation. GitLab doesn't verify integrity.

**Mitigation**: Add checksum or signature to SARIF output.

### 2.4 Security Best Practices Missing

| Practice | Status | Recommendation |
|----------|--------|----------------|
| Input validation | Partial | Add comprehensive validation |
| Output encoding | ✅ | JSON encoding is safe |
| Authentication | ✅ | Uses existing auth |
| Authorization | ⚠️ | Need tenant-level checks |
| Rate limiting | ❌ | Must add |
| Audit logging | ⚠️ | Basic logging, needs enhancement |
| Error handling | ⚠️ | May leak internal details |
| Secrets handling | ⚠️ | API keys in CI need protection |

---

## Part 3: BA Assessment - Functional Gaps

### 3.1 User Stories Not Covered

| Story | Priority | Gap |
|-------|----------|-----|
| "As a developer, I want to see code context" | High | Source context not stored |
| "As a security lead, I want trend analysis" | Medium | Analytics not implemented |
| "As an admin, I want to set severity thresholds per repo" | Medium | Repository settings not implemented |
| "As a compliance officer, I want SBOM export" | Low | Not implemented |

### 3.2 Edge Cases Not Handled

1. **Activity for deleted finding**: What happens when finding is deleted?
   - Current: CASCADE delete removes activities
   - Concern: May lose audit trail for compliance

2. **Concurrent activity creation**: What if two users change status simultaneously?
   - Current: Both activities created
   - May need: Optimistic locking on finding status

3. **Very old activities**: No retention policy
   - Concern: Database growth
   - Need: Archival strategy

### 3.3 UX Issues

1. **Activity type filtering**: Only single type, should support multiple
2. **No search in activities**: Can't search by content
3. **No bulk operations**: Can't mark multiple findings

---

## Part 4: Implementation Plan - Fixes

### Phase 0: Critical Security Fixes (Must do NOW)

```
Priority: P0 - Before any deployment
Timeline: Immediate
```

#### Fix 1: Add Tenant Verification to Repository

```go
// finding_activity_repository.go - Update ListByFinding
func (r *FindingActivityRepository) ListByFinding(
    ctx context.Context,
    findingID shared.ID,
    tenantID shared.ID,  // ADD THIS
    filter vulnerability.FindingActivityFilter,
    page pagination.Pagination,
) (pagination.Result[*vulnerability.FindingActivity], error) {
    // Add tenant check to WHERE clause
    conditions = append(conditions, fmt.Sprintf("fa.tenant_id = $%d", argIndex))
    args = append(args, tenantID.String())
    argIndex++
    // ...
}
```

#### Fix 2: Add Rate Limiting Middleware

```go
// Add to routes/exposure.go
activityRoutes := r.Group("/findings/{id}/activities")
activityRoutes.Use(middleware.RateLimit(60, time.Minute))
```

#### Fix 3: Limit Changes Size

```go
// finding_activity_service.go - RecordActivity
func (s *FindingActivityService) RecordActivity(ctx context.Context, input RecordActivityInput) (*vulnerability.FindingActivity, error) {
    // Validate changes size
    changesJSON, _ := json.Marshal(input.Changes)
    if len(changesJSON) > 10*1024 {
        return nil, fmt.Errorf("%w: changes exceed 10KB limit", shared.ErrValidation)
    }
    // ...
}
```

#### Fix 4: Add Access Logging

```go
// finding_activity_handler.go - ListActivities
func (h *FindingActivityHandler) ListActivities(w http.ResponseWriter, r *http.Request) {
    userID := middleware.GetUserID(r.Context())
    h.logger.Info("finding activities accessed",
        "user_id", userID,
        "finding_id", findingID,
        "client_ip", middleware.GetClientIP(r),
    )
    // ...
}
```

### Phase 1: High Priority Fixes (This Sprint)

1. **Refactor Agent main.go**: Split into packages
2. **Add input validation**: Use go-playground/validator
3. **Add pagination max limit**: Enforce at repository level
4. **Add SARIF redaction option**: Protect sensitive data

### Phase 2: Medium Priority (Next Sprint)

1. **Source context storage**: Complete the feature
2. **Activity retention policy**: Add archival
3. **Enhanced audit logging**: Full access trail
4. **Error message sanitization**: Don't leak internals

---

## Part 5: Recommendations

### Immediate Actions

1. **DO NOT DEPLOY** until P0 fixes are complete
2. Add security review step to PR process
3. Enable rate limiting on all API endpoints

### Code Quality

1. Split `agent/main.go` into packages:
   - `cmd/agent/main.go` - entry point
   - `internal/output/sarif.go` - SARIF output
   - `internal/gate/security.go` - security gate logic

2. Use shared severity constants:
   ```go
   // pkg/security/severity.go
   type Severity string
   const (
       SeverityCritical Severity = "critical"
       SeverityHigh     Severity = "high"
       // ...
   )
   ```

### Architecture

1. Consider adding a security middleware layer
2. Implement proper authorization service
3. Add comprehensive integration tests for security

### Documentation

1. Add security considerations to API docs
2. Document rate limits and quotas
3. Add threat model documentation

---

## Conclusion

The implementation is **well-structured** but has **critical security gaps** that must be addressed before production deployment. The core architecture decisions are sound, and the code quality is good.

**Next Steps**:
1. Implement P0 security fixes (estimated: 2-4 hours)
2. Add comprehensive tests for security scenarios
3. Security review by external party before production

**Overall Readiness**: 70% - Needs security hardening before deployment.
