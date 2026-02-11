---
layout: default
title: Scan Pipelines
parent: Features
nav_order: 7
---
{% raw %}

# Scan Pipelines

## Overview

Pipelines orchestrate security scan execution. Unlike Workflows (which handle event-driven automation), Pipelines define multi-step scanning sequences with dependency management, parallel execution, and visual workflow building.

## Key Concepts

### Pipelines vs Workflows

| Feature | Pipelines | Workflows |
|---------|-----------|-----------|
| **Purpose** | Orchestrate scan execution | Automate responses to events |
| **Steps/Nodes** | Scan stages (tools/scanners) | Actions (notifications, tickets) |
| **Execution** | Sequential or parallel scans | Event-driven automation |
| **Builder** | Visual workflow builder | Visual graph builder |
| **Output** | Security findings | Status updates, tickets |

### Pipeline Structure

A pipeline consists of steps that execute security tools in a defined order:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Pipeline Structure                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│   │  START   │───▶│  STEP 1  │───▶│  STEP 2  │───▶│   END    │  │
│   │          │    │  (amass) │    │ (nuclei) │    │          │  │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                         │                                        │
│                         ▼                                        │
│                   ┌──────────┐                                   │
│                   │  STEP 3  │                                   │
│                   │(subfinder)│                                  │
│                   └──────────┘                                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Step Types

### 1. Scanner Steps

Execute security scanning tools.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Step display name |
| `tool` | string | Tool identifier (e.g., nuclei, amass) |
| `capabilities` | string[] | Required capabilities |
| `config` | object | Tool-specific configuration |
| `timeout_seconds` | int | Step timeout |
| `retry_count` | int | Retry on failure |

**Example: Nuclei Scan Step**
```json
{
  "step_key": "vuln_scan",
  "name": "Vulnerability Scan",
  "tool": "nuclei",
  "capabilities": ["security", "web"],
  "config": {
    "templates": ["cves", "vulnerabilities"],
    "severity": ["critical", "high"],
    "rate_limit": 100
  },
  "timeout_seconds": 1800,
  "retry_count": 1
}
```

### 2. Transform Steps

Process data between scanner steps.

**Example: Deduplicate Results**
```json
{
  "step_key": "dedupe",
  "name": "Deduplicate Subdomains",
  "tool": "internal:dedupe",
  "capabilities": ["data", "transform"],
  "config": {
    "input_field": "subdomains",
    "output_field": "unique_subdomains"
  }
}
```

## Step Dependencies

### Sequential Execution

Steps execute in order based on `depends_on`:

```json
{
  "steps": [
    { "step_key": "recon", "depends_on": [] },
    { "step_key": "scan", "depends_on": ["recon"] },
    { "step_key": "report", "depends_on": ["scan"] }
  ]
}
```

### Parallel Execution

Steps with no dependencies or same dependencies run in parallel:

```json
{
  "steps": [
    { "step_key": "amass", "depends_on": [] },
    { "step_key": "subfinder", "depends_on": [] },
    { "step_key": "merge", "depends_on": ["amass", "subfinder"] }
  ]
}
```

Execution flow:
1. `amass` and `subfinder` start immediately (parallel)
2. `merge` waits for both to complete

### Conditional Execution

Steps can have conditions for execution:

| Condition Type | Description |
|----------------|-------------|
| `always` | Always execute |
| `never` | Skip this step |
| `step_result` | Based on previous step outcome |
| `asset_type` | Based on target asset type |
| `expression` | Custom CEL expression |

**Example: Conditional on Asset Type**
```json
{
  "step_key": "web_scan",
  "name": "Web Application Scan",
  "condition": {
    "type": "asset_type",
    "asset_types": ["web_app", "api"]
  }
}
```

## Pipeline Settings

### Configuration Options

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `max_parallel_steps` | int | 3 | Maximum concurrent steps |
| `fail_fast` | bool | false | Stop on first failure |
| `timeout_seconds` | int | 7200 | Overall pipeline timeout |
| `agent_preference` | string | "auto" | Agent selection strategy |

### Agent Preference

| Value | Description |
|-------|-------------|
| `auto` | Automatic selection (platform → tenant) |
| `tenant_only` | Only use tenant-deployed agents |
| `platform_only` | Only use platform agents |
| `prefer_tenant` | Prefer tenant, fallback to platform |
| `prefer_platform` | Prefer platform, fallback to tenant |

**Example: Settings**
```json
{
  "settings": {
    "max_parallel_steps": 5,
    "fail_fast": true,
    "timeout_seconds": 3600,
    "agent_preference": "prefer_platform"
  }
}
```

## Pipeline Triggers

### Trigger Types

| Trigger | Description | Configuration |
|---------|-------------|---------------|
| `manual` | User-initiated | None |
| `schedule` | Cron-based | `cron_expression` |
| `webhook` | External call | `secret`, `path` |
| `api` | API trigger | None |
| `on_asset_discovery` | New asset found | `asset_type_filter` |

**Example: Scheduled Trigger**
```json
{
  "triggers": [
    {
      "type": "schedule",
      "config": {
        "cron_expression": "0 2 * * *",
        "timezone": "UTC"
      }
    }
  ]
}
```

## Visual Builder

The Visual Builder provides a drag-and-drop interface for creating pipelines.

### Builder Features

- **Node Palette**: Drag scanner nodes onto canvas
- **Connection Lines**: Draw dependencies between steps
- **Position Persistence**: Node positions saved with `ui_position`
- **Real-time Validation**: Validates connections and configurations
- **Auto-layout**: Automatic arrangement option

### UI Position

Each step stores its visual position:

```json
{
  "step_key": "scan",
  "ui_position": {
    "x": 300,
    "y": 150
  }
}
```

## System Templates

Pre-built pipeline templates for common scanning patterns.

### Available Templates

| Template | Steps | Pattern | Use Case |
|----------|-------|---------|----------|
| Subdomain Enumeration | 4 | Parallel → Merge | Multi-tool discovery |
| Port Scanning | 3 | Sequential | Deep scanning |
| Full Reconnaissance | 6 | Complex DAG | Comprehensive recon |
| Web Vulnerability Scan | 5 | Fan-out/Fan-in | Multi-scanner vuln |
| API Security Testing | 4 | Sequential | API-focused testing |
| Continuous Monitoring | 4 | Lightweight parallel | Scheduled monitoring |

### Using Templates

1. Browse system templates in Pipeline list
2. Click "Clone" to copy to your pipelines
3. Customize steps and settings as needed
4. Activate and schedule

## Pipeline Runs

Each pipeline execution creates a Run record.

### Run Fields

| Field | Description |
|-------|-------------|
| `id` | Unique run identifier |
| `pipeline_id` | Parent pipeline |
| `status` | pending, running, completed, failed, cancelled |
| `trigger_type` | What triggered this run |
| `total_steps` | Total steps to execute |
| `completed_steps` | Successfully completed |
| `failed_steps` | Steps that failed |
| `total_findings` | Findings discovered |
| `started_at` | Execution start time |
| `completed_at` | Execution end time |

### Run Statuses

| Status | Description |
|--------|-------------|
| `pending` | Created, waiting to start |
| `queued` | Waiting for agent availability |
| `running` | Currently executing |
| `completed` | All steps succeeded |
| `failed` | One or more steps failed |
| `cancelled` | Manually cancelled |

### Step Runs

Each step in a run has its own status:

```json
{
  "step_runs": [
    {
      "step_key": "recon",
      "status": "completed",
      "started_at": "2026-01-30T10:00:00Z",
      "completed_at": "2026-01-30T10:15:00Z",
      "findings_count": 45,
      "agent_id": "agent-123"
    },
    {
      "step_key": "scan",
      "status": "running",
      "started_at": "2026-01-30T10:15:30Z"
    }
  ]
}
```

## API Reference

### Pipelines

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/pipelines` | Create pipeline |
| `GET` | `/api/v1/pipelines` | List pipelines |
| `GET` | `/api/v1/pipelines/{id}` | Get pipeline with steps |
| `PUT` | `/api/v1/pipelines/{id}` | Update pipeline |
| `DELETE` | `/api/v1/pipelines/{id}` | Delete pipeline |
| `POST` | `/api/v1/pipelines/{id}/activate` | Activate |
| `POST` | `/api/v1/pipelines/{id}/deactivate` | Deactivate |
| `POST` | `/api/v1/pipelines/{id}/clone` | Clone pipeline |

### Pipeline Steps

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/pipelines/{id}/steps` | Add step |
| `PUT` | `/api/v1/pipelines/{id}/steps/{stepId}` | Update step |
| `DELETE` | `/api/v1/pipelines/{id}/steps/{stepId}` | Delete step |

### Pipeline Runs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/pipelines/{id}/runs` | Trigger run |
| `GET` | `/api/v1/pipeline-runs` | List all runs |
| `GET` | `/api/v1/pipeline-runs/{id}` | Get run details |
| `POST` | `/api/v1/pipeline-runs/{id}/cancel` | Cancel run |
| `POST` | `/api/v1/pipeline-runs/{id}/retry` | Retry failed run |

### Quick Scan

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/quick-scan` | Run ad-hoc scan |

**Quick Scan Request:**
```json
{
  "targets": ["example.com", "api.example.com"],
  "scanner_name": "nuclei",
  "agent_preference": "auto"
}
```

## Complete Pipeline Example

**Full Reconnaissance Pipeline:**

```json
{
  "name": "Full Reconnaissance",
  "description": "Comprehensive reconnaissance workflow",
  "is_active": true,
  "triggers": [
    { "type": "manual" },
    { "type": "schedule", "config": { "cron_expression": "0 0 * * 0" } }
  ],
  "settings": {
    "max_parallel_steps": 3,
    "fail_fast": false,
    "timeout_seconds": 7200,
    "agent_preference": "auto"
  },
  "steps": [
    {
      "step_key": "subdomain_amass",
      "name": "Amass Subdomain Enum",
      "order": 1,
      "tool": "amass",
      "capabilities": ["recon", "subdomain"],
      "depends_on": [],
      "config": { "passive": true },
      "timeout_seconds": 1800,
      "ui_position": { "x": 100, "y": 100 }
    },
    {
      "step_key": "subdomain_subfinder",
      "name": "Subfinder Enum",
      "order": 2,
      "tool": "subfinder",
      "capabilities": ["recon", "subdomain"],
      "depends_on": [],
      "config": { "all": true },
      "timeout_seconds": 900,
      "ui_position": { "x": 100, "y": 250 }
    },
    {
      "step_key": "merge_subdomains",
      "name": "Merge & Dedupe",
      "order": 3,
      "tool": "internal:dedupe",
      "capabilities": ["data", "transform"],
      "depends_on": ["subdomain_amass", "subdomain_subfinder"],
      "ui_position": { "x": 300, "y": 175 }
    },
    {
      "step_key": "dns_resolve",
      "name": "DNS Resolution",
      "order": 4,
      "tool": "dnsx",
      "capabilities": ["recon", "dns"],
      "depends_on": ["merge_subdomains"],
      "config": { "a": true, "cname": true },
      "ui_position": { "x": 500, "y": 175 }
    },
    {
      "step_key": "port_scan",
      "name": "Port Scanning",
      "order": 5,
      "tool": "naabu",
      "capabilities": ["recon", "ports"],
      "depends_on": ["dns_resolve"],
      "config": { "top_ports": 1000 },
      "ui_position": { "x": 700, "y": 175 }
    },
    {
      "step_key": "vuln_scan",
      "name": "Vulnerability Scan",
      "order": 6,
      "tool": "nuclei",
      "capabilities": ["security", "web"],
      "depends_on": ["port_scan"],
      "config": { "severity": ["critical", "high"] },
      "ui_position": { "x": 900, "y": 175 }
    }
  ]
}
```

## Permissions

| Action | Admin | Member | Viewer |
|--------|-------|--------|--------|
| View pipelines | Yes | Yes | Yes |
| Create pipelines | Yes | Yes | No |
| Update pipelines | Yes | Yes | No |
| Delete pipelines | Yes | No | No |
| Trigger runs | Yes | Yes | No |
| Cancel runs | Yes | Yes | No |
| Clone system templates | Yes | Yes | No |

Permission IDs:
- `pipelines:read` - View pipelines and runs
- `pipelines:write` - Create/update pipelines
- `pipelines:delete` - Delete pipelines
- `pipelines:execute` - Trigger pipeline runs

## Best Practices

### Design

1. **Name Clearly**: Use descriptive step names
2. **Group Related**: Use parallel steps for independent tools
3. **Set Timeouts**: Configure appropriate step timeouts
4. **Use Conditions**: Skip irrelevant steps based on asset type

### Performance

1. **Parallel Execution**: Run independent steps concurrently
2. **Right Tool Order**: Put fast tools first to filter targets
3. **Limit Parallel**: Don't overload with too many parallel steps
4. **Agent Preference**: Use platform agents for heavy scans

### Error Handling

1. **Retry Count**: Set retries for flaky tools
2. **Fail Fast**: Enable for critical pipelines
3. **Timeouts**: Prevent hung steps
4. **Monitor Runs**: Check failed runs and adjust

{% endraw %}
