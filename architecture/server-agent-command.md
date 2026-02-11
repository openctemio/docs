---
layout: default
parent: Architecture
---
---
layout: default
title: Server-Agent Command Architecture
parent: Architecture
nav_order: 4
---
# Server-Agent Command Architecture

This document describes how the OpenCTEM Server controls agents, scanners, and collectors remotely.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OPENCTEM PLATFORM                                   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      Command Service                                 │   │
│   │                                                                      │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│   │  │ Command     │  │ Agent       │  │ Schedule    │                 │   │
│   │  │ Queue       │  │ Registry    │  │ Manager     │                 │   │
│   │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│   │                                                                      │   │
│   │  ┌─────────────────────────────────────────────────────────────┐   │   │
│   │  │                 WebSocket Gateway (Optional)                 │   │   │
│   │  │             For real-time notifications                      │   │   │
│   │  └─────────────────────────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │
                          HTTPS + WebSocket (optional)
                                    │
┌───────────────────────────────────┼──────────────────────────────────────────┐
│                                   │                                           │
│   ┌───────────────────────────────┴────────────────────────────────────┐     │
│   │                         SDK Agent                                   │     │
│   │                                                                     │     │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │     │
│   │   │ Command     │  │ Task        │  │ Result      │               │     │
│   │   │ Poller      │  │ Executor    │  │ Reporter    │               │     │
│   │   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘               │     │
│   │          │                │                │                       │     │
│   │          └────────────────┼────────────────┘                       │     │
│   │                           │                                         │     │
│   │   ┌───────────────────────┼─────────────────────────────────────┐  │     │
│   │   │                 Local Components                             │  │     │
│   │   │                                                              │  │     │
│   │   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │  │     │
│   │   │  │ Scanners    │  │ Collectors  │  │ Parsers     │         │  │     │
│   │   │  │ semgrep     │  │ github      │  │ sarif       │         │  │     │
│   │   │  │ trivy       │  │ webhook     │  │ json        │         │  │     │
│   │   │  │ gitleaks    │  │             │  │             │         │  │     │
│   │   │  └─────────────┘  └─────────────┘  └─────────────┘         │  │     │
│   │   └─────────────────────────────────────────────────────────────┘  │     │
│   │                                                                     │     │
│   └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
│                           TENANT ENVIRONMENT                                  │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Approaches Comparison

| Approach | Pros | Cons | Best For |
|----------|------|------|----------|
| **Poll-based** | Simple, firewall-friendly, works everywhere | Latency (depends on poll interval), more API calls | Most deployments |
| **WebSocket** | Real-time, lower latency | Complex, connection management | Real-time dashboards |
| **Message Queue** | Scalable, reliable, decoupled | Additional infrastructure | Enterprise scale |
| **Hybrid** | Best of both worlds | More complexity | Production systems |

**Recommended: Hybrid (Poll + WebSocket notification)**

---

## Command Flow

### 1. Poll-based Command Retrieval

```
Agent                                Server
  │                                    │
  │──── GET /api/v1/commands ─────────>│
  │     Authorization: Bearer {key}    │
  │     X-OpenCTEM-Source-ID: {source}  │
  │                                    │
  │<─── 200 OK ────────────────────────│
  │     {                              │
  │       "commands": [                │
  │         {                          │
  │           "id": "cmd_xxx",         │
  │           "type": "scan",          │
  │           "target": "/path",       │
  │           "scanner": "semgrep",    │
  │           "priority": "high",      │
  │           "timeout": 3600          │
  │         }                          │
  │       ]                            │
  │     }                              │
  │                                    │
  │──── POST /commands/{id}/ack ──────>│  (Acknowledge receipt)
  │                                    │
  │     [Execute scan locally]         │
  │                                    │
  │──── POST /commands/{id}/result ───>│  (Report result)
  │     {                              │
  │       "status": "completed",       │
  │       "findings_count": 10,        │
  │       "duration_ms": 5000          │
  │     }                              │
  │                                    │
```

### 2. Optional WebSocket for Real-time Notifications

```
Agent                                Server
  │                                    │
  │──── WS /api/v1/agents/ws ─────────>│
  │     (Upgrade to WebSocket)         │
  │                                    │
  │<─── Connection Established ────────│
  │                                    │
  │     [Agent continues polling for   │
  │      commands in background]       │
  │                                    │
  │<─── {"type": "command_available"} ─│  (Notification)
  │                                    │
  │     [Agent immediately polls       │
  │      for new command]              │
  │                                    │
  │<─── {"type": "config_update"} ─────│  (Config change)
  │                                    │
```

---

## API Endpoints

### Command Management

#### GET /api/v1/commands
Retrieve pending commands for the agent.

**Request:**
```http
GET /api/v1/commands?limit=10&status=pending HTTP/1.1
Authorization: Bearer rs_src_xxxxxxxx
X-OpenCTEM-Source-ID: src_abc123
```

**Response:**
```json
{
  "commands": [
    {
      "id": "cmd_abc123",
      "type": "scan",
      "priority": "high",
      "created_at": "2024-01-16T10:00:00Z",
      "expires_at": "2024-01-16T11:00:00Z",
      "payload": {
        "scanner": "semgrep",
        "target": "/opt/code/myapp",
        "config": {
          "rules": ["p/security-audit"],
          "exclude": ["**/test/**"]
        },
        "timeout_seconds": 1800
      }
    }
  ],
  "poll_interval_seconds": 30
}
```

#### POST /api/v1/commands/{id}/acknowledge
Acknowledge command receipt (prevents duplicate execution).

**Request:**
```json
{
  "started_at": "2024-01-16T10:00:05Z"
}
```

**Response:**
```json
{
  "acknowledged": true,
  "command_id": "cmd_abc123"
}
```

#### POST /api/v1/commands/{id}/result
Report command execution result.

**Request:**
```json
{
  "status": "completed",
  "completed_at": "2024-01-16T10:05:00Z",
  "duration_ms": 295000,
  "exit_code": 0,
  "findings_count": 15,
  "error": null,
  "metadata": {
    "scanner_version": "1.50.0",
    "targets_scanned": 150
  }
}
```

---

## Command Types

| Type | Description | Payload |
|------|-------------|---------|
| `scan` | Run a security scanner | scanner, target, config |
| `collect` | Run a collector | collector, source_config |
| `config_update` | Update agent configuration | config_data |
| `restart` | Restart the agent | grace_period_seconds |
| `upgrade` | Upgrade agent version | target_version, download_url |
| `health_check` | Request health report | - |
| `cancel` | Cancel running command | command_id |

### Scan Command Payload
```json
{
  "type": "scan",
  "payload": {
    "scanner": "semgrep",
    "target": "/opt/code/project",
    "config": {
      "rules": ["p/security-audit", "p/owasp-top-ten"],
      "exclude": ["**/vendor/**", "**/node_modules/**"],
      "severity_threshold": "warning"
    },
    "timeout_seconds": 1800,
    "report_progress": true
  }
}
```

### Collect Command Payload
```json
{
  "type": "collect",
  "payload": {
    "collector": "github",
    "source_config": {
      "repository": "org/repo",
      "since": "2024-01-01T00:00:00Z",
      "alert_types": ["dependabot", "code-scanning", "secret-scanning"]
    }
  }
}
```

---

## Database Schema

### commands Table
```sql
CREATE TABLE commands (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    source_id VARCHAR(36),  -- Target agent/source

    type VARCHAR(50) NOT NULL,  -- scan, collect, config_update, etc.
    priority VARCHAR(20) DEFAULT 'normal',  -- low, normal, high, critical

    payload JSONB NOT NULL,

    status VARCHAR(20) DEFAULT 'pending',  -- pending, acknowledged, running, completed, failed, cancelled, expired

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    acknowledged_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,

    result JSONB,
    error_message TEXT,

    -- Scheduling
    scheduled_at TIMESTAMP,  -- For scheduled scans
    schedule_id VARCHAR(36),  -- Reference to scan schedule

    CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_source FOREIGN KEY (source_id) REFERENCES sources(id)
);

CREATE INDEX idx_commands_source_status ON commands(source_id, status);
CREATE INDEX idx_commands_tenant_created ON commands(tenant_id, created_at);
```

### scan_schedules Table
```sql
CREATE TABLE scan_schedules (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    source_id VARCHAR(36),

    name VARCHAR(255) NOT NULL,
    description TEXT,

    scanner VARCHAR(100) NOT NULL,
    target VARCHAR(500) NOT NULL,
    config JSONB,

    -- Cron expression: "0 0 * * *" = daily at midnight
    cron_expression VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',

    enabled BOOLEAN DEFAULT true,

    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

---

## SDK Implementation

### CommandPoller

```go
// CommandPoller polls the server for pending commands
type CommandPoller struct {
    client       *client.Client
    interval     time.Duration
    executor     CommandExecutor
    running      bool
    stopCh       chan struct{}
    mu           sync.Mutex
}

type CommandPollerConfig struct {
    PollInterval time.Duration `yaml:"poll_interval" json:"poll_interval"`
    MaxConcurrent int          `yaml:"max_concurrent" json:"max_concurrent"`
}

func NewCommandPoller(client *client.Client, executor CommandExecutor, cfg *CommandPollerConfig) *CommandPoller {
    if cfg.PollInterval == 0 {
        cfg.PollInterval = 30 * time.Second
    }
    return &CommandPoller{
        client:   client,
        interval: cfg.PollInterval,
        executor: executor,
        stopCh:   make(chan struct{}),
    }
}

func (p *CommandPoller) Start(ctx context.Context) error {
    p.mu.Lock()
    if p.running {
        p.mu.Unlock()
        return fmt.Errorf("poller already running")
    }
    p.running = true
    p.mu.Unlock()

    ticker := time.NewTicker(p.interval)
    defer ticker.Stop()

    // Poll immediately on start
    p.pollAndExecute(ctx)

    for {
        select {
        case <-ctx.Done():
            return ctx.Err()
        case <-p.stopCh:
            return nil
        case <-ticker.C:
            p.pollAndExecute(ctx)
        }
    }
}

func (p *CommandPoller) pollAndExecute(ctx context.Context) {
    commands, err := p.client.GetCommands(ctx)
    if err != nil {
        log.Printf("Failed to poll commands: %v", err)
        return
    }

    for _, cmd := range commands {
        // Acknowledge receipt
        if err := p.client.AcknowledgeCommand(ctx, cmd.ID); err != nil {
            log.Printf("Failed to acknowledge command %s: %v", cmd.ID, err)
            continue
        }

        // Execute asynchronously
        go p.executeCommand(ctx, cmd)
    }
}

func (p *CommandPoller) executeCommand(ctx context.Context, cmd *Command) {
    result, err := p.executor.Execute(ctx, cmd)

    reportResult := &CommandResult{
        Status:      "completed",
        CompletedAt: time.Now(),
    }

    if err != nil {
        reportResult.Status = "failed"
        reportResult.Error = err.Error()
    } else {
        reportResult.DurationMs = result.DurationMs
        reportResult.FindingsCount = result.FindingsCount
    }

    // Report result back to server
    if err := p.client.ReportCommandResult(ctx, cmd.ID, reportResult); err != nil {
        log.Printf("Failed to report result for command %s: %v", cmd.ID, err)
    }
}
```

### Updated Client Methods

```go
// Command represents a server command
type Command struct {
    ID        string          `json:"id"`
    Type      string          `json:"type"`
    Priority  string          `json:"priority"`
    Payload   json.RawMessage `json:"payload"`
    CreatedAt time.Time       `json:"created_at"`
    ExpiresAt time.Time       `json:"expires_at"`
}

// GetCommands retrieves pending commands from the server
func (c *Client) GetCommands(ctx context.Context) ([]*Command, error) {
    url := fmt.Sprintf("%s/api/v1/commands?status=pending", c.baseURL)

    data, err := c.doRequest(ctx, "GET", url, nil)
    if err != nil {
        return nil, err
    }

    var resp struct {
        Commands []*Command `json:"commands"`
    }
    if err := json.Unmarshal(data, &resp); err != nil {
        return nil, err
    }

    return resp.Commands, nil
}

// AcknowledgeCommand acknowledges receipt of a command
func (c *Client) AcknowledgeCommand(ctx context.Context, cmdID string) error {
    url := fmt.Sprintf("%s/api/v1/commands/%s/acknowledge", c.baseURL, cmdID)

    payload := map[string]interface{}{
        "started_at": time.Now().Format(time.RFC3339),
    }
    body, _ := json.Marshal(payload)

    _, err := c.doRequest(ctx, "POST", url, body)
    return err
}

// ReportCommandResult reports the result of command execution
func (c *Client) ReportCommandResult(ctx context.Context, cmdID string, result *CommandResult) error {
    url := fmt.Sprintf("%s/api/v1/commands/%s/result", c.baseURL, cmdID)

    body, err := json.Marshal(result)
    if err != nil {
        return err
    }

    _, err = c.doRequest(ctx, "POST", url, body)
    return err
}
```

### Updated Agent with Command Polling

```go
// BaseAgentConfig with command polling support
type BaseAgentConfig struct {
    Name              string        `yaml:"name" json:"name"`
    Version           string        `yaml:"version" json:"version"`
    ScanInterval      time.Duration `yaml:"scan_interval" json:"scan_interval"`
    CollectInterval   time.Duration `yaml:"collect_interval" json:"collect_interval"`
    HeartbeatInterval time.Duration `yaml:"heartbeat_interval" json:"heartbeat_interval"`
    Targets           []string      `yaml:"targets" json:"targets"`
    Verbose           bool          `yaml:"verbose" json:"verbose"`

    // Command polling configuration
    EnableCommandPolling bool          `yaml:"enable_command_polling" json:"enable_command_polling"`
    CommandPollInterval  time.Duration `yaml:"command_poll_interval" json:"command_poll_interval"`
}
```

---

## Operating Modes

### 1. Standalone Mode (Default)
Agent runs scans based on local configuration and schedule.

```yaml
agent:
  name: standalone-scanner
  scan_interval: 1h
  enable_command_polling: false

targets:
  - /opt/code/project1
  - /opt/code/project2
```

### 2. Server-Controlled Mode
Agent waits for commands from server.

```yaml
agent:
  name: managed-scanner
  enable_command_polling: true
  command_poll_interval: 30s

  # No local targets - all scans are server-initiated
```

### 3. Hybrid Mode
Agent runs local scans AND accepts server commands.

```yaml
agent:
  name: hybrid-scanner
  scan_interval: 24h  # Daily local scans
  enable_command_polling: true
  command_poll_interval: 30s

targets:
  - /opt/code/project1

# Server can also dispatch additional scans on-demand
```

---

## Security Considerations

### 1. Command Validation
```go
// Only allow whitelisted command types
var allowedCommandTypes = map[string]bool{
    "scan":          true,
    "collect":       true,
    "health_check":  true,
    "config_update": true,
}

func validateCommand(cmd *Command) error {
    if !allowedCommandTypes[cmd.Type] {
        return fmt.Errorf("unknown command type: %s", cmd.Type)
    }

    // Validate target paths (prevent path traversal)
    if cmd.Type == "scan" {
        var payload ScanPayload
        json.Unmarshal(cmd.Payload, &payload)

        if !isAllowedTarget(payload.Target) {
            return fmt.Errorf("target path not allowed: %s", payload.Target)
        }
    }

    return nil
}
```

### 2. Command Expiration
Commands should have an expiration time to prevent stale commands from being executed.

### 3. Idempotency
Use command acknowledgement to prevent duplicate execution.

### 4. Rate Limiting
Server should rate limit command creation per tenant.

---

## Comparison with Industry Solutions

| Feature | Tenable | Qualys | OpenCTEM (Proposed) |
|---------|---------|--------|---------------------|
| Agent communication | Poll + Push | Poll | Poll + WS notification |
| Command dispatch | Centralized | Centralized | Per-tenant |
| Scheduling | Server-side | Server-side | Server + Agent |
| Real-time updates | Yes (WS) | Limited | Optional (WS) |
| Offline capability | Limited | Limited | Full (standalone mode) |
| Multi-tenant | Enterprise only | Enterprise only | Built-in |

---

## Implementation Checklist

### Backend API
- [ ] `GET /api/v1/commands` - List pending commands
- [ ] `POST /api/v1/commands` - Create new command
- [ ] `POST /api/v1/commands/{id}/acknowledge` - Acknowledge receipt
- [ ] `POST /api/v1/commands/{id}/result` - Report result
- [ ] `DELETE /api/v1/commands/{id}` - Cancel command
- [ ] `GET /api/v1/scan-schedules` - List schedules
- [ ] `POST /api/v1/scan-schedules` - Create schedule
- [ ] Schedule executor (cron-like)
- [ ] WebSocket gateway (optional)

### SDK
- [ ] CommandPoller implementation
- [ ] CommandExecutor interface
- [ ] Client.GetCommands()
- [ ] Client.AcknowledgeCommand()
- [ ] Client.ReportCommandResult()
- [ ] Updated BaseAgent with command polling support
- [ ] Configuration validation

---

## Related Documentation

- [SDK & API Integration](./sdk-api-integration.md)
- [SDK Development Guide](../guides/sdk-development.md)
- [API Reference](../backend/api-reference.md)
