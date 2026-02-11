# Tools & Capabilities Normalization Implementation Plan

**Created:** 2026-01-26
**Updated:** 2026-01-26
**Status:** PHASE 1+2 COMPLETED
**Scope:** Database Schema, Backend, Frontend
**Risk Level:** HIGH (core data model change)

---

## Implementation Progress

### Completed (Phase 1+2)
- ✅ Created `capabilities` table with 16 seeded platform capabilities
- ✅ Created `tool_capabilities` junction table for M:N relationship
- ✅ Auto-populated junction table from existing `tools.capabilities[]`
- ✅ Created domain entity: `api/internal/domain/capability/entity.go`
- ✅ Created repository interfaces: `api/internal/domain/capability/repository.go`
- ✅ Implemented PostgreSQL repository: `api/internal/infra/postgres/capability_repository.go`
- ✅ Created service: `api/internal/app/capability_service.go`
- ✅ Created HTTP handler: `api/internal/infra/http/handler/capability_handler.go`
- ✅ Added API routes in `scanning.go`
- ✅ Wired up in `repositories.go`, `services.go`, `handlers.go`, `routes.go`
- ✅ Created frontend types: `ui/src/lib/api/capability-types.ts`
- ✅ Created frontend hooks: `ui/src/lib/api/capability-hooks.ts`
- ✅ Updated `endpoints.ts` with capability endpoints
- ✅ Updated `index.ts` with exports
- ✅ Updated UI pipeline builder to remove hardcoded fallback
- ✅ Created migration 000096 to sync `tools.capabilities` from junction table

### Key Files
- **Migration 000095:** `api/migrations/000095_capabilities.up.sql` - Creates capabilities table and junction table
- **Migration 000096:** `api/migrations/000096_sync_tools_capabilities.up.sql` - Syncs tools.capabilities from junction table
- **API Endpoints:**
  - `GET /api/v1/capabilities` - List with pagination
  - `GET /api/v1/capabilities/all` - All capabilities (for dropdowns)
  - `GET /api/v1/capabilities/categories` - Unique categories
  - `GET /api/v1/capabilities/by-category/{category}` - By category
  - `GET /api/v1/capabilities/{id}` - Single capability
  - `POST /api/v1/custom-capabilities` - Create custom (tenant)
  - `PUT /api/v1/custom-capabilities/{id}` - Update custom
  - `DELETE /api/v1/custom-capabilities/{id}` - Delete custom

### Remaining (Phase 3+4)
- ⏳ Use `tool_id` instead of `tool_name` in findings table
- ⏳ Use `tool_id` in pipeline_steps instead of tool VARCHAR
- ⏳ Create `agent_tools` junction table
- ⏳ Deprecate and remove legacy TEXT[] columns

---

## Executive Summary

Normalize tools and capabilities schema to:
1. **Separate capabilities into dedicated table** with metadata
2. **Use tool_id (UUID) instead of tool_name (string)** for all references
3. **Support multi-tenant custom tools** without name collision issues
4. **Enable proper capability management** with validation and UI metadata

---

## Current State Analysis

### Problem Areas

| Component | Current Pattern | Issue | Severity |
|-----------|-----------------|-------|----------|
| `findings.tool_name` | VARCHAR(100) | No FK, ambiguous in multi-tenant | 🔴 CRITICAL |
| `agents.tools[]` | TEXT[] of names | Can't validate, no FK | 🔴 CRITICAL |
| `tools.capabilities` | TEXT[] embedded | No metadata, no validation | 🟡 HIGH |
| `pipeline_steps.tool` | VARCHAR(100) | Dangling refs if deleted | 🟡 HIGH |
| `scan_profiles.tools` | TEXT[] | Name-based, no validation | 🟡 MEDIUM |
| `rule_bundles.tool_name` | VARCHAR | Name reference | 🟡 MEDIUM |

### Files Requiring Migration (23 files identified)

#### Database Migrations (8 files)
- `000007_findings.up.sql` - findings.tool_name
- `000014_workers.up.sql` - agents.tools TEXT[]
- `000022_scan_profiles.up.sql` - tools TEXT[]
- `000080_add_platform_agents.up.sql` - p_tools TEXT[] parameter
- `000092_add_agent_tiers.up.sql` - p_tools TEXT[] parameter

#### Domain Layer (8 files)
- `domain/agent/entity.go` - tools []string
- `domain/agent/bootstrap_token.go` - RequiredTools []string
- `domain/agent/registration_token.go` - tools []string
- `domain/agent/repository.go` - GetAvailableToolsForTenant returns []string
- `domain/command/repository.go` - tools []string in GetNextPlatformJob
- `domain/vulnerability/finding.go` - ToolName string
- `domain/vulnerability/repository.go` - ToolName filter
- `domain/rule/bundle.go` - ToolName string

#### Application Layer (4 files)
- `app/pipeline_service.go` - GetByName lookups
- `app/ingest_service.go` - ToolName in IngestMetadata
- `app/security_validator.go` - validateToolName
- `app/vulnerability_service.go` - ToolName in CreateFindingRequest

#### Infrastructure Layer (5 files)
- `postgres/agent_repository.go` - unnest(tools) queries
- `postgres/finding_repository.go` - tool_name throughout
- `postgres/dashboard_repository.go` - tool_name in queries
- `http/handler/vulnerability_handler.go` - ToolName in responses
- `http/handler/tool_handler.go` - GetByName endpoint (OK to keep)

#### Frontend (1 file)
- `ui/src/lib/api/finding-types.ts` - tool_name fields

---

## Target Architecture

### New Database Schema

```sql
-- 1. Capabilities table (new)
CREATE TABLE capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,           -- 'sast', 'dast', 'recon'
    display_name VARCHAR(100) NOT NULL,  -- 'Static Analysis'
    description TEXT,
    icon VARCHAR(50),                    -- Lucide icon name
    color VARCHAR(20),                   -- Badge color
    category VARCHAR(50),                -- 'analysis', 'discovery'
    sort_order INTEGER DEFAULT 0,
    is_builtin BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name)
);

-- 2. Tool-Capabilities junction (new)
CREATE TABLE tool_capabilities (
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    capability_id UUID NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tool_id, capability_id)
);

-- 3. Step-Capabilities junction (new)
CREATE TABLE step_capabilities (
    step_id UUID NOT NULL REFERENCES pipeline_steps(id) ON DELETE CASCADE,
    capability_id UUID NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (step_id, capability_id)
);

-- 4. Agent-Tools junction (new, replaces tools TEXT[])
CREATE TABLE agent_tools (
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (agent_id, tool_id)
);
```

### Schema Changes to Existing Tables

```sql
-- findings: Add tool_id FK
ALTER TABLE findings ADD COLUMN tool_id UUID REFERENCES tools(id) ON DELETE SET NULL;
CREATE INDEX idx_findings_tool_id ON findings(tool_id);

-- pipeline_steps: Add tool_id FK
ALTER TABLE pipeline_steps ADD COLUMN tool_id UUID REFERENCES tools(id) ON DELETE SET NULL;
CREATE INDEX idx_pipeline_steps_tool_id ON pipeline_steps(tool_id);

-- rule_bundles: Add tool_id FK
ALTER TABLE rule_bundles ADD COLUMN tool_id UUID REFERENCES tools(id) ON DELETE SET NULL;

-- Later phases: Drop old columns
-- ALTER TABLE findings DROP COLUMN tool_name;
-- ALTER TABLE agents DROP COLUMN tools;
-- ALTER TABLE tools DROP COLUMN capabilities;
```

---

## Implementation Phases

### Phase 1: Foundation (Non-Breaking) ✅ Safe to Deploy

**Goal:** Add new tables and columns without breaking existing functionality.

#### 1.1 Database Migration
```
Migration: 000100_capabilities_foundation.up.sql
- CREATE TABLE capabilities
- CREATE TABLE tool_capabilities
- CREATE TABLE step_capabilities
- CREATE TABLE agent_tools
- ALTER TABLE findings ADD COLUMN tool_id (nullable)
- ALTER TABLE pipeline_steps ADD COLUMN tool_id (nullable)
- ALTER TABLE rule_bundles ADD COLUMN tool_id (nullable)
- CREATE necessary indexes
```

#### 1.2 Seed Capabilities Data
```sql
INSERT INTO capabilities (name, display_name, description, icon, color, category) VALUES
-- Analysis Capabilities
('sast', 'Static Analysis', 'Source code vulnerability detection', 'code', 'purple', 'analysis'),
('sca', 'Composition Analysis', 'Dependency vulnerability scanning', 'package', 'blue', 'analysis'),
('dast', 'Dynamic Testing', 'Runtime application testing', 'zap', 'orange', 'analysis'),
('secrets', 'Secret Detection', 'Credential and secret discovery', 'key', 'red', 'analysis'),
('iac', 'IaC Security', 'Infrastructure as Code scanning', 'server', 'cyan', 'analysis'),
('container', 'Container Security', 'Docker/OCI image scanning', 'box', 'indigo', 'analysis'),
-- Discovery Capabilities
('recon', 'Reconnaissance', 'Asset discovery and enumeration', 'search', 'green', 'discovery'),
('subdomain', 'Subdomain Enumeration', 'DNS subdomain discovery', 'globe', 'teal', 'discovery'),
('http', 'HTTP Probing', 'Web service detection', 'wifi', 'blue', 'discovery'),
('portscan', 'Port Scanning', 'Network port discovery', 'radio', 'amber', 'discovery'),
('crawler', 'Web Crawling', 'URL and endpoint discovery', 'spider', 'pink', 'discovery'),
-- Specialized
('web', 'Web Scanning', 'Web application vulnerabilities', 'globe', 'orange', 'analysis'),
('xss', 'XSS Detection', 'Cross-site scripting detection', 'alert-triangle', 'red', 'analysis'),
('sbom', 'SBOM Generation', 'Software bill of materials', 'file-text', 'slate', 'analysis'),
('terraform', 'Terraform Security', 'Terraform-specific scanning', 'cloud', 'purple', 'analysis'),
('docker', 'Docker Security', 'Docker-specific scanning', 'box', 'blue', 'analysis'),
('osint', 'Open Source Intel', 'Public information gathering', 'eye', 'gray', 'discovery');
```

#### 1.3 Migrate Tool-Capability Relationships
```sql
-- Migrate from tools.capabilities TEXT[] to tool_capabilities junction
INSERT INTO tool_capabilities (tool_id, capability_id)
SELECT t.id, c.id
FROM tools t
CROSS JOIN LATERAL unnest(t.capabilities) AS cap_name
JOIN capabilities c ON c.name = cap_name;
```

#### 1.4 Backend: Add New Repository Methods
```go
// capability_repository.go (new file)
type CapabilityRepository interface {
    GetByID(ctx context.Context, id shared.ID) (*Capability, error)
    GetByName(ctx context.Context, name string) (*Capability, error)
    List(ctx context.Context) ([]*Capability, error)
    GetByToolID(ctx context.Context, toolID shared.ID) ([]*Capability, error)
}

// tool_repository.go (additions)
func (r *ToolRepository) GetCapabilities(ctx context.Context, toolID shared.ID) ([]*Capability, error)
func (r *ToolRepository) SetCapabilities(ctx context.Context, toolID shared.ID, capabilityIDs []shared.ID) error
```

#### 1.5 Backend: Update Tool Entity
```go
// domain/tool/entity.go
type Tool struct {
    // ... existing fields
    CapabilityIDs []shared.ID    // New: IDs for junction table
    // Capabilities []string      // Deprecated: Keep for backward compat
}

// Helper method
func (t *Tool) GetCapabilityNames() []string {
    // Returns capability names from CapabilityIDs join
}
```

**Deliverables Phase 1:**
- [ ] Migration file: `000100_capabilities_foundation.up.sql`
- [ ] Migration file: `000100_capabilities_foundation.down.sql`
- [ ] New file: `domain/capability/entity.go`
- [ ] New file: `domain/capability/repository.go`
- [ ] New file: `infra/postgres/capability_repository.go`
- [ ] Update: `domain/tool/entity.go`
- [ ] Update: `infra/postgres/tool_repository.go`
- [ ] Tests for new repositories

---

### Phase 2: Dual-Write Mode (Backward Compatible)

**Goal:** Write to both old and new columns; read from new when available.

#### 2.1 Update Tool Service
```go
// tool_service.go
func (s *ToolService) UpdateTool(ctx context.Context, input UpdateToolInput) (*tool.Tool, error) {
    // Write capabilities to BOTH:
    // 1. tools.capabilities TEXT[] (old)
    // 2. tool_capabilities junction (new)
}
```

#### 2.2 Update Finding Service (Dual-Write)
```go
// vulnerability_service.go
func (s *VulnerabilityService) CreateFinding(ctx context.Context, input CreateFindingInput) (*Finding, error) {
    // Accept both tool_name and tool_id
    // If only tool_name provided, resolve to tool_id
    // Write both tool_name AND tool_id to findings table
}

// ingest_service.go
func (s *IngestService) ProcessFinding(ctx context.Context, input IngestInput) error {
    // Resolve tool_name → tool_id using tenant context
    // Priority: tenant custom tool > platform tool
    tool, err := s.resolveToolByName(ctx, tenantID, input.ToolName)
    if err != nil {
        // Fallback: create finding with tool_name only
    }
    finding.ToolID = tool.ID
    finding.ToolName = tool.Name  // Keep for backward compat
}
```

#### 2.3 Update Pipeline Service
```go
// pipeline_service.go
func (s *PipelineService) CreateStep(ctx context.Context, input CreateStepInput) (*Step, error) {
    // Accept tool (name) or tool_id
    // Resolve capabilities from tool_capabilities junction
    // Write both tool VARCHAR AND tool_id UUID
}
```

#### 2.4 Update Agent Service
```go
// agent_service.go
func (s *AgentService) RegisterAgent(ctx context.Context, input RegisterInput) (*Agent, error) {
    // Accept tools []string (names) for backward compat
    // Resolve to tool_ids and write to agent_tools junction
    // Also write to agents.tools TEXT[] for backward compat
}
```

#### 2.5 Backfill Script
```go
// cmd/backfill/tool_ids.go
func BackfillToolIDs() error {
    // 1. Backfill findings.tool_id from tool_name
    // 2. Backfill pipeline_steps.tool_id from tool
    // 3. Backfill agent_tools from agents.tools[]
    // 4. Backfill rule_bundles.tool_id from tool_name
}
```

#### 2.6 Update API Responses
```go
// handler/vulnerability_handler.go
type FindingResponse struct {
    // Keep existing
    ToolName string `json:"tool_name"`
    // Add new
    ToolID   *string `json:"tool_id,omitempty"`
    Tool     *ToolRef `json:"tool,omitempty"`  // Embedded reference
}

type ToolRef struct {
    ID          string   `json:"id"`
    Name        string   `json:"name"`
    DisplayName string   `json:"display_name"`
}
```

**Deliverables Phase 2:**
- [ ] Update: `app/tool_service.go` - dual write capabilities
- [ ] Update: `app/vulnerability_service.go` - resolve tool_id
- [ ] Update: `app/ingest_service.go` - resolve tool_id from name
- [ ] Update: `app/pipeline_service.go` - tool_id support
- [ ] Update: `app/agent_service.go` - agent_tools migration
- [ ] New: `cmd/backfill/tool_ids.go` - backfill script
- [ ] Update: API handlers - include tool_id in responses
- [ ] Update: Frontend types - add tool_id fields
- [ ] Tests for dual-write mode

---

### Phase 3: Read from New Schema

**Goal:** Primary reads from new schema; old columns as fallback.

#### 3.1 Update Repository Queries
```go
// finding_repository.go
func (r *FindingRepository) GetByID(ctx context.Context, id shared.ID) (*Finding, error) {
    query := `
        SELECT f.*,
               t.id as tool_id, t.name as tool_name, t.display_name
        FROM findings f
        LEFT JOIN tools t ON f.tool_id = t.id
        WHERE f.id = $1
    `
    // Use tool_id join; fallback to tool_name if tool_id is NULL
}
```

#### 3.2 Update Capability Lookups
```go
// tool_service.go
func (s *ToolService) GetToolCapabilities(ctx context.Context, toolID shared.ID) ([]Capability, error) {
    // Read from tool_capabilities junction
    // NOT from tools.capabilities TEXT[]
    return s.capabilityRepo.GetByToolID(ctx, toolID)
}
```

#### 3.3 Update Agent Selection
```go
// agent_repository.go
func (r *AgentRepository) FindByCapabilities(ctx context.Context, tenantID shared.ID, capabilities []string, toolID *shared.ID) ([]*Agent, error) {
    // Use agent_tools junction instead of agents.tools TEXT[]
    query := `
        SELECT DISTINCT a.*
        FROM agents a
        JOIN agent_tools at ON a.id = at.agent_id
        JOIN tool_capabilities tc ON at.tool_id = tc.tool_id
        JOIN capabilities c ON tc.capability_id = c.id
        WHERE a.tenant_id = $1
          AND c.name = ANY($2)
    `
}
```

**Deliverables Phase 3:**
- [ ] Update: `postgres/finding_repository.go` - join with tools
- [ ] Update: `postgres/agent_repository.go` - use agent_tools
- [ ] Update: `postgres/dashboard_repository.go` - use tool joins
- [ ] Update: `app/security_validator.go` - use tool_id
- [ ] Validation: All queries use new schema

---

### Phase 4: Cleanup (Breaking Changes)

**Goal:** Remove deprecated columns and legacy code.

#### 4.1 Database Cleanup Migration
```sql
-- Migration: 000110_tools_cleanup.up.sql

-- Remove old columns (after data verification)
ALTER TABLE findings DROP COLUMN tool_name;
ALTER TABLE findings ALTER COLUMN tool_id SET NOT NULL;

ALTER TABLE pipeline_steps DROP COLUMN tool;
-- Keep tool_id nullable (step may not require specific tool)

ALTER TABLE agents DROP COLUMN tools;
ALTER TABLE agents DROP COLUMN default_tools;

ALTER TABLE tools DROP COLUMN capabilities;

-- Update constraints
ALTER TABLE findings ADD CONSTRAINT fk_findings_tool
    FOREIGN KEY (tool_id) REFERENCES tools(id) ON DELETE SET NULL;
```

#### 4.2 Remove Legacy Code
```go
// Remove from domain/vulnerability/finding.go:
// - ToolName string field
// - ToolName() method

// Remove from domain/agent/entity.go:
// - tools []string parameter
// - HasTool(name string) method (replace with HasToolID)

// Remove from repository.go interfaces:
// - Methods that use tool name strings
```

#### 4.3 API Version Bump
```go
// Bump API version for breaking changes
// /api/v2/findings - tool_id required
// /api/v1/findings - deprecated, returns tool_name for compat
```

**Deliverables Phase 4:**
- [ ] Migration file: `000110_tools_cleanup.up.sql`
- [ ] Remove deprecated fields from entities
- [ ] Remove deprecated repository methods
- [ ] API v2 endpoints
- [ ] Updated documentation

---

## Frontend Changes

### Phase 1-2: Add tool_id Support
```typescript
// ui/src/lib/api/finding-types.ts
export interface Finding {
  tool_name: string;        // Keep for display
  tool_id?: string;         // Add new
  tool?: {                  // Add embedded reference
    id: string;
    name: string;
    display_name: string;
    capabilities: Capability[];
  };
}

export interface Capability {
  id: string;
  name: string;
  display_name: string;
  icon?: string;
  color?: string;
}
```

### Pipeline Builder Updates
```typescript
// Remove TOOL_CAPABILITIES_FALLBACK
// Capabilities now come from API via tool.capabilities[]

const availableTools = useMemo(() => {
  return toolsData.items.map(t => ({
    id: t.tool.id,           // Use ID
    name: t.tool.name,
    displayName: t.tool.display_name,
    capabilities: t.tool.capabilities,  // From junction table
  }))
}, [toolsData])
```

---

## Migration Data Integrity

### Pre-Migration Validation Queries
```sql
-- 1. Find findings with invalid tool names
SELECT DISTINCT f.tool_name
FROM findings f
WHERE NOT EXISTS (
    SELECT 1 FROM tools t
    WHERE t.name = f.tool_name
    AND (t.tenant_id IS NULL OR t.tenant_id = f.tenant_id)
);

-- 2. Find agents with invalid tools
SELECT a.id, unnest(a.tools) as tool_name
FROM agents a
WHERE NOT EXISTS (
    SELECT 1 FROM tools t WHERE t.name = ANY(a.tools)
);

-- 3. Find pipeline steps with invalid tools
SELECT ps.id, ps.tool
FROM pipeline_steps ps
WHERE ps.tool IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM tools t WHERE t.name = ps.tool
);

-- 4. Verify tool name uniqueness within tenant scope
SELECT tenant_id, name, COUNT(*)
FROM tools
GROUP BY tenant_id, name
HAVING COUNT(*) > 1;
```

### Rollback Plan
Each phase has corresponding down migration:
- `000100_capabilities_foundation.down.sql` - Drop new tables/columns
- `000110_tools_cleanup.down.sql` - Re-add dropped columns (requires data restore from backup)

---

## Testing Requirements

### Unit Tests
- [ ] Capability CRUD operations
- [ ] Tool-capability junction operations
- [ ] Agent-tool junction operations
- [ ] Finding creation with tool_id
- [ ] Tool resolution (name → ID)

### Integration Tests
- [ ] Finding ingestion with tool lookup
- [ ] Pipeline execution with tool selection
- [ ] Agent selection by capabilities
- [ ] API responses include tool_id

### Data Migration Tests
- [ ] Backfill script correctness
- [ ] Dual-write consistency
- [ ] Rollback functionality

---

## Timeline Estimate

| Phase | Description | Duration | Risk |
|-------|-------------|----------|------|
| Phase 1 | Foundation | 3-4 days | Low |
| Phase 2 | Dual-Write | 5-7 days | Medium |
| Phase 3 | New Schema Reads | 3-4 days | Medium |
| Phase 4 | Cleanup | 2-3 days | High |
| **Total** | | **13-18 days** | |

---

## Checklist Summary

### Database
- [ ] Create `capabilities` table
- [ ] Create `tool_capabilities` junction
- [ ] Create `step_capabilities` junction
- [ ] Create `agent_tools` junction
- [ ] Add `findings.tool_id`
- [ ] Add `pipeline_steps.tool_id`
- [ ] Add `rule_bundles.tool_id`
- [ ] Seed capabilities data
- [ ] Backfill tool_id columns
- [ ] Drop deprecated columns (Phase 4)

### Backend
- [ ] Capability entity & repository
- [ ] Update Tool entity
- [ ] Update Finding entity
- [ ] Update Agent entity
- [ ] Update services (dual-write)
- [ ] Update repositories (new queries)
- [ ] Update handlers (tool_id in responses)
- [ ] Backfill script
- [ ] Security validator updates

### Frontend
- [ ] Update TypeScript types
- [ ] Remove TOOL_CAPABILITIES_FALLBACK
- [ ] Update pipeline builder
- [ ] Update findings display

### Testing & Documentation
- [ ] Unit tests
- [ ] Integration tests
- [ ] Migration tests
- [ ] API documentation
- [ ] CLAUDE.MD updates

---

## Appendix: Edge Case Handling

### A. Platform Tool vs Tenant Custom Tool (Same Name)
```go
// Resolution order:
// 1. Tenant custom tool (tenant_id = current tenant)
// 2. Platform tool (tenant_id IS NULL)
func (s *ToolService) ResolveToolByName(ctx context.Context, tenantID shared.ID, name string) (*Tool, error) {
    // Try tenant-specific first
    tool, err := s.toolRepo.GetByTenantAndName(ctx, tenantID, name)
    if err == nil {
        return tool, nil
    }
    // Fallback to platform
    return s.toolRepo.GetPlatformToolByName(ctx, name)
}
```

### B. Tool Deleted After Pipeline Created
```go
// pipeline_steps.tool_id ON DELETE SET NULL
// At execution time, check if tool_id is NULL:
// - If NULL, find alternative tool by capabilities
// - If no alternative, fail with clear error
```

### C. Capability Removed from Tool
```go
// Audit trail: Keep capability_history table
// Notification: Alert pipeline owners when tool capabilities change
// Validation: Check at pipeline update time, not just execution
```

### D. Finding with Unknown Tool
```go
// If tool_name not in registry:
// - Set tool_id = NULL
// - Keep tool_name for reference
// - Log warning for admin review
```
