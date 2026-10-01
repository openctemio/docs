# Upgrading to the Sensor Release (agents → sensors)

> **Applies to** the release that renames *agents* to *sensors*
> ([RFC-023 §9.5](https://github.com/openctemio/api/blob/develop/docs/rfcs/RFC-023-scan-zones-and-scanners.md),
> database migration **000230**). The complete list of API changes is the
> [sensor rename contract](https://github.com/openctemio/api/blob/develop/docs/rfcs/RFC-023-sensor-rename-contract.md).

OpenCTEM used to call every runtime that scans, collects or reports for the
platform an **agent**. From this release the umbrella term is **sensor**, with
four roles:

| Role | What it is | Was called |
|---|---|---|
| **Scanner** | Runs scan jobs inside a network (nuclei, nmap, Tenable bridge, …) | agent (`worker`, `scanner`, EASM `sensor`) |
| **Agent** | Runs on an endpoint and reports about that host | — (new meaning of the word) |
| **Collector** | Pulls or receives data from other systems (SIEM, cloud, CI) | agent (`collector`) |
| **Monitor** | Watches continuously and reports changes | — |

The rename is complete in the platform — database, API, permissions, audit,
logs, metrics and UI. **Sensors already deployed keep working unchanged**: the
protocol they speak is frozen and still served, and every stored value that
used the old name is converted by the upgrade.

## Table of Contents

- [What changes and what keeps working](#what-changes-and-what-keeps-working)
- [Upgrade order](#upgrade-order)
- [Before you upgrade](#before-you-upgrade)
- [Step 1 — Upgrade the platform](#step-1--upgrade-the-platform)
- [What the database migration converts](#what-the-database-migration-converts)
- [Step 2 — Update integrations](#step-2--update-integrations)
- [Step 3 — Upgrade sensors (when the new sensor release ships)](#step-3--upgrade-sensors-when-the-new-sensor-release-ships)
- [Step 4 — Custom sensors built with the SDK](#step-4--custom-sensors-built-with-the-sdk)
- [Step 5 — Retire the old protocol (optional, later)](#step-5--retire-the-old-protocol-optional-later)
- [Verification checklist](#verification-checklist)
- [Rollback](#rollback)
- [Troubleshooting](#troubleshooting)

---

## What changes and what keeps working

| Area | After the upgrade | Old name | Old name keeps working? |
|---|---|---|---|
| Database | Tables `sensors`, `sensor_api_keys`; columns `sensor_id`, `platform_sensor_id`, `sensor_preference`, `is_platform_sensor` | `agents`, `agent_api_keys`, `agent_id`, … | **Converted by migration 000230** |
| Permissions | `sensors:read`, `sensors:write`, `sensors:delete`, `sensors:commands:read/write/delete` | `agents:*` | **Converted** in every role, group, permission set and `oct_` API-key scope; effective access is unchanged |
| Management REST API | `/api/v1/sensors/...` | `/api/v1/agents/...` | Yes: **308 redirect** until **1 April 2027**, then removed |
| Sensor protocol v1 | — | `/api/v1/agent/*`, `/api/v1/agent/credentials/ingest`, `/api/v1/validation/evidence` | **Yes, byte-for-byte unchanged**, until you raise the minimum sensor protocol |
| Module id | `sensors` | `agents` | **Converted** (module toggles keep their state) |
| Notification event types | `sensor.offline`, `sensor.error` | `agent.offline`, `agent.error` | **Converted** in webhooks, notification integrations and muted types |
| Audit log | New events `sensor.*`, resource type `sensor` | `agent.*` | Historical rows stay as written (the log is hash-chained); a `sensor.*` filter also returns them |
| Logs and metrics | `sensor_id`, `sensor_name`; `sensors_online`, `sensor_commands_executed_total`, … | `agent_id`, `agents_online`, … | No — update dashboards and alerts that filter on them |
| API server settings | `SENSOR_*` environment variables | `AGENT_*` | Yes, read with a startup warning |
| UI | *Settings → Sensors* | *Agents* pages | Old bookmarks redirect; saved browser preferences are migrated |

## Upgrade order

```
1. Platform: API + migration 000230 + UI, together  ← deployed sensors keep running
2. Your integrations: scripts, SIEM rules, dashboards, alerts
3. Sensors, when the new sensor release ships       ← at your own pace
4. Custom sensors built with the SDK                 ← codemod
5. Raise the minimum sensor protocol                 ← only when the fleet is upgraded
```

## Before you upgrade

1. **Back up the database.** See the [Upgrade Guide](upgrade-guide.md#pre-upgrade-checklist)
   and [Backup & Restore](backup-restore.md). The migration renames tables and
   rewrites stored values; the backup is your rollback.
2. **Plan a short stop.** The upgrade is *stop old API → migrate → start new
   API*. There are no compatibility views: columns are renamed inside shared
   tables (`commands`, `findings`, `scan_sessions`, …), so an old and a new API
   cannot run against the same database at the same time. Multi-replica
   deployments scale the API to zero first.
3. **Find automation that calls the management API** (`/api/v1/agents`). It
   keeps working through the redirect until 1 April 2027; plan the switch to
   `/api/v1/sensors`. Clients must follow a `308` (curl needs `-L`).
4. **Find dashboards, alerts and SIEM rules** that use `agent_id`, `agent_name`,
   the metrics `agents_online`, `agent_commands_executed_total`,
   `agent_heartbeat_latency_seconds`, `platform_agents_active`, or audit actions
   `agent.*`.
5. **Inventory your sensors** on the Agents page. Nothing has to change on
   them now.

## Step 1 — Upgrade the platform

Upgrade the API, the migration and the UI **to the same release, together**.
The new UI checks `sensors:*` and calls `/api/v1/sensors`; an old UI against the
new API (or the reverse) shows the sensor pages as forbidden.

**Docker Compose**

```bash
# .env.versions.prod — API, UI and migrations move together
API_VERSION=<sensor release>
UI_VERSION=<sensor release>
MIGRATIONS_VERSION=<sensor release>

docker compose -f docker-compose.prod.yml stop api
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml run --rm migrations   # applies 000230
docker compose -f docker-compose.prod.yml up -d
```

**Kubernetes / Helm**

```bash
helm upgrade openctem openctemio/openctem -n openctem -f values.yaml
```

The migration job runs as a pre-upgrade hook before the new API starts.

**Skipping versions** is supported: migrations apply in order, and 000230 is
idempotent, so a re-run or a resumed migration lands in the same state.

**Confirm the upgrade is complete:**

```bash
docker compose exec api ./server -sensor-upgrade-check
```

It prints one line per check (`ok`, `kept`, `LEFTOVER`) and exits `0` when
nothing the migration should have converted is left, `1` otherwise. The API
also runs a lighter version at every start and logs
`WARN pre-sensor vocabulary left after upgrade` for anything left over.

**API server settings.** The API's own `AGENT_*` variables become `SENSOR_*`.
The new name is read first; an old name still works and logs
`WARN deprecated configuration` naming both; the API refuses to start only if
both are set to different values. Rename them when convenient:

| Old | New |
|---|---|
| `AGENT_CONFIG_TEMPLATES_DIR` | `SENSOR_CONFIG_TEMPLATES_DIR` |
| `AGENT_PUBLIC_API_URL` | `SENSOR_PUBLIC_API_URL` |
| `AGENT_KEY_TTL` | `SENSOR_KEY_TTL` |
| `AGENT_LB_JOB_WEIGHT`, `AGENT_LB_CPU_WEIGHT`, `AGENT_LB_MEMORY_WEIGHT`, `AGENT_LB_DISK_IO_WEIGHT`, `AGENT_LB_NETWORK_WEIGHT` | same with `SENSOR_` |
| `AGENT_LB_MAX_DISK_THROUGHPUT_MBPS`, `AGENT_LB_MAX_NETWORK_THROUGHPUT_MBPS` | same with `SENSOR_` |

The default template directory moved from `configs/agent-templates` to
`configs/sensor-templates`; if only the old directory exists (for example a
mounted ConfigMap) it is still used, with a warning.

**For up to five minutes after the migration**, a non-admin member may be
refused a sensor page while the permission cache still holds the old ids.
Owners and admins are not affected.

## What the database migration converts

| Data | Conversion |
|---|---|
| Tables | `agents` → `sensors`, `agent_api_keys` → `sensor_api_keys` |
| Columns | `agent_id` → `sensor_id` in every table that has it; `commands.platform_agent_id` → `platform_sensor_id`; `scans.agent_preference` → `sensor_preference`; `sensors.is_platform_agent` → `is_platform_sensor` |
| Constraints, indexes, trigger, row-level-security policy, functions | Renamed or rewritten |
| Permissions | `agents:*` → `sensors:*` in the catalog, role grants, group grants, permission sets and `oct_` API-key scopes |
| Module | `agents` → `sensors`, including tenant module toggles |
| Notification event types | `agent.offline` / `agent.error` → `sensor.*`, including references in webhooks, notification integrations and muted types |
| Sensor API-key scopes | `agent:heartbeat|read|write` → `sensor:*`, `admin:agents` → `admin:sensors` |
| Pipeline templates | `settings.agent_preference` → `settings.sensor_preference` |
| Tenable integrations | `config.execution_mode` `agent` → `sensor`, `config.agent_id` → `config.sensor_id` |
| Assets | `source_type` and `discovery_source` `agent` → `sensor` |

**Deliberately not rewritten**, and why:

| Data | Why |
|---|---|
| Audit log rows `agent.*` | Hash-chained, tamper-evident history. Filters on `sensor.*` include them. |
| Asset state history `source = 'agent'` | Append-only by design. Returned as `sensor`. |
| Platform admin audit log, notification and webhook delivery history | History |
| Job payload key `agent_preference` | Part of protocol v1, read by deployed sensors |
| Sensor `type` values (`worker`, `scanner`, `sensor`, `collector`, `runner`) | Protocol v1 values |

## Step 2 — Update integrations

### Management REST API

| Before | After |
|---|---|
| `/api/v1/agents` (`GET`, `POST`) | `/api/v1/sensors` |
| `/api/v1/agents/stats`, `/available-capabilities` | `/api/v1/sensors/...` |
| `/api/v1/agents/{id}` (`GET`, `PUT`, `DELETE`) | `/api/v1/sensors/{id}` |
| `/api/v1/agents/{id}/config-templates`, `/regenerate-key`, `/activate`, `/deactivate`, `/revoke` | `/api/v1/sensors/{id}/...` |

Old paths answer:

```http
HTTP/1.1 308 Permanent Redirect
Location: /api/v1/sensors/<same path>?<same query>
Deprecation: @1790812800
Sunset: Thu, 01 Apr 2027 00:00:00 GMT
Link: </api/v1/sensors>; rel="successor-version"
```

Each use is counted in `deprecated_management_path_requests_total{method}` and
logged, so you can see who still calls the old path.

Field renames in management requests and responses:

| Where | Before | After |
|---|---|---|
| Create sensor response | `agent` | `sensor` |
| Commands (request, responses, list filter) | `agent_id` | `sensor_id` |
| Scan sessions | `agent_id` | `sensor_id` |
| Scans (requests, responses, export files) | `agent_preference` | `sensor_preference` (import still reads old export files) |
| Pipeline template `settings` | `agent_preference` | `sensor_preference` |
| Capability usage stats | `agent_count`, `agent_names` | `sensor_count`, `sensor_names` |
| Platform stats `tier_stats` | `total_agents`, `online_agents`, `offline_agents` | `total_sensors`, `online_sensors`, `offline_sensors` |
| Tenable integration `config` | `execution_mode: "agent"`, `agent_id` | `execution_mode: "sensor"`, `sensor_id` — `"agent"` is now rejected |
| Config-templates request header | `X-Agent-API-Key` | `X-Sensor-API-Key` |
| Scan trigger error code | `NO_AGENT_AVAILABLE` | `NO_SENSOR_AVAILABLE` |

### Permissions

| Before | After |
|---|---|
| `agents:read` | `sensors:read` |
| `agents:write` | `sensors:write` |
| `agents:delete` | `sensors:delete` |
| `agents:commands:read` | `sensors:commands:read` |
| `agents:commands:write` | `sensors:commands:write` |
| `agents:commands:delete` | `sensors:commands:delete` |

Existing roles, groups, permission sets and keys are converted. Scripts that
**create** roles or keys must use the new ids.

### Audit events, SIEM and notifications

New events: `sensor.created`, `sensor.updated`, `sensor.deleted`,
`sensor.activated`, `sensor.deactivated`, `sensor.revoked`,
`sensor.key_regenerated`, `sensor.key_renewed`, `sensor.connected`,
`sensor.disconnected`; resource type `sensor`; metadata `sensor_id`,
`sensor_name`, `sensor_type`. Rules written for `agent.*` match only history —
match both, for example `action =~ "^(agent|sensor)\."`.

### Logs and metrics

| Before | After |
|---|---|
| Log fields `agent_id`, `agent_name` | `sensor_id`, `sensor_name` |
| `agents_online` | `sensors_online` |
| `agent_commands_executed_total{agent_id}` | `sensor_commands_executed_total{sensor_id}` |
| `agent_heartbeat_latency_seconds` | `sensor_heartbeat_latency_seconds` |
| `platform_agents_active` | `platform_sensors_active` |
| Background jobs `agent-health`, `agent-health-checker` | `sensor-health`, `sensor-health-checker` |
| Security events `security.agent.*` | `security.sensor.*` |

Webhook, notification and report/CSV payloads carry no other agent-named
fields.

## Step 3 — Upgrade sensors (when the new sensor release ships)

Nothing changes on deployed sensors when you upgrade the platform. The renamed
sensor binary, images and Helm values ship in a later sensor release; when you
move to it:

| Before | After |
|---|---|
| Image `ghcr.io/openctemio/agent:<tag>` | `ghcr.io/openctemio/sensor:<tag>` (old tags stay pullable, frozen) |
| `AGENT_ID`, `AGENT_NAME`, `AGENT_ALLOW_PRIVATE_TARGETS`, `--agent-*` | `SENSOR_*`, `--sensor-*` — old names are read and mapped, with a startup warning; the sensor refuses to start only if old and new are set to different values |
| `~/.openctem/agent-credentials.json` | `~/.openctem/sensor-credentials.json` — moved automatically (written and verified before the old file is removed, mode `0600`); identity and key are kept, no re-registration |
| Helm values `agent.*` | `sensor.*` — the old block is mapped, with a notice in `helm upgrade` output |
| `API_URL`, `API_KEY`, `BOOTSTRAP_TOKEN` | unchanged |

## Step 4 — Custom sensors built with the SDK

Sensors built with `github.com/openctemio/sdk-go` keep working **without
recompiling** over protocol v1. When the renamed SDK is released, a codemod
renames the SDK identifiers in your code type-safely; its exact command is in
the SDK release notes.

## Step 5 — Retire the old protocol (optional, later)

When every sensor runs the new release, raise the **minimum sensor protocol**.
From then on the platform sends no new jobs to sensors below it. Until you do,
protocol v1 is served unchanged.

## Verification checklist

- [ ] `./server -sensor-upgrade-check` exits `0`.
- [ ] *Settings → Sensors* lists every sensor you had, with the same status.
- [ ] A non-admin member who could manage agents can manage sensors (allow
      five minutes after the migration).
- [ ] A deployed sensor still heartbeats, receives a job, and its results appear.
- [ ] `curl -s -o /dev/null -D - -H "Authorization: Bearer <token>" <api>/api/v1/agents`
      shows `308` and `Location: /api/v1/sensors` (use `-D -`, not `-I`: `HEAD`
      is not routed).
- [ ] New audit entries show `sensor.*`; old ones still show `agent.*`; audit
      chain verification reports no new breaks.
- [ ] Dashboards, alerts and SIEM rules use the new field and metric names.
- [ ] No `WARN deprecated configuration` lines remain at API start (or you have
      planned the rename of those settings).

## Rollback

Migration 000230 has a down migration that restores the previous schema and
values exactly. To roll back:

1. Stop the API and UI.
2. Run the down migration to 000229 **or** restore the pre-upgrade backup.
3. Deploy the previous API and UI versions together.

Deployed sensors need no action: they speak protocol v1, which both versions
serve. Data written after the upgrade is kept by the down migration and lost by
a backup restore.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| The new API refuses to start | Migration 000230 not applied | Run the migration, then start the API |
| The API refuses to start with a "deprecated configuration" conflict | An `AGENT_*` and a `SENSOR_*` variable set to different values | Keep only the `SENSOR_*` one |
| Sensor pages show "forbidden" right after the upgrade | Permission cache still holds old ids | Wait up to five minutes |
| Sensor pages stay "forbidden" | UI and API on different releases | Upgrade both to the same release |
| A script gets `308` then fails | The client does not follow redirects | Follow redirects (curl `-L`) or call `/api/v1/sensors` |
| Saving a Tenable integration fails with `invalid execution_mode` | The request sends `"agent"` | Send `"sensor"` |
| A dashboard panel went empty | It queries an old metric or log field | Use the names in [Logs and metrics](#logs-and-metrics) |
| A SIEM alert stopped firing | The rule matches `agent.*` only | Match `sensor.*` too |
