# RFC: OpenCTEM Platform Roadmap — CTEM Framework Alignment

**Date**: 2026-04-13  
**Status**: Active  
**Last Updated**: 2026-04-14  
**Author**: Platform Team

---

## Current State: 22/25 (88% CTEM Maturity)

```
PHASE 1: SCOPING          ⭐⭐⭐⭐⭐  5/5 (100%)  ✅ Complete
PHASE 2: DISCOVERY         ⭐⭐⭐⭐⭐  5/5 (100%)  ✅ Complete
PHASE 3: PRIORITIZATION    ⭐⭐⭐⭐⭐  5/5 (100%)  ✅ Complete
PHASE 4: VALIDATION        ⭐⭐⭐⭐☆  4/5 (80%)   🔧 In progress
PHASE 5: MOBILIZATION      ⭐⭐⭐☆☆  3/5 (60%)   🔧 In progress
```

**Remaining gaps**: Remediation Campaign UI (Phase 5), Jira bidirectional sync (Phase 5).

---

## Target: 24/25 (96%) by end of 2026

```
Q2 2026: 22 → 23/25  (Mobilization Campaign UI + Threat Intel cron)
Q3 2026: 23 → 24/25  (Jira Integration + Risk Reduction Tracking)
Q4 2026: 24/25        (Polish + Host/Container Discovery)
```

---

## Completed Phases (Feature Docs)

### Phase 1: Scoping — ✅ 5/5 COMPLETE

| Feature | Status | Feature Doc |
|---------|--------|-------------|
| Attack Surface Overview | Done | [platform-overview.md](../features/platform-overview.md) |
| Asset Groups Management | Done | [asset-sub-modules.md](../features/asset-sub-modules.md) |
| Scope Configuration | Done | [scan-feature-comprehensive.md](../features/scan-feature-comprehensive.md) |
| Compliance Frameworks | Done | [compliance-frameworks.md](../features/compliance-frameworks.md) |
| Business Units + Crown Jewels | Done | [business-context.md](../features/business-context.md) |

### Phase 2: Discovery — ✅ 5/5 COMPLETE

| Feature | Status | Feature Doc |
|---------|--------|-------------|
| Asset Inventory (15 types + sub_types) | Done | [asset-type-consolidation.md](../features/asset-type-consolidation.md) |
| Scan Management + Runners | Done | [scan-feature-comprehensive.md](../features/scan-feature-comprehensive.md) |
| Relationship Suggestions | Done | [relationship-suggestions.md](../features/relationship-suggestions.md) |
| DNS Discovery (domain/subdomain extraction) | Done | Built into asset ingestion |
| Credential Leaks | Done | Part of finding types |

### Phase 3: Prioritization — ✅ 5/5 COMPLETE

| Feature | Status | Feature Doc |
|---------|--------|-------------|
| Risk Analysis + EPSS/KEV Enrichment | Done | [finding-enrichment.md](../features/finding-enrichment.md) |
| Attack Path Scoring | Done | [attack-paths.md](../features/attack-paths.md) |
| MTTR/MTTD Metrics | Done | Dashboard built-in |
| Trending Risks (Velocity) | Done | Dashboard built-in |
| AI Triage | Done | [ai-triage.md](../features/ai-triage.md) |

### Phase 4: Validation — 4/5

| Feature | Status | Feature Doc |
|---------|--------|-------------|
| Penetration Testing | Done | [pentest-campaigns.md](../features/pentest-campaigns.md) |
| MITRE ATT&CK Coverage Heatmap | Done | Built into pentest module |
| Detection Coverage Testing | Done | Built into validation module |
| Verification Scan Automation | Done | Built into finding lifecycle |
| **BAS (Breach & Attack Simulation)** | **TODO** | — |

### Phase 5: Mobilization — 3/5

| Feature | Status | Feature Doc |
|---------|--------|-------------|
| Finding Exceptions (accept/suppress) | Done | [approval-workflow.md](../features/approval-workflow.md) |
| Vulnerability Group View | Done | Built into findings |
| Workflows + Auto-Remediation | Done | [workflows.md](../features/workflows.md) |
| **Remediation Campaigns UI** | **Backend done, UI pending** | — |
| **Jira Bidirectional Sync** | **TODO** | — |

---

## Remaining Work

### 2.1 Remediation Campaigns UI — 🟡 Backend Done

- [x] Migration 000125: `remediation_campaigns` table
- [x] Domain + repo + service + handler (API returns 200)
- [ ] **TODO**: UI campaign list page (replace mock)
- [ ] **TODO**: UI campaign detail (progress bar, burndown)

### 2.2 ITSM Integration (Jira)

- [ ] Bidirectional sync: finding ↔ Jira ticket
- [ ] Auto-create ticket from finding/campaign

### 2.3 Threat Intel Automation — 🟡 Partial

- [x] Service: `ThreatIntelService` with EPSS/KEV enrichment
- [ ] **TODO**: Asynq cron jobs (daily auto-refresh)
- [ ] **TODO**: Auto-escalate on KEV appearance

### 2.4 Business Unit / Crown Jewel Mutations — 🟡 Read Wired

- [x] Migration + domain + repo + service + handler
- [x] UI reads from real API
- [ ] **TODO**: Wire create/edit/delete mutations to API

### 2.5 Risk Reduction Tracking

- [ ] Snapshot risk score at campaign start
- [ ] Delta calculation on resolution

---

## Priority Matrix

| Item | Impact | Status | Quarter |
|------|--------|--------|---------|
| Remediation Campaigns UI | 🔴 Critical | Backend done | Q2 |
| Threat Intel Cron Jobs | 🔴 Critical | Partial | Q2 |
| Jira Integration | 🔴 Critical | Not started | Q3 |
| BU/Crown Jewel Mutations | 🟡 Medium | Read wired | Q2 |
| Risk Reduction Tracking | 🟡 Medium | Not started | Q3 |
| BAS (Breach & Attack Sim) | 🟡 Medium | Not started | Q3 |
| Host/Container Discovery | 🟢 Low | Not started | Q4 |

---

## Success Metrics

| Metric | Before (2026-03) | Current (2026-04) | Q4 Target |
|--------|-------------------|-------------------|-----------|
| CTEM Score | 14/25 (56%) | **22/25 (88%)** | 24/25 (96%) |
| Asset Types | 33 (sprawl) | **15 core + sub_types** | 15 |
| Mock Pages | 4 | **0** | 0 |
| Migrations | 130 | **136** | — |
| Feature Docs | 32 | **35** | 40+ |

---

## References

- [Asset Type Consolidation](../features/asset-type-consolidation.md) — Feature doc
- [Feature Documentation Index](../features/index.md)
- [Gartner CTEM Framework](https://www.gartner.com/en/articles/how-to-manage-cybersecurity-threats-not-episodes)
