---
title: "Settings > AI: use cases"
parent: User guide
nav_order: 10.5
---

# Settings > AI: use cases

**Settings > AI > Use cases** decides, for each kind of AI result, whether it waits for a person or
applies on its own, and how much data the AI may see. Owners and administrators open it under
Settings > AI and change it there; anyone with the `settings:read` permission can read the same
settings through the API.

Nothing runs until AI is turned on for the organization (see
[AI](10-settings-and-integrations.md#ai)). Until then every use case is off whatever its mode.
After you consent, a use case you have not touched is in **Suggest** mode.

## Use cases

| Use case | What it produces |
|---|---|
| **Triage** | A verdict (real issue, likely false positive, needs information) and a severity assessment. |
| **Remediation steps** | Steps to fix the finding, added to its record. |
| **Summary** | A short plain-language summary of the finding. |

## Settings per use case

**Mode**

| Mode | Behaviour |
|---|---|
| **Off** | The use case does not run. |
| **Suggest** | Results wait for a person: they appear on the finding with the AI badge (the AI triage result, or the AI agent's comment) and change nothing until someone acts on them. |
| **Auto-apply** | Results that only add information apply at once, with the AI badge: a verdict that confirms a new finding, remediation steps, a summary. |

Auto-apply never applies a severity change, a risk-lowering change, or a result flagged for
review. A higher severity stays a suggestion; a lower severity becomes a severity request; a
false-positive verdict becomes an approval request. A person decides each of them. See
[AI suggestions and approval](ai-suggestions-and-approval.md#why-risk-lowering-always-needs-approval).

**Most sensitive data sent** is the data class ceiling:

| Class | Includes |
|---|---|
| **Public** | Public ids such as CVE, CWE, OWASP, KEV and EPSS values. |
| **Internal** (the default) | Title, description, severity, score, source, tool, file and line, exposure, asset name, type and criticality. |
| **Restricted** | Also the code snippet. |
| **Stays in your organization** | Anything not classified: never sent. |

Fields above the ceiling are withheld and listed as withheld in the [Why view](ai-suggestions-and-approval.md#the-why-view).
A finding for a leaked secret never sends its snippet, whatever the ceiling.

**Minimum confidence to auto-apply** is between 0.50 and 0.99 (default 0.85). A result below it
stays a suggestion. It is used only in **Auto-apply**.

If nothing in a finding is within the ceiling (for example **Public** and the finding has no CVE,
CWE or OWASP id), AI triage sends nothing and says so.

## Who can change it, and when you sign in again

Saving needs an owner or administrator with the `settings:write` permission. Turning
**Auto-apply** on, raising the ceiling above **Internal**, or lowering the minimum confidence while
**Auto-apply** is on also needs a recent sign-in, so you may be asked to sign in again. These
changes are recorded in the audit log (`ai_use_case.updated`) as critical events, and every owner
and administrator is told. Turning a use case off or back to **Suggest**, or lowering the ceiling,
applies at once.

## Automatic downgrade

OpenCTEM watches how people treat each use case. It counts the decisions people made on the
requests the AI filed since **Auto-apply** was last turned on (false-positive and severity
requests), the last 50 at most. When rejections reach 20 percent (and there are at least 10
decisions), the use case falls back to **Suggest**. The page says when and why, and an audit entry
`ai_use_case.downgraded` is written.

Today only **Triage** files requests, so only it can fall back. Dismissing or undoing a result is
not counted yet.

Only an owner or administrator can turn it back on: choose **Turn auto-apply back on**, which clears
the downgrade. Check first why people were overriding the results.

## API

`GET /api/v1/organization/settings/ai/use-cases` and
`PUT /api/v1/organization/settings/ai/use-cases/{use_case}` (`triage`, `remediation` or `summary`).
A request for AI triage while **Triage** is off is refused with `AI_USE_CASE_OFF`.
See `api/docs/architecture/ai-analysis.md` in the
[openctem repository](https://github.com/openctemio/openctem).
