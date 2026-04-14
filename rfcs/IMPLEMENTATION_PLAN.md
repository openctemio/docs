# Implementation Plan — CTEM Platform Enhancement

**Created**: 2026-04-13  
**Last Updated**: 2026-04-14 (43/58 items done)  
**Current CTEM Score**: 16/25 (64%)  
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
- [x] Update sidebar-data.ts: 15 asset pages, organized by category *(done in Sprint 5)*

### 1.2 Fix Mock Pages — Wire to Existing APIs
> Pages that show hardcoded data but API already exists

- [-] `/attack-surface/external` → defer to future sprint
- [-] `/attack-surface/internal` → defer to future sprint
- [-] `/attack-surface/cloud` → defer to future sprint
- [ ] `/components/all` → wire to `GET /api/v1/components`
- [ ] `/components/sbom-export` → wire to component export API

### 1.3 Fix Mock Pages — Need Backend First
> Pages with mock data AND no backend API

- [x] `/business-units` → API exists (`GET /api/v1/business-units` returns 200) *(done Sprint 3)*
- [ ] `/crown-jewels` → handler needed
- [ ] `/compliance` → compliance framework exists, need seed data

---

## Sprint 2: Mobilization (Highest Impact)

**Goal**: Vulnerability grouping + remediation campaigns — the #1 CTEM gap

### 2.1 Vulnerability Group View — ✅ ALREADY EXISTS
> Discovered during implementation audit — full system already built

- [x] API: `GET /api/v1/findings/groups?group_by=cve_id`
- [x] Repository: `ListFindingGroups()`
- [x] Domain: `FindingGroup` + `FindingGroupStats` structs
- [x] UI: `finding-groups-tab.tsx` + `use-finding-groups.ts` hook
- [x] Bulk: `BulkUpdateStatusByFilter()` + `FindRelatedCVEs()`
- [x] Auto-verify: `ListByStatusAndAssets()` for fix verification

### 2.2 Remediation Campaigns
> Track "fix all Log4j" as one campaign with progress

- [x] Migration 000125: `remediation_campaigns` table
- [x] Domain model: `pkg/domain/remediation/campaign.go` (full lifecycle)
- [x] Repository: Postgres CRUD + priority-ordered listing
- [x] Service: `RemediationCampaignService` (create, status transitions, progress)
- [x] Handler + routes: `GET/POST /api/v1/remediation/campaigns`, `GET/PATCH/DELETE /{id}`
- [ ] UI: campaign list page (replace mock at `/remediation`)
- [ ] UI: campaign detail with progress bar, finding list, burndown

### 2.3 Finding Exceptions — ✅ ALREADY EXISTS (Approval System)

- [x] API: `POST /api/v1/findings/{id}/approvals` (request approval)
- [x] API: `GET /api/v1/approvals` (list pending)
- [x] API: `POST /api/v1/approvals/{id}/approve` + `/reject`
- [x] Suppression system: `GET/POST/PUT/DELETE /api/v1/suppressions`
- [ ] UI: verify exception pages wire to real API

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

- [x] Repository: `GetRiskVelocity()` — new vs resolved per week, 12-week window
- [ ] API: expose via `GET /api/v1/dashboard/velocity` endpoint
- [ ] UI: trend line chart on dashboard

### 3.2 MTTR/MTTD Metrics

- [x] Repository: `GetMTTRMetrics()` — avg hours to remediate per severity
- [ ] API: expose via dashboard stats endpoint
- [ ] UI: metric cards on dashboard

### 3.3 Business Units API

- [x] Migration 000126: `business_units` + `business_unit_assets` tables
- [x] Domain + repo + service + handler (API returns 200)
- [ ] UI: replace mock data at `/business-units`

### 3.4 Crown Jewels API

- [x] DB columns: `is_crown_jewel`, `business_impact_score`, `business_impact_notes` on assets
- [x] Handler: `PATCH /api/v1/assets/{id}/crown-jewel` *(UpdateCrownJewel in asset_handler.go)*
- [ ] UI: replace mock data at `/crown-jewels`, filter from asset inventory

### 3.5 Compliance Framework Seeding

- [ ] Seed data: PCI-DSS 4.0, SOC 2, ISO 27001, NIST CSF controls
- [ ] Compliance service: map controls → findings
- [ ] UI: replace mock at `/compliance`

---

## Sprint 4: Validation Enhancement

**Goal**: Close the CTEM loop — verify fixes automatically

### 4.1 Verification Scan Automation

- [ ] Workflow trigger: `finding_status_changed` to `remediated`
- [ ] Action: trigger targeted scan on affected asset
- [ ] Result: auto-update finding to `verified` or re-open

### 4.2 MITRE ATT&CK Coverage Heatmap

- [ ] API: `GET /api/v1/validation/mitre-coverage`
- [ ] Data: map pentest findings + control tests → MITRE techniques
- [ ] UI: ATT&CK matrix heatmap (14 tactics × N techniques)

### 4.3 Risk Reduction Tracking

- [ ] Snapshot risk score when campaign starts
- [ ] Calculate delta when findings resolved
- [ ] UI: risk reduction % per campaign

---

## Sprint 5: Asset Type Consolidation — ✅ COMPLETED

**Goal**: 33 → 15 types, cleaner sidebar  
**Completed**: 2026-04-14

### 5.1 Sub-type Column ✅
- [x] Migration 000128: `ALTER TABLE assets ADD COLUMN sub_type VARCHAR(50)`
- [x] Backfill sub_type from current type for merged types
- [x] Migration 000129: consolidate legacy DB types (ip→ip_address, port→service)
- [x] Migration 000130: consolidate asset_type values (firewall→network, website→application)
- [x] Migration 000131: normalize network sub_types (core_switch/access_switch→switch)
- [x] Update domain model: `SubType()` getter + `SetSubType()` setter

### 5.2 Type Aliasing + Properties Promotion ✅
- [x] `TypeAliases` map: 21 legacy→core mappings in `value_objects.go`
- [x] `ResolveTypeAlias()` function
- [x] `PromoteKnownProperties()`: auto-extract sub_type, scope, tags from JSONB properties
- [x] API v1: still accepts old types (backward compatible via aliases)

### 5.3 UI Consolidation ✅
- [x] 15 live asset pages (1 per core type)
- [x] 10 redirect pages for deprecated URLs (iam-users→identity, etc.)
- [x] Unified `/assets/identity` page (replaces iam-users, iam-roles, service-accounts)
- [x] Dynamic `PropertyFilter` component (Add Filter → pick field → pick value from API)
- [x] `GET /assets/facets` endpoint (distinct property keys + values per type)
- [x] `?properties=key:value` server-side JSONB filter (GIN indexed)
- [x] `by_sub_type` in `/assets/stats` response
- [x] `?sub_type=` param on `/assets/stats` endpoint
- [x] URL params preserved during navigation (type/sub_type)
- [x] Page remount on searchParams change (key prop)
- [x] Domains page: expand-all default, smart DNS Info column, collapsedRoots model
- [x] Stats grid: dynamic cols (never orphan cards)
- [x] Scope bar: compact 1-line indicator (replaces full-width card)
- [x] Filter bar: Search + Status dropdown + Tags + Add Filter (removed old tabs + dropdowns)
- [x] Sub_type filter indicator with dismiss button + dynamic page title

### 5.4 Module Cleanup ✅
- [x] Migration 000132: deprecate 6 modules, rename 2, add Identity, clean tenant_modules
- [x] 20 active asset sub-modules (from 25)
- [x] Sidebar: 15 items organized by category

### 5.5 Quality ✅
- [x] 22 runtime type-cast bug fixes (as string[] on JSONB values)
- [x] 22 unused argIdx++ fixes (CodeQL warnings)
- [x] LIKE wildcard injection fix (escape % and _)
- [x] ESLint: unused imports, missing deps, useless conditionals
- [x] Unit tests: 23 tests (PromoteKnownProperties + ParsePropertiesFilter)
- [x] Integration test: 18 assertions (full flow bash script)
- [x] `data/` added to .gitignore

---

## Progress Tracking

| Sprint | Items | Done | Progress |
|--------|-------|------|----------|
| Sprint 1: Foundation | 10 | 5 | 50% |
| Sprint 2: Mobilization | 20 | 17 | 85% |
| Sprint 3: Prioritization | 14 | 9 | 64% |
| Sprint 4: Validation | 8 | 0 | 0% |
| Sprint 5: Consolidation | 25 | 25 | **100%** |
| **Total** | **77** | **56** | **73%** |

---

## Dependencies

```
Sprint 1.1 (Category) ──→ Sprint 5.3 (UI Consolidation) ✅ DONE
Sprint 2.1 (Groups)   ──→ Sprint 2.2 (Campaigns) ──→ Sprint 4.3 (Risk Reduction)
Sprint 2.4 (Threat)    ──→ Sprint 3.1 (Trending)
Sprint 3.3 (BU)        ──→ Sprint 3.4 (Crown Jewels)
```

---

## Next Priorities (Remaining Work)

### High Priority (Wire existing APIs → UI)
1. `/remediation` — campaign list + detail (API done, UI mock)
2. `/business-units` — wire to real API (API done, UI mock)
3. `/compliance` — wire to frameworks API + seed data
4. `/threat-intel` — wire to EPSS/KEV/stats endpoints (API done, UI mock)

### Medium Priority (Backend needed)
5. Dashboard: velocity chart + MTTR metric cards
6. Crown jewels UI: filter from asset inventory
7. Threat intel cron jobs (EPSS + KEV daily refresh)

### Lower Priority (New features)
8. Verification scan automation (workflow trigger)
9. MITRE ATT&CK coverage heatmap
10. Risk reduction tracking per campaign
11. Attack surface sub-pages rewrite

---

## Notes

- Sprint 5 completed in 1 session (2026-04-13 → 2026-04-14)
- All changes backward compatible — no breaking API changes
- 132 migrations total, all applied, dirty=false
- TypeScript 0 errors, Go build + vet clean, ESLint 0 warnings
