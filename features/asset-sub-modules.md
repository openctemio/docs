---
layout: default
title: Asset Sub-Modules
parent: Features
nav_order: 10
---

# Asset Sub-Modules

> **Status**: ✅ Implemented
> **Released**: 2026-01-24
> **Author**: Claude Code

## Overview

Implement a hierarchical module system to manage visibility of individual asset types (domains, certificates, websites, etc.) in the sidebar. This allows dynamic control over which asset modules are shown/hidden without code changes.

## Problem Statement

Currently, all 17 asset types are hardcoded in the sidebar. We need:
1. Dynamic control over which asset types are visible
2. Ability to mark modules as "coming soon" or "disabled"
3. No code changes required to enable/disable modules
4. Centralized management from database

## Solution: Hierarchical Sub-Modules with Inheritance

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  TENANT LEVEL (tenant_modules)                    │
│                                                                  │
│  Tenant A → has module "assets" ✓                                │
│  Tenant B → has module "assets" ✓                                │
│  Tenant C → has module "assets" ✓                                │
│                                                                  │
│  (No need to add sub-modules to tenant_modules)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ Inheritance
┌─────────────────────────────────────────────────────────────────┐
│                 MODULE LEVEL (modules table)                     │
│                                                                  │
│  Parent: assets (category: core)                                │
│    │                                                            │
│    ├── assets.domains      │ released     │ → Visible           │
│    ├── assets.certificates │ released     │ → Visible           │
│    ├── assets.ip-addresses │ released     │ → Visible           │
│    ├── assets.websites     │ released     │ → Visible           │
│    ├── assets.apis         │ released     │ → Visible           │
│    ├── assets.mobile       │ coming_soon  │ → "Soon" badge      │
│    ├── assets.services     │ coming_soon  │ → "Soon" badge      │
│    ├── assets.cloud        │ disabled     │ → Hidden            │
│    ├── assets.containers   │ coming_soon  │ → "Soon" badge      │
│    └── assets.repositories │ released     │ → Visible           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Sidebar)                          │
│                                                                  │
│  Asset Inventory:                                                │
│  ├─ Overview (always shown)                                     │
│  ├─ Domains ✓                                                   │
│  ├─ Certificates ✓                                              │
│  ├─ IP Addresses ✓                                              │
│  ├─ Websites ✓                                                  │
│  ├─ APIs ✓                                                      │
│  ├─ Mobile Apps [Soon]                                          │
│  ├─ Services [Soon]                                             │
│  ├─ Kubernetes [Soon]                                           │
│  └─ Repositories ✓                                              │
│                                                                  │
│  (Cloud hidden - status = disabled)                             │
└─────────────────────────────────────────────────────────────────┘
```

### Access Control Logic

```
canAccessSubModule(tenantID, subModuleID):
  1. Get parent module ID (e.g., "assets.domains" → "assets")
  2. Check if tenant's plan has parent module
     - If NO → return false (plan doesn't include Asset Inventory)
  3. Get sub-module from database
  4. Check release_status:
     - "released" → visible and usable
     - "coming_soon" → visible with badge, disabled
     - "beta" → visible with badge, usable
     - "disabled" → hidden completely
  5. Return visibility info
```

## Implementation Steps

### Phase 1: Database Migration

**File**: `api/migrations/000XXX_add_asset_sub_modules.up.sql`

```sql
-- 1. Add parent_module_id column to modules table
ALTER TABLE modules ADD COLUMN parent_module_id VARCHAR(50) REFERENCES modules(id);

-- 2. Add index for faster sub-module queries
CREATE INDEX idx_modules_parent_id ON modules(parent_module_id) WHERE parent_module_id IS NOT NULL;

-- 3. Insert asset sub-modules
INSERT INTO modules (id, slug, name, description, icon, category, parent_module_id, display_order, is_active, release_status)
VALUES
  -- External Attack Surface
  ('assets.domains', 'domains', 'Domains', 'Root domains and subdomains', 'globe', 'core', 'assets', 1, true, 'released'),
  ('assets.certificates', 'certificates', 'Certificates', 'SSL/TLS certificates', 'shield-check', 'core', 'assets', 2, true, 'released'),
  ('assets.ip-addresses', 'ip-addresses', 'IP Addresses', 'IPv4 and IPv6 addresses', 'network', 'core', 'assets', 3, true, 'released'),

  -- Applications
  ('assets.websites', 'websites', 'Websites', 'Web applications and portals', 'monitor', 'core', 'assets', 10, true, 'released'),
  ('assets.apis', 'apis', 'APIs', 'REST, GraphQL, and SOAP APIs', 'zap', 'core', 'assets', 11, true, 'released'),
  ('assets.mobile', 'mobile', 'Mobile Apps', 'iOS and Android applications', 'smartphone', 'core', 'assets', 12, true, 'coming_soon'),
  ('assets.services', 'services', 'Services', 'Microservices and backend services', 'zap', 'core', 'assets', 13, true, 'coming_soon'),

  -- Cloud Infrastructure
  ('assets.cloud-accounts', 'cloud-accounts', 'Cloud Accounts', 'AWS, GCP, Azure accounts', 'cloud', 'core', 'assets', 20, true, 'coming_soon'),
  ('assets.cloud', 'cloud', 'Cloud Resources', 'Cloud resources and services', 'cloud', 'core', 'assets', 21, true, 'coming_soon'),
  ('assets.compute', 'compute', 'Compute', 'EC2, VMs, compute instances', 'server', 'core', 'assets', 22, true, 'coming_soon'),
  ('assets.storage', 'storage', 'Storage', 'S3, Blob storage, buckets', 'database', 'core', 'assets', 23, true, 'coming_soon'),
  ('assets.serverless', 'serverless', 'Serverless', 'Lambda, Cloud Functions', 'zap', 'core', 'assets', 24, true, 'coming_soon'),

  -- Infrastructure
  ('assets.hosts', 'hosts', 'Hosts', 'Servers and virtual machines', 'server', 'core', 'assets', 30, true, 'coming_soon'),
  ('assets.containers', 'containers', 'Kubernetes', 'Kubernetes clusters and workloads', 'boxes', 'core', 'assets', 31, true, 'coming_soon'),
  ('assets.databases', 'databases', 'Databases', 'Database servers and instances', 'database', 'core', 'assets', 32, true, 'coming_soon'),
  ('assets.networks', 'networks', 'Networks', 'VPCs, firewalls, load balancers', 'network', 'core', 'assets', 33, true, 'coming_soon'),

  -- Code & CI/CD
  ('assets.repositories', 'repositories', 'Repositories', 'Source code repositories', 'git-branch', 'core', 'assets', 40, true, 'released')
ON CONFLICT (id) DO UPDATE SET
  parent_module_id = EXCLUDED.parent_module_id,
  display_order = EXCLUDED.display_order,
  release_status = EXCLUDED.release_status;
```

**Down migration**: `000XXX_add_asset_sub_modules.down.sql`
```sql
DELETE FROM modules WHERE parent_module_id = 'assets';
ALTER TABLE modules DROP COLUMN parent_module_id;
```

### Phase 2: Backend Domain Model

**File**: `api/internal/domain/licensing/module.go`

Add field to Module struct:
```go
type Module struct {
    // ... existing fields ...
    parentModuleID *string  // NEW: Parent module ID for sub-modules
}

// Constructor update
func NewModule(id, slug, name string, opts ...ModuleOption) *Module {
    // ...
}

// New option
func WithParentModule(parentID string) ModuleOption {
    return func(m *Module) {
        m.parentModuleID = &parentID
    }
}

// Getters
func (m *Module) ParentModuleID() *string {
    return m.parentModuleID
}

func (m *Module) IsSubModule() bool {
    return m.parentModuleID != nil
}

func (m *Module) HasParent(parentID string) bool {
    return m.parentModuleID != nil && *m.parentModuleID == parentID
}
```

### Phase 3: Backend Repository

**File**: `api/internal/infra/postgres/licensing_repository.go`

Add methods:
```go
// GetSubModules returns all sub-modules for a parent module
func (r *LicensingRepository) GetSubModules(ctx context.Context, parentModuleID string) ([]*licensing.Module, error) {
    query := `
        SELECT id, slug, name, description, icon, category,
               display_order, is_active, COALESCE(release_status, 'released'),
               parent_module_id
        FROM modules
        WHERE parent_module_id = $1 AND is_active = true
        ORDER BY display_order ASC
    `
    // ... implementation
}

// GetModuleWithSubModules returns a module with its sub-modules
func (r *LicensingRepository) GetModuleWithSubModules(ctx context.Context, moduleID string) (*licensing.Module, []*licensing.Module, error) {
    module, err := r.GetModuleByID(ctx, moduleID)
    if err != nil {
        return nil, nil, err
    }

    subModules, err := r.GetSubModules(ctx, moduleID)
    if err != nil {
        return nil, nil, err
    }

    return module, subModules, nil
}
```

Update existing methods to include parent_module_id in SELECT.

### Phase 4: Backend Service

**File**: `api/internal/app/module_service.go`

Add method:
```go
// GetTenantModulesWithSubModules returns modules with their sub-modules
func (s *ModuleService) GetTenantModulesWithSubModules(ctx context.Context, tenantID uuid.UUID) (*TenantModulesResult, error) {
    // 1. Get tenant's enabled modules
    modules, err := s.GetTenantEnabledModules(ctx, tenantID)
    if err != nil {
        return nil, err
    }

    // 2. For each module, get sub-modules
    subModulesMap := make(map[string][]*licensing.Module)
    for _, m := range modules {
        subModules, err := s.repo.GetSubModules(ctx, m.ID())
        if err != nil {
            continue // Skip on error
        }
        if len(subModules) > 0 {
            subModulesMap[m.ID()] = subModules
        }
    }

    return &TenantModulesResult{
        Modules:    modules,
        SubModules: subModulesMap,
    }, nil
}

type TenantModulesResult struct {
    Modules    []*licensing.Module
    SubModules map[string][]*licensing.Module // parent_id -> sub-modules
}
```

### Phase 5: Backend HTTP Handler

**File**: `api/internal/infra/http/handler/licensing_handler.go`

Update response struct:
```go
type LicensingModuleResponse struct {
    ID             string   `json:"id"`
    Slug           string   `json:"slug"`
    Name           string   `json:"name"`
    Description    string   `json:"description,omitempty"`
    Icon           string   `json:"icon,omitempty"`
    Category       string   `json:"category"`
    DisplayOrder   int      `json:"display_order"`
    IsActive       bool     `json:"is_active"`
    ReleaseStatus  string   `json:"release_status"`
    ParentModuleID *string  `json:"parent_module_id,omitempty"` // NEW
    EventTypes     []string `json:"event_types,omitempty"`
}

type TenantModulesResponse struct {
    ModuleIDs           []string                            `json:"module_ids"`
    Modules             []LicensingModuleResponse           `json:"modules"`
    SubModules          map[string][]LicensingModuleResponse `json:"sub_modules"` // NEW: parent_id -> sub-modules
    EventTypes          []string                            `json:"event_types"`
    ComingSoonModuleIDs []string                            `json:"coming_soon_module_ids"`
    BetaModuleIDs       []string                            `json:"beta_module_ids"`
}
```

Update handler to populate sub_modules.

### Phase 6: Frontend Types

**File**: `ui/src/features/integrations/api/use-tenant-modules.ts`

Update interface:
```typescript
interface LicensingModule {
    id: string
    slug: string
    name: string
    description?: string
    icon?: string
    category: string
    display_order: number
    is_active: boolean
    release_status: ReleaseStatus
    parent_module_id?: string  // NEW
    event_types?: string[]
}

interface TenantModulesResponse {
    module_ids: string[]
    modules: LicensingModule[]
    sub_modules: Record<string, LicensingModule[]>  // NEW: parent_id -> sub-modules
    event_types: string[]
    coming_soon_module_ids: string[]
    beta_module_ids: string[]
}
```

Update hook return type:
```typescript
export function useTenantModules() {
    // ...
    return {
        moduleIds,
        modules,
        subModules,  // NEW
        eventTypes,
        comingSoonModuleIds,
        betaModuleIds,
        isLoading,
        error,
        mutate
    }
}
```

### Phase 7: Frontend Sidebar Integration

**File**: `ui/src/components/layout/nav-group.tsx`

Update to filter items based on sub-modules:
```typescript
import { useTenantModules } from '@/features/integrations/api/use-tenant-modules'

function SidebarMenuCollapsible({ item, ... }) {
    const { subModules } = useTenantModules()

    // Filter sub-items based on asset module status
    const filteredItems = useMemo(() => {
        if (!item.items) return []

        return item.items.filter(subItem => {
            // No assetModuleKey = always show (like Overview)
            if (!subItem.assetModuleKey) return true

            // Get sub-modules for parent (e.g., "assets")
            const parentSubModules = subModules?.['assets'] || []
            const subModule = parentSubModules.find(
                m => m.slug === subItem.assetModuleKey
            )

            // Not found in sub-modules = hide (not configured)
            if (!subModule) return false

            // Check release status
            return subModule.release_status !== 'disabled'
        }).map(subItem => {
            // Add release status info for badge display
            const parentSubModules = subModules?.['assets'] || []
            const subModule = parentSubModules.find(
                m => m.slug === subItem.assetModuleKey
            )
            return {
                ...subItem,
                releaseStatus: subModule?.release_status
            }
        })
    }, [item.items, subModules])

    // Render with filteredItems
}
```

### Phase 8: Testing

1. **Unit Tests**:
   - Module entity with parent
   - Repository sub-module queries
   - Service sub-module logic

2. **Integration Tests**:
   - API endpoint returns sub-modules
   - Sub-modules filtered by release_status

3. **Manual Tests**:
   - Enable/disable module via database
   - Verify sidebar updates

## Rollout Plan

### Step 1: Deploy Backend (Safe)
- Run migration (adds column, inserts data)
- Deploy backend code
- Existing API responses unchanged (sub_modules empty initially)

### Step 2: Deploy Frontend
- Deploy frontend with sub-module filtering
- Sidebar now respects module status

### Step 3: Configure Modules
- Update release_status for modules as they become ready
- No code deployment needed

## Admin Operations

### Enable a module
```sql
UPDATE modules SET release_status = 'released' WHERE id = 'assets.mobile';
```

### Mark as coming soon
```sql
UPDATE modules SET release_status = 'coming_soon' WHERE id = 'assets.cloud';
```

### Hide a module completely
```sql
UPDATE modules SET release_status = 'disabled' WHERE id = 'assets.networks';
-- OR
UPDATE modules SET is_active = false WHERE id = 'assets.networks';
```

### Check current status
```sql
SELECT id, name, release_status, is_active
FROM modules
WHERE parent_module_id = 'assets'
ORDER BY display_order;
```

## Future Enhancements

1. **Admin UI**: Web interface to manage module status
2. **Per-Tenant Sub-Modules**: Add sub-modules to tenant_modules for granular control
3. **Module Limits**: Add limits like `{"max_domains": 100}` per tenant
4. **Audit Logging**: Log module status changes

## Files to Modify

### Backend
- [x] `api/migrations/000079_add_asset_sub_modules.up.sql` (NEW)
- [x] `api/migrations/000079_add_asset_sub_modules.down.sql` (NEW)
- [x] `api/internal/domain/licensing/module.go`
- [x] `api/internal/infra/postgres/licensing_repository.go`
- [x] `api/internal/app/licensing_service.go`
- [x] `api/internal/infra/http/handler/licensing_handler.go`

### Frontend
- [x] `ui/src/features/integrations/api/use-tenant-modules.ts`
- [x] `ui/src/components/layout/nav-group.tsx`
- [x] `ui/src/config/sidebar-data.ts` (already has assetModuleKey)

### Cleanup (after implementation)
- [ ] `ui/src/config/asset-modules.ts` (can be removed - replaced by database)
