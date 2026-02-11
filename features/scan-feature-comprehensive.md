---
layout: default
title: Scan Feature - Comprehensive Guide
parent: Features
nav_order: 9
---

# Scan Feature - Comprehensive Guide

## Executive Summary

The Scan feature is the core execution engine of OpenCTEM, orchestrating security assessments across assets. This document provides a complete analysis of the scan architecture, flows, use cases, edge cases, and recommendations.

---

## 1. Architecture Overview

### 1.1 Core Entities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SCAN ARCHITECTURE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                 │
│  │ Scan Config  │────▶│ Scan Session │────▶│  Findings    │                 │
│  │ (Definition) │     │ (Execution)  │     │  (Results)   │                 │
│  └──────────────┘     └──────────────┘     └──────────────┘                 │
│         │                    │                    │                          │
│         │                    │                    │                          │
│         ▼                    ▼                    ▼                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                 │
│  │ Scan Profile │     │ Pipeline Run │     │ Quality Gate │                 │
│  │ (Settings)   │     │ (Workflow)   │     │ (Pass/Fail)  │                 │
│  └──────────────┘     └──────────────┘     └──────────────┘                 │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Entity Relationships

| Entity | Purpose | Key Fields |
|--------|---------|------------|
| **Scan Config** | Defines what, when, how to scan | targets, scanner, schedule |
| **Scan Session** | Tracks individual execution | status, findings, duration |
| **Scan Profile** | Reusable tool configurations | tools_config, quality_gate |
| **Pipeline Run** | Workflow execution record | steps, context, result |

### 1.3 Status Models

#### Scan Config Status
```
                 ┌─────────────────────────────────────┐
                 │                                     │
                 ▼                                     │
    ┌──────────────────┐                              │
    │     ACTIVE       │◀─────────────────────────────┤
    │ (runs scheduled) │                              │
    └────────┬─────────┘                              │
             │                                         │
             │ pause()                                 │ activate()
             ▼                                         │
    ┌──────────────────┐                              │
    │     PAUSED       │──────────────────────────────┘
    │ (keeps schedule) │
    └────────┬─────────┘
             │
             │ disable()
             ▼
    ┌──────────────────┐
    │    DISABLED      │
    │ (no execution)   │
    └──────────────────┘
```

#### Scan Session Status
```
    ┌──────────┐
    │  QUEUED  │ ─────────────────┐
    └────┬─────┘                  │
         │                        │
         ▼                        │ (error/timeout)
    ┌──────────┐                  │
    │ PENDING  │──────────────────┤
    └────┬─────┘                  │
         │                        │
         ▼                        ▼
    ┌──────────┐           ┌──────────┐
    │ RUNNING  │──────────▶│  FAILED  │
    └────┬─────┘           └──────────┘
         │                        ▲
         │                        │
         ├────────────────────────┤
         │ (user cancel)          │
         ▼                        │
    ┌──────────┐           ┌──────────┐
    │COMPLETED │           │ CANCELED │
    └──────────┘           └──────────┘
         │
         │ (exceeded time)
         ▼
    ┌──────────┐
    │ TIMEOUT  │
    └──────────┘
```

---

## 2. Scan Flows

### 2.1 Scan Creation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SCAN CREATION FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

  User                   API                    Service               Database
   │                      │                        │                      │
   │  POST /scans         │                        │                      │
   │─────────────────────▶│                        │                      │
   │                      │  Validate Request      │                      │
   │                      │  - Check name unique   │                      │
   │                      │  - Validate targets    │                      │
   │                      │  - Check SSRF          │                      │
   │                      │────────────────────────▶                      │
   │                      │                        │                      │
   │                      │                        │  Check asset group   │
   │                      │                        │─────────────────────▶│
   │                      │                        │                      │
   │                      │                        │  Validate pipeline   │
   │                      │                        │  (if workflow)       │
   │                      │                        │─────────────────────▶│
   │                      │                        │                      │
   │                      │                        │  Calculate next_run  │
   │                      │                        │  (if scheduled)      │
   │                      │                        │                      │
   │                      │                        │  Create scan record  │
   │                      │                        │─────────────────────▶│
   │                      │                        │                      │
   │                      │                        │  Log audit event     │
   │                      │                        │─────────────────────▶│
   │                      │                        │                      │
   │  201 Created         │◀───────────────────────│                      │
   │◀─────────────────────│                        │                      │
```

### 2.2 Scheduled Scan Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SCHEDULED SCAN EXECUTION FLOW                            │
└─────────────────────────────────────────────────────────────────────────────┘

Scheduler              Service                Agent                 Findings
   │                      │                      │                      │
   │ Tick (1 min)         │                      │                      │
   │                      │                      │                      │
   │ List due scans       │                      │                      │
   │─────────────────────▶│                      │                      │
   │                      │                      │                      │
   │ For each scan:       │                      │                      │
   │                      │                      │                      │
   │ 1. Update next_run   │                      │                      │
   │─────────────────────▶│                      │                      │
   │                      │                      │                      │
   │ 2. Check concurrent  │                      │                      │
   │    limits            │                      │                      │
   │                      │                      │                      │
   │ 3. Check agent       │                      │                      │
   │    availability      │                      │                      │
   │                      │                      │                      │
   │ 4. Trigger scan      │                      │                      │
   │─────────────────────▶│                      │                      │
   │                      │                      │                      │
   │                      │  Create pipeline run │                      │
   │                      │  (if workflow)       │                      │
   │                      │                      │                      │
   │                      │  Create command      │                      │
   │                      │─────────────────────▶│                      │
   │                      │                      │                      │
   │                      │                      │  Execute scanner     │
   │                      │                      │                      │
   │                      │                      │  Report findings     │
   │                      │                      │─────────────────────▶│
   │                      │                      │                      │
   │                      │  Update run status   │                      │
   │                      │◀─────────────────────│                      │
   │                      │                      │                      │
   │                      │  Evaluate quality    │                      │
   │                      │  gate                │                      │
   │                      │─────────────────────▶│                      │
```

### 2.3 Manual Trigger Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MANUAL TRIGGER FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────┘

  User                   API                    Service               Agent
   │                      │                        │                      │
   │ POST /scans/{id}/    │                        │                      │
   │      trigger         │                        │                      │
   │─────────────────────▶│                        │                      │
   │                      │                        │                      │
   │                      │  1. Verify scan exists │                      │
   │                      │     and is active      │                      │
   │                      │────────────────────────▶                      │
   │                      │                        │                      │
   │                      │  2. Check concurrent   │                      │
   │                      │     run limit (max 3)  │                      │
   │                      │                        │                      │
   │                      │  3. Check tenant limit │                      │
   │                      │     (max 50)           │                      │
   │                      │                        │                      │
   │                      │  4. Find available     │                      │
   │                      │     agent              │                      │
   │                      │────────────────────────▶                      │
   │                      │                        │                      │
   │                      │                        │  5. Create command   │
   │                      │                        │─────────────────────▶│
   │                      │                        │                      │
   │                      │  6. Record run stats   │                      │
   │                      │────────────────────────▶                      │
   │                      │                        │                      │
   │  202 Accepted        │                        │                      │
   │  {run_id: "..."}     │                        │                      │
   │◀─────────────────────│                        │                      │
```

### 2.4 Quick Scan Flow (Ad-hoc)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         QUICK SCAN FLOW                                      │
└─────────────────────────────────────────────────────────────────────────────┘

  User                   API                    Service               Agent
   │                      │                        │                      │
   │ POST /scans/quick    │                        │                      │
   │ {targets: [...]}     │                        │                      │
   │─────────────────────▶│                        │                      │
   │                      │                        │                      │
   │                      │  1. Create temp asset  │                      │
   │                      │     group              │                      │
   │                      │────────────────────────▶                      │
   │                      │                        │                      │
   │                      │  2. Create scan config │                      │
   │                      │     (manual schedule)  │                      │
   │                      │────────────────────────▶                      │
   │                      │                        │                      │
   │                      │  3. Trigger scan       │                      │
   │                      │     immediately        │                      │
   │                      │────────────────────────▶─────────────────────▶│
   │                      │                        │                      │
   │  200 OK              │                        │                      │
   │  {scan_id, run_id}   │                        │                      │
   │◀─────────────────────│                        │                      │
```

---

## 3. Use Cases

### 3.1 Primary Use Cases

#### UC-1: Recurring Vulnerability Scan
**Actor:** Security Engineer
**Goal:** Automatically scan web applications weekly for vulnerabilities

```
Preconditions:
- Asset group "Production Web Apps" exists
- Nuclei scanner is available

Flow:
1. Create scan config with schedule_type="weekly"
2. System calculates next_run_at (e.g., Sunday 2:00 AM)
3. Scheduler triggers scan at scheduled time
4. Agent executes Nuclei with templates
5. Findings are ingested and deduplicated
6. Notifications sent if configured

Postconditions:
- Scan runs every Sunday automatically
- New vulnerabilities are tracked
- Statistics updated (total_runs, successful_runs)
```

#### UC-2: CI/CD Pipeline Security Gate
**Actor:** DevOps Pipeline
**Goal:** Block deployment if critical vulnerabilities found

```
Preconditions:
- Scan profile with strict quality gate
- CI/CD integration configured

Flow:
1. Pipeline triggers scan via API
2. Multiple scanners execute (Semgrep, Trivy, Gitleaks)
3. Findings aggregated
4. Quality gate evaluated
5. If passed: Return success, allow deployment
6. If failed: Return failure with breaches

Postconditions:
- Pipeline blocked if quality gate fails
- Breach details available for remediation
```

#### UC-3: Ad-hoc Security Assessment
**Actor:** Penetration Tester
**Goal:** Quick scan of newly discovered asset

```
Preconditions:
- Target domain/IP known
- User has scans:write permission

Flow:
1. User calls POST /scans/quick with targets
2. System validates targets (SSRF check)
3. Temporary asset group created
4. Scan triggered immediately
5. Results available via run API

Postconditions:
- One-off scan completed
- Findings visible in dashboard
```

#### UC-4: Compliance Audit
**Actor:** Compliance Officer
**Goal:** Monthly compliance scan for SOC2

```
Preconditions:
- "Compliance Audit" preset profile exists
- All production assets tagged

Flow:
1. Create scan with compliance profile
2. Enable all compliance-related tools
3. Set strict quality gate (max_critical=0, max_high=0)
4. Schedule monthly on 1st
5. Review results for audit evidence

Postconditions:
- Monthly compliance scan evidence
- Quality gate results for auditors
```

### 3.2 Secondary Use Cases

#### UC-5: Multi-Asset Group Scan
**Actor:** Security Team Lead
**Goal:** Scan multiple environments in one configuration

```
Flow:
1. Create scan with asset_group_ids=[staging, production]
2. All assets from both groups included
3. Single scan config manages both environments
4. Results consolidated
```

#### UC-6: Platform Agent Utilization
**Actor:** Small Team (no self-hosted agents)
**Goal:** Use OpenCTEM's managed cloud agents

```
Flow:
1. Create scan with agent_preference="platform"
2. System routes to platform-managed agents
3. Scan executes in OpenCTEM's cloud
4. Results returned to tenant's workspace
```

#### UC-7: Clone and Customize
**Actor:** Security Engineer
**Goal:** Create variant of existing scan

```
Flow:
1. Clone existing scan: POST /scans/{id}/clone
2. Modify schedule or targets
3. Both original and clone run independently
```

---

## 4. Edge Cases & Error Handling

### 4.1 Concurrency Limits

| Scenario | Limit | Behavior |
|----------|-------|----------|
| Same scan triggered multiple times | 3 concurrent per scan | 4th trigger rejected with 429 |
| Tenant running many scans | 50 concurrent per tenant | Additional triggers queued |
| All agents busy | 0 available | Trigger returns 503 |

### 4.2 Target Validation

| Scenario | Validation | Result |
|----------|------------|--------|
| Internal IP (10.x.x.x) | SSRF check | Rejected 400 |
| localhost/127.0.0.1 | SSRF check | Rejected 400 |
| Invalid domain | DNS validation | Warning logged |
| Too many targets (>1000) | Count check | Rejected 400 |

### 4.3 Schedule Edge Cases

| Scenario | Handling |
|----------|----------|
| Invalid cron expression | Rejected at creation |
| Timezone change (DST) | Recalculated with new offset |
| Missed scheduled run | Run at next check cycle |
| Multiple triggers at same time | Deduplicated by scheduler |

### 4.4 Agent Availability

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AGENT SELECTION DECISION TREE                             │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────┐
                    │ Agent Preference │
                    └────────┬─────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
    ┌─────────┐        ┌─────────┐        ┌─────────┐
    │  AUTO   │        │ TENANT  │        │PLATFORM │
    └────┬────┘        └────┬────┘        └────┬────┘
         │                  │                  │
         ▼                  ▼                  ▼
    Try tenant        Check tenant        Check platform
    agents first      agents only         agents only
         │                  │                  │
         │                  │                  │
    ┌────┴────┐        ┌────┴────┐        ┌────┴────┐
    │Available│        │Available│        │Available│
    │   ?     │        │   ?     │        │   ?     │
    └────┬────┘        └────┬────┘        └────┬────┘
    Yes  │  No         Yes  │  No         Yes  │  No
    │    │              │    │              │    │
    ▼    ▼              ▼    ▼              ▼    ▼
   Use  Fallback      Use  Error 503     Use  Error 503
 tenant to platform tenant              platform
```

### 4.5 Pipeline/Workflow Edge Cases

| Scenario | Handling |
|----------|----------|
| Pipeline deleted after scan created | Error at trigger time, scan status unchanged |
| Pipeline step fails | Run marked failed, subsequent steps skipped |
| Tool not available on agent | Step skipped, warning logged |
| Timeout exceeded | Run marked timeout, partial results saved |

### 4.6 Finding Ingestion Edge Cases

| Scenario | Handling |
|----------|----------|
| Duplicate finding | Deduplicated by fingerprint |
| Finding on deleted asset | Orphaned, linked to scan only |
| Very large finding count | Paginated, quality gate still evaluated |
| Invalid finding format | Rejected, error logged |

---

## 5. Integration Points

### 5.1 Integration Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SCAN INTEGRATION POINTS                                │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │    SCAN      │
                              │   CONFIG     │
                              └──────┬───────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│   ASSET GROUPS   │      │    PIPELINES     │      │   SCAN PROFILES  │
│                  │      │                  │      │                  │
│ - Targets        │      │ - Workflow steps │      │ - Tool settings  │
│ - Asset metadata │      │ - Tool sequence  │      │ - Quality gate   │
└────────┬─────────┘      └────────┬─────────┘      └────────┬─────────┘
         │                         │                         │
         │                         │                         │
         ▼                         ▼                         ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│     AGENTS       │      │    COMMANDS      │      │    FINDINGS      │
│                  │      │                  │      │                  │
│ - Tenant agents  │      │ - Execution jobs │      │ - Vulnerabilities│
│ - Platform agents│      │ - Tool invocation│      │ - Quality result │
└──────────────────┘      └──────────────────┘      └──────────────────┘
         │                                                   │
         │                                                   │
         ▼                                                   ▼
┌──────────────────┐                              ┌──────────────────┐
│  NOTIFICATIONS   │                              │   AUDIT LOGS     │
│                  │                              │                  │
│ - Slack/Email    │                              │ - All operations │
│ - Webhooks       │                              │ - Compliance     │
└──────────────────┘                              └──────────────────┘
```

### 5.2 Integration Details

| Integration | Direction | Data Exchanged |
|-------------|-----------|----------------|
| Asset Groups | Scan → Assets | Target list extraction |
| Pipelines | Scan → Pipeline | Workflow execution |
| Scan Profiles | Scan → Profile | Tool config, quality gate |
| Agents | Scan → Agent | Command dispatch |
| Findings | Agent → Scan | Vulnerability data |
| Notifications | Scan → Notif | Scan events |
| Audit | Scan → Audit | All CRUD + status changes |

---

## 6. Security Considerations

### 6.1 Implemented Security Controls

| Control | Implementation | Location |
|---------|----------------|----------|
| Tenant Isolation | tenant_id in all queries | Repository layer |
| SSRF Protection | validateTargets() | Service layer |
| Rate Limiting | Concurrent limits (3/scan, 50/tenant) | Service layer |
| Audit Logging | logAudit() on all operations | Service layer |
| Permission Check | RBAC middleware | Handler layer |
| Input Validation | go-playground/validator | Handler layer |

### 6.2 Security Recommendations

1. **Cron Expression Validation**
   - Current: Basic parsing check
   - Recommended: Add ReDoS protection for complex expressions

2. **Scanner Config Validation**
   - Current: Passed through to agent
   - Recommended: Whitelist allowed config keys

3. **Target Re-validation**
   - Current: Only on creation
   - Recommended: Re-validate on trigger

4. **Agent Authentication**
   - Current: Token-based
   - Recommended: Add mutual TLS for sensitive scans

---

## 7. Performance Considerations

### 7.1 Current Limits

| Resource | Limit | Rationale |
|----------|-------|-----------|
| Concurrent scans per config | 3 | Prevent resource exhaustion |
| Concurrent scans per tenant | 50 | Fair usage |
| Targets per scan | 1000 | Memory constraints |
| Scheduler batch size | 50 | Prevent thundering herd |
| Scheduler interval | 1 minute | Balance freshness vs load |

### 7.2 Optimization Opportunities

1. **Next Run Calculation**
   - Current: Computed in domain entity
   - Opportunity: Cache with Redis

2. **Due Scan Query**
   - Current: Full table scan with index
   - Opportunity: Partitioned by tenant

3. **Target Extraction**
   - Current: Fetches all assets
   - Opportunity: Batch/paginate large groups

---

## 8. Monitoring & Observability

### 8.1 Key Metrics

| Metric | Type | Alert Threshold |
|--------|------|-----------------|
| `scan_trigger_total` | Counter | - |
| `scan_trigger_duration_seconds` | Histogram | p99 > 30s |
| `scan_concurrent_runs` | Gauge | > 80% limit |
| `scan_scheduler_lag_seconds` | Gauge | > 5 min |
| `scan_quality_gate_pass_rate` | Gauge | < 70% |

### 8.2 Logging

| Event | Log Level | Fields |
|-------|-----------|--------|
| Scan created | INFO | scan_id, tenant_id, scan_type |
| Scan triggered | INFO | scan_id, run_id, agent_id |
| Scan completed | INFO | scan_id, run_id, duration, findings |
| Scan failed | ERROR | scan_id, run_id, error |
| Concurrent limit hit | WARN | scan_id, tenant_id, current_count |
| SSRF blocked | WARN | scan_id, blocked_target |

---

## 9. Known Issues & Technical Debt

### 9.1 Current Issues

| Issue | Severity | Impact | Mitigation |
|-------|----------|--------|------------|
| Race condition in concurrent check | Medium | Double trigger possible | Use DB-level atomic check |
| Missing target re-validation | Low | Stale SSRF check | Add validation on trigger |
| Frontend/Backend type mismatch | Low | UI mapping needed | Align enums |

### 9.2 Technical Debt

1. **Cron parsing in domain layer**
   - Should be in infrastructure/utility layer
   - Domain should receive pre-parsed schedule

2. **Asset group ID migration**
   - Old: single `asset_group_id`
   - New: array `asset_group_ids`
   - Both supported, need cleanup

3. **Status change without actor**
   - pause/activate don't capture user ID
   - Audit logs missing actor

---

## 10. Recommendations

### 10.1 Short-term (This Sprint)

1. **Add actor tracking to pause/activate** ✅ (Implemented)
   - Extract user ID from context
   - Pass to audit log

2. **Fix concurrent check race condition**
   - Use `SELECT FOR UPDATE` or atomic increment
   - Ensure exactly-once execution

3. **Add duplicate preset name check** ✅ (Implemented)
   - Check existing names before create
   - Show warning in UI

### 10.2 Medium-term (Next Quarter)

1. **Implement scan queue**
   - Instead of rejecting on limit, queue scans
   - Process in order when capacity available

2. **Add scan templates**
   - Pre-configured scan setups
   - Clone from template with modifications

3. **Enhance scheduling**
   - Add blackout windows
   - Support scan dependencies

### 10.3 Long-term (Roadmap)

1. **Distributed scheduler**
   - Leader election for HA
   - Horizontal scaling

2. **Scan orchestration**
   - Complex scan DAGs
   - Conditional execution

3. **ML-based scheduling**
   - Predict optimal scan times
   - Auto-adjust based on findings

---

## 11. API Quick Reference

### Scan Configurations

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Create | POST | `/api/v1/scans` |
| List | GET | `/api/v1/scans` |
| Get | GET | `/api/v1/scans/{id}` |
| Update | PUT | `/api/v1/scans/{id}` |
| Delete | DELETE | `/api/v1/scans/{id}` |
| Trigger | POST | `/api/v1/scans/{id}/trigger` |
| Clone | POST | `/api/v1/scans/{id}/clone` |
| Pause | POST | `/api/v1/scans/{id}/pause` |
| Activate | POST | `/api/v1/scans/{id}/activate` |
| Disable | POST | `/api/v1/scans/{id}/disable` |
| Quick Scan | POST | `/api/v1/scans/quick` |
| Stats | GET | `/api/v1/scans/stats` |
| List Runs | GET | `/api/v1/scans/{id}/runs` |
| Get Run | GET | `/api/v1/scans/{id}/runs/{runId}` |

### Scan Profiles

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Create | POST | `/api/v1/scan-profiles` |
| List | GET | `/api/v1/scan-profiles` |
| Get | GET | `/api/v1/scan-profiles/{id}` |
| Update | PUT | `/api/v1/scan-profiles/{id}` |
| Delete | DELETE | `/api/v1/scan-profiles/{id}` |
| Clone | POST | `/api/v1/scan-profiles/{id}/clone` |
| Set Default | POST | `/api/v1/scan-profiles/{id}/set-default` |
| Update QG | PUT | `/api/v1/scan-profiles/{id}/quality-gate` |
| Evaluate QG | POST | `/api/v1/scan-profiles/{id}/evaluate-quality-gate` |

---

## 12. Glossary

| Term | Definition |
|------|------------|
| Scan Config | Configuration defining what, when, and how to scan |
| Scan Session | Individual execution instance of a scan |
| Scan Profile | Reusable tool and quality gate configuration |
| Quality Gate | Pass/fail criteria based on finding thresholds |
| Pipeline | Multi-step workflow with multiple tools |
| Agent | Execution engine (tenant-deployed or platform-managed) |
| SSRF | Server-Side Request Forgery protection |
| Crontab | Unix-style schedule expression |

---

## Appendix A: Preset Profiles

| Profile | Tools | Quality Gate | Use Case |
|---------|-------|--------------|----------|
| Discovery Scan | nuclei, syft | Disabled | Asset enumeration |
| Quick Security Check | semgrep, trivy, gitleaks, nuclei | Fail on critical | CI/CD fast check |
| Full Security Scan | All 8 tools | Strict thresholds | Comprehensive audit |
| Compliance Audit | semgrep, trivy, checkov, tfsec, gitleaks | Zero tolerance | Regulatory compliance |

---

## Appendix B: Status Codes

| Code | Scenario |
|------|----------|
| 200 | Successful operation |
| 201 | Scan/profile created |
| 202 | Scan triggered (async) |
| 400 | Invalid request (validation, SSRF) |
| 403 | Permission denied |
| 404 | Scan/profile not found |
| 409 | Duplicate name |
| 429 | Concurrent limit exceeded |
| 500 | Internal server error |
| 503 | No agents available |

---

*Last updated: 2026-02-02*
*Authors: Security Engineering Team*
