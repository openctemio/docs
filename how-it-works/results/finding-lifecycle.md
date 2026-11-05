---
title: Finding status lifecycle
parent: Results and findings flows
grand_parent: How it works
nav_order: 4
description: Every status a finding can have, who or what moves it from one to the next, and the checks on each move.
---

# Finding status lifecycle
{: .no_toc }

A finding's status says what should happen next. People move it through
triage, work and verification. The platform moves it only on evidence: a
covered scan that no longer sees it, a passing retest, a sighting after a
close, or the end of an accepted risk. Every move is checked against the same
rules, whatever page, API or integration makes it.

1. TOC
{:toc}

## The flow

```mermaid
stateDiagram-v2
  [*] --> new: first reported
  new --> confirmed: triage
  confirmed --> in_progress: work starts
  in_progress --> confirmed: back to triage
  in_progress --> fix_applied: fix claimed, with a note
  fix_applied --> in_progress: fix rejected, or retest still finds it
  fix_applied --> resolved: verified, or retest passes
  confirmed --> resolved: verified
  new --> resolved: covered scan no longer sees it
  in_progress --> resolved: covered scan no longer sees it
  new --> duplicate: marked duplicate
  confirmed --> duplicate: marked duplicate
  new --> false_positive: approved
  confirmed --> false_positive: approved
  confirmed --> accepted: approved, with an end date
  resolved --> confirmed: seen again after triage
  resolved --> new: seen again, never triaged
  accepted --> confirmed: end date passed
  false_positive --> confirmed: reopened
  duplicate --> confirmed: reopened
```

1. **New**: the first report from a scan, an import or an integration.
2. **Confirmed, In Progress, Fix Applied**: moved by people with the
   status permission. Claiming a fix needs the fix permission, a note, and
   being someone who owns the fix (assignee, assigned group or asset owner).
3. **Resolved** by a person needs the verify permission and evidence that
   grows with the risk: a note for a standard finding, a completed checklist
   or a passing retest for a high one, and for a critical one a passing
   retest or a checklist completed by another person.
4. **Resolved** by the platform: a covered scan of the same tool no longer
   sees it ([Automatic closing](auto-close.md)), the source says it is
   mitigated, or a retest passes when your retest setting allows it.
5. **False Positive** and **Risk Accepted** need an approved request (unless
   your approval levels let the request apply at once) or an approved
   suppression rule. An accepted risk has an end date and comes back as
   Confirmed when it passes.
6. **Seen again**: a resolved finding reopens as Confirmed, or as New when
   nobody had triaged it. A false positive, accepted risk or duplicate stays
   as decided.

Not drawn: suppression rules can also move findings that are in progress,
and lifting a rule returns them to New. Ticket integrations can only set
Confirmed, In Progress or Fix Applied; automations cannot reopen a closed
finding.

```mermaid
sequenceDiagram
  autonumber
  actor P as Member
  participant F as Platform
  P->>F: change status, with a note
  F->>F: signed in, member of the organization,<br/>status permission, finding in your data scope
  F->>F: move allowed for you, with the evidence given?
  alt refused
    F-->>P: the rule that refused it
  else allowed
    F->>F: status saved only if nobody changed it meanwhile
    F->>F: timeline, audit log, SLA, notifications,<br/>retest queued on Fix Applied
    F-->>P: new status
  end
```

## When something fails

| What happens | What you see | What to do |
|---|---|---|
| A move the lifecycle does not allow | An error naming the rule | Take the allowed steps, or ask someone with the permission |
| Not enough evidence to resolve | Resolve refused for the risk tier | Complete the checklist or run a retest |
| Someone changed the finding meanwhile | A conflict | Reload and try again |
| **Verify** on a standard finding without a checklist | Refused, while a status change with a note works | Use the status change, or complete the checklist |

## Security

- Every move checks your organization, your membership, the permission and
  your data scope; a finding outside it is answered as not found.
- Approvals need a second person unless your organization's approval levels
  say otherwise; the requester cannot approve their own request.
- Every status move a person or the platform makes writes the timeline and
  an audit log entry. A move made by a retest writes only the timeline today.

## Related

- [Status workflow](../../user-guide/05-exposures-and-findings.md#status-workflow)
- [Closing findings](../../user-guide/closing-findings.md)
- [Known false positives](../../user-guide/known-false-positives.md)
