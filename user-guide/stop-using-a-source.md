---
title: Stop using a source
parent: User guide
nav_order: 5.65
---

# Stop using a source

Sometimes a source of findings turns out to be wrong for your organization: a
scanner that reports false results, a connector to a system you no longer
trust, or uploads from a tool that were a mistake. **Stop using this source**
does two things in one step, and loses nothing:

- new data from the source is refused, and every refusal is recorded on the
  receipt of that import or run;
- the findings that **only** this source reported leave your open work. They
  are archived as *source retired*: not counted as fixed, out of the metrics
  and the SLA, and brought back if you use the source again.

Findings that another source also reported stay exactly as they are. Nothing
is deleted: text, evidence, history, comments and each source's own record stay
on every finding.

## Who can do it

Stopping a source and using it again need the permission
`findings:sources:retire`, which the Owner and Administrator roles have.
Both actions ask you to confirm your identity again (step-up), and both are
written to the audit log with your reason.

Because a source's findings belong to the whole organization, a person whose
data scope is limited to some assets or groups cannot stop a source, and cannot
see its preview either.

## What a source is

| Source | What is stopped |
|---|---|
| A tool on one of your sensors | That tool's reports from that sensor: scan runs, tasks and reports the sensor sends on its own |
| An upload tool | Uploads of that tool's results (for example a Nessus file) |
| A connector | Imports from that connector |

A connector that imports through a sensor (the Tenable.sc connector) is
stopped from its own card; the platform works out which sensor and tool that
means.

## Where to find the button

- **On a finding**: the **Seen by** card lists every source that reported the
  finding. Each source has a **Stop using this source** button.
- **On a connector**: the Tenable.sc connector card has the same button next to
  **Sync now** and **Edit connector**.

People without the permission do not see the button.

## The dialog

The dialog opens with the safe choice already made: archive the findings only
this source reported, and refuse new data. Before you confirm, **What happens**
shows the counts the platform computed:

- how many findings only this source reported, which will be archived;
- how many were also reported by another source, and stay as they are;
- how many stay open for another reason (see below);
- how many of the archived findings leave their SLA.

Enter a **Reason** (10 to 500 characters). It is recorded in the audit log.

If critical findings or findings in the CISA KEV catalog would be archived,
the dialog asks you to tick a separate confirmation, "I reviewed the N critical
or known-exploited findings that will be archived". The platform counts these
again when you confirm, so the number you approved is the number that applies.

### Advanced options

Folded under **Advanced options**:

- **Keep every finding open; only refuse new data**: nothing is archived; only
  new data from the source is refused.
- **Archive these severities**: archive only the severities you pick. Findings
  of other severities stay open.
- **Also archive findings with a ticket, remediation task or assignee**: by
  default these stay open, because someone is working on them.

## Which findings stay open

A finding this source reported is **not** archived when:

- another source also reported it (unless that other source was stopped too);
- a person entered it (a pentest, manual or bug bounty finding);
- it is already closed;
- someone is working on it: it is past New or Confirmed (in progress, fix
  applied);
- it is a leaked secret: a source that stops reporting a secret has not
  rotated it;
- it has a ticket, an open remediation task or an assignee, unless you chose to
  archive those as well;
- its severity was not selected.

## What "source retired" means on a finding

An archived finding is resolved with the closure reason **Source retired**:

- it is not counted as fixed (mean time to remediate and fixed counts ignore
  it);
- it has no running SLA (its deadline is kept);
- the finding shows the closure reason **Source retired**, so you can tell why
  it was closed;
- a person can reopen it, and it reopens on its own when a source you still use
  reports it again.

## New data is refused, and recorded

From the moment you confirm, reports from the source are refused before
anything is written: no asset, finding or sighting is created or changed. The
refusal is not silent. The receipt of each refused import or run counts every
finding the report sent as **Refused, the source was stopped**, so the receipt
still adds up. See **Import and run receipts** (`/findings/imports`).

## Scans of a stopped sensor tool are not dispatched

Stopping a sensor tool also stops the work, not only its results. When a sensor
asks for work, it is not given a scan whose tool you stopped on that sensor,
including scans queued before you stopped it.

| The scan task | What happens |
|---|---|
| Not pinned to a sensor, and another sensor of your organization may run it | It waits for that other sensor. The task shows the placement reason `source_retired` |
| Pinned to the stopped sensor, or no other sensor may run it | It fails at once with the code `SOURCE_RETIRED` |

On a scan run, the step with that code is **skipped**, never failed: later
steps that depend on it are skipped too, and the other steps still run. The run
ends **partial**; if no step produced results it ends failed, with a message
naming the step. The run page explains the code and links to **Sources you
stopped using**. Use the source again, or run the step on another sensor that
has the tool.

A task the sensor had already taken before you stopped the source still runs;
its results are refused when they arrive.

## Sources you stopped using

**Import and run receipts** (`/findings/imports`) has a **Sources you stopped
using** list. Each source shows its state:

| State | Meaning |
|---|---|
| **Archiving** | New data is refused; the findings are being archived (with progress, "N of M findings") |
| **Stopped** | New data is refused; the archiving is done |
| **Data refused, findings kept open** | Stopped with "keep every finding open" |
| **Restoring** | The source is accepted again; its findings are being restored |
| **In use again** | The source was used again |

A large source is archived in the background. If the platform restarts, it
resumes where it stopped.

## Use this source again

**Use this source again** in that list undoes the stop:

- data from the source is accepted again at once;
- every finding the stop archived returns to the status it had (New or
  Confirmed), except a finding someone changed since (reopened, closed another
  way, or reported again by another source). Those are left as they are and
  counted as "left as someone changed them".

You can stop the same source again later.

## Through the API

The same actions are available through the REST API, with the same permission,
step-up and audit:

| Route | Does |
|---|---|
| `POST /api/v1/findings/sources/retirements/preview` | The counts for a source and options |
| `POST /api/v1/findings/sources/retirements` | Stop using a source |
| `GET /api/v1/findings/sources/retirements` | The sources you stopped (`include_restored=true` for all) |
| `GET /api/v1/findings/sources/retirements/{id}` | One stopped source and its progress |
| `POST /api/v1/findings/sources/retirements/{id}/reactivate` | Use the source again |

A source is named by `kind` (`sensor_tool`, `upload` or `connector`) with
`sensor_id`, `tool` or `sender`, or by `integration_id` for a connector.
