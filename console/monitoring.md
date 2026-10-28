---
title: Monitoring
parent: Platform console
nav_order: 5
---

# Console monitoring
{: .no_toc }

The **Monitoring** group of the [platform console](index.md): is the installation
healthy, and is it current. Both pages are read-only for every console role;
backup, restore and upgrade run from the deployment kit on the host
([Backup and restore](../operations/backup-restore.md),
[Upgrading](../operations/upgrade.md)).

1. TOC
{:toc}

---

## Health

**Health** (`/health`) shows the state of the installation as the API sees it, in
one page. It replaces the separate Health and System pages of v0.10 (their
addresses `/operations` and `/system` no longer exist).

![The Health page: Services, Storage, Backup, and Certificates, schema and version cards, then Work queues and Sensor fleet]({{ site.baseurl }}/assets/images/console/health.png)
*Figure: Monitoring, Health.*

| Card | Shows |
|---|---|
| **Services** | API build and version, PostgreSQL (pool use and latency), Redis, the web app and the gateway, connected sensors |
| **Storage** | Free space of each data volume (warning below 20% free, critical below 10%) and the database size |
| **Backup** | The last successful backup, its age (warning when older than 26 hours) and the last run |
| **Certificates, schema and version** | Expiry of the sensor CA and other certificates (warning within 30 days, critical within 7), the database schema against the version this release ships, and the state of the version check |
| **Work queues** | Sensor jobs waiting and running (and the oldest waiting), scan runs open and past their deadline, notifications waiting, retrying and given up |
| **Sensor fleet** | Platform and organization sensors online, how sensors connect (gRPC or HTTPS, with the reason code when they fall back to HTTPS) and the SDK versions in the field |
| **Background jobs** | Each background worker, its last run, its errors since start and its state |

A watcher checks free space, backup age and certificate expiry every
`SYSTEM_WATCH_INTERVAL` (default 5 minutes), sets the `openctem_system_*` metrics
and emails the platform administrators when a level gets worse (and posts to the
[alert webhook](settings.md#alerts) when one is set). The Overview's **Needs
attention** list shows the same problems.

What the page can see is set on the API:

| Variable | Effect | Unset |
|---|---|---|
| `SYSTEM_STORAGE_PATHS` | `name=path,...` directories whose free space is shown (names only, never paths) | the attachments directory and the sensor CA directory |
| `SYSTEM_BACKUP_STATUS_FILE` | the backup job's status file, mounted read-only | "No backup status is reported" |
| `SYSTEM_TLS_CERT_FILES` | `name=path,...` PEM certificates whose expiry is shown | only the sensor CA |
| `SYSTEM_WEB_HEALTH_URL`, `SYSTEM_GATEWAY_HEALTH_URL` | internal health URLs of the web app and the gateway (one GET, no redirects) | **Not configured** |

The Compose file (v0.15.5) already passes the web and gateway health URLs and the
backup status file to the API; `backup.sh` writes the status file to `BACKUP_STATUS_DIR`
(default `./backup-status`), mounted read-only. Set `SYSTEM_WEB_HEALTH_URL`,
`SYSTEM_GATEWAY_HEALTH_URL`, `SYSTEM_STORAGE_PATHS` or `SYSTEM_TLS_CERT_FILES` in `.env`
to change them. Other deployments (all-in-one, Kubernetes, binaries) pass none of them,
so Web and Gateway show **Not configured** and the backup is not reported until you set
them. Metrics and alert rules for the host monitoring:
[Monitoring](../operations/monitoring.md).

## Software updates

**Software updates** shows newer releases and security advisories for this
installation, from the signed release feed. Upgrading is always your action:
nothing is downloaded or installed automatically.

![The Software updates page: release checks are not active in this build, This instance with its running version and the daily online check switch, Sensors and SDK, and Import release information]({{ site.baseurl }}/assets/images/console/software-updates.png)
*Figure: Monitoring, Software updates on a build without a release feed key.*

- **This instance**: the running version, the latest release, where the
  information comes from (**Daily online check** or **Imported file**), until when
  it is valid, and the state (**Up to date**, **Update available**, **Security
  release available**). Advisories that affect the running version are listed with
  the version that fixes them, and a banner announces a security release.
- **Online check**: the daily download of the signed feed (one anonymous request;
  no instance ID, version or counts are sent). A super admin turns it on or off here
  with a confirmation, without a restart (audited `version_check.switched`).
  `VERSION_CHECK_ENABLED=false` on the server is a ceiling: the console cannot turn
  the check on.
- **Sensors and SDK**: the newest release of each first-party sensor product (the
  scanning sensor, the Tenable.sc connector) and of the sensor SDK. Organizations
  see them as "update available" and their install commands use them without an
  upgrade of this instance. Until the feed has been read, the versions this release
  was built with apply. How sensor versions are judged:
  [Versioning](../operations/versioning.md).
- **Import release information**: for an instance without internet access,
  download `openctem-releases.json` from the latest release on a connected machine
  and upload it here (JSON, up to 256 KiB). It is verified like the online check.

{: .note }
A build must pin a release feed key for the check and the import to work. Builds
that pin none say **Release checks are not active in this build**, and the Health
page shows **No release feed key in this build**; the versions built into the
release then apply. The API logs a warning once at start-up in that case.
