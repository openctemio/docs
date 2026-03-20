# RFC: Stabilize & Harden — Production Readiness

**Created:** 2026-03-16
**Status:** PLANNED (not started)
**Priority:** P0
**Timeline:** 6 weeks
**Scope:** Testing, bug fixes, performance tuning, CI/CD hardening

---

## Summary

MVP 1 is feature-complete across all 5 CTEM stages. Before open-source release, we need to harden the codebase with comprehensive testing, fix CI/CD gaps, and validate performance under realistic load.

---

## Current State

| Metric | Current | Target |
|--------|---------|--------|
| Go unit tests | 88 files | 100+ files |
| Go integration tests | 9 files | 25+ files |
| Repository tests | 0/77 repos | 40+ repos |
| Handler tests | 6/64 handlers | 30+ handlers |
| Frontend tests | 24 files | 50+ files |
| Frontend coverage | 84.28% | 85%+ |
| CI linting (Go) | Disabled | Enabled + blocking |
| E2E tests | None | 10+ critical flows |
| Performance benchmarks | None | Key queries baselined |
| TODO/FIXME comments | 17 | < 5 |

---

## Phase 1: CI/CD Hardening (Week 1)

### 1.1 Re-enable Go Linting in CI

**Problem:** `golangci-lint` disabled because it didn't support Go 1.25.8.

**Action:**
- Update `golangci-lint` to latest version (or pin to nightly supporting Go 1.25)
- If still incompatible: use `go vet` + `staticcheck` as interim
- Set lint failures as **blocking** on PRs
- Add `GOWORK=off` to CI environment

**Files:** `.github/workflows/ci.yml`

### 1.2 Add Code Coverage Thresholds

**Action:**
- Backend: Enforce minimum 75% coverage per PR (reject if decreases)
- Frontend: Maintain 84%+ threshold (already good)
- Upload coverage to Codecov with status checks
- Add coverage badges to README

**Files:** `.github/workflows/ci.yml` (both API and UI)

### 1.3 Fix Remaining TODO Comments

| File | TODO | Action |
|------|------|--------|
| `workflow_service.go:389` | Transaction wrapper | Implement or document as accepted |
| `pipeline/run.go:722` | Expression evaluation | Stub with documented limitation |
| `dashboard_repository.go:150` | due_date column | Add migration or remove TODO |
| `llm/factory.go:199` | Azure OpenAI provider | Mark as Phase 2 or implement |
| `asset_handler.go:1619` | Queue scan job | Document as future enhancement |
| `component_handler.go:566` | Map status | Implement or remove |
| Frontend TODOs (11) | Various stubs | Wire to real APIs or document |

---

## Phase 2: Repository Layer Testing (Week 2)

### 2.1 Priority Repository Tests

**Why critical:** 77 repositories with 0 dedicated tests. Database is the most common source of production bugs.

**Test categories (ordered by risk):**

#### Tier 1 — Data Integrity (must have)
- `asset_repository.go` — CRUD, tenant isolation, tag queries, bulk operations
- `finding_repository.go` — Status transitions, severity queries, SLA calculations
- `group_repository.go` — Member management, pagination, added_by resolution
- `access_control_repository.go` — Scope rules, asset ownership, permission sets
- `user_repository.go` — Auth queries, session management

#### Tier 2 — Business Logic (should have)
- `integration_repository.go` — Credential encryption/decryption roundtrip
- `workflow_repository.go` — Node/edge graph operations, run tracking
- `scan_repository.go` — Scan creation, run tracking
- `notification_repository.go` — Watermark pattern, read status
- `outbox_repository.go` — FOR UPDATE SKIP LOCKED, retry logic

#### Tier 3 — Supporting (nice to have)
- `audit_repository.go` — Immutable writes, trigger protection
- `dashboard_repository.go` — Aggregation queries performance
- `sla_repository.go` — Policy lookup, asset override

**Test patterns:**
```go
// Use testcontainers-go for real PostgreSQL
func TestAssetRepository_Create(t *testing.T) {
    db := setupTestDB(t)
    repo := postgres.NewAssetRepository(db)

    // Test: Create asset with tags
    // Test: Tenant isolation (can't read other tenant's assets)
    // Test: Duplicate slug returns conflict error
    // Test: NULL/empty fields handled correctly
    // Test: Bulk create with partial failures
}
```

**Infrastructure:** Use `testcontainers-go` with PostgreSQL 17 image (matches production).

**Files:** New directory `api/tests/repository/`

---

## Phase 3: Handler & Integration Testing (Week 3)

### 3.1 Handler Tests (HTTP Layer)

**Target:** 30+ handlers (currently 6/64)

**Priority handlers to test:**
1. `asset_handler.go` — List with filters, create validation, bulk operations
2. `vulnerability_handler.go` — Finding CRUD, status transitions
3. `group_handler.go` — Pagination, member management, asset assignment
4. `scope_rule_handler.go` — Rule creation, preview, reconciliation
5. `integration_handler.go` — Credential handling, test connection
6. `auth_handler.go` — Login, token refresh, registration
7. `pipeline_handler.go` — Trigger, run tracking
8. `notification_handler.go` — In-app notifications, preferences

**Test patterns:**
```go
func TestAssetHandler_List(t *testing.T) {
    // Setup mock service
    // Test: Returns paginated results
    // Test: Filters by type, status, tags
    // Test: 403 without permission
    // Test: 400 on invalid query params
    // Test: Empty result set returns []
}
```

### 3.2 Cross-Service Integration Tests

**Target:** 25+ integration tests (currently 9)

**New integration tests:**
1. Asset created → Scope rule evaluation → Auto-assigned to group
2. Finding created → Workflow triggered → Notification sent
3. Member added to group → Notification received → Permission updated
4. Scan triggered → Agent polls → Results ingested → Findings created
5. SLA policy created → Finding due dates calculated
6. Role changed → Permission version incremented → Cache invalidated
7. Integration created → Test connection → Notification sent
8. Scope rule created → Reconciliation → Assets assigned

**Files:** `api/tests/integration/`

---

## Phase 4: Frontend Testing (Week 4)

### 4.1 Component Tests

**Target:** 50+ test files (currently 24)

**Priority components:**
1. Group detail sheet (pagination, member management, scope rules)
2. Finding detail view (status transitions, activity, approvals)
3. Scan configuration (compatibility warnings, asset selection)
4. Dashboard (stats display, chart rendering)
5. Notification center (real-time updates, mark read)
6. Permission gate (conditional rendering)
7. Integration setup (credential forms, test connection)

### 4.2 E2E Tests (Playwright)

**Target:** 10 critical user flows

| Flow | Steps | Priority |
|------|-------|----------|
| Login → Dashboard | Auth → token → redirect → stats display | P0 |
| Create Asset | Login → Assets → Create → Verify in list | P0 |
| Trigger Scan | Login → Scans → Configure → Trigger → View run | P0 |
| View Finding | Login → Findings → Click → Detail → Activity tab | P0 |
| Manage Group | Login → Settings → Groups → Add member → Verify | P1 |
| Setup Integration | Login → Settings → Integrations → Slack → Test | P1 |
| Permission Check | Login as viewer → Verify no edit buttons | P1 |
| Scope Rule | Login → Group → Scope Rules → Create → Preview | P1 |
| Notification | Trigger action → Check notification bell updates | P2 |
| Multi-tenant | Login → Switch tenant → Verify data isolation | P2 |

**Setup:** Playwright with Docker Compose test environment.

**Files:** `ui/e2e/`

---

## Phase 5: Performance Validation (Week 5)

### 5.1 Query Performance Benchmarks

**Benchmark critical queries with realistic data volumes:**

| Query | Table | Target Rows | Target P95 |
|-------|-------|-------------|------------|
| List assets (paginated) | assets | 100K | < 50ms |
| List findings (filtered) | findings | 500K | < 100ms |
| Dashboard stats | multiple | 100K assets + 500K findings | < 200ms |
| Scope rule reconciliation | assets + scope_rules | 50K assets | < 5s |
| Permission check | user_roles + permissions | 1K users | < 10ms |
| Group members (paginated) | group_members + users | 10K members | < 30ms |
| Audit log search | audit_logs | 1M rows | < 200ms |

**Tools:** `pgbench` custom scripts + Go benchmark tests

**Files:** `api/tests/benchmark/`

### 5.2 Load Testing

**Tool:** `k6` or `vegeta`

**Scenarios:**
1. Steady state: 50 concurrent users, 10 req/s, 30 minutes
2. Burst: 200 concurrent users, 100 req/s, 5 minutes
3. Scan storm: 20 concurrent scan triggers with 1000 assets each

**Targets:**
- P95 latency < 200ms for read endpoints
- P95 latency < 500ms for write endpoints
- Error rate < 0.1%
- No memory leaks over 30 minutes

### 5.3 Index Optimization Review

**Action:**
- Run `EXPLAIN ANALYZE` on all critical queries with production-scale data
- Review `pg_stat_user_indexes` for unused indexes
- Add missing indexes for slow queries
- Document query plans for critical paths

---

## Phase 6: Security Hardening Review (Week 6)

### 6.1 Security Audit Checklist

| Area | Check | Status |
|------|-------|--------|
| SQL Injection | All queries use parameterized placeholders | Verify |
| XSS | All user input sanitized in responses | Verify |
| CSRF | Token validation on mutations | Verify |
| Rate Limiting | All public endpoints rate-limited | Verify |
| Auth Bypass | All protected routes require auth middleware | Verify |
| Tenant Isolation | All queries include tenant_id WHERE clause | Verify |
| Credential Storage | AES-256-GCM encryption for secrets | ✅ Done |
| Error Messages | Generic errors on auth failures | ✅ Done |
| Audit Logging | All mutations logged | ✅ Done |
| Session Management | Revocation, timeout, concurrent limits | Verify |

### 6.2 Dependency Audit

**Action:**
- Run `govulncheck` and fix all findings
- Run `npm audit` and fix all high/critical
- Pin all dependencies to exact versions
- Document known acceptable vulnerabilities

---

## Success Criteria

| Criteria | Target |
|----------|--------|
| All CI checks pass (lint + test + build) | Green on main branch |
| Repository test coverage | 40+ repos tested |
| Handler test coverage | 30+ handlers tested |
| Frontend test files | 50+ test files |
| E2E tests | 10 critical flows passing |
| Performance benchmarks | All within targets |
| Security audit | No critical/high findings |
| TODO comments | < 5 remaining |
| Zero known data integrity bugs | Verified via repository tests |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| testcontainers-go flaky in CI | Medium | Use dedicated PostgreSQL service in CI |
| Playwright setup complexity | Low | Use Docker Compose test environment |
| Performance targets too aggressive | Low | Adjust based on first benchmark run |
| Linter upgrade breaks builds | Medium | Run in warning mode first, then blocking |

---

## Dependencies

- `golangci-lint` Go 1.25 support (or alternative linter)
- `testcontainers-go` v0.31+ for PostgreSQL 17
- `playwright` npm package for E2E
- `k6` or `vegeta` for load testing
- Test PostgreSQL with seed data (script needed)
