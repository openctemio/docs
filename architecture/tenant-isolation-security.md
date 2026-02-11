---
layout: default
title: Tenant Isolation & Row Level Security
parent: Architecture
nav_order: 10
---

# Tenant Isolation & Row Level Security

Multi-tenant data isolation using Defense in Depth strategy with SQL-based tenant scoping and PostgreSQL Row Level Security (RLS).

---

## Overview

OpenCTEM implements a **3-layer defense** approach for tenant data isolation:

| Layer | Mechanism | Protection Level |
|-------|-----------|------------------|
| **Layer 1** | SQL `WHERE tenant_id = ?` | Application-level (Primary) |
| **Layer 2** | PostgreSQL RLS Policies | Database-level (Safety Net) |
| **Layer 3** | Composite Indexes | Performance Optimization |

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DEFENSE IN DEPTH ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   HTTP Request                                                               │
│       │                                                                      │
│       ▼                                                                      │
│   ┌─────────────────┐                                                       │
│   │  JWT Auth       │  Extract tenant_id from token                         │
│   │  Middleware     │                                                        │
│   └────────┬────────┘                                                       │
│            │                                                                 │
│            ▼                                                                 │
│   ┌─────────────────┐                                                       │
│   │  Repository     │  Layer 1: WHERE tenant_id = $1 (Code-level)           │
│   │  (Go Code)      │  Compiler enforces tenantID parameter                 │
│   └────────┬────────┘                                                       │
│            │                                                                 │
│            ▼                                                                 │
│   ┌─────────────────┐                                                       │
│   │  PostgreSQL     │  Layer 2: RLS Policy (Database-level)                 │
│   │  RLS            │  Automatic filter even if code forgets                │
│   └────────┬────────┘                                                       │
│            │                                                                 │
│            ▼                                                                 │
│   ┌─────────────────┐                                                       │
│   │  Composite      │  Layer 3: (tenant_id, id) indexes                     │
│   │  Indexes        │  Optimal query performance                            │
│   └─────────────────┘                                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: SQL-Based Tenant Isolation

### Repository Interface Pattern

All repository methods that access tenant-scoped data **MUST** include `tenantID` as a parameter:

```go
// internal/domain/vulnerability/repository.go

type FindingRepository interface {
    // Security: tenantID is REQUIRED to prevent IDOR attacks
    GetByID(ctx context.Context, tenantID, id shared.ID) (*Finding, error)
    Delete(ctx context.Context, tenantID, id shared.ID) error
    ListByAssetID(ctx context.Context, tenantID, assetID shared.ID, opts FindingListOptions, page pagination.Pagination) (pagination.Result[*Finding], error)
    CountByAssetID(ctx context.Context, tenantID, assetID shared.ID) (int64, error)
    UpdateStatusBatch(ctx context.Context, tenantID shared.ID, ids []shared.ID, status FindingStatus, resolution string, resolvedBy *shared.ID) error
    BatchCountByAssetIDs(ctx context.Context, tenantID shared.ID, assetIDs []shared.ID) (map[shared.ID]int64, error)
    DeleteByAssetID(ctx context.Context, tenantID, assetID shared.ID) error
    // ... other methods
}
```

### Implementation Pattern

```go
// internal/infra/postgres/finding_repository.go

// GetByID retrieves a finding by ID.
// Security: Requires tenantID to prevent cross-tenant data access (IDOR prevention).
func (r *FindingRepository) GetByID(ctx context.Context, tenantID, id shared.ID) (*vulnerability.Finding, error) {
    // Security: ALWAYS include tenant_id in WHERE clause
    query := r.selectQuery() + " WHERE id = $1 AND tenant_id = $2"
    row := r.db.QueryRowContext(ctx, query, id.String(), tenantID.String())
    return r.scanFinding(row, vulnerability.FindingNotFoundError(id))
}

// Delete removes a finding by ID.
// Security: Requires tenantID to prevent cross-tenant deletion (IDOR prevention).
func (r *FindingRepository) Delete(ctx context.Context, tenantID, id shared.ID) error {
    // Security: Include tenant_id in WHERE clause to prevent cross-tenant deletion
    query := `DELETE FROM findings WHERE id = $1 AND tenant_id = $2`

    result, err := r.db.ExecContext(ctx, query, id.String(), tenantID.String())
    if err != nil {
        return fmt.Errorf("failed to delete finding: %w", err)
    }

    rowsAffected, _ := result.RowsAffected()
    if rowsAffected == 0 {
        return vulnerability.FindingNotFoundError(id)
    }
    return nil
}
```

### Handler Pattern

```go
// internal/infra/http/handler/vulnerability_handler.go

func (h *VulnerabilityHandler) GetFinding(w http.ResponseWriter, r *http.Request) {
    // Step 1: Extract tenant from authenticated context
    tenantID := middleware.MustGetTenantID(r.Context())

    findingID := r.PathValue("id")

    // Step 2: Pass tenantID to service (which passes to repository)
    finding, err := h.service.GetFinding(r.Context(), tenantID, findingID)
    if err != nil {
        h.handleError(w, err)
        return
    }

    // Response only contains data from the authenticated tenant
    json.NewEncoder(w).Encode(finding)
}
```

---

## Layer 2: PostgreSQL Row Level Security (RLS)

RLS provides database-level enforcement as a **safety net**, even if application code forgets to include `tenant_id` in queries.

### Database Schema

**Migration: `000137_add_row_level_security.up.sql`**

#### Helper Functions

```sql
-- Function: current_tenant_id()
-- Returns the current tenant ID from session variable.
-- Used by RLS policies to filter rows automatically.
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;  -- Block all access if not set (fail-safe)
END;
$$ LANGUAGE plpgsql STABLE;
```

| Function | Purpose | Return Type |
|----------|---------|-------------|
| `current_tenant_id()` | Get current tenant from session | `uuid` or `NULL` |
| `is_platform_admin()` | Check if session is platform admin | `boolean` |

#### Tenant Isolation Policies

```sql
-- Enable RLS on tenant-scoped tables
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE findings FORCE ROW LEVEL SECURITY;  -- Apply to table owner too

-- Create isolation policy
CREATE POLICY tenant_isolation_findings ON findings
    FOR ALL
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
```

**Tables with RLS Enabled:**

| Table | Policy Name | Filter Condition |
|-------|-------------|------------------|
| `findings` | `tenant_isolation_findings` | `tenant_id = current_tenant_id()` |
| `assets` | `tenant_isolation_assets` | `tenant_id = current_tenant_id()` |
| `scans` | `tenant_isolation_scans` | `tenant_id = current_tenant_id()` |
| `agents` | `tenant_isolation_agents` | `tenant_id = current_tenant_id()` |
| `exposure_events` | `tenant_isolation_exposures` | `tenant_id = current_tenant_id()` |
| `integrations` | `tenant_isolation_integrations` | `tenant_id = current_tenant_id()` |
| `suppression_rules` | `tenant_isolation_suppression_rules` | `tenant_id = current_tenant_id()` |
| `finding_comments` | `tenant_isolation_finding_comments` | `tenant_id = current_tenant_id()` |
| `finding_activities` | `tenant_isolation_finding_activities` | `tenant_id = current_tenant_id()` |
| `asset_branches` | `tenant_isolation_asset_branches` | `tenant_id = current_tenant_id()` |

### Platform Admin Bypass

Platform admins need cross-tenant access for:
- Customer support
- System migrations
- Analytics and reporting

```sql
-- Function: is_platform_admin()
-- Returns true if current session is a platform admin.
-- Used for RLS bypass in administrative operations.
CREATE OR REPLACE FUNCTION is_platform_admin() RETURNS boolean AS $$
BEGIN
    RETURN COALESCE(current_setting('app.is_platform_admin', true), 'false') = 'true';
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;  -- Fail-safe: deny admin access on error
END;
$$ LANGUAGE plpgsql STABLE;

-- Platform admin bypass policy (applied to all tenant-scoped tables)
CREATE POLICY platform_admin_bypass_findings ON findings
    FOR ALL
    USING (is_platform_admin())
    WITH CHECK (is_platform_admin());
```

**Platform Admin Bypass Policies:**

| Table | Policy Name | Bypass Condition |
|-------|-------------|------------------|
| `findings` | `platform_admin_bypass_findings` | `is_platform_admin() = true` |
| `assets` | `platform_admin_bypass_assets` | `is_platform_admin() = true` |
| `scans` | `platform_admin_bypass_scans` | `is_platform_admin() = true` |
| `agents` | `platform_admin_bypass_agents` | `is_platform_admin() = true` |
| `exposure_events` | `platform_admin_bypass_exposures` | `is_platform_admin() = true` |
| `integrations` | `platform_admin_bypass_integrations` | `is_platform_admin() = true` |
| `suppression_rules` | `platform_admin_bypass_suppression_rules` | `is_platform_admin() = true` |
| `finding_comments` | `platform_admin_bypass_finding_comments` | `is_platform_admin() = true` |
| `finding_activities` | `platform_admin_bypass_finding_activities` | `is_platform_admin() = true` |
| `asset_branches` | `platform_admin_bypass_asset_branches` | `is_platform_admin() = true` |

---

## Layer 3: Composite Indexes

**Migration: `000138_add_tenant_isolation_indexes.up.sql`**

Composite indexes optimize queries that filter by `tenant_id`:

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_findings_tenant_fingerprint` | `(tenant_id, fingerprint)` | Ingestion deduplication |
| `idx_findings_tenant_scan_id` | `(tenant_id, scan_id)` | Scan-based queries |
| `idx_findings_tenant_id_pk` | `(tenant_id, id)` | Single-row lookups |
| `idx_findings_tenant_created_at` | `(tenant_id, created_at DESC)` | List with sort |
| `idx_findings_tenant_tool_name` | `(tenant_id, tool_name)` | Auto-resolve queries |
| `idx_assets_tenant_id_pk` | `(tenant_id, id)` | Asset lookups |
| `idx_assets_tenant_name` | `(tenant_id, name)` | Asset search |
| `idx_scans_tenant_id_pk` | `(tenant_id, id)` | Scan lookups |
| `idx_agents_tenant_id_pk` | `(tenant_id, id)` | Agent lookups |
| `idx_finding_comments_tenant_finding` | `(tenant_id, finding_id)` | Comment queries |
| `idx_finding_activities_tenant_finding` | `(tenant_id, finding_id)` | Activity queries |

---

## Usage in Go Application

### Tenant API Middleware

```go
// middleware/rls_context.go

func TenantRLSMiddleware(db *sql.DB) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            tenantID := MustGetTenantID(r.Context())

            // Begin transaction and set tenant context for RLS
            tx, err := db.BeginTx(r.Context(), nil)
            if err != nil {
                http.Error(w, "Database error", 500)
                return
            }
            defer tx.Rollback()

            // Set session variable for RLS policy evaluation
            _, err = tx.ExecContext(r.Context(),
                "SET LOCAL app.current_tenant_id = $1", tenantID.String())
            if err != nil {
                http.Error(w, "Failed to set tenant context", 500)
                return
            }

            // Inject transaction into context
            ctx := context.WithValue(r.Context(), "tx", tx)
            next.ServeHTTP(w, r.WithContext(ctx))

            tx.Commit()
        })
    }
}
```

### Platform Admin Middleware

```go
// middleware/platform_admin.go

func PlatformAdminMiddleware(db *sql.DB) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Verify platform admin authentication
            admin := GetPlatformAdminFromContext(r.Context())
            if admin == nil {
                http.Error(w, "Unauthorized", 401)
                return
            }

            tx, err := db.BeginTx(r.Context(), nil)
            if err != nil {
                http.Error(w, "Database error", 500)
                return
            }
            defer tx.Rollback()

            // Enable RLS bypass for platform admin
            _, err = tx.ExecContext(r.Context(),
                "SET LOCAL app.is_platform_admin = 'true'")
            if err != nil {
                http.Error(w, "Failed to set admin context", 500)
                return
            }

            ctx := context.WithValue(r.Context(), "tx", tx)
            next.ServeHTTP(w, r.WithContext(ctx))

            tx.Commit()
        })
    }
}
```

---

## Security Considerations

### IDOR Prevention (OWASP A01:2021)

**Insecure Direct Object Reference** is prevented by:

1. **Compile-time enforcement**: Repository interfaces require `tenantID`
2. **SQL-level filtering**: All queries include `WHERE tenant_id = $1`
3. **RLS failsafe**: Even if code is buggy, database blocks cross-tenant access

```go
// ❌ VULNERABLE - No tenant check
func (r *Repo) GetByID(ctx context.Context, id shared.ID) (*Finding, error) {
    query := "SELECT * FROM findings WHERE id = $1"  // Can access ANY tenant's data!
}

// ✅ SECURE - Tenant isolation enforced
func (r *Repo) GetByID(ctx context.Context, tenantID, id shared.ID) (*Finding, error) {
    query := "SELECT * FROM findings WHERE id = $1 AND tenant_id = $2"
}
```

### Defense in Depth Benefits

| Scenario | Layer 1 (SQL) | Layer 2 (RLS) | Outcome |
|----------|---------------|---------------|---------|
| Normal request | ✅ Filters | ✅ Filters | Data isolated |
| Bug in code (missing tenant_id) | ❌ Fails | ✅ RLS blocks | Data isolated |
| SQL injection attempt | ❌ May bypass | ✅ RLS blocks | Data isolated |
| Direct DB access (compromised creds) | N/A | ✅ RLS blocks | Data isolated |
| Platform admin operation | N/A | ✅ Bypass allowed | Full access |

---

## Migration Reference

### Files

| Migration | Description |
|-----------|-------------|
| `000137_add_row_level_security.up.sql` | Enable RLS, create policies, admin bypass |
| `000137_add_row_level_security.down.sql` | Disable RLS, drop policies |
| `000138_add_tenant_isolation_indexes.up.sql` | Create composite indexes |
| `000138_add_tenant_isolation_indexes.down.sql` | Drop indexes |

### Rollback Warning

Rolling back RLS removes database-level protection. Only do this if:
- Application-level checks are 100% reliable
- You understand the security implications
- You have audited all queries for tenant isolation

---

## Comparison: SQL vs Code vs RLS

| Approach | Security | Performance | Complexity | Recommendation |
|----------|----------|-------------|------------|----------------|
| **SQL WHERE clause** | Good | Optimal | Low | ✅ Primary method |
| **Code-level check** | Vulnerable | Wasteful (fetch then filter) | High | ❌ Avoid |
| **PostgreSQL RLS** | Excellent | Good (slight overhead) | Medium | ✅ Safety net |
| **Hybrid (SQL + RLS)** | Excellent | Optimal | Medium | ✅✅ Best practice |

**Recommendation: Use Hybrid Approach (Defense in Depth)**

1. SQL `WHERE tenant_id = ?` for performance and explicitness
2. PostgreSQL RLS as safety net for defense in depth
3. Composite indexes for query optimization

---

## Testing Tenant Isolation

### Unit Test Pattern

```go
func TestFindingRepository_GetByID_TenantIsolation(t *testing.T) {
    // Setup
    tenant1 := shared.NewID()
    tenant2 := shared.NewID()
    finding := createFinding(tenant1)  // Belongs to tenant1

    // Test: tenant1 can access
    result, err := repo.GetByID(ctx, tenant1, finding.ID())
    assert.NoError(t, err)
    assert.Equal(t, finding.ID(), result.ID())

    // Test: tenant2 cannot access (isolation works)
    _, err = repo.GetByID(ctx, tenant2, finding.ID())
    assert.ErrorIs(t, err, vulnerability.ErrFindingNotFound)
}
```

### SQL Verification

```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('findings', 'assets', 'scans');

-- Verify policies exist
SELECT tablename, policyname, permissive, roles, qual
FROM pg_policies
WHERE schemaname = 'public';

-- Test tenant isolation (should return 0 rows without tenant context)
SET app.current_tenant_id = '';
SELECT COUNT(*) FROM findings;  -- Should be 0 or blocked

-- Test with tenant context
SET app.current_tenant_id = 'valid-tenant-uuid';
SELECT COUNT(*) FROM findings;  -- Returns only tenant's findings
```

---

## Production Database User Setup

{: .warning }
> **CRITICAL:** PostgreSQL superusers BYPASS RLS policies! The application database user MUST NOT be a superuser in production.

### Why This Matters

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  User Type      │  RLS Enforcement  │  Use For                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Superuser      │  ❌ BYPASSED      │  Migrations, admin tasks only         │
│  Non-superuser  │  ✅ ENFORCED      │  Application connections              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Setup Script

Run `scripts/setup_production_db_user.sql` to create the production application user:

```sql
-- Create application user (non-superuser, RLS enforced)
CREATE ROLE openctem_app LOGIN PASSWORD 'your-secure-password-here';

-- Grant database access
GRANT CONNECT ON DATABASE openctem TO openctem_app;
GRANT USAGE ON SCHEMA public TO openctem_app;

-- Grant table permissions (CRUD operations)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO openctem_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO openctem_app;

-- Ensure future tables get same permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO openctem_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE ON SEQUENCES TO openctem_app;
```

### Environment Configuration

```bash
# Development (superuser - for convenience, RLS NOT enforced)
DATABASE_URL=postgres://openctem:secret@localhost:5432/openctem

# Production (non-superuser - RLS ENFORCED)
DATABASE_URL=postgres://openctem_app:secure-password@db.example.com:5432/openctem
```

### Verification

Check that your application user is not a superuser:

```sql
SELECT rolname, rolsuper
FROM pg_roles
WHERE rolname IN ('openctem', 'openctem_app');

-- Expected output:
--  rolname     | rolsuper
-- -------------+----------
--  openctem     | t          -- Superuser (for migrations only)
--  openctem_app | f          -- Non-superuser (RLS enforced)
```

### Migration Strategy

1. **Development**: Use superuser for convenience (migrations, seed data)
2. **Staging/Production**: Use non-superuser for application connections
3. **Migrations**: Run with superuser, then reconnect as application user

---

## Integration Test Configuration

The RLS integration tests (`tests/integration/rls_tenant_isolation_test.go`) require two database connections:

| Environment Variable | Purpose | Example |
|---------------------|---------|---------|
| `DATABASE_URL` | Superuser (for test data setup) | `postgres://openctem:secret@localhost:5432/openctem` |
| `DATABASE_URL_RLS_TEST` | Non-superuser (for RLS tests) | `postgres://rls_test_user:test_password_123@localhost:5432/openctem` |

Run RLS tests:

```bash
DATABASE_URL="postgres://openctem:secret@localhost:5432/openctem?sslmode=disable" \
DATABASE_URL_RLS_TEST="postgres://rls_test_user:test_password_123@localhost:5432/openctem?sslmode=disable" \
go test -v ./tests/integration -run TestRLS
```

### Setup Test User

```sql
-- Run scripts/test_rls.sql or execute:
CREATE ROLE rls_test_user LOGIN PASSWORD 'test_password_123';
GRANT CONNECT ON DATABASE openctem TO rls_test_user;
GRANT USAGE ON SCHEMA public TO rls_test_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rls_test_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO rls_test_user;
```

---

## Related Documentation

- [Access Control Overview](access-control-flows-and-data.md) - 3-layer security model
- [Route-Level Protection](route-level-permission-protection.md) - RBAC middleware
- [Permission Realtime Sync](permission-realtime-sync.md) - Real-time permission updates
