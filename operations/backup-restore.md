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
| The secrets | `.env` (Compose), the env file (all-in-one), or the Kubernetes Secrets | `APP_ENCRYPTION_KEY` decrypts the credentials stored in the database (integration tokens, SMTP passwords, identity-provider secrets). A database backup without it restores everything except those credentials. `AUTH_JWT_SECRET` keeps sessions valid. `FINGERPRINT_KEY` keys the identity of every secret finding: after a restore with a different value, a secret seen again opens a second finding. |
| Attachments and the sensor CA | `api-data` volume (Compose), `/data` (all-in-one), the attachments volume or bucket (Helm) | Uploaded files, finding evidence, report templates and stored reports, and the sensor CA (`SENSOR_MTLS_CA_DIR`, `data/sensor-ca`) that signs sensor certificates. Not in the database. Without the sensor CA a new one is created and every sensor must be enrolled again. |
| Gateway data | `gateway-data` volume (Compose), `/data` (all-in-one) | The internal CA's private key (TLS mode `internal`) and ACME account. Without it a new CA is created and sensors stop trusting the gateway. |
| Job signer volumes | `signer-keys` and `signer-state` (Compose, with the job-signer overlay) | The key that signs sensor jobs and its sequence state. Losing `signer-state` lets sequence numbers repeat. |
| Bundled sensor identity | `sensor-data` volume (Compose, with `docker-compose.sensor.yml`) | The enrolled identity of the bundled sensor. `backup.sh` does not copy it: back it up like a credential, or enrol the sensor again after a loss. |
| Audit archives | The file storage provider, namespace `audit-archive` | Archived audit-log entries, which are deleted from the database after archiving. They are the only copy: back up the file storage like the database. |
| Administrators' audit copy | The destination of `ADMIN_AUDIT_SINK`, when it is a `file:///` path | The copy of the platform administrators' audit log kept outside the database. A copy sent to an `https` or `syslog+tls` receiver is the receiver's to back up. See [Audit logs](../security/audit-log.md). |

The platform console keeps no state of its own: its sessions, administrators and
settings are in the database, so the database backup covers it.

Feed files that sensors relayed to the platform (feed delivery mode relay, see
[Feeds](feeds.md)) are in the database table `feed_relay_files`. They are
downloaded again on the next round, so a backup may skip that table's data.

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
| `api-data.tar.gz` | The `api-data` volume: uploaded attachments, finding evidence and the sensor CA. |
| `gateway-data.tar.gz` | The `gateway-data` volume: certificates, the ACME account and the internal CA. |
| `signer-keys.tar.gz`, `signer-state.tar.gz` | The job-signer volumes, only when the signer overlay created them. |
| `env.tar.gz` | A copy of `.env`, with every secret. |
| `VERSION` | The `OPENCTEM_VERSION` of the stack that was backed up. |

Because a backup holds `.env`, and with it `APP_ENCRYPTION_KEY`, it is as
sensitive as the database plus every stored credential. Backups land on the same
host, so they protect against a bad upgrade or deleted data, not against losing
the host: copy the backup directory elsewhere.

### Encrypt the backups

Without a recipient the files are plain and the script warns on every run. Set
`BACKUP_AGE_RECIPIENT` to an [age](https://age-encryption.org) public key
(`age1...`) or to the path of a recipients file, and every file except `VERSION`
is written as `<name>.age`, encrypted as it is produced, so no plain copy reaches
the disk, even when a run fails. Keep the private key off the host. The `age`
command must be installed on the host. `verify` and `restore` need the identity
file: set `BACKUP_AGE_IDENTITY` to its path.

Settings, as environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `BACKUP_DIR` | `./backups` | Where backups are written. |
| `KEEP` | `14` | How many backups are kept; older ones are deleted after a successful run. |
| `BACKUP_AGE_RECIPIENT` | unset | The age public key or recipients file the backup is encrypted to. |
| `BACKUP_AGE_IDENTITY` | unset | The age identity file `verify` and `restore` decrypt with. |
| `BACKUP_STATUS_DIR` | `./backup-status` | Where the status file (`openctem_backup.prom`) is written. The API container mounts it read-only and the console's Health page shows the last backup from it. |
| `METRICS_TEXTFILE_DIR` | unset | A node-exporter textfile directory. When set, each run also writes `openctem_backup.prom` (`openctem_backup_last_exit_code`, `openctem_backup_last_success_timestamp_seconds`) there, which the `BackupStale` and `BackupFailed` alerts of the [monitoring stack](monitoring.md) read. |

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
readable. For an encrypted backup it needs `BACKUP_AGE_IDENTITY`. Run it at least monthly.

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

Without `--yes` it refuses. It stops `gateway`, `web`, `console` and `api` (so nobody signs in to the platform
console or the organization site while the database is replaced), restores the
database with `pg_restore --clean`, re-runs the `db-roles` job so the
least-privilege roles get their grants on the restored schema, replaces the
contents of the `api-data`, `gateway-data`, `signer-keys` and `signer-state` volumes
(those present in the backup), and starts the stack
again (migrations run first). It does not touch `.env`: unpack the backed-up
`env.tar.gz` (`tar -xzf`, after decrypting it) yourself if the secrets changed since
the backup.

Then check `docker compose ps`, `curl https://<host>/health`, sign in, and look
for `permission denied` errors in the API log.

### Restoring to a new host

1. Set up the stack as in [Docker Compose](../install/docker-compose.md), at the
   backup's `OPENCTEM_VERSION`, but put the `.env` from the backed-up `env.tar.gz` in place
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
`openctem_app`, then start the platform. If you run the console database role
(`DB_ADMIN_USER`), pass `admin_user` and `admin_password` to the script as well, or the
console tables (including `admin_approvals`, the four-eyes approvals) keep the
application role's grants. See the
[database roles guide](https://github.com/openctemio/openctem/blob/develop/api/docs/deployment/database-roles.md).

## Off-host backups and point-in-time recovery (Docker Compose)

The nightly `backup.sh` dump loses up to a day of data and stays on the host. The optional
overlay `docker-compose.backup.yml` adds [pgBackRest](https://pgbackrest.org) to the bundled
PostgreSQL: every finished WAL segment is archived, a full backup is taken weekly and a
differential one daily, all encrypted with AES-256 on the host before upload. The target is
S3-compatible storage, an SFTP host or a local path (`BACKUP_TARGET=s3`, `sftp` or `local`). It is
off by default, covers the database only (keep running `backup.sh` for the volumes and `.env`),
and enabling archiving restarts PostgreSQL once.

```bash
cd api/deploy
install -d -m 0700 backup-secrets
openssl rand -base64 32 | tr -d '\n' > backup-secrets/cipher_pass   # then copy it off this host
docker compose -f docker-compose.yml -f docker-compose.backup.yml up -d --build
```

The credentials are files under `backup-secrets/` (`cipher_pass` always; `s3_access_key` and
`s3_secret_key` for S3; `sftp_private_key` for SFTP), never environment variables. Losing
`cipher_pass` makes every backup unreadable. Retention is `BACKUP_RETENTION_FULL` (4) and
`BACKUP_RETENTION_DIFF` (7). The full guide, with the settings, the per-provider policies, restore
(`docker compose run --rm --no-deps backup restore --delta`) and the monthly drill, is
[backup-and-restore.md](https://github.com/openctemio/openctem/blob/develop/api/docs/deployment/backup-and-restore.md)
in the openctem repository.

## Point-in-time recovery (Ansible kit)

The nightly backup loses up to a day of data. The [Ansible kit](../install/ansible.md)
can also ship every finished WAL segment, encrypted, to an S3-compatible bucket, plus a
weekly base backup, and recover the database to a chosen time. It is **off by default**,
covers the database only (uploaded files and secrets stay in the nightly backup), and
needs a bucket and an access key that only you can provide. The full procedure is
[`docs/BACKUP-PITR.md`](https://github.com/openctemio/openctem-ansible/blob/main/docs/BACKUP-PITR.md)
in the kit.

| Variable | Default | Meaning |
|---|---|---|
| `openctem_wal_archive` | `false` | Turns archiving on (inventory). Postgres needs one restart for `archive_mode`. |
| `openctem_wal_archive_timeout` | `300` | Seconds after which a busy database closes a WAL segment. With the upload interval this bounds the loss: about 6 minutes. |
| `openctem_wal_spool_dir` | `/var/lib/openctem-wal-spool` | Where finished segments wait for upload (root only). |
| `backup_age_recipient` | empty | The age public key everything in the bucket is encrypted to. The private key stays off the host; losing it makes the archive unreadable. |
| `backup_wal_target` | `s3` | Where the archive goes: `s3` (any S3-compatible service) or `sftp` (another host). The remote in `backup_wal_remote_conf` must be of the same type. |
| `backup_wal_bucket` | empty | The bucket (`s3`) or the directory on the SFTP host (`sftp`). |
| `backup_wal_sftp_known_hosts`, `backup_wal_sftp_key` | in the secrets directory | `sftp` only: you place the pinned host key file and the private key on the server; the archive is never sent to an unverified host. |
| `backup_wal_require_append_only` | `true` | The play writes a probe object and tries to delete it, and stops when the delete works: the host's credential must not be able to delete. |
| `backup_wal_prune` | `false` | `true` lets the weekly base backup delete old backups and WAL from the host, which needs a credential that can delete. Default: the bucket's lifecycle rule prunes. |
| `backup_wal_prefix` | the project name | A path inside the bucket. |
| `backup_wal_remote_conf` | `/opt/openctem/secrets/backup_remote.conf` | rclone remote (`[openctem-backup]`, of type `s3` or `sftp`) with the access key. You place it on the server, owner root, mode `0400` or `0600`; it never goes in the inventory. |
| `backup_wal_retention_days` | `14` | Window in which you can recover to a time. Older base backups and WAL are deleted, except the newest base backup before the window. |
| `backup_basebackup_on_calendar` | `Sun *-*-* 02:30:00` | When the weekly base backup runs. |
| `backup_wal_ship_interval` | `1min` | How often segments are uploaded. |
| `monitoring_wal_lag_minutes` | `15` | The monitor alerts when the oldest segment waiting for upload is older than this. |
| `monitoring_wal_spool_max_mb` | `2048` | Alert when the spool is larger than this. |
| `monitoring_basebackup_max_age_days` | `8` | Alert when the newest base backup is older. |
| `monitoring_webhook_url` | empty | Where the monitor sends alerts; without it they only reach the journal. |

Turn it on in this order, so the spool never fills the disk without an uploader
(`$INV` is your inventory):

```bash
ansible-playbook -i $INV playbooks/55-backup.yml -K -e apply_backup=true -e openctem_wal_archive=true
ansible-playbook -i $INV playbooks/50-openctem.yml -K -e apply_openctem=true -e openctem_wal_archive=true
ansible-playbook -i $INV playbooks/55-backup.yml -K -e apply_backup=true -e openctem_wal_archive=true
```

Recover to a time just before the damage (UTC; `latest` replays the whole archive). Bring the
age identity file to the server for the duration only:

```bash
sudo openctem-restore --pitr "2026-10-18 14:02:00 UTC" /root/pitr.key --yes
sudo rm -f /root/pitr.key
```

The command recovers a throwaway Postgres without network first and replaces the live database
only with the recovered dump, so a failure before that point leaves the stack untouched. Data
written after the target is gone. If a release upgrade ran between the target and now, the
recovered schema is the older one: roll back the release or rerun the openctem play so the
migrations run again. Rehearse monthly with `sudo openctem-restore-drill --pitr latest
/root/drill.key`, which prints how long the recovery took.

Erased personal data stays in the bucket until it ages out of `backup_wal_retention_days`; say
so in your privacy policy.

#### Administrators' audit copy

With `openctem_admin_audit_sink: file` the kit writes the administrators' audit copy to
`openctem_admin_audit_sink_dir` (default `/opt/openctem/admin-audit`), and `openctem-backup`
archives that directory as `admin-audit.tar.gz`, so the copy leaves the host with the encrypted
backups. Restore it with `tar -xzf` into the directory. With an `https` sink, the HMAC key in
`/opt/openctem/secrets/admin_audit_sink_secret` is part of `secrets.tar.gz`.

## Rotating the encryption key

Rotating `APP_ENCRYPTION_KEY` re-encrypts the stored credentials with a tool
and keeps the old key in `APP_ENCRYPTION_KEY_PREVIOUS` during the change. Follow
[encryption-key-rotation.md](https://github.com/openctemio/openctem/blob/develop/api/docs/deployment/encryption-key-rotation.md),
and take a backup (with the old key) first.
