---
layout: default
title: Configurable Risk Scoring
parent: Features
nav_order: 18
---

# Configurable Risk Scoring Engine

> **Status**: Implemented
> **Version**: v1.0
> **Released**: 2026-03-10

## Overview

The Configurable Risk Scoring Engine replaces the previously hardcoded asset risk score formula with a fully tenant-configurable system. Each organization can define their own component weights, exposure scores, criticality mappings, CTEM factor toggles, finding impact formula, and risk level thresholds — all stored as part of the existing tenant Settings system.

Six industry presets (Legacy, Default, Banking, Healthcare, E-commerce, Government) provide instant configuration, while full manual customization allows organizations to tailor scoring to their specific risk profile. A live preview feature shows score impacts before committing changes.

## Problem Statement

The original risk scoring formula was hardcoded:

```
baseScore = exposure (max 40) + criticality (max 25) + findings (max 35)
finalScore = baseScore × exposureMultiplier
```

This caused several problems:

| Problem | Impact |
|---------|--------|
| Fixed weights (40/25/35) | Banking needs higher criticality, SaaS needs higher exposure |
| Finding impact counts quantity only | 1 critical finding = 1 info finding (both score 5 points) |
| CTEM factors never applied | `CTEMRiskFactor()` computed but unused (internet, PII, PHI, compliance) |
| Not per-tenant | All tenants share a single formula |
| No presets | Must configure from scratch, no industry templates |
| Settings page disabled | Scoring settings showed "Coming Soon" |

## Scoring Formula

The new engine uses a weighted-sum model with four configurable components:

```
Component Scores (each normalized to 0-100):
  exposure_score    = ExposureScores[asset.exposure]
  criticality_score = CriticalityScores[asset.criticality]
  finding_score     = findingScore(asset, config)     ← count or severity-weighted
  ctem_score        = ctemScore(asset, config)         ← additive points

Weighted Sum:
  raw = (exposure_score    × weight.Exposure    / 100)
      + (criticality_score × weight.Criticality / 100)
      + (finding_score     × weight.Findings    / 100)
      + (ctem_score        × weight.CTEM        / 100)

Final:
  score = clamp(raw × ExposureMultipliers[asset.exposure], 0, 100)
```

All four weights must sum to 100.

### Finding Score Modes

**Count-based** (simple, backward compatible):

```
findingScore = min(findingCount × perFindingPoints, findingCap)
```

**Severity-weighted** (recommended):

```
weightedSum = Σ(count_per_severity × severity_weight)
findingScore = min(weightedSum, findingCap)

Default severity weights:
  critical: 20, high: 10, medium: 5, low: 2, info: 1
```

Severity counts are computed via an extended LEFT JOIN subquery — no additional database queries are needed.

### CTEM Score

When enabled, the CTEM component assigns additive points for each applicable factor:

| Factor | Default Points | Description |
|--------|---------------|-------------|
| Internet Accessible | 30 | Asset is reachable from the internet |
| PII Exposed | 20 | Asset contains personally identifiable information |
| PHI Exposed | 25 | Asset contains protected health information |
| High Risk Compliance | 15 | Asset is subject to compliance requirements |
| Restricted Data | 20 | Asset handles restricted or classified data |

The CTEM score is capped at 100.

### Smart CTEM Weight Handling

When CTEM is disabled but has a non-zero weight, the engine automatically redistributes that weight proportionally to the other three components. This prevents "wasting" score capacity on a disabled component.

Example: Weights `{exposure: 25, criticality: 30, findings: 25, ctem: 20}` with CTEM disabled becomes effectively `{exposure: 31, criticality: 38, findings: 31, ctem: 0}`.

## Industry Presets

Six presets are available out of the box:

| Preset | Exposure | Criticality | Findings | CTEM | Focus |
|--------|----------|-------------|----------|------|-------|
| **Legacy** | 40% | 25% | 35% | 0% | Exact reproduction of the original formula |
| **Default** | 35% | 25% | 30% | 10% | Balanced for general-purpose use |
| **Banking** | 25% | 30% | 25% | 20% | High criticality + CTEM, PII-focused |
| **Healthcare** | 20% | 25% | 25% | 30% | Highest CTEM weight, PHI + HIPAA focused |
| **E-commerce** | 40% | 20% | 30% | 10% | Highest exposure weight, public-facing |
| **Government** | 20% | 30% | 20% | 30% | High compliance + criticality, restricted data |

Each preset also configures appropriate exposure scores, criticality mappings, finding impact settings, CTEM point values, multipliers, and risk level thresholds tailored for the industry.

### Backward Compatibility

The **Legacy** preset is the default for all tenants. It reproduces the exact previous hardcoded formula — existing tenants see zero score change on upgrade. Organizations can opt-in to other presets at their own pace.

## Configuration Options

### Component Weights

| Field | Range | Constraint |
|-------|-------|------------|
| `exposure` | 0-100 | All four must sum to 100 |
| `criticality` | 0-100 | |
| `findings` | 0-100 | |
| `ctem` | 0-100 | |

### Exposure Scores & Multipliers

| Level | Score Range | Multiplier Range |
|-------|------------|-----------------|
| Public | 0-100 | 0.1-3.0 |
| Restricted | 0-100 | 0.1-3.0 |
| Private | 0-100 | 0.1-3.0 |
| Isolated | 0-100 | 0.1-3.0 |
| Unknown | 0-100 | 0.1-3.0 |

### Criticality Scores

| Level | Score Range |
|-------|------------|
| Critical | 0-100 |
| High | 0-100 |
| Medium | 0-100 |
| Low | 0-100 |
| None | 0-100 |

### Finding Impact

| Field | Range | Description |
|-------|-------|-------------|
| `mode` | `count` or `severity_weighted` | Scoring mode |
| `per_finding_points` | 1-50 | Points per finding (count mode) |
| `finding_cap` | 1-100 | Maximum finding component score |
| `severity_weights.*` | 0-50 | Weight per severity (severity_weighted mode) |

### Risk Level Thresholds

| Field | Range | Constraint |
|-------|-------|------------|
| `critical_min` | 1-100 | Must be > high_min |
| `high_min` | 1-100 | Must be > medium_min |
| `medium_min` | 1-100 | Must be > low_min |
| `low_min` | 1-100 | Must be > 0 |

Scores below `low_min` are labeled "Info".

## API Endpoints

All endpoints require admin or owner role (`RequireTeamAdmin` middleware).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/tenants/{tenant}/settings/risk-scoring` | Get current scoring configuration |
| `PATCH` | `/api/v1/tenants/{tenant}/settings/risk-scoring` | Update scoring configuration |
| `POST` | `/api/v1/tenants/{tenant}/settings/risk-scoring/preview` | Preview score changes before applying |
| `POST` | `/api/v1/tenants/{tenant}/settings/risk-scoring/recalculate` | Recalculate all asset risk scores |
| `GET` | `/api/v1/tenants/{tenant}/settings/risk-scoring/presets` | List all available presets |

### GET /settings/risk-scoring

Returns the current scoring configuration for the tenant.

```json
{
  "preset": "banking",
  "weights": { "exposure": 25, "criticality": 30, "findings": 25, "ctem": 20 },
  "exposure_scores": { "public": 90, "restricted": 60, "private": 35, "isolated": 15, "unknown": 50 },
  "exposure_multipliers": { "public": 1.4, "restricted": 1.1, "private": 1.0, "isolated": 0.9, "unknown": 1.0 },
  "criticality_scores": { "critical": 100, "high": 80, "medium": 55, "low": 30, "none": 0 },
  "finding_impact": {
    "mode": "severity_weighted",
    "per_finding_points": 5,
    "finding_cap": 100,
    "severity_weights": { "critical": 25, "high": 12, "medium": 6, "low": 2, "info": 1 }
  },
  "ctem_points": {
    "enabled": true,
    "internet_accessible": 25,
    "pii_exposed": 25,
    "phi_exposed": 15,
    "high_risk_compliance": 20,
    "restricted_data": 15
  },
  "risk_levels": { "critical_min": 85, "high_min": 65, "medium_min": 40, "low_min": 20 }
}
```

### PATCH /settings/risk-scoring

Update the scoring configuration. The request body follows the same structure as the GET response. All validation rules are applied server-side.

After a successful update, the scoring config cache is invalidated immediately. However, existing asset risk scores are **not** automatically recalculated — use the recalculate endpoint separately.

### POST /settings/risk-scoring/preview

Preview how a proposed configuration would affect existing asset scores without making any changes. Send the proposed configuration in the request body.

Response includes a stratified sample of up to 100 assets with current and new scores:

```json
{
  "assets": [
    {
      "asset_id": "019c...",
      "asset_name": "prod-api-server",
      "current_score": 65,
      "new_score": 53
    }
  ],
  "total_count": 3
}
```

The sampling strategy selects the top 20 highest-risk assets, bottom 20 lowest-risk assets, and 60 from the middle to provide a representative distribution.

### POST /settings/risk-scoring/recalculate

Triggers a full recalculation of all asset risk scores using the current scoring configuration.

```json
{
  "assets_updated": 1250
}
```

**Safety controls:**
- Distributed lock (Redis SETNX, 10-minute TTL) prevents concurrent recalculations
- Concurrent requests receive a `409 Conflict` response
- Maximum asset limit of 100,000 per tenant
- Batch processing (500 assets per batch) to avoid memory issues

### GET /settings/risk-scoring/presets

Returns all available industry presets with their full configuration:

```json
[
  {
    "name": "banking",
    "config": { "preset": "banking", "weights": { ... }, ... }
  },
  ...
]
```

## Frontend Integration

### Settings Page

The scoring settings page at **Settings > Scoring** provides:

- **Preset selector** — One-click industry preset buttons
- **Weight sliders** — Visual weight adjustment with sum=100 constraint
- **Exposure & criticality inputs** — Score and multiplier configuration per level
- **Finding impact mode** — Toggle between count-based and severity-weighted modes
- **CTEM toggle** — Enable/disable with per-factor point configuration
- **Risk level thresholds** — Configure label boundaries
- **Live preview** — See score impact on sample assets before saving
- **Recalculate button** — Apply changes to all assets with confirmation dialog

Form tracks dirty state and shows unsaved changes. Selecting a preset populates all fields; modifying any field switches to "custom" preset.

### Risk Score Display

All risk score components (`RiskScoreBadge`, `RiskScoreMeter`, `RiskScoreGauge`) use tenant-configured risk level thresholds via the `RiskScoringProvider` context. This means the risk labels (Critical, High, Medium, Low, Info) respect each tenant's configured thresholds.

The `RiskScoringProvider` is mounted in the dashboard providers chain and loads thresholds from the SWR-cached settings API, falling back to defaults when settings are unavailable.

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Tenant Settings (JSONB)                    │
│              tenants.settings.risk_scoring                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Scoring Config Cache (In-Memory)                │
│           scoringConfigEntry { config, expiresAt }           │
│               TTL: 5 minutes, RWMutex-protected              │
│         Invalidated on PATCH /settings/risk-scoring          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   RiskScoringEngine                          │
│  CalculateScore(asset) → weighted sum + multiplier → 0-100   │
│                                                              │
│  Called at 6 points:                                         │
│    CreateAsset, UpdateAsset, SyncAsset,                      │
│    UpdateFindingCount, SyncAssetWithIntegration,             │
│    CreateAssetWithRepository                                 │
└─────────────────────────────────────────────────────────────┘
```

### Batch Recalculation Flow

```
POST /settings/risk-scoring/recalculate
    │
    ├─ Acquire Redis lock (SETNX, 10-min TTL)
    │   └─ On failure → 409 Conflict
    │
    ├─ Invalidate scoring config cache
    │
    ├─ Count total assets (reject if > 100K)
    │
    ├─ For each batch of 500:
    │   ├─ List assets with severity counts
    │   ├─ Recalculate scores in memory
    │   └─ BatchUpdateRiskScores (single UPDATE via unnest)
    │
    ├─ Release lock
    │
    └─ Return { assets_updated: N }
```

### Frontend Context Flow

```
RiskScoringProvider (dashboard-providers.tsx)
    │
    ├─ useRiskScoringSettings() → SWR fetch from API
    │
    ├─ Extract risk_levels thresholds
    │
    └─ Provide via useRiskThresholds() hook
        │
        ├─ RiskScoreBadge → getRiskLevel(score, thresholds)
        ├─ RiskScoreMeter → getRiskLevel(score, thresholds)
        └─ RiskScoreGauge → getRiskLevel(score, thresholds)
```

## Security

| Control | Description |
|---------|-------------|
| **Permission** | Admin/Owner only via `RequireTeamAdmin()` middleware |
| **Validation** | Strict bounds on all config values (prevents integer overflow, score explosion) |
| **Audit logging** | Every config change is logged with preset metadata |
| **Rate limiting** | Recalculation rate-limited via distributed lock (Redis SETNX, 10-min TTL) |
| **Asset count limit** | Recalculation capped at 100K assets |
| **Read-only preview** | Preview computes scores in-memory with zero DB writes |
| **Tenant isolation** | Each tenant has independent config; cache keys are tenant-scoped |
| **Input validation** | All enum values validated against known values; arbitrary keys rejected |

## Performance

| Operation | Impact |
|-----------|--------|
| **Severity counts** | Extended existing LEFT JOIN — negligible overhead (same GROUP BY scan) |
| **Config loading** | In-memory cache with 5-min TTL; first call hits DB, subsequent calls are free |
| **Score calculation** | Pure math in memory — microseconds per asset |
| **Batch recalculate** | 500 assets/batch, single UPDATE per batch via `unnest()`. 10K assets = ~40 queries |
| **Preview** | Single SELECT for 100 sample assets, all computation in memory |

## Key Files

### Backend

| File | Description |
|------|-------------|
| `api/pkg/domain/tenant/settings.go` | `RiskScoringSettings` types, validation, presets |
| `api/pkg/domain/asset/risk_scoring.go` | `RiskScoringEngine` — scoring calculation |
| `api/pkg/domain/asset/entity.go` | `FindingSeverityCounts`, `CalculateRiskScoreWithConfig()` |
| `api/internal/app/asset_service.go` | Config cache, `RecalculateAllRiskScores()`, `PreviewRiskScoreChanges()` |
| `api/internal/app/scoring_config_provider.go` | `TenantScoringConfigProvider` interface implementation |
| `api/internal/infra/http/handler/tenant_handler.go` | API endpoint handlers |
| `api/internal/infra/http/routes/tenant.go` | Route registration |
| `api/internal/infra/postgres/asset_repository.go` | Severity count LEFT JOIN, `BatchUpdateRiskScores()` |

### Frontend

| File | Description |
|------|-------------|
| `ui/src/features/organization/types/settings.types.ts` | TypeScript interfaces |
| `ui/src/features/organization/api/use-risk-scoring-settings.ts` | SWR hooks for all endpoints |
| `ui/src/app/(dashboard)/settings/scoring/page.tsx` | Settings page UI |
| `ui/src/context/risk-scoring-provider.tsx` | `RiskScoringProvider` context |
| `ui/src/features/shared/components/risk-score-badge.tsx` | Risk score display components |
| `ui/src/features/shared/lib/risk-level.ts` | `getRiskLevel()` with threshold support |
| `ui/src/lib/api/endpoints.ts` | API endpoint constants |

### Tests

| File | Tests | Description |
|------|-------|-------------|
| `api/tests/unit/risk_scoring_test.go` | 30+ | Settings validation, presets, engine calculation |
| `api/tests/unit/asset_service_scoring_test.go` | 15+ | Config cache, batch recalculation, preview |
| `api/tests/unit/settings_handler_scoring_test.go` | 27+ | API endpoint handlers |
| `ui/src/features/organization/api/__tests__/use-risk-scoring-settings.test.ts` | 12 | SWR hooks |
| `ui/src/features/shared/__tests__/risk-level.test.ts` | 15 | `getRiskLevel()` function |
| `ui/src/features/shared/__tests__/risk-score-badge.test.tsx` | 9 | Score display components |
| `ui/src/context/__tests__/risk-scoring-provider.test.tsx` | 3 | Context provider |

## Related Documentation

- [CTEM Finding Fields](ctem-fields.md) — CTEM factor fields used in scoring
- [Component Interactions](component-interactions.md) — How scoring fits into the asset lifecycle
