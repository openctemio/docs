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
| v0.11.x | v0.12.0 and later | [From v0.11 to v0.12.0](#from-v011-to-v0120) below: signed jobs on by default (a job signer is required in production), `AI_TRIAGE_ENABLED` removed, campaigns hold tasks. |
| v0.10.x | v0.11.0 | [From v0.10 to v0.11.0](#from-v010-to-v0110) below: additive migrations, `ADMIN_AUDIT_SINK` for managed services, re-run of the database role script, console pages moved, second super admin approvals. |
| v0.9.x | v0.10.x | [From v0.9 to v0.10](#from-v09-to-v010) below: the platform console becomes its own service on its own site, new required settings, removed variables, migrations that need the API stopped. Plan a maintenance window. |
| v0.8.0 | v0.9.0 | [Upgrading from v0.8.0 to v0.9.0](https://github.com/openctemio/openctem/blob/develop/api/docs/operations/upgrade-v0.8-to-v0.9.md): two migration hops, new image names, sensor protocol v1 removed, access and permission changes. Plan a maintenance window. |

Cross one minor version at a time (v0.9.x to v0.10.1, then to v0.11.0, then onward to
v0.12.0 and the later releases), with a backup before each step. v0.15.5 is the newest
release at the time of writing.

### Ingest: uploads are applied in the background

This applies to v0.15.0, the release that contains the ingest queue
changes. The migrations only add columns and tables; deploy the API and its workers
together. Then check:

- **API clients see `202`.** `POST /api/v1/ci/runs/{id}/results` and a committed
  `POST /api/v1/findings/imports` no longer apply the report in the request. They answer
  `202` (an `upload_id` or the receipt's id, and a `Location`), and the ingest worker applies
  the report. A client that read the counts from the `201` body must read the `Location`, or
  `GET /api/v1/ci/runs/{id}/results/{report_id}?wait=10` and
  `GET /api/v1/findings/imports/{id}/result?wait=10`. A dry run still answers `200`.
- **The CI gate can answer `503 INGEST_PENDING`** with `Retry-After` while uploads are applied,
  and fails a run with `upload_not_applied` when an upload could not be applied. `openctem-ci`
  retries for `OPENCTEM_GATE_WAIT` (default 10 minutes); update it so it also reads the upload's
  result. An older one keeps working, but its log shows results the platform has already decided.
- **Back-pressure.** Past `INGEST_MAX_PENDING_PER_TENANT` unfinished jobs an upload gets
  `429 INGEST_QUEUE_FULL` with `Retry-After`; when the queue depth cannot be read it gets `503`
  (sensor segments used to be accepted).
- **A second database pool.** The ingest worker writes through its own pool of
  `DB_INGEST_MAX_CONNS` connections (default 8), apart from `DB_MAX_OPEN_CONNS`. Check that
  PostgreSQL's `max_connections` covers both pools on every server, with room for the other
  clients. New settings: `INGEST_WORKERS` (4) and `INGEST_MAX_RUNNING_PER_TENANT` (2).
- **Uploads are stored encrypted** with a key derived from `APP_ENCRYPTION_KEY` until applied;
  keep that key as for any other encrypted data. An upload that fails for good with a fixed
  code is deleted at once; one that ran out of retries (`apply_failed`) is kept 7 days so the
  same upload sent again can be retried.
- **Imports run with the uploader's rights at apply time.** A member removed or suspended
  while the upload waited is refused (`uploader_not_permitted`); a demoted administrator
  imports with the member's data scope.
- **Quarantine.** A quarantined sensor report is marked accepted only after it was applied.
- **Retention.** A new hourly job deletes applied uploads and finished jobs (after 30 days).

See [Ingesting results](../api/ingest.md).

### From v0.11 to v0.12.0

The release notes of v0.13.0 to v0.15.5 add no further deployment step beyond
[ingest uploads](#ingest-uploads-are-applied-in-the-background) (v0.15.0); apply the
steps below once, when you cross v0.12.0.

- **Signed jobs are on by default.** The Compose file now runs the job signer
  (`signer`) and sets `SIGNER_SOCKET`; the signer creates its key on first start. A
  production API refuses to start without `SIGNER_SOCKET` unless
  `SIGNER_DANGEROUS_ALLOW_UNSIGNED_JOBS=true`. Pull the new Compose file (or add the
  signer to your own deployment) before the upgrade. On an install that already has
  scopes, run the scope ledger bootstrap described in `docker-compose.job-signer.yml`,
  or set `SIGNER_LEDGER=audit` in `.env` until it is done. The all-in-one image starts
  the signer itself, with its key under `/data/signer`. Back up the `signer-keys` volume
  offline.
- **Remove `AI_TRIAGE_ENABLED`** from the environment: start-up refuses it. A provider
  key makes platform AI available, and each organization turns AI triage on itself in
  **Settings > AI**; organizations that already used it stay on.
- **All-in-one image.** Each process runs under its own user with only its own
  settings, and the gateway's storage moves from `/data/caddy` to
  `/data/gateway/caddy` on the first start (automatic). In TLS mode `files`, the key
  under `/certs` must be readable by uid 1004.
- **Bundled Compose sensor.** It no longer shares a network with PostgreSQL and Redis.
- **Remediation campaigns hold tasks.** The campaign finding filters and the endpoints
  built on them are removed (`GET /api/v1/remediation/campaigns/{id}/findings`,
  `POST .../{id}/resolve`, `POST .../{id}/refresh`); what a campaign tracked becomes its
  tasks.
- **Helm.** Chart 0.32.0 and later add the job signer; the newest chart is 0.33.0
  (`appVersion` v0.12.0). See [Kubernetes](../install/kubernetes.md).

Source: `api/CHANGELOG.md`, section v0.12.0 (Security and Removed entries).

### From v0.10 to v0.11.0

Migrations `002908` to `002915` are all additive; the API can keep running while
they apply. Then check:

- **Managed services need the administrators' audit sink.** With
  `MANAGED_SERVICE=true` and `APP_ENV=production` the API refuses to start unless
  `ADMIN_AUDIT_SINK` is set (`https://...` with `ADMIN_AUDIT_SINK_SECRET`,
  `syslog+tls://...`, or `file://...`). Set it before upgrading. The Ansible kit sets
  it from `openctem_admin_audit_sink` (`file` or `https`). Self-managed
  installations (`MANAGED_SERVICE` unset) are not affected. See
  [Audit log](../security/audit-log.md).
- **Re-run the database role script when the console has its own role.**
  Installations with `DB_ADMIN_USER` re-run `deploy/postgres/least-privilege-roles.sql`
  with `admin_user` after the migrations, so the console role gets the new
  `admin_approvals` table and the API role loses it. The Compose stack does this on
  `up` (the `db-grants` job runs after `migrate`); other deployments run the script
  themselves ([Docker Compose](../install/docker-compose.md),
  [Backup and restore](backup-restore.md)).
- **Console pages moved.** The console has one **Health** page (`/health`) and one
  **Platform scanning** page (`/scanning/platform`); `/operations`, `/system`,
  `/system/platform-scanning` and `/system/shared-sensors` no longer exist and
  have no redirects. The sidebar groups are now Customers, Scanning, Security,
  Settings and Monitoring ([Platform console](../console/index.md)).
- **A second super admin approves the most dangerous console actions.** With two or
  more named super admins, making or removing a super admin, turning off the
  security-key requirement, removing or relaxing the administrators' identity
  provider, opening sign-up, re-signing an audit chain and deleting an organization
  now need another super admin's approval ([Approvals](../console/security.md#approvals)).
- **Settings moved to the console.** CAPTCHA keys, the deployment region, the
  default storage quota, an alert webhook and the platform AI provider are set in
  the console ([Console settings](../console/settings.md)). Nothing to do:
  `CAPTCHA_TURNSTILE_*`, `DEPLOYMENT_REGION` and the AI provider keys still work
  and lock their setting; `STORAGE_TENANT_QUOTA_MB` stays the default until the
  console stores one. `SIGNUP_MODE=open` no longer stops start-up without CAPTCHA
  keys: open sign-up stays closed until a CAPTCHA is configured.
- **Deleting an organization waits 14 days.** An owner's deletion now schedules it
  (`DELETE /api/v1/tenants/{tenant}` answers `202` with `deletion_due_at`) and any
  owner can cancel from the sign-in page; a super admin can still **Delete now**
  ([Delete an organization](../console/organizations-and-users.md#delete-an-organization)).
- **Suspension and account blocking.** Organizations can be suspended and accounts
  blocked from the console; a suspended organization's credentials get
  `403 ORGANIZATION_SUSPENDED`.
- **Console sessions.** At most three console sessions per administrator; a super
  admin's write is refused with `503 AUDIT_UNAVAILABLE` when the admin activity log
  cannot be written; administrator accounts can no longer sign in on the
  organization site. A console tab open during the upgrade may need a reload.
- **API clients.** Dashboard SLA and MTTR fields may be `null` when they cannot be
  measured. `GET /api/v1/admin/platform-users` no longer requires `q`. The program
  feed admin routes (`/api/v1/admin/program-feed`) are removed.
- **Helm and Ansible.** Use the chart and kit release that names v0.11.0
  ([Kubernetes](../install/kubernetes.md), [Ansible](../install/ansible.md)); at
  the time of writing the newest kit entry is v0.15.5 and the newest chart is 0.33.0.

### From v0.9 to v0.10

Several migrations of v0.10.0 drop columns the previous API reads. **Stop the API
while the migrations run** (Compose: `docker compose stop api web` before
`docker compose up -d`), then start the new release. Before upgrading:

- **Set `FINGERPRINT_KEY`** (required outside development, at least 32
  characters). On an existing installation set it to the current
  `APP_ENCRYPTION_KEY` value, so every stored secret fingerprint stays valid, and
  never rotate it.
- **Replace `TENANT_CREATION_MODE` with `SIGNUP_MODE`** and remove
  `AUTH_ALLOW_REGISTRATION`; the API refuses to start while they are set.
  `admin_only` is `SIGNUP_MODE=disabled` (the default); `self_service` is
  `SIGNUP_MODE=open`, which needs the platform e-mail and, for self-service
  organizations, starting limits (`SELF_SERVICE_START_LIMITS`, or limits saved in
  the console) before start.
- **Remove the retired sensor version variables** `SENSOR_LATEST_VERSION`,
  `SENSOR_MIN_VERSION`, `SENSOR_SDK_LATEST_VERSION` and `SENSOR_SDK_MIN_VERSION`:
  the API refuses to start while one is set. `SENSOR_IMAGE` still points the
  install snippets at a mirror. Edited sensor templates move to the
  `configs/sensor-products` layout (`SENSOR_CONFIG_TEMPLATES_DIR`).
- **Note your legal settings.** `LEGAL_*`, `SECURITY_CONTACT`, `SECURITY_POLICY_URL`,
  `SECURITY_TXT_ENABLED` and `NEXT_PUBLIC_TERMS_URL`/`NEXT_PUBLIC_PRIVACY_URL` are no
  longer read: enter them in the console under **Settings › Legal** after the
  upgrade.
- **Reconfigure the admin audit sink** if it used `ADMIN_AUDIT_SINK_TOKEN`,
  `syslog+tcp://` or `syslog+udp://` (now `https://` with `ADMIN_AUDIT_SINK_SECRET`,
  `syslog+tls://` or `file://`).

The platform console:

- **It is its own service on its own site.** The Compose stack runs the `console`
  service (`ghcr.io/openctemio/openctem-console`); the gateway serves it at
  `https://<host>:8443` (`OPENCTEM_ADMIN_SITE=port`, the default) or on its own
  host name (`OPENCTEM_ADMIN_SITE=host` with `OPENCTEM_ADMIN_HOST`). There is no
  `/admin` path on the main site. Publish port 8443 (the Compose file does; with
  the all-in-one image add `-p 8443:8443`). Deployments other than this Compose
  file add the console service.
- **Who may reach it.** Only private networks by default: an operator who reaches
  the console from a public address sets `OPENCTEM_ADMIN_ALLOWED_CIDRS` (and the
  API's `ADMIN_ALLOWED_CIDRS` outside Compose) before upgrading, or the console
  answers 403.
- **Administrators sign in again** on the console's site, and press **Elevate**
  before changing anything (`ADMIN_ELEVATION=off` keeps acting as their own role).
  A platform identity provider's redirect URI becomes `<console origin>/login/callback`.
- **Security keys** need `ADMIN_PUBLIC_URL` set to the console's origin
  ([Where the console is](../console/index.md#where-the-console-is)).
- **In production, the console's CSRF key** is derived from `AUTH_JWT_SECRET` (or
  `APP_ENCRYPTION_KEY` when it is derived); with `AUTH_PROVIDER=oidc` set
  `AUTH_JWT_SECRET` explicitly, the same on every replica.

Sensors and scanning:

- **The sensor mTLS listener moved from `:8443` to `:9443`.** Only a deployment
  that publishes or proxies it itself changes its target (or sets
  `SENSOR_MTLS_LISTEN_ADDR=:8443` and `SENSOR_MTLS_UPSTREAM=api:8443`); the Compose
  overlays already use 9443.
- **Update sensors to a release that reports `http.identity@1`** before upgrading,
  and restart sensors that register a manifest afterwards; until then, jobs on
  program targets that require identification wait.
- **Jira inbound webhooks** move to the integration's own URL
  (`/hooks/jira-integrations/{id}`): create the webhook again with the new URL and
  secret.
- **GitHub inbound webhooks** move to the integration's own URL
  (`/hooks/github-integrations/{id}`); `/api/v1/webhooks/incoming/github?tenant=` is
  removed. Change the URL of each GitHub webhook. A secret already generated keeps
  working on the organization's first GitHub integration; generate one for any other
  GitHub integration.
- Behind a Cloudflare Tunnel, set `OPENCTEM_CLIENT_IP_HEADERS=Cf-Connecting-Ip` so the
  gateway passes the real client address.

Data and access changes to plan for:

- **Suppression rules need an end date.** A rule without one expires 90 days after
  the upgrade and its findings reopen then; review the rules flagged **Review** in
  Exceptions before that date.
- **API keys** get 403 on `/audit-logs` (read the audit log with a user session),
  and organization keys without a user are revoked: mint a new key (bound to its
  creator).
- **Remediation keys** of existing findings change on a backfill:
  `refingerprint -remediation-keys` (dry run), then `-apply`. Campaigns that track
  an old key are re-created from the new group. Optional: `repomerge` (dry run)
  and `repomerge -apply` merge duplicate repository assets.
- **API clients:** `GET /api/v1/fleet` is removed (use the sensor and CI pipeline
  lists); system roles (`admin`, `member`, `viewer`) change only through the member
  role route, not `/users/{id}/roles`; the Researcher role has an organization's own
  ID (`GET /api/v1/roles`); `properties.technologies` is now `technologies`.

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
- **Sensors and the SDK are released separately.** The platform judges each
  sensor against the compatibility ranges in its `versions.yaml` and learns newer
  sensor and SDK releases from the signed release feed, without a platform release
  ([Versioning](versioning.md)). Upgrade the platform first unless the release
  guide says otherwise.

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
   release notes ([Verify a release](versioning.md#verify-a-release)). In a controlled or
   air-gapped environment, follow
   [the upgrade procedure there](../install/air-gapped.md#6-upgrades-in-a-controlled-environment).
5. **Rehearse** large upgrades on a copy of production.

## Docker Compose

In `api/deploy` of your checkout:

```bash
NEW_VERSION=v0.15.5   # the release you upgrade to
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
- Update sensors when the console or the Sensors page reports them outdated or
  unsupported, or when the release guide asks for it: [Sensors](../sensors/index.md).
- With `DB_ADMIN_USER`, check the API's start-up log: it logs an error when the API
  role can still write the console's tables (the role script was not re-run).
- Update API clients and CI pipelines for any removed or renamed routes listed
  in the release notes.
