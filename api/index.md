---
title: API
nav_order: 11
has_children: true
permalink: /api/
---

# API

Everything the web console does goes through the OpenCTEM REST API, and so can your scripts,
integrations and AI assistants. This section covers how the API is laid out, how to
authenticate, the conventions every endpoint follows, and the integration surfaces (webhooks,
MCP, results ingest).

| Page | What it covers |
|---|---|
| [Authentication and API keys](authentication.md) | Console sessions, `oct_` API keys, sensor credentials |
| [Conventions](conventions.md) | JSON, pagination, filtering and sorting, errors, rate limits, CSRF |
| [Webhooks and outbound integrations](webhooks.md) | Notification channels, the generic webhook payload, inbound Jira and GitHub webhooks |
| [MCP server](mcp.md) | Read-only Model Context Protocol access for AI clients |
| [Ingesting results (CTIS)](ingest.md) | Sending scan results and importing reports from other tools |
| [AI triage](ai-triage.md) | Endpoints of the AI triage feature |

## Base URL

All examples use `https://openctem.example.com`, the public address of your installation (the
gateway). The tenant API lives under `/api/v1`:

```bash
curl -H "Authorization: Bearer $OPENCTEM_API_KEY" \
  "https://openctem.example.com/api/v1/findings?severity=critical,high&per_page=20"
```

## Planes

Every route belongs to exactly one **plane**: an audience with its own path prefix and its own
credential. A credential is accepted only on its own plane, so a sensor key cannot read findings
and a user's API key cannot submit sensor results.

| Plane | Prefix | Who calls it | Credential |
|---|---|---|---|
| Tenant (user) | `/api/v1/...` | the web console, scripts | session (console) or `oct_` API key (read-only) |
| Self | `/api/v1/me/...` | the signed-in user | session |
| Auth | `/api/v1/auth/...`, `/api/v1/invitations` | browsers, identity providers | none (rate limited) |
| Admin | `/api/v1/admin/...` | the platform admin console | admin console session |
| Sensor | `/api/v2/sensor/...` | sensors | sensor key `octs_...`, enrollment token `octe_...` |
| Inbound webhooks | `/api/v1/webhooks/incoming/...` | Jira, GitHub | HMAC signature per organization |
| SCIM | `/scim/v2/...` | your identity provider | SCIM bearer token |
| MCP | `/api/v1/mcp` | AI clients | `oct_` API key |
| Ops | `/health`, `/docs`, `/openapi.yaml` | load balancers, people | none |

The **organization (tenant) always comes from the credential**, never from the URL or the body.
Tenant routes have no `{tenant}` path parameter: a key or session belongs to one organization,
and every query is scoped to it.

The gateway routes each plane at the edge. Browser planes (tenant, self, auth, admin) reach the
API through the web console, which authenticates the session cookie. A request that carries
`Authorization: Bearer oct_...` or an `X-API-Key` header, or a bearer token and no session
cookie, is sent straight to the API. `/metrics` and `/ready` are never served publicly.

Some older routes still live under prefixes that are now closed to new routes
(`/api/v1/tenants/{tenant}/...`, `/api/v1/users/me/...`, `/api/v1/webhooks/incoming/...`). They
keep working until they are replaced; see [Versioning and stability](#versioning-and-stability).
The sensor protocol v1 prefixes (`/api/v1/agent/...`, `/api/v1/agents/...`) are retired and serve
nothing.

## The OpenAPI document

The API reference is generated from the handler annotations in the Go source
(`// @Router`, `// @Param`, ...) with [swag](https://github.com/swaggo/swag). The result is a
Swagger 2.0 (OpenAPI 2) document, `api/api/openapi/swagger.yaml`, with base path `/api/v1`. CI
fails when a route is registered without being documented, or documented without being routed.

The generated file is not committed. To produce it from a checkout of
[openctemio/openctem](https://github.com/openctemio/openctem):

```bash
git clone https://github.com/openctemio/openctem.git
cd openctem
make -C api swagger        # needs Go; writes api/api/openapi/swagger.yaml
# or, with only Docker installed:
make generate-docker       # all contract files, see Developers > Generated files
```

The API server also serves the document and an interactive reference:

| Path | Serves |
|---|---|
| `GET /openapi.yaml` | the spec file, with `host` rewritten to the address you called |
| `GET /docs` | an interactive API reference that loads `/openapi.yaml` |

The release images generate the spec at build time and ship it next to the server binary, so on
an installation from the `openctem-api` or all-in-one image (from v0.9.0) both paths work as is,
also through the gateway: `https://<host>/openapi.yaml` and `https://<host>/docs`. The document
always matches the running release. The server reads the spec from `api/openapi/swagger.yaml`
relative to its working directory; in a source checkout, run `make -C api swagger` first, or
`/openapi.yaml` answers `404 OpenAPI spec not found`.

The sensor protocol (`/api/v2/sensor`) is described separately by a hand-maintained OpenAPI 3.1
document, [`api/api/openapi/sensor-protocol-v2.yaml`](https://github.com/openctemio/openctem/blob/develop/api/api/openapi/sensor-protocol-v2.yaml),
which CI checks against the registered routes.

## Versioning and stability

- **The major version is in the path, per plane**: `/api/v1` for the tenant API, `/api/v2/sensor`
  for the sensor protocol.
- **Within a major version, changes are additive**: new routes, new optional request fields, new
  response fields and new enum values. Clients must ignore response fields they do not know and
  tolerate new enum values.
- **A rename is a removal plus an addition.** The old path stays as an alias on the same handler
  and answers with deprecation headers:

  ```
  Deprecation: @1791331200
  Sunset: Fri, 15 Jan 2027 00:00:00 GMT
  Link: </api/v1/findings/{id}/ai-triage>; rel="successor-version"
  ```

  Deprecated operations are marked `deprecated: true` in the spec. An alias is removed only after
  its sunset date, at the earliest 30 days after deprecation for routes only the web console
  calls, and at least 6 months after deprecation for routes external clients use.
- Deprecated query parameters (old filter names, see [Conventions](conventions.md#filtering))
  answer with the same headers.

The product version (`vX.Y.Z`) is separate from the API version. See
[Versioning and releases](../operations/versioning.md) for the release policy. A signed-in user
can read the running build with `GET /api/v1/version`.
