# RFC-008: Per-tenant LLM token budget

- **Status**: Draft (ready for review)
- **Created**: 2026-04-22
- **Priority**: High (cost + DoS exposure; the AI-triage surface is the newest and least fenced)
- **Owners**: AI-triage team + Platform
- **Depends on**: existing `internal/app/aitriage/service.go`, `internal/infra/http/middleware/ai_triage_ratelimit.go`
- **Related audit finding**: P6-4 (LLM token budget uncapped per tenant)

---

## 1. Problem

AI triage is the platform's newest and least-hardened surface. Every triage call hits Claude / OpenAI / Gemini with a prompt derived from a finding. Input is attacker-influenced (finding title / description / scanner output) and output costs real money per token. Today:

- `AITriageRateLimiter` caps requests per-tenant at 10/min — good for burst DoS, but a patient attacker gets 14,400 triage calls per day without tripping it.
- There is **no monthly token ceiling**. A tenant with 10,000 large findings can burn $1,000+ in LLM spend in an afternoon. If the upstream provider suspends the API key, the whole platform loses triage for every tenant.
- There is no visibility to operators: no dashboard tile "tenant X consumed 4.2M tokens this month". Cost drift is invisible until the provider invoice lands.
- There is no per-tenant cost accounting. Multi-tenant SaaS without per-tenant cost attribution is a dead-end billing model the moment a paying customer asks "what am I actually spending on AI?".

The audit flagged this as P6-4 and recommended an RFC. This is it.

---

## 2. Goals & non-goals

### Goals

1. **Hard ceiling per tenant per month.** Block triage calls once the ceiling is reached. No silent degradation.
2. **Per-tenant usage visibility** — real-time counter exposed via API and a simple dashboard tile. Operators can see "tenant X has used 87% of their June budget".
3. **Alerting before exhaustion.** Fire a warning at 80%, another at 95%, so a tenant-admin can increase the budget without waking on-call.
4. **Defence against prompt-injection bulk-attack.** Even with prompt-sanitiser in place, a malicious finding could survive and cost 20k tokens per call; the budget caps the blast radius.
5. **Back-compat** — if no budget is configured, behaviour is exactly as today (unlimited). Existing tenants don't get a surprise outage when this ships.

### Non-goals

- Real-time cost-in-dollars reporting. Token → $ conversion rates vary per provider and model and are out of scope. A follow-up can add price-per-token tables.
- Per-user budgets. Budgets are per-tenant. Mixing per-user and per-tenant creates precedence rules that are the wrong first thing to solve.
- Cross-tenant fairness scheduling (who triages first when budgets are tight). Out of scope; existing `AITriageRateLimiter` handles burst order.

---

## 3. Proposed design

### 3.1 Data model

```sql
-- 000164_ai_triage_budget.up.sql
CREATE TABLE ai_triage_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Billing window: start of the month in the tenant's time zone.
    -- We normalise to UTC on insert; the human-readable month comes
    -- from a derived view, not the column itself.
    period_start TIMESTAMPTZ NOT NULL,
    period_end   TIMESTAMPTZ NOT NULL,

    -- Tokens is a flat counter. Claude / OpenAI / Gemini all expose
    -- prompt_tokens + completion_tokens in the response; we sum them
    -- into this single number. Keeping provider breakout out of v1
    -- matches our "no dollar conversion" non-goal.
    token_limit      BIGINT NOT NULL,       -- 0 or NULL = unlimited (back-compat)
    tokens_used      BIGINT NOT NULL DEFAULT 0,

    -- Soft thresholds, in percent (0-100). NULLs default to 80/95 in code.
    warn_threshold_pct   INT,
    block_threshold_pct  INT,    -- defaults to 100 — hard block

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, period_start)
);

CREATE INDEX idx_ai_triage_budgets_tenant_period
    ON ai_triage_budgets(tenant_id, period_start DESC);
```

Invariant: exactly one row per (tenant_id, period_start). At month rollover, the scheduler inserts a new row with `tokens_used = 0` rather than mutating the previous month's snapshot — keeps history queryable.

### 3.2 Service API

```go
// internal/app/aitriage/budget.go (new)

type BudgetService struct {
    repo   BudgetRepository
    logger *logger.Logger
}

// Check is the gate called BEFORE invoking the LLM. It returns:
//   - ErrBudgetExceeded when tokens_used + estimated >= limit
//   - ErrBudgetUnavailable on repo failure (fail-open in dev, fail-
//     closed in production per config — see §3.5)
//   - nil when the call is allowed to proceed
func (s *BudgetService) Check(ctx context.Context, tenantID shared.ID, estimatedTokens int) error

// Record is called AFTER the LLM response arrives, with the actual
// token count from the provider. Idempotent on (tenant_id, period_start,
// triage_result_id) so retries don't double-count.
func (s *BudgetService) Record(ctx context.Context, tenantID shared.ID, triageResultID shared.ID, tokens int) error

// Status returns the current budget state for UI / dashboard tiles.
func (s *BudgetService) Status(ctx context.Context, tenantID shared.ID) (*BudgetStatus, error)
```

`estimatedTokens` is the sum of the prompt size (we know before the call) plus a provider-dependent completion estimate. Keep conservative — under-estimating lets a single call overshoot the ceiling.

### 3.3 Integration into triage flow

In `service.go:triageOne` (current call site around line 450):

```go
// BEFORE LLM call
if s.budget != nil {
    if err := s.budget.Check(ctx, tenantID, estimatePromptTokens(prompt)); err != nil {
        if errors.Is(err, ErrBudgetExceeded) {
            s.logTriageBudgetExhausted(ctx, tenantID, resultID, findingID)
            return s.failTriage(ctx, result, "monthly AI budget exhausted")
        }
        // ErrBudgetUnavailable: in prod → same fail-closed; in dev → warn & proceed
        if !s.config.StrictBudget {
            s.logger.Warn("budget check failed, proceeding (dev)", "error", err)
        } else {
            return s.failTriage(ctx, result, "budget service unavailable")
        }
    }
}

// AFTER LLM call (existing code already has llmResp.TotalTokens)
if s.budget != nil {
    _ = s.budget.Record(ctx, tenantID, resultID, llmResp.TotalTokens)
}
```

### 3.4 Warn threshold + alerting

At `Record()` time, compute `new_used / limit`. Emit:

- At the first call that crosses `warn_threshold_pct` (default 80%): emit `notification.ai_budget.warning` event through the outbox — tenant gets their usual notification channel (Slack/Teams/email).
- At `block_threshold_pct` minus 5% (default 95%): second warning.
- At 100%: `notification.ai_budget.exhausted` and from that call forward, `Check()` returns `ErrBudgetExceeded`.

Events are idempotent per (tenant_id, period_start, threshold) — we do not spam a tenant with 80% warnings every triage after they cross 80%.

### 3.5 Failure modes

- **Budget repo unreachable** (Redis/Postgres down). Default **fail-closed** in production (`strict_budget: true`) so a DB outage can't hide runaway spending. Dev / staging default fail-open to keep the loop moving. Configured via `AITriage.StrictBudget` bool.
- **Row missing at start of month.** First `Check()` of the month auto-creates the row via UPSERT with the default limit from `tenant_settings.default_ai_token_budget`, itself derived from the tenant's plan. A missing plan limit defaults to unlimited (back-compat for existing tenants who onboarded pre-RFC).
- **Clock skew** between app nodes and DB — use `NOW()` on the DB side, never on the app side.

### 3.6 Admin UX

- `GET /api/v1/ai-triage/budget` — returns current period's budget, used, remaining, threshold crossings.
- `PATCH /api/v1/ai-triage/budget` (admin only) — update `token_limit`, `warn_threshold_pct`, `block_threshold_pct` for the current period. Past periods immutable.
- Dashboard tile: `features/ai-triage/components/budget-tile.tsx` — a simple bar gauge + the "top 5 spenders" (by finding / by scanner source) this period to help admins understand where spend is going.

### 3.7 Operator observability

- Prometheus:
  - `ai_triage_budget_used_tokens{tenant_id}` gauge
  - `ai_triage_budget_exhausted_total{tenant_id}` counter
  - `ai_triage_budget_check_duration_seconds` histogram
- Grafana panel: per-tenant burn-down chart. Useful during customer-support conversations ("why is my triage off?" → "you hit 100% of your budget at 02:13 UTC").

---

## 4. Alternatives considered

| Option | Why rejected |
|---|---|
| **Chosen:** per-tenant monthly token cap | Directly addresses the cost-DoS and blast radius threats. Minimal new surface. |
| Dollar-denominated budget | Requires maintaining token→$ conversion tables per provider and model; breaks every time a provider changes pricing. Token budgets are precise even when dollar amounts drift. |
| Daily cap (not monthly) | Doesn't match how LLM bills flow. Monthly is the standard SaaS billing window; daily just adds rollover complexity. |
| Global (per-platform) cap | Doesn't protect a specific tenant from a neighbour's abuse. Global + per-tenant might come later, but tenant-first addresses the actual threat model. |
| Token estimate purely post-facto (no pre-check) | A single large prompt can burn the remaining budget and keep going. Pre-check + post-record catches overshoot at the expense of a small over-estimate on pre-check. |
| Async queue, no hard stop | Triage latency matters — users watch the spinner. A queue that blocks at "0 budget" is equivalent to a hard fail from the user's POV. |

---

## 5. Rollout plan

### Phase 1 — Schema + service (3 days)

- Add migration 000164.
- Add `BudgetService` + repo + unit tests.
- Wire `Check()` and `Record()` into `AITriageService.triageOne`, behind a feature flag `AI_TRIAGE_BUDGET_ENABLED`.
- Ship with the flag OFF. Tests pass, no behaviour change.

### Phase 2 — Populate budgets, metrics only (1 week)

- Backfill current-month rows for all tenants with `token_limit = 0` (unlimited). This gives `Record()` a row to update.
- Turn on Phase 2 — `Record()` runs (so we SEE usage), `Check()` is a no-op (returns nil always).
- Collect 1 week of data. Identify current steady-state token usage per tenant. This informs the default budget for plans.

### Phase 3 — Default budgets per plan (1 week soak)

- Free-plan tenants get 100k tokens/month (roughly 100 triages at 1k tokens each).
- Paid-plan tenants get 10M tokens/month (10,000 triages).
- Turn `Check()` on for new tenants only. Existing tenants stay unlimited so no surprise outage.
- Ship dashboard tile + warning notifications.

### Phase 4 — Enforcement on existing tenants (1 month notice + 1 week actual)

- Email every tenant-admin with their last 30 days' usage and the planned cap. Give 30 days to react (upgrade plan, buy more tokens, etc.).
- Flip `Check()` on globally. Tenants who opted out by contract get `token_limit = 0` (unlimited).

### Rollback

- Feature flag off. `Check()` returns nil regardless of budget row; `Record()` continues so history stays consistent.
- Schema change is purely additive — no rollback migration needed unless we drop the whole table.

---

## 6. Acceptance criteria (DoD)

- Migration 000164 applied in prod.
- `ai_triage_budgets` row exists for every active tenant for every month since the rollout.
- Phase 3 rollout completed: every new tenant has a budget-enforced triage loop.
- Phase 4 rollout completed: every tenant under enforcement.
- Grafana panel live; on-call runbook documents how to raise a tenant's budget urgently.
- `SECURITY.md` updated: "LLM cost / prompt-injection blast radius is capped by `ai_triage_budgets`."

---

## 7. Open questions

1. Does the UI surface "budget exhausted" or a softer "waiting on triage"? Latter is more graceful, former is honest. Product decision.
2. If a tenant buys more tokens mid-month (SaaS add-on pack), does `token_limit` get updated in the current row, or does a new row with `period_start = now()` get inserted? Affects history semantics. Pick one, document.
3. Should the budget cover non-triage LLM calls too (summarisation, RAG, future features)? If yes, rename `ai_triage_budget` → `ai_budget` in Phase 1 before we have consumers to migrate. Recommend: yes, rename now.
4. Prompt-injection hardening independent of budgets — not in scope here; audit Pass-2 filed as separate work.

---

## 8. Non-fix alternatives if this RFC is rejected

- Turn off AI triage entirely and document "use at your own cost-risk". Nobody wants this, but the option exists.
- Front-load the cost check at the UI ("this will cost X tokens, confirm?") — annoys users, doesn't stop automation / API abuse.
- Pre-purchase tokens per tenant (fixed allocation). Makes billing simpler but doesn't stop in-period overshoot.

---

**Last Updated**: 2026-04-22
