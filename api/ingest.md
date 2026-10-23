---
title: Ingesting results (CTIS)
parent: API
nav_order: 5
---

# Ingesting results (CTIS)

Assets, findings and dependencies enter OpenCTEM in one format, **CTIS** (the CTEM Ingest
Schema). There are four ways to get results in:

| Way | Who sends | Credential | Use it when |
|---|---|---|---|
| A sensor runs the scan | the sensor | sensor key | you scan with OpenCTEM (built-in or [custom tools](../developers/tool-authoring.md)) |
| A CI job | `openctem-ci` | the CI system's OIDC identity | you scan in pipelines; see [CI integration](../scanning/ci-integration.md) |
| Upload a report another tool exported | a person in the console, or a session | session | you already have Nessus, Qualys, SARIF, trivy, ... output |
| Send CTIS directly over the sensor protocol | your own program | sensor key | you write a custom collector or connector |

All of them end in the same ingest pipeline: CTIS validation, asset identity resolution,
fingerprinting and deduplication, then priority classification.

## The CTIS format

CTIS is specified in the [openctemio/ctis](https://github.com/openctemio/ctis) repository:

- the normative specification, [docs/spec.md](https://github.com/openctemio/ctis/blob/main/docs/spec.md);
- the JSON Schemas, [schemas/v1](https://github.com/openctemio/ctis/tree/main/schemas/v1);
- worked examples, [examples/](https://github.com/openctemio/ctis/tree/main/examples);
- Go types (`github.com/openctemio/ctis`), with `Report.Validate()`.

A minimal report:

```json
{
  "version": "1.6",
  "metadata": { "timestamp": "2026-10-08T09:30:00Z" },
  "tool": { "name": "acme-scanner", "version": "1.2.0" },
  "assets": [
    { "id": "a1", "type": "domain", "value": "app.example.com" }
  ],
  "findings": [
    {
      "type": "misconfiguration",
      "title": "Service is served over plaintext HTTP",
      "severity": "medium",
      "asset_ref": "a1",
      "rule_id": "http-plaintext"
    }
  ]
}
```

Rules that matter in practice:

- `version` is `MAJOR.MINOR`. The receiver decodes **strictly**: an unknown member, or an enum
  value it does not know, is refused, not dropped. Do not send members newer than the CTIS
  version your OpenCTEM release understands; upgrade the platform before the producers.
- Producer-specific data goes in `properties`, the only free-form bags.
- `finding.asset_ref` must name an `assets[].id` of the same report (or give `asset_value` and
  `asset_type`).
- `severity` is `critical`, `high`, `medium`, `low` or `info`. A `status` you send is treated as a
  hint; OpenCTEM manages the finding lifecycle itself.
- Do not set `criticality` from a scanner: it is business context owned by the asset owner.

## Upload a report another tool exported

`POST /api/v1/findings/imports` takes a file exported by another security tool, converts it to
CTIS with the `ctis/importer` package, and ingests it with the uploader's rights. In the console
this is **Findings > Import results**.

Formats (detected from the content, not from the file name):

| Family | Formats |
|---|---|
| Vulnerability scanners | Nessus v2 XML (`.nessus`), Qualys host detection XML (with an optional KnowledgeBase file), vuls, nuclei JSON, ZAP (JSON and XML) |
| Code and dependencies | SARIF 2.1.0, semgrep, opengrep, trivy, grype, osv-scanner |
| Secrets | gitleaks, betterleaks |
| SBOM and advisories | CycloneDX (SBOM, VDR, VEX), SPDX, CSAF 2.0, OpenVEX |
| Other platforms | DefectDojo Generic Findings JSON |

The mapping of each format is documented in
[ctis docs/importers](https://github.com/openctemio/ctis/tree/main/docs/importers). The response
lists the formats your server supports as `supported_formats`.

Request (`multipart/form-data`):

| Part or query | Meaning |
|---|---|
| `file` (up to 10) | an exported file, or a ZIP of them |
| `knowledge_base` | the Qualys KnowledgeBase XML; send it **before** `file` |
| `?dry_run=true` | parse and count only; nothing is written |
| `?format=` | force the format of a single file, or `mapping:<name>[@<version>]` (or `mapping:<id>`) to read the file through a saved import mapping; always partial coverage, unknown mapping answers `400 unknown_mapping` (see [Import with a mapping](../user-guide/import-mappings.md)) |
| `?min_severity=` | drop findings below `info`, `low`, `medium`, `high` or `critical` |
| `?coverage=full&asset_id=…` | the file is a complete scan of these assets (1 to 100) by its tool: their open findings of that tool that the file does not report are closed (needs `findings:status`, see below) |
| `Idempotency-Key` header | 1 to 128 printable ASCII characters: a retry of the same upload returns the first answer instead of importing again |

```bash
# A preview first: parse and count, write nothing.
curl -X POST "https://openctem.example.com/api/v1/findings/imports?dry_run=true" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "file=@scan-results.nessus"
```

The call writes data, so an API key cannot make it (keys are read-only): use the console, or a
session access token as above. It needs `findings:write`, `assets:write` and `assets:import`.

What to expect:

- An import is **applied in the background**. It answers `202` with the receipt's id (receipt
  `status: queued`) and `Location: /api/v1/findings/imports/{id}`; the ingest worker then applies
  the files and finishes the receipt. Read the outcome with
  `GET /api/v1/findings/imports/{id}/result?wait=10` (`findings:read`, visible to the same people as
  the receipt): it waits up to 10 seconds, then answers `queued`, `processing`, `applied` or
  `failed`. `applied` carries the receipt counts (`created`, `updated` = still detected,
  `reactivated`, `closed`, `untouched`, `skipped`, `failed`) and one entry per file; `failed` carries
  a fixed `error_code`, never text from your file. A preview (`dry_run=true`) still answers `200`
  in the request and has no receipt.
- The per-file entry holds the detected format, counts (assets, findings by severity, components,
  VEX statements, skipped records) and parse problems with line and column.
- The files are stored encrypted for your organization until they are applied, then deleted
  (kept 7 days after a failure so it can be investigated); they are never served back.
- Back-pressure: an organization with too many unfinished ingest jobs
  (`INGEST_MAX_PENDING_PER_TENANT`) gets `429` with code `INGEST_QUEUE_FULL` and a `Retry-After`
  computed from how fast its jobs drain; send the same upload again after that many seconds. If
  the server cannot read the queue depth it answers `503` with `Retry-After` and stores nothing.
  A refused import leaves no receipt.
- Limits: 110 MiB request, 10 minutes, 6 imports per minute per organization. ZIP archives: at
  most 50 files, 100 MiB per file, 400 MiB in total, no nested archives or links.
- By default an import never closes findings that are absent from the file. Only an upload that
  declares `coverage=full` for explicit `asset_id` values closes the open findings of its tool on
  those assets that it did not report. That needs `findings:status`, every asset must be in your
  data scope, and nothing closes if a file failed. Findings from pentests and other human sources
  and leaked secrets are never closed this way, and a close of too large a share of the open
  findings is held.
- Without an `Idempotency-Key`, the same files sent again by the same caller within 10 minutes
  are the same import: you get the first receipt, not a second import.
- With `Idempotency-Key`, a retry of the same files returns the first answer and receipt
  (`Idempotent-Replayed: true`); the same key with other files is refused (422), a key still in
  use answers 409, and if the server cannot check the key it refuses the upload (503) without
  importing anything. Keys are kept 24 hours, per user or API key.
- Files are applied with the rights the uploader had when the file was sent, read again when the
  worker runs: a narrowed data scope applies, and an uploader who lost access meanwhile has the
  import refused (`failed`).
- A member with a restricted data scope only adds findings to assets in their scope and creates
  no new assets.
- VEX `not_affected` statements never set a status on their own. `INGEST_VEX` (default `dry_run`)
  decides: `off` stores them, `dry_run` also counts what would happen, and `enforce` files a pending
  false-positive request (actor `vex`, with the statement's justification) that a person with
  `findings:approve` decides, like any other false positive. Findings from pentests and other human
  sources are not affected.
- Every import is audit-logged (file names and counts, never content).

### Receipts

Every upload and every sensor run (a scan run, a CI run, a connector sync) gets a receipt:

| Endpoint | Returns |
|---|---|
| `GET /api/v1/findings/imports` | receipts, newest first; filters `source_kind` (`upload`, `scan_run`, `command`, `ci_run`, `connector`, `sensor`) and `source_ref`; `per_page` at most 100; an unknown parameter is refused with 400 |
| `GET /api/v1/findings/imports/{id}` | one receipt, with its actions counted by severity |
| `GET /api/v1/findings/imports/{id}/result` | the outcome of an upload: `?wait=` (up to 10 seconds) holds the request until it is `applied` or `failed` |
| `GET /api/v1/findings/imports/{id}/actions` | the findings it created, saw again, reopened, closed or suppressed (filter `disposition=`) |
| `GET /api/v1/findings/imports/{id}/items` | the reported items that did not become findings (filter `disposition=`) |
| `GET /api/v1/findings/{id}/imports` | the uploads and runs that acted on one finding |

#### Dispositions

Every reported item ends in one disposition on the receipt:

| Disposition | Meaning | Listed by |
|---|---|---|
| `created` | a new finding | `/actions` |
| `still_detected` | an open finding seen again | `/actions` |
| `reopened` | a closed finding that came back | `/actions` |
| `closed` | a finding the upload closed (full coverage only) | `/actions` |
| `suppressed` | a new finding a suppression rule suppressed; the entry names the rule and the **policy version** that decided it (`policy`, `policy_id`, `policy_version`) | `/actions` |
| `out_of_scope` | an item dropped by a scope exclusion, or because it is outside the uploader's data scope | `/items` |
| `rejected` | an item with no target asset | `/items` |
| `quarantined` | an item a sensor report held for review | `/items` |
| `filtered`, `held` | reserved (ingest filters, review gate); not produced yet | |

A suppressed new finding counts as suppressed only, no longer also as created. An item that did
not become a finding has a fixed reason code, the deciding policy and its version, an identity
hash, the asset, tool, title (up to 200 characters) and severity. No evidence is kept for it.
The receipt detail counts items per disposition. Suppression rules and scope exclusions are
applied from a snapshot that is versioned by every change to them; if the snapshot cannot be
loaded the ingest fails and is retried, it never runs with suppression switched off.

They need `findings:read`. Receipt counts cover the whole organization, so only members who see
the whole organization (or hold `dashboards:org:view`) read other people's receipts; everyone
else sees the uploads they made. The per-finding lists only show findings you can see. In
`/items`, items on assets outside your data scope are hidden, and items without an asset are
shown only to members who see the whole organization.

Other upload endpoints:

| Endpoint | Takes |
|---|---|
| `POST /api/v1/components/import` | an SBOM for the components inventory (`components:write`) |
| `POST /api/v1/assets/import/csv` | assets from CSV (`assets:write` and `assets:import`) |
| `POST /api/v1/pentest/campaigns/{id}/findings/import` | findings into a pentest campaign |
| `POST /api/v1/ci/runs/{id}/results` | a CI run's results: CTIS, or a tool's output file in any importer format (or a ZIP), filed on the run's repository; used by `openctem-ci` with the run token. Answers `202` (see below) |

### CI results are applied in the background

`POST /api/v1/ci/runs/{id}/results` stores the report and answers `202` with an `upload_id` and
`Location: /api/v1/ci/runs/{id}/results/{report_id}`. Before it stores anything it decodes the
report and checks that it names only the run's repository. The ingest worker applies it, and
the result is read with the run token:

```
GET /api/v1/ci/runs/{id}/results/{report_id}?wait=10
```

`wait` holds the request up to 10 seconds. The answer is `queued`, `processing`, `applied`
(the counts and the `known` list of results already decided) or `failed` with a fixed
`error_code`. A `dry_run` is not a CI upload. The same body sent twice to one run is one upload,
and an `Idempotency-Key` is kept 24 hours (`503` when the key store cannot be read).

Accepting is refused with `429 INGEST_QUEUE_FULL` and `Retry-After` when the organization's queue
is full, as for imports. The gate (`POST /api/v1/ci/runs/{id}/evaluate`) waits up to 10 seconds
for the run's uploads, then answers `503 INGEST_PENDING` with `Retry-After`; a verdict is never
saved while an upload of the run is pending. An upload that could not be applied fails the run
with `upload_not_applied`. See [CI reference](../scanning/ci-reference.md#platform-api).

### Sensor reports

A sensor report is applied by the same worker, from the same queue, as the lowest-priority lane.
Reports held in the sensor results **quarantine** are marked accepted only after they have been
applied: while an accept is applying, a second accept or a discard of the same item answers `409`;
if applying fails the item stays pending and can be accepted again.

### How the queue is shared

Jobs have a lane: urgent (a CI report that has a critical finding or a CVE in the known-exploited
catalog, decided by the server from the report), interactive (imports and other CI uploads) and
bulk (sensor reports). Urgent work goes first, and within a lane the organization with fewer jobs
running goes first. An organization's urgent lane goes ahead of others for one job at a time; its
further urgent jobs wait as interactive, so a report full of critical findings cannot take every
worker.
Only one job per repository (CI), per organization (imports) or per sensor report runs at a time.
Finished jobs and stored files are deleted by an hourly retention job (finished jobs after 30
days). Operators tune it with `INGEST_WORKERS`, `INGEST_MAX_RUNNING_PER_TENANT`,
`INGEST_MAX_PENDING_PER_TENANT` and `DB_INGEST_MAX_CONNS`
([Environment variables](../configuration/environment-variables.md)).

## Send CTIS over the sensor protocol

A custom collector or connector sends CTIS the way sensors do, on the sensor plane
(`/api/v2/sensor`), authenticated with a **sensor key**. The same sensor key is used on the
platform's sensor transport v3 (`/api/v3/sensor`, gRPC with mutual TLS on the API's sensor
listener), see [Transport](../sensors/transport.md). Create the sensor in the console and pair
it or enroll it (see [Pairing and enrollment](../sensors/pairing.md)). The easiest client is the
Go SDK (`github.com/openctemio/sdk-go`, `pkg/sensorkit` and `pkg/client`), which handles
compression, digests, segmentation, retries and request signing. The wire rules, for any
language:

```
PUT /api/v2/sensor/results/{report_id}
Authorization: Bearer octs_...
Content-Type: application/vnd.openctem.ctis.v1+json
Content-Encoding: gzip                 (optional: gzip or zstd)
Content-Digest: sha-256=:<base64 SHA-256 of the body as sent>:
Content-Length: <bytes>
```

- `report_id` is a lowercase UUID **you** choose. It is the idempotency key: sending the same
  report again is answered as a replay, not ingested twice.
- `Content-Digest` (RFC 9530) covers the bytes on the wire, compressed if you compress.
- The answer is `202` with a status document. Poll `GET /api/v2/sensor/results/{report_id}`
  (honour `Retry-After`) until `state` is `completed` or `failed`; the status counts accepted,
  rejected and quarantined records and lists item errors.
- A report too large for one request is sent in segments
  (`PUT .../results/{report_id}/segments/{seq}`, each a complete CTIS document) and closed with
  `POST .../results/{report_id}/commit` (`segment_count`, `segment_digests`).
- `GET /api/v2/sensor/hello` returns the protocol level, features and size limits of the server.
- Errors are RFC 9457 problem documents. Session tokens and `oct_` keys are refused (`401`).
- If the organization requires key-bound sensor identity, bearer sensor keys are disabled and
  requests must be signed (RFC 9421); use the SDK.

```bash
REPORT_ID=$(python3 -c 'import uuid; print(uuid.uuid4())')
DIGEST="sha-256=:$(openssl dgst -sha256 -binary report.json | base64):"
curl -X PUT "https://openctem.example.com/api/v2/sensor/results/$REPORT_ID" \
  -H "Authorization: Bearer $OPENCTEM_SENSOR_KEY" \
  -H "Content-Type: application/vnd.openctem.ctis.v1+json" \
  -H "Content-Digest: $DIGEST" \
  --data-binary @report.json

curl -H "Authorization: Bearer $OPENCTEM_SENSOR_KEY" \
  "https://openctem.example.com/api/v2/sensor/results/$REPORT_ID"
```

The protocol, including the limits, is specified in
[sensor-protocol-v2.yaml](https://github.com/openctemio/openctem/blob/develop/api/api/openapi/sensor-protocol-v2.yaml)
and RFC-026.

## What happens to the data

- **Tenant from the credential.** The organization is taken from the sensor key or session, never
  from the report.
- **Identity and deduplication.** Asset values are normalized (lower-case DNS names, canonical IP
  form, repository URLs without scheme and `.git`); findings are fingerprinted, so the same finding
  reported again updates the existing one.
- **Untrusted input.** Report text is treated as hostile: sizes are capped, control characters are
  removed, and secrets in evidence are masked.
