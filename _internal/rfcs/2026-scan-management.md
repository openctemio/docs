# Scan Management Implementation Plan

**Status:** ✅ Completed
**Created:** 2026-01-18
**Last Updated:** 2026-01-26

---

This document outlines the comprehensive implementation plan for OpenCTEM's Scan Management system, inspired by best practices from reNgine and other security scanning platforms.

## Overview

The Scan Management system provides a complete solution for managing security scanning tools, workflows, and configurations. It enables users to:

- Manage security tools with centralized configuration
- Create reusable scan configurations
- Build visual workflows for multi-tool scanning
- Schedule automated scans
- Track execution statistics

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SCAN MANAGEMENT SYSTEM                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│  │    Tools     │     │    Scan      │     │   Pipelines  │            │
│  │   Registry   │     │   Profiles   │     │  (Workflows) │            │
│  │  (scanners)  │     │ (tool config)│     │    (DAG)     │            │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘            │
│         │                    │                    │                     │
│         └────────────────────┼────────────────────┘                     │
│                              │                                          │
│                              ▼                                          │
│                    ┌──────────────────┐                                 │
│                    │  Scan Configs    │                                 │
│                    │  ┌────────────┐  │                                 │
│                    │  │Asset Group │  │                                 │
│                    │  │Scanner/WF  │  │                                 │
│                    │  │Schedule    │  │                                 │
│                    │  │Tags        │  │                                 │
│                    │  └────────────┘  │                                 │
│                    └────────┬─────────┘                                 │
│                             │                                           │
│              ┌──────────────┼──────────────┐                            │
│              ▼              ▼              ▼                            │
│       ┌──────────┐   ┌──────────┐   ┌──────────┐                       │
│       │ Scheduler│   │  Manual  │   │ Webhook  │                       │
│       │  (cron)  │   │  Trigger │   │ Trigger  │                       │
│       └────┬─────┘   └────┬─────┘   └────┬─────┘                       │
│            └──────────────┼──────────────┘                              │
│                           ▼                                             │
│                    ┌──────────────┐                                     │
│                    │    Scans     │                                     │
│                    └──────┬───────┘                                     │
│                           ▼                                             │
│                    ┌──────────────┐                                     │
│                    │    Jobs      │ ──▶ Agents (Tags matching)          │
│                    └──────────────┘                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Tool Registry

**Status:** ✅ Completed

**Description:** Foundation for all tool-related features. Defines available scanners with their metadata, installation info, and default configurations.

#### Database Tables

- `tools` - System-wide tool definitions
- `tenant_tool_configs` - Tenant-specific configuration overrides
- `tool_executions` - Execution tracking for analytics

#### Key Features

- CRUD operations for tools
- Category-based organization (SAST, SCA, DAST, Secrets, IaC, Container, Recon, OSINT)
- Installation method tracking (go, pip, npm, docker, binary)
- Version management
- Capability-based tool discovery
- Tenant-specific configuration overrides
- Execution statistics and analytics

#### Files Created

**Backend:**
- `migrations/000023_tools.up.sql` - Database migration with seeded tools
- `migrations/000023_tools.down.sql` - Rollback migration
- `internal/domain/tool/entity.go` - Domain entities
- `internal/domain/tool/repository.go` - Repository interfaces
- `internal/infra/postgres/tool_repository.go` - Tool repository implementation
- `internal/infra/postgres/tenant_tool_config_repository.go` - Config repository
- `internal/infra/postgres/tool_execution_repository.go` - Execution repository
- `internal/app/tool_service.go` - Service layer

**Implemented:**
- `internal/infra/http/handler/tool_handler.go` - HTTP handlers ✅
- `internal/domain/permission/permission.go` - Tool permissions ✅
- `internal/infra/http/routes/scanning.go` - Routes registered ✅

**Frontend:**
- `src/lib/api/tool-types.ts` - TypeScript types ✅
- `src/lib/api/tool-hooks.ts` - SWR hooks ✅
- `src/features/tools/` - Tool management components ✅
- Settings > Scanning navigation ✅

#### Seeded Tools

| Tool | Category | Description |
|------|----------|-------------|
| Semgrep | SAST | Static code analysis |
| Nuclei | Vulnerability | Template-based scanner |
| Trivy | Container/SCA | Security scanner |
| Gitleaks | Secrets | Secret detection |
| TruffleHog | Secrets | Secrets scanner |
| Bandit | SAST | Python security |
| Checkov | IaC | Infrastructure as Code |
| KICS | IaC | IaC security |
| Grype | SCA | Vulnerability scanner |
| Syft | SCA | SBOM generator |
| OSV-Scanner | SCA | OSV database scanner |
| Subfinder | Recon | Subdomain discovery |
| httpx | Recon | HTTP probing |
| Naabu | Recon | Port scanning |
| Katana | Recon | Web crawling |

---

### Phase 2: Scans

**Status:** Implemented

**Description:** Binding entity that connects Asset Groups, Scanners/Workflows, and Schedules to create reusable scan configurations.

#### Database Schema

```sql
-- Note: Table renamed from scan_configurations to scans for REST API best practice
-- API endpoint: /api/v1/scans (not /api/v1/scan-configs)
CREATE TABLE IF NOT EXISTS scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,

    -- Target: Asset Group
    asset_group_id UUID NOT NULL REFERENCES asset_groups(id) ON DELETE CASCADE,

    -- Scan Type: Workflow OR Single Scanner
    scan_type VARCHAR(20) NOT NULL CHECK (scan_type IN ('workflow', 'single')),
    pipeline_id UUID REFERENCES pipeline_templates(id) ON DELETE SET NULL,
    scanner_name VARCHAR(100),
    scanner_config JSONB DEFAULT '{}',
    targets_per_job INTEGER DEFAULT 1,

    -- Schedule
    schedule_type VARCHAR(20) NOT NULL DEFAULT 'manual'
        CHECK (schedule_type IN ('manual', 'daily', 'weekly', 'monthly', 'crontab')),
    schedule_cron VARCHAR(100),
    schedule_day INTEGER,
    schedule_time TIME,
    schedule_timezone VARCHAR(50) DEFAULT 'UTC',
    next_run_at TIMESTAMPTZ,

    -- Routing
    tags TEXT[] DEFAULT '{}',
    run_on_tenant_runner BOOLEAN DEFAULT false,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'disabled')),

    -- Statistics
    last_run_id UUID,
    last_run_at TIMESTAMPTZ,
    last_run_status VARCHAR(20),
    total_runs INTEGER DEFAULT 0,
    successful_runs INTEGER DEFAULT 0,
    failed_runs INTEGER DEFAULT 0,

    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, name)
);
```

#### Key Features

- Two execution modes: Single Scan & Workflow
- Scheduling: Manual, Daily, Weekly, Monthly, Crontab
- Agent targeting via tags
- Tenant-only agent restriction
- Enable/disable toggle
- Run statistics tracking

#### UI Flow (3-step wizard)

1. **Step 1: Target Selection**
   - Select Asset Group

2. **Step 2: Scanner Selection**
   - Toggle between Workflow/Single Scan
   - Select Scanner or Workflow
   - Select Scan Profile (optional)

3. **Step 3: Configuration**
   - Name
   - Schedule (Manual/Daily/Weekly/Monthly/Crontab)
   - Tags for agent routing
   - Tenant agent only toggle
   - Enable/disable toggle

---

### Phase 3: Statistics Dashboard

**Status:** ✅ Completed

**Description:** Overview page with real-time statistics for Pipelines, Scans, and Jobs.

#### Components

1. **Stats Cards**
   - Pipelines: running, pending, completed, failed, canceled
   - Scans: running, pending, completed, failed, canceled
   - Jobs: running, pending, completed, failed, canceled

2. **Configurations List**
   - Search & filter
   - List of scan configs with:
     - Name
     - Asset Group
     - Scanner/Workflow type
     - Schedule
     - Status badge
     - Quick actions (Run, Edit, Delete)

3. **Quick Actions**
   - Add Configuration button
   - Bulk enable/disable
   - Bulk delete

---

### Phase 4: Visual Workflow Builder

**Status:** ✅ Completed (via Pipelines system)

**Description:** DAG-based visual workflow editor using React Flow.

#### Node Types

1. **Scanner Node**
   - Select tool from Tool Registry
   - Configure tool-specific options
   - Set input/output mapping

2. **Condition Node**
   - Branching based on results
   - Filter findings by severity
   - Continue on error options

3. **Parallel Node**
   - Run multiple scanners concurrently
   - Set max parallelism

4. **Aggregator Node**
   - Merge results from multiple branches
   - Deduplicate findings

#### Edge Configuration

- Data flow mapping
- Conditional execution
- Error handling

#### UI Components

```
┌─────────────────────────────────────────────────────────────────┐
│  Workflow: Recon Pipeline                        [Save] [Run]   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────┐                                                    │
│  │ Toolbar │ [Scanner] [Condition] [Parallel] [Aggregator]     │
│  └─────────┘                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│     ┌──────────┐                                                │
│     │ Subfinder│                                                │
│     └────┬─────┘                                                │
│          │                                                      │
│          ▼                                                      │
│     ┌──────────┐      ┌──────────┐                             │
│     │   httpx  │ ───▶ │  Nuclei  │                             │
│     └──────────┘      └──────────┘                             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Node Configuration                                             │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Scanner: Nuclei                                            │ │
│  │ Templates: [cves] [exposed-panels]                        │ │
│  │ Severity: [Medium] [High] [Critical]                      │ │
│  │ Rate Limit: 150 req/s                                     │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

### Phase 5: Advanced Scheduling

**Status:** ✅ Partially Completed (basic cron, timezone support)

**Description:** Enhanced scheduling with cron expressions, timezone support, and trigger types.

#### Features

- Cron expression builder UI
- Timezone-aware scheduling
- Webhook triggers
- Event-based triggers (new assets, findings, etc.)
- Schedule conflict detection
- Maintenance windows

---

## API Endpoints

### Tool Registry (Phase 1)

```
# Tools (System-wide)
GET    /api/v1/tools                    # List tools
GET    /api/v1/tools/:id                # Get tool by ID
GET    /api/v1/tools/name/:name         # Get tool by name
POST   /api/v1/tools                    # Create tool (admin)
PUT    /api/v1/tools/:id                # Update tool (admin)
DELETE /api/v1/tools/:id                # Delete tool (admin)
POST   /api/v1/tools/:id/activate       # Activate tool
POST   /api/v1/tools/:id/deactivate     # Deactivate tool

# Tenant Tool Configs
GET    /api/v1/tenant-tools             # List tenant tool configs
GET    /api/v1/tenant-tools/:tool_id    # Get config for tool
PUT    /api/v1/tenant-tools/:tool_id    # Update/create config
DELETE /api/v1/tenant-tools/:tool_id    # Delete config
POST   /api/v1/tenant-tools/bulk-enable # Bulk enable tools
POST   /api/v1/tenant-tools/bulk-disable # Bulk disable tools
GET    /api/v1/tenant-tools/:tool_id/effective-config # Get merged config

# Tool Executions
GET    /api/v1/tool-executions          # List executions
GET    /api/v1/tool-executions/:id      # Get execution details
GET    /api/v1/tool-stats               # Get tenant stats
GET    /api/v1/tool-stats/:tool_id      # Get tool stats
```

### Scans (Phase 2) - Implemented

```
# Scan Management
GET    /api/v1/scans                    # List scans
GET    /api/v1/scans/stats              # Get scan statistics
GET    /api/v1/scans/:id                # Get scan
POST   /api/v1/scans                    # Create scan
PUT    /api/v1/scans/:id                # Update scan
DELETE /api/v1/scans/:id                # Delete scan

# Status Operations
POST   /api/v1/scans/:id/activate       # Activate scan
POST   /api/v1/scans/:id/pause          # Pause scan
POST   /api/v1/scans/:id/disable        # Disable scan

# Execution
POST   /api/v1/scans/:id/trigger        # Trigger manual run
POST   /api/v1/scans/:id/clone          # Clone scan

# Scan Runs (Sub-resource)
GET    /api/v1/scans/:id/runs           # List runs for scan
GET    /api/v1/scans/:id/runs/latest    # Get latest run
GET    /api/v1/scans/:id/runs/:runId    # Get specific run
```

---

## Frontend Structure

### Tool Registry

```
src/features/tools/
├── components/
│   ├── index.ts
│   ├── tools-section.tsx           # Main container
│   ├── tool-card.tsx               # Card view
│   ├── tool-table.tsx              # Table view
│   ├── tool-detail-sheet.tsx       # Detail panel
│   ├── add-tool-dialog.tsx         # Create dialog
│   ├── edit-tool-dialog.tsx        # Edit dialog
│   ├── tool-config-form.tsx        # Tenant config form
│   └── tool-stats-card.tsx         # Statistics display
├── schemas/
│   ├── index.ts
│   └── tool-schema.ts              # Zod schemas
└── index.ts
```

### Scans

```
src/features/scan-configs/           # Note: folder kept as scan-configs for backwards compat
├── components/
│   ├── index.ts
│   ├── scan-configs-section.tsx    # Main container
│   ├── scan-config-list.tsx        # List view
│   ├── scan-config-stats.tsx       # Statistics cards
│   ├── create-config-wizard/       # Multi-step wizard
│   │   ├── index.tsx
│   │   ├── wizard-stepper.tsx
│   │   ├── step-asset-group.tsx    # Step 1
│   │   ├── step-scan-type.tsx      # Step 2
│   │   ├── step-configuration.tsx  # Step 3
│   │   └── types.ts
│   └── scan-config-detail-sheet.tsx
├── schemas/
│   └── scan-config-schema.ts
└── index.ts

# API types and hooks in lib/api/
src/lib/api/
├── scan-config-types.ts            # TypeScript types
├── scan-config-hooks.ts            # SWR hooks (uses scanEndpoints)
└── endpoints.ts                    # scanEndpoints for /api/v1/scans
```

---

## Permissions

### Tool Registry

```go
// Tool permissions (admin only for write)
ToolsRead   Permission = "tools:read"
ToolsWrite  Permission = "tools:write"   // Admin only
ToolsDelete Permission = "tools:delete"  // Admin only

// Tenant tool config permissions
TenantToolsRead   Permission = "tenant-tools:read"
TenantToolsWrite  Permission = "tenant-tools:write"
TenantToolsDelete Permission = "tenant-tools:delete"
```

### Scans

```go
// Permissions renamed from scan-configs:* to scans:* for REST API best practice
ScansRead   Permission = "scans:read"
ScansWrite  Permission = "scans:write"
ScansDelete Permission = "scans:delete"
```

---

## Integration with SDK

The Tool Registry integrates with `sdk` through:

1. **Scanner Interface**
   - Tools map to Scanner implementations
   - Capabilities match agent capabilities

2. **Command Polling**
   - Agents poll commands filtered by their capabilities
   - Tool execution creates commands with tool_id

3. **Ingest Input**
   - Tool results ingested through FindingsService
   - Output formats standardized (SARIF, JSON)

---

## Timeline Estimate

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Tool Registry Backend | ✅ Completed |
| 1 | Tool Registry Frontend | ✅ Completed |
| 2 | Scans Backend | ✅ Completed |
| 2 | Scans Frontend | ✅ Completed |
| 3 | Statistics Dashboard | ✅ Completed |
| 4 | Workflow Builder | ✅ Completed (via Pipelines) |
| 5 | Advanced Scheduling | ✅ Completed (basic cron, timezone)

---

## References

- reNgine Wiki: https://rengine.wiki
- React Flow: https://reactflow.dev
- Existing OpenCTEM architecture: `docs/architecture/overview.md`
