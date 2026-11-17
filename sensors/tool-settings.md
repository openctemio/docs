---
title: Tool settings
parent: Sensors
nav_order: 7.4
---

# Tool settings
{: .no_toc }

See how it works: [Tool settings to command line](../how-it-works/sensor-execution/tool-command-line.md), [Tool keys and scan settings](../how-it-works/secrets/tool-keys.md).

Each tool a sensor runs declares its options: how fast it may go (rate,
concurrency), how long it waits (timeout, retries) and tool-specific choices.
You set them **per organization** (defaults for every sensor) and **per
sensor** (overrides) in the console. They travel to the sensor inside
each signed scan job, and the sensor maps each one to the tool's native flag.

1. TOC
{:toc}

---

## Where to set them

**Organization defaults:** **Settings > Scanning > Tool defaults** lists every
tool that at least one of your sensors reports with a settings schema, with the
options every sensor of the organization runs it with. Save and reset are per
tool; owners and administrators (`sensors:write`) change them, everyone with
`sensors:read` sees them. If a sensor's tool version refuses the defaults, the
page names the sensor and the option, because that tool's scan jobs on it fail
until the defaults change. A tool no sensor reports any more shows only a reset
to remove its defaults. Shared sensors never use these defaults. Changing an option marked as having
impact (it raises the load or reach of each scan) asks you to confirm your
identity.

**Per sensor:** **Discovery > Sensors**, open a sensor, tab **Tool settings**. The tab is shown
to people who can manage sensors (`sensors:write`; owners and administrators
by default).

- Each tool the sensor reports with a settings schema gets a form, in two
  groups: **Common options** (rate, concurrency, timeout, retries) and
  **Tool options**.
- Each field shows its default (`Default (...)`), the allowed range
  (`Allowed: ... to ...`) and, where it has one, the tool's native flag.
  Leave a field empty to keep the default.
- A value that differs from the organization default shows **Set on this
  sensor**; **Reset to organization default** (per option) and **Remove all
  overrides** fall back to the layer above.
- **A scan can lower it** marks an option a scan may set lower, never higher.
- A dangerous option keeps its default until the organization can enable
  dangerous options.
- **Save** stores the values and **Reset to defaults** removes them. Both are
  audited.
- **Show effective values** opens a table with the columns **Key**,
  **Value**, **Source** (**This sensor**, **Organization**, **Tool default**
  or **Scan**) and **Native flag**: what the sensor will run with before a scan's own options and the
  job's limits apply.

When the sensor's tool changes (an upgrade) and the saved values no longer fit
its schema, the tab warns: "The sensor's tool changed and these saved settings
no longer fit it. Its scan jobs fail until you save or reset them."

## Who may raise or lower an option

An option's value is resolved in layers, in this order:

| Layer | Set by | May |
|---|---|---|
| Tool default | The tool's manifest | The starting value |
| Organization | **Settings > Scanning > Tool defaults** | Raise or lower |
| Sensor | **Tool settings** on the sensor | Raise or lower, within the allowed range |
| Scan or workflow step | The scan's options | Only lower |
| Job decision | The platform, per job (for example the per-target time budget) | Only lower |
| Sensor-local policy | The network owner, on the sensor host | Only lower (for example `rate.max_rps`) |

- Only the administrator layers may go **above** the tool's default. A scan
  that asks for a higher rate, concurrency or retry count than the sensor
  allows is an error, not a silent cap.
- **Timeout** is not lowered by a scan. The platform's per-target time budget
  shortens it on each job (to the budget divided by retries plus one, at least
  2 seconds), so one host that never answers costs one budget.
- Some options are **sensor only** (for example nuclei's `bulk_size` and
  trivy's `parallel`): a scan cannot set them at all.
- The host operator's ceilings apply last, whatever the settings say. For
  nuclei they are `SENSOR_NUCLEI_MAX_RATE_LIMIT`,
  `SENSOR_NUCLEI_MAX_CONCURRENCY` and `SENSOR_NUCLEI_MAX_BULK_SIZE`, which
  default to nuclei's own defaults (150 requests per second, 25 templates and
  25 hosts in parallel). **To run nuclei faster than that, raise both the
  sensor's tool setting and the matching variable on the sensor host.**

When you save a single-tool scan, or add or edit a workflow step pinned to a
tool, the platform checks its options against your sensors for that tool. A
sensor-only option, a value out of range, or a raise above what the sensor
allows is refused when no sensor would accept it, instead of failing every
job later.

## Options per tool

Options marked *common* are the ones the platform's job decision and budget
reach. The options a sensor reports are the ones in its version's manifest;
the console shows exactly what your sensor declares.

| Tool | Option (native flag) |
|---|---|
| nuclei | `rate_limit` (`-rate-limit`, common), `concurrency` (`-c`, common), `timeout` (`-timeout`, common), `retries` (`-retries`, common), `bulk_size` (`-bs`, sensor only), `max_host_errors` (`-mhe`), `scan_strategy` (`-ss`), `tags`, `exclude_tags`, `severity`, `response_read_kb` (`-rsr`, sensor only), `response_save_kb` (`-rss`), `template_ids` (`-id`, at most 8; sensor v0.38.4 or later) |
| naabu | `rate` (`-rate`, common), `retries` (`-retries`, common), `ports` (`-p`), `top_ports` (`-top-ports`), `exclude_ports` (`-exclude-ports`) |
| httpx | `rate_limit` (`-rl`, common), `threads` (`-threads`, common), `timeout` (`-timeout`, common), `retries` (`-retries`, common), `ports` (`-ports`), `follow_redirects` (`-follow-host-redirects`), `tech_detect` (`-tech-detect`), `tls_grab` (`-tls-grab`) |
| dnsx | `rate_limit` (`-rl`, common), `threads` (`-t`, common), `timeout` (`-timeout`, common), `retries` (`-retry`, common), `record_types`, `wildcard_filter` (`-auto-wildcard`) |
| dnsx-enum (sensor v0.27.0 or later) | `rate_limit` (`-rl`, common; a scan only lowers it, the sensor settings raise it to 500 at most), `threads` (`-t`, common, at most 200), `timeout` (common), `retries` (common), `max_queries` (first N labels of the job's list) |
| subfinder | `rate_limit` (`-rl`, common), `timeout` (`-timeout`, common), `sources` (`-sources`), `recursive` (`-recursive`), `max_results` |
| katana | `rate_limit` (`-rl`, common), `concurrency` (`-c`, common), `timeout` (`-timeout`, common), `retries` (`-retry`, common), `depth` (`-d`), `js_parse` (`-js-crawl`), `max_urls` |
| trivy | `parallel` (`--parallel`, sensor only), `dev_deps` (`--include-dev-deps`), `os_pkgs` (`--pkg-types`), `frameworks` (`--misconfig-scanners`) |
| opengrep | `taint_intrafile` (`--taint-intrafile`), `rule_timeout` (`--timeout`), `max_target_bytes` (`--max-target-bytes`), `jobs` (`--jobs`, sensor only), `max_memory_mb` (`--max-memory`, sensor only) |
| betterleaks | `history` |
| codeql | `languages` |
| asn | `include_announced`, `max_ranges` |
| rdap | `follow_registrar` |

semgrep declares no options.

Two nuclei details (sensor v0.37.0 or later):

- With no `severity` setting nuclei runs every severity, info included
  (technology detection, login panels, TLS and header posture, WAF
  detection). Before, the default was low to critical. The platform files
  info matches as info exposures of the asset, not as findings, and needs a
  platform that reads them that way: upgrade the platform first. A scan or a
  workflow step narrows the severities with its `severity` setting.
- `response_read_kb` (64 to 65536 KiB, default 10240) is how much of each
  response nuclei reads and matches on; matches past it are missed.
  `response_save_kb` (16 to 1024 KiB, default 1024, never above the read
  limit) is how much of a matching response is kept as the finding's
  evidence. The defaults are nuclei's own.

`template_ids` selects the sensor's own compiled-in checks (for example
`openctem-backup-file-signature`, one GET of a guessed backup, archive or dump
URL that matches only a non-HTML 200 whose first bytes are a zip, gzip or tar
signature or a database dump header). Only those ids are accepted (any other id
fails the scan); the sensor runs its own signed copies of them, signatures stay
required and the tier's excluded tags stay on.

These options are the ones the current sensor release ({{ site.data.versions.sensor }}) declares (opengrep from v0.22.0); older sensors declare fewer.

## API

| Method and path | Permission | Does |
|---|---|---|
| `GET /api/v1/sensors/tool-defaults` | `sensors:read` | Each tool's schema and the organization's defaults |
| `PUT` / `DELETE /api/v1/sensors/tool-defaults/{tool}` | `sensors:write` | Saves or resets the organization's defaults of a tool |
| `GET /api/v1/sensors/{id}/tool-settings` | `sensors:read` | Each tool's schema and stored values |
| `GET /api/v1/sensors/{id}/tool-settings/{tool}/effective` | `sensors:read` | The effective values with their source |
| `POST /api/v1/sensors/{id}/tool-settings/{tool}/preview` | `sensors:read` | Resolves a scan's or step's options over the sensor's settings, as the sensor will: each option with its value and source (default, sensor or scan) and the keys the sensor ignores; `422` when the sensor would refuse them. Stores nothing. |
| `PUT /api/v1/sensors/{id}/tool-settings/{tool}` | `sensors:write` | Saves the values |
| `DELETE /api/v1/sensors/{id}/tool-settings/{tool}` | `sensors:write` | Resets to defaults |

Related: [Tools and capabilities](../scanning/tools.md),
[Sensor-local policy](network.md#sensor-local-policy),
[Settings reference](settings.md).

## How hard a scan works one host

The tools that send requests to a scan's targets run under a **per-host budget**: 20 requests per second
and 8 requests in flight toward one host by default (the Standard level). The budget is counted per host,
whatever the scheme, port, path or spelling of the scan's targets.

| Level | Requests per second per host | In flight per host |
|---|---|---|
| Gentle | 5 | 2 |
| Standard (default) | 20 | 8 |
| Fast | 100 | 25 |

### The lowest limit wins

A job's budget is, for each of the two numbers, the **lowest** of:

1. the sensor's level, which the sensor's operator picks with
   [`SENSOR_PACING_LEVEL`](settings.md#SENSOR_PACING_LEVEL);
2. the budget the platform signs into the job, when it sends one;
3. the operator's ceiling, `rate.max_host_rps` and `rate.max_host_inflight` in the
   [local policy](network.md);
4. the built-in ceiling of 200 requests per second and 50 in flight.

A job can only lower what a host gets. A job signed for Fast on a Standard sensor runs at Standard; a job
signed for Gentle on a Fast sensor runs at Gentle. To scan your own hosts faster, raise the level on the
sensor. A job that asks for more is not refused: it runs at the lower limit, and its result says which
limit set each number and what was asked for.

A rate or concurrency setting above the budget is lowered to it, and the run's result and log say what was
asked and what applies. A lower setting stays.

### Which tools

| Tools | Paced by |
|---|---|
| nuclei (scans, re-verification and retests), httpx, katana, path discovery, screenshots, service detection | The per-host budget |
| Port scan (naabu) | Packets per second of the budget's level (100, 300 or 1000), not the request budget |
| DNS (dnsx), passive discovery (subfinder), lookups (asn, rdap), code scans (trivy, semgrep, opengrep, codeql, betterleaks) | They send nothing to the target hosts |

### What enforces it

**With the tool sandbox on (the default)**, every tool connection passes through the sensor, which holds
each host to the budget outside the tools. Names that resolve to one address share that address's budget.
The sensor holds:

- every new connection, and the number of connections open to a host;
- every request over plain HTTP;
- every request over HTTPS, including on connections the tool keeps open, for the scan tools the sensor
  runs (HTTP/1.1, and HTTP/2 from a tool that sends each request on its own). The sensor counts them from
  the outside and does not read the traffic.

It does **not** count requests that a client packs together on one HTTPS connection (a browser that loads
a page over HTTP/2, as the screenshot tool does), nor how many are in flight on such a connection: it
cannot tell them apart without reading them. For those, the tools' own rate and concurrency flags, which
the sensor derives from the same budget, are what holds the budget.

**With `SENSOR_SANDBOX=off`**, nothing is in the path. The tools' own flags are the only enforcement, a
run gets one host's budget in all whatever its target list, and nothing reacts to what the hosts answer.
The run's result says that its pacing is limited.

### When a target pushes back

A host that answers the tool's requests with 429 or 503 is slowed down (its rate is halved, its
`Retry-After` is waited out) and sped up again gradually when it answers normally. A host that answers
nothing but push-back is paused, and the run reports it as a coverage gap `throttled` with counts; the run
completes as partial and keeps everything it found. The scanner never changes its address or its
identification to get past a limit.

The sensor cannot see such answers on ordinary HTTPS. With the sandbox on, it therefore sends its own
small request (`GET /`) to each target origin every 10 seconds, the same way out as the tool. The request
is always the same and carries only the sensor's own `User-Agent`: nothing from the scan's settings is on
it. A 429, a 503 or a block page there halves the host's rate. On its own it does nothing more: it never
pauses a host and never stops a scan, so a target cannot end its own scan by answering that one request
differently. A host is paused when the tool's own connections fail as well.

This request verifies the origin's certificate. An origin with a certificate that does not verify, or a
target given without `http://` or `https://`, is paced but not watched this way.
