---
layout: default
title: Storage Service Design
parent: Architecture
nav_order: 25
---
{% raw %}

# Storage Service - Technical Design Document

> **Status**: Draft
> **Author**: Claude
> **Created**: 2026-01-24
> **Last Updated**: 2026-01-24

---

## Table of Contents

1. [Overview](#1-overview)
2. [Requirements](#2-requirements)
3. [Architecture](#3-architecture)
4. [Database Schema](#4-database-schema)
5. [Permissions & RBAC](#5-permissions--rbac)
6. [Plan-Based Limits](#6-plan-based-limits)
7. [API Design](#7-api-design)
8. [Storage Providers](#8-storage-providers)
9. [Frontend Implementation](#9-frontend-implementation)
10. [Security Considerations](#10-security-considerations)
11. [Implementation Phases](#11-implementation-phases)
12. [Migration Strategy](#12-migration-strategy)
13. [Testing Strategy](#13-testing-strategy)
14. [Monitoring & Observability](#14-monitoring--observability)

---

## 1. Overview

### 1.1 Purpose

Unified storage infrastructure for the OpenCTEM platform that supports:
- Multiple storage providers (platform-managed and tenant-owned)
- Multi-tenant isolation
- Plan-based quotas and limits
- Fine-grained access control
- Lifecycle management and retention policies

### 1.2 Use Cases

| Use Case | Description | Size Range | Retention |
|----------|-------------|------------|-----------|
| User Avatar | Profile pictures | < 5 MB | Forever |
| Tenant Logo | Organization branding | < 5 MB | Forever |
| Finding Evidence | Screenshots, videos, PoC | < 100 MB | 1-7 years |
| Scan Artifacts | Raw output, SARIF, logs | < 500 MB | 1 year |
| Report Exports | PDF, CSV, JSON | < 50 MB | 1-3 years |
| Data Backups | Findings, configs, audit | Unlimited | 7+ years |
| Asset Imports | CSV, JSON inventory | < 100 MB | 30 days |
| Attachments | Generic file attachments | < 25 MB | Entity lifetime |

### 1.3 Goals

1. **Flexibility**: Support multiple storage backends
2. **Security**: Tenant isolation, encryption, access control
3. **Scalability**: Handle growth without architecture changes
4. **Cost Efficiency**: Optimize storage costs per tenant tier
5. **Compliance**: Meet data residency and retention requirements

---

## 2. Requirements

### 2.1 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | Upload files via presigned URL or direct upload | High |
| FR-02 | Download files with access control | High |
| FR-03 | Delete files (soft and hard delete) | High |
| FR-04 | Configure storage provider per tenant | High |
| FR-05 | Set file size limits per purpose | High |
| FR-06 | Track storage usage per tenant | High |
| FR-07 | Enforce quotas based on plan | High |
| FR-08 | Auto-delete expired files | Medium |
| FR-09 | Version files (configurable) | Medium |
| FR-10 | Generate thumbnails for images | Low |
| FR-11 | Virus scanning before storage | Low |

### 2.2 Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-01 | Upload latency | < 2s for 10MB file |
| NFR-02 | Download latency | < 500ms for presigned URL |
| NFR-03 | Availability | 99.9% |
| NFR-04 | Data durability | 99.999999999% (11 nines) |
| NFR-05 | Concurrent uploads | 100 per tenant |
| NFR-06 | Max file size | 500 MB |

---

## 3. Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Web UI / Mobile App / CLI / SDK                                    │   │
│  │  • File picker & validation                                         │   │
│  │  • Progress tracking                                                │   │
│  │  • Client-side compression (optional)                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY                                    │
│  • Authentication (JWT validation)                                         │
│  • Rate limiting                                                           │
│  • Request routing                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STORAGE SERVICE                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Storage Controller                              │   │
│  │  • POST /storage/upload-url     (Get presigned URL)                 │   │
│  │  • POST /storage/upload         (Direct upload)                     │   │
│  │  • POST /storage/confirm        (Confirm upload)                    │   │
│  │  • GET  /storage/download/:id   (Get download URL)                  │   │
│  │  • GET  /storage/files          (List files)                        │   │
│  │  • DELETE /storage/files/:id    (Delete file)                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│  ┌───────────────┬───────────────┬───────────────┬───────────────┐        │
│  │   Permission  │    Quota      │    Policy     │    Metadata   │        │
│  │   Checker     │    Manager    │    Engine     │    Store      │        │
│  └───────────────┴───────────────┴───────────────┴───────────────┘        │
│                                      │                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Provider Router                                   │   │
│  │  • Resolve tenant's storage config                                  │   │
│  │  • Route to appropriate provider                                    │   │
│  │  • Handle fallback to default                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │
          ┌────────────────────────────┼────────────────────────────┐
          ▼                            ▼                            ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│   Default Provider  │  │    S3 Provider      │  │   Azure Provider    │
│   (Platform R2)     │  │   (BYOB)            │  │   (BYOB)            │
│                     │  │                     │  │                     │
│  • Cloudflare R2    │  │  • AWS S3           │  │  • Azure Blob       │
│  • Managed by us    │  │  • Cloudflare R2    │  │  • Azure Data Lake  │
│  • Auto-CDN         │  │  • MinIO            │  │                     │
│                     │  │  • DigitalOcean     │  │                     │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
          │                            │                            │
          └────────────────────────────┼────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OBJECT STORAGE                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Bucket:.openctem-storage                                            │   │
│  │  ├── tenants/                                                       │   │
│  │  │   ├── {tenant_id}/                                               │   │
│  │  │   │   ├── avatars/                                               │   │
│  │  │   │   ├── logos/                                                 │   │
│  │  │   │   ├── evidence/                                              │   │
│  │  │   │   │   └── {finding_id}/                                      │   │
│  │  │   │   ├── reports/                                               │   │
│  │  │   │   ├── scans/                                                 │   │
│  │  │   │   │   └── {scan_id}/                                         │   │
│  │  │   │   ├── backups/                                               │   │
│  │  │   │   └── imports/                                               │   │
│  │  │   └── ...                                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STORAGE DOMAIN                                    │
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐      │
│  │  StorageConfig  │     │  StorageFile    │     │  StorageUsage   │      │
│  │  (Entity)       │     │  (Entity)       │     │  (Entity)       │      │
│  ├─────────────────┤     ├─────────────────┤     ├─────────────────┤      │
│  │ - tenant_id     │     │ - id            │     │ - tenant_id     │      │
│  │ - provider      │     │ - tenant_id     │     │ - total_bytes   │      │
│  │ - credentials   │     │ - file_key      │     │ - total_files   │      │
│  │ - settings      │     │ - purpose       │     │ - by_purpose    │      │
│  │ - enabled_for   │     │ - metadata      │     │ - quota_bytes   │      │
│  └─────────────────┘     │ - entity_ref    │     └─────────────────┘      │
│                          │ - urls          │                               │
│  ┌─────────────────┐     │ - lifecycle     │     ┌─────────────────┐      │
│  │  StoragePolicy  │     └─────────────────┘     │  StorageEvent   │      │
│  │  (Entity)       │                             │  (Audit)        │      │
│  ├─────────────────┤                             ├─────────────────┤      │
│  │ - tenant_id     │                             │ - file_id       │      │
│  │ - purpose       │                             │ - action        │      │
│  │ - max_size      │                             │ - actor_id      │      │
│  │ - allowed_types │                             │ - timestamp     │      │
│  │ - retention     │                             │ - metadata      │      │
│  │ - versioning    │                             └─────────────────┘      │
│  └─────────────────┘                                                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        STORAGE SERVICE                               │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  + RequestUploadURL(ctx, req) -> UploadURLResponse                  │   │
│  │  + ConfirmUpload(ctx, fileID, checksum) -> StorageFile              │   │
│  │  + GetDownloadURL(ctx, fileID) -> DownloadURLResponse               │   │
│  │  + DeleteFile(ctx, fileID) -> error                                 │   │
│  │  + ListFiles(ctx, filter) -> []StorageFile                          │   │
│  │  + GetUsage(ctx, tenantID) -> StorageUsage                          │   │
│  │  + UpdateConfig(ctx, tenantID, config) -> error                     │   │
│  │  + TestConnection(ctx, tenantID) -> TestResult                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     PROVIDER INTERFACE                               │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  + GenerateUploadURL(key, contentType, size, ttl) -> URL            │   │
│  │  + GenerateDownloadURL(key, ttl) -> URL                             │   │
│  │  + Upload(key, reader, metadata) -> error                           │   │
│  │  + Download(key) -> io.ReadCloser                                   │   │
│  │  + Delete(key) -> error                                             │   │
│  │  + Exists(key) -> bool                                              │   │
│  │  + GetMetadata(key) -> ObjectMetadata                               │   │
│  │  + ListObjects(prefix) -> []ObjectInfo                              │   │
│  │  + TestConnection() -> error                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Upload Flow Sequence

```
┌──────┐          ┌─────────┐          ┌─────────────┐          ┌─────────┐
│Client│          │   API   │          │StorageService│          │Provider │
└──┬───┘          └────┬────┘          └──────┬──────┘          └────┬────┘
   │                   │                      │                      │
   │ 1. Request Upload URL                    │                      │
   │──────────────────>│                      │                      │
   │                   │                      │                      │
   │                   │ 2. Check Permission  │                      │
   │                   │─────────────────────>│                      │
   │                   │                      │                      │
   │                   │ 3. Check Quota       │                      │
   │                   │─────────────────────>│                      │
   │                   │                      │                      │
   │                   │ 4. Validate Policy   │                      │
   │                   │─────────────────────>│                      │
   │                   │                      │                      │
   │                   │ 5. Get Tenant Config │                      │
   │                   │─────────────────────>│                      │
   │                   │                      │                      │
   │                   │                      │ 6. Generate Presigned URL
   │                   │                      │─────────────────────>│
   │                   │                      │                      │
   │                   │                      │<─────────────────────│
   │                   │                      │     Presigned URL    │
   │                   │<─────────────────────│                      │
   │<──────────────────│                      │                      │
   │   Upload URL + File ID                   │                      │
   │                   │                      │                      │
   │ 7. Upload directly to storage            │                      │
   │──────────────────────────────────────────────────────────────>│
   │                   │                      │                      │
   │<──────────────────────────────────────────────────────────────│
   │   Upload Success  │                      │                      │
   │                   │                      │                      │
   │ 8. Confirm Upload │                      │                      │
   │──────────────────>│                      │                      │
   │                   │                      │                      │
   │                   │ 9. Verify & Save Metadata                   │
   │                   │─────────────────────>│                      │
   │                   │                      │                      │
   │                   │                      │ 10. Verify file exists
   │                   │                      │─────────────────────>│
   │                   │                      │                      │
   │                   │ 11. Update Usage     │                      │
   │                   │─────────────────────>│                      │
   │                   │                      │                      │
   │                   │<─────────────────────│                      │
   │<──────────────────│                      │                      │
   │   File Metadata + Public URL             │                      │
   │                   │                      │                      │
└──┴───┘          └────┴────┘          └──────┴──────┘          └────┴────┘
```

---

## 4. Database Schema

### 4.1 Tables

```sql
-- =====================================================
-- TENANT STORAGE CONFIGURATION
-- =====================================================

CREATE TABLE tenant_storage_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Provider type
    provider VARCHAR(20) NOT NULL DEFAULT 'default',
    -- Values: 'default' | 's3' | 'azure' | 'gcs' | 'local' | 'custom'

    -- ===== S3-Compatible Configuration =====
    s3_endpoint VARCHAR(500),              -- e.g., https://xxx.r2.cloudflarestorage.com
    s3_bucket VARCHAR(255),
    s3_region VARCHAR(50) DEFAULT 'auto',
    s3_access_key_id VARCHAR(255),         -- Encrypted with tenant key
    s3_secret_access_key TEXT,             -- Encrypted with tenant key
    s3_path_style BOOLEAN DEFAULT FALSE,   -- For MinIO/custom S3
    s3_force_path_style BOOLEAN DEFAULT FALSE,

    -- ===== Azure Blob Configuration =====
    azure_account_name VARCHAR(255),
    azure_container VARCHAR(255),
    azure_sas_token TEXT,                  -- Encrypted
    azure_endpoint VARCHAR(500),           -- For sovereign clouds

    -- ===== GCS Configuration =====
    gcs_project_id VARCHAR(255),
    gcs_bucket VARCHAR(255),
    gcs_credentials_json TEXT,             -- Encrypted service account

    -- ===== Local Storage (On-premise) =====
    local_base_path VARCHAR(500),          -- /data/storage/
    local_serve_url VARCHAR(500),          -- http://files.internal/

    -- ===== Custom Provider (Webhook) =====
    custom_upload_endpoint VARCHAR(500),
    custom_download_endpoint VARCHAR(500),
    custom_delete_endpoint VARCHAR(500),
    custom_auth_header TEXT,               -- Encrypted

    -- ===== Common Settings =====
    cdn_base_url VARCHAR(500),             -- Optional CDN prefix
    path_prefix VARCHAR(255) DEFAULT '',   -- e.g., "openctem/" or ""

    -- Which file types use this config
    enabled_for_purposes TEXT[] DEFAULT ARRAY['all'],
    -- Values: 'all' | 'avatar' | 'logo' | 'evidence' | 'report' | 'backup' | 'scan' | 'import'

    -- Connection status
    last_test_at TIMESTAMPTZ,
    last_test_result JSONB,                -- { success: bool, error: string, latency_ms: int }

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),

    CONSTRAINT unique_tenant_storage UNIQUE(tenant_id)
);

-- Index for lookups
CREATE INDEX idx_tenant_storage_tenant ON tenant_storage_configs(tenant_id);

-- =====================================================
-- FILE METADATA
-- =====================================================

CREATE TABLE storage_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- ===== File Identification =====
    file_key VARCHAR(1000) NOT NULL,       -- Full path in storage
    original_name VARCHAR(500),            -- User's original filename

    -- ===== File Properties =====
    content_type VARCHAR(100) NOT NULL,    -- MIME type
    size_bytes BIGINT NOT NULL,            -- Size in bytes
    checksum_sha256 VARCHAR(64),           -- For integrity verification

    -- ===== Classification =====
    purpose VARCHAR(50) NOT NULL,          -- avatar, logo, evidence, report, backup, scan, import, attachment

    -- ===== Entity Reference =====
    entity_type VARCHAR(50),               -- user, tenant, finding, scan, report, asset
    entity_id UUID,                        -- ID of the referenced entity

    -- ===== URLs =====
    storage_url TEXT,                      -- Internal URL (provider-specific)
    public_url TEXT,                       -- CDN/public URL (may be null)

    -- ===== Versioning =====
    version INTEGER DEFAULT 1,
    previous_version_id UUID REFERENCES storage_files(id),
    is_current BOOLEAN DEFAULT TRUE,

    -- ===== Metadata =====
    metadata JSONB DEFAULT '{}'::jsonb,
    -- Examples:
    -- For images: { "width": 200, "height": 200, "format": "jpeg" }
    -- For videos: { "duration_seconds": 30, "codec": "h264" }
    -- For evidence: { "finding_severity": "high", "capture_time": "..." }

    -- ===== Access Control =====
    visibility VARCHAR(20) DEFAULT 'private',
    -- Values: 'private' | 'tenant' | 'public'
    allowed_users UUID[] DEFAULT ARRAY[]::UUID[],

    -- ===== Lifecycle =====
    uploaded_by UUID REFERENCES users(id),
    expires_at TIMESTAMPTZ,                -- Auto-delete after this time
    deleted_at TIMESTAMPTZ,                -- Soft delete timestamp

    -- ===== Timestamps =====
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_tenant_file_key UNIQUE(tenant_id, file_key)
);

-- Indexes
CREATE INDEX idx_storage_files_tenant ON storage_files(tenant_id);
CREATE INDEX idx_storage_files_purpose ON storage_files(purpose);
CREATE INDEX idx_storage_files_entity ON storage_files(entity_type, entity_id);
CREATE INDEX idx_storage_files_expires ON storage_files(expires_at)
    WHERE expires_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_storage_files_deleted ON storage_files(deleted_at)
    WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_storage_files_current ON storage_files(entity_type, entity_id, is_current)
    WHERE is_current = TRUE;

-- =====================================================
-- STORAGE USAGE TRACKING
-- =====================================================

CREATE TABLE tenant_storage_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- ===== Current Totals =====
    total_bytes BIGINT DEFAULT 0,
    total_files INTEGER DEFAULT 0,

    -- ===== Usage by Purpose =====
    usage_by_purpose JSONB DEFAULT '{}'::jsonb,
    -- { "avatar": { "bytes": 1024, "files": 5 }, "evidence": { ... } }

    -- ===== Quotas (0 = inherit from plan, -1 = unlimited) =====
    quota_bytes_override BIGINT DEFAULT 0,
    quota_files_override INTEGER DEFAULT 0,

    -- ===== Calculated =====
    last_calculated_at TIMESTAMPTZ DEFAULT NOW(),

    -- ===== Timestamps =====
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_tenant_usage UNIQUE(tenant_id)
);

-- =====================================================
-- STORAGE POLICIES (Per-Purpose Settings)
-- =====================================================

CREATE TABLE tenant_storage_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- ===== Policy Target =====
    purpose VARCHAR(50) NOT NULL,          -- avatar, logo, evidence, etc.

    -- ===== Size Limits =====
    max_file_size_bytes BIGINT,            -- NULL = inherit from plan default
    max_total_size_bytes BIGINT,           -- NULL = no limit (only quota)

    -- ===== Allowed Types =====
    allowed_content_types TEXT[],          -- NULL = inherit defaults
    -- e.g., ARRAY['image/jpeg', 'image/png', 'image/webp']

    -- ===== Retention =====
    retention_days INTEGER DEFAULT 0,      -- 0 = forever

    -- ===== Processing =====
    auto_compress BOOLEAN DEFAULT FALSE,
    compress_max_dimension INTEGER,        -- For images
    compress_quality INTEGER DEFAULT 85,   -- JPEG quality

    -- ===== Versioning =====
    enable_versioning BOOLEAN DEFAULT FALSE,
    max_versions INTEGER DEFAULT 1,

    -- ===== Access =====
    default_visibility VARCHAR(20) DEFAULT 'private',

    -- ===== Timestamps =====
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_tenant_purpose_policy UNIQUE(tenant_id, purpose)
);

-- =====================================================
-- STORAGE AUDIT LOG
-- =====================================================

CREATE TABLE storage_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- ===== Event Info =====
    action VARCHAR(50) NOT NULL,           -- upload, download, delete, config_update

    -- ===== Target =====
    file_id UUID REFERENCES storage_files(id) ON DELETE SET NULL,
    file_key VARCHAR(1000),                -- Keep even if file deleted

    -- ===== Actor =====
    actor_id UUID REFERENCES users(id),
    actor_type VARCHAR(20) DEFAULT 'user', -- user, system, api_key

    -- ===== Context =====
    ip_address INET,
    user_agent TEXT,

    -- ===== Details =====
    metadata JSONB DEFAULT '{}'::jsonb,
    -- e.g., { "size_bytes": 1024, "content_type": "image/jpeg" }

    -- ===== Result =====
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,

    -- ===== Timestamp =====
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit queries
CREATE INDEX idx_storage_audit_tenant ON storage_audit_logs(tenant_id);
CREATE INDEX idx_storage_audit_time ON storage_audit_logs(created_at DESC);
CREATE INDEX idx_storage_audit_file ON storage_audit_logs(file_id);
CREATE INDEX idx_storage_audit_actor ON storage_audit_logs(actor_id);

-- Partitioning for large audit tables (optional)
-- CREATE TABLE storage_audit_logs_y2024m01 PARTITION OF storage_audit_logs
--     FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### 4.2 Plan Limits Table Extension

```sql
-- Add storage limits to plan_limits table
ALTER TABLE plan_limits ADD COLUMN IF NOT EXISTS storage_limits JSONB DEFAULT '{
    "total_bytes": 536870912,
    "total_files": 1000,
    "max_file_size_bytes": 52428800,
    "allowed_providers": ["default"],
    "features": {
        "custom_cdn": false,
        "byob": false,
        "versioning": false,
        "retention_policies": false
    },
    "per_purpose": {
        "avatar": { "max_bytes": 5242880, "max_files": 100 },
        "logo": { "max_bytes": 5242880, "max_files": 10 },
        "evidence": { "max_bytes": 107374182400, "max_files": 10000 },
        "report": { "max_bytes": 53687091200, "max_files": 1000 },
        "backup": { "max_bytes": -1, "max_files": -1 },
        "scan": { "max_bytes": 536870912000, "max_files": 5000 }
    }
}'::jsonb;

```

---

## 5. Permissions & RBAC

### 5.1 Permission Definitions

```go
// permissions/constants.go

const (
    // ===== Storage Files =====
    PermissionStorageRead   = "storage:read"    // View/download files
    PermissionStorageWrite  = "storage:write"   // Upload files
    PermissionStorageDelete = "storage:delete"  // Delete files

    // ===== Storage Admin =====
    PermissionStorageConfigRead   = "storage:config:read"    // View storage config
    PermissionStorageConfigWrite  = "storage:config:write"   // Modify storage config

    // ===== Storage Policies =====
    PermissionStoragePoliciesRead   = "storage:policies:read"
    PermissionStoragePoliciesWrite  = "storage:policies:write"

    // ===== Storage Usage =====
    PermissionStorageUsageRead = "storage:usage:read"  // View usage stats

    // ===== Purpose-Specific (Fine-grained) =====
    PermissionStorageAvatarWrite     = "storage:avatar:write"
    PermissionStorageLogoWrite       = "storage:logo:write"
    PermissionStorageEvidenceWrite   = "storage:evidence:write"
    PermissionStorageEvidenceRead    = "storage:evidence:read"
    PermissionStorageReportWrite     = "storage:report:write"
    PermissionStorageReportRead      = "storage:report:read"
    PermissionStorageBackupWrite     = "storage:backup:write"
    PermissionStorageBackupRead      = "storage:backup:read"
    PermissionStorageScanWrite       = "storage:scan:write"
    PermissionStorageScanRead        = "storage:scan:read"
)
```

### 5.2 Permission Matrix by Role

| Permission | Owner | Admin | Member | Viewer |
|------------|-------|-------|--------|--------|
| `storage:read` | ✅ | ✅ | ✅ | ✅ |
| `storage:write` | ✅ | ✅ | ✅ | ❌ |
| `storage:delete` | ✅ | ✅ | ❌ | ❌ |
| `storage:config:read` | ✅ | ✅ | ❌ | ❌ |
| `storage:config:write` | ✅ | ✅ | ❌ | ❌ |
| `storage:policies:read` | ✅ | ✅ | ❌ | ❌ |
| `storage:policies:write` | ✅ | ❌ | ❌ | ❌ |
| `storage:usage:read` | ✅ | ✅ | ✅ | ✅ |
| `storage:avatar:write` | ✅ | ✅ | ✅ | ❌ |
| `storage:logo:write` | ✅ | ✅ | ❌ | ❌ |
| `storage:evidence:*` | ✅ | ✅ | ✅ | R only |
| `storage:report:*` | ✅ | ✅ | ✅ | R only |
| `storage:backup:*` | ✅ | ✅ | ❌ | ❌ |
| `storage:scan:*` | ✅ | ✅ | ✅ | R only |

### 5.3 Permission Check Flow

```go
// Check if user can upload a file
func (s *StorageService) CanUpload(ctx context.Context, req UploadRequest) error {
    user := auth.UserFromContext(ctx)
    tenant := auth.TenantFromContext(ctx)

    // 1. Check base permission
    if !user.HasPermission(PermissionStorageWrite) {
        return ErrPermissionDenied
    }

    // 2. Check purpose-specific permission
    purposePerm := fmt.Sprintf("storage:%s:write", req.Purpose)
    if !user.HasPermission(purposePerm) {
        return ErrPermissionDenied
    }

    // 3. Check entity-level access (if applicable)
    if req.EntityType != "" && req.EntityID != "" {
        if !s.canAccessEntity(ctx, user, req.EntityType, req.EntityID) {
            return ErrPermissionDenied
        }
    }

    // 4. Check quota
    if err := s.checkQuota(ctx, tenant.ID, req.SizeBytes); err != nil {
        return err
    }

    return nil
}
```

### 5.4 Frontend Permission Gates

```typescript
// components/storage/storage-config-page.tsx

import { PermissionGate } from '@/lib/permissions'

export function StorageConfigPage() {
  return (
    <PermissionGate permission="storage:config:read" fallback={<AccessDenied />}>
      <div>
        <h1>Storage Configuration</h1>

        {/* Provider Selection */}
        <PermissionGate permission="storage:config:write" mode="disable">
          <ProviderSelector />
        </PermissionGate>

        {/* Policies (Owner only) */}
        <PermissionGate permission="storage:policies:write">
          <StoragePoliciesEditor />
        </PermissionGate>

        {/* Usage Stats (Everyone can see) */}
        <StorageUsageStats />
      </div>
    </PermissionGate>
  )
}
```

---

## 6. API Design

### 7.1 Endpoints Overview

```yaml
# Storage API v1

# ===== File Operations =====
POST   /api/v1/storage/upload-url     # Get presigned upload URL
POST   /api/v1/storage/upload         # Direct upload (multipart)
POST   /api/v1/storage/confirm        # Confirm upload completion
GET    /api/v1/storage/download/{id}  # Get download URL/redirect
GET    /api/v1/storage/files          # List files
GET    /api/v1/storage/files/{id}     # Get file metadata
DELETE /api/v1/storage/files/{id}     # Delete file
DELETE /api/v1/storage/files          # Bulk delete

# ===== Admin: Configuration =====
GET    /api/v1/storage/config              # Get storage config
PUT    /api/v1/storage/config              # Update storage config
POST   /api/v1/storage/config/test         # Test connection
GET    /api/v1/storage/config/providers    # List available providers

# ===== Admin: Policies =====
GET    /api/v1/storage/policies            # List policies
PUT    /api/v1/storage/policies/{purpose}  # Update policy

# ===== Stats =====
GET    /api/v1/storage/usage               # Get usage statistics
GET    /api/v1/storage/audit               # Get audit logs
```

### 7.2 Request/Response Schemas

```typescript
// ===== Upload URL Request =====
interface RequestUploadURLRequest {
  purpose: FilePurpose           // Required: avatar, logo, evidence, etc.
  filename: string               // Required: original filename
  content_type: string           // Required: MIME type
  size_bytes: number             // Required: file size
  entity_type?: string           // Optional: finding, scan, user, etc.
  entity_id?: string             // Optional: UUID of entity
  metadata?: Record<string, any> // Optional: custom metadata
}

interface RequestUploadURLResponse {
  file_id: string                // UUID for tracking
  upload_url: string             // Presigned URL or upload endpoint
  upload_method: 'PUT' | 'POST'  // HTTP method to use
  upload_headers: Record<string, string>  // Required headers
  expires_at: string             // ISO timestamp
  max_size_bytes: number         // Maximum allowed size
}

// ===== Confirm Upload =====
interface ConfirmUploadRequest {
  file_id: string
  checksum_sha256?: string       // For verification
}

interface ConfirmUploadResponse {
  file: StorageFile
}

// ===== Download URL =====
interface GetDownloadURLResponse {
  download_url: string
  expires_at: string
  filename: string
  content_type: string
  size_bytes: number
}

// ===== List Files =====
interface ListFilesRequest {
  purpose?: FilePurpose
  entity_type?: string
  entity_id?: string
  page?: number
  per_page?: number
  sort_by?: 'created_at' | 'size_bytes' | 'name'
  sort_order?: 'asc' | 'desc'
}

interface ListFilesResponse {
  files: StorageFile[]
  total: number
  page: number
  per_page: number
}

// ===== Storage File =====
interface StorageFile {
  id: string
  tenant_id: string
  file_key: string
  original_name: string
  content_type: string
  size_bytes: number
  checksum_sha256?: string
  purpose: FilePurpose
  entity_type?: string
  entity_id?: string
  public_url?: string
  metadata: Record<string, any>
  version: number
  visibility: 'private' | 'tenant' | 'public'
  uploaded_by: string
  expires_at?: string
  created_at: string
  updated_at: string
}

// ===== Storage Config =====
interface StorageConfig {
  provider: StorageProvider

  // S3 Config
  s3?: {
    endpoint?: string
    bucket: string
    region: string
    access_key_id: string        // Masked in response
    path_style?: boolean
  }

  // Azure Config
  azure?: {
    account_name: string
    container: string
    endpoint?: string
  }

  // GCS Config
  gcs?: {
    project_id: string
    bucket: string
  }

  // Common
  cdn_base_url?: string
  path_prefix?: string
  enabled_for_purposes: FilePurpose[]

  // Status
  last_test_at?: string
  last_test_result?: {
    success: boolean
    error?: string
    latency_ms: number
  }
}

// ===== Storage Usage =====
interface StorageUsage {
  tenant_id: string
  total_bytes: number
  total_files: number
  usage_by_purpose: {
    [purpose: string]: {
      bytes: number
      files: number
    }
  }
  quota: {
    bytes: number            // -1 = unlimited
    bytes_used_percent: number
    files: number
    files_used_percent: number
  }
  last_calculated_at: string
}

// ===== Storage Policy =====
interface StoragePolicy {
  purpose: FilePurpose
  max_file_size_bytes?: number
  max_total_size_bytes?: number
  allowed_content_types?: string[]
  retention_days: number
  auto_compress: boolean
  compress_max_dimension?: number
  enable_versioning: boolean
  max_versions: number
  default_visibility: 'private' | 'tenant' | 'public'
}

// ===== Enums =====
type FilePurpose =
  | 'avatar'
  | 'logo'
  | 'evidence'
  | 'report'
  | 'backup'
  | 'scan'
  | 'import'
  | 'attachment'

type StorageProvider =
  | 'default'
  | 's3'
  | 'azure'
  | 'gcs'
  | 'local'
  | 'custom'
```

### 7.3 Error Responses

```typescript
interface StorageError {
  error: {
    code: StorageErrorCode
    message: string
    details?: Record<string, any>
  }
}

type StorageErrorCode =
  | 'QUOTA_EXCEEDED'           // Storage quota exceeded
  | 'FILE_TOO_LARGE'           // File exceeds size limit
  | 'INVALID_FILE_TYPE'        // Content type not allowed
  | 'PROVIDER_NOT_ALLOWED'     // Provider not available for plan
  | 'FEATURE_NOT_ALLOWED'      // Feature requires upgrade
  | 'PROVIDER_ERROR'           // Storage provider error
  | 'FILE_NOT_FOUND'           // File doesn't exist
  | 'UPLOAD_EXPIRED'           // Presigned URL expired
  | 'CHECKSUM_MISMATCH'        // File integrity check failed
  | 'PERMISSION_DENIED'        // Insufficient permissions
  | 'CONFIG_INVALID'           // Invalid storage configuration
  | 'CONNECTION_FAILED'        // Provider connection failed
```

---

## 7. Storage Providers

### 8.1 Provider Interface

```go
// provider/interface.go

package provider

import (
    "context"
    "io"
    "time"
)

type Provider interface {
    // Identity
    Name() string

    // URL Generation
    GenerateUploadURL(ctx context.Context, opts UploadURLOptions) (*UploadURL, error)
    GenerateDownloadURL(ctx context.Context, key string, ttl time.Duration) (string, error)

    // Direct Operations
    Upload(ctx context.Context, key string, reader io.Reader, opts UploadOptions) error
    Download(ctx context.Context, key string) (io.ReadCloser, error)
    Delete(ctx context.Context, key string) error

    // Metadata
    Exists(ctx context.Context, key string) (bool, error)
    GetMetadata(ctx context.Context, key string) (*ObjectMetadata, error)
    ListObjects(ctx context.Context, prefix string, opts ListOptions) (*ObjectList, error)

    // Health
    TestConnection(ctx context.Context) error

    // Cleanup
    Close() error
}

type UploadURLOptions struct {
    Key         string
    ContentType string
    SizeBytes   int64
    TTL         time.Duration
    Metadata    map[string]string
}

type UploadURL struct {
    URL     string
    Method  string
    Headers map[string]string
    Expires time.Time
}

type UploadOptions struct {
    ContentType string
    Metadata    map[string]string
}

type ObjectMetadata struct {
    Key          string
    Size         int64
    ContentType  string
    ETag         string
    LastModified time.Time
    Metadata     map[string]string
}

type ListOptions struct {
    MaxKeys      int
    Continuation string
}

type ObjectList struct {
    Objects      []ObjectMetadata
    Continuation string
    IsTruncated  bool
}
```

### 8.2 Provider Implementations

```go
// provider/s3.go - S3-Compatible Provider (AWS, R2, MinIO)

package provider

import (
    "github.com/aws/aws-sdk-go-v2/service/s3"
)

type S3Provider struct {
    client     *s3.Client
    presigner  *s3.PresignClient
    bucket     string
    pathPrefix string
    cdnBaseURL string
}

func NewS3Provider(cfg S3Config) (*S3Provider, error) {
    // Initialize AWS SDK client
    awsCfg, err := config.LoadDefaultConfig(context.Background(),
        config.WithRegion(cfg.Region),
        config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
            cfg.AccessKeyID,
            cfg.SecretAccessKey,
            "",
        )),
    )
    if err != nil {
        return nil, err
    }

    // Custom endpoint for R2, MinIO, etc.
    if cfg.Endpoint != "" {
        awsCfg.BaseEndpoint = aws.String(cfg.Endpoint)
    }

    client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
        o.UsePathStyle = cfg.PathStyle
    })

    return &S3Provider{
        client:     client,
        presigner:  s3.NewPresignClient(client),
        bucket:     cfg.Bucket,
        pathPrefix: cfg.PathPrefix,
        cdnBaseURL: cfg.CDNBaseURL,
    }, nil
}

func (p *S3Provider) GenerateUploadURL(ctx context.Context, opts UploadURLOptions) (*UploadURL, error) {
    key := p.pathPrefix + opts.Key

    req, err := p.presigner.PresignPutObject(ctx, &s3.PutObjectInput{
        Bucket:      aws.String(p.bucket),
        Key:         aws.String(key),
        ContentType: aws.String(opts.ContentType),
    }, s3.WithPresignExpires(opts.TTL))

    if err != nil {
        return nil, err
    }

    return &UploadURL{
        URL:     req.URL,
        Method:  req.Method,
        Headers: map[string]string{"Content-Type": opts.ContentType},
        Expires: time.Now().Add(opts.TTL),
    }, nil
}

// ... other methods
```

### 8.3 Provider Factory

```go
// provider/factory.go

package provider

type Factory struct {
    defaultProvider Provider
}

func NewFactory(defaultProvider Provider) *Factory {
    return &Factory{defaultProvider: defaultProvider}
}

func (f *Factory) GetProvider(ctx context.Context, config *StorageConfig) (Provider, error) {
    if config == nil {
        return f.defaultProvider, nil
    }

    switch config.Provider {
    case "default":
        return f.defaultProvider, nil

    case "s3":
        return NewS3Provider(S3Config{
            Endpoint:        config.S3Endpoint,
            Bucket:          config.S3Bucket,
            Region:          config.S3Region,
            AccessKeyID:     config.S3AccessKeyID,
            SecretAccessKey: config.S3SecretAccessKey,
            PathStyle:       config.S3PathStyle,
            PathPrefix:      config.PathPrefix,
            CDNBaseURL:      config.CDNBaseURL,
        })

    case "azure":
        return NewAzureProvider(AzureConfig{
            AccountName: config.AzureAccountName,
            Container:   config.AzureContainer,
            SASToken:    config.AzureSASToken,
            Endpoint:    config.AzureEndpoint,
            PathPrefix:  config.PathPrefix,
            CDNBaseURL:  config.CDNBaseURL,
        })

    case "gcs":
        return NewGCSProvider(GCSConfig{
            ProjectID:       config.GCSProjectID,
            Bucket:          config.GCSBucket,
            CredentialsJSON: config.GCSCredentialsJSON,
            PathPrefix:      config.PathPrefix,
            CDNBaseURL:      config.CDNBaseURL,
        })

    case "local":
        return NewLocalProvider(LocalConfig{
            BasePath: config.LocalBasePath,
            ServeURL: config.LocalServeURL,
        })

    case "custom":
        return NewCustomProvider(CustomConfig{
            UploadEndpoint:   config.CustomUploadEndpoint,
            DownloadEndpoint: config.CustomDownloadEndpoint,
            DeleteEndpoint:   config.CustomDeleteEndpoint,
            AuthHeader:       config.CustomAuthHeader,
        })

    default:
        return nil, fmt.Errorf("unknown provider: %s", config.Provider)
    }
}
```

---

## 8. Frontend Implementation

### 9.1 Feature Structure

```
ui/src/features/storage/
├── api/
│   ├── use-storage.ts            # Upload/download hooks
│   ├── use-storage-config.ts     # Config management hooks
│   ├── use-storage-policies.ts   # Policy management hooks
│   ├── use-storage-usage.ts      # Usage stats hooks
│   └── index.ts
├── components/
│   ├── file-uploader.tsx         # Generic file uploader
│   ├── image-uploader.tsx        # Image-specific with preview
│   ├── evidence-uploader.tsx     # Multi-file evidence upload
│   ├── storage-config-form.tsx   # Provider configuration
│   ├── storage-policy-editor.tsx # Policy settings
│   ├── storage-usage-card.tsx    # Usage stats display
│   ├── file-list.tsx             # File browser
│   └── upload-progress.tsx       # Progress indicator
├── types/
│   └── storage.types.ts
├── lib/
│   ├── upload-utils.ts           # Client-side helpers
│   └── file-validation.ts        # Validation utilities
└── index.ts
```

### 9.2 Core Hook: useStorage

```typescript
// features/storage/api/use-storage.ts

import { useState, useCallback } from 'react'
import { post, get, del } from '@/lib/api/client'

interface UploadOptions {
  purpose: FilePurpose
  entityType?: string
  entityId?: string
  metadata?: Record<string, any>
  onProgress?: (percent: number) => void
}

interface UseStorageReturn {
  upload: (file: File, options: UploadOptions) => Promise<StorageFile>
  uploadMultiple: (files: File[], options: UploadOptions) => Promise<StorageFile[]>
  getDownloadURL: (fileId: string) => Promise<string>
  deleteFile: (fileId: string) => Promise<void>
  isUploading: boolean
  progress: number
  error: Error | null
}

export function useStorage(): UseStorageReturn {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<Error | null>(null)

  const upload = useCallback(async (file: File, options: UploadOptions): Promise<StorageFile> => {
    setIsUploading(true)
    setProgress(0)
    setError(null)

    try {
      // 1. Request upload URL
      const uploadUrlResponse = await post<RequestUploadURLResponse>(
        '/api/v1/storage/upload-url',
        {
          purpose: options.purpose,
          filename: file.name,
          content_type: file.type,
          size_bytes: file.size,
          entity_type: options.entityType,
          entity_id: options.entityId,
          metadata: options.metadata,
        }
      )

      // 2. Upload directly to storage
      await uploadToStorage(
        uploadUrlResponse.upload_url,
        file,
        {
          method: uploadUrlResponse.upload_method,
          headers: uploadUrlResponse.upload_headers,
          onProgress: (percent) => {
            setProgress(percent)
            options.onProgress?.(percent)
          },
        }
      )

      // 3. Confirm upload
      const confirmResponse = await post<ConfirmUploadResponse>(
        '/api/v1/storage/confirm',
        {
          file_id: uploadUrlResponse.file_id,
          checksum_sha256: await calculateChecksum(file),
        }
      )

      return confirmResponse.file
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Upload failed')
      setError(error)
      throw error
    } finally {
      setIsUploading(false)
    }
  }, [])

  const uploadMultiple = useCallback(async (
    files: File[],
    options: UploadOptions
  ): Promise<StorageFile[]> => {
    const results: StorageFile[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const result = await upload(file, {
        ...options,
        onProgress: (fileProgress) => {
          const totalProgress = ((i + fileProgress / 100) / files.length) * 100
          options.onProgress?.(totalProgress)
        },
      })
      results.push(result)
    }

    return results
  }, [upload])

  const getDownloadURL = useCallback(async (fileId: string): Promise<string> => {
    const response = await get<GetDownloadURLResponse>(
      `/api/v1/storage/download/${fileId}`
    )
    return response.download_url
  }, [])

  const deleteFile = useCallback(async (fileId: string): Promise<void> => {
    await del(`/api/v1/storage/files/${fileId}`)
  }, [])

  return {
    upload,
    uploadMultiple,
    getDownloadURL,
    deleteFile,
    isUploading,
    progress,
    error,
  }
}

// Helper: Upload to presigned URL with progress
async function uploadToStorage(
  url: string,
  file: File,
  options: {
    method: string
    headers: Record<string, string>
    onProgress?: (percent: number) => void
  }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100)
        options.onProgress?.(percent)
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`))
      }
    })

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed: network error'))
    })

    xhr.open(options.method, url)

    Object.entries(options.headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value)
    })

    xhr.send(file)
  })
}

// Helper: Calculate SHA-256 checksum
async function calculateChecksum(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
```

### 9.3 Storage Config UI

```typescript
// features/storage/components/storage-config-form.tsx

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { useStorageConfig, useUpdateStorageConfig, useTestStorageConnection } from '../api'
import { PermissionGate } from '@/lib/permissions'

const s3ConfigSchema = z.object({
  endpoint: z.string().url().optional(),
  bucket: z.string().min(3).max(63),
  region: z.string().min(1),
  access_key_id: z.string().min(16),
  secret_access_key: z.string().min(1),
  path_prefix: z.string().optional(),
  cdn_base_url: z.string().url().optional(),
})

export function StorageConfigForm() {
  const { config, isLoading } = useStorageConfig()
  const { updateConfig, isUpdating } = useUpdateStorageConfig()
  const { testConnection, isTesting } = useTestStorageConnection()

  const [provider, setProvider] = useState<string>('default')

  const form = useForm({
    resolver: zodResolver(s3ConfigSchema),
    defaultValues: config?.s3 || {},
  })

  useEffect(() => {
    if (config) {
      setProvider(config.provider)
      if (config.s3) {
        form.reset(config.s3)
      }
    }
  }, [config])

  const handleTest = async () => {
    try {
      const result = await testConnection()
      if (result.success) {
        toast.success(`Connection successful (${result.latency_ms}ms)`)
      } else {
        toast.error(`Connection failed: ${result.error}`)
      }
    } catch (err) {
      toast.error('Failed to test connection')
    }
  }

  const handleSave = async (data: z.infer<typeof s3ConfigSchema>) => {
    try {
      await updateConfig({
        provider,
        s3: provider === 's3' ? data : undefined,
      })
      toast.success('Storage configuration saved')
    } catch (err) {
      toast.error('Failed to save configuration')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Provider Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Storage Provider</label>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">
                Default (Managed by OpenCTEM)
              </SelectItem>
              <PermissionGate
                permission="storage:config:write"
                checkPlanFeature="byob"
              >
                <SelectItem value="s3">Amazon S3 / S3-Compatible</SelectItem>
                <SelectItem value="azure">Azure Blob Storage</SelectItem>
                <SelectItem value="gcs">Google Cloud Storage</SelectItem>
              </PermissionGate>
            </SelectContent>
          </Select>
        </div>

        {/* S3 Configuration */}
        {provider === 's3' && (
          <div className="space-y-4 p-4 border rounded-lg">
            <h4 className="font-medium">S3 Configuration</h4>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label>Endpoint (optional)</label>
                <Input
                  placeholder="https://xxx.r2.cloudflarestorage.com"
                  {...form.register('endpoint')}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for AWS S3
                </p>
              </div>

              <div className="space-y-2">
                <label>Bucket Name</label>
                <Input
                  placeholder="my-bucket"
                  {...form.register('bucket')}
                />
              </div>

              <div className="space-y-2">
                <label>Region</label>
                <Input
                  placeholder="us-east-1"
                  {...form.register('region')}
                />
              </div>

              <div className="space-y-2">
                <label>Access Key ID</label>
                <Input
                  type="password"
                  {...form.register('access_key_id')}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label>Secret Access Key</label>
                <Input
                  type="password"
                  {...form.register('secret_access_key')}
                />
              </div>

              <div className="space-y-2">
                <label>Path Prefix (optional)</label>
                <Input
                  placeholder="openctem/"
                  {...form.register('path_prefix')}
                />
              </div>

              <div className="space-y-2">
                <label>CDN URL (optional)</label>
                <Input
                  placeholder="https://cdn.example.com"
                  {...form.register('cdn_base_url')}
                />
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={isTesting || provider === 'default'}
          >
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>

          <PermissionGate permission="storage:config:write">
            <Button
              onClick={form.handleSubmit(handleSave)}
              disabled={isUpdating}
            >
              {isUpdating ? 'Saving...' : 'Save Configuration'}
            </Button>
          </PermissionGate>
        </div>

        {/* Connection Status */}
        {config?.last_test_result && (
          <div className={`p-3 rounded-lg ${
            config.last_test_result.success
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}>
            <p className="text-sm">
              Last test: {config.last_test_result.success ? 'Success' : 'Failed'}
              {config.last_test_result.latency_ms &&
                ` (${config.last_test_result.latency_ms}ms)`
              }
            </p>
            {config.last_test_result.error && (
              <p className="text-sm mt-1">{config.last_test_result.error}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

### 9.4 Storage Settings Page

```typescript
// app/(dashboard)/settings/storage/page.tsx

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RouteGuard } from '@/features/auth/components/route-guard'
import { StorageConfigForm } from '@/features/storage/components/storage-config-form'
import { StoragePoliciesEditor } from '@/features/storage/components/storage-policies-editor'
import { StorageUsageCard } from '@/features/storage/components/storage-usage-card'
import { Permission } from '@/lib/permissions'

export default function StorageSettingsPage() {
  return (
    <RouteGuard permission={Permission.StorageConfigRead}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Storage Settings</h1>
          <p className="text-muted-foreground">
            Configure file storage for your organization
          </p>
        </div>

        <Tabs defaultValue="config">
          <TabsList>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="policies">Policies</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="mt-4">
            <StorageConfigForm />
          </TabsContent>

          <TabsContent value="policies" className="mt-4">
            <StoragePoliciesEditor />
          </TabsContent>

          <TabsContent value="usage" className="mt-4">
            <StorageUsageCard />
          </TabsContent>
        </Tabs>
      </div>
    </RouteGuard>
  )
}
```

---

## 9. Security Considerations

### 10.1 Data Security

| Concern | Mitigation |
|---------|------------|
| Credentials storage | Encrypted with tenant-specific keys in database |
| Data in transit | HTTPS only, presigned URLs with short TTL |
| Data at rest | Enable encryption on storage buckets |
| Tenant isolation | Separate paths per tenant, access control checks |
| URL leakage | Short-lived presigned URLs (15 min default) |
| Content validation | MIME type verification, virus scanning |

### 10.2 Access Control Checklist

- [ ] Verify user authentication on all endpoints
- [ ] Check tenant membership
- [ ] Validate permissions (read/write/delete)
- [ ] Verify entity access (e.g., user can access finding)
- [ ] Check quota before upload
- [ ] Validate provider is allowed for plan
- [ ] Audit all access attempts

### 10.3 Credential Handling

```go
// Encrypt credentials before storing
func (s *StorageConfigService) SaveConfig(ctx context.Context, config *StorageConfig) error {
    // Get tenant encryption key
    key, err := s.keyManager.GetTenantKey(ctx, config.TenantID)
    if err != nil {
        return err
    }

    // Encrypt sensitive fields
    if config.S3SecretAccessKey != "" {
        encrypted, err := s.crypto.Encrypt(key, config.S3SecretAccessKey)
        if err != nil {
            return err
        }
        config.S3SecretAccessKeyEncrypted = encrypted
        config.S3SecretAccessKey = "" // Clear plaintext
    }

    return s.repo.Save(ctx, config)
}
```

---

## 10. Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Backend:**
- [ ] Database migrations for storage tables
- [ ] Storage domain entities and repository
- [ ] Provider interface definition
- [ ] Default provider (Cloudflare R2) implementation
- [ ] Basic Storage Service (upload, download, delete)
- [ ] Presigned URL generation

**Frontend:**
- [ ] Storage types definition
- [ ] Basic useStorage hook
- [ ] Update avatar upload to use new system

**Permissions:**
- [ ] Add storage permissions to constants
- [ ] Add to default role configurations

### Phase 2: S3 BYOB (Week 3-4)

**Backend:**
- [ ] S3 provider implementation
- [ ] Storage config API endpoints
- [ ] Config encryption/decryption
- [ ] Connection testing endpoint
- [ ] Provider factory and routing

**Frontend:**
- [ ] Storage config form (S3)
- [ ] Connection test UI
- [ ] useStorageConfig hook

### Phase 3: Quotas & Policies (Week 5-6)

**Backend:**
- [ ] Plan limits integration
- [ ] Quota manager implementation
- [ ] Usage tracking service
- [ ] Storage policies API
- [ ] Policy enforcement

**Frontend:**
- [ ] Storage usage component
- [ ] Policy editor
- [ ] Quota exceeded handling

### Phase 4: Advanced Features (Week 7-8)

**Backend:**
- [ ] Azure Blob provider
- [ ] GCS provider
- [ ] File versioning
- [ ] Retention policy jobs
- [ ] Audit logging

**Frontend:**
- [ ] Azure/GCS config forms
- [ ] File browser component
- [ ] Version history view
- [ ] Audit log view

### Phase 5: Integration (Week 9-10)

**Backend:**
- [ ] Evidence upload for findings
- [ ] Report export storage
- [ ] Scan artifact storage
- [ ] Backup storage

**Frontend:**
- [ ] Evidence uploader integration
- [ ] Report download integration
- [ ] Scan results storage

### Phase 6: Polish & Optimization (Week 11-12)

- [ ] Performance optimization
- [ ] Error handling improvements
- [ ] Documentation
- [ ] Monitoring dashboards
- [ ] Load testing
- [ ] Security audit

---

## 11. Migration Strategy

### 12.1 Avatar Migration

```sql
-- Step 1: Create storage_files entries for existing avatars
INSERT INTO storage_files (
    tenant_id,
    file_key,
    original_name,
    content_type,
    size_bytes,
    purpose,
    entity_type,
    entity_id,
    storage_url,
    public_url,
    uploaded_by,
    created_at
)
SELECT
    u.tenant_id,
    'avatars/user-' || u.id || '/avatar.jpg',
    'avatar.jpg',
    'image/jpeg',
    LENGTH(u.avatar_url) * 3 / 4, -- Approximate size from base64
    'avatar',
    'user',
    u.id,
    u.avatar_url, -- Keep base64 temporarily
    NULL,
    u.id,
    u.created_at
FROM users u
WHERE u.avatar_url IS NOT NULL
  AND u.avatar_url != '';

-- Step 2: Background job to migrate base64 to storage provider
-- (Run asynchronously)

-- Step 3: Update users table to use file reference
ALTER TABLE users ADD COLUMN avatar_file_id UUID REFERENCES storage_files(id);

-- Step 4: After migration complete, drop old column
-- ALTER TABLE users DROP COLUMN avatar_url;
```

### 12.2 Tenant Logo Migration

Similar process for tenant logos in branding settings.

---

## 12. Testing Strategy

### 13.1 Unit Tests

```go
// service/storage_service_test.go

func TestStorageService_RequestUploadURL(t *testing.T) {
    tests := []struct {
        name    string
        req     UploadRequest
        wantErr error
    }{
        {
            name: "valid avatar upload",
            req: UploadRequest{
                Purpose:     "avatar",
                Filename:    "photo.jpg",
                ContentType: "image/jpeg",
                SizeBytes:   1024 * 1024,
            },
            wantErr: nil,
        },
        {
            name: "file too large",
            req: UploadRequest{
                Purpose:     "avatar",
                Filename:    "huge.jpg",
                ContentType: "image/jpeg",
                SizeBytes:   100 * 1024 * 1024,
            },
            wantErr: ErrFileTooLarge,
        },
        {
            name: "invalid content type",
            req: UploadRequest{
                Purpose:     "avatar",
                Filename:    "script.exe",
                ContentType: "application/x-executable",
                SizeBytes:   1024,
            },
            wantErr: ErrInvalidFileType,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // ... test implementation
        })
    }
}
```

### 13.2 Integration Tests

```go
func TestStorageIntegration_UploadDownloadDelete(t *testing.T) {
    // Setup test tenant and user
    tenant := createTestTenant(t)
    user := createTestUser(t, tenant.ID)

    // Test upload flow
    uploadURL, err := storageService.RequestUploadURL(ctx, UploadRequest{
        Purpose:     "evidence",
        Filename:    "screenshot.png",
        ContentType: "image/png",
        SizeBytes:   1024,
        EntityType:  "finding",
        EntityID:    findingID,
    })
    require.NoError(t, err)

    // Upload file to presigned URL
    err = uploadToURL(uploadURL, testFileContent)
    require.NoError(t, err)

    // Confirm upload
    file, err := storageService.ConfirmUpload(ctx, uploadURL.FileID, "")
    require.NoError(t, err)

    // Download and verify
    downloadURL, err := storageService.GetDownloadURL(ctx, file.ID)
    require.NoError(t, err)

    content, err := downloadFromURL(downloadURL)
    require.NoError(t, err)
    assert.Equal(t, testFileContent, content)

    // Delete
    err = storageService.DeleteFile(ctx, file.ID)
    require.NoError(t, err)

    // Verify deleted
    _, err = storageService.GetFile(ctx, file.ID)
    assert.ErrorIs(t, err, ErrFileNotFound)
}
```

### 13.3 E2E Tests

```typescript
// e2e/storage.spec.ts

import { test, expect } from '@playwright/test'

test.describe('Storage', () => {
  test('upload avatar', async ({ page }) => {
    await page.goto('/account')

    // Upload file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./test-fixtures/avatar.jpg')

    // Wait for upload
    await expect(page.locator('.upload-progress')).toBeVisible()
    await expect(page.locator('.upload-success')).toBeVisible()

    // Verify avatar displayed
    const avatar = page.locator('.avatar-image')
    await expect(avatar).toHaveAttribute('src', /avatars\//)
  })
})
```

---

## 13. Monitoring & Observability

### 14.1 Metrics

```go
// metrics/storage_metrics.go

var (
    uploadTotal = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "storage_uploads_total",
            Help: "Total number of file uploads",
        },
        []string{"tenant_id", "purpose", "status"},
    )

    uploadBytes = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "storage_upload_bytes_total",
            Help: "Total bytes uploaded",
        },
        []string{"tenant_id", "purpose"},
    )

    uploadDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "storage_upload_duration_seconds",
            Help:    "Upload duration in seconds",
            Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 30},
        },
        []string{"purpose"},
    )

    storageUsageBytes = promauto.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "storage_usage_bytes",
            Help: "Current storage usage in bytes",
        },
        []string{"tenant_id", "purpose"},
    )
)
```

### 14.2 Alerts

```yaml
# alerts/storage.yaml

groups:
  - name: storage
    rules:
      - alert: StorageQuotaNearLimit
        expr: storage_usage_bytes / storage_quota_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Tenant {{ $labels.tenant_id }} near storage quota"

      - alert: StorageUploadFailureRate
        expr: rate(storage_uploads_total{status="error"}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High storage upload failure rate"

      - alert: StorageProviderDown
        expr: storage_provider_health == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Storage provider {{ $labels.provider }} is down"
```

### 14.3 Dashboards

Key metrics to display:
- Upload/download counts and rates
- Bytes transferred
- Error rates by type
- Latency percentiles
- Storage usage per tenant
- Quota utilization
- Provider health status

---

## Appendix

### A. Environment Variables

```bash
# Default Storage (Platform-managed R2)
STORAGE_DEFAULT_ENDPOINT=https://xxx.r2.cloudflarestorage.com
STORAGE_DEFAULT_BUCKET.openctem-storage
STORAGE_DEFAULT_ACCESS_KEY_ID=xxx
STORAGE_DEFAULT_SECRET_ACCESS_KEY=xxx
STORAGE_DEFAULT_REGION=auto

# CDN
STORAGE_CDN_BASE_URL=https://cdn.openctem.io

# Encryption
STORAGE_ENCRYPTION_KEY=xxx  # For credential encryption

# Limits
STORAGE_MAX_FILE_SIZE_MB=500
STORAGE_PRESIGN_TTL_MINUTES=15
```

### B. Related Documentation

- [Permission System](./access-control-flows-and-data.md)
- [API Guidelines](../backend/api-reference.md)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-24
**Next Review**: After Phase 1 implementation
{% endraw %}
