---
layout: default
title: Multi-Tenancy
parent: Platform Guides
nav_order: 2
---
# Multi-Tenancy Guide

Guide to multi-tenant architecture in the OpenCTEM CTEM Platform.

---

## Overview

OpenCTEM uses a **multi-tenant architecture** with:
- **Tenant** (API) = **Team** (UI)
- Each user can belong to multiple tenants
- Each tenant has isolated data
- Access tokens are scoped to a specific tenant

---

## Tenant Model

```
┌───────────────────────────────────────────────────────────┐
│                        User                                │
│  - id, email, name                                        │
│  - Can belong to multiple tenants                         │
└───────────────────────────┬───────────────────────────────┘
                            │
                            │ TenantMember (junction table)
                            │ - user_id, tenant_id, role
                            │
┌───────────────────────────┴───────────────────────────────┐
│                       Tenant                               │
│  - id, name, slug                                         │
│  - All data (assets, findings, etc) belongs to tenant     │
└───────────────────────────────────────────────────────────┘
```

---

## Tenant Roles

| Role | Priority | Capabilities |
|------|:--------:|--------------|
| **Owner** | 4 | Full control, billing, delete tenant |
| **Admin** | 3 | Manage members, all resources |
| **Member** | 2 | Create/edit resources |
| **Viewer** | 1 | Read-only access |

Details: [Permissions Matrix](./permissions.md)

---

## Tenant Selection Flow

### Case 1: No Tenants (New User)

```
Login → No tenants → Redirect to Create Team → Team created → Dashboard
```

### Case 2: Single Tenant

```
Login → 1 tenant → Auto-select → Exchange token → Dashboard
```

### Case 3: Multiple Tenants

```
Login → Multiple tenants → Show selector → User picks → Exchange token → Dashboard
```

---

## Create First Team

New users registering without a team use this flow:

```
POST /api/v1/auth/create-first-team
Cookie: refresh_token=<token>
{
  "team_name": "My Company",
  "team_slug": "my-company"
}
```

Response:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "tenant_id": "uuid",
  "tenant_slug": "my-company",
  "tenant_name": "My Company",
  "role": "owner"
}
```

---

## Tenant Switching

To switch to a different tenant:

1. Call `/api/v1/auth/token` with the new tenant_id
2. Update cookies
3. Reload or navigate

```typescript
// Frontend
async function switchTenant(tenantId: string) {
  const result = await selectTenantAction(tenantId)
  if (result.success) {
    router.refresh() // Reload with new tenant
  }
}
```

---

## Token-Based Tenant Scoping

The access token contains the `tenant_id`:

```json
{
  "sub": "user-id",
  "tid": "tenant-id",      // <- Tenant ID in token
  "tslug": "team-slug",
  "trole": "owner",
  ...
}
```

**Security benefits:**
- Prevents IDOR (accessing other tenant's data)
- Backend extracts tenant from token, not from URL
- Token exchange requires valid membership

---

## Data Isolation

OpenCTEM implements **Defense in Depth** with 3 layers of tenant isolation:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DEFENSE IN DEPTH - TENANT ISOLATION                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Layer 1: SQL WHERE clause (Code-level)                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  SELECT * FROM findings WHERE id = $1 AND tenant_id = $2            │   │
│  │  Go compiler enforces tenantID parameter in repository interfaces   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Layer 2: PostgreSQL RLS (Database-level safety net)                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  CREATE POLICY tenant_isolation ON findings                          │   │
│  │    USING (tenant_id = current_tenant_id())                          │   │
│  │  Even if code forgets WHERE clause, RLS blocks cross-tenant access  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Layer 3: Composite Indexes (Performance)                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  CREATE INDEX idx_findings_tenant_id_pk ON findings(tenant_id, id)  │   │
│  │  Optimized query performance for tenant-scoped queries               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Protected Tables

| Table | RLS Policy | Index |
|-------|------------|-------|
| `findings` | ✅ `tenant_isolation_findings` | `(tenant_id, id)` |
| `assets` | ✅ `tenant_isolation_assets` | `(tenant_id, id)` |
| `scans` | ✅ `tenant_isolation_scans` | `(tenant_id, id)` |
| `agents` | ✅ `tenant_isolation_agents` | `(tenant_id, id)` |
| `integrations` | ✅ `tenant_isolation_integrations` | `(tenant_id, id)` |
| `exposure_events` | ✅ `tenant_isolation_exposures` | `(tenant_id, id)` |
| `suppression_rules` | ✅ `tenant_isolation_suppression_rules` | `(tenant_id, id)` |
| `finding_activities` | ✅ `tenant_isolation_finding_activities` | `(tenant_id, finding_id)` |

### Middleware

The `RequireTenant()` middleware validates that the token has a valid `tenant_id`.

{: .note }
> See [Tenant Isolation & RLS Architecture](../architecture/tenant-isolation-security.md) for complete technical details including RLS setup, platform admin bypass, and production configuration.

---

## Invitation System

### Invite Flow

1. Admin/Owner creates invitation
2. Email sent with invitation link
3. Invitee clicks link
4. Preview shown (public endpoint)
5. Login/Register required
6. Accept invitation
7. User added to tenant

### Invitation Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| POST | `/tenants/{t}/invitations` | Admin+ | Create invitation |
| GET | `/invitations/{token}/preview` | ❌ | Preview (public) |
| POST | `/invitations/{token}/decline` | ❌ | Decline (public) |
| GET | `/invitations/{token}` | ✅ | Get details |
| POST | `/invitations/{token}/accept` | ✅ | Accept |

---

## Tenant Settings

### General Settings
- Name, slug, description
- Admin+ can update

### Branding Settings
- Logo, colors
- Admin+ can update

### Security Settings
- MFA, IP whitelist
- **Owner only**

### API Settings
- API keys, webhooks
- **Owner only**

---

## Best Practices

### 1. Token Exchange Pattern
Always exchange tokens when switching context:
```
refresh_token + tenant_id → access_token
```

### 2. URL Structure
Use tenant slug in URLs for SEO and UX:
```
https://app.openctem.io/{tenant-slug}/dashboard
https://app.openctem.io/{tenant-slug}/assets
```

### 3. Default Tenant
Store last selected tenant for faster access.

### 4. Membership Check
Always validate membership before operations:
```go
middleware.RequireMembership(tenantRepo)
```

---

## Related Documentation

- [Tenant Isolation & RLS Architecture](../architecture/tenant-isolation-security.md) - Technical deep-dive
- [Authentication Guide](./authentication.md)
- [Permissions Matrix](./permissions.md)
- [API Reference](../backend/api-reference.md)
