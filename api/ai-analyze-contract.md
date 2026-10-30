---
title: AI analyze contract
parent: API
nav_order: 6.5
---

# AI analyze contract (`openctem.analyze/v1`)

This page is for people who build an AI agent that works with OpenCTEM. The contract is the job
an AI agent receives and the result it returns, as versioned JSON Schemas. OpenCTEM's built-in executor
and any AI agent use the same contract, so every result goes through one validation,
provenance and approval path (see [AI suggestions and approval](../user-guide/ai-suggestions-and-approval.md)).

Status: the schemas and the validator are available, and the built-in executor
(`POST /api/v1/findings/{id}/ai/analyze`, see [AI triage](ai-triage.md#ai-agents-and-analysis))
writes its runs through the contract. Planned: the AI worker that receives jobs. Treat the
schemas as stable for `v1`; a breaking change is a new version.

## Schemas

| Schema | `$id` |
|---|---|
| Job | `https://openctem.io/schemas/analyze/job/v1.json` |
| Result | `https://openctem.io/schemas/analyze/result/v1.json` |
| Suggestion | `https://openctem.io/schemas/analyze/suggestion/v1.json` |
| Triage output (`openctem.ai.triage/v1`) | `https://openctem.io/schemas/analyze/output/triage/v1.json` |
| Remediation output (`openctem.ai.remediation/v1`) | `https://openctem.io/schemas/analyze/output/remediation/v1.json` |
| Summary output (`openctem.ai.summary/v1`) | `https://openctem.io/schemas/analyze/output/summary/v1.json` |

The files are `api/pkg/sensorproto/analyze/schemas/*.schema.json` in the
[openctem repository](https://github.com/openctemio/openctem). The design is
`api/docs/rfcs/RFC-131-ai-analysis.md` and `api/docs/architecture/ai-analyze-contract.md`.

## Kinds

| Kind | Use case | Output | Suggestions it may contain |
|---|---|---|---|
| `triage.v1` | triage | `openctem.ai.triage/v1` | verdict, severity, remediation steps, summary (one of each) |
| `remediation.v1` | remediation | `openctem.ai.remediation/v1` | remediation steps |
| `summary.v1` | summary | `openctem.ai.summary/v1` | summary |

## What the job carries

The job names the kind and the subject and carries the masked context: placeholders instead of
your real hosts, people and secrets (see
[data masking](../user-guide/ai-data-masking.md)). An AI agent works on placeholders and returns
placeholders; the platform resolves them. An AI agent never receives a secret.

## Rules every output meets

- **Closed objects.** No field outside the schema. An output cannot carry a direction, a state, a
  target or a note; the platform computes the direction from the finding's facts.
- **Bounded values.** Enums and limits on every value: verdict, severity and effort are enums,
  confidence is 0 to 1, texts have maximum lengths, at most 20 remediation steps and 16 evidence
  items.
- **Evidence by reference.** Evidence is `bundle:<field>` or `tool:<n>`. The platform checks that
  each reference exists in the run; an output citing something that was not there is stored for
  review and never applied automatically.
- **One suggestion per kind** in a result.
- **The JSON object alone.** No prose before or after it.
- **Refusals do not echo content.** A rejected output is reported by the failing location and
  schema keyword only.

## Example

A triage output with a verdict and a summary. Each suggestion has a `kind`, a `payload`, a
`confidence` and `evidence`:

```json
{
  "suggestions": [
    {
      "kind": "verdict",
      "payload": {
        "verdict": "likely_false_positive",
        "reason": "The response is the default page."
      },
      "confidence": 0.82,
      "evidence": [{ "ref": "bundle:evidence.redacted", "quote": "default page" }]
    },
    {
      "kind": "summary",
      "payload": { "text": "A known issue in an internal service." },
      "confidence": 0.9,
      "evidence": [{ "ref": "bundle:finding.title" }]
    }
  ]
}
```

The platform, not the AI agent, decides what each suggestion does: the verdict above lowers risk, so
it can only become an approval request. Hosts in a real job appear as placeholders, never as
`example.com` or any real name; the schemas in the repository are the authority for exact fields
and limits.
