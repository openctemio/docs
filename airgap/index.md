---
title: Air-gapped and private registry
nav_order: 4.5
has_children: true
permalink: /airgap/
---

# Air-gapped and private registry installs
{: .no_toc }

How to run OpenCTEM where clusters and hosts cannot pull from the internet.
Images and release files reach your own registry and artifact store first,
verified, and every install pulls from there. Everything in this section works
without the OpenCTEM source code.

The templates and scripts live in
[`deploy/airgap/`](https://github.com/openctemio/openctem/tree/main/deploy/airgap)
of the `openctemio/openctem` repository. Each release also ships them as
`openctem-image-kit-<version>.tar.gz`, covered by the release's signed
`checksums-sha256.txt`.

The older page [Air-gapped and controlled supply chain](../install/air-gapped.md)
describes the same goal with manual commands. This section adds the tested
supply paths, the scripts, the CI templates and the install-target settings.
Where the two differ, follow the release you install and its notes.

1. TOC
{:toc}

---

## What stays verifiable

Whatever path you choose, these signatures survive the trip, so you can check
them at every step.

| Artifact | Signed by (keyless, issuer `https://token.actions.githubusercontent.com`) | Check |
|---|---|---|
| Images: `openctem-api`, `openctem-web`, `openctem-console`, `openctem-gateway`, `migrations`, `seed` and the all-in-one `openctem` | `https://github.com/openctemio/openctem/.github/workflows/docker-publish.yml@refs/tags/<version>`, plus SLSA provenance and an SPDX SBOM attestation | `cosign verify`, `cosign verify-attestation` |
| Release files (`checksums-sha256.txt` covers every archive and SBOM) | `https://github.com/openctemio/openctem/.github/workflows/release.yml@refs/tags/<version>` (the signed checksum file is new from the next release), plus SLSA provenance per archive | `cosign verify-blob`, `sha256sum -c`, `gh attestation verify` |
| Offline image bundle list `openctem-images-<version>.txt` | `.../docker-publish.yml@refs/tags/<version>` | `cosign verify-blob` |

Image signatures and attestations are cosign Sigstore bundles stored with the
OCI referrers **tag schema**. ghcr.io has no referrers API, so for an image
with index digest `sha256:abc...` the tag `sha256-abc...` holds an index of its
signature, provenance and SBOM attestation. Any registry that serves tags
serves them too, and `cosign` finds them there. `oras cp -r` copies an image
together with them and keeps every digest.

Always pin the identity to the exact tag
(`.../docker-publish.yml@refs/tags/v0.13.0`, for example). An image signed for
another release, or by another workflow, fails the check.

{: .warning }
Copying with `skopeo`, `crane` or `docker pull` and `docker push` copies the
image **without** its signatures. `cosign verify` then says "no signatures
found". `cosign save` does not capture them either. Use `mirror-images.sh` (it
uses `oras cp -r`) or the offline bundle.

## Decision guide

Answer in this order and stop at the first match.

1. **Production must have no connection to the outside at all, not even through
   a controlled zone.** Use [Path A3, fully offline](path-offline.md).
2. **You already run Nexus Repository proxies that reach the internet.** Use
   [Path P0, existing Nexus proxies](path-nexus-proxy.md). It needs no new
   egress and is the most automated path with the CI mirror job.
3. **You run GitLab and Harbor but no Nexus proxy.** Use
   [Path A2, the CI mirror job](path-ci-mirror.md) with a runner that has
   narrow egress.
4. **Only Harbor may reach the internet, and your policy allows one egress
   exception for it.** Use [Path A1](path-harbor-egress.md), and promote through
   the mirror script.
5. **Policy requires images built in-house from released binaries.** Use
   [Path B, build from archives](path-build-from-archives.md). The images get
   new digests and lose our signatures; you sign them with your own key.
6. **Images and archives take different routes** (for example images through
   Nexus, archives by transfer). Use [Mixed](path-mixed.md).

The [comparison page](comparison.md) puts all paths in one diagram and one
table.

## Supply paths

| Id | Path | Egress it needs | Keeps our signatures | Automation | Best for |
|---|---|---|---|---|---|
| P0 | [Existing Nexus Docker and raw proxies](path-nexus-proxy.md), CI job promotes into Harbor | none new: the Nexus proxies already reach the internet | yes | scheduled, hands-off | sites that already proxy packages through Nexus |
| A1 | [Harbor egress exception](path-harbor-egress.md) | Harbor to `ghcr.io` and `pkg-containers.githubusercontent.com`, through an allowlist proxy | through the promotion step | scheduled | Harbor-only sites |
| A2 | [CI mirror job](path-ci-mirror.md) | runner to the image source and release files | yes | scheduled, hands-off, merge request with new digests | GitLab sites without a Nexus proxy |
| A3 | [Fully offline transfer](path-offline.md) | none on the inside | yes (verified offline) | manual per release | zero-egress sites |
| B | [Build from released archives](path-build-from-archives.md) | release files only | no: new digests, you sign | scheduled or manual | policies that require in-house builds |
| Mixed | [Mixed](path-mixed.md) | as the parts | as the parts | as the parts | for example images through Nexus, archives by A3 |

## Scenario matrix

A scenario is a supply path, an install target and a lifecycle step. The first
table shows where each install target gets its bits from under each supply
path. The second shows how each lifecycle step runs under each path.

### Supply path by install target

| Supply path | Kubernetes (Helm) | Docker Compose | All-in-one image | Binaries and systemd | Ansible kit |
|---|---|---|---|---|---|
| P0 | `global.imageRegistry` points at the registry the job promoted into | `.env` written by `--env-out` | same registry, `openctem` image | release files through the raw proxy | `openctem_registry_mirror` |
| A1 | same | same | same | release files by [A3](path-offline.md) or a raw proxy (Harbor holds images only) | same |
| A2 | same, plus the merge request the bump job opens | same, plus the merge request | same | release files through the raw proxy (`RELEASES_BASE_URL`) | same |
| A3 | same, after the bundle is imported | same | same | files carried on the medium | same |
| B | digests of your rebuilt images, your key in the admission policy | `.env` with your rebuilt images | not built by the kit | not applicable: the archives are the input | not covered: the role verifies the release identity at the mirror, which rebuilt images do not carry |
| Mixed | as the parts | as the parts | as the parts | as the parts | as the parts |

Details per target: [Install targets](install-targets.md).

### Supply path by lifecycle step

| Step | P0 and A2 | A1 | A3 | B |
|---|---|---|---|---|
| First install | scheduled job or a manual run with `OPENCTEM_VERSION` | replication fills staging, then promote | import the bundle | manual run with `OPENCTEM_VERSION` |
| Routine upgrade | scheduled job finds the release, opens the merge request | same, promote by script | new bundle per release | scheduled or manual build |
| Emergency security patch | manual pipeline run, same checks | manual replication run, then promote | expedite the transfer, same checks | manual build run |
| Rollback | previous digest is still in `openctem-trusted` | same | previous bundle or previous digests in the registry | previous digests in the registry |

Details: [Lifecycle](lifecycle.md).

## The pages of this section

| Page | What it covers |
|---|---|
| [Comparison](comparison.md) | All paths in one diagram and one table |
| Supply paths | [P0](path-nexus-proxy.md), [A1](path-harbor-egress.md), [A2](path-ci-mirror.md), [A3](path-offline.md), [B](path-build-from-archives.md), [Mixed](path-mixed.md) |
| [Install targets](install-targets.md) | Helm, Compose, all-in-one, binaries, Ansible with a private registry |
| [Lifecycle](lifecycle.md) | First install, upgrade, emergency patch, rollback, pinning, retention, recovery, multi-site, audit evidence |
| [Sensors](sensors.md) | Sensors in restricted networks |
| [Content and intelligence feeds](feeds.md) | What each feed needs offline, and the known gaps |
| [Reference](reference.md) | Images, manifest formats, verification commands |
| [Troubleshooting](troubleshooting.md) | Symptoms and fixes per scenario |
| [Install from binaries](../install/binaries.md) | The non-container install |

## What this section does not claim

Everything here is taken from the release tooling in `deploy/airgap/`, the
release workflows and the chart and Ansible kit READMEs. Where a feature does
not exist yet (for example offline KEV and EPSS), the page says so under
[known gaps](feeds.md#known-gaps).
