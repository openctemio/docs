---
layout: default
title: "RFC-002: Rename Capabilities to Tool Capabilities"
parent: Decisions
nav_order: 2
---

# RFC-002: Rename Capabilities to Tool Capabilities

**Status:** Proposed (Deferred)
**Date:** 2025-01-30
**Authors:** Engineering Team

---

## Summary

Proposal to rename "Capabilities" to "Tool Capabilities" throughout the codebase to reduce confusion with "Finding Sources".

---

## Motivation

### Current Confusion

The term "Capabilities" is generic and can be confused with:
- Finding Sources (where findings come from)
- User Capabilities/Permissions
- System Capabilities

Adding "Tool" prefix makes the purpose explicit: these describe what **tools** can do.

### Current State

| Component | Current Name | Proposed Name |
|-----------|--------------|---------------|
| Table | `capabilities` | `tool_capabilities_registry` |
| Junction | `tool_capabilities` | `tool_capability_assignments` |
| Entity | `Capability` | `ToolCapability` |
| API | `/api/v1/capabilities` | `/api/v1/tool-capabilities` |
| Frontend | `useCapabilities()` | `useToolCapabilities()` |

---

## Proposal

### Phase 1: Documentation (Completed)
- [x] Add callout boxes to distinguish from Finding Sources
- [x] Create ADR explaining the distinction
- [x] Update feature documentation titles

### Phase 2: Additive API Changes (Future)
1. Add new endpoints with `tool-` prefix
2. Keep old endpoints working (deprecated)
3. Update frontend to use new endpoints
4. Log deprecation warnings on old endpoint usage

```go
// New routes (add alongside existing)
r.Route("/tool-capabilities", toolCapabilityHandler.Routes)

// Existing routes (add deprecation header)
r.Route("/capabilities", func(r chi.Router) {
    r.Use(deprecatedMiddleware("Use /api/v1/tool-capabilities instead"))
    capabilityHandler.Routes(r)
})
```

### Phase 3: Database Migration (Future)
```sql
-- Rename tables
ALTER TABLE capabilities RENAME TO tool_capabilities_registry;
ALTER TABLE tool_capabilities RENAME TO tool_capability_assignments;

-- Update views/functions that reference old names
```

### Phase 4: Code Refactor (Future)
```go
// Before
type Capability struct { ... }
type CapabilityRepository interface { ... }

// After
type ToolCapability struct { ... }
type ToolCapabilityRepository interface { ... }
```

### Phase 5: Deprecation Removal (Future Major Version)
- Remove old API endpoints
- Remove compatibility aliases
- Update all client integrations

---

## Decision

**DEFER to future major version**

Reasons:
1. Breaking API change affecting integrations
2. Significant refactoring effort
3. Current documentation clarifies the distinction adequately
4. No user confusion reported in production

### Immediate Actions (Completed)
- [x] Update documentation titles to include "(Tool Capabilities)"
- [x] Add callout boxes linking to ADR-001
- [x] Create this RFC for future reference

### Future Triggers
Implement this rename when:
- Planning next major API version (v2)
- Receiving user confusion reports
- Adding new capability-like features

---

## Alternatives Considered

### 1. Rename Finding Sources Instead
- **Rejected:** Finding Sources is already specific enough
- "Source" clearly relates to finding origin

### 2. Keep Both Names Generic
- **Rejected:** Causes ongoing confusion
- Documentation helps but naming is better

### 3. Merge the Two Systems
- **Rejected:** They serve different purposes
- See [ADR-001](001-finding-sources-vs-capabilities.md)

---

## Impact Analysis

### Breaking Changes (if implemented)
- API endpoint URLs change
- Frontend hook names change
- Database table names change
- Import paths change

### Migration Path
1. Dual endpoints during transition (6 months)
2. Deprecation warnings in logs
3. Client SDK updates with compatibility layer
4. Documentation migration guide

---

## Related

- [ADR-001: Finding Sources vs Tool Capabilities](001-finding-sources-vs-capabilities.md)
- [Capabilities Registry Feature](../features/capabilities-registry.md)
- [Finding Sources Feature](../features/finding-sources.md)
