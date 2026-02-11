---
layout: default
title: Platform Guides
nav_order: 7
has_children: true
permalink: /guides/
---

# Platform Guides

Comprehensive guides for using the OpenCTEM CTEM Platform.

---

## User Guides

Essential guides for platform users.

| Guide | Description |
|-------|-------------|
| [End-to-End Workflow](END_TO_END_WORKFLOW.md) | Complete scan workflow from setup to remediation |
| [Finding Ingestion Workflow](finding-ingestion-workflow.md) | How findings flow from scanners to database |
| [Finding Deduplication](finding-deduplication-workflow.md) | Fingerprinting and deduplication logic |
| [Data Flow Analysis](data-flow-analysis.md) | Attack path visualization and remediation |
| [Authentication](authentication.md) | Login, tokens, sessions |
| [Multi-Tenancy](multi-tenancy.md) | Teams, tenant switching |
| [Group-Based Access Control](group-based-access-control.md) | Groups, permission sets, team structure |
| [Scan Management](scan-management.md) | Tools, profiles, pipelines |
| [Notification Integrations](notification-integrations.md) | Slack, Teams, Telegram, Webhook alerts |

---

## Agent & Scanning

Configure and run security scans.

| Guide | Description |
|-------|-------------|
| [Running Agents](running-agents.md) | Setup and deploy scanning agents |
| [Agent Configuration](agent-configuration.md) | Agent config reference |
| [Agent Usage](agent-usage.md) | CLI agent for scanning |
| [Agent Usage: CI/CD Integration](agent-usage.md#cicd-integration) | GitHub Actions, GitLab CI templates |
| [Rule Management](rule-management.md) | Custom rules and templates |
| [Suppression Rules](suppression-rules.md) | Manage false positive suppressions |

---

## Developer Guides

Build custom tools and integrations.

| Guide | Description |
|-------|-------------|
| [SDK Quick Start](sdk-quick-start.md) | Get started with the SDK |
| [Custom Tools Development](custom-tools-development.md) | Build custom scanners |
| [SDK Development](sdk-development.md) | Advanced SDK guide |
| [Building Ingestion Tools](building-ingestion-tools.md) | Data collectors |
| [Coding Conventions](coding-conventions.md) | Code style guide |

---

## Platform Administration

For platform administrators.

| Guide | Description |
|-------|-------------|
| [Platform Administration](platform-admin.md) | Admin CLI, bootstrap, platform agents |
| [Security Best Practices](SECURITY.md) | Security hardening |
| [Permissions Reference](permissions.md) | Permission definitions |

---

## Deployment

Container and production deployment.

| Guide | Description |
|-------|-------------|
| [Docker Deployment](docker-deployment.md) | Container deployment |
| [WebSocket Setup](websocket-setup.md) | Real-time communication configuration (nginx, CSP) |

---

## Legacy Documentation

{: .warning }
> The following documents are deprecated and kept for reference only.

| Guide | Status | Replacement |
|-------|--------|-------------|
| [Roles & Permissions](roles-and-permissions.md) | Deprecated | [Group-Based Access Control](group-based-access-control.md) |
