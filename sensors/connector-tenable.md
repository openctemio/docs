---
title: Tenable.sc connector
parent: Sensors
nav_order: 6.8
---

# Tenable.sc connector
{: .no_toc }

The Tenable.sc connector brings a **Tenable Security Center** (Tenable.sc) you
run inside your network into OpenCTEM. It:

- pulls hosts, open and mitigated vulnerabilities and plugin metadata;
- launches the scans you schedule in OpenCTEM, follows them, pulls their
  results and deletes the scan definition it created;
- sends everything to OpenCTEM as findings and assets, with how each target
  ended (assessed, did not reply, not finished).

It is its own image, `ghcr.io/openctemio/connector-tenable`
([openctemio/connector-tenable](https://github.com/openctemio/connector-tenable)):
a sensor that runs nothing but the connector. **The Tenable.sc API keys stay in
that container.** OpenCTEM never receives, stores or forwards them, and needs
no route into your network. The connector runs no scanner, so scanned content
never shares a process with the keys.

1. TOC
{:toc}

## Install

1. In OpenCTEM, **Discovery > Sensors > Add sensor**, keep **Create a pairing code first**: the console shows a single-use pairing code; copy it. (The
   connector settings dialog under **Settings > Integrations > Vulnerability
   scanners > Connect Tenable.sc** also shows the install command, under
   **No connector yet? Run it next to Tenable.sc**.)
2. Create a least-privilege Tenable.sc user for OpenCTEM (view on the
   repositories you want pulled; for scans, "create scans" with the allowed
   policies shared to it) and save its API keys in two files.
3. Write the connector config, `/etc/openctem/connectors/tenable-sc.yaml`:

   ```yaml
   apiVersion: openctem.io/connector-tenable-sc/v1
   instances:
     - name: sc-prod                     # the only thing OpenCTEM knows
       url: https://sc.example.com        # https only
       ca_file: /etc/openctem/connectors/tenable-ca.pem
       access_key_file: /run/secrets/tenable-sc/access_key
       secret_key_file: /run/secrets/tenable-sc/secret_key
       allow:
         operations: [sync]              # add "scan" to allow scans
         repositories: [5, 7]            # nothing is read without it
         scan_policies: [1000003]        # required for scan
         scan_repositories: [5]          # required for scan
   ```

4. Run the connector on a host that can reach both OpenCTEM and Tenable.sc:

   ```bash
   docker run -d --name connector-tenable --restart unless-stopped \
     --read-only --cap-drop ALL --security-opt no-new-privileges:true \
     -e SENSOR_API_URL=https://openctem.example.com \
     -e SENSOR_PAIRING_CODE=XXXX-XXXX \
     -v connector-tenable-data:/var/lib/openctem \
     -v /etc/openctem/connectors:/etc/openctem/connectors:ro \
     -v /run/secrets/tenable-sc:/run/secrets/tenable-sc:ro \
     ghcr.io/openctemio/connector-tenable:v0.1.0
   ```

5. Approve the pairing in OpenCTEM (check the fingerprint in
   `docker logs connector-tenable`) and choose the **Scanner connector**
   profile under **What it may do** (tool `tenable_sc`). A new sensor is at trust level **New**:
   it receives syncs only. Trust it before you launch scans.
6. **Settings > Integrations > Vulnerability scanners > Connect Tenable.sc**:
   pick the connector's sensor and type the instance name (`sc-prod`).

The image is distroless and runs as a non-root user under the default seccomp
profile, with a read-only root filesystem and no capabilities; it listens on
no port. Keep `/var/lib/openctem` on a volume: it holds the identity and the
outbox of results not yet delivered.

## What the platform can ask, and what you decide

| | OpenCTEM decides | You decide in the config |
|---|---|---|
| Sync | when (schedule, Sync now), incremental or full, minimum severity, a subset of repositories | which repositories may be read at all |
| Scans | targets (after the scope gate), policy, repository, zone, maximum duration | whether scans are allowed, which policies, repositories and zones, the most targets and the longest scan |
| Licence rotation | batch size and timing | whether the rotation repository may be recycled (`recycle`, off by default) |

The platform never sends a URL, a header or a free-form filter, and can only
narrow what you allowed. The full configuration reference, TLS pinning, limits
and the licence guard are in the connector's
[documentation](https://github.com/openctemio/connector-tenable/blob/main/docs/tenable-sc.md).

## Verify the image

```bash
cosign verify ghcr.io/openctemio/connector-tenable:v0.1.0 \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp '^https://github\.com/openctemio/connector-tenable/\.github/workflows/images\.yml@refs/tags/v'
```

## Moving from the sensor

Sensor releases up to v0.23.0 carried the connector. Sensor v0.23.1 and later no
longer run it: a sensor still started with `-tenable-sc-config`,
`SENSOR_TENABLE_SC_CONFIG`, a `TENABLE_SC_*` variable or
`/etc/openctem/connectors/tenable-sc.yaml` starts without it and prints a
notice. Run the connector image with the same config file and key files, pair
it, and point the Tenable.sc integration at its sensor.
