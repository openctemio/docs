# Developer Guide

For contributors, plugin developers, and anyone building on OpenCTEM.

## Contributing

- [Coding Conventions](guides/coding-conventions.md) — Code style, linting, commit format
- [Architecture Overview](architecture/overview.md) — System design
- [Database Schema](database/schema.md) — Table structure
- [Database Migrations](database/migrations.md) — How to create migrations

## API

- [API Reference](backend/api-reference.md) — All 202 endpoints
- [JWT Structure](backend/jwt-structure.md) — Token format and claims
- [Ingest API](api/ingest-api.md) — CTIS/SARIF ingestion
- [AI Triage API](api/ai-triage-api.md) — AI-powered analysis

## SDK & Scanner Development

- [SDK Quick Start](guides/sdk-quick-start.md) — Build a custom scanner in 30 minutes
- [SDK Development](guides/sdk-development.md) — Full SDK guide
- [Scanner Adapters](features/sdk-scanner-adapters.md) — Adapter architecture
- [Custom Tools](guides/custom-tools-development.md) — Build custom scanning tools
- [Building Ingestion Tools](guides/building-ingestion-tools.md) — Data ingestion pipeline
- [CTIS Schema](schemas/ctis-schema-reference.md) — Common Threat Intelligence Standard

## Architecture Deep Dives

- [Scan Orchestration](architecture/scan-orchestration.md) — How scans are executed
- [Scan Pipeline Design](architecture/scan-pipeline-design.md) — Pipeline engine
- [Workflow Executor](architecture/workflow-executor.md) — Workflow engine internals
- [Notification System](architecture/notification-system.md) — Outbox pattern
- [Permission Sync](architecture/permission-realtime-sync.md) — Real-time RBAC
- [Agent Protocol](architecture/server-agent-command.md) — Agent communication
- [Agent Key Management](architecture/agent-key-management.md) — API key lifecycle

## CTIS Schema

- [CTIS Report](schemas/ctis-report.md) — Report format
- [CTIS Asset](schemas/ctis-asset.md) — Asset schema
- [CTIS Finding](schemas/ctis-finding.md) — Finding schema
- [CTIS Dependency](schemas/ctis-dependency.md) — Dependency schema

## Design Decisions

- [Finding Sources vs Capabilities](decisions/001-finding-sources-vs-capabilities.md)
- [Tool Capabilities Rename](decisions/002-tool-capabilities-rename-proposal.md)
- [AI Integration](decisions/007-ai-integration.md)
- [Scope Configuration](decisions/008-scope-configuration-hardening.md)

## Frontend

- [UI Architecture](ui/architecture.md) — Next.js 16 app structure
- [Asset API Integration](ui/guides/ASSETS_API_INTEGRATION.md) — Frontend-backend integration
- [Type Customization](ui/guides/CUSTOMIZE_TYPES_GUIDE.md) — TypeScript types
