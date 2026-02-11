---
layout: default
title: Features
nav_order: 5
has_children: true
permalink: /features/
---

# Features

Documentation for major features in the OpenCTEM CTEM Platform.

---

## Core Features

| Feature | Description | Status |
|---------|-------------|--------|
| [Platform Agents](platform-agents.md) | Shared scanning infrastructure managed by OpenCTEM | ✅ Implemented |
| [Scan Profiles](scan-profiles.md) | Reusable scan configs with Quality Gates | ✅ Implemented |
| [Scanner Templates](scanner-templates.md) | Custom detection rules for Nuclei, Semgrep, Gitleaks | ✅ Implemented |
| [Quality Gates](quality-gates.md) | CI/CD pass/fail decisions based on finding thresholds | ✅ Implemented |
| [Finding Lifecycle](finding-lifecycle.md) | Branch-aware auto-resolve and feature branch expiry | ✅ Implemented |
| [Finding Types & Fingerprinting](finding-types.md) | Polymorphic findings with type-aware deduplication | ✅ Implemented |
| [Finding Deduplication](finding-deduplication.md) | Fingerprint-based deduplication with security controls | ✅ Implemented |
| [Finding Sources](finding-sources.md) | Dynamic finding source configuration with caching | ✅ Implemented |
| [Data Flow Tracking](data-flow-tracking.md) | SARIF codeFlows for attack path analysis | ✅ Implemented |
| [Workflow Automation](workflows.md) | Event-driven automation for notifications, tickets, assignments | ✅ Implemented |
| [Scan Pipelines](pipelines.md) | Multi-step scan orchestration with visual builder | ✅ Implemented |
| [Scan Configurations](scan-configs.md) | Scheduled and on-demand scan management | ✅ Implemented |
| [CTEM Finding Fields](ctem-fields.md) | Exposure, remediation, and business impact fields | ✅ Implemented |
| [Capabilities Registry](capabilities-registry.md) | Normalized tool capability management | ✅ Implemented |
| [Asset Sub-Modules](asset-sub-modules.md) | Hierarchical module system for asset types | ✅ Implemented |
| [AI Triage](ai-triage.md) | AI-powered vulnerability analysis and prioritization | ✅ Implemented |

---

## Feature Categories

### Infrastructure

| Feature | Description |
|---------|-------------|
| **Platform Agents** | Shared, multi-tenant scanning agents |
| **Storage Service** | Multi-tenant storage with BYOB support |

### Scanning

| Feature | Description |
|---------|-------------|
| **[Scan Configurations](scan-configs.md)** | Bind assets with scanners/pipelines, scheduling |
| **[Scan Pipelines](pipelines.md)** | Multi-step automated scanning workflows |
| **Scan Profiles** | Reusable configurations with Quality Gates and Template Modes |
| **Scanner Templates** | Custom templates for Nuclei, Semgrep, Gitleaks |
| **Capabilities Registry** | Normalized tool capability management |
| **Quality Gates** | CI/CD pass/fail decisions based on finding thresholds |

### Finding Management

| Feature | Description |
|---------|-------------|
| **Finding Lifecycle** | Branch-aware auto-resolve, auto-reopen, feature branch expiry |
| **Finding Types** | Polymorphic findings with specialized columns and fingerprinting |
| **Finding Sources** | Dynamic source configuration (SAST, DAST, Pentest, etc.) |
| **Finding Deduplication** | Type-aware fingerprinting with security controls |
| **Data Flow Tracking** | SARIF codeFlows for attack path visualization |

### CTEM Framework

| Feature | Description |
|---------|-------------|
| **CTEM Finding Fields** | Exposure vector, remediation context, business impact fields |
| **Risk Calculation** | CTEM-aware risk scoring with multipliers |
| **Prioritization** | High-priority detection based on exposure and compliance |

### Automation

| Feature | Description |
|---------|-------------|
| **Workflow Automation** | Event-driven automation with triggers, conditions, actions |
| **Notifications** | Multi-channel alerts (Slack, Email, Teams, PagerDuty) |
| **Integrations** | Ticket creation (Jira), HTTP webhooks, custom scripts |

### Asset Management

| Feature | Description |
|---------|-------------|
| **Asset Sub-Modules** | Dynamic control over asset type visibility |
| **Asset Groups** | Organize assets into logical groups |

### Access Control

| Feature | Description |
|---------|-------------|
| **Module Access Control** | Subscription-based feature gating |
| **Group-Based Access** | Fine-grained resource permissions |

### AI & Intelligence

| Feature | Description |
|---------|-------------|
| **[AI Triage](ai-triage.md)** | LLM-powered vulnerability analysis and prioritization |
| **Auto-Triage** | Automatic AI analysis on new findings |
| **False Positive Detection** | AI-powered false positive identification |
| **Remediation Guidance** | AI-generated fix recommendations |

---

## Reference

| Document | Description |
|----------|-------------|
| [Component Interactions](component-interactions.md) | Complete overview of how components interact |

---

## Related Documentation

- [Architecture Overview](../architecture/overview.md)
- [Scan Pipeline Design](../architecture/scan-pipeline-design.md)
