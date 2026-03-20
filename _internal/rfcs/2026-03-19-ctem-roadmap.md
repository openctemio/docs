# RFC: CTEM Maturity Roadmap — Từ Hiện Tại Đến Full CTEM Platform

**Created:** 2026-03-19
**Status:** Proposed
**Priority:** P0 (Strategic)
**Author:** Architecture Review
**Last Updated:** 2026-03-19

---

## 1. Đánh Giá Hiện Trạng CTEM

### 1.1 CTEM Maturity Scorecard

Gartner định nghĩa CTEM gồm 5 phase. Đánh giá OpenCTEM hiện tại theo thang 0-5 cho mỗi phase:

| Phase | Score | Mô tả |
|-------|-------|-------|
| **1. Scoping** | ⭐⭐⭐☆☆ 3/5 | Có: attack surface overview, asset groups, scope config. Thiếu: business units, crown jewels, compliance mapping |
| **2. Discovery** | ⭐⭐⭐⭐☆ 4/5 | Có: 7 asset types, 19 finding sources, 21 exposure types, 49 domain packages. Thiếu: hosts/containers discovery, identity risks, attack paths |
| **3. Prioritization** | ⭐⭐⭐☆☆ 3/5 | Có: risk scoring engine (6 presets), CVSS/EPSS trên findings, asset criticality. Thiếu: threat intel feeds, exploit tracking, attack path scoring |
| **4. Validation** | ⭐⭐☆☆☆ 2/5 | Có: pentest campaigns (mới), basic attack simulation. Thiếu: BAS, detection testing, response time, playbook testing |
| **5. Mobilization** | ⭐⭐☆☆☆ 2/5 | Có: workflows, assignment rules, bulk ops, SLA fields. Thiếu: remediation campaigns, actions, exceptions, ITSM, progress tracking |
| **Tổng** | **14/25 (56%)** | **Mức "Partial CTEM"** — có nền tảng mạnh nhưng thiếu depth ở Phase 4-5 |

### 1.2 Gap Phân Tích Chi Tiết

```
PHASE 1: SCOPING (3/5)
═══════════════════════
✅ Đã có:
  - Attack Surface Overview (dashboard)
  - Asset Groups Management (dynamic + static)
  - Scope Configuration (scope rules, assignment rules)
  - Asset Types (7 loại: domain, website, service, repo, cloud, network, other)
  - Asset Relationships (16 relationship types, directed graph)
  - Configurable Risk Scoring (6 presets + custom)

⚠️ Thiếu:
  - Business Units → tổ chức assets theo phòng ban/business unit
  - Crown Jewels → đánh dấu & bảo vệ critical assets
  - Compliance Mapping → map assets với frameworks (PCI-DSS, SOC2, ISO27001)

📝 Đánh giá: Scoping đủ tốt cho MVP. Business Units và Crown Jewels
   tăng giá trị cho enterprise nhưng không block các phase khác.


PHASE 2: DISCOVERY (4/5)
═════════════════════════
✅ Đã có:
  - Scan Management (profiles, sessions, scheduling)
  - 7 Asset Types (domains, websites, services, repos, cloud, network, other)
  - 5 Finding Types (vulnerability, secret, misconfiguration, compliance, web3)
  - 19 Finding Sources (sast, dast, sca, secret, iac, container, cspm, easm...)
  - 21 Exposure Event Types (port_open, bucket_public, cert_expiring...)
  - Components & Dependencies (SBOM tracking, PURL)
  - Credential Leaks detection
  - Scanner Templates (Nuclei, Semgrep, Gitleaks)
  - SDK Adapters (Trivy, Semgrep, Nuclei, Gitleaks, SARIF)

⚠️ Thiếu:
  - Host Discovery (network scanning, OS fingerprinting, installed software)
  - Container Discovery (registry scanning, K8s cluster inventory)
  - Identity Risks (weak creds, MFA coverage, dormant accounts)
  - Attack Path Visualization (graph-based, lateral movement)

📝 Đánh giá: Discovery là mạnh nhất. 49 domain packages,
   19 finding sources — nền tảng rất vững.
   Host/Container discovery quan trọng cho enterprise.


PHASE 3: PRIORITIZATION (3/5)
══════════════════════════════
✅ Đã có:
  - Risk Scoring Engine (6 presets: standard, EPSS-weighted, exploit-focused,
    compliance-first, asset-centric, zero-trust)
  - CVSS v2/v3, EPSS scores trên findings
  - CISA KEV tracking (Known Exploited Vulnerabilities)
  - Asset Criticality (critical/high/medium/low)
  - Exposure Vector (network/local/physical/adjacent_net)
  - VPR-like scoring (vulnerability risk = severity + EPSS + KEV + exploit)
  - SLA policies (severity-mapped deadlines)

⚠️ Thiếu:
  - Threat Intelligence Feed ingestion (STIX/TAXII)
  - Exploit Availability tracking (beyond boolean)
  - Attack Path Risk Scoring (choke points, blast radius)
  - Trending Risks (velocity, emerging threats)

📝 Đánh giá: Tốt cho operational prioritization.
   Threat Intel và Attack Paths là differentiators lớn cho CTEM positioning.


PHASE 4: VALIDATION (2/5)
══════════════════════════
✅ Đã có:
  - Pentest Campaigns (10 types, lifecycle, team management)
  - Pentest Findings (draft → review → remediation → retest → verified)
  - Pentest Retests (verification workflow)
  - Pentest Reports (6 formats: executive, technical, finding, compliance, remediation, retest)
  - Pentest Templates (10 categories, reusable)
  - Basic Attack Simulation (UI page)
  - Control Testing (UI page)

⚠️ Thiếu:
  - Verification Scan trigger (sau remediation → auto-scan verify)
  - Detection Testing (MITRE ATT&CK coverage, alert correlation)
  - Response Time Tracking (MTTD/MTTR metrics)
  - Playbook Testing (tabletop exercises, automation testing)
  - BAS Integration (Breach & Attack Simulation)

📝 Đánh giá: Pentest module vừa mới — rất tốt.
   Verification scan là critical gap (kết nối Phase 4 ↔ Phase 5).


PHASE 5: MOBILIZATION (2/5) ← ĐIỂM YẾU LỚN NHẤT
═══════════════════════════════════════════════════
✅ Đã có:
  - Workflow Engine (8 triggers, 12 actions, 5 notification channels)
  - Assignment Rules (auto-route findings to groups)
  - Bulk Status Update (by finding IDs)
  - SLA Fields trên findings (deadline, breach status)
  - Approval System (false_positive, accepted — with approval workflow)
  - Notification Outbox (transactional, multi-channel)
  - Integration Entity (Jira, ServiceNow providers defined)

⚠️ Thiếu (RFC 2026-03-19 giải quyết):
  - Vulnerability Group View
  - Remediation Campaigns (lifecycle, progress, SLA)
  - Remediation Actions (solution-driven, 1 patch = N CVEs)
  - Finding Exceptions (risk acceptance with audit trail)
  - Bulk Resolve by Filter
  - ITSM Implementation (Jira client, bidirectional sync)
  - Progress Dashboard (risk reduction %, campaign analytics)

📝 Đánh giá: Có infrastructure mạnh (workflows, assignment rules, notifications)
   nhưng thiếu business layer (campaigns, actions, exceptions).
   → RFC 2026-03-19 giải quyết phần lớn gap này.
```

### 1.3 Mức CTEM Mục Tiêu

```
Hiện tại:  14/25 (56%) — "Partial CTEM"
Target Q2: 19/25 (76%) — "Operational CTEM"
Target Q3: 22/25 (88%) — "Advanced CTEM"
Target Q4: 24/25 (96%) — "Enterprise CTEM"
```

---

## 2. CTEM Roadmap

### 2.1 Tổng Quan Timeline

```
        Q2 2026              Q3 2026              Q4 2026          2027+
   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌──────────┐
   │                 │  │                 │  │                 │  │          │
   │  MOBILIZATION   │  │  VALIDATION     │  │  SCOPING +      │  │ ADVANCED │
   │  COMPLETE       │  │  + PRIORITIZE   │  │  DISCOVERY      │  │ CTEM     │
   │                 │  │                 │  │  EXTENDED        │  │          │
   │  Phase 5: 2→5   │  │  Phase 4: 2→4   │  │  Phase 1: 3→5   │  │  25/25   │
   │  Phase 5 focus  │  │  Phase 3: 3→4   │  │  Phase 2: 4→5   │  │          │
   │                 │  │                 │  │                 │  │          │
   │  Score: 14→19   │  │  Score: 19→22   │  │  Score: 22→24   │  │  24→25   │
   │                 │  │                 │  │                 │  │          │
   └─────────────────┘  └─────────────────┘  └─────────────────┘  └──────────┘
         8 tuần               8 tuần               8 tuần
```

### 2.2 Q2 2026: Mobilization Complete (Score 14→19)

**Mục tiêu:** Phase 5 từ 2/5 → 5/5. Đây là phase có ROI cao nhất — biến tất cả data từ Phase 1-4 thành giá trị thực.

```
Tuần 1-2: Foundation
━━━━━━━━━━━━━━━━━━━
├── Vulnerability Group View (API + UI)
│   ├── GROUP BY: cve_id, component_id, severity, finding_type, source, asset_criticality
│   ├── Risk metrics: risk_reduction %, không chỉ finding count
│   └── UI: Tab "Groups" trong Findings page
│
├── Bulk Resolve by Filter API
│   └── PATCH /findings/bulk-resolve-by-filter
│
└── DB Migration: remediation_campaigns + remediation_actions +
    action_applications + campaign_tickets + campaign_activities +
    finding_exceptions (7 tables)

Tuần 3-4: Campaign + Actions Core
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
├── Remediation Campaign entity (lifecycle: draft→active→validating→completed)
│   ├── Dynamic scope (findings + exposures)
│   ├── Progress tracking (risk_reduction_pct, không chỉ finding count)
│   └── Campaign CRUD + lifecycle APIs
│
├── Remediation Actions entity (solution-driven)
│   ├── Action types: patch, upgrade, code_fix, config_change,
│   │   compensating_control, credential_rotation, access_revocation,
│   │   certificate_renewal, decommission
│   ├── Apply action API → auto-resolve matching findings
│   ├── Auto-suggest actions từ vulnerability data
│   └── Verification tracking (verified flag per asset)
│
└── Finding Exceptions entity
    ├── Types: risk_accepted, false_positive, deferred, compensating_control
    ├── Approval workflow (tận dụng existing approval system)
    └── Expiration + periodic review

Tuần 5-6: ITSM + Integration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
├── Jira Client Implementation (RFC 2026-03-10)
│   ├── TicketingClient interface → JiraClient
│   ├── Create/update/sync issues
│   └── Campaign → Jira Epic, Actions → Jira Tasks
│
├── Campaign ↔ Workflow integration
│   ├── New triggers: campaign.activated, campaign.sla_warning, campaign.completed
│   └── Auto-ticket, auto-notify, auto-escalate
│
├── Background Controllers
│   ├── CampaignProgressController (5 min interval)
│   └── ExceptionExpirationController (1 hour interval)
│
└── Campaign Notifications (outbox)
    └── Slack/Teams/Email cho campaign events

Tuần 7-8: Frontend + Polish
━━━━━━━━━━━━━━━━━━━━━━━━━━━
├── UI: Findings Groups Tab
├── UI: Campaigns List + Detail (progress, breakdown, actions, timeline)
├── UI: Create Campaign from Group View
├── UI: Apply Action dialog (select assets → 1 click resolve)
├── UI: Exception Queue + Approval
├── UI: Campaign Dashboard widgets
├── E2E Tests + Documentation
└── Performance optimization

Deliverable Q2:
  Phase 5 Score: 2/5 → 5/5
  Total Score: 14 → 19/25 (76%)
  Key metric: "Fix Log4j" campaign — 1 click apply action → 1200 findings resolved
  Risk reduction tracking hoạt động
```

### 2.3 Q3 2026: Validation + Prioritization (Score 19→22)

**Mục tiêu:** Phase 4 từ 2/5 → 4/5, Phase 3 từ 3/5 → 4/5. Kết nối remediation với validation — CTEM loop hoàn chỉnh.

```
Tuần 1-2: Verification Scan Integration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
├── Campaign "validating" status trigger
│   ├── Khi tất cả actions applied → campaign chuyển sang "validating"
│   ├── Auto-trigger verification scan (Workflow action: trigger_scan)
│   └── Scan results → auto-verify action_applications
│
├── Pentest ↔ Campaign integration
│   ├── Pentest campaign tạo findings → auto-create remediation campaign
│   ├── Pentest retest = campaign validation step
│   └── Retest passed → campaign completed
│
└── MTTR Tracking
    ├── Mean Time to Remediate per severity, per team, per asset group
    ├── Tính từ finding.first_detected_at → finding.resolved_at
    └── Dashboard widget + trending

Tuần 3-4: Threat Intelligence
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
├── Threat Intel Feed Ingestion
│   ├── CISA KEV auto-update (đã có entity, cần scheduler)
│   ├── EPSS score auto-update (daily refresh)
│   └── Exploit availability tracking (PoC, weaponized, in-the-wild)
│
├── Threat-Informed Prioritization
│   ├── Findings with active exploits → auto-escalate
│   ├── Trending CVEs → highlight trong Groups View
│   └── Risk score factor: threat_intel_score
│
└── Vulnerability Intelligence Dashboard
    ├── "CVEs đang bị exploit in-the-wild mà bạn bị ảnh hưởng"
    ├── CISA KEV compliance status
    └── EPSS top-N risky findings

Tuần 5-6: Detection & Response Validation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
├── Detection Coverage Analysis
│   ├── MITRE ATT&CK technique mapping
│   ├── "Kỹ thuật nào bạn CHƯA detect được?"
│   └── Coverage heatmap
│
├── Response Time Metrics
│   ├── MTTD (Mean Time to Detect)
│   ├── MTTR (Mean Time to Respond)
│   └── SLA compliance rate per team
│
└── Validation Reports
    ├── "Sau campaign X, risk giảm Y%"
    ├── Before/after comparison
    └── Executive summary generation

Tuần 7-8: Attack Path (Foundation)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
├── Attack Path Visualization
│   ├── Tận dụng asset relationships (16 types đã có)
│   ├── Graph traversal: internet → exposed service → vuln app → database
│   └── UI: attack path graph (Xyflow đã có)
│
├── Choke Point Identification
│   ├── "Fix asset X breaks 5 attack paths"
│   ├── Prioritize remediation by path impact
│   └── Campaign dashboard: "Attack paths broken: 12/20"
│
└── Integration với Campaigns
    ├── Campaign scope_filter thêm: attack_path_id
    └── Risk reduction tính cả attack path impact

Deliverable Q3:
  Phase 4 Score: 2/5 → 4/5
  Phase 3 Score: 3/5 → 4/5
  Total Score: 19 → 22/25 (88%)
  Key metric: Full CTEM loop — discover → prioritize → validate → remediate → verify
```

### 2.4 Q4 2026: Scoping + Discovery Extended (Score 22→24)

**Mục tiêu:** Phase 1 từ 3/5 → 5/5, Phase 2 từ 4/5 → 5/5. Enterprise-ready context.

```
Tuần 1-2: Business Context (Scoping)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
├── Business Units
│   ├── Entity + CRUD + asset assignment
│   ├── Risk aggregation per business unit
│   └── Campaign scoping by business unit
│
├── Crown Jewels
│   ├── Mark assets as crown jewels
│   ├── Impact classification
│   ├── Crown jewel findings = auto-escalate
│   └── Dashboard: "Crown jewel exposure summary"
│
└── Compliance Framework Mapping
    ├── Framework selection (PCI-DSS, SOC2, ISO27001, NIST CSF)
    ├── Control → Asset mapping
    ├── Compliance gap analysis
    └── Campaign scope by compliance control

Tuần 3-4: Extended Discovery
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
├── Host Discovery
│   ├── Network scanning integration
│   ├── OS fingerprinting
│   ├── Installed software inventory
│   └── Patch status tracking
│
├── Container Discovery
│   ├── Registry scanning
│   ├── K8s cluster inventory
│   ├── Running container tracking
│   └── Image vulnerability correlation
│
└── Identity Risk Discovery
    ├── Weak credential detection
    ├── MFA coverage analysis
    ├── Dormant account identification
    └── Overprivileged access detection

Tuần 5-6: Advanced Prioritization
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
├── Custom Scoring Engine
│   ├── Formula editor (đã có risk scoring engine, extend)
│   ├── Business context factors (crown jewel × compliance × threat intel)
│   └── Benchmark comparison (industry average)
│
├── Trending Risks
│   ├── Risk velocity tracking (tăng nhanh hay chậm)
│   ├── Emerging threat correlation
│   └── Predictive analytics (ML-based, basic)
│
└── Attack Path Scoring
    ├── Path risk score = SUM(node vulnerabilities × exploitability)
    ├── "What-if" scenarios (nếu fix X thì risk giảm bao nhiêu?)
    └── Automated remediation recommendation

Tuần 7-8: Analytics + Reports
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
├── CTEM Executive Dashboard
│   ├── 5-phase overview với scores
│   ├── Risk trend over time
│   ├── Campaign progress summary
│   ├── SLA compliance rate
│   └── Top exposures by business unit
│
├── Report Generation
│   ├── CTEM Status Report (PDF)
│   ├── Compliance Audit Report
│   ├── Campaign Completion Report
│   └── Executive Summary (1-page)
│
└── Team Performance
    ├── MTTR per team
    ├── Campaign completion rate
    ├── Exception rate
    └── Remediation velocity

Deliverable Q4:
  Phase 1 Score: 3/5 → 5/5
  Phase 2 Score: 4/5 → 5/5
  Total Score: 22 → 24/25 (96%)
  Key metric: Full enterprise CTEM — business context + compliance + advanced analytics
```

### 2.5 2027+: Advanced CTEM (Score 24→25)

```
├── SOAR Integration (auto-remediation)
├── BAS Integration (Breach & Attack Simulation)
├── Shadow IT Detection
├── Advanced ML (anomaly detection, predictive risk)
├── Multi-tenant analytics (benchmark across tenants)
└── API-first marketplace (custom integrations)

Score: 25/25 — "Best-in-class CTEM Platform"
```

---

## 3. Scorecard Projection

```
          Phase 1   Phase 2   Phase 3   Phase 4   Phase 5   Total    Level
          Scoping   Discovery Priority  Validate  Mobilize
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hiện tại   3/5       4/5       3/5       2/5       2/5      14/25    Partial
Q2 end     3/5       4/5       3/5       2/5     → 5/5      17/25    Operational
Q3 end     3/5       4/5     → 4/5     → 4/5       5/5      20/25    Advanced
Q4 end   → 5/5     → 5/5       4/5       4/5       5/5      23/25    Enterprise
2027+      5/5       5/5     → 5/5     → 5/5       5/5      25/25    Best-in-class
```

---

## 4. Ưu Tiên Theo ROI

### Tại sao Mobilization trước?

```
CTEM Value Chain:
  Scoping → Discovery → Prioritization → Validation → MOBILIZATION
                                                         ↑
                                                    GIÁ TRỊ CUỐI CÙNG

Phase 1-4 tạo DATA (phát hiện vấn đề)
Phase 5 tạo VALUE (giải quyết vấn đề)

Nếu Phase 5 yếu:
  "Phát hiện 10,000 lỗ hổng nhưng không giúp fix được"
  → Giá trị thực tế = 0
  → Khách hàng churn

Nếu Phase 5 mạnh:
  "Phát hiện 10,000 lỗ hổng VÀ giúp fix hiệu quả"
  → Giá trị thực tế = rất cao
  → Khách hàng renew + upsell

ROI theo phase:
  Phase 5 (Mobilization): ██████████ ROI cao nhất — trực tiếp giải quyết vấn đề
  Phase 4 (Validation):   ████████░░ ROI cao — chứng minh remediation hiệu quả
  Phase 3 (Prioritization):██████░░░░ ROI trung bình — giúp ưu tiên đúng
  Phase 2 (Discovery):    █████░░░░░ ROI trung bình — thêm asset types
  Phase 1 (Scoping):      ████░░░░░░ ROI thấp nhất — enterprise context

→ Fix Phase 5 trước = tăng giá trị cho TẤT CẢ data từ Phase 1-4.
→ Thêm asset types (Phase 2) khi chưa có Phase 5 = thêm data nhưng không thêm value.
```

### ROI Matrix

| Feature | Effort | Impact cho 100 users | Impact cho 1000 users | Ưu tiên |
|---------|--------|---------------------|----------------------|---------|
| Remediation Campaigns | 2 tuần | ★★★★★ | ★★★★★ | **Q2-W1** |
| Vulnerability Groups | 3 ngày | ★★★★★ | ★★★★★ | **Q2-W1** |
| Remediation Actions | 2 tuần | ★★★★☆ | ★★★★★ | **Q2-W3** |
| Finding Exceptions | 1 tuần | ★★★★☆ | ★★★★★ | **Q2-W4** |
| Jira Integration | 2 tuần | ★★★☆☆ | ★★★★★ | **Q2-W5** |
| Verification Scan | 1 tuần | ★★★★☆ | ★★★★★ | **Q3-W1** |
| Threat Intel Feeds | 2 tuần | ★★★☆☆ | ★★★★☆ | **Q3-W3** |
| Attack Path Graph | 2 tuần | ★★★☆☆ | ★★★★★ | **Q3-W7** |
| MTTR Tracking | 1 tuần | ★★★★☆ | ★★★★★ | **Q3-W1** |
| Business Units | 1 tuần | ★★☆☆☆ | ★★★★☆ | **Q4-W1** |
| Crown Jewels | 1 tuần | ★★☆☆☆ | ★★★★★ | **Q4-W1** |
| Host Discovery | 2 tuần | ★★★☆☆ | ★★★★☆ | **Q4-W3** |
| Container Discovery | 2 tuần | ★★★☆☆ | ★★★★☆ | **Q4-W3** |
| Identity Risks | 2 tuần | ★★☆☆☆ | ★★★★☆ | **Q4-W5** |
| Compliance Mapping | 2 tuần | ★★☆☆☆ | ★★★★★ | **Q4-W5** |

---

## 5. Competitive Positioning Theo Từng Giai Đoạn

```
Hiện tại (Q1 2026):
  OpenCTEM ≈ DefectDojo + extras (workflows, agents, risk scoring)
  Vượt: DefectDojo, Dependency-Track
  Thua: Tenable, Rapid7, Qualys, Wiz (ở Phase 4-5)

Sau Q2 (Mobilization done):
  OpenCTEM ≈ Rapid7 InsightVM (remediation projects) + Snyk (SCA)
  Vượt: DefectDojo, Dependency-Track, basic VM tools
  Ngang: Wiz (cloud focus), Snyk (SCA focus)
  Thua: Tenable, Rapid7 (ở Phase 3-4)

Sau Q3 (Validation + Prioritization):
  OpenCTEM ≈ Tenable (threat intel + remediation) + pentest
  Vượt: Tất cả open-source
  Ngang: Tenable (VM), Wiz (cloud)
  Chỉ thua: Full Tenable One, CrowdStrike Falcon (ở scale + data)

Sau Q4 (Full CTEM):
  OpenCTEM = Full CTEM platform — unique positioning
  Không có open-source nào cover 5 phases đầy đủ
  Cạnh tranh trực tiếp với Tenable One, CrowdStrike, Wiz Enterprise
  Differentiator: Open-source core + enterprise edition (Exploop)
```

---

## 6. Dependency Map

```
Q2: Mobilization
  ├── RFC 2026-03-19 (Campaigns + Actions + Exceptions)  ← CẦN LÀM ĐẦU TIÊN
  ├── RFC 2026-03-10 (ITSM/Jira Integration)             ← cần cho campaign tickets
  └── RFC 2026-03-18 (Multi-Edition)                      ← M1 refactor nếu kịp

Q3: Validation + Prioritization
  ├── Depends on: Q2 campaigns (verification scan triggers)
  ├── Depends on: Pentest module (đã có) → retest integration
  └── Independent: Threat Intel, MTTR, Attack Paths

Q4: Scoping + Discovery Extended
  ├── Independent: Business Units, Crown Jewels
  ├── Independent: Host/Container Discovery
  ├── Depends on: Risk Scoring (đã có) → business context factors
  └── Depends on: Attack Paths (Q3) → compliance mapping
```

---

## 7. CTEM Maturity Checklist

Checklist để track tiến độ. Đánh ✅ khi feature production-ready:

### Phase 1: Scoping
- [x] Attack Surface Overview
- [x] Asset Groups (dynamic + static)
- [x] Scope Configuration
- [x] Asset Relationships (16 types)
- [x] Configurable Risk Scoring
- [ ] Business Units
- [ ] Crown Jewels
- [ ] Compliance Framework Mapping

### Phase 2: Discovery
- [x] Scan Management (profiles, sessions, scheduling)
- [x] 7 Asset Types
- [x] 5 Finding Types, 19 Sources
- [x] 21 Exposure Event Types
- [x] Components & SBOM
- [x] Credential Leaks
- [x] Scanner Templates + SDK Adapters
- [ ] Host Discovery (network scan, OS fingerprint)
- [ ] Container Discovery (registry, K8s)
- [ ] Identity Risk Discovery
- [ ] Attack Path Visualization

### Phase 3: Prioritization
- [x] Risk Scoring Engine (6 presets)
- [x] CVSS/EPSS/CISA KEV
- [x] Asset Criticality
- [x] SLA Policies
- [ ] Threat Intelligence Feed Ingestion
- [ ] Exploit Availability Tracking
- [ ] Attack Path Risk Scoring
- [ ] Trending Risks

### Phase 4: Validation
- [x] Pentest Campaigns (10 types)
- [x] Pentest Findings + Retests
- [x] Pentest Reports (6 formats)
- [ ] Verification Scan (post-remediation)
- [ ] Detection Coverage (MITRE ATT&CK)
- [ ] MTTD/MTTR Metrics
- [ ] Response Time Tracking

### Phase 5: Mobilization
- [x] Workflow Engine (8 triggers, 12 actions)
- [x] Assignment Rules (auto-route)
- [x] Bulk Status Update
- [x] Approval System
- [x] Notification Outbox
- [ ] **Vulnerability Group View** ← Q2
- [ ] **Remediation Campaigns** ← Q2
- [ ] **Remediation Actions** ← Q2
- [ ] **Finding Exceptions** ← Q2
- [ ] **ITSM Integration (Jira)** ← Q2
- [ ] **Risk Reduction Tracking** ← Q2
- [ ] **Campaign Progress Dashboard** ← Q2
- [ ] ServiceNow Integration
- [ ] Advanced Campaign Analytics

### Infrastructure
- [x] Platform Agents v3.2
- [x] Admin System
- [x] SSO (SAML + OIDC)
- [x] Kubernetes Helm Chart
- [x] OpenTelemetry + Grafana
- [x] Database Backup Automation
- [x] WebSocket Real-time
- [ ] Multi-Edition (M1 → M2 → M3 refactor)
