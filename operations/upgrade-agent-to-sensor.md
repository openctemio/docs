# Upgrading to the Sensor Release (agents → sensors)

> **Status:** applies to the first release that renames *agents* to *sensors*
> ([RFC-023 §9.5](https://github.com/openctemio/api/blob/develop/docs/rfcs/RFC-023-scan-zones-and-scanners.md)).
> The release notes of that version give its exact version number and migration
> number; everything else on this page applies as written.

OpenCTEM used to call every runtime that scans, collects or reports for the
platform an **agent**. From this release the umbrella term is **sensor**, with
four roles:

| Role | What it is | Was called |
|---|---|---|
| **Scanner** | Runs scan jobs inside a network (nuclei, nmap, Tenable bridge, …) | agent (`worker`, `scanner`, EASM `sensor`) |
| **Agent** | Runs on an endpoint and reports about that host | — (new meaning of the word) |
| **Collector** | Pulls or receives data from other systems (SIEM, cloud, CI) | agent (`collector`) |
| **Monitor** | Watches continuously and reports changes | — |

A CI/one-shot runtime (formerly `runner`) is a scanner with deployment
*ephemeral*.

The rename is complete — database, API, permissions, UI, SDK, binary, images
and Helm values all use *sensor*. **Nothing you already run has to change on
the day you upgrade the platform**: every old name that is stored or deployed
is either migrated automatically or keeps working for a stated period.

## Table of Contents

- [What changes and what keeps working](#what-changes-and-what-keeps-working)
- [Upgrade order](#upgrade-order)
- [Before you upgrade](#before-you-upgrade)
- [Step 1 — Upgrade the platform](#step-1--upgrade-the-platform)
- [What the database migration converts](#what-the-database-migration-converts)
- [Step 2 — Update integrations that call the API](#step-2--update-integrations-that-call-the-api)
- [Step 3 — Upgrade sensors](#step-3--upgrade-sensors)
- [Step 4 — Upgrade custom sensors built with the SDK](#step-4--upgrade-custom-sensors-built-with-the-sdk)
- [Step 5 — Retire the old protocol (optional, later)](#step-5--retire-the-old-protocol-optional-later)
- [Verification checklist](#verification-checklist)
- [Rollback](#rollback)
- [Troubleshooting](#troubleshooting)

---

## What changes and what keeps working

| Area | After the upgrade | Old name | Old name keeps working? |
|---|---|---|---|
| Database | Tables `sensors`, `sensor_api_keys`; columns `sensor_id`, `platform_sensor_id`, `sensor_preference` | `agents`, `agent_api_keys`, `agent_id`, … | **Migrated automatically** (data and schema) |
| Permissions | `sensors:read`, `sensors:write`, `sensors:delete`, `sensors:commands:*` | `agents:*` | **Migrated automatically** in every role, custom role and API-key scope; effective access is unchanged |
| Management REST API | `/api/v1/sensors/...` | `/api/v1/agents/...` | Yes, via **308 redirect** with `Deprecation` and `Sunset` headers until the sunset date, then `410 Gone` |
| Sensor protocol (what deployed sensors and SDKs speak) | Protocol v2 under `/api/v2/sensor/...` | Protocol v1 `/api/v1/agent/...`, `/api/v1/platform/...` | **Yes, unchanged.** Served until *you* raise the minimum sensor protocol |
| Audit log | New events are `sensor.*` | `agent.*` | Historical rows stay `agent.*` (the log is hash-chained; rewriting it would break tamper evidence). Filters treat both as one family |
| UI | *Settings → Sensors* (Scanners · Agents · Collectors · Scan zones) | *Agents* pages | Old bookmarks redirect; saved table/filter preferences are migrated in the browser |
| Sensor binary and images | `openctemio-sensor`, `ghcr.io/openctemio/sensor:*` | `ghcr.io/openctemio/agent:*` | Old tags stay pullable but receive no new versions |
| Environment variables, flags | `SENSOR_ID`, `SENSOR_NAME`, `SENSOR_ALLOW_PRIVATE_TARGETS`, `--sensor-*` | `AGENT_ID`, `AGENT_NAME`, `AGENT_ALLOW_PRIVATE_TARGETS`, `--agent-*` | **Mapped automatically** by the new binary, with a startup warning |
| Credentials file | `~/.openctem/sensor-credentials.json` | `~/.openctem/agent-credentials.json` | **Moved automatically** on first start of the new binary |
| Helm values | `sensor.*` (chart major version) | `agent.*` | **Mapped automatically**, with a warning in the upgrade notes |
| Go SDK | `Sensor*` identifiers | `Agent*` identifiers | Old SDK versions keep working over protocol v1; to move to the new SDK run the codemod |

Unchanged: `API_URL`, `API_KEY` and `BOOTSTRAP_TOKEN` keep their names (they
never said *agent*). Log and metric labels change from `agent_id` to
`sensor_id`; update dashboards and alerts that filter on them.

## Upgrade order

```
1. Platform (API + migrations + UI)   ← sensors keep running on protocol v1
2. Your integrations (scripts, SIEM rules, dashboards)
3. Sensors, at your own pace          ← binary, images, Helm values
4. Custom sensors built with the SDK  ← codemod
5. Raise the minimum sensor protocol  ← only when the fleet is upgraded
```

Steps 2–4 can run in any order and over weeks. The platform must come first:
a new sensor talks to an old platform only in protocol v1 terms, so it works,
but it cannot use the new features.

## Before you upgrade

1. **Back up the database** — see the [Upgrade Guide](upgrade-guide.md#pre-upgrade-checklist)
   and [Backup & Restore](backup-restore.md). This migration renames tables and
   rewrites stored values, so the backup is your rollback.
2. **Find automation that calls the management API.** Anything calling
   `/api/v1/agents` keeps working through the redirect, but plan to switch it to
   `/api/v1/sensors` before the sunset date. Clients must follow a `308`
   (curl needs `-L`; most HTTP libraries follow it by default and keep the
   method and body).
3. **Find `oct_` API keys and custom roles with `agents:*`.** They are migrated
   for you; this step is only so you recognise `sensors:*` afterwards.
4. **Find SIEM rules, notification filters and dashboards** that match
   `agent.*` audit events or `agent_id` fields. Extend them to also match
   `sensor.*` / `sensor_id` — history keeps the old names, new events use the
   new ones.
5. **Inventory your sensors.** *Settings → Sensors* shows each sensor's version
   and protocol. Nothing has to be upgraded now; it tells you what step 3 will
   cover.

## Step 1 — Upgrade the platform

Follow the normal [Upgrade Guide](upgrade-guide.md). The rename needs no extra
command: the database migration runs as part of the usual migrate step.

**Docker Compose**

```bash
# .env.versions.prod — API, UI and migrations move together
API_VERSION=<sensor release>
UI_VERSION=<sensor release>
MIGRATIONS_VERSION=<sensor release>

docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml run --rm migrations   # applies the rename
docker compose -f docker-compose.prod.yml up -d
```

**Kubernetes / Helm**

```bash
helm upgrade openctem openctemio/openctem -n openctem -f values.yaml
```

The migration job runs as a pre-upgrade hook. If your `values.yaml` still uses
`agent.*` for the bundled sensor, the chart maps it to `sensor.*` and prints a
notice; move the keys when convenient (see [Helm values](#helm-values)).

**Upgrading across several versions at once** is supported: migrations run in
order and the rename migration is idempotent, so a re-run or a resumed
migration lands in the same state.

**API server environment variables.** The API's own `AGENT_*` settings
(for example `AGENT_KEY_TTL`, `AGENT_PUBLIC_API_URL`,
`AGENT_CONFIG_TEMPLATES_DIR`) become `SENSOR_*`. The new API reads the old
names when the new ones are unset and logs a deprecation warning naming each
one; it refuses to start only if an old and a new name are set to different
values. Rename them in your `.env` / Helm values when convenient — the release
notes list every variable.

**API and UI must be upgraded together.** The new UI checks `sensors:*`
permissions and calls `/api/v1/sensors`; an old UI against the new API (or the
reverse) shows the Agents/Sensors pages as forbidden.

## What the database migration converts

| Stored data | Conversion |
|---|---|
| Tables, columns, indexes, constraints, triggers, row-level-security policies, functions | Renamed to *sensor* terms |
| Role grants (system and custom roles), permission sets | `agents:*` → `sensors:*` |
| `oct_` API-key scopes | `agents:*` → `sensors:*` |
| Settings and saved configuration that name agents (saved views and filters, dashboard widgets, notification rules, workflow nodes, scan sensor preference) | Rewritten to the new names |
| Sensor type values (`worker`, `scanner`, `sensor`, `collector`, `runner`) | Kept as input; each sensor also gets a `role` and `deployment` derived from it |
| Audit log rows | **Not changed** (hash-chained history) |

After the migration, the platform's upgrade check reports any data that still
uses the old vocabulary. A clean result means the upgrade is complete; the
release notes name the exact command.

## Step 2 — Update integrations that call the API

### Management REST API

| Before | After |
|---|---|
| `GET/POST /api/v1/agents` | `GET/POST /api/v1/sensors` |
| `GET/PUT/DELETE /api/v1/agents/{id}` | `GET/PUT/DELETE /api/v1/sensors/{id}` |
| other `/api/v1/agents/...` routes | same path under `/api/v1/sensors/...` |

Requests to the old paths get:

```http
HTTP/1.1 308 Permanent Redirect
Location: /api/v1/sensors/...
Deprecation: @<unix time>
Sunset: <HTTP date>
```

JSON field renames in management responses (for example `agent_id` →
`sensor_id`) are listed in the release notes. The sensor protocol
(`/api/v1/agent/...`) does **not** change.

### Permissions

| Before | After |
|---|---|
| `agents:read` | `sensors:read` |
| `agents:write` | `sensors:write` |
| `agents:delete` | `sensors:delete` |
| `agents:commands:read` | `sensors:commands:read` |
| `agents:commands:write` | `sensors:commands:write` |
| `agents:commands:delete` | `sensors:commands:delete` |

Existing roles and keys are converted. Scripts that **create** roles or keys
must use the new ids.

### Audit events, SIEM and notifications

New events use `sensor.*` (for example `sensor.created`,
`sensor.key_regenerated`). Rules written for `agent.*` keep matching history
only. Change rules to match both, for example `event_type =~ "^(agent|sensor)\."`.

## Step 3 — Upgrade sensors

Upgrade each sensor whenever convenient. An old sensor keeps working against
the new platform over protocol v1.

### Images and binary

| Before | After |
|---|---|
| `ghcr.io/openctemio/agent:<tag>` | `ghcr.io/openctemio/sensor:<tag>` |
| binary `agent` | binary `openctemio-sensor` |

Old image tags stay pullable but are frozen. Our GitHub and GitLab CI
templates switch to the new image in the same release; pipelines that pin the
old `:ci` tag keep running the last old version until you change the image
name.

### Environment variables and flags

The new binary reads the old names and maps them, so a sensor started with its
old configuration works unchanged and logs which names it mapped:

| Old | New |
|---|---|
| `AGENT_ID` | `SENSOR_ID` |
| `AGENT_NAME` | `SENSOR_NAME` |
| `AGENT_ALLOW_PRIVATE_TARGETS` | `SENSOR_ALLOW_PRIVATE_TARGETS` |
| `--agent-*` flags | `--sensor-*` flags |
| `API_URL`, `API_KEY`, `BOOTSTRAP_TOKEN` | unchanged |

If both the old and the new name are set **to different values**, the sensor
refuses to start and names both, rather than guessing — for
`SENSOR_ALLOW_PRIVATE_TARGETS` a wrong guess would silently allow or block
private targets.

### Credentials file

On first start the new binary moves `~/.openctem/agent-credentials.json` to
`~/.openctem/sensor-credentials.json` (mode `0600`). It writes and verifies the
new file before removing the old one, so an interrupted start loses nothing.
If you pass `--credentials` explicitly, that path is used as is.

The sensor keeps its identity and key: no re-registration, no approval, no
new bootstrap token.

### Helm values

```yaml
# Before                         # After
agent:                           sensor:
  enabled: true                    enabled: true
  image:                           image:
    repository: ghcr.io/openctemio/agent    repository: ghcr.io/openctemio/sensor
  allowPrivateTargets: false       allowPrivateTargets: false
```

The chart accepts the old `agent.*` block and maps it, printing a notice in
`helm upgrade` output. If both `agent.*` and `sensor.*` are set with
conflicting values the render fails with a message naming the keys.

## Step 4 — Upgrade custom sensors built with the SDK

Sensors you built with `github.com/openctemio/sdk-go` keep working **without
recompiling**: they speak protocol v1, which the platform still serves.

To move to the new SDK version, run the codemod in your module, then build and
test:

```bash
go get github.com/openctemio/sdk-go@<sensor release>
go run github.com/openctemio/sdk-go/cmd/sensor-migrate@<sensor release> ./...
go build ./... && go test ./...
```

The codemod renames the SDK identifiers type-safely (it uses `gopls rename`, so
your own variables named `agent` are left alone). See the SDK release notes for
the full identifier table.

## Step 5 — Retire the old protocol (optional, later)

When *Settings → Sensors* shows every sensor on the new version, raise the
**minimum sensor protocol** (platform-wide, overridable per tenant). From then
on the platform sends no new jobs to sensors below it; collectors can still
push. Usage of protocol v1 and of `/api/v1/agents` per tenant is shown on the
same page, so you can tell when it is safe.

## Verification checklist

- [ ] `curl -s <api>/health` reports the new version.
- [ ] The upgrade check reports no remaining old-vocabulary data.
- [ ] *Settings → Sensors* lists every sensor you had, with the same status.
- [ ] Users and API keys that could manage agents can manage sensors (try one
      read with a non-admin account).
- [ ] An old sensor still heartbeats, receives a job and its results appear.
- [ ] `curl -sI <api>/api/v1/agents` returns `308` with `Location: /api/v1/sensors`.
- [ ] New audit entries show `sensor.*`; old entries still show `agent.*`; the
      audit-chain verification reports no new breaks.
- [ ] SIEM rules and dashboards match both `agent.*`/`sensor.*` and
      `agent_id`/`sensor_id`.

## Rollback

The migration has a down migration, but the safest rollback is the backup you
took before upgrading:

1. Stop the API and UI.
2. Run the down migration to the previous version (`migrate ... down <n>`)
   **or** restore the pre-upgrade backup.
3. Deploy the previous API and UI versions together.

Sensors need no action: they use protocol v1, which both versions serve. A
sensor already upgraded to the new binary keeps its moved credentials file and
works against the old platform over protocol v1.

Data written after the upgrade (new findings, audit events `sensor.*`) is kept
by the down migration and lost by a backup restore — choose accordingly.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Sensors pages show "forbidden" after the upgrade | UI and API versions differ | Upgrade both to the same release |
| A script gets `308` and then fails | Client does not follow redirects, or re-sends POST as GET | Follow redirects (curl `-L`), or call `/api/v1/sensors` directly |
| A script gets `410 Gone` | The `/api/v1/agents` sunset date passed | Switch to `/api/v1/sensors` |
| A sensor refuses to start with "conflicting settings" | Old and new env vars or Helm values set to different values | Remove the old name |
| A SIEM alert stopped firing | Rule matches `agent.*` only | Match `sensor.*` too |
| An old sensor stopped receiving jobs | The minimum sensor protocol was raised | Upgrade that sensor, or lower the minimum for its tenant |
