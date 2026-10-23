---
title: "Integrations and API keys permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 27
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# Integrations and API keys: permissions

Ticketing, SCM, SIEM and notification integrations, inbound webhooks, the notification outbox and API keys.

- **CTEM stages:** mobilization
- **Modules:** `integrations`, `scans` (the routes answer `403 MODULE_NOT_ENABLED` when the module is off)
- **Permissions:** `integrations:api_keys:delete`, `integrations:api_keys:read`, `integrations:api_keys:write`, `integrations:manage`, `integrations:notifications:delete`, `integrations:notifications:read`, `integrations:notifications:write`, `integrations:read`, `integrations:scm:read`, `scans:write`

## Who can do it

Built-in roles and role templates whose permissions pass each route. Owner and administrator are included where the route allows them.

| Permission | Roles |
|---|---|
| `integrations:api_keys:delete` | Owner, Administrator |
| `integrations:api_keys:read` | Owner, Administrator, Member, Viewer |
| `integrations:api_keys:write` | Owner, Administrator |
| `integrations:manage` | Owner, Administrator |
| `integrations:notifications:delete` | Owner, Administrator |
| `integrations:notifications:read` | Owner, Administrator, Member, Viewer |
| `integrations:notifications:write` | Owner, Administrator |
| `integrations:read` | Owner, Administrator, Member, Viewer |
| `integrations:scm:read` | Owner, Administrator, Member, Viewer, AppSec engineer, CI integrator |
| `scans:write` | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |

## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| GET | `/api/v1/api-keys` | `integrations:api_keys:read` | config: API keys |  | Owner, Administrator, Member, Viewer |
| POST | `/api/v1/api-keys` | `integrations:api_keys:write` | config: API keys | yes | Owner, Administrator |
| DELETE | `/api/v1/api-keys/{id}` | `integrations:api_keys:delete` | config: API keys | yes | Owner, Administrator |
| GET | `/api/v1/api-keys/{id}` | `integrations:api_keys:read` | config: API keys |  | Owner, Administrator, Member, Viewer |
| POST | `/api/v1/api-keys/{id}/revoke` | `integrations:api_keys:write` | config: API keys |  | Owner, Administrator |
| GET | `/api/v1/integrations` | `integrations:read` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator, Member, Viewer |
| POST | `/api/v1/integrations` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) | yes | Owner, Administrator |
| POST | `/api/v1/integrations/defectdojo/sync` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| GET | `/api/v1/integrations/jira/projects` | `integrations:read` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator, Member, Viewer |
| GET | `/api/v1/integrations/notifications` | `integrations:read` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator, Member, Viewer |
| POST | `/api/v1/integrations/notifications` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) | yes | Owner, Administrator |
| GET | `/api/v1/integrations/scm` | `integrations:read`, `integrations:scm:read` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator, Member, Viewer |
| POST | `/api/v1/integrations/test-credentials` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| GET | `/api/v1/integrations/ticket-mappings` | `integrations:read` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator, Member, Viewer |
| POST | `/api/v1/integrations/ticket-mappings` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| GET | `/api/v1/integrations/ticket-mappings/catalog` | `integrations:read` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator, Member, Viewer |
| DELETE | `/api/v1/integrations/ticket-mappings/{mapping_id}` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) | yes | Owner, Administrator |
| GET | `/api/v1/integrations/ticket-mappings/{mapping_id}` | `integrations:read` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator, Member, Viewer |
| POST | `/api/v1/integrations/ticket-mappings/{mapping_id}/copy` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| GET | `/api/v1/integrations/ticket-mappings/{mapping_id}/diff` | `integrations:read` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator, Member, Viewer |
| DELETE | `/api/v1/integrations/ticket-mappings/{mapping_id}/draft` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| PUT | `/api/v1/integrations/ticket-mappings/{mapping_id}/draft` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| POST | `/api/v1/integrations/ticket-mappings/{mapping_id}/drift` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| POST | `/api/v1/integrations/ticket-mappings/{mapping_id}/dry-run` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) | yes | Owner, Administrator |
| GET | `/api/v1/integrations/ticket-mappings/{mapping_id}/export` | `integrations:read` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator, Member, Viewer |
| POST | `/api/v1/integrations/ticket-mappings/{mapping_id}/import` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| POST | `/api/v1/integrations/ticket-mappings/{mapping_id}/inbound-preview` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| POST | `/api/v1/integrations/ticket-mappings/{mapping_id}/preview` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| POST | `/api/v1/integrations/ticket-mappings/{mapping_id}/publish` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) | yes | Owner, Administrator |
| POST | `/api/v1/integrations/ticket-mappings/{mapping_id}/rollback` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| POST | `/api/v1/integrations/ticket-mappings/{mapping_id}/simulate` | `integrations:read` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator, Member, Viewer |
| POST | `/api/v1/integrations/ticket-mappings/{mapping_id}/suggest` | `integrations:read` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator, Member, Viewer |
| POST | `/api/v1/integrations/ticket-mappings/{mapping_id}/verify` | `integrations:read` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator, Member, Viewer |
| GET | `/api/v1/integrations/ticket-mappings/{mapping_id}/versions` | `integrations:read` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator, Member, Viewer |
| DELETE | `/api/v1/integrations/{id}` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) | yes | Owner, Administrator |
| GET | `/api/v1/integrations/{id}` | `integrations:read` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator, Member, Viewer |
| PUT | `/api/v1/integrations/{id}` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) | yes | Owner, Administrator |
| POST | `/api/v1/integrations/{id}/coverage/reactivate` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| POST | `/api/v1/integrations/{id}/disable` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) | yes | Owner, Administrator |
| POST | `/api/v1/integrations/{id}/enable` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) | yes | Owner, Administrator |
| GET | `/api/v1/integrations/{id}/github-webhook` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| POST | `/api/v1/integrations/{id}/github-webhook/secret/rotate` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) | yes | Owner, Administrator |
| GET | `/api/v1/integrations/{id}/jira-webhook` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| PUT | `/api/v1/integrations/{id}/jira-webhook/secret` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) | yes | Owner, Administrator |
| POST | `/api/v1/integrations/{id}/jira-webhook/secret/rotate` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) | yes | Owner, Administrator |
| GET | `/api/v1/integrations/{id}/jira/issue-types` | `integrations:read` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator, Member, Viewer |
| GET | `/api/v1/integrations/{id}/jira/metadata` | `integrations:read` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator, Member, Viewer |
| PUT | `/api/v1/integrations/{id}/notification` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) | yes | Owner, Administrator |
| GET | `/api/v1/integrations/{id}/notification-events` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| GET | `/api/v1/integrations/{id}/repositories` | `integrations:read` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator, Member, Viewer |
| POST | `/api/v1/integrations/{id}/scans/run` | `scans:write` | scoped: scans assets by id through a connector: an asset outside the caller's data scope answers 404 (act scope) |  | Owner, Administrator, Member, Vulnerability manager, AppSec engineer, Scan operator, Researcher |
| POST | `/api/v1/integrations/{id}/sync` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| POST | `/api/v1/integrations/{id}/test` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| POST | `/api/v1/integrations/{id}/test-notification` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| GET | `/api/v1/integrations/{id}/ticket-create-policy` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| PUT | `/api/v1/integrations/{id}/ticket-create-policy` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| POST | `/api/v1/integrations/{id}/ticket-create-policy/preview` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| GET | `/api/v1/notification-outbox` | `integrations:manage`, `integrations:notifications:read` | config: delivery queue, channel-manager only (L-03) |  | Owner, Administrator |
| GET | `/api/v1/notification-outbox/stats` | `integrations:manage`, `integrations:notifications:read` | config: delivery queue, channel-manager only (L-03) |  | Owner, Administrator |
| DELETE | `/api/v1/notification-outbox/{id}` | `integrations:manage`, `integrations:notifications:delete` | config: delivery queue, channel-manager only (L-03) |  | Owner, Administrator |
| GET | `/api/v1/notification-outbox/{id}` | `integrations:manage`, `integrations:notifications:read` | config: delivery queue, channel-manager only (L-03) |  | Owner, Administrator |
| POST | `/api/v1/notification-outbox/{id}/retry` | `integrations:manage`, `integrations:notifications:write` | config: delivery queue, channel-manager only (L-03) |  | Owner, Administrator |
| POST | `/hooks/github-integrations/{integration_id}` | no permission: public: the URL names one GitHub integration and its own secret (X-Hub-Signature-256, HMAC-SHA256 over the raw body) is the credential, verified before anything is parsed; replays refused by body hash and delivery id (store mandatory); events for repositories outside the integration's organization refused; per-IP and per-integration limits | system: inbound GitHub webhook: the integration named in the URL and its own HMAC secret decide the one tenant |  | see Requires |
| POST | `/hooks/jira-integrations/{integration_id}` | no permission: public: the URL names one Jira integration and its own secret (X-Hub-Signature, HMAC-SHA256 over the raw body) is the credential, verified before anything is parsed; replayed and stale deliveries refused; per-IP and per-integration limits | system: inbound Jira webhook: the integration named in the URL and its own HMAC secret decide the one tenant |  | see Requires |
