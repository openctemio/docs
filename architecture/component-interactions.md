---
layout: default
title: Component Interactions
parent: Architecture
nav_order: 2
---

# Component Interactions

This document provides a comprehensive overview of how all major components in the OpenCTEM CTEM Platform interact with each other.

---

## Table of Contents

- [Overview Diagram](#overview-diagram)
- [Core Entities](#core-entities)
- [Interaction Matrix](#interaction-matrix)
- [Detailed Interactions](#detailed-interactions)
  - [Tenant & Multi-tenancy](#tenant--multi-tenancy)
  - [Scanning System](#scanning-system)
  - [Tool & Capability Registry](#tool--capability-registry)
  - [Pipeline & Workflow Orchestration](#pipeline--workflow-orchestration)
  - [Quality Gates & CI/CD](#quality-gates--cicd)
  - [Custom Templates](#custom-templates)
- [Data Flow Diagrams](#data-flow-diagrams)
- [API Dependency Map](#api-dependency-map)

---

## Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              OPENCTEM CTEM PLATFORM                                   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                           TENANT LAYER                                       │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │   │
│  │  │  Users   │  │  Roles   │  │  Groups  │  │  Plans   │  │  Invitations │  │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────────┘  │   │
│  │       │             │             │             │                           │   │
│  │       └─────────────┴──────┬──────┴─────────────┘                           │   │
│  │                            ▼                                                 │   │
│  │                     ┌──────────────┐                                        │   │
│  │                     │    TENANT    │───────────────────────────────────┐    │   │
│  │                     └──────────────┘                                   │    │   │
│  └───────────────────────────┬────────────────────────────────────────────┼────┘   │
│                              │ owns all resources                         │         │
│  ┌───────────────────────────┼────────────────────────────────────────────┼────┐   │
│  │                           │     ASSET LAYER                            │    │   │
│  │  ┌──────────────┐    ┌────▼─────┐    ┌─────────────┐    ┌────────────┐ │    │   │
│  │  │ Asset Groups │◄───│  Assets  │───►│  Findings   │───►│ Components │ │    │   │
│  │  └──────────────┘    └──────────┘    └─────────────┘    │   (SBOM)   │ │    │   │
│  │                                             │            └────────────┘ │    │   │
│  └─────────────────────────────────────────────┼───────────────────────────┘    │   │
│                                                │ discovered by                   │   │
│  ┌─────────────────────────────────────────────┼───────────────────────────┐    │   │
│  │                           SCANNING LAYER    │                            │    │   │
│  │                                             ▼                            │    │   │
│  │  ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐            │    │   │
│  │  │    Scans     │───►│ Scan Sessions│───►│  Scan Profiles  │◄───────────┼────┘   │
│  │  │ (definitions)│    │  (runs)      │    │ (configurations)│            │        │
│  │  └──────┬───────┘    └──────────────┘    └───────┬─────────┘            │        │
│  │         │                   ▲                    │                       │        │
│  │         │ triggers          │ executes           │ uses                  │        │
│  │         ▼                   │                    ▼                       │        │
│  │  ┌──────────────┐    ┌──────┴───────┐    ┌─────────────────┐            │        │
│  │  │   Commands   │───►│    Agents    │───►│ Scanner Templates│            │        │
│  │  │   (queue)    │    │ (executors)  │    │    (custom)      │            │        │
│  │  └──────────────┘    └──────────────┘    └─────────────────┘            │        │
│  └─────────────────────────────────────────────────────────────────────────┘        │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                         TOOL & CAPABILITY LAYER                              │   │
│  │  ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐                │   │
│  │  │    Tools     │◄──►│ Capabilities │    │ Tool Categories │                │   │
│  │  │ (scanners)   │    │  (abilities) │    │   (grouping)    │                │   │
│  │  └──────┬───────┘    └──────────────┘    └─────────────────┘                │   │
│  │         │ M:N                                                                │   │
│  │         ▼                                                                    │   │
│  │  ┌──────────────┐                                                           │   │
│  │  │ Tenant Tool  │                                                           │   │
│  │  │   Configs    │                                                           │   │
│  │  └──────────────┘                                                           │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                      ORCHESTRATION LAYER                                     │   │
│  │  ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐                │   │
│  │  │  Pipelines   │───►│Pipeline Runs │───►│   Quality Gate  │                │   │
│  │  │ (definitions)│    │  (executions)│    │    Results      │                │   │
│  │  └──────────────┘    └──────────────┘    └─────────────────┘                │   │
│  │         │                                                                    │   │
│  │         │ can trigger                                                        │   │
│  │         ▼                                                                    │   │
│  │  ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐                │   │
│  │  │  Workflows   │───►│Workflow Runs │───►│   Integrations  │                │   │
│  │  │ (automation) │    │ (executions) │    │ (Slack, Jira)   │                │   │
│  │  └──────────────┘    └──────────────┘    └─────────────────┘                │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Entities

### Tenant Layer

| Entity | Description | Key Relationships |
|--------|-------------|-------------------|
| **Tenant** | Organization/team that owns all resources | Contains users, assets, scans, tools |
| **User** | Human operator with login credentials | Belongs to multiple tenants via TenantMember |
| **Role** | Permission level (Owner, Admin, Member, Viewer) | Defines what users can do |
| **Group** | Logical grouping for access control | Contains users, controls resource access |
| **Plan** | Subscription/licensing tier | Defines limits (agents, scans, storage) |

### Asset Layer

| Entity | Description | Key Relationships |
|--------|-------------|-------------------|
| **Asset** | Target being scanned (repo, container, host) | Belongs to tenant, has findings |
| **Asset Group** | Logical grouping of assets | Contains assets, used in scans |
| **Finding** | Security vulnerability discovered | Linked to asset, scan session, tool |
| **Component** | Software dependency (SBOM entry) | Linked to assets via junction table |

### Scanning Layer

| Entity | Description | Key Relationships |
|--------|-------------|-------------------|
| **Scan** | Scan configuration/definition | Has schedule, profile, targets |
| **Scan Session** | Single scan execution | Links scan → agent → findings |
| **Scan Profile** | Reusable scan configuration | Tools config, quality gate, template mode |
| **Command** | Work queue entry for agents | Pending work to be executed |
| **Agent** | Scan executor (tenant or platform) | Has capabilities, tools, executes commands |
| **Scanner Template** | Custom template (Nuclei, Semgrep, Gitleaks) | Used in scan profiles |

### Tool & Capability Layer

| Entity | Description | Key Relationships |
|--------|-------------|-------------------|
| **Tool** | Security scanner definition | Has capabilities (M:N), belongs to category |
| **Capability** | What a tool can do (sast, sca, secrets) | M:N with tools |
| **Tool Category** | UI grouping (SAST Tools, Recon Tools) | 1:N with tools |
| **Tenant Tool Config** | Tenant-specific tool settings | Overrides tool defaults |

### Orchestration Layer

| Entity | Description | Key Relationships |
|--------|-------------|-------------------|
| **Pipeline** | Multi-step scan workflow | Contains steps, uses profile |
| **Pipeline Run** | Pipeline execution | Has step runs, quality gate result |
| **Workflow** | Automation graph (triggers, actions) | Responds to events |
| **Workflow Run** | Workflow execution | Has node runs, audit trail |
| **Integration** | External service connection | Used by workflows, notifications |

---

## Interaction Matrix

This matrix shows which components interact with each other:

|                    | Tenant | Asset | Finding | Scan | Profile | Agent | Tool | Capability | Pipeline | Workflow | Template |
|--------------------|:------:|:-----:|:-------:|:----:|:-------:|:-----:|:----:|:----------:|:--------:|:--------:|:--------:|
| **Tenant**         |   -    |   ✓   |    ✓    |  ✓   |    ✓    |   ✓   |  ✓   |     ✓      |    ✓     |    ✓     |    ✓     |
| **Asset**          |   ✓    |   -   |    ✓    |  ✓   |         |       |      |            |          |          |          |
| **Finding**        |   ✓    |   ✓   |    -    |  ✓   |         |   ✓   |  ✓   |            |          |    ✓     |          |
| **Scan**           |   ✓    |   ✓   |         |  -   |    ✓    |   ✓   |  ✓   |            |    ✓     |          |          |
| **Profile**        |   ✓    |       |         |  ✓   |    -    |       |  ✓   |            |    ✓     |          |    ✓     |
| **Agent**          |   ✓    |       |    ✓    |  ✓   |         |   -   |  ✓   |     ✓      |    ✓     |          |    ✓     |
| **Tool**           |   ✓    |       |    ✓    |  ✓   |    ✓    |   ✓   |  -   |     ✓      |    ✓     |          |    ✓     |
| **Capability**     |   ✓    |       |         |      |         |   ✓   |  ✓   |     -      |          |          |          |
| **Pipeline**       |   ✓    |       |         |  ✓   |    ✓    |   ✓   |  ✓   |            |    -     |    ✓     |          |
| **Workflow**       |   ✓    |       |    ✓    |      |         |       |      |            |    ✓     |    -     |          |
| **Template**       |   ✓    |       |         |      |    ✓    |   ✓   |  ✓   |            |          |          |    -     |

---

## Detailed Interactions

### Tenant & Multi-tenancy

```
┌────────────────────────────────────────────────────────────────┐
│                    TENANT ISOLATION                             │
│                                                                 │
│   User ──────► TenantMember ──────► Tenant                     │
│    │              │                   │                         │
│    │              └── role            │ owns                    │
│    │                                  ▼                         │
│    │                     ┌────────────────────────┐            │
│    │                     │  ALL TENANT RESOURCES  │            │
│    │                     │  - Assets              │            │
│    │                     │  - Findings            │            │
│    │                     │  - Scans               │            │
│    │                     │  - Scan Profiles       │            │
│    │                     │  - Scanner Templates   │            │
│    │                     │  - Agents (tenant)     │            │
│    │                     │  - Pipelines           │            │
│    │                     │  - Workflows           │            │
│    │                     │  - Integrations        │            │
│    │                     │  - Tool Configs        │            │
│    │                     │  - Custom Capabilities │            │
│    │                     └────────────────────────┘            │
│    │                                                            │
│    └──────► Plan ──────► Module Access                         │
│                          (scans, assets, findings, etc.)       │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- Every resource has a `tenant_id` foreign key
- Token-based scoping: tenant extracted from JWT, not URL
- Module access controlled by Plan subscription
- Platform resources (system profiles, platform tools) are shared read-only

### Scanning System

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           SCAN EXECUTION FLOW                               │
│                                                                             │
│   User Creates Scan                                                         │
│         │                                                                   │
│         ▼                                                                   │
│   ┌──────────┐     ┌──────────────┐     ┌─────────────────┐                │
│   │   Scan   │────►│ Scan Profile │────►│ Scanner Template │               │
│   │(definition)    │              │     │  (custom rules)  │               │
│   └────┬─────┘     │- tools_config│     └─────────────────┘                │
│        │           │- quality_gate│                                         │
│        │           │- template_mode                                         │
│        │           └──────────────┘                                         │
│        │                                                                    │
│        │ schedule triggers                                                  │
│        ▼                                                                    │
│   ┌──────────┐                                                              │
│   │ Command  │  (work queue entry)                                         │
│   │- type    │                                                              │
│   │- payload │  ◄─── Contains: targets, tool config, template IDs          │
│   │- priority│                                                              │
│   └────┬─────┘                                                              │
│        │                                                                    │
│        │ agent polls                                                        │
│        ▼                                                                    │
│   ┌──────────┐     ┌──────────┐     ┌─────────────────┐                    │
│   │  Agent   │────►│  Tools   │────►│ Scanner Template│                    │
│   │          │     │(installed)│    │  (downloaded)   │                    │
│   │capabilities    └──────────┘     └─────────────────┘                    │
│   └────┬─────┘                                                              │
│        │                                                                    │
│        │ executes & reports                                                 │
│        ▼                                                                    │
│   ┌──────────────┐     ┌──────────┐     ┌─────────────┐                    │
│   │ Scan Session │────►│ Findings │────►│   Assets    │                    │
│   │(run metrics) │     │          │     │(auto-created│                    │
│   └──────────────┘     └──────────┘     │ or linked)  │                    │
│                                          └─────────────┘                    │
└────────────────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- Scans reference Scan Profiles for configuration
- Commands are the bridge between server and agents
- Agents download custom templates when needed
- Findings are deduplicated via fingerprinting
- Assets are auto-created or linked during ingest

### Tool & Capability Registry

```
┌────────────────────────────────────────────────────────────────────────────┐
│                      TOOLS & CAPABILITIES                                   │
│                                                                             │
│   ┌─────────────────┐                                                       │
│   │ Tool Categories │  (UI grouping: "SAST Tools", "Recon Tools")          │
│   │   - id          │                                                       │
│   │   - name        │                                                       │
│   │   - icon/color  │                                                       │
│   └────────┬────────┘                                                       │
│            │ 1:N                                                            │
│            ▼                                                                │
│   ┌─────────────────┐          ┌─────────────────┐                         │
│   │     Tools       │◄────────►│  Capabilities   │                         │
│   │   - semgrep     │    M:N   │   - sast        │                         │
│   │   - trivy       │  junction│   - sca         │                         │
│   │   - nuclei      │  table   │   - secrets     │                         │
│   │   - gitleaks    │          │   - dast        │                         │
│   └────────┬────────┘          └─────────────────┘                         │
│            │                             │                                  │
│            │                             │ used for                         │
│            │                             ▼                                  │
│            │                   ┌─────────────────┐                         │
│            │                   │  Agent Matching │                         │
│            │                   │  (capabilities) │                         │
│            │                   └─────────────────┘                         │
│            │                                                                │
│            │ configured per tenant                                          │
│            ▼                                                                │
│   ┌─────────────────┐                                                       │
│   │Tenant Tool Config│                                                      │
│   │   - config      │  (overrides default settings)                        │
│   │   - is_enabled  │                                                       │
│   │   - templates   │                                                       │
│   └─────────────────┘                                                       │
│                                                                             │
│   ┌─────────────────┐                                                       │
│   │Scanner Templates│  (per-tool custom rules)                             │
│   │   - nuclei YAML │                                                       │
│   │   - semgrep YAML│                                                       │
│   │   - gitleaks TOML                                                       │
│   └─────────────────┘                                                       │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- Tool Categories are for UI organization (1:N with tools)
- Capabilities define technical abilities (M:N with tools)
- Agents advertise capabilities, used for matching
- Tenant Tool Config allows per-tenant customization
- Scanner Templates provide custom detection rules

### Pipeline & Workflow Orchestration

```
┌────────────────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATION LAYER                                    │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                         PIPELINES                                    │  │
│   │                                                                      │  │
│   │   Pipeline Definition                                                │  │
│   │   ├─ name, description                                              │  │
│   │   ├─ steps[] ─────────────┐                                         │  │
│   │   │   ├─ tool_id          │                                         │  │
│   │   │   ├─ scan_profile_id ─┼──► Scan Profile (config + quality gate) │  │
│   │   │   └─ order            │                                         │  │
│   │   └─ scan_profile_id ─────┘                                         │  │
│   │                                                                      │  │
│   │   Pipeline Run                                                       │  │
│   │   ├─ status (pending → running → completed/failed)                  │  │
│   │   ├─ step_runs[] ──────────► Individual step executions             │  │
│   │   └─ quality_gate_result ──► Pass/Fail + breaches                   │  │
│   │                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                         WORKFLOWS                                    │  │
│   │                                                                      │  │
│   │   Workflow Definition (Graph-based)                                  │  │
│   │   ├─ triggers[] ──────────► Events that start workflow              │  │
│   │   │   ├─ finding_created                                            │  │
│   │   │   ├─ scan_completed                                             │  │
│   │   │   └─ pipeline_failed                                            │  │
│   │   ├─ conditions[] ────────► Branch logic                            │  │
│   │   │   └─ severity == 'critical'                                     │  │
│   │   ├─ actions[] ───────────► Operations to perform                   │  │
│   │   │   ├─ assign_user                                                │  │
│   │   │   ├─ trigger_pipeline                                           │  │
│   │   │   ├─ http_request                                               │  │
│   │   │   └─ create_ticket                                              │  │
│   │   └─ notifications[] ─────► Alert delivery                          │  │
│   │       ├─ slack                                                      │  │
│   │       ├─ email                                                      │  │
│   │       └─ pagerduty                                                  │  │
│   │                                                                      │  │
│   │   Workflow Run                                                       │  │
│   │   ├─ trigger_data ────────► Event payload                           │  │
│   │   ├─ node_runs[] ─────────► Individual node executions              │  │
│   │   └─ status                                                         │  │
│   │                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                       INTEGRATIONS                                   │  │
│   │                                                                      │  │
│   │   ├─ Slack ─────────► Notifications, workflow actions               │  │
│   │   ├─ Email ─────────► Notifications                                 │  │
│   │   ├─ Jira ──────────► Ticket creation, workflow actions             │  │
│   │   ├─ GitHub ────────► Issues, PR comments, workflow actions         │  │
│   │   ├─ PagerDuty ─────► Alerts                                        │  │
│   │   └─ Webhooks ──────► Custom HTTP callbacks                         │  │
│   │                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- Pipelines orchestrate multi-tool scans in sequence
- Quality Gates evaluated at pipeline completion
- Workflows automate responses to events
- Integrations connect to external services
- Both pipelines and workflows can trigger each other

### Quality Gates & CI/CD

```
┌────────────────────────────────────────────────────────────────────────────┐
│                      QUALITY GATE FLOW                                      │
│                                                                             │
│   Scan Profile                                                              │
│   └─ quality_gate:                                                          │
│       ├─ enabled: true                                                      │
│       ├─ fail_on_critical: true                                            │
│       ├─ fail_on_high: false                                               │
│       ├─ max_critical: 0                                                   │
│       ├─ max_high: 5                                                       │
│       ├─ max_medium: -1 (unlimited)                                        │
│       ├─ max_total: -1 (unlimited)                                         │
│       ├─ new_findings_only: false                                          │
│       └─ baseline_branch: "main"                                           │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                    EVALUATION PROCESS                                │  │
│   │                                                                      │  │
│   │   Pipeline/Scan Completes                                            │  │
│   │          │                                                           │  │
│   │          ▼                                                           │  │
│   │   Get Finding Counts                                                 │  │
│   │   ├─ critical: 2                                                     │  │
│   │   ├─ high: 3                                                         │  │
│   │   ├─ medium: 10                                                      │  │
│   │   ├─ low: 20                                                         │  │
│   │   └─ info: 50                                                        │  │
│   │          │                                                           │  │
│   │          ▼                                                           │  │
│   │   Evaluate Against Thresholds                                        │  │
│   │   ├─ fail_on_critical && critical > 0? → BREACH                      │  │
│   │   ├─ fail_on_high && high > 0?                                       │  │
│   │   ├─ max_critical >= 0 && critical > max_critical? → BREACH          │  │
│   │   ├─ max_high >= 0 && high > max_high?                               │  │
│   │   └─ ... etc                                                         │  │
│   │          │                                                           │  │
│   │          ▼                                                           │  │
│   │   Quality Gate Result                                                │  │
│   │   ├─ passed: false                                                   │  │
│   │   ├─ reason: "Quality gate thresholds exceeded"                      │  │
│   │   ├─ breaches:                                                       │  │
│   │   │   └─ [{metric: "critical", limit: 0, actual: 2}]                 │  │
│   │   └─ counts: {critical: 2, high: 3, ...}                             │  │
│   │                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   CI/CD Integration                                                         │
│   ├─ SDK checks quality_gate_result.passed                                 │
│   ├─ If false → CI/CD pipeline fails                                       │
│   └─ If true → CI/CD pipeline continues                                    │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

### Custom Templates

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    SCANNER TEMPLATE SYSTEM                                  │
│                                                                             │
│   Template Types                                                            │
│   ├─ Nuclei (YAML) ─── Web vulnerability templates                         │
│   ├─ Semgrep (YAML) ── Static analysis rules                               │
│   └─ Gitleaks (TOML) ─ Secret detection patterns                           │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                    TEMPLATE LIFECYCLE                                │  │
│   │                                                                      │  │
│   │   Upload Template                                                    │  │
│   │          │                                                           │  │
│   │          ▼                                                           │  │
│   │   Validate Content (Scanner-specific)                                │  │
│   │   ├─ Parse YAML/TOML                                                 │  │
│   │   ├─ Check required fields                                           │  │
│   │   ├─ Count rules                                                     │  │
│   │   └─ Extract metadata                                                │  │
│   │          │                                                           │  │
│   │          ▼                                                           │  │
│   │   Sign Template (HMAC-SHA256)                                        │  │
│   │   └─ Using tenant's encryption key                                   │  │
│   │          │                                                           │  │
│   │          ▼                                                           │  │
│   │   Store Template                                                     │  │
│   │   ├─ content (base64 or S3 URL)                                      │  │
│   │   ├─ content_hash (SHA256)                                           │  │
│   │   └─ signature_hash (HMAC)                                           │  │
│   │                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                    TEMPLATE USAGE                                    │  │
│   │                                                                      │  │
│   │   Scan Profile                                                       │  │
│   │   └─ tools_config:                                                   │  │
│   │       └─ nuclei:                                                     │  │
│   │           ├─ enabled: true                                           │  │
│   │           ├─ template_mode: "custom" | "default" | "both"           │  │
│   │           └─ custom_template_ids: ["tpl-1", "tpl-2"]                 │  │
│   │                     │                                                │  │
│   │                     ▼                                                │  │
│   │   Agent Execution                                                    │  │
│   │   ├─ Download templates by ID                                        │  │
│   │   ├─ Verify signature                                                │  │
│   │   ├─ Write to temp directory                                         │  │
│   │   └─ Pass to scanner tool                                            │  │
│   │                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### Complete Scan Flow

```
User → Scan Definition → Schedule/Trigger → Command Queue → Agent Polling
                                                                   │
                                                                   ▼
                                              ┌─────────────────────────────┐
                                              │     AGENT EXECUTION         │
                                              │                             │
                                              │  1. Get tool configuration  │
                                              │  2. Download custom templates│
                                              │  3. Run scanner tools       │
                                              │  4. Transform to CTIS format │
                                              │  5. POST to ingest endpoint │
                                              └─────────────┬───────────────┘
                                                            │
                                                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INGEST PIPELINE                                    │
│                                                                              │
│  1. Process Targets → Create/Link Assets                                    │
│  2. Batch Check Fingerprints (dedupe)                                       │
│  3. Separate New vs Existing Findings                                       │
│  4. Batch Create New Findings                                               │
│  5. Batch Update Existing Findings                                          │
│  6. Process Dependencies (SBOM)                                             │
│  7. Update Asset Stats                                                       │
│  8. Evaluate Quality Gate                                                    │
│  9. Trigger Workflows (if events match)                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Event-Driven Automation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      EVENT → WORKFLOW → ACTION                               │
│                                                                              │
│   EVENTS                    WORKFLOWS                    ACTIONS             │
│   ───────                   ─────────                    ───────             │
│   finding.created    ─────► IF severity == critical ───► create_jira_ticket │
│                                        │                                     │
│                                        └───────────────► send_slack_alert   │
│                                                                              │
│   scan.completed     ─────► IF quality_gate.failed ────► notify_team        │
│                                        │                                     │
│                                        └───────────────► block_deployment   │
│                                                                              │
│   pipeline.failed    ─────► ALWAYS ────────────────────► page_oncall        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Dependency Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API ENDPOINT DEPENDENCIES                            │
│                                                                              │
│   /api/v1/scans                                                              │
│   ├── requires: scan-profiles (for configuration)                           │
│   ├── requires: assets/asset-groups (for targets)                           │
│   └── requires: agents (for execution)                                       │
│                                                                              │
│   /api/v1/scan-profiles                                                      │
│   ├── requires: tools (for tools_config)                                    │
│   └── requires: scanner-templates (for custom_template_ids)                 │
│                                                                              │
│   /api/v1/pipelines                                                          │
│   ├── requires: scan-profiles (for configuration)                           │
│   └── requires: tools (for steps)                                           │
│                                                                              │
│   /api/v1/agents                                                             │
│   ├── requires: capabilities (for capability matching)                      │
│   └── requires: tools (for tool availability)                               │
│                                                                              │
│   /api/v1/workflows                                                          │
│   ├── requires: integrations (for notifications/actions)                    │
│   └── requires: pipelines (for trigger_pipeline action)                     │
│                                                                              │
│   /api/v1/scanner-templates                                                  │
│   └── used by: scan-profiles (template_mode)                                │
│                                                                              │
│   /api/v1/tools                                                              │
│   ├── requires: capabilities (M:N relationship)                             │
│   └── requires: tool-categories (1:N relationship)                          │
│                                                                              │
│   /api/v1/capabilities                                                       │
│   └── used by: tools, agents                                                │
│                                                                              │
│   /api/v1/agent/ingest                                                       │
│   ├── creates: findings                                                      │
│   ├── creates: assets (auto-discovery)                                       │
│   ├── creates: components (SBOM)                                            │
│   └── triggers: workflows (on finding.created)                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

The OpenCTEM CTEM Platform is built around these core interaction patterns:

1. **Tenant Isolation**: All resources scoped by `tenant_id`, enforced at every layer
2. **Configuration Reuse**: Scan Profiles define reusable configurations with quality gates
3. **Pull-Based Execution**: Agents poll for commands, execute tools, report findings
4. **Event-Driven Automation**: Workflows respond to events with customizable actions
5. **Extensible Registry**: Tools and Capabilities support platform + custom entries
6. **Custom Templates**: Tenant-specific detection rules for supported scanners
7. **Quality Gates**: CI/CD integration with configurable pass/fail thresholds

---

## Related Documentation

- [Scan Flow Architecture](scan-flow.md) - Detailed scan execution flow
- [Scan Orchestration](scan-orchestration.md) - Agent-server communication
- [Workflow Executor](workflow-executor.md) - Automation engine details
- [Capabilities Registry](../features/capabilities-registry.md) - Tool capability system
- [Scan Profiles](../features/scan-profiles.md) - Profile configuration guide
- [Multi-Tenancy Guide](../guides/multi-tenancy.md) - Tenant isolation patterns

---

**Last Updated:** 2026-01-27
**Version:** 1.0
