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

Status: the masking itself and the policy and preview API are available. The
**Settings > AI > Data masking** page in the console follows the masking change in the openctem
repository; until it is in your version, the defaults below apply. The AI analyst worker, which will
use the same masking at its tool boundary, is planned.

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

**Settings > AI > Data masking** (owners and administrators; changing it needs a recent sign-in):

- **Per-class switches** for hosts, addresses, e-mail addresses, users, URL parameters,
  organizations and tickets. All are on by default. Turning one off leaves that class readable in
  internal data. Secrets and restricted data (code snippets) cannot be turned off.
- **Subdomain labels.** By default the labels in front of your domain stay readable
  (`payroll.DOMAIN_K3F9QA`); a switch masks them too.
- **Extra terms.** Up to 200 words of 3 to 128 characters, such as a customer or project code name,
  that are always masked as `ORG_...`.

A class added in a later version is masked by default. Every change is a high-severity audit
event, flagged when it makes masking looser; the term values themselves are never logged.

## Preview

**Preview** shows the masked version of one finding you can read: the placeholders, each with its
class only, and the fields sent and withheld. Nothing goes to a model and the mapping is discarded.
Use it after changing a switch or adding terms. Previewing is audited.

## What stays on the platform

The mapping and its key are encrypted and kept for 7 days by default, then purged, and are deleted
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
- [AI suggestions and approval](ai-suggestions-and-approval.md)
- Design: `api/docs/architecture/ai-context-masking.md` in the
  [openctem repository](https://github.com/openctemio/openctem)
