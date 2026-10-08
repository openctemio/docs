---
title: Release process
parent: Developers
nav_order: 7
---

# Release process

How a version of OpenCTEM is cut and published. The policy for operators (what a version number
means, how long a release is supported, how to upgrade) is in
[Versioning and releases](../operations/versioning.md). The design is RFC-037.

## The rules

1. **One tag releases the platform.** The version is the `vX.Y.Z` tag on `main` of `openctem`;
   the API, the web console and every image share it.
2. **A release train leaves every other Monday.** Security and critical fixes ship at once as
   patch releases (hotfixes).
3. **The version is proposed from Conventional Commits** since the last tag and confirmed by a
   maintainer pressing Run. Before 1.0.0, a breaking change or a `feat` bumps the minor version and
   anything else the patch.
4. **Nothing is tagged by hand.** The workflows build the release branch, tag it and publish.
5. **No version is hardcoded.** Defaults (latest sensor and SDK versions, the platform release,
   the chart version) live in `versions.yaml` and are copied to their consumers by
   `.github/scripts/release/sync-versions.sh`; CI fails when they disagree.

## Running a release

| Step | Workflow | What happens |
|---|---|---|
| 1 | **Release Reminder** (Mondays of train weeks) | opens or updates the issue "Release train vX.Y.Z" with the proposed version, the `develop` commit the train would take and a changelog preview |
| 2 | **Release Train** (manual, `dry_run` first) | picks the newest `develop` commit whose required checks are green (or a given `sha`), builds `release/vX.Y.Z`, and opens the pull request into `main`, queued for the merge queue |
| 3 | merge queue | merges the release pull request |
| 4 | **Release Publish** | checks that `main`'s tree equals the release branch, tags `vX.Y.Z`, starts Docker Publish and Release, and opens follow-up pull requests |
| 5 | follow-ups | `develop` gets `main` merged back, `versions.yaml` bumped and the changelog fragments folded into `CHANGELOG.md`; `helm-charts` gets the new `appVersion` and chart version |

```bash
# plan only: the run summary shows the version, the commit and the changelog
gh workflow run release-train.yml --ref develop -f dry_run=true
# cut it
gh workflow run release-train.yml --ref develop -f dry_run=false
```

**Hotfix:** merge the fix into `develop`, then run Release Train with `mode: hotfix` and
`cherry_picks: <develop SHAs>`. The release is the last tag's patch + 1, built from that tag plus
the cherry-picks.

Release notes are generated from the commits, with `@mentions` escaped and e-mail addresses
removed. When a release needs an upgrade note, it is written in these docs
([Upgrading](../operations/upgrade.md)).

## What a tag publishes

**Docker Publish** builds every image natively on each architecture (linux/amd64 and
linux/arm64), smoke-tests it there (image architecture, ELF machine type, the binary runs), and
only then pushes it and merges the architectures into one manifest list per tag.

| Image | Built from | Contents |
|---|---|---|
| `ghcr.io/openctemio/openctem-api` | `api/Dockerfile` (target `production`) | API server, port 8080, non-root |
| `ghcr.io/openctemio/openctem-web` | `web/Dockerfile` | web console, port 3000 |
| `ghcr.io/openctemio/openctem` | `deploy/allinone/` | all-in-one: API, web and the Caddy gateway (PostgreSQL and Redis external) |
| `ghcr.io/openctemio/migrations` | `api/Dockerfile.migrations` | one-shot migration runner (golang-migrate) |
| `ghcr.io/openctemio/seed` | `api/Dockerfile.seed` | seeding utility |
| `ghcr.io/openctemio/admin-cli` | `api/Dockerfile.admin-cli` | admin command-line tools |

Tags: `vX.Y.Z` and `latest`. A `vX.Y.Z-staging` tag (or a manual run with
`environment: staging`) publishes `vX.Y.Z-staging` and `staging-latest` instead. During a
transition window the pre-monorepo names `ghcr.io/openctemio/api` and `ghcr.io/openctemio/ui`
receive identical copies of `openctem-api` and `openctem-web`.

**Supply chain:**

- Every image is signed with [cosign](https://github.com/sigstore/cosign) keyless signing (Sigstore,
  GitHub OIDC identity of the `docker-publish.yml` workflow on a `v` tag).
- Every image gets an SPDX JSON SBOM (generated with syft), attached to the GitHub Release as
  `sbom-<image>-<version>.spdx.json`.
- Every GitHub Action in the workflows is pinned to a full commit SHA; workflow tokens are
  read-only unless a job needs more.

Verify an image before you deploy it:

```bash
cosign verify ghcr.io/openctemio/openctem:vX.Y.Z \
  --certificate-identity-regexp '^https://github.com/openctemio/openctem/.github/workflows/docker-publish.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

**Release** creates the GitHub Release with the generated notes, the image pull lines and the
`bootstrap-admin` binaries for linux (amd64, arm64), macOS (amd64, arm64) and Windows (amd64),
published as `bootstrap-admin-<version>-<os>-<arch>.tar.gz` (`.zip` on Windows) with
`checksums-sha256.txt`.

## Other repositories

`sensor`, `sdk-go`, `ctis`, `ci` and `helm-charts` have their own version streams and tags on their
`main` branch:

- **sdk-go** follows the same rule (version proposed from Conventional Commits, changelog
  fragments in `changelog.d/`, a Release Prepare workflow that opens `release/vX.Y.Z` into `main`).
  Its public packages carry a stability tier (Stable, Beta, Frozen, Internal-bound, Deprecated) and
  CI refuses incompatible changes to Stable packages without a `breaking-change` label and an
  upgrade note.
- **ctis** versions its Go module with the specification: module `v1.MINOR.x` implements CTIS
  `1.MINOR`; a minor release only adds optional members.
- **helm-charts** is bumped by the platform release (Release Publish opens the pull request) and
  published with chart-releaser.
