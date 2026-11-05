---
title: Emerging threats
parent: User guide
nav_order: 6.5
---

# Emerging threats

**Emerging threats** (`/emerging-threats`, in the sidebar under
**Prioritization**) answers one question: does this new vulnerability hit us?
It lists the vulnerabilities that were just published or just became exploited
and that match software your assets run, ranked by how likely they are to hurt
you now.

There is one alert per vulnerability, never one message per asset. The page
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
- Columns: **Threat**, **Score**, **Level**, **Affected assets** (confirmed,
  possible and internet-facing), **Exploit status** (KEV, ransomware use, EPSS),
  **State**, **Match** and **Last change**.

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
unknown)**. Each asset shows its product, the version seen, its criticality,
whether it is internet-facing and its finding and remediation task.

Assets outside your data scope are never listed.

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
| **Name assets in messages** | Off by default. When on, a message sent outside the console names at most 5 assets | Off |

Messages are limited: at most five immediate messages an hour, then one "N
more" message. Members who receive the daily e-mail digest see counts within
their own data scope.

## Related

- [Vulnerability matching](vulnerability-matching.md): how software versions
  become findings.
- [The vulnerabilities list](vulnerabilities.md): the **Emerging threat** filter.
- [Prioritization](06-prioritization.md)
