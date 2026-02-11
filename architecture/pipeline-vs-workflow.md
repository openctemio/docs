---
layout: default
title: Pipeline vs Workflow
parent: Architecture
nav_order: 6
---

# Pipeline vs Workflow: Understanding the Difference

> **Last Updated**: January 31, 2026

This document explains the fundamental differences between **Pipelines** and **Workflows** in the OpenCTEM platform. While they may seem similar, they serve distinctly different purposes and are complementary components of the security automation architecture.

---

## Quick Summary

| Aspect | Pipeline | Workflow |
|--------|----------|----------|
| **Purpose** | Execute security scans | Automate responses to events |
| **Role** | **PRODUCER** of findings | **CONSUMER** of findings |
| **Node Types** | Tool execution only | Trigger, Condition, Action, Notification |
| **Output** | Findings, scan results | Side effects (assignments, tickets, alerts) |

**Key Insight**: Pipelines produce findings, Workflows react to them.

---

## What is a Pipeline?

A **Pipeline** is a **scan orchestration engine** that executes multiple security scanning tools in a defined sequence.

### Purpose

- Define multi-step security scanning workflows
- Execute tools like semgrep, trivy, nuclei, gitleaks
- Produce findings and scan results

### Characteristics

| Characteristic | Description |
|----------------|-------------|
| **Scan-Focused** | Each step executes a scanning tool |
| **DAG Execution** | Steps run sequentially or in parallel based on dependencies |
| **Tool-Centric** | Steps require capabilities (SAST, SCA, DAST) and prefer specific tools |
| **Agent-Driven** | Steps are dispatched to workers/agents as commands |
| **Findings-Oriented** | Output is security findings |

### Example Pipeline

```yaml
name: "Full Security Scan"
trigger: [manual, schedule, on_asset_discovery]

steps:
  - id: sast
    name: "Static Analysis"
    tool: semgrep
    capabilities: [sast]
    order: 1

  - id: sca
    name: "Dependency Scan"
    tool: trivy
    capabilities: [sca]
    order: 2
    parallel_with: [sast]  # Runs in parallel with SAST

  - id: secrets
    name: "Secret Detection"
    tool: gitleaks
    capabilities: [secrets]
    order: 3
    parallel_with: [sast, sca]

  - id: dast
    name: "Dynamic Testing"
    tool: nuclei
    capabilities: [dast]
    order: 4
    depends_on: [sast, sca, secrets]  # Waits for all above
    condition: "asset.type == 'web_application'"
```

### Visual Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     PIPELINE EXECUTION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────┐   ┌─────────┐   ┌─────────┐                       │
│   │  SAST   │   │   SCA   │   │ Secrets │  ← Parallel steps    │
│   │(semgrep)│   │ (trivy) │   │(gitleaks│                       │
│   └────┬────┘   └────┬────┘   └────┬────┘                       │
│        │             │             │                             │
│        └─────────────┼─────────────┘                             │
│                      │                                           │
│                      ▼                                           │
│               ┌─────────────┐                                    │
│               │    DAST     │  ← Sequential (depends on above)  │
│               │  (nuclei)   │                                    │
│               └──────┬──────┘                                    │
│                      │                                           │
│                      ▼                                           │
│               ┌─────────────┐                                    │
│               │  FINDINGS   │  ← OUTPUT                          │
│               │ (50 total)  │                                    │
│               └─────────────┘                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Domain Model

```
Pipeline Template
  └── Steps (1..N)
        ├── Tool configuration
        ├── Capabilities required
        ├── Dependencies
        └── Conditions

Pipeline Run (execution instance)
  └── Step Runs (1..N)
        ├── Status (pending, running, completed, failed)
        ├── Findings count
        └── Command sent to agent
```

---

## What is a Workflow?

A **Workflow** is an **event-driven automation engine** that reacts to security events and performs automated actions.

### Purpose

- Automate responses to security events
- Route findings to the right people
- Create tickets, send alerts, trigger follow-up actions
- Define conditional logic for different scenarios

### Characteristics

| Characteristic | Description |
|----------------|-------------|
| **Event-Driven** | Triggered by findings, scans, assets, schedules |
| **Graph-Based** | Nodes connected by edges with conditional branching |
| **Action-Diverse** | Assignments, tickets, notifications, HTTP requests, pipeline triggers |
| **No Agents** | Runs server-side, no external tool execution |
| **Side Effects** | Output is actions, not findings |

### Node Types

| Node Type | Purpose | Examples |
|-----------|---------|----------|
| **Trigger** | Start the workflow | Finding created, scan completed, schedule |
| **Condition** | Branch based on data | If severity >= High, if asset.type == "production" |
| **Action** | Perform an operation | Assign user, create ticket, update status, trigger pipeline |
| **Notification** | Send alerts | Slack, Email, PagerDuty, Webhook |

### Example Workflow

```yaml
name: "Critical Finding Response"
trigger: finding_created

nodes:
  - id: trigger
    type: trigger
    event: finding_created

  - id: check_severity
    type: condition
    expression: "finding.severity >= 'critical'"

  - id: assign_security
    type: action
    action: assign_user
    config:
      user_group: "security-team"

  - id: create_ticket
    type: action
    action: create_ticket
    config:
      system: "jira"
      project: "SEC"
      priority: "P1"

  - id: notify_slack
    type: notification
    channel: "slack"
    config:
      webhook: "$SLACK_SECURITY_WEBHOOK"
      message: "🚨 Critical finding in {{asset.name}}: {{finding.title}}"

  - id: trigger_deep_scan
    type: action
    action: trigger_pipeline
    config:
      pipeline_id: "deep-security-scan"

edges:
  - from: trigger → to: check_severity
  - from: check_severity → to: assign_security (when: true)
  - from: check_severity → to: skip (when: false)
  - from: assign_security → to: create_ticket
  - from: create_ticket → to: notify_slack
  - from: notify_slack → to: trigger_deep_scan
```

### Visual Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     WORKFLOW EXECUTION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌────────────────────┐                                        │
│   │ TRIGGER            │                                        │
│   │ Finding Created    │                                        │
│   └─────────┬──────────┘                                        │
│             │                                                    │
│             ▼                                                    │
│   ┌────────────────────┐                                        │
│   │ CONDITION          │                                        │
│   │ Severity >= High?  │                                        │
│   └─────────┬──────────┘                                        │
│             │                                                    │
│      ┌──────┴──────┐                                            │
│      │             │                                             │
│     YES           NO                                             │
│      │             │                                             │
│      ▼             ▼                                             │
│   ┌──────────┐  ┌──────┐                                        │
│   │ ACTION   │  │ SKIP │                                        │
│   │ Assign   │  └──────┘                                        │
│   │ User     │                                                   │
│   └────┬─────┘                                                   │
│        │                                                         │
│        ▼                                                         │
│   ┌──────────┐                                                   │
│   │ ACTION   │                                                   │
│   │ Create   │                                                   │
│   │ Ticket   │                                                   │
│   └────┬─────┘                                                   │
│        │                                                         │
│        ▼                                                         │
│   ┌──────────────┐                                               │
│   │ NOTIFICATION │                                               │
│   │ Slack Alert  │                                               │
│   └──────┬───────┘                                               │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────┐                                               │
│   │ ACTION       │  ← Can trigger a PIPELINE!                   │
│   │ Trigger      │                                               │
│   │ Pipeline     │                                               │
│   └──────────────┘                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Domain Model

```
Workflow
  └── Nodes (1..N)
        ├── Type (trigger, condition, action, notification)
        ├── Configuration
        └── Edges (connections to other nodes)

Workflow Run (execution instance)
  └── Node Runs (1..N)
        ├── Status (pending, running, completed, failed, skipped)
        ├── Output data
        └── Error message (if failed)
```

---

## Key Differences

### 1. Purpose and Output

| Aspect | Pipeline | Workflow |
|--------|----------|----------|
| **Primary Purpose** | Execute security scans | Automate responses |
| **Output Type** | Findings (security issues) | Side effects (tickets, alerts) |
| **Data Flow** | Tool → Findings → Database | Event → Actions → External systems |

### 2. Node/Step Types

| Pipeline Steps | Workflow Nodes |
|----------------|----------------|
| Tool execution only | Trigger |
| - | Condition (if/else) |
| - | Action (assign, update, create, trigger) |
| - | Notification (Slack, Email, etc.) |

### 3. Execution Model

| Aspect | Pipeline | Workflow |
|--------|----------|----------|
| **Execution** | Agent-based (external) | Server-side (internal) |
| **Dependencies** | Step dependencies (DAG) | Node edges (Graph) |
| **Parallelism** | Parallel steps | Topological execution |
| **External Calls** | Tool execution on agents | HTTP requests, webhooks |

### 4. Triggers

| Pipeline Triggers | Workflow Triggers |
|-------------------|-------------------|
| Manual | Manual |
| Schedule | Schedule |
| Webhook | Webhook |
| On asset discovery | Finding created/updated |
| - | Finding age threshold |
| - | Scan completed |
| - | Asset discovered |

---

## How They Work Together

The most powerful aspect is that **Workflows can trigger Pipelines**, creating a closed-loop automation system.

### Producer-Consumer Relationship

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLOSED-LOOP AUTOMATION                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐         ┌─────────────┐                       │
│   │  PIPELINE   │         │  WORKFLOW   │                       │
│   │ (Producer)  │         │ (Consumer)  │                       │
│   └──────┬──────┘         └──────┬──────┘                       │
│          │                       │                               │
│          │  Produces             │  Reacts to                   │
│          │  findings             │  findings                    │
│          │                       │                               │
│          ▼                       │                               │
│   ┌─────────────┐               │                               │
│   │  FINDINGS   │◄──────────────┘                               │
│   │  DATABASE   │                                                │
│   └──────┬──────┘                                                │
│          │                                                       │
│          │  Events emitted                                       │
│          │  (finding_created)                                    │
│          ▼                                                       │
│   ┌─────────────┐                                                │
│   │  WORKFLOW   │                                                │
│   │  EXECUTOR   │                                                │
│   └──────┬──────┘                                                │
│          │                                                       │
│          │  Can trigger                                          │
│          │  more pipelines                                       │
│          ▼                                                       │
│   ┌─────────────┐                                                │
│   │  PIPELINE   │  ← Cascade: workflow triggers new scan        │
│   │ (Deep Scan) │                                                │
│   └─────────────┘                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Real-World Example

**Scenario**: New repository added, automatic security assessment with escalation

```
1. Asset Discovery
   │
   ├──► PIPELINE: "Initial Security Scan"
   │    ├── SAST (semgrep)
   │    ├── SCA (trivy)
   │    └── Secrets (gitleaks)
   │         │
   │         ▼
   │    FINDINGS: 15 issues found
   │         │
   └──► WORKFLOW: "Finding Triage"
        │
        ├── Check: Any critical findings?
        │    │
        │   YES (2 critical)
        │    │
        │    ├── Action: Assign to security team
        │    ├── Action: Create Jira ticket
        │    ├── Notification: Slack #security-alerts
        │    │
        │    └── Action: Trigger Pipeline "Deep Scan"
        │              │
        │              ▼
        │         PIPELINE: "Deep Security Scan"
        │         ├── DAST (nuclei)
        │         ├── Container scan (trivy)
        │         └── Infrastructure scan (tfsec)
        │              │
        │              ▼
        │         FINDINGS: 5 more issues
        │              │
        └──► WORKFLOW: "Critical Response"
             ├── Check: Production asset?
             │   YES
             │    ├── Action: Page on-call engineer
             │    └── Notification: PagerDuty
```

---

## When to Use Which

### Use Pipeline When

| Scenario | Why Pipeline |
|----------|--------------|
| Running security scans | Pipelines execute tools |
| Multi-tool assessment | Orchestrate multiple scanners |
| Scheduled scanning | Built-in schedule support |
| Asset-specific scans | Target specific assets |
| Producing findings | Pipeline output = findings |

### Use Workflow When

| Scenario | Why Workflow |
|----------|--------------|
| Responding to findings | Event-driven triggers |
| Routing to right team | Conditional assignment logic |
| Creating tickets | Action: create_ticket |
| Sending alerts | Multiple notification channels |
| Conditional logic | If/else branching |
| Triggering follow-up scans | Action: trigger_pipeline |

---

## Technical Comparison

### Code Structure

| Component | Pipeline | Workflow |
|-----------|----------|----------|
| **Domain** | `domain/pipeline/` | `domain/workflow/` |
| **Service** | `app/pipeline_service.go` | `app/workflow_service.go` |
| **Executor** | Embedded in service | `app/workflow_executor.go` |
| **Repository** | `postgres/pipeline_*.go` | `postgres/workflow_*.go` |
| **Lines of Code** | ~1700 lines | ~700 lines |

### Status Values

| Pipeline Status | Workflow Status |
|-----------------|-----------------|
| pending | pending |
| running | running |
| completed | completed |
| failed | failed |
| canceled | cancelled |
| timeout | - |

### Concurrency Limits

| Limit | Pipeline | Workflow |
|-------|----------|----------|
| Per entity | 5 concurrent runs | 5 concurrent runs |
| Per tenant | 50 concurrent runs | 50 concurrent runs |
| Global | - | 50 concurrent executions |

---

## Summary

| Aspect | Pipeline | Workflow |
|--------|----------|----------|
| **One-liner** | "Execute security scans" | "Automate responses" |
| **Analogy** | Factory worker (produces) | Traffic controller (directs) |
| **Input** | Asset/target | Event (finding, scan, etc.) |
| **Output** | Findings | Actions (tickets, alerts, assignments) |
| **Agents** | Yes (runs on agents) | No (runs server-side) |
| **Triggers** | Manual, schedule, asset discovery | Events, schedule, manual |
| **Relationship** | Producer | Consumer (can trigger producers) |

**Bottom Line**: Pipelines and Workflows are not duplicates. They are complementary components that together form a complete security automation platform:

- **Pipelines** = Security scanning engine (find vulnerabilities)
- **Workflows** = Automation engine (respond to vulnerabilities)
- **Together** = Closed-loop security operations

---

## References

- [Scan Pipeline Architecture](scan-pipeline-design.md) - Detailed pipeline design
- [Workflow Executor](workflow-executor.md) - Workflow security and execution
- [Scan Flow Architecture](scan-flow.md) - Complete scan lifecycle
- [Scan Orchestration](scan-orchestration.md) - Scheduling and progression
