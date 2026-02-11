---
layout: default
title: Running Agents
parent: Platform Guides
nav_order: 4
---
# Running Agents Guide

This guide explains how to create, configure, and run Agents (runners, workers, collectors, sensors) with the OpenCTEM platform.

---

## Overview

Agents are distributed components that execute security scans and push findings back to OpenCTEM. The workflow is:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  1. Create      │     │  2. Get API     │     │  3. Run         │
│  Agent in UI    │────▶│  Key            │────▶│  agent          │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                              ┌──────────────────────────────────────┐
                              │  Agent connects to platform:         │
                              │  - Sends heartbeats                  │
                              │  - Polls for commands                │
                              │  - Executes scans                    │
                              │  - Pushes findings                   │
                              └──────────────────────────────────────┘
```

---

## Step 1: Create an Agent in UI

1. Navigate to **Scoping > Agents** in the sidebar
2. Click **+ Add Agent** button
3. Fill in the agent details:
   - **Name**: Descriptive name (e.g., "prod-scanner-01")
   - **Type**: Select agent type:
     - `Runner`: CI/CD one-shot scans
     - `Worker`: Server-controlled daemon
     - `Collector`: Data collection agent
     - `Sensor`: EASM sensor
   - **Capabilities**: What the agent can do (SAST, SCA, Secrets, etc.)
   - **Tools**: Which security tools are installed (semgrep, trivy, gitleaks, etc.)
   - **Execution Mode**:
     - `One-shot`: Runs once and exits (for runners)
     - `Daemon`: Long-running process (for workers, collectors, sensors)
4. Click **Create Agent**

> **IMPORTANT**: Copy and save the API key immediately! It is only shown once during creation.

---

## Step 2: Get the API Key

### On Agent Creation
When you create an agent, the API key is displayed in a dialog:
- Click the **Copy** button to copy the full key
- Store it securely (environment variable, secrets manager, etc.)

### If You Lost the API Key
If you didn't save the API key:
1. Click the **...** menu on the agent card
2. Select **Regenerate API Key**
3. Confirm the regeneration (this invalidates the old key)
4. Copy and save the new key from the dialog

> **Warning**: Regenerating a key will immediately invalidate the old key. Any running agents using the old key will fail to authenticate.

---

## Step 3: Install the OpenCTEM Agent

### Option A: Download Pre-built Binary
```bash
# Download latest release
curl -L https://github.com/openctemio/api/releases/latest/download/agent-linux-amd64 -o agent
chmod +x agent
```

### Option B: Build from Source
```bash
cd sdk
go build -o agent ./cmd/agent
```

### Option C: Docker
```bash
docker pull openctem/agent:latest
```

---

## Step 4: Configure the Agent

### Quick Start: Use "View Config" in UI

The easiest way to get your agent configuration is using the **View Config** feature:

1. Go to **Scoping > Agents**
2. Click the **...** menu on your agent card
3. Select **View Config**
4. Choose your preferred format:
   - **YAML**: Full configuration file
   - **Environment Variables**: For Docker/CI environments
   - **Docker**: Ready-to-run Docker command
   - **CLI**: Command-line arguments

> **Tip**: After regenerating an API key, the "View Config" button shows the new key pre-filled, making it easy to copy the updated configuration.

### Manual Configuration

Create a configuration file `agent.yaml`:

```yaml
# Agent Configuration
agent:
  name: prod-scanner-01              # Must match agent name in UI
  enable_commands: true              # Allow server to send commands
  command_poll_interval: 30s         # How often to poll for commands
  heartbeat_interval: 1m             # How often to send heartbeat

# OpenCTEM Platform Connection
server:
  base_url: https://api.openctem.io   # Your OpenCTEM API URL
  api_key: rda_xxxxxxxxxxxxxxxxxx    # API key from Step 2
  agent_id: 76d81868-25cd-...        # Optional: Agent UUID from UI
  timeout: 30s

# Enabled Scanners
scanners:
  - name: semgrep
    enabled: true
    config:
      rules: ["p/security-audit", "p/owasp-top-ten"]

  - name: trivy
    enabled: true
    scan_types: ["fs", "image"]

  - name: gitleaks
    enabled: true

# Default Scan Targets (for standalone mode)
targets:
  - /opt/code/project1
  - /opt/code/project2
```

### Environment Variables
You can also use environment variables:

```bash
export API_URL=https://api.openctem.io
export API_KEY=rda_xxxxxxxxxxxxxxxxxx
export AGENT_ID=76d81868-25cd-45e6-ba66-6adfda4d0573
```

---

## Step 5: Run the Agent

### Execution Modes Comparison

| Mode | Command | Push Behavior | Use Case |
|------|---------|---------------|----------|
| **One-Shot** | `./agent -tool X -push` | Manual (`-push` required) | CI/CD pipelines, ad-hoc scans |
| **Daemon** | `./agent -daemon -config X` | Automatic | Continuous monitoring, servers |

### One-Shot Mode (Single Scan)
Run a single scan and exit:

```bash
# Scan with a specific tool and push to OpenCTEM
./agent -tool trivy -target /path/to/project -push

# Scan with multiple tools
./agent -tools semgrep,gitleaks,trivy -target . -push

# Using config file (IMPORTANT: add -push flag!)
./agent -config agent.yaml -push

# Scan without pushing (dry run / local testing)
./agent -tool semgrep -target . -output ./results.json
```

> **IMPORTANT**: In one-shot mode, you MUST use the `-push` flag to send findings to OpenCTEM. Without `-push`, findings are only displayed locally and not saved.

### Daemon Mode (Continuous)
Run as a long-running service. In daemon mode, findings are **automatically pushed** after each scan.

```bash
# Start with config file (auto-push enabled)
./agent -daemon -config agent.yaml

# With verbose logging
./agent -daemon -config agent.yaml -verbose

# Standalone mode (no server commands, still auto-pushes)
./agent -daemon -config agent.yaml -standalone
```

> **Note**: In daemon mode, you don't need the `-push` flag. Findings are automatically pushed after each scheduled scan.

### Docker
```bash
docker run -d \
  --name agent \
  -v /opt/code:/code:ro \
  -v ./agent.yaml:/app/agent.yaml \
  -e API_KEY=rda_xxx \
  openctem/agent:latest \
  -daemon -config /app/agent.yaml
```

### Systemd Service
Create `/etc/systemd/system/agent.service`:

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
Environment=API_KEY=rda_xxx

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable agent
sudo systemctl start agent
```

---

## Step 6: Verify Connection

### Check Worker Status in UI
1. Go to **Scoping > Workers**
2. The worker card should show:
   - **Status**: Active (green)
   - **Last Seen**: Recent timestamp

### Check Agent Logs
```bash
# Systemd
journalctl -u agent -f

# Docker
docker logs -f agent
```

You should see:
```
INFO  Connecting to OpenCTEM platform...
INFO  Heartbeat sent successfully
INFO  Status: active
INFO  Polling for commands...
```

---

## Where Are Findings Stored?

When the agent pushes findings, they are stored in the database and can be viewed in the UI.

### Data Flow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Agent     │────▶│  POST /api/v1/   │────▶│  IngestService  │────▶│  PostgreSQL  │
│   Scan      │     │  ingest/findings │     │                 │     │  (findings)  │
└─────────────┘     └──────────────────┘     └─────────────────┘     └──────────────┘
```

### Viewing Findings in UI

| Page | Path | Description |
|------|------|-------------|
| **All Findings** | `/findings` | All findings from all scanners |
| **Code Exposures** | `/exposures/code` | Code-related findings (SAST, secrets) |
| **Insights** | `/insights/findings` | Findings analytics and trends |
| **Repository Detail** | `/assets/repositories/[id]` | Findings linked to a specific repository |

### Linking Findings to Assets

For findings to appear correctly in the UI, they should be linked to an **Asset** (repository, domain, host, etc.).

**Option 1: Auto-detection by path**

If scanning a git repository, the agent can auto-detect the repository URL:

```yaml
targets:
  - /path/to/git/repo  # Agent detects .git/config
```

**Option 2: Specify asset in config**

```yaml
# In agent.yaml
scan_options:
  asset_type: repository
  asset_value: github.com/org/repo
```

**Option 3: Create asset first in UI**

1. Go to **Discovery > Assets > Repositories**
2. Click **+ Add Repository**
3. Enter repository URL (e.g., `github.com/org/repo`)
4. Copy the Asset ID
5. Use it in your agent config:

```yaml
server:
  asset_id: "550e8400-e29b-41d4-a716-446655440000"  # Asset UUID from UI
```

### Troubleshooting: Findings Not Appearing

1. **Check push was successful**: Look for "Pushed: X created" in agent output
2. **Verify tenant**: Ensure API key belongs to the correct tenant
3. **Check asset linking**: Findings without assets may not appear in filtered views
4. **Refresh the page**: UI may need a refresh to show new findings

---

## Triggering Scans

### From the UI (Coming Soon)
1. Go to **Discovery > Scan Management**
2. Select targets and scanner
3. Click **Start Scan**
4. The command is sent to the appropriate worker

### From the Agent (Scheduled)
Configure `scan_interval` in `agent.yaml`:

```yaml
agent:
  scan_interval: 6h    # Run scans every 6 hours
  targets:
    - /opt/code/app1
    - /opt/code/app2
```

### Manually via API
```bash
curl -X POST https://api.openctem.io/api/v1/commands \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "worker_id": "76d81868-25cd-45e6-ba66-6adfda4d0573",
    "type": "scan",
    "payload": {
      "scanner": "trivy",
      "target": "/opt/code/project",
      "config": {}
    }
  }'
```

---

## Worker Types Reference

| Type | Description | Use Case |
|------|-------------|----------|
| **Scanner** | Runs security scanning tools | SAST, SCA, secrets detection |
| **Agent** | Full-featured daemon | Enterprise continuous scanning |
| **Collector** | Pulls data from external sources | GitHub/GitLab alerts aggregation |
| **Worker** | General purpose | Custom integrations |

---

## Supported Tools

| Tool | Capability | Output Format |
|------|------------|---------------|
| Semgrep | SAST | SARIF |
| Trivy | SCA, Container, IaC | JSON |
| Gitleaks | Secrets | JSON |
| Nuclei | DAST | JSON |
| Checkov | IaC | SARIF |
| TFSec | Terraform | SARIF |
| Grype | SCA | JSON |
| Syft | SBOM | SPDX/CycloneDX |

---

## Troubleshooting

### Worker shows "Inactive"
Workers are automatically marked as "Inactive" if they don't send a heartbeat within the configured timeout (default: 5 minutes).

**Common causes:**
- Agent is not running: `ps aux | grep agent`
- Agent crashed - check logs for errors
- Network issues preventing heartbeat
- API key is invalid or revoked

**To fix:**
1. Check if agent is running
2. Verify agent logs for connection errors
3. Ensure API key is correct
4. Restart the agent if needed

> **Note**: When the agent reconnects and sends a heartbeat, the status will automatically change back to "Active".

### 401 Unauthorized
- API key may be invalid or revoked
- Regenerate the API key in UI
- Update agent configuration with new key

### 403 Forbidden
- Worker status may be "revoked" or "error"
- Check worker permissions in UI
- Verify tenant ID is correct

### Scans Not Running
- Check if `enable_commands: true` in config
- Verify `command_poll_interval` is reasonable (30s-60s)
- Check agent logs for command polling status

### Findings Not Appearing

**Most common cause**: Missing `-push` flag in one-shot mode!

```bash
# WRONG - findings only displayed locally
./agent -config agent.yaml

# CORRECT - findings pushed to OpenCTEM
./agent -config agent.yaml -push
```

**Other causes:**
- Verify scan completed successfully in agent logs
- Check for "Pushed: X created" message in output
- Check ingest API responses with `-verbose` flag
- Ensure asset exists and is linked correctly
- Refresh the UI page after pushing

---

## Server Configuration (Administrators)

### Heartbeat Timeout

The OpenCTEM server automatically marks workers as "Inactive" when they stop sending heartbeats. This is configurable via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKER_HEALTH_CHECK_ENABLED` | `true` | Enable/disable automatic status checking |
| `WORKER_HEARTBEAT_TIMEOUT` | `5m` | How long to wait before marking worker as inactive |
| `WORKER_HEALTH_CHECK_INTERVAL` | `1m` | How often to check for stale workers |

Example configuration:
```bash
# Increase timeout to 10 minutes
export WORKER_HEARTBEAT_TIMEOUT=10m

# Check every 2 minutes
export WORKER_HEALTH_CHECK_INTERVAL=2m

# Disable automatic status checking
export WORKER_HEALTH_CHECK_ENABLED=false
```

> **Note**: Set the heartbeat timeout to at least 2-3x the agent's heartbeat interval to avoid false positives due to network latency.

---

## Security Best Practices

1. **API Key Storage**: Never commit API keys to version control. Use environment variables or secrets managers.

2. **Least Privilege**: Create separate workers for different environments (dev, staging, prod).

3. **Network Security**: Workers should only have outbound access to the OpenCTEM API and targets.

4. **Key Rotation**: Regularly rotate API keys using the regenerate function.

5. **Audit Logs**: Monitor worker activity in **Settings > Audit Log**.

---

## Platform Agents (Managed by OpenCTEM)

For tenants who prefer not to manage their own agents, OpenCTEM offers **Platform Agents** - shared scanning infrastructure managed by OpenCTEM.

### What are Platform Agents?

Platform Agents are:
- **Managed by OpenCTEM** - No deployment or maintenance required
- **Shared across tenants** - Fair queuing ensures equal access
- **Regionally distributed** - Choose agents close to your targets
- **Always available** - High availability with automatic failover

### Using Platform Agents (Tenants)

Instead of deploying your own agent, submit jobs to the platform queue:

```bash
curl -X POST /api/v1/platform-jobs \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -d '{
    "type": "scan",
    "priority": "normal",
    "payload": {
      "target": "example.com",
      "tool": "nuclei"
    },
    "preferred_region": "us-east-1"
  }'
```

Response:
```json
{
  "job": { "id": "...", "status": "pending" },
  "status": "queued",
  "queue": { "position": 3 }
}
```

### When to Use Platform Agents vs Your Own

| Scenario | Recommendation |
|----------|----------------|
| Quick scans, ad-hoc testing | Platform Agents |
| No infrastructure team | Platform Agents |
| Internal network scanning | Your own agents |
| High volume, dedicated capacity | Your own agents |
| Regulatory requirements | Your own agents |

### Deploying Platform Agents (Administrators)

If you're a OpenCTEM administrator deploying platform agents, use the `openctem-admin` CLI:

#### Step 1: Create a Bootstrap Token

```bash
# Using CLI (recommended)
openctem-admin create token --max-uses=5 --expires=24h

# Output:
# token/tok-abc123 created
#
# Bootstrap Token (save this, it won't be shown again):
#   abc123.xxxxxxxxxxxxxxxx
#
# Use this token to register a platform agent:
#   ./agent -platform -bootstrap-token=abc123.xxxxxxxxxxxxxxxx -api-url=https://api.openctem.io
```

#### Step 2: Start the Agent with Bootstrap Token

```bash
# Binary - with specific executors enabled
./agent -platform \
  -bootstrap-token=abc123.xxxxxxxxxxxxxxxx \
  -api-url=https://api.openctem.io \
  -region=us-east-1 \
  -enable-recon \
  -enable-vulnscan \
  -verbose

# Docker
docker run -d \
  --name platform-agent \
  --restart unless-stopped \
  -e BOOTSTRAP_TOKEN=abc123.xxxxxxxxxxxxxxxx \
  -e API_URL=https://api.openctem.io \
  -v agent-data:/home/openctem/.openctem \
  openctemio/agent:platform

# Hybrid build (uses Go libraries for better performance)
./agent -platform \
  -bootstrap-token=abc123.xxxxxxxxxxxxxxxx \
  -api-url=https://api.openctem.io \
  -region=us-east-1 \
  -enable-recon
```

The agent will:
1. Register using the bootstrap token (one-time)
2. Receive and store a permanent API key
3. Report capabilities based on enabled executors
4. Start polling for jobs

**Executor Flags:**
| Flag | Description |
|------|-------------|
| `-enable-recon` | Enable recon executor (subfinder, dnsx, naabu, httpx, katana) |
| `-enable-vulnscan` | Enable vulnscan executor (nuclei, trivy, semgrep) - default: true |
| `-enable-secrets` | Enable secrets executor (gitleaks, trufflehog) |
| `-enable-assets` | Enable assets executor (cloud collection) |
| `-enable-pipeline` | Enable pipeline executor (workflow orchestration) |

#### Kubernetes Deployment (Helm)

For Kubernetes deployments, use the Helm chart:

```bash
# Add OpenCTEM Helm repo
helm repo add.openctem https://charts.openctem.io
helm repo update

# Install with bootstrap token (auto-registration)
helm install platform-agent openctem/platform-agent \
  --namespace.openctem \
  --create-namespace \
  --set apiUrl=https://api.openctem.io \
  --set bootstrapToken=abc123.xxxxxxxxxxxxxxxx \
  --set replicaCount=3 \
  --set agent.region=us-east-1

# Or install with pre-assigned API key
helm install platform-agent openctem/platform-agent \
  --namespace.openctem \
  --set apiUrl=https://api.openctem.io \
  --set apiKey=ragent_xxxxx \
  --set useStatefulSet=false
```

See [Platform Administration Guide - Kubernetes Deployment](./platform-admin.md#kubernetes-deployment) for detailed options.

#### Step 3: Monitor the Agent

```bash
# List all platform agents
openctem-admin get agents

# Watch in real-time
openctem-admin get agents -w

# Get details
openctem-admin describe agent <agent-name>
```

#### Step 4: Maintenance Operations

```bash
# Stop agent from accepting new jobs (for maintenance)
openctem-admin drain agent <agent-name>

# Resume operations
openctem-admin uncordon agent <agent-name>

# Remove agent
openctem-admin delete agent <agent-name>
```

See [Platform Administration Guide](./platform-admin.md) for complete CLI documentation.

---

## Resource Management

Agents running as daemons need to manage resources efficiently. The SDK provides:

### Auto-Cleanup

Uploaded chunk data is automatically cleaned up to prevent disk bloat:

```yaml
# In agent.yaml
chunk:
  auto_cleanup_on_upload: true     # Delete after upload
  cleanup_on_report_complete: true # Delete all when done
  max_storage_mb: 500              # Max storage limit
  retention_hours: 24              # Keep for 24h max
```

### Async Upload Pipeline

Scans don't block waiting for uploads. Results are queued and uploaded in the background:

```yaml
pipeline:
  queue_size: 1000      # Max pending uploads
  workers: 3            # Concurrent upload workers
  retry_attempts: 3     # Retry failed uploads
```

### Resource Throttling

Prevent overloading the host system:

```yaml
resource:
  cpu_threshold: 85        # Pause new jobs above 85% CPU
  memory_threshold: 85     # Pause new jobs above 85% memory
  max_concurrent_jobs: 4   # Max parallel jobs
  cooldown_duration: 30s   # Wait before resuming
```

### Audit Logging

All operations are logged for debugging:

```yaml
audit:
  log_file: ~/.openctem/audit.log
  max_size_mb: 100
  max_age_days: 30
  verbose: true
```

See [Agent Resource Management](../architecture/agent-resource-management.md) for detailed documentation.

---

## Related Documentation

- [Platform Administration Guide](./platform-admin.md) - Admin CLI and platform management
- [Platform Agents Feature](../features/platform-agents.md) - Detailed platform agent architecture
- [Agent Resource Management](../architecture/agent-resource-management.md) - Auto-cleanup, async pipeline, throttling
- [Deployment Modes](../architecture/deployment-modes.md)
- [Server-Agent Architecture](../architecture/server-agent-command.md)
- [SDK Development Guide](./sdk-development.md)
- [API Reference](../backend/api-reference.md)
