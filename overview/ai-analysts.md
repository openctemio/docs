---
title: AI analysts
parent: Overview
nav_order: 5
---

# AI analysts
{: .no_toc }

An AI analyst takes part in triage like a member of your team. It uses the same actions, follows
the same approvals and is recorded in the same audit trail. Everything it does carries an AI label
and says which model, which prompt and which people answer for it. Engineering detail is in
[ai-analysis.md](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/ai-analysis.md)
and RFC-132 in the openctem repository.

1. TOC
{:toc}

---

## What an AI analyst is

- **Its own identity.** An analyst is a service account of your organization, not a person's
  delegate. It cannot sign in, has no password or MFA, holds no API key, and does not use a seat.
- **A preset.** *Suggest* reads findings, writes comments and opens approval requests. *Triage* can
  also confirm findings, move their status, raise severity, link duplicates and assign.
- **Accountable owners.** Every analyst has people or teams who answer for its results. An analyst
  never does more than its owners could do themselves.
- **Never an approver.** Approving, resolving, deleting, exporting, revealing secrets and changing
  settings always stay with people. Anything that lowers risk (false positive, accepted risk, lower
  severity) becomes a request that a person approves, whatever your organization's approval settings
  are.

```mermaid
flowchart LR
  admin["Administrator"] -->|creates, picks preset| analyst["AI analyst"]
  admin -->|names| owners["Accountable owners"]
  preset["Preset"] --> eff["What it may do"]
  owners -->|what they hold| eff
  deny["Never: approve, resolve,<br/>delete, export, settings"] --> eff
  analyst --> eff
  teams["Its teams"] --> scope["What it may see"]
```

## Accountable owners

| Duty | How |
|---|---|
| Answer for the analyst | Named on every change it makes: "AI analyst *name* (accountable: *owners*)" |
| Review its requests | Notified first for its approval requests; they approve only if they could approve anyway |
| Attest | Confirm every 90 days that its preset, scope and behavior are still right |
| Stop it | Pause it at any time; administrators can disable it |

The analyst pauses on its own when no owner is active any more (someone left, a team was emptied) or
when the attestation is older than 90 days. Naming a new owner or attesting again resumes it.

```mermaid
stateDiagram-v2
  [*] --> Active
  Active --> Active: owner attests every 90 days
  Active --> Paused: no active owner, or attestation expired
  Active --> Paused: owner pauses
  Paused --> Active: new owner or attestation, resume
  Active --> Disabled: kill switch
  Paused --> Disabled: kill switch
  Disabled --> Active: administrator resumes
```

## Where it runs and how it uses tools

- **Your platform holds identity and governance**: the analyst, its owners, approvals and audit.
- **The reasoning** runs in the platform (the default, with masked data sent to your chosen model) or
  in an analyst worker your organization runs next to its own model.
- **Tools always run on your sensors.** The analyst never connects to a target. It asks the platform
  to retest a finding, exactly like a person clicking Retest; the platform checks scope and sends a
  signed job to a sensor. The analyst never picks a target itself.

```mermaid
sequenceDiagram
  autonumber
  participant P as Platform
  participant A as AI analyst
  participant M as Model
  participant S as Sensor
  participant O as Accountable owner
  P->>A: analyze finding (masked context)
  A->>M: masked context and prompt
  M-->>A: needs verification
  A->>P: request retest of the finding
  P->>S: signed job after the scope check
  S-->>P: evidence
  P-->>A: evidence
  A->>P: request false positive
  P->>O: approval request with the AI label
  O->>P: approve or reject
```

| Deployment | Reasoning | Model | Tools |
|---|---|---|---|
| Cloud | platform | platform or your own key | your sensors or platform sensors |
| Self-hosted with a cloud model | platform | your provider key | your sensors |
| Self-hosted with a local model | platform or analyst worker | local | your sensors |
| Air-gapped | analyst worker or platform | local | your sensors |

## What you see

- An **AI analyst** badge with its accountable owners on the finding timeline.
- Settings > AI > AI analysts: each analyst's preset, status, owners and attestation date.
- Each AI run with its model, prompt version and the fields sent and withheld (API).
- AI comments are internal: they are never sent to tickets or integrations.
