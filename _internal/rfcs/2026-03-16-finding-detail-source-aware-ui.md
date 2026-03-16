# RFC: Source-Aware Finding Detail UI

**Date:** 2026-03-16
**Status:** Draft
**Author:** Claude + Human
**Priority:** High
**Estimated Effort:** ~3-4 phases, medium complexity

---

## 1. Problem Statement

### 1.1 Current State

The finding detail page uses **one generic layout for all 18 finding sources and 5 finding types**. Every finding — whether it's a SAST code injection, a leaked AWS key, a Terraform misconfiguration, or a pentest PoC — renders through the same Overview/Evidence/Remediation/Attack Path/Related tab structure.

### 1.2 What Exists But Is Never Used

The **backend and type system are fully ready** for source-specific rendering, but the UI ignores it:

| Layer | Status | Details |
|-------|--------|---------|
| DB schema | Done | 220+ columns with type-specific fields (secret_*, compliance_*, web3_*, misconfig_*) |
| Go entity | Done | Type-specific getter methods, conditional serialization in handler |
| API response | Done | `toFindingResponse()` conditionally populates type fields (lines 723-755) |
| TS types | Done | `SecretDetails`, `ComplianceDetails`, `Web3Details`, `MisconfigurationDetails` interfaces defined |
| TS config | Done | `FINDING_TYPE_CONFIG` with icon/color/label for 5 types (lines 698-732 in finding.types.ts) |
| UI rendering | **NOT DONE** | Zero conditional rendering based on `findingType` or `source` |

### 1.3 Specific UX Problems

**Secret Findings** (source: `secret`)
- 11 dedicated fields exist: `secretType`, `secretService`, `secretValid`, `secretRevoked`, `secretEntropy`, `secretMaskedValue`, `secretScopes`, `secretExpiresAt`, `secretRotationDueAt`, `secretAgeInDays`, `secretCommitCount`
- Currently: None displayed. User sees generic vulnerability view with no secret-specific info.
- Impact: Security team can't assess credential risk without switching to scanner tool.

**SCA Findings** (source: `sca`)
- Has: `componentId` (linked to global component with name/version/purl/ecosystem/fixedIn)
- Has: `cve`, `cvss`, affected/fixed version info in metadata
- Currently: Shows CVE badge in header but no package/version context, no upgrade path.
- Impact: Developer doesn't know which dependency to upgrade or to what version.

**IaC/Misconfiguration Findings** (source: `iac`)
- 8 dedicated fields: `misconfigPolicyId`, `misconfigPolicyName`, `misconfigResourceType`, `misconfigResourceName`, `misconfigResourcePath`, `misconfigExpected`, `misconfigActual`, `misconfigCause`
- Currently: None displayed. User sees code snippet but no expected vs actual comparison.
- Impact: DevOps engineer can't understand what the correct configuration should be.

**DAST Findings** (source: `dast`)
- HTTP request/response, endpoint, parameter stored in `metadata` JSONB
- Currently: metadata JSONB is **never rendered anywhere** in the UI.
- Impact: Pentester/AppSec engineer can't see the vulnerable request without checking scanner output.

**Compliance Findings** (type: `compliance`)
- 7 dedicated fields: `complianceFramework`, `complianceControlId`, `complianceControlName`, `complianceResult`, `complianceSection`, `complianceFrameworkVersion`, `complianceControlDescription`
- Currently: Only `complianceImpact` array shown as purple badges in Overview.
- Impact: Compliance team can't assess control status without external reference.

**Web3 Findings** (type: `web3`)
- 8 dedicated fields: `web3Chain`, `web3ChainId`, `web3ContractAddress`, `web3SwcId`, `web3FunctionSignature`, `web3TxHash`, `web3FunctionSelector`, `web3BytecodeOffset`
- Currently: None displayed.

**Pentest/Bug Bounty/Red Team Findings** (source: `pentest`, `bug_bounty`, `red_team`)
- Proof of concept, steps to reproduce, business impact stored in metadata
- Currently: No narrative view, no PoC display, no reproduction steps.

---

## 2. Design Principles

1. **Additive, not destructive** — Keep existing generic layout as fallback. Add source-specific sections on top.
2. **Data-driven** — Use existing `findingType` discriminator and `source` field. No new API changes needed.
3. **Progressive** — Each source-specific component is independent. Ship one at a time.
4. **Reuse existing components** — Use same Card, Badge, CodeHighlighter, Separator patterns from existing tabs.
5. **No new API endpoints** — All data is already returned by `GET /api/v1/findings/{id}`.

---

## 3. Architecture

### 3.1 Source Layout Registry

```typescript
// ui/src/features/findings/config/source-layout.ts

import { FindingSource, FindingType } from '../types/finding.types'

interface SourceLayoutConfig {
  /** Component rendered between header and tabs — the "hero" section */
  heroComponent?: React.ComponentType<{ finding: FindingDetail }>
  /** Tab order — first tab is default active. Unlisted tabs use default order */
  tabOrder?: string[]
  /** Tabs to hide for this source (e.g., attack-path for SCA) */
  hiddenTabs?: string[]
}

/**
 * Primary lookup by findingType (more specific), fallback to source.
 * findingType is set by backend based on source:
 *   secret → 'secret', iac → 'misconfiguration', others → 'vulnerability'
 */
const TYPE_LAYOUTS: Partial<Record<FindingType, SourceLayoutConfig>> = {
  secret: {
    heroComponent: SecretHero,
    tabOrder: ['overview', 'evidence', 'remediation', 'related'],
    hiddenTabs: ['attack-path'],
  },
  misconfiguration: {
    heroComponent: MisconfigHero,
    tabOrder: ['overview', 'evidence', 'remediation', 'related'],
    hiddenTabs: ['attack-path'],
  },
  compliance: {
    heroComponent: ComplianceHero,
    tabOrder: ['overview', 'remediation', 'evidence', 'related'],
    hiddenTabs: ['attack-path'],
  },
  web3: {
    heroComponent: Web3Hero,
    tabOrder: ['overview', 'evidence', 'attack-path', 'remediation', 'related'],
  },
}

const SOURCE_LAYOUTS: Partial<Record<FindingSource, SourceLayoutConfig>> = {
  sast: {
    tabOrder: ['evidence', 'attack-path', 'remediation', 'overview', 'related'],
  },
  dast: {
    heroComponent: DastHero,
    tabOrder: ['evidence', 'remediation', 'overview', 'related'],
    hiddenTabs: ['attack-path'],
  },
  sca: {
    heroComponent: DependencyHero,
    tabOrder: ['overview', 'remediation', 'related', 'evidence'],
    hiddenTabs: ['attack-path'],
  },
  pentest: {
    heroComponent: PentestHero,
    tabOrder: ['evidence', 'overview', 'remediation', 'related'],
  },
  bug_bounty: {
    heroComponent: PentestHero, // reuse
    tabOrder: ['evidence', 'overview', 'remediation', 'related'],
  },
  red_team: {
    heroComponent: PentestHero, // reuse
    tabOrder: ['evidence', 'overview', 'remediation', 'related'],
  },
}

export function getSourceLayout(finding: FindingDetail): SourceLayoutConfig {
  // 1. Check findingType first (more specific)
  if (finding.findingType && TYPE_LAYOUTS[finding.findingType]) {
    return TYPE_LAYOUTS[finding.findingType]!
  }
  // 2. Fallback to source
  if (finding.source && SOURCE_LAYOUTS[finding.source]) {
    return SOURCE_LAYOUTS[finding.source]!
  }
  // 3. Default: no hero, standard tab order
  return {}
}
```

### 3.2 Integration Point in page.tsx

The hero component slots in between the header and tabs in the existing `ResizablePanelGroup` layout:

```tsx
// In findings/[id]/page.tsx — left panel content
const layout = getSourceLayout(finding)
const HeroComponent = layout.heroComponent

<FindingHeader finding={finding} ... />

{/* NEW: Source-specific hero section */}
{HeroComponent && <HeroComponent finding={finding} />}

{/* MODIFIED: Tab order from layout config */}
<Tabs defaultValue={orderedTabs[0]}>
  <TabsList>
    {orderedTabs.map(tab => (
      <TabsTrigger key={tab} value={tab}>...</TabsTrigger>
    ))}
  </TabsList>
  ...
</Tabs>
```

### 3.3 Transform Pipeline Update

The existing `transformApiToFindingDetail()` already maps most fields. Add type-specific detail mapping:

```typescript
// In findings/[id]/page.tsx transform function
const detail: FindingDetail = {
  ...existing mapping...,

  // Type-specific details (already on ApiFinding, just need to pass through)
  findingType: api.finding_type,
  secretDetails: api.secret_type ? {
    secretType: api.secret_type,
    service: api.secret_service,
    valid: api.secret_valid,
    revoked: api.secret_revoked,
    maskedValue: api.secret_masked_value,
    entropy: api.secret_entropy,
    scopes: api.secret_scopes,
    expiresAt: api.secret_expires_at,
    rotationDueAt: api.secret_rotation_due_at,
    ageInDays: api.secret_age_in_days,
    commitCount: api.secret_commit_count,
    inHistoryOnly: api.secret_in_history_only,
    verifiedAt: api.secret_verified_at,
  } : undefined,
  complianceDetails: api.compliance_framework ? {
    framework: api.compliance_framework,
    frameworkVersion: api.compliance_framework_version,
    controlId: api.compliance_control_id,
    controlName: api.compliance_control_name,
    controlDescription: api.compliance_control_description,
    result: api.compliance_result,
    section: api.compliance_section,
  } : undefined,
  web3Details: api.web3_chain ? {
    chain: api.web3_chain,
    chainId: api.web3_chain_id,
    contractAddress: api.web3_contract_address,
    swcId: api.web3_swc_id,
    functionSignature: api.web3_function_signature,
    txHash: api.web3_tx_hash,
    functionSelector: api.web3_function_selector,
    bytecodeOffset: api.web3_bytecode_offset,
  } : undefined,
  misconfigDetails: api.misconfig_policy_id ? {
    policyId: api.misconfig_policy_id,
    policyName: api.misconfig_policy_name,
    resourceType: api.misconfig_resource_type,
    resourceName: api.misconfig_resource_name,
    resourcePath: api.misconfig_resource_path,
    expected: api.misconfig_expected,
    actual: api.misconfig_actual,
    cause: api.misconfig_cause,
  } : undefined,
  metadata: api.metadata,
}
```

---

## 4. Hero Components Specification

### 4.1 SecretHero

**When**: `findingType === 'secret'` (sources: `secret`)

**Display**:

```
┌─────────────────────────────────────────────────────────┐
│ 🔑  Secret Detection                                    │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌────────┐ │
│  │ Type     │  │ Service  │  │ Status    │  │ Age    │ │
│  │ API Key  │  │ AWS      │  │ ● Active  │  │ 45d    │ │
│  └──────────┘  └──────────┘  └───────────┘  └────────┘ │
│                                                          │
│  Value: AKIA****WXYZ                                     │
│  Scopes: s3:GetObject, ec2:DescribeInstances             │
│  Entropy: 4.82                                           │
│                                                          │
│  ⏰ Rotation Due: 2026-04-01 (16 days)                  │
│  📍 Found in 3 commits │ History only: No                │
│                                                          │
│  ⚠ This secret is VALID and has not been revoked.       │
│    Immediate rotation is recommended.                    │
└─────────────────────────────────────────────────────────┘
```

**Key UX decisions**:
- Status indicator: green=revoked, red=valid+active, yellow=unknown — valid active secrets get maximum visual urgency
- `secretExpiresAt` shown with countdown if within 30 days
- `secretRotationDueAt` shown with overdue warning if past due
- Scopes displayed as inline badges
- Masked value shown in monospace font

**Data source**: `finding.secretDetails.*` (all 13 fields)

### 4.2 DependencyHero (SCA)

**When**: `source === 'sca'`

**Display**:

```
┌─────────────────────────────────────────────────────────┐
│ 📦  Dependency Vulnerability                             │
│                                                          │
│  lodash @ 4.17.20                    Ecosystem: npm      │
│  pkg:npm/lodash@4.17.20                                  │
│                                                          │
│  CVE-2021-23337  │  CVSS: 7.2 HIGH                      │
│  EPSS: 34% exploit probability                           │
│                                                          │
│  Affected: < 4.17.21                                     │
│  Fixed in: 4.17.21  ✅ Upgrade available                 │
│                                                          │
│  Dependency: Direct  │  File: package-lock.json:1523     │
└─────────────────────────────────────────────────────────┘
```

**Data source**:
- `finding.component` (enriched from componentId: name, version, purl, ecosystem, fixedIn, isDirect)
- `finding.cve`, `finding.cvss`
- `finding.metadata.affected_version`, `finding.metadata.fixed_version`, `finding.metadata.ecosystem`
- EPSS from threat intel enrichment (already shown in header)

### 4.3 MisconfigHero (IaC)

**When**: `findingType === 'misconfiguration'` (sources: `iac`, `cspm`)

**Display**:

```
┌─────────────────────────────────────────────────────────┐
│ ⚙  Infrastructure Misconfiguration                      │
│                                                          │
│  Policy: CKV_AWS_18 — Ensure S3 access logging enabled  │
│  Resource: aws_s3_bucket.data_lake                       │
│  Path: terraform/main.tf:45                              │
│                                                          │
│  ┌─ Expected ──────────────┐ ┌─ Actual ───────────────┐ │
│  │ logging {               │ │                         │ │
│  │   target_bucket = "..." │ │   (not configured)      │ │
│  │   target_prefix = "log/"│ │                         │ │
│  │ }                       │ │                         │ │
│  └─────────────────────────┘ └─────────────────────────┘ │
│                                                          │
│  Cause: S3 bucket does not have access logging enabled   │
└─────────────────────────────────────────────────────────┘
```

**Key UX decisions**:
- Side-by-side diff view for expected vs actual (green/red backgrounds)
- Policy ID links to Checkov/Trivy docs when possible
- Resource path shown as breadcrumb (provider > service > resource)

**Data source**: `finding.misconfigDetails.*` (all 8 fields)

### 4.4 DastHero

**When**: `source === 'dast'`

**Display**:

```
┌─────────────────────────────────────────────────────────┐
│ 🌐  Dynamic Analysis Finding                            │
│                                                          │
│  POST /api/v1/users/login                               │
│  Parameter: username (body)                              │
│                                                          │
│  ┌─ Request ─────────────┐ ┌─ Response ───────────────┐ │
│  │ POST /api/v1/users/.. │ │ HTTP/1.1 200 OK          │ │
│  │ Host: api.example.com │ │ Content-Type: app/json   │ │
│  │ Content-Type: app/json│ │                           │ │
│  │                       │ │ {"token":"eyJhbG..."}    │ │
│  │ {"username":"admin'-- │ │                           │ │
│  │  OR 1=1","pass":"x"} │ │                           │ │
│  └───────────────────────┘ └───────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Data source**: `finding.metadata.endpoint`, `.method`, `.parameter`, `.request`, `.response`

**Key UX decisions**:
- Split-pane request/response with syntax highlighting
- Endpoint + method shown prominently at top
- Vulnerable parameter highlighted in request body
- Collapsible sections for long request/response bodies

### 4.5 ComplianceHero

**When**: `findingType === 'compliance'`

**Display**:

```
┌─────────────────────────────────────────────────────────┐
│ 📋  Compliance Violation                                 │
│                                                          │
│  PCI-DSS v4.0          Section: Requirement 6           │
│                                                          │
│  Control 6.2.4                                           │
│  Software Engineering Techniques                         │
│                                                          │
│  Result: ❌ FAIL                                         │
│                                                          │
│  Code review processes must include automated checks     │
│  for common software vulnerabilities using industry-     │
│  recognized tools and methods.                           │
└─────────────────────────────────────────────────────────┘
```

**Data source**: `finding.complianceDetails.*` (all 7 fields)

**Key UX decisions**:
- Framework name + version as primary identifier
- Result as large status badge: PASS (green), FAIL (red), MANUAL (yellow), N/A (gray)
- Control description shown in full (expandable if long)
- Link to framework documentation if available

### 4.6 Web3Hero

**When**: `findingType === 'web3'`

**Display**:

```
┌─────────────────────────────────────────────────────────┐
│ ⛓  Smart Contract Vulnerability                         │
│                                                          │
│  SWC-107: Reentrancy                                    │
│  Chain: Ethereum (ID: 1)                                │
│                                                          │
│  Contract: 0x1234...abcd                                │
│  Function: withdraw(uint256)                            │
│  Selector: 0x2e1a7d4d                                   │
│                                                          │
│  [View on Etherscan]  [SWC Registry]                    │
└─────────────────────────────────────────────────────────┘
```

**Data source**: `finding.web3Details.*` (all 8 fields)

**Key UX decisions**:
- Contract address truncated with copy button
- Etherscan link generated from chain + address
- SWC ID links to SWC Registry

### 4.7 PentestHero

**When**: `source in ['pentest', 'bug_bounty', 'red_team']`

**Display**:

```
┌─────────────────────────────────────────────────────────┐
│ 🎯  Penetration Test Finding                            │
│                                                          │
│  Steps to Reproduce:                                     │
│  1. Navigate to /admin/settings                         │
│  2. Intercept request with proxy                        │
│  3. Change role_id parameter to "admin"                 │
│  4. Forward modified request                            │
│                                                          │
│  Business Impact:                                        │
│  Unauthorized privilege escalation allows any            │
│  authenticated user to gain admin access.               │
│                                                          │
│  Attachments: 📎 screenshot.png  📎 burp-session.xml   │
└─────────────────────────────────────────────────────────┘
```

**Data source**: `finding.metadata.steps_to_reproduce`, `.business_impact`, `.proof_of_concept`; `finding.attachments`

**Key UX decisions**:
- Narrative-style layout (not code-centric)
- Steps to reproduce as numbered list
- Business impact in prose block
- Attachments shown as clickable badges
- No code snippet by default (pentest findings are about process, not code)

### 4.8 MetadataViewer (Generic fallback)

For any source that has `metadata` JSONB but no dedicated hero component:

```
┌─────────────────────────────────────────────────────────┐
│ Scanner Metadata                              [Expand]   │
│                                                          │
│  endpoint        https://api.example.com/users          │
│  method          POST                                    │
│  scan_duration   12.5s                                   │
│  scanner_config  { "depth": 3, "threads": 10 }          │
└─────────────────────────────────────────────────────────┘
```

- Key-value pairs for primitive values
- Expandable JSON tree for nested objects
- Placed at bottom of Overview tab
- Only shown if `metadata` is non-empty and non-null

---

## 5. Files to Create/Modify

### New Files

```
ui/src/features/findings/config/
  source-layout.ts                         # Layout registry

ui/src/features/findings/components/detail/heroes/
  index.ts                                 # Barrel export
  secret-hero.tsx                          # Secret detection
  dependency-hero.tsx                      # SCA/dependency
  misconfig-hero.tsx                       # IaC expected vs actual
  dast-hero.tsx                            # HTTP request/response
  compliance-hero.tsx                      # Compliance framework
  web3-hero.tsx                            # Blockchain/smart contract
  pentest-hero.tsx                         # Pentest/bug bounty/red team
  metadata-viewer.tsx                      # Generic JSONB viewer
```

### Modified Files

```
ui/src/app/(dashboard)/findings/[id]/page.tsx
  - Import getSourceLayout and hero components
  - Add hero slot between header and tabs
  - Use layout.tabOrder for tab ordering
  - Use layout.hiddenTabs for tab filtering
  - Update transformApiToFindingDetail() with type-specific detail mapping

ui/src/features/findings/components/detail/overview-tab.tsx
  - Add MetadataViewer section at bottom (when metadata exists and no hero handles it)
  - Add finding type badge next to source badge in Scanner Details section

ui/src/features/findings/types/finding.types.ts
  - Add FindingDetail fields: secretDetails, complianceDetails, web3Details, misconfigDetails, metadata
  - (Types already defined, just need to add to FindingDetail interface if not present)
```

### No Changes Needed

```
api/                        # Backend already returns all fields
finding-header.tsx          # Already shows source badge
evidence-tab.tsx            # Generic, works for all types
remediation-tab.tsx         # Generic, works for all types
data-flow-tab.tsx           # SAST-specific, shown/hidden via layout
related-tab.tsx             # Generic, works for all types
activity-panel.tsx          # Generic, works for all types
```

---

## 6. Implementation Plan

### Phase 1: Foundation + SecretHero + DependencyHero
**Priority: HIGH** (most common finding types, highest user impact)

- [ ] Create `source-layout.ts` with layout registry and `getSourceLayout()`
- [ ] Update `page.tsx` to:
  - Import layout config
  - Add hero component slot
  - Implement tab ordering from config
  - Implement tab hiding from config
- [ ] Update `transformApiToFindingDetail()` to map all type-specific fields
- [ ] Create `SecretHero` component (13 fields from secretDetails)
- [ ] Create `DependencyHero` component (component + CVE + version info)
- [ ] Create `metadata-viewer.tsx` for generic JSONB display
- [ ] Add MetadataViewer to Overview tab bottom (fallback for unmapped sources)
- [ ] Add finding type badge using existing `FINDING_TYPE_CONFIG`

**Acceptance Criteria:**
- Secret findings show credential card with status, maskedValue, rotation info
- SCA findings show package name, version, ecosystem, upgrade path
- Other findings show metadata JSONB when present
- Tab order changes based on source type
- Attack Path tab hidden for sources without data flow

### Phase 2: MisconfigHero + DastHero
**Priority: HIGH** (IaC and DAST are top-5 scanner categories)

- [ ] Create `MisconfigHero` with side-by-side expected/actual diff view
- [ ] Create `DastHero` with split-pane HTTP request/response viewer
- [ ] Add syntax highlighting for HTTP headers and JSON bodies in DastHero
- [ ] Handle long request/response bodies with collapse/expand

**Acceptance Criteria:**
- IaC findings show expected vs actual side-by-side with color coding
- DAST findings show HTTP request and response with endpoint/parameter context
- Metadata fields used by heroes are excluded from MetadataViewer (no duplication)

### Phase 3: ComplianceHero + Web3Hero + PentestHero
**Priority: MEDIUM** (less common finding types)

- [ ] Create `ComplianceHero` with framework/control card and result badge
- [ ] Create `Web3Hero` with contract/chain/SWC info and external links
- [ ] Create `PentestHero` with narrative PoC/steps/impact layout
- [ ] Ensure PentestHero is reused for bug_bounty and red_team sources

**Acceptance Criteria:**
- Compliance findings show framework, control, result prominently
- Web3 findings show contract address, chain, SWC with Etherscan links
- Pentest findings show steps to reproduce and business impact narrative

### Phase 4: Polish + List View Enhancement
**Priority: LOW** (UX refinement)

- [ ] Add finding type icon/badge to findings list page columns
- [ ] Add source-specific icons in list view (not just text labels)
- [ ] Add tooltip on hero components explaining what the source type means
- [ ] Add collapsible hero (user can minimize to save space)
- [ ] Mobile responsive layout for hero components
- [ ] Performance: lazy-load hero components with React.lazy()

**Acceptance Criteria:**
- List view shows finding type icon for quick visual scanning
- Hero sections work on mobile with stacked layout
- Hero can be collapsed to one-line summary

---

## 7. Data Flow Diagram

```
GET /api/v1/findings/{id}
        │
        ▼
   ApiFinding (snake_case, type-specific fields conditional)
        │
        ▼
   transformApiToFindingDetail()
   ├── Core fields → FindingDetail
   ├── api.secret_type? → finding.secretDetails
   ├── api.compliance_framework? → finding.complianceDetails
   ├── api.web3_chain? → finding.web3Details
   ├── api.misconfig_policy_id? → finding.misconfigDetails
   └── api.metadata → finding.metadata
        │
        ▼
   getSourceLayout(finding)
   ├── Check finding.findingType → TYPE_LAYOUTS
   ├── Fallback finding.source → SOURCE_LAYOUTS
   └── Default: no hero, standard tabs
        │
        ▼
   ┌─────────────┐
   │ FindingHeader│ (unchanged)
   ├─────────────┤
   │ HeroComponent│ (NEW: source-specific)
   ├─────────────┤
   │ Tabs         │ (reordered per layout)
   │ ├─ Overview  │
   │ ├─ Evidence  │
   │ ├─ Remediation│
   │ ├─ Attack Path│ (hidden for some sources)
   │ └─ Related   │
   ├─────────────┤
   │ ActivityPanel│ (unchanged)
   └─────────────┘
```

---

## 8. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| metadata JSONB structure varies by scanner | Hero may not find expected fields | Use optional chaining; MetadataViewer as fallback |
| Too many hero components bloat bundle | Slow page load | React.lazy() + Suspense for heroes (Phase 4) |
| Type-specific fields empty for imported findings | Hero shows empty card | Don't render hero if all type-specific fields are null |
| SAST findings have no dedicated hero | Inconsistent UX | SAST already works well with code snippet in Overview + Attack Path tab — no hero needed, just reorder tabs |
| Component data for SCA may not be enriched | DependencyHero shows partial info | Graceful degradation: show what's available, hide empty fields |

---

## 9. Out of Scope

- New API endpoints (all data already returned)
- New database columns or migrations
- Scanner-specific metadata schemas (use generic JSONB)
- Finding list page redesign (Phase 4 adds type badge only)
- Custom hero components per individual scanner tool (hero is per source category, not per tool)

---

## 10. Success Metrics

- Secret findings: All 13 secret-specific fields visible in UI
- SCA findings: Package name, version, ecosystem, fixed version visible
- IaC findings: Expected vs actual shown side-by-side
- DAST findings: HTTP request/response visible
- Compliance findings: Framework, control, result visible
- Web3 findings: Contract, chain, SWC visible
- Pentest findings: Steps to reproduce and PoC visible
- metadata JSONB: Visible for all finding types via MetadataViewer
- Zero regressions: Generic findings without type-specific data render exactly as before
