# OpenCTEM — CTEM Framework Compliance Audit & Implementation Plan

**Date:** 2026-04-19
**Scope:** End-to-end CTEM framework fidelity audit across API (Go) and UI (Next.js)
**Methodology:** Evidence-based capability mapping against the 5 canonical CTEM stages, loop-closure verification, adversarial bypass analysis.

---

## TL;DR

| Metric | Value |
|---|---|
| **CTEM Implementation Score** | **66%** |
| **CTEM Fidelity Score** | **55%** |
| **Classification** | **Fragmented-to-Functional CTEM** |
| **Closed-loop edges implemented** | **1 of 7** |

**Headline finding.** OpenCTEM is a strong vulnerability-management + prioritisation platform with excellent Stage 1–3 plumbing, but **Stage 4 (Validation) is cosmetic** and **the feedback loop that defines CTEM is not closed**. An attacker who patches a surface CVE while keeping a foothold will walk past the current control layer.

---

## Stage-by-Stage Score Card

| Stage | Score | Status |
|---|---|---|
| 1. Scoping | **85%** | Near-mature; add cloud connectors + scope filtering |
| 2. Discovery | **70%** | No runtime telemetry; SARIF adapter unregistered |
| 3. Prioritisation | **72%** | Excellent logic, decorative output — priority does not drive SLA/queue |
| 4. Validation | **30%** | Simulations are mocks; no real exploit proof |
| 5. Mobilisation | **75%** | Features OK, feedback loop missing |
| **Mean** | **66%** | |

---

## Loop-Closure Scoreboard

| Feedback edge | State | Expected behaviour |
|---|---|---|
| Fix-applied → auto re-scan | **MANUAL** | Jira "Done" webhook should enqueue a verification scan |
| Re-scan result → re-prioritise open findings | **PARTIAL** | Only new rows get enriched; existing findings untouched |
| Compensating-control activation → finding priority recompute | **NO** | Activating a control should reclassify its affected findings |
| SLA breach → escalation | **NO** | Breach should open a Jira sub-ticket + page via outbox |
| Cycle "review" phase → re-scope + re-scan | **NO** | Currently a status-only transition |
| EPSS/KEV refresh → reclassify open findings | **NO** | Feed refresh is load-only, not act-on |
| Scope change mid-cycle → snapshot delta | **NO** | One-shot at `Activate()` |

**Score: 1 / 7 edges closed.** This is the single biggest blocker to calling the system a CTEM product.

---

## False CTEM Signals (Tech-Debt Triage)

Things in the code that **look** CTEM-compliant but do not run:

1. **`p0_days..p3_days`** columns on `sla_policies` — present, read by no service.
2. **Attack simulations** — call `executeSimulationTechnique()` which returns hardcoded results.
3. **Attacker profiles** — 4 personas seeded, never consumed by simulation logic.
4. **`ctem_cycle_scope_snapshots.scope_target_id`** — NULL-able column, no consumer.
5. **`last_exposure_level` / `exposure_changed_at`** on assets — written, never read.
6. **SARIF adapter** (661 LoC built) — omitted from `internal/infra/adapters/core/registry.go`.
7. **`discovery_source='agent'`** — schema value with no ingest path.
8. **Compensating-control tests** — pass/fail captured, no retest cadence/expiry automation.
9. **Verification checklist** — UI-only, does not gate state transitions.
10. **CTEM cycle "review" phase** — no business effect.
11. **Risk-snapshot P0..P3 counts** — computed every 6 h, acted on nowhere.
12. **"Continuous" in product name** — only the scan scheduler is continuous; re-classification is batch-on-ingest.

---

## Attacker Perspective

**Easiest stage to bypass: Stage 4 (Validation).**

Scenario: attacker has planted persistence via a vulnerable component.

```
Stage 1  Asset inventoried, possibly marked crown jewel         ← defender OK
Stage 2  Scanner finds the CVE                                  ← defender OK
Stage 3  Classified P0 (KEV + reachable + crown jewel)          ← defender OK
         Ticket opened, notifications fired
Stage 4  Ops deploys patch for the surface CVE
         RequestVerificationScan re-runs the scanner            ← scanner sees
         scanner says CVE gone                                  ← no CVE, green tick
         NO actual exploitability proof                         ← ATTACK SURVIVES
Stage 5  Finding marked resolved → verified
         Dashboard: P0 cleared
```

**Second-easiest bypass: reclassification laziness.** A CVE stamped P3 today stays P3 even after it appears in CISA KEV tomorrow, because there is no sweep. Silent-P0-reads-as-P3 is the defender's worst case.

---

# Implementation Plan

## Phase 0 — Quick wins (days, not weeks)

These are the low-effort, high-impact items that stop the bleeding on false signals.

| # | Task | Files | Effort |
|---|---|---|---|
| P0-1 | Wire SARIF adapter into the registry | `internal/infra/adapters/core/registry.go:32-36` | 1 h |
| P0-2 | Use `p0_days..p3_days` in SLA deadline calc | `internal/app/sla_service.go:CalculateDeadline()` + `sla/entity.go` | 1 d |
| P0-3 | Drop unused snapshot column OR wire scope-target filtering | migration + `ctem_cycle_handler.go:234-263` | 0.5 d |
| P0-4 | Fail startup loudly when `JIRA_WEBHOOK_SECRET` empty and Jira integration exists (today fails closed silently) | `cmd/server/services.go` | 1 h |
| P0-5 | Surface the "reclassify-on-ingest-only" caveat in the product docs | `docs/` | 0.5 d |

## Phase 1 — Close the loop (2–3 sprints)

The sprint-scale items that turn a forward pipeline into a closed CTEM loop. Prioritised by attacker-path severity.

### 1.1 Automatic reclassification sweep — **CRITICAL**

**Why:** closes the "P3-silently-stayed-P3" bypass.

**Design:**
- Add `PriorityReclassificationController` in `internal/infra/controller/`.
- Interval: 30 min.
- Trigger scope on any of:
  - New EPSS/KEV feed refresh (flag set by `threat_intel_refresh`).
  - New/updated tenant override rule.
  - New/activated compensating control.
  - Asset criticality change or exposure-level change.
  - Risk-scoring config change.
- Per tenant, iterate open findings in bounded batches (1k) and invoke `PriorityClassificationService.EnrichAndClassifyBatch`.
- Emit a `finding_priority_changed` outbox event when class changes so downstream (SLA, notifications, assignment) reacts.

**Acceptance:**
- Integration test: seed a P3 finding, flip KEV status to true, run reconciler, assert class → P0.
- Integration test: activate a compensating control on a finding's asset, assert class drops.
- Outbox event verified on class change.

**Estimate:** 5–7 days.

### 1.2 Priority-class → SLA deadline — **HIGH**

**Why:** closes fake signal #1 and aligns operational urgency with CTEM output.

**Design:**
- `sla.Policy.CalculateDeadline(f *Finding)` switches on `PriorityClass()` first, fallback to severity only when class is nil.
- Migration: backfill `p0_days=2, p1_days=5, p2_days=15, p3_days=30` for any tenant whose policy is null.
- Handler PATCH `/sla-policies/{id}` accepts the new fields; UI form adds inputs.

**Acceptance:**
- Unit test: finding with `PriorityClass=P0` under a policy with `p0_days=2` → deadline = now + 48h.
- Regression: finding with nil PriorityClass still computed from severity.
- UI test: SLA settings page saves p0..p3 days.

**Estimate:** 3 days.

### 1.3 SLA breach → automatic escalation — **HIGH**

**Why:** closes loop edge #4.

**Design:**
- Extend `sla_escalation` controller to, on status transition `→ overdue`:
  - Insert notification outbox entry with `event_type=sla_breach`.
  - If a Jira ticket is linked: post a comment with the breach and the overdue duration; optionally bump Jira priority.
  - Optional per-tenant escalation matrix (owner → manager → on-call).
- Never modify the ticket from multiple places — dedup via `outbox_id` idempotency key (F-6 already landed).

**Acceptance:**
- Integration test: seed a finding 1 day past deadline, run controller, assert outbox row exists.
- Integration test: seed a finding with linked Jira, assert a Jira comment is created.
- No duplicate notification on repeated controller runs (idempotency).

**Estimate:** 3–4 days.

### 1.4 Jira "Done" → auto verification scan — **MEDIUM**

**Why:** closes loop edge #1.

**Design:**
- `jira_sync_service.HandleJiraWebhook` already transitions status to `fix_applied`.
- After transition, if a verification scan trigger is configured for the tenant, call `FindingActionsService.RequestVerificationScan` with the finding ID.
- Rate-limit: at most one verification scan per finding per 24 h (to avoid scanner thrash on chatty Jira hooks).

**Acceptance:**
- Integration test: simulate Jira "Done" webhook → assert `RequestVerificationScan` called.
- Rate-limit test: two webhooks within 1 h → only one scan triggered.

**Estimate:** 2 days.

### 1.5 CTEM cycle "review" phase actually does work — **MEDIUM**

**Why:** closes loop edge #5.

**Design:**
- On `StartReview()`:
  1. Recompute in-scope asset list vs. frozen snapshot → produce `scope_delta` record (added/removed assets).
  2. Trigger verification scans for all findings tied to snapshot assets that are still in `in_progress`/`fix_applied`.
  3. Recompute cycle metrics: MTTR, findings opened/closed, P-class churn.
- On `Close()`:
  - Finalise metrics row; persist `review_notes`.
  - Optionally enqueue next cycle's planning phase with prior scope as template.

**Acceptance:**
- Integration test: cycle with 10 findings in `in_progress` → `StartReview()` triggers 10 re-scans.
- Metrics row written on `Close()`.

**Estimate:** 4–5 days.

## Phase 2 — Actually validate (quarter-scale)

**This is the work that would move Stage 4 from 30% to 70%+.** It is the single biggest uplift in CTEM maturity, and is a quarter of focused work by a small team.

### 2.1 Replace mock simulations with real BAS

**Design:**
- Move the `executeSimulationTechnique` body from hardcoded switch to an executor interface.
- Implementations:
  - `SafeCheckExecutor` — runs read-only probes (DNS, TLS expiry, open-port confirmation).
  - `CalderaExecutor` — invokes MITRE Caldera (adversary emulation) when the tenant has it configured.
  - `AtomicRedTeamExecutor` — invokes Atomic Red Team tests.
- Every execution captures an `evidence` JSONB artifact (timestamps, request/response snippet, exit codes) into a new `simulation_evidence` table.
- Attacker profiles are finally honoured: `AttackerProfile.Capabilities` gates which techniques are selectable.

**Acceptance:**
- Seed-env integration test runs Atomic Red Team T1078 against a controlled target, captures evidence, stores artifact, asserts not-mocked.
- Unit test: attacker profile with `capabilities=[]` refuses all techniques.

**Estimate:** 3–4 weeks.

### 2.2 Verification checklist gates state transitions

**Design:**
- `Finding.TransitionStatus(to=verified)` checks `verification_checklist.IsComplete()` for the finding; returns `shared.ErrValidation` if incomplete.
- UI: the Verify button disables until all required items are ticked.

**Estimate:** 3 days.

### 2.3 Compensating-control test cadence + expiry

**Design:**
- Add `next_test_due_at` to `compensating_controls` and a `control_test_due` background controller that:
  - Marks tests `overdue` past their cadence.
  - Invalidates the control (sets `status=expired`) after grace period → triggers reclassification (see 1.1).
- Surface overdue controls on the Controls dashboard.

**Estimate:** 1 week.

### 2.4 Proof-of-exploit artifact storage

**Design:**
- Reuse the attachment service (already tenant-scoped) for `simulation_evidence` files.
- Redact obvious secrets before storage.
- UI: display artifact thumbnails on the finding detail page.

**Estimate:** 1 week.

## Phase 3 — Continuous (roadmap)

Items that move OpenCTEM from "scan-report platform" to "continuous" in the CTEM sense.

### 3.1 Runtime telemetry ingestion

**Design:**
- New `/api/v1/ingest/runtime` endpoint accepting an agent-streamed event schema (process start, syscall anomalies, network connect).
- Backpressure-aware: per-tenant rate limit, drop-oldest on saturation.
- Correlate with asset inventory on `hostname`/`k8s_pod` dimensions.

**Estimate:** 4–6 weeks including agent-side changes.

### 3.2 Cloud-account connectors

**Design:**
- AWS: enumerate EC2, RDS, S3, IAM via tenant-provided role ARN.
- GCP: Asset Inventory API.
- Azure: Resource Graph.
- Feed into asset inventory with `discovery_source='cloud'`.

**Estimate:** 6–8 weeks for all three.

### 3.3 API endpoint discovery as first-class assets

**Design:**
- New asset type `http_endpoint`.
- Populated from:
  - OpenAPI imports.
  - Nuclei + custom wildcard probes.
  - Runtime HTTP accept-log (see 3.1).
- Findings can attach to endpoints (e.g. missing auth on `/admin/users`).

**Estimate:** 3–4 weeks.

### 3.4 RLS policies across all tenant-scoped tables

**Already flagged** in `docs/audits/2026-04-rls-policy-audit.md` as F-312. This is defence-in-depth; the app-layer guard is currently the only line. ~2 weeks.

---

## Tracking this plan

Create GitHub milestones in this order:

1. **CTEM-P0 — Quick wins** (target: next sprint)
2. **CTEM-P1 — Close the loop** (target: 2 sprints)
3. **CTEM-P2 — Real validation** (target: next quarter)
4. **CTEM-P3 — Continuous** (target: H2)

For each milestone the "Definition of Done" is the acceptance test(s) listed in this document — no task moves to Done without an integration test proving the closed-loop edge.

## Parked / explicit non-goals

- **Kubernetes admission controllers.** Interesting but out of CTEM scope.
- **Commercial EDR integrations beyond ingest schema.** Vendor-specific; defer.
- **SOAR replacement.** OpenCTEM's workflow engine should integrate with existing SOAR, not replace it.

---

## Appendix A — Evidence index

The detailed per-capability evidence is in the companion audits:

- `docs/audits/2026-04-full-scope-audit.md` — security posture
- `docs/audits/2026-04-unscoped-getbyid-audit.md` — repo-layer IDOR
- `docs/audits/2026-04-route-permission-audit.md` — route coverage
- `docs/audits/2026-04-rls-policy-audit.md` — DB-level tenant isolation

The CTEM audit here was built by five parallel explorers mapping each stage to code with `file:line` citations; the synthesis deliberately under-scores per the "prefer under-scoring" rule. Any reviewer who wants to raise a stage score must produce new evidence of a *loop closure*, not new evidence of a feature existing in isolation.

---

*This document is the input to the implementation planning session. Treat the Phase-1 items as non-negotiable for the "Functional CTEM" label; treat Phase-2 as non-negotiable for the "Mature CTEM" label.*
