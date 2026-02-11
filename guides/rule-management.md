---
layout: default
title: Rule Management
parent: Platform Guides
nav_order: 7
---
{% raw %}

# Rule Management

Learn how to manage custom security rules and templates for your scanning tools.

---

## Overview

OpenCTEM supports custom rules and templates for security scanning tools like Semgrep, Nuclei, and others. This allows you to:

- Add organization-specific security rules
- Customize existing rules for your codebase
- Disable false positive rules
- Override rule severity based on context
- Sync rules from Git repositories automatically

**Architecture:**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Git Repos     │     │   HTTP URLs     │     │  Local Files    │
│  (custom rules) │     │  (rule packs)   │     │   (testing)     │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │     Rule Sources       │
                    │  (sync & parse rules)  │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │    Rules Database      │
                    │  (metadata, content)   │
                    └───────────┬────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
          ┌──────────────────┐    ┌──────────────────┐
          │  Rule Overrides  │    │  Rule Bundles    │
          │ (enable/disable) │    │ (compiled packs) │
          └──────────────────┘    └────────┬─────────┘
                                           │
                                           ▼
                                ┌────────────────────┐
                                │   Object Storage   │
                                │  (S3/MinIO bundles)│
                                └────────────────────┘
```

---

## Rule Sources

Rule sources define where to fetch security rules from.

### Source Types

| Type | Description | Use Case |
|------|-------------|----------|
| `git` | Git repository | Version-controlled team rules |
| `http` | HTTP/HTTPS URL | Public rule packs, vendor rules |
| `local` | Local filesystem | Development and testing |

### Creating a Git Source

```bash
curl -X POST https://api.openctem.io/api/v1/rules/sources \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Custom Semgrep Rules",
    "description": "Organization security rules for Semgrep",
    "tool_id": "semgrep-tool-id",
    "source_type": "git",
    "config": {
      "url": "https://github.com/org/security-rules.git",
      "branch": "main",
      "path": "semgrep/",
      "auth_type": "token"
    },
    "credentials_id": "credential-id-for-git",
    "sync_enabled": true,
    "sync_interval_minutes": 60,
    "priority": 100
  }'
```

### Source Configuration

**Git Source Config:**
```json
{
  "url": "https://github.com/org/rules.git",
  "branch": "main",
  "path": "rules/",
  "auth_type": "token|ssh|none"
}
```

**HTTP Source Config:**
```json
{
  "url": "https://example.com/rules.tar.gz",
  "headers": {
    "Authorization": "Bearer xyz"
  }
}
```

### Priority System

Sources are merged based on priority (higher = precedence):

| Priority Range | Description |
|----------------|-------------|
| 0-99 | Platform default rules |
| 100-499 | Team-wide custom rules |
| 500-899 | Project-specific rules |
| 900-1000 | Override rules (highest priority) |

When the same rule ID exists in multiple sources, the higher priority source wins.

---

## Rule Syncing

### Automatic Sync

When `sync_enabled: true`, sources sync automatically based on `sync_interval_minutes`.

**Sync Process:**
1. Fetch content from source (git clone, HTTP download)
2. Calculate content hash for change detection
3. Parse YAML files to extract rule metadata
4. Store rules in database
5. Update sync history

### Manual Sync

Trigger immediate sync:

```bash
curl -X POST https://api.openctem.io/api/v1/rules/sources/{sourceId}/sync \
  -H "Authorization: Bearer $TOKEN"
```

### Sync History

View sync history for troubleshooting:

```bash
curl https://api.openctem.io/api/v1/rules/sources/{sourceId}/sync-history?limit=10 \
  -H "Authorization: Bearer $TOKEN"
```

Response:
```json
{
  "items": [
    {
      "id": "sync-id",
      "status": "success",
      "rules_added": 15,
      "rules_updated": 3,
      "rules_removed": 0,
      "duration_ms": 2450,
      "previous_hash": "sha256:abc...",
      "new_hash": "sha256:def...",
      "created_at": "2025-01-19T10:30:00Z"
    }
  ]
}
```

---

## Rule Overrides

Override rules to customize behavior for your environment.

### Override Types

**Exact Match:**
Targets a specific rule by ID.

```json
{
  "rule_pattern": "python.security.sql-injection",
  "is_pattern": false,
  "enabled": false,
  "reason": "Known false positive for our ORM usage"
}
```

**Pattern Match:**
Targets multiple rules using glob patterns.

```json
{
  "rule_pattern": "security/aws-*",
  "is_pattern": true,
  "enabled": true,
  "severity_override": "critical",
  "reason": "All AWS rules should be critical in production"
}
```

### Scoped Overrides

Overrides can be scoped to specific contexts:

| Scope | Description |
|-------|-------------|
| Global (tenant) | Applies to all scans |
| `asset_group_id` | Applies to specific asset groups |
| `scan_profile_id` | Applies to specific scan profiles |

### Expiring Overrides

Set an expiration date for temporary overrides:

```json
{
  "rule_pattern": "performance/*",
  "is_pattern": true,
  "enabled": false,
  "reason": "Temporarily disable during migration",
  "expires_at": "2025-03-01T00:00:00Z"
}
```

Expired overrides are automatically cleaned up.

---

## Rule Bundles

Bundles are pre-compiled rule packages for efficient worker download.

### Bundle Workflow

```
┌─────────────────┐
│  Source Sync    │  Rules updated in database
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Bundle Build   │  Merge rules from all sources
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Apply Overrides │  Enable/disable, severity changes
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Archive  │  tar.gz with manifest.json
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Upload to S3   │  Workers download from here
└─────────────────┘
```

### Bundle Contents

```
bundle.tar.gz
├── manifest.json       # Bundle metadata
├── rules/
│   ├── source1/       # Rules from source 1
│   │   ├── rule1.yaml
│   │   └── rule2.yaml
│   └── source2/       # Rules from source 2
│       └── rule3.yaml
└── config.yaml        # Merged tool configuration
```

**manifest.json:**
```json
{
  "version": "v1.2.3",
  "content_hash": "sha256:abc123...",
  "rule_count": 450,
  "sources": ["source-id-1", "source-id-2"],
  "created_at": "2025-01-19T10:30:00Z",
  "tool": "semgrep"
}
```

### Getting Latest Bundle

Workers fetch the latest bundle before scanning:

```bash
curl https://api.openctem.io/api/v1/rules/bundles/latest?tool_id={toolId} \
  -H "Authorization: Bearer $WORKER_TOKEN"
```

---

## Writing Custom Rules

### Semgrep Rules

```yaml
rules:
  - id: custom-sql-injection
    pattern: |
      execute($SQL)
    message: "Potential SQL injection vulnerability"
    severity: ERROR
    languages:
      - python
    metadata:
      category: security
      subcategory: injection
      cwe:
        - "CWE-89"
      owasp:
        - "A03:2021"
```

### Nuclei Templates

```yaml
id: custom-api-check
info:
  name: Custom API Security Check
  author: security-team
  severity: high
  tags: api,security

http:
  - method: GET
    path:
      - "{{BaseURL}}/api/debug"
    matchers:
      - type: status
        status:
          - 200
```

### Rule Metadata

Include metadata for better organization:

| Field | Description |
|-------|-------------|
| `category` | High-level category (security, performance) |
| `subcategory` | Specific type (injection, xss) |
| `cwe` | CWE IDs for vulnerability mapping |
| `owasp` | OWASP Top 10 mapping |
| `references` | Links to documentation |

---

## Best Practices

### Repository Structure

```
security-rules/
├── semgrep/
│   ├── security/
│   │   ├── injection.yaml
│   │   └── auth.yaml
│   └── quality/
│       └── logging.yaml
├── nuclei/
│   └── templates/
│       └── api-checks.yaml
└── README.md
```

### Versioning

- Use Git tags for rule versions
- Test rules before merging to main
- Use feature branches for experimental rules

### Testing Rules

Test rules locally before deploying:

```bash
# Semgrep
semgrep --config ./rules/security.yaml ./src

# Nuclei
nuclei -t ./templates/api-check.yaml -u https://target.com
```

### Review Process

1. Create rules in feature branch
2. Test against sample codebase
3. Review for false positives
4. Merge to main
5. Automatic sync to OpenCTEM

---

## Troubleshooting

### Sync Failures

Check sync history for error details:

```bash
curl https://api.openctem.io/api/v1/rules/sources/{sourceId}/sync-history \
  -H "Authorization: Bearer $TOKEN"
```

Common issues:
- Invalid credentials
- Repository not accessible
- Invalid YAML syntax
- Missing required fields

### Rules Not Applied

1. Check source is enabled
2. Verify source priority
3. Check for conflicting overrides
4. Trigger bundle rebuild

### Bundle Build Failures

View bundle details for build errors:

```bash
curl https://api.openctem.io/api/v1/rules/bundles/{bundleId} \
  -H "Authorization: Bearer $TOKEN"
```

---

## Next Steps

- [Scan Management](scan-management.md) - Configure scans with custom rules
- [Custom Tools Development](custom-tools-development.md) - Build custom scanners
- [SDK Development](sdk-development.md) - Advanced SDK usage
{% endraw %}
