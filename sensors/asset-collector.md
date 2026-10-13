---
title: Asset collector
parent: Sensors
nav_order: 3.5
---

# Asset collector
{: .no_toc }

The **asset collector** ([`openctemio/asset-collector`](https://github.com/openctemio/asset-collector),
image `ghcr.io/openctemio/asset-collector`, binary `openctem-asset-collector`)
reads the inventory you already keep and sends it to the platform as assets:

| Source | Assets |
|---|---|
| VMware vCenter 7 | Virtual machines and ESXi hosts |
| LDAP / Active Directory | Computers (hosts) with their owner and OS |
| Google Cloud DNS | Domains and subdomains |
| Splunk | Networks and hosts from an index |
| PRTG Network Monitor | Networks and devices |

It is a sensor of type **collector**: it connects out to the platform, needs
no inbound port, and shows under **Discovery > Sensors**. Unlike a scanning
sensor it takes no jobs: it collects on its own schedule and touches no
target. Per-vendor settings, read-only accounts and the exact fields it sends
are in the repository: [`docs/VENDORS.md`](https://github.com/openctemio/asset-collector/blob/main/docs/VENDORS.md),
[`docs/COLLECTORS.md`](https://github.com/openctemio/asset-collector/blob/main/docs/COLLECTORS.md),
[`docs/DATA.md`](https://github.com/openctemio/asset-collector/blob/main/docs/DATA.md).

1. TOC
{:toc}

---

## Versions

| Collector | Platform settings it reads |
|---|---|
| v0.1.1 (latest tag) | `API_URL`, `API_KEY` |
| the next release (`main`) | `SENSOR_API_URL`, `SENSOR_API_KEY`; the old names stop it with exit code 2 |

This page describes the next release: the doctor, `-dry-run`, `/readyz` and
one data volume come with it. Pin a version tag, never `latest`. If
`docker pull ghcr.io/openctemio/asset-collector:<tag>` answers `unauthorized`,
the image is not published for public pulls yet: build it from the
repository (`make docker`) and use that tag.

## Before you start

- An organization administrator with **Write sensors** and, to trust the
  collector, **Widen sensor grants**.
- The collector authenticates with an API key; it does not pair. New
  organizations allow only paired sensors: turn off **Require key-bound
  sensor identity** under **Settings > Organization > General** first.
  Otherwise creating it fails with `BEARER_KEYS_DISABLED`.
- A read-only account on each source ([`docs/VENDORS.md`](https://github.com/openctemio/asset-collector/blob/main/docs/VENDORS.md)).
- A host that reaches the sources and the platform (outbound HTTPS).

## 1. Create the collector on the platform

1. **Discovery > Sensors > Install a sensor**, a name, role **Collector**.
2. Platform releases after v0.9.2: tick **Trust this collector to push asset
   reports** (it needs **Widen sensor grants** and a recent sign-in). A new
   collector gets the `collector` grant profile by itself.
3. Copy the API key (`octs_...`); it is shown once.

Ignore the install commands the dialog shows for this role: they start the
scanning sensor image, not the collector. Use the commands below.

{: .warning }
On platform v0.9.2 and older the new collector gets the
`internal-network-scanner` profile and starts **New**, and every report is
refused until you change both. See [Grant and trust](#grant-and-trust).

## 2. Write the settings

One file, readable only by you. The platform and one source are enough; this
example reads Active Directory:

```bash
install -m 0600 /dev/null collector.env
cat >> collector.env <<'EOF'
SENSOR_API_URL=https://openctem.example.com
SENSOR_API_KEY=octs_...
LDAP_URL=ldaps://dc1.example.com:636
LDAP_BIND_DN=svc-openctem@example.com
LDAP_PASSWORD=...
LDAP_BASE_DN=DC=example,DC=com
EOF
```

Secrets can come from files: `LDAP_PASSWORD_FILE=/run/secrets/ldap` instead
of `LDAP_PASSWORD`, and `SENSOR_API_KEY_FILE` for the key. Several sources and
schedules need a config file (`config.example.yaml` in the repository,
mounted at `/app/config.yaml`).

**Platform with a private CA** (TLS mode `internal`): mount a PEM file that
holds the platform's root CA and set `SSL_CERT_FILE` to it. `SENSOR_CA_CERT_FILE`
is honored only by the daemon: the doctor and one-shot runs ignore it and fail
with `x509: certificate signed by unknown authority`.

## 3. Check before the first run

```bash
docker volume create asset-collector-data
docker run --rm --env-file collector.env \
  -v asset-collector-data:/var/lib/openctem \
  ghcr.io/openctemio/asset-collector:<tag> doctor
```

The doctor checks the settings, the state volume, the platform (an
authenticated call) and each source (log in or bind, nothing collected), and
prints a fix for every failure. It cannot read the collector's grant: see
[Grant and trust](#grant-and-trust). `-dry-run` instead of `doctor` prints the
assets that would be sent, without sending them.

## 4. Start it

```bash
docker run -d --name asset-collector --restart unless-stopped \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  --env-file collector.env -v asset-collector-data:/var/lib/openctem \
  -p 127.0.0.1:2112:2112 \
  ghcr.io/openctemio/asset-collector:<tag> -daemon
docker logs -f asset-collector
```

Start with `-daemon`, not a one-shot run: the daemon first registers the
collector's tools with the platform. A one-shot run on a collector that never
ran as a daemon is refused with `tool-not-permitted` (HTTP 422).

Docker Compose and systemd units: [`docs/DEPLOY.md`](https://github.com/openctemio/asset-collector/blob/main/docs/DEPLOY.md).
There are no Kubernetes manifests; run it as a single-replica Deployment
with a PersistentVolumeClaim at `/var/lib/openctem`, like the
[sensor](deploy-kubernetes.md#option-b-plain-manifests-pairing) (the image
runs as uid 65532).

## 5. Check that it works

Do not rely on the collector's own log line: `msg=submitted ... result="accepted, report=..."`
means the platform received the report, not that it created assets. A report
the grant refuses is dropped later.

1. **Discovery > Sensors**: the collector is `online`.
2. Open it: its **Grant** section says nothing about refused reports. A
   refused collector shows "This collector's reports are refused" with the
   fix (platform releases after v0.9.2); on older platforms check the audit
   log for `sensor.push_refused_grant`.
3. **Assets**: the hosts appear within a minute of the run.
4. On the host: `curl -s localhost:2112/readyz` lists each collector's last
   run, last success and asset count.

## Grant and trust

A collector's reports are not tied to a platform job, so the platform admits
them only from a sensor whose grant allows push ingest **and** which is
**Trusted**. Until both hold, every report is refused with
`push_ingest_not_granted`:

| Platform | What to do |
|---|---|
| After v0.9.2 | Tick the trust box when you create the collector, or later: open it, **Promote to Trusted**. The `collector` profile is the default for new collectors. |
| v0.9.2 and older | Open the collector, change its **Grant** profile to `collector`, then **Promote to Trusted**. |

The same through the API (an administrator token after a recent sign-in):

```bash
curl -X PUT https://openctem.example.com/api/v1/sensors/<id>/grant \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"version": <current version>, "profile": "collector", "trust_level": "trusted"}'
```

Trust lets the collector **add** assets; it never changes or removes
existing ones, and scope exclusions still apply. Promoting is audited at high
severity and notifies every administrator.

## Upgrade, back up and remove

- **Upgrade**: pull the new tag, recreate the container with the same volume.
  Read the release notes; from the v0.1.x line, rename `API_URL` and
  `API_KEY` (and `agent:` in the config file to `sensor:`). See
  [`docs/UPGRADING.md`](https://github.com/openctemio/asset-collector/blob/main/docs/UPGRADING.md).
- **Back up** the volume: it holds the collector's credential (the renewed API
  key, or the signing key it bound) and the outbox of reports not yet
  delivered. Same commands as for a sensor
  ([Back up](deploy-docker.md#back-up)), with
  `asset-collector-data`.
- **Remove**: **Revoke** the collector in the console, then
  `docker rm -f asset-collector && docker volume rm asset-collector-data`,
  and delete the backups.

## Troubleshooting

| Message | Cause | Fix |
|---|---|---|
| `BEARER_KEYS_DISABLED` when creating it | The organization requires paired sensors | Turn off **Require key-bound sensor identity**, then create it |
| `environment variables a sensor no longer reads are set: API_URL ...` (exit 2) | Old names with the next release | Rename to `SENSOR_API_URL`, `SENSOR_API_KEY` |
| `x509: certificate signed by unknown authority` (doctor, one-shot) | Private platform CA | `SSL_CERT_FILE` with the platform's root ([step 2](#2-write-the-settings)) |
| `tool-not-permitted` (HTTP 422), report moved to `outbox/dead` | A report before the collector's tools were registered | Run `-daemon`; after the first heartbeat, requeue the dead letter or wait for the next run |
| Assets do not appear, the log says `accepted` | The grant or trust refuses the reports | [Grant and trust](#grant-and-trust) |
| **Setup & health** shows `tools.available` "No scanner is available" | The check is written for scanning sensors | Ignore it for a collector |
| `run skipped: too_soon` | The last run is more recent than the schedule | Expected; the run history is in the state volume |

More, per source: [`docs/TROUBLESHOOTING.md`](https://github.com/openctemio/asset-collector/blob/main/docs/TROUBLESHOOTING.md).

## Security notes

- Give each source a **read-only** account; PRTG provisioning (which writes
  to PRTG) is off by default.
- The collector sends only an allow-list of fields per source
  ([`docs/DATA.md`](https://github.com/openctemio/asset-collector/blob/main/docs/DATA.md));
  `exclude_properties` narrows it further.
- Keep secrets in files (`*_FILE`), not in the environment or on the
  command line.
- Run it as the image's non-root user with `--read-only`, `--cap-drop ALL`
  and `no-new-privileges`; publish the metrics port only on localhost (it has
  no authentication).
- The volume is a credential: back it up encrypted, never share it between
  two collectors.
