---
title: Upgrade, back up and remove
parent: Sensors
nav_order: 7.7
---

# Upgrade, back up and remove a sensor
{: .no_toc }

Everything a sensor keeps is on one volume at `/var/lib/openctem`: its
identity (`state/`), the results the platform has not accepted yet
(`outbox/`) and a scanner cache (`content/`). Upgrades, rollbacks and moves
keep that volume; nothing else on the host matters.

1. TOC
{:toc}

---

## Before you upgrade

1. Read the [sensor release notes](https://github.com/openctemio/sensor/blob/main/CHANGELOG.md)
   from your version to the new one. Look for **Upgrade notes** entries.
2. Check the console: **Discovery > Sensors** marks a sensor whose version or
   SDK is outdated or unsupported, and names the newest release the platform
   knows (see [How the console judges a sensor's version](#how-the-console-judges-a-sensors-version)).
3. Upgrade one sensor first, check it, then the rest.

Notes that stop a sensor if missed:

| From | To | What to change first |
|---|---|---|
| a config-file daemon with `enable_commands` unset | v0.21.0 or later | The daemon takes platform commands by default: such a sensor now polls the platform (and pairs on first start when it has no key). Set `sensor.enable_commands: false` to keep it scheduled-only. `-daemon`, `-enable-commands` and `SENSOR_TOOLS` / `-tools` still work with a warning; the `-enable-recon` family of flags is ignored. |
| any | v0.17.0 or later | Every setting is `SENSOR_`-prefixed. `API_URL` → `SENSOR_API_URL`, `API_KEY` → `SENSOR_API_KEY`, `REGION` → `SENSOR_REGION`, `PLATFORM_KEY_AUTORENEW` → `SENSOR_KEY_AUTORENEW`; `AGENT_ID`, `AGENT_NAME`, `AGENT_ALLOW_PRIVATE_TARGETS` and `OPENCTEM_SDK_ALLOW_PRIVATE_TARGETS` are gone (use `SENSOR_ID`, `SENSOR_NAME`, `SENSOR_ALLOW_PRIVATE_TARGETS`). With an old name set the sensor exits with code 2: `Error: environment variables a sensor no longer reads are set: API_URL (rename it to SENSOR_API_URL)`. |
| any | v0.17.0 or later | The default image has no shell. Scripts that `docker exec` into the sensor stop working; run the image's own commands instead (below). |
| three volumes | v0.16.0 or later | One volume at `/var/lib/openctem` replaces `state`, `outbox` and `content` volumes. The old layout keeps working; to move, see [Move from three volumes to one](deploy-docker.md#move-from-three-volumes-to-one). |
| v0.8.x or older | any current | Protocol v1 is retired: such a sensor cannot connect to a current platform at all. Install a current release on the same volume. |

Notes that change what a sensor does:

| To | What to know |
|---|---|
| v0.29.0 or later | Tool launches wait while the host's CPU, memory or I/O is stalled (one tool keeps running), and a start that was starved is tried once more instead of failing as a crash. The heartbeat reports the pressure, so the platform gives the sensor less work while its host is overloaded. Where the sensor's cgroup is delegated each task runs in its own cgroup with its tool's limits; `SENSOR_TOOL_CGROUPS=off` turns that off. Keep CI runners and other heavy workloads off a sensor host. |
| v0.27.0 or later | Enrolls with an organization enrollment token (`SENSOR_ENROLLMENT_TOKEN` or `_FILE`). Can run a proxy pool test, sends validation probes through the job's proxy pool, and with `SENSOR_SCAN_EGRESS=direct-only` reports that its host chose direct, so the platform runs its scans direct ([Proxies for scans](proxies.md)). |
| v0.22.0 or later | Upgrade the platform to v0.9.6 first. A confined sensor now reports a target its confinement kept the tool from reaching as `egress_refused`; an older platform reads that as unfinished and hands the target out again, until its attempts run out. |
| v0.23.1 or later | The Tenable.sc connector is no longer in the sensor. Run it as its own image, `ghcr.io/openctemio/connector-tenable`, and point the Tenable.sc integration at that sensor ([Tenable.sc connector](connector-tenable.md)). A sensor still started with the connector settings starts without it and prints a notice naming the image. |
| v0.23.1 or later | nuclei, httpx and katana send the identification a bug-bounty program requires (the organization's User-Agent and headers) on every request of a job that carries it; a tool that cannot send it is refused for such a job. subfinder, dnsx and naabu send no HTTP to the targets and run (from v0.23.2). The platform hands such jobs only to sensors that report `http.identity@1`. |
| v0.23.0 or later | nuclei runs a task over several hosts in up to 4 waves of whole hosts. Each wave's findings are delivered and its hosts freed when the wave ends, so the next step of a workflow starts on them while later waves run. Each extra wave loads the templates again (about 5 s with 10,000 templates). A failed wave keeps the earlier waves' results; its targets and the later ones run again. |
| v0.22.2 or later | The target guard refuses per target: a refused target is left out with its reason and the others run. |
| v0.22.0 or later | A sensor with semgrep and no rules configured runs the signed OpenCTEM rules pack instead of semgrep's registry rules. Set `SENSOR_CONTENT_SEMGREP_RULESETS` to keep registry rules. The sensor needs HTTPS to `api.github.com`, `github.com` and `release-assets.githubusercontent.com` for the pack, or a mirror ([Network](network.md)). |

## How the console judges a sensor's version

A sensor is judged by what it reports (the protocol it speaks, the SDK it was
built with, its product and version), against ranges the platform owns. You
never need a platform upgrade to run a newer sensor release.

| Check | Comes from | What you see |
|---|---|---|
| Product version, first-party sensors (`openctemio-*`: the scanning sensor, the Tenable.sc connector) | The newest release comes from the platform's signed release feed, checked daily; the minimum comes with the platform release | **latest**, **update available** or **unsupported** (older than the minimum: upgrade it) |
| Product version, a sensor your organization builds | The latest and minimum release you record under [Settings › Scanning › Sensor products](../user-guide/10-settings-and-integrations.md#sensor-products) | The same verdicts, for your organization only; nothing recorded means no version verdict |
| SDK (sensors built with sdk-go) | The newest SDK release from the feed, a minimum and security advisories from the platform | An older SDK shows as outdated; one below the minimum, or with a published advisory, marks the sensor degraded (rebuild it with a newer SDK) |
| Protocol | The API versions the platform serves | A protocol the platform no longer serves cannot connect at all |

When the installation has no current release information (an air-gapped
instance, or the feed could not be read), the newest version the platform knows
is the one it was released with, and the sensor's check says so: "Newer releases
may exist". The install commands on the Sensors page follow the same newest
release.

## Upgrade

The seccomp profile belongs to a release: download the one of the new release
with it.

**docker run**

```bash
NEW={{ site.data.versions.sensor }}
docker pull ghcr.io/openctemio/sensor:$NEW
curl -fsSLo openctem-sensor-seccomp.json \
  https://raw.githubusercontent.com/openctemio/sensor/$NEW/docker/seccomp/sensor.json
docker stop openctem-sensor && docker rm openctem-sensor
# run the same docker run command as before, with the new tag
```

`docker stop` lets running scans drain (`--stop-timeout`); results still
queued stay in the outbox on the volume and are sent by the new container.

**Docker Compose**: change `image:` (and the profile file), then
`docker compose up -d`.

**Kubernetes**: change the image tag (chart: `sensor.image.tag`; manifests:
`image:` and, with a `Localhost` profile, the profile file on the nodes and
`localhostProfile`). The `Recreate` strategy stops the old pod first.

**Binary**: install the new release over the old file (verify it as in
[Download a release](deploy-binary.md#download-a-release)), then
`sudo systemctl restart openctem-sensor`.

### Check the upgrade

```bash
docker logs openctem-sensor 2>&1 | grep -E 'Identity:|Tool network:|Transport:|Preflight:'
```

The same identity (no new pairing code), `Tool network: confined`,
`Preflight: ... 0 failed`, and the new version on the sensor's sheet in the
console. A pairing code instead of `Identity:` means the container did not
get the old volume: stop it and start it again with the volume.

The sensor page's **Manifest** tab shows what the sensor registered (build,
resources, concurrency, its tools with what they consume and produce) and the
history of earlier manifests. Items the platform did not accept are listed under
**The platform ignored N items**, each with its reason: not in the tool catalog,
not a known capability, not a valid name, not a valid tool contract, not part of
the manifest format, or over the limit. When every ignored item is one the
platform does not know yet, the tab says **This sensor is newer than the
platform; these items will be used after the platform is updated**: upgrade the
platform. Otherwise it says some items are invalid, and a sensor update will not
change that.

## Roll back

Start the previous tag on the same volume, the same way as an upgrade. The
data on the volume is read by older releases (checked from v0.18.0 back to
v0.17.0), with two limits:

- Below v0.17.0 the sensor reads the old variable names only: rename
  `SENSOR_API_URL` back to `API_URL` (and the others in the table above).
  v0.16.0 started with only `SENSOR_API_URL` set exits with
  `missing: [API_URL]`.
- Below v0.16.0 the image declares its own volumes for `outbox/` and
  `content/`: keep those directories on volumes of their own.

Use the seccomp profile of the release you roll back to.

## Back up and restore

The volume holds the sensor's private key, its only credential. Back it up
encrypted, restore it only to replace this sensor, and never run two sensors
from one copy: the platform flags both `identity_cloned`.

Back up (the `content/` cache can be left out; it is downloaded again):

```bash
docker run --rm -v openctem-sensor-data:/data:ro -v "$PWD":/backup alpine \
  tar -C /data --exclude=./content -czf /backup/openctem-sensor-data.tgz .
```

Restore to a new volume, with the old sensor stopped:

```bash
docker volume create openctem-sensor-data-restored
docker run --rm -v openctem-sensor-data-restored:/data -v "$PWD":/backup:ro alpine \
  tar -C /data -xzpf /backup/openctem-sensor-data.tgz
```

Then start the sensor with `-v openctem-sensor-data-restored:/var/lib/openctem`.
`-p` keeps the owner and the `0600`/`0700` modes; the sensor refuses an
identity readable by others and prints the `chmod`/`chown` that fixes it.
The log shows `Identity: key-bound sensor ...` with the same id, and no
pairing code.

A binary sensor: back up `/var/lib/openctem` the same way with the service
stopped. Kubernetes: snapshot the PVC (`<release>-openctem-sensor-data` for
the chart).

## Rotate the sensor's key

A paired sensor has no secret to rotate on a schedule: its private key never
leaves the volume. Replace it when it may have leaked (a lost backup, a
compromised host):

```bash
docker stop openctem-sensor
docker run --rm -it \
  -e SENSOR_API_URL=https://openctem.example.com \
  -v openctem-sensor-data:/var/lib/openctem \
  ghcr.io/openctemio/sensor:{{ site.data.versions.sensor }} pair -repair
docker start openctem-sensor
```

Add the same CA settings as the daemon (`SENSOR_CA_CERT_FILE` and its mount).
An administrator approves the request like a new pairing. The sensor keeps
its id and history, the old key is revoked at once, and the sensor returns
to trust level **New**: promote it again. Set `SENSOR_NAME`, or retype the
name when you approve, or the sensor takes the name it proposes (by default
its host name). See [Re-pair a sensor](pairing.md#re-pair-a-sensor).

A key-based sensor (`SENSOR_API_KEY`) rotates its own key before it expires
when its state is on a volume; **Rotate key** in the sensor's **⋯** menu replaces it
at once.

After a change of the **platform's** CA, the sensor refuses the new
certificate (`platform certificate does not match the pin stored at
pairing`): re-pair it, or set `SENSOR_CA_FINGERPRINT` to the new CA.

## Remove a sensor

1. In the console, open the sensor and choose **Revoke access** in its **⋯** menu. Its key stops working
   at its next request.
2. On the host, remove the container (or the Deployment, or the service) and
   the volume:

   ```bash
   docker rm -f openctem-sensor
   docker volume rm openctem-sensor-data
   ```

   Kubernetes: delete the Deployment and the PVC (chart: `sensor.enabled=false`
   removes both; back the PVC up first if you may need the identity). Binary:
   `sudo systemctl disable --now openctem-sensor`, then remove
   `/var/lib/openctem`, the unit file and `/etc/openctem`.
3. Delete the backups of its volume: they hold a revoked key, but a key is
   still a credential.

To take a sensor out of service for a while without losing it, use
**Disable** (in the sensor's **⋯** menu; **Enable** undoes it): it keeps heartbeating, logs `paused by platform` and takes no
jobs until it is enabled again.

## Commands that read the volume

The default image has no shell. Run its commands on the stopped sensor's
volume:

```bash
docker run --rm -v openctem-sensor-data:/var/lib/openctem \
  ghcr.io/openctemio/sensor:{{ site.data.versions.sensor }} -outbox-status          # results waiting, dead letters
docker run --rm -v openctem-sensor-data:/var/lib/openctem \
  ghcr.io/openctemio/sensor:{{ site.data.versions.sensor }} -outbox-requeue-dead    # after fixing the cause
docker run --rm -v openctem-sensor-data:/var/lib/openctem \
  ghcr.io/openctemio/sensor:{{ site.data.versions.sensor }} -content-status         # scanner content versions
```

The outbox refuses a second process: with the sensor running, these commands
stop with `another sensor process uses this outbox directory`.
