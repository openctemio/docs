---
layout: default
title: "ADR-001: Finding Sources vs Tool Capabilities"
parent: Decisions
nav_order: 1
---

# ADR-001: Finding Sources vs Tool Capabilities

**Status:** Accepted
**Date:** 2025-01-30
**Authors:** Engineering Team

---

## Context

The OpenCTEM platform has two similar-sounding concepts:
1. **Finding Sources** - Categorizes where findings come from
2. **Capabilities** - Describes what tools can do

There was concern about potential duplication between these systems, especially since some names overlap (sast, sca, dast, secrets, iac, container).

---

## Decision

### Finding Sources and Capabilities are **NOT duplicates**

They serve fundamentally different purposes and should remain separate:

| Aspect | Finding Sources | Capabilities |
|--------|-----------------|--------------|
| **Domain Question** | "Where did this finding come from?" | "What can this tool do?" |
| **Primary Entity** | Finding | Tool |
| **Relationship** | 1:1 (finding.source) | M:N (tool_capabilities junction) |
| **Use Case** | Filter/report findings by origin | Select tools for scan profiles |
| **Tenant Custom** | No (system config) | Yes (50 per tenant) |
| **Examples Unique To** | pentest, bug_bounty, red_team, manual, threat_intel, vendor | xss, portscan, subdomain, http, crawler, sbom |

### Name Overlap is Intentional

Both systems include: `sast`, `sca`, `dast`, `secrets`, `iac`, `container`

This is **semantic aliasing at different abstraction levels**:

```
CAPABILITY "sast"              FINDING SOURCE "sast"
     ↓                              ↓
"Semgrep CAN DO static         "This finding WAS DISCOVERED
 analysis"                      by static analysis"
     ↓                              ↓
Tool Selection Phase           Finding Attribution Phase
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. SCAN PROFILE CREATION                                        │
│    User selects CAPABILITIES needed: [sast, secrets]            │
│    → System finds TOOLS with those capabilities                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. SCAN EXECUTION                                               │
│    Tools run and produce findings                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. FINDING CREATION                                             │
│    Each finding gets a SOURCE: "sast", "secret", etc.           │
│    → Used for filtering, reporting, workflow triggers           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Consequences

### Positive
- Clear separation of concerns
- Each system optimized for its use case
- Capabilities support tenant customization (for custom tools)
- Finding Sources remain simple and cacheable (system config)

### Negative
- Some naming overlap may cause initial confusion
- Need to document the distinction clearly

---

## Recommendation: Rename "Capabilities" to "Tool Capabilities"

To reduce confusion, we recommend renaming throughout the codebase:

| Current | Proposed |
|---------|----------|
| `capabilities` table | `tool_capabilities_registry` |
| `Capability` entity | `ToolCapability` |
| `/api/v1/capabilities` | `/api/v1/tool-capabilities` |
| `useCapabilities()` | `useToolCapabilities()` |

**Decision: DEFER**

This is a breaking API change. Recommend implementing in a future major version with proper deprecation:
1. Add new endpoints with new names
2. Deprecate old endpoints (6 month notice)
3. Remove old endpoints in next major version

For now, update documentation to clarify the distinction.

---

## Related

- [Finding Sources Feature](../features/finding-sources.md)
- [Capabilities Registry Feature](../features/capabilities-registry.md)
- [Finding Types & Fingerprinting](../features/finding-types.md)
