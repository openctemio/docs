# Implementation Plan — CTEM Platform Enhancement

**Created**: 2026-04-13  
**Last Updated**: 2026-04-13 (Re-audited: 16/58 items done, 11 pre-existing)  
**Current CTEM Score**: 14/25 (56%)  
**Target**: 19/25 by end of Q2 2026

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
> Add category field derived from type. No DB change.

- [x] Create `api/pkg/domain/asset/category.go` with `TypeToCategory` map
- [x] Add `Category()` method to Asset entity (derived, not stored)
- [x] Update asset API response to include `category` field
- [x] Update UI asset types to include `AssetCategory` type + `ASSET_CATEGORY_LABELS`
- [ ] Update sidebar-data.ts: group by category (keep existing pages, add category headers)

### 1.2 Fix Mock Pages — Wire to Existing APIs
> Pages that show hardcoded data but API already exists

- [-] `/attack-surface/external` → 947 lines mock, needs full rewrite (defer to Sprint 5)
- [-] `/attack-surface/internal` → 1140 lines mock, needs full rewrite (defer to Sprint 5)
- [-] `/attack-surface/cloud` → 1155 lines mock, needs full rewrite (defer to Sprint 5)
- [ ] `/components/all` → wire to `GET /api/v1/components`
- [ ] `/components/sbom-export` → wire to component export API

### 1.3 Fix Mock Pages — Need Backend First
> Pages with mock data AND no backend API

- [ ] `/business-units` → need BusinessUnit domain + CRUD (defer to Sprint 3)
- [ ] `/crown-jewels` → need CrownJewel designation (defer to Sprint 3)
- [ ] `/compliance` → compliance framework exists, need seed data (defer to Sprint 3)

---

## Sprint 2: Mobilization (Highest Impact)

**Goal**: Vulnerability grouping + remediation campaigns — the #1 CTEM gap

### 2.1 Vulnerability Group View — ✅ ALREADY EXISTS
> Discovered during implementation audit — full system already built

- [x] API: `GET /api/v1/findings/groups?group_by=cve_id` (finding_actions_handler.go)
- [x] Repository: `ListFindingGroups()` in finding_group_repository.go
- [x] Domain: `FindingGroup` + `FindingGroupStats` structs
- [x] UI: `finding-groups-tab.tsx` + `use-finding-groups.ts` hook
- [x] Bulk: `BulkUpdateStatusByFilter()` + `FindRelatedCVEs()`
- [x] Auto-verify: `ListByStatusAndAssets()` for fix verification

### 2.2 Remediation Campaigns
> Track "fix all Log4j" as one campaign with progress

- [ ] Migration: `remediation_campaigns` table (name, description, finding_filter, status, progress, assignee, deadline)
- [ ] Domain model: `pkg/domain/remediation/campaign.go`
- [ ] Repository: Postgres CRUD + progress calculation
- [ ] Service: `RemediationCampaignService` (create, update status, calculate progress)
- [ ] Handler + routes: `POST/GET/PUT /api/v1/remediation/campaigns`
- [ ] UI: campaign list page (replace mock at `/remediation`)
- [ ] UI: campaign detail with progress bar, finding list, burndown

### 2.3 Finding Exceptions — ✅ ALREADY EXISTS (Approval System)
> Full approval workflow already implemented

- [x] API: `POST /api/v1/findings/{id}/approvals` (request approval)
- [x] API: `GET /api/v1/approvals` (list pending)
- [x] API: `POST /api/v1/approvals/{id}/approve` + `/reject`
- [x] Suppression system: `GET/POST/PUT/DELETE /api/v1/suppressions`
- [ ] UI: verify exception pages wire to real API (may still have mock data)

### 2.4 Threat Intel Automation
> Daily EPSS + KEV refresh — currently manual

- [ ] Asynq cron job: fetch EPSS scores from FIRST.org API daily
- [ ] Asynq cron job: fetch CISA KEV catalog daily
- [ ] Auto-escalate: if CVE appears in KEV, bump finding priority
- [ ] Wire into existing `ThreatIntelService`

---

## Sprint 3: Prioritization + Scoping

**Goal**: Business context + trending risks

### 3.1 Trending Risks
> Risk velocity: are we improving or getting worse?

- [ ] API: `GET /api/v1/dashboard/trends` (new/resolved per week, 12-week window)
- [ ] Repository: time-series query on findings created_at/resolved_at
- [ ] UI: trend line chart on dashboard (positive = losing ground)

### 3.2 MTTR/MTTD Metrics
> Mean time to detect + mean time to remediate

- [ ] API: extend dashboard stats with MTTR/MTTD
- [ ] Repository: `AVG(resolved_at - created_at)` by severity
- [ ] UI: metric cards on dashboard + insights page

### 3.3 Business Units API
> Wire the mock page to real backend

- [ ] Migration: `business_units` table (name, description, owner, assets[])
- [ ] Domain + repo + service + handler
- [ ] UI: replace mock data at `/business-units`

### 3.4 Crown Jewels API
> Critical asset designation + impact scoring

- [ ] Add `is_crown_jewel` boolean + `business_impact_score` to assets (or separate table)
- [ ] Handler: `PATCH /api/v1/assets/{id}/crown-jewel`
- [ ] UI: replace mock data at `/crown-jewels`, filter from asset inventory

### 3.5 Compliance Framework Seeding
> Pre-populate compliance frameworks

- [ ] Seed data: PCI-DSS 4.0, SOC 2, ISO 27001, NIST CSF controls
- [ ] Compliance service: map controls → findings
- [ ] UI: replace mock at `/compliance`

---

## Sprint 4: Validation Enhancement

**Goal**: Close the CTEM loop — verify fixes automatically

### 4.1 Verification Scan Automation
> Finding status → "remediated" → auto-trigger scan

- [ ] Workflow trigger: `finding_status_changed` to `remediated`
- [ ] Action: trigger targeted scan on affected asset
- [ ] Result: auto-update finding to `verified` or re-open

### 4.2 MITRE ATT&CK Coverage Heatmap
> Visual matrix showing tested vs untested techniques

- [ ] API: `GET /api/v1/validation/mitre-coverage`
- [ ] Data: map pentest findings + control tests → MITRE techniques
- [ ] UI: ATT&CK matrix heatmap (14 tactics × N techniques)

### 4.3 Risk Reduction Tracking
> Campaign before/after risk delta

- [ ] Snapshot risk score when campaign starts
- [ ] Calculate delta when findings resolved
- [ ] UI: risk reduction % per campaign

---

## Sprint 5: Asset Type Consolidation

**Goal**: 33 → 15 types, cleaner sidebar

### 5.1 Sub-type Column
- [ ] Migration: `ALTER TABLE assets ADD COLUMN sub_type VARCHAR(50)`
- [ ] Backfill sub_type from current type for merged types
- [ ] Update domain model: `SubType()` getter

### 5.2 Type Aliasing in Ingest
- [ ] `TypeAliases` map: old type → new type + sub_type
- [ ] Update ingest processor to apply aliases
- [ ] API v1: still accept old types (backward compatible)

### 5.3 UI Sidebar Consolidation
- [ ] 30+ pages → 9 category pages with tab filters
- [ ] Each tab = filter by type within category
- [ ] Update sidebar-data.ts

---

## Progress Tracking

| Sprint | Items | Done | Progress |
|--------|-------|------|----------|
| Sprint 1: Foundation | 10 | 4 | 40% |
| Sprint 2: Mobilization | 20 | 12 | 60% (11 pre-existing) |
| Sprint 3: Prioritization | 14 | 0 | 0% |
| Sprint 4: Validation | 8 | 0 | 0% |
| Sprint 5: Consolidation | 6 | 0 | 0% |
| **Total** | **58** | **16** | **28%** |

---

## Dependencies

```
Sprint 1.1 (Category) ──→ Sprint 5.3 (UI Consolidation)
Sprint 2.1 (Groups)   ──→ Sprint 2.2 (Campaigns) ──→ Sprint 4.3 (Risk Reduction)
Sprint 2.4 (Threat)    ──→ Sprint 3.1 (Trending)
Sprint 3.3 (BU)        ──→ Sprint 3.4 (Crown Jewels)
```

---

## Notes

- Each sprint is independent except where dependency arrows shown
- Sprint 2 is highest priority (Mobilization = biggest CTEM gap)
- Sprint 1 is quickest win (mostly wiring existing APIs)
- Sprint 5 can run in parallel with Sprint 3-4
- All changes backward compatible — no breaking API changes
