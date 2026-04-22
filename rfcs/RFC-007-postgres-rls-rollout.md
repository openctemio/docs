# RFC-007: Postgres Row-Level Security — shadow to enforced

- **Status**: Draft (ready for review)
- **Created**: 2026-04-22
- **Priority**: High (architectural clarity needed before enforcing in prod)
- **Owners**: Platform / DB team
- **Depends on**: migrations 000157 (top-20 RLS shadow), 000158 (remaining-tables RLS shadow), `internal/infra/http/middleware/rls_context.go`
- **Blocks**: any claim of defence-in-depth tenant isolation at the DB layer

---

## 1. Problem

Multi-tenant isolation in OpenCTEM today is **application-enforced only**: every repository method has to remember to add `WHERE tenant_id = $1`. CLAUDE.md calls this out as a cardinal rule and the test suite has `rls_tenant_isolation_test.go` pinning it, but a single missed filter in one handler silently leaks data across tenants. The audit Pass-2 review identified this as the single highest-probability failure mode for the platform.

Migrations 000157 and 000158 added Postgres Row-Level Security **policies** on every tenant-scoped table, but **did not enable RLS on any table**. Policies sit dormant until an operator flips `ALTER TABLE … ENABLE ROW LEVEL SECURITY` per table. We have the plumbing — `RLSContextMiddleware` sets `app.current_tenant_id`, `PlatformAdminRLSMiddleware` sets the admin bypass — but no production deployment is benefiting yet.

The codebase therefore pays the cost of RLS (policies in every migration, context middleware on every request path, a new transaction per request) **without the benefit**. Either we commit to enforcing, or we should remove the shadow policies. This RFC is the case for committing, with a concrete rollout plan that de-risks the flip.

---

## 2. Goals & non-goals

### Goals

1. Land RLS as a **second, independent** tenant-isolation layer. The application-level `WHERE tenant_id` stays — RLS is a backstop.
2. Define the exact conditions under which `ALTER TABLE … ENABLE ROW LEVEL SECURITY` is safe to run in production.
3. Catch query regressions (missing context setter, raw SQL bypass, cross-tenant JOIN) BEFORE they reach production by running the full test suite with RLS enabled in CI.
4. Document rollback.

### Non-goals

- Removing `WHERE tenant_id` filters from repositories. RLS is belt-and-braces, not replacement. Removing the app filter trades explicit intent for implicit DB magic — harder to review, harder to debug.
- Per-row policies beyond tenant scoping (e.g. scope-rule RLS). Out of scope for this RFC.
- Support for connection-pooling schemes that can't carry session variables. We assume pgbouncer in **session** mode or a direct connection.

---

## 3. Current state

### 3.1 What exists today

- `internal/infra/http/middleware/rls_context.go`:
  - `RLSContextMiddleware(db, log)` — begins a `sql.Tx`, runs `SET LOCAL app.current_tenant_id = $1`, stashes the tx in request context, commits at response end.
  - `PlatformAdminRLSMiddleware` — same pattern but with `SET LOCAL app.is_platform_admin = 'true'`.
- Migration 000157 — RLS policies on top-20 tables (largest by row count).
- Migration 000158 — RLS policies on the remaining ~90 tenant-scoped tables.
- Policy shape (every table):

  ```sql
  CREATE POLICY <table>_tenant_isolation ON <table>
    USING (
      tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
      OR current_setting('app.is_platform_admin', true) = 'true'
    )
  ```

- Tests: `tests/unit/rls_tenant_isolation_test.go` asserts app-level filters, not RLS. There is no test that exercises RLS enforcement.

### 3.2 What's missing

- `ALTER TABLE … ENABLE ROW LEVEL SECURITY` has not been run on any table in any environment.
- The RLS middleware is not mounted on the chi router anywhere — even though the code exists, no route group uses it today.
- Repository methods that accept a `*sql.DB` instead of a `*sql.Tx` bypass the RLS context entirely: the SET LOCAL is bound to the tx, so a sibling connection sees no `app.current_tenant_id`.
- No CI job runs the tests with `ALTER TABLE … FORCE ROW LEVEL SECURITY` (the mode that applies policies even to table owner / superuser).

### 3.3 Risks of enforcing naively today

1. **Silent empty result sets.** A query that runs outside the RLS transaction (e.g. through a `*sql.DB` accessor in a background job) would return zero rows instead of a tenant-scoped set, because `current_setting('app.current_tenant_id', true)` is NULL. Cascade: "why is my dashboard empty on Monday morning?" after enforcement ships Friday.
2. **Worker / controller blind spots.** Background controllers (see `internal/infra/controller/*.go`) don't go through HTTP middleware. If they touch tenant-scoped tables without establishing their own RLS context, RLS blocks them.
3. **JOINs that cross tenants by design.** There are a handful of admin paths that legitimately need cross-tenant views (e.g. platform metrics). `PlatformAdminRLSMiddleware` already exists for these, but every such path must be audited and routed correctly.
4. **pgbouncer transaction mode** (if used) breaks `SET LOCAL` because it can rebind the underlying connection between statements. Must confirm deployment pool mode.

---

## 4. Proposed rollout

### Phase 0 — CI coverage (prerequisite, 2 days)

Before ANY production table is enforced, the test suite must pass with RLS actually enforced on a throwaway database. This is the cheapest way to find every `*sql.DB`-without-context bug.

- Add `tests/integration/rls_enforcement_test.go`. For each tenant-scoped table, run `ALTER TABLE t FORCE ROW LEVEL SECURITY; ENABLE ROW LEVEL SECURITY`, then replay a representative tenant flow and assert the cross-tenant queries return zero rows.
- Add a `make test-with-rls` target that sets `POSTGRES_ENABLE_RLS=1` before running the full integration suite. The seed loader reads the env var and runs an `ENABLE ROW LEVEL SECURITY` pass on all tenant-scoped tables.
- Wire the new target into `.github/workflows/ci.yml` as a non-blocking matrix cell for 1 week, then make it required.

Acceptance: every integration test passes with RLS enforced on a staging DB. The tests that fail in the first pass form the punch list for Phase 1.

### Phase 1 — Mount the middleware on all tenant-scoped HTTP route groups (1 week)

- In `internal/infra/http/routes/routes.go`, add `middleware.RLSContextMiddleware(db, log)` to `buildTokenTenantMiddlewares` — same way CSRF was mounted in RFC-007's sister fix.
- For admin routes using `RequireAdmin()` / `RequireOwner()`, the regular RLS context still applies: platform-admin is about USER privilege, not about cross-tenant data reads. Only the handful of true platform-admin routes (e.g. `/platform/*`) should switch to `PlatformAdminRLSMiddleware`.
- For agent API-key routes (`/api/v1/agent/*`) and inbound webhook routes, derive tenant ID from the authenticated source, then set the same RLS context manually at the handler entry — reuse the existing helper (extract to a package-level function if not already shared).
- All newly-blocked HTTP flows should surface as 500s (not silent empty sets) because the tx never set the session var. The middleware handles that by returning early when tenant context is missing.

Acceptance: a grep for `*sql.DB` usage in `internal/app/*/service.go` produces zero hits for paths reachable via HTTP handlers. Every handler exercises the tx stored in context.

### Phase 2 — Flip RLS on in staging (2 weeks)

- New migration `000163_rls_enforce.up.sql`: loops the same tables from 000157/000158 and runs `ALTER TABLE t ENABLE ROW LEVEL SECURITY`.
- Deploy to staging. Run the full UAT suite plus 7 consecutive days of synthetic traffic. Watch for:
  - Prometheus metric `postgres_empty_result_set_ratio` (new, introduced in Phase 0) spikes → query running without RLS context.
  - Sentry events for 500s with PG error code `42501` (RLS policy denied) → missing admin bypass.
- Background controllers that need cross-tenant work (audit retention, data expiration, job recovery) must wrap DB access in a tx that sets `app.is_platform_admin = 'true'`. Document which controllers need this on a per-controller comment. The CTEM controllers (`priority_reclassify`, `risk_snapshot`, etc.) that operate per-tenant must loop tenants + set the tenant context per iteration.

Acceptance: zero `42501` errors in staging logs for 7 continuous days under real user activity.

### Phase 3 — Production flip (1 day)

- Schedule during low-traffic window.
- Run `000163_rls_enforce.up.sql` as a forward migration.
- Keep the `000163_rls_enforce.down.sql` ready. Rollback is `ALTER TABLE t DISABLE ROW LEVEL SECURITY` per table — policies remain defined and can be re-enabled later.
- On-call watches Sentry + the RLS metric; if `42501` error rate exceeds 0.1% of requests for more than 5 minutes, rollback and open a bug.

Acceptance: no rollback triggered; 24h clean.

### Phase 4 — `FORCE ROW LEVEL SECURITY` (stretch, 2 weeks after Phase 3)

`ENABLE ROW LEVEL SECURITY` applies policies to non-superuser / non-table-owner sessions. The application role typically is not the table owner, so this is enough. `FORCE ROW LEVEL SECURITY` additionally applies policies to the table owner — useful if some background job connects as the postgres superuser by mistake. This is a hardening step after Phase 3 is stable.

---

## 5. Test strategy

- `rls_tenant_isolation_test.go` — app-level filter asserts (exists).
- `rls_enforcement_test.go` — new; runs with RLS enforced. For each table:
  1. Begin tx A, set `app.current_tenant_id = tenantA`. Insert rows.
  2. Begin tx B, set `app.current_tenant_id = tenantB`. SELECT WHERE no tenant filter. Assert zero rows visible.
  3. Begin tx C, set `app.is_platform_admin = 'true'`. Assert rows from BOTH tenants visible.
- Per-controller tests that exercise the tx-establishing code path. Controllers without explicit tenant loops are flagged for refactor.

---

## 6. Rollback

Each phase has its own rollback:

- Phase 0 — CI cell is non-blocking for the first week; revert by flipping it back to non-required.
- Phase 1 — revert the middleware mount PR. All routes continue working because app-level filter is still present.
- Phase 2 — `ALTER TABLE t DISABLE ROW LEVEL SECURITY` per table, applied via the down migration. Policies survive for re-attempt.
- Phase 3 — same as Phase 2; rollback is a down migration that does NOT drop policies, only disables enforcement.

In no phase does rollback require touching the app code.

---

## 7. Trade-offs

| Approach | Pros | Cons |
|---|---|---|
| **Chosen:** shadow → enforce, keep app filters | Defence in depth. One bug = survivable. | Some overhead (transaction per request, one extra SQL per request to SET LOCAL). |
| Remove app filters, rely on RLS only | Less code. | Single-primitive failure; a JOIN that accidentally SELECT-FOR-SHAREs a sibling table with mismatched policy = silent leak. |
| Shadow forever | Zero risk of breaking prod. | Pay all the migration/review cost for no benefit. Audit reviewer correctly flags as theatre. |
| Skip RLS entirely, invest in app-layer lint | Avoids pgbouncer headaches. | Lint rules miss raw SQL strings; app-layer alone didn't prevent past CVEs like the `2026-04-20` finding_comments missing-tenant_id case. |

---

## 8. Open questions

1. **pgbouncer mode.** Which pool mode does the production deployment run? If `transaction` mode, `SET LOCAL` works because it's scoped to the tx. If `session` mode, the tx-scoped `SET LOCAL` also works. `pool_mode=statement` is incompatible and must be rejected. → Confirm with ops before Phase 2.
2. **Read replicas.** RLS policies work on replicas (they're in the DDL), but the `app.current_tenant_id` session var must be set per replica connection too. The current middleware only sees the primary. If repositories route reads to a replica pool, they need the same tx-with-SET dance. → Audit `pgRepositoryReadReplica` wiring if any.
3. **Platform admin scope.** Today `PlatformAdminRLSMiddleware` flips `app.is_platform_admin` globally for the request. Is that too broad? For safer ops, consider scoping per-query: wrap individual admin queries in `BEGIN; SET LOCAL app.is_platform_admin = 'true'; SELECT …; COMMIT`. Trade-off: more code, less blast radius.
4. **PG version.** RLS is solid since 9.5. We're on 17 (per README), so no concern.

---

## 9. Acceptance criteria (DoD)

- Phase 0 CI cell required, green for 2 weeks.
- Phase 1 `RLSContextMiddleware` mounted on every tenant-scoped route group.
- Phase 2 staging: 7 days zero `42501` errors, 0.1% of tenant flows tested manually.
- Phase 3 production migration run, 24h clean.
- `docs/architecture/rls-rollout.md` updated with the final playbook + runbook for on-call.
- `CLAUDE.md` mentions RLS is enforced — future contributors know they get a second layer, not that the first layer alone is sufficient.

---

## 10. Owner / timeline

| Phase | Owner | Target |
|---|---|---|
| Phase 0 CI | Platform team | 2 weeks from approval |
| Phase 1 middleware mount | Platform team | Sprint after Phase 0 |
| Phase 2 staging flip | Platform team + Ops | 2 weeks staging soak |
| Phase 3 prod flip | Ops + on-call escort | 1 day window |
| Phase 4 FORCE | Platform team | 2 weeks after Phase 3 |

---

**Last Updated**: 2026-04-22
