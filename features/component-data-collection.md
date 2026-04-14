---
layout: default
title: Component Data Collection
parent: Features
nav_order: 39
---

# Component Data Collection

How software components (SBOM) are collected, stored, and enriched in OpenCTEM.

---

## Architecture Overview

```
                              ┌──────────────────────────┐
                              │    OpenCTEM Platform      │
                              │                          │
  ┌─────────────┐            │  ┌────────────────────┐  │
  │  Scanner     │──CTIS────▶│  │   Ingest Service   │  │
  │  (Trivy,     │           │  │  /api/v1/ingest/   │  │
  │   npm-audit, │           │  │  ctis | sarif       │  │
  │   safety)    │           │  └─────────┬──────────┘  │
  └─────────────┘            │            │             │
                              │            ▼             │
  ┌─────────────┐            │  ┌────────────────────┐  │
  │  CI/CD       │──SARIF───▶│  │  Component         │  │
  │  Pipeline    │           │  │  Processor          │  │
  │  (GitHub     │           │  │  (upsert + link)    │  │
  │   Actions)   │           │  └─────────┬──────────┘  │
  └─────────────┘            │            │             │
                              │            ▼             │
  ┌─────────────┐            │  ┌────────────────────┐  │
  │  Manual      │──SBOM────▶│  │  SBOM Import       │  │
  │  Upload      │           │  │  /components/import │  │
  │  (CycloneDX, │           │  │  (CycloneDX, SPDX) │  │
  │   SPDX)      │           │  └─────────┬──────────┘  │
  └─────────────┘            │            │             │
                              │            ▼             │
  ┌─────────────┐            │  ┌────────────────────┐  │
  │  Recon Scan  │──Recon───▶│  │  Database          │  │
  │  (technology │           │  │  ┌──────────────┐  │  │
  │   detection) │           │  │  │ components   │  │  │
  └─────────────┘            │  │  │ (global)     │  │  │
                              │  │  ├──────────────┤  │  │
                              │  │  │ asset_       │  │  │
                              │  │  │ components   │  │  │
                              │  │  │ (tenant)     │  │  │
                              │  │  ├──────────────┤  │  │
                              │  │  │ component_   │  │  │
                              │  │  │ licenses     │  │  │
                              │  │  ├──────────────┤  │  │
                              │  │  │ findings     │  │  │
                              │  │  │ (CVE links)  │  │  │
                              │  │  └──────────────┘  │  │
                              │  └────────────────────┘  │
                              └──────────────────────────┘
```

---

## Data Sources

### 1. Scanner Ingestion (Automatic)

Scanners run on assets and report discovered dependencies via the SDK.

**Flow:**
```
Scanner agent → SDK adapter → CTIS format → POST /api/v1/ingest/ctis → ComponentProcessor
```

**Supported Scanners:**

| Scanner | Ecosystem | What it scans |
|---------|-----------|---------------|
| Trivy | npm, pip, go, maven, cargo, nuget | Container images, filesystems, repos |
| npm audit | npm | Node.js package-lock.json |
| pip-audit / safety | pypi | Python requirements.txt, Pipfile |
| OWASP Dependency-Check | maven, gradle | Java/Kotlin projects |
| govulncheck | go | Go modules (go.sum) |
| Bundler Audit | rubygems | Ruby Gemfile.lock |
| Composer audit | composer | PHP composer.lock |

**How it works:**
1. Platform Agent pulls scan job from queue
2. Agent runs scanner on target asset
3. Scanner output converted to CTIS (Common Tool Integration Standard) via SDK adapter
4. CTIS report sent to `POST /api/v1/ingest/ctis`
5. IngestService calls `ComponentProcessor.ProcessComponents()`
6. Each component: upsert into `components` table + link via `asset_components`

### 2. SARIF Import (CI/CD Integration)

CI/CD pipelines can send scan results in SARIF format.

**Flow:**
```
CI pipeline → Scanner → SARIF output → POST /api/v1/ingest/sarif → SARIF adapter → ComponentProcessor
```

**Supported CI/CD:**
- GitHub Actions (via OpenCTEM Action)
- GitLab CI (via OpenCTEM CLI)
- Jenkins (via webhook)

### 3. SBOM File Import (Manual Upload)

Users can upload existing SBOM files directly.

**Flow:**
```
User uploads file → POST /api/v1/components/import?asset_id=XXX → SBOMImportService
```

**Supported Formats:**

| Format | Versions | File Type |
|--------|----------|-----------|
| CycloneDX | 1.4, 1.5, 1.6 | JSON |
| SPDX | 2.2, 2.3 | JSON |

**API:**
```
POST /api/v1/components/import?asset_id={uuid}
Content-Type: application/json
Body: CycloneDX or SPDX JSON document
```

**Response:**
```json
{
  "format": "cyclonedx",
  "spec_version": "1.5",
  "components_total": 150,
  "components_imported": 148,
  "components_skipped": 2,
  "licenses_found": 120,
  "errors": ["lodash@4.17.15: duplicate link"]
}
```

**Auto-detection:** Format detected automatically from JSON structure:
- `bomFormat` field present → CycloneDX
- `spdxVersion` field present → SPDX

### 4. Recon Scan (Technology Detection)

External-facing technology detection via reconnaissance scans.

**Flow:**
```
Recon agent → POST /api/v1/ingest/recon → technologies extracted → components created
```

**What it detects:**
- Web frameworks (React, Angular, Vue, jQuery)
- Server software (nginx, Apache, IIS)
- CMS (WordPress, Drupal)
- JavaScript libraries

---

## Database Schema

### `components` (Global catalog)

Shared across all tenants. One entry per unique package.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| purl | VARCHAR(500) | Package URL (unique) |
| name | VARCHAR(255) | Package name |
| version | VARCHAR(100) | Version string |
| ecosystem | VARCHAR(50) | npm, pypi, maven, go, etc. |
| vulnerability_count | INT | Cached count (global) |
| metadata | JSONB | Extra data (latest_version, etc.) |

### `asset_components` (Tenant-scoped links)

Links components to assets within a tenant.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tenant_id | UUID | Tenant isolation |
| asset_id | UUID | Parent asset (repository, application) |
| component_id | UUID | Reference to components table |
| dependency_type | VARCHAR | direct, transitive, dev, optional |
| is_direct | BOOLEAN | Convenience flag |
| license | VARCHAR | License at time of scan |
| vulnerability_count | INT | Cached count (tenant-scoped) |
| has_known_vulnerabilities | BOOLEAN | Quick filter flag |
| highest_severity | VARCHAR | critical, high, medium, low |
| depth | INT | Dependency tree depth (0 = root) |
| parent_component_id | UUID | Parent in dependency tree |

### `component_licenses` (N:M)

Maps components to SPDX license identifiers.

### `findings` (Vulnerability links)

Findings with `component_id` set represent SCA vulnerabilities.

```sql
SELECT * FROM findings
WHERE component_id IS NOT NULL
  AND finding_type = 'vulnerability'
  AND source = 'sca'
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/ingest/ctis` | Scanner ingestion (automatic) |
| POST | `/api/v1/ingest/sarif` | SARIF import from CI/CD |
| POST | `/api/v1/ingest/recon` | Recon technology detection |
| POST | `/api/v1/components/import?asset_id=X` | SBOM file upload (CycloneDX/SPDX) |
| GET | `/api/v1/components` | List components (paginated) |
| GET | `/api/v1/components/stats` | Aggregated statistics |
| GET | `/api/v1/components/vulnerable` | Vulnerable components (paginated) |
| GET | `/api/v1/components/ecosystems` | Ecosystem breakdown |
| GET | `/api/v1/components/licenses` | License distribution |
| GET | `/api/v1/components/export` | Export all for SBOM generation |

---

## Component Lifecycle

```
1. DISCOVERED    Scanner/import detects component
                 → upsert into components + link asset_components

2. ENRICHED      Vulnerability data matched via CVE
                 → findings created with component_id
                 → vulnerability_count updated

3. MONITORED     Dashboard shows stats, severity breakdown
                 → /components/stats for overview
                 → /components/vulnerable for action items

4. REMEDIATED    Developer updates dependency
                 → next scan detects new version
                 → old findings auto-resolved
                 → component version updated
```

---

## Ecosystem Detection

Components are classified by ecosystem via PURL (Package URL):

| PURL Prefix | Ecosystem | Example |
|-------------|-----------|---------|
| `pkg:npm/` | npm | `pkg:npm/express@4.18.2` |
| `pkg:pypi/` | pypi | `pkg:pypi/django@4.2.10` |
| `pkg:maven/` | maven | `pkg:maven/org.springframework/spring-core@6.1.2` |
| `pkg:golang/` | go | `pkg:golang/golang.org/x/crypto@0.18.0` |
| `pkg:cargo/` | cargo | `pkg:cargo/serde@1.0.195` |
| `pkg:nuget/` | nuget | `pkg:nuget/Newtonsoft.Json@13.0.3` |
| `pkg:gem/` | rubygems | `pkg:gem/rails@7.1.3` |
| `pkg:composer/` | composer | `pkg:composer/laravel/framework@10.41.0` |

---

## Key Files

**Backend:**
- `api/internal/app/sbom_import_service.go` — SBOM file import (CycloneDX/SPDX)
- `api/internal/app/component_service.go` — Component CRUD + stats
- `api/internal/app/ingest/processor_components.go` — Scanner ingestion processor
- `api/internal/infra/postgres/component_repository.go` — Database queries
- `api/internal/infra/http/handler/component_handler.go` — HTTP endpoints

**Frontend:**
- `ui/src/app/(dashboard)/(discovery)/components/` — All component pages
- `ui/src/features/components/api/use-components-api.ts` — SWR hooks
- `ui/src/features/components/lib/transform-api.ts` — Data transformers
