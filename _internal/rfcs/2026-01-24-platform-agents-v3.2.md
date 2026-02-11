# Implementation Plan: Platform Agents Architecture v3.2

## Overview

Implementation of the Platform Agents feature for OpenCTEM SaaS platform. Platform agents are OpenCTEM-managed, shared agents that can be used by any tenant (with access control), providing a shared scanning infrastructure for tenants who don't want to manage their own agents.

## Problem

OpenCTEM needs to support:
1. **Platform Agents**: Shared agents managed by OpenCTEM that can be used by multiple tenants
2. **Job Queue Management**: Fair queuing with weighted priorities to ensure tenants get fair access
3. **Bootstrap Tokens**: kubeadm-style tokens for agent self-registration
4. **Load Balancing**: Distribute jobs across agents based on load and capabilities

## Key Design Decisions

- **SystemTenantID**: `00000000-0000-0000-0000-000000000001` - Special tenant that "owns" all platform agents
- **FOR UPDATE SKIP LOCKED**: Used for atomic job claiming to prevent race conditions
- **Auth Tokens per Job**: Defense-in-depth authentication for job status updates
- **Redis for Ephemeral State**: Heartbeats, online tracking, queue stats in Redis
- **PostgreSQL for Durable State**: Job data, agent configuration, bootstrap tokens in Postgres

## Implementation Tasks

- [x] **Phase 1: Database Schema** - Completed 2026-01-24
  - Migration 000080: Added platform agent fields to agents table
  - Migration 000081: Created bootstrap_tokens and agent_registrations tables

- [x] **Phase 2: Domain Layer** - Completed 2026-01-24
  - `internal/domain/agent/entity.go` - PlatformAgentStats, selection types
  - `internal/domain/agent/bootstrap_token.go` - Bootstrap token entity
  - `internal/domain/agent/errors.go` - Platform agent errors
  - `internal/domain/agent/repository.go` - Platform agent repository interface
  - `internal/domain/command/entity.go` - Platform job fields

- [x] **Phase 3: Infrastructure Layer** - Completed 2026-01-24
  - `internal/infra/postgres/agent_repository.go` - Platform agent DB methods
  - `internal/infra/postgres/command_repository.go` - Queue operations
  - `internal/infra/postgres/bootstrap_token_repository.go` - Bootstrap token repo
  - `internal/infra/redis/agent_state.go` - Redis agent state store

- [x] **Phase 4: Application Services** - Completed 2026-01-24
  - `internal/app/platform_agent_service.go` - Platform agent management
  - `internal/app/platform_job_service.go` - Job queue management

- [x] **Phase 5: HTTP Handlers** - Completed 2026-01-24
  - `internal/infra/http/handler/platform_agent_handler.go` - Admin endpoints for platform agents
  - `internal/infra/http/handler/platform_job_handler.go` - Tenant job submission endpoints

- [x] **Phase 6: Background Workers** - Completed 2026-01-24
  - `internal/infra/jobs/platform_queue_worker.go` - Queue maintenance worker
  - `internal/infra/jobs/platform_agent_health_checker.go` - Platform agent health monitoring

- [x] **Phase 7: Route Registration** - Completed 2026-01-25
  - Refactored routes into `routes/` subfolder for better organization
  - Created `routes/admin.go` - Platform admin routes (isolated from tenant routes)
  - Created `routes/platform.go` - Tenant & agent-facing platform routes
  - Added authentication middleware (RequirePlatformAdmin, API key auth)
  - All routes registered in `routes/routes.go`

- [x] **Phase 7.5: Migration Fixes** - Completed 2026-01-25
  - Fixed migration 000083 view column reference (`a.agent_type` → `a.type as agent_type`)
  - Created migration 000084 to fix `recover_stuck_platform_jobs` function (removed `updated_at` reference)
  - Fixed table name references in `bootstrap_token_repository.go`:
    - `bootstrap_tokens` → `platform_agent_bootstrap_tokens`
    - `agent_registrations` → `platform_agent_registrations`
  - Fixed `RecoverStuckJobs` function signature in `command_repository.go` (2 args → 1 arg)
  - Documented PostgreSQL functions in `docs/architecture/database-notes.md`
  - Added DB function conventions to `docs/development/migrations.md`

- [x] **Phase 8: Security Hardening** - Completed 2026-01-25
  - Added scanner name whitelist validation (prevents command injection)
  - Added job type whitelist validation
  - Added path traversal prevention (`../` blocked)
  - Added auth token lifetime = job_timeout + 10min (not 24h)
  - Added payload size limit (1MB) and timeout cap (2h)
  - Added security event type constants for monitoring
  - Added Prometheus metrics for security events
  - Added auth failure rate limiter (5 failures → 15min ban)
  - Added security validation unit tests

- [x] **Phase 9: Admin CLI (kubectl-style)** - Completed 2026-01-26
  - `cmd/openctem-admin/main.go` - CLI entry point
  - `cmd/openctem-admin/cmd/root.go` - Root command with global flags
  - `cmd/openctem-admin/cmd/config.go` - Config/context management
  - `cmd/openctem-admin/cmd/client.go` - API client for admin endpoints
  - `cmd/openctem-admin/cmd/get.go` - Get agents/jobs/tokens/admins
  - `cmd/openctem-admin/cmd/describe.go` - Describe agent/job/token
  - `cmd/openctem-admin/cmd/create.go` - Create agent/token/admin
  - `cmd/openctem-admin/cmd/delete.go` - Delete agent/token
  - `cmd/openctem-admin/cmd/operations.go` - drain/uncordon/revoke/cluster-info
  - `cmd/bootstrap-admin/main.go` - Bootstrap first admin user during deployment

- [ ] **Phase 10: Integration Testing** - Pending
  - Integration tests for handlers
  - E2E tests for job flow
  - Platform agent registration flow
  - Job submission and claiming flow

## Files Created/Modified

### Created
- `api/migrations/000080_add_platform_agents.up.sql`
- `api/migrations/000080_add_platform_agents.down.sql`
- `api/migrations/000081_add_bootstrap_tokens.up.sql`
- `api/migrations/000081_add_bootstrap_tokens.down.sql`
- `api/migrations/000082_admin_users.up.sql`
- `api/migrations/000082_admin_users.down.sql`
- `api/migrations/000083_agent_leases.up.sql`
- `api/migrations/000083_agent_leases.down.sql`
- `api/migrations/000084_fix_recover_stuck_jobs.up.sql`
- `api/migrations/000084_fix_recover_stuck_jobs.down.sql`
- `api/internal/domain/agent/bootstrap_token.go`
- `api/internal/domain/admin/entity.go` - AdminUser domain entity
- `api/internal/domain/admin/audit.go` - Audit log entity
- `api/internal/domain/lease/entity.go` - Lease entity for K8s-style health
- `api/internal/infra/postgres/bootstrap_token_repository.go`
- `api/internal/infra/postgres/admin_repository.go`
- `api/internal/infra/postgres/lease_repository.go`
- `api/internal/infra/redis/agent_state.go`
- `api/internal/app/platform_agent_service.go`
- `api/internal/app/platform_job_service.go`
- `api/internal/app/lease_service.go` - K8s-style lease management
- `api/internal/infra/http/handler/platform_agent_handler.go`
- `api/internal/infra/http/handler/platform_job_handler.go`
- `api/internal/infra/http/handler/platform_handler.go` - Lease & poll endpoints
- `api/internal/infra/http/handler/platform_register_handler.go` - Bootstrap registration
- `api/internal/infra/http/middleware/platform_auth.go` - Platform agent auth
- `api/internal/infra/http/middleware/admin_auth.go` - Admin API key auth
- `api/internal/infra/http/middleware/admin_audit.go` - Audit logging
- `api/internal/infra/jobs/platform_queue_worker.go`
- `api/internal/infra/jobs/platform_agent_health_checker.go`
- `api/internal/infra/controller/` - K8s-style controller package:
  - `controller.go` - Controller interface & Manager
  - `agent_health_controller.go` - AgentHealthController
  - `job_recovery_controller.go` - JobRecoveryController
  - `queue_priority_controller.go` - QueuePriorityController
  - `token_cleanup_controller.go` - TokenCleanupController
  - `audit_retention_controller.go` - AuditRetentionController
  - `metrics.go` - Prometheus metrics for controllers
- `api/internal/infra/http/routes/` - New routes subfolder with:
  - `routes.go` - Main entry point, Handlers struct, Register()
  - `admin.go` - Platform admin routes (isolated from tenant routes)
  - `auth.go` - Authentication routes
  - `tenant.go` - Tenant management routes
  - `assets.go` - Asset, Component, AssetGroup routes
  - `scanning.go` - Agent, Command, Scan, Pipeline, Tool routes
  - `exposure.go` - Exposure, ThreatIntel, Credential routes
  - `access_control.go` - Group, Role, Permission routes
  - `platform.go` - Platform agent/job routes (tenant & agent facing)
  - `misc.go` - Health, Docs, Dashboard, Audit, SLA routes
- `api/internal/infra/http/middleware/ratelimit.go` - Auth failure rate limiter
- `api/internal/infra/http/middleware/metrics.go` - Security Prometheus metrics
- `api/internal/infra/redis/job_notifier.go` - Redis Pub/Sub for job notifications
- `api/tests/unit/security_validation_test.go` - Security validation tests
- `api/cmd/openctem-admin/` - Admin CLI (kubectl-style):
  - `main.go` - CLI entry point
  - `cmd/root.go` - Root command, global flags, version
  - `cmd/config.go` - Config/context management (~/.openctem/config.yaml)
  - `cmd/client.go` - HTTP client for admin API
  - `cmd/get.go` - Get commands for agents/jobs/tokens/admins
  - `cmd/describe.go` - Describe commands for detailed view
  - `cmd/create.go` - Create commands for agent/token/admin
  - `cmd/delete.go` - Delete commands with confirmation
  - `cmd/operations.go` - drain/uncordon/revoke/cluster-info

### Modified
- `api/internal/domain/agent/entity.go` - Added PlatformAgentStats, selection types
- `api/internal/domain/agent/errors.go` - Added platform agent errors
- `api/internal/domain/agent/repository.go` - Added platform agent interfaces
- `api/internal/domain/command/entity.go` - Added platform job fields
- `api/internal/domain/command/repository.go` - Added queue methods interface
- `api/internal/infra/postgres/agent_repository.go` - Added platform agent methods
- `api/internal/infra/postgres/command_repository.go` - Added queue operations
- `api/internal/app/platform_job_service.go` - Added security validation (scanner whitelist, job type whitelist, path traversal prevention)
- `api/pkg/apierror/apierror.go` - Added TooManyRequests error
- `CLAUDE.MD` - Added Platform Job Security documentation

## API Endpoints

### Admin Endpoints (requires admin role)
- `GET    /api/v1/admin/platform-agents` - List platform agents
- `GET    /api/v1/admin/platform-agents/stats` - Get agent statistics
- `GET    /api/v1/admin/platform-agents/{id}` - Get platform agent
- `POST   /api/v1/admin/platform-agents` - Create platform agent
- `POST   /api/v1/admin/platform-agents/{id}/disable` - Disable agent
- `POST   /api/v1/admin/platform-agents/{id}/enable` - Enable agent
- `DELETE /api/v1/admin/platform-agents/{id}` - Delete agent
- `GET    /api/v1/admin/bootstrap-tokens` - List bootstrap tokens
- `POST   /api/v1/admin/bootstrap-tokens` - Create bootstrap token
- `POST   /api/v1/admin/bootstrap-tokens/{id}/revoke` - Revoke token
- `GET    /api/v1/admin/platform-jobs/stats` - Queue statistics

### Public Endpoints (no auth required)
- `POST   /api/v1/platform-agents/register` - Agent self-registration

### Tenant Endpoints (requires tenant auth)
- `POST   /api/v1/platform-jobs` - Submit job
- `GET    /api/v1/platform-jobs` - List jobs
- `GET    /api/v1/platform-jobs/{id}` - Get job status
- `POST   /api/v1/platform-jobs/{id}/cancel` - Cancel job

### Platform Agent Endpoints (requires agent API key + platform agent)
- `POST   /api/v1/platform-agent/heartbeat` - Record heartbeat
- `POST   /api/v1/platform-agent/jobs/claim` - Claim next job
- `POST   /api/v1/platform-agent/jobs/{id}/status` - Update job status

## Verification

- [x] All files compile without errors (`go build ./...`) - Completed 2026-01-25
- [x] Unit tests pass for new services - Completed 2026-01-25
- [ ] Integration tests pass for handlers
- [x] Database migrations apply cleanly - Completed 2026-01-25 (migrated to version 84)
- [ ] Platform agent registration works with bootstrap token
- [ ] Job submission and claiming flow works
- [ ] Queue priority aging works correctly
- [ ] Stuck job recovery works
- [x] K8s-style controller reconciliation loop works - Completed 2026-01-25
- [ ] Agent health monitoring works
- [x] Security validation tests pass - Completed 2026-01-25

## Notes

- The implementation uses the existing agent infrastructure where possible
- Platform agents are distinguished by `is_platform_agent = true` flag
- The `SystemTenantID` is a well-known UUID that cannot be used by regular tenants
- Bootstrap tokens use kubeadm-style format: `xxxxxx.yyyyyyyyyyyyyyyy`
