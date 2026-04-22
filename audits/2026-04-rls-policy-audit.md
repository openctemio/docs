# PostgreSQL RLS policy audit — 2026-04-19

Follow-up to F-312 in `2026-04-full-scope-audit.md`. Intended to cross-check
that every tenant-scoped table has a matching `CREATE POLICY` so that the
application-layer `WHERE tenant_id = $1` filter has a DB-level defence in
depth.

## Finding (revised)

**The previous audit report overstated RLS coverage. It does not exist.**

### Evidence

1. `grep -l "ENABLE ROW LEVEL SECURITY\|CREATE POLICY"
   api/migrations/*.up.sql` returns **zero files**.
2. `grep "set_config.*app\.tenant\|current_setting.*tenant"
   api/migrations/*.up.sql` returns **zero files** — no policy would
   have a `USING (...)` clause to reference the session variable.
3. `api/internal/infra/http/middleware/rls_context.go` defines
   `RLSContextMiddleware` and `PlatformAdminRLSMiddleware` that run
   `SET LOCAL app.current_tenant_id = $1` / `SET LOCAL app.is_platform_admin = 'true'`
   inside a transaction — but `grep -rn RLSContextMiddleware
   internal/infra/http/routes/` shows **zero mount sites**.
4. Consequence: the session variable is never set by any real request
   path, and no policy would consume it anyway.

### Threat implication

Multi-tenant data isolation depends **entirely** on the application layer's
`WHERE tenant_id = $1` filters. A single forgotten filter in any repository
method is a direct cross-tenant IDOR — there is no DB safety net.

This elevates the importance of:

- **F-309** — unscoped `GetByID` audit (now High priority, not Medium).
- **F-310** — custom go/analysis linter that flags unscoped `GetByID` on
  tenant-scoped tables (prevents regressions).
- **F-311** — route permission audit (already completed: no
  user-facing gap).

## Recommended remediation path

Implementing real RLS is a multi-stage migration:

1. **New migration `000154_rls_enable.up.sql`:**

    ```sql
    -- For every tenant-scoped table:
    ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE findings FORCE ROW LEVEL SECURITY;

    CREATE POLICY findings_tenant_isolation ON findings
      USING (tenant_id::text = current_setting('app.current_tenant_id', true)
             OR current_setting('app.is_platform_admin', true) = 'true');
    ```

    Repeat for each of the ~82 tenant-scoped tables.

2. **Mount `RLSContextMiddleware` globally** on every tenant route group
   (the existing middleware ALREADY implements the necessary `SET LOCAL`
   logic, it just isn't wired).

3. **Refactor repositories to use the RLS transaction from context** via
   `middleware.GetRLSTx(ctx)` rather than `r.db.QueryContext(ctx, ...)`
   directly. The existing helper is already exported.

4. **Integration tests** that spin up a fresh PostgreSQL, create two
   tenants, insert a row into each, and verify that a request with
   tenant-A context cannot read tenant-B's row **even if the
   application-layer filter is removed**.

## Interim mitigations already shipped

Until RLS lands:

- F-2 (audit log resource reads), F-3 (audit log retention), F-4 (tool
  execution GetByID), F-5 (agent GetByID) close the specific unscoped
  reads the original audit flagged.
- F-309 enumerates every remaining `GetByID(ctx, id)` in the repo layer
  and categorises by exposure risk.
- F-310 (planned) will enforce the pattern via CI lint.

## Tables requiring RLS policies

Extracted from migrations — every table whose `CREATE TABLE` contains a
`tenant_id UUID NOT NULL` column. Count: approximately **82 tables**
(raw grep count; should be verified against `pg_class` once the migration
is drafted).

The sheer number is why this was deferred to a dedicated workstream.
Executing it inside this audit-closure session would be reckless without
a staging rehearsal.

## Conclusion

RLS is currently **not protecting anything**. The claim of "defense in
depth" in the top-level audit was based on the presence of middleware
code, not on actual policy enforcement. Corrected here, and tracked
separately for a dedicated migration PR.

F-312 report delivered. **RLS implementation is NOT landed in this
session — it is a multi-week project.**
