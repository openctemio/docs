---
title: Prioritization
parent: User guide
nav_order: 6
---

# Prioritization

**CTEM stage 3.** After Scoping and Discovery comes the most important question:
**of the hundreds of open findings, which must be fixed first?** There are almost
always more findings than capacity to fix them, so ranking by CVSS alone is not
enough.

OpenCTEM combines several risk signals into one **priority class**, `P0` to
`P3`:

- **Severity**: critical, high, medium, low or info (usually tied to CVSS).
- **EPSS** (Exploit Prediction Scoring System): the probability (0 to 1) that a
  CVE is exploited in the **next 30 days**. A critical finding with a low EPSS
  can be less urgent than a high one that is being exploited in the wild.
- **CISA KEV** (Known Exploited Vulnerabilities): CVEs **known to be exploited**.
  Being in KEV is the strongest priority signal.
- **Reachability**: whether an attacker can actually reach the asset (internet
  accessible, reachable through tracked relationships, or on a modeled threat
  path).
- **Asset criticality** (critical, high, medium, low), the **crown jewel** flag
  and the business context described in
  [Scoping](03-scoping.md#how-business-context-raises-criticality).
- **Compensating controls** that protect the asset.

The pages are under **Prioritization** in the sidebar: **Exposure Chains**,
**Attack Paths**, **Threat Intel**, **Indicators (IOCs)**, **Detections**,
**Business Impact**, **Compensating Controls** and **Priority Rules**. The asset
risk score is tuned under **Settings › Findings & assets › Risk scoring**.

## Priority classes

| Class | Meaning |
|---|---|
| **P0** Immediate | Actively exploited and reachable |
| **P1** Urgent | High exploit probability and reachable |
| **P2** Scheduled | Moderate risk, or compensating controls in place |
| **P3** Track | Low risk; fix opportunistically |

How the platform decides, in order (the first match wins):

- **P0**: in KEV and reachable; or in KEV on a crown jewel.
- **P1**, with no compensating control: EPSS 0.5 or more and reachable; or EPSS
  0.1 or more, reachable, on a critical or high asset; or critical or high
  severity and reachable.
- **P2**: compensating controls in place and a notable risk (EPSS 0.01 or more,
  or critical or high severity); or critical or high severity but unreachable; or
  EPSS 0.1 or more and reachable; or medium severity and reachable.
- **P3**: everything else.

Then a few adjustments apply: a finding with significant business impact (for
example a high CIA rating or compliance impact) can move up one class (never
into P0); an AI-triage false-positive verdict can lower it one class; a finding on
an asset with **no owner** is never lower than P2; and a finding on an asset whose
ownership is **not yet confirmed** is held at P2 at most, so nobody is paged for
an asset that may not be yours. Informational findings are pinned to P3 and skip every adjustment. When nothing
says whether the asset is reachable, exploitation evidence (KEV, or high EPSS)
still raises a finding to P1, and other findings stay at P2 until reachability is
known. Finally, [priority rules](#priority-rules) can override the class.

Each class comes with a remediation deadline from your organization's
[SLA policy](08-mobilization.md#sla-policies). The platform defaults are P0 two
days, P1 five, P2 fifteen and P3 thirty; check the **SLA due** of the finding
itself for its actual deadline.

## The transparent priority score

To answer "why is this finding P1?", each finding's page has **Why it matters ›
How this was scored**: a score you can break down, not a black box.

> `Score = (Impact + Likelihood + Exposure) × (1 − ControlReduction)`

- **Impact** (0 to 5): the higher of the asset's criticality and the finding's
  severity, raised by the asset's CIA rating, plus 1 for a crown jewel and 0.5
  for high data exposure or compliance impact.
- **Likelihood** (0 to 5): 5 when the CVE is in KEV; otherwise EPSS × 5 (falling
  back to the EPSS percentile).
- **Exposure** (0 to 5): internet accessible is highest, then reachable or on a
  threat path, then network accessible; plus a bonus when it is reachable from
  several entry points.
- **ControlReduction**: the effect of compensating controls, clamped to 0 to 0.5,
  so controls cut the score by **at most half** and never to zero.

The result is between 0 and 15, shown as `x / 15` with the three sub-scores as
bars. The score **explains** the priority class; it does not change it. The
class still comes from the rules above and from your priority rules. It is
computed on request and is most useful when you need to defend "fix this before
that".

## Exposure chains and attack paths

Both pages read the relationships between assets, so they fill in as discovery
and relationship suggestions build the asset graph. With no relationships yet,
they say so and link to the assets.

![The Exposure chains page ranking chains from internet-facing entry points to assets with KEV findings]({{ site.baseurl }}/assets/images/user-guide/exposure-chains.png)
*Figure: Exposure chains.*

![The Attack paths page drawing the routes from the internet through an entry point and hops to a crown jewel, with choke points and the path score]({{ site.baseurl }}/assets/images/user-guide/attack-paths.png)
*Figure: Attack paths.*

- **Exposure Chains** (`/exposure-chains`): attack paths from internet-facing
  entry points to assets with KEV or critical findings, ranked by urgency. Each
  chain is the shortest path from a public entry point to such an asset. Hover to
  trace a path; click any node to open it. The cards show the entry points, the
  targets at risk and the chains shown. The page lists up to 100 chains; the
  figures on the cards count every chain you may see.
- **Attack Paths** (`/attack-paths`): how the internet reaches one asset.
  Pick the target at the top (crown jewels first; a chain on Exposure Chains
  opens its target here with **Open attack paths**). The graph runs left to
  right from **Internet** through entry points and hops to the target. Each
  edge names the finding that lets an attacker take that step and its weight;
  thicker lines are likelier steps.
  - **Shortest** shows the most likely shortest route; **All** shows every
    short route (up to 12; the footer says when there are more).
  - Hover or focus a step to light every route through it. With the keyboard,
    Tab into the graph, use the arrow keys to follow the edges, `[` and `]` to
    switch routes, Enter to open the findings of a step and Escape to clear.
    **List view** shows the same routes as a list; it is the default on a
    phone.
  - **Choke points** ranks the steps whose findings, once fixed, cut the most
    routes ("Fix this to cut 2 of 3 paths"). **View finding** opens the
    finding behind the step and **View N findings** opens exactly the N open
    findings on that asset. **Create task for choke point** puts the first
    one's finding in a remediation task.
  - **Path score** breaks the selected route into its step weights and their
    product, the path likelihood. A step weighs the open finding most likely to
    let an attacker onto that asset: its EPSS score, at least 0.9 when it is
    known exploited, and at least 0.5, 0.3, 0.1 or 0.05 for a critical, high,
    medium or low finding. A step with no open finding counts as 1: the
    relationship alone is taken to allow it. **How** on the page repeats this.

If the page cannot load the data it says so and offers **Retry**; that is
different from "No relationship data yet", which means the read worked and the
organization has no relationships.

### What you see when you can access only some assets

Paths follow the whole asset graph, but you only see assets in your scope. An
exposure chain is shown when its target is an asset you may see, and Attack
Paths opens only targets you may see. A step on the way that you may not see
appears as **Outside your access**, with no name, type, findings or weight, so
you can tell that your asset is reachable without learning what lies in
between. A route through such a step shows its likelihood as **Withheld**, and
the step is never a choke point.

## Threat intelligence

**Threat Intel** (`/threat-intel`) brings in external signal: exploit likelihood
(EPSS), known-exploited CVEs (CISA KEV) and tracked threat actors. It feeds the
KEV and EPSS badges you see across the console. **Refresh** reloads the data.

![The Threat intelligence page with EPSS and CISA KEV statistics]({{ site.baseurl }}/assets/images/user-guide/threat-intel.png)
*Figure: Threat intelligence.*

Tabs:

- **Threat landscape**: EPSS figures (**CVEs tracked**, **Critical risk** above
  30%, **High risk** above 10%, **High-risk rate**) and CISA KEV figures (**KEV
  entries**, **Past due**, **Added in the last 30 days**, **Ransomware
  related**), with the EPSS risk distribution and the KEV remediation status. Two
  cards explain EPSS and KEV and link to their sources.
- **Threat actors**: the adversary groups your organization tracks. **Add actor**
  records the name, aliases, motivation, sophistication, country of origin,
  target industries and regions, TTPs, MITRE group ID and references.
- **CVE lookup**: enter a CVE ID (format `CVE-YYYY-NNNNN`, for example
  `CVE-2021-44228`) to see its EPSS score, percentile and model version, and its
  CISA KEV entry (vendor and product, name, description, required action, due
  date), or "This CVE is not in the CISA KEV catalog".
- **Sync status**: each feed (EPSS, CISA KEV) with its last sync result, time,
  record count and next sync. Turn a feed on or off, or sync it now.

EPSS and KEV sync automatically; sync by hand only when you need fresh data at
once. This page is an input to prioritization; it does not change any finding's
priority by itself.

A finding follows the catalog in both directions. When its CVE leaves the CISA KEV
catalog (or the finding's CVE changes to one that is not in it), the finding loses
its KEV flag and the KEV due date, so the KEV floor of P0 or P1, the shorter
KEV deadline and the KEV count on the dashboard no longer apply to it. A failed
catalog lookup keeps the stored value instead of clearing it. A deadline already
set while the finding was in KEV stays, because deadlines only ever tighten. If
the SLA policy cannot be read (a database error, as opposed to no policy being
set up), the deadline is not set on that pass and is retried on the next one,
rather than falling back to the platform defaults; with no policy set up, the
platform defaults apply.

### Indicators and detections

- **Indicators (IOCs)** (`/threat-intel/iocs`): indicators of compromise, matched
  against runtime telemetry to reopen the findings they belong to. **Add IOC**
  takes the value (for example `203.0.113.10`), its type, source and confidence
  (0 to 100). Open an indicator to see its source finding, first seen and runtime
  matches.
- **Detections** (`/threat-intel/detections`): runtime detections from your EDR,
  XDR or SIEM that matched a known indicator. A match on a resolved finding
  reopens it. Detections appear when a collector sensor forwards a matching
  runtime event.

Both need the threat-intel read permission and the IOCs module.

## Business impact

**Business Impact** (`/business-impact`) shows where vulnerabilities hit the
business hardest: by asset criticality, crown jewel and business unit. It is a
read-only summary.

1. The cards: total assets, critical findings, critical assets and average CVSS.
2. **Asset criticality**: how assets spread across the criticality levels.
3. **Crown jewels**: the most valuable assets with their findings and risk. If
   none are designated yet, mark them from the Crown jewels page.
4. **Business units**: each unit's assets, critical findings, findings and
   average risk. If none exist yet, create them in Scoping.

The figures come from your real asset and finding data. For them to reflect the
business, designate crown jewels and map assets to business units in
[Scoping](03-scoping.md#business-context). Asset risk scores come from
[risk scoring](#risk-scoring).

## Compensating controls

**Compensating Controls** (`/controls`) records controls that hold down the
priority of findings on the assets they protect when a fix is not possible yet
(for example a WAF rate limit in front of a vulnerable service).

1. Click **New control**. Enter the **Name** (for example "WAF Rate Limiting"),
   a description, the **Control type** (Segmentation, Identity, Runtime,
   Detection or Other) and the **Risk reduction (%)** (1 to 100).
2. **Link assets**: a control only affects the assets linked to it. Linking or
   changing a control re-classifies the findings on those assets.
3. **Test** records a test result (pass, fail or partial) and updates **Last
   tested**.
4. Delete a control from its row (this cannot be undone).

The table shows each control's type, status, reduction, last test and result.
Creating, testing and deleting needs the compensating-controls write permission.

{: .note }
The reduction percentage does not scale the priority class. The classifier only
asks whether an asset has an effective control: a reachable critical finding
moves from P1 to P2 whether the control reduces risk by 5% or 90%. The
percentage is shown in the reason ("Compensating controls present (reduction:
30%)") and used by the transparent score.

## Priority rules

**Priority Rules** (`/priority-rules`) overrides the computed priority class with
your organization's policy, for example "anything in KEV on a crown jewel is
P0".

![The Priority rules page with three rules, their conditions, target class and evaluation order]({{ site.baseurl }}/assets/images/user-guide/priority-rules.png)
*Figure: Priority rules.*

How evaluation works:

- Rules are evaluated by **evaluation order, highest first**.
- The **first active rule whose conditions all match** sets the finding's class;
  later rules are skipped.
- Inactive rules are skipped.
- A rule needs at least one condition. Each condition must use a known field, an
  operator that field supports and a value of the right type; the API refuses
  anything else.

Condition fields:

| Field | Meaning | Operators | Values |
|---|---|---|---|
| Is in KEV catalog | The CVE is in CISA KEV | `=`, `!=` | true / false |
| Is reachable | The finding is reachable | `=`, `!=` | true / false |
| Asset is crown jewel | The asset is a crown jewel | `=`, `!=` | true / false |
| EPSS score | EPSS score (0 to 1) | `=`, `>=`, `<=` | a decimal, for example `0.5` |
| Severity | Finding severity | `=`, `!=`, `in` | critical, high, medium, low, info |
| Asset criticality | Asset criticality | `=`, `!=`, `in` | critical, high, medium, low |

The `in` operator takes a comma-separated list, for example `critical, high`.

To create a rule:

1. Click **Create rule** (needs the priority-rules write permission).
2. Enter the **Name** (for example "KEV on crown jewel → P0") and a
   **Description**.
3. Pick the **Target priority class** (P0 to P3), the **Evaluation order**
   (default 50; higher runs first) and whether it is **Active**.
4. **Add condition** for each condition. The operator list and the value input
   follow the field's type.
5. Click **Dry run** to preview, then save.

The table lists the rules in evaluation order with their target class,
conditions, order and an **Active** switch. Each row's menu has **Edit**, **Dry
run** and **Delete** (permanent).

**Dry run** previews which findings the rule would re-classify, without changing
anything. The server evaluates the full rule (severity, EPSS, KEV, asset context,
compensating controls) exactly as a live classification would, and shows the
would-be priority distribution and a sample of findings with their current and
new class. It also works on a rule you have not saved yet.

Saving, changing or deleting a rule re-classifies the organization's findings
automatically in the background.

## Risk scoring

**Settings › Findings & assets › Risk scoring** (`/settings/risk-scoring`) sets how each
**asset's risk score** (0 to 100) is computed. The score answers "how urgently
does this asset need work". It is shown across the console and drives pages
such as Business Impact.

The default model reads risk as likelihood times impact:

> `Risk = findings score × exposure % × criticality % × (1 − compensating control reduction)`

- **Findings score**: the worst open severity sets it, with diminishing returns
  for more findings of the same severity, so many low findings never outrank one
  high. A finding in CISA KEV, with EPSS of 0.5 or more, or with a known exploit
  counts one severity higher. Informational findings add nothing.
- **Exposure %** and **criticality %** scale that score. An asset whose exposure
  is unknown is not treated as safe, and a criticality that is not rated counts
  as medium. A crown jewel counts as critical, and an asset takes the highest
  criticality of its business units and services.
- **No open finding means "No open risk" (0)**, in every model: exposure and
  criticality are not risk on their own.

The asset page's **Why this score?** shows the figures of the formula and the
findings that drive the score. A small clock next to a score means one of its
inputs changed and the new score is being computed; it clears within seconds.
**Score last changed** on the asset page is when the score last moved.

The other compositions (**Multiply**, **Amplify headroom**, used by the Legacy
and industry presets) add weighted exposure, criticality, findings and CTEM
points, then apply the exposure multiplier:

> `Score = (Exposure × W1 + Criticality × W2 + Findings × W3 + CTEM × W4) × Multiplier`

They follow the same rule: an asset without an open finding scores 0.

1. **Presets**: start from Legacy, Default, Banking, Healthcare, E-commerce or
   Government. Any manual change makes the preset **Custom**.
2. **Component weights**: Exposure, Criticality, Findings and CTEM. They always
   add up to 100%; moving one rebalances the others. Putting the whole weight on
   CTEM while the CTEM bonus points are off is refused, because every asset would
   score 0.
3. **Exposure scores**: the base score (0 to 100) for Public, Restricted,
   Private, Isolated and Unknown, with a **multiplier** (0.1 to 3.0) for each
   (above 1 amplifies, below 1 reduces), and the **Score composition** mode.
4. **Criticality and risk levels**: the score for each criticality (Critical,
   High, Medium, Low, None) and the **Risk level thresholds** (the minimum score
   for Critical, High, Medium and Low). Thresholds must be ordered Critical >
   High > Medium > Low > 0; otherwise saving is blocked.
5. **Finding and CTEM impact**:
   - **Finding impact** **Mode**: **Count-based** (fixed **Per-finding
     points**) or **Severity-weighted** (points per severity), with a **Finding
     cap** so that a heavily scanned asset is not scored unfairly high.
   - **CTEM bonus points**: when **Enabled**, adds points for Internet
     Accessible, PII Exposed, PHI Exposed, High Risk Compliance and Restricted
     Data.
   - **Unowned findings floor**: **Floor unowned findings at P2**.
6. **Preview changes**: **Preview impact** shows how a sample of assets would
   change (current, new, delta). Nothing is written.
7. **Save changes** (enabled only when the weights add up to 100% and the
   thresholds are ordered). **Reset** discards unsaved edits.
8. **Recalculate scores**: **Recalculate all scores** applies the **saved**
   configuration to every asset. It asks for confirmation and cannot be undone;
   save first.

Risk scoring ranks **assets**; priority rules decide the class of **findings**.
The two work together.
