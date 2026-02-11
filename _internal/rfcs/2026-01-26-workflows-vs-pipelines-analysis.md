# Workflows vs Pipelines - Analysis & Implementation Plan

**Created:** 2026-01-26
**Status:** ✅ COMPLETED
**Last Updated:** 2026-01-26
**Completed:** 2026-01-26

---

## Executive Summary

After detailed codebase analysis, conclusion: **Workflows and Pipelines are 2 DIFFERENT systems** serving distinct purposes. They should be kept separate and connected to each other.

---

## 1. Detailed Analysis

### 1.1 Pipelines (Backend - Implemented)

**Purpose:** Scan execution orchestration - Coordinating the execution of scanner tools

**Location:**
- Backend: `api/internal/domain/pipeline/`, `api/internal/app/pipeline_service.go`
- Frontend: `ui/src/app/(dashboard)/(mobilization)/pipelines/` (newly created)

**Entities:**
```
PipelineTemplate
├── name, description, version
├── triggers: [manual, schedule, webhook, api, on_asset_discovery]
├── settings: max_parallel_steps, fail_fast, timeout
└── steps: PipelineStep[]

PipelineStep
├── step_key, name, order
├── tool: scanner tool name
├── capabilities: [scan, web, network, etc.]
├── config: tool-specific JSON config
├── depends_on: step dependencies
├── condition: always, never, expression, asset_type, step_result
├── retry: max_retries, retry_delay_seconds
└── ui_position: {x, y} for visual builder

PipelineRun → StepRun → Command → Agent execution
```

**Integration:**
- Agent system (command queue, polling)
- Findings collection
- Scan configs (Scan.PipelineID)

### 1.2 Workflows (Frontend Mock - No backend yet)

**Purpose:** General automation orchestration - Automating security operations

**Location:**
- Frontend: `ui/src/app/(dashboard)/(mobilization)/workflows/page.tsx`
- Backend: ❌ Not yet implemented

**Node Types (from mock data):**
```
Trigger (Green)
├── New Critical Finding
├── Schedule: Every Monday 2:00 AM
├── Finding Age > 48 hours
└── New Asset Discovered

Condition (Yellow)
├── IF/THEN logic
└── 2 output handles: yes/no

Action (Blue)
├── Assign to Team Lead
├── Full Asset Scan
├── Generate Report
├── Create Jira Ticket
└── Update Priority

Notification (Purple)
├── Send Slack Alert
├── Email to Security Team
└── Slack Notification
```

### 1.3 Comparison

| Aspect | Workflows | Pipelines |
|--------|-----------|-----------|
| **Layer** | Frontend only (mock) | Backend (fully implemented) |
| **Purpose** | General automation | Scan execution |
| **Actions** | External (Slack, Jira, assign) | Internal (scanner tools) |
| **Agent** | None | Deep integration |
| **Findings** | Trigger source | Output collection |
| **Database** | ❌ Not yet | ✅ Complete |
| **API** | ❌ Not yet | ✅ Complete |

---

## 2. Architecture Decision

### Keep Separate + Connect

```
┌─────────────────────────────────────────────────────────────┐
│                     WORKFLOWS (Automation)                   │
│  ┌─────────┐    ┌───────────┐    ┌──────────────────────┐   │
│  │ Trigger │───▶│ Condition │───▶│ Action               │   │
│  │         │    │           │    │ ├─ Assign User       │   │
│  │ Finding │    │ Severity? │    │ ├─ Send Notification │   │
│  │ Created │    │           │    │ ├─ Create Ticket     │   │
│  └─────────┘    └───────────┘    │ └─ RUN PIPELINE ────────────┐
│                                  └──────────────────────┘   │  │
└─────────────────────────────────────────────────────────────┘  │
                                                                  │
                    ┌─────────────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                     PIPELINES (Scan Execution)               │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐   │
│  │ Step 1  │───▶│ Step 2  │───▶│ Step 3  │───▶│ Step N  │   │
│  │ Nmap    │    │ Nuclei  │    │ SSLScan │    │ Report  │   │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘   │
│                         │                                    │
│                         ▼                                    │
│                   [Agent Execution]                          │
│                         │                                    │
│                         ▼                                    │
│                   [Findings Output]                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Plan

### Phase 1: Reorganize Current Work ✅ DONE

- [x] Pipelines backend (UIPosition, parallel control)
- [x] Pipelines frontend page `/pipelines`
- [x] API types, hooks, endpoints
- [x] WorkflowBuilder component (reusable)

### Phase 2: Rename for Clarity ✅ DONE

**Goal:** Clearly distinguish between Scan Pipelines and Automation Workflows

```
/workflows              → Keep as-is (Automation Workflows)
/pipelines              → Keep as-is, page title = "Scan Pipelines"
```

**Files updated:**
- [x] Rename page title: "Scan Pipelines" instead of "Pipelines" (already done in page.tsx)
- [x] Update navigation menu (added to sidebar-data.ts with GitMerge icon)
- [ ] Update docs (optional, can be done later)

### Phase 3: Build Workflows Backend ✅ COMPLETED

**Goal:** Create backend for Automation Workflows

**Implemented Files:**
```
api/internal/
├── domain/workflow/
│   ├── entity.go           # Workflow, Node, Edge, NodeType ✅
│   ├── node_types.go       # Trigger, Condition, Action, Notification ✅
│   ├── execution.go        # WorkflowRun, NodeRun ✅
│   ├── errors.go           # ✅
│   └── repository.go       # Interfaces ✅
├── infra/postgres/
│   ├── workflow_repository.go      # ✅
│   └── workflow_run_repository.go  # ✅
└── app/
    ├── workflow_service.go         # Core logic ✅
    ├── workflow_executor.go        # Execution engine with 14 security controls ✅
    ├── workflow_handlers.go        # HTTP/Notification trigger handlers ✅
    └── workflow_action_handlers.go # Action execution handlers ✅
```

**14 Security Controls Implemented (SEC-WF01 through SEC-WF14):**
- SSRF Protection: URL validation, blocked CIDRs, TOCTOU-safe dialer
- SSTI Prevention: Safe string interpolation (no template execution)
- Resource Exhaustion: Semaphores (50 global, 10 per-tenant), timeouts
- Tenant Isolation: Multi-phase verification
- ReDoS Prevention: Expression complexity limits
- Panic Recovery: Defer-based cleanup with resource tracking
- Log Injection Prevention: Input sanitization

**Documentation:**
- `CLAUDE.MD` - Workflow Executor Security Controls section
- `docs/architecture/workflow-executor.md` - Full architecture documentation
- `docs/guides/SECURITY.md` - Workflow Automation Security section

**Database tables:** (Implemented via migrations)
```sql
-- Workflow definitions
CREATE TABLE workflows (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Workflow nodes
CREATE TABLE workflow_nodes (
    id UUID PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES workflows(id),
    node_type VARCHAR(50) NOT NULL, -- trigger, condition, action, notification
    node_key VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    config JSONB DEFAULT '{}',
    ui_position_x DOUBLE PRECISION DEFAULT 0,
    ui_position_y DOUBLE PRECISION DEFAULT 0
);

-- Workflow edges (connections)
CREATE TABLE workflow_edges (
    id UUID PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES workflows(id),
    source_node_id UUID NOT NULL REFERENCES workflow_nodes(id),
    target_node_id UUID NOT NULL REFERENCES workflow_nodes(id),
    source_handle VARCHAR(50), -- for condition nodes: 'yes' or 'no'
    label VARCHAR(100)
);

-- Workflow executions
CREATE TABLE workflow_runs (
    id UUID PRIMARY KEY,
    workflow_id UUID NOT NULL REFERENCES workflows(id),
    tenant_id UUID NOT NULL,
    trigger_type VARCHAR(50) NOT NULL,
    trigger_data JSONB,
    status VARCHAR(50) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- Node executions
CREATE TABLE workflow_node_runs (
    id UUID PRIMARY KEY,
    workflow_run_id UUID NOT NULL REFERENCES workflow_runs(id),
    node_id UUID NOT NULL REFERENCES workflow_nodes(id),
    status VARCHAR(50) NOT NULL,
    input JSONB,
    output JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);
```

### Phase 4: Workflow-Pipeline Integration ✅ COMPLETED

**Goal:** Allow Workflow to trigger Pipeline

**Implemented in `api/internal/app/workflow_action_handlers.go`:**

Supported Action Types:
- `trigger_pipeline` - Triggers a scan pipeline with context passing
- `trigger_scan` - Triggers a scan configuration
- `send_notification` - Sends notifications via configured channels
- `create_ticket` - Creates tickets in external systems (Jira, etc.)
- `update_finding` - Updates finding status/priority
- `assign_user` - Assigns findings to users
- `http_request` - Makes HTTP requests (with SSRF protection)

**Code Implementation:**
```go
// workflow_action_handlers.go
func (e *WorkflowExecutor) executeAction(ctx context.Context, run *workflow.WorkflowRun, node *workflow.Node, input map[string]any) (*ActionResult, error) {
    switch node.ActionType {
    case "trigger_pipeline":
        return e.handleTriggerPipeline(ctx, run, node, input)
    case "trigger_scan":
        return e.handleTriggerScan(ctx, run, node, input)
    case "send_notification":
        return e.handleSendNotification(ctx, run, node, input)
    case "create_ticket":
        return e.handleCreateTicket(ctx, run, node, input)
    case "update_finding":
        return e.handleUpdateFinding(ctx, run, node, input)
    case "assign_user":
        return e.handleAssignUser(ctx, run, node, input)
    case "http_request":
        return e.handleHTTPRequest(ctx, run, node, input)
    default:
        return nil, workflow.ErrUnknownActionType
    }
}
```

### Phase 5: Connect Workflows Frontend ✅ COMPLETED

**Goal:** Connect frontend with backend API

- [x] Replace mock data with API calls (`useWorkflows`, `useWorkflowRuns` hooks)
- [x] Add CRUD operations for workflows
  - [x] Create workflow dialog with name/description
  - [x] Delete workflow with confirmation
  - [x] Toggle workflow active status
  - [x] Trigger workflow execution
- [x] Visual workflow builder (existing, using ReactFlow)
- [ ] Pipeline selector component (deferred - can add action nodes manually)
- [ ] Real-time execution monitoring (deferred - basic polling in place)

**Implementation Details:**
- File: `ui/src/app/(dashboard)/(mobilization)/workflows/page.tsx`
- Uses SWR hooks from `ui/src/lib/api/workflow-hooks.ts`
- Types from `ui/src/lib/api/workflow-types.ts`
- API endpoints from `ui/src/lib/api/endpoints.ts`

---

## 4. Current State Summary

| Component | Status | Location |
|-----------|--------|----------|
| Pipeline Backend | ✅ Done | `api/internal/domain/pipeline/` |
| Pipeline API | ✅ Done | `api/internal/infra/http/handler/pipeline_handler.go` |
| Pipeline Frontend Types | ✅ Done | `ui/src/lib/api/pipeline-types.ts` |
| Pipeline Frontend Hooks | ✅ Done | `ui/src/lib/api/pipeline-hooks.ts` |
| Pipeline Page | ✅ Done | `ui/src/app/(dashboard)/(mobilization)/pipelines/` |
| WorkflowBuilder Component | ✅ Done | `ui/src/features/pipelines/components/` |
| Workflow Backend | ✅ Done | `api/internal/domain/workflow/`, `api/internal/app/workflow_*.go` |
| Workflow API | ✅ Done | `api/internal/app/workflow_handlers.go` |
| Workflow-Pipeline Integration | ✅ Done | `api/internal/app/workflow_action_handlers.go` |
| Workflow Frontend Integration | ✅ Done | `ui/src/app/(dashboard)/(mobilization)/workflows/page.tsx` |

---

## 5. Important Notes

1. **Don't delete existing code** - Pipeline backend and frontend are working well
2. **Reuse WorkflowBuilder** - This component can be used for both (pipelines and workflows)
3. **Naming convention:**
   - Pipelines = Scan execution (running scanners)
   - Workflows = Automation (notify, assign, ticket)
4. **Integration point:** Workflows can trigger Pipelines via action type "trigger_pipeline"

---

## 6. Next Steps (Priority Order)

1. ✅ ~~Complete Pipeline frontend~~ (DONE)
2. ✅ ~~Rename/clarify page titles for distinction~~ (DONE - page.tsx has "Scan Pipelines")
3. ✅ ~~Update navigation menu~~ (DONE - sidebar-data.ts updated with GitMerge icon)
4. ✅ ~~Build Workflows backend~~ (DONE - with 14 security controls)
5. ✅ ~~Add trigger_pipeline action type~~ (DONE - 7 action types implemented)
6. ✅ ~~Connect Workflows frontend to API~~ (DONE)

---

## 7. Implementation Details (Added 2026-01-26)

### Workflow Executor Security Controls

The workflow executor implements 14 security controls:

| Control | Description |
|---------|-------------|
| SEC-WF01 | SSTI Prevention - Safe string interpolation |
| SEC-WF02 | SSRF Prevention - URL validation with blocklist |
| SEC-WF03 | Template Injection - No template execution |
| SEC-WF04 | Resource Limits - Global semaphore (50) |
| SEC-WF05 | Tenant Isolation - Context verification |
| SEC-WF06 | Execution Timeouts - Per-node timeouts |
| SEC-WF07 | Rate Limiting - Per-tenant semaphore (10) |
| SEC-WF08 | Data Isolation - Tenant boundary checks |
| SEC-WF09 | Network Security - Blocked private CIDRs |
| SEC-WF10 | Memory Limits - Response size caps |
| SEC-WF11 | ReDoS Prevention - Expression complexity limits |
| SEC-WF12 | Panic Recovery - Defer-based cleanup |
| SEC-WF13 | TOCTOU Prevention - Safe DNS resolution |
| SEC-WF14 | Log Injection - Input sanitization |

### Test Scripts

Security tests are available at:
- `api/scripts/test_workflow_executor.go` - 44 tests
- `api/scripts/test_security_controls.go` - 39 tests
- `api/scripts/run_security_tests.sh` - Main runner

Run with:
```bash
cd api && ./scripts/run_security_tests.sh
```
