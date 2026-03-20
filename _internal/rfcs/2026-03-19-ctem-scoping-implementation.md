# RFC: CTEM Scoping — Business Context, Crown Jewels & Compliance Mapping

**Created:** 2026-03-19
**Status:** Proposed
**Priority:** P1 (Phase 1 — Scoping)
**Author:** Architecture Review
**Last Updated:** 2026-03-19
**Estimated Effort:** 4 tuần (2 phases × 2 tuần)
**CTEM Phase:** Phase 1: Scoping (3/5 → 5/5)

---

## 1. Executive Summary

CTEM Scoping là nền tảng ("the foundation of any CTEM program" — Gartner). OpenCTEM đã có hạ tầng Scoping mạnh (30+ asset types, risk scoring, asset groups, scope/exposure levels) nhưng thiếu **business context** — khả năng trả lời "tài sản nào quan trọng nhất cho doanh nghiệp và tại sao?"

RFC này hoàn thiện Scoping bằng 3 capabilities:

| # | Capability | Vấn đề giải quyết |
|---|-----------|-------------------|
| 1 | **Business Units** | "Phòng ban nào chịu trách nhiệm? Risk theo business unit?" |
| 2 | **Crown Jewels** | "Tài sản nào quan trọng nhất? Ưu tiên bảo vệ gì?" |
| 3 | **Compliance Posture** | "Compliance status thế nào? Gap ở đâu?" |

---

## 2. Hiện Trạng — Đã Có Gì?

### 2.1 Nền Tảng Rất Mạnh

| Component | Trạng thái | Chi tiết |
|-----------|-----------|---------|
| **30+ Asset Types** | ✅ Production | domain, host, container, cloud, IAM, database, network, repo... |
| **Asset Criticality** | ✅ Production | critical, high, medium, low, none |
| **Asset Exposure** | ✅ Production | public, restricted, private, isolated, unknown |
| **Asset Scope** | ✅ Production | internal, external, cloud, partner, vendor, shadow |
| **Risk Scoring Engine** | ✅ Production | 6 presets, configurable weights (exposure × criticality × findings × CTEM) |
| **Asset Groups** | ✅ Production | 5 group types: security_team, team, **department**, project, external |
| **Scope Rules** | ✅ Production | Auto-assign assets to groups by properties |
| **Assignment Rules** | ✅ Production | Auto-route findings to groups |
| **Asset Relationships** | ✅ Production | 16 relationship types (runs_on, depends_on, authenticates_to...) |
| **Asset Owner** | ✅ Production | ownerID field on asset entity |
| **Compliance Frameworks** | ✅ Production | Framework → Controls → FindingControlMapping (SOC2, ISO27001 seeded) |
| **Data Scope** | ✅ Production | User → Groups → Assets → Findings (materialized view) |

### 2.2 Cái Thiếu

```
1. BUSINESS UNITS — không có entity riêng
   Groups có type "department" nhưng không có:
   - Hierarchy (Engineering → Backend → API Team)
   - Business Unit metadata (revenue impact, compliance scope)
   - Risk aggregation per business unit
   - Dashboard view per business unit

2. CROWN JEWELS — không có cách đánh dấu
   Asset có "criticality" nhưng:
   - Không có "crown jewel" flag riêng biệt
   - Không có impact classification (revenue, reputation, regulatory)
   - Không có dependency mapping (crown jewel ← depends_on ← N assets)
   - Không highlight crown jewels trong findings/campaigns

3. COMPLIANCE POSTURE — có framework nhưng chưa có posture view
   - Framework + Controls + Mapping đã có
   - Thiếu: posture dashboard (bao nhiêu % controls satisfied?)
   - Thiếu: auto-mapping (finding type X → control Y)
   - Thiếu: gap analysis view (controls chưa covered)
```

---

## 3. Nghiên Cứu Industry

### 3.1 Tenable One — Asset Criticality Rating (ACR)

```
Tenable ACR (1-10):
  - Tự động tính dựa trên: business purpose, asset type, location,
    connectivity, capabilities, third-party data
  - Crown Jewels = assets có ACR ≥ 7
  - Top Attack Path Matrix hiển thị paths dẫn đến Crown Jewels
  - Business-aligned Cyber Exposure Score per business service
```

### 3.2 Wiz — Business Context

```
Wiz cung cấp:
  - Business unit assignment cho cloud resources
  - Data classification (sensitive, PII, financial)
  - Owner identification (infrastructure, app, BU, developer)
  - Compliance tags per resource
  - Context-enriched findings (BU + sensitivity + exposure)
```

### 3.3 Gartner CTEM Scoping Guidance

```
Gartner khuyến nghị:
  1. Bắt đầu narrow: external attack surface HOẶC critical cloud apps
  2. Xác định crown jewels: "assets nào bị compromise sẽ gây thiệt hại lớn nhất?"
  3. Liên kết với business: revenue impact, regulatory risk, reputation damage
  4. Collaborative: security team + business stakeholders cùng define scope
  5. Mở rộng dần: thêm SaaS, identity, shadow IT theo maturity
```

---

## 4. Thiết Kế

### 4.1 Quyết Định Kiến Trúc: Mở Rộng, Không Tạo Mới

**Business Units = Mở rộng Groups entity (đã có `department` type)**

Tại sao không tạo entity mới:
- Groups đã có: hierarchy (planned), member management, data scope, permissions
- `GroupType = "department"` đã tồn tại — chỉ cần thêm metadata
- Tạo entity mới = duplicate user management, permission checks, scope rules
- Asset ↔ Group relationship đã wired end-to-end

```
Thay vì:
  business_units table (MỚI) + user_business_units + asset_business_units + ...

Làm:
  groups table (ĐÃ CÓ) + group_business_metadata (MỚI, 1 table nhỏ)
  GroupType = "business_unit" (thêm 1 enum value)
```

**Crown Jewels = Mở rộng Asset entity (thêm fields)**

```
Thay vì:
  crown_jewels table (MỚI) + crown_jewel_assets + ...

Làm:
  assets table (ĐÃ CÓ) + thêm is_crown_jewel BOOLEAN + impact_categories JSONB
```

**Compliance Posture = Query layer trên entities đã có**

```
Thay vì:
  compliance_posture table (MỚI, duplicate data)

Làm:
  Query: frameworks × controls × finding_control_mappings × findings
  Aggregate: bao nhiêu controls satisfied / violated / not assessed
```

### 4.2 Database Schema

```sql
-- =============================================================
-- Migration: CTEM Scoping
-- =============================================================

-- 1. Thêm GroupType "business_unit"
-- (groups table đã có, chỉ cần thêm check constraint nếu có)
-- GroupType enum đã là VARCHAR, không cần migration cho enum value

-- 2. Business Unit metadata extension (cho groups có type = business_unit)
CREATE TABLE group_business_metadata (
    group_id UUID PRIMARY KEY REFERENCES groups(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Business context
    business_unit_code VARCHAR(50),      -- "ENG", "FIN", "OPS"
    cost_center VARCHAR(50),
    revenue_impact VARCHAR(20) DEFAULT 'unknown'
        CHECK (revenue_impact IN ('critical', 'high', 'medium', 'low', 'none', 'unknown')),
    regulatory_scope TEXT[] DEFAULT '{}',
    -- ["PCI-DSS", "SOC2", "HIPAA"] — frameworks áp dụng cho BU này

    -- Contact
    business_owner_name VARCHAR(255),
    business_owner_email VARCHAR(255),
    technical_lead_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Risk aggregation (cached, refreshed by background job)
    risk_summary JSONB DEFAULT '{}'::jsonb,
    -- {
    --   "total_assets": 150,
    --   "crown_jewels": 5,
    --   "avg_risk_score": 62,
    --   "critical_findings": 23,
    --   "high_findings": 45,
    --   "open_exposures": 8,
    --   "compliance_score": 78.5,
    --   "updated_at": "2026-03-19T10:00:00Z"
    -- }

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gbm_tenant ON group_business_metadata(tenant_id);
CREATE INDEX idx_gbm_code ON group_business_metadata(tenant_id, business_unit_code);


-- 3. Crown Jewel fields trên assets (ALTER TABLE, không tạo table mới)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS is_crown_jewel BOOLEAN DEFAULT FALSE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS crown_jewel_reason TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS impact_categories JSONB DEFAULT '[]'::jsonb;
-- impact_categories ví dụ:
-- [
--   {"category": "revenue", "level": "critical", "description": "Processes $2M/month"},
--   {"category": "regulatory", "level": "high", "description": "Stores PII under GDPR"},
--   {"category": "reputation", "level": "medium", "description": "Customer-facing portal"},
--   {"category": "operational", "level": "high", "description": "Core payment gateway"}
-- ]

ALTER TABLE assets ADD COLUMN IF NOT EXISTS data_classification VARCHAR(30)
    DEFAULT 'unclassified';
-- data_classification: public, internal, confidential, restricted, unclassified

CREATE INDEX idx_assets_crown_jewel ON assets(tenant_id, is_crown_jewel)
    WHERE is_crown_jewel = TRUE;
CREATE INDEX idx_assets_data_class ON assets(tenant_id, data_classification)
    WHERE data_classification != 'unclassified';


-- 4. Compliance assessment tracking (link controls to status)
CREATE TABLE compliance_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    framework_id UUID NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
    control_id UUID NOT NULL REFERENCES compliance_controls(id) ON DELETE CASCADE,

    -- Assessment
    status VARCHAR(30) NOT NULL DEFAULT 'not_assessed'
        CHECK (status IN (
            'not_assessed',      -- Chưa đánh giá
            'compliant',         -- Đạt
            'non_compliant',     -- Không đạt
            'partially_compliant', -- Đạt một phần
            'not_applicable'     -- Không áp dụng
        )),

    -- Evidence
    evidence_notes TEXT,
    evidence_finding_count INT DEFAULT 0,   -- Số findings liên quan
    evidence_exposure_count INT DEFAULT 0,  -- Số exposures liên quan

    -- Assignment
    assessor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assessed_at TIMESTAMPTZ,
    next_review_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (tenant_id, framework_id, control_id)
);

CREATE INDEX idx_ca_framework ON compliance_assessments(tenant_id, framework_id);
CREATE INDEX idx_ca_status ON compliance_assessments(tenant_id, status);
CREATE INDEX idx_ca_review ON compliance_assessments(next_review_at)
    WHERE status != 'not_applicable';


-- 5. Auto-mapping rules: finding properties → compliance controls
CREATE TABLE compliance_auto_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    -- tenant_id NULL = system-level mapping (shared)

    framework_id UUID NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
    control_id UUID NOT NULL REFERENCES compliance_controls(id) ON DELETE CASCADE,

    -- Matching conditions
    finding_source VARCHAR(50),      -- sast, dast, sca, secret, iac, cspm...
    finding_type VARCHAR(50),        -- vulnerability, misconfiguration, secret, compliance
    cwe_ids TEXT[] DEFAULT '{}',     -- ["CWE-89", "CWE-79"]
    severity_min VARCHAR(20),        -- minimum severity to match
    tag_pattern VARCHAR(255),        -- asset tag pattern

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cam_framework ON compliance_auto_mappings(framework_id);
CREATE INDEX idx_cam_active ON compliance_auto_mappings(is_active) WHERE is_active = TRUE;


-- 6. Permissions
INSERT INTO permissions (id, module, display_name, description) VALUES
    ('scoping:business_units:read', 'scoping', 'View Business Units', 'View business units and metadata'),
    ('scoping:business_units:write', 'scoping', 'Manage Business Units', 'Create and manage business units'),
    ('scoping:crown_jewels:read', 'scoping', 'View Crown Jewels', 'View crown jewel designations'),
    ('scoping:crown_jewels:write', 'scoping', 'Manage Crown Jewels', 'Designate and manage crown jewels'),
    ('compliance:assessments:read', 'compliance', 'View Assessments', 'View compliance assessments'),
    ('compliance:assessments:write', 'compliance', 'Manage Assessments', 'Perform compliance assessments')
ON CONFLICT (id) DO NOTHING;
```

### 4.3 Domain Model

```
scoping (mở rộng, không phải package mới)
├── asset entity: +is_crown_jewel, +impact_categories, +data_classification
├── group entity: +GroupType "business_unit"
├── group_business_metadata: extension cho BU groups

compliance (mở rộng package đã có)
├── assessment.go              ComplianceAssessment entity (MỚI)
├── auto_mapping.go            Auto-mapping rules (MỚI)
├── framework.go               (đã có)
├── control.go                 (đã có)
├── mapping.go                 FindingControlMapping (đã có)
├── posture.go                 CompliancePosture query result (MỚI)
└── repository.go              +Assessment & AutoMapping repos
```

---

## 5. API Design

### 5.1 Business Units

```
# Business Units = Groups với type "business_unit" + metadata

# Tạo Business Unit (tạo group + metadata cùng lúc)
POST /api/v1/scoping/business-units
{
  "name": "Engineering",
  "slug": "engineering",
  "business_unit_code": "ENG",
  "revenue_impact": "critical",
  "regulatory_scope": ["SOC2", "ISO27001"],
  "business_owner_name": "CTO Name",
  "business_owner_email": "cto@company.com",
  "technical_lead_id": "user-uuid"
}
→ Internally: creates Group(type=business_unit) + group_business_metadata

# List Business Units (with risk summary)
GET /api/v1/scoping/business-units
→ Returns groups(type=business_unit) + metadata + risk_summary

# Get BU detail (assets, findings, risk breakdown)
GET /api/v1/scoping/business-units/{id}
GET /api/v1/scoping/business-units/{id}/assets
GET /api/v1/scoping/business-units/{id}/risk-summary

# Assign assets to BU (tận dụng existing group membership)
POST /api/v1/scoping/business-units/{id}/assets
{"asset_ids": ["uuid1", "uuid2"]}
→ Internally: add assets to group

# BU Risk Dashboard
GET /api/v1/scoping/business-units/dashboard
→ All BUs with risk scores, crown jewel count, compliance scores
```

### 5.2 Crown Jewels

```
# Designate asset as Crown Jewel
PATCH /api/v1/assets/{id}/crown-jewel
{
  "is_crown_jewel": true,
  "crown_jewel_reason": "Core payment processing gateway",
  "impact_categories": [
    {"category": "revenue", "level": "critical", "description": "Processes $2M/month"},
    {"category": "regulatory", "level": "high", "description": "PCI-DSS scope"}
  ],
  "data_classification": "restricted"
}

# List Crown Jewels
GET /api/v1/scoping/crown-jewels
    ?data_classification=restricted,confidential
    &impact_category=revenue
→ Returns assets WHERE is_crown_jewel = true, enriched with findings/exposures

# Crown Jewel dashboard
GET /api/v1/scoping/crown-jewels/dashboard
→ Summary: total crown jewels, risk scores, open findings, exposure status

# Crown Jewel dependencies (tận dụng asset relationships đã có)
GET /api/v1/scoping/crown-jewels/{id}/dependencies
→ Uses asset_relationships: all assets that this crown jewel depends_on,
  runs_on, authenticates_to, stores_data_in
→ "Crown Jewel X depends on 15 assets, 3 have critical findings"

# Bulk designate
POST /api/v1/scoping/crown-jewels/bulk
{"asset_ids": ["uuid1", "uuid2"], "reason": "Payment infrastructure",
 "impact_categories": [...], "data_classification": "restricted"}
```

### 5.3 Compliance Posture

```
# Compliance Posture Dashboard
GET /api/v1/compliance/posture
    ?framework_id=soc2-uuid
→ {
    "framework": {"name": "SOC2", "total_controls": 64},
    "posture": {
      "compliant": 42,
      "non_compliant": 8,
      "partially_compliant": 5,
      "not_assessed": 7,
      "not_applicable": 2,
      "compliance_score": 79.2
    },
    "by_category": [
      {"category": "CC6 - Logical Access", "compliant": 8, "total": 12, "pct": 66.7},
      {"category": "CC7 - System Operations", "compliant": 10, "total": 10, "pct": 100}
    ],
    "findings_by_impact": {
      "direct_violation": 23,
      "risk_indicator": 45,
      "supporting_evidence": 12
    }
  }

# Assess individual control
PUT /api/v1/compliance/assessments
{
  "framework_id": "soc2-uuid",
  "control_id": "cc6-1-uuid",
  "status": "compliant",
  "evidence_notes": "MFA enforced for all users, verified via IAM audit",
  "next_review_at": "2026-06-01"
}

# Auto-mapping: "finding source=iac → CIS Benchmark controls"
POST /api/v1/compliance/auto-mappings
{
  "framework_id": "cis-uuid",
  "control_id": "4.1-uuid",
  "finding_source": "iac",
  "finding_type": "misconfiguration",
  "cwe_ids": ["CWE-16"],
  "is_active": true
}

# Gap analysis
GET /api/v1/compliance/gaps?framework_id=soc2-uuid
→ Controls chưa có evidence (not_assessed) hoặc non_compliant
→ Suggested actions: "Run IaC scan to assess CC7 controls"

# Compliance report (cho auditor)
GET /api/v1/compliance/report?framework_id=soc2-uuid&format=pdf
→ PDF report: posture summary, control details, evidence, gaps
```

---

## 6. Kết Nối Với Hệ Thống Đã Có

### 6.1 Risk Scoring Integration

```
Asset Risk Score đã có formula:
  risk_score = exposure_weight × exposure_score
             + criticality_weight × criticality_score
             + findings_weight × findings_impact
             + ctem_weight × ctem_points

Crown Jewel impact:
  → Crown jewels tự động có criticality = "critical" (nếu chưa set)
  → Hoặc thêm crown_jewel_multiplier vào risk scoring config
  → Ví dụ: crown jewel × 1.5 (configurable trong tenant settings)

Business Unit risk:
  → BU risk = AVG(asset.risk_score) WHERE asset IN BU
  → Cached trong group_business_metadata.risk_summary
  → Refreshed bởi existing risk scoring background job
```

### 6.2 Campaign Integration

```
Campaign scope_filter mở rộng:
{
  "cve_ids": ["CVE-2021-44228"],
  "is_crown_jewel": true,              // ← MỚI: chỉ crown jewels
  "business_unit_id": "eng-uuid",      // ← MỚI: chỉ BU Engineering
  "data_classification": ["restricted"], // ← MỚI
  "compliance_framework": "pci-dss"     // ← MỚI: findings vi phạm PCI-DSS
}

→ Campaign "Fix Log4j on Crown Jewels first" — ưu tiên crown jewels
→ Campaign "PCI-DSS Compliance Remediation" — fix findings vi phạm PCI
```

### 6.3 Findings Integration

```
Finding listing thêm filters:
  GET /api/v1/findings?is_crown_jewel=true
  GET /api/v1/findings?business_unit_id=eng-uuid
  GET /api/v1/findings?compliance_control_id=cc6-1-uuid

Vulnerability Groups thêm:
  group_by=business_unit       // Risk per business unit
  group_by=data_classification // Findings on restricted vs public data
  group_by=compliance_framework // Findings by compliance framework
```

### 6.4 Dashboard Integration

```
CTEM Dashboard thêm widgets:
  ┌────────────────────────────────────────────────────────────────┐
  │ Crown Jewels Status                                           │
  │ 🔴 3 Crown Jewels with Critical Findings                     │
  │ 🟡 2 Crown Jewels with High Findings                         │
  │ 🟢 10 Crown Jewels Fully Secured                             │
  │ Total: 15 Crown Jewels │ Avg Risk: 72                        │
  └────────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────────┐
  │ Business Unit Risk                                            │
  │                                                                │
  │ Engineering    ████████████████████░░░░░  Risk: 78  ▲ +5      │
  │ Finance        ████████████░░░░░░░░░░░░  Risk: 52  ▼ -3      │
  │ Operations     ██████████████████████░░  Risk: 85  ▲ +12     │
  │ HR             ████████░░░░░░░░░░░░░░░  Risk: 35  ═ 0       │
  └────────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────────┐
  │ Compliance Posture                                            │
  │                                                                │
  │ SOC2       ████████████████████░░░░░░  79% compliant          │
  │ PCI-DSS    ████████████████████████░░  92% compliant          │
  │ ISO27001   ██████████████░░░░░░░░░░░  58% compliant          │
  └────────────────────────────────────────────────────────────────┘
```

---

## 7. Background Jobs

```go
// BU Risk Summary Refresher (mở rộng existing risk scoring job)
// Interval: 15 phút (cùng với asset risk score refresh)

func refreshBusinessUnitRiskSummaries(ctx context.Context) {
    // 1. Lấy tất cả groups type=business_unit
    // 2. Cho mỗi BU: aggregate asset risk scores, finding counts, exposure counts
    // 3. Update group_business_metadata.risk_summary
}

// Compliance Auto-Mapping (khi finding mới được tạo)
// Trigger: finding_created event (workflow hoặc hook)

func autoMapFindingToControls(ctx context.Context, finding) {
    // 1. Lấy active auto_mappings matching finding.source + finding.type + CWEs
    // 2. Tạo finding_control_mappings
    // 3. Update compliance_assessments evidence counts
}

// Compliance Posture Refresh
// Interval: 1 giờ

func refreshCompliancePosture(ctx context.Context) {
    // 1. Cho mỗi framework:
    //    COUNT controls BY status (compliant, non_compliant, ...)
    // 2. Update evidence counts từ finding_control_mappings
    // 3. Flag controls cần review (next_review_at <= now)
}
```

---

## 8. Implementation Phases

### Phase 1 (Tuần 1-2): Crown Jewels + Business Units

| Task | Layer | Est. |
|------|-------|------|
| Migration: ALTER assets + group_business_metadata + permissions | DB | 0.5d |
| Asset entity: thêm crown jewel fields + methods | Domain | 0.5d |
| Group entity: thêm GroupType "business_unit" | Domain | 0.25d |
| BusinessMetadata entity + repository | Domain+Infra | 1d |
| Crown Jewel service (designate, list, dashboard, dependencies) | App | 1.5d |
| Business Unit service (CRUD, risk summary, asset assignment) | App | 1.5d |
| Crown Jewel handler + routes | HTTP | 1d |
| Business Unit handler + routes | HTTP | 1d |
| Risk scoring: crown jewel multiplier | App (extend) | 0.5d |
| BU risk summary background job | Controller | 0.5d |
| Unit tests | Tests | 1.5d |

**Deliverables:**
- Crown Jewels: designate, list, dashboard, dependency view
- Business Units: CRUD, asset assignment, risk aggregation
- Risk scoring enhancement: crown jewel multiplier

### Phase 2 (Tuần 3-4): Compliance Posture + Frontend + Integration

| Task | Layer | Est. |
|------|-------|------|
| Migration: compliance_assessments + compliance_auto_mappings | DB | 0.5d |
| ComplianceAssessment entity + repository | Domain+Infra | 1d |
| AutoMapping entity + repository | Domain+Infra | 0.5d |
| Compliance posture service (dashboard, gap analysis, auto-map) | App | 2d |
| Compliance posture handler + routes | HTTP | 1d |
| Auto-mapping on finding creation (hook into ingest) | App (extend) | 0.5d |
| Compliance posture refresh job | Controller | 0.5d |
| Frontend: Crown Jewels page | UI | 1.5d |
| Frontend: Business Units page + risk dashboard | UI | 1.5d |
| Frontend: Compliance Posture dashboard | UI | 1.5d |
| Frontend: CTEM Dashboard widgets (3 widgets) | UI | 1d |
| Integration tests + documentation | Tests+Docs | 1d |

**Deliverables:**
- Compliance: posture dashboard, assessments, auto-mapping, gap analysis
- Full frontend for all 3 capabilities
- CTEM Dashboard integration

---

## 9. File Impact

### New Files (~20 files)

```
api/
├── internal/
│   ├── app/
│   │   ├── crown_jewel_service.go
│   │   ├── business_unit_service.go
│   │   └── compliance_posture_service.go
│   ├── infra/
│   │   ├── postgres/
│   │   │   ├── business_metadata_repository.go
│   │   │   └── compliance_assessment_repository.go
│   │   ├── http/handler/
│   │   │   ├── crown_jewel_handler.go
│   │   │   ├── business_unit_handler.go
│   │   │   └── compliance_posture_handler.go
│   │   └── http/routes/
│   │       └── scoping.go
├── pkg/domain/compliance/
│   ├── assessment.go        (MỚI)
│   ├── auto_mapping.go      (MỚI)
│   └── posture.go           (MỚI — query result types)
├── migrations/
│   ├── 000097_ctem_scoping.up.sql
│   └── 000097_ctem_scoping.down.sql
└── tests/unit/
    ├── crown_jewel_service_test.go
    ├── business_unit_service_test.go
    └── compliance_posture_test.go

ui/src/
├── features/scoping/
│   ├── components/
│   │   ├── crown-jewels-list.tsx
│   │   ├── crown-jewel-designate-dialog.tsx
│   │   ├── business-unit-list.tsx
│   │   ├── business-unit-risk-card.tsx
│   │   └── compliance-posture-dashboard.tsx
│   ├── api/
│   │   ├── use-crown-jewels.ts
│   │   ├── use-business-units.ts
│   │   └── use-compliance-posture.ts
│   └── types/
│       └── scoping.types.ts
└── app/(dashboard)/scoping/
    ├── crown-jewels/page.tsx
    ├── business-units/page.tsx
    └── compliance/page.tsx
```

### Modified Files (~10 files)

```
api/
├── pkg/domain/asset/entity.go             (+is_crown_jewel, +impact_categories, +data_classification)
├── pkg/domain/asset/value_objects.go       (+DataClassification enum)
├── pkg/domain/group/value_objects.go       (+GroupTypeBusinessUnit)
├── pkg/domain/permission/permission.go     (+6 permissions)
├── internal/infra/postgres/asset_repository.go  (+crown jewel filters)
├── internal/app/ingest/processor_findings.go    (+compliance auto-mapping hook)
├── cmd/server/services.go                  (+crown_jewel, business_unit, compliance_posture services)
├── cmd/server/handlers.go                  (+handlers)

ui/
├── src/app/(dashboard)/page.tsx            (+3 dashboard widgets)
├── src/config/sidebar-data.ts              (+scoping navigation)
```

---

## 10. Success Metrics

| Metric | Trước | Sau |
|--------|-------|-----|
| "Tài sản nào quan trọng nhất?" | Không trả lời được | Crown Jewels dashboard: 15 assets, avg risk 72 |
| "Risk của Engineering team?" | Filter thủ công | BU dashboard: risk 78, trend ▲+5 |
| "SOC2 compliance thế nào?" | Excel spreadsheet | Posture dashboard: 79% compliant, 8 gaps |
| Crown jewel findings ưu tiên | Dựa vào criticality thủ công | Auto-escalate, campaign targeting |
| Compliance audit preparation | Tuần | Giờ (auto-mapping + posture report) |

**CTEM Phase 1 Score: 3/5 → 5/5**

---

## 11. Tổng Kết

| Capability | Approach | Tables mới | Effort |
|-----------|---------|-----------|--------|
| Business Units | Mở rộng Groups entity (type=business_unit) + metadata table | 1 | 1 tuần |
| Crown Jewels | Mở rộng Asset entity (3 fields) | 0 (ALTER TABLE) | 0.5 tuần |
| Compliance Posture | Assessments + Auto-mappings trên compliance đã có | 2 | 1.5 tuần |
| **Tổng** | **Tận dụng 90% hạ tầng đã có** | **3 tables + 3 columns** | **4 tuần** |

Nguyên tắc thiết kế: **mở rộng entities đã có, không tạo mới khi không cần thiết.** Groups → Business Units. Assets → Crown Jewels. Compliance frameworks → Posture dashboard.

---

## 12. Self-Review: Đánh Giá Lại RFC Này

### 12.1 Những Gì RFC Này Làm Tốt

- Tận dụng 90% hạ tầng đã có (không reinvent)
- Crown Jewels + Business Units + Compliance = đúng 3 pillars cần cho Scoping
- Effort thực tế (4 tuần), không over-engineer

### 12.2 Những Gì Cần Bổ Sung

**A. SCOPING DASHBOARD — thứ quan trọng nhất đang thiếu**

CTEM Scoping mục đích chính: **"Đang giám sát gì, chưa giám sát gì, điểm mù ở đâu?"**

RFC hiện tại thêm data (BU, Crown Jewels, Compliance) nhưng thiếu insight layer — dashboard tổng hợp trả lời câu hỏi trên.

```
Thêm: GET /api/v1/scoping/coverage-dashboard

Response:
{
  "attack_surface_coverage": {
    "external": {
      "total_assets": 475,
      "scanned_assets": 450,
      "unscanned_assets": 25,
      "coverage_pct": 94.7,
      "last_scan": "2026-03-18T02:00:00Z"
    },
    "cloud": {
      "total_assets": 120,
      "scanned_assets": 96,
      "coverage_pct": 80.0,
      "blind_spots": ["AWS account prod-3 not connected"]
    },
    "code": {
      "total_assets": 50,
      "scanned_assets": 35,
      "coverage_pct": 70.0,
      "blind_spots": ["15 repos have no SAST scanner configured"]
    },
    "identity": {
      "total_assets": 30,
      "scanned_assets": 0,
      "coverage_pct": 0,
      "blind_spots": ["No IAM scanning configured — CRITICAL GAP"]
    }
  },
  "crown_jewel_coverage": {
    "total": 15,
    "fully_monitored": 12,
    "partially_monitored": 2,
    "no_monitoring": 1,
    "gaps": [
      {"asset": "payment-db", "missing": ["No vulnerability scan in 30 days"]}
    ]
  },
  "business_unit_coverage": {
    "units": [
      {"name": "Engineering", "coverage_pct": 95, "crown_jewels": 8, "risk": 78},
      {"name": "Finance", "coverage_pct": 40, "crown_jewels": 4, "risk": 52}
    ]
  },
  "compliance_coverage": {
    "frameworks": [
      {"name": "SOC2", "assessed_pct": 82, "compliant_pct": 79, "gaps": 8},
      {"name": "PCI-DSS", "assessed_pct": 95, "compliant_pct": 92, "gaps": 3}
    ]
  }
}
```

```
UI: Scoping Dashboard

┌──────────────────────────────────────────────────────────────────────┐
│ CTEM SCOPING — Attack Surface Coverage                              │
│                                                                      │
│ External  ████████████████████████████████████████████████░░  94.7%  │
│ Cloud     ████████████████████████████████░░░░░░░░░░░░░░░░  80.0%  │
│ Code      ████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░  70.0%  │
│ Identity  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   0.0%  │
│           ↑ CRITICAL: No identity scanning configured                │
│                                                                      │
│ ⚠️ Blind Spots: 3                                                    │
│   • 25 external domains not scanned                                  │
│   • 15 repos without SAST                                            │
│   • Identity attack surface: 0% coverage                             │
│                                                                      │
│ 🔴 Crown Jewels at Risk: 1/15 has NO monitoring                     │
│   • payment-db: No vulnerability scan in 30 days                     │
└──────────────────────────────────────────────────────────────────────┘
```

**Cách tính coverage:**
- External: assets(type IN [domain, subdomain, ip, website, api]) có scan gần nhất < 30 ngày
- Cloud: assets(type IN [cloud_account, compute, storage, serverless]) có integration connected
- Code: assets(type=repository) có scan_profile associated
- Identity: assets(type IN [iam_user, iam_role, service_account]) có scan
- Crown Jewel coverage: crown jewels có ít nhất 1 scan trong 30 ngày
- Tất cả query trên existing data — **không cần table mới**

**Effort thêm:** ~3 ngày (API query + UI dashboard)

**B. Crown Jewels: tận dụng Asset Relationships cho blast radius**

```
Thay vì chỉ boolean flag, thêm computed fields:

GET /api/v1/scoping/crown-jewels/{id}/impact-analysis

Response:
{
  "asset": {"name": "payment-db", "type": "database"},
  "direct_dependencies": 5,
  // Assets phụ thuộc trực tiếp (depends_on, authenticates_to, stores_data_in)
  "blast_radius": 23,
  // Tổng assets bị ảnh hưởng nếu crown jewel bị compromise (graph traversal)
  "attack_paths_to": 3,
  // Số attack paths từ internet đến crown jewel này
  "shortest_path_hops": 2,
  // Ít nhất 2 hops từ internet (internet → app → THIS)
  "dependent_assets": [
    {"name": "payment-api", "relationship": "depends_on", "risk_score": 72},
    {"name": "web-frontend", "relationship": "sends_data_to", "risk_score": 45}
  ]
}
```

**Cách tính:** Graph traversal trên asset_relationships table (đã có 16 relationship types, directed graph). Recursive CTE trong PostgreSQL.

**Effort thêm:** ~2 ngày (recursive CTE query + API)

**C. Business Units: acknowledge limitation, thêm many-to-many**

RFC hiện tại: BU = Group (1 asset thuộc 1 BU).
Thực tế: shared assets phục vụ nhiều BU.

```
Giải pháp: Asset có thể thuộc NHIỀU BU groups.

Đây đã hoạt động với existing Groups model — 1 asset có thể thuộc nhiều groups.
Scope rules đã support multi-group assignment.

Chỉ cần document rõ:
  - "Shared Database" → Group "Engineering" + Group "Finance"
  - Risk aggregation: BU Engineering risk INCLUDES shared assets
  - Visualization: shared assets hiển thị trong NHIỀU BU dashboards
```

**Effort thêm:** 0 (đã hoạt động, chỉ cần document)

**D. Compliance: phân biệt "not assessed" vs "no coverage"**

```
Thay đổi compliance posture response:

"posture": {
  "compliant": 42,
  "non_compliant": 8,
  "partially_compliant": 5,
  "not_applicable": 2,

  // Phân tách "not_assessed" thành 2 loại:
  "not_assessed_with_data": 3,
  // Có findings/data liên quan nhưng chưa ai review
  "not_assessed_no_data": 4,
  // KHÔNG CÓ DATA — scanner chưa cover area này ← COVERAGE GAP

  "coverage_gap_controls": [
    {"control": "CC6.7", "reason": "No IAM scanning configured",
     "recommendation": "Connect IAM scanner to assess identity controls"}
  ]
}
```

**Effort thêm:** ~1 ngày (query logic + UI highlight)

### 12.3 Roadmap Điều Chỉnh

| Tuần | Original RFC | Bổ sung |
|------|-------------|--------|
| 1 | Crown Jewels fields + BU metadata table | +Crown Jewel impact analysis (blast radius query) |
| 2 | BU service + Crown Jewel service | +Scoping Coverage Dashboard API |
| 3 | Compliance assessments + auto-mappings | +Coverage gap analysis (not_assessed split) |
| 4 | Frontend | +Scoping Dashboard UI + Crown Jewel blast radius view |

**Tổng effort: 4 tuần (giữ nguyên) — điều chỉnh scope, không thêm thời gian.**

Cắt bớt: bỏ compliance auto-mapping phức tạp (để Phase sau), thay bằng coverage dashboard (giá trị cao hơn).

### 12.4 Kết Luận Đánh Giá

| Khía cạnh | Rating trước | Rating sau điều chỉnh |
|-----------|-------------|---------------------|
| Data model (BU, Crown Jewels, Compliance) | 8/10 | 8/10 (giữ nguyên) |
| **Insight layer (Scoping Dashboard, Coverage Gaps)** | **3/10** | **9/10** (thêm Coverage Dashboard) |
| Crown Jewels depth (blast radius, impact chain) | 4/10 | 8/10 (thêm graph traversal) |
| Compliance posture accuracy | 6/10 | 8/10 (split not_assessed) |
| **Tổng CTEM Scoping alignment** | **5/10** | **8/10** |

**Thay đổi quan trọng nhất: thêm Scoping Coverage Dashboard.**

Đây là deliverable #1 của CTEM Scoping theo Gartner: "hiểu attack surface, xác định blind spots, và biết đang giám sát gì." Không có dashboard này, RFC chỉ thêm metadata — có data nhưng không có insight.

Sources:
- [Gartner CTEM Framework](https://ctem.org/docs/what-is-continuous-threat-exposure-management)
- [Prelude Security: Building a CTEM Program](https://www.preludesecurity.com/blog/continuous-threat-exposure-management-ctem-program)
- [Tenable ACR & Crown Jewels](https://docs.tenable.com/quick-reference/scoring-explained/Content/Overview.htm)
- [Wiz Business Context](https://www.wiz.io/blog/introducing-wiz-asm)
- [Wiz CTEM Overview](https://www.wiz.io/academy/cloud-security/continuous-threat-exposure-management-ctem)
- [XM Cyber: Why CTEM](https://xmcyber.com/ctem/why-ctem/)
- [Palo Alto: CTEM](https://www.paloaltonetworks.com/cyberpedia/ctem-continuous-threat-exposure-management)
- [Rapid7: Attack Surface Management](https://www.rapid7.com/blog/post/2025/03/10/seeing-the-whole-picture-a-better-way-to-manage-your-attack-surface/)
- [Splunk CTEM Guide](https://www.splunk.com/en_us/blog/learn/continuous-threat-exposure-management-ctem.html)
