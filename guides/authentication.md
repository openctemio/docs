---
layout: default
title: Authentication & Authorization
parent: Platform Guides
nav_order: 1
---

# Authentication & Authorization System

## Overview

OpenCTEM uses a **Hybrid JWT + Redis Permission System** for authentication and authorization:

- **Authentication:** JWT tokens in httpOnly cookies (15-minute access tokens, 7-day refresh tokens)
- **Authorization:** Redis-cached permissions with database fallback
- **Multi-tenancy:** Tenant-scoped access with role-based permissions

---

## Architecture

### JWT Token Structure

**Minimal JWT Claims (200 bytes):**
```json
{
  "id": "user-123",
  "email": "user@example.com",
  "tenant": "tenant-456",
  "role": "member",
  "admin": false,
  "exp": 1706000000
}
```

**Why no permissions in JWT?**
- Token size reduced 92% (2.5KB → 200 bytes)
- Enables real-time permission updates
- Supports future growth without hitting 4KB cookie limit
- Permissions fetched from Redis cache (<1ms) instead

### Permission Caching Flow

```
┌─────────────┐
│   Request   │
└──────┬──────┘
       │
       ▼
┌──────────────┐
│  Middleware  │ Extract userId, tenantId from JWT
└──────┬───────┘
       │
       ▼
┌─────────────────────┐
│ PermissionService   │
└──────┬──────────────┘
       │
       ▼
┌──────────────┐      Cache Hit (< 1ms)
│ Redis Cache  │ ─────────────────────► Return permissions
└──────┬───────┘
       │ Cache Miss
       ▼
┌──────────────┐      Load from DB (< 50ms)
│  PostgreSQL  │      Cache for 15 minutes
└──────────────┘      Return permissions
```

**Cache Key Format:** `perms:{userId}:{tenantId}`  
**TTL:** 15 minutes (matches access token duration)

---

## Authentication Providers

### Local Authentication (Email/Password)
- JWT-based authentication
- Password hashing with bcrypt
- Email verification required
- Session management with refresh tokens

### OIDC/Keycloak (Enterprise)
- Single Sign-On (SSO)
- External identity providers
- Automatic user provisioning
- Token validation with JWKS

### Hybrid Mode
- Support both local and OIDC
- Automatic provider detection
- Unified authentication flow

---

## Authorization Model

### Role-Based Access Control (RBAC)

**Tenant Roles:**
- **Owner:** Full control, including billing and tenant deletion
- **Admin:** Manage members, settings, all resources
- **Member:** Read/write access to resources
- **Viewer:** Read-only access
- **Custom:** Flexible RBAC roles with custom permissions

**Role Hierarchy:** `viewer < member < admin < owner`

### Permission System

**Permissions are resource-scoped:**
```
{resource}:{action}

Examples:
- assets:read
- assets:write
- assets:delete
- findings:read
- findings:update
- members:manage
```

**Permission Check Flow:**
1. Extract `userId` and `tenantId` from JWT
2. Check Redis cache: `GET perms:{userId}:{tenantId}`
3. If cache hit: Return cached permissions (<1ms)
4. If cache miss: Load from database, cache, return  (<50ms)
5. Verify permission in list
6. Allow/Deny request

**No Admin Bypass:**
All users (including admins) go through explicit permission checks. This ensures:
- Audit trail for all actions
- Granular permission control
- Compliance with security policies

---

## API Endpoints

### Authentication

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}

Response:
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_at": "2026-01-23T04:00:00Z",
  "tenants": [...]
}
```

### Get Current User

```http
GET /api/v1/users/me
Authorization: Bearer {token}

Response:
{
  "id": "user-123",
  "email": "user@example.com",
  "name": "John Doe",
  "status": "active"
}
```

### Get User Permissions

```http
GET /api/v1/users/me/permissions
Authorization: Bearer {token}

Response:
{
  "permissions": ["assets:read", "assets:write", "findings:read"],
  "tenant_id": "tenant-456",
  "cached_at": "2026-01-23T03:45:00Z"
}
```

---

## Frontend Integration

### Permission Checks

```typescript
import { usePermissions } from '@/lib/permissions'

function MyComponent() {
  const { can, isRole, isAtLeast } = usePermissions()
  
  return (
    <div>
      {can('assets:write') && <CreateAssetButton />}
      {isRole('owner') && <DeleteTenantButton />}
      {isAtLeast('admin') && <AdminPanel />}
    </div>
  )
}
```

### Permission Gate Component

```tsx
import { PermissionGate } from '@/features/auth'

<PermissionGate permission="assets:delete">
  <DeleteButton />
</PermissionGate>

<PermissionGate permissions={['assets:write', 'assets:delete']} requireAll>
  <AdminActions />
</PermissionGate>
```

---

## Cache Invalidation

### When to Invalidate

**Invalidate user permissions when:**
- User role changes in tenant
- User is removed from tenant
- Custom permissions updated
- User deleted

**Invalidation Methods:**

```go
// Invalidate specific user in tenant
permissionService.InvalidateUserPermissionsCache(ctx, userID, tenantID)

// Invalidate all user permissions across all tenants
permissionService.InvalidateAllUserPermissionsCache(ctx, userID)
```

**Automatic Cache Refresh:**
- TTL: 15 minutes (matches access token)
- Permissions auto-refresh on token refresh
- Cache miss triggers DB load + re-cache

---

## Security Considerations

### Token Storage
- ✅ **Access tokens:** Memory only (Zustand store), never in localStorage
- ✅ **Refresh tokens:** HttpOnly cookies, server-side only
- ✅ **Automatic refresh:** Before token expiry
- ✅ **Secure flags:** SameSite=Lax, Secure (HTTPS only)

### Permission Checks
- ✅ **Backend validation:** All API endpoints validate permissions
- ✅ **Frontend checks:** UI visibility only, not security boundary
- ✅ **Audit logging:** All permission checks logged
- ✅ **Cache security:** Redis protected, no client access

### Rate Limiting
- Login attempts: 5 per minute per IP
- Permission API: 100 per minute per user
- Token refresh: 10 per minute per user

---

## Performance Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Token size | < 500 bytes | ~200 bytes |
| Permission check (cached) | < 5ms | < 1ms |
| Permission check (DB fallback) | < 100ms | < 50ms |
| Cache hit rate | > 90% | ~95% |
| Token generation | < 10ms | < 5ms |

---

## Monitoring

### Key Metrics

**Redis:**
```bash
# Cache hit rate
redis-cli INFO stats | grep keyspace_hits
redis-cli INFO stats | grep keyspace_misses

# Active keys
redis-cli DBSIZE

# Memory usage
redis-cli INFO memory | grep used_memory_human
```

**API:**
- Permission check latency (p50, p95, p99)
- Cache hit/miss ratio
- Failed authentication attempts
- Token refresh rate

### Alerts

- Cache hit rate < 85% (10 minutes)
- Permission check p95 > 10ms
- Failed auth attempts > 100/minute
- Redis connection failures

---

## Migration from Old System

**Old System:** Permissions embedded in JWT (2.5KB tokens)  
**New System:** Hybrid JWT + Redis (200 byte tokens)

**Backward Compatibility:**
- Frontend falls back to role-based permissions if API unavailable
- Gradual rollout with feature flags
- No database schema changes required

**Rollout Plan:**
1. Deploy backend with cache (flag OFF)
2. Enable for 10% traffic
3. Monitor for 1 week
4. Gradual rollout: 25% → 50% → 100%
5. Remove old permission middleware

---

## Troubleshooting

### Permission Denied Despite Correct Role

**Check:**
1. Is Redis running? `redis-cli PING`
2. Are permissions cached? `redis-cli KEYS "perms:*"`
3. Check logs for cache errors
4. Verify tenant membership in database

**Debug:**
```bash
# Check cached permissions
redis-cli GET "perms:user-123:tenant-456"

# Check TTL
redis-cli TTL "perms:user-123:tenant-456"

# Manually invalidate
redis-cli DEL "perms:user-123:tenant-456"
```

### Token Too Large

**Should not happen anymore** - tokens are ~200 bytes

If still occurring:
- Check JWT claims structure
- Verify permissions NOT in token
- Check `Tenants` array size (should be minimal)

### Permission Not Updating

**Possible causes:**
1. Cache not invalidated after role change
2. Using old token (not refreshed)
3. Frontend using stale role-based fallback

**Solutions:**
1. Invalidate cache on role change
2. Force token refresh
3. Call `/users/me/permissions` API

---

## References

- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [Redis Caching Patterns](https://redis.io/docs/manual/patterns/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
