---
layout: default
title: Scanner Templates
parent: Features
nav_order: 4
---
{% raw %}

# Scanner Templates

## Overview

Scanner Templates allow tenants to create and manage custom detection rules for security scanners. Templates are validated, stored, and automatically delivered to agents during scan execution.

## Supported Template Types

| Scanner | Template Format | File Extension | Max Size | Max Rules |
|---------|----------------|----------------|----------|-----------|
| **Nuclei** | YAML | `.yaml` | 1MB | 100 |
| **Semgrep** | YAML | `.yaml` | 512KB | 500 |
| **Gitleaks** | TOML | `.toml` | 256KB | 1000 |

## Template Formats

### Nuclei Templates (YAML)

Nuclei templates define HTTP-based vulnerability checks:

```yaml
id: custom-sqli-check
info:
  name: Custom SQL Injection Check
  author: security-team
  severity: high
  description: Detects SQL injection in search parameters
  tags: sqli,owasp,custom

requests:
  - method: GET
    path:
      - "{{BaseURL}}/search?q={{payload}}"
    payloads:
      payload:
        - "' OR '1'='1"
        - "1; DROP TABLE users--"
    matchers:
      - type: word
        words:
          - "SQL syntax"
          - "mysql_fetch"
        condition: or
```

**Required Fields:**
- `id` - Unique template identifier
- `info.name` - Template name
- `info.severity` - One of: critical, high, medium, low, info
- `requests` or `workflows` - Detection logic

### Semgrep Rules (YAML)

Semgrep rules define static analysis patterns:

```yaml
rules:
  - id: custom-hardcoded-secret
    pattern: password = "$SECRET"
    message: Hardcoded password detected in source code
    severity: ERROR
    languages: [python, javascript, java]
    metadata:
      cwe: CWE-798
      owasp: A3:2017
      category: security
```

**Required Fields:**
- `rules[]` - Array of rules
- `rules[].id` - Rule identifier
- `rules[].pattern` or `rules[].patterns` - Detection pattern
- `rules[].message` - Description of the issue
- `rules[].severity` - One of: ERROR, WARNING, INFO
- `rules[].languages` - Target languages

### Gitleaks Config (TOML)

Gitleaks configs define secret detection patterns:

```toml
title = "Custom Secret Detection Rules"

[[rules]]
id = "custom-api-key"
description = "Custom API Key Pattern"
regex = '''(?i)custom[_-]?api[_-]?key["\s]*[:=]["\s]*([a-z0-9]{32})'''
tags = ["api", "custom"]
entropy = 3.5

[[rules]]
id = "internal-token"
description = "Internal Service Token"
regex = '''INTERNAL_TOKEN_[A-Z0-9]{16}'''
tags = ["internal", "token"]
```

**Required Fields:**
- `[[rules]]` - Array of rule definitions
- `rules[].id` - Rule identifier
- `rules[].regex` - Detection regex pattern

## Template Management

### Manual Upload

Upload templates directly via the API:

```bash
# Upload Nuclei template
curl -X POST /api/v1/scanner-templates \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "custom-sqli-check",
    "template_type": "nuclei",
    "description": "Custom SQL injection detection",
    "tags": ["sqli", "owasp", "web"],
    "content": "id: custom-sqli-check\ninfo:\n  name: Custom SQL Injection\n  severity: high\nrequests:\n  - method: GET\n    path:\n      - \"{{BaseURL}}/search?q={{payload}}\"\n    matchers:\n      - type: word\n        words:\n          - \"SQL syntax\""
  }'
```

### Template Validation

Validate templates before upload:

```bash
curl -X POST /api/v1/scanner-templates/validate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template_type": "nuclei",
    "content": "id: test\ninfo:\n  name: Test\n  severity: high"
  }'

# Response
{
  "valid": false,
  "errors": [
    {
      "field": "requests",
      "message": "Missing required field 'requests' or 'workflows'",
      "code": "MISSING_FIELD"
    }
  ]
}
```

### List Templates

```bash
# List all templates
curl /api/v1/scanner-templates \
  -H "Authorization: Bearer $TOKEN"

# Filter by type
curl "/api/v1/scanner-templates?template_type=nuclei&status=active" \
  -H "Authorization: Bearer $TOKEN"

# Response
{
  "items": [
    {
      "id": "tpl-abc123",
      "name": "custom-sqli-check",
      "template_type": "nuclei",
      "version": "1.0.0",
      "status": "active",
      "rule_count": 1,
      "tags": ["sqli", "owasp"],
      "created_at": "2026-01-27T10:00:00Z"
    }
  ],
  "total": 1
}
```

### Download Template

```bash
curl /api/v1/scanner-templates/tpl-abc123/download \
  -H "Authorization: Bearer $TOKEN" \
  -o custom-sqli-check.yaml
```

### Deprecate Template

```bash
curl -X POST /api/v1/scanner-templates/tpl-abc123/deprecate \
  -H "Authorization: Bearer $TOKEN"
```

## Template Sources

Templates can be automatically synced from external sources. See [Template Sources](template-sources.md) for details on:
- Git repositories
- S3/MinIO buckets
- HTTP URLs

## Using Templates in Scans

### In Scan Profiles

Templates are linked to scan profiles via the tools configuration:

```json
{
  "name": "Custom Security Scan",
  "tools_config": {
    "nuclei": {
      "enabled": true,
      "template_mode": "custom",
      "custom_template_ids": ["tpl-abc123", "tpl-def456"]
    },
    "semgrep": {
      "enabled": true,
      "template_mode": "both",
      "custom_template_ids": ["tpl-ghi789"]
    }
  }
}
```

### Template Modes

| Mode | Description |
|------|-------------|
| `default` | Use only built-in/official templates |
| `custom` | Use only tenant-uploaded custom templates |
| `both` | Run both default and custom templates |

### In CLI/SDK

```go
// Using the SDK
opts := &core.ScanOptions{
    TargetDir:         "/path/to/code",
    CustomTemplateDir: "/path/to/custom-templates",
}
result, err := scanner.Scan(ctx, target, opts)
```

## Template Delivery Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Template Delivery Flow                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. SCAN TRIGGERED                                                  │
│     └── Platform receives scan request with profile                 │
│                                                                      │
│  2. TEMPLATE RESOLUTION                                             │
│     ├── Get custom_template_ids from scan profile                   │
│     ├── Lazy sync: Check sources for updates (if cache expired)     │
│     └── Fetch template content from database                        │
│                                                                      │
│  3. COMMAND PAYLOAD                                                 │
│     └── Embed templates in scan command:                            │
│         {                                                           │
│           "scanner": "nuclei",                                      │
│           "custom_templates": [                                     │
│             {                                                       │
│               "id": "tpl-123",                                     │
│               "name": "custom-sqli.yaml",                          │
│               "template_type": "nuclei",                           │
│               "content": "...",                                    │
│               "content_hash": "sha256:..."                         │
│             }                                                       │
│           ]                                                         │
│         }                                                           │
│                                                                      │
│  4. AGENT EXECUTION                                                 │
│     ├── Write templates to temp directory                           │
│     ├── Verify content hash (SHA256)                                │
│     ├── Pass directory to scanner (-t for nuclei)                   │
│     └── Clean up temp directory after scan                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Security

### Content Verification

- **SHA256 Hash**: Each template includes a content hash verified before use
- **HMAC Signature**: Templates are signed with tenant-specific secret
- **Validation**: Scanner-specific validators check template syntax and structure

### Tenant Isolation

- Templates are scoped to tenants via `tenant_id`
- Unique constraint: `(tenant_id, template_type, name)`
- Cross-tenant access is prevented at the repository level

### Dangerous Pattern Detection

Validators check for potentially dangerous patterns:
- Nuclei: Code injection in requests
- Semgrep: Overly permissive patterns
- Gitleaks: Invalid regex that could cause ReDoS

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/scanner-templates` | Create template |
| `GET` | `/api/v1/scanner-templates` | List templates |
| `GET` | `/api/v1/scanner-templates/{id}` | Get template |
| `PUT` | `/api/v1/scanner-templates/{id}` | Update template |
| `DELETE` | `/api/v1/scanner-templates/{id}` | Delete template |
| `POST` | `/api/v1/scanner-templates/validate` | Validate content |
| `GET` | `/api/v1/scanner-templates/{id}/download` | Download file |
| `POST` | `/api/v1/scanner-templates/{id}/deprecate` | Deprecate template |

## Permissions

| Action | Admin | Member | Viewer |
|--------|-------|--------|--------|
| View templates | Yes | Yes | Yes |
| Create templates | Yes | Yes | No |
| Update own templates | Yes | Yes | No |
| Delete templates | Yes | No | No |
| Manage sources | Yes | No | No |

Permission IDs:
- `scans:templates:read` - View templates
- `scans:templates:write` - Create/update templates
- `scans:templates:delete` - Delete templates

## Best Practices

1. **Version Control**: Store templates in Git and use Template Sources for sync
2. **Naming Convention**: Use descriptive names like `company-sqli-api-v2`
3. **Tags**: Use tags for organization (`owasp`, `pci`, `custom`, `api`)
4. **Testing**: Validate templates against known-vulnerable test targets
5. **Documentation**: Include clear descriptions and references in template metadata
6. **Review Process**: Implement review before enabling in production profiles
{% endraw %}
