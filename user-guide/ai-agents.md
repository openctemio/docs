---
title: "Settings > AI: AI agents"
parent: User guide
nav_order: 10.4
---

# Settings > AI: AI agents

An **AI agent** takes part in triage like a person, as its own service account. It calls
the same finding commands a person calls, with its own role and data scope, and its
changes go through the same approvals, audit log and notifications. People or teams answer
for it, and it pauses on its own when nobody does. The concept is explained in
[AI agents](../overview/ai-agents.md); this page is the console page where you manage them.

**Settings > Security > AI** (`/settings/ai`) has an **AI agents** section. Everyone who
can use AI may read the list; creating and changing AI agents needs
`service_accounts:manage` (owners and administrators by default).

## The list

Each row shows the AI agent's **Name**, **Preset**, **Status**, who is **Accountable** and
the date it must be attested by (**Attest by**).

| Status | Meaning |
|---|---|
| **Active** | It may act. |
| **Paused** | It does nothing until resumed. The reason is shown: **No active accountable owner**, **Attestation overdue**, **Paused by an administrator** or **Missing permissions**. |
| **Disabled** | Switched off by an administrator. It cannot be resumed by its owners. |

## Create an AI agent

1. Choose **New AI agent**. Creating one asks for a recent sign-in.
2. Enter a **Name** and an optional **Description**.
3. Choose the **Preset**:
   - **Suggest**: reads findings, comments and opens approval requests. It never changes
     a finding itself.
   - **Triage**: also changes status, severity and assignment like a person with that
     role, and links duplicates.
4. Choose the **Accountable owners**, people or teams. At least one is required.
5. **Create**.

A preset is a fixed set of permissions defined by the platform. The person who sets it must
hold those permissions themselves. A fixed deny list keeps approving, verifying, deleting,
exporting, revealing secrets, bulk changes and administration with people: no preset and no
owner can give them to an AI agent. An AI agent never signs in, has no API key, no MCP
grant and no role of its own, never holds full data access and does not use a seat.

## Accountable owners and attestation

- An AI agent never does more than its accountable owners could do themselves: its
  effective permissions are capped by what they hold.
- Each owner must **Attest** every 90 days: confirm that the preset, scope and behavior are
  still right. An accountable person can also **Pause** their own AI agent.
- It pauses by itself when no owner is active any more (someone left, a team was emptied) or
  when the attestation runs out. This is checked when a run starts and by an hourly sweep.
  Naming a new owner (**Change owners**) or attesting again, then **Resume**, brings it back.
- **Change owners**, **Change preset**, **Resume** and **Delete** ask for a recent sign-in
  and a confirmation. **Disable** is the kill switch: it stops the AI agent until an
  administrator turns it back on, and keeps its history. **Delete** removes the service
  account and its access; what it did stays in each finding's history.

## What it does and how you see it

- Every item an AI agent produces carries one **AI** badge: "AI agent {name}" with a second
  line "Accountable: {owners}". In a finding's activity, a change an AI agent made names the AI
  agent and its accountable owners. An AI application connected over MCP and the built-in AI
  triage result keep their own labels.
- The audit log carries the same provenance. Each run records the AI agent, the model, the
  prompt and the fields sent and withheld.
- Anything that lowers risk (a false positive, an accepted risk or a lower severity) is
  an approval request that a person decides, whatever the organization's approval levels.
- When a person starts an analysis on demand, the AI agent leaves a false-positive verdict or
  a severity downgrade as a comment instead of filing the request, because that person could
  otherwise approve it as the second person. Scheduled and event-triggered runs still file the
  request. Raising severity is unchanged.
- Read-only AI assistance, such as an assistant answering a question, runs under the viewer's
  own permissions and writes nothing.
- Output without real evidence, with a placeholder the platform did not issue, from a context
  with injection markers, or under 0.5 confidence is written as a comment only. A change always
  re-reads the finding first: a concurrent change by someone else is never overwritten.

Everything the AI agent is shown is masked first; see [Settings > AI: data masking](ai-data-masking.md).
The same rules for suggestions apply: [AI suggestions and approval](ai-suggestions-and-approval.md).

The console shows these sections only when the server offers their routes. For the API, see
[AI triage](../api/ai-triage.md#ai-agents-and-analysis).
