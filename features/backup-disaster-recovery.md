---
layout: default
title: Backup & Disaster Recovery
parent: Features
nav_order: 20
permalink: /features/backup-disaster-recovery/
---

# Backup & Disaster Recovery

OpenCTEM provides automated database backup with tiered retention, integrity verification, off-site cloud storage, and point-in-time recovery (PITR) via WAL archiving.

---

## Overview

The backup system is built around PostgreSQL `pg_dump` with a layered retention strategy. Backups run on a cron schedule and are automatically rotated across daily, weekly, and monthly tiers. Optional off-site replication to cloud storage provides disaster recovery for infrastructure-level failures.

**Recovery targets:**

| Metric | Target | How |
|--------|--------|-----|
| **RPO** (Recovery Point Objective) | < 24 hours (daily backups), < 5 minutes (with WAL archiving) | Scheduled `pg_dump` + continuous WAL archiving |
| **RTO** (Recovery Time Objective) | < 1 hour for full restore, < 2 hours for PITR | `pg_restore` from custom-format dump or WAL replay |

---

## Backup Types

### Full Backup (recommended)

Uses `pg_dump --format=custom` to produce a compressed, seekable binary dump. This is the default and supports selective restore of individual tables.

```bash
./setup/backup/backup.sh --type full
```

Output: `openctem_full_<timestamp>.dump`

### Schema-Only Backup

Exports the database schema (DDL) without data. Useful for version tracking, auditing schema drift, or bootstrapping empty environments.

```bash
./setup/backup/backup.sh --type schema
```

Output: `openctem_schema_<timestamp>.sql.<ext>` (compressed with your chosen method)

---

## Retention Policy

Backups are organized into three tiers with automatic cleanup:

| Tier | Schedule | Default Retention | Directory |
|------|----------|-------------------|-----------|
| **Daily** | Every backup run | 30 days | `/var/backups/openctem/daily/` |
| **Weekly** | Sundays (auto-promoted) | 12 weeks (84 days) | `/var/backups/openctem/weekly/` |
| **Monthly** | 1st of month (auto-promoted) | 12 months (~372 days) | `/var/backups/openctem/monthly/` |

Sunday and first-of-month backups are automatically copied to the weekly and monthly directories. Expired backups are deleted during each run.

Retention periods are configurable via environment variables:

```bash
RETENTION_DAYS=30        # Daily tier
RETENTION_WEEKLY=12      # Weekly tier (in weeks)
RETENTION_MONTHLY=12     # Monthly tier (in months)
```

---

## Compression

Schema-only backups support three compression methods. Full backups use PostgreSQL's built-in custom-format compression.

| Method | Env Value | Extension | Trade-off |
|--------|-----------|-----------|-----------|
| **gzip** (default) | `COMPRESSION=gzip` | `.gz` | Best compatibility, moderate speed |
| **lz4** | `COMPRESSION=lz4` | `.lz4` | Fastest compression/decompression |
| **zstd** | `COMPRESSION=zstd` | `.zst` | Best compression ratio, good speed |

For large databases, `zstd` provides significantly smaller backup files at comparable speed to gzip.

---

## Integrity Verification

Every backup produces a SHA-256 checksum file alongside it:

```
openctem_full_20260311_020000.dump
openctem_full_20260311_020000.dump.sha256
```

To verify a backup's integrity:

```bash
cd /var/backups/openctem/daily/
sha256sum -c openctem_full_20260311_020000.dump.sha256
```

Checksums are also uploaded alongside backups when off-site storage is enabled, so you can verify downloads before restoring.

---

## Off-site Storage

Off-site replication uploads backups to cloud object storage for disaster recovery. Three providers are supported.

### Enable Off-site Backup

Add to `/etc/openctem/backup.env`:

```bash
OFFSITE_ENABLED=true
OFFSITE_PROVIDER=s3            # s3 | gcs | azure
OFFSITE_BUCKET=my-backup-bucket
OFFSITE_PREFIX=openctem/backups
OFFSITE_RETENTION_DAYS=90
```

### Provider Configuration

**AWS S3** (including S3-compatible services like MinIO):

```bash
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=us-east-1
S3_ENDPOINT=https://minio.example.com   # optional, for S3-compatible
```

Requires: `awscli` package installed.

**Google Cloud Storage:**

```bash
GOOGLE_APPLICATION_CREDENTIALS=/etc/openctem/gcs-service-account.json
```

Requires: `google-cloud-cli` package installed.

**Azure Blob Storage:**

```bash
AZURE_STORAGE_ACCOUNT=mystorageaccount
AZURE_STORAGE_KEY=...
```

Requires: `azure-cli` package installed.

### Upload Behavior

- Credentials are validated before any upload attempt (pre-flight check).
- Each upload retries up to 3 times with a 5-second delay between attempts.
- Daily backups and checksums are always uploaded.
- Weekly and monthly tiers are uploaded on Sundays and the 1st of each month, respectively.
- Off-site daily backups older than `OFFSITE_RETENTION_DAYS` (default 90) are automatically cleaned up.

### Verify Off-site Backups

```bash
# S3
aws s3 ls s3://my-backup-bucket/openctem/backups/daily/ --human-readable

# GCS
gsutil ls -l gs://my-backup-bucket/openctem/backups/daily/

# Azure
az storage blob list --container-name my-backup-bucket \
    --prefix openctem/backups/daily/ --output table
```

---

## WAL Archiving (Point-in-Time Recovery)

WAL (Write-Ahead Log) archiving enables recovery to any point in time between base backups, reducing RPO from 24 hours to minutes.

### Setup

Add to `postgresql.conf`:

```ini
wal_level = replica
archive_mode = on
archive_command = 'cp %p /var/backups/openctem/wal/%f'
archive_timeout = 300
```

Restart PostgreSQL, then verify:

```bash
./setup/backup/wal-archive.sh status
```

### Performing Point-in-Time Recovery

1. Identify the target recovery timestamp (e.g., just before an accidental deletion).
2. Ensure a base backup exists from before that timestamp.
3. Run the restore command:

```bash
./setup/backup/wal-archive.sh restore-command '2026-03-11 14:30:00'
```

Follow the printed instructions to complete the WAL replay.

---

## Restore Procedures

### Full Restore

Restore the most recent backup to the primary database:

```bash
./setup/backup/restore.sh /var/backups/openctem/daily/openctem_full_20260311_020000.dump
```

### Verify Before Restoring

Check backup integrity without modifying any database:

```bash
./setup/backup/restore.sh /var/backups/openctem/daily/openctem_full_20260311_020000.dump --verify
```

### Restore to an Alternate Database

Test a restore safely by targeting a different database name:

```bash
./setup/backup/restore.sh backup.dump --target openctem_restored
```

### Restore from Cloud Storage

Download the backup from your cloud provider, then restore locally:

```bash
# Example: S3
aws s3 cp s3://my-backup-bucket/openctem/backups/daily/openctem_full_20260311.dump /tmp/
sha256sum -c /tmp/openctem_full_20260311.dump.sha256   # verify integrity
./setup/backup/restore.sh /tmp/openctem_full_20260311.dump
```

### List Available Backups

```bash
./setup/backup/restore.sh --list
```

### Docker Environments

For Docker deployments, run the backup inside the container:

```bash
docker compose exec postgres pg_dump -U openctem -d openctem --format=custom \
    -f /tmp/backup.dump
docker compose cp postgres:/tmp/backup.dump ./backups/
```

---

## Automation

### Cron Schedule

Install the provided crontab to automate daily backups:

```bash
# Create required directories
sudo mkdir -p /var/log/openctem /etc/openctem

# Create environment file with database credentials
sudo tee /etc/openctem/backup.env << 'EOF'
DB_HOST=localhost
DB_PORT=5432
DB_USER=openctem
DB_NAME=openctem
DB_PASSWORD=<your-password>
BACKUP_DIR=/var/backups/openctem
EOF
sudo chmod 600 /etc/openctem/backup.env

# Install crontab
crontab setup/backup/crontab
```

### Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `openctem` | Database user |
| `DB_NAME` | `openctem` | Database name |
| `DB_PASSWORD` | _(reads .pgpass)_ | Database password |
| `BACKUP_DIR` | `/var/backups/openctem` | Local backup directory |
| `RETENTION_DAYS` | `30` | Daily backup retention (days) |
| `RETENTION_WEEKLY` | `12` | Weekly backup retention (weeks) |
| `RETENTION_MONTHLY` | `12` | Monthly backup retention (months) |
| `COMPRESSION` | `gzip` | Compression: `gzip`, `lz4`, `zstd` |
| `OFFSITE_ENABLED` | `false` | Enable cloud uploads |
| `OFFSITE_PROVIDER` | `s3` | Cloud provider: `s3`, `gcs`, `azure` |
| `OFFSITE_BUCKET` | _(required)_ | Bucket/container name |
| `OFFSITE_PREFIX` | `openctem/backups` | Object key prefix |
| `OFFSITE_RETENTION_DAYS` | `90` | Off-site retention (days) |

---

## Monitoring

### Backup Freshness

Check how recently a backup completed:

```bash
stat -c '%Y' /var/backups/openctem/daily/$(ls -t /var/backups/openctem/daily/ | head -1) | \
    xargs -I {} bash -c 'echo $(( ($(date +%s) - {}) / 3600 )) hours ago'
```

### Backup Size Tracking

Monitor backup sizes over time to detect unexpected growth or shrinkage:

```bash
ls -lhtr /var/backups/openctem/daily/openctem_full_* | grep -v sha256
```

### Backup Inventory

The script logs a summary after every run with counts per tier:

```
[2026-03-11 02:01:42] Backup inventory: daily=30, weekly=12, monthly=6
```

Review the backup log:

```bash
tail -50 /var/backups/openctem/backup.log
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `pg_dump: connection refused` | Check `DB_HOST`, `DB_PORT`, and firewall rules |
| `pg_dump: authentication failed` | Verify `DB_PASSWORD` or `.pgpass` file |
| Restore fails: "database in use" | Disconnect clients: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'openctem' AND pid <> pg_backend_pid();` |
| Backup files too large | Switch to `COMPRESSION=zstd` for better ratio |
| WAL archive filling disk | Reduce `archive_timeout` or increase disk; clean old WAL segments |
| Off-site upload fails | Check credentials, network connectivity, and CLI installation for your provider |
| Checksum mismatch after download | Re-download the backup; the file may have been corrupted in transit |

---

## Related Documentation

- [Operations Runbook: Backup & Restore](../operations/backup-restore.md) -- detailed step-by-step procedures
- [Architecture Overview](../architecture/overview.md)
