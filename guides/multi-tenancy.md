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

What happens depends on [who may create organizations](#who-can-create-organizations):

```
admin_only (default):  Login → No tenants → "Ask your administrator" page
self_service:          Login → No tenants → Redirect to Create Team → Team created → Dashboard
```

Under `admin_only` a user gets into an organization only by being added to one:
an invitation, an account created by an organization owner or admin, SSO
just-in-time provisioning, or SCIM.

### Case 2: Single Tenant

```
Login → 1 tenant → Auto-select → Exchange token → Dashboard
```

### Case 3: Multiple Tenants

```
Login → Multiple tenants → Show selector → User picks → Exchange token → Dashboard
```

---

## Who Can Create Organizations

`TENANT_CREATION_MODE` (API environment variable; Helm value
`api.tenantCreationMode`) decides who may create an organization:

| Mode | Who creates organizations |
|------|---------------------------|
| `admin_only` **(default)** | Only the platform administrator: in the admin console (`/admin` → **Organizations** → **Create**), or with the `bootstrap-admin` organization flags at install time. `POST /api/v1/auth/create-first-team` and `POST /api/v1/tenants` return 403. |
| `self_service` | Any signed-in user. A user with no organization gets the Create Team page; a user who already belongs to one can create more. The creator becomes the **Owner**. Use it only for SaaS or trial installs. |

Changing the mode does not affect existing organizations. An invalid value stops
the API at startup. See [Getting Started](./getting-started.md#2-first-time-setup)
for how the first organization is created on a new install.

## Create First Team

Only in `self_service` mode. A signed-in user without a team uses this flow:

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
https://your-domain.com/{tenant-slug}/dashboard
https://your-domain.com/{tenant-slug}/assets
```

### 3. Last Selected Tenant
Store the last selected tenant for faster access. There is no seeded "default"
tenant: every organization is created by the platform administrator (or, in
`self_service` mode, by a user).

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
