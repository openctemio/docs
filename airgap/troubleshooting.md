---
title: Troubleshooting
parent: Air-gapped and private registry
nav_order: 14
---

# Troubleshooting
{: .no_toc }

Symptoms, causes and fixes, grouped by where they appear. Never work around a
failed signature or digest check: a failed check means the artifact is not the
release's.

1. TOC
{:toc}

---

## Registries and proxies

| Symptom | Cause and fix |
|---|---|
| `x509: certificate signed by unknown authority` | The registry's CA is not trusted by the tool. Add the CA to the host store used by `cosign`, `oras` and the container runtime (containerd, Docker). For the Ansible kit set `openctem_registry_ca_file` |
| `TOOMANYREQUESTS` from `ghcr.io` | Let Nexus or Harbor cache the images, and authenticate the proxy with a read-only token. Do not retry in a loop |
| `no signatures found` in your private registry | The image was copied without its referrers (`docker pull` and `push`, `skopeo copy`, `crane copy`, Harbor replication). Copy again with `mirror-images.sh` (it uses `oras cp -r`). `cosign save` does not capture signatures either |
| `no signatures found` through a Nexus proxy right after a release | A cached 404 for the `sha256-<digest>` tag. The negative cache must be 1 minute. Shorten it, invalidate the proxy cache, retry. Signatures are attached minutes after the images |
| Authentication errors or `unauthorized` against the Nexus Docker proxy, although the account is right | The "Docker Bearer Token Realm" is not active. Add `DockerToken` to the active realms (`create-repositories.sh` does it) |
| Docker proxy and hosted repository do not answer on the expected address | Each Nexus Docker repository needs its own connector port (8443 and 8444 in the kit's bodies), or a reverse proxy in front |
| Second mirror run into a Nexus hosted repository fails | The write policy is `ALLOW_ONCE`. Use `ALLOW`. Two images that share a signature tag also fail under `ALLOW_ONCE` |
| A proxy serves an old `latest release` | The `github-api` raw proxy caches for 30 minutes. Use `OPENCTEM_VERSION` for a manual run |
| The raw proxy of `github.com` returns an error for an asset | The release asset redirects to `release-assets.githubusercontent.com`. Nexus must be allowed to reach that host |
| Harbor refuses to serve an image from `openctem-trusted` | Cosign content trust is on and the image has no signature there. Promote with `mirror-images.sh` (referrers copied). Check with `cosign tree` |
| Harbor shows the image but replication did not carry the signature | Expected: replication keeps digests but does not turn tag-schema signatures into Harbor signatures. Promote into trusted with `mirror-images.sh` |

## Verification failures

| Symptom | Cause and fix |
|---|---|
| `expected SAN ... refs/tags/vX, got ... refs/tags/vY` | The tag names another release's image. The source is wrong or tampered. Do not promote |
| Signature check fails with another workflow's identity | The image was not signed by the release workflow. Stop and report it |
| The digest differs from the release list | The source re-tagged the image, or the copy is not the release's. Stop |
| `mirror-images.sh` says `<name> is not in <list>` | The bundle or the list is incomplete. Download the release files again |
| `mirror-images.sh` says an archive does not match its checksum | The file changed in transfer. Compare the `sha256` list on both sides and transfer again |
| Offline verification fails with a trusted-root error | The trusted root is missing or stale. Fetch a new one on a connected machine (any online `cosign verify` refreshes it) and carry it separately |
| `unpack.sh` says `dist` exists | Remove `<kit>/dist` and run it again: it refuses to overwrite |
| `unpack.sh` or `fetch-release.sh` says the checksums file is not signed by the release workflow | The release does not carry `checksums-sha256.txt.sigstore.json`, or the files were altered. The signed checksum file is new from the next release |
| Kyverno rejects a release image | The policy lacks `type: SigstoreBundle`, the registry path in `imageReferences` is wrong, or the identity regular expression does not match the tag |
| Kyverno does not check the all-in-one image | The template's `imageReferences` has `openctem-*` and not the plain `openctem` path. Add it |

## Pulling and running

| Symptom | Cause and fix |
|---|---|
| `ImagePullBackOff` or `manifest unknown` | A wrong `global.imageRegistry` path, a missing tag or digest, or a missing architecture. Copy the multi-arch index, never pull and push a single architecture |
| `ImagePullBackOff` with an authorization error | The `imagePullSecrets` secret is missing in the namespace, expired (robot accounts expire in 90 days), or scoped to the wrong project |
| The helm render fails with a digest error | A digest must look like `sha256:` followed by 64 hex characters |
| A multi-arch host pulls the wrong platform | The registry holds a single-arch image. Mirror again with `mirror-images.sh`, which copies the index |
| Compose runs an old image after a mirror | The tag was not immutable and was re-pointed, or the host cached it. Turn on tag immutability and check the digest against `openctem-mirrored-<version>.txt` |
| The Ansible run stops before pulling, with a signature error | The mirror does not hold our signatures. Copy with `mirror-images.sh`. There is no skip |
| The Ansible mirror variable is refused | The value must be a host and optional path without a scheme or digest |

## Pipelines

| Symptom | Cause and fix |
|---|---|
| A scheduled pipeline does nothing | The release is already in the trusted project (`discover` skips it). Run with `OPENCTEM_FORCE` to run anyway |
| The `scan` stage fails | A finding at `TRIVY_SEVERITY` with a fix. Read `trivy-<name>.json`. A reviewed exception goes in the Harbor CVE allowlist, with a ticket |
| Trivy cannot update its database | Set `TRIVY_DB_REPOSITORY` and `TRIVY_JAVA_DB_REPOSITORY` to your mirror |
| The `bump` job cannot open the merge request | Check `DEPLOY_TOKEN` (role Developer, scopes `write_repository` and `api`, on that project) and that `DEPLOY_REPO_URL` is `https://` |
| Path B: the web or console image fails at start | The Node.js major of the base image does not match the archive's `NODE_VERSION` file, or the base is not glibc |
| Path B: `build` cannot pull the base image | `BASE_REGISTRY_PREFIX` does not serve the `gcr.io/distroless/...` or `docker.io/library/...` path below it |

## Feeds

| Symptom | Cause and fix |
|---|---|
| A feed on an internal mirror never imports | The mirror's address range is not in `OPENCTEM_HTTPSEC_ALLOW_PRIVATE_CIDRS`, or you set `HTTPS_PROXY` (it is ignored) |
| Vulnerability data is stale | See [feeds](feeds.md#keep-the-data-fresh) |

## Related

[Reference](reference.md), [Lifecycle](lifecycle.md)
