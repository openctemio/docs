---
title: Scanning
parent: Platform console
nav_order: 4
---

# Console scanning settings
{: .no_toc }

The **Scanning** group of the [platform console](index.md): what the platform may
scan for organizations, with which sensors, and the content and intelligence every
organization shares.

1. TOC
{:toc}

---

## Scan approval

**Scan approval** sets whether organizations choose their own scan approval
(**The organization decides**, the default: each owner turns scan approval off, on or strict, and it is off until they do) or the platform sets it for all
(**Off**, **At least on**, **Strict**). One organization can also be set on its
**Scope** tab. In every mode, widening scope still needs re-authentication and
passes the platform deny list. Changes need a super admin, a fresh code and a
reason; the organization's administrators are told. See
[Scope](../scanning/scope.md).

## Platform scanning

**Platform scanning** holds the rules for scans that run on the platform's own
sensors and, once a release enables them, the shared sensor fleet.

![The Platform scanning page: the notice that shared sensors are not available in this release, and the Verified domain before platform sensors scan card with its switch off]({{ site.baseurl }}/assets/images/console/platform-scanning.png)
*Figure: Scanning, Platform scanning.*

- **Verified domain before platform sensors scan**: whether an organization must
  prove it owns a domain before platform sensors scan a target. Off by default (an
  organization's scope entry is enough); on by default when the server runs with
  `MANAGED_SERVICE=true`. A value saved here always wins over the default. Turn it
  on for a public multi-tenant service, so nobody can point your sensors at someone
  else's systems. Either way, scope entries, exclusions, the platform deny list,
  scan zones for private addresses and tier ceilings stay in force.
- **Shared sensors** (tabs **Policy**, **Fleet**, **Queue**, **Zones**,
  **Egress**, **Anomalies**): this release does not make shared sensors available, so
  the page shows the notice **Shared sensors are not available in this release**
  instead of the tabs. What they will do is described in
  [Shared sensors](../sensors/shared-sensors.md).

## Target mappings

**Target mappings** decide which asset types each scanner target type can scan.
Scans skip assets that no active mapping covers.

- The cards: **Mappings**, **Active**, **Inactive**, **Target types mapped** and
  **Asset types covered**; filter by target and asset type.
- **New mapping** (operations admin or above): the target type (for example URL,
  domain, IP, host, repository, container, cloud account, service, port, database,
  API, certificate), the asset type, whether it is the primary mapping, its
  priority and whether it is active. The pair cannot be changed later.
- Edit, activate or deactivate a mapping (operations admin); delete it (super
  admin). Each confirmation explains which assets scans would skip.

## Content packs

**Content packs** are the templates, rules and wordlists the platform ships to
sensors. **Add pack** (upload an archive, tar or tar.gz up to 128 MiB, or import
from a URL with its expected digest) lints the files, leaves out the ones that
fail, flags suspected secrets for your acknowledgement, classifies the pack and
signs it; sensors run only signed packs. A pack is delivered through a
**channel**: **Point {channel} here** rolls a version out to the sensors on that
channel at their next content check. **Revoke** stops sensors from running a pack
and clears any channel that points at it (irreversible). Changes need a super
admin, a fresh code and a reason.

## Content catalog

**Content catalog** is the instance's signed catalog of rules, templates, sensors
and other packages that organizations install from (under **Settings › Scanner
content** in the organization app).

![The Content catalog page: the notice that the catalog is not set up, the Trust card with Publish a package and Import a bundle, and the empty package list]({{ site.baseurl }}/assets/images/console/content-catalog.png)
*Figure: Scanning, Content catalog without trust roots.*

- **Trust**: the trust roots, key set version, signed index, revocation list and
  last import. Trust roots are set on the server (`CONTENT_TRUST_ROOT_KEY_IDS`,
  optionally `CONTENT_SIGSTORE_TRUSTED_ROOT`) and are read-only here, so a stolen
  console session cannot trust new content. Without a root the page says **The
  catalog is not set up** and imports are refused.
- **Import a bundle** (tar or tar.gz): verified against the trust roots (key set,
  signed index, revocation list, every package) before anything is stored.
- **Publish a package**: an instance package (manifest `package.yaml` and its
  artifact), offered to every organization next to the imported catalog.
- The package list (**This installation** or **Signed catalog**), each package's
  versions newest first, and **Revoke** for a version: every organization's
  installation of it becomes revoked and stops being delivered to its sensors.

Import, publish and revoke need a super admin, a fresh code and a reason. The list
never shows an organization's private packages or installations. See
[Content delivery](../sensors/content-delivery.md).

## Threat intelligence

**Threat intelligence** shows the platform-wide feeds every organization uses to
prioritize findings (EPSS and the known-exploited list among them): last and next
sync and record counts. **Sync now** (operations admin) runs a feed immediately,
for example after an outage. Turning a feed on or off needs an operations admin and
a confirmation. See [Feeds](../operations/feeds.md).
