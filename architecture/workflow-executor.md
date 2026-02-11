---
layout: default
title: Workflow Executor
parent: Architecture
nav_order: 15
---
{% raw %}

# Workflow Executor

The Workflow Executor orchestrates the execution of user-defined automation graphs, processing triggers, conditions, actions, and notifications in a secure, multi-tenant environment.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Security Controls](#security-controls)
- [Execution Flow](#execution-flow)
- [Action Handlers](#action-handlers)
- [Configuration](#configuration)
- [Key Files](#key-files)

---

## Overview

The Workflow Executor enables automated responses to security events through visual workflow graphs. Users can define:

- **Triggers**: Events that start the workflow (new finding, scan completed, etc.)
- **Conditions**: Branch logic based on data (severity, asset type, etc.)
- **Actions**: Operations to perform (assign user, trigger pipeline, HTTP request)
- **Notifications**: Alert delivery (Slack, Email, PagerDuty, etc.)

### Key Features

| Feature | Description |
|---------|-------------|
| **Graph-based Execution** | Topological ordering ensures correct dependency resolution |
| **Async Execution** | Non-blocking workflow triggers with rate limiting |
| **Multi-tenant Isolation** | Complete tenant separation at all execution phases |
| **Extensible Actions** | Plugin architecture for custom action handlers |
| **Comprehensive Audit** | Full audit trail of workflow executions |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Workflow Service                            │
│  (TriggerWorkflow, CreateWorkflow, UpdateWorkflow)              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Workflow Executor                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │ Rate Limiter    │  │ Tenant Isolator │  │ Panic Recovery │  │
│  │ (SEC-WF07/10)   │  │ (SEC-WF05)      │  │ (SEC-WF12)     │  │
│  └─────────────────┘  └─────────────────┘  └────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Graph Executor                         │   │
│  │  1. Load workflow + run                                  │   │
│  │  2. Execute triggers                                     │   │
│  │  3. Process nodes in topological order                   │   │
│  │  4. Evaluate conditions, execute actions                 │   │
│  │  5. Send notifications                                   │   │
│  │  6. Finalize run status                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ HTTP Handler │  │ Finding      │  │ Pipeline     │
│ (SEC-WF01-13)│  │ Handler      │  │ Handler      │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## Security Controls

The Workflow Executor implements **14 security controls** to protect against common attack vectors:

### Summary Table

| ID | Control | Protection | Risk Level |
|----|---------|------------|------------|
| SEC-WF01 | SSTI Prevention | Safe string interpolation (no template execution) | Critical |
| SEC-WF02 | SSRF Protection | URL validation with blocked CIDRs | Critical |
| SEC-WF03 | Notification SSTI | Safe interpolation for notifications | Critical |
| SEC-WF04 | Resource Limits | Global limits (50 concurrent, 5min timeout) | High |
| SEC-WF05 | Tenant Isolation | Verified at trigger, load, and execution | Critical |
| SEC-WF06 | Execution Timeout | Context timeout per workflow and node | High |
| SEC-WF07 | Global Rate Limit | Semaphore-based concurrency control | High |
| SEC-WF08 | Integration Isolation | TenantID always passed to integration service | High |
| SEC-WF09 | DNS Rebinding (early) | Require successful DNS resolution | High |
| SEC-WF10 | Per-Tenant Limit | 10 concurrent runs per tenant | Medium |
| SEC-WF11 | ReDoS Prevention | Expression length (500) and path depth (10) limits | Medium |
| SEC-WF12 | Panic Recovery | Defer-based cleanup with resource tracking | High |
| SEC-WF13 | DNS Rebinding (TOCTOU) | Custom dialer validates IP at connection time | High |
| SEC-WF14 | Log Injection | Input sanitization for NodeKey | Medium |

### SSRF Protection (SEC-WF02, SEC-WF09, SEC-WF13)

**Multi-layer defense against Server-Side Request Forgery:**

1. **URL Validation**: Scheme, host, and pattern validation
2. **Blocked CIDR Ranges**:
   ```
   127.0.0.0/8      - Loopback
   10.0.0.0/8       - Private
   172.16.0.0/12    - Private
   192.168.0.0/16   - Private
   169.254.0.0/16   - Link-local / Cloud metadata
   ::1/128          - IPv6 loopback
   fc00::/7         - IPv6 private
   fe80::/10        - IPv6 link-local
   ```
3. **Blocked Hostname Patterns**:
   ```
   .local, .internal, .localhost, .lan, .home, .corp, .intranet
   ```
4. **DNS Resolution Required**: Unresolvable domains are rejected
5. **TOCTOU-Safe Dialer**: IP validation at connection time, not URL parse time

### SSTI Prevention (SEC-WF01, SEC-WF03)

**Template injection protection via safe interpolation:**

```go
// WRONG: Template execution (vulnerable)
tmpl := template.New("").Parse(userInput)
tmpl.Execute(w, data)

// CORRECT: Safe string replacement
replacements := map[string]string{
    "{{.tenant_id}}": input.TenantID.String(),
    "{{.run_id}}":    input.RunID.String(),
}
for placeholder, value := range replacements {
    result = strings.ReplaceAll(result, placeholder, value)
}
```

### Tenant Isolation (SEC-WF05)

**Verification at multiple checkpoints:**

1. **Trigger Phase**: TenantID from authenticated context
2. **Load Phase**: Run's TenantID matches expected
3. **Execution Phase**: Workflow's TenantID matches Run's TenantID
4. **Integration Phase**: TenantID always passed to downstream services

### Rate Limiting (SEC-WF04, SEC-WF07, SEC-WF10)

**Two-tier rate limiting:**

| Scope | Limit | Behavior on Exceed |
|-------|-------|-------------------|
| Global | 50 concurrent | Run marked as failed (system at capacity) |
| Per-Tenant | 10 concurrent | Run marked as failed (tenant at capacity) |

### Panic Recovery (SEC-WF12)

**Resource tracking ensures cleanup on panic:**

```go
func (e *Executor) ExecuteAsync(runID, tenantID shared.ID) {
    go func() {
        var globalSlotAcquired, tenantSlotAcquired bool

        defer func() {
            if r := recover(); r != nil {
                // Log panic, mark run as failed
            }
            // Always release resources
            if globalSlotAcquired { <-e.runSemaphore }
            if tenantSlotAcquired { e.releaseTenantSlot(tenantID) }
        }()

        // Acquire slots with tracking
        // Execute workflow
    }()
}
```

---

## Execution Flow

### 1. Trigger Workflow

```
User/Event → WorkflowService.TriggerWorkflow()
           → Create Run + NodeRuns in DB
           → WorkflowExecutor.ExecuteAsyncWithTenant()
```

### 2. Async Execution

```
ExecuteAsyncWithTenant()
├── Check per-tenant limit (SEC-WF10)
├── Acquire global semaphore (SEC-WF07)
├── Set panic recovery (SEC-WF12)
└── ExecuteWithTenant()
    ├── Verify tenant isolation (SEC-WF05)
    ├── Apply execution timeout (SEC-WF06)
    ├── Load workflow graph
    └── executeGraph()
```

### 3. Graph Execution

```
executeGraph()
├── Execute trigger nodes
└── executeDownstream()
    ├── Find ready nodes (all dependencies completed)
    ├── Check conditions for branch skipping
    ├── Execute ready nodes
    │   ├── NodeType: Condition → Evaluate expression
    │   ├── NodeType: Action → Call ActionHandler
    │   └── NodeType: Notification → Call NotificationHandler
    └── Repeat until all nodes terminal
```

### 4. Node Execution

```
executeNode()
├── Mark node as running
├── Build node input (trigger data + context + upstream outputs)
├── Execute by type:
│   ├── Trigger: Pass through trigger data
│   ├── Condition: Evaluate expression (SEC-WF11)
│   ├── Action: Call registered handler
│   └── Notification: Send via notification service
├── Store output in context
└── Mark node completed/failed
```

---

## Action Handlers

### Built-in Handlers

| Action Type | Handler | Description |
|-------------|---------|-------------|
| `http_request` | HTTPRequestHandler | Secure HTTP requests with SSRF protection |
| `assign_user` | FindingActionHandler | Assign finding to user |
| `assign_team` | FindingActionHandler | Assign finding to team |
| `update_priority` | FindingActionHandler | Update finding priority |
| `update_status` | FindingActionHandler | Update finding status |
| `add_tags` | FindingActionHandler | Add tags to finding |
| `remove_tags` | FindingActionHandler | Remove tags from finding |
| `trigger_pipeline` | PipelineTriggerHandler | Trigger a pipeline run |
| `trigger_scan` | PipelineTriggerHandler | Trigger a scan execution |
| `create_ticket` | TicketActionHandler | Create ticket in Jira/GitHub |
| `update_ticket` | TicketActionHandler | Update existing ticket |
| `run_script` | ScriptRunnerHandler | **Disabled** - requires sandboxing |

### Custom Handler Registration

```go
// Implement ActionHandler interface
type ActionHandler interface {
    Execute(ctx context.Context, input *ActionInput) (map[string]any, error)
}

// Register with executor
executor.RegisterActionHandler(workflow.ActionTypeCustom, myHandler)
```

### ActionInput Structure

```go
type ActionInput struct {
    TenantID     shared.ID         // Workflow's tenant
    WorkflowID   shared.ID         // Workflow ID
    RunID        shared.ID         // Current run ID
    NodeKey      string            // Node key (sanitized for logging)
    ActionType   workflow.ActionType
    ActionConfig map[string]any    // Node configuration
    TriggerData  map[string]any    // Original trigger data
    Context      map[string]any    // Upstream outputs + context
}
```

---

## Configuration

### Executor Options

```go
executor := app.NewWorkflowExecutor(
    workflowRepo, runRepo, nodeRunRepo, logger,
    app.WithExecutorDB(db),                        // For transactions
    app.WithExecutorNotificationService(notifSvc), // For notifications
    app.WithExecutorIntegrationService(intSvc),    // For integrations
    app.WithExecutorAuditService(auditSvc),        // For audit logging
)
```

### Default Limits

| Setting | Default | Description |
|---------|---------|-------------|
| `maxConcurrentRuns` | 50 | Global concurrent executions |
| `maxConcurrentPerTenant` | 10 | Per-tenant concurrent executions |
| `maxExecutionTime` | 5 minutes | Workflow timeout |
| `maxNodeTime` | 30 seconds | Single node timeout |
| `maxExpressionLength` | 500 chars | Condition expression limit |
| `maxPathDepth` | 10 | Expression path resolution depth |

### HTTP Handler Limits

| Setting | Default | Description |
|---------|---------|-------------|
| `maxTimeout` | 30 seconds | Maximum HTTP request timeout |
| `maxBodySize` | 1 MB | Maximum response body size |
| `maxRedirects` | 3 | Maximum redirect follows |

---

## Key Files

| File | Description |
|------|-------------|
| `api/internal/app/workflow_executor.go` | Main executor with all security controls |
| `api/internal/app/workflow_handlers.go` | HTTP/Notification handlers with SSRF protection |
| `api/internal/app/workflow_action_handlers.go` | Action handlers (finding, pipeline, ticket) |
| `api/internal/app/workflow_service.go` | Service layer with tenant context |
| `api/internal/domain/workflow/` | Domain models (Workflow, Run, Node, etc.) |
| `api/cmd/server/services.go` | Executor wiring |

---

## Related Documentation

- [Notification System](notification-system.md) - Notification delivery architecture
- [Scan Pipeline Design](scan-pipeline-design.md) - Pipeline execution engine
- [Security Best Practices](../guides/SECURITY.md) - Platform security guidelines

---

**Last Updated:** 2026-01-26
**Version:** 1.0
{% endraw %}
