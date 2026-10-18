---
title: Query language
parent: API
nav_order: 4.5
---

# Query language
{: .no_toc }

Ask your own questions of your findings and assets in a short text query, and
get a number, a grouped table or a time series back:

```
findings where state = open and severity = critical and is_in_kev = true
  and asset.internet_facing = true and first_detected_at < -14d | count
```

The query language is available over the REST API (`/api/v1/query/*`). There is
no editor in the web console yet.

1. TOC
{:toc}

---

## What a query sees

A query runs as you, with exactly what you could list in the console:

- your organization only, and within it your [data scope](../identity/roles-and-permissions.md#groups-and-data-scope);
- pentest findings only of campaigns you are a member of (owners and
  administrators see all), never a draft or in-review pentest finding;
- no branch-only findings, no assets of bug-bounty programs and no deleted
  assets;
- `findings` needs `findings:read`, `assets` needs `assets:read`, and the
  `asset.*` fields of a finding need both. A field you may not use answers
  exactly like a field that does not exist.

Queries only read. Nothing you type is turned into SQL: fields come from the same
allowlist as the list filters, and every value is passed as a parameter.

## Write a query

```
[findings | assets] [where <conditions>] [| <stage>]...
```

The entity defaults to `findings`.

### Conditions

| Form | Example |
|---|---|
| Compare: `=`, `!=`, `>`, `>=`, `<`, `<=` | `cvss_score >= 9` |
| Contains: `~` | `file_path ~ "src/payments"` |
| List: `in`, `not in` | `severity in (critical, high)` |
| Range: `between ... and ...` | `epss_score between 0.5 and 1` |
| Empty: `is empty`, `is not empty` | `assigned_to is empty` |
| Text search | `text ~ "log4j"` |
| Combine | `and`, `or`, `not`, parentheses; `and` binds tighter than `or` |

- Keywords and field names are case-insensitive; values keep their case. Quote a
  value that contains spaces or is a keyword (`"in"`).
- Dates are quoted (`"2026-01-31"` or a full timestamp). Relative times are bare:
  `-14d` is 14 days ago (`h`, `d`, `w`, `mo` = 30 days, `y` = 365 days).
- `state` is the lens of the findings list: `open` (new, confirmed, in progress,
  fix applied), `fixed`, `dispositioned` or `all`. `status` names one status.
- `me` stands for you, for example `assigned_to = me`.
- Each field allows only the operators that make sense for it (for example
  `severity` takes `=`, `!=`, `in` and `not in`; scores and dates take the
  comparisons and `between`); the schema below lists them.

### Fields

Ask the API for the fields you may use, with their types, operators and values:

```bash
curl -s https://ctem.example.com/api/v1/query/schema?entity=findings \
  -H "Authorization: Bearer $TOKEN"
```

| Entity | Group by (examples) | Measures | Time fields |
|---|---|---|---|
| `findings` | `severity`, `status`, `source`, `sla_status`, `priority_class`, `finding_type`, `tool_name`, `cve_id`, `rule_id`, `is_in_kev`, `is_reachable`, `asset.type`, `asset.criticality`, `asset.environment`, `asset.exposure`, `asset.internet_facing`, `asset.crown_jewel` | `cvss_score`, `epss_score` | `first_detected_at`, `last_seen_at`, `resolved_at`, `created_at` |
| `assets` | `type`, `sub_type`, `criticality`, `status`, `scope`, `exposure`, `environment`, `data_classification`, `internet_facing`, `crown_jewel`, `discovery_source`, `provider` | `risk_score` | `first_seen`, `last_seen`, `discovered_at`, `created_at` |

A finding reaches its asset only through the `asset.*` fields above and
`asset.tag` and `asset.owner_id`. There are no other joins.

### Stages

After `|`, in this order: an optional `bucket`, then one `count` or `stats` (a
plain count when you give neither), then `top` or `sort`, then `limit`.

| Stage | Example |
|---|---|
| `count`, `count by <fields>` | `count by severity, asset.type` |
| `stats <aggregates> [by <fields>]` | `stats avg(cvss_score), p90(epss_score) as p90_epss by priority_class` |
| `bucket <time field> by <day, week or month>` | `bucket first_detected_at by week` |
| `top <N> by <column>` | `top 10 by count` (at most 100, highest first) |
| `sort <column> [asc or desc]` | `sort count desc` (up to 3 columns) |
| `limit <N>` | `limit 50` (at most 1000) |

Aggregates: `count()`, `distinct(<field>)`, and `sum`, `avg`, `min`, `max`,
`median`, `p90` of a measure. `top`, `sort` and `limit` need a grouped result.

### Examples

```
# Open critical findings in the KEV catalog on internet-facing assets, older than two weeks
findings where state = open and severity = critical and is_in_kev = true
  and asset.internet_facing = true and first_detected_at < -14d | count

# Which asset types carry the most open P0 and P1 findings
findings where state = open and priority_class in (P0, P1) | count by asset.type | top 5 by count

# New findings per week over the last quarter
findings where first_detected_at > -90d | bucket first_detected_at by week | count

# Crown jewels by environment, with their average risk score
assets where crown_jewel = true | stats count(), avg(risk_score) by environment
```

## Check, then run

| Route | Body | Returns |
|---|---|---|
| `POST /api/v1/query/explain` | `{"query": "..."}` | The query in canonical form, a plain-language description, the result columns, the scope and the rules applied, a complexity score and a cost class (`low`, `medium`, `high`). Errors name the line and column. |
| `POST /api/v1/query/run` | `{"query": "..."}` | `columns`, `rows`, `truncated`, `elapsed_ms` and the scope |
| `GET /api/v1/query/schema?entity=findings` | | The fields you may use |

```bash
curl -s -X POST https://ctem.example.com/api/v1/query/run \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query": "findings where state = open | count by severity"}'
```

Each route needs `findings:read` or `assets:read`, then the permission of the
entity and of every field used. With an organization API key the query runs with
the key's permissions and never with full data access. Runs are not stored.

## Limits

| Limit | Value |
|---|---|
| Query text | 4096 bytes, 512 tokens, nesting depth 16 |
| Conditions | 50 conditions, 100 values per list, 200 characters per value |
| Pipeline | 6 stages, 2 groupings (a bucket counts as one), 5 aggregates, 3 sort columns |
| Complexity score | at most 100 (shown by explain) |
| Result | 1000 rows; `truncated` is true when more existed |
| Time | 5 seconds; a slower query answers 422 |
| Rate | about one request per second per person (bursts of 30) on explain and run; 2 queries at a time per person and 4 per organization (429 beyond) |

The grammar, the security model and the threat model are documented in
[Custom query language](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/query-language.md).
