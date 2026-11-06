---
title: Asset liveness
parent: Results and findings flows
grand_parent: How it works
nav_order: 7
description: How OpenCTEM tells an unreachable or unresolvable asset from one that is gone, and what that does to its findings.
---

# Asset liveness
{: .no_toc }

Every coverage check that runs against an asset also says whether the asset
answered. OpenCTEM keeps that per asset and shows a liveness state beside
the asset's status. One check never decides anything: a state needs several
checks over a minimum time.

1. TOC
{:toc}

## States

| State | When | What happens to findings |
|---|---|---|
| Alive | a check got an answer. A CDN or WAF that blocked the check counts as an answer | nothing |
| Unreachable | 3 checks in a row got no answer over at least 72 hours, although the name resolves | stay open, labelled "cannot verify"; the SLA keeps running |
| Unresolvable | the name had no address (NXDOMAIN) or the lookup failed (SERVFAIL) twice over at least 12 hours | stay open, labelled; the SLA keeps running |
| Gone | the name had no address 3 times over at least 72 hours seen by two scan zones or sensors, or over 7 days seen by one, and the dangling DNS check found nothing | close as **Asset gone (not fixed)** if your organization turned it on |
| Not checked | no active check has looked at it yet | nothing |

Liveness is separate from **Stale** (no source has re-observed the asset)
and from the decisions people make (out of scope, not ours, retired).

## Dangling names are never gone

A name whose CNAME points at a target with no address also answers
NXDOMAIN. Such a name is still yours and can be taken over: it stays
**Unresolvable** with the reason "dangling", keeps being re-checked, and the
takeover risk is its own finding.

## Findings of a gone asset

With **Settings > Asset lifecycle > Close findings of assets that are gone**
on, the open findings of a gone asset (version-match findings included)
close as resolved with the reason **Asset gone (not fixed)**. They never
count as fixed. When the name resolves or the asset answers again, they
reopen to the status they had, with their SLA deadline kept, and are not
counted as regressions. A finding a person closed afterwards is left alone.

Every close and reopen is on the finding's timeline and in the audit log.
Owners and administrators are told when findings close. At most 50 assets
with open findings become gone per day by default, so a broken resolver
cannot close everything at once.

A person can keep an asset from being marked gone by setting its status by
hand or snoozing its lifecycle.

## Settings

Under **Settings > Asset lifecycle**:

| Setting | Default | Lowest allowed |
|---|---|---|
| Close findings of assets that are gone | off | |
| Unreachable after (checks) | 3 | 2 |
| Unreachable after at least (hours) | 72 | 24 |
| Gone after (hours, two sensors) | 72 | 24 |
| Gone after (hours, one sensor) | 168 | 72 |
| Assets with findings marked gone per day | 50 | 1 |

Turning closing on or lowering a value needs a recent sign-in, is audited
and the owners are told. Run the **dry run** first: it shows how many
assets are in each state and how many findings would close and reopen,
and writes nothing.

## Where you see it

- Inventory: a badge beside the status, and the **Liveness** filter.
- Asset page and asset panel: the badge, with since when, why, and which
  scan zone or sensor checked last.
- Finding drawer: "Unreachable since 3 Nov 2026. Last checked 2 days ago by
  edge-sensor-1", and what it means for the finding.
