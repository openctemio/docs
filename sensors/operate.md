---
title: Upgrade, back up and remove
parent: Sensors
nav_order: 7.7
---

# Upgrade, back up and remove a sensor
{: .no_toc }

See how it works: [Sensor upgrade](../how-it-works/sensors/upgrade.md), [Disable, revoke and delete a sensor](../how-it-works/sensors/revoke.md).

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
| any | v0.40.0 or later | **New pairings need platform v0.21.0 or later**, which signs its pairing answers; against an older platform `pair` and auto-pairing stop with `pairing_answer_unsigned` and save nothing. Sensors already paired keep working. The example Compose files and `deploy/multi` set `SENSOR_SANDBOX=required`: on a host that cannot run the sandbox the sensor refuses to start ([Host requirements](host-requirements.md)). Write the seccomp profile again: it now allows `chroot` (the browser tool needs it). |
| any | v0.38.0 or later | Task credentials (tool source keys, proxy pool logins) arrive only as sealed task secrets, which **platform v0.21.0 is the first release to serve**. Upgrade the platform first; on an older platform such a sensor gets no platform keys and refuses a job whose pool needs credentials. A sensor paired with a bearer key gets no task secrets: pair it again. |
| a config-file daemon with `enable_commands` unset | v0.21.0 or later | The daemon takes platform commands by default: such a sensor now polls the platform (and pairs on first start when it has no key). Set `sensor.enable_commands: false` to keep it scheduled-only. `-daemon`, `-enable-commands` and `SENSOR_TOOLS` / `-tools` still work with a warning; the `-enable-recon` family of flags is ignored. |
| any | v0.36.0 or later | Every result is a CTIS 2.0 document, with no compatibility mode. **Upgrade the platform to v0.19.0 or later first**: an older platform refuses every result of such a sensor, and a platform from v0.19.0 refuses the results of an older sensor (the console shows "version unsupported" or "SDK unsupported", and the sensor stays connected). A secret finding carries a fingerprint only when the sensor has its per-installation key; keep the data volume. |
| any | v0.17.0 or later | Every setting is `SENSOR_`-prefixed. `API_URL` → `SENSOR_API_URL`, `API_KEY` → `SENSOR_API_KEY`, `REGION` → `SENSOR_REGION`, `PLATFORM_KEY_AUTORENEW` → `SENSOR_KEY_AUTORENEW`; `AGENT_ID`, `AGENT_NAME`, `AGENT_ALLOW_PRIVATE_TARGETS` and `OPENCTEM_SDK_ALLOW_PRIVATE_TARGETS` are gone (use `SENSOR_ID`, `SENSOR_NAME`, `SENSOR_ALLOW_PRIVATE_TARGETS`). With an old name set the sensor exits with code 2: `Error: environment variables a sensor no longer reads are set: API_URL (rename it to SENSOR_API_URL)`. |
| any | v0.17.0 or later | The default image has no shell. Scripts that `docker exec` into the sensor stop working; run the image's own commands instead (below). |
| three volumes | v0.16.0 or later | One volume at `/var/lib/openctem` replaces `state`, `outbox` and `content` volumes. The old layout keeps working; to move, see [Move from three volumes to one](deploy-docker.md#move-from-three-volumes-to-one). |
| v0.8.x or older | any current | Protocol v1 is retired: such a sensor cannot connect to a current platform at all. Install a current release on the same volume. |

Notes that change what a sensor does:

| To | What to know |
|---|---|
| v0.41.0 or later (sdk-go v0.50.0) | A platform (shared) sensor with a pinned job signer answers the platform's Certificate Transparency lookups (`lookup.ct@1`): settings `SENSOR_CT_LOOKUP`, `SENSOR_CT_CRTSH_URL`, `SENSOR_CT_CERTSPOTTER_URL`, `SENSOR_CT_CERTSPOTTER_KEY` (or `_FILE`); an organization's sensor never serves them ([Shared sensors](shared-sensors.md)). `SENSOR_ASN_DATASET_URL` and `SENSOR_RDAP_BOOTSTRAP_URL` point the lookups at an https mirror, `SENSOR_ASN_RDAP_FALLBACK=off` turns the registry fallback off (host only). A job that requires identification, or carries a query parameter or a User-Agent rotation list, runs only in the tool host, never in process; the sensor advertises `http.identity.required@1`. |
| v0.40.0 or later (sdk-go v0.48.0) | Pairing saves only what the platform signed. The browser image `ghcr.io/openctemio/sensor:<version>-browser` adds the `webshot` tool (`capture.screenshot@1`), which runs only in the full task sandbox. At start-up the sensor proves its isolation backends (config check `runtime.isolation`). `deploy/multi/sensors.sh` verifies each image with cosign and runs it by digest (`--dry-run`, `--skip-verify`); a kit from before this release runs `upgrade --self-update` first. |
| v0.39.0 or later | Out-of-band callbacks use only the operator's own interaction server: set `SENSOR_OOB_SERVER` (public interaction servers are no longer used; without one, scans run without callbacks and the result says why). Service detection (`svcdetect`, `detect.services@1`) is compiled in. |
| v0.38.4 or later (sdk-go v0.47.3) | Use v0.38.4: v0.38.3 published no images. A tool that contacts its targets (tier T1 and above) is refused on a host where the tool sandbox does not exist (every macOS or Windows sensor) with the refusal `unconfined_sandbox`; passive lookups still run. To keep running those tools there, set `SENSOR_SANDBOX=off`, which says that every tool runs unconfined. A local policy without `allow_interactsh` now follows the platform's job (only `allow_interactsh: false` turns out-of-band callbacks off), and a job whose callbacks are turned off runs without them instead of being refused. A job's callbacks use only the interaction server of the sensor's operator, through the task's forwarder, never a public one; a job cannot name a server. The passive image holds no compiled-in tool above T0 (see [Pick an image](deploy-docker.md#1-pick-an-image)). |
| v0.38.3 or later | Path discovery: the compiled-in `webguess` tool (capability `enumerate.web_paths`) requests only the candidate paths a signed job carries, with GET or HEAD, and reports the ones that answer differently from the origin's not-found answer (no body is kept). It refuses to run unless the job's web scope allows only GET and HEAD and caps the requests per host. katana never requests a logout, delete or reset link, and its deep preset no longer fills forms. nuclei accepts the setting `template_ids` for the sensor's own compiled-in checks ([Tool settings](tool-settings.md#options-per-tool)). |
| v0.38.2 or later (sdk-go v0.47.2) | A deny path with a `*` segment (`/tenants/*/admin`), an escaped one (`/files/My%20Docs`) and lenient spellings of a path (case, trailing dots, double decoding) now hold in the web scope, in katana and in the forwarder. The forwarder bounds every response head it reads. Every nuclei run excludes the templates `email-extractor`, `secrets-patterns-pii`, `rdap-whois` and `credit-card-number-detect`, which only collect personal data. Upgrade the sensor; no configuration changes. |
| v0.38.1 or later (also v0.37.1, v0.37.2) | nuclei declares the web origin assets it reports. Before, a platform that checks a report against the declared types held every nuclei match for review. A platform from v0.20.0 releases held matches itself within 5 minutes of the sensor's changed manifest; on an older platform approve them in the results quarantine. The registration lookup (rdap) asks for the registered domain of a subdomain and says why it found nothing (`registry_has_no_rdap`, `not_registered`). v0.37.2 is the same katana and forwarder fix as v0.38.2 for the v0.37 line. |
| v0.38.0 or later | Task secrets (provider keys for subfinder, proxy pool credentials) reach a sensor sealed, per task, from the platform's `/api/v2/sensor/commands/{id}/secrets`, and only for a sensor that signs its requests (a bearer-key sensor receives none). Platform v0.21.0 is the first release that serves that route; on an older platform a v0.38 sensor receives no platform keys and refuses a job whose proxy pool needs credentials. subfinder reads only its own task's provider configuration, never the one in the sensor user's home directory: keys kept there are no longer used. `http.allow_insecure_tls: false`, `http.user_agent`, `http.headers` and `rate.max_rps` of the local policy now also apply to the built-in tools (nuclei, httpx, katana and the other ported tools); check their values before upgrading. |
| v0.37.0 or later | nuclei with no `severity` setting runs every severity, info included, and honours a step's exclusions (`-exclude-hosts`; before, an excluded host could still be scanned out of process). New nuclei settings `response_read_kb` and `response_save_kb` ([Tool settings](tool-settings.md#options-per-tool)). Upgrade the platform first: an older platform files info matches as info findings. |
| v0.37.0 or later (sdk-go v0.46.3) | A reset from a host that already answered slows the scan instead of opening the circuit breaker, a name that does not resolve is refused as `unresolvable` (not `denied_by_policy`) and completes per target, and the sensor no longer claims job slots it cannot fill. |
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
built with, its product and version), against ranges the platform owns. A newer
sensor release usually needs no platform upgrade; when one does, its upgrade notes
above say so, and the compatibility table in
[Versioning and releases](../operations/versioning.md#current-releases-and-compatibility)
names the oldest platform each current component release works with.

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
