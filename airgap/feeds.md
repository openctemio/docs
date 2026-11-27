---
title: Content and intelligence feeds
parent: Air-gapped and private registry
nav_order: 12
---

# Content and intelligence feeds in air-gapped sites
{: .no_toc }

See how it works: [Feed delivery](../how-it-works/vulnerability-intel/feed-delivery.md), [KEV and EPSS updates](../how-it-works/vulnerability-intel/kev-epss.md).

Besides images, the platform fetches data: vulnerability catalogs, program
lists, content packs, release information and more. This page lists what each
feed needs, how to feed it without internet access today, how often it runs and
what stops working without it. Step-by-step setup of the vulnerability feed for each
network layout: [Set up the vulnerability feed](../operations/vulnerability-feed-setup.md).

1. TOC
{:toc}

---

## The outbound rule

All outbound calls of the platform go through an SSRF-guarded HTTP client. It
**ignores `HTTPS_PROXY`** and **refuses private address ranges** unless the
range is listed in `OPENCTEM_HTTPSEC_ALLOW_PRIVATE_CIDRS`. A mirror on a private
address, such as a Nexus raw proxy, therefore needs its range in that setting.

Where the only way out is a corporate HTTPS proxy, set
`OPENCTEM_HTTPSEC_FEED_PROXY` (Ansible kit: `openctem_feed_proxy`). Only the
platform's own feeds use it (vulnerability bundles, KEV, EPSS, the CTEM-ID
catalog, the program feed and the release feed); anything an organization
configures does not. `OPENCTEM_HTTPSEC_FEED_NO_PROXY` lists hosts reached
directly, such as an internal mirror.

For a platform with no outbound access at all, a platform sensor with internet
access can relay the signed vulnerability feed and the release feed: see
[Feed relay](../operations/feeds.md#feed-relay-no-outbound-access-from-the-platform).

## Feeds at a glance

| Feed | What it needs | Offline path today | Cadence | What degrades without it |
|---|---|---|---|---|
| Vulnerability catalog (vulnfeed) | Nothing to configure: the root key is built in (`VULNFEED_ROOT_KEY_ID` only for a feed you sign yourself) | Signed bundles from `VULNFEED_BASE_URL` or `VULNFEED_MIRRORS` (a Nexus raw proxy of `github.com/openctemio/vulnfeed-bundles/releases`), files in `VULNFEED_BUNDLE_DIR`, or the relay | Import every 20 minutes; out of date after 12 hours (every user sees a banner) | CVE catalog and inventory matching go stale |
| Public program feed (programfeed) | `PROGRAMFEED_ROOT_KEY_ID` for signed sources | `PROGRAMFEED_URL` or `PROGRAMFEED_MIRRORS`, or a signed bundle in `PROGRAMFEED_DIR`, or an **unsigned** bundle in `PROGRAMFEED_LOCAL_BUNDLE_DIR` | not stated | No public program catalog |
| Content catalog | `CONTENT_TRUST_ROOT_KEY_IDS` (optional `CONTENT_SIGSTORE_TRUSTED_ROOT`) | Admin import: `POST /api/v1/admin/content-catalog/import` | On import | The catalog is not updated |
| Platform content packs | Platform admin | Admin upload | On upload | Packs not updated |
| Scanner templates | Tenant sources | Internal git or S3 source (the private-range allowlist is needed) | not stated | Templates not updated |
| Sensor scanner content (nuclei, Trivy, opengrep) | A local mirror reachable by the sensor | Sensor-side local mirror or directory | not stated | Sensor health shows stale content |
| Release feed and version check | `VERSION_CHECK_URL`, `VERSION_CHECK_ENABLED` | Admin import: `POST /api/v1/admin/version-check/import`, or the feed relay | On import | Newer versions are not learned |
| CISA KEV and EPSS | The vulnerability feed (the platform never calls CISA or FIRST from v0.24.0) | Carried as signed side files of each vulnerability release: they arrive with the bundles from `VULNFEED_BUNDLE_DIR`, a mirror or the relay | With each vulnerability release; out of date after 12 hours (KEV) and 36 hours (EPSS); KEV 6 hours before v0.24.2 | No KEV flags and no EPSS scores |
| AI triage | Provider URLs are fixed | **None** | | AI triage unavailable |
| Certificate transparency and RIPEstat (EASM) | Internet | **None**: internet-facing by nature | | Those EASM checks stop |
| SMTP, Jira, chat, webhooks | Internal targets | Internal targets work (private-range allowlist) | | |
| API reference page | Loads its script from a CDN | **None** | | The API reference page does not load |

## Through a Nexus raw proxy

For the feeds that read an `https` base URL, a Nexus raw proxy of the upstream
GitHub release path is the lowest-effort route:

1. Create a raw proxy of `https://github.com/openctemio/` (the kit's
   `github-openctemio` repository, [Path P0](path-nexus-proxy.md#2-create-the-nexus-repositories)).
   It covers `vulnfeed` and `programfeed` releases as well as `openctem`.
2. Add the Nexus address range to `OPENCTEM_HTTPSEC_ALLOW_PRIVATE_CIDRS`.
3. Set the base URL of the feed to the proxy path, for example
   `VULNFEED_BASE_URL` (or add it to `VULNFEED_MIRRORS`), and
   `PROGRAMFEED_URL` (or `PROGRAMFEED_MIRRORS`).
4. Nothing else: the root key is built in. Set `VULNFEED_ROOT_KEY_ID` only for a feed
   you sign yourself.

The proxy is not trusted. The feed bundles are signed (DSSE with Ed25519) and
the platform verifies them against the key you pin, so a proxy cannot alter
them. See [Vulnerability and program feeds](../operations/feeds.md).

## By manual import

- **vulnfeed.** Put the signed bundle files into `VULNFEED_BUNDLE_DIR`. The
  platform imports them on its schedule.
- **programfeed.** Put a signed bundle into `PROGRAMFEED_DIR`, or an unsigned
  one into `PROGRAMFEED_LOCAL_BUNDLE_DIR`. An unsigned bundle is not verified:
  carry it only from a source you verified yourself.
- **Content catalog.** Use the admin import endpoint with a bundle you verified
  and set `CONTENT_TRUST_ROOT_KEY_IDS`.
- **Release information.** Use `POST /api/v1/admin/version-check/import`. The
  release feed is signed keyless (Sigstore); the platform verifies it offline
  with the trusted root built into its release and accepts only the release
  workflow of the official repository. Releases before the one that introduced
  this format cannot read the new file.
- **KEV and EPSS.** They arrive inside the vulnerability bundle; no separate
  import is needed.

## Outbound hosts to allow

The platform's own fetchers use HTTPS on port 443. Allow these at the firewall or
the proxy, or replace them with a mirror, a relay or a local directory:

| Host | Used for | Replaced by |
|---|---|---|
| `github.com`, `release-assets.githubusercontent.com`, `objects.githubusercontent.com` | Vulnerability bundles (the download redirects to the asset hosts), release feed | `VULNFEED_BASE_URL`, `VULNFEED_MIRRORS`, `VULNFEED_BUNDLE_DIR`, `VERSION_CHECK_URL`, the relay |
| `ctem.org` | CTEM-ID catalog | None yet; the catalog stays at the shipped version |
| Your `PROGRAMFEED_URL` host | Public program feed | `PROGRAMFEED_DIR` |

CISA KEV and EPSS are not on this list: from v0.24.0 they arrive only inside the signed
vulnerability release. Rules for `www.cisa.gov`, `raw.githubusercontent.com` and
`epss.empiricalsecurity.com` can be removed once the vulnerability feed works.

## Keep the data fresh

- Data older than its limit (catalog and KEV 12 hours, EPSS 36 hours; KEV 6 hours before v0.24.2) shows
  as out of date and every user sees a banner; a release older than 7 days is
  refused as expired. With `VULNFEED_BUNDLE_DIR`, copy a newer release every few
  hours ([how](../operations/vulnerability-feed-setup.md#offline-no-network-path));
  with a mirror, check that it keeps updating. From v0.24.2 the default KEV limit
  moves to 12 hours, and a Platform owner can raise the catalog limit (6 to 168 hours,
  with a reason; recorded and announced) in **System > Threat intelligence > How old the
  data may be**, so a daily or twice-weekly copy shows no banner. A higher limit also
  accepts older KEV and EPSS copies as current.
- Refresh the Trivy database mirror daily for the CI scan stage and for sensors.
- A transfer by media (Path A3) should carry the feeds with each release.

## Known gaps

These are follow-ups, not built:

- A configurable base URL for an AI provider (an on-premises model).
- Serving the API reference page's script locally.
- Content-root keys pinned in the release.
- An upload endpoint for the programfeed.

## Related

[Vulnerability and program feeds](../operations/feeds.md),
[Sensors](sensors.md), [Environment variables](../configuration/environment-variables.md)
