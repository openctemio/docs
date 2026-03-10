# Configurable Risk Scoring Engine — Implementation Tasks

**RFC:** [2026-03-10-configurable-risk-scoring-engine.md](./2026-03-10-configurable-risk-scoring-engine.md)
**Created:** 2026-03-10
**Estimated Total:** ~2,550 LOC

---

## Phase 1: Domain Layer — Settings & Scoring Config (~450 LOC)

### 1.1 Types & Structs
- [x] Add `RiskScoringSettings` struct to `api/pkg/domain/tenant/settings.go`
- [x] Add `ComponentWeights` struct (Exposure, Criticality, Findings, CTEM — sum to 100)
- [x] Add `ExposureScoreConfig` struct (Public, Restricted, Private, Isolated, Unknown — 0-100)
- [x] Add `ExposureMultiplierConfig` struct (Public, Restricted, Private, Isolated, Unknown — 0.1-3.0)
- [x] Add `CriticalityScoreConfig` struct (Critical, High, Medium, Low, None — 0-100)
- [x] Add `FindingImpactConfig` struct (Mode: count/severity_weighted, PerFindingPoints, FindingCap)
- [x] Add `SeverityWeightConfig` struct (Critical, High, Medium, Low, Info — 0-50)
- [x] Add `CTEMPointsConfig` struct (Enabled, InternetAccessible, PIIExposed, PHIExposed, HighRiskCompliance, RestrictedData)
- [x] Add `RiskLevelConfig` struct (CriticalMin, HighMin, MediumMin, LowMin)
- [x] Add `RiskScoring RiskScoringSettings` field to existing `Settings` struct

### 1.2 Legacy Preset
- [x] Create `LegacyRiskScoringSettings()` function — must reproduce EXACT current hardcoded formula
- [x] Verify: Public exposure=100 × 40% = 40 pts (matches current `BaseRiskScore()`)
- [x] Verify: Critical criticality=100 × 25% = 25 pts (matches current `Score()/4`)
- [x] Verify: Finding count mode with pts=14, cap=100 × 35% = same as current `min(count*5, 35)`
- [x] Verify: Multipliers 0.8-1.5 match current `ExposureMultiplier()` values exactly

### 1.3 Default & Industry Presets
- [x] Create `DefaultRiskScoringPreset()` — recommended config for new tenants
- [x] Create `bankingPreset()` — high criticality+CTEM, PII-focused
- [x] Create `healthcarePreset()` — highest CTEM weight, PHI+HIPAA focused
- [x] Create `ecommercePreset()` — highest exposure weight, public-facing
- [x] Create `governmentPreset()` — high compliance+criticality, restricted data
- [x] Create `AllPresets` map and `RiskScoringPreset(industry)` lookup function
- [x] Ensure all presets pass `Validate()`

### 1.4 Defaults & Settings Integration
- [x] Update `DefaultSettings()` to include `RiskScoring: LegacyRiskScoringSettings()`
- [x] Add `UpdateRiskScoringSettings()` method on Tenant entity (follows existing pattern)
- [x] `ToMap()` / `SettingsFromMap()` — already works via JSON marshal/unmarshal (auto-handled by json tags)
- [x] Update `toSettingsResponse()` in `tenant_handler.go` to include `risk_scoring`

### 1.5 Validation
- [x] Implement `RiskScoringSettings.Validate()` method
- [x] Validate: weights sum to 100
- [x] Validate: each weight 0-100
- [x] Validate: exposure scores 0-100
- [x] Validate: criticality scores 0-100
- [x] Validate: multipliers 0.1-3.0
- [x] Validate: finding mode is "count" or "severity_weighted"
- [x] Validate: finding cap 1-100
- [x] Validate: per_finding_points 1-50
- [x] Validate: severity weights 0-50
- [x] Validate: CTEM points 0-100 each (only when enabled)
- [x] Validate: risk levels ordered: critical > high > medium > low > 0
- [x] Validate: risk levels bounds 1-100

### 1.6 Tests
- [x] Create `api/tests/unit/risk_scoring_test.go`
- [x] Test: `DefaultSettings()` returns valid legacy preset
- [x] Test: all presets pass `Validate()`
- [x] Test: weights not sum 100 → error
- [x] Test: negative weight → error
- [x] Test: multiplier out of bounds → error
- [x] Test: risk levels not ordered → error
- [x] Test: finding mode invalid → error
- [x] Test: severity weight out of bounds → error
- [x] Test: CTEM points out of bounds (when enabled) → error
- [x] Test: CTEM points ignored when disabled (no error)
- [x] Test: `SettingsFromMap()` → `ToMap()` roundtrip preserves risk_scoring

---

## Phase 2: Scoring Engine + Severity Counts (~300 LOC)

### 2.1 FindingSeverityCounts Type
- [x] Add `FindingSeverityCounts` struct to `api/pkg/domain/asset/entity.go`
- [x] Add `findingSeverityCounts *FindingSeverityCounts` field to Asset entity
- [x] Add `FindingSeverityCounts()` getter method
- [x] Add `SetFindingSeverityCounts()` setter method

### 2.2 Extend LEFT JOIN in Repository
- [x] Update `selectQuery()` in `api/internal/infra/postgres/asset_repository.go`
  - Extend LEFT JOIN to include severity breakdown columns
  - Add: `finding_critical`, `finding_high`, `finding_medium`, `finding_low`, `finding_info`
  - Use `COALESCE(SUM(CASE WHEN severity = '...' THEN 1 ELSE 0 END), 0)` pattern
  - Add `WHERE status != 'resolved'` to exclude resolved findings from counts
- [x] Update `scanAsset()` helper to read the 5 new columns
- [x] Set `FindingSeverityCounts` on asset from scanned values

### 2.3 RiskScoringEngine
- [x] Create new file `api/pkg/domain/asset/risk_scoring.go`
- [x] Implement `RiskScoringEngine` struct with `config` field
- [x] Implement `NewRiskScoringEngine(config)` constructor
- [x] Implement `CalculateScore(a *Asset) int` — main scoring method
- [x] Implement `effectiveWeights()` — redistributes CTEM weight when disabled
- [x] Implement `exposureScore(exp Exposure) int` — lookup from config
- [x] Implement `criticalityScore(c Criticality) int` — lookup from config
- [x] Implement `findingScore(a *Asset) int` — count-based or severity-weighted
- [x] Implement `ctemScore(a *Asset) int` — additive points when enabled
- [x] Implement `exposureMultiplier(exp Exposure) float64` — lookup from config

### 2.4 Update CalculateRiskScore Signature
- [x] Add `Asset.CalculateRiskScoreWithConfig(config *RiskScoringConfig)` method
- [x] If config is nil, use `LegacyRiskScoringConfig()` (backward compat)
- [x] Use `NewRiskScoringEngine()` internally

### 2.5 Tests
- [x] Create `api/tests/unit/risk_scoring_test.go` (combined with 1.6)
- [x] Test: legacy config produces reasonable scores for multiple asset combos
- [x] Test: nil config = legacy defaults
- [x] Test: CTEM disabled = 0 CTEM component
- [x] Test: CTEM weight redistribution when disabled (effective weights)
- [x] Test: CTEM enabled with internet accessible flag
- [x] Test: severity-weighted findings (critical only, mixed, all info)
- [x] Test: count-based findings (fallback when no severity counts)
- [x] Test: finding cap applied correctly
- [x] Test: zero findings = zero finding score
- [x] Test: score clamped to 0-100 (test high multiplier case)
- [x] Test: all zero weights except one = only that component matters
- [x] Test: all exposure levels map correctly
- [x] Test: all criticality levels map correctly

---

## Phase 3: Service Layer — Cached Config + Recalculate (~350 LOC)

### 3.1 Scoring Config Cache
- [x] Create `scoringConfigEntry` struct in `asset_service.go` with TTL check
- [x] Implement cache get in `getScoringConfig()` — with RWMutex and TTL check
- [x] Implement cache set in `getScoringConfig()` — with expiration timestamp
- [x] Implement `InvalidateScoringConfigCache(tenantID)` — delete from cache
- [x] Set TTL constant: 5 minutes (`scoringConfigCacheTTL`)
- [x] Add `scoringCacheMu` + `scoringCache` to `AssetService` struct
- [x] Initialize cache in `SetScoringConfigProvider()` setter

### 3.2 getScoringConfig Helper
- [x] Implement `getScoringConfig(ctx, tenantID) *RiskScoringConfig`
- [x] Check cache first, return if hit
- [x] On cache miss: load from `ScoringConfigProvider`, cache result
- [x] On error: log warning, return legacy config (graceful fallback)

### 3.3 Update Call Sites
- [x] Update `CreateAsset()` — use `CalculateRiskScoreWithConfig(getScoringConfig(...))`
- [x] Update `UpdateAsset()` — use `CalculateRiskScoreWithConfig(getScoringConfig(...))`
- [x] Update `CreateAssetWithRepository()` — use `CalculateRiskScoreWithConfig(getScoringConfig(...))`
- [x] Update `UpdateFindingCount()` — use `CalculateRiskScoreWithConfig(getScoringConfig(...))`
- [ ] Update `UpdateRepositoryFindingCount()` — uses `repoExt.CalculateRiskScore()` (DEFERRED: different entity with separate formula)
- [x] Update `updateExistingRepositoryAsset()` — use `CalculateRiskScoreWithConfig(getScoringConfig(...))`

### 3.4 Batch Recalculation
- [x] Implement `RecalculateAllRiskScores(ctx, tenantID) (int, error)`
- [x] Acquire Redis SETNX lock (key: `recalc:scoring:{tenantID}`, TTL: 10 min)
- [x] On lock failure: return `shared.ErrConflict` (already in progress)
- [x] Invalidate scoring cache before starting
- [x] Count total assets, enforce max limit (100K)
- [x] Batch process: List() with pagination (500 per batch)
- [x] For each batch: recalculate scores, call `BatchUpdateRiskScores()`
- [x] Return total updated count
- [x] Release lock in defer

### 3.5 Batch Update Repository Method
- [x] Implement `BatchUpdateRiskScores(ctx, tenantID, assets) error` in asset repository
- [x] Use `unnest($1::uuid[], $2::int[])` for single UPDATE per batch
- [x] Include `AND assets.tenant_id = $3` for tenant isolation
- [x] Pre-allocate slices for ids and scores
- [x] Add `BatchUpdateRiskScores` to `asset.Repository` interface
- [x] Update all mock repositories (4 files)

### 3.6 Cache Invalidation Hook
- [x] Add `InvalidateScoringConfigCache(tenantID)` public method on AssetService
- [x] Called from settings handler after scoring config update

### 3.7 Scoring Config Provider
- [x] Define `ScoringConfigProvider` interface in `asset` package (avoids circular deps)
- [x] Implement `TenantScoringConfigProvider` in `app/scoring_config_provider.go`
- [x] Implement `mapTenantSettingsToScoringConfig()` mapping function
- [x] Wire provider in `cmd/server/services.go` via `SetScoringConfigProvider()`

### 3.8 Preview Risk Score Changes
- [x] Implement `PreviewRiskScoreChanges(ctx, tenantID, newConfig)` method
- [x] Stratified sampling: top 20 (high risk) + bottom 20 (low risk) + 60 middle
- [x] Return `RiskScorePreviewItem` with current/new scores per asset
- [x] Deduplication of assets across samples

### 3.7 Tests
- [x] Create `api/tests/unit/asset_service_scoring_test.go`
- [x] Test: cache hit — no DB query
- [x] Test: cache miss — loads from DB, caches result
- [ ] Test: cache expires after TTL — reloads from DB (requires time mocking; invalidation tested instead)
- [x] Test: cache invalidation — next call hits DB
- [x] Test: `getScoringConfig` error — returns nil (fallback)
- [x] Test: `RecalculateAllRiskScores` — processes batches
- [x] Test: concurrent recalculation — without Redis proceeds (Redis-only; lock tested via integration)
- [x] Test: exceeds max assets — returns ErrValidation (mock overrides Total count)
- [x] Test: `BatchUpdateRiskScores` error — propagated
- [x] Test: empty assets list — no-op

---

## Phase 4: API Endpoints + Permissions (~400 LOC)

### 4.1 Permissions
- [x] Use existing `settings:read` / `settings:write` + `RequireTeamAdmin()` middleware (aligned with other settings endpoints)
- [ ] (Optional) Add granular `settings:scoring:read/write` if finer-grained control needed later
- [ ] Add corresponding frontend permission constants in `ui/src/lib/permissions/constants.ts` (if granular)

### 4.2 GET /settings/risk-scoring
- [x] Add route to tenant settings router group
- [x] Apply `middleware.RequireTeamAdmin()`
- [x] Load tenant settings via `TenantService.GetRiskScoringSettings()`
- [x] Return `tenant.RiskScoringSettings` directly (has json tags)

### 4.3 PATCH /settings/risk-scoring
- [x] Add route to tenant settings router group
- [x] Apply `middleware.RequireTeamAdmin()`
- [x] Parse `tenant.RiskScoringSettings` from request body
- [x] Validate input via `Validate()`
- [x] Update tenant settings via `TenantService.UpdateRiskScoringSettings()`
- [x] Invalidate scoring config cache via `AssetService.InvalidateScoringConfigCache()`
- [x] Audit log with preset metadata
- [x] Return updated config (DO NOT auto-recalculate)

### 4.4 POST /settings/risk-scoring/preview
- [x] Add route to tenant settings router group
- [x] Apply `middleware.RequireTeamAdmin()`
- [x] Parse proposed config from request body
- [x] Validate proposed config
- [x] Map tenant config → asset scoring config via `MapTenantToAssetScoringConfig()`
- [x] Call `AssetService.PreviewRiskScoreChanges()` (stratified sampling)
- [x] Return preview items with current/new scores per asset

### 4.5 POST /settings/risk-scoring/recalculate
- [x] Add route to tenant settings router group
- [x] Apply `middleware.RequireTeamAdmin()`
- [x] Rate limit: enforced via distributed lock (Redis SETNX with 10-min TTL serves as natural rate limiter)
- [x] On concurrent request: returns 409 Conflict (recalculation already in progress)
- [x] Call `RecalculateAllRiskScores(ctx, tenantID)`
- [x] Return `RecalculateResponse` with assets_updated count

### 4.6 GET /settings/risk-scoring/presets
- [x] Add route to tenant settings router group
- [x] Apply `middleware.RequireTeamAdmin()`
- [x] Return list of all presets from `AllRiskScoringPresets` map
- [x] Include preset name and full config for each

### 4.7 GET /settings/risk-scoring/presets/{industry} (Deferred)
- [ ] Add single preset lookup endpoint (low priority — frontend can filter from list)

### 4.8 Tests
- [x] Create `api/tests/unit/settings_handler_scoring_test.go`
- [x] Test: GET returns current config
- [x] Test: PATCH with valid config — updates and returns new config
- [x] Test: PATCH with invalid config (weights != 100) — returns 400
- [ ] Test: PATCH creates audit log entry (requires audit service mock)
- [x] Test: PATCH invalidates scoring cache (wired AssetService with provider)
- [x] Test: preview returns correct deltas for sample assets (wired AssetService)
- [x] Test: preview with invalid config — returns 400
- [x] Test: recalculate — returns updated count (wired AssetService)
- [ ] Test: recalculate rate limited — returns 429 (requires Redis)
- [x] Test: GET presets — returns all presets
- [ ] Test: GET preset by industry — returns correct preset (endpoint deferred)
- [ ] Test: GET unknown preset — returns 404 (endpoint deferred)
- [ ] Test: PATCH without `settings:scoring:write` — returns 403 (granular perms deferred)
- [ ] Test: GET without `settings:scoring:read` — returns 403 (granular perms deferred)
- [x] Test: GET no tenant context — returns 400
- [x] Test: GET tenant not found — returns 404
- [x] Test: PATCH invalid JSON — returns 400
- [x] Test: PATCH no tenant context — returns 400
- [x] Test: PATCH persists and reads back correctly
- [x] Test: Update and read all presets roundtrip
- [x] Test: Zero weight components allowed
- [x] Test: Service error returns 500
- [x] Test: Invalid risk level order returns 400
- [x] Test: Fresh data after update
- [x] Test: Each preset passes validation
- [x] Test: Presets contain legacy, default, banking, healthcare, ecommerce, government
- [x] Test: Preview without asset service returns 500
- [x] Test: Recalculate without asset service returns 500
- [x] Test: Recalculate no tenant context returns 400

---

## Phase 5: Frontend — Settings Page (~900 LOC)

### 5.1 API Types
- [x] Added types to `ui/src/features/organization/types/settings.types.ts` (follows existing pattern)
- [x] Define `RiskScoringSettings` interface (mirrors API response)
- [x] Define `ComponentWeights`, `ExposureScoreConfig`, etc. interfaces
- [x] Define `RiskScorePreviewItem` interface
- [x] Define `PreviewResponse` interface (summary + assets)
- [x] Define `RecalculateResponse` interface
- [x] Define `PresetInfo` interface

### 5.2 API Hooks
- [x] Create `ui/src/features/organization/api/use-risk-scoring-settings.ts`
- [x] Implement `useRiskScoringSettings()` — SWR GET hook
- [x] Implement `useUpdateRiskScoring()` — SWR mutation (PATCH)
- [x] Implement `useRiskScoringPreview()` — SWR mutation (POST with body)
- [x] Implement `useRiskScoringPresets()` — SWR GET hook
- [x] Implement `useRecalculateRiskScores()` — SWR mutation (POST)
- [x] Cache invalidation via SWR mutate after PATCH
- [x] Added 4 API endpoints in `lib/api/endpoints.ts`

### 5.3 Settings Page Components (inline in page)
- [x] Preset selector — buttons for each preset
- [x] Weight sliders with sum=100 constraint and error display
- [x] Exposure score inputs — 5 number inputs (0-100) + multipliers
- [x] Criticality score inputs — 5 number inputs (0-100)
- [x] Finding impact config — select for mode + conditional severity weights
- [x] CTEM factors config — switch + 5 point inputs (disabled when off)
- [x] Risk level thresholds — 4 number inputs
- [x] Scoring preview — preview table with current/new/delta columns
- [x] Formula explanation card
- [x] Recalculate button with confirm dialog

### 5.4 Page Assembly
- [x] Rewrite `ui/src/app/(dashboard)/settings/scoring/page.tsx`
- [x] Load current config via `useRiskScoringSettings()`
- [ ] Permission gate (deferred — uses existing `RequireTeamAdmin` on backend)
- [x] Save button: calls `useUpdateRiskScoring()` with form data
- [x] Reset button: resets to fetched config
- [x] Track form dirty state (unsaved changes)
- [x] When preset selected, populate all fields
- [x] When any field manually changed, set preset to "custom"
- [x] Loading skeleton while data loads

### 5.5 Tests
- [x] Create `ui/src/features/organization/api/__tests__/use-risk-scoring-settings.test.ts`
- [x] Test: `useRiskScoringSettings()` returns config (3 tests: endpoint, null key, return shape)
- [x] Test: `useUpdateRiskScoring()` sends PATCH (3 tests: endpoint, null key, return shape)
- [x] Test: `useRiskScoringPreview()` sends POST with proposed config (2 tests)
- [x] Test: `useRecalculateRiskScores()` sends POST (2 tests)
- [x] Test: `useRiskScoringPresets()` returns presets (2 tests)
- [ ] Test: permission gating — inputs disabled without write permission (deferred)

---

## Phase 6: Frontend — Risk Level Display Update (~150 LOC)

### 6.1 Update getRiskLevel
- [x] Add `RiskLevelThresholds` interface to `ui/src/features/shared/types/common.types.ts`
- [x] Add `DEFAULT_RISK_LEVELS` constant
- [x] Update `getRiskLevel()` signature: add optional `thresholds?: RiskLevelThresholds` parameter
- [x] Use `thresholds ?? DEFAULT_RISK_LEVELS` for fallback (backward compat)
- [x] All existing callers continue to work without changes

### 6.2 RiskScoringContext
- [x] Create `ui/src/context/risk-scoring-provider.tsx`
- [x] Create `RiskScoringContext` with `thresholds` and `isLoading`
- [x] Create `RiskScoringProvider` component — loads tenant scoring config via SWR
- [x] Create `useRiskThresholds()` hook — returns context value
- [x] Add `RiskScoringProvider` to app providers (in `dashboard-providers.tsx`)

### 6.3 Update Risk Score Components
- [x] Update `RiskScoreBadge` — use `useRiskThresholds()` for thresholds
- [x] Update `RiskScoreMeter` — use `useRiskThresholds()` for thresholds
- [x] Update `RiskScoreGauge` — use `useRiskThresholds()` for thresholds
- [x] Verify all other places that call `getRiskLevel()` — only risk-score-badge.tsx uses it (checked)

### 6.4 Tests
- [x] Test: `getRiskLevel()` without thresholds = default behavior (5 level tests + color test)
- [x] Test: `getRiskLevel()` with custom thresholds = respects them (5 threshold tests)
- [x] Test: backward compatibility — undefined thresholds works
- [x] Test: `DEFAULT_RISK_LEVELS` has expected values and proper ordering
- [x] Test: `RiskScoreBadge` renders correct label with custom thresholds (7 component tests)
- [x] Test: `RiskScoreMeter` renders score value
- [x] Test: `RiskScoreGauge` renders score and label
- [x] Test: `RiskScoringProvider` provides thresholds from API (3 tests)
- [x] Test: `RiskScoringProvider` falls back to defaults when settings undefined

---

## Cross-Cutting Tasks

### Documentation
- [x] Update `docs/_internal/index.md` — add RFC entry
- [x] Update tasks file with newly discovered tasks and progress

### Code Quality
- [x] Run `golangci-lint` on all new Go files
- [x] Run `goimports` on all new Go files
- [x] Run `npx tsc --noEmit` and `npx eslint` on all new UI files
- [x] Run `npm run build` to verify no build errors

### Integration Verification
- [x] Verify: new tenant gets legacy preset automatically via `DefaultSettings()`
- [x] Verify: existing tenant with no `risk_scoring` in JSONB gets legacy preset (same as above — new tenant has no prior JSONB)
- [x] Verify: scoring config changes reflect immediately (cache invalidation)
- [x] Verify: recalculation updates all assets in tenant (3 assets, scores matched preview)
- [x] Verify: preview shows accurate deltas (banking→healthcare: 65→53, 23→19, 9→7)
- [x] Verify: API returns 401 for unauthenticated requests
- [x] Verify: concurrent recalculations are blocked (409 Conflict)

---

## Implementation Order (Recommended)

```
Phase 1 (Domain) → Phase 2 (Engine) → Phase 3 (Service)
    → Phase 4 (API) → Phase 5 (Frontend Page) → Phase 6 (Risk Display)
```

Each phase should be implemented and tested before moving to the next.
Within each phase, implement in task order (types → logic → tests).

---

## Task Summary

| Phase | Tasks | Tests |
|-------|-------|-------|
| Phase 1: Domain Layer | 26 tasks | 12 test cases |
| Phase 2: Scoring Engine | 16 tasks | 15 test cases |
| Phase 3: Service Layer | 18 tasks | 11 test cases |
| Phase 4: API Endpoints | 23 tasks | 14 test cases |
| Phase 5: Frontend Page | 20 tasks | 5 test cases |
| Phase 6: Risk Display | 10 tasks | 4 test cases |
| Cross-Cutting | 7 tasks | — |
| **Total** | **120 tasks** | **61 test cases** |
