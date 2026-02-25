---
layout: default
title: Migrations
parent: Database
nav_order: 2
---

# Database Migrations

We use `golang-migrate` to manage database schema changes. Migrations are stored in `api/migrations/`.

## Migration List

Total: **63 migrations** (000001–000063)

### Foundation (000001–000007)

| ID | Name | Description |
|----|------|-------------|
| 000001 | `extensions` | Enable uuid-ossp, pgcrypto extensions |
| 000002 | `users` | Users table, sessions, user preferences |
| 000003 | `tenants` | Tenants, tenant_members, invitations |
| 000004 | `modules` | Feature modules, tenant subscriptions, plans |
| 000005 | `permissions` | Permission definitions (68 permissions) |
| 000006 | `roles` | Roles, role_permissions, user_roles, sync triggers |
| 000007 | `groups` | User groups, group_members |

### Asset & Vulnerability (000008–000014)

| ID | Name | Description |
|----|------|-------------|
| 000008 | `assets` | Core assets table with JSONB properties |
| 000009 | `asset_extensions` | Asset branches, tags |
| 000010 | `components` | Software components/libraries |
| 000011 | `vulnerabilities` | CVE/vulnerability definitions |
| 000012 | `findings` | Findings table (polymorphic: vuln, secret, compliance, web3, misconfig) |
| 000013 | `exposures` | Exposure events, credential tracking |
| 000014 | `data_sources` | External data source connections |

### Tools & Scanning (000015–000018)

| ID | Name | Description |
|----|------|-------------|
| 000015 | `tools` | Tool registry, categories, custom categories |
| 000016 | `agents` | Scan agents, commands queue |
| 000017 | `scan_profiles` | Scan profile configuration |
| 000018 | `pipelines` | Pipeline templates, steps, runs, step_runs |

### Integrations & Notifications (000019–000021)

| ID | Name | Description |
|----|------|-------------|
| 000019 | `integrations` | External service integrations |
| 000020 | `notifications` | Notification outbox + events (transactional outbox pattern) |
| 000021 | `audit_logs` | Tenant-level audit logging |

### Security Features (000022–000029)

| ID | Name | Description |
|----|------|-------------|
| 000022 | `credentials` | Leaked credential management |
| 000023 | `suppression_rules` | Finding suppression rules |
| 000024 | `asset_groups` | Asset groups, memberships, recalculation |
| 000025 | `threat_intelligence` | Threat intelligence feeds |
| 000026 | `rule_management` | Scanner rule sets |
| 000027 | `scope_configuration` | Scope targets, exclusions, scan schedules |
| 000028 | `exposure_events` | Exposure event tracking |
| 000029 | `finding_data_flows` | SARIF codeFlows + scanner templates |

### Extended Features (000030–000044)

| ID | Name | Description |
|----|------|-------------|
| 000030 | `capabilities` | Capability registry + tool_capabilities junction |
| 000031 | `target_asset_type_mappings` | Smart filtering: target → asset type |
| 000032 | `scans` | Scan sessions, scan execution records |
| 000033 | `tool_executions` | Individual tool execution tracking |
| 000034 | `api_keys` | API key management |
| 000035 | `webhooks` | Webhook endpoint configuration |
| 000036 | `settings` | Tenant settings (general, security, API) |
| 000037 | `asset_types` | Asset type definitions |
| 000038 | `finding_sources` | Finding source tracking |
| 000039 | `asset_relationships` | Directed graph with 16 relationship types |
| 000040 | `workflows` | Workflow engine (workflows, nodes, edges, runs, node_runs) |
| 000041 | `permission_sets` | Permission sets, assignment rules |
| 000042 | `sla_ai_triage` | SLA policies, AI triage configuration |
| 000043 | `admin` | Platform admin users, audit logs, leases, bootstrap tokens, registrations |
| 000044 | `components_access_control` | Component licenses, group permissions |

### Performance & Security Hardening (000045–000063)

| ID | Name | Description |
|----|------|-------------|
| 000045 | `fix_notification_columns` | Notification column cleanup |
| 000046 | `jsonb_merge_functions` | JSONB deep merge PostgreSQL functions |
| 000047 | `recon_views` | 3 materialized views for reconnaissance |
| 000048 | `jsonb_property_indexes` | 9 GIN indexes for JSONB asset properties |
| 000049 | `tenant_isolation_indexes` | 12 composite indexes for tenant-scoped queries |
| 000050 | `security_hardening_constraints` | 13 CHECK constraints for enum validation |
| 000051 | `audit_protection_triggers` | 3 immutability triggers for audit tables |
| 000052 | `finding_specialized_indexes` | 16 indexes for common finding queries |
| 000053 | `scan_dependency_performance_indexes` | 14 indexes for scan/command performance |
| 000054 | `seed_spdx_licenses` | Seed SPDX license data |
| 000055 | `seed_additional_capabilities` | Seed additional capability definitions |
| 000056 | `drop_redundant_indexes` | Cleanup redundant/duplicate indexes |
| 000057 | `scan_session_status_expansion` | Additional scan session statuses |
| 000058 | `system_tenant` | System tenant for platform-level data |
| 000059 | `seed_system_scan_profiles` | Seed default scan profiles |
| 000060 | `schema_fixes` | Various schema corrections |
| 000061 | `preset_pipeline_templates` | Pre-built pipeline templates |
| 000062 | `uuid_v7` | Migrate to time-ordered UUID v7 |
| 000063 | `fix_cancelled_spelling` | Standardize "cancelled" spelling |

## PostgreSQL Functions Reference

### Queue Management Functions (Migration 000043)

| Function | Description |
|----------|-------------|
| `calculate_queue_priority(plan_slug, queued_at)` | Calculate job priority based on plan tier + wait time |
| `get_next_platform_job(agent_id, capabilities, tools)` | Atomically claim next job from queue |
| `update_queue_priorities()` | Recalculate priorities for all pending platform jobs |
| `recover_stuck_platform_jobs(threshold_minutes)` | Return stuck jobs to queue (max 3 retries) |

### Lease Management Functions (Migration 000043)

| Function | Description |
|----------|-------------|
| `renew_agent_lease(...)` | Atomically renew/acquire agent lease |
| `release_agent_lease(agent_id, holder_identity)` | Release lease (graceful shutdown) |
| `find_expired_agent_leases(grace_seconds)` | Find agents with expired leases |
| `is_lease_expired(agent_id, grace_seconds)` | Check if agent's lease has expired |

### JSONB Functions (Migration 000046)

| Function | Description |
|----------|-------------|
| `jsonb_deep_merge(jsonb, jsonb)` | Deep merge two JSONB values |

### Views

| View | Migration | Description |
|------|-----------|-------------|
| `platform_agent_status` | 000043 | Combined view of agents + lease status |
| `recon_domain_summary` | 000047 | Domain reconnaissance summary |
| `recon_ip_summary` | 000047 | IP address reconnaissance summary |
| `recon_service_summary` | 000047 | Service/port reconnaissance summary |

### Tenant Isolation Functions (Migration 000049)

| Function | Description |
|----------|-------------|
| `current_tenant_id()` | Returns current tenant UUID from session variable `app.current_tenant_id` |
| `is_platform_admin()` | Returns `true` if session variable `app.is_platform_admin` is set |

**Usage in Go middleware:**

```go
// For tenant API requests
tx.Exec("SET LOCAL app.current_tenant_id = $1", tenantID)

// For platform admin requests (bypasses RLS)
tx.Exec("SET LOCAL app.is_platform_admin = 'true'")
```

## Working with Migrations

### Create a new migration

```bash
make migrate-create name=add_new_table
```

This creates `000064_add_new_table.up.sql` and `000064_add_new_table.down.sql`.

### Apply migrations

```bash
# Apply all pending migrations
make migrate-up

# Rollback last migration
make migrate-down

# Check current version
make migrate-version
```

### Docker development

```bash
# Migrations auto-run on API container startup
docker compose up api

# Manual migration in Docker
docker compose exec api make migrate-up
```

### Fixing dirty migrations

If a migration fails halfway:

```bash
# 1. Fix the SQL issue in the migration file
# 2. Mark as not dirty
docker compose exec postgres psql -U openctem -d openctem \
  -c "UPDATE schema_migrations SET dirty = false;"
# 3. Restart the API
docker compose restart api
```

### Best Practices

1. **Never modify existing migrations** — create new ones instead
2. **Always write DOWN migrations** — for rollback capability
3. **Use `IF NOT EXISTS`** — for idempotent DDL statements
4. **Wrap FK constraints** in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
5. **Test migrations** on a fresh database before committing
6. **One concern per migration** — don't mix unrelated schema changes

See: [Schema Overview](./schema.md) for the full table reference.
