---
title: "System endpoints permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 32
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# System endpoints: permissions

Health, metrics, version, API documentation and client error reports.


## Who can do it

Built-in roles and role templates whose permissions pass each route. Owner and administrator are included where the route allows them.


## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| POST | `/api/v1/client-errors` | no permission: public on purpose: the web console reports an error kind (fixed set, nothing else accepted or stored) for operator alerting, also before sign-in; per-address and overall rate limits | system: web error kind for operator metrics; reads and stores nothing |  | see Requires |
| GET | `/api/v1/version` | no permission: any signed-in user (authMiddleware): build identity for Help > About; no tenant data, and kept off the public /health | system: build identity |  | see Requires |
| GET | `/docs` | no permission: public API docs | system: public API docs |  | see Requires |
| GET | `/health` | no permission: public liveness | system: public liveness |  | see Requires |
| GET | `/metrics` | no permission: MetricsAuth bearer (fail-closed 404) | system: operator metrics (bearer) |  | see Requires |
| GET | `/metrics` | no permission: MetricsAuth bearer (fail-closed 404) | system: operator metrics (bearer) |  | see Requires |
| GET | `/openapi.yaml` | no permission: public API spec | system: public API spec |  | see Requires |
| GET | `/ready` | no permission: public readiness | system: public readiness |  | see Requires |
