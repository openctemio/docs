---
layout: default
title: Scan Management
parent: Platform Guides
nav_order: 7
---

# Scan Management Guide

Complete guide to managing security scans in OpenCTEM.

---

## Overview

Scan Management in OpenCTEM includes:

- **Tools**: Security scanners (Semgrep, Trivy, Gitleaks, etc.)
- **Tool Categories**: SAST, SCA, DAST, Secrets, IaC, Container, Recon, OSINT
- **Scan Profiles**: Reusable scan configurations
- **Scans**: Scheduled or on-demand scan jobs
- **Pipelines**: Multi-step workflow automation
- **Scan Sessions**: Agent execution tracking

---

## Tools

### Platform Tools (Builtin)

These are pre-configured tools available to all tenants:

| Tool | Category | Description |
|------|----------|-------------|
| Semgrep | SAST | Code pattern analysis with dataflow tracking |
| Trivy | SCA | Vulnerability scanning for dependencies |
| Gitleaks | Secrets | Secret and credential detection |
| Trivy Config | IaC | Infrastructure as Code scanning |
| Checkov | IaC | Cloud infrastructure scanning |
| Nuclei | DAST | Web vulnerability scanning |

### Tenant Tools (Custom)

Add your own tools specific to your team:

1. Navigate to **Scoping > Tools**
2. Click **+ Add Tool**
3. Fill in tool details:
   - Name and description
   - Category (select or create custom)
   - Binary path
   - Default arguments
   - Capabilities
4. Click **Create**

### Tool Properties

| Property | Description |
|----------|-------------|
| **Name** | Unique identifier |
| **Category** | Classification (SAST, SCA, etc.) |
| **Binary** | Executable path |
| **Default Args** | Command line arguments |
| **Capabilities** | What the tool can detect |
| **Timeout** | Maximum execution time |
| **OK Exit Codes** | Exit codes indicating success |

---

## Tool Categories

Categories organize tools by their function.

### Builtin Categories

| Category | Icon | Description |
|----------|------|-------------|
| **SAST** | `code` | Static Application Security Testing |
| **SCA** | `package` | Software Composition Analysis |
| **DAST** | `globe` | Dynamic Application Security Testing |
| **Secrets** | `key` | Secret Detection |
| **IaC** | `server` | Infrastructure as Code |
| **Container** | `box` | Container Security |
| **Recon** | `search` | Reconnaissance |
| **OSINT** | `eye` | Open Source Intelligence |

### Custom Categories

Create tenant-specific categories:

1. Navigate to **Scoping > Tool Categories**
2. Click **+ Add Category**
3. Set name, display name, icon, and color
4. Click **Create**

---

## Scan Profiles

Scan profiles save reusable configurations.

### Create a Scan Profile

1. Navigate to **Scoping > Scan Profiles**
2. Click **+ Create Profile**
3. Configure:
   - **Name**: Descriptive name
   - **Description**: What this profile is for
   - **Tools**: Select which tools to run
   - **Tool Settings**: Configure each tool
   - **Scan Options**: Include/exclude patterns

### Example Profiles

| Profile | Tools | Use Case |
|---------|-------|----------|
| Full Security | Semgrep, Trivy, Gitleaks | Comprehensive scanning |
| Quick SAST | Semgrep | Fast code review |
| Dependency Audit | Trivy | Dependency vulnerability check |
| Secret Scan | Gitleaks | Credential detection only |

### Using Scan Profiles

When creating a scan or pipeline, select a profile to apply its configuration automatically.

---

## Scans

Scans execute security checks against targets.

### Create a Scan

1. Navigate to **Discovery > Scans**
2. Click **+ Create Scan**
3. Configure:
   - **Name**: Descriptive name
   - **Target**: Select from multiple target sources (see below)
   - **Profile**: Select scan profile
   - **Schedule**: One-time or recurring
   - **Worker**: Which worker executes the scan

### Target Selection

You can select targets from multiple sources. All target types support the same features (profiles, scheduling, etc.).

| Target Type | Description | Example |
|-------------|-------------|---------|
| **Asset Groups** | Pre-defined groups of assets | Production servers, API endpoints |
| **Individual Assets** | Single assets from inventory | Search and select specific assets |
| **Custom Targets** | Manual entry of targets | Domains, IPs, CIDR ranges |

#### Custom Target Formats

When entering custom targets, the following formats are supported:

| Format | Example | Description |
|--------|---------|-------------|
| Domain | `example.com` | Standard domain |
| Wildcard | `*.example.com` | Wildcard subdomain |
| IPv4 | `192.168.1.1` | Single IP address |
| IPv6 | `2001:db8::1` | IPv6 address |
| CIDR | `10.0.0.0/24` | IP range |
| URL | `https://api.example.com` | Full URL |
| Host:Port | `mail.example.com:587` | Domain with port |

#### Security Restrictions

For security reasons, certain targets are blocked:
- **Internal IPs**: 10.x.x.x, 172.16-31.x.x, 192.168.x.x
- **Loopback**: 127.x.x.x, localhost, ::1
- **Link-local**: 169.254.x.x
- **Dangerous characters**: `;`, `&`, `|`, etc.

#### Pre-Creation Validation

Scans are validated before creation:

| Validation | Behavior | Description |
|------------|----------|-------------|
| **Tool Exists** | Blocks | Selected scanner must exist in tool registry |
| **Tool Active** | Blocks | Scanner must not be disabled |
| **Pipeline Steps Valid** | Blocks | All workflow steps must use valid tools |
| **Agent Available** | Warning | Warning logged if no agent available |

**Note:** Scans can be created without available agents. They will remain pending until an agent comes online.

#### Trigger Validation

When triggering a scan (manual or scheduled), additional validation is performed:

| Validation | Behavior | Description |
|------------|----------|-------------|
| **Scan Active** | Blocks | Scan must be in "active" status |
| **Concurrent Limit** | Blocks | Max 3 concurrent runs per scan config |
| **Daemon Agent Online** | Blocks | At least one daemon agent must be online |

**Agent Requirements for Trigger:**

Only **daemon mode** agents can receive server-triggered scan jobs:

| Condition | Required Value |
|-----------|----------------|
| `status` | `active` |
| `health` | `online` or `unknown` |
| `execution_mode` | `daemon` OR type = `worker`/`collector` |
| `current_jobs` | Less than `max_concurrent_jobs` |

**Note:** Standalone/runner agents (CI/CD mode) cannot receive server-triggered jobs because they don't poll for commands. They are designed for external triggers (webhooks, CI pipelines).

### Scan Types

| Type | Description |
|------|-------------|
| **On-Demand** | Run once immediately |
| **Scheduled** | Run at specific times |
| **Recurring** | Repeat on schedule (daily, weekly) |
| **Event-Triggered** | Run on webhooks (PR, push) |

### Scan Status

| Status | Description |
|--------|-------------|
| Pending | Waiting for worker |
| Running | Currently executing |
| Completed | Finished successfully |
| Failed | Error occurred |
| Cancelled | Manually stopped |

---

## Pipelines

Pipelines orchestrate multi-step scan workflows.

### Pipeline Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Pipeline                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  Step 1  │───▶│  Step 2  │───▶│  Step 3  │───▶│  Step 4  │  │
│  │ Semgrep  │    │  Trivy   │    │ Gitleaks │    │ Aggregate │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Create a Pipeline

1. Navigate to **Scoping > Pipelines**
2. Click **+ Create Pipeline**
3. Add steps:
   - Select tool for each step
   - Configure dependencies (parallel or sequential)
   - Set conditions (continue on failure, etc.)
4. Save pipeline

### Pipeline Templates

Pre-defined pipelines for common workflows:

| Template | Steps | Use Case |
|----------|-------|----------|
| Full Recon | Domain enum → Port scan → Web crawl | Asset discovery |
| Vuln Assessment | SAST → SCA → Secret scan | Code security audit |
| Container Security | Image scan → Config scan | Container hardening |

---

## Scan Sessions

Scan sessions track individual scan executions from agents.

### How Sessions Work

```
┌───────────┐     ┌───────────────┐     ┌─────────────────┐
│   Agent   │────▶│ Register Scan │────▶│ Session Created │
└───────────┘     └───────────────┘     └────────┬────────┘
                                                  │
     ┌────────────────────────────────────────────┘
     │
     ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Execute Tool   │────▶│  Push Findings  │────▶│ Session Complete│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Session Properties

| Property | Description |
|----------|-------------|
| **Session ID** | Unique identifier |
| **Worker** | Which agent executed |
| **Tool** | Which scanner was used |
| **Target** | What was scanned |
| **Status** | Current state |
| **Duration** | Execution time |
| **Findings Count** | Number of results |

### View Sessions

1. Navigate to **Discovery > Scan Sessions**
2. Filter by worker, tool, or status
3. Click session for details

---

## Best Practices

### 1. Organize with Profiles

Create profiles for different scenarios:
- Full assessment for releases
- Quick check for PRs
- Compliance scan for audits

### 2. Use Pipelines for Complex Workflows

Chain multiple tools together with proper dependencies.

### 3. Schedule Regular Scans

Set up recurring scans for continuous monitoring:
- Daily: Secret detection
- Weekly: Full vulnerability scan
- Monthly: Comprehensive assessment

### 4. Monitor Scan Sessions

Review sessions to identify:
- Failed scans that need attention
- Long-running scans that can be optimized
- Workers that need more resources

### 5. Keep Tools Updated

Regularly update tool versions for latest detection rules.

---

## Troubleshooting

### Scan Stuck in "Pending"

- No active worker with required capabilities
- Worker is overloaded
- Check worker status in **Scoping > Workers**

### Scan Failed

Check scan session details for error messages:
- Tool not installed on worker
- Target not accessible
- Timeout exceeded

### No Findings After Scan

- Verify tool is configured correctly
- Check include/exclude patterns
- Review scan output in session details

---

## Related Documentation

- [Running Workers](running-workers.md) - Setup scanning agents
- [Tools Management](tools-management.md) - Manage security tools
- [Agent Usage](agent-usage.md) - Use the OpenCTEM Agent
- [SDK Development](sdk-development.md) - Build custom tools
- [ADR-006: Flexible Scan Target Selection](/docs/decisions/006-scan-targets-flexibility.md) - Technical decision on target selection
