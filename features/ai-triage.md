---
layout: default
title: AI Triage
parent: Features
nav_order: 15
---

# AI Triage

AI-powered vulnerability triage and analysis for intelligent prioritization and remediation guidance.

---

## Overview

AI Triage leverages Large Language Models (LLMs) to analyze security findings and provide:

- **Severity Assessment**: Validate or adjust severity based on context
- **Risk Scoring**: Calculate risk score (0-100) based on exploitability and impact
- **Priority Ranking**: Determine fix priority (1-100, 1 = most urgent)
- **False Positive Detection**: Identify likely false positives with confidence scores
- **Remediation Guidance**: Generate step-by-step fix recommendations
- **Exploitability Analysis**: Assess real-world exploitation difficulty

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              AI TRIAGE FLOW                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐     ┌──────────────────┐     ┌─────────────────────────┐   │
│  │   User/     │────▶│   API Handler    │────▶│   Rate Limiter          │   │
│  │   System    │     │   (HTTP)         │     │   (10 req/min/tenant)   │   │
│  └─────────────┘     └──────────────────┘     └───────────┬─────────────┘   │
│                                                           │                  │
│                                                           ▼                  │
│                                              ┌─────────────────────────┐     │
│                                              │   Deduplication Check   │     │
│                                              │   (HasPendingOrProcessing)    │
│                                              └───────────┬─────────────┘     │
│                                                          │                   │
│                           ┌──────────────────────────────┼───────────────┐   │
│                           │                              ▼               │   │
│  ┌─────────────────┐      │     ┌──────────────────────────────────┐    │   │
│  │   AI Triage     │◀─────┼─────│   Asynq Job Queue (Redis)        │    │   │
│  │   Service       │      │     │   - ai:triage:{result_id}        │    │   │
│  └────────┬────────┘      │     └──────────────────────────────────┘    │   │
│           │               │                                              │   │
│           ▼               │          WORKER PROCESS                      │   │
│  ┌─────────────────┐      │                                              │   │
│  │  AcquireSlot    │      │     ┌──────────────────────────────────┐    │   │
│  │  (SELECT FOR    │◀─────┼─────│   AI Triage Worker               │    │   │
│  │   UPDATE)       │      │     │   (ProcessTriage)                │    │   │
│  └────────┬────────┘      │     └──────────────────────────────────┘    │   │
│           │               │                                              │   │
│           ▼               └──────────────────────────────────────────────┘   │
│  ┌─────────────────┐                                                         │
│  │  Token Limit    │     ┌─────────────────────────────────────────────────┐ │
│  │  Check          │────▶│   LLM Provider Factory                          │ │
│  └────────┬────────┘     │   ├── Platform AI (Claude/OpenAI/Gemini)        │ │
│           │              │   ├── Tenant BYOK (encrypted API keys)          │ │
│           ▼              │   └── Self-Hosted Agent                         │ │
│  ┌─────────────────┐     └──────────────────────────────────────────────────┘ │
│  │  Prompt         │                                                         │
│  │  Sanitization   │────▶ Unicode normalization, injection pattern removal   │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐     ┌──────────────────────────────────────────────┐   │
│  │  LLM Call       │────▶│   Output Validation                          │   │
│  │                 │     │   - JSON schema validation                   │   │
│  └─────────────────┘     │   - Field sanitization                       │   │
│                          │   - XSS prevention                           │   │
│                          └──────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Request Triage (Single Finding)

```http
POST /api/v1/findings/{id}/ai-triage
Authorization: Bearer <token>
Content-Type: application/json

{
    "mode": "quick"  // or "detailed"
}
```

**Response:**
```json
{
    "job_id": "01HQ5K8M...",
    "status": "pending"
}
```

**Rate Limiting:**
- 10 requests per minute per tenant
- Returns `429 Too Many Requests` when exceeded
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Get Triage Result

```http
GET /api/v1/findings/{id}/ai-triage
Authorization: Bearer <token>
```

**Response:**
```json
{
    "id": "01HQ5K8M...",
    "finding_id": "01HQ5K7N...",
    "status": "completed",
    "severity_assessment": "high",
    "severity_justification": "SQL injection vulnerability allows authentication bypass...",
    "risk_score": 85,
    "exploitability": "high",
    "exploitability_details": "Publicly accessible endpoint with no input validation...",
    "business_impact": "Potential data breach affecting user credentials...",
    "priority_rank": 5,
    "false_positive_likelihood": 0.1,
    "false_positive_reason": "Input is directly concatenated into SQL query...",
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
        }
    ],
    "related_cves": ["CVE-2023-1234"],
    "related_cwes": ["CWE-89", "CWE-20"],
    "analysis_summary": "High-risk SQL injection vulnerability...",
    "llm_provider": "claude",
    "llm_model": "claude-sonnet-4-20250514",
    "prompt_tokens": 1250,
    "completion_tokens": 450,
    "completed_at": "2025-02-01T10:30:45Z"
}
```

### Get Triage History

```http
GET /api/v1/findings/{id}/ai-triage/history?limit=10&offset=0
Authorization: Bearer <token>
```

### Bulk Triage

```http
POST /api/v1/findings/ai-triage/bulk
Authorization: Bearer <token>
Content-Type: application/json

{
    "finding_ids": ["uuid1", "uuid2", ...],
    "mode": "quick"
}
```

**Limits:**
- Maximum 100 findings per request
- Maximum 64KB payload size
- Rate limited (same as single triage)

**Response:**
```json
{
    "jobs": [
        {"finding_id": "uuid1", "job_id": "job1", "status": "pending"},
        {"finding_id": "uuid2", "job_id": "job2", "status": "pending"}
    ],
    "total_count": 2,
    "queued": 2,
    "failed": 0
}
```

---

## Error Responses

### Duplicate Request (409 Conflict)

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

### Token Limit Exceeded (429 Too Many Requests)

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

### AI Disabled (403 Forbidden)

```json
{
    "code": "FORBIDDEN",
    "message": "AI triage is disabled for this tenant. Contact your administrator to enable it.",
    "details": {
        "action": "Enable AI triage in tenant settings"
    }
}
```

---

## LLM Error Messages

When AI triage fails, error messages are categorized and sanitized to provide actionable guidance without exposing sensitive details (API keys, internal errors, etc.).

### Error Categories

| Category | Raw Error Pattern | User-Friendly Message |
|----------|-------------------|----------------------|
| **Rate Limited** | `rate limit`, `429`, `too many requests` | "AI service is temporarily busy. Please try again in a few minutes." |
| **Authentication** | `unauthorized`, `401`, `invalid api key` | "AI service authentication failed. Please contact your administrator." |
| **Quota Exceeded** | `quota`, `insufficient_quota`, `billing` | "AI service quota exceeded. Please check your API key billing status." |
| **Timeout** | `timeout`, `deadline exceeded`, `context deadline` | "AI analysis timed out. The finding may be too complex. Please try again." |
| **Content Blocked** | `content filter`, `blocked`, `safety`, `refused` | "AI analysis was blocked by content filters. The finding may contain sensitive content." |
| **Token Limit** | `token limit`, `context length`, `too long`, `maximum context` | "Finding is too large for AI analysis. Try a simpler finding or contact support." |
| **Server Error** | `500`, `502`, `503`, `504`, `internal server error` | "AI service is temporarily unavailable. Please try again later." |
| **Configuration** | `not configured`, `missing`, `invalid config` | "AI service is not properly configured. Please contact your administrator." |
| **Default** | (any other error) | "AI analysis failed. Please try again later." |

### Implementation Details

The error categorization is implemented in `ai_triage_service.go`:

```go
func categorizeError(err error) string {
    errLower := strings.ToLower(err.Error())

    // Rate limiting
    if errors.Is(err, llm.ErrRateLimited) ||
       strings.Contains(errLower, "rate limit") ||
       strings.Contains(errLower, "429") {
        return "AI service is temporarily busy. Please try again in a few minutes."
    }

    // Authentication errors
    if strings.Contains(errLower, "unauthorized") ||
       strings.Contains(errLower, "401") ||
       strings.Contains(errLower, "invalid api key") {
        return "AI service authentication failed. Please contact your administrator."
    }

    // ... additional categories
}
```

### Security Considerations

1. **No Raw Errors**: Internal error details are never exposed to users
2. **No API Keys**: Error messages never include API keys or tokens
3. **No Stack Traces**: Server-side stack traces are logged but not returned
4. **Actionable Guidance**: Each message includes what the user should do

### Logging

Full error details are logged server-side for debugging:

```go
s.logger.Error("AI triage processing failed",
    "triage_id", triageID,
    "finding_id", findingID,
    "error", err.Error(),  // Full error for debugging
)
```

Error message stored in database is the user-friendly version:

```sql
UPDATE ai_triage_results
SET status = 'failed',
    error_message = 'AI service is temporarily busy. Please try again in a few minutes.'
WHERE id = $1;
```

### UI Display

The AI Triage button shows categorized error messages:

| Status | Button State | Toast Notification |
|--------|--------------|-------------------|
| `pending` | "Queued..." with spinner | - |
| `processing` | "Analyzing..." with spinner | "AI Triage Processing" |
| `completed` | "Re-analyze" with check icon | "AI Triage Completed" |
| `failed` | "Retry" with alert icon | Error message from category |

**Example Toast:**

```tsx
toast.error('AI Triage Failed', {
    description: result.errorMessage // User-friendly categorized message
})
```

### Retry Behavior

| Error Category | Should Retry | Wait Time |
|----------------|--------------|-----------|
| Rate Limited | Yes | 1-5 minutes |
| Timeout | Yes | Immediately |
| Server Error | Yes | 1-5 minutes |
| Authentication | No | Fix config |
| Quota Exceeded | No | Check billing |
| Content Blocked | No | Manual review |
| Token Limit | No | Simplify finding |

### WebSocket Error Events

When triage fails, a WebSocket event is broadcast:

```json
{
  "type": "triage_failed",
  "triage": {
    "id": "result-uuid",
    "finding_id": "finding-uuid",
    "tenant_id": "tenant-uuid",
    "status": "failed",
    "error_message": "AI service is temporarily busy. Please try again in a few minutes."
  }
}
```

### Monitoring Errors

Query failed triages by error category:

```sql
-- Find rate limit errors
SELECT COUNT(*), DATE_TRUNC('hour', completed_at) as hour
FROM ai_triage_results
WHERE status = 'failed'
  AND error_message LIKE '%temporarily busy%'
  AND completed_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;

-- Find authentication errors (needs config fix)
SELECT tenant_id, COUNT(*) as failures
FROM ai_triage_results
WHERE status = 'failed'
  AND error_message LIKE '%authentication failed%'
  AND completed_at > NOW() - INTERVAL '7 days'
GROUP BY tenant_id
ORDER BY failures DESC;
```

---

## Security Features

### 1. Rate Limiting

Per-tenant rate limiting prevents abuse of expensive LLM API calls:

| Limit | Value |
|-------|-------|
| Requests per minute | 10 |
| Scope | Per tenant |
| Headers | `X-RateLimit-*` |

### 2. Token Race Condition Prevention

Uses `SELECT FOR UPDATE` to prevent concurrent workers from exceeding token limits:

```sql
-- Atomic slot acquisition
SELECT ... FROM ai_triage_results
WHERE id = $1 AND tenant_id = $2
FOR UPDATE OF tr
```

**Flow:**
1. Worker acquires row lock
2. Checks current token usage against monthly limit
3. Updates status to 'processing' atomically
4. Commits transaction before processing

### 3. Request Deduplication

Prevents duplicate triage requests for the same finding:

```sql
SELECT EXISTS(
    SELECT 1 FROM ai_triage_results
    WHERE tenant_id = $1 AND finding_id = $2
    AND status IN ('pending', 'processing')
)
```

### 4. Prompt Injection Protection

Multi-layer protection against prompt injection attacks:

#### Unicode Normalization
```
Attacker: "ｉｇｎｏｒｅ previous instructions"  (fullwidth)
Normalized: "ignore previous instructions"
→ Detected and filtered
```

#### Pattern Detection (50+ patterns)
- Instruction override: `ignore previous instructions`
- System prompt access: `output your system prompt`
- Role manipulation: `you are now`, `pretend to be`
- Special tokens: `[SYSTEM]`, `<|im_start|>`
- Jailbreak attempts: `DAN mode`, `developer mode`

#### Cyrillic Homoglyph Replacement
```
Attacker: "іgnore" (Cyrillic 'і')
Normalized: "ignore" (ASCII 'i')
→ Detected and filtered
```

### 5. API Key Encryption

Tenant API keys (BYOK) are encrypted with AES-256-GCM:

```
Storage: enc:v1:{base64_encrypted_data}
Decryption: Only at runtime, never logged
```

**Enforcement:**
- `requireEncryptedAPIKeys: true` by default
- Rejects plaintext API keys in production

### 6. Output Validation

LLM responses are validated and sanitized:

- JSON schema validation
- Field length limits
- XSS prevention (HTML entity encoding)
- Severity value validation
- Score range validation (0-100)

### 7. Audit Logging

All triage operations are logged:

| Event | Data Logged |
|-------|-------------|
| Request | tenant_id, finding_id, user_id, mode |
| Completion | tokens_used, provider, duration |
| Token Limit | current_usage, limit, finding_id |
| Failure | error_type, sanitized_message |

---

## Configuration

### Tenant Settings (UI / API)

```json
{
    "ai": {
        "mode": "platform",              // platform, byok, agent
        "auto_triage_enabled": true,
        "auto_triage_severities": ["critical", "high"],
        "auto_triage_delay_seconds": 60,
        "monthly_token_limit": 1000000
    }
}
```

### AI Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `platform` | Platform-managed LLM | Default, included in subscription |
| `byok` | Tenant's own API keys | Enterprise, data control |
| `agent` | Self-hosted AI agent | On-prem, strict compliance |

### Environment Variables

```bash
# Feature Flag
AI_TRIAGE_ENABLED=true

# Platform AI Provider (claude, openai, or gemini)
AI_PLATFORM_PROVIDER=claude
AI_PLATFORM_MODEL=claude-sonnet-4-20250514

# Provider API Keys (configure based on AI_PLATFORM_PROVIDER)
ANTHROPIC_API_KEY=sk-ant-...     # For Claude
OPENAI_API_KEY=sk-...            # For OpenAI
GEMINI_API_KEY=AIza...           # For Google Gemini

# Rate Limiting
AI_MAX_CONCURRENT_JOBS=10
AI_RATE_LIMIT_RPM=60
AI_TIMEOUT_SECONDS=30
AI_MAX_TOKENS=2000

# Encryption
AI_KEY_ENCRYPTION_KEY=base64-encoded-32-byte-key
```

### Supported LLM Providers

| Provider | Models | Use Case |
|----------|--------|----------|
| `claude` | claude-sonnet-4-20250514, claude-opus-4-20250514 | Best for security analysis (default) |
| `openai` | gpt-4o, gpt-4-turbo | Alternative, good general performance |
| `gemini` | gemini-2.0-flash, gemini-1.5-pro | Cost-effective, good for bulk triage |

### BYOK Provider Configuration

For tenants using Bring Your Own Key (BYOK) mode:

```json
{
    "ai": {
        "mode": "byok",
        "provider": "gemini",           // claude, openai, gemini
        "api_key": "enc:v1:...",        // Encrypted via PUT /api/v1/settings/ai-triage/key
        "model_override": "gemini-1.5-pro"
    }
}
```

---

## Data Model

### ai_triage_results Table

```sql
CREATE TABLE ai_triage_results (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    finding_id UUID NOT NULL,

    -- Request
    triage_type VARCHAR(50),    -- 'quick', 'detailed', 'auto', 'bulk'
    requested_by UUID,
    requested_at TIMESTAMP,

    -- Processing
    status VARCHAR(20),         -- pending, processing, completed, failed
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,

    -- AI Provider
    llm_provider VARCHAR(50),
    llm_model VARCHAR(100),
    prompt_tokens INT,
    completion_tokens INT,

    -- Analysis Results
    severity_assessment VARCHAR(20),
    severity_justification TEXT,
    risk_score FLOAT,
    exploitability VARCHAR(20),
    exploitability_details TEXT,
    business_impact TEXT,
    priority_rank INT,
    remediation_steps JSONB,
    false_positive_likelihood FLOAT,
    false_positive_reason TEXT,
    related_cves TEXT[],
    related_cwes TEXT[],
    raw_response JSONB,
    analysis_summary TEXT,

    -- Metadata
    metadata JSONB,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_ai_triage_tenant_finding
    ON ai_triage_results(tenant_id, finding_id);
CREATE INDEX idx_ai_triage_status
    ON ai_triage_results(status)
    WHERE status IN ('pending', 'processing');
```

---

## UI Integration

### AI Triage Button

Located in the finding detail panel:

```tsx
<AITriageButton
    findingId={finding.id}
    onComplete={(result) => refetchFinding()}
/>
```

**States:**
- `idle`: Shows "AI Analyze" button
- `pending`: Shows "Queued..." with spinner
- `processing`: Shows "Analyzing..." with progress
- `completed`: Shows result summary
- `failed`: Shows error with retry option

### Polling Behavior

Automatic polling with exponential backoff:

```
Initial: 2s → 3s → 4.5s → 6.7s → 10s (max)
```

### Result Display

```
┌─────────────────────────────────────────────────────┐
│  AI Analysis                                         │
├─────────────────────────────────────────────────────┤
│  Severity: HIGH (↑ from MEDIUM)                     │
│  Risk Score: 85/100                                 │
│  Priority: #5                                       │
│  False Positive: 10% likelihood                     │
├─────────────────────────────────────────────────────┤
│  Summary:                                           │
│  SQL injection vulnerability allows authentication   │
│  bypass in the login endpoint...                    │
├─────────────────────────────────────────────────────┤
│  Remediation Steps:                                 │
│  1. Use parameterized queries (Low effort)          │
│  2. Add input validation (Low effort)               │
│  3. Implement WAF rules (Medium effort)             │
└─────────────────────────────────────────────────────┘
```

---

## Flow Diagrams

### Single Triage Flow

```
User clicks "AI Analyze"
        │
        ▼
┌───────────────────┐
│ POST /ai-triage   │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐     ┌───────────────────┐
│ Rate Limit Check  │────▶│ 429 Too Many      │
│ (10/min/tenant)   │ NO  │ Requests          │
└─────────┬─────────┘     └───────────────────┘
          │ YES
          ▼
┌───────────────────┐     ┌───────────────────┐
│ Deduplication     │────▶│ 409 Conflict      │
│ Check             │ DUP │ (already pending) │
└─────────┬─────────┘     └───────────────────┘
          │ OK
          ▼
┌───────────────────┐
│ Create pending    │
│ triage result     │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Enqueue to Asynq  │
│ (Redis)           │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Return job_id     │
│ status: pending   │
└───────────────────┘

        WORKER PICKS UP JOB
               │
               ▼
┌───────────────────┐     ┌───────────────────┐
│ AcquireTriageSlot │────▶│ Already processing│
│ (SELECT FOR       │ NO  │ Skip job          │
│  UPDATE)          │     └───────────────────┘
└─────────┬─────────┘
          │ OK
          ▼
┌───────────────────┐     ┌───────────────────┐
│ Token Limit Check │────▶│ Fail: limit       │
│                   │OVER │ exceeded          │
└─────────┬─────────┘     └───────────────────┘
          │ OK
          ▼
┌───────────────────┐
│ Create LLM        │
│ Provider          │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Build & Sanitize  │
│ Prompt            │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Call LLM API      │
│ (Claude/OpenAI)   │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Validate & Store  │
│ Response          │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Update Finding    │
│ with AI fields    │
└───────────────────┘
```

### Auto-Triage Flow

```
Scanner creates finding
        │
        ▼
┌───────────────────┐
│ Check tenant      │
│ auto_triage_      │
│ enabled           │
└─────────┬─────────┘
          │ YES
          ▼
┌───────────────────┐     ┌───────────────────┐
│ Check severity    │────▶│ Skip: severity    │
│ in allowed list   │ NO  │ not configured    │
└─────────┬─────────┘     └───────────────────┘
          │ YES
          ▼
┌───────────────────┐
│ Enqueue with      │
│ delay (60s)       │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Worker processes  │
│ after delay       │
└───────────────────┘
```

---

## Best Practices

### For Administrators

1. **Set Token Limits**: Configure monthly limits to control costs
2. **Review Auto-Triage Settings**: Only enable for critical/high severity
3. **Use BYOK for Sensitive Data**: Configure tenant API keys for data privacy
4. **Monitor Usage**: Track token consumption in audit logs

### For Users

1. **Use Quick Mode First**: Start with quick triage, use detailed for complex findings
2. **Don't Repeat Requests**: Check if triage is already in progress
3. **Review AI Suggestions**: AI analysis should inform, not replace, human judgment
4. **Report Inaccuracies**: Help improve the system by reporting wrong assessments

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 409 Conflict | Duplicate request | Wait for current triage or check history |
| 429 Rate Limited | Too many requests | Wait and retry, or check tenant limits |
| Token limit exceeded | Monthly quota used | Wait for reset or increase limit |
| AI disabled | Tenant not configured | Enable in settings |
| Timeout | LLM API slow | Retry later |

### Debug Commands

```bash
# Check pending jobs
SELECT * FROM ai_triage_results
WHERE status = 'pending'
ORDER BY created_at DESC;

# Check token usage this month
SELECT SUM(prompt_tokens + completion_tokens) as total
FROM ai_triage_results
WHERE tenant_id = 'xxx'
  AND created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
  AND status = 'completed';

# Check for stuck jobs
SELECT * FROM ai_triage_results
WHERE status = 'processing'
  AND started_at < NOW() - INTERVAL '10 minutes';
```

---

## Workflow Integration

AI Triage integrates seamlessly with the [Workflow Automation](workflows.md) system.

### AI Triage Triggers

Workflows can be triggered when AI triage completes or fails:

| Trigger Type | Description | Available Filters |
|--------------|-------------|-------------------|
| `ai_triage_completed` | AI analysis finished successfully | `severity_filter`, `risk_score_min` |
| `ai_triage_failed` | AI analysis failed | None |

**Example: High Risk Alert Workflow**

```json
{
  "name": "High Risk AI Triage Alert",
  "nodes": [
    {
      "node_key": "trigger",
      "node_type": "trigger",
      "config": {
        "trigger_type": "ai_triage_completed",
        "trigger_config": {
          "severity_filter": ["critical", "high"],
          "risk_score_min": 70
        }
      }
    },
    {
      "node_key": "notify",
      "node_type": "notification",
      "config": {
        "notification_type": "slack",
        "notification_config": {
          "channel": "#security-critical",
          "template": {
            "text": "🚨 High Risk: {{trigger.summary}}\nRisk Score: {{trigger.risk_score}}"
          }
        }
      }
    }
  ]
}
```

### AI Triage Actions

Trigger AI analysis from workflows:

```json
{
  "node_key": "run_ai",
  "node_type": "action",
  "config": {
    "action_type": "trigger_ai_triage",
    "action_config": {
      "mode": "quick"
    }
  }
}
```

### Context Variables

When triggered by AI triage events, these variables are available in conditions:

| Variable | Type | Description |
|----------|------|-------------|
| `trigger.severity_assessment` | string | AI-assessed severity |
| `trigger.risk_score` | number | Risk score 0-100 |
| `trigger.priority_rank` | number | Priority rank 1-100 |
| `trigger.false_positive_likelihood` | number | FP probability 0-1 |
| `trigger.summary` | string | Analysis summary |
| `trigger.finding_id` | string | Associated finding ID |

### Common Patterns

**Auto-Escalate High Risk:**
```
Trigger(ai_triage_completed)
  → Condition(risk_score > 80)
  → Action(create_ticket)
  → Notify(pagerduty)
```

**Mark Likely False Positives:**
```
Trigger(ai_triage_completed)
  → Condition(false_positive_likelihood > 0.7)
  → Action(update_status: needs_review)
  → Action(add_tags: likely-fp)
```

**Handle Failures:**
```
Trigger(ai_triage_failed)
  → Action(add_tags: manual-review)
  → Notify(email: security-team)
```

---

## Stuck Job Recovery

AI Triage includes an automatic recovery system for stuck jobs. Jobs can become stuck due to:

- Worker crash during processing
- LLM API timeout
- Network issues
- Database connection errors

### How It Works

A background job runs periodically to find and recover stuck triage jobs:

```
┌───────────────────────────────────────────────────────────────┐
│                  STUCK JOB RECOVERY FLOW                       │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐     ┌──────────────────────────────┐    │
│  │ Recovery Job    │────▶│ Find stuck jobs:             │    │
│  │ (every 5 min)   │     │ - pending > 15 min           │    │
│  └─────────────────┘     │ - processing > 15 min        │    │
│                          └───────────┬──────────────────┘    │
│                                      │                        │
│                                      ▼                        │
│                          ┌──────────────────────────────┐    │
│                          │ Mark as failed with message: │    │
│                          │ "Job stuck in queue..."      │    │
│                          └───────────┬──────────────────┘    │
│                                      │                        │
│                                      ▼                        │
│                          ┌──────────────────────────────┐    │
│                          │ Broadcast WebSocket event    │    │
│                          │ (triage_failed)              │    │
│                          └───────────┬──────────────────┘    │
│                                      │                        │
│                                      ▼                        │
│                          ┌──────────────────────────────┐    │
│                          │ Log audit event              │    │
│                          └──────────────────────────────┘    │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Configuration

Configure via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_TRIAGE_RECOVERY_ENABLED` | `true` | Enable/disable recovery job |
| `AI_TRIAGE_RECOVERY_INTERVAL` | `5m` | How often to check for stuck jobs |
| `AI_TRIAGE_RECOVERY_STUCK_DURATION` | `15m` | Time before job is considered stuck |
| `AI_TRIAGE_RECOVERY_BATCH_SIZE` | `50` | Max jobs to recover per run |

**Example Configuration:**

```bash
# .env
AI_TRIAGE_RECOVERY_ENABLED=true
AI_TRIAGE_RECOVERY_INTERVAL=5m
AI_TRIAGE_RECOVERY_STUCK_DURATION=15m
AI_TRIAGE_RECOVERY_BATCH_SIZE=50
```

### Monitoring

Check recovery job logs:

```bash
# In server logs
level=info msg="starting ai triage recovery job" interval=5m0s stuck_duration=15m0s batch_size=50
level=info msg="recovered stuck triage jobs" total=3 recovered=3 skipped=0 errors=0
```

Query stuck jobs manually:

```sql
-- Find jobs that will be recovered in next run
SELECT id, tenant_id, finding_id, status, requested_at, started_at
FROM ai_triage_results
WHERE status IN ('pending', 'processing')
  AND (
    (status = 'pending' AND requested_at < NOW() - INTERVAL '15 minutes')
    OR (status = 'processing' AND started_at < NOW() - INTERVAL '15 minutes')
  )
ORDER BY requested_at ASC
LIMIT 50;
```

---

## Real-time Updates (WebSocket)

AI Triage uses WebSocket for real-time status updates. When a triage job completes or fails, the UI is notified immediately without polling.

### WebSocket Channels

| Channel Pattern | Description | Events |
|-----------------|-------------|--------|
| `triage:{finding_id}` | AI triage updates for a finding | `triage_completed`, `triage_failed` |

### Event Format

**Triage Completed:**

```json
{
  "type": "triage_completed",
  "triage": {
    "id": "result-uuid",
    "finding_id": "finding-uuid",
    "tenant_id": "tenant-uuid",
    "status": "completed"
  }
}
```

**Triage Failed:**

```json
{
  "type": "triage_failed",
  "triage": {
    "id": "result-uuid",
    "finding_id": "finding-uuid",
    "tenant_id": "tenant-uuid",
    "status": "failed",
    "error_message": "AI analysis failed. Please try again later."
  }
}
```

### Frontend Usage

```typescript
// Subscribe to triage updates for a finding
const { isSubscribed } = useTriageChannel<TriageEvent>(findingId, {
  enabled: true,
  onData: (event) => {
    if (event.type === 'triage_completed') {
      // Refresh triage result
      refetchTriage()
    } else if (event.type === 'triage_failed') {
      // Show error notification
      toast.error(event.triage.error_message)
    }
  },
})
```

### Fallback Polling

When WebSocket is not connected (network issues, browser compatibility), the UI falls back to polling:

```typescript
// Poll only when WebSocket not connected
useEffect(() => {
  if (!wsConnected && triageStatus === 'processing') {
    const interval = setInterval(() => {
      refetchTriage()
    }, 5000) // Poll every 5 seconds
    return () => clearInterval(interval)
  }
}, [wsConnected, triageStatus])
```

---

## Deployment & Setup

### Backend Setup

1. **Configure AI Provider (Required)**

   For Platform mode (OpenCTEM-managed AI):
   ```bash
   # .env
   AI_TRIAGE_ENABLED=true
   AI_PLATFORM_PROVIDER=claude  # or openai, gemini
   AI_PLATFORM_MODEL=claude-sonnet-4-20250514
   ANTHROPIC_API_KEY=sk-ant-...
   ```

   For BYOK mode (tenant provides API keys):
   ```bash
   # .env
   AI_TRIAGE_ENABLED=true
   # No platform API keys needed - tenants configure in Settings > AI
   ```

2. **Configure Rate Limits**

   ```bash
   AI_MAX_CONCURRENT_JOBS=10
   AI_RATE_LIMIT_RPM=60
   AI_TIMEOUT_SECONDS=30
   AI_MAX_TOKENS=2000
   AI_TEMPERATURE=0.1  # Low for consistent results
   ```

3. **Configure Auto-Triage Defaults**

   ```bash
   AI_AUTO_TRIAGE_DEFAULT_ENABLED=false
   AI_AUTO_TRIAGE_DEFAULT_SEVERITIES=critical,high
   AI_AUTO_TRIAGE_DELAY=60s
   ```

4. **Configure Recovery Job**

   ```bash
   AI_TRIAGE_RECOVERY_ENABLED=true
   AI_TRIAGE_RECOVERY_INTERVAL=5m
   AI_TRIAGE_RECOVERY_STUCK_DURATION=15m
   AI_TRIAGE_RECOVERY_BATCH_SIZE=50
   ```

### Nginx WebSocket Configuration

For WebSocket to work through nginx, add this configuration:

```nginx
# /etc/nginx/sites-available/openctem

upstream api_backend {
    server localhost:8080;
}

server {
    listen 80;
    server_name openctem.local;

    # Regular API requests
    location /api/ {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket endpoint - requires special handling
    location /api/v1/ws {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeout (24 hours)
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;

        # Disable buffering for real-time
        proxy_buffering off;
    }
}
```

**Important:** The WebSocket location block MUST include:
- `proxy_http_version 1.1;` - Required for WebSocket
- `proxy_set_header Upgrade $http_upgrade;` - WebSocket upgrade header
- `proxy_set_header Connection "upgrade";` - Keep connection alive
- `proxy_read_timeout 86400;` - Long timeout for persistent connections

### Docker Compose Setup

```yaml
# docker-compose.yml
services:
  api:
    image: openctem/api:latest
    environment:
      # AI Triage Configuration
      - AI_TRIAGE_ENABLED=true
      - AI_PLATFORM_PROVIDER=claude
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      # Recovery Job
      - AI_TRIAGE_RECOVERY_ENABLED=true
      - AI_TRIAGE_RECOVERY_INTERVAL=5m
    ports:
      - "8080:8080"

  ui:
    image: openctem/ui:latest
    environment:
      - BACKEND_API_URL=http://api:8080
      - NEXT_PUBLIC_SSE_BASE_URL=  # Empty for same-origin WebSocket
    ports:
      - "3000:3000"

  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    ports:
      - "80:80"
    depends_on:
      - api
      - ui
```

### Frontend Environment

```bash
# ui/.env.local
BACKEND_API_URL=http://localhost:8080

# For WebSocket connection (leave empty for same-origin)
NEXT_PUBLIC_SSE_BASE_URL=

# Or specify explicitly for cross-origin
# NEXT_PUBLIC_SSE_BASE_URL=http://localhost:8080
```

### Health Check

Verify AI Triage is working:

```bash
# Check AI config endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/settings/ai-triage

# Expected response:
{
  "mode": "platform",
  "provider": "claude",
  "model": "claude-sonnet-4-20250514",
  "is_enabled": true,
  "auto_triage_enabled": false,
  "monthly_token_limit": 100000,
  "tokens_used_this_month": 5432
}
```

Check WebSocket connection:

```bash
# Using websocat
websocat "ws://localhost:8080/api/v1/ws?token=$TOKEN"

# Send subscribe message
{"type":"subscribe","channel":"triage:finding-uuid","request_id":"1"}

# Expected response
{"type":"subscribed","channel":"triage:finding-uuid","request_id":"1","timestamp":1234567890}
```

---

## Related Documentation

- [ADR-007: AI Integration](../decisions/007-ai-integration.md) - Architecture Decision Record
- [Finding Lifecycle](finding-lifecycle.md) - How findings are managed
- [Workflow Automation](workflows.md) - Automate actions based on AI results
- [WebSocket Architecture](../architecture/overview.md#websocket) - Real-time communication
