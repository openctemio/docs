---
title: Sensors
nav_order: 9
has_children: true
permalink: /sensors/
---

# Sensors
{: .no_toc }

A **sensor** runs in your network, connects out to the platform, and runs the
scans that touch your systems. The platform never connects to a sensor and
never sends packets to your targets itself. A sensor needs outbound HTTPS to
the platform and no inbound port.

The sensor is [`openctemio/sensor`](https://github.com/openctemio/sensor)
(image `ghcr.io/openctemio/sensor`, binary `openctemio-sensor`). How it works
inside is described in [How sensors work](how-it-works.md).

## Which one do I need?

| You want to | Use | Runs where | Start here |
|---|---|---|---|
| Scan hosts, web applications and networks the platform cannot reach (ports, HTTP, nuclei templates, subdomains) | **Sensor** (`openctemio/sensor`) | A host or cluster inside the network to scan | [Quickstart](#quickstart-a-working-sensor-in-five-minutes) |
| Bring in a Tenable Security Center you run (its findings, and scans launched from OpenCTEM) | **Tenable.sc connector** (`openctemio/connector-tenable`) | A host or cluster that can reach your Tenable.sc | [Tenable.sc connector](connector-tenable.md) |
| Scan code and dependencies in a pipeline | **CI integration** (no sensor) | GitHub Actions or GitLab CI | [CI integration](../scanning/ci-integration.md) |
| Match your software inventory against known vulnerabilities | **Vulnerability feed** (`openctemio/vulnfeed`) | Nothing to install: the platform imports signed bundles | [Vulnerability and program feeds](../operations/feeds.md) |
| Follow public bug-bounty and disclosure programs | **Program feed** (`openctemio/programfeed`) | Nothing to install: the platform imports signed bundles | [Vulnerability and program feeds](../operations/feeds.md) |

A sensor connects out to the platform, needs no inbound port and appears
under **Discovery > Sensors**. The feeds are not installed on your hosts at
all.

1. TOC
{:toc}

---

## Quickstart: a working sensor in five minutes

This quick start is written for platform v0.9.5 or later with sensor v0.22.1. It
installs a hardened, confined sensor, pairs it, checks it and runs a first
scan. The sensor needs no mode or tool flags: it runs as the daemon that takes
the platform's commands and enables every tool in the image that works.

### What you need

- A Linux host with Docker, inside the network you want to scan, that can
  reach the platform on TCP 443.
- The platform URL: the address you open the console with, for example
  `https://openctem.example.com` (or `https://203.0.113.10`). Check it from
  the sensor host:

  ```bash
  curl -fsS https://openctem.example.com/health
  ```

  If `curl` reports an unknown certificate authority, the platform uses its
  own CA (TLS mode `internal`, the default for IP addresses and LANs). Copy
  `ca/openctem-root-ca.crt` from the platform host to the sensor host and
  repeat with `--cacert openctem-root-ca.crt`.
- An account with the **Pair sensors** and **Approve sensors** permissions
  (owners and administrators have both), and the **Widen sensor grants**
  permission to promote the sensor afterwards.
- The address ranges or domains this sensor may scan.

### 1. Start the sensor

Download the sensor's seccomp profile for the release you run, then start the
container:

```bash
curl -fsSLo openctem-sensor-seccomp.json \
  https://raw.githubusercontent.com/openctemio/sensor/v0.22.1/docker/seccomp/sensor.json

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
  ghcr.io/openctemio/sensor:v0.22.1
```

Change three things:

- `SENSOR_API_URL`: your platform URL, without a path.
- `SENSOR_ALLOWED_RANGES`: what this sensor may scan (CIDRs, addresses,
  `example.com`, `*.example.com`). The sensor refuses every job outside it,
  whatever the platform sends. **A newly paired sensor without such a list
  (or a [policy file](network.md#sensor-local-policy)) refuses every job
  that has network targets.**
- To scan private addresses (RFC 1918, IPv6 ULA), list them and add
  `-e SENSOR_ALLOW_PRIVATE_TARGETS=1`.

If an administrator already created a code with **Expect a sensor**, add
`-e SENSOR_PAIRING_CODE=XXXX-XXXX` (that code): the sensor attaches to it on
first start and you skip step 2. The variable is ignored once the sensor is
paired and is never logged.

If the platform uses its own CA, add these two lines before the image name:

```bash
  -v "$PWD/openctem-root-ca.crt:/certs/openctem-ca.pem:ro" \
  -e SENSOR_CA_CERT_FILE=/certs/openctem-ca.pem \
```

What the other flags do:

- `--security-opt seccomp=...` lets the sensor give every scan its own
  network namespace, so a scanner reaches only the job's targets
  ([Tool confinement](security.md#tool-confinement)). nuclei scans of a host
  with an excluded path run **only** on a confined sensor.
  `SENSOR_SANDBOX_NETWORK=required` makes the sensor refuse to start when it
  cannot confine its tools. The default, `auto`, confines them when the host
  allows it and otherwise runs them unconfined with
  `Warning: tool network not confined`.
- `--dns-search .` makes the tools look target names up exactly as written,
  never with the host's search domain appended. Recommended, not required.
- `--read-only`, `--tmpfs /tmp`, `--cap-drop ALL` and `no-new-privileges`
  are the least-privilege settings the platform's own install snippet uses.
  Add `--cap-add NET_RAW` only for naabu SYN scans.
- `--stop-timeout 45` gives running scans time to finish on `docker stop`.

{: .warning }
Keep the `openctem-sensor-data` volume. After pairing its `state/` directory
holds the sensor's private key, its only credential. Back it up like a
password and never mount it into a second sensor
([Back up and restore](operate.md#back-up-and-restore)).

### 2. Read the pairing code

```bash
docker logs openctem-sensor
```

```
Pair this sensor in OpenCTEM: Sensors > Pair a sensor
  Code:        K7QM-4ZTD
  Fingerprint: 821 · melon · basil · bagel    (expires 10:42)
  Key:         SHA256:...
Approve it only if the console shows the same fingerprint. Waiting for approval...
```

A code is valid for 10 minutes; the sensor starts a new one when it expires.

### 3. Approve it in the console

1. Open **Discovery > Sensors > Pair a sensor**, tab **Enter code**, and type
   the code.
2. Compare the fingerprint word for word with the sensor's log. If it
   differs, deny the request.
3. Pick the scan zones and **What it may do** (the default, *Internal network
   scanner*, fits most sensors), tick the fingerprint confirmation,
   re-authenticate and **Approve**.

![The Pair a sensor dialog showing the fingerprint, host facts and grant choices of a pairing request]({{ site.baseurl }}/assets/images/sensors/pair-dialog.png)
*Figure: Approving a pairing request.*

Details and the other way round (the console makes the code first) are in
[Pairing](pairing.md).

### 4. Check that it works

Within a few seconds the log shows the sensor's identity and, among the
start-up lines:

```
Paired: sensor "sensor-scan01" (...) in organization .... Identity saved in /var/lib/openctem/state/identity.
  Identity: key-bound sensor ... (key SHA256:...)
  Local policy: enforced from SENSOR_ALLOWED_RANGES/SENSOR_ALLOWED_PORTS (sha256:...): targets allow 2, ...
  Tool network: confined (each task reaches only its targets, through its forwarder)
  Transport: https (platform_without_grpc)
  Preflight: 15 passed, 0 warning(s), 0 failed (the platform shows them under the sensor's Setup & health)
```

Check three things:

| Look for | Good | If not |
|---|---|---|
| `Tool network:` | `confined` | `Warning: tool network not confined`: the seccomp profile is missing or the host blocks user namespaces. See [Tool confinement](security.md#tool-confinement). |
| `Preflight:` | `0 failed` | Open the sensor's **Setup & health** in the console; each problem has its fix ([Setup check reference](troubleshooting.md#setup-check-reference)). |
| `Transport:` | `grpc`, `https` or `v2` | An error after `Transport:`: see [Troubleshooting](troubleshooting.md#transport). |

In the console, **Discovery > Sensors** lists it as `online`. Its detail
sheet shows **Transport:** and, when it is not gRPC, the reason in plain words
(hover it for the reason code):

| `Transport:` line in the log | In the console | Meaning |
|---|---|---|
| `grpc` | gRPC, mutual TLS | Best case: gRPC with mutual TLS, jobs pushed at once. |
| `https (platform_without_grpc)` | HTTPS | Working. The platform offers only HTTPS; see [Choose your setup](#choose-your-setup) to get gRPC. |
| `https (<other reason>)` | HTTPS | Working. Something between the sensor and the platform blocks gRPC; the sensor tries it again later. |
| `v2 (platform_without_v3)` | Protocol v2 | Working. The platform does not serve protocol v3. |
| `Transport: ...` followed by an error | | Not working. Look the reason up in [Troubleshooting](troubleshooting.md#transport). |

All three transports run every scan; gRPC only delivers jobs faster. Platform
admins see which transport the platform offers, and why gRPC is not offered,
on Console > Operations ([What the platform offers](transport.md#what-the-platform-offers)).

### 5. Let it run active scans

A new sensor is at trust level **New**: it receives passive work only
(subdomain discovery, DNS resolution, code and image analysis), no port
scans, HTTP probes or templates. Open the sensor, review its **Grant**, and
choose **Promote to Trusted**. See [Grants and trust](pairing.md#grants-and-trust).

### 6. Run a first scan

1. Put a target in scope: **Scoping > Scope**, add the domain or range (for
   example `app.example.com`). A scope entry allows a full scan; an asset no
   entry covers gets at most low-impact checks. See
   [Scope](../scanning/scope.md).
2. **Discovery > Scans > New scan**, target `app.example.com`, workflow
   **Discover**, then **Run now**.
3. The run's **Tasks** tab shows the task on your sensor; the sensor's log
   shows `Executing command ...` and `Command ... completed`. Results appear
   on the asset within a minute.

A task that does not start says why on the run: open **Why waiting?** on the
task (another task is scanning its hosts, no sensor has the tool, the sensor
is New, the target is outside its local policy or zone, the task needs a
confined sensor). See [Why is a task waiting?](../scanning/why-waiting.md) and
[Online, but it gets no work](troubleshooting.md#online-but-it-gets-no-work).

Next: [route work to it with scan zones](zones.md), and read
[Before production](#before-production).

## Choose your setup

The sensor picks its transport by itself: gRPC with mutual TLS when the
platform offers it and the network allows it, otherwise HTTPS, otherwise
protocol v2. Every setup below needs **only port 443** on the platform;
nothing is configured on the sensor.

| Platform setup | The sensor ends up on | What you configure | Details |
|---|---|---|---|
| One host with the built-in gateway (Docker Compose), reached by an IP address or one host name | **gRPC** on 443 (sensor v0.15.0 or later); HTTPS for older sensors | Start Compose with the override `docker-compose.sensor-passthrough.yml` | [Transport: gRPC on port 443](transport.md#grpc-on-port-443-docker-compose) |
| The same, plus a dedicated sensor host name (for example `sensors.example.com`) | **gRPC** on 443 for every sensor from v0.12.0 | The override in `passthrough` mode, a DNS name and two variables | [Dedicated sensor host name](transport.md#a-dedicated-sensor-host-name) |
| One host with the built-in gateway, without the override; or the all-in-one image | **HTTPS** | Nothing | [TLS and the gateway](../install/tls-and-gateway.md) |
| Web console and API behind your own TLS-terminating proxy (gateway in mode `http`, nginx, HAProxy) | **HTTPS** | Nothing; the proxy must not buffer responses (see the [nginx example](../install/tls-and-gateway.md#http-behind-your-own-tls-proxy)) | [Transport](transport.md#what-the-platform-offers) |
| A TCP (layer 4) load balancer or nginx `stream` / HAProxy `mode tcp` in front of the built-in gateway | **gRPC** on 443, as in the first row | The override; the balancer passes TCP through without terminating TLS | [Transport](transport.md#grpc-on-port-443-docker-compose) |
| A load balancer that only terminates TLS (layer 7) | **HTTPS** | Response buffering off, idle timeout above 30 seconds | [Transport](transport.md#what-the-platform-offers) |
| Kubernetes behind an ingress | **HTTPS** | Nothing | [Kubernetes](deploy-kubernetes.md#transport-on-kubernetes) |
| Sensor behind a corporate HTTP proxy | gRPC through `CONNECT` when the proxy allows HTTP/2, otherwise **HTTPS** | `HTTPS_PROXY` or `SENSOR_CONTROL_PROXY` on the sensor | [Proxies](network.md#proxies) |
| Sensor behind a TLS-inspecting proxy | **HTTPS** | `SENSOR_TRANSPORT=https` and the proxy's CA, or exempt the platform host from inspection | [Proxies](network.md#tls-inspecting-proxies) |

{: .note }
Single-port gRPC in the API itself, without the built-in gateway in front, is
**coming**. Until then a setup without the gateway uses HTTPS, or gRPC on a
[port of its own](transport.md#a-port-of-its-own) if you choose to open one.

gRPC on the platform's own port requires **sensor v0.15.0 or later** (sdk-go
v0.21.0 or later): it offers the routing id the gateway looks for.
Sensors v0.12.0 to v0.14.0 reach gRPC only through a dedicated sensor host
name or a port of its own, and use HTTPS otherwise.

## Install

| Method | Use it for |
|---|---|
| [Docker and Compose](deploy-docker.md) | Most installs. The image pins every scanner. |
| [Kubernetes](deploy-kubernetes.md) | A sensor in a cluster, paired like a Docker sensor, or the chart's bundled sensor. |
| [Binary](deploy-binary.md) | Hosts without containers; you install the scanners. |

Then: [Tool settings](tool-settings.md), [Scanner content and content packs](content-delivery.md), [Upgrade, back up and remove](operate.md), [Security notes](security.md)
and [Troubleshooting](troubleshooting.md).

## Before production

- **Run it confined.** Start the container with the sensor's seccomp profile
  and check that the log says `Tool network: confined`
  ([Tool confinement](security.md#tool-confinement)).
- **Back up the data volume** (`/var/lib/openctem`; the `content/` cache can be
  left out, see [Back up and restore](operate.md#back-up-and-restore)). After
  pairing its `state/` directory holds the sensor's private key, the only
  credential the sensor has. Keep the backup encrypted, restore it only to a
  host that replaces the sensor, and never run two sensors from one copy: the
  platform flags the sensor `identity_cloned`. See
  [Where the identity lives](pairing.md#where-the-identity-lives).
- **Back up the platform's CAs.** The `api-data` volume holds the sensor CA
  (`/app/data/sensor-ca`) that signs the gRPC certificates; the `gateway-data`
  volume holds the gateway's CA in TLS mode `internal`. See
  [Platform side](transport.md#platform-side-the-sensor-ca).
- **Install a local policy.** The network owner limits what the sensor may
  scan with a read-only file or `SENSOR_ALLOWED_RANGES`; the platform cannot
  change it. See [Sensor-local policy](network.md#sensor-local-policy).
- **Know how to revoke.** Revoking the sensor or its key takes effect at the
  sensor's next request (open gRPC streams end within seconds), and the
  sensor never falls back to a weaker transport. To replace a lost or stolen
  key, [re-pair](pairing.md#re-pair-a-sensor).
- **Pin the image version** and verify its signature
  ([Verify the image](deploy-docker.md#1-pick-an-image)).
