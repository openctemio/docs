---
title: Attack surface monitoring
parent: Scanning
nav_order: 6
---

# Attack surface monitoring

Attack surface monitoring (EASM) keeps track of your internet-facing names
and what is wrong with them:

1. **What do we have on the internet?** Discovery from your domains.
2. **Is it really ours?** Attribution, with evidence and suggestions.
3. **What is wrong with it?** Passive DNS checks and non-intrusive scans.
4. **What changed?** Continuous monitoring and alerts.

It needs the **Attack surface** module. The pages are under
**Discovery › Attack surface** (`/attack-surface`, tabs **Overview**,
**Review**, **Lookalikes**, **Changes** and **Web surface**). Only your own attack surface
is covered, under your own scope.

![The Attack surface overview: total and exposed assets, critical exposures, the external surface by attribution and freshness, and the top external risks]({{ site.baseurl }}/assets/images/scanning/easm-overview.png)
*Figure: Discovery, Attack surface, Overview.*

Discovered assets join the inventory at once. Scope decides what is actively
scanned: entries authorize the full scan, and assets no entry covers get
low-impact checks by default
([Unclassified assets](scope.md#unclassified-assets)).

## How it works

| Part | Runs on | Sends traffic to your hosts? |
|---|---|---|
| Certificate Transparency discovery | the platform | No: it queries public CT log aggregators |
| DNS checks | the platform | No: DNS questions about your names only |
| Active discovery and assessment (subdomains, DNS, ports, HTTP, templates) | your [sensors](../sensors/index.md), as [scans](scans-and-runs.md) | Yes, under [scope](scope.md) |

Everything found goes into the same asset inventory, exposures and findings
as any other source.

## Discovery roots

Discovery starts from your **permanent domain scope entries with discovery
on**, for example `*.example.com` (**Scoping > Scope > In scope**). Turning
discovery on needs the scope approval permission and re-authentication, like
any widening. One-off and non-domain entries never discover. Certificate
Transparency also watches your domain assets and verified domains.

## Certificate Transparency

The platform queries crt.sh (with Cert Spotter as a fallback) for the names
it watches and raises:

| Exposure | When |
|---|---|
| `subdomain_discovered` | A host below a watched name appears in a logged certificate |
| `certificate_expiring` | A host's newest certificate expires within 30 days |
| `certificate_expired` | A host's newest certificate lapsed within the last 30 days and nothing replaced it |

Names named exactly on a recent certificate become `subdomain` assets.
Excluded names are not queried and raise nothing. Each run queries at most
`CERT_MONITOR_MAX_DOMAINS_PER_RUN` domains per organization (default 50); the
rest follow in later runs.

Turning Certificate Transparency off (below) stops your domain names from
being sent to these third-party services.

## DNS checks

Daily, the platform asks its own resolver about your names. Nothing is sent
to your hosts or to CNAME targets, and no HTTP request is made.

| Check | Finds | Exposure |
|---|---|---|
| Dangling DNS | A CNAME whose target does not exist (high when the target's registrable domain is unregistered; medium when it points at a provider where anyone can claim the name); a delegation whose name servers do not exist or do not answer for the zone | `dangling_cname`, `dangling_ns` |
| Email posture | SPF, DMARC, MTA-STS and TLS-RPT gaps on registrable domains | `email_security_weak` |

A provider-claimable dangling CNAME stays medium until a sensor confirms it:
a nuclei `takeover` template that matches the same name in a scan your sensor
ran raises `subdomain_takeover` (high). Such a name may be probed by a
takeover-only nuclei scan even though it is classified as a dependency.

## Monitoring settings

The **Monitoring** card on **Attack surface > Overview** shows when each part
last ran, its switch and its cadence.

| Action | Permission |
|---|---|
| See the card | `settings:read` |
| Turn Certificate Transparency or DNS checks off or on, change the cadence | `settings:write` |
| **Run now** | `attack_surface:scope:write` |

- Cadence: **Default** (the platform's, usually every 24 hours), or every 6,
  12, 24 or 48 hours, or weekly. Six hours is the minimum.
- **Run now** starts Certificate Transparency discovery and then the DNS
  checks (each only if on). Results appear within minutes. It can run again
  15 minutes later. Adding a discovery root starts the same run.
- API: `GET` and `PUT /api/v1/easm/settings`
  (`ct_enabled`, `dns_checks_enabled`, `ct_interval_hours`,
  `dns_interval_hours`; `0` means the platform default), and
  `POST /api/v1/easm/sweeps`.

Platform operators set the defaults: `CERT_MONITOR_ENABLED`,
`CERT_MONITOR_INTERVAL`, `CERT_MONITOR_FEED_URL`,
`CERT_MONITOR_CERTSPOTTER_URL` (`off` disables the fallback),
`EASM_DNS_CHECKS_ENABLED`, `EASM_DNS_CHECK_INTERVAL`, `EASM_DNS_RESOLVER`,
`EASM_DNS_MAX_NAMES_PER_RUN` (default 500 names per organization per run) and
`EASM_DNS_QPS` (default 20 queries per second in all).

## Active discovery

Run the starter workflows **Discover** or **Discover + Vuln**
([Scan workflows](scan-workflows.md#starter-workflows)) against your domains
on a schedule. Your sensors enumerate subdomains, resolve them, scan ports,
probe HTTP and TLS, and run non-intrusive templates. Every step's new names
pass the scope and ownership gate before the next step probes them, and a
derived target is at most three discovery hops from the seeds.

Port scan results become `open_port` assets linked to their address, with
`port_open` and `service_detected` exposures. A later port scan that no
longer sees a port marks it inactive and resolves its exposures.

The HTTP probe makes each web origin it finds its own asset, named by its URL
(`https://app.example.com`, `http://203.0.113.7:8080`), so crawling,
templates and DAST have a web target; the subdomain or address keeps its own
row and type (v0.9.6). On an existing inventory, the next HTTP probe adds the
origins.

## Review

Every internet-facing asset carries an **attribution**: `confirmed`,
`needs_review`, `candidate`, `dependency` (your name on a provider's
infrastructure), `monitor_only` or `rejected`.

- Names covered by a permanent scope entry are **confirmed** automatically
  (**Add discovered names automatically**, on by default).
- Everything else discovery finds joins the inventory at once as
  *discovered*. Only when **Review discovered assets first** is on (off by
  default) do names outside every permanent entry wait for a person before
  they join the inventory.

**Attack surface > Review** collects the decisions that still need a
person. Its **Waiting for your decision** section has:

- **Addresses your in-scope names resolve to.** Adding them scans every port
  of those addresses; today only the names are scanned. A name never makes
  an address yours, so add only addresses you know are yours. The card
  groups them:
  - **Network unknown for N: check they are yours**;
  - **Shared, not offered**: CDN, CDN edge range, shared hosting (names of 3
    or more domains point there), another organization's network or a
    provider network. These are never offered;
  - **Your own network**: **Add {prefix}** for your network seeds;
  - **Already get low-impact checks (add to scope for a full scan)**.

  Each address shows the open ports seen and its other names. Actions: **Add
  N to scope**, **Not ours** (never scanned or suggested again, until undone
  on the asset), **Not now**, and **Undo**.
- **Assets you confirmed that are not in scope**: confirmed before
  confirming added a scope entry, so scans skip them; add their exact
  entries to scan them.

The list below it (views **Awaiting a decision** and **Not ours**) shows each
name with its evidence ("Why it may be yours"). Decide one by one or in
bulk: **Ours: add to scope**, **Not ours**, **Dependency** or **Monitor
only**. Confirming a domain or address as yours adds its exact scope entry,
unless your organization turned this off or uses Strict scan approval.

- A name marked **Not ours** is remembered for 12 months, with every name
  below it, so discovery does not propose it again unless new evidence
  appears.
- Names awaiting a decision and rejected names are hidden from the default
  inventory view; **Show all** shows them.

A person's decision always wins over automation. Names marked Not ours,
dependencies, monitor-only names and names that resolve only through a
wildcard DNS record are never actively probed. Names that discovery found
and nobody has decided on yet are unclassified: they get what **Scan
unclassified assets** allows (low-impact checks by default, behind the
platform guardrails).

## Alerts

New or reopened EASM exposures reach your notification channels as
`new_exposure`:

| Exposure | Delivery |
|---|---|
| Medium or higher on an approved asset | At once, one alert per exposure |
| Low or info, on a name awaiting review or monitor-only, or not linked to an asset | A daily digest per organization (08:00 UTC) |
| More than 30 immediate alerts in an hour | The rest go to the digest |

Re-sightings announce nothing; rejected assets never alert.
