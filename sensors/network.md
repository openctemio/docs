---
title: Network requirements and egress
parent: Sensors
nav_order: 6
---

# Network requirements and egress

A sensor only makes outbound connections. It needs no inbound port, no VPN
and no route from the platform into your network.

| Traffic | From the sensor to | Needed for |
|---|---|---|
| Control | The platform URL on TCP 443 (HTTPS; gRPC on the same port when the platform offers it, or the [dedicated sensor host name or port](transport.md#a-dedicated-sensor-host-name) if one is set up) | Pairing, heartbeats, jobs, results |
| Content | `github.com` and `api.github.com` (nuclei templates); `mirror.gcr.io` and `ghcr.io` (trivy database, per-tool trivy image); `github.com`, `api.github.com` and `release-assets.githubusercontent.com` (the OpenCTEM SAST rules pack); `semgrep.dev` (registry rule sets, only when configured) | Keeping scanner content current. Optional: mirrors and local files work, see below |
| DNS | The resolvers in `/etc/resolv.conf`, or `SENSOR_DNS_RESOLVERS` | Resolving targets; dnsx, naabu and subfinder never use their built-in public resolver lists |
| Scan | Your targets | The scans themselves |

## The platform URL

`SENSOR_API_URL` is the platform's API base URL. With the built-in gateway this is
the single public address of the platform (for example
`https://openctem.example.com`): the gateway sends the sensor paths
(`/api/v2/sensor/*`, `/api/v3/sensor/*`) straight to the API. Without the gateway, point the
sensor at the API service itself (the address whose `/health` answers), not
at the web UI: the web UI does not forward the sensor's credentials and
answers sensor requests with `421 WRONG_ENDPOINT`. The sensor refuses
redirects.

- Use `https://`. A plain `http://` URL to anything but loopback works but
  logs a warning.
- A private platform address, a Docker network name or a Kubernetes service
  name works without extra settings. Cloud metadata and link-local addresses
  are refused.
- For a private certificate authority, see
  [Trust a private CA](deploy-docker.md#trust-a-private-certificate-authority).
  Gateway TLS modes are described in [TLS and the gateway](../install/tls-and-gateway.md).

## Proxies

The sensor separates its three kinds of traffic:

| Traffic | Setting | When unset |
|---|---|---|
| To the platform | `SENSOR_CONTROL_PROXY`: a proxy URL, or `direct` | `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY` |
| Content downloads | `SENSOR_CONTENT_PROXY`: a proxy URL, or `direct` | the control proxy setting |
| Scanners to their targets | `SENSOR_SCAN_PROXY`: `inherit` or `direct` | `inherit` |

- Proxy URLs may be `http://`, `https://`, `socks5://` or `socks5h://`, with
  `user:password@` for Basic or SOCKS5 authentication. An `https://` platform
  goes through an HTTP proxy as a `CONNECT` tunnel, so TLS stays end to end.
- With `inherit`, scanners get the same proxy variables, so their traffic to
  targets goes through the proxy unless `NO_PROXY` lists the target. That is
  rarely right for internal targets: set `SENSOR_SCAN_PROXY=direct`, or set
  `inherit` explicitly to keep it (the start-up warning then stops).
- Content downloads check the destination address before using the proxy,
  so a proxy cannot be used to reach private or metadata addresses.
- gRPC to the platform also goes through the control proxy, as a `CONNECT`
  tunnel. A proxy that does not carry HTTP/2 makes the sensor use HTTPS
  (`http2_refused`).

### TLS-inspecting proxies

A proxy that decrypts and re-encrypts TLS presents its own certificate:

- Trust its CA: `SENSOR_CA_CERT_FILE` (platform and content downloads);
  scanners read `SSL_CERT_FILE`.
- Pair the sensor through the proxy. Pairing pins the CA the sensor sees; a
  sensor paired elsewhere and moved behind the proxy refuses it
  (`platform certificate does not match the pin stored at pairing`).
- Set `SENSOR_TRANSPORT=https`. For gRPC the sensor trusts only the platform's
  sensor CA, so an inspected gRPC connection is refused
  (`platform_certificate_refused`) and, by design, not answered with a
  fallback: without this setting the sensor stops sending, heartbeats
  included, as soon as the platform offers gRPC.
- Better: exempt the platform host from inspection. Then nothing above is
  needed and the sensor can use gRPC.

A network segment that is reachable only through a proxy is best served by
its own sensor inside it, in its own [scan zone](zones.md), or by a sensor
whose Network path is a proxy pool ([Proxies for scans](proxies.md)).

On a confined sensor each scan task already reaches the network only through
its own forwarder, which admits the job's targets and enforces the job's web
scope ([Tool confinement](security.md#tool-confinement)).

Proxies for **scan traffic** can also be managed from the console: paste a
list under **Settings > Scanning > Proxies**, and pick a pool per sensor. See
[Proxies for scans](proxies.md).

## Scanner content without internet access

Scanner binaries are pinned in the images. Their content is managed by the
sensor: it downloads into a staging directory, verifies it, then switches
atomically, every 6 hours by default. The default image ships a pinned,
checksum-verified nuclei-templates release, so a new sensor scans without
downloading anything. For hosts without internet access:

| Content | Setting |
|---|---|
| nuclei templates | `SENSOR_CONTENT_NUCLEI_TEMPLATES_URL` (an `https://` or `file://` archive URL with `{version}` or `{bare_version}`), `SENSOR_CONTENT_NUCLEI_TEMPLATES_CHECKSUMS_URL`, and a pinned `SENSOR_CONTENT_NUCLEI_TEMPLATES_VERSION`; or `SENSOR_CONTENT_NUCLEI_TEMPLATES_DIR` for a local directory |
| trivy database | `SENSOR_CONTENT_TRIVY_DB_REPOSITORY` pointing at an internal registry copy |
| SAST rules (opengrep, semgrep) | `SENSOR_CONTENT_SEMGREP_RULES_PATH` (a local file or directory, for example an unpacked rules pack release), or `SENSOR_CONTENT_SAST_RULES_URL` (a mirror of the rules pack releases with `{version}` and `{bare_version}`; the signature is still verified) |

`SENSOR_CONTENT=off` lets each tool fetch its own content instead. The
platform's content policy (**Settings > Scanning > Content freshness**) can set
refresh intervals, maximum ages and pinned versions, but never where content
comes from. See also [Scanner content and content packs](content-delivery.md).

## What targets need

- **Reachability from the sensor.** Put a sensor where it can reach the
  targets of its zone. Firewalls between the sensor and its targets must
  allow the scans you run (DNS, the ports you scan, HTTP and HTTPS).
- **Private addresses.** Refused unless `SENSOR_ALLOW_PRIVATE_TARGETS=1` is set
  on the sensor *and* a scan zone of the organization covers them.
- **Always refused**, whatever is configured: loopback, link-local and cloud
  metadata (`169.254.0.0/16`), carrier-grade NAT (`100.64.0.0/10`),
  multicast and broadcast. A host name is refused when it resolves to such an
  address, and a name that does not resolve is refused too. Sensor v0.22.2
  and later also refuse NAT64, 6to4 and Teredo addresses,
  `192.0.0.0/24` and `198.18.0.0/15`.
- **How the target guard refuses.** The sensor checks every target before
  its tool runs. A `host:port` target (`203.0.113.7:80`, `[2001:db8::1]:443`,
  as a port scan hands to the HTTP probe) is checked on its host (v0.22.1 and
  later). Up to v0.22.1 one refused target fails the whole task with
  `scan target refused by guard: ...`. Sensor v0.22.2 and later leave
  each refused target out with its reason, runs the others, and fails the
  task only when every target is refused; the run page counts them
  ([The run flow](../scanning/scans-and-runs.md#the-run-flow)).
- **SYN port scans** need the `NET_RAW` capability (`--cap-add NET_RAW`);
  without it naabu uses TCP connect scans.
- **Rate.** nuclei runs at most `SENSOR_NUCLEI_MAX_RATE_LIMIT` requests per
  second (default 150). The platform also keeps one active task per host at a
  time within an organization. The sensor backs off when a target throttles
  it; it never rotates addresses to evade limits.

## Sensor-local policy

The owner of the scanned network can limit what a sensor may do with a
read-only file the platform cannot change. The sensor refuses every job
outside it, whatever the platform sends. A compromised platform therefore
cannot point the sensor at networks, ports or tools the owner did not allow.

The sensor reads `-local-policy`, `SENSOR_LOCAL_POLICY`, or
`/etc/openctem/sensor-policy.yaml` when it exists. A policy that does not
load stops the sensor (exit code 2).

**A policy is optional and can only narrow.** Without one, the sensor
follows the platform's signed scope: it runs any job whose scope statement
the platform signed (the sensor still verifies the signature), and the
built-in deny list, `SENSOR_ALLOW_PRIVATE_TARGETS` and the kill switch still
apply. The install commands write no policy file. A policy you install
narrows that scope (the intersection of the two) and the platform never
writes it. A policy with an explicit `targets.allow: []` allows nothing; one
without `targets.allow` does not narrow targets. The console shows the mode
under **Local policy**: "Follows platform scope", "Narrowed by host policy
(N rules)" or "Allows nothing yet", and "Targets: allows everything the
platform signs" for a policy with `targets.allow: ["*"]`.

To fail closed without a file, set `SENSOR_REQUIRE_LOCAL_POLICY=true` (the
default is `false`): the sensor then refuses every job with network targets,
custom templates or callbacks (`refused by local policy: no_local_policy:
...`) and the platform sends it no scan. Jobs without network targets
(repository and file scans, health checks) still run. Without a local policy
a compromised platform could sign a wide scope: if you do not trust the
platform that far, install a narrowing policy or require one.

A sensor paired by an earlier release that failed closed follows the
platform's scope once it runs the current SDK; set
`SENSOR_REQUIRE_LOCAL_POLICY=true` to keep it closed.

**The quickest way to a narrowing policy is the console's suggestion.** Open
the sensor (Sensors, then the sensor's drawer): a sensor without a policy shows
"Suggested local policy", built from the sensor's scan zones, or from your
organization's scope when it has no zone (active scope entries become
`targets.allow`, active network and name exclusions become `targets.deny`,
and a private range turns `allow_private` on). The install commands carry the
same file. Review it, remove what this sensor must not reach, and run the
command it shows on the sensor host: it writes
`/etc/openctem/sensor-policy.yaml`. Then reload the sensor with
`docker kill -s HUP <container>`; a container started without
`-v /etc/openctem:/etc/openctem:ro` must be started again with that volume
and `SENSOR_LOCAL_POLICY=/etc/openctem/sensor-policy.yaml` (keep its data
volume so it keeps its identity). The suggestion is text the platform
proposes: once the file is on the host, the platform cannot change it.
Members whose role cannot read the scope get the zones only.

Without the console, the shorthand works without a file:

```bash
-e SENSOR_ALLOWED_RANGES='203.0.113.0/24,*.example.com' \
-e SENSOR_ALLOWED_PORTS='80,443,8000-8999'     # optional
```

Private ranges in the list also need `SENSOR_ALLOW_PRIVATE_TARGETS=1`; the
sensor refuses to start otherwise and says so. The shorthand refuses custom
templates and out-of-band callbacks; write a file for those, or for tool and
rate limits and a kill switch. The two cannot be combined.

`apiVersion` is required and is always `openctem.io/sensor-policy/v1`: there is
one schema, with every key. Any other value (an older release wrote v2 and v3)
is refused and the sensor does not start: change that line, or write a new
file. Until 1.0 the schema may gain optional keys; a file is checked strictly,
so a sensor that predates a key refuses a file that uses it. Upgrade the sensor
first, and check with `openctemio-sensor policy validate`.

```yaml
apiVersion: openctem.io/sensor-policy/v1
targets:
  allow: ["203.0.113.0/24", "*.example.com"]
  deny: []
  allow_private: false
ports:
  allow: "80,443,8000-8999"
checks:
  allow: [scan, validate, retest, refresh_content]
allow_custom_templates: false
allow_interactsh: false
rate:
  max_rps: 100
  max_job_seconds: 14400
kill_switch_file: /etc/openctem/STOP
```

| Key | Meaning |
|---|---|
| `targets.allow` / `targets.deny` | CIDRs, IPs, host names and `*.domain` patterns. A name passes when it matches a domain entry or every address it resolves to is in an allowed range. Deny always wins: a range that contains denied addresses is scanned around them, address by address, together with the job's own exclusions and the built-in deny list. |
| `targets.allow_private` | RFC 1918 / ULA ranges may be scanned (`SENSOR_ALLOW_PRIVATE_TARGETS=1` is needed as well) |
| `ports.allow` | Ports a job may name |
| `tools.allow` | Tools that may run; others are neither run nor reported. This replaces the deprecated `SENSOR_TOOLS` |
| `checks.allow` | Job types: `scan`, `validate`, `retest`, `collect`, `refresh_content` |
| `allow_custom_templates`, `allow_interactsh` | Platform-supplied custom templates; out-of-band callbacks. Off unless set |
| `rate.max_rps`, `rate.max_job_seconds` | Request rate ceiling; longest job run |
| `kill_switch`, `kill_switch_file` | Stop every job (while the file exists) |
| `http.user_agent`, `http.allow_insecure_tls`, `http.headers` | A User-Agent for every tool; `false` refuses tools that skip TLS verification; up to 4 headers that mark this sensor's scan traffic (below) |
| `managed.accept` | `false`: ignore any narrowing policy the platform manages for this sensor. Default `true` |

`targets.allow: ["*"]` (sensor v0.35.0 or newer) allows every target the
platform signs; the built-in deny list and the private-range rules still
apply, and `*` cannot be mixed with other entries.

{: .note }
From sensor v0.11.0, `*.example.com` covers `example.com` and every name
below it, as in platform [scope](../scanning/scope.md). Older sensors read it
as the names below `example.com` only; list the apex separately for them.

### Mark this sensor's scan traffic

The owner of the host can add identification headers, so the network's WAF,
SIEM and logs can tell this sensor's scans apart. Sensor v0.35.0 or newer;
an older sensor refuses a file with `http.headers` (unknown key).

```yaml
apiVersion: openctem.io/sensor-policy/v1
http:
  headers:
    - {name: X-Netops, value: dc1}
```

- The sensor sends them on every request of every task that sends HTTP to its
  targets, for every organization it serves. On a shared sensor they are the
  host's network identity: never put an organization's data or a secret in a
  value.
- Rules: at most 4 headers; a name of 1 to 64 letters, digits or
  `!#$%&'*+-.^_|~`; a printable ASCII value of at most 200 characters; names
  unique ignoring case; never `Authorization`, `Cookie`, `Host`,
  `Content-Length`, `Transfer-Encoding`, `Connection`, `Keep-Alive`, `TE`,
  `Trailer`, `Upgrade` or `Proxy-*`. A file that breaks a rule stops the
  sensor from starting, and the message names the header.
- Merged with the headers a job already carries, by name, ignoring case: a
  header the platform enforces or a bug-bounty program sets is locked and
  keeps the platform's value; any other header of the same name is replaced by
  yours; every other name is kept. Your `http.user_agent` wins over the
  organization's unless the platform enforces one. Together at most 16
  headers; a job over that is refused with a message naming the cap.
- **A tool that cannot carry headers is refused for every job while headers
  are set**, so nothing probes unmarked. nuclei, httpx and katana carry them.
  This is a behaviour change from v0.35.0: setting headers on a sensor whose
  image has another networked tool stops that tool on this sensor.
- A job's query parameter is reported "not applied" by nuclei, httpx and
  katana, which have no flag for it.
- Each result reports what the sensor sent (names, source and values), so the
  platform can show it. Values of names that look secret are masked. The
  sensor advertises the capability `http.identity@1` for all of this.
- A header on an allow-list is not a secret: anyone who sees the traffic can
  copy it. Use it with the sensor's published address, and tag rather than
  bypass.

With the multi-sensor kit, `./sensors.sh set-header NAME HEADER VALUE` and
`unset-header NAME HEADER` manage the headers (see
[Several sensors on one host](run-the-sensor.md#local-policy-and-scan-headers-of-a-kit-sensor)).
A ready example is
[`sensor-policy-headers.example.yaml`](https://github.com/openctemio/sensor/blob/main/docs/sensor-policy-headers.example.yaml).

Useful commands (they read local files only):

```bash
openctemio-sensor policy validate /etc/openctem/sensor-policy.yaml
openctemio-sensor policy explain /etc/openctem/sensor-policy.yaml -target app.example.com:8443 -tool nuclei
touch /etc/openctem/STOP    # kill switch: no job runs until the file is removed
```

The sensor re-reads the policy on `SIGHUP` (`docker kill -s HUP <container>`).
A refused job is reported failed with `refused by local policy: <rule>:
<detail>`; a refused target in a multi-target job is skipped and the job
completes as partial. Mount `/etc/openctem` (the directory, not the file)
read-only into the container. The full reference is
[LOCAL_POLICY.md](https://github.com/openctemio/sensor/blob/main/docs/LOCAL_POLICY.md).
