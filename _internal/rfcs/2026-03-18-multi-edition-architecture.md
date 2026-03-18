# RFC: Multi-Edition Architecture — OpenCTEM Core + Exploop EE

**Created:** 2026-03-18
**Status:** PLANNED
**Priority:** P0 (Architecture)
**Scope:** Restructure codebase to support OpenCTEM (OSS) and Exploop (Commercial) as separate products sharing a common core

---

## Problem

OpenCTEM is a single monolithic codebase. To create a commercial product (Exploop), we currently have two bad options:

1. **Fork** — Clone repo, add EE code on top. OSS updates cause merge conflicts, divergence over time.
2. **Same repo with EE code** — EE source code becomes public, losing commercial advantage.

## Core Principle

```
OSS (OpenCTEM) knows NOTHING about EE (Exploop)
EE (Exploop) knows EVERYTHING about OSS (OpenCTEM)
```

- OpenCTEM is a complete standalone product — not a stripped-down version
- Exploop imports OpenCTEM as a dependency and adds enterprise features
- Removing all Exploop code = OpenCTEM still runs 100%

## Repositories

```
openctemio/        PUBLIC repo — OpenCTEM OSS (core + server + UI)
exploop/           PRIVATE repo — Exploop EE (imports openctemio, adds features + branding)
```

---

## Current State

```
openctemio/
├── go.work                          3 Go modules in workspace
├── api/                             module: github.com/openctemio/api
│   ├── cmd/server/                  main.go + services.go + handlers.go + repositories.go + workers.go
│   ├── internal/                    ← PROBLEM: Go blocks external import
│   │   ├── app/                     89 service files, 72 services
│   │   ├── config/                  Configuration
│   │   └── infra/                   11 packages (postgres, redis, http, websocket, jobs...)
│   │       ├── postgres/            89 repository implementations
│   │       ├── http/handler/        62 handlers
│   │       ├── http/routes/         11 route files
│   │       └── ...
│   ├── pkg/                         ← Already public
│   │   ├── domain/                  48 domain packages
│   │   └── ...                      10 utility packages
│   └── migrations/                  53 migrations (96 files)
├── ui/                              Next.js 16, React 19
│   ├── src/app/                     App Router routes
│   ├── src/features/                41 feature modules
│   ├── src/components/              shadcn/ui components
│   └── src/lib/                     Utilities
├── agent/                           Separate Go module
├── sdk-go/                          Separate Go module
└── docker-compose.yml               postgres, redis, api, ui
```

### Key Numbers

| Layer | Count |
|-------|-------|
| Domain packages | 48 |
| Services | 72 |
| Repositories | 89 |
| HTTP handlers | 62 |
| Route files | 11 |
| Service files (app/) | 89 |
| DB migrations | 53 (96 files) |
| UI features | 41 |
| Go files to update imports | ~400 |
| TS files to update imports | ~500 |

### The One Blocker

`api/internal/` — Go forbids importing `internal/` from outside the module. Exploop cannot import `api/internal/app/` or `api/internal/infra/`. Everything else in `api/pkg/` is already importable.

---

## Roadmap: 3 Milestones, Minimal → Full

```
Milestone 1 (Minimal)       Milestone 2 (Usable)          Milestone 3 (Full)
─────────────────────       ─────────────────────          ──────────────────
Remove internal/ barrier    Server bootstrap package       Rename module + UI split
Exploop CAN import          Exploop EASY to wire           Clean final architecture
~1 day                      ~3-5 days                      ~1-2 weeks
```

Each milestone is independently shippable. You can stop at any milestone and have a working system.

---

## Milestone 1: Remove `internal/` Barrier

**Goal:** Exploop can import OpenCTEM services, infra, config.
**Effort:** ~1 day
**Risk:** Low — mechanical move, compiler catches all errors
**Files changed:** ~300 Go files (import path only, zero logic changes)

### Changes

```
BEFORE                              AFTER
──────                              ─────
api/internal/app/                   api/app/
api/internal/infra/                 api/infra/
api/internal/config/                api/config/
api/internal/metrics/               api/metrics/

api/pkg/domain/                     (unchanged — already public)
api/pkg/*/                          (unchanged — already public)
api/cmd/server/                     (unchanged — still works)
```

### Import Path Changes

```go
// BEFORE
import "github.com/openctemio/api/internal/app"
import "github.com/openctemio/api/internal/infra/postgres"
import "github.com/openctemio/api/internal/infra/http/handler"
import "github.com/openctemio/api/internal/config"

// AFTER
import "github.com/openctemio/api/app"
import "github.com/openctemio/api/infra/postgres"
import "github.com/openctemio/api/infra/http/handler"
import "github.com/openctemio/api/config"
```

### Steps

| # | Step | Command/Action |
|---|------|----------------|
| 1.1 | Move directories | `mv api/internal/app api/app` etc. |
| 1.2 | Find-replace all imports | `sed` or IDE refactor: `api/internal/app` → `api/app` |
| 1.3 | Fix any remaining references | `go build ./...` — compiler will catch them |
| 1.4 | Run tests | `go test ./...` |
| 1.5 | Remove empty `api/internal/` | `rmdir api/internal` |

### What This Unlocks

```go
// exploop/cmd/server/main.go — NOW POSSIBLE
import (
    "github.com/openctemio/api/app"
    "github.com/openctemio/api/config"
    "github.com/openctemio/api/infra/postgres"
    "github.com/openctemio/api/infra/redis"
    "github.com/openctemio/api/infra/http"
    "github.com/openctemio/api/infra/http/routes"
    "github.com/openctemio/api/pkg/domain/tenant"
)

// Exploop can now use ALL OpenCTEM code
// But wiring is still manual (copy-paste from cmd/server/main.go)
```

### Validation Checklist

- [ ] `cd api && go build ./...` — zero errors
- [ ] `cd api && go test ./...` — all pass
- [ ] `docker compose up` — API starts, health check OK
- [ ] No `internal/` directory remains in `api/`
- [ ] `go.work` unchanged, agent and sdk-go still build

---

## Milestone 2: Server Bootstrap Package

**Goal:** `server.Run(config)` — one function to start OpenCTEM or Exploop.
**Effort:** 3-5 days
**Risk:** Medium — requires careful extraction of initialization logic
**Files changed:** ~10 new files, ~5 existing files modified

### Why This Matters

After Milestone 1, Exploop CAN import OpenCTEM code. But to start a server, it would have to copy-paste 300 lines from `cmd/server/main.go`. That's fragile — when OpenCTEM adds a new service, Exploop's copy doesn't have it.

The server package gives Exploop a single function call that includes all defaults automatically.

### New Package: `api/server/`

```
api/server/
├── server.go           Run(), NewServer(), graceful shutdown
├── options.go          Config struct, extension point interfaces
├── wire.go             NewRepositories(), NewServices(), NewHandlers() — extracted from cmd/server/
├── defaults.go         DefaultAuthProviders(), DefaultMiddleware()
└── workers.go          NewWorkers() — extracted from cmd/server/workers.go
```

### Extension Point Interfaces

```go
// api/server/options.go

package server

// Config defines how an edition wires up the server.
type Config struct {
    // Identity
    Name    string // "OpenCTEM" or "Exploop"
    Version string

    // Extension points — EE adds to these, never replaces core
    ExtraAuthProviders []AuthProvider
    ExtraModules       []FeatureModule
    ExtraMiddleware    []func(http.Handler) http.Handler
    ExtraMigrationDirs []string

    // Hooks — EE can run code at specific lifecycle points
    OnBeforeStart func(deps *Dependencies) error
    OnAfterStart  func(deps *Dependencies)
}

// AuthProvider adds an authentication method.
type AuthProvider interface {
    Name() string
    Middleware() func(http.Handler) http.Handler
    RegisterRoutes(r chi.Router)
}

// FeatureModule adds an entire feature (routes + services + migrations).
type FeatureModule interface {
    ID() string
    Name() string
    RegisterRoutes(r chi.Router, deps RouteDeps)
    RegisterServices(deps ServiceDeps)
    MigrationDir() string // empty = no migrations
}

// Dependencies exposes core infrastructure for EE to use.
type Dependencies struct {
    Config  *config.Config
    Logger  *logger.Logger
    DB      *sql.DB
    Redis   *redis.Client
    Repos   *Repositories
    Svcs    *Services
    Router  chi.Router
}
```

### Extracted Wire Functions

```go
// api/server/wire.go
// Extracted from cmd/server/repositories.go, services.go, handlers.go

package server

func NewRepositories(db *postgres.DB) *Repositories { ... }
func NewServices(deps *ServiceDeps) (*Services, error) { ... }
func NewHandlers(deps *HandlerDeps) *Handlers { ... }
func NewWorkers(deps *WorkerDeps) (*Workers, error) { ... }
```

### Server.Run()

```go
// api/server/server.go

package server

func Run(cfg Config) {
    // 1. Load config
    appCfg := config.MustLoad()

    // 2. App name override
    if cfg.Name != "" {
        appCfg.App.Name = cfg.Name
    }

    // 3. Infrastructure (same as current main.go)
    db := postgres.MustNew(&appCfg.Database)
    redisClient := redis.MustNew(&appCfg.Redis, log)

    // 4. Run core migrations + extra migration dirs
    runMigrations(db, append([]string{"core/migrations"}, cfg.ExtraMigrationDirs...))

    // 5. Wire core
    repos := NewRepositories(db)
    svcs := NewServices(...)
    handlers := NewHandlers(...)

    // 6. Register core routes
    router := chi.NewRouter()
    routes.Register(router, handlers, ...)

    // 7. Register EE auth providers
    for _, provider := range cfg.ExtraAuthProviders {
        provider.RegisterRoutes(router)
    }

    // 8. Register EE modules
    for _, mod := range cfg.ExtraModules {
        mod.RegisterRoutes(router, routeDeps)
        mod.RegisterServices(svcDeps)
    }

    // 9. Register EE middleware
    for _, mw := range cfg.ExtraMiddleware {
        router.Use(mw)
    }

    // 10. Lifecycle hooks
    deps := &Dependencies{Config: appCfg, DB: db.DB, ...}
    if cfg.OnBeforeStart != nil {
        cfg.OnBeforeStart(deps)
    }

    // 11. Start (same as current)
    httpServer := http.NewServer(appCfg, log)
    go httpServer.Start()

    // 12. Graceful shutdown
    waitForSignal()
    httpServer.Shutdown()
}
```

### OSS Entry Point (after)

```go
// api/cmd/server/main.go — becomes trivial

package main

import "github.com/openctemio/api/server"

func main() {
    server.Run(server.Config{
        Name: "OpenCTEM",
    })
}
```

### Exploop Entry Point

```go
// exploop/cmd/server/main.go

package main

import (
    "github.com/openctemio/api/server"
    "github.com/exploop/features/sso"
    "github.com/exploop/features/auditpro"
    "github.com/exploop/license"
)

func main() {
    lic := license.MustLoad()

    server.Run(server.Config{
        Name: "Exploop",

        ExtraAuthProviders: []server.AuthProvider{
            sso.SAMLProvider(lic),
        },

        ExtraModules: []server.FeatureModule{
            auditpro.Module(lic),
        },

        ExtraMiddleware: []server.MiddlewareFunc{
            license.Middleware(lic),
        },

        ExtraMigrationDirs: []string{
            "exploop/migrations",
        },
    })
}
```

### Steps

| # | Step |
|---|------|
| 2.1 | Create `api/server/options.go` — Config, AuthProvider, FeatureModule interfaces |
| 2.2 | Create `api/server/wire.go` — extract `NewRepositories()`, `NewServices()`, `NewHandlers()` from `cmd/server/*.go` |
| 2.3 | Create `api/server/workers.go` — extract `NewWorkers()` |
| 2.4 | Create `api/server/server.go` — `Run()` function combining all steps |
| 2.5 | Create `api/server/defaults.go` — default auth, middleware |
| 2.6 | Rewrite `api/cmd/server/main.go` to call `server.Run()` |
| 2.7 | Verify: `go run ./cmd/server` — identical behavior |
| 2.8 | Verify: `docker compose up` — API works, all endpoints respond |

### Validation Checklist

- [ ] `api/cmd/server/main.go` is < 20 lines
- [ ] `go build ./...` — zero errors
- [ ] `go test ./...` — all pass
- [ ] API behavior identical (same routes, same responses)
- [ ] Exploop can compile with `server.Run(config)` calling 0 EE features

---

## Milestone 3: Full Architecture (Rename + UI Split)

**Goal:** Clean module name, UI package split, Exploop fully operational.
**Effort:** 1-2 weeks
**Risk:** Medium — large mechanical refactor + Next.js build complexity
**Files changed:** ~900 (Go + TS, mostly import paths)

### 3A: Rename Go Module (optional but clean)

```
BEFORE                                  AFTER
──────                                  ─────
module: github.com/openctemio/api       module: github.com/openctemio/core

api/                                    core/
├── app/                                ├── app/
├── infra/                              ├── infra/
├── config/                             ├── config/
├── pkg/domain/                         ├── domain/        ← pkg/domain/ flattened
├── pkg/crypto/                         ├── pkg/crypto/
├── server/                             ├── server/
├── migrations/                         ├── migrations/
└── cmd/server/                         (moves to server/)

api/cmd/server/                         server/             ← separate module
                                        ├── go.mod          ← require core
                                        ├── cmd/server/
                                        └── Dockerfile
```

**Import path changes:**

```go
// BEFORE (after Milestone 1-2)
import "github.com/openctemio/api/app"
import "github.com/openctemio/api/infra/postgres"
import "github.com/openctemio/api/pkg/domain/asset"
import "github.com/openctemio/api/server"

// AFTER
import "github.com/openctemio/core/app"
import "github.com/openctemio/core/infra/postgres"
import "github.com/openctemio/core/domain/asset"
import "github.com/openctemio/core/server"
```

| # | Step |
|---|------|
| 3A.1 | Rename `api/` → `core/`, update `go.mod` module path |
| 3A.2 | Move `pkg/domain/` → `domain/` (flatten, remove `pkg/` wrapper) |
| 3A.3 | Create separate `server/` module with `go.mod` requiring `core` |
| 3A.4 | Find-replace all import paths (~400 Go files) |
| 3A.5 | Update `go.work` to include `core/` and `server/` |
| 3A.6 | Update `docker-compose.yml` build contexts |
| 3A.7 | Update CI/CD pipelines |

### 3B: UI Package Split

```
BEFORE                                AFTER
──────                                ─────
ui/                                   ui/
├── src/                              ├── packages/
│   ├── app/                          │   └── core/              @openctem/ui-core
│   ├── components/                   │       ├── package.json
│   ├── features/                     │       └── src/
│   ├── hooks/                        │           ├── components/
│   ├── lib/                          │           ├── features/   (41 modules)
│   ├── context/                      │           ├── hooks/
│   ├── stores/                       │           ├── lib/
│   └── types/                        │           ├── context/
│                                     │           ├── stores/
│                                     │           └── types/
│                                     │
│                                     ├── apps/
│                                     │   └── openctem/           OpenCTEM app
│                                     │       ├── package.json    depends on @openctem/ui-core
│                                     │       ├── src/
│                                     │       │   ├── app/        App Router routes (from src/app/)
│                                     │       │   └── config/     sidebar.ts
│                                     │       ├── proxy.ts
│                                     │       └── next.config.ts
│                                     │
│                                     ├── pnpm-workspace.yaml
│                                     └── turbo.json
```

**Import changes:**

```tsx
// BEFORE
import { Button } from '@/components/ui/button'
import { useAssets } from '@/features/assets/hooks/use-assets'

// AFTER (in apps/openctem/)
import { Button } from '@core/components/ui/button'
import { useAssets } from '@core/features/assets/hooks/use-assets'

// OR: re-export from core index
import { Button } from '@openctem/ui-core/components'
import { useAssets } from '@openctem/ui-core/features/assets'
```

| # | Step |
|---|------|
| 3B.1 | Setup pnpm workspace (`pnpm-workspace.yaml`) |
| 3B.2 | Setup Turborepo (`turbo.json`) |
| 3B.3 | Create `packages/core/package.json` as `@openctem/ui-core` |
| 3B.4 | Move `src/components/`, `src/features/`, `src/hooks/`, `src/lib/`, `src/context/`, `src/stores/`, `src/types/` → `packages/core/src/` |
| 3B.5 | Create `apps/openctem/package.json` depending on `@openctem/ui-core` |
| 3B.6 | Move `src/app/` → `apps/openctem/src/app/` |
| 3B.7 | Move `src/config/` → `apps/openctem/src/config/` |
| 3B.8 | Move `proxy.ts`, `next.config.ts` → `apps/openctem/` |
| 3B.9 | Setup `@core/*` path alias in `tsconfig.json` |
| 3B.10 | Update all `@/` imports in core package to relative or `@core/` |
| 3B.11 | Verify: `pnpm dev` → Next.js runs, all pages work |
| 3B.12 | Verify: `pnpm build` → production build succeeds |
| 3B.13 | Verify: `pnpm test` → all tests pass |

### 3C: Exploop Repository

| # | Step |
|---|------|
| 3C.1 | Create `exploop/` private repo |
| 3C.2 | `go.mod` requiring `github.com/openctemio/core` |
| 3C.3 | `go.work` for local dev: `use ../openctemio/core` |
| 3C.4 | `cmd/server/main.go` — `server.Run(config{Name: "Exploop"})` |
| 3C.5 | `license/` package (stub for dev, real validation for prod) |
| 3C.6 | `ui/` — Next.js app depending on `@openctem/ui-core` |
| 3C.7 | `docker-compose.yml` for Exploop dev environment |
| 3C.8 | Verify: Exploop starts, identical to OpenCTEM (no EE features yet) |

---

## Final Architecture (after all milestones)

```
openctemio/                              PUBLIC repo
├── go.work                              use ./core ./server ./agent ./sdk-go
│
├── core/                                module: github.com/openctemio/core
│   ├── go.mod
│   ├── domain/                          48 domain packages (entities, interfaces)
│   ├── app/                             89 service files (business logic)
│   ├── infra/                           11 infra packages (postgres, redis, http...)
│   ├── config/                          Configuration
│   ├── pkg/                             Utilities (crypto, jwt, logger, etc.)
│   ├── server/                          Bootstrap API (Run, Config, extensions)
│   └── migrations/                      Core migrations
│
├── server/                              module: github.com/openctemio/server
│   ├── go.mod                           require github.com/openctemio/core
│   ├── cmd/server/main.go              10 lines: server.Run(config)
│   └── Dockerfile
│
├── ui/
│   ├── packages/core/                   @openctem/ui-core
│   │   └── src/                         components, features, hooks, lib, context
│   ├── apps/openctem/                   OpenCTEM Next.js app
│   │   └── src/app/                     App Router routes
│   ├── pnpm-workspace.yaml
│   └── turbo.json
│
├── agent/                               Unchanged
├── sdk-go/                              Unchanged
└── docker-compose.yml


exploop/                                 PRIVATE repo
├── go.mod                               require github.com/openctemio/core
├── go.work                              use . ../openctemio/core (dev only)
├── cmd/server/main.go                   20 lines: server.Run(config + EE)
├── features/                            SSO, audit-pro, compliance-auto...
├── license/                             License validation
├── migrations/                          EE-only migrations
├── ui/                                  Exploop Next.js app
│   ├── src/app/                         Core routes + EE routes
│   ├── src/features/                    EE-only UI features
│   └── src/branding/                    Exploop theme
└── docker-compose.yml
```

---

## Roadmap Summary

```
         Milestone 1              Milestone 2              Milestone 3
         (Minimal)                (Usable)                 (Full)
         ─────────                ────────                 ──────
What     Remove internal/        server.Run() API         Rename + UI split

         api/internal/app/       api/server/ package      api/ → core/
         → api/app/              with Config,             pkg/domain/ → domain/
                                 AuthProvider,            ui/ → packages/core +
         api/internal/infra/     FeatureModule            apps/openctem
         → api/infra/            interfaces
                                                          Exploop repo created
         api/internal/config/    OSS main.go → 10 lines
         → api/config/

Effort   ~1 day                  ~3-5 days                ~1-2 weeks

Risk     Low                     Medium                   Medium
         (mechanical move)       (redesign wiring)        (large rename + Next.js)

Result   Exploop CAN import      Exploop EASY to wire     Clean architecture
         OpenCTEM code           (one function call)      Production-ready

Files    ~300 Go                 ~10 new + ~5 modified    ~400 Go + ~500 TS
```

### When to Stop

- **Stop at M1** if: Just want to prototype Exploop quickly, OK with manual wiring
- **Stop at M2** if: Want a clean Exploop setup but don't need module rename or UI split yet
- **Complete M3** when: Going to production with Exploop, need clean architecture for team scaling

---

## Update Flow (after any milestone)

### During Development (local)

```bash
# exploop/go.work links to local OpenCTEM
use (
    .
    ../openctemio/core    # or ../openctemio/api (before M3)
)
# Change core → Exploop sees it immediately. No publish needed.
```

### Release Cycle

```bash
# 1. Tag OpenCTEM release
cd openctemio && git tag v1.5.0 && git push --tags

# 2. Exploop updates
cd exploop && go get github.com/openctemio/core@v1.5.0 && go mod tidy

# 3. UI update (after M3)
cd exploop/ui && pnpm update @openctem/ui-core
```

---

## What Does NOT Change

| Aspect | Status |
|--------|--------|
| Go clean architecture (domain → app → infra) | Preserved |
| DDD with 48 domain packages | Preserved |
| Repository pattern (interfaces in domain, impl in infra) | Preserved |
| Chi router + middleware pattern | Preserved |
| Next.js App Router conventions | Preserved |
| shadcn/ui component library | Preserved |
| Multi-tenant WHERE tenant_id = ? | Preserved |
| RBAC permission system | Preserved |
| Module system (modules + tenant_modules) | Preserved |
| Docker Compose dev setup | Preserved |
| All existing tests | Must pass at every milestone |

---

## Risks & Mitigations

| Risk | Milestone | Mitigation |
|------|-----------|------------|
| Import rename misses a file | M1 | `go build ./...` catches immediately |
| Circular dependency when moving packages | M1 | Domain packages have no internal deps — move first |
| server.Run() doesn't cover edge case | M2 | Keep `cmd/server/` as reference, diff behavior |
| Next.js build breaks with package split | M3 | Incremental: test 1 feature first, then batch |
| Exploop go.work diverges from published core | All | CI runs Exploop tests against core HEAD nightly |
| Git blame lost on moved files | M1, M3 | `git log --follow` still works. One-time cost. |

---

## Success Criteria

| Criterion | Milestone |
|-----------|-----------|
| Exploop can `import "github.com/openctemio/api/app"` | M1 |
| Exploop starts with `server.Run(config)` — 10 lines | M2 |
| Adding EE feature = implement FeatureModule, no core changes | M2 |
| `openctemio/` has zero references to `exploop/` | M1+ |
| All existing tests pass unchanged | All |
| Docker images build for both editions | M3 |
| `go get -u` in Exploop pulls latest core cleanly | M2+ |
