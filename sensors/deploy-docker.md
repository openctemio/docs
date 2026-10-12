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
is the reference behind it.

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
docker pull ghcr.io/openctemio/sensor:v0.17.0
```

The default image runs nuclei and the recon tools (subfinder, dnsx, naabu,
httpx, katana). For code scanning on a daemon, use a per-tool image such as
`ghcr.io/openctemio/sensor:v0.17.0-semgrep`. See
[What runs inside](how-it-works.md#what-runs-inside).

Release images are signed with cosign (keyless). Verify before you run:

```bash
cosign verify ghcr.io/openctemio/sensor:v0.17.0 \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity https://github.com/openctemio/sensor/.github/workflows/docker-publish.yml@refs/tags/v0.17.0
```

## 2. Start it

With `docker run`:

```bash
docker run -d --name openctem-sensor --restart unless-stopped \
  --stop-timeout 45 \
  -e SENSOR_API_URL=https://openctem.example.com \
  -e SENSOR_ALLOWED_RANGES='203.0.113.0/24,*.example.com' \
  -v openctem-sensor-data:/var/lib/openctem \
  ghcr.io/openctemio/sensor:v0.17.0
```

Or with Docker Compose (`compose.yaml`, then `docker compose up -d`):

```yaml
services:
  sensor:
    image: ghcr.io/openctemio/sensor:v0.17.0
    container_name: openctem-sensor
    restart: unless-stopped
    environment:
      SENSOR_API_URL: https://openctem.example.com
      # What this sensor may scan. Without it (or a policy file) a newly
      # paired sensor refuses every job with network targets.
      SENSOR_ALLOWED_RANGES: "203.0.113.0/24,*.example.com"
      # SENSOR_ALLOW_PRIVATE_TARGETS: "1"           # to scan RFC 1918 / ULA ranges
      # SENSOR_CA_CERT_FILE: /certs/openctem-ca.pem # platform with its own CA
    volumes:
      # state/ (the sensor's key), outbox/ (undelivered results) and
      # content/ (scanner cache): keep it and back it up
      - data:/var/lib/openctem
      # - ./openctem-root-ca.crt:/certs/openctem-ca.pem:ro
    stop_grace_period: 45s
volumes:
  data:
```

- The image's default command is `-daemon -enable-commands -verbose`. Without
  `SENSOR_API_URL` the container exits with code 2 and names the missing variable.
- Without `SENSOR_API_KEY` the sensor **pairs** on its first start: read the code
  with `docker logs openctem-sensor` and approve it as described in
  [Pairing](pairing.md).
- To prepare the console first instead, create a code with **Expect a
  sensor** and run the `pair` command once, with the same data volume and CA
  settings, before you start the daemon:

  ```bash
  docker run --rm -it \
    -e SENSOR_API_URL=https://openctem.example.com \
    -v openctem-sensor-data:/var/lib/openctem \
    ghcr.io/openctemio/sensor:v0.17.0 pair K7QM-4ZTD
  ```

- `--stop-timeout` / `stop_grace_period` give running scans time to finish on
  `docker stop`: the sensor drains for `SENSOR_DRAIN_GRACE` (default `30s`),
  then hands unfinished work back to the platform.

For a richer limit than a list of ranges (ports, tools, a kill switch), mount
a policy file instead of `SENSOR_ALLOWED_RANGES`:
`-v /etc/openctem:/etc/openctem:ro`. See
[Sensor-local policy](network.md#sensor-local-policy).

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

The archive holds the sensor's private key: store it encrypted.

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
**Settings → Sensors**. Remove the old volumes only after that. Copying
`content` is optional: it is downloaded again.

## Trust a private certificate authority

A platform in TLS mode `internal` (or with a certificate from your own CA)
needs its root on the sensor. The images run as a non-root user and cannot
run `update-ca-certificates`. Use one of:

| Method | Example |
|---|---|
| `SENSOR_CA_CERT_FILE` (platform and content downloads) | `-v /path/ca.pem:/certs/openctem-ca.pem:ro -e SENSOR_CA_CERT_FILE=/certs/openctem-ca.pem` |
| Mount it into the system directory (also trusted by the scanners) | `-v /path/ca.pem:/etc/ssl/certs/openctem-ca.pem:ro` |
| `SSL_CERT_DIR` | `-v /path/ca.pem:/certs/openctem-ca.pem:ro -e SSL_CERT_DIR=/certs` |
| `SSL_CERT_FILE` | `-v /path/ca.pem:/certs/openctem-ca.pem:ro -e SSL_CERT_FILE=/certs/openctem-ca.pem` |
| Pin the CA by fingerprint | `-e SENSOR_CA_FINGERPRINT=<sha256>`, with `SENSOR_API_URL` naming the host name in the certificate, not an IP address |

Mounting into `/usr/local/share/ca-certificates/` does not work. To compute
the fingerprint of a CA file:

```bash
openssl x509 -in ca.pem -noout -fingerprint -sha256 | cut -d= -f2
```

Pairing also pins the platform's TLS identity: from then on the sensor refuses
a platform certificate from another CA, with no fallback to the system trust
store. After a deliberate change of the platform's CA, pair the sensor again
or set `SENSOR_CA_FINGERPRINT` to the new CA.

None of this affects gRPC: the sensor trusts only the platform's sensor CA
for it, which it receives over the pinned HTTPS connection.

## Common settings

| Variable | Default | Meaning |
|---|---|---|
| `SENSOR_API_URL` | none (required) | The platform URL. Must reach the API directly; the sensor refuses redirects. |
| `SENSOR_ALLOWED_RANGES` | none | What the sensor may scan (a shorthand local policy). |
| `SENSOR_ALLOW_PRIVATE_TARGETS` | off | `1` allows RFC 1918 and IPv6 ULA targets. Only `1` or `0` is accepted. Loopback, link-local, cloud metadata and CGNAT addresses stay blocked. |
| `SENSOR_NAME` | `sensor-<hostname>` | Name the sensor proposes; the approver may change it. |
| `SENSOR_TOOLS` | every installed tool | Comma-separated allowlist of scanners to run and report. |
| `SENSOR_MAX_JOBS` | sized from CPU, memory and tool cost | Cap on jobs run at once, 1 to 100. |
| `SENSOR_TRANSPORT` | `auto` | Leave it. `https` for a [TLS-inspecting proxy](network.md#tls-inspecting-proxies). |
| `HTTPS_PROXY`, `SENSOR_CONTROL_PROXY` | none | A proxy to the platform. See [Proxies](network.md#proxies). |

Every setting is in the [settings reference](settings.md).

## Upgrade

Pull the new tag and recreate the container with the same volumes. The
identity, the outbox and the content cache carry over:

```bash
docker pull ghcr.io/openctemio/sensor:<new version>
docker rm -f openctem-sensor
# run the same docker run command with the new tag, or: docker compose up -d
```

A sensor older than v0.9.0 cannot talk to the current platform (protocol v1 is
retired) and must be upgraded.

## Run one scan without the platform

Arguments after the image replace the default command, so the same image can
run a single scan and print the results:

```bash
docker run --rm ghcr.io/openctemio/sensor:v0.17.0 \
  -standalone -tool nuclei -target https://app.example.com
```
