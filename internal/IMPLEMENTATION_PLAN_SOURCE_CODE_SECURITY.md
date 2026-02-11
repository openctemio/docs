# Source Code Security - Implementation Plan

> **Project**: OpenCTEM Platform
> **Goal**: Complete source code security scanning with CI/CD integration
> **Timeline**: Release-critical feature
> **Last Updated**: January 28, 2026 (Finding Activities completed, AI Triage plan added, Module assessment completed)

---

## Executive Summary

Mục tiêu là hoàn thiện tính năng **Source Code Security Scanning** để:
1. Scan source code (SAST, SCA, Secrets, Container)
2. Embed vào CI/CD GitLab thành các steps riêng biệt
3. Tracking finding lifecycle với activity log
4. Hiển thị context đầy đủ (branch, commit, PR, author)
5. Component/dependency management với vulnerability tracking
6. Developer view cho từng tenant

---

## Existing System Analysis

### Finding Comments (Đã có - Migration 007)

**Table**: `finding_comments`
- **Mục đích**: User comments + Status change records
- **Features**:
  - Regular comments (editable by author)
  - Status change comments (immutable, `is_status_change=true`)
  - Counter: `findings.comments_count`

**Files**:
- Domain: `internal/domain/vulnerability/finding_comment.go`
- Service: `internal/app/finding_comment_service.go`
- Handler: Endpoints trong `vulnerability_handler.go`

### Relationship với Finding Activities (Mới)

| Aspect | finding_comments | finding_activities |
|--------|-----------------|-------------------|
| **Purpose** | User discussion | System audit trail |
| **Editable** | Yes (comments only) | Never (append-only) |
| **Content** | Text content | Structured JSONB |
| **UI** | Comment thread | Timeline/Activity log |
| **Trigger** | User action | Any change (user/system) |

**Integration Strategy**:
- Khi `finding_comment` được tạo → auto-create `finding_activity` type=`comment_added`
- Khi `finding_comment` được update → auto-create `finding_activity` type=`comment_updated`
- Khi `finding_comment` được delete → auto-create `finding_activity` type=`comment_deleted`
- Status change comments đã có `is_status_change=true` → cũng tạo activity riêng

---

## Part 1: Architecture Overview

### 1.1 Architecture Decision: Reuse Existing Modules (No New Modules)

After thorough analysis of the existing codebase, we concluded that **NO NEW MODULES are needed** for source code security. The existing infrastructure already covers 95% of requirements:

| Domain | Already Has | Supports |
|--------|-------------|----------|
| `vulnerability` | SAST/SCA/Secret/IaC source types | Finding workflow, comments, activities |
| `component` | Dependency tracking, PURL support | SBOM, vulnerability mapping |
| `asset` | Repository asset type | Repository management |
| `findings` UI | Complete feature | All finding views, detail pages |
| `Agent` | CLI + scanning | One-shot mode for CI/CD |

**What's NOT needed:**
- ❌ New `source-security` API module - Use existing `vulnerability` + `findings` endpoints
- ❌ New `code-security` UI feature - Enhance existing `findings` feature
- ❌ New CLI tool `openctem` - Enhance existing `agent` binary

**What IS needed:**
- ✅ Enhancements to existing modules (source context, AI triage)
- ✅ Agent flags (`-auto-ci`, `-fail-on`, `-output sarif`)
- ✅ CI templates for GitLab/GitHub

### 1.2 Naming Convention (Simplified)

| Component | Name | Mô tả |
|-----------|------|-------|
| CLI Tool | `agent` | Existing binary, add CI flags |
| SDK Package | `pkg/scanners/` | Scanner implementations (existing) |
| API Domain | `vulnerability` | Existing domain with findings |
| UI Feature | `findings` | Existing feature with enhancements |

### 1.3 System Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GitLab CI/CD                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐ │
│  │  SAST    │   │   SCA    │   │ Secrets  │   │Container │   │  IaC     │ │
│  │ semgrep  │   │  trivy   │   │ gitleaks │   │  trivy   │   │ checkov  │ │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘ │
│       │              │              │              │              │        │
│       └──────────────┴──────────────┴──────────────┴──────────────┘        │
│                                     │                                       │
│                            ┌────────▼────────┐                             │
│                            │  OpenCTEM CLI   │                             │
│                            │  (scan + push)  │                             │
│                            └────────┬────────┘                             │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │
                            ┌─────────▼─────────┐
                            │   OpenCTEM API    │
                            │  /api/v1/ingest   │
                            └─────────┬─────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
┌───────▼───────┐           ┌────────▼────────┐          ┌─────────▼─────────┐
│   Findings    │           │   Components    │          │     Assets        │
│   + Activity  │           │   + SBOM        │          │   (Repositories)  │
└───────────────┘           └─────────────────┘          └───────────────────┘
```

---

## Part 2: Database Schema

### 2.1 New Tables

```sql
-- 000115_finding_activity.up.sql
-- Append-only audit trail for finding lifecycle (similar to asset_state_history pattern)
CREATE TABLE finding_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,

    -- Activity details
    activity_type VARCHAR(50) NOT NULL,
    -- Types: created, status_changed, severity_changed, assigned, unassigned,
    --        triage_updated, resolved, reopened, comment_added, comment_updated,
    --        comment_deleted, scan_detected, auto_resolved, linked, sla_warning, sla_breach

    -- Actor (nullable for system actions)
    actor_id UUID REFERENCES users(id),
    actor_type VARCHAR(20) NOT NULL DEFAULT 'user', -- user, system, scanner, integration

    -- Change details (JSONB for flexibility)
    changes JSONB NOT NULL DEFAULT '{}',
    -- Example structures:
    -- status_changed: {"old": "open", "new": "resolved"}
    -- assigned: {"assignee_id": "uuid", "assignee_name": "John Doe"}
    -- comment_added: {"comment_id": "uuid", "preview": "First 100 chars..."}
    -- scan_detected: {"scan_id": "uuid", "scanner": "semgrep", "branch": "main"}

    -- Source context (where did this action come from)
    source VARCHAR(50), -- api, ci, webhook, scheduled, manual
    source_metadata JSONB, -- pipeline_id, job_id, etc.

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

    -- NO updated_at - this table is APPEND-ONLY (immutable audit trail)
);

-- Indexes optimized for common queries
CREATE INDEX idx_finding_activities_finding ON finding_activities(finding_id);
CREATE INDEX idx_finding_activities_tenant_created ON finding_activities(tenant_id, created_at DESC);
CREATE INDEX idx_finding_activities_type ON finding_activities(activity_type);
CREATE INDEX idx_finding_activities_actor ON finding_activities(actor_id) WHERE actor_id IS NOT NULL;

-- Partial indexes for common filters
CREATE INDEX idx_finding_activities_status_changes ON finding_activities(finding_id, created_at DESC)
    WHERE activity_type IN ('status_changed', 'resolved', 'reopened');
CREATE INDEX idx_finding_activities_assignments ON finding_activities(finding_id, created_at DESC)
    WHERE activity_type IN ('assigned', 'unassigned');

-- Comment: This table complements finding_comments (which stores user discussions)
-- finding_activities is for structured audit trail, finding_comments is for threaded discussions

-- 000116_finding_source_context.up.sql
-- Extend findings table with source context
ALTER TABLE findings ADD COLUMN IF NOT EXISTS source_context JSONB;

-- Source context structure:
-- {
--   "repository": {
--     "url": "https://gitlab.com/org/repo",
--     "name": "repo",
--     "default_branch": "main"
--   },
--   "branch": {
--     "name": "feature/auth",
--     "is_default": false,
--     "is_protected": true
--   },
--   "commit": {
--     "sha": "abc123...",
--     "short_sha": "abc123",
--     "message": "Add authentication",
--     "author_name": "John Doe",
--     "author_email": "john@example.com",
--     "committed_at": "2026-01-28T10:00:00Z"
--   },
--   "merge_request": {
--     "iid": 123,
--     "title": "Add authentication feature",
--     "url": "https://gitlab.com/org/repo/-/merge_requests/123",
--     "state": "merged",
--     "author": "john"
--   },
--   "file": {
--     "path": "src/auth/login.go",
--     "line_start": 42,
--     "line_end": 45,
--     "snippet": "password := request.Password\ndb.Query(\"SELECT * FROM users WHERE password = '\" + password + \"'\")"
--   },
--   "pipeline": {
--     "id": 456,
--     "url": "https://gitlab.com/org/repo/-/pipelines/456",
--     "ref": "feature/auth",
--     "status": "success"
--   }
-- }

CREATE INDEX idx_findings_source_context ON findings USING GIN (source_context);

-- 000117_components_enhanced.up.sql
-- Enhance components table for better dependency tracking
ALTER TABLE components ADD COLUMN IF NOT EXISTS latest_version VARCHAR(100);
ALTER TABLE components ADD COLUMN IF NOT EXISTS update_available BOOLEAN DEFAULT false;
ALTER TABLE components ADD COLUMN IF NOT EXISTS versions_behind INT DEFAULT 0;
ALTER TABLE components ADD COLUMN IF NOT EXISTS license VARCHAR(100);
ALTER TABLE components ADD COLUMN IF NOT EXISTS license_risk VARCHAR(20); -- low, medium, high, critical
ALTER TABLE components ADD COLUMN IF NOT EXISTS is_direct BOOLEAN DEFAULT true; -- direct vs transitive
ALTER TABLE components ADD COLUMN IF NOT EXISTS parent_component_id UUID REFERENCES components(id);
ALTER TABLE components ADD COLUMN IF NOT EXISTS depth INT DEFAULT 0; -- dependency tree depth
ALTER TABLE components ADD COLUMN IF NOT EXISTS last_published_at TIMESTAMPTZ;
ALTER TABLE components ADD COLUMN IF NOT EXISTS repository_url VARCHAR(500);
ALTER TABLE components ADD COLUMN IF NOT EXISTS homepage_url VARCHAR(500);

-- Component vulnerabilities junction (for detailed vuln mapping)
CREATE TABLE IF NOT EXISTS component_vulnerabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,

    -- Vulnerability details
    cve_id VARCHAR(50),
    ghsa_id VARCHAR(50),           -- GitHub Security Advisory
    severity VARCHAR(20) NOT NULL,
    cvss_score DECIMAL(3,1),
    cvss_vector VARCHAR(100),

    -- Fix information
    fixed_in_version VARCHAR(100),
    is_fixable BOOLEAN DEFAULT false,

    -- Metadata
    title VARCHAR(500),
    description TEXT,
    references JSONB,              -- Array of URLs
    published_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, component_id, cve_id)
);

CREATE INDEX idx_component_vulns_component ON component_vulnerabilities(component_id);
CREATE INDEX idx_component_vulns_cve ON component_vulnerabilities(cve_id);
CREATE INDEX idx_component_vulns_severity ON component_vulnerabilities(severity);

-- 000118_repository_settings.up.sql
-- Repository-level security settings
CREATE TABLE repository_security_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE, -- repository asset

    -- Scan settings
    sast_enabled BOOLEAN DEFAULT true,
    sca_enabled BOOLEAN DEFAULT true,
    secret_scan_enabled BOOLEAN DEFAULT true,
    container_scan_enabled BOOLEAN DEFAULT false,
    iac_scan_enabled BOOLEAN DEFAULT false,

    -- Branch settings
    default_branch VARCHAR(100) DEFAULT 'main',
    protected_branches JSONB DEFAULT '[]',  -- branches that block on findings
    scan_branches JSONB DEFAULT '["*"]',    -- branches to scan

    -- Severity thresholds
    block_on_critical BOOLEAN DEFAULT true,
    block_on_high BOOLEAN DEFAULT false,
    block_on_medium BOOLEAN DEFAULT false,
    min_block_severity VARCHAR(20) DEFAULT 'critical',

    -- Notifications
    notify_on_new_finding BOOLEAN DEFAULT true,
    notify_channels JSONB DEFAULT '[]',

    -- Custom rules
    custom_semgrep_rules JSONB,
    excluded_paths JSONB DEFAULT '["**/test/**", "**/vendor/**", "**/node_modules/**"]',
    excluded_rules JSONB DEFAULT '[]',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, asset_id)
);

-- 000119_scan_runs.up.sql
-- Track individual scan runs for history
CREATE TABLE scan_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    asset_id UUID REFERENCES assets(id),  -- repository

    -- Scan info
    scan_type VARCHAR(50) NOT NULL,       -- sast, sca, secrets, container, iac
    scanner VARCHAR(50) NOT NULL,          -- semgrep, trivy, gitleaks, etc.
    scanner_version VARCHAR(50),

    -- Source context
    branch VARCHAR(255),
    commit_sha VARCHAR(100),
    merge_request_iid INT,
    pipeline_id VARCHAR(100),
    triggered_by VARCHAR(50),              -- ci, scheduled, manual, webhook

    -- Results summary
    status VARCHAR(20) NOT NULL DEFAULT 'running', -- running, completed, failed, cancelled
    findings_total INT DEFAULT 0,
    findings_new INT DEFAULT 0,
    findings_fixed INT DEFAULT 0,
    findings_by_severity JSONB,            -- {"critical": 1, "high": 5, ...}

    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INT,

    -- Error handling
    error_message TEXT,
    error_details JSONB,

    -- Raw output (optional, for debugging)
    raw_output_url VARCHAR(500),           -- S3/GCS URL to full output

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scan_runs_tenant ON scan_runs(tenant_id);
CREATE INDEX idx_scan_runs_asset ON scan_runs(asset_id);
CREATE INDEX idx_scan_runs_branch ON scan_runs(branch);
CREATE INDEX idx_scan_runs_created ON scan_runs(created_at DESC);
CREATE INDEX idx_scan_runs_status ON scan_runs(status);
```

### 2.2 Update Existing Tables

```sql
-- Extend findings with additional fields
ALTER TABLE findings ADD COLUMN IF NOT EXISTS introduced_at TIMESTAMPTZ;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS introduced_by VARCHAR(255);  -- commit sha
ALTER TABLE findings ADD COLUMN IF NOT EXISTS introduced_in_branch VARCHAR(255);
ALTER TABLE findings ADD COLUMN IF NOT EXISTS fixed_at TIMESTAMPTZ;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS fixed_by VARCHAR(255);       -- commit sha
ALTER TABLE findings ADD COLUMN IF NOT EXISTS fixed_in_branch VARCHAR(255);
ALTER TABLE findings ADD COLUMN IF NOT EXISTS age_days INT GENERATED ALWAYS AS (
    EXTRACT(DAY FROM (COALESCE(fixed_at, NOW()) - introduced_at))
) STORED;
```

---

## Part 3: API Design

### 3.1 New Endpoints

```yaml
# Finding Activity
GET    /api/v1/findings/{id}/activities      # List activities for a finding
POST   /api/v1/findings/{id}/activities      # Add activity (comment, etc.)

# Finding Source Context
GET    /api/v1/findings/{id}/source          # Get source context (file, commit, MR)
GET    /api/v1/findings/{id}/code            # Get code snippet with context

# Components
GET    /api/v1/components                     # List components with filters
GET    /api/v1/components/{id}               # Component detail with vulnerabilities
GET    /api/v1/components/{id}/vulnerabilities # Vulnerabilities for component
GET    /api/v1/components/{id}/dependents    # What depends on this component
GET    /api/v1/components/outdated           # List outdated components
POST   /api/v1/components/sbom               # Export SBOM (SPDX/CycloneDX)

# Repository Security
GET    /api/v1/repositories/{id}/security    # Security overview for repo
GET    /api/v1/repositories/{id}/settings    # Security settings
PUT    /api/v1/repositories/{id}/settings    # Update security settings
GET    /api/v1/repositories/{id}/branches    # Branches with finding counts
GET    /api/v1/repositories/{id}/scans       # Scan history

# Scan Runs
GET    /api/v1/scan-runs                      # List scan runs
GET    /api/v1/scan-runs/{id}                # Scan run detail
GET    /api/v1/scan-runs/{id}/findings       # Findings from this scan

# Developer View
GET    /api/v1/my/repositories               # Repos assigned to current user
GET    /api/v1/my/findings                   # Findings in my repos
GET    /api/v1/my/findings/summary           # Summary for developer dashboard

# CI/CD Integration
POST   /api/v1/ci/scan                        # Trigger scan from CI
POST   /api/v1/ci/report                      # Upload scan results
GET    /api/v1/ci/status/{pipeline_id}       # Check scan status
GET    /api/v1/ci/gate/{pipeline_id}         # Get pass/fail gate status
```

### 3.2 API Response Examples

```json
// GET /api/v1/findings/{id}/activities
{
  "data": [
    {
      "id": "uuid",
      "type": "status_change",
      "action": "changed status from 'open' to 'in_progress'",
      "user": {
        "id": "uuid",
        "name": "John Doe",
        "email": "john@example.com",
        "avatar_url": "..."
      },
      "old_value": {"status": "open"},
      "new_value": {"status": "in_progress"},
      "created_at": "2026-01-28T10:00:00Z"
    },
    {
      "id": "uuid",
      "type": "comment",
      "action": "added a comment",
      "user": {...},
      "new_value": {
        "comment": "Investigating this issue, looks like a false positive"
      },
      "created_at": "2026-01-28T11:00:00Z"
    },
    {
      "id": "uuid",
      "type": "assignment",
      "action": "assigned to Jane Smith",
      "user": {...},
      "old_value": {"assignee": null},
      "new_value": {"assignee": {"id": "uuid", "name": "Jane Smith"}},
      "created_at": "2026-01-28T12:00:00Z"
    }
  ],
  "meta": {
    "total": 3,
    "page": 1,
    "per_page": 50
  }
}

// GET /api/v1/findings/{id}/source
{
  "data": {
    "repository": {
      "id": "uuid",
      "name": "backend-api",
      "url": "https://gitlab.com/org/backend-api",
      "default_branch": "main"
    },
    "branch": {
      "name": "feature/auth",
      "is_default": false,
      "is_protected": false
    },
    "commit": {
      "sha": "abc123def456...",
      "short_sha": "abc123d",
      "message": "Add user authentication\n\nImplement JWT-based auth flow",
      "author": {
        "name": "John Doe",
        "email": "john@example.com"
      },
      "committed_at": "2026-01-27T15:30:00Z"
    },
    "merge_request": {
      "iid": 123,
      "title": "Add user authentication",
      "url": "https://gitlab.com/org/backend-api/-/merge_requests/123",
      "state": "merged",
      "merged_at": "2026-01-28T09:00:00Z",
      "author": {
        "name": "John Doe",
        "username": "johnd"
      }
    },
    "file": {
      "path": "internal/auth/handler.go",
      "line_start": 42,
      "line_end": 45,
      "language": "go",
      "permalink": "https://gitlab.com/org/backend-api/-/blob/abc123d/internal/auth/handler.go#L42-45"
    },
    "pipeline": {
      "id": "456789",
      "url": "https://gitlab.com/org/backend-api/-/pipelines/456789",
      "status": "success"
    }
  }
}

// GET /api/v1/findings/{id}/code
{
  "data": {
    "file_path": "internal/auth/handler.go",
    "language": "go",
    "start_line": 38,
    "end_line": 50,
    "highlight_start": 42,
    "highlight_end": 45,
    "code": "func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {\n\tvar req LoginRequest\n\tif err := json.NewDecoder(r.Body).Decode(&req); err != nil {\n\t\thttp.Error(w, err.Error(), 400)\n\t\treturn\n\t}\n\t\n\t// VULNERABLE: SQL Injection\n\tquery := \"SELECT * FROM users WHERE email = '\" + req.Email + \"'\"\n\trows, err := h.db.Query(query)\n\t...\n}",
    "annotations": [
      {
        "line": 42,
        "type": "vulnerability",
        "message": "SQL Injection vulnerability: user input directly concatenated into query"
      }
    ],
    "data_flow": [
      {
        "step": 1,
        "location": "line 35",
        "description": "User input received from request body"
      },
      {
        "step": 2,
        "location": "line 42",
        "description": "Tainted data flows into SQL query string"
      },
      {
        "step": 3,
        "location": "line 43",
        "description": "Query executed with unsanitized input"
      }
    ]
  }
}

// GET /api/v1/components/{id}
{
  "data": {
    "id": "uuid",
    "name": "lodash",
    "version": "4.17.15",
    "ecosystem": "npm",
    "purl": "pkg:npm/lodash@4.17.15",

    "latest_version": "4.17.21",
    "update_available": true,
    "versions_behind": 6,

    "license": "MIT",
    "license_risk": "low",

    "is_direct": true,
    "depth": 0,

    "vulnerability_summary": {
      "critical": 0,
      "high": 1,
      "medium": 2,
      "low": 0,
      "total": 3
    },

    "vulnerabilities": [
      {
        "cve_id": "CVE-2021-23337",
        "severity": "high",
        "cvss_score": 7.2,
        "title": "Command Injection in lodash",
        "fixed_in_version": "4.17.21",
        "is_fixable": true
      }
    ],

    "repository_url": "https://github.com/lodash/lodash",
    "homepage_url": "https://lodash.com",
    "last_published_at": "2021-02-20T00:00:00Z",

    "used_in": [
      {
        "asset_id": "uuid",
        "asset_name": "backend-api",
        "file_path": "package.json"
      }
    ]
  }
}

// GET /api/v1/my/findings/summary (Developer Dashboard)
{
  "data": {
    "total_findings": 45,
    "by_severity": {
      "critical": 2,
      "high": 8,
      "medium": 20,
      "low": 15
    },
    "by_status": {
      "open": 30,
      "in_progress": 10,
      "resolved": 5
    },
    "by_type": {
      "vulnerability": 25,
      "secret": 5,
      "misconfiguration": 10,
      "license": 5
    },
    "repositories": [
      {
        "id": "uuid",
        "name": "backend-api",
        "findings_count": 25,
        "critical_count": 2,
        "last_scan": "2026-01-28T10:00:00Z"
      },
      {
        "id": "uuid",
        "name": "frontend-app",
        "findings_count": 20,
        "critical_count": 0,
        "last_scan": "2026-01-28T09:30:00Z"
      }
    ],
    "recent_findings": [...],
    "trends": {
      "last_7_days": {
        "new": 10,
        "fixed": 15,
        "net_change": -5
      },
      "last_30_days": {
        "new": 30,
        "fixed": 45,
        "net_change": -15
      }
    }
  }
}
```

---

## Part 4: Agent CLI (Existing Tool - Enhancement)

> **Note**: OpenCTEM đã có Agent CLI (`agent`) với khả năng scanning. Phần này mô tả các enhancements cần thiết, KHÔNG phải tạo CLI mới.

### 4.1 Kiến trúc hiện tại

```
┌─────────────────────────────────────────────────────────────────┐
│                         Agent (Go Binary)                        │
├─────────────────────────────────────────────────────────────────┤
│  One-Shot Mode (CI/CD)                                          │
│    agent -tool semgrep -target ./src -push                      │
│    agent -tools semgrep,gitleaks,trivy -target . -push          │
├─────────────────────────────────────────────────────────────────┤
│  Daemon Mode (Long-running)                                     │
│    agent -daemon -enable-commands -config config.yaml           │
├─────────────────────────────────────────────────────────────────┤
│  Platform Mode (Shared Infrastructure)                          │
│    agent -platform -enable-vulnscan -enable-secrets             │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SDK (Go Library)                         │
│  pkg/scanners/  → Semgrep, Gitleaks, Trivy, Nuclei              │
│  pkg/ctis/      → CTIS report format                            │
│  pkg/core/      → Scanner interface                             │
│  pkg/handler/   → Console + Remote handlers                     │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Existing Commands (Đã có)

```bash
# One-shot scanning (CI/CD mode)
agent -tool semgrep -target ./src -push
agent -tools semgrep,gitleaks,trivy -target . -push -comments

# Tool management
agent -list-tools              # List available scanners
agent -check-tools             # Check tool installation status
agent -install-tools           # Interactively install tools
agent -version                 # Show version

# Configuration
agent -config config.yaml      # Use config file
```

### 4.3 Enhancements Needed

#### 4.3.1 Source Context (NEW)
```bash
# Auto-detect from CI environment
agent -tool semgrep -target . -push -auto-ci

# Manual override
agent -tool semgrep -target . -push \
  -branch feature/auth \
  -commit abc123 \
  -mr 456 \
  -pipeline 789
```

**CI Environment Variables to auto-detect:**
| Variable | GitLab | GitHub | Description |
|----------|--------|--------|-------------|
| Branch | `CI_COMMIT_REF_NAME` | `GITHUB_REF_NAME` | Branch name |
| Commit | `CI_COMMIT_SHA` | `GITHUB_SHA` | Commit SHA |
| MR/PR | `CI_MERGE_REQUEST_IID` | `GITHUB_PR_NUMBER` | MR/PR number |
| Pipeline | `CI_PIPELINE_ID` | `GITHUB_RUN_ID` | Pipeline ID |
| Repo URL | `CI_PROJECT_URL` | `GITHUB_SERVER_URL` | Repository URL |

#### 4.3.2 Security Gate (NEW)
```bash
# Exit code 1 if critical/high findings found
agent -tool semgrep -target . -push -fail-on high

# Exit code 1 if any critical found
agent -tools semgrep,gitleaks -target . -fail-on critical
```

**Exit codes:**
- `0`: No findings above threshold
- `1`: Findings above threshold found (blocks CI)
- `2`: Scanner error

#### 4.3.3 Output Formats (ENHANCE)
```bash
# SARIF output (for GitLab Security Dashboard)
agent -tool semgrep -target . -output sarif -file gl-sast-report.json

# JSON output
agent -tool semgrep -target . -output json

# Table output (default, for humans)
agent -tool semgrep -target . -output table
```

### 4.4 GitLab CI Integration

```yaml
# .gitlab-ci.yml
include:
  - remote: 'https://cdn.openctem.io/ci/gitlab/v1/templates.yml'

variables:
  API_URL: https://api.openctem.io
  API_KEY: $OPENCTEM_API_TOKEN

stages:
  - test
  - security
  - deploy

# Option 1: All-in-one scan (using agent binary)
security-scan:
  stage: security
  image: ghcr.io/openctemio/agent:latest
  script:
    - agent -tools semgrep,gitleaks,trivy-fs
        -target .
        -push
        -auto-ci
        -fail-on high
        -output sarif
        -file gl-sast-report.json
  artifacts:
    reports:
      sast: gl-sast-report.json
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

# Option 2: Separate scan jobs (recommended for parallel execution)
sast-scan:
  stage: security
  image: ghcr.io/openctemio/agent:latest
  script:
    - agent -tool semgrep -target . -push -auto-ci -fail-on critical
  allow_failure: false

sca-scan:
  stage: security
  image: ghcr.io/openctemio/agent:latest
  script:
    - agent -tool trivy-fs -target . -push -auto-ci -fail-on high
  allow_failure: true

secret-scan:
  stage: security
  image: ghcr.io/openctemio/agent:latest
  script:
    - agent -tool gitleaks -target . -push -auto-ci -fail-on high
  allow_failure: false

container-scan:
  stage: security
  image: ghcr.io/openctemio/agent:latest
  script:
    - agent -tool trivy-image -target $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA -push -auto-ci -fail-on critical
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

# Option 3: Using templates (extends pattern)
.openctem-base:
  image: ghcr.io/openctemio/agent:latest
  variables:
    API_URL: https://api.openctem.io
    API_KEY: $OPENCTEM_API_TOKEN

.openctem-sast:
  extends: .openctem-base
  script:
    - agent -tool semgrep -target . -push -auto-ci -fail-on ${FAIL_ON:-critical}

.openctem-sca:
  extends: .openctem-base
  script:
    - agent -tool trivy-fs -target . -push -auto-ci -fail-on ${FAIL_ON:-high}

.openctem-secrets:
  extends: .openctem-base
  script:
    - agent -tool gitleaks -target . -push -auto-ci -fail-on ${FAIL_ON:-high}
```

### 4.3 Configuration File

```yaml
# .openctem.yml
version: "1"

# API configuration
api:
  url: https://api.openctem.io
  # token from environment: OPENCTEM_API_TOKEN

# Repository settings
repository:
  id: auto  # Auto-detect or specify UUID

# Scan configuration
scans:
  sast:
    enabled: true
    tool: semgrep
    config: p/default  # Semgrep ruleset
    exclude:
      - "**/test/**"
      - "**/vendor/**"
      - "**/*_test.go"

  sca:
    enabled: true
    tool: trivy
    ignore_unfixed: false

  secrets:
    enabled: true
    tool: gitleaks
    config: .gitleaks.toml  # Optional custom config

  container:
    enabled: false
    tool: trivy

  iac:
    enabled: true
    tool: checkov
    frameworks:
      - terraform
      - kubernetes
      - dockerfile

# Severity thresholds
thresholds:
  fail_on: high          # Fail CI if >= high
  warn_on: medium        # Warning if >= medium

# Notifications
notifications:
  slack:
    webhook: ${SLACK_WEBHOOK}
    on: [new_critical, new_high]

# Branch rules
branches:
  main:
    fail_on: medium      # Stricter for main branch
  develop:
    fail_on: high
  "feature/*":
    fail_on: critical

# Ignore rules
ignore:
  findings:
    - rule: generic.secrets.security.detected-generic-api-key
      reason: "False positive - test API key"
      expires: "2026-06-01"
    - cve: CVE-2021-12345
      reason: "Not exploitable in our context"
```

---

## Part 5: UI Enhancements (No New Feature Module)

> **Decision**: Enhance existing `features/findings` instead of creating new `features/code-security`

### 5.1 Enhancements to Existing Structure

```
src/features/findings/             # EXISTING - Enhance
├── api/
│   ├── use-findings-api.ts        # EXISTING
│   ├── use-finding-activities-api.ts  # ✅ ADDED - Activity hook
│   └── use-finding-source-api.ts  # TODO - Source context hook
├── components/
│   ├── detail/
│   │   ├── activity-panel.tsx     # EXISTING ✅
│   │   ├── source-context-panel.tsx  # TODO - New component
│   │   └── ...
│   └── ...
└── types/
    └── finding.types.ts           # EXISTING - Has Activity types

src/features/components/           # EXISTING - For SBOM/SCA
├── api/
│   └── use-components-api.ts      # TODO - Enhance
└── components/
    └── ...

src/features/assets/               # EXISTING - For repositories
├── api/
│   └── use-assets-api.ts          # EXISTING
└── components/
    └── ...
```

**Why NOT create `features/code-security`:**
1. Findings already display code scan results
2. Components already track dependencies
3. Assets already manage repositories
4. Creating new feature would duplicate data models and API calls

### 5.2 New Components (Add to Existing Features)

#### Finding Activity Timeline

```tsx
// FindingActivityTimeline.tsx
interface Activity {
  id: string;
  type: 'status_change' | 'comment' | 'assignment' | 'severity_change' | 'scan_detected' | 'auto_resolved';
  action: string;
  user?: {
    name: string;
    avatar_url: string;
  };
  old_value?: any;
  new_value?: any;
  created_at: string;
}

const FindingActivityTimeline: React.FC<{ findingId: string }> = ({ findingId }) => {
  const { data: activities } = useFindingActivities(findingId);

  return (
    <div className="activity-timeline">
      {activities.map(activity => (
        <div key={activity.id} className="activity-item">
          <ActivityIcon type={activity.type} />
          <div className="activity-content">
            <span className="activity-user">{activity.user?.name || 'System'}</span>
            <span className="activity-action">{activity.action}</span>
            <span className="activity-time">{formatRelativeTime(activity.created_at)}</span>
          </div>
          {activity.type === 'comment' && (
            <div className="activity-comment">{activity.new_value.comment}</div>
          )}
        </div>
      ))}

      <CommentInput findingId={findingId} onSubmit={handleAddComment} />
    </div>
  );
};
```

#### Source Context Display

```tsx
// FindingSourceContext.tsx
const FindingSourceContext: React.FC<{ findingId: string }> = ({ findingId }) => {
  const { data: source } = useFindingSource(findingId);

  return (
    <Card>
      <CardHeader>
        <h3>Source Context</h3>
      </CardHeader>
      <CardContent>
        {/* Repository & Branch */}
        <div className="source-row">
          <RepositoryIcon />
          <a href={source.repository.url}>{source.repository.name}</a>
          <BranchBadge name={source.branch.name} isDefault={source.branch.is_default} />
        </div>

        {/* Commit */}
        <div className="source-row">
          <CommitIcon />
          <a href={`${source.repository.url}/-/commit/${source.commit.sha}`}>
            {source.commit.short_sha}
          </a>
          <span className="commit-message">{source.commit.message.split('\n')[0]}</span>
          <UserAvatar name={source.commit.author.name} />
          <span className="commit-time">{formatRelativeTime(source.commit.committed_at)}</span>
        </div>

        {/* Merge Request */}
        {source.merge_request && (
          <div className="source-row">
            <MergeRequestIcon />
            <a href={source.merge_request.url}>
              !{source.merge_request.iid} {source.merge_request.title}
            </a>
            <MRStateBadge state={source.merge_request.state} />
          </div>
        )}

        {/* File Location */}
        <div className="source-row">
          <FileIcon />
          <a href={source.file.permalink}>
            {source.file.path}:{source.file.line_start}
          </a>
        </div>
      </CardContent>
    </Card>
  );
};
```

#### Code Snippet Viewer

```tsx
// CodeSnippet.tsx
const CodeSnippet: React.FC<{ findingId: string }> = ({ findingId }) => {
  const { data: code } = useFindingCode(findingId);

  return (
    <Card>
      <CardHeader>
        <h3>Vulnerable Code</h3>
        <div className="code-actions">
          <CopyButton text={code.code} />
          <a href={code.permalink} target="_blank">View in GitLab</a>
        </div>
      </CardHeader>
      <CardContent>
        <SyntaxHighlighter
          language={code.language}
          startingLineNumber={code.start_line}
          highlightLines={range(code.highlight_start, code.highlight_end)}
        >
          {code.code}
        </SyntaxHighlighter>

        {/* Annotations */}
        {code.annotations.map(annotation => (
          <div key={annotation.line} className="code-annotation">
            <WarningIcon />
            <span>Line {annotation.line}: {annotation.message}</span>
          </div>
        ))}

        {/* Data Flow */}
        {code.data_flow && (
          <DataFlowVisualization steps={code.data_flow} />
        )}
      </CardContent>
    </Card>
  );
};
```

#### Developer Dashboard

```tsx
// DeveloperDashboard.tsx
const DeveloperDashboard: React.FC = () => {
  const { data: summary } = useMyFindingsSummary();

  return (
    <div className="developer-dashboard">
      {/* Summary Stats */}
      <div className="stats-grid">
        <StatCard
          title="Total Findings"
          value={summary.total_findings}
          trend={summary.trends.last_7_days.net_change}
        />
        <StatCard
          title="Critical"
          value={summary.by_severity.critical}
          variant="critical"
        />
        <StatCard
          title="High"
          value={summary.by_severity.high}
          variant="high"
        />
        <StatCard
          title="Fixed This Week"
          value={summary.trends.last_7_days.fixed}
          variant="success"
        />
      </div>

      {/* My Repositories */}
      <Card>
        <CardHeader>
          <h3>My Repositories</h3>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Repository</TableCell>
                <TableCell>Findings</TableCell>
                <TableCell>Critical</TableCell>
                <TableCell>Last Scan</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.repositories.map(repo => (
                <TableRow key={repo.id}>
                  <TableCell>
                    <RepositoryIcon /> {repo.name}
                  </TableCell>
                  <TableCell>{repo.findings_count}</TableCell>
                  <TableCell>
                    {repo.critical_count > 0 ? (
                      <Badge variant="critical">{repo.critical_count}</Badge>
                    ) : (
                      <Badge variant="success">0</Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatRelativeTime(repo.last_scan)}</TableCell>
                  <TableCell>
                    <Button size="sm" onClick={() => navigate(`/repos/${repo.id}/security`)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Findings */}
      <Card>
        <CardHeader>
          <h3>Recent Findings</h3>
          <Button variant="link" onClick={() => navigate('/my/findings')}>
            View All
          </Button>
        </CardHeader>
        <CardContent>
          <FindingsList findings={summary.recent_findings} compact />
        </CardContent>
      </Card>

      {/* Trends Chart */}
      <Card>
        <CardHeader>
          <h3>Trends</h3>
        </CardHeader>
        <CardContent>
          <TrendChart data={summary.trends} />
        </CardContent>
      </Card>
    </div>
  );
};
```

### 5.3 Navigation (Use Existing Routes)

**No new routes needed** - Use existing navigation structure:

| Feature | Existing Route | Enhancement |
|---------|----------------|-------------|
| Findings list | `/findings` | Add source filter |
| Finding detail | `/findings/[id]` | Add activity, source context |
| Components | `/components` | Add vulnerability tab |
| Assets (Repos) | `/assets` | Filter by type=repository |
| Scans | `/scan-jobs` | Show code scan jobs |

**Optional future additions:**
- `/my/findings` - Developer's findings (filtered by assigned repos)
- `/my/repositories` - Developer's repos with security status

---

## Part 6: Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2) ✅ COMPLETED

**Backend:**
- [x] Database migrations (000115_finding_activities)
- [x] Finding activity domain & repository
- [x] Finding activity service with auto-tracking hooks
- [ ] Source context storage & retrieval
- [ ] Enhanced component model
- [ ] Scan runs tracking

**API:**
- [x] Finding activities endpoints (`GET /api/v1/findings/{id}/activities`)
- [x] Finding activity handler with pagination
- [ ] Source context endpoints
- [ ] Component enhanced endpoints
- [ ] Scan runs endpoints

**Frontend:**
- [x] `useFindingActivitiesApi` hook
- [x] ActivityPanel integration with real API data
- [x] Graceful fallback when API unavailable

**Integration:**
- [x] Auto-record activity on comment add/update/delete
- [x] Auto-record activity on status change
- [x] Activity service wired to VulnerabilityService

**SDK:**
- [ ] Update CTIS format for source context fields
- [ ] Add SourceContext struct to findings

**Agent:**
- [ ] Add `-auto-ci` flag for CI environment detection
- [ ] Add `-fail-on` flag for security gate
- [ ] Add `-output sarif` for GitLab Security Dashboard

### Phase 2: Agent Enhancement + CI Integration (Week 2-3)

**Agent Enhancements:**
- [ ] Implement `-auto-ci` flag (detect GitLab/GitHub env vars)
- [ ] Implement `-fail-on` security gate logic
- [ ] Add SARIF output format support
- [ ] Add source context to pushed results
- [ ] Create Docker image `ghcr.io/openctemio/agent:latest`

**SDK Updates:**
- [ ] Add SourceContext to CTIS Finding struct
- [ ] Update PushRIS to include source context

**CI Templates:**
- [ ] GitLab CI template file
- [ ] GitHub Actions workflow
- [ ] Documentation for CI setup

**Backend:**
- [ ] CI ingest endpoint enhancements (accept source context)
- [ ] Source context extraction from CI variables
- [ ] Scan run creation from CI

### Phase 3: UI - Finding Enhancement (Week 3-4)

**Frontend:**
- [ ] Finding activity timeline component
- [ ] Source context display component
- [ ] Code snippet viewer with highlighting
- [ ] Data flow visualization
- [ ] Finding detail page enhancements

### Phase 4: UI - Components & Developer View (Week 4-5)

**Frontend:**
- [ ] Components list page
- [ ] Component detail page with vulnerabilities
- [ ] Dependency tree visualization
- [ ] Developer dashboard
- [ ] My findings page
- [ ] Repository security overview

### Phase 5: Advanced Features (Week 5-6)

**Backend & Frontend:**
- [ ] SBOM export (SPDX, CycloneDX)
- [ ] Security gate logic
- [ ] MR/PR blocking integration
- [ ] Trend analytics
- [ ] Notification integration

### Phase 6: Polish & Documentation (Week 6)

- [ ] CLI documentation
- [ ] API documentation
- [ ] GitLab integration guide
- [ ] Developer onboarding guide
- [ ] Performance optimization
- [ ] E2E testing

---

## Part 6.5: AI Triage Feature

### Overview

Tính năng AI Triage cho phép tự động phân tích và đánh giá Finding bằng AI:
- Phân tích context của finding (code snippet, location, severity)
- Đề xuất status (Valid, False Positive, Duplicate, etc.)
- Đưa ra assessment chi tiết
- Ghi lại activity cho audit trail

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
│  ┌──────────────────┐                                           │
│  │ "Triage with AI" │  → POST /api/v1/findings/{id}/ai-triage   │
│  └──────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                         Backend API                              │
│  ┌──────────────────────────────────────────────────────────────┤
│  │ AITriageService                                              │
│  │  - TriggerTriage(findingID) → returns TriageResult           │
│  │  - ApplyTriage(triageID)    → updates finding                │
│  └──────────────────────────────────────────────────────────────┤
│                               ↓                                  │
│  ┌──────────────────────────────────────────────────────────────┤
│  │ AI Provider Abstraction                                      │
│  │  - Gemini (gemini-2.5-flash) - Primary                       │
│  │  - Claude (claude-3-sonnet)  - Fallback                      │
│  │  - OpenAI (gpt-4-turbo)      - Optional                      │
│  └──────────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Existing Systems                              │
│  - FindingActivityService (records ai_triage activity)          │
│  - VulnerabilityService (updates finding if approved)           │
│  - NotificationService (notifies on completion)                 │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema

```sql
-- 000120_ai_triage_results.up.sql
CREATE TABLE ai_triage_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,

    -- AI Configuration
    provider VARCHAR(50) NOT NULL,        -- gemini, claude, openai
    model VARCHAR(100) NOT NULL,          -- gemini-2.5-flash, claude-3-sonnet

    -- Input Context (snapshot at triage time)
    input_context JSONB NOT NULL,         -- Finding data sent to AI

    -- AI Response
    suggested_status VARCHAR(50),         -- valid, false_positive, duplicate, etc.
    suggested_severity VARCHAR(20),       -- critical, high, medium, low, info
    confidence DECIMAL(3,2),              -- 0.00 - 1.00
    assessment TEXT NOT NULL,             -- AI explanation/analysis
    recommendations JSONB,                -- Array of actionable suggestions
    risk_factors JSONB,                   -- Identified risk factors

    -- Application Status
    status VARCHAR(20) DEFAULT 'pending', -- pending, applied, rejected, expired
    applied_at TIMESTAMPTZ,
    applied_by UUID REFERENCES users(id),
    rejection_reason TEXT,

    -- Usage Metrics
    prompt_tokens INT,
    completion_tokens INT,
    latency_ms INT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_triage_finding ON ai_triage_results(finding_id);
CREATE INDEX idx_ai_triage_tenant ON ai_triage_results(tenant_id, created_at DESC);
CREATE INDEX idx_ai_triage_status ON ai_triage_results(status);
```

### API Endpoints

```yaml
# AI Triage
POST   /api/v1/findings/{id}/ai-triage           # Trigger AI triage
GET    /api/v1/findings/{id}/ai-triage           # Get latest triage result
GET    /api/v1/findings/{id}/ai-triage/{triage_id}  # Get specific result
POST   /api/v1/findings/{id}/ai-triage/{triage_id}/apply   # Apply suggestions
POST   /api/v1/findings/{id}/ai-triage/{triage_id}/reject  # Reject suggestions

# Batch Triage (future)
POST   /api/v1/findings/ai-triage/batch          # Triage multiple findings
GET    /api/v1/findings/ai-triage/batch/{batch_id}  # Get batch status
```

### API Response Examples

```json
// POST /api/v1/findings/{id}/ai-triage (Response)
{
  "data": {
    "id": "uuid",
    "finding_id": "uuid",
    "provider": "gemini",
    "model": "gemini-2.5-flash",
    "status": "pending",
    "suggested_status": "valid",
    "suggested_severity": "high",
    "confidence": 0.85,
    "assessment": "A JSON configuration file for win-acme is publicly accessible, revealing internal system configuration details. While no plaintext credentials were found, the exposure of this type of configuration information is sensitive and can aid attackers in reconnaissance and further exploitation.",
    "recommendations": [
      "Move configuration file outside web root",
      "Add access controls to sensitive files",
      "Review file permissions on deployment"
    ],
    "risk_factors": [
      "Configuration exposure",
      "Information disclosure",
      "Reconnaissance aid"
    ],
    "prompt_tokens": 1250,
    "completion_tokens": 450,
    "latency_ms": 2340,
    "created_at": "2026-01-28T10:00:00Z"
  }
}

// POST /api/v1/findings/{id}/ai-triage/{triage_id}/apply
{
  "data": {
    "success": true,
    "finding": {
      "id": "uuid",
      "status": "confirmed",  // Updated from AI suggestion
      "triage_status": "valid",
      "updated_at": "2026-01-28T10:05:00Z"
    },
    "activity": {
      "id": "uuid",
      "type": "ai_triage_applied",
      "actor": {...},
      "created_at": "2026-01-28T10:05:00Z"
    }
  }
}
```

### Activity Types for AI Triage

| Type | Description | Trigger |
|------|-------------|---------|
| `ai_triage` | AI analyzed the finding | User clicks "Triage with AI" |
| `ai_triage_applied` | User applied AI suggestions | User clicks "Apply" |
| `ai_triage_rejected` | User rejected AI suggestions | User clicks "Reject" |

### AI Provider Abstraction

```go
// internal/domain/ai/provider.go
type AIProvider interface {
    TriageFinding(ctx context.Context, input TriageInput) (*TriageResult, error)
    Name() string
    Model() string
}

type TriageInput struct {
    Finding     *vulnerability.Finding
    Snippet     string
    FilePath    string
    VulnDetails *vulnerability.Vulnerability // CVE info if available
    Context     map[string]interface{}
}

type TriageResult struct {
    SuggestedStatus   string
    SuggestedSeverity string
    Confidence        float64
    Assessment        string
    Recommendations   []string
    RiskFactors       []string
    PromptTokens      int
    CompletionTokens  int
    LatencyMs         int
}
```

### Frontend Components

```tsx
// ActivityPanel additions
interface AITriageAction {
  onClick: () => void;
  isLoading: boolean;
}

// New activity display for AI Triage
const AITriageActivity: React.FC<{ activity: Activity }> = ({ activity }) => (
  <div className="activity-ai-triage">
    <div className="ai-header">
      <Bot className="h-4 w-4" />
      <span>AI Assistant</span>
      <Badge>{activity.metadata?.model}</Badge>
    </div>
    <div className="ai-assessment">
      {activity.content}
    </div>
    {activity.metadata?.status === 'pending' && (
      <div className="ai-actions">
        <Button onClick={handleApply}>Apply</Button>
        <Button variant="outline" onClick={handleReject}>Reject</Button>
      </div>
    )}
  </div>
);
```

### Implementation Phases

**Phase AI-1: Core Infrastructure**
- [ ] Database migration (000120_ai_triage_results)
- [ ] Domain entity + repository
- [ ] AI Provider interface
- [ ] Gemini provider implementation

**Phase AI-2: Service & API**
- [ ] AITriageService
- [ ] HTTP handler
- [ ] Routes registration
- [ ] Activity integration

**Phase AI-3: Frontend**
- [ ] "Triage with AI" button in ActivityPanel
- [ ] Loading state + result display
- [ ] Apply/Reject actions
- [ ] Activity display for AI triage

**Phase AI-4: Advanced**
- [ ] Multiple providers (Claude, OpenAI)
- [ ] Batch triage
- [ ] Auto-triage on finding creation (configurable)
- [ ] Quality feedback loop
- [ ] Cost tracking per tenant

### Prompt Engineering

```
You are a security expert analyzing a vulnerability finding.

FINDING:
- Title: {title}
- Severity: {severity}
- File: {file_path}:{line}
- Tool: {tool_name}
- Rule: {rule_id}

CODE SNIPPET:
```{language}
{snippet}
```

CVE CONTEXT (if available):
{cve_description}

Please analyze this finding and provide:
1. VALIDITY: Is this a valid security issue? (valid/false_positive/needs_more_info)
2. SEVERITY ASSESSMENT: Do you agree with the severity? If not, what should it be?
3. CONFIDENCE: How confident are you in your assessment? (0.0-1.0)
4. ASSESSMENT: Detailed explanation of your analysis
5. RECOMMENDATIONS: Specific actionable steps to remediate
6. RISK FACTORS: Key risk factors identified

Respond in JSON format.
```

---

## Part 7: Technical Specifications

### 7.1 Activity Types

| Type | Description | Trigger |
|------|-------------|---------|
| `created` | Finding first detected | Scan ingestion |
| `status_change` | Status changed | User action |
| `severity_change` | Severity changed | User action |
| `assignment` | Assigned/unassigned | User action |
| `comment` | Comment added | User action |
| `triage` | Triage status changed | User action |
| `scan_confirmed` | Re-detected in scan | Scan ingestion |
| `auto_resolved` | Not found in scan | Scan ingestion |
| `linked` | Linked to issue/ticket | Integration |
| `sla_warning` | SLA deadline approaching | System |
| `sla_breach` | SLA breached | System |

### 7.2 Source Context Fields

| Field | Source | Description |
|-------|--------|-------------|
| `repository.url` | CI_PROJECT_URL | Repository URL |
| `repository.name` | CI_PROJECT_NAME | Repository name |
| `branch.name` | CI_COMMIT_REF_NAME | Branch name |
| `branch.is_default` | CI_DEFAULT_BRANCH | Is default branch |
| `commit.sha` | CI_COMMIT_SHA | Full commit SHA |
| `commit.message` | CI_COMMIT_MESSAGE | Commit message |
| `commit.author_name` | CI_COMMIT_AUTHOR | Commit author |
| `merge_request.iid` | CI_MERGE_REQUEST_IID | MR internal ID |
| `merge_request.title` | CI_MERGE_REQUEST_TITLE | MR title |
| `pipeline.id` | CI_PIPELINE_ID | Pipeline ID |
| `file.path` | Scanner output | File path |
| `file.line_start` | Scanner output | Start line |
| `file.line_end` | Scanner output | End line |

### 7.3 Scanner Output Mapping

| Scanner | Output Format | CTIS Mapping |
|---------|--------------|-------------|
| Semgrep | SARIF | findings[].vulnerability |
| Trivy (SCA) | JSON | findings[].vulnerability + dependencies |
| Trivy (Container) | JSON | findings[].vulnerability |
| Gitleaks | JSON | findings[].secret |
| Checkov | JSON | findings[].misconfiguration |

---

## Part 8: Success Metrics

### 8.1 KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Scan coverage | 100% repos | % repos with security scans |
| MTTR (Mean Time to Remediate) | < 7 days (critical) | Time from detection to resolution |
| False positive rate | < 10% | % findings marked as false positive |
| Developer adoption | > 80% | % developers using /my/security |
| CI pipeline pass rate | > 90% | % pipelines passing security gate |
| Finding age | < 30 days avg | Average age of open findings |

### 8.2 Feature Completion Checklist

**Core Features:**
- [x] Finding activity tracking ✅ Completed 2026-01-28
- [ ] Source context (branch, commit, MR)
- [ ] Code snippet display
- [ ] Component vulnerability tracking
- [ ] Developer dashboard

**CI/CD Integration (Agent-based):**
- [ ] Agent `-auto-ci` flag (env detection)
- [ ] Agent `-fail-on` security gate
- [ ] Agent SARIF output format
- [ ] GitLab CI templates
- [ ] GitHub Actions workflow
- [ ] MR/PR inline comments

**AI Triage:**
- [ ] AI Triage infrastructure
- [ ] Gemini provider integration
- [ ] Frontend "Triage with AI" button
- [ ] Apply/Reject workflow
- [ ] Batch triage

**Advanced:**
- [ ] SBOM export
- [ ] Trend analytics
- [ ] License compliance
- [ ] Auto-remediation suggestions

### 8.3 AI Triage KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Triage accuracy | > 85% | % AI triages confirmed by user |
| False positive detection | > 70% | % false positives correctly identified |
| Avg triage time | < 5s | Time from request to result |
| User acceptance rate | > 60% | % of AI suggestions applied |
| Cost per triage | < $0.01 | API cost per triage request |

---

## References

- [GitLab Security Scanning](https://docs.gitlab.com/user/application_security/sast/)
- [Best Practices for CI/CD Security](https://www.wiz.io/academy/ci-cd-security-best-practices)
- [Application Security Testing 2025](https://www.oligo.security/academy/application-security-testing-in-2025-techniques-best-practices)
- [SAST Integration Guide](https://www.jit.io/resources/app-security/integrating-sast-into-your-cicd-pipeline-a-step-by-step-guide)
- [GitLab Vulnerability Management](https://www.sentinelone.com/cybersecurity-101/cybersecurity/gitlab-vulnerability-management/)
