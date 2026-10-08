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
risk score is tuned under **Settings › Policies › Risk scoring**.

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
an asset that may not be yours. Finally, [priority rules](#priority-rules) can
override the class.

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

- **Exposure Chains** (`/exposure-chains`): attack paths from internet-facing
  entry points to assets with KEV or critical findings, ranked by urgency. Each
  chain is the shortest path from a public entry point to such an asset. Hover to
  trace a path; click any node to open it. The cards show the entry points, the
  targets at risk and the chains shown.
- **Attack Paths** (`/attack-paths`): assets ranked by how many public entry
  points reach them. Patching or isolating the top-ranked asset breaks the most
  attack paths. The page also shows the crown jewels at risk, the maximum chain
  depth and the top entry points.

## Threat intelligence

**Threat Intel** (`/threat-intel`) brings in external signal: exploit likelihood
(EPSS), known-exploited CVEs (CISA KEV) and tracked threat actors. It feeds the
KEV and EPSS badges you see across the console. **Refresh** reloads the data.

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

**Settings › Policies › Risk scoring** (`/settings/risk-scoring`) sets how each
**asset's risk score** (0 to 100) is computed. The score is shown across the
console and drives pages such as Business Impact.

> `Score = (Exposure × W1 + Criticality × W2 + Findings × W3 + CTEM × W4) × Multiplier`

Each component produces 0 to 100 and is weighted by its percentage; the exposure
multiplier adjusts the result, which is clamped to 0 to 100. When CTEM is turned
off, its weight is spread over the other components.

1. **Presets**: start from Legacy, Default, Banking, Healthcare, E-commerce or
   Government. Any manual change makes the preset **Custom**.
2. **Component weights**: Exposure, Criticality, Findings and CTEM. They always
   add up to 100%; moving one rebalances the others.
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
