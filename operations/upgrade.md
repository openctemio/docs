---
title: Upgrading
parent: Operations
nav_order: 1
---

# Upgrading
{: .no_toc }

The general procedure for moving an installation to a newer release. A release
with breaking changes has its own upgrade guide; read it first.

1. TOC
{:toc}

---

## Release-specific guides

| From | To | Guide |
|---|---|---|
| v0.8.0 | v0.9.0 | [Upgrading from v0.8.0 to v0.9.0](https://github.com/openctemio/openctem/blob/develop/api/docs/operations/upgrade-v0.8-to-v0.9.md): two migration hops, new image names, sensor protocol v1 removed, access and permission changes. Plan a maintenance window. |

Read the [release notes](https://github.com/openctemio/openctem/releases) of
every version between yours and the target. How versions are numbered:
[Versioning and releases](versioning.md).

## How upgrades work

- **One version for the platform.** The API, the web console, the migrations
  image and the all-in-one image share the release tag. Always run them at the
  same version.
- **Migrations run before the API.** The Compose `migrate` service, the Helm
  migration Job and the all-in-one start-up apply them first. The API never
  migrates the schema itself: on start it checks the schema and refuses to start
  when it is behind, dirty (a migration failed midway), or older than the
  migration baseline.
- **Migrations are backward compatible by design** (expand, then contract in a
  later release), so the previous release keeps working against the new schema.
  Exceptions are called out in the release's upgrade guide.
- **Sensors are released separately.** The platform shows each sensor's version
  against `SENSOR_LATEST_VERSION` and `SENSOR_MIN_VERSION`. Upgrade the platform
  first unless the release guide says otherwise.

The reasoning, the CI guard on destructive migrations and dirty-migration
recovery are in
[safe-deploy-and-migrations.md](https://github.com/openctemio/openctem/blob/develop/api/docs/deployment/safe-deploy-and-migrations.md).

## Before every upgrade

1. **Back up** the database, the secrets and the volumes
   ([Backup and restore](backup-restore.md)), and check the dump is readable.
2. **Check the migration state.** `dirty` must be `f`:

   ```bash
   docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT version, dirty FROM schema_migrations"'
   ```

3. **Read the release notes** for new required settings and removed ones.
4. **Rehearse** large upgrades on a copy of production.

## Docker Compose

In `api/deploy` of your checkout:

```bash
NEW_VERSION=v0.9.1   # the release you upgrade to
git fetch --tags
git checkout "$NEW_VERSION"
diff <(grep -o '^[A-Z_]*=' .env | sort) <(grep -o '^[A-Z_]*=' .env.example | sort)
sed -i "s|^OPENCTEM_VERSION=.*|OPENCTEM_VERSION=$NEW_VERSION|" .env
docker compose pull
docker compose up -d
docker compose ps
```

The `diff` lists settings the new `.env.example` adds (and ones you set
yourself). Add any new required setting before `up`. `migrate` must exit with
code 0 before the API starts; then check `https://<host>/health` and sign in.

If you use overlays, pass the same `-f` files to every command.

## All-in-one image

Pull the new tag and recreate the container with the same volume and env file
(see [All-in-one image](../install/all-in-one.md#upgrading)). Migrations run on
start; with several replicas, only one migrates at a time.

## Kubernetes (Helm)

```bash
helm repo update
helm upgrade openctem openctem/openctem -n openctem -f values.yaml --version <chart-version>
```

Use the chart version whose `appVersion` is the release you want
(`helm search repo openctem/openctem --versions`). The migration Job runs before
the new pods. Read the "Upgrading to" sections of the
[chart README](https://github.com/openctemio/helm-charts/blob/main/charts/openctem/README.md)
for every chart version you cross.

## Rollback

- **Roll the application back, leave the schema forward.** Set the previous
  version and restart (`docker compose up -d`, `helm rollback`, or the previous
  all-in-one tag). The previous release passes its schema check against the
  newer schema, because the check only refuses a schema that is behind.
- **Do not run down migrations** to undo a release. Some data migrations cannot
  be reversed; the way back from those is the pre-upgrade backup.
- `helm rollback` reverts Kubernetes objects only, never the database.

## After the upgrade

- Check the API log for warnings at start-up (see [Log reference](logs.md)).
- Update sensors when the release raises `SENSOR_MIN_VERSION` or the release
  guide asks for it: [Sensors](../sensors/index.md).
- Update API clients and CI pipelines for any removed or renamed routes listed
  in the release notes.
