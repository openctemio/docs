---
layout: default
title: Finding Sources
parent: Features
nav_order: 12
---

# Finding Sources

Finding sources categorize the origin of security findings, enabling filtering, reporting, and workflow automation based on how findings were discovered.

{: .important }
> **Not to be confused with [Tool Capabilities](capabilities-registry.md)**
>
> - **Finding Sources** = Where a **finding** came from (1:1 with findings)
> - **Capabilities** = What a **tool** can do (M:N with tools)
>
> See [ADR-001: Finding Sources vs Tool Capabilities](../decisions/001-finding-sources-vs-capabilities.md) for details.

---

## Overview

Finding sources represent the **type of security tool or assessment** that discovered a finding. Examples include:

- **SAST** - Static Application Security Testing
- **DAST** - Dynamic Application Security Testing
- **Pentest** - Penetration Testing
- **Bug Bounty** - Bug Bounty Programs

Sources are organized into **categories** for easier navigation in the UI.

---

## Architecture

Finding sources are managed in **two layers**:

### 1. Database Layer (Dynamic Configuration)

The `finding_sources` and `finding_source_categories` tables store:

- Display metadata (name, description, icon, color)
- Category relationships
- Active/inactive status
- Display ordering

This allows UI customization without code changes.

### 2. Code Layer (Type Safety)

Go constants in `vulnerability/value_objects.go` provide:

- Compile-time type safety
- IDE autocomplete
- Switch statement support

The constants must match the `code` field in the database.

---

## Categories

| Category | Code | Description |
|----------|------|-------------|
| Application Security | `appsec` | Automated scanning tools (SAST, DAST, SCA, etc.) |
| Cloud & Infrastructure | `cloud_infra` | Cloud security posture and infrastructure |
| Runtime & Production | `runtime` | Runtime protection and monitoring |
| Manual Assessment | `manual` | Human-driven assessments |
| External Sources | `external` | Third-party and threat intelligence |

---

## Sources

### Application Security

| Code | Name | Description |
|------|------|-------------|
| `sast` | SAST | Static Application Security Testing (Semgrep, CodeQL) |
| `dast` | DAST | Dynamic Application Security Testing (ZAP, Nuclei) |
| `sca` | SCA | Software Composition Analysis (Trivy, Snyk) |
| `secret` | Secret Scanning | Exposed credentials detection (Gitleaks) |
| `iac` | IaC Scanning | Infrastructure as Code (Checkov, Tfsec) |
| `container` | Container Scanning | Container image vulnerabilities |

### Cloud & Infrastructure

| Code | Name | Description |
|------|------|-------------|
| `cspm` | CSPM | Cloud Security Posture Management |
| `easm` | EASM | External Attack Surface Management |

### Runtime & Production

| Code | Name | Description |
|------|------|-------------|
| `rasp` | RASP | Runtime Application Self-Protection |
| `waf` | WAF | Web Application Firewall |
| `siem` | SIEM | Security Information and Event Management |

### Manual Assessment

| Code | Name | Description |
|------|------|-------------|
| `manual` | Manual | Manually created findings |
| `pentest` | Penetration Test | Penetration testing engagements |
| `bug_bounty` | Bug Bounty | Bug bounty program submissions |
| `red_team` | Red Team | Red team exercise findings |

### External Sources

| Code | Name | Description |
|------|------|-------------|
| `external` | External | Imported from external tools |
| `threat_intel` | Threat Intelligence | Threat intelligence feeds |
| `vendor` | Vendor Advisory | Software vendor security advisories |

---

## API Endpoints

### List Finding Sources

```http
GET /api/v1/config/finding-sources?active_only=true&include_category=true
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `active_only` | boolean | Return only active sources (recommended for UI dropdowns) |
| `include_category` | boolean | Include category details in response |
| `category_code` | string | Filter by category code |
| `search` | string | Search by name or code |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "code": "sast",
      "name": "SAST",
      "description": "Static Application Security Testing",
      "category": {
        "code": "appsec",
        "name": "Application Security"
      },
      "icon": "Code",
      "display_order": 1,
      "is_system": true,
      "is_active": true
    }
  ],
  "total": 18
}
```

### List Categories

```http
GET /api/v1/config/finding-sources/categories?active_only=true
```

### Get Source by Code

```http
GET /api/v1/config/finding-sources/code/{code}
```

---

## Caching

Finding sources are **aggressively cached** because they rarely change:

### Backend (Redis)

- **TTL:** 24 hours
- **Key:** `finding_sources:all`
- **Scope:** Global (not per-tenant)
- **Invalidation:** Manual via `FindingSourceCacheService.InvalidateAll()`

### Frontend (SWR)

- **Dedupe interval:** 60 seconds
- **Revalidate on focus:** Disabled
- **Revalidate on reconnect:** Disabled

### HTTP Headers

```
Cache-Control: public, max-age=3600
```

---

## Usage in Code

### Go (Backend)

```go
import "github.com/openctemio/api/internal/domain/vulnerability"

// Use constants for type safety
finding.SetSource(vulnerability.FindingSourceSAST)

// Validate user input dynamically
valid, err := cacheService.IsValidCode(ctx, userInput)
```

### TypeScript (Frontend)

```typescript
import { useFindingSourcesApi, groupFindingSourcesByCategory } from '@/features/config/api'

// Fetch sources for dropdown
const { data } = useFindingSourcesApi()

// Group by category for UI
const groups = groupFindingSourcesByCategory(data.data)
```

---

## Adding New Sources

1. **Add database migration:**

```sql
INSERT INTO finding_sources (code, name, description, category_id, icon, display_order, is_system)
SELECT 'new_source', 'New Source', 'Description', c.id, 'Icon', 7, true
FROM finding_source_categories c WHERE c.code = 'appsec';
```

2. **Add Go constant:**

```go
// In vulnerability/value_objects.go
FindingSourceNewSource FindingSource = "new_source"
```

3. **Update validation:**

Update `IsValid()` and `AllFindingSources()` in `value_objects.go`.

4. **Invalidate cache:**

```go
cacheService.InvalidateAll(ctx)
```

---

## Database Schema

### finding_source_categories

```sql
CREATE TABLE finding_source_categories (
    id UUID PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

### finding_sources

```sql
CREATE TABLE finding_sources (
    id UUID PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES finding_source_categories(id),
    icon VARCHAR(50),
    color VARCHAR(20),
    display_order INT DEFAULT 0,
    is_system BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

---

## Related Documentation

- [Finding Types](finding-types.md) - Polymorphic finding architecture
- [Finding Lifecycle](finding-lifecycle.md) - Status transitions and auto-resolve
- [Capabilities Registry](capabilities-registry.md) - Tool capability management
