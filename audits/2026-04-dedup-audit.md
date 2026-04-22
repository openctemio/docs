# Feature Duplication Audit — CTEM Workstreams

**Date:** 2026-04-19 (end of Q1/Q2/Q3/Q4 primitive build)
**Scope:** All new packages + files added in the Q1–Q4 CTEM implementation; cross-checked against existing code.
**Outcome:** **No duplicate features shipped. One docstring clarification applied. Ready for launch.**

---

## Audit matrix

| # | New component | Closest existing | Verdict |
|---|---|---|---|
| 1 | `internal/app/validation/` (TechniqueExecutor, Dispatcher, EvidenceStore) | `pkg/domain/simulation/` (Simulation, SimulationRun, ControlTest) | **Distinct.** BAS campaigns (user-initiated, scheduled, aggregated over runs) vs. single-shot proof-of-fix retest (system-initiated, one technique, one outcome). |
| 2 | `validation.ProofOfFixService` | `internal/app/simulation_service.go` | **Distinct.** Different lifecycle phases — proof-of-fix fires on `fix_applied` transition; simulation is a user-driven campaign. No shared logic. |
| 3 | `internal/app/runtime/` (Event, IngestService, Correlator, IOC) | `internal/app/ingest/` (CTIS / SARIF finding ingest) | **Distinct.** Runtime stream (process/syscall/net events, append-only) vs. batch scan-report ingest (findings, assets, components). Different schemas, different consumers. |
| 4 | `internal/app/connector/` (DiscoveryJob, Dispatcher) | `internal/infra/adapters/` (Trivy/Nuclei/SARIF/Semgrep/…) | **Distinct.** Cloud-asset enumeration job-dispatch vs. scanner-output format adapters. Different signals, different targets. |
| 5 | `app.P0FloodGuard`, `app.BulkGuard` | `internal/infra/http/middleware/ratelimit.go` | **Distinct.** Middleware rate limit is per-IP HTTP throttle. P0FloodGuard is per-tenant business-event budget. BulkGuard is per-tenant row-volume budget + per-request size ceiling. Three different aggregation keys, three different concerns. |
| 6 | `controller.PriorityReclassifyController` (queue consumer) | `controller.ThreatIntelRefreshController` (feed producer) | **Distinct — producer/consumer pair.** ThreatIntel fetches EPSS/KEV data + does a hot-path auto-escalate for KEV. Reclassify batches queued sweep requests. Intentional split. |
| 7 | `pkg/domain/ctemcycle/scope_delta.go` (ScopeChangeEvent, RollupChanges) | `controller.ScopeReconciliationController` (periodic safety-net) | **Distinct.** Reconciliation is a global K8s-style eventual-consistency sweep of asset-group membership. Cycle scope-delta is a cycle-scoped event for the CTEM review phase (B7 invariant). Complementary. |
| 8 | `controller.ControlChangePublisher`, `controller.SLABreachPublisher`, `app.PriorityChangePublisher` | `pkg/domain/outbox/` (notification outbox) | **Distinct.** Outbox delivers external notifications (Slack/Teams/webhook). Publishers here feed the internal reclassify queue + downstream audit. Different queues, different failure semantics (logged not rolled back). |
| 9 | `internal/infra/telemetry/ctem_metrics.go` | `internal/infra/http/middleware/metrics.go` | **Distinct.** Middleware metrics are HTTP-layer (request count/latency). CTEM metrics are stage-transition (findings in/out/latency per CTEM stage). Non-overlapping metric families. |
| 10 | `internal/infra/websocket/bridge.go` | (none) | **New feature.** No existing WS bridge. |
| 11 | `remediation.Campaign.TryAutoComplete` | existing Campaign lifecycle | **Extension.** New method on existing entity; not a new concept. |
| 12 | `controller.ControlTestCadenceController`, `controller.PriorityAuditRetentionController`, extended `SLAEscalationController` | existing controller set | **Distinct.** Three new domain-specific controllers; none overlap with existing 13 registered controllers. |
| 13 | `controller.OrderBatch` (priority-aware queue ordering) | (none) | **New utility.** No existing queue-ordering helper. |

---

## The earlier refactor prevented the only real duplication risk

An earlier build had placed in-process executors (`SafeCheckExecutor`, `AtomicRedTeamExecutor`, `NucleiExecutor`, `CalderaExecutor`) inside the API under `internal/app/validation/`. Those would have overlapped with the existing `pkg/domain/simulation/` BAS flow — both would have "run a technique against an asset".

The agent-orchestrator refactor (see `docs/architecture/agent-orchestrator-model.md`) deleted the in-process executors and reshaped `validation/` to be a **dispatch contract** consumed by the agent. The overlap with `simulation/` is now clean:

- `simulation/` — user-facing BAS: campaigns, schedules, multi-run aggregation.
- `validation/` — system-facing dispatch contract: single technique, single finding, single outcome.

Both call through the same agent fleet, but from different starting points. No duplicate code paths.

---

## One clarification applied

`internal/app/validation_coverage.go` package-doc expanded to explicitly contrast with `internal/app/validation/`:

- `validation/` — "EXECUTE this technique"
- `validation_coverage.go` — "OF THE FINDINGS WE ALREADY CLOSED, what percentage had evidence?"

Paired concepts; separate packages; the docstring now states the split.

---

## Deletions, merges, keeps

- **Deletions:** none.
- **Merges:** none.
- **Keeps:** all new components stay.

---

## Guardrails to prevent future duplication

1. **Architecture doc** (`docs/architecture/agent-orchestrator-model.md`) names what belongs in API vs agent. New engineers have a single page to reference before adding a package.
2. **Ctem-gates CI** runs `tools/lint/getbyid` + `tools/lint/routeperm` blocking. Add a third analyzer in a future task that flags duplicate package names (e.g. two packages both called `validation` or both called `connector`).
3. **PR template** should include a "closest existing feature" check — the author names the nearest existing surface and justifies why a new one is needed. This audit is the retroactive version of that.

---

## Conclusion

The Q1–Q4 build added **~30 new files** across 8 packages. After the agent-orchestrator refactor that deleted the in-process executors, **zero true duplicates remain**. Paired-but-distinct surfaces (validation orchestration vs validation coverage; reclassify producer vs reclassify consumer) are intentional and documented.

**Launch is safe from a duplication perspective.**
