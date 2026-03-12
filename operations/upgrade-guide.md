# OpenCTEM Upgrade Guide

This guide covers upgrading OpenCTEM across Docker Compose and Kubernetes/Helm deployments. Follow the procedures carefully to minimize downtime and risk.

## Table of Contents

- [Version Management](#version-management)
- [Pre-Upgrade Checklist](#pre-upgrade-checklist)
- [Docker Compose Upgrade](#docker-compose-upgrade)
- [Kubernetes/Helm Upgrade](#kuberneteshelm-upgrade)
- [Database Migration Handling](#database-migration-handling)
- [Rollback Procedures](#rollback-procedures)
- [Zero-Downtime Upgrades](#zero-downtime-upgrades)
- [Troubleshooting Upgrade Issues](#troubleshooting-upgrade-issues)
- [Maintenance Window Template](#maintenance-window-template)

---

## Version Management

### Semantic Versioning

OpenCTEM follows semantic versioning (`MAJOR.MINOR.PATCH`):

- **MAJOR** (e.g., v1.0.0 to v2.0.0): Breaking changes, schema incompatibilities, required data migrations. Always read the upgrade notes.
- **MINOR** (e.g., v0.2.0 to v0.3.0): New features, non-breaking schema changes. Review release notes for new migration steps.
- **PATCH** (e.g., v0.2.0 to v0.2.1): Bug fixes, security patches. Generally safe to apply without review.

### Docker Image Tags

OpenCTEM publishes the following images to Docker Hub:

| Image | Description |
|-------|-------------|
| `openctemio/api:<version>` | Backend API (Go) |
| `openctemio/ui:<version>` | Frontend UI (Next.js) |
| `openctemio/admin-ui:<version>` | Admin console (Next.js) |
| `openctemio/migrations:<version>` | Database migration runner |
| `openctemio/seed:<version>` | Test/demo data seeder |

Tag conventions:

- `v0.2.0` -- pinned release version (recommended for production)
- `latest` -- latest stable release (default for production)
- `staging-latest` -- latest staging build (default for staging)

### The `.env.versions` File

Version tags are controlled via `.env.versions.prod` or `.env.versions.staging`:

```bash
# .env.versions.prod
API_VERSION=v0.3.0
UI_VERSION=v0.3.0
ADMIN_UI_VERSION=v0.3.0
MIGRATIONS_VERSION=v0.3.0
```

The `MIGRATIONS_VERSION` should always match `API_VERSION` to ensure schema compatibility between the database and the API.

### Checking the Current Version

**Docker Compose:**
```bash
# Show running image tags
docker compose -f docker-compose.prod.yml ps --format "table {{.Service}}\t{{.Image}}\t{{.Status}}"

# Check the versions env file
cat .env.versions.prod

# Check API version via health endpoint
curl -s http://localhost:8080/health | jq .version
```

**Kubernetes:**
```bash
# Show deployed image tags
kubectl get pods -n openctem -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[*].image}{"\n"}{end}'

# Check Helm release
helm list -n openctem
helm get values openctem -n openctem
```

---

## Pre-Upgrade Checklist

Complete every item before proceeding with an upgrade.

### 1. Back Up the Database

Run a full backup before any upgrade. See the [Backup & Restore Runbook](backup-restore.md) for details.

```bash
# Docker Compose -- manual backup
docker compose exec postgres pg_dump -U openctem -d openctem --format=custom -f /tmp/backup.dump
docker compose cp postgres:/tmp/backup.dump ./backups/pre-upgrade-$(date +%Y%m%d).dump

# Or use the backup script
./setup/backup/backup.sh --type full
```

Verify the backup is valid:
```bash
./setup/backup/restore.sh ./backups/pre-upgrade-$(date +%Y%m%d).dump --verify
```

### 2. Review the Changelog and Release Notes

Before upgrading, review the release notes for every version between your current version and the target version. Pay attention to:

- Breaking API changes
- New required environment variables
- Database migration notes (especially destructive or data-transforming migrations)
- Deprecation warnings

### 3. Check Migration Compatibility

Verify the target migration version is compatible with your current schema:

```bash
# Check current migration version
docker compose exec postgres psql -U openctem -d openctem -c \
  "SELECT version, dirty FROM schema_migrations;"
```

If the target release includes migrations, confirm:
- No gap between your current migration number and the next one in the release
- The release notes do not flag any manual migration steps

### 4. Test in Staging First

Always deploy to staging before production:

```bash
# Update staging versions
vi .env.versions.staging   # Set target versions

# Deploy to staging
make staging-up

# Run your test suite against staging
# Verify all features work as expected
```

### 5. Notify Users of Maintenance Window

For upgrades that require downtime, notify users in advance with:
- Scheduled start and end time
- Expected duration
- Features affected
- Contact information for issues

See the [Maintenance Window Template](#maintenance-window-template) at the end of this guide.

### 6. Record Current State

Save the current state so you can roll back if needed:

```bash
# Save current versions
cp .env.versions.prod .env.versions.prod.backup-$(date +%Y%m%d)

# Record running container digests
docker compose -f docker-compose.prod.yml images > pre-upgrade-images-$(date +%Y%m%d).txt
```

---

## Docker Compose Upgrade

### Step-by-Step Procedure

All commands below assume you are in the `setup/` directory.

#### 1. Update Version Tags

```bash
# Edit the versions file with your target versions
vi .env.versions.prod
```

Example change:
```bash
# Before
API_VERSION=v0.2.0
UI_VERSION=v0.2.0
ADMIN_UI_VERSION=v0.2.0
MIGRATIONS_VERSION=v0.2.0

# After
API_VERSION=v0.3.0
UI_VERSION=v0.3.0
ADMIN_UI_VERSION=v0.3.0
MIGRATIONS_VERSION=v0.3.0
```

#### 2. Pull New Images

Pull images before restarting to minimize downtime:

```bash
docker compose -f docker-compose.prod.yml \
  --env-file .env.db.prod \
  --env-file .env.api.prod \
  --env-file .env.ui.prod \
  --env-file .env.nginx.prod \
  --env-file .env.versions.prod \
  pull
```

Or use the Makefile shortcut (which pulls and starts in one step):
```bash
make prod-up
```

#### 3. Restart Services

The `make prod-up` command handles pulling and restarting in one step. If you prefer manual control:

```bash
# Stop current services
docker compose -f docker-compose.prod.yml \
  --env-file .env.db.prod \
  --env-file .env.api.prod \
  --env-file .env.ui.prod \
  --env-file .env.nginx.prod \
  --env-file .env.versions.prod \
  down

# Start with new versions
docker compose -f docker-compose.prod.yml \
  --env-file .env.db.prod \
  --env-file .env.api.prod \
  --env-file .env.ui.prod \
  --env-file .env.nginx.prod \
  --env-file .env.versions.prod \
  up -d
```

#### 4. Migrations Run Automatically

The `migrate` service runs automatically on startup. It:
1. Waits for PostgreSQL to be healthy
2. Runs all pending migrations via `migrate -path=/migrations -database "$DATABASE_URL" up`
3. Exits with success when complete

The `api` service depends on `migrate` completing successfully (`condition: service_completed_successfully`), so the API will not start until migrations finish.

#### 5. Verify Health After Upgrade

```bash
# Check all services are running
docker compose -f docker-compose.prod.yml \
  --env-file .env.db.prod \
  --env-file .env.api.prod \
  --env-file .env.ui.prod \
  --env-file .env.nginx.prod \
  --env-file .env.versions.prod \
  ps

# Check API health
curl -s http://localhost:8080/health | jq .

# Check UI health
curl -s http://localhost:3000/api/health

# Review logs for errors
make prod-logs s=api
make prod-logs s=migrate
```

#### 6. Verify Migration Status

```bash
docker compose -f docker-compose.prod.yml \
  --env-file .env.db.prod \
  --env-file .env.api.prod \
  --env-file .env.ui.prod \
  --env-file .env.nginx.prod \
  --env-file .env.versions.prod \
  exec postgres psql -U openctem -d openctem -c \
  "SELECT version, dirty FROM schema_migrations;"
```

The `dirty` column must be `false`. The `version` should match the latest migration number in the release.

---

## Kubernetes/Helm Upgrade

### Step-by-Step Procedure

#### 1. Preview Changes with `helm diff`

Install the `helm-diff` plugin if you have not already:
```bash
helm plugin install https://github.com/databus23/helm-diff
```

Preview what will change:
```bash
helm diff upgrade openctem ./setup/kubernetes/helm/openctem \
  -n openctem \
  --set api.image.tag=v0.3.0 \
  --set ui.image.tag=v0.3.0
```

Review the diff carefully, especially changes to:
- Resource limits
- Environment variables
- Volume mounts
- Ingress rules

#### 2. Run the Upgrade

```bash
helm upgrade openctem ./setup/kubernetes/helm/openctem \
  -n openctem \
  --set api.image.tag=v0.3.0 \
  --set ui.image.tag=v0.3.0 \
  --wait \
  --timeout 10m
```

Or update `values.yaml` and apply:
```bash
# Edit values.yaml with new image tags
vi setup/kubernetes/helm/openctem/values.yaml

helm upgrade openctem ./setup/kubernetes/helm/openctem \
  -n openctem \
  -f setup/kubernetes/helm/openctem/values.yaml \
  --wait \
  --timeout 10m
```

The `--wait` flag ensures Helm waits for all pods to be ready before marking the release as successful.

#### 3. Monitor the Rollout

```bash
# Watch the rollout progress
kubectl rollout status deployment/openctem-api -n openctem
kubectl rollout status deployment/openctem-ui -n openctem

# Check migration job status
kubectl get jobs -n openctem -l app.kubernetes.io/component=migration

# View migration logs
kubectl logs -n openctem -l app.kubernetes.io/component=migration --tail=50
```

#### 4. Verify Pods Are Healthy

```bash
# All pods should be Running with READY status
kubectl get pods -n openctem

# Check readiness/liveness probe results
kubectl describe pods -n openctem -l app.kubernetes.io/name=openctem

# Test API health through the ingress
curl -s https://openctem.example.com/api/health | jq .
```

---

## Database Migration Handling

### Automatic Migrations

By default, migrations run automatically:

- **Docker Compose**: The `migrate` service runs before the API starts. The API depends on `migrate` completing successfully.
- **Kubernetes**: A migration Job runs as a Helm pre-upgrade hook before new pods deploy.

### Manual Migration Execution

If you need to run migrations manually:

```bash
# Docker Compose -- staging
make migrate-staging

# Docker Compose -- production
make migrate-prod

# Direct execution
docker compose -f docker-compose.prod.yml \
  --env-file .env.db.prod \
  --env-file .env.api.prod \
  --env-file .env.ui.prod \
  --env-file .env.nginx.prod \
  --env-file .env.versions.prod \
  up migrate
```

### Checking Migration Status

```bash
# Query the schema_migrations table
docker compose exec postgres psql -U openctem -d openctem -c \
  "SELECT version, dirty FROM schema_migrations;"
```

Expected output for a healthy state:
```
 version | dirty
---------+-------
      53 | f
```

### What to Do If a Migration Fails

If a migration fails, the `dirty` flag will be set to `true` and the migration version will reflect the failed migration number. The API will not start.

1. **Check the migration logs:**
   ```bash
   make prod-logs s=migrate
   ```

2. **Identify and fix the issue** (e.g., constraint violation, missing data).

3. **Clear the dirty flag:**
   ```bash
   docker compose exec postgres psql -U openctem -d openctem -c \
     "UPDATE schema_migrations SET dirty = false;"
   ```

4. **Re-run migrations:**
   ```bash
   make migrate-prod
   ```

5. **If the migration is partially applied**, you may need to manually undo the partial changes before retrying. Check the specific `.up.sql` file to understand what ran and what did not.

### Rolling Back Migrations

Each migration has a corresponding `.down.sql` file. Use the `migrate` tool to roll back:

```bash
# Roll back the last migration
docker compose exec migrate \
  migrate -path=/migrations -database "$DATABASE_URL" down 1

# Roll back to a specific version
docker compose exec migrate \
  migrate -path=/migrations -database "$DATABASE_URL" goto <version>
```

**Warning:** Down migrations may cause data loss. Always back up before rolling back.

---

## Rollback Procedures

### Docker Compose Rollback

#### 1. Revert Version Tags

```bash
# Restore the backup versions file
cp .env.versions.prod.backup-YYYYMMDD .env.versions.prod

# Or manually edit to previous versions
vi .env.versions.prod
```

#### 2. Pull and Restart with Previous Versions

```bash
make prod-up
```

Or manually:
```bash
docker compose -f docker-compose.prod.yml \
  --env-file .env.db.prod \
  --env-file .env.api.prod \
  --env-file .env.ui.prod \
  --env-file .env.nginx.prod \
  --env-file .env.versions.prod \
  pull

docker compose -f docker-compose.prod.yml \
  --env-file .env.db.prod \
  --env-file .env.api.prod \
  --env-file .env.ui.prod \
  --env-file .env.nginx.prod \
  --env-file .env.versions.prod \
  up -d
```

#### 3. Roll Back the Database If Needed

If the upgrade included migrations, you must also roll back the database schema to match the previous API version. See [Rolling Back Migrations](#rolling-back-migrations).

### Kubernetes/Helm Rollback

```bash
# List release history
helm history openctem -n openctem

# Roll back to the previous revision
helm rollback openctem -n openctem

# Roll back to a specific revision
helm rollback openctem 3 -n openctem

# Monitor the rollback
kubectl rollout status deployment/openctem-api -n openctem
```

### Database Rollback Considerations

If the failed upgrade included database migrations:

1. **Schema-only migrations** (adding columns, indexes, tables): Roll back the migration, then roll back the application.
2. **Data migrations** (transforming or moving data): Restore from the pre-upgrade backup instead of using down migrations.

### When NOT to Roll Back

Do not use `migrate down` when:

- The migration **deleted or transformed data** irreversibly. Restore from backup instead.
- Other systems or services have already consumed data in the new format.
- The migration dropped columns or tables that contained data you need.

In these cases, restore the full database from the pre-upgrade backup:

```bash
./setup/backup/restore.sh ./backups/pre-upgrade-YYYYMMDD.dump
```

---

## Zero-Downtime Upgrades

### Blue-Green Deployment (Docker Compose)

For critical production environments where downtime is unacceptable:

1. **Spin up a parallel stack** with the new version:
   ```bash
   # Create a separate project with new versions
   API_VERSION=v0.3.0 UI_VERSION=v0.3.0 ADMIN_UI_VERSION=v0.3.0 \
     docker compose -f docker-compose.prod.yml -p openctem-green \
     --env-file .env.db.prod \
     --env-file .env.api.prod \
     --env-file .env.ui.prod \
     --env-file .env.nginx.prod \
     up -d
   ```

2. **Run migrations against the database** (ensure they are backward-compatible).

3. **Test the green environment** by pointing a test domain or direct port access to it.

4. **Switch traffic** by updating nginx upstream configuration or DNS.

5. **Tear down the old (blue) stack** once the green stack is confirmed healthy.

### Rolling Update Strategy (Kubernetes)

Kubernetes handles rolling updates natively. The Helm chart configures:

- **Pod Disruption Budget**: `minAvailable: 1` ensures at least one pod is always running.
- **Readiness probes**: New pods must pass the `/health` check before receiving traffic.
- **Autoscaling**: The API scales between 2 and 10 replicas based on CPU/memory.

The default rolling update strategy replaces pods one at a time, waiting for each new pod to be ready before terminating the old one.

```yaml
# values.yaml defaults
api:
  replicaCount: 2
podDisruptionBudget:
  enabled: true
  minAvailable: 1
```

### Database Backward Compatibility

For true zero-downtime upgrades, database migrations must be **backward-compatible**. This means:

1. **Adding columns**: Always use `DEFAULT` values or allow `NULL` so the old API version can still write rows.
2. **Renaming columns**: Do it in two releases -- add the new column in release N, drop the old column in release N+1.
3. **Dropping columns**: Only drop columns that the previous API version no longer reads from.
4. **Adding constraints**: Add them as `NOT VALID` first, then `VALIDATE` in a subsequent migration.

---

## Troubleshooting Upgrade Issues

### Migration Stuck or Dirty

**Symptom:** The `migrate` service hangs or exits with an error. The API does not start.

```bash
# Check migration status
docker compose exec postgres psql -U openctem -d openctem -c \
  "SELECT version, dirty FROM schema_migrations;"
```

If `dirty = true`:

1. Review the migration logs to find the error:
   ```bash
   make prod-logs s=migrate
   ```

2. Fix the underlying issue (e.g., constraint violation, missing data).

3. Clear the dirty flag:
   ```bash
   docker compose exec postgres psql -U openctem -d openctem -c \
     "UPDATE schema_migrations SET dirty = false;"
   ```

4. Restart the migrate service:
   ```bash
   make migrate-prod
   ```

### Service Will Not Start After Upgrade

**Symptom:** API or UI container enters a restart loop.

1. **Check logs:**
   ```bash
   make prod-logs s=api
   make prod-logs s=ui
   ```

2. **Common causes:**
   - Missing environment variable introduced in the new version. Check release notes for new required variables.
   - Migration did not complete. Verify `schema_migrations` status.
   - Port conflict or resource exhaustion.

3. **Check container health:**
   ```bash
   docker inspect --format='{{json .State.Health}}' <container_id> | jq .
   ```

### Version Mismatch Between Services

**Symptom:** API returns unexpected errors. UI shows "incompatible API version" or similar.

Ensure all version tags are aligned:
```bash
cat .env.versions.prod
```

All OpenCTEM components (`API_VERSION`, `UI_VERSION`, `ADMIN_UI_VERSION`, `MIGRATIONS_VERSION`) should be on the same release version. Mixing versions across a major or minor boundary is unsupported.

### Cache Invalidation After Upgrade

**Symptom:** Stale data appears in the UI. Users see old behavior after upgrade.

1. **Flush Redis cache:**
   ```bash
   docker compose exec redis redis-cli -a "$REDIS_PASSWORD" FLUSHALL
   ```

2. **Clear browser caches:** Instruct users to hard-refresh (Ctrl+Shift+R / Cmd+Shift+R) or clear their browser cache.

3. **Restart the API** to clear any in-memory caches:
   ```bash
   make prod-restart s=api
   ```

---

## Maintenance Window Template

Use this template to communicate upgrade maintenance to users.

### Pre-Maintenance Communication

Send 48-72 hours before the maintenance window.

```
Subject: [OpenCTEM] Scheduled Maintenance - <DATE>

We will be performing a scheduled upgrade of the OpenCTEM platform.

  Scheduled Start: <DATE> <TIME> <TIMEZONE>
  Expected Duration: <DURATION> (e.g., 30 minutes)
  Impact: <brief description of impact, e.g., "Platform will be unavailable">

What is changing:
  - <Summary of changes, e.g., "Upgrading from v0.2.0 to v0.3.0">
  - <Key new features or fixes>

What you need to do:
  - Save any in-progress work before the maintenance window
  - <Any user action required, e.g., "Clear browser cache after upgrade">

Questions? Contact <support contact>.
```

### During Maintenance -- Operator Steps

```
1. [ ] Send "maintenance starting" notification
2. [ ] Verify pre-upgrade backup completed successfully
3. [ ] Record current versions: ________________________________
4. [ ] Pull new images
5. [ ] Stop services (or begin rolling update)
6. [ ] Run/verify migrations
7. [ ] Start services with new versions
8. [ ] Verify API health: curl http://localhost:8080/health
9. [ ] Verify UI health: curl http://localhost:3000/api/health
10. [ ] Verify Admin UI health
11. [ ] Run smoke tests (login, list assets, view dashboard)
12. [ ] Check for errors in logs: make prod-logs s=api
13. [ ] Verify migration version matches expected
14. [ ] Send "maintenance complete" notification
```

### Post-Maintenance Verification

After the upgrade, verify the following within the first hour:

- [ ] All services report healthy
- [ ] Users can log in
- [ ] Dashboard loads and displays current data
- [ ] Asset and finding CRUD operations work
- [ ] Background jobs/scanners are processing
- [ ] No error spikes in logs
- [ ] Performance is within normal range

### Incident Escalation

If the upgrade causes issues that cannot be resolved within the maintenance window:

1. **First 15 minutes:** Attempt to diagnose and fix. Check logs, migration status, service health.
2. **After 15 minutes:** If unresolved, initiate rollback:
   ```bash
   cp .env.versions.prod.backup-YYYYMMDD .env.versions.prod
   make prod-up
   ```
3. **If rollback fails or database is incompatible:** Restore from the pre-upgrade database backup:
   ```bash
   ./setup/backup/restore.sh ./backups/pre-upgrade-YYYYMMDD.dump
   make prod-up
   ```
4. **Communicate status:** Notify users that the upgrade has been rolled back and the platform is restored. Schedule a follow-up maintenance window after the issue is resolved.
5. **Post-incident:** Document what went wrong, root cause, and preventive measures.
