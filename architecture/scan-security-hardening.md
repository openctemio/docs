---
layout: default
title: Scan Security Hardening
parent: Architecture
nav_order: 29
---

# Scan Security Hardening

> **Status**: Implemented
> **Version**: v1.0
> **Completed**: 2026-01-26

## Overview

Comprehensive security hardening of the Scan Orchestration System covering command injection prevention, tenant isolation, audit logging, rate limiting, input sanitization, and concurrent run limits.

## Security Findings & Fixes

10 security issues were identified and fixed across 4 severity levels:

| ID | Severity | Issue | Fix |
|----|----------|-------|-----|
| SEC-001 | Critical | Command injection via step config | SecurityValidator |
| SEC-002 | Critical | Scanner config passthrough to agent | Config sanitization |
| SEC-003 | Critical | Tool name injection | Whitelist validation |
| SEC-004 | High | Missing tenant isolation in GetRun | Tenant ID check |
| SEC-005 | High | Missing tenant isolation in DeleteStep | Template tenant check |
| SEC-006 | High | Cross-tenant asset group reference | Asset group tenant check |
| SEC-007 | Medium | No audit trail for pipeline actions | Audit logging |
| SEC-008 | Medium | No rate limiting on triggers | Per-tenant rate limits |
| SEC-009 | Low | No concurrent run limits | Concurrency caps |
| SEC-010 | Low | Input validation gaps | Input sanitization |

## SecurityValidator Service

Central security validation service that intercepts all scan/pipeline operations.

```
┌──────────────────────────────────────────────────────────────┐
│                    Security Validator                          │
│                                                               │
│   ┌─────────────────┐  ┌─────────────────────────────────┐  │
│   │ Tool Validation  │  │ Config Validation                │  │
│   │                  │  │                                  │  │
│   │ - Name whitelist │  │ - Dangerous key detection        │  │
│   │ - Capability     │  │ - Command injection patterns     │  │
│   │   whitelist      │  │ - Path traversal detection       │  │
│   └─────────────────┘  └─────────────────────────────────┘  │
│                                                               │
│   ┌─────────────────┐  ┌─────────────────────────────────┐  │
│   │ Cron Validation  │  │ Tenant Isolation                 │  │
│   │                  │  │                                  │  │
│   │ - Expression     │  │ - Asset group ownership          │  │
│   │   syntax check   │  │ - Run tenant check               │  │
│   └─────────────────┘  └─────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Dangerous Config Key Detection

The validator blocks config keys that could enable command execution:

```
command, cmd, exec, execute, shell, bash, sh, script, eval,
system, popen, subprocess, spawn, run_command, os_command,
raw_command, custom_command
```

### Command Injection Pattern Detection

Scans config values for shell metacharacters and injection patterns:

| Pattern | Examples |
|---------|----------|
| Shell metacharacters | `; && \|\| \` $ ( )` |
| Command substitution | `` `cmd` ``, `$(cmd)` |
| Command chaining | `cmd1 ; cmd2`, `cmd1 && cmd2` |
| Path traversal | `../`, `/etc/`, `/proc/` |
| Dangerous tools | `curl`, `wget`, `nc`, `bash`, `sh` |

### Integration Points

The SecurityValidator is called at:

| Operation | Check |
|-----------|-------|
| `PipelineService.AddStep()` | Tool name + config validation |
| `PipelineService.UpdateStep()` | Tool name + config validation |
| `PipelineService.queueStepForExecution()` | Pre-execution validation |
| `ScanService.CreateScan()` | Asset group tenant + scanner config |

## Tenant Isolation Fixes

### GetRun Handler

```go
// Before: No tenant check
run, err := h.service.GetRun(ctx, runID)

// After: Verify tenant ownership
run, err := h.service.GetRun(ctx, runID)
if run.TenantID() != tenantID {
    return ErrForbidden
}
```

### DeleteStep Handler

```go
// Before: No template tenant check
err := h.service.DeleteStep(ctx, templateID, stepID)

// After: Verify template belongs to tenant
template, err := h.service.GetTemplate(ctx, templateID)
if template.TenantID() != tenantID {
    return ErrForbidden
}
```

### Cross-Tenant Asset Group

```go
// CreateScan: verify asset group belongs to tenant
group, err := h.assetGroupService.Get(ctx, req.AssetGroupID)
if group.TenantID() != tenantID {
    return ErrForbidden
}
```

## Audit Logging

17 audit actions across 4 resource types:

### Pipeline Actions

| Action | Description |
|--------|-------------|
| `pipeline_template_created` | Template created |
| `pipeline_template_updated` | Template modified |
| `pipeline_template_deleted` | Template deleted |
| `pipeline_template_activated` | Template activated |
| `pipeline_template_deactivated` | Template deactivated |
| `pipeline_step_created` | Step added |
| `pipeline_step_updated` | Step modified |
| `pipeline_step_deleted` | Step removed |
| `pipeline_run_triggered` | Run started |
| `pipeline_run_completed` | Run finished |
| `pipeline_run_failed` | Run failed |
| `pipeline_run_cancelled` | Run cancelled |

### Scan Actions

| Action | Description |
|--------|-------------|
| `scan_config_created` | Scan config created |
| `scan_config_updated` | Scan config modified |
| `scan_config_deleted` | Scan config deleted |
| `scan_config_triggered` | Scan triggered |

### Security Actions

| Action | Description |
|--------|-------------|
| `security_validation_failed` | SecurityValidator rejected input |
| `cross_tenant_access` | Cross-tenant access attempt detected |

### Injection Pattern

Audit services are injected via functional options to maintain clean architecture:

```go
pipelineService := app.NewPipelineService(
    pipelineRepo,
    app.WithPipelineAuditService(auditService),
)

scanService := app.NewScanService(
    scanRepo,
    app.WithScanAuditService(auditService),
)
```

## Rate Limiting

Per-tenant rate limiting on trigger endpoints:

| Endpoint | Limit | Window | Scope |
|----------|-------|--------|-------|
| `POST /api/v1/pipelines/{id}/runs` | 30 | 1 minute | Per tenant |
| `POST /api/v1/scans/{id}/trigger` | 20 | 1 minute | Per tenant |
| `POST /api/v1/quick-scan` | 10 | 1 minute | Per tenant |

Response headers:
```http
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 15
X-RateLimit-Reset: 1706745600
```

Fallback to IP-based rate limiting when tenant ID is unavailable.

## Concurrent Run Limits

| Scope | Limit |
|-------|-------|
| Per pipeline template | 5 concurrent runs |
| Per scan config | 3 concurrent runs |
| Per tenant (total) | 50 concurrent runs |

## Input Sanitization

### Identifier Validation

`ValidateIdentifier()` and `ValidateIdentifiers()` enforce safe identifiers for step keys and tags:

- Alphanumeric characters only
- Dashes (`-`) and underscores (`_`) allowed
- No special characters, spaces, or shell metacharacters

### Transaction Boundaries

`DeleteTemplate()` wrapped in database transaction for atomic deletion:

```
BEGIN
  DELETE FROM pipeline_steps WHERE template_id = $1
  DELETE FROM pipeline_templates WHERE id = $1
COMMIT
-- Audit log AFTER commit (not inside transaction)
```

## Key Files

| File | Description |
|------|-------------|
| `api/internal/app/security_validator.go` | Central validation service |
| `api/internal/domain/audit/value_objects.go` | Audit action/resource type definitions |
| `api/internal/infra/http/middleware/ratelimit.go` | Rate limiting middleware |
| `api/internal/infra/http/routes/scanning.go` | Rate limit route registration |
| `api/internal/infra/postgres/pipeline_repository.go` | Transaction-based deletion |

## Related Documentation

- [Scan Orchestration](scan-orchestration.md) - Scan scheduling and pipeline progression
- [Tenant Isolation & RLS](tenant-isolation-security.md) - Multi-tenant data isolation
- [Rate Limiting](rate-limiting-improvements.md) - API rate limiting design
- [Scan Configurations](../features/scan-configs.md) - Scan setup and scheduling
