---
layout: default
title: Component Interactions
parent: Features
nav_order: 6
---

# Component Interactions

This document provides a comprehensive overview of how the major components in the OpenCTEM CTEM Platform interact with each other.

---

## Component Overview

```
                                ┌─────────────────────────────────────────────────────────────────┐
                                │                         TENANT                                   │
                                │  (Organization - owns all resources except platform entities)   │
                                └────────────────────────────────┬────────────────────────────────┘
                                                                 │
           ┌─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┐
           │                                                     │                                                     │
           ▼                                                     ▼                                                     ▼
┌─────────────────────┐                               ┌─────────────────────┐                               ┌─────────────────────┐
│       USERS         │                               │       ASSETS        │                               │    INTEGRATIONS     │
│  (Team members)     │                               │  (Scan targets)     │                               │  (External systems) │
└─────────────────────┘                               └─────────────────────┘                               └─────────────────────┘
           │                                                     │                                                     │
           ▼                                                     ▼                                                     │
┌─────────────────────┐                               ┌─────────────────────┐                                          │
│   GROUPS & ROLES    │                               │    ASSET GROUPS     │                                          │
│  (Access control)   │                               │    SCOPES           │                                          │
└─────────────────────┘                               └─────────────────────┘                                          │
                                                                 │                                                     │
                                                                 │                                                     │
                                                                 ▼                                                     │
                                ┌─────────────────────────────────────────────────────────────────┐                    │
                                │                       SCAN PROFILE                               │◄───────────────────┘
                                │  (Reusable configuration: tools, quality gate, templates)       │
                                └────────────────────────────────┬────────────────────────────────┘
                                                                 │
                                       ┌─────────────────────────┼─────────────────────────┐
                                       │                         │                         │
                                       ▼                         ▼                         ▼
                           ┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
                           │   QUALITY GATE      │   │      TOOLS          │   │ SCANNER TEMPLATES   │
                           │ (CI/CD thresholds)  │   │  (Nuclei, Semgrep)  │   │ (Custom rules/patterns)│
                           └─────────────────────┘   └──────────┬──────────┘   └─────────────────────┘
                                                                 │
                                                                 ▼
                                                     ┌─────────────────────┐
                                                     │    CAPABILITIES     │
                                                     │  (SAST, SCA, etc.)  │
                                                     └──────────┬──────────┘
                                                                 │
                                                                 ▼
                                                     ┌─────────────────────┐
                                                     │   TOOL CATEGORIES   │
                                                     │ (Security, Recon)   │
                                                     └─────────────────────┘
```

---

## Core Entities

### 1. Tenant

The root entity that owns all resources. Everything is tenant-scoped.

| Relationship | Direction | Description |
|-------------|-----------|-------------|
| Users | 1:N | Tenant has many users |
| Assets | 1:N | Tenant owns assets |
| Scan Profiles | 1:N | Tenant creates profiles (+ sees system profiles) |
| Scanner Templates | 1:N | Tenant uploads custom templates |
| Pipelines | 1:N | Tenant owns pipeline definitions |
| Workflows | 1:N | Tenant creates automation workflows |
| Integrations | 1:N | Tenant configures SCM, notification providers |
| Agents | 1:N | Tenant may deploy tenant agents |

### 2. User

Team members who use the platform.

| Relationship | Direction | Description |
|-------------|-----------|-------------|
| Tenant | N:1 | User belongs to one tenant |
| Roles | N:N | User has multiple roles |
| Groups | N:N | User belongs to multiple groups |
| Audit Logs | 1:N | Actions are logged per user |
| Created Resources | 1:N | User creates assets, scans, etc. |

### 3. Asset

Targets that can be scanned (repositories, domains, cloud resources, etc.).

| Relationship | Direction | Description |
|-------------|-----------|-------------|
| Tenant | N:1 | Asset belongs to one tenant |
| Asset Type | N:1 | Asset has a type (repository, domain, etc.) |
| Asset Groups | N:N | Asset can be in multiple groups |
| Scopes | N:N | Asset included/excluded from scopes |
| Components | 1:N | Asset has components (packages, APIs) |
| Vulnerabilities | 1:N | Asset has associated findings |
| Scans | N:N | Asset is scanned by multiple scans |

---

## Scanning Components

### 4. Scan Profile

Reusable configuration for scans.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SCAN PROFILE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Owned by: Tenant (or System for platform profiles)                          │
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌────────────────────────┐ │
│  │   Tools Config   │    │   Quality Gate   │    │    General Settings    │ │
│  │  - enabled tools │    │  - thresholds    │    │  - intensity           │ │
│  │  - severities    │    │  - fail_on_*     │    │  - timeout             │ │
│  │  - template_mode │    │  - max_*         │    │  - max_concurrent      │ │
│  │  - template_ids  │    │  - baseline      │    │  - tags, metadata      │ │
│  └──────────────────┘    └──────────────────┘    └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Relationship | Direction | Description |
|-------------|-----------|-------------|
| Tenant | N:1 | Profile owned by tenant (unless is_system=true) |
| Scanner Templates | N:N | Profile can reference custom templates |
| Scans | 1:N | Profile used by multiple scans |
| Pipeline Steps | N:N | Profile referenced in pipeline step configs |
| Quality Gate | 1:1 | Embedded quality gate configuration |

### 5. Scanner Templates

Custom templates for tools that support them (Nuclei, Semgrep, Gitleaks).

| Relationship | Direction | Description |
|-------------|-----------|-------------|
| Tenant | N:1 | Template owned by tenant |
| Template Source | N:1 | (Optional) Synced from Git/S3/HTTP |
| Scan Profiles | N:N | Referenced by profiles via template_mode |
| Template Type | 1:1 | nuclei, semgrep, or gitleaks |

### 6. Tools

Security scanning tools registered in the platform.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  TOOL                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Ownership: Platform (is_platform_tool=true) or Tenant (custom)             │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │                       Tool Definition                         │           │
│  │  - name, display_name, description                            │           │
│  │  - install_method, install_cmd, version_cmd                   │           │
│  │  - config_schema, default_config                              │           │
│  │  - supported_targets, output_formats                          │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                  │                                           │
│            ┌─────────────────────┼─────────────────────┐                    │
│            ▼                     ▼                     ▼                    │
│  ┌──────────────────┐ ┌──────────────────┐ ┌────────────────────┐          │
│  │   Capabilities   │ │  Tool Category   │ │ Tenant Tool Config │          │
│  │    (M:N link)    │ │    (1:1 link)    │ │  (tenant-specific) │          │
│  │ SAST, SCA, DAST  │ │ security, recon  │ │ custom settings    │          │
│  └──────────────────┘ └──────────────────┘ └────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Relationship | Direction | Description |
|-------------|-----------|-------------|
| Capabilities | N:N | Tool has multiple capabilities (SAST, SCA, etc.) |
| Tool Category | N:1 | Tool belongs to one category |
| Tenant Tool Config | 1:N | Each tenant can customize tool settings |
| Tool Executions | 1:N | Tool runs are tracked per execution |
| Scan Profiles | N:N | Tool referenced in profile tool configs |

### 7. Capabilities

Normalized what-tools-can-do abstraction.

| Relationship | Direction | Description |
|-------------|-----------|-------------|
| Tools | N:N | Capability linked to multiple tools |
| Tenant | N:1 | Custom capability owned by tenant |
| Category | 1:1 | Capability has a category (security, recon) |

### 8. Tool Categories

Grouping for tools.

| Relationship | Direction | Description |
|-------------|-----------|-------------|
| Tools | 1:N | Category has many tools |

---

## Orchestration Components

### 9. Scan (Scan Session)

A single scan execution targeting assets.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SCAN SESSION                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐         ┌─────────────────┐        ┌────────────────┐  │
│  │   Target Info   │         │   Scan Profile  │        │   Execution    │  │
│  │  - asset_id     │────────►│  (reference)    │        │  - status      │  │
│  │  - scope_id     │         │                 │        │  - agent_id    │  │
│  │  - branch       │         └────────┬────────┘        │  - started_at  │  │
│  └─────────────────┘                  │                 │  - completed   │  │
│                                       │                 └────────────────┘  │
│                                       ▼                                     │
│                            ┌─────────────────────┐                          │
│                            │  Quality Gate Result │                         │
│                            │  - passed/failed    │                          │
│                            │  - breaches[]       │                          │
│                            │  - finding_counts   │                          │
│                            └─────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Relationship | Direction | Description |
|-------------|-----------|-------------|
| Tenant | N:1 | Scan owned by tenant |
| Asset | N:1 | Scan targets one asset (or scope for multi) |
| Scan Profile | N:1 | Scan uses one profile |
| Agent | N:1 | Scan executed by one agent |
| Pipeline Run | 1:1 | Scan creates a pipeline run |
| Findings | 1:N | Scan produces findings |
| Quality Gate Result | 1:1 | Embedded evaluation result |

### 10. Pipeline Template

Reusable multi-step workflow definition.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PIPELINE TEMPLATE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Pipeline Template                                                           │
│       │                                                                      │
│       └──► Pipeline Steps (ordered)                                          │
│             │                                                                │
│             ├── Step 1: SAST Scan                                           │
│             │    - tool: semgrep                                            │
│             │    - config: {...}                                            │
│             │    - depends_on: []                                           │
│             │                                                                │
│             ├── Step 2: SCA Scan                                            │
│             │    - tool: trivy                                              │
│             │    - depends_on: []                                           │
│             │                                                                │
│             ├── Step 3: Secrets Scan                                        │
│             │    - tool: gitleaks                                           │
│             │    - depends_on: []                                           │
│             │                                                                │
│             └── Step 4: Report Generation                                   │
│                  - type: report                                             │
│                  - depends_on: [step1, step2, step3]                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Relationship | Direction | Description |
|-------------|-----------|-------------|
| Tenant | N:1 | Template owned by tenant (or system) |
| Pipeline Steps | 1:N | Template has many steps |
| Pipeline Runs | 1:N | Template instantiated into runs |
| Scan Profile | N:1 | Template may reference a profile |

### 11. Pipeline Run

An execution instance of a pipeline template.

| Relationship | Direction | Description |
|-------------|-----------|-------------|
| Pipeline Template | N:1 | Run from one template |
| Step Runs | 1:N | Run has many step executions |
| Scan | 1:1 | Run associated with one scan |
| Quality Gate Result | 1:1 | Embedded after completion |

### 12. Workflow

Event-driven automation with nodes and edges.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              WORKFLOW                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Workflow Definition                                                         │
│       │                                                                      │
│       ├──► Nodes (actions)                                                   │
│       │     │                                                                │
│       │     ├── trigger: "on_vulnerability_created"                         │
│       │     ├── condition: "severity == 'critical'"                         │
│       │     ├── action: "create_jira_ticket"                                │
│       │     └── action: "send_slack_notification"                           │
│       │                                                                      │
│       └──► Edges (connections between nodes)                                 │
│             │                                                                │
│             ├── trigger → condition                                          │
│             ├── condition (true) → action1                                  │
│             └── action1 → action2                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Relationship | Direction | Description |
|-------------|-----------|-------------|
| Tenant | N:1 | Workflow owned by tenant |
| Workflow Nodes | 1:N | Workflow has many nodes |
| Workflow Edges | 1:N | Workflow has many edges |
| Workflow Runs | 1:N | Workflow triggered multiple times |
| Integrations | N:N | Workflow actions use integrations |

---

## Agent & Execution Components

### 13. Agent

Executes scans and commands.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AGENT TYPES                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────┐    ┌────────────────────────────────┐   │
│  │        TENANT AGENT            │    │       PLATFORM AGENT           │   │
│  │                                │    │                                │   │
│  │  - Deployed by customer        │    │  - Managed by OpenCTEM          │   │
│  │  - Customer network access     │    │  - Shared infrastructure       │   │
│  │  - Full control                │    │  - Multi-tenant isolation      │   │
│  │  - tenant_id = UUID            │    │  - tenant_id = NULL            │   │
│  └────────────────────────────────┘    └────────────────────────────────┘   │
│                                                                              │
│  Selection Priority:                                                         │
│  1. Tenant Agent (if available and supports tool)                           │
│  2. Platform Agent (fallback)                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Relationship | Direction | Description |
|-------------|-----------|-------------|
| Tenant | N:1 | Tenant agent belongs to tenant (NULL for platform) |
| Commands | 1:N | Agent receives commands to execute |
| Tool Executions | 1:N | Agent runs tool executions |
| Capabilities | N:N | Agent has tool/capability support |
| Lease | 1:N | Agent takes job leases |

### 14. Command

Instructions sent to agents.

| Relationship | Direction | Description |
|-------------|-----------|-------------|
| Tenant | N:1 | Command scoped to tenant |
| Agent | N:1 | Command assigned to agent |
| Scan | N:1 | Command may be for a scan |
| Pipeline Step | N:1 | Command for a pipeline step |

---

## Results & Findings Components

### 15. Vulnerability / Finding

Security issues discovered by scans.

| Relationship | Direction | Description |
|-------------|-----------|-------------|
| Tenant | N:1 | Finding belongs to tenant |
| Asset | N:1 | Finding associated with asset |
| Scan | N:1 | Finding discovered by scan |
| Tool | N:1 | Finding produced by tool |
| Comments | 1:N | Finding has discussion comments |

### 16. Exposure

External exposure data (leaked credentials, data breaches).

| Relationship | Direction | Description |
|-------------|-----------|-------------|
| Tenant | N:1 | Exposure belongs to tenant |
| Asset | N:1 | Exposure related to asset (if applicable) |
| State History | 1:N | Exposure status changes tracked |

---

## Access Control Components

### 17. Role

Permission bundle assigned to users.

| Relationship | Direction | Description |
|-------------|-----------|-------------|
| Tenant | N:1 | Custom role owned by tenant |
| Permissions | N:N | Role has many permissions |
| Users | N:N | Role assigned to users |

### 18. Group

Resource access scope.

| Relationship | Direction | Description |
|-------------|-----------|-------------|
| Tenant | N:1 | Group owned by tenant |
| Users | N:N | Group has member users |
| Assets | N:N | Group has accessible assets |

### 19. Permission Set

Named collection of permissions for reuse.

| Relationship | Direction | Description |
|-------------|-----------|-------------|
| Tenant | N:1 | Permission set owned by tenant |
| Permissions | 1:N | Set contains permissions |

---

## Integration Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              COMPLETE SCAN FLOW                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

  User                   API                    Services              Agent                 Results
   │                      │                        │                    │                      │
   │  Create Scan         │                        │                    │                      │
   │ ─────────────────────►                        │                    │                      │
   │                      │                        │                    │                      │
   │                      │  1. Validate request   │                    │                      │
   │                      │ ────────────────────────►                    │                      │
   │                      │                        │                    │                      │
   │                      │  2. Get Scan Profile   │                    │                      │
   │                      │ ────────────────────────►                    │                      │
   │                      │                        │                    │                      │
   │                      │  3. Get Custom Templates│                   │                      │
   │                      │ ────────────────────────►                    │                      │
   │                      │                        │                    │                      │
   │                      │  4. Select Agent       │                    │                      │
   │                      │    (tenant or platform)│                    │                      │
   │                      │ ────────────────────────►                    │                      │
   │                      │                        │                    │                      │
   │                      │  5. Create Pipeline Run │                   │                      │
   │                      │ ────────────────────────►                    │                      │
   │                      │                        │                    │                      │
   │                      │  6. Queue Commands      │                   │                      │
   │                      │ ────────────────────────►                    │                      │
   │                      │                        │                    │                      │
   │                      │                        │  7. Poll Commands  │                      │
   │                      │                        │ ◄───────────────────                      │
   │                      │                        │                    │                      │
   │                      │                        │  8. Execute Scan   │                      │
   │                      │                        │ ───────────────────►                      │
   │                      │                        │                    │                      │
   │                      │                        │  9. Push Findings   │                      │
   │                      │                        │ ◄───────────────────                      │
   │                      │                        │                    │                      │
   │                      │                        │  10. Evaluate QG    │                     │
   │                      │                        │ ────────────────────────────────────────────►
   │                      │                        │                    │                      │
   │  Scan Complete       │                        │                    │                      │
   │ ◄─────────────────────                        │                    │                      │
   │  (with QG result)    │                        │                    │                      │
```

---

## Entity Relationship Summary

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    ENTITY RELATIONSHIPS                                              │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                      │
│  TENANT (root)                                                                                       │
│    │                                                                                                 │
│    ├──► Users ──► Roles ──► Permissions                                                              │
│    │         └──► Groups ──► Assets                                                                  │
│    │                                                                                                 │
│    ├──► Assets ──► Asset Types ──► Asset Type Categories                                             │
│    │          └──► Asset Groups                                                                      │
│    │          └──► Scopes (Targets + Exclusions)                                                     │
│    │          └──► Components                                                                        │
│    │          └──► Vulnerabilities                                                                   │
│    │                                                                                                 │
│    ├──► Scan Profiles ──► Tools Config ──► Template Mode                                             │
│    │                  └──► Quality Gate                                                              │
│    │                  └──► Scanner Templates (custom)                                                │
│    │                                                                                                 │
│    ├──► Scanner Templates ──► Template Source (git/s3/http)                                          │
│    │                                                                                                 │
│    ├──► Scans ──► Scan Profile                                                                       │
│    │         └──► Pipeline Run ──► Step Runs                                                         │
│    │         └──► Agent                                                                              │
│    │         └──► Findings ──► Comments                                                              │
│    │         └──► Quality Gate Result                                                                │
│    │                                                                                                 │
│    ├──► Pipeline Templates ──► Pipeline Steps                                                        │
│    │                                                                                                 │
│    ├──► Workflows ──► Nodes ──► Edges                                                                │
│    │             └──► Workflow Runs ──► Node Runs                                                    │
│    │                                                                                                 │
│    ├──► Integrations ──► SCM Extension                                                               │
│    │                 └──► Notification Extension                                                     │
│    │                                                                                                 │
│    ├──► Agents (tenant-specific)                                                                     │
│    │                                                                                                 │
│    └──► Tenant Tool Config (per-tool customization)                                                  │
│                                                                                                      │
│  PLATFORM (global)                                                                                   │
│    │                                                                                                 │
│    ├──► Tools ──► Capabilities (M:N)                                                                 │
│    │         └──► Tool Categories                                                                    │
│    │         └──► Config Schema                                                                      │
│    │                                                                                                 │
│    ├──► System Scan Profiles (is_system=true)                                                        │
│    │                                                                                                 │
│    ├──► Platform Agents (tenant_id=NULL)                                                             │
│    │                                                                                                 │
│    ├──► Capabilities (is_builtin=true)                                                               │
│    │                                                                                                 │
│    └──► Tool Categories                                                                              │
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Common Interaction Patterns

### Pattern 1: Scan Execution

```
1. User selects Asset + Scan Profile
2. System resolves:
   - Tools from profile
   - Quality Gate config
   - Custom templates (if template_mode != "default")
   - Available agent (tenant → platform fallback)
3. Pipeline Run created with steps
4. Commands queued for agent
5. Agent executes, pushes findings
6. Quality Gate evaluated on completion
7. Results stored with QG status
```

### Pattern 2: Template Mode Resolution

```
For each tool in Scan Profile:

IF template_mode == "default":
    Use only built-in templates

ELSE IF template_mode == "custom":
    Fetch templates by custom_template_ids
    Use ONLY custom templates

ELSE IF template_mode == "both":
    Fetch templates by custom_template_ids
    Use built-in + custom templates merged
```

### Pattern 3: Agent Selection

```
1. Get tenant agents with matching capabilities
2. Filter by: online, not at capacity
3. IF tenant agent found:
      Return tenant agent
   ELSE:
      Get platform agents with matching capabilities
      Return platform agent (multi-tenant isolation)
```

### Pattern 4: Quality Gate Evaluation

```
On scan completion:
1. Get Scan Profile
2. IF quality_gate.enabled:
      Count findings by severity
      Evaluate against thresholds
      Store result in pipeline run
3. Return result to caller
```

---

## Related Documentation

- [Scan Flow Architecture](../architecture/scan-flow.md)
- [Scan Profiles](scan-profiles.md)
- [Capabilities Registry](capabilities-registry.md)
- [Platform Agents](platform-agents.md)
- [Scan Orchestration](../architecture/scan-orchestration.md)
- [Server-Agent Communication](../architecture/server-agent-command.md)
