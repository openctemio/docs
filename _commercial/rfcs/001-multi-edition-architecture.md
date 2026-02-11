# RFC-001: Multi-Edition Architecture

**Status:** Draft
**Author:** Engineering Team
**Created:** 2026-02-03
**Last Updated:** 2026-02-03

---

## 0. Repository Naming & Structure

### Quyết định: Phương án B - Multi-Repo với 2 Organizations

**Lý do chọn Phương án B:**
- URL ngắn gọn, professional
- Tách biệt rõ ràng OSS vs Commercial
- Community-friendly cho OSS
- Pattern phổ biến (HashiCorp, Grafana)

### Repository Structure

#### OSS Repositories (org: `openctemio`)

| Repository | Mô tả | License | Go Module |
|------------|-------|---------|-----------|
| `openctemio/api` | Backend API service | Apache 2.0 | `github.com/openctemio/api` |
| `openctemio/ui` | Frontend application | Apache 2.0 | - |
| `openctemio/agent` | Agent service | Apache 2.0 | `github.com/openctemio/agent` |
| `openctemio/docs` | Documentation site | Apache 2.0 | - |
| `openctemio/sdk` | SDK for integrations | Apache 2.0 | `github.com/openctemio/sdk-go` |
| `openctemio/.github` | Shared workflows | Apache 2.0 | - |

#### Enterprise Repositories (org: `exploop`)

| Repository | Mô tả | License | Go Module |
|------------|-------|---------|-----------|
| `exploop/api` | Enterprise API extensions | Proprietary | `github.com/exploop/api` |
| `exploop/ui` | Enterprise UI features | Proprietary | - |
| `exploop/cloud` | SaaS infrastructure | Proprietary | `github.com/exploop/cloud` |
| `exploop/.github` | Shared workflows | - | - |

### Go Module Import Strategy

```go
// OSS API
module github.com/openctemio/api

// OSS Agent
module github.com/openctemio/agent

require github.com/openctemio/api v1.0.0

// Enterprise API (imports OSS)
module github.com/exploop/api

require (
    github.com/openctemio/api v1.0.0
    github.com/openctemio/agent v1.0.0
)

// SaaS Cloud (imports OSS + Enterprise)
module github.com/exploop/cloud

require (
    github.com/openctemio/api v1.0.0
    github.com/openctemio/agent v1.0.0
    github.com/exploop/api v1.0.0
)
```

### Local Development Setup

```go
// exploop/api/go.mod (local development)
replace (
    github.com/openctemio/api => ../../../openctemio/api
    github.com/openctemio/agent => ../../../openctemio/agent
)
```

### Workspace Structure

```
~/projects/
├── openctemio/               # OSS workspace
│   ├── api/                # github.com/openctemio/api
│   ├── ui/                 # github.com/openctemio/ui
│   ├── agent/              # github.com/openctemio/agent
│   ├── docs/               # github.com/openctemio/docs
│   └── sdk/                # github.com/openctemio/sdk-go
└── exploop/                # Enterprise workspace
    ├── api/                # github.com/exploop/api (imports openctemio/*)
    ├── ui/                 # github.com/exploop/ui
    └── cloud/              # github.com/exploop/cloud
```

### Ưu điểm của Phương án B

| # | Ưu điểm | Giải thích |
|---|---------|------------|
| 1 | **URL ngắn gọn** | `openctemio/api` thay vì `openctemio/openctemio-api` |
| 2 | **Brand separation** | OSS = openctemio, Commercial = exploop |
| 3 | **Community-friendly** | Org riêng cho OSS, dễ contribute |
| 4 | **License rõ ràng** | Org nào license đó |
| 5 | **Flexibility** | Mỗi component có thể versioned độc lập |

### Nhược điểm & Giải pháp

| # | Nhược điểm | Giải pháp |
|---|------------|-----------|
| 1 | **Cross-org import** | Dùng Go modules với semantic versioning |
| 2 | **Version sync** | Release automation, compatibility matrix |
| 3 | **Local dev phức tạp** | Go workspace / replace directive |
| 4 | **2 orgs quản lý** | Cùng team admin |
| 5 | **CI/CD phân tán** | Shared workflows, reusable GitHub Actions |

### npm Package Naming (Frontend)

```json
// openctemio/ui/package.json
{
  "name": "@openctemio/ui",
  "version": "1.0.0"
}

// openctemio/sdk (nếu có JS SDK)
{
  "name": "@openctemio/sdk",
  "version": "1.0.0"
}

// exploop/ui/package.json
{
  "name": "@exploop/ui",
  "dependencies": {
    "@openctemio/ui": "^1.0.0"
  }
}
```

---

### 0.1 Architecture Patterns: Clean Architecture + Domain-Driven Design (DDD)

Project tuân theo **Clean Architecture** kết hợp **Domain-Driven Design (DDD)** để đảm bảo code maintainable, testable và dễ mở rộng.

#### Layered Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                           │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ HTTP Handlers (chi router) │ GraphQL │ gRPC │ WebSocket         ││
│  │ pkg/handler/               │         │      │                   ││
│  └─────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────┤
│                         APPLICATION LAYER                            │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ Service Interfaces │ Use Cases │ DTOs │ Application Services    ││
│  │ pkg/app/           │           │      │                         ││
│  └─────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────┤
│                          DOMAIN LAYER                                │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ Entities │ Value Objects │ Aggregates │ Domain Services         ││
│  │ Domain Events │ Repository Interfaces                           ││
│  │ pkg/domain/                                                     ││
│  └─────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────┤
│                       INFRASTRUCTURE LAYER                           │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ PostgreSQL │ Redis │ S3 │ External APIs │ Message Queues        ││
│  │ Repository Implementations │ External Service Adapters          ││
│  │ internal/infrastructure/                                        ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

#### Directory Structure (Clean Architecture)

```
openctemio/api/
├── cmd/
│   └── server/
│       └── main.go              # Entry point, DI composition
├── pkg/                         # Public packages (importable)
│   ├── app/                     # Application Layer - Service interfaces
│   │   ├── asset_service.go     # Interface: AssetService
│   │   ├── finding_service.go   # Interface: FindingService
│   │   └── services.go          # All service interfaces
│   │
│   ├── domain/                  # Domain Layer - Business logic
│   │   ├── asset/
│   │   │   ├── entity.go        # Asset entity (aggregate root)
│   │   │   ├── value_objects.go # AssetID, Criticality, etc.
│   │   │   ├── repository.go    # Repository interface
│   │   │   ├── service.go       # Domain service implementation
│   │   │   └── events.go        # Domain events
│   │   ├── finding/
│   │   ├── scan/
│   │   └── shared/              # Shared kernel (value objects, errors)
│   │
│   ├── handler/                 # Presentation Layer
│   │   ├── http/                # HTTP handlers
│   │   ├── graphql/             # GraphQL resolvers
│   │   └── grpc/                # gRPC services
│   │
│   └── rbac/                    # Cross-cutting: RBAC middleware
│
├── internal/                    # Private packages (not importable)
│   ├── infrastructure/          # Infrastructure Layer
│   │   ├── postgres/            # PostgreSQL repositories
│   │   │   ├── asset_repo.go    # AssetRepository implementation
│   │   │   └── finding_repo.go
│   │   ├── redis/               # Redis cache
│   │   └── external/            # External service adapters
│   │
│   └── server/                  # Server setup, DI container
│       ├── di.go                # Dependency injection
│       ├── routes.go            # Route registration
│       └── middleware.go        # HTTP middleware
│
└── migrations/                  # Database migrations
    └── core/
```

#### DDD Tactical Patterns

**1. Entities & Aggregates**

```go
// pkg/domain/asset/entity.go

package asset

import (
    "time"

    "github.com/google/uuid"
    "github.com/openctemio/api/pkg/domain/shared"
)

// Asset is the aggregate root for asset management
type Asset struct {
    id          AssetID
    tenantID    shared.TenantID
    typeID      AssetTypeID
    groupID     *AssetGroupID
    name        string
    identifier  string
    description string
    status      Status
    criticality Criticality
    metadata    Metadata
    tags        []string
    firstSeenAt time.Time
    lastSeenAt  time.Time
    createdAt   time.Time
    updatedAt   time.Time

    // Domain events collected during aggregate operations
    events []shared.DomainEvent
}

// NewAsset creates a new Asset aggregate with validation
func NewAsset(
    tenantID shared.TenantID,
    typeID AssetTypeID,
    name, identifier string,
) (*Asset, error) {
    if name == "" {
        return nil, ErrAssetNameRequired
    }
    if identifier == "" {
        return nil, ErrAssetIdentifierRequired
    }

    now := time.Now()
    asset := &Asset{
        id:          NewAssetID(),
        tenantID:    tenantID,
        typeID:      typeID,
        name:        name,
        identifier:  identifier,
        status:      StatusActive,
        criticality: CriticalityMedium,
        metadata:    NewMetadata(),
        tags:        []string{},
        firstSeenAt: now,
        lastSeenAt:  now,
        createdAt:   now,
        updatedAt:   now,
    }

    // Raise domain event
    asset.events = append(asset.events, AssetCreatedEvent{
        AssetID:    asset.id,
        TenantID:   tenantID,
        Name:       name,
        OccurredAt: now,
    })

    return asset, nil
}

// Business methods that encapsulate domain logic
func (a *Asset) UpdateCriticality(c Criticality, reason string) {
    if a.criticality != c {
        old := a.criticality
        a.criticality = c
        a.updatedAt = time.Now()

        a.events = append(a.events, AssetCriticalityChangedEvent{
            AssetID:        a.id,
            OldCriticality: old,
            NewCriticality: c,
            Reason:         reason,
            OccurredAt:     a.updatedAt,
        })
    }
}

// GetEvents returns and clears domain events
func (a *Asset) GetEvents() []shared.DomainEvent {
    events := a.events
    a.events = nil
    return events
}
```

**2. Value Objects**

```go
// pkg/domain/asset/value_objects.go

package asset

import (
    "fmt"

    "github.com/google/uuid"
)

// AssetID is a value object representing asset identifier
type AssetID struct {
    value uuid.UUID
}

func NewAssetID() AssetID {
    return AssetID{value: uuid.New()}
}

func ParseAssetID(s string) (AssetID, error) {
    id, err := uuid.Parse(s)
    if err != nil {
        return AssetID{}, fmt.Errorf("invalid asset ID: %w", err)
    }
    return AssetID{value: id}, nil
}

func (id AssetID) String() string { return id.value.String() }
func (id AssetID) IsZero() bool   { return id.value == uuid.Nil }

// Criticality is a value object for asset importance
type Criticality string

const (
    CriticalityLow      Criticality = "low"
    CriticalityMedium   Criticality = "medium"
    CriticalityHigh     Criticality = "high"
    CriticalityCritical Criticality = "critical"
)

func (c Criticality) IsValid() bool {
    switch c {
    case CriticalityLow, CriticalityMedium, CriticalityHigh, CriticalityCritical:
        return true
    }
    return false
}

func (c Criticality) Score() int {
    switch c {
    case CriticalityLow:
        return 1
    case CriticalityMedium:
        return 2
    case CriticalityHigh:
        return 3
    case CriticalityCritical:
        return 4
    default:
        return 0
    }
}
```

**3. Repository Interface (Domain Layer)**

```go
// pkg/domain/asset/repository.go

package asset

import (
    "context"

    "github.com/openctemio/api/pkg/domain/shared"
)

// Repository defines the interface for asset persistence
// Note: This is in the DOMAIN layer - implementation is in INFRASTRUCTURE
type Repository interface {
    // Commands
    Save(ctx context.Context, asset *Asset) error
    Delete(ctx context.Context, id AssetID) error

    // Queries
    FindByID(ctx context.Context, id AssetID) (*Asset, error)
    FindByTenantID(ctx context.Context, tenantID shared.TenantID, opts QueryOptions) ([]*Asset, error)
    FindByIdentifier(ctx context.Context, tenantID shared.TenantID, identifier string) (*Asset, error)
    Count(ctx context.Context, tenantID shared.TenantID, filter Filter) (int64, error)

    // Transaction support
    WithTx(tx shared.Transaction) Repository
}

type QueryOptions struct {
    Filter  Filter
    Sort    SortOptions
    Page    shared.Pagination
}

type Filter struct {
    Status      *Status
    Criticality *Criticality
    TypeID      *AssetTypeID
    GroupID     *AssetGroupID
    Tags        []string
    Search      string
}
```

**4. Application Service (Use Cases)**

```go
// pkg/app/asset_service.go

package app

import (
    "context"

    "github.com/openctemio/api/pkg/domain/asset"
    "github.com/openctemio/api/pkg/domain/shared"
)

// AssetService defines application-level operations
// This interface is in pkg/app/ so it can be imported by other repos
type AssetService interface {
    // Commands
    CreateAsset(ctx context.Context, cmd CreateAssetCommand) (*asset.Asset, error)
    UpdateAsset(ctx context.Context, cmd UpdateAssetCommand) (*asset.Asset, error)
    DeleteAsset(ctx context.Context, id asset.AssetID) error

    // Queries
    GetAsset(ctx context.Context, id asset.AssetID) (*asset.Asset, error)
    ListAssets(ctx context.Context, query ListAssetsQuery) (*AssetListResult, error)
    SearchAssets(ctx context.Context, query SearchAssetsQuery) (*AssetListResult, error)
}

// Commands (CQRS pattern)
type CreateAssetCommand struct {
    TenantID    shared.TenantID
    TypeID      asset.AssetTypeID
    GroupID     *asset.AssetGroupID
    Name        string
    Identifier  string
    Description string
    Criticality asset.Criticality
    Tags        []string
    Metadata    map[string]any
}

type UpdateAssetCommand struct {
    ID          asset.AssetID
    Name        *string
    Description *string
    Criticality *asset.Criticality
    Tags        *[]string
    Metadata    *map[string]any
}

// Queries
type ListAssetsQuery struct {
    TenantID shared.TenantID
    Filter   asset.Filter
    Sort     asset.SortOptions
    Page     shared.Pagination
}
```

**5. Domain Service Implementation**

```go
// pkg/domain/asset/service.go

package asset

import (
    "context"
    "fmt"

    "github.com/openctemio/api/pkg/app"
    "github.com/openctemio/api/pkg/domain/shared"
)

// Service implements app.AssetService
type Service struct {
    repo           Repository
    eventPublisher shared.EventPublisher
    logger         shared.Logger
}

// Ensure interface compliance at compile time
var _ app.AssetService = (*Service)(nil)

func NewService(
    repo Repository,
    eventPublisher shared.EventPublisher,
    logger shared.Logger,
) *Service {
    return &Service{
        repo:           repo,
        eventPublisher: eventPublisher,
        logger:         logger,
    }
}

func (s *Service) CreateAsset(ctx context.Context, cmd app.CreateAssetCommand) (*Asset, error) {
    // Create aggregate with validation
    asset, err := NewAsset(cmd.TenantID, cmd.TypeID, cmd.Name, cmd.Identifier)
    if err != nil {
        return nil, fmt.Errorf("create asset: %w", err)
    }

    // Apply optional fields
    if cmd.Description != "" {
        asset.description = cmd.Description
    }
    if cmd.Criticality.IsValid() {
        asset.criticality = cmd.Criticality
    }
    if cmd.GroupID != nil {
        asset.groupID = cmd.GroupID
    }

    // Persist
    if err := s.repo.Save(ctx, asset); err != nil {
        return nil, fmt.Errorf("save asset: %w", err)
    }

    // Publish domain events
    for _, event := range asset.GetEvents() {
        if err := s.eventPublisher.Publish(ctx, event); err != nil {
            s.logger.Error("failed to publish event", "event", event, "error", err)
        }
    }

    return asset, nil
}
```

**6. Repository Implementation (Infrastructure Layer)**

```go
// internal/infrastructure/postgres/asset_repo.go

package postgres

import (
    "context"
    "database/sql"

    "github.com/openctemio/api/pkg/domain/asset"
    "github.com/openctemio/api/pkg/domain/shared"
)

// AssetRepository implements asset.Repository using PostgreSQL
type AssetRepository struct {
    db *sql.DB
    tx *sql.Tx
}

// Ensure interface compliance
var _ asset.Repository = (*AssetRepository)(nil)

func NewAssetRepository(db *sql.DB) *AssetRepository {
    return &AssetRepository{db: db}
}

func (r *AssetRepository) Save(ctx context.Context, a *asset.Asset) error {
    query := `
        INSERT INTO assets (
            id, tenant_id, type_id, group_id, name, identifier,
            description, status, criticality, metadata, tags,
            first_seen_at, last_seen_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            status = EXCLUDED.status,
            criticality = EXCLUDED.criticality,
            metadata = EXCLUDED.metadata,
            tags = EXCLUDED.tags,
            last_seen_at = EXCLUDED.last_seen_at,
            updated_at = EXCLUDED.updated_at
    `

    executor := r.executor()
    _, err := executor.ExecContext(ctx, query,
        a.ID().String(),
        a.TenantID().String(),
        a.TypeID().String(),
        nullableUUID(a.GroupID()),
        a.Name(),
        a.Identifier(),
        a.Description(),
        a.Status(),
        a.Criticality(),
        metadataJSON(a.Metadata()),
        pq.Array(a.Tags()),
        a.FirstSeenAt(),
        a.LastSeenAt(),
        a.CreatedAt(),
        a.UpdatedAt(),
    )
    return err
}

func (r *AssetRepository) WithTx(tx shared.Transaction) asset.Repository {
    return &AssetRepository{db: r.db, tx: tx.(*sql.Tx)}
}

func (r *AssetRepository) executor() executor {
    if r.tx != nil {
        return r.tx
    }
    return r.db
}
```

#### Dependency Rule

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  OUTER LAYERS depend on INNER LAYERS (never the reverse!)       │
│                                                                  │
│    Infrastructure → Application → Domain                        │
│         ↓              ↓            ↓                           │
│      postgres/      app.go      domain/                         │
│      redis/                      asset/                         │
│      external/                   finding/                       │
│                                                                  │
│  Domain layer has NO external dependencies                      │
│  (only stdlib + shared kernel)                                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

#### Benefits of This Architecture

| Benefit | Description |
|---------|-------------|
| **Testability** | Domain logic can be unit tested without database |
| **Flexibility** | Easy to swap implementations (PostgreSQL → MongoDB) |
| **Modularity** | Clear boundaries between bounded contexts |
| **Import Strategy** | `pkg/app/` interfaces allow Enterprise to extend OSS |
| **Event-Driven** | Domain events enable loose coupling between modules |
| **CQRS Ready** | Commands/Queries separation enables future scaling |

---

## 1. Executive Summary

This RFC defines the architectural transformation of Exploopio from a single-repo SaaS application into a **three-edition product line**:

| Edition | Repositories | License | Target |
|---------|--------------|---------|--------|
| **Openctem (OSS)** | `openctemio/api`, `openctemio/ui`, `openctemio/agent` (public) | Apache 2.0 | Community, self-hosted |
| **Exploop (EE)** | `exploop/api`, `exploop/ui` (private) | Commercial | Enterprise on-premise |
| **Exploopio (SaaS)** | `exploop/cloud` (private) | SaaS | Cloud multi-tenant |

**Core Principles:**

1. **OSS Core is self-sufficient** - Openctem runs standalone without any enterprise/saas code
2. **Dependency flows one direction** - Enterprise imports OSS; SaaS imports Enterprise + OSS
3. **No code duplication** - All shared logic lives in OSS `/pkg`
4. **Interface-driven extension** - Enterprise/SaaS extend via composition, not modification
5. **Additive-only changes** - No breaking migrations during transition

**Estimated Timeline:** 8-10 weeks for full separation

---

## 2. Current Repository Assessment

### 2.1 Repository Structure

```
exploopio/                          # Monorepo (private)
├── api/                            # Go backend
│   ├── cmd/server/                 # Entry point + DI
│   ├── internal/                   # Private packages (PROBLEM: shared code here)
│   │   ├── domain/                 # 46 domain packages
│   │   ├── app/                    # 90+ service files
│   │   └── infra/                  # HTTP, Postgres, Redis
│   └── pkg/                        # Currently minimal
├── ui/                             # Next.js frontend
│   └── src/features/               # 42 feature modules
├── agent/                          # Scanner agent (Go)
├── sdk/                            # Shared Go SDK
├── setup/                          # Docker Compose configs
└── docs/                           # Documentation
```

### 2.2 Current Issues for Open-Sourcing

| Issue | Impact | Location |
|-------|--------|----------|
| **Shared code in `/internal`** | Cannot import from external repos | `api/internal/domain/*` |
| **Enterprise features mixed with core** | No clear boundary | `licensing/`, `aitriage/`, `admin/` |
| **SaaS-specific code everywhere** | Platform agents, billing | `agent/tier.go`, `platform_*.go` |
| **Single DI container** | All services wired together | `cmd/server/main.go` |
| **Monolithic migrations** | Cannot split by edition | `migrations/000001-000153` |

### 2.3 Codebase Statistics

| Component | Files | Lines | Classification |
|-----------|-------|-------|----------------|
| Domain packages | 46 | ~15,000 | 70% OSS, 20% EE, 10% SaaS |
| App services | 90+ | ~45,000 | 60% OSS, 30% EE, 10% SaaS |
| HTTP handlers | 50+ | ~20,000 | 65% OSS, 25% EE, 10% SaaS |
| Postgres repos | 42 | ~25,000 | 70% OSS, 20% EE, 10% SaaS |
| UI features | 42 | ~60,000 | 50% OSS, 35% EE, 15% SaaS |
| Migrations | 153 | ~8,000 | 60% OSS, 30% EE, 10% SaaS |

### 2.4 Domain Package Analysis (46 packages)

```
api/internal/domain/
│
├── Core (26 packages) - OSS candidates
│   ├── shared/          # ID types, errors, pagination
│   ├── user/            # User entity
│   ├── tenant/          # Tenant/workspace
│   ├── session/         # Sessions
│   ├── asset/           # Assets (2,500+ LOC)
│   ├── assetgroup/      # Asset grouping
│   ├── assettype/       # Asset types
│   ├── branch/          # Git branches
│   ├── component/       # SBOM components
│   ├── scope/           # Scope services
│   ├── scan/            # Scan entity
│   ├── scanprofile/     # Scan profiles
│   ├── scansession/     # Scan sessions
│   ├── datasource/      # Data sources
│   ├── vulnerability/   # Findings (3,000+ LOC)
│   ├── findingsource/   # Finding sources
│   ├── credential/      # Credential findings
│   ├── exposure/        # Web exposures
│   ├── notification/    # Notification outbox
│   ├── integration/     # Integrations
│   ├── tool/            # Scanner tools
│   ├── toolcategory/    # Tool categories
│   ├── capability/      # Tool capabilities
│   ├── command/         # Agent commands
│   ├── agent/           # Agents (base)
│   ├── secretstore/     # Secret storage
│   └── templatesource/  # Template sources
│
├── Enterprise (12 packages) - License required
│   ├── licensing/       # Plans, modules (1,500+ LOC)
│   ├── role/            # Custom roles
│   ├── permission/      # 150+ permissions
│   ├── permissionset/   # Permission sets
│   ├── accesscontrol/   # RBAC
│   ├── group/           # Data scoping
│   ├── audit/           # Audit logs
│   ├── rule/            # Suppression rules
│   ├── sla/             # SLA policies
│   ├── suppression/     # Suppressions
│   ├── workflow/        # Workflows
│   ├── pipeline/        # Pipelines
│   ├── scannertemplate/ # Scanner templates
│   ├── threatintel/     # Threat intel
│   └── aitriage/        # AI triage
│
└── SaaS (3 packages) - Cloud only
    ├── admin/           # Platform admins
    └── lease/           # Agent leases
```

### 2.5 Key Architectural Patterns Already Implemented

| Pattern | Location | Status |
|---------|----------|--------|
| Repository interfaces | `domain/*/repository.go` | Ready for extraction |
| Service composition | `app/*_service.go` | Needs interface extraction |
| Middleware chain | `infra/http/middleware/` | Can be shared |
| Module gating | `licensing/module.go` | Enterprise-ready |
| Event dispatcher | `workflow_event_dispatcher.go` | Extension point |
| Notification extensions | `integration/notification_extension.go` | Plugin pattern |

### 2.6 Current SDK Structure

```
sdk/
├── auth/            # Auth utilities
├── client/          # HTTP client
├── credentials/     # Credential handling (SecureCompare)
├── job/             # Job definitions
├── proto/           # gRPC definitions
├── scanner/         # Scanner interface
├── semaphore/       # Concurrency
├── templates/       # Template engine
├── tools/           # Tool definitions
└── validation/      # Input validation
```

**SDK Classification:**
- **OSS**: client, credentials, validation, semaphore - Generic utilities
- **Keep in SDK**: auth, job, scanner, templates, tools - Agent-specific

---

## 3. Code Classification (OSS / EE / SaaS)

### 3.1 Backend Domain Packages

#### OSS Core (29 packages) - Includes Basic RBAC

```
api/internal/domain/
├── shared/              # ID types, errors, pagination
├── user/                # User entity, authentication
├── tenant/              # Workspace/organization
├── session/             # Session management
├── refreshtoken/        # JWT refresh tokens
│
├── # === BASIC RBAC (Tiered Model) ===
├── role/                # Predefined roles (Admin, Manager, Analyst, Viewer)
├── permission/          # Core permissions (assets:read, findings:write, etc.)
├── userrole/            # User-role assignments
│
├── # === Asset Management ===
├── asset/               # Asset inventory (base)
├── assetgroup/          # Asset grouping
├── assettype/           # Asset type definitions
├── component/           # SBOM/dependencies
├── scope/               # Asset scope management
│
├── # === Security Findings ===
├── scan/                # Scan configuration
├── scanprofile/         # Scan profiles
├── datasource/          # Scanner data sources
├── vulnerability/       # Finding entity (base)
├── finding/             # Finding helpers
├── findingactivity/     # Finding history
├── findingcomment/      # Finding comments
├── credential/          # Credential findings
├── exposure/            # Web exposures
│
├── # === Infrastructure ===
├── notification/        # Notification outbox (base)
├── integration/         # Integration entity (base)
├── tool/                # Scanner tools catalog
├── capability/          # Tool capabilities
├── command/             # Agent commands
├── agent/               # Self-hosted agents (base)
└── dashboard/           # Dashboard aggregation
```

**Note:** Basic RBAC with 4 predefined roles is included in OSS to provide essential access control out-of-the-box.

#### Enterprise Edition (9 packages) - Extends OSS RBAC

```
api/internal/domain/
├── # === Advanced RBAC (extends OSS) ===
├── permissionset/       # Group permissions for easier assignment
├── accesscontrol/       # Fine-grained access (resource/field level)
│
├── # === Licensing ===
├── licensing/           # Plans, modules, subscriptions
│
├── # === Compliance & Governance ===
├── audit/               # Full audit logging with search/export
├── rule/                # Suppression rules with approval workflow
├── rulebundle/          # Rule bundles
├── sla/                 # SLA policies & violations
│
├── # === Advanced Features ===
├── workflow/            # Automation workflows
├── pipeline/            # Pipeline runs
├── threatintel/         # Threat intelligence
├── aitriage/            # AI-powered triage
└── remediation/         # Fix management
```

**Note:** Enterprise EXTENDS OSS RBAC with custom roles, permission sets, and fine-grained access control.

#### SaaS Only (8 packages)

```
api/internal/domain/
├── admin/               # Platform admin users
├── agent/tier.go        # Platform agent tiers (Dedicated/Shared)
├── lease/               # K8s-style agent leases
├── bootstraptoken/      # Agent registration tokens
├── agentregistration/   # Platform agent registration
├── platformjob/         # Platform job queue
├── billing/             # Stripe integration (future)
└── usage/               # Usage tracking (future)
```

### 3.2 Application Services

#### OSS Core Services (38 services) - Includes Basic RBAC

```go
// Authentication & Users
AuthService, SessionService, OAuthService, UserService

// Tenants & Organizations
TenantService, TenantMemberService

// Basic RBAC (Tiered Model)
RoleService          // List predefined roles, assign users
PermissionService    // List core permissions
UserRoleService      // Manage user-role assignments
RBACMiddleware       // Permission enforcement

// Assets
AssetService, AssetGroupService, AssetTypeService
ScopeService, ComponentService, AttackSurfaceService

// Scanning
ScanService, ScanProfileService, DatasourceService
ToolService, CapabilityService, CommandService

// Findings
VulnerabilityService, FindingActivityService
FindingCommentService, ExposureService, CredentialService

// Agents (self-hosted)
AgentService (base operations only)

// Notifications (base)
NotificationService (outbox operations)

// Integrations (base)
IntegrationService (CRUD, no advanced channels)

// Dashboard
DashboardService
```

**OSS RBAC Capabilities:**
- View predefined roles (Admin, Manager, Analyst, Viewer)
- Assign users to predefined roles
- Permission enforcement middleware
- Basic permission checks

#### Enterprise Services (16 services) - Extends OSS

```go
// Licensing
LicensingService, PlanService, SubscriptionService

// Advanced RBAC (extends OSS)
CustomRoleService      // Create/edit custom roles
PermissionSetService   // Group permissions
AccessControlService   // Fine-grained access control
GroupService           // Data scoping groups

// Governance
AuditService, RuleService, RuleBundleService
SLAService, ComplianceService

// Advanced Features
WorkflowService, WorkflowEventDispatcher
PipelineService, ThreatIntelService
AITriageService, RemediationService

// Advanced Integrations
IntegrationService (SIEM, Ticketing, SSO channels)
NotificationService (advanced routing, templates)
```

**Enterprise RBAC Capabilities:**
- All OSS capabilities +
- Create custom roles with specific permissions
- Permission sets for easier management
- Fine-grained permissions (resource/field level)
- Role inheritance
- Audit logging for RBAC changes

#### SaaS Services (10 services)

```go
// Platform Management
AdminService, AdminAuthService

// Platform Agents
PlatformAgentService, LeaseService
BootstrapTokenService, AgentRegistrationService
PlatformJobService

// Billing (future)
BillingService, UsageTrackingService, SubscriptionBillingService
```

### 3.3 Frontend Features

#### OSS Core (20 features) - Includes Basic RBAC UI

```
ui/src/features/
├── auth/                # Login, register, password
├── dashboard/           # Main dashboard
├── assets/              # Asset management
├── findings/            # Finding list & details
├── scans/               # Scan management
├── agents/              # Self-hosted agents
│
├── # === Basic RBAC UI ===
├── roles/               # View predefined roles, assign users
├── team/                # Team management with role assignment
│
├── settings/            # User settings
├── profile/             # User profile
├── components/          # SBOM viewer
├── credentials/         # Credential findings
├── exposures/           # Web exposures
├── notifications/       # Basic notifications
├── integrations/        # Basic integrations (SCM, Slack)
├── onboarding/          # Setup wizard
├── error/               # Error pages
├── layout/              # App layout
└── common/              # Shared components
```

**OSS RBAC UI Capabilities:**
- View 4 predefined roles and their permissions
- Assign users to roles
- Role-based navigation (hide features user can't access)
- Permission-based button/action visibility

#### Enterprise Features (13 features) - Extends OSS RBAC UI

```
ui/src/features/
├── licensing/           # Plan display, upgrade prompts
├── # === Advanced RBAC UI ===
├── custom-roles/        # Create/edit custom roles
├── permission-sets/     # Manage permission sets
├── access-control/      # Fine-grained access, data scoping
│
├── audit/               # Audit log viewer with search/export
├── policies/            # Compliance policies
├── reports/             # Advanced reports
├── workflows/           # Workflow builder
├── pipelines/           # Pipeline management
├── threat-intel/        # Threat intelligence
├── ai-triage/           # AI triage interface
├── remediation/         # Fix management
├── rules/               # Suppression rules with approval
├── sla/                 # SLA tracking
├── advanced-integrations/ # SIEM, Ticketing, SSO
├── compliance/          # Compliance dashboard
└── data-flow/           # Data flow visualization
```

**Enterprise RBAC UI Capabilities:**
- All OSS capabilities +
- Create/edit custom roles
- Manage permission sets
- Configure fine-grained access
- View RBAC audit logs

#### SaaS Features (9 features)

```
ui/src/features/
├── billing/             # Stripe checkout, invoices
├── subscription/        # Plan management
├── usage/               # Usage analytics
├── platform-agents/     # Platform agent management
├── admin/               # Admin portal
├── organizations/       # Multi-org management
├── onboarding-saas/     # SaaS-specific onboarding
├── trial/               # Trial management
└── cloud-settings/      # Cloud-specific settings
```

### 3.4 Database Migrations Classification

#### OSS Core (Migrations 000001-000050) - Includes Basic RBAC

```
# === Foundation ===
000001 - extensions (uuid-ossp, pgcrypto)
000002 - enum types (severity, status, etc.)
000003 - users table
000004 - sessions table
000005 - tenants table

# === Basic RBAC (Tiered Model) ===
000006 - roles table (predefined: admin, manager, analyst, viewer)
000007 - permissions table (core permissions)
000008 - role_permissions table
000009 - user_roles table
000010 - seed predefined roles and permissions

# === Asset Management ===
000011 - assets table
000012 - asset_groups table
000013 - asset_types table
000014 - components table

# === Security Findings ===
000015 - scans table
000016 - scan_profiles table
000017 - findings table
000018 - finding_activities table
000019 - exposures table
000020 - credentials table

# === Infrastructure ===
000021 - agents table (self-hosted)
000022 - commands table
000023 - tools table
000024 - capabilities table
000025 - integrations table (base)
000026 - notification_outbox table
000027 - datasources table
...
000050 - (end of core schema)
```

#### Enterprise (Migrations 000051-000085) - Extends OSS RBAC

```
# === Advanced RBAC (extends core roles/permissions) ===
000051 - ALTER roles: add is_custom, created_by, permissions JSONB
000052 - permission_sets table
000053 - permission_set_items table
000054 - role_permission_sets table (link roles to sets)
000055 - access_control table (fine-grained)
000056 - groups table (data scoping)

# === Compliance & Governance ===
000057 - audit_logs table (full audit trail)
000058 - rules table (suppression rules)
000059 - rule_bundles table
000060 - sla_policies table
000061 - sla_violations table

# === Automation ===
000062 - workflows table
000063 - workflow_nodes table
000064 - workflow_edges table
000065 - workflow_runs table

# === Licensing ===
000066 - plans table
000067 - modules table
000068 - plan_modules table
000069 - license_keys table
000070 - tenant_subscriptions table
...
000085 - (end of enterprise schema)
```

**Note:** Enterprise migrations EXTEND the OSS schema. Basic RBAC (roles, permissions, user_roles) is already in OSS Core.

#### SaaS (Migrations 000086-000153)

```
000086 - admin_users table
000087 - platform_agent_tiers
000088 - bootstrap_tokens table
000089 - agent_registrations table
000090 - agent_leases table
000091 - platform_jobs table
000092 - agent_tier column on agents
000093 - max_concurrent_jobs column
...
000153 - (current latest)
```

---

## 4. Target Architecture Overview

### 4.1 Multi-Repository Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DEPENDENCY FLOW                               │
│                                                                       │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  OPENCTEM (OSS)  - org: openctemio                            │   │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │   │
│   │  │   api    │  │    ui    │  │  agent   │  │   sdk    │    │   │
│   │  └────┬─────┘  └──────────┘  └────┬─────┘  └──────────┘    │   │
│   └───────┼────────────────────────────┼────────────────────────┘   │
│           │ imports                    │                             │
│           ▼                            ▼                             │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  EXPLOOP (Enterprise)  - org: exploop                       │   │
│   │  ┌──────────┐  ┌──────────┐                                 │   │
│   │  │   api    │  │    ui    │    extends openctemio/*           │   │
│   │  └────┬─────┘  └──────────┘                                 │   │
│   └───────┼─────────────────────────────────────────────────────┘   │
│           │ imports                                                  │
│           ▼                                                          │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  EXPLOOPIO (SaaS)  - org: exploop                           │   │
│   │  ┌──────────┐                                               │   │
│   │  │  cloud   │    imports openctemio/* + exploop/*             │   │
│   │  └──────────┘                                               │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Go Module Paths

```go
// OSS API
module github.com/openctemio/api

// OSS Agent (imports OSS API)
module github.com/openctemio/agent

require github.com/openctemio/api v1.0.0

// Enterprise API (imports OSS)
module github.com/exploop/api

require (
    github.com/openctemio/api v1.0.0
    github.com/openctemio/agent v1.0.0
)

// SaaS Cloud (imports all)
module github.com/exploop/cloud

require (
    github.com/openctemio/api v1.0.0
    github.com/openctemio/agent v1.0.0
    github.com/exploop/api v1.0.0
)
```

### 4.3 Package Visibility Rules

| Package Location | Visibility | Can Import |
|-----------------|------------|------------|
| `openctemio/api/pkg/*` | Public | External repos (EE, SaaS) |
| `openctemio/api/internal/*` | Private | Only within openctemio/api |
| `openctemio/agent/pkg/*` | Public | External repos |
| `exploop/api/pkg/*` | Public (to SaaS) | exploop/cloud |
| `exploop/api/internal/*` | Private to EE | Only within exploop/api |
| `exploop/cloud/internal/*` | Private to SaaS | Only within exploop/cloud |

---

## 5. Target Repository Structures

### 5.1 Openctem OSS Repositories

#### 5.1.1 openctemio/api (Backend API)

```
github.com/openctemio/api/
├── pkg/                            # PUBLIC - importable by EE/SaaS
│   ├── domain/                     # Domain models
│   │   ├── shared/                 # ID, errors, pagination
│   │   ├── user/                   # User entity
│   │   ├── tenant/                 # Tenant entity
│   │   ├── asset/                  # Asset entity + repository interface
│   │   ├── finding/                # Finding entity + repository interface
│   │   ├── scan/                   # Scan entity + repository interface
│   │   ├── agent/                  # Agent entity (base)
│   │   ├── integration/            # Integration entity (base)
│   │   └── notification/           # Notification outbox (base)
│   ├── app/                        # Application services
│   │   ├── auth.go                 # AuthService interface + impl
│   │   ├── asset.go                # AssetService interface + impl
│   │   ├── finding.go              # FindingService interface + impl
│   │   ├── scan.go                 # ScanService interface + impl
│   │   └── ...                     # Other core services
│   ├── infra/                      # Infrastructure
│   │   ├── postgres/               # PostgreSQL implementations
│   │   ├── redis/                  # Redis cache
│   │   └── http/                   # HTTP utilities
│   ├── middleware/                 # HTTP middleware
│   │   ├── auth.go                 # JWT auth middleware
│   │   ├── tenant.go               # Tenant context
│   │   ├── logging.go              # Request logging
│   │   └── recovery.go             # Panic recovery
│   └── config/                     # Configuration loading
│       └── config.go               # Config struct + loader
│
├── internal/                       # PRIVATE - OSS-specific wiring
│   └── server/                     # OSS server setup
│       ├── di.go                   # OSS DI container
│       ├── routes.go               # OSS route registration
│       └── migrations.go           # Migration runner
│
├── cmd/
│   └── server/                     # OSS API binary
│       └── main.go                 # Entry point
│
├── migrations/
│   └── core/                       # Core migrations only
│       ├── 000001_users.up.sql
│       ├── 000002_tenants.sql
│       └── ...
│
├── docker-compose.yml              # Development setup
├── Dockerfile
├── LICENSE                         # Apache 2.0
├── README.md
├── CONTRIBUTING.md
└── go.mod
```

#### 5.1.2 openctemio/ui (Frontend)

```
github.com/openctemio/ui/
├── src/
│   ├── features/                   # Core features only
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── assets/
│   │   ├── findings/
│   │   ├── scans/
│   │   ├── agents/
│   │   └── settings/
│   ├── components/                 # Shared components
│   ├── lib/                        # Utilities
│   └── styles/                     # Global styles
│
├── public/
├── Dockerfile
├── package.json                    # @openctemio/ui
├── LICENSE                         # Apache 2.0
└── README.md
```

#### 5.1.3 openctemio/agent (Scanner Agent)

```
github.com/openctemio/agent/
├── pkg/                            # PUBLIC - shared agent utilities
│   ├── scanner/                    # Scanner interface
│   ├── job/                        # Job definitions
│   └── client/                     # API client
│
├── internal/                       # PRIVATE
│   ├── executor/                   # Job executor
│   ├── tools/                      # Tool integrations
│   └── grpc/                       # gRPC client
│
├── cmd/
│   └── agent/                      # Agent binary
│       └── main.go
│
├── Dockerfile
├── LICENSE                         # Apache 2.0
├── README.md
└── go.mod                          # requires github.com/openctemio/api
```

### 5.2 Exploop Enterprise Repositories

#### 5.2.1 exploop/api (Enterprise API)

```
github.com/exploop/api/
├── pkg/                            # PUBLIC - importable by SaaS
│   ├── licensing/                  # Licensing system
│   │   ├── module.go               # Module definitions
│   │   ├── plan.go                 # Plan entity
│   │   ├── license.go              # License key validation
│   │   └── service.go              # LicensingService
│   ├── rbac/                       # Advanced RBAC
│   │   ├── role.go                 # Role entity
│   │   ├── permission.go           # Permission constants
│   │   └── service.go              # RBACService
│   ├── audit/                      # Audit logging
│   │   ├── event.go                # Audit event entity
│   │   └── service.go              # AuditService
│   ├── workflow/                   # Workflow automation
│   │   ├── workflow.go             # Workflow entity
│   │   ├── trigger.go              # Trigger definitions
│   │   └── service.go              # WorkflowService
│   ├── aitriage/                   # AI Triage
│   │   ├── triage.go               # Triage entity
│   │   └── service.go              # AITriageService
│   └── middleware/                 # EE middleware
│       ├── license.go              # License validation
│       ├── module.go               # Module gating
│       └── permission.go           # Permission checking
│
├── internal/                       # PRIVATE - EE-specific
│   └── server/
│       ├── di.go                   # EE DI (extends OSS)
│       ├── routes.go               # EE routes (extends OSS)
│       └── migrations.go
│
├── cmd/
│   └── server/                     # EE API binary
│       └── main.go
│
├── migrations/
│   └── enterprise/                 # EE migrations only
│       ├── 000100_roles.up.sql
│       ├── 000101_permissions.up.sql
│       └── ...
│
├── helm/                           # Kubernetes deployment
│   └── exploop/
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
│
├── LICENSE                         # Commercial/Proprietary
├── README.md
└── go.mod                          # requires github.com/openctemio/*
```

#### 5.2.2 exploop/ui (Enterprise UI)

```
github.com/exploop/ui/
├── src/
│   └── features/                   # EE features only
│       ├── licensing/
│       ├── access-control/
│       ├── audit/
│       ├── workflows/
│       ├── ai-triage/
│       └── compliance/
│
├── package.json                    # @exploop/ui, depends on @openctemio/ui
├── LICENSE                         # Commercial
└── README.md
```

### 5.3 Exploopio SaaS Repository

#### 5.3.1 exploop/cloud (SaaS Platform)

```
github.com/exploop/cloud/
├── internal/                       # ALL PRIVATE - SaaS-specific
│   ├── platform/                   # Platform management
│   │   ├── admin/                  # Admin users
│   │   ├── agent/                  # Platform agents
│   │   ├── billing/                # Stripe integration
│   │   └── usage/                  # Usage tracking
│   └── server/
│       ├── di.go                   # SaaS DI (extends EE + OSS)
│       ├── routes.go               # SaaS routes
│       └── workers.go              # Background workers
│
├── cmd/
│   ├── api/                        # SaaS API server
│   │   └── main.go
│   └── admin/                      # Admin API server
│       └── main.go
│
├── migrations/
│   └── saas/                       # SaaS migrations only
│       ├── 000200_admin_users.up.sql
│       ├── 000201_platform_agents.up.sql
│       └── ...
│
├── ui/                             # SaaS UI extensions
│   └── src/features/
│       ├── billing/
│       ├── platform-agents/
│       └── admin/
│
├── admin-ui/                       # Admin portal
│
├── terraform/                      # Infrastructure as code
│   ├── modules/
│   └── environments/
│
├── LICENSE                         # Proprietary
├── README.md
└── go.mod                          # requires github.com/openctemio/* + github.com/exploop/api
```

---

## 6. Dependency & Extension Design

### 6.1 Interface-Based Extension Points

#### Repository Interfaces (in OSS `/pkg`)

```go
// pkg/domain/asset/repository.go
package asset

type Repository interface {
    Create(ctx context.Context, asset *Asset) error
    GetByID(ctx context.Context, tenantID, id ID) (*Asset, error)
    List(ctx context.Context, tenantID ID, filter Filter) ([]*Asset, error)
    Update(ctx context.Context, asset *Asset) error
    Delete(ctx context.Context, tenantID, id ID) error
}

// Default implementation in pkg/infra/postgres/
// EE/SaaS can wrap or replace
```

#### Service Interfaces (in OSS `/pkg`)

```go
// pkg/app/asset.go
package app

type AssetService interface {
    Create(ctx context.Context, input CreateAssetInput) (*asset.Asset, error)
    Get(ctx context.Context, tenantID, id shared.ID) (*asset.Asset, error)
    List(ctx context.Context, tenantID shared.ID, filter asset.Filter) (*asset.ListResult, error)
    Update(ctx context.Context, input UpdateAssetInput) (*asset.Asset, error)
    Delete(ctx context.Context, tenantID, id shared.ID) error
}

// Default implementation
type assetService struct {
    repo   asset.Repository
    log    *logger.Logger
}

func NewAssetService(repo asset.Repository, log *logger.Logger) AssetService {
    return &assetService{repo: repo, log: log}
}
```

### 6.2 Enterprise Extension Pattern

```go
// exploop/pkg/rbac/asset_service.go
package rbac

import (
    "github.com/openctemio/api/pkg/app"
    "github.com/openctemio/api/pkg/domain/asset"
)

// Wrap OSS service with RBAC checks
type AssetServiceWithRBAC struct {
    core       app.AssetService      // OSS service
    rbac       *RBACService          // EE service
    audit      *AuditService         // EE service
}

func NewAssetServiceWithRBAC(
    core app.AssetService,
    rbac *RBACService,
    audit *AuditService,
) app.AssetService {
    return &AssetServiceWithRBAC{
        core:  core,
        rbac:  rbac,
        audit: audit,
    }
}

func (s *AssetServiceWithRBAC) Create(ctx context.Context, input app.CreateAssetInput) (*asset.Asset, error) {
    // 1. Check permission
    if err := s.rbac.RequirePermission(ctx, "assets:create"); err != nil {
        return nil, err
    }

    // 2. Delegate to core
    result, err := s.core.Create(ctx, input)
    if err != nil {
        return nil, err
    }

    // 3. Audit log
    s.audit.Log(ctx, AuditEvent{
        Action:   "asset.created",
        Resource: result.ID.String(),
    })

    return result, nil
}

// Implement all interface methods with RBAC + audit wrapping
```

### 6.3 SaaS Extension Pattern

```go
// exploopio/internal/platform/asset_service.go
package platform

import (
    "github.com/openctemio/api/pkg/app"
    "github.com/exploop/exploop/pkg/licensing"
)

// Wrap EE service with usage tracking + limits
type AssetServiceWithLimits struct {
    core     app.AssetService       // EE-wrapped service
    limits   *LimitsService         // SaaS service
    usage    *UsageTracker          // SaaS service
}

func (s *AssetServiceWithLimits) Create(ctx context.Context, input app.CreateAssetInput) (*asset.Asset, error) {
    tenantID := tenant.FromContext(ctx)

    // 1. Check usage limits
    count, _ := s.usage.GetCount(ctx, tenantID, "assets")
    limit, _ := s.limits.GetLimit(ctx, tenantID, "max_assets")
    if limit > 0 && count >= limit {
        return nil, ErrAssetLimitReached
    }

    // 2. Delegate to EE service (which delegates to OSS)
    result, err := s.core.Create(ctx, input)
    if err != nil {
        return nil, err
    }

    // 3. Track usage
    s.usage.Increment(ctx, tenantID, "assets")

    return result, nil
}
```

### 6.4 DI Container Composition

```go
// OSS: openctemio/api/internal/server/di.go
func NewOSSServices(repos *Repositories) *Services {
    return &Services{
        Asset:   app.NewAssetService(repos.Asset, log),
        Finding: app.NewFindingService(repos.Finding, log),
        Scan:    app.NewScanService(repos.Scan, log),
        // ... core services only
    }
}

// EE: exploop/internal/server/di.go
func NewEEServices(repos *Repositories, ossServices *oss.Services) *Services {
    // Start with OSS services
    rbac := rbac.NewRBACService(repos.Role, repos.Permission)
    audit := audit.NewAuditService(repos.Audit)

    return &Services{
        // Wrap OSS services with RBAC + audit
        Asset:   rbac.NewAssetServiceWithRBAC(ossServices.Asset, rbac, audit),
        Finding: rbac.NewFindingServiceWithRBAC(ossServices.Finding, rbac, audit),

        // Add EE-only services
        RBAC:      rbac,
        Audit:     audit,
        Licensing: licensing.NewLicensingService(repos.Plan, repos.Module),
        Workflow:  workflow.NewWorkflowService(repos.Workflow),
        AITriage:  aitriage.NewAITriageService(repos.AITriage, llmClient),
    }
}

// SaaS: exploopio/internal/server/di.go
func NewSaaSServices(repos *Repositories, eeServices *ee.Services) *Services {
    limits := platform.NewLimitsService(eeServices.Licensing)
    usage := platform.NewUsageTracker(repos.Usage)

    return &Services{
        // Wrap EE services with limits + usage
        Asset:   platform.NewAssetServiceWithLimits(eeServices.Asset, limits, usage),
        Finding: platform.NewFindingServiceWithLimits(eeServices.Finding, limits, usage),

        // Include all EE services
        RBAC:      eeServices.RBAC,
        Audit:     eeServices.Audit,
        Licensing: eeServices.Licensing,

        // Add SaaS-only services
        Admin:         platform.NewAdminService(repos.Admin),
        PlatformAgent: platform.NewPlatformAgentService(repos.PlatformAgent),
        Billing:       billing.NewBillingService(stripeClient),
        Usage:         usage,
    }
}
```

### 6.5 Middleware Composition

```go
// OSS: Basic middleware chain
func OSSMiddleware(cfg *config.Config) []func(http.Handler) http.Handler {
    return []func(http.Handler) http.Handler{
        middleware.RequestID(),
        middleware.Recovery(log),
        middleware.Logger(log),
        middleware.CORS(cfg.CORS),
        middleware.Auth(cfg.Auth),      // JWT validation
        middleware.TenantContext(),     // Extract tenant
    }
}

// EE: Add RBAC + audit middleware
func EEMiddleware(cfg *config.Config, rbac *RBACService) []func(http.Handler) http.Handler {
    base := OSSMiddleware(cfg)
    return append(base,
        middleware.License(cfg.License),      // Validate license key
        middleware.Module(rbac),               // Check module access
        middleware.Permission(rbac),           // Check RBAC permissions
        middleware.AuditLog(auditService),     // Log all requests
    )
}

// SaaS: Add rate limiting + usage tracking
func SaaSMiddleware(cfg *config.Config, rbac *RBACService, usage *UsageTracker) []func(http.Handler) http.Handler {
    base := EEMiddleware(cfg, rbac)
    return append(base,
        middleware.RateLimit(cfg.RateLimit),   // Rate limiting
        middleware.UsageTracking(usage),        // Track API calls
    )
}
```

---

## 7. Feature Enablement Model

### 7.1 Module-Based Feature Gating

```go
// exploop/pkg/licensing/module.go

type Module string

const (
    // Core modules (always enabled in EE/SaaS, limited in OSS)
    ModuleDashboard Module = "dashboard"
    ModuleAssets    Module = "assets"
    ModuleFindings  Module = "findings"
    ModuleScans     Module = "scans"
    ModuleAgents    Module = "agents"
    ModuleTeam      Module = "team"

    // Enterprise modules (require EE license)
    ModuleAudit       Module = "audit"
    ModuleRBAC        Module = "rbac"
    ModuleGroups      Module = "groups"
    ModuleWorkflows   Module = "workflows"
    ModuleAITriage    Module = "ai_triage"
    ModuleThreatIntel Module = "threat_intel"
    ModuleCompliance  Module = "compliance"

    // SaaS modules (cloud only)
    ModulePlatformAgents Module = "platform_agents"
    ModuleBilling        Module = "billing"
    ModuleUsageAnalytics Module = "usage_analytics"
)

// Edition -> Modules mapping
var EditionModules = map[Edition][]Module{
    EditionOSS: {
        ModuleDashboard, ModuleAssets, ModuleFindings,
        ModuleScans, ModuleAgents, ModuleTeam,
    },
    EditionEnterprise: {
        // All OSS modules +
        ModuleAudit, ModuleRBAC, ModuleGroups,
        ModuleWorkflows, ModuleAITriage, ModuleThreatIntel,
        ModuleCompliance,
    },
    EditionSaaS: {
        // All Enterprise modules +
        ModulePlatformAgents, ModuleBilling, ModuleUsageAnalytics,
    },
}
```

### 7.2 License Key System (Enterprise)

```go
// exploop/pkg/licensing/license.go

type LicenseKey struct {
    ID           string    `json:"id"`
    CustomerID   string    `json:"customer_id"`
    CustomerName string    `json:"customer_name"`
    Edition      Edition   `json:"edition"`
    Modules      []Module  `json:"modules"`
    MaxUsers     int64     `json:"max_users"`     // -1 = unlimited
    MaxAssets    int64     `json:"max_assets"`    // -1 = unlimited
    IssuedAt     time.Time `json:"issued_at"`
    ExpiresAt    time.Time `json:"expires_at"`
    Signature    string    `json:"signature"`
}

// License format: base64(json_payload.signature)
// Signature: RSA-SHA256 of json_payload with Exploop private key

func ParseAndValidate(encoded string, publicKey *rsa.PublicKey) (*LicenseKey, error) {
    // 1. Decode base64
    // 2. Split payload and signature
    // 3. Verify RSA signature
    // 4. Parse JSON
    // 5. Check expiration
    return key, nil
}

// Validation middleware
func RequireLicense(svc *LicensingService) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            license := svc.GetLicense()
            if license == nil {
                http.Error(w, "License required", 402)
                return
            }
            if license.IsExpired() {
                http.Error(w, "License expired", 402)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}
```

### 7.3 Subscription-Based Access (SaaS)

```go
// exploopio/internal/platform/subscription.go

type Subscription struct {
    TenantID       shared.ID
    PlanID         shared.ID
    Status         SubscriptionStatus  // active, trial, cancelled, past_due
    TrialEndsAt    *time.Time
    CurrentPeriodEnd time.Time

    // Stripe integration
    StripeCustomerID     string
    StripeSubscriptionID string
}

type Plan struct {
    ID           shared.ID
    Slug         string    // "starter", "professional", "enterprise"
    Name         string
    Modules      []Module  // Enabled modules
    MaxUsers     int64
    MaxAssets    int64
    MaxAgents    int64
    PriceMonthly float64
    PriceYearly  float64
}

// Check access
func (s *SubscriptionService) TenantHasModule(ctx context.Context, tenantID shared.ID, module Module) (bool, error) {
    sub, err := s.GetSubscription(ctx, tenantID)
    if err != nil {
        return false, err
    }

    // Check subscription status
    if sub.Status != StatusActive && sub.Status != StatusTrial {
        return false, ErrSubscriptionInactive
    }

    // Check module in plan
    plan, _ := s.GetPlan(ctx, sub.PlanID)
    return slices.Contains(plan.Modules, module), nil
}
```

### 7.4 Frontend Feature Gating

```tsx
// OSS: Simple feature check
const ENABLED_FEATURES = ['dashboard', 'assets', 'findings', 'scans', 'agents', 'team'];

export function FeatureGate({ feature, children, fallback }) {
  const enabled = ENABLED_FEATURES.includes(feature);
  return enabled ? children : (fallback || null);
}

// EE: License-based
export function ModuleGate({ module, children, fallback }) {
  const { license } = useLicense();
  const enabled = license?.modules.includes(module);

  if (!enabled) {
    return fallback || <UpgradePrompt module={module} />;
  }
  return children;
}

// SaaS: Subscription-based
export function ModuleGate({ module, children, fallback }) {
  const { subscription, plan } = useSubscription();
  const enabled = plan?.modules.includes(module);

  if (!enabled) {
    return fallback || <UpgradePrompt module={module} currentPlan={plan} />;
  }
  return children;
}
```

---

## 8. Database Migration Strategy

### 8.1 Migration Splitting Rules

| Edition | Migration Range | Naming Convention |
|---------|----------------|-------------------|
| OSS Core | 000001-000099 | `core_NNNNNN_name.sql` |
| Enterprise | 000100-000199 | `ee_NNNNNN_name.sql` |
| SaaS | 000200-000299 | `saas_NNNNNN_name.sql` |

### 8.2 Current Migration Reclassification

```sql
-- Step 1: Tag existing migrations (add comment headers)

-- migrations/000046_roles.up.sql
-- Edition: enterprise
-- Depends: core
CREATE TABLE roles (...);

-- migrations/000086_admin_users.up.sql
-- Edition: saas
-- Depends: enterprise
CREATE TABLE admin_users (...);
```

### 8.3 Migration Runner Per Edition

```go
// OSS: Only run core migrations
func (r *MigrationRunner) RunOSS(db *sql.DB) error {
    return r.runMigrations(db, "migrations/core/*.sql")
}

// EE: Run core + enterprise
func (r *MigrationRunner) RunEnterprise(db *sql.DB) error {
    if err := r.runMigrations(db, "migrations/core/*.sql"); err != nil {
        return err
    }
    return r.runMigrations(db, "migrations/enterprise/*.sql")
}

// SaaS: Run all
func (r *MigrationRunner) RunSaaS(db *sql.DB) error {
    for _, pattern := range []string{
        "migrations/core/*.sql",
        "migrations/enterprise/*.sql",
        "migrations/saas/*.sql",
    } {
        if err := r.runMigrations(db, pattern); err != nil {
            return err
        }
    }
    return nil
}
```

### 8.4 Additive Migration Rules

**NEVER:**
- Drop columns used by lower editions
- Rename tables/columns used by lower editions
- Change column types incompatibly
- Add NOT NULL without defaults

**ALWAYS:**
- Add new columns as nullable OR with defaults
- Create new tables for edition-specific data
- Use separate tables instead of adding columns to core tables
- Maintain backward compatibility with previous edition

```sql
-- WRONG: Modifying core table for EE feature
ALTER TABLE assets ADD COLUMN risk_score FLOAT NOT NULL;  -- Breaks OSS

-- RIGHT: Separate table
CREATE TABLE asset_risk_scores (
    asset_id UUID REFERENCES assets(id),
    risk_score FLOAT NOT NULL,
    calculated_at TIMESTAMP DEFAULT NOW()
);
```

### 8.5 Safe Rollout Order

```
Phase 1: Prepare
├── Tag all existing migrations with edition
├── Create migration/core/, migration/enterprise/, migration/saas/
├── Move migrations to appropriate directories
└── Test each edition can run independently

Phase 2: OSS Split
├── Copy core migrations to openctemio repos
├── Test OSS runs with core-only schema
└── Verify no enterprise/saas tables created

Phase 3: EE Split
├── Copy core + enterprise migrations to exploop repo
├── Test EE runs with enterprise schema
└── Verify no saas tables created

Phase 4: Verify
├── Test OSS -> EE upgrade path
├── Test EE -> SaaS upgrade path
├── Test rollback scenarios
└── Performance test each edition
```

---

## 9. Step-by-Step Migration Plan

### Phase 1: Package Extraction (Week 1-2)

**Goal:** Move shared code from `/internal` to `/pkg`

```
1.1 Create pkg/ structure in current repo
    mkdir -p api/pkg/{domain,app,infra,middleware,config}

1.2 Move domain packages (one at a time)
    - Start with shared/ (no dependencies)
    - Move user/, tenant/, session/ (auth foundation)
    - Move asset/, finding/, scan/ (core business)
    - Update all import paths
    - Run tests after each move

1.3 Move app services
    - Extract interfaces from concrete types
    - Move implementations to pkg/app/
    - Ensure backward compatibility

1.4 Move infrastructure
    - Move postgres/ implementations
    - Move http/middleware/
    - Keep edition-specific code in internal/

1.5 Validation checkpoint
    - All tests pass
    - No import cycles
    - External import possible from pkg/
```

### Phase 2: Repository Split (Week 3-4)

**Goal:** Create three separate repositories

```
2.1 Create openctemio repos
    - Initialize github.com/openctemio/api
    - Copy pkg/ directory
    - Copy core cmd/, migrations/, ui/
    - Update go.mod
    - Verify builds and tests

2.2 Create exploop repo
    - Initialize github.com/exploop/exploop
    - Add dependency on openctem
    - Move enterprise packages to pkg/
    - Move enterprise cmd/, migrations/, ui/
    - Implement service wrappers
    - Verify builds and tests

2.3 Transform exploopio repo
    - Add dependencies on openctemio + exploop
    - Move SaaS code to internal/
    - Update DI to compose all editions
    - Verify builds and tests

2.4 Validation checkpoint
    - OSS builds independently
    - EE imports OSS correctly
    - SaaS imports both correctly
    - All tests pass in all repos
```

### Phase 3: Migration Split (Week 4-5)

**Goal:** Separate database migrations by edition

```
3.1 Classify existing migrations
    - Tag each migration with edition
    - Document dependencies
    - Identify cross-edition dependencies

3.2 Restructure migration directories
    openctemio/api/migrations/core/000001-000099
    exploop/migrations/enterprise/000100-000199
    exploopio/migrations/saas/000200-000299

3.3 Implement edition-aware runner
    - OSS: runs core only
    - EE: runs core + enterprise
    - SaaS: runs all

3.4 Test migration scenarios
    - Fresh install per edition
    - Upgrade paths (OSS->EE, EE->SaaS)
    - Rollback scenarios

3.5 Validation checkpoint
    - Each edition installs cleanly
    - Upgrades work correctly
    - No data loss scenarios
```

### Phase 4: Feature Gating (Week 5-6)

**Goal:** Implement edition-aware feature enablement

```
4.1 Implement licensing system
    - Module definitions in exploop
    - License key parsing/validation
    - LicensingService implementation

4.2 Add middleware
    - RequireModule middleware
    - RequireLicense middleware
    - RequirePermission middleware (EE)

4.3 Update handlers
    - Add module checks to routes
    - Return proper errors for disabled features
    - Add upgrade prompts

4.4 Update frontend
    - ModuleGate component
    - UpgradePrompt component
    - Edition-aware navigation

4.5 Validation checkpoint
    - OSS shows only core features
    - EE shows enterprise features with license
    - SaaS shows all features with subscription
```

### Phase 5: CI/CD Setup (Week 6-7)

**Goal:** Independent build/release pipelines

```
5.1 OSS CI/CD
    - GitHub Actions for openctem
    - Automated testing
    - Docker image builds (ghcr.io/openctemio/*)
    - GitHub Releases for versions

5.2 EE CI/CD
    - Private CI for exploop
    - Automated testing (imports OSS)
    - Docker image builds (private registry)
    - Helm chart packaging

5.3 SaaS CI/CD
    - Existing pipeline adaptation
    - Imports from both repos
    - Terraform deployment
    - Staging -> Production promotion

5.4 Validation checkpoint
    - All pipelines green
    - Images build correctly
    - Deployments work
```

### Phase 6: Documentation & Launch (Week 7-8)

**Goal:** Production-ready documentation

```
6.1 OSS Documentation
    - README with quick start
    - Installation guide
    - Configuration reference
    - API documentation
    - Contributing guide

6.2 EE Documentation
    - Installation guide
    - License activation
    - Feature documentation
    - Helm deployment guide

6.3 SaaS Documentation
    - User documentation
    - Admin documentation
    - API reference

6.4 Launch preparation
    - Security review
    - Performance testing
    - Monitoring setup
    - Support documentation

6.5 Launch
    - Announce OSS release
    - Update website
    - Enable EE licensing
    - Monitor adoption
```

---

## 10. Risks & Mitigations

### 10.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Import cycles after split** | High | Medium | Map dependencies before moving. Use interfaces to break cycles. |
| **Migration incompatibility** | High | Low | Test upgrade paths thoroughly. Keep additive-only rule. |
| **Performance regression** | Medium | Medium | Benchmark before/after. Profile composition overhead. |
| **Breaking changes in OSS** | High | Medium | Semantic versioning. Deprecation policy. |
| **License bypass** | High | Low | Server-side enforcement. Signed license keys. |

### 10.2 Operational Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Sync overhead (3 repos)** | Medium | High | Automate dependency updates. Clear release process. |
| **Feature drift between editions** | Medium | Medium | Shared roadmap. Feature parity reviews. |
| **Support complexity** | Medium | High | Clear edition identification in logs. Separate support channels. |
| **Security vulnerability in OSS** | High | Medium | Rapid patch process. Security policy. Bug bounty. |

### 10.3 Business Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **OSS cannibalizes paid** | High | Medium | Clear feature differentiation. Enterprise-only value. |
| **Competitor forks OSS** | Medium | Medium | Strong community. Fast iteration. License (AGPLv3 option). |
| **Slow adoption** | Medium | Medium | Marketing push. Community engagement. Easy onboarding. |

### 10.4 Mitigation Strategies

**For Import Cycles:**
```go
// Before: Direct dependency
import "github.com/exploop/exploopio/internal/licensing"

// After: Interface in OSS, implementation in EE
// OSS defines interface
type ModuleChecker interface {
    HasModule(ctx context.Context, module string) bool
}

// EE implements
type licensingChecker struct { ... }
func (c *licensingChecker) HasModule(...) bool { ... }
```

**For Breaking Changes:**
```go
// Deprecation policy
// v1.0.0: Feature works normally
// v1.1.0: Feature marked deprecated (logs warning)
// v1.2.0: Feature disabled by default (opt-in flag)
// v2.0.0: Feature removed

// Example
func (s *Service) OldMethod() {
    log.Warn("OldMethod is deprecated, use NewMethod instead")
    s.NewMethod()
}
```

**For License Bypass:**
```go
// Multi-layer protection
// 1. License signature verification (RSA)
// 2. Module gating in middleware
// 3. Feature checks in service layer
// 4. UI gating (defense in depth)
// 5. Telemetry for license violations (opt-in)
```

---

## Appendix A: File Movement Checklist

### OSS Core Files

```
FROM: api/internal/domain/shared/
  TO: openctemio/api/pkg/domain/shared/

FROM: api/internal/domain/user/
  TO: openctemio/api/pkg/domain/user/

FROM: api/internal/domain/tenant/
  TO: openctemio/api/pkg/domain/tenant/

FROM: api/internal/domain/asset/
  TO: openctemio/api/pkg/domain/asset/

FROM: api/internal/domain/finding/
  TO: openctemio/api/pkg/domain/finding/

FROM: api/internal/domain/scan/
  TO: openctemio/api/pkg/domain/scan/

FROM: api/internal/app/auth_service.go
  TO: openctemio/api/pkg/app/auth.go

FROM: api/internal/app/asset_service.go
  TO: openctemio/api/pkg/app/asset.go

FROM: api/internal/infra/postgres/
  TO: openctemio/api/pkg/infra/postgres/

FROM: api/internal/infra/http/middleware/
  TO: openctemio/api/pkg/middleware/
```

### Enterprise Files

```
FROM: api/internal/domain/licensing/
  TO: exploop/pkg/licensing/

FROM: api/internal/domain/role/
  TO: exploop/pkg/rbac/role.go

FROM: api/internal/domain/permission/
  TO: exploop/pkg/rbac/permission.go

FROM: api/internal/domain/audit/
  TO: exploop/pkg/audit/

FROM: api/internal/domain/workflow/
  TO: exploop/pkg/workflow/

FROM: api/internal/domain/aitriage/
  TO: exploop/pkg/aitriage/

FROM: api/internal/app/licensing_service.go
  TO: exploop/pkg/licensing/service.go

FROM: api/internal/app/role_service.go
  TO: exploop/pkg/rbac/service.go
```

### SaaS Files

```
KEEP: api/internal/domain/admin/
  AT: exploopio/internal/platform/admin/

KEEP: api/internal/domain/lease/
  AT: exploopio/internal/platform/lease/

KEEP: api/internal/app/platform_agent_service.go
  AT: exploopio/internal/platform/agent/service.go

KEEP: api/internal/app/admin_service.go
  AT: exploopio/internal/platform/admin/service.go
```

---

## Appendix B: Import Path Changes

```go
// Before (current)
import "github.com/exploopio/api/internal/domain/asset"
import "github.com/exploopio/api/internal/app"
import "github.com/exploopio/sdk/client"

// After (OSS) - using github.com/openctemio/api
import "github.com/openctemio/api/pkg/domain/asset"
import "github.com/openctemio/api/pkg/app"

// After (EE importing OSS)
import (
    // OSS packages
    "github.com/openctemio/api/pkg/domain/asset"
    "github.com/openctemio/api/pkg/domain/finding"
    "github.com/openctemio/api/pkg/domain/scan"
    "github.com/openctemio/api/pkg/app"
    "github.com/openctemio/api/pkg/middleware"

    // EE packages
    "github.com/exploop/exploop/pkg/licensing"
    "github.com/exploop/exploop/pkg/rbac"
    "github.com/exploop/exploop/pkg/audit"
)

// After (SaaS importing both)
import (
    // OSS packages
    "github.com/openctemio/api/pkg/domain/asset"
    "github.com/openctemio/api/pkg/app"

    // EE packages
    "github.com/exploop/exploop/pkg/licensing"
    "github.com/exploop/exploop/pkg/rbac"

    // SaaS internal packages
    "github.com/exploop/exploopio/internal/platform"
    "github.com/exploop/exploopio/internal/platform/billing"
)
```

### Import Alias Convention

```go
import (
    // Use short aliases for frequently used packages
    ctemasset "github.com/openctemio/api/pkg/domain/asset"
    ctemfinding "github.com/openctemio/api/pkg/domain/finding"

    // Or use package-level type exports
    . "github.com/openctemio/api/pkg/domain/shared" // Import shared.ID as ID
)
```

---

## Appendix C: Version Compatibility Matrix

| Openctem | Exploop | Exploopio | Status |
|----------|---------|-----------|--------|
| v1.0.x | v1.0.x | v1.0.x | Initial release |
| v1.1.x | v1.1.x | v1.1.x | Compatible |
| v1.2.x | v1.1.x | - | EE needs update |
| v2.0.x | v2.0.x | v2.0.x | Major version bump |

**Versioning Rules:**
- OSS patch -> EE/SaaS should update (bug fixes)
- OSS minor -> EE/SaaS should update (new features)
- OSS major -> EE/SaaS must update (breaking changes)
- EE can have independent patches for EE-only bugs
- SaaS versioning is continuous (internal)

---

## Appendix D: Codebase Analysis Summary

### D.1 Current Codebase Statistics

| Component | Total | OSS Core | Enterprise | SaaS |
|-----------|-------|----------|------------|------|
| **Migrations** | 153 | 44 (001-044) | ~70 (045-153) | ~32 (058-089) |
| **Domain Packages** | 43 | 26 (~15K LOC) | 10 (~8K LOC) | 8 (~9K LOC) |
| **App Services** | 55+ | 18 core | 8 enterprise | 10 SaaS |
| **UI Features** | 41 | 20 features | 8 features | 7+ features |
| **Agent Modes** | 4 | 3 (one-shot, daemon, standalone) | - | 1 (platform) |
| **SDK Packages** | 28 | 12 extractable | - | 10 agent-specific |

### D.2 Domain Package Classification

#### OSS Core Packages (26 packages, ~15K LOC)
```
Core Security Domain:
├── vulnerability/     6,945 LOC   [Finding, DataFlow, FingerprintStrategy]
├── asset/             3,740 LOC   [Asset, StateHistory, Extensions]
├── scope/             1,172 LOC   [Scope, Tags, CIDR, Expressions]
├── datasource/        1,351 LOC   [AssetSource, FindingSource]
├── integration/       1,208 LOC   [Integration, NotificationExtension]
├── exposure/            947 LOC   [Exposure, StateHistory]
├── scan/                653 LOC   [Scan, ScanStatus]
├── component/           732 LOC   [Component, Dependencies]
├── command/             522 LOC   [Command, CommandStatus]
├── tool/                858 LOC   [Tool, TargetMapping]
├── branch/              550 LOC   [Branch, BranchTypeRules]
├── assettype/           538 LOC   [AssetType, Criticality]
├── assetgroup/          542 LOC   [AssetGroup, GroupType]
├── threatintel/         744 LOC   [ThreatIntel, ConfidenceLevel]
└── rule/                806 LOC   [Rule, Bundle, Override]
```

#### Enterprise Packages (10 packages, ~8K LOC)
```
Access Control & Compliance:
├── licensing/         890 LOC   [Plan, Module, Subscription]
├── accesscontrol/   1,081 LOC   [AssetOwner, GroupPermission, AssignmentRule]
├── role/              381 LOC   [Role, Permission association]
├── permission/        737 LOC   [Permission namespace + action]
├── permissionset/     622 LOC   [PermissionSet, PermissionSetItem]
├── audit/           1,044 LOC   [AuditLog, Action, ResourceType]
├── notification/      810 LOC   [Outbox, Event, SendResult]
├── workflow/        1,072 LOC   [Workflow, Node types, Edge, NodeRun]
├── suppression/       748 LOC   [Suppression rules]
└── sla/               308 LOC   [SLA policies]
```

#### SaaS Packages (8 packages, ~9K LOC)
```
Platform Infrastructure:
├── admin/           1,052 LOC   [AdminUser, AdminRole, AuditLog]
├── tenant/          1,419 LOC   [Tenant, Invitation, Membership, Settings]
├── agent/           2,249 LOC   [Agent, PlatformAgent, BootstrapToken, Tier]
├── lease/             498 LOC   [Lease (K8s-style), LeaseStatus]
├── session/           601 LOC   [Session, RefreshToken]
├── user/              679 LOC   [User, UserStatus]
├── group/             702 LOC   [Group, Member, MemberRole]
└── shared/            164 LOC   [ID type, errors]
```

### D.3 Migration Classification

#### Critical Migration Chains (CANNOT Split)
| Chain | Migrations | Reason |
|-------|------------|--------|
| Notification Outbox | 071-072 | Transactional pattern requires both tables |
| Platform Agents | 080-084 | Bootstrap, leases, registration interdependent |
| Row Level Security | 137-138 | RLS policies + performance indexes |

#### Migration Ranges by Edition
```
CORE (OSS):       000001-000044 (44 migrations)
├── 001-004: Init, users, tenants, assets
├── 005-008: Components, vulnerabilities, findings, exposures
├── 009-031: SCM, tools, pipelines, audit
└── 032-044: Worker metrics, indexes

ENTERPRISE:       000045-000099 + subset of 100+ (70 migrations)
├── 045-052: Access control foundation, RBAC
├── 053-078: Permissions, notifications base
├── 090-091: Workflows
├── 097-100: Quality gates, scanner templates
├── 115-117: Finding activities, suppressions
└── 147: AI triage results

SAAS:             000058-000089 + subset (32 migrations)
├── 058-075: Plans, licensing, notification outbox
├── 080-089: Platform agents, admin, leases
├── 129-130: Integration submodules
└── 148: AI triage licensing
```

### D.4 UI Feature Classification

#### OSS Core Features (20 features)
```
Core:     dashboard, assets, findings, auth, scans, exposures, repositories
Extended: scope, components, tools, scan-profiles, scanner-templates,
          template-sources, credentials, secret-store, capabilities,
          scm-connections, account, tenant, shared
```

#### Enterprise Features (8 features)
```
access-control (29 files), organization (8 files), ai-triage (14 files),
compliance (6 files), crown-jewels (6 files), pentest (15 files),
pipelines (8 files), threat-intel (5 files)
```

#### SaaS Features (7+ features)
```
licensing, platform, agents (platform mode), notifications (advanced),
integrations (enterprise), business-units, identities
```

### D.5 SDK Package Analysis

#### Extractable to OSS SDK (12 packages)
```
pkg/eis/           2,416 LOC   Report format, Finding, Asset types
pkg/core/            851 LOC   Scanner, Collector, Parser interfaces
pkg/shared/          ~200 LOC   Fingerprint, Severity algorithms
pkg/credentials/     934 LOC   Credential management, encryption
pkg/errors/          ~100 LOC   Error types
pkg/health/          646 LOC   K8s health checks
pkg/metrics/         ~150 LOC   Prometheus metrics
pkg/audit/           649 LOC   Audit logging
pkg/connectors/      ~200 LOC   Base connector, rate limiting
pkg/gitenv/          ~200 LOC   CI environment detection
pkg/adapters/        ~700 LOC   SARIF, CycloneDX converters
pkg/options/         ~150 LOC   Functional options pattern
```

#### Agent-Specific (Stay in SDK)
```
pkg/client/        1,407 LOC   Exploop API client
pkg/platform/        863 LOC   Platform agent integration
pkg/retry/           735 LOC   Persistent retry queue
pkg/pipeline/        584 LOC   Async upload pipeline
pkg/scanners/              Tool implementations
pkg/providers/             External collectors
pkg/enrichers/             Threat intel integration
```

#### Critical Sync Points
```
MUST MATCH:
  sdk/pkg/shared/fingerprint/ ↔ api/internal/domain/vulnerability/fingerprint_strategy.go

COORDINATED:
  sdk/pkg/shared/severity/ ↔ api/internal/domain/shared/severity.go
  sdk/pkg/eis/ ↔ api/internal/domain/ (finding schema)
```

---

## Appendix E: Implementation Todo Tasks

### Task Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          IMPLEMENTATION PHASES                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Phase 1: Setup Orgs ──────────────────────────────────────┐                │
│      │                                                      │                │
│      ▼                                                      │                │
│  Phase 2: Move domain to pkg/ ─────────────────────────────┤                │
│      │                                                      │                │
│      ├──► Phase 2b: Extract interfaces                     │                │
│      │                                                      │                │
│      ├──► Phase 3: Split migrations                        │                │
│      │                                                      │                │
│      └──► Phase 7: Extract SDK ────────────────────────────┤                │
│                                                             │                │
│      ┌──────────────────────────────────────────────────────┘                │
│      │                                                                       │
│      ▼                                                                       │
│  Phase 4: Create openctemio/api ───────────────────────────┐                │
│      │                                                      │                │
│      ├──► Phase 4b: Create openctemio/ui ──────────────────┤                │
│      │        │                                             │                │
│      │        └──► Phase 5b: Create exploop/ui             │                │
│      │                                                      │                │
│      ├──► Phase 4c: Create openctemio/agent                │                │
│      │                                                      │                │
│      └──► Phase 5: Create exploop/api ─────────────────────┤                │
│               │                                             │                │
│               ├──► Phase 6: Create exploop/cloud           │                │
│               │                                             │                │
│               └──► Phase 9: License gating                 │                │
│                                                             │                │
│      ┌──────────────────────────────────────────────────────┘                │
│      │                                                                       │
│      ▼                                                                       │
│  Phase 8: Setup CI/CD ─────────────────────────────────────┐                │
│      │                                                      │                │
│      ▼                                                      │                │
│  Phase 10: Documentation                                    │                │
│      │                                                      │                │
│      ▼                                                      │                │
│  Phase 11: Integration Testing ◄────────────────────────────┘                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### E.1 Phase 1: Setup GitHub Organizations

| Task | Description | Status |
|------|-------------|--------|
| 1.1 | Tạo GitHub org `openctemio` | ✅ Done |
| 1.2 | Verify/configure org `exploop` | ✅ Done |
| 1.3 | Setup team structure (Admins, Maintainers, Contributors) | ⬜ Pending |
| 1.4 | Configure org-level settings (branch protection, security policies) | ⬜ Pending |

**Blocked by:** None
**Estimated effort:** 1 day
**Completed:** 2026-02-03

---

### E.2 Phase 2: Migrate API Domain Packages to pkg/

| Task | Description | Status |
|------|-------------|--------|
| 2.1 | Create `api/pkg/` directory structure | ✅ Done |
| 2.2 | Move foundation packages: `shared/`, `errors/` | ✅ Done |
| 2.3 | Move auth packages: `user/`, `tenant/`, `session/`, `refreshtoken/` | ✅ Done |
| 2.4 | Move asset packages: `asset/`, `assetgroup/`, `assettype/`, `component/`, `branch/`, `scope/` | ✅ Done |
| 2.5 | Move security packages: `vulnerability/`, `exposure/`, `credential/`, `scan/`, `scansession/` | ✅ Done |
| 2.6 | Move infrastructure packages: `tool/`, `capability/`, `command/`, `agent/`, `integration/`, `notification/` | ✅ Done |
| 2.7 | Update all import paths | ✅ Done |
| 2.8 | Run tests and fix import cycles | ✅ Done |

**Packages to move (26 total):**
```go
// Order by dependency (move in this order):
1. shared, errors                    // No dependencies
2. user, tenant, session             // Auth foundation
3. asset, assetgroup, assettype      // Asset management
4. component, branch, scope          // Asset related
5. vulnerability, exposure           // Security findings
6. credential, scan, scansession     // Scanning
7. tool, capability, command         // Infrastructure
8. agent, integration, notification  // Services
9. datasource, rule, threatintel     // Data sources
```

**Blocked by:** Phase 1
**Estimated effort:** 1 week
**Completed:** 2026-02-03 (44 packages moved, 403 files updated)

---

### E.3 Phase 2b: Extract Service Interfaces to pkg/app/

| Task | Description | Status |
|------|-------------|--------|
| 2b.1 | Create `api/pkg/app/interfaces.go` | ✅ Done |
| 2b.2 | Extract AuthService, SessionService, UserService interfaces | ✅ Done |
| 2b.3 | Extract TenantService, TenantMemberService interfaces | ✅ Done |
| 2b.4 | Extract AssetService, AssetGroupService, AssetTypeService interfaces | ✅ Done |
| 2b.5 | Extract ScanService, ScanSessionService, CommandService interfaces | ✅ Done |
| 2b.6 | Extract VulnerabilityService, FindingActivityService interfaces | ✅ Done |
| 2b.7 | Extract NotificationService (base) interface | ✅ Done |
| 2b.8 | Move default implementations to `pkg/app/impl/` | ⏭️ Deferred |

**Interface pattern:**
```go
// pkg/app/asset.go
type AssetService interface {
    Create(ctx context.Context, input CreateAssetInput) (*asset.Asset, error)
    Get(ctx context.Context, tenantID, id shared.ID) (*asset.Asset, error)
    List(ctx context.Context, tenantID shared.ID, filter asset.Filter) (*asset.ListResult, error)
    Update(ctx context.Context, input UpdateAssetInput) (*asset.Asset, error)
    Delete(ctx context.Context, tenantID, id shared.ID) error
}
```

**Blocked by:** Phase 2
**Estimated effort:** 3 days
**Completed:** 2026-02-03 (10 interface files created)

---

### E.4 Phase 3: Split Database Migrations by Edition

| Task | Description | Status |
|------|-------------|--------|
| 3.1 | Tag all 153 migrations with edition (core/enterprise/saas) | ✅ Done |
| 3.2 | Create migration directory structure | ✅ Done |
| 3.3 | Create migration classification system | ✅ Done |
| 3.4 | Implement edition-aware migration loader | ✅ Done |
| 3.5 | Implement edition-aware migration runner | ✅ Done |
| 3.6 | Test fresh install for each edition | ⬜ Pending |
| 3.7 | Test upgrade paths (OSS→EE, EE→SaaS) | ⬜ Pending |

**Implementation approach:**
- Used classification system instead of physically moving files
- `pkg/migrations/classification.go` - maps migration versions to editions
- `pkg/migrations/loader.go` - loads migrations filtered by edition
- `pkg/migrations/runner.go` - executes migrations with edition awareness

**Critical chains (keep together):**
- 071-072: Notification outbox + events
- 080-084: Platform agents bundle
- 137-138: RLS + indexes

**Blocked by:** Phase 2
**Estimated effort:** 1 week
**Completed:** 2026-02-03 (99 migrations classified)

---

### E.5 Phase 4: Create openctemio/api Repository

| Task | Description | Status |
|------|-------------|--------|
| 4.1 | Initialize `github.com/openctemio/api` repository | ✅ Done |
| 4.2 | Copy `pkg/domain/` (34 core packages) | ✅ Done |
| 4.3 | Copy `pkg/app/` (10 service interfaces) | ✅ Done |
| 4.4 | Copy utility packages (apierror, jwt, logger, etc.) | ✅ Done |
| 4.5 | Copy pkg/migrations/ (edition-aware system) | ✅ Done |
| 4.6 | Copy core migrations (300 files) | ✅ Done |
| 4.7 | Update import paths to openctemio/api | ✅ Done |
| 4.8 | Create go.mod with `module github.com/openctemio/api` | ✅ Done |
| 4.9 | Add LICENSE (Apache 2.0), CONTRIBUTING.md, README.md | ✅ Done |
| 4.10 | Create .env.example | ✅ Done |
| 4.11 | Create `cmd/server/main.go` entry point | ⬜ Pending |
| 4.12 | Create Dockerfile | ⬜ Pending |

**Blocked by:** Phases 1, 2, 2b, 3
**Estimated effort:** 1 week
**Completed:** 2026-02-03 (local structure created)

---

### E.6 Phase 4b: Create openctemio/ui Repository ✅ COMPLETED

| Task | Description | Status |
|------|-------------|--------|
| 4b.1 | Initialize `github.com/openctemio/ui` repository | ✅ Done |
| 4b.2 | Copy 26 core features to `src/features/` | ✅ Done |
| 4b.3 | Copy shared components to `src/components/` | ✅ Done |
| 4b.4 | Remove ModuleGate/licensing references | ✅ Done (excluded) |
| 4b.5 | Simplify permission model (basic roles only) | ✅ Done |
| 4b.6 | Update API client to point to OSS API | ✅ Done |
| 4b.7 | Setup package.json with `@openctemio/ui` | ✅ Done |
| 4b.8 | Add LICENSE (Apache 2.0), README.md | ✅ Done |
| 4b.9 | Verify build and all features work | ✅ Done (28 checks passed) |

**OSS Features (26):**
```
dashboard, assets, asset-groups, asset-types, findings, auth, scans,
scan-profiles, scanner-templates, exposures, repositories, scope,
components, tools, capabilities, credentials, secret-store,
scm-connections, account, tenant, shared, notifications,
template-sources, integrations, agents, config
```

**Enterprise Features Excluded:**
```
licensing, ai-triage, platform, compliance, business-units, crown-jewels, pentest
```

**Completed:** 2025-02-03
**Repository:** `/home/ubuntu/exploopio/openctemio/ui`

---

### E.7 Phase 4c: Create openctemio/agent Repository ✅ COMPLETED

| Task | Description | Status |
|------|-------------|--------|
| 4c.1 | Initialize `github.com/openctemio/agent` repository | ✅ Done |
| 4c.2 | Copy executor system (Router, ReconExecutor, VulnScanExecutor, SecretsExecutor) | ✅ Done |
| 4c.3 | Copy internal packages (gate, output, tools, config, git) | ✅ Done |
| 4c.4 | Create simplified main.go (without platform mode) | ✅ Done |
| 4c.5 | Keep platform_stub.go as default | ✅ Done |
| 4c.6 | Copy CI templates (github/, gitlab/) | ✅ Done |
| 4c.7 | Update SDK imports to use openctemio/sdk | ✅ Done |
| 4c.8 | Add LICENSE (Apache 2.0), README.md | ✅ Done |
| 4c.9 | Create Dockerfile (5 Dockerfiles) | ✅ Done |
| 4c.10 | Verify build and tests pass | ✅ Done (28 checks passed) |

**OSS Agent modes:**
- One-shot: `agent -tool semgrep -target ./src -push`
- Daemon: `agent -daemon -config agent.yaml`
- Standalone: `agent -standalone`

**Enterprise Features Excluded:**
- platform.go (platform mode for managed agents)

**Files Created:**
- 16 Go files
- 5 Dockerfiles (main, semgrep, trivy, nuclei, gitleaks)
- CI templates for GitHub Actions and GitLab CI

**Completed:** 2025-02-03
**Repository:** `/home/ubuntu/exploopio/openctemio/agent`

---

### E.8 Phase 5: Create exploop/api (Enterprise) Repository ✅ COMPLETED

| Task | Description | Status |
|------|-------------|--------|
| 5.1 | Initialize `github.com/exploop/api` repository | ✅ Done |
| 5.2 | Setup go.mod with openctemio/api dependency | ✅ Done |
| 5.3 | Create enterprise packages in `pkg/` | ✅ Done |
| 5.4 | Create `pkg/licensing/` (license validation service) | ✅ Done |
| 5.5 | Create `pkg/rbac/` (role, permission, permissionset, accesscontrol) | ✅ Done |
| 5.6 | Copy enterprise domain packages (10 packages) | ✅ Done |
| 5.7 | Copy enterprise services (AI triage, workflow, SLA) | ✅ Done |
| 5.8 | Create `pkg/middleware/` (license, module, rbac) | ✅ Done |
| 5.9 | Implement service wrappers (AssetServiceWithRBAC pattern) | ✅ Done |
| 5.10 | Copy enterprise handlers | ✅ Done |
| 5.11 | Copy enterprise migrations (100 files) | ✅ Done |
| 5.12 | Create Helm charts in `helm/` | ⬜ Pending (future) |
| 5.13 | Add LICENSE (Commercial), README.md | ✅ Done |
| 5.14 | Verify build and tests pass | ✅ Done (24 checks passed) |

**Enterprise Domain Packages (10):**
```
licensing, accesscontrol, permissionset, aitriage, workflow,
sla, threatintel, pipeline, admin, lease
```

**Enterprise Services:**
- AI Triage service with validation
- Workflow service
- SLA service
- Licensing service
- RBAC service with permission checking

**Enterprise Middleware:**
- License validation middleware
- Module gating middleware
- RBAC permission middleware

**Files Created:**
- 61 Go files
- 10 enterprise domain packages
- 100 enterprise migrations
- Commercial license

**Completed:** 2025-02-03
**Repository:** `/home/ubuntu/exploopio/exploop/api`

---

### E.9 Phase 5b: Create exploop/ui (Enterprise) Repository ✅ COMPLETED

| Task | Description | Status |
|------|-------------|--------|
| 5b.1 | Initialize `github.com/exploop/ui` repository | ✅ Done |
| 5b.2 | Setup package.json with @openctemio/ui dependency | ✅ Done |
| 5b.3 | Copy 14 enterprise features to `src/features/` | ✅ Done |
| 5b.4 | Add ModuleGate, LicenseGate, RBACGate components | ✅ Done |
| 5b.5 | Add LICENSE (Commercial), README.md | ✅ Done |
| 5b.6 | Verify build and all features work | ✅ Done (20 checks passed) |

**Enterprise Features (14):**
```
access-control, ai-triage, business-units, compliance, crown-jewels,
licensing, organization, pentest, pipelines, platform, threat-intel,
remediation, attack-surface, identities
```

**Enterprise Components:**
- ModuleGate - Feature visibility based on license modules
- LicenseGate - License validation wrapper
- RBACGate - Permission-based access control

**Enterprise Hooks:**
- useLicense - License state management
- useRBAC - Permission checking

**Completed:** 2025-02-03
**Repository:** `/home/ubuntu/exploopio/exploop/ui`

---

### E.10 Phase 6: Create exploop/cloud (SaaS) Repository ✅ COMPLETED

| Task | Description | Status |
|------|-------------|--------|
| 6.1 | Initialize `github.com/exploop/cloud` repository | ✅ Done |
| 6.2 | Setup go.mod with openctemio/* and exploop/api dependencies | ✅ Done |
| 6.3 | Create SaaS packages in `pkg/platform/` | ✅ Done |
| 6.4 | Create `pkg/platform/admin_service.go` | ✅ Done |
| 6.5 | Create `pkg/platform/agent_manager.go` | ✅ Done |
| 6.6 | Create `pkg/platform/job_distributor.go` | ✅ Done |
| 6.7 | Create `internal/platform/billing/` (future) | ⬜ Future |
| 6.8 | Create platform service in `internal/app/` | ✅ Done |
| 6.9 | Copy SaaS migrations (000200-000299) | ⬜ No migrations in range |
| 6.10 | Copy platform handlers and middleware | ✅ Done |
| 6.11 | Copy admin-ui | ✅ Done |
| 6.12 | Copy terraform configurations | ⬜ Future |
| 6.13 | Add LICENSE (Proprietary), README.md | ✅ Done |
| 6.14 | Verify build and tests pass | ✅ Done (25 checks passed) |

**Platform Services:**
- AgentManager - Agent registration and lease management
- JobDistributor - Job assignment to agents
- AdminService - Platform administration
- PlatformService - Orchestration and background tasks

**Platform Handlers:**
- platform_handler.go
- platform_agent_handler.go
- platform_job_handler.go
- platform_register_handler.go

**Platform Middleware:**
- platform_auth.go
- admin_auth.go

**Admin UI:**
- Complete Next.js admin panel
- Tenant management interface
- Agent fleet monitoring

**Files Created:**
- 19 Go files
- 2 SaaS domain packages (admin, lease)
- Admin UI (Next.js)
- Proprietary license

**Completed:** 2025-02-03
**Repository:** `/home/ubuntu/exploopio/exploop/cloud`

---

### E.11 Phase 7: Extract Shared SDK Packages to openctemio/sdk ✅ COMPLETED

| Task | Description | Status |
|------|-------------|--------|
| 7.1 | Initialize `github.com/openctemio/sdk-go` repository | ✅ Done |
| 7.2 | Copy `pkg/eis/` (2416 LOC) - Report format | ✅ Done |
| 7.3 | Copy `pkg/core/` (851 LOC) - Interfaces | ✅ Done |
| 7.4 | Copy `pkg/shared/fingerprint/` - Deduplication | ✅ Done |
| 7.5 | Copy `pkg/shared/severity/` - Severity definitions | ✅ Done |
| 7.6 | Copy `pkg/credentials/` (934 LOC) | ✅ Done |
| 7.7 | Copy `pkg/errors/` - Error types | ✅ Done |
| 7.8 | Copy `pkg/health/` (646 LOC) - K8s health checks | ✅ Done |
| 7.9 | Copy `pkg/metrics/` - Prometheus metrics | ✅ Done |
| 7.10 | Copy `pkg/audit/` (649 LOC) - Audit logging | ✅ Done |
| 7.11 | Copy `pkg/connectors/` - Base connector | ✅ Done |
| 7.12 | Copy `pkg/gitenv/` - CI environment detection | ✅ Done |
| 7.13 | Copy `pkg/adapters/` - SARIF, CycloneDX | ✅ Done |
| 7.14 | Copy `proto/` - gRPC definitions | ✅ Done |
| 7.15 | Add synchronization tests for fingerprint algorithms | ✅ Done |
| 7.16 | Add LICENSE (Apache 2.0), README.md | ✅ Done |
| 7.17 | Verify build and tests pass | ✅ Done (27 checks passed) |

**Files Created:**
- 117 Go files
- 26 packages (client, core, scanners, handler, errors, transport, retry, health, metrics, credentials, connectors, adapters, enrichers, pipeline, etc.)
- Examples directory with 6 examples
- Proto files for gRPC

**Completed:** 2025-02-03
**Repository:** `/home/ubuntu/exploopio/openctemio/sdk`

---

### E.12 Phase 8: Setup CI/CD Pipelines

| Task | Description | Status |
|------|-------------|--------|
| 8.1 | Create `openctemio/.github/` with reusable workflows | ⬜ Pending |
| 8.2 | Create release workflow for openctemio repos | ⬜ Pending |
| 8.3 | Create `exploop/.github/` with reusable workflows | ⬜ Pending |
| 8.4 | Create build workflow for exploop repos | ⬜ Pending |
| 8.5 | Setup dependency update automation (Dependabot/Renovate) | ⬜ Pending |
| 8.6 | Configure Docker registry access (ghcr.io/openctemio/*) | ⬜ Pending |
| 8.7 | Setup npm publishing for @openctemio/* packages | ⬜ Pending |
| 8.8 | Configure staging/production deployment pipelines | ⬜ Pending |
| 8.9 | Setup cross-repo rebuild triggers | ⬜ Pending |

**OSS Release workflow:**
```yaml
on:
  push:
    tags: ['v*']
jobs:
  release:
    - Build binaries
    - Run tests
    - Build Docker images
    - Create GitHub Release
```

**Blocked by:** Phases 4, 4b, 4c, 5, 5b, 6
**Estimated effort:** 1 week

---

### E.13 Phase 9: Implement License and Module Gating System

| Task | Description | Status |
|------|-------------|--------|
| 9.1 | Implement license key generation (RSA-SHA256 signing) | ⬜ Pending |
| 9.2 | Implement license key validation | ⬜ Pending |
| 9.3 | Create RequireLicense middleware | ⬜ Pending |
| 9.4 | Create RequireModule middleware | ⬜ Pending |
| 9.5 | Define module constants | ⬜ Pending |
| 9.6 | Implement frontend ModuleGate component | ⬜ Pending |
| 9.7 | Implement frontend SubscriptionGate component | ⬜ Pending |
| 9.8 | Create UpgradePrompt component | ⬜ Pending |
| 9.9 | Test all gating scenarios | ⬜ Pending |

**Module definitions:**
```go
const (
    ModuleAssets          = "assets"           // Core
    ModuleFindings        = "findings"         // Core
    ModuleScans           = "scans"            // Core
    ModuleAudit           = "audit"            // Enterprise
    ModuleRBAC            = "rbac"             // Enterprise
    ModuleWorkflows       = "workflows"        // Enterprise
    ModuleAITriage        = "ai_triage"        // Enterprise
    ModulePlatformAgents  = "platform_agents"  // SaaS
)
```

**Blocked by:** Phase 5
**Estimated effort:** 1 week

---

### E.14 Phase 10: Create Documentation

| Task | Description | Status |
|------|-------------|--------|
| 10.1 | Initialize `github.com/openctemio/docs` repository | ⬜ Pending |
| 10.2 | Write OSS quick start guide | ⬜ Pending |
| 10.3 | Write installation guide (Docker, K8s, binary) | ⬜ Pending |
| 10.4 | Write configuration reference | ⬜ Pending |
| 10.5 | Generate API documentation (OpenAPI/Swagger) | ⬜ Pending |
| 10.6 | Write CONTRIBUTING.md | ⬜ Pending |
| 10.7 | Write CODE_OF_CONDUCT.md | ⬜ Pending |
| 10.8 | Write SECURITY.md | ⬜ Pending |
| 10.9 | Write Enterprise license activation guide | ⬜ Pending |
| 10.10 | Write Enterprise RBAC configuration guide | ⬜ Pending |
| 10.11 | Write Enterprise Helm chart documentation | ⬜ Pending |
| 10.12 | Write upgrade path documentation (OSS→EE→SaaS) | ⬜ Pending |

**Blocked by:** Phases 4, 4b, 4c
**Estimated effort:** 1 week

---

### E.15 Phase 11: Integration Testing and Validation

| Task | Description | Status |
|------|-------------|--------|
| 11.1 | Test OSS fresh install from docker-compose | ⬜ Pending |
| 11.2 | Test all OSS core features work without license | ⬜ Pending |
| 11.3 | Test OSS agent connects and scans successfully | ⬜ Pending |
| 11.4 | Test Enterprise fresh install with Helm | ⬜ Pending |
| 11.5 | Test Enterprise license activation | ⬜ Pending |
| 11.6 | Test Enterprise RBAC permissions work | ⬜ Pending |
| 11.7 | Test Enterprise imports openctemio packages correctly | ⬜ Pending |
| 11.8 | Test SaaS platform agent registration | ⬜ Pending |
| 11.9 | Test SaaS multi-tenant isolation | ⬜ Pending |
| 11.10 | Test SaaS imports both openctemio + exploop | ⬜ Pending |
| 11.11 | Test OSS → Enterprise upgrade path | ⬜ Pending |
| 11.12 | Test Enterprise → SaaS migration | ⬜ Pending |
| 11.13 | Run performance benchmarks | ⬜ Pending |
| 11.14 | Document known issues | ⬜ Pending |

**Blocked by:** All previous phases
**Estimated effort:** 1 week

---

### E.16 Task Summary

| Phase | Tasks | Blocked By | Est. Effort |
|-------|-------|------------|-------------|
| 1. Setup Orgs | 4 | - | 1 day |
| 2. Move domain to pkg/ | 8 | 1 | 1 week |
| 2b. Extract interfaces | 8 | 2 | 3 days |
| 3. Split migrations | 8 | 2 | 1 week |
| 4. Create openctemio/api | 12 | 1,2,2b,3 | 1 week |
| 4b. Create openctemio/ui | 9 | 4 | 1 week |
| 4c. Create openctemio/agent | 10 | 4,7 | 3 days |
| 5. Create exploop/api | 14 | 4 | 1 week |
| 5b. Create exploop/ui | 6 | 4b,5 | 3 days |
| 6. Create exploop/cloud | 14 | 4,5 | 1 week |
| 7. Extract SDK | 17 | 2 | 3 days |
| 8. Setup CI/CD | 9 | 4-6 | 1 week |
| 9. License gating | 9 | 5 | 1 week |
| 10. Documentation | 12 | 4,4b,4c | 1 week |
| 11. Integration testing | 14 | All | 1 week |
| **Total** | **144 tasks** | | **~10-12 weeks** |

---

## Appendix F: Detailed Service Dependencies

### F.1 Core Services (18 services - OSS)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CORE SERVICE DEPENDENCY MAP                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Authentication Layer:                                                   │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│  │ AuthService  │────▶│ UserService  │────▶│SessionService│            │
│  └──────────────┘     └──────────────┘     └──────────────┘            │
│         │                                          │                     │
│         ▼                                          ▼                     │
│  ┌──────────────┐                         ┌──────────────┐             │
│  │TenantService │                         │RefreshToken  │             │
│  └──────────────┘                         │   Service    │             │
│                                           └──────────────┘             │
│                                                                          │
│  Asset Management Layer:                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│  │ AssetService │────▶│AssetGroup    │────▶│AssetType     │            │
│  └──────────────┘     │   Service    │     │   Service    │            │
│         │             └──────────────┘     └──────────────┘            │
│         ▼                                                                │
│  ┌──────────────┐     ┌──────────────┐                                  │
│  │ ScopeService │     │ComponentSvc  │                                  │
│  └──────────────┘     └──────────────┘                                  │
│                                                                          │
│  Security Layer:                                                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│  │Vulnerability │────▶│FindingActivity│────▶│FindingComment│           │
│  │   Service    │     │   Service    │     │   Service    │            │
│  └──────────────┘     └──────────────┘     └──────────────┘            │
│         │                                                                │
│         ▼                                                                │
│  ┌──────────────┐     ┌──────────────┐                                  │
│  │ExposureService│    │CredentialSvc │                                  │
│  └──────────────┘     └──────────────┘                                  │
│                                                                          │
│  Scanning Layer:                                                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│  │ ScanService  │────▶│ScanSession   │────▶│ CommandSvc   │            │
│  └──────────────┘     │   Service    │     └──────────────┘            │
│         │             └──────────────┘            │                     │
│         ▼                                         ▼                     │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│  │ ToolService  │     │ScanProfile   │     │ AgentService │            │
│  └──────────────┘     │   Service    │     └──────────────┘            │
│                       └──────────────┘                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### F.2 Enterprise Services (8 services - Wrap Core)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   ENTERPRISE SERVICE WRAPPING                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Licensing Layer (Foundation):                                           │
│  ┌──────────────────┐                                                   │
│  │ LicensingService │◄─── Plans, Modules, Subscriptions                 │
│  └────────┬─────────┘                                                   │
│           │                                                              │
│           ▼                                                              │
│  RBAC Layer (Wraps Core):                                               │
│  ┌──────────────────┐     ┌──────────────────┐                         │
│  │   RoleService    │────▶│PermissionService │                         │
│  └────────┬─────────┘     └────────┬─────────┘                         │
│           │                        │                                    │
│           ▼                        ▼                                    │
│  ┌──────────────────────────────────────────────────────┐              │
│  │              AssetServiceWithRBAC                     │              │
│  │  ┌─────────────────────────────────────────────┐     │              │
│  │  │  core: app.AssetService (from openctemio)   │     │              │
│  │  │  rbac: *RBACService                         │     │              │
│  │  │  audit: *AuditService                       │     │              │
│  │  └─────────────────────────────────────────────┘     │              │
│  └──────────────────────────────────────────────────────┘              │
│                                                                          │
│  Compliance Layer:                                                       │
│  ┌──────────────────┐     ┌──────────────────┐                         │
│  │  AuditService    │     │SuppressionService│                         │
│  └──────────────────┘     └──────────────────┘                         │
│                                                                          │
│  Automation Layer:                                                       │
│  ┌──────────────────┐     ┌──────────────────┐                         │
│  │ WorkflowService  │────▶│WorkflowExecutor  │                         │
│  └──────────────────┘     └──────────────────┘                         │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐     ┌──────────────────┐                         │
│  │  SLAService      │     │ AITriageService  │                         │
│  └──────────────────┘     └──────────────────┘                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### F.3 Service Wrapper Implementation Pattern

```go
// exploop/api/pkg/rbac/asset_service_wrapper.go

package rbac

import (
    "context"

    "github.com/openctemio/api/pkg/app"
    "github.com/openctemio/api/pkg/domain/asset"
    "github.com/openctemio/api/pkg/domain/shared"
)

// AssetServiceWithRBAC wraps core AssetService with RBAC and Audit
type AssetServiceWithRBAC struct {
    core    app.AssetService  // OSS service
    rbac    *RBACService      // EE RBAC
    audit   *AuditService     // EE Audit
    license *LicensingService // EE License
}

// Ensure interface compliance
var _ app.AssetService = (*AssetServiceWithRBAC)(nil)

func NewAssetServiceWithRBAC(
    core app.AssetService,
    rbac *RBACService,
    audit *AuditService,
    license *LicensingService,
) *AssetServiceWithRBAC {
    return &AssetServiceWithRBAC{
        core:    core,
        rbac:    rbac,
        audit:   audit,
        license: license,
    }
}

func (s *AssetServiceWithRBAC) Create(ctx context.Context, input app.CreateAssetInput) (*asset.Asset, error) {
    // 1. Check license/module
    if err := s.license.RequireModule(ctx, input.TenantID, "assets"); err != nil {
        return nil, err
    }

    // 2. Check permission
    if err := s.rbac.RequirePermission(ctx, "assets:create"); err != nil {
        return nil, err
    }

    // 3. Check data scope (group-based access)
    if err := s.rbac.RequireGroupAccess(ctx, input.TenantID, input.GroupID); err != nil {
        return nil, err
    }

    // 4. Delegate to core service
    result, err := s.core.Create(ctx, input)
    if err != nil {
        return nil, err
    }

    // 5. Audit log
    s.audit.Log(ctx, AuditEvent{
        Action:     "asset.created",
        ResourceID: result.ID.String(),
        TenantID:   input.TenantID.String(),
        UserID:     shared.UserIDFromContext(ctx).String(),
        Details:    map[string]any{"name": result.Name, "type": result.Type},
    })

    return result, nil
}

func (s *AssetServiceWithRBAC) Get(ctx context.Context, tenantID, id shared.ID) (*asset.Asset, error) {
    // 1. Check permission
    if err := s.rbac.RequirePermission(ctx, "assets:read"); err != nil {
        return nil, err
    }

    // 2. Delegate to core
    result, err := s.core.Get(ctx, tenantID, id)
    if err != nil {
        return nil, err
    }

    // 3. Check data scope
    if err := s.rbac.RequireGroupAccess(ctx, tenantID, result.GroupID); err != nil {
        return nil, shared.ErrNotFound // Hide existence
    }

    return result, nil
}

func (s *AssetServiceWithRBAC) List(ctx context.Context, tenantID shared.ID, filter asset.Filter) (*asset.ListResult, error) {
    // 1. Check permission
    if err := s.rbac.RequirePermission(ctx, "assets:read"); err != nil {
        return nil, err
    }

    // 2. Apply data scope filter
    scopedFilter := s.rbac.ApplyGroupFilter(ctx, tenantID, filter)

    // 3. Delegate to core
    return s.core.List(ctx, tenantID, scopedFilter)
}

func (s *AssetServiceWithRBAC) Update(ctx context.Context, input app.UpdateAssetInput) (*asset.Asset, error) {
    // 1. Check permission
    if err := s.rbac.RequirePermission(ctx, "assets:update"); err != nil {
        return nil, err
    }

    // 2. Get existing to check data scope
    existing, err := s.core.Get(ctx, input.TenantID, input.ID)
    if err != nil {
        return nil, err
    }

    // 3. Check data scope
    if err := s.rbac.RequireGroupAccess(ctx, input.TenantID, existing.GroupID); err != nil {
        return nil, shared.ErrForbidden
    }

    // 4. Delegate to core
    result, err := s.core.Update(ctx, input)
    if err != nil {
        return nil, err
    }

    // 5. Audit log
    s.audit.Log(ctx, AuditEvent{
        Action:     "asset.updated",
        ResourceID: result.ID.String(),
        TenantID:   input.TenantID.String(),
        Changes:    diff(existing, result),
    })

    return result, nil
}

func (s *AssetServiceWithRBAC) Delete(ctx context.Context, tenantID, id shared.ID) error {
    // 1. Check permission
    if err := s.rbac.RequirePermission(ctx, "assets:delete"); err != nil {
        return err
    }

    // 2. Get existing to check data scope
    existing, err := s.core.Get(ctx, tenantID, id)
    if err != nil {
        return err
    }

    // 3. Check data scope
    if err := s.rbac.RequireGroupAccess(ctx, tenantID, existing.GroupID); err != nil {
        return shared.ErrForbidden
    }

    // 4. Delegate to core
    if err := s.core.Delete(ctx, tenantID, id); err != nil {
        return err
    }

    // 5. Audit log
    s.audit.Log(ctx, AuditEvent{
        Action:     "asset.deleted",
        ResourceID: id.String(),
        TenantID:   tenantID.String(),
    })

    return nil
}
```

---

## Appendix G: Detailed Migration File Listing

### G.1 Core Migrations (OSS) - 44 files

| # | File | Purpose | Tables Created |
|---|------|---------|----------------|
| 001 | `init_extensions.sql` | PostgreSQL extensions | - |
| 002 | `users_auth.sql` | User authentication | users, sessions, refresh_tokens |
| 003 | `tenants.sql` | Multi-tenancy | tenants, tenant_members, invitations |
| 004 | `assets.sql` | Asset management | assets, repositories, branches |
| 005 | `components.sql` | SBOM/Dependencies | components, component_dependencies |
| 006 | `vulnerabilities.sql` | CVE catalog | vulnerabilities, cve_references |
| 007 | `findings.sql` | Security findings | findings, finding_tags |
| 008 | `exposures.sql` | Attack surface | exposures, exposure_events |
| 009 | `scm_connections.sql` | SCM integrations | scm_connections |
| 010 | `asset_groups.sql` | Asset grouping | asset_groups, asset_group_members |
| 011 | `scope_config.sql` | Scope settings | scopes, scope_tags, scope_cidrs |
| 012 | `asset_types.sql` | Asset taxonomy | asset_types |
| 013 | `data_sources.sql` | Data connectors | data_sources |
| 014 | `agents.sql` | Scanner agents | agents, agent_api_keys |
| 015 | `commands.sql` | Job queue | commands, command_results |
| 016 | `pipelines.sql` | Scan pipelines | pipelines, pipeline_runs, pipeline_steps |
| 017 | `audit_logs.sql` | Basic audit | audit_logs |
| 018-021 | `*_fixes.sql` | Schema fixes | - |
| 022 | `scan_profiles.sql` | Scan presets | scan_profiles |
| 023 | `tools.sql` | Scanner tools | tools, tool_configs |
| 024-027 | `scan_*.sql` | Scan management | scans, scan_sessions |
| 028-031 | `tools_*.sql` | Tool enhancements | tool_categories, tool_capabilities |
| 032-044 | `*_indexes.sql` | Performance indexes | - |

### G.2 Enterprise Migrations - 70 files

| Range | Purpose | Key Tables |
|-------|---------|------------|
| 045-052 | Access Control Foundation | groups, roles, permissions, user_roles, permission_sets |
| 053-064 | Permissions & RBAC | role_permissions, group_permissions, asset_owners |
| 065-078 | Permission Refinements | permission_versions, access_rules |
| 090-091 | Workflows | workflows, workflow_nodes, workflow_edges, workflow_runs |
| 097-100 | Quality Gates | quality_gates, quality_gate_results, scanner_templates |
| 115-117 | Finding Management | finding_activities, suppression_rules, suppressions |
| 127-128 | Advanced Findings | finding_data_flows, finding_specialized |
| 147 | AI Triage | ai_triage_results, ai_triage_history |

### G.3 SaaS Migrations - 32 files

| Range | Purpose | Key Tables |
|-------|---------|------------|
| 058-069 | Licensing | plans, modules, plan_modules, tenant_subscriptions |
| 070-075 | Notifications | notification_outbox, notification_events, event_types |
| 080-084 | Platform Agents | platform_agents, bootstrap_tokens, agent_registrations, agent_leases |
| 085-089 | Admin & Security | admin_users, admin_audit_logs, security_policies |
| 129-130 | Integrations | integration_submodules |
| 148 | AI Licensing | ai_triage_modules, ai_triage_limits |

---

## Appendix H: Repository Checklist

### H.1 openctemio/api Checklist

```
Repository Setup:
[ ] Create GitHub repository
[ ] Add LICENSE (Apache 2.0)
[ ] Add README.md with badges
[ ] Add CONTRIBUTING.md
[ ] Add CODE_OF_CONDUCT.md
[ ] Add SECURITY.md
[ ] Setup branch protection rules
[ ] Add issue templates
[ ] Add PR templates

Code Structure:
[ ] pkg/domain/ - 26 packages
[ ] pkg/app/ - 18 service interfaces
[ ] pkg/app/impl/ - Default implementations
[ ] pkg/infra/postgres/ - PostgreSQL repos
[ ] pkg/infra/redis/ - Redis cache
[ ] pkg/infra/http/ - HTTP utilities
[ ] pkg/middleware/ - HTTP middleware
[ ] pkg/config/ - Configuration
[ ] internal/server/ - OSS DI & routes
[ ] cmd/server/main.go - Entry point
[ ] migrations/core/ - 44 migrations

CI/CD:
[ ] .github/workflows/ci.yml - Tests & linting
[ ] .github/workflows/release.yml - Release automation
[ ] Dockerfile - Multi-stage build
[ ] docker-compose.yml - Local development
[ ] Makefile - Build commands

Documentation:
[ ] docs/api.md - API reference
[ ] docs/configuration.md - Config guide
[ ] docs/deployment.md - Deployment guide
```

### H.2 openctemio/ui Checklist

```
Repository Setup:
[ ] Create GitHub repository
[ ] Add LICENSE (Apache 2.0)
[ ] Add README.md
[ ] Setup branch protection

Code Structure:
[ ] src/features/ - 20 core features
[ ] src/components/ - Shared components
[ ] src/lib/ - Utilities
[ ] src/hooks/ - Custom hooks
[ ] src/api/ - API client
[ ] src/types/ - TypeScript types
[ ] public/ - Static assets

CI/CD:
[ ] .github/workflows/ci.yml
[ ] .github/workflows/release.yml
[ ] Dockerfile
[ ] .npmrc - npm config

Package:
[ ] package.json - @openctemio/ui
[ ] tsconfig.json
[ ] vite.config.ts (or next.config.js)
```

### H.3 openctemio/agent Checklist

```
Repository Setup:
[ ] Create GitHub repository
[ ] Add LICENSE (Apache 2.0)
[ ] Add README.md

Code Structure:
[ ] pkg/executor/ - Job executors
[ ] pkg/scanner/ - Scanner interfaces
[ ] pkg/client/ - API client (simplified)
[ ] internal/gate/ - Security gate
[ ] internal/output/ - Formatters
[ ] internal/tools/ - Tool management
[ ] cmd/agent/main.go - Entry point
[ ] ci/github/ - GitHub Actions templates
[ ] ci/gitlab/ - GitLab CI templates

CI/CD:
[ ] .github/workflows/ci.yml
[ ] .github/workflows/release.yml
[ ] Dockerfile - Multi-tool image
[ ] Makefile
```

### H.4 exploop/api Checklist

```
Repository Setup:
[ ] Create GitHub repository
[ ] Add LICENSE (Commercial)
[ ] Add README.md

Code Structure:
[ ] pkg/licensing/ - License management
[ ] pkg/rbac/ - Role, Permission, PermissionSet, AccessControl
[ ] pkg/audit/ - Audit logging
[ ] pkg/workflow/ - Workflow automation
[ ] pkg/middleware/ - EE middleware
[ ] internal/server/ - EE DI & routes
[ ] cmd/server/main.go
[ ] migrations/enterprise/

Deployment:
[ ] helm/exploop/ - Helm chart
[ ] helm/exploop/values.yaml
[ ] helm/exploop/templates/

CI/CD:
[ ] .github/workflows/ci.yml
[ ] .github/workflows/build.yml
[ ] Dockerfile
```

### H.5 exploop/cloud Checklist

```
Repository Setup:
[ ] Create GitHub repository
[ ] Add LICENSE (Proprietary)
[ ] Add README.md

Code Structure:
[ ] internal/platform/admin/
[ ] internal/platform/agent/
[ ] internal/platform/lease/
[ ] internal/platform/billing/
[ ] internal/server/
[ ] cmd/api/main.go
[ ] cmd/admin/main.go
[ ] migrations/saas/
[ ] ui/ - SaaS features
[ ] admin-ui/ - Admin portal

Infrastructure:
[ ] terraform/modules/
[ ] terraform/environments/
[ ] k8s/ - Kubernetes manifests

CI/CD:
[ ] .github/workflows/
[ ] Dockerfile
[ ] docker-compose.yml
```

---

## Appendix I: Risk Mitigation Checklist

### I.1 Technical Risks

| Risk | Mitigation | Status |
|------|------------|--------|
| Import cycles after split | Map dependencies before moving; use interfaces | ⬜ |
| Migration incompatibility | Test upgrade paths; keep additive-only rule | ⬜ |
| Performance regression | Benchmark before/after; profile composition | ⬜ |
| Breaking changes in OSS | Semantic versioning; deprecation policy | ⬜ |
| License bypass | Server-side enforcement; signed license keys | ⬜ |
| Fingerprint algorithm mismatch | Shared test cases between SDK and API | ⬜ |

### I.2 Operational Risks

| Risk | Mitigation | Status |
|------|------------|--------|
| Sync overhead (multi-repo) | Automate dependency updates; clear release process | ⬜ |
| Feature drift between editions | Shared roadmap; feature parity reviews | ⬜ |
| Support complexity | Clear edition ID in logs; separate support channels | ⬜ |
| Security vulnerability in OSS | Rapid patch process; security policy; bug bounty | ⬜ |

### I.3 Pre-Launch Checklist

```
Before OSS Launch:
[ ] All core features work without license
[ ] Documentation complete
[ ] Security audit passed
[ ] Performance benchmarks acceptable
[ ] CI/CD pipelines green
[ ] Docker images published
[ ] GitHub releases created

Before EE Launch:
[ ] License system tested
[ ] RBAC fully functional
[ ] Audit logging verified
[ ] Helm chart tested
[ ] Upgrade from OSS tested

Before SaaS Migration:
[ ] Platform agents working
[ ] Multi-tenant isolation verified
[ ] Admin portal functional
[ ] Billing integration tested
[ ] All migrations applied successfully
```

---

## Appendix J: Feature & Module Classification Matrix

### J.1 OSS Core Features (21 modules)

| Module | Package | API Endpoints | UI Components | Description |
|--------|---------|---------------|---------------|-------------|
| **Authentication** | `pkg/domain/auth` | `/api/v1/auth/*` | `pages/login`, `pages/register` | Basic auth, JWT tokens, sessions |
| **User Management** | `pkg/domain/user` | `/api/v1/users/*` | `components/user/*` | User CRUD (single org) |
| **Tenant Core** | `pkg/domain/tenant` | `/api/v1/tenants/*` | `pages/tenant-settings` | Single tenant management |
| **Basic Roles** | `pkg/domain/role` | `/api/v1/roles/*` | `pages/admin/roles/*` | Predefined roles (Admin, Manager, Analyst, Viewer) |
| **Basic Permissions** | `pkg/domain/permission` | `/api/v1/permissions/*` | `components/permissions/*` | Core permission definitions |
| **Access Control** | `pkg/rbac/*` | Middleware | `hooks/usePermissions` | Basic permission enforcement |
| **Assets** | `pkg/domain/asset` | `/api/v1/assets/*` | `pages/assets/*` | Asset discovery, inventory |
| **Asset Groups** | `pkg/domain/assetgroup` | `/api/v1/asset-groups/*` | `components/asset-groups/*` | Logical asset grouping |
| **Asset Types** | `pkg/domain/assettype` | `/api/v1/asset-types/*` | `components/asset-types/*` | Asset categorization |
| **Scopes** | `pkg/domain/scope` | `/api/v1/scopes/*` | `pages/scopes/*` | Scan scope definition |
| **Findings** | `pkg/domain/finding` | `/api/v1/findings/*` | `pages/findings/*` | Vulnerability findings |
| **Vulnerabilities** | `pkg/domain/vulnerability` | `/api/v1/vulnerabilities/*` | `pages/vulnerabilities/*` | CVE/vulnerability DB |
| **Exposures** | `pkg/domain/exposure` | `/api/v1/exposures/*` | `pages/exposures/*` | Attack surface exposures |
| **Credentials** | `pkg/domain/credential` | `/api/v1/credentials/*` | `pages/credentials/*` | Credential storage |
| **Scans** | `pkg/domain/scan` | `/api/v1/scans/*` | `pages/scans/*` | Scan execution |
| **Scan Sessions** | `pkg/domain/scansession` | `/api/v1/scan-sessions/*` | `components/scan-sessions/*` | Scan session tracking |
| **Scan Profiles** | `pkg/domain/scanprofile` | `/api/v1/scan-profiles/*` | `pages/scan-profiles/*` | Scan configuration |
| **Tools** | `pkg/domain/tool` | `/api/v1/tools/*` | `pages/tools/*` | Security tool management |
| **Commands** | `pkg/domain/command` | `/api/v1/commands/*` | `components/commands/*` | Tool command definitions |
| **Agents** | `pkg/domain/agent` | `/api/v1/agents/*` | `pages/agents/*` | Scan agent management |
| **Components** | `pkg/domain/component` | `/api/v1/components/*` | `components/sbom/*` | Software components (SBOM) |

### J.2 Enterprise Features (11 modules) - Extends OSS Core

| Module | Package | API Endpoints | UI Components | Description |
|--------|---------|---------------|---------------|-------------|
| **Custom Roles** | `pkg/domain/role` | `/api/v1/roles/*` | `pages/admin/roles/*` | Create/edit custom roles (extends OSS predefined roles) |
| **Permission Sets** | `pkg/domain/permissionset` | `/api/v1/permission-sets/*` | `components/permission-sets/*` | Grouped permissions for easier management |
| **Fine-grained Permissions** | `pkg/rbac/*` | Middleware | `hooks/usePermissions` | Resource-level, field-level permissions |
| **Audit Logging** | `pkg/domain/auditlog` | `/api/v1/audit-logs/*` | `pages/admin/audit/*` | Activity audit trail with search/export |
| **Licensing** | `pkg/licensing/*` | `/api/v1/license/*` | `pages/admin/license/*` | License validation & module gating |
| **Workflows** | `pkg/domain/workflow` | `/api/v1/workflows/*` | `pages/workflows/*` | Automation workflows |
| **SLA Management** | `pkg/domain/sla` | `/api/v1/sla/*` | `pages/sla/*` | SLA tracking, violations |
| **AI Triage** | `pkg/domain/aitriage` | `/api/v1/ai-triage/*` | `components/ai-triage/*` | AI vulnerability triage |
| **Suppressions** | `pkg/domain/suppression` | `/api/v1/suppressions/*` | `components/suppressions/*` | Finding suppressions with approval workflow |
| **SSO Integration** | `pkg/domain/sso` | `/api/v1/sso/*` | `pages/admin/sso/*` | SAML/OIDC SSO |
| **Notifications** | `pkg/domain/notification` | `/api/v1/notifications/*` | `components/notifications/*` | Email/Slack/Webhook |
| **Integrations** | `pkg/domain/integration` | `/api/v1/integrations/*` | `pages/integrations/*` | Jira, GitHub, etc. |

### J.3 SaaS Features (10 modules)

| Module | Package | API Endpoints | UI Components | Description |
|--------|---------|---------------|---------------|-------------|
| **Multi-Tenancy** | `internal/platform/tenant` | `/api/v1/platform/tenants/*` | `admin-ui/tenants/*` | Multi-org management |
| **Platform Agents** | `internal/platform/agent` | `/api/v1/platform/agents/*` | `admin-ui/agents/*` | Shared scan agents |
| **Agent Leases** | `internal/platform/lease` | `/api/v1/leases/*` | `components/leases/*` | Agent scheduling |
| **Billing** | `internal/platform/billing` | `/api/v1/billing/*` | `pages/billing/*` | Subscription, payments |
| **Plans** | `internal/platform/plan` | `/api/v1/plans/*` | `admin-ui/plans/*` | Pricing plans |
| **Usage Metering** | `internal/platform/metering` | `/api/v1/usage/*` | `pages/usage/*` | Resource usage tracking |
| **Admin Portal** | `internal/admin/*` | `/admin/api/*` | `admin-ui/*` | Platform administration |
| **Onboarding** | `internal/platform/onboarding` | `/api/v1/onboarding/*` | `pages/onboarding/*` | Tenant setup wizard |
| **Tenant Isolation** | `internal/platform/rls` | N/A (DB level) | N/A | Row-level security |
| **Analytics** | `internal/platform/analytics` | `/api/v1/analytics/*` | `pages/analytics/*` | Platform metrics |

### J.4 Feature Comparison Matrix

| Feature | OSS Core | Enterprise | SaaS |
|---------|:--------:|:----------:|:----:|
| **Authentication** |
| Local auth (email/password) | ✅ | ✅ | ✅ |
| JWT tokens | ✅ | ✅ | ✅ |
| SSO (SAML/OIDC) | ❌ | ✅ | ✅ |
| MFA | ❌ | ✅ | ✅ |
| **Authorization** |
| Basic tenant isolation | ✅ | ✅ | ✅ |
| Predefined roles (Admin, Manager, Analyst, Viewer) | ✅ | ✅ | ✅ |
| Basic permission enforcement | ✅ | ✅ | ✅ |
| User-role assignment | ✅ | ✅ | ✅ |
| Custom roles (create/edit) | ❌ | ✅ | ✅ |
| Permission sets | ❌ | ✅ | ✅ |
| Fine-grained permissions (resource/field level) | ❌ | ✅ | ✅ |
| Row-level security | ❌ | ❌ | ✅ |
| **Asset Management** |
| Asset discovery | ✅ | ✅ | ✅ |
| Asset groups | ✅ | ✅ | ✅ |
| Asset types | ✅ | ✅ | ✅ |
| SBOM management | ✅ | ✅ | ✅ |
| **Vulnerability Management** |
| Finding management | ✅ | ✅ | ✅ |
| Vulnerability database | ✅ | ✅ | ✅ |
| Exposure tracking | ✅ | ✅ | ✅ |
| AI-powered triage | ❌ | ✅ | ✅ |
| SLA management | ❌ | ✅ | ✅ |
| Finding suppressions | ❌ | ✅ | ✅ |
| **Scanning** |
| Scan execution | ✅ | ✅ | ✅ |
| Scan profiles | ✅ | ✅ | ✅ |
| Scan scheduling | ✅ | ✅ | ✅ |
| Self-hosted agents | ✅ | ✅ | ✅ |
| Shared platform agents | ❌ | ❌ | ✅ |
| Agent lease scheduling | ❌ | ❌ | ✅ |
| **Automation** |
| Webhooks | ✅ | ✅ | ✅ |
| Workflow automation | ❌ | ✅ | ✅ |
| Custom notifications | ❌ | ✅ | ✅ |
| **Integrations** |
| REST API | ✅ | ✅ | ✅ |
| Go SDK | ✅ | ✅ | ✅ |
| Jira integration | ❌ | ✅ | ✅ |
| GitHub/GitLab integration | ❌ | ✅ | ✅ |
| Slack integration | ❌ | ✅ | ✅ |
| **Compliance** |
| Audit logging | ❌ | ✅ | ✅ |
| Compliance reports | ❌ | ✅ | ✅ |
| Data retention policies | ❌ | ❌ | ✅ |
| **Deployment** |
| Docker Compose | ✅ | ❌ | ❌ |
| Helm Chart | ❌ | ✅ | ❌ |
| Managed Cloud | ❌ | ❌ | ✅ |
| **Support** |
| Community support | ✅ | ✅ | ✅ |
| Email support | ❌ | ✅ | ✅ |
| Priority support | ❌ | ❌ | ✅ |
| SLA guarantee | ❌ | ❌ | ✅ |

### J.5 Tiered RBAC Model

**Rationale:** Basic RBAC is essential for any security tool. OSS users need access control out-of-the-box, while Enterprise adds advanced customization.

#### OSS Core - Predefined Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| **Admin** | Full system access | All permissions |
| **Manager** | Team management, reports | Read/Write assets, findings, scans; Manage users; View reports |
| **Analyst** | Day-to-day operations | Read/Write assets, findings; Execute scans; Add comments |
| **Viewer** | Read-only access | Read assets, findings, scans, reports |

```go
// pkg/domain/role/predefined.go

var PredefinedRoles = []Role{
    {
        Slug:        "admin",
        Name:        "Administrator",
        Description: "Full system access",
        IsSystem:    true,
        IsDefault:   false,
        Permissions: AllPermissions(),
    },
    {
        Slug:        "manager",
        Name:        "Manager",
        Description: "Team management and reporting",
        IsSystem:    true,
        IsDefault:   false,
        Permissions: ManagerPermissions(),
    },
    {
        Slug:        "analyst",
        Name:        "Analyst",
        Description: "Security operations",
        IsSystem:    true,
        IsDefault:   true, // Default role for new users
        Permissions: AnalystPermissions(),
    },
    {
        Slug:        "viewer",
        Name:        "Viewer",
        Description: "Read-only access",
        IsSystem:    true,
        IsDefault:   false,
        Permissions: ViewerPermissions(),
    },
}
```

#### OSS Core - Permission Structure

```go
// pkg/domain/permission/permissions.go

type Permission struct {
    Resource string // e.g., "assets", "findings", "scans"
    Action   string // e.g., "read", "write", "delete", "execute"
}

var CorePermissions = []Permission{
    // Assets
    {"assets", "read"},
    {"assets", "write"},
    {"assets", "delete"},

    // Findings
    {"findings", "read"},
    {"findings", "write"},
    {"findings", "delete"},
    {"findings", "assign"},

    // Scans
    {"scans", "read"},
    {"scans", "write"},
    {"scans", "execute"},
    {"scans", "delete"},

    // Users (admin only)
    {"users", "read"},
    {"users", "write"},
    {"users", "delete"},

    // Settings
    {"settings", "read"},
    {"settings", "write"},
}
```

#### Enterprise - Extended RBAC

| Feature | Description |
|---------|-------------|
| **Custom Roles** | Create roles with specific permission combinations |
| **Permission Sets** | Group related permissions for easier assignment |
| **Fine-grained Permissions** | Resource-level (`assets:123`) and field-level access |
| **Role Inheritance** | Roles can inherit from other roles |
| **Temporary Roles** | Time-limited role assignments |

```go
// exploop/api/pkg/rbac/custom_role.go

type CustomRole struct {
    Role

    // Enterprise-only fields
    IsCustom       bool           `json:"is_custom"`
    CreatedBy      uuid.UUID      `json:"created_by"`
    InheritsFrom   *uuid.UUID     `json:"inherits_from,omitempty"`
    PermissionSets []uuid.UUID    `json:"permission_sets"`
    Conditions     []RoleCondition `json:"conditions,omitempty"`
}

type RoleCondition struct {
    Field    string `json:"field"`    // e.g., "asset.criticality"
    Operator string `json:"operator"` // e.g., "equals", "in"
    Value    any    `json:"value"`    // e.g., "high", ["high", "critical"]
}
```

#### RBAC Comparison Summary

| Capability | OSS Core | Enterprise |
|------------|:--------:|:----------:|
| Predefined roles (4 roles) | ✅ | ✅ |
| Assign users to roles | ✅ | ✅ |
| Permission enforcement middleware | ✅ | ✅ |
| View role permissions | ✅ | ✅ |
| Create custom roles | ❌ | ✅ |
| Edit role permissions | ❌ | ✅ |
| Permission sets | ❌ | ✅ |
| Role inheritance | ❌ | ✅ |
| Resource-level permissions | ❌ | ✅ |
| Field-level permissions | ❌ | ✅ |
| Temporary role assignments | ❌ | ✅ |
| Audit log for RBAC changes | ❌ | ✅ |

---

## Appendix K: Optimized Migration Structure for Fresh Install

### K.1 Migration Optimization Overview

**Current State:**
- 150 migration files (scattered across features)
- Many ALTER TABLE operations for same table
- Example: `findings` table has 16 separate migration files

**Optimized State:**
- 53 consolidated migration files (~65% reduction)
- Each table defined in single file with all columns
- Clear edition separation: core → enterprise → saas

### K.2 Numbering Convention

```
001-029: OSS Core migrations     (29 files - includes basic RBAC)
050-065: Enterprise migrations   (16 files - extends core RBAC)
080-091: SaaS migrations         (12 files)
```

Gap numbering allows future insertions without renumbering.

### K.3 OSS Core Migrations (migrations/core/)

| File | Table(s) | Columns/Purpose |
|------|----------|-----------------|
| `001_extensions.sql` | - | uuid-ossp, pgcrypto, pg_trgm extensions |
| `002_enums.sql` | - | All enum types (finding_type, finding_severity, finding_status, scan_status, etc.) |
| `003_tenants.sql` | tenants | id, name, slug, domain, settings, logo_url, timezone, created_at, updated_at |
| `004_users.sql` | users | id, tenant_id, email, password_hash, name, avatar_url, is_active, last_login_at, created_at, updated_at |
| `005_sessions.sql` | sessions, refresh_tokens | Session management tables |
| `006_api_keys.sql` | api_keys | id, tenant_id, user_id, name, key_hash, prefix, scopes, expires_at, last_used_at |
| `007_asset_types.sql` | asset_types | id, tenant_id, name, slug, icon, color, metadata_schema, parent_id |
| `008_asset_groups.sql` | asset_groups | id, tenant_id, name, description, parent_id, path (ltree), metadata |
| `009_assets.sql` | assets | id, tenant_id, type_id, group_id, name, identifier, description, status, criticality, metadata, tags, first_seen_at, last_seen_at |
| `010_asset_relationships.sql` | asset_relationships | id, source_asset_id, target_asset_id, relationship_type |
| `011_scopes.sql` | scopes | id, tenant_id, name, description, targets (JSONB), exclusions (JSONB), is_active |
| `012_vulnerabilities.sql` | vulnerabilities | id, cve_id, title, description, severity, cvss_score, cvss_vector, cwe_ids, references, published_at |
| `013_findings.sql` | findings | id, tenant_id, asset_id, vulnerability_id, title, description, fingerprint, finding_type, severity, status, cvss_score, evidence (JSONB), remediation, first_seen_at, last_seen_at, resolved_at, sla_due_at, assigned_to |
| `014_finding_activities.sql` | finding_activities | id, finding_id, user_id, activity_type, old_value, new_value, comment |
| `015_finding_comments.sql` | finding_comments | id, finding_id, user_id, content, parent_id |
| `016_exposures.sql` | exposures | id, tenant_id, asset_id, exposure_type, title, description, severity, status, detected_at, resolved_at |
| `017_credentials.sql` | credentials | id, tenant_id, name, credential_type, data (encrypted JSONB), description |
| `018_tools.sql` | tools | id, name, slug, description, version, tool_type, config_schema, is_builtin |
| `019_commands.sql` | commands | id, tool_id, name, slug, description, command_template, args_schema, output_parser |
| `020_scan_profiles.sql` | scan_profiles | id, tenant_id, name, description, tool_configs (JSONB), schedule_cron, is_default |
| `021_scans.sql` | scans | id, tenant_id, scope_id, profile_id, name, status, started_at, completed_at, findings_count, error_message |
| `022_scan_sessions.sql` | scan_sessions | id, scan_id, agent_id, command_id, status, started_at, completed_at, output, error |
| `023_agents.sql` | agents | id, tenant_id, name, agent_type, status, version, capabilities, last_heartbeat_at, config |
| `024_components.sql` | components, asset_components | Software components (SBOM), purl, licenses |
| `025_roles.sql` | roles | id, tenant_id, name, slug, description, is_system, is_default, created_at |
| `026_permissions.sql` | permissions | id, resource, action, description, is_system |
| `027_role_permissions.sql` | role_permissions | role_id, permission_id mapping |
| `028_user_roles.sql` | user_roles | user_id, role_id, assigned_by, assigned_at |
| `029_seed_roles.sql` | - | Seed predefined roles: Admin, Manager, Analyst, Viewer |

### K.4 OSS Core Consolidated Table: findings

```sql
-- migrations/core/013_findings.sql

CREATE TABLE findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    vulnerability_id UUID REFERENCES vulnerabilities(id) ON DELETE SET NULL,

    -- Core identification
    title VARCHAR(500) NOT NULL,
    description TEXT,
    fingerprint VARCHAR(512) NOT NULL,

    -- Classification
    finding_type finding_type NOT NULL DEFAULT 'vulnerability',
    severity finding_severity NOT NULL DEFAULT 'unknown',
    status finding_status NOT NULL DEFAULT 'open',

    -- Scoring
    cvss_score DECIMAL(3,1),
    cvss_vector VARCHAR(200),
    epss_score DECIMAL(5,4),

    -- Evidence & Remediation
    evidence JSONB DEFAULT '{}',
    remediation TEXT,
    affected_component VARCHAR(500),
    affected_version VARCHAR(100),

    -- Timestamps
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,

    -- SLA (Core - basic support)
    sla_due_at TIMESTAMP WITH TIME ZONE,

    -- Assignment
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Metadata
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    source VARCHAR(100),
    source_id VARCHAR(500),

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Constraints
    CONSTRAINT findings_tenant_fingerprint_unique UNIQUE (tenant_id, fingerprint)
);

-- Indexes for performance
CREATE INDEX idx_findings_tenant_id ON findings(tenant_id);
CREATE INDEX idx_findings_asset_id ON findings(asset_id);
CREATE INDEX idx_findings_status ON findings(status);
CREATE INDEX idx_findings_severity ON findings(severity);
CREATE INDEX idx_findings_fingerprint ON findings(fingerprint);
CREATE INDEX idx_findings_finding_type ON findings(finding_type);
CREATE INDEX idx_findings_first_seen_at ON findings(first_seen_at);
CREATE INDEX idx_findings_sla_due_at ON findings(sla_due_at) WHERE status = 'open';
CREATE INDEX idx_findings_assigned_to ON findings(assigned_to) WHERE assigned_to IS NOT NULL;

-- Full-text search
CREATE INDEX idx_findings_title_search ON findings USING gin(to_tsvector('english', title));

-- Trigger for updated_at
CREATE TRIGGER findings_updated_at
    BEFORE UPDATE ON findings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### K.5 Enterprise Migrations (migrations/enterprise/)

| File | Table(s) | Purpose |
|------|----------|---------|
| `050_roles_extend.sql` | roles | Add: is_custom, created_by, permissions (JSONB) - extends core roles table |
| `051_permission_sets.sql` | permission_sets | id, tenant_id, name, description, created_at |
| `052_permission_set_items.sql` | permission_set_permissions | set_id, permission_id mapping |
| `053_role_permission_sets.sql` | role_permission_sets | role_id, permission_set_id - link roles to sets |
| `054_audit_logs.sql` | audit_logs | id, tenant_id, user_id, action, resource_type, resource_id, old_value, new_value, ip_address, user_agent |
| `055_license_keys.sql` | license_keys | id, tenant_id, key_hash, plan, modules, issued_at, expires_at, metadata |
| `056_sso_configs.sql` | sso_configs | id, tenant_id, provider, config (JSONB), is_enabled |
| `057_sla_policies.sql` | sla_policies | id, tenant_id, name, severity, response_hours, resolution_hours |
| `058_sla_violations.sql` | sla_violations | id, finding_id, policy_id, violated_at, violation_type |
| `059_suppressions.sql` | suppressions | id, tenant_id, finding_id, reason, suppressed_by, approved_by, expires_at |
| `060_workflows.sql` | workflows | id, tenant_id, name, trigger_type, conditions (JSONB), actions (JSONB) |
| `061_workflow_executions.sql` | workflow_executions | id, workflow_id, trigger_data, status, started_at, completed_at |
| `062_notifications.sql` | notifications | id, tenant_id, user_id, type, channel, content, read_at |
| `063_notification_configs.sql` | notification_configs | id, tenant_id, channel, config (JSONB) |
| `064_integrations.sql` | integrations | id, tenant_id, provider, config (encrypted JSONB), is_enabled |
| `065_ai_triage_results.sql` | ai_triage_results | id, finding_id, confidence, recommendation, reasoning |

### K.6 SaaS Migrations (migrations/saas/)

| File | Table(s) | Purpose |
|------|----------|---------|
| `080_platform_tenants.sql` | platform_tenants | id, name, slug, status, plan_id, owner_user_id, settings |
| `081_platform_users.sql` | platform_users | Platform admin users |
| `082_plans.sql` | plans | id, name, slug, features (JSONB), limits (JSONB), price_monthly, price_yearly |
| `083_subscriptions.sql` | subscriptions | id, tenant_id, plan_id, status, current_period_start, current_period_end |
| `084_invoices.sql` | invoices | id, subscription_id, amount, status, paid_at |
| `085_usage_records.sql` | usage_records | id, tenant_id, metric, value, recorded_at |
| `086_platform_agents.sql` | platform_agents | id, name, region, capabilities, status, capacity |
| `087_agent_leases.sql` | agent_leases | id, agent_id, tenant_id, scan_id, acquired_at, expires_at, renewed_at |
| `088_tenant_rls_policies.sql` | - | Row-level security policies for all tables |
| `089_onboarding_progress.sql` | onboarding_progress | id, tenant_id, step, completed_at |
| `090_analytics_events.sql` | analytics_events | id, tenant_id, event_type, properties (JSONB), created_at |
| `091_notification_outbox.sql` | notification_outbox | Transactional outbox for reliable notifications |

### K.7 Migration Loading Order

```go
// pkg/migrations/loader.go

package migrations

import (
    "embed"
    "sort"
)

//go:embed core/*.sql
var CoreMigrations embed.FS

//go:embed enterprise/*.sql
var EnterpriseMigrations embed.FS

//go:embed saas/*.sql
var SaaSMigrations embed.FS

// LoadMigrations returns migrations based on edition
func LoadMigrations(edition string) ([]Migration, error) {
    var migrations []Migration

    // Always load core
    core, err := loadFromFS(CoreMigrations, "core")
    if err != nil {
        return nil, err
    }
    migrations = append(migrations, core...)

    // Enterprise includes enterprise migrations
    if edition == "enterprise" || edition == "saas" {
        enterprise, err := loadFromFS(EnterpriseMigrations, "enterprise")
        if err != nil {
            return nil, err
        }
        migrations = append(migrations, enterprise...)
    }

    // SaaS includes saas migrations
    if edition == "saas" {
        saas, err := loadFromFS(SaaSMigrations, "saas")
        if err != nil {
            return nil, err
        }
        migrations = append(migrations, saas...)
    }

    // Sort by version number
    sort.Slice(migrations, func(i, j int) bool {
        return migrations[i].Version < migrations[j].Version
    })

    return migrations, nil
}
```

### K.8 Migration Statistics

| Edition | Current Files | Optimized Files | Reduction |
|---------|--------------|-----------------|-----------|
| OSS Core | 50 | 29 | 42% |
| Enterprise | 39 | 16 | 59% |
| SaaS | 64 | 12 | 81% |
| **Total** | **153** | **57** | **63%** |

**Note:** Basic RBAC (roles, permissions, role_permissions, user_roles, seed_roles) moved from Enterprise to OSS Core.

### K.9 Fresh Install Benefits

1. **Faster initial setup**: Single CREATE TABLE vs multiple ALTER TABLEs
2. **Clearer schema understanding**: One file = one table
3. **Easier maintenance**: Changes require editing single file
4. **Better performance**: No migration chain to execute
5. **Simplified testing**: Fresh DB matches production schema exactly
6. **Edition clarity**: Clear separation of what belongs where

### K.10 Implementation Steps

```
1. [ ] Export current schema from existing database
2. [ ] Consolidate into single-table migrations
3. [ ] Add proper indexes and constraints
4. [ ] Create edition-specific directories
5. [ ] Implement migration loader with edition awareness
6. [ ] Test fresh install for each edition
7. [ ] Test upgrade path from old migrations
8. [ ] Archive old migrations (keep for reference)
```

---

## Appendix L: Testing Strategy

### L.1 Testing Pyramid

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TESTING PYRAMID                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│                            ▲                                          │
│                           /▲\         E2E Tests (5%)                  │
│                          / ▲ \        - Full system flows             │
│                         /  ▲  \       - Multi-repo integration        │
│                        /───▲───\                                      │
│                       /    ▲    \     Integration Tests (20%)         │
│                      /     ▲     \    - API endpoints                 │
│                     /      ▲      \   - Database operations           │
│                    /       ▲       \  - Service composition           │
│                   /────────▲────────\                                 │
│                  /         ▲         \  Unit Tests (75%)              │
│                 /          ▲          \ - Domain logic                │
│                /           ▲           \- Value objects               │
│               /────────────▲────────────\- Pure functions             │
│              ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔                            │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### L.2 Unit Testing Strategy

#### L.2.1 Domain Layer Testing (Target: 95% coverage)

```go
// pkg/domain/asset/entity_test.go

package asset_test

import (
    "testing"

    "github.com/openctemio/api/pkg/domain/asset"
    "github.com/openctemio/api/pkg/domain/shared"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestNewAsset_ValidInput_CreatesAsset(t *testing.T) {
    // Arrange
    tenantID := shared.NewTenantID()
    typeID := asset.NewAssetTypeID()
    name := "web-server-01"
    identifier := "192.168.1.100"

    // Act
    a, err := asset.NewAsset(tenantID, typeID, name, identifier)

    // Assert
    require.NoError(t, err)
    assert.Equal(t, name, a.Name())
    assert.Equal(t, identifier, a.Identifier())
    assert.Equal(t, asset.StatusActive, a.Status())
    assert.Equal(t, asset.CriticalityMedium, a.Criticality())
    assert.NotEmpty(t, a.GetEvents()) // Should have AssetCreatedEvent
}

func TestNewAsset_EmptyName_ReturnsError(t *testing.T) {
    tenantID := shared.NewTenantID()
    typeID := asset.NewAssetTypeID()

    _, err := asset.NewAsset(tenantID, typeID, "", "identifier")

    assert.ErrorIs(t, err, asset.ErrAssetNameRequired)
}

func TestAsset_UpdateCriticality_RaisesEvent(t *testing.T) {
    // Arrange
    a := createTestAsset(t)
    initialCriticality := a.Criticality()
    _ = a.GetEvents() // Clear creation event

    // Act
    a.UpdateCriticality(asset.CriticalityCritical, "Production system")

    // Assert
    assert.Equal(t, asset.CriticalityCritical, a.Criticality())
    events := a.GetEvents()
    require.Len(t, events, 1)

    event, ok := events[0].(asset.AssetCriticalityChangedEvent)
    require.True(t, ok)
    assert.Equal(t, initialCriticality, event.OldCriticality)
    assert.Equal(t, asset.CriticalityCritical, event.NewCriticality)
}

func TestCriticality_Score_ReturnsCorrectValue(t *testing.T) {
    tests := []struct {
        criticality asset.Criticality
        expected    int
    }{
        {asset.CriticalityLow, 1},
        {asset.CriticalityMedium, 2},
        {asset.CriticalityHigh, 3},
        {asset.CriticalityCritical, 4},
    }

    for _, tt := range tests {
        t.Run(string(tt.criticality), func(t *testing.T) {
            assert.Equal(t, tt.expected, tt.criticality.Score())
        })
    }
}
```

#### L.2.2 Value Object Testing

```go
// pkg/domain/asset/value_objects_test.go

func TestAssetID_ParseValid(t *testing.T) {
    validUUID := "550e8400-e29b-41d4-a716-446655440000"

    id, err := asset.ParseAssetID(validUUID)

    assert.NoError(t, err)
    assert.Equal(t, validUUID, id.String())
}

func TestAssetID_ParseInvalid_ReturnsError(t *testing.T) {
    _, err := asset.ParseAssetID("invalid")

    assert.Error(t, err)
}

func TestAssetID_IsZero(t *testing.T) {
    var zeroID asset.AssetID
    newID := asset.NewAssetID()

    assert.True(t, zeroID.IsZero())
    assert.False(t, newID.IsZero())
}
```

#### L.2.3 Service Layer Testing (Mock Dependencies)

```go
// pkg/domain/asset/service_test.go

package asset_test

import (
    "context"
    "testing"

    "github.com/openctemio/api/pkg/app"
    "github.com/openctemio/api/pkg/domain/asset"
    "github.com/openctemio/api/pkg/domain/asset/mocks"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/mock"
)

func TestAssetService_Create_Success(t *testing.T) {
    // Arrange
    ctx := context.Background()
    mockRepo := mocks.NewMockRepository(t)
    mockEventPublisher := mocks.NewMockEventPublisher(t)
    mockLogger := mocks.NewMockLogger(t)

    svc := asset.NewService(mockRepo, mockEventPublisher, mockLogger)

    cmd := app.CreateAssetCommand{
        TenantID:    shared.NewTenantID(),
        TypeID:      asset.NewAssetTypeID(),
        Name:        "test-asset",
        Identifier:  "192.168.1.1",
        Criticality: asset.CriticalityHigh,
    }

    mockRepo.On("Save", ctx, mock.AnythingOfType("*asset.Asset")).Return(nil)
    mockEventPublisher.On("Publish", ctx, mock.AnythingOfType("asset.AssetCreatedEvent")).Return(nil)

    // Act
    result, err := svc.CreateAsset(ctx, cmd)

    // Assert
    assert.NoError(t, err)
    assert.NotNil(t, result)
    assert.Equal(t, cmd.Name, result.Name())
    assert.Equal(t, cmd.Criticality, result.Criticality())
    mockRepo.AssertExpectations(t)
    mockEventPublisher.AssertExpectations(t)
}

func TestAssetService_Create_RepoError_ReturnsError(t *testing.T) {
    ctx := context.Background()
    mockRepo := mocks.NewMockRepository(t)
    mockEventPublisher := mocks.NewMockEventPublisher(t)
    mockLogger := mocks.NewMockLogger(t)

    svc := asset.NewService(mockRepo, mockEventPublisher, mockLogger)

    cmd := app.CreateAssetCommand{
        TenantID:   shared.NewTenantID(),
        TypeID:     asset.NewAssetTypeID(),
        Name:       "test-asset",
        Identifier: "192.168.1.1",
    }

    expectedErr := errors.New("database error")
    mockRepo.On("Save", ctx, mock.Anything).Return(expectedErr)

    result, err := svc.CreateAsset(ctx, cmd)

    assert.Nil(t, result)
    assert.ErrorContains(t, err, "save asset")
}
```

### L.3 Integration Testing Strategy

#### L.3.1 Database Integration Tests

```go
// internal/infrastructure/postgres/asset_repo_integration_test.go
//go:build integration

package postgres_test

import (
    "context"
    "testing"

    "github.com/openctemio/api/internal/infrastructure/postgres"
    "github.com/openctemio/api/pkg/domain/asset"
    "github.com/openctemio/api/pkg/domain/shared"
    "github.com/stretchr/testify/suite"
)

type AssetRepositoryTestSuite struct {
    suite.Suite
    db   *postgres.TestDB
    repo *postgres.AssetRepository
}

func (s *AssetRepositoryTestSuite) SetupSuite() {
    s.db = postgres.NewTestDB(s.T())
    s.repo = postgres.NewAssetRepository(s.db.DB)
}

func (s *AssetRepositoryTestSuite) TearDownSuite() {
    s.db.Close()
}

func (s *AssetRepositoryTestSuite) SetupTest() {
    s.db.Truncate("assets", "asset_types", "tenants")
    s.db.SeedTenant(s.T())
}

func (s *AssetRepositoryTestSuite) TestSave_NewAsset_Persists() {
    ctx := context.Background()
    a := s.createTestAsset()

    err := s.repo.Save(ctx, a)

    s.NoError(err)

    // Verify persisted
    found, err := s.repo.FindByID(ctx, a.ID())
    s.NoError(err)
    s.Equal(a.Name(), found.Name())
    s.Equal(a.Identifier(), found.Identifier())
}

func (s *AssetRepositoryTestSuite) TestFindByTenantID_WithFilter_ReturnsFiltered() {
    ctx := context.Background()
    tenantID := s.db.TestTenantID

    // Create assets with different criticalities
    s.createAssetWithCriticality(tenantID, asset.CriticalityLow)
    s.createAssetWithCriticality(tenantID, asset.CriticalityHigh)
    s.createAssetWithCriticality(tenantID, asset.CriticalityHigh)

    filter := asset.Filter{Criticality: ptr(asset.CriticalityHigh)}
    opts := asset.QueryOptions{Filter: filter}

    results, err := s.repo.FindByTenantID(ctx, tenantID, opts)

    s.NoError(err)
    s.Len(results, 2)
}

func TestAssetRepositoryTestSuite(t *testing.T) {
    if testing.Short() {
        t.Skip("Skipping integration test")
    }
    suite.Run(t, new(AssetRepositoryTestSuite))
}
```

#### L.3.2 API Endpoint Integration Tests

```go
// internal/server/handlers/asset_handler_integration_test.go
//go:build integration

package handlers_test

import (
    "bytes"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/openctemio/api/internal/server"
    "github.com/stretchr/testify/suite"
)

type AssetHandlerTestSuite struct {
    suite.Suite
    server *httptest.Server
    client *http.Client
    token  string
}

func (s *AssetHandlerTestSuite) SetupSuite() {
    app := server.NewTestApp(s.T())
    s.server = httptest.NewServer(app.Handler())
    s.client = s.server.Client()
    s.token = s.getTestToken()
}

func (s *AssetHandlerTestSuite) TestCreateAsset_ValidInput_Returns201() {
    body := map[string]any{
        "name":        "test-asset",
        "identifier":  "192.168.1.1",
        "type_id":     s.getTestAssetTypeID(),
        "criticality": "high",
    }

    resp := s.POST("/api/v1/assets", body)

    s.Equal(http.StatusCreated, resp.StatusCode)

    var result map[string]any
    json.NewDecoder(resp.Body).Decode(&result)
    s.Equal("test-asset", result["name"])
    s.NotEmpty(result["id"])
}

func (s *AssetHandlerTestSuite) TestCreateAsset_MissingName_Returns400() {
    body := map[string]any{
        "identifier": "192.168.1.1",
        "type_id":    s.getTestAssetTypeID(),
    }

    resp := s.POST("/api/v1/assets", body)

    s.Equal(http.StatusBadRequest, resp.StatusCode)
}

func (s *AssetHandlerTestSuite) TestListAssets_WithPagination_ReturnsPaged() {
    // Create 25 assets
    for i := 0; i < 25; i++ {
        s.createAsset(fmt.Sprintf("asset-%d", i))
    }

    resp := s.GET("/api/v1/assets?page=1&per_page=10")

    s.Equal(http.StatusOK, resp.StatusCode)

    var result map[string]any
    json.NewDecoder(resp.Body).Decode(&result)
    s.Len(result["data"].([]any), 10)
    s.Equal(float64(25), result["total"])
    s.Equal(float64(3), result["total_pages"])
}

func (s *AssetHandlerTestSuite) POST(path string, body any) *http.Response {
    jsonBody, _ := json.Marshal(body)
    req, _ := http.NewRequest("POST", s.server.URL+path, bytes.NewReader(jsonBody))
    req.Header.Set("Authorization", "Bearer "+s.token)
    req.Header.Set("Content-Type", "application/json")
    resp, _ := s.client.Do(req)
    return resp
}
```

### L.4 Migration Testing Strategy

#### L.4.1 Fresh Install Tests

```go
// migrations/migration_test.go
//go:build integration

package migrations_test

import (
    "testing"

    "github.com/openctemio/api/pkg/migrations"
    "github.com/stretchr/testify/suite"
)

type MigrationTestSuite struct {
    suite.Suite
}

func (s *MigrationTestSuite) TestOSSFreshInstall() {
    db := s.createEmptyDatabase()
    defer db.Drop()

    err := migrations.Run(db.DB, "oss")

    s.NoError(err)

    // Verify core tables exist
    s.tableExists(db, "users")
    s.tableExists(db, "tenants")
    s.tableExists(db, "assets")
    s.tableExists(db, "findings")
    s.tableExists(db, "roles")
    s.tableExists(db, "permissions")

    // Verify enterprise tables do NOT exist
    s.tableNotExists(db, "audit_logs")
    s.tableNotExists(db, "license_keys")
    s.tableNotExists(db, "workflows")

    // Verify predefined roles exist
    s.rowExists(db, "roles", "slug", "admin")
    s.rowExists(db, "roles", "slug", "manager")
    s.rowExists(db, "roles", "slug", "analyst")
    s.rowExists(db, "roles", "slug", "viewer")
}

func (s *MigrationTestSuite) TestEnterpriseFreshInstall() {
    db := s.createEmptyDatabase()
    defer db.Drop()

    err := migrations.Run(db.DB, "enterprise")

    s.NoError(err)

    // Verify core + enterprise tables exist
    s.tableExists(db, "users")
    s.tableExists(db, "assets")
    s.tableExists(db, "audit_logs")
    s.tableExists(db, "license_keys")
    s.tableExists(db, "workflows")
    s.tableExists(db, "permission_sets")

    // Verify SaaS tables do NOT exist
    s.tableNotExists(db, "platform_agents")
    s.tableNotExists(db, "agent_leases")
}

func (s *MigrationTestSuite) TestSaaSFreshInstall() {
    db := s.createEmptyDatabase()
    defer db.Drop()

    err := migrations.Run(db.DB, "saas")

    s.NoError(err)

    // Verify all tables exist
    s.tableExists(db, "users")
    s.tableExists(db, "audit_logs")
    s.tableExists(db, "platform_agents")
    s.tableExists(db, "agent_leases")
    s.tableExists(db, "subscriptions")
}

func (s *MigrationTestSuite) TestUpgradePath_OSSToEnterprise() {
    db := s.createEmptyDatabase()
    defer db.Drop()

    // Install OSS
    err := migrations.Run(db.DB, "oss")
    s.NoError(err)

    // Insert some data
    s.insertTestData(db)

    // Upgrade to Enterprise
    err = migrations.Run(db.DB, "enterprise")
    s.NoError(err)

    // Verify data preserved
    s.dataPreserved(db)

    // Verify enterprise tables added
    s.tableExists(db, "audit_logs")
}
```

#### L.4.2 Migration Rollback Tests

```go
func (s *MigrationTestSuite) TestMigrationRollback() {
    db := s.createEmptyDatabase()
    defer db.Drop()

    // Apply all migrations
    err := migrations.Run(db.DB, "enterprise")
    s.NoError(err)

    // Rollback last migration
    err = migrations.Rollback(db.DB, 1)
    s.NoError(err)

    // Apply again
    err = migrations.Run(db.DB, "enterprise")
    s.NoError(err)
}
```

### L.5 Cross-Repository Integration Tests

#### L.5.1 Import Verification Tests

```go
// test/cross_repo_test.go
//go:build crossrepo

package crossrepo_test

import (
    "testing"

    // OSS imports
    ossapp "github.com/openctemio/api/pkg/app"
    ossasset "github.com/openctemio/api/pkg/domain/asset"
    ossmiddleware "github.com/openctemio/api/pkg/middleware"

    // Enterprise imports
    eerbac "github.com/exploop/api/pkg/rbac"
    eelicensing "github.com/exploop/api/pkg/licensing"

    "github.com/stretchr/testify/assert"
)

func TestEnterpriseCanImportOSS(t *testing.T) {
    // This test verifies that enterprise can import OSS packages

    // Create OSS asset service
    var ossService ossapp.AssetService
    assert.Nil(t, ossService) // Just verify import works

    // Wrap with RBAC
    var wrappedService *eerbac.AssetServiceWithRBAC
    assert.Nil(t, wrappedService)

    // Verify interface compliance
    var _ ossapp.AssetService = (*eerbac.AssetServiceWithRBAC)(nil)
}

func TestServiceWrapperPattern(t *testing.T) {
    // Create mock OSS service
    mockOSS := &mockAssetService{}

    // Create enterprise wrappers
    rbacSvc := eerbac.NewRBACService(nil, nil)
    auditSvc := eerbac.NewAuditService(nil)
    licenseSvc := eelicensing.NewLicensingService(nil, nil)

    // Wrap OSS service
    wrapped := eerbac.NewAssetServiceWithRBAC(mockOSS, rbacSvc, auditSvc, licenseSvc)

    // Verify it implements OSS interface
    var _ ossapp.AssetService = wrapped
}
```

### L.6 E2E Testing Strategy

#### L.6.1 OSS E2E Test Scenarios

```yaml
# test/e2e/oss/scenarios.yaml

scenarios:
  - name: "Fresh Install and Basic Workflow"
    steps:
      - action: docker-compose up
        expect: services healthy

      - action: create_admin_user
        data:
          email: admin@test.com
          password: Test123!
        expect: user created

      - action: login
        data:
          email: admin@test.com
          password: Test123!
        expect: JWT token returned

      - action: create_asset
        data:
          name: web-server
          identifier: 192.168.1.100
          criticality: high
        expect: asset created with ID

      - action: run_scan
        data:
          asset_id: ${asset.id}
          profile: default
        expect: scan completed

      - action: list_findings
        expect: findings returned

  - name: "Multi-User with Roles"
    steps:
      - action: create_user
        data:
          email: analyst@test.com
          role: analyst
        expect: user with analyst role

      - action: login_as analyst
      - action: create_asset
        expect: success (analyst can create)

      - action: delete_user
        data:
          user_id: ${admin.id}
        expect: forbidden (analyst cannot delete users)
```

#### L.6.2 Enterprise E2E Test Scenarios

```yaml
# test/e2e/enterprise/scenarios.yaml

scenarios:
  - name: "License Activation"
    steps:
      - action: helm install exploop
        expect: deployment ready

      - action: access_enterprise_feature
        feature: audit_logs
        expect: license required error

      - action: activate_license
        data:
          license_key: ${TEST_LICENSE_KEY}
        expect: license activated

      - action: access_enterprise_feature
        feature: audit_logs
        expect: success

  - name: "Custom Role Creation"
    steps:
      - action: create_custom_role
        data:
          name: "Security Lead"
          permissions:
            - assets:read
            - assets:write
            - findings:*
            - scans:execute
        expect: role created

      - action: assign_role
        user: analyst@test.com
        role: Security Lead
        expect: role assigned

      - action: verify_permissions
        expect: user has correct access
```

### L.7 Test Automation Infrastructure

#### L.7.1 CI Test Matrix

```yaml
# .github/workflows/test.yml

name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'

      - name: Run unit tests
        run: go test -v -race -coverprofile=coverage.out ./pkg/...

      - name: Upload coverage
        uses: codecov/codecov-action@v4

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5

      - name: Run integration tests
        run: go test -v -tags=integration ./...
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/test?sslmode=disable

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Start services
        run: docker-compose -f docker-compose.test.yml up -d

      - name: Wait for services
        run: ./scripts/wait-for-healthy.sh

      - name: Run E2E tests
        run: go test -v -tags=e2e ./test/e2e/...

      - name: Collect logs on failure
        if: failure()
        run: docker-compose logs > logs.txt

      - name: Upload logs
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-logs
          path: logs.txt

  cross-repo-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
        with:
          repository: exploop/api
          token: ${{ secrets.CROSS_REPO_TOKEN }}

      - name: Test Enterprise imports OSS
        run: go build ./...
```

### L.8 Test Coverage Requirements

| Package | Min Coverage | Target |
|---------|-------------|--------|
| `pkg/domain/*` | 90% | 95% |
| `pkg/app/*` | 85% | 90% |
| `pkg/infra/postgres/*` | 80% | 85% |
| `pkg/middleware/*` | 80% | 85% |
| `internal/*` | 70% | 80% |

### L.9 Testing Tools & Libraries

```go
// go.mod testing dependencies

require (
    github.com/stretchr/testify v1.9.0
    github.com/DATA-DOG/go-sqlmock v1.5.2
    github.com/testcontainers/testcontainers-go v0.29.0
    github.com/golang/mock v1.6.0
    github.com/onsi/ginkgo/v2 v2.17.0
    github.com/onsi/gomega v1.32.0
)
```

---

## Appendix M: Data Migration for Existing Deployments

### M.1 Migration Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                 EXISTING DATA MIGRATION WORKFLOW                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Step 1: Backup              Step 2: Export           Step 3: Transform
│  ┌──────────────┐           ┌──────────────┐         ┌──────────────┐
│  │  pg_dump     │──────────▶│  JSON/CSV    │────────▶│  Transform   │
│  │  full backup │           │  export      │         │  scripts     │
│  └──────────────┘           └──────────────┘         └──────────────┘
│                                                               │
│  Step 6: Verify              Step 5: Import          Step 4: New Schema
│  ┌──────────────┐           ┌──────────────┐         ┌──────────────┐
│  │  Data        │◀──────────│  Import to   │◀────────│  Run new     │
│  │  integrity   │           │  new schema  │         │  migrations  │
│  └──────────────┘           └──────────────┘         └──────────────┘
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### M.2 Pre-Migration Checklist

```bash
#!/bin/bash
# scripts/pre-migration-check.sh

echo "=== Pre-Migration Checklist ==="

# 1. Check PostgreSQL version
echo "Checking PostgreSQL version..."
psql -c "SELECT version();"

# 2. Check current migration version
echo "Checking current migration state..."
psql -c "SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 5;"

# 3. Check data sizes
echo "Checking table sizes..."
psql -c "
SELECT
    relname as table,
    pg_size_pretty(pg_total_relation_size(relid)) as size,
    n_live_tup as rows
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;
"

# 4. Check for orphaned data
echo "Checking for orphaned data..."
psql -c "
SELECT COUNT(*) as orphaned_findings
FROM findings f
LEFT JOIN assets a ON f.asset_id = a.id
WHERE a.id IS NULL AND f.asset_id IS NOT NULL;
"

# 5. Disk space check
echo "Checking disk space..."
df -h /var/lib/postgresql

# 6. Estimate migration time
echo "Estimating migration time..."
psql -c "
SELECT
    SUM(n_live_tup) as total_rows,
    ROUND(SUM(n_live_tup) / 10000.0, 2) as estimated_minutes
FROM pg_stat_user_tables;
"

echo "=== Pre-Migration Checklist Complete ==="
```

### M.3 Backup Script

```bash
#!/bin/bash
# scripts/backup-before-migration.sh

set -e

BACKUP_DIR="/backups/migration-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "Creating full database backup..."

# Full database dump
pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --format=custom \
    --file="$BACKUP_DIR/full-backup.dump" \
    --verbose

# Schema only (for reference)
pg_dump \
    --host="$DB_HOST" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --schema-only \
    --file="$BACKUP_DIR/schema-only.sql"

# Export critical tables as CSV (for verification)
for table in users tenants assets findings scans roles permissions; do
    echo "Exporting $table..."
    psql -c "\COPY $table TO '$BACKUP_DIR/$table.csv' WITH CSV HEADER;"
done

# Record row counts
psql -c "
SELECT tablename, n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY tablename;
" > "$BACKUP_DIR/row-counts.txt"

# Create checksum
sha256sum "$BACKUP_DIR"/* > "$BACKUP_DIR/checksums.sha256"

echo "Backup complete: $BACKUP_DIR"
echo "Backup size: $(du -sh $BACKUP_DIR | cut -f1)"
```

### M.4 Data Export Scripts

```go
// cmd/migrate/export.go

package main

import (
    "context"
    "encoding/json"
    "os"

    "github.com/openctemio/api/pkg/migrations/export"
)

func main() {
    ctx := context.Background()
    db := connectDB()
    outputDir := os.Args[1]

    exporter := export.NewExporter(db, outputDir)

    // Export each entity type
    entities := []export.EntityExporter{
        export.NewUserExporter(),
        export.NewTenantExporter(),
        export.NewAssetExporter(),
        export.NewFindingExporter(),
        export.NewScanExporter(),
        export.NewRoleExporter(),
        export.NewPermissionExporter(),
    }

    for _, entity := range entities {
        log.Printf("Exporting %s...", entity.Name())

        count, err := exporter.Export(ctx, entity)
        if err != nil {
            log.Fatalf("Failed to export %s: %v", entity.Name(), err)
        }

        log.Printf("Exported %d %s records", count, entity.Name())
    }
}
```

```go
// pkg/migrations/export/finding_exporter.go

package export

import (
    "context"
    "database/sql"
)

type FindingExporter struct{}

func (e *FindingExporter) Name() string { return "findings" }

func (e *FindingExporter) Query() string {
    return `
        SELECT
            id,
            tenant_id,
            asset_id,
            vulnerability_id,
            title,
            description,
            fingerprint,
            finding_type,
            severity,
            status,
            cvss_score,
            evidence,
            remediation,
            first_seen_at,
            last_seen_at,
            resolved_at,
            sla_due_at,
            assigned_to,
            tags,
            metadata,
            source,
            source_id,
            created_at,
            updated_at,
            created_by
        FROM findings
        ORDER BY created_at
    `
}

func (e *FindingExporter) Transform(row *sql.Rows) (map[string]any, error) {
    var f struct {
        ID              string
        TenantID        string
        AssetID         *string
        VulnerabilityID *string
        Title           string
        // ... all fields
    }

    err := row.Scan(&f.ID, &f.TenantID, /* ... */)
    if err != nil {
        return nil, err
    }

    // Transform to new format
    return map[string]any{
        "id":               f.ID,
        "tenant_id":        f.TenantID,
        "asset_id":         f.AssetID,
        "vulnerability_id": f.VulnerabilityID,
        "title":            f.Title,
        // Map old fields to new fields
        // Handle any schema changes
    }, nil
}
```

### M.5 Schema Transformation Scripts

```sql
-- scripts/transform/findings_transform.sql

-- Handle findings table schema changes
-- Old schema -> New optimized schema

-- Step 1: Create temporary table with new schema
CREATE TABLE findings_new (
    LIKE findings INCLUDING ALL
);

-- Step 2: Add new columns that don't exist
ALTER TABLE findings_new ADD COLUMN IF NOT EXISTS epss_score DECIMAL(5,4);
ALTER TABLE findings_new ADD COLUMN IF NOT EXISTS affected_component VARCHAR(500);
ALTER TABLE findings_new ADD COLUMN IF NOT EXISTS affected_version VARCHAR(100);

-- Step 3: Copy data with transformations
INSERT INTO findings_new (
    id, tenant_id, asset_id, vulnerability_id,
    title, description, fingerprint, finding_type,
    severity, status, cvss_score, evidence,
    remediation, first_seen_at, last_seen_at,
    resolved_at, sla_due_at, assigned_to,
    tags, metadata, source, source_id,
    created_at, updated_at, created_by,
    -- New columns with defaults
    epss_score, affected_component, affected_version
)
SELECT
    id, tenant_id, asset_id, vulnerability_id,
    title, description, fingerprint,
    COALESCE(finding_type, 'vulnerability') as finding_type,
    COALESCE(severity, 'unknown') as severity,
    COALESCE(status, 'open') as status,
    cvss_score, evidence, remediation,
    first_seen_at, last_seen_at, resolved_at,
    sla_due_at, assigned_to, tags, metadata,
    source, source_id, created_at, updated_at, created_by,
    -- Extract from metadata if exists
    (metadata->>'epss_score')::DECIMAL(5,4),
    metadata->>'affected_component',
    metadata->>'affected_version'
FROM findings;

-- Step 4: Verify row counts match
DO $$
DECLARE
    old_count INTEGER;
    new_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO old_count FROM findings;
    SELECT COUNT(*) INTO new_count FROM findings_new;

    IF old_count != new_count THEN
        RAISE EXCEPTION 'Row count mismatch: old=%, new=%', old_count, new_count;
    END IF;
END $$;

-- Step 5: Swap tables
BEGIN;
ALTER TABLE findings RENAME TO findings_old;
ALTER TABLE findings_new RENAME TO findings;
COMMIT;

-- Step 6: Drop old table (after verification period)
-- DROP TABLE findings_old;
```

### M.6 Data Import Scripts

```go
// cmd/migrate/import.go

package main

import (
    "context"
    "encoding/json"
    "os"

    "github.com/openctemio/api/pkg/migrations/importer"
)

func main() {
    ctx := context.Background()
    db := connectDB()
    inputDir := os.Args[1]

    imp := importer.NewImporter(db, inputDir)

    // Import in dependency order
    importOrder := []string{
        "tenants",
        "users",
        "roles",
        "permissions",
        "role_permissions",
        "user_roles",
        "asset_types",
        "asset_groups",
        "assets",
        "vulnerabilities",
        "findings",
        "scans",
        // ... rest
    }

    for _, entity := range importOrder {
        log.Printf("Importing %s...", entity)

        count, err := imp.Import(ctx, entity)
        if err != nil {
            log.Fatalf("Failed to import %s: %v", entity, err)
        }

        log.Printf("Imported %d %s records", count, entity)
    }

    // Run post-import tasks
    log.Println("Running post-import tasks...")
    imp.UpdateSequences(ctx)
    imp.RebuildIndexes(ctx)
    imp.AnalyzeTables(ctx)
}
```

### M.7 Data Verification Scripts

```bash
#!/bin/bash
# scripts/verify-migration.sh

set -e

echo "=== Data Migration Verification ==="

# 1. Compare row counts
echo "Comparing row counts..."
psql -c "
SELECT
    'tenants' as entity,
    (SELECT COUNT(*) FROM tenants) as count,
    (SELECT COUNT(*) FROM tenants_old) as old_count,
    CASE WHEN (SELECT COUNT(*) FROM tenants) = (SELECT COUNT(*) FROM tenants_old)
         THEN 'PASS' ELSE 'FAIL' END as status
UNION ALL
SELECT 'users', COUNT(*), (SELECT COUNT(*) FROM users_old),
       CASE WHEN COUNT(*) = (SELECT COUNT(*) FROM users_old) THEN 'PASS' ELSE 'FAIL' END
FROM users
UNION ALL
SELECT 'assets', COUNT(*), (SELECT COUNT(*) FROM assets_old),
       CASE WHEN COUNT(*) = (SELECT COUNT(*) FROM assets_old) THEN 'PASS' ELSE 'FAIL' END
FROM assets
UNION ALL
SELECT 'findings', COUNT(*), (SELECT COUNT(*) FROM findings_old),
       CASE WHEN COUNT(*) = (SELECT COUNT(*) FROM findings_old) THEN 'PASS' ELSE 'FAIL' END
FROM findings;
"

# 2. Verify foreign key integrity
echo "Checking foreign key integrity..."
psql -c "
SELECT
    'findings->assets' as relationship,
    COUNT(*) as orphaned
FROM findings f
LEFT JOIN assets a ON f.asset_id = a.id
WHERE f.asset_id IS NOT NULL AND a.id IS NULL

UNION ALL

SELECT 'findings->users', COUNT(*)
FROM findings f
LEFT JOIN users u ON f.assigned_to = u.id
WHERE f.assigned_to IS NOT NULL AND u.id IS NULL;
"

# 3. Sample data comparison
echo "Comparing sample records..."
psql -c "
SELECT
    'Finding Match' as check_type,
    CASE WHEN f.title = fo.title AND f.fingerprint = fo.fingerprint
         THEN 'PASS' ELSE 'FAIL' END as status
FROM findings f
JOIN findings_old fo ON f.id = fo.id
LIMIT 100;
"

# 4. Check indexes exist
echo "Verifying indexes..."
psql -c "
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'findings'
ORDER BY indexname;
"

# 5. Performance check
echo "Running performance check..."
psql -c "EXPLAIN ANALYZE SELECT * FROM findings WHERE tenant_id = (SELECT id FROM tenants LIMIT 1) LIMIT 100;"

echo "=== Verification Complete ==="
```

### M.8 Rollback Script

```bash
#!/bin/bash
# scripts/rollback-migration.sh

set -e

echo "=== Rolling Back Migration ==="

# Check if backup exists
if [ ! -f "$BACKUP_DIR/full-backup.dump" ]; then
    echo "ERROR: Backup not found at $BACKUP_DIR"
    exit 1
fi

# Confirm rollback
read -p "This will restore the database from backup. Are you sure? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Rollback cancelled."
    exit 0
fi

# Stop application
echo "Stopping application..."
docker-compose stop api

# Drop current database
echo "Dropping current database..."
psql -c "DROP DATABASE IF EXISTS $DB_NAME;"
psql -c "CREATE DATABASE $DB_NAME;"

# Restore from backup
echo "Restoring from backup..."
pg_restore \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --verbose \
    "$BACKUP_DIR/full-backup.dump"

# Verify restore
echo "Verifying restore..."
psql -c "SELECT COUNT(*) FROM users;"
psql -c "SELECT COUNT(*) FROM findings;"

# Restart application
echo "Restarting application..."
docker-compose up -d api

echo "=== Rollback Complete ==="
```

### M.9 Migration Runbook

```markdown
# Data Migration Runbook

## Pre-Migration (T-1 day)
1. [ ] Announce maintenance window
2. [ ] Run pre-migration checklist
3. [ ] Verify backup storage has 3x current DB size
4. [ ] Test backup/restore on staging

## Migration Day (T-0)

### Phase 1: Preparation (30 mins)
1. [ ] Enable maintenance mode
2. [ ] Stop all write operations
3. [ ] Create full backup
4. [ ] Verify backup integrity

### Phase 2: Export (Depends on data size)
1. [ ] Run export scripts
2. [ ] Verify exported data counts
3. [ ] Store export checksums

### Phase 3: Schema Migration (30 mins)
1. [ ] Create new database
2. [ ] Run new optimized migrations
3. [ ] Verify schema correct

### Phase 4: Import (Depends on data size)
1. [ ] Import data in dependency order
2. [ ] Update sequences
3. [ ] Rebuild indexes
4. [ ] Run ANALYZE

### Phase 5: Verification (1 hour)
1. [ ] Run verification scripts
2. [ ] Compare row counts
3. [ ] Check foreign key integrity
4. [ ] Run sample queries
5. [ ] Performance test

### Phase 6: Cutover (15 mins)
1. [ ] Update connection strings
2. [ ] Start application
3. [ ] Smoke test all features
4. [ ] Disable maintenance mode

## Post-Migration (T+1 day)
1. [ ] Monitor error rates
2. [ ] Monitor performance metrics
3. [ ] Keep old database for 7 days
4. [ ] Drop old database after verification period
```

---

## Appendix N: Performance Baseline & Benchmarks

### N.1 Current Performance Baseline

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PERFORMANCE BASELINE METRICS                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  API Response Times (p50 / p95 / p99):                               │
│  ├── GET /api/v1/assets           : 45ms / 120ms / 250ms             │
│  ├── GET /api/v1/findings         : 80ms / 200ms / 400ms             │
│  ├── POST /api/v1/scans           : 150ms / 300ms / 500ms            │
│  ├── GET /api/v1/dashboard        : 200ms / 450ms / 800ms            │
│  └── POST /api/v1/findings/bulk   : 500ms / 1200ms / 2000ms          │
│                                                                       │
│  Database Query Times (p95):                                          │
│  ├── Simple SELECT               : 5ms                               │
│  ├── List with filters           : 25ms                              │
│  ├── Aggregation queries         : 100ms                             │
│  └── Complex joins               : 200ms                             │
│                                                                       │
│  Resource Usage:                                                      │
│  ├── API Memory                  : 512MB - 1GB                       │
│  ├── API CPU (idle/load)         : 5% / 40%                          │
│  ├── DB Connections              : 20-50                             │
│  └── DB Memory                   : 2GB                               │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### N.2 Benchmark Scripts

```go
// benchmark/api_benchmark_test.go

package benchmark

import (
    "net/http"
    "testing"
    "time"
)

func BenchmarkListAssets(b *testing.B) {
    client := setupBenchmarkClient()
    token := getAuthToken()

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        req, _ := http.NewRequest("GET", baseURL+"/api/v1/assets?per_page=50", nil)
        req.Header.Set("Authorization", "Bearer "+token)

        resp, err := client.Do(req)
        if err != nil {
            b.Fatal(err)
        }
        resp.Body.Close()

        if resp.StatusCode != http.StatusOK {
            b.Fatalf("Expected 200, got %d", resp.StatusCode)
        }
    }
}

func BenchmarkListFindings(b *testing.B) {
    client := setupBenchmarkClient()
    token := getAuthToken()

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        req, _ := http.NewRequest("GET", baseURL+"/api/v1/findings?per_page=100", nil)
        req.Header.Set("Authorization", "Bearer "+token)

        resp, _ := client.Do(req)
        resp.Body.Close()
    }
}

func BenchmarkCreateAsset(b *testing.B) {
    client := setupBenchmarkClient()
    token := getAuthToken()

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        body := fmt.Sprintf(`{"name":"bench-asset-%d","identifier":"192.168.1.%d","type_id":"%s"}`,
            i, i%255, testAssetTypeID)

        req, _ := http.NewRequest("POST", baseURL+"/api/v1/assets", strings.NewReader(body))
        req.Header.Set("Authorization", "Bearer "+token)
        req.Header.Set("Content-Type", "application/json")

        resp, _ := client.Do(req)
        resp.Body.Close()
    }
}

func BenchmarkDashboardAggregation(b *testing.B) {
    client := setupBenchmarkClient()
    token := getAuthToken()

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        req, _ := http.NewRequest("GET", baseURL+"/api/v1/dashboard/summary", nil)
        req.Header.Set("Authorization", "Bearer "+token)

        resp, _ := client.Do(req)
        resp.Body.Close()
    }
}
```

### N.3 Load Testing with k6

```javascript
// benchmark/k6/load-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const listAssetsTrend = new Trend('list_assets_duration');
const listFindingsTrend = new Trend('list_findings_duration');

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up
    { duration: '5m', target: 50 },   // Sustained load
    { duration: '2m', target: 100 },  // Peak load
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'errors': ['rate<0.01'],
    'list_assets_duration': ['p(95)<200'],
    'list_findings_duration': ['p(95)<300'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TOKEN = __ENV.AUTH_TOKEN;

export default function() {
  const headers = {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  };

  // List Assets
  let start = Date.now();
  let res = http.get(`${BASE_URL}/api/v1/assets?per_page=50`, { headers });
  listAssetsTrend.add(Date.now() - start);

  check(res, {
    'list assets status is 200': (r) => r.status === 200,
    'list assets has data': (r) => JSON.parse(r.body).data.length > 0,
  }) || errorRate.add(1);

  sleep(1);

  // List Findings
  start = Date.now();
  res = http.get(`${BASE_URL}/api/v1/findings?per_page=100`, { headers });
  listFindingsTrend.add(Date.now() - start);

  check(res, {
    'list findings status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(1);

  // Dashboard
  res = http.get(`${BASE_URL}/api/v1/dashboard/summary`, { headers });
  check(res, {
    'dashboard status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(2);
}
```

### N.4 Database Query Benchmarks

```sql
-- benchmark/db/query_benchmark.sql

-- Setup: Create test data
-- Run: pgbench -f query_benchmark.sql -c 10 -j 4 -T 60

\set tenant_id random(1, 100)

-- Benchmark 1: Simple asset lookup
SELECT * FROM assets WHERE tenant_id = :tenant_id LIMIT 50;

-- Benchmark 2: Findings with filters
SELECT f.*, a.name as asset_name
FROM findings f
LEFT JOIN assets a ON f.asset_id = a.id
WHERE f.tenant_id = :tenant_id
  AND f.severity IN ('high', 'critical')
  AND f.status = 'open'
ORDER BY f.first_seen_at DESC
LIMIT 100;

-- Benchmark 3: Dashboard aggregation
SELECT
    COUNT(*) FILTER (WHERE status = 'open') as open_findings,
    COUNT(*) FILTER (WHERE status = 'resolved') as resolved_findings,
    COUNT(*) FILTER (WHERE severity = 'critical') as critical_findings,
    COUNT(*) FILTER (WHERE severity = 'high') as high_findings,
    COUNT(DISTINCT asset_id) as affected_assets
FROM findings
WHERE tenant_id = :tenant_id;

-- Benchmark 4: Time-series query
SELECT
    DATE_TRUNC('day', first_seen_at) as date,
    COUNT(*) as count
FROM findings
WHERE tenant_id = :tenant_id
  AND first_seen_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', first_seen_at)
ORDER BY date;
```

### N.5 Post-Split Performance Targets

| Metric | Current | Post-Split Target | Max Regression |
|--------|---------|-------------------|----------------|
| **API Response Time (p95)** |
| GET /assets | 120ms | 130ms | 10% |
| GET /findings | 200ms | 220ms | 10% |
| POST /scans | 300ms | 330ms | 10% |
| Dashboard | 450ms | 500ms | 10% |
| **Database Queries (p95)** |
| Simple SELECT | 5ms | 5ms | 0% |
| List with filters | 25ms | 25ms | 0% |
| Aggregations | 100ms | 100ms | 0% |
| **Throughput** |
| Requests/sec | 500 | 450 | 10% |
| **Memory** |
| API Memory | 1GB | 1.1GB | 10% |

### N.6 Service Composition Overhead

```go
// benchmark/composition_benchmark_test.go

func BenchmarkServiceComposition(b *testing.B) {
    // Benchmark OSS service directly
    b.Run("OSS-Direct", func(b *testing.B) {
        svc := createOSSAssetService()
        ctx := createTestContext()

        b.ResetTimer()
        for i := 0; i < b.N; i++ {
            _, _ = svc.Get(ctx, testTenantID, testAssetID)
        }
    })

    // Benchmark Enterprise wrapped service
    b.Run("EE-Wrapped", func(b *testing.B) {
        ossSvc := createOSSAssetService()
        rbac := createRBACService()
        audit := createAuditService()

        svc := rbac.NewAssetServiceWithRBAC(ossSvc, rbac, audit, nil)
        ctx := createTestContext()

        b.ResetTimer()
        for i := 0; i < b.N; i++ {
            _, _ = svc.Get(ctx, testTenantID, testAssetID)
        }
    })

    // Benchmark SaaS wrapped service
    b.Run("SaaS-Wrapped", func(b *testing.B) {
        ossSvc := createOSSAssetService()
        eeSvc := createEEAssetService(ossSvc)

        svc := platform.NewAssetServiceWithLimits(eeSvc, limitsService, usageTracker)
        ctx := createTestContext()

        b.ResetTimer()
        for i := 0; i < b.N; i++ {
            _, _ = svc.Get(ctx, testTenantID, testAssetID)
        }
    })
}
```

**Expected Results:**
```
BenchmarkServiceComposition/OSS-Direct-8          500000   2340 ns/op
BenchmarkServiceComposition/EE-Wrapped-8          450000   2650 ns/op    (+13%)
BenchmarkServiceComposition/SaaS-Wrapped-8        400000   2980 ns/op    (+27%)
```

### N.7 Continuous Performance Monitoring

```yaml
# .github/workflows/benchmark.yml

name: Performance Benchmarks

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 0 * * *'  # Daily

jobs:
  benchmark:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: benchmark
          POSTGRES_USER: bench
          POSTGRES_PASSWORD: bench

    steps:
      - uses: actions/checkout@v4

      - name: Setup Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.22'

      - name: Seed benchmark data
        run: go run ./cmd/seed-benchmark-data

      - name: Run Go benchmarks
        run: |
          go test -bench=. -benchmem -count=5 ./benchmark/... | tee benchmark-results.txt

      - name: Run k6 load tests
        run: |
          docker run --rm -i grafana/k6 run - < benchmark/k6/load-test.js

      - name: Compare with baseline
        run: |
          go run ./cmd/compare-benchmarks baseline.txt benchmark-results.txt

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: benchmark-results
          path: benchmark-results.txt

      - name: Alert on regression
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {"text": "Performance regression detected in ${{ github.sha }}"}
```

---

## Appendix O: Security Review Checklist

### O.1 Pre-OSS Release Security Checklist

```markdown
## Code Security Review

### Authentication & Authorization
- [ ] JWT token validation is secure (algorithm, expiry, signature)
- [ ] Password hashing uses bcrypt with appropriate cost factor (12+)
- [ ] Session management prevents fixation and hijacking
- [ ] RBAC enforcement is consistent across all endpoints
- [ ] API keys are hashed, not stored in plain text
- [ ] Rate limiting is implemented on auth endpoints

### Input Validation
- [ ] All user inputs are validated and sanitized
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (output encoding)
- [ ] Path traversal prevention
- [ ] SSRF prevention for webhook/integration URLs
- [ ] File upload validation (type, size, content)

### Data Protection
- [ ] Sensitive data encrypted at rest (credentials, API keys)
- [ ] PII handling complies with GDPR/CCPA
- [ ] Tenant isolation is enforced at database level
- [ ] No sensitive data in logs
- [ ] No sensitive data in error messages

### Dependencies
- [ ] All dependencies scanned for vulnerabilities
- [ ] No known vulnerable dependencies
- [ ] Dependency versions pinned
- [ ] License compliance verified (Apache 2.0 compatible)

### Configuration
- [ ] No hardcoded secrets in code
- [ ] Default configurations are secure
- [ ] Environment variables documented
- [ ] TLS/HTTPS enforced
- [ ] CORS properly configured

### Infrastructure
- [ ] Docker images use non-root user
- [ ] Docker images scanned for vulnerabilities
- [ ] Kubernetes security contexts defined
- [ ] Network policies restrict traffic
```

### O.2 Security Scanning Configuration

```yaml
# .github/workflows/security.yml

name: Security Scanning

on:
  push:
    branches: [main, develop]
  pull_request:
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  sast:
    name: Static Analysis
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/golang
            p/owasp-top-ten
            p/security-audit

      - name: Run gosec
        uses: securego/gosec@master
        with:
          args: '-no-fail -fmt json -out gosec-results.json ./...'

      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: gosec-results.json

  dependency-scan:
    name: Dependency Scanning
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Trivy
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          ignore-unfixed: true
          severity: 'CRITICAL,HIGH'

      - name: Run govulncheck
        run: |
          go install golang.org/x/vuln/cmd/govulncheck@latest
          govulncheck ./...

  container-scan:
    name: Container Scanning
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        run: docker build -t openctemio/api:scan .

      - name: Scan image
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'openctemio/api:scan'
          severity: 'CRITICAL,HIGH'

  secret-scan:
    name: Secret Scanning
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### O.3 Security Headers Configuration

```go
// pkg/middleware/security.go

package middleware

import "net/http"

func SecurityHeaders() func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Prevent clickjacking
            w.Header().Set("X-Frame-Options", "DENY")

            // XSS protection
            w.Header().Set("X-Content-Type-Options", "nosniff")
            w.Header().Set("X-XSS-Protection", "1; mode=block")

            // Content Security Policy
            w.Header().Set("Content-Security-Policy",
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';")

            // HSTS
            w.Header().Set("Strict-Transport-Security",
                "max-age=31536000; includeSubDomains")

            // Referrer Policy
            w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

            // Permissions Policy
            w.Header().Set("Permissions-Policy",
                "geolocation=(), microphone=(), camera=()")

            next.ServeHTTP(w, r)
        })
    }
}
```

### O.4 SECURITY.md Template

```markdown
# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability,
please report it responsibly.

### How to Report

1. **DO NOT** create a public GitHub issue
2. Email security@openctem.io with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- Acknowledgment within 24 hours
- Status update within 72 hours
- Resolution timeline based on severity:
  - Critical: 24-48 hours
  - High: 7 days
  - Medium: 30 days
  - Low: 90 days

### Bug Bounty

We offer rewards for responsibly disclosed vulnerabilities:

| Severity | Reward |
|----------|--------|
| Critical | $500-$2000 |
| High | $200-$500 |
| Medium | $50-$200 |
| Low | Recognition |

### Safe Harbor

We will not pursue legal action against security researchers who:
- Act in good faith
- Avoid privacy violations
- Do not disrupt services
- Report vulnerabilities promptly
```

---

## Appendix P: API Versioning Strategy

### P.1 Versioning Approach

```
┌─────────────────────────────────────────────────────────────────────┐
│                      API VERSIONING STRATEGY                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Approach: URL Path Versioning                                        │
│  Pattern:  /api/v{major}/resources                                   │
│                                                                       │
│  Examples:                                                            │
│  ├── /api/v1/assets          (Current stable)                        │
│  ├── /api/v2/assets          (Next major version)                    │
│  └── /api/v1/findings        (Unchanged across versions)             │
│                                                                       │
│  Version Lifecycle:                                                   │
│  ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐              │
│  │ Alpha  │───▶│  Beta  │───▶│ Stable │───▶│Deprecated│             │
│  │ (dev)  │    │(preview)│   │(current)│   │(sunset) │              │
│  └────────┘    └────────┘    └────────┘    └────────┘              │
│       │             │             │             │                     │
│    3 months     3 months     12+ months     6 months                 │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### P.2 Versioning Rules

```go
// pkg/api/versioning/rules.go

package versioning

// Breaking Changes (require major version bump):
// - Removing endpoints
// - Removing required fields
// - Changing field types
// - Changing authentication mechanisms
// - Changing error response format

// Non-Breaking Changes (minor version):
// - Adding new endpoints
// - Adding optional fields
// - Adding new enum values
// - Deprecating (not removing) fields

type APIVersion struct {
    Major int
    Minor int
    Status VersionStatus
}

type VersionStatus string

const (
    StatusAlpha      VersionStatus = "alpha"
    StatusBeta       VersionStatus = "beta"
    StatusStable     VersionStatus = "stable"
    StatusDeprecated VersionStatus = "deprecated"
)

var SupportedVersions = map[string]APIVersion{
    "v1": {Major: 1, Minor: 0, Status: StatusStable},
    "v2": {Major: 2, Minor: 0, Status: StatusBeta},
}
```

### P.3 Version Negotiation

```go
// pkg/middleware/versioning.go

package middleware

func APIVersion() func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Extract version from URL path
            version := extractVersion(r.URL.Path)

            // Validate version
            if !isValidVersion(version) {
                http.Error(w, "Unsupported API version", http.StatusBadRequest)
                return
            }

            // Check if deprecated
            if isDeprecated(version) {
                w.Header().Set("X-API-Deprecated", "true")
                w.Header().Set("X-API-Sunset-Date", getSunsetDate(version))
                w.Header().Set("X-API-Upgrade-To", getLatestVersion())
            }

            // Add version to context
            ctx := context.WithValue(r.Context(), "api_version", version)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}

func extractVersion(path string) string {
    // /api/v1/assets -> v1
    parts := strings.Split(path, "/")
    if len(parts) >= 3 && parts[1] == "api" {
        return parts[2]
    }
    return "v1" // Default
}
```

### P.4 Deprecation Process

```yaml
# Deprecation Timeline Example

v1.0 (Jan 2026):
  - Initial stable release

v1.1 (Mar 2026):
  - Added: GET /api/v1/assets/:id/findings
  - Deprecated: GET /api/v1/asset-findings (use above instead)
    - Sunset: Sep 2026

v2.0-beta (Jun 2026):
  - Breaking: Changed pagination from offset to cursor-based
  - Breaking: Renamed 'vulnerability' to 'finding' in responses
  - Removed: GET /api/v1/asset-findings (sunset complete)

v2.0 (Sep 2026):
  - v2 becomes stable
  - v1 enters deprecation (6 month sunset)

v2.1 (Dec 2026):
  - v1 fully sunset (returns 410 Gone)
```

### P.5 Migration Guide Template

```markdown
# API v1 to v2 Migration Guide

## Breaking Changes

### 1. Pagination (Cursor-based)

**v1 (offset-based):**
```json
GET /api/v1/assets?page=2&per_page=50

Response:
{
  "data": [...],
  "page": 2,
  "per_page": 50,
  "total": 1000,
  "total_pages": 20
}
```

**v2 (cursor-based):**
```json
GET /api/v2/assets?limit=50&cursor=eyJpZCI6IjEyMyJ9

Response:
{
  "data": [...],
  "pagination": {
    "limit": 50,
    "has_more": true,
    "next_cursor": "eyJpZCI6IjE3MyJ9",
    "prev_cursor": "eyJpZCI6IjczIn0="
  }
}
```

### 2. Field Renames

| v1 Field | v2 Field |
|----------|----------|
| `vulnerability_id` | `finding_id` |
| `vuln_count` | `finding_count` |
| `severity_level` | `severity` |

### 3. Response Envelope

**v1:**
```json
{
  "data": {...},
  "meta": {...}
}
```

**v2:**
```json
{
  "data": {...},
  "meta": {...},
  "_links": {
    "self": "/api/v2/assets/123",
    "findings": "/api/v2/assets/123/findings"
  }
}
```

## Migration Script

```bash
#!/bin/bash
# Update API calls in codebase

# Find and replace patterns
find . -name "*.ts" -exec sed -i \
  -e 's|/api/v1/|/api/v2/|g' \
  -e 's|vulnerability_id|finding_id|g' \
  -e 's|page:|cursor:|g' \
  {} \;
```
```

---

## Appendix Q: Rollback Procedures

### Q.1 Rollback Decision Matrix

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ROLLBACK DECISION MATRIX                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Trigger Conditions (ANY triggers rollback):                          │
│  ├── Error rate > 5% for 5+ minutes                                  │
│  ├── P99 latency > 2x baseline for 10+ minutes                       │
│  ├── Data integrity issues detected                                  │
│  ├── Security vulnerability discovered                               │
│  └── Critical feature completely broken                              │
│                                                                       │
│  Rollback Type Selection:                                             │
│                                                                       │
│  Issue Type              │ Rollback Type    │ Time to Execute        │
│  ────────────────────────┼──────────────────┼────────────────────    │
│  Code bug                │ Application      │ 5-10 minutes           │
│  Configuration error     │ Config           │ 2-5 minutes            │
│  Migration failure       │ Database         │ 30-60 minutes          │
│  Infrastructure issue    │ Infrastructure   │ 15-30 minutes          │
│  Full release failure    │ Full             │ 60-120 minutes         │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Q.2 Application Rollback

```bash
#!/bin/bash
# scripts/rollback/application-rollback.sh

set -e

PREVIOUS_VERSION=$1
CURRENT_VERSION=$(kubectl get deployment api -o jsonpath='{.spec.template.spec.containers[0].image}' | cut -d: -f2)

echo "=== Application Rollback ==="
echo "Current version: $CURRENT_VERSION"
echo "Rolling back to: $PREVIOUS_VERSION"

# Confirm
read -p "Proceed with rollback? (yes/no): " confirm
[ "$confirm" != "yes" ] && exit 0

# Option 1: Kubernetes rollback
echo "Performing Kubernetes rollback..."
kubectl rollout undo deployment/api

# Wait for rollout
kubectl rollout status deployment/api --timeout=5m

# Verify
NEW_VERSION=$(kubectl get deployment api -o jsonpath='{.spec.template.spec.containers[0].image}' | cut -d: -f2)
echo "Rolled back to version: $NEW_VERSION"

# Health check
echo "Running health checks..."
for i in {1..10}; do
    if curl -sf http://api.internal/health > /dev/null; then
        echo "Health check passed"
        break
    fi
    echo "Waiting for health check... ($i/10)"
    sleep 5
done

# Verify functionality
echo "Running smoke tests..."
./scripts/smoke-test.sh

echo "=== Application Rollback Complete ==="
```

### Q.3 Database Rollback

```bash
#!/bin/bash
# scripts/rollback/database-rollback.sh

set -e

echo "=== Database Rollback ==="

# Check current migration version
CURRENT_VERSION=$(psql -t -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;")
echo "Current migration version: $CURRENT_VERSION"

# Determine rollback target
case $1 in
    "last")
        ROLLBACK_STEPS=1
        ;;
    "to")
        TARGET_VERSION=$2
        ;;
    *)
        echo "Usage: $0 last | to <version>"
        exit 1
        ;;
esac

# Create backup before rollback
echo "Creating pre-rollback backup..."
BACKUP_FILE="/backups/pre-rollback-$(date +%Y%m%d-%H%M%S).dump"
pg_dump --format=custom --file="$BACKUP_FILE" "$DATABASE_URL"
echo "Backup created: $BACKUP_FILE"

# Stop application to prevent writes
echo "Stopping application..."
kubectl scale deployment/api --replicas=0

# Execute rollback
if [ -n "$ROLLBACK_STEPS" ]; then
    echo "Rolling back $ROLLBACK_STEPS migration(s)..."
    migrate -path ./migrations -database "$DATABASE_URL" down $ROLLBACK_STEPS
else
    echo "Rolling back to version $TARGET_VERSION..."
    migrate -path ./migrations -database "$DATABASE_URL" goto $TARGET_VERSION
fi

# Verify
NEW_VERSION=$(psql -t -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;")
echo "New migration version: $NEW_VERSION"

# Restart application
echo "Restarting application..."
kubectl scale deployment/api --replicas=3

# Health check
echo "Waiting for application to be healthy..."
kubectl rollout status deployment/api --timeout=5m

echo "=== Database Rollback Complete ==="
```

### Q.4 Full Release Rollback

```bash
#!/bin/bash
# scripts/rollback/full-rollback.sh

set -e

RELEASE_TAG=$1
BACKUP_TIMESTAMP=$2

echo "=== Full Release Rollback ==="
echo "Target release: $RELEASE_TAG"
echo "Database backup: $BACKUP_TIMESTAMP"

# Phase 1: Stop all traffic
echo "Phase 1: Stopping traffic..."
kubectl patch ingress api-ingress -p '{"spec":{"rules":[]}}'
kubectl scale deployment/api --replicas=0

# Phase 2: Restore database
echo "Phase 2: Restoring database..."
BACKUP_FILE="/backups/release-$BACKUP_TIMESTAMP.dump"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Create current state backup
CURRENT_BACKUP="/backups/pre-rollback-$(date +%Y%m%d-%H%M%S).dump"
pg_dump --format=custom --file="$CURRENT_BACKUP" "$DATABASE_URL"

# Restore
psql -c "DROP DATABASE IF EXISTS ${DB_NAME}_restore;"
psql -c "CREATE DATABASE ${DB_NAME}_restore;"
pg_restore --dbname="${DB_NAME}_restore" "$BACKUP_FILE"

# Swap databases
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME';"
psql -c "ALTER DATABASE $DB_NAME RENAME TO ${DB_NAME}_old;"
psql -c "ALTER DATABASE ${DB_NAME}_restore RENAME TO $DB_NAME;"

# Phase 3: Deploy previous version
echo "Phase 3: Deploying previous version..."
kubectl set image deployment/api api=openctemio/api:$RELEASE_TAG
kubectl rollout status deployment/api --timeout=10m

# Phase 4: Restore traffic
echo "Phase 4: Restoring traffic..."
kubectl apply -f k8s/ingress.yaml
kubectl scale deployment/api --replicas=3

# Phase 5: Verify
echo "Phase 5: Verification..."
./scripts/smoke-test.sh
./scripts/verify-data-integrity.sh

echo "=== Full Release Rollback Complete ==="
echo "Old database preserved as: ${DB_NAME}_old"
echo "To cleanup: psql -c 'DROP DATABASE ${DB_NAME}_old;'"
```

### Q.5 Rollback Runbook

```markdown
# Rollback Runbook

## Quick Reference

| Scenario | Command | ETA |
|----------|---------|-----|
| Bad deployment | `kubectl rollout undo deployment/api` | 5 min |
| Config issue | `kubectl rollout undo configmap/api-config` | 2 min |
| Bad migration | `./scripts/rollback/database-rollback.sh last` | 30 min |
| Full release | `./scripts/rollback/full-rollback.sh v1.2.3 20260203-120000` | 60 min |

## Step-by-Step: Application Rollback

### 1. Identify the Issue
```bash
# Check error rates
kubectl logs deployment/api --tail=100 | grep ERROR

# Check metrics
curl -s localhost:9090/api/v1/query?query=http_requests_total{status=~"5.."}
```

### 2. Initiate Rollback
```bash
# View rollout history
kubectl rollout history deployment/api

# Rollback to previous version
kubectl rollout undo deployment/api

# Or rollback to specific revision
kubectl rollout undo deployment/api --to-revision=3
```

### 3. Verify Rollback
```bash
# Check deployment status
kubectl rollout status deployment/api

# Check pod health
kubectl get pods -l app=api

# Run smoke tests
./scripts/smoke-test.sh
```

### 4. Post-Rollback Actions
- [ ] Notify stakeholders
- [ ] Create incident report
- [ ] Investigate root cause
- [ ] Plan hotfix if needed

## Step-by-Step: Database Rollback

### 1. Stop Application
```bash
kubectl scale deployment/api --replicas=0
```

### 2. Create Safety Backup
```bash
pg_dump --format=custom --file=/backups/safety-$(date +%s).dump $DATABASE_URL
```

### 3. Execute Rollback
```bash
# Rollback last migration
migrate -path ./migrations -database $DATABASE_URL down 1

# Or rollback to specific version
migrate -path ./migrations -database $DATABASE_URL goto 20260101120000
```

### 4. Restart and Verify
```bash
kubectl scale deployment/api --replicas=3
kubectl rollout status deployment/api
./scripts/verify-data-integrity.sh
```

## Emergency Contacts

| Role | Contact |
|------|---------|
| On-call Engineer | PagerDuty |
| Database Admin | dba@exploop.io |
| Security | security@exploop.io |
```

### Q.6 Automated Rollback Triggers

```yaml
# k8s/rollback-policy.yaml

apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: api-rollout
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    spec:
      containers:
      - name: api
        image: openctemio/api:latest
  strategy:
    canary:
      steps:
      - setWeight: 10
      - pause: {duration: 2m}
      - setWeight: 30
      - pause: {duration: 5m}
      - setWeight: 60
      - pause: {duration: 5m}
      - setWeight: 100

      # Automatic rollback on failure
      analysis:
        templates:
        - templateName: success-rate
        startingStep: 1

      # Anti-affinity for progressive delivery
      trafficRouting:
        nginx:
          stableIngress: api-stable

---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
spec:
  metrics:
  - name: success-rate
    interval: 1m
    successCondition: result[0] >= 0.95
    failureLimit: 3
    provider:
      prometheus:
        address: http://prometheus:9090
        query: |
          sum(rate(http_requests_total{app="api",status=~"2.."}[5m])) /
          sum(rate(http_requests_total{app="api"}[5m]))

  - name: latency-p99
    interval: 1m
    successCondition: result[0] <= 500
    failureLimit: 3
    provider:
      prometheus:
        address: http://prometheus:9090
        query: |
          histogram_quantile(0.99,
            sum(rate(http_request_duration_seconds_bucket{app="api"}[5m])) by (le)
          ) * 1000
```

---

## Appendix R: Operational Runbooks

### R.1 Common Operations

```markdown
# Operational Runbooks

## Daily Operations

### Health Check
```bash
# API health
curl -sf https://api.openctem.io/health | jq

# Database health
psql -c "SELECT pg_is_in_recovery(), pg_last_wal_receive_lsn();"

# Redis health
redis-cli ping
```

### Log Analysis
```bash
# Recent errors
kubectl logs deployment/api --since=1h | grep ERROR | tail -50

# Slow queries
grep "query took" /var/log/postgresql/postgresql.log | awk '$NF > 1000'
```

## Weekly Operations

### Database Maintenance
```bash
# Vacuum analyze
psql -c "VACUUM ANALYZE;"

# Check bloat
psql -c "
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
"
```

### Security Updates
```bash
# Check for dependency updates
go list -m -u all

# Run security scan
trivy fs --severity HIGH,CRITICAL .
```

## Monthly Operations

### Performance Review
```bash
# Generate performance report
./scripts/generate-performance-report.sh

# Review slow query log
./scripts/analyze-slow-queries.sh
```

### Backup Verification
```bash
# Test backup restore
./scripts/test-backup-restore.sh

# Verify backup integrity
./scripts/verify-backup-integrity.sh
```
```

### R.2 Incident Response Template

```markdown
# Incident Report Template

## Incident Summary
- **ID:** INC-YYYY-NNNN
- **Severity:** P1/P2/P3/P4
- **Status:** Open/Investigating/Resolved
- **Duration:** HH:MM
- **Impact:** Description of user impact

## Timeline
| Time (UTC) | Event |
|------------|-------|
| HH:MM | Alert triggered |
| HH:MM | On-call acknowledged |
| HH:MM | Root cause identified |
| HH:MM | Mitigation deployed |
| HH:MM | Service restored |

## Root Cause
[Detailed technical explanation]

## Resolution
[Steps taken to resolve]

## Action Items
- [ ] Item 1 - Owner - Due Date
- [ ] Item 2 - Owner - Due Date

## Lessons Learned
[What went well, what could be improved]
```

---

## Summary: Complete RFC Coverage

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FINAL RFC COMPLETENESS                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Core Sections (0-10):                                                │
│  ├── 0. Repository Structure              ████████████████████ 100%  │
│  ├── 0.1 Clean Architecture + DDD         ████████████████████ 100%  │
│  ├── 1. Executive Summary                 ████████████████████ 100%  │
│  ├── 2. Current Assessment                ████████████████████ 100%  │
│  ├── 3. Code Classification               ████████████████████ 100%  │
│  ├── 4. Target Architecture               ████████████████████ 100%  │
│  ├── 5. Repository Structures             ████████████████████ 100%  │
│  ├── 6. Extension Design                  ████████████████████ 100%  │
│  ├── 7. Feature Enablement                ████████████████████ 100%  │
│  ├── 8. Migration Strategy                ████████████████████ 100%  │
│  ├── 9. Step-by-Step Plan                 ████████████████████ 100%  │
│  └── 10. Risks & Mitigations              ████████████████████ 100%  │
│                                                                       │
│  Appendices:                                                          │
│  ├── A. File Movement Checklist           ████████████████████ 100%  │
│  ├── B. Import Path Changes               ████████████████████ 100%  │
│  ├── C. Version Compatibility             ████████████████████ 100%  │
│  ├── D. Codebase Analysis                 ████████████████████ 100%  │
│  ├── E. Implementation Tasks (144)        ████████████████████ 100%  │
│  ├── F. Service Dependencies              ████████████████████ 100%  │
│  ├── G. Migration File Listing            ████████████████████ 100%  │
│  ├── H. Repository Checklists             ████████████████████ 100%  │
│  ├── I. Risk Mitigation Checklist         ████████████████████ 100%  │
│  ├── J. Feature Matrix + RBAC Model       ████████████████████ 100%  │
│  ├── K. Optimized Migrations              ████████████████████ 100%  │
│  ├── L. Testing Strategy             NEW  ████████████████████ 100%  │
│  ├── M. Data Migration Scripts       NEW  ████████████████████ 100%  │
│  ├── N. Performance Benchmarks       NEW  ████████████████████ 100%  │
│  ├── O. Security Checklist           NEW  ████████████████████ 100%  │
│  ├── P. API Versioning               NEW  ████████████████████ 100%  │
│  ├── Q. Rollback Procedures          NEW  ████████████████████ 100%  │
│  └── R. Operational Runbooks         NEW  ████████████████████ 100%  │
│                                                                       │
│  ══════════════════════════════════════════════════════════════════  │
│  OVERALL COMPLETENESS:                    ████████████████████ 100%  │
│                                                                       │
│  Total Lines: ~6,500+                                                │
│  Total Tasks: 144                                                    │
│  Total Appendices: 18                                                │
│  Estimated Implementation: 10-12 weeks                               │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```
