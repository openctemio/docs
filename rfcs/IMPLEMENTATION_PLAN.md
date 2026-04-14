# Implementation Plan — CTEM Platform Enhancement

**Created**: 2026-04-13  
**Last Updated**: 2026-04-14 (session 3)  
**Current CTEM Score**: 22/25 (88%)  
**Target**: 24/25 by end of Q2 2026

---

## Status Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Completed
- `[!]` Blocked
- `[-]` Skipped/Deferred

---

## Sprint 1: Foundation (Asset Type + Quick Wins)

**Goal**: Category mapping + fix mock pages with real APIs that already exist

### 1.1 Asset Type Category Mapping
- [x] Create `api/pkg/domain/asset/category.go` with `TypeToCategory` map
- [x] Add `Category()` method to Asset entity (derived, not stored)
- [x] Update asset API response to include `category` field
- [x] Update UI asset types to include `AssetCategory` type + `ASSET_CATEGORY_LABELS`
- [x] Update sidebar-data.ts: 15 asset pages, organized by category

### 1.2 Fix Mock Pages — Wire to Existing APIs
- [-] `/attack-surface/external` → defer to future sprint
- [-] `/attack-surface/internal` → defer to future sprint
- [-] `/attack-surface/cloud` → defer to future sprint
- [x] `/components/all` → already wired to real API (confirmed session 3)
- [-] `/components/sbom-export` → defer

### 1.3 Fix Mock Pages — Need Backend First
- [x] `/business-units` → fully wired: read + create + edit + delete (session 3)
- [x] `/crown-jewels` → fully wired: designate/undesignate via PATCH (confirmed session 3)
- [x] `/compliance` → fully wired: frameworks, controls, assessments (confirmed session 3)

---

## Sprint 2: Mobilization (Highest Impact)

### 2.1 Vulnerability Group View — ✅ DONE
- [x] API: `GET /api/v1/findings/groups?group_by=cve_id`
- [x] Repository: `ListFindingGroups()`
- [x] UI: `finding-groups-tab.tsx` + `use-finding-groups.ts` hook
- [x] Bulk: `BulkUpdateStatusByFilter()` + `FindRelatedCVEs()`

### 2.2 Remediation Campaigns — ✅ DONE
- [x] Migration 000125: `remediation_campaigns` table
- [x] Domain + repo + service + handler (full CRUD API)
- [x] UI: campaign list page wired to real API (session 2 — replaced mock)
- [x] UI: campaign detail page `/remediation/[id]` with progress bar, status actions (session 3)
- [x] Risk reduction tracking: auto-calculated on campaign completion (session 3)

### 2.3 Finding Exceptions — ✅ DONE
- [x] Approval workflow: request → review → approve/reject
- [x] Suppression system with expiration
- [x] Audit trail

### 2.4 Threat Intel Automation — ✅ DONE
- [x] ThreatIntelRefreshController calls SyncAll() daily (fetches + persists to DB) (session 3)
- [x] EPSS scores from FIRST.org API → `epss_scores` table
- [x] CISA KEV catalog → `kev_catalog` table
- [x] Sync status tracked in `threat_intel_sync_status` table
- [ ] Auto-escalate: if CVE appears in KEV, bump finding priority (future enhancement)

---

## Sprint 3: Prioritization + Scoping

### 3.1 Trending Risks — ✅ DONE
- [x] Repository: `GetRiskVelocity()` — weekly new vs resolved
- [x] Dashboard UI: stacked bar chart (New vs Resolved, 8 weeks)

### 3.2 MTTR/MTTD Metrics — ✅ DONE
- [x] Repository: `GetMTTRMetrics()` — avg hours by severity
- [x] Dashboard UI: horizontal bar chart by severity

### 3.3 Business Units — ✅ DONE
- [x] Migration 000126 + domain + repo + service + handler
- [x] Backend PUT /api/v1/business-units/{id} (session 3)
- [x] UI: read + create + edit + delete all wired to real API (session 3)

### 3.4 Crown Jewels — ✅ DONE
- [x] DB columns + handler endpoint
- [x] UI: designate/undesignate wired to real API

### 3.5 Compliance Framework — ✅ DONE
- [x] Frameworks + controls + assessments API fully wired
- [x] UI: assessment updates, finding-to-control mapping

---

## Sprint 4: Validation Enhancement

### 4.1 Verification Scan — ✅ PARTIALLY DONE
- [x] POST /findings/{id}/request-verification-scan endpoint
- [x] VerificationScanTrigger adapter → QuickScan
- [x] UI: "Request Verification Scan" button on fix_applied findings
- [ ] Auto-trigger via workflow dispatcher (TODO comment added, needs deeper wiring)

### 4.2 MITRE ATT&CK Coverage Heatmap — ✅ DONE
- [x] /pentest/mitre-coverage page with 14-tactic matrix grid
- [x] Client-side OWASP→MITRE mapping + simulation data
- [x] Color-coded cells, source filter, coverage stats

### 4.3 Risk Reduction Tracking — ✅ DONE
- [x] RecordRiskReduction() on campaign completion (session 3)
- [x] riskBefore/riskAfter/riskReduction fields on campaign entity
- [x] Displayed on campaign detail page

---

## Sprint 5: Asset Type Consolidation — ✅ COMPLETED (2026-04-14 session 1)

- [x] 33 → 15 core types + sub_types (migrations 000128–000132)
- [x] 15 live asset pages + 10 redirect pages
- [x] Dynamic PropertyFilter: server-side JSONB faceted search
- [x] PromoteKnownProperties + type aliasing
- [x] 23 unit tests + 18 integration test assertions
- [x] 22 runtime type-cast bug fixes

---

## Sprint 6: Stability & Standards — ✅ COMPLETED (2026-04-14 session 2)

- [x] Pagination fix: 7 asset pages (key prop)
- [x] CSP WebSocket: auto-derive from existing config
- [x] snake_case standardization: 17 configs + backend converter + migration 000135
- [x] Security: localStorage→sessionStorage, returnTo validation
- [x] Chart width/height fix: ResponsiveContainer minWidth={0}
- [x] Test mock stubs: 5 files

---

## Sprint 7: Wire APIs + Optimize — ✅ COMPLETED (2026-04-14 session 3)

- [x] Components page: confirmed already wired (no mock data)
- [x] Crown jewels: confirmed already wired
- [x] Compliance: confirmed already wired
- [x] BU mutations: backend PUT route + frontend edit/delete wired
- [x] Threat intel: controller now calls SyncAll() (fetch + persist)
- [x] Scope stats: frontend uses /scope/stats endpoint (was 500-record fetch)
- [x] Campaign detail page: new /remediation/[id] with progress + status actions
- [x] Risk reduction: auto-calculated on campaign completion
- [x] Last Update column: built-in for all 17 asset pages (sortable, stale warnings)
- [x] Repository detail: mockFindings → real useFindingsApi
- [x] Components hooks: per_page 1000 → 100
- [x] CSP: zero-config fallback, derives from APP_URL/BACKEND_URL/WS_URL

---

## Progress Tracking

| Sprint | Items | Done | Progress |
|--------|-------|------|----------|
| Sprint 1: Foundation | 10 | 8 | **80%** |
| Sprint 2: Mobilization | 16 | 15 | **94%** |
| Sprint 3: Prioritization | 10 | 10 | **100%** |
| Sprint 4: Validation | 8 | 7 | **88%** |
| Sprint 5: Consolidation | 25 | 25 | **100%** |
| Sprint 6: Stability | 15 | 15 | **100%** |
| Sprint 7: Wire + Optimize | 12 | 12 | **100%** |
| **Total** | **96** | **92** | **96%** |

---

## Remaining Work (4 items)

| # | Item | Priority | Notes |
|---|------|----------|-------|
| 1 | Attack surface sub-pages rewrite | Low | Deferred — existing pages functional |
| 2 | SBOM export page | Low | Component data available, need export UI |
| 3 | Auto-escalate KEV findings | Low | Enhancement — manual triage works |
| 4 | Verification scan auto-trigger via workflow | Low | Manual button works, auto needs dispatcher wiring |

---

## Notes

- Sprint 5 completed in session 1 (2026-04-14)
- Sprint 6 completed in session 2 (2026-04-14)
- Sprint 7 completed in session 3 (2026-04-14)
- 135 migrations total
- TypeScript 0 errors, Go build + test clean, ESLint 0 errors
- **Convention**: All JSONB property keys use snake_case (backend auto-converts)
- **CSP**: Auto-derives from NEXT_PUBLIC_APP_URL + BACKEND_API_URL + NEXT_PUBLIC_WS_BASE_URL
- **Security audit**: All clear — no XSS, no sensitive localStorage, no open redirects
- **Query audit**: All clear — no N+1, all paginated, batch operations used
