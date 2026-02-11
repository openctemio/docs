---
layout: default
title: End-to-End Workflow
parent: Platform Guides
nav_order: 1
---
{% raw %}

# End-to-End Workflow: Scanning a Repository

This guide walks you through a **complete security scan workflow** from creating an asset in the UI to viewing results.

---

## Workflow Overview

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│   UI    │───▶│   API   │───▶│  Agent  │───▶│ Scanner │───▶│ Results │
│ (Web)   │    │ (REST)  │    │ (CLI)   │    │ (Tools) │    │  (UI)   │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │              │              │              │
     │ 1. Create    │ 2. Register  │ 3. Scan      │ 4. Parse     │ 5. Display
     │    Asset     │    Agent     │    Code      │    Results   │    Findings
```

**Steps:**
1. **UI** - Configure repository asset
2. **API** - Register agent and manage metadata
3. **Agent** - Execute security scanners
4. **Scanner** - Run tools (Semgrep, Gitleaks, Trivy)
5. **Results** - View and remediate in UI

---

## Step 1: Configure Repository Asset

### 1.1 Login to the UI

Navigate to [http://localhost:3000](http://localhost:3000)

**Default credentials:**
- Email: `admin@openctem.io`
- Password: `Admin123!`

### 1.2 Add a Repository

1. Go to **Assets → Repositories**
2. Click **"Add Repository"**
3. Fill in details:
   - **Repository URL:** `github.com/myorg/myrepo`
   - **Criticality:** `High` (for important codebases)
   - **Owner:** `Security Team`
   - **Tags:** `backend`, `production`

4. Click **"Save"**

**What happens:**
- Asset record created in PostgreSQL
- Assigned a unique asset ID
- Available for scan targeting

---

## Step 2: Create or Use an Agent

### 2.1 Navigate to Agents

1. Go to **Settings → Agents**
2. Click **"Create Agent"**

### 2.2 Configure Agent

**Agent Details:**
- **Name:** `github-actions-runner-001`
- **Type:** `Runner` (for CI/CD) or `Worker` (for daemon mode)
- **Description:** `GitHub Actions security scanner`

**Copy the API Key** - you'll need this in Step 3.

### 2.3 Agent Types Explained

| Type | Mode | Use Case |
|------|------|----------|
| **Runner** | One-shot | CI/CD pipelines (GitHub Actions, GitLab CI) |
| **Worker** | Daemon | Server-controlled, polls for commands |
| **Collector** | Daemon | Infrastructure inventory collection |

---

## Step 3: Run Security Scan

You have **3 options** for running scans:

### Option A: Docker (Quickest)

```bash
docker run --rm \
  -v $(pwd):/scan \
  -e API_URL=http://localhost:8080 \
  -e API_KEY=your-api-key-here \
  openctemio/agent:latest \
  -tools semgrep,gitleaks,trivy -target /scan -push -verbose
```

**Replace:**
- `your-api-key-here` with the API key from Step 2
- `/scan` maps your current directory into the container

---

### Option B: Binary (If Installed)

```bash
# Set environment variables
export API_URL=http://localhost:8080
export API_KEY=your-api-key-here

# Navigate to your code
cd /path/to/your/repository

# Run scan
agent -tools semgrep,gitleaks,trivy -target . -push -verbose
```

---

### Option C: CI/CD Integration (GitHub Actions)

Create `.github/workflows/security-scan.yml`:

```yaml
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run OpenCTEM Scan
        uses: docker://openctemio/agent:ci
        env:
          API_URL: ${{ secrets.OPENCTEM_API_URL }}
          API_KEY: ${{ secrets.OPENCTEM_API_KEY }}
        with:
          args: -tools semgrep,gitleaks,trivy -target . -push -comments
```

**Required Secrets:**
- `OPENCTEM_API_URL` - Your API endpoint
- `OPENCTEM_API_KEY` - Agent API key from Step 2

---

## Step 4: View Results

### 4.1 Navigate to Findings

1. Go to **Findings** in the UI
2. You'll see the scan results appearing in real-time

### 4.2 Filter Results

Use filters to narrow down:
- **Repository:** Select your repository from Step 1
- **Severity:** `Critical`, `High`, `Medium`, `Low`
- **Type:** `Vulnerability`, `Secret`, `Misconfiguration`
- **Status:** `Open`, `In Progress`, `Resolved`

### 4.3 Review a Finding

Click on any finding to see:
- **Title & Description** - What was found
- **Location** - File path and line numbers
- **Severity** - Risk level
- **CWE/CVE** - Classification
- **Remediation** - How to fix it
- **Data Flow** - Taint tracking (for SAST findings)

### 4.4 Take Action

For each finding, you can:
- **Assign** to a team member
- **Set Status** - Mark as `In Progress`, `Resolved`, or `False Positive`
- **Add Comments** - Discuss with team
- **Create Ticket** - Export to Jira/Linear (if integrated)

---

## Step 5: Remediate & Rescan

### 5.1 Fix the Vulnerability

Based on the remediation advice:
1. Update the vulnerable code
2. Commit the fix
3. Push to repository

### 5.2 Verify Fix

Re-run the scan:

```bash
agent -tools semgrep,gitleaks,trivy -target . -push
```

### 5.3 Check Results

- If the vulnerability is truly fixed, it will:
  - **Disappear** from new scans (Gitleaks, Trivy)
  - **Auto-resolve** in the UI (for deduplication-enabled findings)

- If it persists:
  - Review remediation steps
  - Check if the fix was applied correctly

---

## What's Happening Under the Hood?

### Data Flow Breakdown

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Agent Execution                                            │
├──────────────────────────────────────────────────────────────┤
│ agent -tools semgrep,gitleaks,trivy -target /code -push      │
│   ↓                                                           │
│ • Runs Semgrep → JSON output                                 │
│ • Runs Gitleaks → JSON output                                │
│ • Runs Trivy → JSON output                                   │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. Parser (CTIS Conversion)                                     │
├──────────────────────────────────────────────────────────────┤
│ • Semgrep JSON → CTIS Report                                   │
│ • Gitleaks JSON → CTIS Report                                  │
│ • Trivy JSON → CTIS Report                                     │
│ • Generate fingerprints for deduplication                     │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. API Ingestion (HTTP POST)                                  │
├──────────────────────────────────────────────────────────────┤
│ POST /api/v1/ingest/findings                                  │
│   Headers:                                                    │
│     Authorization: Bearer {api_key}                           │
│   Body:                                                       │
│     {                                                         │
│       "version": "1.0",                                       │
│       "findings": [...],                                      │
│       "assets": [...]                                         │
│     }                                                         │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. Backend Processing                                          │
├──────────────────────────────────────────────────────────────┤
│ • Validate JWT token                                          │
│ • Extract tenant_id from token                                │
│ • Deduplicate by fingerprint                                  │
│ • Create new findings (INSERT)                                │
│ • Update existing findings (UPDATE)                           │
│ • Store in PostgreSQL                                         │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. UI Display                                                  │
├──────────────────────────────────────────────────────────────┤
│ GET /api/v1/findings?page=1&severity=high                     │
│   ↓                                                           │
│ • API returns paginated findings                              │
│ • UI renders table with filters                              │
│ • Real-time updates via polling/webhooks                      │
└──────────────────────────────────────────────────────────────┘
```

---

## Advanced Scenarios

### Scenario 1: Scheduled Scanning (Daemon Mode)

For continuous monitoring, run the agent as a **daemon**:

```bash
agent -daemon -config agent.yaml
```

**agent.yaml:**
```yaml
agent:
  name: production-scanner
  enable_commands: true
  heartbeat_interval: 1m

server:
  base_url: https://api.openctem.io
  api_key: your-api-key

scanners:
  - name: semgrep
    enabled: true
  - name: gitleaks
    enabled: true
  - name: trivy-fs
    enabled: true

targets:
  - /app/backend
  - /app/frontend
```

The agent will:
- Poll the server for scan commands
- Execute scans on schedule
- Auto-push results

---

### Scenario 2: Multi-Repo Scanning

Scan multiple repositories in a CI/CD matrix:

```yaml
# .github/workflows/security.yml
jobs:
  scan:
    strategy:
      matrix:
        repo: [backend, frontend, api, worker]
    steps:
      - uses: actions/checkout@v4
        with:
          repository: myorg/${{ matrix.repo }}

      - name: Scan
        uses: docker://openctemio/agent:ci
        # ... (scan steps)
```

---

### Scenario 3: Custom Scanner Integration

Build a custom scanner with the SDK:

```go
// custom-scanner/main.go
package main

import (
    "github.com/openctemio/sdk-go/pkg/client"
    "github.com/openctemio/sdk-go/pkg/core"
    "github.com/openctemio/sdk-go/pkg/ctis"
)

func main() {
    // Run your custom scanner
    results := runMyScanner("./src")

    // Convert to CTIS
    report := convertToCTIS(results)

    // Push to platform
    apiClient := client.New(&client.Config{
        BaseURL: "https://api.openctem.io",
        APIKey:  os.Getenv("API_KEY"),
    })

    apiClient.PushFindings(context.Background(), report)
}
```

See [SDK Documentation](https://github.com/openctemio/sdk-go#readme) for details.

---

## Common Issues

### "No findings found"

**Possible reasons:**
- ✅ Code is clean (yay!)
- ❌ Scanner not installed
- ❌ Rules not matching

**Debug:**
```bash
# Check scanners are installed
agent -check-tools

# Run with verbose logging
agent -tools semgrep -target . -verbose
```

---

### "Connection refused to API"

**For Docker:**
```bash
# On Mac/Windows, use host.docker.internal
export API_URL=http://host.docker.internal:8080
```

**For Linux:**
```bash
# Use host network mode
docker run --network=host ...
```

---

### "Results not appearing in UI"

**Checklist:**
1. Check agent logs for errors
2. Verify `-push` flag is used
3. Check API is accessible: `curl $API_URL/health`
4. Verify agent API key is valid
5. Check PostgreSQL is running

---

## Next Steps

- **[Production Deployment](../operations/PRODUCTION_DEPLOYMENT.md)** - Deploy to Kubernetes/Cloud
- **[Agent Configuration](https://github.com/openctemio/agent#configuration)** - Advanced agent.yaml options
- **[API Reference](../backend/api-reference.md)** - Full API documentation
- **[SDK Guide](https://github.com/openctemio/sdk-go#readme)** - Build custom tools

---

**Ready to secure your code? Start scanning! 🔒**
{% endraw %}
