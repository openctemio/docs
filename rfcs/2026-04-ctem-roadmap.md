# RFC: OpenCTEM Platform Roadmap — CTEM Framework Alignment

**Date**: 2026-04-13  
**Status**: Draft  
**Author**: Platform Team

---

## Current State: 14/25 (56% CTEM Maturity)

```
PHASE 1: SCOPING          ⭐⭐⭐☆☆  3/5 (60%)
PHASE 2: DISCOVERY         ⭐⭐⭐⭐☆  4/5 (80%)
PHASE 3: PRIORITIZATION    ⭐⭐⭐☆☆  3/5 (60%)
PHASE 4: VALIDATION        ⭐⭐☆☆☆  2/5 (40%)
PHASE 5: MOBILIZATION      ⭐⭐☆☆☆  2/5 (40%)  ← critical bottleneck
```

**Biggest gap**: Platform discovers vulnerabilities well but lacks business layer to remediate them efficiently. Customers use OpenCTEM as a scanner, not a platform.

---

## Target: 24/25 (96%) by end of 2026

```
Q2 2026: 14 → 19/25  (Mobilization + Prioritization)
Q3 2026: 19 → 22/25  (Validation + Discovery)
Q4 2026: 22 → 24/25  (Scoping + Polish)
```

---

## Phase 1: Asset Type Consolidation

### Problem
33 asset types → sidebar sprawl, overlapping types, inconsistent properties.

### Solution: Category + SubType (4 phases, no breaking change)

**Step 1 — Category mapping** (no DB change, 1 week)
```
external_surface  → domain, subdomain, certificate, ip_address
application       → website, web_application, api, mobile_app, service
infrastructure    → host, container, kubernetes_cluster, kubernetes_namespace
network           → network, vpc, subnet, firewall, load_balancer
cloud             → cloud_account, compute, storage, serverless, container_registry
data              → database, data_store, s3_bucket
code              → repository
identity          → iam_user, iam_role, service_account
discovery         → open_port, http_service, discovered_url
unclassified      → unclassified
```

**Step 2 — UI consolidation** (2-3 weeks)
Gộp 30+ sidebar pages → 10 category pages với tabs filter by type.

**Step 3 — Type aliasing** (1 month)
```
compute    → host (sub_type: compute)
serverless → host (sub_type: serverless)
data_store → database (sub_type: data_store)
s3_bucket  → storage (sub_type: s3_bucket)
```
Ingest API chấp nhận type cũ, auto-alias. Không break collectors.

**Step 4 — Sub-type field** (1 sprint)
```sql
ALTER TABLE assets ADD COLUMN sub_type VARCHAR(50);
```
Target: 12 core types + unlimited sub_types.

---

## Phase 2: Mobilization (Q2 2026) — HIGHEST PRIORITY

### Why first?
Without remediation workflows, customers can't close the CTEM loop. Discovery without remediation = noise.

### 2.1 Vulnerability Group View
**Problem**: 500 Log4j findings = 500 individual items. Should be 1 vulnerability with 500 affected assets.

**Solution**:
- API: `GET /api/v1/findings/grouped?group_by=cve_id` → aggregate by CVE/CWE
- UI: Vulnerability list page with expandable asset list per CVE
- Priority: each group shows worst severity + total affected count

**Effort**: 3-4 days  
**Impact**: 🔴 Critical (every team needs this daily)

### 2.2 Remediation Campaigns
**Problem**: No way to track "fix all Log4j" as a campaign with progress.

**Solution**:
```
Campaign lifecycle: draft → active → validating → completed
Fields: name, description, findings[], assignee, deadline, progress%
```
- Link campaign to finding filter (severity=critical, cve=CVE-2021-44228)
- Auto-calculate progress from finding status changes
- Dashboard: burndown chart, team assignments, SLA compliance

**Effort**: 2 weeks  
**Dependencies**: Vulnerability Group View

### 2.3 ITSM Integration (Jira)
**Problem**: Findings exist in OpenCTEM but tickets created manually in Jira.

**Solution**:
- Bidirectional sync: finding status ↔ Jira ticket status
- Auto-create ticket from finding/campaign
- Webhook listener for Jira status changes → update finding

**Effort**: 2 weeks  
**Dependencies**: Integration entity (already exists)

### 2.4 Finding Exceptions
**Problem**: False positives and accepted risks need audit trail + expiration.

**Solution**:
- Exception types: false_positive, accepted_risk, compensating_control
- Approval workflow: requester → reviewer → approved/rejected
- Expiration: auto-reopen after N days for re-evaluation
- Audit trail: who approved, when, why

**Effort**: 1 week

### 2.5 Risk Reduction Tracking
**Problem**: Can't show "this campaign reduced risk by 30%".

**Solution**:
- Snapshot risk score before campaign starts
- Calculate delta when findings resolved
- Dashboard: risk trend over time, per campaign

**Effort**: 1 week  
**Dependencies**: Remediation Campaigns

---

## Phase 3: Prioritization Enhancement (Q2-Q3 2026)

### 3.1 Threat Intel Feed Automation
**Problem**: EPSS/KEV data is stale (manual seed, no auto-refresh).

**Solution**:
- Asynq cron job: daily EPSS refresh from FIRST.org API
- Asynq cron job: daily CISA KEV refresh
- Auto-escalate findings when CVE appears in KEV
- Webhook for custom threat feeds

**Effort**: 1 week  
**Impact**: 🔴 Critical for enterprise

### 3.2 Attack Path Scoring
**Problem**: Can fix asset X but don't know how many attack paths it breaks.

**Solution**:
- Graph traversal on asset relationships
- Score = number of paths from internet-facing → crown jewel that pass through this asset
- UI: "Fixing this asset eliminates 12 attack paths"

**Effort**: 2 weeks  
**Dependencies**: Asset relationships (exists), Crown Jewels (Phase 5)

### 3.3 Trending Risks
**Problem**: No velocity metric — is exposure growing faster than remediation?

**Solution**:
- Risk velocity = (new findings per week) - (resolved findings per week)
- Positive = losing ground, negative = improving
- Dashboard: trend line over 30/60/90 days

**Effort**: 3 days

---

## Phase 4: Validation Completion (Q3 2026)

### 4.1 Verification Scan Automation
**Problem**: After remediation, must manually re-scan to verify fix.

**Solution**:
- When finding status → "remediated", auto-trigger targeted scan
- Scan result updates finding to "verified" or back to "open"
- Wire via existing workflow engine (trigger: finding_status_changed)

**Effort**: 1 week

### 4.2 MITRE ATT&CK Coverage Heatmap
**Problem**: Can't visualize "which ATT&CK techniques have we tested?"

**Solution**:
- Map findings (OWASP/CWE) → MITRE techniques (mapping data exists)
- Map pentest campaigns → techniques tested
- UI: ATT&CK matrix heatmap with coverage percentage per technique

**Effort**: 2 weeks  
**Dependencies**: MITRE mapping data (exists in `mitre-attack.ts`)

### 4.3 Detection Coverage Testing
**Problem**: No way to measure "can our SIEM detect technique X?"

**Solution**:
- Control test results linked to MITRE techniques
- Pass/fail per technique per detection tool
- Dashboard: detection coverage % across ATT&CK matrix

**Effort**: 1 week  
**Dependencies**: Control test API (exists), MITRE mapping

### 4.4 MTTR/MTTD Metrics
**Problem**: No mean-time-to-detect or mean-time-to-remediate tracking.

**Solution**:
- MTTD = avg(finding.created_at - finding.first_seen)
- MTTR = avg(finding.resolved_at - finding.created_at)
- Dashboard: trend over time, by severity, by team

**Effort**: 3 days

---

## Phase 5: Scoping & Discovery Extension (Q4 2026)

### 5.1 Business Units & Crown Jewels API
**Problem**: UI pages exist with mock data, no backend.

**Solution**:
- Business unit CRUD + asset linkage
- Crown jewel designation + impact scoring
- Risk aggregation per business unit

**Effort**: 1 week each

### 5.2 Compliance Framework Seeding
**Problem**: Compliance mapping is empty.

**Solution**:
- Seed data: PCI-DSS 4.0, SOC 2, ISO 27001, NIST CSF, CIS Controls
- Control → finding mapping rules
- Compliance dashboard: % controls met per framework

**Effort**: 2 weeks

### 5.3 Host & Container Discovery
**Problem**: No infrastructure scan integration.

**Solution**:
- Nessus/Qualys result import (via CTIS adapter in SDK)
- Kubernetes API sync (cluster → namespace → workload → container)
- CMDB import (ServiceNow, BMC)

**Effort**: 2 weeks per integration

### 5.4 Identity Risk Discovery
**Problem**: No IAM analysis.

**Solution**:
- AD/LDAP user enumeration
- MFA coverage tracking
- Dormant account detection
- Over-privileged role analysis

**Effort**: 3 weeks

---

## Phase 6: Platform Hardening (2027+)

### 6.1 Asset Type Finalization
- Complete type aliasing (Phase 1 Step 3-4)
- API v2 with 12 core types + sub_types
- Deprecate v1 types

### 6.2 Advanced Threat Intel
- STIX/TAXII feed connector
- Threat actor profiles linked to CVEs
- Industry-specific threat landscape

### 6.3 AI-Assisted Operations
- AI finding dedup (leverage existing AI Triage service)
- AI remediation recommendations
- Natural language risk queries

### 6.4 Advanced Integrations
- ServiceNow bidirectional sync
- Splunk/ELK SIEM connector
- Cloud posture management (AWS Security Hub, Azure Defender)

---

## Priority Matrix

| Item | Impact | Effort | Phase | Quarter |
|------|--------|--------|-------|---------|
| Vulnerability Group View | 🔴 Critical | 3-4 days | Mobilization | Q2 |
| Remediation Campaigns | 🔴 Critical | 2 weeks | Mobilization | Q2 |
| Jira Integration | 🔴 Critical | 2 weeks | Mobilization | Q2 |
| Threat Intel Automation | 🔴 Critical | 1 week | Prioritization | Q2 |
| Finding Exceptions | 🟠 High | 1 week | Mobilization | Q2 |
| Risk Reduction Tracking | 🟠 High | 1 week | Mobilization | Q2 |
| Trending Risks | 🟠 High | 3 days | Prioritization | Q2 |
| Asset Type Category Mapping | 🟠 High | 1 week | Consolidation | Q2 |
| UI Sidebar Consolidation | 🟠 High | 2-3 weeks | Consolidation | Q3 |
| Verification Scan Auto | 🟡 Medium | 1 week | Validation | Q3 |
| MITRE ATT&CK Heatmap | 🟡 Medium | 2 weeks | Validation | Q3 |
| MTTR/MTTD Dashboard | 🟡 Medium | 3 days | Validation | Q3 |
| Business Units API | 🟡 Medium | 1 week | Scoping | Q4 |
| Crown Jewels API | 🟡 Medium | 1 week | Scoping | Q4 |
| Compliance Seeding | 🟡 Medium | 2 weeks | Scoping | Q4 |
| Host Discovery | 🟡 Medium | 2 weeks | Discovery | Q4 |
| Attack Path Scoring | 🟡 Medium | 2 weeks | Prioritization | Q4 |
| Type Aliasing | 🔵 Low | 1 month | Consolidation | Q4 |

---

## Success Metrics

| Metric | Current | Q2 Target | Q4 Target |
|--------|---------|-----------|-----------|
| CTEM Score | 14/25 | 19/25 | 24/25 |
| Asset Types | 33 (sprawl) | 33 (categorized) | 12+sub_types |
| Sidebar Pages | 30+ | 30+ (categorized) | 10 |
| Integrations | 5 notification | +Jira | +ServiceNow, +Nessus |
| Threat Intel | Manual | Auto-daily | +STIX/TAXII |
| Remediation | Per-finding | Campaigns | +ITSM sync |
| MTTR visibility | None | Basic | Full dashboard |

---

## Risk Factors

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Type aliasing breaks collectors | Medium | High | Backward-compatible aliases, never delete types |
| Jira integration scope creep | High | Medium | MVP: one-way sync first, bidirectional Q3 |
| Threat intel data volume | Medium | Medium | Rate limiting, incremental updates |
| UI consolidation regression | Low | Medium | Feature flags, gradual rollout |

---

## References

- [Gartner CTEM Framework](https://www.gartner.com/en/articles/how-to-manage-cybersecurity-threats-not-episodes)
- [Asset IP-Hostname Correlation](../api/docs/architecture/asset-ip-hostname-correlation.md)
- [Workflow Templates](../api/configs/workflow-templates/auto-remediation.json)
- [MITRE ATT&CK Mapping](../ui/src/features/pentest/lib/mitre-attack.ts)
