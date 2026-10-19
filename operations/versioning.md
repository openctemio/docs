---
title: Versioning and releases
parent: Operations
nav_order: 2
---

# Versioning and releases
{: .no_toc }

How OpenCTEM releases are numbered and published, and what that means when you
plan upgrades. The design is
[RFC-037](https://github.com/openctemio/openctem/blob/develop/api/docs/rfcs/RFC-037-versioning-and-release-train.md);
the maintainers' working reference is
[versioning-and-releases.md](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/versioning-and-releases.md).

1. TOC
{:toc}

---

## One version for the platform

- A release is a `vX.Y.Z` tag on the `main` branch of
  [openctemio/openctem](https://github.com/openctemio/openctem). The API and the
  web console share it.
- One tag publishes every image from the same commit: `openctem-api`,
  `openctem-web`, `openctem-console` (the platform admin console app),
  `openctem-gateway`, the all-in-one `openctem`, `migrations`, `seed` and
  `admin-cli`, all under `ghcr.io/openctemio/`, for amd64 and arm64, signed with
  cosign and with SBOMs on the GitHub Release.
- Run all platform images at the same version.

## Verify a release

Every image is signed with [cosign](https://github.com/sigstore/cosign) keyless
signing (Sigstore, the GitHub OIDC identity of the `docker-publish.yml` workflow
on a `v` tag), and its SPDX SBOM is attached to the image digest as a signed
attestation, so you can check where the SBOM came from as well as download it.
The release notes of each version carry these commands with the tag filled in:

```bash
TAG=v0.11.0
IDENTITY='^https://github.com/openctemio/openctem/.github/workflows/docker-publish.yml@refs/tags/v'
ISSUER=https://token.actions.githubusercontent.com

# The signature of the image
cosign verify "ghcr.io/openctemio/openctem-api:$TAG" \
  --certificate-identity-regexp "$IDENTITY" --certificate-oidc-issuer "$ISSUER"

# The signed SBOM attestation
cosign verify-attestation --type spdxjson "ghcr.io/openctemio/openctem-api:$TAG" \
  --certificate-identity-regexp "$IDENTITY" --certificate-oidc-issuer "$ISSUER"
```

Run the same for every image you deploy (`openctem-web`, `openctem-console`,
`openctem-gateway`, `openctem`, `migrations`). Signed SBOM attestations start with the first
release after v0.8.0. Each image also carries a signed SLSA build provenance (the
repository, workflow, tag and commit it was built from):

```bash
cosign verify-attestation --type slsaprovenance1 "ghcr.io/openctemio/openctem-api:$TAG" \
  --certificate-identity "https://github.com/openctemio/openctem/.github/workflows/docker-publish.yml@refs/tags/$TAG" \
  --certificate-oidc-issuer "$ISSUER"
```

The signatures and attestations are Sigstore bundles stored as OCI referrers of the image
digest: use cosign v3, and copy them along when you mirror an image. Some releases (v0.10.1,
v0.11.0) have no `sbom-*.spdx.json` files attached to the GitHub Release; the signed SBOM
attestation is the reference, and
[Air-gapped and controlled supply chain](../install/air-gapped.md#verify-the-signature-the-sbom-and-the-provenance)
shows how to extract it, mirror the images with their signatures, and pin the exact identity
of the release you approve.

## Version numbers

Versions follow semantic versioning. The next version is proposed from the
[conventional commit](https://www.conventionalcommits.org/) types merged since
the last tag, and a maintainer confirms it when starting the release:

| Strongest change since the last release | Before 1.0.0 | From 1.0.0 |
|---|---|---|
| Breaking change (`type!:` or a `BREAKING CHANGE:` footer) | minor | major |
| New feature (`feat`) | minor | minor |
| Anything else (fixes, performance, dependencies) | patch | patch |

So before 1.0.0 a minor release (`v0.8.0` to `v0.9.0`) can contain breaking
changes; check its release notes and upgrade guide. A patch release
(`v0.9.0` to `v0.9.1`) contains no breaking change.

## Release cadence

- **Release train**: a release every other Monday, from a `develop` commit whose
  required checks are green.
- **Hotfix**: a security or critical fix ships at once as a patch release, built
  from the last tag plus the fix.

Security fixes are announced in the release notes. To report a vulnerability,
see [Vulnerability disclosure](../security/vulnerability-disclosure.md).

## Where changes are recorded

- **Release notes** on each
  [GitHub Release](https://github.com/openctemio/openctem/releases), generated
  from the changelog and grouped as security, behaviour changes, removals,
  deprecations, additions, changes and fixes.
- **`api/CHANGELOG.md`** in the repository: the cumulative changelog. Unreleased
  entries live as one file per change in `api/changelog.d/` until the release
  folds them in.
- **Upgrade guides** for releases that need operator action, linked from
  [Upgrading](upgrade.md).

## Sensors, SDK and Helm chart

The sensor ([openctemio/sensor](https://github.com/openctemio/sensor)), the other
first-party sensor products (the Tenable.sc connector), the Go SDK
([openctemio/sdk-go](https://github.com/openctemio/sdk-go)) and the Helm chart
([openctemio/helm-charts](https://github.com/openctemio/helm-charts)) have their own
version numbers and release from their own repositories. The platform needs no
release when one of them ships.

### What the platform owns, and what it learns

The platform judges a sensor by what the sensor declares (protocol, SDK, capabilities)
against ranges the platform owns, whatever the product. Two things are kept apart:

- **Compatibility** (the oldest release that works) is the platform's own contract. It is
  in `versions.yaml` at the root of the openctem repository, compiled into each API
  release, and changes only with an API upgrade.
- **Availability** (the newest release) is information. The platform learns it from the
  signed release feed, so a sensor or SDK release reaches the Sensors page and the install
  commands within hours, with no platform release and no restart.

| Entry in `versions.yaml` | Effect in the platform |
|---|---|
| `<product>.latest` (`sensor`, `connector-tenable`) | The release this platform release was built with. Sensors of the product below the newest known release show "update available"; the install commands pin the image tag (and the digest, when the feed gave one). The feed can only raise it. |
| `<product>.min` | Sensors of the product below it are degraded, "version unsupported". The oldest supported sensor is v0.9.0 (sensor protocol v1 is removed, so older sensors cannot connect at all). |
| `sdk.latest` | A sensor built with an older sdk-go shows "outdated" (no health effect). The feed raises it. |
| `sdk.min` | A sensor of any product built with an older sdk-go is degraded with the reason `sdk_unsupported`. Empty today: it is raised only when a protocol change requires it. |
| `sdk.advisories` | SDK releases with a published security advisory: a sensor built with one is degraded with a warning. |
| `chart.version` | The newest chart whose `appVersion` is the platform release. |

The SDK checks apply to sensors built with sdk-go. Everything a sensor declares is
untrusted input: it changes only what the organization sees. Authorization, grants, scope
and dispatch never read the product, version or SDK.

The old `SENSOR_LATEST_VERSION`, `SENSOR_MIN_VERSION`, `SENSOR_SDK_LATEST_VERSION` and
`SENSOR_SDK_MIN_VERSION` variables are retired: the API refuses to start while one is set and names it.
Remove them. To make the platform know a sensor product of your own for the whole
installation, give it a product file with `SENSOR_PRODUCTS_FILE` (the `versions.yaml`
product format); for one organization, use custom products (below).

`GET /api/v1/sensors/stats` reports where each product's "latest" comes from in
`latest_source`:

| `latest_source` | Meaning |
|---|---|
| `feed` | Learned from the signed release feed. |
| `built_in` | The version this platform release was built with. It may be older than the newest release; the Sensors page says so. |
| `operator` | From the installation's own `SENSOR_PRODUCTS_FILE`. |

### The release feed

The platform reads one public, signed file, `openctem-releases.json`, from the latest
GitHub Release (`VERSION_CHECK_URL`). It lists the platform releases and security
advisories, plus the newest stable release of each first-party sensor product and of the
SDK, with the image digest. The feed is refreshed every 6 hours and on every release. An
instance fetches it once a day and every replica picks up a change within the hour. Nothing
about the instance is sent: no version, no id. The feed is display-only: the platform never
downloads or runs anything because of it, the image repository always comes from the
catalog built into the platform, and a learned version is used only when it is not older
than the built-in one.

The platform trusts only the feed signing key pinned in its own build (there is no setting
to change it). **At v0.11.0 the build pins no feed key yet**: until a release pins one, the
check does nothing, the console says "No release feed key in this build" and the sensor and
SDK versions built into the release apply, as in earlier releases.

Operators see it in the platform console under **Monitoring > Software updates**: the running
and latest platform release, newer releases, security advisories that affect the running
version, a **Sensors and SDK** list of the components the feed names, where the information
came from (daily online check or imported file), the last check and the next one, and a
switch for the daily online check (`VERSION_CHECK_ENABLED=false` turns it off for good). A
banner on every console page announces an update, highlighted for a security release. If the
feed cannot be read, the page says why (not published, signature invalid, unreachable,
expired) and the API logs one warning when that state changes.

**Air-gapped.** Set `VERSION_CHECK_ENABLED=false`. On a connected machine download
`openctem-releases.json` from the latest release, carry it in, and a super administrator
imports it under Monitoring > Software updates > Import (a fresh confirmation; the import is
audited). It is verified exactly like the online file, including rollback and expiry. Or
point `VERSION_CHECK_URL` at an internal https mirror of the file; a mirror on a private
address also needs the private egress allowlist (`OPENCTEM_HTTPSEC_*`).

### Sensors of your own

An organization that builds its own sensor on sdk-go records, per product, the latest and an
optional minimum release (Sensors > custom products, or
`PUT /api/v1/sensors/custom-products/{product}`; owners and administrators, audited, at most 50
products). Its sensors then get "update available" and "unsupported" verdicts, for that
organization only. Product names starting with `openctemio-` and products the platform lists
are refused, so an organization cannot change a first-party release line. A custom product
without a recorded line keeps only the SDK and protocol verdicts. Nothing is fetched.

### Where to look up versions

The current versions of each product are in
[`versions.yaml`](https://github.com/openctemio/openctem/blob/develop/versions.yaml)
(`platform.release`, `sensor.latest`, `sdk.latest`, `ci.latest`, `chart.version`) and on
each repository's releases page; this page does not repeat them, so it cannot go stale. The
Helm chart is published after the platform tag, so its `appVersion` can trail the platform:
check `helm search repo openctem/openctem --versions` for the newest chart, and the
[Kubernetes guide](../install/kubernetes.md) for the release it installs.

## Which version is running

- API: `GET /api/v1/version` (signed in) returns `version`, `commit`,
  `build_time` and `channel` (`release`, `rc` or `dev`). Development builds
  report `<highest tag>-dev+<commit>`.
- Web console: **Help**, **About** shows both.
- `/health` deliberately carries no version.

```bash
docker compose images
```

lists the image tags a Compose stack runs.
