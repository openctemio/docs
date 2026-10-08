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
  `openctem-web`, the all-in-one `openctem`, `migrations`, `seed` and
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
TAG=v0.9.0
IDENTITY='^https://github.com/openctemio/openctem/.github/workflows/docker-publish.yml@refs/tags/v'
ISSUER=https://token.actions.githubusercontent.com

# The signature of the image
cosign verify "ghcr.io/openctemio/openctem-api:$TAG" \
  --certificate-identity-regexp "$IDENTITY" --certificate-oidc-issuer "$ISSUER"

# The signed SBOM attestation
cosign verify-attestation --type spdxjson "ghcr.io/openctemio/openctem-api:$TAG" \
  --certificate-identity-regexp "$IDENTITY" --certificate-oidc-issuer "$ISSUER"
```

Run the same for every image you deploy (`openctem-web`, `openctem`,
`migrations`). The SBOM files are also attached to the GitHub Release as
`sbom-<image>-<version>.spdx.json`. Signed SBOM attestations start with the first
release after v0.8.0.

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

The sensor ([openctemio/sensor](https://github.com/openctemio/sensor)), the Go
SDK ([openctemio/sdk-go](https://github.com/openctemio/sdk-go)) and the Helm
chart ([openctemio/helm-charts](https://github.com/openctemio/helm-charts)) have
their own version numbers and release from their own repositories.

Compatibility is recorded in `versions.yaml` at the root of the openctem
repository and compiled into each API release as defaults:

| Entry | Effect in the platform | Override |
|---|---|---|
| `sensor.latest` | Sensors below it show "update available"; install snippets pin this sensor image tag. | `SENSOR_LATEST_VERSION` |
| `sensor.min` | Sensors below it are degraded, "version unsupported". | `SENSOR_MIN_VERSION` |
| `sdk.latest` / `sdk.min` | Sensors built with an older SDK are "outdated" / degraded. | `SENSOR_SDK_LATEST_VERSION` / `SENSOR_SDK_MIN_VERSION` |
| `chart.version` | The newest chart whose `appVersion` is the platform release. | |

After each platform release, the chart's `appVersion` is bumped to it.

For v0.9.0 the entries are: newest sensor v0.11.0, oldest supported sensor
v0.9.0 (sensor protocol v1 is removed, so older sensors cannot connect at all),
newest SDK v0.18.0.

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
