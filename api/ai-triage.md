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

An organization chooses the **AI source** in **Settings > Security > AI** (see
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

## Limits and data handling

- Triage requests are rate limited per organization (10 per minute by default) and by the
  organization's monthly token limit when one is set.
- The finding's details are sent to the configured model provider. Decide on the provider with
  that in mind.
- Automatic triage of new findings (by severity) is an organization setting, off by default.
