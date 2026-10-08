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

`POST /api/v1/findings/import` takes a file exported by another security tool, converts it to
CTIS with the `ctis/importer` package, and ingests it with the uploader's rights. In the console
this is **Findings > Import results**.

Formats (detected from the content, not from the file name):

| Family | Formats |
|---|---|
| Vulnerability scanners | Nessus v2 XML (`.nessus`), Qualys host detection XML (with an optional KnowledgeBase file), vuls, nuclei JSON, ZAP (JSON and XML) |
| Code and dependencies | SARIF 2.1.0, semgrep, trivy, grype, osv-scanner |
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
| `?format=` | force the format of a single file |
| `?min_severity=` | drop findings below `info`, `low`, `medium`, `high` or `critical` |

```bash
# A preview first: parse and count, write nothing.
curl -X POST "https://openctem.example.com/api/v1/findings/import?dry_run=true" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "file=@scan-results.nessus"
```

The call writes data, so an API key cannot make it (keys are read-only): use the console, or a
session access token as above. It needs `findings:write`, `assets:write` and `assets:import`.

What to expect:

- The response has one entry per file: the detected format, counts (assets, findings by severity,
  components, VEX statements, skipped records), parse problems with line and column, and the
  `import_id` of the import record.
- Limits: 110 MiB request, 10 minutes, 6 imports per minute per organization. ZIP archives: at
  most 50 files, 100 MiB per file, 400 MiB in total, no nested archives or links.
- An import never auto-resolves findings that are absent from the file.
- A member with a restricted data scope only adds findings to assets in their scope and creates
  no new assets.
- VEX `not_affected` statements close matching findings only when the operator set
  `INGEST_VEX=enforce` and the uploader holds `findings:approve`; otherwise they are recorded and
  counted. Findings from pentests and other human sources are never closed by VEX.
- Every import is audit-logged (file names and counts, never content).

Other upload endpoints:

| Endpoint | Takes |
|---|---|
| `POST /api/v1/components/import` | an SBOM for the components inventory |
| `POST /api/v1/assets/import/csv` | assets from CSV |
| `POST /api/v1/pentest/campaigns/{id}/findings/import` | findings into a pentest campaign |

## Send CTIS over the sensor protocol

A custom collector or connector sends CTIS the way sensors do, on the sensor plane
(`/api/v2/sensor`), authenticated with a **sensor key**. Create the sensor in the console and pair
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
