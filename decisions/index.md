---
layout: default
title: Decisions
nav_order: 8
has_children: true
permalink: /decisions/
---

# Architecture Decision Records (ADRs)

This section contains Architecture Decision Records documenting significant technical decisions made in the OpenCTEM platform.

---

## Decision Log

| ID | Title | Status | Date |
|----|-------|--------|------|
| [ADR-001](001-finding-sources-vs-capabilities.md) | Finding Sources vs Tool Capabilities | Accepted | 2025-01-30 |
| [RFC-002](002-tool-capabilities-rename-proposal.md) | Rename Capabilities to Tool Capabilities | Proposed (Deferred) | 2025-01-30 |
| [RFC-003](003-custom-capabilities-ui.md) | Custom Capabilities Management UI | Proposed | 2025-01-30 |
| [ADR-004](004-custom-finding-sources-evaluation.md) | Custom Finding Sources - Not Recommended | Accepted | 2025-01-30 |
| [RFC-005](005-source-based-workflow-triggers.md) | Source-Based Workflow Triggers | Proposed | 2025-01-30 |
| [RFC-006](006-scan-targets-flexibility.md) | Flexible Scan Target Selection | Proposed | 2025-01-31 |
| [RFC-007](007-ai-integration.md) | AI Integration - Triage & Analysis System | Proposed | 2025-02-01 |

---

## What is an ADR?

An Architecture Decision Record captures an important architectural decision made along with its context and consequences. ADRs help:

- **Document why** decisions were made (not just what)
- **Onboard new team members** with historical context
- **Prevent re-litigation** of settled debates
- **Track evolution** of the system over time

## ADR Template

```markdown
# ADR-XXX: Title

**Status:** Proposed | Accepted | Deprecated | Superseded
**Date:** YYYY-MM-DD
**Authors:** Team/Person

## Context
What is the issue that we're seeing that is motivating this decision?

## Decision
What is the change that we're proposing and/or doing?

## Consequences
What becomes easier or more difficult because of this change?

## Related
Links to related ADRs, docs, or issues.
```

---

## Related Documentation

- [Architecture Overview](../architecture/overview.md)
- [Features](../features/)
