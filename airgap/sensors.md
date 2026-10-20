---
title: Sensors
parent: Air-gapped and private registry
nav_order: 11
---

# Sensors in restricted networks
{: .no_toc }

Sensors run inside your networks and run the scans. They are released
separately, by `openctemio/sensor`, and signed by that repository's workflows.

1. TOC
{:toc}

---

## Take a sensor release in

Mirror sensor images and archives through the same paths as the platform
([P0](path-nexus-proxy.md), [A2](path-ci-mirror.md), [A3](path-offline.md)).
Only the **identity** changes: the signatures name the sensor repository's
workflow, not the platform's.

| Artifact | Identity to verify |
|---|---|
| Sensor images | `https://github.com/openctemio/sensor/.github/workflows/docker-publish.yml@refs/tags/vX.Y.Z` |
| Sensor archives (GoReleaser) | `checksums.txt` with `checksums.txt.sigstore.json`, identity `https://github.com/openctemio/sensor/.github/workflows/release.yml@refs/tags/vX.Y.Z` |

Issuer for both: `https://token.actions.githubusercontent.com`.

The platform's `mirror-images.sh` pins the platform repository's identity, so it
does not verify sensor images. Verify sensor images with `cosign verify` and the
sensor identity above, and copy them with `oras cp -r` so the signatures travel
with them. The sensor's image variants and binaries are described on the
[Sensors](../sensors/index.md) pages, and the existing
[air-gapped guide](../install/air-gapped.md#sensors) lists the variants to copy.

For Helm, set `sensor.image.digest` and mirror the sensor image under the same
registry prefix ([Install targets](install-targets.md#kubernetes-with-helm)).

## Pairing and trust

- A sensor pairs with the **internal** platform URL. It does not need the
  internet to do so. See [Pairing](../sensors/pairing.md).
- It verifies signed jobs against the signer's public key, which it gets from
  the platform. See [Security](../sensors/security.md).
- It needs to reach the **scan targets**, not the internet, once its scanner
  content comes from a local mirror.

## Scanner content without internet access

Scanners need content: nuclei templates, the Trivy database, SAST rules. The
sensor reads them from a local mirror or directory. The settings are on
[Network](../sensors/network.md#scanner-content-without-internet-access) and in
[Content and intelligence feeds](feeds.md).

## Network needs

- To the platform: the address the sensor was paired with. It reaches the
  sensor mTLS listener (port 9443 of the API, which the gateway publishes).
- To the targets: whatever you scan.
- To the registry: only for pulling the sensor image.
- Not needed: the internet, once the sensor image and the scanner content are
  local.

Details: [Sensor network requirements](../sensors/network.md).

## Updates

Sensors do not update themselves. Take each sensor release in through the same
intake as the platform, then roll it out the way you roll out the platform.

## Related

[Sensors](../sensors/index.md), [Content and intelligence feeds](feeds.md),
[Troubleshooting](troubleshooting.md)
