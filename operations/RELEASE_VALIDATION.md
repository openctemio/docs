---
layout: default
title: Release Validation Checklist
parent: Operations
nav_order: 14
---

# Release Validation Checklist

Production validation checklist for OpenCTEM MVP release (Phase 1.4). Complete all sections before tagging `v1.0.0-mvp`.

---

## Pre-Release Validation

### 1. Build Verification

- [ ] API: `make build` passes with no errors
- [ ] UI: `npm run build` passes (162 pages)
- [ ] UI: `npm run validate` passes (0 errors, 0 warnings)
- [ ] Docker images build: `docker compose build` (all services)
- [ ] Docker Compose starts cleanly: `docker compose up -d`
- [ ] All containers healthy: `docker compose ps` shows no restarts

### 2. Authentication Flows

**Local Auth:**

- [ ] Register new user with email/password
- [ ] Verify email confirmation flow
- [ ] Login with valid credentials reaches dashboard
- [ ] Login with invalid credentials shows error (no internal details leaked)
- [ ] Forgot password: submit email, receive reset link
- [ ] Reset password: use token link, set new password, login succeeds

**OAuth:**

- [ ] Google login: redirect, consent, callback, dashboard
- [ ] GitHub login: redirect, consent, callback, dashboard
- [ ] Microsoft login: redirect, consent, callback, dashboard

**Per-Tenant SSO:**

- [ ] Configure Entra ID identity provider in Settings > Tenant
- [ ] Login via `?org={slug}` parameter shows SSO providers
- [ ] SSO login: redirect to IdP, authenticate, callback, dashboard
- [ ] Verify allowed domain restriction works (rejected domains blocked)
- [ ] Auto-provisioning creates new user on first SSO login (if enabled)

**Session Management:**

- [ ] Logout clears tokens (no stale session)
- [ ] Token refresh works (session extends without re-login)
- [ ] Expired token redirects to login page
- [ ] CSRF token present and validated on state-changing requests

### 3. Authorization & Permissions

- [ ] **Owner** sees all features and menu items (126 permissions)
- [ ] **Admin** sees all except team:delete (125 permissions)
- [ ] **Member** sees only assigned permissions (64 permissions)
- [ ] **Viewer** has read-only access (42 permissions)
- [ ] Permission changes reflect in real-time (no re-login required)
- [ ] `PermissionGate` hides unauthorized UI elements
- [ ] API returns 403 for unauthorized requests (not 500)
- [ ] Module sidebar filtering: disabled modules hidden for non-admin roles

### 4. Tenant Isolation

- [ ] Create 2 test tenants with separate users
- [ ] Assets created in Tenant A are not visible in Tenant B
- [ ] Findings created in Tenant A are not visible in Tenant B
- [ ] Scans in Tenant A are not visible in Tenant B
- [ ] Settings (general, integrations) are tenant-scoped
- [ ] SSO/identity providers are tenant-scoped
- [ ] API keys are tenant-scoped
- [ ] Direct API requests with Tenant A token cannot access Tenant B data

### 5. Core Features

**Assets:**

- [ ] Create asset (all required fields)
- [ ] List assets with pagination
- [ ] Filter assets by type, risk score, group
- [ ] View asset detail page (relationships, findings count)
- [ ] Edit asset
- [ ] Delete asset

**Findings:**

- [ ] List findings with pagination
- [ ] Filter by severity, status, source
- [ ] View finding detail page
- [ ] Update finding status (open, in_progress, resolved, accepted)
- [ ] Severity distribution displays correctly on dashboard

**Scans:**

- [ ] Create scan profile
- [ ] Start scan and monitor progress
- [ ] View scan results
- [ ] Scan history displays correctly

**Dashboard:**

- [ ] Stats load correctly (asset count, finding count, risk scores)
- [ ] Charts render without errors
- [ ] Dashboard loads in under 3 seconds

**Settings:**

- [ ] General settings: update and save
- [ ] Team: invite member, change role, remove member
- [ ] Integrations: configure and test
- [ ] SSO: add/edit/delete identity providers

### 6. Infrastructure

**Health & Readiness:**

- [ ] `GET /health` returns 200 with service status
- [ ] `GET /metrics` returns Prometheus-formatted data
- [ ] PostgreSQL responds to `pg_isready`
- [ ] Redis responds to `PING`

**Backup & Restore:**

- [ ] Run `backup.sh` and verify backup file created
- [ ] Verify backup file is valid: `pg_restore --list <backup_file>`
- [ ] Restore backup to alternate database and verify data integrity
- [ ] Off-site upload works (S3/GCS/Azure if configured)

**Database:**

- [ ] All 81+ migrations applied: `SELECT version FROM schema_migrations`
- [ ] No dirty migrations: `SELECT dirty FROM schema_migrations` returns `false`
- [ ] Indexes exist: spot-check critical indexes on `findings`, `assets`, `tenant_members`
- [ ] Triggers active: `sync_tenant_member_to_user_roles` firing on role changes

### 7. Monitoring & Alerts

- [ ] Prometheus scraping API metrics (check targets page at `:9090/targets`)
- [ ] Grafana dashboards loading: API overview, Postgres performance, Notification pipeline
- [ ] Alert rules loaded in Prometheus (13 rules across 4 groups)
- [ ] Alertmanager reachable and routing configured
- [ ] Test alert fires and routes correctly (e.g., temporarily lower a threshold)

### 8. Performance

- [ ] API P95 latency < 500ms (check via Prometheus: `histogram_quantile(0.95, ...)`)
- [ ] API P99 latency < 2s
- [ ] Dashboard page loads in < 3 seconds
- [ ] List pages paginate correctly (no full-table scans)
- [ ] 10-50 concurrent users: no errors, no significant latency increase
- [ ] No N+1 query patterns in common flows (check slow query log)

---

## Release Day Checklist

### Preparation

- [ ] All pre-release validation sections above are complete
- [ ] All tests pass: API (`make test`) + UI (`npm test`)
- [ ] Release notes written and reviewed
- [ ] Environment variables documented for production
- [ ] Team notified of deployment window

### Deployment

- [ ] Tag release: `git tag v1.0.0-mvp`
- [ ] Build and push Docker images to registry
- [ ] Take database backup before deployment
- [ ] Deploy to production (Helm upgrade or Docker Compose)
- [ ] Run database migrations (verify no dirty state)
- [ ] Verify all pods/containers are healthy

### Verification

- [ ] Health check passes: `GET /health` returns 200
- [ ] Login works (local auth)
- [ ] OAuth flows work (Google, GitHub, Microsoft)
- [ ] Dashboard loads with data
- [ ] Create and view an asset (smoke test)
- [ ] Prometheus scraping new deployment
- [ ] Grafana dashboards show live data

### Communication

- [ ] Announce release to team/stakeholders
- [ ] Update status page (if applicable)

---

## Post-Release Monitoring

### First Hour

- [ ] Monitor error rates: `rate(http_requests_total{status=~"5.."}[5m])` stays below 1%
- [ ] Monitor latency: P95 stays below 500ms
- [ ] Check logs for 500 errors: `{app="openctem-api"} |= "error"`
- [ ] Verify auth flows in production (login, OAuth, SSO)
- [ ] Confirm backup cron is running on schedule

### First Day

- [ ] Review Grafana dashboards for anomalies
- [ ] Check database connection pool usage (should stay below 80%)
- [ ] Verify Redis memory usage is stable
- [ ] Review any user-reported issues
- [ ] Confirm no data leakage across tenants (spot-check)

### First Week

- [ ] Monitor production metrics daily
- [ ] Address any critical bugs immediately
- [ ] Collect user feedback
- [ ] Review error budget consumption
- [ ] Plan Phase 3 work (E2E tests, WAF, additional API tests) based on findings

---

## Rollback Procedure

If critical issues are found after deployment:

1. **Assess severity** -- Is it data loss, auth failure, or cosmetic?
2. **If critical** (auth broken, data leak, service down):
   ```bash
   # Revert to previous image tag
   helm rollback openctem 1 --namespace openctem
   # OR for Docker Compose:
   docker compose -f docker-compose.prod.yml down
   docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
   ```
3. **Restore database** if migrations caused issues:
   ```bash
   # Restore from pre-deployment backup
   pg_restore -h localhost -U openctem -d openctem_restore backup-pre-deploy.sql.gz
   ```
4. **Notify stakeholders** of rollback and ETA for fix
5. **Post-mortem** within 24 hours

---

## Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Engineering Lead | | | Pending |
| QA | | | Pending |
| Operations | | | Pending |

---

**Related Documents:**

- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT.md)
- [Monitoring & Observability](./MONITORING.md)
- [Backup & Restore](./backup-restore.md)
- [Troubleshooting](./troubleshooting.md)
- [MVP Release Plan](../_internal/rfcs/2026-03-10-mvp-release-plan.md)
