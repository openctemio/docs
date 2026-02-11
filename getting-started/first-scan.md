---
layout: default
title: First Scan Tutorial
parent: Getting Started
nav_order: 2
---

# Run Your First Scan

Complete tutorial to set up an agent and scan your first repository.

---

## Overview

This tutorial walks you through:
1. Creating an agent in the UI
2. Running the agent to scan a repository
3. Viewing and managing findings

**Time required:** 10 minutes

---

## Step 1: Create an Agent

### 1.1 Navigate to Agents

1. Login to the UI at [http://localhost:3000](http://localhost:3000)
2. Go to **Settings → Agents**
3. Click **"Add Agent"**

### 1.2 Configure the Agent

| Field | Value | Description |
|-------|-------|-------------|
| **Type** | Runner | One-shot scans (CI/CD) |
| **Name** | my-first-agent | Display name |
| **Execution Mode** | Standalone | Single run and exit |
| **Capabilities** | SAST, SCA, Secrets | What this agent can do |
| **Tools** | Semgrep, Trivy, Gitleaks | Enabled scanners |

### 1.3 Copy the API Key

After creating the agent, you'll see a dialog with the **API Key**.

⚠️ **Important:** Copy this key now! It's only shown once.

```
API Key: oc_live_xxxxxxxxxxxxxxxxxxxxxx
```

---

## Step 2: Run the Agent

### Option A: Docker (Recommended)

```bash
# Navigate to your project directory
cd /path/to/your/project

# Run the agent
docker run --rm \
  -v $(pwd):/scan \
  -e API_URL=http://host.docker.internal:8080 \
  -e API_KEY=oc_live_your_key_here \
  openctemio/agent:latest \
  -tools semgrep,gitleaks,trivy \
  -target /scan \
  -push \
  -verbose
```

**Flags explained:**

| Flag | Purpose |
|------|---------|
| `-tools` | Scanners to run (comma-separated) |
| `-target` | Path to scan |
| `-push` | Send results to platform |
| `-verbose` | Show detailed output |

### Option B: Binary

```bash
# Download the agent binary
curl -LO https://github.com/openctemio/agent/releases/latest/download/agent-linux-amd64
chmod +x agent-linux-amd64

# Run scan
./agent-linux-amd64 \
  -api-url http://localhost:8080 \
  -api-key oc_live_your_key_here \
  -tools semgrep,gitleaks,trivy \
  -target . \
  -push
```

---

## Step 3: View Results

### 3.1 Check Agent Status

Go to **Settings → Agents** and verify:
- Status shows **Online** (green badge)
- Last heartbeat is recent

### 3.2 View Findings

1. Navigate to **Findings** in the main menu
2. Filter by your agent or repository
3. You'll see a table of discovered vulnerabilities

**Finding details include:**

| Field | Description |
|-------|-------------|
| **Title** | Vulnerability name |
| **Severity** | Critical / High / Medium / Low / Info |
| **Location** | File path and line number |
| **Tool** | Scanner that found it |
| **Status** | Open / Acknowledged / Fixed / Ignored |

### 3.3 Manage a Finding

Click on a finding to:
- View full details and code snippet
- Change status (Acknowledge, Fix, Ignore)
- Add comments
- Assign to team member
- Set due date

---

## Checking Tools Installation

Before running scans, verify scanners are installed:

```bash
# Check installation status
agent -check-tools

# Output:
#   ✓ semgrep      SAST scanner with dataflow/taint tracking (installed: 1.90.0)
#   ✓ gitleaks     Secret detection scanner (installed: 8.28.0)
#   ✓ trivy        SCA/Container/IaC scanner (installed: 0.67.2)
#   ✗ nuclei       Vulnerability scanner (DAST) (NOT INSTALLED)
```

Install missing tools interactively:

```bash
agent -install-tools
```

---

## Available Scanners

| Tool | Type | What it detects |
|------|------|-----------------|
| **Semgrep** | SAST | Code vulnerabilities, injection flaws |
| **Trivy** | SCA | Package vulnerabilities, outdated deps |
| **Gitleaks** | Secrets | API keys, passwords, tokens |
| **Trivy-Config** | IaC | Infrastructure misconfigurations |
| **Trivy-Image** | Container | Container image vulnerabilities |
| **Nuclei** | DAST | Web vulnerabilities, CVEs |

---

## Example Output

Successful scan output:

```
[INFO] Starting scan with tools: semgrep, gitleaks, trivy
[INFO] Target: /scan
[INFO] Running semgrep...
[INFO] Found 12 findings (2 high, 5 medium, 5 low)
[INFO] Running gitleaks...
[INFO] Found 3 secrets
[INFO] Running trivy...
[INFO] Found 28 vulnerabilities (4 critical, 8 high)
[INFO] Pushing results to platform...
[INFO] Successfully pushed 43 findings
[INFO] Scan completed in 45.2s
```

---

## Troubleshooting

### Agent shows offline

1. Check API connectivity:
   ```bash
   curl http://localhost:8080/health
   ```

2. Verify API key is correct

3. Check agent logs for errors

### No findings appear

1. Ensure `-push` flag is used
2. Check if scan actually found vulnerabilities (look at agent output)
3. Verify findings filter isn't hiding results

### Tool not installed

If you see "Scanner X not installed":

```bash
# Check what's installed
agent -check-tools

# Install missing tools
agent -install-tools
```

Or install manually following the instructions shown.

### Docker network issues

If running on Mac/Windows, use:
```bash
-e API_URL=http://host.docker.internal:8080
```

On Linux, use:
```bash
-e API_URL=http://172.17.0.1:8080
# Or use --network host
```

---

## Next Steps

| Goal | Guide |
|------|-------|
| Set up CI/CD scanning | [Agent Configuration](../guides/agent-configuration.md) |
| Configure notifications | [Notification Integrations](../guides/notification-integrations.md) |
| Add team members | [Multi-Tenancy Guide](../guides/multi-tenancy.md) |
| Build custom scanner | [SDK Development](../guides/sdk-development.md) |
| End-to-end workflow | [Complete Workflow Guide](../guides/END_TO_END_WORKFLOW.md) |

---

**Congratulations!** You've successfully run your first scan. 🎉
