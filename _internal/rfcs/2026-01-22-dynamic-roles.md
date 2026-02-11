# Implementation Plan: Final Access Control Architecture

**Created:** 2026-01-22
**Updated:** 2026-01-22
**Status:** Implementation Plan
**Estimated Effort:** 4 Phases

---

## Executive Summary

Transition from the current access control system (hardcoded roles + complex groups/permission sets) to **Unified Architecture**:

1. **Roles in Database** - instead of hardcoded in code
2. **Permissions in Database** - using existing `modules` + `permissions` tables
3. **Multiple Roles per User** - user can have multiple roles, permissions = UNION
4. **Groups for Data Scoping Only** - no need for permission sets
5. **Custom Roles per Tenant** - tenant can create their own roles

---

## Current State Analysis

### Existing Implementation

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CURRENT STATE                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. HARDCODED ROLES (api/internal/domain/permission/role_mapping.go)│
│     └── RolePermissions map[tenant.Role][]Permission                │
│         ├── owner  → 70+ permissions                                │
│         ├── admin  → 60+ permissions                                │
│         ├── member → 40+ permissions                                │
│         └── viewer → 20+ permissions                                │
│                                                                      │
│  2. TENANT_MEMBERS TABLE (migrations/000003_tenants.up.sql)         │
│     └── role VARCHAR(50) CHECK (role IN ('owner','admin',...))      │
│                                                                      │
│  3. COMPLEX ACCESS CONTROL (migrations/000046_access_control.up.sql)│
│     ├── permission_sets                                             │
│     ├── permission_set_items                                        │
│     ├── groups + group_members                                      │
│     ├── group_permission_sets                                       │
│     ├── group_permissions (allow/deny overrides)                    │
│     └── asset_owners                                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Target State

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TARGET STATE                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. MODULES + PERMISSIONS (existing from 000046)                    │
│     ├── modules: assets, findings, scans, team, settings...        │
│     └── permissions: assets:read, findings:write, scans:trigger... │
│                                                                      │
│  2. ROLES IN DATABASE (new migration)                               │
│     └── roles table                                                 │
│         ├── System roles (is_system=true, tenant_id=NULL)          │
│         │   └── owner, admin, member, viewer (immutable)           │
│         └── Custom roles (is_system=false, tenant_id=UUID)         │
│             └── Created by tenant admins                            │
│                                                                      │
│  3. ROLE_PERMISSIONS TABLE (new migration)                          │
│     └── role_id → permission_id (FK to permissions table)          │
│                                                                      │
│  4. USER_ROLES TABLE (new - Multiple Roles per User)                │
│     └── user_id + tenant_id + role_id                               │
│     └── User can have MULTIPLE roles                                │
│     └── Permissions = UNION of all roles' permissions               │
│                                                                      │
│  5. GROUPS FOR DATA SCOPING ONLY                                    │
│     ├── groups + group_members (KEEP)                               │
│     ├── asset_owners (KEEP)                                         │
│     └── NO permission_sets, NO group_permissions                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    PERMISSION CALCULATION                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   User A ─┬─> Role: Developer ──────> [assets:read, scans:trigger] │
│           │                                                          │
│           └─> Role: Security Analyst ─> [findings:write, findings:  │
│                                           status, findings:priority]│
│                                                                      │
│   User A's Permissions = UNION:                                     │
│   [assets:read, scans:trigger, findings:write, findings:status,     │
│    findings:priority]                                                │
│                                                                      │
│   Data Access:                                                       │
│   - If ANY role has_full_data_access = true → Full access           │
│   - Else → Scoped by groups membership                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Database Schema Migration

### Duration: 1-2 days

### 1.1 Create New Migration File

**File:** `api/migrations/000047_roles_in_database.up.sql`

```sql
-- ============================================================================
-- MIGRATION: Move Roles from Code to Database
-- Uses existing modules + permissions tables from 000046
-- ============================================================================

-- =====================================================
-- 1. SEED MODULES (if not already seeded)
-- =====================================================
INSERT INTO modules (id, name, description, icon, display_order) VALUES
    ('assets', 'Assets', 'Asset management', 'server', 10),
    ('components', 'Components', 'Software components and dependencies', 'package', 20),
    ('branches', 'Branches', 'Code branches', 'git-branch', 25),
    ('findings', 'Findings', 'Security findings and vulnerabilities', 'alert-triangle', 30),
    ('vulnerabilities', 'Vulnerabilities', 'Vulnerability database', 'shield-alert', 35),
    ('scans', 'Scans', 'Security scans', 'scan', 40),
    ('policies', 'Policies', 'Security policies', 'file-text', 50),
    ('agents', 'Agents', 'Scan agents', 'cpu', 60),
    ('integrations', 'Integrations', 'External integrations', 'plug', 70),
    ('api_keys', 'API Keys', 'API key management', 'key', 75),
    ('webhooks', 'Webhooks', 'Webhook configurations', 'webhook', 78),
    ('notifications', 'Notifications', 'Notification settings', 'bell', 80),
    ('team', 'Team', 'Team management', 'users', 85),
    ('groups', 'Groups', 'Group management', 'users-cog', 87),
    ('roles', 'Roles', 'Role management', 'shield', 88),
    ('settings', 'Settings', 'Tenant settings', 'settings', 90),
    ('billing', 'Billing', 'Billing and subscription', 'credit-card', 95),
    ('reports', 'Reports', 'Reports and analytics', 'bar-chart', 100),
    ('audit', 'Audit', 'Audit logs', 'history', 110)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2. SEED PERMISSIONS (if not already seeded)
-- =====================================================
INSERT INTO permissions (id, module_id, name, description) VALUES
    -- Assets
    ('assets:read', 'assets', 'View Assets', 'View asset details and list'),
    ('assets:write', 'assets', 'Manage Assets', 'Create and update assets'),
    ('assets:delete', 'assets', 'Delete Assets', 'Remove assets permanently'),

    -- Components
    ('components:read', 'components', 'View Components', 'View component details'),
    ('components:write', 'components', 'Manage Components', 'Update component info'),
    ('components:delete', 'components', 'Delete Components', 'Remove components'),

    -- Branches
    ('branches:read', 'branches', 'View Branches', 'View branch details'),
    ('branches:write', 'branches', 'Manage Branches', 'Create and update branches'),
    ('branches:delete', 'branches', 'Delete Branches', 'Remove branches'),

    -- Findings
    ('findings:read', 'findings', 'View Findings', 'View security findings'),
    ('findings:write', 'findings', 'Update Findings', 'Modify finding details'),
    ('findings:delete', 'findings', 'Delete Findings', 'Remove findings'),
    ('findings:assign', 'findings', 'Assign Findings', 'Assign findings to users/groups'),
    ('findings:status', 'findings', 'Change Status', 'Update finding status'),
    ('findings:priority', 'findings', 'Set Priority', 'Change finding priority'),
    ('findings:export', 'findings', 'Export Findings', 'Export findings data'),
    ('findings:bulk_update', 'findings', 'Bulk Update', 'Update multiple findings at once'),

    -- Vulnerabilities
    ('vulnerabilities:read', 'vulnerabilities', 'View Vulnerabilities', 'View vulnerability database'),
    ('vulnerabilities:write', 'vulnerabilities', 'Manage Vulnerabilities', 'Update vulnerability info'),
    ('vulnerabilities:delete', 'vulnerabilities', 'Delete Vulnerabilities', 'Remove vulnerabilities'),

    -- Scans
    ('scans:read', 'scans', 'View Scans', 'View scan history and results'),
    ('scans:write', 'scans', 'Manage Scans', 'Configure scan settings'),
    ('scans:delete', 'scans', 'Delete Scans', 'Remove scan history'),
    ('scans:trigger', 'scans', 'Run Scans', 'Trigger new scans'),
    ('scans:cancel', 'scans', 'Cancel Scans', 'Stop running scans'),
    ('scans:schedule', 'scans', 'Schedule Scans', 'Create scan schedules'),

    -- Policies
    ('policies:read', 'policies', 'View Policies', 'View security policies'),
    ('policies:write', 'policies', 'Manage Policies', 'Create and update policies'),
    ('policies:delete', 'policies', 'Delete Policies', 'Remove policies'),

    -- Agents
    ('agents:read', 'agents', 'View Agents', 'View scan agents'),
    ('agents:write', 'agents', 'Manage Agents', 'Configure agents'),
    ('agents:delete', 'agents', 'Delete Agents', 'Remove agents'),

    -- Integrations
    ('integrations:read', 'integrations', 'View Integrations', 'View external integrations'),
    ('integrations:write', 'integrations', 'Manage Integrations', 'Configure integrations'),
    ('integrations:delete', 'integrations', 'Delete Integrations', 'Remove integrations'),

    -- API Keys
    ('api_keys:read', 'api_keys', 'View API Keys', 'View API key list'),
    ('api_keys:write', 'api_keys', 'Manage API Keys', 'Create and update API keys'),
    ('api_keys:delete', 'api_keys', 'Delete API Keys', 'Revoke API keys'),

    -- Webhooks
    ('webhooks:read', 'webhooks', 'View Webhooks', 'View webhook configurations'),
    ('webhooks:write', 'webhooks', 'Manage Webhooks', 'Configure webhooks'),
    ('webhooks:delete', 'webhooks', 'Delete Webhooks', 'Remove webhooks'),

    -- Notifications
    ('notifications:read', 'notifications', 'View Notifications', 'View notification settings'),
    ('notifications:write', 'notifications', 'Manage Notifications', 'Configure notifications'),
    ('notifications:delete', 'notifications', 'Delete Notifications', 'Remove notification configs'),

    -- Team Management
    ('members:read', 'team', 'View Members', 'See team members'),
    ('members:invite', 'team', 'Invite Members', 'Send invitations'),
    ('members:manage', 'team', 'Manage Members', 'Change roles, remove members'),
    ('team:read', 'team', 'View Team Settings', 'See team configuration'),
    ('team:update', 'team', 'Update Team', 'Modify team settings'),
    ('team:delete', 'team', 'Delete Team', 'Remove team permanently'),

    -- Groups
    ('groups:read', 'groups', 'View Groups', 'See groups list'),
    ('groups:write', 'groups', 'Manage Groups', 'Create and edit groups'),
    ('groups:delete', 'groups', 'Delete Groups', 'Remove groups'),
    ('groups:members', 'groups', 'Manage Group Members', 'Add/remove group members'),
    ('groups:assets', 'groups', 'Manage Group Assets', 'Assign assets to groups'),

    -- Roles
    ('roles:read', 'roles', 'View Roles', 'See available roles'),
    ('roles:write', 'roles', 'Manage Roles', 'Create and edit custom roles'),
    ('roles:delete', 'roles', 'Delete Roles', 'Remove custom roles'),

    -- Settings
    ('settings:read', 'settings', 'View Settings', 'See tenant configuration'),
    ('settings:write', 'settings', 'Update Settings', 'Modify settings'),

    -- Billing
    ('billing:read', 'billing', 'View Billing', 'See billing info'),
    ('billing:write', 'billing', 'Manage Billing', 'Update payment methods'),

    -- Reports
    ('reports:read', 'reports', 'View Reports', 'View reports and analytics'),
    ('reports:write', 'reports', 'Create Reports', 'Generate custom reports'),
    ('reports:export', 'reports', 'Export Reports', 'Export report data'),

    -- Audit
    ('audit:read', 'audit', 'View Audit Logs', 'See audit history')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 3. CREATE ROLES TABLE
-- =====================================================
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- NULL = system role (global), non-NULL = custom role (per tenant)
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

    slug VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- System roles are immutable (cannot be edited/deleted)
    is_system BOOLEAN NOT NULL DEFAULT FALSE,

    -- Hierarchy level: higher = more privileges
    -- owner=100, admin=80, member=50, viewer=20
    -- Custom roles can be between these levels
    hierarchy_level INT NOT NULL DEFAULT 50,

    -- Full data access (sees all assets regardless of group membership)
    has_full_data_access BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- System roles: unique globally (tenant_id IS NULL)
    -- Custom roles: unique per tenant
    CONSTRAINT roles_slug_unique UNIQUE NULLS NOT DISTINCT (tenant_id, slug)
);

-- =====================================================
-- 4. CREATE ROLE_PERMISSIONS TABLE (FK to permissions)
-- =====================================================
CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(100) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT role_permissions_unique UNIQUE (role_id, permission_id)
);

-- =====================================================
-- 5. CREATE INDEXES
-- =====================================================
CREATE INDEX idx_roles_tenant ON roles(tenant_id);
CREATE INDEX idx_roles_system ON roles(is_system) WHERE is_system = TRUE;
CREATE INDEX idx_roles_slug ON roles(slug);
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);

-- =====================================================
-- 6. SEED SYSTEM ROLES
-- =====================================================
INSERT INTO roles (id, tenant_id, slug, name, description, is_system, hierarchy_level, has_full_data_access)
VALUES
    ('00000000-0000-0000-0000-000000000001', NULL, 'owner', 'Owner',
     'Full access to everything including billing and team management',
     TRUE, 100, TRUE),

    ('00000000-0000-0000-0000-000000000002', NULL, 'admin', 'Administrator',
     'Administrative access to most resources',
     TRUE, 80, TRUE),

    ('00000000-0000-0000-0000-000000000003', NULL, 'member', 'Member',
     'Standard member with read/write access to assigned resources',
     TRUE, 50, FALSE),

    ('00000000-0000-0000-0000-000000000004', NULL, 'viewer', 'Viewer',
     'Read-only access to assigned resources',
     TRUE, 20, FALSE);

-- =====================================================
-- 7. SEED ROLE PERMISSIONS (Owner - ALL permissions)
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000001', id FROM permissions;

-- =====================================================
-- 8. SEED ROLE PERMISSIONS (Admin - all except billing:write, team:delete, roles:delete)
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000002', id
FROM permissions
WHERE id NOT IN ('billing:write', 'team:delete', 'roles:delete');

-- =====================================================
-- 9. SEED ROLE PERMISSIONS (Member - read/write, no delete, no admin features)
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000003', id
FROM permissions
WHERE id IN (
    -- Assets (read/write only)
    'assets:read', 'assets:write',
    -- Components
    'components:read', 'components:write',
    -- Branches
    'branches:read', 'branches:write',
    -- Findings
    'findings:read', 'findings:write',
    'findings:status', 'findings:priority',
    -- Vulnerabilities
    'vulnerabilities:read',
    -- Scans
    'scans:read', 'scans:write', 'scans:trigger',
    -- Policies (read only)
    'policies:read',
    -- Agents (read only)
    'agents:read',
    -- Integrations (read only)
    'integrations:read',
    -- Notifications
    'notifications:read', 'notifications:write',
    -- Groups (read only)
    'groups:read',
    -- Roles (read only)
    'roles:read',
    -- Settings (read only)
    'settings:read',
    -- Reports (read only)
    'reports:read'
);

-- =====================================================
-- 10. SEED ROLE PERMISSIONS (Viewer - read only)
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000004', id
FROM permissions
WHERE id LIKE '%:read';

-- =====================================================
-- 11. CREATE USER_ROLES TABLE (Multiple Roles per User)
-- =====================================================
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,

    -- When was this role assigned
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Unique constraint: user can have each role only once per tenant
    CONSTRAINT user_roles_unique UNIQUE (user_id, tenant_id, role_id)
);

-- =====================================================
-- 12. CREATE INDEXES FOR user_roles
-- =====================================================
CREATE INDEX idx_user_roles_user_tenant ON user_roles(user_id, tenant_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
CREATE INDEX idx_user_roles_tenant ON user_roles(tenant_id);

-- =====================================================
-- 13. MIGRATE EXISTING ROLE DATA
-- =====================================================
-- Copy existing tenant_members.role to user_roles
INSERT INTO user_roles (user_id, tenant_id, role_id, assigned_at)
SELECT
    tm.user_id,
    tm.tenant_id,
    r.id,
    tm.joined_at
FROM tenant_members tm
JOIN roles r ON r.slug = tm.role AND r.is_system = TRUE AND r.tenant_id IS NULL;

-- =====================================================
-- 14. DROP OLD role COLUMN (after migration verified)
-- =====================================================
-- Keep old role column temporarily for rollback
-- Run this in a separate migration after verifying data:
-- ALTER TABLE tenant_members DROP COLUMN role;

-- =====================================================
-- 15. ADD updated_at TRIGGER FOR roles
-- =====================================================
CREATE OR REPLACE FUNCTION update_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_roles_updated_at();
```

### 1.2 Create Down Migration

**File:** `api/migrations/000047_roles_in_database.down.sql`

```sql
-- Rollback: Remove roles in database

-- 1. Remove role_id from tenant_members (role column still exists)
ALTER TABLE tenant_members DROP COLUMN IF EXISTS role_id;

-- 2. Drop triggers
DROP TRIGGER IF EXISTS trigger_roles_updated_at ON roles;
DROP FUNCTION IF EXISTS update_roles_updated_at();

-- 3. Drop tables
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
```

### 1.3 Tasks

| Task | Description | File | Status |
|------|-------------|------|--------|
| 1.1 | Create migration file | `000047_roles_in_database.up.sql` | ⬜ |
| 1.2 | Create down migration | `000047_roles_in_database.down.sql` | ⬜ |
| 1.3 | Test migration locally | Run `make migrate-up` | ⬜ |
| 1.4 | Verify data migration | Check tenant_members.role_id populated | ⬜ |

---

## Phase 2: Backend Implementation

### Duration: 3-4 days

### 2.1 Domain Layer

#### 2.1.1 Create Role Entity

**File:** `api/internal/domain/role/entity.go`

```go
package role

import (
    "time"

    "github.com/google/uuid"
)

// ID represents a unique role identifier
type ID uuid.UUID

func (id ID) String() string {
    return uuid.UUID(id).String()
}

func ParseID(s string) (ID, error) {
    id, err := uuid.Parse(s)
    return ID(id), err
}

func NewID() ID {
    return ID(uuid.New())
}

// Role represents a role entity
type Role struct {
    id                ID
    tenantID          *ID      // nil = system role
    slug              string
    name              string
    description       string
    isSystem          bool
    hierarchyLevel    int
    hasFullDataAccess bool
    permissions       []string
    createdAt         time.Time
    updatedAt         time.Time
    createdBy         *ID
}

// Constructor
func New(
    tenantID *ID,
    slug string,
    name string,
    description string,
    hierarchyLevel int,
    hasFullDataAccess bool,
    permissions []string,
    createdBy *ID,
) *Role {
    return &Role{
        id:                NewID(),
        tenantID:          tenantID,
        slug:              slug,
        name:              name,
        description:       description,
        isSystem:          false, // Custom roles are not system
        hierarchyLevel:    hierarchyLevel,
        hasFullDataAccess: hasFullDataAccess,
        permissions:       permissions,
        createdAt:         time.Now(),
        updatedAt:         time.Now(),
        createdBy:         createdBy,
    }
}

// Reconstruct from persistence
func Reconstruct(
    id ID,
    tenantID *ID,
    slug string,
    name string,
    description string,
    isSystem bool,
    hierarchyLevel int,
    hasFullDataAccess bool,
    permissions []string,
    createdAt time.Time,
    updatedAt time.Time,
    createdBy *ID,
) *Role {
    return &Role{
        id:                id,
        tenantID:          tenantID,
        slug:              slug,
        name:              name,
        description:       description,
        isSystem:          isSystem,
        hierarchyLevel:    hierarchyLevel,
        hasFullDataAccess: hasFullDataAccess,
        permissions:       permissions,
        createdAt:         createdAt,
        updatedAt:         updatedAt,
        createdBy:         createdBy,
    }
}

// Getters
func (r *Role) ID() ID                    { return r.id }
func (r *Role) TenantID() *ID             { return r.tenantID }
func (r *Role) Slug() string              { return r.slug }
func (r *Role) Name() string              { return r.name }
func (r *Role) Description() string       { return r.description }
func (r *Role) IsSystem() bool            { return r.isSystem }
func (r *Role) HierarchyLevel() int       { return r.hierarchyLevel }
func (r *Role) HasFullDataAccess() bool   { return r.hasFullDataAccess }
func (r *Role) Permissions() []string     { return r.permissions }
func (r *Role) CreatedAt() time.Time      { return r.createdAt }
func (r *Role) UpdatedAt() time.Time      { return r.updatedAt }
func (r *Role) CreatedBy() *ID            { return r.createdBy }

// IsCustom returns true if this is a tenant-created role
func (r *Role) IsCustom() bool {
    return !r.isSystem && r.tenantID != nil
}

// HasPermission checks if role has a specific permission
func (r *Role) HasPermission(permission string) bool {
    for _, p := range r.permissions {
        if p == permission {
            return true
        }
    }
    return false
}

// Update methods (only for custom roles)
func (r *Role) Update(name, description string, hierarchyLevel int, hasFullDataAccess bool) error {
    if r.isSystem {
        return ErrCannotModifySystemRole
    }
    r.name = name
    r.description = description
    r.hierarchyLevel = hierarchyLevel
    r.hasFullDataAccess = hasFullDataAccess
    r.updatedAt = time.Now()
    return nil
}

func (r *Role) SetPermissions(permissions []string) error {
    if r.isSystem {
        return ErrCannotModifySystemRole
    }
    r.permissions = permissions
    r.updatedAt = time.Now()
    return nil
}
```

#### 2.1.2 Create Permission Entity

**File:** `api/internal/domain/permission/entity.go`

```go
package permission

// Permission represents a permission entity from database
type Permission struct {
    ID          string // e.g., "assets:read"
    ModuleID    string // e.g., "assets"
    Name        string // e.g., "View Assets"
    Description string
    IsActive    bool
}

// Module represents a feature grouping
type Module struct {
    ID           string
    Name         string
    Description  string
    Icon         string
    DisplayOrder int
    IsActive     bool
    Permissions  []Permission
}
```

#### 2.1.3 Create Permission Repository Interface

**File:** `api/internal/domain/permission/repository.go`

```go
package permission

import "context"

type Repository interface {
    // List all modules with their permissions
    ListModulesWithPermissions(ctx context.Context) ([]*Module, error)

    // List all permissions
    ListPermissions(ctx context.Context) ([]*Permission, error)

    // Get permission by ID
    GetByID(ctx context.Context, id string) (*Permission, error)

    // Check if permission exists
    Exists(ctx context.Context, id string) (bool, error)

    // Validate multiple permissions
    ValidatePermissions(ctx context.Context, ids []string) (bool, []string, error)
}
```

#### 2.1.4 Create Role Repository Interface

**File:** `api/internal/domain/role/repository.go`

```go
package role

import (
    "context"
)

// UserRole represents a role assigned to a user
type UserRole struct {
    UserID     ID
    TenantID   ID
    RoleID     ID
    Role       *Role // Populated when fetching with role details
    AssignedAt time.Time
    AssignedBy *ID
}

type Repository interface {
    // === Role CRUD ===

    // Create a new role
    Create(ctx context.Context, role *Role) error

    // Get role by ID
    GetByID(ctx context.Context, id ID) (*Role, error)

    // Get role by slug (within tenant or system)
    GetBySlug(ctx context.Context, tenantID *ID, slug string) (*Role, error)

    // List all roles for a tenant (includes system roles)
    ListForTenant(ctx context.Context, tenantID ID) ([]*Role, error)

    // List system roles only
    ListSystemRoles(ctx context.Context) ([]*Role, error)

    // Update a role (custom roles only)
    Update(ctx context.Context, role *Role) error

    // Delete a role (custom roles only)
    Delete(ctx context.Context, id ID) error

    // === User-Role Assignments (Multiple Roles per User) ===

    // Get ALL roles for a user in a tenant
    GetUserRoles(ctx context.Context, tenantID, userID ID) ([]*Role, error)

    // Get ALL permissions for a user (UNION of all roles' permissions)
    GetUserPermissions(ctx context.Context, tenantID, userID ID) ([]string, error)

    // Check if user has full data access (any role with has_full_data_access=true)
    HasFullDataAccess(ctx context.Context, tenantID, userID ID) (bool, error)

    // Assign a role to user (add to user's roles)
    AssignRole(ctx context.Context, tenantID, userID, roleID ID, assignedBy *ID) error

    // Remove a role from user
    RemoveRole(ctx context.Context, tenantID, userID, roleID ID) error

    // Set user's roles (replace all existing roles)
    SetUserRoles(ctx context.Context, tenantID, userID ID, roleIDs []ID, assignedBy *ID) error

    // === Role Members ===

    // List users who have a specific role
    ListRoleMembers(ctx context.Context, tenantID, roleID ID) ([]*UserRole, error)

    // Count users with a specific role
    CountUsersWithRole(ctx context.Context, roleID ID) (int, error)
}
```

#### 2.1.3 Create Role Errors

**File:** `api/internal/domain/role/errors.go`

```go
package role

import "errors"

var (
    ErrRoleNotFound           = errors.New("role not found")
    ErrCannotModifySystemRole = errors.New("cannot modify system role")
    ErrCannotDeleteSystemRole = errors.New("cannot delete system role")
    ErrRoleSlugExists         = errors.New("role with this slug already exists")
    ErrRoleInUse              = errors.New("role is assigned to users and cannot be deleted")
    ErrInvalidPermission      = errors.New("invalid permission")
)
```

### 2.2 Infrastructure Layer

#### 2.2.1 Create Role Repository Implementation

**File:** `api/internal/infra/postgres/role_repository.go`

```go
package postgres

import (
    "context"
    "database/sql"

    "github.com/lib/pq"
    "openctemio/api/internal/domain/role"
)

type roleRepository struct {
    db *sql.DB
}

func NewRoleRepository(db *sql.DB) role.Repository {
    return &roleRepository{db: db}
}

func (r *roleRepository) Create(ctx context.Context, ro *role.Role) error {
    tx, err := r.db.BeginTx(ctx, nil)
    if err != nil {
        return err
    }
    defer tx.Rollback()

    // Insert role
    _, err = tx.ExecContext(ctx, `
        INSERT INTO roles (id, tenant_id, slug, name, description, is_system,
                          hierarchy_level, has_full_data_access, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, ro.ID().String(), nullableID(ro.TenantID()), ro.Slug(), ro.Name(),
       ro.Description(), ro.IsSystem(), ro.HierarchyLevel(),
       ro.HasFullDataAccess(), nullableID(ro.CreatedBy()))
    if err != nil {
        if isPgUniqueViolation(err) {
            return role.ErrRoleSlugExists
        }
        return err
    }

    // Insert permissions
    for _, perm := range ro.Permissions() {
        _, err = tx.ExecContext(ctx, `
            INSERT INTO role_permissions (role_id, permission)
            VALUES ($1, $2)
        `, ro.ID().String(), perm)
        if err != nil {
            return err
        }
    }

    return tx.Commit()
}

func (r *roleRepository) GetByID(ctx context.Context, id role.ID) (*role.Role, error) {
    var (
        tenantID          sql.NullString
        slug              string
        name              string
        description       sql.NullString
        isSystem          bool
        hierarchyLevel    int
        hasFullDataAccess bool
        createdAt         time.Time
        updatedAt         time.Time
        createdBy         sql.NullString
    )

    err := r.db.QueryRowContext(ctx, `
        SELECT tenant_id, slug, name, description, is_system, hierarchy_level,
               has_full_data_access, created_at, updated_at, created_by
        FROM roles WHERE id = $1
    `, id.String()).Scan(&tenantID, &slug, &name, &description, &isSystem,
        &hierarchyLevel, &hasFullDataAccess, &createdAt, &updatedAt, &createdBy)
    if err != nil {
        if err == sql.ErrNoRows {
            return nil, role.ErrRoleNotFound
        }
        return nil, err
    }

    // Get permissions
    permissions, err := r.getPermissions(ctx, id)
    if err != nil {
        return nil, err
    }

    return role.Reconstruct(
        id,
        parseNullableID(tenantID),
        slug,
        name,
        nullString(description),
        isSystem,
        hierarchyLevel,
        hasFullDataAccess,
        permissions,
        createdAt,
        updatedAt,
        parseNullableID(createdBy),
    ), nil
}

func (r *roleRepository) ListForTenant(ctx context.Context, tenantID role.ID) ([]*role.Role, error) {
    rows, err := r.db.QueryContext(ctx, `
        SELECT id, tenant_id, slug, name, description, is_system, hierarchy_level,
               has_full_data_access, created_at, updated_at, created_by
        FROM roles
        WHERE tenant_id IS NULL OR tenant_id = $1
        ORDER BY hierarchy_level DESC, name ASC
    `, tenantID.String())
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var roles []*role.Role
    for rows.Next() {
        ro, err := r.scanRole(rows)
        if err != nil {
            return nil, err
        }

        // Get permissions for each role
        permissions, err := r.getPermissions(ctx, ro.ID())
        if err != nil {
            return nil, err
        }
        ro = role.Reconstruct(
            ro.ID(), ro.TenantID(), ro.Slug(), ro.Name(), ro.Description(),
            ro.IsSystem(), ro.HierarchyLevel(), ro.HasFullDataAccess(),
            permissions, ro.CreatedAt(), ro.UpdatedAt(), ro.CreatedBy(),
        )
        roles = append(roles, ro)
    }

    return roles, rows.Err()
}

func (r *roleRepository) GetUserRole(ctx context.Context, tenantID, userID role.ID) (*role.Role, error) {
    var roleID string
    err := r.db.QueryRowContext(ctx, `
        SELECT role_id FROM tenant_members
        WHERE tenant_id = $1 AND user_id = $2
    `, tenantID.String(), userID.String()).Scan(&roleID)
    if err != nil {
        if err == sql.ErrNoRows {
            return nil, role.ErrRoleNotFound
        }
        return nil, err
    }

    id, err := role.ParseID(roleID)
    if err != nil {
        return nil, err
    }

    return r.GetByID(ctx, id)
}

func (r *roleRepository) getPermissions(ctx context.Context, roleID role.ID) ([]string, error) {
    rows, err := r.db.QueryContext(ctx, `
        SELECT permission FROM role_permissions WHERE role_id = $1
    `, roleID.String())
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var permissions []string
    for rows.Next() {
        var perm string
        if err := rows.Scan(&perm); err != nil {
            return nil, err
        }
        permissions = append(permissions, perm)
    }

    return permissions, rows.Err()
}

// ... other methods
```

### 2.3 Application Layer

#### 2.3.1 Create Role Service

**File:** `api/internal/app/role_service.go`

```go
package app

import (
    "context"

    "openctemio/api/internal/domain/role"
    "openctemio/api/internal/domain/permission"
)

type RoleService struct {
    repo         role.Repository
    auditService *AuditService
}

func NewRoleService(repo role.Repository, auditService *AuditService) *RoleService {
    return &RoleService{
        repo:         repo,
        auditService: auditService,
    }
}

// CreateRoleInput represents input for creating a custom role
type CreateRoleInput struct {
    TenantID          string
    Slug              string
    Name              string
    Description       string
    HierarchyLevel    int
    HasFullDataAccess bool
    Permissions       []string
}

// CreateRole creates a new custom role for a tenant
func (s *RoleService) CreateRole(ctx context.Context, input CreateRoleInput, actx AuditContext) (*role.Role, error) {
    // Validate permissions
    for _, perm := range input.Permissions {
        if !permission.IsValidPermission(perm) {
            return nil, role.ErrInvalidPermission
        }
    }

    tenantID, err := role.ParseID(input.TenantID)
    if err != nil {
        return nil, err
    }

    creatorID, _ := role.ParseID(actx.UserID)

    r := role.New(
        &tenantID,
        input.Slug,
        input.Name,
        input.Description,
        input.HierarchyLevel,
        input.HasFullDataAccess,
        input.Permissions,
        &creatorID,
    )

    if err := s.repo.Create(ctx, r); err != nil {
        return nil, err
    }

    // Audit log
    s.auditService.Log(ctx, actx, AuditEvent{
        Action:       "role:created",
        ResourceType: "role",
        ResourceID:   r.ID().String(),
        ResourceName: r.Name(),
    })

    return r, nil
}

// ListRolesForTenant returns all roles available for a tenant
func (s *RoleService) ListRolesForTenant(ctx context.Context, tenantID string) ([]*role.Role, error) {
    tid, err := role.ParseID(tenantID)
    if err != nil {
        return nil, err
    }
    return s.repo.ListForTenant(ctx, tid)
}

// GetUserRole returns the role assigned to a user in a tenant
func (s *RoleService) GetUserRole(ctx context.Context, tenantID, userID string) (*role.Role, error) {
    tid, err := role.ParseID(tenantID)
    if err != nil {
        return nil, err
    }
    uid, err := role.ParseID(userID)
    if err != nil {
        return nil, err
    }
    return s.repo.GetUserRole(ctx, tid, uid)
}

// GetUserPermissions returns all permissions for a user in a tenant
func (s *RoleService) GetUserPermissions(ctx context.Context, tenantID, userID string) ([]string, error) {
    r, err := s.GetUserRole(ctx, tenantID, userID)
    if err != nil {
        return nil, err
    }
    return r.Permissions(), nil
}

// HasPermission checks if a user has a specific permission
func (s *RoleService) HasPermission(ctx context.Context, tenantID, userID, perm string) (bool, error) {
    r, err := s.GetUserRole(ctx, tenantID, userID)
    if err != nil {
        return false, err
    }
    return r.HasPermission(perm), nil
}

// UpdateRole updates a custom role
func (s *RoleService) UpdateRole(ctx context.Context, roleID string, input UpdateRoleInput, actx AuditContext) (*role.Role, error) {
    id, err := role.ParseID(roleID)
    if err != nil {
        return nil, err
    }

    r, err := s.repo.GetByID(ctx, id)
    if err != nil {
        return nil, err
    }

    if r.IsSystem() {
        return nil, role.ErrCannotModifySystemRole
    }

    // Validate permissions
    for _, perm := range input.Permissions {
        if !permission.IsValidPermission(perm) {
            return nil, role.ErrInvalidPermission
        }
    }

    if err := r.Update(input.Name, input.Description, input.HierarchyLevel, input.HasFullDataAccess); err != nil {
        return nil, err
    }

    if err := r.SetPermissions(input.Permissions); err != nil {
        return nil, err
    }

    if err := s.repo.Update(ctx, r); err != nil {
        return nil, err
    }

    // Audit log
    s.auditService.Log(ctx, actx, AuditEvent{
        Action:       "role:updated",
        ResourceType: "role",
        ResourceID:   r.ID().String(),
        ResourceName: r.Name(),
    })

    return r, nil
}

// DeleteRole deletes a custom role
func (s *RoleService) DeleteRole(ctx context.Context, roleID string, actx AuditContext) error {
    id, err := role.ParseID(roleID)
    if err != nil {
        return err
    }

    r, err := s.repo.GetByID(ctx, id)
    if err != nil {
        return err
    }

    if r.IsSystem() {
        return role.ErrCannotDeleteSystemRole
    }

    // Check if role is in use
    count, err := s.repo.CountUsersWithRole(ctx, id)
    if err != nil {
        return err
    }
    if count > 0 {
        return role.ErrRoleInUse
    }

    if err := s.repo.Delete(ctx, id); err != nil {
        return err
    }

    // Audit log
    s.auditService.Log(ctx, actx, AuditEvent{
        Action:       "role:deleted",
        ResourceType: "role",
        ResourceID:   r.ID().String(),
        ResourceName: r.Name(),
    })

    return nil
}
```

### 2.4 Update Access Resolver

#### 2.4.1 Modify Access Resolver for Multiple Roles + Data Scoping

**File:** `api/internal/domain/accesscontrol/resolver.go` (update)

```go
package accesscontrol

import (
    "context"

    "openctemio/api/internal/domain/role"
    "openctemio/api/internal/domain/group"
)

type AccessScope struct {
    UserID           string
    TenantID         string

    // Multiple roles support
    Roles            []RoleInfo // All roles assigned to user
    Permissions      []string   // UNION of all roles' permissions (deduplicated)

    // Data access
    IsFullDataAccess bool     // true if ANY role has_full_data_access=true
    GroupIDs         []string // groups user belongs to
    AccessibleAssets []string // assets user can access (via groups)
}

type RoleInfo struct {
    ID               string
    Slug             string
    Name             string
    IsSystem         bool
    HierarchyLevel   int
    HasFullDataAccess bool
}

type AccessResolver struct {
    roleRepo  role.Repository
    groupRepo group.Repository
}

func NewAccessResolver(roleRepo role.Repository, groupRepo group.Repository) *AccessResolver {
    return &AccessResolver{
        roleRepo:  roleRepo,
        groupRepo: groupRepo,
    }
}

// Resolve returns the complete access scope for a user
func (r *AccessResolver) Resolve(ctx context.Context, tenantID, userID string) (*AccessScope, error) {
    tid, err := role.ParseID(tenantID)
    if err != nil {
        return nil, err
    }
    uid, err := role.ParseID(userID)
    if err != nil {
        return nil, err
    }

    // Get ALL user's roles
    userRoles, err := r.roleRepo.GetUserRoles(ctx, tid, uid)
    if err != nil {
        return nil, err
    }

    scope := &AccessScope{
        UserID:           userID,
        TenantID:         tenantID,
        Roles:            make([]RoleInfo, len(userRoles)),
        IsFullDataAccess: false,
    }

    // Collect permissions from all roles (UNION)
    permSet := make(map[string]bool)
    for i, r := range userRoles {
        scope.Roles[i] = RoleInfo{
            ID:               r.ID().String(),
            Slug:             r.Slug(),
            Name:             r.Name(),
            IsSystem:         r.IsSystem(),
            HierarchyLevel:   r.HierarchyLevel(),
            HasFullDataAccess: r.HasFullDataAccess(),
        }

        // Check full data access
        if r.HasFullDataAccess() {
            scope.IsFullDataAccess = true
        }

        // Add permissions to set (dedup)
        for _, perm := range r.Permissions() {
            permSet[perm] = true
        }
    }

    // Convert permission set to slice
    scope.Permissions = make([]string, 0, len(permSet))
    for perm := range permSet {
        scope.Permissions = append(scope.Permissions, perm)
    }

    // If full data access, no need to resolve groups
    if scope.IsFullDataAccess {
        return scope, nil
    }

    // Get user's groups for data scoping
    groups, err := r.groupRepo.ListByUser(ctx, tid, uid)
    if err != nil {
        return nil, err
    }

    groupIDs := make([]string, len(groups))
    for i, g := range groups {
        groupIDs[i] = g.ID().String()
    }
    scope.GroupIDs = groupIDs

    // Get accessible assets from groups
    if len(groupIDs) > 0 {
        assets, err := r.groupRepo.GetGroupsOwnedAssets(ctx, groupIDs)
        if err != nil {
            return nil, err
        }
        scope.AccessibleAssets = assets
    }

    return scope, nil
}

// HasPermission checks if user has a specific permission
func (r *AccessResolver) HasPermission(scope *AccessScope, permission string) bool {
    for _, p := range scope.Permissions {
        if p == permission {
            return true
        }
    }
    return false
}

// HasAnyPermission checks if user has any of the specified permissions
func (r *AccessResolver) HasAnyPermission(scope *AccessScope, permissions []string) bool {
    for _, p := range permissions {
        if r.HasPermission(scope, p) {
            return true
        }
    }
    return false
}

// HasAllPermissions checks if user has all of the specified permissions
func (r *AccessResolver) HasAllPermissions(scope *AccessScope, permissions []string) bool {
    for _, p := range permissions {
        if !r.HasPermission(scope, p) {
            return false
        }
    }
    return true
}

// GetHighestRole returns the role with highest hierarchy level
func (r *AccessResolver) GetHighestRole(scope *AccessScope) *RoleInfo {
    if len(scope.Roles) == 0 {
        return nil
    }

    highest := &scope.Roles[0]
    for i := 1; i < len(scope.Roles); i++ {
        if scope.Roles[i].HierarchyLevel > highest.HierarchyLevel {
            highest = &scope.Roles[i]
        }
    }
    return highest
}
```

### 2.5 HTTP Layer

#### 2.5.1 Create Role Handler

**File:** `api/internal/infra/http/handler/role_handler.go`

```go
package handler

import (
    "net/http"

    "github.com/gin-gonic/gin"
    "openctemio/api/internal/app"
)

type RoleHandler struct {
    service *app.RoleService
}

func NewRoleHandler(service *app.RoleService) *RoleHandler {
    return &RoleHandler{service: service}
}

// ListRoles returns all roles for the tenant
// GET /api/v1/roles
func (h *RoleHandler) ListRoles(c *gin.Context) {
    tenantID := c.GetString("tenant_id")

    roles, err := h.service.ListRolesForTenant(c.Request.Context(), tenantID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    response := make([]RoleResponse, len(roles))
    for i, r := range roles {
        response[i] = toRoleResponse(r)
    }

    c.JSON(http.StatusOK, gin.H{"data": response})
}

// GetRole returns a specific role
// GET /api/v1/roles/:roleId
func (h *RoleHandler) GetRole(c *gin.Context) {
    roleID := c.Param("roleId")

    r, err := h.service.GetRole(c.Request.Context(), roleID)
    if err != nil {
        handleError(c, err)
        return
    }

    c.JSON(http.StatusOK, gin.H{"data": toRoleResponse(r)})
}

// CreateRole creates a new custom role
// POST /api/v1/roles
func (h *RoleHandler) CreateRole(c *gin.Context) {
    tenantID := c.GetString("tenant_id")

    var input CreateRoleRequest
    if err := c.ShouldBindJSON(&input); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    r, err := h.service.CreateRole(c.Request.Context(), app.CreateRoleInput{
        TenantID:          tenantID,
        Slug:              input.Slug,
        Name:              input.Name,
        Description:       input.Description,
        HierarchyLevel:    input.HierarchyLevel,
        HasFullDataAccess: input.HasFullDataAccess,
        Permissions:       input.Permissions,
    }, getAuditContext(c))

    if err != nil {
        handleError(c, err)
        return
    }

    c.JSON(http.StatusCreated, gin.H{"data": toRoleResponse(r)})
}

// UpdateRole updates a custom role
// PUT /api/v1/roles/:roleId
func (h *RoleHandler) UpdateRole(c *gin.Context) {
    roleID := c.Param("roleId")

    var input UpdateRoleRequest
    if err := c.ShouldBindJSON(&input); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    r, err := h.service.UpdateRole(c.Request.Context(), roleID, app.UpdateRoleInput{
        Name:              input.Name,
        Description:       input.Description,
        HierarchyLevel:    input.HierarchyLevel,
        HasFullDataAccess: input.HasFullDataAccess,
        Permissions:       input.Permissions,
    }, getAuditContext(c))

    if err != nil {
        handleError(c, err)
        return
    }

    c.JSON(http.StatusOK, gin.H{"data": toRoleResponse(r)})
}

// DeleteRole deletes a custom role
// DELETE /api/v1/roles/:roleId
func (h *RoleHandler) DeleteRole(c *gin.Context) {
    roleID := c.Param("roleId")

    if err := h.service.DeleteRole(c.Request.Context(), roleID, getAuditContext(c)); err != nil {
        handleError(c, err)
        return
    }

    c.JSON(http.StatusNoContent, nil)
}

// Request/Response types
type CreateRoleRequest struct {
    Slug              string   `json:"slug" binding:"required"`
    Name              string   `json:"name" binding:"required"`
    Description       string   `json:"description"`
    HierarchyLevel    int      `json:"hierarchy_level" binding:"min=0,max=99"`
    HasFullDataAccess bool     `json:"has_full_data_access"`
    Permissions       []string `json:"permissions" binding:"required"`
}

type UpdateRoleRequest struct {
    Name              string   `json:"name" binding:"required"`
    Description       string   `json:"description"`
    HierarchyLevel    int      `json:"hierarchy_level" binding:"min=0,max=99"`
    HasFullDataAccess bool     `json:"has_full_data_access"`
    Permissions       []string `json:"permissions" binding:"required"`
}

type RoleResponse struct {
    ID                string   `json:"id"`
    TenantID          *string  `json:"tenant_id,omitempty"`
    Slug              string   `json:"slug"`
    Name              string   `json:"name"`
    Description       string   `json:"description"`
    IsSystem          bool     `json:"is_system"`
    HierarchyLevel    int      `json:"hierarchy_level"`
    HasFullDataAccess bool     `json:"has_full_data_access"`
    Permissions       []string `json:"permissions"`
    PermissionCount   int      `json:"permission_count"`
    CreatedAt         string   `json:"created_at"`
    UpdatedAt         string   `json:"updated_at"`
}

func toRoleResponse(r *role.Role) RoleResponse {
    var tenantID *string
    if r.TenantID() != nil {
        tid := r.TenantID().String()
        tenantID = &tid
    }

    return RoleResponse{
        ID:                r.ID().String(),
        TenantID:          tenantID,
        Slug:              r.Slug(),
        Name:              r.Name(),
        Description:       r.Description(),
        IsSystem:          r.IsSystem(),
        HierarchyLevel:    r.HierarchyLevel(),
        HasFullDataAccess: r.HasFullDataAccess(),
        Permissions:       r.Permissions(),
        PermissionCount:   len(r.Permissions()),
        CreatedAt:         r.CreatedAt().Format(time.RFC3339),
        UpdatedAt:         r.UpdatedAt().Format(time.RFC3339),
    }
}
```

#### 2.5.2 Create Permission Handler

**File:** `api/internal/infra/http/handler/permission_handler.go`

```go
package handler

import (
    "net/http"

    "github.com/gin-gonic/gin"
    "openctemio/api/internal/domain/permission"
)

type PermissionHandler struct {
    repo permission.Repository
}

func NewPermissionHandler(repo permission.Repository) *PermissionHandler {
    return &PermissionHandler{repo: repo}
}

// ListModules returns all modules with their permissions
// GET /api/v1/permissions/modules
func (h *PermissionHandler) ListModules(c *gin.Context) {
    modules, err := h.repo.ListModulesWithPermissions(c.Request.Context())
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    response := make([]ModuleResponse, len(modules))
    for i, m := range modules {
        perms := make([]PermissionResponse, len(m.Permissions))
        for j, p := range m.Permissions {
            perms[j] = PermissionResponse{
                ID:          p.ID,
                Name:        p.Name,
                Description: p.Description,
            }
        }
        response[i] = ModuleResponse{
            ID:           m.ID,
            Name:         m.Name,
            Description:  m.Description,
            Icon:         m.Icon,
            DisplayOrder: m.DisplayOrder,
            Permissions:  perms,
        }
    }

    c.JSON(http.StatusOK, gin.H{"data": response})
}

// ListPermissions returns all available permissions
// GET /api/v1/permissions
func (h *PermissionHandler) ListPermissions(c *gin.Context) {
    permissions, err := h.repo.ListPermissions(c.Request.Context())
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    response := make([]PermissionResponse, len(permissions))
    for i, p := range permissions {
        response[i] = PermissionResponse{
            ID:          p.ID,
            ModuleID:    p.ModuleID,
            Name:        p.Name,
            Description: p.Description,
        }
    }

    c.JSON(http.StatusOK, gin.H{"data": response})
}

type ModuleResponse struct {
    ID           string               `json:"id"`
    Name         string               `json:"name"`
    Description  string               `json:"description"`
    Icon         string               `json:"icon"`
    DisplayOrder int                  `json:"display_order"`
    Permissions  []PermissionResponse `json:"permissions"`
}

type PermissionResponse struct {
    ID          string `json:"id"`
    ModuleID    string `json:"module_id,omitempty"`
    Name        string `json:"name"`
    Description string `json:"description"`
}
```

#### 2.5.3 Create User Role Handler

**File:** `api/internal/infra/http/handler/user_role_handler.go`

```go
package handler

import (
    "net/http"

    "github.com/gin-gonic/gin"
    "openctemio/api/internal/app"
)

type UserRoleHandler struct {
    service *app.RoleService
}

func NewUserRoleHandler(service *app.RoleService) *UserRoleHandler {
    return &UserRoleHandler{service: service}
}

// GetUserRoles returns all roles assigned to a user
// GET /api/v1/users/:userId/roles
func (h *UserRoleHandler) GetUserRoles(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    userID := c.Param("userId")

    roles, err := h.service.GetUserRoles(c.Request.Context(), tenantID, userID)
    if err != nil {
        handleError(c, err)
        return
    }

    response := make([]RoleResponse, len(roles))
    for i, r := range roles {
        response[i] = toRoleResponse(r)
    }

    c.JSON(http.StatusOK, gin.H{"data": response})
}

// AssignRoleToUser assigns a role to a user
// POST /api/v1/users/:userId/roles
func (h *UserRoleHandler) AssignRoleToUser(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    userID := c.Param("userId")

    var input struct {
        RoleID string `json:"role_id" binding:"required"`
    }
    if err := c.ShouldBindJSON(&input); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    if err := h.service.AssignRole(c.Request.Context(), tenantID, userID, input.RoleID, getAuditContext(c)); err != nil {
        handleError(c, err)
        return
    }

    c.JSON(http.StatusCreated, gin.H{"message": "Role assigned successfully"})
}

// RemoveRoleFromUser removes a role from a user
// DELETE /api/v1/users/:userId/roles/:roleId
func (h *UserRoleHandler) RemoveRoleFromUser(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    userID := c.Param("userId")
    roleID := c.Param("roleId")

    if err := h.service.RemoveRole(c.Request.Context(), tenantID, userID, roleID, getAuditContext(c)); err != nil {
        handleError(c, err)
        return
    }

    c.JSON(http.StatusNoContent, nil)
}

// SetUserRoles replaces all roles for a user
// PUT /api/v1/users/:userId/roles
func (h *UserRoleHandler) SetUserRoles(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    userID := c.Param("userId")

    var input struct {
        RoleIDs []string `json:"role_ids" binding:"required"`
    }
    if err := c.ShouldBindJSON(&input); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    if err := h.service.SetUserRoles(c.Request.Context(), tenantID, userID, input.RoleIDs, getAuditContext(c)); err != nil {
        handleError(c, err)
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "User roles updated successfully"})
}

// ListRoleMembers returns all users who have a specific role
// GET /api/v1/roles/:roleId/members
func (h *UserRoleHandler) ListRoleMembers(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    roleID := c.Param("roleId")

    members, err := h.service.ListRoleMembers(c.Request.Context(), tenantID, roleID)
    if err != nil {
        handleError(c, err)
        return
    }

    c.JSON(http.StatusOK, gin.H{"data": members})
}

// AddMemberToRole assigns a role to a user (from role perspective)
// POST /api/v1/roles/:roleId/members
func (h *UserRoleHandler) AddMemberToRole(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    roleID := c.Param("roleId")

    var input struct {
        UserID string `json:"user_id" binding:"required"`
    }
    if err := c.ShouldBindJSON(&input); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    if err := h.service.AssignRole(c.Request.Context(), tenantID, input.UserID, roleID, getAuditContext(c)); err != nil {
        handleError(c, err)
        return
    }

    c.JSON(http.StatusCreated, gin.H{"message": "Member added to role"})
}

// RemoveMemberFromRole removes a user from a role
// DELETE /api/v1/roles/:roleId/members/:userId
func (h *UserRoleHandler) RemoveMemberFromRole(c *gin.Context) {
    tenantID := c.GetString("tenant_id")
    roleID := c.Param("roleId")
    userID := c.Param("userId")

    if err := h.service.RemoveRole(c.Request.Context(), tenantID, userID, roleID, getAuditContext(c)); err != nil {
        handleError(c, err)
        return
    }

    c.JSON(http.StatusNoContent, nil)
}
```

#### 2.5.4 Register Routes

**File:** `api/internal/infra/http/router.go` (update)

```go
// Add permission routes (public within tenant)
permissions := v1.Group("/permissions")
{
    permissions.GET("", permissionHandler.ListPermissions)
    permissions.GET("/modules", permissionHandler.ListModules)
}

// Add role routes
roles := v1.Group("/roles")
{
    roles.GET("", requirePermission("roles:read"), roleHandler.ListRoles)
    roles.POST("", requirePermission("roles:write"), roleHandler.CreateRole)
    roles.GET("/:roleId", requirePermission("roles:read"), roleHandler.GetRole)
    roles.PUT("/:roleId", requirePermission("roles:write"), roleHandler.UpdateRole)
    roles.DELETE("/:roleId", requirePermission("roles:delete"), roleHandler.DeleteRole)

    // Role members (users with this role)
    roles.GET("/:roleId/members", requirePermission("roles:read"), userRoleHandler.ListRoleMembers)
    roles.POST("/:roleId/members", requirePermission("members:manage"), userRoleHandler.AddMemberToRole)
    roles.DELETE("/:roleId/members/:userId", requirePermission("members:manage"), userRoleHandler.RemoveMemberFromRole)
}

// User roles routes
users := v1.Group("/users")
{
    // ... existing user routes ...

    // User roles (multiple roles per user)
    users.GET("/:userId/roles", requirePermission("members:read"), userRoleHandler.GetUserRoles)
    users.POST("/:userId/roles", requirePermission("members:manage"), userRoleHandler.AssignRoleToUser)
    users.PUT("/:userId/roles", requirePermission("members:manage"), userRoleHandler.SetUserRoles)
    users.DELETE("/:userId/roles/:roleId", requirePermission("members:manage"), userRoleHandler.RemoveRoleFromUser)
}

// Current user's access scope
me := v1.Group("/me")
{
    me.GET("/access-scope", meHandler.GetAccessScope) // Returns roles, permissions, accessible assets
}
```

### 2.6 Update Permission Middleware

**File:** `api/internal/infra/http/middleware/permission.go` (update)

```go
package middleware

import (
    "github.com/gin-gonic/gin"
    "openctemio/api/internal/domain/accesscontrol"
)

func PermissionMiddleware(resolver *accesscontrol.AccessResolver) gin.HandlerFunc {
    return func(c *gin.Context) {
        tenantID := c.GetString("tenant_id")
        userID := c.GetString("user_id")

        if tenantID == "" || userID == "" {
            c.Next()
            return
        }

        // Resolve access scope
        scope, err := resolver.Resolve(c.Request.Context(), tenantID, userID)
        if err != nil {
            c.AbortWithStatusJSON(403, gin.H{"error": "access denied"})
            return
        }

        // Store in context for handlers
        c.Set("access_scope", scope)
        c.Set("permissions", scope.Permissions)
        c.Set("is_full_data_access", scope.IsFullDataAccess)
        c.Set("accessible_assets", scope.AccessibleAssets)

        c.Next()
    }
}

func RequirePermission(permission string) gin.HandlerFunc {
    return func(c *gin.Context) {
        scope, exists := c.Get("access_scope")
        if !exists {
            c.AbortWithStatusJSON(403, gin.H{"error": "access scope not found"})
            return
        }

        accessScope := scope.(*accesscontrol.AccessScope)
        hasPermission := false
        for _, p := range accessScope.Permissions {
            if p == permission {
                hasPermission = true
                break
            }
        }

        if !hasPermission {
            c.AbortWithStatusJSON(403, gin.H{
                "error":   "forbidden",
                "message": "You don't have permission: " + permission,
            })
            return
        }

        c.Next()
    }
}
```

### 2.7 Tasks Summary

| Task | Description | File | Status |
|------|-------------|------|--------|
| 2.1.1 | Create Role entity | `domain/role/entity.go` | ⬜ |
| 2.1.2 | Create Role repository interface | `domain/role/repository.go` | ⬜ |
| 2.1.3 | Create Role errors | `domain/role/errors.go` | ⬜ |
| 2.2.1 | Create Role repository implementation | `infra/postgres/role_repository.go` | ⬜ |
| 2.3.1 | Create Role service | `app/role_service.go` | ⬜ |
| 2.4.1 | Update Access Resolver | `domain/accesscontrol/resolver.go` | ⬜ |
| 2.5.1 | Create Role handler | `infra/http/handler/role_handler.go` | ⬜ |
| 2.5.2 | Register routes | `infra/http/router.go` | ⬜ |
| 2.6 | Update Permission middleware | `infra/http/middleware/permission.go` | ⬜ |
| 2.7 | Remove hardcoded RolePermissions | `domain/permission/role_mapping.go` | ⬜ |

---

## Phase 3: Frontend Implementation

### Duration: 2-3 days

### Approach: Reuse Groups UI Patterns

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND APPROACH                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   1. COPY STRUCTURE from Groups UI                                  │
│      └── Keep patterns: page layout, detail sheet, tabs            │
│                                                                      │
│   2. CREATE SHARED PermissionSelector                               │
│      └── New component can be used for both Roles and Groups       │
│      └── Fetch permissions from API, no hardcoding                  │
│                                                                      │
│   3. SIMPLIFY for Roles                                             │
│      └── Only 2 tabs: Details + Permissions                        │
│      └── Remove Members tab, Assets tab                             │
│                                                                      │
│   4. API HOOKS                                                       │
│      └── useRoles() - list roles                                    │
│      └── usePermissions() - list available permissions              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.1 Types

**File:** `ui/src/features/access-control/types/role.types.ts`

```typescript
// Role entity
export interface Role {
  id: string;
  tenant_id: string | null;
  slug: string;
  name: string;
  description: string;
  is_system: boolean;
  hierarchy_level: number;
  has_full_data_access: boolean;
  permissions: string[];       // Array of permission IDs
  permission_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateRoleInput {
  slug: string;
  name: string;
  description?: string;
  hierarchy_level: number;
  has_full_data_access: boolean;
  permissions: string[];       // Array of permission IDs
}

export interface UpdateRoleInput {
  name: string;
  description?: string;
  hierarchy_level: number;
  has_full_data_access: boolean;
  permissions: string[];       // Array of permission IDs
}
```

**File:** `ui/src/features/access-control/types/permission.types.ts`

```typescript
// Permission entity (from API)
export interface Permission {
  id: string;           // e.g., "assets:read"
  module_id: string;    // e.g., "assets"
  name: string;         // e.g., "View Assets"
  description: string;  // e.g., "View asset details and list"
}

// Module with permissions (from API)
export interface Module {
  id: string;           // e.g., "assets"
  name: string;         // e.g., "Assets"
  description: string;
  icon: string;         // e.g., "server"
  display_order: number;
  permissions: Permission[];
}
```

### 3.2 API Hooks

**File:** `ui/src/features/access-control/api/use-permissions.ts`

```typescript
import useSWR from 'swr';
import { Module, Permission } from '../types/permission.types';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  const data = await res.json();
  return data.data;
};

// Fetch all modules with their permissions (for Permission Selector)
export function usePermissionModules() {
  const { data, error, isLoading } = useSWR<Module[]>(
    '/api/v1/permissions/modules',
    fetcher
  );

  return {
    modules: data || [],
    isLoading,
    error,
  };
}

// Fetch all permissions (flat list)
export function useAllPermissions() {
  const { data, error, isLoading } = useSWR<Permission[]>(
    '/api/v1/permissions',
    fetcher
  );

  return {
    permissions: data || [],
    isLoading,
    error,
  };
}
```

**File:** `ui/src/features/access-control/api/use-roles.ts`

```typescript
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { Role, CreateRoleInput, UpdateRoleInput } from '../types/role.types';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  const data = await res.json();
  return data.data;
};

const mutationFetcher = async (
  url: string,
  { arg }: { arg: { method: string; body?: unknown } }
) => {
  const res = await fetch(url, {
    method: arg.method,
    headers: { 'Content-Type': 'application/json' },
    body: arg.body ? JSON.stringify(arg.body) : undefined,
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Request failed');
  }
  if (res.status === 204) return null;
  const data = await res.json();
  return data.data;
};

export function useRoles() {
  const { data, error, isLoading, mutate } = useSWR<Role[]>(
    '/api/v1/roles',
    fetcher
  );

  return {
    roles: data || [],
    systemRoles: data?.filter((r) => r.is_system) || [],
    customRoles: data?.filter((r) => !r.is_system) || [],
    isLoading,
    error,
    refresh: mutate,
  };
}

export function useRole(roleId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Role>(
    roleId ? `/api/v1/roles/${roleId}` : null,
    fetcher
  );

  return {
    role: data,
    isLoading,
    error,
    refresh: mutate,
  };
}

export function useCreateRole() {
  const { trigger, isMutating, error } = useSWRMutation(
    '/api/v1/roles',
    mutationFetcher
  );

  return {
    createRole: (input: CreateRoleInput) =>
      trigger({ method: 'POST', body: input }),
    isCreating: isMutating,
    error,
  };
}

export function useUpdateRole(roleId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    `/api/v1/roles/${roleId}`,
    mutationFetcher
  );

  return {
    updateRole: (input: UpdateRoleInput) =>
      trigger({ method: 'PUT', body: input }),
    isUpdating: isMutating,
    error,
  };
}

export function useDeleteRole(roleId: string) {
  const { trigger, isMutating, error } = useSWRMutation(
    `/api/v1/roles/${roleId}`,
    mutationFetcher
  );

  return {
    deleteRole: () => trigger({ method: 'DELETE' }),
    isDeleting: isMutating,
    error,
  };
}
```

### 3.3 Roles Page

**File:** `ui/src/app/(dashboard)/settings/access-control/roles/page.tsx`

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Plus, Shield, Edit, Trash2 } from "lucide-react";
import { useRoles, useDeleteRole } from "@/features/access-control/api/use-roles";
import { RoleDetailSheet } from "@/features/access-control/components/role-detail-sheet";
import { Role } from "@/features/access-control/types/role.types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function RolesPage() {
  const { roles, isLoading, refresh } = useRoles();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);

  const columns = [
    {
      accessorKey: "name",
      header: "Role",
      cell: ({ row }: { row: { original: Role } }) => (
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.original.name}</span>
          {row.original.is_system && (
            <Badge variant="secondary" className="text-xs">
              System
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }: { row: { original: Role } }) => (
        <span className="text-muted-foreground text-sm">
          {row.original.description}
        </span>
      ),
    },
    {
      accessorKey: "hierarchy_level",
      header: "Level",
      cell: ({ row }: { row: { original: Role } }) => (
        <Badge variant="outline">{row.original.hierarchy_level}</Badge>
      ),
    },
    {
      accessorKey: "has_full_data_access",
      header: "Data Access",
      cell: ({ row }: { row: { original: Role } }) => (
        <Badge variant={row.original.has_full_data_access ? "default" : "secondary"}>
          {row.original.has_full_data_access ? "Full Access" : "Group Scoped"}
        </Badge>
      ),
    },
    {
      accessorKey: "permission_count",
      header: "Permissions",
      cell: ({ row }: { row: { original: Role } }) => (
        <span className="text-muted-foreground">
          {row.original.permission_count} permissions
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }: { row: { original: Role } }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedRole(row.original)}
          >
            {row.original.is_system ? "View" : <Edit className="h-4 w-4" />}
          </Button>
          {!row.original.is_system && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteRole(row.original)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const handleDelete = async () => {
    if (!deleteRole) return;

    try {
      await fetch(`/api/v1/roles/${deleteRole.id}`, { method: "DELETE" });
      toast.success("Role deleted successfully");
      refresh();
    } catch (error) {
      toast.error("Failed to delete role");
    } finally {
      setDeleteRole(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Roles</h1>
          <p className="text-muted-foreground">
            Manage roles and their permissions. System roles cannot be modified.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Custom Role
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={roles}
        isLoading={isLoading}
      />

      <RoleDetailSheet
        role={selectedRole}
        open={!!selectedRole || isCreateOpen}
        onClose={() => {
          setSelectedRole(null);
          setIsCreateOpen(false);
        }}
        onSave={() => {
          refresh();
          setSelectedRole(null);
          setIsCreateOpen(false);
        }}
      />

      <AlertDialog open={!!deleteRole} onOpenChange={() => setDeleteRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role "{deleteRole?.name}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

### 3.4 Permission Selector Component (Fetches from API)

**File:** `ui/src/features/access-control/components/permission-selector.tsx`

```tsx
import { useState, useEffect, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { usePermissionModules } from "../api/use-permissions";
import { Module } from "../types/permission.types";

interface PermissionSelectorProps {
  selected: string[];
  onChange: (permissions: string[]) => void;
  disabled?: boolean;
}

export function PermissionSelector({
  selected,
  onChange,
  disabled = false,
}: PermissionSelectorProps) {
  // Fetch modules with permissions from API
  const { modules, isLoading, error } = usePermissionModules();

  const [expandedModules, setExpandedModules] = useState<string[]>([]);

  // Expand all modules by default when loaded
  useEffect(() => {
    if (modules.length > 0 && expandedModules.length === 0) {
      setExpandedModules(modules.map((m) => m.id));
    }
  }, [modules]);

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const togglePermission = (permissionId: string) => {
    if (disabled) return;

    if (selected.includes(permissionId)) {
      onChange(selected.filter((p) => p !== permissionId));
    } else {
      onChange([...selected, permissionId]);
    }
  };

  const toggleModulePermissions = (module: Module) => {
    if (disabled) return;

    const modulePermIds = module.permissions.map((p) => p.id);
    const allSelected = modulePermIds.every((id) => selected.includes(id));

    if (allSelected) {
      onChange(selected.filter((p) => !modulePermIds.includes(p)));
    } else {
      onChange([...new Set([...selected, ...modulePermIds])]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading permissions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        Failed to load permissions. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[400px] overflow-y-auto">
      {modules.map((module) => {
        const modulePermIds = module.permissions.map((p) => p.id);
        const selectedCount = modulePermIds.filter((id) =>
          selected.includes(id)
        ).length;
        const isExpanded = expandedModules.includes(module.id);
        const allSelected = selectedCount === modulePermIds.length;
        const someSelected = selectedCount > 0 && !allSelected;

        return (
          <div key={module.id} className="border rounded-lg">
            <div
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
              onClick={() => toggleModule(module.id)}
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) {
                      (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = someSelected;
                    }
                  }}
                  onCheckedChange={() => toggleModulePermissions(module)}
                  disabled={disabled}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="font-medium">{module.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {selectedCount}/{modulePermIds.length}
                </Badge>
              </div>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>

            {isExpanded && (
              <div className="border-t px-3 py-2 space-y-2">
                {module.permissions.map((perm) => (
                  <div
                    key={perm.id}
                    className="flex items-start gap-3 py-1 hover:bg-muted/30 rounded px-2 -mx-2"
                  >
                    <Checkbox
                      checked={selected.includes(perm.id)}
                      onCheckedChange={() => togglePermission(perm.id)}
                      disabled={disabled}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{perm.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {perm.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

### 3.5 Role Detail Sheet (with Members Tab)

**File:** `ui/src/features/access-control/components/role-detail-sheet.tsx`

```tsx
import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Role, CreateRoleInput } from "../types/role.types";
import { PermissionSelector } from "./permission-selector";
import { RoleMembersTab } from "./role-members-tab";
import { useCreateRole, useUpdateRole } from "../api/use-roles";

interface RoleDetailSheetProps {
  role: Role | null;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
};

export function RoleDetailSheet({
  role,
  open,
  onClose,
  onSave,
}: RoleDetailSheetProps) {
  const isNew = !role;
  const isSystem = role?.is_system ?? false;

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    hierarchy_level: 50,
    has_full_data_access: false,
    permissions: [] as string[],
  });

  const { createRole, isCreating } = useCreateRole();
  const { updateRole, isUpdating } = useUpdateRole(role?.id ?? "");

  useEffect(() => {
    if (role) {
      setForm({
        name: role.name,
        slug: role.slug,
        description: role.description,
        hierarchy_level: role.hierarchy_level,
        has_full_data_access: role.has_full_data_access,
        permissions: role.permissions,
      });
    } else {
      setForm({
        name: "",
        slug: "",
        description: "",
        hierarchy_level: 50,
        has_full_data_access: false,
        permissions: [],
      });
    }
  }, [role]);

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: isNew ? generateSlug(name) : prev.slug,
    }));
  };

  const handleSave = async () => {
    try {
      if (isNew) {
        await createRole({
          slug: form.slug,
          name: form.name,
          description: form.description,
          hierarchy_level: form.hierarchy_level,
          has_full_data_access: form.has_full_data_access,
          permissions: form.permissions,
        });
        toast.success("Role created successfully");
      } else {
        await updateRole({
          name: form.name,
          description: form.description,
          hierarchy_level: form.hierarchy_level,
          has_full_data_access: form.has_full_data_access,
          permissions: form.permissions,
        });
        toast.success("Role updated successfully");
      }
      onSave();
    } catch (error) {
      toast.error(isNew ? "Failed to create role" : "Failed to update role");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[600px] sm:max-w-[600px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {isNew ? "Create Custom Role" : role?.name}
            {isSystem && (
              <Badge variant="secondary">System Role</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="details" className="mt-6">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="permissions">
              Permissions ({form.permissions.length})
            </TabsTrigger>
            {!isNew && (
              <TabsTrigger value="members">Members</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            {/* ... same as before ... */}
          </TabsContent>

          <TabsContent value="permissions" className="mt-4">
            <PermissionSelector
              selected={form.permissions}
              onChange={(permissions) =>
                setForm((prev) => ({ ...prev, permissions }))
              }
              disabled={isSystem}
            />
          </TabsContent>

          {!isNew && role && (
            <TabsContent value="members" className="mt-4">
              <RoleMembersTab roleId={role.id} roleName={role.name} />
            </TabsContent>
          )}
        </Tabs>

        {!isSystem && (
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isCreating || isUpdating || !form.name || form.permissions.length === 0}
            >
              {isCreating || isUpdating ? "Saving..." : isNew ? "Create Role" : "Save Changes"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

### 3.6 Role Members Tab

**File:** `ui/src/features/access-control/components/role-members-tab.tsx`

```tsx
import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { AddMemberToRoleDialog } from "./add-member-to-role-dialog";
import { toast } from "sonner";

interface RoleMember {
  user_id: string;
  name: string;
  email: string;
  avatar_url?: string;
  assigned_at: string;
}

interface RoleMembersTabProps {
  roleId: string;
  roleName: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json()).then((d) => d.data);

export function RoleMembersTab({ roleId, roleName }: RoleMembersTabProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: members, isLoading, mutate } = useSWR<RoleMember[]>(
    `/api/v1/roles/${roleId}/members`,
    fetcher
  );

  const handleRemoveMember = async (userId: string) => {
    try {
      await fetch(`/api/v1/roles/${roleId}/members/${userId}`, {
        method: "DELETE",
      });
      toast.success("Member removed from role");
      mutate();
    } catch (error) {
      toast.error("Failed to remove member");
    }
  };

  const handleAddMember = async (userId: string) => {
    try {
      await fetch(`/api/v1/roles/${roleId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      toast.success("Member added to role");
      mutate();
      setIsAddOpen(false);
    } catch (error) {
      toast.error("Failed to add member");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {members?.length || 0} users have this role
        </p>
        <Button size="sm" onClick={() => setIsAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Member
        </Button>
      </div>

      <div className="space-y-2">
        {members?.map((member) => (
          <div
            key={member.user_id}
            className="flex items-center justify-between p-3 border rounded-lg"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={member.avatar_url} />
                <AvatarFallback>
                  {member.name?.charAt(0)?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveMember(member.user_id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}

        {members?.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No members have this role yet
          </div>
        )}
      </div>

      <AddMemberToRoleDialog
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onAdd={handleAddMember}
        roleName={roleName}
        existingMemberIds={members?.map((m) => m.user_id) || []}
      />
    </div>
  );
}
```

### 3.7 User Roles Multi-Select (trong Member Management)

**File:** `ui/src/features/team/components/member-roles-editor.tsx`

```tsx
import { useState } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown, Shield, Loader2 } from "lucide-react";
import { Role } from "@/features/access-control/types/role.types";
import { toast } from "sonner";

interface MemberRolesEditorProps {
  userId: string;
  currentRoleIds: string[];
  onUpdate: () => void;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json()).then((d) => d.data);

export function MemberRolesEditor({
  userId,
  currentRoleIds,
  onUpdate,
}: MemberRolesEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(currentRoleIds);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch all available roles
  const { data: roles, isLoading } = useSWR<Role[]>("/api/v1/roles", fetcher);

  // Fetch user's current roles
  const { data: userRoles } = useSWR<Role[]>(
    `/api/v1/users/${userId}/roles`,
    fetcher
  );

  const toggleRole = (roleId: string) => {
    setSelectedIds((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch(`/api/v1/users/${userId}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_ids: selectedIds }),
      });
      toast.success("Roles updated successfully");
      onUpdate();
      setIsOpen(false);
    } catch (error) {
      toast.error("Failed to update roles");
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    JSON.stringify(selectedIds.sort()) !== JSON.stringify(currentRoleIds.sort());

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Shield className="h-4 w-4" />
          {userRoles?.length || 0} roles
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div className="font-medium">Assign Roles</div>

          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {roles?.map((role) => (
                <div
                  key={role.id}
                  className="flex items-center gap-3 p-2 hover:bg-muted rounded"
                >
                  <Checkbox
                    checked={selectedIds.includes(role.id)}
                    onCheckedChange={() => toggleRole(role.id)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{role.name}</span>
                      {role.is_system && (
                        <Badge variant="secondary" className="text-xs">
                          System
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {role.permission_count} permissions
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

### 3.8 Display User's Roles as Badges

**File:** `ui/src/features/team/components/member-roles-badges.tsx`

```tsx
import { Badge } from "@/components/ui/badge";
import { Role } from "@/features/access-control/types/role.types";

interface MemberRolesBadgesProps {
  roles: Role[];
  maxDisplay?: number;
}

export function MemberRolesBadges({
  roles,
  maxDisplay = 3,
}: MemberRolesBadgesProps) {
  const displayRoles = roles.slice(0, maxDisplay);
  const remaining = roles.length - maxDisplay;

  return (
    <div className="flex flex-wrap gap-1">
      {displayRoles.map((role) => (
        <Badge
          key={role.id}
          variant={role.is_system ? "default" : "secondary"}
          className="text-xs"
        >
          {role.name}
        </Badge>
      ))}
      {remaining > 0 && (
        <Badge variant="outline" className="text-xs">
          +{remaining} more
        </Badge>
      )}
    </div>
  );
}
```

### 3.6 Update Navigation

**File:** `ui/src/app/(dashboard)/settings/access-control/layout.tsx` (update)

```tsx
// Add Roles tab to navigation
const tabs = [
  { name: "Roles", href: "/settings/access-control/roles" },
  { name: "Groups", href: "/settings/access-control/groups" },
];
```

### 3.9 Update usePermissions Hook (Multiple Roles)

**File:** `ui/src/hooks/use-permissions.ts` (update)

```typescript
import useSWR from 'swr';

interface RoleInfo {
  id: string;
  slug: string;
  name: string;
  is_system: boolean;
  hierarchy_level: number;
  has_full_data_access: boolean;
}

interface AccessScope {
  user_id: string;
  tenant_id: string;
  roles: RoleInfo[];           // Multiple roles
  permissions: string[];       // UNION of all roles' permissions
  is_full_data_access: boolean;
  group_ids: string[];
  accessible_assets: string[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json()).then((d) => d.data);

export function usePermissions() {
  const { data: scope, error, isLoading } = useSWR<AccessScope>(
    '/api/v1/me/access-scope',
    fetcher
  );

  const can = (permission: string): boolean => {
    if (!scope) return false;
    return scope.permissions.includes(permission);
  };

  const canAny = (permissions: string[]): boolean => {
    if (!scope) return false;
    return permissions.some((p) => scope.permissions.includes(p));
  };

  const canAll = (permissions: string[]): boolean => {
    if (!scope) return false;
    return permissions.every((p) => scope.permissions.includes(p));
  };

  // Get the highest role (by hierarchy level)
  const getHighestRole = (): RoleInfo | null => {
    if (!scope || scope.roles.length === 0) return null;
    return scope.roles.reduce((highest, role) =>
      role.hierarchy_level > highest.hierarchy_level ? role : highest
    );
  };

  // Check if user has a specific role
  const hasRole = (roleSlug: string): boolean => {
    if (!scope) return false;
    return scope.roles.some((r) => r.slug === roleSlug);
  };

  return {
    scope,
    roles: scope?.roles ?? [],
    permissions: scope?.permissions ?? [],
    isFullDataAccess: scope?.is_full_data_access ?? false,
    can,
    canAny,
    canAll,
    hasRole,
    getHighestRole,
    isLoading,
    error,
  };
}
```

### 3.10 API Hooks for User Roles

**File:** `ui/src/features/access-control/api/use-user-roles.ts`

```typescript
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { Role } from '../types/role.types';

const fetcher = (url: string) => fetch(url).then((res) => res.json()).then((d) => d.data);

const mutationFetcher = async (
  url: string,
  { arg }: { arg: { method: string; body?: unknown } }
) => {
  const res = await fetch(url, {
    method: arg.method,
    headers: { 'Content-Type': 'application/json' },
    body: arg.body ? JSON.stringify(arg.body) : undefined,
  });
  if (!res.ok) throw new Error('Request failed');
  if (res.status === 204) return null;
  return res.json().then((d) => d.data);
};

// Get roles for a specific user
export function useUserRoles(userId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Role[]>(
    userId ? `/api/v1/users/${userId}/roles` : null,
    fetcher
  );

  return {
    roles: data || [],
    isLoading,
    error,
    refresh: mutate,
  };
}

// Assign a role to user
export function useAssignRole(userId: string) {
  const { trigger, isMutating } = useSWRMutation(
    `/api/v1/users/${userId}/roles`,
    mutationFetcher
  );

  return {
    assignRole: (roleId: string) =>
      trigger({ method: 'POST', body: { role_id: roleId } }),
    isAssigning: isMutating,
  };
}

// Remove a role from user
export function useRemoveRole(userId: string, roleId: string) {
  const { trigger, isMutating } = useSWRMutation(
    `/api/v1/users/${userId}/roles/${roleId}`,
    mutationFetcher
  );

  return {
    removeRole: () => trigger({ method: 'DELETE' }),
    isRemoving: isMutating,
  };
}

// Set all roles for user (replace)
export function useSetUserRoles(userId: string) {
  const { trigger, isMutating } = useSWRMutation(
    `/api/v1/users/${userId}/roles`,
    mutationFetcher
  );

  return {
    setRoles: (roleIds: string[]) =>
      trigger({ method: 'PUT', body: { role_ids: roleIds } }),
    isSetting: isMutating,
  };
}

// Get members of a role
export function useRoleMembers(roleId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    roleId ? `/api/v1/roles/${roleId}/members` : null,
    fetcher
  );

  return {
    members: data || [],
    isLoading,
    error,
    refresh: mutate,
  };
}
```

### 3.12 Tasks Summary

| Task | Description | File | Status |
|------|-------------|------|--------|
| 3.1 | Create Role types | `types/role.types.ts` | ⬜ |
| 3.2 | Create Permission types | `types/permission.types.ts` | ⬜ |
| 3.3 | Create usePermissionModules hook | `api/use-permissions.ts` | ⬜ |
| 3.4 | Create useRoles hooks | `api/use-roles.ts` | ⬜ |
| 3.5 | Create useUserRoles hooks | `api/use-user-roles.ts` | ⬜ |
| 3.6 | Create Roles page | `roles/page.tsx` | ⬜ |
| 3.7 | Create Permission Selector (fetches from API) | `permission-selector.tsx` | ⬜ |
| 3.8 | Create Role Detail Sheet (with Members tab) | `role-detail-sheet.tsx` | ⬜ |
| 3.9 | Create Role Members Tab | `role-members-tab.tsx` | ⬜ |
| 3.10 | Create Add Member to Role Dialog | `add-member-to-role-dialog.tsx` | ⬜ |
| 3.11 | Create Member Roles Editor (multi-select) | `member-roles-editor.tsx` | ⬜ |
| 3.12 | Create Member Roles Badges | `member-roles-badges.tsx` | ⬜ |
| 3.13 | Update usePermissions hook (multiple roles) | `use-permissions.ts` | ⬜ |
| 3.14 | Update navigation | `layout.tsx` | ⬜ |
| 3.15 | Update Member list to show roles | `members/page.tsx` | ⬜ |

---

## Phase 4: Cleanup & Migration

### Duration: 1-2 days

### 4.1 Database Cleanup Migration

**File:** `api/migrations/000048_cleanup_permission_sets.up.sql`

```sql
-- ============================================================================
-- CLEANUP: Remove unused permission set tables
-- ============================================================================

-- Keep these tables (used for data scoping):
-- - groups
-- - group_members
-- - asset_owners

-- Remove these tables (replaced by roles system):
DROP TABLE IF EXISTS group_permission_sets CASCADE;
DROP TABLE IF EXISTS group_permissions CASCADE;
DROP TABLE IF EXISTS permission_set_items CASCADE;
DROP TABLE IF EXISTS permission_set_versions CASCADE;
DROP TABLE IF EXISTS permission_sets CASCADE;
DROP TABLE IF EXISTS assignment_rules CASCADE;

-- Remove old role column from tenant_members (if not already done)
ALTER TABLE tenant_members DROP COLUMN IF EXISTS role;

-- Clean up groups table - remove permission-related columns if any
-- (groups should only be used for data scoping now)
```

### 4.2 Backend Cleanup

| Task | Description | Action |
|------|-------------|--------|
| 4.2.1 | Remove `RolePermissions` map | Delete `domain/permission/role_mapping.go` |
| 4.2.2 | Remove `PermissionService` | Delete or simplify `app/permission_service.go` |
| 4.2.3 | Remove permission set handlers | Remove from `handler/permission_set_handler.go` |
| 4.2.4 | Update `GroupService` | Remove permission set logic, keep only data scoping |
| 4.2.5 | Remove unused domain models | Clean up `domain/permissionset/` |

### 4.3 Frontend Cleanup

| Task | Description | Action |
|------|-------------|--------|
| 4.3.1 | Remove Permission Sets page | Delete `permission-sets/page.tsx` |
| 4.3.2 | Update navigation | Remove Permission Sets tab |
| 4.3.3 | Update Group detail | Remove permission sets tab |
| 4.3.4 | Clean up types | Remove permission set types |

### 4.4 Documentation Update

| Task | Description | File |
|------|-------------|------|
| 4.4.1 | Update API docs | Add roles endpoints |
| 4.4.2 | Update architecture docs | Reflect new design |
| 4.4.3 | Create migration guide | For existing users |

---

## Summary

### Total Tasks: 50+

| Phase | Tasks | Duration |
|-------|-------|----------|
| Phase 1: Database | 4 | 1-2 days |
| Phase 2: Backend | 12 | 3-4 days |
| Phase 3: Frontend | 15 | 2-3 days |
| Phase 4: Cleanup | 10+ | 1-2 days |

### Key Changes

1. **Permissions in Database**
   - `modules` table: group permissions by feature
   - `permissions` table: all available permissions
   - Fetch from API, not hardcoded in frontend

2. **Roles in Database**
   - System roles: owner, admin, member, viewer (immutable)
   - Custom roles: tenant-created with custom permissions
   - `role_permissions` references `permissions.id`

3. **Multiple Roles per User**
   - `user_roles` table: user_id + tenant_id + role_id
   - User can have MULTIPLE roles
   - Permissions = UNION of all roles' permissions
   - Data access = ANY role has_full_data_access → full access

4. **Groups for Data Scoping Only**
   - Groups own assets
   - Users in groups can see group's assets
   - No permissions in groups

5. **Removed**
   - Permission sets tables
   - Group permissions
   - Hardcoded `RolePermissions` map

### Architecture After Implementation

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FINAL ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   PERMISSIONS (in Database)                                         │
│   ═════════════════════════                                         │
│                                                                      │
│   modules → permissions                                             │
│   │                                                                  │
│   ├── assets    → assets:read, assets:write, assets:delete         │
│   ├── findings  → findings:read, findings:write, ...               │
│   └── ...                                                           │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ROLES (in Database)                                               │
│   ═══════════════════                                               │
│                                                                      │
│   roles → role_permissions → permissions                            │
│   │                                                                  │
│   ├── System: owner(100), admin(80), member(50), viewer(20)        │
│   └── Custom: security_lead(60), developer(40), ...                │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   USER ROLES (Multiple Roles per User)                              │
│   ════════════════════════════════════                              │
│                                                                      │
│   user_roles: user_id + tenant_id + role_id                         │
│                                                                      │
│   User A ─┬─> Developer (50)                                        │
│           └─> Security Analyst (60)                                 │
│                                                                      │
│   Permissions = UNION of all roles                                  │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ACCESS CHECK                                                       │
│   ════════════                                                       │
│                                                                      │
│   1. Get ALL user's roles from user_roles                           │
│   2. Get permissions from each role (UNION, dedupe)                 │
│   3. Check if required permission exists                            │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   DATA SCOPING                                                       │
│   ════════════                                                       │
│                                                                      │
│   1. If ANY role has_full_data_access = true → see ALL data        │
│   2. Else → get user's groups → get groups' assets → filter        │
│                                                                      │
│   groups + group_members + asset_owners = Data Scoping              │
│   (No permissions in groups)                                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Database Schema Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DATABASE TABLES                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   PERMISSION MANAGEMENT                                             │
│   ─────────────────────                                             │
│   modules              - Feature groupings                          │
│   permissions          - All available permissions (FK to modules)  │
│   roles                - System + Custom roles                      │
│   role_permissions     - Role → Permission mapping (FK to perms)   │
│   user_roles           - User → Role mapping (multiple per user)   │
│                                                                      │
│   DATA SCOPING                                                       │
│   ────────────                                                       │
│   groups               - User groups (for organizing)               │
│   group_members        - User membership in groups                  │
│   asset_owners         - Group → Asset ownership                    │
│                                                                      │
│   EXISTING (unchanged)                                              │
│   ────────────────────                                              │
│   tenant_members       - User membership in tenants                 │
│                          (remove old 'role' column)                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### API Endpoints Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    API ENDPOINTS                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   PERMISSIONS                                                        │
│   GET  /api/v1/permissions           - List all permissions         │
│   GET  /api/v1/permissions/modules   - List modules with perms      │
│                                                                      │
│   ROLES                                                              │
│   GET  /api/v1/roles                 - List all roles               │
│   POST /api/v1/roles                 - Create custom role           │
│   GET  /api/v1/roles/:id             - Get role details             │
│   PUT  /api/v1/roles/:id             - Update custom role           │
│   DEL  /api/v1/roles/:id             - Delete custom role           │
│                                                                      │
│   ROLE MEMBERS                                                       │
│   GET  /api/v1/roles/:id/members     - List users with role         │
│   POST /api/v1/roles/:id/members     - Add user to role             │
│   DEL  /api/v1/roles/:id/members/:uid - Remove user from role       │
│                                                                      │
│   USER ROLES                                                         │
│   GET  /api/v1/users/:id/roles       - Get user's roles             │
│   POST /api/v1/users/:id/roles       - Assign role to user          │
│   PUT  /api/v1/users/:id/roles       - Set all roles (replace)      │
│   DEL  /api/v1/users/:id/roles/:rid  - Remove role from user        │
│                                                                      │
│   CURRENT USER                                                       │
│   GET  /api/v1/me/access-scope       - Get current user's scope     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

**Author:** Platform Team
**Created:** 2026-01-22
**Updated:** 2026-01-22 (Multiple Roles per User)
