---
title: Backup and restore
parent: Operations
nav_order: 4
---

# Backup and restore
{: .no_toc }

1. TOC
{:toc}

---

## What to back up

| What | Where | Why |
|---|---|---|
| The database | PostgreSQL database `openctem` (`DB_NAME`) | Everything: organizations, users, assets, findings, scans, audit logs, integrations. |
| The secrets | `.env` (Compose), the env file (all-in-one), or the Kubernetes Secrets | `APP_ENCRYPTION_KEY` decrypts the credentials stored in the database (integration tokens, SMTP passwords, identity-provider secrets). A database backup without it restores everything except those credentials. `AUTH_JWT_SECRET` keeps sessions valid. |
| Attachments | `api-data` volume (Compose), `/data` (all-in-one), the attachments volume or bucket (Helm) | Uploaded files and finding evidence. Not in the database. |
| Gateway data | `gateway-data` volume (Compose), `/data` (all-in-one) | The internal CA's private key (TLS mode `internal`) and ACME account. Without it a new CA is created and sensors stop trusting the gateway. |
| Audit archives | `AUDIT_ARCHIVE_DIR`, when set | Archived audit-log entries, which are deleted from the database after archiving. |

Redis holds caches, rate-limit counters and queued background jobs. It does not
need a backup; restarting with an empty Redis loses only queued work.

Store backups off the host and encrypted, and test a restore regularly. Where
you can, keep the secrets separate from the database dumps: a dump together with
`APP_ENCRYPTION_KEY` gives back every stored credential.

## Back up (Docker Compose)

`api/deploy/backup.sh` backs up a running Compose stack. Run it in
`api/deploy` of your checkout:

```bash
./backup.sh            # back up now
./backup.sh verify     # prove the newest backup restores
```

Each run writes one directory, `backups/<UTC time>/` (directory mode `0700`,
files `0600`):

| File | Holds |
|---|---|
| `openctem.dump` | `pg_dump -Fc` of the database, taken while the platform runs and checked with `pg_restore --list`. |
| `api-data.tar.gz` | The `api-data` volume: uploaded attachments and finding evidence. |
| `gateway-data.tar.gz` | The `gateway-data` volume: certificates, the ACME account and the internal CA. |
| `env` | A copy of `.env`, with every secret. |
| `VERSION` | The `OPENCTEM_VERSION` of the stack that was backed up. |

Because a backup holds `.env`, and with it `APP_ENCRYPTION_KEY`, it is as
sensitive as the database plus every stored credential. Backups land on the same
host, so they protect against a bad upgrade or deleted data, not against losing
the host: copy the backup directory elsewhere, encrypted (for example with `age`
or your backup tool's encryption).

Settings, as environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `BACKUP_DIR` | `./backups` | Where backups are written. |
| `KEEP` | `14` | How many backups are kept; older ones are deleted after a successful run. |
| `METRICS_TEXTFILE_DIR` | unset | A node-exporter textfile directory. When set, each run writes `openctem_backup.prom` (`openctem_backup_last_exit_code`, `openctem_backup_last_success_timestamp_seconds`), which the `BackupStale` and `BackupFailed` alerts of the [monitoring stack](monitoring.md) read. |

`COMPOSE_FILE` and `COMPOSE_PROJECT_NAME` work as for `docker compose`. Schedule a
daily run with cron or a systemd timer, for example:

```bash
# /etc/cron.d/openctem-backup
15 2 * * * root METRICS_TEXTFILE_DIR=/var/lib/node_exporter/textfile /opt/openctem/api/deploy/backup.sh >> /var/log/openctem-backup.log 2>&1
```

`./backup.sh verify [<dir>]` restores the newest backup (or the one given) into
a throwaway PostgreSQL container with no network, compares the row count of
every table with the running database (rows written since the backup show as
differences, which is expected), and checks that the volume archives are
readable. Run it at least monthly.

### Managed PostgreSQL and Kubernetes

Use your provider's snapshots or point-in-time recovery, or run `pg_dump -Fc`
against the database as a role that can read every table (the superuser or the
schema owner, `openctem_migrator`). Back up the attachments volume or bucket and
the Secrets that hold `APP_ENCRYPTION_KEY` and `AUTH_JWT_SECRET` the same way.

## Restore (Docker Compose)

Restore into the same release that made the backup, or an older backup into a
newer release (the migrations then bring the schema forward). Never restore a
newer dump into an older release. `restore` warns when the backup's `VERSION`
differs from the running `OPENCTEM_VERSION`.

```bash
./backup.sh restore backups/20261008T021500Z --yes
```

Without `--yes` it refuses. It stops `gateway`, `web` and `api`, restores the
database with `pg_restore --clean`, re-runs the `db-roles` job so the
least-privilege roles get their grants on the restored schema, replaces the
contents of the `api-data` and `gateway-data` volumes, and starts the stack
again (migrations run first). It does not touch `.env`: put the backed-up `env`
file back yourself if the secrets changed since the backup.

Then check `docker compose ps`, `curl https://<host>/health`, sign in, and look
for `permission denied` errors in the API log.

### Restoring to a new host

1. Set up the stack as in [Docker Compose](../install/docker-compose.md), at the
   backup's `OPENCTEM_VERSION`, but copy the backed-up `env` file to `.env`
   instead of generating new secrets. A new `APP_ENCRYPTION_KEY` leaves the
   restored credentials unreadable.
2. Start it once (`docker compose up -d`) so the volumes and the database exist.
3. Copy the backup directory to the new host and run
   `./backup.sh restore <dir> --yes`.

### Outside Compose

The same order applies to any PostgreSQL: restore as a superuser into an empty
database with `--no-owner --no-privileges`, then run
[`least-privilege-roles.sql`](https://github.com/openctemio/openctem/blob/develop/api/deploy/postgres/least-privilege-roles.sql)
again to give the schema to `openctem_migrator` and the grants to
`openctem_app`, then start the platform.

## Rotating the encryption key

Rotating `APP_ENCRYPTION_KEY` re-encrypts the stored credentials with a tool
and keeps the old key in `APP_ENCRYPTION_KEY_PREVIOUS` during the change. Follow
[encryption-key-rotation.md](https://github.com/openctemio/openctem/blob/develop/api/docs/deployment/encryption-key-rotation.md),
and take a backup (with the old key) first.
