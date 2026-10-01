# Upgrading: gitleaks → Betterleaks

Betterleaks replaces gitleaks as OpenCTEM's secret scanner. This page says
what changes, the order to upgrade in, and what you will see in your data.

## Why, and what Betterleaks is

[Betterleaks](https://github.com/betterleaks/betterleaks) is maintained by
the people who made gitleaks, including its original author (MIT licence). Its
**v1** line (OpenCTEM pins **1.9.0**) keeps gitleaks' interface:

| | gitleaks 8.30 | Betterleaks 1.9 |
|---|---|---|
| CLI | `dir`, `git`, `stdin`; `--report-format`, `--report-path`, `--config`, `--exit-code`, `--redact` | the same, plus `github`, `gitlab`, `huggingface`, `s3`, `validate` (`detect`/`protect` still run) |
| Config | `.gitleaks.toml`, `GITLEAKS_CONFIG` | `.betterleaks.toml` **or** `.gitleaks.toml`; `BETTERLEAKS_CONFIG` **or** `GITLEAKS_CONFIG` |
| Inline allow | `gitleaks:allow` | `betterleaks:allow` **or** `gitleaks:allow` |
| JSON report | array of `RuleID`, `File`, `StartLine`, `Secret`, `Match`, `Fingerprint`, ... | the same fields, plus `Attributes` (`confidence`, `path`, ...) |
| Native fingerprint | `file:rule:line` (`commit:file:rule:line` for git scans) | identical |
| Archives | off by default | scanned by default (depth 8) |
| Rule filters / validation | allowlists | Expr filters, opt-in live validation (`--validation`, off by default and not used by the sensor) |
| False positives | entropy | BPE token "rarity" filtering |

Betterleaks **v2** (release candidate) is not compatible: it wraps the JSON
report in an envelope, drops SARIF, CSV and JUnit, and drops the `GITLEAKS_*`
variables. The sensor refuses a v2 report with an explicit error rather than
reporting nothing. Keep v1.x until OpenCTEM supports v2.

Release assets are `betterleaks_<version>_<os>_<x64|arm64>.tar.gz` (and
`.zip` for Windows), with `checksums.txt` and its Sigstore bundle
`checksums.txt.sigstore.json`. The sensor images pin the SHA-256 of the
linux archives per architecture.

## What the platform does for you

**API migration 000241** (add-only, idempotent) moves everything that
configures or identifies the secret scanner to `betterleaks`:

- the tool registry: a new `betterleaks` tool. `gitleaks` stays, inactive, so
  scan history that points at it keeps its meaning. Tenant tool configs, rule
  sources, rules, overrides and bundles move to betterleaks;
- scans, scan profiles, scope schedules, pipeline steps, sensors' assigned
  tools, workflow trigger tool filters and suppression rules;
- scanner templates and template sources (`gitleaks` type → `betterleaks`;
  the TOML format is the same);
- **existing findings' `tool_name`.** Auto-resolve and suppression match the
  tool name exactly, and re-ingesting a finding never rewrites its tool name.
  Without this, a betterleaks scan would never auto-resolve a gitleaks-era
  finding. The fingerprint does not include the tool name, so it is
  unchanged and the next scan updates the same finding.

History is not rewritten: `scan_sessions`, `ingest_reports`,
`tool_executions` and `assets.discovery_tool` keep saying `gitleaks`.

**At ingest** the API maps a report whose tool is `gitleaks` (from a sensor
older than v0.4.0) to `betterleaks`. This is the platform's only mapping of
the old name (`pkg/domain/tool.CanonicalName`). It is applied where the name
enters: every ingest path (CTIS, SARIF, raw uploads, protocol v2), the
comparison of a report's tool with a sensor's tools, and new suppression
rules.

**In the sensor** (sdk-go `core.CanonicalScannerName`), a `gitleaks` scan
command, custom template, `-tool gitleaks` or `scanners: - name: gitleaks`
runs betterleaks.

## Upgrade order

1. **sdk-go** release with the betterleaks scanner (needed by the sensor).
2. **API + UI together**, with migration 000241. The UI reads the new
   template quota fields (`betterleaks_templates`,
   `max_templates_betterleaks`).
3. **Sensor** release with betterleaks (images `-default`, `-ci` and
   `-betterleaks`). Upgrade **every** sensor. Then move Helm
   `sensor.image.tag` to that release.

Between steps 2 and 3, old sensors still send results and those results are
accepted. But a scan the platform dispatches is now a `betterleaks` scan, and
a v0.3.0 sensor fails it with `scanner not found: betterleaks`. Plan step 3
right after step 2.

`-gitleaks` images are no longer published. Existing `-gitleaks` tags stay
pullable but no longer update; use `-betterleaks`.

## What you will see after the switch

The platform was verified end to end: findings from a gitleaks run, then
migration 000241, then betterleaks runs, then the old sensor again.

- **No duplicates.** A secret both tools report keeps its finding (same ID,
  updated in place).
- **New findings** for secrets inside archives (`.zip`, `.tar.gz`, ...),
  which gitleaks skipped by default. Paths look like
  `vendor/bundle.zip!deploy.env`.
- **Some gitleaks-only findings are auto-resolved** by the first full
  betterleaks scan, because the rule sets differ. For example, gitleaks
  reported an AWS secret access key on its own as `generic-api-key`;
  betterleaks reports it only as part of the `aws-access-token` finding for
  the key pair. To review them:

  ```sql
  SELECT f.id, f.rule_id, f.file_path, f.resolved_at
  FROM findings f
  WHERE f.tool_name = 'betterleaks' AND f.status = 'resolved'
    AND f.resolved_at > '<time of the first betterleaks scan>'
    AND f.rule_id NOT IN (SELECT DISTINCT rule_id FROM findings
                          WHERE tool_name = 'betterleaks' AND created_at > '<same time>');
  ```

- **Do not run gitleaks and betterleaks sensors on the same repository.**
  Each one resolves and reopens the other's rule-set differences.

### Rolling deploys

If an API pod of the previous release ingests a new gitleaks finding after
the migration ran and before the pod is replaced, that one row keeps
`tool_name = 'gitleaks'`. Re-running the migration's statement fixes it
(it is idempotent):

```sql
UPDATE findings SET tool_name = 'betterleaks' WHERE lower(tool_name) = 'gitleaks';
```

## Rollback

`migrate down 1` (000241's down migration) moves every reference back to
gitleaks, including findings first reported by betterleaks, and removes the
`betterleaks` tool row. Roll the sensors and the UI back with it.

## Repository CI

The OpenCTEM repositories' own secret scans (Security workflow, pre-commit,
`make`) use Betterleaks 1.9.0, pinned and checksum-verified. They upload SARIF
under the code-scanning category `betterleaks`. Alerts left in the old
`gitleaks` category can be dismissed.
