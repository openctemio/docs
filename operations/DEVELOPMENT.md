---
layout: default
title: Development Guide
parent: Operations
nav_order: 10
---

# Development Guide

This guide covers the development workflow for the OpenCTEM platform.

## Repositories

The API and the web console live in one repository and ship together; the
other components are released on their own.

| Repository | Contents | Released as |
|------------|----------|-------------|
| [openctem](https://github.com/openctemio/openctem) | `api/` (Go API server, migrations, `bootstrap-admin`; module `github.com/openctemio/openctem/api`) and `web/` (Next.js web console) | One `vX.Y.Z` tag: images `ghcr.io/openctemio/openctem-api`, `openctem-web`, `openctem` (all-in-one) |
| [sensor](https://github.com/openctemio/sensor) | Scanning sensor (formerly "agent") that runs on your infrastructure or in CI | `openctemio-sensor` binaries, `ghcr.io/openctemio/sensor` |
| [sdk-go](https://github.com/openctemio/sdk-go) | Go SDK used by the API and the sensor | Go module tags |
| [ctis](https://github.com/openctemio/ctis) | CTIS ingest schema (the shared contract) | Schema tags |
| [helm-charts](https://github.com/openctemio/helm-charts) | Kubernetes chart | Chart releases |
| [docs](https://github.com/openctemio/docs) | This documentation site | GitHub Pages |

`openctemio/openctem` was `openctemio/api` before the merge; old links to it
redirect. The web console's earlier history is in the archived
[openctemio/ui](https://github.com/openctemio/ui) repository and is imported
under `web/` (its tags as `ui/v*`, which are history only and never released).

### Layout of the main repository

```
openctem/
├── Makefile          # thin root targets that delegate to api/ and web/
├── .githooks/        # git hooks, enabled by `make setup` / `make hooks`
├── api/              # Go API (own Makefile, go.mod, docs/, deploy/)
│   └── deploy/       # production Docker Compose stack + gateway
├── web/              # Next.js web console (own package.json, docs/)
└── deploy/allinone/  # all-in-one image (API + web + gateway)
```

## Getting the code

```bash
git clone https://github.com/openctemio/openctem.git
cd openctem
make setup     # go mod download, npm ci, enable the git hooks
```

Pull requests target the `develop` branch.

## Daily workflow

From the repository root:

```bash
make dev-api   # API with hot reload (air); needs Postgres and Redis, see below
make dev-web   # web console on http://localhost:3000
make lint      # what CI gates on, both components
make test      # unit tests, both components
make check     # API contract checks (OpenAPI spec and generated web types)
```

`make api-<target>` runs any `api/Makefile` target (for example
`make api-migrate-up`), and `make web-<script>` runs any `web/package.json`
script (for example `make web-format`).

### API contract changes

`api/api/openapi/swagger.yaml` is generated from the handler annotations, and
the web wire types (`web/src/lib/api/generated/api.types.ts`) are generated from
it. Change both in one pull request:

```bash
make -C api swagger
make api-types
```

### Working on the SDK

The API and the sensor consume `github.com/openctemio/sdk-go` as a normal Go
module dependency (the API builds with `GOWORK=off`). To use an unreleased SDK
change:

1. Change and release `sdk-go` first (merge and tag).
2. In the consumer, bump the dependency:

   ```bash
   cd api   # or the sensor repository
   GOWORK=off go get github.com/openctemio/sdk-go@<version>
   GOWORK=off go mod tidy
   ```

For local experiments only, a `replace github.com/openctemio/sdk-go => ../../sdk-go`
line in `api/go.mod` works; never commit it.

## IDE Setup

### VS Code (Recommended)

#### Required Extensions

*   **Go**: `golang.go`
*   **Frontend**: `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode`

Open `api/` (or the repository root with `go.useLanguageServer` pointed at
`api/`) so gopls finds `api/go.mod`. Use `golangci-lint` as the lint tool.

### JetBrains (GoLand)

1.  Enable `goimports` on save.
2.  Set `golangci-lint` as external linter.

## Backend Development (API)

### Running Locally

```bash
cd api
make install-tools                 # golangci-lint, air, migrate
docker compose up -d postgres redis
make dev                           # run with hot reload
make run                           # run normally
```

### Database Migrations

```bash
cd api
make migrate-create name=add_users_table
make migrate-up
make migrate-down
```

### Testing

```bash
cd api
make test
make test-coverage
```

## Frontend Development (web)

### Setup & Run

```bash
cd web
npm ci
npm run dev        # Dev mode with Turbopack
npm run lint:fix
```

Developer documentation for the web console (architecture, API integration,
type customization, deployment) lives with the code in
[`web/docs/`](https://github.com/openctemio/openctem/tree/main/web/docs).

## Environment Variables

### Generate Secrets

```bash
# JWT Secret (Backend)
openssl rand -base64 48

# CSRF Secret (Frontend)
openssl rand -base64 32
```

### Production-like stack

The Docker Compose stack in `api/deploy/` runs the gateway, web, API, Postgres
and Redis behind one HTTPS port; see
[Exposing OpenCTEM: one HTTPS port](single-https-port.md).

## Troubleshooting

### Go Module Issues

The API is built with `GOWORK=off`. If a stray `go.work` in a parent directory
changes which module versions the editor or `go build` resolves, set
`GOWORK=off` (or delete that `go.work`) and restart the Go language server.

### Docker Issues

```bash
# Clean everything (deletes the data volumes)
docker compose down -v
docker system prune -a
```

---

## Permission System (Hybrid JWT + Redis)

### Overview

OpenCTEM uses a **hybrid JWT + Redis permission system**:
- **JWT tokens** contain minimal user identity (~200 bytes)
- **Permissions** are fetched from Redis cache (<1ms) or PostgreSQL

See [Authentication Guide](../guides/authentication.md) for full details.

### Permission Check Examples

#### Backend: Middleware Permission Checks

```go
// File: api/internal/infra/http/routes.go

// Protect a route with specific permission
r.With(middleware.Require("assets:write")).Post("/assets", handler.CreateAsset)

// Multiple permission options (OR logic)
r.With(middleware.RequireAny("tenants:admin", "tenants:write")).Put("/tenants/{id}", handler.UpdateTenant)

// Check permission programmatically
func (h *AssetHandler) DeleteAsset(w http.ResponseWriter, r *http.Request) {
    if !middleware.HasPermission(r.Context(), "assets:delete") {
        http.Error(w, "Forbidden", http.StatusForbidden)
        return
    }
    // ... deletion logic
}
```

#### Backend: Service Layer Permission Loading

```go
// File: api/internal/app/permission_service.go

// Get user permissions (hybrid Redis + DB)
permissions, err := permissionService.GetUserPermissionsFromCache(
    ctx,
    userID,     // "66666666-6666-6666-6666-666666666666"
    tenantID,   // "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
)
// Returns: ["assets:read", "assets:write", "findings:read"]

// Invalidate cache when role changes
err = permissionService.InvalidateUserPermissionsCache(ctx, userID, tenantID)

// Invalidate all tenants for a user
err = permissionService.InvalidateAllUserPermissionsCache(ctx, userID)

// Preload permissions (e.g., after login)
err = permissionService.PreloadUserPermissionsToCache(ctx, userID, tenantID)
```

#### Frontend: Permission Checks in Components

```typescript
// File: web/src/components/AssetActions.tsx
import { usePermissions } from '@/lib/permissions/hooks'

function AssetActions() {
  const { hasPermission } = usePermissions()
  
  return (
    <>
      {hasPermission('assets:read') && <ViewButton />}
      {hasPermission('assets:write') && <EditButton />}
      {hasPermission('assets:delete') && <DeleteButton />}
    </>
  )
}
```

#### Frontend: Permission Gate

```typescript
// File: web/src/components/ProtectedSection.tsx
import { PermissionGate } from '@/components/permission-gate'

function AdminPanel() {
  return (
    <PermissionGate permission="tenants:admin">
      <AdminSettings />
    </PermissionGate>
  )
}
```

#### Frontend: Fetching Permissions

Permissions are automatically fetched after login:

```typescript
// File: web/src/stores/auth-store.ts
login: (accessToken: string) => {
  set({ accessToken, status: 'authenticated' })
  
  // Auto-fetch permissions from /api/v1/me/permissions
  get().loadPermissions()
}

loadPermissions: async () => {
  const response = await fetch('/api/v1/me/permissions', {
    credentials: 'include',
  })
  const data = await response.json()
  set({ permissions: data.permissions || [] })
}
```

### Permission Naming Conventions

Use the format: `resource:action`

Examples:
```
assets:read
assets:write
assets:delete
tenants:admin
findings:read
users:write
```

### Testing Permissions

```bash
# 1. Get your access token after login
curl -X POST http://localhost:8080/api/v1/auth/login \
  -d '{"email":"user@example.com","password":"pass"}' \
  | jq -r '.access_token'

# 2. Check your permissions
curl http://localhost:8080/api/v1/me/permissions \
  -H "Cookie: refresh_token=..."
  
# Response:
# {
#   "user_id": "...",
#   "tenant_id": "...",
#   "permissions": ["assets:read", "assets:write"],
#   "group_count": 0
# }

# 3. Test a protected endpoint
curl http://localhost:8080/api/v1/assets \
  -H "Authorization: Bearer <access_token>"
```

### Related Documentation

- [JWT Structure](../backend/jwt-structure.md) - Token format and claims
- [Redis Setup](./redis-setup.md) - Permission cache configuration
- [Authentication Guide](../guides/authentication.md) - Full system overview
- [Permissions Guide](../guides/permissions.md) - Permission model details
