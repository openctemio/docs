---
layout: default
title: "ADR-007: AI Integration - Triage & Analysis System"
parent: Decisions
nav_order: 7
---

# ADR-007: AI Integration - Triage & Analysis System

**Status:** Implemented
**Date:** 2025-02-01
**Authors:** Engineering Team

> **Implementation Complete**: All phases implemented with comprehensive security features including rate limiting, token race condition prevention, request deduplication, unicode normalization for prompt injection protection, and encrypted API key storage.

---

## Context

Security teams face an overwhelming volume of findings from various scanners, making manual triage time-consuming and error-prone. AI can assist in:
- Analyzing and prioritizing vulnerabilities based on context
- Detecting false positives
- Generating remediation guidance
- Correlating related findings

### Business Requirements

1. **Multi-Tenant Architecture**
   - Tenants can use platform-provided AI (included in subscription)
   - Tenants can configure their own API keys (data privacy concerns)
   - Enterprise tenants may deploy self-hosted AI agents

2. **Integration Points**
   - Auto-triage on new findings (configurable per tenant)
   - On-demand analysis by user request
   - Bulk triage for prioritization
   - Smart notification routing

---

## Use Cases

### UC1: Auto-Triage New Findings
```
Scanner detects vulnerability → Finding created → AI Triage job enqueued
                                                         ↓
                                               AI analyzes & enriches
                                                         ↓
                                               Finding updated with:
                                               - Adjusted severity
                                               - Risk score (0-100)
                                               - Priority rank
                                               - Analysis summary
```

### UC2: On-Demand Triage (User Request)
```
User clicks "AI Analyze" on finding → API request → AI Triage job
                                                         ↓
                                               Detailed analysis:
                                               - Exploitability assessment
                                               - Business impact evaluation
                                               - Remediation steps
                                               - Related CVEs/CWEs
```

### UC3: Bulk Triage & Prioritization
```
User selects multiple findings → Bulk AI Triage → Prioritized results
                                                         ↓
                                               Recommendations:
                                               - Fix order by priority
                                               - Group by root cause
                                               - Effort estimation
```

### UC4: Smart Notification Routing
```
Finding created → AI evaluates severity + context → Route appropriately
                                                         ↓
                                               - Critical + Internet-facing → Slack #security-critical
                                               - High + PCI scope → Email compliance team
                                               - Low severity → Weekly digest
```

### UC5: False Positive Detection
```
New finding → AI analyzes code context → Flag potential false positive
                                                         ↓
                                               - Suggest: "May be FP: input sanitized at line 42"
                                               - Auto-set status: needs_review
                                               - Confidence score: 0.85
```

### UC6: Remediation Guidance
```
User requests fix help → AI analyzes finding + codebase → Generate guidance
                                                         ↓
                                               - Specific code fix suggestion
                                               - Security best practices
                                               - Related documentation links
```

---

## Decision

### Hybrid AI Architecture

Support three AI deployment models to accommodate different tenant needs:

| Model | Description | Use Case |
|-------|-------------|----------|
| **Platform AI** | Platform-managed, shared infrastructure | SMB, standard privacy |
| **Tenant API Keys** | Tenant's own LLM API keys | Enterprise, data control |
| **Self-Hosted Agent** | Tenant-deployed AI agent | On-prem, strict compliance |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              OPENCTEM API                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────────┐    ┌────────────────────┐    │
│  │   Finding    │───▶│   AI Triage      │───▶│   Asynq Job Queue  │    │
│  │   Service    │    │   Service        │    │   (Redis)          │    │
│  └──────────────┘    └──────────────────┘    └─────────┬──────────┘    │
│                                                        │               │
│                                ┌───────────────────────┼───────────────┤
│                                │                       │               │
│                                ▼                       ▼               │
│                    ┌─────────────────────┐ ┌─────────────────────┐     │
│                    │   Platform AI       │ │   AI Agent Gateway  │     │
│                    │   Worker            │ │   (Self-hosted)     │     │
│                    └──────────┬──────────┘ └──────────┬──────────┘     │
│                               │                       │               │
│                               ▼                       ▼               │
│                    ┌─────────────────────┐ ┌─────────────────────┐     │
│                    │   LLM Router        │ │   Tenant AI Agent   │     │
│                    │   (Claude/OpenAI)   │ │   (On-prem)         │     │
│                    └──────────┬──────────┘ └─────────────────────┘     │
│                               │                                        │
│                               ▼                                        │
│                    ┌─────────────────────┐                             │
│                    │   Enrichment        │───▶ Update Finding          │
│                    │   Result            │                             │
│                    └─────────────────────┘                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### New Table: `ai_triage_results`

```sql
CREATE TABLE ai_triage_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    finding_id UUID NOT NULL REFERENCES findings(id),

    -- Request
    triage_type VARCHAR(50) NOT NULL,  -- 'auto', 'manual', 'bulk'
    requested_by UUID REFERENCES users(id),
    requested_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Processing
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,

    -- AI Provider Info
    llm_provider VARCHAR(50),       -- 'claude', 'openai', 'tenant_agent'
    llm_model VARCHAR(100),         -- 'claude-3-5-sonnet', 'gpt-4-turbo'
    prompt_tokens INT,
    completion_tokens INT,

    -- Analysis Results
    severity_assessment VARCHAR(20),        -- AI recommended severity
    severity_justification TEXT,
    risk_score FLOAT,                       -- 0-100
    exploitability VARCHAR(20),             -- 'high', 'medium', 'low', 'theoretical'
    business_impact TEXT,

    -- Recommendations
    priority_rank INT,                      -- 1-100 (1 = most urgent)
    remediation_steps JSONB,                -- [{step, description, effort}]
    false_positive_likelihood FLOAT,        -- 0-1
    false_positive_reason TEXT,
    related_cves TEXT[],
    related_cwes TEXT[],

    -- Full Response
    raw_response JSONB,
    analysis_summary TEXT,

    -- Metadata
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_finding FOREIGN KEY (finding_id) REFERENCES findings(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_ai_triage_tenant_finding ON ai_triage_results(tenant_id, finding_id);
CREATE INDEX idx_ai_triage_status ON ai_triage_results(status) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_ai_triage_created ON ai_triage_results(created_at DESC);
```

### New Table: `tenant_ai_config`

```sql
CREATE TABLE tenant_ai_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id),

    -- AI Mode
    ai_mode VARCHAR(20) NOT NULL DEFAULT 'platform',  -- 'platform', 'byok', 'agent'

    -- BYOK (Bring Your Own Key) Configuration
    llm_provider VARCHAR(50),           -- 'claude', 'openai', 'azure_openai'
    api_key_encrypted TEXT,             -- AES-256-GCM encrypted
    api_key_iv TEXT,                    -- Initialization vector
    azure_endpoint TEXT,                -- For Azure OpenAI
    model_override VARCHAR(100),        -- Optional model preference

    -- Agent Configuration
    agent_endpoint TEXT,                -- Self-hosted agent URL
    agent_api_key_encrypted TEXT,       -- Agent authentication
    agent_api_key_iv TEXT,

    -- Auto-Triage Settings
    auto_triage_enabled BOOLEAN NOT NULL DEFAULT false,
    auto_triage_severities TEXT[] DEFAULT ARRAY['critical', 'high'],
    auto_triage_delay_seconds INT DEFAULT 60,

    -- Limits
    monthly_token_limit INT,            -- Optional cost control
    tokens_used_this_month INT DEFAULT 0,

    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
```

### Finding Entity Extension

```go
// Add to Finding entity (existing file)
type Finding struct {
    // ... existing fields ...

    // AI Triage Fields
    AITriageStatus            *string    `json:"ai_triage_status,omitempty"`             // pending, completed, failed
    AITriagedAt               *time.Time `json:"ai_triaged_at,omitempty"`
    AIAdjustedSeverity        *Severity  `json:"ai_adjusted_severity,omitempty"`
    AIRiskScore               *float64   `json:"ai_risk_score,omitempty"`                // 0-100
    AIPriorityRank            *int       `json:"ai_priority_rank,omitempty"`             // 1-100
    AIFalsePositiveLikelihood *float64   `json:"ai_false_positive_likelihood,omitempty"` // 0-1
    AIAnalysisSummary         *string    `json:"ai_analysis_summary,omitempty"`
}
```

---

## API Endpoints

### AI Triage Endpoints

```
# Trigger triage for single finding
POST /api/v1/findings/{id}/ai-triage
Request:  { "mode": "quick|detailed" }
Response: { "job_id": "uuid", "status": "queued" }

# Get triage result
GET /api/v1/findings/{id}/ai-triage
Response: { "status": "completed", "result": {...} }

# Get triage history
GET /api/v1/findings/{id}/ai-triage/history
Response: { "results": [...] }

# Bulk triage
POST /api/v1/findings/ai-triage/bulk
Request:  { "finding_ids": ["uuid", ...], "mode": "quick" }
Response: { "job_id": "uuid", "status": "queued", "count": 10 }

# Cancel pending triage
DELETE /api/v1/findings/{id}/ai-triage/{job_id}
Response: { "status": "cancelled" }
```

### AI Settings Endpoints (Tenant Admin)

```
# Get AI configuration
GET /api/v1/settings/ai
Response: {
    "ai_mode": "platform",
    "auto_triage_enabled": true,
    "auto_triage_severities": ["critical", "high"],
    "monthly_token_limit": 1000000,
    "tokens_used_this_month": 45000
}

# Update AI configuration
PUT /api/v1/settings/ai
Request: {
    "ai_mode": "byok",
    "llm_provider": "claude",
    "api_key": "sk-ant-...",   // Will be encrypted server-side
    "auto_triage_enabled": true,
    "auto_triage_severities": ["critical", "high"]
}

# Test AI connection
POST /api/v1/settings/ai/test
Response: { "success": true, "latency_ms": 250, "model": "claude-3-5-sonnet" }
```

---

## LLM Provider Abstraction

### Interface Design

```go
// api/internal/infra/llm/provider.go

type LLMProvider interface {
    // Complete sends a prompt and returns the completion
    Complete(ctx context.Context, req CompletionRequest) (*CompletionResponse, error)

    // Name returns the provider name for logging
    Name() string

    // Validate checks if the configuration is valid
    Validate() error
}

type CompletionRequest struct {
    Prompt      string
    MaxTokens   int
    Temperature float64
    JSONMode    bool  // Request JSON response format
}

type CompletionResponse struct {
    Content         string
    PromptTokens    int
    CompletionTokens int
    Model           string
    FinishReason    string
}
```

### Supported Providers

| Provider | Model | Notes |
|----------|-------|-------|
| Claude (Anthropic) | claude-3-5-sonnet-20241022 | Primary, best for security analysis |
| OpenAI | gpt-4-turbo | Fallback |
| Azure OpenAI | gpt-4 | Enterprise deployments |

---

## Prompt Engineering

### Triage Prompt Template

```
You are a senior security analyst performing vulnerability triage. Analyze the following finding and provide a structured assessment.

## Finding Information
- **Title:** {title}
- **Description:** {description}
- **Current Severity:** {severity} (CVSS: {cvss_score})
- **Source:** {source} ({tool_name})
- **File:** {file_path}:{start_line}

### Code Snippet
```{language}
{snippet}
```

## Context
- **CVE:** {cve_id}
- **CWE:** {cwe_ids}
- **OWASP:** {owasp_ids}
- **Asset Type:** {asset_type}
- **Internet Accessible:** {is_internet_accessible}
- **Data Exposure Risk:** {data_exposure_risk}
- **Compliance Impact:** {compliance_frameworks}

## Analysis Required
1. **Severity Assessment:** Is the current severity appropriate? Justify any changes.
2. **Exploitability:** How easily can this be exploited in a real-world scenario?
3. **Business Impact:** What is the potential impact on the organization?
4. **False Positive:** Is this likely a false positive? Provide reasoning.
5. **Priority:** On a scale of 1-100, how urgent is remediation? (1 = most urgent)
6. **Remediation:** What are the recommended steps to fix this?

## Response Format
Respond with valid JSON only:
{
    "severity_assessment": "critical|high|medium|low|info",
    "severity_justification": "...",
    "risk_score": 0-100,
    "exploitability": "high|medium|low|theoretical",
    "exploitability_details": "...",
    "business_impact": "...",
    "false_positive_likelihood": 0.0-1.0,
    "false_positive_reason": "...",
    "priority_rank": 1-100,
    "remediation_steps": [
        {"step": 1, "description": "...", "effort": "low|medium|high"}
    ],
    "related_cves": ["CVE-..."],
    "related_cwes": ["CWE-..."],
    "summary": "One-paragraph summary of the analysis"
}
```

---

## Configuration

### Environment Variables

```bash
# Feature Flag
AI_TRIAGE_ENABLED=true

# Platform AI (Default Provider)
AI_PLATFORM_PROVIDER=claude
AI_PLATFORM_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_API_KEY=sk-ant-...

# Fallback Provider
OPENAI_API_KEY=sk-...

# Rate Limiting
AI_MAX_CONCURRENT_JOBS=10
AI_RATE_LIMIT_RPM=60
AI_TIMEOUT_SECONDS=30
AI_MAX_TOKENS=2000

# Auto-Triage Defaults
AI_AUTO_TRIAGE_DEFAULT_ENABLED=false
AI_AUTO_TRIAGE_DEFAULT_SEVERITIES=critical,high
AI_AUTO_TRIAGE_DELAY_SECONDS=60

# Encryption for BYOK keys
AI_KEY_ENCRYPTION_KEY=base64-encoded-32-byte-key
```

### Config Struct

```go
// api/internal/config/config.go

type AITriageConfig struct {
    Enabled            bool          `mapstructure:"enabled" default:"false"`

    // Platform AI
    PlatformProvider   string        `mapstructure:"platform_provider" default:"claude"`
    PlatformModel      string        `mapstructure:"platform_model" default:"claude-3-5-sonnet-20241022"`
    AnthropicAPIKey    string        `mapstructure:"anthropic_api_key"`
    OpenAIAPIKey       string        `mapstructure:"openai_api_key"`

    // Rate Limiting
    MaxConcurrentJobs  int           `mapstructure:"max_concurrent_jobs" default:"10"`
    RateLimitRPM       int           `mapstructure:"rate_limit_rpm" default:"60"`
    TimeoutSeconds     int           `mapstructure:"timeout_seconds" default:"30"`
    MaxTokens          int           `mapstructure:"max_tokens" default:"2000"`

    // Auto-Triage Defaults
    AutoTriageEnabled    bool        `mapstructure:"auto_triage_enabled" default:"false"`
    AutoTriageSeverities []string    `mapstructure:"auto_triage_severities" default:"critical,high"`
    AutoTriageDelay      int         `mapstructure:"auto_triage_delay_seconds" default:"60"`

    // Encryption
    KeyEncryptionKey     string      `mapstructure:"key_encryption_key"`
}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure
**Goal:** Establish foundation for AI integration

1. Add `AITriageConfig` to config system
2. Create LLM provider interface and Claude implementation
3. Create domain entities (`TriageResult`, `TenantAIConfig`)
4. Database migrations for new tables
5. Create repositories

**Files:**
```
api/internal/config/config.go                   # Add AITriageConfig
api/internal/infra/llm/provider.go              # LLM interface
api/internal/infra/llm/claude_provider.go       # Claude implementation
api/internal/domain/ai/triage_result.go         # TriageResult entity
api/internal/domain/ai/tenant_config.go         # TenantAIConfig entity
api/internal/infra/postgres/migrations/xxx.sql  # New tables
api/internal/infra/postgres/ai_repository.go    # Repository
```

### Phase 2: Backend Services
**Goal:** Implement triage service and job processing

1. Implement `AITriageService`
2. Implement Asynq task handlers
3. Add HTTP handlers for API endpoints
4. Integrate with `FindingService` for auto-triage hook

**Files:**
```
api/internal/app/ai_triage_service.go           # Main service
api/internal/infra/jobs/ai_triage_tasks.go      # Asynq handlers
api/internal/interfaces/http/ai_triage_handler.go # HTTP handlers
api/internal/app/finding_service.go             # Hook auto-triage
```

### Phase 3: UI Integration
**Goal:** Add AI triage to finding detail page

1. Add "AI Analyze" button to finding detail
2. Create result display component
3. Add loading/progress states
4. Add settings panel in team settings

**Files:**
```
ui/src/features/ai-triage/api/use-ai-triage.ts
ui/src/features/ai-triage/components/ai-triage-button.tsx
ui/src/features/ai-triage/components/ai-triage-result.tsx
ui/src/features/settings/components/ai-settings-panel.tsx
```

### Phase 4: Advanced Features
**Goal:** Bulk operations and smart routing

1. Bulk triage with prioritization
2. Smart notification routing based on AI analysis
3. Enhanced false positive detection
4. Remediation code generation (if code context available)

---

## Security Considerations

### Implemented Security Features

1. **API Key Protection** ✅
   - Store tenant keys encrypted with AES-256-GCM (`enc:v1:` prefix)
   - `requireEncryptedAPIKeys: true` by default - rejects plaintext keys
   - Keys decrypted only at runtime, never logged
   - Use separate encryption key per environment

2. **Rate Limiting** ✅
   - Per-tenant rate limits: 10 requests/minute
   - Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
   - Returns 429 with `Retry-After` header when exceeded

3. **Token Race Condition Prevention** ✅
   - Uses `SELECT FOR UPDATE` to lock rows during processing
   - Atomic slot acquisition prevents concurrent workers from exceeding limits
   - `AcquireTriageSlot` method combines lock + check + update in one transaction

4. **Request Deduplication** ✅
   - `HasPendingOrProcessing` check prevents duplicate requests
   - Returns 409 Conflict with actionable error message
   - Avoids wasted LLM API calls

5. **Prompt Injection Protection** ✅
   - **Unicode Normalization**: NFKC normalization to prevent fullwidth character bypass
   - **Cyrillic Homoglyph Replacement**: Converts lookalike characters to ASCII
   - **Pattern Detection**: 50+ regex patterns for injection attempts
   - **Control Character Removal**: Strips zero-width and direction override characters

6. **Input Validation** ✅
   - Mode field validation (`quick` or `detailed` only)
   - Bulk request limits: max 100 findings, max 64KB payload
   - UUID format validation for finding IDs

7. **Output Validation** ✅
   - JSON schema validation for LLM responses
   - Field sanitization (XSS prevention)
   - Severity/score range validation

8. **Audit Trail** ✅
   - Log all AI triage requests with tenant/user context
   - Track token usage per tenant per month
   - Log token limit exceeded events
   - Store raw AI responses for debugging

9. **Multi-Tenancy** ✅
   - Row-level security on `ai_triage_results`
   - Tenant isolation in job queue (tenant_id in job payload)
   - `ORDER BY tenant_id` for batch processing isolation
   - Never mix findings across tenants in prompts

10. **Error Message Sanitization** ✅
    - Generic error messages returned to clients
    - Detailed errors logged internally
    - Actionable `details` field with resolution guidance

---

## Verification

### Manual Testing
1. Create a critical finding → Verify auto-triage job enqueued (if enabled)
2. Click "AI Analyze" on finding → Verify job completes and result displayed
3. Check AI enrichment fields populated correctly
4. Test BYOK configuration with own API key
5. Test rate limiting behavior
6. Test error handling (invalid API key, timeout, provider unavailable)

### Automated Testing
1. Unit tests for LLM provider (mock HTTP responses)
2. Integration tests for AITriageService
3. E2E test for full triage flow
4. Load test for concurrent triage jobs

### Metrics to Track
- Triage job success/failure rate
- Average response time (p50, p95, p99)
- Token usage per triage (by mode: quick vs detailed)
- False positive detection accuracy (when users confirm/override)
- Monthly token usage per tenant

---

## Future Enhancements

1. **AI Agent for Self-Hosted**
   - Deploy as Docker container
   - Connect via WebSocket for real-time updates
   - Support local LLMs (Ollama, vLLM)

2. **Learning from Feedback**
   - Track when users override AI decisions
   - Fine-tune prompts based on feedback patterns
   - Tenant-specific prompt customization

3. **Code-Aware Analysis**
   - Fetch surrounding code context
   - Analyze data flow for more accurate FP detection
   - Generate code patches for remediation

4. **Batch Processing Optimization**
   - Group similar findings in single prompt
   - Reduce token usage through deduplication
   - Cache common vulnerability patterns
