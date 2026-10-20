---
title: Lifecycle
parent: Air-gapped and private registry
nav_order: 10
---

# Lifecycle: install, upgrade, patch, roll back, recover
{: .no_toc }

What to do at each step of the life of an air-gapped or private-registry
installation, whichever [supply path](index.md#supply-paths) you chose. The
steps are the same for every path; only the way the images arrive differs.

1. TOC
{:toc}

---

## First install

1. Choose the path ([decision guide](index.md#decision-guide)) and set up its
   registry, projects, robot accounts and CI variables.
2. Bring in the release you want: run the mirror pipeline with
   `OPENCTEM_VERSION=vX.Y.Z` ([A2](path-ci-mirror.md)), or import the bundle
   ([A3](path-offline.md)).
3. Confirm the release is in the trusted registry and carries its signatures:

   ```bash
   cosign tree registry.example.internal/openctem-trusted/openctem-api:vX.Y.Z
   ```

4. Write the digests into your deployment settings
   ([Install targets](install-targets.md)) and install.
5. Set up the [content and intelligence feeds](feeds.md) the platform needs.
6. Create the [first administrator](../install/first-admin.md).

## Routine upgrade

1. The scheduled job finds the new release, mirrors, scans, promotes and opens
   the merge request ([A2](path-ci-mirror.md#the-bump-merge-request)). With A3,
   fetch and import the new bundle.
2. Read the release notes and the [upgrade guide](../operations/upgrade.md).
   Back up the database first.
3. Review the merge request: the digests must match
   `openctem-mirrored-<version>.txt` or `trusted.txt`.
4. Merge and deploy. The migrations image runs before the new API starts.
5. Keep the previous release in the registry until you are sure.

## Emergency security patch

A security release must not make you skip a check. The fast lane is the same
pipeline, started by hand:

1. Run the mirror pipeline manually with the variable
   `OPENCTEM_VERSION=vX.Y.Z` (the CI job also accepts `OPENCTEM_FORCE` to run
   when the release is already in trusted).
2. The same stages run: signature verification at the source and in staging,
   Trivy, promotion, verification in trusted. Nothing is skipped and nothing
   is lowered for speed.
3. Review and merge the bump merge request out of schedule.
4. With A3, expedite the transfer: the same download, verification, hashing,
   scan and import. Only the waiting time shrinks.
5. If the scan stage fails on a finding that the release itself fixes or does
   not affect, handle it as a reviewed exception in Harbor's CVE allowlist,
   with a ticket. Do not disable the stage.

## Rollback

The previous release is still in `openctem-trusted`, because the retention rule
keeps the last N tags (Harbor: keep the last 5 `v*` tags per repository).

1. Put the previous digests back: revert the bump merge request, or set the
   Helm `image.digest` values, the Compose `.env` or the Ansible release list
   to the previous release.
2. Redeploy.
3. Check the schema: a release that applied migrations may need the database
   restored from the backup taken before the upgrade, unless the release notes
   say the down migrations are safe. Never run an older server on a newer
   schema.
4. For binaries, switch the symlinks back
   ([Install from binaries](../install/binaries.md#rollback)).

## Version pinning by digest

A tag can be re-pointed; a digest cannot. Pin by digest everywhere you can:

| Target | Pin |
|---|---|
| Helm | `*.image.digest` |
| Compose | immutable tags in the registry, and a digest check against the list |
| Ansible | digests in `versions.yml`, unchanged by the mirror variables |
| Kubernetes admission | `mutateDigest: true` and `verifyDigest: true` in the Kyverno template rewrite tags to digests |
| All-in-one | `image:tag@sha256:...` |

## Retention and cleanup

- **Harbor.** Tag retention keeps the last 5 `v*` tags per repository (the
  rollback window). Run garbage collection on a schedule. Tag immutability on
  `v*` stays on.
- **Nexus.** The kit's JSON bodies set no cleanup policy. Set one for the Docker
  proxy and the raw proxies, long enough to cover your rollback window.
- **Staging.** Clean staging after promotion on your own schedule. Keep the
  trusted project's tags.
- **CI artifacts.** The pipeline keeps the digest lists and scan reports for a
  year. Export them to your evidence store.

## Disaster recovery: rebuild the registry

Digests are the same wherever an image comes from, so a lost registry is
rebuilt, not restored:

1. Re-run the mirror for each release you need: from the Nexus proxy or
   `ghcr.io` (`mirror-images.sh online`), or from the bundles you kept
   (`mirror-images.sh bundle`).
2. Compare the result with the digest lists you kept. They must be identical.
3. Re-create the projects, policies and robot accounts from the kit's
   checklist and bodies.
4. Point the deployments at the rebuilt registry. Because the digests are the
   same, nothing needs to be redeployed.

Keep the bundles and the digest lists in a store that does not depend on the
registry.

## Multi-site

One mirror can feed several air-gapped sites.

- **Bundle per site.** Copy the verified bundle to each site's media and import
  it there ([A3](path-offline.md)). Each site verifies on its own. Use this
  when sites are not connected to each other.
- **Registry to registry.** When a site can pull from the central registry,
  use the central trusted project as a source:

  ```bash
  ./mirror-images.sh online vX.Y.Z site-registry.example.internal/openctem-trusted \
    --source-prefix registry.example.internal/openctem-trusted
  ```

  The script verifies the identity at the source and again at the destination,
  so each site's registry holds the signatures and the same digests.

In both cases each site keeps its own digest lists and logs.

## Audit evidence

Keep these for every release, with the date and who approved it:

| Evidence | What it proves |
|---|---|
| `openctem-mirrored-<version>.txt` (`name ref digest`), or `staging.txt` and `trusted.txt` of the CI job | The digests you took in, and where they went |
| Mirror job logs with the verification output | The identity and signature checks passed at the source and destination |
| `trivy-<name>.json` reports | The vulnerability state at promotion |
| SBOMs (`*.spdx.json` of the archives, and the SBOM attestations of the images) | What the release contains |
| `checksums-sha256.txt` and `checksums-sha256.txt.sigstore.json` | The signed list of release files |
| `openctem-images-<version>.txt` and its `.sigstore.json` (offline bundle) | The signed list of images and archive hashes |
| The proxy access log and Harbor audit log | What crossed the boundary and who pulled |
| For A3: the custody record and the `sha256` list | The physical transfer |

## Related

[Install targets](install-targets.md), [Upgrade](../operations/upgrade.md),
[Backup and restore](../operations/backup-restore.md)
