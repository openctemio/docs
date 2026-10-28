---
title: "Settings > AI: use cases"
parent: User guide
nav_order: 10.5
---

# Settings > AI: use cases

**Settings > AI > Use cases** decides, for each kind of AI result, whether it waits for a person or
applies on its own, and how much data the AI may see. Everyone with settings access can read the
page. Only owners and administrators can change it.

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
| **Suggest** | Results appear as suggestions; a person applies or dismisses each one. |
| **Auto-apply** | Results that only add information apply at once, with the AI badge and Undo. |

Auto-apply never applies a severity change, a risk-lowering change, or a result flagged for
review. A false-positive verdict still becomes an approval request. See
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
stays a suggestion.

## Who can change it, and when you sign in again

Saving needs the `settings:write` permission. Turning **Auto-apply** on, or raising the ceiling above
**Internal**, also needs a recent sign-in, so you may be asked to sign in again. These changes
are recorded in the audit log as critical events.

## Automatic downgrade

OpenCTEM watches how people treat each use case. Over the last 50 decisions, when dismissals,
undos and rejected approval requests reach 20 percent (and there are at least 10 decisions), an
**Auto-apply** use case falls back to **Suggest**. The page says when and why, and an audit entry
`ai_use_case.downgraded` is written.

Only an owner or administrator can turn it back on: choose **Turn auto-apply back on**, which clears
the downgrade. Check first why people were overriding the results.

## API

`GET /api/v1/organization/settings/ai/use-cases` and
`PUT /api/v1/organization/settings/ai/use-cases/{use_case}` (`triage`, `remediation` or `summary`).
See `api/docs/architecture/ai-analysis.md` in the
[openctem repository](https://github.com/openctemio/openctem).
