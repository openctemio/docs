---
layout: default
title: Roadmap
nav_order: 100
---

# Feature Roadmap

**Last Updated:** 2026-01-27 (UI Status + Implementation Plans)

This document lists all planned features that are not yet implemented. These features have been temporarily hidden from the UI navigation but are planned for future development.

---

## Overview

The OpenCTEM CTEM Platform follows the 5-stage CTEM (Continuous Threat Exposure Management) framework:

| Phase | Status | Description |
|-------|--------|-------------|
| Scoping | Partial | Define attack surface and business context |
| Discovery | Partial | Identify assets, vulnerabilities, exposures |
| Prioritization | Partial | Rank risks based on impact |
| Validation | Partial | Verify threats and test controls |
| Mobilization | Partial | Execute remediation |

---

## Implemented Features (Current)

### Dashboard
- [x] CTEM Process Overview
- [x] Quick Actions
- [x] Security Metrics

### Scoping
- [x] Attack Surface Overview
- [x] Asset Groups Management
- [x] Scope Configuration

### Discovery
- [x] Scan Management
- [x] Scan Runners
- [x] Asset Inventory: Domains
- [x] Asset Inventory: Websites
- [x] Asset Inventory: Services
- [x] Asset Inventory: Repositories
- [x] Asset Inventory: Cloud Resources
- [x] Credential Leaks

### Prioritization
- [x] Risk Analysis Dashboard
- [x] Business Impact Assessment

### Validation
- [x] Attack Simulation
- [x] Control Testing

### Mobilization
- [x] Remediation Tasks
- [x] Workflows
- [x] **Workflow Automation** (NEW - 2026-01-27)
  - [x] 8 trigger types (manual, schedule, finding_created, finding_updated, finding_age, asset_discovered, scan_completed, webhook)
  - [x] 4 node types (Trigger, Condition, Action, Notification)
  - [x] 12 action types (trigger_pipeline, create_ticket, http_request, etc.)
  - [x] 5 notification channels (Slack, Email, Teams, Webhook, PagerDuty)

### Insights
- [x] Findings Management
- [x] Reports

### Scanning
- [x] **Quality Gates** (NEW - 2026-01-27)
  - [x] Threshold configuration (fail_on_critical, max_high, etc.)
  - [x] CI/CD integration (GitHub Actions, GitLab CI)
  - [x] New findings only mode for PR checks
- [x] **Scanner Templates** - Custom detection rules for Nuclei, Semgrep, Gitleaks
- [x] **CTEM Finding Fields** (NEW - 2026-01-27)
  - [x] Exposure Vector (network, local, adjacent_net, physical)
  - [x] Remediation Context (type, fix time, complexity)
  - [x] Business Impact (data exposure risk, compliance impact)

### Infrastructure
- [x] **Platform Agents v3.2** (NEW - 2026-01-27)
  - [x] Kubernetes-style lease-based heartbeat
  - [x] Bootstrap token self-registration
  - [x] Weighted Fair Queuing (WFQ) scheduling
  - [x] Tier-based resource isolation (shared/dedicated/premium)
  - [x] Load balancing with CPU/memory/IO weights
  - [x] Stuck job recovery

### Settings
- [x] Tenant Settings
- [x] Users & Roles
- [x] Access Control (Groups & Permission Sets)
- [x] Billing
- [x] Integrations
  - [x] SCM Integrations (GitHub, GitLab, Bitbucket)
  - [x] **Notification Integrations** (NEW - 2026-01-22)
    - [x] Slack
    - [x] Microsoft Teams
    - [x] Telegram
    - [x] Custom Webhook
    - [x] Severity filters (Critical, High, Medium, Low)

### Platform Administration
- [x] **Admin System** (NEW - 2026-01-27)
  - [x] Admin User Management (super_admin, ops_admin, viewer)
  - [x] API Key Authentication (bcrypt, 256-bit entropy)
  - [x] Audit Logging (immutable, async)
  - [x] Bootstrap CLI for first admin creation
  - [x] Admin UI (login, user management, audit logs)

---

## Planned Features (Roadmap)

### Phase 1: Scoping - Business Context

#### Business Units
- **Route:** `/scoping/business-units`
- **Icon:** Layers
- **Description:** Organize assets by business unit/department
- **Priority:** High
- **Features:**
  - Create/edit business units
  - Assign assets to business units
  - Business unit risk aggregation
  - Department ownership mapping

#### Crown Jewels
- **Route:** `/scoping/crown-jewels`
- **Icon:** Crown
- **Description:** Identify and protect critical assets
- **Priority:** High
- **Features:**
  - Mark assets as crown jewels
  - Impact classification (Critical, High, Medium, Low)
  - Data sensitivity tagging
  - Dependency mapping

#### Compliance
- **Route:** `/scoping/compliance`
- **Icon:** ClipboardCheck
- **Description:** Compliance framework mapping
- **Priority:** Medium
- **Features:**
  - Framework selection (PCI-DSS, SOC2, ISO27001, etc.)
  - Control mapping to assets
  - Compliance gap analysis
  - Audit readiness reports

---

### Phase 2: Discovery - Extended Assets

#### Hosts
- **Route:** `/discovery/assets/hosts`
- **Icon:** Server
- **Description:** Server and endpoint inventory
- **Priority:** High
- **Features:**
  - Host discovery via network scanning
  - OS fingerprinting
  - Installed software inventory
  - Patch status tracking

#### Containers
- **Route:** `/discovery/assets/containers`
- **Icon:** Boxes
- **Description:** Container and Kubernetes assets
- **Priority:** Medium
- **Features:**
  - Container registry scanning
  - Kubernetes cluster inventory
  - Image vulnerability scanning
  - Runtime security monitoring

#### Databases
- **Route:** `/discovery/assets/databases`
- **Icon:** Database
- **Description:** Database asset inventory
- **Priority:** Medium
- **Features:**
  - Database discovery
  - Schema analysis
  - Access control review
  - Sensitive data detection

#### Mobile Apps
- **Route:** `/discovery/assets/mobile`
- **Icon:** Smartphone
- **Description:** Mobile application inventory
- **Priority:** Low
- **Features:**
  - iOS/Android app catalog
  - API endpoint discovery
  - Mobile-specific vulnerabilities
  - Third-party SDK tracking

---

### Phase 2: Discovery - Exposures

#### Vulnerabilities
- **Route:** `/discovery/exposures/vulnerabilities`
- **Icon:** Bug
- **Description:** Centralized vulnerability management
- **Priority:** High
- **Features:**
  - CVE database integration
  - Vulnerability correlation
  - Exploit availability tracking
  - Patch recommendations

#### Misconfigurations
- **Route:** `/discovery/exposures/misconfigurations`
- **Icon:** Settings2
- **Description:** Security misconfiguration detection
- **Priority:** High
- **Features:**
  - Cloud misconfiguration scanning
  - CIS benchmark compliance
  - Infrastructure as Code analysis
  - Auto-remediation suggestions

#### Secrets Exposure
- **Route:** `/discovery/exposures/secrets`
- **Icon:** Lock
- **Description:** Exposed secrets and credentials
- **Priority:** High
- **Features:**
  - Code repository scanning
  - Cloud secrets detection
  - API key exposure monitoring
  - Rotation recommendations

#### Code Issues
- **Route:** `/discovery/exposures/code`
- **Icon:** FileCode
- **Description:** Source code security issues
- **Priority:** Medium
- **Features:**
  - SAST integration
  - Dependency scanning
  - License compliance
  - Code quality metrics

---

### Phase 2: Discovery - Identity & Access

#### Identity Risks
- **Route:** `/discovery/identity/risks`
- **Icon:** Fingerprint
- **Description:** Identity-related security risks
- **Priority:** Medium
- **Features:**
  - Weak credential detection
  - MFA coverage analysis
  - Dormant account identification
  - Identity hygiene scoring

#### Privileged Access
- **Route:** `/discovery/identity/privileged`
- **Icon:** Crown
- **Description:** Privileged access management
- **Priority:** Medium
- **Features:**
  - Admin account inventory
  - Privilege escalation paths
  - Access review workflows
  - Just-in-time access

#### Shadow IT
- **Route:** `/discovery/identity/shadow-it`
- **Icon:** Eye
- **Description:** Unauthorized IT asset detection
- **Priority:** Low
- **Features:**
  - SaaS discovery
  - Unsanctioned cloud usage
  - Personal device tracking
  - Risk classification

---

### Phase 2: Discovery - Attack Paths

#### Attack Paths
- **Route:** `/discovery/attack-paths`
- **Icon:** Route
- **Description:** Attack path visualization
- **Priority:** High
- **Features:**
  - Graph-based attack path modeling
  - Lateral movement simulation
  - Blast radius analysis
  - Path prioritization

---

### Phase 3: Prioritization - Extended

#### Exposure Scoring
- **Route:** `/prioritization/scoring`
- **Icon:** Gauge
- **Description:** Custom risk scoring engine
- **Priority:** Medium
- **Features:**
  - Custom scoring formulas
  - Weight configuration
  - Score normalization
  - Benchmark comparison

#### Threat Intelligence

**Active Threats**
- **Route:** `/prioritization/threats/active`
- **Icon:** Flame
- **Description:** Active threat monitoring
- **Priority:** High
- **Features:**
  - Threat actor tracking
  - Campaign monitoring
  - IOC correlation
  - Alert generation

**Exploitability**
- **Route:** `/prioritization/threats/exploitability`
- **Icon:** Bug
- **Description:** Exploit availability tracking
- **Priority:** High
- **Features:**
  - EPSS integration
  - Exploit database correlation
  - Weaponization tracking
  - Time-to-exploit metrics

**Threat Feeds**
- **Route:** `/prioritization/threats/feeds`
- **Icon:** Zap
- **Description:** Threat intelligence feed management
- **Priority:** Medium
- **Features:**
  - Feed subscription management
  - STIX/TAXII integration
  - Custom feed ingestion
  - Feed quality scoring

#### Attack Path Analysis
- **Route:** `/prioritization/attack-paths`
- **Icon:** Route
- **Description:** Attack path risk prioritization
- **Priority:** High
- **Features:**
  - Path risk scoring
  - Choke point identification
  - Remediation impact analysis
  - What-if scenarios

#### Trending Risks
- **Route:** `/prioritization/trending`
- **Icon:** TrendingUp
- **Description:** Risk trend analysis
- **Priority:** Medium
- **Features:**
  - Risk velocity tracking
  - Emerging threat detection
  - Historical comparison
  - Predictive analytics

---

### Phase 4: Validation - Extended

#### Penetration Testing

**Pentest Campaigns**
- **Route:** `/validation/pentest/campaigns`
- **Icon:** Crosshair
- **Description:** Penetration testing campaign management
- **Priority:** Medium
- **Features:**
  - Campaign planning
  - Scope definition
  - Tester assignment
  - Progress tracking

**Pentest Findings**
- **Route:** `/validation/pentest/findings`
- **Icon:** FileWarning
- **Description:** Penetration test findings
- **Priority:** Medium
- **Features:**
  - Finding documentation
  - Evidence attachment
  - Severity classification
  - Remediation recommendations

**Retests**
- **Route:** `/validation/pentest/retests`
- **Icon:** Play
- **Description:** Remediation verification
- **Priority:** Medium
- **Features:**
  - Retest scheduling
  - Verification workflow
  - Status tracking
  - Closure documentation

#### Response Validation

**Detection Tests**
- **Route:** `/validation/response/detection`
- **Icon:** Eye
- **Description:** Detection capability testing
- **Priority:** Medium
- **Features:**
  - Detection rule testing
  - MITRE ATT&CK coverage
  - Alert correlation testing
  - Detection gap analysis

**Response Time**
- **Route:** `/validation/response/time`
- **Icon:** Timer
- **Description:** Response time measurement
- **Priority:** Medium
- **Features:**
  - MTTD/MTTR tracking
  - SLA compliance
  - Response benchmarking
  - Improvement tracking

**Playbook Tests**
- **Route:** `/validation/response/playbooks`
- **Icon:** FileText
- **Description:** Incident response playbook testing
- **Priority:** Low
- **Features:**
  - Playbook execution
  - Tabletop exercises
  - Automation testing
  - Gap identification

---

### Phase 5: Mobilization - Extended

#### Collaboration

**Tickets**
- **Route:** `/mobilization/collaboration/tickets`
- **Icon:** FileWarning
- **Description:** External ticketing integration
- **Priority:** High
- **Features:**
  - Jira integration
  - ServiceNow integration
  - Bi-directional sync
  - Status mapping

**Comments**
- **Route:** `/mobilization/collaboration/comments`
- **Icon:** Mail
- **Description:** Team communication
- **Priority:** Medium
- **Features:**
  - Finding comments
  - @mentions
  - Email notifications
  - Activity feed

**Assignments**
- **Route:** `/mobilization/collaboration/assignments`
- **Icon:** Users
- **Description:** Task assignment management
- **Priority:** Medium
- **Features:**
  - Auto-assignment rules
  - Workload balancing
  - Escalation policies
  - Assignment history

#### Exceptions

**Risk Acceptance**
- **Route:** `/mobilization/exceptions/accepted`
- **Icon:** CheckCircle2
- **Description:** Accepted risk management
- **Priority:** Medium
- **Features:**
  - Acceptance workflow
  - Justification documentation
  - Expiration tracking
  - Periodic review

**False Positives**
- **Route:** `/mobilization/exceptions/false-positives`
- **Icon:** XCircle
- **Description:** False positive management
- **Priority:** Medium
- **Features:**
  - FP marking workflow
  - Pattern learning
  - Suppression rules
  - FP rate tracking

**Pending Review**
- **Route:** `/mobilization/exceptions/pending`
- **Icon:** Timer
- **Description:** Exception review queue
- **Priority:** Medium
- **Features:**
  - Review queue
  - Approval workflow
  - SLA tracking
  - Bulk actions

#### Progress Tracking
- **Route:** `/mobilization/progress`
- **Icon:** TrendingUp
- **Description:** Remediation progress dashboard
- **Priority:** Medium
- **Features:**
  - Progress metrics
  - Trend visualization
  - Team performance
  - Goal tracking

#### SLA Management
- **Route:** `/mobilization/sla`
- **Icon:** Timer
- **Description:** SLA policy management
- **Priority:** Medium
- **Features:**
  - SLA definition
  - Breach alerting
  - Escalation rules
  - Compliance reporting

---

### Insights - Extended

#### Analytics

**Risk Trends**
- **Route:** `/insights/analytics/trends`
- **Icon:** TrendingUp
- **Description:** Risk trend analysis
- **Priority:** Medium
- **Features:**
  - Historical trends
  - Forecasting
  - Anomaly detection
  - Comparative analysis

**Coverage**
- **Route:** `/insights/analytics/coverage`
- **Icon:** PieChart
- **Description:** Security coverage analysis
- **Priority:** Medium
- **Features:**
  - Asset coverage
  - Scan coverage
  - Control coverage
  - Gap identification

**MTTR**
- **Route:** `/insights/analytics/mttr`
- **Icon:** Timer
- **Description:** Mean Time to Remediate
- **Priority:** Medium
- **Features:**
  - MTTR by severity
  - MTTR by team
  - MTTR trends
  - Benchmark comparison

**Team Performance**
- **Route:** `/insights/analytics/performance`
- **Icon:** BarChart3
- **Description:** Team performance metrics
- **Priority:** Low
- **Features:**
  - Individual metrics
  - Team comparison
  - Leaderboards
  - Gamification

#### Notifications
- **Route:** `/insights/notifications`
- **Icon:** Bell
- **Description:** Notification center
- **Priority:** High
- **Features:**
  - Alert management
  - Notification preferences
  - Channel configuration
  - Alert history

---

### Settings - Extended

#### Teams
- **Route:** `/settings/teams`
- **Icon:** Users
- **Description:** Team management
- **Priority:** Medium
- **Features:**
  - Team creation
  - Member management
  - Role assignment
  - Team-based access control

#### Configuration

**General**
- **Route:** `/settings/general`
- **Icon:** Settings
- **Description:** General system settings
- **Priority:** Low
- **Features:**
  - Timezone settings
  - Date format
  - Language preferences
  - Theme settings

**Notifications** (Partially Implemented)
- **Route:** `/settings/integrations/notifications`
- **Icon:** Bell
- **Description:** Notification settings
- **Priority:** Medium
- **Status:** Partial
- **Implemented:**
  - [x] Slack integration
  - [x] Microsoft Teams integration
  - [x] Telegram integration
  - [x] Webhook setup
- **Remaining:**
  - [ ] Email configuration
  - [ ] Alert thresholds

**Scoring Rules**
- **Route:** `/settings/scoring`
- **Icon:** Gauge
- **Description:** Risk scoring configuration
- **Priority:** Medium
- **Features:**
  - Scoring formula editor
  - Weight configuration
  - Custom factors
  - Scoring profiles

**SLA Policies**
- **Route:** `/settings/sla-policies`
- **Icon:** Timer
- **Description:** SLA policy configuration
- **Priority:** Medium
- **Features:**
  - SLA templates
  - Severity-based SLAs
  - Business hours
  - Holiday calendars

---

## Development Priority

### High Priority (Next Sprint) - VALIDATION FIRST
1. **Penetration Testing Module**
   - Pentest Campaigns
   - Pentest Findings
   - Retests Management
2. **Response Validation**
   - Detection Tests
   - Response Time Tracking
   - Playbook Testing
3. Vulnerabilities Management
4. Attack Paths Visualization

### Medium Priority (Q2)
1. Ticket Integration (Jira/ServiceNow)
2. Notifications Center
3. Threat Intelligence Integration
4. Business Context (Business Units, Crown Jewels)
5. Exception Management

### Low Priority (Q3+)
1. Extended Asset Types (Hosts, Containers, Databases, Mobile)
2. Misconfigurations Detection
3. Secrets Exposure Scanning
4. Shadow IT Detection
5. Analytics & Team Performance

---

## UI Implementation Status

### Current State (2026-01-27)

| Status | Count | Percentage |
|--------|-------|------------|
| **Implemented** | 93 | 62% |
| **Placeholder** | 58 | 38% |
| **Total** | 151 | 100% |

### Placeholder Pages by CTEM Phase

| Phase | Implemented | Placeholder | Key Missing Features |
|-------|-------------|-------------|----------------------|
| **Scoping** | 14 | 1 | Scope settings |
| **Discovery** | 36 | 9 | Exposures, Identity, Attack Paths |
| **Prioritization** | 3 | 7 | Risk scoring, Threat intel |
| **Validation** | 15 | 9 | Controls, Simulation, Response |
| **Mobilization** | 9 | 15 | Remediation, Collaboration, Exceptions |
| **Insights** | 6 | 10 | Analytics, Reports |
| **Settings** | 10 | 7 | Integrations (SIEM, Ticketing) |

### Implementation Plan (22 weeks total)

| Phase | Focus | Pages | Duration | Priority |
|-------|-------|-------|----------|----------|
| **1** | Mobilization | 15 | 4 weeks | HIGH |
| **2** | Discovery (Exposures) | 9 | 4 weeks | HIGH |
| **3** | Prioritization | 7 | 4 weeks | MEDIUM |
| **4** | Validation | 9 | 4 weeks | MEDIUM |
| **5** | Insights | 10 | 4 weeks | LOWER |
| **6** | Settings | 8 | 2 weeks | LOWER |

**Quick Wins (Backend exists, UI only):**
- Remediation tasks pages
- Workflow monitoring pages
- Exposures (filtered Findings views)
- API Keys management

**Requires Backend Work:**
- Identity/Shadow IT detection
- Threat Intelligence feeds
- Attack Path visualization
- Simulation engine
- Control effectiveness testing

See `docs/_internal/rfcs/2026-01-27-placeholder-pages-implementation.md` for full implementation plan.

---

## In-Progress Features

### Group Access Control Phases 7-10 (85% → 100%)

| Phase | Feature | Status | Effort |
|-------|---------|--------|--------|
| **7** | Auto-Assignment Rules | Not Started | 2 weeks |
| **8** | Group Notifications | Not Started | 2 weeks |
| **9** | External Sync (GitHub/GitLab/Azure AD) | Not Started | 3 weeks |
| **10** | Permission Set Version Tracking | Not Started | 1 week |

**Key Deliverables:**
- Automatic finding assignment based on file path patterns
- CODEOWNERS file parsing for team mapping
- Group notification channels (Slack, Email, Webhook)
- External team sync from GitHub Teams, GitLab Groups

See `docs/_internal/rfcs/2026-01-27-group-access-control-phase-7-10.md` for full implementation plan.

---

## Recent Updates

### 2026-01-27
- **Implementation Planning** - Created detailed implementation plans
  - Group Access Control Phases 7-10 implementation plan
  - 58 placeholder pages implementation plan (22-week roadmap)
  - Added UI implementation status section to ROADMAP
- **Documentation Updates** - Major documentation improvements
  - Added [Workflow Automation](./features/workflows.md) documentation
  - Added [Quality Gates](./features/quality-gates.md) documentation
  - Added [CTEM Finding Fields](./features/ctem-fields.md) documentation
  - Added Platform Agents v3.2 Architecture
  - Added [Admin System Architecture](./architecture/admin-system.md)
  - Fixed Jekyll rendering issues (code block spacing, Liquid syntax)

### 2026-01-23
- **Plan-based Module Control** - Implemented granular module access per plan tier
  - New modules: `pentest`, `remediation`, `threat_intel`, `components`, `credentials`
  - Sidebar now filters based on tenant's plan modules
  - Release status support: `coming_soon` (disabled with "Soon" badge), `beta` (enabled with "Beta" badge)
  - Documentation: Plans & Licensing Guide

### 2026-01-22
- **Notification Integrations** - Implemented full notification channel management
  - Added Slack, Microsoft Teams, Telegram, Custom Webhook providers
  - Severity-based filtering (Critical, High, Medium, Low)
  - Auto-test on create/update
  - Documentation: [Notification Integrations Guide](./guides/notification-integrations.md)

---

## Implementation Notes

### Technical Requirements

Each feature should include:
- API endpoints design
- Database schema
- UI components
- Integration points
- Testing requirements

### Integration Points

- **SIEM:** Splunk, Elastic, Sentinel
- **SOAR:** Phantom, Demisto, Swimlane
- **Ticketing:** Jira, ServiceNow, Zendesk
- **Cloud:** AWS, Azure, GCP APIs
- **Scanning:** Nessus, Qualys, Rapid7

---

## Contributing

When implementing a new feature:

1. Check this document for requirements
2. Create feature branch from `develop`
3. Follow existing patterns in codebase
4. Update this document when complete
5. Remove feature from "Planned" section
6. Add to "Implemented" section

---

**Last Updated:** 2026-01-27
