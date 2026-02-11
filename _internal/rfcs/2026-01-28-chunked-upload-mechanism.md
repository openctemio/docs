# Chunked Upload Mechanism for Large Scan Outputs

**Status:** 📋 Planning
**Created:** 2026-01-28
**Related:** [SDK Retry Queue RFC](./2026-01-18-sdk-retry-queue.md)

---

## Executive Summary

This RFC proposes a **chunked upload mechanism** for handling large scan outputs in the OpenCTEM SDK. When security tools generate thousands of findings, uploading everything in a single request causes:
- Server congestion and timeouts
- Memory pressure on both client and server
- Network instability in constrained environments

The solution splits large reports into smaller chunks, stores them in a local SQLite database, and uploads them gradually with rate limiting.

---

## Problem Statement

**Current Behavior:**
- Tools like Semgrep, Nuclei can generate 10,000+ findings per scan
- Entire report is uploaded in a single POST request to `/api/v1/agent/ingest`
- Large payloads (50MB+) cause:
  - HTTP timeouts (typical 30s limit)
  - Server memory spikes (parsing large JSON)
  - Network failures in CI/CD environments
  - Request body size limits (nginx default: 1MB)

**Real-world Scenario:**
```
Semgrep scan on large monorepo:
- 15,000 findings
- JSON size: ~80MB uncompressed
- Upload time: 45+ seconds
- Failure rate: ~30% due to timeouts
```

**Impact:**
- Lost scan data when uploads fail
- Degraded server performance during large uploads
- Poor user experience in CI/CD pipelines
- Memory exhaustion on resource-constrained agents

---

## Proposed Solution

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CHUNKED UPLOAD FLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                                               │
│  │   Scanner    │  Generates large CTIS Report                   │
│  │  (Semgrep)   │  (15,000 findings, 500 assets)                │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     ChunkManager                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │ Analyze     │─▶│ Split into  │─▶│ Store Chunks    │   │   │
│  │  │ Report Size │  │ Chunks      │  │ in SQLite       │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│         │                                                        │
│         │ Returns immediately (async upload)                     │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    ChunkUploader                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │ Read Pending│─▶│ Upload with │─▶│ Mark Completed  │   │   │
│  │  │ Chunks      │  │ Rate Limit  │  │ & Cleanup       │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  │                                                           │   │
│  │  Features:                                                │   │
│  │  - Concurrent uploads (configurable)                      │   │
│  │  - Retry on failure with exponential backoff              │   │
│  │  - Progress tracking & resumption                         │   │
│  │  - Automatic cleanup after success                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   OpenCTEM API Server                      │   │
│  │                                                           │   │
│  │  POST /api/v1/agent/ingest/chunk                         │   │
│  │  {                                                        │   │
│  │    "report_id": "uuid",                                   │   │
│  │    "chunk_index": 0,                                      │   │
│  │    "total_chunks": 30,                                    │   │
│  │    "data": { /* partial report */ }                       │   │
│  │  }                                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Design

### 1. Chunk Configuration

```go
// pkg/chunk/config.go

package chunk

import "time"

// Config defines chunking behavior.
type Config struct {
    // Chunking thresholds
    MinFindingsForChunking int // Minimum findings to trigger chunking (default: 500)
    MinAssetsForChunking   int // Minimum assets to trigger chunking (default: 100)

    // Chunk size limits
    MaxFindingsPerChunk    int // Max findings per chunk (default: 500)
    MaxAssetsPerChunk      int // Max assets per chunk (default: 100)
    MaxChunkSizeBytes      int // Max uncompressed size per chunk (default: 2MB)

    // Upload behavior
    UploadDelayMs          int           // Delay between chunk uploads (default: 100ms)
    MaxConcurrentUploads   int           // Max concurrent upload workers (default: 2)
    UploadTimeoutSeconds   int           // Timeout per chunk upload (default: 30s)

    // Retry configuration
    MaxRetries             int           // Max retries per chunk (default: 3)
    RetryBackoffMs         int           // Initial backoff between retries (default: 1000ms)

    // Storage configuration
    DatabasePath           string        // SQLite database path (default: ~/.openctem/chunks.db)
    RetentionHours         int           // How long to keep completed chunks (default: 24h)
    MaxStorageMB           int           // Max storage for chunk DB (default: 500MB)

    // Compression
    EnableCompression      bool          // Compress chunks before storing (default: true)
    CompressionLevel       int           // gzip level 1-9 (default: 6)
}

// DefaultConfig returns sensible defaults for most environments.
func DefaultConfig() *Config {
    return &Config{
        MinFindingsForChunking: 500,
        MinAssetsForChunking:   100,
        MaxFindingsPerChunk:    500,
        MaxAssetsPerChunk:      100,
        MaxChunkSizeBytes:      2 * 1024 * 1024, // 2MB
        UploadDelayMs:          100,
        MaxConcurrentUploads:   2,
        UploadTimeoutSeconds:   30,
        MaxRetries:             3,
        RetryBackoffMs:         1000,
        DatabasePath:           "", // Set to default in init
        RetentionHours:         24,
        MaxStorageMB:           500,
        EnableCompression:      true,
        CompressionLevel:       6,
    }
}
```

### 2. SQLite Database Schema

```sql
-- Database: ~/.openctem/chunks.db

-- Reports table: tracks overall report status
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,                    -- Report UUID
    original_findings_count INTEGER NOT NULL,
    original_assets_count INTEGER NOT NULL,
    total_chunks INTEGER NOT NULL,
    completed_chunks INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',          -- pending, uploading, completed, failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    metadata TEXT                           -- JSON: tool info, scan metadata
);

-- Chunks table: individual chunk data
CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,                    -- Chunk UUID
    report_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    data BLOB NOT NULL,                     -- gzip compressed JSON
    uncompressed_size INTEGER NOT NULL,
    compressed_size INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',          -- pending, uploading, completed, failed
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_at TIMESTAMP,
    UNIQUE(report_id, chunk_index),
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_chunks_status ON chunks(status);
CREATE INDEX IF NOT EXISTS idx_chunks_report_id ON chunks(report_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
```

### 3. Core Types

```go
// pkg/chunk/types.go

package chunk

import (
    "time"
    "github.com/openctemio/sdk-go/pkg/ctis"
)

// Report represents a chunked report in the database.
type Report struct {
    ID                    string       `json:"id"`
    OriginalFindingsCount int          `json:"original_findings_count"`
    OriginalAssetsCount   int          `json:"original_assets_count"`
    TotalChunks           int          `json:"total_chunks"`
    CompletedChunks       int          `json:"completed_chunks"`
    Status                ReportStatus `json:"status"`
    CreatedAt             time.Time    `json:"created_at"`
    UpdatedAt             time.Time    `json:"updated_at"`
    CompletedAt           *time.Time   `json:"completed_at,omitempty"`
    Metadata              *Metadata    `json:"metadata,omitempty"`
}

// Chunk represents a single chunk of a report.
type Chunk struct {
    ID               string      `json:"id"`
    ReportID         string      `json:"report_id"`
    ChunkIndex       int         `json:"chunk_index"`
    Data             []byte      `json:"-"`              // Compressed data (not in JSON)
    UncompressedSize int         `json:"uncompressed_size"`
    CompressedSize   int         `json:"compressed_size"`
    Status           ChunkStatus `json:"status"`
    RetryCount       int         `json:"retry_count"`
    LastError        string      `json:"last_error,omitempty"`
    CreatedAt        time.Time   `json:"created_at"`
    UploadedAt       *time.Time  `json:"uploaded_at,omitempty"`
}

// ChunkData represents the actual data in a chunk.
type ChunkData struct {
    ReportID   string       `json:"report_id"`
    ChunkIndex int          `json:"chunk_index"`
    TotalChunks int         `json:"total_chunks"`
    Tool       *ctis.Tool    `json:"tool,omitempty"`
    Metadata   *ctis.Metadata `json:"metadata,omitempty"`
    Assets     []ctis.Asset  `json:"assets,omitempty"`
    Findings   []ctis.Finding `json:"findings,omitempty"`
    IsFinal    bool         `json:"is_final"`
}

// Metadata stores additional report context.
type Metadata struct {
    ToolName    string    `json:"tool_name"`
    ToolVersion string    `json:"tool_version"`
    ScanID      string    `json:"scan_id"`
    StartedAt   time.Time `json:"started_at"`
    FinishedAt  time.Time `json:"finished_at"`
}

// Status enums
type ReportStatus string
type ChunkStatus string

const (
    ReportStatusPending   ReportStatus = "pending"
    ReportStatusUploading ReportStatus = "uploading"
    ReportStatusCompleted ReportStatus = "completed"
    ReportStatusFailed    ReportStatus = "failed"

    ChunkStatusPending   ChunkStatus = "pending"
    ChunkStatusUploading ChunkStatus = "uploading"
    ChunkStatusCompleted ChunkStatus = "completed"
    ChunkStatusFailed    ChunkStatus = "failed"
)

// Progress represents upload progress for a report.
type Progress struct {
    ReportID        string  `json:"report_id"`
    TotalChunks     int     `json:"total_chunks"`
    CompletedChunks int     `json:"completed_chunks"`
    FailedChunks    int     `json:"failed_chunks"`
    PercentComplete float64 `json:"percent_complete"`
    BytesUploaded   int64   `json:"bytes_uploaded"`
    BytesTotal      int64   `json:"bytes_total"`
}
```

### 4. Chunking Algorithm

```go
// pkg/chunk/splitter.go

package chunk

import (
    "github.com/openctemio/sdk-go/pkg/ctis"
)

// Splitter handles report chunking logic.
type Splitter struct {
    cfg *Config
}

// NewSplitter creates a new splitter with the given config.
func NewSplitter(cfg *Config) *Splitter {
    return &Splitter{cfg: cfg}
}

// NeedsChunking determines if a report should be chunked.
func (s *Splitter) NeedsChunking(report *ctis.Report) bool {
    return len(report.Findings) >= s.cfg.MinFindingsForChunking ||
           len(report.Assets) >= s.cfg.MinAssetsForChunking
}

// Split divides a report into chunks.
// Algorithm:
// 1. Group findings by their asset_ref
// 2. Create chunks that respect both findings and assets limits
// 3. First chunk always includes tool and metadata
// 4. Each chunk is self-contained with its assets and findings
func (s *Splitter) Split(report *ctis.Report) ([]*ChunkData, error) {
    if !s.NeedsChunking(report) {
        // Single chunk - just wrap the whole report
        return []*ChunkData{{
            ReportID:    report.Metadata.ID,
            ChunkIndex:  0,
            TotalChunks: 1,
            Tool:        report.Tool,
            Metadata:    report.Metadata,
            Assets:      report.Assets,
            Findings:    report.Findings,
            IsFinal:     true,
        }}, nil
    }

    chunks := make([]*ChunkData, 0)

    // Build asset reference map: assetRef -> asset
    assetMap := make(map[string]*ctis.Asset)
    for i := range report.Assets {
        a := &report.Assets[i]
        assetMap[a.ID] = a
    }

    // Group findings by asset reference
    findingsByAsset := make(map[string][]ctis.Finding)
    orphanFindings := make([]ctis.Finding, 0) // Findings without asset_ref

    for _, f := range report.Findings {
        if f.AssetRef != "" {
            findingsByAsset[f.AssetRef] = append(findingsByAsset[f.AssetRef], f)
        } else {
            orphanFindings = append(orphanFindings, f)
        }
    }

    // Create chunks
    chunkIndex := 0
    currentAssets := make([]ctis.Asset, 0, s.cfg.MaxAssetsPerChunk)
    currentFindings := make([]ctis.Finding, 0, s.cfg.MaxFindingsPerChunk)

    flushChunk := func(isFinal bool) {
        if len(currentAssets) == 0 && len(currentFindings) == 0 {
            return
        }

        chunk := &ChunkData{
            ReportID:    report.Metadata.ID,
            ChunkIndex:  chunkIndex,
            Assets:      currentAssets,
            Findings:    currentFindings,
            IsFinal:     isFinal,
        }

        // First chunk includes tool and metadata
        if chunkIndex == 0 {
            chunk.Tool = report.Tool
            chunk.Metadata = report.Metadata
        }

        chunks = append(chunks, chunk)
        chunkIndex++

        currentAssets = make([]ctis.Asset, 0, s.cfg.MaxAssetsPerChunk)
        currentFindings = make([]ctis.Finding, 0, s.cfg.MaxFindingsPerChunk)
    }

    // Process findings grouped by asset
    for assetRef, findings := range findingsByAsset {
        // Get the asset
        asset, hasAsset := assetMap[assetRef]

        // Check if we need to start a new chunk
        needsNewChunk := false
        if hasAsset && len(currentAssets) >= s.cfg.MaxAssetsPerChunk {
            needsNewChunk = true
        }
        if len(currentFindings)+len(findings) > s.cfg.MaxFindingsPerChunk {
            needsNewChunk = true
        }

        if needsNewChunk {
            flushChunk(false)
        }

        // Add asset if not already added
        if hasAsset {
            currentAssets = append(currentAssets, *asset)
        }

        // Add findings, splitting if necessary
        for _, f := range findings {
            if len(currentFindings) >= s.cfg.MaxFindingsPerChunk {
                flushChunk(false)
            }
            currentFindings = append(currentFindings, f)
        }
    }

    // Handle orphan findings
    for _, f := range orphanFindings {
        if len(currentFindings) >= s.cfg.MaxFindingsPerChunk {
            flushChunk(false)
        }
        currentFindings = append(currentFindings, f)
    }

    // Flush remaining
    flushChunk(true)

    // Update total chunks count in all chunks
    totalChunks := len(chunks)
    for _, c := range chunks {
        c.TotalChunks = totalChunks
    }

    return chunks, nil
}
```

### 5. ChunkManager (Main Interface)

```go
// pkg/chunk/manager.go

package chunk

import (
    "context"
    "database/sql"
    "sync"
    "time"

    "github.com/openctemio/sdk-go/pkg/ctis"
    _ "modernc.org/sqlite" // Pure Go SQLite driver
)

// Manager handles chunking, storage, and upload coordination.
type Manager struct {
    cfg      *Config
    db       *sql.DB
    splitter *Splitter
    uploader *Uploader

    mu       sync.RWMutex
    running  bool
    stopCh   chan struct{}
    wg       sync.WaitGroup

    // Callbacks
    onProgress func(Progress)
    onComplete func(reportID string)
    onError    func(reportID string, err error)
}

// NewManager creates a new chunk manager.
func NewManager(cfg *Config) (*Manager, error) {
    if cfg == nil {
        cfg = DefaultConfig()
    }

    // Initialize database
    db, err := initDB(cfg.DatabasePath)
    if err != nil {
        return nil, err
    }

    return &Manager{
        cfg:      cfg,
        db:       db,
        splitter: NewSplitter(cfg),
        stopCh:   make(chan struct{}),
    }, nil
}

// SetUploader configures the uploader (requires SDK client).
func (m *Manager) SetUploader(uploader *Uploader) {
    m.uploader = uploader
}

// SubmitReport queues a report for chunked upload.
// Returns immediately after storing chunks to SQLite.
func (m *Manager) SubmitReport(ctx context.Context, report *ctis.Report) (*Report, error) {
    // Split report into chunks
    chunks, err := m.splitter.Split(report)
    if err != nil {
        return nil, err
    }

    // Create report record
    r := &Report{
        ID:                    report.Metadata.ID,
        OriginalFindingsCount: len(report.Findings),
        OriginalAssetsCount:   len(report.Assets),
        TotalChunks:           len(chunks),
        Status:                ReportStatusPending,
        CreatedAt:             time.Now(),
        UpdatedAt:             time.Now(),
        Metadata: &Metadata{
            ScanID: report.Metadata.ID,
        },
    }

    if report.Tool != nil {
        r.Metadata.ToolName = report.Tool.Name
        r.Metadata.ToolVersion = report.Tool.Version
    }

    // Store report and chunks atomically
    if err := m.storeReport(ctx, r, chunks); err != nil {
        return nil, err
    }

    return r, nil
}

// Start begins background upload processing.
func (m *Manager) Start(ctx context.Context) error {
    m.mu.Lock()
    if m.running {
        m.mu.Unlock()
        return nil
    }
    m.running = true
    m.mu.Unlock()

    m.wg.Add(1)
    go m.uploadLoop(ctx)

    return nil
}

// Stop gracefully stops the upload process.
func (m *Manager) Stop() {
    m.mu.Lock()
    if !m.running {
        m.mu.Unlock()
        return
    }
    m.running = false
    close(m.stopCh)
    m.mu.Unlock()

    m.wg.Wait()
}

// GetProgress returns upload progress for a report.
func (m *Manager) GetProgress(ctx context.Context, reportID string) (*Progress, error) {
    return m.queryProgress(ctx, reportID)
}

// uploadLoop runs the background upload process.
func (m *Manager) uploadLoop(ctx context.Context) {
    defer m.wg.Done()

    ticker := time.NewTicker(time.Duration(m.cfg.UploadDelayMs) * time.Millisecond)
    defer ticker.Stop()

    cleanupTicker := time.NewTicker(1 * time.Hour)
    defer cleanupTicker.Stop()

    for {
        select {
        case <-ctx.Done():
            return
        case <-m.stopCh:
            return
        case <-cleanupTicker.C:
            m.cleanup(ctx)
        case <-ticker.C:
            m.processNextChunk(ctx)
        }
    }
}

// processNextChunk uploads the next pending chunk.
func (m *Manager) processNextChunk(ctx context.Context) {
    chunk, err := m.getNextPendingChunk(ctx)
    if err != nil || chunk == nil {
        return
    }

    // Upload chunk
    if err := m.uploader.Upload(ctx, chunk); err != nil {
        m.markChunkFailed(ctx, chunk.ID, err.Error())
        return
    }

    // Mark as completed
    m.markChunkCompleted(ctx, chunk.ID)

    // Check if report is complete
    m.checkReportCompletion(ctx, chunk.ReportID)
}

// Close releases resources.
func (m *Manager) Close() error {
    m.Stop()
    return m.db.Close()
}
```

### 6. Server-Side API Changes

```go
// api/internal/app/ingest/handler_chunk.go

package ingest

import (
    "net/http"

    "github.com/gin-gonic/gin"
    "github.com/openctemio/api/internal/domain/shared"
)

// ChunkRequest represents a chunk upload request.
type ChunkRequest struct {
    ReportID   string `json:"report_id" binding:"required,uuid"`
    ChunkIndex int    `json:"chunk_index" binding:"gte=0"`
    TotalChunks int   `json:"total_chunks" binding:"required,gte=1"`
    IsFinal    bool   `json:"is_final"`
    Data       struct {
        Tool     *ToolData     `json:"tool,omitempty"`
        Metadata *MetadataData `json:"metadata,omitempty"`
        Assets   []AssetData   `json:"assets,omitempty"`
        Findings []FindingData `json:"findings,omitempty"`
    } `json:"data" binding:"required"`
}

// ChunkResponse represents chunk upload response.
type ChunkResponse struct {
    ChunkID   string `json:"chunk_id"`
    Status    string `json:"status"`
    Processed struct {
        AssetsCreated   int `json:"assets_created"`
        AssetsUpdated   int `json:"assets_updated"`
        FindingsCreated int `json:"findings_created"`
        FindingsUpdated int `json:"findings_updated"`
    } `json:"processed"`
}

// HandleChunkIngest handles chunked report uploads.
// POST /api/v1/agent/ingest/chunk
func (h *Handler) HandleChunkIngest(c *gin.Context) {
    var req ChunkRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    // Get tenant from context (set by auth middleware)
    tenantID := c.MustGet("tenant_id").(shared.ID)

    // Convert chunk data to CTIS format
    report := h.convertChunkToReport(&req)

    // Process using existing service (reuses all validation/processing logic)
    output, err := h.service.Process(c.Request.Context(), tenantID, report)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    // Return response
    resp := ChunkResponse{
        ChunkID: req.ReportID + "-" + fmt.Sprintf("%d", req.ChunkIndex),
        Status:  "accepted",
    }
    resp.Processed.AssetsCreated = output.AssetsCreated
    resp.Processed.AssetsUpdated = output.AssetsUpdated
    resp.Processed.FindingsCreated = output.FindingsCreated
    resp.Processed.FindingsUpdated = output.FindingsUpdated

    c.JSON(http.StatusOK, resp)
}
```

---

## Configuration

### YAML Config Example

```yaml
# agent.yaml

openctem:
  base_url: ${API_URL}
  api_key: ${API_KEY}

  # Chunked upload configuration
  chunked_upload:
    enabled: true

    # Chunking thresholds
    min_findings_for_chunking: 500
    min_assets_for_chunking: 100

    # Chunk size limits
    max_findings_per_chunk: 500
    max_assets_per_chunk: 100
    max_chunk_size_bytes: 2097152  # 2MB

    # Upload behavior
    upload_delay_ms: 100
    max_concurrent_uploads: 2
    upload_timeout_seconds: 30

    # Retry configuration
    max_retries: 3
    retry_backoff_ms: 1000

    # Storage
    database_path: ~/.openctem/chunks.db
    retention_hours: 24
    max_storage_mb: 500

    # Compression
    enable_compression: true
    compression_level: 6
```

### Environment Variables

```bash
# Enable chunked upload
export OPENCTEM_CHUNKED_UPLOAD_ENABLED=true

# Chunk size
export OPENCTEM_MAX_FINDINGS_PER_CHUNK=500
export OPENCTEM_MAX_ASSETS_PER_CHUNK=100

# Upload behavior
export OPENCTEM_CHUNK_UPLOAD_DELAY_MS=100
export OPENCTEM_CHUNK_MAX_CONCURRENT=2

# Storage
export OPENCTEM_CHUNK_DB_PATH=~/.openctem/chunks.db
export OPENCTEM_CHUNK_RETENTION_HOURS=24
```

---

## File Structure

```
sdk/
├── pkg/
│   ├── chunk/
│   │   ├── config.go       # Configuration types
│   │   ├── types.go        # Core types (Report, Chunk, Progress)
│   │   ├── splitter.go     # Chunking algorithm
│   │   ├── storage.go      # SQLite storage layer
│   │   ├── manager.go      # Main orchestration
│   │   ├── uploader.go     # Upload with retry
│   │   ├── compression.go  # gzip compression
│   │   └── chunk_test.go   # Tests
│   ├── client/
│   │   └── client.go       # Updated with chunk support

api/
├── internal/
│   └── app/
│       └── ingest/
│           ├── handler.go        # Existing handler
│           └── handler_chunk.go  # New chunk endpoint
```

---

## Implementation Phases

### Phase 1: SDK Core (Priority: High)
1. Create `pkg/chunk/config.go` - Configuration
2. Create `pkg/chunk/types.go` - Core types
3. Create `pkg/chunk/splitter.go` - Chunking algorithm
4. Create `pkg/chunk/compression.go` - gzip utilities

### Phase 2: Storage Layer (Priority: High)
1. Create `pkg/chunk/storage.go` - SQLite operations
2. Add migrations for schema creation
3. Implement CRUD operations

### Phase 3: Upload Manager (Priority: High)
1. Create `pkg/chunk/manager.go` - Main interface
2. Create `pkg/chunk/uploader.go` - Upload with retry
3. Add progress tracking and callbacks

### Phase 4: Integration (Priority: High)
1. Update `pkg/client/client.go` - Auto-chunking
2. Add new endpoint in API: `/api/v1/agent/ingest/chunk`
3. Add CLI commands for chunk status

### Phase 5: Testing & Documentation (Priority: Medium)
1. Unit tests for splitter, storage, uploader
2. Integration tests with mock server
3. Performance benchmarks
4. Update SDK documentation

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Large Report Success Rate | >99% (vs current ~70%) |
| Upload Latency (p99) | <5s per chunk |
| Memory Usage | <100MB for 10,000 findings |
| Server CPU Spike | <20% (vs current 80%+) |
| Data Completeness | 100% (no lost findings) |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| SQLite file corruption | Use WAL mode, regular backups |
| Disk space exhaustion | Max storage limit, auto-cleanup |
| Network interruption during upload | Auto-resume from last successful chunk |
| Chunk ordering issues | Server validates chunk sequence |
| Memory pressure from large chunks | Stream compression, chunk size limits |

---

## Alternatives Considered

1. **Server-side chunking**: Server splits request. Rejected - doesn't solve network issues
2. **Streaming upload**: HTTP/2 streaming. Rejected - complex, not universally supported
3. **Redis-based queue**: External dependency. Rejected - not suitable for embedded SDK
4. **File-based storage**: Simpler but no query capability. Rejected - harder to manage progress

**Decision**: SQLite provides the best balance of:
- Persistence and reliability (ACID)
- Query capability (progress tracking)
- No external dependencies (pure Go driver)
- Cross-platform support

---

## API Compatibility

This feature is **additive and backward compatible**:

1. **SDK**: Falls back to single-request upload if server doesn't support chunking
2. **Server**: New endpoint `/api/v1/agent/ingest/chunk` alongside existing `/api/v1/agent/ingest`
3. **Agents**: Can use either approach based on configuration

---

## Approval

- [ ] Architecture reviewed
- [ ] Implementation plan approved
- [ ] Ready to proceed

---

*Document Version: 1.0*
*Last Updated: 2026-01-28*
