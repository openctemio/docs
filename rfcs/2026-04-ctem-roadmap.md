# RFC: OpenCTEM Platform Roadmap — CTEM Framework Alignment

**Date**: 2026-04-13  
**Status**: Active  
**Last Updated**: 2026-04-14  
**Author**: Platform Team

---

## Current State: 22/25 (88% CTEM Maturity)

```
PHASE 1: SCOPING          ⭐⭐⭐⭐⭐  5/5 (100%)  ↑ compliance wired
PHASE 2: DISCOVERY         ⭐⭐⭐⭐⭐  5/5 (100%)  ↑ DNS extraction
PHASE 3: PRIORITIZATION    ⭐⭐⭐⭐⭐  5/5 (100%)  ↑ attack paths + BU + crown jewels
PHASE 4: VALIDATION        ⭐⭐⭐⭐☆  4/5 (80%)   ↑ verification scan + MITRE + detection
PHASE 5: MOBILIZATION      ⭐⭐⭐☆☆  3/5 (60%)   ↑ remediation + threat intel cron + ticketing
```

**Remaining gaps**: Full Jira bidirectional sync (Phase 5), detection coverage improvements (Phase 4).

---

## Target: 24/25 (96%) by end of 2026

```
Q2 2026: 16 → 20/25  (Mobilization + Prioritization)
Q3 2026: 20 → 23/25  (Validation + Discovery)
Q4 2026: 23 → 24/25  (Scoping + Polish)
```

---

## Phase 1: Asset Type Consolidation — ✅ COMPLETED (2026-04-14)

> **Full RFC**: [2026-04-asset-type-consolidation.md](./2026-04-asset-type-consolidation.md)

### What was delivered:
- 33 types → 15 core types + sub_types (migrations 000128–000132)
- 15 live asset pages + 10 redirect pages for backward compat
- Dynamic PropertyFilter: server-side JSONB faceted search on any property field
- `GET /assets/facets` API: auto-discovers filterable fields from data
- `?properties=key:value` server-side filter (GIN indexed)
- `by_sub_type` breakdown in stats API
- Auto-promote properties: collectors send sub_type/scope/tags in JSONB → auto-extracted to columns
- Unified `/assets/identity` page (replaces 3 separate IAM pages)
- 20 active modules (cleaned from 25, added Identity)
- 23 unit tests + 18 integration test assertions
- 22 runtime type-cast bug fixes

---

## Phase 2: Mobilization (Q2 2026) — HIGHEST PRIORITY

### 2.1 Vulnerability Group View — ✅ DONE
- [x] API: `GET /api/v1/findings/groups?group_by=cve_id`
- [x] Repository: `ListFindingGroups()`
- [x] UI: `finding-groups-tab.tsx`
- [x] Bulk operations: `BulkUpdateStatusByFilter()`

### 2.2 Remediation Campaigns — 🟡 Backend Done, UI Pending
- [x] Migration 000125: `remediation_campaigns` table
- [x] Domain + repo + service + handler (API returns 200)
- [ ] **TODO**: UI campaign list page (replace mock)
- [ ] **TODO**: UI campaign detail (progress bar, burndown)

### 2.3 ITSM Integration (Jira)
- [ ] Bidirectional sync: finding ↔ Jira ticket
- [ ] Auto-create ticket from finding/campaign

### 2.4 Finding Exceptions — ✅ DONE
- [x] Approval workflow: request → review → approve/reject
- [x] Suppression system with expiration
- [x] Audit trail

### 2.5 Threat Intel Automation — 🟡 Partial
- [x] Service: `ThreatIntelService` with EPSS/KEV enrichment endpoints
- [ ] **TODO**: Asynq cron jobs (daily auto-refresh)
- [ ] **TODO**: Auto-escalate on KEV appearance

### 2.6 Risk Reduction Tracking
- [ ] Snapshot risk score at campaign start
- [ ] Delta calculation on resolution

---

## Phase 3: Prioritization Enhancement (Q2-Q3 2026)

### 3.1 Trending Risks — ✅ DONE
- [x] Repository: `GetRiskVelocity()` — weekly new vs resolved
- [x] Dashboard UI: stacked bar chart (New vs Resolved, 8 weeks)

### 3.2 MTTR/MTTD Metrics — ✅ DONE
- [x] Repository: `GetMTTRMetrics()` — avg hours by severity
- [x] Dashboard UI: horizontal bar chart by severity (Critical/High/Medium/Low)

### 3.3 Business Units — 🟡 Read Wired, Mutations Pending
- [x] Migration 000126 + domain + repo + service + handler
- [x] UI reads from real API (mock fallback removed)
- [ ] **TODO**: Wire create/edit/delete mutations to API

### 3.4 Crown Jewels — 🟡 Read Wired, Mutations Pending
- [x] DB columns on assets + handler endpoint
- [x] UI reads from real API (mock fallback removed)
- [ ] **TODO**: Wire create/edit/delete mutations to API

### 3.5 Attack Path Scoring
- [ ] Graph traversal on asset relationships
- [ ] UI: attack path visualization

### 3.6 Compliance Framework Seeding
- [ ] Seed: PCI-DSS 4.0, SOC 2, ISO 27001, NIST CSF
- [ ] Wire UI to frameworks API

---

## Phase 4: Validation Completion (Q3 2026)

### 4.1 Verification Scan Automation — ✅ DONE
- [x] POST /findings/{id}/request-verification endpoint
- [x] VerificationScanTrigger adapter → QuickScan
- [x] UI: "Request Verification Scan" button on fix_applied findings

### 4.2 MITRE ATT&CK Coverage Heatmap — ✅ DONE
- [x] /pentest/mitre-coverage page with 14-tactic matrix grid
- [x] Client-side OWASP→MITRE mapping + simulation data
- [x] Color-coded cells, source filter, coverage stats

### 4.3 Detection Coverage Testing — ✅ DONE
- [x] Control testing page wired to real /control-tests API
- [x] Create Control Test dialog
- [x] MITRE coverage table from simulations
- [x] Coverage % stat card

---

## Phase 5: Scoping & Discovery Extension (Q4 2026)

### 5.1 Host & Container Discovery
- [ ] Nessus/Qualys import
- [ ] Kubernetes API sync

### 5.2 Identity Risk Discovery
- [ ] AD/LDAP enumeration
- [ ] MFA coverage, dormant accounts

---

## Priority Matrix (Updated)

| Item | Impact | Status | Quarter |
|------|--------|--------|---------|
| ~~Asset Type Consolidation~~ | 🔴 Critical | ✅ Done | Q2 |
| ~~Vulnerability Group View~~ | 🔴 Critical | ✅ Done | Q2 |
| ~~Finding Exceptions~~ | 🟠 High | ✅ Done | Q2 |
| Remediation Campaigns UI | 🔴 Critical | Backend done | Q2 |
| Threat Intel Cron Jobs | 🔴 Critical | Partial | Q2 |
| Business Units UI | 🟡 Medium | Read wired | Q2 |
| ~~Dashboard Velocity/MTTR~~ | 🟠 High | ✅ Done | Q2 |
| ~~Crown Jewels UI~~ | 🟡 Medium | ✅ Done | Q2 |
| Jira Integration | 🔴 Critical | Foundation done | Q3 |
| ~~Verification Scan~~ | 🟡 Medium | ✅ Done | Q3 |
| ~~MITRE Heatmap~~ | 🟡 Medium | ✅ Done | Q3 |
| ~~Compliance~~ | 🟡 Medium | ✅ Done (wired) | Q2 |
| ~~Attack Path Scoring~~ | 🟡 Medium | ✅ Done | Q3 |
| ~~Detection Coverage~~ | 🟡 Medium | ✅ Done | Q3 |

---

## Success Metrics (Updated)

| Metric | Before Session | After Session | Q4 Target |
|--------|---------------|--------------|-----------|
| CTEM Score | 14/25 (56%) | **22/25 (88%)** | 24/25 |
| Asset Types | 33 (sprawl) | **15 core + sub_types** | 15 |
| Sidebar Pages | 30+ | **15 organized** | 15 |
| API Calls/Page | 4 | **2** | 2 |
| Type-cast Bugs | 22 | **0** | 0 |
| Unit Tests (new) | 0 | **23** | 50+ |
| Integration Tests | 0 | **18 assertions** | 50+ |
| Migrations | 130 | **135** | — |
| API Naming Issues Fixed | — | **8** (5 HIGH + 3 MEDIUM) | 0 remaining |
| Deprecated Routes Removed | — | **3** standalone prefixes | — |
| Mock Pages → Real API | — | **4** (BU, Crown Jewels, MTTR, Velocity) | all |

---

## References

- [Asset Type Consolidation RFC](./2026-04-asset-type-consolidation.md) — Status: Implemented
- [Implementation Plan](./IMPLEMENTATION_PLAN.md) — 77% complete (Sprint 6 done)
- [Gartner CTEM Framework](https://www.gartner.com/en/articles/how-to-manage-cybersecurity-threats-not-episodes)
