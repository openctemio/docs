---
layout: default
title: "RFC-005: Source-Based Workflow Triggers"
parent: Decisions
nav_order: 5
---

# RFC-005: Source-Based Workflow Triggers

**Status:** Implemented
**Date:** 2025-01-30
**Authors:** Engineering Team

---

## Summary

Add `source_filter` to workflow trigger configuration, allowing workflows to trigger based on finding source (SAST, DAST, Pentest, etc.).

---

## Motivation

### Current State

Workflow triggers support filtering by:
- `severity_filter` - Filter by severity level
- `tool_filter` - Filter by tool name
- `status_filter` - Filter by finding status

### Problem

Cannot trigger workflows based on **how a finding was discovered**:
- Pentest findings → Immediate Slack notification
- Bug bounty findings → Auto-create Jira ticket
- SAST findings → Low priority, batch review

### Proposed Solution

Add `source_filter` to `finding_created` and `finding_updated` triggers.

---

## Design

### Trigger Configuration

```json
{
  "trigger_type": "finding_created",
  "trigger_config": {
    "severity_filter": ["critical", "high"],
    "source_filter": ["pentest", "bug_bounty"]
  }
}
```

### Filter Logic

```
Finding Created Event
    ↓
For Each Workflow with finding_created trigger:
    ├─ Check severity_filter → finding.severity in list?
    ├─ Check tool_filter → finding.tool_name in list?
    ├─ Check source_filter → finding.source in list? (NEW)
    └─ If ALL filters match → Execute workflow
```

---

## Implementation

### Backend Changes

**1. Domain Constants** (`workflow/node.go`)
```go
const FilterKeySourceFilter = "source_filter"
```

**2. Trigger Evaluation** (`workflow_executor.go`)
```go
func (e *WorkflowExecutor) matchesSource(event map[string]any, allowedSources []interface{}) bool {
    source, ok := event["source"].(string)
    if !ok {
        return len(allowedSources) == 0 // No filter = all sources
    }

    for _, allowed := range allowedSources {
        if allowedStr, ok := allowed.(string); ok && allowedStr == source {
            return true
        }
    }
    return false
}
```

**3. Config Validation** (`workflow_config_validator.go`)
```go
func validateSourceFilter(config map[string]any, cacheService *FindingSourceCacheService) error {
    if sourceFilter, ok := config["source_filter"]; ok {
        sources, ok := sourceFilter.([]interface{})
        if !ok {
            return fmt.Errorf("source_filter must be an array")
        }
        for _, src := range sources {
            srcStr, ok := src.(string)
            if !ok {
                return fmt.Errorf("source_filter values must be strings")
            }
            // Validate against FindingSource cache
            valid, err := cacheService.IsValidCode(ctx, srcStr)
            if err != nil || !valid {
                return fmt.Errorf("invalid source: %s", srcStr)
            }
        }
    }
    return nil
}
```

### Frontend Changes

**1. Types** (`workflow-types.ts`)
```typescript
interface FindingCreatedTriggerConfig {
  severity_filter?: SeverityLevel[]
  tool_filter?: string[]
  source_filter?: string[]  // NEW
}
```

**2. Trigger Form** (workflow builder)
```tsx
<FormField name="source_filter" label="Filter by Source">
  <FindingSourceMultiSelect
    value={config.source_filter}
    onChange={(sources) => setConfig({ ...config, source_filter: sources })}
  />
</FormField>
```

---

## Use Cases

### 1. Pentest Critical Findings → Immediate Alert
```json
{
  "trigger_type": "finding_created",
  "trigger_config": {
    "severity_filter": ["critical"],
    "source_filter": ["pentest", "red_team"]
  },
  "actions": [
    { "type": "slack_notification", "channel": "#security-urgent" }
  ]
}
```

### 2. Bug Bounty Submissions → Create Jira Ticket
```json
{
  "trigger_type": "finding_created",
  "trigger_config": {
    "source_filter": ["bug_bounty"]
  },
  "actions": [
    { "type": "jira_create", "project": "VULN" }
  ]
}
```

### 3. Automated Scan Findings → Daily Digest
```json
{
  "trigger_type": "finding_created",
  "trigger_config": {
    "source_filter": ["sast", "sca", "dast"]
  },
  "actions": [
    { "type": "batch_digest", "frequency": "daily" }
  ]
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `api/internal/domain/workflow/node.go` | Add constant |
| `api/internal/app/workflow_executor.go` | Add source matching |
| `api/internal/app/workflow_config_validator.go` | Validate source codes |
| `ui/src/lib/api/workflow-types.ts` | Add TypeScript types |
| `ui/src/features/workflows/components/trigger-config-form.tsx` | Add source filter UI |
| `docs/features/workflows.md` | Update documentation |

---

## Timeline

| Phase | Scope | Estimate |
|-------|-------|----------|
| Backend | Add filter matching | 0.5 day |
| Validation | Source code validation | 0.5 day |
| Frontend | UI for source filter | 0.5 day |
| Testing | E2E workflow tests | 0.5 day |
| **Total** | | **2 days** |

---

## Implementation Notes (2026-01-30)

### Performance Optimizations Applied

The initial implementation had critical performance issues that were identified and fixed:

#### 1. N+1 Query Problem (FIXED)

**Before:** For each active workflow, called `GetWithGraph` individually.
```
50 active workflows × 1000 findings = 51,000 queries!
```

**After:** Added `ListActiveWithTriggerType` method that:
- Uses single query with JOIN to find workflows by trigger type
- Batch loads all nodes/edges for matching workflows in 2 additional queries
- Total: 3 queries regardless of workflow count

**Files changed:**
- `api/internal/domain/workflow/repository.go` - Added interface method
- `api/internal/infra/postgres/workflow_repository.go` - Optimized implementation

#### 2. Per-Finding Dispatch (FIXED)

**Before:** Dispatched each finding individually in the goroutine.

**After:**
- Find matching workflows ONCE for all findings
- Deduplicate workflow triggers - each workflow triggered once per batch
- Added batch context to trigger data (`batch_size`, `batch_index`)

#### 3. Goroutine Safety (FIXED)

**Before:** No panic recovery in async goroutine.

**After:**
- Added `recover()` to prevent service crash
- Added configurable limits:
  - `maxFindingsPerDispatch = 500`
  - `dispatchTimeout = 60s`

### Security Considerations

| Risk | Mitigation |
|------|------------|
| DoS via mass ingestion | Limited to 500 findings per dispatch |
| Goroutine panic | Added recover() with error logging |
| Context detachment | Uses background context with explicit timeout |

---

## Related

- [ADR-001: Finding Sources vs Tool Capabilities](001-finding-sources-vs-capabilities.md)
- [Finding Sources Feature](../features/finding-sources.md)
- [Workflows Feature](../features/workflows.md)
