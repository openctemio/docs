---
layout: default
title: Permission System
parent: Platform Guides
nav_order: 3
---

# Permission System - Complete Guide

Comprehensive guide to the 3-layer access control system in OpenCTEM.

---

## Overview

OpenCTEM implements a **3-Layer Access Control** architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 1: MODULES (Tenant)                     │
├─────────────────────────────────────────────────────────────────┤
│  Tenant → Enabled Modules                                        │
│  "What modules can this tenant access?"                         │
│  Determined by: Tenant module configuration                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 2: RBAC (User)                          │
├─────────────────────────────────────────────────────────────────┤
│  User → Roles → Permissions                                      │
│  "What can this user do within allowed modules?"                 │
│  Note: Can only assign permissions from modules tenant has       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 3: DATA SCOPE (Groups)                  │
├─────────────────────────────────────────────────────────────────┤
│  User → Groups → Assets/Data                                     │
│  "What data can this user see?"                                  │
│  Determined by: Group membership and asset ownership             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Module Access (Tenant Level)

### Module Configuration

Each tenant has a set of enabled modules that determines feature access:

### Module Service

```go
// Check if tenant has access to a module
hasModule, err := moduleService.CheckModuleAccess(ctx, tenantID, "findings")

// Get tenant's enabled modules
modules, err := moduleService.GetTenantModules(ctx, tenantID)
```

### API Endpoints

```
GET /api/v1/me/modules         # Get tenant's enabled modules
```

---

## Layer 2: RBAC (User Level)

### Membership Levels

| Level | isAdmin JWT | Permissions in JWT | Description |
|-------|:-----------:|:------------------:|-------------|
| **Owner** | ✅ true | nil | Full access including owner-only operations. Protected - cannot be removed. |
| **Admin** | ✅ true | nil | Almost full access. Cannot perform owner-only operations. |
| **Member** | ❌ false | ~42 permissions | Standard read/write access. Permissions from RBAC roles. |
| **Viewer** | ❌ false | ~25 permissions | Read-only access. Permissions from RBAC roles. |

**Key Points:**
- **Owner** has ALL permissions - bypasses all permission checks
- **Admin** has almost all permissions - bypasses general permission checks, but NOT owner-only operations
- **Member/Viewer** - permissions checked from JWT (included in token to keep JWT under 4KB browser cookie limit)
- All invited users become "member" automatically
- Actual permissions are determined by RBAC roles

**Owner-only Operations** (Admin cannot perform):

| Permission | Description |
|------------|-------------|
| `TeamDelete` | Delete the tenant |
| `BillingManage` | Manage billing settings |
| `GroupsDelete` | Delete access control groups |
| `PermissionSetsDelete` | Delete permission sets |
| `AssignmentRulesDelete` | Delete assignment rules |

### System Roles

| Role | Permission Count | Description |
|------|-----------------|-------------|
| **Administrator** | 115+ | Full administrative access |
| **Member** | 49+ | Standard read/write access |
| **Viewer** | 38+ | Read-only access |

### Custom Roles

Tenants can create custom roles with any combination of permissions:
- Security Analyst
- Developer
- Compliance Officer
- etc.

### Permission Resolution

```
User's Effective Permissions = Union of all assigned Role permissions

Exception: Owner has ALL permissions regardless of roles
```

### Permission Check Flow

```
API Request
    ↓
Auth Middleware (validate JWT)
    ↓
Extract user_id, tenant_id, role, isAdmin from token
    ↓
Check: Does user have required permission?
    │
    ├── If isAdmin=true (Owner/Admin) → Bypass permission check ✓
    │
    ├── For Local Auth: Check permissions[] array from JWT
    │
    └── For OIDC: Check roles from Keycloak claims
    ↓
If permission granted → Call Handler
If permission denied → 403 Forbidden
```

### Owner-only Operations Check

For sensitive owner-only operations, use `RequireOwner()` middleware:

```go
// In routes.go
r.With(middleware.RequireOwner()).Delete("/tenant", h.DeleteTenant)
r.With(middleware.RequireOwner()).Post("/billing/manage", h.ManageBilling)

// The middleware checks: role == "owner"
// Returns 403 if not owner
```

---

## Layer 3: Data Scope (Groups)

### Group Types

| Type | Purpose |
|------|---------|
| `security_team` | SOC, AppSec, Pentest teams |
| `asset_owner` | Teams owning specific assets |
| `team` | Development teams |
| `department` | Organizational departments |
| `project` | Project-specific access |
| `external` | Vendors, contractors |
| `custom` | Other use cases |

### Group Features

- **Members**: Users in the group (with role: admin, member)
- **Assets**: Assets owned by the group (primary, shared ownership)
- **Data Scope**: Members can only see data related to group's assets

### Data Scope Resolution

```
User's Accessible Data = Union of all Group's assets

Users with hasFullDataAccess = true can see ALL tenant data
```

---

## Permission Naming Convention

Permissions follow a hierarchical naming pattern:

```
{module}:{subfeature}:{action}
```

Examples:
- `integrations:scm:read` - View SCM connections
- `assets:groups:write` - Manage asset groups
- `team:roles:assign` - Assign roles to users

For simpler permissions without subfeatures:

```
{module}:{action}
```

Examples:
- `dashboard:read` - View dashboard
- `assets:read` - View assets
- `findings:write` - Edit findings

---

## Complete Permission Matrix

### Assets Module

| Permission | Administrator | Member | Viewer | Description |
|-----------|:-------------:|:------:|:------:|-------------|
| `assets:read` | ✅ | ✅ | ✅ | View all asset types (domains, repos, cloud, hosts, etc.) |
| `assets:write` | ✅ | ✅ | ❌ | Create/edit all asset types |
| `assets:delete` | ✅ | ❌ | ❌ | Delete all asset types |
| `assets:groups:read` | ✅ | ✅ | ✅ | View asset groups |
| `assets:groups:write` | ✅ | ✅ | ❌ | Manage asset groups |
| `assets:groups:delete` | ✅ | ❌ | ❌ | Delete asset groups |
| `assets:components:read` | ✅ | ✅ | ✅ | View SBOM components |
| `assets:components:write` | ✅ | ✅ | ❌ | Manage SBOM components |
| `assets:components:delete` | ✅ | ❌ | ❌ | Delete SBOM components |

> **Note**: `assets:*` permissions cover ALL asset types including domains, websites, services, repositories, branches, cloud resources, hosts, Kubernetes, databases, mobile apps, and APIs. Data scoping (who can see which assets) is controlled by Groups (Layer 3), not by asset-type-specific permissions.

### Findings Module

| Permission | Administrator | Member | Viewer |
|-----------|:-------------:|:------:|:------:|
| `findings:read` | ✅ | ✅ | ✅ |
| `findings:write` | ✅ | ✅ | ❌ |
| `findings:delete` | ✅ | ❌ | ❌ |
| `findings:vulnerabilities:read` | ✅ | ✅ | ✅ |
| `findings:vulnerabilities:write` | ✅ | ✅ | ❌ |
| `findings:credentials:read` | ✅ | ✅ | ✅ |
| `findings:credentials:write` | ✅ | ✅ | ❌ |
| `findings:remediation:read` | ✅ | ✅ | ✅ |
| `findings:remediation:write` | ✅ | ✅ | ❌ |
| `findings:workflows:read` | ✅ | ✅ | ✅ |
| `findings:workflows:write` | ✅ | ❌ | ❌ |
| `findings:policies:read` | ✅ | ✅ | ✅ |
| `findings:policies:write` | ✅ | ❌ | ❌ |

### Scans Module

| Permission | Administrator | Member | Viewer |
|-----------|:-------------:|:------:|:------:|
| `scans:read` | ✅ | ✅ | ✅ |
| `scans:write` | ✅ | ✅ | ❌ |
| `scans:delete` | ✅ | ❌ | ❌ |
| `scans:execute` | ✅ | ✅ | ❌ |
| `scans:profiles:read` | ✅ | ✅ | ✅ |
| `scans:profiles:write` | ✅ | ✅ | ❌ |
| `scans:sources:read` | ✅ | ✅ | ✅ |
| `scans:sources:write` | ✅ | ✅ | ❌ |
| `scans:tools:read` | ✅ | ✅ | ✅ |
| `scans:tools:write` | ✅ | ❌ | ❌ |
| `scans:tenant_tools:read` | ✅ | ✅ | ✅ |
| `scans:tenant_tools:write` | ✅ | ✅ | ❌ |
| `scans:templates:read` | ✅ | ✅ | ✅ |
| `scans:templates:write` | ✅ | ✅ | ❌ |
| `scans:templates:delete` | ✅ | ❌ | ❌ |
| `scans:secret_store:read` | ✅ | ✅ | ❌ |
| `scans:secret_store:write` | ✅ | ❌ | ❌ |
| `scans:secret_store:delete` | ✅ | ❌ | ❌ |

### Team Module (Access Control)

| Permission | Administrator | Member | Viewer |
|-----------|:-------------:|:------:|:------:|
| `team:read` | ✅ | ✅ | ✅ |
| `team:update` | ✅ | ❌ | ❌ |
| `team:delete` | ✅ | ❌ | ❌ |
| `team:members:read` | ✅ | ✅ | ✅ |
| `team:members:invite` | ✅ | ❌ | ❌ |
| `team:members:write` | ✅ | ❌ | ❌ |
| `team:groups:read` | ✅ | ✅ | ✅ |
| `team:groups:write` | ✅ | ❌ | ❌ |
| `team:groups:delete` | ✅ | ❌ | ❌ |
| `team:groups:members` | ✅ | ❌ | ❌ |
| `team:groups:assets` | ✅ | ❌ | ❌ |
| `team:roles:read` | ✅ | ✅ | ✅ |
| `team:roles:write` | ✅ | ❌ | ❌ |
| `team:roles:delete` | ✅ | ❌ | ❌ |
| `team:roles:assign` | ✅ | ❌ | ❌ |
| `team:permission_sets:read` | ✅ | ✅ | ✅ |
| `team:permission_sets:write` | ✅ | ❌ | ❌ |
| `team:assignment_rules:read` | ✅ | ✅ | ✅ |
| `team:assignment_rules:write` | ✅ | ❌ | ❌ |

### Integrations Module

| Permission | Administrator | Member | Viewer |
|-----------|:-------------:|:------:|:------:|
| `integrations:read` | ✅ | ✅ | ✅ |
| `integrations:manage` | ✅ | ❌ | ❌ |
| `integrations:scm:read` | ✅ | ✅ | ✅ |
| `integrations:scm:write` | ✅ | ❌ | ❌ |
| `integrations:scm:delete` | ✅ | ❌ | ❌ |
| `integrations:notifications:read` | ✅ | ✅ | ✅ |
| `integrations:notifications:write` | ✅ | ❌ | ❌ |
| `integrations:webhooks:read` | ✅ | ✅ | ✅ |
| `integrations:webhooks:write` | ✅ | ❌ | ❌ |
| `integrations:api_keys:read` | ✅ | ✅ | ❌ |
| `integrations:api_keys:write` | ✅ | ❌ | ❌ |
| `integrations:pipelines:read` | ✅ | ✅ | ✅ |
| `integrations:pipelines:write` | ✅ | ✅ | ❌ |
| `integrations:pipelines:execute` | ✅ | ✅ | ❌ |

### Settings Module

| Permission | Administrator | Member | Viewer |
|-----------|:-------------:|:------:|:------:|
| `settings:billing:read` | ✅ | ❌ | ❌ |
| `settings:billing:write` | ✅ | ❌ | ❌ |
| `settings:sla:read` | ✅ | ✅ | ✅ |
| `settings:sla:write` | ✅ | ❌ | ❌ |

### Other Modules

| Permission | Administrator | Member | Viewer |
|-----------|:-------------:|:------:|:------:|
| `dashboard:read` | ✅ | ✅ | ✅ |
| `audit:read` | ✅ | ❌ | ❌ |
| `reports:read` | ✅ | ✅ | ✅ |
| `reports:write` | ✅ | ✅ | ❌ |
| `validation:read` | ✅ | ✅ | ✅ |
| `validation:write` | ✅ | ✅ | ❌ |
| `attack_surface:scope:read` | ✅ | ✅ | ✅ |
| `attack_surface:scope:write` | ✅ | ✅ | ❌ |
| `agents:read` | ✅ | ✅ | ✅ |
| `agents:write` | ✅ | ✅ | ❌ |
| `agents:commands:read` | ✅ | ✅ | ✅ |
| `agents:commands:write` | ✅ | ✅ | ❌ |

---

## Backend Implementation

### Permission Middleware

```go
// routes.go
r.Route("/assets", func(r chi.Router) {
    // Read endpoints
    r.With(middleware.Require(permission.AssetsRead)).Get("/", h.List)
    r.With(middleware.Require(permission.AssetsRead)).Get("/{id}", h.Get)

    // Write endpoints
    r.With(middleware.Require(permission.AssetsWrite)).Post("/", h.Create)
    r.With(middleware.Require(permission.AssetsWrite)).Put("/{id}", h.Update)

    // Delete endpoints
    r.With(middleware.Require(permission.AssetsDelete)).Delete("/{id}", h.Delete)
})
```

### Permission Check Types

```go
// Single permission check
middleware.Require(permission.AssetsWrite)

// Any of multiple permissions (OR logic)
middleware.RequireAny(permission.AssetsRead, permission.RepositoriesRead)

// All permissions required (AND logic)
middleware.RequireAll(permission.AssetsWrite, permission.RepositoriesWrite)

// Admin check (owner membership)
middleware.RequireAdmin()
```

### Service Layer Permission Check

```go
// 3-Layer check in service
func (s *AuthService) CheckPermission(ctx context.Context, userID, tenantID, permission string) error {
    // Layer 1: Check tenant has the module enabled
    moduleSlug := extractModuleFromPermission(permission)
    hasModule, err := s.moduleService.CheckModuleAccess(ctx, tenantID, moduleSlug)
    if err != nil || !hasModule {
        return ErrModuleNotEnabled
    }

    // Layer 2: Check user has permission via RBAC
    hasPermission, err := s.roleService.HasPermission(ctx, tenantID, userID, permission)
    if err != nil || !hasPermission {
        return ErrPermissionDenied
    }

    // Layer 3: Data scope is checked at query level
    return nil
}
```

---

## Frontend Implementation

### Permission Hooks

```typescript
import { usePermissions, Permission } from '@/lib/permissions';

const { can, canAny, canAll, permissions } = usePermissions();

// Single permission check
if (can(Permission.AssetsWrite)) {
  // Show edit button
}

// Any of multiple permissions
if (canAny(Permission.FindingsRead, Permission.DashboardRead)) {
  // Show stats
}

// All permissions required
if (canAll(Permission.AssetsWrite, Permission.AssetsDelete)) {
  // Show bulk actions
}
```

### Permission Guard Components

```tsx
import { Can, Permission } from '@/lib/permissions';

// Hide mode (default) - completely hides if no permission
<Can permission={Permission.AssetsWrite}>
  <Button>Edit Asset</Button>
</Can>

// Disable mode - shows disabled button with tooltip
<Can permission={Permission.AssetsDelete} mode="disable">
  <Button>Delete Asset</Button>
</Can>
```

### Module Access Check

```typescript
import { useTenantModules } from '@/features/integrations/api/use-tenant-modules';

const { moduleIds, modules, eventTypes, isLoading } = useTenantModules();

// Check if tenant has access to a module
const hasFindings = moduleIds.includes('findings');
```

---

## API Endpoints

### Permissions

```
GET /api/v1/permissions              # List all available permissions
GET /api/v1/permissions/modules      # List permission modules
GET /api/v1/me/permissions           # Get current user's effective permissions
```

### Roles

```
GET    /api/v1/roles                 # List all roles
POST   /api/v1/roles                 # Create custom role
GET    /api/v1/roles/{id}            # Get role details
PUT    /api/v1/roles/{id}            # Update role
DELETE /api/v1/roles/{id}            # Delete custom role
GET    /api/v1/users/{id}/roles      # Get user's roles
PUT    /api/v1/users/{id}/roles      # Set user's roles
```

### Groups

```
GET    /api/v1/groups                # List groups
POST   /api/v1/groups                # Create group
GET    /api/v1/groups/{id}           # Get group details
PUT    /api/v1/groups/{id}           # Update group
DELETE /api/v1/groups/{id}           # Delete group
GET    /api/v1/groups/{id}/members   # List group members
POST   /api/v1/groups/{id}/members   # Add member
GET    /api/v1/groups/{id}/assets    # List group assets
POST   /api/v1/groups/{id}/assets    # Assign asset
```

### Licensing

```
GET /api/v1/plans                    # List public plans
GET /api/v1/plans/{id}               # Get plan details
GET /api/v1/me/modules               # Get tenant's enabled modules
GET /api/v1/me/subscription          # Get tenant's subscription
GET /api/v1/me/modules/{id}          # Check specific module access
```

---

## Real-time Permission Sync

### X-Permission-Version Header

The API includes an `X-Permission-Version` header in all authenticated responses. This enables real-time permission updates without WebSockets or polling.

**How it works:**

1. Every API response includes `X-Permission-Version: <timestamp>`
2. When permissions change (role update, etc.), the version is incremented
3. Frontend compares response header with stored version
4. If version changes, frontend refreshes permissions from `/api/v1/me/permissions`

**Frontend Implementation:**

```typescript
// In axios/fetch interceptor
const newVersion = response.headers.get('X-Permission-Version');
if (newVersion && newVersion !== storedVersion) {
  // Permission changed, refresh from API
  await refreshPermissions();
  storedVersion = newVersion;
}
```

**Benefits:**
- No WebSocket complexity
- No constant polling
- Permissions refresh only when changed
- Works with existing HTTP infrastructure

---

## Best Practices

### 1. Principle of Least Privilege

Start with minimal permissions and add as needed.

### 2. Role Design

- **Keep roles focused**: Each role should represent a job function
- **Don't over-permission**: Avoid creating roles with all permissions
- **Use descriptive names**: "Security Analyst" not "Role 1"

### 3. Group Organization

- **Map to org structure**: Teams, departments, projects
- **Asset ownership**: Assign assets to groups that own them
- **Avoid overlapping scope**: Clear boundaries between groups

### 4. Regular Access Reviews

- Review member list quarterly
- Remove inactive members
- Downgrade unused admin accounts

---

## Troubleshooting

### User can't access a feature

1. **Check tenant's plan**: Does the plan include the required module?
2. **Check user's roles**: Does the user have the required permission?
3. **Check role assignment**: Is the role properly assigned?

### User can't see certain data

1. **Check user's groups**: Are they in a group with access?
2. **Check asset assignment**: Is the asset assigned to the group?
3. **Check hasFullDataAccess**: Does user's role have full data access?

### Permission changes not taking effect

1. Check `X-Permission-Version` header in API responses
2. Frontend should auto-refresh when version changes
3. If still not working, check Redis cache invalidation
4. User may need to re-login (JWT refresh)
5. Clear browser cookies
6. Check if role was saved successfully

---

## Related Documentation

- [Roles and Permissions Guide](./roles-and-permissions.md)
- [Group-Based Access Control](./group-based-access-control.md)
- [Authentication Guide](./authentication.md)

---

**Last Updated**: 2026-01-27
