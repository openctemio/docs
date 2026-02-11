---
layout: default
title: Route-Level Permission Protection
parent: Architecture
nav_order: 24
---

# Route-Level Permission Protection

## Technical Specification Document

**Version:** 1.0
**Status:** Implemented
**Author:** Engineering Team
**Created:** 2026-01-24
**Last Updated:** 2026-01-24

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Design](#3-solution-design)
4. [Implementation Details](#4-implementation-details)
5. [Route-Permission Mapping](#5-route-permission-mapping)
6. [Access Control Layers](#6-access-control-layers)
7. [User Experience](#7-user-experience)
8. [Testing Guide](#8-testing-guide)

---

## 1. Executive Summary

### 1.1 Overview

This document describes the implementation of route-level permission protection in the frontend application. The system ensures that users cannot access pages directly via URL if they don't have the required permissions, complementing the existing sidebar filtering.

### 1.2 Key Benefits

| Benefit | Description |
|---------|-------------|
| **Security** | Users cannot bypass sidebar hiding by typing URLs directly |
| **Proper RBAC** | Enforced at both UI and route level |
| **Multi-layer** | Checks both module (licensing) and permission (RBAC) |
| **User-friendly** | Shows clear access denied messages with actionable guidance |

---

## 2. Problem Statement

### 2.1 Previous Behavior

The sidebar correctly hid menu items based on user permissions, but users could still access restricted pages by:
1. Typing the URL directly in the browser
2. Using bookmarks to saved pages
3. Clicking links shared by other users

```
Previous Flow:
───────────────────────────────────────────────────────────────────
User (Member role) with URL /settings/audit
                          ↓
                   Sidebar hides "Audit Log" menu item
                   BUT page still loads!
                          ↓
                   User sees audit page content
                   (Backend returns 403 on API calls)
───────────────────────────────────────────────────────────────────
```

### 2.2 Issues

1. **Security Gap**: Users could see restricted page UI even without permission
2. **Poor UX**: Pages would load but API calls would fail with 403
3. **Inconsistent**: Sidebar and route protection were not aligned

---

## 3. Solution Design

### 3.1 Architecture

The solution implements a `RouteGuard` component that checks access before rendering page content:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ROUTE GUARD FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User navigates to /settings/audit                               │
│                    ↓                                             │
│  RouteGuard extracts pathname                                    │
│                    ↓                                             │
│  Match route against route-permissions config                    │
│                    ↓                                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Layer 1: Module Check (Licensing)                           ││
│  │ "Does tenant's plan include 'audit' module?"                ││
│  │                                                             ││
│  │ If NO → Show "Feature Not Available" page                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                    ↓                                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Layer 2: Permission Check (RBAC)                            ││
│  │ "Does user have 'audit:read' permission?"                   ││
│  │                                                             ││
│  │ If NO → Show "Access Denied" page                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                    ↓                                             │
│  User has access → Render page content                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Hierarchy

```
DashboardLayout
├── DashboardProviders (TenantProvider, PermissionProvider)
│   └── TenantGate
│       └── SidebarProvider
│           ├── AppSidebar (filtered by permissions)
│           └── SidebarInset
│               └── RouteGuard ← NEW
│                   └── {children} (page content)
```

---

## 4. Implementation Details

### 4.1 Key Files

| File | Purpose |
|------|---------|
| `ui/src/config/route-permissions.ts` | Route-to-permission mapping configuration |
| `ui/src/components/route-guard.tsx` | RouteGuard component that enforces access |
| `ui/src/app/(dashboard)/layout.tsx` | Dashboard layout that wraps children with RouteGuard |

### 4.2 Route Permission Configuration

```typescript
// ui/src/config/route-permissions.ts

export interface RoutePermissionConfig {
  /** Required permission (RBAC layer) */
  permission: string
  /** Required module (Licensing layer) */
  module?: string
  /** Custom message for access denied */
  message?: string
}

export const routePermissions: Record<string, RoutePermissionConfig> = {
  '/settings/audit': {
    permission: Permission.AuditRead,
    module: Module.Audit,
    message: 'Audit logs require admin or owner privileges.',
  },
  '/settings/billing': {
    permission: Permission.BillingRead,
    module: Module.Billing,
    message: 'Billing information requires admin or owner privileges.',
  },
  // ... more routes
}
```

### 4.3 Pattern Matching

The route matcher supports:
- **Exact match**: `/settings/audit` matches only that path
- **Single wildcard**: `/assets/*` matches `/assets/domains`, `/assets/cloud`
- **Double wildcard**: `/settings/**` matches all nested paths

```typescript
// Pattern matching priority:
// 1. Exact matches first
// 2. Longer patterns before shorter ones
// 3. Wildcards processed last
```

### 4.4 RouteGuard Component

```typescript
// ui/src/components/route-guard.tsx

export function RouteGuard({ children }: RouteGuardProps) {
  const pathname = usePathname()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const { moduleIds, isLoading: modulesLoading } = useTenantModules()

  // Find route config
  const routeConfig = matchRoutePermission(pathname)

  // Check access
  const accessCheck = useMemo(() => {
    if (!routeConfig) return { hasAccess: true, deniedReason: null }

    // Layer 1: Module check
    if (routeConfig.module && !moduleIds.includes(routeConfig.module)) {
      return { hasAccess: false, deniedReason: 'module' }
    }

    // Layer 2: Permission check
    if (!hasPermission(routeConfig.permission)) {
      return { hasAccess: false, deniedReason: 'permission' }
    }

    return { hasAccess: true, deniedReason: null }
  }, [routeConfig, hasPermission, moduleIds])

  // Show loading state
  if (permissionsLoading || modulesLoading) {
    return <RouteGuardLoading />
  }

  // Show access denied
  if (!accessCheck.hasAccess) {
    return <AccessDenied reason={accessCheck.deniedReason} {...routeConfig} />
  }

  // Render children
  return <>{children}</>
}
```

---

## 5. Route-Permission Mapping

### 5.1 Complete Mapping Table

| Route Pattern | Module | Permission | Description |
|---------------|--------|------------|-------------|
| `/` | dashboard | `dashboard:read` | Main dashboard |
| `/attack-surface` | assets | `assets:read` | Attack surface view |
| `/assets/**` | assets | `assets:read` | Asset inventory |
| `/scans/**` | scans | `scans:read` | Scan management |
| `/findings/**` | findings | `findings:read` | Findings view |
| `/credentials/**` | credentials | `findings:credentials:read` | Credential leaks |
| `/components/**` | components | `assets:components:read` | SBOM components |
| `/threat-intel/**` | threat_intel | `findings:read` | Threat intelligence |
| `/pentest/**` | pentest | `validation:read` | Penetration testing |
| `/remediation/**` | remediation | `findings:remediation:read` | Remediation tasks |
| `/reports/**` | reports | `reports:read` | Report generation |
| `/settings/users/**` | - (core) | `team:members:read` | Team members |
| `/settings/roles/**` | - (core) | `team:roles:read` | Role management |
| `/settings/audit/**` | - (core) | `audit:read` | Audit logs |
| `/settings/billing/**` | - (core) | `settings:billing:read` | Billing settings |
| `/settings/integrations/**` | integrations | `integrations:read` | Integrations |

> **Note**: Routes marked with "- (core)" are core features that don't require module checks. They are available to all tenants and are controlled only by RBAC permissions.

### 5.2 Module Constants

```typescript
// Only licensed features need module checks
// Core features (team, billing, audit) are controlled by RBAC only
export const Module = {
  Dashboard: 'dashboard',
  Assets: 'assets',
  Findings: 'findings',
  Scans: 'scans',
  Reports: 'reports',
  Audit: 'audit',
  Components: 'components',
  Pentest: 'pentest',
  Credentials: 'credentials',
  Remediation: 'remediation',
  ThreatIntel: 'threat_intel',
  Integrations: 'integrations',
}
```

### 5.3 Core Features vs Licensed Features

| Feature Type | Module Check | Permission Check | Examples |
|--------------|:------------:|:----------------:|----------|
| **Core Features** | No | Yes | Team, Billing, Audit |
| **Licensed Features** | Yes | Yes | Credentials, Components, Pentest |

Core features are always available to all tenants and are controlled only by RBAC permissions.
Licensed features require both the module to be in the tenant's plan AND the user to have the permission.

---

## 6. Access Control Layers

### 6.1 Layer Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 1: LICENSING (Tenant)                   │
├─────────────────────────────────────────────────────────────────┤
│  Tenant → Plan → Modules                                         │
│  "What modules does this tenant's subscription include?"         │
│                                                                  │
│  Checked by: useTenantModules() hook                             │
│  Data source: GET /api/v1/me/modules                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 2: RBAC (User)                          │
├─────────────────────────────────────────────────────────────────┤
│  User → Role → Permissions                                       │
│  "What permissions does this user have?"                         │
│                                                                  │
│  Checked by: usePermissions() hook                               │
│  Data source: GET /api/v1/me/permissions/sync                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    RESULT: ACCESS DECISION                       │
├─────────────────────────────────────────────────────────────────┤
│  ALLOW if:                                                       │
│    - Tenant's plan includes required module AND                  │
│    - User has required permission                                │
│                                                                  │
│  DENY otherwise (show appropriate error page)                    │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 No Owner/Admin Bypass

**IMPORTANT**: The frontend does NOT bypass permission checks for Owner/Admin roles.

```typescript
// CORRECT - No bypass, trust API permissions
const can = (permission: string): boolean => {
  return permissions.includes(permission)
}

// WRONG - Don't do this!
const can = (permission: string): boolean => {
  if (tenantRole === 'owner' || tenantRole === 'admin') {
    return true  // ← This bypasses RBAC!
  }
  return permissions.includes(permission)
}
```

**Why no bypass?**

1. **Database is source of truth**: Owner has 215 permissions, Admin has 213 - already seeded in migration
2. **API returns correct permissions**: `/api/v1/me/permissions/sync` returns permissions from database
3. **Custom roles work correctly**: If you assign a role with fewer permissions, user only has those
4. **Frontend and Backend are consistent**: Both use the same RBAC logic

### 6.3 Denial Reasons

| Reason | Icon | Title | Message |
|--------|------|-------|---------|
| `module` | Package | "Feature Not Available" | "This feature is not included in your current plan." |
| `permission` | ShieldX | "Access Denied" | "You don't have permission to access this page." |

---

## 7. User Experience

### 7.1 Access Denied Page

When access is denied, users see a helpful page with:
- Clear icon indicating the reason (license vs permission)
- Descriptive title and message
- Technical details (required module/permission)
- Guidance on how to get access
- Navigation buttons (Go Back, Dashboard)

### 7.2 Loading State

While permissions and modules are being loaded, users see a skeleton loading state to prevent content flash.

### 7.3 Integration with Sidebar

The RouteGuard works in conjunction with sidebar filtering:
- Sidebar hides menu items user can't access
- RouteGuard blocks direct URL access
- Both use the same permission data sources
- Consistent user experience across navigation methods

---

## 8. Testing Guide

### 8.1 Test Cases

| Test Case | Expected Result |
|-----------|-----------------|
| Member navigates to `/settings/audit` | Shows "Access Denied" page |
| Member navigates to `/settings/billing` | Shows "Access Denied" page |
| Viewer navigates to `/settings/tenant` | Shows "Access Denied" page |
| Admin navigates to `/settings/audit` | Page loads normally |
| Owner navigates to `/settings/billing` | Page loads normally |
| User without credentials module visits `/credentials` | Shows "Feature Not Available" |

### 8.2 Manual Testing Steps

1. **Login as Member role user**
2. **Try accessing restricted URL directly**:
   - Type `/settings/audit` in browser
   - Verify "Access Denied" page is shown
   - Verify "audit:read" permission is displayed
3. **Check navigation buttons**:
   - Click "Go Back" - should return to previous page
   - Click "Dashboard" - should go to home page
4. **Login as Admin/Owner**:
   - Navigate to same URLs
   - Verify pages load normally

### 8.3 Verification SQL

```sql
-- Check role permissions in database
SELECT r.slug, COUNT(rp.permission_id) as count
FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id
WHERE r.id IN (
  '00000000-0000-0000-0000-000000000001',  -- Owner
  '00000000-0000-0000-0000-000000000002',  -- Admin
  '00000000-0000-0000-0000-000000000003',  -- Member
  '00000000-0000-0000-0000-000000000004'   -- Viewer
)
GROUP BY r.slug;

-- Check if specific permission exists for a role
SELECT EXISTS (
  SELECT 1 FROM role_permissions
  WHERE role_id = '00000000-0000-0000-0000-000000000003'  -- Member
  AND permission_id = 'audit:read'
) as member_has_audit_read;
```

---

## Related Documents

- [Module Permission Filtering](./module-permission-filtering.md) - Backend module filtering
- [Roles and Permissions Guide](../guides/roles-and-permissions.md) - RBAC overview
- [Permission Real-time Sync](./permission-realtime-sync.md) - Permission synchronization
