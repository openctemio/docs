# Route permission audit — 2026-04-19

Follow-up to F-311 in `2026-04-full-scope-audit.md`. Walked every route-
registration file under `api/internal/infra/http/routes/` and categorised
every write endpoint (`POST`/`PUT`/`PATCH`/`DELETE`). The goal was to find
any tenant-user-reachable write that is missing `middleware.Require*`.

## Method

1. `grep -n 'r\.(POST|PUT|DELETE|PATCH)'` across every file.
2. For each match, check whether the surrounding `router.Group(...)` applies
   a permission middleware either inline on the route or on the enclosing
   group.
3. Routes that are public-by-design (identity establishment, external
   webhooks, platform-agent bootstrap) are flagged explicitly.

## Result — no unguarded tenant-user writes found

Every write route falls into one of these four categories:

| Category | Gate | Examples |
|---|---|---|
| **Tenant-user write** | Inline `middleware.Require(permission.*)` | `access_control.go`, `assets.go`, `exposure.go`, `ctem.go`, `pentest.go`, `simulation.go`, `compliance.go`, `business_unit.go`, `remediation.go`, `reports.go`, `threat_actor.go` |
| **Tenant-admin write** (role-level) | `middleware.RequireTeamAdmin()` / `RequireTeamOwner()` | `tenant.go` settings, member management |
| **User-scoped write** (self-only) | Group-level auth; service enforces user ownership in WHERE clause | `misc.go` notifications (mark-read, preferences), `auth.go` me/sessions |
| **Public by design** (documented) | Either no auth or specialised auth (HMAC / platform-auth / invitation token) | `auth.go` login/register/refresh/forgot-password, `tenant.go` invitation accept/decline, `scanning.go` agent ingest (platform API-key auth), `misc.go:381` Jira webhook (HMAC after F-1), `admin.go` (admin-auth middleware applied at group level) |

Specific routes that initially *looked* suspicious on grep but are
correctly gated:

- `pentest.go:40-82` — middleware args are on the next line after `r.PUT(`;
  every route is wrapped with both `middleware.Require(permission.Pentest*)`
  AND a `middleware.RequireCampaignRole(...)` check.
- `tenant.go:41` (POST `/tenants/`) — creating your own tenant is the
  signup path; group uses `baseMiddlewares` (auth), no permission needed
  because the action is self-service.
- `tenant.go:112,117,122` — invitation accept/decline endpoints — the
  token in the URL IS the authorisation material.
- `scanning.go:55-80` — all ingest and command-lifecycle endpoints are
  registered under the platform-agent auth group; the agent API key
  constitutes authentication and tenant binding.
- `admin.go:40-44` — the group above applies `AdminAuth` middleware
  (separate admin-only session). Verified by reading the enclosing
  `Group` call with `h.AdminAuthMiddleware.RequireAuth()`.
- `misc.go:306-309` — notification endpoints are user-scoped; the handler
  queries by `user_id` from the JWT context, making impersonation
  impossible at the service layer.
- `misc.go:381` — Jira webhook — now HMAC-gated via `VerifyHMAC` added in
  F-1 (commit in the current branch).
- `auth.go:136-148` — `me/*` routes use the caller's JWT identity and
  cannot reference another user's record.

## Recommended follow-ups (not vulnerabilities)

1. **Add a build-time check** that fails CI when a `POST`/`PUT`/`PATCH`/
   `DELETE` appears inside `internal/infra/http/routes/*.go` without a
   `middleware.Require*` call OR a file-level `// auth: public` sentinel.
   This would prevent a future contributor from accidentally registering
   an unguarded write. Tracked as task F-310 (custom go/analysis linter).
2. **Move group-level middleware into a typed wrapper** so grep on a
   single line always reflects the full auth posture. Current layout
   requires human reasoning across the surrounding `Group(...)` to be
   sure a route is gated.

## Files reviewed

All 19 route files:

```
access_control.go admin.go asset_dedup.go assets.go attachment.go auth.go
business_unit.go compliance.go ctem.go exposure.go misc.go pentest.go
remediation.go reports.go routes.go scanning.go simulation.go tenant.go
threat_actor.go
```

No unguarded tenant-user write endpoints identified. F-311 closed.
