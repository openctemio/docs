---
layout: default
title: Scan Flow Architecture
parent: Architecture
nav_order: 10
---

# Scan Flow Architecture

This document explains the complete scan flow in OpenCTEMio - from when a user creates a scan to when results are displayed.

---

## Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           OPENCTEMIO SCAN FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

 ┌──────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
 │  1. USER     │ ───▶ │  2. BACKEND  │ ───▶ │  3. AGENT    │ ───▶ │  4. INGEST   │
 │  Create Scan │      │  Schedule    │      │  Execute     │      │  Results     │
 └──────────────┘      └──────────────┘      └──────────────┘      └──────────────┘
        │                     │                     │                     │
        ▼                     ▼                     ▼                     ▼
   UI Wizard            Command Queue         Run Tools            Batch Process
   4 Steps              Agent Routing         Collect Data         Deduplicate
   Scan Profile         Priority Queue        CTIS Format           Store Findings
```

---

## 1. Scan Creation (UI)

Users create scans through a 4-step wizard in the UI.

### Wizard Steps

| Step | Name | Description |
|------|------|-------------|
| 1 | Basic Info | Name, description, asset group, scan type |
| 2 | Targets | Select assets to scan |
| 3 | Options | Scanner tool and configuration |
| 4 | Schedule | Manual, daily, weekly, or crontab |

### Scan Types

| Type | Description |
|------|-------------|
| `single` | Run a single scanner (semgrep, trivy, nuclei, etc.) |
| `workflow` | Pipeline orchestrating multiple tools |

### Key Files

```
ui/src/features/scans/components/new-scan/
├── new-scan-dialog.tsx    # Main dialog component
├── basic-info-step.tsx    # Step 1
├── targets-step.tsx       # Step 2
├── options-step.tsx       # Step 3
├── schedule-step.tsx      # Step 4
└── scan-stepper.tsx       # Progress indicator
```

### API Endpoint

```
POST /api/v1/scans
```

Creates a Scan entity in the database with all configuration metadata.

---

## 2. Scan Profiles (Reusable Templates)

Scan Profiles allow teams to define standardized configurations that can be reused across multiple scans.

### Profile Structure

```go
type ScanProfile struct {
    ID                  string
    TenantID            string
    Name                string
    Description         string
    ToolsConfig         map[string]ToolConfig  // Tool configurations
    Intensity           string                  // low, medium, high
    MaxConcurrentScans  int
    TimeoutSeconds      int
    Tags                []string
    IsDefault           bool
    IsSystem            bool
}

type ToolConfig struct {
    Enabled   bool
    Severity  string   // Minimum severity to report
    Timeout   int      // Execution timeout
    Options   map[string]interface{}  // Tool-specific options
}
```

### Key Files

```
api/internal/domain/scanprofile/entity.go
api/internal/app/scan_profile_service.go
```

---

## 3. Scheduling & Triggering

### Scan Scheduler

The backend runs a scheduler that checks for due scans every minute.

```go
// Runs every 1 minute
func (s *ScanScheduler) checkAndTrigger() {
    // Query: SELECT * FROM scans WHERE next_run_at <= NOW()
    dueScans := s.scanRepo.ListDueForExecution(ctx)

    for _, scan := range dueScans {
        go s.triggerScan(scan)  // Async execution
        s.updateNextRunAt(scan) // Prevent double-trigger
    }
}
```

### Schedule Types

| Type | Description |
|------|-------------|
| `manual` | Only triggered manually |
| `daily` | Runs every day at specified time |
| `weekly` | Runs on specified day of week |
| `monthly` | Runs on specified day of month |
| `crontab` | Custom cron expression |

### Manual Trigger

```
POST /api/v1/scans/{id}/trigger
```

Creates a scan run immediately without waiting for schedule.

### Key Files

```
api/internal/app/scan_scheduler.go
api/internal/app/scan_service.go
```

---

## 4. Command System (Agent Orchestration)

The Command entity is the core of agent-server communication. Commands are stored in a database queue that agents poll.

### Command Entity

```go
type Command struct {
    ID         string
    TenantID   string
    Type       CommandType   // scan, collect, health_check, cancel
    Priority   Priority      // low, normal, high, critical
    Payload    string        // JSON-encoded scan parameters
    Status     CommandStatus // pending, acknowledged, running, completed, failed
    AgentID    *string       // Optional target agent (nil = any agent)
    ExpiresAt  time.Time     // Command TTL
    ScheduleID string        // Link to parent scan definition
}
```

### Command Lifecycle

```
pending ──▶ acknowledged ──▶ running ──▶ completed
                                   └──▶ failed ──▶ retry/dead
```

### Command Types

| Type | Description |
|------|-------------|
| `scan` | Execute security scan |
| `collect` | Collect data from sources |
| `health_check` | Agent health verification |
| `config_update` | Update agent configuration |
| `cancel` | Cancel running scan |

### Priority Levels

| Priority | Description |
|----------|-------------|
| `critical` | Immediate execution (security incidents) |
| `high` | Next in queue |
| `normal` | Standard priority |
| `low` | Background tasks |

### Key Files

```
api/internal/domain/command/entity.go
api/internal/app/command_service.go
api/internal/infra/http/handler/command_handler.go
```

---

## 5. Agent System

Agents are distributed workers that execute scan tasks.

### Agent Types

| Type | Description |
|------|-------------|
| `runner` | CI/CD one-shot (run once, exit) |
| `worker` | Daemon (runs continuously, polls commands) |
| `collector` | Collects data from external sources |
| `sensor` | Monitoring and detection |

### Agent Entity

```go
type Agent struct {
    ID                 string
    TenantID           string
    Name               string
    Type               AgentType
    ExecutionMode      ExecutionMode  // standalone, daemon
    Status             AgentStatus    // active, disabled, revoked
    Health             AgentHealth    // unknown, online, offline, error
    Capabilities       []string       // sast, sca, dast, iac, secrets, container
    Tools              []string       // semgrep, trivy, nuclei, gitleaks, etc.
    Labels             map[string]string
    MaxConcurrentJobs  int
    // Metrics
    CPUUsage           float64
    MemoryUsage        float64
    ActiveJobs         int
}
```

### Agent Selection Algorithm

When a scan is triggered, the system selects an appropriate agent:

1. **Match Capabilities**: Agent must have required capabilities (sast, sca, etc.)
2. **Match Tools**: Agent must have required tools installed
3. **Check Health**: Agent must be online
4. **Check Capacity**: Agent must have available job slots
5. **Match Tags**: Agent labels must match scan tags
6. **Tenant Restriction**: Respect `run_on_tenant_runner` flag

### Daemon Agent Flow

```
┌──────────────────────────────────────────────────────────┐
│  GET /api/v1/agent/commands  (Poll every N seconds)      │
│       │                                                   │
│       ▼                                                   │
│  Receive Command with payload:                            │
│       ├─ ScanID, ScannerName                              │
│       ├─ TargetsList (repos, containers, hosts...)        │
│       └─ ScannerConfig (tool options)                     │
│       │                                                   │
│       ▼                                                   │
│  Execute Scanner Tool (semgrep, trivy, nuclei...)         │
│       │                                                   │
│       ▼                                                   │
│  Transform output ──▶ CTIS Format                          │
│       │                                                   │
│       ▼                                                   │
│  POST /api/v1/agent/ingest                                │
└──────────────────────────────────────────────────────────┘
```

### Key Files

```
api/internal/domain/agent/entity.go
api/internal/app/agent_service.go
api/internal/infra/http/handler/agent_handler.go
```

---

## 6. Ingest Flow (Results Processing)

The IngestService processes scan results using optimized batch operations.

### CTIS Format (CTEM Ingest Schema)

```json
{
  "version": "1.0",
  "metadata": {
    "tool_name": "semgrep",
    "tool_version": "1.0.0",
    "scan_id": "uuid",
    "agent_id": "uuid",
    "start_time": "2024-01-01T00:00:00Z",
    "end_time": "2024-01-01T00:05:00Z"
  },
  "targets": [
    {
      "type": "repository",
      "identifier": "github.com/org/repo",
      "name": "My Repository",
      "metadata": { "branch": "main" }
    }
  ],
  "findings": [
    {
      "rule_id": "javascript.express.security.injection",
      "severity": "high",
      "message": "SQL injection vulnerability detected",
      "file_path": "src/api/users.js",
      "start_line": 42,
      "end_line": 42,
      "fingerprint": "sha256:abc123...",
      "cve_id": "CVE-2024-1234",
      "cvss_score": 8.5,
      "cwe_ids": ["CWE-89"]
    }
  ],
  "dependencies": [
    {
      "name": "lodash",
      "version": "4.17.21",
      "ecosystem": "npm",
      "purl": "pkg:npm/lodash@4.17.21"
    }
  ],
  "summary": {
    "total_findings": 10,
    "by_severity": { "critical": 1, "high": 3, "medium": 4, "low": 2 }
  }
}
```

### Ingest Pipeline (Batch Optimized)

The pipeline uses batch operations to avoid N+1 query problems.

> **Note**: If the report has no explicit assets but contains findings, the pipeline
> auto-creates an asset from `BranchInfo.RepositoryURL`. See [Asset Auto-Creation](./asset-auto-creation.md).

```
┌─────────────────────────────────────────────────────────────┐
│                    INGEST PIPELINE                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Step 1: PROCESS ASSETS                                      │
│       ├─ Auto-create from BranchInfo if assets[] is empty   │
│       ├─ Normalize identifiers (canonical repo name)         │
│       ├─ Detect provider (GitHub, GitLab...)                 │
│       └─ Upsert Asset entities (create or update)            │
│                                                              │
│  Step 2: BATCH CHECK FINGERPRINTS (1 SQL query)              │
│       └─ WHERE fingerprint IN (fp1, fp2, fp3...)             │
│                                                              │
│  Step 3: SEPARATE NEW vs EXISTING                            │
│       ├─ New findings → create batch                         │
│       └─ Existing findings → update scan_id batch            │
│                                                              │
│  Step 4: BATCH CREATE (1 SQL query)                          │
│       └─ INSERT ... ON CONFLICT (fingerprint) DO NOTHING     │
│                                                              │
│  Step 5: BATCH UPDATE (1 SQL query)                          │
│       └─ UPDATE findings SET scan_id = ? WHERE fp IN (...)   │
│                                                              │
│  Step 6: PROCESS DEPENDENCIES (Snapshot Refresh)             │
│       ├─ Delete existing components for targeted assets      │
│       └─ Create new components from ingest payload           │
│                                                              │
│  Step 7: UPDATE ASSET STATS                                  │
│       └─ Recalculate finding counts and risk scores          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Fingerprinting

Every finding gets a unique fingerprint (SHA256 hash) based on:
- Rule ID
- File path
- Line numbers
- Message content

This enables:
- **Deduplication**: Same vulnerability across runs is identified
- **Tracking**: First detected, last seen, status changes
- **Consistency**: Same fingerprint across different tools

### Finding Source Detection

The system automatically categorizes findings based on tool:

| Category | Tools |
|----------|-------|
| SAST | semgrep, codeql, sonarqube, checkmarx |
| SCA | trivy, grype, snyk, dependabot |
| DAST | zap, burp, nuclei, arachni |
| IaC | tfsec, checkov, terrascan, kics |
| Secrets | gitleaks, trufflehog, detect-secrets |
| Container | clair, anchore, aqua |

### Key Files

```
api/internal/app/ingest_service.go
api/internal/infra/http/handler/ingest_handler.go
api/internal/domain/finding/entity.go
```

---

## 7. Scan Sessions

Each scan execution creates a ScanSession to track progress and results.

### ScanSession Entity

```go
type ScanSession struct {
    ID                 string
    ScanID             string      // Parent scan definition
    AgentID            string      // Which agent executed
    Status             string      // pending, running, completed, failed
    ScannerName        string
    ScannerVersion     string
    ScannerType        string
    AssetType          string
    AssetValue         string
    FindingsTotal      int
    FindingsNew        int
    FindingsFixed      int
    FindingsBySeverity map[string]int
    StartedAt          time.Time
    CompletedAt        time.Time
    DurationMs         int64
}
```

### Session Status Flow

```
pending ──▶ running ──▶ completed
                  └──▶ failed
                  └──▶ canceled
```

### Key Files

```
api/internal/domain/scansession/entity.go
api/internal/app/scan_session_service.go
```

---

## 8. UI Results Display

### Scans Page Structure

```
/scans
├── [Configurations Tab]
│   ├─ List scan definitions
│   ├─ Stats: Total, Active, Paused, Disabled
│   └─ Actions: Trigger, Pause, Activate, Delete
│
└── [Runs Tab]
    ├─ List scan executions (real-time)
    ├─ Stats: Total Runs, Active, Completed, Failed
    ├─ Progress % (live updates)
    └─ Actions: View Details, Pause, Stop, Retry
```

### Details Sheet

| Tab | Content |
|-----|---------|
| Overview | Stats, timeline, progress chart |
| Findings | Summary with link to findings page |
| Details | Created by, run ID, duration, danger zone |

### Real-time Updates

The UI uses SWR polling for live updates:
- Configurations: Refreshed on focus
- Runs: Live progress percentage updates
- Auto-refresh without manual intervention

### Key Files

```
ui/src/app/(dashboard)/(discovery)/scans/page.tsx
ui/src/features/scans/api/use-scan-configs.ts
ui/src/features/scans/components/
```

---

## 9. Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `scans` | Scan definitions (config, schedule) |
| `scan_sessions` | Individual runs (status, findings count) |
| `scan_profiles` | Reusable configurations |
| `commands` | Work queue for agents |
| `agents` | Registered agents (capabilities, health) |
| `findings` | Security findings (fingerprint, severity) |
| `assets` | Discovered assets |
| `components` | Dependencies (SBOM) |
| `asset_dependencies` | Component-to-asset links |

### Key Relationships

```
scans ──1:N──▶ scan_sessions
scans ──N:1──▶ scan_profiles
scan_sessions ──N:1──▶ agents
findings ──N:1──▶ assets
findings ──N:1──▶ scan_sessions
components ──N:N──▶ assets (via asset_dependencies)
```

---

## 10. API Endpoints Summary

### Scan Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/scans` | Create scan |
| GET | `/api/v1/scans` | List scans |
| GET | `/api/v1/scans/{id}` | Get scan details |
| PUT | `/api/v1/scans/{id}` | Update scan |
| DELETE | `/api/v1/scans/{id}` | Delete scan |
| POST | `/api/v1/scans/{id}/trigger` | Trigger execution |
| POST | `/api/v1/scans/{id}/pause` | Pause scheduled runs |
| POST | `/api/v1/scans/{id}/activate` | Resume scheduled runs |
| GET | `/api/v1/scans/{id}/runs` | List runs for scan |
| GET | `/api/v1/scans/stats` | Aggregated statistics |

### Agent APIs (Ingest)

| Method | Endpoint | Description | Module |
|--------|----------|-------------|--------|
| POST | `/api/v1/agent/heartbeat` | Agent heartbeat | None |
| GET | `/api/v1/agent/commands` | Poll for commands | `scans` |
| POST | `/api/v1/agent/ingest` | Submit findings | `scans` |
| POST | `/api/v1/agent/ingest/sarif` | SARIF format ingest | `scans` |
| POST | `/api/v1/agent/ingest/check` | Check fingerprints | `scans` |

### Agent Management APIs

| Method | Endpoint | Description | Module |
|--------|----------|-------------|--------|
| GET | `/api/v1/agents` | List agents | `scans` |
| POST | `/api/v1/agents` | Create agent | `scans` |
| GET | `/api/v1/agents/{id}` | Get agent details | `scans` |
| PUT | `/api/v1/agents/{id}` | Update agent | `scans` |
| DELETE | `/api/v1/agents/{id}` | Delete agent | `scans` |

> **Note:** Agent management is bundled with the `scans` module because scanning requires agents to execute.
> The number of agents a tenant can create is controlled by their plan's `agent_limit` field.

---

## 11. Key Design Patterns

### Fingerprinting for Deduplication

```go
// Fingerprint is immutable based on rule + location
fingerprint := sha256(rule_id + file_path + start_line + end_line + message)
```

- Same fingerprint across runs = same vulnerability
- Enables tracking: first detected, last seen, status changes
- Consistent across different tools via shared SDK

### Batch Operations Optimization

```sql
-- Instead of N queries, use 1 batch query
SELECT fingerprint FROM findings WHERE fingerprint IN ($1, $2, $3, ...)

-- Batch insert with conflict handling
INSERT INTO findings (...) VALUES (...), (...), (...)
ON CONFLICT (fingerprint) DO NOTHING

-- Batch update
UPDATE findings SET scan_id = $1 WHERE fingerprint IN ($2, $3, ...)
```

### Command Queue Pattern

- Commands stored in PostgreSQL (work queue)
- Agents poll for available work
- Supports priority ordering
- Handles agent failure gracefully (commands expire)

### Snapshot Refresh for Dependencies

```go
// Delete ALL existing components for targeted assets
DeleteComponentsForAssets(assetIDs)

// Recreate from current scan results
CreateComponents(newComponents)
```

Ensures dependencies stay in sync with current state.

---

## 12. Monitoring & Metrics

### Prometheus Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `scans_scheduled` | Counter | Number of scans scheduled |
| `scan_execution_duration` | Histogram | Scan execution time |
| `agent_active_jobs` | Gauge | Current active jobs per agent |
| `ingest_batch_size` | Histogram | Findings per ingest batch |
| `findings_ingested` | Counter | Total findings ingested |

### Health Checks

- Agent heartbeat every 30 seconds
- Command expiration after TTL
- Automatic status transitions (online → offline)

---

## Summary

The OpenCTEMio scan flow is a **distributed scanning platform** with:

1. **Flexible Configuration**: Multiple scan types, schedules, and profiles
2. **Intelligent Agent Orchestration**: Capability matching, priority queues, failure handling
3. **Optimized Ingest**: Batch processing eliminates N+1 queries
4. **Real-time Deduplication**: Fingerprinting ensures findings aren't duplicated
5. **Multi-tenant Isolation**: All operations scoped by tenant_id
6. **Asset Intelligence**: Automatic provider detection and normalization
7. **Live Monitoring**: UI polling with progressive result display

The architecture separates concerns cleanly:
- **UI**: Configuration, trigger, display
- **Backend**: Validation, orchestration, storage, processing
- **Agents**: Execution, tool integration, result collection
