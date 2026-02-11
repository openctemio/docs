---
layout: default
parent: Architecture
---
---
layout: default
title: SDK & API Integration
parent: Architecture
nav_order: 3
---
# SDK & API Integration Architecture

This document describes how the OpenCTEM SDK integrates with the Backend API for multi-tenant security data ingestion.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TENANT ENVIRONMENT                              │
│                                                                         │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                    │
│   │ Scanner 1   │  │ Scanner 2   │  │ Collector   │                    │
│   │ SDK Agent   │  │ SDK Agent   │  │ SDK Agent   │                    │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                    │
│          │                │                │                            │
│          └────────────────┼────────────────┘                            │
│                           │                                             │
│                    ┌──────┴──────┐                                      │
│                    │ API Client  │                                      │
│                    │             │                                      │
│                    │ - API Key   │                                      │
│                    │ - Source ID │                                      │
│                    └──────┬──────┘                                      │
└───────────────────────────┼─────────────────────────────────────────────┘
                            │
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         OPENCTEM API                                     │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                    API Gateway / Router                          │  │
│   └───────────────────────────┬─────────────────────────────────────┘  │
│                               │                                         │
│   ┌───────────────────────────┼─────────────────────────────────────┐  │
│   │              Authentication Middleware                           │  │
│   │                                                                  │  │
│   │  1. Validate API Key (Authorization header)                     │  │
│   │  2. Extract tenant_id from API key                              │  │
│   │  3. Validate Source ID belongs to tenant                        │  │
│   │  4. Attach context: tenant_id, source_id                        │  │
│   └───────────────────────────┬─────────────────────────────────────┘  │
│                               │                                         │
│   ┌───────────────────────────┼─────────────────────────────────────┐  │
│   │                    Ingest Service                                │  │
│   │                                                                  │  │
│   │  POST /api/v1/ingest/findings                                   │  │
│   │  POST /api/v1/ingest/assets                                     │  │
│   │  POST /api/v1/ingest/heartbeat                                  │  │
│   │                                                                  │  │
│   │  - Validate CTIS schema                                          │  │
│   │  - Deduplicate findings (fingerprint)                           │  │
│   │  - Associate with tenant + source                               │  │
│   │  - Store with audit trail                                       │  │
│   └───────────────────────────┬─────────────────────────────────────┘  │
│                               │                                         │
│   ┌───────────────────────────┼─────────────────────────────────────┐  │
│   │                      Database                                    │  │
│   │                                                                  │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │  │
│   │  │  api_keys   │  │  sources    │  │  findings               │ │  │
│   │  │             │  │             │  │                         │ │  │
│   │  │ key_hash    │  │ tenant_id   │  │ tenant_id              │ │  │
│   │  │ tenant_id ──┼──│ name        │  │ source_id (nullable)   │ │  │
│   │  │ scopes      │  │ type        │  │ fingerprint            │ │  │
│   │  │ last_used   │  │ status      │  │ severity, title, ...   │ │  │
│   │  └─────────────┘  └─────────────┘  └─────────────────────────┘ │  │
│   │                                                                  │  │
│   │  ┌─────────────────────────────────────────────────────────────┐│  │
│   │  │  finding_data_sources (audit trail)                         ││  │
│   │  │                                                             ││  │
│   │  │  finding_id, source_id, first_seen_at, last_seen_at,       ││  │
│   │  │  source_ref, scan_id, contributed_data, confidence         ││  │
│   │  └─────────────────────────────────────────────────────────────┘│  │
│   └─────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Authentication Flow

### 1. API Key Types

| Key Type | Format | Purpose | Scopes |
|----------|--------|---------|--------|
| Source Key | `rs_src_xxxxxxxx` | Scanner/Collector authentication | `ingest:write` |
| User Key | `rs_usr_xxxxxxxx` | User API access | `read`, `write`, `admin` |
| Integration Key | `rs_int_xxxxxxxx` | Third-party integrations | Variable |

### 2. Request Headers

```http
POST /api/v1/ingest/findings HTTP/1.1
Host: api.openctem.io
Content-Type: application/json
Authorization: Bearer rs_src_xxxxxxxxxxxxxxxxxxxxxxxx
X-OpenCTEM-Source-ID: src_abc123def456
User-Agent: sdk/1.0
```

### 3. Authentication Middleware

```go
// Pseudocode for API authentication
func AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // 1. Extract API key from Authorization header
        apiKey := extractBearerToken(r)
        if apiKey == "" {
            respondError(w, 401, "missing authorization")
            return
        }

        // 2. Validate API key and get tenant
        keyInfo, err := apiKeyService.Validate(r.Context(), apiKey)
        if err != nil {
            respondError(w, 401, "invalid api key")
            return
        }

        // 3. Check scopes
        if !keyInfo.HasScope("ingest:write") {
            respondError(w, 403, "insufficient permissions")
            return
        }

        // 4. Validate source ID if provided
        sourceID := r.Header.Get("X-OpenCTEM-Source-ID")
        if sourceID != "" {
            source, err := sourceService.Get(r.Context(), sourceID)
            if err != nil || source.TenantID != keyInfo.TenantID {
                respondError(w, 403, "invalid source id")
                return
            }
        }

        // 5. Attach to context
        ctx := context.WithValue(r.Context(), "tenant_id", keyInfo.TenantID)
        ctx = context.WithValue(ctx, "source_id", sourceID)
        ctx = context.WithValue(ctx, "api_key_id", keyInfo.ID)

        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

---

## SDK Configuration

### Client Configuration

```go
client := client.New(&client.Config{
    BaseURL:  "https://api.openctem.io",
    APIKey:   "rs_src_xxxxxxxxxxxxxxxxxxxxxxxx", // Source API key
    SourceID: "src_abc123def456",                // Registered source ID
    Timeout:  30 * time.Second,
    MaxRetries: 3,
    RetryDelay: 2 * time.Second,
})
```

### Agent Configuration (YAML)

```yaml
agent:
  name: production-scanner
  version: "1.0.0"
  scan_interval: 1h
  heartbeat_interval: 1m

server:
  base_url: https://api.openctem.io
  api_key: ${API_KEY}      # Source API key
  source_id: ${SOURCE_ID}  # Registered source ID
  timeout: 30s
  max_retries: 3

scanners:
  - name: semgrep
    enabled: true
  - name: gitleaks
    enabled: true

targets:
  - /path/to/codebase
```

---

## Ingest Endpoints

### POST /api/v1/ingest/findings

**Request:**
```json
{
  "version": "1.0",
  "metadata": {
    "id": "scan-20240116-001",
    "timestamp": "2024-01-16T10:00:00Z",
    "duration_ms": 5000,
    "source_type": "scanner"
  },
  "tool": {
    "name": "semgrep",
    "version": "1.50.0",
    "capabilities": ["sast", "secret"]
  },
  "assets": [
    {
      "id": "asset-1",
      "type": "repository",
      "value": "github.com/org/repo",
      "criticality": "high"
    }
  ],
  "findings": [
    {
      "id": "finding-1",
      "type": "vulnerability",
      "title": "SQL Injection",
      "severity": "critical",
      "confidence": 95,
      "rule_id": "CWE-89",
      "asset_ref": "asset-1",
      "fingerprint": "sha256:xxxx",
      "location": {
        "path": "src/db/query.go",
        "start_line": 45
      }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Ingested successfully",
  "findings_created": 1,
  "findings_updated": 0,
  "assets_created": 1,
  "assets_updated": 0,
  "duplicates_skipped": 0
}
```

### POST /api/v1/ingest/heartbeat

**Request:**
```json
{
  "name": "production-scanner",
  "status": "running",
  "version": "1.0.0",
  "hostname": "scanner-01.example.com",
  "scanners": ["semgrep", "gitleaks"],
  "collectors": [],
  "uptime_seconds": 3600,
  "total_scans": 100,
  "errors": 0
}
```

**Response:**
```json
{
  "success": true,
  "server_time": "2024-01-16T10:00:00Z"
}
```

---

## Source Registration

### Register a New Source

Sources should be registered before use. This can be done via API or UI.

**POST /api/v1/sources**

```json
{
  "name": "Production Semgrep Scanner",
  "type": "scanner",
  "description": "Runs Semgrep on production codebase",
  "capabilities": ["sast", "secret"],
  "metadata": {
    "environment": "production",
    "team": "security"
  }
}
```

**Response:**
```json
{
  "id": "src_abc123def456",
  "api_key": "rs_src_xxxxxxxxxxxxxxxxxxxx",
  "api_key_prefix": "rs_src_xxxx",
  "name": "Production Semgrep Scanner",
  "type": "scanner",
  "status": "active",
  "created_at": "2024-01-16T10:00:00Z"
}
```

> **Important:** Save the `api_key` immediately - it's only shown once!

---

## Deduplication Strategy

### Finding Fingerprint

Findings are deduplicated using a fingerprint composed of:

```
fingerprint = SHA256(
    tenant_id +
    rule_id +
    asset_value +
    location.path +
    location.start_line +
    title
)
```

### Deduplication Logic

```
IF fingerprint exists for tenant:
    Update last_seen_at
    Update finding_data_sources (add source if new)
    Merge contributed_data
ELSE:
    Create new finding
    Create finding_data_source record
```

---

## Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/ingest/findings` | 100 req/min | Per source |
| `/ingest/assets` | 100 req/min | Per source |
| `/ingest/heartbeat` | 10 req/min | Per source |

Rate limit headers:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705401600
```

---

## Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_REQUEST` | Malformed JSON or invalid CTIS schema |
| 401 | `UNAUTHORIZED` | Missing or invalid API key |
| 403 | `FORBIDDEN` | Source ID doesn't belong to tenant |
| 404 | `NOT_FOUND` | Source not found |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

**Error Response Format:**
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid CTIS schema: missing required field 'version'",
    "details": {
      "field": "version",
      "reason": "required"
    }
  }
}
```

---

## Best Practices

### 1. Use Source IDs
Always register sources and include `X-OpenCTEM-Source-ID` header for audit trail.

### 2. Include Fingerprints
Include fingerprints in findings to enable proper deduplication.

### 3. Batch Requests
Send findings in batches (up to 1000 per request) rather than one at a time.

### 4. Handle Retries
SDK includes automatic retry with exponential backoff. Don't retry on 4xx errors.

### 5. Send Heartbeats
Keep sources "alive" by sending regular heartbeats.

---

## Implementation Checklist

### Backend API Tasks

- [ ] Create `POST /api/v1/sources` - Source registration
- [ ] Create `POST /api/v1/ingest/findings` - Finding ingestion
- [ ] Create `POST /api/v1/ingest/assets` - Asset ingestion
- [ ] Create `POST /api/v1/ingest/heartbeat` - Heartbeat
- [ ] Add API key authentication middleware
- [ ] Add source validation middleware
- [ ] Add rate limiting middleware
- [ ] Add CTIS schema validation
- [ ] Add fingerprint-based deduplication
- [ ] Add finding_data_sources tracking

### SDK Tasks (Completed)

- [x] Core interfaces (Scanner, Parser, Collector, Agent, Pusher)
- [x] BaseScanner with preset configurations
- [x] BaseCollector with GitHub, Webhook implementations
- [x] BaseAgent for daemon mode
- [x] Parser registry with SARIF, JSON parsers
- [x] API client with retry logic
- [x] Source ID support
- [x] CTIS types as single source of truth

---

## Related Documentation

- [SDK Development Guide](../guides/sdk-development.md)
- [Building Ingestion Tools](../guides/building-ingestion-tools.md)
- [API Reference](../backend/api-reference.md)
