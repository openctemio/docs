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
| Control | The platform URL, HTTPS (443 with the built-in gateway) | Pairing, heartbeats, jobs, results |
| Content | `github.com` and `api.github.com` (nuclei templates); `mirror.gcr.io` and `ghcr.io` (trivy database, per-tool trivy image); `semgrep.dev` (semgrep rule sets, only when configured) | Keeping scanner content current. Optional: mirrors and local files work, see below |
| DNS | The resolvers in `/etc/resolv.conf`, or `SENSOR_DNS_RESOLVERS` | Resolving targets; dnsx, naabu and subfinder never use their built-in public resolver lists |
| Scan | Your targets | The scans themselves |

## The platform URL

`API_URL` is the platform's API base URL. With the built-in gateway this is
the single public address of the platform (for example
`https://openctem.example.com`): the gateway sends the sensor paths
(`/api/v2/sensor/*`) straight to the API. Without the gateway, point the
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
- Behind a TLS-inspecting proxy, set `SENSOR_CA_CERT_FILE` to the proxy's CA;
  it is trusted for the platform and for content. Scanners read
  `SSL_CERT_FILE`.

A network segment that is reachable only through a proxy is best served by
its own sensor inside it, in its own [scan zone](zones.md).

{: .note }
Per-zone egress profiles (proxies configured on the platform per scan zone,
with an in-sensor forwarder that checks every destination) are **planned**
([RFC-034](https://github.com/openctemio/openctem/blob/develop/api/docs/rfcs/RFC-034-sensor-network-egress.md)).
Today proxies are set on the sensor host only.

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
| semgrep rules | `SENSOR_CONTENT_SEMGREP_RULES_PATH` (a local file or directory) |

`SENSOR_CONTENT=off` lets each tool fetch its own content instead. The
platform's content policy (**Settings > Scanning > Scanner content**) can set
refresh intervals, maximum ages and pinned versions, but never where content
comes from.

## What targets need

- **Reachability from the sensor.** Put a sensor where it can reach the
  targets of its zone. Firewalls between the sensor and its targets must
  allow the scans you run (DNS, the ports you scan, HTTP and HTTPS).
- **Private addresses.** Refused unless `SENSOR_ALLOW_PRIVATE_TARGETS=1` is set
  on the sensor *and* a scan zone of the organization covers them.
- **Always refused**, whatever is configured: loopback, link-local and cloud
  metadata (`169.254.0.0/16`), carrier-grade NAT (`100.64.0.0/10`),
  multicast and broadcast. A host name is refused when it resolves to such an
  address.
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
load stops the sensor (exit code 2). Without a policy the sensor reports
`local_policy: absent` and logs a warning; new installs should always ship
one.

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
| `targets.allow` / `targets.deny` | CIDRs, IPs, host names and `*.domain` patterns. A name passes when it matches a domain entry or every address it resolves to is in an allowed range. Deny always wins. |
| `targets.allow_private` | RFC 1918 / ULA ranges may be scanned (`SENSOR_ALLOW_PRIVATE_TARGETS=1` is needed as well) |
| `ports.allow` | Ports a job may name |
| `tools.allow` | Tools that may run; others are neither run nor reported |
| `checks.allow` | Job types: `scan`, `validate`, `retest`, `collect`, `refresh_content` |
| `allow_custom_templates`, `allow_interactsh` | Platform-supplied custom templates; out-of-band callbacks. Off unless set |
| `rate.max_rps`, `rate.max_job_seconds` | Request rate ceiling; longest job run |
| `kill_switch`, `kill_switch_file` | Stop every job (while the file exists) |

{: .note }
From sensor v0.11.0, `*.example.com` covers `example.com` and every name
below it, as in platform [scope](../scanning/scope.md). Older sensors read it
as the names below `example.com` only; list the apex separately for them.

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
