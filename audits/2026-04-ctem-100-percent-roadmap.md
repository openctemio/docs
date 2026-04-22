# OpenCTEM — Roadmap to 100% CTEM Compliance

**Owner:** Engineering leadership
**Status:** Planning draft
**Source of truth for scope:** `docs/audits/2026-04-ctem-framework-compliance.md`
**Current baseline:** 66% implementation / 55% fidelity / 1-of-7 feedback edges closed
**Target:** 100% implementation / ≥95% fidelity / 7-of-7 feedback edges closed / Mature CTEM

---

## 1. Executive Summary

This document takes OpenCTEM from "strong VM + good prioritisation" to **Mature CTEM** as defined by the Gartner framework (closed-loop, continuous, validation-driven).

The work is organised as **four quarters** of parallel workstreams. Each quarter ends with a measurable CTEM-maturity gate that the team cannot pass by shipping features in isolation — the gate is the *closed-loop edge*, not the feature.

| Quarter | Headline goal | Target score |
|---|---|---|
| Q1 | Close the loop on the forward path | 75% / 70% fidelity |
| Q2 | Actually validate (real BAS + retest cadence) | 85% / 80% fidelity |
| Q3 | Continuous ingestion + cloud/runtime + RLS | 93% / 90% fidelity |
| Q4 | Polish, auto-remediation, defence-in-depth | 100% / ≥95% fidelity |

Every quarter's DoD is the *acceptance test(s)* listed per workstream — not a feature list. No feature ships without an integration test proving its CTEM edge.

---

## 2. Target-State Definition (what 100% looks like)

At 100% CTEM, the following invariants hold and are provable by integration tests:

### 2.1 Forward path invariants

| # | Invariant | How verified |
|---|---|---|
| F1 | Every asset type the product claims to discover can be ingested from at least one first-party source (agent, cloud API, recon scanner). | Integration test ingests one asset per type from production-like fixture. |
| F2 | Every finding from every supported source is enriched with EPSS + KEV + reachability + asset criticality within 5 minutes of ingest. | p95 enrichment-latency metric. |
| F3 | Priority class (P0..P3) is the sole driver of SLA deadline, assignment routing, queue priority, and dashboard sort order. | Unit + E2E tests. |
| F4 | Every high-severity / P0/P1 finding is accompanied by validation evidence (exploit confirmation or control-verification pass) before marking `resolved`. | State-machine guard + integration test. |

### 2.2 Feedback path invariants

| # | Invariant | How verified |
|---|---|---|
| B1 | New EPSS/KEV feed triggers a reclassification sweep for open findings within 30 min. | Timestamped feed flip → priority-change event emitted. |
| B2 | Activating / expiring a compensating control triggers reclassification for affected findings within 5 min. | Control change event → priority-change events. |
| B3 | Jira "Done" status → finding `fix_applied` → scheduled verification scan runs within 15 min → success transitions to `resolved`, failure reverts to `in_progress`. | End-to-end test. |
| B4 | SLA breach emits a Jira comment + escalation notification + pager event, deduplicated per breach. | Integration test with simulated clock. |
| B5 | CTEM cycle `review` phase produces a delta report (added/removed assets, P-class churn, MTTR) and optionally auto-spawns the next cycle's planning record. | Integration test. |
| B6 | Runtime telemetry that matches an existing vulnerability's IOC auto-re-opens the finding even if it was `resolved`. | Integration test against runtime event stream. |
| B7 | Scope change mid-cycle produces an incremental snapshot reconciliation, not a manual re-activation. | Integration test. |

### 2.3 Structural invariants

| # | Invariant | How verified |
|---|---|---|
| S1 | Every tenant-scoped Postgres table has a matching RLS policy referencing `app.current_tenant_id`. | `pg_policies` vs. migration audit. |
| S2 | The F-310 linter reports zero diagnostics across `internal/infra/postgres/*.go`. | CI blocking. |
| S3 | Every route in `internal/infra/http/routes/*.go` either has `middleware.Require*` or an explicit `// auth: public` sentinel. | CI linter. |
| S4 | Every "false CTEM signal" from the Phase-0 list is either wired or removed. | Schema audit. |
| S5 | `govulncheck` + `npm audit` + `trivy` all clean at HIGH/CRITICAL on `main`. | CI blocking. |

### 2.4 Observability invariants

| # | Invariant | How verified |
|---|---|---|
| O1 | Every CTEM stage emits at least one Prometheus metric per tenant (counter of findings entering/leaving the stage, histogram of stage latency). | Metric catalogue. |
| O2 | Every feedback edge has a SLO; breach of the SLO pages engineering. | Alerting rules in repo. |
| O3 | Per-tenant maturity dashboard exposes loop-closure rate, MTTR per severity/priority, re-open rate, validation-evidence coverage %. | UI route + snapshot test. |

---

## 3. Gap Analysis (delta from current state)

The scorecard below translates directly into workstreams in §4.

| Stage | Current | Target | Δ | Workstream |
|---|---|---|---|---|
| 1 Scoping | 85% | 100% | 15 | WS-A (Connectors) |
| 2 Discovery | 70% | 100% | 30 | WS-B (Continuous ingest) |
| 3 Prioritisation | 72% | 100% | 28 | WS-C (Closed-loop prioritisation) |
| 4 Validation | 30% | 100% | 70 | **WS-D (Real BAS) — largest gap** |
| 5 Mobilisation | 75% | 100% | 25 | WS-E (Closed-loop mobilisation) |
| Structural | — | 100% | — | WS-F (RLS, lint, CI gates) |
| Observability | ~40% | 100% | 60 | WS-G (Metrics + dashboards) |

Workstreams run in parallel where dependencies permit. Dependencies listed per workstream.

---

## 4. Workstreams

### WS-A — Asset discovery connectors (Stage 1 → 100%)

**Goal:** Every asset type OpenCTEM claims to support is ingestible from a first-party connector without manual CSV imports.

**Deliverables**
- AWS connector (EC2, RDS, S3, IAM, Lambda, ELB, EKS).
- GCP connector (Cloud Asset Inventory API).
- Azure connector (Resource Graph).
- Kubernetes in-cluster agent (pods, services, deployments, ingresses).
- Git-host connector (GitHub/GitLab/Bitbucket → repositories + branches + Dependabot alerts).
- "Asset identity resolution" already in place — connectors feed through the same dedup path.
- Scope-target filtering: a CTEM cycle can declare scope as "only assets tagged env=prod and criticality≥high", not "everything".

**Acceptance**
- Each connector has a make target `make connector-test-<name>` that hits a test-tenant sandbox.
- F1 invariant holds for all 6 connectors.
- `ctem_cycle_scope_snapshots.scope_target_id` is wired (no longer dead code).

**Effort:** 2 quarters elapsed; 2 engineers parallel per quarter.

**Dependencies:** none (ingest pipeline already exists).

---

### WS-B — Continuous discovery (Stage 2 → 100%)

**Goal:** Discovery becomes truly continuous, not scan-batch.

**Deliverables**
- **Runtime telemetry endpoint** `POST /api/v1/ingest/runtime` accepting schema:
  ```
  { tenant_id, host_id, ts, type: "process_start" | "syscall_anomaly" | "net_connect" | "file_exec",
    payload: { ... } }
  ```
  Back-pressure via per-tenant rate limit. IOC correlator matches events against open findings' attack indicators → can auto-re-open resolved findings (invariant B6).
- **Recon adapter** parser implementation (subdomains / port scan / TLS expiry). The schema path already exists; only the parser is missing.
- **Endpoint-as-asset** first-class support — new asset type `http_endpoint`, populated from (a) OpenAPI imports, (b) crawling, (c) runtime HTTP accept logs.
- **SARIF adapter wired** (P0-1 quick win).
- **Continuous SBOM refresh** — background job re-resolves transitive deps weekly; delta produces new findings when a transitive dep goes vulnerable.
- **Scan scheduler hardening** — per-asset cadence, not per-scan-profile; hot assets (crown jewel or recently changed) scanned more often.

**Acceptance**
- F1+F2 invariants.
- Runtime endpoint handles 1k events/sec per tenant with p99 <50ms.
- An open finding is auto-re-opened by a runtime event carrying a matching IOC.

**Effort:** 2 quarters.

**Dependencies:** agent protocol update (cross-team with agent/ repo).

---

### WS-C — Closed-loop prioritisation (Stage 3 → 100%)

**Goal:** Priority class is the authoritative driver of every downstream operational decision. No false signals remain.

**Deliverables**
- **Reclassification sweep controller** (invariant B1, B2). Triggered on:
  - New EPSS feed loaded.
  - New KEV catalogue loaded.
  - New / updated tenant override rule.
  - New / activated / expired compensating control.
  - Asset criticality or exposure changed.
  - Risk-scoring config changed.
  - Manual "recompute all" operator action.
- **`priority_class` wired into SLA deadline** — `p0_days..p3_days` becomes primary; severity is fallback for legacy rows (P0-2 quick win).
- **Priority-aware queue scheduler** — P0 findings jump to the front of any work queue (scan-retry, ingest backlog, notification fan-out).
- **Priority change events** — emit `finding.priority_changed { tenant_id, finding_id, from, to, reason }` to outbox for downstream consumption.
- **Reclassification dry-run UI** — tenant admin can preview what a rule/config change would do before flipping.
- **Batch-ingest P0 flood protection** — a single ingest cannot produce >N P0s per tenant without an operator approval flag (anti-flap).

**Acceptance**
- F3 invariant: assert in E2E that priority-class and severity diverge, and SLA/queue ordering follows priority.
- B1 + B2 invariants.
- Zero "false signal" entries from §2 related to prioritisation.

**Effort:** 1 quarter.

**Dependencies:** WS-F (outbox idempotency already landed); WS-E consumes priority.

---

### WS-D — Real validation (Stage 4 → 100%) — **largest workstream**

**Goal:** Replace mock simulations with actual exploit proof or control evidence. This is the stage that separates CTEM from VM.

**Deliverables**
- **Executor interface refactor.** `executeSimulationTechnique` becomes:
  ```go
  type TechniqueExecutor interface {
      Supports(techniqueID string, profile *AttackerProfile) bool
      Execute(ctx, techniqueID, target) (Evidence, error)
  }
  ```
- **Safe-check executor** — read-only probes (open-port confirm, TLS cert expiry, DNS record probe, public-endpoint reach).
- **Atomic Red Team executor** — invokes Atomic Red Team via out-of-process runner, captures stdout/exit/artifacts.
- **Caldera executor** — for tenants that have MITRE Caldera deployed, submit adversary-emulation plans.
- **Nuclei-template validator** — for web vulns, run the corresponding validation template with `-validate` mode.
- **Attacker profiles finally consumed** — every Execute call is gated by `profile.Capabilities` (so external-unauth profile can't pick "domain-joined" techniques).
- **Evidence artifact storage** — `simulation_evidence` table + attachment service storage of PoC output / screenshots.
- **Proof-of-fix retest flow** — when a finding is `fix_applied`, the same executor that validated it originally runs again; success → `resolved`, failure → auto-revert to `in_progress` + escalation.
- **Control test cadence + expiry controller** (already in the P2 plan from the earlier doc).
- **Verification checklist gates state transitions** — `TransitionStatus(verified)` returns error if checklist incomplete.
- **Validation coverage KPI** — % of closed findings that had at least one successful validation run. Target: 100% for P0/P1, ≥80% for P2, optional for P3.

**Acceptance**
- F4 invariant.
- Sandbox integration test: Atomic Red Team T1078 runs, evidence stored, artifact viewable in UI.
- Resolved finding's IOC surfaced in runtime stream auto-re-opens the finding (crossover with WS-B).
- Zero false signals from §2 related to validation.

**Effort:** 2 quarters + dedicated security-research engineer.

**Dependencies:** WS-B runtime ingestion (for re-open); WS-A connectors (for target discovery); new external tool: Atomic Red Team (OSS) + optionally Caldera.

---

### WS-E — Closed-loop mobilisation (Stage 5 → 100%)

**Goal:** Every feedback edge from §2.2 is closed in the mobilisation layer.

**Deliverables**
- **Jira "Done" webhook → auto verification scan** (invariant B3). Rate-limited per finding, 24h cooldown, scan results auto-transition status.
- **SLA breach escalation wiring** (invariant B4). Escalation matrix per tenant; Jira comment + outbox notification + optional PagerDuty/Opsgenie.
- **CTEM cycle review phase does work** (invariant B5):
  - Computes scope delta vs. snapshot.
  - Triggers verification scans for in-progress/fix-applied findings.
  - Finalises metrics row.
  - Optionally auto-spawns next cycle planning record with prior scope + open findings as template.
- **Scope delta mid-cycle** (invariant B7) — asset added/removed during an active cycle is recorded as a `cycle_scope_change` event; handler recomputes risk snapshot.
- **Assignment-rule feedback** — when a rule fires, record the match reason on the finding so reviewers can see *why* it routed there.
- **Bulk-action safety rails** — UI confirmation + server-side throttle; no bulk op touches >500 rows without operator confirmation.
- **Remediation campaign automation** — campaign state transitions driven by aggregate finding state (auto-complete when all campaign findings reach `resolved` or `accepted`).

**Acceptance**
- B3, B4, B5, B7 invariants.
- Every "false signal" related to mobilisation is retired.

**Effort:** 1 quarter.

**Dependencies:** WS-C priority events; WS-D auto-revert; SLA policy migration from WS-C.

---

### WS-F — Structural guarantees (baseline hardening)

**Goal:** Defence in depth so future work doesn't regress CTEM posture.

**Deliverables**
- **RLS policies on every tenant-scoped table** (S1). Migration `000154_rls_enable.up.sql` enabling RLS on ~82 tables; middleware mounted globally; repositories switched to use the RLS transaction.
- **Linter CI gates** (S2, S3):
  - Flip `tools/lint/getbyid` to blocking once all current diagnostics are triaged (per `docs/audits/2026-04-unscoped-getbyid-audit.md`).
  - Add second analyzer: "write route missing `middleware.Require*`".
- **Dep scan gates** (S5): govulncheck + npm audit + trivy blocking at HIGH/CRITICAL on `main`.
- **SBOM publishing** on every release artifact.
- **Integration test harness** with ephemeral Postgres + Redis + optional mock Jira/Slack; every workstream's acceptance test runs here.
- **Data-residency opt-in** — per-tenant encryption with tenant-supplied KMS key; ingest storage honours region constraint.
- **Audit log immutability** — append-only via Postgres trigger + periodic hash-chain checkpoint to an external WORM store.

**Acceptance**
- S1–S5 invariants.
- One CI pipeline named `ctem-gates` that a PR cannot merge without passing.

**Effort:** 1 quarter (distributed, partially background work).

**Dependencies:** RLS migration coordinates with all repositories; blocker for claiming 100%.

---

### WS-G — Observability + maturity reporting

**Goal:** The team and customers can see CTEM maturity in real time.

**Deliverables**
- **Prometheus metrics per CTEM stage.** For each stage:
  - `ctem_stage_findings_in_total{stage, tenant, priority}`
  - `ctem_stage_findings_out_total{stage, tenant, outcome}`
  - `ctem_stage_latency_seconds{stage, tenant}` (histogram)
- **Loop-closure metric.** Per edge (B1..B7): `ctem_loop_edge_ok_total` vs `ctem_loop_edge_broken_total`. SLOs and alerts.
- **Per-tenant maturity dashboard.** Endpoint + UI page showing:
  - Current CTEM implementation score (real-time).
  - MTTR by severity + priority.
  - Validation-evidence coverage %.
  - Re-open rate.
  - Cycle KPIs.
- **Executive export.** Quarterly PDF report generated from the dashboard data.
- **"Why is my score X?"** — drill-down link from the dashboard to the specific invariants that are green/red for the tenant.

**Acceptance**
- O1, O2, O3 invariants.
- Internal Grafana board + customer-facing dashboard.

**Effort:** 1 quarter.

**Dependencies:** every other workstream emits the required metrics.

---

## 5. Quarter-by-Quarter Roadmap

Workstreams run in parallel where dependencies allow.

### Q1 — "Close the loop"

| WS | Items delivered this quarter |
|---|---|
| WS-C | Reclassification sweep controller; priority→SLA; priority events |
| WS-E | Jira auto-rescan; SLA escalation; cycle review phase works |
| WS-F | F-310 linter made blocking (after the unsafe-baseline is cleaned); `ctem-gates` pipeline |
| WS-G | Basic stage metrics |
| WS-A | AWS connector (first iteration) |

**Quarter gate:** Invariants F3, B1, B3, B4, B5 all pass integration tests. Target score: **75% / 70% fidelity**. "Functional CTEM" confirmed.

### Q2 — "Validate for real"

| WS | Items delivered this quarter |
|---|---|
| WS-D | Executor interface refactor; safe-check + Atomic Red Team executors; attacker-profile gating; evidence storage; proof-of-fix retest |
| WS-E | Verification checklist gates transitions; bulk-action safety rails |
| WS-C | Reclassification on control change (B2); priority-aware queue |
| WS-A | GCP + Azure connectors |
| WS-F | RLS policies drafted on top tenant-scoped tables |

**Quarter gate:** Invariants F4, B2. Validation-evidence coverage ≥80% for P0/P1 findings in the flagship tenant. Target score: **85% / 80% fidelity**. "Mature CTEM" within reach.

### Q3 — "Continuous"

| WS | Items delivered this quarter |
|---|---|
| WS-B | Runtime telemetry endpoint + IOC correlator (B6); Recon adapter; endpoint-as-asset |
| WS-D | Nuclei validator; Caldera executor (opt-in) |
| WS-A | Kubernetes + Git connectors |
| WS-F | RLS policies everywhere; linter #2 (unguarded write routes) |
| WS-G | Maturity dashboard; executive export |

**Quarter gate:** Invariants B6, F1, F2. Continuous runtime ingest proven. Target score: **93% / 90% fidelity**.

### Q4 — "Polish + defence-in-depth"

| WS | Items delivered this quarter |
|---|---|
| WS-C | Dry-run UI; P0 flood protection |
| WS-D | Validation-coverage SLO enforced; control test cadence + expiry |
| WS-E | Scope delta mid-cycle (B7); remediation campaign automation |
| WS-F | Audit log immutability; data-residency opt-in; SBOM publishing |
| WS-G | Loop-closure SLOs; alerting rules |
| All | Remove every remaining false signal |

**Quarter gate:** Every invariant in §2 passes. Target score: **100% / ≥95% fidelity**. "Mature CTEM" certified.

---

## 6. Team Structure & Resourcing

**Minimum viable team** to hit this roadmap in 4 quarters:

| Role | FTE | Primary workstream |
|---|---|---|
| Back-end engineer (Go) | 3 | WS-A, WS-C, WS-E |
| Platform engineer (infra/DB) | 1 | WS-F, Kubernetes connector |
| Security research engineer | 1 | WS-D (executors, attacker profiles) |
| Front-end engineer (Next.js) | 1 | WS-E UI + WS-G dashboard |
| SRE / observability engineer | 0.5 | WS-G metrics, SLO alerting |
| Tech writer (part-time) | 0.3 | Customer-facing docs per-quarter |
| Security PM / CTEM product lead | 1 | Owns the quarterly gate, runs the acceptance review |

**Total: ~7.8 FTE for 4 quarters.**

Cross-team dependency: agent/ repo work for WS-B. Negotiate with agent team now.

---

## 7. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| WS-D (real BAS) slips | HIGH | HIGH | Ship safe-check executor first (smaller blast radius); Atomic Red Team sandbox lets us validate without production tenant risk. |
| RLS migration breaks existing repositories | MEDIUM | HIGH | Roll out in read-only shadow mode first: enable RLS but run repositories outside the RLS transaction, log policy hits vs. app-layer filter divergence for a month, then switch. |
| Runtime ingest rate swamps DB | MEDIUM | MEDIUM | Ingest into a partitioned append-only table; IOC correlator reads from a streaming view. |
| Jira auto-rescan triggers scanner thrash | MEDIUM | LOW | Per-finding cooldown; global scanner budget per tenant. |
| Customer confusion at "95% → 100%" branding | LOW | LOW | Publish the maturity dashboard with drill-downs *before* making public claims. |
| Attack-simulation legal risk | MEDIUM | HIGH | Simulations default to safe-check executor; Atomic Red Team + Caldera require explicit tenant opt-in and a signed waiver per target asset. |
| Validation evidence storage grows unbounded | MEDIUM | MEDIUM | Retention policy at 90d (mirrors audit retention); compress artifacts; optional cold-storage tier. |

---

## 8. Non-Goals (explicit)

Keep the scope honest. The following are **out of scope** for "100% CTEM":

- SOAR replacement. OpenCTEM integrates with existing SOAR, not replaces it.
- Vendor-specific EDR logic (CrowdStrike, SentinelOne, Defender). Ingest via standard schemas only.
- Kubernetes admission controllers / policy-as-code enforcement (OPA, Kyverno).
- Automated patching / auto-remediation actions that modify customer infrastructure.
- Threat-intel feed production (we are a consumer, not a producer).
- Compliance evidence collection beyond what CTEM needs (SOC2/ISO audit exports are a separate module).

---

## 9. Definition of Done for "100% CTEM"

A PR titled **"Achieve 100% CTEM maturity"** can only merge when every one of the following is true. This is the final gate.

- [ ] Every invariant in §2 has a green integration test in `tests/integration/ctem/`.
- [ ] Every "false CTEM signal" from `docs/audits/2026-04-ctem-framework-compliance.md` §6 is either wired or removed.
- [ ] `tools/lint/getbyid` reports zero diagnostics across the whole repo (with opt-out directives allowed only on documented exceptions).
- [ ] RLS policies exist for every table with a `tenant_id` column; `pg_policies` count matches the migration audit.
- [ ] Validation-evidence coverage ≥100% for P0/P1, ≥80% for P2 in the flagship tenant for a rolling 30-day window.
- [ ] All 7 feedback edges have a green metric in Grafana for ≥30 days.
- [ ] The maturity dashboard reports a live score ≥95% for the flagship tenant.
- [ ] Internal pentest confirms the attacker-path described in the compliance audit's §7 ("patch the CVE, keep the foothold") no longer works: validation auto-re-opens the finding.
- [ ] Customer-facing documentation updated; changelog entry published; "Mature CTEM" claim reviewed by legal.

---

## 10. Tracking

- **Milestones:** `CTEM-Q1`, `CTEM-Q2`, `CTEM-Q3`, `CTEM-Q4` in the repo's issue tracker.
- **Weekly standup:** owned by the CTEM product lead; status is per-workstream, not per-task.
- **Monthly steering review:** the lead presents the maturity dashboard delta; misses trigger scope trades (no scope creep without dropping something else).
- **Quarterly gate review:** all-hands; the quarter's acceptance tests are demonstrated live; unpass → replan, not slip.

This plan is intentionally dense; treat it as the full specification, not the roadmap slide. Slides can be derived from §5. The actual engineering contract lives in §2 (invariants) and §9 (DoD).
