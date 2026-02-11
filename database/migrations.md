---
layout: default
title: Migrations
parent: Database
nav_order: 2
---

# Database Migrations

We use `golang-migrate` to manage database schema changes. Migrations are stored in `api/migrations/`.

## Migration List

Below is a summary of key migrations applied to the system:

| ID | Name | Description |
|----|------|-------------|
| 001 | `init_extensions` | Enable UUID-ossp, pgcrypto |
| 002 | `users_auth` | Create users table |
| 003 | `tenants` | Multi-tenancy support |
| 004 | `assets` | Asset inventory table |
| 007 | `findings` | Vulnerability findings |
| 045 | `rename_workers_to_agents` | Terminology update |
| 046 | `access_control_foundation` | RBAC tables |
| 047 | `roles_in_database` | Dynamic role management |
| 080 | `platform_agents_queue` | Platform job queue + priority functions |
| 081 | `bootstrap_tokens` | Agent self-registration tokens |
| 082 | `admin_users` | Platform admin users + audit logs |
| 083 | `agent_leases` | K8s-style lease management + views |
| 084 | `fix_recover_jobs` | Fix `recover_stuck_platform_jobs` function |
| 085 | `security_hardening` | bcrypt support + account lockout fields |
| 095 | `capabilities` | Capabilities registry table + tool_capabilities junction |
| 096 | `sync_tools_capabilities` | Sync tools.capabilities from junction table |
| 137 | `add_row_level_security` | PostgreSQL RLS for tenant isolation (Defense in Depth) |
| 138 | `add_tenant_isolation_indexes` | Composite indexes for tenant-scoped query performance |

## PostgreSQL Functions Reference

The platform agent system uses PostgreSQL functions for atomic operations. See detailed documentation in `the database documentation`.

### Queue Management Functions (Migration 000080)

| Function | Description |
|----------|-------------|
| `calculate_queue_priority(plan_slug, queued_at)` | Calculate job priority based on plan tier + wait time |
| `get_next_platform_job(agent_id, capabilities, tools)` | Atomically claim next job from queue |
| `update_queue_priorities()` | Recalculate priorities for all pending platform jobs |
| `recover_stuck_platform_jobs(threshold_minutes)` | Return stuck jobs to queue (max 3 retries) |

### Lease Management Functions (Migration 000083)

| Function | Description |
|----------|-------------|
| `renew_agent_lease(...)` | Atomically renew/acquire agent lease |
| `release_agent_lease(agent_id, holder_identity)` | Release lease (graceful shutdown) |
| `find_expired_agent_leases(grace_seconds)` | Find agents with expired leases |
| `is_lease_expired(agent_id, grace_seconds)` | Check if agent's lease has expired |

### Views (Migration 000083)

| View | Description |
|------|-------------|
| `platform_agent_status` | Combined view of agents + lease status for monitoring |

### Tenant Isolation Functions (Migration 000137)

| Function | Description |
|----------|-------------|
| `current_tenant_id()` | Returns current tenant UUID from session variable `app.current_tenant_id` |
| `is_platform_admin()` | Returns `true` if session variable `app.is_platform_admin` is set to `'true'` |

**Usage in Go middleware:**

```go
// For tenant API requests
tx.Exec("SET LOCAL app.current_tenant_id = $1", tenantID)

// For platform admin requests (bypasses RLS)
tx.Exec("SET LOCAL app.is_platform_admin = 'true'")
```

### RLS Policies (Migration 000137)

| Policy Type | Tables | Condition |
|-------------|--------|-----------|
| `tenant_isolation_*` | All tenant-scoped tables | `tenant_id = current_tenant_id()` |
| `platform_admin_bypass_*` | All tenant-scoped tables | `is_platform_admin() = true` |

**Tenant-scoped tables with RLS:**
- `findings`, `assets`, `scans`, `agents`
- `exposure_events`, `integrations`, `suppression_rules`
- `finding_comments`, `finding_activities`, `asset_branches`

See [Tenant Isolation & RLS](../architecture/tenant-isolation-security.md) for complete documentation.

## Working with Migrations

### Create a new migration

```bash
make migrate-create name=add_new_table
```

### Apply migrations

```bash
# Apply all pending migrations (up)
make migrate-up

# Rollback last migration (down)
make migrate-down
```
