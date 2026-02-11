---
layout: default
title: Data Flow Analysis Guide
parent: Platform Guides
nav_order: 10
---

# Data Flow Analysis Guide

{: .note }
> This is a user guide. For technical implementation details, see [Data Flow Tracking Feature](../features/data-flow-tracking.md).

This guide explains how to use data flow (taint tracking) information to understand and remediate vulnerabilities.

---

## Overview

Data flow analysis shows how untrusted data travels through your application from source to sink:

```
Source (user input) → Intermediate steps → Sink (vulnerable function)
```

This helps developers:
- Understand the full attack path
- Identify where to add sanitization
- Verify fixes don't break the flow

---

## Understanding Data Flows

### Location Types

| Type | Description | Example |
|------|-------------|---------|
| `source` | Where tainted data enters | `username = request.form['user']` |
| `intermediate` | Transformation/propagation | `query = "SELECT * WHERE name='" + username` |
| `sink` | Where vulnerability occurs | `cursor.execute(query)` |
| `sanitizer` | Where data is cleaned | `safe = html.escape(username)` |

### Example: SQL Injection Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Source: handlers/user.go:25                                 │
│   username := r.FormValue("username")                       │
│   Label: "user_input"                                       │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Intermediate: handlers/user.go:30                           │
│   query := fmt.Sprintf("SELECT * FROM users WHERE name='%s'",│
│            username)                                        │
│   Message: "Tainted data concatenated into SQL string"      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Sink: handlers/user.go:35                                   │
│   rows, err := db.Query(query)                              │
│   Message: "SQL query executed with unsanitized input"      │
└─────────────────────────────────────────────────────────────┘
```

---

## Viewing Data Flows in UI

### Finding Detail Page

1. Navigate to **Findings** → Select a finding
2. Click **Attack Path** tab
3. View the visual flow diagram

### Flow Visualization

```
[Source] ──────► [Step 1] ──────► [Step 2] ──────► [Sink]
  │                │                │                │
  │                │                │                │
  ▼                ▼                ▼                ▼
user.go:25     user.go:30      auth.go:15      db.go:42
```

### Code Context

Each step shows:
- File path and line number
- Code snippet
- Function/class context
- Taint label (what data is being tracked)

---

## Querying Data Flows via API

### Get All Flows for a Finding

```bash
curl /api/v1/findings/{finding_id}/dataflows \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "finding_id": "uuid-123",
  "summary": {
    "total_flows": 1,
    "total_locations": 3,
    "source_count": 1,
    "sink_count": 1,
    "has_sanitizer": false
  },
  "flows": [
    {
      "id": "flow-uuid",
      "flow_index": 0,
      "message": "SQL injection from user input to database query",
      "importance": "essential",
      "sources": [
        {
          "path": "handlers/user.go",
          "line": 25,
          "location_type": "source",
          "function_name": "CreateUser",
          "label": "username",
          "snippet": "username := r.FormValue(\"username\")"
        }
      ],
      "sinks": [
        {
          "path": "handlers/user.go",
          "line": 35,
          "location_type": "sink",
          "function_name": "CreateUser",
          "snippet": "rows, err := db.Query(query)"
        }
      ],
      "traces": [
        {
          "step_index": 0,
          "location_type": "source",
          "path": "handlers/user.go",
          "line": 25,
          "function_name": "CreateUser",
          "snippet": "username := r.FormValue(\"username\")"
        },
        {
          "step_index": 1,
          "location_type": "intermediate",
          "path": "handlers/user.go",
          "line": 30,
          "function_name": "CreateUser",
          "snippet": "query := fmt.Sprintf(\"SELECT * FROM users WHERE name='%s'\", username)"
        },
        {
          "step_index": 2,
          "location_type": "sink",
          "path": "handlers/user.go",
          "line": 35,
          "function_name": "CreateUser",
          "snippet": "rows, err := db.Query(query)"
        }
      ]
    }
  ]
}
```

### Query Flows by File

Find all data flows that pass through a specific file:

```bash
curl "/api/v1/dataflows/by-file?file_path=handlers/auth.go&page=1&limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

### Query Flows by Function

Find all data flows through a specific function:

```bash
curl "/api/v1/dataflows/by-function?function_name=CreateUser&page=1&limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Sources and Sinks Only

```bash
curl "/api/v1/findings/{finding_id}/dataflows/sources-sinks" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Attack Path Analysis Queries

### High-Risk Functions

Find functions that appear in multiple vulnerability flows:

```sql
SELECT
    fl.function_name,
    COUNT(DISTINCT df.finding_id) as vuln_count,
    array_agg(DISTINCT f.rule_id) as vuln_types
FROM finding_flow_locations fl
JOIN finding_data_flows df ON df.id = fl.data_flow_id
JOIN findings f ON f.id = df.finding_id
WHERE f.tenant_id = $1
  AND f.status IN ('new', 'confirmed')
  AND fl.function_name IS NOT NULL
GROUP BY fl.function_name
HAVING COUNT(DISTINCT df.finding_id) > 2
ORDER BY vuln_count DESC;
```

### Common Entry Points

Find the most common taint sources:

```sql
SELECT
    fl.file_path,
    fl.function_name,
    COUNT(*) as source_count
FROM finding_flow_locations fl
JOIN finding_data_flows df ON df.id = fl.data_flow_id
JOIN findings f ON f.id = df.finding_id
WHERE f.tenant_id = $1
  AND fl.location_type = 'source'
GROUP BY fl.file_path, fl.function_name
ORDER BY source_count DESC
LIMIT 10;
```

### Vulnerable Sinks

Find the most common vulnerable sinks:

```sql
SELECT
    fl.function_name,
    f.rule_id,
    COUNT(*) as sink_count
FROM finding_flow_locations fl
JOIN finding_data_flows df ON df.id = fl.data_flow_id
JOIN findings f ON f.id = df.finding_id
WHERE f.tenant_id = $1
  AND fl.location_type = 'sink'
GROUP BY fl.function_name, f.rule_id
ORDER BY sink_count DESC;
```

---

## Using Data Flows for Remediation

### Step 1: Identify the Source

Find where untrusted data enters:
- HTTP request parameters
- File uploads
- Database reads (if from untrusted source)
- Environment variables

### Step 2: Trace the Path

Follow intermediate steps to understand:
- How data is transformed
- Where it passes through
- What validations exist (if any)

### Step 3: Find the Best Fix Location

Options (in order of preference):

1. **At the source**: Validate/sanitize immediately
   ```go
   // Best: Validate at entry
   username := r.FormValue("username")
   if !isValidUsername(username) {
       return errors.New("invalid username")
   }
   ```

2. **Before the sink**: Use parameterized queries
   ```go
   // Good: Parameterized query
   rows, err := db.Query("SELECT * FROM users WHERE name = $1", username)
   ```

3. **Add sanitizer step**: Escape special characters
   ```go
   // OK: Escape (if parameterization not possible)
   username = html.EscapeString(username)
   ```

### Step 4: Verify the Fix

After fixing, rescan to verify:
- The data flow should now include a `sanitizer` step
- Or the sink should no longer be flagged

---

## Enabling Data Flow Tracking

### Semgrep

```bash
# Enable dataflow traces
semgrep --config auto --dataflow-traces -o results.sarif
```

### CodeQL

```yaml
# codeql-config.yml
queries:
  - uses: security-and-quality
paths-ignore:
  - '**/test/**'
```

Path queries automatically include data flows.

### Checkov (IaC)

```bash
# IaC doesn't typically have data flows
# But resource relationships are tracked
checkov -d . -o sarif
```

---

## Best Practices

### For Security Teams

1. **Prioritize by flow length**: Shorter flows are often easier to exploit
2. **Look for missing sanitizers**: Flows without sanitizer steps are high risk
3. **Track common sources**: Monitor frequently-exploited entry points

### For Developers

1. **Fix at the source**: Validate input as early as possible
2. **Use framework protections**: ORM, parameterized queries, template escaping
3. **Test the fix**: Rescan after remediation

### For DevSecOps

1. **Enable taint tracking**: Configure scanners for rich data flows
2. **Store flows**: Keep data flow history for trend analysis
3. **Alert on new sources**: New entry points need review

---

## Troubleshooting

### No Data Flows Shown

**Cause**: Scanner didn't include `codeFlows` in output.

**Solution**:
- Semgrep: Add `--dataflow-traces`
- CodeQL: Use path queries
- Check scanner documentation

### Incomplete Flows

**Cause**: Scanner couldn't trace through certain code patterns.

**Solution**:
- Add type annotations
- Simplify complex data transformations
- Use scanner-specific taint source/sink annotations

### Too Many Flows

**Cause**: Overly broad taint sources.

**Solution**:
- Filter by `importance: essential`
- Focus on `source` and `sink` only
- Use file/function filters

---

## Related Documentation

- [Finding Ingestion Workflow](finding-ingestion-workflow.md) - How flows are stored
- [Finding Types & Fingerprinting](../features/finding-types.md) - Technical details
- [Database Schema](../database/schema.md) - Data flow tables
