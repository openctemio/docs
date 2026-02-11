---
layout: default
title: Platform Agent Tiers
parent: Database
nav_order: 3
---

# Platform Agent Tiers Database Schema

**Migration:** `000092_add_agent_tiers`
**Created:** 2026-01-26

## Overview

The platform agent tier system provides resource isolation and priority-based processing for different subscription plans:

| Tier | Priority | Plans | SLA (Max Queue) |
|------|----------|-------|-----------------|
| **shared** | 0 | Free, Team | 1 hour |
| **dedicated** | 50 | Business | 30 minutes |
| **premium** | 100 | Enterprise | 10 minutes |

## Tables

### `platform_agent_tiers`

Reference table for tier definitions.

| Column | Type | Description |
|--------|------|-------------|
| `slug` | VARCHAR(20) PK | Tier identifier: shared, dedicated, premium |
| `name` | VARCHAR(50) | Display name |
| `description` | TEXT | Tier description |
| `priority` | INT | Queue priority (0-100) |
| `max_queue_time_seconds` | INT | SLA: max wait time before escalation |
| `display_order` | INT | UI display order |
| `badge_color` | VARCHAR(20) | UI badge color |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

### `agents` (Updated Columns)

| Column | Type | Description |
|--------|------|-------------|
| `tier` | VARCHAR(20) | Agent tier (FK to platform_agent_tiers) |
| `load_score` | FLOAT | Weighted load score for selection (lower = better) |

### `commands` (Updated Columns)

| Column | Type | Description |
|--------|------|-------------|
| `tier_requested` | VARCHAR(20) | Tier requested by user |
| `tier_actual` | VARCHAR(20) | Actual tier after plan validation |

## Indexes

```sql
-- Filter platform agents by tier
idx_agents_tier ON agents(tier) WHERE is_platform_agent = TRUE

-- Find available agents by tier (for selection)
idx_agents_platform_tier_available ON agents(tier, health, status, current_jobs, max_concurrent_jobs)
    WHERE is_platform_agent = TRUE AND status = 'active' AND health = 'online'

-- Sort by load within tier
idx_agents_platform_load ON agents(tier, load_score)
    WHERE is_platform_agent = TRUE AND status = 'active' AND health = 'online'

-- Queue polling by tier
idx_commands_platform_queue_tier ON commands(tier_actual, queue_priority DESC, queued_at ASC)
    WHERE is_platform_job = TRUE AND status = 'pending' AND platform_agent_id IS NULL
```

---

## SQL Functions

### `calculate_queue_priority_v2`

Calculates queue priority including tier bonus.

```sql
calculate_queue_priority_v2(
    p_plan_slug VARCHAR,     -- Plan: free, team, business, enterprise
    p_tier VARCHAR,          -- Tier: shared, dedicated, premium
    p_queued_at TIMESTAMPTZ  -- When job was queued
) RETURNS INT
```

**Formula:**
- Plan priority: free=25, team=50, business=75, enterprise=100
- Tier priority: shared=0, dedicated=50, premium=100
- Age bonus: 1 point per minute in queue (max 50)
- **Total: plan + tier + age = max 250**

**Example:**
```sql
SELECT calculate_queue_priority_v2('business', 'dedicated', NOW() - INTERVAL '10 minutes');
-- Returns: 75 (plan) + 50 (tier) + 10 (age) = 135
```

---

### `get_next_platform_job_by_tier`

Atomically claims the next job from queue for a platform agent.

```sql
get_next_platform_job_by_tier(
    p_agent_id UUID,         -- Agent claiming the job
    p_agent_tier VARCHAR,    -- Agent's tier
    p_capabilities TEXT[],   -- Agent capabilities
    p_tools TEXT[]           -- Agent tools
) RETURNS UUID
```

**Tier Cascading Rules:**
- Premium agents can handle: premium, dedicated, shared jobs
- Dedicated agents can handle: dedicated, shared jobs
- Shared agents can handle: shared jobs only

**Behavior:**
1. Finds highest priority unassigned job matching tier
2. Uses `FOR UPDATE SKIP LOCKED` for atomic claiming
3. Updates job status to `acknowledged`
4. Returns command ID or NULL if no job available

**Example:**
```sql
SELECT get_next_platform_job_by_tier(
    '550e8400-e29b-41d4-a716-446655440000',
    'dedicated',
    ARRAY['sast', 'sca'],
    ARRAY['semgrep', 'trivy']
);
```

---

### `validate_tenant_tier_access`

Validates and potentially downgrades tier based on tenant's plan.

```sql
validate_tenant_tier_access(
    p_tenant_id UUID,        -- Tenant ID
    p_requested_tier VARCHAR -- Requested tier
) RETURNS VARCHAR
```

**Logic:**
1. Get tenant's `tier_access` array from `plan_modules`
2. If requested tier is allowed, return it
3. Otherwise, return `max_tier` from plan
4. Default to 'shared' if no subscription

**Example:**
```sql
-- Business tenant requests premium (not allowed)
SELECT validate_tenant_tier_access('tenant-uuid', 'premium');
-- Returns: 'dedicated' (downgraded to max allowed)

-- Enterprise tenant requests premium (allowed)
SELECT validate_tenant_tier_access('enterprise-tenant', 'premium');
-- Returns: 'premium'
```

---

### `update_queue_priorities_v2`

Recalculates queue priorities for all pending platform jobs.

```sql
update_queue_priorities_v2() RETURNS INT
```

**Usage:** Called periodically (cron job) to update priorities based on queue age.

**Example:**
```sql
SELECT update_queue_priorities_v2();
-- Returns: number of jobs updated
```

---

## Triggers

### `trg_validate_command_tier`

Automatically validates tier on command insert/update.

**Fires:** `BEFORE INSERT OR UPDATE OF tier_requested ON commands`
**Condition:** `NEW.is_platform_job = TRUE`

**Actions:**
1. Calls `validate_tenant_tier_access()` to set `tier_actual`
2. Calculates initial `queue_priority` using `calculate_queue_priority_v2()`

---

## Views

### `platform_agent_tier_stats`

Aggregated statistics for platform agents by tier.

| Column | Description |
|--------|-------------|
| `tier` | Tier slug |
| `tier_name` | Tier display name |
| `tier_priority` | Priority value |
| `total_agents` | Total agents in tier |
| `online_agents` | Online agents |
| `available_agents` | Active + online agents |
| `total_capacity` | Sum of max_concurrent_jobs |
| `current_load` | Sum of current_jobs |
| `available_slots` | Remaining capacity |
| `queued_jobs` | Pending jobs for this tier |

**Example:**
```sql
SELECT * FROM platform_agent_tier_stats;
```

| tier | tier_name | tier_priority | total_agents | online_agents | available_slots | queued_jobs |
|------|-----------|---------------|--------------|---------------|-----------------|-------------|
| premium | Premium | 100 | 5 | 4 | 12 | 3 |
| dedicated | Dedicated | 50 | 10 | 8 | 25 | 15 |
| shared | Shared | 0 | 20 | 15 | 40 | 50 |

---

## Plan Modules Configuration

The `plan_modules` table stores tier access per plan:

```json
// Free plan
{"max_tier": "shared", "tier_access": ["shared"]}

// Team plan
{"max_tier": "shared", "tier_access": ["shared"]}

// Business plan
{"max_tier": "dedicated", "tier_access": ["shared", "dedicated"]}

// Enterprise plan
{"max_tier": "premium", "tier_access": ["shared", "dedicated", "premium"]}
```

---

## Load Score Calculation

The `load_score` column is computed from agent heartbeat metrics:

**Formula:**
```
score = 0.30 * job_load + 0.40 * cpu + 0.15 * memory + 0.10 * disk_io + 0.05 * network
```

Where:
- `job_load` = (current_jobs / max_concurrent_jobs) * 100
- `cpu` = cpu_percent
- `memory` = memory_percent
- `disk_io` = (disk_read_mbps + disk_write_mbps) normalized
- `network` = (network_rx_mbps + network_tx_mbps) normalized

**Lower score = better candidate for selection**

---

## Agent Selection Algorithm

When selecting a platform agent:

1. **Filter** by tier (accessible tiers based on plan)
2. **Filter** by capabilities and tools
3. **Filter** by health = 'online' and status = 'active'
4. **Filter** by capacity (current_jobs < max_concurrent_jobs)
5. **Order** by:
   - Tier priority DESC (if `prefer_higher_tier`)
   - Region match (if `preferred_region` specified)
   - Load score ASC
   - Current jobs ASC
6. **Select** first matching agent

---

## Security Enhancements (Migration 000093)

### Audit Logging

**Table:** `tier_downgrade_audit`

Tracks when a tenant's requested tier is downgraded due to plan restrictions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | Audit record ID |
| `tenant_id` | UUID FK | Tenant that requested |
| `command_id` | UUID FK | Associated command (nullable) |
| `requested_tier` | VARCHAR(20) | Tier requested by user |
| `actual_tier` | VARCHAR(20) | Tier after validation |
| `reason` | TEXT | Downgrade reason (plan_restriction, no_active_subscription) |
| `plan_slug` | VARCHAR(50) | Plan slug at time of downgrade |
| `created_at` | TIMESTAMPTZ | When downgrade occurred |

### Rate Limiting

**Table:** `tier_rate_limits`

| Column | Type | Description |
|--------|------|-------------|
| `tenant_id` | UUID FK | Tenant ID |
| `tier` | VARCHAR(20) | Tier being rate limited |
| `window_start` | TIMESTAMPTZ | Rate limit window start |
| `request_count` | INT | Requests in current window |

**Default Rate Limits:**

| Tier | Requests/minute |
|------|-----------------|
| Premium | 500 |
| Dedicated | 200 |
| Shared | 50 |

### Security Functions

```sql
-- Check rate limit (returns TRUE if allowed)
SELECT check_tier_rate_limit('tenant-uuid', 'dedicated', 200, 1);

-- Get tier-specific rate limit
SELECT get_tier_rate_limit('premium');  -- Returns 500

-- Cleanup old rate limit records
SELECT cleanup_old_rate_limits();
```

### Security Monitoring View

```sql
SELECT * FROM tier_security_events;
```

Returns tier downgrade events with anomaly detection (recent_downgrade_count for the tenant in the last hour).

---

## Migration Rollback

To rollback this migration:

```bash
make docker-migrate-down MIGRATION=000092
```

This will:
- Remove `tier` and `load_score` columns from `agents`
- Remove `tier_requested` and `tier_actual` columns from `commands`
- Drop `platform_agent_tiers` table
- Drop all related functions, triggers, and views

For security audit rollback:
```bash
make docker-migrate-down MIGRATION=000093
```
