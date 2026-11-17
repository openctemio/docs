---
title: Emerging threats
parent: User guide
nav_order: 6.5
---

# Emerging threats

See how it works: [Emerging threat alerts](../how-it-works/vulnerability-intel/emerging-threat-alerts.md).

**Emerging threats** (`/emerging-threats`, in the sidebar under
**Prioritization**) answers one question: does this new vulnerability hit us?
It lists the vulnerabilities that were just published or just became exploited
and that match software your assets run, ranked by how likely they are to hurt
you now.

There is one alert per vulnerability, never one message per asset. Every
number of an alert counts hosts (see [How an alert counts](#how-an-alert-counts)).
The page
needs the permission `findings:vulnerabilities:read` and the **Threat intel**
module, and shows only alerts that have at least one asset in your data scope.

## What starts an alert

The platform watches the public facts about each vulnerability: it is
published, its affected versions change, its severity goes up, it is added to
the known exploited list (KEV), its exploit likelihood (EPSS) crosses a
threshold, or the source rejects it. When such a change touches a product
version your assets run (see [Vulnerability matching](vulnerability-matching.md)),
the platform opens one alert for your organization. An alert also opens for an
asset whose product matches but whose version is unknown. If nothing you run
is affected any more, the alert resolves by itself. A rejected vulnerability
resolves its alert too.

## The list

- **Summary cards** count **Open**, **Immediate**, **Digest**, **Listed**,
  **Known exploited** and **Internet-facing** alerts. Each opens the list
  filtered to it.
- Filters: **Level**, **State** (**Open (not closed)** or a state), **Match**
  (**Confirmed** or **Possible**), **Internet-facing only**, and a search by
  vulnerability id. The filters are in the address, so you can share a view.
- Columns: **Threat**, **Score**, **Level**, **Affected** (the hosts in words,
  for example "3 hosts confirmed", "+1 likely", "+2 possibly affected", then
  the internet-facing hosts and the crown jewels; zeros are left out),
  **Exploit status** (KEV, ransomware use, EPSS), **State**, **Match** and
  **Last change**.
- A row opens a drawer with the same numbers (**Hosts confirmed**, with likely
  and possibly affected beside it, **Internet-facing**, **Crown jewels**), the
  affected products with the hosts per version, and the most important
  affected hosts, one row per host with its services.

The **Emerging threats affecting you** widget on the dashboard shows the open
alerts by level; each level opens this list filtered to it.

## Score and level

Each alert has a score from 0 to 100. The page shows how it is made up:
**Severity**, **Exploitation**, **Exposure** and **Freshness**, and a
**Confidence** multiplier that lowers the total when the match is uncertain.

The score decides the level, and the level decides who is told:

| Level | Meaning |
|---|---|
| **Immediate** | The score is at or above the immediate threshold: administrators are alerted as soon as it is found |
| **Digest** | The score is at or above the digest threshold: included in the daily digest |
| **Listed** | Shown on this page only, no message |

By default an immediate alert needs a confirmed affected asset. A recommended
action is shown with each alert: **Patch now** (known to be exploited and your
assets are confirmed affected), **Patch within your SLA** (not known to be
exploited yet) or **Confirm first** (your assets may be affected but the
version is not certain).

## An alert page

An alert (`/emerging-threats/{id}`) shows the score breakdown, the
recommended action, the facts about the vulnerability (CVSS, EPSS, KEV with the
date it was added, use by ransomware, published date), **What changed** (the
public events with their dates) and the affected assets in three groups:
**Confirmed affected**, **Likely affected** and **Possibly affected (version
unknown)**. A group appears only when it has a row, and its count is the
number of rows.

A row is a host. A host that serves several ports has one service asset per
port, each named by its URL (`http://host`, `https://host`); these share the
host's row, and each service is a link to its own asset (`http`, `https`, or
`https:8443` for a port that is not the default). The row shows the products
and the versions seen, the highest criticality of its services, whether any of
them is internet-facing, and the finding and remediation task of each service.
An asset that is not named by a URL is a row of its own.

Assets outside your data scope are never listed.

## How an alert counts

Every number of an alert counts hosts, the rows of the alert page, everywhere:
the list, the drawer, immediate messages, the daily digest and the digest
e-mail.

- A host that serves several ports is one host. A server with ports 80 and 443
  has two service assets (`http://host`, `https://host`) and counts once.
- **Confirmed** means confirmed only: an open finding with a version match of
  80% confidence or more. **Likely** (a version match below that) and
  **Possibly affected** (the product is known, the version is not) are their
  own numbers and are never added to confirmed.
- **Internet-facing** and **Crown jewels** count the hosts with a service that
  is internet-facing, or of criticality critical, each host once.
- You count only hosts in your data scope, so two members can see different
  numbers for the same alert.
- A message says the numbers in the same words as the console, for example
  "3 hosts confirmed, 1 likely, 2 possibly affected, 2 internet-facing". Parts
  that are zero are left out.
- An alert you were already told about comes back in the digest only when it
  reaches a new host, or when a host moves to a stronger group (possibly
  affected to likely or confirmed, likely to confirmed). One more port found
  on a host you already know about does not.

The score does not depend on these counts. Its **Exposure** part is the most
exposed single affected asset (internet-facing, crown jewel), not a sum.

## Act on an alert

Changing the state needs `findings:triage`:

| Action | Effect |
|---|---|
| **Acknowledge** | You have seen it |
| **Mark remediating** | Work is under way |
| **Mark not affected** | Hides the alert and stops messages about it for 180 days. Choose a reason: the match is the wrong product, the versions you run are not affected, the affected feature is not used, a compensating control is in place, or the asset is decommissioned. A stronger match, or the vulnerability being added to the known exploited list, reopens it. You can only do this when every affected asset is in your data scope. |
| **Reopen** | Back to **New** |

**Create remediation task** (needs `findings:remediation:write`) opens one task
with the alert's open findings. A finding that is already in an active task is
listed and left there, because a finding belongs to at most one task. See
[Mobilization](08-mobilization.md).

State changes are audited.

## Settings

**Settings > Findings & assets > Risk and threats > Emerging threats**
(`/settings/emerging-threats`) is for owners and administrators.

| Setting | Meaning | Default and range |
|---|---|---|
| **Emerging-threat alerts** | Off: no alerts are created and no messages are sent | On |
| **Immediate threshold** | Score for an immediate alert | 70, from 60 to 90 |
| **Digest threshold** | Score for the daily digest, below the immediate threshold | 35, from 20 to 60 |
| **Digest hour** | Hour the digest goes out, in the organization time zone | 8 |
| **Include possible matches in immediate alerts** | Off: an immediate alert needs a confirmed affected asset | Off |
| **Use quiet hours** | Hold messages between a start and an end hour. A threat at or above the override score still alerts | Off; override score 90, from 70 to 100 |
| **Name hosts in messages** | Off by default. When on, a message sent outside the console names at most 5 affected hosts, each once | Off |

Messages are limited: at most five immediate messages an hour, then one "N
more" message. Members who receive the daily e-mail digest see host counts
within their own data scope.

## Related

- [Vulnerability matching](vulnerability-matching.md): how software versions
  become findings.
- [The vulnerabilities list](vulnerabilities.md): the **Emerging threat** filter.
- [Prioritization](06-prioritization.md)
