---
layout: default
title: "ADR-004: Custom Finding Sources - Not Recommended"
parent: Decisions
nav_order: 4
---

# ADR-004: Custom Finding Sources - Not Recommended

**Status:** Accepted (Decision: Do Not Implement)
**Date:** 2025-01-30
**Authors:** Engineering Team

---

## Summary

After evaluating use cases, we decided **NOT** to implement tenant-customizable finding sources. The 18 predefined sources cover 90%+ of use cases, and the ROI does not justify the implementation effort.

---

## Context

Finding sources categorize where security findings originate:
- SAST, DAST, SCA (automated scanning)
- Pentest, Bug Bounty, Red Team (manual assessment)
- Threat Intel, Vendor Advisory (external)

Question: Should tenants be able to add custom finding sources?

---

## Research Findings

### Current Usage Analysis

| Use Case | Finding Source Usage | Notes |
|----------|---------------------|-------|
| Finding display | ✅ Column in table | Works well |
| Create finding | ✅ Dropdown with 18 options | Sufficient |
| Filter findings | ✅ URL parameter | Works well |
| Workflow triggers | ❌ Not used | Gap |
| Notifications | ❌ Not used | Gap |
| Reports | ❌ Not grouped by source | Limited |
| Duplicate detection | ❌ Ignores source | By design |

### Potential Custom Source Use Cases

| Use Case | Frequency | Alternative |
|----------|-----------|-------------|
| Proprietary security tools | Rare | Use "external" source |
| Compliance-specific (HIPAA, SOX) | Rare | Use tags/labels |
| Tool-specific tracking | Medium | Use `tool_name` field |
| Internal assessments | Low | Use "manual" source |

### Implementation Complexity

| Aspect | Effort |
|--------|--------|
| Add `tenant_id` to schema | Low |
| Update cache service | Medium |
| Sync with Go constants | High (pain point) |
| Update all source selectors | Medium |
| Handle source deprecation | High |
| Update reports | Medium |

---

## Decision

**Do NOT implement custom finding sources**

### Reasons

1. **Low ROI**: 18 sources cover vast majority of use cases
2. **Code sync required**: Adding sources requires updating Go constants in `value_objects.go`
3. **Limited automation impact**: Sources not used in workflows/notifications
4. **Better alternatives exist**: `tool_name` field and tags provide flexibility
5. **Complexity vs value**: High implementation effort for edge cases

### What We Recommend Instead

1. **Use existing sources creatively**:
   - Proprietary tools → `external`
   - Compliance scans → `sast` or `manual`
   - Internal assessments → `manual`

2. **Use `tool_name` for granularity**:
   - Finding already has `tool_name` field
   - Filter by tool for specific tracking

3. **Future: Add source-based workflow triggers**:
   - Higher value than custom sources
   - Enables automation by source type
   - See RFC-005 (future)

---

## Consequences

### Positive
- No migration complexity
- No cache invalidation issues
- Simple, maintainable system
- Clear distinction: sources = system config

### Negative
- Edge case tenants must use existing sources
- Cannot add industry-specific sources (HIPAA-scan, etc.)
- Tool-level tracking via `tool_name` less intuitive

### Acceptable Trade-offs
- 90%+ use cases covered
- Clear escalation path if needed (request new source)
- Can revisit if strong user demand

---

## If We Needed to Revisit

Trigger conditions to reconsider:
1. >10 customer requests for custom sources
2. Compliance requirement for source-level audit
3. Integration with tool that requires unique source

Implementation would require:
1. Add `tenant_id` to `finding_sources` table
2. Remove constraint on Go constants sync
3. Update cache to be tenant-aware
4. Migration path for existing sources

---

## Related

- [ADR-001: Finding Sources vs Tool Capabilities](001-finding-sources-vs-capabilities.md)
- [Finding Sources Feature](../features/finding-sources.md)
- [RFC-003: Custom Capabilities UI](003-custom-capabilities-ui.md) (contrast: we DO recommend this)
