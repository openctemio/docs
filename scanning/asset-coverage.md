---
title: Automatic coverage
parent: Scanning
nav_order: 3.6
---

# Automatic coverage
{: .no_toc }

**Automatic coverage** gives every asset your scope covers the checks its
type needs, on a schedule and when the asset appears, with no scan to set
up. It keeps a ledger of each asset and check, so a check that goes missing
is visible instead of silently skipped.

1. TOC
{:toc}

---

## Turning it on or off

**Settings > Scanning > Scope policy > Automatic coverage**. It is on by
default, except while the organization's scan approval is **Strict**, where
it stays off until you turn it on. Scope, exclusions, scan windows and the
platform guardrails still decide what may be scanned, and intrusive (T2)
checks never run this way.

The platform operator can turn the loop off for the whole installation
(`ASSET_COVERAGE_ENABLED`, default `true`) and caps each organization at
`ASSET_COVERAGE_DAILY_BUDGET` checks per 24 hours (default 5000); see
[Environment variables](../configuration/environment-variables.md).

## What each asset gets

| Asset type | Check | How often | Only when |
|---|---|---|---|
| Domain | Passive subdomain discovery (`discover.subdomains`) | daily | a scope entry covers it |
| Domain | Active subdomain enumeration (`enumerate.subdomains`) | every 7 days | a scope entry covers it |
| Domain | DNS resolution, e-mail security posture | daily | |
| Domain | Registration lookup (RDAP) | every 7 days | |
| Subdomain | DNS resolution, dangling DNS check | daily | |
| Subdomain | Port scan (top 1,000 ports) | every 7 days | it resolves |
| Subdomain | HTTP probe | every 3 days | it resolves, and an address it resolves to may carry a web service, a web origin of it was seen, or its ports are not known yet |
| IP address | Network lookup (ASN), port scan (top 1,000 ports) | every 7 days | |
| Open port | HTTP probe | every 3 days | it is a web port |
| Web service | Vulnerability templates | every 7 days | no web service reached by a host name serves the same address and port |

A new asset, or one whose condition holds again, is due at once. The two
kinds of subdomain discovery are explained in
[Attack surface monitoring](easm.md#two-kinds-of-subdomain-discovery); the
port depth and the `<name>:<port>` probes in
[Ports and web services](easm.md#ports-and-web-services).

## How the runs look

Coverage runs on a managed scan per check, named "Continuous coverage:
*capability*". Under **Discovery > Scans**, these scans are listed read-only
in **Managed by continuous coverage**, with links to the coverage settings and
to their runs. Nobody can edit, run, schedule or delete them; **Clone as my
scan** makes an ordinary copy you own.

Their runs are system runs: **Discovery > Scans > Runs** opens on runs
started by people, and one line says how many runs continuous coverage
started, with **Show system runs**. The **Origin** filter (**People**,
**System**, **All**) shows them; the API is
`GET /api/v1/scan-runs?origin=user|system`, and each row carries
`managed_by`.

A check's batch starts when it fills one task of its tool, or when its
oldest due asset has waited a tenth of the check's cadence (at most 6
hours). So coverage starts a few full runs instead of many runs of a few
targets. A scan a person starts is never held this way, and an exclusion
still stops the work at the claim.

## The Coverage section of an asset

The asset's **Coverage** section (under **Details**) lists each check its
type needs, with its state, why, when it last succeeded and whether it is a
gap. A check is a **gap** when it applies and has gone without a success for
more than twice its cadence.

| State | Means |
|---|---|
| **Covered** | The last check ran and settled the asset |
| **Due**, **Running** | Waiting for its batch, or in a run now |
| **Failed** | The check observed the target refusing it: blocked, challenged or rate limited by an edge (WAF or CDN). Retried with a back-off |
| **Not checked** | The check could not run on the scanner side (no task carried the target, the run stalled, the tool or the sensor's network or proxy failed, the run did not finish the target). It says nothing about the asset and never counts as the asset failing |
| **Blocked** | The scope gate, a guardrail, placement or the budget kept it from running; the reason names which. Never a gap |
| **Paused** | The check cannot run for your organization now (see below), or the target did not answer |
| **Not applicable** | A condition in the table above does not hold; the reason names it |

**Targets that do not answer.** A target that times out or cannot be reached
is checked again after 1 day, 3 days, then weekly, as long as the same scan
zone or sensor still finds it silent; another zone or sensor gets the short
recheck again, and a success clears it. The section says *unreachable from
your sensors*, or names your own zone or sensor that tried (a platform
sensor is never named). Such targets count as unreachable, not as gaps.

**Names that do not resolve.** A DNS check that finds no address settles the
name as checked with "no answer" and parks it: port scans, HTTP probes and
templates are not sent to it, and its DNS is checked again after 1 day, 3
days, 7 days and then weekly. A parked name is never a gap. When it resolves
again, its checks pass the full scope gate again, so a name taken over by
someone else is refused there. Another check whose target the sensor could
not resolve is held as *unresolvable* on the same schedule.

## When a check is paused

Before a batch becomes a run, the platform checks whether the check could
run for your organization at all. If not, its assets are paused with the
first reason that applies, and nothing is started:

| Reason | Fix |
|---|---|
| The check's tool is switched off, or an organization policy refuses the run | **Settings > Scanning > Tools**, or the policy named |
| No active scope entry | Add scope entries |
| No sensor reports the tool, or the sensors' grant or local policy does not allow it | Install the tool, or widen the grant or policy |
| Sensors with the tool are offline, or too old | Start or upgrade them |
| No online sensor, or no scan zone can place the run | Pair a sensor, or fix the zones |
| Content missing (for example the wordlist pack of subdomain enumeration) | An instance administrator imports the pack |
| No sensor took its last runs | See below |

Paused assets become due again on the first pass where the check can run.

**Runs no sensor takes.** After 3 coverage runs of one check in a row end
with no sensor taking the work, the check is paused for your organization
with *no sensor took its last runs*. It resumes by itself when your sensors,
their grants or local policies, your zone assignments or the shared-sensor
setting change, or with one trial run after 2 hours (doubling after each
further unclaimed run, at most 48 hours). **Why waiting?** on a task of a
recent run usually names the cause ([Why a task waits](why-waiting.md)).

## Alerts

Administrators get coverage alerts in-app and on the notification channels
that take the coverage event: a gap, a check that keeps failing (the last 3
or more observations of a target failed; never a scanner-side failure), a
check that produces nothing, a paused check, and unreachable targets. Each
alert carries counts and check names only, never host names, and links to
where the fix is.

- There is at most one open alert per check and kind. It is sent when the
  condition appears, and again only when it gets clearly worse: the count at
  least doubles and grows by 5 or more, at most once a day. A count going
  down updates the alert without notifying.
- A condition that clears and comes back within three days comes back
  silently.

Scanner-side failures go to the platform operator instead: the metrics
`openctem_asset_coverage_platform_failures_total{capability,outcome}` and
`openctem_asset_coverage_platform_failing_pairs{capability,outcome}`, and an
alert to the platform administrators when a check's count appears or gets
clearly worse (counts only, no organization or asset names).

## Coverage and closing findings

A coverage run that covered a host can close the findings it no longer finds
there, under your organization's closing mode. Hosts it did not finish, or
that blocked it, close nothing. See [Closing findings](../user-guide/closing-findings.md).
