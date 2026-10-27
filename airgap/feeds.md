---
title: Content and intelligence feeds
parent: Air-gapped and private registry
nav_order: 12
---

# Content and intelligence feeds in air-gapped sites
{: .no_toc }

Besides images, the platform fetches data: vulnerability catalogs, program
lists, content packs, release information and more. This page lists what each
feed needs, how to feed it without internet access today, how often it runs and
what stops working without it.

1. TOC
{:toc}

---

## The outbound rule

All outbound calls of the platform go through an SSRF-guarded HTTP client. It
**ignores `HTTPS_PROXY`** and **refuses private address ranges** unless the
range is listed in `OPENCTEM_HTTPSEC_ALLOW_PRIVATE_CIDRS`. A mirror on a private
address, such as a Nexus raw proxy, therefore needs its range in that setting.
There is no egress proxy support yet (see [known gaps](#known-gaps)).

## Feeds at a glance

| Feed | What it needs | Offline path today | Cadence | What degrades without it |
|---|---|---|---|---|
| Vulnerability catalog (vulnfeed) | `VULNFEED_ROOT_KEY_ID`, source enabled | Signed bundles from `VULNFEED_BASE_URL` or `VULNFEED_MIRRORS` (a Nexus raw proxy of `github.com/openctemio/vulnfeed-bundles/releases`), or files in `VULNFEED_BUNDLE_DIR` | Import every 20 minutes; stale warning after 3 days | CVE catalog and inventory matching go stale |
| Public program feed (programfeed) | `PROGRAMFEED_ROOT_KEY_ID` for signed sources | `PROGRAMFEED_URL` or `PROGRAMFEED_MIRRORS`, or a signed bundle in `PROGRAMFEED_DIR`, or an **unsigned** bundle in `PROGRAMFEED_LOCAL_BUNDLE_DIR` | not stated | No public program catalog |
| Content catalog | `CONTENT_TRUST_ROOT_KEY_IDS` (optional `CONTENT_SIGSTORE_TRUSTED_ROOT`) | Admin import: `POST /api/v1/admin/content-catalog/import` | On import | The catalog is not updated |
| Platform content packs | Platform admin | Admin upload | On upload | Packs not updated |
| Scanner templates | Tenant sources | Internal git or S3 source (the private-range allowlist is needed) | not stated | Templates not updated |
| Sensor scanner content (nuclei, Trivy, opengrep) | A local mirror reachable by the sensor | Sensor-side local mirror or directory | not stated | Sensor health shows stale content |
| Release feed and version check | `VERSION_CHECK_URL`, `VERSION_CHECK_ENABLED` | Admin import: `POST /api/v1/admin/version-check/import` | On import | Newer versions are not learned |
| CISA KEV and EPSS | Fixed internet URLs | **None** | | No KEV flags and no EPSS scores |
| AI triage | Provider URLs are fixed | **None** | | AI triage unavailable |
| CTEM-ID catalog | `CTEM_ID_FEED_URL` | An internal https copy (the private-range allowlist is needed) | not stated | Catalog not updated |
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
4. Set `VULNFEED_ROOT_KEY_ID` and enable the source.

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
  release-feed keys are not pinned in the release yet, so verification of
  imports is a known gap ([below](#known-gaps)).

## Keep the data fresh

- The vulnfeed status turns stale after 3 days without an import. Treat that
  warning as a task: copy the newest bundle or check the mirror.
- Refresh the Trivy database mirror daily for the CI scan stage and for sensors.
- A transfer by media (Path A3) should carry the feeds with each release.

## Known gaps

These are follow-ups, not built:

- Import of KEV and EPSS data (a file setting and an admin upload).
- Egress proxy support for the guarded client.
- A configurable base URL for an AI provider (an on-premises model).
- CTEM-ID catalog import.
- Serving the API reference page's script locally.
- Release-feed and content-root keys pinned in the release.
- Platform alerts when KEV, EPSS or vulnfeed data goes stale.
- An upload endpoint for the programfeed.

## Related

[Vulnerability and program feeds](../operations/feeds.md),
[Sensors](sensors.md), [Environment variables](../configuration/environment-variables.md)
