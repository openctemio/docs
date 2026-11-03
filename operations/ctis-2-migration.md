---
title: Migrating to CTIS 2.0
parent: Operations
nav_order: 1.5
---

# Migrating to CTIS 2.0
{: .no_toc }

CTIS, the CTEM Interchange Schema, moves from version 1.x to 2.0 in one step. This page is for
operators who run OpenCTEM and for integrators who send results to it. The format itself is
specified in [openctemio/ctis](https://github.com/openctemio/ctis); the receiver rules of OpenCTEM
are in its [receiver profile](https://github.com/openctemio/ctis/blob/main/docs/profiles/openctem.md).

1. TOC
{:toc}

---

## What changes

- The media type is `application/vnd.ctis+json; version=2.0` (the 1.x transport used an
  OpenCTEM-specific media type) and a CTIS file is named `*.ctis.json`.
- The Go module is `github.com/openctemio/ctis/v2`. The platform-sensor contracts (capabilities,
  tool settings, transfer bundles) moved to `github.com/openctemio/contract`.
- There is **no compatibility layer**. The platform accepts CTIS 2.x only and rejects every 1.x
  document with an error that tells the sender to upgrade. A 2.0 sender is not understood by an
  older platform either.
- A document no longer carries ids of the receiver. `metadata.id` is a UUIDv7 the producer
  generates, producer ids go in `source_refs`, and ids inside the document are local references.
- Asset types are fewer and canonical: `domain_name`, `web_origin`, `host`, `service`, `identity`,
  `ip_range` and `kubernetes_cluster` replace `domain`, `subdomain`, `website`, `http_service`,
  `open_port`, `server`, `iam_user` and the other 1.x types. A port is a `service` asset linked
  from its host by an `exposes` relationship.
- Findings are fingerprinted with recipe v2, and asset names are held in the canonical form of
  their type.

## Upgrade order

Producers and the platform move together. Do not run a 2.0 platform with 1.x producers, or the
other way round: results sent in the wrong format are refused until the other side is upgraded.

1. Read the release notes and take a backup (see [Backup and restore](backup-restore.md)).
2. Stop or pause the producers that cannot be upgraded in the same window (scheduled uploads,
   scripts that call the ingest API, a connector you did not upgrade). Sensors queue their results
   and send them after they are upgraded, but a queued 1.x report is refused.
3. Upgrade the platform to the release that carries the CTIS 2.0 switch, following
   [Upgrading](upgrade.md).
4. Upgrade, in the same window, every producer to its 2.0 release:
   - the sensors (and the bundled sensor of the platform),
   - `openctem-ci` (the CI integration and its image),
   - the Tenable connector (`connector-tenable`),
   - the asset collector.
5. Check that results arrive: the Sensors page shows the sensors online with recent results, and
   the API log shows no refused-document warnings (see [Log reference](logs.md)).

Minimum versions:

- sensor: v0.36.0
- connector-tenable: v0.2.0
- asset-collector: v0.3.0
- sdk-go (for your own collectors and tools): v0.46.0
- ai-worker: v0.1.0
- TODO: openctem-ci: the release that follows the platform switch (expected v0.4.0)
- TODO: platform release that carries the CTIS 2.0 switch: v?.?.?

## Data migration

The data migration runs automatically when the platform starts; there is nothing to run by hand.

- **Findings** are re-keyed to fingerprint recipe v2. The old fingerprints are kept as aliases, so
  triage decisions, comments, assignments and history carry over, and a finding that is reported
  again by a 2.0 producer updates the existing one instead of creating a second one.
- **Assets** get the canonical name of their type (for example a web origin is
  `scheme://host[:port]`).

Allow extra time on the first start for a large installation, and watch the migration job log
(see [Troubleshooting](troubleshooting.md)).

## Roll back

A schema or data migration of this size is not undone by running the previous release. To go
back:

1. Stop the platform and the sensors.
2. Restore the backup you took before the upgrade (see [Backup and restore](backup-restore.md)).
3. Start the **previous** versions of the platform and of the sensors, together. The sensors and
   other producers go back to their 1.x releases as well.

Do not roll back the platform alone: the previous platform refuses 2.0 documents, and a rolled-back
database no longer matches a 2.0 sensor.

## For integrators

If you wrote a program or a connector that sends CTIS, follow
[Migrating to CTIS 2.0](https://github.com/openctemio/ctis/blob/main/docs/migration-2.0.md) in the
ctis repository. It lists every renamed member and type, old to new. Then:

- send `Content-Type: application/vnd.ctis+json; version=2.0`,
- set `"version": "2.0"` and a UUIDv7 `metadata.id`,
- check each file with the `ctis` command before you send it:

```bash
go install github.com/openctemio/ctis/v2/cmd/ctis@v0.1.0
ctis validate report.ctis.json
```

See [Ingesting results](../api/ingest.md) for the upload and sensor-protocol rules. If your data
comes from SARIF, CycloneDX, SPDX, CSAF or OpenVEX, the adapters in
`github.com/openctemio/ctis/v2/interop/<format>` convert it for you
([interoperability layer](https://github.com/openctemio/ctis/blob/main/docs/interop.md)).
