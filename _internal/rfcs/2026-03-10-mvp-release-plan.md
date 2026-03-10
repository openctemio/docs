---
title: MVP Release Plan
status: planned
author: Platform Team
date: 2026-03-10
priority: P0
---

# MVP Release Plan

## Summary

OpenCTEM CTEM platform is at 8.5/10 maturity. This plan covers the remaining work items needed before the first MVP release, organized by priority and estimated effort.

---

## Current State Assessment

| Area | Score | Status |
|------|-------|--------|
| Backend API | 9/10 | 50+ handlers, 21 middleware, 81+ migrations, 94 test files |
| Frontend UI | 9/10 | 160 pages, 0 placeholders, build passes, TypeScript strict |
| Security | 9/10 | Auth (Local+OIDC+OAuth), CSRF, CORS, rate limiting, AES-256-GCM |
| Infrastructure | 8/10 | Docker multi-stage, Helm chart, backup scripts, monitoring |
| CI/CD | 9/10 | Workflows for API, UI, SDK, Agent, Docs |
| Observability | 7/10 | Prometheus + OpenTelemetry, basic Grafana dashboards |
| Documentation | 7/10 | Dev docs good, ops runbook missing |

### What's Complete

- All 160 UI pages implemented (0 placeholders)
- Full RBAC with 150+ permissions, real-time sync
- Multi-tenant isolation (RLS, middleware, tenant context)
- Auth: Local + OIDC + OAuth (Google, GitHub, Microsoft)
- Database: 81+ migrations, 40+ indexes, triggers
- Docker: multi-stage builds, non-root users, health checks
- Kubernetes: Helm chart with HPA, PDB, Ingress + TLS
- Backup: pg_dump rotation, WAL archiving, restore scripts
- SDK-Go: 5 scanner adapters (Trivy, Semgrep, Nuclei, Gitleaks, SARIF)
- CI/CD: GitHub Actions for API, UI, SDK, Agent
- Monitoring: Prometheus metrics, OpenTelemetry tracing, Grafana dashboards

---

## Phase 1: P0 — Must Complete Before Release

**Estimated total: 3-4 days**

### 1.1 Forgot Password Page (UI)

**Effort: 0.5 day**

The auth flow is missing a forgot-password page. Users who forget their password cannot recover access.

**Tasks:**
- [ ] Create `/src/app/(auth)/forgot-password/page.tsx` with email input form
- [ ] Create `/src/app/(auth)/reset-password/page.tsx` for token-based password reset
- [ ] Create feature actions in `/src/features/auth/actions/forgot-password-actions.ts`
- [ ] Wire to existing API endpoints: `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password`
- [ ] Add link from login page to forgot-password page
- [ ] Test full flow: request reset → email → click link → set new password

**API Status:** Backend endpoints already exist. Only UI work needed.

### 1.2 Microsoft Entra ID Login

**Effort: 0.5 day**

See [Phase 4](#phase-4-entra-id-authentication) for full details. The existing Microsoft OAuth provider already supports Entra ID with zero code changes for basic setup, or minimal changes for tenant-specific auth.

### 1.3 ESLint Cleanup

**Effort: 1 hour**

65 ESLint warnings (all unused imports, 0 errors). Fix before release.

```bash
cd ui && npm run lint:fix
```

### 1.4 Production Environment Validation

**Effort: 1 day**

- [ ] Test full auth flow end-to-end (login, register, tenant creation, dashboard)
- [ ] Test permission gates (admin vs member vs viewer)
- [ ] Test tenant isolation (data doesn't leak between tenants)
- [ ] Test OAuth flows (Google, GitHub, Microsoft/Entra ID)
- [ ] Verify all API endpoints return correct data
- [ ] Test backup/restore procedure
- [ ] Verify health checks work in production Docker compose
- [ ] Load test with realistic user volumes (10-50 concurrent)

---

## Phase 2: P1 — Should Complete Before Release

**Estimated total: 2-3 days**

### 2.1 Grafana Dashboard Improvements

**Effort: 1 day**

Current dashboards are basic. Add production-critical views.

**Tasks:**
- [ ] API overview dashboard: request rate, error rate, latency P50/P95/P99
- [ ] Database dashboard: connection pool, slow queries, query duration
- [ ] Business metrics: active tenants, assets/findings per tenant, scan status
- [ ] Update `setup/monitoring/grafana/dashboards/`

### 2.2 Alert Rules

**Effort: 0.5 day**

No alerting = no awareness when production fails.

**Tasks:**
- [ ] API error rate > 5% for 5 minutes
- [ ] API latency P95 > 2s for 5 minutes
- [ ] Database connection pool > 80% utilized
- [ ] Pod restarts > 3 in 10 minutes
- [ ] Disk usage > 85%
- [ ] Update `setup/monitoring/alertmanager/alerts.yml`

### 2.3 Off-site Backup

**Effort: 0.5 day**

Local-only backups = single point of failure.

**Tasks:**
- [ ] Add S3/GCS upload to `setup/backup/backup.sh`
- [ ] Configure retention policy for cloud storage
- [ ] Test restore from cloud backup
- [ ] Document backup verification procedure

### 2.4 Deployment Runbook

**Effort: 0.5 day**

Document for operations team.

**Location:** `/docs/_internal/runbooks/deployment.md`

**Contents:**
- [ ] Prerequisites checklist
- [ ] Step-by-step deployment (Docker Compose + Helm)
- [ ] Rollback procedure
- [ ] Environment variable reference
- [ ] Health check verification
- [ ] Common issues and solutions
- [ ] Incident response procedure

---

## Phase 3: P2 — After MVP Release

**Estimated total: 2-3 weeks**

### 3.1 E2E Tests

**Effort: 3-5 days**

Add Playwright tests for critical user flows.

**Flows to test:**
- [ ] Login → Dashboard → Logout
- [ ] Register → Create Team → Dashboard
- [ ] OAuth login (mock provider)
- [ ] Asset CRUD (create, view, edit, delete)
- [ ] Finding lifecycle (open → assign → resolve)
- [ ] Scan creation and monitoring
- [ ] Settings management (general, team, integrations)
- [ ] Permission gates (admin vs member visibility)

### 3.2 Additional API Service Tests

**Effort: 5-7 days**

30 services still untested. Priority order:

| Tier | Services | Reason |
|------|----------|--------|
| A | permission, scope_rule, oauth, audit | Security-critical |
| B | asset_group, attack_surface, branch, finding_comment, sla | Core business logic |
| C | email, module, scan_profile, tool, secretstore, credential_import | Infrastructure |

### 3.3 WAF Rules

**Effort: 1 day**

- [ ] Configure ModSecurity with OWASP Core Rule Set
- [ ] Add to Nginx reverse proxy in production compose
- [ ] Test with common attack patterns (SQLi, XSS, SSRF)

### 3.4 Log Aggregation

**Effort: 2 days**

- [ ] Add Loki + Promtail to monitoring stack
- [ ] Configure structured log parsing
- [ ] Add log dashboard to Grafana
- [ ] Set up log-based alerts (error spikes, auth failures)

### 3.5 Network Policies (K8s)

**Effort: 0.5 day**

- [ ] Enable NetworkPolicy in Helm values
- [ ] Restrict pod-to-pod traffic (only necessary connections)
- [ ] Block external access to internal services (postgres, redis)

---

## Phase 4: Entra ID Authentication

### Current State

Microsoft OAuth is **already fully implemented** in the codebase:

| Component | File | Status |
|-----------|------|--------|
| Config | `api/internal/config/config.go` → `OAuthConfig.Microsoft` | Implemented |
| OAuth Service | `api/internal/app/oauth_service.go` | Implemented |
| OAuth Handler | `api/internal/infra/http/handler/oauth_handler.go` | Implemented |
| Auth Routes | `api/internal/infra/http/routes/auth.go` | Implemented |
| UI Social Auth | `ui/src/features/auth/actions/social-auth-actions.ts` | Implemented |
| UI Callback | `ui/src/app/auth/callback/[provider]/page.tsx` | Implemented |

**Key insight:** Microsoft Entra ID IS Microsoft's cloud identity service. The existing Microsoft OAuth provider works with Entra ID credentials out of the box.

### OAuth Flow (Already Working)

```
User clicks "Sign in with Microsoft"
  → Frontend redirects to Microsoft authorization URL
  → User signs in with Entra ID credentials
  → Microsoft redirects to /auth/callback/microsoft with code
  → Backend exchanges code for tokens
  → Backend fetches user info from Microsoft Graph API
  → Backend creates/updates user in DB
  → Backend generates JWT and sets cookies
  → User is logged in
```

### Option A: Zero-Code Configuration (Recommended for MVP)

**Effort: 1 hour (configuration only)**

Just set environment variables pointing to your Entra ID app registration:

```bash
# .env.production
OAUTH_MICROSOFT_ENABLED=true
OAUTH_MICROSOFT_CLIENT_ID=<your-entra-app-id>
OAUTH_MICROSOFT_CLIENT_SECRET=<your-entra-client-secret>
OAUTH_MICROSOFT_SCOPES=openid,email,profile,User.Read
```

**Azure Entra ID Setup:**
1. Go to Azure Portal → Microsoft Entra ID → App registrations
2. New registration → Name: "OpenCTEM", Redirect URI: `https://your-domain.com/auth/callback/microsoft`
3. Certificates & secrets → New client secret → Copy value
4. API permissions → Add `openid`, `email`, `profile`, `User.Read`
5. Copy Application (client) ID and client secret to env vars

**Limitation:** Uses `https://login.microsoftonline.com/common/` — allows any Microsoft/Entra account to sign in.

### Option B: Tenant-Specific Entra ID (Recommended for Production)

**Effort: 2-3 hours (minimal code change)**

Restricts login to users from a specific Azure AD tenant only.

**Code changes:**

1. **Config** (`api/internal/config/config.go`):
```go
type OAuthProviderConfig struct {
    Enabled      bool
    ClientID     string
    ClientSecret string
    Scopes       []string
    TenantID     string  // NEW: Azure Entra tenant ID
}
```

2. **OAuth Service** (`api/internal/app/oauth_service.go`):
```go
// Update getMicrosoftAuthURL() and getMicrosoftToken()
// Replace "common" with tenant ID if configured:
func (s *OAuthService) microsoftBaseURL() string {
    tenant := s.config.OAuth.Microsoft.TenantID
    if tenant == "" {
        tenant = "common"
    }
    return fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0", tenant)
}
```

3. **Environment**:
```bash
OAUTH_MICROSOFT_TENANT_ID=your-azure-tenant-id
```

**Total code change: ~15 lines**

### Option C: Full OIDC Integration via Keycloak

**Effort: Not needed — existing hybrid auth already supports this**

If the customer already uses Keycloak as an identity broker with Entra ID federation, no changes needed. Configure Keycloak to federate with Entra ID, and OpenCTEM authenticates via Keycloak OIDC.

### Recommendation

**For MVP: Use Option A** (zero code changes, configuration only).
**Post-MVP: Implement Option B** (15 lines of code) for tenant-specific security.

### UI Considerations

The login page already shows social login buttons when providers are enabled. Microsoft button will appear automatically when `OAUTH_MICROSOFT_ENABLED=true`.

If you want to rebrand the button from "Microsoft" to "Entra ID" or add the Entra ID logo:
- Update `ui/src/features/auth/components/social-login-buttons.tsx` (or equivalent)
- Change label from "Sign in with Microsoft" to "Sign in with Entra ID"
- Optional: use the Entra ID icon instead of generic Microsoft icon

---

## Release Checklist

### Pre-Release

```
[ ] Phase 1 complete (P0 items)
[ ] All tests pass: API (`make test`) + UI (`npm test`)
[ ] Build passes: API (`make build`) + UI (`npm run build`)
[ ] Validation passes: UI (`npm run validate`)
[ ] Docker images build successfully
[ ] Health checks pass in production compose
[ ] Auth flows tested end-to-end
[ ] Backup/restore tested
[ ] Environment variables documented
[ ] Release notes written
```

### Release Day

```
[ ] Tag release: `git tag v1.0.0-mvp`
[ ] Build and push Docker images
[ ] Deploy to production (Helm or Docker Compose)
[ ] Verify health checks
[ ] Verify auth flows in production
[ ] Monitor error rates for 1 hour
[ ] Announce release
```

### Post-Release (Week 1)

```
[ ] Monitor production metrics daily
[ ] Address any critical bugs
[ ] Begin Phase 2 items (alerts, dashboards, off-site backup)
[ ] Collect user feedback
[ ] Plan Phase 3 based on feedback
```

---

## Timeline

| Week | Tasks | Milestone |
|------|-------|-----------|
| Week 1 (Days 1-3) | Phase 1: Forgot password, Entra ID config, lint cleanup | P0 Complete |
| Week 1 (Days 4-5) | Phase 1: Production validation, Phase 2: Runbook | Validation Complete |
| Week 2 (Days 1-3) | Phase 2: Grafana dashboards, alerts, off-site backup | P1 Complete |
| **Week 2 (Day 4)** | **Release Day** | **MVP v1.0.0** |
| Week 3+ | Phase 3: E2E tests, WAF, more API tests | Post-MVP |

**Total estimated time to MVP: 8-10 working days**

---

## Metrics for Success

| Metric | Target | Measurement |
|--------|--------|-------------|
| Build pass rate | 100% | CI pipeline |
| API test coverage | > 42% (current) | `go test -cover` |
| UI pages without errors | 160/160 | `npm run build` |
| Auth flow success rate | > 99% | Production monitoring |
| API latency P95 | < 500ms | Prometheus |
| Error rate | < 1% | Prometheus |
| Uptime | > 99.5% | Health check monitoring |
