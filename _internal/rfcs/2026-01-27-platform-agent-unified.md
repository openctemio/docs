# Platform Agent: Recon, Asset Collection & Specialization

**Date**: 2026-01-27
**Status**: COMPLETED
**Author**: Claude Code
**Related**: [CTEM Framework Enhancement](./2026-01-27-ctem-framework-enhancement.md)

---

## Executive Summary

Unified implementation plan for Platform Agent with capabilities:
1. **Reconnaissance scanning** - Subdomain, DNS, Port, HTTP, URL discovery
2. **Asset collection** - Convert recon results to CTIS format and push to API
3. **Agent specialization** - Modular executors that can be enabled/disabled

### Implementation Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1: SDK Recon Scanners | ✅ DONE | ReconScanner interface, 5 tools |
| Phase 2: API Changes | ✅ DONE | ValidScanners whitelist, capabilities |
| Phase 3: Pipeline Engine | ✅ DONE | JobExecutor, built-in templates |
| Phase 4: CTIS Integration | ✅ DONE | Asset/Finding converters, API ingest, JSONB indexes |
| Phase 5: Agent Specialization | ✅ DONE | Modular executor architecture |

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Asset Format | CTIS (CTEM Ingest Schema) | Existing schema supports all recon data |
| Agent Architecture | Single binary + Modular Executors | Simple deployment, flexible configuration |
| Scanner Mode | Hybrid (Library + Exec) | Library for lightweight, Exec for complex tools |
| Storage Strategy | JSONB in assets.properties | Flexible, no new tables needed |

---

## Part 1: CTIS Asset Mapping

### 1.1 Tool → CTIS Type Mapping

| Tool | CTIS Asset Type | Technical Field | Data |
|------|----------------|-----------------|------|
| **Subfinder** | `domain` | `Domain.DNSRecords` | Subdomains as A records |
| **DNSX** | `domain` | `Domain.DNSRecords` | A, AAAA, MX, NS, TXT, CNAME |
| **Naabu** | `ip_address` | `IPAddress.Ports` | Port, Protocol, State, Service |
| **HTTPX** | `service` | `Service.*` | Name, Version, Port, TLS, Banner |
| **Katana** | (properties) | `properties` | URLs, endpoints, forms |
| **Nuclei** | (finding) | `Vulnerability.*` | CVE, CVSS, affected |

### 1.2 CTIS Conversion Examples

```go
// Subdomain → CTIS Domain Asset
risAsset := ctis.Asset{
    ID:          "domain-api-example-com",
    Type:        ctis.AssetTypeDomain,
    Value:       "api.example.com",
    Name:        "API Subdomain",
    Criticality: ctis.CriticalityMedium,
    Confidence:  85,
    DiscoveredAt: &now,
    Technical: &ctis.AssetTechnical{
        Domain: &ctis.DomainTechnical{
            DNSRecords: []ctis.DNSRecord{
                {Type: "A", Name: "api.example.com", Value: "192.168.1.10", TTL: 300},
            },
            Nameservers: []string{"ns1.example.com", "ns2.example.com"},
        },
    },
}

// Open Ports → CTIS IP Address Asset
risAsset := ctis.Asset{
    ID:    "ip-192-168-1-10",
    Type:  ctis.AssetTypeIPAddress,
    Value: "192.168.1.10",
    Technical: &ctis.AssetTechnical{
        IPAddress: &ctis.IPAddressTechnical{
            Version:  4,
            Hostname: "api.example.com",
            Ports: []ctis.PortInfo{
                {Port: 80, Protocol: "tcp", State: "open", Service: "http"},
                {Port: 443, Protocol: "tcp", State: "open", Service: "https"},
            },
        },
    },
}

// HTTP Service → CTIS Service Asset
risAsset := ctis.Asset{
    ID:    "svc-https-api-example-com-443",
    Type:  ctis.AssetTypeService,
    Value: "https://api.example.com:443",
    Technical: &ctis.AssetTechnical{
        Service: &ctis.ServiceTechnical{
            Name:      "nginx",
            Version:   "1.21.0",
            Port:      443,
            Protocol:  "https",
            Transport: "tcp",
            TLS:       true,
            Banner:    "nginx/1.21.0",
        },
    },
    Properties: map[string]interface{}{
        "status_code":  200,
        "content_type": "application/json",
        "technologies": []string{"nginx", "react"},
    },
}
```

### 1.3 Asset Collection Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Asset Collection Flow                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Recon Tool Output                 CTIS Report Builder        API        │
│  ─────────────────                 ──────────────────        ───        │
│                                                                          │
│  Subfinder → subdomains ─────┐                                          │
│  DNSX → dns_records ─────────┤                                          │
│  Naabu → ports ──────────────┼──→  CTIS Asset Converter ──→ POST /ingest │
│  HTTPX → http_services ──────┤          │                               │
│  Katana → urls ──────────────┘          │                               │
│                                         ▼                               │
│                              ctis.Report{                                │
│                                  Version: "1.0",                        │
│                                  Assets: []ctis.Asset{...},              │
│                                  Findings: []ctis.Finding{...},          │
│                              }                                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Agent Specialization Architecture

### 2.1 Single Agent with Modular Executors

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Platform Agent Architecture                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  platform-agent binary                                                   │
│  │                                                                      │
│  ├── Core (always enabled)                                              │
│  │   ├── LeaseManager - K8s-style lease renewal                        │
│  │   ├── JobPoller - Long-poll for jobs                                │
│  │   ├── MetricsCollector - CPU/Memory/Disk                            │
│  │   ├── CTISReportBuilder - Convert tool output to CTIS                 │
│  │   └── ExecutorRouter - Route jobs to executors                      │
│  │                                                                      │
│  ├── Executor: Recon (--enable-recon)                                   │
│  │   ├── SubfinderExecutor - Subdomain enumeration                     │
│  │   ├── DNSXExecutor - DNS resolution                                 │
│  │   ├── NaabuExecutor - Port scanning                                 │
│  │   ├── HTTPXExecutor - HTTP probing                                  │
│  │   ├── KatanaExecutor - URL crawling                                 │
│  │   └── ReconPipelineExecutor - Multi-step recon                      │
│  │                                                                      │
│  ├── Executor: VulnScan (--enable-vulnscan)                             │
│  │   ├── NucleiExecutor - DAST/Web vulnerabilities                     │
│  │   ├── TrivyExecutor - Container/IaC scanning                        │
│  │   └── SemgrepExecutor - SAST                                        │
│  │                                                                      │
│  ├── Executor: SecretScan (--enable-secrets)                            │
│  │   ├── GitleaksExecutor - Git secret scanning                        │
│  │   └── TrufflehogExecutor - Credential scanning                      │
│  │                                                                      │
│  └── Executor: AssetCollector (--enable-assets)                         │
│      ├── AWSCollector - AWS asset discovery                            │
│      ├── GCPCollector - GCP asset discovery                            │
│      └── SCMCollector - GitHub/GitLab repos                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Agent Configuration

```yaml
# config.yaml
agent:
  name: "scanner-us-east-001"
  region: "us-east-1"
  max_jobs: 5
  lease_duration: 60s
  renew_interval: 20s

api:
  base_url: "https://api.openctem.io"

executors:
  recon:
    enabled: true
    tools:
      subfinder: true
      dnsx: true
      naabu: true
      httpx: true
      katana: true
    capabilities: [subdomain, dns, portscan, http, crawler, tech-detect]

  vulnscan:
    enabled: true
    tools:
      nuclei: true
      trivy: true
      semgrep: false
    capabilities: [dast, sca, iac, container]

  secrets:
    enabled: false
    capabilities: []

  assets:
    enabled: false
    capabilities: []
```

### 2.3 Executor Interfaces

```go
// platform-agent/internal/executor/interface.go

// Base interface for all executors
type Executor interface {
    Execute(ctx context.Context, job *platform.JobInfo) (*platform.JobResult, error)
    Capabilities() []string
    InstalledTools() []string
}

// CTISProducer - executors that produce CTIS reports
type CTISProducer interface {
    Executor
    ProduceCTIS(ctx context.Context, job *platform.JobInfo, result interface{}) (*ctis.Report, error)
}

// AssetProducer - executors that discover assets
type AssetProducer interface {
    CTISProducer
    ProduceAssets(ctx context.Context, output interface{}) ([]ctis.Asset, error)
}

// FindingProducer - executors that find vulnerabilities
type FindingProducer interface {
    CTISProducer
    ProduceFindings(ctx context.Context, output interface{}) ([]ctis.Finding, error)
}
```

### 2.4 Executor Router

```go
// platform-agent/internal/executor/router.go

type ExecutorRouter struct {
    config   *config.ExecutorConfig
    recon    *ReconExecutor      // nil if disabled
    vulnscan *VulnScanExecutor   // nil if disabled
    secrets  *SecretScanExecutor // nil if disabled
    assets   *AssetCollector     // nil if disabled
    pipeline *PipelineExecutor
}

func (r *ExecutorRouter) Route(job *platform.JobInfo) (Executor, error) {
    switch job.Type {
    case "recon":
        if r.recon == nil {
            return nil, ErrExecutorDisabled("recon")
        }
        return r.recon, nil

    case "scan":
        if r.vulnscan == nil {
            return nil, ErrExecutorDisabled("vulnscan")
        }
        return r.vulnscan.ForScanner(job.Payload["scanner"].(string))

    case "pipeline":
        return r.pipeline, nil

    default:
        return nil, fmt.Errorf("unknown job type: %s", job.Type)
    }
}

func (r *ExecutorRouter) Capabilities() []string {
    var caps []string
    if r.recon != nil {
        caps = append(caps, r.config.Recon.Capabilities...)
    }
    if r.vulnscan != nil {
        caps = append(caps, r.config.VulnScan.Capabilities...)
    }
    return caps
}
```

---

## Part 3: API Ingest Endpoint

### 3.1 CTIS Ingest Handler

```go
// api/internal/infra/http/handler/ingest_handler.go

// POST /api/v1/ingest/ctis
func (h *IngestHandler) IngestCTIS(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    var report ctis.Report
    if err := json.NewDecoder(r.Body).Decode(&report); err != nil {
        httputil.Error(w, http.StatusBadRequest, "invalid CTIS report", err)
        return
    }

    tenantID := r.Header.Get("X-Tenant-ID")
    jobID := r.Header.Get("X-Job-ID")

    // Ingest assets
    assetStats, _ := h.assetService.IngestCTISAssets(ctx, tenantID, report.Assets, jobID)

    // Ingest findings
    findingStats, _ := h.findingService.IngestCTISFindings(ctx, tenantID, report.Findings, jobID)

    httputil.JSON(w, http.StatusOK, map[string]interface{}{
        "status":   "success",
        "assets":   assetStats,
        "findings": findingStats,
    })
}
```

### 3.2 Asset Upsert Logic

```go
// api/internal/app/asset_service.go

func (s *AssetService) IngestCTISAssets(ctx context.Context, tenantID string, assets []ctis.Asset, jobID string) (*AssetIngestStats, error) {
    stats := &AssetIngestStats{}

    for _, risAsset := range assets {
        domainAsset := s.convertCTISAsset(tenantID, risAsset, jobID)

        // Find existing by value + type
        existing, err := s.repo.FindByValue(ctx, tenantID, risAsset.Value, string(risAsset.Type))
        if err != nil && !errors.Is(err, ErrNotFound) {
            return nil, err
        }

        if existing != nil {
            // Update existing - preserve firstSeen
            domainAsset.ID = existing.ID
            domainAsset.FirstSeen = existing.FirstSeen
            domainAsset.LastSeen = time.Now()
            s.repo.Update(ctx, domainAsset)
            stats.Updated++
        } else {
            // Create new
            domainAsset.FirstSeen = time.Now()
            domainAsset.LastSeen = time.Now()
            s.repo.Create(ctx, domainAsset)
            stats.Created++
        }
    }
    return stats, nil
}
```

---

## Part 4: Database Strategy

### 4.1 JSONB Storage (No New Tables)

Store CTIS Technical details in `assets.properties` JSONB:

```sql
-- Example: Store DNSX results
INSERT INTO assets (tenant_id, name, asset_type, properties) VALUES (
    '...',
    'example.com',
    'domain',
    '{
        "domain": {
            "dns_records": [
                {"type": "A", "name": "example.com", "value": "1.2.3.4", "ttl": 300}
            ],
            "nameservers": ["ns1.example.com"]
        }
    }'
);

-- Example: Store Naabu results
INSERT INTO assets (tenant_id, name, asset_type, properties) VALUES (
    '...',
    '1.2.3.4',
    'ip_address',
    '{
        "ip_address": {
            "version": 4,
            "ports": [
                {"port": 80, "protocol": "tcp", "state": "open"},
                {"port": 443, "protocol": "tcp", "state": "open"}
            ]
        }
    }'
);
```

### 4.2 JSONB Query Indexes

```sql
-- GIN indexes for JSONB queries
CREATE INDEX idx_assets_properties_domain_dns
ON assets USING GIN ((properties->'domain'->'dns_records'))
WHERE asset_type IN ('domain', 'subdomain');

CREATE INDEX idx_assets_properties_ip_ports
ON assets USING GIN ((properties->'ip_address'->'ports'))
WHERE asset_type = 'ip_address';

CREATE INDEX idx_assets_properties_service
ON assets USING GIN ((properties->'service'))
WHERE asset_type IN ('service', 'http_service');
```

### 4.3 Example Queries

```sql
-- Find all assets with open port 443
SELECT * FROM assets
WHERE properties->'ip_address'->'ports' @> '[{"port": 443, "state": "open"}]';

-- Find all domains with specific DNS record
SELECT * FROM assets
WHERE properties->'domain'->'dns_records' @> '[{"type": "A", "value": "1.2.3.4"}]';

-- Count open ports per asset
SELECT name, jsonb_array_length(properties->'ip_address'->'ports') as port_count
FROM assets WHERE asset_type = 'ip_address';
```

---

## Part 5: Deployment Configurations

### 5.1 Recon-Only Agent

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: platform-agent-recon
  labels:
    app: platform-agent
    role: recon
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: agent
        image: ghcr.io/openctemio/platform-agent:latest
        args:
          - --enable-recon
          - --disable-vulnscan
          - --disable-secrets
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi
        securityContext:
          capabilities:
            add: [NET_RAW]  # Required for naabu
```

### 5.2 VulnScan Agent

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: platform-agent-vulnscan
  labels:
    role: vulnscan
spec:
  replicas: 5
  template:
    spec:
      containers:
      - name: agent
        image: ghcr.io/openctemio/platform-agent:latest
        args:
          - --disable-recon
          - --enable-vulnscan
        resources:
          requests:
            cpu: 1000m
            memory: 2Gi
          limits:
            cpu: 4000m
            memory: 8Gi  # Nuclei/Trivy need more
```

### 5.3 Full-Featured Agent (Dev)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: platform-agent-full
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: agent
        args:
          - --enable-recon
          - --enable-vulnscan
          - --enable-secrets
          - --enable-assets
        resources:
          limits:
            cpu: 4000m
            memory: 8Gi
        securityContext:
          capabilities:
            add: [NET_RAW]
```

---

## Part 6: Implementation Roadmap

### Phase 4: CTIS Integration (DONE)

| Task | Files | Status |
|------|-------|--------|
| CTIS asset converters | `sdk/pkg/ctis/recon_converter.go` | ✅ DONE |
| CTIS ingest service | `api/internal/app/ctis_ingest_service.go` | ✅ DONE |
| CTIS ingest handler | `api/internal/infra/http/handler/ctis_ingest_handler.go` | ✅ DONE |
| Asset upsert logic | `api/internal/app/ctis_ingest_service.go` | ✅ DONE |
| JSONB indexes | `api/migrations/000112_jsonb_property_indexes.up.sql` | ✅ DONE |

### Phase 5: Agent Specialization (DONE)

| Task | Files | Status |
|------|-------|--------|
| Executor interfaces | `agent/internal/executor/interface.go` | ✅ DONE |
| ExecutorRouter | `agent/internal/executor/router.go` | ✅ DONE |
| ReconExecutor | `agent/internal/executor/recon.go` | ✅ DONE |
| Executor config | `agent/internal/config/config.go` | ✅ DONE |
| K8s deployment templates | `docs/implement/*.md` (examples in doc) | ✅ DONE |

---

## Summary

### What's Completed (Phase 1-5)
- ✅ SDK ReconScanner interface with 5 tools (subfinder, dnsx, naabu, httpx, katana)
- ✅ API ValidScanners whitelist and capabilities migration
- ✅ Pipeline Engine with JobExecutor and built-in templates
- ✅ CTIS asset/finding converters for recon tools
- ✅ API ingest endpoint with batch upsert logic
- ✅ JSONB indexes for efficient queries (migration 000112)
- ✅ Executor router with enable/disable flags
- ✅ Modular ReconExecutor with tool wrappers
- ✅ Configuration system for executor modules

### Implementation Files

**Agent Executor System:**
- `agent/internal/executor/interface.go` - Core interfaces (Executor, ToolExecutor, CTISProducer)
- `agent/internal/executor/router.go` - ExecutorRouter for job routing
- `agent/internal/executor/recon.go` - ReconExecutor with 5 tool wrappers
- `agent/internal/config/config.go` - Modular configuration system

**API CTIS Ingestion:**
- `api/internal/app/ctis_ingest_service.go` - Batch asset/finding ingestion
- `api/internal/infra/http/handler/ctis_ingest_handler.go` - HTTP endpoints
- `sdk/pkg/ctis/recon_converter.go` - Recon → CTIS conversion

### Key Benefits
- **Reuse**: Leverage existing CTIS schema and domain entities
- **Flexibility**: Enable/disable features per deployment
- **Scalability**: Specialized agents can scale independently
- **CTEM Alignment**: Feeds into CTEM Phase 0 services table
