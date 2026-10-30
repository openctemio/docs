---
title: "Sensors and scan zones permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 20
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# Sensors and scan zones: permissions

The sensor fleet: registration, pairing and grants, scan zones and the sensor protocol.

- **CTEM stages:** discovery
- **Permissions:** `sensors:approve`, `sensors:delete`, `sensors:egress:delete`, `sensors:egress:read`, `sensors:egress:write`, `sensors:grant:narrow`, `sensors:grant:widen`, `sensors:pair`, `sensors:read`, `sensors:revoke`, `sensors:write`, `sensors:zones:delete`, `sensors:zones:read`, `sensors:zones:write`

## Who can do it

Built-in roles and role templates whose permissions pass each route. Owner and administrator are included where the route allows them.

| Permission | Roles |
|---|---|
| `sensors:approve` | Owner, Administrator |
| `sensors:delete` | Owner, Administrator |
| `sensors:egress:delete` | Owner, Administrator |
| `sensors:egress:read` | Owner, Administrator |
| `sensors:egress:write` | Owner, Administrator |
| `sensors:grant:narrow` | Owner, Administrator |
| `sensors:grant:widen` | Owner, Administrator |
| `sensors:pair` | Owner, Administrator |
| `sensors:read` | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| `sensors:revoke` | Owner, Administrator |
| `sensors:write` | Owner, Administrator |
| `sensors:zones:delete` | Owner, Administrator |
| `sensors:zones:read` | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| `sensors:zones:write` | Owner, Administrator |

## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| GET | `/api/v1/proxy-pools` | `sensors:egress:read` | config: proxy pools for sensor scan traffic: tenant configuration, no asset data; credentials never returned |  | Owner, Administrator |
| POST | `/api/v1/proxy-pools` | `sensors:egress:write` | config: proxy pools for sensor scan traffic: tenant configuration, no asset data; credentials never returned |  | Owner, Administrator |
| GET | `/api/v1/proxy-pools/assignments` | `sensors:egress:read` | config: proxy pools for sensor scan traffic: tenant configuration, no asset data; credentials never returned |  | Owner, Administrator |
| PUT | `/api/v1/proxy-pools/assignments/{sensor_id}` | `sensors:egress:write` | config: proxy pools for sensor scan traffic: tenant configuration, no asset data; credentials never returned |  | Owner, Administrator |
| DELETE | `/api/v1/proxy-pools/{id}` | `sensors:egress:delete` | config: proxy pools for sensor scan traffic: tenant configuration, no asset data; credentials never returned |  | Owner, Administrator |
| GET | `/api/v1/proxy-pools/{id}` | `sensors:egress:read` | config: proxy pools for sensor scan traffic: tenant configuration, no asset data; credentials never returned |  | Owner, Administrator |
| PATCH | `/api/v1/proxy-pools/{id}` | `sensors:egress:write` | config: proxy pools for sensor scan traffic: tenant configuration, no asset data; credentials never returned |  | Owner, Administrator |
| PUT | `/api/v1/proxy-pools/{id}/endpoints` | `sensors:egress:write` | config: proxy pools for sensor scan traffic: tenant configuration, no asset data; credentials never returned |  | Owner, Administrator |
| PATCH | `/api/v1/proxy-pools/{id}/endpoints/{endpoint_id}` | `sensors:egress:write` | config: proxy pools for sensor scan traffic: tenant configuration, no asset data; credentials never returned |  | Owner, Administrator |
| POST | `/api/v1/proxy-pools/{id}/test` | `sensors:egress:write` | config: proxy pools for sensor scan traffic: tenant configuration, no asset data; credentials never returned |  | Owner, Administrator |
| GET | `/api/v1/proxy-pools/{id}/tests` | `sensors:egress:read` | config: proxy pools for sensor scan traffic: tenant configuration, no asset data; credentials never returned |  | Owner, Administrator |
| GET | `/api/v1/proxy-test-echoes/{nonce}` | no permission: public by design: the page a sensor requests through the proxy under test; the path carries the token of one live proxy_test command, anything else is 404; rate limited per address; answers only the caller's own address | system: the proxy test's echo: answers the caller's own address for the token of one live test command; no tenant data |  | see Requires |
| GET | `/api/v1/scan-zones` | `sensors:zones:read` | config: scan zones |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| POST | `/api/v1/scan-zones` | `sensors:zones:write` | config: scan zones |  | Owner, Administrator |
| GET | `/api/v1/scan-zones/coverage` | `sensors:zones:read` | config: scan zones |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| POST | `/api/v1/scan-zones/preview` | `sensors:zones:read` | config: scan zones |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| DELETE | `/api/v1/scan-zones/{id}` | `sensors:zones:delete` | config: scan zones |  | Owner, Administrator |
| GET | `/api/v1/scan-zones/{id}` | `sensors:zones:read` | config: scan zones |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| PATCH | `/api/v1/scan-zones/{id}` | `sensors:zones:write` | config: scan zones |  | Owner, Administrator |
| DELETE | `/api/v1/scan-zones/{id}/sensors/{sensorId}` | `sensors:zones:write` | config: scan zones |  | Owner, Administrator |
| PUT | `/api/v1/scan-zones/{id}/sensors/{sensorId}` | `sensors:zones:write` | config: scan zones |  | Owner, Administrator |
| GET | `/api/v1/sensor-pairings/enrollment-tokens` | `sensors:read` | config: sensor pairing (RFC-052): a pending request has no tenant until approved; the approver's tenant binds it |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| POST | `/api/v1/sensor-pairings/enrollment-tokens` | `sensors:approve` | config: sensor pairing (RFC-052): a pending request has no tenant until approved; the approver's tenant binds it | yes | Owner, Administrator |
| POST | `/api/v1/sensor-pairings/enrollment-tokens/{id}/revoke` | `sensors:approve` | config: sensor pairing (RFC-052): a pending request has no tenant until approved; the approver's tenant binds it |  | Owner, Administrator |
| POST | `/api/v1/sensor-pairings/expectations` | `sensors:pair` | config: sensor pairing (RFC-052): a pending request has no tenant until approved; the approver's tenant binds it |  | Owner, Administrator |
| GET | `/api/v1/sensor-pairings/expectations/{id}` | `sensors:pair` | config: sensor pairing (RFC-052): a pending request has no tenant until approved; the approver's tenant binds it |  | Owner, Administrator |
| POST | `/api/v1/sensor-pairings/lookup` | `sensors:pair` | config: sensor pairing (RFC-052): a pending request has no tenant until approved; the approver's tenant binds it |  | Owner, Administrator |
| GET | `/api/v1/sensor-pairings/pending` | `sensors:pair` | config: sensor pairing (RFC-052): a pending request has no tenant until approved; the approver's tenant binds it |  | Owner, Administrator |
| POST | `/api/v1/sensor-pairings/{id}/approve` | `sensors:approve` | config: sensor pairing (RFC-052): a pending request has no tenant until approved; the approver's tenant binds it |  | Owner, Administrator |
| POST | `/api/v1/sensor-pairings/{id}/reject` | `sensors:pair` | config: sensor pairing (RFC-052): a pending request has no tenant until approved; the approver's tenant binds it |  | Owner, Administrator |
| GET | `/api/v1/sensors` | `sensors:read` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| POST | `/api/v1/sensors` | `sensors:write` | config: sensor management; host details, quarantined results and config reports are owner/admin only | yes | Owner, Administrator |
| GET | `/api/v1/sensors/available-capabilities` | `sensors:read` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| GET | `/api/v1/sensors/content-policy` | `sensors:read` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| PUT | `/api/v1/sensors/content-policy` | `sensors:write` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| POST | `/api/v1/sensors/content/refresh` | `sensors:write` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| GET | `/api/v1/sensors/custom-products` | `sensors:read` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| DELETE | `/api/v1/sensors/custom-products/{product}` | `sensors:write` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| PUT | `/api/v1/sensors/custom-products/{product}` | `sensors:write` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| GET | `/api/v1/sensors/grant-profiles` | `sensors:read` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| GET | `/api/v1/sensors/grant-summaries` | `sensors:read` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| GET | `/api/v1/sensors/identity-policy` | `sensors:read` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| PUT | `/api/v1/sensors/identity-policy` | one of `sensors:grant:narrow`, `sensors:grant:widen` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| POST | `/api/v1/sensors/install-templates` | `sensors:pair` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| GET | `/api/v1/sensors/install/seccomp-profile` | no permission: public static file: the open-source sensor release's seccomp profile, the same for every organization, no tenant data; rate limited per IP | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | see Requires |
| GET | `/api/v1/sensors/quarantined-results` | `sensors:write` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| GET | `/api/v1/sensors/quarantined-results/{qid}` | `sensors:write` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| POST | `/api/v1/sensors/quarantined-results/{qid}/approve` | `sensors:write` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| POST | `/api/v1/sensors/quarantined-results/{qid}/reject` | `sensors:write` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| GET | `/api/v1/sensors/result-policy` | `sensors:read` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| PUT | `/api/v1/sensors/result-policy` | `sensors:write` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| GET | `/api/v1/sensors/stats` | `sensors:read` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| GET | `/api/v1/sensors/tool-defaults` | `sensors:read` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| DELETE | `/api/v1/sensors/tool-defaults/{tool}` | `sensors:write` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| PUT | `/api/v1/sensors/tool-defaults/{tool}` | `sensors:write` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| DELETE | `/api/v1/sensors/{id}` | `sensors:delete` | config: sensor management; host details, quarantined results and config reports are owner/admin only | yes | Owner, Administrator |
| GET | `/api/v1/sensors/{id}` | `sensors:read` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| PUT | `/api/v1/sensors/{id}` | `sensors:write` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| POST | `/api/v1/sensors/{id}/activate` | `sensors:write` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| GET | `/api/v1/sensors/{id}/activity` | `sensors:read` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| GET | `/api/v1/sensors/{id}/config-report` | `sensors:write` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| GET | `/api/v1/sensors/{id}/config-templates` | `sensors:read` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| POST | `/api/v1/sensors/{id}/content/refresh` | `sensors:write` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| POST | `/api/v1/sensors/{id}/deactivate` | `sensors:write` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| GET | `/api/v1/sensors/{id}/grant` | `sensors:read` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| PUT | `/api/v1/sensors/{id}/grant` | one of `sensors:grant:narrow`, `sensors:grant:widen` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| GET | `/api/v1/sensors/{id}/grant/suggestion` | one of `sensors:grant:narrow`, `sensors:grant:widen` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| POST | `/api/v1/sensors/{id}/grant/suggestion/apply` | one of `sensors:grant:narrow`, `sensors:grant:widen` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| GET | `/api/v1/sensors/{id}/heartbeat-history` | `sensors:read` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| GET | `/api/v1/sensors/{id}/keys` | `sensors:read` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| POST | `/api/v1/sensors/{id}/keys/{key_id}/revoke` | one of `sensors:revoke`, `sensors:write` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| GET | `/api/v1/sensors/{id}/manifest` | `sensors:read` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| GET | `/api/v1/sensors/{id}/manifests` | `sensors:read` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| POST | `/api/v1/sensors/{id}/regenerate-key` | `sensors:write` | config: sensor management; host details, quarantined results and config reports are owner/admin only | yes | Owner, Administrator |
| POST | `/api/v1/sensors/{id}/revoke` | one of `sensors:revoke`, `sensors:write` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| GET | `/api/v1/sensors/{id}/tool-settings` | `sensors:read` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| DELETE | `/api/v1/sensors/{id}/tool-settings/{tool}` | `sensors:write` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| PUT | `/api/v1/sensors/{id}/tool-settings/{tool}` | `sensors:write` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator |
| GET | `/api/v1/sensors/{id}/tool-settings/{tool}/effective` | `sensors:read` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| POST | `/api/v1/sensors/{id}/tool-settings/{tool}/preview` | `sensors:read` | config: sensor management; host details, quarantined results and config reports are owner/admin only |  | Owner, Administrator, Member, Viewer, Scan operator, Sensor operator |
| GET | `/api/v2/sensor/commands` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| POST | `/api/v2/sensor/commands/{command_id}/claim` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| POST | `/api/v2/sensor/commands/{command_id}/complete` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| POST | `/api/v2/sensor/commands/{command_id}/fail` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| POST | `/api/v2/sensor/commands/{command_id}/logs` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| POST | `/api/v2/sensor/commands/{command_id}/release` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| PUT | `/api/v2/sensor/commands/{command_id}/results/{report_id}` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| POST | `/api/v2/sensor/commands/{command_id}/results/{report_id}/commit` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| PUT | `/api/v2/sensor/commands/{command_id}/results/{report_id}/segments/{seq}` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| POST | `/api/v2/sensor/commands/{command_id}/start` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| PUT | `/api/v2/sensor/config-report` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| POST | `/api/v2/sensor/fingerprints/baseline-diff` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| POST | `/api/v2/sensor/fingerprints/check` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| POST | `/api/v2/sensor/heartbeat` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| GET | `/api/v2/sensor/hello` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| POST | `/api/v2/sensor/identity/bind` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| POST | `/api/v2/sensor/keys` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| GET | `/api/v2/sensor/manifest` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| PUT | `/api/v2/sensor/manifest` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| POST | `/api/v2/sensor/pairings` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| GET | `/api/v2/sensor/pairings/{pairing_id}` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| POST | `/api/v2/sensor/pairings/{pairing_id}/complete` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| PUT | `/api/v2/sensor/pairings/{pairing_id}/nonce` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| DELETE | `/api/v2/sensor/results/{report_id}` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| GET | `/api/v2/sensor/results/{report_id}` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| PUT | `/api/v2/sensor/results/{report_id}` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| POST | `/api/v2/sensor/results/{report_id}/commit` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| PUT | `/api/v2/sensor/results/{report_id}/segments/{seq}` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
| GET | `/api/v2/sensor/suppressions` | no permission: sensor protocol v2 (RFC-026): only the sensor authenticator (SensorResultsV2Handler.Authenticate); tenant from the key, user JWT/cookie/oct_ refused | system: sensor protocol v2 (write-only, tenant from the key) |  | see Requires |
