---
title: Operations
nav_order: 6
has_children: true
permalink: /operations/
---

# Operations

Running an OpenCTEM installation day to day: upgrades, backups, monitoring,
capacity and diagnosis. Installing is covered in [Install](../install/index.md),
settings in [Configuration](../configuration/index.md).

| Page | Covers |
|---|---|
| [Upgrading](upgrade.md) | The upgrade procedure for Compose, the all-in-one image and Helm, release-specific guides, rollback. |
| [Versioning and releases](versioning.md) | Version numbers, the release train, hotfixes, where changes are recorded, sensor and chart compatibility. |
| [Backup and restore](backup-restore.md) | What to back up (database, secrets, volumes) and tested backup and restore commands. |
| [Monitoring](monitoring.md) | Health endpoints, Prometheus metrics, the monitoring stack and alerts. |
| [Scaling](scaling.md) | What scales how, and the knobs that matter. |
| [Troubleshooting](troubleshooting.md) | Start-up failures, migrations, sign-in, refused requests, disk. |
| [Log reference](logs.md) | Where each component logs, log formats, request IDs, notable messages. |

## Routine checklist

| How often | Task |
|---|---|
| Daily | Check that backups ran and that alerts are being delivered. |
| Weekly | Review WARN and ERROR volume in the API log; check disk space and offline sensors. |
| Each release | Read the release notes; upgrade the platform, then sensors when the release asks for it. |
| Quarterly | Test a restore on a separate host; review platform administrators and the break-glass account. |
