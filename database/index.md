---
layout: default
title: Database
has_children: true
nav_order: 4
---

# Database

The platform uses **PostgreSQL 17** as the primary relational database and **Redis 7** for caching and queues.

## Schema Design

The database schema is organized into logical domains, supporting the clean architecture of the backend services.

- **[Schema Overview](./schema.md)**: Detailed breakdown of tables and relationships.
- **[Migrations](./migrations.md)**: Database version control and migration history.
- **[Finding Repository Queries](./finding-queries.md)**: SQL queries and performance optimization for ingestion.

## Connection

| Environment | Host | Port | Database | User |
|-------------|------|------|----------|------|
| Development | `localhost` | `5432` | .openctem` | `postgres` |
| Docker | `postgres` | `5432` | .openctem` | `postgres` |
| Production | `<managed-db-host>` | `5432` | .openctem` | `<app-user>` |

## Key Concepts

- **Tenancy**: Multi-tenancy with **Defense in Depth** isolation:
  - SQL `WHERE tenant_id = ?` in all queries (application layer)
  - PostgreSQL Row Level Security (RLS) policies (database layer)
  - Composite indexes for performance optimization
  - See [Tenant Isolation & RLS](../architecture/tenant-isolation-security.md) for details.
- **Soft Deletes**: Used for `assets` and `findings` to preserve history.
- **UUIDs**: Primary keys are random UUID v4.
- **Audit**: Changes to critical entities are tracked in `audit_logs`.

## Row Level Security (RLS)

PostgreSQL RLS provides database-level tenant isolation as a safety net:

| Function | Purpose |
|----------|---------|
| `current_tenant_id()` | Returns tenant UUID from session `app.current_tenant_id` |
| `is_platform_admin()` | Returns `true` if session is platform admin |

**Tables with RLS enabled:** `findings`, `assets`, `scans`, `agents`, `exposure_events`, `integrations`, `suppression_rules`, `finding_comments`, `finding_activities`, `asset_branches`

See [Migrations](./migrations.md) for implementation details.
