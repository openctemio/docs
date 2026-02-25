---
layout: default
title: Tools Management
parent: Guides
nav_order: 16
---

# Tools Management

Guide for managing security scanning tools in OpenCTEM.

---

## Overview

OpenCTEM supports two types of tools:

| Type | Description | Managed By |
|------|-------------|------------|
| **Platform Tools** | Pre-configured scanners (Semgrep, Trivy, Gitleaks, etc.) | OpenCTEM |
| **Custom Tools** | User-created scanner integrations | Tenant admins |

---

## Managing Tools via UI

### Viewing Tools

1. Navigate to **Settings > Tools**
2. View platform tools (read-only) and custom tools
3. Filter by category, capability, or status

### Creating a Custom Tool

1. Go to **Settings > Tools**
2. Click **"Add Tool"**
3. Fill in the configuration:

| Field | Required | Description |
|-------|----------|-------------|
| **Name** | Yes | Unique tool name (max 50 chars) |
| **Install Method** | Yes | `go`, `pip`, `npm`, `docker`, or `binary` |
| **Capabilities** | No | What the tool can do (e.g., `port_scan`, `sast`) |
| **Supported Targets** | No | Target types (e.g., `ip`, `domain`, `url`) |
| **Tags** | No | Custom labels for organization |

### Activating/Deactivating Tools

- **Deactivate**: Temporarily disable a tool from being used in scans
- **Activate**: Re-enable a previously deactivated tool

---

## Managing Tools via API

### List Tools

```bash
curl -X GET http://localhost:8080/api/v1/tools \
  -H "Authorization: Bearer $TOKEN"
```

### Create Tool

```bash
curl -X POST http://localhost:8080/api/v1/tools \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-scanner",
    "install_method": "binary",
    "capabilities": ["vulnerability_scan"],
    "supported_targets": ["ip", "domain"]
  }'
```

### Get Tool by Name

```bash
curl -X GET http://localhost:8080/api/v1/tools/name/my-scanner \
  -H "Authorization: Bearer $TOKEN"
```

---

## Tool Categories

Tools are organized into categories for easier management:

| Category | Description |
|----------|-------------|
| SAST | Static Application Security Testing |
| SCA | Software Composition Analysis |
| DAST | Dynamic Application Security Testing |
| Secrets | Secret/credential detection |
| IaC | Infrastructure as Code scanning |
| Container | Container image scanning |
| Web3 | Smart contract analysis |
| Recon | Reconnaissance/discovery |

### Custom Categories

Create custom categories for organizing tenant-specific tools:

```bash
curl -X POST http://localhost:8080/api/v1/custom-tool-categories \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-category", "display_name": "My Category"}'
```

---

## Smart Filtering

Tools with `supported_targets` configured enable **smart filtering** — automatically matching assets to compatible scanners during scan execution. See [Scan Management](./scan-management.md) for details.

---

## Related Documentation

- [Scan Management](./scan-management.md) — Configure and run scans
- [Custom Tools Development](./custom-tools-development.md) — Build custom scanners with the SDK
- [Running Agents](./running-agents.md) — Agent setup and tool installation
