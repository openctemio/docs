---
title: "Integrations and API keys permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 26
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# Integrations and API keys: permissions

Ticketing, SCM, SIEM and notification integrations, inbound webhooks, the notification outbox and API keys.

- **CTEM stages:** mobilization
- **Modules:** `integrations` (the routes answer `403 MODULE_NOT_ENABLED` when the module is off)
- **Permissions:** `integrations:api_keys:delete`, `integrations:api_keys:read`, `integrations:api_keys:write`, `integrations:manage`, `integrations:notifications:delete`, `integrations:notifications:read`, `integrations:notifications:write`, `integrations:read`, `integrations:scm:read`

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
| `integrations:scm:read` | Owner, Administrator, Member, Viewer, AppSec engineer |

## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| GET | `/api/v1/api-keys` | `integrations:api_keys:read` | config: API keys |  | Owner, Administrator, Member, Viewer |
| POST | `/api/v1/api-keys` | `integrations:api_keys:write` | config: API keys | yes | Owner, Administrator |
| DELETE | `/api/v1/api-keys/{id}` | `integrations:api_keys:delete` | config: API keys | yes | Owner, Administrator |
| GET | `/api/v1/api-keys/{id}` | `integrations:api_keys:read` | config: API keys |  | Owner, Administrator, Member, Viewer |
| POST | `/api/v1/api-keys/{id}/revoke` | `integrations:api_keys:write` | config: API keys |  | Owner, Administrator |
| GET | `/api/v1/integrations` | `integrations:read` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator, Member, Viewer |
| POST | `/api/v1/integrations` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| POST | `/api/v1/integrations/defectdojo/sync` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| GET | `/api/v1/integrations/github/webhook-secret` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) | yes | Owner, Administrator |
| POST | `/api/v1/integrations/github/webhook-secret/rotate` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) | yes | Owner, Administrator |
| GET | `/api/v1/integrations/jira/projects` | `integrations:read` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator, Member, Viewer |
| GET | `/api/v1/integrations/jira/webhook-secret` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) | yes | Owner, Administrator |
| POST | `/api/v1/integrations/jira/webhook-secret/rotate` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) | yes | Owner, Administrator |
| GET | `/api/v1/integrations/notifications` | `integrations:read` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator, Member, Viewer |
| POST | `/api/v1/integrations/notifications` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| GET | `/api/v1/integrations/scm` | `integrations:read`, `integrations:scm:read` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator, Member, Viewer |
| POST | `/api/v1/integrations/test-credentials` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| DELETE | `/api/v1/integrations/{id}` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| GET | `/api/v1/integrations/{id}` | `integrations:read` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator, Member, Viewer |
| PUT | `/api/v1/integrations/{id}` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| POST | `/api/v1/integrations/{id}/disable` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| POST | `/api/v1/integrations/{id}/enable` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| PUT | `/api/v1/integrations/{id}/notification` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| GET | `/api/v1/integrations/{id}/notification-events` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| GET | `/api/v1/integrations/{id}/repositories` | `integrations:read` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator, Member, Viewer |
| POST | `/api/v1/integrations/{id}/sync` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| POST | `/api/v1/integrations/{id}/test` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| POST | `/api/v1/integrations/{id}/test-notification` | `integrations:manage` | config: integrations; delivery history is channel-manager only (L-03) |  | Owner, Administrator |
| GET | `/api/v1/notification-outbox` | `integrations:manage`, `integrations:notifications:read` | config: delivery queue, channel-manager only (L-03) |  | Owner, Administrator |
| GET | `/api/v1/notification-outbox/stats` | `integrations:manage`, `integrations:notifications:read` | config: delivery queue, channel-manager only (L-03) |  | Owner, Administrator |
| DELETE | `/api/v1/notification-outbox/{id}` | `integrations:manage`, `integrations:notifications:delete` | config: delivery queue, channel-manager only (L-03) |  | Owner, Administrator |
| GET | `/api/v1/notification-outbox/{id}` | `integrations:manage`, `integrations:notifications:read` | config: delivery queue, channel-manager only (L-03) |  | Owner, Administrator |
| POST | `/api/v1/notification-outbox/{id}/retry` | `integrations:manage`, `integrations:notifications:write` | config: delivery queue, channel-manager only (L-03) |  | Owner, Administrator |
| POST | `/api/v1/webhooks/incoming/github` | no permission: inbound webhook HMAC per-tenant | config: inbound Jira/GitHub webhooks (HMAC); the outbound webhook API is removed |  | see Requires |
| POST | `/api/v1/webhooks/incoming/jira` | no permission: inbound webhook HMAC per-tenant | config: inbound Jira/GitHub webhooks (HMAC); the outbound webhook API is removed |  | see Requires |
