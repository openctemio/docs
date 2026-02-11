# CTEM Framework Enhancement Plan

**Created:** 2026-01-27
**Status:** IN PROGRESS
**Last Updated:** 2026-01-27

---

## Phase 0 Implementation Status: ✅ 100% COMPLETE

### Database Migrations ✅
| Migration | File | Status |
|-----------|------|--------|
| 000107 | `asset_ctem_fields` | ✅ Created |
| 000108 | `finding_ctem_fields` | ✅ Created |
| 000109 | `services` | ✅ Created |
| 000110 | `asset_state_history` | ✅ Created |
| 000111 | `ctem_security_hardening` | ✅ Created |
| 000113 | `rename_services_to_asset_services` | ✅ **NEW** - Rename for consistency |

### Domain Entities ✅ Complete
| Component | Status | Notes |
|-----------|:------:|-------|
| `api/internal/domain/asset/entity.go` | ✅ | Added CTEM fields |
| `api/internal/domain/asset/value_objects.go` | ✅ | Added DataClassification, ComplianceFramework types |
| `api/internal/domain/asset/service_extension.go` | ✅ | **NEW** - AssetService entity with Protocol, ServiceType, ServiceState |
| `api/internal/domain/asset/service_extension_repository.go` | ✅ | **NEW** - AssetServiceRepository interface |
| `api/internal/domain/asset/state_history.go` | ✅ | **NEW** - AssetStateChange entity with StateChangeType, ChangeSource |
| `api/internal/domain/asset/state_history_repository.go` | ✅ | **NEW** - StateHistoryRepository interface |
| `api/internal/domain/vulnerability/finding.go` | ✅ | Added exposure vector, remediation context |
| `api/internal/domain/vulnerability/value_objects.go` | ✅ | Added ExposureVector, RemediationType, FixComplexity |
| `api/internal/infra/postgres/asset_repository.go` | ✅ | Updated for new CTEM fields |
| `sdk/pkg/ctis/types.go` | ✅ | Added ServiceInfo, FindingExposure, RemediationContext |

### Architecture Decision: Extension Pattern ✅

**Decision:** Services follow the same extension pattern as Repositories:
- `asset_repositories` table → `RepositoryExtension` entity
- `asset_services` table → `AssetService` entity

**Rationale:**
1. **Naming consistency**: `asset_services` matches `asset_repositories` pattern
2. Services are tightly coupled to assets (1:N relationship via `asset_id`)
3. Avoids over-engineering with separate domain package
4. Shares value objects (Exposure, Criticality)
5. Single package for attack surface management

**Structure:**
```
api/internal/domain/asset/
├── entity.go                       # Asset entity
├── value_objects.go                # Shared value objects
├── repository.go                   # Asset repository interface
├── repository_extension.go         # RepositoryExtension (asset_repositories)
├── service_extension.go            # AssetService (asset_services)
├── service_extension_repository.go # AssetServiceRepository interface
├── state_history.go                # AssetStateChange entity
└── state_history_repository.go     # StateHistoryRepository interface
```

**Database Tables:**
| Table | Domain Entity | Purpose |
|-------|---------------|---------|
| `assets` | `Asset` | Base asset data |
| `asset_repositories` | `RepositoryExtension` | Repository-specific data |
| `asset_services` | `AssetService` | Network service data |
| `asset_state_history` | `AssetStateChange` | Audit/change tracking |

### API Endpoints ✅ Complete
| Endpoint | Status | Description |
|----------|:------:|-------------|
| `GET /api/v1/assets/{id}/services` | ✅ | List services for asset |
| `POST /api/v1/assets/{id}/services` | ✅ | Add service to asset |
| `GET /api/v1/services` | ✅ | List all services |
| `GET /api/v1/services/{id}` | ✅ | Get service by ID |
| `PUT /api/v1/services/{id}` | ✅ | Update service |
| `DELETE /api/v1/services/{id}` | ✅ | Delete service |
| `GET /api/v1/services/public` | ✅ | List internet-exposed services |
| `GET /api/v1/services/stats` | ✅ | Get service statistics |
| `GET /api/v1/assets/{id}/state-history` | ✅ | Get asset state changes |
| `GET /api/v1/state-history` | ✅ | List all state changes |
| `GET /api/v1/state-history/{id}` | ✅ | Get state change by ID |
| `GET /api/v1/state-history/shadow-it` | ✅ | Shadow IT candidates |
| `GET /api/v1/state-history/appearances` | ✅ | Recent appearances |
| `GET /api/v1/state-history/disappearances` | ✅ | Recent disappearances |
| `GET /api/v1/state-history/exposure-changes` | ✅ | Exposure changes |
| `GET /api/v1/state-history/newly-exposed` | ✅ | Newly exposed assets |
| `GET /api/v1/state-history/compliance` | ✅ | Compliance changes |
| `GET /api/v1/state-history/timeline` | ✅ | Activity timeline |
| `GET /api/v1/state-history/stats` | ✅ | State history statistics |

### API Handlers ✅ Complete
| Component | Status | Notes |
|-----------|:------:|-------|
| `api/internal/infra/http/handler/asset_service_handler.go` | ✅ | Full CRUD, list, stats |
| `api/internal/infra/http/handler/asset_state_history_handler.go` | ✅ | List, shadow IT, exposure, compliance |
| `api/internal/infra/http/routes/assets.go` | ✅ | Routes registered |

### Repository Implementations ✅ Complete
| Component | Status | Notes |
|-----------|:------:|-------|
| `api/internal/infra/postgres/asset_service_repository.go` | ✅ | Full CRUD, batch upsert, search, stats |
| `api/internal/infra/postgres/asset_state_history_repository.go` | ✅ | Append-only, shadow IT detection, audit queries |

### Architecture Issue ⚠️ Ingest Handler Duplication
**Problem:** Two separate ingest handlers exist with overlapping functionality:
- `IngestHandler` (legacy format)
- `CTISIngestHandler` (CTIS format)

**Solution:** See [Ingest Handler Consolidation Plan](./2026-01-27-ingest-handler-consolidation.md)

### Security Hardening (Migration 000111) ✅
Security review identified and addressed the following concerns:

| Issue | Mitigation |
|-------|------------|
| Unbounded TEXT fields (banner, CPE, attack_prerequisites) | Added length constraints (4096, 500, 2048 chars) |
| Unbounded array growth (compliance_scope, compliance_impact) | Added array size limits (max 20 elements) |
| Audit log tampering | Made asset_state_history append-only via triggers |
| Audit log deletion | Prevented deletion of records < 90 days old |
| Future timestamp injection | Added NOT FUTURE constraints on temporal columns |
| Data consistency | Added exposure consistency warning trigger |

### Build Status
- ✅ API compiles successfully
- ✅ SDK compiles successfully

### Remaining Work for Phase 0 Completion
1. [x] ~~Create Service domain entity~~ → Created in `asset/service_extension.go` as `AssetService`
2. [x] ~~Create Service repository interface~~ → Created in `asset/service_extension_repository.go`
3. [x] ~~Create Asset state history entity~~ → Created in `asset/state_history.go`
4. [x] ~~Rename services table~~ → Migration 000113 renames to `asset_services`
5. [x] ~~Implement `postgres/asset_service_repository.go`~~ → Full implementation with batch upsert
6. [x] ~~Implement `postgres/asset_state_history_repository.go`~~ → Full implementation with audit queries
7. [ ] Implement Service API endpoints
8. [ ] Implement Asset state history API endpoints
7. [ ] Implement Asset state history API endpoints
8. [ ] Consolidate ingest handlers (see related RFC)

### Related Documents
- **[Platform Agent: Recon & Asset Collection](./2026-01-27-platform-agent-unified.md)** - Agent implementation details for Discovery phase
- **[Ingest Handler Consolidation](./2026-01-27-ingest-handler-consolidation.md)** - Plan to unify duplicate ingest handlers

---

## Summary

Based on the analysis of Gartner's CTEM (Continuous Threat Exposure Management) framework, this document identifies key gaps and proposes an implementation plan to upgrade the OpenCTEM platform into a complete CTEM solution.

---

## CTEM Maturity Assessment

| Phase | Current Score | Target | Key Gaps |
|-------|:-------------:|:------:|----------|
| **Scoping** | 7/10 | 9/10 | Business context integration, Crown jewels tagging |
| **Discovery** | 8/10 | 9/10 | Attack path modeling, Shadow IT detection |
| **Prioritization** | 5/10 | 9/10 | Business impact scoring, Threat intelligence correlation |
| **Validation** | 1/10 | 8/10 | BAS integration, Pentest management, Control testing |
| **Mobilization** | 4/10 | 8/10 | Task management, Jira integration, SLA tracking |

**Overall CTEM Score: 5/10** → Target: **8.6/10**

---

## Current Data Model Assessment

### Asset Domain: 8/10 ✅

| Aspect | Score | Notes |
|--------|:-----:|-------|
| Asset Types | 90% | 35+ types complete (domain, subdomain, IP, certificate, web app, API, repository, cloud, host, container, etc.) |
| Temporal Tracking | 95% | firstSeen, lastSeen, discoveredAt, lastSyncedAt |
| Criticality | 90% | 5 levels (critical, high, medium, low, none) with scoring |
| Exposure | 85% | public, restricted, private, isolated, unknown |
| Scope | 85% | internal, external, cloud, partner, vendor, shadow |
| Discovery Tracking | 90% | discoverySource, discoveryTool, discoveredAt |
| Provider Integration | 90% | GitHub, GitLab, AWS, Azure, GCP with sync status |

**Gaps Identified:**
- ❌ No compliance context (PCI-DSS, HIPAA, SOC2)
- ❌ No data classification (PII, PHI, Financial)
- ❌ No asset state history (appeared/disappeared tracking)
- ❌ No service/endpoint hierarchy

### Finding Domain: 8/10 ✅

| Aspect | Score | Notes |
|--------|:-----:|-------|
| Severity & Classification | 95% | CVE, CWE, CVSS, OWASP IDs |
| Lifecycle Management | 90% | Status transitions, SLA deadline, triage |
| Temporal Tracking | 95% | firstDetectedAt, lastSeenAt, resolvedAt |
| Code Location | 90% | file, line, snippet, branch, commit |
| Deduplication | 85% | Fingerprinting with duplicate tracking |
| CISA KEV | 85% | Tracking critical for CTEM |
| Exploit Info | 80% | Maturity levels, availability flag |

**Gaps Identified:**
- ❌ No exposure vector (network, local, physical)
- ❌ No internet accessibility flag
- ❌ No remediation guidance (fix type, complexity)
- ❌ No business impact context
- ❌ No finding correlation across tools

---

## Implementation Tiers

### Tier 0: Foundation - Data Model Enhancements (Week 1-2)
- Asset exposure & compliance fields
- Finding exposure vector fields
- Service hierarchy entity
- Asset state history

### Tier 1: Critical (Q1 2026)
- Attack Path Modeling
- Enhanced Risk Scoring
- Validation Framework Foundation

### Tier 2: High (Q2 2026)
- Remediation Task Management
- Ticketing Integration (Jira/ServiceNow)
- BAS Tool Integration

### Tier 3: Medium (Q3 2026)
- Threat Intelligence Correlation
- Dynamic Re-prioritization
- Advanced Analytics

---

## Phase 0: Data Model Enhancements (Foundation)

### Problem Statement
The current domain models (Asset, Finding) are good but missing some important fields for CTEM:
- Cannot track HOW finding can be exploited (exposure vector)
- No compliance context to prioritize by regulatory requirements
- No service hierarchy to model attack surface accurately
- No tracking of asset state changes (shadow IT detection)

### 0.1 Asset Compliance & Data Classification

#### Domain Changes

```go
// api/internal/domain/asset/entity.go - ADD fields

type Asset struct {
    // ... existing fields ...

    // CTEM: Compliance Context
    complianceScope      []string         // ["PCI-DSS", "HIPAA", "SOC2", "GDPR", "ISO27001"]
    dataClassification   DataClassification
    piiDataExposed       bool
    phiDataExposed       bool             // Protected Health Information
    regulatoryOwner      *shared.ID       // Compliance officer responsible

    // CTEM: Enhanced Exposure
    isInternetAccessible bool             // Directly reachable from internet
    exposureChangedAt    *time.Time       // When exposure level last changed
    lastExposureLevel    Exposure         // Previous exposure for tracking changes
}

type DataClassification string
const (
    DataClassificationPublic       DataClassification = "public"
    DataClassificationInternal     DataClassification = "internal"
    DataClassificationConfidential DataClassification = "confidential"
    DataClassificationRestricted   DataClassification = "restricted"  // PII, PHI
    DataClassificationSecret       DataClassification = "secret"      // Highly sensitive
)
```

#### Database Migration

```sql
-- migrations/000XXX_asset_ctem_fields.up.sql

-- Add compliance and data classification fields to assets
ALTER TABLE assets ADD COLUMN IF NOT EXISTS compliance_scope TEXT[] DEFAULT '{}';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS data_classification VARCHAR(50);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS pii_data_exposed BOOLEAN DEFAULT false;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS phi_data_exposed BOOLEAN DEFAULT false;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS regulatory_owner_id UUID REFERENCES users(id);

-- Add enhanced exposure tracking
ALTER TABLE assets ADD COLUMN IF NOT EXISTS is_internet_accessible BOOLEAN DEFAULT false;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS exposure_changed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS last_exposure_level VARCHAR(50);

-- Add constraints
ALTER TABLE assets ADD CONSTRAINT valid_data_classification
    CHECK (data_classification IS NULL OR data_classification IN ('public', 'internal', 'confidential', 'restricted', 'secret'));

-- Create indexes for CTEM queries
CREATE INDEX idx_assets_compliance ON assets USING GIN (compliance_scope);
CREATE INDEX idx_assets_pii ON assets(tenant_id) WHERE pii_data_exposed = true;
CREATE INDEX idx_assets_internet ON assets(tenant_id) WHERE is_internet_accessible = true;
CREATE INDEX idx_assets_exposure_changed ON assets(exposure_changed_at DESC);
```

### 0.2 Finding Exposure Vector

#### Domain Changes

```go
// api/internal/domain/vulnerability/finding.go - ADD fields

type Finding struct {
    // ... existing fields ...

    // CTEM: Exposure Vector
    exposureVector       ExposureVector
    isNetworkAccessible  bool             // Can be reached from network
    isInternetAccessible bool             // Directly internet-facing
    attackPrerequisites  string           // Auth required? MFA? etc.

    // CTEM: Remediation Context
    remediationType      RemediationType
    estimatedFixTime     *int             // Minutes to fix (estimate)
    fixComplexity        FixComplexity
    remedyAvailable      bool             // Is patch/fix available?

    // CTEM: Business Impact
    dataExposureRisk     DataExposureRisk
    reputationalImpact   bool
    complianceImpact     []string         // Which frameworks affected
}

type ExposureVector string
const (
    ExposureVectorNetwork      ExposureVector = "network"       // Remotely exploitable
    ExposureVectorLocal        ExposureVector = "local"         // Local access required
    ExposureVectorPhysical     ExposureVector = "physical"      // Physical access required
    ExposureVectorAdjacentNet  ExposureVector = "adjacent_net"  // Same network segment
    ExposureVectorUnknown      ExposureVector = "unknown"
)

type RemediationType string
const (
    RemediationTypePatch      RemediationType = "patch"
    RemediationTypeUpgrade    RemediationType = "upgrade"
    RemediationTypeWorkaround RemediationType = "workaround"
    RemediationTypeConfig     RemediationType = "config_change"
    RemediationTypeMitigate   RemediationType = "mitigate"
    RemediationTypeAcceptRisk RemediationType = "accept_risk"
)

type FixComplexity string
const (
    FixComplexitySimple   FixComplexity = "simple"    // < 1 hour
    FixComplexityModerate FixComplexity = "moderate"  // 1-8 hours
    FixComplexityComplex  FixComplexity = "complex"   // > 8 hours
)

type DataExposureRisk string
const (
    DataExposureRiskNone     DataExposureRisk = "none"
    DataExposureRiskLow      DataExposureRisk = "low"
    DataExposureRiskMedium   DataExposureRisk = "medium"
    DataExposureRiskHigh     DataExposureRisk = "high"
    DataExposureRiskCritical DataExposureRisk = "critical"
)
```

#### Database Migration

```sql
-- migrations/000XXX_finding_ctem_fields.up.sql

-- Add exposure vector fields
ALTER TABLE findings ADD COLUMN IF NOT EXISTS exposure_vector VARCHAR(50) DEFAULT 'unknown';
ALTER TABLE findings ADD COLUMN IF NOT EXISTS is_network_accessible BOOLEAN DEFAULT false;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS is_internet_accessible BOOLEAN DEFAULT false;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS attack_prerequisites TEXT;

-- Add remediation context
ALTER TABLE findings ADD COLUMN IF NOT EXISTS remediation_type VARCHAR(50);
ALTER TABLE findings ADD COLUMN IF NOT EXISTS estimated_fix_time INTEGER;  -- minutes
ALTER TABLE findings ADD COLUMN IF NOT EXISTS fix_complexity VARCHAR(20);
ALTER TABLE findings ADD COLUMN IF NOT EXISTS remedy_available BOOLEAN DEFAULT true;

-- Add business impact
ALTER TABLE findings ADD COLUMN IF NOT EXISTS data_exposure_risk VARCHAR(20) DEFAULT 'none';
ALTER TABLE findings ADD COLUMN IF NOT EXISTS reputational_impact BOOLEAN DEFAULT false;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS compliance_impact TEXT[];

-- Add constraints
ALTER TABLE findings ADD CONSTRAINT valid_exposure_vector
    CHECK (exposure_vector IN ('network', 'local', 'physical', 'adjacent_net', 'unknown'));
ALTER TABLE findings ADD CONSTRAINT valid_remediation_type
    CHECK (remediation_type IS NULL OR remediation_type IN ('patch', 'upgrade', 'workaround', 'config_change', 'mitigate', 'accept_risk'));
ALTER TABLE findings ADD CONSTRAINT valid_fix_complexity
    CHECK (fix_complexity IS NULL OR fix_complexity IN ('simple', 'moderate', 'complex'));
ALTER TABLE findings ADD CONSTRAINT valid_data_exposure_risk
    CHECK (data_exposure_risk IN ('none', 'low', 'medium', 'high', 'critical'));

-- Indexes for CTEM prioritization queries
CREATE INDEX idx_findings_internet_exposed ON findings(tenant_id)
    WHERE is_internet_accessible = true AND status IN ('open', 'in_progress');
CREATE INDEX idx_findings_remediation ON findings(remediation_type, fix_complexity);
CREATE INDEX idx_findings_compliance ON findings USING GIN (compliance_impact);
```

### 0.3 Service Hierarchy Entity

#### Domain Model

```go
// api/internal/domain/service/entity.go - NEW FILE

package service

import (
    "time"
    "github.com/openctemio/api/internal/domain/shared"
)

// Service represents a network service running on an asset
type Service struct {
    id              shared.ID
    tenantID        shared.ID
    assetID         shared.ID        // Parent asset (host, server, container)

    // Service Identity
    name            string           // Human-readable name
    protocol        Protocol         // tcp, udp
    port            int
    serviceType     ServiceType      // http, https, ssh, ftp, mysql, etc.

    // Service Details
    product         string           // Apache, nginx, OpenSSH, etc.
    version         string           // 2.4.41, 8.0.23, etc.
    banner          string           // Raw service banner
    cpe             string           // Common Platform Enumeration

    // Exposure
    isPublic        bool             // Accessible from internet
    exposure        Exposure
    tlsEnabled      bool
    tlsVersion      string           // TLS 1.2, TLS 1.3

    // Discovery
    discoverySource string           // nmap, shodan, censys, httpx
    discoveredAt    time.Time
    lastSeenAt      time.Time

    // Risk Context
    findingCount    int
    riskScore       int

    // State
    state           ServiceState     // active, inactive, filtered
    stateChangedAt  *time.Time

    timestamps
}

type Protocol string
const (
    ProtocolTCP Protocol = "tcp"
    ProtocolUDP Protocol = "udp"
)

type ServiceType string
const (
    ServiceTypeHTTP       ServiceType = "http"
    ServiceTypeHTTPS      ServiceType = "https"
    ServiceTypeSSH        ServiceType = "ssh"
    ServiceTypeFTP        ServiceType = "ftp"
    ServiceTypeSFTP       ServiceType = "sftp"
    ServiceTypeSMTP       ServiceType = "smtp"
    ServiceTypeSMTPS      ServiceType = "smtps"
    ServiceTypeDNS        ServiceType = "dns"
    ServiceTypeMySQL      ServiceType = "mysql"
    ServiceTypePostgres   ServiceType = "postgresql"
    ServiceTypeMongoDB    ServiceType = "mongodb"
    ServiceTypeRedis      ServiceType = "redis"
    ServiceTypeRDP        ServiceType = "rdp"
    ServiceTypeSMB        ServiceType = "smb"
    ServiceTypeLDAP       ServiceType = "ldap"
    ServiceTypeKerberos   ServiceType = "kerberos"
    ServiceTypeGRPC       ServiceType = "grpc"
    ServiceTypeOther      ServiceType = "other"
)

type ServiceState string
const (
    ServiceStateActive   ServiceState = "active"    // Service responding
    ServiceStateInactive ServiceState = "inactive"  // Service not responding
    ServiceStateFiltered ServiceState = "filtered"  // Firewall blocked
)

type Exposure string
const (
    ExposurePublic     Exposure = "public"
    ExposureRestricted Exposure = "restricted"
    ExposurePrivate    Exposure = "private"
)
```

#### Database Migration

```sql
-- migrations/000XXX_services.up.sql

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,

    -- Service Identity
    name VARCHAR(255),
    protocol VARCHAR(10) NOT NULL DEFAULT 'tcp',
    port INTEGER NOT NULL,
    service_type VARCHAR(50) NOT NULL DEFAULT 'other',

    -- Service Details
    product VARCHAR(255),
    version VARCHAR(100),
    banner TEXT,
    cpe VARCHAR(500),

    -- Exposure
    is_public BOOLEAN DEFAULT false,
    exposure VARCHAR(50) DEFAULT 'private',
    tls_enabled BOOLEAN DEFAULT false,
    tls_version VARCHAR(20),

    -- Discovery
    discovery_source VARCHAR(100),
    discovered_at TIMESTAMP WITH TIME ZONE,
    last_seen_at TIMESTAMP WITH TIME ZONE,

    -- Risk
    finding_count INTEGER DEFAULT 0,
    risk_score INTEGER DEFAULT 0,

    -- State
    state VARCHAR(20) DEFAULT 'active',
    state_changed_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint per asset+port+protocol
    CONSTRAINT unique_service_per_asset UNIQUE (tenant_id, asset_id, port, protocol),

    -- Constraints
    CONSTRAINT valid_protocol CHECK (protocol IN ('tcp', 'udp')),
    CONSTRAINT valid_service_type CHECK (service_type IN (
        'http', 'https', 'ssh', 'ftp', 'sftp', 'smtp', 'smtps', 'dns',
        'mysql', 'postgresql', 'mongodb', 'redis', 'rdp', 'smb', 'ldap', 'kerberos', 'grpc', 'other'
    )),
    CONSTRAINT valid_exposure CHECK (exposure IN ('public', 'restricted', 'private')),
    CONSTRAINT valid_state CHECK (state IN ('active', 'inactive', 'filtered')),
    CONSTRAINT valid_port CHECK (port > 0 AND port <= 65535)
);

-- Indexes
CREATE INDEX idx_services_tenant ON services(tenant_id);
CREATE INDEX idx_services_asset ON services(asset_id);
CREATE INDEX idx_services_port ON services(port);
CREATE INDEX idx_services_type ON services(service_type);
CREATE INDEX idx_services_public ON services(tenant_id) WHERE is_public = true;
CREATE INDEX idx_services_state ON services(state);
CREATE INDEX idx_services_last_seen ON services(last_seen_at DESC);

-- Partial index for active public services (common CTEM query)
CREATE INDEX idx_services_active_public ON services(tenant_id, asset_id)
    WHERE state = 'active' AND is_public = true;
```

### 0.4 Asset State History

#### Domain Model

```go
// api/internal/domain/asset/state_history.go - NEW FILE

package asset

import (
    "time"
    "github.com/openctemio/api/internal/domain/shared"
)

// AssetStateChange represents a tracked change in asset state
type AssetStateChange struct {
    id         shared.ID
    tenantID   shared.ID
    assetID    shared.ID

    // What changed
    changeType StateChangeType
    field      string           // Which field changed (optional)
    oldValue   string
    newValue   string

    // Context
    reason     string           // Why the change occurred
    source     string           // What triggered: scan, manual, integration

    // Who/When
    changedBy  *shared.ID       // User ID if manual
    changedAt  time.Time
}

type StateChangeType string
const (
    StateChangeAppeared        StateChangeType = "appeared"         // New asset discovered
    StateChangeDisappeared     StateChangeType = "disappeared"      // Asset no longer seen
    StateChangeRecovered       StateChangeType = "recovered"        // Asset seen again
    StateChangeExposureChanged StateChangeType = "exposure_changed" // Exposure level changed
    StateChangeStatusChanged   StateChangeType = "status_changed"   // Active/Inactive/Archived
    StateChangeCriticalityChanged StateChangeType = "criticality_changed"
    StateChangeOwnerChanged    StateChangeType = "owner_changed"
    StateChangeComplianceChanged StateChangeType = "compliance_changed"
)
```

#### Database Migration

```sql
-- migrations/000XXX_asset_state_history.up.sql

CREATE TABLE asset_state_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,

    -- Change details
    change_type VARCHAR(50) NOT NULL,
    field VARCHAR(100),
    old_value TEXT,
    new_value TEXT,

    -- Context
    reason TEXT,
    source VARCHAR(50),  -- scan, manual, integration, system

    -- Audit
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_change_type CHECK (change_type IN (
        'appeared', 'disappeared', 'recovered',
        'exposure_changed', 'status_changed',
        'criticality_changed', 'owner_changed', 'compliance_changed'
    ))
);

-- Indexes for audit queries
CREATE INDEX idx_asset_state_history_tenant ON asset_state_history(tenant_id);
CREATE INDEX idx_asset_state_history_asset ON asset_state_history(asset_id);
CREATE INDEX idx_asset_state_history_type ON asset_state_history(change_type);
CREATE INDEX idx_asset_state_history_time ON asset_state_history(changed_at DESC);

-- Composite index for shadow IT detection queries
CREATE INDEX idx_asset_state_appeared ON asset_state_history(tenant_id, changed_at DESC)
    WHERE change_type IN ('appeared', 'disappeared', 'recovered');
```

### 0.5 CTIS Schema Updates

```go
// sdk/pkg/ctis/types.go - ADDITIONS

// ExposureInfo represents exposure context for findings
type ExposureInfo struct {
    Vector             string   `json:"vector,omitempty"`              // network, local, physical
    IsNetworkAccessible bool    `json:"is_network_accessible,omitempty"`
    IsInternetAccessible bool   `json:"is_internet_accessible,omitempty"`
    Prerequisites      string   `json:"prerequisites,omitempty"`       // Auth required, etc.
}

// RemediationInfo represents remediation guidance
type RemediationInfo struct {
    Type           string   `json:"type,omitempty"`           // patch, upgrade, workaround
    Recommendation string   `json:"recommendation,omitempty"` // Existing field
    Effort         string   `json:"effort,omitempty"`         // simple, moderate, complex
    EstimatedTime  int      `json:"estimated_time_minutes,omitempty"`
    Available      bool     `json:"available,omitempty"`      // Is fix available?
    References     []string `json:"references,omitempty"`     // Existing field
}

// ComplianceInfo for asset compliance context
type ComplianceInfo struct {
    Frameworks       []string `json:"frameworks,omitempty"`       // PCI-DSS, HIPAA, etc.
    DataClassification string `json:"data_classification,omitempty"`
    PIIExposed       bool     `json:"pii_exposed,omitempty"`
    PHIExposed       bool     `json:"phi_exposed,omitempty"`
}

// ServiceInfo for service discovery results
type ServiceInfo struct {
    Port           int      `json:"port"`
    Protocol       string   `json:"protocol,omitempty"`      // tcp, udp
    ServiceType    string   `json:"service_type,omitempty"`  // http, ssh, mysql, etc.
    Product        string   `json:"product,omitempty"`       // Apache, nginx, etc.
    Version        string   `json:"version,omitempty"`
    Banner         string   `json:"banner,omitempty"`
    CPE            string   `json:"cpe,omitempty"`
    IsPublic       bool     `json:"is_public,omitempty"`
    TLSEnabled     bool     `json:"tls_enabled,omitempty"`
    TLSVersion     string   `json:"tls_version,omitempty"`
}

// Update Finding struct
type Finding struct {
    // ... existing fields ...

    // CTEM additions
    Exposure       *ExposureInfo    `json:"exposure,omitempty"`
    Remediation    *RemediationInfo `json:"remediation,omitempty"`  // Enhanced from existing
    ComplianceImpact []string       `json:"compliance_impact,omitempty"`
    DataExposureRisk string         `json:"data_exposure_risk,omitempty"`
}

// Update Asset struct
type Asset struct {
    // ... existing fields ...

    // CTEM additions
    Compliance     *ComplianceInfo  `json:"compliance,omitempty"`
    Services       []ServiceInfo    `json:"services,omitempty"`
    IsInternetAccessible bool       `json:"is_internet_accessible,omitempty"`
}
```

### 0.6 Implementation Files

| File | Action | Description |
|------|--------|-------------|
| `api/internal/domain/asset/entity.go` | MODIFY | Add compliance & exposure fields |
| `api/internal/domain/asset/state_history.go` | CREATE | State change tracking entity |
| `api/internal/domain/vulnerability/finding.go` | MODIFY | Add exposure vector & remediation fields |
| `api/internal/domain/service/entity.go` | CREATE | Service hierarchy entity |
| `api/internal/domain/service/repository.go` | CREATE | Service repository interface |
| `api/internal/infra/postgres/service_repository.go` | CREATE | Service repository implementation |
| `api/internal/infra/postgres/asset_state_repository.go` | CREATE | Asset state history repository |
| `api/migrations/000XXX_asset_ctem_fields.up.sql` | CREATE | Asset schema enhancements |
| `api/migrations/000XXX_finding_ctem_fields.up.sql` | CREATE | Finding schema enhancements |
| `api/migrations/000XXX_services.up.sql` | CREATE | Services table |
| `api/migrations/000XXX_asset_state_history.up.sql` | CREATE | State history table |
| `sdk/pkg/ctis/types.go` | MODIFY | Add CTEM fields to CTIS schema |
| `schemas/ctis/v1/finding.json` | MODIFY | Update JSON schema |
| `schemas/ctis/v1/asset.json` | MODIFY | Update JSON schema |

### 0.7 API Endpoint Additions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/assets/{id}/services` | List services for asset |
| POST | `/api/v1/assets/{id}/services` | Add service to asset |
| GET | `/api/v1/assets/{id}/state-history` | Get asset state changes |
| GET | `/api/v1/assets/{id}/compliance` | Get compliance context |
| PUT | `/api/v1/assets/{id}/compliance` | Update compliance context |
| GET | `/api/v1/findings/{id}/exposure` | Get exposure details |
| PUT | `/api/v1/findings/{id}/exposure` | Update exposure details |
| GET | `/api/v1/services` | List all services (with filters) |
| GET | `/api/v1/services/public` | List internet-exposed services |

---

## Phase 1: Attack Path Modeling

### Problem Statement
Currently, OpenCTEM tracks findings/vulnerabilities independently, without the ability to model attack chains and lateral movement paths.

### Solution: AttackPath Entity

#### Domain Model

```go
// api/internal/domain/attackpath/entity.go

type AttackPath struct {
    ID          uuid.UUID
    TenantID    uuid.UUID
    Name        string
    Description string

    // Path Definition
    Nodes       []AttackNode
    Edges       []AttackEdge

    // Impact Assessment
    TargetAssets    []uuid.UUID   // Crown jewels at risk
    BlastRadius     int           // Number of assets affected
    RiskScore       float64       // Composite risk score

    // Classification
    AttackVector    AttackVector  // external, internal, insider
    TechniquesTTP   []string      // MITRE ATT&CK TTP IDs

    // Status
    Status          PathStatus    // active, mitigated, accepted
    ValidatedAt     *time.Time

    Timestamps
}

type AttackNode struct {
    ID          uuid.UUID
    AssetID     *uuid.UUID
    FindingID   *uuid.UUID
    NodeType    NodeType      // entry_point, vulnerability, privilege, target
    Position    int           // Position in path
    Technique   string        // MITRE technique (T1566, etc.)

    // Risk factors
    Exploitability  float64   // EPSS or manual score
    Impact          float64   // Business impact
    Confidence      float64   // Detection confidence
}

type AttackEdge struct {
    FromNodeID  uuid.UUID
    ToNodeID    uuid.UUID
    EdgeType    EdgeType      // exploits, enables, leads_to
    Difficulty  Difficulty    // trivial, moderate, difficult
    Evidence    string        // Why this edge exists
}

type AttackVector string
const (
    AttackVectorExternal AttackVector = "external"
    AttackVectorInternal AttackVector = "internal"
    AttackVectorInsider  AttackVector = "insider"
)

type NodeType string
const (
    NodeTypeEntryPoint    NodeType = "entry_point"
    NodeTypeVulnerability NodeType = "vulnerability"
    NodeTypePrivilege     NodeType = "privilege"
    NodeTypeLateralMove   NodeType = "lateral_movement"
    NodeTypeTarget        NodeType = "target"
)

type PathStatus string
const (
    PathStatusActive    PathStatus = "active"
    PathStatusMitigated PathStatus = "mitigated"
    PathStatusAccepted  PathStatus = "accepted"
)
```

#### Database Schema

```sql
-- migrations/000XXX_attack_paths.up.sql

CREATE TABLE attack_paths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Impact
    target_assets UUID[],
    blast_radius INTEGER DEFAULT 0,
    risk_score NUMERIC(5,2) DEFAULT 0,

    -- Classification
    attack_vector VARCHAR(50) DEFAULT 'external',
    techniques_ttp TEXT[],

    -- Status
    status VARCHAR(50) DEFAULT 'active',
    validated_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),

    CONSTRAINT valid_attack_vector CHECK (attack_vector IN ('external', 'internal', 'insider')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'mitigated', 'accepted'))
);

CREATE TABLE attack_path_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path_id UUID NOT NULL REFERENCES attack_paths(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id),
    finding_id UUID REFERENCES findings(id),

    node_type VARCHAR(50) NOT NULL,
    position INTEGER NOT NULL,
    technique VARCHAR(20),

    exploitability NUMERIC(3,2) DEFAULT 0.5,
    impact NUMERIC(3,2) DEFAULT 0.5,
    confidence NUMERIC(3,2) DEFAULT 0.5,

    metadata JSONB DEFAULT '{}'::jsonb,

    CONSTRAINT valid_node_type CHECK (node_type IN ('entry_point', 'vulnerability', 'privilege', 'lateral_movement', 'target'))
);

CREATE TABLE attack_path_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path_id UUID NOT NULL REFERENCES attack_paths(id) ON DELETE CASCADE,
    from_node_id UUID NOT NULL REFERENCES attack_path_nodes(id) ON DELETE CASCADE,
    to_node_id UUID NOT NULL REFERENCES attack_path_nodes(id) ON DELETE CASCADE,

    edge_type VARCHAR(50) DEFAULT 'leads_to',
    difficulty VARCHAR(20) DEFAULT 'moderate',
    evidence TEXT,

    CONSTRAINT valid_edge_type CHECK (edge_type IN ('exploits', 'enables', 'leads_to')),
    CONSTRAINT valid_difficulty CHECK (difficulty IN ('trivial', 'moderate', 'difficult'))
);

CREATE INDEX idx_attack_paths_tenant ON attack_paths(tenant_id);
CREATE INDEX idx_attack_paths_status ON attack_paths(status);
CREATE INDEX idx_attack_path_nodes_path ON attack_path_nodes(path_id);
CREATE INDEX idx_attack_path_nodes_asset ON attack_path_nodes(asset_id);
CREATE INDEX idx_attack_path_nodes_finding ON attack_path_nodes(finding_id);
```

#### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/attack-paths` | List attack paths |
| POST | `/api/v1/attack-paths` | Create attack path |
| GET | `/api/v1/attack-paths/{id}` | Get attack path details |
| PUT | `/api/v1/attack-paths/{id}` | Update attack path |
| DELETE | `/api/v1/attack-paths/{id}` | Delete attack path |
| POST | `/api/v1/attack-paths/{id}/validate` | Mark as validated |
| GET | `/api/v1/attack-paths/{id}/graph` | Get graph visualization data |
| GET | `/api/v1/assets/{id}/attack-paths` | Get paths involving asset |
| GET | `/api/v1/findings/{id}/attack-paths` | Get paths involving finding |

#### UI Components

1. **Attack Path List** (`/discovery/attack-paths`)
   - Table with sorting, filtering
   - Risk score badge
   - Status indicators
   - Quick actions (view, edit, validate)

2. **Attack Path Builder** (`/discovery/attack-paths/new`)
   - Visual graph editor (React Flow)
   - Node palette (drag-and-drop)
   - Asset/Finding search to add nodes
   - MITRE ATT&CK technique picker

3. **Attack Path Viewer** (`/discovery/attack-paths/{id}`)
   - Interactive graph visualization
   - Node details panel
   - Impact analysis sidebar
   - Remediation recommendations

---

## Phase 2: Enhanced Risk Scoring

### Problem Statement
Current risk scoring is based only on CVSS/severity. Need to integrate business context, threat intelligence, and exploitability.

### Solution: Risk Scoring Engine

#### Domain Model

```go
// api/internal/domain/risk/scoring.go

type RiskScore struct {
    // Base Score (from scanner)
    BaseScore       float64

    // Contextual Factors
    ExposureFactor    float64  // Public/Private/Isolated
    CriticalityFactor float64  // Asset criticality
    BusinessImpact    float64  // Business unit importance

    // Threat Factors
    EPSS              float64  // Exploit Prediction Scoring System
    InTheWild         bool     // Known exploitation
    ThreatActorActive bool     // Related to active campaigns

    // Environmental Factors
    CompensatingControls []CompensatingControl
    AttackPathRelevance  float64  // Part of critical attack path

    // Final Score
    FinalScore        float64
    Confidence        float64

    Timestamp         time.Time
}

type RiskScoringRule struct {
    ID          uuid.UUID
    TenantID    uuid.UUID
    Name        string
    Description string

    // Rule Definition
    Conditions  []RuleCondition
    Multiplier  float64
    AddScore    float64
    Priority    int

    IsActive    bool
}

type RuleCondition struct {
    Field     string    // asset.criticality, finding.severity, etc.
    Operator  Operator  // equals, contains, greater_than, etc.
    Value     any
}

// Risk calculation formula:
// FinalScore = (BaseScore * ExposureFactor * CriticalityFactor)
//            + (EPSS * 10)
//            + (InTheWild ? 20 : 0)
//            + (AttackPathRelevance * 15)
//            - (CompensatingControlsReduction)
```

#### Database Schema

```sql
-- migrations/000XXX_risk_scoring.up.sql

CREATE TABLE risk_scoring_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    multiplier NUMERIC(4,2) DEFAULT 1.0,
    add_score NUMERIC(4,2) DEFAULT 0,
    priority INTEGER DEFAULT 100,

    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE finding_risk_scores (
    finding_id UUID PRIMARY KEY REFERENCES findings(id) ON DELETE CASCADE,

    -- Component scores
    base_score NUMERIC(4,2),
    exposure_factor NUMERIC(3,2) DEFAULT 1.0,
    criticality_factor NUMERIC(3,2) DEFAULT 1.0,
    business_impact NUMERIC(3,2) DEFAULT 1.0,

    epss NUMERIC(5,4),
    in_the_wild BOOLEAN DEFAULT false,
    threat_actor_active BOOLEAN DEFAULT false,

    attack_path_relevance NUMERIC(3,2) DEFAULT 0,
    compensating_controls JSONB DEFAULT '[]'::jsonb,

    -- Final
    final_score NUMERIC(5,2),
    confidence NUMERIC(3,2) DEFAULT 0.8,

    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE asset_business_context (
    asset_id UUID PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,

    business_unit_id UUID,
    is_crown_jewel BOOLEAN DEFAULT false,
    data_classification VARCHAR(50),
    regulatory_scope TEXT[],  -- HIPAA, PCI-DSS, SOC2, etc.
    owner_id UUID REFERENCES users(id),

    business_impact_score NUMERIC(3,2) DEFAULT 0.5,

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_finding_risk_scores_final ON finding_risk_scores(final_score DESC);
CREATE INDEX idx_asset_business_crown_jewel ON asset_business_context(is_crown_jewel) WHERE is_crown_jewel = true;
```

#### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/risk/calculate/{findingId}` | Recalculate finding risk |
| POST | `/api/v1/risk/calculate-bulk` | Bulk risk calculation |
| GET | `/api/v1/risk/scoring-rules` | List scoring rules |
| POST | `/api/v1/risk/scoring-rules` | Create scoring rule |
| PUT | `/api/v1/risk/scoring-rules/{id}` | Update scoring rule |
| DELETE | `/api/v1/risk/scoring-rules/{id}` | Delete scoring rule |
| GET | `/api/v1/assets/{id}/business-context` | Get business context |
| PUT | `/api/v1/assets/{id}/business-context` | Update business context |

---

## Phase 3: Validation Framework

### Problem Statement
CTEM Validation phase is nearly empty (1/10). Need to build a module to:
- Manage penetration testing campaigns
- Integrate BAS (Breach & Attack Simulation) tools
- Verify security controls effectiveness

### Solution: Validation Module

#### 3.1 Pentest Campaign Management

```go
// api/internal/domain/pentest/entity.go

type PentestCampaign struct {
    ID          uuid.UUID
    TenantID    uuid.UUID
    Name        string
    Description string

    // Scope
    Scope           CampaignScope
    AssetGroupID    *uuid.UUID
    InScopeAssets   []uuid.UUID
    OutScopeAssets  []uuid.UUID

    // Scheduling
    ScheduledStart  time.Time
    ScheduledEnd    time.Time
    ActualStart     *time.Time
    ActualEnd       *time.Time

    // Team
    LeadTesterID    uuid.UUID
    Testers         []uuid.UUID

    // Configuration
    TestTypes       []TestType  // blackbox, graybox, whitebox
    Methodologies   []string    // OWASP, PTES, NIST
    RulesOfEngagement string

    // Status
    Status          CampaignStatus
    Progress        int

    Timestamps
}

type PentestFinding struct {
    ID          uuid.UUID
    CampaignID  uuid.UUID

    // Finding details
    Title       string
    Description string
    Severity    Severity
    CVSS        *float64

    // Evidence
    Evidence    []Evidence
    StepsToReproduce string

    // Affected
    AffectedAssets []uuid.UUID
    AffectedURLs   []string

    // Recommendations
    Remediation    string
    References     []string

    // Status
    Status         FindingStatus  // open, in_progress, resolved, accepted
    VerifiedAt     *time.Time

    Timestamps
}

type Evidence struct {
    Type        EvidenceType  // screenshot, request, response, video
    Description string
    StorageKey  string       // S3/MinIO key
    MimeType    string
}

type CampaignScope struct {
    Networks    []string     // CIDR ranges
    Domains     []string     // Target domains
    Exclusions  []string     // Out of scope
}

type TestType string
const (
    TestTypeBlackbox TestType = "blackbox"
    TestTypeGraybox  TestType = "graybox"
    TestTypeWhitebox TestType = "whitebox"
)

type CampaignStatus string
const (
    CampaignStatusDraft      CampaignStatus = "draft"
    CampaignStatusScheduled  CampaignStatus = "scheduled"
    CampaignStatusInProgress CampaignStatus = "in_progress"
    CampaignStatusReview     CampaignStatus = "review"
    CampaignStatusCompleted  CampaignStatus = "completed"
    CampaignStatusCancelled  CampaignStatus = "cancelled"
)
```

#### Database Schema

```sql
-- migrations/000XXX_pentest_campaigns.up.sql

CREATE TABLE pentest_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Scope
    asset_group_id UUID REFERENCES asset_groups(id),
    in_scope_assets UUID[],
    out_scope_assets UUID[],
    scope_networks TEXT[],
    scope_domains TEXT[],
    exclusions TEXT[],

    -- Scheduling
    scheduled_start TIMESTAMP WITH TIME ZONE,
    scheduled_end TIMESTAMP WITH TIME ZONE,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,

    -- Team
    lead_tester_id UUID REFERENCES users(id),
    testers UUID[],

    -- Configuration
    test_types TEXT[],
    methodologies TEXT[],
    rules_of_engagement TEXT,

    -- Status
    status VARCHAR(50) DEFAULT 'draft',
    progress INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),

    CONSTRAINT valid_status CHECK (status IN ('draft', 'scheduled', 'in_progress', 'review', 'completed', 'cancelled'))
);

CREATE TABLE pentest_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES pentest_campaigns(id) ON DELETE CASCADE,

    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity VARCHAR(20),
    cvss NUMERIC(3,1),

    evidence JSONB DEFAULT '[]'::jsonb,
    steps_to_reproduce TEXT,

    affected_assets UUID[],
    affected_urls TEXT[],

    remediation TEXT,
    references TEXT[],

    status VARCHAR(50) DEFAULT 'open',
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES users(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),

    CONSTRAINT valid_severity CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    CONSTRAINT valid_finding_status CHECK (status IN ('open', 'in_progress', 'resolved', 'accepted', 'false_positive'))
);

CREATE TABLE pentest_retests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finding_id UUID NOT NULL REFERENCES pentest_findings(id) ON DELETE CASCADE,

    scheduled_date TIMESTAMP WITH TIME ZONE,
    completed_date TIMESTAMP WITH TIME ZONE,

    result VARCHAR(50),  -- passed, failed, partial
    notes TEXT,
    evidence JSONB DEFAULT '[]'::jsonb,

    tested_by UUID REFERENCES users(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pentest_campaigns_tenant ON pentest_campaigns(tenant_id);
CREATE INDEX idx_pentest_campaigns_status ON pentest_campaigns(status);
CREATE INDEX idx_pentest_findings_campaign ON pentest_findings(campaign_id);
CREATE INDEX idx_pentest_findings_severity ON pentest_findings(severity);
```

#### 3.2 BAS Integration

```go
// api/internal/domain/validation/bas.go

type BASSimulation struct {
    ID          uuid.UUID
    TenantID    uuid.UUID
    Name        string

    // Provider
    Provider    BASProvider   // atomic_red_team, caldera, safebreach, attackiq
    ExternalID  string        // ID in external system

    // Simulation details
    Techniques  []string      // MITRE ATT&CK techniques
    Scenarios   []string
    TargetAssets []uuid.UUID

    // Execution
    Status      SimulationStatus
    StartedAt   *time.Time
    CompletedAt *time.Time

    // Results
    Results     BASResults

    Timestamps
}

type BASResults struct {
    TotalTests       int
    Blocked          int
    Detected         int
    NotDetected      int
    Errors           int

    DetectionRate    float64
    PreventionRate   float64

    DetailedResults  []TechniqueResult
}

type TechniqueResult struct {
    TechniqueID   string
    TechniqueName string
    Result        TestResult  // blocked, detected, not_detected, error
    DetectionTime *int        // Seconds to detect
    AlertGenerated bool
    Notes         string
}

type BASProvider string
const (
    BASProviderAtomicRedTeam BASProvider = "atomic_red_team"
    BASProviderCALDERA       BASProvider = "caldera"
    BASProviderSafeBreach    BASProvider = "safebreach"
    BASProviderAttackIQ      BASProvider = "attackiq"
)
```

---

## Phase 4: Remediation Task Management

### Problem Statement
No task management system to track remediation progress and integrate with ticketing systems.

### Solution: Remediation Tasks

#### Domain Model

```go
// api/internal/domain/remediation/entity.go

type RemediationTask struct {
    ID          uuid.UUID
    TenantID    uuid.UUID

    // Source
    SourceType  SourceType    // finding, pentest_finding, attack_path
    SourceID    uuid.UUID

    // Task details
    Title       string
    Description string
    Priority    Priority

    // Assignment
    AssigneeID  *uuid.UUID
    TeamID      *uuid.UUID

    // Tracking
    Status      TaskStatus
    DueDate     *time.Time

    // SLA
    SLAPolicy   *uuid.UUID
    SLADueAt    *time.Time
    SLABreached bool

    // External ticket
    ExternalSystem  *string    // jira, servicenow
    ExternalID      *string    // PROJ-123
    ExternalURL     *string

    // Resolution
    Resolution      *string
    ResolvedAt      *time.Time
    ResolvedBy      *uuid.UUID
    VerifiedAt      *time.Time
    VerifiedBy      *uuid.UUID

    Timestamps
}

type TaskStatus string
const (
    TaskStatusOpen       TaskStatus = "open"
    TaskStatusInProgress TaskStatus = "in_progress"
    TaskStatusPending    TaskStatus = "pending"      // Waiting on something
    TaskStatusResolved   TaskStatus = "resolved"
    TaskStatusVerified   TaskStatus = "verified"
    TaskStatusClosed     TaskStatus = "closed"
    TaskStatusWontFix    TaskStatus = "wont_fix"
)

type Priority string
const (
    PriorityCritical Priority = "critical"
    PriorityHigh     Priority = "high"
    PriorityMedium   Priority = "medium"
    PriorityLow      Priority = "low"
)
```

#### Database Schema

```sql
-- migrations/000XXX_remediation_tasks.up.sql

CREATE TABLE remediation_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Source
    source_type VARCHAR(50) NOT NULL,
    source_id UUID NOT NULL,

    -- Task details
    title VARCHAR(500) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium',

    -- Assignment
    assignee_id UUID REFERENCES users(id),
    team_id UUID,

    -- Tracking
    status VARCHAR(50) DEFAULT 'open',
    due_date TIMESTAMP WITH TIME ZONE,

    -- SLA
    sla_policy_id UUID,
    sla_due_at TIMESTAMP WITH TIME ZONE,
    sla_breached BOOLEAN DEFAULT false,

    -- External ticket
    external_system VARCHAR(50),
    external_id VARCHAR(100),
    external_url VARCHAR(500),

    -- Resolution
    resolution TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES users(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),

    CONSTRAINT valid_source_type CHECK (source_type IN ('finding', 'pentest_finding', 'attack_path', 'manual')),
    CONSTRAINT valid_priority CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    CONSTRAINT valid_task_status CHECK (status IN ('open', 'in_progress', 'pending', 'resolved', 'verified', 'closed', 'wont_fix'))
);

CREATE TABLE sla_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Time limits by priority (in hours)
    critical_response_hours INTEGER DEFAULT 4,
    critical_resolve_hours INTEGER DEFAULT 24,
    high_response_hours INTEGER DEFAULT 24,
    high_resolve_hours INTEGER DEFAULT 72,
    medium_response_hours INTEGER DEFAULT 72,
    medium_resolve_hours INTEGER DEFAULT 168,  -- 7 days
    low_response_hours INTEGER DEFAULT 168,
    low_resolve_hours INTEGER DEFAULT 720,     -- 30 days

    -- Business hours
    business_hours_only BOOLEAN DEFAULT false,
    timezone VARCHAR(50) DEFAULT 'UTC',
    business_start_hour INTEGER DEFAULT 9,
    business_end_hour INTEGER DEFAULT 17,

    is_default BOOLEAN DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES remediation_tasks(id) ON DELETE CASCADE,

    content TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES users(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE task_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES remediation_tasks(id) ON DELETE CASCADE,

    field_name VARCHAR(100),
    old_value TEXT,
    new_value TEXT,

    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_remediation_tasks_tenant ON remediation_tasks(tenant_id);
CREATE INDEX idx_remediation_tasks_status ON remediation_tasks(status);
CREATE INDEX idx_remediation_tasks_assignee ON remediation_tasks(assignee_id);
CREATE INDEX idx_remediation_tasks_source ON remediation_tasks(source_type, source_id);
CREATE INDEX idx_remediation_tasks_sla ON remediation_tasks(sla_due_at) WHERE NOT sla_breached;
CREATE INDEX idx_task_comments_task ON task_comments(task_id);
```

#### Jira Integration

```go
// api/internal/infra/integration/jira/client.go

type JiraClient interface {
    CreateIssue(ctx context.Context, issue JiraIssueInput) (*JiraIssue, error)
    UpdateIssue(ctx context.Context, issueKey string, update JiraIssueUpdate) error
    GetIssue(ctx context.Context, issueKey string) (*JiraIssue, error)
    SyncStatus(ctx context.Context, issueKey string) (string, error)
    AddComment(ctx context.Context, issueKey, comment string) error
    AttachFile(ctx context.Context, issueKey string, file io.Reader, filename string) error
}

type JiraIssueInput struct {
    ProjectKey  string
    IssueType   string  // Bug, Task, Story
    Summary     string
    Description string
    Priority    string
    Labels      []string
    Components  []string
    Assignee    string  // Jira username or account ID
    CustomFields map[string]any
}

// Bi-directional sync via webhooks
// POST /api/v1/integrations/jira/webhook
```

---

## Phase 5: CTIS Schema Extensions

### New CTIS Types for CTEM

```go
// sdk/pkg/ctis/types.go additions

// AttackPathCTIS represents attack path in CTIS format
type AttackPathCTIS struct {
    ID          string            `json:"id,omitempty"`
    Name        string            `json:"name"`
    Description string            `json:"description,omitempty"`

    Nodes       []AttackNodeCTIS   `json:"nodes"`
    Edges       []AttackEdgeCTIS   `json:"edges"`

    RiskScore   float64           `json:"risk_score,omitempty"`
    Techniques  []string          `json:"techniques,omitempty"` // MITRE ATT&CK

    Metadata    map[string]any    `json:"metadata,omitempty"`
}

// ValidationResultCTIS for BAS/pentest results
type ValidationResultCTIS struct {
    ID              string          `json:"id,omitempty"`
    Type            string          `json:"type"` // bas, pentest, control_test

    Provider        string          `json:"provider,omitempty"` // atomic_red_team, manual
    ExternalID      string          `json:"external_id,omitempty"`

    Techniques      []string        `json:"techniques,omitempty"`
    TargetAssets    []string        `json:"target_assets,omitempty"`

    Results         ValidationResults `json:"results"`

    Timestamp       int64           `json:"timestamp"`
}

type ValidationResults struct {
    Total           int             `json:"total"`
    Blocked         int             `json:"blocked"`
    Detected        int             `json:"detected"`
    NotDetected     int             `json:"not_detected"`

    DetectionRate   float64         `json:"detection_rate"`
    PreventionRate  float64         `json:"prevention_rate"`

    Details         []TestDetail    `json:"details,omitempty"`
}
```

---

## Implementation Timeline

```
Q1 2026 (Current)
├── Week 1-2: Phase 0 - Data Model Enhancements (Foundation)
│   ├── Asset compliance & exposure fields
│   ├── Finding exposure vector fields
│   ├── Service hierarchy entity
│   └── Asset state history tracking
├── Week 3-4: Attack Path Domain & Repository
├── Week 5-6: Attack Path Service & Handler
├── Week 7-8: Attack Path UI (React Flow)
├── Week 9-10: Risk Scoring Engine
├── Week 11-12: Business Context Management & Testing

Q2 2026
├── Week 1-3: Pentest Campaign Management
├── Week 4-6: Pentest Findings & Evidence
├── Week 7-8: Retest Workflow
├── Week 9-10: Remediation Tasks Core
├── Week 11-12: Jira Integration

Q3 2026
├── Week 1-4: BAS Integration Framework
├── Week 5-8: Threat Intelligence Correlation
├── Week 9-12: Advanced Analytics & Reports
```

---

## Files to Create

### Phase 0: Data Model Foundation
- `api/internal/domain/asset/entity.go` - MODIFY (add compliance, exposure fields)
- `api/internal/domain/asset/state_history.go` - CREATE
- `api/internal/domain/vulnerability/finding.go` - MODIFY (add exposure vector)
- `api/internal/domain/service/entity.go` - CREATE
- `api/internal/domain/service/repository.go` - CREATE
- `api/internal/infra/postgres/service_repository.go` - CREATE
- `api/internal/infra/postgres/asset_state_repository.go` - CREATE
- `api/internal/infra/http/handler/service_handler.go` - CREATE
- `api/internal/infra/http/routes/service.go` - CREATE
- `api/migrations/000XXX_asset_ctem_fields.up.sql` - CREATE
- `api/migrations/000XXX_asset_ctem_fields.down.sql` - CREATE
- `api/migrations/000XXX_finding_ctem_fields.up.sql` - CREATE
- `api/migrations/000XXX_finding_ctem_fields.down.sql` - CREATE
- `api/migrations/000XXX_services.up.sql` - CREATE
- `api/migrations/000XXX_services.down.sql` - CREATE
- `api/migrations/000XXX_asset_state_history.up.sql` - CREATE
- `api/migrations/000XXX_asset_state_history.down.sql` - CREATE
- `sdk/pkg/ctis/types.go` - MODIFY (add CTEM fields)
- `schemas/ctis/v1/finding.json` - MODIFY
- `schemas/ctis/v1/asset.json` - MODIFY

### Phase 1: Attack Path
- `api/internal/domain/attackpath/entity.go`
- `api/internal/domain/attackpath/repository.go`
- `api/internal/app/attackpath_service.go`
- `api/internal/infra/postgres/attackpath_repository.go`
- `api/internal/infra/http/handler/attackpath_handler.go`
- `api/internal/infra/http/routes/attackpath.go`
- `api/migrations/000XXX_attack_paths.up.sql`
- `api/migrations/000XXX_attack_paths.down.sql`
- `ui/src/features/attack-paths/components/attack-path-builder.tsx`
- `ui/src/features/attack-paths/components/attack-path-graph.tsx`

### Phase 2: Risk Scoring
- `api/internal/domain/risk/scoring.go`
- `api/internal/domain/risk/rules.go`
- `api/internal/app/risk_scoring_service.go`
- `api/internal/infra/postgres/risk_repository.go`
- `api/internal/infra/http/handler/risk_handler.go`
- `api/migrations/000XXX_risk_scoring.up.sql`

### Phase 3: Validation
- `api/internal/domain/pentest/entity.go`
- `api/internal/domain/pentest/repository.go`
- `api/internal/domain/validation/bas.go`
- `api/internal/app/pentest_service.go`
- `api/internal/app/bas_service.go`
- `api/internal/infra/postgres/pentest_repository.go`
- `api/internal/infra/http/handler/pentest_handler.go`
- `api/migrations/000XXX_pentest_campaigns.up.sql`

### Phase 4: Remediation
- `api/internal/domain/remediation/entity.go`
- `api/internal/domain/remediation/repository.go`
- `api/internal/app/remediation_service.go`
- `api/internal/infra/postgres/remediation_repository.go`
- `api/internal/infra/http/handler/remediation_handler.go`
- `api/internal/infra/integration/jira/client.go`
- `api/internal/infra/integration/jira/webhook.go`
- `api/migrations/000XXX_remediation_tasks.up.sql`

---

## Success Metrics

| Metric | Current | Target (6 months) |
|--------|:-------:|:-----------------:|
| CTEM Score | 5/10 | 8.5/10 |
| Data Model CTEM Alignment | 70% | 90% |
| Attack Paths Modeled | 0 | 50+ |
| Validation Coverage | 0% | 60% |
| Remediation MTTR | N/A | <7 days (High) |
| Jira Integration | No | Yes |
| Risk Score Accuracy | Basic | Context-aware |
| Compliance Tracking | None | Full (PCI-DSS, HIPAA, SOC2) |
| Service Discovery | Partial | Complete hierarchy |
| Exposure Vector Tracking | None | All findings |

---

## References

1. [Gartner CTEM Framework](https://www.gartner.com/en/articles/how-to-manage-cybersecurity-threats-not-episodes)
2. [MITRE ATT&CK Framework](https://attack.mitre.org/)
3. [EPSS Model](https://www.first.org/epss/)
4. [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)

---

**Next Steps:**
1. Review and approve this plan
2. Create detailed tickets for Phase 1
3. Begin Attack Path implementation
