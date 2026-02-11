---
layout: default
parent: Architecture
---
# Access Control & Multi-Persona Implementation Plan

**Status:** 🚧 In Progress (85% Complete)
**Created:** 2026-01-21
**Last Updated:** 2026-01-26
**Document Version:** 1.3
**Author:** Security Architecture Team

> **Progress:** Backend Phases 1-5 Complete, Frontend Phases 3 & 6 Complete

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
   - 1.1 [Problem Statement](#11-problem-statement)
   - 1.2 [Solution Overview](#12-solution-overview)
   - 1.3 [Key Benefits](#13-key-benefits)
   - 1.4 [User Personas Supported](#14-user-personas-supported)
   - 1.5 [Two-Layer Role Model](#15-two-layer-role-model)
2. [Current State Analysis](#2-current-state-analysis)
3. [Target Architecture](#3-target-architecture)
4. [Detailed Design](#4-detailed-design)
   - 4.1 [Groups & Membership](#41-groups--membership)
   - 4.2 [Asset Ownership](#42-asset-ownership)
   - 4.3 [Modules & Permissions](#43-modules--permissions)
   - 4.4 [Permission Sets](#44-permission-sets)
   - 4.5 [Permission Resolution](#45-permission-resolution)
   - 4.6 [Auto-Assignment Rules](#46-auto-assignment-rules)
   - 4.7 [External System Sync](#47-external-system-sync)
   - 4.8 [Notifications](#48-notifications)
5. [Database Schema](#5-database-schema)
6. [API Design](#6-api-design)
7. [UI/UX Design](#7-uiux-design)
8. [Implementation Phases](#8-implementation-phases)
9. [Migration Strategy](#9-migration-strategy)
10. [Testing Strategy](#10-testing-strategy)
11. [Security Considerations](#11-security-considerations)
    - 11.1 [Authorization Checks](#111-authorization-checks)
    - 11.2 [Audit Logging](#112-audit-logging)
    - 11.3 [Principle of Least Privilege](#113-principle-of-least-privilege)
    - 11.4 [External Sync Security](#114-external-sync-security)
    - 11.5 [Permission Resolution Security](#115-permission-resolution-security)
    - 11.6 [Performance Considerations](#116-performance-considerations)
12. [Appendix](#12-appendix)
    - 12.1 [Glossary](#121-glossary)
    - 12.2 [Related Documents](#122-related-documents)
    - 12.3 [Implementation Strategy - Best Practice](#123-implementation-strategy---best-practice-recommendation)
    - 12.4 [API Reference](#124-api-reference)

---

## Implementation Status Summary

> **Last Updated**: January 21, 2026

| Phase | Status | Backend | Frontend |
|-------|--------|---------|----------|
| Phase 1: Groups Foundation | ✅ Complete | ✅ Complete | ⬜ Pending |
| Phase 2: Asset Ownership | ✅ Complete | ✅ Complete | ⬜ Pending |
| Phase 3: Modules & Permissions | ✅ Complete | ✅ Complete | ✅ Complete |
| Phase 4: Permission Sets | ✅ Complete | ✅ Complete | ⬜ Pending |
| Phase 5: Group Permissions | ✅ Complete | ✅ Complete | ⬜ Pending |
| Phase 6: UI Permission Enforcement | ✅ Complete | N/A | ✅ Complete |
| Phase 7: Auto-Assignment Rules | ⬜ Not Started | ⬜ Pending | ⬜ Pending |
| Phase 8: Notifications | ⬜ Not Started | ⬜ Pending | ⬜ Pending |
| Phase 9: External Sync | ⬜ Not Started | ⬜ Pending | ⬜ Pending |
| Phase 10: Permission Set Updates | ⬜ Not Started | ⬜ Pending | ⬜ Pending |

### Completed Backend APIs

- **Groups API** (`/api/v1/groups`)
  - `GET /` - List groups
  - `POST /` - Create group
  - `GET /{id}` - Get group
  - `PUT /{id}` - Update group
  - `DELETE /{id}` - Delete group
  - `POST /{id}/members` - Add member
  - `DELETE /{id}/members/{userId}` - Remove member
  - `PUT /{id}/members/{userId}` - Update member role
  - `GET /{id}/members` - List members
  - `GET /me` - List my groups

- **Group Asset Ownership API** (`/api/v1/groups/{id}/assets`)
  - `GET /` - List group's assets
  - `POST /` - Assign asset to group
  - `PUT /{assetId}` - Update asset ownership type
  - `DELETE /{assetId}` - Unassign asset from group

- **My Assets API** (`/api/v1/me/assets`)
  - `GET /` - List current user's accessible assets via group memberships

- **Permission Sets API** (`/api/v1/permission-sets`)
  - `GET /` - List permission sets
  - `POST /` - Create permission set
  - `GET /system` - List system permission sets
  - `GET /{id}` - Get permission set with items
  - `PUT /{id}` - Update permission set
  - `DELETE /{id}` - Delete permission set
  - `POST /{id}/permissions` - Add permission item
  - `DELETE /{id}/permissions/{permissionId}` - Remove permission item

- **Group Permission Sets API** (`/api/v1/groups/{id}/permission-sets`)
  - `GET /` - List group's assigned permission sets
  - `POST /` - Assign permission set to group
  - `DELETE /{permissionSetId}` - Unassign permission set from group

- **Effective Permissions API** (`/api/v1/me/permissions`)
  - `GET /` - Get current user's effective permissions (with group count)

### Completed Frontend Components

- **Permission Hook** (`usePermissions`)
  - `usePermissions()` - Main hook with hasPermission, hasAnyPermission, hasAllPermissions
  - `useHasPermission(permission)` - Selector for single permission check
  - `useHasAnyPermission(permissions)` - Selector for any permission check
  - `useHasAllPermissions(permissions)` - Selector for all permissions check
  - `useIsTenantAdmin()` - Check if user is tenant admin
  - `useTenantRole()` - Get user's tenant role

- **Permission Gate Components**
  - `<PermissionGate permission="...">` - Single permission check
  - `<PermissionGate permissions={[...]} requireAll>` - Multiple permission check
  - `<ResourceGate resource="assets" action="write">` - Resource action check
  - `<AdminGate>` - Tenant admin only content

### Phase 6: UI Permission Enforcement (Complete)

**Completed:**
- Updated `CommandMenu` to use `useFilteredSidebarData` for permission-based filtering
- Added new permission constants for access control features:
  - Groups: `groups:read`, `groups:write`, `groups:delete`, `groups:members`, `groups:permissions`
  - Permission Sets: `permission-sets:read`, `permission-sets:write`, `permission-sets:delete`
  - Assignment Rules: `assignment-rules:read`, `assignment-rules:write`, `assignment-rules:delete`
  - Agents, SCM Connections, Sources, Commands, Pipelines permissions
- Updated `RolePermissions` mapping for Owner, Admin, Member, Viewer roles
- Added `canEdit` and `canDelete` props to `AssetDetailSheet` component
- Applied permission checks to all asset pages:
  - Domains, Websites, Hosts, Cloud, Databases, Services, Mobile
  - "Add" buttons wrapped with `<Can permission={Permission.AssetsWrite}>`
  - Edit dropdown items wrapped with write permission check
  - Delete dropdown items (single and bulk) wrapped with delete permission check
  - AssetDetailSheet receives `canEdit` and `canDelete` props

**Pattern Applied:**
```tsx
// 1. Import permissions
import { Can, Permission, usePermissions } from "@/lib/permissions";

// 2. Get permission checks in component
const { can } = usePermissions();
const canWriteAssets = can(Permission.AssetsWrite);
const canDeleteAssets = can(Permission.AssetsDelete);

// 3. Wrap Add buttons
<Can permission={Permission.AssetsWrite}>
  <Button>Add Asset</Button>
</Can>

// 4. Wrap Edit/Delete in dropdowns
<Can permission={Permission.AssetsWrite}>
  <DropdownMenuItem>Edit</DropdownMenuItem>
</Can>
<Can permission={Permission.AssetsDelete}>
  <DropdownMenuItem>Delete</DropdownMenuItem>
</Can>

// 5. Pass to AssetDetailSheet
<AssetDetailSheet
  canEdit={canWriteAssets}
  canDelete={canDeleteAssets}
/>
```

**Files Updated:**
- `ui/src/lib/permissions/constants.ts` - New permission constants
- `ui/src/components/command-menu.tsx` - Permission-filtered navigation
- `ui/src/features/assets/components/asset-detail-sheet.tsx` - canEdit/canDelete props
- `ui/src/app/(dashboard)/(discovery)/assets/domains/page.tsx`
- `ui/src/app/(dashboard)/(discovery)/assets/websites/page.tsx`
- `ui/src/app/(dashboard)/(discovery)/assets/hosts/page.tsx`
- `ui/src/app/(dashboard)/(discovery)/assets/cloud/page.tsx`
- `ui/src/app/(dashboard)/(discovery)/assets/databases/page.tsx`
- `ui/src/app/(dashboard)/(discovery)/assets/services/page.tsx`
- `ui/src/app/(dashboard)/(discovery)/assets/mobile/page.tsx`

### Seeded Data

- **9 System Permission Sets**: Full Admin, Security Admin, AppSec Engineer, Pentest Operator, Cloud Security Engineer, Security Analyst, SOC Analyst, Asset Owner, Developer, Read Only
- **Recommended Teams Function**: `seed_recommended_teams(tenant_id)` creates 15 recommended security and asset owner teams

---

## 1. Executive Summary

### 1.1 Problem Statement

The current OpenCTEM platform has a simple RBAC model (Owner, Admin, Member, Viewer) that doesn't support:

- **Multiple user personas** beyond security team (developers, asset owners, managers)
- **Scoped access** to specific assets or findings
- **Security sub-teams** with different feature access (Pentest, SOC, AppSec, Cloud Security)
- **Scalable management** for organizations with hundreds of users

### 1.2 Solution Overview

Implement a **Group-based Access Control** model with:

1. **Groups** for organizing users and asset ownership
2. **Modules & Permissions** for granular feature access
3. **Permission Sets** as reusable permission templates
4. **Auto-assignment Rules** for automatic routing of findings
5. **External Sync** with GitHub/GitLab/Azure AD

### 1.3 Key Benefits

| Benefit | Description |
|---------|-------------|
| **Scalability** | Manage thousands of users via groups, not individuals |
| **Flexibility** | Tenants can customize permission sets for their org structure |
| **Automation** | Auto-assign findings to appropriate teams |
| **Integration** | Sync with existing identity providers and code ownership |
| **Security** | Principle of least privilege, audit trail |

### 1.4 User Personas Supported

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER PERSONAS                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SECURITY TEAM                        NON-SECURITY USERS                │
│  ─────────────                        ──────────────────                │
│                                                                         │
│  ┌─────────────────┐                  ┌─────────────────┐              │
│  │ Security Admin  │                  │   Developers    │              │
│  │ Full platform   │                  │ View & fix their│              │
│  │ access          │                  │ code findings   │              │
│  └─────────────────┘                  └─────────────────┘              │
│                                                                         │
│  ┌─────────────────┐                  ┌─────────────────┐              │
│  │  Pentest Team   │                  │  Asset Owners   │              │
│  │ Pentest module  │                  │ View assets they│              │
│  │ + findings      │                  │ manage          │              │
│  └─────────────────┘                  └─────────────────┘              │
│                                                                         │
│  ┌─────────────────┐                  ┌─────────────────┐              │
│  │   SOC Team      │                  │    Managers     │              │
│  │ Monitoring,     │                  │ Reports &       │              │
│  │ alerts, incidents│                 │ dashboards      │              │
│  └─────────────────┘                  └─────────────────┘              │
│                                                                         │
│  ┌─────────────────┐                                                   │
│  │  AppSec Team    │                                                   │
│  │ Code scanning,  │                                                   │
│  │ SAST/SCA        │                                                   │
│  └─────────────────┘                                                   │
│                                                                         │
│  ┌─────────────────┐                                                   │
│  │ Cloud Security  │                                                   │
│  │ Cloud assets,   │                                                   │
│  │ misconfigs      │                                                   │
│  └─────────────────┘                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.5 Two-Layer Role Model

The access control system uses **two separate layers** for role management:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TWO-LAYER ROLE MODEL                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  LAYER 1: TENANT MEMBERSHIP (tenant_members.role)                       │
│  ─────────────────────────────────────────────────                      │
│  Purpose: WHO CAN ADMINISTER THE TENANT?                                │
│                                                                         │
│  ┌──────────┬───────────────────────────────────────────────────────┐  │
│  │ Role     │ Capabilities                                          │  │
│  ├──────────┼───────────────────────────────────────────────────────┤  │
│  │ owner    │ Full tenant control, billing, delete tenant           │  │
│  │ admin    │ Manage members, settings, integrations                │  │
│  │ member   │ Basic tenant access (features controlled by Layer 2)  │  │
│  │ viewer   │ Read-only tenant access                               │  │
│  └──────────┴───────────────────────────────────────────────────────┘  │
│                                                                         │
│  LAYER 2: GROUPS + PERMISSION SETS                                      │
│  ─────────────────────────────────                                      │
│  Purpose: WHAT FEATURES CAN USER ACCESS?                                │
│                                                                         │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐  │
│  │     User        │────▶│     Groups      │────▶│ Permission Sets │  │
│  │                 │     │                 │     │                 │  │
│  │ tenant_member   │     │ - API Team      │     │ - Developer     │  │
│  │ role: "member"  │     │ - Security Team │     │ - Full Admin    │  │
│  │                 │     │ - Pentest Team  │     │ - SOC Analyst   │  │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘  │
│                                                                         │
│  Key Insight: Most users are "member" at tenant level.                 │
│               Their actual permissions come from Groups.                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 1.5.1 Role Mapping by User Type

| User Type | tenant_members.role | Group Type | Group Role | Permission Set | Asset Ownership |
|-----------|---------------------|------------|------------|----------------|-----------------|
| **Tenant Owner** | `owner` | Security Team | owner | Full Admin | All (implicit) |
| **Security Admin** | `admin` | Security Team | lead | Full Admin | All (implicit) |
| **Security Analyst** | `member` | Security Team | member | Security Analyst | All (implicit) |
| **Pentest Lead** | `member` | Pentest Team | lead | Pentest Operator | Scoped |
| **Pentester** | `member` | Pentest Team | member | Pentest Operator | Scoped |
| **SOC Lead** | `member` | SOC Team | lead | SOC Analyst | All (implicit) |
| **SOC Analyst** | `member` | SOC Team | member | SOC Analyst | All (implicit) |
| **Service Owner** | `member` | Service Team | **lead** | Asset Owner | **Primary** |
| **Developer** | `member` | Dev Team | member | Developer | Secondary |
| **Manager** | `member` | Management | member | Read Only | Scoped |
| **External Contractor** | `member` | External | member | Scoped Custom | Scoped (tagged) |

#### 1.5.2 Developer vs Service Owner

```
┌─────────────────────────────────────────────────────────────────────────┐
│                 DEVELOPER vs SERVICE OWNER                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                      DEVELOPER                    SERVICE OWNER         │
│                      ─────────                    ─────────────         │
│                                                                         │
│  tenant_members.role    member                      member              │
│  group                  API Team                    API Team            │
│  group_members.role     member                      lead / owner        │
│  permission_set         Developer                   Asset Owner         │
│  asset_ownership        secondary                   PRIMARY             │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ CAPABILITIES COMPARISON                                          │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ Action                              │ Developer │ Service Owner  │  │
│  ├─────────────────────────────────────┼───────────┼────────────────┤  │
│  │ View findings on owned assets       │     ✓     │       ✓        │  │
│  │ Comment on findings                 │     ✓     │       ✓        │  │
│  │ Update finding status               │     ✓     │       ✓        │  │
│  │ Assign findings to team members     │     ✗     │       ✓        │  │
│  │ Receive all notifications           │     ✗     │       ✓        │  │
│  │ Manage group members                │     ✗     │       ✓        │  │
│  │ Set asset ownership                 │     ✗     │       ✓        │  │
│  │ View team's SLA compliance          │     ✗     │       ✓        │  │
│  │ Access other teams' findings        │     ✗     │       ✗        │  │
│  │ Run security scans                  │     ✗     │       ✗        │  │
│  │ Manage agents                       │     ✗     │       ✗        │  │
│  └─────────────────────────────────────┴───────────┴────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 1.5.3 Example: Developer Onboarding Flow

```
Developer "john@company.com" joins the platform
│
├── Step 1: Tenant Membership
│   INSERT INTO tenant_members (user_id, tenant_id, role)
│   VALUES ('john-id', 'acme-tenant', 'member');
│   → John can now access the Acme tenant
│   → But has no feature permissions yet (controlled by groups)
│
├── Step 2: Group Membership
│   INSERT INTO group_members (group_id, user_id, role)
│   VALUES ('api-team-id', 'john-id', 'member');
│   → John is now part of API Team
│   → API Team has permission set "Developer"
│   → API Team owns asset "backend-api" (primary)
│
├── Step 3: Effective Access
│   John can now:
│   ✓ View dashboard (from Developer permission set)
│   ✓ View findings on "backend-api" (owned by his group)
│   ✓ Comment on findings
│   ✓ Update finding status (mark as fixed, etc.)
│
│   John cannot:
│   ✗ View findings on "frontend-web" (owned by Frontend Team)
│   ✗ Run scans
│   ✗ Manage agents
│   ✗ Access pentest module
│
└── Result: Least-privilege access automatically applied
```

#### 1.5.4 Example: Service Owner Onboarding Flow

```
Service Owner "sarah@company.com" takes ownership of API service
│
├── Step 1: Tenant Membership (same as developer)
│   INSERT INTO tenant_members (user_id, tenant_id, role)
│   VALUES ('sarah-id', 'acme-tenant', 'member');
│
├── Step 2: Group Membership (as lead)
│   INSERT INTO group_members (group_id, user_id, role)
│   VALUES ('api-team-id', 'sarah-id', 'lead');  -- Note: 'lead' role
│   → Sarah is group lead of API Team
│   → Can manage team members
│   → Receives escalation notifications
│
├── Step 3: Assign Permission Set
│   API Team has permission set "Asset Owner" (more than Developer)
│   OR Sarah's group has custom permission:
│   INSERT INTO group_permissions (group_id, permission_id, effect)
│   VALUES ('api-team-id', 'findings.assign', 'allow');
│
├── Step 4: Asset Ownership
│   INSERT INTO asset_owners (asset_id, group_id, ownership_type)
│   VALUES ('backend-api-id', 'api-team-id', 'primary');
│   → API Team is PRIMARY owner of backend-api
│   → Sarah (as lead) has full responsibility
│
└── Result: Sarah owns the service, can manage findings and team
```

#### 1.5.5 Why tenant_members.role = "member" for Most Users?

| Reason | Explanation |
|--------|-------------|
| **Separation of concerns** | Tenant administration ≠ Feature access |
| **Scalability** | 500 developers don't need admin rights |
| **Security** | Fewer admins = smaller attack surface |
| **Flexibility** | Feature access managed via groups, not hardcoded |
| **Audit clarity** | Clear who can change tenant settings vs who can use features |

**Rule of thumb:**
- `owner` / `admin` → Only for people who need to manage the tenant itself
- `member` → Everyone else (permissions come from groups)
- `viewer` → External stakeholders who only need to see reports

---

## 2. Current State Analysis

### 2.1 Existing RBAC Model

```sql
-- Current: Simple role-based
tenant_members (
    user_id UUID,
    tenant_id UUID,
    role VARCHAR(20)  -- 'owner', 'admin', 'member', 'viewer'
)
```

### 2.2 Limitations

| Limitation | Impact |
|------------|--------|
| Fixed roles | Cannot create custom roles for different teams |
| No asset scoping | Everyone with access sees all assets |
| No group management | Must manage users individually |
| No feature toggles | Cannot restrict modules per role |
| No auto-assignment | Manual assignment of findings |

### 2.3 What We Keep

- Tenant isolation (multi-tenancy)
- Basic role hierarchy concept
- Existing audit logging infrastructure
- JWT-based authentication

---

## 3. Target Architecture

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ACCESS CONTROL ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        MODULES                                   │   │
│  │  Dashboard │ Assets │ Findings │ Scans │ Agents │ Pentest │ ... │   │
│  └──────────────────────────────┬──────────────────────────────────┘   │
│                                 │                                       │
│                                 ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      PERMISSIONS                                 │   │
│  │  assets.view │ assets.create │ findings.triage │ scans.execute  │   │
│  └──────────────────────────────┬──────────────────────────────────┘   │
│                                 │                                       │
│                                 ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                   PERMISSION SETS                                │   │
│  │                                                                  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │   │
│  │  │   System    │  │   System    │  │   Tenant    │              │   │
│  │  │  Templates  │  │  Templates  │  │   Custom    │              │   │
│  │  │ ─────────── │  │ ─────────── │  │ ─────────── │              │   │
│  │  │ Full Admin  │  │ SOC Analyst │  │ APAC SOC    │              │   │
│  │  │ Developer   │  │ Pentester   │  │ Lead        │              │   │
│  │  └─────────────┘  └─────────────┘  └──────┬──────┘              │   │
│  │                                           │                      │   │
│  │                              Extended/Cloned from System         │   │
│  └──────────────────────────────┬──────────────────────────────────┘   │
│                                 │                                       │
│                                 ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        GROUPS                                    │   │
│  │                                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │  Group Type: security_team                               │    │   │
│  │  │  Purpose: Feature access control                         │    │   │
│  │  │  ───────────────────────────────────────────────────     │    │   │
│  │  │  Pentest Team │ SOC Team │ AppSec Team │ Cloud Team      │    │   │
│  │  └─────────────────────────────────────────────────────────┘    │   │
│  │                                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │  Group Type: team                                        │    │   │
│  │  │  Purpose: Asset ownership & finding visibility           │    │   │
│  │  │  ───────────────────────────────────────────────────     │    │   │
│  │  │  API Team │ Frontend Team │ Infra Team │ Mobile Team     │    │   │
│  │  └─────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────┬──────────────────────────────────┘   │
│                                 │                                       │
│                                 ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        USERS                                     │   │
│  │  User belongs to multiple groups → Combined access               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Access Decision Flow

```
User Request → Check Permission
         │
         ▼
┌─────────────────────────────────────────┐
│ 1. Get user's groups                     │
│ 2. For each group:                       │
│    a. Get permission sets                │
│    b. Resolve effective permissions      │
│    c. Check custom allow/deny            │
│ 3. Merge all permissions                 │
│ 4. Apply scope restrictions              │
│ 5. Return access decision                │
└─────────────────────────────────────────┘
         │
         ▼
    Allow / Deny
```

---

## 4. Detailed Design

### 4.1 Groups & Membership

#### 4.1.1 Group Types

| Type | Purpose | Example |
|------|---------|---------|
| `security_team` | Feature access for security sub-teams | Pentest Team, SOC Team |
| `team` | Asset ownership for dev/owner teams | API Team, Frontend Team |
| `department` | Organizational structure | Engineering, Operations |
| `project` | Project-based access | Project Alpha, Project Beta |
| `external` | External contractors/vendors | Pentest Firm XYZ |

#### 4.1.2 Group Properties

```typescript
interface Group {
  id: string;
  tenant_id: string;
  name: string;                    // "API Team"
  slug: string;                    // "api-team"
  description?: string;
  group_type: GroupType;           // 'security_team' | 'team' | 'department' | 'project' | 'external'

  // External sync
  external_id?: string;            // GitHub team ID, AD group ID
  external_source?: string;        // 'github' | 'gitlab' | 'azure_ad' | 'okta'

  // Settings
  settings: {
    allow_self_join: boolean;      // Members can join without approval
    require_approval: boolean;     // Join requests need admin approval
    max_members?: number;          // Member limit
  };

  // Notification settings
  notification_config: {
    slack_channel?: string;
    email_list?: string;
    notify_on_new_critical: boolean;
    notify_on_new_high: boolean;
    notify_on_sla_warning: boolean;
    weekly_digest: boolean;
  };

  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}
```

#### 4.1.3 Membership Roles

| Role | Description |
|------|-------------|
| `owner` | Can manage group settings, members |
| `lead` | Can add/remove members |
| `member` | Standard member |

### 4.2 Asset Ownership

#### 4.2.1 Ownership Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      ASSET OWNERSHIP MODEL                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Asset: "backend-api" (Repository)                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  Primary Owner: API Team                                         │   │
│  │  ─────────────────────                                          │   │
│  │  • Full access to all findings                                   │   │
│  │  • Receives all notifications                                    │   │
│  │  • Can assign findings to members                                │   │
│  │                                                                  │   │
│  │  Secondary Owners: Security Team                                 │   │
│  │  ────────────────────────────                                   │   │
│  │  • Full access (via security role)                               │   │
│  │  • Oversight and triage                                          │   │
│  │                                                                  │   │
│  │  Stakeholders: Platform Team                                     │   │
│  │  ──────────────────────────                                     │   │
│  │  • View access only                                              │   │
│  │  • Informed of critical issues                                   │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 4.2.2 Ownership Types

| Type | Access Level | Notifications |
|------|-------------|---------------|
| `primary` | Full access, can manage | All |
| `secondary` | Full access | Critical only |
| `stakeholder` | View only | Critical only |
| `informed` | No access | Summary only |

#### 4.2.3 Inheritance

- Finding inherits owners from its Asset
- User in owner group → Can see finding
- No explicit finding assignment needed (automatic via ownership)

### 4.3 Modules & Permissions

#### 4.3.1 Module List

| Module ID | Name | Description |
|-----------|------|-------------|
| `dashboard` | Dashboard | Overview and metrics |
| `assets` | Assets | Asset management |
| `findings` | Findings | Vulnerability findings |
| `scans` | Scans | Scan management |
| `agents` | Agents | Agent management |
| `pentest` | Pentest | Penetration testing |
| `monitoring` | Monitoring | Real-time monitoring |
| `alerts` | Alerts | Security alerts |
| `incidents` | Incidents | Incident management |
| `compliance` | Compliance | Compliance frameworks |
| `threat_intel` | Threat Intel | Threat intelligence |
| `reports` | Reports | Reporting |
| `integrations` | Integrations | External integrations |
| `settings` | Settings | System settings |
| `groups` | Groups | Group management |
| `audit` | Audit | Audit logs |

#### 4.3.2 Permission Format

```
{module}.{action}[.{sub-resource}]

Examples:
- assets.view
- assets.create
- assets.delete
- findings.view
- findings.triage
- findings.assign
- scans.execute
- pentest.campaigns.create
```

#### 4.3.3 Standard Actions

| Action | Description |
|--------|-------------|
| `view` | Read access |
| `create` | Create new resources |
| `update` | Modify existing resources |
| `delete` | Remove resources |
| `execute` | Trigger actions (scans, exports) |
| `assign` | Assign to users/groups |
| `manage` | Administrative actions |

#### 4.3.4 Complete Permission Matrix

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PERMISSION MATRIX BY MODULE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  MODULE: dashboard                                                      │
│  ├── dashboard.view           View dashboard                            │
│  └── dashboard.customize      Customize widgets                         │
│                                                                         │
│  MODULE: assets                                                         │
│  ├── assets.view              View all assets                           │
│  ├── assets.create            Create new assets                         │
│  ├── assets.update            Update asset details                      │
│  ├── assets.delete            Delete assets                             │
│  ├── assets.assign            Assign ownership                          │
│  └── assets.import            Bulk import assets                        │
│                                                                         │
│  MODULE: findings                                                       │
│  ├── findings.view            View findings                             │
│  ├── findings.create          Create manual findings                    │
│  ├── findings.update          Update finding details                    │
│  ├── findings.delete          Delete findings                           │
│  ├── findings.triage          Triage and prioritize                     │
│  ├── findings.assign          Assign to users/groups                    │
│  ├── findings.comment         Add comments                              │
│  ├── findings.status          Change status                             │
│  ├── findings.export          Export findings                           │
│  └── findings.bulk            Bulk operations                           │
│                                                                         │
│  MODULE: scans                                                          │
│  ├── scans.view               View scan configs                         │
│  ├── scans.create             Create scan configs                       │
│  ├── scans.update             Update scan configs                       │
│  ├── scans.delete             Delete scan configs                       │
│  ├── scans.execute            Trigger scans                             │
│  └── scans.schedule           Schedule recurring scans                  │
│                                                                         │
│  MODULE: agents                                                         │
│  ├── agents.view              View agents                               │
│  ├── agents.create            Create agents                             │
│  ├── agents.update            Update agent settings                     │
│  ├── agents.delete            Delete agents                             │
│  ├── agents.manage            Activate/deactivate/revoke                │
│  └── agents.keys              Regenerate API keys                       │
│                                                                         │
│  MODULE: pentest                                                        │
│  ├── pentest.campaigns.view   View campaigns                            │
│  ├── pentest.campaigns.create Create campaigns                          │
│  ├── pentest.campaigns.manage Manage campaign lifecycle                 │
│  ├── pentest.findings.create  Create pentest findings                   │
│  └── pentest.reports          Generate pentest reports                  │
│                                                                         │
│  MODULE: monitoring                                                     │
│  ├── monitoring.view          View monitoring dashboards                │
│  └── monitoring.configure     Configure monitoring rules                │
│                                                                         │
│  MODULE: alerts                                                         │
│  ├── alerts.view              View alerts                               │
│  ├── alerts.acknowledge       Acknowledge alerts                        │
│  ├── alerts.configure         Configure alert rules                     │
│  └── alerts.mute              Mute alerts                               │
│                                                                         │
│  MODULE: incidents                                                      │
│  ├── incidents.view           View incidents                            │
│  ├── incidents.create         Create incidents                          │
│  ├── incidents.manage         Manage incident lifecycle                 │
│  └── incidents.escalate       Escalate incidents                        │
│                                                                         │
│  MODULE: compliance                                                     │
│  ├── compliance.view          View compliance status                    │
│  └── compliance.manage        Manage frameworks                         │
│                                                                         │
│  MODULE: threat_intel                                                   │
│  ├── threat_intel.view        View threat intel                         │
│  └── threat_intel.manage      Manage sources                            │
│                                                                         │
│  MODULE: reports                                                        │
│  ├── reports.view             View reports                              │
│  ├── reports.create           Create custom reports                     │
│  ├── reports.export           Export reports                            │
│  └── reports.schedule         Schedule automated reports                │
│                                                                         │
│  MODULE: integrations                                                   │
│  ├── integrations.view        View integrations                         │
│  ├── integrations.create      Create integrations                       │
│  ├── integrations.manage      Manage integrations                       │
│  └── integrations.test        Test integrations                         │
│                                                                         │
│  MODULE: settings                                                       │
│  ├── settings.view            View settings                             │
│  └── settings.update          Update settings                           │
│                                                                         │
│  MODULE: groups                                                         │
│  ├── groups.view              View groups                               │
│  ├── groups.create            Create groups                             │
│  ├── groups.manage            Manage group settings                     │
│  └── groups.members           Manage members                            │
│                                                                         │
│  MODULE: audit                                                          │
│  ├── audit.view               View audit logs                           │
│  └── audit.export             Export audit logs                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Permission Sets

#### 4.4.1 Set Types

| Type | Tenant ID | Editable | Description |
|------|-----------|----------|-------------|
| `system` | NULL | No | Platform-defined templates |
| `extended` | Required | Yes | Inherits from parent, auto-sync |
| `cloned` | Required | Yes | Independent copy |
| `custom` | Required | Yes | Built from scratch |

#### 4.4.2 System Templates

```yaml
# Full Admin - Complete access
full_admin:
  description: "Full access to all features"
  permissions: ["*"]  # All permissions

# Security Analyst - Standard security access
security_analyst:
  description: "Standard security analyst access"
  permissions:
    - dashboard.view
    - assets.view
    - assets.create
    - findings.*
    - scans.*
    - agents.view
    - reports.*
    - groups.view

# Pentest Operator - Penetration testing
pentest_operator:
  description: "Penetration testing team access"
  permissions:
    - dashboard.view
    - assets.view
    - findings.view
    - findings.create
    - findings.update
    - findings.triage
    - findings.comment
    - scans.view
    - scans.execute
    - pentest.*
    - reports.view
    - reports.create

# SOC Analyst - Security Operations
soc_analyst:
  description: "Security Operations Center access"
  permissions:
    - dashboard.view
    - assets.view
    - findings.view
    - findings.comment
    - monitoring.*
    - alerts.*
    - incidents.*
    - reports.view

# AppSec Engineer - Application Security
appsec_engineer:
  description: "Application security team access"
  permissions:
    - dashboard.view
    - assets.view
    - assets.create
    - findings.*
    - scans.*
    - agents.view
    - reports.*
    - groups.view

# Cloud Security - Cloud focused
cloud_security:
  description: "Cloud security team access"
  permissions:
    - dashboard.view
    - assets.view
    - assets.create
    - findings.view
    - findings.triage
    - findings.assign
    - compliance.*
    - reports.*

# Developer - Limited access to own findings
developer:
  description: "Developer access to their assigned findings"
  permissions:
    - dashboard.view
    - findings.view      # Scoped to owned assets
    - findings.comment
    - findings.status    # Can update status

# Asset Owner - Asset-scoped access
asset_owner:
  description: "Asset owner access"
  permissions:
    - dashboard.view
    - assets.view        # Scoped to owned assets
    - findings.view      # Scoped to owned assets
    - findings.comment
    - reports.view       # Scoped reports

# Read Only - View everything
read_only:
  description: "Read-only access to all data"
  permissions:
    - dashboard.view
    - assets.view
    - findings.view
    - scans.view
    - agents.view
    - reports.view
    - compliance.view
    - audit.view
```

#### 4.4.3 Extended vs Cloned

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    EXTENDED vs CLONED                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  EXTENDED (Auto-sync)                                                   │
│  ────────────────────                                                  │
│                                                                         │
│  System "SOC Analyst"              Tenant "APAC SOC Lead"              │
│  ┌─────────────────────┐           ┌─────────────────────┐             │
│  │ alerts.view         │           │ EXTENDS: SOC Analyst│             │
│  │ alerts.acknowledge  │ ◄─────────│ ───────────────────│             │
│  │ incidents.*         │  Always   │ + incidents.escalate│ ◄─ Added   │
│  │ monitoring.*        │  linked   │ + reports.create   │ ◄─ Added   │
│  │                     │           │ - alerts.mute      │ ◄─ Removed │
│  │ + NEW PERMISSION    │ ─────────▶│ + NEW PERMISSION   │ ◄─ Auto!   │
│  └─────────────────────┘           └─────────────────────┘             │
│                                                                         │
│  Effective = Parent + Additions - Removals                              │
│  Auto-updates when parent changes                                       │
│                                                                         │
│  ───────────────────────────────────────────────────────────────────── │
│                                                                         │
│  CLONED (Independent)                                                   │
│  ────────────────────                                                  │
│                                                                         │
│  System "SOC Analyst"              Tenant "External SOC"               │
│  ┌─────────────────────┐           ┌─────────────────────┐             │
│  │ alerts.view         │  One-time │ alerts.view         │             │
│  │ alerts.acknowledge  │ ─────────▶│ alerts.acknowledge  │             │
│  │ incidents.*         │   copy    │ incidents.view      │ ◄─ Modified│
│  │ monitoring.*        │           │ (incidents.create   │             │
│  │                     │           │  removed)           │             │
│  │ + NEW PERMISSION    │     ✗     │                     │ No auto    │
│  └─────────────────────┘  ──────▶  └─────────────────────┘             │
│                                     ↑                                   │
│                                     Notification sent, manual review    │
│                                                                         │
│  Effective = Snapshot at clone time + Manual changes                    │
│  Notified when parent changes, but no auto-update                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 4.4.4 When to Use Which

| Use Case | Recommended Type |
|----------|-----------------|
| Internal security team that wants latest features | Extended |
| Team that trusts platform updates | Extended |
| External contractors with strict scope | Cloned |
| Compliance requires explicit permission lists | Cloned |
| Temporary access with fixed permissions | Cloned |
| Custom permissions from scratch | Custom |

### 4.5 Permission Resolution

#### 4.5.1 Resolution Algorithm

```
User requests action requiring permission P on resource R

1. CHECK USER DIRECT PERMISSIONS
   ├── If user has DENY for P → DENIED
   ├── If user has ALLOW for P (and scope matches R) → ALLOWED
   └── Continue to groups

2. GET USER'S GROUPS
   └── groups = GetUserGroups(user_id, tenant_id)

3. FOR EACH GROUP (check in parallel)
   │
   ├── CHECK GROUP DIRECT PERMISSIONS
   │   ├── If group has DENY for P → Mark as DENIED
   │   └── If group has ALLOW for P (and scope matches R) → Mark as ALLOWED
   │
   └── CHECK GROUP PERMISSION SETS
       └── For each permission set assigned to group:
           └── If P in set's effective permissions → Mark as ALLOWED

4. MERGE RESULTS
   ├── Any DENY → DENIED (deny takes precedence)
   ├── Any ALLOW → ALLOWED
   └── No matches → DENIED (default deny)

5. APPLY SCOPE
   └── If allowed but scoped, verify R is in scope
```

#### 4.5.2 Scope Types

| Scope Type | Description | Example |
|------------|-------------|---------|
| `all` | No restrictions | Full access |
| `owned_assets` | Only assets owned by user's groups | Developer sees only their team's repos |
| `asset_type` | Only specific asset types | Cloud team sees only cloud assets |
| `asset_tags` | Only assets with specific tags | Pentest scope: tag "pentest-2024" |
| `severity` | Only findings of certain severity | Junior analyst: medium and below |

#### 4.5.3 Scope Examples

```typescript
// Developer group: scoped to owned assets
{
  group_id: "api-team",
  permission_id: "findings.view",
  effect: "allow",
  scope_type: "owned_assets"
}

// External pentester: scoped to tagged assets
{
  group_id: "external-pentest",
  permission_id: "assets.view",
  effect: "allow",
  scope_type: "asset_tags",
  scope_value: { tags: ["pentest-scope-2024"] }
}

// Junior analyst: only view medium/low severity
{
  group_id: "junior-analysts",
  permission_id: "findings.view",
  effect: "allow",
  scope_type: "severity",
  scope_value: { severities: ["medium", "low", "info"] }
}
```

### 4.6 Auto-Assignment Rules

#### 4.6.1 Rule Structure

```typescript
interface AssignmentRule {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  priority: number;           // Higher = checked first
  is_active: boolean;

  // Matching conditions
  conditions: {
    // Asset conditions
    asset_type?: string[];          // ['repository', 'domain']
    asset_tags?: string[];          // ['team:api', 'env:prod']
    asset_name_pattern?: string;    // 'api-*'

    // Finding conditions
    finding_source?: string[];      // ['semgrep', 'trivy']
    finding_severity?: string[];    // ['critical', 'high']
    finding_type?: string[];        // ['sast', 'sca']

    // Path conditions (for code findings)
    file_path_pattern?: string;     // 'src/api/**'
  };

  // Target
  target_group_id: string;

  // Options
  options: {
    notify_group: boolean;          // Send notification on assignment
    set_finding_priority?: string;  // Override priority based on rule
  };

  created_at: string;
  updated_at: string;
}
```

#### 4.6.2 Rule Examples

```yaml
# Rule 1: API code findings go to API Team
- name: "API Code Findings"
  priority: 100
  conditions:
    asset_type: ["repository"]
    file_path_pattern: "src/api/**"
  target_group: "api-team"
  options:
    notify_group: true

# Rule 2: All critical findings to Security Lead
- name: "Critical Findings Escalation"
  priority: 200  # Higher priority, checked first
  conditions:
    finding_severity: ["critical"]
  target_group: "security-leads"
  options:
    notify_group: true

# Rule 3: Cloud misconfigs to Cloud Team
- name: "Cloud Misconfigurations"
  priority: 50
  conditions:
    asset_tags: ["type:cloud"]
    finding_type: ["misconfiguration"]
  target_group: "cloud-security"

# Rule 4: Default catch-all
- name: "Default Security Team"
  priority: 0  # Lowest priority
  conditions: {}  # Match all
  target_group: "security-team"
```

#### 4.6.3 Rule Evaluation

```
New Finding Created
       │
       ▼
┌─────────────────────────────────────────┐
│ Get all active rules, sorted by priority│
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ For each rule (high to low priority):   │
│   If finding matches conditions:        │
│     - Assign to target group            │
│     - Send notification if configured   │
│     - Stop processing (first match wins)│
└────────────────┬────────────────────────┘
                 │
                 ▼
         Finding Assigned
```

### 4.7 External System Sync

#### 4.7.1 Supported Systems

| System | Sync Type | What's Synced |
|--------|-----------|---------------|
| GitHub | Teams + CODEOWNERS | Members, repo ownership |
| GitLab | Groups | Members, project ownership |
| Azure AD | Groups | Members |
| Okta | Groups | Members |

#### 4.7.2 GitHub Sync

```typescript
interface GitHubSyncConfig {
  enabled: boolean;
  organization: string;

  // Team mapping
  team_mappings: {
    github_team: string;      // "backend-developers"
   .openctem_group: string;    // "api-team"
    sync_members: boolean;    // Sync team members
    sync_repos: boolean;      // Sync repo access as ownership
  }[];

  // CODEOWNERS sync
  codeowners_sync: {
    enabled: boolean;
    // Parse CODEOWNERS and create assignment rules
    // /src/api/**  @my-org/api-team
    // → Rule: path "src/api/**" → api-team
  };

  // Sync settings
  sync_interval: string;      // "1h", "6h", "24h"
  remove_stale_members: boolean;
}
```

#### 4.7.3 Sync Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    GITHUB SYNC FLOW                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. SCHEDULED SYNC (or webhook trigger)                                 │
│     │                                                                   │
│     ▼                                                                   │
│  2. FETCH GITHUB DATA                                                   │
│     ├── List teams in organization                                      │
│     ├── For each mapped team, get members                              │
│     └── Parse CODEOWNERS files from repos                              │
│     │                                                                   │
│     ▼                                                                   │
│  3. RECONCILE GROUPS                                                    │
│     ├── Create groups that don't exist                                 │
│     ├── Update group metadata (external_id, etc.)                      │
│     └── Mark groups for deletion if team removed                       │
│     │                                                                   │
│     ▼                                                                   │
│  4. RECONCILE MEMBERS                                                   │
│     ├── Add new members (create user if needed)                        │
│     ├── Remove members no longer in GitHub team                        │
│     └── Update member roles if changed                                 │
│     │                                                                   │
│     ▼                                                                   │
│  5. RECONCILE OWNERSHIP (if enabled)                                    │
│     ├── Parse repos team has access to                                 │
│     └── Set group as owner of corresponding assets                     │
│     │                                                                   │
│     ▼                                                                   │
│  6. CREATE ASSIGNMENT RULES (from CODEOWNERS)                          │
│     └── /src/api/** @org/api-team → Rule: path → group                 │
│     │                                                                   │
│     ▼                                                                   │
│  7. AUDIT LOG                                                           │
│     └── Record all changes made during sync                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.8 Notifications

#### 4.8.1 Notification Types

| Type | Trigger | Recipients |
|------|---------|------------|
| `new_finding` | New finding created | Assigned group |
| `finding_assigned` | Finding assigned to group | Assigned group |
| `sla_warning` | SLA deadline approaching | Assigned group |
| `sla_breached` | SLA deadline passed | Assigned group + escalation |
| `critical_alert` | Critical severity finding | Security leads |
| `weekly_digest` | Weekly schedule | All groups (opted in) |
| `permission_set_update` | System template updated | Tenants with cloned sets |

#### 4.8.2 Notification Channels

```typescript
interface NotificationConfig {
  group_id: string;

  // Channels
  channels: {
    slack?: {
      enabled: boolean;
      channel: string;          // "#security-alerts"
      mention_on_critical: boolean;
    };
    email?: {
      enabled: boolean;
      recipients: string[];     // ["security@example.com"]
      digest_frequency: 'realtime' | 'daily' | 'weekly';
    };
    webhook?: {
      enabled: boolean;
      url: string;
      secret: string;
    };
  };

  // What to notify
  notify_on: {
    new_critical_finding: boolean;
    new_high_finding: boolean;
    new_medium_finding: boolean;
    sla_warning: boolean;
    sla_breach: boolean;
    weekly_digest: boolean;
  };
}
```

---

## 5. Database Schema

### 5.1 Complete Schema

```sql
-- =====================================================
-- MODULES
-- =====================================================
CREATE TABLE modules (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    parent_id VARCHAR(50) REFERENCES modules(id),
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PERMISSIONS
-- =====================================================
CREATE TABLE permissions (
    id VARCHAR(100) PRIMARY KEY,          -- 'module.action' or 'module.action.resource'
    module_id VARCHAR(50) NOT NULL REFERENCES modules(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    action VARCHAR(50) NOT NULL,
    resource VARCHAR(50),
    display_order INT DEFAULT 0,
    is_sensitive BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_permissions_module ON permissions(module_id);

-- =====================================================
-- PERMISSION SETS
-- =====================================================
CREATE TABLE permission_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),  -- NULL = system template
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,

    -- Type and inheritance
    set_type VARCHAR(50) NOT NULL DEFAULT 'custom',
    -- 'system'   = Platform template
    -- 'extended' = Inherits from parent, auto-sync
    -- 'cloned'   = Independent copy
    -- 'custom'   = Built from scratch

    parent_set_id UUID REFERENCES permission_sets(id),
    cloned_from_version INT,              -- For tracking updates to cloned sets

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, slug),
    CONSTRAINT chk_system_set CHECK (
        (set_type = 'system' AND tenant_id IS NULL) OR
        (set_type != 'system')
    )
);

-- Permission set items (for custom/cloned: full list; for extended: modifications)
CREATE TABLE permission_set_items (
    permission_set_id UUID NOT NULL REFERENCES permission_sets(id) ON DELETE CASCADE,
    permission_id VARCHAR(100) NOT NULL REFERENCES permissions(id),
    modification_type VARCHAR(10) DEFAULT 'add',  -- 'add', 'remove'

    PRIMARY KEY (permission_set_id, permission_id)
);

-- Version tracking for system templates
CREATE TABLE permission_set_versions (
    permission_set_id UUID NOT NULL REFERENCES permission_sets(id),
    version INT NOT NULL,
    changes JSONB NOT NULL,               -- {"added": [...], "removed": [...]}
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    changed_by UUID,

    PRIMARY KEY (permission_set_id, version)
);

-- =====================================================
-- GROUPS
-- =====================================================
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,

    group_type VARCHAR(50) DEFAULT 'team',
    -- 'security_team' = Security sub-team with feature access
    -- 'team'          = Dev/owner team for asset ownership
    -- 'department'    = Organizational unit
    -- 'project'       = Project-based
    -- 'external'      = External contractors

    -- External sync
    external_id VARCHAR(255),
    external_source VARCHAR(50),          -- 'github', 'gitlab', 'azure_ad', 'okta'

    -- Settings
    settings JSONB DEFAULT '{}',

    -- Notification config
    notification_config JSONB DEFAULT '{}',

    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_groups_tenant ON groups(tenant_id);
CREATE INDEX idx_groups_external ON groups(external_source, external_id);

-- =====================================================
-- GROUP MEMBERS
-- =====================================================
CREATE TABLE group_members (
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',    -- 'owner', 'lead', 'member'

    joined_at TIMESTAMPTZ DEFAULT NOW(),
    added_by UUID REFERENCES users(id),

    PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_group_members_user ON group_members(user_id);
-- Composite index for user-group lookups (PERFORMANCE)
CREATE INDEX idx_group_members_user_group ON group_members(user_id, group_id);

-- =====================================================
-- GROUP PERMISSION SETS (many-to-many)
-- =====================================================
CREATE TABLE group_permission_sets (
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    permission_set_id UUID NOT NULL REFERENCES permission_sets(id),

    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),

    PRIMARY KEY (group_id, permission_set_id)
);

-- =====================================================
-- GROUP CUSTOM PERMISSIONS (overrides)
-- =====================================================
CREATE TABLE group_permissions (
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    permission_id VARCHAR(100) NOT NULL REFERENCES permissions(id),

    effect VARCHAR(10) NOT NULL DEFAULT 'allow',  -- 'allow', 'deny'

    -- Scope limitation
    scope_type VARCHAR(50),               -- 'all', 'owned_assets', 'asset_type', 'asset_tags', 'severity'
    scope_value JSONB,                    -- Scope-specific config

    PRIMARY KEY (group_id, permission_id)
);

-- =====================================================
-- USER DIRECT PERMISSIONS (rare, for special cases)
-- =====================================================
CREATE TABLE user_permissions (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    permission_id VARCHAR(100) NOT NULL REFERENCES permissions(id),

    effect VARCHAR(10) NOT NULL DEFAULT 'allow',
    scope_type VARCHAR(50),
    scope_value JSONB,

    expires_at TIMESTAMPTZ,               -- Temporary permissions

    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (user_id, permission_id, tenant_id)
);

CREATE INDEX idx_user_permissions_user ON user_permissions(user_id);

-- =====================================================
-- ASSET OWNERSHIP
-- =====================================================
CREATE TABLE asset_owners (
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,

    ownership_type VARCHAR(50) DEFAULT 'primary',
    -- 'primary'     = Main owner, full access
    -- 'secondary'   = Co-owner, full access
    -- 'stakeholder' = View access, critical notifications only
    -- 'informed'    = No access, summary notifications only

    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),

    PRIMARY KEY (asset_id, group_id)
);

CREATE INDEX idx_asset_owners_group ON asset_owners(group_id);
CREATE INDEX idx_asset_owners_asset ON asset_owners(asset_id);
-- Composite index for common join patterns (PERFORMANCE)
CREATE INDEX idx_asset_owners_group_asset ON asset_owners(group_id, asset_id);

-- =====================================================
-- ASSIGNMENT RULES
-- =====================================================
CREATE TABLE assignment_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    name VARCHAR(100) NOT NULL,
    description TEXT,
    priority INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,

    -- Matching conditions
    conditions JSONB NOT NULL,

    -- Target
    target_group_id UUID NOT NULL REFERENCES groups(id),

    -- Options
    options JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assignment_rules_tenant ON assignment_rules(tenant_id);
CREATE INDEX idx_assignment_rules_priority ON assignment_rules(tenant_id, priority DESC);
-- GIN Index for JSONB conditions (PERFORMANCE - avoid full table scan)
CREATE INDEX idx_assignment_rules_conditions ON assignment_rules USING GIN (conditions jsonb_path_ops);
-- Specific key indexes for common queries
CREATE INDEX idx_assignment_rules_conditions_asset_type ON assignment_rules USING GIN ((conditions -> 'asset_type'));
CREATE INDEX idx_assignment_rules_conditions_severity ON assignment_rules USING GIN ((conditions -> 'finding_severity'));

-- =====================================================
-- EXTERNAL SYNC CONFIGS
-- =====================================================
CREATE TABLE external_sync_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    source VARCHAR(50) NOT NULL,          -- 'github', 'gitlab', 'azure_ad', 'okta'
    config JSONB NOT NULL,                -- Source-specific config

    sync_interval VARCHAR(20) DEFAULT '6h',
    last_sync_at TIMESTAMPTZ,
    last_sync_status VARCHAR(50),
    last_sync_error TEXT,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, source)
);

-- =====================================================
-- PERMISSION SET UPDATE NOTIFICATIONS
-- =====================================================
CREATE TABLE permission_set_update_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    cloned_set_id UUID NOT NULL REFERENCES permission_sets(id),
    source_set_id UUID NOT NULL REFERENCES permission_sets(id),
    source_new_version INT NOT NULL,

    changes JSONB NOT NULL,

    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'acknowledged', 'applied', 'ignored'
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_perm_set_notifications_tenant ON permission_set_update_notifications(tenant_id);
CREATE INDEX idx_perm_set_notifications_status ON permission_set_update_notifications(status);

-- =====================================================
-- NOTIFICATION CONFIGS
-- =====================================================
CREATE TABLE group_notification_configs (
    group_id UUID PRIMARY KEY REFERENCES groups(id) ON DELETE CASCADE,

    -- Channels
    slack_enabled BOOLEAN DEFAULT false,
    slack_channel VARCHAR(100),
    slack_mention_on_critical BOOLEAN DEFAULT true,

    email_enabled BOOLEAN DEFAULT false,
    email_recipients TEXT[],
    email_digest_frequency VARCHAR(20) DEFAULT 'daily',

    webhook_enabled BOOLEAN DEFAULT false,
    webhook_url TEXT,
    webhook_secret TEXT,

    -- What to notify
    notify_new_critical BOOLEAN DEFAULT true,
    notify_new_high BOOLEAN DEFAULT true,
    notify_new_medium BOOLEAN DEFAULT false,
    notify_sla_warning BOOLEAN DEFAULT true,
    notify_sla_breach BOOLEAN DEFAULT true,
    notify_weekly_digest BOOLEAN DEFAULT true,

    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.2 Migration Scripts

```sql
-- Migration: Add access control tables
-- Version: 2026012101

BEGIN;

-- Create modules table
CREATE TABLE IF NOT EXISTS modules (...);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (...);

-- Seed modules and permissions
INSERT INTO modules (id, name, description, icon, display_order) VALUES
('dashboard', 'Dashboard', 'Overview and metrics', 'layout-dashboard', 1),
-- ... other modules
ON CONFLICT (id) DO NOTHING;

INSERT INTO permissions (id, module_id, name, action, description) VALUES
('dashboard.view', 'dashboard', 'View Dashboard', 'view', 'View dashboard and metrics'),
-- ... other permissions
ON CONFLICT (id) DO NOTHING;

-- Create permission_sets table
CREATE TABLE IF NOT EXISTS permission_sets (...);

-- Seed system permission sets
INSERT INTO permission_sets (id, tenant_id, name, slug, set_type, description) VALUES
('00000000-0000-0000-0000-000000000001', NULL, 'Full Admin', 'full-admin', 'system', 'Full access'),
-- ... other sets
ON CONFLICT (id) DO NOTHING;

-- ... rest of tables

COMMIT;
```

---

## 6. API Design

### 6.1 Groups API

```yaml
# List groups
GET /api/v1/groups
Query:
  - type: string (optional) - Filter by group type
  - search: string (optional) - Search by name
  - page: int
  - page_size: int
Response:
  items: Group[]
  total: int
  page: int
  page_size: int

# Create group
POST /api/v1/groups
Body:
  name: string (required)
  description: string
  group_type: string (default: 'team')
  settings: object
Response:
  Group

# Get group
GET /api/v1/groups/{id}
Response:
  Group (with members count, assets count)

# Update group
PUT /api/v1/groups/{id}
Body:
  name: string
  description: string
  settings: object
Response:
  Group

# Delete group
DELETE /api/v1/groups/{id}
Response:
  204 No Content

# List group members
GET /api/v1/groups/{id}/members
Response:
  items: GroupMember[]
  total: int

# Add members
POST /api/v1/groups/{id}/members
Body:
  user_ids: string[]
  role: string (default: 'member')
Response:
  GroupMember[]

# Remove member
DELETE /api/v1/groups/{id}/members/{user_id}
Response:
  204 No Content

# Get group permissions (effective)
GET /api/v1/groups/{id}/permissions
Response:
  permission_sets: PermissionSet[]
  custom_permissions: GroupPermission[]
  effective_permissions: string[]

# Assign permission sets
PUT /api/v1/groups/{id}/permission-sets
Body:
  permission_set_ids: string[]
Response:
  Group

# Set custom permissions
PUT /api/v1/groups/{id}/permissions
Body:
  permissions: {
    permission_id: string
    effect: 'allow' | 'deny'
    scope_type: string
    scope_value: object
  }[]
Response:
  GroupPermission[]

# Get group's assets (owned)
GET /api/v1/groups/{id}/assets
Response:
  items: AssetOwnership[]

# Assign assets to group
POST /api/v1/groups/{id}/assets
Body:
  asset_ids: string[]
  ownership_type: string (default: 'primary')
Response:
  AssetOwnership[]
```

### 6.2 Permission Sets API

```yaml
# List permission sets (system + tenant's custom)
GET /api/v1/permission-sets
Query:
  - type: string (optional) - 'system', 'extended', 'cloned', 'custom'
Response:
  items: PermissionSet[]

# Create custom permission set
POST /api/v1/permission-sets
Body:
  name: string (required)
  description: string
  set_type: 'extended' | 'cloned' | 'custom' (required)
  parent_set_id: string (required for extended/cloned)
  permissions: string[] (for custom type)
Response:
  PermissionSet

# Clone system template
POST /api/v1/permission-sets/clone
Body:
  source_id: string (required)
  name: string (required)
  mode: 'extended' | 'cloned' (default: 'extended')
  additional_permissions: string[]
  removed_permissions: string[]
Response:
  PermissionSet

# Get permission set
GET /api/v1/permission-sets/{id}
Response:
  PermissionSet (with effective_permissions)

# Update permission set
PUT /api/v1/permission-sets/{id}
Body:
  name: string
  description: string
  permissions: string[] (for custom)
  additions: string[] (for extended)
  removals: string[] (for extended)
Response:
  PermissionSet

# Delete permission set
DELETE /api/v1/permission-sets/{id}
Response:
  204 No Content

# Get update notifications (for cloned sets)
GET /api/v1/permission-sets/notifications
Response:
  items: PermissionSetUpdateNotification[]

# Acknowledge/apply notification
POST /api/v1/permission-sets/notifications/{id}/action
Body:
  action: 'acknowledge' | 'apply' | 'ignore'
  apply_permissions: string[] (if action = 'apply')
Response:
  PermissionSetUpdateNotification
```

### 6.3 User Permissions API

```yaml
# Get current user's permissions
GET /api/v1/me/permissions
Response:
  permissions: string[]
  modules: string[]
  groups: GroupSummary[]

# Check single permission
GET /api/v1/me/can/{permission}
Query:
  - resource_type: string (optional)
  - resource_id: string (optional)
Response:
  allowed: boolean
  scope: object (if scoped)

# Get user's groups
GET /api/v1/me/groups
Response:
  items: Group[]

# Get user's findings (scoped to owned assets)
GET /api/v1/me/findings
Query:
  - severity: string[]
  - status: string[]
  - page: int
  - page_size: int
Response:
  items: Finding[]
  total: int

# Get user's assets (owned by user's groups)
GET /api/v1/me/assets
Response:
  items: Asset[]
  total: int
```

### 6.4 Assignment Rules API

```yaml
# List rules
GET /api/v1/assignment-rules
Response:
  items: AssignmentRule[]

# Create rule
POST /api/v1/assignment-rules
Body:
  name: string (required)
  description: string
  priority: int (default: 0)
  conditions: object (required)
  target_group_id: string (required)
  options: object
Response:
  AssignmentRule

# Update rule
PUT /api/v1/assignment-rules/{id}
Body:
  name: string
  priority: int
  conditions: object
  target_group_id: string
  is_active: boolean
Response:
  AssignmentRule

# Delete rule
DELETE /api/v1/assignment-rules/{id}
Response:
  204 No Content

# Test rule (dry run)
POST /api/v1/assignment-rules/test
Body:
  conditions: object
  sample_finding: object (optional)
Response:
  matching_findings_count: int
  sample_matches: Finding[]
```

### 6.5 External Sync API

```yaml
# List sync configs
GET /api/v1/external-sync
Response:
  items: ExternalSyncConfig[]

# Create/update sync config
PUT /api/v1/external-sync/{source}
Body:
  config: object (source-specific)
  sync_interval: string
  is_active: boolean
Response:
  ExternalSyncConfig

# Trigger manual sync
POST /api/v1/external-sync/{source}/sync
Response:
  sync_id: string
  status: 'started'

# Get sync status
GET /api/v1/external-sync/{source}/status
Response:
  last_sync_at: string
  last_sync_status: string
  last_sync_error: string
  next_sync_at: string
```

---

## 7. UI/UX Design

### 7.1 Navigation Changes

```
CURRENT SIDEBAR                    NEW SIDEBAR
───────────────                    ───────────
Dashboard                          Dashboard
Assets                             Assets
Findings                           Findings
Scans                              Scans
Agents                             Agents
                                   ─────────────── (Security Team Only)
                                   Pentest          (if has permission)
                                   Monitoring       (if has permission)
                                   Compliance       (if has permission)
                                   ───────────────
Reports                            Reports
Settings                           Settings
                                   └── Groups       (NEW)
                                   └── Permissions  (NEW, Admin only)
```

### 7.2 Key UI Components

#### 7.2.1 Groups Management Page

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Settings > Groups                                          [+ Create]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [All Types ▼] [Search groups...                    ]                   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Group            │ Type          │ Members │ Assets │ Actions   │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ 🛡️ Security Team │ security_team │ 12      │ All    │ [···]     │   │
│  │ 🛡️ Pentest Team  │ security_team │ 5       │ Scoped │ [···]     │   │
│  │ 🛡️ SOC Team      │ security_team │ 8       │ All    │ [···]     │   │
│  │ 👥 API Team      │ team          │ 10      │ 5      │ [···]     │   │
│  │ 👥 Frontend Team │ team          │ 15      │ 8      │ [···]     │   │
│  │ 👥 Cloud Infra   │ team          │ 5       │ 12     │ [···]     │   │
│  │ 🔗 External Pen. │ external      │ 3       │ 2      │ [···]     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  [Sync from GitHub]  [Sync from Azure AD]                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 7.2.2 Group Detail Page

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Groups / API Team                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  👥 API Team                                              [Edit] │   │
│  │  Development team responsible for backend API services           │   │
│  │  Type: team │ 10 members │ 5 assets                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────┬──────────┬─────────────┬──────────┐                      │
│  │ Members  │ Assets   │ Permissions │ Settings │                      │
│  └──────────┴──────────┴─────────────┴──────────┘                      │
│                                                                         │
│  MEMBERS (10)                                        [+ Add Members]    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ User              │ Role   │ Joined     │ Actions                │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ john@example.com  │ Lead   │ 2024-01-15 │ [Change Role] [Remove] │   │
│  │ jane@example.com  │ Member │ 2024-02-20 │ [Change Role] [Remove] │   │
│  │ ...               │        │            │                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 7.2.3 Permission Sets Management

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Settings > Permission Sets                                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SYSTEM TEMPLATES (Read-only)                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 🔒 Full Admin      │ Full access to all features     │ [View]    │   │
│  │ 🔒 Security Analyst│ Standard security access        │ [View]    │   │
│  │ 🔒 SOC Analyst     │ Security Operations             │ [View]    │   │
│  │ 🔒 Pentest Operator│ Penetration testing             │ [View]    │   │
│  │ 🔒 Developer       │ Developer access                │ [View]    │   │
│  │ 🔒 Read Only       │ Read-only access                │ [View]    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ⚠️ 1 UPDATE AVAILABLE                                    [Review]      │
│                                                                         │
│  YOUR CUSTOM PERMISSION SETS                               [+ Create]   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Name             │ Type     │ Base         │ Groups │ Actions   │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ APAC SOC Lead    │ Extended │ SOC Analyst  │ 2      │ [Edit] ❌ │   │
│  │ External Pentest │ Cloned   │ Pentester ⚠️ │ 1      │ [Edit] ❌ │   │
│  │ Junior Analyst   │ Custom   │ -            │ 1      │ [Edit] ❌ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 7.2.4 "My Findings" View (For Developers)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  My Findings                                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Welcome, John! You're a member of: API Team, Backend Core              │
│                                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │ Critical │ │   High   │ │  Medium  │ │   Low    │                   │
│  │    3     │ │    12    │ │    28    │ │    45    │                   │
│  │ ▲2 new   │ │ ▲5 new   │ │          │ │          │                   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                   │
│                                                                         │
│  [All Severities ▼] [All Statuses ▼] [All Assets ▼] [Search...]        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ CRITICAL - Needs immediate attention                            │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ 🔴 SQL Injection in UserController.java:45                      │   │
│  │    backend-api │ SAST │ Due in 3 days                           │   │
│  │    [View Details] [Mark In Progress] [Comment]                  │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ 🔴 Hardcoded AWS credentials in config.py:12                    │   │
│  │    backend-api │ Secrets │ Due in 2 days                        │   │
│  │    [View Details] [Mark In Progress] [Comment]                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Permission-Based UI Rendering

```typescript
// hooks/usePermissions.ts
export function usePermissions() {
  const { data } = useSWR('/api/v1/me/permissions');

  return {
    permissions: data?.permissions || [],
    modules: data?.modules || [],

    can: (permission: string) =>
      data?.permissions?.includes(permission) ?? false,

    canAny: (permissions: string[]) =>
      permissions.some(p => data?.permissions?.includes(p)),

    canAccessModule: (moduleId: string) =>
      data?.modules?.includes(moduleId) ?? false,
  };
}

// Usage in components
function AgentsPage() {
  const { can, canAccessModule } = usePermissions();

  if (!canAccessModule('agents')) {
    return <AccessDenied />;
  }

  return (
    <div>
      <h1>Agents</h1>

      {can('agents.create') && (
        <Button onClick={openCreateDialog}>Add Agent</Button>
      )}

      <AgentTable
        showDelete={can('agents.delete')}
        showEdit={can('agents.update')}
        showManage={can('agents.manage')}
      />
    </div>
  );
}
```

---

## 8. Implementation Phases

### Phase 1: Groups Foundation (2 weeks)

**Goal:** Basic group management and membership

**Status:** ✅ Backend Complete

**Deliverables:**
- [x] Database tables: groups, group_members
- [x] API endpoints: Groups CRUD, Members management
- [ ] UI: Groups list page, Group detail page
- [ ] UI: Add/remove members

**Dependencies:** None

### Phase 2: Asset Ownership (1-2 weeks)

**Goal:** Link groups to assets

**Deliverables:**
- [ ] Database table: asset_owners
- [ ] API: Assign/remove asset ownership
- [ ] UI: Asset ownership management in group detail
- [ ] UI: "My Assets" view for users

**Dependencies:** Phase 1

### Phase 3: Modules & Permissions (2 weeks)

**Goal:** Permission infrastructure

**Status:** ✅ Backend Complete

**Deliverables:**
- [x] Database tables: modules, permissions
- [x] Seed data: All modules and permissions
- [x] Permission resolution service
- [x] API: /me/permissions endpoint
- [ ] Frontend permission hook

**Dependencies:** None (can run parallel with Phase 1-2)

### Phase 4: Permission Sets (2 weeks)

**Goal:** System templates and tenant customization

**Status:** ✅ Backend Complete

**Deliverables:**
- [x] Database tables: permission_sets, permission_set_items
- [x] Seed data: System permission sets (9 system sets)
- [x] API: Permission sets CRUD
- [ ] Extended/Cloned inheritance logic
- [ ] UI: Permission sets management page

**Dependencies:** Phase 3

### Phase 5: Group Permissions (1-2 weeks)

**Goal:** Assign permissions to groups

**Deliverables:**
- [ ] Database tables: group_permission_sets, group_permissions
- [ ] API: Assign permission sets to groups
- [ ] API: Custom permissions per group
- [ ] UI: Permissions tab in group detail
- [ ] Complete permission resolution (user → groups → sets → permissions)

**Dependencies:** Phase 1, Phase 4

### Phase 6: UI Permission Enforcement (1-2 weeks)

**Goal:** Hide/show UI based on permissions

**Deliverables:**
- [ ] Update sidebar navigation
- [ ] Update all pages with permission checks
- [ ] Update all action buttons
- [ ] "My Findings" view for developers
- [ ] Scoped data fetching

**Dependencies:** Phase 5

### Phase 7: Auto-Assignment Rules (1-2 weeks)

**Goal:** Automatic finding assignment

**Deliverables:**
- [ ] Database table: assignment_rules
- [ ] Rule evaluation engine
- [ ] Integration with finding creation flow
- [ ] API: Rules CRUD
- [ ] UI: Rules management page

**Dependencies:** Phase 2 (ownership), Phase 5 (groups)

### Phase 8: Notifications (1-2 weeks)

**Goal:** Alert users of new findings

**Deliverables:**
- [ ] Database table: group_notification_configs
- [ ] Notification service
- [ ] Slack integration
- [ ] Email notifications
- [ ] Weekly digest

**Dependencies:** Phase 7 (assignment)

### Phase 9: External Sync (2-3 weeks)

**Goal:** Sync with GitHub/AD

**Deliverables:**
- [ ] Database table: external_sync_configs
- [ ] GitHub sync service
- [ ] Azure AD sync service
- [ ] CODEOWNERS parsing
- [ ] UI: Sync configuration
- [ ] Scheduled sync jobs

**Dependencies:** Phase 1, Phase 2

### Phase 10: Permission Set Updates (1 week)

**Goal:** Handle system template updates

**Deliverables:**
- [ ] Database table: permission_set_versions, notifications
- [ ] Version tracking for system sets
- [ ] Notification creation on updates
- [ ] UI: Update notifications
- [ ] UI: Review and apply changes

**Dependencies:** Phase 4

### Summary Timeline

```
Week  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16
      ├──────┤                                         Phase 1: Groups
         ├─────┤                                       Phase 2: Ownership
      ├──────┤                                         Phase 3: Permissions
            ├──────┤                                   Phase 4: Permission Sets
                  ├─────┤                              Phase 5: Group Permissions
                        ├─────┤                        Phase 6: UI Enforcement
                              ├─────┤                  Phase 7: Auto-Assignment
                                    ├─────┤            Phase 8: Notifications
                                          ├────────┤   Phase 9: External Sync
                                                   ├──┤Phase 10: Updates

Total: ~16 weeks (4 months)
```

---

## 9. Migration Strategy

### 9.1 Data Migration

```sql
-- Step 1: Create default group for each tenant
INSERT INTO groups (tenant_id, name, slug, group_type)
SELECT id, 'Default Team', 'default-team', 'team'
FROM tenants;

-- Step 2: Add all tenant members to default group
INSERT INTO group_members (group_id, user_id, role)
SELECT g.id, tm.user_id,
       CASE tm.role
         WHEN 'owner' THEN 'owner'
         WHEN 'admin' THEN 'lead'
         ELSE 'member'
       END
FROM tenant_members tm
JOIN groups g ON g.tenant_id = tm.tenant_id AND g.slug = 'default-team';

-- Step 3: Assign Full Admin permission set to admin/owner roles
INSERT INTO group_permission_sets (group_id, permission_set_id)
SELECT g.id, '00000000-0000-0000-0000-000000000001' -- Full Admin
FROM groups g
WHERE g.slug = 'default-team';
```

### 9.2 Rollout Strategy

1. **Phase A: Shadow Mode**
   - Deploy new permission system
   - Log permission decisions but don't enforce
   - Compare with existing behavior

2. **Phase B: Opt-in**
   - Allow tenants to opt-in to new system
   - Provide migration tools
   - Gather feedback

3. **Phase C: Default On**
   - New tenants get new system by default
   - Existing tenants migrated with default group

4. **Phase D: Full Migration**
   - All tenants on new system
   - Remove old permission checks

---

## 10. Testing Strategy

### 10.1 Unit Tests

```go
// Permission resolution tests
func TestPermissionResolver_UserDirectPermission(t *testing.T) { ... }
func TestPermissionResolver_GroupPermission(t *testing.T) { ... }
func TestPermissionResolver_PermissionSetInheritance(t *testing.T) { ... }
func TestPermissionResolver_DenyTakesPrecedence(t *testing.T) { ... }
func TestPermissionResolver_ScopeFiltering(t *testing.T) { ... }

// Permission set inheritance tests
func TestExtendedSet_InheritsFromParent(t *testing.T) { ... }
func TestExtendedSet_AdditionsApplied(t *testing.T) { ... }
func TestExtendedSet_RemovalsApplied(t *testing.T) { ... }
func TestClonedSet_Independent(t *testing.T) { ... }
```

### 10.2 Integration Tests

```go
// API tests
func TestGroupsAPI_CRUD(t *testing.T) { ... }
func TestGroupsAPI_MemberManagement(t *testing.T) { ... }
func TestPermissionSetsAPI_Clone(t *testing.T) { ... }
func TestMeAPI_PermissionsReturnsCorrectSet(t *testing.T) { ... }
```

### 10.3 E2E Tests

```typescript
// Playwright tests
test('developer can only see assigned findings', async ({ page }) => {
  // Login as developer
  // Navigate to findings
  // Verify only their team's findings are visible
});

test('admin can create custom permission set', async ({ page }) => {
  // Login as admin
  // Create permission set
  // Assign to group
  // Verify members get permissions
});
```

---

## 11. Security Considerations

### 11.1 Authorization Checks

- Always check permissions on backend, never trust frontend
- Use middleware for route-level checks
- Use service-level checks for fine-grained control

### 11.2 Audit Logging

All permission-related actions must be logged:
- Group created/updated/deleted
- Member added/removed
- Permission set assigned
- Custom permission granted/revoked

### 11.3 Principle of Least Privilege

- Default deny for all permissions
- Explicitly grant required permissions
- Scope permissions to specific resources when possible

### 11.4 External Sync Security

- Validate OAuth tokens
- Use secure webhook secrets
- Audit all sync changes
- Allow manual approval for sensitive changes

### 11.5 Permission Resolution Security

**Conflict Resolution Logic Testing (CRITICAL)**

The logic for merging permissions (Parent + Add - Remove) is complex and error-prone:

```
Effective Permissions = Parent Permissions + Additions - Removals
```

**Edge Cases to Test:**

| Case | Scenario | Expected Result |
|------|----------|-----------------|
| 1 | Parent has `A`, Extended adds `A` | Has `A` (no duplicate) |
| 2 | Parent has `A`, Extended removes `A` | No `A` |
| 3 | Parent has `A,B`, Extended removes `A`, adds `C` | Has `B,C` |
| 4 | Extended removes permission parent doesn't have | No error, no change |
| 5 | Parent updated, adds `D` | Extended auto-inherits `D` |
| 6 | Parent updated, removes `A` | Extended loses `A` (unless added explicitly) |
| 7 | Circular inheritance (A extends B, B extends A) | Must be prevented |
| 8 | Deep nesting (A extends B extends C extends D) | Limit depth to 3 |

**Required Unit Tests:**

```go
func TestPermissionResolution(t *testing.T) {
    // Test all edge cases above
    // Test with wildcards (findings.*)
    // Test with deny overrides
    // Test cache invalidation on parent update
}
```

**Security Implications:**
- Incorrect resolution could grant unintended access
- Must have 100% test coverage for resolution logic
- Consider formal verification for critical paths

---

## 11.6 Performance Considerations

### 11.6.1 Query Scope Performance

**Problem:** Filtering data by scope (e.g., "only get findings for assets I own") can be very slow with large datasets.

```sql
-- SLOW: Full table scan if not indexed properly
SELECT f.* FROM findings f
JOIN assets a ON f.asset_id = a.id
JOIN asset_owners ao ON a.id = ao.asset_id
JOIN group_members gm ON ao.group_id = gm.group_id
WHERE gm.user_id = $1;
```

**Solution: Optimized Indexes**

```sql
-- Index for asset_owners lookups
CREATE INDEX idx_asset_owners_group_asset ON asset_owners(group_id, asset_id);
CREATE INDEX idx_asset_owners_asset_group ON asset_owners(asset_id, group_id);

-- Index for findings by asset
CREATE INDEX idx_findings_asset_status ON findings(asset_id, status);
CREATE INDEX idx_findings_asset_severity ON findings(asset_id, severity);

-- Index for group_members lookups
CREATE INDEX idx_group_members_user_group ON group_members(user_id, group_id);

-- Composite index for the common join pattern
CREATE INDEX idx_findings_asset_created ON findings(asset_id, created_at DESC);
```

**Recommendation:** Consider materialized view for frequently accessed scoped queries:

```sql
CREATE MATERIALIZED VIEW user_accessible_assets AS
SELECT gm.user_id, ao.asset_id, ao.ownership_type
FROM group_members gm
JOIN asset_owners ao ON gm.group_id = ao.group_id;

CREATE UNIQUE INDEX idx_user_accessible_assets ON user_accessible_assets(user_id, asset_id);

-- Refresh periodically or on group/ownership changes
REFRESH MATERIALIZED VIEW CONCURRENTLY user_accessible_assets;
```

### 11.6.2 JSONB Index for Assignment Rules

**Problem:** The `assignment_rules` table uses `conditions` JSONB column. Without proper indexing, rule matching requires full table scan.

```sql
-- Current schema
CREATE TABLE assignment_rules (
    ...
    conditions JSONB NOT NULL,  -- {"asset_type": [...], "severity": [...], ...}
    ...
);
```

**Solution: GIN Index for JSONB**

```sql
-- GIN index for JSONB containment queries
CREATE INDEX idx_assignment_rules_conditions ON assignment_rules
    USING GIN (conditions jsonb_path_ops);

-- Example query that benefits from GIN index
SELECT * FROM assignment_rules
WHERE conditions @> '{"asset_type": ["repository"]}';

-- For specific key lookups
CREATE INDEX idx_assignment_rules_asset_type ON assignment_rules
    USING GIN ((conditions -> 'asset_type'));

CREATE INDEX idx_assignment_rules_severity ON assignment_rules
    USING GIN ((conditions -> 'finding_severity'));
```

**Query Optimization:**

```sql
-- Optimized rule matching query
WITH active_rules AS (
    SELECT * FROM assignment_rules
    WHERE tenant_id = $1
    AND is_active = true
    ORDER BY priority DESC
)
SELECT * FROM active_rules ar
WHERE
    (ar.conditions -> 'asset_type' IS NULL
     OR ar.conditions -> 'asset_type' @> to_jsonb($2::text))
AND (ar.conditions -> 'finding_severity' IS NULL
     OR ar.conditions -> 'finding_severity' @> to_jsonb($3::text))
LIMIT 1;  -- First match wins
```

### 11.6.3 Caching Strategy

**Cache Layers:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CACHING STRATEGY                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Layer 1: Request-level (per API request)                               │
│  ─────────────────────────────────────────                              │
│  - User's groups (context.GetUserGroups())                              │
│  - User's permissions (context.GetUserPermissions())                    │
│  - TTL: Duration of request                                             │
│                                                                         │
│  Layer 2: Redis (shared across requests)                                │
│  ────────────────────────────────────────                               │
│  - user:{id}:groups:{tenant_id} → group IDs (TTL: 5 min)               │
│  - user:{id}:permissions:{tenant_id} → permissions (TTL: 5 min)        │
│  - group:{id}:permissions → resolved permissions (TTL: 10 min)         │
│  - permission_set:{id}:effective → effective perms (TTL: 30 min)       │
│                                                                         │
│  Layer 3: Database (source of truth)                                    │
│  ───────────────────────────────────                                    │
│  - Always fallback when cache miss                                      │
│  - Invalidate cache on mutations                                        │
│                                                                         │
│  INVALIDATION TRIGGERS:                                                 │
│  ──────────────────────                                                 │
│  - User joins/leaves group → invalidate user:{id}:*                    │
│  - Group permission changes → invalidate group:{id}:*, all members     │
│  - Permission set updated → invalidate permission_set:{id}:*           │
│  - System template updated → invalidate ALL extended sets              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 11.6.4 Performance Benchmarks

| Operation | Target | Max Acceptable | Notes |
|-----------|--------|----------------|-------|
| Permission check (cached) | < 1ms | 5ms | Single permission lookup |
| Permission check (uncached) | < 10ms | 50ms | Full resolution |
| Get all user permissions | < 20ms | 100ms | For UI rendering |
| Assignment rule matching | < 15ms | 75ms | Per finding |
| Scoped findings list | < 50ms | 200ms | With pagination |

---

## 12. Appendix

### 12.1 Glossary

| Term | Definition |
|------|------------|
| **Module** | Logical grouping of features (e.g., "Assets", "Findings") |
| **Permission** | Granular action (e.g., "assets.create") |
| **Permission Set** | Bundle of permissions, can be system or tenant-defined |
| **Group** | Collection of users with shared permissions/ownership |
| **Asset Ownership** | Link between a group and assets they manage |
| **Extended Set** | Permission set that inherits from parent, auto-syncs |
| **Cloned Set** | Independent copy of a permission set |

### 12.2 Related Documents

- [Audit Logging Design](./audit-logging.md)
- [Multi-Tenancy Architecture](./multi-tenancy.md)
- [API Authentication](./authentication.md)

### 12.3 Implementation Strategy - Best Practice Recommendation

#### Implementation Approach Evaluation

| Approach | Description | Advantages | Disadvantages | Risk |
|----------|-------------|------------|---------------|------|
| **Big Bang** | Build all, deploy once | Technically simpler | Long time, high risk | 🔴 High |
| **Feature Flags** | Build incrementally, gradual rollout | Controllable, easy rollback | Need to manage flags | 🟢 Low |
| **Parallel System** | Run old/new systems in parallel | Safest | Complex, resource-intensive | 🟡 Medium |

**Recommendation: Feature Flags + Incremental Delivery** ✅

#### Optimal Implementation Strategy

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION ROADMAP - RECOMMENDED                              │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  Phase 0: Foundation          Phase 1: Groups         Phase 2: Permissions          │
│  ──────────────────          ─────────────────       ────────────────────          │
│  [Week 1-2]                  [Week 3-4]              [Week 5-6]                     │
│                                                                                     │
│  ┌─────────────────┐        ┌─────────────────┐     ┌─────────────────┐            │
│  │ DB Migrations   │───────▶│ Groups CRUD     │────▶│ Permission Sets │            │
│  │ Backend Services│        │ Members Mgmt    │     │ Assign to Groups│            │
│  │ System Seed     │        │ Admin UI        │     │ Resolution Logic│            │
│  │ Unit Tests      │        │ Feature Flag    │     │ Edge Case Tests │            │
│  └─────────────────┘        └─────────────────┘     └─────────────────┘            │
│         │                          │                        │                       │
│         │ No user impact           │ Admin only             │ Admin only            │
│         │ Old RBAC still works     │ Old RBAC still works   │ Old RBAC still works  │
│         ▼                          ▼                        ▼                       │
│                                                                                     │
│  Phase 3: Switchover         Phase 4: Ownership       Phase 5: Integrations        │
│  ───────────────────        ─────────────────────    ───────────────────────       │
│  [Week 7-8] ⚠️ CRITICAL      [Week 9-10]              [Week 11-12]                  │
│                                                                                     │
│  ┌─────────────────┐        ┌─────────────────┐     ┌─────────────────┐            │
│  │ Migration Script│───────▶│ Asset Ownership │────▶│ GitHub Sync     │            │
│  │ New Middleware  │        │ Auto-Assignment │     │ GitLab Sync     │            │
│  │ Gradual Rollout │        │ Notifications   │     │ CODEOWNERS      │            │
│  │ Monitoring      │        │ Developer UI    │     │ Azure AD/Okta   │            │
│  └─────────────────┘        └─────────────────┘     └─────────────────┘            │
│         │                          │                        │                       │
│         │ NEW RBAC ACTIVE          │ Full feature           │ Enterprise features   │
│         │ Can rollback             │ for all users          │                       │
│         ▼                          ▼                        ▼                       │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

#### Phase 0: Foundation (Week 1-2) - START HERE

**Goal:** Create a solid foundation without affecting existing users

**Tasks:**

```
Week 1:
├── Day 1-2: Database Migrations
│   ├── Create modules table + seed data
│   ├── Create permissions table + seed data
│   ├── Create permission_sets table
│   ├── Create permission_set_items table
│   └── Run on dev environment
│
├── Day 3-4: Database Migrations (continued)
│   ├── Create groups table
│   ├── Create group_members table
│   ├── Create group_permission_sets table
│   ├── Create group_permissions table
│   └── Add indexes (including GIN for JSONB)
│
└── Day 5: Verify & Test
    ├── Run all migrations on staging
    ├── Verify no impact on existing queries
    └── Performance test with sample data

Week 2:
├── Day 1-2: Backend Services (Repository Layer)
│   ├── GroupRepository
│   ├── PermissionSetRepository
│   └── Unit tests with mocks
│
├── Day 3-4: Backend Services (Service Layer)
│   ├── GroupService
│   ├── PermissionSetService
│   ├── PermissionResolver (CRITICAL - test thoroughly)
│   └── Integration tests
│
└── Day 5: Seed System Data
    ├── Seed system permission sets (Full Admin, Developer, etc.)
    ├── Seed all modules and permissions
    └── Verify data integrity
```

**Deliverables Phase 0:**
- [ ] All database tables created
- [ ] All indexes created (including GIN for JSONB)
- [ ] System permission sets seeded
- [ ] Backend services with >80% test coverage
- [ ] PermissionResolver with 100% test coverage on edge cases
- [ ] No impact on existing users

**Rollback Plan:** Drop new tables (existing system unchanged)

#### Phase 1: Groups (Week 3-4)

**Goal:** Groups management UI, only visible to Admins

**Feature Flag:**
```typescript
// config/feature-flags.ts
export const FEATURE_FLAGS = {
  ACCESS_CONTROL_V2: {
    enabled: false,  // Set true per tenant
    allowedRoles: ['owner', 'admin'],
  }
};
```

**Tasks:**
```
Week 3:
├── API Endpoints
│   ├── GET/POST/PUT/DELETE /api/v1/groups
│   ├── GET/POST/DELETE /api/v1/groups/{id}/members
│   └── Feature flag middleware
│
└── UI Components
    ├── Groups list page (behind flag)
    ├── Create/Edit group dialog
    └── Members management

Week 4:
├── UI Components (continued)
│   ├── Group detail sheet
│   ├── Bulk actions
│   └── Search/filter
│
└── Testing & QA
    ├── E2E tests
    ├── Admin user testing
    └── Performance testing
```

**Deliverables Phase 1:**
- [ ] Groups CRUD API
- [ ] Members management API
- [ ] Admin UI (behind feature flag)
- [ ] E2E tests passing

**Rollback Plan:** Disable feature flag

#### Phase 2: Permission Sets (Week 5-6)

**Goal:** Permission Sets management, assign to Groups

**Tasks:**
```
Week 5:
├── API Endpoints
│   ├── GET /api/v1/permission-sets (list system + tenant sets)
│   ├── POST /api/v1/permission-sets/clone
│   ├── PUT /api/v1/groups/{id}/permission-sets
│   └── GET /api/v1/me/permissions (preview - not enforced yet)
│
└── Permission Resolution
    ├── Implement full resolution logic
    ├── Test all edge cases (see Section 11.5)
    └── Cache layer (Redis)

Week 6:
├── UI Components
│   ├── Permission sets management
│   ├── Clone/extend dialog
│   ├── Assign to groups UI
│   └── Permission preview (what user will have)
│
└── Testing
    ├── Unit tests for resolution (100% coverage)
    ├── Integration tests
    └── Load testing (cache performance)
```

**Deliverables Phase 2:**
- [ ] Permission Sets API
- [ ] Full resolution logic with caching
- [ ] Admin UI for management
- [ ] 100% test coverage on resolution logic
- [ ] Preview endpoint (not enforced yet)

**Rollback Plan:** Disable feature flag (old RBAC still works)

#### Phase 3: Switchover (Week 7-8) ⚠️ CRITICAL

**Goal:** Migrate users, activate new RBAC

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           SWITCHOVER STRATEGY                                        │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  Step 1: Migration (No enforcement yet)                                             │
│  ───────────────────────────────────────                                            │
│                                                                                     │
│  For each tenant:                                                                   │
│  ┌─────────────────┐                    ┌─────────────────┐                        │
│  │ tenant_members  │                    │ Default Group   │                        │
│  │ ─────────────── │    Migration       │ ─────────────── │                        │
│  │ owner  ────────────────────────────▶ │ owner + Full    │                        │
│  │ admin  ────────────────────────────▶ │   Admin perm set│                        │
│  │ member ────────────────────────────▶ │ member + basic  │                        │
│  │ viewer ────────────────────────────▶ │ viewer + viewer │                        │
│  └─────────────────┘                    │   perm set      │                        │
│                                         └─────────────────┘                        │
│                                                                                     │
│  Step 2: Dual-Mode (Both systems active)                                           │
│  ────────────────────────────────────────                                           │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │  Permission Check Middleware                                                 │   │
│  │                                                                              │   │
│  │  if (tenant.feature_flag.ACCESS_CONTROL_V2) {                               │   │
│  │    // New system                                                            │   │
│  │    allowed = await permissionResolver.check(user, permission, resource);    │   │
│  │                                                                              │   │
│  │    // Shadow mode: also check old system, log differences                   │   │
│  │    oldAllowed = checkOldRBAC(user, permission);                            │   │
│  │    if (allowed !== oldAllowed) {                                           │   │
│  │      logger.warn('Permission mismatch', { user, permission, allowed, old }); │   │
│  │    }                                                                        │   │
│  │  } else {                                                                   │   │
│  │    // Old system                                                            │   │
│  │    allowed = checkOldRBAC(user, permission);                               │   │
│  │  }                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                     │
│  Step 3: Gradual Rollout                                                           │
│  ────────────────────────                                                           │
│                                                                                     │
│  Day 1: Enable for 1 internal tenant → Monitor                                     │
│  Day 2: Enable for 5% of tenants → Monitor                                         │
│  Day 3: Enable for 25% of tenants → Monitor                                        │
│  Day 5: Enable for 50% of tenants → Monitor                                        │
│  Day 7: Enable for 100% of tenants                                                 │
│                                                                                     │
│  Step 4: Remove Old System (after 2 weeks stable)                                  │
│  ─────────────────────────────────────────────────                                  │
│                                                                                     │
│  - Remove old RBAC code                                                            │
│  - Remove shadow mode                                                              │
│  - Remove feature flag (always new system)                                         │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Migration Script:**

```sql
-- Migration: Create default group for each tenant and migrate members

-- Step 1: Create default groups
INSERT INTO groups (tenant_id, name, slug, group_type, settings)
SELECT
    id,
    'All Members',
    'all-members',
    'team',
    '{"auto_created": true}'::jsonb
FROM tenants
WHERE NOT EXISTS (
    SELECT 1 FROM groups g WHERE g.tenant_id = tenants.id AND g.slug = 'all-members'
);

-- Step 2: Migrate members with role mapping
INSERT INTO group_members (group_id, user_id, role, joined_at)
SELECT
    g.id,
    tm.user_id,
    CASE tm.role
        WHEN 'owner' THEN 'owner'
        WHEN 'admin' THEN 'lead'
        ELSE 'member'
    END,
    COALESCE(tm.joined_at, NOW())
FROM tenant_members tm
JOIN groups g ON g.tenant_id = tm.tenant_id AND g.slug = 'all-members'
ON CONFLICT (group_id, user_id) DO NOTHING;

-- Step 3: Assign permission sets based on old role
INSERT INTO group_permission_sets (group_id, permission_set_id, assigned_at)
SELECT DISTINCT
    g.id,
    CASE
        WHEN EXISTS (SELECT 1 FROM tenant_members tm2
                     WHERE tm2.tenant_id = g.tenant_id
                     AND tm2.role IN ('owner', 'admin'))
        THEN (SELECT id FROM permission_sets WHERE slug = 'full-admin' AND tenant_id IS NULL)
        ELSE (SELECT id FROM permission_sets WHERE slug = 'member' AND tenant_id IS NULL)
    END,
    NOW()
FROM groups g
WHERE g.slug = 'all-members'
ON CONFLICT (group_id, permission_set_id) DO NOTHING;
```

**Rollback Plan:**
1. Disable feature flag → instant rollback to old RBAC
2. If data issue: restore from backup (tested restore procedure)

#### Monitoring Checklist (Phase 3)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           MONITORING DASHBOARD                                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ⚡ Performance Metrics                                                             │
│  ─────────────────────                                                              │
│  □ Permission check latency (p50, p95, p99)                                        │
│  □ Cache hit rate (target: >95%)                                                   │
│  □ Database query time for resolution                                              │
│  □ API response times                                                              │
│                                                                                     │
│  🔒 Security Metrics                                                                │
│  ─────────────────────                                                              │
│  □ Permission denied count (by endpoint, by user)                                  │
│  □ Shadow mode mismatches (old vs new)                                             │
│  □ Unexpected permission grants (audit)                                            │
│                                                                                     │
│  📊 Business Metrics                                                                │
│  ─────────────────────                                                              │
│  □ Users unable to access (support tickets)                                        │
│  □ Feature flag status per tenant                                                  │
│  □ Migration status per tenant                                                     │
│                                                                                     │
│  🚨 Alerts                                                                          │
│  ─────────                                                                          │
│  □ Permission check latency > 100ms → Alert                                        │
│  □ Cache hit rate < 90% → Alert                                                    │
│  □ Shadow mode mismatch rate > 1% → Alert (CRITICAL)                              │
│  □ Error rate > 0.1% → Alert                                                       │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

#### Phase 4 & 5: After Stable

Only implement after Phase 3 is stable for at least 2 weeks:
- Phase 4: Asset Ownership, Auto-Assignment
- Phase 5: External Integrations (GitHub, GitLab, Azure AD)

---

#### Recommended Team Structure

| Role | Responsibility | Allocation |
|------|----------------|------------|
| **Tech Lead** | Architecture decisions, code review | 50% |
| **Backend Dev 1** | DB migrations, services, API | 100% |
| **Backend Dev 2** | Permission resolver, caching | 100% |
| **Frontend Dev** | UI components, integration | 100% |
| **QA Engineer** | Test cases, E2E tests | 50% |

#### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Permission resolution bugs | 100% test coverage, shadow mode comparison |
| Performance degradation | Caching, load testing, monitoring |
| User disruption | Feature flags, gradual rollout, instant rollback |
| Data migration issues | Dry-run on staging, backup before migration |
| Complex edge cases | Comprehensive unit tests, formal verification for critical paths |

#### Definition of Done (Each Phase)

- [ ] All code reviewed and merged
- [ ] Unit tests passing (>80% coverage, 100% for critical paths)
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Deployed to staging and tested
- [ ] Feature flag working correctly
- [ ] Rollback procedure tested

### 12.4 API Reference (Implemented)

#### Groups API

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| `GET` | `/api/v1/groups` | `groups:read` | List all groups for tenant |
| `POST` | `/api/v1/groups` | `groups:write` | Create a new group |
| `GET` | `/api/v1/groups/{id}` | `groups:read` | Get group by ID |
| `PUT` | `/api/v1/groups/{id}` | `groups:write` | Update group |
| `DELETE` | `/api/v1/groups/{id}` | `groups:delete` | Delete group |
| `GET` | `/api/v1/groups/{id}/members` | `groups:read` | List group members |
| `POST` | `/api/v1/groups/{id}/members` | `groups:members` | Add member to group |
| `DELETE` | `/api/v1/groups/{id}/members/{userId}` | `groups:members` | Remove member from group |
| `GET` | `/api/v1/groups/me` | `groups:read` | List current user's groups |

**Example: Create Group**
```bash
curl -X POST /api/v1/groups \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Security Team",
    "description": "Core security team",
    "group_type": "security_team"
  }'
```

#### Permission Sets API

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| `GET` | `/api/v1/permission-sets` | `permission_sets:read` | List all permission sets |
| `POST` | `/api/v1/permission-sets` | `permission_sets:write` | Create custom permission set |
| `GET` | `/api/v1/permission-sets/system` | `permission_sets:read` | List system permission sets only |
| `GET` | `/api/v1/permission-sets/{id}` | `permission_sets:read` | Get permission set with items |
| `PUT` | `/api/v1/permission-sets/{id}` | `permission_sets:write` | Update permission set |
| `DELETE` | `/api/v1/permission-sets/{id}` | `permission_sets:delete` | Delete permission set |
| `POST` | `/api/v1/permission-sets/{id}/permissions` | `permission_sets:write` | Add permission item |
| `DELETE` | `/api/v1/permission-sets/{id}/permissions/{permId}` | `permission_sets:write` | Remove permission item |

**Example: Create Permission Set**
```bash
curl -X POST /api/v1/permission-sets \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Security Analyst",
    "slug": "security-analyst",
    "description": "Custom security analyst role",
    "set_type": "custom",
    "items": [
      {"permission_id": "findings:read", "modification_type": "add"},
      {"permission_id": "findings:write", "modification_type": "add"}
    ]
  }'
```

#### Effective Permissions API

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| `GET` | `/api/v1/me/permissions` | Authenticated | Get current user's effective permissions |

**Example Response:**
```json
{
  "user_id": "11111111-1111-1111-1111-111111111111",
  "tenant_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "permissions": [
    "assets:read",
    "assets:write",
    "findings:read",
    "findings:write",
    "dashboard:read"
  ],
  "group_count": 2
}
```

### 12.5 Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-21 | Architecture Team | Initial version |
| 1.1 | 2026-01-21 | Architecture Team | Added Two-Layer Role Model, Performance Considerations, Implementation Strategy |
| 1.2 | 2026-01-21 | Architecture Team | Backend Phase 1, 3, 4 complete. Added Implementation Status Summary, API Reference |

---

**Document End**
