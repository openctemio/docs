---
title: Tool settings
parent: Sensors
nav_order: 7.4
---

# Tool settings
{: .no_toc }

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
| nuclei | `rate_limit` (`-rate-limit`, common), `concurrency` (`-c`, common), `timeout` (`-timeout`, common), `retries` (`-retries`, common), `bulk_size` (`-bs`, sensor only), `max_host_errors` (`-mhe`), `scan_strategy` (`-ss`), `tags`, `exclude_tags`, `severity` |
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

These options are the ones the current sensor release (v0.29.0) declares (opengrep from v0.22.0); older sensors declare fewer.

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
