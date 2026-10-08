---
title: Scan zones and pools
parent: Sensors
nav_order: 5
---

# Scan zones and pools

A **scan zone** is a set of address ranges plus the sensors that can reach
them. Zones answer "which sensor can reach this address"; [scope](../scanning/scope.md)
answers "may we scan it". Zones are optional: an organization without zones
sends work to any of its sensors that has the tool.

Manage zones under **Discovery > Sensors**, tab **Scan zones**, or with
`/api/v1/scan-zones`.

## A zone is also the sensor pool

There is no separate pool object. The sensors assigned to a zone share its
work: any of them may claim a command routed to the zone. Adding a sensor
adds capacity; a sensor that stops claiming leaves its work to the others
(its leases run out and another sensor of the zone takes the command). Work
routed to a zone never leaves it.

Keep the two ideas apart:

- **Zones** are infrastructure: who can reach which ranges and who shares the
  work.
- **Asset groups and scan targets** are scope: what a scan covers.

## Ranges

A zone's ranges are addresses, CIDRs or inclusive ranges `a-b`. Rules:

- at most one **default zone** per organization; only the default zone may
  have no ranges;
- ranges overlapping loopback, link-local and cloud metadata, multicast and
  reserved space (`0.0.0.0/8`, `127.0.0.0/8`, `169.254.0.0/16`,
  `224.0.0.0/4`, `240.0.0.0/4`, `::1/128`, `fe80::/10`, `ff00::/8`) are
  refused;
- IPv4 ranges wider than `/8` and IPv6 wider than `/32` are refused;
- at most 256 prefixes per zone and 500 zones per organization.

Private addresses (RFC 1918, ULA) can be scan targets only when a zone covers
them. The sensors of that zone must also allow private targets
(`SENSOR_ALLOW_PRIVATE_TARGETS=1`).

## How a target is routed

When a scan is triggered, after scope checks, each target is assigned:

| Target | Goes to |
|---|---|
| An address or CIDR | The zone with the **narrowest** range holding all of it |
| A host name | Resolved by the platform; the narrowest zone holding any of its addresses |
| A public address in no range | The default zone; without one it is unzoned and goes to any of the organization's sensors |
| A private address in no range, a CIDR only partly in a zone, a name that does not resolve or resolves to a refused address | **Uncovered**: not scanned, listed in the run's warnings |

Code, dependency, secret and image scans (targets that are repositories,
files or containers) are not network scans and are not routed.

Targets of a zone are batched into commands and left for the zone's sensors
to claim. A zone whose sensors are all offline keeps its commands waiting for
one of them (with a warning on the run). A run that leaves targets uncovered
ends `partial`, never `completed`. If no target is left, the trigger fails
with `NO_ZONE_COVERAGE`.

A **workflow scan** runs as one unit, so all its routed targets must fall in
one zone (or all be unzoned); otherwise the trigger fails with
`ZONE_SPLIT_REQUIRED`.

## Pin a scan to a zone

A scan can select one zone instead of **Automatic**. Its targets then go to
that zone only, even when a narrower zone also holds them; every other target
is uncovered with the reason "outside the selected scan zone". Pinning is also
how to run a workflow scan on targets that would otherwise need splitting.

## Preview and coverage

![The Scan zones tab with one zone, its ranges, sensors and the coverage summary]({{ site.baseurl }}/assets/images/sensors/scan-zones.png)
*Figure: Scan zones and coverage.*

- **Routing preview** (`POST /api/v1/scan-zones/preview`) runs the trigger's
  target resolution, scope exclusions, routing and batching for a scan about
  to be created, without creating anything. The new-scan screen shows it.
- **Coverage** (`GET /api/v1/scan-zones/coverage`) counts inventory addresses
  inside zones, public outside every zone, and private outside every zone
  (which scans skip), with warnings such as a zone without sensors.

## Freeze windows

A **freeze window** holds active scan work (port scans, HTTP probes,
templates, DAST, validation) for the whole organization or for one zone, for
maintenance or change freezes. Passive work (subdomain discovery, DNS, code
and dependency analysis) and ingest are never held.

- Manage them in **Settings > Policies > Scan freeze windows**
  (`/api/v1/scan-freeze-windows`): one-off (up to 31 days) or weekly, in a
  time zone you choose; at most 50 per organization.
- During a window, held commands are neither offered nor claimable; work a
  sensor already holds keeps running.
- A scheduled run that falls in a window is deferred to the window's end.
  Any other trigger is refused with `SCAN_FREEZE_ACTIVE`, unless a member with
  the freeze-override permission (owners and administrators by default)
  overrides it; overrides are audited.

## Assign sensors

Assign a sensor to a zone from the zone, or choose the zones when you
[approve a pairing](pairing.md). A sensor can be in several zones. Its
[grant](pairing.md#grants-and-trust) can narrow the zones further. Platform
sensors cannot be assigned to an organization's zones.

## Network paths

A zone has no network path of its own: its sensors reach its ranges directly,
or through whatever proxy their environment sets. Per-zone egress proxies are
planned; see [Network requirements](network.md#proxies).
