---
layout: default
title: AI Triage API
parent: API Reference
nav_order: 2
---

# AI Triage API Reference

Complete API reference for the AI Triage system.

---

## Authentication

All endpoints require JWT Bearer token authentication:

```http
Authorization: Bearer <token>
```

Required permission: `findings:write` for POST requests, `findings:read` for GET requests.

---

## Base URL

```
https://api.openctem.io/api/v1
```

---

## Endpoints

### 1. Request Single Triage

Triggers AI triage analysis for a single finding.

```http
POST /findings/{finding_id}/ai-triage
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `finding_id` | UUID | Yes | The finding ID to analyze |

#### Request Body

```json
{
    "mode": "quick"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `mode` | string | No | `quick` | Analysis mode: `quick` or `detailed` |

#### Response

**201 Created**

```json
{
    "job_id": "01HQ5K8M7D8F9C2G3H4J5K6L7M",
    "status": "pending"
}
```

#### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | BAD_REQUEST | Invalid mode (must be `quick` or `detailed`) |
| 403 | FORBIDDEN | AI disabled for tenant |
| 404 | NOT_FOUND | Finding not found |
| 409 | CONFLICT | Triage already in progress |
| 429 | RATE_LIMIT_EXCEEDED | Rate limit exceeded |

#### Example

```bash
curl -X POST "https://api.openctem.io/api/v1/findings/01HQ5K7N.../ai-triage" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "quick"}'
```

---

### 2. Get Latest Triage Result

Retrieves the most recent triage result for a finding.

```http
GET /findings/{finding_id}/ai-triage
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `finding_id` | UUID | Yes | The finding ID |

#### Response

**200 OK**

```json
{
    "id": "01HQ5K8M7D8F9C2G3H4J5K6L7M",
    "finding_id": "01HQ5K7N8E9F0G1H2I3J4K5L6M",
    "tenant_id": "01HQ5K6L5M4N3O2P1Q0R9S8T7U",
    "triage_type": "quick",
    "requested_by": "01HQ5K5K4L3M2N1O0P9Q8R7S6T",
    "requested_at": "2025-02-01T10:30:00Z",
    "status": "completed",
    "started_at": "2025-02-01T10:30:01Z",
    "completed_at": "2025-02-01T10:30:45Z",
    "llm_provider": "claude",
    "llm_model": "claude-3-5-sonnet-20241022",
    "prompt_tokens": 1250,
    "completion_tokens": 450,
    "severity_assessment": "high",
    "severity_justification": "The SQL injection vulnerability allows direct database access...",
    "risk_score": 85.0,
    "exploitability": "high",
    "exploitability_details": "Publicly accessible endpoint with no input validation...",
    "business_impact": "Potential data breach affecting user credentials and PII...",
    "priority_rank": 5,
    "false_positive_likelihood": 0.1,
    "false_positive_reason": "Input is directly concatenated into SQL query without sanitization",
    "remediation_steps": [
        {
            "step": 1,
            "description": "Use parameterized queries instead of string concatenation",
            "effort": "low"
        },
        {
            "step": 2,
            "description": "Add input validation for user-controlled parameters",
            "effort": "low"
        },
        {
            "step": 3,
            "description": "Implement a Web Application Firewall (WAF)",
            "effort": "medium"
        }
    ],
    "related_cves": ["CVE-2023-1234", "CVE-2022-5678"],
    "related_cwes": ["CWE-89", "CWE-20"],
    "analysis_summary": "High-risk SQL injection vulnerability in the login endpoint that allows authentication bypass and potential data exfiltration.",
    "created_at": "2025-02-01T10:30:00Z",
    "updated_at": "2025-02-01T10:30:45Z"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Triage result ID |
| `finding_id` | UUID | Associated finding ID |
| `tenant_id` | UUID | Tenant ID |
| `triage_type` | string | Type: `quick`, `detailed`, `auto`, `bulk` |
| `requested_by` | UUID | User who requested (null for auto) |
| `requested_at` | datetime | Request timestamp |
| `status` | string | `pending`, `processing`, `completed`, `failed` |
| `started_at` | datetime | Processing start time |
| `completed_at` | datetime | Completion time |
| `error_message` | string | Error message if failed |
| `llm_provider` | string | LLM provider used |
| `llm_model` | string | Model name |
| `prompt_tokens` | integer | Input tokens used |
| `completion_tokens` | integer | Output tokens generated |
| `severity_assessment` | string | AI-recommended severity |
| `severity_justification` | string | Reasoning for severity |
| `risk_score` | float | Risk score (0-100) |
| `exploitability` | string | `high`, `medium`, `low`, `theoretical` |
| `exploitability_details` | string | Exploitability explanation |
| `business_impact` | string | Business impact description |
| `priority_rank` | integer | Fix priority (1-100, 1=urgent) |
| `false_positive_likelihood` | float | FP probability (0-1) |
| `false_positive_reason` | string | FP reasoning |
| `remediation_steps` | array | Fix steps with effort estimates |
| `related_cves` | array | Related CVE identifiers |
| `related_cwes` | array | Related CWE identifiers |
| `analysis_summary` | string | One-paragraph summary |

#### Errors

| Status | Code | Description |
|--------|------|-------------|
| 404 | NOT_FOUND | Finding or triage result not found |

---

### 3. Get Triage History

Retrieves all triage results for a finding (paginated).

```http
GET /findings/{finding_id}/ai-triage/history
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 20 | Results per page (max 100) |
| `offset` | integer | 0 | Pagination offset |

#### Response

**200 OK**

```json
{
    "results": [
        {
            "id": "01HQ5K8M...",
            "status": "completed",
            "triage_type": "detailed",
            "severity_assessment": "high",
            "risk_score": 85.0,
            "completed_at": "2025-02-01T10:30:45Z"
        },
        {
            "id": "01HQ5K7L...",
            "status": "completed",
            "triage_type": "quick",
            "severity_assessment": "medium",
            "risk_score": 65.0,
            "completed_at": "2025-01-28T14:20:30Z"
        }
    ],
    "total": 2,
    "limit": 20,
    "offset": 0
}
```

---

### 4. Get Specific Triage Result

Retrieves a specific triage result by ID.

```http
GET /findings/{finding_id}/ai-triage/{triage_id}
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `finding_id` | UUID | Yes | The finding ID |
| `triage_id` | UUID | Yes | The triage result ID |

#### Response

Same format as [Get Latest Triage Result](#2-get-latest-triage-result).

---

### 5. Bulk Triage

Triggers AI triage for multiple findings at once.

```http
POST /findings/ai-triage/bulk
```

#### Request Body

```json
{
    "finding_ids": [
        "01HQ5K7N8E9F0G1H2I3J4K5L6M",
        "01HQ5K7O9F0G1H2I3J4K5L6M7N",
        "01HQ5K7P0G1H2I3J4K5L6M7N8O"
    ],
    "mode": "quick"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `finding_ids` | array | Yes | Finding IDs (max 100) |
| `mode` | string | No | Analysis mode (default: `quick`) |

#### Limits

- Maximum 100 findings per request
- Maximum 64KB payload size
- Finding IDs must be valid UUIDs (36 characters)

#### Response

**201 Created**

```json
{
    "jobs": [
        {
            "finding_id": "01HQ5K7N...",
            "job_id": "01HQ5K8M...",
            "status": "pending"
        },
        {
            "finding_id": "01HQ5K7O...",
            "job_id": "01HQ5K8N...",
            "status": "pending"
        },
        {
            "finding_id": "01HQ5K7P...",
            "job_id": null,
            "status": "failed",
            "error": "Finding not found"
        }
    ],
    "total_count": 3,
    "queued": 2,
    "failed": 1
}
```

#### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | BAD_REQUEST | Empty finding_ids, >100 findings, invalid mode |
| 403 | FORBIDDEN | AI disabled for tenant |
| 429 | RATE_LIMIT_EXCEEDED | Rate limit exceeded |

---

## Rate Limiting

All AI triage endpoints are rate-limited to prevent abuse.

### Limits

| Scope | Limit | Window |
|-------|-------|--------|
| Per tenant | 10 requests | 1 minute |

### Headers

Rate limit information is included in response headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests per window |
| `X-RateLimit-Remaining` | Remaining requests |
| `X-RateLimit-Reset` | Unix timestamp when limit resets |

### Rate Limit Exceeded Response

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 6
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1706789400

{
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded"
}
```

---

## Error Responses

### Standard Error Format

```json
{
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {
        "action": "Suggested action to resolve",
        "additional": "Additional context"
    }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `BAD_REQUEST` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Permission denied or AI disabled |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Duplicate request in progress |
| `VALIDATION_FAILED` | 422 | Validation error |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | AI service unavailable |

### Common Error Examples

#### AI Disabled

```json
{
    "code": "FORBIDDEN",
    "message": "AI triage is disabled for this tenant. Contact your administrator to enable it.",
    "details": {
        "action": "Enable AI triage in tenant settings"
    }
}
```

#### Duplicate Request

```json
{
    "code": "CONFLICT",
    "message": "A triage request is already in progress for this finding",
    "details": {
        "action": "Wait for the current triage to complete, or check the finding's triage history",
        "endpoint": "GET /api/v1/findings/{id}/ai-triage"
    }
}
```

#### Token Limit Exceeded

```json
{
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Monthly AI token limit exceeded",
    "details": {
        "action": "Wait until next month or upgrade your plan for more tokens",
        "suggestion": "Review your token usage in tenant settings"
    }
}
```

---

## Webhooks

AI triage events can trigger webhook notifications via the [Workflow Automation](../features/workflows.md) system.

### Event Types

| Event | Description |
|-------|-------------|
| `ai_triage.completed` | Triage completed successfully |
| `ai_triage.failed` | Triage failed |
| `ai_triage.high_risk` | Triage found high risk score (>80) |
| `ai_triage.false_positive` | High FP likelihood detected (>0.8) |

### Webhook Payload

```json
{
    "event": "ai_triage.completed",
    "timestamp": "2025-02-01T10:30:45Z",
    "data": {
        "triage_id": "01HQ5K8M...",
        "finding_id": "01HQ5K7N...",
        "tenant_id": "01HQ5K6L...",
        "severity_assessment": "high",
        "risk_score": 85,
        "priority_rank": 5,
        "analysis_summary": "High-risk SQL injection..."
    }
}
```

---

## SDK Examples

### Go

```go
import "github.com/openctem/sdk-go"

client := openctem.NewClient("your-api-key")

// Request triage
job, err := client.Findings.RequestTriage(ctx, findingID, &openctem.TriageRequest{
    Mode: "quick",
})

// Poll for result
result, err := client.Findings.GetTriageResult(ctx, findingID)
```

### Python

```python
from openctem import Client

client = Client(api_key="your-api-key")

# Request triage
job = client.findings.request_triage(finding_id, mode="quick")

# Get result
result = client.findings.get_triage_result(finding_id)
```

### TypeScript

```typescript
import { OpenCTEMClient } from '@openctem/sdk';

const client = new OpenCTEMClient({ apiKey: 'your-api-key' });

// Request triage
const job = await client.findings.requestTriage(findingId, { mode: 'quick' });

// Get result
const result = await client.findings.getTriageResult(findingId);
```

---

## Related

- [AI Triage Feature Guide](../features/ai-triage.md)
- [ADR-007: AI Integration](../decisions/007-ai-integration.md)
- [Workflow Automation](../features/workflows.md)
