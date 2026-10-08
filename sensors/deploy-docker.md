---
title: Deploy with Docker
parent: Sensors
nav_order: 1
---

# Deploy a sensor with Docker

This runs the sensor as a long-running daemon that executes the scans the
platform dispatches to it. It needs outbound HTTPS to the platform and no
inbound port.

## Before you start

- Docker on a Linux host in the network you want to scan. Linux 5.13 or
  later lets the tool sandbox use Landlock; older kernels work with a warning.
- The platform URL, for example `https://openctem.example.com`. With the
  built-in gateway this is the same address you open in the browser; see
  [Network requirements](network.md#the-platform-url).
- Someone with the **Pair sensors** and **Approve sensors** permissions to
  approve the sensor (owners and administrators have both).

## 1. Pick an image

Use a released version, never `latest` in production:

```bash
docker pull ghcr.io/openctemio/sensor:v0.11.0
```

The default image runs nuclei and the recon tools (subfinder, dnsx, naabu,
httpx, katana). For code scanning on a daemon, use a per-tool image such as
`ghcr.io/openctemio/sensor:v0.11.0-semgrep`. See
[What runs inside](index.md#what-runs-inside).

Release images are signed with cosign (keyless). Verify before you run:

```bash
cosign verify ghcr.io/openctemio/sensor:v0.11.0 \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity https://github.com/openctemio/sensor/.github/workflows/docker-publish.yml@refs/tags/v0.11.0
```

## 2. Start the sensor

```bash
docker run -d --name openctem-sensor --restart unless-stopped \
  -e API_URL=https://openctem.example.com \
  -v openctem-outbox:/var/lib/openctem/outbox \
  -v openctem-state:/var/lib/openctem/state \
  -v openctem-content:/var/lib/openctem/content \
  ghcr.io/openctemio/sensor:v0.11.0
```

The image's default command is `-daemon -enable-commands -verbose`. Without
`API_URL` the container exits with code 2 and names the missing variable.

Started without `API_KEY`, the sensor **pairs**: it creates its own key and
prints a code and a fingerprint. Read them with `docker logs openctem-sensor`
and approve the sensor as described in [Pairing](pairing.md). The sensor then
signs every request with its key.

## Volumes

| Mount | Holds | Keep it? |
|---|---|---|
| `/var/lib/openctem/state` | The sensor's identity (`identity/`: its private key) and other local state | **Yes.** Back it up like a credential. Without it the sensor must be paired again. The image does not declare it a volume, so an unnamed mount is lost with the container. |
| `/var/lib/openctem/outbox` | Results not yet accepted by the platform (encrypted) | **Yes.** Without it, results queued during an outage or an upgrade are lost. One sensor per outbox: a second process refuses to start. |
| `/var/lib/openctem/content` | Scanner content (nuclei templates and, on per-tool images, the trivy database and semgrep rules) | Optional. A cache: it can be deleted and is downloaded again. |
| `/scan` | Repositories for code scanners (per-tool images only) | Mount read-only. Targets of code scans must resolve inside `SENSOR_SCAN_ROOTS` (default `/scan`). |
| `/etc/openctem` | The sensor-local policy and the kill switch file | Mount read-only. See [Network](network.md#sensor-local-policy). |

## Docker Compose

```yaml
services:
  sensor:
    image: ghcr.io/openctemio/sensor:v0.11.0
    container_name: openctem-sensor
    restart: unless-stopped
    environment:
      API_URL: https://openctem.example.com
      # SENSOR_CA_FINGERPRINT: "<SHA-256 of the platform CA>"  # private CA only
      # SENSOR_ALLOW_PRIVATE_TARGETS: "1"   # to scan RFC 1918 / ULA addresses
      # SENSOR_LOCAL_POLICY: /etc/openctem/sensor-policy.yaml
    volumes:
      - state:/var/lib/openctem/state       # identity: keep it
      - outbox:/var/lib/openctem/outbox     # undelivered results: keep it
      - content:/var/lib/openctem/content   # scanner content cache
      # - /etc/openctem:/etc/openctem:ro    # local policy and kill switch
    stop_grace_period: 45s
volumes:
  state:
  outbox:
  content:
```

`stop_grace_period` gives running scans time to finish on `docker stop`: the
sensor drains for `SENSOR_DRAIN_GRACE` (default 30s), then hands unfinished
work back to the platform. Allow that plus about 15 seconds.

## Common settings

| Variable | Default | Meaning |
|---|---|---|
| `API_URL` | none (required) | The platform URL. Must reach the API directly; the sensor refuses redirects. |
| `API_KEY` | none | A legacy sensor key (`octs_…`). Leave unset to pair. See [Bearer keys](pairing.md#bearer-keys-legacy). |
| `SENSOR_NAME` | generated | Name the sensor proposes; the approver may change it. |
| `SENSOR_TOOLS` | every installed tool | Comma-separated allowlist of scanners to run and report. |
| `SENSOR_ALLOW_PRIVATE_TARGETS` | off | `1` allows RFC 1918 and IPv6 ULA targets. Only `1` or `0` is accepted. Loopback, link-local, cloud metadata and CGNAT addresses stay blocked. |
| `SENSOR_SCAN_ROOTS` | `/scan` (the working directory) | `:`-separated directories that code-scan targets must resolve inside. |
| `SENSOR_LOCAL_POLICY` | `/etc/openctem/sensor-policy.yaml` if it exists | The sensor-local policy file. A policy that does not load stops the sensor. |
| `SENSOR_MAX_JOBS` | sized from CPU, memory and tool cost | Cap on jobs run at once, 1-100. |
| `SENSOR_DRAIN_GRACE` | `30s` | How long running scans may finish on SIGTERM. |
| `SENSOR_SANDBOX` | `auto` | `required` refuses to start unless every sandbox control is enforced; `off` runs tools as plain child processes. |
| `SENSOR_STATE_DIR` | `/var/lib/openctem/state` | State directory (identity, renewed key, tool cost history). |
| `SENSOR_OUTBOX_DIR`, `SENSOR_OUTBOX_MAX_BYTES`, `SENSOR_OUTBOX_MAX_AGE` | `/var/lib/openctem/outbox`, `1GiB`, `168h` | Outbox location and caps; past a cap the oldest results are dropped with a warning. |
| `SENSOR_CA_FINGERPRINT` | none | SHA-256 of the platform's CA certificate (64 hex digits, colons allowed). Only that CA is trusted for platform requests. |
| `SENSOR_CA_CERT_FILE` | none | A CA file trusted for the platform and for content downloads (private CA, TLS-inspecting proxy). |
| `SENSOR_DNS_RESOLVERS` | `/etc/resolv.conf` | Resolvers dnsx, naabu and subfinder use. The tools' built-in public resolver lists are never used. |
| `SENSOR_NUCLEI_MAX_RATE_LIMIT`, `_MAX_CONCURRENCY`, `_MAX_BULK_SIZE` | `150`, `25`, `25` | Ceilings for nuclei; a scan may ask for less, never more. |

Proxy settings are in [Network requirements](network.md#proxies). The full
list, including scanner content mirrors for air-gapped hosts, is in the
[sensor README](https://github.com/openctemio/sensor/blob/main/README.md).

## Trust a private certificate authority

The images run as a non-root user and cannot run `update-ca-certificates`.
Use one of:

| Method | Example |
|---|---|
| Pin the CA (recommended for pairing) | `-e SENSOR_CA_FINGERPRINT=<sha256>` and `API_URL` with the host name in the certificate, not an IP address |
| Mount it into the system directory | `-v /path/ca.pem:/etc/ssl/certs/openctem-ca.pem:ro` |
| `SSL_CERT_DIR` | `-v /path/ca.pem:/certs/openctem-ca.pem:ro -e SSL_CERT_DIR=/certs` |
| `SSL_CERT_FILE` | `-v /path/ca.pem:/certs/openctem-ca.pem:ro -e SSL_CERT_FILE=/certs/openctem-ca.pem` |
| `SENSOR_CA_CERT_FILE` | `-v /path/ca.pem:/certs/openctem-ca.pem:ro -e SENSOR_CA_CERT_FILE=/certs/openctem-ca.pem` |

Mounting into `/usr/local/share/ca-certificates/` does not work. To compute
the fingerprint of a CA file:

```bash
openssl x509 -in ca.pem -noout -fingerprint -sha256 | cut -d= -f2
```

## Upgrade

Pull the new tag and recreate the container with the same volumes. The
identity, the outbox and the content cache carry over. A sensor older than
v0.9.0 cannot talk to the current platform (protocol v1 is retired) and must
be upgraded.

## Run one scan without the platform

Arguments after the image replace the default command, so the same image can
run a single scan and print the results:

```bash
docker run --rm ghcr.io/openctemio/sensor:v0.11.0 \
  -standalone -tool nuclei -target https://app.example.com
```
