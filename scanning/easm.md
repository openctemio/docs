---
title: Attack surface monitoring
parent: Scanning
nav_order: 6
---

# Attack surface monitoring

Attack surface monitoring (EASM) keeps track of your internet-facing names
and what is wrong with them:

1. **What do we have on the internet?** Discovery from your domains.
2. **Is it really ours?** Attribution, with evidence and a review queue.
3. **What is wrong with it?** Passive DNS checks and non-intrusive scans.
4. **What changed?** Continuous monitoring and alerts.

It needs the **Attack surface** module. The pages are under
**Attack surface** (tabs **Overview** and **Review**). Only your own attack
surface is covered, under your own scope.

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
`EASM_DNS_CHECKS_ENABLED`, `EASM_DNS_CHECK_INTERVAL`, `EASM_DNS_RESOLVER`.

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

## Review queue

Every internet-facing asset carries an **attribution**: `confirmed`,
`needs_review`, `candidate`, `dependency` (your name on a provider's
infrastructure), `monitor_only` or `rejected`.

- Names covered by a permanent scope entry, and names found under a verified
  domain, are **confirmed** automatically.
- Other names found by discovery wait in **Attack surface > Review**, each
  with its evidence in words. Decide one by one or in bulk: **Confirm**,
  **Not ours**, **Dependency** or **Monitor only**.
- **Review by rule** suggests patterns (a wildcard at a label level, a /24 or
  /48 range) that cover many pending names; accepting one creates a scope
  entry through the normal approval flow, rejecting one creates an
  exclusion.
- A name marked **Not ours** is remembered for 12 months, with every name
  below it, so discovery does not propose it again unless new evidence
  appears.
- The asset inventory shows your organization's assets by default; names
  awaiting review and rejected names appear behind **Show all**.

A person's decision always wins over automation, and names awaiting review
or rejected are never actively probed.

## Alerts

New or reopened EASM exposures reach your notification channels as
`new_exposure`:

| Exposure | Delivery |
|---|---|
| Medium or higher on an approved asset | At once, one alert per exposure |
| Low or info, on a name awaiting review or monitor-only, or not linked to an asset | A daily digest per organization (08:00 UTC) |
| More than 30 immediate alerts in an hour | The rest go to the digest |

Re-sightings announce nothing; rejected assets never alert.
