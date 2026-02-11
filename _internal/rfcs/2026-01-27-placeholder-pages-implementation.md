# Placeholder Pages Implementation Plan

**Status:** Planning
**Created:** 2026-01-27
**Last Updated:** 2026-01-27

---

## Executive Summary

The OpenCTEM UI has **58 placeholder pages** (38% of 151 total) using the `ComingSoonPage` component. This document provides a phased implementation plan organized by CTEM framework priorities.

---

## Current State Analysis

### Pages by Status

| Status | Count | Percentage |
|--------|-------|------------|
| **Implemented** | 93 | 62% |
| **Placeholder** | 58 | 38% |
| **Total** | 151 | 100% |

### Pages by CTEM Phase

| Phase | Implemented | Placeholder | Total |
|-------|-------------|-------------|-------|
| Scoping | 14 | 1 | 15 |
| Discovery | 36 | 9 | 45 |
| Prioritization | 3 | 7 | 10 |
| Validation | 15 | 9 | 24 |
| Mobilization | 9 | 15 | 24 |
| Insights | 6 | 10 | 16 |
| Settings | 10 | 7 | 17 |

---

## Implementation Phases

### Phase 1: Core Mobilization (Weeks 1-4)

**Priority:** HIGH - Enables remediation tracking and team collaboration

#### 1.1 Remediation Module (Week 1-2)

| Page | Route | Backend Status | Effort |
|------|-------|----------------|--------|
| Tasks | `/remediation/tasks` | API exists | 3 days |
| Priority | `/remediation/priority` | API exists | 2 days |
| Overdue | `/remediation/overdue` | API exists | 2 days |
| Teams | `/remediation/teams` | API exists | 2 days |
| Progress | `/progress` | Needs aggregation endpoint | 3 days |

**Database:**
```sql
-- Already exists: remediation_tasks table
-- Add: task_assignments, task_comments, task_history
```

**UI Components:**
```
ui/src/features/remediation/
├── components/
│   ├── task-list.tsx           # Filterable task table
│   ├── task-detail-sheet.tsx   # Side panel for task details
│   ├── task-form.tsx           # Create/edit task
│   ├── task-timeline.tsx       # Activity history
│   ├── priority-matrix.tsx     # Risk vs effort matrix
│   └── team-workload.tsx       # Team capacity view
├── hooks/
│   └── use-remediation.ts      # SWR hooks
└── types/
    └── remediation.ts          # TypeScript types
```

**API Endpoints (already exist, need UI integration):**
```yaml
GET    /api/v1/remediation/tasks
POST   /api/v1/remediation/tasks
GET    /api/v1/remediation/tasks/{id}
PATCH  /api/v1/remediation/tasks/{id}
POST   /api/v1/remediation/tasks/{id}/assign
POST   /api/v1/remediation/tasks/{id}/complete
GET    /api/v1/remediation/stats
```

#### 1.2 Collaboration Module (Week 2-3)

| Page | Route | Backend Status | Effort |
|------|-------|----------------|--------|
| Assignments | `/collaboration/assignments` | Needs API | 3 days |
| Comments | `/collaboration/comments` | Partial API | 2 days |
| Tickets | `/collaboration/tickets` | Integration needed | 4 days |

**New API Endpoints:**
```yaml
# Assignments
GET    /api/v1/assignments
POST   /api/v1/assignments
PATCH  /api/v1/assignments/{id}
GET    /api/v1/me/assignments        # My assignments

# Comments (extend existing)
GET    /api/v1/comments              # Global comment feed
GET    /api/v1/findings/{id}/comments
POST   /api/v1/findings/{id}/comments

# Tickets (integrate with Jira/Linear)
GET    /api/v1/tickets
POST   /api/v1/tickets/sync          # Sync from external
POST   /api/v1/findings/{id}/ticket  # Create ticket from finding
```

**UI Components:**
```
ui/src/features/collaboration/
├── components/
│   ├── assignment-list.tsx     # Assignment table
│   ├── assignment-form.tsx     # Assign to user/group
│   ├── comment-feed.tsx        # Activity stream
│   ├── comment-editor.tsx      # Rich text editor
│   ├── ticket-list.tsx         # External tickets
│   └── ticket-sync-status.tsx  # Sync indicator
└── hooks/
    └── use-collaboration.ts
```

#### 1.3 Exceptions Module (Week 3-4)

| Page | Route | Backend Status | Effort |
|------|-------|----------------|--------|
| Pending | `/exceptions/pending` | Needs API | 3 days |
| Accepted | `/exceptions/accepted` | Needs API | 2 days |
| False Positives | `/exceptions/false-positives` | Needs API | 2 days |

**Database:**
```sql
CREATE TABLE finding_exceptions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    finding_id UUID NOT NULL,
    exception_type VARCHAR(50) NOT NULL,  -- 'accepted_risk', 'false_positive', 'mitigated'
    status VARCHAR(50) NOT NULL,          -- 'pending', 'approved', 'rejected'
    reason TEXT NOT NULL,
    evidence TEXT,

    -- Approval workflow
    requested_by UUID NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL,
    approved_by UUID,
    approved_at TIMESTAMPTZ,

    -- Expiration (for accepted risk)
    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**API Endpoints:**
```yaml
GET    /api/v1/exceptions
POST   /api/v1/exceptions
GET    /api/v1/exceptions/{id}
POST   /api/v1/exceptions/{id}/approve
POST   /api/v1/exceptions/{id}/reject
GET    /api/v1/findings/{id}/exceptions
POST   /api/v1/findings/{id}/exceptions
```

#### 1.4 Workflows UI (Week 4)

| Page | Route | Backend Status | Effort |
|------|-------|----------------|--------|
| Active | `/workflows/active` | API exists | 2 days |
| Templates | `/workflows/templates` | API exists | 2 days |
| Automations | `/workflows/automations` | API exists | 3 days |
| SLA | `/sla` | Needs integration | 3 days |

**Backend exists** - see `workflow_handler.go` and `pipeline_handler.go`

**UI Components:**
```
ui/src/features/workflows/
├── components/
│   ├── workflow-list.tsx       # Active workflows
│   ├── workflow-detail.tsx     # Execution status
│   ├── template-gallery.tsx    # Workflow templates
│   ├── automation-rules.tsx    # Trigger configuration
│   └── sla-dashboard.tsx       # SLA compliance
└── hooks/
    └── use-workflows.ts
```

---

### Phase 2: Discovery & Exposures (Weeks 5-8)

**Priority:** HIGH - Critical security visibility

#### 2.1 Exposures Module (Week 5-6)

| Page | Route | Backend Status | Effort |
|------|-------|----------------|--------|
| Vulnerabilities | `/exposures/vulnerabilities` | Findings API | 2 days |
| Misconfigurations | `/exposures/misconfigurations` | Findings API | 2 days |
| Secrets | `/exposures/secrets` | Needs scanner | 4 days |
| Code | `/exposures/code` | SAST findings | 2 days |
| Credentials | `/exposures/credentials` | Needs scanner | 4 days |

**Note:** These are **filtered views** of the Findings entity, not new entities.

**Implementation Approach:**
```typescript
// Expose finding filters as dedicated pages
// /exposures/vulnerabilities = findings where type = 'vulnerability'
// /exposures/misconfigurations = findings where type = 'misconfiguration'
// /exposures/secrets = findings where type = 'secret_exposure'

// Reuse FindingsTable with preset filters
<FindingsTable
  filters={{ type: 'secret_exposure' }}
  columns={secretSpecificColumns}
/>
```

**New Scanner Integration Required:**
- Gitleaks for secrets (already supported)
- Trufflehog for credential detection
- Custom rules for exposed API keys

#### 2.2 Identity Module (Week 7-8)

| Page | Route | Backend Status | Effort |
|------|-------|----------------|--------|
| Risks | `/identity/risks` | Needs design | 5 days |
| Privileged | `/identity/privileged` | Needs design | 4 days |
| Shadow IT | `/identity/shadow-it` | Needs design | 4 days |

**Database:**
```sql
CREATE TABLE identity_assets (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    identity_type VARCHAR(50) NOT NULL,  -- 'user', 'service_account', 'api_key', 'oauth_app'
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    provider VARCHAR(50),                 -- 'github', 'aws', 'azure', 'gcp', 'okta'
    external_id VARCHAR(255),

    -- Risk attributes
    is_privileged BOOLEAN DEFAULT false,
    is_service_account BOOLEAN DEFAULT false,
    last_active_at TIMESTAMPTZ,
    permission_count INTEGER DEFAULT 0,

    -- Shadow IT detection
    is_approved BOOLEAN DEFAULT true,
    discovered_at TIMESTAMPTZ NOT NULL,

    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE identity_permissions (
    id UUID PRIMARY KEY,
    identity_id UUID NOT NULL REFERENCES identity_assets(id),
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    permission VARCHAR(100),
    is_sensitive BOOLEAN DEFAULT false,
    granted_at TIMESTAMPTZ
);
```

**UI Components:**
```
ui/src/features/identity/
├── components/
│   ├── identity-list.tsx       # Identity inventory
│   ├── permission-viewer.tsx   # Permission breakdown
│   ├── risk-score-card.tsx     # Identity risk scoring
│   ├── privileged-badge.tsx    # Privileged indicator
│   └── shadow-it-alert.tsx     # Unapproved detection
└── hooks/
    └── use-identity.ts
```

#### 2.3 Attack Path Visualization (Week 8)

| Page | Route | Backend Status | Effort |
|------|-------|----------------|--------|
| Attack Paths | `/attack-path-visualization` | Needs graph engine | 5 days |

**Implementation:**
- Use React Flow for graph visualization
- Backend: Graph database or recursive CTE queries
- Show: Asset → Vulnerability → Exploit Path → Critical Asset

**UI Components:**
```
ui/src/features/attack-paths/
├── components/
│   ├── attack-graph.tsx        # React Flow canvas
│   ├── path-node.tsx           # Custom node component
│   ├── path-edge.tsx           # Custom edge (severity colored)
│   ├── path-detail-panel.tsx   # Selected path details
│   └── path-filter.tsx         # Filter by severity/asset
└── hooks/
    └── use-attack-paths.ts
```

---

### Phase 3: Prioritization & Threat Intel (Weeks 9-12)

**Priority:** MEDIUM - Contextual risk scoring

#### 3.1 Risk Scoring Module (Week 9-10)

| Page | Route | Backend Status | Effort |
|------|-------|----------------|--------|
| Overview | `/prioritization/overview` | Needs design | 4 days |
| Scoring | `/scoring` | Needs engine | 5 days |
| Attack Paths | `/attack-paths` | Link to Discovery | 2 days |

**Risk Scoring Engine:**
```go
// api/internal/domain/risk/scorer.go
type RiskScore struct {
    BaseScore      float64 // CVSS or custom
    ExposureFactor float64 // CTEM exposure vector
    AssetValue     float64 // Crown jewel multiplier
    ThreatContext  float64 // Active exploitation
    FinalScore     float64 // Weighted combination
}

func (s *RiskScorer) Calculate(finding *Finding, asset *Asset, threatContext *ThreatContext) RiskScore {
    base := finding.CVSSScore
    exposure := s.calculateExposure(finding)      // Internet-facing = 2.0x
    assetValue := s.getAssetValue(asset)          // Crown jewel = 1.5x
    threat := s.getThreatMultiplier(threatContext) // Active exploit = 1.5x

    return RiskScore{
        BaseScore:      base,
        ExposureFactor: exposure,
        AssetValue:     assetValue,
        ThreatContext:  threat,
        FinalScore:     base * exposure * assetValue * threat,
    }
}
```

**UI Components:**
```
ui/src/features/prioritization/
├── components/
│   ├── risk-overview.tsx       # Dashboard with metrics
│   ├── risk-matrix.tsx         # Severity x Likelihood grid
│   ├── score-breakdown.tsx     # Factor visualization
│   ├── top-risks-list.tsx      # Prioritized list
│   └── score-config.tsx        # Scoring weights config
└── hooks/
    └── use-prioritization.ts
```

#### 3.2 Threat Intelligence Module (Week 10-12)

| Page | Route | Backend Status | Effort |
|------|-------|----------------|--------|
| Active Threats | `/threats/active` | Needs feed integration | 4 days |
| Exploitability | `/threats/exploitability` | KEV + EPSS data | 3 days |
| Feeds | `/threats/feeds` | Feed management | 3 days |
| Trending | `/trending` | Analytics | 3 days |

**External Data Sources:**
- CISA KEV (Known Exploited Vulnerabilities)
- FIRST EPSS (Exploit Prediction Scoring)
- NVD CPE matching
- ExploitDB references

**Database:**
```sql
CREATE TABLE threat_intel_feeds (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    feed_type VARCHAR(50) NOT NULL,  -- 'kev', 'epss', 'nvd', 'custom'
    url TEXT,
    api_key_encrypted TEXT,
    sync_interval VARCHAR(20) DEFAULT '6h',
    last_sync_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE threat_indicators (
    id UUID PRIMARY KEY,
    feed_id UUID REFERENCES threat_intel_feeds(id),
    indicator_type VARCHAR(50) NOT NULL,  -- 'cve', 'ip', 'domain', 'hash'
    value VARCHAR(255) NOT NULL,

    -- KEV specific
    is_known_exploited BOOLEAN DEFAULT false,
    date_added TIMESTAMPTZ,

    -- EPSS specific
    epss_score DECIMAL(5,4),
    epss_percentile DECIMAL(5,4),

    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_threat_indicators_value ON threat_indicators(indicator_type, value);
```

**API Endpoints:**
```yaml
# Feeds Management
GET    /api/v1/threat-intel/feeds
POST   /api/v1/threat-intel/feeds
POST   /api/v1/threat-intel/feeds/{id}/sync

# Indicators
GET    /api/v1/threat-intel/indicators
GET    /api/v1/threat-intel/cve/{cve}         # Get CVE details
GET    /api/v1/threat-intel/enrich/{finding}  # Enrich finding with threat data

# Analytics
GET    /api/v1/threat-intel/trending          # Trending threats
GET    /api/v1/threat-intel/stats             # Feed statistics
```

---

### Phase 4: Validation & Testing (Weeks 13-16)

**Priority:** MEDIUM - Security validation capabilities

#### 4.1 Controls Module (Week 13-14)

| Page | Route | Backend Status | Effort |
|------|-------|----------------|--------|
| List | `/controls/list` | Needs design | 4 days |
| Gaps | `/controls/gaps` | Needs mapping | 4 days |
| Effectiveness | `/controls/effectiveness` | Needs metrics | 4 days |

**Database:**
```sql
CREATE TABLE security_controls (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    framework VARCHAR(50) NOT NULL,      -- 'nist', 'cis', 'iso27001', 'soc2'
    control_id VARCHAR(50) NOT NULL,     -- 'AC-1', 'CIS-1.1'
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),

    -- Implementation status
    status VARCHAR(50) NOT NULL,         -- 'implemented', 'partial', 'planned', 'not_applicable'
    implementation_notes TEXT,
    evidence_links TEXT[],

    -- Effectiveness
    last_tested_at TIMESTAMPTZ,
    test_result VARCHAR(50),             -- 'pass', 'fail', 'partial'
    effectiveness_score INTEGER,          -- 0-100

    owner_group_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE control_finding_mappings (
    control_id UUID REFERENCES security_controls(id),
    finding_type VARCHAR(100),           -- Maps finding types to controls
    PRIMARY KEY (control_id, finding_type)
);
```

**UI Components:**
```
ui/src/features/controls/
├── components/
│   ├── control-list.tsx        # Framework controls
│   ├── control-detail.tsx      # Implementation details
│   ├── gap-analysis.tsx        # Missing/weak controls
│   ├── framework-selector.tsx  # NIST/CIS/ISO selector
│   └── effectiveness-chart.tsx # Control metrics
└── hooks/
    └── use-controls.ts
```

#### 4.2 Simulation Module (Week 14-15)

| Page | Route | Backend Status | Effort |
|------|-------|----------------|--------|
| Campaigns | `/simulation/campaigns` | Needs engine | 5 days |
| Scenarios | `/simulation/scenarios` | Needs library | 4 days |
| Results | `/simulation/results` | Needs storage | 3 days |

**Note:** Attack simulation requires careful implementation for safety.

**Scenarios Library:**
- Phishing simulation (email-based)
- Credential testing (password spraying detection)
- Lateral movement detection
- Data exfiltration detection

#### 4.3 Response Module (Week 15-16)

| Page | Route | Backend Status | Effort |
|------|-------|----------------|--------|
| Detection | `/response/detection` | Needs SIEM integration | 4 days |
| Playbooks | `/response/playbooks` | Needs design | 4 days |
| Time Metrics | `/response/time` | Needs tracking | 3 days |

**MTTD/MTTR Tracking:**
```sql
-- Add to findings table
ALTER TABLE findings ADD COLUMN detected_at TIMESTAMPTZ;
ALTER TABLE findings ADD COLUMN acknowledged_at TIMESTAMPTZ;
ALTER TABLE findings ADD COLUMN contained_at TIMESTAMPTZ;
ALTER TABLE findings ADD COLUMN remediated_at TIMESTAMPTZ;

-- Metrics calculation
CREATE VIEW finding_metrics AS
SELECT
    tenant_id,
    DATE_TRUNC('day', created_at) as date,
    AVG(EXTRACT(EPOCH FROM (acknowledged_at - detected_at))) as avg_mttd_seconds,
    AVG(EXTRACT(EPOCH FROM (remediated_at - acknowledged_at))) as avg_mttr_seconds,
    COUNT(*) as finding_count
FROM findings
WHERE remediated_at IS NOT NULL
GROUP BY tenant_id, DATE_TRUNC('day', created_at);
```

---

### Phase 5: Insights & Reporting (Weeks 17-20)

**Priority:** LOWER - Analytics and reporting

#### 5.1 Analytics Module (Week 17-18)

| Page | Route | Backend Status | Effort |
|------|-------|----------------|--------|
| Trends | `/analytics/trends` | Aggregation queries | 3 days |
| Coverage | `/analytics/coverage` | Asset/scan mapping | 3 days |
| MTTR | `/analytics/mttr` | Metrics queries | 2 days |
| Performance | `/analytics/performance` | Dashboard | 3 days |

**UI Components:**
```
ui/src/features/analytics/
├── components/
│   ├── trend-chart.tsx         # Time series (recharts)
│   ├── coverage-map.tsx        # Asset coverage heatmap
│   ├── mttr-gauge.tsx          # MTTR visualization
│   ├── performance-cards.tsx   # KPI cards
│   └── date-range-picker.tsx   # Filter component
└── hooks/
    └── use-analytics.ts
```

#### 5.2 Reports Module (Week 18-20)

| Page | Route | Backend Status | Effort |
|------|-------|----------------|--------|
| Executive | `/reports/executive` | Template needed | 4 days |
| Technical | `/reports/technical` | Template needed | 4 days |
| Compliance | `/reports/compliance` | Framework mapping | 4 days |
| Scheduled | `/reports/scheduled` | Job scheduler | 3 days |

**Report Generation System:**
```go
// api/internal/app/report_service.go
type ReportService struct {
    templateRepo ReportTemplateRepository
    generator    *ReportGenerator
    scheduler    *ReportScheduler
    storage      StorageService
}

func (s *ReportService) GenerateReport(ctx context.Context, input GenerateReportInput) (*Report, error) {
    // 1. Load template
    template, _ := s.templateRepo.Get(ctx, input.TemplateID)

    // 2. Gather data based on template type
    data := s.gatherReportData(ctx, template, input.Filters)

    // 3. Render to PDF/HTML
    rendered := s.generator.Render(template, data)

    // 4. Store and return
    return s.storage.Save(ctx, rendered)
}
```

**Report Templates:**
- Executive Summary (1-page PDF)
- Technical Detail (Full findings export)
- Compliance Mapping (Framework-specific)
- Trend Analysis (Charts + data)

---

### Phase 6: Settings & Integrations (Weeks 21-22)

**Priority:** LOWER - Configuration pages

#### 6.1 Integration Settings (Week 21)

| Page | Route | Backend Status | Effort |
|------|-------|----------------|--------|
| API Keys | `/integrations/api-keys` | API exists | 2 days |
| Apps | `/integrations/apps` | OAuth flows | 3 days |
| CI/CD | `/integrations/cicd` | Webhook config | 2 days |
| SIEM | `/integrations/siem` | Log forwarding | 3 days |
| Ticketing | `/integrations/ticketing` | Jira/Linear | 3 days |

**Note:** Most backend infrastructure exists in `integration_handler.go`

#### 6.2 Scoring & SLA Settings (Week 22)

| Page | Route | Backend Status | Effort |
|------|-------|----------------|--------|
| Scoring | `/settings/scoring` | Config storage | 2 days |
| SLA Policies | `/settings/sla-policies` | Policy engine | 3 days |
| Scoping Settings | `/scoping/settings` | Config storage | 2 days |

---

## Implementation Summary

### Timeline Overview

```
Week 1-4:   Phase 1 - Mobilization (Remediation, Collaboration, Exceptions, Workflows)
Week 5-8:   Phase 2 - Discovery (Exposures, Identity, Attack Paths)
Week 9-12:  Phase 3 - Prioritization (Risk Scoring, Threat Intel)
Week 13-16: Phase 4 - Validation (Controls, Simulation, Response)
Week 17-20: Phase 5 - Insights (Analytics, Reports)
Week 21-22: Phase 6 - Settings (Integrations, Scoring, SLA)

Total: ~22 weeks (5.5 months)
```

### Effort by Phase

| Phase | Pages | Backend Work | Frontend Work | Total Effort |
|-------|-------|--------------|---------------|--------------|
| 1. Mobilization | 15 | 2 weeks | 2 weeks | 4 weeks |
| 2. Discovery | 9 | 2 weeks | 2 weeks | 4 weeks |
| 3. Prioritization | 7 | 2.5 weeks | 1.5 weeks | 4 weeks |
| 4. Validation | 9 | 2.5 weeks | 1.5 weeks | 4 weeks |
| 5. Insights | 10 | 2 weeks | 2 weeks | 4 weeks |
| 6. Settings | 8 | 1 week | 1 week | 2 weeks |
| **Total** | **58** | **12 weeks** | **10 weeks** | **22 weeks** |

### Dependencies

```
Phase 1 (Mobilization) ─────────────────────────────────────────────────►
         │
Phase 2 (Discovery) ──────────────────────────────────────►
         │                    │
         │                    └──► Phase 3 (Prioritization) ──────────►
         │                                    │
         │                                    └──► Phase 4 (Validation) ──►
         │
         └──────────────────────────────────► Phase 5 (Insights) ─────────►
                                                      │
                                                      └──► Phase 6 (Settings)
```

### Quick Wins (Can implement immediately)

1. **Exposures pages** - Already filtered views of Findings, just need UI
2. **Workflow pages** - Backend fully exists, UI integration only
3. **Remediation pages** - Backend exists, UI integration only
4. **API Keys page** - Backend exists, simple CRUD UI

### Requires Significant Backend Work

1. **Identity/Shadow IT** - New domain entity and discovery logic
2. **Threat Intelligence** - External feed integration
3. **Attack Path Visualization** - Graph algorithm
4. **Simulation Engine** - Complex testing framework
5. **Control Effectiveness** - Testing automation

---

## Technical Standards

### UI Component Pattern

```typescript
// Standard page structure
'use client'

import { useState } from 'react'
import { useFeatureData, useFeatureMutation } from '@/features/{feature}/hooks'
import { FeatureList, FeatureDetail, FeatureForm } from '@/features/{feature}/components'
import { Can, Permission } from '@/lib/permissions'

export default function FeaturePage() {
  const { data, isLoading } = useFeatureData()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (isLoading) return <PageSkeleton />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feature Name"
        description="Feature description"
        action={
          <Can permission={Permission.FeatureWrite}>
            <CreateButton />
          </Can>
        }
      />

      <FeatureList data={data} onSelect={setSelectedId} />

      <FeatureDetailSheet
        id={selectedId}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}
```

### API Integration Pattern

```typescript
// SWR hook pattern
export function useFeatureData(filters?: FeatureFilters) {
  const { data, error, mutate } = useSWR(
    ['feature', filters],
    () => api.feature.list(filters),
    { revalidateOnFocus: false }
  )

  return {
    data: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading: !data && !error,
    error,
    mutate,
  }
}
```

### Permission Integration

All pages must respect the permission system:

```typescript
// Check in sidebar-data.ts
{
  title: 'Feature',
  href: '/feature',
  permission: Permission.FeatureRead,
}

// Check in page components
<Can permission={Permission.FeatureWrite}>
  <CreateButton />
</Can>
```

---

## Related Documentation

- [CTEM Finding Fields](../features/ctem-fields.md)
- [Workflow Automation](../features/workflows.md)
- [Access Control RFC](./2026-01-21-group-access-control.md)
- [Platform Agents v3.2](../architecture/platform-agents-v3.md)
