---
title: Insights and reports
parent: User guide
nav_order: 9
---

# Insights and reports

The **Insights** section of the sidebar turns what the platform tracks into
dashboards for different audiences: **Program Health**, **Data Quality**,
**Executive Summary**, **CTEM Maturity**, **Reports** and **Compliance**. These
are views: you look, filter and export; you change data elsewhere.

Most dashboards need the dashboard read permission. Some are modules: if a
module is off you see "Module not enabled", and if you lack the permission you see
a "You don't have access" message rather than the numbers.

## Program health

**Insights › Program Health** (`/insights/program-health`) is the **outcome
scorecard**: is risk being retired (urgent things fixed in time, inventory owned,
exposure falling), rather than how much activity there is.

- Choose the **Period**: Last 30 days, Last 90 days or Last year.
- Each metric shows its value, its target and a status: **On track**, **Watch**,
  **Off track** or **Not measured** (not enough data yet; never a made-up
  number):
  - P1 remediation completion and time to remediate (P1);
  - asset owner coverage;
  - remediation re-open rate and P1s rediscovered in scope;
  - SLA compliance;
  - exposure-count trend;
  - validation downgrade % (the share of validated findings that were
    downgraded, see [Validation](07-validation.md#re-verify-a-finding)).
- **Exposure over time**: open findings across the period. A healthy program
  bends this curve down. It needs at least two risk snapshots.
- **Activity (context, not goals)**: total open findings, new this period and
  resolved this period. Useful for context, but not what the program is judged
  on.

How each metric is defined is documented in
[Program metrics](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/program-metrics.md).

## Data quality

**Insights › Data Quality** (`/insights/data-quality`) shows whether the
inventory is owned, evidenced and fresh enough to prioritize on: the inputs the
rest of the CTEM loop trusts.

- **Asset owner coverage**, **Finding evidence coverage**, **Inventory
  freshness** and **Stale assets** (assets not observed again for 30 days), each
  with a target and a status.
- **Inventory context**: total assets, total findings, deduplication merges and
  the median last-seen age of internet-exposed assets.

Use it to tell whether the attack surface is scanned often enough.

## Executive summary

**Insights › Executive Summary** (`/insights/executive`) is the leadership view
of risk posture, remediation performance and process health.

1. Choose the **Period**: Last 30 days, Last 90 days or Last year.
2. The headline cards: **Risk score** (with the change from the previous period),
   **Findings resolved**, **SLA compliance**, **P0 open**, **P1 open**, **Crown
   jewels at risk** (high-value assets exposed), **MTTR critical** and **MTTR
   high**.
3. **Top risks**: the highest-priority findings that need executive attention,
   with severity, priority class, asset, EPSS and KEV.
4. **MTTR by severity** and **MTTR by priority class** (P0 to P3).
5. **Process health**: **Approval avg time**, **Stale assets**, **Findings
   without owner** and **Avg time to assign** (from finding creation to owner
   assignment).

MTTR and process health are always computed over the last 90 days, whatever the
period you choose. With too little data you see messages such as "No top risks
for the selected period" or "MTTR appears once enough findings have been
resolved".

## CTEM maturity

**Insights › CTEM Maturity** (`/insights/ctem-maturity`) scores program maturity
as a transparent, weighted composite across your **closed** CTEM cycles:
`score = Σ (component score × weight)`. Every component and its weight is shown,
so you can check the number by hand.

- The components: **Validation coverage**, **Resolution throughput**, **MTTR
  trend**, **Priority stability** and **Scope stability**.
- **Metric trends** across cycles.
- **CTEM stage coverage** (Scoping, Discovery, Prioritization, Validation,
  Mobilization), reported next to the score but not part of it.

It needs the CTEM cycles module. Until you close a first cycle, the page says "No
maturity data yet": activate a cycle, work it and close it.

## Reports

**Insights › Reports** (`/reports`) has two tabs.

### Program

- **Executive summary**: program-level risk, findings, SLA and MTTR for a window
  you choose (Last 7, 30 or 90 days). Click **Download CSV**.
- **Scheduled reports**: recurring digests emailed to recipients.
  1. Click **New schedule**.
  2. Enter a **Name** (for example "Weekly exec digest") and pick the **Report
     type**: **Executive Summary**, **Summary Digest** or **Findings Digest**.
     The format is an HTML email digest.
  3. Choose the **Cadence** (Daily, Weekly, Monthly, or a standard five-field
     **Cron expression**), the **Time**, the day where it applies, and the
     **Timezone**. The dialog shows the next runs.
  4. Add the **Recipients** (at least one email address) and save.

  Each schedule shows when it last ran and can be deleted.

The platform does not keep a library of generated report files: Reports means
*export now* and *email on a schedule*.

### Pentest

The **Pentest** tab (with the pentest module and permission) lists the reports
generated for pentest campaigns, with **Generate report**, download and preview.
See [Validation](07-validation.md#reports).

## Compliance

**Insights › Compliance** (`/compliance`) shows how far each compliance
framework's controls are implemented, so exposure work can be tied back to the
controls it satisfies.

1. The cards: **Frameworks**, **Controls** (with the number implemented), **Avg
   compliance** and **Overdue**. Avg compliance is the score of the selected
   framework (or the first framework when none is selected).
2. The **Frameworks** tab shows one card per framework with its score and the
   number of controls **Implemented**, **Partial**, **Missing** and **N/A**.
   Click a card to see its controls.
3. The **Controls** tab lists controls with their framework, status, priority and
   evidence. Search, and filter by framework and status (Implemented, Partial,
   Not implemented, N/A).
4. Click a control for its description, evidence, open findings, owner, due
   date, last assessment and notes.
5. **Update status** sets the **Status**, **Priority**, **Owner**, **Due date**
   and **Notes**; click **Save changes**. This needs the compliance assessment
   write permission.
6. **Export** downloads the current framework's filtered controls as CSV.

A framework's score is (Implemented + Partial × 0.5) ÷ Total, where the total
includes N/A controls and an unassessed control counts as not implemented.
Frameworks appear once they are configured; until then the page says "No
frameworks yet".
