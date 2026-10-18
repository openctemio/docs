---
title: "System endpoints permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 33
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# System endpoints: permissions

Health, metrics, version, API documentation and client error reports.


## Who can do it

Built-in roles and role templates whose permissions pass each route. Owner and administrator are included where the route allows them.


## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/docs` | no permission: platform-admin realm: AdminAuthMiddleware (X-Admin-API-Key or console session cookie, RFC-022) + RequireRole; /admin/auth/login\|mfa\|logout are the public console login steps (rate-limited); not tenant-permission-gated | system: platform-admin realm (RFC-022) |  | see Requires |
| GET | `/api/v1/admin/openapi.yaml` | no permission: platform-admin realm: AdminAuthMiddleware (X-Admin-API-Key or console session cookie, RFC-022) + RequireRole; /admin/auth/login\|mfa\|logout are the public console login steps (rate-limited); not tenant-permission-gated | system: platform-admin realm (RFC-022) |  | see Requires |
| GET | `/api/v1/brand` | no permission: public on purpose: the instance brand (product name, color, links, image URLs) the sign-in page shows; no secret, no tenant data; set only by server configuration | system: instance brand shown before sign-in; server configuration, no tenant data |  | see Requires |
| GET | `/api/v1/brand/images/{kind}` | no permission: public on purpose: the instance brand images, validated at startup and served with nosniff and a sandbox policy | system: instance brand images; server configuration, no tenant data |  | see Requires |
| POST | `/api/v1/client-errors` | no permission: public on purpose: the web console reports an error kind (fixed set, nothing else accepted or stored) for operator alerting, also before sign-in; per-address and overall rate limits | system: web error kind for operator metrics; reads and stores nothing |  | see Requires |
| GET | `/api/v1/legal` | no permission: public on purpose: the operator's legal links, legal page values and security.txt contact, shown to visitors before sign-in; no secret, no tenant data; written only by the admin console (RFC-079) | system: operator legal information shown before sign-in; no tenant data |  | see Requires |
| GET | `/api/v1/version` | no permission: any signed-in user (authMiddleware): build identity for Help > About; no tenant data, and kept off the public /health | system: build identity |  | see Requires |
| GET | `/docs` | no permission: API reference page: outside production only | system: public API docs |  | see Requires |
| GET | `/health` | no permission: public liveness | system: public liveness |  | see Requires |
| GET | `/metrics` | no permission: MetricsAuth bearer (fail-closed 404) | system: operator metrics (bearer) |  | see Requires |
| GET | `/metrics` | no permission: MetricsAuth bearer (fail-closed 404) | system: operator metrics (bearer) |  | see Requires |
| GET | `/openapi.yaml` | no permission: API spec: public outside production, signed-in users in production | system: public API spec |  | see Requires |
| GET | `/openapi.yaml` | no permission: API spec: public outside production, signed-in users in production | system: public API spec |  | see Requires |
| GET | `/ready` | no permission: public readiness | system: public readiness |  | see Requires |
