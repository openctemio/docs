---
layout: default
title: Platform Agents
parent: Architecture
nav_order: 3
---

# Platform Agents Implementation Plan

> Hybrid Agent Architecture for OpenCTEM SaaS Platform

**Status:** Draft v3.2 (Complete Platform Agent Architecture)
**Created:** 2025-01-25
**Last Updated:** 2025-01-25
**Author:** Architecture Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Authentication Design](#3-authentication-design)
4. [Database Schema](#4-database-schema)
5. [Domain Layer](#5-domain-layer)
6. [API Endpoints](#6-api-endpoints)
7. [Service Layer](#7-service-layer)
8. [Queue Management](#8-queue-management)
9. [Agent State Management (Redis)](#9-agent-state-management-redis) ← **NEW v3.2**
10. [Agent Join Mechanism](#10-agent-join-mechanism) ← **NEW v3.2**
11. [Admin CLI](#11-admin-cli) ← **NEW v3.2**
12. [Licensing & Limits](#12-licensing--limits)
13. [UI Changes](#13-ui-changes)
14. [Migration Strategy](#14-migration-strategy)
15. [Implementation Phases](#15-implementation-phases)
16. [Testing Strategy](#16-testing-strategy)
17. [Monitoring & Operations](#17-monitoring--operations)
18. [Design Decisions](#18-design-decisions)

---

## 1. Executive Summary

### 1.1 Problem Statement

OpenCTEM currently only supports **Tenant Agents** - agents deployed and managed by tenants themselves. This creates barriers for:
- **Free/Small tenants**: No infrastructure to deploy agents
- **Quick evaluation**: Want to try the platform without setup
- **Managed service**: Some tenants want OpenCTEM to fully manage

### 1.2 Solution: Hybrid Agent Model with Auto-allocation

```
┌─────────────────────────────────────────────────────────────────────┐
│              HYBRID AGENT MODEL (AUTO-ALLOCATION)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────┐      ┌──────────────────────┐            │
│  │   TENANT AGENTS      │      │   PLATFORM AGENTS    │            │
│  ├──────────────────────┤      ├──────────────────────┤            │
│  │ • Tenant deploys     │      │ • OpenCTEM deploys    │            │
│  │ • Tenant manages     │      │ • OpenCTEM manages    │            │
│  │ • Full control       │      │ • AUTO-ALLOCATED     │            │
│  │ • Count toward limit │      │ • Concurrent job limit│            │
│  │ • 1 agent = 1 tenant │      │ • 1 agent = N tenant │            │
│  │ • Tenant selects     │      │ • Platform selects   │            │
│  └──────────────────────┘      └──────────────────────┘            │
│                                                                      │
│  KEY DIFFERENCE: Tenant does NOT select specific platform agent.    │
│  Platform automatically allocates the best agent based on:          │
│  - Capabilities matching                                             │
│  - Load balancing (least loaded agent)                               │
│  - Regional preference                                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 Auto-allocation Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AUTO-ALLOCATION FLOW                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Tenant creates Scan                                                 │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 1. Check: tenant has platform_agent_access?                  │    │
│  │ 2. Check: tenant has concurrent job slots?                   │    │
│  │ 3. Find: platform agent with matching capabilities           │    │
│  │ 4. Select: agent with lowest load                            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│       │                                                              │
│       ▼                                                              │
│  Platform Agent is auto-assigned                                     │
│       │                                                              │
│       ▼                                                              │
│  Tenant UI only shows: "Running on Platform Agent"                   │
│  (Does not show specific agent ID)                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.4 Key Benefits

| Benefit | Description |
|---------|-------------|
| **Lower barrier to entry** | Free tier users can scan immediately |
| **Managed option** | Enterprise can offload agent management |
| **Scalability** | Platform agents scale with demand |
| **Cost efficiency** | Shared infrastructure reduces costs |
| **Simple UX** | Tenant doesn't need to manage platform agents |
| **Load balancing** | Platform automatically balances load |
| **Flexibility** | Platform can scale/replace agents transparently |

---

## 2. Architecture Overview

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              OPENCTEM PLATFORM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐         ┌─────────────────┐         ┌───────────────┐ │
│  │   TENANT A      │         │   TENANT B      │         │   TENANT C    │ │
│  │   (Free Plan)   │         │   (Team Plan)   │         │  (Business)   │ │
│  └────────┬────────┘         └────────┬────────┘         └───────┬───────┘ │
│           │                           │                          │         │
│           ▼                           ▼                          ▼         │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │                         API GATEWAY                                     ││
│  │  • JWT Auth (tenant users)                                             ││
│  │  • Agent API Key Auth (tenant agents: rda_xxx)                         ││
│  │  • Platform Agent Auth (platform agents: rda_p_xxx + job token)        ││
│  └────────────────────────────────────────────────────────────────────────┘│
│           │                           │                          │         │
│           ▼                           ▼                          ▼         │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │                      SCAN ORCHESTRATION                                 ││
│  │  • Create scan jobs                                                    ││
│  │  • Generate job tokens (for platform agents)                           ││
│  │  • Route to appropriate agent                                          ││
│  │  • Track job status                                                    ││
│  └────────────────────────────────────────────────────────────────────────┘│
│           │                                                      │         │
│           ▼                                                      ▼         │
│  ┌─────────────────────┐                          ┌─────────────────────┐ │
│  │   TENANT AGENTS     │                          │  PLATFORM AGENTS    │ │
│  │   (Customer infra)  │                          │  (OpenCTEM infra)    │ │
│  │                     │                          │                     │ │
│  │  ┌───┐ ┌───┐ ┌───┐ │                          │  ┌───┐ ┌───┐ ┌───┐ │ │
│  │  │ A │ │ B │ │ C │ │                          │  │ 1 │ │ 2 │ │ 3 │ │ │
│  │  └───┘ └───┘ └───┘ │                          │  └───┘ └───┘ └───┘ │ │
│  │  Tenant B's agents  │                          │  Shared by all     │ │
│  └─────────────────────┘                          └─────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Agent Type Comparison

| Aspect | Tenant Agent | Platform Agent |
|--------|--------------|----------------|
| **Deployment** | Customer infrastructure | OpenCTEM infrastructure |
| **Management** | Customer responsibility | OpenCTEM operations team |
| **API Key Prefix** | `rda_` | `rda_p_` |
| **Authentication** | API Key → tenant_id | API Key + Command Token → tenant_id |
| **Multi-tenant** | No (1:1) | Yes (1:N) |
| **Data isolation** | By agent ownership | By command token |
| **Scaling** | Customer scales | OpenCTEM scales |
| **Cost** | Customer bears | Included in plan |
| **SLA** | N/A | Platform SLA |
| **Selection** | Tenant selects specific agent | **Platform auto-selects** |
| **Visibility** | Tenant sees details | Tenant only sees aggregate status |
| **Limit type** | `max_tenant_agents` (count) | `max_concurrent_platform_jobs` (concurrent) |

### 2.3 Data Flow: Platform Agent Scan

```
┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐
│ Tenant  │      │   API   │      │  Scan   │      │Platform │      │ Ingest  │
│   UI    │      │ Server  │      │ Service │      │  Agent  │      │ Service │
└────┬────┘      └────┬────┘      └────┬────┘      └────┬────┘      └────┬────┘
     │                │                │                │                │
     │ 1. Create Scan │                │                │                │
     │───────────────>│                │                │                │
     │                │ 2. Create Job  │                │                │
     │                │───────────────>│                │                │
     │                │                │                │                │
     │                │   3. Generate  │                │                │
     │                │   Job Token    │                │                │
     │                │<───────────────│                │                │
     │                │                │                │                │
     │ 4. Scan Created│                │                │                │
     │<───────────────│                │                │                │
     │                │                │                │                │
     │                │                │ 5. Poll        │                │
     │                │                │    Commands    │                │
     │                │                │<───────────────│                │
     │                │                │                │                │
     │                │                │ 6. Command +   │                │
     │                │                │    Job Token   │                │
     │                │                │───────────────>│                │
     │                │                │                │                │
     │                │                │                │ 7. Execute     │
     │                │                │                │    Scan        │
     │                │                │                │────────┐       │
     │                │                │                │        │       │
     │                │                │                │<───────┘       │
     │                │                │                │                │
     │                │                │                │ 8. Ingest      │
     │                │                │                │ (API Key +     │
     │                │                │                │  Job Token)    │
     │                │                │                │───────────────>│
     │                │                │                │                │
     │                │                │                │   9. Verify    │
     │                │                │                │   & Store      │
     │                │                │                │   (tenant from │
     │                │                │                │    job token)  │
     │                │                │                │                │
```

---

## 3. Authentication Design

### 3.1 Design Alternatives Evaluated

| Approach | Description | Verdict |
|----------|-------------|---------|
| **API Key only** | Single key per agent | ❌ Can't identify tenant context |
| **Scoped API Keys** | One key per tenant-agent pair | ❌ Key leak = full access, hard to revoke |
| **mTLS** | Client certificates | ❌ Overkill, complex cert management |
| **OAuth2 Token Exchange** | Standard OAuth2 | ❌ Unnecessary complexity |
| **Signed Command Context** | HMAC signature on command | ⚠️ Viable but less auditable |
| **API Key + Command Token** | Our approach | ✅ Best balance of security/simplicity |

### 3.2 Chosen Approach: API Key + Command Token

Similar to HashiCorp Vault's AppRole pattern:
- **API Key (`rda_p_xxx`)** = role_id (long-lived, identifies agent)
- **Command Token** = secret_id (short-lived, authorizes specific action)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐                                                        │
│  │ API Key         │  "I am Platform Agent X"                               │
│  │ (rda_p_xxx)     │  • Long-lived (until regenerated)                      │
│  │                 │  • Stored: agents.api_key_hash                         │
│  │                 │  • Proves: Agent identity                              │
│  └────────┬────────┘                                                        │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                        │
│  │ Command Token   │  "I am authorized for Command Y of Tenant Z"           │
│  │ (rct_xxx)       │  • Short-lived (TTL: command duration + buffer)        │
│  │                 │  • Stored: commands.auth_token_hash                    │
│  │                 │  • Proves: Authorization context                       │
│  │                 │  • Bound to: tenant_id, agent_id, command_id           │
│  └────────┬────────┘                                                        │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                        │
│  │ Verified        │  tenant_id extracted from command token                │
│  │ Context         │  Data ingested for correct tenant                      │
│  └─────────────────┘                                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Key Design Decisions

#### Decision 1: Command Token vs Separate Job Token Table

**Original design**: Separate `job_tokens` table
**Revised design**: Token embedded in `commands` table

```sql
-- ORIGINAL: Separate table (more complex)
CREATE TABLE job_tokens (
    id UUID PRIMARY KEY,
    token_hash VARCHAR(64),
    tenant_id UUID,
    agent_id UUID,
    command_id UUID,
    ...
);

-- REVISED: Embed in commands table (simpler)
ALTER TABLE commands ADD COLUMN auth_token_hash VARCHAR(64);
ALTER TABLE commands ADD COLUMN auth_token_prefix VARCHAR(20);
ALTER TABLE commands ADD COLUMN auth_token_expires_at TIMESTAMP;
```

**Rationale**:
- 1 command = 1 token (natural 1:1 relationship)
- No separate table to manage/cleanup
- Token lifecycle tied to command lifecycle
- Simpler queries, better performance

#### Decision 2: Multi-use Token (Not Single-use)

**Original**: Token consumed after first use
**Revised**: Token valid for multiple ingests until command completes

```
Scan lifecycle with multiple ingests:
┌─────────────────────────────────────────────────────────────────┐
│  Command Created → Token Generated                              │
│       │                                                         │
│       ├── Ingest #1: Findings batch 1     ✓ Token valid        │
│       ├── Ingest #2: Findings batch 2     ✓ Token valid        │
│       ├── Ingest #3: Assets               ✓ Token valid        │
│       ├── Ingest #4: Scan metadata        ✓ Token valid        │
│       │                                                         │
│       ▼                                                         │
│  Command Completed → Token Invalidated                          │
└─────────────────────────────────────────────────────────────────┘
```

**Rationale**:
- Real scans need multiple ingest calls
- Single-use would require token per ingest (complex)
- Command completion naturally invalidates token

#### Decision 3: Token Expiry Strategy

```
Token TTL = max(command_timeout, 24 hours) + 1 hour buffer

Examples:
├── Quick scan (timeout: 30min) → Token TTL: 24h + 1h = 25h
├── Long scan (timeout: 48h)    → Token TTL: 48h + 1h = 49h
└── No timeout specified        → Token TTL: 24h + 1h = 25h
```

**Rationale**:
- Tokens should outlive the scan they authorize
- Buffer prevents edge cases at expiry boundary
- Long-running scans supported without refresh complexity

### 3.4 Security Analysis

| Threat | Mitigation |
|--------|------------|
| **API Key stolen** | Token still required; attacker needs active command |
| **Token stolen** | Short TTL; bound to specific agent; command must be active |
| **Replay attack** | Token bound to command_id; command can only complete once |
| **Cross-tenant data** | Token contains tenant_id; verified on every ingest |
| **Agent impersonation** | Token.agent_id must match authenticated agent |
| **Token guessing** | 256-bit random; SHA256 hashed; timing-safe comparison |

### 3.5 Token Format

```
Command Token Format: rct_<random_bytes_base64>

Example: rct_7Hj9kL2mNpQrStUvWxYz1234567890abcdefghij

Components:
├── Prefix: "rct_" (OpenCTEM Command Token)
├── Random: 32 bytes (256 bits) base64-encoded
└── Total length: ~48 characters

Storage:
├── In DB: SHA256 hash only (64 hex chars)
├── Prefix stored separately for debugging
└── Full token returned to agent only once (in command response)
```

### 3.6 Comparison: Tenant vs Platform Agent Auth

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     TENANT AGENT                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  POST /api/v1/agent/ingest                                                  │
│  Authorization: Bearer rda_abc123...                                        │
│                                                                              │
│  Verification:                                                               │
│    1. Hash API key                                                          │
│    2. Lookup agent by hash                                                  │
│    3. Get tenant_id from agent.tenant_id                                    │
│                                                                              │
│  Tenant context: From agent ownership (agent belongs to 1 tenant)           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                     PLATFORM AGENT                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  POST /api/v1/platform-agent/ingest                                         │
│  Authorization: Bearer rda_p_xyz789...                                      │
│  X-Command-Token: rct_7Hj9kL2mNpQr...                                       │
│                                                                              │
│  Verification:                                                               │
│    1. Hash API key → lookup platform agent                                  │
│    2. Verify is_platform_agent = true                                       │
│    3. Hash command token → lookup command                                   │
│    4. Verify command.status = 'running'                                     │
│    5. Verify command.agent_id = agent.id                                    │
│    6. Verify token not expired                                              │
│    7. Get tenant_id from command.tenant_id                                  │
│                                                                              │
│  Tenant context: From command (command belongs to specific tenant's scan)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema

### 4.1 Migration: Add Platform Agent Support

**File:** `migrations/000XXX_add_platform_agents.up.sql`

```sql
-- =============================================================================
-- Migration: Add Platform Agent Support
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Add is_platform_agent flag to agents table
-- -----------------------------------------------------------------------------
ALTER TABLE agents
ADD COLUMN is_platform_agent BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for filtering platform agents
CREATE INDEX idx_agents_is_platform ON agents(is_platform_agent)
WHERE is_platform_agent = TRUE;

-- Index for counting tenant agents (excluding platform)
CREATE INDEX idx_agents_tenant_non_platform ON agents(tenant_id)
WHERE is_platform_agent = FALSE;

COMMENT ON COLUMN agents.is_platform_agent IS
'True for OpenCTEM-managed platform agents, false for tenant-owned agents';

-- -----------------------------------------------------------------------------
-- 2. Create system tenant for platform agents
-- -----------------------------------------------------------------------------
-- Use a well-known UUID for the system/platform tenant
-- This tenant owns all platform agents

INSERT INTO tenants (
    id,
    name,
    slug,
    plan_id,
    settings,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'OpenCTEM Platform',
    .openctem-platform',
    (SELECT id FROM plans WHERE slug = 'enterprise'),
    '{"is_system_tenant": true}'::jsonb,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Add command token fields to commands table (NOT separate table)
-- -----------------------------------------------------------------------------
-- Command token is embedded in commands table for simplicity:
-- - 1:1 relationship (1 command = 1 token)
-- - No separate cleanup needed
-- - Token lifecycle tied to command lifecycle

ALTER TABLE commands
ADD COLUMN auth_token_hash VARCHAR(64),
ADD COLUMN auth_token_prefix VARCHAR(20),
ADD COLUMN auth_token_expires_at TIMESTAMP WITH TIME ZONE;

-- Index for token lookup during ingest
CREATE UNIQUE INDEX idx_commands_auth_token ON commands(auth_token_hash)
WHERE auth_token_hash IS NOT NULL;

COMMENT ON COLUMN commands.auth_token_hash IS
'SHA256 hash of command token for platform agent authentication. NULL for tenant agent commands.';

COMMENT ON COLUMN commands.auth_token_prefix IS
'First 16 chars of token for debugging (e.g., rct_7Hj9kL2m...).';

COMMENT ON COLUMN commands.auth_token_expires_at IS
'Token expiry time. Should be command timeout + buffer.';

-- -----------------------------------------------------------------------------
-- 4. Track concurrent platform jobs per tenant
-- -----------------------------------------------------------------------------
-- Instead of assigning specific agents, we track concurrent job usage.
-- This allows platform to auto-select best agent for each job.

-- Add index for counting active platform commands per tenant
CREATE INDEX idx_commands_tenant_platform_active ON commands(tenant_id)
WHERE status IN ('pending', 'running')
AND auth_token_hash IS NOT NULL;  -- Platform agent commands have auth token

COMMENT ON INDEX idx_commands_tenant_platform_active IS
'Index for counting active platform agent jobs per tenant (for concurrent limit enforcement)';

-- -----------------------------------------------------------------------------
-- 5. Update plan_modules with new limit structure (Auto-allocation Model)
-- -----------------------------------------------------------------------------
-- New limits:
--   max_tenant_agents: Number of tenant-owned agents allowed
--   platform_agent_access: Boolean - can tenant use platform agents?
--   max_concurrent_platform_jobs: Max concurrent jobs on platform agents

-- Free plan: 1 tenant agent, platform access with 1 concurrent job
UPDATE plan_modules
SET limits = limits || '{"max_tenant_agents": 1, "platform_agent_access": true, "max_concurrent_platform_jobs": 1}'::jsonb
WHERE module_id = 'scans'
AND plan_id = (SELECT id FROM plans WHERE slug = 'free');

-- Team plan: 5 tenant agents, platform access with 3 concurrent jobs
UPDATE plan_modules
SET limits = limits || '{"max_tenant_agents": 5, "platform_agent_access": true, "max_concurrent_platform_jobs": 3}'::jsonb
WHERE module_id = 'scans'
AND plan_id = (SELECT id FROM plans WHERE slug = 'team');

-- Business plan: 20 tenant agents, platform access with 10 concurrent jobs
UPDATE plan_modules
SET limits = limits || '{"max_tenant_agents": 20, "platform_agent_access": true, "max_concurrent_platform_jobs": 10}'::jsonb
WHERE module_id = 'scans'
AND plan_id = (SELECT id FROM plans WHERE slug = 'business');

-- Enterprise plan: unlimited
UPDATE plan_modules
SET limits = limits || '{"max_tenant_agents": -1, "platform_agent_access": true, "max_concurrent_platform_jobs": -1}'::jsonb
WHERE module_id = 'scans'
AND plan_id = (SELECT id FROM plans WHERE slug = 'enterprise');

-- -----------------------------------------------------------------------------
-- 6. Helper functions (Auto-allocation Model)
-- -----------------------------------------------------------------------------

-- Function to count tenant's own agents (excluding platform)
CREATE OR REPLACE FUNCTION count_tenant_agents(p_tenant_id UUID)
RETURNS INT AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INT
        FROM agents
        WHERE tenant_id = p_tenant_id
        AND is_platform_agent = FALSE
    );
END;
$$ LANGUAGE plpgsql;

-- Function to count tenant's ACTIVE platform agent jobs (pending + running)
CREATE OR REPLACE FUNCTION count_tenant_active_platform_jobs(p_tenant_id UUID)
RETURNS INT AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INT
        FROM commands
        WHERE tenant_id = p_tenant_id
        AND status IN ('pending', 'running')
        AND auth_token_hash IS NOT NULL  -- Platform agent commands have auth token
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check if tenant can create more agents
CREATE OR REPLACE FUNCTION can_tenant_create_agent(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_current INT;
    v_limit INT;
BEGIN
    v_current := count_tenant_agents(p_tenant_id);
    v_limit := get_tenant_module_limit(p_tenant_id, 'scans', 'max_tenant_agents');

    -- -1 means unlimited
    IF v_limit = -1 THEN
        RETURN TRUE;
    END IF;

    RETURN v_current < v_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to check if tenant can use platform agents
CREATE OR REPLACE FUNCTION can_tenant_use_platform_agents(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(
        get_tenant_module_limit_bool(p_tenant_id, 'scans', 'platform_agent_access'),
        FALSE
    );
END;
$$ LANGUAGE plpgsql;

-- Function to check if tenant has available concurrent platform job slots
CREATE OR REPLACE FUNCTION can_tenant_start_platform_job(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_current INT;
    v_limit INT;
BEGIN
    -- First check if tenant has platform access
    IF NOT can_tenant_use_platform_agents(p_tenant_id) THEN
        RETURN FALSE;
    END IF;

    v_current := count_tenant_active_platform_jobs(p_tenant_id);
    v_limit := get_tenant_module_limit(p_tenant_id, 'scans', 'max_concurrent_platform_jobs');

    -- -1 means unlimited
    IF v_limit = -1 THEN
        RETURN TRUE;
    END IF;

    RETURN v_current < v_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to select best platform agent for a job (load balancing)
-- Returns agent_id or NULL if no suitable agent available
CREATE OR REPLACE FUNCTION select_platform_agent(
    p_required_capabilities TEXT[] DEFAULT NULL,
    p_required_tool TEXT DEFAULT NULL,
    p_preferred_region TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_agent_id UUID;
BEGIN
    SELECT a.id INTO v_agent_id
    FROM agents a
    WHERE a.is_platform_agent = TRUE
    AND a.status = 'active'
    AND a.health = 'online'
    -- Capability matching (if specified)
    AND (p_required_capabilities IS NULL OR a.capabilities @> p_required_capabilities)
    -- Tool matching (if specified)
    AND (p_required_tool IS NULL OR p_required_tool = ANY(a.tools))
    ORDER BY
        -- Prefer region match
        CASE WHEN p_preferred_region IS NOT NULL AND a.region = p_preferred_region THEN 0 ELSE 1 END,
        -- Prefer lower load (current_jobs / max_concurrent_jobs)
        CASE WHEN a.max_concurrent_jobs > 0
             THEN a.current_jobs::FLOAT / a.max_concurrent_jobs::FLOAT
             ELSE 0 END ASC,
        -- Prefer agent with more available slots
        (COALESCE(a.max_concurrent_jobs, 1) - a.current_jobs) DESC,
        -- Random tiebreaker for fair distribution
        RANDOM()
    LIMIT 1;

    RETURN v_agent_id;
END;
$$ LANGUAGE plpgsql;
```

### 4.2 Rollback Migration

**File:** `migrations/000XXX_add_platform_agents.down.sql`

```sql
-- Rollback platform agents support (Auto-allocation Model)

-- Drop helper functions
DROP FUNCTION IF EXISTS select_platform_agent(TEXT[], TEXT, TEXT);
DROP FUNCTION IF EXISTS can_tenant_start_platform_job(UUID);
DROP FUNCTION IF EXISTS can_tenant_use_platform_agents(UUID);
DROP FUNCTION IF EXISTS can_tenant_create_agent(UUID);
DROP FUNCTION IF EXISTS count_tenant_active_platform_jobs(UUID);
DROP FUNCTION IF EXISTS count_tenant_agents(UUID);

-- Remove command token fields and indexes
DROP INDEX IF EXISTS idx_commands_tenant_platform_active;
DROP INDEX IF EXISTS idx_commands_auth_token;
ALTER TABLE commands DROP COLUMN IF EXISTS auth_token_hash;
ALTER TABLE commands DROP COLUMN IF EXISTS auth_token_prefix;
ALTER TABLE commands DROP COLUMN IF EXISTS auth_token_expires_at;

-- Remove limits from plan_modules (restore original)
UPDATE plan_modules
SET limits = limits - 'max_tenant_agents' - 'platform_agent_access' - 'max_concurrent_platform_jobs'
WHERE module_id = 'scans';

-- Remove agent indexes
DROP INDEX IF EXISTS idx_agents_tenant_non_platform;
DROP INDEX IF EXISTS idx_agents_is_platform;

ALTER TABLE agents DROP COLUMN IF EXISTS is_platform_agent;

-- Note: System tenant is NOT deleted to preserve referential integrity
```

---

## 5. Domain Layer

### 5.1 Agent Entity Updates

**File:** `internal/domain/agent/entity.go`

```go
// Agent represents a registered agent (runner, worker, collector, or sensor).
type Agent struct {
    ID            shared.ID
    TenantID      shared.ID
    Name          string
    Type          AgentType
    Description   string
    Capabilities  []string
    Tools         []string
    ExecutionMode ExecutionMode
    Status        AgentStatus
    Health        AgentHealth
    StatusMessage string

    // Platform agent flag
    // Platform agents are managed by OpenCTEM and serve multiple tenants.
    // They require command tokens for authentication during ingest.
    IsPlatformAgent bool

    // ... rest of fields unchanged
}

// IsPlatform returns true if this is a OpenCTEM-managed platform agent.
func (a *Agent) IsPlatform() bool {
    return a.IsPlatformAgent
}

// CanServeMultipleTenants returns true if this agent can serve multiple tenants.
func (a *Agent) CanServeMultipleTenants() bool {
    return a.IsPlatformAgent
}
```

### 5.2 Command Entity Updates (Token embedded)

**File:** `internal/domain/command/entity.go` (additions)

```go
// Command represents a scan command assigned to an agent.
type Command struct {
    // ... existing fields ...

    // Platform agent authentication (only for platform agents)
    // Token is generated when command is created for a platform agent.
    // Token is validated on every ingest request.
    AuthTokenHash     string     // SHA256 hash of the token
    AuthTokenPrefix   string     // First 16 chars for debugging
    AuthTokenExpiresAt *time.Time // Token expiry time
}

// HasAuthToken returns true if this command has an auth token (platform agent command).
func (c *Command) HasAuthToken() bool {
    return c.AuthTokenHash != ""
}

// IsAuthTokenValid checks if the auth token is still valid.
func (c *Command) IsAuthTokenValid() bool {
    if !c.HasAuthToken() {
        return false
    }
    if c.AuthTokenExpiresAt == nil {
        return true // No expiry = valid
    }
    return time.Now().Before(*c.AuthTokenExpiresAt)
}

// IsAuthTokenExpired checks if the auth token has expired.
func (c *Command) IsAuthTokenExpired() bool {
    if c.AuthTokenExpiresAt == nil {
        return false
    }
    return time.Now().After(*c.AuthTokenExpiresAt)
}

// CanAcceptIngest checks if this command can accept ingest requests.
func (c *Command) CanAcceptIngest() bool {
    // Command must be in running state
    if c.Status != CommandStatusRunning {
        return false
    }
    // If has token, token must be valid
    if c.HasAuthToken() && !c.IsAuthTokenValid() {
        return false
    }
    return true
}
```

### 5.3 Command Token Generation

**File:** `internal/domain/command/token.go`

```go
package command

import (
    "crypto/rand"
    "crypto/sha256"
    "encoding/base64"
    "encoding/hex"
    "fmt"
    "time"
)

const (
    // CommandTokenPrefix is the prefix for command tokens
    CommandTokenPrefix = "rct_"

    // DefaultTokenTTL is the default token time-to-live
    DefaultTokenTTL = 25 * time.Hour // 24h + 1h buffer

    // TokenRandomBytes is the number of random bytes in token
    TokenRandomBytes = 32
)

// GenerateAuthToken generates a new auth token for a command.
// Returns the token string and its SHA256 hash.
func GenerateAuthToken(ttl time.Duration) (token, hash, prefix string, expiresAt time.Time, err error) {
    if ttl <= 0 {
        ttl = DefaultTokenTTL
    }

    // Generate random bytes
    randomBytes := make([]byte, TokenRandomBytes)
    if _, err := rand.Read(randomBytes); err != nil {
        return "", "", "", time.Time{}, fmt.Errorf("failed to generate random bytes: %w", err)
    }

    // Create token string: rct_<base64_random>
    token = CommandTokenPrefix + base64.RawURLEncoding.EncodeToString(randomBytes)

    // Hash for storage
    hashBytes := sha256.Sum256([]byte(token))
    hash = hex.EncodeToString(hashBytes[:])

    // Prefix for debugging
    prefix = token[:min(len(token), 16)]

    // Expiry time
    expiresAt = time.Now().Add(ttl)

    return token, hash, prefix, expiresAt, nil
}

// VerifyAuthToken verifies a token against a stored hash.
func VerifyAuthToken(token, storedHash string) bool {
    hashBytes := sha256.Sum256([]byte(token))
    computedHash := hex.EncodeToString(hashBytes[:])

    // Constant-time comparison to prevent timing attacks
    if len(computedHash) != len(storedHash) {
        return false
    }
    result := 0
    for i := 0; i < len(computedHash); i++ {
        result |= int(computedHash[i] ^ storedHash[i])
    }
    return result == 0
}

func min(a, b int) int {
    if a < b {
        return a
    }
    return b
}
```

### 5.4 Repository Interface Updates

**File:** `internal/domain/agent/repository.go` (additions)

```go
// Repository additions for platform agents (Auto-allocation Model)

// CountByTenant counts tenant-owned agents (excluding platform agents).
CountByTenant(ctx context.Context, tenantID shared.ID) (int, error)

// ListPlatformAgents lists all active platform agents.
// Used by auto-selection algorithm.
ListPlatformAgents(ctx context.Context, filter PlatformAgentFilter) ([]*Agent, error)

// SelectBestPlatformAgent selects the best available platform agent for a job.
// Implements load balancing: least loaded agent with matching capabilities.
// Returns nil if no suitable agent is available.
SelectBestPlatformAgent(ctx context.Context, req PlatformAgentSelectionRequest) (*Agent, error)

// GetPlatformAgentStats returns aggregate statistics for platform agents.
// Used for tenant UI to show platform agent status.
GetPlatformAgentStats(ctx context.Context) (*PlatformAgentStats, error)
```

```go
// PlatformAgentFilter for listing platform agents
type PlatformAgentFilter struct {
    Capabilities []string  // Required capabilities
    Tool         string    // Required tool
    Region       string    // Preferred region
    HealthStatus AgentHealth // Filter by health
}

// PlatformAgentSelectionRequest for auto-selection
type PlatformAgentSelectionRequest struct {
    Capabilities []string  // Required capabilities
    Tool         string    // Required tool
    Region       string    // Preferred region (optional)
}

// PlatformAgentStats for aggregate display
type PlatformAgentStats struct {
    TotalAgents      int     // Total platform agents
    OnlineAgents     int     // Agents with health = online
    TotalCapacity    int     // Sum of max_concurrent_jobs
    CurrentLoad      int     // Sum of current_jobs
    AvailableSlots   int     // TotalCapacity - CurrentLoad
    LoadPercent      float64 // CurrentLoad / TotalCapacity * 100
    CapabilitiesAvailable []string // All unique capabilities
    ToolsAvailable   []string // All unique tools
    RegionsAvailable []string // All unique regions
}
```

**File:** `internal/domain/command/repository.go` (additions)

```go
// Repository additions for command token

// GetByAuthTokenHash retrieves a command by its auth token hash.
// Used for platform agent authentication during ingest.
GetByAuthTokenHash(ctx context.Context, hash string) (*Command, error)

// CountActivePlatformJobsByTenant counts active (pending/running) platform agent jobs for a tenant.
// Used for concurrent job limit enforcement.
CountActivePlatformJobsByTenant(ctx context.Context, tenantID shared.ID) (int, error)
```

> **Note**: No longer need `TenantPlatformAgentRepository` as Auto-allocation model doesn't require assignment table.

---

## 6. API Endpoints

### 6.1 Token Prefixes

| Prefix | Type | Description | Example |
|--------|------|-------------|---------|
| `rda_` | Tenant Agent | Standard agent API key | `rda_a1b2c3d4e5f6...` |
| `rda_p_` | Platform Agent | Platform agent API key | `rda_p_x7y8z9w0...` |
| `rct_` | Command Token | Short-lived command token | `rct_7Hj9kL2mNp...` |

### 6.2 Endpoint Overview (Auto-allocation Model)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     API ENDPOINTS (AUTO-ALLOCATION)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TENANT AGENTS (existing, unchanged)                                         │
│  ─────────────────────────────────────                                       │
│  GET    /api/v1/agents                    List tenant's own agents          │
│  POST   /api/v1/agents                    Create tenant agent               │
│  GET    /api/v1/agents/{id}               Get agent details                 │
│  PUT    /api/v1/agents/{id}               Update agent                      │
│  DELETE /api/v1/agents/{id}               Delete agent                      │
│  POST   /api/v1/agents/{id}/regenerate    Regenerate API key               │
│                                                                              │
│  AGENT OPERATIONS (existing, unchanged)                                      │
│  ─────────────────────────────────────────                                   │
│  POST   /api/v1/agent/heartbeat           Agent heartbeat                   │
│  GET    /api/v1/agent/commands            Poll for commands                 │
│  POST   /api/v1/agent/ingest              Ingest scan results              │
│                                                                              │
│  PLATFORM AGENTS STATUS (new - aggregate view only)                         │
│  ─────────────────────────────────────────────────────                       │
│  GET    /api/v1/platform-agents/status    Get aggregate platform status     │
│                                           (online count, capacity, etc.)    │
│                                                                              │
│  Note: Tenant does NOT see detailed list of platform agents.                │
│        Only sees aggregate status to know if platform agents are available. │
│                                                                              │
│  PLATFORM AGENT OPERATIONS (new - for platform agents)                      │
│  ──────────────────────────────────────────────────────                      │
│  POST   /api/v1/platform-agent/heartbeat  Platform agent heartbeat         │
│  GET    /api/v1/platform-agent/commands   Poll for commands (all tenants)  │
│  POST   /api/v1/platform-agent/ingest     Ingest results (with cmd token)  │
│                                                                              │
│  SCAN CREATION (updated - auto-select platform agent)                       │
│  ─────────────────────────────────────────────────────                       │
│  POST   /api/v1/scans                     Create scan                       │
│         Request: {"use_platform_agent": true, ...}                          │
│         → Platform auto-selects best agent                                  │
│         → Returns scan with agent_type: "platform"                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Detailed Endpoint Specifications (Auto-allocation Model)

#### 6.3.1 Platform Agents Status (Aggregate View)

```
GET /api/v1/platform-agents/status

Auth: JWT (tenant user)
Permission: scans:read

Response 200:
{
  "data": {
    // Aggregate status - tenant does NOT see specific agent IDs
    "total_agents": 10,
    "online_agents": 8,
    "total_capacity": 100,      // Total concurrent job slots
    "current_load": 45,         // Current running jobs
    "available_slots": 55,      // Available slots
    "load_percent": 45.0,       // Current load percentage

    // What capabilities are available
    "capabilities_available": ["sast", "sca", "secrets", "dast", "infra"],
    "tools_available": ["semgrep", "trivy", "gitleaks", "nuclei", "nmap"],
    "regions_available": ["us-east-1", "eu-west-1", "ap-southeast-1"],

    // Tenant's usage
    "tenant_usage": {
      "has_platform_access": true,
      "max_concurrent_jobs": 3,
      "active_jobs": 1,
      "available_slots": 2
    }
  }
}

Response 403 (no platform access):
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Your plan does not include platform agent access",
    "details": {
      "upgrade_plans": ["team", "business", "enterprise"]
    }
  }
}
```

#### 6.3.2 Create Scan with Platform Agent (Auto-selection)

```
POST /api/v1/scans

Auth: JWT (tenant user)
Permission: scans:write

Request:
{
  "name": "Security Scan",
  "target": {
    "type": "url",
    "value": "https://example.com"
  },
  "tool": "nuclei",
  // Option 1: Use specific tenant agent
  "agent_id": "tenant-agent-uuid",

  // Option 2: Use platform agent (auto-selected)
  "use_platform_agent": true,
  "preferred_region": "us-east-1"  // Optional hint
}

Response 201 (platform agent):
{
  "data": {
    "id": "scan-uuid",
    "name": "Security Scan",
    "status": "pending",
    "agent_type": "platform",     // Indicates platform agent
    // Note: agent_id NOT exposed for platform agents
    "estimated_start": "2024-01-25T10:00:00Z",
    "created_at": "2024-01-25T10:00:00Z"
  }
}

Response 400 (concurrent limit reached):
{
  "error": {
    "code": "CONCURRENT_LIMIT_EXCEEDED",
    "message": "Platform agent concurrent job limit reached",
    "details": {
      "active_jobs": 3,
      "max_concurrent_jobs": 3,
      "suggestion": "Wait for current jobs to complete or use a tenant agent"
    }
  }
}

Response 503 (no agents available):
{
  "error": {
    "code": "NO_AGENTS_AVAILABLE",
    "message": "No platform agents available with required capabilities",
    "details": {
      "required_tool": "nuclei",
      "suggestion": "Try again later or use a tenant agent"
    }
  }
}
```

#### 6.3.3 Platform Agent Commands (for platform agents)

```
GET /api/v1/platform-agent/commands

Auth: Platform Agent API Key (rda_p_xxx)
No JWT required

Response 200:
{
  "data": [
    {
      "command_id": "cmd-uuid",
      "command_token": "rct_7Hj9kL2mNpQr...",  // <-- Include command token!
      "tool": "nuclei",
      "target": {
        "type": "url",
        "value": "https://example.com"
      },
      "config": { /* scan config */ },
      "created_at": "2024-01-25T10:00:00Z"
    }
  ]
}

Note: Commands from ALL tenants that use this platform agent are returned.
Each command includes its auth token for use during ingest.
```

#### 6.3.4 Platform Agent Ingest

```
POST /api/v1/platform-agent/ingest

Auth:
  - Platform Agent API Key (rda_p_xxx) in Authorization header
  - Command Token (rct_xxx) in X-Command-Token header

Headers:
  Authorization: Bearer rda_p_xyz789...
  X-Command-Token: rct_7Hj9kL2mNpQr...
  Content-Type: application/json

Request:
{
  "command_id": "cmd-uuid",
  "status": "completed",
  "findings": [ /* CTIS format findings */ ],
  "assets": [ /* CTIS format assets */ ],
  "metadata": {
    "duration_ms": 45000,
    "tool_version": "2.9.1"
  }
}

Response 200:
{
  "data": {
    "ingested": {
      "findings": 15,
      "assets": 3
    },
    "job_completed": true
  }
}

Response 401 (invalid credentials):
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid platform agent credentials or job token"
  }
}

Response 403 (agent mismatch):
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Job token is not valid for this agent"
  }
}
```

---

## 7. Service Layer (Auto-allocation Model)

### 7.1 Agent Service Updates

**File:** `internal/app/agent_service.go` (additions)

```go
// AgentService handles agent-related business operations.
type AgentService struct {
    repo             agent.Repository
    commandRepo      command.Repository
    licensingService *LicensingService
    auditService     *AuditService
    logger           *logger.Logger
}

// CreateAgent creates a new tenant agent with limit checking.
func (s *AgentService) CreateAgent(ctx context.Context, input CreateAgentInput) (*CreateAgentOutput, error) {
    tenantID, err := shared.IDFromString(input.TenantID)
    if err != nil {
        return nil, fmt.Errorf("%w: invalid tenant id", shared.ErrValidation)
    }

    // Check tenant agent limit
    currentCount, err := s.repo.CountByTenant(ctx, tenantID)
    if err != nil {
        return nil, fmt.Errorf("failed to count agents: %w", err)
    }

    limitOutput, err := s.licensingService.GetTenantModuleLimit(
        ctx, input.TenantID, "scans", "max_tenant_agents",
    )
    if err != nil {
        return nil, fmt.Errorf("failed to get agent limit: %w", err)
    }

    if !limitOutput.Unlimited && int64(currentCount) >= limitOutput.Limit {
        return nil, shared.NewDomainError("LIMIT_EXCEEDED",
            fmt.Sprintf("tenant agent limit reached (%d/%d)", currentCount, limitOutput.Limit),
            shared.ErrForbidden)
    }

    // ... rest of creation logic unchanged
}

// AuthenticatePlatformAgent authenticates a platform agent by API key.
func (s *AgentService) AuthenticatePlatformAgent(ctx context.Context, apiKey string) (*agent.Agent, error) {
    if !strings.HasPrefix(apiKey, "rda_p_") {
        return nil, shared.NewDomainError("INVALID_KEY",
            "not a platform agent key", shared.ErrUnauthorized)
    }

    hash := hashAgentAPIKey(apiKey)
    agt, err := s.repo.GetByAPIKeyHash(ctx, hash)
    if err != nil {
        return nil, shared.NewDomainError("UNAUTHORIZED",
            "invalid API key", shared.ErrUnauthorized)
    }

    if !agt.IsPlatformAgent {
        return nil, shared.NewDomainError("UNAUTHORIZED",
            "not a platform agent", shared.ErrUnauthorized)
    }

    if !agt.Status.CanAuthenticate() {
        return nil, shared.NewDomainError("FORBIDDEN",
            "agent is not active", shared.ErrForbidden)
    }

    return agt, nil
}

// GetPlatformAgentStatus returns aggregate status of platform agents.
// Tenant does NOT see individual agent details.
func (s *AgentService) GetPlatformAgentStatus(ctx context.Context, tenantID string) (*PlatformAgentStatusOutput, error) {
    tid, err := shared.IDFromString(tenantID)
    if err != nil {
        return nil, fmt.Errorf("%w: invalid tenant id", shared.ErrValidation)
    }

    // Check if tenant has platform agent access
    hasAccess, err := s.licensingService.GetTenantModuleLimitBool(
        ctx, tenantID, "scans", "platform_agent_access",
    )
    if err != nil {
        return nil, fmt.Errorf("failed to check platform access: %w", err)
    }

    if !hasAccess {
        return nil, shared.NewDomainError("FORBIDDEN",
            "your plan does not include platform agent access", shared.ErrForbidden)
    }

    // Get aggregate stats
    stats, err := s.repo.GetPlatformAgentStats(ctx)
    if err != nil {
        return nil, fmt.Errorf("failed to get platform stats: %w", err)
    }

    // Get tenant's concurrent job limit and usage
    maxConcurrent, err := s.licensingService.GetTenantModuleLimit(
        ctx, tenantID, "scans", "max_concurrent_platform_jobs",
    )
    if err != nil {
        return nil, fmt.Errorf("failed to get concurrent limit: %w", err)
    }

    activeJobs, err := s.commandRepo.CountActivePlatformJobsByTenant(ctx, tid)
    if err != nil {
        return nil, fmt.Errorf("failed to count active jobs: %w", err)
    }

    availableSlots := int(maxConcurrent.Limit) - activeJobs
    if maxConcurrent.Unlimited {
        availableSlots = -1 // Unlimited
    }

    return &PlatformAgentStatusOutput{
        TotalAgents:           stats.TotalAgents,
        OnlineAgents:          stats.OnlineAgents,
        TotalCapacity:         stats.TotalCapacity,
        CurrentLoad:           stats.CurrentLoad,
        AvailableSlots:        stats.AvailableSlots,
        LoadPercent:           stats.LoadPercent,
        CapabilitiesAvailable: stats.CapabilitiesAvailable,
        ToolsAvailable:        stats.ToolsAvailable,
        RegionsAvailable:      stats.RegionsAvailable,
        TenantUsage: TenantPlatformUsage{
            HasPlatformAccess: true,
            MaxConcurrentJobs: int(maxConcurrent.Limit),
            ActiveJobs:        activeJobs,
            AvailableSlots:    availableSlots,
        },
    }, nil
}

// SelectPlatformAgentForJob selects the best platform agent for a scan job.
// This is the core auto-allocation algorithm.
func (s *AgentService) SelectPlatformAgentForJob(
    ctx context.Context,
    tenantID string,
    req SelectPlatformAgentRequest,
) (*agent.Agent, error) {
    tid, err := shared.IDFromString(tenantID)
    if err != nil {
        return nil, fmt.Errorf("%w: invalid tenant id", shared.ErrValidation)
    }

    // Step 1: Check if tenant has platform agent access
    hasAccess, err := s.licensingService.GetTenantModuleLimitBool(
        ctx, tenantID, "scans", "platform_agent_access",
    )
    if err != nil {
        return nil, fmt.Errorf("failed to check platform access: %w", err)
    }
    if !hasAccess {
        return nil, shared.NewDomainError("FORBIDDEN",
            "your plan does not include platform agent access", shared.ErrForbidden)
    }

    // Step 2: Check concurrent job limit
    maxConcurrent, err := s.licensingService.GetTenantModuleLimit(
        ctx, tenantID, "scans", "max_concurrent_platform_jobs",
    )
    if err != nil {
        return nil, fmt.Errorf("failed to get concurrent limit: %w", err)
    }

    activeJobs, err := s.commandRepo.CountActivePlatformJobsByTenant(ctx, tid)
    if err != nil {
        return nil, fmt.Errorf("failed to count active jobs: %w", err)
    }

    if !maxConcurrent.Unlimited && int64(activeJobs) >= maxConcurrent.Limit {
        return nil, shared.NewDomainError("CONCURRENT_LIMIT_EXCEEDED",
            fmt.Sprintf("platform agent concurrent job limit reached (%d/%d)",
                activeJobs, maxConcurrent.Limit),
            shared.ErrForbidden)
    }

    // Step 3: Select best available agent (load balancing)
    selectionReq := agent.PlatformAgentSelectionRequest{
        Capabilities: req.RequiredCapabilities,
        Tool:         req.RequiredTool,
        Region:       req.PreferredRegion,
    }

    selectedAgent, err := s.repo.SelectBestPlatformAgent(ctx, selectionReq)
    if err != nil {
        return nil, fmt.Errorf("failed to select agent: %w", err)
    }

    if selectedAgent == nil {
        return nil, shared.NewDomainError("NO_AGENTS_AVAILABLE",
            "no platform agents available with required capabilities",
            shared.ErrServiceUnavailable)
    }

    s.logger.Info("platform agent auto-selected",
        "agent_id", selectedAgent.ID,
        "agent_name", selectedAgent.Name,
        "tenant_id", tenantID,
        "tool", req.RequiredTool,
        "region", selectedAgent.Region,
        "load_factor", selectedAgent.LoadFactor(),
    )

    return selectedAgent, nil
}
```

### 7.1.1 Auto-selection Algorithm Details

```go
// SelectBestPlatformAgent implements the load-balancing auto-selection algorithm.
// Priority order:
// 1. Match required capabilities
// 2. Match required tool
// 3. Prefer matching region (if specified)
// 4. Select least loaded agent (lowest current_jobs/max_concurrent_jobs)
// 5. Random tiebreaker for fair distribution

func (r *AgentRepository) SelectBestPlatformAgent(
    ctx context.Context,
    req agent.PlatformAgentSelectionRequest,
) (*agent.Agent, error) {
    query := `
        SELECT ` + agentSelectFields + `
        FROM agents
        WHERE is_platform_agent = TRUE
        AND status = 'active'
        AND health = 'online'
        -- Has capacity
        AND (max_concurrent_jobs <= 0 OR current_jobs < max_concurrent_jobs)
        -- Capability matching (if specified)
        AND ($1::text[] IS NULL OR capabilities @> $1)
        -- Tool matching (if specified)
        AND ($2::text IS NULL OR $2 = ANY(tools))
        ORDER BY
            -- Prefer region match
            CASE WHEN $3 IS NOT NULL AND region = $3 THEN 0 ELSE 1 END,
            -- Prefer lower load factor
            CASE WHEN max_concurrent_jobs > 0
                 THEN current_jobs::FLOAT / max_concurrent_jobs::FLOAT
                 ELSE 0 END ASC,
            -- Prefer more available slots
            (COALESCE(max_concurrent_jobs, 1) - current_jobs) DESC,
            -- Random tiebreaker
            RANDOM()
        LIMIT 1
    `

    var agt agent.Agent
    err := r.db.QueryRowContext(ctx, query,
        pq.Array(req.Capabilities),
        nullString(req.Tool),
        nullString(req.Region),
    ).Scan(/* ... */)

    if errors.Is(err, sql.ErrNoRows) {
        return nil, nil // No suitable agent found
    }
    if err != nil {
        return nil, fmt.Errorf("failed to select agent: %w", err)
    }

    return &agt, nil
}
```

### 7.2 Command Service Updates (Token Generation)

**File:** `internal/app/command_service.go` (additions)

```go
// CreateCommandForPlatformAgent creates a command with auth token for platform agent.
func (s *CommandService) CreateCommandForPlatformAgent(
    ctx context.Context,
    input CreateCommandInput,
    agent *agent.Agent,
) (*CreateCommandOutput, error) {
    // Verify agent is platform agent
    if !agent.IsPlatformAgent {
        return nil, shared.NewDomainError("INVALID_AGENT",
            "agent is not a platform agent", shared.ErrValidation)
    }

    // Verify tenant has this platform agent assigned
    isAssigned, err := s.tenantPlatformRepo.IsAssigned(ctx, input.TenantID, agent.ID)
    if err != nil {
        return nil, fmt.Errorf("failed to check assignment: %w", err)
    }
    if !isAssigned {
        return nil, shared.NewDomainError("NOT_ASSIGNED",
            "platform agent is not assigned to this tenant", shared.ErrForbidden)
    }

    // Create command
    cmd, err := s.createBaseCommand(ctx, input)
    if err != nil {
        return nil, err
    }

    // Generate auth token for platform agent
    tokenTTL := input.Timeout + time.Hour // Command timeout + 1h buffer
    if tokenTTL < command.DefaultTokenTTL {
        tokenTTL = command.DefaultTokenTTL
    }

    tokenString, tokenHash, tokenPrefix, expiresAt, err := command.GenerateAuthToken(tokenTTL)
    if err != nil {
        return nil, fmt.Errorf("failed to generate auth token: %w", err)
    }

    cmd.AuthTokenHash = tokenHash
    cmd.AuthTokenPrefix = tokenPrefix
    cmd.AuthTokenExpiresAt = &expiresAt

    // Save command with token
    if err := s.repo.Create(ctx, cmd); err != nil {
        return nil, err
    }

    s.logger.Info("command created for platform agent",
        "command_id", cmd.ID,
        "agent_id", agent.ID,
        "tenant_id", input.TenantID,
    )

    return &CreateCommandOutput{
        Command:      cmd,
        CommandToken: tokenString, // Return token to include in agent poll response
    }, nil
}

// VerifyCommandToken verifies a command token for platform agent ingest.
func (s *CommandService) VerifyCommandToken(
    ctx context.Context,
    tokenString string,
    agentID shared.ID,
) (*command.Command, error) {
    // Hash the token
    tokenHash := command.HashAuthToken(tokenString)

    // Lookup command by token hash
    cmd, err := s.repo.GetByAuthTokenHash(ctx, tokenHash)
    if err != nil {
        return nil, shared.NewDomainError("INVALID_TOKEN",
            "invalid command token", shared.ErrUnauthorized)
    }

    // Verify command is in running state
    if !cmd.CanAcceptIngest() {
        if cmd.IsAuthTokenExpired() {
            return nil, shared.NewDomainError("TOKEN_EXPIRED",
                "command token has expired", shared.ErrUnauthorized)
        }
        return nil, shared.NewDomainError("COMMAND_NOT_RUNNING",
            "command is not in running state", shared.ErrForbidden)
    }

    // Verify agent binding
    if cmd.AgentID != agentID {
        s.logger.Warn("command token agent mismatch",
            "command_id", cmd.ID,
            "expected_agent", cmd.AgentID,
            "actual_agent", agentID,
        )
        return nil, shared.NewDomainError("AGENT_MISMATCH",
            "token is not valid for this agent", shared.ErrForbidden)
    }

    return cmd, nil
}
```

---

## 8. Queue Management

### 8.1 Global Queue Architecture

**Key Insight**: Jobs are NOT pre-assigned to specific agents. They sit in a **Global Queue** and are only assigned when an agent polls for work. This enables natural load balancing.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GLOBAL QUEUE MODEL                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  WRONG (Pre-assignment):                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                          │
│  │  Agent 1    │  │  Agent 2    │  │  Agent 3    │                          │
│  │  Queue: 20  │  │  Queue: 0   │  │  Queue: 5   │  ← Unbalanced!           │
│  └─────────────┘  └─────────────┘  └─────────────┘                          │
│                                                                              │
│  CORRECT (Global Queue):                                                     │
│                    ┌─────────────────────┐                                   │
│                    │    GLOBAL QUEUE     │                                   │
│                    │  [Job1] [Job2] ...  │                                   │
│                    │   Priority-sorted   │                                   │
│                    └──────────┬──────────┘                                   │
│                               │                                              │
│              ┌────────────────┼────────────────┐                             │
│              ▼                ▼                ▼                             │
│       ┌───────────┐    ┌───────────┐    ┌───────────┐                       │
│       │  Agent 1  │    │  Agent 2  │    │  Agent 3  │                       │
│       │   PULL    │    │   PULL    │    │   PULL    │                       │
│       └───────────┘    └───────────┘    └───────────┘                       │
│                                                                              │
│  Benefits:                                                                   │
│  • Busy agents pull less frequently → natural load balancing                │
│  • No job migration needed                                                   │
│  • Adding agents = instant capacity increase                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Job State Machine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         JOB STATE MACHINE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                          Tenant creates scan                                 │
│                                 │                                            │
│                                 ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                           PENDING                                     │   │
│  │  • In Global Queue, NOT assigned to any agent                         │   │
│  │  • Has queue_priority score                                           │   │
│  │  • Waiting for: (1) Agent capacity, (2) Tenant concurrent slot        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                 │                                            │
│                     Agent polls & claims job                                 │
│                                 │                                            │
│                                 ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                          DISPATCHED                                   │   │
│  │  • Assigned to specific agent                                         │   │
│  │  • Command token generated                                            │   │
│  │  • Counts toward tenant's concurrent limit                            │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                 │                                            │
│                        Agent starts execution                                │
│                                 │                                            │
│                                 ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                           RUNNING                                     │   │
│  │  • Agent executing scan                                               │   │
│  │  • Can ingest results                                                 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                 │                                            │
│              ┌──────────────────┴──────────────────┐                        │
│              ▼                                     ▼                        │
│  ┌────────────────────┐               ┌────────────────────┐               │
│  │     COMPLETED      │               │      FAILED        │               │
│  │  • Release slot    │               │  • Release slot    │               │
│  │  • Token invalid   │               │  • May retry       │               │
│  └────────────────────┘               └────────────────────┘               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Priority Scheduling: Weighted Fair Queuing

To ensure fair access while still prioritizing paid plans:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              WEIGHTED FAIR QUEUING WITH AGE BONUS                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Queue Priority = Plan Base Priority + Age Bonus                             │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  PLAN BASE PRIORITY                                                  │    │
│  │  ─────────────────────                                               │    │
│  │  Enterprise:  100 points                                             │    │
│  │  Business:     75 points                                             │    │
│  │  Team:         50 points                                             │    │
│  │  Free:         25 points                                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              +                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  AGE BONUS (Anti-starvation mechanism)                               │    │
│  │  ─────────────────────────────────────                               │    │
│  │  +1 point per minute waiting                                         │    │
│  │  Maximum: +75 points                                                 │    │
│  │                                                                      │    │
│  │  This ensures Free jobs eventually get processed even under          │    │
│  │  heavy Enterprise load (after ~75 minutes max wait)                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════    │
│  EXAMPLE SCENARIO:                                                           │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                              │
│  Time 0:00 - Enterprise submits Job A, Free submits Job B                    │
│    Job A: 100 + 0 = 100                                                     │
│    Job B: 25 + 0 = 25                                                       │
│    → Enterprise wins                                                        │
│                                                                              │
│  Time 1:00 - Both still waiting (heavy load)                                 │
│    Job A: 100 + 60 = 160                                                    │
│    Job B: 25 + 60 = 85                                                      │
│    → Enterprise still wins                                                  │
│                                                                              │
│  Time 1:15 - Enterprise submits NEW Job C, Free waited 75 min                │
│    Job B: 25 + 75 = 100  (max age bonus reached)                            │
│    Job C: 100 + 0 = 100                                                     │
│    → TIE! FIFO breaks tie → Job B wins (older)                              │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════    │
│  GUARANTEE:                                                                  │
│  • Enterprise: typically instant processing if capacity available           │
│  • Free: maximum ~75 minute wait even under heavy Enterprise load           │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.4 Concurrent Limit Enforcement

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CONCURRENT LIMIT SCENARIOS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SCENARIO: Free Tenant (1 tenant agent, 1 concurrent platform slot)         │
│  Creates 10 jobs: 5 for platform agent, 5 for tenant agent                  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        EXECUTION TIMELINE                              │  │
│  │                                                                        │  │
│  │  Platform Agent Pool (max_concurrent: 1):                              │  │
│  │  ────────────────────────────────────────                              │  │
│  │  [Job 1 ████████]                     ← Running (1/1 slot used)       │  │
│  │  [Job 2 ░░░░░░░░] Queue #1            ← Waiting                       │  │
│  │  [Job 3 ░░░░░░░░] Queue #2            ← Waiting                       │  │
│  │  [Job 4 ░░░░░░░░] Queue #3            ← Waiting                       │  │
│  │  [Job 5 ░░░░░░░░] Queue #4            ← Waiting                       │  │
│  │                                                                        │  │
│  │  Tenant Agent (separate, no platform limit):                           │  │
│  │  ──────────────────────────────────────────                            │  │
│  │  [Job 6 ████████]                     ← Running on tenant agent       │  │
│  │  [Job 7-10 ░░░░░] Agent's own queue   ← Waiting                       │  │
│  │                                                                        │  │
│  │  ════════════════════════════════════════════════════════════════     │  │
│  │  PARALLEL EXECUTION:                                                   │  │
│  │  Job 1 (platform) + Job 6 (tenant agent) running simultaneously!      │  │
│  │  ════════════════════════════════════════════════════════════════     │  │
│  │                                                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  SCENARIO: Team Tenant (3 concurrent platform slots)                         │
│  ────────────────────────────────────────────────────                        │
│  Creates 10 jobs for platform agents:                                        │
│                                                                              │
│  [Job 1 ████] [Job 2 ████] [Job 3 ████]  ← 3 running in parallel           │
│  [Job 4-10 ░░░░░░░░░░░░░░░░░░░░░░░░░░]  ← 7 in queue                       │
│                                                                              │
│  Note: All 3 jobs may run on DIFFERENT platform agents (load balanced)      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.5 Agent Polling Algorithm (Pull Model)

```go
// GetNextPlatformJob finds and dispatches the next job for a platform agent.
// Uses FOR UPDATE SKIP LOCKED to prevent race conditions.
func (r *CommandRepository) GetNextPlatformJob(
    ctx context.Context,
    agentID shared.ID,
    agentCapabilities []string,
    agentTools []string,
) (*command.Command, error) {
    query := `
        WITH eligible_jobs AS (
            SELECT
                c.*,
                -- Count active platform jobs for this tenant
                (SELECT COUNT(*) FROM commands
                 WHERE tenant_id = c.tenant_id
                 AND status IN ('dispatched', 'running')
                 AND is_platform_job = TRUE) as tenant_active_count,
                -- Get tenant's concurrent limit
                get_tenant_module_limit(c.tenant_id, 'scans', 'max_concurrent_platform_jobs') as tenant_limit
            FROM commands c
            WHERE c.status = 'pending'
            AND c.is_platform_job = TRUE
            -- Capability matching
            AND (c.required_capabilities IS NULL
                 OR c.required_capabilities <@ $2)
            -- Tool matching
            AND (c.required_tool IS NULL
                 OR c.required_tool = ANY($3))
        )
        SELECT * FROM eligible_jobs
        WHERE tenant_active_count < tenant_limit  -- Respect concurrent limit
        ORDER BY queue_priority DESC, queued_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED  -- Prevent race conditions
    `

    // ... execute query and return
}
```

### 8.6 Queue Database Schema

```sql
-- =============================================================================
-- Queue Management Schema Additions
-- =============================================================================

-- Add queue-related fields to commands table
ALTER TABLE commands ADD COLUMN is_platform_job BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE commands ADD COLUMN queue_priority INT NOT NULL DEFAULT 0;
ALTER TABLE commands ADD COLUMN queued_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE commands ADD COLUMN dispatched_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE commands ADD COLUMN max_retry_count INT NOT NULL DEFAULT 3;
ALTER TABLE commands ADD COLUMN retry_count INT NOT NULL DEFAULT 0;

-- Index for efficient queue polling (most critical index)
CREATE INDEX idx_commands_platform_queue
ON commands(queue_priority DESC, queued_at ASC)
WHERE status = 'pending' AND is_platform_job = TRUE;

-- Index for counting active jobs per tenant
CREATE INDEX idx_commands_tenant_active
ON commands(tenant_id)
WHERE status IN ('dispatched', 'running') AND is_platform_job = TRUE;

-- Index for counting queued jobs per tenant (for queue size limit)
CREATE INDEX idx_commands_tenant_queued
ON commands(tenant_id)
WHERE status = 'pending' AND is_platform_job = TRUE;

-- =============================================================================
-- Priority Calculation Function
-- =============================================================================
CREATE OR REPLACE FUNCTION calculate_queue_priority(
    p_plan_slug TEXT,
    p_queued_at TIMESTAMP WITH TIME ZONE
) RETURNS INT AS $$
DECLARE
    v_base_priority INT;
    v_age_minutes INT;
    v_age_bonus INT;
BEGIN
    -- Base priority by plan
    v_base_priority := CASE p_plan_slug
        WHEN 'enterprise' THEN 100
        WHEN 'business' THEN 75
        WHEN 'team' THEN 50
        WHEN 'free' THEN 25
        ELSE 25
    END;

    -- Age bonus: +1 per minute, max 75
    v_age_minutes := GREATEST(0, EXTRACT(EPOCH FROM (NOW() - p_queued_at))::INT / 60);
    v_age_bonus := LEAST(v_age_minutes, 75);

    RETURN v_base_priority + v_age_bonus;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- Periodic Priority Update (called by cron every minute)
-- =============================================================================
CREATE OR REPLACE FUNCTION update_queue_priorities()
RETURNS INT AS $$
DECLARE
    v_updated INT;
BEGIN
    UPDATE commands c
    SET queue_priority = calculate_queue_priority(
        (SELECT p.slug FROM plans p
         JOIN tenants t ON t.plan_id = p.id
         WHERE t.id = c.tenant_id),
        c.queued_at
    )
    WHERE c.status = 'pending'
    AND c.is_platform_job = TRUE;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated;
END;
$$ LANGUAGE plpgsql;
```

### 8.7 Queue Service Implementation

```go
// QueueService manages the global job queue for platform agents.
type QueueService struct {
    commandRepo      command.Repository
    tenantRepo       tenant.Repository
    licensingService *LicensingService
    logger           *logger.Logger
}

// EnqueuePlatformJob adds a job to the global queue.
func (s *QueueService) EnqueuePlatformJob(ctx context.Context, input EnqueueJobInput) (*command.Command, error) {
    tenantID, _ := shared.IDFromString(input.TenantID)

    // 1. Check platform access
    hasAccess, err := s.licensingService.GetTenantModuleLimitBool(
        ctx, input.TenantID, "scans", "platform_agent_access",
    )
    if err != nil || !hasAccess {
        return nil, shared.NewDomainError("NO_PLATFORM_ACCESS",
            "your plan does not include platform agent access", shared.ErrForbidden)
    }

    // 2. Check queue size limit
    queuedCount, err := s.commandRepo.CountQueuedPlatformJobs(ctx, tenantID)
    if err != nil {
        return nil, err
    }

    queueLimit, err := s.licensingService.GetTenantModuleLimit(
        ctx, input.TenantID, "scans", "max_queued_platform_jobs",
    )
    if err != nil {
        return nil, err
    }

    if !queueLimit.Unlimited && int64(queuedCount) >= queueLimit.Limit {
        return nil, shared.NewDomainError("QUEUE_FULL",
            fmt.Sprintf("platform job queue full (%d/%d)", queuedCount, queueLimit.Limit),
            shared.ErrForbidden)
    }

    // 3. Get plan for priority calculation
    tenant, err := s.tenantRepo.GetByID(ctx, tenantID)
    if err != nil {
        return nil, err
    }

    // 4. Calculate initial priority
    now := time.Now()
    priority := calculateQueuePriority(tenant.Plan.Slug, now)

    // 5. Create command in PENDING state
    cmd := &command.Command{
        ID:                   shared.NewID(),
        TenantID:             tenantID,
        Status:               command.StatusPending,
        IsPlatformJob:        true,
        QueuePriority:        priority,
        QueuedAt:             &now,
        RequiredTool:         input.Tool,
        RequiredCapabilities: input.Capabilities,
        MaxRetryCount:        3,
        // ... other fields
    }

    if err := s.commandRepo.Create(ctx, cmd); err != nil {
        return nil, err
    }

    s.logger.Info("job enqueued to platform queue",
        "command_id", cmd.ID,
        "tenant_id", input.TenantID,
        "priority", priority,
        "queue_position", queuedCount+1,
    )

    return cmd, nil
}

// DispatchNextJob finds and assigns the next job to a platform agent.
func (s *QueueService) DispatchNextJob(ctx context.Context, agent *agent.Agent) (*DispatchResult, error) {
    // Get next eligible job (uses FOR UPDATE SKIP LOCKED)
    cmd, err := s.commandRepo.GetNextPlatformJob(ctx, agent.ID, agent.Capabilities, agent.Tools)
    if err != nil {
        return nil, err
    }
    if cmd == nil {
        return nil, nil // No eligible job
    }

    // Generate command token
    token, tokenHash, tokenPrefix, expiresAt, err := command.GenerateAuthToken(24 * time.Hour)
    if err != nil {
        return nil, err
    }

    // Dispatch: assign to agent
    now := time.Now()
    cmd.Status = command.StatusDispatched
    cmd.AgentID = agent.ID
    cmd.DispatchedAt = &now
    cmd.AuthTokenHash = tokenHash
    cmd.AuthTokenPrefix = tokenPrefix
    cmd.AuthTokenExpiresAt = &expiresAt

    if err := s.commandRepo.Update(ctx, cmd); err != nil {
        return nil, err
    }

    s.logger.Info("job dispatched to platform agent",
        "command_id", cmd.ID,
        "agent_id", agent.ID,
        "tenant_id", cmd.TenantID,
        "waited_seconds", time.Since(*cmd.QueuedAt).Seconds(),
    )

    return &DispatchResult{
        Command: cmd,
        Token:   token,
    }, nil
}

// Priority calculation
var planBasePriority = map[string]int{
    "enterprise": 100,
    "business":   75,
    "team":       50,
    "free":       25,
}

func calculateQueuePriority(planSlug string, queuedAt time.Time) int {
    base := planBasePriority[planSlug]
    if base == 0 {
        base = 25
    }

    ageMinutes := int(time.Since(queuedAt).Minutes())
    ageBonus := min(ageMinutes, 75)

    return base + ageBonus
}
```

### 8.8 Handling Edge Cases

| Scenario | Problem | Solution |
|----------|---------|----------|
| **Agent fails mid-job** | Job stuck in DISPATCHED/RUNNING | Heartbeat timeout (5 min) → mark agent offline → return job to PENDING queue |
| **Specialized tool on 1 agent** | Jobs for that tool must wait | Job waits in queue until that agent available. Consider deploying tool on more agents. |
| **Tenant floods queue** | Free tenant submits 1000 jobs | Queue size limit per plan (Free: 10, Team: 50, Business: 200, Enterprise: 1000) |
| **All agents offline** | No processing | Jobs remain queued. Platform status shows "degraded". Alert ops. Max queue time = 24h before expiry. |
| **Priority inversion** | Free job waits forever | Age bonus ensures Free job wins after ~75 min wait |
| **Agent selection unfair** | Same agent always gets jobs | `FOR UPDATE SKIP LOCKED` + natural timing variation ensures distribution |

### 8.9 Failure Recovery

```go
// RecoverStuckJobs returns DISPATCHED/RUNNING jobs from offline agents to queue.
// Run periodically (every 1-2 minutes).
func (s *QueueService) RecoverStuckJobs(ctx context.Context) (int, error) {
    // Find jobs assigned to agents that haven't sent heartbeat in 5+ minutes
    query := `
        UPDATE commands c
        SET
            status = 'pending',
            agent_id = NULL,
            dispatched_at = NULL,
            retry_count = retry_count + 1,
            queue_priority = calculate_queue_priority(
                (SELECT p.slug FROM plans p JOIN tenants t ON t.plan_id = p.id WHERE t.id = c.tenant_id),
                c.queued_at
            )
        FROM agents a
        WHERE c.agent_id = a.id
        AND c.status IN ('dispatched', 'running')
        AND c.is_platform_job = TRUE
        AND c.retry_count < c.max_retry_count
        AND (a.last_seen_at IS NULL OR a.last_seen_at < NOW() - INTERVAL '5 minutes')
        RETURNING c.id
    `

    // ... execute and return count
}

// ExpireOldJobs marks jobs that have been queued too long as failed.
// Run periodically (every hour).
func (s *QueueService) ExpireOldJobs(ctx context.Context, maxAge time.Duration) (int, error) {
    query := `
        UPDATE commands
        SET status = 'failed',
            status_message = 'Job expired after waiting in queue too long'
        WHERE status = 'pending'
        AND is_platform_job = TRUE
        AND queued_at < NOW() - $1::interval
        RETURNING id
    `

    // ... execute with maxAge (e.g., 24h)
}
```

---

## 9. Agent State Management (Redis)

### 9.1 Why Redis for Agent State?

PostgreSQL alone works for small deployments, but has limitations at scale:

| Issue | PostgreSQL Only | With Redis |
|-------|-----------------|------------|
| Heartbeat writes | High DB load (every 10-30s per agent) | TTL keys, no DB writes |
| Online status check | Query DB | O(1) SET lookup |
| Job dispatch lock | `FOR UPDATE SKIP LOCKED` | `SETNX` (faster) |
| Real-time notifications | Polling | Pub/Sub |
| Rate limiting | Complex queries | Sliding window |

### 9.2 Architecture: PostgreSQL + Redis

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HYBRID STATE MANAGEMENT                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                         ┌─────────────────────┐                             │
│                         │    Platform API     │                             │
│                         └──────────┬──────────┘                             │
│                                    │                                         │
│              ┌─────────────────────┼─────────────────────┐                  │
│              │                     │                     │                  │
│              ▼                     ▼                     ▼                  │
│  ┌─────────────────────┐  ┌─────────────┐  ┌─────────────────────┐        │
│  │       Redis         │  │  PostgreSQL │  │   Platform Agents   │        │
│  │  (Ephemeral State)  │  │  (Durable)  │  │                     │        │
│  └─────────────────────┘  └─────────────┘  └─────────────────────┘        │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════    │
│                                                                              │
│  REDIS KEYS:                                                                 │
│  ───────────                                                                 │
│                                                                              │
│  1. Agent Heartbeat (auto-expires)                                          │
│     Key:   platform_agent:{agent_id}:heartbeat                              │
│     Value: {"cpu":45,"mem":60,"jobs":3,"ts":"2024-01-25T10:00:00Z"}        │
│     TTL:   30 seconds                                                       │
│     → If key expires, agent is considered OFFLINE                           │
│                                                                              │
│  2. Online Agents Set                                                        │
│     Key:   platform_agents:online                                           │
│     Type:  SET                                                               │
│     Value: {agent_id_1, agent_id_2, ...}                                    │
│     → O(1) check if agent is online                                         │
│     → SMEMBERS for list of all online agents                                │
│                                                                              │
│  3. Agent Capacity                                                           │
│     Key:   platform_agent:{agent_id}:capacity                               │
│     Type:  HASH                                                              │
│     Value: {max: 10, current: 3, available: 7}                              │
│     → Fast capacity lookup for job dispatch                                 │
│                                                                              │
│  4. Job Dispatch Lock                                                        │
│     Key:   job_lock:{command_id}                                            │
│     Value: agent_id                                                         │
│     TTL:   60 seconds                                                       │
│     → Prevents double-dispatch race conditions                              │
│                                                                              │
│  5. Pub/Sub Channels                                                         │
│     Channel: platform:jobs:new                                              │
│     → Notify agents when new jobs are available                             │
│     Channel: platform:agent:{agent_id}                                      │
│     → Direct messages to specific agent                                     │
│                                                                              │
│  POSTGRESQL TABLES (unchanged):                                              │
│  ─────────────────────────────                                               │
│  • agents (configuration, permanent state)                                  │
│  • commands (job queue, history)                                            │
│  • tenants, plans (business data)                                           │
│  • audit logs                                                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.3 Redis Key Schema

```go
// Redis key patterns for platform agents
const (
    // Heartbeat: stores agent metrics, auto-expires
    // SET with TTL, agent must refresh before expiry
    KeyAgentHeartbeat = "platform_agent:%s:heartbeat"  // %s = agent_id
    HeartbeatTTL      = 30 * time.Second

    // Online set: all online agent IDs
    // SADD when heartbeat received, SREM when expired
    KeyAgentsOnline = "platform_agents:online"

    // Capacity: current job capacity
    // HSET with max, current, available
    KeyAgentCapacity = "platform_agent:%s:capacity"

    // Job dispatch lock: prevents double-dispatch
    // SETNX with TTL
    KeyJobLock    = "job_lock:%s"  // %s = command_id
    JobLockTTL    = 60 * time.Second

    // Pub/Sub channels
    ChannelNewJobs     = "platform:jobs:new"
    ChannelAgentDirect = "platform:agent:%s"  // %s = agent_id
)
```

### 9.4 Heartbeat Service with Redis

```go
type HeartbeatService struct {
    redis    *redis.Client
    agentRepo agent.Repository
    logger   *logger.Logger
}

// ProcessHeartbeat handles agent heartbeat with Redis for fast state.
func (s *HeartbeatService) ProcessHeartbeat(ctx context.Context, agentID string, metrics HeartbeatMetrics) error {
    // 1. Update Redis (fast, ephemeral)
    heartbeatKey := fmt.Sprintf(KeyAgentHeartbeat, agentID)
    heartbeatData, _ := json.Marshal(metrics)

    pipe := s.redis.Pipeline()

    // Set heartbeat with TTL
    pipe.Set(ctx, heartbeatKey, heartbeatData, HeartbeatTTL)

    // Add to online set
    pipe.SAdd(ctx, KeyAgentsOnline, agentID)

    // Update capacity
    capacityKey := fmt.Sprintf(KeyAgentCapacity, agentID)
    pipe.HSet(ctx, capacityKey, map[string]interface{}{
        "max":       metrics.MaxJobs,
        "current":   metrics.CurrentJobs,
        "available": metrics.MaxJobs - metrics.CurrentJobs,
    })
    pipe.Expire(ctx, capacityKey, HeartbeatTTL)

    if _, err := pipe.Exec(ctx); err != nil {
        return fmt.Errorf("redis heartbeat failed: %w", err)
    }

    // 2. Async update PostgreSQL (less frequent, durable)
    // Only update DB every 5th heartbeat or on significant changes
    if shouldUpdateDB(metrics) {
        go s.updateAgentInDB(context.Background(), agentID, metrics)
    }

    return nil
}

// IsAgentOnline checks if agent is online (O(1) Redis lookup).
func (s *HeartbeatService) IsAgentOnline(ctx context.Context, agentID string) (bool, error) {
    return s.redis.SIsMember(ctx, KeyAgentsOnline, agentID).Result()
}

// GetOnlineAgents returns all online agent IDs.
func (s *HeartbeatService) GetOnlineAgents(ctx context.Context) ([]string, error) {
    return s.redis.SMembers(ctx, KeyAgentsOnline).Result()
}

// GetOnlineAgentCount returns count of online agents.
func (s *HeartbeatService) GetOnlineAgentCount(ctx context.Context) (int64, error) {
    return s.redis.SCard(ctx, KeyAgentsOnline).Result()
}
```

### 9.5 Expired Heartbeat Cleanup

```go
// CleanupExpiredAgents removes agents from online set when heartbeat expires.
// Uses Redis keyspace notifications.
func (s *HeartbeatService) StartExpirationListener(ctx context.Context) {
    // Subscribe to key expiration events
    pubsub := s.redis.PSubscribe(ctx, "__keyevent@0__:expired")
    defer pubsub.Close()

    for {
        select {
        case <-ctx.Done():
            return
        case msg := <-pubsub.Channel():
            // Check if it's a heartbeat key
            if strings.HasPrefix(msg.Payload, "platform_agent:") &&
               strings.HasSuffix(msg.Payload, ":heartbeat") {
                // Extract agent ID
                parts := strings.Split(msg.Payload, ":")
                if len(parts) >= 2 {
                    agentID := parts[1]

                    // Remove from online set
                    s.redis.SRem(ctx, KeyAgentsOnline, agentID)

                    // Update DB status
                    go s.markAgentOffline(context.Background(), agentID)

                    s.logger.Info("agent went offline (heartbeat expired)",
                        "agent_id", agentID)
                }
            }
        }
    }
}
```

### 9.6 Job Dispatch with Redis Lock

```go
// DispatchJobWithLock atomically claims a job for an agent.
func (s *QueueService) DispatchJobWithLock(ctx context.Context, commandID, agentID string) (bool, error) {
    lockKey := fmt.Sprintf(KeyJobLock, commandID)

    // Try to acquire lock (SETNX)
    acquired, err := s.redis.SetNX(ctx, lockKey, agentID, JobLockTTL).Result()
    if err != nil {
        return false, fmt.Errorf("failed to acquire lock: %w", err)
    }

    if !acquired {
        // Another agent already claimed this job
        return false, nil
    }

    // Lock acquired, update PostgreSQL
    err = s.commandRepo.DispatchToAgent(ctx, commandID, agentID)
    if err != nil {
        // Release lock on failure
        s.redis.Del(ctx, lockKey)
        return false, err
    }

    return true, nil
}
```

### 9.7 Pub/Sub for Real-time Notifications

```go
// NotifyNewJob publishes notification when new job is available.
func (s *QueueService) NotifyNewJob(ctx context.Context, job *command.Command) error {
    msg := JobNotification{
        CommandID:    job.ID.String(),
        Tool:         job.RequiredTool,
        Capabilities: job.RequiredCapabilities,
        Priority:     job.QueuePriority,
    }
    data, _ := json.Marshal(msg)

    return s.redis.Publish(ctx, ChannelNewJobs, data).Err()
}

// Agent side: Subscribe to new jobs
func (a *Agent) SubscribeToJobs(ctx context.Context) {
    pubsub := a.redis.Subscribe(ctx, ChannelNewJobs)
    defer pubsub.Close()

    for msg := range pubsub.Channel() {
        var notification JobNotification
        if err := json.Unmarshal([]byte(msg.Payload), &notification); err != nil {
            continue
        }

        // Check if this agent can handle the job
        if a.CanHandle(notification.Capabilities, notification.Tool) {
            // Try to claim the job
            go a.TryClaimJob(notification.CommandID)
        }
    }
}
```

---

## 10. Agent Join Mechanism

### 10.1 Overview: Bootstrap Token Flow

Similar to Kubernetes node join, platform agents use a **bootstrap token** for secure self-registration:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AGENT JOIN FLOW (K8s-style)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│  │    Admin    │         │   Platform  │         │    Agent    │           │
│  │   (CLI/UI)  │         │     API     │         │   (new)     │           │
│  └──────┬──────┘         └──────┬──────┘         └──────┬──────┘           │
│         │                       │                       │                   │
│         │ 1. Create token       │                       │                   │
│         │──────────────────────>│                       │                   │
│         │                       │                       │                   │
│         │ 2. Return token +     │                       │                   │
│         │    join command       │                       │                   │
│         │<──────────────────────│                       │                   │
│         │                       │                       │                   │
│         │ 3. Share join command │                       │                   │
│         │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─>│                   │
│         │                       │                       │                   │
│         │                       │ 4. Join request       │                   │
│         │                       │   (token + agent info)│                   │
│         │                       │<──────────────────────│                   │
│         │                       │                       │                   │
│         │                       │ 5. Validate token     │                   │
│         │                       │    Create agent       │                   │
│         │                       │    Generate API key   │                   │
│         │                       │                       │                   │
│         │                       │ 6. Return API key     │                   │
│         │                       │──────────────────────>│                   │
│         │                       │                       │                   │
│         │                       │                       │ 7. Save API key   │
│         │                       │                       │    Start operation│
│         │                       │                       │                   │
│                                                                              │
│  TOKEN LIFECYCLE:                                                            │
│  ─────────────────                                                           │
│  • Created by admin (via CLI or API)                                        │
│  • Short-lived: default 24h, configurable                                   │
│  • Single-use or limited uses                                               │
│  • Revocable before expiry                                                  │
│  • Full audit trail                                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Bootstrap Token Database Schema

```sql
-- =============================================================================
-- Bootstrap Tokens for Agent Join
-- =============================================================================
CREATE TABLE platform_agent_bootstrap_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Token (stored as hash)
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    token_prefix VARCHAR(20) NOT NULL,  -- "rbt_a1b2..." for display

    -- Token configuration
    description TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    max_uses INT NOT NULL DEFAULT 1,
    current_uses INT NOT NULL DEFAULT 0,

    -- Expected agent properties (validation on join)
    required_capabilities TEXT[] DEFAULT '{}',
    required_tools TEXT[] DEFAULT '{}',
    expected_region VARCHAR(50),
    allowed_names_pattern VARCHAR(255),  -- Regex pattern for agent names

    -- Auto-configuration for joined agents
    auto_max_concurrent_jobs INT DEFAULT 10,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    -- active: can be used
    -- used: max_uses reached
    -- expired: past expires_at
    -- revoked: manually revoked

    -- Usage tracking
    used_by_agents UUID[] DEFAULT '{}',
    last_used_at TIMESTAMP WITH TIME ZONE,

    -- Audit
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID REFERENCES users(id),
    revoke_reason TEXT,

    CONSTRAINT valid_status CHECK (status IN ('active', 'used', 'expired', 'revoked')),
    CONSTRAINT positive_max_uses CHECK (max_uses > 0)
);

CREATE INDEX idx_bootstrap_tokens_hash ON platform_agent_bootstrap_tokens(token_hash)
WHERE status = 'active';
CREATE INDEX idx_bootstrap_tokens_expires ON platform_agent_bootstrap_tokens(expires_at)
WHERE status = 'active';

-- =============================================================================
-- Agent Join Events (Audit Trail)
-- =============================================================================
CREATE TABLE platform_agent_join_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Agent
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

    -- Join method
    bootstrap_token_id UUID REFERENCES platform_agent_bootstrap_tokens(id),
    join_method VARCHAR(20) NOT NULL,  -- 'bootstrap_token', 'manual', 'api_key_rotation'

    -- Agent-reported info at join time
    reported_hostname VARCHAR(255),
    reported_ip INET,
    reported_capabilities TEXT[],
    reported_tools TEXT[],
    reported_version VARCHAR(50),
    reported_os VARCHAR(50),
    reported_arch VARCHAR(20),
    system_info JSONB,

    -- Result
    success BOOLEAN NOT NULL,
    failure_reason TEXT,

    -- Timestamp
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    client_ip INET
);

CREATE INDEX idx_join_events_agent ON platform_agent_join_events(agent_id);
CREATE INDEX idx_join_events_token ON platform_agent_join_events(bootstrap_token_id);
```

### 10.3 Join API Endpoint

```go
// POST /api/v1/platform-agent/join
// Authorization: Bearer rbt_<bootstrap_token>

type JoinRequest struct {
    Hostname     string            `json:"hostname"`
    IPAddress    string            `json:"ip_address"`
    Capabilities []string          `json:"capabilities"`
    Tools        []string          `json:"tools"`
    Version      string            `json:"version"`
    OS           string            `json:"os"`
    Arch         string            `json:"arch"`
    MaxConcurrentJobs int          `json:"max_concurrent_jobs"`
    SystemInfo   map[string]any    `json:"system_info"`
}

type JoinResponse struct {
    AgentID      string    `json:"agent_id"`
    Name         string    `json:"name"`
    APIKey       string    `json:"api_key"`       // Only returned once!
    APIKeyPrefix string    `json:"api_key_prefix"`
    ServerURL    string    `json:"server_url"`
    RegisteredAt time.Time `json:"registered_at"`
    Status       string    `json:"status"`
}
```

### 10.4 Join Service Implementation

```go
func (s *AgentJoinService) JoinWithBootstrapToken(
    ctx context.Context,
    token string,
    input JoinRequest,
) (*JoinResponse, error) {
    // 1. Validate token
    tokenHash := sha256Hash(token)
    bt, err := s.tokenRepo.GetByHash(ctx, tokenHash)
    if err != nil {
        return nil, ErrInvalidToken
    }

    // 2. Check token status and expiry
    if err := s.validateToken(bt); err != nil {
        return nil, err
    }

    // 3. Validate agent meets token requirements
    if err := s.validateAgentRequirements(bt, input); err != nil {
        return nil, err
    }

    // 4. Create agent record
    agent, err := s.createAgent(ctx, bt, input)
    if err != nil {
        return nil, err
    }

    // 5. Generate permanent API key
    apiKey, apiKeyHash, apiKeyPrefix := generatePlatformAgentKey()
    agent.SetAPIKey(apiKeyHash, apiKeyPrefix)

    // 6. Save agent
    if err := s.agentRepo.Create(ctx, agent); err != nil {
        return nil, err
    }

    // 7. Update token usage
    s.tokenRepo.IncrementUsage(ctx, bt.ID, agent.ID)

    // 8. Record join event
    s.recordJoinEvent(ctx, agent, bt, input, true, "")

    // 9. Initialize in Redis
    s.initAgentInRedis(ctx, agent)

    return &JoinResponse{
        AgentID:      agent.ID.String(),
        Name:         agent.Name,
        APIKey:       apiKey,
        APIKeyPrefix: apiKeyPrefix,
        ServerURL:    s.config.ServerURL,
        RegisteredAt: agent.CreatedAt,
        Status:       "active",
    }, nil
}
```

---

## 11. Admin CLI

### 11.1 CLI Overview

The `openctem-admin` CLI provides administrative commands for platform management, similar to `kubectl` or `kubeadm`:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ADMIN CLI COMMANDS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  openctem-admin                                                               │
│  ├── token                    # Bootstrap token management                  │
│  │   ├── create              # Create new bootstrap token                   │
│  │   ├── list                # List all tokens                              │
│  │   ├── get <id>            # Get token details                            │
│  │   ├── revoke <id>         # Revoke a token                               │
│  │   └── cleanup             # Remove expired tokens                        │
│  │                                                                          │
│  ├── agent                    # Platform agent management                   │
│  │   ├── list                # List all platform agents                     │
│  │   ├── get <id>            # Get agent details                            │
│  │   ├── disable <id>        # Disable an agent                             │
│  │   ├── enable <id>         # Enable an agent                              │
│  │   ├── delete <id>         # Delete an agent                              │
│  │   └── rotate-key <id>     # Rotate agent API key                         │
│  │                                                                          │
│  ├── queue                    # Job queue management                        │
│  │   ├── status              # Queue status and metrics                     │
│  │   ├── list                # List queued jobs                             │
│  │   └── flush               # Clear stuck jobs                             │
│  │                                                                          │
│  └── config                   # CLI configuration                           │
│      ├── set-server          # Set API server URL                           │
│      ├── set-token           # Set admin API token                          │
│      └── show                # Show current config                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Token Commands

```bash
# =============================================================================
# CREATE BOOTSTRAP TOKEN
# =============================================================================

# Basic token (24h, single-use)
$ openctem-admin token create
✓ Bootstrap token created

Token:        rbt_7Hj9kL2mNpQrStUvWxYz1234567890abcdef
Token ID:     a1b2c3d4-e5f6-7890-abcd-ef1234567890
Expires:      2024-01-26 10:00:00 UTC (in 24 hours)
Max Uses:     1

Join command:
  openctem-agent join --token=rbt_7Hj9kL2mNpQrStUvWxYz1234567890abcdef \
                     --server=https://api.openctem.io

# Token with custom options
$ openctem-admin token create \
    --description "US East scanners" \
    --expires 48h \
    --max-uses 5 \
    --capabilities sast,sca,secrets \
    --tools semgrep,trivy,gitleaks \
    --region us-east-1

✓ Bootstrap token created

Token:        rbt_AbCdEfGhIjKlMnOpQrStUvWx1234567890
Token ID:     b2c3d4e5-f6a7-8901-bcde-f12345678901
Expires:      2024-01-27 10:00:00 UTC (in 48 hours)
Max Uses:     5
Required:     capabilities=[sast,sca,secrets] tools=[semgrep,trivy,gitleaks]
Region:       us-east-1

Join command:
  openctem-agent join --token=rbt_AbCdEfGhIjKlMnOpQrStUvWx1234567890 \
                     --server=https://api.openctem.io

# Print only the join command (for scripting)
$ openctem-admin token create --print-join-command
openctem-agent join --token=rbt_XyZ123... --server=https://api.openctem.io

# Output as JSON
$ openctem-admin token create --output json
{
  "token": "rbt_...",
  "token_id": "...",
  "expires_at": "2024-01-26T10:00:00Z",
  "join_command": "openctem-agent join --token=... --server=..."
}

# =============================================================================
# LIST TOKENS
# =============================================================================

$ openctem-admin token list

ID                                    PREFIX        STATUS    USES    EXPIRES              DESCRIPTION
────────────────────────────────────────────────────────────────────────────────────────────────────────
a1b2c3d4-e5f6-7890-abcd-ef1234567890  rbt_7Hj9...   active    0/1     2024-01-26 10:00     -
b2c3d4e5-f6a7-8901-bcde-f12345678901  rbt_AbCd...   active    2/5     2024-01-27 10:00     US East scanners
c3d4e5f6-a7b8-9012-cdef-123456789012  rbt_XyZa...   used      1/1     2024-01-25 08:00     -
d4e5f6a7-b8c9-0123-def0-234567890123  rbt_QwEr...   revoked   0/1     2024-01-28 10:00     Revoked: security

# Filter by status
$ openctem-admin token list --status active

# =============================================================================
# GET TOKEN DETAILS
# =============================================================================

$ openctem-admin token get a1b2c3d4-e5f6-7890-abcd-ef1234567890

Token ID:              a1b2c3d4-e5f6-7890-abcd-ef1234567890
Prefix:                rbt_7Hj9...
Status:                active
Created:               2024-01-25 10:00:00 UTC
Expires:               2024-01-26 10:00:00 UTC (in 23 hours)
Uses:                  0 / 1
Required Capabilities: [sast, sca]
Required Tools:        [semgrep, trivy]
Expected Region:       us-east-1
Created By:            admin@example.com

Used By Agents:        (none)

# =============================================================================
# REVOKE TOKEN
# =============================================================================

$ openctem-admin token revoke a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
    --reason "No longer needed"

✓ Token revoked

# Force revoke without confirmation
$ openctem-admin token revoke <id> --force

# =============================================================================
# CLEANUP EXPIRED TOKENS
# =============================================================================

$ openctem-admin token cleanup

Found 15 expired tokens
✓ Deleted 15 expired tokens

# Dry run
$ openctem-admin token cleanup --dry-run
Would delete 15 expired tokens (dry run)
```

### 11.3 Agent Commands

```bash
# =============================================================================
# LIST AGENTS
# =============================================================================

$ openctem-admin agent list

ID          NAME                  STATUS    HEALTH    JOBS    REGION       LAST SEEN
─────────────────────────────────────────────────────────────────────────────────────
abc123...   scanner-us-east-01    active    online    3/10    us-east-1    2 min ago
def456...   scanner-us-east-02    active    online    5/10    us-east-1    1 min ago
ghi789...   scanner-eu-west-01    active    offline   0/10    eu-west-1    15 min ago
jkl012...   scanner-ap-01         disabled  offline   0/5     ap-south-1   2 hours ago

Total: 4 agents (2 online, 2 offline)

# Filter
$ openctem-admin agent list --status active --health online
$ openctem-admin agent list --region us-east-1

# =============================================================================
# GET AGENT DETAILS
# =============================================================================

$ openctem-admin agent get abc123

Agent ID:              abc123...
Name:                  scanner-us-east-01
Status:                active
Health:                online
Type:                  worker

Capabilities:          [sast, sca, secrets]
Tools:                 [semgrep, trivy, gitleaks]

Capacity:              3 / 10 jobs
CPU:                   45%
Memory:                60%

Network:
  Hostname:            scanner-us-east-01.internal
  IP Address:          10.0.1.50
  Region:              us-east-1

Version:               1.2.3
OS:                    linux/amd64
Joined:                2024-01-20 10:00:00 UTC
Last Seen:             2024-01-25 10:00:00 UTC (2 min ago)

API Key Prefix:        rda_p_xyz...

Statistics:
  Total Scans:         1,234
  Total Findings:      5,678
  Error Count:         12

# =============================================================================
# DISABLE/ENABLE AGENT
# =============================================================================

$ openctem-admin agent disable abc123 --reason "Maintenance"
✓ Agent abc123 disabled

$ openctem-admin agent enable abc123
✓ Agent abc123 enabled

# =============================================================================
# ROTATE API KEY
# =============================================================================

$ openctem-admin agent rotate-key abc123

⚠ This will invalidate the current API key immediately.
  The agent will need to be reconfigured with the new key.

Continue? [y/N] y

✓ API key rotated

New API Key:     rda_p_NewKeyHere123456789...
Agent must be reconfigured with this key.

# Force without confirmation
$ openctem-admin agent rotate-key abc123 --force

# =============================================================================
# DELETE AGENT
# =============================================================================

$ openctem-admin agent delete abc123

⚠ This will permanently delete the agent.
  Agent ID: abc123
  Name: scanner-us-east-01
  Active Jobs: 0

Continue? [y/N] y

✓ Agent deleted

# Cannot delete agent with active jobs
$ openctem-admin agent delete def456
✗ Error: Agent has 5 active jobs. Wait for jobs to complete or use --force.

$ openctem-admin agent delete def456 --force
⚠ Force deleting agent with active jobs. Jobs will be returned to queue.
✓ Agent deleted, 5 jobs returned to queue
```

### 11.4 Queue Commands

```bash
# =============================================================================
# QUEUE STATUS
# =============================================================================

$ openctem-admin queue status

Platform Agent Queue Status
═══════════════════════════════════════════════════════════════════

Agents:
  Total:               10
  Online:              8
  Capacity:            100 jobs
  Current Load:        45 jobs (45%)

Queue:
  Pending Jobs:        23
  Dispatched:          45
  Running:             42
  Failed (last 1h):    3

By Priority:
  Enterprise:          5 jobs (avg wait: 0s)
  Business:            8 jobs (avg wait: 30s)
  Team:                7 jobs (avg wait: 2m)
  Free:                3 jobs (avg wait: 15m)

# =============================================================================
# LIST QUEUED JOBS
# =============================================================================

$ openctem-admin queue list

ID          TENANT              TOOL      PRIORITY   QUEUED              WAIT TIME
────────────────────────────────────────────────────────────────────────────────────
cmd123...   Acme Corp           nuclei    175        2024-01-25 10:00    5m
cmd456...   Beta Inc            trivy     150        2024-01-25 09:55    10m
cmd789...   Startup LLC         semgrep   75         2024-01-25 09:30    35m

# Filter by tool, tenant, or priority
$ openctem-admin queue list --tool nuclei
$ openctem-admin queue list --min-wait 30m

# =============================================================================
# FLUSH STUCK JOBS
# =============================================================================

$ openctem-admin queue flush --stuck-for 2h

Found 5 jobs stuck for more than 2 hours:
  cmd111... - dispatched 3h ago, agent offline
  cmd222... - dispatched 2.5h ago, agent offline
  ...

Return to queue? [y/N] y

✓ 5 jobs returned to queue
```

### 11.5 CLI Configuration

```bash
# =============================================================================
# CONFIGURATION
# =============================================================================

# Set API server
$ openctem-admin config set-server https://api.openctem.io
✓ Server URL saved

# Set admin token (interactive)
$ openctem-admin config set-token
Enter admin API token: ********
✓ Token saved

# Set admin token (non-interactive)
$ openctem-admin config set-token --token "rat_admin_token_here"
✓ Token saved

# Or use environment variables
$ export OPENCTEM_ADMIN_SERVER=https://api.openctem.io
$ export OPENCTEM_ADMIN_TOKEN=rat_admin_token_here

# Show current config
$ openctem-admin config show
Server:     https://api.openctem.io
Token:      rat_abc... (configured)
Config Dir: ~/.config/openctem-admin/

# Config file location: ~/.config/openctem-admin/config.yaml
# config.yaml:
# server: https://api.openctem.io
# token: rat_admin_token_here
```

### 11.6 CLI Implementation Structure

```go
// cmd/openctem-admin/main.go
package main

import (
    "github.com/spf13/cobra"
    "github.com/openctemio/admin-cli/cmd/token"
    "github.com/openctemio/admin-cli/cmd/agent"
    "github.com/openctemio/admin-cli/cmd/queue"
    "github.com/openctemio/admin-cli/cmd/config"
)

func main() {
    rootCmd := &cobra.Command{
        Use:   "openctem-admin",
        Short: "OpenCTEM Platform Administration CLI",
    }

    rootCmd.AddCommand(
        token.NewTokenCmd(),
        agent.NewAgentCmd(),
        queue.NewQueueCmd(),
        config.NewConfigCmd(),
    )

    rootCmd.PersistentFlags().String("server", "", "API server URL")
    rootCmd.PersistentFlags().String("token", "", "Admin API token")
    rootCmd.PersistentFlags().StringP("output", "o", "table", "Output format (table, json, yaml)")

    if err := rootCmd.Execute(); err != nil {
        os.Exit(1)
    }
}

// cmd/openctem-admin/cmd/token/create.go
package token

func NewCreateCmd() *cobra.Command {
    cmd := &cobra.Command{
        Use:   "create",
        Short: "Create a new bootstrap token",
        RunE:  runCreate,
    }

    cmd.Flags().String("description", "", "Token description")
    cmd.Flags().Duration("expires", 24*time.Hour, "Token expiration time")
    cmd.Flags().Int("max-uses", 1, "Maximum number of uses")
    cmd.Flags().StringSlice("capabilities", nil, "Required capabilities")
    cmd.Flags().StringSlice("tools", nil, "Required tools")
    cmd.Flags().String("region", "", "Expected region")
    cmd.Flags().Bool("print-join-command", false, "Print only the join command")

    return cmd
}

func runCreate(cmd *cobra.Command, args []string) error {
    client := api.NewClient(getConfig())

    input := api.CreateTokenInput{
        Description:  cmd.Flag("description").Value.String(),
        ExpiresIn:    cmd.Flag("expires").Value.(time.Duration),
        MaxUses:      cmd.Flag("max-uses").Value.(int),
        Capabilities: cmd.Flag("capabilities").Value.([]string),
        Tools:        cmd.Flag("tools").Value.([]string),
        Region:       cmd.Flag("region").Value.String(),
    }

    result, err := client.CreateBootstrapToken(cmd.Context(), input)
    if err != nil {
        return err
    }

    if cmd.Flag("print-join-command").Changed {
        fmt.Println(result.JoinCommand)
        return nil
    }

    printTokenCreated(result, cmd.Flag("output").Value.String())
    return nil
}
```

### 11.7 CLI Distribution

```bash
# Installation options:

# 1. Binary download
$ curl -LO https://github.com/openctemio/openctem-admin/releases/latest/download/openctem-admin-linux-amd64
$ chmod +x openctem-admin-linux-amd64
$ sudo mv openctem-admin-linux-amd64 /usr/local/bin/openctem-admin

# 2. Homebrew (macOS/Linux)
$ brew install openctemio/tap/openctem-admin

# 3. Go install
$ go install github.com/openctemio/openctem-admin@latest

# 4. Docker
$ docker run --rm -it openctemio/admin-cli token create

# Verify installation
$ openctem-admin version
openctem-admin version 1.0.0 (commit: abc123, built: 2024-01-25)
```

---

## 12. Licensing & Limits (Auto-allocation Model)

### 9.1 Complete Limits Structure

```json
// plan_modules.limits for 'scans' module
// v3.1: Added queue management limits

// Free Plan
{
  "max_per_month": 10,
  "max_tenant_agents": 1,
  "platform_agent_access": true,
  "max_concurrent_platform_jobs": 1,    // 1 job running at a time
  "max_queued_platform_jobs": 10,       // Max 10 jobs in queue
  "queue_base_priority": 25             // Lowest priority
}

// Team Plan
{
  "max_per_month": 200,
  "max_tenant_agents": 5,
  "platform_agent_access": true,
  "max_concurrent_platform_jobs": 3,
  "max_queued_platform_jobs": 50,
  "queue_base_priority": 50
}

// Business Plan
{
  "max_per_month": 1000,
  "max_tenant_agents": 20,
  "platform_agent_access": true,
  "max_concurrent_platform_jobs": 10,
  "max_queued_platform_jobs": 200,
  "queue_base_priority": 75
}

// Enterprise Plan
{
  "max_per_month": -1,
  "max_tenant_agents": -1,
  "platform_agent_access": true,
  "max_concurrent_platform_jobs": 50,   // Soft limit, can request increase
  "max_queued_platform_jobs": 1000,
  "queue_base_priority": 100            // Highest priority
}

// Self-hosted Only Plan (no platform access)
{
  "max_per_month": 500,
  "max_tenant_agents": 10,
  "platform_agent_access": false,
  "max_concurrent_platform_jobs": 0,
  "max_queued_platform_jobs": 0,
  "queue_base_priority": 0
}
```

### 9.2 Limit Types Explained

| Limit | Type | Description |
|-------|------|-------------|
| `max_tenant_agents` | Count | Maximum tenant-owned agents |
| `platform_agent_access` | Boolean | Can use platform agents? |
| `max_concurrent_platform_jobs` | Concurrent | Max simultaneous running jobs |
| `max_queued_platform_jobs` | Count | Max jobs waiting in queue |
| `queue_base_priority` | Priority | Base priority for queue ordering |

**Key Differences from v2.0:**
- **v2.0**: `max_platform_agents` = count of assignable agents
- **v3.1**: `max_concurrent_platform_jobs` + `max_queued_platform_jobs` + `queue_base_priority`

**Benefits:**
1. **Simpler UX**: No agent assignment management
2. **Better utilization**: Platform scales agents transparently
3. **Fair scheduling**: Priority system with anti-starvation
4. **Predictable capacity**: Platform knows exact resource needs

### 9.3 Plan Features Matrix

| Feature | Free | Team | Business | Enterprise |
|---------|------|------|----------|------------|
| **Tenant Agents** | 1 | 5 | 20 | Unlimited |
| **Platform Access** | ✓ | ✓ | ✓ | ✓ |
| **Concurrent Jobs** | 1 | 3 | 10 | 50+ |
| **Queue Size** | 10 | 50 | 200 | 1000 |
| **Queue Priority** | Low | Medium | High | Highest |
| **Max Wait Time*** | ~75 min | ~50 min | ~25 min | ~0 min |
| **Scans/month** | 10 | 200 | 1,000 | Unlimited |
| **Regional Preference** | - | - | ✓ | ✓ |

*Max wait time under heavy load (worst case with age bonus)

---

## 13. UI Changes (Auto-allocation Model)

### 13.1 Agents Page - Simplified View

**Key difference**: Tenant only sees **aggregate status** of platform agents, not the detailed list.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Agents                                                          [+ Add]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  [My Agents]  [Platform Agents]                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════│
│  MY AGENTS (1/1)                                                            │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ 🟢 My Scanner                                                           ││
│  │ Type: worker | Tools: nuclei, trivy | Self-hosted                       ││
│  │                                                                         ││
│  │ [Configure] [Regenerate Key] [Delete]                                   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ 💡 Need more agents? Upgrade to Team plan for up to 5 agents.          ││
│  │    [View Plans]                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.2 Platform Agents Tab - Aggregate Status Only

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Agents                                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  [My Agents]  [Platform Agents]                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════════│
│  PLATFORM AGENTS STATUS                                                      │
│  ═══════════════════════════════════════════════════════════════════════════│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                                                                         ││
│  │  🟢 PLATFORM AVAILABLE                                                  ││
│  │                                                                         ││
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐                 ││
│  │  │   8 / 10      │ │   45%         │ │   2 / 3       │                 ││
│  │  │ Agents Online │ │ Current Load  │ │ Your Jobs     │                 ││
│  │  └───────────────┘ └───────────────┘ └───────────────┘                 ││
│  │                                                                         ││
│  │  Available Tools:                                                       ││
│  │  [semgrep] [trivy] [gitleaks] [nuclei] [nmap] [nikto]                  ││
│  │                                                                         ││
│  │  Available Regions:                                                     ││
│  │  [us-east-1] [eu-west-1] [ap-southeast-1]                              ││
│  │                                                                         ││
│  │  ───────────────────────────────────────────────────────────────────   ││
│  │                                                                         ││
│  │  Your Usage:                                                            ││
│  │  • Active jobs: 2 of 3 concurrent slots                                ││
│  │  • Available slots: 1                                                   ││
│  │                                                                         ││
│  │  ℹ️  Platform agents are automatically selected when you create a scan. ││
│  │      You don't need to manage individual agents.                        ││
│  │                                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ 💡 Need more concurrent jobs? Upgrade to Business plan for 10 slots.   ││
│  │    [View Plans]                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.3 Scan Configuration - Simplified Agent Selection

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Create New Scan                                                   [X]      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Target: https://example.com                                                 │
│  Tool: nuclei                                                                │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Select Agent Type:                                                          │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ ◉ Use Platform Agent                                    [RECOMMENDED]   ││
│  │   Managed by OpenCTEM • Auto-selected • No setup required                ││
│  │   Available slots: 1/3                                                  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ ○ Use My Agent                                                          ││
│  │   Select from your deployed agents                                      ││
│  │                                                                         ││
│  │   ┌─ Select Agent ─────────────────────────────────────────────────┐   ││
│  │   │ My Scanner                          🟢 Online                   │   ││
│  │   └─────────────────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Advanced (Platform Agent):                                                  │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Preferred Region: [Any ▼]                                                   │
│                    ├─ Any (fastest available)                               │
│                    ├─ us-east-1                                             │
│                    ├─ eu-west-1                                             │
│                    └─ ap-southeast-1                                        │
│                                                                              │
│                                              [Cancel]  [Create Scan]        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.4 Scan Details - Platform Agent Info

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Scan: Security Assessment #123                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Status: 🔄 Running                                                          │
│  Progress: ████████████░░░░░░░░ 60%                                         │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Agent Information:                                                          │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Type: 🏢 Platform Agent                                                     │
│  Region: us-east-1                                                           │
│  Started: 2024-01-25 10:30:00                                               │
│                                                                              │
│  Note: Platform agents are managed by OpenCTEM. Agent details are            │
│        not exposed for security and operational reasons.                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.5 No Platform Access State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PLATFORM AGENTS STATUS                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                                                                         ││
│  │  🔒 PLATFORM AGENTS NOT AVAILABLE                                       ││
│  │                                                                         ││
│  │  Your current plan does not include access to platform agents.          ││
│  │                                                                         ││
│  │  Platform agents allow you to run scans without deploying your own     ││
│  │  infrastructure. They are managed by OpenCTEM and automatically         ││
│  │  selected for optimal performance.                                      ││
│  │                                                                         ││
│  │  Benefits:                                                              ││
│  │  • No infrastructure to manage                                          ││
│  │  • Always up-to-date tools                                              ││
│  │  • Multi-region availability                                            ││
│  │  • Automatic load balancing                                             ││
│  │                                                                         ││
│  │                     [Upgrade to Team Plan]                              ││
│  │                                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 14. Migration Strategy

### 14.1 Phased Rollout

```
Phase 1: Database & Core (Week 1-2)
├── Create migration files
├── Deploy to staging
├── Run migration
├── Verify data integrity
└── Deploy domain layer changes

Phase 2: Platform Agent Auth (Week 2-3)
├── Implement job token service
├── Implement platform agent middleware
├── Create platform agent API endpoints
├── Integration testing
└── Security review

Phase 3: Assignment & Limits (Week 3-4)
├── Implement assignment service
├── Add limit enforcement
├── Update licensing service
├── E2E testing
└── Performance testing

Phase 4: UI & GA (Week 4-5)
├── Implement UI changes
├── User acceptance testing
├── Documentation
├── Deploy to production
└── Monitor & iterate
```

### 14.2 Backwards Compatibility

| Component | Compatibility |
|-----------|---------------|
| Existing tenant agents | 100% compatible, no changes |
| Existing API endpoints | No breaking changes |
| Agent SDK | No changes required |
| Database | Additive changes only |

---

## 15. Implementation Phases (Auto-allocation Model)

### Phase 1: Database Schema
**Duration:** 2-3 days

- [ ] Create migration `000XXX_add_platform_agents.up.sql`
  - [ ] Add `is_platform_agent` column to agents table
  - [ ] Add command token fields to commands table
  - [ ] Create system tenant for platform agents
  - [ ] Update plan_modules limits structure
  - [ ] Create helper functions for auto-selection
- [ ] Create rollback `000XXX_add_platform_agents.down.sql`
- [ ] Test migration on staging database
- [ ] Update seed data with sample platform agents

### Phase 2: Domain Layer
**Duration:** 2-3 days

- [ ] Update `Agent` entity with `IsPlatformAgent` field
- [ ] Add `PlatformAgentStats` struct
- [ ] Add `PlatformAgentSelectionRequest` struct
- [ ] Update `Command` entity with auth token fields
- [ ] Create `command.GenerateAuthToken()` and `VerifyAuthToken()` functions
- [ ] Update repository interfaces
- [ ] Unit tests for domain entities

### Phase 3: Infrastructure Layer
**Duration:** 3-4 days

- [ ] Implement `AgentRepository.SelectBestPlatformAgent()` (load balancing)
- [ ] Implement `AgentRepository.GetPlatformAgentStats()`
- [ ] Implement `AgentRepository.ListPlatformAgents()`
- [ ] Implement `CommandRepository.GetByAuthTokenHash()`
- [ ] Implement `CommandRepository.CountActivePlatformJobsByTenant()`
- [ ] Update `AgentRepository.CountByTenant()` to exclude platform agents
- [ ] Integration tests for repositories

### Phase 4: Queue Management (v3.1)
**Duration:** 3-4 days

- [ ] Add queue-related fields to commands table (is_platform_job, queue_priority, queued_at)
- [ ] Create queue indexes for efficient polling
- [ ] Implement `calculate_queue_priority()` function
- [ ] Implement `QueueService.EnqueuePlatformJob()`
- [ ] Implement `QueueService.DispatchNextJob()` with FOR UPDATE SKIP LOCKED
- [ ] Implement priority update scheduler (cron every minute)
- [ ] Implement `RecoverStuckJobs()` for agent failure handling
- [ ] Implement `ExpireOldJobs()` for queue cleanup
- [ ] Queue service tests

### Phase 5: Service Layer
**Duration:** 3-4 days

- [ ] Update `AgentService.CreateAgent()` with tenant agent limit checks
- [ ] Implement `AgentService.SelectPlatformAgentForJob()` (auto-selection)
- [ ] Implement `AgentService.GetPlatformAgentStatus()` (aggregate view)
- [ ] Implement `AgentService.AuthenticatePlatformAgent()`
- [ ] Update `CommandService` with token generation and verification
- [ ] Update `ScanService` to support `use_platform_agent` option
- [ ] Update `LicensingService` with new limit types (queue limits)
- [ ] Service layer tests

### Phase 6: API Layer
**Duration:** 3-4 days

- [ ] Create `PlatformAgentHandler` with `/platform-agents/status` endpoint
- [ ] Implement platform agent authentication middleware
- [ ] Update `ScanHandler` to support platform agent selection
- [ ] Create `/platform-agent/*` routes for platform agent operations
- [ ] Add queue status to status endpoint
- [ ] API documentation (OpenAPI)
- [ ] API integration tests

### Phase 7: UI Implementation
**Duration:** 4-5 days

- [ ] Update agents list page with "Platform Agents" tab (aggregate view)
- [ ] Create platform status dashboard component
- [ ] Update scan configuration with "Use Platform Agent" option
- [ ] Add regional preference selector
- [ ] Add concurrent job limit indicators
- [ ] Add queue position indicator for pending jobs
- [ ] UI/UX testing

### Phase 8: Testing & Documentation
**Duration:** 2-3 days

- [ ] End-to-end testing (full scan flow with platform agent)
- [ ] Load testing (auto-selection under concurrent load)
- [ ] Queue priority testing (verify fair scheduling)
- [ ] Failure recovery testing (agent offline → job recovery)
- [ ] Security testing (token validation, tenant isolation)
- [ ] Update user documentation
- [ ] Update API documentation

### Total Estimated Duration: 4-5 weeks

---

## 16. Testing Strategy (Auto-allocation + Queue Management)

### 16.1 Unit Tests

```go
// Command Token tests
func TestGenerateAuthToken(t *testing.T)
func TestVerifyAuthToken(t *testing.T)
func TestCommand_IsAuthTokenValid(t *testing.T)
func TestCommand_CanAcceptIngest(t *testing.T)

// Agent Service tests
func TestAgentService_CreateAgent_LimitEnforced(t *testing.T)
func TestAgentService_AuthenticatePlatformAgent(t *testing.T)
func TestAgentService_SelectPlatformAgentForJob(t *testing.T)
func TestAgentService_SelectPlatformAgentForJob_ConcurrentLimitEnforced(t *testing.T)
func TestAgentService_SelectPlatformAgentForJob_NoPlatformAccess(t *testing.T)
func TestAgentService_GetPlatformAgentStatus(t *testing.T)

// Queue Service tests
func TestQueueService_EnqueuePlatformJob(t *testing.T)
func TestQueueService_EnqueuePlatformJob_QueueSizeLimitEnforced(t *testing.T)
func TestQueueService_DispatchNextJob(t *testing.T)
func TestQueueService_DispatchNextJob_RespectsConncurrentLimit(t *testing.T)
func TestCalculateQueuePriority(t *testing.T)
func TestCalculateQueuePriority_AgeBonus(t *testing.T)
func TestCalculateQueuePriority_MaxAgeBonus(t *testing.T)

// Auto-selection algorithm tests
func TestSelectBestPlatformAgent_CapabilityMatching(t *testing.T)
func TestSelectBestPlatformAgent_ToolMatching(t *testing.T)
func TestSelectBestPlatformAgent_RegionPreference(t *testing.T)
func TestSelectBestPlatformAgent_LoadBalancing(t *testing.T)
func TestSelectBestPlatformAgent_NoAvailableAgent(t *testing.T)
```

### 16.2 Integration Tests

```go
// Platform agent flow
func TestPlatformAgentFlow_AutoSelection(t *testing.T)
func TestPlatformAgentFlow_Commands(t *testing.T)
func TestPlatformAgentFlow_Ingest(t *testing.T)
func TestPlatformAgentFlow_CommandTokenExpiry(t *testing.T)

// Concurrent limit tests
func TestPlatformAgent_ConcurrentLimitEnforcement(t *testing.T)
func TestPlatformAgent_ConcurrentLimitReleasedAfterCompletion(t *testing.T)

// Queue tests
func TestQueue_FairScheduling_EnterprisePriority(t *testing.T)
func TestQueue_FairScheduling_AgeBonusPreventsStarvation(t *testing.T)
func TestQueue_QueueSizeLimit_RejectsWhenFull(t *testing.T)
func TestQueue_RecoverStuckJobs_AgentOffline(t *testing.T)
func TestQueue_ExpireOldJobs(t *testing.T)

// Load balancing tests
func TestPlatformAgent_LoadBalancing_EvenDistribution(t *testing.T)
func TestPlatformAgent_LoadBalancing_SkipsFullAgents(t *testing.T)

// Multi-tenant isolation
func TestPlatformAgent_TenantIsolation(t *testing.T)
func TestCommandToken_CannotUseAcrossAgents(t *testing.T)
func TestCommandToken_CannotUseAcrossTenants(t *testing.T)
```

### 16.3 Security Tests

- [ ] Command token cannot be used after command completes
- [ ] Command token cannot be used with different agent
- [ ] Command token cannot be used for different tenant's command
- [ ] Platform agent API key cannot access tenant-specific endpoints
- [ ] Tenant cannot access other tenant's data via platform agent
- [ ] Expired tokens are rejected
- [ ] Tokens with invalid signatures are rejected
- [ ] Timing-safe token comparison prevents timing attacks
- [ ] Queue manipulation not possible (can't change own priority)

### 16.4 Load Tests

```go
// Verify auto-selection works under load
func TestPlatformAgent_ConcurrentAutoSelection(t *testing.T)
func TestPlatformAgent_HighThroughputIngest(t *testing.T)
func TestPlatformAgent_FairDistributionUnderLoad(t *testing.T)

// Queue under load
func TestQueue_HighConcurrency_NoRaceConditions(t *testing.T)
func TestQueue_ManyTenants_FairDistribution(t *testing.T)
func TestQueue_PriorityUpdateScheduler_Performance(t *testing.T)
```

---

## 17. Monitoring & Operations

### 17.1 Metrics

| Metric | Description |
|--------|-------------|
| **Agent Metrics** | |
| `platform_agents_total` | Total platform agents |
| `platform_agents_online` | Currently online platform agents |
| `platform_agents_capacity` | Total concurrent job capacity |
| `platform_agents_load_percent` | Current load percentage |
| **Queue Metrics** | |
| `platform_queue_depth` | Total jobs in queue |
| `platform_queue_depth_by_plan{plan}` | Queue depth by plan tier |
| `platform_queue_wait_seconds` | Histogram of queue wait times |
| `platform_queue_wait_p99` | 99th percentile wait time |
| **Job Metrics** | |
| `platform_jobs_dispatched_total` | Jobs dispatched to agents |
| `platform_jobs_completed_total` | Jobs completed successfully |
| `platform_jobs_failed_total` | Jobs failed |
| `platform_jobs_expired_total` | Jobs expired in queue |
| `platform_jobs_recovered_total` | Jobs recovered from failed agents |
| **Token Metrics** | |
| `command_tokens_created_total` | Tokens created |
| `command_tokens_rejected_total` | Tokens rejected (invalid/expired) |

### 17.2 Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| Platform agent offline | Health != online for > 5min | Warning |
| High queue depth | queue_depth > 100 for > 5min | Warning |
| Long queue wait | wait_p99 > 30min | Warning |
| All agents at capacity | load_percent > 90% for > 10min | Critical |
| High job failure rate | failed / completed > 10% in 15min | Warning |
| Token abuse attempt | Agent mismatch detected | Critical |
| Jobs stuck in queue | pending jobs > 1h without progress | Critical |

### 17.3 Operational Procedures

**Adding a new platform agent:**
```bash
# 1. Create agent via admin API
curl -X POST /admin/api/v1/platform-agents \
  -d '{"name": "Scanner 05", "tools": ["nuclei"], "max_concurrent_jobs": 10}'

# 2. Configure agent on infrastructure
# 3. Start agent with API key
# 4. Verify health and that it's pulling jobs
```

**Removing a platform agent:**
```bash
# 1. Disable agent (stop accepting new jobs)
curl -X PUT /admin/api/v1/platform-agents/{id}/disable

# 2. Wait for active jobs to complete (monitor via dashboard)
# 3. Jobs in queue will be picked up by other agents automatically
# 4. Delete agent once idle
curl -X DELETE /admin/api/v1/platform-agents/{id}
```

**Handling high queue depth:**
```bash
# 1. Check current capacity
curl /admin/api/v1/platform-agents/stats

# 2. Option A: Add more agents
# 3. Option B: Increase max_concurrent_jobs on existing agents
# 4. Option C: Temporary rate limit for lower-tier plans
```

---

## 18. Design Decisions

### 18.1 Why Auto-allocation Instead of Explicit Assignment? (v3.0)

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Explicit Assignment (v2.0)** | Tenant control, predictable | Complex UX, poor resource utilization, tenant must manage agents | ❌ |
| **Auto-allocation (v3.0)** | Simple UX, better utilization, transparent scaling | Less control for tenant | ✅ Chosen |

**Rationale**:
1. **Simpler UX**: Tenant doesn't need to know about specific platform agents
2. **Better resource utilization**: Platform can distribute jobs evenly
3. **Transparent scaling**: Platform can add/remove agents without affecting tenant
4. **Load balancing**: Automatic load balancing prevents hotspots
5. **Regional optimization**: Platform can select the agent closest to the target

**What Tenant Sees:**
- Aggregate status: "8/10 agents online, 45% load"
- Their usage: "2/3 concurrent jobs used"
- Available capabilities: "SAST, SCA, DAST available"

**What Tenant Does NOT See:**
- Individual agent IDs
- Agent names
- Agent internal metrics
- Which agent is running their job (just "Platform Agent")

### 18.2 Why Global Queue with Pull Model? (v3.1)

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Pre-assign to agents** | Predictable routing | Unbalanced load, job migration needed | ❌ |
| **Push to least-loaded** | Central control | Single point of failure, complex | ❌ |
| **Global queue + Pull** | Natural load balancing, no migration | Slightly higher latency | ✅ Chosen |

**Rationale**:
1. **Natural load balancing**: Busy agents pull less frequently
2. **No job migration**: Jobs never stuck on specific agent
3. **Horizontal scaling**: Add agents = instant capacity increase
4. **Failure resilience**: Agent failure = jobs return to queue
5. **Simple architecture**: No complex orchestrator needed

### 18.3 Why Weighted Fair Queuing with Age Bonus?

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Simple FIFO** | Fair by time | No plan differentiation | ❌ |
| **Strict priority** | Clear plan benefits | Starvation of lower tiers | ❌ |
| **Weighted + Age bonus** | Prioritizes paid, prevents starvation | Slightly complex | ✅ Chosen |

**Rationale**:
- Enterprise gets faster processing (higher base priority)
- Free tier guaranteed processing within ~75 minutes (age bonus)
- Predictable worst-case wait times for capacity planning
- Upsell opportunity: "Upgrade for faster queue priority"

### 18.4 Why Concurrent Limit Instead of Assignment Count?

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **max_platform_agents (count)** | Simple to understand | Poor utilization, tenant may not use all assigned | ❌ |
| **max_concurrent_platform_jobs** | Fair sharing, better utilization | Tenant can't reserve agents | ✅ Chosen |

**Rationale**: Concurrent limits allow all tenants to access all platform agents within their concurrent job limit. This provides:
- **Fairer sharing**: Tenant A's 3 idle assignments don't block Tenant B
- **Better planning**: Platform knows exact concurrent capacity needed
- **Simpler billing**: Pay for concurrent usage, not reserved resources

### 18.5 Why Command Token Instead of Separate Job Token Table?

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Separate job_tokens table** | Clear separation, explicit lifecycle | Extra table, cleanup needed, more queries | ❌ |
| **Token in commands table** | 1:1 mapping, no cleanup, simpler | Coupled to command | ✅ Chosen |

**Rationale**: Since each command maps to exactly one token, embedding the token in the command table eliminates the need for a separate table and simplifies the data model.

### 18.6 Why Multi-use Token Instead of Single-use?

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Single-use** | Maximum security | Breaks multi-ingest flows | ❌ |
| **Multi-use until command done** | Supports real scan flows | Slightly wider window | ✅ Chosen |

**Rationale**: Real scans often need multiple ingest calls (findings, assets, logs). Single-use tokens would require generating a new token for each ingest call, adding significant complexity.

### 18.7 Why API Key + Token Instead of Just Token?

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Token only** | Simpler | Token leak = full impersonation | ❌ |
| **API Key only** | Simpler | Can't identify tenant context | ❌ |
| **API Key + Token** | Defense in depth | More complexity | ✅ Chosen |

**Rationale**: Defense in depth. API key proves agent identity, token proves job authorization. If one is compromised, the other provides protection.

### 18.8 Why System Tenant for Platform Agents?

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **NULL tenant_id** | Simple | Foreign key issues, NULL handling | ❌ |
| **Flag only** | Simple | Unclear ownership | ❌ |
| **System tenant** | Clear ownership, same model | Need to manage system tenant | ✅ Chosen |

**Rationale**: Using a system tenant allows platform agents to follow the same ownership model as tenant agents, simplifying queries and maintaining referential integrity.

### 18.9 Industry Comparison

| System | Pattern | Our Equivalent |
|--------|---------|----------------|
| **HashiCorp Vault AppRole** | role_id + secret_id | API Key + Command Token |
| **AWS STS** | IAM credentials + session token | Similar concept |
| **GitHub Actions OIDC** | JWT with job context | Command contains tenant context |
| **Kubernetes** | ServiceAccount + namespace | Agent + command binding |
| **AWS Lambda** | Auto-provisioned workers | Auto-allocated platform agents |
| **GitHub Actions runners** | Shared pool, job-level isolation | Similar architecture |
| **AWS SQS** | Queue with visibility timeout | Global queue with dispatch lock |
| **Celery** | Task queue with worker pool | Similar pull-based model |
| **Kubernetes kubeadm** | Bootstrap token for node join | Bootstrap token for agent join (v3.2) |
| **Redis Sentinel** | Heartbeat TTL for liveness | Agent heartbeat with TTL (v3.2) |

Our approach aligns with industry best practices for managed compute resources and job queuing systems.

### 18.10 Why Redis Instead of etcd for Agent State? (v3.2)

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **PostgreSQL only** | Simple, one DB | Not ideal for ephemeral state, high polling load | ❌ |
| **etcd** | Strong consistency, K8s-native | Overkill for our scale, operational complexity | ❌ |
| **Redis** | Fast, TTL support, Pub/Sub, familiar | Additional component | ✅ Chosen |

**Rationale**:
1. **TTL-based heartbeat**: Redis SETEX is perfect for heartbeat with auto-expiry
2. **Pub/Sub for job notifications**: Efficient push-based notifications
3. **Distributed locks**: SETNX for job dispatch locking
4. **Operational simplicity**: Most teams already use Redis
5. **Sufficient consistency**: Agent state is ephemeral, eventual consistency is acceptable
6. **PostgreSQL remains source of truth**: Durable state stays in PostgreSQL

**What goes where:**

| Data Type | Storage | Rationale |
|-----------|---------|-----------|
| Agent registration | PostgreSQL | Durable, audit trail |
| Agent heartbeat (online status) | Redis | Ephemeral, TTL-based |
| Agent capacity/metrics | Redis | Real-time, frequent updates |
| Job dispatch lock | Redis | Short-lived distributed lock |
| Job queue | PostgreSQL | Durable, needs transactions |
| Bootstrap tokens | PostgreSQL | Audit, security |

### 18.11 Why Bootstrap Token for Agent Join? (v3.2)

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Manual API key in agent config** | Simple | No self-registration, key exposure | ❌ |
| **Pre-shared secret** | Simple | Key rotation difficult | ❌ |
| **Bootstrap Token (kubeadm-style)** | Secure, time-limited, auditable | Slightly more complex | ✅ Chosen |

**Rationale**:
1. **Short-lived**: Tokens expire after 24-48h (configurable)
2. **Usage limits**: Tokens have max_uses (e.g., 5 agents per token)
3. **Self-registration**: Agent can self-register with just the token
4. **Audit trail**: All token usage is logged
5. **Capability constraints**: Token can restrict which capabilities agent gets
6. **Industry proven**: Same pattern used by Kubernetes kubeadm

**Join Flow:**
```
Admin creates token → Agent uses token → API validates → Agent gets API key → Token usage incremented
```

**CLI vs API:**
- CLI for infra automation (Terraform, Ansible)
- API for custom tooling, dashboards
- Both use same underlying service

---

## Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| **Tenant Agent** | Agent deployed and managed by a tenant |
| **Platform Agent** | Agent deployed and managed by OpenCTEM (auto-allocated) |
| **Command Token** | Short-lived token embedded in command for platform agent auth |
| **Auto-allocation** | Platform automatically selects best agent for each job |
| **Global Queue** | Centralized job queue; agents pull work from this queue |
| **Concurrent Limit** | Maximum simultaneous jobs a tenant can run on platform agents |
| **Queue Size Limit** | Maximum jobs a tenant can have waiting in queue |
| **Queue Priority** | Score determining job processing order (plan base + age bonus) |
| **Age Bonus** | Priority increase based on time waiting (+1/min, max +75) |
| **System Tenant** | Special tenant (UUID: `00000000-0000-0000-0000-000000000001`) that owns all platform agents |
| **Load Factor** | current_jobs / max_concurrent_jobs ratio for an agent |
| **Pull Model** | Agents request work from queue (vs push model) |
| **Dispatch** | Assigning a queued job to a specific agent |
| **Bootstrap Token** | Short-lived, limited-use token for platform agent self-registration (v3.2) |
| **Agent Join** | Process where a platform agent registers itself using a bootstrap token (v3.2) |
| **openctem-admin** | CLI tool for platform administrators to manage tokens, agents, and queues (v3.2) |
| **Heartbeat TTL** | Redis key with automatic expiry (30s) for agent liveness detection (v3.2) |
| **Job Dispatch Lock** | Redis SETNX lock preventing multiple agents from claiming same job (v3.2) |

### B. Open Questions

1. **Billing**: Should platform agent usage be metered separately?
   - Option A: Included in plan (current approach)
   - Option B: Pay per job/minute on platform agents
2. **SLA**: What SLA do we guarantee for platform agents?
   - Uptime guarantee: 99.9%?
   - Max queue wait time guarantee per plan tier?
3. **Capacity planning**: How to determine platform agent pool size?
   - Based on sum of all tenants' concurrent limits?
   - Target utilization: 60-70%?
   - Reserve capacity for burst?

### C. Resolved Questions (v3.1)

| Question | Resolution |
|----------|------------|
| Priority Queue? | ✅ Implemented: Weighted Fair Queuing with plan-based priority |
| Failover? | ✅ Implemented: Auto-retry on different agent (max 3 retries) |
| Load balancing? | ✅ Implemented: Global queue + pull model = natural load balancing |
| Starvation prevention? | ✅ Implemented: Age bonus ensures max ~75 min wait |

### D. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-25 | Initial draft with separate job_tokens table |
| 2.0 | 2025-01-25 | Embedded token in commands table, multi-use tokens |
| 3.0 | 2025-01-25 | Auto-allocation model: removed explicit assignment, added concurrent limits |
| 3.1 | 2025-01-25 | **Queue Management**: global queue, priority scheduling, fair queuing with age bonus, failure recovery |
| 3.2 | 2025-01-25 | **Agent State & Join**: Redis state management, Bootstrap Token join mechanism, Admin CLI (openctem-admin) |

### E. References

- [Scan Flow Documentation](./scan-flow.md)
- [Authentication Architecture](./authentication.md)
- [Licensing System](./licensing.md)
- [HashiCorp Vault AppRole](https://www.vaultproject.io/docs/auth/approle)
- [AWS Lambda Execution Model](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html)
- [GitHub Actions Runners](https://docs.github.com/en/actions/using-github-hosted-runners)
- [AWS SQS Visibility Timeout](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html)
- [Celery Task Queue](https://docs.celeryproject.org/en/stable/userguide/tasks.html)

---

## Implementation Todo List

> Generated: 2025-01-25 | Updated: 2025-01-24 | Total: 31 tasks | Completed: 7 | Estimated: 4-5 weeks

### Phase 1: Database Schema (3 tasks) ✅ COMPLETED

- [x] **Task #1**: Create database migration for platform agents
  - ✅ Migration `000080_add_platform_agents.up.sql`
  - ✅ Add `is_platform_agent` column to agents table
  - ✅ Add command token fields (auth_token_hash, auth_token_expires_at, platform_agent_id)
  - ✅ Create system tenant (UUID: 00000000-0000-0000-0000-000000000001)
  - ✅ Add queue fields (is_platform_job, queue_priority, queued_at, dispatch_attempts)
  - ✅ Create indexes and helper functions (calculate_queue_priority, get_next_platform_job, etc.)
  - ✅ Add platform_agents module with plan-specific limits
  - ✅ Add permissions (platform_agents:use, platform_agents:status:read)

- [x] **Task #2**: Create bootstrap token table migration
  - ✅ Migration `000081_add_bootstrap_tokens.up.sql`
  - ✅ Table `platform_agent_bootstrap_tokens`
  - ✅ Table `platform_agent_registrations` (audit log)
  - ✅ Fields: token_hash, expires_at, max_uses, current_uses, required_capabilities, etc.
  - ✅ Helper functions: use_bootstrap_token(), cleanup_expired_bootstrap_tokens()
  - ✅ Permission: platform_agents:tokens:manage

- [x] **Task #3**: Update seed data with sample platform agents
  - ✅ File: `migrations/seed/seed_platform_agents.sql`
  - ✅ 5 sample platform agents (4 online, 1 offline)
  - ✅ 5 sample bootstrap tokens (active, expired, exhausted, revoked)
  - ✅ System tenant, regional distribution (us-east-1, eu-west-1, ap-southeast-1)

### Phase 2: Domain Layer (4 tasks) ✅ COMPLETED

- [x] **Task #4**: Update Agent domain entity for platform agents
  - ✅ File: `internal/domain/agent/entity.go`
  - ✅ Added `PlatformAgentStats` struct with aggregate statistics
  - ✅ Added `PlatformAgentSelectionRequest` and `PlatformAgentSelectionResult` structs
  - ✅ Added `CanExecutePlatformJob()`, `ScoreForJob()` methods

- [x] **Task #5**: Update Command domain entity with auth token
  - ✅ File: `internal/domain/command/entity.go`
  - ✅ Added platform job fields: `IsPlatformJob`, `PlatformAgentID`
  - ✅ Added auth token fields: `AuthTokenHash`, `AuthTokenPrefix`, `AuthTokenExpiresAt`
  - ✅ Added queue fields: `QueuePriority`, `QueuedAt`, `DispatchAttempts`, `LastDispatchAt`
  - ✅ Added `GenerateAuthToken()`, `VerifyAuthToken()`, `IsAuthTokenValid()` methods
  - ✅ Added `SetPlatformJob()`, `AssignToPlatformAgent()`, `ReturnToQueue()` methods
  - ✅ Added `QueuePosition` struct

- [x] **Task #6**: Create BootstrapToken domain entity
  - ✅ File: `internal/domain/agent/bootstrap_token.go`
  - ✅ `BootstrapToken` entity with status, expiry, usage limits, constraints
  - ✅ `AgentRegistration` entity for audit log
  - ✅ Token generation, verification, validation methods
  - ✅ Constraint validation: capabilities, tools, region

- [x] **Task #7**: Update repository interfaces
  - ✅ File: `internal/domain/agent/repository.go`
    - Added `IsPlatformAgent` to Filter
    - Added platform agent methods: `ListPlatformAgents`, `GetPlatformAgentStats`, `SelectBestPlatformAgent`
    - Added `BootstrapTokenRepository` interface
    - Added `AgentRegistrationRepository` interface
  - ✅ File: `internal/domain/command/repository.go`
    - Added `IsPlatformJob`, `PlatformAgentID` to Filter
    - Added queue methods: `GetByAuthTokenHash`, `CountActivePlatformJobsByTenant`, `GetQueuedPlatformJobs`
    - Added `GetNextPlatformJob`, `UpdateQueuePriorities`, `RecoverStuckJobs`
  - ✅ File: `internal/domain/agent/errors.go` (new)
    - Platform agent errors: `ErrNoPlatformAgentAvailable`, `ErrPlatformConcurrentLimitReached`
    - Bootstrap token errors: `ErrBootstrapTokenExpired`, `ErrBootstrapTokenRevoked`
    - Auth token errors: `ErrInvalidAuthToken`, `ErrAuthTokenExpired`

### Phase 3: Infrastructure Layer (4 tasks)

- [ ] **Task #8**: Implement AgentRepository platform agent methods
  - Blocked by: #4, #7
  - SelectBestPlatformAgent(), GetPlatformAgentStats(), ListPlatformAgents()

- [ ] **Task #9**: Implement CommandRepository queue methods
  - Blocked by: #5, #7
  - GetByAuthTokenHash(), CountActivePlatformJobsByTenant(), GetQueuedPlatformJobs()

- [ ] **Task #10**: Implement BootstrapTokenRepository
  - Blocked by: #6
  - Create, GetByTokenHash, IncrementUses, CleanupExpired

- [ ] **Task #11**: Implement Redis agent state management
  - Heartbeat TTL, online agents SET, capacity HASH, job dispatch lock

### Phase 4: Queue Management (2 tasks)

- [ ] **Task #12**: Implement QueueService for platform jobs
  - Blocked by: #9
  - EnqueuePlatformJob(), DispatchNextJob(), UpdatePriorities()

- [ ] **Task #13**: Implement queue failure recovery
  - Blocked by: #12
  - RecoverStuckJobs(), ExpireOldJobs(), HandleAgentOffline()

### Phase 5: Service Layer (4 tasks)

- [ ] **Task #14**: Update AgentService for platform agents
  - Blocked by: #8, #12
  - SelectPlatformAgentForJob(), GetPlatformAgentStatus(), AuthenticatePlatformAgent()

- [ ] **Task #15**: Create BootstrapTokenService
  - Blocked by: #10
  - CreateToken(), ValidateAndUseToken(), RegisterAgentWithToken()

- [ ] **Task #16**: Update LicensingService with platform limits
  - GetPlatformAgentLimits(), CheckPlatformConcurrentLimit(), HasPlatformAgentAccess()

- [ ] **Task #17**: Update CommandService with token management
  - CreateCommandForPlatformAgent(), GetCommandByAuthToken(), VerifyCommandAccess()

### Phase 6: API Layer (5 tasks)

- [ ] **Task #18**: Create PlatformAgentHandler API endpoints
  - Blocked by: #14, #16
  - GET /api/v1/platform-agents/status
  - Admin endpoints for platform agent management

- [ ] **Task #19**: Create BootstrapTokenHandler API endpoints
  - Blocked by: #15
  - POST /admin/api/v1/bootstrap-tokens
  - POST /api/v1/platform-agents/join

- [ ] **Task #20**: Implement platform agent authentication middleware
  - PlatformAgentAuth(), RequirePlatformAgent()

- [ ] **Task #21**: Update ScanHandler for platform agent selection
  - Add use_platform_agent option, queue position response

- [ ] **Task #22**: Create Admin CLI (openctem-admin)
  - token create/list/revoke, agent list/disable/enable, queue status

### Phase 7: UI Implementation (5 tasks)

- [ ] **Task #23**: Update Agents page with Platform Agents tab
  - Aggregate status view, usage indicators

- [ ] **Task #24**: Create Platform Status Dashboard component
  - PlatformStatusCard, QueuePositionIndicator, ConcurrentLimitBar

- [ ] **Task #25**: Update Scan Configuration for platform agent option
  - Radio selection, regional preference dropdown

- [ ] **Task #26**: Update Scan Details page for platform jobs
  - Queue status, "Platform Agent" badge, region display

- [ ] **Task #27**: Add queue position and concurrent limit indicators
  - Header indicator, scan list badges, notification toasts

### Phase 8: Testing & Documentation (4 tasks)

- [ ] **Task #28**: End-to-end testing for platform agent flow
  - Happy path, limit enforcement, failure recovery

- [ ] **Task #29**: Security testing for platform agents
  - Token security, tenant isolation, bootstrap token security

- [ ] **Task #30**: Load testing for queue and auto-selection
  - Concurrent selection, queue under load, throughput

- [ ] **Task #31**: Update documentation
  - API docs, user guides, admin guides, architecture docs

---

### Task Dependency Graph

```
Phase 1 (Database)
├── #1 Migration ─────────┬──► #4 Agent Entity ──────┬──► #8 AgentRepo ────┬──► #14 AgentService ──┬──► #18 PlatformHandler
├── #2 Bootstrap Token ───┼──► #5 Command Entity ────┼──► #9 CommandRepo ──┼──► #12 QueueService ──┤
│                         │                          │                     │                       │
│                         └──► #6 BootstrapToken ────┴──► #10 TokenRepo ───┴──► #15 TokenService ──┴──► #19 TokenHandler
└── #3 Seed Data
                                                     └──► #11 Redis State

Phase 4-5 (Services)
#12 QueueService ──► #13 FailureRecovery
#14 AgentService ──► #18 PlatformHandler
#15 TokenService ──► #19 TokenHandler
#16 LicensingService (parallel)
#17 CommandService (parallel)

Phase 6 (API)
#18-22 (can be parallelized after service layer)

Phase 7 (UI)
#23-27 (can be parallelized, depends on API)

Phase 8 (Testing)
#28-31 (after all implementation)
```

---

**Document Version:** 3.2 (Auto-allocation + Queue Management + Agent Join)
**Last Updated:** 2025-01-25
**Next Review:** 2025-02-01
