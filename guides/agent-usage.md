---
layout: default
title: Agent Usage Guide
parent: Platform Guides
nav_order: 12
---
{% raw %}

# OpenCTEM Agent Usage Guide

The OpenCTEM Agent is a modular security scanning tool that integrates with the OpenCTEM platform. It supports multiple executor types for different security domains.

---

## Architecture Overview

The agent uses a **modular executor architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                      Agent Binary                           │
├─────────────────────────────────────────────────────────────┤
│                   Executor Router                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  Recon   │ │ VulnScan │ │ Secrets  │ │  Assets  │  ...  │
│  │ Executor │ │ Executor │ │ Executor │ │ Executor │       │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘       │
│       │            │            │            │              │
│  ┌────┴────┐  ┌────┴────┐  ┌────┴────┐  ┌────┴────┐        │
│  │subfinder│  │ nuclei  │  │gitleaks │  │  cloud  │        │
│  │  dnsx   │  │  trivy  │  │trufflehog│  │  apis  │        │
│  │ naabu   │  │ semgrep │  └─────────┘  └─────────┘        │
│  │ httpx   │  └─────────┘                                  │
│  │ katana  │                                               │
│  └─────────┘                                               │
└─────────────────────────────────────────────────────────────┘
```

**Executors:**
- **Recon**: External attack surface discovery (subdomains, DNS, ports, HTTP, crawling)
- **VulnScan**: Vulnerability scanning (SAST, SCA, DAST, IaC)
- **Secrets**: Secret and credential detection
- **Assets**: Cloud asset collection
- **Pipeline**: Workflow orchestration (coming soon)

---

## Installation

### Option 1: Go Install

```bash
go install github.com/openctemio/agent@latest
```

### Option 2: Build from Source

```bash
git clone https://github.com/openctemio/agent.git
cd agent

# Standard build (CLI-only tools)
go build -o agent ./agent/

# Platform mode build (for managed agents)
go build -tags platform -o agent ./agent/

# Hybrid mode build (library + CLI, reduces process overhead)
go build -tags hybrid -o agent ./agent/

# Full build (platform + hybrid)
go build -tags "platform,hybrid" -o agent ./agent/
```

### Option 3: Docker

```bash
# Pull from Docker Hub
docker pull openctemio/agent:latest

# Available variants
docker pull openctemio/agent:full    # All tools included (~1GB)
docker pull openctemio/agent:slim    # Agent only (~20MB)
docker pull openctemio/agent:ci      # CI/CD optimized (~1.2GB)
```

---

## Quick Start

### 1. Create an Agent in OpenCTEM UI

1. Navigate to **Scoping > Agents**
2. Click **+ Add Agent**
3. Fill in details (name, type, capabilities)
4. **Copy the API key** (shown only once!)

### 2. Run Your First Scan

```bash
# Set credentials
export API_URL=https://api.openctem.io
export API_KEY=rdw_your_api_key_here

# Run a scan and push results
./agent -tool semgrep -target /path/to/project -push -verbose
```

---

## Command Line Options

### Basic Options

| Flag | Description | Example |
|------|-------------|---------|
| `-tool` | Single tool to run | `-tool semgrep` |
| `-tools` | Multiple tools (comma-separated) | `-tools semgrep,gitleaks,trivy` |
| `-target` | Path or URL to scan | `-target ./src` |
| `-push` | Push results to OpenCTEM | `-push` |
| `-verbose` | Enable verbose logging | `-verbose` |
| `-config` | Path to config file | `-config agent.yaml` |

### Executor Options

| Flag | Description | Default |
|------|-------------|---------|
| `-enable-recon` | Enable reconnaissance executor | `false` |
| `-enable-vulnscan` | Enable vulnerability scan executor | `true` |
| `-enable-secrets` | Enable secrets detection executor | `false` |
| `-enable-assets` | Enable asset collection executor | `false` |
| `-enable-pipeline` | Enable pipeline orchestration | `false` |

### Execution Modes

| Flag | Description |
|------|-------------|
| `-daemon` | Run as continuous daemon |
| `-platform` | Run as platform-managed agent (requires `-tags platform` build) |
| `-list-tools` | List available tools |
| `-check-tools` | Check tool installation status |

### Platform Agent Options (requires `-tags platform` build)

| Flag | Description |
|------|-------------|
| `-api-url` | Platform API URL |
| `-bootstrap-token` | One-time bootstrap token for registration |
| `-region` | Agent region for job routing |
| `-max-concurrent` | Maximum concurrent jobs |
| `-credentials-file` | Path to store agent credentials |

### CI/CD Options

| Flag | Description |
|------|-------------|
| `-auto-ci` | Auto-detect CI environment |
| `-comments` | Post findings as PR/MR comments |
| `-fail-on` | Exit with code 1 if findings >= severity (critical, high, medium, low) |
| `-output-format` | Output format: json, sarif, table (default: table) |
| `-output` | Output file path (instead of stdout) |

### Security Gate (CI/CD Pipeline Control)

The security gate allows you to fail CI/CD pipelines based on finding severity:

```bash
# Fail if any critical or high severity findings
agent -tool semgrep -target . -fail-on high

# Fail only on critical findings
agent -tool semgrep -target . -fail-on critical -push

# Fail on medium and above
agent -tools semgrep,gitleaks -target . -fail-on medium -output-format sarif -output results.sarif
```

**Exit Codes:**
| Code | Meaning |
|------|---------|
| 0 | Pass - no findings above threshold |
| 1 | Fail - findings above threshold |
| 2 | Error - configuration or runtime error |

### Output Formats

```bash
# JSON output
agent -tool semgrep -target . -output-format json

# SARIF 2.1.0 output (for GitHub/GitLab Security Dashboard)
# Includes codeFlows for attack path visualization
agent -tool semgrep -target . -output-format sarif -output results.sarif

# Table output (default, human-readable)
agent -tool semgrep -target . -output-format table
```

**SARIF 2.1.0 Features:**
- `codeFlows` - Taint tracking paths (source → intermediate → sink)
- `fingerprints` - Deduplication fingerprints
- `partialFingerprints` - Type-aware fingerprints for migration
- `relatedLocations` - Additional context locations
- `stacks` - Call stack traces

---

## Available Scanners

### VulnScan Executor (SAST, SCA, DAST, IaC)

| Tool | Type | Description |
|------|------|-------------|
| `semgrep` | SAST | Code analysis with dataflow/taint tracking |
| `trivy` | SCA | Vulnerability scanning (filesystem) |
| `trivy-config` | IaC | Infrastructure misconfiguration |
| `trivy-image` | Container | Container image scanning |
| `trivy-full` | All | vuln + misconfig + secret |
| `nuclei` | DAST | Dynamic application security testing |

#### Data Flow Analysis (Taint Tracking)

The agent automatically enables **dataflow traces** for Semgrep scans. This provides attack path visualization showing how untrusted data flows from source (user input) to sink (vulnerable function).

**Output includes:**
- **Source locations** - Where tainted data enters (e.g., `request.form['user']`)
- **Intermediate steps** - How data is transformed/propagated
- **Sink locations** - Where the vulnerability occurs (e.g., `db.execute(query)`)

The data flow information is output in SARIF 2.1.0 `codeFlows` format and ingested into the platform's `finding_data_flows` tables for visualization.

**Example output:**
```
Source: handlers/user.go:25 → username := r.FormValue("username")
    ↓
Intermediate: handlers/user.go:30 → query := fmt.Sprintf("SELECT * WHERE name='%s'", username)
    ↓
Sink: handlers/user.go:35 → rows, _ := db.Query(query)
```

See [Data Flow Analysis Guide](data-flow-analysis.md) for how to use this information for remediation.

### Secrets Executor

| Tool | Type | Description |
|------|------|-------------|
| `gitleaks` | Secret | Secret and credential detection |
| `trufflehog` | Secret | Git history secret scanning |

### Recon Executor (External Attack Surface)

| Tool | Type | Description |
|------|------|-------------|
| `subfinder` | Subdomain | Passive subdomain enumeration |
| `dnsx` | DNS | DNS resolution and record lookup |
| `naabu` | Port | Fast port scanning |
| `httpx` | HTTP | HTTP probing and tech detection |
| `katana` | Crawler | Web crawling and URL discovery |

### Software Bill of Materials (SBOM)

When you run a vulnerability scan with Trivy, the agent automatically collects a Software Bill of Materials (SBOM). This inventory is stored in the `components` table (global library) and linked to your asset in `asset_components`.

- **Coverage**: Application dependencies (npm, pip, go.mod, etc.) and OS packages (apk, dpkg, rpm).
- **Global View**: Components are normalized globally, allowing you to track usage of a specific library version across all assets.
- **Snapshot Refresh**: Each scan refreshes the asset's dependency list, removing stale links and adding new ones, ensuring the "Vulnerable" status is always up-to-date with the latest scan.

To view the SBOM for an asset, use the API endpoint:
`GET /api/v1/assets/{id}/components`

### Check Tool Status

```bash
# List all available tools
./agent -list-tools

# Check which tools are installed
./agent -check-tools

# Interactively install missing tools
./agent -install-tools
```

**Supported native tools:**

| Tool | Description | Install Command |
|------|-------------|-----------------|
| `semgrep` | SAST scanner with dataflow/taint tracking | `pip install semgrep` |
| `gitleaks` | Secret detection scanner | `brew install gitleaks` |
| `trivy` | SCA/Container/IaC scanner | `brew install trivy` |
| `nuclei` | Vulnerability scanner (DAST) | `brew install nuclei` |

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_URL` | Yes* | Platform API URL |
| `API_KEY` | Yes* | Agent API key |
| `AGENT_ID` | No | Agent UUID for tracking |
| `GITHUB_TOKEN` | Auto | GitHub token (for PR comments) |
| `GITLAB_TOKEN` | Auto | GitLab token (for MR comments) |

*Required when using `-push` flag

### Configuration File

Create `agent.yaml`:

```yaml
# Agent settings
agent:
  name: "prod-scanner-01"
  enable_commands: true
  command_poll_interval: 30s
  heartbeat_interval: 1m
  log_level: info

# Platform connection
server:
  base_url: "https://api.openctem.io"
  api_key: "rdw_your_api_key"
  agent_id: ""  # Auto-generated if empty
  timeout: 30s
  max_retries: 3
  retry_delay: 2s

# Scanners
scanners:
  - name: semgrep
    enabled: true

  - name: gitleaks
    enabled: true

  - name: trivy
    enabled: true

# Targets for daemon mode
targets:
  - /opt/code/project1

# Output settings
output:
  format: json
  sarif: false

# CI/CD settings
ci:
  comments: true
  fail_on: critical
  push: true

# Advanced
advanced:
  max_concurrent: 2
  scan_timeout: 30m
  cache_dir: /tmp/app-cache
  exclude:
    - "**/node_modules/**"
    - "**/vendor/**"
    - "**/.git/**"
```

---

## Execution Modes

### One-Shot Mode (Single Scan)

Run a scan and exit:

```bash
# Single tool
./agent -tool semgrep -target ./src -push

# Multiple tools
./agent -tools semgrep,gitleaks,trivy -target . -push

# With config file
./agent -config agent.yaml -push

# Dry run (no push)
./agent -tool semgrep -target . -output ./results.json
```

> **Important**: In one-shot mode, use `-push` to send results to OpenCTEM.

### Daemon Mode (Continuous)

Run as a long-running service:

```bash
# Start daemon
./agent -daemon -config agent.yaml

# With verbose logging
./agent -daemon -config agent.yaml -verbose

# Standalone (no server commands)
./agent -daemon -config agent.yaml -standalone
```

> **Note**: In daemon mode, findings are automatically pushed after each scan.

---

## CI/CD Integration

### CI vs DAST: Understanding the Difference

```
PR/MR Workflow (CI):
┌─────────────────────────────────────────────────────────┐
│  Push/PR → SAST → Secrets → SCA → Build → Deploy       │
│            (semgrep) (gitleaks) (trivy)                 │
│            ↑─────── CI Stage ──────↑                    │
└─────────────────────────────────────────────────────────┘

DAST Workflow (Separate):
┌─────────────────────────────────────────────────────────┐
│  Deploy to Staging → DAST Scan → Report                 │
│                      (nuclei)                           │
│                      ↑ Requires running app             │
└─────────────────────────────────────────────────────────┘
```

**CI scans (SAST, Secrets, SCA):**
- Run on every PR/MR
- Scan source code statically
- Block merge if critical issues found
- Use `agent:ci` or per-tool images

**DAST scans (Nuclei):**
- Run AFTER deployment to staging/production
- Require a running application URL
- Triggered manually or on schedule
- Use `agent:nuclei` image

### GitHub Actions

**Option 1: Use OpenCTEM's reusable workflow:**

```yaml
name: Security Scan
on: [push, pull_request]

jobs:
  security:
    uses: openctemio/agent/.github/workflows/openctem-security.yml@main
    with:
      tools: "semgrep,gitleaks,trivy"
      fail_on: "high"
    secrets:
      api_url: ${{ secrets.API_URL }}
      api_key: ${{ secrets.API_KEY }}

  # Or use individual scan types:
  # sast:
  #   uses: openctemio/agent/.github/workflows/openctem-security.yml@main
  #   with:
  #     scan_type: "sast"
  #     fail_on: "high"
```

**Option 2: Use composite action:**

```yaml
name: Security Scan
on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      security-events: write
    steps:
      - uses: actions/checkout@v4

      - name: Security Scan
        uses: openctemio/agent/ci/github@main
        with:
          tools: semgrep,gitleaks,trivy
          fail_on: high
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          API_URL: ${{ secrets.API_URL }}
          API_KEY: ${{ secrets.API_KEY }}
```

**Option 3: Direct Docker usage:**

```yaml
name: Security Scan
on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      security-events: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run Security Scan
        uses: docker://openctemio/agent:ci
        with:
          args: >-
            -tools semgrep,gitleaks,trivy
            -target .
            -auto-ci
            -comments
            -push
            -verbose
            -fail-on high
            -output-format sarif
            -output results.sarif
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          API_URL: ${{ secrets.API_URL }}
          API_KEY: ${{ secrets.API_KEY }}

      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: results.sarif
```

**Key flags explained:**
- `-fail-on high`: Fails the pipeline if any high or critical findings
- `-comments`: Posts inline comments on PR for each finding
- `-output-format sarif`: SARIF 2.1.0 for GitHub Security tab (includes `codeFlows` for attack path visualization)
- `-auto-ci`: Auto-detects GitHub Actions environment

### GitLab CI

**Option 1: Use OpenCTEM's reusable template:**

```yaml
include:
  - remote: 'https://raw.githubusercontent.com/openctemio/agent/main/ci/gitlab/openctem-security.yml'

stages:
  - security

# Full scan (all tools)
security:
  extends: .openctem-full-scan
  variables:
    FAIL_ON: "high"

# Or use individual scans in parallel (faster):
# sast:
#   extends: .openctem-sast
# secrets:
#   extends: .openctem-secrets
# sca:
#   extends: .openctem-sca
```

**Option 2: Custom configuration:**

```yaml
stages:
  - security

security-scan:
  stage: security
  image: openctemio/agent:ci
  variables:
    GITLAB_TOKEN: $CI_JOB_TOKEN
    API_URL: $API_URL
    API_KEY: $API_KEY
  script:
    - |
      agent \
        -tools semgrep,gitleaks,trivy \
        -target . \
        -auto-ci \
        -comments \
        -push \
        -verbose \
        -fail-on high \
        -output-format sarif \
        -output gl-sast-report.json
  artifacts:
    reports:
      sast: gl-sast-report.json
  allow_failure:
    exit_codes:
      - 1  # Allow security gate failures to be visible but not block
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

**Key flags explained:**
- `-fail-on high`: Exit code 1 if high/critical findings (shows warning in GitLab)
- `-comments`: Posts inline comments on MR for each finding
- `-output-format sarif`: SARIF output for GitLab Security Dashboard
- `allow_failure: exit_codes: [1]`: Shows warning but doesn't block pipeline

### Understanding GitLab `extends` Keyword

The `extends` keyword in GitLab CI allows you to inherit configuration from a template (hidden job starting with `.`). This is how OpenCTEM templates work:

```yaml
# Template definition (provided by OpenCTEM)
.openctem-sast:
  stage: security
  image: openctemio/agent:semgrep
  variables:
    PUSH: "true"
    FAIL_ON: "critical"
  script:
    - agent -tool semgrep -target . ...

# Your job extends the template
sast:
  extends: .openctem-sast
```

**Key Points:**
- `extends` copies all configuration from the template
- You can override any setting by redefining it in your job
- Variables, script, rules, artifacts are all inherited and overridable

**Override Examples:**

```yaml
# Override severity threshold
sast:
  extends: .openctem-sast
  variables:
    FAIL_ON: "high"          # Override: fail on high+ (not just critical)
    PUSH: "false"            # Override: scan-only mode

# Override rules (only run on specific branches)
sast:
  extends: .openctem-sast
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
    - if: $CI_COMMIT_BRANCH == "develop"

# Add custom before_script
sast:
  extends: .openctem-sast
  before_script:
    - echo "Running custom setup..."
    - npm install

# Use different image version
sast:
  extends: .openctem-sast
  image: openctemio/agent:semgrep@sha256:abc123...  # Pin specific version
```

**Deep Merge Behavior:**

GitLab performs deep merge for hashes (like `variables`), but replaces arrays (like `script`):

```yaml
# Parent template
.openctem-sast:
  variables:
    PUSH: "true"
    FAIL_ON: "critical"
    VERBOSE: "false"

# Your job
sast:
  extends: .openctem-sast
  variables:
    FAIL_ON: "high"    # Override this one
    # PUSH and VERBOSE are inherited from template
```

### Reusable CI Templates

OpenCTEM provides pre-built templates for quick integration:

| Platform | Template Location | Description |
|----------|-------------------|-------------|
| GitHub Actions | `openctemio/agent/.github/workflows/openctem-security.yml` | Single job workflow |
| GitHub Actions | `openctemio/agent/.github/workflows/parallel-security.yml` | **Parallel jobs (fastest)** |
| GitHub Actions | `openctemio/agent/ci/github/action.yml` | Composite action |
| GitLab CI | `ci/gitlab/openctem-security.yml` | Include templates |
| GitLab CI | `ci/gitlab/parallel-security.yml` | **Parallel jobs (fastest)** |

**Available GitLab Templates:**

| Template | Image | Description |
|----------|-------|-------------|
| `.openctem-sast` | `openctemio/agent:semgrep` | SAST scanning with Semgrep |
| `.openctem-sca` | `openctemio/agent:trivy` | SCA with fresh Trivy DB |
| `.openctem-sca-fast` | `openctemio/agent:trivy-ci` | SCA with pre-loaded DB (faster) |
| `.openctem-secrets` | `openctemio/agent:gitleaks` | Secret detection |
| `.openctem-iac` | `openctemio/agent:trivy` | IaC misconfiguration |
| `.openctem-container` | `openctemio/agent:trivy` | Container image scanning |
| `.openctem-full-scan` | `openctemio/agent:ci` | All CI tools in one job |

> **Note about DAST**: `.openctem-dast` uses a separate `dast` stage (not `security`) and runs manually after deployment. DAST scans require a running application.

### CI Features

| Feature | Flag | Description |
|---------|------|-------------|
| Auto CI detection | `-auto-ci` | Detects GitHub/GitLab automatically |
| Inline comments | `-comments` | Posts findings as PR/MR comments (max 10 by default) |
| Security gate | `-fail-on` | Fail pipeline on severity threshold |
| Push to platform | `-push` | Sends results to OpenCTEM |
| SARIF output | `-output-format sarif` | Generates SARIF 2.1.0 for security dashboards |
| JSON output | `-output-format json` | Machine-readable JSON output |
| Diff-based scan | Automatic | Only scans changed files in PR/MR |

### CI/CD Template Variables

Both GitHub Actions and GitLab CI templates support these configuration variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PUSH` | `"true"` | Push results to OpenCTEM platform. Set `"false"` for testing or scan-only mode |
| `COMMENTS` | `"true"` | Post findings as PR/MR comments |
| `FAIL_ON` | `"critical"` | Security gate threshold (critical, high, medium, low) |
| `VERBOSE` | `"false"` | Enable verbose output for debugging |

**Smart Defaults:**
- If `PUSH` is `"true"` but `API_KEY` is not set, push is automatically disabled (scan-only mode)
- This allows testing CI integration without configuring platform credentials

**Example: Scan-only mode (testing without platform)**

```yaml
# GitLab
sast:
  extends: .openctem-sast
  variables:
    PUSH: "false"      # Disable push for testing
    FAIL_ON: "high"    # Still enforce security gate

# GitHub Actions
- uses: openctemio/agent/.github/workflows/openctem-security.yml@main
  with:
    push: false        # Disable push for testing
    fail_on: "high"
```

### PR/MR Comments

When running with `-comments` flag in a PR/MR context, the agent will:
1. Detect the CI environment (GitHub Actions, GitLab CI)
2. Filter findings to only those on changed files
3. Create inline comments on the exact lines with issues
4. Limit to 10 comments by default to avoid spam

```bash
# Enable PR comments
agent -tools semgrep,gitleaks -target . -push -comments -auto-ci
```

**Requirements:**
- `GITHUB_TOKEN` for GitHub Actions (usually `${{ secrets.GITHUB_TOKEN }}`)
- `GITLAB_TOKEN` for GitLab CI (usually `$CI_JOB_TOKEN`)

### Parallel Scanning (Recommended)

Running scans in parallel is **2-3x faster** than sequential scanning:
- Sequential: `time = sast + secrets + sca` (~5-10 min)
- Parallel: `time = max(sast, secrets, sca)` (~2-4 min)

**GitHub Actions - Parallel (Simplest):**

```yaml
name: Security
on: [push, pull_request]

jobs:
  security:
    uses: openctemio/agent/.github/workflows/parallel-security.yml@main
    with:
      fail_on: "high"
    secrets:
      api_url: ${{ secrets.API_URL }}
      api_key: ${{ secrets.API_KEY }}
```

**GitLab CI - Parallel (Simplest):**

```yaml
include:
  - remote: 'https://raw.githubusercontent.com/openctemio/agent/main/ci/gitlab/parallel-security.yml'

stages:
  - security

variables:
  FAIL_ON: "high"

# Jobs.openctem-sast,.openctem-secrets,.openctem-sca run automatically in parallel
```

**GitHub Actions - Parallel (Custom):**

```yaml
name: Security Scan (Parallel)
on: [push, pull_request]

jobs:
  sast:
    runs-on: ubuntu-latest
    container: openctemio/agent:semgrep
    steps:
      - uses: actions/checkout@v4
      - run: agent -tool semgrep -target . -push -auto-ci -comments -fail-on high
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          API_URL: ${{ secrets.API_URL }}
          API_KEY: ${{ secrets.API_KEY }}

  secrets:
    runs-on: ubuntu-latest
    container: openctemio/agent:gitleaks
    steps:
      - uses: actions/checkout@v4
      - run: agent -tool gitleaks -target . -push -auto-ci -comments -fail-on critical
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          API_URL: ${{ secrets.API_URL }}
          API_KEY: ${{ secrets.API_KEY }}

  sca:
    runs-on: ubuntu-latest
    container: openctemio/agent:trivy
    steps:
      - uses: actions/checkout@v4
      - run: agent -tool trivy -target . -push -auto-ci -fail-on critical
        env:
          API_URL: ${{ secrets.API_URL }}
          API_KEY: ${{ secrets.API_KEY }}

  # DAST runs separately after deployment (not in PR checks)
  dast:
    runs-on: ubuntu-latest
    container: openctemio/agent:nuclei
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - run: agent -tool nuclei -target https://staging.example.com -push
        env:
          API_URL: ${{ secrets.API_URL }}
          API_KEY: ${{ secrets.API_KEY }}
```

**GitLab CI - Parallel:**

```yaml
stages:
  - security

sast:
  stage: security
  image: openctemio/agent:semgrep
  script:
    - agent -tool semgrep -target . -push -auto-ci -comments -fail-on high
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

secrets:
  stage: security
  image: openctemio/agent:gitleaks
  script:
    - agent -tool gitleaks -target . -push -auto-ci -comments
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

sca:
  stage: security
  image: openctemio/agent:trivy
  script:
    - agent -tool trivy -target . -push -auto-ci -fail-on critical
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

---

## Docker Images

### Available Images

**CI Images (for PR/MR scanning):**

| Image | Size | Tools | Use Case |
|-------|------|-------|----------|
| `openctemio/agent:ci` | ~600MB | semgrep + gitleaks + trivy | Full CI pipeline (recommended) |
| `openctemio/agent:ci-cached` | ~700MB | + preloaded Trivy DB | Faster CI (rebuild weekly) |
| `openctemio/agent:semgrep` | ~400MB | Semgrep only | SAST scanning |
| `openctemio/agent:gitleaks` | ~50MB | Gitleaks only | Secrets detection |
| `openctemio/agent:trivy` | ~100MB | Trivy only | SCA/IaC/Container |
| `openctemio/agent:trivy-ci` | ~500MB | Trivy + preloaded DB | Fast SCA (no DB download) |

**DAST Image (separate from CI, runs after deployment):**

| Image | Size | Tools | Use Case |
|-------|------|-------|----------|
| `openctemio/agent:nuclei` | ~100MB | Nuclei only | DAST against staging/production |

**Development & Platform Images:**

| Image | Size | Tools | Use Case |
|-------|------|-------|----------|
| `openctemio/agent:slim` | ~20MB | Agent only (distroless) | Custom tool integration |
| `openctemio/agent:full` | ~800MB | All tools including Nuclei | Local development |
| `openctemio/agent:platform` | ~800MB | All tools + platform mode | Platform-managed agents |
| `openctemio/agent:latest` | ~800MB | Alias for `full` | Default |

> **Note**: CI images do NOT include Nuclei because DAST requires a running application and should run in a separate stage after deployment, not during PR checks.

### Build Custom Images

Per-tool images use separate Dockerfiles for better maintainability:

```bash
# Build per-tool images (from separate Dockerfiles)
docker build -f Dockerfile.semgrep -t openctemio/agent:semgrep .
docker build -f Dockerfile.gitleaks -t openctemio/agent:gitleaks .
docker build -f Dockerfile.trivy -t openctemio/agent:trivy .
docker build -f Dockerfile.trivy --target trivy-ci -t openctemio/agent:trivy-ci .
docker build -f Dockerfile.nuclei -t openctemio/agent:nuclei .

# Build combined images (from main Dockerfile)
docker build --target slim -t openctemio/agent:slim .
docker build --target full -t openctemio/agent:latest .
docker build --target ci -t openctemio/agent:ci .
```

**Dockerfile structure:**
- `Dockerfile` - Main file with builder stages and combined images (slim, full, ci, platform)
- `Dockerfile.semgrep` - Agent + Semgrep (~400MB)
- `Dockerfile.gitleaks` - Agent + Gitleaks (~50MB)
- `Dockerfile.trivy` - Agent + Trivy with optional trivy-ci target (~100-500MB)
- `Dockerfile.nuclei` - Agent + Nuclei (~100MB)

---

## Docker Usage

### Basic Scan

```bash
docker run --rm -v $(pwd):/scan openctemio/agent:latest \
    -tools semgrep,gitleaks,trivy \
    -target /scan \
    -verbose
```

### Per-Tool Scans

```bash
# SAST with Semgrep
docker run --rm -v $(pwd):/scan openctemio/agent:semgrep \
    -tool semgrep -target /scan -verbose

# Secrets with Gitleaks
docker run --rm -v $(pwd):/scan openctemio/agent:gitleaks \
    -tool gitleaks -target /scan -verbose

# SCA with Trivy (pre-loaded DB for speed)
docker run --rm -v $(pwd):/scan openctemio/agent:trivy-ci \
    -tool trivy -target /scan -verbose

# DAST with Nuclei
docker run --rm openctemio/agent:nuclei \
    -tool nuclei -target https://example.com -verbose
```

### With API Push

```bash
docker run --rm \
    -v $(pwd):/scan \
    -e API_URL=https://api.openctem.io \
    -e API_KEY=rdw_your_api_key \
    openctemio/agent:latest \
    -tools semgrep,gitleaks,trivy \
    -target /scan \
    -push
```

### Docker Compose

```yaml
version: '3.8'
services:
  agent:
    image: openctemio/agent:latest
    volumes:
      - ./:/scan:ro
      - ./agent.yaml:/app/agent.yaml
    environment:
      - API_KEY=${API_KEY}
    command: -daemon -config /app/agent.yaml
```

---

## Running as a Service

### Systemd

Create `/etc/systemd/system/openctem-agent.service`:

```ini
[Unit]
Description=OpenCTEM Security Scanner Agent
After=network.target

[Service]
Type=simple
User.openctem
Group.openctem
WorkingDirectory=/opt.openctem
ExecStart=/opt/openctem/agent -daemon -config /opt/openctem/agent.yaml
Restart=always
RestartSec=10
Environment=API_KEY=rdw_your_api_key

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable openctem-agent
sudo systemctl start openctem-agent
```

### Check Service Status

```bash
sudo systemctl status openctem-agent
journalctl -u openctem-agent -f
```

---

## Troubleshooting

### Agent Shows "Inactive"

Agents become inactive if no heartbeat is received for 5 minutes.

**Causes:**
- Agent not running
- API key invalid
- Network issues

**Solutions:**
1. Check agent is running: `ps aux | grep agent`
2. Check logs for errors
3. Verify API key is correct
4. Restart the agent

### 401 Unauthorized

- API key is invalid or revoked
- Regenerate key in UI: Agents > ... > Regenerate API Key

### Findings Not Appearing

**Most common cause**: Missing `-push` flag!

```bash
# WRONG
./agent -config agent.yaml

# CORRECT
./agent -config agent.yaml -push
```

Other causes:
- Check for "Pushed: X created" in output
- Verify API connection with `-verbose`
- Ensure asset exists in OpenCTEM

### Tool Not Found

```bash
# Check tool installation
./agent -check-tools

# Install missing tools
./agent -install-tools
```

---

## Tool Auto-Update Mechanism

Each scanner tool has different update mechanisms for rules/databases:

| Tool | What Updates | When | In Docker |
|------|--------------|------|-----------|
| **Semgrep** | Rules from [Semgrep Registry](https://semgrep.dev/docs/running-rules) | Every scan | Auto (needs network) |
| **Trivy** | Vuln DB from [GHCR](https://trivy.dev/docs/latest/configuration/db/) | Every 6 hours | Auto-download on first use |
| **Gitleaks** | Rules embedded in binary | On version update | Pull latest image |
| **Nuclei** | [Templates from GitHub](https://docs.projectdiscovery.io/opensource/nuclei/running) | On first run or `-update-templates` | Auto (needs network) |

### Keeping Tools Updated

**Semgrep**: No action needed. Rules are fetched from the registry on every scan.

**Trivy**: DB auto-updates. For faster CI with preloaded DB:
```bash
# Use trivy-ci image (rebuild weekly to keep DB fresh)
docker pull openctemio/agent:trivy-ci
```

**Gitleaks**: Pull latest image to get new detection rules:
```bash
docker pull openctemio/agent:gitleaks
```

**Nuclei**: Templates auto-update, or force update:
```bash
nuclei -update-templates
```

---

## Build Modes

The agent supports different build modes for different use cases.

### Standard Build (Default)

```bash
go build -o agent ./agent/
```

- CLI-only mode, spawns external processes for each tool
- No external library dependencies
- Best for: CI/CD, lightweight deployments

### Hybrid Build

```bash
go build -tags hybrid -o agent ./agent/
```

- Uses Go libraries directly when available (subfinder, dnsx, naabu, httpx, katana)
- Falls back to CLI for tools without library support
- Lower process overhead, faster execution
- Best for: High-volume scanning, memory-constrained environments

**Hybrid Configuration:**

```yaml
recon:
  use_hybrid_mode: true
  prefer_library: true    # Use library when available
  subfinder_use_lib: true
  dnsx_use_lib: true
  naabu_use_lib: true
  httpx_use_lib: true
  katana_use_lib: true
```

### Platform Build

```bash
go build -tags platform -o agent ./agent/
```

- Enables `-platform` flag for managed agent mode
- Supports bootstrap token registration
- Automatic job polling and lease renewal
- Best for: Platform-managed deployments

### Full Build (Platform + Hybrid)

```bash
go build -tags "platform,hybrid" -o agent ./agent/
```

- All features enabled
- Best for: Enterprise deployments

---

## Platform Agent Mode

Platform mode enables the agent to be managed by the OpenCTEM platform, receiving jobs remotely and reporting results automatically.

### Registration with Bootstrap Token

```bash
# First-time registration
./agent -platform \
  -api-url https://api.openctem.io \
  -bootstrap-token abc123.xxxxxxxx \
  -region us-east-1 \
  -enable-recon \
  -enable-vulnscan

# Subsequent runs (uses stored credentials)
./agent -platform \
  -api-url https://api.openctem.io \
  -region us-east-1
```

### Platform Agent Configuration

```yaml
# platform-agent.yaml
platform:
  api_url: https://api.openctem.io
  credentials_file: ~/.openctem/agent-credentials.json
  region: us-east-1
  max_concurrent: 5

executors:
  recon:
    enabled: true
    use_hybrid_mode: true
  vulnscan:
    enabled: true
  secrets:
    enabled: false
  assets:
    enabled: false
```

### Job Types

The platform can dispatch these job types:

| Job Type | Routed To | Description |
|----------|-----------|-------------|
| `recon`, `subdomain`, `dns`, `portscan`, `http`, `crawler` | Recon Executor | External attack surface discovery |
| `scan`, `vulnscan`, `sast`, `sca`, `dast`, `container`, `iac` | VulnScan Executor | Vulnerability scanning |
| `secret`, `secrets` | Secrets Executor | Secret detection |
| `collect`, `assets`, `cloud` | Assets Executor | Asset collection |
| `pipeline` | Pipeline Executor | Workflow orchestration |

---

## Executor Reference

### Recon Executor

Discovers external attack surface assets.

**Capabilities:** `subdomain`, `dns`, `portscan`, `http`, `tech-detect`, `crawler`, `url-discovery`

**Tools:**
- **subfinder**: Passive subdomain enumeration using multiple sources
- **dnsx**: DNS resolution with A, AAAA, CNAME, MX, NS, TXT records
- **naabu**: Fast SYN/CONNECT port scanning
- **httpx**: HTTP probing with status codes, titles, tech detection
- **katana**: Web crawling and JavaScript parsing

**Example Job:**

```json
{
  "type": "recon",
  "payload": {
    "target": "example.com",
    "tools": ["subfinder", "dnsx", "httpx"],
    "options": {
      "resolve": true,
      "tech_detect": true
    }
  }
}
```

### VulnScan Executor

Scans for vulnerabilities across different security domains.

**Capabilities:** `sast`, `sca`, `dast`, `container`, `iac`, `misconfiguration`

**Tools:**
- **nuclei**: Template-based DAST scanning
- **trivy**: SCA vulnerability scanning (filesystem, image, config)
- **semgrep**: SAST with dataflow/taint tracking

**Example Job:**

```json
{
  "type": "vulnscan",
  "payload": {
    "scanner": "semgrep",
    "target": "/path/to/project",
    "options": {
      "config": ["p/security-audit", "p/owasp-top-ten"],
      "dataflow_traces": true
    }
  }
}
```

> **Note:** `dataflow_traces` is enabled by default. Set to `false` to disable taint tracking (faster but no attack path info).

---

## CTIS Output Format

All executors output findings in **CTIS (CTEM Ingest Schema)** format:

```json
{
  "schema_version": "1.0",
  "tool": {
    "name": "semgrep",
    "version": "1.0.0"
  },
  "assets": [
    {
      "type": "repository",
      "value": "github.com/org/repo"
    }
  ],
  "findings": [
    {
      "id": "finding-1",
      "type": "vulnerability",
      "title": "SQL Injection",
      "severity": "critical",
      "rule_id": "CWE-89",
      "location": {
        "path": "src/db/query.go",
        "start_line": 45
      }
    }
  ]
}
```

---

## Using SDK Scanners Directly

For custom integrations, you can use the SDK scanners directly instead of the agent binary:

```go
import (
    "context"
    "github.com/openctemio/sdk-go/pkg/scanners/recon/subfinder"
    "github.com/openctemio/sdk-go/pkg/scanners/semgrep"
    "github.com/openctemio/sdk-go/pkg/enrichers/epss"
)

func main() {
    ctx := context.Background()

    // Recon scanning
    subScanner := subfinder.NewScanner()
    result, _ := subScanner.Scan(ctx, "example.com", nil)
    fmt.Printf("Found %d subdomains\n", len(result.Subdomains))

    // SAST scanning
    sastScanner := semgrep.NewScanner()
    findings, _ := sastScanner.ScanToFindings(ctx, "./src", nil)

    // Enrich with threat intelligence
    enricher := epss.NewEnricher()
    enriched, _ := enricher.EnrichBatch(ctx, findings)
}
```

See the [SDK Development Guide](sdk-development.md) for detailed SDK usage.

---

## Next Steps

- **[Running Agents](running-agents.md)** - Create agents in OpenCTEM UI
- **[SDK Quick Start](sdk-quick-start.md)** - Use SDK directly
- **[SDK Development](sdk-development.md)** - Build custom scanners and collectors
- **[Custom Tools Development](custom-tools-development.md)** - Build your own tools
- **[Platform Administration](platform-admin.md)** - Manage platform agents
{% endraw %}
