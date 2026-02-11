---
layout: default
title: Internal Documentation
nav_exclude: true
---

# Internal Documentation

> ⚠️ **Internal Only** - This section contains development planning documents, RFCs, and implementation plans. These are not part of the public documentation.

---

## Document Categories

### RFCs (Request for Comments)

Implementation planning documents for new features:

| RFC | Date | Status | Description |
|-----|------|--------|-------------|
| [Platform-Controlled Suppression](./rfcs/2026-01-28-platform-controlled-suppression.md) | 2026-01-28 | Planned | False positive management |
| [CTEM Framework Enhancement](./rfcs/2026-01-27-ctem-framework-enhancement.md) | 2026-01-27 | In Progress | CTEM 5-phase enhancement |
| [Platform Agent Unified](./rfcs/2026-01-27-platform-agent-unified.md) | 2026-01-27 | In Progress | Unified agent architecture |
| [Tiered Platform Agents](./rfcs/2026-01-26-tiered-platform-agents.md) | 2026-01-26 | In Progress | Agent tier system |
| [Scan System](./rfcs/2026-01-26-scan-system-implementation.md) | 2026-01-26 | Implemented | Scan orchestration |
| [Platform Admin System](./rfcs/2026-01-25-platform-admin-system.md) | 2026-01-25 | Implemented | Admin console |
| [Platform Agents v3.2](./rfcs/2026-01-24-platform-agents-v3.2.md) | 2026-01-24 | Implemented | Platform agent model |
| [Dynamic Roles](./rfcs/2026-01-22-dynamic-roles.md) | 2026-01-22 | In Progress | Custom role creation |
| [Group Access Control](./rfcs/2026-01-21-group-access-control.md) | 2026-01-21 | In Progress | Group-based permissions |
| [SDK Retry Queue](./rfcs/2026-01-18-sdk-retry-queue.md) | 2026-01-18 | In Progress | SDK resilience |

### Optimization Plans

| Plan | Status | Description |
|------|--------|-------------|
| [API Optimization](./rfcs/2026-api-optimization.md) | Planned | API performance improvements |
| [Redis Caching](./rfcs/2026-redis-caching-optimization.md) | Planned | Cache strategy optimization |
| [Scan Management](./rfcs/2026-scan-management.md) | Planned | Scan workflow improvements |

### PRDs (Product Requirements)

| Document | Status | Description |
|----------|--------|-------------|
| [Tiered Platform Agents PRD](./prd/tiered-platform-agents.md) | Approved | Business requirements for agent tiers |

### Runbooks

| Document | Purpose |
|----------|---------|
| [Platform Agent Runbook](./runbooks/tiered-platform-agents.md) | Operational procedures for platform agents |

---

## Status Legend

| Status | Meaning |
|--------|---------|
| **Implemented** | Feature is complete and deployed |
| **In Progress** | Actively being developed |
| **Planned** | Approved but not started |
| **Review** | Under review/discussion |
| **Deprecated** | No longer relevant |

---

## Contributing

When creating new internal documents:

1. Use date prefix: `YYYY-MM-DD-feature-name.md`
2. Include status in frontmatter
3. Update this index
4. Link to related public documentation

```yaml
---
title: Feature Name
status: in_progress
author: Your Name
date: 2026-01-27
---
```
