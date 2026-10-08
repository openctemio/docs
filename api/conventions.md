---
title: Conventions
parent: API
nav_order: 2
---

# Conventions: pagination, errors, rate limits

These rules hold across the tenant API (`/api/v1`). The style guide new routes follow is
[api-conventions.md](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/api-conventions.md)
(RFC-041); some older routes still differ and converge over time, so check the
[OpenAPI document](index.md#the-openapi-document) for the exact shape of an endpoint.

## Requests and responses

- Bodies are JSON (`Content-Type: application/json`) unless an endpoint says otherwise (file
  imports are `multipart/form-data`).
- Field names are `snake_case`.
- Timestamps are RFC 3339 in UTC, for example `2026-10-08T09:30:00Z`.
- Identifiers are lowercase UUID strings.
- Clients must ignore response fields they do not know and tolerate new enum values.
- Send `X-Request-ID` to correlate your request with server logs; the API echoes it (or the one
  it generated) in the response.

### Methods

| Operation | Method and path | Success |
|---|---|---|
| List | `GET /things` | `200` |
| Get one | `GET /things/{id}` | `200` |
| Create | `POST /things` | `201` |
| Partial update | `PATCH /things/{id}` (fields you leave out are unchanged) | `200` |
| Replace a whole document (for example a settings section) | `PUT /things/{id}` | `200` |
| Delete | `DELETE /things/{id}` | `204` |
| Aggregates | `GET /things/stats` | `200` |
| Action | `POST /things/{id}/{verb}` (for example `.../revoke`, `.../retry`) | `200` or `202` |
| Bulk action | `POST /things/bulk/{verb}` with `{"ids": [...]}` | `200` |

`GET` never changes state.

## Pagination

List endpoints page with `page` (1-based) and `per_page`:

```bash
curl -H "Authorization: Bearer $OPENCTEM_API_KEY" \
  "https://openctem.example.com/api/v1/assets?page=2&per_page=50"
```

```json
{
  "data": [ { "id": "6f1c...", "name": "app.example.com" } ],
  "total": 412,
  "page": 2,
  "per_page": 50,
  "total_pages": 9
}
```

- `per_page` defaults to 20 on most lists and is capped at 100; a larger value is lowered to 100.
- A `page` or `per_page` that is not a positive whole number is `400`.
- Append-only or very large collections (audit logs, event streams, exports) page with an opaque
  `cursor` instead and return `next_cursor`; an empty `next_cursor` means the end.

## Filtering

Findings (and web endpoints) use the **list query contract** (RFC-048). Other lists accept the
filters listed for them in the OpenAPI document.

- A filter parameter is the singular name of the response field; several values are separated by
  commas: `severity=critical,high`.
- Operators are suffixes: `_not`, `_gt`, `_gte`, `_lt`, `_lte`, `_null`, `_contains`. Example:
  `cvss_score_gte=7`, `first_detected_at_gte=2026-09-01T00:00:00Z`.
- Booleans start with `is_` or `has_`: `is_in_kev=true`.
- Free text is `q`.
- Sorting is `sort=field,-other` (a leading `-` means descending).

```bash
curl -H "Authorization: Bearer $OPENCTEM_API_KEY" \
  "https://openctem.example.com/api/v1/findings?severity=critical,high&epss_score_gte=0.1&q=log4j&sort=-priority_class"
```

For OR conditions and nesting, `POST /api/v1/findings/search` takes a filter document:

```json
{"v": 1, "filter": {"all": [ ... ]}, "sort": ["-epss_score"]}
```

`GET /api/v1/meta/filters/findings` returns the machine-readable contract: every field, its
operators, its enum values, and the JSON Schema of the filter document. `GET /api/v1/findings/stats`
and `GET /api/v1/findings/groups` take the same parameters as the list, so their counts match it.

Limits: 50 conditions, nesting depth 3, 100 values per list (500 ids in a search document), 200
characters per value (`q`: 255), 32 KB search body. A filter that does not parse, or a field that
cannot be sorted, is `400 INVALID_FILTER` with `details` naming each bad parameter or JSON path.

Older parameter names on findings (`severities`, `search`, ...) still work as deprecated aliases and
answer with `Deprecation` and `Sunset` headers. Move to the new names.

### Saved views

`/api/v1/views` stores a filter document plus page state. `?view=<id>` on `/findings`,
`/findings/stats`, `/findings/groups` and `/findings/export` runs the view's filter as the caller,
with the request's own parameters overriding it field by field.

### Export

`GET /api/v1/findings/export` (or `POST` with a filter document) streams CSV or NDJSON, at most
100,000 rows, and needs `findings:export`. Exports are audit-logged.

## Embedding related data: `include=`

Some resources embed related data on request, for example
`GET /api/v1/tools?include=settings,stats`. The rules:

- Each resource has a fixed list of includes (tools: `settings`, `availability`, `stats`;
  capabilities: `usage`). An unknown value, a nested one (`a.b`) or more than three is
  `400 INVALID_INCLUDE`.
- An include you lack the permission for is left out and listed in `meta.omitted_includes`; it is
  not an error.
- Expensive includes lower the page size to 50 and cost extra rate-limit tokens. A response that
  used `include=` is `Cache-Control: private, no-store`.

## Errors

Errors on the tenant and admin planes use one envelope:

```json
{
  "error": "NOT_FOUND",
  "code": "NOT_FOUND",
  "message": "finding not found"
}
```

`code` is the stable, machine-readable part; `message` is for people and may change. `error`
repeats the code. `details` (its shape depends on the error, for example the fields that failed
validation or the filter parameters that did not parse) and `request_id` are present when there
is something to add.

| Status | When | Common codes |
|---|---|---|
| `400` | malformed input | `BAD_REQUEST`, `INVALID_FILTER`, `INVALID_INCLUDE` |
| `401` | not authenticated, or the credential is invalid, expired or revoked | `UNAUTHORIZED` |
| `403` | authenticated but not allowed; module turned off for the organization; read-only API key | `FORBIDDEN`, `MODULE_NOT_ENABLED`, `APPROVAL_REQUIRED`, `STEP_UP_REQUIRED`, `IP_NOT_ALLOWED` |
| `404` | does not exist, **or** outside your organization or data scope | `NOT_FOUND` |
| `409` | state conflict | `CONFLICT` |
| `422` | semantically invalid | `VALIDATION_FAILED`, `UNPROCESSABLE_ENTITY` |
| `429` | rate limited (see `Retry-After`) | `RATE_LIMIT_EXCEEDED` |
| `500` | server error (details are logged, never returned) | `INTERNAL_ERROR` |
| `502`, `503` | an upstream service failed, or the API is not ready | `UPSTREAM_ERROR`, `SERVICE_UNAVAILABLE` |

An object you may not see is always `404`, never `403`, so a response does not reveal that it
exists.

The sensor plane (`/api/v2/sensor`) returns RFC 9457 problem documents
(`application/problem+json`) instead.

## Idempotency

The tenant API does not read an `Idempotency-Key` header. Make retries safe yourself: `GET`, `PUT`
and `DELETE` are idempotent; before retrying a `POST` that may have succeeded, check whether the
object exists.

The sensor results protocol is idempotent by design: the sensor chooses the report id, and
sending the same report again is answered as a replay. Outbound notifications carry an
`Idempotency-Key` header for receivers (see [Webhooks](webhooks.md)).

## Rate limits

Several limits apply; the first one a request hits answers `429`.

| Limit | Default | Keyed by |
|---|---|---|
| Global | 100 requests/s, burst 200 (`RATE_LIMIT_RPS`, `RATE_LIMIT_BURST`) | client address |
| Authenticated reads (`GET` on tenant routes) | 120 requests/min (`RATE_LIMIT_READ_PER_MIN`) | user |
| API key | the key's `rate_limit` per hour, if set | key |
| Sign-in, password reset, second factor | stricter fixed limits | client address, account |
| Finding import | 6 per minute, burst 3 | organization |
| Asset CSV import | 10 per minute, burst 3 | client address |
| AI triage requests | 10 per minute | organization |

Responses from the limiters carry:

```
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1791450000
Retry-After: 1
```

Back off for `Retry-After` seconds before retrying. `RATE_LIMIT_ENABLED=false` turns the global and
read limits off (not recommended).

## CSRF

Cookie-authenticated requests that change state need the `X-CSRF-Token` header (double-submit of
the `csrf_token` cookie). Header-authenticated requests (`Authorization: Bearer`, `X-API-Key`)
need nothing. See [Authentication](authentication.md#csrf-protection).

## CORS

Browser clients on another origin are allowed only from `CORS_ALLOWED_ORIGINS` (by default the
console's own address). Server-side clients are not affected.
