# Admin Guide

For platform administrators, DevOps, and SRE teams.

## Deployment

- [Getting Started (Full Guide)](guides/getting-started.md) — Complete deployment walkthrough
- [Docker Deployment](guides/docker-deployment.md) — Docker Compose setup
- [Kubernetes Deployment](guides/kubernetes-deployment.md) — Helm chart setup
- [Production Deployment](operations/PRODUCTION_DEPLOYMENT.md) — Production checklist
- [Deployment Architecture](DEPLOYMENT.md) — Infrastructure overview

## Configuration

- [Environment Variables](operations/configuration.md) — All configuration options
- [SMTP Configuration](guides/smtp-configuration.md) — Email setup (system + per-tenant)
- [SSO / Entra ID](guides/sso-entra-id.md) — Per-tenant SSO setup
- [SSO Setup (General)](guides/sso-setup.md) — SSO overview
- [Redis Setup](operations/redis-setup.md) — Cache configuration

## User Management

- [Authentication](guides/authentication.md) — Auth providers (Local, OAuth, OIDC, SSO)
- [Permissions](guides/permissions.md) — RBAC permission system
- [Platform Admin](guides/platform-admin.md) — Admin console

## Scanning Infrastructure

- [Agent Configuration](guides/agent-configuration.md) — Configure scan agents
- [Running Agents](guides/running-agents.md) — Deploy and manage agents
- [Platform Agents](features/platform-agents.md) — Shared scanning infrastructure
- [Agent Runbook](operations/platform-agent-runbook.md) — Operational procedures

## Operations

- [Monitoring](guides/monitoring-setup.md) — Prometheus + Grafana setup
- [Backup & Restore](operations/backup-restore.md) — Database backup procedures
- [Scaling](operations/SCALING.md) — Horizontal scaling guide
- [Troubleshooting](operations/troubleshooting.md) — Common issues and fixes
- [Upgrade Guide](operations/upgrade-guide.md) — Version upgrade procedures

## Security

- [Security Guide](guides/SECURITY.md) — Security best practices
- [Tenant Isolation](architecture/tenant-isolation-security.md) — Multi-tenant security model
