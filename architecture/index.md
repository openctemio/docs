---
layout: default
title: Architecture
nav_order: 3
has_children: true
permalink: /architecture/
---

# Architecture

Technical architecture and design documentation for the OpenCTEM CTEM Platform.

---

## Overview

Start with these documents to understand the system:

| Document | Description |
|----------|-------------|
| [System Overview](overview.md) | High-level system architecture |
| [Component Interactions](component-interactions.md) | How all components interact |
| [Deployment Modes](deployment-modes.md) | Standalone vs distributed deployment |
| [Pipeline vs Workflow](pipeline-vs-workflow.md) | Key differences explained |

---

## Scanning System

Core scanning and pipeline architecture:

| Document | Description |
|----------|-------------|
| [Scan Flow Architecture](scan-flow.md) | Complete scan lifecycle |
| [Scan Pipeline Design](scan-pipeline-design.md) | Pipeline execution engine |
| [Scan Orchestration](scan-orchestration.md) | Automated scheduling and progression |
| [Scan Trigger Edge Cases](scan-trigger-edge-cases.md) | Race conditions, validation, recovery |
| [Workflow Executor](workflow-executor.md) | Automation with 14-layer security |

---

## Agent Architecture

Agent communication and management:

| Document | Description |
|----------|-------------|
| [Server-Agent Communication](server-agent-command.md) | Command & control protocol |
| [Agent Key Management](agent-key-management.md) | Authentication and key handling |
| [Agent Resource Management](agent-resource-management.md) | Auto-cleanup, async pipeline, throttling |
| [Platform Agents Feature](../features/platform-agents.md) | User-facing documentation |

---

## Access Control

Security and authorization architecture:

| Document | Description |
|----------|-------------|
| [Access Control Overview](access-control-flows-and-data.md) | 3-layer security model |
| [Tenant Isolation & RLS](tenant-isolation-security.md) | Multi-tenant data isolation with PostgreSQL RLS |
| [Module Access Control](module-access-control.md) | Subscription-based feature gating |
| [Route-Level Protection](route-level-permission-protection.md) | RBAC middleware |
| [Permission Realtime Sync](permission-realtime-sync.md) | Real-time permission updates |
| [Module Permission Filtering](module-permission-filtering.md) | Permission-based filtering |

---

## Notifications

Alert and notification system:

| Document | Description |
|----------|-------------|
| [Notification System](notification-system.md) | Real-time alerts, async patterns |
| [User Notification Inbox](user-notification-inbox.md) | In-app notifications |

---

## Integration & API

External integrations and SDK:

| Document | Description |
|----------|-------------|
| [SDK-API Integration](sdk-api-integration.md) | SDK and API design |
| [gRPC Design](grpc-design.md) | gRPC protocol (future) |
| [Storage Service Design](storage-service-design.md) | Multi-tenant storage with BYOB |

---

## Optimization

Performance and scaling:

| Document | Description |
|----------|-------------|
| [Rate Limiting](rate-limiting-improvements.md) | API rate limiting design |

---

## Key Concepts

### Clean Architecture

The backend follows Clean Architecture with three layers:

```
┌─────────────────────────────────────────┐
│              Infrastructure              │
│  (HTTP handlers, DB, external services) │
├─────────────────────────────────────────┤
│              Application                 │
│         (Use cases, services)           │
├─────────────────────────────────────────┤
│                Domain                    │
│      (Entities, business rules)         │
└─────────────────────────────────────────┘
```

### Multi-Tenancy

All data is tenant-scoped with **Defense in Depth** isolation:

- **Layer 1**: SQL `WHERE tenant_id = ?` in all repository queries
- **Layer 2**: PostgreSQL Row Level Security (RLS) as safety net
- **Layer 3**: Composite indexes for performance optimization
- Tenant ID embedded in JWT tokens and validated by middleware

See [Tenant Isolation & RLS](tenant-isolation-security.md) for complete implementation details.

### SDK Integration

Agents and scanners integrate via:

1. **REST API** - Push findings and assets
2. **Go SDK** - Build custom tools
3. **CTIS Schema** - Standardized data format

### Platform Agent Model

| Model | Description | Use Case |
|-------|-------------|----------|
| **Tenant Agents** | Customer-deployed | Full control, private networks |
| **Platform Agents** | OpenCTEM-managed | Quick start, no deployment |

See [Platform Agents](../features/platform-agents.md) for details.
