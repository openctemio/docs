---
layout: default
title: JWT Token Structure
parent: Backend Services
nav_order: 3
---

# JWT Token Structure

## Overview

OpenCTEM uses JWT (JSON Web Tokens) for authentication with a **slim tenant-scoped token plus a Redis-backed version sync**:

- **Owner/Admin** tokens carry **no permissions** — they set `admin: true` and bypass all permission checks.
- **Member/Viewer/Custom** tokens **embed** the user's permissions (resolved from RBAC roles at token issue), kept under the 4KB browser-cookie limit.
- Every token also carries a `perm_version`. A permission-sync middleware compares it against the current version in Redis and, on a mismatch, sets an `X-Permission-Stale` response header so the frontend can refresh permissions without waiting for token expiry.

## Why This Design?

### Problem with a Fat JWT
- **Large Token Size:** Embedding *all* permissions produced 2.5KB+ tokens for privileged roles
- **Cookie Limits:** Browsers limit cookies to 4KB, causing failures
- **No Real-time Updates:** Permission changes required waiting for token expiry (15 min)

### Solution: Slim token + version sync
- **Admin bypass:** Owner/Admin tokens omit permissions entirely (~500 bytes) and bypass checks via the `admin` flag
- **Scoped embedding:** Non-admin tokens embed only that user's role-derived permissions (Member ~1.5KB, Viewer ~1KB)
- **Real-time invalidation:** `perm_version` + Redis lets the backend flag a stale token (`X-Permission-Stale`) the moment a role changes

---

## Token Structure

### Access Token Claims

```json
{
  "id": "66666666-6666-6666-6666-666666666666",
  "email": "user@example.com",
  "tenant": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  "role": "admin",
  "admin": true,
  "perm_version": 7,
  "sub": "66666666-6666-6666-6666-666666666666",
  "exp": 1737589200,
  "iat": 1737588300,
  "iss": "openctem-api"
}
```

> This example is an **Admin** token, so it carries no `permissions` array (admin bypasses checks). A **Member/Viewer** token additionally includes a `"permissions": ["assets:read", ...]` array derived from the user's RBAC roles.

> **Note:** Both `"id"` (custom claim) and `"sub"` (standard JWT `RegisteredClaims.Subject`) contain the user ID. The `"id"` field is the custom claim defined on the `Claims` struct, while `"sub"` comes from the embedded `jwt.RegisteredClaims` and is set to the same value. Most application code uses `claims.UserID` (mapped from `"id"`), but `"sub"` is included for JWT standards compliance.

### Claims Description

| Claim | Type | Description |
|-------|------|-------------|
| `id` | string | User ID (UUID) - custom claim |
| `sub` | string | User ID (UUID) - standard JWT subject claim (same value as `id`) |
| `email` | string | User email address |
| `tenant` | string | Active tenant ID (UUID) |
| `role` | string | User's role name (e.g., "admin", "member") |
| `admin` | boolean | Whether user is a tenant administrator (Owner/Admin) — bypasses permission checks |
| `permissions` | string[] | Role-derived permissions — **present for Member/Viewer/Custom**, omitted for Owner/Admin |
| `perm_version` | int | Permission version stamped at issue; compared against Redis to detect a stale token |
| `exp` | int64 | Token expiration time (Unix timestamp) |
| `iat` | int64 | Token issued at time (Unix timestamp) |
| `iss` | string | Token issuer ("openctem-api") |

> **📌 Note:** For **Owner/Admin** the `permissions` array is omitted (they bypass checks via `admin: true`). For **Member/Viewer/Custom** the array **is embedded** in the token. In all cases the `perm_version` claim lets the permission-sync middleware flag a stale token (`X-Permission-Stale`) so the frontend can refresh via `GET /api/v1/me/permissions`.

---

## Token Lifecycle

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Frontend
    participant API as Backend API
    participant Redis as Redis Cache
    participant DB as PostgreSQL

    U->>UI: Login
    UI->>API: POST /auth/login
    API->>DB: Verify credentials + resolve RBAC permissions
    API->>API: Generate JWT (Admin: no perms; Member/Viewer: perms embedded) + perm_version
    API-->>UI: Access Token + Refresh Token (cookie)
    
    Note over UI,API: Later: Making authenticated request
    UI->>API: GET /api/v1/assets (with JWT)
    API->>API: Decode JWT → userID, tenantID, admin, permissions[], perm_version
    API->>Redis: Get current permission version
    alt Version matches
        API->>API: Check required permission (admin bypass, else JWT permissions[])
    else Version stale
        API-->>UI: Set X-Permission-Stale: true
        API->>Redis: Fetch fresh permissions (DB fallback)
    end
    API-->>UI: 200 OK or 403 Forbidden
```

---

## Token Sizes

Token size scales with embedded permissions; Owner/Admin carry none, so they stay small:

| Role | Permissions in token | Approx. size |
|------|----------------------|--------------|
| **Owner / Admin** | none (bypass via `admin`) | ~500 bytes |
| **Member** | ~42 role-derived permissions | ~1.5 KB |
| **Viewer** | ~25 role-derived permissions | ~1 KB |

All sizes stay under the 4KB browser-cookie limit.

---

## Token Duration

| Token Type | Duration | Storage | Renewal |
|------------|----------|---------|---------|
| **Access Token** | 15 minutes | Memory (Zustand store) | Via refresh token |
| **Refresh Token** | 7 days | HttpOnly cookie | On expiry → re-login |

---

## Security Considerations

### What's in the Token
✅ User identity (ID, email)  
✅ Tenant context (tenant ID, role)  
✅ Administrative flag (`admin`)  
✅ Permission version (`perm_version`)  
✅ Role-derived permissions — **for Member/Viewer/Custom only** (omitted for Owner/Admin)

### Why This is Secure
1. **Signed claims:** The permissions in a non-admin token are HMAC-signed and cannot be tampered with
2. **Real-time invalidation:** A `perm_version` bump flags the token stale (`X-Permission-Stale`) so the client re-fetches
3. **Admin bypass is explicit:** Owner/Admin carry no permissions and are gated by the signed `admin` flag
4. **Audit Trail:** All permission checks logged

### Token Validation
```go
// Extract claims from JWT (includes admin flag, permissions[], perm_version)
claims, err := jwt.ValidateAccessToken(accessToken)

// Admin/Owner bypass; otherwise check the permissions embedded in the token
if claims.IsAdmin {
    // allowed
} else if !slices.Contains(claims.Permissions, "assets:write") {
    return http.StatusForbidden
}

// The permission-sync middleware compares claims.perm_version against Redis and
// sets X-Permission-Stale when the two diverge.
```

---

## Real-time Permission Sync

### X-Permission-Version Header

Every authenticated API response includes the `X-Permission-Version` header. This enables real-time permission updates without WebSockets or constant polling.

**Flow:**
```
1. User makes API request
2. Backend validates JWT, fetches permissions from Redis
3. Backend includes X-Permission-Version: {timestamp} in response
4. Frontend compares with stored version
5. If different → Frontend calls GET /api/v1/me/permissions
```

**Backend Implementation:**

```go
// Middleware automatically adds header to tenant-scoped responses
func PermissionVersion(permSvc *app.PermissionService) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            userID := GetUserID(r.Context())
            tenantID := GetTenantID(r.Context())

            if userID != "" && tenantID != "" {
                version := permSvc.GetPermissionVersion(r.Context(), userID, tenantID)
                if version > 0 {
                    w.Header().Set("X-Permission-Version", strconv.FormatInt(version, 10))
                }
            }
            next.ServeHTTP(w, r)
        })
    }
}
```

**When Version Changes:**
- User's role is modified
- Permissions are assigned/removed from role
- User is removed from tenant
- `InvalidatePermissions(ctx, userID, tenantID)` is called

---

## Implementation

### Backend: JWT Generation

```go
// File: api/pkg/jwt/jwt.go

type Claims struct {
    UserID      string   `json:"id"`                      // User ID (custom claim)
    Email       string   `json:"email"`
    TenantID    string   `json:"tenant"`                  // Tenant ID
    Role        string   `json:"role"`
    IsAdmin     bool     `json:"admin"`                   // Admin flag (bypass)
    Permissions []string `json:"permissions,omitempty"`   // Embedded for Member/Viewer/Custom; omitted for Owner/Admin
    PermVersion int      `json:"perm_version,omitempty"`  // For real-time stale detection vs Redis
    jwt.RegisteredClaims                                  // Includes "sub" (set to UserID)
}

func (c *Client) GenerateTenantScopedAccessToken(
    userID, email, tenantID, role string,
    isAdmin bool,
) (string, error) {
    now := time.Now()
    claims := Claims{
        UserID:   userID,
        Email:    email,
        TenantID: tenantID,
        Role:     role,
        IsAdmin:  isAdmin,
        RegisteredClaims: jwt.RegisteredClaims{
            Subject:   userID,  // Standard "sub" claim (same as UserID)
            ExpiresAt: jwt.NewNumericDate(now.Add(c.accessTokenDuration)),
            IssuedAt:  jwt.NewNumericDate(now),
            Issuer:    "openctem-api",
        },
    }
    
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString(c.secretKey)
}
```

### Frontend: Token Storage

```typescript
// File: ui/src/stores/auth-store.ts

interface AuthState {
  accessToken: string | null  // JWT access token (memory only)
  user: AuthUser | null
  permissions: string[] | null  // Fetched from API
}

// After login: fetch permissions from API
const login = (accessToken: string) => {
  set({ accessToken, status: 'authenticated' })
  
  // Fetch permissions from /api/v1/me/permissions
  loadPermissions()
}
```

---

## Migration Notes

### Model summary
- **Owner/Admin:** no `permissions` in the token; authorized via the signed `admin` flag
- **Member/Viewer/Custom:** `permissions` embedded in the token, derived from RBAC roles
- **All roles:** carry `perm_version`; the sync middleware flags `X-Permission-Stale` on a Redis-version mismatch

### Client guidance
- Clients should read permissions from the token (non-admin) or from `GET /api/v1/me/permissions`
- On an `X-Permission-Stale: true` response, refresh permissions via `GET /api/v1/me/permissions`

---

## Related Documentation

- [Authentication Guide](../guides/authentication.md) - Full authentication flow
- [Redis Setup](../operations/redis-setup.md) - Permission cache configuration
- [Permissions Guide](../guides/permissions.md) - Permission system overview

---

## Troubleshooting

### Token Too Large Error
**Symptom:** `431 Request Header Fields Too Large`

**Solution:** Owner/Admin tokens carry no permissions (~500 bytes); Member/Viewer embed only that user's role-derived permissions (~1–1.5KB), staying under the 4KB cookie limit.

### Permissions Not Updating
**Symptom:** Permission changes don't reflect immediately

**Solution 1:** Check `X-Permission-Version` header
- Every response includes this header
- When permissions change, version is incremented
- Frontend should auto-refresh on version change

**Solution 2:** Invalidate cache manually:
```bash
redis-cli DEL "perms:{userID}:{tenantID}"
```

### Missing Permissions in Response
**Symptom:** `/api/v1/me/permissions` returns `{"permissions": []}`

**Solution:** Assign permissions to user's role in database:
```sql
INSERT INTO role_permissions (role_id, permission_id)
VALUES ('{roleID}', '{permissionID}');
```
