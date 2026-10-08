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

Store backups off the host, encrypt them, and keep the secrets separate from
the database dumps. Test a restore regularly.

## Back up (Docker Compose)

Run these in `api/deploy`. The project is named `openctem`, so volumes are
called `openctem_<name>`.

```bash
mkdir -p backups
stamp=$(date +%Y%m%d-%H%M%S)

# Database: a consistent logical dump in custom format, taken as the
# PostgreSQL superuser inside the postgres container
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "backups/openctem-$stamp.dump"

# Attachments and gateway data
for v in api-data gateway-data; do
  docker run --rm -v "openctem_$v:/data:ro" -v "$PWD/backups:/backup" alpine:3.22 \
    tar czf "/backup/$v-$stamp.tgz" -C /data .
done

# Secrets
cp .env "backups/env-$stamp"
chmod 600 "backups/env-$stamp"
```

`pg_dump` runs while the platform is up. Check that a dump is readable:

```bash
docker run --rm -i postgres:17 pg_restore --list < "backups/openctem-$stamp.dump" | tail -3
```

To schedule it, put the commands in a script run by cron or a systemd timer.
The [monitoring stack](monitoring.md) can alert on stale backups if the script
reports its result (see the `BackupStale` runbook in the monitoring guide).

### Managed PostgreSQL and Kubernetes

Use your provider's snapshots or point-in-time recovery, or run `pg_dump -Fc`
against the database as a role that can read every table (the superuser or the
schema owner, `openctem_migrator`). Back up the attachments volume or bucket and
the Secrets that hold `APP_ENCRYPTION_KEY` and `AUTH_JWT_SECRET` the same way.

## Restore (Docker Compose)

Restore into the same release that made the backup, or an older backup into a
newer release (the migrations then bring the schema forward). Never restore a
newer dump into an older release.

```bash
# 1. Stop everything that uses the database
docker compose stop gateway web api

# 2. Recreate the database empty
docker compose exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'

# 3. Restore the dump (ownership and grants are repaired in step 4)
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' \
  < backups/openctem-20261008-020000.dump

# 4. Re-apply the least-privilege roles: schema owner and app grants
docker compose run --rm db-roles

# 5. Start again (migrations run first)
docker compose up -d
```

Restore the volumes before step 5 when needed:

```bash
docker run --rm -v openctem_api-data:/data -v "$PWD/backups:/backup:ro" alpine:3.22 \
  tar xzf /backup/api-data-20261008-020000.tgz -C /data
```

Then check `docker compose ps`, `curl https://<host>/health`, and that the API
log has no `permission denied` errors.

### Restoring to a new host

1. Set up the stack as in [Docker Compose](../install/docker-compose.md), but
   copy the backed-up `.env` instead of generating new secrets. A new
   `APP_ENCRYPTION_KEY` leaves the restored credentials unreadable.
2. Start only the database: `docker compose up -d postgres`.
3. Follow steps 2 to 5 above, restoring the `api-data` and `gateway-data`
   volumes before step 5.

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
