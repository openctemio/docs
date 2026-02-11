# Preset Pipeline Templates

**Created:** 2026-01-26
**Status:** ✅ COMPLETED
**Migration:** `000090_preset_pipeline_templates.up.sql`

---

## Overview

Preset pipeline templates are system-level templates that demonstrate best practices for parallel execution patterns in security scanning workflows. These templates are owned by the System tenant (`00000000-0000-0000-0000-000000000000`) and marked with `is_system_template = true`.

---

## Templates Summary

| Template | Steps | Pattern | Use Case |
|----------|-------|---------|----------|
| Subdomain Enumeration | 4 | Parallel tools → Merge | Multi-tool discovery |
| Port Scanning | 3 | Sequential progression | Deep scanning |
| Full Reconnaissance | 6 | Complex DAG | Comprehensive recon |
| Web Vulnerability Scan | 5 | Fan-out/Fan-in | Multi-scanner vuln assessment |
| API Security Testing | 4 | Sequential chain | API-focused testing |
| Continuous Monitoring | 4 | Lightweight parallel | Scheduled monitoring |

---

## 1. Subdomain Enumeration

### Pattern: Parallel Tools with Merge

```
[amass_enum] ────────┐
                     ├──► [dedupe_merge] ──► [dns_resolve]
[subfinder_enum] ────┘
```

### Steps

| Step Key | Tool | Capabilities | Depends On | Timeout |
|----------|------|--------------|------------|---------|
| `amass_enum` | amass | recon, subdomain | - | 30min |
| `subfinder_enum` | subfinder | recon, subdomain | - | 15min |
| `dedupe_merge` | - | data, transform | amass_enum, subfinder_enum | 5min |
| `dns_resolve` | dnsx | recon, dns | dedupe_merge | 10min |

### Execution Flow

1. **amass_enum** and **subfinder_enum** start immediately (no dependencies)
2. Both run in parallel due to `MaxParallelSteps: 3`
3. **dedupe_merge** waits for BOTH to complete (multiple dependencies)
4. **dns_resolve** runs after merge

### Configuration

```json
{
  "max_parallel_steps": 3,
  "fail_fast": false,
  "timeout_seconds": 7200
}
```

---

## 2. Port Scanning

### Pattern: Sequential Progression

```
[fast_port_scan] ──► [deep_port_scan] ──► [service_detect]
```

### Steps

| Step Key | Tool | Capabilities | Depends On | Config |
|----------|------|--------------|------------|--------|
| `fast_port_scan` | naabu | recon, ports | - | top_ports: 1000 |
| `deep_port_scan` | naabu | recon, ports | fast_port_scan | ports: 1-65535 |
| `service_detect` | nmap | recon, service | deep_port_scan | -sV |

### Use Case

- Start with fast scan to identify responsive hosts
- Deep scan only on hosts that responded
- Service detection on discovered ports

---

## 3. Full Reconnaissance

### Pattern: Complex DAG (Directed Acyclic Graph)

```
                      ┌──► [http_probe] ──┬──► [screenshot]
[subdomain_enum] ────┤                    │
                      └──► [port_scan] ───┴──► [tech_detect] ──► [vuln_scan]
```

### Steps

| Step Key | Tool | Depends On | Description |
|----------|------|------------|-------------|
| `subdomain_enum` | subfinder | - | Entry point |
| `http_probe` | httpx | subdomain_enum | Parallel branch 1 |
| `port_scan` | naabu | subdomain_enum | Parallel branch 2 |
| `screenshot` | gowitness | http_probe | Leaf node |
| `tech_detect` | wappalyzer | http_probe, port_scan | Merge point |
| `vuln_scan` | nuclei | tech_detect | Final scan |

### Execution Flow

1. `subdomain_enum` starts
2. `http_probe` and `port_scan` run in parallel
3. `screenshot` starts when `http_probe` completes
4. `tech_detect` waits for BOTH `http_probe` AND `port_scan`
5. `vuln_scan` runs last

### Configuration

```json
{
  "max_parallel_steps": 4,
  "timeout_seconds": 14400,
  "notify_on_complete": true,
  "notify_on_failure": true
}
```

---

## 4. Web Vulnerability Scan

### Pattern: Fan-out/Fan-in

```
            ┌──► [xss_scan] ────┐
[web_crawl] ├──► [sqli_scan] ───┼──► [report_gen]
            └──► [nuclei_cve] ──┘
```

### Steps

| Step Key | Tool | Capabilities | Depends On |
|----------|------|--------------|------------|
| `web_crawl` | katana | recon, crawl | - |
| `xss_scan` | dalfox | vulnerability, xss | web_crawl |
| `sqli_scan` | sqlmap | vulnerability, sqli | web_crawl |
| `nuclei_cve` | nuclei | vulnerability, scan | web_crawl |
| `report_gen` | - | report, aggregate | xss_scan, sqli_scan, nuclei_cve |

### Use Case

- Crawl application once
- Run multiple vulnerability scanners in parallel
- Aggregate results into single report

---

## 5. API Security Testing

### Pattern: Sequential Chain

```
[api_discovery] ──► [api_fuzz] ──► [auth_test] ──► [rate_limit_test]
```

### Steps

| Step Key | Tool | Config Highlights |
|----------|------|-------------------|
| `api_discovery` | kiterunner | wordlist: routes-large |
| `api_fuzz` | ffuf | mc: 200,201,204,301,302,307,401,403,500 |
| `auth_test` | nuclei | tags: auth,jwt,oauth |
| `rate_limit_test` | - | requests_per_second: 100 |

### Configuration

```json
{
  "max_parallel_steps": 2,
  "fail_fast": true
}
```

---

## 6. Continuous Monitoring

### Pattern: Lightweight Parallel

```
[dns_check] ──┬──► [http_check] ──► [cert_check]
              │
[port_check] ─┘
```

### Steps

| Step Key | Tool | Timeout |
|----------|------|---------|
| `dns_check` | dnsx | 5min |
| `port_check` | naabu | 5min |
| `http_check` | httpx | 5min |
| `cert_check` | tlsx | 5min |

### Use Case

- Lightweight checks for scheduled execution
- Every 4 hours monitoring
- Quick failure detection

### Configuration

```json
{
  "max_parallel_steps": 3,
  "timeout_seconds": 1800
}
```

---

## Parallel Execution Logic

### How Dependencies Work

The pipeline orchestrator uses `GetRunnableSteps()` to determine which steps can run:

```go
// A step is runnable when:
// 1. Status is 'pending'
// 2. ALL dependencies are in 'completed' status

for _, step := range allSteps {
    if step.Status != "pending" {
        continue
    }

    allDepsComplete := true
    for _, depKey := range step.DependsOn {
        if completedSteps[depKey] != "completed" {
            allDepsComplete = false
            break
        }
    }

    if allDepsComplete {
        runnableSteps = append(runnableSteps, step)
    }
}
```

### MaxParallelSteps Setting

Controls how many steps can run simultaneously:

```go
// Limit concurrent step executions
if len(runningSteps) >= template.Settings.MaxParallelSteps {
    return // Wait for a slot to free up
}
```

### Example: Full Recon Execution

```
T0: Start
    → subdomain_enum (running)

T1: subdomain_enum completes
    → http_probe (running)
    → port_scan (running)

T2: http_probe completes
    → screenshot (running)  // Only depends on http_probe
    → tech_detect (waiting) // Still waiting for port_scan

T3: port_scan completes
    → tech_detect (running) // Both deps now complete

T4: screenshot completes
    → (no new steps)

T5: tech_detect completes
    → vuln_scan (running)

T6: vuln_scan completes
    → Pipeline COMPLETED
```

---

## UI Position Convention

Steps include `ui_position_x` and `ui_position_y` for visual workflow builder:

```
Y=50:   Entry points (no dependencies)
Y=200:  First parallel layer
Y=350:  Second layer / merge points
Y=500:  Final steps
```

X positions create horizontal spread for parallel steps.

---

## Migration Details

### File: `000090_preset_pipeline_templates.up.sql`

- Creates 6 templates
- Creates 26 steps total
- Uses System tenant: `00000000-0000-0000-0000-000000000000`
- All marked with `is_system_template = true`
- Tagged with `preset` for easy filtering

### Rollback: `000090_preset_pipeline_templates.down.sql`

- Deletes all steps first (FK constraint)
- Deletes all 6 templates
- Does NOT delete System tenant

---

## Usage

### List Preset Templates

```sql
SELECT name, description, tags
FROM pipeline_templates
WHERE is_system_template = true
  AND 'preset' = ANY(tags);
```

### Clone Template for Tenant (Manual)

Users can manually clone system templates to customize:

```go
// Clone creates a copy with new ID for the user's tenant
clonedTemplate := systemTemplate.Clone()
clonedTemplate.TenantID = userTenantID
clonedTemplate.IsSystemTemplate = false
```

### Auto-Clone on Trigger (Copy-on-Use Pattern)

When a user triggers a system template directly, the system automatically clones it:

```
User clicks "Run" on System Template
    │
    ▼
TriggerPipeline()
    │
    ├── Check: is_system_template == true?
    │       │
    │       └── YES: Find or create tenant clone
    │           │
    │           ├── Check for existing clone (by tenant_id + name)
    │           │   │
    │           │   ├── Found: Use existing clone
    │           │   │
    │           │   └── Not Found: Clone system template
    │           │       │
    │           │       ├── Validate tools are available
    │           │       ├── Copy template with new ID
    │           │       ├── Copy all steps
    │           │       └── Set is_system_template = false
    │           │
    │           └── Trigger the tenant clone (not the system template)
    │
    └── NO: Trigger directly
```

**Key Points:**
1. **System templates are never triggered directly** - they serve as blueprints
2. **Auto-clone checks for existing clone first** - prevents duplicate clones
3. **Tools are validated EVERY trigger** - ensures all referenced tools are active (both for new clones AND existing clones)
4. **Clones become tenant-owned pipelines** - fully editable by the user

### Security Considerations

| Risk | Mitigation |
|------|-----------|
| **Outdated clone with disabled tools** | Tools re-validated on every trigger, not just on clone creation |
| **Unauthorized tenant access** | Clones are bound to tenant_id, tenant isolation enforced |
| **System template modification** | System templates are read-only (`is_system_template=true`), only clones are editable |
| **SQL Injection** | All queries use parameterized statements |
| **Tool disabled/deleted while pipeline active** | Cascade deactivation: pipelines using the tool are auto-deactivated |

### Tool Lifecycle - Pipeline Cascade Deactivation

When a tool is **deactivated** or **deleted**, all active pipelines that use that tool are automatically deactivated:

```
Admin deactivates/deletes Tool "nuclei"
    │
    ▼
ToolService.DeactivateTool() / DeleteTool()
    │
    ├── Find active pipelines using "nuclei"
    │   (via FindPipelineIDsByToolName)
    │
    ├── For each pipeline:
    │   └── Set is_active = false
    │
    └── Log: "cascade deactivated N pipelines"
```

**Validation Points (Defense in Depth):**

| Action | Validation | When |
|--------|-----------|------|
| **Activate Pipeline** | `ValidateToolReferences` | Before activation |
| **Trigger Pipeline** | `ValidateToolReferences` | Before trigger (on existing clone too) |
| **Deactivate Tool** | Cascade deactivate pipelines | During tool deactivation |
| **Delete Tool** | Cascade deactivate pipelines | Before tool deletion |
| **UI Visual Builder** | Show red border on steps without tool | Real-time in editor |

This ensures pipelines cannot execute with missing/inactive tools, even if:
1. Tool was deactivated after pipeline was created
2. Tool was deleted from registry
3. Tool's tenant config was disabled

### Database Query Optimization

**Before (N+1 Problem):**
```
GetScanManagementStats():
├── getPipelineRunStats(): 5 queries (1 per status)
├── getStepRunStats(): 1 + N queries (N = number of runs, up to 100)
└── getCommandStats(): 6 queries (1 per status)
Total: ~112 queries per request!
```

**After (Single Query Aggregation):**
```
GetScanManagementStats():
├── getPipelineRunStats(): 1 query (using FILTER aggregation)
├── getStepRunStats(): 1 query (using JOIN + FILTER aggregation)
└── getCommandStats(): 1 query (using FILTER aggregation)
Total: 3 queries per request
```

**SQL Example (Optimized):**
```sql
-- Single query aggregation with PostgreSQL FILTER clause
SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'running') as running,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status IN ('failed', 'timeout')) as failed,
    COUNT(*) FILTER (WHERE status = 'canceled') as canceled
FROM pipeline_runs
WHERE tenant_id = $1
```

### UI Stats Display

The UI separates pipeline counts into two categories:

| Stat | Description |
|------|-------------|
| **My Pipelines** | Tenant-owned pipelines only (excludes system templates) |
| **Active** | Active tenant-owned pipelines |
| **Total Runs** | Pipeline run count (includes runs from both tenant and auto-cloned system templates) |
| **Success Rate** | Completed / Total runs percentage |

**Example Flow:**
```
Initial state:
- System Templates: 5
- My Pipelines: 0

User triggers "Web Vulnerability Scan" (system template):
- Auto-clones to tenant with name "Web Vulnerability Scan"
- Runs the cloned pipeline

After trigger:
- System Templates: 5 (unchanged)
- My Pipelines: 1 (new clone created)
- Total Runs: 1
```

### View Template Execution Graph

```sql
SELECT
    step_key,
    name,
    tool,
    depends_on,
    ui_position_x,
    ui_position_y
FROM pipeline_steps
WHERE pipeline_id = '<template-id>'
ORDER BY step_order;
```

---

## References

- [Pipeline Domain Model](/api/internal/domain/pipeline/)
- [Pipeline Service](/api/internal/app/pipeline_service.go)
- [Step Scheduling Logic](/api/internal/app/pipeline_service.go#scheduleRunnableSteps)
