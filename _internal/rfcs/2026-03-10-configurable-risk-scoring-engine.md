# Configurable Risk Scoring Engine

**Created:** 2026-03-10
**Status:** Implemented
**Priority:** P1
**Last Updated:** 2026-03-10
**Revision:** 2 (comprehensive review — PM/TechLead, Security, UX, Performance)

---

## Summary

Replace the hardcoded risk score formula in `Asset.CalculateRiskScore()` with a tenant-configurable scoring engine. Each organization can define their own component weights, exposure scores, criticality scores, CTEM factor toggles, and finding impact formula — stored as part of the existing tenant `Settings` system.

---

## Current State — Analysis

### Hardcoded Formula

**File:** `api/pkg/domain/asset/entity.go:382-406`

```go
func (a *Asset) CalculateRiskScore() {
    baseScore := a.exposure.BaseRiskScore()       // max 40
    criticalityScore := a.criticality.Score() / 4 // max 25
    findingImpact := min(a.findingCount*5, 35)    // max 35
    rawScore := baseScore + criticalityScore + findingImpact  // max 100
    finalScore := int(float64(rawScore) * a.exposure.ExposureMultiplier())
    // cap 0-100
}
```

### Problems

| Problem | Impact |
|---------|--------|
| Weights 40/25/35 fixed | Banking needs higher criticality, SaaS needs higher exposure |
| Finding impact only counts quantity | 1 critical finding = 1 info finding (both score 5 points) |
| CTEM factors not applied | `CTEMRiskFactor()` computes but is never used (internet, PII, PHI, compliance) |
| Not per-tenant | All tenants share a single formula |
| Settings page disabled | `settings/scoring/page.tsx` shows "Coming Soon" |
| No presets | Must configure from scratch, no industry templates |

### Where Score is Calculated (6 call sites)

| File | Line | Context |
|------|------|---------|
| `asset_service.go` | 134 | CreateAsset |
| `asset_service.go` | 281 | UpdateAsset |
| `asset_service.go` | 802 | SyncAsset |
| `asset_service.go` | 1218 | UpdateAssetFindingCount |
| `asset_service.go` | 1245 | UpdateRepositoryFindingCount |
| `asset_service.go` | 1480 | SyncAssetWithIntegration |

### Existing Infrastructure

- **Tenant Settings**: `Settings` struct in `tenant/settings.go` — already has General, Security, API, Branding, Branch, AI sections
- **Settings storage**: JSONB column in `tenants` table — no migration needed for config
- **Settings API**: `PATCH /api/v1/settings/{section}` pattern established in `tenant_handler.go`
- **Settings validation**: Each section has `Validate()` method
- **Default values**: `DefaultSettings()` provides defaults for new tenants
- **Finding count**: Computed via `LEFT JOIN (SELECT asset_id, COUNT(*) FROM findings GROUP BY asset_id)` in `selectQuery()` — NOT stored as physical column

### Key Discovery: finding_count is COMPUTED, not stored

The `finding_count` on assets is populated via LEFT JOIN subquery in `asset_repository.go:199`:

```sql
LEFT JOIN (SELECT asset_id, COUNT(*) as finding_count FROM findings GROUP BY asset_id) fc ON fc.asset_id = a.id
```

This means we can extend this same subquery to include severity breakdown — **zero DB migration needed** for severity counts either.

---

## Architecture Design

### Core Principle: Extend Existing Settings

Instead of creating a new table, add `RiskScoring RiskScoringSettings` to the existing `tenant.Settings` struct. This:
- Requires **zero DB migrations** (config in JSONB, severity counts via extended LEFT JOIN)
- Follows the **proven pattern** (General, Security, AI all work this way)
- Automatically **per-tenant** via JSONB in tenants table
- Has **validation, defaults, API** infrastructure ready

### New Scoring Formula

```
Component Scores (each normalized to 0-100):
  exposure_score    = config.ExposureScores[asset.exposure]       (0-100)
  criticality_score = config.CriticalityScores[asset.criticality] (0-100)
  finding_score     = computeFindingScore(asset, config)           (0-100)
  ctem_score        = computeCTEMScore(asset, config)              (0-100)

Weighted Sum:
  raw = (exposure_score    × weight.Exposure    / 100)
      + (criticality_score × weight.Criticality / 100)
      + (finding_score     × weight.Findings    / 100)
      + (ctem_score        × weight.CTEM        / 100)

  // weights MUST sum to 100
  // If CTEM is disabled AND weight.CTEM > 0, validation warns (see Smart CTEM Handling below)

Final:
  score = clamp(raw × config.ExposureMultipliers[asset.exposure], 0, 100)
```

### Smart CTEM Weight Handling

**Problem**: User can set CTEM weight to 30 but leave CTEM disabled — wasting 30% of the score (always 0).

**Solution**: When CTEM is disabled, redistribute its weight proportionally:

```go
func (e *RiskScoringEngine) effectiveWeights() ComponentWeights {
    w := e.config.Weights
    if !e.config.CTEMPoints.Enabled && w.CTEM > 0 {
        // Redistribute CTEM weight proportionally
        remaining := w.Exposure + w.Criticality + w.Findings
        if remaining > 0 {
            factor := float64(100) / float64(remaining)
            w.Exposure = int(math.Round(float64(w.Exposure) * factor))
            w.Criticality = int(math.Round(float64(w.Criticality) * factor))
            w.Findings = 100 - w.Exposure - w.Criticality // Absorb rounding
            w.CTEM = 0
        }
    }
    return w
}
```

### Finding Score Enhancement

Current: `min(findingCount × 5, 35)` — ignores severity.

New (configurable):

```
Mode A — Count-based (simple, backward compatible):
  findingScore = min(findingCount × perFindingPoints, findingCap)

Mode B — Severity-weighted (recommended):
  weightedSum = Σ(count_per_severity × severity_weight)
  findingScore = min(weightedSum, findingCap)

  Default severity weights:
    critical: 20, high: 10, medium: 5, low: 2, info: 1
```

**Severity counts obtained via extended LEFT JOIN** — no migration:

```sql
LEFT JOIN (
    SELECT asset_id,
        COUNT(*) as finding_count,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as finding_critical,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as finding_high,
        SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as finding_medium,
        SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as finding_low,
        SUM(CASE WHEN severity = 'info' THEN 1 ELSE 0 END) as finding_info
    FROM findings
    WHERE status != 'resolved'
    GROUP BY asset_id
) fc ON fc.asset_id = a.id
```

### CTEM Score (new component)

Currently `CTEMRiskFactor()` returns a multiplier (1.0-3.5x) but is never used.

New: Convert to a 0-100 score using additive points:

```
ctemScore = 0
if internetAccessible:   ctemScore += config.CTEMPoints.InternetAccessible  (default 30)
if piiDataExposed:       ctemScore += config.CTEMPoints.PIIExposed          (default 20)
if phiDataExposed:       ctemScore += config.CTEMPoints.PHIExposed          (default 25)
if highRiskCompliance:   ctemScore += config.CTEMPoints.HighRiskCompliance  (default 15)
if restrictedOrSecret:   ctemScore += config.CTEMPoints.RestrictedData      (default 20)

ctemScore = min(ctemScore, 100)
```

---

## Implementation Plan

### Phase 1: Domain Layer — Settings & Scoring Config

**File:** `api/pkg/domain/tenant/settings.go`

Add to existing `Settings` struct:

```go
type Settings struct {
    General     GeneralSettings     `json:"general"`
    Security    SecuritySettings    `json:"security"`
    API         APISettings         `json:"api"`
    Branding    BrandingSettings    `json:"branding"`
    Branch      BranchSettings      `json:"branch"`
    AI          AISettings          `json:"ai"`
    RiskScoring RiskScoringSettings `json:"risk_scoring"` // NEW
}
```

New types:

```go
// RiskScoringSettings configures the risk scoring formula per tenant.
type RiskScoringSettings struct {
    // Preset name (for UI display). Empty = custom.
    Preset string `json:"preset,omitempty"`

    // Component weights (must sum to 100)
    Weights ComponentWeights `json:"weights"`

    // Exposure base scores (0-100 per level)
    ExposureScores ExposureScoreConfig `json:"exposure_scores"`

    // Exposure multipliers (applied after raw score)
    ExposureMultipliers ExposureMultiplierConfig `json:"exposure_multipliers"`

    // Criticality scores (0-100 per level)
    CriticalityScores CriticalityScoreConfig `json:"criticality_scores"`

    // Finding impact configuration
    FindingImpact FindingImpactConfig `json:"finding_impact"`

    // CTEM factor points
    CTEMPoints CTEMPointsConfig `json:"ctem_points"`

    // Risk level thresholds (for display labels)
    RiskLevels RiskLevelConfig `json:"risk_levels"`
}

type ComponentWeights struct {
    Exposure    int `json:"exposure"`    // 0-100
    Criticality int `json:"criticality"` // 0-100
    Findings    int `json:"findings"`    // 0-100
    CTEM        int `json:"ctem"`        // 0-100
    // Sum must equal 100
}

type ExposureScoreConfig struct {
    Public     int `json:"public"`     // default 80
    Restricted int `json:"restricted"` // default 50
    Private    int `json:"private"`    // default 30
    Isolated   int `json:"isolated"`   // default 10
    Unknown    int `json:"unknown"`    // default 40
}

type ExposureMultiplierConfig struct {
    Public     float64 `json:"public"`     // default 1.3
    Restricted float64 `json:"restricted"` // default 1.1
    Private    float64 `json:"private"`    // default 1.0
    Isolated   float64 `json:"isolated"`   // default 0.9
    Unknown    float64 `json:"unknown"`    // default 1.0
}

type CriticalityScoreConfig struct {
    Critical int `json:"critical"` // default 100
    High     int `json:"high"`     // default 75
    Medium   int `json:"medium"`   // default 50
    Low      int `json:"low"`      // default 25
    None     int `json:"none"`     // default 0
}

type FindingImpactConfig struct {
    // Mode: "count" (simple count × points) or "severity_weighted"
    Mode string `json:"mode"` // default "severity_weighted"

    // Count-based mode
    PerFindingPoints int `json:"per_finding_points"` // default 5
    FindingCap       int `json:"finding_cap"`        // default 100

    // Severity-weighted mode
    SeverityWeights SeverityWeightConfig `json:"severity_weights"`
}

type SeverityWeightConfig struct {
    Critical int `json:"critical"` // default 20
    High     int `json:"high"`     // default 10
    Medium   int `json:"medium"`   // default 5
    Low      int `json:"low"`      // default 2
    Info     int `json:"info"`     // default 1
}

type CTEMPointsConfig struct {
    Enabled              bool `json:"enabled"`               // default false (backward compat)
    InternetAccessible   int  `json:"internet_accessible"`   // default 30
    PIIExposed           int  `json:"pii_exposed"`           // default 20
    PHIExposed           int  `json:"phi_exposed"`           // default 25
    HighRiskCompliance   int  `json:"high_risk_compliance"`  // default 15
    RestrictedData       int  `json:"restricted_data"`       // default 20
}

type RiskLevelConfig struct {
    CriticalMin int `json:"critical_min"` // default 80
    HighMin     int `json:"high_min"`     // default 60
    MediumMin   int `json:"medium_min"`   // default 40
    LowMin      int `json:"low_min"`      // default 20
    // Below LowMin = Info
}
```

**Legacy Preset** (must reproduce EXACT current formula for backward compat):

```go
func LegacyRiskScoringSettings() RiskScoringSettings {
    // This preset exactly reproduces the current hardcoded formula
    // so existing tenants see zero score changes on upgrade.
    return RiskScoringSettings{
        Preset: "legacy",
        Weights: ComponentWeights{
            Exposure: 40, Criticality: 25, Findings: 35, CTEM: 0,
        },
        ExposureScores: ExposureScoreConfig{
            Public: 100, Restricted: 62, Private: 37, Isolated: 12, Unknown: 50,
        },
        ExposureMultipliers: ExposureMultiplierConfig{
            Public: 1.5, Restricted: 1.2, Private: 1.0, Isolated: 0.8, Unknown: 1.0,
        },
        CriticalityScores: CriticalityScoreConfig{
            Critical: 100, High: 75, Medium: 50, Low: 25, None: 0,
        },
        FindingImpact: FindingImpactConfig{
            Mode: "count",
            PerFindingPoints: 14, // 5 / 35 * 100 ≈ 14.28
            FindingCap: 100,
        },
        CTEMPoints: CTEMPointsConfig{Enabled: false},
        RiskLevels: RiskLevelConfig{
            CriticalMin: 80, HighMin: 60, MediumMin: 40, LowMin: 20,
        },
    }
}
```

**Defaults** (add to `DefaultSettings()`):

```go
// DefaultSettings returns the "legacy" preset for zero-change upgrade.
// New tenants can switch to "default" or industry presets via UI.
RiskScoring: LegacyRiskScoringSettings(),
```

> **CRITICAL**: DefaultSettings MUST use the legacy preset so existing tenants experience ZERO score change on upgrade. The "default" (recommended) and industry presets are available via the presets API.

**Recommended Default Preset** (for new tenants who choose to upgrade):

```go
func DefaultRiskScoringPreset() RiskScoringSettings {
    return RiskScoringSettings{
        Preset: "default",
        Weights: ComponentWeights{
            Exposure: 35, Criticality: 25, Findings: 30, CTEM: 10,
        },
        ExposureScores: ExposureScoreConfig{
            Public: 80, Restricted: 50, Private: 30, Isolated: 10, Unknown: 40,
        },
        ExposureMultipliers: ExposureMultiplierConfig{
            Public: 1.3, Restricted: 1.1, Private: 1.0, Isolated: 0.9, Unknown: 1.0,
        },
        CriticalityScores: CriticalityScoreConfig{
            Critical: 100, High: 75, Medium: 50, Low: 25, None: 0,
        },
        FindingImpact: FindingImpactConfig{
            Mode: "severity_weighted",
            PerFindingPoints: 5, FindingCap: 100,
            SeverityWeights: SeverityWeightConfig{
                Critical: 20, High: 10, Medium: 5, Low: 2, Info: 1,
            },
        },
        CTEMPoints: CTEMPointsConfig{
            Enabled: false,
            InternetAccessible: 30, PIIExposed: 20, PHIExposed: 25,
            HighRiskCompliance: 15, RestrictedData: 20,
        },
        RiskLevels: RiskLevelConfig{
            CriticalMin: 80, HighMin: 60, MediumMin: 40, LowMin: 20,
        },
    }
}
```

**Validation** (comprehensive):

```go
func (s *RiskScoringSettings) Validate() error {
    // 1. Weights must sum to 100
    sum := s.Weights.Exposure + s.Weights.Criticality + s.Weights.Findings + s.Weights.CTEM
    if sum != 100 {
        return fmt.Errorf("%w: weights must sum to 100, got %d", shared.ErrValidation, sum)
    }

    // 2. All weights must be 0-100
    for name, w := range map[string]int{
        "exposure": s.Weights.Exposure, "criticality": s.Weights.Criticality,
        "findings": s.Weights.Findings, "ctem": s.Weights.CTEM,
    } {
        if w < 0 || w > 100 {
            return fmt.Errorf("%w: weight '%s' must be 0-100, got %d", shared.ErrValidation, name, w)
        }
    }

    // 3. Exposure scores must be 0-100
    for name, v := range map[string]int{
        "public": s.ExposureScores.Public, "restricted": s.ExposureScores.Restricted,
        "private": s.ExposureScores.Private, "isolated": s.ExposureScores.Isolated,
        "unknown": s.ExposureScores.Unknown,
    } {
        if v < 0 || v > 100 {
            return fmt.Errorf("%w: exposure score '%s' must be 0-100", shared.ErrValidation, name)
        }
    }

    // 4. Criticality scores must be 0-100
    for name, v := range map[string]int{
        "critical": s.CriticalityScores.Critical, "high": s.CriticalityScores.High,
        "medium": s.CriticalityScores.Medium, "low": s.CriticalityScores.Low,
        "none": s.CriticalityScores.None,
    } {
        if v < 0 || v > 100 {
            return fmt.Errorf("%w: criticality score '%s' must be 0-100", shared.ErrValidation, name)
        }
    }

    // 5. Multipliers must be 0.1-3.0 (prevent score explosion)
    for name, m := range map[string]float64{
        "public": s.ExposureMultipliers.Public, "restricted": s.ExposureMultipliers.Restricted,
        "private": s.ExposureMultipliers.Private, "isolated": s.ExposureMultipliers.Isolated,
        "unknown": s.ExposureMultipliers.Unknown,
    } {
        if m < 0.1 || m > 3.0 {
            return fmt.Errorf("%w: multiplier '%s' must be 0.1-3.0", shared.ErrValidation, name)
        }
    }

    // 6. Finding impact validation
    if s.FindingImpact.Mode != "count" && s.FindingImpact.Mode != "severity_weighted" {
        return fmt.Errorf("%w: finding mode must be 'count' or 'severity_weighted'", shared.ErrValidation)
    }
    if s.FindingImpact.FindingCap < 1 || s.FindingImpact.FindingCap > 100 {
        return fmt.Errorf("%w: finding_cap must be 1-100", shared.ErrValidation)
    }
    if s.FindingImpact.PerFindingPoints < 1 || s.FindingImpact.PerFindingPoints > 50 {
        return fmt.Errorf("%w: per_finding_points must be 1-50", shared.ErrValidation)
    }

    // 7. Severity weights must be 0-50 each
    for name, w := range map[string]int{
        "critical": s.FindingImpact.SeverityWeights.Critical,
        "high": s.FindingImpact.SeverityWeights.High,
        "medium": s.FindingImpact.SeverityWeights.Medium,
        "low": s.FindingImpact.SeverityWeights.Low,
        "info": s.FindingImpact.SeverityWeights.Info,
    } {
        if w < 0 || w > 50 {
            return fmt.Errorf("%w: severity weight '%s' must be 0-50", shared.ErrValidation, name)
        }
    }

    // 8. CTEM points must be 0-100 each
    if s.CTEMPoints.Enabled {
        for name, p := range map[string]int{
            "internet_accessible": s.CTEMPoints.InternetAccessible,
            "pii_exposed": s.CTEMPoints.PIIExposed,
            "phi_exposed": s.CTEMPoints.PHIExposed,
            "high_risk_compliance": s.CTEMPoints.HighRiskCompliance,
            "restricted_data": s.CTEMPoints.RestrictedData,
        } {
            if p < 0 || p > 100 {
                return fmt.Errorf("%w: CTEM points '%s' must be 0-100", shared.ErrValidation, name)
            }
        }
    }

    // 9. Risk levels must be ordered: critical > high > medium > low > 0
    if !(s.RiskLevels.CriticalMin > s.RiskLevels.HighMin &&
        s.RiskLevels.HighMin > s.RiskLevels.MediumMin &&
        s.RiskLevels.MediumMin > s.RiskLevels.LowMin &&
        s.RiskLevels.LowMin > 0) {
        return fmt.Errorf("%w: risk levels must be ordered critical > high > medium > low > 0", shared.ErrValidation)
    }

    // 10. Risk level bounds
    if s.RiskLevels.CriticalMin > 100 || s.RiskLevels.LowMin < 1 {
        return fmt.Errorf("%w: risk levels must be between 1-100", shared.ErrValidation)
    }

    return nil
}
```

**Industry Presets** (complete, no `...` placeholders):

```go
var AllPresets = map[string]RiskScoringSettings{
    "legacy":     LegacyRiskScoringSettings(),
    "default":    DefaultRiskScoringPreset(),
    "banking":    bankingPreset(),
    "healthcare": healthcarePreset(),
    "ecommerce":  ecommercePreset(),
    "government": governmentPreset(),
}

func RiskScoringPreset(industry string) (RiskScoringSettings, bool) {
    preset, ok := AllPresets[industry]
    return preset, ok
}

func bankingPreset() RiskScoringSettings {
    base := DefaultRiskScoringPreset()
    base.Preset = "banking"
    base.Weights = ComponentWeights{
        Exposure: 25, Criticality: 30, Findings: 25, CTEM: 20,
    }
    base.CTEMPoints.Enabled = true
    base.CTEMPoints.PIIExposed = 30
    base.CTEMPoints.HighRiskCompliance = 25
    base.FindingImpact.SeverityWeights.Critical = 25 // Extra weight on critical
    return base
}

func healthcarePreset() RiskScoringSettings {
    base := DefaultRiskScoringPreset()
    base.Preset = "healthcare"
    base.Weights = ComponentWeights{
        Exposure: 20, Criticality: 25, Findings: 25, CTEM: 30,
    }
    base.CTEMPoints.Enabled = true
    base.CTEMPoints.PHIExposed = 40
    base.CTEMPoints.PIIExposed = 30
    base.CTEMPoints.HighRiskCompliance = 25
    return base
}

func ecommercePreset() RiskScoringSettings {
    base := DefaultRiskScoringPreset()
    base.Preset = "ecommerce"
    base.Weights = ComponentWeights{
        Exposure: 40, Criticality: 20, Findings: 30, CTEM: 10,
    }
    base.ExposureScores.Public = 90 // Higher weight for public-facing
    return base
}

func governmentPreset() RiskScoringSettings {
    base := DefaultRiskScoringPreset()
    base.Preset = "government"
    base.Weights = ComponentWeights{
        Exposure: 20, Criticality: 30, Findings: 20, CTEM: 30,
    }
    base.CTEMPoints.Enabled = true
    base.CTEMPoints.RestrictedData = 35
    base.CTEMPoints.HighRiskCompliance = 30
    return base
}
```

**Estimated:** ~450 LOC (types + validation + presets + defaults + legacy)

---

### Phase 2: Scoring Engine + Severity Counts

**New file:** `api/pkg/domain/asset/risk_scoring.go`

```go
// RiskScoringEngine calculates risk scores using configurable weights.
type RiskScoringEngine struct {
    config tenant.RiskScoringSettings
}

func NewRiskScoringEngine(config tenant.RiskScoringSettings) *RiskScoringEngine {
    return &RiskScoringEngine{config: config}
}

// CalculateScore computes the risk score for an asset.
func (e *RiskScoringEngine) CalculateScore(a *Asset) int {
    w := e.effectiveWeights()

    // 1. Exposure component (0-100)
    exposureScore := e.exposureScore(a.exposure)

    // 2. Criticality component (0-100)
    criticalityScore := e.criticalityScore(a.criticality)

    // 3. Finding component (0-100)
    findingScore := e.findingScore(a)

    // 4. CTEM component (0-100)
    ctemScore := e.ctemScore(a)

    // 5. Weighted sum using effective weights
    raw := float64(exposureScore)*float64(w.Exposure)/100.0 +
        float64(criticalityScore)*float64(w.Criticality)/100.0 +
        float64(findingScore)*float64(w.Findings)/100.0 +
        float64(ctemScore)*float64(w.CTEM)/100.0

    // 6. Apply exposure multiplier
    multiplier := e.exposureMultiplier(a.exposure)
    final := int(math.Round(raw * multiplier))

    // 7. Clamp to 0-100
    if final > 100 { final = 100 }
    if final < 0 { final = 0 }

    return final
}

// effectiveWeights redistributes CTEM weight when CTEM is disabled.
func (e *RiskScoringEngine) effectiveWeights() tenant.ComponentWeights {
    w := e.config.Weights
    if !e.config.CTEMPoints.Enabled && w.CTEM > 0 {
        remaining := w.Exposure + w.Criticality + w.Findings
        if remaining > 0 {
            factor := 100.0 / float64(remaining)
            w.Exposure = int(math.Round(float64(w.Exposure) * factor))
            w.Criticality = int(math.Round(float64(w.Criticality) * factor))
            w.Findings = 100 - w.Exposure - w.Criticality
            w.CTEM = 0
        }
    }
    return w
}

func (e *RiskScoringEngine) exposureScore(exp Exposure) int {
    switch exp {
    case ExposurePublic:     return e.config.ExposureScores.Public
    case ExposureRestricted: return e.config.ExposureScores.Restricted
    case ExposurePrivate:    return e.config.ExposureScores.Private
    case ExposureIsolated:   return e.config.ExposureScores.Isolated
    default:                 return e.config.ExposureScores.Unknown
    }
}

func (e *RiskScoringEngine) criticalityScore(c Criticality) int {
    switch c {
    case CriticalityCritical: return e.config.CriticalityScores.Critical
    case CriticalityHigh:     return e.config.CriticalityScores.High
    case CriticalityMedium:   return e.config.CriticalityScores.Medium
    case CriticalityLow:      return e.config.CriticalityScores.Low
    default:                  return e.config.CriticalityScores.None
    }
}

func (e *RiskScoringEngine) findingScore(a *Asset) int {
    cfg := e.config.FindingImpact

    if cfg.Mode == "severity_weighted" && a.findingSeverityCounts != nil {
        w := cfg.SeverityWeights
        weighted := a.findingSeverityCounts.Critical*w.Critical +
            a.findingSeverityCounts.High*w.High +
            a.findingSeverityCounts.Medium*w.Medium +
            a.findingSeverityCounts.Low*w.Low +
            a.findingSeverityCounts.Info*w.Info

        if weighted > cfg.FindingCap { return cfg.FindingCap }
        return weighted
    }

    // Fallback: count-based
    score := a.findingCount * cfg.PerFindingPoints
    if score > cfg.FindingCap { return cfg.FindingCap }
    return score
}

func (e *RiskScoringEngine) ctemScore(a *Asset) int {
    if !e.config.CTEMPoints.Enabled { return 0 }

    score := 0
    pts := e.config.CTEMPoints

    if a.isInternetAccessible    { score += pts.InternetAccessible }
    if a.piiDataExposed          { score += pts.PIIExposed }
    if a.phiDataExposed          { score += pts.PHIExposed }
    if a.IsHighRiskCompliance()  { score += pts.HighRiskCompliance }
    if a.dataClassification == DataClassificationRestricted ||
       a.dataClassification == DataClassificationSecret {
        score += pts.RestrictedData
    }

    if score > 100 { return 100 }
    return score
}

func (e *RiskScoringEngine) exposureMultiplier(exp Exposure) float64 {
    switch exp {
    case ExposurePublic:     return e.config.ExposureMultipliers.Public
    case ExposureRestricted: return e.config.ExposureMultipliers.Restricted
    case ExposurePrivate:    return e.config.ExposureMultipliers.Private
    case ExposureIsolated:   return e.config.ExposureMultipliers.Isolated
    default:                 return e.config.ExposureMultipliers.Unknown
    }
}
```

**Update `Asset.CalculateRiskScore()`** to accept config:

```go
// CalculateRiskScore calculates risk using the provided scoring config.
// If config is nil, uses the legacy defaults (exact backward compatible).
func (a *Asset) CalculateRiskScore(config *tenant.RiskScoringSettings) {
    if config == nil {
        defaultCfg := tenant.LegacyRiskScoringSettings()
        config = &defaultCfg
    }

    engine := NewRiskScoringEngine(*config)
    a.riskScore = engine.CalculateScore(a)
    a.updatedAt = time.Now().UTC()
}
```

**Finding severity counts** — add to Asset entity:

```go
type FindingSeverityCounts struct {
    Critical int `json:"critical"`
    High     int `json:"high"`
    Medium   int `json:"medium"`
    Low      int `json:"low"`
    Info     int `json:"info"`
}
```

**Update `selectQuery()` in `asset_repository.go`** — extend LEFT JOIN:

```sql
-- Current:
LEFT JOIN (SELECT asset_id, COUNT(*) as finding_count FROM findings GROUP BY asset_id) fc ON fc.asset_id = a.id

-- New:
LEFT JOIN (
    SELECT asset_id,
        COUNT(*) as finding_count,
        COALESCE(SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END), 0) as finding_critical,
        COALESCE(SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END), 0) as finding_high,
        COALESCE(SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END), 0) as finding_medium,
        COALESCE(SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END), 0) as finding_low,
        COALESCE(SUM(CASE WHEN severity = 'info' THEN 1 ELSE 0 END), 0) as finding_info
    FROM findings
    WHERE status != 'resolved'
    GROUP BY asset_id
) fc ON fc.asset_id = a.id
```

Update `scanAsset()` to read the new columns:

```go
// In scanAsset helper:
var findingCritical, findingHigh, findingMedium, findingLow, findingInfo int
err := row.Scan(
    // ... existing fields ...,
    &findingCount,
    &findingCritical, &findingHigh, &findingMedium, &findingLow, &findingInfo,
    // ... rest ...,
)
// Set on asset:
asset.SetFindingSeverityCounts(&FindingSeverityCounts{
    Critical: findingCritical, High: findingHigh,
    Medium: findingMedium, Low: findingLow, Info: findingInfo,
})
```

**Estimated:** ~300 LOC

---

### Phase 3: Service Layer — Cached Config + Recalculate

**CRITICAL: Cache tenant scoring config to avoid N+1 DB queries.**

Currently `getScoringConfig()` would call `s.tenantRepo.GetByID()` at every call site. This adds an extra DB query per asset operation.

**Solution: In-memory cache with short TTL.**

```go
// scoringConfigCache caches tenant scoring config to avoid
// repeated DB queries during asset operations.
type scoringConfigCache struct {
    mu      sync.RWMutex
    configs map[string]cachedConfig
}

type cachedConfig struct {
    config    tenant.RiskScoringSettings
    expiresAt time.Time
}

const scoringConfigCacheTTL = 5 * time.Minute

func (c *scoringConfigCache) Get(tenantID string) (*tenant.RiskScoringSettings, bool) {
    c.mu.RLock()
    defer c.mu.RUnlock()
    cached, ok := c.configs[tenantID]
    if !ok || time.Now().After(cached.expiresAt) {
        return nil, false
    }
    cfg := cached.config // copy
    return &cfg, true
}

func (c *scoringConfigCache) Set(tenantID string, config tenant.RiskScoringSettings) {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.configs[tenantID] = cachedConfig{
        config:    config,
        expiresAt: time.Now().Add(scoringConfigCacheTTL),
    }
}

func (c *scoringConfigCache) Invalidate(tenantID string) {
    c.mu.Lock()
    defer c.mu.Unlock()
    delete(c.configs, tenantID)
}
```

**Update `asset_service.go`:**

```go
// Add to AssetService struct
scoringCache *scoringConfigCache

// Helper to get scoring config (cached)
func (s *AssetService) getScoringConfig(ctx context.Context, tenantID shared.ID) *tenant.RiskScoringSettings {
    tid := tenantID.String()

    // Check cache first
    if cfg, ok := s.scoringCache.Get(tid); ok {
        return cfg
    }

    // Cache miss — load from DB
    t, err := s.tenantRepo.GetByID(ctx, tenantID)
    if err != nil {
        return nil // Falls back to legacy defaults in CalculateRiskScore
    }
    cfg := t.TypedSettings().RiskScoring
    s.scoringCache.Set(tid, cfg)
    return &cfg
}

// In CreateAsset, UpdateAsset, etc:
scoringConfig := s.getScoringConfig(ctx, tenantID)
asset.CalculateRiskScore(scoringConfig)
```

**Batch recalculation with concurrency protection:**

```go
// RecalculateAllRiskScores recalculates risk scores for all assets in a tenant.
// Uses distributed lock to prevent concurrent recalculations.
func (s *AssetService) RecalculateAllRiskScores(ctx context.Context, tenantID shared.ID) (int, error) {
    // 1. Acquire distributed lock (prevent concurrent recalculations)
    lockKey := fmt.Sprintf("recalc:scoring:%s", tenantID.String())
    acquired, err := s.redis.SetNX(ctx, lockKey, "1", 10*time.Minute).Result()
    if err != nil || !acquired {
        return 0, fmt.Errorf("%w: recalculation already in progress", shared.ErrConflict)
    }
    defer s.redis.Del(ctx, lockKey)

    // 2. Load scoring config (fresh, not cached)
    s.scoringCache.Invalidate(tenantID.String())
    config := s.getScoringConfig(ctx, tenantID)

    // 3. Count total assets for progress reporting
    totalAssets, err := s.repo.Count(ctx, tenantID, asset.ListFilter{})
    if err != nil { return 0, err }

    // 4. Enforce max limit to prevent DB overload
    const maxAssetsForRecalc = 100000
    if totalAssets > maxAssetsForRecalc {
        return 0, fmt.Errorf("%w: too many assets (%d), max %d for batch recalculation",
            shared.ErrValidation, totalAssets, maxAssetsForRecalc)
    }

    // 5. Batch process
    const batchSize = 500
    page := 1
    totalUpdated := 0

    for {
        assets, err := s.repo.List(ctx, tenantID, asset.ListFilter{
            Page: page, PerPage: batchSize,
        })
        if err != nil { return totalUpdated, err }
        if len(assets.Items) == 0 { break }

        for _, a := range assets.Items {
            a.CalculateRiskScore(config)
        }

        updated, err := s.repo.BatchUpdateRiskScores(ctx, tenantID, assets.Items)
        if err != nil { return totalUpdated, err }
        totalUpdated += updated

        page++
    }

    return totalUpdated, nil
}
```

**Repository batch update:**

```go
// BatchUpdateRiskScores updates risk_score for multiple assets in one query.
func (r *AssetRepository) BatchUpdateRiskScores(ctx context.Context, tenantID shared.ID, assets []*asset.Asset) (int, error) {
    if len(assets) == 0 { return 0, nil }

    query := `
        UPDATE assets SET risk_score = data.score, updated_at = NOW()
        FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::int[]) AS score) AS data
        WHERE assets.id = data.id AND assets.tenant_id = $3
    `
    ids := make([]string, 0, len(assets))
    scores := make([]int, 0, len(assets))
    for _, a := range assets {
        ids = append(ids, a.ID().String())
        scores = append(scores, a.RiskScore())
    }

    result, err := r.db.ExecContext(ctx, query, pq.Array(ids), pq.Array(scores), tenantID.String())
    if err != nil { return 0, err }

    count, _ := result.RowsAffected()
    return int(count), nil
}
```

**Estimated:** ~350 LOC

---

### Phase 4: API Endpoints + Permissions

**New permission** (add to `permission.go`):

```go
// Settings: Risk Scoring (settings:scoring:*)
SettingsScoringRead  Permission = "settings:scoring:read"
SettingsScoringWrite Permission = "settings:scoring:write"
```

**Permission rationale**: Risk scoring changes affect the entire tenant's risk posture. This should be restricted to Owner/Admin by default — not anyone with generic `settings:write`. Add to default role mappings:
- Owner: `settings:scoring:read`, `settings:scoring:write`
- Admin: `settings:scoring:read`, `settings:scoring:write`
- Member: `settings:scoring:read` (view only)
- Viewer: `settings:scoring:read` (view only)

**Migration**: Add permissions to DB seed (new migration file).

**Settings endpoints** (follows existing pattern):

```
GET   /api/v1/settings/risk-scoring                    — Get current config
PATCH /api/v1/settings/risk-scoring                    — Update config (requires settings:scoring:write)
POST  /api/v1/settings/risk-scoring/recalculate        — Trigger batch recalculation
POST  /api/v1/settings/risk-scoring/preview            — Preview impact (POST because body contains proposed config)
GET   /api/v1/settings/risk-scoring/presets             — List all presets
GET   /api/v1/settings/risk-scoring/presets/{industry}  — Get specific preset
```

**Handler implementation:**

```go
// UpdateRiskScoringSettings updates the scoring config.
func (h *TenantHandler) UpdateRiskScoringSettings(w http.ResponseWriter, r *http.Request) {
    // 1. Parse & validate input
    var input RiskScoringSettingsInput
    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
        apierror.BadRequest("invalid request body").WriteJSON(w)
        return
    }

    // 2. Convert to domain type and validate
    settings := input.toDomain()
    if err := settings.Validate(); err != nil {
        apierror.BadRequest(err.Error()).WriteJSON(w)
        return
    }

    // 3. Load current settings, update risk_scoring section
    // 4. Save tenant settings

    // 5. Invalidate scoring config cache
    h.assetService.InvalidateScoringCache(tenantID.String())

    // 6. Audit log the change (with before/after diff)
    h.auditService.Log(ctx, audit.Event{
        Action:     "settings.risk_scoring.updated",
        ResourceID: tenantID.String(),
        Metadata: map[string]any{
            "previous_preset": previousSettings.Preset,
            "new_preset":      settings.Preset,
            "weights_changed": !reflect.DeepEqual(previousSettings.Weights, settings.Weights),
        },
    })

    // 7. Return updated config (DO NOT auto-recalculate — user must preview first)
}
```

**Preview endpoint** (POST, read-only):

```go
func (h *TenantHandler) PreviewRiskScoring(w http.ResponseWriter, r *http.Request) {
    // 1. Parse proposed config from request body
    var proposedConfig tenant.RiskScoringSettings
    // ...

    // 2. Validate proposed config
    if err := proposedConfig.Validate(); err != nil {
        apierror.BadRequest(err.Error()).WriteJSON(w)
        return
    }

    // 3. Load current config
    currentConfig := tenant.TypedSettings().RiskScoring

    // 4. Fetch sample of assets (up to 100, representative sample)
    //    Use stratified sampling: top 20 by score, bottom 20, random 60
    assets, err := h.assetService.GetPreviewSample(ctx, tenantID, 100)

    // 5. Calculate scores with BOTH configs
    currentEngine := asset.NewRiskScoringEngine(currentConfig)
    proposedEngine := asset.NewRiskScoringEngine(proposedConfig)

    results := make([]PreviewResult, 0, len(assets))
    for _, a := range assets {
        currentScore := currentEngine.CalculateScore(a)
        proposedScore := proposedEngine.CalculateScore(a)
        results = append(results, PreviewResult{
            AssetID:       a.ID().String(),
            AssetName:     a.Name(),
            AssetType:     a.AssetType().String(),
            CurrentScore:  currentScore,
            ProposedScore: proposedScore,
            Delta:         proposedScore - currentScore,
        })
    }

    // 6. Compute summary statistics
    summary := PreviewSummary{
        TotalAssets:    totalAssetCount,
        SampledAssets:  len(results),
        AverageCurrent: avgCurrent,
        AverageNew:     avgNew,
        AverageDelta:   avgNew - avgCurrent,
        MaxIncrease:    maxDelta,
        MaxDecrease:    minDelta,
    }

    // 7. Return comparison
    json.NewEncoder(w).Encode(PreviewResponse{
        Summary: summary,
        Assets:  results,
    })
}
```

**Recalculation endpoint** (with rate limiting):

```go
// Rate limit: 1 request per 5 minutes per tenant
func (h *TenantHandler) RecalculateRiskScores(w http.ResponseWriter, r *http.Request) {
    // 1. Check rate limit
    key := fmt.Sprintf("recalc_rate:%s", tenantID.String())
    exists, _ := h.redis.Exists(ctx, key).Result()
    if exists > 0 {
        ttl, _ := h.redis.TTL(ctx, key).Result()
        w.Header().Set("Retry-After", fmt.Sprintf("%d", int(ttl.Seconds())))
        apierror.TooManyRequests("recalculation rate limit exceeded").WriteJSON(w)
        return
    }
    h.redis.Set(ctx, key, "1", 5*time.Minute)

    // 2. Trigger recalculation
    updated, err := h.assetService.RecalculateAllRiskScores(ctx, tenantID)

    // 3. Return result
    json.NewEncoder(w).Encode(RecalculateResponse{
        AssetsUpdated: updated,
        Status:        "completed",
    })
}
```

**Estimated:** ~400 LOC (including migration for permissions)

---

### Phase 5: Frontend — Settings Page

**Rewrite:** `ui/src/app/(dashboard)/settings/scoring/page.tsx`

**New hooks:** `ui/src/features/settings/api/use-risk-scoring-api.ts`

```typescript
// SWR hooks
export function useRiskScoringSettings()           // GET config
export function useUpdateRiskScoring()             // PATCH config
export function useRiskScoringPreview()            // POST preview
export function useRiskScoringPresets()            // GET presets
export function useRecalculateRiskScores()         // POST recalculate
```

**New types:** `ui/src/features/settings/types/risk-scoring.types.ts`

```typescript
interface RiskScoringSettings {
    preset: string
    weights: ComponentWeights
    exposure_scores: ExposureScoreConfig
    exposure_multipliers: ExposureMultiplierConfig
    criticality_scores: CriticalityScoreConfig
    finding_impact: FindingImpactConfig
    ctem_points: CTEMPointsConfig
    risk_levels: RiskLevelConfig
}

interface PreviewResult {
    asset_id: string
    asset_name: string
    asset_type: string
    current_score: number
    proposed_score: number
    delta: number
}

interface PreviewResponse {
    summary: {
        total_assets: number
        sampled_assets: number
        average_current: number
        average_new: number
        average_delta: number
        max_increase: number
        max_decrease: number
    }
    assets: PreviewResult[]
}
```

**UI Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ Scoring Configuration                    [Reset] [Save]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─ Preset ─────────────────────────────────────────────┐    │
│ │ [Legacy] [Default] [Banking] [Healthcare] [Ecommerce]│    │
│ │ [Government] [Custom]                                │    │
│ │                                                      │    │
│ │ [?] Hover tooltip shows preset comparison table      │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                             │
│ ┌─ Component Weights (must sum to 100) ────────────────┐    │
│ │                                                      │    │
│ │ Exposure    ████████████████░░░░  35                  │    │
│ │ Criticality ████████████░░░░░░░░  25                  │    │
│ │ Findings    ██████████████░░░░░░  30                  │    │
│ │ CTEM        ████░░░░░░░░░░░░░░░░  10  (disabled)     │    │
│ │                                                      │    │
│ │ Total: 100 ✓                                         │    │
│ │ ⓘ CTEM weight will be redistributed while disabled   │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                             │
│ ┌─ Exposure Scores ───────────────┐  ┌─ Criticality ──────┐ │
│ │ Public:     [80]                │  │ Critical: [100]    │ │
│ │ Restricted: [50]                │  │ High:     [75]     │ │
│ │ Private:    [30]                │  │ Medium:   [50]     │ │
│ │ Isolated:   [10]                │  │ Low:      [25]     │ │
│ │ Unknown:    [40]                │  │ None:     [0]      │ │
│ └─────────────────────────────────┘  └────────────────────┘ │
│                                                             │
│ ┌─ Finding Impact ─────────────────────────────────────┐    │
│ │ Mode: (●) Severity Weighted  ( ) Simple Count       │    │
│ │                                                      │    │
│ │ Severity Weights:     Cap: [100]                     │    │
│ │ Critical: [20]  High: [10]  Medium: [5]              │    │
│ │ Low: [2]  Info: [1]                                  │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                             │
│ ┌─ CTEM Factors ───────────────────────────────────────┐    │
│ │ [✓] Enable CTEM Risk Factors                        │    │
│ │                                                      │    │
│ │ Internet Accessible: [30] pts                        │    │
│ │ PII Data Exposed:    [20] pts                        │    │
│ │ PHI Data Exposed:    [25] pts                        │    │
│ │ High-Risk Compliance:[15] pts                        │    │
│ │ Restricted/Secret:   [20] pts                        │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                             │
│ ┌─ Risk Level Thresholds ──────────────────────────────┐    │
│ │ ●Critical  ≥[80]  ●High  ≥[60]  ●Medium ≥[40]      │    │
│ │ ●Low       ≥[20]  ●Info   <20                        │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                             │
│ ┌─ Preview Impact ─────────────────────────────────────┐    │
│ │ 100 sample assets (stratified: top, bottom, random)  │    │
│ │                                                      │    │
│ │ Summary:                                             │    │
│ │ Avg: 52 → 58 (+6) | Max ▲ +21 | Max ▼ -12           │    │
│ │                                                      │    │
│ │ Asset          Type    Current → New   Delta          │    │
│ │ api-gateway    api        72  →  85    +13  ▲         │    │
│ │ user-db        database   45  →  62    +17  ▲         │    │
│ │ internal-wiki  website    30  →  22    -8   ▼         │    │
│ │ ...                                                   │    │
│ │                                                      │    │
│ │ [Preview Changes]  [Apply & Recalculate All Assets]  │    │
│ │ ⓘ This will recalculate X assets. Takes ~Y seconds.  │    │
│ └──────────────────────────────────────────────────────┘    │
│                                                             │
│ ┌─ Formula Explanation ──────────────────────────────────┐  │
│ │ Score = (Exposure×35 + Criticality×25 + Findings×30   │  │
│ │        + CTEM×10) / 100 × ExposureMultiplier           │  │
│ │ Clamped to 0-100                                       │  │
│ └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Key UI Improvements (vs v1 plan):**
- "Legacy" preset available — makes it clear current formula is preserved
- CTEM weight shows "(disabled)" and info tooltip about redistribution
- Preview shows asset type column for better context
- Stratified sampling explained: "top, bottom, random"
- Shows estimated recalculation time based on total asset count
- "Preview Changes" button separate from "Apply" — must preview before applying
- Formula explanation shows actual current weights dynamically

**Permission-gated UI:**

```typescript
const { can } = usePermissions()
const canEdit = can('settings:scoring:write')

// All inputs disabled when canEdit is false
// Save/Reset/Apply buttons hidden when canEdit is false
// Preview still available for read-only users
```

**Estimated:** ~900 LOC

---

### Phase 6: Frontend — Risk Level Display Update

Update `getRiskLevel()` to use tenant config instead of hardcoded thresholds.

**File:** `ui/src/features/shared/types/common.types.ts`

```typescript
// Current (hardcoded):
export const getRiskLevel = (score: number) => {
    if (score >= 80) return { label: 'Critical', ... }
    // ...
}

// New (backward compatible — optional thresholds parameter):
export interface RiskLevelConfig {
    critical_min: number
    high_min: number
    medium_min: number
    low_min: number
}

const DEFAULT_RISK_LEVELS: RiskLevelConfig = {
    critical_min: 80,
    high_min: 60,
    medium_min: 40,
    low_min: 20,
}

export const getRiskLevel = (score: number, thresholds?: RiskLevelConfig) => {
    const t = thresholds ?? DEFAULT_RISK_LEVELS
    if (score >= t.critical_min) return { label: 'Critical', color: 'bg-red-500', textColor: 'text-white' }
    if (score >= t.high_min) return { label: 'High', color: 'bg-orange-500', textColor: 'text-white' }
    if (score >= t.medium_min) return { label: 'Medium', color: 'bg-yellow-500', textColor: 'text-black' }
    if (score >= t.low_min) return { label: 'Low', color: 'bg-blue-500', textColor: 'text-white' }
    return { label: 'Info', color: 'bg-green-500', textColor: 'text-white' }
}
```

**Provide thresholds via React Context:**

```typescript
// RiskScoringContext — loads tenant scoring config once, provides to all components
const RiskScoringContext = createContext<{
    thresholds: RiskLevelConfig
    isLoading: boolean
}>({
    thresholds: DEFAULT_RISK_LEVELS,
    isLoading: false,
})

export function RiskScoringProvider({ children }) {
    const { data: settings } = useRiskScoringSettings()
    const thresholds = settings?.risk_levels ?? DEFAULT_RISK_LEVELS

    return (
        <RiskScoringContext.Provider value={{ thresholds, isLoading: !settings }}>
            {children}
        </RiskScoringContext.Provider>
    )
}

export function useRiskThresholds() {
    return useContext(RiskScoringContext)
}
```

**Update components** (`RiskScoreBadge`, `RiskScoreMeter`, `RiskScoreGauge`):

```typescript
function RiskScoreBadge({ score }: { score: number }) {
    const { thresholds } = useRiskThresholds()
    const level = getRiskLevel(score, thresholds)
    // ... render
}
```

**Estimated:** ~150 LOC

---

## Effort Estimation

| Phase | Description | LOC | Complexity |
|-------|-------------|-----|------------|
| 1 | Domain Layer — Settings types, validation, presets, legacy | ~450 | Low |
| 2 | Scoring Engine + Severity counts via LEFT JOIN | ~300 | Medium |
| 3 | Service Layer — Cached config, batch recalculate, lock | ~350 | Medium |
| 4 | API Endpoints — CRUD, preview, presets, permissions | ~400 | Medium |
| 5 | Frontend — Settings page rewrite | ~900 | Medium |
| 6 | Frontend — Risk level context + display update | ~150 | Low |
| **Total** | | **~2,550** | |

---

## Testing Strategy

### Unit Tests

| Phase | Test File | Key Cases |
|-------|-----------|-----------|
| 1 | `risk_scoring_settings_test.go` | Validation (weights sum, bounds, ordering), presets, defaults, legacy |
| 2 | `risk_scoring_test.go` | Score calculation, CTEM redistribution, severity weighted, edge cases |
| 3 | `asset_service_scoring_test.go` | Config caching, batch recalculation, lock contention, fallback |
| 4 | `settings_handler_scoring_test.go` | API CRUD, preview, validation errors, rate limiting |
| 5 | `use-risk-scoring-api.test.ts` | Hook behavior, cache invalidation, permission gating |
| 6 | `risk-score-badge.test.tsx` | Threshold-based rendering |

### Key Test Cases

```go
// === Backward Compatibility ===
// Legacy preset must produce IDENTICAL scores to current hardcoded formula
func TestLegacyPreset_IdenticalToHardcoded(t *testing.T) {
    // Test with various assets: public/critical, isolated/none, etc.
    // Legacy engine score == old CalculateRiskScore() for all cases
}

// Nil config = legacy defaults
func TestCalculateRiskScore_NilConfig_BackwardCompatible(t *testing.T)

// === Validation ===
func TestValidate_WeightsNotSum100_ReturnsError(t *testing.T)
func TestValidate_NegativeWeight_ReturnsError(t *testing.T)
func TestValidate_MultiplierOutOfBounds_ReturnsError(t *testing.T)
func TestValidate_RiskLevelsNotOrdered_ReturnsError(t *testing.T)
func TestValidate_FindingModeInvalid_ReturnsError(t *testing.T)
func TestValidate_SeverityWeightOutOfBounds_ReturnsError(t *testing.T)

// === CTEM Weight Redistribution ===
func TestEffectiveWeights_CTEMDisabled_RedistributesWeight(t *testing.T)
func TestEffectiveWeights_CTEMEnabled_NoRedistribution(t *testing.T)
func TestEffectiveWeights_CTEMZeroWeight_NoChange(t *testing.T)

// === Scoring Engine ===
func TestCalculateScore_CTEMDisabled_ZeroCTEM(t *testing.T)
func TestCalculateScore_AllZeroWeightsExceptOne(t *testing.T)
func TestCalculateScore_MaxScore_ClampedTo100(t *testing.T)
func TestCalculateScore_AllFactorsZero_ScoreIsZero(t *testing.T)
func TestCalculateScore_PublicExposure_MultiplierApplied(t *testing.T)

// === Finding Score ===
func TestFindingScore_SeverityWeighted_CriticalOnly(t *testing.T)
func TestFindingScore_SeverityWeighted_MixedSeverities(t *testing.T)
func TestFindingScore_SeverityWeighted_CapApplied(t *testing.T)
func TestFindingScore_CountBased_FallbackWhenNoSeverityCounts(t *testing.T)
func TestFindingScore_ZeroFindings_ScoreIsZero(t *testing.T)

// === Presets ===
func TestPreset_AllPresetsPassValidation(t *testing.T)
func TestPreset_LegacyPreset_Exists(t *testing.T)
func TestPreset_Unknown_ReturnsFalse(t *testing.T)

// === Service Layer ===
func TestScoringConfigCache_HitsCache(t *testing.T)
func TestScoringConfigCache_ExpiresAfterTTL(t *testing.T)
func TestScoringConfigCache_InvalidateOnUpdate(t *testing.T)
func TestRecalculateAll_AcquiresLock(t *testing.T)
func TestRecalculateAll_ConcurrentRequest_ReturnsConflict(t *testing.T)
func TestRecalculateAll_ExceedsMaxAssets_ReturnsError(t *testing.T)
func TestRecalculateAll_UpdatesAllAssets(t *testing.T)

// === API ===
func TestPreview_ShowsScoreDifferences(t *testing.T)
func TestRecalculate_RateLimited(t *testing.T)
func TestUpdateScoring_InvalidConfig_Returns400(t *testing.T)
func TestUpdateScoring_RequiresPermission(t *testing.T)
func TestUpdateScoring_AuditLogCreated(t *testing.T)
```

---

## Migration Strategy

### Zero-downtime Migration

1. **No DB migration for config** — scoring config stored in existing `tenants.settings` JSONB
2. **No DB migration for severity counts** — computed via extended LEFT JOIN subquery
3. **One small migration** — add `settings:scoring:read` and `settings:scoring:write` permissions to DB
4. **Legacy preset = exact backward compat** — existing tenants see ZERO score change on upgrade
5. **Gradual rollout** — tenants can switch from "legacy" to "default" or industry presets at their own pace

### Legacy Preset Guarantees

The legacy preset is carefully calibrated to produce **identical** scores to the current hardcoded formula:

| Component | Current Hardcoded | Legacy Preset | Result |
|-----------|-------------------|---------------|--------|
| Exposure | `BaseRiskScore()` returns 5-40, max 40 pts | Score 12-100 × 40% = same 5-40 pts | Identical |
| Criticality | `Score()/4` = 0-25, max 25 pts | Score 0-100 × 25% = 0-25 pts | Identical |
| Findings | `count×5, cap 35`, max 35 pts | Mode "count", pts=14, cap=100 × 35% = same range | Identical |
| CTEM | 0 (disabled) | Weight 0, disabled | Identical |
| Multiplier | 0.8-1.5x | 0.8-1.5x | Identical |

A comprehensive test (`TestLegacyPreset_IdenticalToHardcoded`) validates this across all exposure/criticality/finding count combinations.

---

## Security Considerations

1. **Granular permission**: `settings:scoring:write` required (not generic `settings:write`). Owner/Admin only by default.
2. **Strict validation**: All config values validated with bounds (prevent integer overflow, negative scores, score explosion via multipliers).
3. **Audit logging**: Every scoring config change logged with before/after diff, user who made the change, and timestamp.
4. **Rate limiting**: Recalculation endpoint limited to 1 request per 5 minutes per tenant.
5. **Distributed lock**: Only one recalculation can run per tenant at a time (Redis SETNX).
6. **Asset count limit**: Recalculation capped at 100K assets to prevent DB overload.
7. **Preview is read-only**: Preview endpoint computes scores in-memory, no DB writes.
8. **Tenant isolation**: Each tenant's scoring config is independent. Cache keys are tenant-scoped.
9. **No config injection**: All enum values (exposure levels, criticality levels) are validated against known values on the server side. Arbitrary keys are rejected.

---

## Database Query Performance

### Current Pattern (No Issues)
- `finding_count` computed via LEFT JOIN in `selectQuery()` — always included, no extra query.

### Extended LEFT JOIN (Phase 2)
Adding severity breakdown to the existing LEFT JOIN:
- **Query overhead**: Minimal. The `GROUP BY asset_id` already scans the findings table. Adding `SUM(CASE WHEN ...)` columns is almost free compared to the GROUP BY scan.
- **Index usage**: Existing `(tenant_id, asset_id)` index on findings is used.
- **No N+1**: Severity counts are loaded WITH the asset in a single query.

### Config Loading (Phase 3)
- **Problem averted**: Without caching, each of the 6 call sites would add an extra `SELECT * FROM tenants WHERE id = ?` query.
- **Solution**: In-memory cache with 5-minute TTL. First call hits DB, subsequent calls within 5 min hit cache. Cache invalidated on scoring config update.
- **Multi-server safe**: Each server has its own cache. After config update, cache expires within 5 minutes. This is acceptable because scoring config changes are rare and not time-critical.

### Batch Recalculation (Phase 3)
- **Reads**: `List()` with pagination (500 per batch) — uses existing optimized query with severity counts included.
- **Writes**: `BatchUpdateRiskScores()` using `unnest()` — single UPDATE per batch of 500 assets.
- **Total queries for 10K assets**: 20 SELECTs + 20 UPDATEs = 40 queries (not 20K individual updates).
- **Lock protection**: Redis SETNX prevents concurrent recalculations.

### Preview (Phase 4)
- **Single query**: Fetch 100 sample assets with existing `List()`.
- **Zero writes**: All score computation happens in-memory.
- **No additional queries**: Severity counts already included in the SELECT.

---

## Resolved Questions (from v1)

### 1. Finding severity counts storage
**Decision**: Extend the existing LEFT JOIN subquery in `selectQuery()`. No new column, no migration.

Rationale: `finding_count` is already computed this way. Adding 5 more `SUM(CASE WHEN ...)` columns to the same GROUP BY is negligible overhead. The counts are always available when the asset is loaded — no additional queries needed.

### 2. Recalculation trigger
**Decision**: Manual trigger only, after preview. User must click "Preview Changes" before "Apply & Recalculate".

Rationale: Auto-recalculation on every config save is dangerous for large tenants. Preview-first approach prevents surprises.

### 3. Repository extension risk scores
**Decision**: Out of scope for this RFC. Repository extensions use a different scoring formula (visibility, TLS, scan status). Will be addressed in a separate RFC if needed.

### 4. Backward compatibility on upgrade
**Decision**: `DefaultSettings()` returns the "legacy" preset which reproduces the EXACT current formula. Existing tenants see zero score change. They can opt-in to the "default" or industry presets via the UI.

### 5. CTEM weight when CTEM is disabled
**Decision**: Smart redistribution — the engine automatically redistributes CTEM weight proportionally to the other 3 components. UI shows an info message explaining this behavior.

---

## Related Documents

- Current formula: `api/pkg/domain/asset/entity.go:382-406`
- CTEM factors: `api/pkg/domain/asset/entity.go:812-840`
- Exposure scores: `api/pkg/domain/asset/value_objects.go:428-462`
- Finding count subquery: `api/internal/infra/postgres/asset_repository.go:199`
- Tenant settings: `api/pkg/domain/tenant/settings.go`
- Settings API: `api/internal/infra/http/handler/tenant_handler.go`
- Permissions: `api/pkg/domain/permission/permission.go:42-44`
- Frontend scoring page: `ui/src/app/(dashboard)/settings/scoring/page.tsx`
- Frontend risk levels: `ui/src/features/shared/types/common.types.ts:84`
- Risk score components: `ui/src/features/shared/components/risk-score-badge.tsx`
