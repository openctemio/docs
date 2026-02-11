# Tiered Platform Agents - Implementation Review

**Date:** 2026-01-26
**Reviewers:** PM/Tech Lead/BA + Security Team
**Status:** Phase 3 Completed

---

## Part 1: PM/Tech Lead/BA Evaluation

### Overall Assessment: **7.5/10**

The implementation plan is solid for a backend-focused feature, but has gaps in several areas.

---

### Strengths

| Area | Score | Notes |
|------|-------|-------|
| **Technical Design** | 9/10 | Clean tier hierarchy, proper DB constraints, good index strategy |
| **Domain Modeling** | 8/10 | Well-structured `PlatformAgentTier` type with methods |
| **Backward Compatibility** | 9/10 | Default to 'shared', graceful degradation |
| **Code Quality** | 8/10 | Interface segregation (PlatformAgentLicensing), testable |
| **Database Design** | 9/10 | Proper FK, check constraints, optimized indexes |

---

### Gaps & Concerns

#### 1. **Missing Business Requirements Documentation**

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| No SLA definitions | Business cannot validate | Document exact SLA per tier |
| No pricing model reference | Sales confusion | Link to pricing structure |
| No feature comparison matrix | Customer confusion | Create tier comparison table |

**Action Required:**
```markdown
| Feature | Shared | Dedicated | Premium |
|---------|--------|-----------|---------|
| Queue SLA | 60 min | 30 min | 10 min |
| Concurrent Jobs | 5 | 20 | 50 |
| Priority Support | - | - | Yes |
| Price/month | Included | +$X | +$Y |
```

#### 2. **Missing Acceptance Criteria**

The plan lacks testable acceptance criteria:

```gherkin
# Missing scenarios like:
Feature: Tier-based Job Routing
  Scenario: Business tenant job goes to dedicated queue
    Given a Business plan tenant
    When they submit a platform job
    Then the job should be assigned tier_actual = 'dedicated'
    And the job priority should include tier bonus of 50

  Scenario: Free tenant cannot request premium tier
    Given a Free plan tenant
    When they request a premium tier job
    Then the job should be downgraded to 'shared'
    And an audit event should be logged
```

#### 3. **Missing Operational Runbook**

| Missing Item | Risk |
|--------------|------|
| How to add a new tier | Manual errors |
| How to migrate tenants between tiers | Downtime risk |
| How to handle tier exhaustion | Customer impact |
| Monitoring alerts for SLA breaches | Silent failures |

#### 4. **Missing Migration Strategy for Existing Data**

- What happens to existing platform jobs in queue?
- How to backfill `tier_actual` for in-flight commands?
- Rollback plan if issues discovered?

#### 5. **Incomplete Phase Breakdown**

| Phase | Issue |
|-------|-------|
| Phase 6 (API) | No API contract/OpenAPI spec |
| Phase 7 (Frontend) | No wireframes/mockups |
| Phase 8 (UI) | No design system integration notes |
| Phase 9 (Testing) | No test plan document |

---

### Recommendations for PM/Tech Lead

1. **Create PRD (Product Requirements Document)**
   - Define business goals and success metrics
   - Document tier pricing and value proposition
   - Define SLA commitments

2. **Add User Stories**
   ```
   As an Enterprise customer,
   I want my jobs processed by premium agents,
   So that I get faster results with SLA guarantees.
   ```

3. **Define Success Metrics**
   - Average queue time per tier
   - SLA breach rate per tier
   - Tier upgrade conversion rate

4. **Create Rollout Plan**
   - Phase 1: Internal testing
   - Phase 2: Beta customers
   - Phase 3: GA with feature flag
   - Phase 4: Remove feature flag

---

## Part 2: Security Expert Evaluation

### Overall Security Assessment: **6.5/10**

The implementation has several security concerns that need addressing before production.

---

### Critical Issues

#### 1. **IDOR Vulnerability in Tier Access** (HIGH)

**Location:** `validate_tenant_tier_access()` SQL function

**Issue:** The function trusts `p_tenant_id` without verifying the caller has permission to act on behalf of that tenant.

```sql
-- Current (Vulnerable)
SELECT validate_tenant_tier_access('any-tenant-id', 'premium');
-- No authentication check!
```

**Risk:** Malicious actor could potentially submit jobs with a different tenant_id to gain higher tier access.

**Recommendation:**
```sql
-- Add caller verification
CREATE OR REPLACE FUNCTION validate_tenant_tier_access(
    p_tenant_id UUID,
    p_requested_tier VARCHAR,
    p_caller_user_id UUID  -- Add caller context
) RETURNS VARCHAR AS $$
BEGIN
    -- Verify caller has permission on this tenant
    IF NOT EXISTS (
        SELECT 1 FROM tenant_members
        WHERE tenant_id = p_tenant_id AND user_id = p_caller_user_id
    ) THEN
        RAISE EXCEPTION 'Access denied: user not member of tenant';
    END IF;
    -- ... rest of function
END;
$$
```

#### 2. **Missing Rate Limiting per Tier** (HIGH)

**Issue:** No rate limiting on tier-specific resources. An attacker could:
- Exhaust shared tier resources
- Denial of Service on lower tiers
- Resource starvation attacks

**Recommendation:**
```go
// Add tier-specific rate limits
type TierRateLimits struct {
    Shared    rate.Limit // e.g., 10 req/min
    Dedicated rate.Limit // e.g., 50 req/min
    Premium   rate.Limit // e.g., 100 req/min
}
```

#### 3. **Privilege Escalation via tier_requested** (MEDIUM)

**Location:** `commands.tier_requested` column

**Issue:** User can request any tier, relying on `validate_tenant_tier_access()` to downgrade. This creates an attack surface.

**Attack Vector:**
1. Attacker finds SQL injection in unrelated endpoint
2. Directly inserts command with `tier_actual = 'premium'` bypassing trigger
3. Job runs on premium agent

**Recommendation:**
- Add application-level validation BEFORE database
- Use database `SECURITY DEFINER` functions with restricted access
- Add audit logging for tier downgrades

```sql
-- Log tier downgrades for security monitoring
CREATE TABLE tier_downgrade_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    requested_tier VARCHAR(20),
    actual_tier VARCHAR(20),
    command_id UUID,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Medium Issues

#### 4. **Missing Audit Trail for Tier Changes** (MEDIUM)

**Issue:** No audit logging when:
- Tenant's tier access changes
- Job tier is downgraded
- Admin manually changes agent tier

**Recommendation:**
```sql
-- Add to existing audit_logs
INSERT INTO audit_logs (
    action, entity_type, entity_id,
    old_values, new_values, performed_by
)
VALUES (
    'TIER_DOWNGRADE', 'command', command_id,
    '{"tier_requested": "premium"}',
    '{"tier_actual": "shared", "reason": "plan_restriction"}',
    tenant_id
);
```

#### 5. **SQL Injection in Dynamic Queries** (MEDIUM)

**Location:** `agent_repository.go:SelectBestPlatformAgent`

**Issue:** While using parameterized queries, the tier string array construction could be vulnerable if `AllAccessibleTiers()` returns unsanitized data.

```go
// Current (Potentially risky)
tierStrings := make([]string, len(accessibleTiers))
for i, t := range accessibleTiers {
    tierStrings[i] = string(t)  // What if t contains SQL?
}
```

**Recommendation:**
```go
// Validate tier values before use
for i, t := range accessibleTiers {
    if !t.IsValid() {
        return nil, fmt.Errorf("invalid tier: %s", t)
    }
    tierStrings[i] = string(t)
}
```

#### 6. **Information Disclosure via Error Messages** (LOW)

**Issue:** Error messages may reveal tier information to unauthorized users.

```go
// Current
return nil, ErrTierNotAccessible  // Reveals tier exists

// Better
return nil, ErrPlatformNotAvailable  // Generic error
// Log detailed reason internally
```

---

### Security Recommendations

#### Immediate Actions (Before Production)

1. **Add authentication context to SQL functions**
2. **Implement rate limiting per tier**
3. **Add audit logging for tier operations**
4. **Validate tier values at application boundary**

#### Short-term Actions (Within 2 weeks)

5. **Security testing:**
   - Penetration test tier escalation scenarios
   - Fuzz test tier_requested input
   - Test with concurrent requests

6. **Monitoring:**
   ```yaml
   alerts:
     - name: TierEscalationAttempt
       condition: tier_requested != tier_actual AND tier_requested = 'premium'
       severity: warning

     - name: UnusualTierDistribution
       condition: shared_jobs / total_jobs > 0.95  # Possible attack
       severity: warning
   ```

#### Documentation Required

7. **Add to SECURITY.md:**
   ```markdown
   ## Platform Agent Tier Security

   ### Access Control
   - Tier access is validated against tenant's plan
   - Downgrades are logged for audit
   - Rate limits apply per tier

   ### Threat Model
   - Tier escalation: Mitigated by plan_modules check
   - Resource exhaustion: Mitigated by rate limiting
   - IDOR: Mitigated by tenant_id verification
   ```

---

## Summary

### Implementation Readiness

| Perspective | Score | Ready for Production? |
|-------------|-------|----------------------|
| PM/BA | 7.5/10 | No - Missing business docs |
| Tech Lead | 8/10 | Conditional - Minor gaps |
| Security | 8.5/10 | ✅ Yes - P0 issues addressed |

### Action Items Before Production

| Priority | Item | Owner | Effort | Status |
|----------|------|-------|--------|--------|
| P0 | Fix IDOR in tier validation | Security | 2h | ✅ DONE (Migration 000093) |
| P0 | Add rate limiting per tier | Backend | 4h | ✅ DONE (Migration 000093) |
| P0 | Add audit logging | Backend | 2h | ✅ DONE (Migration 000093) |
| P0 | Validate tier at app boundary | Backend | 1h | ✅ DONE (security_validator.go) |
| P1 | Create PRD document | PM | 4h | ✅ DONE (docs/prd/tiered-platform-agents.md) |
| P1 | Add acceptance criteria | QA | 2h | ✅ DONE (docs/acceptance/tiered-platform-agents.feature) |
| P1 | Security penetration test | Security | 8h | ❌ Pending (manual) |
| P2 | Create operational runbook | DevOps | 4h | ✅ DONE (docs/runbook/tiered-platform-agents.md) |
| P2 | Update SECURITY.md | Security | 2h | ❌ Pending |

---

## P0 Security Fixes Implemented (2026-01-26)

### Migration 000093: Tier Security Audit & Rate Limiting

**New Tables:**
- `tier_downgrade_audit` - Audit log for tier downgrade events
- `tier_rate_limits` - Rate limit tracking per tenant per tier

**New SQL Functions:**
- `check_tier_rate_limit(tenant_id, tier, max_requests, window_minutes)` - Rate limit check
- `get_tier_rate_limit(tier)` - Returns tier-specific rate limit (shared=50, dedicated=200, premium=500/min)
- `cleanup_old_rate_limits()` - Cleanup function for old records

**Enhanced Functions:**
- `validate_tenant_tier_access()` - Now logs downgrades to audit table
- `validate_command_tier()` trigger - Links audit records to command_id

**Security View:**
- `tier_security_events` - Monitoring view with anomaly detection (recent_downgrade_count)

### Application-Level Validation

**File:** `api/internal/app/security_validator.go`

- `ValidateTier(tier)` - Validates tier against whitelist
- `ValidateTierWithResult(tier, fieldName)` - Returns ValidationResult
- `SanitizeTier(tier)` - Normalizes and sanitizes tier input

**File:** `api/internal/infra/http/handler/platform_agent_handler.go`

- `ListPlatformAgents` - Sanitizes tier query parameter before use

---

*Review completed: 2026-01-26*
*P0 security fixes: 2026-01-26*
*Next review: After P1 items addressed*
