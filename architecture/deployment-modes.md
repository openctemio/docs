---
layout: default
parent: Architecture
---
{% raw %}
---
layout: default
title: SDK Deployment Modes
parent: Architecture
nav_order: 2
---
# OpenCTEM SDK Deployment Modes

This document describes the different ways to deploy and use the OpenCTEM SDK based on real-world use cases.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OPENCTEM PLATFORM                                     │
│                                                                              │
│   ┌─────────────────┐  ┌─────────────────┐  ┌───────────────────────────┐  │
│   │   Command API   │  │   Ingest API    │  │  WebSocket (real-time)    │  │
│   │  (for agents)   │  │ (findings/assets)│  │  (notifications)          │  │
│   └─────────────────┘  └─────────────────┘  └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                │                  ▲                        │
                │                  │                        │
    ┌───────────┴──────────────────┴────────────────────────┴───────────┐
    │                                                                    │
    │                     DEPLOYMENT OPTIONS                             │
    │                                                                    │
    │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐  │
    │  │  MODE 1:       │  │  MODE 2:       │  │  MODE 3:           │  │
    │  │  CI/CD Runner  │  │  Agent Daemon  │  │  Collector Daemon  │  │
    │  │  (one-shot)    │  │  (long-running)│  │  (long-running)    │  │
    │  └────────────────┘  └────────────────┘  └────────────────────┘  │
    │                                                                    │
    └────────────────────────────────────────────────────────────────────┘
```

---

## Mode 1: CI/CD Runner (One-Shot)

**Use Case:** Run security scans in CI/CD pipelines

**Characteristics:**
- Runs once, produces results, exits
- No persistent state
- Perfect for GitHub Actions, GitLab CI, Jenkins
- Simplest deployment

**How it works:**
```
┌─────────────────────────────────────────────────────────────────┐
│                     CI/CD PIPELINE                               │
│                                                                  │
│  1. Code pushed                                                  │
│          │                                                       │
│          ▼                                                       │
│  2. CI triggers scan job                                        │
│          │                                                       │
│          ▼                                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ .openctem scan --tool semgrep --target ./ --push           │  │
│  │                                                            │  │
│  │  [Scan] → [Parse SARIF] → [Push to OpenCTEM] → [Exit 0]   │  │
│  └───────────────────────────────────────────────────────────┘  │
│          │                                                       │
│          ▼                                                       │
│  3. Pipeline continues (pass/fail based on findings)            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Example Usage:**

```bash
# GitHub Actions
- name: Run OpenCTEM Scan
  run: |
   .openctem scan \
      --tool semgrep \
      --target . \
      --api-url https://api.openctem.io \
      --api-key ${{ secrets.API_KEY }} \
      --source-id ${{ secrets.SOURCE_ID }} \
      --push

# GitLab CI
security_scan:
  script:
    -.openctem scan --tool trivy-fs --target . --push
```

**When to use:**
- ✅ CI/CD integration
- ✅ Ad-hoc scans
- ✅ One-time assessments
- ❌ Continuous monitoring
- ❌ Server-controlled scans

---

## Mode 2: Agent Daemon (Long-Running)

**Use Case:** Continuous security scanning with central management

**Characteristics:**
- Long-running daemon process
- Polls server for commands (optional)
- Runs scheduled scans
- Sends heartbeats
- Can include scanners AND collectors

**How it works:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       AGENT DAEMON                                       │
│                                                                          │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │                    Event Loop                                  │    │
│   │                                                                │    │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │    │
│   │  │ Heartbeat   │  │ Command     │  │ Scheduled           │   │    │
│   │  │ Timer       │  │ Poller      │  │ Scan Timer          │   │    │
│   │  │ (1min)      │  │ (30s)       │  │ (configurable)      │   │    │
│   │  └──────┬──────┘  └──────┬──────┘  └──────┬──────────────┘   │    │
│   │         │                │                │                   │    │
│   │         ▼                ▼                ▼                   │    │
│   │  Send status      GET /commands     Run scanners             │    │
│   │  to server        Execute if any    on targets               │    │
│   │                                                                │    │
│   └───────────────────────────────────────────────────────────────┘    │
│                                                                          │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │                    Components                                  │    │
│   │                                                                │    │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │    │
│   │  │ Scanners    │  │ Collectors  │  │ Parsers     │           │    │
│   │  │ - semgrep   │  │ - github    │  │ - sarif     │           │    │
│   │  │ - trivy     │  │ - gitlab    │  │ - json      │           │    │
│   │  │ - gitleaks  │  │ - webhook   │  │             │           │    │
│   │  └─────────────┘  └─────────────┘  └─────────────┘           │    │
│   │                                                                │    │
│   └───────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Operating Sub-Modes:**

| Sub-Mode | Command Polling | Scheduled Scans | Use Case |
|----------|-----------------|-----------------|----------|
| **Standalone** | ❌ Off | ✅ On | Air-gapped, no server control |
| **Managed** | ✅ On | ❌ Off | Full server control |
| **Hybrid** | ✅ On | ✅ On | Both scheduled + on-demand |

**Example Configuration:**

```yaml
# Hybrid mode - both scheduled and server-controlled
agent:
  name: production-scanner
  version: "1.0.0"

  # Scheduled scanning
  scan_interval: 6h              # Run local scans every 6 hours
  targets:
    - /opt/code/app1
    - /opt/code/app2

  # Server control
  enable_command_polling: true   # Accept commands from server
  command_poll_interval: 30s

  # Health monitoring
  heartbeat_interval: 1m

scanners:
  - name: semgrep
    enabled: true
  - name: gitleaks
    enabled: true

collectors:
  - name: github
    enabled: true
    token: ${GITHUB_TOKEN}
    repos:
      - org/repo1
      - org/repo2
    poll_interval: 1h            # Collect from GitHub every hour

server:
  base_url: https://api.openctem.io
  api_key: ${API_KEY}
  source_id: ${SOURCE_ID}
```

**When to use:**
- ✅ Continuous monitoring
- ✅ Centralized management
- ✅ On-demand scans from server
- ✅ Multiple targets/repos
- ❌ CI/CD (use runner instead)
- ❌ Serverless environments

---

## Mode 3: Collector Daemon (Specialized)

**Use Case:** Aggregate security findings from multiple external sources

**Characteristics:**
- Focuses on pulling data, not scanning
- Polls external APIs (GitHub, GitLab, Jira, etc.)
- Can run as daemon or one-shot
- Lightweight, no heavy scanning

**How it works:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     COLLECTOR DAEMON                                     │
│                                                                          │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │                    Poll Loop                                   │    │
│   │                                                                │    │
│   │     Every 1 hour (configurable):                              │    │
│   │                                                                │    │
│   │     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐  │    │
│   │     │ GitHub API  │     │ GitLab API  │     │ Jira API    │  │    │
│   │     │             │     │             │     │             │  │    │
│   │     │ Dependabot  │     │ SAST        │     │ Security    │  │    │
│   │     │ Code Scan   │     │ DAST        │     │ Tickets     │  │    │
│   │     │ Secrets     │     │ Container   │     │             │  │    │
│   │     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘  │    │
│   │            │                   │                   │          │    │
│   │            └───────────────────┼───────────────────┘          │    │
│   │                                │                               │    │
│   │                                ▼                               │    │
│   │                    ┌─────────────────────┐                    │    │
│   │                    │  Normalize to CTIS   │                    │    │
│   │                    └──────────┬──────────┘                    │    │
│   │                               │                                │    │
│   │                               ▼                                │    │
│   │                    ┌─────────────────────┐                    │    │
│   │                    │  Push to OpenCTEM    │                    │    │
│   │                    └─────────────────────┘                    │    │
│   │                                                                │    │
│   └───────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Example Usage:**

```bash
# One-shot mode - collect once and exit
openctem collect \
  --source github \
  --token $GITHUB_TOKEN \
  --org myorg \
  --push

# Daemon mode - continuous collection
openctem collect \
  --source github \
  --token $GITHUB_TOKEN \
  --org myorg \
  --daemon \
  --interval 1h \
  --push
```

**When to use:**
- ✅ Aggregating from multiple security tools
- ✅ GitHub/GitLab native security alerts
- ✅ Third-party tool integration
- ✅ Lightweight deployment
- ❌ Running actual scans (use agent)

---

## Comparison Matrix

| Feature | CI/CD Runner | Agent Daemon | Collector Daemon |
|---------|--------------|--------------|------------------|
| **Lifecycle** | One-shot | Long-running | Both |
| **Runs Scanners** | ✅ Yes | ✅ Yes | ❌ No |
| **Runs Collectors** | ❌ No | ✅ Optional | ✅ Yes |
| **Server Commands** | ❌ No | ✅ Optional | ❌ No |
| **Scheduled Scans** | ❌ No | ✅ Yes | N/A |
| **Heartbeats** | ❌ No | ✅ Yes | ✅ Yes |
| **State Management** | Stateless | Stateful | Minimal |
| **Best For** | CI/CD | Enterprise | Aggregation |

---

## Deployment Recommendations

### Small Teams / Startups
```
Recommended: CI/CD Runner only

Why:
- Simple integration with existing pipelines
- No infrastructure to manage
- Pay-per-scan model fits budget
```

### Medium Companies
```
Recommended: CI/CD Runner + Collector Daemon

Why:
- Scans in CI/CD catch issues early
- Collector aggregates GitHub/GitLab alerts
- Moderate infrastructure requirement
```

### Enterprise
```
Recommended: All three modes

Why:
- CI/CD for developer feedback
- Agent for continuous monitoring + compliance
- Collector for multi-source aggregation
- Server-controlled scans for incident response
```

---

## Architecture Decision Flow

```
Start
  │
  ▼
┌─────────────────────────────────────┐
│ Do you need CI/CD integration?      │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        │ Yes         │ No
        ▼             ▼
   Use Runner    ┌───────────────────────────────┐
        │        │ Do you need continuous        │
        │        │ scanning of local targets?    │
        │        └───────────────┬───────────────┘
        │                        │
        │                 ┌──────┴──────┐
        │                 │ Yes         │ No
        │                 ▼             ▼
        │            Use Agent    ┌───────────────────────────────┐
        │                 │       │ Do you need to aggregate from │
        │                 │       │ external sources (GitHub,etc)?│
        │                 │       └───────────────┬───────────────┘
        │                 │                       │
        │                 │                ┌──────┴──────┐
        │                 │                │ Yes         │ No
        │                 │                ▼             ▼
        │                 │         Use Collector   No SDK needed
        │                 │                │        (use API directly)
        │                 │                │
        └─────────────────┴────────────────┘
                          │
                          ▼
                    Combine as needed
```

---

## CLI Command Reference

### Runner Commands
```bash
# Single tool scan
openctem scan --tool semgrep --target ./src --push

# Multiple tools
openctem scan --tools semgrep,gitleaks,trivy-fs --target . --push

# With custom config
openctem scan --tool semgrep --config ./semgrep.yml --target . --push

# Dry run (no push)
openctem scan --tool semgrep --target . --output ./report.json
```

### Agent Commands
```bash
# Start agent with config file
openctem agent --config ./agent.yaml

# Start with inline config
openctem agent \
  --name my-scanner \
  --scan-interval 6h \
  --target /opt/code \
  --tool semgrep,gitleaks

# Standalone mode (no server polling)
openctem agent --config ./agent.yaml --standalone

# With server control enabled
openctem agent --config ./agent.yaml --enable-commands
```

### Collector Commands
```bash
# One-shot GitHub collection
openctem collect github --token $TOKEN --org myorg --push

# Daemon mode
openctem collect github --token $TOKEN --org myorg --daemon --interval 1h

# Multiple sources
openctem collect --config ./collectors.yaml --daemon
```

---

## Security Considerations

### Runner Mode
- API key only needed during scan
- Can use short-lived tokens
- No persistent credentials

### Agent Mode
- API key stored in environment/config
- Should use dedicated source API key (limited scope)
- Validate commands before execution
- Whitelist allowed targets

### Collector Mode
- Needs tokens for external APIs
- Store securely (vault, secrets manager)
- Use least-privilege access

---

## Related Documentation

- [SDK Development Guide](../guides/sdk-development.md)
- [Server-Agent Command Architecture](./server-agent-command.md)
- [SDK & API Integration](./sdk-api-integration.md)
{% endraw %}
