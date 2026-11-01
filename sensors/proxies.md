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

The page opens with the organization's proxy health: **Proxies in use**,
healthy, on probation and quarantined, re-read every 30 seconds while the page
is visible. The default pool and every other pool use the same card (health
summary, routing strategy, assigned sensors, **Test**, **Edit**) and the same
edit dialog, so the default pool can set its strategy and description too.

1. Open **Settings > Scanning > Proxies**.
2. On the **Default pool** card choose **Add proxies**, paste your proxies,
   one per line (syntax below), and **Save**.
3. Turn on **Use proxies for scans**.

**Use proxies for scans** saves as soon as you confirm it. Turning it on asks
**Turn proxies on?**: your own sensors send scans to public targets through
the pool from their next job, and never fall back to a direct connection while
it is on. Turning it off asks **Turn proxies off?**: sensors scan from their
own address, so a target that only allows your proxy addresses will block
them. A new default pool starts off, and it needs a proxy first.

The page shows the stored list back. A proxy starts in *probation*: the first
real scan traffic proves it, or run a [test](#test-a-pool) first. Each proxy
shows its connect time (p95), its connection counts, its last error and when
its stored credentials last changed; on a phone the proxies show as cards.

Before you turn it on, the page lists the sensors that turning the default
pool on would hold back, and why: **No scan jobs: no proxy support reported** (the
sensor cannot use a pool, so it would get no scan jobs) or **No validation
jobs: probes would leave direct** (scans run through the pool, re-checks of
findings wait).

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
- In a user name or password, write `@` as `%40`, `:` as `%3A`, `/` as `%2F`
  and `#` as `%23`. A label cannot contain `@`, `:` or `/`, so a password
  with an unencoded `#` is refused instead of being cut at the `#`.
- The host is an IP address or a DNS name. Loopback, link-local, cloud
  metadata, multicast, unspecified and reserved addresses, and `localhost`, are
  refused when you save. The page shows the line number of a bad line.
- **Build a line** under the paste box asks for scheme, host, port, user name,
  password and label, and adds a correctly encoded line for you.
- A `socks5` or `http` proxy with credentials on a public address gets a
  warning, **Proxy login sent without encryption**: the user name and password
  reach the proxy readable on the way. Use an `https://` proxy or reach it over
  a private link.
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
description and list. **Edit** on any pool, the default pool included, opens
the same dialog; under **Advanced** you can choose the strategy:

| Strategy | Behaviour |
|---|---|
| Sticky (default) | Spreads work over healthy proxies by health weight and keeps one target on one proxy while that proxy stays healthy |
| Priority | Uses the first healthy proxy in list order |

On a sensor's page, **Network path** picks what that sensor uses:

| Choice | Meaning |
|---|---|
| Inherit (organization default) | Public targets through the default pool, if one is on; everything else direct |
| Direct | No proxy, whatever the default says |
| A pool | All scan and validation traffic of this sensor through that pool |

Choosing a pool for a sensor that does not report proxy support asks first
(**This sensor would stop getting scan jobs**), because none would be sent to
it. **Use the pool anyway** keeps the choice.

A sensor whose host sets `SENSOR_SCAN_EGRESS=direct-only` (see
[Controls on the sensor host](#controls-on-the-sensor-host)) shows **Direct
(set on the sensor host)** while it inherits the organization default: its
scans run direct, from its own address. If you choose a pool for such a sensor,
its scans wait (**This sensor receives no scan jobs**) and never go direct;
choose Inherit, or change the setting on the host.

A pool that sensors still use cannot be deleted: the console answers
`PROXY_POOL_IN_USE` until you move those sensors to another path.

Turning a pool off depends on how sensors reach it:

- **The organization default, off**: proxies are off. Sensors set to Inherit
  scan directly.
- **A pool chosen on a sensor, off**: that sensor's scans **fail** (reason
  `egress_unavailable`) until you turn the pool back on or choose another
  path. They never go direct; Direct is only ever your explicit choice. The
  Network path list marks such a pool "(disabled, scans fail)".

The Network path section also tells you when a sensor receives no scan jobs
(a pool applies and the sensor does not report proxy support), when its chosen
pool is off, and when its validation jobs wait.

**Shared sensors** run by the platform operator never use your organization's
proxies: a scan that runs on a shared sensor goes out directly from the
platform's addresses, even when your organization has a default pool.

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
  each repeat up to 2 hours. The platform never connects to a proxy itself:
  after the back-off the proxy returns as *probation* and the next job's real
  traffic (or a [test](#test-a-pool)) is its test.
- The jobs' own results count too. The platform records which pool and proxies
  it handed each pooled scan, retest or validation job. When a job ends with
  hosts the pool could not carry (`proxy_unavailable`), that fault is charged
  to exactly those proxies. 5 faulted jobs within 30 minutes, or more than half
  of at least 5 jobs, quarantine a proxy. A sensor cannot name a proxy it was
  not handed, and target-side failures never count.
- A proxy that jobs of several sensors used in the last 30 minutes is
  quarantined from job results only when at least two different sensors
  reported faults through it, so one sensor's own network problem does not take
  a shared proxy away from every sensor.
- Every quarantine is written to the audit log (`proxy_pool.endpoint_quarantined`;
  `source: task_reports` when job results decided it).
- If one proxy fails during a job, the sensor tries the next ranked proxy, at
  most once per proxy.
- Rotation never reacts to a target's answers (rate limits, blocks). Choosing a
  different proxy to get around a target's defence is not something the
  platform does.
- **Reset health** on a proxy clears its record and starts it again; the
  switch next to it disables the proxy without deleting it.

Tor and public proxy lists are not supported.

## Scanner addresses

The **Scanner addresses** card on the same page lists the addresses your scans
leave from, with copy buttons and ready allowlist snippets (**Allowlist**:
"allow" rules, a "Require ip" rule, a JSON list, comma-separated or one per
line), so the owner of a target can allowlist the scanner instead of the scan
being blocked or challenged by a WAF or edge protection. The retest and run
help for edge-blocked results point to this card.

Only addresses the platform observed itself are listed:

| Kind | Where the address comes from |
|---|---|
| Proxy exit | The exit address a proxy **test** saw, kept only when the platform's test page saw that address for the same test. A sensor's own report never adds one. |
| Sensor | The address the platform saw your sensor connect from (last 30 days), for a sensor scanning without a proxy. |
| Shared sensors | The published egress of the platform's shared sensors, when your organization may use them. |

Private addresses only matter to a WAF on the same internal network. With no
entries yet, run a proxy test, or wait until your sensors have connected. API:
`GET /api/v1/proxy-pools/scanner-addresses` (`sensors:egress:read`).

## Test a pool

**Test** next to a pool asks up to 3 online sensors of your organization to
connect through each of its proxies and report what they saw. The platform
never connects to your proxies, so a proxy on a private network can be tested
by a sensor inside that network. You can test a pool before you turn it on or
assign it.

1. Open **Settings > Scanning > Proxies** and choose **Test** on the pool.
2. Pick the sensors under **Run the test from (up to 3 sensors)** and choose
   **Run test**.
3. Each proxy shows a **Result**, the **Exit address** seen by the platform's
   test page, the handshake **Time**, and **Families and ports** (IPv4, IPv6,
   **Only port 443** for a proxy that refuses other ports).

- A passing test moves a quarantined proxy to probation; refused credentials
  quarantine it.
- A pool can be tested once a minute. Every test and its outcome are audited.
- It needs `sensors:egress:write`, and a sensor that accepts platform proxy
  pools (sensor v0.27.0 or later, not set to `direct-only`). If none is online
  the dialog says so.
- The sensors connect, through each proxy, to the platform's test page
  (`/api/v1/proxy-test-echoes/...`, which answers only the token of a running
  test). By default that is `SENSOR_PUBLIC_API_URL`, else `APP_URL`; set
  `PROXY_TEST_ECHO_URL` when the proxies reach the platform at another public
  https origin (never the sensor mTLS port). `PROXY_TEST_ALT_PORT` (default
  `80`, `0` to skip) is the second port used to spot a proxy that only allows
  443. See [Environment variables](../configuration/environment-variables.md).

## Fail-closed behaviour

A scan never silently leaves a proxy:

- A sensor that does not support proxied scans (it needs network confinement
  and the proxy capability, from a recent sensor version) **receives no scan
  jobs** while a pool applies to it. Upgrade it, or set its Network path to
  **Direct**.
- Validation jobs (re-checks of findings) contact the target too. A sensor
  that a pool applies to receives them only when it sends them through the
  pool (sensor v0.27.0 or later). Older sensors leave them waiting for a sensor
  without a pool or one set to Direct.
- A task that waits for this reason says so on the run page, one sentence per
  sensor (reasons `egress_unsupported` for scan and retest jobs,
  `egress_validate_unsupported` for validation jobs), with a link to the
  sensor's page.
- When the pool cannot carry a connection (every proxy down, credentials
  refused, or the proxy's own rules refuse the port), that host is listed as
  a coverage gap (`proxy_unavailable`, shown on the run page as "the scan's
  proxy failed") and the scan ends **partial**. A scan
  that reached nothing never reads as "no findings", and never closes
  findings.
- If every proxy of the pool is quarantined, a job fails with the reason
  `egress_unavailable`. It does not run directly.
- A pool is never combined with "direct" as a fallback.

## Controls on the sensor host

The owner of a sensor host keeps the last word. Two settings are read on the
sensor:

| Setting | Meaning |
|---|---|
| `SENSOR_SCAN_EGRESS=platform` | Default. Accept the pools the platform assigns |
| `SENSOR_SCAN_EGRESS=direct-only` | Refuse every job that carries a proxy (`egress_refused_by_host`). The sensor stops reporting proxy support and reports that its host chose direct: while it only inherits the organization default, the platform runs its scans direct; a pool assigned to it holds its jobs |
| `SENSOR_SCAN_EGRESS_ALLOW` | Optional comma list of `host:port` (or `host` for any port) the sensor accepts as upstreams. A job naming any other proxy is refused (`egress_refused_by_host`). Empty means any proxy that passes validation |

The sensor validates every proxy again, for each address a proxy name resolves
to: loopback, link-local, cloud metadata, multicast and reserved addresses are
refused. Private addresses are allowed, so an internal proxy works.

## Requirements for your proxies

- **HTTP and HTTPS proxies** must allow the `CONNECT` method to the ports that
  are scanned. Many proxies allow `CONNECT` to port 443 only; scans of other
  ports are then refused by the proxy. The refused hosts show as coverage
  gaps (`proxy_unavailable`), the scan ends partial, and neither the proxy's
  score nor the target is blamed. Use SOCKS5, or widen the proxy's `CONNECT`
  rules.
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
| trivy-image (registry pulls), ASN and RDAP lookups | Yes |
| trivy vulnerability database | No while content management is on (the default): the sensor installs it on the content path and trivy runs with `--skip-db-update`. With `SENSOR_CONTENT=off`, trivy downloads it itself during the job, through the pool |
| codeql (whatever it downloads during the job, such as query packs) | Yes |
| semgrep, only on sensors where its binary is installed (registry rule downloads during the job) | Yes |
| opengrep, betterleaks | Nothing to carry: they use no network (opengrep runs the rules the sensor installed on the content path) |
| UDP | No: only TCP goes through the pool |

The pool carries what a tool fetches itself while the job runs. Scanner
content the sensor manages for its tools (nuclei templates, the trivy
database, opengrep rules) is downloaded by the sensor on its content path
(`SENSOR_CONTENT_PROXY`), not through the pool. A code scan's repository is
cloned by the sensor before the tools start, from the sensor's own network:
not through the pool and not through the content proxy. A job with a
pool is refused (`egress_unavailable`) on a sensor whose tools would not run
behind the forwarder: tools run in process (`SENSOR_TOOL_RUNTIME=in-process`),
a sandbox without network confinement, or CI mode.

## Troubleshooting

| You see | Cause and fix |
|---|---|
| A sensor takes no scan jobs after you turn proxies on | The sensor lacks proxy support (the run page says `egress_unsupported`), or a pool is assigned to a sensor set to `SENSOR_SCAN_EGRESS=direct-only`. Upgrade it, set its Network path to Direct, or to Inherit for a direct-only sensor |
| A proxy is quarantined although the pool's own health looked fine | Jobs through it reported hosts it could not carry. Run **Test** on the pool, fix the proxy, then **Reset health** |
| **Test** says no sensor can run it | No online sensor of the organization accepts platform proxy pools. Upgrade a sensor to v0.27.0 or later, and check it is not set to `direct-only` |
| A test shows **No answer from the test page** | The proxy works but cannot reach the platform's test page. Check `PROXY_TEST_ECHO_URL` and that the proxy may reach that https origin |
| Jobs fail with `egress_unavailable` | Every proxy of the pool is quarantined. Check the last error in the table, fix the proxy, use **Reset health** |
| Jobs refused with `egress_refused_by_host` | The sensor host's `SENSOR_SCAN_EGRESS` or `SENSOR_SCAN_EGRESS_ALLOW` does not allow the proxy |
| Save fails with `INVALID_PROXY_ENDPOINT` | The line number is shown; check scheme, host, port and the refused address classes |
| A proxy is stuck in probation | It gets a small share of traffic: run a scan through it, or wait for the next job |
| Scans of non-443 ports fail through an HTTP proxy | The proxy refuses `CONNECT` to those ports; see [Requirements for your proxies](#requirements-for-your-proxies) |
| A scan is partial with `proxy_unavailable` gaps | The pool could not carry those connections: proxies down, credentials refused, or a port the proxy does not allow. Check the pool's health table |
| Jobs fail with `egress_unavailable` right after you turned a pool off | Sensors chosen to use that pool fail closed. Turn it back on, or set their Network path to another pool or Direct |
| Validation jobs stay pending | The sensors a pool applies to do not send validation through the pool (older than v0.27.0). Upgrade them, or run validation from a sensor set to Direct |
