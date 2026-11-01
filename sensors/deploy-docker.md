---
title: Deploy with Docker
parent: Sensors
nav_order: 1
---

# Deploy a sensor with Docker
{: .no_toc }

The sensor runs as a long-running daemon that executes the scans the platform
dispatches to it. It needs outbound HTTPS to the platform and no inbound port.
For the shortest path, follow the
[quickstart](index.md#quickstart-a-working-sensor-in-five-minutes); this page
is the reference behind it. For one guide from prerequisites to
troubleshooting, read [Run the sensor](run-the-sensor.md).

1. TOC
{:toc}

---

## Before you start

- Docker on a Linux host in the network you want to scan. Linux 5.13 or later
  lets the tool sandbox use Landlock; older kernels work with a warning.
- The platform URL, for example `https://openctem.example.com`. With the
  built-in gateway it is the address you open the console with; see
  [The platform URL](network.md#the-platform-url).
- Someone with the **Pair sensors** and **Approve sensors** permissions.

## 1. Pick an image

Use a released version, never `latest` in production:

```bash
docker pull ghcr.io/openctemio/sensor:{{ site.data.versions.sensor }}
```

The default image runs nuclei and the recon tools (subfinder, dnsx, naabu,
httpx, katana). From v0.29.0 there are profile images too: `:{{ site.data.versions.sensor }}-passive`
(passive discovery only: subfinder, with RDAP and ASN lookups built in; it holds
no program that can touch a target), `:{{ site.data.versions.sensor }}-standard` (the default image) and
`:{{ site.data.versions.sensor }}-full` (every tool, code, dependency and image scanning included). For
code scanning on a daemon you can also use a per-tool image such as
`ghcr.io/openctemio/sensor:{{ site.data.versions.sensor }}-opengrep` (or `-semgrep`). See
[What runs inside](how-it-works.md#what-runs-inside).

Release images are signed with cosign (keyless). Verify before you run. The
signatures use the Sigstore bundle format: use cosign v3 (cosign v2.4 and
older report `no signatures found`):

```bash
cosign verify ghcr.io/openctemio/sensor:{{ site.data.versions.sensor }} \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity https://github.com/openctemio/sensor/.github/workflows/docker-publish.yml@refs/tags/{{ site.data.versions.sensor }}
```

Without a local cosign: `docker run --rm ghcr.io/sigstore/cosign/cosign:v3.1.3 verify ...`
with the same arguments.

## 2. Start it

Download the seccomp profile of the same release (see
[Tool confinement](#tool-confinement)):

```bash
curl -fsSLo openctem-sensor-seccomp.json \
  https://raw.githubusercontent.com/openctemio/sensor/{{ site.data.versions.sensor }}/docker/seccomp/sensor.json
```

With `docker run`:

```bash
docker run -d --name openctem-sensor --restart unless-stopped \
  --stop-timeout 45 \
  --read-only --tmpfs /tmp --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --security-opt seccomp="$PWD/openctem-sensor-seccomp.json" \
  -e XDG_CONFIG_HOME=/tmp/.config -e XDG_CACHE_HOME=/tmp/.cache \
  -e SENSOR_API_URL=https://openctem.example.com \
  -e SENSOR_ALLOWED_RANGES='203.0.113.0/24,*.example.com' \
  -e SENSOR_SANDBOX_NETWORK=required \
  --dns-search . \
  -v openctem-sensor-data:/var/lib/openctem \
  ghcr.io/openctemio/sensor:{{ site.data.versions.sensor }}
```

No mode or tool flags are needed: the image's default command is `-verbose`,
the sensor runs as the daemon that takes platform commands, and it enables
every tool in the image whose binary passes its check.

Or with Docker Compose (`compose.yaml` next to `openctem-sensor-seccomp.json`,
then `docker compose up -d`):

```yaml
services:
  sensor:
    image: ghcr.io/openctemio/sensor:{{ site.data.versions.sensor }}
    container_name: openctem-sensor
    restart: unless-stopped
    # Least privilege: read-only root filesystem, no capabilities (add
    # NET_RAW to cap_add only for naabu SYN scans), no privilege escalation.
    # The seccomp profile lets the sensor confine each scan's network.
    read_only: true
    cap_drop: [ALL]
    security_opt:
      - no-new-privileges:true
      - seccomp=./openctem-sensor-seccomp.json
    tmpfs: [/tmp]
    # Look target names up exactly as written (no host search domain).
    dns_search: .
    environment:
      SENSOR_API_URL: https://openctem.example.com
      # Refuse to start unless each scan's network can be confined.
      SENSOR_SANDBOX_NETWORK: required
      # SENSOR_PAIRING_CODE: "K7QM-4ZTD"           # attach to the code of the Add sensor command
      # What this sensor may scan. Without it (or a policy file) a newly
      # paired sensor refuses every job with network targets.
      SENSOR_ALLOWED_RANGES: "203.0.113.0/24,*.example.com"
      XDG_CONFIG_HOME: /tmp/.config
      XDG_CACHE_HOME: /tmp/.cache
      # SENSOR_ALLOW_PRIVATE_TARGETS: "1"           # to scan RFC 1918 / ULA ranges
      # SENSOR_CA_CERT_FILE: /certs/openctem-ca.pem # platform with its own CA
    volumes:
      # state/ (the sensor's key), outbox/ (undelivered results) and
      # content/ (scanner cache): keep it and back it up
      - data:/var/lib/openctem
      # - ./openctem-root-ca.crt:/certs/openctem-ca.pem:ro
    stop_grace_period: 45s
    logging:
      driver: json-file
      options: {max-size: "50m", max-file: "5"}
volumes:
  data:
```

- The image's default command is `-verbose`: the sensor runs as the daemon and
  takes platform commands. Without `SENSOR_API_URL` the container exits with
  code 2 and prints the credentials help. To run only scheduled scans and take
  no platform commands, pass `-enable-commands=false` (or `-standalone`).
- `-daemon`, `-enable-commands` and `SENSOR_TOOLS` / `-tools` still work for
  one release with a deprecation warning; you no longer need them. To narrow
  the tools, use the local policy's `tools.allow`. `-enable-recon`,
  `-enable-vulnscan`, `-enable-secrets`, `-enable-assets`, `-enable-pipeline`
  and `-bootstrap-token` are ignored with a warning. `-agent-id` (use
  `-sensor-id`), `-retry-queue` and `-retry-dir` (the outbox replaced the
  retry queue) are deprecated too.
- The per-tool images (`-opengrep`, `-semgrep`, `-trivy`, `-betterleaks`, `-nuclei`) set
  `CI=true`, so they run one scan and exit by default. To run one as a daemon,
  pass `-daemon` or set `CI=false`.
- `--dns-search .` (Compose: `dns_search: .`) is recommended: target names are
  then looked up exactly as written, and the host's search domain is never
  appended to them. Inside a confined task the sensor already does this; the
  option also covers lookups where the task's resolver file cannot be
  replaced.
- Without `SENSOR_API_KEY` the sensor **pairs** on its first start: read the code
  and the link with `docker logs openctem-sensor` and approve it as described in
  [Pairing](pairing.md).
- The command of **Add sensor** carries a code for you. To make a code
  first instead (the API's pairing code), start the sensor with `-e
  SENSOR_PAIRING_CODE=K7QM-4ZTD`: on
  its first start it attaches to that code. The variable is used only while
  the sensor has no identity and no `SENSOR_API_KEY`, is ignored once the
  sensor is paired, and is never logged. Or run the `pair` command once, with
  the same data volume and CA settings, before you start the daemon:

  ```bash
  docker run --rm -it \
    -e SENSOR_API_URL=https://openctem.example.com \
    -v openctem-sensor-data:/var/lib/openctem \
    ghcr.io/openctemio/sensor:{{ site.data.versions.sensor }} pair K7QM-4ZTD
  ```

- `--stop-timeout` / `stop_grace_period` give running scans time to finish on
  `docker stop`: the sensor drains for `SENSOR_DRAIN_GRACE` (default `30s`),
  then hands unfinished work back to the platform.
- The default image has no shell (it is distroless): `docker exec` into it
  does not work. Run the image's own commands instead (`docker run --rm ...
  ghcr.io/openctemio/sensor:{{ site.data.versions.sensor }} -outbox-status`), or use `docker debug`.

For a richer limit than a list of ranges (ports, tools, a kill switch), mount
a policy file instead of `SENSOR_ALLOWED_RANGES`:
`-v /etc/openctem:/etc/openctem:ro`. See
[Sensor-local policy](network.md#sensor-local-policy).

## 3. Check it

```bash
docker logs openctem-sensor 2>&1 | grep -E 'Identity:|Tool network:|Transport:|Preflight:'
```

```
  Identity: key-bound sensor 01a1... (key SHA256:...)
  Tool network: confined (each task reaches only its targets, through its forwarder)
  Transport: https (platform_without_grpc)
  Preflight: 15 passed, 0 warning(s), 0 failed (the platform shows them under the sensor's Setup & health)
```

The sensor is `online` under **Discovery > Sensors**, and its **Setup &
health** section lists no failed check. What each line means and what to do
when it differs: [Check that it works](index.md#4-check-that-it-works).

## Tool confinement

The sensor runs every scanner in a sandbox (private directory, resource
limits, Landlock, a seccomp filter). With the seccomp profile above it also
gives each scan its own network namespace whose only way out is a forwarder
that admits the job's targets and nothing else (`SENSOR_SANDBOX_NETWORK`,
default `auto`).

| Start-up line | Meaning |
|---|---|
| `Tool network: confined (...)` | Confined. Every job type runs. |
| `Warning: tool network not confined (SENSOR_SANDBOX_NETWORK=auto): network: user namespaces: ... operation not permitted` | The container runs under Docker's default seccomp profile, which refuses the namespaces. Add `--security-opt seccomp=openctem-sensor-seccomp.json`. |
| `Warning: tool network not confined ...: ... permission denied` | The host restricts unprivileged user namespaces. Keep Docker's default AppArmor profile (do not add `apparmor=unconfined`); see below. |
| `Error: executor: network confinement required but not available: ...` (exit 2) | `SENSOR_SANDBOX_NETWORK=required` and confinement is not possible. Fix the cause above, or use `auto`. |

An unconfined sensor still runs most scans, but:

- a nuclei job on a host where the organization excluded a path fails with
  `nuclei keeps to a web scope only in a tool sandbox that confines its network`;
- a job whose targets are limited to some ports or paths goes only to a
  confined sensor.

Notes:

- Ubuntu 23.10 and later restrict unprivileged user namespaces for processes
  without an AppArmor profile (`kernel.apparmor_restrict_unprivileged_userns=1`).
  Docker's default AppArmor profile allows them, so the profile above works on
  Ubuntu 24.04 unchanged. Do not run the sensor with `apparmor=unconfined`.
- `SENSOR_SANDBOX_NETWORK` takes `auto` (the default: confine when the host
  allows it, otherwise warn and run unconfined), `required` (refuse to start
  unconfined; checked before pairing) and `off`. Use `required` for a sensor
  that must never scan unconfined, as in the examples above.
- A confined sensor advertises the capability `net.confined@1`. The platform
  sends jobs that need confinement only to such sensors; without one, the
  task waits, and its **Why waiting?** panel says that it needs a sensor whose
  tool network is confined.
- The profile is Docker's default profile with one rule added (namespace
  flags for `clone` and `unshare`); the scanners themselves cannot use it. See
  the sensor's
  [`docker/seccomp/README.md`](https://github.com/openctemio/sensor/blob/main/docker/seccomp/README.md).
- Download the profile of the release you run, again at each upgrade.

## Volumes

Mount **one** volume at `/var/lib/openctem`. The sensor keeps three
directories on it and creates them on a fresh volume (`state/` and `outbox/`
`0700`, owned by the sensor's user):

| Directory | Holds | Keep it? |
|---|---|---|
| `state/` | The sensor's identity (`identity/`: its private key, client certificate and pinned CAs) and other local state | **Yes.** It is the sensor's only credential: back it up encrypted and never share it. Without it the sensor must be paired again. |
| `outbox/` | Results not yet accepted by the platform (encrypted) | **Yes.** Without it, results queued during an outage or an upgrade are lost. One sensor per outbox: a second process refuses to start. |
| `content/` | Scanner content (nuclei templates and, on per-tool images, the trivy database and semgrep rules) | Optional. A cache: it can be deleted and is downloaded again. |

The image declares no `VOLUME`: an unnamed volume is lost with the
container, and the sensor warns at start when its state or outbox is not on a
mounted volume. `SENSOR_STATE_DIR`, `SENSOR_OUTBOX_DIR` and
`SENSOR_CONTENT_DIR` move a directory elsewhere (for example the content
cache to other storage).

A **named volume** (as above) is created with the sensor's owner. A **bind
mount** of a host directory is not: `chown -R 999:999` it first (1001 on the
per-tool images, 65532 on the slim image), or the sensor stops at start with
the path, the owner and the fix. See [Run the sensor](run-the-sensor.md#a-bind-mount-instead-of-a-named-volume).

Other mounts:

| Mount | Holds | Keep it? |
|---|---|---|
| `/scan` | Repositories for code scanners (per-tool images only) | Mount read-only. Targets of code scans must resolve inside `SENSOR_SCAN_ROOTS` (default `/scan`). |
| `/etc/openctem` | The sensor-local policy and the kill switch file | Mount read-only. See [Network](network.md#sensor-local-policy). |

### Back up

Back up the whole volume, or leave out the cache:

```bash
docker run --rm -v openctem-sensor-data:/data:ro -v "$PWD":/backup alpine \
  tar -C /data --exclude=./content -czf /backup/openctem-sensor-data.tgz .
```

The archive holds the sensor's private key: store it encrypted. Restoring
it, and when to do so, is in [Back up and restore](operate.md#back-up-and-restore).

### Move from three volumes to one

Sensors installed with a volume on each of `/var/lib/openctem/state`,
`/var/lib/openctem/outbox` and `/var/lib/openctem/content` keep working
unchanged. To move one to a single volume (sensor v0.16.0 or later; an older
image puts unnamed volumes on `outbox/` and `content/` on top of it):

```bash
docker stop openctem-sensor                 # or: docker compose stop sensor
docker volume create openctem-sensor-data
for d in state outbox content; do
  docker run --rm -v openctem-$d:/from:ro -v openctem-sensor-data:/to alpine \
    sh -c "mkdir -p /to/$d && cp -a /from/. /to/$d/"
done
docker run --rm -v openctem-sensor-data:/to alpine \
  sh -c 'chown "$(stat -c %u:%g /to/state)" /to'
```

Then replace the three mounts with `-v openctem-sensor-data:/var/lib/openctem`
(Compose: `- openctem-sensor-data:/var/lib/openctem` with
`volumes: {openctem-sensor-data: {external: true}}`; Compose prefixes the
names of volumes it created with the project name, see
`docker volume ls`), recreate the container and check its log: the same
`transport:` line, no new pairing code, and the same sensor online under
**Discovery > Sensors**. Remove the old volumes only after that. Copying
`content` is optional: it is downloaded again.

## Trust a private certificate authority

A platform in TLS mode `internal` (or with a certificate from your own CA)
needs its root on the sensor. The simplest way is the pin the console's
install command already carries: when the platform's administrator has set
`PLATFORM_CA_CERT_FILE`, every command in **Sensors > Add sensor** passes the
root's SHA-256 as `SENSOR_CA_SHA256`, and the sensor fetches the CA from the
platform and trusts only that root. The console shows the root's name and
SHA-256 and offers the file for download. Setup, security and rotation:
[Sensors behind a private CA](https://github.com/openctemio/openctem/blob/develop/api/docs/how-to/sensors-behind-a-private-ca.md).

The images run as a non-root user and cannot run `update-ca-certificates`.
Use one of:

| Method | Example |
|---|---|
| Pin the root by SHA-256 (the console's command does it; the sensor fetches the CA from the platform) | `-e SENSOR_CA_SHA256=<root sha256>`; several roots while one is rotated: `<old>,<new>` |
| `SENSOR_CA_CERT_FILE` (platform and content downloads) | `-v /path/ca.pem:/certs/openctem-ca.pem:ro -e SENSOR_CA_CERT_FILE=/certs/openctem-ca.pem` |
| Mount it into the system directory (also trusted by the scanners) | `-v /path/ca.pem:/etc/ssl/certs/openctem-ca.pem:ro` |
| `SSL_CERT_DIR` | `-v /path/ca.pem:/certs/openctem-ca.pem:ro -e SSL_CERT_DIR=/certs` |
| `SSL_CERT_FILE` | `-v /path/ca.pem:/certs/openctem-ca.pem:ro -e SSL_CERT_FILE=/certs/openctem-ca.pem` |
| Pin a CA by fingerprint | `-e SENSOR_CA_FINGERPRINT=<sha256>`, with `SENSOR_API_URL` naming the host name in the certificate, not an IP address. Only for a CA certificate the platform **sends** in its chain; see below. |

Mounting into `/usr/local/share/ca-certificates/` does not work. To compute
the fingerprint of a CA file:

```bash
openssl x509 -in ca.pem -noout -fingerprint -sha256 | cut -d= -f2
```

Pairing also pins the platform's TLS identity: from then on the sensor refuses
a platform certificate from another CA, with no fallback to the system trust
store. After a deliberate change of the platform's CA, pair the sensor again
or set `SENSOR_CA_FINGERPRINT` to the new CA.

{: .warning }
`SENSOR_CA_FINGERPRINT` matches only a certificate the platform presents in
its TLS chain. The built-in gateway in TLS mode `internal` presents its leaf
and its intermediate, not its root, so a pin of the root
(`ca/openctem-root-ca.crt`, also the fingerprint the console shows) fails with
`the platform's certificate chain does not contain the pinned CA`, and the
intermediate is replaced every week. With that gateway, trust the root with
`SENSOR_CA_CERT_FILE` instead: pairing then pins it for every later
connection. Use `SENSOR_CA_FINGERPRINT` with a platform whose chain includes
the CA you pin.

None of this affects gRPC: the sensor trusts only the platform's sensor CA
for it, which it receives over the pinned HTTPS connection.

## Common settings

| Variable | Default | Meaning |
|---|---|---|
| `SENSOR_API_URL` | none (required) | The platform URL. Must reach the API directly; the sensor refuses redirects. |
| `SENSOR_ALLOWED_RANGES` | none | What the sensor may scan (a shorthand local policy). |
| `SENSOR_ALLOW_PRIVATE_TARGETS` | off | `1` allows RFC 1918 and IPv6 ULA targets. Only `1` or `0` is accepted. Loopback, link-local, cloud metadata and CGNAT addresses stay blocked. |
| `SENSOR_NAME` | `sensor-<hostname>` | Name the sensor proposes; the approver may change it. |
| `SENSOR_PAIRING_CODE` | none | The code (`XXXX-XXXX`) of the Add sensor command to attach to on first start. Ignored once paired. |
| `SENSOR_SANDBOX_NETWORK` | `auto` | `required` refuses to start without network confinement; `off` turns it off. |
| `SENSOR_TOOLS` | every detected tool | Deprecated. In the daemon it only narrows the detected tools; use the local policy's `tools.allow`. |
| `SENSOR_NUCLEI_MAX_RATE_LIMIT`, `SENSOR_NUCLEI_MAX_CONCURRENCY`, `SENSOR_NUCLEI_MAX_BULK_SIZE` | nuclei's defaults (150, 25, 25) | The host operator's ceilings for nuclei. [Tool settings](tool-settings.md) cannot go above them. |
| `SENSOR_MAX_JOBS` | sized from CPU, memory and tool cost | Cap on jobs run at once, 1 to 100. |
| `SENSOR_TRANSPORT` | `auto` | Leave it. `https` for a [TLS-inspecting proxy](network.md#tls-inspecting-proxies). |
| `HTTPS_PROXY`, `SENSOR_CONTROL_PROXY` | none | A proxy to the platform. See [Proxies](network.md#proxies). |

Every setting is in the [settings reference](settings.md).

## Upgrade

Pull the new tag, download the seccomp profile of that release, and recreate
the container with the same volume. The identity, the outbox and the content
cache carry over. Read the release notes first: v0.17.0, for example, stops a
sensor that still sets an old variable name. Steps, rollback and removal:
[Upgrade, back up and remove](operate.md).

## Run one scan without the platform

Arguments after the image replace the default command, so the same image can
run a single scan and print the results:

```bash
docker run --rm ghcr.io/openctemio/sensor:{{ site.data.versions.sensor }} \
  -standalone -tool nuclei -target https://app.example.com
```
