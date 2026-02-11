# Tiered Platform Agents Implementation Plan

**Status:** 🚧 In Progress (Backend Complete, Frontend Pending)
**Created:** 2026-01-26
**Author:** Architecture Team
**Phase 1-6:** ✅ Completed (Migration, Domain, Services, Repository, API)
**Phase 7-8:** ❌ Not Started (Frontend)
**Phase 9:** 🔄 Partial (Testing)

---

## Executive Summary

Implement a tiered platform agent system that provides resource isolation and premium agent pools based on tenant subscription plans. This enables:

1. **Resource Isolation** - Enterprise tenants don't share queue with Free users
2. **Premium Agent Pools** - Higher-tier plans get access to better/faster agents
3. **Upsell Opportunity** - Clear value proposition for plan upgrades
4. **Per-tenant Customization** - Override limits for special customers

---

## Current State Analysis

### What Already Exists

| Component | Status | Details |
|-----------|--------|---------|
| `platform_agents` module | ✅ Ready | Migration 000080 created module with tier limits |
| Plan-based job priority | ✅ Ready | `priority_base`: Free=25, Team=50, Business=75, Enterprise=100 |
| `max_concurrent_jobs` limit | ✅ Ready | Per-plan limits in `plan_modules.limits` |
| `limits_override` | ✅ Ready | Per-tenant customization supported |
| LicensingService methods | ✅ Ready | `TenantHasModule`, `GetTenantModuleLimit` |
| Agent `Labels` field | ✅ Ready | Can be used for tier tagging |

### What's Missing

| Gap | Impact | Solution |
|-----|--------|----------|
| Agent tier field | ❌ Critical | Add `tier` column to agents table |
| Tier-aware agent selection | ❌ Critical | Update `SelectBestPlatformAgent()` to filter by tier |
| AgentSelector uses deprecated plan | ❌ Critical | Integrate with LicensingService |
| Tier-to-plan mapping | ❌ Medium | Define which tiers each plan can access |
| UI tier display | ❌ Low | Show tier info in subscription settings |

---

## Architecture Design

### Tier Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PLATFORM AGENT TIERS                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   TIER 3: PREMIUM (priority=100)                                     │
│   ├── Dedicated high-performance agents                              │
│   ├── Lowest latency, fastest execution                              │
│   ├── Access: Enterprise only                                        │
│   └── Agents: agent-premium-1, agent-premium-2, ...                  │
│                                                                      │
│   TIER 2: DEDICATED (priority=50)                                    │
│   ├── Standard dedicated agents                                      │
│   ├── Faster than shared, less queue                                 │
│   ├── Access: Business, Enterprise                                   │
│   └── Agents: agent-dedicated-1, agent-dedicated-2, ...              │
│                                                                      │
│   TIER 1: SHARED (priority=0)                                        │
│   ├── Shared pool agents                                             │
│   ├── Best-effort processing                                         │
│   ├── Access: All plans (Free, Team, Business, Enterprise)           │
│   └── Agents: agent-shared-1, agent-shared-2, ...                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Plan-Tier Access Matrix

| Plan | Shared | Dedicated | Premium | Max Concurrent | Priority Base |
|------|--------|-----------|---------|----------------|---------------|
| **Free** | ✅ | ❌ | ❌ | 1 | 25 |
| **Team** | ✅ | ❌ | ❌ | 3 | 50 |
| **Business** | ✅ | ✅ | ❌ | 10 | 75 |
| **Enterprise** | ✅ | ✅ | ✅ | 50 | 100 |

### Tier Selection Logic

```
Tenant submits job
    ↓
Check plan's max_tier (e.g., "dedicated" for Business)
    ↓
Find available agents with tier ≤ max_tier
    ↓
Prefer higher tier agents first (premium > dedicated > shared)
    ↓
Within same tier, select by:
    1. Region match
    2. Lowest load_score
    3. Lowest current_jobs
    ↓
Assign agent to job
```

---

## Database Schema Changes

### Migration: Add Agent Tier

```sql
-- Migration: 000090_add_agent_tier.up.sql

-- 1. Add tier column to agents
ALTER TABLE agents ADD COLUMN tier VARCHAR(20) DEFAULT 'shared';

-- Add constraint for valid tiers
ALTER TABLE agents ADD CONSTRAINT agents_tier_check
    CHECK (tier IN ('shared', 'dedicated', 'premium'));

-- Create index for tier-based queries
CREATE INDEX idx_agents_tier ON agents(tier) WHERE is_platform_agent = TRUE;

-- 2. Create platform_agent_tiers reference table
CREATE TABLE platform_agent_tiers (
    slug VARCHAR(20) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    priority INT NOT NULL DEFAULT 0,
    max_queue_time_seconds INT DEFAULT 3600,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Seed tiers
INSERT INTO platform_agent_tiers (slug, name, description, priority) VALUES
    ('shared', 'Shared', 'Shared platform agents with best-effort processing', 0),
    ('dedicated', 'Dedicated', 'Dedicated agents with faster processing and less queue', 50),
    ('premium', 'Premium', 'Premium high-performance agents with priority processing', 100);

-- 4. Update existing platform agents to shared tier
UPDATE agents SET tier = 'shared' WHERE is_platform_agent = TRUE AND tier IS NULL;

-- 5. Update plan_modules to include max_tier
-- Free plan: shared only
UPDATE plan_modules
SET limits = limits || '{"max_tier": "shared"}'::jsonb
WHERE module_id = 'platform_agents'
  AND plan_id = (SELECT id FROM plans WHERE slug = 'free');

-- Team plan: shared only (but higher priority)
UPDATE plan_modules
SET limits = limits || '{"max_tier": "shared"}'::jsonb
WHERE module_id = 'platform_agents'
  AND plan_id = (SELECT id FROM plans WHERE slug = 'team');

-- Business plan: shared + dedicated
UPDATE plan_modules
SET limits = limits || '{"max_tier": "dedicated"}'::jsonb
WHERE module_id = 'platform_agents'
  AND plan_id = (SELECT id FROM plans WHERE slug = 'business');

-- Enterprise plan: all tiers
UPDATE plan_modules
SET limits = limits || '{"max_tier": "premium"}'::jsonb
WHERE module_id = 'platform_agents'
  AND plan_id = (SELECT id FROM plans WHERE slug = 'enterprise');
```

### Migration Rollback

```sql
-- Migration: 000090_add_agent_tier.down.sql

DROP INDEX IF EXISTS idx_agents_tier;
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_tier_check;
ALTER TABLE agents DROP COLUMN IF EXISTS tier;
DROP TABLE IF EXISTS platform_agent_tiers;

-- Remove max_tier from plan_modules (preserving other limits)
UPDATE plan_modules
SET limits = limits - 'max_tier'
WHERE module_id = 'platform_agents';
```

---

## Backend Implementation

### Phase 1: Domain Layer

#### 1.1 Agent Tier Constants

**File:** `api/internal/domain/agent/tier.go`

```go
package agent

// PlatformAgentTier represents the tier level of a platform agent.
type PlatformAgentTier string

const (
    TierShared    PlatformAgentTier = "shared"
    TierDedicated PlatformAgentTier = "dedicated"
    TierPremium   PlatformAgentTier = "premium"
)

// TierPriority returns the selection priority for a tier.
// Higher priority agents are selected first.
func (t PlatformAgentTier) Priority() int {
    switch t {
    case TierPremium:
        return 100
    case TierDedicated:
        return 50
    case TierShared:
        return 0
    default:
        return 0
    }
}

// IsValid checks if the tier is valid.
func (t PlatformAgentTier) IsValid() bool {
    switch t {
    case TierShared, TierDedicated, TierPremium:
        return true
    }
    return false
}

// CanAccessTier checks if this tier can access agents of the target tier.
// Higher tiers can access lower tier agents.
func (t PlatformAgentTier) CanAccessTier(target PlatformAgentTier) bool {
    return t.Priority() >= target.Priority()
}

// AllAccessibleTiers returns all tiers this tier can access.
func (t PlatformAgentTier) AllAccessibleTiers() []PlatformAgentTier {
    var tiers []PlatformAgentTier
    if t.CanAccessTier(TierShared) {
        tiers = append(tiers, TierShared)
    }
    if t.CanAccessTier(TierDedicated) {
        tiers = append(tiers, TierDedicated)
    }
    if t.CanAccessTier(TierPremium) {
        tiers = append(tiers, TierPremium)
    }
    return tiers
}

// ParseTier parses a string into a PlatformAgentTier.
func ParseTier(s string) PlatformAgentTier {
    tier := PlatformAgentTier(s)
    if tier.IsValid() {
        return tier
    }
    return TierShared
}
```

#### 1.2 Update Agent Entity

**File:** `api/internal/domain/agent/entity.go`

```go
// Add to Agent struct
type Agent struct {
    // ... existing fields ...

    // Tier indicates the platform agent tier (shared, dedicated, premium).
    // Only applicable for platform agents (IsPlatformAgent = true).
    Tier PlatformAgentTier
}

// Update NewPlatformAgent to include tier
func NewPlatformAgent(
    name string,
    agentType AgentType,
    description string,
    capabilities []string,
    tools []string,
    region string,
    maxConcurrentJobs int,
    tier PlatformAgentTier, // NEW parameter
) (*Agent, error) {
    // ... validation ...

    if !tier.IsValid() {
        tier = TierShared
    }

    return &Agent{
        // ... existing fields ...
        Tier: tier,
    }, nil
}
```

#### 1.3 Update Repository Interface

**File:** `api/internal/domain/agent/repository.go`

```go
// PlatformAgentSelectionRequest for selecting platform agents
type PlatformAgentSelectionRequest struct {
    TenantID        shared.ID
    Capabilities    []string
    Tool            string
    PreferredRegion string
    AllowQueue      bool

    // NEW: Tier-based selection
    MaxTier         PlatformAgentTier // Maximum tier tenant can access
    PreferHigherTier bool              // If true, prefer higher tiers first
}

// Repository interface - update method signature
type Repository interface {
    // ... existing methods ...

    // SelectBestPlatformAgent selects the best available platform agent.
    // Filters by tier (agent.tier <= req.MaxTier) and prefers higher tiers.
    SelectBestPlatformAgent(ctx context.Context, req PlatformAgentSelectionRequest) (*Agent, error)

    // FindPlatformAgentsByTier finds all platform agents of specific tiers.
    FindPlatformAgentsByTier(ctx context.Context, tiers []PlatformAgentTier) ([]*Agent, error)

    // GetPlatformAgentStatsByTier returns stats grouped by tier.
    GetPlatformAgentStatsByTier(ctx context.Context) (map[PlatformAgentTier]*PlatformAgentStats, error)
}
```

### Phase 2: Application Layer

#### 2.1 Platform Agent Limits Interface

**File:** `api/internal/app/platform_agent_licensing.go`

```go
package app

import (
    "context"

    "github.com/openctemio/api/internal/domain/agent"
    "github.com/openctemio/api/internal/domain/shared"
)

// PlatformAgentLimits contains the platform agent limits for a tenant.
type PlatformAgentLimits struct {
    Enabled       bool                  `json:"enabled"`
    MaxTier       agent.PlatformAgentTier `json:"max_tier"`
    MaxConcurrent int                   `json:"max_concurrent"`
    MaxQueued     int                   `json:"max_queued"`
    PriorityBase  int                   `json:"priority_base"`
}

// PlatformAgentLicensing provides platform agent access control via licensing.
type PlatformAgentLicensing interface {
    // GetPlatformAgentLimits returns platform agent limits for a tenant.
    GetPlatformAgentLimits(ctx context.Context, tenantID shared.ID) (*PlatformAgentLimits, error)
}
```

#### 2.2 Implement in LicensingService

**File:** `api/internal/app/licensing_service.go` (add method)

```go
const ModulePlatformAgents = "platform_agents"

// GetPlatformAgentLimits returns platform agent limits for a tenant.
func (s *LicensingService) GetPlatformAgentLimits(ctx context.Context, tenantID shared.ID) (*PlatformAgentLimits, error) {
    // Check if tenant has the module
    hasModule, err := s.TenantHasModule(ctx, tenantID.String(), ModulePlatformAgents)
    if err != nil {
        return nil, err
    }

    if !hasModule {
        return &PlatformAgentLimits{Enabled: false}, nil
    }

    // Get subscription to access plan limits
    sub, err := s.GetTenantSubscription(ctx, tenantID.String())
    if err != nil {
        return &PlatformAgentLimits{Enabled: false}, nil
    }

    // Default limits
    limits := &PlatformAgentLimits{
        Enabled:       true,
        MaxTier:       agent.TierShared,
        MaxConcurrent: 1,
        MaxQueued:     5,
        PriorityBase:  25,
    }

    // Get limits from plan module
    if sub.Subscription != nil && sub.Subscription.Plan() != nil {
        plan := sub.Subscription.Plan()

        // Parse max_tier
        if tierLimit := plan.GetModuleLimit(ModulePlatformAgents, "max_tier"); tierLimit != 0 {
            // GetModuleLimit returns int64, need string
            // Use GetModuleLimitString instead
        }

        // Parse max_concurrent_jobs
        if limit := plan.GetModuleLimit(ModulePlatformAgents, "max_concurrent_jobs"); limit > 0 {
            limits.MaxConcurrent = int(limit)
        }

        // Parse max_queued_jobs
        if limit := plan.GetModuleLimit(ModulePlatformAgents, "max_queued_jobs"); limit > 0 {
            limits.MaxQueued = int(limit)
        }

        // Parse priority_base
        if limit := plan.GetModuleLimit(ModulePlatformAgents, "priority_base"); limit > 0 {
            limits.PriorityBase = int(limit)
        }
    }

    // Check for tenant-specific overrides
    if sub.Subscription != nil && sub.Subscription.LimitsOverride() != nil {
        override := sub.Subscription.LimitsOverride()

        if tier, ok := override["platform_agents:max_tier"].(string); ok {
            limits.MaxTier = agent.ParseTier(tier)
        }
        if maxConcurrent, ok := override["platform_agents:max_concurrent_jobs"].(float64); ok {
            limits.MaxConcurrent = int(maxConcurrent)
        }
        if maxQueued, ok := override["platform_agents:max_queued_jobs"].(float64); ok {
            limits.MaxQueued = int(maxQueued)
        }
        if priority, ok := override["platform_agents:priority_base"].(float64); ok {
            limits.PriorityBase = int(priority)
        }
    }

    return limits, nil
}
```

#### 2.3 Update AgentSelector

**File:** `api/internal/app/agent_selector.go`

```go
// AgentSelector handles intelligent agent selection with tier support.
type AgentSelector struct {
    agentRepo    agent.Repository
    commandRepo  command.Repository
    agentState   *redis.AgentStateStore
    licensingSvc PlatformAgentLicensing // NEW: replaces tenantRepo
    logger       *logger.Logger
}

// NewAgentSelector creates a new AgentSelector with licensing integration.
func NewAgentSelector(
    agentRepo agent.Repository,
    commandRepo command.Repository,
    agentState *redis.AgentStateStore,
    licensingSvc PlatformAgentLicensing,
    log *logger.Logger,
) *AgentSelector {
    return &AgentSelector{
        agentRepo:    agentRepo,
        commandRepo:  commandRepo,
        agentState:   agentState,
        licensingSvc: licensingSvc,
        logger:       log.With("service", "agent_selector"),
    }
}

// SelectAgent selects the best agent for a job.
func (s *AgentSelector) SelectAgent(ctx context.Context, req SelectAgentRequest) (*SelectAgentResult, error) {
    // Get platform agent limits from licensing
    limits, err := s.licensingSvc.GetPlatformAgentLimits(ctx, req.TenantID)
    if err != nil {
        return nil, fmt.Errorf("failed to get platform agent limits: %w", err)
    }

    switch req.Mode {
    case SelectTenantOnly:
        return s.selectTenantAgent(ctx, req)

    case SelectPlatformOnly:
        return s.selectPlatformAgent(ctx, req, limits)

    case SelectTenantFirst:
        result, err := s.selectTenantAgent(ctx, req)
        if err == nil && result.Agent != nil {
            return result, nil
        }
        return s.selectPlatformAgent(ctx, req, limits)

    case SelectAny:
        return s.selectAnyAgent(ctx, req, limits)

    default:
        return nil, fmt.Errorf("unknown selection mode: %s", req.Mode)
    }
}

// selectPlatformAgent selects from platform agents with tier filtering.
func (s *AgentSelector) selectPlatformAgent(ctx context.Context, req SelectAgentRequest, limits *PlatformAgentLimits) (*SelectAgentResult, error) {
    // Check if platform agents are enabled
    if !limits.Enabled {
        return nil, ErrPlatformNotAvailable
    }

    // Check quota
    activeCount, err := s.commandRepo.CountActivePlatformJobsByTenant(ctx, req.TenantID)
    if err == nil && activeCount >= limits.MaxConcurrent {
        if req.AllowQueue {
            // Check queue limit
            queuedCount, _ := s.commandRepo.CountQueuedPlatformJobsByTenant(ctx, req.TenantID)
            if queuedCount >= limits.MaxQueued {
                return nil, ErrPlatformQuotaExceeded
            }

            pos, wait := s.estimateQueuePosition(ctx, req)
            return &SelectAgentResult{
                Queued:        true,
                QueuePosition: pos,
                EstimatedWait: wait,
                Message:       "Platform agent quota reached, job will be queued",
            }, nil
        }
        return nil, ErrPlatformQuotaExceeded
    }

    // Select platform agent with tier filtering
    platformReq := agent.PlatformAgentSelectionRequest{
        TenantID:         req.TenantID,
        Capabilities:     req.Capabilities,
        Tool:             req.Tool,
        PreferredRegion:  req.Region,
        AllowQueue:       req.AllowQueue,
        MaxTier:          limits.MaxTier,      // NEW: filter by tier
        PreferHigherTier: true,                // Prefer premium > dedicated > shared
    }

    selected, err := s.agentRepo.SelectBestPlatformAgent(ctx, platformReq)
    if err != nil {
        return nil, fmt.Errorf("failed to select platform agent: %w", err)
    }

    if selected == nil {
        if req.AllowQueue {
            pos, wait := s.estimateQueuePosition(ctx, req)
            return &SelectAgentResult{
                Queued:        true,
                QueuePosition: pos,
                EstimatedWait: wait,
                Message:       "No platform agent available, job will be queued",
            }, nil
        }
        return nil, ErrNoAgentAvailable
    }

    return &SelectAgentResult{
        Agent:      selected,
        IsPlatform: true,
        AgentTier:  string(selected.Tier), // NEW: include tier in result
        Message:    fmt.Sprintf("%s tier platform agent assigned", selected.Tier),
    }, nil
}

// CanUsePlatformAgents checks if tenant can use platform agents.
func (s *AgentSelector) CanUsePlatformAgents(ctx context.Context, tenantID shared.ID) (bool, string) {
    limits, err := s.licensingSvc.GetPlatformAgentLimits(ctx, tenantID)
    if err != nil {
        return false, "Failed to check platform agent access"
    }

    if !limits.Enabled {
        return false, "Platform agents not available on your current plan"
    }

    // Check quota
    activeCount, err := s.commandRepo.CountActivePlatformJobsByTenant(ctx, tenantID)
    if err == nil && activeCount >= limits.MaxConcurrent {
        return false, fmt.Sprintf("Platform agent quota exceeded (%d/%d)", activeCount, limits.MaxConcurrent)
    }

    return true, ""
}

// GetPlatformStats returns platform agent statistics for a tenant.
func (s *AgentSelector) GetPlatformStats(ctx context.Context, tenantID shared.ID) (*PlatformStatsResult, error) {
    limits, err := s.licensingSvc.GetPlatformAgentLimits(ctx, tenantID)
    if err != nil {
        return nil, err
    }

    // Get stats by tier
    statsByTier, err := s.agentRepo.GetPlatformAgentStatsByTier(ctx)
    if err != nil {
        return nil, err
    }

    // Get tenant-specific counts
    activeCount, _ := s.commandRepo.CountActivePlatformJobsByTenant(ctx, tenantID)
    queuedCount, _ := s.commandRepo.CountQueuedPlatformJobsByTenant(ctx, tenantID)

    return &PlatformStatsResult{
        Limits:           limits,
        StatsByTier:      statsByTier,
        AccessibleTiers:  limits.MaxTier.AllAccessibleTiers(),
        TenantActiveJobs: activeCount,
        TenantQueuedJobs: queuedCount,
        TenantAvailable:  limits.MaxConcurrent - activeCount,
    }, nil
}
```

### Phase 3: Repository Implementation

#### 3.1 Update Agent Repository

**File:** `api/internal/infra/postgres/agent_repository.go`

```go
// SelectBestPlatformAgent selects the best platform agent with tier filtering.
func (r *AgentRepository) SelectBestPlatformAgent(ctx context.Context, req agent.PlatformAgentSelectionRequest) (*agent.Agent, error) {
    // Build accessible tiers list
    accessibleTiers := req.MaxTier.AllAccessibleTiers()
    tierStrings := make([]string, len(accessibleTiers))
    for i, t := range accessibleTiers {
        tierStrings[i] = string(t)
    }

    query := `
        SELECT id, tenant_id, name, type, description, capabilities, tools,
               execution_mode, status, health, status_message, is_platform_agent,
               api_key_hash, api_key_prefix, labels, config, metadata, version,
               hostname, ip_address, cpu_percent, memory_percent, disk_read_mbps,
               disk_write_mbps, network_rx_mbps, network_tx_mbps, load_score,
               metrics_updated_at, active_jobs, current_jobs, max_concurrent_jobs,
               region, tier, last_seen_at, last_error_at, total_findings, total_scans,
               error_count, created_at, updated_at
        FROM agents
        WHERE is_platform_agent = TRUE
          AND status = 'active'
          AND health = 'online'
          AND current_jobs < max_concurrent_jobs
          AND tier = ANY($1)  -- Filter by accessible tiers
    `

    args := []interface{}{pq.Array(tierStrings)}
    argNum := 2

    // Add capability filter
    if len(req.Capabilities) > 0 {
        query += fmt.Sprintf(" AND capabilities @> $%d", argNum)
        args = append(args, pq.Array(req.Capabilities))
        argNum++
    }

    // Add tool filter
    if req.Tool != "" {
        query += fmt.Sprintf(" AND $%d = ANY(tools)", argNum)
        args = append(args, req.Tool)
        argNum++
    }

    // Order by: tier priority (desc), region match, load score, current jobs
    query += `
        ORDER BY
            CASE tier
                WHEN 'premium' THEN 100
                WHEN 'dedicated' THEN 50
                WHEN 'shared' THEN 0
            END DESC,
            CASE WHEN region = $` + fmt.Sprintf("%d", argNum) + ` THEN 0 ELSE 1 END ASC,
            load_score ASC,
            current_jobs ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    `
    args = append(args, req.PreferredRegion)

    var a agent.Agent
    err := r.db.QueryRowContext(ctx, query, args...).Scan(
        // ... scan all fields including tier
    )

    if err == sql.ErrNoRows {
        return nil, nil
    }
    if err != nil {
        return nil, err
    }

    return &a, nil
}

// GetPlatformAgentStatsByTier returns statistics grouped by tier.
func (r *AgentRepository) GetPlatformAgentStatsByTier(ctx context.Context) (map[agent.PlatformAgentTier]*agent.PlatformAgentStats, error) {
    query := `
        SELECT
            tier,
            COUNT(*) as total_agents,
            COUNT(*) FILTER (WHERE health = 'online') as online_agents,
            COUNT(*) FILTER (WHERE health = 'offline') as offline_agents,
            COALESCE(SUM(max_concurrent_jobs), 0) as total_capacity,
            COALESCE(SUM(current_jobs), 0) as current_load,
            COALESCE(SUM(max_concurrent_jobs) - SUM(current_jobs), 0) as available_slots
        FROM agents
        WHERE is_platform_agent = TRUE
        GROUP BY tier
    `

    rows, err := r.db.QueryContext(ctx, query)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    result := make(map[agent.PlatformAgentTier]*agent.PlatformAgentStats)
    for rows.Next() {
        var tier string
        var stats agent.PlatformAgentStats
        err := rows.Scan(
            &tier,
            &stats.TotalAgents,
            &stats.OnlineAgents,
            &stats.OfflineAgents,
            &stats.TotalCapacity,
            &stats.CurrentLoad,
            &stats.AvailableSlots,
        )
        if err != nil {
            return nil, err
        }
        result[agent.PlatformAgentTier(tier)] = &stats
    }

    return result, rows.Err()
}
```

### Phase 4: API Endpoints

#### 4.1 Platform Stats Endpoint

**File:** `api/internal/infra/http/handler/platform_stats_handler.go`

```go
// GetPlatformStats returns platform agent statistics for the current tenant.
// GET /api/v1/platform/stats
func (h *PlatformStatsHandler) GetPlatformStats(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    tenantID := middleware.MustGetTenantID(ctx)

    stats, err := h.agentSelector.GetPlatformStats(ctx, tenantID)
    if err != nil {
        apierror.InternalError(err).WriteJSON(w)
        return
    }

    resp := PlatformStatsResponse{
        Enabled:          stats.Limits.Enabled,
        MaxTier:          string(stats.Limits.MaxTier),
        MaxConcurrent:    stats.Limits.MaxConcurrent,
        MaxQueued:        stats.Limits.MaxQueued,
        CurrentActive:    stats.TenantActiveJobs,
        CurrentQueued:    stats.TenantQueuedJobs,
        AvailableSlots:   stats.TenantAvailable,
        AccessibleTiers:  tierStrings(stats.AccessibleTiers),
        TierStats:        stats.StatsByTier,
    }

    json.NewEncoder(w).Encode(resp)
}
```

---

## Frontend Implementation

### Phase 5: TypeScript Types

**File:** `ui/src/lib/api/platform-types.ts`

```typescript
// Platform agent tiers
export const PLATFORM_AGENT_TIERS = ['shared', 'dedicated', 'premium'] as const
export type PlatformAgentTier = (typeof PLATFORM_AGENT_TIERS)[number]

export const PLATFORM_TIER_LABELS: Record<PlatformAgentTier, string> = {
  shared: 'Shared',
  dedicated: 'Dedicated',
  premium: 'Premium',
}

export const PLATFORM_TIER_DESCRIPTIONS: Record<PlatformAgentTier, string> = {
  shared: 'Shared agents with best-effort processing',
  dedicated: 'Dedicated agents with faster processing',
  premium: 'Premium high-performance agents',
}

export const PLATFORM_TIER_COLORS: Record<PlatformAgentTier, string> = {
  shared: 'text-gray-500',
  dedicated: 'text-blue-500',
  premium: 'text-purple-500',
}

// Platform stats response
export interface PlatformStatsResponse {
  enabled: boolean
  max_tier: PlatformAgentTier
  max_concurrent: number
  max_queued: number
  current_active: number
  current_queued: number
  available_slots: number
  accessible_tiers: PlatformAgentTier[]
  tier_stats: Record<PlatformAgentTier, TierStats>
}

export interface TierStats {
  total_agents: number
  online_agents: number
  offline_agents: number
  total_capacity: number
  current_load: number
  available_slots: number
}
```

### Phase 6: Platform Stats Component

**File:** `ui/src/features/platform/components/platform-stats-card.tsx`

```tsx
'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Cloud, Server, Zap, Crown } from 'lucide-react'
import { usePlatformStats } from '@/lib/api/platform-hooks'
import { PLATFORM_TIER_LABELS, PLATFORM_TIER_COLORS } from '@/lib/api/platform-types'

export function PlatformStatsCard() {
  const { data: stats, isLoading } = usePlatformStats()

  if (isLoading || !stats) {
    return <PlatformStatsCardSkeleton />
  }

  if (!stats.enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Platform Agents
          </CardTitle>
          <CardDescription>
            Platform agents are not available on your current plan.
            Upgrade to use managed scanning infrastructure.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const usagePercent = (stats.current_active / stats.max_concurrent) * 100

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Platform Agents
          </CardTitle>
          <TierBadge tier={stats.max_tier} />
        </div>
        <CardDescription>
          Your plan includes access to {stats.accessible_tiers.map(t => PLATFORM_TIER_LABELS[t]).join(', ')} agents
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Usage */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Active Jobs</span>
            <span>{stats.current_active} / {stats.max_concurrent}</span>
          </div>
          <Progress value={usagePercent} className="h-2" />
        </div>

        {/* Queued */}
        {stats.current_queued > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Queued</span>
            <span>{stats.current_queued} / {stats.max_queued}</span>
          </div>
        )}

        {/* Tier Stats */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          {stats.accessible_tiers.map(tier => {
            const tierStats = stats.tier_stats[tier]
            return (
              <div key={tier} className="text-center">
                <TierIcon tier={tier} className="h-4 w-4 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">{PLATFORM_TIER_LABELS[tier]}</p>
                <p className="text-sm font-medium">
                  {tierStats?.online_agents ?? 0} online
                </p>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function TierBadge({ tier }: { tier: PlatformAgentTier }) {
  const icons = {
    shared: Server,
    dedicated: Cloud,
    premium: Crown,
  }
  const Icon = icons[tier]

  return (
    <Badge variant="outline" className={PLATFORM_TIER_COLORS[tier]}>
      <Icon className="h-3 w-3 mr-1" />
      {PLATFORM_TIER_LABELS[tier]}
    </Badge>
  )
}

function TierIcon({ tier, className }: { tier: PlatformAgentTier; className?: string }) {
  const icons = {
    shared: Server,
    dedicated: Cloud,
    premium: Crown,
  }
  const Icon = icons[tier]
  return <Icon className={`${PLATFORM_TIER_COLORS[tier]} ${className}`} />
}
```

---

## Implementation Phases

| Phase | Description | Effort | Priority | Status |
|-------|-------------|--------|----------|--------|
| **Phase 1** | Database migration (add tier column) | 2h | P0 | ✅ Done |
| **Phase 2** | Domain layer (tier types, entity update) | 2h | P0 | ✅ Done |
| **Phase 3** | LicensingService integration | 3h | P0 | ✅ Done |
| **Phase 4** | AgentSelector update | 4h | P0 | ✅ Done |
| **Phase 5** | Repository implementation | 3h | P0 | ✅ Done |
| **Phase 6** | API endpoints | 2h | P1 | ✅ Done |
| **Phase 7** | Frontend types & hooks | 2h | P1 | ❌ Not Started |
| **Phase 8** | UI components | 4h | P2 | ❌ Not Started |
| **Phase 9** | Testing & documentation | 4h | P1 | 🔄 Partial |

**Total Estimate:** ~26 hours (3-4 days)

### Phase 6 - API Tasks (COMPLETED 2026-01-26)

| Task | File | Status |
|------|------|--------|
| Add `Tier` field to `PlatformAgentResponse` | `platform_agent_handler.go` | ✅ Done |
| Add `TierPriority` field to `PlatformAgentResponse` | `platform_agent_handler.go` | ✅ Done |
| Add `TierStats` to `PlatformAgentStatsResponse` | `platform_agent_handler.go` | ✅ Done |
| Add `TierStatsResponse` struct | `platform_agent_handler.go` | ✅ Done |
| Add `tier` query param to `ListPlatformAgents` | `platform_agent_handler.go` | ✅ Done |
| Update `toPlatformAgentResponse()` mapper | `platform_agent_handler.go` | ✅ Done |
| Update `GetPlatformAgentStats` to fetch TierStats | `platform_agent_service.go` | ✅ Done |
| Add `Tier` to `ListPlatformAgentsInput` | `platform_agent_service.go` | ✅ Done |
| OpenAPI/Swagger spec update | Auto-generated via annotations | ✅ Done |

---

## Testing Strategy

### Unit Tests

```go
// agent_selector_test.go

func TestSelectAgent_TierFiltering(t *testing.T) {
    tests := []struct {
        name           string
        tenantTier     agent.PlatformAgentTier
        availableAgents []agent.PlatformAgentTier
        expectedTier   agent.PlatformAgentTier
    }{
        {
            name:           "premium tenant gets premium agent",
            tenantTier:     agent.TierPremium,
            availableAgents: []agent.PlatformAgentTier{agent.TierShared, agent.TierDedicated, agent.TierPremium},
            expectedTier:   agent.TierPremium,
        },
        {
            name:           "dedicated tenant cannot access premium",
            tenantTier:     agent.TierDedicated,
            availableAgents: []agent.PlatformAgentTier{agent.TierShared, agent.TierDedicated, agent.TierPremium},
            expectedTier:   agent.TierDedicated,
        },
        {
            name:           "shared tenant only gets shared",
            tenantTier:     agent.TierShared,
            availableAgents: []agent.PlatformAgentTier{agent.TierShared, agent.TierDedicated, agent.TierPremium},
            expectedTier:   agent.TierShared,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test implementation
        })
    }
}
```

### Integration Tests

1. Create platform agents with different tiers
2. Create tenants with different plans
3. Submit jobs and verify correct agent assignment
4. Verify tier restrictions are enforced

---

## Rollback Plan

1. **Database:** Run `000090_add_agent_tier.down.sql`
2. **Code:** Revert AgentSelector to use tenantRepo instead of licensingSvc
3. **Feature flag:** Can add `ENABLE_TIERED_AGENTS=false` env var to disable

---

## Monitoring & Alerts

### Metrics to Track

- Platform agent utilization by tier
- Queue depth by tier
- Average wait time by tier
- Tier selection distribution

### Alerts

- Alert when premium tier utilization > 80%
- Alert when shared tier queue > 100 jobs
- Alert when any tier has 0 online agents

---

## Security Considerations

1. **Tier Escalation:** Ensure tenants cannot access higher tier agents than their plan allows
2. **Quota Bypass:** Double-check quota enforcement in both AgentSelector and repository
3. **Audit Logging:** Log all tier assignments for compliance

---

## References

- Migration 000080: Platform agents foundation
- Migration 000058: Licensing system
- `api/internal/app/agent_selector.go`: Current implementation
- `api/internal/app/licensing_service.go`: Module access control

---

## Approval Checklist

- [ ] Architecture reviewed
- [ ] Database schema approved
- [ ] Security review completed
- [ ] Implementation plan approved
- [ ] Ready to proceed

---

*Document Version: 1.0*
*Last Updated: 2026-01-26*
