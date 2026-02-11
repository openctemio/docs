# Ingest Handler Consolidation Plan (Phương án A)

**Created:** 2026-01-27
**Updated:** 2026-01-28
**Status:** IMPLEMENTED ✅
**Author:** Claude Code
**Related:** 2026-01-27-ctem-framework-enhancement.md

---

## Executive Summary

~~Hiện tại hệ thống có **3 format ingestion khác nhau** với 2 handler riêng biệt, gây ra code duplication và maintenance burden.~~

**IMPLEMENTED:** Hệ thống đã được consolidate thành công:
- ✅ Unified `ingest.Service` thay thế `IngestService` và `CTISIngestService`
- ✅ Unified `IngestHandler` thay thế `IngestHandler` và `CTISIngestHandler`
- ✅ Legacy endpoint đã bị xóa hoàn toàn (không còn backward compatibility)
- ✅ 3 format được support: CTIS (native), SARIF, Recon
- ✅ Package structure: `api/internal/app/ingest/`

---

## Current State Analysis

### Handlers Hiện Tại

| Handler | File | Methods | Format |
|---------|------|---------|--------|
| `IngestHandler` | `ingest_handler.go` | `Ingest()`, `IngestSARIF()`, `CheckFingerprints()`, `Heartbeat()` | Legacy custom |
| `CTISIngestHandler` | `ctis_ingest_handler.go` | `IngestCTIS()`, `IngestReconReport()` | CTIS (CTEM Ingest Schema) |

### Services Hiện Tại

| Service | File | Purpose |
|---------|------|---------|
| `IngestService` | `ingest_service.go` | Legacy format processing |
| `CTISIngestService` | `ctis_ingest_service.go` | CTIS format processing |

### Endpoints Hiện Tại (After Implementation)

```
/api/v1/agent/ingest/ctis    → IngestHandler.IngestCTIS()      [PRIMARY]
/api/v1/agent/ingest/sarif  → IngestHandler.IngestSARIF()    [SARIF]
/api/v1/agent/ingest/recon  → IngestHandler.IngestReconReport()
/api/v1/agent/ingest/check  → IngestHandler.CheckFingerprints()
/api/v1/agent/heartbeat     → IngestHandler.Heartbeat()

# REMOVED:
# /api/v1/agent/ingest       → DELETED (legacy format no longer supported)
```

### Vấn Đề

1. **Code Duplication**: 2 services làm cùng công việc với logic tương tự
2. **Inconsistent API**: 3 format khác nhau cho cùng mục đích
3. **Maintenance Burden**: Phải cập nhật cả 2 nơi khi thêm feature
4. **Confused SDK Integration**: SDK phải support nhiều format

---

## Target State (Phương án A)

### Unified Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     UnifiedIngestHandler                         │
├─────────────────────────────────────────────────────────────────┤
│  /api/v1/agent/ingest/ctis      → IngestCTIS()      [PRIMARY]     │
│  /api/v1/agent/ingest/recon    → IngestRecon()                  │
│  /api/v1/agent/ingest/sarif    → IngestSARIF()                  │
│  /api/v1/agent/ingest/check    → CheckFingerprints()            │
│  /api/v1/agent/ingest          → IngestLegacy()   [DEPRECATED]  │
│  /api/v1/agent/heartbeat       → Heartbeat()                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     UnifiedIngestService                         │
├─────────────────────────────────────────────────────────────────┤
│  IngestCTIS()           - Primary ingestion method                │
│  IngestSARIF()         - SARIF → CTIS conversion → IngestCTIS()   │
│  IngestLegacy()        - Legacy → CTIS conversion → IngestCTIS()  │
│  CheckFingerprints()   - Deduplication check                    │
│  UpdateHeartbeat()     - Agent health                           │
└─────────────────────────────────────────────────────────────────┘
```

### Endpoint Strategy

| Endpoint | Status | Action |
|----------|:------:|--------|
| `/api/v1/agent/ingest/ctis` | PRIMARY | Promoted as the standard |
| `/api/v1/agent/ingest/recon` | KEEP | Convenience wrapper |
| `/api/v1/agent/ingest/sarif` | KEEP | Industry standard support |
| `/api/v1/agent/ingest/check` | KEEP | Deduplication essential |
| `/api/v1/agent/ingest` | DEPRECATED | Convert to CTIS internally |
| `/api/v1/agent/heartbeat` | KEEP | Essential for agent health |

---

## Implementation Phases

### Phase 1: Preparation (Week 1)
**Goal:** Prepare codebase without breaking changes

#### 1.1 Create Format Converters

```go
// api/internal/app/ingest_converter.go

package app

import (
    "github.com/openctemio/sdk-go/pkg/ctis"
)

// LegacyToCTISConverter converts legacy IngestInput to CTIS Report
type LegacyToCTISConverter struct{}

// Convert transforms legacy format to CTIS format
func (c *LegacyToCTISConverter) Convert(input IngestInput) (*ctis.Report, error) {
    report := &ctis.Report{
        Version: input.Version,
        Metadata: ctis.ReportMetadata{
            ID:          input.Metadata.ScanID,
            SourceType:  "scanner",
            SourceTool:  input.Metadata.ToolName,
            ToolVersion: input.Metadata.ToolVersion,
            StartedAt:   input.Metadata.StartTime.Unix(),
            FinishedAt:  input.Metadata.EndTime.Unix(),
        },
    }

    // Convert targets to assets
    for i, target := range input.Targets {
        risAsset := c.convertTarget(target, i)
        report.Assets = append(report.Assets, risAsset)
    }

    // Convert findings
    for _, finding := range input.Findings {
        risFinding := c.convertFinding(finding)
        report.Findings = append(report.Findings, risFinding)
    }

    return report, nil
}

// convertTarget converts IngestTarget to CTIS Asset
func (c *LegacyToCTISConverter) convertTarget(target IngestTarget, index int) ctis.Asset {
    return ctis.Asset{
        ID:          target.Identifier,
        Type:        c.mapAssetType(target.Type),
        Identifier:  target.Identifier,
        Name:        target.Name,
        Description: target.Description,
        Properties:  target.Metadata,
    }
}

// convertFinding converts IngestFinding to CTIS Finding
func (c *LegacyToCTISConverter) convertFinding(f IngestFinding) ctis.Finding {
    finding := ctis.Finding{
        ID:          f.Fingerprint,
        RuleID:      f.RuleID,
        Title:       f.Title,
        Description: f.Message,
        Severity:    f.Severity,
        Fingerprint: f.Fingerprint,
    }

    // Map code location
    if f.FilePath != "" {
        finding.Location = &ctis.Location{
            File:        f.FilePath,
            StartLine:   f.StartLine,
            EndLine:     f.EndLine,
            StartColumn: f.StartColumn,
            EndColumn:   f.EndColumn,
            Snippet:     f.Snippet,
        }
    }

    // Map CVE/CWE
    if f.CVEID != "" {
        finding.Identifiers = append(finding.Identifiers, ctis.Identifier{
            Type:  "cve",
            Value: f.CVEID,
        })
    }
    for _, cwe := range f.CWEIDs {
        finding.Identifiers = append(finding.Identifiers, ctis.Identifier{
            Type:  "cwe",
            Value: cwe,
        })
    }

    // Map CVSS
    if f.CVSSScore != nil {
        finding.CVSS = &ctis.CVSS{
            Score:  *f.CVSSScore,
            Vector: f.CVSSVector,
            Source: f.CVSSSource,
        }
    }

    // Map remediation
    if f.Recommendation != "" {
        finding.Remediation = &ctis.Remediation{
            Recommendation: f.Recommendation,
            References:     f.References,
        }
    }

    return finding
}

// mapAssetType maps legacy type to CTIS asset type
func (c *LegacyToCTISConverter) mapAssetType(legacyType string) string {
    typeMap := map[string]string{
        "repository": "repository",
        "web":        "web_application",
        "host":       "host",
        "container":  "container",
        "domain":     "domain",
        "ip":         "ip_address",
    }
    if mapped, ok := typeMap[legacyType]; ok {
        return mapped
    }
    return legacyType
}
```

#### 1.2 Create SARIF Converter

```go
// api/internal/app/sarif_converter.go

package app

import (
    "github.com/openctemio/sdk-go/pkg/ctis"
)

// SARIFToCTISConverter converts SARIF to CTIS format
type SARIFToCTISConverter struct{}

// Convert transforms SARIF log to CTIS Report
func (c *SARIFToCTISConverter) Convert(sarif *SARIFLog, opts SARIFProcessorOptions) (*ctis.Report, error) {
    report := &ctis.Report{
        Version: "1.0",
        Metadata: ctis.ReportMetadata{
            SourceType: "sarif",
        },
    }

    // Process each run in SARIF
    for _, run := range sarif.Runs {
        // Extract tool info
        if run.Tool.Driver.Name != "" {
            report.Metadata.SourceTool = run.Tool.Driver.Name
            report.Metadata.ToolVersion = run.Tool.Driver.Version
        }

        // Convert results to findings
        for _, result := range run.Results {
            finding := c.convertResult(result, run.Tool.Driver)
            report.Findings = append(report.Findings, finding)
        }

        // Extract artifacts as assets if needed
        for _, artifact := range run.Artifacts {
            asset := c.convertArtifact(artifact)
            report.Assets = append(report.Assets, asset)
        }
    }

    return report, nil
}

// convertResult converts SARIF Result to CTIS Finding
func (c *SARIFToCTISConverter) convertResult(r SARIFResult, driver SARIFToolDriver) ctis.Finding {
    finding := ctis.Finding{
        RuleID:      r.RuleID,
        Title:       r.Message.Text,
        Description: r.Message.Text,
        Severity:    c.mapLevel(r.Level),
    }

    // Get rule info from driver
    for _, rule := range driver.Rules {
        if rule.ID == r.RuleID {
            if rule.Name != "" {
                finding.Title = rule.Name
            }
            if rule.ShortDescription.Text != "" {
                finding.Description = rule.ShortDescription.Text
            }
            break
        }
    }

    // Map locations
    if len(r.Locations) > 0 {
        loc := r.Locations[0]
        finding.Location = &ctis.Location{
            File:      loc.PhysicalLocation.ArtifactLocation.URI,
            StartLine: loc.PhysicalLocation.Region.StartLine,
            EndLine:   loc.PhysicalLocation.Region.EndLine,
        }
    }

    return finding
}

// mapLevel maps SARIF level to CTIS severity
func (c *SARIFToCTISConverter) mapLevel(level string) string {
    switch level {
    case "error":
        return "high"
    case "warning":
        return "medium"
    case "note":
        return "low"
    default:
        return "info"
    }
}

// convertArtifact converts SARIF Artifact to CTIS Asset
func (c *SARIFToCTISConverter) convertArtifact(a SARIFArtifact) ctis.Asset {
    return ctis.Asset{
        Type:       "file",
        Identifier: a.Location.URI,
        Name:       a.Location.URI,
    }
}
```

#### 1.3 Files to Create

| File | Purpose |
|------|---------|
| `api/internal/app/ingest_converter.go` | Legacy → CTIS converter |
| `api/internal/app/sarif_converter.go` | SARIF → CTIS converter |
| `api/internal/app/ingest_converter_test.go` | Converter unit tests |
| `api/internal/app/sarif_converter_test.go` | SARIF converter tests |

---

### Phase 2: Service Consolidation (Week 2)
**Goal:** Merge services, keep backward compatibility

#### 2.1 Update CTISIngestService

```go
// api/internal/app/ctis_ingest_service.go - ADDITIONS

// IngestLegacy processes legacy format by converting to CTIS
func (s *CTISIngestService) IngestLegacy(ctx context.Context, agt *agent.Agent, input IngestInput) (*CTISIngestOutput, error) {
    // Convert legacy to CTIS
    converter := &LegacyToCTISConverter{}
    report, err := converter.Convert(input)
    if err != nil {
        return nil, shared.NewDomainError("CONVERSION_ERROR", "failed to convert legacy format: "+err.Error(), nil)
    }

    // Process as CTIS
    return s.IngestCTIS(ctx, agt, CTISIngestInput{Report: report})
}

// IngestSARIFReport processes SARIF format by converting to CTIS
func (s *CTISIngestService) IngestSARIFReport(ctx context.Context, agt *agent.Agent, sarif *SARIFLog, opts SARIFProcessorOptions) (*CTISIngestOutput, error) {
    // Convert SARIF to CTIS
    converter := &SARIFToCTISConverter{}
    report, err := converter.Convert(sarif, opts)
    if err != nil {
        return nil, shared.NewDomainError("CONVERSION_ERROR", "failed to convert SARIF format: "+err.Error(), nil)
    }

    // Process as CTIS
    return s.IngestCTIS(ctx, agt, CTISIngestInput{Report: report})
}

// CheckFingerprints checks fingerprint existence for deduplication
// Moved from IngestService to unified service
func (s *CTISIngestService) CheckFingerprints(ctx context.Context, agt *agent.Agent, input CheckFingerprintsInput) (*CheckFingerprintsOutput, error) {
    // Validate agent context
    if err := s.validateAgent(agt); err != nil {
        return nil, err
    }
    tenantID := *agt.TenantID

    if len(input.Fingerprints) == 0 {
        return &CheckFingerprintsOutput{
            Existing: []string{},
            Missing:  []string{},
        }, nil
    }

    // Check against finding repository
    existing, err := s.findingRepo.CheckFingerprints(ctx, tenantID, input.Fingerprints)
    if err != nil {
        return nil, fmt.Errorf("failed to check fingerprints: %w", err)
    }

    // Calculate missing
    existingSet := make(map[string]bool)
    for _, fp := range existing {
        existingSet[fp] = true
    }

    var missing []string
    for _, fp := range input.Fingerprints {
        if !existingSet[fp] {
            missing = append(missing, fp)
        }
    }

    return &CheckFingerprintsOutput{
        Existing: existing,
        Missing:  missing,
    }, nil
}
```

#### 2.2 Update Handler

```go
// api/internal/infra/http/handler/unified_ingest_handler.go - NEW FILE

package handler

import (
    "encoding/json"
    "errors"
    "net/http"
    "strings"

    "github.com/openctemio/api/internal/app"
    "github.com/openctemio/api/pkg/apierror"
    "github.com/openctemio/api/pkg/logger"
)

// UnifiedIngestHandler handles all ingestion HTTP requests.
// This handler consolidates IngestHandler and CTISIngestHandler.
type UnifiedIngestHandler struct {
    ingestService *app.CTISIngestService  // Unified service
    agentService  *app.AgentService
    logger        *logger.Logger
}

// NewUnifiedIngestHandler creates a new unified ingest handler.
func NewUnifiedIngestHandler(
    ingestSvc *app.CTISIngestService,
    agentSvc *app.AgentService,
    log *logger.Logger,
) *UnifiedIngestHandler {
    return &UnifiedIngestHandler{
        ingestService: ingestSvc,
        agentService:  agentSvc,
        logger:        log,
    }
}

// IngestCTIS handles POST /api/v1/agent/ingest/ctis [PRIMARY]
func (h *UnifiedIngestHandler) IngestCTIS(w http.ResponseWriter, r *http.Request) {
    agt := AgentFromContext(r.Context())
    if agt == nil {
        apierror.Unauthorized("Agent authentication required").WriteJSON(w)
        return
    }

    var req struct {
        Report ctis.Report `json:"report"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        apierror.BadRequest("Invalid JSON request body").WriteJSON(w)
        return
    }

    output, err := h.ingestService.IngestCTIS(r.Context(), agt, app.CTISIngestInput{
        Report: &req.Report,
    })
    if err != nil {
        h.handleError(w, err, agt.ID.String())
        return
    }

    h.writeResponse(w, output)
}

// IngestLegacy handles POST /api/v1/agent/ingest [DEPRECATED]
// This endpoint is deprecated. Use /api/v1/agent/ingest/ctis instead.
func (h *UnifiedIngestHandler) IngestLegacy(w http.ResponseWriter, r *http.Request) {
    agt := AgentFromContext(r.Context())
    if agt == nil {
        apierror.Unauthorized("Agent not authenticated").WriteJSON(w)
        return
    }

    // Log deprecation warning
    h.logger.Warn("deprecated endpoint called",
        "endpoint", "/api/v1/agent/ingest",
        "agent_id", agt.ID.String(),
        "recommendation", "migrate to /api/v1/agent/ingest/ctis",
    )

    // Add deprecation header
    w.Header().Set("Deprecation", "true")
    w.Header().Set("X-Deprecation-Notice", "This endpoint is deprecated. Use /api/v1/agent/ingest/ctis instead.")

    var req app.IngestInput
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        apierror.BadRequest("Invalid request body").WriteJSON(w)
        return
    }

    // Convert and process
    output, err := h.ingestService.IngestLegacy(r.Context(), agt, req)
    if err != nil {
        h.handleError(w, err, agt.ID.String())
        return
    }

    h.writeResponse(w, output)
}

// IngestSARIF handles POST /api/v1/agent/ingest/sarif
func (h *UnifiedIngestHandler) IngestSARIF(w http.ResponseWriter, r *http.Request) {
    agt := AgentFromContext(r.Context())
    if agt == nil {
        apierror.Unauthorized("Agent not authenticated").WriteJSON(w)
        return
    }

    var req struct {
        SARIF   *app.SARIFLog             `json:"sarif"`
        Options app.SARIFProcessorOptions `json:"options,omitempty"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        apierror.BadRequest("Invalid request body").WriteJSON(w)
        return
    }

    if req.SARIF == nil {
        apierror.BadRequest("SARIF data is required").WriteJSON(w)
        return
    }

    output, err := h.ingestService.IngestSARIFReport(r.Context(), agt, req.SARIF, req.Options)
    if err != nil {
        h.handleError(w, err, agt.ID.String())
        return
    }

    h.writeResponse(w, output)
}

// IngestRecon handles POST /api/v1/agent/ingest/recon
func (h *UnifiedIngestHandler) IngestRecon(w http.ResponseWriter, r *http.Request) {
    // Delegate to existing CTIS handler logic
    // (reuse buildReconToCTISInput from ctis_ingest_handler.go)
}

// CheckFingerprints handles POST /api/v1/agent/ingest/check
func (h *UnifiedIngestHandler) CheckFingerprints(w http.ResponseWriter, r *http.Request) {
    agt := AgentFromContext(r.Context())
    if agt == nil {
        apierror.Unauthorized("Agent not authenticated").WriteJSON(w)
        return
    }

    var req app.CheckFingerprintsInput
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        apierror.BadRequest("Invalid request body").WriteJSON(w)
        return
    }

    output, err := h.ingestService.CheckFingerprints(r.Context(), agt, req)
    if err != nil {
        h.handleError(w, err, agt.ID.String())
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(output)
}

// Heartbeat handles POST /api/v1/agent/heartbeat
func (h *UnifiedIngestHandler) Heartbeat(w http.ResponseWriter, r *http.Request) {
    agt := AgentFromContext(r.Context())
    if agt == nil {
        apierror.Unauthorized("Agent not authenticated").WriteJSON(w)
        return
    }

    var req HeartbeatRequest
    if r.ContentLength > 0 {
        json.NewDecoder(r.Body).Decode(&req)
    }

    if err := h.agentService.UpdateHeartbeat(r.Context(), agt.ID, app.AgentHeartbeatData{
        Version:       req.Version,
        Hostname:      req.Hostname,
        CPUPercent:    req.CPUPercent,
        MemoryPercent: req.MemoryPercent,
        CurrentJobs:   req.ActiveJobs,
        Region:        req.Region,
    }); err != nil {
        h.logger.Error("failed to update heartbeat", "error", err)
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]interface{}{
        "status":    "ok",
        "agent_id":  agt.ID.String(),
        "tenant_id": agt.TenantID.String(),
    })
}

// AuthenticateSource middleware for API key authentication
func (h *UnifiedIngestHandler) AuthenticateSource(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        apiKey := extractAPIKey(r)
        if apiKey == "" {
            apierror.Unauthorized("API key required").WriteJSON(w)
            return
        }

        agt, err := h.agentService.AuthenticateByAPIKey(r.Context(), apiKey)
        if err != nil {
            apierror.Unauthorized("Invalid API key").WriteJSON(w)
            return
        }

        ctx := context.WithValue(r.Context(), agentContextKey, agt)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

// Helper methods
func (h *UnifiedIngestHandler) handleError(w http.ResponseWriter, err error, agentID string) {
    // Error handling logic...
}

func (h *UnifiedIngestHandler) writeResponse(w http.ResponseWriter, output *app.CTISIngestOutput) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(output)
}
```

---

### Phase 3: Route Migration (Week 3)
**Goal:** Update routes, add deprecation notices

#### 3.1 Update Routes

```go
// api/internal/infra/http/routes/scanning.go - MODIFY

func registerAgentRoutes(
    router Router,
    unifiedHandler *handler.UnifiedIngestHandler,  // NEW: unified handler
    // ingestHandler *handler.IngestHandler,        // DEPRECATED
    // risIngestHandler *handler.CTISIngestHandler,  // DEPRECATED
    commandHandler *handler.CommandHandler,
    scanSessionHandler *handler.ScanSessionHandler,
    licensingService *app.LicensingService,
) {
    // ...middleware setup...

    router.Group("/api/v1/agent", func(r Router) {
        // Heartbeat - NO module gating
        r.POST("/heartbeat", unifiedHandler.Heartbeat)

        // Primary CTIS ingestion
        r.POST("/ingest/ctis", unifiedHandler.IngestCTIS, scansModuleMiddleware)
        r.POST("/ingest/recon", unifiedHandler.IngestRecon, scansModuleMiddleware)
        r.POST("/ingest/sarif", unifiedHandler.IngestSARIF, scansModuleMiddleware)
        r.POST("/ingest/check", unifiedHandler.CheckFingerprints, scansModuleMiddleware)

        // DEPRECATED: Legacy endpoint (redirects to CTIS internally)
        r.POST("/ingest", unifiedHandler.IngestLegacy, scansModuleMiddleware)

        // Commands...
    }, baseMiddleware)
}
```

#### 3.2 Update DI/Handlers Setup

```go
// api/cmd/server/handlers.go - MODIFY

func setupHandlers(deps *Dependencies) *Handlers {
    // Create unified ingest service
    unifiedIngestService := app.NewCTISIngestService(
        deps.AssetRepo,
        deps.FindingRepo,
        deps.ComponentRepo,
        deps.AgentRepo,
        deps.Logger,
    )

    // Create unified handler
    unifiedIngestHandler := handler.NewUnifiedIngestHandler(
        unifiedIngestService,
        deps.AgentService,
        deps.Logger,
    )

    return &Handlers{
        UnifiedIngest: unifiedIngestHandler,
        // IngestHandler: nil,      // DEPRECATED
        // CTISIngestHandler: nil,   // DEPRECATED
        // ...
    }
}
```

---

### Phase 4: Cleanup & Documentation (Week 4)
**Goal:** Remove deprecated code, update documentation

#### 4.1 Files to Delete

| File | Reason |
|------|--------|
| `api/internal/infra/http/handler/ingest_handler.go` | Replaced by unified handler |
| `api/internal/infra/http/handler/ctis_ingest_handler.go` | Merged into unified handler |
| `api/internal/app/ingest_service.go` | Merged into CTIS ingest service |

#### 4.2 Files to Rename/Update

| Old Name | New Name |
|----------|----------|
| `ctis_ingest_service.go` | `ingest_service.go` (or keep as is) |
| `ctis_ingest_handler.go` | `ingest_handler.go` (becomes unified) |

#### 4.3 SDK Updates

```go
// sdk/pkg/client/ingest.go - UPDATE

// IngestReport sends a CTIS report to the server (primary method)
func (c *Client) IngestReport(ctx context.Context, report *ctis.Report) (*IngestResult, error) {
    return c.post(ctx, "/api/v1/agent/ingest/ctis", report)
}

// IngestLegacy sends legacy format (deprecated, use IngestReport)
// Deprecated: Use IngestReport instead
func (c *Client) IngestLegacy(ctx context.Context, input LegacyInput) (*IngestResult, error) {
    return c.post(ctx, "/api/v1/agent/ingest", input)
}
```

#### 4.4 Documentation Updates

1. Update API documentation to mark `/api/v1/agent/ingest` as deprecated
2. Add migration guide for SDK users
3. Update CHANGELOG

---

## Migration Guide

### For SDK Users

**Before (Legacy):**
```go
client.Ingest(ctx, IngestInput{
    Version: "1.0",
    Metadata: IngestMetadata{
        ToolName: "semgrep",
        ScanID:   "scan-123",
    },
    Findings: []IngestFinding{...},
})
```

**After (CTIS):**
```go
client.IngestReport(ctx, &ctis.Report{
    Version: "1.0",
    Metadata: ctis.ReportMetadata{
        SourceType: "scanner",
        SourceTool: "semgrep",
        ID:         "scan-123",
    },
    Findings: []ctis.Finding{...},
})
```

### Deprecation Timeline

| Phase | Date | Action |
|-------|------|--------|
| Phase 1 | Week 1 | Add deprecation headers to legacy endpoint |
| Phase 2 | Week 4 | Log warnings for legacy usage |
| Phase 3 | +3 months | Remove legacy endpoint support |

---

## Testing Strategy

### Unit Tests

1. `ingest_converter_test.go` - Test legacy → CTIS conversion
2. `sarif_converter_test.go` - Test SARIF → CTIS conversion
3. `unified_ingest_handler_test.go` - Test all endpoints

### Integration Tests

1. Test legacy endpoint still works (backward compatibility)
2. Test CTIS endpoint with all asset/finding types
3. Test SARIF endpoint with various SARIF versions
4. Test deprecation headers are returned

### Load Tests

1. Compare performance before/after consolidation
2. Verify no regression in throughput

---

## Success Metrics

| Metric | Current | Target |
|--------|:-------:|:------:|
| Handler files | 2 | 1 |
| Service files | 2 | 1 |
| API endpoints | 6 | 6 (same, but unified) |
| Code duplication | ~40% | <5% |
| Maintenance effort | 2x | 1x |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|:------:|------------|
| Breaking existing SDK integrations | High | Keep legacy endpoint working for 3 months |
| Conversion errors | Medium | Comprehensive test suite, logging |
| Performance regression | Medium | Load testing before rollout |

---

## Implementation Checklist

### Week 1: Preparation
- [ ] Create `ingest_converter.go`
- [ ] Create `sarif_converter.go`
- [ ] Write converter unit tests
- [ ] Review and test converters

### Week 2: Service Consolidation
- [ ] Add `IngestLegacy()` to CTISIngestService
- [ ] Add `IngestSARIFReport()` to CTISIngestService
- [ ] Move `CheckFingerprints()` to CTISIngestService
- [ ] Write service integration tests

### Week 3: Route Migration
- [ ] Create `UnifiedIngestHandler`
- [ ] Update route registration
- [ ] Update DI setup
- [ ] Add deprecation headers
- [ ] Test all endpoints

### Week 4: Cleanup & Documentation
- [ ] Mark old files as deprecated
- [ ] Update SDK client
- [ ] Update API documentation
- [ ] Update CHANGELOG
- [ ] Final testing

---

## Appendix: File Changes Summary

### New Files
- `api/internal/app/ingest_converter.go`
- `api/internal/app/sarif_converter.go`
- `api/internal/infra/http/handler/unified_ingest_handler.go`

### Modified Files
- `api/internal/app/ctis_ingest_service.go` - Add legacy/SARIF methods
- `api/internal/infra/http/routes/scanning.go` - Update route registration
- `api/cmd/server/handlers.go` - Update DI setup

### Deprecated/To Delete (after migration period)
- `api/internal/app/ingest_service.go`
- `api/internal/infra/http/handler/ingest_handler.go`
- `api/internal/infra/http/handler/ctis_ingest_handler.go`

---

**Next Steps:**
1. Review and approve this plan
2. Create detailed tickets for each week
3. Begin Phase 1 implementation
