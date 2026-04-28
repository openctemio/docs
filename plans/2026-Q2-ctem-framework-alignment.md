# 2026-Q2 — CTEM Framework Alignment

- **Q/WS**: Q2 2026 / WS-CTEM-FW
- **Status**: Pending decisions (see §2) — coding blocked until scoping answers land
- **Related audit**: [`audits/2026-04-ctem-framework-gap-analysis.md`](../audits/2026-04-ctem-framework-gap-analysis.md)
- **Framework reference**: [ctem.org/docs](https://ctem.org/docs)

---

## 1. Problem

OpenCTEM ships strong tooling for Discovery + Prioritization + Validation, but is *not yet a CTEM product by framework standard* (16 / 25 framework-alignment score). The gap is concentrated in **Stage 1 (Scoping)** and **Stage 5 (Mobilization)** — both "operating-model" stages the framework explicitly warns cannot be solved by more dashboards.

This plan closes the gap over one 90-day framework cycle, plus cuts over-engineered surface. It is intentionally structured as the framework's own 90-day pilot cadence so we can dog-food.

## 2. Decisions needed FIRST (before coding)

Five calls. Each unblocks a P0/P1/P2 workstream. Stop-ship: nothing below starts until these answers are committed in writing.

| # | Decision | Reviewer recommendation | Rationale |
|---|---|---|---|
| 1 | Starting scope for first production customer | **External attack surface** | Framework's Gartner-recommended default. Also matches current Discovery strengths |
| 2 | Module system fate | **Remove entirely** | Zero route-level gating today; feature flags belong in env vars / `tenant.settings` |
| 3 | Workflow builder fate | **Simplify to 4 built-in templates** | Custom builder is 3865 LOC of surface with no customer validating the need |
| 4 | Compliance frameworks (8 seeded, no UI) | **Archive tables, remove UI stubs** | Dead weight; re-introduce when a customer explicitly contracts for it |
| 5 | First IdP integration target | **Okta** | Higher enterprise market share than Azure AD for our pipeline |

---

## 3. 90-day plan — week-by-week

Cycle alignment: **Week 1 = Monday of the sprint that follows decision sign-off.** The plan assumes decisions land in a single kickoff meeting before Week 1.

### Phase A — Weeks 1–4 (P0: framework-alignment foundation)

Goal: make the product *scoreable* against framework KPIs within one month.

| ID | Deliverable | Owner | Ships to |
|---|---|---|---|
| **A1** | Reachability + preconditions as first-class data | Backend | api + ui |
| **A2** | Scope Charter + Boundary Statement entities | Backend + UI | api + ui |
| **A3** | "KEV + reachable + crown-jewel = P0" auto-override | Backend | api |
| **A4** | Data Quality Scorecard dashboard | Full-stack | api + ui |
| **A5** | MITRE ATT&CK mapping on findings + pentest | Backend + UI | api + ui |
| **A6 (cut)** | Remove module system | Backend | api + ui |
| **A7 (cut)** | Remove LDAP + Threat Actor matching stubs | Backend | api |

#### A1 — Reachability + preconditions

**Files / migrations:**
- `migrations/000166_reachability_first_class.up.sql`
  - `ALTER TABLE assets ADD COLUMN reachability VARCHAR CHECK (reachability IN ('internet','vpn','internal','admin_only','unknown'))`
  - `ALTER TABLE exposures ADD COLUMN reachability VARCHAR CHECK (...)`, `ALTER TABLE exposures ADD COLUMN preconditions JSONB DEFAULT '[]'::jsonb`
  - `ALTER TABLE findings ADD COLUMN reachability VARCHAR CHECK (...)`
- `pkg/domain/asset/entity.go` — `Reachability()` getter + `SetReachability()` with validation
- `internal/app/finding/priority_classification.go` — blend reachability into score (multiplier: internet ×1.5, vpn ×1.0, internal ×0.6, admin_only ×0.3, unknown ×1.0)
- UI: `src/features/assets/components/reachability-badge.tsx`; filter on assets + findings list

**Definition of Done:** every seeded asset has a non-null reachability; priority_score changes measurably when reachability flips; filter works on list pages.

#### A2 — Scope Charter + Boundary Statement

**Files / migrations:**
- `migrations/000167_scope_charter.up.sql` — tables `scope_charters`, `boundary_statements`; FK `ctem_cycles.scope_charter_id`
- `pkg/domain/scopecharter/` — new package
- `internal/app/scopecharter/service.go` — CRUD + activate/deactivate
- `internal/infra/http/handler/scope_charter_handler.go`
- UI: `src/app/(dashboard)/scoping/charter/page.tsx` — single-page form matching framework one-page format
- **Middleware guard**: `scan` + `ingest` routes refuse with 412 Precondition Failed when tenant has no active Charter

**Scope Charter required fields** (enforced at API level):
- `business_risk_hypothesis` (text, required)
- `in_scope` (text, required)
- `out_of_scope` (text, required)
- `attacker_model` (enum: external / insider / supplier / mixed)
- `timebox_start`, `timebox_end` (dates, required, end ≤ start + 90 days)
- `success_metrics` (JSONB, required, min 1 entry)

**Definition of Done:** creating a Charter transitions tenant from "setup" to "active"; scan routes 412 until Charter active; UI blocks "Start scan" button with inline explanation.

#### A3 — KEV + reachable + crown-jewel override

**Files:**
- `internal/app/finding/priority_classification.go` — add `applyFrameworkOverrides()` step after base scoring
- `pkg/domain/asset/entity.go` — add `IsCrownJewel() bool` (backed by existing `criticality` OR new explicit flag)
- `pkg/domain/audit/value_objects.go` — add `ActionPriorityOverrideApplied`
- Test: `internal/app/finding/priority_classification_test.go` with 4 matrix cases (KEV yes/no × reachable yes/no × crown-jewel yes/no × CVSS low/high)

**Logic:**
```go
if finding.InKEV() && asset.IsReachableFromInternet() && asset.IsCrownJewel() {
    score.PriorityClass = PriorityP0
    score.OverrideReason = "framework_kev_reachable_crownjewel"
    audit.LogPriorityOverride(...)
}
```

**Definition of Done:** unit tests cover matrix; audit event emitted on trigger; a/b comparison on seed data shows expected overrides.

#### A4 — Data Quality Scorecard

**Files:**
- `internal/app/metrics/data_quality.go` — 5 aggregate queries
- `internal/infra/http/handler/metrics_handler.go` — `GET /api/v1/metrics/data-quality`
- UI: `src/app/(dashboard)/metrics/data-quality/page.tsx`

**5 KPIs per framework:**
1. `% assets with owner` (target ≥95%)
2. `% exposures with evidence` (target ≥90%)
3. `median external last-seen age` (target <48h)
4. `dedup rate` (target: rising early, stable later)
5. `unknown-asset rate` (target: trending down)

Each card shows value + target + trend (30-day sparkline) + "what to do if red".

**Definition of Done:** dashboard reachable from sidebar; all 5 cards load in <2s; red cards link to the list of offending rows.

#### A5 — MITRE ATT&CK mapping

**Files / migrations:**
- `migrations/000168_mitre_attack.up.sql` — tables `mitre_tactics`, `mitre_techniques`, `finding_attack_techniques`, `pentest_finding_attack_techniques`
- Seed script: parse ATT&CK STIX JSON from [github.com/mitre/attack-stix-data](https://github.com/mitre/attack-stix-data), insert v14.1 enterprise matrix
- `internal/app/finding/service.go` — `AttachAttackTechniques(findingID, techniques)`
- UI: multi-select autocomplete on finding detail page; ATT&CK coverage dashboard

**Definition of Done:** seed loads 14 tactics + 595 techniques; finding detail page shows mapped techniques; coverage dashboard renders matrix.

#### A6 — Cut: module system

**Delete:**
- `internal/domain/module/`, `internal/app/module/`
- `internal/infra/postgres/module_*_repository.go`
- Routes in `internal/infra/http/routes/`
- UI `src/features/modules/` if any
- Migrations 000080, 000089, 000117, 000118, 000161, 000162 → **not rolled back**; add `migrations/000169_drop_modules.up.sql` dropping tables

**Feature flags substitute:** any flag previously in `modules` becomes `tenant.settings.features.<name>` bool.

**Definition of Done:** zero references to `module` under `internal/`; UI sidebar unaffected; migration drops tables cleanly.

#### A7 — Cut: LDAP + Threat Actor stubs

- Delete `internal/domain/accesscontrol/group_sync.go` + any referencing interface
- Delete `threat_actor_matching` stub methods in `threat_actor_repository.go`; leave CRUD for the seeded rows (we display them)

---

### Phase B — Weeks 5–8 (P1: operating-model discipline)

Goal: make the product *enforce framework discipline*, not just measure it.

| ID | Deliverable | Owner | Ships to |
|---|---|---|---|
| **B1** | Exception governance worker (expired suppression auto-reopen) | Backend | api |
| **B2** | DoD template on ticket export | Backend | api |
| **B3** | Remediation re-validation hook | Backend | api + agent |
| **B4** | Executive narrative weekly digest | Backend + UI | api + ui |
| **B5** | Cycle retro UI | Full-stack | api + ui |
| **B6 (cut)** | Simplify workflow builder to 4 templates | Backend + UI | api + ui |
| **B7 (cut)** | Archive compliance framework UI | UI | ui |
| **B8 (cut)** | Deprecate Telegram notification channel | Backend | api |

#### B1 — Exception governance

- New controller `internal/infra/controller/suppression_expiry.go` (daily, aligned with asset lifecycle worker pattern)
- Finds `suppressions` where `expires_at < NOW() AND status != 'expired'`
- Transitions status → `expired`, reopens linked findings, emits audit event + notification to suppression requester
- Migration: add `suppressions.status` enum if missing

#### B2 — Definition-of-Done ticket template

- Template file: `internal/app/ticket/templates/jira_definition_of_done.md.tmpl`
- 7 required sections: Exposure IDs, Asset IDs, Business Impact, Sanitised Evidence (first/last-seen), Preferred Fix, Alternatives, Verification Plan + Definition of Done
- `internal/app/jira/ticket_builder.go` — render template with evidence from finding + asset + scope charter
- Backward-compat: keep old builder behind `tenant.settings.ticket_template_version = 'v1'`

#### B3 — Remediation re-validation hook

- `internal/app/finding/actions.go` — on `status → resolved`, enqueue re-scan job targeting same asset + scanner + rule_id
- Re-scan delay: 5 minutes (config `tenant.settings.revalidation.delay_seconds`, default 300)
- If re-scan finds the issue again: status auto-flips to `regression`, priority upgraded by one class, audit event emitted, notification sent

#### B4 — Executive narrative digest

- `internal/app/reports/executive_digest.go` — weekly cron
- Digest content: "This week: N P1 exposures removed, M new P0, MTTR delta X%, 3 stale items by team"
- Delivery: email (primary) + Slack (if integration present) — reuses notification outbox
- Template: `internal/app/reports/templates/executive_digest.md.tmpl`

#### B5 — Cycle retro UI

- `migrations/000170_cycle_retro.up.sql` — `cycle_retrospectives` table
- 5 framework-aligned questions:
  1. What did we discover that we didn't expect?
  2. What did we remediate?
  3. What got stuck, and why?
  4. What should change in the next cycle's scope?
  5. Who owns the change?
- UI: modal at cycle close; answers become Scope Charter draft for next cycle

#### B6 — Simplify workflow builder

- Ship 4 built-in templates (read-only): finding_created→triage, sla_breach→escalate, scan_completed→notify, finding_resolved→re-validate
- Put "Custom workflow builder" behind `tenant.settings.features.workflow_builder_beta = false` (off by default)
- Keep engine code; hide UI
- Revisit when 10+ customers ask

#### B7 — Archive compliance UI

- Hide `/compliance/*` routes behind `tenant.settings.features.compliance_assessments_beta = false`
- Keep DB tables + seed data (cheap)
- Add stub page: "Compliance module is in development. Contact sales to pilot."

#### B8 — Deprecate Telegram

- Mark `telegram` provider in `internal/infra/notification/telegram/` as deprecated (log.Warn on use)
- Remove from new-integration UI provider list
- Keep ingestion for existing tenants

---

### Phase C — Weeks 9–12 (P2: differentiators)

Goal: out-execute "vuln dashboards" by shipping framework primitives they can't: identity + SaaS posture + attack-path solver.

| ID | Deliverable | Owner | Ships to |
|---|---|---|---|
| **C1** | Okta identity posture discovery (MVP) | Backend | api + agent |
| **C2** | Google Workspace OR Microsoft 365 SaaS posture (MVP) | Backend | api + agent |
| **C3** | CTEM exposure taxonomy adoption | Backend | api |
| **C4** | Attack-path solver completion | Backend + UI | api + ui |
| **C5** | Validation downgrade lifecycle | Backend + UI | api + ui |

#### C1 — Okta identity posture

- New integration category `identity` in integration schema
- New asset types: `identity_user`, `identity_group`, `identity_app_assignment`
- Minimum viable exposures: dormant account (>90d no login), MFA gap on admin, privileged role sprawl (>5 admin users)
- Okta API: `/users`, `/groups`, `/apps`, `/logs/authentications` (requires `okta.users.read` + `okta.groups.read`)
- Secret stored via existing `credentials_encrypted` column

#### C2 — SaaS posture (choose one)

Recommendation: Google Workspace (simpler API, broader customer base for our pipeline).
- New asset type: `saas_tenant`
- Minimum viable exposures: domain-wide super-admin count >2, OAuth 3rd-party app with risky scopes, external file sharing without expiration, inactive but licensed accounts
- Workspace Admin SDK: `admin.users.list`, `admin.tokens.list`

#### C3 — CTEM exposure taxonomy

- `migrations/000171_ctem_exposure_taxonomy.up.sql`
- Convert `exposures.category` from free-text VARCHAR to ENUM with 29 CTEM-IDs (BND-001…EXP-004) per [ctem.org/docs/identifiers](https://ctem.org/docs/identifiers)
- Data migration: map current free-text to closest CTEM-ID or `EXP-999` (uncategorised); flag for manual review
- UI: replace category free-text with searchable dropdown

#### C4 — Attack-path solver

- Complete `internal/app/attack/path_solver.go`
- Algorithm: BFS from high-reachability asset → crown jewel, honouring `asset_relationships` edges
- Score path = Σ (node risk × edge exploitability)
- UI: `src/app/(dashboard)/validation/attack-paths/page.tsx` with graph visualisation (existing `react-flow` library)

#### C5 — Validation downgrade lifecycle

- Exposure status machine: `open → validated → (downgraded | confirmed)`
- When pentest result marks exposure as "could not exploit" → status `validated` with `validation_evidence_id`
- After 7-day review window → auto `downgraded` (lower priority class, keep evidence)
- Metric: framework's 25–40% downgrade target shown on Data Quality dashboard

---

## 4. Metrics — how we'll know the plan worked

Success criterion: **framework-alignment score goes from 16/25 to ≥22/25 within 90 days.**

| Metric | Baseline (2026-04-24) | Target (2026-07-24) |
|---|---|---|
| % in-scope assets with owner | unknown (not measured) | ≥95% |
| % exposures with evidence | unknown | ≥90% |
| Median external last-seen age | unknown | <48h |
| % P1 exposures remediated in 30 days | unknown | ≥90% |
| Median days discovery → P1 remediated | unknown | <14 |
| Exposures downgraded after validation | 0% (no lifecycle) | 25–40% |
| Remediation re-open rate | unknown | <20% |
| Tenants with active Scope Charter | 0 | 100% of active tenants |
| Tenants with at least one MITRE ATT&CK mapping on a finding | 0 | ≥50% |
| Over-engineering cuts shipped | 0 | 6 (module, LDAP stub, threat-actor matching stub, workflow builder hide, Telegram deprecate, compliance UI archive) |

---

## 5. Migration & rollout discipline

### Migration numbering (reserved)

| Number | Purpose |
|---|---|
| 000166 | Reachability first-class |
| 000167 | Scope charter + boundary statement |
| 000168 | MITRE ATT&CK tables |
| 000169 | Drop modules |
| 000170 | Cycle retro |
| 000171 | CTEM exposure taxonomy |

All migrations require `.down.sql` with tested rollback. Any `CREATE INDEX CONCURRENTLY` must sit outside its `BEGIN/COMMIT` block (see migration 000165 regression).

### Feature-flag rollout (tenant-level)

Each phase ships behind `tenant.settings.features.<name>`:
- `features.reachability_first_class` — default `true` on new tenants, opt-in on existing
- `features.scope_charter_required` — default `false`; flip per-tenant after migration
- `features.ticket_dod_template` — default `true` on new tenants
- `features.workflow_builder_beta` — default `false`
- `features.compliance_assessments_beta` — default `false`

### Deprecation

Anything cut must: (a) land a `log.Warn("deprecated: X")` before removal, (b) give one release cycle of warning, (c) remove in the next.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Existing tenants don't fill Scope Charter → scans break | Default `features.scope_charter_required = false` for existing tenants; enable per-tenant after support outreach |
| Data-quality KPIs embarrassing on our own dogfood DB | That's the point — the dashboard will drive the work |
| Workflow builder cut breaks tenants who already configured custom workflows | Keep engine + data; hide builder UI only; existing workflows keep running |
| Okta integration slips Phase C | Fall back to "Identity posture MVP via CSV import" so we still ship an identity artefact |
| MITRE seed ~4MB JSON bloats migration | Use a separate seed script run post-migration; not embedded in SQL |

---

## 7. Out of scope (explicit)

These are deferred until a customer contracts for them:

- BAS / Caldera integration
- Shadow-IT detection
- Mobile asset types
- Per-tenant KMS (see [`implementation-plans/363-per-tenant-kms.md`](./363-per-tenant-kms.md))
- HashiCorp Vault Transit
- Additional scanner adapters beyond the 5 core (move to community repo)
- GCP / Azure / Kubernetes connectors already scoped separately (see `339/340/349/350-*.md`)

---

## 8. Execution sequence — ready-to-pick task list

Use these as the initial TaskCreate entries once decisions land:

1. Kickoff meeting — secure answers to §2 decisions (1 meeting, under 1 hour)
2. Draft + sign off migration 000166 reachability (A1)
3. Draft + sign off migration 000167 scope charter (A2)
4. Ship reachability model end-to-end (A1)
5. Ship Scope Charter end-to-end with scan-route gate (A2)
6. Ship KEV override rule with audit + tests (A3)
7. Ship Data Quality dashboard (A4)
8. Seed ATT&CK + add mapping UI (A5)
9. Cut module system (A6)
10. Cut LDAP + threat-actor matching stubs (A7)
11. Phase-A retrospective — measure KPIs, decide Phase-B scope changes
12. Ship exception governance worker (B1)
13. Ship DoD ticket template (B2)
14. Ship re-validation hook (B3)
15. Ship executive digest (B4)
16. Ship cycle retro UI (B5)
17. Cut workflow builder + Telegram + compliance UI (B6/B7/B8)
18. Phase-B retrospective
19. Ship Okta integration MVP (C1)
20. Ship Workspace posture MVP (C2)
21. Ship CTEM taxonomy migration (C3)
22. Ship attack-path solver (C4)
23. Ship validation downgrade lifecycle (C5)
24. Close cycle, run retrospective against §4 targets, draft next cycle's Charter

Each item becomes a PR with the ID above (e.g., branch `feat/ctem-a1-reachability`). Each PR must cite its framework reference and show before/after metrics where measurable.
