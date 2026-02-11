---
layout: default
title: Capabilities Registry
parent: Features
nav_order: 4
---

# Capabilities Registry (Tool Capabilities)

The Capabilities Registry provides a normalized system for managing **tool capabilities** across the OpenCTEM platform. Capabilities define what security tools can do (e.g., SAST, SCA, DAST, secrets detection).

{: .important }
> **Not to be confused with [Finding Sources](finding-sources.md)**
>
> - **Capabilities** = What a **tool** can do (M:N with tools)
> - **Finding Sources** = Where a **finding** came from (1:1 with findings)
>
> See [ADR-001: Finding Sources vs Tool Capabilities](../decisions/001-finding-sources-vs-capabilities.md) for details.

---

## Overview

### Purpose

1. **Centralized capability management** - Single source of truth for tool capabilities
2. **Rich metadata** - Icons, colors, descriptions for UI display
3. **Multi-tenant support** - Platform capabilities + tenant custom capabilities
4. **Normalized relationships** - M:N relationship between tools and capabilities

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    capabilities table                        │
│  ┌─────────┬──────────────────┬──────────┬────────────────┐ │
│  │ id      │ name             │ category │ is_builtin     │ │
│  │ UUID    │ "sast"           │ security │ true           │ │
│  │ UUID    │ "custom-scanner" │ analysis │ false (tenant) │ │
│  └─────────┴──────────────────┴──────────┴────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ M:N
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 tool_capabilities junction                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ tool_id (FK) │ capability_id (FK) │ created_at        │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ M:1
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       tools table                            │
│  ┌─────────┬───────────────┬─────────────────────────────┐  │
│  │ id      │ name          │ capabilities (TEXT[], sync) │  │
│  │ UUID    │ "semgrep"     │ {"sast", "secrets"}         │  │
│  └─────────┴───────────────┴─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Capability Entity

```typescript
interface Capability {
  id: string;                    // UUID
  tenant_id?: string;            // null for platform, UUID for custom
  name: string;                  // Unique identifier: 'sast', 'dast'
  display_name: string;          // Human readable: 'Static Analysis'
  description?: string;          // Detailed description
  icon: string;                  // Lucide icon name
  color: string;                 // Badge color
  category?: string;             // 'security', 'recon', 'analysis'
  is_builtin: boolean;           // true for platform capabilities
  sort_order: number;            // Display ordering
  created_by?: string;           // User ID (for custom)
  created_at: string;
  updated_at: string;
}
```

### Platform Capabilities (Seeded)

| Name | Display Name | Category | Icon | Color |
|------|--------------|----------|------|-------|
| `sast` | Static Analysis | security | code | purple |
| `sca` | Composition Analysis | security | package | blue |
| `dast` | Dynamic Testing | security | zap | orange |
| `secrets` | Secret Detection | security | key | red |
| `iac` | IaC Security | security | server | green |
| `container` | Container Security | security | box | cyan |
| `web` | Web Scanning | security | globe | orange |
| `xss` | XSS Detection | security | alert-triangle | amber |
| `api` | API Security | security | plug | blue |
| `cloud` | Cloud Security | security | cloud | sky |
| `mobile` | Mobile Security | security | smartphone | purple |
| `compliance` | Compliance | security | shield-check | emerald |
| `recon` | Reconnaissance | recon | search | yellow |
| `subdomain` | Subdomain Enumeration | recon | layers | lime |
| `http` | HTTP Probing | recon | wifi | teal |
| `portscan` | Port Scanning | recon | radio | indigo |
| `crawler` | Web Crawling | recon | spider | fuchsia |
| `sbom` | SBOM Generation | analysis | file-text | slate |
| `terraform` | Terraform Security | security | cloud | violet |
| `docker` | Docker Security | security | container | sky |
| `reporting` | Reporting | analysis | file-chart-line | slate |
| `ai-triage` | AI Triage | analysis | brain | violet |

---

## API Reference

### Read Endpoints

**Base:** `/api/v1/capabilities`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List capabilities with pagination |
| GET | `/all` | List all capabilities (for dropdowns) |
| GET | `/categories` | List unique categories |
| GET | `/by-category/{category}` | List by category |
| GET | `/{id}` | Get single capability |

### Custom Capability Endpoints

**Base:** `/api/v1/custom-capabilities`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create custom capability |
| PUT | `/{id}` | Update custom capability |
| DELETE | `/{id}` | Delete custom capability |

### Usage Stats Endpoints

**Base:** `/api/v1/capabilities`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/{id}/usage-stats` | Get usage stats for a single capability |
| POST | `/usage-stats/batch` | Get usage stats for multiple capabilities |

**Single Capability Usage Stats:**
```json
GET /api/v1/capabilities/{id}/usage-stats

{
  "tool_count": 5,
  "tool_names": ["semgrep", "trivy", "gitleaks", "checkov", "zap"],
  "agent_count": 3,
  "agent_names": ["security-scanner", "vulnerability-checker", "code-analyzer"]
}
```

**Batch Usage Stats (Counts Only):**
```json
POST /api/v1/capabilities/usage-stats/batch
{
  "capability_ids": ["uuid-1", "uuid-2", "uuid-3"]
}

{
  "stats": {
    "uuid-1": { "tool_count": 5, "agent_count": 3 },
    "uuid-2": { "tool_count": 2, "agent_count": 1 },
    "uuid-3": { "tool_count": 0, "agent_count": 0 }
  }
}
```

The batch endpoint returns **counts only** (no names) for performance. Use the single capability endpoint to fetch full details including tool/agent names.

### Example Responses

**List All Capabilities:**
```json
GET /api/v1/capabilities/all

{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "sast",
      "display_name": "Static Analysis",
      "description": "Source code vulnerability detection",
      "icon": "code",
      "color": "purple",
      "category": "security",
      "is_builtin": true,
      "sort_order": 1
    },
    ...
  ]
}
```

**Create Custom Capability:**
```json
POST /api/v1/custom-capabilities
{
  "name": "custom-ml-scanner",
  "display_name": "ML Security Scanner",
  "description": "Machine learning model security analysis",
  "icon": "brain",
  "color": "pink",
  "category": "analysis"
}
```

---

## Frontend Integration

### React Hooks

```typescript
import {
  useCapabilities,
  useAllCapabilities,
  useCapabilityCategories,
  useCapabilitiesByCategory,
  useCapability,
  useCreateCapability,
  useUpdateCapability,
  useDeleteCapability,
  findCapabilityById,
  getCapabilityNameById,
  getCapabilityDisplayNameById,
  // Agent-based capabilities (what a tenant can actually use)
  useAvailableCapabilities,
  // Usage stats hooks
  useCapabilityUsageStats,
  useCapabilityUsageStatsBatch,
} from '@/lib/api'
```

### Usage Stats Hooks

The usage stats hooks enable efficient display of capability usage information:

```tsx
import { useCapabilityUsageStats, useCapabilityUsageStatsBatch } from '@/lib/api'

// Single capability - fetches full details (counts + names)
function CapabilityDetail({ capabilityId }: { capabilityId: string }) {
  const { data, isLoading } = useCapabilityUsageStats(capabilityId)

  if (isLoading) return <Skeleton />

  return (
    <div>
      <p>Used by {data?.tool_count} tools: {data?.tool_names?.join(', ')}</p>
      <p>Assigned to {data?.agent_count} agents: {data?.agent_names?.join(', ')}</p>
    </div>
  )
}

// Multiple capabilities - fetches counts only (optimized for lists)
function CapabilityList({ capabilityIds }: { capabilityIds: string[] }) {
  const { data } = useCapabilityUsageStatsBatch(capabilityIds)

  return capabilityIds.map(id => (
    <div key={id}>
      Tools: {data?.stats?.[id]?.tool_count ?? 0}
      Agents: {data?.stats?.[id]?.agent_count ?? 0}
    </div>
  ))
}
```

**Progressive Loading Pattern:**

For optimal UX, use batch stats for instant counts display, then fetch full details on demand:

```tsx
function CapabilityDetailPanel({
  capability,
  initialStats, // From batch API
}: {
  capability: Capability
  initialStats?: { tool_count: number; agent_count: number }
}) {
  // Fetch full details only when panel opens
  const { data: fullStats, isLoading } = useCapabilityUsageStats(capability.id)

  // Use fetched data, fall back to initial stats for instant display
  const stats = fullStats || initialStats

  return (
    <div>
      <p>Tools: {stats?.tool_count}</p>
      {isLoading ? (
        <Skeleton />
      ) : (
        <ul>{fullStats?.tool_names?.map(name => <li key={name}>{name}</li>)}</ul>
      )}
    </div>
  )
}
```

### Tenant Available Capabilities

The `useAvailableCapabilities` hook returns capabilities that a tenant can actually use, based on their available agents:

```tsx
import { useAvailableCapabilities, useCapabilityMetadata } from '@/lib/api'

function TenantCapabilitiesOverview() {
  // Get all capabilities this tenant can use
  const { data, isLoading } = useAvailableCapabilities()
  const { getDisplayName, getIcon, getColor } = useCapabilityMetadata()

  if (isLoading) return <Skeleton />

  return (
    <div>
      <h3>Your Available Capabilities</h3>
      <p>Based on your connected agents, you can use:</p>
      <div className="flex flex-wrap gap-2">
        {data?.capabilities.map(capName => (
          <Badge key={capName} className={`bg-${getColor(capName)}-500/10`}>
            <Icon name={getIcon(capName)} className="mr-1 h-3 w-3" />
            {getDisplayName(capName)}
          </Badge>
        ))}
      </div>
    </div>
  )
}
```

**How it works:**
- Aggregates capabilities from all online agents accessible to the tenant
- Includes platform agents (default) + tenant's own agents
- Returns unique capability names (no duplicates)
- Only considers agents with `status=active` and `health=online`

**Example:**
- Platform agents provide capabilities: `sast`, `sca`, `secrets`
- Tenant adds custom agent with capability: `custom-scanner`
- `useAvailableCapabilities()` returns: `['custom-scanner', 'sast', 'sca', 'secrets']`

**Options:**
```typescript
// Include only tenant's own agents (exclude platform agents)
const { data } = useAvailableCapabilities(false)

// Include platform agents (default behavior)
const { data } = useAvailableCapabilities(true)
```

**API Endpoint:**

```
GET /api/v1/agents/available-capabilities?include_platform=true
```

### Usage Example

{% raw %}
```tsx
function ToolCapabilitiesDisplay({ toolId }: { toolId: string }) {
  const { data: capabilities } = useAllCapabilities()
  const { data: tool } = useTool(toolId)

  // Get capability objects for this tool's capability names
  const toolCapabilities = useMemo(() => {
    if (!capabilities?.items || !tool?.capabilities) return []
    return capabilities.items.filter(c =>
      tool.capabilities.includes(c.name)
    )
  }, [capabilities, tool])

  return (
    <div className="flex gap-2">
      {toolCapabilities.map(cap => (
        <Badge
          key={cap.id}
          style={{ backgroundColor: `var(--${cap.color})` }}
        >
          <Icon name={cap.icon} className="mr-1 h-3 w-3" />
          {cap.display_name}
        </Badge>
      ))}
    </div>
  )
}
```
{% endraw %}

### Capability Metadata Hook

The `useCapabilityMetadata` hook provides a convenient way to look up capability metadata:

```tsx
import { useCapabilityMetadata } from '@/lib/api'

function CapabilityBadge({ capabilityName }: { capabilityName: string }) {
  const { getIcon, getColor, getDisplayName, isLoading } = useCapabilityMetadata()

  if (isLoading) return <Skeleton />

  return (
    <Badge className={`bg-${getColor(capabilityName)}-500/10`}>
      <Icon name={getIcon(capabilityName)} className="mr-1 h-3 w-3" />
      {getDisplayName(capabilityName)}
    </Badge>
  )
}
```

**Hook Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `getIcon(name)` | `string` | Returns Lucide icon name for capability |
| `getColor(name)` | `string` | Returns color name for capability |
| `getDisplayName(name)` | `string` | Returns human-readable display name |
| `getDescription(name)` | `string \| undefined` | Returns description if available |
| `findByName(name)` | `Capability \| undefined` | Returns full capability object |
| `capabilities` | `Capability[]` | All capabilities from API |
| `isLoading` | `boolean` | Loading state |
| `error` | `Error \| undefined` | Error state |

### Validation Helpers

Validate capability names against the registry before form submission:

```tsx
import {
  validateCapabilityNames,
  filterValidCapabilityNames,
  isValidCapabilityName,
} from '@/lib/api'

function MyForm() {
  const { data } = useAllCapabilities()
  const capabilities = data?.items

  // Validate array of capability names
  const result = validateCapabilityNames(capabilities, ['sast', 'invalid-cap'])
  if (!result.valid) {
    console.error('Invalid capabilities:', result.invalidNames)
  }

  // Filter to only valid names
  const validNames = filterValidCapabilityNames(capabilities, userInput)

  // Check single capability
  if (!isValidCapabilityName(capabilities, 'custom-scan')) {
    showError('Invalid capability name')
  }
}
```

### Cache Management

```typescript
import { invalidateCapabilitiesCache, capabilityKeys } from '@/lib/api'

// Invalidate all capability caches
await invalidateCapabilitiesCache()

// Cache keys for manual SWR operations
const listKey = capabilityKeys.list({ category: 'security' })
const allKey = capabilityKeys.allCapabilities()
const detailKey = capabilityKeys.detail('cap-id')
```

---

## Categories vs Capabilities

These are **NOT** duplicates - they serve different architectural purposes:

| Aspect | Categories | Capabilities |
|--------|------------|--------------|
| **Table** | `tool_categories` | `capabilities` |
| **Relationship** | 1:N (tool has one category) | M:N (tool has many capabilities) |
| **Purpose** | UI organization/grouping | Technical abilities |
| **FK** | `tools.category_id` | `tool_capabilities` junction |
| **Examples** | "SAST Tools", "Recon Tools" | "sast", "secrets", "http" |

The 7 shared names (sast, sca, dast, secrets, iac, container, recon) are **intentional semantic aliases** at different abstraction levels.

---

## Database Migrations

### Migration 000095: Create Tables

```sql
-- Capabilities table
CREATE TABLE capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'zap',
    color VARCHAR(20) DEFAULT 'gray',
    category VARCHAR(50),
    is_builtin BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE NULLS NOT DISTINCT (tenant_id, name)
);

-- Junction table
CREATE TABLE tool_capabilities (
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    capability_id UUID NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tool_id, capability_id)
);
```

### Migration 000096: Sync Legacy Column

```sql
-- Sync tools.capabilities TEXT[] from junction table
UPDATE tools t
SET capabilities = COALESCE(
    (SELECT ARRAY(
        SELECT c.name
        FROM tool_capabilities tc
        INNER JOIN capabilities c ON tc.capability_id = c.id
        WHERE tc.tool_id = t.id
        ORDER BY c.sort_order ASC, c.name ASC
    )),
    t.capabilities,
    '{}'::TEXT[]
);
```

---

## Key Files

### Backend

| File | Description |
|------|-------------|
| `api/migrations/000095_capabilities.up.sql` | Creates tables, seeds data |
| `api/migrations/000096_sync_tools_capabilities.up.sql` | Syncs legacy column |
| `api/internal/domain/capability/entity.go` | Domain entity |
| `api/internal/domain/capability/repository.go` | Repository interface |
| `api/internal/infra/postgres/capability_repository.go` | PostgreSQL implementation |
| `api/internal/app/capability_service.go` | Business logic |
| `api/internal/infra/http/handler/capability_handler.go` | HTTP handlers |
| `api/internal/infra/http/routes/scanning.go` | Route registration |

### Frontend

| File | Description |
|------|-------------|
| `ui/src/lib/api/capability-types.ts` | TypeScript interfaces |
| `ui/src/lib/api/capability-hooks.ts` | SWR hooks (including usage stats) |
| `ui/src/lib/api/endpoints.ts` | API endpoint definitions |
| `ui/src/lib/api/index.ts` | Public exports |
| `ui/src/features/capabilities/` | Capabilities management UI components |

---

## Security Controls

The capabilities registry implements multiple security layers:

### Input Validation

| Control | Description |
|---------|-------------|
| **Unicode Homograph Prevention** | Names must contain only ASCII characters to prevent attacks using visually similar Unicode characters |
| **Reserved Names** | System reserved names (admin, system, platform, root, etc.) cannot be used for custom capabilities |
| **Name Format** | Names must be lowercase alphanumeric with hyphens only (`^[a-z][a-z0-9-]*[a-z0-9]$`) |
| **XSS Sanitization** | Display names and descriptions are HTML-escaped to prevent XSS |
| **Icon/Color Validation** | Only alphanumeric characters allowed for icon and color names |

### Rate Limiting

| Limit | Value | Purpose |
|-------|-------|---------|
| Max custom capabilities per tenant | 50 | Prevents DoS through capability enumeration/creation |

### Tenant Isolation

| Operation | Control |
|-----------|---------|
| Create/Update/Delete capability | Validates tenant ownership |
| SetToolCapabilities | Validates tool belongs to tenant and all capabilities are accessible |
| AddCapabilityToTool | Validates tool ownership before adding |
| List operations | Only returns platform + tenant's own custom capabilities |

### Audit Logging

All capability CRUD operations are logged with:
- Actor information (user ID, email, IP, user agent)
- Resource details (capability ID, name)
- Change tracking (old vs new values for updates)
- Severity levels (Medium for deletions)

### Error Message Security

Error messages use generic language to prevent information disclosure:
- "capability name is not available" instead of revealing if name exists in platform vs tenant scope
- "cannot modify this capability" instead of revealing ownership details

---

## Future Phases

The capabilities registry is Phase 1+2 of the larger tools normalization effort:

- **Phase 3:** Use `tool_id` instead of `tool_name` in findings table
- **Phase 4:** Create `agent_tools` junction table, deprecate `tools TEXT[]`

See [Tools & Capabilities Normalization Plan](/docs/plans/tools-capabilities-normalization.md) for full roadmap.
