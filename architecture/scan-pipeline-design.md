---
layout: default
parent: Architecture
---
---
layout: default
title: Scan Pipeline Architecture
parent: Architecture
nav_order: 7
---
# Scan Pipeline Architecture

## Overview

Scan Pipelines allow tenants to define multi-step scanning workflows. Each step executes a specific tool, and steps can have dependencies, conditions, and pass data between them.

## Design Principles

1. **Declarative Configuration**: Pipelines defined as configuration, not code
2. **Flexible Orchestration**: Support sequential, parallel, and conditional execution
3. **Tool Agnostic**: Works with any Worker/Agent that has the required capabilities
4. **Reusable Templates**: Pre-built pipelines for common scenarios
5. **Observable**: Full visibility into pipeline execution status

## Core Concepts

### Pipeline vs Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Pipeline Template                             │
│  (Reusable definition - "Full Security Scan")                   │
├─────────────────────────────────────────────────────────────────┤
│  Step 1: SAST Scan (semgrep)                                    │
│     ↓                                                            │
│  Step 2: SCA Scan (trivy)                                       │
│     ↓                                                            │
│  Step 3: Secret Scan (gitleaks)                                 │
│     ↓                                                            │
│  Step 4: DAST Scan (nuclei) [if: has_web_assets]               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Pipeline Run (Instance)                       │
│  (Actual execution - "Run #123 on repo:webapp")                 │
├─────────────────────────────────────────────────────────────────┤
│  Step 1: ✓ Completed (12 findings)                              │
│  Step 2: ✓ Completed (3 findings)                               │
│  Step 3: ⏳ Running...                                           │
│  Step 4: ⏸ Pending (waiting for step 3)                         │
└─────────────────────────────────────────────────────────────────┘
```

### Model Hierarchy

```
Tenant
  └── Pipeline Templates (reusable definitions)
        └── Pipeline Steps (ordered tool executions)
              └── Step Configuration (tool settings, conditions)

Asset
  └── Pipeline Runs (actual executions)
        └── Step Runs (individual step executions)
              └── Commands (sent to Workers/Agents)
                    └── Findings (results)
```

## Entity Model

### Pipeline Template

```yaml
id: "pipeline-001"
tenant_id: "tenant-123"
name: "Full Security Scan"
description: "Complete security assessment pipeline"
trigger:
  - manual
  - schedule: "0 2 * * *"  # Daily at 2 AM
  - webhook: push
  - on_asset_discovery

steps:
  - id: "sast"
    name: "Static Analysis"
    order: 1
    tool: "semgrep"
    capabilities: ["sast"]
    config:
      rules: ["p/security-audit", "p/owasp-top-ten"]
      severity_threshold: "medium"
    timeout: "30m"

  - id: "sca"
    name: "Dependency Scan"
    order: 2
    tool: "trivy"
    capabilities: ["sca"]
    config:
      scan_type: "fs"
      ignore_unfixed: false
    timeout: "15m"
    depends_on: []  # Can run parallel with sast

  - id: "secrets"
    name: "Secret Detection"
    order: 3
    tool: "gitleaks"
    capabilities: ["secrets"]
    timeout: "10m"
    depends_on: []  # Can run parallel

  - id: "dast"
    name: "Dynamic Scan"
    order: 4
    tool: "nuclei"
    capabilities: ["dast"]
    config:
      templates: ["cves", "vulnerabilities", "exposures"]
      rate_limit: 100
    timeout: "60m"
    depends_on: ["sast", "sca", "secrets"]  # Wait for all static analysis
    condition:
      type: "expression"
      value: "asset.type == 'web_application' && asset.has_url"

  - id: "infra"
    name: "Infrastructure Scan"
    order: 5
    tool: "nmap"
    capabilities: ["infra"]
    config:
      ports: "1-65535"
      scripts: ["vulners"]
    timeout: "120m"
    depends_on: ["sast"]
    condition:
      type: "expression"
      value: "asset.type in ['server', 'network']"

settings:
  max_parallel_steps: 3
  fail_fast: false  # Continue other branches on failure
  retry_failed_steps: 2
  notification:
    on_completion: true
    on_failure: true
    channels: ["slack", "email"]
```

### Pipeline Run

```yaml
id: "run-001"
pipeline_id: "pipeline-001"
tenant_id: "tenant-123"
asset_id: "asset-456"
triggered_by: "user:admin@example.com"
trigger_type: "manual"

status: "running"  # pending, running, completed, failed, cancelled
started_at: "2024-01-15T10:00:00Z"
completed_at: null

context:
  repository: "https://github.com/example/webapp"
  branch: "main"
  commit: "abc123"

step_runs:
  - step_id: "sast"
    status: "completed"
    started_at: "2024-01-15T10:00:00Z"
    completed_at: "2024-01-15T10:15:00Z"
    worker_id: "worker-semgrep-01"
    command_id: "cmd-001"
    findings_count: 12

  - step_id: "sca"
    status: "running"
    started_at: "2024-01-15T10:00:00Z"
    worker_id: "worker-trivy-01"
    command_id: "cmd-002"

  - step_id: "secrets"
    status: "completed"
    started_at: "2024-01-15T10:00:00Z"
    completed_at: "2024-01-15T10:05:00Z"
    worker_id: "worker-gitleaks-01"
    findings_count: 1

  - step_id: "dast"
    status: "pending"
    condition_result: null  # Not evaluated yet

  - step_id: "infra"
    status: "skipped"
    condition_result: false
    skip_reason: "Condition not met: asset.type != 'server'"
```

## Database Schema

### pipeline_templates table

```sql
CREATE TABLE pipeline_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Basic info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version INT NOT NULL DEFAULT 1,

    -- Configuration (JSONB for flexibility)
    steps JSONB NOT NULL DEFAULT '[]',
    settings JSONB NOT NULL DEFAULT '{}',
    triggers JSONB NOT NULL DEFAULT '[]',

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_template BOOLEAN NOT NULL DEFAULT false,  -- System template

    -- Metadata
    tags TEXT[] DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),

    -- Constraints
    UNIQUE (tenant_id, name, version)
);

CREATE INDEX idx_pipeline_templates_tenant ON pipeline_templates(tenant_id);
CREATE INDEX idx_pipeline_templates_active ON pipeline_templates(tenant_id, is_active);
```

### pipeline_steps table (normalized for querying)

```sql
CREATE TABLE pipeline_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES pipeline_templates(id) ON DELETE CASCADE,

    -- Step definition
    step_key VARCHAR(100) NOT NULL,  -- Unique within pipeline
    name VARCHAR(255) NOT NULL,
    step_order INT NOT NULL,

    -- Tool requirements
    tool VARCHAR(100),              -- Preferred tool (optional)
    capabilities TEXT[] NOT NULL,   -- Required capabilities

    -- Configuration
    config JSONB NOT NULL DEFAULT '{}',
    timeout_seconds INT DEFAULT 1800,  -- 30 min default

    -- Dependencies
    depends_on TEXT[] DEFAULT '{}',    -- Step keys this depends on

    -- Conditions
    condition_type VARCHAR(50),        -- expression, asset_type, always, never
    condition_value TEXT,

    -- Retry settings
    max_retries INT DEFAULT 0,
    retry_delay_seconds INT DEFAULT 60,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE (pipeline_id, step_key)
);

CREATE INDEX idx_pipeline_steps_pipeline ON pipeline_steps(pipeline_id);
```

### pipeline_runs table

```sql
CREATE TABLE pipeline_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES pipeline_templates(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,

    -- Trigger info
    trigger_type VARCHAR(50) NOT NULL,  -- manual, schedule, webhook, api
    triggered_by VARCHAR(255),          -- user email, system, webhook name

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'timeout')),

    -- Context (inputs for the pipeline)
    context JSONB NOT NULL DEFAULT '{}',

    -- Results summary
    total_steps INT NOT NULL DEFAULT 0,
    completed_steps INT NOT NULL DEFAULT 0,
    failed_steps INT NOT NULL DEFAULT 0,
    skipped_steps INT NOT NULL DEFAULT 0,
    total_findings INT NOT NULL DEFAULT 0,

    -- Timing
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Error info
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pipeline_runs_pipeline ON pipeline_runs(pipeline_id);
CREATE INDEX idx_pipeline_runs_tenant ON pipeline_runs(tenant_id, created_at DESC);
CREATE INDEX idx_pipeline_runs_asset ON pipeline_runs(asset_id);
CREATE INDEX idx_pipeline_runs_status ON pipeline_runs(tenant_id, status);
```

### step_runs table

```sql
CREATE TABLE step_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_run_id UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    step_id UUID NOT NULL REFERENCES pipeline_steps(id),

    -- Step identification
    step_key VARCHAR(100) NOT NULL,
    step_order INT NOT NULL,

    -- Execution
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'queued', 'running', 'completed', 'failed', 'skipped', 'cancelled', 'timeout')),

    -- Worker/Agent assignment
    worker_id UUID REFERENCES workers(id),
    command_id UUID REFERENCES commands(id),

    -- Condition evaluation
    condition_evaluated BOOLEAN DEFAULT false,
    condition_result BOOLEAN,
    skip_reason TEXT,

    -- Results
    findings_count INT DEFAULT 0,
    output JSONB DEFAULT '{}',

    -- Retry tracking
    attempt INT NOT NULL DEFAULT 1,
    max_attempts INT NOT NULL DEFAULT 1,

    -- Timing
    queued_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Error info
    error_message TEXT,
    error_code VARCHAR(100),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_step_runs_pipeline_run ON step_runs(pipeline_run_id);
CREATE INDEX idx_step_runs_status ON step_runs(pipeline_run_id, status);
CREATE INDEX idx_step_runs_worker ON step_runs(worker_id);
CREATE INDEX idx_step_runs_command ON step_runs(command_id);
```

## Execution Flow

### Pipeline Orchestrator

```
┌─────────────────────────────────────────────────────────────────┐
│                    Pipeline Orchestrator                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Receive Pipeline Run Request                                │
│     ↓                                                            │
│  2. Load Pipeline Template + Steps                              │
│     ↓                                                            │
│  3. Build Execution Graph (DAG)                                 │
│     ↓                                                            │
│  4. Start Runnable Steps (no dependencies)                      │
│     ↓                                                            │
│  5. For each runnable step:                                     │
│     a. Evaluate conditions                                      │
│     b. Find suitable Worker/Agent                               │
│     c. Create Command                                           │
│     d. Dispatch to Worker/Agent                                 │
│     ↓                                                            │
│  6. Wait for step completion                                    │
│     ↓                                                            │
│  7. On step complete:                                           │
│     a. Update step_run status                                   │
│     b. Check dependent steps                                    │
│     c. Start newly runnable steps                               │
│     ↓                                                            │
│  8. Repeat until all steps done or failure                      │
│     ↓                                                            │
│  9. Update pipeline_run status                                  │
│     ↓                                                            │
│  10. Send notifications                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Step Execution State Machine

```
                    ┌─────────┐
                    │ PENDING │
                    └────┬────┘
                         │
            ┌────────────┼────────────┐
            │            │            │
            ▼            ▼            ▼
      ┌──────────┐  ┌────────┐  ┌─────────┐
      │ SKIPPED  │  │ QUEUED │  │CANCELLED│
      └──────────┘  └───┬────┘  └─────────┘
                        │
                        ▼
                   ┌─────────┐
                   │ RUNNING │
                   └────┬────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
          ▼             ▼             ▼
    ┌───────────┐ ┌──────────┐  ┌─────────┐
    │ COMPLETED │ │  FAILED  │  │ TIMEOUT │
    └───────────┘ └────┬─────┘  └─────────┘
                       │
                       ▼
                 [Retry Logic]
                       │
            ┌──────────┴──────────┐
            │                     │
            ▼                     ▼
       ┌────────┐           ┌──────────┐
       │ QUEUED │           │  FAILED  │
       │(retry) │           │ (final)  │
       └────────┘           └──────────┘
```

## Worker/Agent Matching

When dispatching a step, the orchestrator finds a suitable Worker/Agent:

```go
type WorkerMatcher struct {
    // Find best worker for a step
    func (m *WorkerMatcher) FindWorker(ctx context.Context, step *PipelineStep) (*Worker, error) {
        // 1. Filter by required capabilities
        candidates := m.repo.FindByCapabilities(ctx, step.Capabilities)

        // 2. Filter by preferred tool (if specified)
        if step.Tool != "" {
            candidates = filterByTool(candidates, step.Tool)
        }

        // 3. Filter by availability
        candidates = filterAvailable(candidates)

        // 4. Filter by tenant affinity (if multi-tenant workers)
        candidates = filterByTenant(candidates, step.TenantID)

        // 5. Select best candidate (load balancing)
        return selectBest(candidates)
    }
}
```

### Matching Priority

1. **Exact Tool Match**: Worker with specific tool (e.g., semgrep)
2. **Capability Match**: Worker with required capability (e.g., sast)
3. **Multi-Capability**: Worker that covers multiple steps
4. **Load Balance**: Least loaded worker

## API Endpoints

### Pipeline Templates

```
POST   /api/v1/pipelines                    # Create pipeline template
GET    /api/v1/pipelines                    # List pipelines
GET    /api/v1/pipelines/{id}               # Get pipeline details
PUT    /api/v1/pipelines/{id}               # Update pipeline
DELETE /api/v1/pipelines/{id}               # Delete pipeline
POST   /api/v1/pipelines/{id}/clone         # Clone pipeline

GET    /api/v1/pipelines/{id}/steps         # Get pipeline steps
POST   /api/v1/pipelines/{id}/steps         # Add step
PUT    /api/v1/pipelines/{id}/steps/{stepId}   # Update step
DELETE /api/v1/pipelines/{id}/steps/{stepId}   # Delete step
POST   /api/v1/pipelines/{id}/steps/reorder    # Reorder steps
```

### Pipeline Runs

```
POST   /api/v1/pipelines/{id}/run           # Trigger pipeline run
GET    /api/v1/pipeline-runs                # List runs
GET    /api/v1/pipeline-runs/{id}           # Get run details
POST   /api/v1/pipeline-runs/{id}/cancel    # Cancel run
POST   /api/v1/pipeline-runs/{id}/retry     # Retry failed steps

GET    /api/v1/pipeline-runs/{id}/steps     # Get step runs
GET    /api/v1/pipeline-runs/{id}/steps/{stepId}   # Get step run details
GET    /api/v1/pipeline-runs/{id}/steps/{stepId}/logs  # Get step logs
```

### Pipeline Templates (System)

```
GET    /api/v1/pipeline-templates           # List system templates
POST   /api/v1/pipeline-templates/{id}/use  # Create from template
```

## System Templates

Pre-built pipelines for common scenarios:

### 1. Full Security Scan

```yaml
name: "Full Security Scan"
description: "Complete security assessment for repositories"
steps:
  - sast (semgrep)
  - sca (trivy)
  - secrets (gitleaks)
  - iac (checkov)
  - dast (nuclei) [conditional]
```

### 2. Container Security

```yaml
name: "Container Security"
description: "Security scan for container images"
steps:
  - container_scan (trivy)
  - sbom_generation (syft)
  - vulnerability_check (grype)
```

### 3. API Security

```yaml
name: "API Security"
description: "Security testing for APIs"
steps:
  - api_discovery (swagger)
  - api_scan (nuclei)
  - fuzzing (ffuf)
```

### 4. Infrastructure Scan

```yaml
name: "Infrastructure Scan"
description: "Network and infrastructure security"
steps:
  - port_scan (nmap)
  - vuln_scan (nuclei)
  - ssl_check (testssl)
```

### 5. Continuous Monitoring

```yaml
name: "Continuous Monitoring"
description: "Lightweight continuous security check"
steps:
  - quick_sast (semgrep, limited rules)
  - sca_critical (trivy, critical only)
```

## Condition Expressions

Steps can have conditions that determine if they should run:

```yaml
# Simple asset type check
condition:
  type: "asset_type"
  value: "repository"

# Expression-based
condition:
  type: "expression"
  value: "asset.type == 'web_application' && asset.tags.contains('production')"

# Previous step result
condition:
  type: "step_result"
  step: "sast"
  check: "findings_count > 0"

# Always/Never
condition:
  type: "always"  # or "never"
```

### Expression Syntax

```
# Asset properties
asset.type                    # repository, domain, ip_address, etc.
asset.name                    # Asset name
asset.tags                    # Array of tags
asset.criticality             # critical, high, medium, low

# Step results (from previous steps)
steps.sast.status             # completed, failed
steps.sast.findings_count     # Number of findings
steps.sast.output.key         # Custom output values

# Context (pipeline run context)
context.branch                # Git branch
context.environment           # dev, staging, prod
context.user                  # User who triggered

# Operators
==, !=, <, >, <=, >=
&&, ||, !
contains(), startsWith(), endsWith()
in ['a', 'b', 'c']
```

## Integration with Worker/Agent Model

### Command Payload for Pipeline Steps

```json
{
  "id": "cmd-001",
  "type": "scan",
  "priority": "high",
  "payload": {
    "pipeline_run_id": "run-001",
    "step_id": "sast",
    "step_config": {
      "tool": "semgrep",
      "rules": ["p/security-audit"],
      "severity_threshold": "medium"
    },
    "target": {
      "type": "repository",
      "url": "https://github.com/example/webapp",
      "branch": "main",
      "commit": "abc123"
    },
    "output": {
      "format": "ctis",
      "include_assets": true
    }
  }
}
```

### Worker Response

```json
{
  "command_id": "cmd-001",
  "status": "completed",
  "result": {
    "findings_count": 12,
    "duration_ms": 45000,
    "scan_id": "scan-001"
  }
}
```

## Event-Driven Architecture

Pipeline events for real-time updates:

```yaml
events:
  - pipeline.run.started
  - pipeline.run.completed
  - pipeline.run.failed
  - pipeline.step.started
  - pipeline.step.completed
  - pipeline.step.failed
  - pipeline.step.skipped
```

### Event Payload

```json
{
  "event": "pipeline.step.completed",
  "timestamp": "2024-01-15T10:15:00Z",
  "data": {
    "pipeline_run_id": "run-001",
    "pipeline_name": "Full Security Scan",
    "step_id": "sast",
    "step_name": "Static Analysis",
    "status": "completed",
    "findings_count": 12,
    "duration_seconds": 900
  }
}
```

## Scheduling

Pipelines can be triggered on schedule:

```yaml
triggers:
  - type: "schedule"
    cron: "0 2 * * *"         # Daily at 2 AM
    timezone: "UTC"
    targets:
      - asset_filter: "tags.contains('production')"

  - type: "schedule"
    cron: "0 0 * * 0"         # Weekly on Sunday
    targets:
      - asset_type: "repository"
        criticality: "critical"
```

## Summary

The Pipeline architecture provides:

1. **Flexible Configuration**: YAML/JSON-based pipeline definitions
2. **DAG Execution**: Parallel and sequential step execution with dependencies
3. **Conditional Logic**: Skip/run steps based on conditions
4. **Worker Matching**: Automatic matching of steps to capable Workers/Agents
5. **Observability**: Full tracking of pipeline and step status
6. **Templates**: Pre-built pipelines for common scenarios
7. **Scheduling**: Cron-based and event-triggered execution

This design integrates seamlessly with the Worker/Agent model:
- Workers/Agents have **capabilities** and optional **tools**
- Pipeline steps require **capabilities** and optionally prefer specific **tools**
- Orchestrator matches steps to available Workers/Agents
- Commands are dispatched and results are tracked

The model supports the user's requirement of "step1 runs tool A, step2 runs tool B, etc." while providing enterprise-grade features like parallel execution, conditional logic, and comprehensive monitoring.
