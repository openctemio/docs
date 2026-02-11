# Product Requirements Document: Tiered Platform Agents

**Document Version:** 1.0
**Created:** 2026-01-26
**Status:** Approved for Implementation
**Owner:** Product Team

---

## 1. Executive Summary

### 1.1 Problem Statement

Currently, all tenants share the same pool of platform agents regardless of their subscription plan. This creates several issues:

1. **No resource isolation** - Enterprise customers experience the same queue times as free users
2. **No SLA differentiation** - Cannot offer premium SLAs to paying customers
3. **Limited upsell path** - No clear value proposition for plan upgrades beyond job limits
4. **Unfair resource allocation** - Heavy free-tier usage can impact paying customers

### 1.2 Solution

Implement a tiered platform agent system that provides:

- **Resource isolation** by subscription tier (shared, dedicated, premium)
- **Priority-based queue processing** favoring higher-tier plans
- **SLA guarantees** for Business and Enterprise customers
- **Clear upgrade value proposition** for sales and customer retention

### 1.3 Business Goals

| Goal | Metric | Target |
|------|--------|--------|
| Increase Enterprise conversions | Conversion rate | +15% |
| Reduce Enterprise churn | Churn rate | -20% |
| Improve customer satisfaction | NPS score | +10 points |
| Enable premium pricing | ARPU | +25% |

---

## 2. User Personas

### 2.1 Free Tier User (DevSecOps Individual)

- **Needs:** Basic security scanning for personal/small projects
- **Pain Points:** Acceptable queue times, limited concurrent jobs
- **Tier Access:** Shared only

### 2.2 Team Plan User (Small Team Lead)

- **Needs:** Regular scanning for team projects
- **Pain Points:** Wants faster results but budget-conscious
- **Tier Access:** Shared only (higher priority than Free)

### 2.3 Business Plan User (Security Manager)

- **Needs:** Consistent scanning for multiple projects, SLA compliance
- **Pain Points:** Queue times affecting deployment schedules
- **Tier Access:** Shared + Dedicated

### 2.4 Enterprise User (CISO/Security Director)

- **Needs:** Mission-critical scanning with guaranteed SLAs
- **Pain Points:** Any delay is unacceptable, needs premium support
- **Tier Access:** Shared + Dedicated + Premium

---

## 3. Feature Specification

### 3.1 Tier Definitions

| Tier | Slug | Priority | Max Queue Time | Target Plans |
|------|------|----------|----------------|--------------|
| Shared | `shared` | 0 | 60 minutes | Free, Team |
| Dedicated | `dedicated` | 50 | 30 minutes | Business |
| Premium | `premium` | 100 | 10 minutes | Enterprise |

### 3.2 Plan-Tier Access Matrix

| Plan | Monthly Price | Shared | Dedicated | Premium | Max Concurrent |
|------|---------------|--------|-----------|---------|----------------|
| Free | $0 | ✅ | ❌ | ❌ | 1 |
| Team | $49 | ✅ | ❌ | ❌ | 3 |
| Business | $199 | ✅ | ✅ | ❌ | 10 |
| Enterprise | Custom | ✅ | ✅ | ✅ | 50+ |

### 3.3 SLA Commitments

| Tier | Queue Time SLA | Processing Priority | Support Level |
|------|----------------|---------------------|---------------|
| Shared | Best effort | Standard | Community |
| Dedicated | 30 min (99%) | High | Business hours |
| Premium | 10 min (99.9%) | Highest | 24/7 Premium |

### 3.4 Tier Selection Logic

```
1. User submits platform job
2. System checks user's plan → determines max_tier
3. User can request specific tier (optional)
4. If requested_tier > max_tier → downgrade to max_tier (audit logged)
5. Job enters queue with tier_actual
6. Queue priority = plan_priority + tier_priority + age_bonus
7. Agent selection prefers matching tier, cascades down if needed
```

### 3.5 Tier Cascading Rules

Higher-tier agents can process lower-tier jobs when their queue is empty:

- **Premium agents**: Can process premium, dedicated, shared jobs
- **Dedicated agents**: Can process dedicated, shared jobs
- **Shared agents**: Can process shared jobs only

This maximizes agent utilization while maintaining tier priority.

---

## 4. User Stories

### 4.1 Core User Stories

**US-001: Tenant Job Tier Assignment**
```
As a Business plan tenant,
I want my jobs to be processed by dedicated tier agents,
So that I get faster results than free users.

Acceptance Criteria:
- Given I have a Business plan subscription
- When I submit a platform job
- Then the job should be assigned tier_actual = 'dedicated'
- And the job should have higher priority than shared tier jobs
```

**US-002: Tier Downgrade Protection**
```
As a Free plan tenant,
I want to be prevented from accessing premium tier,
So that the system maintains fair resource allocation.

Acceptance Criteria:
- Given I have a Free plan subscription
- When I try to request a premium tier job
- Then the job should be downgraded to 'shared' tier
- And an audit event should be logged
- And I should still be able to run the job
```

**US-003: Enterprise SLA Guarantee**
```
As an Enterprise customer,
I want my jobs processed within 10 minutes,
So that I can meet my compliance deadlines.

Acceptance Criteria:
- Given I have an Enterprise subscription
- When I submit a premium tier job
- Then the job should start processing within 10 minutes
- Or the job should be escalated to operations
```

**US-004: Admin Tier Statistics**
```
As a platform administrator,
I want to see tier-specific statistics,
So that I can monitor resource allocation and SLA compliance.

Acceptance Criteria:
- Given I am logged in as an admin
- When I view platform agent statistics
- Then I should see stats broken down by tier
- Including: total agents, online agents, queue depth, SLA breaches
```

### 4.2 Security User Stories

**US-005: Rate Limiting by Tier**
```
As a platform operator,
I want rate limits applied per tier,
So that one tenant cannot exhaust resources for others.

Acceptance Criteria:
- Given tier rate limits (shared=50, dedicated=200, premium=500/min)
- When a tenant exceeds their tier rate limit
- Then new requests should be throttled
- And existing queued jobs should continue processing
```

**US-006: Tier Access Audit**
```
As a security auditor,
I want all tier downgrades logged,
So that I can detect and investigate potential abuse.

Acceptance Criteria:
- Given any tier downgrade event
- Then an audit record should be created
- Including: tenant_id, requested_tier, actual_tier, reason, timestamp
- And the audit should be queryable via security monitoring view
```

---

## 5. Technical Requirements

### 5.1 Database Schema

See: `docs/database/platform-agent-tiers.md`

### 5.2 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/platform-agents` | GET | List agents with tier filter |
| `/admin/platform-agents/stats` | GET | Get stats with tier breakdown |
| `/admin/platform-agents/{id}` | GET | Get agent details including tier |

### 5.3 Rate Limits

| Tier | Requests/minute | Burst |
|------|-----------------|-------|
| Shared | 50 | 75 |
| Dedicated | 200 | 300 |
| Premium | 500 | 750 |

### 5.4 Monitoring & Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| SLA Breach Warning | Queue time > 80% SLA | Warning |
| SLA Breach Critical | Queue time > 100% SLA | Critical |
| Tier Exhaustion | Available slots = 0 | Warning |
| Unusual Downgrades | >10 downgrades/hour for tenant | Warning |

---

## 6. Success Metrics

### 6.1 Operational Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Avg queue time (shared) | N/A | < 60 min | 99th percentile |
| Avg queue time (dedicated) | N/A | < 30 min | 99th percentile |
| Avg queue time (premium) | N/A | < 10 min | 99th percentile |
| SLA compliance rate | N/A | > 99.9% | Monthly |

### 6.2 Business Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Enterprise conversion | Baseline | +15% | 6 months |
| Business plan upgrades | Baseline | +25% | 6 months |
| Customer NPS | Current | +10 pts | 6 months |

---

## 7. Rollout Plan

### Phase 1: Internal Testing (Week 1-2)
- Deploy to staging environment
- Internal team testing
- Load testing with simulated tiers

### Phase 2: Beta Program (Week 3-4)
- Invite 5-10 Enterprise customers
- Collect feedback
- Monitor SLA compliance

### Phase 3: General Availability (Week 5-6)
- Enable for all tenants via feature flag
- Gradual rollout by tenant cohort
- Marketing announcement

### Phase 4: Feature Flag Removal (Week 7-8)
- Remove feature flag
- Full production rollout
- Documentation updates

---

## 8. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Agent pool exhaustion | High | Medium | Auto-scaling, tier cascading |
| SLA breach | High | Low | Monitoring alerts, escalation |
| Unfair tier gaming | Medium | Low | Audit logging, rate limits |
| Migration issues | Medium | Low | Backward compatibility default |

---

## 9. Dependencies

- Migration 000092: Platform agent tier schema
- Migration 000093: Security audit & rate limiting
- LicensingService: Tier access verification
- AgentSelector: Tier-aware agent selection

---

## 10. Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| Tier | Resource isolation level (shared/dedicated/premium) |
| Tier cascading | Higher-tier agents can process lower-tier jobs |
| SLA | Service Level Agreement (max queue time) |
| Downgrade | When requested tier exceeds plan's max_tier |

### B. Related Documents

- `docs/database/platform-agent-tiers.md` - Database schema
- `docs/implement/2026-01-26-tiered-platform-agents.md` - Implementation plan
- `docs/implement/2026-01-26-tiered-platform-agents-review.md` - Review & security

---

*Document approved by: Product, Engineering, Security*
*Last updated: 2026-01-26*
