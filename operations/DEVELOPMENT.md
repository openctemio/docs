---
layout: default
title: Development Guide
parent: Operations
nav_order: 10
---

# Development Guide

This guide details the workflow for developing on the OpenCTEM platform.

## Architecture Overview

OpenCTEM follows a Polyrepo structure managed via a central Workspace (Meta-Repo).

*   **API**: Core business logic and REST endpoints.
*   **Agent**: Distributed security scanner that runs on customer infrastructure/CI.
*   **UI**: Web management console.
*   **SDK**: Shared libraries used by API and Agent.

## Workspace Management

We avoid Git Submodules in favor of a simpler "Meta-Repo" approach handling by `setup-workspace.sh`.

### Directory Layout

```
openctemio/               # Root Workspace (Meta-Repo)
├── Makefile             # Global orchestration
├── go.work              # Go Workspace config
├── setup-workspace.sh   # Ops script
├── api/                 # -> git@github.com:openctemio/api.git
├── agent/               # -> git@github.com:openctemio/agent.git
├── sdk/                 # -> git@github.com:openctemio/sdk.git
└── ...
```

## Daily Workflow

### 1. Syncing Code

Start your day by syncing all repositories:

```bash
make pull-all
```

This iterates through every subdirectory and runs `git pull`.

### 2. Cross-Module Development (Go)

If you need to add a feature to `sdk` and use it in `api`:

1.  Modify `sdk/pkg/newfeature.go`.
2.  In `api/go.mod`, **DO NOT** use `replace` directive.
3.  Because `go.work` exists in root, the `api` build will automatically use your local `sdk` code.
    ```go
    // In api/main.go
    import "github.com/openctemio/sdk-go/pkg/newfeature" // Works immediately!
    ```
4.  **Commit Sequence:**
    *   Commit & Push `sdk` first.
    *   Get the new `sdk` version/commit hash.
    *   Update `api/go.mod` to use the new `sdk` version:

        ```bash
        cd api
        go get github.com/openctemio/sdk-go@latest
        ```
    *   Commit & Push `api`.

## IDE Setup

### VS Code (Recommended)

#### Required Extensions

*   **Go**: `golang.go`
*   **Frontend**: `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode`

#### Workspace Settings

It is recommended to have a `.vscode/settings.json` in your workspace focusing on `go.lintTool: "golangci-lint"`.

### JetBrains (GoLand)

1.  Enable `goimports` on save.
2.  Set `golangci-lint` as external linter.

## Backend Development (API)

### Running Locally

```bash
cd api
make install-tools  # Install golangci-lint, air, migrate
make dev           # Run with hot reload
make run           # Run normally
```

### Database Migrations

```bash
make migrate-create name=add_users_table
make migrate-up
make migrate-down
```

### Testing

```bash
make test
make test-coverage
```

## Frontend Development (UI)

### Setup & Run

```bash
cd ui
npm install
npm run dev        # Dev mode with Turbopack
npm run lint -- --fix
```

## Environment Variables

### Generate Secrets

```bash
# JWT Secret (Backend)
openssl rand -base64 48

# CSRF Secret (Frontend)
openssl rand -base64 32
```

### Docker Development

Use the root Makefile to spin up the full stack:

```bash
make up        # Start Postgres, Keycloak, etc.
make logs      # View logs
make down      # Stop everything
```

## Troubleshooting

### Go Module Issues

If VSCode complains about modules:
1.  Open the **Root Folder** (`openctemio/`).
2.  Run `go work sync`.
3.  Restart VSCode/Go Language Server.

### Docker Issues

```bash
# Clean everything
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
// File: ui/src/components/AssetActions.tsx
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
// File: ui/src/components/ProtectedSection.tsx
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
// File: ui/src/stores/auth-store.ts
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
