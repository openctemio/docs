# RFC: Evidence File Storage Service

**Created:** 2026-03-17
**Status:** PROPOSED
**Priority:** P1
**Scope:** File upload/download service for pentest evidence (images, videos, documents)
**Dependencies:** Phase 2 Pentest (completed), S3/MinIO infrastructure

---

## Problem Statement

Pentest findings require rich evidence: screenshots, video recordings, documents, exported requests. Currently `source_metadata.evidence` stores URL references only — no upload mechanism exists.

Evidence data flow:
```
Pentester captures screenshot → Upload to storage → Get URL → Save URL in finding evidence
```

Without a file storage service, pentesters must manually host files elsewhere and paste URLs — bad UX.

---

## Industry Research

| Platform | Storage | Upload Method | Max Size |
|----------|---------|--------------|----------|
| PlexTrac | S3 | Direct upload + presigned URL | 50MB |
| Cobalt | S3 | API upload → process → store | 25MB |
| HackerOne | S3 | Drag-drop + paste (clipboard) | 25MB |
| Bugcrowd | S3 | Multi-file upload | 20MB |
| DefectDojo | Local/S3 configurable | API upload | Configurable |

**Common pattern:** S3-compatible storage, presigned URLs for direct upload, thumbnails for images.

---

## Architecture Options

### Option A: Server-Side Upload (Simple)

```
Client → POST /api/v1/files (multipart) → API Server → S3 → Return URL
```

**Pros:** Simple, all validation server-side, works with any client
**Cons:** API server handles all bytes (memory pressure), max ~50MB practical

### Option B: Presigned URL Upload (Scalable)

```
Client → POST /api/v1/files/presign → API returns presigned S3 URL
Client → PUT directly to S3 with presigned URL
Client → POST /api/v1/files/confirm (register file in DB)
```

**Pros:** API server never touches file bytes, unlimited file size, CDN-ready
**Cons:** More complex, 3 API calls, CORS configuration needed

### Option C: Hybrid (Recommended)

```
Small files (<5MB): Server-side upload (Option A)
Large files (>5MB): Presigned URL (Option B)
```

**For MVP: Option A only.** Presigned URLs in Phase 3.

---

## Recommended Architecture (MVP)

### Storage Abstraction

```go
// pkg/domain/file/storage.go
type Storage interface {
    Upload(ctx context.Context, key string, data io.Reader, contentType string, size int64) error
    Download(ctx context.Context, key string) (io.ReadCloser, error)
    Delete(ctx context.Context, key string) error
    GetURL(ctx context.Context, key string) (string, error)
}
```

Implementations:
- `LocalStorage` — saves to local filesystem (dev/self-host)
- `S3Storage` — saves to S3/MinIO (production)

Configuration:
```env
# Storage backend: "local" or "s3"
FILE_STORAGE_BACKEND=local

# Local storage
FILE_STORAGE_LOCAL_PATH=/data/uploads

# S3 storage
FILE_STORAGE_S3_BUCKET=openctem-files
FILE_STORAGE_S3_REGION=us-east-1
FILE_STORAGE_S3_ENDPOINT=http://minio:9000   # For MinIO
FILE_STORAGE_S3_ACCESS_KEY=minioadmin
FILE_STORAGE_S3_SECRET_KEY=minioadmin
```

### Database Schema

```sql
-- Migration 000096: File storage metadata
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(500) NOT NULL,           -- Original filename
    storage_key VARCHAR(1000) NOT NULL,   -- S3 key or local path
    content_type VARCHAR(100) NOT NULL,   -- MIME type
    size BIGINT NOT NULL,                 -- File size in bytes
    storage_backend VARCHAR(20) NOT NULL DEFAULT 'local',  -- 'local' or 's3'

    -- Context: what this file belongs to
    resource_type VARCHAR(50) NOT NULL,   -- 'pentest_evidence', 'compliance_evidence', 'attachment'
    resource_id UUID,                     -- Finding ID, assessment ID, etc.

    -- Metadata
    checksum VARCHAR(64),                 -- SHA-256 hash for dedup
    metadata JSONB DEFAULT '{}',          -- Dimensions, duration, etc.

    -- Audit
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_files_tenant ON files(tenant_id);
CREATE INDEX idx_files_resource ON files(resource_type, resource_id);
CREATE INDEX idx_files_checksum ON files(tenant_id, checksum) WHERE checksum IS NOT NULL;
```

### Key Design

```
S3 key format: tenants/{tenant_id}/{resource_type}/{year}/{month}/{uuid}.{ext}
Example:       tenants/abc123/pentest_evidence/2026/03/def456.png

Local path:    /data/uploads/tenants/{tenant_id}/{resource_type}/{year}/{month}/{uuid}.{ext}
```

### Security

| Concern | Mitigation |
|---------|------------|
| File type validation | Server-side MIME check (not just extension). Allow: image/*, video/*, application/pdf, text/plain |
| File size limit | Max 50MB per file, configurable per tenant |
| Path traversal | Generated UUID filename, no user-controlled paths |
| Virus/malware | Future: ClamAV scan before storage |
| Tenant isolation | S3 key includes tenant_id, queries always filter by tenant |
| Direct URL access | Serve via API endpoint with auth check, not direct S3 URL |
| EXIF stripping | Strip EXIF data from images (prevent GPS/device info leak) |

### Allowed MIME Types

```go
var allowedMimeTypes = map[string]bool{
    // Images
    "image/png":  true,
    "image/jpeg": true,
    "image/gif":  true,
    "image/webp": true,
    "image/svg+xml": true,

    // Videos
    "video/mp4":  true,
    "video/webm": true,

    // Documents
    "application/pdf": true,
    "text/plain":      true,
    "text/html":       true,
    "text/csv":        true,

    // Archives (for bulk evidence)
    "application/zip": true,
}
```

---

## API Endpoints

| Endpoint | Method | Permission | Description |
|----------|--------|-----------|-------------|
| `/api/v1/files` | POST | pentest:findings:write | Upload file (multipart/form-data) |
| `/api/v1/files/{id}` | GET | pentest:findings:read | Download file |
| `/api/v1/files/{id}` | DELETE | pentest:findings:write | Delete file |
| `/api/v1/files/{id}/metadata` | GET | pentest:findings:read | Get file metadata (no download) |

### Upload Request

```
POST /api/v1/files
Content-Type: multipart/form-data

Fields:
  file: (binary)
  resource_type: "pentest_evidence"
  resource_id: "finding-uuid"
```

### Upload Response

```json
{
  "id": "file-uuid",
  "name": "sqli-proof.png",
  "content_type": "image/png",
  "size": 245760,
  "url": "/api/v1/files/file-uuid",
  "created_at": "2026-03-17T10:00:00Z"
}
```

### Integration with Finding Evidence

When file is uploaded, the response URL is stored in finding's source_metadata:

```json
{
  "evidence": [
    {
      "id": "file-uuid",
      "type": "image",
      "name": "sqli-proof.png",
      "url": "/api/v1/files/file-uuid",
      "mime_type": "image/png",
      "size": 245760
    }
  ]
}
```

Frontend evidence uploader:
1. User drags file → upload via `/api/v1/files`
2. Get response with file ID + URL
3. Add to finding's evidence array
4. Save finding with updated source_metadata

---

## Service Layer

```go
type FileService struct {
    storage    Storage           // S3 or Local
    fileRepo   FileRepository    // DB metadata
    logger     *logger.Logger
}

func (s *FileService) Upload(ctx context.Context, input UploadInput) (*File, error) {
    // 1. Validate MIME type
    if !allowedMimeTypes[input.ContentType] {
        return nil, ErrInvalidFileType
    }

    // 2. Validate file size
    if input.Size > s.maxFileSize {
        return nil, ErrFileTooLarge
    }

    // 3. Generate storage key
    key := generateStorageKey(input.TenantID, input.ResourceType, input.Filename)

    // 4. Compute checksum (SHA-256)
    hash := sha256.New()
    reader := io.TeeReader(input.Reader, hash)

    // 5. Upload to storage backend
    if err := s.storage.Upload(ctx, key, reader, input.ContentType, input.Size); err != nil {
        return nil, err
    }

    // 6. Save metadata in DB
    file := NewFile(input.TenantID, input.Filename, key, input.ContentType, input.Size)
    file.SetChecksum(hex.EncodeToString(hash.Sum(nil)))
    file.SetResourceType(input.ResourceType)
    file.SetResourceID(input.ResourceID)

    if err := s.fileRepo.Create(ctx, file); err != nil {
        // Cleanup: delete from storage if DB save fails
        _ = s.storage.Delete(ctx, key)
        return nil, err
    }

    return file, nil
}

func (s *FileService) Download(ctx context.Context, tenantID, fileID string) (io.ReadCloser, *File, error) {
    file, err := s.fileRepo.GetByID(ctx, tenantID, fileID)
    if err != nil {
        return nil, nil, err
    }

    reader, err := s.storage.Download(ctx, file.StorageKey())
    return reader, file, err
}
```

---

## Docker Setup (MinIO for development)

```yaml
# docker-compose.yml
services:
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"   # API
      - "9001:9001"   # Console
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data

volumes:
  minio_data:
```

For local development without MinIO, use `FILE_STORAGE_BACKEND=local`.

---

## Implementation Plan

| Phase | Task | Effort |
|-------|------|--------|
| 1 | Migration 000096: `files` table | 0.5 day |
| 2 | Storage interface + LocalStorage implementation | 0.5 day |
| 3 | S3Storage implementation (aws-sdk-go-v2) | 1 day |
| 4 | FileService: upload, download, delete with validation | 1 day |
| 5 | HTTP handler + routes | 0.5 day |
| 6 | Wiring: repos, services, handlers | 0.5 day |
| 7 | Frontend: drag-drop evidence uploader integration | 1 day |
| 8 | Docker: MinIO service in docker-compose | 0.5 day |
| **Total** | | **5.5 days** |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large files consume API memory | Medium | Stream upload, don't buffer entire file |
| Storage cost grows | Low | Retention policy: auto-delete after campaign archive |
| Malware upload | Medium | MIME validation + future ClamAV integration |
| EXIF data leakage | Medium | Strip EXIF on image upload |
| Storage backend unavailable | Medium | Graceful error, retry queue for uploads |
| Cross-tenant file access | Critical | tenant_id in DB query + S3 key prefix |
