---
title: AI suggestions and approval
parent: User guide
nav_order: 5.8
---

# AI suggestions and approval

When OpenCTEM asks an AI model to look at a finding, the answer is advice, never a
decision. The AI either shows its analysis, writes a comment as an
[AI agent](ai-agents.md), or files an approval request that a person decides.
Anything that would lower risk always needs a person.

## AI triage on a finding

**AI triage** (button on the finding, with **Re-analyze** once a result exists) asks the AI for
an assessment of the finding. It needs the `ai_triage:trigger` permission and a turned-on AI
([Settings > AI](10-settings-and-integrations.md#ai)). The tooltip says it: a suggestion only,
nothing on the finding changes.

The result appears on the **Overview** tab as **AI Triage Analysis**, with the **AI** badge, the
provider and model, and:

- a short summary;
- **Severity** and the justification for it;
- **Risk Score**;
- **Exploitability** (Theoretical, Low, Medium or High) and the details;
- **False Positive**: how likely the finding is a false positive, in percent, and why;
- a **Priority** and the business impact;
- recommended remediation steps, each with an effort (Low, Medium or High).

While it runs the button reads **Queued...** and then **Analyzing...**; you are told when it is
ready. If it fails, the card says why in plain words: AI turned off, the monthly allowance used
up, the organization's data policy keeping the finding away from AI, the provider refusing or
timing out. An earlier result stays available in the finding's triage history. Only one analysis
runs per finding at a time.

The AI badge means the content was written by a model. Read it as advice and check the finding
before you act. Text from the model is always shown as plain text.

## What an AI agent can do

An [AI agent](ai-agents.md) runs the same analysis as its own identity. Its results are:

| Result | What happens |
|---|---|
| Remediation steps, a summary, a verdict that confirms the finding | Written as a comment by the AI agent, with the AI badge. In **Auto-apply** mode they are applied at once when they only add information and meet the minimum confidence. |
| A higher severity | A comment. A severity never rises on the AI's word alone. |
| A lower severity, or a likely false positive | An [approval request](05-exposures-and-findings.md#approval-requests) with the AI agent as the requester, decided by a person under your four-eyes rules. When a person started the analysis on demand it is left as a comment instead, because that person could otherwise approve it as the second person. |
| Output without evidence, flagged for review, or under 0.5 confidence | A comment only. |

Severity and priority never change without a person, in either direction. These rules are fixed;
no setting loosens them. Which results apply by themselves is set per use case in
[Settings > AI: use cases](ai-use-cases.md).

## Why risk-lowering always needs approval

A finding's text comes from scanners, code and people outside your control, and it can be written
to talk the AI into closing a finding ("this is a false positive"). So OpenCTEM never lowers risk
on the AI's word alone.

### False-positive proposals

When a completed AI triage rates a **medium or low** finding at least 0.9 likely to be a false
positive, the platform opens a pending false-positive approval request. The console marks it
**Proposed by AI triage** ("An AI suggestion, not a decision. Check the finding before you
approve it."); a request written by an AI application on behalf of someone who cannot approve it
is marked **Proposed by AI application**. Any approver may decide it, since no person requested
it; it is never approved automatically, never made for critical or high findings, and not
repeated while a request is pending or after a person rejected one. Nothing is proposed when the
model's output needed correcting or the finding text looks like an attempt to steer the AI.

In [Triage mode](05-exposures-and-findings.md#triage-mode), the latest AI triage shows as an
advisory card, "AI suggestion, advisory"; **Apply suggestion** only fills the false-positive
request form, and you send it.

## What is sent

What the AI sees is masked first: hosts, addresses, people and secrets are replaced (see
[Settings > AI: data masking](ai-data-masking.md)), and fields above the use case's data ceiling
are withheld ([use cases](ai-use-cases.md#settings-per-use-case)). Every run keeps its
provenance (provider, model, prompt template, what was sent and withheld, tokens), which the API
returns for a run; see [AI triage](../api/ai-triage.md#ai-agents-and-analysis).

Every AI action is written to the finding's timeline and to the
[audit log](02-team-and-access.md#audit-log); an automatic one names the AI agent as the actor.

## Related

- [AI agents](ai-agents.md) and [use cases](ai-use-cases.md)
- [AI triage](../api/ai-triage.md) (API and limits)
- [Known false positives](known-false-positives.md)
