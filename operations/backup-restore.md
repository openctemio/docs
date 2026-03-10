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
