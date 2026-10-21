---
title: Proxies for scans
parent: Sensors
nav_order: 6.2
---

# Proxies for scans
{: .no_toc }

Send the scan traffic of your own sensors through proxies you control. You
paste a list of proxies in the console; the platform stores the credentials
encrypted, tells each sensor which proxies a job may use, watches how they
behave and sets a failing proxy aside until it recovers.

This page is about the path from a sensor to its **targets**. The path from a
sensor to the platform is a different setting, `SENSOR_CONTROL_PROXY`
([Network requirements and egress](network.md#proxies)).

1. TOC
{:toc}

---

## What it does

- A **pool** is a list of proxies (HTTP, HTTPS or SOCKS5). A pool can serve
  any number of your sensors.
- The **organization default** pool is the one marked as default. It carries
  scan traffic to **public** targets. Private, ULA and carrier-grade NAT
  addresses are still scanned directly.
- A pool **assigned to a sensor** carries **all** of that sensor's scan
  traffic, private targets included. Use it for a network segment that can
  only reach its targets through a proxy.
- Nothing about scope changes: the sensor still checks every target against
  the job's scope and the sensor's own allowed ranges **before** it opens a
  connection through a proxy.

Needs a sensor with network confinement and proxy support (see
[Fail-closed behaviour](#fail-closed-behaviour)), and the permissions
`sensors:egress:read` (view), `sensors:egress:write` (change) and
`sensors:egress:delete` (delete a pool). Owners and administrators have them by
default.

## Set up the organization default

1. Open **Settings > Scanning > Proxies**.
2. Turn on **Use proxies for scans**.
3. Paste your proxies, one per line (syntax below), and **Save**.

The page shows the stored list back. A proxy starts in *probation*: the first
real scan traffic proves it.

### Paste-list syntax

```text
scheme://[user:pass@]host:port[#label]
```

```text
socks5://svc-scan:s3cret@10.0.0.5:1080#datacenter
http://proxy.example.com:3128#backup
# lines that start with # and blank lines are ignored
```

- Schemes: `http`, `https`, `socks5`, `socks5h`. `socks5h` is treated as
  `socks5`: the sensor always connects to the address it has already checked.
- The order of the lines is the priority order. At most 64 proxies per pool,
  labels up to 64 characters, user name and password up to 255 characters each.
- The host is an IP address or a DNS name. Loopback, link-local, cloud
  metadata, multicast, unspecified and reserved addresses, and `localhost`, are
  refused when you save. The page shows the line number of a bad line.
- Saving again keeps a proxy's identity and health when its scheme, host and
  port are unchanged. A line you remove is deleted; a new line starts in
  probation.

### Credentials are encrypted and write-only

Credentials are stored encrypted. No page, API response, audit entry or log
shows them again: after saving, a line with credentials is shown as
`socks5://••••@10.0.0.5:1080#datacenter`.

- **Keep** the stored password: leave `••••` where it is.
- **Replace** it: type the new `user:pass@`.
- **Remove** it: delete the `••••@`.

A sensor receives the credentials of the pool a job uses only while it holds
that job, over its authenticated connection, and passes them to its own scan
forwarder. The scan tools never see them.

## More pools and the per-sensor Network path

Under **More pools**, **New pool** creates a pool with its own name,
description and list. Under **Advanced** you can choose the strategy:

| Strategy | Behaviour |
|---|---|
| Sticky (default) | Spreads work over healthy proxies by health weight and keeps one target on one proxy while that proxy stays healthy |
| Priority | Uses the first healthy proxy in list order |

On a sensor's page, **Network path** picks what that sensor uses:

| Choice | Meaning |
|---|---|
| Inherit (organization default) | Public targets through the default pool, if one is on; everything else direct |
| Direct | No proxy, whatever the default says |
| A pool | All scan traffic of this sensor through that pool |

A pool that sensors still use cannot be deleted: the console answers
`PROXY_POOL_IN_USE` until you move those sensors to another path.

**Shared sensors** run by the platform operator never use your organization's
proxies.

## Health: healthy, probation, quarantined

Sensors report, per job, how each proxy behaved. The platform turns that into a
score (0 to 100 %) and a state:

| State | Meaning |
|---|---|
| Healthy | Works; gets traffic in proportion to its score |
| Probation | New, or just re-admitted; gets a small share of traffic until it proves itself |
| Quarantined | Failing; gets no traffic until its quarantine ends |

- Only problems with the proxy count: a refused connection, a timeout, bad
  proxy credentials. A target that is down, or a target that a proxy rule
  refuses, does not lower a proxy's score.
- A dead proxy is quarantined automatically, for 5 minutes first, doubling on
  each repeat up to 2 hours. There is no probe from the platform: after the
  back-off the proxy returns as *probation* and the next job's real traffic is
  its test.
- If one proxy fails during a job, the sensor tries the next ranked proxy, at
  most once per proxy.
- Rotation never reacts to a target's answers (rate limits, blocks). Choosing a
  different proxy to get around a target's defence is not something the
  platform does.
- **Reset health** on a proxy clears its record and starts it again; the
  switch next to it disables the proxy without deleting it.

Tor and public proxy lists are not supported.

## Fail-closed behaviour

A scan never silently leaves a proxy:

- A sensor that does not support proxied scans (it needs network confinement
  and the proxy capability, from a recent sensor version) **receives no scan
  jobs** while a pool applies to it. Upgrade it, or set its Network path to
  **Direct**.
- If every proxy of the pool is quarantined, a job fails with the reason
  `egress_unavailable`. It does not run directly.
- A pool is never combined with "direct" as a fallback.

## Controls on the sensor host

The owner of a sensor host keeps the last word. Two settings are read on the
sensor:

| Setting | Meaning |
|---|---|
| `SENSOR_SCAN_EGRESS=platform` | Default. Accept the pools the platform assigns |
| `SENSOR_SCAN_EGRESS=direct-only` | Refuse every job that carries a proxy (`egress_refused_by_host`); the sensor stops reporting proxy support, so it also gets no proxied jobs |
| `SENSOR_SCAN_EGRESS_ALLOW` | Optional comma list of `host:port` (or `host` for any port) the sensor accepts as upstreams. A job naming any other proxy is refused (`egress_refused_by_host`). Empty means any proxy that passes validation |

The sensor validates every proxy again, for each address a proxy name resolves
to: loopback, link-local, cloud metadata, multicast and reserved addresses are
refused. Private addresses are allowed, so an internal proxy works.

## Requirements for your proxies

- **HTTP and HTTPS proxies** must allow the `CONNECT` method to the ports that
  are scanned. Many proxies allow `CONNECT` to port 443 only; scans of other
  ports then fail with a refusal from the proxy, which is reported as a target
  problem and not counted against the proxy. Use SOCKS5, or widen the proxy's
  `CONNECT` rules.
- **SOCKS5 proxies** have no such limit.

## Which tools use the pool

The pool carries every TCP connection a confined tool makes, through the
tool's forwarder on the sensor:

| Tool | Through the pool |
|---|---|
| nuclei, httpx, katana | Yes: every request to a target |
| naabu (connect scan, the default) | Yes: each probed port is one tunnel |
| naabu SYN scan | No: raw packets cannot pass a proxy, so a job with a pool is refused (`egress_unavailable`) |
| subfinder | Yes, for its passive sources |
| dnsx, and DNS of every tool | No: names are resolved by the sensor; DNS never goes through the proxy |
| trivy, semgrep, codeql (registry and rule downloads), ASN and RDAP lookups | Yes |
| betterleaks, opengrep | Nothing to carry: they use no network |
| UDP | No: only TCP goes through the pool |

Scanner content (templates, databases) and code-scan repository fetches use
the sensor's content path (`SENSOR_CONTENT_PROXY`), not the pool. A job with a
pool is refused (`egress_unavailable`) on a sensor whose tools would not run
behind the forwarder: tools run in process (`SENSOR_TOOL_RUNTIME=in-process`),
a sandbox without network confinement, or CI mode.

## Troubleshooting

| You see | Cause and fix |
|---|---|
| A sensor takes no scan jobs after you turn proxies on | The sensor lacks proxy support, or has `SENSOR_SCAN_EGRESS=direct-only`. Upgrade it, or set its Network path to Direct |
| Jobs fail with `egress_unavailable` | Every proxy of the pool is quarantined. Check the last error in the table, fix the proxy, use **Reset health** |
| Jobs refused with `egress_refused_by_host` | The sensor host's `SENSOR_SCAN_EGRESS` or `SENSOR_SCAN_EGRESS_ALLOW` does not allow the proxy |
| Save fails with `INVALID_PROXY_ENDPOINT` | The line number is shown; check scheme, host, port and the refused address classes |
| A proxy is stuck in probation | It gets a small share of traffic: run a scan through it, or wait for the next job |
| Scans of non-443 ports fail through an HTTP proxy | The proxy refuses `CONNECT` to those ports; see [Requirements for your proxies](#requirements-for-your-proxies) |
