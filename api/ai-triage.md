---
title: AI triage
parent: API
nav_order: 6
---

# AI triage

AI triage asks a large language model to assess a finding: a severity assessment with its
justification, exploitability, business impact, a false-positive likelihood and a summary. The
result is advice stored next to the finding; it does not change the finding's severity, status or
priority. AI triage never decides: at most it proposes a false positive for a person to approve
(see [False-positive proposals](#false-positive-proposals)).

Every AI result is a governed **suggestion** with provenance: what it would change, the evidence it
cites, and the model, prompt and data that produced it. Each organization chooses per use case
whether suggestions wait for a person or apply on their own, and risk-lowering changes always need
approval. See [AI suggestions and approval](../user-guide/ai-suggestions-and-approval.md),
[Settings > AI: use cases](../user-guide/ai-use-cases.md) and
[Settings > AI: data masking](../user-guide/ai-data-masking.md). Third-party AI agents follow the
[AI analyze contract](ai-analyze-contract.md).

An organization chooses the **AI source** in **Settings > Organization > AI** (see
[AI](../user-guide/10-settings-and-integrations.md#ai)): the platform's provider, its own provider
(Claude, OpenAI, Gemini or an OpenAI-compatible server at a public https base URL, with a write-only
key) or off. `GET` and `PUT /api/v1/organization/settings/ai` read and change it (the `PUT` is a
partial change and returns 409 when another change was saved first), and
`POST /api/v1/organization/settings/ai/test` checks the connection with one tiny prompt that carries no
finding data. Saving needs an owner or administrator with `settings:write` and a recent sign-in, and
is audited without the key. An own provider is subject to the same consent, data-egress policy,
monthly token cap and rate limit as platform mode; each result records the provider and model.

AI triage is available in platform mode when the operator configured at least one provider key (`ANTHROPIC_API_KEY`,
`OPENAI_API_KEY` or `GEMINI_API_KEY`; the provider and model of platform mode are
`AI_PLATFORM_PROVIDER` and `AI_PLATFORM_MODEL`, see
[Environment variables](../configuration/environment-variables.md)) and the AI triage module is
turned on for the organization. `AI_TRIAGE_ENABLED` is deprecated and ignored. Automatic triage of
new findings is an organization setting (platform defaults `AI_AUTO_TRIAGE_DEFAULT_ENABLED`, off,
and `AI_AUTO_TRIAGE_DEFAULT_SEVERITIES`, `critical,high`).

## Endpoints

All endpoints are on the tenant plane and take a console session. The `GET` endpoints also accept
an `oct_` key whose scopes include the permissions listed.

| Method and path | Purpose | Needs |
|---|---|---|
| `POST /api/v1/findings/{id}/ai-triage` | request a triage; body `{"mode": "quick"}` or `"detailed"` (default `quick`) | `findings:write` and `ai_triage:trigger` |
| `GET /api/v1/findings/{id}/ai-triage` | the latest result for the finding | `findings:read` and `ai_triage:read` |
| `GET /api/v1/findings/{id}/ai-triage/history` | earlier results (`page`, `per_page`) | `findings:read` and `ai_triage:read` |
| `GET /api/v1/findings/{id}/ai-triage/{triageId}` | one result | `findings:read` and `ai_triage:read` |
| `GET /api/v1/findings/ai-triage/config` | the organization's AI mode, provider, model, auto-triage settings and token usage | `findings:read` and `ai_triage:read` |
| `POST /api/v1/findings/ai-triage/bulk` | **deprecated** (sunset 2027-01-15): triage several findings; use the single-finding route | `findings:write` and `ai_triage:trigger` |

Triage runs asynchronously. A request answers `202` with a job:

```bash
curl -X POST "https://openctem.example.com/api/v1/findings/$FINDING_ID/ai-triage" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"mode":"quick"}'
```

```json
{ "job_id": "0b7e...", "status": "pending" }
```

Then read the result. `status` moves from `pending` to `processing` to `completed` or `failed`:

```json
{
  "id": "0b7e...",
  "status": "completed",
  "severity_assessment": "high",
  "severity_justification": "...",
  "risk_score": 7.8,
  "exploitability": "...",
  "exploitability_details": "...",
  "business_impact": "...",
  "priority_rank": 2,
  "false_positive_likelihood": 0.1,
  "false_positive_reason": "...",
  "summary": "...",
  "created_at": "2026-10-08T09:30:00Z",
  "completed_at": "2026-10-08T09:30:12Z"
}
```

Real-time progress is also pushed to the console over its WebSocket.

## False-positive proposals

When a completed triage rates a **medium or low** finding at least 0.9 likely to be a false
positive, the platform opens a pending false-positive
[approval request](../user-guide/05-exposures-and-findings.md#approval-requests) for it:

- The request is made by `ai_triage`, not by a user, and its justification is the model's
  rationale. The console marks it **Proposed by AI triage**.
- The finding does not change until a person approves. Any approver may decide the request,
  since no person requested it; it is never approved automatically.
- Never for critical or high findings.
- Not repeated while a request for the finding is pending, or after a person rejected or canceled
  an AI proposal for it.
- Nothing is proposed when the model's output needed correcting or the finding contained text
  that looks like a prompt injection.

## Suggestion endpoints

| Method and path | Purpose | Needs |
|---|---|---|
| `GET /api/v1/findings/{id}/ai/suggestions` | the finding's AI suggestions | `findings:read` and `ai_triage:read` |
| `GET /api/v1/ai/runs/{id}` | one run with its provenance | same, within your data scope |
| `POST /api/v1/ai/suggestions/{id}/apply`, `/dismiss`, `/undo` | decide a suggestion | same, plus the permission of the change |
| `POST /api/v1/ai/runs/{id}/undo` | undo everything a run applied | same |
| `GET /api/v1/organization/settings/ai/use-cases`, `PUT .../use-cases/{use_case}` | the per-use-case mode, data class ceiling and minimum confidence | owner or administrator; a recent sign-in to turn on auto-apply or raise the ceiling |

Every AI response carries `origin: "ai"`. Undo answers 409 `AI_UNDO_CONFLICT` when the field changed
since.

## AI agents and analysis

An [AI agent](../user-guide/ai-agents.md) is a service account with an AI profile. It calls the same
finding commands as a person, and its changes go through the same approvals and audit.

| Method and path | Purpose | Needs |
|---|---|---|
| `GET /api/v1/ai/agents`, `GET /api/v1/ai/agents/{id}` | list AI agents or read one, with owners, preset, status and attestation date | `ai_triage:read` |
| `POST /api/v1/ai/agents` | create (name, description, preset `suggest` or `triage`, at least one accountable owner) | `service_accounts:manage` and a recent sign-in |
| `PUT /api/v1/ai/agents/{id}/owners`, `PUT .../preset` | change the accountable owners or the preset | `service_accounts:manage` and a recent sign-in |
| `POST /api/v1/ai/agents/{id}/reactivate` | resume a paused AI agent | `service_accounts:manage` and a recent sign-in |
| `POST /api/v1/ai/agents/{id}/disable` | the kill switch | `service_accounts:manage` |
| `POST /api/v1/ai/agents/{id}/suspend` | pause | an accountable owner, or `service_accounts:manage` |
| `POST /api/v1/ai/agents/{id}/attest` | confirm the AI agent is still right | an accountable owner or an administrator, and a recent sign-in |
| `DELETE /api/v1/ai/agents/{id}` | delete | `service_accounts:manage` and a recent sign-in |
| `GET /api/v1/findings/{id}/ai/runs`, `GET /api/v1/ai/runs/{id}` | the runs on a finding, and one run with its provenance | `findings:read` and `ai_triage:read` |
| `POST /api/v1/findings/{id}/ai/analyze` | one model call on the built-in executor, as an AI agent | `findings:read` and `ai_triage:trigger` |

`POST /api/v1/findings/{id}/ai/analyze` takes `kind` (`triage.v1`, `remediation.v1` or
`summary.v1`) and an optional `ai_agent_id`. The AI agent must be active (an active accountable
owner and a fresh attestation), the finding must be in its scope and in an owner's, and you must be
able to see the finding. The context holds only the fields the AI agent's data class ceiling allows,
masked with a per-run key; the output must satisfy the kind's schema (see the
[analyze contract](ai-analyze-contract.md)) before placeholders are mapped back.

The output becomes the AI agent's own commands: comments (the analysis, a remediation plan), a
confirmation and a severity raise when its preset allows, and approval or severity requests for
anything that lowers risk, which a person decides. A false-positive verdict or a severity downgrade
from an on-demand run is a comment, never a request, because the person who asked could approve it
as the second person. Output without evidence, with an unknown placeholder, from a context with
injection markers or under 0.5 confidence is a comment only. Every change re-reads the finding and
carries its row version, so a concurrent change by someone else is never overwritten. The response
lists the run and what the AI agent did with each item. The route is rate limited like AI triage.

The organization's masking policy is read and changed with
`GET` and `PUT /api/v1/organization/settings/ai/masking` (owners and administrators; a recent
sign-in, audited), and `POST .../masking/preview` returns the exact masked context of one finding
(see [data masking](../user-guide/ai-data-masking.md)).

AI triage is gated by the `ai_triage` module and the `ai_triage:*` permissions. The earlier
sub-modules `ai_triage.bulk`, `ai_triage.auto`, `ai_triage.workflow`, `ai_triage.byok`,
`ai_triage.agent` and `ai_triage.custom_prompts` no longer exist: nothing ever checked them.
Model output stays a suggestion on the triage result until a person acts on it; AI triage never
writes a finding's severity or priority.

## Limits and data handling

- Triage requests are rate limited per organization (10 per minute by default) and by the
  organization's monthly token limit when one is set.
- The finding's details are sent to the configured model provider, with hosts, addresses, people
  and secrets replaced by placeholders first (see
  [data masking](../user-guide/ai-data-masking.md)). Decide on the provider with that in mind.
- Automatic triage of new findings (by severity) is an organization setting, off by default.
