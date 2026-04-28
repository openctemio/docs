# 2026-Q3 — Pivot Roadmap: Beyond CTEM v1

- **Q/WS**: Q3 2026 + Sprint Demo / WS-PIVOT
- **Status**: Pending design-partner recruitment (Sprint 0). Coding gated on Q2 Phase A completion ([`2026-Q2-ctem-framework-alignment.md`](./2026-Q2-ctem-framework-alignment.md))
- **Related**:
  - Strategic basis → [`audits/2026-04-painpoint-vs-ctem-reality-check.md`](../audits/2026-04-painpoint-vs-ctem-reality-check.md)
  - Framework foundation → [`2026-Q2-ctem-framework-alignment.md`](./2026-Q2-ctem-framework-alignment.md)
  - 5 strategic decisions answered → §1 of this doc

---

## 1. Strategic decisions locked

| # | Decision | Locked answer |
|---|---|---|
| 1 | **Primary customer segment** | Tech-forward mid-market: 50–500 employees, security team 5–25, cloud-native, already has basic VM (Snyk/Tenable), struggling with identity sprawl + AI shadow |
| 2 | **Geographic priority** | SEA + ANZ first (VN/SG/ID/PH/AU/NZ) → broader APAC (JP/KR) → EU → US last. Avoid US/EU until $5M ARR |
| 3 | **Open-source strategy** | Open-core with Fair-Source license (Sentry FSL or Elastic License v2). Free = CTEM 5-stage tooling + multi-tenant + 5 core scanners. Paid = Identity / AI / CRQ / RemOps premium / Enterprise integrations / SSO / SaaS hosted |
| 4 | **Identity stack approach** | BUILD read-only aggregator (Okta + Entra + NHI + OAuth grants); do NOT build ITDR. Integrate Falcon Identity / Defender for Identity as data sources in Q4 |
| 5 | **Time-to-traction** | 6-month design-partner pilot with 3 anchor customers. Defer AI Governance / Supply Chain / Geopolitical / Resilience until post-traction (2027+) |

Pivot positioning statement:
> *"OpenCTEM helps you fix the right things — not just find them — across infrastructure, identity, and AI exposure, with measurable financial outcomes."*

---

## 2. Problem this plan solves

Q2 plan closes **framework gaps** (16/25 → 22/25). It does not address the four painpoints CTEM framework itself does not cover (identity, AI/agent risk, CRQ, RemOps execution).

Without this Q3 pivot:
- Product = "yet another CTEM platform" → commoditised by Q4 2026 when Gartner ships CTEM 2.0
- No defensible differentiation vs. Tenable + Wiz combo
- Mid-market customers churn after 6 months ("solves vuln management I already had, doesn't fix what wakes me up at 3am")

This plan ships the **first three of four bolted-on layers** within the 6-month traction window:
1. **Identity Exposure** (painpoint #1 industry-wide; 60–90% of breaches)
2. **RemOps** (painpoint #2; the "knowing ≠ fixing" gap)
3. **CRQ-lite** (closes board-CISO alignment gap; needed for sales conversations with non-technical buyers)

AI Governance / Supply Chain / Geopolitical / Resilience are explicitly **out of scope** for this 6-month window per Decision #5.

---

## 3. Six-month timeline

Today: 2026-04-28. Q2 Phase A starts immediately after kickoff sign-off.

| Phase | Calendar weeks | Calendar dates | Output |
|---|---|---|---|
| **Sprint 0 — design-partner recruitment** | weeks 1–2 | 2026-05-04 → 2026-05-15 | 3 signed LOIs (1 VN + 1 SG + 1 ANZ) |
| **Q2 Phase A — framework foundation** | weeks 3–14 | 2026-05-18 → 2026-08-07 | Framework score 22/25; reachability + Scope Charter + KEV override + Data Quality dashboard + ATT&CK mapping shipped (per Q2 plan) |
| **Q3 MVP build** | weeks 15–22 | 2026-08-10 → 2026-10-02 | Identity Exposure + RemOps + CRQ-lite shipped to 3 design partners |
| **Sprint Demo** | weeks 23–26 | 2026-10-05 → 2026-10-30 | 3 design partners → 2 paying customers + investor pitch deck + 1 case study |

End of plan: **2026-10-30**. Decision gate at end: ship Q4 (AI Gov + Supply Chain) or extend traction phase.

---

## 4. Sprint 0 — Design-partner recruitment (weeks 1–2)

The single biggest leverage point in this plan. Three customers shape Q3 build; without them we are guessing.

### 4.1 Qualification criteria

A design partner must meet **all** of these:

| Criterion | Why |
|---|---|
| 50–500 employees, ≥5 security staff | Matches segment per Decision #1 |
| Cloud-native (>50% AWS/GCP/Azure) | Identity sprawl + cloud exposure are real |
| Has Okta OR Microsoft Entra as primary IdP | Unblocks Q3 Identity Exposure |
| Already runs at least one VM/scanner (Snyk, Tenable, Trivy, Wiz, etc.) | Has data to ingest; not first-time CTEM buyer |
| Has Jira OR Linear for ticketing | Unblocks RemOps DoD work |
| Security lead willing to give weekly 30-min feedback | Non-negotiable |
| Geo: VN, SG, ID, PH, MY, AU, or NZ | Per Decision #2 |
| Will share anonymised metrics + agree to public case study post-launch | Required for investor pitch |

Anti-criteria (decline politely): >2000 employees (enterprise sales cycle too slow), regulated heavily (FSI/healthcare with 6-month security review), no in-house security team (MSSP buyer = wrong segment).

### 4.2 Outreach sequence

| Week | Activity | Target |
|---|---|---|
| Week 1 day 1–2 | Build prospect list: 30 companies meeting criteria, sourced from LinkedIn + Crunchbase + local security communities (Vietnam Security Network, AISA Sydney, AISP Singapore) | 30 prospects |
| Week 1 day 3–5 | Personal outreach via LinkedIn / cold email to security leads | 30 contacted, target 8 replies |
| Week 2 day 1–3 | 30-min discovery calls with respondents | 6–8 calls |
| Week 2 day 4–5 | Send Letter of Intent (template below) to 3–5 strongest fits | 3 signed LOIs |

### 4.3 LOI template structure

To draft separately at `../_internal/business/design-partner-loi-template.md`. Required sections:
- Mutual scope (what OpenCTEM commits + what partner commits)
- 3-month free trial of all current + Q3 features
- Weekly 30-min feedback call
- Anonymised metrics shared with OpenCTEM team
- Right-to-publish case study after launch (partner approval gate)
- No exclusivity (partner may continue using existing tools)
- 50% discount on first 12-month subscription post-trial
- Termination: either party with 14 days' notice

### 4.4 Discovery call script (top 5 questions)

1. *"Walk me through what happens from a finding being detected to it being fixed. Where does it stall?"* — surfaces RemOps painpoint
2. *"How many identity-related incidents have you had in the last 12 months? What were the root causes?"* — sizes Identity opportunity
3. *"When you report risk to your CEO/board, what format/metric do they actually engage with?"* — sizes CRQ opportunity
4. *"Of the security tools you currently pay for, which would you stop paying for first if you had to cut budget by 30%?"* — surfaces consolidation opportunity
5. *"What would 'success' with a CTEM tool look like in 3 months? In 12 months?"* — defines success metrics for the design-partnership

### 4.5 Sprint 0 success criteria

**Ship-blocker for Q3 build to start:**
- ≥3 signed LOIs covering ≥2 of the 3 target geos
- ≥2 partners using Okta as IdP, ≥1 using Entra ID (otherwise pick one IdP only)
- ≥2 partners using Jira (Linear is fallback)
- All 3 partners have an asset estate ≥500 assets (otherwise scoring/CRQ data too thin)

If these criteria not met by end of week 2: extend Sprint 0 by 2 weeks. Do NOT start Q3 build without 3 LOIs.

---

## 5. Q3 MVP — three workstreams in parallel (weeks 15–22)

### 5.1 Workstream I — Identity Exposure module

**Owner:** Backend lead + 1 frontend
**Effort:** 8 weeks at full-time equivalence

#### I.1 Data model

Reuse existing `assets` table with new asset types — avoid a parallel domain that fights the rest of the platform.

```
migrations/000172_identity_asset_types.up.sql:
  - INSERT INTO asset_types: identity_user, identity_group, identity_app,
    identity_service_principal, identity_oauth_grant
  - ALTER TABLE assets: add columns identity_provider VARCHAR,
    identity_external_id VARCHAR, identity_metadata JSONB
  - UNIQUE INDEX (tenant_id, identity_provider, identity_external_id)
    WHERE identity_provider IS NOT NULL
```

Reuses `exposures`, `findings`, `asset_owners`, `asset_lifecycle` infrastructure as-is. Identity exposures flow through the same ingest → priority → mobilisation pipeline.

#### I.2 Provider integrations

Two providers ship in Q3:

**Okta** (`internal/infra/identity/okta/`):
- API endpoints used: `/users` (paginated), `/groups`, `/apps`, `/users/{id}/factors`, `/logs/authentications` (last-7d)
- Required scopes: `okta.users.read`, `okta.groups.read`, `okta.apps.read`, `okta.factors.read`, `okta.logs.read`
- Auth: API Token (stored via existing `credentials_encrypted`)
- Sync cadence: hourly (configurable per `tenant.settings.identity.sync_interval_minutes`)

**Microsoft Entra ID** (`internal/infra/identity/entra/`):
- Microsoft Graph endpoints: `/users`, `/groups`, `/applications`, `/servicePrincipals`, `/oauth2PermissionGrants`, `/auditLogs/signIns`
- Required scopes: `User.Read.All`, `Group.Read.All`, `Application.Read.All`, `AuditLog.Read.All`
- Auth: app-registration with client credential flow

#### I.3 Exposure detection rules (initial 6)

Rule logic ships in `internal/app/identity/exposure_rules.go`:

| Rule | Logic | Severity |
|---|---|---|
| `dormant_account` | last_login > 90d AND status=active | medium |
| `mfa_gap_admin` | role contains "admin"/"super_admin" AND mfa_factors=0 | critical |
| `privileged_role_sprawl` | count(users WHERE role=admin) > 5 per tenant | high |
| `risky_oauth_grant` | grant.scopes contains any of [Mail.ReadWrite, Files.ReadWrite.All, Directory.ReadWrite.All] AND grant.app NOT IN allowlist | high |
| `stale_service_principal` | service_principal AND last_credential_rotation > 365d | medium |
| `orphaned_identity` | identity_user AND owner_id IS NULL AND tenant.settings.identity.require_owner=true | low |

Rules emit findings tagged with category `identity_exposure` (CTEM-ID `EXP-IDN-001` … `EXP-IDN-006`).

#### I.4 Worker

`internal/infra/controller/identity_sync.go` — runs hourly per integration:
1. Fetch incremental delta from provider (use `Last-Modified` / delta tokens)
2. Upsert `assets` rows with FK on `(tenant_id, identity_provider, identity_external_id)`
3. Run exposure rules over upserted rows
4. Emit findings, dedupe via existing fingerprint logic
5. Update `integration_scm_extensions`-equivalent `integration_identity_extensions` with last_sync_at + stats

Rate limits: Okta = 600 req/min default; Entra = 10K req per app per 10s. Worker honours `Retry-After`.

#### I.5 UI surface

- New left-nav section "Identity" under "Discovery"
- Pages:
  - `/identity` — overview dashboard (counts by provider, top exposures, MFA coverage %)
  - `/identity/users` — searchable list with reachability/risk-score columns
  - `/identity/applications` — OAuth grants + scopes view
  - `/identity/findings` — filtered findings list (category=identity_exposure)
- Asset-detail page: identity assets get a dedicated tab with provider-specific metadata

#### I.6 Acceptance criteria

- 3 design partners successfully connect Okta or Entra
- ≥1000 identity assets per partner discovered within 1 hour of integration
- ≥10 identity findings surfaced per partner with the 6 detection rules
- Sync succeeds for 7 consecutive days without manual intervention
- One partner reports an actionable identity finding in their first weekly call

### 5.2 Workstream II — RemOps MVP

**Owner:** Backend lead + 0.5 frontend
**Effort:** 6 weeks

#### II.1 Definition-of-Done ticket template

Replaces ad-hoc Jira description with framework-aligned 7-section body.

`internal/app/ticket/templates/remops_dod.md.tmpl` sections:
1. **Exposure & Asset Identifiers** — exposure_id, asset_id, asset_name, business_service
2. **Business Impact** — translated from CRQ-lite ($ ALE) + crown-jewel flag
3. **Sanitised Evidence** — first_seen, last_seen, scanner output (PII-stripped)
4. **Preferred Fix** — primary remediation with pinned version / config
5. **Alternatives** — 2 backup options if preferred is blocked
6. **Verification Plan** — exact re-scan command + expected pass condition
7. **Definition of Done** — list of conditions; ticket cannot close until all checked

`internal/app/jira/ticket_builder.go` and `linear/ticket_builder.go` render this template. Old "raw description dump" stays available behind `tenant.settings.ticket_template_version='v1'` for rollback.

#### II.2 Ownership SLA worker

`internal/infra/controller/ownership_sla.go` — runs every 10 minutes:
- Find P0 findings WHERE assigned_to IS NULL AND age > 1 hour → escalate to tenant owner + Slack #security-critical channel
- Find P1 findings WHERE assigned_to IS NULL AND age > 24 hours → escalate to tenant admin
- Emit audit event `unowned_critical_alert` per escalation
- Emit metric `unowned_p0_count` (Prometheus gauge)

UI: Settings → Mobilisation → "Ownership SLA Configuration" — tenant can adjust escalation thresholds + targets.

#### II.3 Exception governance auto-reopen

Already half-built per Q2 plan B1. This workstream completes:
- Worker `internal/infra/controller/suppression_expiry.go` (per Q2 spec)
- Adds: when finding auto-reopens after exception expiry, send notification to the original suppression-requester + new finding owner with link to the original justification
- Adds metric: `exceptions_auto_reopened_total` (Prometheus counter)

#### II.4 ROC dashboard

`/mobilisation/roc` page (RemOps dashboard) — single-page operations view:
- Top: "Unowned P0/P1" widget — count + list with one-click assign
- Middle: "SLA Breaches" widget — findings past due-date by severity
- Bottom-left: "Re-opened from Exception" — recent auto-reopens needing review
- Bottom-right: "Mean time to Owner Assignment" trend line

#### II.5 Acceptance criteria

- All 3 design partners' new tickets export with the 7-section DoD template
- ≥1 escalation event triggered per week per partner (proves the SLA worker works in production)
- Zero unowned P0 findings after 1 hour at any partner by week 22
- ≥3 expired exceptions auto-reopened across all partners (proves governance loop)
- ROC dashboard loads in <2s with 50K findings

### 5.3 Workstream III — CRQ-lite ($ exposure)

**Owner:** Backend (1 dev) + design (UI mockups)
**Effort:** 4 weeks

#### III.1 The model

FAIR-lite (no Monte Carlo, just point estimates — full FAIR requires actuarial-grade input data we will not have in MVP).

```
ALE (Annualised Loss Expectancy) = LEF × LM
LEF (Loss Event Frequency, /year) = exploit_likelihood × reachability_factor × control_factor
LM  (Loss Magnitude, $)           = base_business_value × CIA_impact_factor × data_classification_factor
```

Inputs (per asset, configured by tenant):
- `business_value_usd` — base $ if asset fully compromised. Default: $10K low / $100K medium / $1M high / $10M crown-jewel
- `cia_impact_factor` — 0.3 / 0.7 / 1.0 for one/two/three of CIA breached (per finding)
- `data_classification_factor` — 1.0 public / 1.5 internal / 3.0 confidential / 10.0 PII/PHI

Inputs (per finding, derived):
- `exploit_likelihood` — derived from EPSS + KEV + exploit_maturity. Range 0.01–0.95
- `reachability_factor` — 1.5 internet / 1.0 vpn / 0.4 internal / 0.1 admin_only (uses Q2 reachability field)
- `control_factor` — 1.0 if no validated compensating control, 0.5 if one, 0.2 if multiple

#### III.2 Implementation

`migrations/000173_crq_inputs.up.sql`:
- `ALTER TABLE assets`: business_value_usd NUMERIC, data_classification_factor NUMERIC DEFAULT 1.0
- `ALTER TABLE tenants`: industry_default_loss_ratios JSONB (e.g., `{"finance":1.5,"healthcare":2.0,"saas":1.0}`)
- `ALTER TABLE findings`: ale_usd NUMERIC, ale_calculated_at TIMESTAMPTZ
- New table `crq_calculation_log` for audit trail of $ calculations

`internal/app/crq/calculator.go` — pure function `Calculate(asset, finding, tenant) → ALE`. Recomputed every time finding or asset mutates. Cached.

#### III.3 UI

- Findings list: new column `$ Annual Loss` sortable
- Asset detail: "Financial Exposure" panel showing total ALE for that asset
- Dashboard: "Top 10 Exposures by $ ALE" widget — board-ready
- Settings: "Asset Valuation" page — tenant configures business_value defaults + per-asset overrides
- Report: weekly `executive_digest.md` (per Q2 plan B4) now includes "$X total exposure removed this week"

#### III.4 Acceptance criteria

- Each design partner sees ALE on every finding within 1 day of enabling
- Top-10 ALE list correlates with at least 70% of partner's manual "what worries me most" ranking (validated in weekly call)
- Weekly executive digest includes $ exposure removed/added
- Calculation completes in <50ms per finding (no perceptible UI lag)

#### III.5 Honest caveats — disclosed in UI

- "This is a directional estimate, not an actuarial figure. For board-grade CRQ use FAIR, Kovrr, or Safe Security."
- Tenant can override any auto-calculated ALE
- All calculation inputs are visible (transparency)

---

## 6. Sprint Demo (weeks 23–26)

Goal: convert 3 design partners to 2 paying + produce investor demo material.

### 6.1 Week 23 — case study build

- Pick the partner with the most quantifiable wins (probably highest # exposures resolved)
- Anonymise to "MidSize SaaS Co — APAC region — 200 employees"
- Format: 1-page metric snapshot + 2-page narrative
- Metrics to include: # identity exposures discovered + remediated, MTTR before/after, $ ALE removed, framework KPI movement
- Save to `api/docs/case-studies/2026-q3-design-partner-1.md`

### 6.2 Week 24 — investor deck

12-slide structure:
1. Hook: "60% of breaches start with identity. Most CTEM tools cannot see identity. We can."
2. Painpoint: 3 of the 10 from reality-check audit
3. Why CTEM is necessary but insufficient (diagram)
4. Our pivot: CTEM + Identity + RemOps + CRQ
5. Product demo (live)
6. Case study (anonymised)
7. Market: SEA/ANZ → APAC → EU
8. Competition: positioning matrix vs Wiz / Tenable / CrowdStrike
9. Open-core business model
10. Metrics: design partners, MAUs, revenue trajectory
11. Team
12. Ask + use of funds

Deliverable: `../_internal/business/2026-q3-investor-deck.md` (markdown source) + Keynote/Slides export.

### 6.3 Week 25 — paid conversion

- 1:1 conversion meetings with all 3 design partners
- Offer: 50% discount Year 1 (per LOI), full price Year 2
- Pricing: assume $X/security-team-member/month for Pro tier (TBD by founder + reality-check competitive analysis)
- Goal: 2 of 3 sign annual contracts

### 6.4 Week 26 — ship + retro

- Cycle retrospective per Q2 plan B5
- Update reality-check audit with learnings
- Decide Q4 priority: AI Governance OR more identity depth (NHI deep dive) — based on partner pull
- Plan next 90-day cycle

---

## 7. Migration & rollout discipline

### Reserved migration numbers

| Number | Purpose |
|---|---|
| 000172 | Identity asset types + identity_provider columns on assets |
| 000173 | CRQ inputs (business_value, ale_usd, classification factors) |
| 000174 | Identity provider integration extensions table |
| 000175 | RemOps metrics tracking (escalations, exceptions reopened) |

### Feature flags (open-core gating)

| Flag | Default | Tier |
|---|---|---|
| `features.identity_exposure_okta` | false | Paid |
| `features.identity_exposure_entra` | false | Paid |
| `features.crq_lite` | false | Paid |
| `features.remops_dod_template` | true (new) / false (existing) | Free baseline; DoD enforcement is paid |
| `features.ownership_sla_worker` | false | Paid |
| `features.exception_auto_reopen` | true | Free (Q2 already shipped) |

Free tier still gets a "Lite" identity dashboard showing manual CSV upload of users — minimum viable so community sees the path.

### Open-core license switch (Sprint 0 prerequisite)

- Apply Fair-Source license (Sentry FSL or BSL with 4-year transition to Apache 2) at top of repo
- New `LICENSE-PAID-MODULES.md` for commercial features
- Existing contributors: reach out for CLA acceptance OR pay-for-rewrite affected commits
- This must complete before week 1 to avoid licensing limbo on new code

---

## 8. Metrics — success gates

End-of-plan target (2026-10-30):

| Metric | Baseline (today) | Target |
|---|---|---|
| Signed design partners | 0 | 3 |
| Paying customers | 0 | 2 |
| Identity assets discovered across partners | 0 | ≥3000 |
| Identity findings surfaced (across partners) | 0 | ≥30 |
| Findings exported via DoD template | 0 | 100% on opted-in tenants |
| P0 findings unowned >1 hour | unknown | 0 |
| Findings with $ ALE calculated | 0 | 100% on CRQ-enabled tenants |
| Exceptions auto-reopened | 0 | ≥3 |
| Investor pitch deck shipped | no | yes |
| Anonymised case study published | no | yes |
| Framework score | 16/25 (today) → 22/25 (Q2 end) | 24/25 (Q3 end) |
| ARR pipeline | $0 | ≥$50K signed + $200K qualified |

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Design partner recruitment slips Sprint 0** | Pre-allocate 4 weeks for Sprint 0 in worst case; accept 2 partners minimum (one identity-Okta + one identity-Entra); do NOT proceed with 0 partners |
| **Q2 Phase A overruns into Q3 window** | Q2 plan has 12 deliverables; if behind by week 12, cut Q2 ATT&CK mapping (lowest customer-facing impact) and proceed with Q3 |
| **Okta API rate-limit blocks partner sync** | Rate-limit aware worker with `Retry-After` honour; per-tenant sync interval configurable; offer "burst sync" only on first connection then incremental |
| **CRQ-lite numbers embarrass us in front of customer** | Ship with prominent "directional estimate, not actuarial" disclaimer; let customer override every value; surface inputs transparently |
| **Partner feature requests drag scope** | Weekly call has fixed agenda: 10 min wins, 10 min blockers, 10 min next-week. Feature requests go to backlog, not current sprint |
| **Open-core license switch loses contributors** | Send personal note 30 days before switch; offer contributor-equivalent benefits (free Pro tier forever, advisory board seat for top-3 contributors) |
| **Identity Exposure module discovers severe issues partner cannot fix in trial period** | Discovery includes a "remediation playbook" for each rule; partner gets 4 weeks past trial to fix before metrics shared with OpenCTEM team |
| **Sprint Demo has no usable case study** | Pre-emptive Week 18 review: pick the strongest partner story, double-down on instrumentation; if all 3 partners under-deliver, extend Sprint Demo by 2 weeks rather than ship a weak case study |

---

## 10. Out of scope (explicit defer)

These remain deferred until post-traction (2027+) or customer pull:

- **AI Governance / Agent identity / Prompt-injection harness** — Q4 2026 if traction proven, otherwise Q1 2027
- **Software supply chain depth** (SBOM transitive graph, build pipeline integrity, signing attestation) — Q1 2027
- **Geopolitical risk module** — only if a customer specifically requests
- **Resilience layer** (tabletop, immutable backup posture, regulator readiness) — 2028
- **Insider risk / DLP / UEBA** — only via integration partner, not in-house
- **OT/ICS coverage** — explicit no-go this segment is wrong industry for our buyer
- **CrowdStrike Falcon Identity / Defender for Identity integration** — Q4 2026 as data-source pull, not Q3 build
- **EU + US market entry** — geo expansion deferred to Q1 2027 minimum
- **Mobile / IoT / Container deep scanning** — out of scope; integrate Trivy results for containers, that's it

---

## 11. Execution sequence — Sprint 0 → Q3 → Demo

Initial 30-task list to seed TaskCreate (one task per row; depends-on chain implied by ID ordering):

### Sprint 0 (weeks 1–2)
1. Apply Fair-Source license, draft contributor outreach note
2. Build prospect list of 30 mid-market companies in SEA/ANZ
3. Send LinkedIn / email outreach to all 30
4. Schedule 6–8 discovery calls
5. Run discovery calls with structured script (§4.4)
6. Draft + send LOI to 3–5 strongest fits
7. Sign 3 LOIs

### Q2 Phase A (weeks 3–14) — already specified in Q2 plan, executed in parallel/before Q3

### Q3 Workstream I — Identity Exposure (weeks 15–22)
8. Migration 000172 — identity asset types + columns
9. Migration 000174 — identity provider integration extensions
10. Okta API client (`internal/infra/identity/okta/`)
11. Entra ID API client (`internal/infra/identity/entra/`)
12. Identity sync controller (`internal/infra/controller/identity_sync.go`)
13. Implement 6 detection rules in `exposure_rules.go`
14. UI: identity overview dashboard
15. UI: identity users + applications list pages
16. UI: identity findings filter integration
17. End-to-end test with at least one partner's Okta + one partner's Entra

### Q3 Workstream II — RemOps (weeks 15–22, parallel)
18. DoD template file + Jira/Linear builders
19. Ownership SLA controller
20. Exception auto-reopen worker (completes Q2 B1)
21. ROC dashboard UI
22. Migration 000175 — RemOps metrics tracking
23. Settings UI for SLA thresholds + escalation targets

### Q3 Workstream III — CRQ-lite (weeks 15–22, parallel)
24. Migration 000173 — CRQ inputs + ALE columns
25. CRQ calculator pure function + tests
26. Wire ALE recalculation on finding/asset mutation (event hooks)
27. UI: $ ALE column on findings + asset financial exposure panel
28. UI: asset valuation settings page

### Sprint Demo (weeks 23–26)
29. Build anonymised case study from strongest partner
30. Build 12-slide investor deck (markdown source + Keynote export)
31. Run conversion meetings with all 3 design partners
32. Cycle retrospective + Q4 planning

Each item becomes a PR with branch convention `feat/q3-<workstream>-<short-description>` (e.g., `feat/q3-identity-okta-client`). Each PR cites which acceptance criterion in §5 it satisfies and shows before/after partner data where relevant.

---

## 12. Post-Q3 decision gate (2026-10-30)

At the end of Sprint Demo, decide based on signal:

| Signal | Decision |
|---|---|
| 2+ paying customers + ≥$50K ARR + investor interest | Ship Q4: AI Governance + Supply Chain depth + EU market exploration |
| 1 paying customer + lukewarm investor signal | Extend traction: 3 more design partners in Q4, refine Identity / RemOps / CRQ deeper before adding new modules |
| 0 paying customers | Major retro: question segment / geo / pricing assumptions in this plan; consider pivot to identity-only product or Falcon Identity reseller motion |

Write next 90-day plan with framework-aligned naming (`2026-Q4-<theme>.md`) by end of week 26.
