---
title: "Settings > AI: data masking"
parent: User guide
nav_order: 10.6
---

# Settings > AI: data masking

Before OpenCTEM sends a finding to an AI model, it replaces your real hosts, addresses, people and
other identifiers with typed placeholders. The model reasons on `HOST_4K2QA` and
`IP_PRIV_7M3XB`, and OpenCTEM turns the placeholders in its answer back into real values. The
mapping never leaves the platform.

Every context bundle built for an AI model is masked this way: AI triage, an AI agent's analysis and
the preview below. The **Settings > Organization > AI** page (**Limits and data** tab, **Data masking**) has been in the console since v0.16.0. The policy is
also read and changed through the API (`GET` and `PUT /api/v1/organization/settings/ai/masking`,
and `POST .../masking/preview`). The AI worker, which will use the same
masking at its tool boundary, is planned.

## What is masked

| Value | Becomes | Can be turned back |
|---|---|---|
| Domain you own | `DOMAIN_...` (labels in front stay unless you mask them) | yes |
| Internal host name | `HOST_...` | yes |
| IP address, network | `IP_PUB_...`, `IP_PRIV_...`, `CIDR_...`, keeping its class and prefix length | yes |
| E-mail address | `EMAIL_...` | yes |
| People of the finding | `USER_...` | yes |
| URL parameters and ids in paths | `PARAM_...`, `ID_...` | yes |
| Organization name and your extra terms | `ORG_...` | yes |
| Ticket ids such as `KEY-123` | `TICKET_...` | yes |
| **Secrets**: passwords, tokens, private keys, cookies, session ids, `Authorization` values | `SECRET_n` | **never** |

The same value gets the same placeholder inside one analysis, and a different one in the next
analysis or another organization, so placeholders cannot be linked across runs. Public identifiers
(CVE, CWE, advisory ids) are left alone.

## Secrets are never sent

A secret is replaced before anything is sent, is never stored in the mapping and is never turned
back, even if the model repeats the placeholder. The model only learns its type and length
(`SECRET_1: API token, 40 chars`). A leaked-secret finding does not send its code snippet at all.

## Your settings

**Settings > Organization > AI > Limits and data > Data masking** (owners and administrators; changing it needs a recent sign-in):

- **Per-class switches** for **Host names and domains**, **IP addresses and networks**,
  **E-mail addresses**, **User names**, URL ids and parameters, **Organization names** and
  **Ticket ids**. All are on by default. Turning one off leaves that class readable in internal
  data. **Secrets** are shown as always masked and locked, and restricted data (code snippets) is
  always fully masked, whatever is set here.
- **Mask subdomain labels too.** By default the labels in front of your domain stay readable
  (`payroll.DOMAIN_K3F9QA`); this switch masks them too.
- **Masked terms.** Up to 200 words of 3 to 128 characters, such as a customer or project code
  name, that are always masked as `ORG_...`.

Saving asks for a recent sign-in, and a change that masks less asks for confirmation first
(**Mask less?**).

A class added in a later version is masked by default. Every change is a high-severity audit
event, flagged when it makes masking looser; the term values themselves are never logged.

## Preview

**Preview** takes a **Finding id** (a finding you can read) and shows **What the model gets**, as
plain text, under the saved policy: the **Placeholders**, each with its class only and never its
value, and the **Fields sent** and **Fields withheld**. Nothing goes to a model and the mapping is
discarded. Use it after changing a switch or adding terms. Previewing is audited. If the
organization's or the asset's name cannot be read, the preview (and an AI run) stops instead of
sending text in which those names are not masked.

## What stays on the platform

The mapping and its key are encrypted and kept for 7 days by default (`AI_MASK_MAP_TTL`, see
[Environment variables](../configuration/environment-variables.md)), then purged, and are deleted
with the organization. Another organization's analysis can never be read or resolved. A placeholder
the platform did not issue is never resolved: an answer that contains one is stored for review and
never applied.

## Residual risk

Masking lowers the risk of sending data to a provider; it does not remove it.

- **Context can still identify you.** Product names, versions, paths, error messages or a rare
  combination of technologies can point to an organization for someone who knows it. The data
  class ceiling and your consent to AI remain the main controls.
- Subdomain labels stay readable unless you mask them.
- Detection is pattern based. A host inside an encoded blob or an unusual name may be missed.
  The finding's own identifiers are always masked; free text is best effort.
- Lengths and counts stay visible, such as the number of hosts or the length of a secret.

## Related

- [Settings > AI: use cases](ai-use-cases.md)
- [Settings > AI: AI agents](ai-agents.md)
- [Settings > AI: knowledge sources](ai-knowledge-sources.md)
- [AI suggestions and approval](ai-suggestions-and-approval.md)
- Design: `api/docs/architecture/ai-context-masking.md` in the
  [openctem repository](https://github.com/openctemio/openctem)
