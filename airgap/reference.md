---
title: Reference
parent: Air-gapped and private registry
nav_order: 13
---

# Reference: images, manifests, verification
{: .no_toc }

1. TOC
{:toc}

---

## Images

Every release publishes these images under `ghcr.io/openctemio/`, each signed
keyless by `docker-publish.yml` at the release tag, with a SLSA provenance and
an SPDX SBOM attestation.

| Image | Runs | Ports | User | Healthcheck | Main settings |
|---|---|---|---|---|---|
| `openctem-api` | The API. Also holds the job signer and the operator commands | 8080 (API), 9443 (sensor mTLS) | 1000 (`openctem`); the signer runs as 1001 (`openctem-signer`) | `/app/server -healthcheck` | Database (`DB_*`), Redis (`REDIS_*`), `APP_URL`, secrets (`APP_ENCRYPTION_KEY`, `FINGERPRINT_KEY`), `SIGNER_SOCKET` |
| `openctem-web` | The web console (Next.js) | 3000 | 1001 (`nextjs`) | HTTP `GET /api/health` on port 3000 | `BACKEND_API_URL`, `NEXT_PUBLIC_APP_URL`, `SECURE_COOKIES`, `TRUST_PROXY_HEADERS` |
| `openctem-console` | The platform console (Next.js) | 3000 | 1001 | HTTP `GET /api/health` on port 3000 | `BACKEND_API_URL`, `ADMIN_API_URL`, `SECURE_COOKIES`, `TRUST_PROXY_HEADERS` |
| `openctem-gateway` | Caddy with the layer4 module | 80, 443 (tcp and udp), 2019 (admin) | 1000 (`caddy`) | HTTP `GET /config/` on port 2019 | `OPENCTEM_TLS_MODE`, `OPENCTEM_HOSTNAME`, the `*_UPSTREAM` variables |
| `migrations` | Applies the schema (golang-migrate wrapper) | none | 65532 | none | `DATABASE_MIGRATE_URL`, `PGPASSWORD` |
| `seed` | The seed SQL files at `/seed`, with `psql` | none | 65532 | none | the database connection |
| `admin-cli` | `bootstrap-admin`, the first-administrator command | none | 65532 | none | the API's database settings |
| `openctem` (all-in-one) | API, web, console and gateway in one container | see [All-in-one](../install/all-in-one.md) | see [All-in-one](../install/all-in-one.md) | see [All-in-one](../install/all-in-one.md) | see [All-in-one](../install/all-in-one.md) |

The ports, users and healthchecks come from the image kit's Dockerfiles, which
reproduce the official images. The settings column names the main variables of
the same programs, taken from the env examples of the
[binary install](../install/binaries.md#3-configure). The full list is the
[environment variables](../configuration/environment-variables.md) reference,
and Compose and Helm set them for you.

The sensor is released from `openctemio/sensor` ([Sensors](sensors.md)).

## Manifest formats

### Offline bundle list

`openctem-images-<version>.txt`, attached to the release, signed as
`openctem-images-<version>.txt.sigstore.json`. The first line is a comment,
then one line per image, sorted:

```text
# name source-reference index-digest archive archive-sha256
openctem-api ghcr.io/openctemio/openctem-api:vX.Y.Z sha256:<index digest> openctem-image-openctem-api-vX.Y.Z.oci.tar <sha256 of the archive>
```

The digest is that of the multi-arch **index**. The archive is an OCI layout
with the image, its signature, provenance and SBOM attestation.

### Mirror list

`mirror-images.sh` writes `openctem-mirrored-<version>.txt` (or the file named
by `--manifest-out`). The first line is a comment with the mode and the time,
then:

```text
# name reference digest (mirror-images.sh online, 2026-01-01T00:00:00Z)
openctem-api registry.example.internal/openctem-trusted/openctem-api:vX.Y.Z sha256:<digest>
```

The CI jobs write the same format as `staging.txt` and `trusted.txt`.
`scan-images.sh` and `bump-deployment.sh` read it.

### `mirror-images.sh` usage

```text
mirror-images.sh online <version> <dest-prefix> [options]
mirror-images.sh bundle <bundle-dir> <dest-prefix> [options]
```

| Option | Meaning |
|---|---|
| `--images "a b"` | Only these images (default: every image of the release) |
| `--source-prefix P` | Online mode: read from `P/<name>` instead of `ghcr.io/openctemio/<name>`: a Nexus Docker proxy or a staging project |
| `--source-plain-http` | The source registry speaks plain HTTP (lab only) |
| `--trusted-root FILE` | Verify offline against this Sigstore trusted root |
| `--plain-http` | The destination registry speaks plain HTTP (lab only) |
| `--manifest-out FILE` | Where to write the mirror list |
| `--env-out FILE` | Write a Docker Compose `.env` fragment |

It needs `oras` 1.2 or later, `cosign` 2.4 or later, `sha256sum` and `tar`, and
a registry login done beforehand (`oras login` or `docker login`). Every image
is verified **before** it is copied (the digest is the one the release names,
and the signature comes from the release workflow at the tag) and **again** in
the destination. A failure stops the run with exit code 1 and nothing
unverified is copied.

## Verification commands

Replace `$V` with the release and the registry with yours. Add
`--offline --trusted-root trusted_root.json` to verify without internet
access.

```bash
ID=https://github.com/openctemio/openctem/.github/workflows
ISS=https://token.actions.githubusercontent.com

# An image
cosign verify \
  --certificate-identity $ID/docker-publish.yml@refs/tags/$V \
  --certificate-oidc-issuer $ISS \
  registry.example.internal/openctem-trusted/openctem-api:$V

# Its attestations
cosign verify-attestation --type slsaprovenance1 \
  --certificate-identity $ID/docker-publish.yml@refs/tags/$V \
  --certificate-oidc-issuer $ISS \
  registry.example.internal/openctem-trusted/openctem-api:$V
cosign verify-attestation --type spdxjson \
  --certificate-identity $ID/docker-publish.yml@refs/tags/$V \
  --certificate-oidc-issuer $ISS \
  registry.example.internal/openctem-trusted/openctem-api:$V

# The signatures are listed next to the image
cosign tree registry.example.internal/openctem-trusted/openctem-api:$V

# The signed checksum file of the release, then the files
cosign verify-blob checksums-sha256.txt --bundle checksums-sha256.txt.sigstore.json \
  --certificate-identity $ID/release.yml@refs/tags/$V --certificate-oidc-issuer $ISS
sha256sum --ignore-missing -c checksums-sha256.txt

# The offline image list
cosign verify-blob openctem-images-$V.txt --bundle openctem-images-$V.txt.sigstore.json \
  --certificate-identity $ID/docker-publish.yml@refs/tags/$V --certificate-oidc-issuer $ISS

# Build provenance of an archive
gh attestation verify openctem-server-$V-linux-amd64.tar.gz --owner openctemio
```

A digest check: the `mirror-images.sh` list names `name ref digest`.
`oras resolve registry.example.internal/openctem-trusted/openctem-api:$V` must
print that digest.

## Kyverno policy

Admits OpenCTEM images only when they carry the release's keyless signature
(GitHub OIDC, issued to the repository's `docker-publish.yml` workflow at a
release tag) and rewrites tags to digests. It needs
`type: SigstoreBundle` (Kyverno 1.13 or later), because the release signs with
cosign's Sigstore bundle format. It was checked with the Kyverno 1.19 CLI: a
release image is admitted, and the same policy with another workflow's
identity rejects it. Kyverno 1.19 marks `kyverno.io/v1` `ClusterPolicy` as
deprecated in favour of `ImageValidatingPolicy`; it still enforces.

Edit `imageReferences` to your registry's path. Inside an air gap the Sigstore
trust root and the transparency log are not reachable: the `rekor` and `ctlog`
settings verify the transparency-log entry embedded in each signature (no
online lookup). Supply the Sigstore trusted root through Kyverno's TUF settings
(`--tufRoot` and `--tufMirror` on the Kyverno admission controller, pointing at
an internal copy). Gatekeeper with ratify is an alternative (not covered here).

[`kyverno-verify-openctem-images.yaml`](https://github.com/openctemio/openctem/blob/main/deploy/airgap/templates/kyverno-verify-openctem-images.yaml):

```yaml
# Kyverno policy: admit OpenCTEM images only when they carry the release's
# cosign signature (keyless, GitHub OIDC, issued to this repository's
# docker-publish workflow at a release tag), and rewrite tags to digests.
#
# The release signs with cosign's Sigstore bundle format (stored as OCI
# referrers), hence `type: SigstoreBundle` (Kyverno 1.13 or later; checked
# with the Kyverno 1.19 CLI: a release image passes, and the same policy with
# another workflow's identity rejects it). Kyverno 1.19 marks kyverno.io/v1
# ClusterPolicy as deprecated in favour of ImageValidatingPolicy; it still
# enforces.
#
# Edit `imageReferences` to your registry's path. Inside an air gap the
# Sigstore trust root and the transparency log are not reachable: the
# `rekor.url`/`ctlog` settings below verify the transparency-log entry
# embedded in each signature (no online lookup); supply the Sigstore trusted
# root through Kyverno's TUF settings (`--tufRoot`/`--tufMirror` on the
# Kyverno admission controller, pointing at an internal copy).
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-openctem-images
  annotations:
    policies.kyverno.io/title: Verify OpenCTEM image signatures
    policies.kyverno.io/description: >-
      OpenCTEM images must be signed by the openctemio/openctem release
      workflow (docker-publish.yml at a v* tag) and are pinned by digest.
spec:
  validationFailureAction: Enforce
  webhookTimeoutSeconds: 30
  background: false
  rules:
    - name: openctem-release-signature
      match:
        any:
          - resources:
              kinds: [Pod]
      verifyImages:
        - type: SigstoreBundle
          imageReferences:
            - "registry.example.internal/openctem-trusted/openctem-*"
            - "registry.example.internal/openctem-trusted/migrations*"
            - "registry.example.internal/openctem-trusted/admin-cli*"
            - "registry.example.internal/openctem-trusted/seed*"
          mutateDigest: true
          verifyDigest: true
          required: true
          attestors:
            - count: 1
              entries:
                - keyless:
                    subjectRegExp: '^https://github\.com/openctemio/openctem/\.github/workflows/docker-publish\.yml@refs/tags/v[0-9]+\.[0-9]+\.[0-9]+$'
                    issuer: https://token.actions.githubusercontent.com
                    rekor:
                      url: https://rekor.sigstore.dev
                      ignoreTlog: false
                    ctlog:
                      ignoreSCT: false
```

For images you rebuilt ([Path B](path-build-from-archives.md)), replace the
`keyless` attestor with a `keys` attestor holding your public key.

## Related

[Install targets](install-targets.md), [Troubleshooting](troubleshooting.md)
