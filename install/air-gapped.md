---
title: Air-gapped and controlled supply chain
parent: Install
nav_order: 10
---

# Air-gapped and controlled supply-chain installation
{: .no_toc }

This guide is for organizations that approve every OpenCTEM version before it
runs, use only the published containers and binaries (they do not build from
source), and do not let production pull anything from the internet. It
explains what each release gives you to check, how to bring a release into
your own registry with its signatures, SBOMs and provenance, how to approve it
with your own signature, and how to deploy and upgrade it by digest. It also
lists what the platform would otherwise fetch from the internet, and how to
replace or turn off each of those downloads.

For the tested supply paths, the scripts and templates of the release's image
kit, and a decision guide, see the section
[Air-gapped and private registry](../airgap/).

The commands were checked against release v0.11.0 (chart 0.29.0 for v0.10.1,
sensor v0.23.2). Replace the versions with the release you take in.

1. TOC
{:toc}

---

## Choose an approach

| Approach | Production network | Best for | Effort |
|---|---|---|---|
| [1. Registry mirror through a transfer zone](#1-registry-mirror-through-a-transfer-zone) | Pulls only from your internal registry | Most organizations: a transfer zone (DMZ) may reach the internet, production may not | Low |
| [2. Fully offline transfer](#2-fully-offline-transfer) | No connection to the outside at all | Isolated networks, data diodes, removable media | Medium |
| [3. GitLab release intake (GitOps)](#3-gitlab-release-intake-gitops) | Pulls only from your internal registry | Teams that approve changes through merge requests and promote dev to staging to production | Medium, then automatic |
| [4. Dual signatures](#4-dual-signatures-your-approval-as-a-signature) | Admission or pre-flight checks enforce it | Anyone who wants "only images we approved" enforced by a machine, not by a process | Low on top of 1, 2 or 3 |

The approaches combine: approach 1 or 2 moves the images, approach 3 automates
it, approach 4 makes your approval checkable everywhere. Read
[What a release contains](#what-a-release-contains) and
[What the platform contacts](#what-the-platform-contacts) first; they apply to
all four.

The flow, whatever tools you choose:

```mermaid
flowchart LR
    subgraph pub["Public"]
        GH["ghcr.io/openctemio<br/>images + signatures,<br/>SBOM, provenance"]
    end
    subgraph dmz["Transfer zone"]
        IN["Intake: copy by digest,<br/>verify, scan"]
        AP["Approve and<br/>countersign"]
    end
    subgraph prod["Production network"]
        REG["Internal registry"]
        DEP["Compose, Helm<br/>or Ansible,<br/>pinned by digest"]
    end
    GH --> IN --> AP --> REG --> DEP
```

## What a release contains

One tag `vX.Y.Z` of `openctemio/openctem` publishes every platform image from
the same commit, for `linux/amd64` and `linux/arm64`, to `ghcr.io/openctemio`
(see [Images](index.md#images)):

| Image | Needed for |
|---|---|
| `openctem-api` | Compose, Helm, Ansible (also runs the sensor enrollment and the job signer) |
| `openctem-web` | Compose, Helm, Ansible |
| `openctem-console` | Compose, Helm, Ansible (the platform console) |
| `openctem-gateway` | Compose, Helm (Caddy gateway mode), Ansible |
| `migrations` | Compose, Helm, Ansible |
| `openctem` | The all-in-one image only |
| `admin-cli` | Optional: `bootstrap-admin` as an image |
| `seed` | Never in production (demo data) |

Before an image is published, the release workflow builds it on each
architecture, runs it, and fails the release on a size budget, a root user, a
setuid file or an OS advisory found by Trivy. Then every image gets three
signed records, all made in the same workflow run:

| Record | What it proves | Predicate type | Check with |
|---|---|---|---|
| Signature | The digest was published by the release workflow at that tag | `https://sigstore.dev/cosign/sign/v1` | `cosign verify` |
| SBOM | The SPDX 2.3 list of packages in the image (made with Syft) | `https://spdx.dev/Document` | `cosign verify-attestation --type spdxjson` |
| Build provenance | SLSA v1: the repository, the workflow, the tag and the exact commit the image was built from | `https://slsa.dev/provenance/v1` | `cosign verify-attestation --type slsaprovenance1` or `gh attestation verify` |

All three are **keyless Sigstore signatures**: there is no OpenCTEM public key
to download. The signing certificate is issued to the GitHub Actions identity of
the release workflow, and that identity is what you pin:

| Field | Value |
|---|---|
| Certificate identity | `https://github.com/openctemio/openctem/.github/workflows/docker-publish.yml@refs/tags/vX.Y.Z` |
| OIDC issuer | `https://token.actions.githubusercontent.com` |

Pin the **exact** identity with the tag you approve (`--certificate-identity`),
not a regular expression. A signature from the release workflow at `v0.11.0`
then proves that this digest is what `v0.11.0` published, whatever the mutable
tag points to today. It also refuses `-staging` builds, which are signed by the
same workflow under another tag.

**Where the records are stored.** They are Sigstore bundles
(`application/vnd.dev.sigstore.bundle.v0.3+json`) attached to the image digest
as OCI 1.1 referrers. GHCR has no referrers API, so they are reached through
the fallback tag `sha256-<digest of the image index>` in the same repository.
Two consequences:

- Use **cosign v3** (or cosign 2.4 or later with `--new-bundle-format`). Older
  cosign answers `no signatures found`.
- A plain image copy (`crane copy`, `skopeo copy`, `docker push`) moves the
  image but **not** these records. Copy the referrers too: see
  [Copy by digest, with the signatures](#copy-by-digest-with-the-signatures).

Each bundle carries its certificate, the transparency log inclusion proof and a
signed timestamp, so a signature can be verified without contacting Sigstore,
given the Sigstore trusted root (see
[Verify without internet access](#verify-without-internet-access)).

Other artifacts:

| Artifact | Where | Signed |
|---|---|---|
| Sensor images `ghcr.io/openctemio/sensor:vX.Y.Z` and per-tool variants `vX.Y.Z-<tool>` (`opengrep`, `semgrep`, `trivy`, `nuclei`, `betterleaks`) | Released separately from `openctemio/sensor` | Keyless, identity `https://github.com/openctemio/sensor/.github/workflows/docker-publish.yml@refs/tags/vX.Y.Z`; SBOM and provenance are BuildKit attestations inside the image index (unsigned) |
| Sensor binaries | `openctemio/sensor` releases: archives and `checksums.txt` | `checksums.txt.sigstore.json`, identity `https://github.com/openctemio/sensor/.github/workflows/release.yml@refs/tags/vX.Y.Z` |
| `bootstrap-admin` binaries | `openctemio/openctem` releases, with `checksums-sha256.txt` | Checksums only, not signed: prefer the signed `openctem-api` or `admin-cli` image, which contain it |
| Helm chart | `openctemio/helm-charts` releases (`openctem-<chart version>.tgz`) | Not signed: record its SHA-256 and review the rendered manifests ([Helm](#helm)) |
| Compose files | `api/deploy/` of the repository at the release commit | Take them from the commit named in the signed provenance ([Deployment files](#deployment-files-from-the-signed-commit)) |
| Ansible kit | `openctemio/openctem-ansible`; `versions.yml` pins every image by digest | Images verified by the kit; the kit itself is a repository you review |

OpenCTEM has no license key, activation or edition check: a self-managed
installation needs no connection to OpenCTEM to run.

## What the platform contacts

There is no usage telemetry of any kind: the API sends nothing about the
installation anywhere, and the web images are built with
`NEXT_TELEMETRY_DISABLED=1`. The outbound requests below are all feature
downloads. The API makes them directly; it does not use an HTTP proxy for
them, so in a network with limited egress allow them at the firewall.

| Destination | Purpose | Default | Air-gapped setting |
|---|---|---|---|
| `github.com`, `release-assets.githubusercontent.com` | The signed release feed (version check) | On, but inert in v0.11.0: no feed key is pinned in this build, so no request is made | `VERSION_CHECK_ENABLED=false`; import the file by hand ([Release information](#release-information)) |
| `epss.empiricalsecurity.com`, `www.cisa.gov`, `raw.githubusercontent.com` | EPSS scores and the CISA KEV catalog (KEV falls back to its GitHub mirror) | On | Turn each source off in the platform console, **Scanning > Threat intelligence** ([Threat intelligence](#threat-intelligence-epss-and-kev)) |
| `crt.sh`, `api.certspotter.com` | Certificate Transparency discovery | On | `CERT_MONITOR_ENABLED=false` |
| `stat.ripe.net` | Lookups of network seeds an organization adds for attack-surface discovery | Only when an organization adds network seeds | Turn network lookups off in the organization's attack-surface settings, or add no network seeds |
| `ctem.org` | CTEM-ID catalog feed | On | Leave unreachable, or set `CTEM_ID_FEED_URL` to an internal https copy |
| `github.com` (`openctemio/vulnfeed-bundles`, `openctemio/programfeed`) | Vulnerability and program feeds | Off until you pin a root key | Keep off, or import from a directory ([Feeds](#vulnerability-and-program-feeds)) |
| `acme-v02.api.letsencrypt.org` | Certificates in TLS mode `acme` | Only in mode `acme` | Use TLS mode `internal` or `files` ([TLS](tls-and-gateway.md)) |
| Integrations, SSO, SMTP, AI providers | Only what you configure | Off | Point them at internal services |

A request to a host the network does not let through fails, is logged, and is
retried later: nothing breaks, but the log gets noisy. Turning the feature off
is cleaner.

The interactive API reference page (`/docs` of the API) loads its viewer from
`cdn.jsdelivr.net` in the browser; in an isolated network that page stays blank.
The rest of the web console loads nothing from outside the installation.

## Tools for the intake

Run the intake on a dedicated host or runner in the transfer zone. Pin the tool
versions you approved, like any other software:

| Tool | Used for | Notes |
|---|---|---|
| [cosign](https://github.com/sigstore/cosign) v3 | Verifying signatures and attestations, countersigning | Also published as an image: `ghcr.io/sigstore/cosign/cosign:v3.1.3` |
| [oras](https://oras.land) v1.2 or later | Copying images **with** their referrers (`oras cp -r`), to a registry or to files | Recommended for both approaches |
| [crane](https://github.com/google/go-containerregistry) | Resolving digests, copying single tags | Does not follow referrers by itself |
| [skopeo](https://github.com/containers/skopeo) | Copying images between registries and archives | Copies the image, not the referrers |
| [Trivy](https://trivy.dev) or [Grype](https://github.com/anchore/grype) | Scanning images or SBOMs with your own vulnerability data | Mirror their databases for use inside |
| `jq`, `sha256sum` | Reading attestations, checksums | |
| `gh` (optional) | `gh attestation verify` as a second provenance check | Needs internet |

## 1. Registry mirror through a transfer zone

The intake host may reach `ghcr.io`; production reaches only your registry.
Works the same with GitLab Container Registry, Harbor, Nexus Repository and
Artifactory: they all store OCI artifacts, and registries without the OCI
referrers API keep the signatures under the same `sha256-<digest>` fallback tag
that cosign and oras read. Create a project or repository for OpenCTEM (for
example `registry.example.com/openctem/`), give the intake a push-only robot or
deploy account, and give production pull-only credentials.

{: .note }
Some registries need OCI artifacts or "unknown" media types allowed on the
repository before they accept the signature manifests, and some clean up tags
that look unused. Exclude the `sha256-*` tags from retention rules, or the
signatures disappear and every verification afterwards fails.

### Pin the release to digests

Resolve each tag to its digest once, at the start, and use only digests from
then on:

```bash
RELEASE=v0.11.0
SRC=ghcr.io/openctemio
DST=registry.example.com/openctem
IMAGES="openctem-api openctem-web openctem-console openctem-gateway migrations"
# add openctem (all-in-one) or admin-cli when you deploy them

mkdir -p "intake/$RELEASE"
for img in $IMAGES; do
  printf '%s %s\n' "$img" "$(crane digest "$SRC/$img:$RELEASE")"
done | tee "intake/$RELEASE/digests.txt"
```

The digest is the one of the multi-architecture image index: it covers both
architectures, and it is what the signatures sign.

### Copy by digest, with the signatures

`oras cp -r` copies the image index, both platform images and every referrer
(signature, SBOM, provenance) in one step:

```bash
while read -r img digest; do
  oras cp -r "$SRC/$img@$digest" "$DST/$img:$RELEASE"
done < "intake/$RELEASE/digests.txt"
```

The digest at the destination is identical. Alternatives:

- **crane or skopeo, then the referrers tag.** Copy the image, then copy its
  `sha256-<hex>` tag, which holds the signatures:

  ```bash
  crane copy "$SRC/$img@$digest" "$DST/$img:$RELEASE"
  crane copy "$SRC/$img:sha256-${digest#sha256:}" "$DST/$img:sha256-${digest#sha256:}"
  # or: skopeo copy --all --preserve-digests docker://$SRC/$img@$digest docker://$DST/$img:$RELEASE
  ```

- **Registry replication or pull-through cache** (Harbor replication, a GitLab
  dependency proxy, a Nexus or Artifactory remote repository). Convenient, but
  check that the signatures arrive: many caches fetch only what a client pulls,
  and nothing pulls the `sha256-*` tag. Run the verification below against the
  internal copy; if it says `no signatures found`, copy the referrers explicitly.

Do not use `cosign copy` for these images: it copies the older `.sig` and `.att`
tag layout, not Sigstore bundles stored as referrers.

### Verify the signature, the SBOM and the provenance

Verify the copy in **your** registry, not the original: that proves the
signatures travelled with the image.

```bash
ID="https://github.com/openctemio/openctem/.github/workflows/docker-publish.yml@refs/tags/$RELEASE"
ISSUER=https://token.actions.githubusercontent.com

while read -r img digest; do
  ref="$DST/$img@$digest"
  cosign verify "$ref" \
    --certificate-identity "$ID" --certificate-oidc-issuer "$ISSUER" > "intake/$RELEASE/$img.signature.json"
  cosign verify-attestation "$ref" --type spdxjson \
    --certificate-identity "$ID" --certificate-oidc-issuer "$ISSUER" > "intake/$RELEASE/$img.sbom.att.json"
  cosign verify-attestation "$ref" --type slsaprovenance1 \
    --certificate-identity "$ID" --certificate-oidc-issuer "$ISSUER" > "intake/$RELEASE/$img.provenance.att.json"
done < "intake/$RELEASE/digests.txt"
```

Every command must exit 0. Then extract the SBOM and check the provenance says
what you expect:

```bash
while read -r img digest; do
  # The SBOM, as a plain SPDX file for your scanners and records
  head -1 "intake/$RELEASE/$img.sbom.att.json" | jq -r .payload | base64 -d \
    | jq .predicate > "intake/$RELEASE/$img.spdx.json"

  # The provenance: repository, workflow, tag and commit
  head -1 "intake/$RELEASE/$img.provenance.att.json" | jq -r .payload | base64 -d \
    | jq -e --arg ref "refs/tags/$RELEASE" '
        .predicate.buildDefinition.externalParameters.workflow
        | select(.repository == "https://github.com/openctemio/openctem"
                 and .path == ".github/workflows/docker-publish.yml"
                 and .ref == $ref)' > /dev/null
  head -1 "intake/$RELEASE/$img.provenance.att.json" | jq -r .payload | base64 -d \
    | jq -r '.predicate.buildDefinition.resolvedDependencies[0].digest.gitCommit'
done < "intake/$RELEASE/digests.txt" | sort -u > "intake/$RELEASE/commit.txt"

wc -l < "intake/$RELEASE/commit.txt"   # must be 1: every image from the same commit
```

With internet access, `gh attestation verify oci://$SRC/openctem-api@$digest --owner openctemio`
is an independent second check of the provenance.

### Scan with your own data

The release pipeline already refused OS advisories with a fix, but your policy
and your vulnerability data are what count:

```bash
while read -r img digest; do
  trivy image --severity HIGH,CRITICAL --ignore-unfixed \
    --format json --output "intake/$RELEASE/$img.trivy.json" "$DST/$img@$digest"
  # or from the signed SBOM, without pulling the image:
  grype "sbom:intake/$RELEASE/$img.spdx.json" -o json > "intake/$RELEASE/$img.grype.json"
done < "intake/$RELEASE/digests.txt"
```

Inside an isolated network, point the scanner at a mirrored database (for
Trivy, `--db-repository registry.example.com/mirror/trivy-db:2` and
`--java-db-repository`; for Grype, a database file imported with
`grype db import`).

Decide what blocks a release (for example: a critical advisory with a fix,
not accepted in writing, blocks it) and record each accepted finding with a
reason and an expiry date.

### Approve

Approval is a record and, ideally, a signature:

- Record: the release, each image and digest, the verification output, the
  SBOMs, the scan reports, the accepted findings, the approver and the change
  ticket. Keep them with the release ([What to keep](#what-to-keep-for-audit)).
- Signature: sign the approved digests with your own key so deployments can
  check your approval by machine ([Dual signatures](#4-dual-signatures-your-approval-as-a-signature)).

### Deploy pinned by digest

Production then uses only `registry.example.com/openctem/...@sha256:...`
references. Never deploy by tag: a tag in your registry can be moved; a digest
cannot.

#### Docker Compose

The Compose file builds each reference as `${X_IMAGE}:${X_VERSION}`, and the
migrations image shares `API_VERSION` with the API, so per-image variables
cannot pin every digest. Use an override file instead: it names the full
reference of every service, including the bundled PostgreSQL and Redis.

```yaml
# api/deploy/docker-compose.digests.yml: v0.11.0 from the internal registry
services:
  gateway-init:  { image: registry.example.com/openctem/openctem-gateway@sha256:e3ba3279b85f81894c15ccc3164588f435e37b39b8a578ee5c9408bb010c2873 }
  gateway:       { image: registry.example.com/openctem/openctem-gateway@sha256:e3ba3279b85f81894c15ccc3164588f435e37b39b8a578ee5c9408bb010c2873 }
  web:           { image: registry.example.com/openctem/openctem-web@sha256:7c083015129f9606973905cdf96f2ccbf3cda8aa9eeedeb9b43b262ef14504e4 }
  console:       { image: registry.example.com/openctem/openctem-console@sha256:ea69de54b36900d9947482d37e86ef488c06e9f0c6802a4838ad7191e9ee12b3 }
  migrate:       { image: registry.example.com/openctem/migrations@sha256:5ebf7a763dfcdacc3677b0956b58eb97a7625ad1ee8e82068b9997b1efeb75ec }
  api:           { image: registry.example.com/openctem/openctem-api@sha256:71315cf69e763ad19bdc7417c495408809a1c26c69df50004cc416741906c344 }
  # Third-party images you mirrored and approved the same way
  db-roles:      { image: registry.example.com/mirror/postgres@sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3 }
  db-grants:     { image: registry.example.com/mirror/postgres@sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3 }
  datastore-tls: { image: registry.example.com/mirror/postgres@sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3 }
  postgres:      { image: registry.example.com/mirror/postgres@sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3 }
  redis:         { image: registry.example.com/mirror/redis@sha256:858f009f9709ce576febc734aa78b8f6d624b82571f9ddb6bda4377c833b3499 }
```

The PostgreSQL and Redis digests above are `postgres:17.11` and
`redis:7.4.11-alpine`, the versions the Ansible kit pins. With the sensor
overlay, add `sensor-enrollment` (the API digest) and `sensor`.

```bash
cd api/deploy
docker login registry.example.com          # pull-only credentials
docker compose -f docker-compose.yml -f docker-compose.digests.yml config --images   # every line must be @sha256
docker compose -f docker-compose.yml -f docker-compose.digests.yml pull
docker compose -f docker-compose.yml -f docker-compose.digests.yml up -d
```

Pass the same `-f` files to every later command (or set
`COMPOSE_FILE=docker-compose.yml:docker-compose.digests.yml` in `.env`). Keep
`VERSION_CHECK_ENABLED=false` and the other settings from
[What the platform contacts](#what-the-platform-contacts) in `.env`.

#### All-in-one image

```bash
docker run ... registry.example.com/openctem/openctem@sha256:<digest of openctem:vX.Y.Z>
```

Verify the `openctem` image with the same identity as the others.

#### Helm

The chart builds `repository:tag`, so put the digest in the tag
(`v0.10.1@sha256:...`); the container runtime then pulls by digest. Chart 0.29.0
deploys v0.10.1:

```yaml
# values-airgap.yaml (chart 0.29.0, OpenCTEM v0.10.1)
imagePullSecrets:
  - name: internal-registry
api:
  image:
    repository: registry.example.com/openctem/openctem-api
    tag: "v0.10.1@sha256:547f5a5cef7057438f490ba88808e5502c61ea4a7674b2845a701897a06328d3"
  migrations:
    image:
      repository: registry.example.com/openctem/migrations
      tag: "v0.10.1@sha256:febae591a18002730726d90a92e484b0314b023258a4d5138720c12e888abc56"
ui:
  image:
    repository: registry.example.com/openctem/openctem-web
    tag: "v0.10.1@sha256:0c0d9bd817232e41a8c557cfc5b97b434f6c404acb37c8f349485b047e87b71f"
console:
  image:
    repository: registry.example.com/openctem/openctem-console
    tag: "v0.10.1@sha256:7a64c8abf1f2d1acbcd1b27cc834a412abf3447084cedb04b1745b5d791b2ee0"
gateway:
  caddy:
    image:
      repository: registry.example.com/openctem/openctem-gateway
      tag: "v0.10.1@sha256:6e073b0480df602a71155f03b0e20954b45257ba0df404ff8b01d9a659f886eb"
sensor:
  image:
    repository: registry.example.com/openctem/sensor
    tag: "v0.23.2@sha256:5a06fc53017c6bc5e46cd8f0e5573fc12275718b9c1ac8bc5417ee932de783e9"
  sandbox:
    installerImage: "registry.example.com/mirror/busybox:1.37.0@sha256:bdf57e528e45e4433820e045b29b4597825a1c9e38353532d90a01445013f82e"
tests:
  image:
    repository: registry.example.com/mirror/busybox
    tag: "1.37.0@sha256:bdf57e528e45e4433820e045b29b4597825a1c9e38353532d90a01445013f82e"
```

Use external PostgreSQL and Redis in production; if you keep the bundled
evaluation subcharts, mirror `postgresql.image` and `redis.image` too. The chart
itself is not signed: mirror the `.tgz` (for example
`helm push openctem-0.29.0.tgz oci://registry.example.com/openctem/charts`),
record its SHA-256, and review `helm template` output in the approval. Check
the rendered manifests contain no image outside your registry:

```bash
helm template openctem openctem-0.29.0.tgz -f values.yaml -f values-airgap.yaml \
  | grep -E '^\s+image:' | sort -u
```

#### Ansible kit

The kit pins every image by digest in `versions.yml` and verifies the OpenCTEM
images with cosign before pulling them. It has no registry setting yet (planned),
so point it at your registry by overriding the pins with an extra-vars file,
which takes precedence over `versions.yml`:

```yaml
# airgap-vars.yml: replaces openctem_releases as a whole, keep the previous release for rollback
openctem_releases:
  v0.11.0:
    admin_plane: true
    console_db_role: true
    console_service: true
    admin_audit_sink_required: true
    api: registry.example.com/openctem/openctem-api@sha256:71315cf69e763ad19bdc7417c495408809a1c26c69df50004cc416741906c344
    web: registry.example.com/openctem/openctem-web@sha256:7c083015129f9606973905cdf96f2ccbf3cda8aa9eeedeb9b43b262ef14504e4
    gateway: registry.example.com/openctem/openctem-gateway@sha256:e3ba3279b85f81894c15ccc3164588f435e37b39b8a578ee5c9408bb010c2873
    migrations: registry.example.com/openctem/migrations@sha256:5ebf7a763dfcdacc3677b0956b58eb97a7625ad1ee8e82068b9997b1efeb75ec
    console: registry.example.com/openctem/openctem-console@sha256:ea69de54b36900d9947482d37e86ef488c06e9f0c6802a4838ad7191e9ee12b3
  v0.10.1:
    admin_plane: true
    console_db_role: true
    console_service: true
    api: registry.example.com/openctem/openctem-api@sha256:547f5a5cef7057438f490ba88808e5502c61ea4a7674b2845a701897a06328d3
    web: registry.example.com/openctem/openctem-web@sha256:0c0d9bd817232e41a8c557cfc5b97b434f6c404acb37c8f349485b047e87b71f
    gateway: registry.example.com/openctem/openctem-gateway@sha256:6e073b0480df602a71155f03b0e20954b45257ba0df404ff8b01d9a659f886eb
    migrations: registry.example.com/openctem/migrations@sha256:febae591a18002730726d90a92e484b0314b023258a4d5138720c12e888abc56
    console: registry.example.com/openctem/openctem-console@sha256:7a64c8abf1f2d1acbcd1b27cc834a412abf3447084cedb04b1745b5d791b2ee0
openctem_cosign_image: registry.example.com/mirror/cosign:v3.1.3@sha256:9e5c2f2edc34351160407ca3416c61855bdf9403c3c5936e0f0be7fc261611b8
openctem_postgres_image: registry.example.com/mirror/postgres:17.11@sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3
openctem_redis_image: registry.example.com/mirror/redis:7.4.11-alpine@sha256:858f009f9709ce576febc734aa78b8f6d624b82571f9ddb6bda4377c833b3499
openctem_rclone_image: registry.example.com/mirror/rclone:1.75.2@sha256:2687085f718d3c628f7fdfb77c52a1d344332aed543110bb88088f2c70d43eb5
# Docker Engine from your apt mirror (the key's SHA-256 and fingerprint stay pinned in versions.yml)
docker_apt_url: https://apt.example.com/docker/linux/ubuntu
docker_apt_key_url: https://apt.example.com/docker/linux/ubuntu/gpg
```

```bash
ansible-playbook site.yml -e @airgap-vars.yml -e openctem_version=v0.11.0
```

Things to know:

- The VM pulls from your registry with the Docker credentials of its root
  user: run `docker login registry.example.com` on the VM once, with pull-only
  credentials, or allow anonymous pulls from the VM's network.
- The kit's signature check runs cosign on the VM. Keyless verification needs
  the Sigstore trusted root, which cosign downloads from
  `tuf-repo-cdn.sigstore.dev`; the kit cannot pass a local trusted root yet
  (planned). Either allow that one host from the VM, or set
  `openctem_verify_signatures: false` and run the
  [pre-flight check](#compose-and-ansible-check-both-signatures-before-deploying)
  on the controller before every play. Do not simply turn the check off.
- Keep `airgap-vars.yml` under review like `versions.yml`: it decides what runs.

### Deployment files from the signed commit

The Compose files, the gateway configuration and the database role scripts are
configuration, not images. Take them from the exact commit the signed
provenance names, so they match the images:

```bash
COMMIT=$(cat "intake/$RELEASE/commit.txt")
git clone --filter=blob:none https://github.com/openctemio/openctem.git src
git -C src archive --format=tar.gz -o "intake/$RELEASE/deploy-$RELEASE.tar.gz" "$COMMIT" api/deploy
sha256sum "intake/$RELEASE/deploy-$RELEASE.tar.gz" > "intake/$RELEASE/deploy-$RELEASE.tar.gz.sha256"
git -C src diff --stat "<previous release commit>" "$COMMIT" -- api/deploy   # what changed, for the review
```

Release tags are not signed with a key; the commit recorded in the signed
provenance is the trustworthy link between the images and these files.

### Pros, cons and security notes

- Pros: simple, fast, keeps every signature, works with any OCI registry, and
  production never needs internet access.
- Cons: the transfer zone needs internet access to `ghcr.io` (and Sigstore for
  online verification); registries differ in how they show and retain referrers.
- Security: the intake host holds push rights to the production registry, so
  treat it as a production system (hardened, logged, no interactive use).
  Production pulls with read-only credentials. Verify in your registry, after
  the copy. Turn on tag immutability for release tags where the registry
  offers it.

## 2. Fully offline transfer

When nothing may connect across the boundary, move files. The same records
travel: the image, its referrers, and the Sigstore trusted root needed to
verify them inside.

### Outside: export

```bash
RELEASE=v0.11.0
OUT="openctem-$RELEASE"
mkdir -p "$OUT"

# 1. Digests (as in approach 1)
for img in openctem-api openctem-web openctem-console openctem-gateway migrations; do
  printf '%s %s\n' "$img" "$(crane digest "ghcr.io/openctemio/$img:$RELEASE")"
done > "$OUT/digests.txt"

# 2. Images with every referrer, into one OCI image layout
while read -r img digest; do
  oras cp -r "ghcr.io/openctemio/$img@$digest" --to-oci-layout "$OUT/oci:$img-$RELEASE"
done < "$OUT/digests.txt"

# 3. Verify outside too (online), and keep the outputs
#    (the cosign commands of approach 1, against ghcr.io)

# 4. The Sigstore trusted root, for verification inside
cosign initialize
cp ~/.sigstore/root/tuf-repo-cdn.sigstore.dev/targets/trusted_root.json "$OUT/"

# 5. Deployment files from the signed commit, SBOMs, scan reports
#    (see approach 1)

# 6. One archive and its checksum
tar -cf "$OUT.tar" "$OUT"
sha256sum "$OUT.tar" > "$OUT.tar.sha256"
```

`oras cp -r --to-oci-layout` writes a standard OCI image layout directory: it
holds both architectures and the signatures, SBOM and provenance. For
comparison, `skopeo copy --all docker://... oci-archive:file.tar` and
`docker save` keep the image only, and `docker save` also loses the index
digest; neither is enough on its own.

The five v0.11.0 platform images take about 430 MB (compressed, both
architectures); the all-in-one image about 310 MB and the default sensor image
about 290 MB more.

{: .note }
An official offline bundle per release (images, referrers, deployment files,
SBOMs, trusted root and one signed manifest) with an `openctem bundle verify`
command is planned. Until then, the procedure on this page produces the same
contents by hand.

### The crossing

- Carry `openctem-vX.Y.Z.tar` and its `.sha256` through your approved channel
  (data diode, scanned removable media, a cross-domain transfer service).
- Send the checksum through a different channel than the archive (for example
  in the signed change ticket), so one compromised channel cannot replace both.
- Scan the media at the entry point according to your policy.

### Inside: verify and load

```bash
sha256sum -c openctem-v0.11.0.tar.sha256
tar -xf openctem-v0.11.0.tar && cd openctem-v0.11.0

DST=registry.example.com/openctem
while read -r img digest; do
  oras cp -r --from-oci-layout "oci:$img-v0.11.0" "$DST/$img:v0.11.0"
done < digests.txt

ID="https://github.com/openctemio/openctem/.github/workflows/docker-publish.yml@refs/tags/v0.11.0"
while read -r img digest; do
  cosign verify "$DST/$img@$digest" --trusted-root trusted_root.json \
    --certificate-identity "$ID" --certificate-oidc-issuer https://token.actions.githubusercontent.com
  cosign verify-attestation "$DST/$img@$digest" --type slsaprovenance1 --trusted-root trusted_root.json \
    --certificate-identity "$ID" --certificate-oidc-issuer https://token.actions.githubusercontent.com
done < digests.txt
```

### Verify without internet access

With `--trusted-root`, cosign verifies the certificate chain, the transparency
log inclusion proof and the signed timestamp from the bundle itself and contacts
nothing (it reports "verified offline"). Without it, cosign tries to download
the trusted root and fails in an isolated network. Notes:

- Bring a fresh `trusted_root.json` with every transfer. Sigstore rotates its
  keys now and then; a stale file refuses signatures made with newer keys.
- The trusted root is itself trust material: take it from a cosign that
  initialized from the Sigstore TUF repository (as above), and record its
  SHA-256 in the change.
- `--offline` is deprecated in cosign v3; `--trusted-root` is what makes the
  check offline.

Then deploy exactly as in approach 1. No registry inside? Run a minimal one
(for example the `registry:2` image from your mirror) on the deployment host:
digest pinning needs a registry, because `docker load` does not keep the index
digest.

### Pros, cons and security notes

- Pros: no network path at all; every byte is checked against a checksum and a
  signature on both sides.
- Cons: manual steps per release; the trusted root and your scanner databases
  must travel too; larger transfers.
- Security: verify outside (to stop a bad transfer early) and inside (to trust
  nothing about the transfer). Keep the exported directory read-only after
  verification, and destroy temporary media according to your policy.

## 3. GitLab release intake (GitOps)

The same steps as a pipeline: a release is imported, verified, scanned and
checked against your policy automatically, and the result is a merge request
that bumps the digests in your deployment repository. People approve the merge
request; merging it deploys. Promotion from dev to staging to production is
one more merge request each.

```mermaid
flowchart LR
    T["New release<br/>(scheduled check or manual)"] --> I["import"] --> V["verify"] --> S["scan"] --> P["policy"] --> MR["merge request:<br/>bump digests in dev"]
    MR -->|approved, merged| D["deploy dev"]
    D -->|promotion MR| ST["staging"]
    ST -->|promotion MR,<br/>change approval| PR["production"]
```

Two projects:

- **`platform/openctem-intake`**: the pipeline below. Its runner sits in the
  transfer zone (internet access to `ghcr.io` and Sigstore, push access to the
  internal registry). Protected variables hold the registry push credentials
  and a project access token for the deployment repository.
- **`platform/openctem-deploy`**: one directory per environment, each with a
  lock file of digests and the deployment configuration (Compose override,
  Helm values or Ansible extra vars). Production runners and the GitOps
  controller read only this repository.

### The intake pipeline

```yaml
# .gitlab-ci.yml of platform/openctem-intake
# Run with RELEASE=vX.Y.Z (web UI, schedule or API). Tools come from your mirror, pinned by digest.
variables:
  RELEASE: ""
  SRC: ghcr.io/openctemio
  DST: $CI_REGISTRY/platform/openctem-mirror
  IMAGES: "openctem-api openctem-web openctem-console openctem-gateway migrations"
  ISSUER: https://token.actions.githubusercontent.com

workflow:
  rules:
    - if: $RELEASE =~ /^v[0-9]+\.[0-9]+\.[0-9]+$/

stages: [import, verify, scan, policy, propose]

.tools:
  image: $CI_REGISTRY/platform/intake-tools@sha256:<digest>   # cosign v3, oras, crane, jq, trivy, grype
  before_script:
    - echo "$CI_REGISTRY_PASSWORD" | oras login -u "$CI_REGISTRY_USER" --password-stdin "$CI_REGISTRY"
    - export ID="https://github.com/openctemio/openctem/.github/workflows/docker-publish.yml@refs/tags/$RELEASE"
    - mkdir -p out

import:
  extends: .tools
  stage: import
  script:
    - for img in $IMAGES; do printf '%s %s\n' "$img" "$(crane digest "$SRC/$img:$RELEASE")"; done > out/digests.txt
    - while read -r img digest; do oras cp -r "$SRC/$img@$digest" "$DST/$img:$RELEASE"; done < out/digests.txt
  artifacts:
    paths: [out/]

verify:
  extends: .tools
  stage: verify
  script:
    - |
      while read -r img digest; do
        ref="$DST/$img@$digest"
        cosign verify "$ref" --certificate-identity "$ID" --certificate-oidc-issuer "$ISSUER" > "out/$img.signature.json"
        cosign verify-attestation "$ref" --type spdxjson --certificate-identity "$ID" --certificate-oidc-issuer "$ISSUER" \
          | head -1 | jq -r .payload | base64 -d | jq .predicate > "out/$img.spdx.json"
        cosign verify-attestation "$ref" --type slsaprovenance1 --certificate-identity "$ID" --certificate-oidc-issuer "$ISSUER" \
          | head -1 | jq -r .payload | base64 -d > "out/$img.provenance.json"
        jq -e --arg ref "refs/tags/$RELEASE" '.predicate.buildDefinition.externalParameters.workflow
          | select(.repository == "https://github.com/openctemio/openctem" and .ref == $ref)' "out/$img.provenance.json" > /dev/null
        jq -r '.predicate.buildDefinition.resolvedDependencies[0].digest.gitCommit' "out/$img.provenance.json"
      done < out/digests.txt | sort -u > out/commit.txt
    - test "$(wc -l < out/commit.txt)" -eq 1
  artifacts:
    paths: [out/]

scan:
  extends: .tools
  stage: scan
  script:
    - |
      while read -r img digest; do
        trivy image --format json --output "out/$img.trivy.json" "$DST/$img@$digest"
        grype "sbom:out/$img.spdx.json" -o json > "out/$img.grype.json"
      done < out/digests.txt
  artifacts:
    paths: [out/]

policy:
  extends: .tools
  stage: policy
  script:
    # Your rules. Example: no critical finding that has a fix, unless its id is accepted in policy/accepted.txt.
    - test -f policy/accepted.txt   # the accepted ids, one per line (may be empty, must exist)
    - |
      fail=0
      while read -r img digest; do
        jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL" and (.FixedVersion // "") != "") | .VulnerabilityID' \
          "out/$img.trivy.json" | sort -u | grep -vxF -f policy/accepted.txt > "out/$img.blocking.txt" || true
        if [ -s "out/$img.blocking.txt" ]; then echo "$img:"; cat "out/$img.blocking.txt"; fail=1; fi
      done < out/digests.txt
      exit "$fail"
  artifacts:
    paths: [out/]

propose:
  extends: .tools
  stage: propose
  script:
    - git clone "https://intake-bot:${DEPLOY_REPO_TOKEN}@gitlab.example.com/platform/openctem-deploy.git" deploy
    - cd deploy && git checkout -b "intake/$RELEASE"
    - ../scripts/write-lock.sh ../out/digests.txt "$RELEASE" "$(cat ../out/commit.txt)" > envs/dev/release.lock.yaml
    - ../scripts/render.sh envs/dev    # regenerates the Compose override / Helm values / Ansible vars from the lock
    - git add envs/dev && git commit -m "OpenCTEM $RELEASE: intake to dev"
    - >-
      git push -o merge_request.create -o merge_request.target=main
      -o merge_request.title="OpenCTEM $RELEASE to dev"
      -o merge_request.description="Pipeline $CI_PIPELINE_URL verified signatures, SBOM and provenance and passed policy."
      origin "intake/$RELEASE"
```

`write-lock.sh` and `render.sh` are yours: the lock file is the single source
(release, commit, image digests), and everything a deployment reads is
generated from it, so a reviewer checks one small diff. Attach the `out/`
directory (signatures, SBOMs, provenance, scan reports) to the merge request or
store it as a generic package next to the release.

A scheduled pipeline can look for new releases (for example by listing tags
with `crane ls ghcr.io/openctemio/openctem-api`) and start the intake; a person
still approves every merge request.

### Approvals and promotion

- **Merge request rules**: require approval from the platform owners (CODEOWNERS
  on `envs/`) and, for `envs/production/`, from the change or security
  approvers. Forbid the author approving their own merge request, and reset
  approvals when new commits are pushed.
- **Protected branches and environments**: only the merge of an approved merge
  request changes `main`; the production deployment job runs in a protected
  environment that needs its own deployment approval.
- **Promotion** copies the lock file one step up (`envs/dev` to
  `envs/staging`, then to `envs/production`), unchanged, so production runs
  exactly the digests staging tested. A pipeline check can refuse a production
  lock whose digests never ran in staging.
- **Countersign on approval**: the pipeline on `main` signs the approved digests
  with your key ([approach 4](#4-dual-signatures-your-approval-as-a-signature)),
  for example with the annotation `stage=production`, so the cluster or the
  pre-flight check refuses anything not approved for that environment.

### Deploy from the repository

**Kubernetes with Argo CD**: one Application per environment, the chart from
your registry and the values from the deployment repository:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: openctem-production
  namespace: argocd
spec:
  project: platform
  sources:
    - repoURL: registry.example.com/openctem/charts      # OCI Helm repository
      chart: openctem
      targetRevision: 0.29.0
      helm:
        valueFiles:
          - $deploy/envs/production/values.yaml
          - $deploy/envs/production/values-digests.yaml   # generated from the lock file
    - repoURL: https://gitlab.example.com/platform/openctem-deploy.git
      targetRevision: main
      ref: deploy
  destination:
    server: https://kubernetes.default.svc
    namespace: openctem
  syncPolicy:
    syncOptions: [CreateNamespace=false]
```

**Kubernetes with Flux**: an `OCIRepository` for the chart and a `HelmRelease`
whose values come from the deployment repository. Flux can verify a cosign
signature on the chart artifact (`spec.verify.provider: cosign` with your
public key), which covers the unsigned upstream chart once you sign your
mirrored copy.

**Compose or Ansible with a GitLab job**: a job in the deployment repository,
on a runner inside the production network, in a protected environment:

```yaml
deploy-production:
  stage: deploy
  environment: { name: production }
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      changes: [envs/production/**]
  script:
    - ./scripts/preflight.sh envs/production/release.lock.yaml   # both signatures, see approach 4
    - ansible-playbook -i inventories/production site.yml -e @envs/production/airgap-vars.yml -e openctem_version="$(yq .release envs/production/release.lock.yaml)"
```

### Pros, cons and security notes

- Pros: every release follows the same path; the merge request is the audit
  trail; promotion moves exactly the tested digests; no person copies images
  by hand.
- Cons: two projects and a few scripts to maintain.
- Security: the intake runner is the only component with internet access and
  push rights; isolate it (its own runner, protected variables, no shared
  cache). The deployment token can only push branches, never to `main`. Keep
  the countersigning key in a KMS or HSM, usable only by the protected job on
  `main`.

## 4. Dual signatures: your approval as a signature

The vendor signature proves an image is what OpenCTEM released. Your signature
proves your organization approved it. Requiring both means a vendor release you
have not approved cannot run, and an image that did not come from an OpenCTEM
release cannot run even if someone signs it by mistake.

### Sign approved digests

Use a key held in a KMS or HSM (`awskms://`, `gcpkms://`, `azurekms://`,
`hashivault://` or PKCS#11 with cosign), or a key file for a first test:

```bash
cosign generate-key-pair --kms hashivault://openctem-release-approval   # once
cosign public-key --key hashivault://openctem-release-approval > release-approval.pub

while read -r img digest; do
  cosign sign --yes --key hashivault://openctem-release-approval \
    --new-bundle-format=false --use-signing-config=false --tlog-upload=false \
    -a release=v0.11.0 -a stage=production -a change=CHG-1234 \
    "registry.example.com/openctem/$img@$digest"
done < digests.txt
```

- `--tlog-upload=false` (with `--use-signing-config=false`, which cosign v3
  needs for it): an isolated network has no transparency log, and your
  approvals do not belong in a public one.
- `--new-bundle-format=false` stores your signature in the classic cosign
  layout, which every admission controller reads. The vendor signature stays in
  its bundle format next to it.
- Annotations (`-a`) record what was approved; the checks below can require them.

Check it:

```bash
cosign verify --key release-approval.pub --insecure-ignore-tlog=true --new-bundle-format=false \
  -a stage=production "registry.example.com/openctem/openctem-api@sha256:..."
```

### Kubernetes: Kyverno

Kyverno 1.13 or later. Each `verifyImages` entry must pass, so one rule with
two entries requires both signatures:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: openctem-images-approved
spec:
  background: false
  webhookTimeoutSeconds: 30
  rules:
    - name: vendor-and-organization-signatures
      match:
        any:
          - resources:
              kinds: [Pod]
              namespaces: [openctem]
      verifyImages:
        # 1. Published by an OpenCTEM release (keyless, Sigstore bundle)
        - type: SigstoreBundle
          failureAction: Enforce
          imageReferences:
            - "registry.example.com/openctem/*"
          required: true
          verifyDigest: true
          mutateDigest: false
          attestors:
            - entries:
                - keyless:
                    issuer: https://token.actions.githubusercontent.com
                    subjectRegExp: '^https://github\.com/openctemio/openctem/\.github/workflows/docker-publish\.yml@refs/tags/v[0-9]+\.[0-9]+\.[0-9]+$'
        # 2. Approved by your organization (your key, no transparency log)
        - type: Cosign
          failureAction: Enforce
          imageReferences:
            - "registry.example.com/openctem/*"
          required: true
          verifyDigest: true
          mutateDigest: false
          attestors:
            - entries:
                - keys:
                    publicKeys: |-
                      -----BEGIN PUBLIC KEY-----
                      <content of release-approval.pub>
                      -----END PUBLIC KEY-----
                    rekor:
                      ignoreTlog: true
                    ctlog:
                      ignoreSCT: true
                  annotations:
                    stage: production
```

Limit the first entry to the platform images (the sensor image is signed by
the `openctemio/sensor` workflow: add an entry with that identity for
`registry.example.com/openctem/sensor*`), and add your mirrored third-party
images (PostgreSQL, Redis, busybox) to the second entry only. Test with
`failureAction: Audit` first.

In an isolated cluster Kyverno cannot download the Sigstore trusted root:
start it with a TUF mirror you host (its `--tufMirror` and `--tufRoot` flags)
or verify the vendor signature at intake and enforce only your signature in the
cluster. The second option is weaker, because the cluster no longer checks the
origin itself; choose it consciously.

### Kubernetes: sigstore policy-controller

Authorities inside one `ClusterImagePolicy` are alternatives; separate policies
that match the same image must all pass. So use two policies:

```yaml
apiVersion: policy.sigstore.dev/v1beta1
kind: ClusterImagePolicy
metadata:
  name: openctem-vendor-release
spec:
  images:
    - glob: "registry.example.com/openctem/openctem-*"
    - glob: "registry.example.com/openctem/migrations*"
  authorities:
    - name: openctem-release-workflow
      signatureFormat: bundle            # policy-controller v0.13 or later
      keyless:
        url: https://fulcio.sigstore.dev  # isolated: trustRootRef to a TrustRoot resource
        identities:
          - issuer: https://token.actions.githubusercontent.com
            subjectRegExp: '^https://github\.com/openctemio/openctem/\.github/workflows/docker-publish\.yml@refs/tags/v[0-9]+\.[0-9]+\.[0-9]+$'
      ctlog:
        url: https://rekor.sigstore.dev   # isolated: trustRootRef to the same TrustRoot
---
apiVersion: policy.sigstore.dev/v1beta1
kind: ClusterImagePolicy
metadata:
  name: openctem-organization-approval
spec:
  images:
    - glob: "registry.example.com/openctem/**"
  authorities:
    - name: release-approval
      key:
        data: |
          -----BEGIN PUBLIC KEY-----
          <content of release-approval.pub>
          -----END PUBLIC KEY-----
      # no ctlog: your signatures are not in a transparency log
```

Label the namespace (`policy.sigstore.dev/include=true`) to enforce. In an
isolated cluster, create a `TrustRoot` resource from your TUF mirror or from the
Sigstore keys you transfer, and reference it with `trustRootRef`.

### Compose and Ansible: check both signatures before deploying

Without an admission controller, the deployment pipeline is the gate. Run this
before every `docker compose up` or Ansible play, on a host inside the network:

```bash
#!/usr/bin/env bash
# preflight.sh <digests.txt> <release> : refuse to deploy unless every image carries both signatures
set -euo pipefail
DIGESTS=$1 RELEASE=$2
DST=registry.example.com/openctem
ID="https://github.com/openctemio/openctem/.github/workflows/docker-publish.yml@refs/tags/$RELEASE"
while read -r img digest; do
  ref="$DST/$img@$digest"
  cosign verify "$ref" --trusted-root /etc/openctem-intake/trusted_root.json \
    --certificate-identity "$ID" --certificate-oidc-issuer https://token.actions.githubusercontent.com > /dev/null
  cosign verify "$ref" --key /etc/openctem-intake/release-approval.pub \
    --insecure-ignore-tlog=true --new-bundle-format=false -a "release=$RELEASE" > /dev/null
  echo "ok $img $digest"
done < "$DIGESTS"
```

Then deploy with the same digests (the Compose override or the Ansible extra
vars generated from the same list), so what was checked is what runs.

### Pros, cons and security notes

- Pros: approval is enforced by machines at every deployment, not only by the
  intake process; a stolen registry push credential alone cannot get an image
  deployed.
- Cons: one key to manage and rotate; admission controllers need the Sigstore
  trusted root in isolated clusters.
- Security: the signing key is the approval. Keep it in a KMS or HSM, allow
  only the protected approval job to use it, log every use, and plan its
  rotation (publish the new public key before retiring the old one; policies
  can list both keys during the overlap).

## 5. Data feeds and updates without internet

### Release information

The platform console shows newer releases and security advisories from a
signed release feed (`openctem-releases.json`). In v0.11.0 no feed key is
pinned in the build, so the check makes no request and the console says "No
release feed key in this build"; nothing is published to import yet. Set
`VERSION_CHECK_ENABLED=false` anyway, so a later release that pins a key does
not start trying to reach GitHub.

Once releases publish the feed: download `openctem-releases.json` from the
release in the transfer zone, carry it in, and a super administrator imports it
under **Monitoring > Software updates > Import**. It is verified exactly like
the online file (the key pinned in the build, no rollback, expiry after at most
45 days), and the import is audited. Or serve it from an internal https mirror
with `VERSION_CHECK_URL`. Either way the feed is display-only: the platform
never downloads or installs anything because of it. Your own source of truth
for new releases remains the intake process. See
[Versioning](../operations/versioning.md#the-release-feed).

### Threat intelligence: EPSS and KEV

The API downloads EPSS scores and the CISA KEV catalog directly. There is no
offline import for these two sources yet (planned). Choose one:

- **Limited egress**: allow `epss.empiricalsecurity.com`, `www.cisa.gov` and
  `raw.githubusercontent.com` from the API (directly, not through a proxy).
  Both are public data downloads; nothing about the installation is sent.
- **Fully isolated**: turn both sources off in the platform console
  (**Scanning > Threat intelligence**, an operations administrator, confirmed and
  audited). Findings are then prioritized without EPSS and KEV signals; keep this
  in mind when you read priorities and dashboards.

### Vulnerability and program feeds

The vulnerability feed (CVEs and affected version ranges for matching your
software inventory) and the program feed are imported only when you pin their
root key id. Neither has published a signed release yet ([Feeds](../operations/feeds.md#status)).
When they do, the air-gapped path already exists: verify a release in the
transfer zone with the feed's own tool, copy the directory in, and point
`VULNFEED_BUNDLE_DIR` (or `PROGRAMFEED_DIR`) at it. The platform verifies the
same signatures and hashes as online, refuses older sequences and bundles older
than 7 days, and keeps the previous data when a check fails. Plan a transfer at
least weekly.

### Content packs and the content catalog

- **Content packs** are uploaded by your own administrators (organization packs
  through the API, platform packs in the platform console under **Scanning >
  Content packs**) and signed by the installation's own content key. Uploading
  needs no internet access. Current sensor releases do not run content packs yet
  ([Content delivery](../sensors/content-delivery.md)).
- **Content catalog** bundles are imported as a file by a super administrator,
  verified offline against the catalog roots and the Sigstore trusted root
  embedded in the release. The v0.11.0 build pins no catalog root and no
  first-party bundle is published yet, so imports are refused unless you add a
  root of your own (`CONTENT_TRUST_ROOT_KEY_IDS`). When you update the Sigstore
  trusted root, set `CONTENT_SIGSTORE_TRUSTED_ROOT` to the same file you carry
  in for image verification.

### Sensors

Sensors run inside your networks and talk only to the platform; they are
released separately from the platform:

1. **Images**: take the sensor release in like a platform release, with the
   sensor identity
   `https://github.com/openctemio/sensor/.github/workflows/docker-publish.yml@refs/tags/vX.Y.Z`.
   Copy every variant you use (`vX.Y.Z`, `vX.Y.Z-opengrep`, ...); each tag has
   its own digest.
2. **Run them from your registry**, pinned by digest: `SENSOR_IMAGE` and
   `SENSOR_VERSION=vX.Y.Z@sha256:...` for the bundled Compose sensor,
   `sensor.image` in the chart, your own `docker run` or manifests elsewhere. The
   install commands the Sensors page shows name `ghcr.io/openctemio/sensor`; replace
   the image with your mirror when you copy them (a registry setting for these
   commands is planned).
3. **Binaries**: verify `checksums.txt` with its bundle, then the archive:

   ```bash
   cosign verify-blob checksums.txt --bundle checksums.txt.sigstore.json --trusted-root trusted_root.json \
     --certificate-identity https://github.com/openctemio/sensor/.github/workflows/release.yml@refs/tags/v0.23.2 \
     --certificate-oidc-issuer https://token.actions.githubusercontent.com
   sha256sum -c --ignore-missing checksums.txt
   ```

4. **Updates**: sensors never update themselves. Update them through the same
   intake when the console reports them outdated or unsupported, or when a
   platform release asks for it. Without release information the console judges
   sensors against the newest version the platform was released with and says
   "Newer releases may exist".
5. **Scanner content**: point each sensor at internal copies
   ([Network](../sensors/network.md#scanner-content-without-internet-access)):

   | Content | Air-gapped setting |
   |---|---|
   | nuclei templates | The default image ships a pinned, checksum-verified release. To update: `SENSOR_CONTENT_NUCLEI_TEMPLATES_URL` (`https://` or `file://`), `..._CHECKSUMS_URL` and a pinned `..._VERSION`, or `SENSOR_CONTENT_NUCLEI_TEMPLATES_DIR` |
   | trivy database | `SENSOR_CONTENT_TRIVY_DB_REPOSITORY=registry.example.com/mirror/trivy-db:2` (mirror it daily with `oras cp`) |
   | SAST rules pack | `SENSOR_CONTENT_SAST_RULES_URL` (a mirror of the `openctemio/sast-rules` releases; the keyless signature is still verified) or `SENSOR_CONTENT_SEMGREP_RULES_PATH` |

### Keep vulnerability data fresh

An isolated installation is only as current as the data you carry in. Decide
the cadence and monitor it:

| Data | Suggested cadence | Where staleness shows |
|---|---|---|
| trivy database (sensors and your intake scanner) | Daily | Sensor **Setup & health**; content maximum ages under **Settings > Scanning > Scanner content** |
| nuclei templates | Weekly | Same |
| SAST rules pack | Per release | Same |
| Vulnerability feed (when published) | Weekly or faster (bundles expire after 7 days) | Platform console, **Scanning > Threat intelligence** |
| Release information (when published) | With each intake (the feed expires after 45 days) | **Monitoring > Software updates** |

Set maximum content ages in the scanner content policy, so a sensor whose
content is too old reports `stale` instead of scanning silently with old data.

## 6. Upgrades in a controlled environment

1. **Read** the release notes and the release's upgrade guide
   ([Upgrading](../operations/upgrade.md#release-specific-guides)): new required
   settings, removed ones, migrations with special handling.
2. **Take the release in** with approach 1, 2 or 3, including the deployment
   files from the signed commit. Diff them against the current release
   (`api/deploy`, `.env.example`) and update your configuration.
3. **Rehearse on staging with a restored production backup**, not an empty
   database: restore the latest backup ([Backup and restore](../operations/backup-restore.md)),
   deploy the new digests, and check that the `migrate` job (Compose), the
   migration Job (Helm) or the kit finishes, the API starts, and sign-in,
   findings and scans work. Time the migration: it tells you the maintenance
   window.
4. **Back up production** immediately before the change, and check the dump is
   readable (`./backup.sh && ./backup.sh verify` with Compose; the kit does it
   for you).
5. **Deploy the approved digests** (merge the promotion merge request, or run
   the pre-flight and the deployment by hand).
6. **Verify**: `https://<host>/health`, the running version in the platform
   console, the API log for start-up warnings, a test scan through a sensor.
7. **Rollback**: deploy the previous release's digests again (keep the previous
   lock file, override file or `openctem_releases` entry for this). Migrations
   are backward compatible by design, so the previous release runs on the newer
   schema; never run down migrations. When a release guide says a migration
   cannot be undone, the way back is the backup from step 4.

Keep the previous release's images (and their signatures) in your registry
until the next release is in production; exclude them from cleanup rules.

## 7. Checklists

### For every release

- [ ] Release notes and upgrade guide read; new settings identified.
- [ ] Tags resolved to digests once; only digests used afterwards.
- [ ] Images copied with their referrers into the internal registry.
- [ ] `cosign verify` passes against the internal copy, with the exact identity
      `docker-publish.yml@refs/tags/vX.Y.Z` and issuer
      `https://token.actions.githubusercontent.com`.
- [ ] SBOM attestation (`spdxjson`) and provenance (`slsaprovenance1`) verified.
- [ ] Provenance: repository `openctemio/openctem`, workflow
      `docker-publish.yml`, ref `refs/tags/vX.Y.Z`; one commit for every image.
- [ ] Deployment files taken from that commit; diff reviewed.
- [ ] Images scanned with your data; blocking findings resolved or accepted
      with a reason and an expiry.
- [ ] Third-party images (PostgreSQL, Redis, busybox, cosign) mirrored, pinned
      by digest and scanned the same way.
- [ ] Rehearsed on staging with a restored backup.
- [ ] Approved (merge request or change record) and countersigned.
- [ ] Rendered deployment references only `registry.example.com/...@sha256:`.
- [ ] Previous release's digests kept for rollback.

### What to keep for audit

Per release, in a write-once store, for as long as the release may run plus
your retention period:

- The digest list and the release tag.
- The verification outputs (signature, SBOM, provenance) and the SBOM files.
- The provenance commit and the archive of the deployment files with its
  SHA-256.
- The Sigstore `trusted_root.json` used, with its SHA-256.
- Scan reports and the accepted findings with reasons and expiry.
- The approval (merge request or change ticket, approvers, time) and your
  countersignature (it stays in the registry; keep the public key too).
- The transfer record for offline transfers: checksums, media, people.
- The deployment record: which digests ran where, from when to when.

### If you allow limited egress instead

If production may reach a short list of hosts, these are the ones that matter.
Allow them on the firewall by name, from the listed source only:

| From | To | Why |
|---|---|---|
| Hosts that pull images (or only the intake host) | `ghcr.io` (and `pkg-containers.githubusercontent.com`, which GHCR may redirect downloads to) | Images, signatures and attestations |
| The host running cosign | `tuf-repo-cdn.sigstore.dev` | The Sigstore trusted root for keyless verification (not needed with `--trusted-root`) |
| The API | `epss.empiricalsecurity.com`, `www.cisa.gov`, `raw.githubusercontent.com` | EPSS and KEV |
| The API | `github.com`, `release-assets.githubusercontent.com` | Release information, and the vulnerability and program feeds once they publish |
| The API (optional) | `crt.sh`, `api.certspotter.com`, `stat.ripe.net`, `ctem.org` | Certificate Transparency, network lookups, CTEM-ID catalog |
| Sensors (optional) | `github.com`, `api.github.com`, `release-assets.githubusercontent.com`, `mirror.gcr.io`, `ghcr.io` | Scanner content ([Network](../sensors/network.md)) |

The API sends these requests directly, without an HTTP proxy. Everything else
(integrations, SSO, SMTP, AI providers) is only what you configure.

## Known limitations and planned work

| Today | Planned | Interim |
|---|---|---|
| No official offline bundle | A signed per-release bundle with `openctem bundle verify` | [Approach 2](#2-fully-offline-transfer) by hand |
| Compose: migrations share `API_VERSION`; no per-image digest variables | Digest variables per image | The override file in [Docker Compose](#docker-compose) |
| Ansible kit: no registry setting, keyless check needs the Sigstore TUF host, no customer-key check | A registry variable, a local trusted root, an optional organization key | Extra-vars file and the [pre-flight check](#compose-and-ansible-check-both-signatures-before-deploying) |
| Helm chart not signed | Signed chart releases | SHA-256, review of the rendered manifests, your own signature on the mirrored chart |
| No offline import for EPSS and KEV | File import in the platform console | Limited egress, or turn the sources off |
| No release feed published yet | A signed feed with each release, importable offline | Your intake process is the source of release information |
| Sensors page install commands name `ghcr.io` | A registry setting for the commands | Replace the image when copying the command |
| API calls to feeds do not use an HTTP proxy | Proxy support | Firewall allowlist by host name |
