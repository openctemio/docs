# ITSM Integration — Implementation Plan

**Created:** 2026-03-10
**Status:** Planned (foundation only)
**Priority:** P1
**Last Updated:** 2026-03-10
**Author:** Claude (AI Assistant)

---

## Summary

Implement full ITSM (IT Service Management) integration for the OpenCTEM CTEM platform. This connects Phase 4 (Mobilization) and Phase 5 (Validation) of the CTEM lifecycle — enabling automated ticket creation from findings/exposures, bidirectional status sync, and remediation tracking through external ticketing systems (Jira, ServiceNow, Linear).

---

## Current State

### What Exists (Foundation)

| Component | Status | Location |
|-----------|--------|----------|
| Integration entity with `ticketing` category | Defined | `api/pkg/domain/integration/entity.go` |
| Providers: `jira`, `linear`, `asana` | Defined (no impl) | `entity.go:70-75` |
| Workflow actions: `create_ticket`, `update_ticket` | Skeleton | `api/internal/app/workflow_action_handlers.go:472-565` |
| DB schema: `integrations` table | Ready | `api/migrations/000019_integrations.up.sql` |
| Extension table pattern | Proven | SCM + Notification extensions |
| Credentials encryption (AES-256-GCM) | Working | `integration_service.go` |
| UI: Ticketing settings page | Placeholder | `ui/src/app/(dashboard)/settings/integrations/ticketing/page.tsx` |
| UI: Ticket dashboard | Placeholder | `ui/src/app/(dashboard)/(mobilization)/collaboration/tickets/page.tsx` |
| Module: `integrations.ticketing` | Released | `000004_modules.up.sql:158` |
| Sidebar nav | Present | `ui/src/config/sidebar-data.ts:654-658` |
| Frontend types (available: false) | Defined | `ui/src/features/integrations/types/integration.types.ts:645-678` |

### What's Missing

- No ticketing extension table (no project/field mappings, sync config)
- No ticketing client implementations (Jira API, ServiceNow API, etc.)
- No `finding_tickets` linking table (finding ↔ external ticket)
- No bidirectional sync (webhook receiver for ticket status changes)
- No real workflow action implementation (skeleton only)
- No ticketing-specific API endpoints
- UI is fully placeholder with mock data

---

## Architecture Design

### Domain Model

```
Integration (ticketing)
    ├── TicketingExtension (project mappings, field config, sync rules)
    ├── TicketingClient (Jira, ServiceNow, Linear — implements client interface)
    └── FindingTicket (linking table: finding_id ↔ ticket_id + ticket_url + status)

Flow:
  Finding Created → Workflow Engine → Auto-Ticketing Rule Match
    → TicketingClient.CreateIssue() → FindingTicket record saved
    → Webhook/Poll receives status update → FindingTicket.status updated
    → If resolved → Finding marked as remediated (validation)
```

### Extension Table Pattern

Following the proven `integration_scm_extensions` / `integration_notification_extensions` pattern:

```
integration_ticketing_extensions
    ├── integration_id (PK, FK → integrations)
    ├── default_project (default project/board key)
    ├── default_issue_type (bug, task, story, incident, etc.)
    ├── default_priority_mapping (JSONB: {critical: "highest", high: "high", ...})
    ├── field_mappings (JSONB: custom field mappings)
    ├── sync_direction (one_way | bidirectional)
    ├── sync_interval_minutes (for polling-based sync)
    ├── auto_create_rules (JSONB: conditions for auto-ticket creation)
    ├── status_mapping (JSONB: {jira_status → finding_action})
    ├── webhook_secret (for incoming webhooks)
    ├── last_ticket_sync_at
    └── total_tickets_created
```

### Client Interface

```go
// pkg/domain/integration/ticketing_client.go
type TicketingClient interface {
    // Connection
    TestConnection(ctx context.Context) error

    // Tickets
    CreateIssue(ctx context.Context, input CreateIssueInput) (*Issue, error)
    UpdateIssue(ctx context.Context, issueKey string, input UpdateIssueInput) (*Issue, error)
    GetIssue(ctx context.Context, issueKey string) (*Issue, error)

    // Metadata
    ListProjects(ctx context.Context) ([]Project, error)
    ListIssueTypes(ctx context.Context, projectKey string) ([]IssueType, error)
    ListPriorities(ctx context.Context) ([]Priority, error)
    ListStatuses(ctx context.Context, projectKey string) ([]Status, error)

    // Provider
    Provider() string
}

type Issue struct {
    Key         string            // e.g. "SEC-123"
    ID          string            // provider-specific ID
    URL         string            // web URL
    Title       string
    Description string
    Status      string
    Priority    string
    Assignee    string
    Labels      []string
    CreatedAt   time.Time
    UpdatedAt   time.Time
    Fields      map[string]any    // custom fields
}
```

---

## Implementation Phases

### Phase 1: Database & Domain Layer

**Migration 000054: Ticketing Integration Tables**

```sql
-- 1. Ticketing extension table
CREATE TABLE integration_ticketing_extensions (
    integration_id  UUID PRIMARY KEY REFERENCES integrations(id) ON DELETE CASCADE,
    default_project VARCHAR(100),
    default_issue_type VARCHAR(50) DEFAULT 'bug',
    priority_mapping JSONB DEFAULT '{"critical":"highest","high":"high","medium":"medium","low":"low"}',
    field_mappings JSONB DEFAULT '{}',
    sync_direction VARCHAR(20) DEFAULT 'one_way' CHECK (sync_direction IN ('one_way', 'bidirectional')),
    sync_interval_minutes INT DEFAULT 60,
    auto_create_rules JSONB DEFAULT '[]',
    status_mapping JSONB DEFAULT '{}',
    webhook_secret TEXT,
    last_ticket_sync_at TIMESTAMPTZ,
    total_tickets_created INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Finding ↔ Ticket linking table
CREATE TABLE finding_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    external_key VARCHAR(100) NOT NULL,     -- e.g. "SEC-123"
    external_id VARCHAR(255),               -- provider ID
    external_url VARCHAR(1000),             -- web URL
    external_status VARCHAR(100),           -- current status in ticketing system
    external_priority VARCHAR(50),
    external_assignee VARCHAR(255),
    sync_status VARCHAR(20) DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'error', 'stale')),
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_error TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, finding_id, integration_id)
);

-- 3. Indexes
CREATE INDEX idx_finding_tickets_tenant ON finding_tickets(tenant_id);
CREATE INDEX idx_finding_tickets_finding ON finding_tickets(finding_id);
CREATE INDEX idx_finding_tickets_integration ON finding_tickets(integration_id);
CREATE INDEX idx_finding_tickets_external_key ON finding_tickets(tenant_id, external_key);
CREATE INDEX idx_finding_tickets_sync_status ON finding_tickets(sync_status) WHERE sync_status != 'synced';
```

**Domain Entity Files:**

| File | Description |
|------|-------------|
| `pkg/domain/integration/ticketing_extension.go` | TicketingExtension entity + CreateInput/UpdateInput |
| `pkg/domain/integration/ticketing_client.go` | TicketingClient interface + Issue/Project types |
| `pkg/domain/integration/finding_ticket.go` | FindingTicket entity + CreateInput |

**Repository Interfaces (add to `pkg/domain/integration/repository.go`):**

```go
type TicketingExtensionRepository interface {
    Create(ctx context.Context, ext *TicketingExtension) error
    GetByIntegrationID(ctx context.Context, integrationID uuid.UUID) (*TicketingExtension, error)
    Update(ctx context.Context, ext *TicketingExtension) error
    Delete(ctx context.Context, integrationID uuid.UUID) error
}

type FindingTicketRepository interface {
    Create(ctx context.Context, ft *FindingTicket) error
    GetByFindingID(ctx context.Context, tenantID, findingID uuid.UUID) ([]*FindingTicket, error)
    GetByExternalKey(ctx context.Context, tenantID uuid.UUID, key string) (*FindingTicket, error)
    Update(ctx context.Context, ft *FindingTicket) error
    Delete(ctx context.Context, id uuid.UUID) error
    ListByIntegration(ctx context.Context, tenantID, integrationID uuid.UUID, filter FindingTicketFilter) (*ListResult[FindingTicket], error)
    ListStale(ctx context.Context, tenantID uuid.UUID, olderThan time.Duration) ([]*FindingTicket, error)
    CountByIntegration(ctx context.Context, tenantID, integrationID uuid.UUID) (int64, error)
}
```

**Estimated:** 6 files, ~800 LOC

---

### Phase 2: Jira Client Implementation

**Location:** `api/internal/infra/ticketing/jira.go`

Following the same pattern as `api/internal/infra/scm/github.go` and `api/internal/infra/notification/slack.go`.

**Jira REST API v3 Integration:**

```go
type JiraClient struct {
    httpClient  *http.Client
    baseURL     string     // e.g. "https://company.atlassian.net"
    authType    string     // "basic" (email:token), "oauth"
    credentials string
    logger      *logger.Logger
}

// Implements TicketingClient interface:
// - TestConnection: GET /rest/api/3/myself
// - CreateIssue: POST /rest/api/3/issue
// - UpdateIssue: PUT /rest/api/3/issue/{key}
// - GetIssue: GET /rest/api/3/issue/{key}
// - ListProjects: GET /rest/api/3/project
// - ListIssueTypes: GET /rest/api/3/issuetype
// - ListPriorities: GET /rest/api/3/priority
// - ListStatuses: GET /rest/api/3/status
```

**Key Design Decisions:**
- Use Jira REST API v3 (Cloud) — most commonly used
- Auth: Email + API Token (Basic Auth header) — simplest, most reliable
- Issue description: Convert finding markdown → Jira ADF (Atlassian Document Format)
- Auto-label issues with `openctem`, severity, asset-type for traceability
- Include finding URL in issue description for back-link

**Ticketing Client Factory:**

```go
// api/internal/infra/ticketing/factory.go
func NewTicketingClient(provider, baseURL, credentials, authType string, logger *logger.Logger) (TicketingClient, error) {
    switch provider {
    case "jira":
        return NewJiraClient(baseURL, credentials, authType, logger)
    case "servicenow":
        return NewServiceNowClient(baseURL, credentials, authType, logger)
    case "linear":
        return NewLinearClient(credentials, logger)
    default:
        return nil, fmt.Errorf("unsupported ticketing provider: %s", provider)
    }
}
```

**Estimated:** 3 files (jira.go, factory.go, types.go), ~600 LOC

---

### Phase 3: Service Layer & API Endpoints

**Service Updates (`api/internal/app/integration_service.go`):**

Add ticketing-specific methods:

```go
// Ticketing Integration CRUD
CreateTicketingIntegration(ctx, input CreateTicketingIntegrationInput) (*IntegrationWithTicketing, error)
GetIntegrationWithTicketing(ctx, id uuid.UUID) (*IntegrationWithTicketing, error)
UpdateTicketingExtension(ctx, integrationID uuid.UUID, input UpdateTicketingExtensionInput) error
TestTicketingConnection(ctx, integrationID uuid.UUID) (*TestResult, error)

// Ticketing Metadata (for UI dropdowns)
ListTicketingProjects(ctx, integrationID uuid.UUID) ([]Project, error)
ListTicketingIssueTypes(ctx, integrationID uuid.UUID, projectKey string) ([]IssueType, error)
ListTicketingPriorities(ctx, integrationID uuid.UUID) ([]Priority, error)
ListTicketingStatuses(ctx, integrationID uuid.UUID, projectKey string) ([]Status, error)

// Finding ↔ Ticket Operations
CreateFindingTicket(ctx, input CreateFindingTicketInput) (*FindingTicket, error)
GetFindingTickets(ctx, findingID uuid.UUID) ([]*FindingTicket, error)
SyncFindingTicketStatus(ctx, findingTicketID uuid.UUID) (*FindingTicket, error)
BulkCreateFindingTickets(ctx, findingIDs []uuid.UUID, integrationID uuid.UUID) (*BulkResult, error)
```

**New API Endpoints:**

```
POST   /api/v1/integrations/ticketing                    Create ticketing integration
GET    /api/v1/integrations/ticketing                    List ticketing integrations
PUT    /api/v1/integrations/{id}/ticketing               Update ticketing extension
POST   /api/v1/integrations/{id}/test-ticketing          Test ticketing connection

GET    /api/v1/integrations/{id}/ticketing/projects      List projects
GET    /api/v1/integrations/{id}/ticketing/issue-types   List issue types
GET    /api/v1/integrations/{id}/ticketing/priorities     List priorities
GET    /api/v1/integrations/{id}/ticketing/statuses       List statuses

POST   /api/v1/findings/{id}/tickets                     Create ticket for finding
GET    /api/v1/findings/{id}/tickets                     List tickets for finding
POST   /api/v1/findings/bulk-create-tickets              Bulk create tickets
POST   /api/v1/finding-tickets/{id}/sync                 Force sync ticket status

POST   /api/v1/webhooks/ticketing/{integration_id}       Incoming webhook (ticket status changes)
```

**Estimated:** 4 files (handler, routes, service updates, repository impl), ~1,200 LOC

---

### Phase 4: Workflow Action Implementation

**Update `workflow_action_handlers.go`:**

Replace skeleton `TicketActionHandler` with real implementation:

```go
type TicketActionHandler struct {
    integrationSvc *IntegrationService
    findingTicketRepo FindingTicketRepository
    logger *logger.Logger
}

func (h *TicketActionHandler) Execute(ctx context.Context, action workflow.ActionNode, input map[string]any) (map[string]any, error) {
    switch action.ActionType {
    case workflow.ActionTypeCreateTicket:
        // 1. Get integration by ID
        // 2. Create ticketing client via factory
        // 3. Map finding fields → issue fields (using priority mapping, field mappings)
        // 4. Call client.CreateIssue()
        // 5. Save FindingTicket record
        // 6. Return ticket key, URL

    case workflow.ActionTypeUpdateTicket:
        // 1. Get FindingTicket by ticket_id
        // 2. Create ticketing client
        // 3. Call client.UpdateIssue()
        // 4. Update FindingTicket record
    }
}
```

**Auto-Ticketing Rules (via existing Workflow engine):**

The workflow engine already supports conditions + actions. Auto-ticketing is simply a workflow rule:

```json
{
  "trigger": "finding_created",
  "conditions": [
    { "field": "severity", "operator": "in", "value": ["critical", "high"] },
    { "field": "asset.exposure", "operator": "eq", "value": "external" }
  ],
  "actions": [
    {
      "type": "create_ticket",
      "config": {
        "integration_id": "uuid-of-jira-integration",
        "project": "SEC",
        "issue_type": "Bug",
        "title": "{{finding.title}}",
        "description": "{{finding.description}}\n\nSeverity: {{finding.severity}}\nAsset: {{finding.asset_name}}\nURL: {{finding.url}}"
      }
    }
  ]
}
```

**Estimated:** 1 file update, ~300 LOC

---

### Phase 5: Bidirectional Sync

**Jira Webhook Receiver:**

```go
// api/internal/infra/http/handler/ticketing_webhook_handler.go
func (h *TicketingWebhookHandler) HandleJiraWebhook(w http.ResponseWriter, r *http.Request) {
    integrationID := chi.URLParam(r, "integration_id")

    // 1. Verify webhook signature (HMAC-SHA256)
    // 2. Parse Jira webhook event
    // 3. Find FindingTicket by external_key
    // 4. Update external_status, external_assignee
    // 5. If status maps to "resolved" → trigger finding remediation check
}
```

**Polling Fallback (for providers without webhooks):**

```go
// api/internal/app/ticketing_sync_job.go
func (j *TicketingSyncJob) Run(ctx context.Context) {
    // 1. Get all ticketing integrations with sync_direction = "bidirectional"
    // 2. For each: get stale FindingTickets (last_synced_at > sync_interval)
    // 3. Batch fetch ticket statuses from provider
    // 4. Update FindingTicket records
    // 5. Trigger finding status updates for resolved tickets
}
```

**Status Mapping (configurable per integration):**

```json
{
  "done": "remediated",
  "closed": "remediated",
  "won't fix": "accepted",
  "duplicate": "false_positive",
  "in progress": null,
  "to do": null
}
```

- `null` = no action (ticket is still being worked on)
- `"remediated"` = mark finding as remediated, trigger validation
- `"accepted"` = mark as risk accepted
- `"false_positive"` = mark as false positive

**Estimated:** 3 files, ~500 LOC

---

### Phase 6: Frontend — Connection & Configuration UI

**Files to update/create:**

| File | Action | Description |
|------|--------|-------------|
| `ui/src/features/integrations/types/integration.types.ts` | UPDATE | Add `TicketingExtension` type, set `available: true` |
| `ui/src/features/integrations/api/use-ticketing-api.ts` | CREATE | SWR hooks for ticketing endpoints |
| `ui/src/app/(dashboard)/settings/integrations/ticketing/page.tsx` | REWRITE | Real connection UI |
| `ui/src/features/integrations/components/add-ticketing-dialog.tsx` | CREATE | Add ticketing integration dialog |
| `ui/src/features/integrations/components/edit-ticketing-dialog.tsx` | CREATE | Edit ticketing config (project, mapping, sync) |
| `ui/src/features/integrations/components/ticketing-field-mapping.tsx` | CREATE | Field mapping config UI |

**Add Ticketing Dialog Flow:**

```
Step 1: Select Provider (Jira / ServiceNow / Linear)
Step 2: Enter Credentials
  - Jira: Base URL + Email + API Token
  - ServiceNow: Instance URL + Username + Password
  - Linear: API Key
Step 3: Test Connection → shows org/workspace info
Step 4: Select Default Project + Issue Type
Step 5: Configure Priority Mapping (severity → priority)
Step 6: Configure Sync Direction (one-way / bidirectional)
Step 7: Done → Integration created + connected
```

**Estimated:** 6 files, ~1,500 LOC

---

### Phase 7: Frontend — Finding ↔ Ticket UI

**Files to update/create:**

| File | Action | Description |
|------|--------|-------------|
| `ui/src/features/findings/components/finding-ticket-panel.tsx` | CREATE | Ticket panel in finding detail |
| `ui/src/features/findings/api/use-finding-tickets-api.ts` | CREATE | SWR hooks for finding tickets |
| `ui/src/features/findings/components/create-ticket-dialog.tsx` | CREATE | Create ticket from finding |
| `ui/src/features/findings/components/bulk-create-tickets-dialog.tsx` | CREATE | Bulk create tickets from findings list |
| `ui/src/app/(dashboard)/(mobilization)/collaboration/tickets/page.tsx` | REWRITE | Real ticket dashboard |

**Finding Detail Sheet — Ticket Panel:**

```
┌─────────────────────────────────────────────┐
│ Linked Tickets                              │
│                                             │
│ ┌─ SEC-123 ────────────────────────────┐    │
│ │ [Jira] In Progress  → [Open in Jira] │    │
│ │ Priority: High                        │    │
│ │ Assignee: john.doe                    │    │
│ │ Synced: 5 minutes ago                 │    │
│ └──────────────────────────────────────┘    │
│                                             │
│ [+ Create Ticket]  [↻ Sync Status]          │
└─────────────────────────────────────────────┘
```

**Findings Table — Bulk Actions:**

```
✓ 12 selected → [Create Tickets] → Dialog:
  - Select Integration (Jira - SEC project)
  - Issue Type: Bug
  - Priority: Auto (from severity mapping)
  - [Create 12 Tickets]
```

**Estimated:** 5 files, ~1,200 LOC

---

### Phase 8: ServiceNow Provider

**Location:** `api/internal/infra/ticketing/servicenow.go`

ServiceNow uses Table API for CRUD operations:

```go
type ServiceNowClient struct {
    httpClient  *http.Client
    instanceURL string     // e.g. "https://company.service-now.com"
    credentials string     // username:password (Basic Auth)
    logger      *logger.Logger
}

// ServiceNow-specific features:
// - Incident table (incident)
// - Change Request table (change_request)
// - Problem table (problem)
// - Custom tables via Table API

// API Endpoints:
// - POST /api/now/table/incident — Create incident
// - PATCH /api/now/table/incident/{sys_id} — Update
// - GET /api/now/table/incident/{sys_id} — Get
// - GET /api/now/table/sys_choice?name=incident&element=state — List states
```

**Provider Definition (add to entity.go):**

```go
ProviderServiceNow Provider = "servicenow"
```

**Estimated:** 1 file, ~400 LOC

---

## Implementation Order & Dependencies

```
Phase 1 (DB + Domain)
    ↓
Phase 2 (Jira Client)  ──→  Phase 8 (ServiceNow Client)
    ↓
Phase 3 (Service + API)
    ↓
Phase 4 (Workflow Actions)
    ↓
Phase 5 (Bidirectional Sync)
    ↓
Phase 6 (Frontend — Config UI)
    ↓
Phase 7 (Frontend — Finding↔Ticket UI)
```

Phases 2 and 8 can run in parallel. Phases 6 and 7 depend on Phase 3 (API endpoints).

---

## Effort Estimation

| Phase | Description | LOC | Complexity |
|-------|-------------|-----|------------|
| 1 | DB + Domain Layer | ~800 | Low |
| 2 | Jira Client | ~600 | Medium |
| 3 | Service + API Endpoints | ~1,200 | Medium |
| 4 | Workflow Actions | ~300 | Low |
| 5 | Bidirectional Sync | ~500 | High |
| 6 | Frontend — Config UI | ~1,500 | Medium |
| 7 | Frontend — Ticket UI | ~1,200 | Medium |
| 8 | ServiceNow Provider | ~400 | Medium |
| **Total** | | **~6,500** | |

---

## Testing Strategy

### Unit Tests (per phase)

| Phase | Test File | Key Test Cases |
|-------|-----------|----------------|
| 1 | `finding_ticket_repository_test.go` | CRUD, tenant isolation, unique constraint |
| 2 | `jira_client_test.go` | Create/update/get issue, auth, error handling |
| 3 | `integration_service_ticketing_test.go` | Create integration, test connection, CRUD tickets |
| 4 | `ticket_action_handler_test.go` | Workflow action execution, field mapping |
| 5 | `ticketing_sync_job_test.go` | Status mapping, stale detection, bulk sync |
| 6 | `use-ticketing-api.test.ts` | Hook behavior, cache invalidation |
| 7 | `finding-ticket-panel.test.tsx` | Render, create, sync UI interactions |
| 8 | `servicenow_client_test.go` | Table API interactions |

### Integration Tests

- End-to-end: Create Jira integration → Create ticket from finding → Verify FindingTicket record → Simulate webhook → Verify finding status update
- Mock Jira API server for CI/CD

---

## Security Considerations

1. **Credentials**: All ticketing credentials encrypted with AES-256-GCM (existing pattern)
2. **Webhook Verification**: HMAC-SHA256 signature validation for incoming webhooks
3. **Tenant Isolation**: All `finding_tickets` queries include `tenant_id` WHERE clause
4. **Rate Limiting**: Ticket creation rate limited per tenant (prevent abuse)
5. **URL Validation**: `external_url` validated against known provider domains
6. **Input Sanitization**: Finding data sanitized before sending to external APIs (prevent injection)
7. **Permissions**: New permissions `integrations:ticketing:read`, `integrations:ticketing:manage`

---

## Permissions

Add to existing permission system:

```go
// Already exists:
IntegrationsRead    = "integrations:read"
IntegrationsManage  = "integrations:manage"

// Specific to ticketing actions on findings:
FindingsTicketCreate = "findings:tickets:create"
FindingsTicketRead   = "findings:tickets:read"
```

- Owner/Admin: Full access
- Member: Can create tickets for findings they can access
- Viewer: Can view linked tickets (read-only)

---

## Rollout Strategy

1. **Feature Flag**: `ITSM_INTEGRATION_ENABLED` environment variable (default: false)
2. **Gradual Rollout**:
   - Phase 1-4: Backend only, no UI changes visible
   - Phase 6: Enable "Connect Jira" button, remove placeholder data
   - Phase 7: Enable "Create Ticket" in finding detail
3. **Monitoring**: Track ticket creation rate, sync failures, webhook processing time
4. **Fallback**: If ticketing provider is down, queue ticket creation requests (use notification outbox pattern)

---

## Open Questions

1. **Linear API**: Linear uses GraphQL — do we want to implement a GraphQL client or use their REST-compatible endpoints?
2. **Asana**: Lower priority — should we defer to Phase 9 or drop entirely?
3. **Custom Fields**: How complex should custom field mapping be? Simple key-value or support nested/array fields?
4. **Ticket Templates**: Should we support Jira issue templates or always build from finding data?
5. **Multi-integration**: Can a finding have tickets in multiple systems? (Current design supports this via `UNIQUE(tenant_id, finding_id, integration_id)`)

---

## Related Documents

- [CTEM Framework Enhancement RFC](./2026-01-27-ctem-framework-enhancement.md)
- [Asset Page Template](../../features/asset-page-template.md)
- [Notification System](../../features/notifications.md) — pattern reference for extension tables
- Integration Entity: `api/pkg/domain/integration/entity.go`
- Workflow Actions: `api/internal/app/workflow_action_handlers.go:472-565`
