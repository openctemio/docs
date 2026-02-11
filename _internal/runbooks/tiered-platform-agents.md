# Operational Runbook: Tiered Platform Agents

**Version:** 1.0
**Created:** 2026-01-26
**Status:** Active
**On-Call Team:** Platform Operations

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Common Operations](#common-operations)
4. [Monitoring & Alerts](#monitoring--alerts)
5. [Troubleshooting](#troubleshooting)
6. [Emergency Procedures](#emergency-procedures)
7. [Maintenance Tasks](#maintenance-tasks)

---

## Overview

### System Description

The Tiered Platform Agent system provides resource isolation and priority-based job processing:

| Tier | Priority | SLA | Target Plans |
|------|----------|-----|--------------|
| Shared | 0 | 60 min | Free, Team |
| Dedicated | 50 | 30 min | Business |
| Premium | 100 | 10 min | Enterprise |

### Key Components

- **platform_agent_tiers** table - Tier definitions
- **agents.tier** column - Agent tier assignment
- **commands.tier_actual** column - Job tier after validation
- **tier_downgrade_audit** table - Security audit log
- **tier_rate_limits** table - Rate limiting tracking

### Access Requirements

- Database: Read/write access to `openctem` database
- Admin API: Bearer token with `admin:platform-agents` permission
- Monitoring: Access to Grafana dashboards

---

## Architecture

### Tier Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      JOB SUBMISSION                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Validate Tier   │
                    │ Against Plan    │
                    └────────┬────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
        ┌─────────┐     ┌─────────┐     ┌─────────┐
        │ Premium │     │Dedicated│     │ Shared  │
        │  Queue  │     │  Queue  │     │  Queue  │
        │ (P=100) │     │ (P=50)  │     │ (P=0)   │
        └────┬────┘     └────┬────┘     └────┬────┘
              │               │               │
              └───────────────┼───────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Agent Selection │
                    │ (Tier Cascade)  │
                    └────────┬────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
        ┌─────────┐     ┌─────────┐     ┌─────────┐
        │ Premium │     │Dedicated│     │ Shared  │
        │ Agents  │     │ Agents  │     │ Agents  │
        └─────────┘     └─────────┘     └─────────┘
```

---

## Common Operations

### 1. Add New Tier to Agent

**When:** New agent deployed or existing agent promoted

```bash
# Via psql
UPDATE agents
SET tier = 'dedicated', updated_at = NOW()
WHERE id = '<agent-uuid>';

# Via Admin API
curl -X PATCH https://api.openctem.io/api/v1/admin/platform-agents/<agent-id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier": "dedicated"}'
```

### 2. Check Tier Distribution

```sql
SELECT
    tier,
    COUNT(*) as total_agents,
    COUNT(*) FILTER (WHERE health = 'online') as online,
    SUM(max_concurrent_jobs) as total_capacity,
    SUM(current_jobs) as current_load
FROM agents
WHERE is_platform_agent = TRUE
GROUP BY tier
ORDER BY
    CASE tier WHEN 'premium' THEN 1 WHEN 'dedicated' THEN 2 ELSE 3 END;
```

### 3. View Queue Depth by Tier

```sql
SELECT
    tier_actual as tier,
    COUNT(*) as queued_jobs,
    MIN(queued_at) as oldest_job,
    AVG(EXTRACT(EPOCH FROM (NOW() - queued_at))/60)::int as avg_wait_minutes
FROM commands
WHERE is_platform_job = TRUE
  AND status = 'pending'
  AND platform_agent_id IS NULL
GROUP BY tier_actual
ORDER BY tier_actual;
```

### 4. Override Tenant Tier Access

**For special customers who need higher tier access:**

```sql
-- Grant premium access to business tenant
UPDATE tenant_subscriptions
SET limits_override = limits_override || '{"platform_agents:max_tier": "premium"}'::jsonb
WHERE tenant_id = '<tenant-uuid>'
  AND status = 'active';
```

### 5. Migrate Tenant Between Tiers

**When tenant upgrades/downgrades plan:**

```sql
-- Jobs are automatically handled by tier validation trigger
-- No manual migration needed - existing jobs keep their tier_actual
-- New jobs will get the new tier based on updated plan
```

---

## Monitoring & Alerts

### Key Metrics

| Metric | Query | Alert Threshold |
|--------|-------|-----------------|
| Queue depth by tier | `tier_queue_depth{tier="X"}` | >100 (shared), >50 (dedicated), >20 (premium) |
| Avg wait time | `tier_avg_wait_minutes{tier="X"}` | >48 (shared), >24 (dedicated), >8 (premium) |
| SLA breach count | `tier_sla_breaches{tier="X"}` | >0 (premium), >5 (dedicated) |
| Rate limit hits | `tier_rate_limit_exceeded{tier="X"}` | >100/hour |

### Grafana Dashboard

Dashboard: **Platform Agents - Tier Overview**

Panels:
1. Agent count by tier (real-time)
2. Queue depth by tier (time series)
3. Avg wait time by tier (gauge with SLA thresholds)
4. Job throughput by tier (time series)
5. SLA compliance rate (pie chart)
6. Tier downgrade events (time series)

### Alert Rules

```yaml
# prometheus-alerts.yml
groups:
  - name: platform-tiers
    rules:
      - alert: PremiumTierSLABreach
        expr: tier_avg_wait_minutes{tier="premium"} > 10
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Premium tier SLA breach"
          description: "Premium jobs waiting >10 minutes"

      - alert: DedicatedTierSLAWarning
        expr: tier_avg_wait_minutes{tier="dedicated"} > 24
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Dedicated tier approaching SLA"

      - alert: TierExhausted
        expr: tier_available_slots == 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Tier {{ $labels.tier }} has no available capacity"

      - alert: UnusualTierDowngrades
        expr: rate(tier_downgrades_total[1h]) > 10
        labels:
          severity: warning
        annotations:
          summary: "High tier downgrade rate for tenant"
```

---

## Troubleshooting

### Issue: Premium jobs not being processed

**Symptoms:**
- Premium tier queue growing
- Premium agents showing available slots

**Diagnosis:**
```sql
-- Check premium agent status
SELECT id, name, status, health, current_jobs, max_concurrent_jobs, load_score
FROM agents
WHERE is_platform_agent = TRUE AND tier = 'premium'
ORDER BY load_score;

-- Check for stuck jobs
SELECT id, status, tier_actual, platform_agent_id, created_at
FROM commands
WHERE is_platform_job = TRUE
  AND tier_actual = 'premium'
  AND status IN ('pending', 'acknowledged')
ORDER BY created_at;
```

**Resolution:**
1. If agents offline → Check agent health, restart if needed
2. If jobs stuck in acknowledged → Check `recover_stuck_platform_jobs()` function
3. If agents at capacity → Scale premium agent pool

### Issue: Tenant not getting expected tier

**Symptoms:**
- Business tenant jobs going to shared tier
- Tier downgrade audit events

**Diagnosis:**
```sql
-- Check tenant's plan and tier access
SELECT
    t.id as tenant_id,
    t.name as tenant_name,
    p.slug as plan_slug,
    pm.limits->>'max_tier' as max_tier,
    pm.limits->'tier_access' as accessible_tiers
FROM tenants t
JOIN tenant_subscriptions ts ON ts.tenant_id = t.id
JOIN plans p ON ts.plan_id = p.id
JOIN plan_modules pm ON pm.plan_id = p.id AND pm.module_id = 'platform_agents'
WHERE t.id = '<tenant-uuid>'
  AND ts.status = 'active';

-- Check recent downgrade events
SELECT * FROM tier_downgrade_audit
WHERE tenant_id = '<tenant-uuid>'
ORDER BY created_at DESC
LIMIT 10;
```

**Resolution:**
1. Verify subscription is active
2. Check plan has correct tier access
3. Apply limits_override if custom access needed

### Issue: Rate limiting affecting legitimate traffic

**Symptoms:**
- 429 errors returned to tenant
- Rate limit hits in monitoring

**Diagnosis:**
```sql
-- Check rate limit history
SELECT tenant_id, tier, window_start, request_count
FROM tier_rate_limits
WHERE tenant_id = '<tenant-uuid>'
ORDER BY window_start DESC
LIMIT 10;
```

**Resolution:**
1. Check if traffic pattern is legitimate
2. If legitimate, increase rate limit via override:
```sql
UPDATE tenant_subscriptions
SET limits_override = limits_override ||
    '{"platform_agents:rate_limit_multiplier": 2}'::jsonb
WHERE tenant_id = '<tenant-uuid>';
```

### Issue: Tier cascade causing priority inversion

**Symptoms:**
- Lower-tier jobs processed before higher-tier jobs

**Diagnosis:**
```sql
-- Check queue priorities
SELECT
    id, tier_actual, queue_priority, queued_at,
    EXTRACT(EPOCH FROM (NOW() - queued_at))/60 as wait_minutes
FROM commands
WHERE is_platform_job = TRUE
  AND status = 'pending'
ORDER BY queue_priority DESC
LIMIT 20;
```

**Resolution:**
- This is expected behavior when higher-tier queue is empty
- Premium/dedicated agents will pick up lower-tier jobs only when their queue is empty
- Priority within each tier is still respected

---

## Emergency Procedures

### E1: Premium Tier Complete Outage

**Impact:** Enterprise SLA breach
**Escalation:** Page Platform Lead immediately

**Steps:**
1. Check all premium agents:
```sql
SELECT * FROM agents WHERE tier = 'premium' AND is_platform_agent = TRUE;
```

2. If agents down, attempt restart via orchestrator

3. If cannot recover, enable tier cascade promotion:
```sql
-- Temporarily allow dedicated agents to handle premium jobs
-- (This is already the default behavior via cascading)
```

4. Communicate to affected Enterprise customers

5. Post-incident: Root cause analysis required

### E2: Database Tier Tables Corrupted

**Impact:** All tier functionality broken
**Escalation:** Database on-call + Platform Lead

**Steps:**
1. Check table integrity:
```sql
SELECT * FROM platform_agent_tiers;
SELECT COUNT(*), tier FROM agents WHERE is_platform_agent = TRUE GROUP BY tier;
```

2. If corrupted, restore from seed:
```sql
-- Re-run tier seed from migration
INSERT INTO platform_agent_tiers (slug, name, description, priority, max_queue_time_seconds, display_order, badge_color)
VALUES
    ('shared', 'Shared', 'Shared platform agents', 0, 3600, 1, 'gray'),
    ('dedicated', 'Dedicated', 'Dedicated agent pool', 50, 1800, 2, 'blue'),
    ('premium', 'Premium', 'Premium enterprise agents', 100, 600, 3, 'gold')
ON CONFLICT (slug) DO UPDATE SET
    priority = EXCLUDED.priority,
    max_queue_time_seconds = EXCLUDED.max_queue_time_seconds;
```

### E3: Tier Audit Table Full

**Impact:** Security logging failing
**Escalation:** Security on-call

**Steps:**
1. Check table size:
```sql
SELECT pg_size_pretty(pg_total_relation_size('tier_downgrade_audit'));
SELECT COUNT(*) FROM tier_downgrade_audit;
```

2. Archive old records:
```sql
-- Archive to cold storage first
COPY (SELECT * FROM tier_downgrade_audit WHERE created_at < NOW() - INTERVAL '90 days')
TO '/tmp/tier_audit_archive.csv' WITH CSV HEADER;

-- Then delete
DELETE FROM tier_downgrade_audit WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## Maintenance Tasks

### Daily

1. **Check SLA compliance** (automated alert)
2. **Review tier downgrade spikes** (Grafana dashboard)
3. **Verify rate limit cleanup ran** (should auto-cleanup records >1 day old)

### Weekly

1. **Audit tier distribution**
```sql
SELECT * FROM platform_agent_tier_stats;
```

2. **Review high-downgrade tenants**
```sql
SELECT tenant_id, COUNT(*) as downgrades
FROM tier_downgrade_audit
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY tenant_id
HAVING COUNT(*) > 50
ORDER BY downgrades DESC;
```

3. **Capacity planning review**
- Compare queue depth trends
- Plan agent scaling if needed

### Monthly

1. **SLA compliance report**
```sql
SELECT
    tier_actual,
    COUNT(*) as total_jobs,
    COUNT(*) FILTER (WHERE wait_time_seconds <= max_queue_time) as within_sla,
    ROUND(100.0 * COUNT(*) FILTER (WHERE wait_time_seconds <= max_queue_time) / COUNT(*), 2) as sla_percent
FROM (
    SELECT
        c.tier_actual,
        EXTRACT(EPOCH FROM (c.acknowledged_at - c.queued_at)) as wait_time_seconds,
        t.max_queue_time_seconds as max_queue_time
    FROM commands c
    JOIN platform_agent_tiers t ON c.tier_actual = t.slug
    WHERE c.is_platform_job = TRUE
      AND c.acknowledged_at IS NOT NULL
      AND c.created_at > NOW() - INTERVAL '30 days'
) sub
GROUP BY tier_actual;
```

2. **Cleanup rate limit records**
```sql
SELECT cleanup_old_rate_limits();
```

3. **Archive old audit records** (if not auto-archived)

---

## Contacts

| Role | Contact | Escalation Path |
|------|---------|-----------------|
| Platform On-Call | #platform-oncall | PagerDuty |
| Security On-Call | #security-oncall | PagerDuty |
| Database On-Call | #dba-oncall | PagerDuty |
| Platform Lead | @platform-lead | Slack DM |

---

*Last updated: 2026-01-26*
*Next review: 2026-02-26*
