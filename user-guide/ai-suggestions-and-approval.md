---
title: AI suggestions and approval
parent: User guide
nav_order: 5.8
---

# AI suggestions and approval

When OpenCTEM asks an AI model to look at a finding, the answer is a **suggestion**, never a
decision. A suggestion shows what the AI proposes, how sure it is, what it based that on, and what
it would change. A person applies it, dismisses it, or (for some use cases) lets it apply on its
own. Anything that would hide risk always needs a person.

Available now: suggestions from AI triage, the rules below, undo, and the **Why** view. Planned:
the AI analyst worker, which will run the same analysis with tools outside the API process and
return its results through the same suggestions. Which suggestions apply by themselves is decided
per use case in [Settings > AI: use cases](ai-use-cases.md).

## Where you see a suggestion

Open a finding. AI suggestions appear on the finding with an **AI** badge. The badge means the
content was written by a model: read it as advice and check the finding before you act. Text from
the model is always shown as plain text.

Each suggestion has:

| Part | Meaning |
|---|---|
| **Kind** | **Verdict** (real issue, likely false positive, needs information), **Severity**, **Remediation steps** or **Summary**. |
| **Direction** | **Adds information**, **Raises risk** or **Lowers risk: needs approval**. OpenCTEM works this out from the finding's current facts; the model cannot choose it. |
| **Confidence** | How sure the model says it is. |
| **Evidence** | The finding fields or tool outputs the suggestion cites. A suggestion that cites nothing, or cites something the analysis never had, is marked for review. |
| **Check this before you apply it** | Shown when something is off: no evidence, evidence the analysis did not have, input that looks like it tries to steer the AI, or an answer that had to be corrected to fit the format. |

## Apply, dismiss, undo

- **Apply** makes the change as if you had made it by hand. A severity suggestion follows the
  normal severity rules. A plan or summary becomes part of the finding's record. You need the
  permission for that change (`findings:severity` for a severity, `findings:write` otherwise).
- **Dismiss** changes nothing on the finding. Dismissals count against the use case's quality
  score (see [automatic downgrade](ai-use-cases.md#automatic-downgrade)).
- **Undo** restores the previous value, but only if nobody changed the field since. If it
  changed, nothing is restored and you are told to change it by hand. Undoing a lower severity may
  itself need approval. A run that applied several things can be undone as a whole.

Every apply, dismissal and undo is written to the finding's timeline and to the
[audit log](02-team-and-access.md#audit-log). An automatic apply names the AI as the actor.

## Why risk-lowering always needs approval

A finding's text comes from scanners, code and people outside your control, and it can be written
to talk the AI into closing a finding ("this is a false positive"). So OpenCTEM never lowers risk
on the AI's word alone:

| What the suggestion does | When you click Apply | In auto-apply mode |
|---|---|---|
| **Adds information** (steps, summary, a verdict that confirms the issue) | Applied | Applied at once, with the AI badge and Undo |
| **Raises risk** (higher severity) | Applied | Still waits for a person |
| **Lowers risk** (likely false positive, lower severity) | Opens an [approval request](05-exposures-and-findings.md#approval-requests) with you as the requester | Becomes an approval request with the AI as the requester; a person decides it under your four-eyes rules |

Severity and priority never change without a person, in either direction. These rules are fixed;
no setting loosens them. A suggestion with review reasons is never applied automatically.

## The Why view

Choose **Why** on a suggestion to see how it was made:

- the **provider**, **model** and **model id**, and whether the **executor** was the built-in AI
  triage, a platform AI analyst or your organization's own analyst;
- the **prompt template** and the **output schema** that were used;
- the **data class** and the **fields sent** and **fields withheld**;
- a **bundle digest**, a fingerprint of exactly what was sent, so a run can be checked later;
- status, tokens and cost.

The Why view shows what was sent, not the raw text of your data: hosts, addresses, people and
secrets are replaced first (see [Settings > AI: data masking](ai-data-masking.md)).

## Related

- [AI triage](../api/ai-triage.md) (API and limits)
- [Known false positives](known-false-positives.md)
- Design: `api/docs/architecture/ai-analysis.md` in the
  [openctem repository](https://github.com/openctemio/openctem)
