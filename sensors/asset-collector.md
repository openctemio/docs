---
title: Asset collector
parent: Sensors
nav_order: 6.7
---

# Asset collector
{: .no_toc }

The asset collector reads the inventory of systems you already run and sends
it to OpenCTEM as assets. It is a sensor of type **Collector**: it connects
out to the platform, needs no inbound port, takes no scan jobs and runs no
scanner. It reads:

| Source | Sends |
|---|---|
| VMware vCenter | virtual machines and ESXi hosts: names, addresses, guest OS and version, power state, placement (host, cluster, datacenter, port groups), and owner, environment and criticality from mapped custom attributes |
| Active Directory / LDAP | computers: names, OS and version, enabled, last logon (the asset's last-seen time), stale (no logon for 90 days), OU, owner's mail or UPN, service principal names, delegation, domain controller role |
| Google Cloud DNS | domains and subdomains (A, AAAA, CNAME), with private zones marked not internet-accessible |
| Splunk | hosts and network devices seen in the indices you name, with their last-seen time |
| PRTG Network Monitor | network devices: name, address, group, vendor, model, firmware version, serial |

Only what a CTEM stage uses is sent: each source has an allow-list in the
collector's code, and its configuration can narrow it, never widen it. It
never sends hardware details (CPU, memory, disks), snapshots, performance
data, group memberships, descriptions, password or LAPS data, or personal
data beyond the owner's mail or UPN.

1. TOC
{:toc}

---

## Before you start

- A Linux host with Docker that can reach the platform (TCP 443) and the
  systems the collector reads.
- **Access to the image.** `ghcr.io/openctemio/asset-collector` is a private
  image: the maintainers grant read access to a GitHub account. Log in once
  with that account and a personal access token with `read:packages`, or the
  pull fails with `denied` or `unauthorized`:

  ```bash
  docker login ghcr.io -u <github-user>
  ```

- A read-only account on each source: vCenter with the `ReadOnly` role, a
  directory account that can read computer objects, a Cloud DNS reader
  service account, a Splunk token that can search the named indices, a PRTG
  user with read access.

## 1. Add the collector

**Pair it** (organizations that require key-bound sensor identity, the
default for new ones):

1. In **Discovery > Sensors > Add sensor**, pick Docker and copy the pairing
   code from the command shown (`SENSOR_PAIRING_CODE=XXXX-XXXX`). Put it in
   the collector's settings in step 2.
2. Start the collector (step 3). It attaches to the code and prints a
   fingerprint; the console finds it by itself.
3. Approve it when the console shows the same fingerprint, choose type
   **Collector**, and confirm with your second factor.

Without a code the collector prints its own code and fingerprint when it
starts: open **Discovery > Sensors > Add sensor > Open the approve page** and
enter it.

**Or install it with a key**, where the organization allows key-based
sensors: **Discovery > Sensors > Install sensor**, role **Collector**. The key
(`octs_…`) is shown once, with ready-made install commands.

## 2. Trust it

A new collector gets the **Collector** grant profile, but the platform refuses
its reports until it is **trusted**. Open the sensor and choose **Promote to
Trusted** (when installing with a key you can tick **Trust this collector to
push asset reports** instead). Both need the right to widen sensor grants,
are audited at high severity and notify every administrator.

A trusted collector:

- adds the assets it reports that the organization does not have yet;
- with a complete report (every object of the source read), also updates the
  assets it created itself and marks the ones it no longer lists as stale
  (never deleted; a large drop is held back as a safeguard);
- never changes an asset another source created or a person edited or
  locked;
- never adds an asset that matches one of your scope exclusions.

A partial report (the account could not read part of the source) and an
incremental one (only the directory objects changed since the last run) add
and refresh assets but never mark anything stale.

## 3. Configure and start

Write the settings in one file, readable only by you. The platform and one
source are enough; this example reads Active Directory:

```bash
install -m 0600 /dev/null collector.env
cat >> collector.env <<'EOF'
SENSOR_API_URL=https://openctem.example.com
SENSOR_PAIRING_CODE=XXXX-XXXX        # from Add sensor; or SENSOR_API_KEY=octs_... with a key
LDAP_URL=ldaps://dc1.example.local:636
LDAP_BIND_DN=svc-openctem@example.local
LDAP_PASSWORD=...
LDAP_BASE_DN=DC=example,DC=local
EOF
```

Every variable can come from a file instead (`LDAP_PASSWORD_FILE=/run/secrets/ldap`):
a secret in a file does not show in `docker inspect`.

Check the platform, the credential and each source, read-only:

```bash
docker volume create asset-collector-data
docker run --rm --env-file collector.env -v asset-collector-data:/var/lib/openctem \
  ghcr.io/openctemio/asset-collector:latest doctor
```

Start it:

```bash
docker run -d --name asset-collector --restart unless-stopped \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  --env-file collector.env -v asset-collector-data:/var/lib/openctem \
  -p 127.0.0.1:2112:2112 \
  ghcr.io/openctemio/asset-collector:latest -daemon
docker logs -f asset-collector
```

It collects from every source at start, then hourly (each source can have its
own schedule in a configuration file). Each run logs `report processed` with
the accepted, rejected and quarantined counts. **Keep the volume**: it holds
the collector's identity and the reports not yet delivered; lose it and the
collector must be paired again.

`-dry-run` in place of `-daemon` prints the reports it would send, without
sending them. Several sources, schedules, other vendors, least-privilege
accounts and every setting are described in the collector's own
documentation, available with access to the image.

## Health and metrics

On port 2112 (no authentication: publish it on loopback or a monitoring
network only):

- `/healthz`: the process is serving;
- `/readyz`: each source's last run, last success and asset count (no error
  text);
- `/metrics`: Prometheus metrics per source, for example
  `openctem_collector_last_success_timestamp_seconds` (alert when it is older
  than two schedule periods) and `openctem_collector_auth_failed`.

The collector never hammers a source: one session per run, a rate and
concurrency limit per endpoint, retries only for transient failures, exactly
one login attempt (a refused password is not retried, so the account is not
locked), and a circuit breaker after repeated failures.

## Verify the image

The images are signed (keyless, with an SBOM and provenance):

```bash
cosign verify ghcr.io/openctemio/asset-collector:<tag> \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp '^https://github\.com/openctemio/asset-collector/\.github/workflows/docker-publish\.yml@refs/tags/v'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `docker pull` answers `denied` or `unauthorized` | The image is private | `docker login ghcr.io` with the account the maintainers gave read access, see [Before you start](#before-you-start) |
| `the platform refused the report … missing=trust` | The collector is not trusted | **Promote to Trusted** on the sensor ([step 2](#2-trust-it)) |
| `… missing=grant` | Its grant profile is not **Collector** (a collector created long ago, or edited) | Set the profile to **Collector** in the sensor's **Grant**, then promote it |
| `asset_excluded` in the log | An asset matches one of your scope exclusions | Expected: it is not added. Remove the exclusion to track it |
| `authentication failed: not retried until the next scheduled run` | The source refused the account (the log names the cause, such as account locked or password expired) | Fix the credential; the next scheduled run tries again |
| `partial inventory: reported as partial` | The account cannot read part of the source | Grant read access to the missing objects; until then nothing is marked stale |
| `the url is http://` warning | A vCenter, Splunk or PRTG URL is plain `http://`: credentials cross the network unencrypted | Use `https://` |

See also [Grants and trust](pairing.md#grants-and-trust) and
[Sensor troubleshooting](troubleshooting.md).
