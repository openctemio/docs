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

Upgrades within v0.9 (v0.9.0 to v0.9.6) need no guide of their own. Check
these points when you reach v0.9.5:

- **GitHub App: add Members: Read.** Binding a GitHub App installation now
  checks that the person is an owner of the GitHub organization. Without the
  **Members: Read** organization permission no organization installation can
  be bound ([GitHub App permissions](../scanning/ci-integration.md#github-app-permissions)).
- **GitLab: group or project access tokens only.** A new GitLab connection
  made with a personal access token is refused. Connections made earlier
  keep working until removed; reconnect them with a group access token.
- **Break-glass overrides need the full commit id.** Overrides saved with an
  abbreviated id stop applying; create them again.
- **Sensors.** Sensor v0.21 runs the daemon with platform commands by default
  and detects its tools; `-tools`, `SENSOR_TOOLS`, `-daemon` and
  `-enable-commands` are deprecated. See
  [Upgrade, back up and remove](../sensors/operate.md).

Check these points when you reach v0.9.6:

- **CI runners v0.3.0 and later only.** A pipeline on openctemio/ci v0.2.0 or
  older is refused with `403 RUNNER_OUTDATED`, which names the line to change.
  Update every pipeline to the v0.3.0 pin before you upgrade
  ([CI/CD integration](../scanning/ci-integration.md)).
- **CI trust audiences name the organization.** A migration moves GitHub and
  GitLab trust configurations to the audience `openctem:tenant:<id>`. For 90
  days a pipeline that existed before the upgrade may still request its old
  audience, until it requests the new one once; after that it is refused with
  `legacy_audience`. The trust card shows the old audience and its end date.
- **Creating or changing CI trust, and the CI settings, need a recent
  sign-in** (step-up), like a break-glass.
- **The gate fails a run that skips an expected scan** (`missing_capability`)
  when the repository has a coverage expectation.
- **Inline ignore comments and ignore files no longer hide findings** with
  runner v0.3.0. From a verified default-branch run each becomes a pending
  suppression request for the security team.
- **Accepting or dismissing a high or critical exposure takes two people.** The
  first call stores a pending request; a second approver applies it.
- **Approving a suppression rule closes the open findings it matches**, up to
  10,000 per approval.
- **SAST findings are keyed on the code they flag**, not on the engine. Existing
  findings move to the new key on their next sighting and keep their triage.
- **Platform scans run static analysis with opengrep.** A platform job whose
  tool is semgrep is refused when it is created; platform-operated sensors
  never fetch registry rules.
- **OIDC signing keys stop verifying after 6 hours** without a refresh (was 24
  hours). A longer outage of a sign-in or CI token issuer stops sign-ins or CI
  exchanges through it until it is reachable again.

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
   With Docker Compose: `./backup.sh && ./backup.sh verify` in `api/deploy`.
2. **Check the migration state.** `dirty` must be `f`:

   ```bash
   docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT version, dirty FROM schema_migrations"'
   ```

3. **Read the release notes** for new required settings and removed ones. After an upgrade
   that tightens the console's CSRF checks, a browser tab opened before the upgrade gets one
   `403` on its first write; reloading the page fixes it.
4. **Verify the images** of the new release with the `cosign` commands in its
   release notes ([Verify a release](versioning.md#verify-a-release)).
5. **Rehearse** large upgrades on a copy of production.

## Docker Compose

In `api/deploy` of your checkout:

```bash
NEW_VERSION=v0.9.6   # the release you upgrade to
git fetch --tags
git checkout "$NEW_VERSION"
diff <(grep -o '^[A-Z_]*=' .env | sort) <(grep -o '^[A-Z_]*=' .env.example | sort)
sed -i "s|^OPENCTEM_VERSION=.*|OPENCTEM_VERSION=$NEW_VERSION|" .env
docker compose pull
docker compose run --rm --no-deps api -check-config
docker compose up -d
docker compose ps
```

The `diff` lists settings the new `.env.example` adds (and ones you set
yourself). Add any new required setting before `up`; `-check-config` reports the
first setting the new release refuses, without starting anything. On `up`, the
one-shot `migrate` service applies the database migrations and must exit with
code 0 before the API starts (the API refuses to start on an older schema); then
check `https://<host>/health` and sign in.

`OPENCTEM_VERSION` sets the tag of every platform image in the stack. Leave the
per-image `API_VERSION` and `UI_VERSION` overrides unset.

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
