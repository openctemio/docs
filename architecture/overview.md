---
layout: default
title: System Overview
parent: Architecture
nav_order: 1
---
# Architecture Overview

This document describes the architecture of the OpenCTEM platform.

## System Architecture

```
                                    ┌─────────────────────────────────────────────┐
                                    │              Load Balancer / CDN            │
                                    └─────────────────────────────────────────────┘
                                                         │
                          ┌──────────────────────────────┼──────────────────────────────┐
                          │                              │                              │
                          ▼                              ▼                              ▼
               ┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
               │   ui        │      │   api       │      │   keycloak  │
               │   (Next.js 16)      │      │   (Go)              │      │   (Optional)        │
               │   Port: 3000        │      │   Port: 8080        │      │   Port: 8180        │
               └─────────────────────┘      └─────────────────────┘      └─────────────────────┘
                          │                              │                              │
                          │                              │                              │
                          │         ┌────────────────────┼────────────────────┐        │
                          │         │                    │                    │        │
                          │         ▼                    ▼                    ▼        │
                          │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
                          │  │ PostgreSQL  │    │   Redis     │    │ PostgreSQL  │    │
                          │  │ Port: 5432  │    │ Port: 6379  │    │ (Keycloak)  │    │
                          │  └─────────────┘    └─────────────┘    └─────────────┘    │
                          │                                                            │
                          └────────────────────────────────────────────────────────────┘
```

## Component Overview

### Frontend (ui)

**Technology Stack:**
- Next.js 16 (App Router, React Server Components)
- React 19
- TypeScript (strict mode)
- Tailwind CSS 4
- shadcn/ui components
- Zustand (global state)
- SWR (data fetching)

**Architecture Pattern:** Feature-based architecture

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication routes
│   ├── (dashboard)/       # Protected dashboard routes
│   ├── api/               # API routes (BFF pattern)
│   └── layout.tsx         # Root layout
│
├── features/              # Feature modules (26 modules)
│   │ # Assets & Discovery
│   ├── assets/            # Asset management
│   ├── asset-groups/      # Asset organization
│   ├── asset-types/       # Asset type definitions
│   ├── repositories/      # Code repositories
│   ├── components/        # Software components
│   ├── attack-surface/    # Attack surface view
│   │
│   │ # Security
│   ├── findings/          # Vulnerability findings
│   ├── scans/             # Scan jobs
│   ├── scan-profiles/     # Scan configurations
│   ├── pentest/           # Pentest management
│   ├── remediation/       # Remediation tracking
│   │
│   │ # Tools & Workers
│   ├── tools/             # Tool registry
│   ├── workers/           # Scanner agents
│   ├── agents/            # Agent management
│   │
│   │ # Configuration
│   ├── scope/             # Scope configuration
│   ├── scm-connections/   # SCM integrations
│   ├── integrations/      # External integrations
│   │
│   │ # Platform
│   ├── dashboard/         # Main dashboard
│   ├── auth/              # Authentication
│   ├── tenant/            # Tenant/Team management
│   ├── organization/      # Organization settings
│   │
│   │ # Business
│   ├── business-units/    # Business unit tracking
│   ├── crown-jewels/      # Critical assets
│   ├── compliance/        # Compliance tracking
│   ├── identities/        # Identity management
│   └── shared/            # Shared utilities
│
├── components/            # Shared components
│   ├── ui/               # shadcn/ui primitives
│   └── layout/           # Layout components
│
├── stores/               # Zustand stores
├── context/              # React Context providers
├── lib/                  # Utilities
└── hooks/                # Global hooks
```

### Backend (api)

**Technology Stack:**
- Go 1.25
- Chi router (standard net/http)
- PostgreSQL 17
- Redis 7
- Structured logging (slog)

**Architecture Pattern:** Clean Architecture / Hexagonal Architecture

```
cmd/
└── server/               # Application entry point

internal/
├── domain/               # Core Business Logic (innermost layer) - 24 modules
│   ├── shared/          # Shared domain types (ID, errors)
│   │
│   │ # Asset & Discovery
│   ├── asset/           # Asset management
│   ├── assetgroup/      # Asset grouping/organization
│   ├── assettype/       # Asset type definitions
│   ├── branch/          # Git branch management
│   ├── component/       # Software components (SBOM)
│   ├── scmconnection/   # SCM integrations (GitHub, GitLab)
│   │
│   │ # Security
│   ├── vulnerability/   # Vulnerability/Finding tracking
│   ├── scan/            # Scan jobs
│   ├── scanprofile/     # Scan configurations
│   ├── scansession/     # Agent scan tracking
│   │
│   │ # Tools & Workers
│   ├── tool/            # Security tools registry
│   ├── toolcategory/    # Tool categorization
│   ├── capability/      # Tool capabilities (sast, sca, dast, etc.)
│   ├── worker/          # Scanner/Agent workers
│   ├── command/         # Remote commands for agents
│   ├── pipeline/        # Workflow pipelines
│   ├── datasource/      # Data ingestion sources
│   ├── rule/            # Custom rules/templates management
│   │
│   │ # Platform
│   ├── tenant/          # Multi-tenancy
│   ├── user/            # User management
│   ├── session/         # User sessions
│   ├── permission/      # Permission definitions
│   ├── scope/           # Scope configuration
│   ├── sla/             # SLA management
│   └── audit/           # Audit logging
│
├── app/                  # Application Layer (use cases) - 30+ services
│   │
│   │ # Sub-packages (Clean Architecture)
│   ├── pipeline/            # Pipeline orchestration service
│   │   ├── service.go       # Service + interfaces
│   │   ├── template.go      # Template CRUD operations
│   │   ├── step.go          # Step management
│   │   ├── run.go           # Pipeline execution
│   │   └── adapters.go      # Adapter patterns
│   │
│   ├── scan/                # Scan configuration service
│   │   ├── service.go       # Service + interfaces
│   │   ├── crud.go          # CRUD operations
│   │   ├── trigger.go       # Scan triggering
│   │   └── run.go           # Quick scan execution
│   │
│   ├── ingest/              # Data ingestion
│   │   └── service.go
│   │
│   │ # Flat services
│   ├── adapters.go          # Interface adapters for sub-packages
│   ├── asset_service.go
│   ├── asset_group_service.go
│   ├── asset_type_service.go
│   ├── auth_service.go
│   ├── attack_surface_service.go
│   ├── audit_service.go
│   ├── agent_selector.go    # Agent selection logic
│   ├── branch_service.go
│   ├── command_service.go
│   ├── component_service.go
│   ├── dashboard_service.go
│   ├── email_service.go
│   ├── finding_comment_service.go
│   ├── oauth_service.go
│   ├── rule_service.go
│   ├── scanprofile_service.go
│   ├── scansession_service.go
│   ├── scope_service.go
│   ├── security_validator.go # Security validation
│   ├── session_service.go
│   ├── sla_service.go
│   ├── tenant_service.go
│   ├── tool_service.go
│   ├── toolcategory_service.go
│   ├── capability_service.go
│   ├── user_service.go
│   ├── vulnerability_service.go
│   └── workflow_service.go
│
└── infra/               # Infrastructure Layer (outermost layer)
    ├── http/            # HTTP adapter
    │   ├── server.go    # HTTP server
    │   ├── routes.go    # Route definitions
    │   ├── handler/     # HTTP handlers (30+)
    │   └── middleware/  # HTTP middleware
    ├── postgres/        # PostgreSQL adapter (24+ repositories)
    └── redis/           # Redis adapter
        └── cache.go

pkg/                      # Public packages
├── logger/              # Structured logging
├── pagination/          # Pagination helpers
└── apierror/            # API error types
```

### Dependency Flow

```
HTTP Request
     │
     ▼
┌─────────────────┐
│   HTTP Handler  │  ◄── Infrastructure Layer
│   (infra/http)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   App Service   │  ◄── Application Layer
│   (app/)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Domain Service  │  ◄── Domain Layer
│ (domain/)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Repository     │  ◄── Infrastructure Layer
│  (infra/*)      │      (implements domain interface)
└─────────────────┘
```

**Key Principles:**
1. **Domain layer has no external dependencies**
2. **Dependencies point inward** (outer layers depend on inner)
3. **Interfaces defined in domain**, implemented in infra
4. **Use cases orchestrate** domain logic

### Sub-Package Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Application Layer (app/)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐     ┌──────────────────┐                         │
│  │ pipeline/        │     │ scan/            │                         │
│  │ ├─ Service       │     │ ├─ Service       │                         │
│  │ ├─ interfaces    │     │ ├─ interfaces    │                         │
│  │ └─ adapters      │     │ └─ adapters      │                         │
│  └────────┬─────────┘     └────────┬─────────┘                         │
│           │                        │                                    │
│           │    ┌───────────────────┘                                    │
│           │    │                                                        │
│           ▼    ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │                    adapters.go                            │          │
│  │  ┌────────────────────────────────────────────────────┐  │          │
│  │  │ Adapts app services to sub-package interfaces:     │  │          │
│  │  │ • NewScanAuditServiceAdapter(AuditService)         │  │          │
│  │  │ • NewPipelineAuditServiceAdapter(AuditService)     │  │          │
│  │  │ • NewScanAgentSelectorAdapter(AgentSelector)       │  │          │
│  │  │ • NewPipelineAgentSelectorAdapter(AgentSelector)   │  │          │
│  │  │ • NewScanSecurityValidatorAdapter(SecurityValidator)│  │          │
│  │  │ • NewPipelineSecurityValidatorAdapter(...)         │  │          │
│  │  │ • NewScanTemplateSyncerAdapter(TemplateSyncer)     │  │          │
│  │  └────────────────────────────────────────────────────┘  │          │
│  └──────────────────────────────────────────────────────────┘          │
│           │                                                             │
│           ▼                                                             │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │              Concrete App Services                        │          │
│  │  ┌─────────────────┐  ┌─────────────────┐                │          │
│  │  │ AuditService    │  │ AgentSelector   │                │          │
│  │  └─────────────────┘  └─────────────────┘                │          │
│  │  ┌─────────────────┐  ┌─────────────────┐                │          │
│  │  │ SecurityValidator│  │ TemplateSyncer  │                │          │
│  │  └─────────────────┘  └─────────────────┘                │          │
│  └──────────────────────────────────────────────────────────┘          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

Sub-package Interface Pattern:
┌─────────────────────────────────────────────────────────────┐
│  pipeline/service.go defines:                                │
│  • AuditService interface                                   │
│  • AgentSelector interface                                  │
│  • SecurityValidator interface                              │
│  • ValidationResult, AuditContext, etc.                     │
│                                                              │
│  scan/service.go defines:                                    │
│  • AuditService interface (similar, different context)      │
│  • AgentSelector interface                                  │
│  • SecurityValidator interface                              │
│  • TemplateSyncer interface                                 │
│  • ValidationResult, AgentAvailability, etc.                │
└─────────────────────────────────────────────────────────────┘

Benefits:
1. Each sub-package defines ONLY the interfaces it needs
2. No shared package = no import cycles
3. Adapters bridge concrete implementations to sub-package interfaces
4. Sub-packages are independently testable with mocks
```

### Scan ↔ Pipeline Relationship

```
                    ┌──────────────────┐
                    │   Webhook/API    │
                    │   Manual Trigger │
                    │   Schedule       │
                    │   Asset Trigger  │
                    └────────┬─────────┘
                             │ triggers directly
                             ▼
┌─────────────┐       ┌──────────────────┐
│   Scan      │──────▶│    Pipeline      │
│ (workflow   │ uses  │   (Orchestrator) │
│   type)     │       └──────────────────┘
└─────────────┘              ▲
      │                      │
      │ OR                   │
      ▼                      │
┌─────────────┐              │
│   Scan      │──────────────┘
│ (single     │  triggers pipeline
│   type)     │  run directly
└─────────────┘

Key Points:
• Pipeline can run WITHOUT Scan (webhook, manual, schedule triggers)
• Scan can run WITHOUT Pipeline (single scanner type)
• Scan optionally USES Pipeline for workflow execution
• One-way dependency: Scan → Pipeline (never reverse)
```

## Authentication Flow

### Local Authentication (2-Step Token Flow)

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Client  │     │   Next.js    │     │   Go API     │
└────┬─────┘     └──────┬───────┘     └──────┬───────┘
     │                  │                    │
     │ 1. Login Form    │                    │
     │─────────────────>│                    │
     │                  │ 2. POST /auth/login│
     │                  │───────────────────>│
     │                  │                    │ Verify creds
     │                  │ 3. refresh_token   │ Create session
     │                  │    + tenants[]     │
     │                  │<───────────────────│
     │                  │                    │
     │                  │ 4. POST /auth/token│
     │                  │    {tenant_id}     │
     │                  │───────────────────>│
     │                  │                    │ Validate tenant
     │                  │ 5. access_token    │ membership
     │                  │    (tenant-scoped) │
     │                  │<───────────────────│
     │                  │                    │
     │ 6. Set Cookies   │                    │
     │    - refresh (httpOnly)               │
     │    - access (httpOnly)                │
     │<─────────────────│                    │
     │                  │                    │
     │ 7. API Request   │                    │
     │    Authorization: Bearer <access>     │
     │─────────────────>│───────────────────>│
     │                  │                    │ Verify JWT
     │                  │                    │ Extract tenant_id
     │ 8. Response      │                    │
     │<─────────────────│<───────────────────│
```

**Token Types:**
- `refresh_token`: Global, 7 days, httpOnly cookie
- `access_token`: Tenant-scoped, 15 min, httpOnly cookie

### OIDC Authentication (Keycloak)

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Client  │     │   Next.js    │     │   Keycloak   │     │   Go API     │
└────┬─────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
     │                  │                    │                    │
     │ 1. Login Click   │                    │                    │
     │─────────────────>│                    │                    │
     │                  │ 2. Redirect to KC  │                    │
     │<─────────────────│───────────────────>│                    │
     │ 3. KC Login Form │                    │                    │
     │─────────────────────────────────────>│                    │
     │ 4. Redirect + Code                    │                    │
     │<──────────────────────────────────────│                    │
     │─────────────────>│                    │                    │
     │                  │ 5. Exchange Code   │                    │
     │                  │───────────────────>│                    │
     │                  │ 6. ID + Access     │                    │
     │                  │<───────────────────│                    │
     │ 7. Set Cookies   │                    │                    │
     │<─────────────────│                    │                    │
     │                  │                    │                    │
     │ 8. API Request   │                    │                    │
     │─────────────────>│───────────────────────────────────────>│
     │                  │                    │ 9. Verify via JWKS │
     │<─────────────────│<───────────────────────────────────────│
```

**Details:** See [Authentication Guide](./authentication-guide.md)

## Data Flow

### Request Lifecycle (Backend)

```
1. HTTP Request
       │
       ▼
2. Middleware Chain
   ├── Request ID
   ├── Logger
   ├── Recovery (panic handling)
   ├── CORS
   ├── Rate Limiter
   └── Auth (JWT validation)
       │
       ▼
3. Router (chi)
       │
       ▼
4. Handler
   ├── Parse request
   ├── Validate input
   └── Call service
       │
       ▼
5. Application Service
   ├── Business logic
   └── Call repository
       │
       ▼
6. Repository
   ├── Database query
   └── Return data
       │
       ▼
7. Response
   └── JSON response
```

### State Management (Frontend)

```
┌─────────────────────────────────────────────────────────────┐
│                        Client State                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │  Zustand Store  │    │  React Context  │                │
│  │  (Global State) │    │  (UI State)     │                │
│  │                 │    │                 │                │
│  │  - Auth state   │    │  - Theme        │                │
│  │  - User data    │    │  - Direction    │                │
│  │                 │    │  - Layout       │                │
│  └─────────────────┘    └─────────────────┘                │
│           │                      │                          │
│           └──────────┬───────────┘                          │
│                      ▼                                      │
│  ┌─────────────────────────────────────────┐               │
│  │           React Components               │               │
│  │  (Server Components + Client Components) │               │
│  └─────────────────────────────────────────┘               │
│                      │                                      │
└──────────────────────┼──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                       Server State                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │  Server Actions │    │  SWR Cache      │                │
│  │  (Mutations)    │    │  (Data Fetching)│                │
│  └─────────────────┘    └─────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

## Rule Management Workflow

The Rule Management system allows tenants to add custom security rules/templates for scanning tools.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Rule Management System                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────┐                 │
│  │  Git Repos    │   │  HTTP URLs    │   │  Local Files  │                 │
│  │  (custom)     │   │  (vendor)     │   │  (testing)    │                 │
│  └───────┬───────┘   └───────┬───────┘   └───────┬───────┘                 │
│          │                   │                   │                          │
│          └───────────────────┼───────────────────┘                          │
│                              │                                               │
│                              ▼                                               │
│          ┌─────────────────────────────────────────┐                        │
│          │            Rule Sources                  │                        │
│          │  - Sync scheduler (cron-based)           │                        │
│          │  - Content hash change detection         │                        │
│          │  - YAML rule parsing                     │                        │
│          └───────────────────┬─────────────────────┘                        │
│                              │                                               │
│                              ▼                                               │
│          ┌─────────────────────────────────────────┐                        │
│          │            Rules Database                │                        │
│          │  - Rule metadata extraction              │                        │
│          │  - Severity, category, tags              │                        │
│          │  - CWE/OWASP mapping                     │                        │
│          └───────────────────┬─────────────────────┘                        │
│                              │                                               │
│              ┌───────────────┴───────────────┐                              │
│              │                               │                               │
│              ▼                               ▼                               │
│  ┌─────────────────────┐       ┌─────────────────────┐                     │
│  │   Rule Overrides    │       │   Rule Bundles      │                     │
│  │ - Enable/disable    │       │ - Compiled tar.gz   │                     │
│  │ - Severity change   │       │ - manifest.json     │                     │
│  │ - Pattern matching  │       │ - Version tracking  │                     │
│  │ - Asset group scope │       │ - Content hash      │                     │
│  └─────────────────────┘       └──────────┬──────────┘                     │
│                                           │                                  │
│                                           ▼                                  │
│                            ┌─────────────────────────┐                      │
│                            │    Object Storage       │                      │
│                            │    (S3/MinIO)           │                      │
│                            │    Workers download     │                      │
│                            └─────────────────────────┘                      │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Rule Sync Flow

```
1. Sync Trigger (scheduled or manual)
       │
       ▼
2. Fetch Source Content
   ├── Git: clone/pull with auth
   ├── HTTP: download archive
   └── Local: read filesystem
       │
       ▼
3. Calculate Content Hash
   ├── Compare with previous hash
   └── Skip if unchanged
       │
       ▼
4. Parse YAML Rules
   ├── Extract metadata (id, name, severity)
   ├── Extract category, tags
   └── Map CWE/OWASP references
       │
       ▼
5. Update Database
   ├── Add new rules
   ├── Update changed rules
   └── Mark removed rules
       │
       ▼
6. Record Sync History
   └── rules_added, rules_updated, rules_removed
```

### Bundle Build Flow

```
1. Trigger Build (post-sync or manual)
       │
       ▼
2. Gather Enabled Sources
   ├── Filter by tool_id
   └── Sort by priority (higher = precedence)
       │
       ▼
3. Merge Rules
   ├── Higher priority sources override
   └── Apply tenant overrides
       │
       ▼
4. Create Archive
   ├── rules/ directory with all rules
   ├── manifest.json with metadata
   └── config.yaml with tool settings
       │
       ▼
5. Upload to Object Storage
   └── bundles/{tenant}/{tool}-{version}.tar.gz
       │
       ▼
6. Update Bundle Record
   └── status: ready, storage_path, content_hash
```

### Worker Download Flow

```
1. Worker Starts Scan
       │
       ▼
2. Check Bundle Version
   ├── GET /api/v1/rules/bundles/latest?tool_id=xxx
   └── Compare content_hash with cached bundle
       │
       ▼
3. Download if Changed
   ├── GET {storage_path} from S3
   └── Extract to local rules directory
       │
       ▼
4. Apply Overrides
   ├── Load tenant-specific overrides
   └── Enable/disable rules as configured
       │
       ▼
5. Execute Scan with Custom Rules
```

### Database Tables

```sql
-- Rule Sources (Git repos, HTTP URLs, etc.)
CREATE TABLE rule_sources (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    tool_id UUID REFERENCES tools(id),
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(20) NOT NULL,
    config JSONB NOT NULL,
    sync_enabled BOOLEAN DEFAULT true,
    sync_interval_minutes INTEGER DEFAULT 60,
    priority INTEGER DEFAULT 100,
    last_sync_at TIMESTAMPTZ,
    content_hash VARCHAR(64)
);

-- Parsed Rules
CREATE TABLE rules (
    id UUID PRIMARY KEY,
    source_id UUID REFERENCES rule_sources(id),
    tenant_id UUID REFERENCES tenants(id),
    tool_id UUID REFERENCES tools(id),
    rule_id VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    severity VARCHAR(20),
    category VARCHAR(100),
    content_hash VARCHAR(64)
);

-- Rule Overrides
CREATE TABLE rule_overrides (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    tool_id UUID REFERENCES tools(id),
    rule_pattern VARCHAR(500) NOT NULL,
    is_pattern BOOLEAN DEFAULT false,
    enabled BOOLEAN DEFAULT true,
    severity_override VARCHAR(20),
    expires_at TIMESTAMPTZ
);

-- Compiled Bundles
CREATE TABLE rule_bundles (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    tool_id UUID REFERENCES tools(id),
    version VARCHAR(50),
    content_hash VARCHAR(64),
    rule_count INTEGER,
    storage_path VARCHAR(500),
    status VARCHAR(20)
);
```

---

## Database Schema

### Table Overview (39+ Migrations)

| Category | Tables |
|----------|--------|
| **Auth & Users** | users, sessions, user_tenants |
| **Multi-tenancy** | tenants, tenant_members, tenant_invitations |
| **Assets** | assets, asset_groups, asset_types, asset_group_members |
| **Security** | vulnerabilities, findings, finding_comments, exposures |
| **Components** | components, branches |
| **Scans** | scans, scan_profiles, scan_sessions |
| **Tools** | tools, tool_categories |
| **Workers** | workers, commands, data_sources |
| **Rules** | rule_sources, rules, rule_overrides, rule_bundles, rule_sync_history |
| **Workflows** | pipelines, pipeline_stages, pipeline_runs, pipeline_stage_runs |
| **Configuration** | scope_configurations, scm_connections, sla_policies |
| **Audit** | audit_logs |

### Key Tables

```sql
-- Multi-tenant assets (all resources are tenant-scoped)
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    value TEXT NOT NULL,
    criticality VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'active',
    risk_score INTEGER DEFAULT 0,
    owner VARCHAR(255),
    owner_email VARCHAR(255),
    business_unit VARCHAR(255),
    metadata JSONB,
    created_by UUID REFERENCES users(id),
    worker_id UUID REFERENCES workers(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Findings with deduplication
CREATE TABLE findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id),
    worker_id UUID REFERENCES workers(id),
    scan_session_id UUID REFERENCES scan_sessions(id),
    fingerprint TEXT NOT NULL,          -- deduplication key
    title VARCHAR(500) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,          -- vulnerability, secret, etc.
    severity VARCHAR(20) NOT NULL,
    confidence INTEGER DEFAULT 70,
    status VARCHAR(20) DEFAULT 'open',
    location JSONB,
    vulnerability JSONB,
    remediation JSONB,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, fingerprint)
);

-- Workers (scanners, agents, collectors)
CREATE TABLE workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,          -- scanner, agent, collector
    status VARCHAR(20) DEFAULT 'inactive',
    api_key_hash TEXT NOT NULL,
    capabilities TEXT[],
    last_heartbeat_at TIMESTAMPTZ,
    config JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tool categories
CREATE TABLE tool_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'folder',
    color VARCHAR(20) DEFAULT 'gray',
    is_builtin BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    UNIQUE NULLS NOT DISTINCT (tenant_id, name)
);

-- Scan sessions (agent execution tracking)
CREATE TABLE scan_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES workers(id),
    tool_id UUID REFERENCES tools(id),
    scan_id UUID REFERENCES scans(id),
    status VARCHAR(20) DEFAULT 'pending',
    target TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    findings_count INTEGER DEFAULT 0,
    error_message TEXT
);
```

## Caching Strategy

### Redis Usage

```
┌─────────────────────────────────────────────┐
│                Redis Cache                   │
├─────────────────────────────────────────────┤
│                                              │
│  Session Storage                             │
│  ├── session:{user_id} → session data       │
│  └── TTL: AUTH_SESSION_DURATION             │
│                                              │
│  Rate Limiting                               │
│  ├── ratelimit:{ip} → request count         │
│  └── TTL: 1 minute (sliding window)         │
│                                              │
│  API Cache                                   │
│  ├── cache:assets:list → cached response    │
│  └── TTL: 5 minutes                         │
│                                              │
│  JWKS Cache (Keycloak)                       │
│  ├── jwks:{realm} → public keys             │
│  └── TTL: KEYCLOAK_JWKS_REFRESH_INTERVAL    │
│                                              │
└─────────────────────────────────────────────┘
```

## Security Architecture

### Defense in Depth

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Network                                             │
│ ├── TLS/HTTPS                                               │
│ ├── Firewall rules                                          │
│ └── Rate limiting at load balancer                          │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Application Gateway                                 │
│ ├── CORS policy                                             │
│ ├── Request validation                                      │
│ └── Rate limiting                                           │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Authentication                                      │
│ ├── JWT validation                                          │
│ ├── Session management                                      │
│ └── CSRF protection                                         │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: Authorization                                       │
│ ├── Role-based access control (RBAC)                        │
│ ├── Resource-level permissions                              │
│ └── Audit logging                                           │
├─────────────────────────────────────────────────────────────┤
│ Layer 5: Data                                               │
│ ├── Input validation (Zod schemas)                          │
│ ├── SQL injection prevention (parameterized queries)        │
│ ├── Encryption at rest                                      │
│ └── Encryption in transit                                   │
└─────────────────────────────────────────────────────────────┘
```

## Deployment Architecture

### Production Setup

```
                    ┌─────────────────────────────────────┐
                    │           CDN (CloudFlare)           │
                    │         Static Assets Cache          │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────┴───────────────────┐
                    │        Load Balancer (nginx)         │
                    │         SSL Termination              │
                    └─────────────────┬───────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Frontend Pod   │      │  Backend Pod    │      │  Keycloak Pod   │
│  (Next.js)      │      │  (Go)           │      │                 │
│  Replicas: 2-4  │      │  Replicas: 2-4  │      │  Replicas: 2    │
└─────────────────┘      └─────────────────┘      └─────────────────┘
          │                           │                           │
          └───────────────────────────┼───────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   PostgreSQL    │      │     Redis       │      │   PostgreSQL    │
│   Primary +     │      │   Cluster       │      │   (Keycloak)    │
│   Replicas      │      │   Sentinel      │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

## Monitoring & Observability

```
┌─────────────────────────────────────────────────────────────┐
│                    Observability Stack                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Metrics (Prometheus)                                        │
│  ├── HTTP request duration                                  │
│  ├── Request count by status                                │
│  ├── Database connection pool                               │
│  └── Custom business metrics                                │
│                                                              │
│  Logging (Structured JSON)                                   │
│  ├── Request/Response logs                                  │
│  ├── Error logs with stack traces                           │
│  ├── Audit logs                                             │
│  └── Aggregated in ELK/Loki                                 │
│                                                              │
│  Tracing (OpenTelemetry)                                    │
│  ├── Distributed request tracing                            │
│  ├── Database query tracing                                 │
│  └── External API call tracing                              │
│                                                              │
│  Error Tracking (Sentry)                                    │
│  ├── Frontend errors                                        │
│  ├── Backend errors                                         │
│  └── Source map support                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Related Documentation

- [Backend Architecture](./)
- [Frontend Architecture](../ui/.claude/architecture.md)
- [API Documentation](../api/docs/api/)
