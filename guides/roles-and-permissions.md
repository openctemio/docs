---
layout: default
title: Roles and Permissions (Legacy)
parent: Platform Guides
nav_order: 99
---

# Roles and Permissions Guide (Legacy)

{: .warning }
> **⚠️ Deprecated**: This document describes the legacy RBAC system. For the current access control system, see **[Group-Based Access Control](./group-based-access-control.md)** which provides more granular control with Groups, Permission Sets, and Assignment Rules.

Complete guide to role-based access control (RBAC) in OpenCTEM.

---

## Overview

OpenCTEM uses a **role-based access control** system where:
- Each user belongs to one or more **Tenants** (Teams)
- Each membership has a **Role** that defines permissions
- Permissions control access to resources and actions

---

## Role Hierarchy

| Role | Priority | Permissions | Description |
|------|:--------:|:-----------:|-------------|
| **Owner** | 4 | 216 | Full control including billing and team deletion |
| **Admin** | 3 | 214 | Full resource access + member management |
| **Member** | 2 | 86 | Create and edit resources, no delete/admin access |
| **Viewer** | 1 | 66 | Read-only access |

```
       ┌───────────┐
       │   Owner   │  ← Full control + billing
       └─────┬─────┘
             │
       ┌─────▼─────┐
       │   Admin   │  ← All resources + members
       └─────┬─────┘
             │
       ┌─────▼─────┐
       │  Member   │  ← Read + Write (no delete)
       └─────┬─────┘
             │
       ┌─────▼─────┐
       │  Viewer   │  ← Read only
       └───────────┘
```

---

## Role Capabilities Summary

| Capability | Owner | Admin | Member | Viewer |
|------------|:-----:|:-----:|:------:|:------:|
| **View all resources** | ✅ | ✅ | ✅ | ✅ |
| **Create/Edit resources** | ✅ | ✅ | ✅ | ❌ |
| **Delete resources** | ✅ | ✅ | ❌ | ❌ |
| **Manage members** | ✅ | ✅ | ❌ | ❌ |
| **Invite members** | ✅ | ✅ | ❌ | ❌ |
| **Update team settings** | ✅ | ✅ | ❌ | ❌ |
| **Delete team** | ✅ | ❌ | ❌ | ❌ |
| **Manage billing** | ✅ | ❌ | ❌ | ❌ |
| **View billing** | ✅ | ✅ | ❌ | ❌ |
| **View audit logs** | ✅ | ✅ | ❌ | ❌ |

---

## Module Visibility

The sidebar navigation is filtered based on user permissions. Each module requires a specific permission to be visible.

| Module | Required Permission | Owner | Admin | Member | Viewer |
|--------|-------------------|:-----:|:-----:|:------:|:------:|
| Dashboard | `dashboard:read` | ✅ | ✅ | ✅ | ✅ |
| Assets | `assets:read` | ✅ | ✅ | ✅ | ✅ |
| Findings | `findings:read` | ✅ | ✅ | ✅ | ✅ |
| Scans | `scans:read` | ✅ | ✅ | ✅ | ✅ |
| Reports | `reports:read` | ✅ | ✅ | ✅ | ✅ |
| Integrations | `integrations:read` | ✅ | ✅ | ✅ | ✅ |
| Members | `team:members:read` | ✅ | ✅ | ✅ | ✅ |
| Roles | `team:roles:read` | ✅ | ✅ | ✅ | ✅ |
| Teams | `team:groups:read` | ✅ | ✅ | ✅ | ✅ |
| **Audit Log** | `audit:read` | ✅ | ✅ | ❌ | ❌ |
| **Billing** | `settings:billing:read` | ✅ | ✅ | ❌ | ❌ |

> **Note**: Members and Viewers cannot see Audit Log or Billing in the sidebar.
> See [Module Permission Filtering](../architecture/module-permission-filtering.md) for implementation details.

---

## Detailed Permission Matrix

### Assets & Discovery

| Permission | Owner | Admin | Member | Viewer |
|------------|:-----:|:-----:|:------:|:------:|
| `assets:read` | ✅ | ✅ | ✅ | ✅ |
| `assets:write` | ✅ | ✅ | ✅ | ❌ |
| `assets:delete` | ✅ | ✅ | ❌ | ❌ |
| `repositories:read` | ✅ | ✅ | ✅ | ✅ |
| `repositories:write` | ✅ | ✅ | ✅ | ❌ |
| `repositories:delete` | ✅ | ✅ | ❌ | ❌ |
| `components:read` | ✅ | ✅ | ✅ | ✅ |
| `components:write` | ✅ | ✅ | ✅ | ❌ |
| `components:delete` | ✅ | ✅ | ❌ | ❌ |

### Findings & Vulnerabilities

| Permission | Owner | Admin | Member | Viewer |
|------------|:-----:|:-----:|:------:|:------:|
| `findings:read` | ✅ | ✅ | ✅ | ✅ |
| `findings:write` | ✅ | ✅ | ✅ | ❌ |
| `findings:delete` | ✅ | ✅ | ❌ | ❌ |
| `vulnerabilities:read` | ✅ | ✅ | ✅ | ✅ |

### Scans & Tools

| Permission | Owner | Admin | Member | Viewer |
|------------|:-----:|:-----:|:------:|:------:|
| `scans:read` | ✅ | ✅ | ✅ | ✅ |
| `scans:write` | ✅ | ✅ | ✅ | ❌ |
| `scans:delete` | ✅ | ✅ | ❌ | ❌ |
| `tools:read` | ✅ | ✅ | ✅ | ✅ |
| `tools:write` | ✅ | ✅ | ✅ | ❌ |
| `tools:delete` | ✅ | ✅ | ❌ | ❌ |
| `workers:read` | ✅ | ✅ | ✅ | ✅ |
| `workers:write` | ✅ | ✅ | ✅ | ❌ |
| `workers:delete` | ✅ | ✅ | ❌ | ❌ |
| `pipelines:read` | ✅ | ✅ | ✅ | ✅ |
| `pipelines:write` | ✅ | ✅ | ❌ | ❌ |

### Workflows & Remediation

| Permission | Owner | Admin | Member | Viewer |
|------------|:-----:|:-----:|:------:|:------:|
| `workflows:read` | ✅ | ✅ | ✅ | ✅ |
| `workflows:write` | ✅ | ✅ | ❌ | ❌ |
| `remediation:read` | ✅ | ✅ | ✅ | ✅ |
| `remediation:write` | ✅ | ✅ | ✅ | ❌ |
| `pentest:read` | ✅ | ✅ | ✅ | ✅ |
| `pentest:write` | ✅ | ✅ | ✅ | ❌ |

### Reports & Dashboard

| Permission | Owner | Admin | Member | Viewer |
|------------|:-----:|:-----:|:------:|:------:|
| `dashboard:read` | ✅ | ✅ | ✅ | ✅ |
| `reports:read` | ✅ | ✅ | ✅ | ✅ |
| `reports:write` | ✅ | ✅ | ✅ | ❌ |
| `audit:read` | ✅ | ✅ | ❌ | ❌ |

### Team Management

| Permission | Owner | Admin | Member | Viewer |
|------------|:-----:|:-----:|:------:|:------:|
| `members:read` | ✅ | ✅ | ✅ | ✅ |
| `members:invite` | ✅ | ✅ | ❌ | ❌ |
| `members:manage` | ✅ | ✅ | ❌ | ❌ |
| `team:read` | ✅ | ✅ | ✅ | ✅ |
| `team:update` | ✅ | ✅ | ❌ | ❌ |
| `team:delete` | ✅ | ❌ | ❌ | ❌ |

### Billing & Integrations

| Permission | Owner | Admin | Member | Viewer |
|------------|:-----:|:-----:|:------:|:------:|
| `billing:read` | ✅ | ✅ | ❌ | ❌ |
| `billing:manage` | ✅ | ❌ | ❌ | ❌ |
| `integrations:read` | ✅ | ✅ | ✅ | ✅ |
| `integrations:manage` | ✅ | ✅ | ❌ | ❌ |
| `credentials:read` | ✅ | ✅ | ✅ | ✅ |
| `credentials:write` | ✅ | ✅ | ❌ | ❌ |

---

## How Permissions Work

### 1. Token Generation

When a user exchanges their refresh token for a tenant-scoped access token, the role is mapped to permissions:

```go
// Access token includes permissions array
{
    "sub": "user-id",
    "tid": "tenant-id",
    "trole": "admin",
    "permissions": ["assets:read", "assets:write", "assets:delete", ...]
}
```

### 2. API Authorization

Each API endpoint requires specific permissions:

```go
// routes.go
r.Route("/assets", func(r chi.Router) {
    r.Use(middleware.RequireAuth)

    // Read endpoints
    r.With(middleware.Require("assets:read")).Get("/", h.List)
    r.With(middleware.Require("assets:read")).Get("/{id}", h.Get)

    // Write endpoints
    r.With(middleware.Require("assets:write")).Post("/", h.Create)
    r.With(middleware.Require("assets:write")).Put("/{id}", h.Update)

    // Delete endpoints
    r.With(middleware.Require("assets:delete")).Delete("/{id}", h.Delete)
})
```

### 3. Permission Check Flow

```
Request
   │
   ▼
Auth Middleware (validate JWT)
   │
   ▼
Extract permissions from token
   │
   ▼
Require(permission) Middleware
   │
   ├── Has permission? → Allow
   │
   └── Missing? → 403 Forbidden
```

---

## Managing Roles

### Assigning Roles to New Members

1. Navigate to **Settings > Team Members**
2. Click **Invite Member**
3. Enter email address
4. Select role: Owner, Admin, Member, or Viewer
5. Click **Send Invitation**

### Changing a Member's Role

1. Go to **Settings > Team Members**
2. Find the member
3. Click the role dropdown
4. Select new role
5. Changes apply immediately

> **Note**: Only Owners and Admins can change roles. You cannot change your own role.

### Role Change Restrictions

| Action | Who Can Do It |
|--------|---------------|
| Change to Owner | Owner only |
| Change to Admin | Owner or Admin |
| Change to Member | Owner or Admin |
| Change to Viewer | Owner or Admin |
| Remove Owner | Owner only (must have another owner) |

---

## Common Role Assignments

### Development Team

| Role | Typical Members | Reason |
|------|-----------------|--------|
| Owner | Team Lead, Security Lead | Billing, team management |
| Admin | Senior Developers | Full access, can manage tools |
| Member | Developers | Create findings, run scans |
| Viewer | Junior Developers | Learn, view findings |

### Security Operations

| Role | Typical Members | Reason |
|------|-----------------|--------|
| Owner | CISO, Security Director | Budget, team control |
| Admin | Security Engineers | Configure tools, manage workflows |
| Member | Analysts | Triage findings, create remediations |
| Viewer | Auditors | Review for compliance |

### External Partners

| Role | When to Use |
|------|-------------|
| Viewer | External auditors, consultants reviewing |
| Member | Pentest team actively adding findings |

---

## Best Practices

### 1. Principle of Least Privilege

Start with Viewer role and upgrade as needed.

### 2. Limit Owners

Have 2-3 owners maximum:
- Primary owner for day-to-day
- Backup owner for emergencies

### 3. Use Member for Developers

Developers typically need:
- Read all data ✅
- Create/edit findings ✅
- Run scans ✅
- Delete data ❌ (use Admin if needed)

### 4. Regular Access Reviews

- Review member list quarterly
- Remove inactive members
- Downgrade unused admin accounts

### 5. Document Role Assignments

Keep a record of why each person has their role level.

---

## Troubleshooting

### "Insufficient Permissions" Error

1. Check your current role: **Settings > Team Members**
2. Identify required permission from error message
3. Request role upgrade from Owner/Admin

### Can't Delete Resources

You need Admin or Owner role to delete. Contact team admin.

### Can't See Audit Logs

Audit logs require Admin or Owner role.

### Can't Access Billing

Only Owner can manage billing. Contact team owner.

---

## Related Documentation

- [Module Permission Filtering](../architecture/module-permission-filtering.md) - How modules are filtered by user permissions
- [Route-Level Permission Protection](../architecture/route-level-permission-protection.md) - How routes are protected from direct URL access
- [Permission Real-time Sync](../architecture/permission-realtime-sync.md) - How permissions are synced in real-time
- [Multi-Tenancy Guide](multi-tenancy.md) - Teams and tenant switching
- [Authentication Guide](authentication.md) - Token and session management
- [API Reference](../backend/api-reference.md) - Endpoint permission requirements
