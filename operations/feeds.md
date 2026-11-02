---
title: Vulnerability and program feeds
parent: Operations
nav_order: 4.5
---

# Vulnerability and program feeds
{: .no_toc }

Two public feeds give the platform data it never collects itself. Nothing is
installed on your hosts: the platform downloads a signed bundle (or reads
one you copied to it), verifies it against a key you pin, and imports it.

| Feed | Gives | Used by | Source |
|---|---|---|---|
| Vulnerability feed | Products, CVEs and affected version ranges (from the NVD) | Matching the software inventory of your assets against known vulnerabilities | Feed: [`openctemio/vulnfeed-bundles`](https://github.com/openctemio/vulnfeed-bundles); collector code: [`openctemio/vulnfeed`](https://github.com/openctemio/vulnfeed) |
| Program feed | Public bug-bounty and vulnerability-disclosure programs: owner, policy, bounty, published scope | **Scoping > Scope > Programs** (the public program monitor) | [`openctemio/programfeed`](https://github.com/openctemio/programfeed) |

The platform never calls the vulnerability sources or the bug-bounty
platforms. CISA KEV and EPSS travel with each vulnerability release too (see
[KEV and EPSS](#kev-and-epss)); the platform can also fetch them from CISA and
FIRST itself.

1. TOC
{:toc}

---

## Status

The vulnerability feed publishes a signed release every hour in
[`openctemio/vulnfeed-bundles`](https://github.com/openctemio/vulnfeed-bundles)
(tags `v1-N`); the platform release that makes this repository its default
pins the official root key id, so nothing needs configuring. The program feed
has not published a signed release yet:
`https://github.com/openctemio/programfeed/releases/latest/download/latest.dsse.json`
answers 404 and there is no root key id to pin; until then the public program
monitor shows only the programs of a [local bundle](#program-feed-a-local-bundle)
you build yourself.

{: .note }
The feed used to be published in the releases of `openctemio/vulnfeed`, which
now holds only the collector code and a copy of the feed for a transition
period. Platforms older than the release that changed the default keep reading
that copy; to switch an older platform now, set `VULNFEED_BASE_URL` to
`https://github.com/openctemio/vulnfeed-bundles/releases`.

## How it works

Each feed publishes GitHub releases (the vulnerability feed hourly): a signed pointer
(`latest.dsse.json`), signed manifests and the record files, in whole
bundles (v1) and in chunks (v2, only the changed chunks are fetched). The
platform checks, before it imports anything:

- the manifests are signed by a key of the key set, and the key set by the
  **offline root** whose key id you pin;
- the sequence only moves forward (no rollback) and the bundle is not
  expired (7 days);
- every file's size and SHA-256.

A bundle that fails a check is not imported; the previous data stays.

## Vulnerability feed

| Variable | Default | Meaning |
|---|---|---|
| `VULNFEED_ROOT_KEY_ID` | the official root | The pinned root key id (`SHA256:...`, `keys/root-keyid.txt` of the vulnfeed-bundles repository). Set it only to trust a feed you sign yourself. Platforms older than the release that built the official root in need it set. |
| `VULNFEED_BASE_URL` | `https://github.com/openctemio/vulnfeed-bundles/releases` | Where the releases are |
| `VULNFEED_MIRRORS` | empty | Comma-separated https mirrors, tried after the release |
| `VULNFEED_BUNDLE_DIR` | empty | Air-gapped: a directory holding the files of one release |
| `FEED_CACHE_DIR` | `<system temp dir>/openctem-feeds` | Cache of verified chunks between imports |

The `vuln-feed-import` worker runs every 20 minutes. On a platform older than
the built-in root, with `VULNFEED_ROOT_KEY_ID` unset it imports nothing; the `vulnfeed` row of the
threat-intelligence sync status stays `pending`.

**Air-gapped**: on a connected machine, download a release and verify it
with the feed's own tool, then copy the directory to the platform and point
`VULNFEED_BUNDLE_DIR` at it:

```bash
gh release download --repo openctemio/vulnfeed-bundles --dir bundle
git clone https://github.com/openctemio/vulnfeed && (cd vulnfeed && go build -o ../vulnfeed-bin ./cmd/vulnfeed)
./vulnfeed-bin verify --dir bundle --root-key-id "$(cat vulnfeed/keys/root-keyid.txt)"
```

## KEV and EPSS

Each vulnerability release carries two more signed files: the CISA Known
Exploited Vulnerabilities catalog and the EPSS scores, with their data dates
and attribution. The platform verifies them with the same pinned root key and
applies each one only when its data date is newer than the data it already
holds, so an older or replayed release never rolls them back. A release from
before this feature carries no such files and is imported as before.

The platform also fetches both itself (KEV hourly, EPSS daily). Where they come
from is a setting in the console, **System > Threat intelligence > Where KEV
and EPSS come from** (super administrator, asks for the step-up, audited):

| Setting | Default | Meaning |
|---|---|---|
| Use the signed release as the source | off | Off: the platform's own fetch supplies the data and the release copy is applied when newer. On: the release supplies the data, and the platform fetches from CISA and FIRST only when the release's copy was last read more than 6 hours ago (KEV) or 48 hours ago (EPSS). Switch it on once the release has been fresh for a week. |
| Allow the platform to call CISA and FIRST | on | Off for installs with strict egress rules: the platform never calls CISA or FIRST (the scheduled and the manual sync both refuse), the release is the only source, and a stale copy is shown as stale. |

The page lists, per feed, when the release's copy was last read and whether it
is fresh, and which path supplied the data held. **Strict egress**: allow only
the release host (or set `VULNFEED_MIRRORS` to an internal mirror, or use
`VULNFEED_BUNDLE_DIR` when air-gapped), then turn off "Allow the platform to
call CISA and FIRST".

## Feed relay: no outbound access from the platform

A platform in an internal network can receive every feed through a **platform
sensor** that has internet access (for example in a DMZ), so the platform itself
needs no outbound access at all. The sensor is only a pipe for signed files: the
platform decides which files it needs, the sensor downloads exactly those from the
official feed origins and sends them back, and the platform verifies every file
with each feed's own pinned key before anything is applied. A relay can delay a
feed, never change it, and it is never a way out for the platform's data: it only
downloads named files from fixed origins.

What is relayed: the vulnerability feed with its KEV and EPSS data, and the release
feed of the version check. In relay mode the platform also stops its own KEV/EPSS
fetch, the online version check and the program feed's URLs (not relayed yet; the
status lists it), so it makes no outbound feed request. The platform never falls
back to fetching directly on its own: only an administrator changes the mode.

**Defaults.** A new compose install with the bundled sensor starts in relay mode:
the bundled sensor becomes the relay as soon as it enrolls. An existing
installation keeps fetching directly until an administrator switches it.

Set it up on an existing installation:

1. Run a **platform (shared) sensor** on a host with internet access. A shared
   sensor with a pinned job-signing key relays by default; set
   [`SENSOR_FEED_RELAY=0`](../sensors/settings.md#SENSOR_FEED_RELAY) on a host
   that must not. An organization's sensor never relays.
2. The platform needs its **job signer** (it signs every relay round). A relay
   downloads only from the official origins (`VULNFEED_BASE_URL`; the direct-mode
   mirrors in `VULNFEED_MIRRORS` are not used). To relay from your own mirror, add
   it to `SIGNER_FEED_ORIGINS` on the signer **and**
   [`SENSOR_FEED_RELAY_ORIGINS`](../sensors/settings.md#SENSOR_FEED_RELAY_ORIGINS)
   on the sensor.
3. A super administrator selects relay mode and designates **one to three** relay
   sensors in one change (step-up required, audited):
   `PUT /api/v1/admin/settings/feed-relay` with
   `{"mode": "relay", "sensor_ids": ["..."], "expected_version": N}` (the console
   card follows). Each sensor must be an active platform sensor that reports the
   feed relay; anything else is refused.

**Several relays.** Any designated relay picks up the next round. If one stops
(no upload for ten minutes) or is removed from the list, another takes over its
round, so two relays give automatic failover.

**Several API replicas.** Nothing to configure: relayed files are stored in the
database and every replica sees them. No shared volume is needed on compose, Helm
or the installer kit. The relayed files are re-fetchable, so backups may skip the
data of the `feed_relay_files` table.

**Status** (`GET /api/v1/admin/settings/feed-relay`, any administrator): per feed
the applied release and its age, the round in progress (files and bytes delivered,
which relay holds it), and when a feed is stale, why:

| Reason | Meaning |
|---|---|
| `no_relay_designated` | relay mode is on but no relay sensor is designated (on a new install: the bundled sensor has not enrolled yet) |
| `relay_offline` | no designated relay was seen in the last 10 minutes |
| `signer_refused` | the job signer refused the round; the detail names the reason (for example an origin missing from `SIGNER_FEED_ORIGINS`) |
| `sensor_refused` | the relay sensor refused the round (signature or origin rule on the sensor) |
| `upstream_missing` | the feed host answered 404 for a file |
| `nothing_delivered` | the relay delivered no file of the round |
| `pin_mismatch`, `verify_failed` | a file did not match its pin or signature: someone served altered or unsigned files |
| `rollback_refused` | the relayed release is older than the one applied |
| `plan_failed`, `import_failed` | the platform could not plan or apply the relayed files |
| `round_expired` | the relay did not finish a round within 30 minutes |
| `spool_full` | the relayed files reached their quota (512 MiB) |

Relay mode is not available while `VULNFEED_BUNDLE_DIR` is set (that directory
stays the only source) or without a job signer. Direct fetch, a mirror and the
bundle directory remain the other ways to receive the feeds.

## Feed status and Sync now

**System > Threat intelligence** shows one card per feed (vulnerability bundles, KEV,
EPSS) with a state computed by the server: **Up to date**, **Waiting for the publisher**
(the feed has published nothing yet: not a failure), **Stale**, **Failing**, **Refused**
(a download failed a check, for example a KEV or EPSS snapshot under 90 % of the stored
catalog), **Running** or **Off**. Each card shows the last attempt and the last success
separately, the catalog size and what the last run changed, the next scheduled run
(vulnerability bundles every 20 minutes, KEV hourly, EPSS daily), and an error as a code
with an action (the raw text behind **Details**). The vulnerability card also shows the
applied sequence, the key set and the freshness of each source.

**Sync now** queues the sync and returns at once; the card shows **Running** and a
message reports the outcome. A feed runs once at a time across API replicas: a feed
already running is not started twice, a feed started less than 15 seconds ago is
refused for a moment, and a feed that is off or not configured is not started.

## Program feed

| Variable | Default | Meaning |
|---|---|---|
| `PROGRAMFEED_ROOT_KEY_ID` | empty | The pinned root key id. **Empty: no signed program feed is imported.** |
| `PROGRAMFEED_URL` | empty | https release URL of the chunked feed, tried first |
| `PROGRAMFEED_MIRRORS` | empty | Mirrors, tried after `PROGRAMFEED_URL` |
| `PROGRAMFEED_DIR` | empty | A directory holding a release (a mirror or an upload) |
| `PROGRAMFEED_LOCAL_BUNDLE_DIR` | empty | Your own unsigned local bundle (below) |

Subscribing an organization to a public program never authorizes testing: its
scope entries stay inactive until an administrator accepts the program's
terms (with a recent sign-in), and a change of the terms makes them inactive
again. See [Scope](../scanning/scope.md).

### Program feed: a local bundle
{: #program-feed-a-local-bundle }

An organization may build an **unsigned, local-only** bundle that reads every
source, including datasets the public feed does not republish, for its own
platform only. It must not be redistributed, and you are responsible for the
terms of the sources it contains:

```bash
git clone https://github.com/openctemio/programfeed && cd programfeed
go build -o programfeed ./cmd/programfeed
./programfeed build --local-only --out local-bundle --cache httpcache
```

Copy `local-bundle` to the platform, set `PROGRAMFEED_LOCAL_BUNDLE_DIR` to it,
and have a platform administrator turn the local source on in the admin
console (it needs a recent sign-in and is audited). Its programs are
suggestions until confirmed; a signed record with the same id wins.

## Security notes

- Pin the root key id from the feed repository you trust, over a channel you
  trust (the repository itself, checked by a second person). It is the only
  thing that makes a bundle trusted.
- A mirror or an upload needs no trust of its own: the platform verifies the
  same signatures and hashes.
- The bundles hold public data only. The import writes platform-wide tables
  (no organization data); each organization's effects (matches, program
  updates) run afterwards, inside that organization.
