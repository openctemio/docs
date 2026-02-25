---
layout: default
title: Release Readiness
parent: UI Operations
nav_order: 5
---

# Release Readiness Checklist

Pre-release checklist for OpenCTEM UI deployments.

---

## Pre-Release Checks

### Code Quality

- [ ] All lint checks pass (`npm run lint`)
- [ ] TypeScript compilation succeeds (`npm run type-check`)
- [ ] No console.log/console.error in production code
- [ ] All TODO/FIXME items are resolved or tracked

### Testing

- [ ] Unit tests pass (`npm run test`)
- [ ] E2E tests pass (if applicable)
- [ ] Manual smoke test on staging environment
- [ ] Test critical user flows:
  - [ ] Login/Logout
  - [ ] Tenant switching
  - [ ] Asset CRUD
  - [ ] Finding list/detail
  - [ ] Scan creation and monitoring

### Security

- [ ] No secrets in source code
- [ ] `BACKEND_API_URL` is server-side only (no `NEXT_PUBLIC_` prefix)
- [ ] CORS origins are properly configured
- [ ] CSP headers are set
- [ ] Auth cookies are `httpOnly`, `secure`, `sameSite`

### Build

- [ ] Production build succeeds (`npm run build`)
- [ ] Bundle size is within acceptable limits
- [ ] No new build warnings
- [ ] Environment variables are documented

### Deployment

- [ ] Docker image builds successfully
- [ ] Health check endpoint responds
- [ ] Staging deployment verified
- [ ] Rollback plan is documented

---

## Post-Release Verification

- [ ] Production health check passes
- [ ] Login flow works end-to-end
- [ ] API connectivity verified
- [ ] No increase in error rates
- [ ] Performance metrics are within baseline

---

## Related Documentation

- [Production Checklist](./PRODUCTION_CHECKLIST.md) — Comprehensive production checklist
- [Deployment Guide](./DEPLOYMENT.md) — Deployment procedures
- [Environment Variables](./ENVIRONMENT_VARIABLES.md) — Configuration reference
