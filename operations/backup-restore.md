# OpenCTEM Database Backup & Restore Runbook

## Overview

OpenCTEM uses `pg_dump` for logical backups with a tiered retention policy:
- **Daily backups**: retained for 30 days
- **Weekly backups**: retained for 12 weeks (Sunday snapshots)
- **Monthly backups**: retained for 12 months (1st of month snapshots)

WAL archiving provides point-in-time recovery (PITR) between base backups.

## Quick Reference

```bash
# Run a manual backup
./setup/backup/backup.sh --type full

# List available backups
./setup/backup/restore.sh --list

# Verify a backup
./setup/backup/restore.sh /var/backups/openctem/daily/openctem_full_20260306_020000.dump --verify

# Restore a backup
./setup/backup/restore.sh /var/backups/openctem/daily/openctem_full_20260306_020000.dump

# Restore to a different database (safe testing)
./setup/backup/restore.sh backup.dump --target openctem_restored

# Check WAL archiving status
./setup/backup/wal-archive.sh status
```

## Setup

### 1. Install Cron Schedule

```bash
# Create log directory
sudo mkdir -p /var/log/openctem

# Create environment file
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

### 2. Configure WAL Archiving (for PITR)

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

### 3. Docker Environment

For Docker deployments, run backup inside the container:
```bash
docker compose exec postgres pg_dump -U openctem -d openctem --format=custom -f /tmp/backup.dump
docker compose cp postgres:/tmp/backup.dump ./backups/
```

## Point-in-Time Recovery

1. Identify the target recovery time
2. Find the most recent base backup before that time
3. Run restore with WAL replay:

```bash
./setup/backup/wal-archive.sh restore-command '2026-03-06 14:30:00'
```

Follow the printed instructions to complete PITR.

## Off-site Backup (Cloud Storage)

The backup script supports uploading to S3, GCS, or Azure Blob Storage for disaster recovery.

### Configuration

Add to `/etc/openctem/backup.env`:

```bash
# --- Off-site backup ---
OFFSITE_ENABLED=true
OFFSITE_PROVIDER=s3          # s3 | gcs | azure
OFFSITE_BUCKET=my-backup-bucket
OFFSITE_PREFIX=openctem/backups   # object key prefix
OFFSITE_RETENTION_DAYS=90         # cloud retention (default: 90)
```

### Provider Setup

**AWS S3:**
```bash
# Install AWS CLI
apt-get install -y awscli

# Set credentials
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=us-east-1

# For S3-compatible storage (MinIO, etc.)
S3_ENDPOINT=https://minio.example.com
```

**Google Cloud Storage:**
```bash
# Install gsutil
apt-get install -y google-cloud-cli

# Set credentials
GOOGLE_APPLICATION_CREDENTIALS=/etc/openctem/gcs-service-account.json
```

**Azure Blob Storage:**
```bash
# Install Azure CLI
apt-get install -y azure-cli

# Set credentials
AZURE_STORAGE_ACCOUNT=mystorageaccount
AZURE_STORAGE_KEY=...
```

### Verify Off-site Backup

```bash
# S3: list uploaded backups
aws s3 ls s3://my-backup-bucket/openctem/backups/daily/ --human-readable

# GCS: list uploaded backups
gsutil ls -l gs://my-backup-bucket/openctem/backups/daily/

# Azure: list uploaded backups
az storage blob list --container-name my-backup-bucket --prefix openctem/backups/daily/ --output table
```

### Restore from Cloud

```bash
# S3: download and restore
aws s3 cp s3://my-backup-bucket/openctem/backups/daily/openctem_full_20260311.dump /tmp/
./setup/backup/restore.sh /tmp/openctem_full_20260311.dump

# GCS: download and restore
gsutil cp gs://my-backup-bucket/openctem/backups/daily/openctem_full_20260311.dump /tmp/
./setup/backup/restore.sh /tmp/openctem_full_20260311.dump
```

## Monitoring

Check backup freshness:
```bash
# Latest backup age
stat -c '%Y' /var/backups/openctem/daily/$(ls -t /var/backups/openctem/daily/ | head -1) | \
  xargs -I {} bash -c 'echo $(( ($(date +%s) - {}) / 3600 )) hours ago'

# Backup sizes over time
ls -lhtr /var/backups/openctem/daily/openctem_full_* | grep -v sha256
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| pg_dump: connection refused | Check DB_HOST, DB_PORT, firewall rules |
| pg_dump: authentication failed | Verify DB_PASSWORD or .pgpass file |
| Restore fails with "database in use" | Disconnect all clients first: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'openctem' AND pid <> pg_backend_pid();` |
| Backup too large | Use `COMPRESSION=zstd` for better compression ratio |
| WAL archive filling disk | Reduce `WAL_RETENTION_DAYS` or increase disk space |
