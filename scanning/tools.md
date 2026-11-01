---
title: Tools and capabilities
parent: Scanning
nav_order: 4
---

# Tools and capabilities

A **tool** is a scanner a sensor runs (nuclei, naabu, semgrep, ...). A
**capability** is what a step does (`scan.ports`, `vuln.templates`); one or
more tools implement each capability ([Scan workflows](scan-workflows.md#capabilities)).

The platform keeps a catalog of the tools it knows. Whether you can scan with
a tool depends on your sensors: each sensor reports the tools it has
installed, with their versions and content, and a scan for a tool goes only
to a sensor that reports it.

## Tools in the official sensor

| Tool | Capability | Tier | Sensor image |
|---|---|---|---|
| subfinder | `discover.subdomains` | T0 | default |
| dnsx | `resolve.dns` | T0 | default |
| dnsx-enum (sensor v0.27.0 or later) | `enumerate.subdomains` (brute force with the label list the platform names in the signed job; the sensor has no list of its own) | T1 | default |
| naabu | `scan.ports`, `discover.hosts` (live hosts first) | T1 | default |
| httpx | `probe.http`; `monitor.web_content` for a step or job that names it | T1 | default |
| katana | `crawl.web` | T1 | default |
| nuclei | `vuln.templates`, finding re-verification and retests | T1 | default, `-nuclei` |
| opengrep | `sast.code` (local rules only, no network) | T0 | `-opengrep` |
| semgrep | `sast.code` | T0 | `-semgrep` |
| trivy | `sca.deps`, `iac.misconfig`, `container.image` | T0 | `-trivy` |
| betterleaks | `secrets.code` | T0 | `-betterleaks` |
| rdap, asn (built in) | `lookup.rdap`, `lookup.asn` | T0 | every daemon |
| reach-probe (built in) | `reach.probe` (one TCP connect per address and port, on the platform's request, to test reachability) | — | every daemon that takes platform commands |

`monitor.web_content` (page monitoring) is run by httpx only when a step or a
job names it; a step that pins `httpx` alone is still the HTTP probe. It
reports no asset of its own: the capture is the `web_content` property of the
web asset the URL belongs to. It is an active capability, so coverage sends it
through the same dispatch gate as every active fetch (scope entry, exclusions,
tier ceiling, the claim-time re-check).

A sensor whose owner sets `http.headers` in its
[local policy](../sensors/network.md#mark-this-sensors-scan-traffic) reports the
capability `http.identity@1`. nuclei, httpx and katana carry the headers; a
networked tool that cannot is refused on that sensor while headers are set.

The sensor detects its tools itself and reports only those whose binary
passes its check; nothing is configured to enable a tool.

Other tools in the catalog (for example zap, codeql, grype, checkov) need a
sensor that ships them. For code scanning in CI, use
[CI integration](ci-integration.md) rather than a sensor.

## Tools your sensors declare

A sensor can run tools its operator installed, written to the tool contract
([Writing a tool](../developers/tool-authoring.md)). Such a tool joins your
organization's catalog by itself (v0.9.6) when one of your active sensors reports it
with a valid contract: its name, description, capabilities, target types,
settings schema and version come from the tool's descriptor, and a newer
version refreshes them. Nothing in the platform has to change.

- It is enabled when it appears. Switch it off like any tool; it cannot be
  edited or deleted, because the sensor's next report would bring it back.
- It never takes the name of a platform tool or replaces a tool a member
  added. An organization holds at most 128 of them, and they are never
  visible to another organization. Platform-operated sensors declare nothing.
- A step pinned to it runs it; on platform releases after v0.14.0 a step
  that names one of its capabilities offers it too, after the built-in
  implementations (or first when the step prefers it).
- It grants nothing. Such a tool is **unverified** and runs as T2
  (intrusive): only on a Trusted sensor whose grant allows T2, and only on
  targets whose scope allows T2.
- Each sensor's **Manifest** tab shows the tool's contract and options, and
  lists anything the platform ignored with the reason.

## Availability

**Settings > Scanning > Tools** lists each tool with its status on your
sensors:

| Status | Meaning |
|---|---|
| `ready` | Enabled, and at least one online sensor may run it at an accepted version |
| `outdated` | Only sensors below the tool's minimum version have it (still runnable) |
| `offline_only` | Sensors have it, but none of them takes work now |
| `no_sensor` | Enabled, but no sensor that may run it reports it |
| `disabled` | Switched off for your organization |

![The Tools page with each tool's status, sensors, version and last report]({{ site.baseurl }}/assets/images/scanning/tools.png)
*Figure: Tool availability.*

The **Sensors** column shows how many sensors may run the tool and how many
are online; a sensor that has the tool but may not run it (its
[grant](../sensors/pairing.md#grants-and-trust) or its local policy refuses
it) is listed as excluded, with the reason. By default the page shows the
tools at least one sensor reports; **Show full catalog** adds the rest. The
scan builder and the workflow builder grey out tools no online sensor may
run, with the same reason.

A trigger is refused with `NO_SENSOR_FOR_TOOL` when a tool it needs has no
online sensor that may run it, instead of queuing work nobody claims.

The same data is available as `GET /api/v1/tools?include=availability`
(optionally `&zone_id=<scan zone>`).

## Organization settings per tool

- **Enabled**: switch a tool off for the whole organization
  (`PATCH /api/v1/tools/{id}/settings` or `PATCH /api/v1/tools/settings`).
- **Configuration overrides**: a stored per-organization configuration of the
  tool, shown with its effective configuration. Scan jobs do not carry it: a
  job's tool options come from the scan and from each sensor's
  [tool settings](../sensors/tool-settings.md). A configuration that looks
  like a credential is refused: credentials belong in the secret store,
  referenced by id.
- **Custom tools and categories**: an organization can add its own catalog
  entries (`POST /api/v1/tools`, `/api/v1/tool-categories`). A custom tool runs
  only on a sensor that reports it. Tools your sensors declare are added
  without this step ([above](#tools-your-sensors-declare)).

**Settings > Scanning > Capabilities** lists the capabilities and which of
your tools and sensors provide each.

## Tool options

Rate, concurrency, timeouts, retries and tool-specific options are set in two
layers, and a scan may only lower them:

1. **Organization defaults**: **Settings > Scanning > Tool defaults**
   (`GET /api/v1/tool-defaults`, `PUT` and `DELETE /api/v1/tool-defaults/{tool}`)
   holds the options every sensor of your organization runs each tool with.
   Anyone with `sensors:read` sees them; owners and administrators
   (`sensors:write`) change them. The page lists the sensors whose tool
   version refuses a default, because their scan jobs of that tool fail.
   Shared platform sensors never use these defaults.
2. **Per sensor**: **Discovery > Sensors**, the sensor's **Tool settings**
   tab overrides any option for that sensor.

The order is the tool's own default, then the organization defaults, then the
sensor's overrides. A scan or workflow step can only lower rate, concurrency
and retries, the job's per-target budget shortens timeouts, and each sensor's
local policy can always narrow further. See
[Tool settings](../sensors/tool-settings.md).

## Nuclei safety

- The sensor's own templates are the managed nuclei-templates release, run
  with ProjectDiscovery's signature check (`-disable-unsigned-templates`).
- Every run excludes the tags `intrusive`, `default-login`, `dos`, `fuzz`,
  `fuzzing`, `bruteforce`, `brute-force`, `local` and `txt-service`. A scan
  that asks for one of them fails with the reason; flags that would re-admit
  them are refused.
- The code, file, headless and self-contained template types are never
  enabled.
- Rate limits are capped by the sensor host's ceilings
  (`SENSOR_NUCLEI_MAX_RATE_LIMIT`, `SENSOR_NUCLEI_MAX_CONCURRENCY`,
  `SENSOR_NUCLEI_MAX_BULK_SIZE`; default 150 requests per second, 25 and 25),
  whatever the sensor's [tool settings](../sensors/tool-settings.md) say.
- Out-of-band callbacks (interactsh) are off unless the organization allows
  them (**Settings > Organization > General**, "Allow out-of-band callbacks
  (interactsh) in sensor jobs"), the sensor's local policy allows them, and
  the scan asks for them.

## Custom templates

**Settings > Scanning > Scanner templates** (`/api/v1/scanner-templates`)
holds your own detection rules:

| Type | Format | Max size | Max rules |
|---|---|---|---|
| nuclei | YAML | 1 MB | 100 |
| semgrep | YAML | 512 KB | 500 |
| betterleaks | TOML | 256 KB | 1000 |

**Rule sources** (`/api/v1/content-sources`, API only: there is no console
screen yet) keep rules in sync from a Git repository over `https` (a branch,
tag or commit). The platform is the only fetcher: it syncs on a schedule
(hourly by default, at most every 5 minutes), on `POST
/api/v1/content-sources/{id}/sync` or from a webhook, into an immutable, signed
snapshot. A new snapshot is a candidate; it is promoted automatically when every
check passes, and one that raises the tool tier always needs review by someone
with `scans:sources:approve` other than the person who changed the source.
Creating or changing a source, its credential and its webhook, and approving a
snapshot, need a recent sign-in. The older template sources (Git over SSH, S3
and HTTP, synced when a scan starts) and `/api/v1/template-sources` were
removed in platform v0.15.0.

Custom nuclei templates reach a sensor only when all of these hold:

1. The organization allows them: **Settings > Organization > General**,
   "Allow custom templates in sensor jobs". Off by default.
2. The template passed upload checks: the `code`, `javascript`, `headless` and
   `file` protocols and self-contained templates are refused.
3. The sensor's local policy sets `allow_custom_templates: true`.
4. The sensor has the organization's template signing key pinned. For every
   job, the platform signs a manifest of the templates (bound to the
   organization, the sensor, the job and a one-hour expiry) with an Ed25519
   key derived for the organization. The sensor verifies it before using any
   template, and refuses templates that were changed, added or reordered.
   Without a pinned key, scans with custom templates fail.

   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     https://openctem.example.com/api/v1/scanner-templates/signing-key
   # {"algorithm":"ed25519","key_id":"...","public_key":"<base64>"}
   ```

   Set `SENSOR_TEMPLATE_SIGNING_KEYS=<base64>` on the sensor. To roll the key,
   pin the new key next to the old one (comma-separated) first.

Custom templates run in their own nuclei run with the code, file, headless
and javascript types excluded.

## Scanner content

The sensor keeps each tool's content (nuclei templates, and on per-tool
images the trivy database and the SAST rules) current itself and reports the
versions. **Settings > Scanning > Content freshness** sets the organization's
policy: refresh interval, maximum age per content, a pinned version, and the
semgrep rule sets. The policy never chooses where content comes from; that is
the sensor host's setting ([Network](../sensors/network.md#scanner-content-without-internet-access)).
Each result records the content version the scan used.

### SAST rules

opengrep and semgrep run the same rules content, `semgrep-rules`. The sensor
takes it from, in this order:

1. a local rules path on the sensor host (`SENSOR_CONTENT_SEMGREP_RULES_PATH`,
   for networks without internet access);
2. registry rule sets chosen in the content policy or on the sensor host
   (`SENSOR_CONTENT_SEMGREP_RULESETS`). The sensor fetches them from the
   registry under the registry's own licence, so only a sensor you run can use
   them: the platform never sends rule sets to the sensors it operates, and its
   own scans run opengrep with the rules pack;
3. by default, the **OpenCTEM rules pack**
   ([openctemio/sast-rules](https://github.com/openctemio/sast-rules), MIT).
   The sensor installs the newest release, or the version pinned in the policy
   or in `SENSOR_CONTENT_SAST_RULES_VERSION`. It installs a release only if
   its signature verifies for that repository's release workflow, so a mirror
   or proxy cannot change the rules.

opengrep never fetches rules itself: it runs only local rules and has no
network access during a scan.

From platform v0.9.6, scans on platform-operated sensors never use registry
rules. A platform scan whose tool is semgrep is refused when it is created,
because platform scans run static analysis only with opengrep and the rules
pack. Sensor v0.24.0 and later never run semgrep with `--config auto`: it
refuses a registry name, a URL or a flag as its rules and runs with
`--metrics off`. The content policy a
platform-operated sensor receives never carries registry rule sets; your own
sensors still get the rule sets your organization chose.

### How SAST runs

With platform v0.9.6 and sensor v0.22.1 or later:

- **Inline ignore comments do not hide results.** The sensor runs opengrep
  and semgrep with `--disable-nosem` and without reading `.semgrepignore`. A
  comment or ignore file in the scanned repository is the author's claim,
  not a decision: the result is reported, and the platform decides
  ([Known false positives](../user-guide/known-false-positives.md)).
  Dependencies, build output and test directories are still excluded by the
  sensor.
- **Taint traces.** The sensor runs with `--dataflow-traces`, so a taint
  result carries its path from source to sink
  ([Data-flow traces](data-flow-traces.md)).
- **Rule ids as written.** opengrep runs with `--no-rewrite-rule-ids`, so a
  rule id does not depend on where the rules are installed. The rule id is
  part of a finding's identity.
- **Engine-neutral findings.** A SAST finding is keyed on the rule, the file
  and the code it flags, not on the engine. Moving from semgrep to opengrep
  with the same rules keeps every finding and its triage.
