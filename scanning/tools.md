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
| naabu | `scan.ports` | T1 | default |
| httpx | `probe.http` | T1 | default |
| katana | `crawl.web` | T1 | default |
| nuclei | `vuln.templates`, finding re-verification and retests | T1 | default, `-nuclei` |
| semgrep | `sast.code` | T0 | `-semgrep` |
| trivy | `sca.deps`, `iac.misconfig`, `container.image` | T0 | `-trivy` |
| betterleaks | `secrets.code` | T0 | `-betterleaks` |

Other tools in the catalog (for example zap, codeql, grype, checkov) need a
sensor that ships them; see [Writing a tool](../developers/tool-authoring.md)
for packaging your own. For code scanning in CI, use
[CI integration](ci-integration.md) rather than a sensor.

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
- **Configuration overrides**: default options sent to sensors with every job
  of that tool. A configuration that looks like a credential is refused:
  credentials belong in the secret store, referenced by id.
- **Custom tools and categories**: an organization can add its own catalog
  entries (`POST /api/v1/tools`, `/api/v1/tool-categories`). A custom tool runs
  only on a sensor that reports it.

**Settings > Scanning > Capabilities** lists the capabilities and which of
your tools and sensors provide each.

## Nuclei safety

- The sensor's own templates are the managed nuclei-templates release, run
  with ProjectDiscovery's signature check (`-disable-unsigned-templates`).
- Every run excludes the tags `intrusive`, `default-login`, `dos`, `fuzz`,
  `fuzzing`, `bruteforce`, `brute-force`, `local` and `txt-service`. A scan
  that asks for one of them fails with the reason; flags that would re-admit
  them are refused.
- The code, file, headless and self-contained template types are never
  enabled.
- Rate limits are capped by the sensor (`SENSOR_NUCLEI_MAX_RATE_LIMIT`,
  default 150 requests per second).
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

**Settings > Scanning > Template sources** (`/api/v1/template-sources`) syncs
templates from a Git repository, an S3-compatible bucket or an HTTP URL;
**Source credentials** holds the credentials those sources need.

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
images the trivy database and semgrep rules) current itself and reports the
versions. **Settings > Scanning > Scanner content** sets the organization's
policy: refresh interval, maximum age per content, a pinned version, and the
semgrep rule sets. The policy never chooses where content comes from; that is
the sensor host's setting ([Network](../sensors/network.md#scanner-content-without-internet-access)).
Each result records the content version the scan used.
