---
layout: default
title: Coding Conventions
parent: Guides
nav_order: 10
---

# Coding Conventions

This document defines coding standards and conventions for the OpenCTEM CTEM Platform codebase.

---

## Table of Contents

- [Go Conventions](#go-conventions)
  - [Package Naming](#package-naming)
  - [File Naming](#file-naming)
  - [Type Naming](#type-naming)
  - [Function & Method Naming](#function--method-naming)
  - [Variable Naming](#variable-naming)
- [Project Structure](#project-structure)
- [Error Handling](#error-handling)
- [Testing Conventions](#testing-conventions)
- [API Design](#api-design)
- [Database Conventions](#database-conventions)

---

## Go Conventions

### Package Naming

**Convention:** Follow standard Go naming - lowercase without underscores.

```
internal/domain/scannertemplate/   # ✅ Standard Go
internal/domain/templatesource/    # ✅ Standard Go
internal/domain/shared/            # ✅ Single word
internal/domain/template/          # ❌ Too generic
internal/domain/scanner_template/  # ❌ Avoid underscores
```

**Rationale:**
- Standard Go: Follows official Go guidelines for package naming
- Tooling: Better compatibility with Go tools and IDE autocomplete
- Consistency: Matches Go standard library conventions

**Rules:**
1. Package name should match directory name
2. Use lowercase letters only, no underscores
3. Keep package names short but descriptive
4. Avoid generic names like `util`, `common`, `helper`

```go
// Good
package scannertemplate
package scanprofile
package templatesource

// Bad
package scannerTemplate  // No camelCase
package Scanner_Template // No PascalCase
package scanner_template // No underscores
package st               // Too short, unclear
```

### File Naming

**Convention:** Use `snake_case` for file names.

```
entity.go           # Main domain entity
repository.go       # Repository interface
service.go          # Service implementation (in app/)
handler.go          # HTTP handler
*_test.go           # Test files
```

**Examples:**
```
internal/domain/scanner_template/
├── entity.go           # ScannerTemplate struct
├── repository.go       # Repository interface
├── validator.go        # Validation logic
└── signing.go          # Template signing

internal/app/
├── scanner_template_service.go
├── template_source_service.go
└── scan_profile_service.go

internal/infra/http/handler/
├── scanner_template_handler.go
├── template_source_handler.go
└── scan_profile_handler.go
```

### Type Naming

**Convention:** Use `PascalCase` for exported types, `camelCase` for unexported.

```go
// Exported types (public API)
type ScannerTemplate struct { ... }
type TemplateType string
type Repository interface { ... }

// Unexported types (internal)
type templateValidator struct { ... }
type configCache struct { ... }
```

**Naming patterns:**

| Type | Pattern | Example |
|------|---------|---------|
| Domain Entity | Noun | `ScannerTemplate`, `TemplateSource` |
| Repository | `Repository` suffix | `Repository`, `SourceRepository` |
| Service | `Service` suffix | `ScannerTemplateService` |
| Handler | `Handler` suffix | `ScannerTemplateHandler` |
| Input DTO | `*Input` suffix | `CreateScannerTemplateInput` |
| Output DTO | `*Output` suffix | `ListOutput` |
| Request | `*Request` suffix | `CreateTemplateSourceRequest` |
| Response | `*Response` suffix | `TemplateSourceResponse` |

**Avoiding name conflicts:**
When types with similar names exist in different packages, prefix with domain context:

```go
// In app/scanner_template_service.go
type CreateScannerTemplateInput struct { ... }  // ✅ Prefixed
type CreateTemplateInput struct { ... }         // ❌ May conflict

// In app/template_source_service.go
type CreateTemplateSourceInput struct { ... }   // ✅ Prefixed
```

### Function & Method Naming

**Convention:** Use `PascalCase` for exported, `camelCase` for unexported.

```go
// Exported (public API)
func NewScannerTemplateService(...) *ScannerTemplateService
func (s *ScannerTemplateService) CreateTemplate(...) error
func (s *ScannerTemplateService) ListTemplates(...) ([]Template, error)

// Unexported (internal)
func (s *ScannerTemplateService) validateContent(...) error
func buildWhereClause(...) string
```

**Common prefixes:**

| Prefix | Usage | Example |
|--------|-------|---------|
| `New` | Constructor | `NewScannerTemplateService` |
| `Get` | Single retrieval | `GetByID`, `GetByTenantAndName` |
| `List` | Multiple retrieval | `ListTemplates`, `ListByTenant` |
| `Create` | Creation | `CreateTemplate` |
| `Update` | Modification | `UpdateTemplate` |
| `Delete` | Removal | `DeleteTemplate` |
| `Is/Has/Can` | Boolean check | `IsValid`, `HasPermission`, `CanManage` |
| `To` | Conversion | `ToResponse`, `ToString` |

### Variable Naming

**Convention:** Use `camelCase`, short but descriptive.

```go
// Good
template := &ScannerTemplate{}
tenantID := shared.NewID()
ctx := context.Background()

// Bad
t := &ScannerTemplate{}      // Too short for non-obvious types
scanner_template := ...       // No snake_case
TenantID := ...              // No PascalCase for variables
```

**Common abbreviations:**

| Abbreviation | Full Name | Usage |
|--------------|-----------|-------|
| `ctx` | context | Always for context.Context |
| `err` | error | Always for error returns |
| `id` | identifier | For IDs |
| `tx` | transaction | For database transactions |
| `req` | request | For HTTP requests |
| `resp` | response | For HTTP responses |
| `cfg` | config | For configuration |
| `log` | logger | For logger instances |

---

## Project Structure

```
api/
├── cmd/server/           # Application entry points
│   ├── main.go
│   ├── handlers.go       # Handler initialization
│   ├── services.go       # Service initialization
│   └── repositories.go   # Repository initialization
│
├── internal/
│   ├── domain/           # Domain entities (DDD)
│   │   ├── scanner_template/
│   │   │   ├── entity.go
│   │   │   ├── repository.go
│   │   │   └── validator.go
│   │   ├── template_source/
│   │   └── shared/       # Shared domain types
│   │
│   ├── app/              # Application services
│   │   ├── scanner_template_service.go
│   │   └── template_source_service.go
│   │
│   └── infra/            # Infrastructure implementations
│       ├── postgres/     # PostgreSQL repositories
│       ├── redis/        # Redis cache
│       └── http/         # HTTP layer
│           ├── handler/  # HTTP handlers
│           ├── routes/   # Route registration
│           └── middleware/
│
├── pkg/                  # Reusable packages
│   ├── pagination/
│   ├── validator/
│   └── logger/
│
└── migrations/           # Database migrations
```

---

## Error Handling

### Domain Errors

Use structured domain errors with codes:

```go
// Define in domain/shared/errors.go
var (
    ErrNotFound      = errors.New("not found")
    ErrAlreadyExists = errors.New("already exists")
    ErrValidation    = errors.New("validation error")
    ErrForbidden     = errors.New("forbidden")
)

// Create domain errors with context
func NewDomainError(code, message string, cause error) error {
    return &DomainError{
        Code:    code,
        Message: message,
        Cause:   cause,
    }
}

// Usage
return shared.NewDomainError("VALIDATION", "name is required", shared.ErrValidation)
```

### Error Wrapping

Always wrap errors with context:

```go
// Good
if err != nil {
    return fmt.Errorf("failed to create template: %w", err)
}

// Bad
if err != nil {
    return err  // No context
}
```

---

## Testing Conventions

### File Naming

```
entity_test.go          # Unit tests for entity.go
service_test.go         # Unit tests for service
integration_test.go     # Integration tests (with build tag)
```

### Test Naming

```go
func TestScannerTemplate_Validate(t *testing.T) { ... }
func TestScannerTemplate_Validate_EmptyName(t *testing.T) { ... }
func TestScannerTemplateService_Create(t *testing.T) { ... }
```

### Table-Driven Tests

```go
func TestTemplateType_IsValid(t *testing.T) {
    tests := []struct {
        name     string
        input    TemplateType
        expected bool
    }{
        {"valid nuclei", TemplateTypeNuclei, true},
        {"valid semgrep", TemplateTypeSemgrep, true},
        {"invalid", TemplateType("invalid"), false},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := tt.input.IsValid()
            assert.Equal(t, tt.expected, result)
        })
    }
}
```

---

## API Design

### URL Conventions

```
GET    /api/v1/scanner-templates          # List
GET    /api/v1/scanner-templates/{id}     # Get by ID
POST   /api/v1/scanner-templates          # Create
PUT    /api/v1/scanner-templates/{id}     # Update
DELETE /api/v1/scanner-templates/{id}     # Delete

# Actions as sub-resources
POST   /api/v1/scanner-templates/{id}/deprecate
POST   /api/v1/template-sources/{id}/enable
POST   /api/v1/template-sources/{id}/disable
```

### Response Format

```json
{
    "id": "uuid",
    "name": "...",
    "created_at": "2024-01-27T10:00:00Z",
    "updated_at": "2024-01-27T10:00:00Z"
}
```

### Pagination

```json
{
    "items": [...],
    "total_count": 100,
    "page": 1,
    "page_size": 20
}
```

---

## Database Conventions

### Table Naming

```sql
-- Use snake_case, plural
CREATE TABLE scanner_templates ( ... );
CREATE TABLE template_sources ( ... );
CREATE TABLE scan_profile_template_sources ( ... );  -- Junction table
```

### Column Naming

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
tenant_id UUID NOT NULL REFERENCES tenants(id),
name VARCHAR(255) NOT NULL,
template_type VARCHAR(20) NOT NULL,
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
```

### Index Naming

```sql
-- Pattern: idx_{table}_{column(s)}
CREATE INDEX idx_scanner_templates_tenant ON scanner_templates(tenant_id);
CREATE INDEX idx_scanner_templates_type ON scanner_templates(template_type);

-- For partial indexes, add condition hint
CREATE INDEX idx_template_sources_enabled ON template_sources(enabled)
    WHERE enabled = true;
```

### Migration Naming

```
000100_scanner_templates.up.sql
000100_scanner_templates.down.sql
000101_template_sources.up.sql
000101_template_sources.down.sql
```

---

## Summary

| Element | Convention | Example |
|---------|------------|---------|
| Package | lowercase, no underscores | `scannertemplate` |
| File | snake_case | `scanner_template_service.go` |
| Type (exported) | PascalCase | `ScannerTemplate` |
| Type (unexported) | camelCase | `templateCache` |
| Function (exported) | PascalCase | `CreateTemplate` |
| Function (unexported) | camelCase | `validateContent` |
| Variable | camelCase | `tenantID` |
| Constant | PascalCase or ALL_CAPS | `MaxTemplateSize` |
| Table | snake_case, plural | `scanner_templates` |
| Column | snake_case | `tenant_id` |
| API URL | kebab-case | `/scanner-templates` |

---

**Last Updated:** 2026-01-27
**Version:** 1.1
