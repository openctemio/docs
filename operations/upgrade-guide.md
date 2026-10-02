# OpenCTEM Upgrade Guide

This guide covers upgrading OpenCTEM across Docker Compose and Kubernetes/Helm deployments. Follow the procedures carefully to minimize downtime and risk.

> Upgrading from v0.8.x to v0.9.0? Follow [Upgrading from v0.8 to v0.9](upgrade-to-v0.9.md): it has the breaking changes, inventory queries and the exact order for that release.
>
> Upgrading to the release that renames agents to sensors? Read [Upgrading to the Sensor release](upgrade-agent-to-sensor.md) as well.

> Upgrading to the release where Betterleaks replaces gitleaks (API migration 000241)? Read [Upgrading: gitleaks → Betterleaks](upgrade-gitleaks-to-betterleaks.md).

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

### One version for the whole platform

The API and the web console are developed in one repository,
[openctemio/openctem](https://github.com/openctemio/openctem), and released
together: one `vX.Y.Z` tag builds every image from the same commit. Always run
the API, the web console and the migrations image at the **same** version.

OpenCTEM follows semantic versioning (`MAJOR.MINOR.PATCH`):

- **MAJOR** (e.g., v1.0.0 to v2.0.0): Breaking changes, schema incompatibilities, required data migrations. Always read the upgrade notes.
- **MINOR** (e.g., v0.8.0 to v0.9.0): New features, schema changes. Read the release notes and any upgrade page for that release.
- **PATCH** (e.g., v0.9.0 to v0.9.1): Bug fixes, security patches. Generally safe to apply without review.

The sensor (scanning agent) is released separately from
[openctemio/sensor](https://github.com/openctemio/sensor) with its own version
numbers; the platform tells each sensor the minimum and latest versions it
supports.

### Images

All images are published to GitHub Container Registry, multi-arch
(amd64, arm64), signed with cosign, with SBOMs attached to the release:

| Image | Description |
|-------|-------------|
| `ghcr.io/openctemio/openctem-api:<version>` | Backend API (Go) |
| `ghcr.io/openctemio/openctem-web:<version>` | Web console (Next.js) |
| `ghcr.io/openctemio/openctem:<version>` | All-in-one: API + web + gateway (Postgres and Redis external) |
| `ghcr.io/openctemio/migrations:<version>` | Database migration runner |
| `ghcr.io/openctemio/seed:<version>` | Test/demo data seeder |
| `ghcr.io/openctemio/admin-cli:<version>` | Admin CLI |

{: .note }
The `openctem-api`, `openctem-web` and `openctem` names start with **v0.9.0**.
v0.8.0 and earlier exist only as `ghcr.io/openctemio/api` and
`ghcr.io/openctemio/ui`. Those legacy names keep receiving identical copies of
each release for two releases after the rename, then stop: switch to the new
names when you upgrade. Images are not published to Docker Hub.

Pin an exact release tag (`v0.9.0`) in production.

### Checking the Current Version

**Docker Compose** (from `openctem/api/deploy`):
```bash
# Show running image tags
docker compose ps --format "table {{.Service}}\t{{.Image}}\t{{.Status}}"

# The configured version
grep OPENCTEM_VERSION .env
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
# Docker Compose (from openctem/api/deploy)
mkdir -p backups
docker compose exec -T postgres pg_dump -U openctem -d openctem --format=custom \
  > ./backups/pre-upgrade-$(date +%Y%m%d).dump

# Verify the dump is readable
pg_restore --list ./backups/pre-upgrade-$(date +%Y%m%d).dump > /dev/null && echo OK
```

### 2. Review the Changelog and Release Notes

Read the [release notes](https://github.com/openctemio/openctem/releases) for
every version between your current version and the target version. Pay
attention to:

- Breaking API changes
- New required environment variables
- Database migration notes (especially destructive or data-transforming migrations)
- Deprecation warnings

### 3. Check Migration Compatibility

```bash
# Check current migration version
docker compose exec postgres psql -U openctem -d openctem -c \
  "SELECT version, dirty FROM schema_migrations;"
```

`dirty` must be `false` before you upgrade. If it is `true`, fix that first
([Migration Stuck or Dirty](#migration-stuck-or-dirty)).

### 4. Test in Staging First

Deploy the target version to a staging copy of the stack (see
[Staging Deployment](STAGING_DEPLOYMENT.md)) and run your smoke tests there
before production.

### 5. Notify Users of Maintenance Window

For upgrades that require downtime, notify users in advance with:
- Scheduled start and end time
- Expected duration
- Features affected
- Contact information for issues

See the [Maintenance Window Template](#maintenance-window-template) at the end of this guide.

### 6. Record Current State

```bash
# Save the current settings and the running image digests
cp .env .env.backup-$(date +%Y%m%d)
docker compose images > pre-upgrade-images-$(date +%Y%m%d).txt
```

---

## Docker Compose Upgrade

### Step-by-Step Procedure

The production stack is `api/deploy/docker-compose.yml` in the
[openctem repository](https://github.com/openctemio/openctem/tree/main/api/deploy)
(see [Exposing OpenCTEM: one HTTPS port](single-https-port.md)). All commands
below run in `openctem/api/deploy`.

#### 1. Update the Compose files and the version

```bash
git pull                       # newer compose file and gateway config
vi .env                        # OPENCTEM_VERSION=v0.9.0
```

`OPENCTEM_VERSION` sets the API, web and migrations images together.
`API_VERSION` and `UI_VERSION` override it per service; leave them unset
unless you are told otherwise. Compare `.env` with the new `.env.example` for
new settings.

To pin the image names explicitly (for example to move off the legacy names
while the compose file still defaults to them), set:

```bash
API_IMAGE=ghcr.io/openctemio/openctem-api
UI_IMAGE=ghcr.io/openctemio/openctem-web
```

#### 2. Pull New Images

Pull before restarting to minimize downtime:

```bash
docker compose pull
```

#### 3. Restart Services

```bash
docker compose up -d
```

#### 4. Migrations Run Automatically

The `migrate` service runs on every `docker compose up`. It:
1. Waits for PostgreSQL to be healthy
2. Runs all pending migrations (`migrate -path=/migrations -database ... up`)
3. Exits with success when complete

The `api` service depends on `migrate` completing successfully (`condition: service_completed_successfully`), so the API will not start until migrations finish.

#### 5. Verify Health After Upgrade

```bash
# Every service up; migrate (and datastore-tls) exited 0
docker compose ps -a

# Through the gateway (add --cacert ca/openctem-root-ca.crt with the internal CA)
curl -s https://<OPENCTEM_HOSTNAME>/health

# Migration logs
docker compose logs migrate

# Database migration state
docker compose exec postgres psql -U openctem -d openctem -c \
  "SELECT version, dirty FROM schema_migrations;"
```

The `dirty` column must be `false`. The `version` should match the latest migration number in the release.

---

## Kubernetes/Helm Upgrade

The chart is published from
[openctemio/helm-charts](https://github.com/openctemio/helm-charts). Its
`appVersion` is the platform version it was tested with; `api.image.tag` and
`ui.image.tag` default to it.

### Step-by-Step Procedure

#### 1. Preview Changes with `helm diff`

Install the `helm-diff` plugin if you have not already:
```bash
helm plugin install https://github.com/databus23/helm-diff
helm repo update
```

Preview what will change:
```bash
helm diff upgrade openctem openctem/openctem \
  -n openctem \
  -f values-production.yaml \
  --set api.image.tag=v0.9.0 \
  --set ui.image.tag=v0.9.0
```

Review the diff carefully, especially changes to:
- Image repositories and tags
- Resource limits
- Environment variables
- Volume mounts
- Ingress rules

#### 2. Run the Upgrade

```bash
helm upgrade openctem openctem/openctem \
  -n openctem \
  -f values-production.yaml \
  --set api.image.tag=v0.9.0 \
  --set ui.image.tag=v0.9.0 \
  --wait \
  --timeout 10m
```

Or put the tags in your values file and apply it with `-f`. Keep the API and
web tags equal.

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
curl -s https://openctem.example.com/health
```

---

## Database Migration Handling

### Automatic Migrations

By default, migrations run automatically:

- **Docker Compose**: The `migrate` service runs before the API starts. The API depends on `migrate` completing successfully.
- **Kubernetes**: A migration Job runs as a Helm hook (post-install, pre-upgrade) before new pods deploy.

### Manual Migration Execution

```bash
# Docker Compose (from openctem/api/deploy): re-run the one-shot service
docker compose up migrate
```

### Checking Migration Status

```bash
docker compose exec postgres psql -U openctem -d openctem -c \
  "SELECT version, dirty FROM schema_migrations;"
```

Expected output for a healthy state (the number depends on the release):
```
 version | dirty
---------+-------
     256 | f
```

### What to Do If a Migration Fails

If a migration fails, the `dirty` flag will be set to `true` and the migration version will reflect the failed migration number. The API will not start.

1. **Check the migration logs:**
   ```bash
   docker compose logs migrate
   ```

2. **Identify and fix the issue** (e.g., constraint violation, missing data).

3. **Clear the dirty flag:**
   ```bash
   docker compose exec postgres psql -U openctem -d openctem -c \
     "UPDATE schema_migrations SET dirty = false;"
   ```

4. **Re-run migrations:**
   ```bash
   docker compose up migrate
   ```

5. **If the migration is partially applied**, you may need to manually undo the partial changes before retrying. Check the specific `.up.sql` file (in `api/migrations/` of the openctem repository) to understand what ran and what did not.

### Rolling Back Migrations

Each migration has a corresponding `.down.sql` file. Run the migrations image
with a different command:

```bash
# Roll back the last migration
docker compose run --rm migrate \
  -path=/migrations -database "postgres://openctem:PASSWORD@postgres:5432/openctem?sslmode=require" down 1

# Roll back to a specific version
docker compose run --rm migrate \
  -path=/migrations -database "postgres://openctem:PASSWORD@postgres:5432/openctem?sslmode=require" goto <version>
```

**Warning:** Down migrations may cause data loss. Always back up before rolling back.

---

## Rollback Procedures

### Docker Compose Rollback

#### 1. Revert the Version

```bash
cp .env.backup-YYYYMMDD .env     # or set OPENCTEM_VERSION back by hand
```

#### 2. Pull and Restart with the Previous Version

```bash
docker compose pull
docker compose up -d
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
docker compose stop api web
docker compose exec -T postgres pg_restore -U openctem -d openctem --clean --if-exists \
  < ./backups/pre-upgrade-YYYYMMDD.dump
```

---

## Zero-Downtime Upgrades

### Rolling Update Strategy (Kubernetes)

Kubernetes handles rolling updates natively. The Helm chart configures:

- **Pod Disruption Budget**: `minAvailable: 1` ensures at least one pod is always running.
- **Readiness probes**: New pods must pass the `/health` check before receiving traffic.
- **Autoscaling**: The API can scale on CPU/memory.

The default rolling update strategy replaces pods one at a time, waiting for each new pod to be ready before terminating the old one.

```yaml
# values.yaml
api:
  replicaCount: 2
podDisruptionBudget:
  enabled: true
  minAvailable: 1
```

The single-host Docker Compose stack restarts the API and web containers in
place; plan a short maintenance window for it.

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
   docker compose logs migrate
   ```

2. Fix the underlying issue (e.g., constraint violation, missing data).

3. Clear the dirty flag:
   ```bash
   docker compose exec postgres psql -U openctem -d openctem -c \
     "UPDATE schema_migrations SET dirty = false;"
   ```

4. Re-run the migrate service:
   ```bash
   docker compose up migrate
   ```

### Service Will Not Start After Upgrade

**Symptom:** The API or web container enters a restart loop.

1. **Check logs:**
   ```bash
   docker compose logs --tail=200 api
   docker compose logs --tail=200 web
   ```

2. **Common causes:**
   - Missing environment variable introduced in the new version. Check release notes for new required variables.
   - Migration did not complete. Verify `schema_migrations` status.
   - An image tag that does not exist under the configured image name (for example `ghcr.io/openctemio/openctem-api` with a version older than v0.9.0). `docker compose pull` reports `manifest unknown`.
   - Port conflict or resource exhaustion.

3. **Check container health:**
   ```bash
   docker inspect --format='{{json .State.Health}}' <container_id> | jq .
   ```

### Version Mismatch Between Services

**Symptom:** API returns unexpected errors. The web console shows errors on pages that worked before.

Make sure the API, web and migrations images run the same version:
```bash
docker compose images
```

Leave `API_VERSION` and `UI_VERSION` unset so `OPENCTEM_VERSION` applies to all
of them. Mixing versions is unsupported.

### Cache Invalidation After Upgrade

**Symptom:** Stale data appears in the UI. Users see old behavior after upgrade.

1. **Flush Redis cache:**
   ```bash
   docker compose exec redis redis-cli -a "$REDIS_PASSWORD" FLUSHALL
   ```

2. **Clear browser caches:** Instruct users to hard-refresh (Ctrl+Shift+R / Cmd+Shift+R) or clear their browser cache.

3. **Restart the API** to clear any in-memory caches:
   ```bash
   docker compose restart api
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
8. [ ] Verify health: curl https://<OPENCTEM_HOSTNAME>/health
9. [ ] Verify the web console and the admin console (/admin) load
10. [ ] Run smoke tests (login, list assets, view dashboard)
11. [ ] Check for errors in logs: docker compose logs --tail=200 api
12. [ ] Verify migration version matches expected
13. [ ] Send "maintenance complete" notification
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
   cp .env.backup-YYYYMMDD .env
   docker compose pull && docker compose up -d
   ```
3. **If rollback fails or database is incompatible:** Restore from the pre-upgrade database backup:
   restore it as in [When NOT to Roll Back](#when-not-to-roll-back), then
   `docker compose up -d`.
4. **Communicate status:** Notify users that the upgrade has been rolled back and the platform is restored. Schedule a follow-up maintenance window after the issue is resolved.
5. **Post-incident:** Document what went wrong, root cause, and preventive measures.
