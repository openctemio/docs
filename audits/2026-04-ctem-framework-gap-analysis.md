# OpenCTEM — CTEM Framework Gap Analysis

**Date:** 2026-04-24
**Scope:** Entire platform (api/, ui/, agent/, sdk-go/, ctis/) evaluated against the Gartner Continuous Threat Exposure Management framework as published at [ctem.org/docs](https://ctem.org/docs).
**Method:** Deep-fetch of 12 framework pages cross-referenced against full-repo capability map (paths, migrations, recent git history).
**Reviewer perspective:** Product strategy + framework compliance, not line-by-line code audit.

---

## Executive Summary

### The verdict in 30 seconds

| Axis | Status |
|---|---|
| Tooling breadth (Stages 2/3/4) | **Strong** — Discovery, Prioritization, Validation have solid primitives |
| Operating-model artifacts (Stages 1 and 5) | **Weak** — no Scope Charter, no Boundary Statement, no Definition-of-Done on tickets, no loop-closure retro |
| Platform foundation (multi-tenancy, RBAC, audit, encryption) | **Solid** — enterprise-grade |
| Framework KPI alignment | **Misaligned** — product tracks technical metrics (MTTR, scan count), framework demands *validated exposure reduction*, *re-open rate*, *% P1 remediated*, *owner coverage* |
| "CTEM theater" risk | **Present** — enough dashboards to look like CTEM, but missing the operating-model spine the framework explicitly requires |

### Core insight

> CTEM is an **operating model**, not a tool category. The framework's own comparison pages warn that the biggest failure mode is "more dashboards, same bottlenecks." OpenCTEM today ships the tooling half (discovery + prioritization + validation) extremely well, but is thin on the operating-model half (scoping artifacts, mobilization discipline, closed-loop cycles, framework-aligned KPIs).

### Top 5 critical gaps

| # | Gap | Stage | Framework citation |
|---|---|---|---|
| 1 | **Reachability / preconditions not first-class data** — product ingests CVSS + EPSS + KEV but not reachability; framework names reachability as a *first-class signal* equal to CVE severity | Prioritization | [stages/ctem-prioritization](https://ctem.org/docs/stages/ctem-prioritization) |
| 2 | **No Scope Charter / Boundary Statement entity** — product has scope_targets/exclusions (Stage 2 tooling) but lacks the one-page Charter + attacker-model statement framework requires as Stage 1 output | Scoping | [stages/ctem-scoping](https://ctem.org/docs/stages/ctem-scoping) |
| 3 | **No "KEV + reachable + crown-jewel = P0 override" rule** — framework names this an explicit override that trumps CVSS; product's scoring engine does not encode it | Prioritization | [stages/ctem-prioritization](https://ctem.org/docs/stages/ctem-prioritization) |
| 4 | **Identity / SaaS posture discovery = 0 coverage** — framework names IdP + SaaS as two of the three Gartner-recommended starting scopes for a CTEM program, alongside external attack surface | Discovery | [stages/ctem-discovery](https://ctem.org/docs/stages/ctem-discovery) |
| 5 | **Mobilization tickets lack Definition of Done + business narrative** — framework says "most programs fail at converting insight into sustained operational change" and requires DoD + sanitised evidence + verification plan on every ticket | Mobilization | [stages/ctem-mobilization](https://ctem.org/docs/stages/ctem-mobilization) |

---

## 1. The CTEM framework — authoritative summary

CTEM is Gartner's five-stage continuous cycle for reducing *real-world* exposure. Each stage's output is the next stage's input; Stage 5 feeds back to Stage 1.

| Stage | Purpose | Critical output |
|---|---|---|
| **1. Scoping** | Define *what* CTEM protects and *how* success is measured, in business terms | Scope Charter + Critical Asset Register + Boundary & Threat Assumption Statement + initial Success Metrics |
| **2. Discovery** | Continuous, high-fidelity visibility into in-scope assets + exposures *with evidence* | Exposure Register (required fields: Asset ID, Business service, Exposure type, Evidence, Reachability, Preconditions, Owner, first/last-seen) + Data Quality Scorecard |
| **3. Prioritization** | Turn discovery data into an ordered, *defensible* remediation plan blending business criticality + exploit likelihood + exposure conditions + validated controls | Prioritized backlog + SLA buckets + exception workflow + "why this is P0" rationale |
| **4. Validation** | Confirm how attacks would actually work in *your* environment — continuous, scoped, tied to prioritized exposures (not open-ended pentest) | Validation test-case records + downgraded exposures (framework target: 25–40% downgrade) + control-behaviour evidence |
| **5. Mobilization** | Convert validated exposures into executed remediation with measurable risk reduction | Remediation closed or time-bound exception; trend metrics; feedback to Stage 1 |

### Cross-cutting principles (framework-wide)

- **Exposure ≠ vulnerability** — exposure = weakness × reachability × exploitability × business impact (includes misconfigs, identity sprawl, SaaS drift, OAuth abuse, credential leaks)
- **Business-impact-first, not severity-first** — CVSS 9.8 on unreachable service < CVSS 6.5 on internet-facing identity service under active exploitation
- **Reachability + preconditions are first-class signals** — not optional enrichment
- **Evidence over assumption** — every exposure needs evidence + timestamp + data lineage
- **Ownership is required** — unowned exposure = exposure itself
- **Narrow scope beats broad coverage** — 15 validated remediations > 400-item backlog
- **Compensating controls only count if validated** — documented method + failure modes
- **Map to MITRE ATT&CK** for shared language across AppSec / IAM / Infra / SOC
- **Iteration cadence** — 90-day pilot → 60-day iterations → steady-state monthly scope reviews + continuous discovery + event-triggered validation

### Framework KPIs (the ones CTEM expects you to track)

| KPI | Target |
|---|---|
| % in-scope assets with assigned owner | ≥95% (framework: **100%** ideally) |
| % exposures with evidence | ≥90% |
| Median external "last-seen" age | <48h |
| % P1 exposures remediated in cycle | >90% |
| Median days discovery → P1 remediated | <14 days |
| Exposures downgraded after validation | 25–40% (healthy signal) |
| Remediation re-open rate | <20% |
| Time validation → ticket created | <5 business days |
| P1 discoveries in cycle N repeating cycle N-1 scope | 0 |

### SLA buckets (framework defaults)

- **P0** (KEV or validated path to crown jewel + reachable): **7–14 days**
- **P1** (high EPSS + reachable + high-impact + weak controls): **30 days**
- **P2** (medium, controls present): **60–90 days**
- **P3** (low or unreachable): opportunistic

### Metrics to explicitly **avoid**

- Total findings discovered (volume ≠ value)
- Scans completed (activity ≠ outcome)
- Tickets *created* (work generated ≠ work closed)
- Vulnerability count closed (vs. attack-path elimination)

---

## 2. Stage-by-stage gap analysis

Legend: ✅ solid · 🟡 partial · ⚪ skeleton · ❌ missing

### Stage 1 — Scoping

| Framework primitive | OpenCTEM today | Gap |
|---|---|---|
| **Scope Charter** (1-page business-impact artifact) | ❌ | No entity. Product starts at Discovery, skipping Scoping. |
| **Critical Asset Register** — required fields: business_service, data_classification, CIA impact, tech+business owner, environment, external_reachability, admin_exposure | 🟡 Fields exist but most are nullable; no constraint | No DB constraint forcing "critical asset must have owner + CIA" |
| **Boundary & Threat Assumption Statement** — attacker_model, approved_test_envs, stop_conditions | ❌ | No entity. `pentest_campaigns.rules_of_engagement` JSONB exists but is pentest-scoped, not cycle-scoped |
| Scope targets + exclusions (inclusion/exclusion patterns) | ✅ | Solid (`/api/v1/scope/*`) |
| Attacker profiles | 🟡 | Schema + UI exist, not fed into scoring formula |
| Crown jewels | 🟡 | `business_services.criticality` implies; no explicit `is_crown_jewel` flag |
| **Cycle timebox** (framework: 1 quarter for pilot) | ⚪ | `ctem_cycles` table exists but is a peripheral metric sink, not the app spine |

**Verdict:** Stage 1 is the product's **weakest surface vs. framework**. Most features currently placed under "Scoping" in the UI (scope rules, asset groups, attacker profiles) are actually Stage 2 tooling. The Charter/Boundary artefacts — which force business-owner alignment before any scanning starts — are absent.

### Stage 2 — Discovery

| Framework primitive | OpenCTEM today | Gap |
|---|---|---|
| **Exposure Register** with required: Asset ID, Business service, Exposure type, Evidence, Reachability, Preconditions, Owner, first/last-seen, Status | 🟡 | `exposures` table exists; `reachability` and `preconditions` columns missing; `owner` not required |
| **Data Quality Scorecard** (5 KPIs: % owner, % evidence, median last-seen, dedup rate, unknown-asset rate) | ❌ | No dashboard surfaces these. Product surfaces "total findings" (framework anti-pattern) |
| Ownership as **required** field | 🟡 | `asset_owners` table exists; no enforcement |
| Asset discovery: SCM, agents, ingest, SCA | ✅ | Solid — RFC-001 asset identity, ingest pipeline, platform agents v3.2 |
| **Identity / IdP discovery** (SSO users, privileged roles, MFA coverage, dormant accounts) | ❌ | **Zero coverage.** Framework highlights IdP as the #1 post-external discovery domain |
| **SaaS posture (SSPM)** — Workspace, M365, Slack config drift | ❌ | **Zero coverage.** Framework names SaaS posture as a Gartner-recommended starting scope |
| **Exposure taxonomy** — 29 CTEM-IDs across 8 categories (BND, CRD, FIN, INF, DOM, RAN, SRC, EXP) | ❌ | `exposures.category` is free-text. Framework publishes a canonical catalogue at [ctem.org/docs/identifiers](https://ctem.org/docs/identifiers) |
| Runtime telemetry + IOC matching | 🟡 | Ingest path wired; `threat_intel_refresher` worker exists but is never scheduled (dead code) |
| Finding dedup + asset identity | ✅ | Solid (RFC-001) |

### Stage 3 — Prioritization

| Framework primitive | OpenCTEM today | Gap |
|---|---|---|
| Blend 4 signals: **business criticality + exploit likelihood + exposure conditions + validated controls** | 🟡 | Product blends 3; **exposure conditions (reachability) entirely absent** |
| **"KEV + reachable + crown-jewel = P0" hard override** (regardless of CVSS) | ❌ | No such auto-rule. Customer must build manually |
| SLA buckets per framework defaults (7–14d / 30d / 60–90d / opportunistic) | 🟡 | SLA engine exists but ships empty; no "CTEM canonical" preset |
| EPSS + KEV enrichment | ✅ | Solid |
| AI triage | ✅ | Solid; prompt-injection + severity-escalation gates hardened |
| **Validated compensating controls** (framework: only count controls you can defend, with documented failure modes) | ⚪ | `compensating_controls` table exists; no `validated_at` / `validation_evidence_id` columns; scoring discount is ungated |
| Suppression rules engine | 🟡 | Entity exists; auto-rule evaluation not wired — bottleneck for operator workflow |
| **Priority rationale trail** ("why this is P0") | ⚪ | Scoring trace exists in logs, not surfaced in UI |

### Stage 4 — Validation

| Framework primitive | OpenCTEM today | Gap |
|---|---|---|
| Exploitability validation (controlled exploit in lab/staging) | ⚪ | Pentest module present; no adversary emulation |
| **Attack-path validation** (chain to high-value asset) | 🟡 | `attack_paths` + `attack_path_nodes` schemas exist; solver incomplete |
| Control validation (prevent / detect / respond) | ⚪ | `validation_modules` skeleton; playbook testing engine not implemented |
| **Remediation re-validation** (fix works + no regression) | ⚪ | `pentest_retests` exists but not automatically triggered when finding status flips to `resolved` |
| **MITRE ATT&CK mapping** on findings/pentest/exposures | ❌ | Framework requires this as shared language; product has none |
| **ROE enforcement** (agent refuses work outside approved scope) | ⚪ | ROE stored as JSONB in pentest_campaigns; not enforced by ingest/agent |
| BAS / adversary emulation | ❌ | No integration, no minimal ATT&CK replay |
| **Validation downgrade lifecycle** (framework target: 25–40% of exposures downgraded after validation) | ❌ | No `validated_downgraded` status; metric untracked |

### Stage 5 — Mobilization

| Framework primitive | OpenCTEM today | Gap |
|---|---|---|
| **Named accountable team** on every P0/P1 within hours of discovery | 🟡 | Assignment rules exist; no "unowned P0 = alert" constraint |
| **Definition of Done on every ticket** + sanitised evidence + preferred fix + alternatives + verification plan | ❌ | Jira export dumps description; no DoD template |
| **Exception / acceptance governance** — time-bound + approved + auto-re-validated | 🟡 | `suppressions.expires_at` exists; no auto-reopen worker |
| **Executive visibility narrative** ("what changed / what risk was removed") | ❌ | Current dashboards are technical; no business-language digest |
| Assignment engine | ✅ | Solid |
| Ticket integration (Jira) | ✅ | Solid |
| Notifications (Slack, Teams, Email, Webhook) | ✅ | Solid (Telegram channel possibly over-engineered) |
| **Loop closure** — retro per cycle feeds back into Stage 1 | ❌ | `ctem_cycles` closes silently; no retro UI, no framework-aligned retro questions |
| **KPI alignment** — % P1 remediated, discovery→remediated median, re-open rate, validated-downgrade % | 🟡 | Metrics dashboard tracks MTTR/MTTA/scan-count; not framework-aligned terminology |

---

## 3. Over-engineering — candidates to cut

| Feature | Location | Why it's over-engineered | Action |
|---|---|---|---|
| **Module system** | `internal/domain/module/`, 103 rows in `modules`, migrations 000080, 000089, 000117-118, 000161-162 | Table + API + 2 repos exist; ZERO route-level gating (api/CLAUDE.md confirms "Module entity exists as UI metadata only"). Framework has no concept of modules | **Remove entirely.** Use env vars or `tenant.settings` for feature flags. Saves 5 migrations + 2 repos. |
| **External Group Sync (LDAP/AD)** | `internal/domain/accesscontrol/group_sync.go` | Returns `ErrNotImplemented`. Dead interface | **Remove stub.** Re-implement only when a customer explicitly requests |
| **Threat Actor matching** | `threat_actor_repository.go` | CRUD exists; correlation logic missing; never wired | **Remove or complete.** Currently noise |
| **Workflow builder 8 triggers × 12 actions** | `internal/app/workflow/` (~3865 LOC) | Framework needs ~4 workflows (finding_created→triage, sla_breach→escalate, scan_completed→notify, finding_resolved→re-validate). Current breadth = hard to debug, hard to test | **Ship 4 built-in templates; disable custom builder** until 10+ customers request |
| **30+ scanner adapters** | `sdk-go/adapters/` | Framework: "coverage ≠ outcome". Customers use 3–5 scanners. Only 4/5 have tests | **Core SDK keeps 5** (Nuclei, Trivy, Semgrep, Gitleaks, SARIF); rest → community adapters repo |
| **5 notification channels** (Slack/Teams/Telegram/Email/Webhook) | `internal/infra/notification/` | Telegram = niche. Teams + Slack cover >90% of enterprise customers | **Deprecate Telegram** unless a customer explicitly needs it |
| **126-permission RBAC** | `internal/domain/permission/` | No framework requirement; hard for customers to reason about | **Audit** which permissions are ever checked differently from their parent. Likely cut to ~40 |
| **8 compliance frameworks** (seeded) | migrations 000083-085 | Schema exists; no assessment workflow UI; no control→finding mapping UI | **Either complete the assessment workflow or archive** — currently dead weight |

---

## 4. Gaps to fill — prioritised

### P0 — within 4 weeks (framework-alignment foundation)

1. **Reachability as first-class field** on asset + exposure. Migration: `assets.reachability ENUM('internet','vpn','internal','admin_only')`, `exposures.reachability ENUM`, `exposures.preconditions JSONB`. Scoring formula multiplies by reachability weight. UI filter.
2. **Scope Charter + Boundary Statement entities.** Two new entities, one UI form each. Block tenant from running scans until an active Charter exists.
3. **"KEV + reachable + crown-jewel = P0" auto-override rule.** Hardcoded in the ingest scoring worker. Emits audit event + notification on trigger.
4. **Data Quality Scorecard dashboard** surfacing the 5 framework KPIs.
5. **MITRE ATT&CK mapping** on findings / pentest findings. Migration `finding_attack_techniques (finding_id, technique_id, tactic_id)`. Seed taxonomy from [github.com/mitre/attack-stix-data](https://github.com/mitre/attack-stix-data).

### P1 — within 8 weeks (operating-model discipline)

6. **Exception governance worker** — expired suppression auto-reopens + notifies.
7. **Definition of Done template on ticket export** — 7-field body template (exposure_id, asset_id, evidence, preferred fix, alternatives, verification plan, definition of done).
8. **Remediation re-validation hook** — `finding.status → resolved` auto-enqueues a re-scan on the same asset + signature.
9. **Executive narrative weekly digest** — "This week: 4 P1 exposures removed on 2 crown jewels; MTTR down 30%."
10. **Cycle retro UI** — 5-question retro at end of every `ctem_cycles` (what discovered / what remediated / what stuck / what to change / owner).

### P2 — within 12 weeks (differentiators)

11. **Identity posture discovery** — Okta integration first. Surface: dormant accounts, MFA gaps, privileged role sprawl.
12. **SaaS posture (SSPM)** — minimum viable: Google Workspace OR Microsoft 365.
13. **CTEM exposure taxonomy adoption** — 29 CTEM-IDs as `exposures.category` enum.
14. **Attack-path solver completion** — graph-search engine + visualisation.
15. **Validation downgrade lifecycle** — status `validated_downgraded` + framework-aligned downgrade % metric.

### Deferred (customer-demand-driven)

- BAS / Caldera integration
- Shadow-IT detection
- Mobile asset types
- HashiCorp Vault Transit support

---

## 5. Cross-cutting concerns

| Concern | Assessment |
|---|---|
| **"CTEM theater" risk** | Present. Product has enough dashboards to *look* like CTEM, but is missing the Charter / Boundary / reachability / retro primitives the framework mandates. Customers will use it as a "vulnerability dashboard" without adopting the operating model |
| **Metrics alignment** | Misaligned. Product tracks technical metrics (MTTR, MTTA, scan count). Framework explicitly says do not count findings discovered. Rename dashboards to framework terminology (*validated exposure reduction*, *P1 remediation %*, *re-open rate*, *validated downgrade %*) |
| **Cycle-centric architecture** | `ctem_cycles` table exists but is peripheral. Framework treats the cycle as the spine. Recommend: every asset/finding/ticket MUST carry `cycle_id`; reports close when the cycle closes |
| **Compliance frameworks** | Eight frameworks seeded with zero assessment UI. Complete the workflow or archive the tables |
| **Test coverage** | 42% service coverage is thin for a security product. Target 70%+ before 1.0 |

---

## 6. Decisions needed before executing the plan

1. **Starting scope** for first production customer — external attack surface (framework's Gartner-recommended default) or internal infrastructure? Decision drives P2 order.
2. **Module system** — remove entirely, or keep as feature flags with actual route enforcement?
3. **Workflow builder** — simplify to 4 templates, or keep dual-mode?
4. **Compliance frameworks** — complete the assessment workflow or archive?
5. **First IdP integration** — Okta or Azure AD? (Okta has higher enterprise market share but AAD ships larger customers)

**Reviewer recommendation:** (1) external attack surface, (2) remove module system, (3) simplify to 4 templates, (4) archive compliance for now, (5) Okta.

---

## 7. Source URLs

Framework documents fetched and synthesised (2026-04-24):

1. https://ctem.org/docs/what-is-continuous-threat-exposure-management
2. https://ctem.org/docs/stages/
3. https://ctem.org/docs/getting-started
4. https://ctem.org/docs/comparisons/
5. https://ctem.org/docs/stages/ctem-scoping
6. https://ctem.org/docs/stages/ctem-discovery
7. https://ctem.org/docs/stages/ctem-prioritization
8. https://ctem.org/docs/stages/ctem-validation
9. https://ctem.org/docs/stages/ctem-mobilization
10. https://ctem.org/docs/comparisons/ctem-vs-vulnerability-management
11. https://ctem.org/docs/comparisons/ctem-vs-exposure-management
12. https://ctem.org/docs/comparisons/ctem-vs-easm-caasm
13. https://ctem.org/docs/comparisons/ctem-vs-bas
14. https://ctem.org/docs/comparisons/ctem-vs-pentesting
15. https://ctem.org/docs/identifiers

**Maturity scorecard vs. framework (reviewer opinion):**

| Stage | Score |
|---|---|
| Scoping | 2 / 5 |
| Discovery | 4 / 5 |
| Prioritization | 4 / 5 |
| Validation | 3 / 5 |
| Mobilization | 3 / 5 |
| **Overall framework-alignment** | **16 / 25 (64%)** |

The product is *better than most vuln-management tools* but is *not yet a CTEM product by framework standard*. The 90-day plan in [`implementation-plans/2026-Q2-ctem-framework-alignment.md`](../plans/2026-Q2-ctem-framework-alignment.md) lists the concrete steps to close the gap.
