---
layout: default
title: Permission Real-time Synchronization
parent: Architecture
nav_order: 22
---

# Permission Real-time Synchronization

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
3. [Current Architecture Analysis](#3-current-architecture-analysis)
4. [Solution Design](#4-solution-design)
5. [Detailed Implementation Plan](#5-detailed-implementation-plan)
6. [API Specification](#6-api-specification)
7. [Migration Strategy](#7-migration-strategy)
8. [Testing Plan](#8-testing-plan)
9. [Rollback Plan](#9-rollback-plan)
10. [Timeline & Milestones](#10-timeline--milestones)

---

## 1. Executive Summary

### 1.1 Overview

This document outlines the implementation plan for a real-time permission synchronization system. The goal is to ensure that when an administrator grants or revokes permissions, the affected user's UI and API access are updated immediately without requiring a logout/login cycle.

### 1.2 Key Objectives

| Objective | Description |
|-----------|-------------|
| **Real-time Updates** | Permission changes reflect within seconds, not minutes |
| **Optimal JWT Size** | JWT token stays under 500 bytes regardless of permission count |
| **Zero Loading State** | No loading spinner on initial app load |
| **Graceful UX** | Users are notified when their permissions change |
| **Backward Compatible** | Existing sessions continue to work during migration |

### 1.3 Key Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Permission update delay | 15 minutes (token TTL) | < 5 seconds |
| JWT token size (custom roles) | 3-5 KB | ~400 bytes |
| Initial load time | Instant | Instant (no regression) |
| API overhead per request | 0ms | < 1ms (Redis lookup) |

---

## 2. Problem Statement

### 2.1 Current Issues

#### Issue 1: Stale Permissions in JWT

When an admin revokes a user's permission:
- The user's JWT still contains the old permissions
- UI shows features the user no longer has access to
- API calls return 403 errors
- User must logout and login to get updated permissions

```
Timeline (Current):
───────────────────────────────────────────────────────────────────
00:00  User login, JWT contains: [assets:read, assets:write, billing:read]
00:05  Admin revokes billing:read
00:05  User JWT still has billing:read ← STALE
00:10  User clicks Billing → 403 Forbidden (confusing!)
00:15  Token expires, user refreshes
00:15  New JWT has: [assets:read, assets:write] ← Finally updated
───────────────────────────────────────────────────────────────────
```

#### Issue 2: JWT Size Exceeds Cookie Limit

```
┌─────────────────────────────────────────────────────────────────┐
│                    JWT SIZE ANALYSIS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Total permissions in system: 105                                │
│  Average permission string: 20.6 characters                      │
│  Browser cookie limit: ~4,096 bytes                              │
│                                                                  │
│  ┌──────────────────┬──────────┬────────────┬─────────────────┐ │
│  │ User Type        │ Perms    │ Token Size │ Status          │ │
│  ├──────────────────┼──────────┼────────────┼─────────────────┤ │
│  │ Owner/Admin      │ 0 (bypass)│ ~500 B    │ ✅ OK           │ │
│  │ Member (default) │ ~42      │ ~1.5 KB   │ ✅ OK           │ │
│  │ Viewer           │ ~25      │ ~1 KB     │ ✅ OK           │ │
│  │ Custom Role (few)│ ~60      │ ~2.5 KB   │ ⚠️ Near limit   │ │
│  │ Custom Role (many)│ 80-105  │ ~3-5 KB   │ ❌ EXCEEDS!     │ │
│  └──────────────────┴──────────┴────────────┴─────────────────┘ │
│                                                                  │
│  Problem: Custom roles with 80+ permissions exceed cookie limit  │
│  Result: Cookie silently rejected → User cannot authenticate     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Issue 3: Hardcoded Admin Bypass

Current implementation uses a hack to keep JWT small for admin users:

```go
// Current: Hardcoded bypass for owner/admin
func HasPermission(ctx context.Context, permission string) bool {
    if IsAdmin(ctx) {
        return true  // ← Bypass ALL permission checks
    }
    // ... check permissions array
}
```

**Problems with this approach:**
- Cannot have "admin without billing access"
- Cannot limit owner to specific features
- Inflexible for enterprise requirements
- It's a workaround, not proper design

### 2.2 User Impact

| Scenario | Current Experience | Desired Experience |
|----------|-------------------|-------------------|
| Permission revoked | UI shows feature, API returns 403 | Feature disappears from UI |
| Permission granted | Must re-login to see new feature | Feature appears automatically |
| Custom role assigned | May fail to login (token too large) | Works normally |
| Role definition updated | No effect until re-login | All affected users updated |

---

## 3. Current Architecture Analysis

### 3.1 Authentication Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                    CURRENT AUTHENTICATION FLOW                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────┐     ┌─────────────┐     ┌─────────────────────────────┐ │
│  │  Login  │────▶│  Generate   │────▶│  JWT Token (Large)          │ │
│  │         │     │  JWT        │     │  {                          │ │
│  └─────────┘     └─────────────┘     │    id, email, tenant_id,    │ │
│                        │             │    role,                    │ │
│                        │             │    permissions: [...105],   │ │
│                        ▼             │    isAdmin: true/false      │ │
│                  ┌─────────────┐     │  }                          │ │
│                  │  Store in   │     │  Size: 500B - 5KB           │ │
│                  │  Cookie     │     └─────────────────────────────┘ │
│                  └─────────────┘                                     │
│                        │                                             │
│                        ▼                                             │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    API REQUEST                                │   │
│  │  1. Read JWT from cookie                                      │   │
│  │  2. Validate JWT signature                                    │   │
│  │  3. Extract permissions from JWT claims                       │   │
│  │  4. If IsAdmin=true → bypass all checks                      │   │
│  │  5. Else → check permissions array                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  Problem: Permissions are STATIC until token refresh (15 min)        │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 Existing Infrastructure

| Component | Status | Details |
|-----------|--------|---------|
| **Redis Cache** | ✅ Available | Production-ready, TTL support, pattern delete |
| **Background Jobs** | ✅ Available | Polling scheduler, outbox pattern |
| **Token Refresh** | ✅ Available | Auto-refresh 5 min before expiry |
| **WebSocket** | ❌ Not Available | Would require new infrastructure |
| **Event System** | ✅ Available | Transactional outbox, 20+ event types |

### 3.3 Permission Storage Locations

| Location | Current Use | Size Limit |
|----------|-------------|------------|
| JWT Token | Permissions array | ~4KB (cookie) |
| PostgreSQL | Source of truth (user_roles, role_permissions) | Unlimited |
| Redis | Not used for permissions | Unlimited |
| Frontend Store | Cached from JWT | Memory only |
| localStorage | Not used | ~5-10MB |

---

## 4. Solution Design

### 4.1 Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                       NEW ARCHITECTURE                                  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  JWT Token (SLIM - Fixed ~400 bytes):                                  │
│  ┌─────────────────────────────────────────┐                           │
│  │ {                                        │                           │
│  │   "id": "user-uuid",                    │                           │
│  │   "email": "user@example.com",          │                           │
│  │   "tid": "tenant-uuid",                 │                           │
│  │   "role": "member",                     │  ← For display only       │
│  │   "pv": 5                               │  ← Permission version     │
│  │ }                                        │                           │
│  │                                          │                           │
│  │ ❌ NO permissions array                  │                           │
│  │ ❌ NO isAdmin flag                       │                           │
│  └─────────────────────────────────────────┘                           │
│                                                                         │
│                          │                                              │
│                          ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    BACKEND (Per Request)                         │   │
│  │                                                                  │   │
│  │   1. Validate JWT                                                │   │
│  │   2. Compare JWT.pv with Redis permission_version                │   │
│  │   3. If mismatch → Set X-Permission-Stale header                │   │
│  │   4. Fetch permissions from Redis cache (or DB fallback)        │   │
│  │   5. Check permission from fetched list                         │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                          │                                              │
│                          ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    FRONTEND                                      │   │
│  │                                                                  │   │
│  │   Storage: localStorage                                          │   │
│  │   ┌─────────────────────────────────────┐                       │   │
│  │   │ {                                    │                       │   │
│  │   │   "version": 5,                     │                       │   │
│  │   │   "permissions": ["asset:read",...],│                       │   │
│  │   │   "updatedAt": 1706123456789        │                       │   │
│  │   │ }                                    │                       │   │
│  │   └─────────────────────────────────────┘                       │   │
│  │                                                                  │   │
│  │   Sync Triggers:                                                 │   │
│  │   • X-Permission-Stale header detected (immediate)              │   │
│  │   • 403 Forbidden response (immediate)                          │   │
│  │   • Tab focus event (only if hidden > 30s)                      │   │
│  │   • 2-minute polling interval                                    │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Permission Version Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                    PERMISSION VERSION FLOW                              │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  STEP 1: Admin Changes User Role                                       │
│  ════════════════════════════════                                      │
│                                                                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐           │
│  │ Admin UI     │────▶│ Role Service │────▶│ Redis        │           │
│  │ Revoke Role  │     │ RemoveRole() │     │ INCR pv:t:u  │           │
│  └──────────────┘     └──────────────┘     │ (5 → 6)      │           │
│                                             └──────────────┘           │
│                                                    │                    │
│                                                    ▼                    │
│                                             ┌──────────────┐           │
│                                             │ Invalidate   │           │
│                                             │ Perm Cache   │           │
│                                             └──────────────┘           │
│                                                                         │
│  STEP 2: User Makes API Request                                        │
│  ══════════════════════════════                                        │
│                                                                         │
│  ┌──────────────┐     ┌──────────────────────────────────────────┐    │
│  │ User Request │────▶│ Permission Middleware                     │    │
│  │ JWT.pv = 5   │     │                                           │    │
│  └──────────────┘     │  1. Get Redis pv → 6                      │    │
│                       │  2. Compare: JWT.pv(5) ≠ Redis.pv(6)     │    │
│                       │  3. Set Header: X-Permission-Stale: true │    │
│                       │  4. Fetch permissions from Redis/DB       │    │
│                       │  5. Check permission → Allow/Deny         │    │
│                       └──────────────────────────────────────────┘    │
│                                         │                               │
│                                         ▼                               │
│  STEP 3: Frontend Detects Stale                                        │
│  ══════════════════════════════                                        │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ API Response Interceptor                                          │  │
│  │                                                                   │  │
│  │  if (headers['x-permission-stale'] === 'true') {                 │  │
│  │    // Trigger immediate permission refresh                        │  │
│  │    window.dispatchEvent(new Event('permission:stale'))           │  │
│  │  }                                                                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                         │                               │
│                                         ▼                               │
│  STEP 4: Frontend Refreshes Permissions                                │
│  ══════════════════════════════════════                                │
│                                                                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐           │
│  │ Permission   │────▶│ GET /me/     │────▶│ Update       │           │
│  │ Provider     │     │ permissions  │     │ localStorage │           │
│  └──────────────┘     └──────────────┘     │ + State      │           │
│                                             └──────────────┘           │
│                                                    │                    │
│                                                    ▼                    │
│                                             ┌──────────────┐           │
│                                             │ Re-render UI │           │
│                                             │ + Show Toast │           │
│                                             └──────────────┘           │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Data Flow Comparison

| Aspect | Current | New |
|--------|---------|-----|
| **Permission Source (Backend)** | JWT claims | Redis cache → DB fallback |
| **Permission Source (Frontend)** | JWT claims in store | localStorage + API |
| **Version Tracking** | None | Redis `perm_ver:{tenant}:{user}` |
| **Stale Detection** | None | JWT.pv vs Redis.pv comparison |
| **Update Trigger** | Token refresh only | Header + Events + Polling |
| **Admin Bypass** | `IsAdmin=true` flag | No bypass, same flow for all |

### 4.4 Redis Key Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                       REDIS KEY STRUCTURE                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Permission Version (per user per tenant):                          │
│  ────────────────────────────────────────                           │
│  Key:    perm_ver:{tenant_id}:{user_id}                             │
│  Value:  integer (auto-increment)                                    │
│  TTL:    30 days                                                     │
│  Example: perm_ver:tenant-abc:user-123 = 5                          │
│                                                                      │
│  Permission Cache (per user per tenant):                            │
│  ───────────────────────────────────────                            │
│  Key:    user_perms:{tenant_id}:{user_id}                           │
│  Value:  JSON array of permission strings                           │
│  TTL:    5 minutes                                                   │
│  Example: user_perms:tenant-abc:user-123 =                          │
│           ["assets:read","assets:write","findings:read"]            │
│                                                                      │
│  Operations:                                                         │
│  ───────────                                                         │
│  • On role change: INCR perm_ver + DEL user_perms                   │
│  • On role update: INCR perm_ver for all affected users             │
│  • On API request: GET perm_ver (compare with JWT.pv)               │
│  • On permission check: GET user_perms (or fetch from DB)           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Detailed Implementation Plan

### 5.1 Phase 1: Backend - Permission Version System

**Duration:** 2-3 days
**Risk Level:** Low
**Breaking Changes:** None

#### 5.1.1 Permission Version Service

**File:** `api/internal/app/permission_version_service.go`

```go
package app

import (
    "context"
    "fmt"
    "time"

    "github.com/openctemio/api/internal/infra/redis"
    "github.com/openctemio/api/pkg/logger"
)

// PermissionVersionService manages permission version tracking in Redis.
// Version is incremented whenever a user's permissions change (role assigned/removed).
// This enables real-time permission synchronization without embedding permissions in JWT.
type PermissionVersionService struct {
    cache  *redis.Cache[int]
    logger *logger.Logger
}

const (
    permVersionPrefix = "perm_ver"
    permVersionTTL    = 30 * 24 * time.Hour // 30 days
)

// NewPermissionVersionService creates a new permission version service.
func NewPermissionVersionService(redisClient *redis.Client, logger *logger.Logger) *PermissionVersionService {
    cache := redis.NewCache[int](redisClient, permVersionPrefix)
    return &PermissionVersionService{
        cache:  cache,
        logger: logger.With("service", "permission_version"),
    }
}

// cacheKey generates the Redis key for a user's permission version.
func (s *PermissionVersionService) cacheKey(tenantID, userID string) string {
    return fmt.Sprintf("%s:%s", tenantID, userID)
}

// Get returns the current permission version for a user.
// Returns 1 if no version is set (new user).
func (s *PermissionVersionService) Get(ctx context.Context, tenantID, userID string) int {
    key := s.cacheKey(tenantID, userID)
    version, err := s.cache.Get(ctx, key)
    if err != nil || version == nil {
        return 1 // Default version for new users
    }
    return *version
}

// Increment increments the permission version for a user.
// Called when roles are assigned, removed, or modified.
// Returns the new version number.
func (s *PermissionVersionService) Increment(ctx context.Context, tenantID, userID string) int {
    key := s.cacheKey(tenantID, userID)
    current := s.Get(ctx, tenantID, userID)
    newVersion := current + 1

    if err := s.cache.SetWithTTL(ctx, key, newVersion, permVersionTTL); err != nil {
        s.logger.Error("failed to set permission version",
            "tenant_id", tenantID,
            "user_id", userID,
            "error", err,
        )
        return current // Return old version on error
    }

    s.logger.Info("permission version incremented",
        "tenant_id", tenantID,
        "user_id", userID,
        "old_version", current,
        "new_version", newVersion,
    )

    return newVersion
}

// IncrementForUsers increments permission version for multiple users.
// Used when a role definition is updated (affects all users with that role).
func (s *PermissionVersionService) IncrementForUsers(ctx context.Context, tenantID string, userIDs []string) {
    for _, userID := range userIDs {
        s.Increment(ctx, tenantID, userID)
    }

    s.logger.Info("permission versions incremented for users",
        "tenant_id", tenantID,
        "user_count", len(userIDs),
    )
}

// Set sets the permission version for a user to a specific value.
// Used during token generation to include current version in JWT.
func (s *PermissionVersionService) Set(ctx context.Context, tenantID, userID string, version int) error {
    key := s.cacheKey(tenantID, userID)
    return s.cache.SetWithTTL(ctx, key, version, permVersionTTL)
}
```

#### 5.1.2 Permission Cache Service

**File:** `api/internal/app/permission_cache_service.go`

```go
package app

import (
    "context"
    "fmt"
    "time"

    "github.com/openctemio/api/internal/domain/role"
    "github.com/openctemio/api/internal/infra/redis"
    "github.com/openctemio/api/pkg/logger"
)

// PermissionCacheService provides cached access to user permissions.
// Permissions are cached in Redis with a short TTL for performance.
// On cache miss, permissions are fetched from the database.
type PermissionCacheService struct {
    cache       *redis.Cache[[]string]
    roleRepo    role.Repository
    versionSvc  *PermissionVersionService
    logger      *logger.Logger
}

const (
    permCachePrefix = "user_perms"
    permCacheTTL    = 5 * time.Minute
)

// NewPermissionCacheService creates a new permission cache service.
func NewPermissionCacheService(
    redisClient *redis.Client,
    roleRepo role.Repository,
    versionSvc *PermissionVersionService,
    logger *logger.Logger,
) *PermissionCacheService {
    cache := redis.NewCache[[]string](redisClient, permCachePrefix)
    return &PermissionCacheService{
        cache:      cache,
        roleRepo:   roleRepo,
        versionSvc: versionSvc,
        logger:     logger.With("service", "permission_cache"),
    }
}

// cacheKey generates the Redis key for a user's permissions.
func (s *PermissionCacheService) cacheKey(tenantID, userID string) string {
    return fmt.Sprintf("%s:%s", tenantID, userID)
}

// GetPermissions returns the permissions for a user.
// First checks Redis cache, then falls back to database.
func (s *PermissionCacheService) GetPermissions(ctx context.Context, tenantID, userID string) ([]string, error) {
    key := s.cacheKey(tenantID, userID)

    // Try cache first
    cached, err := s.cache.Get(ctx, key)
    if err == nil && cached != nil {
        return *cached, nil
    }

    // Cache miss - fetch from database
    tid, err := role.ParseID(tenantID)
    if err != nil {
        return nil, fmt.Errorf("invalid tenant id: %w", err)
    }
    uid, err := role.ParseID(userID)
    if err != nil {
        return nil, fmt.Errorf("invalid user id: %w", err)
    }

    permissions, err := s.roleRepo.GetUserPermissions(ctx, tid, uid)
    if err != nil {
        return nil, fmt.Errorf("failed to get permissions from db: %w", err)
    }

    // Store in cache
    if cacheErr := s.cache.SetWithTTL(ctx, key, permissions, permCacheTTL); cacheErr != nil {
        s.logger.Warn("failed to cache permissions",
            "tenant_id", tenantID,
            "user_id", userID,
            "error", cacheErr,
        )
    }

    return permissions, nil
}

// Invalidate removes the cached permissions for a user.
// Called when roles are changed.
func (s *PermissionCacheService) Invalidate(ctx context.Context, tenantID, userID string) {
    key := s.cacheKey(tenantID, userID)
    if err := s.cache.Delete(ctx, key); err != nil {
        s.logger.Warn("failed to invalidate permission cache",
            "tenant_id", tenantID,
            "user_id", userID,
            "error", err,
        )
    }
}

// InvalidateForTenant removes cached permissions for all users in a tenant.
// Called when a role definition is updated.
func (s *PermissionCacheService) InvalidateForTenant(ctx context.Context, tenantID string) {
    pattern := fmt.Sprintf("%s:*", tenantID)
    if err := s.cache.DeletePattern(ctx, pattern); err != nil {
        s.logger.Warn("failed to invalidate tenant permission cache",
            "tenant_id", tenantID,
            "error", err,
        )
    }
}

// HasPermission checks if a user has a specific permission.
func (s *PermissionCacheService) HasPermission(ctx context.Context, tenantID, userID, permission string) (bool, error) {
    permissions, err := s.GetPermissions(ctx, tenantID, userID)
    if err != nil {
        return false, err
    }

    for _, p := range permissions {
        if p == permission {
            return true, nil
        }
    }
    return false, nil
}
```

#### 5.1.3 Update JWT Claims

**File:** `api/pkg/jwt/jwt.go`

```go
// Claims represents the JWT claims structure.
// UPDATED: Removed Permissions and IsAdmin fields.
// Permissions are now fetched from Redis/DB on each request.
type Claims struct {
    // User identification
    UserID    string    `json:"id"`
    Email     string    `json:"email"`
    Name      string    `json:"name,omitempty"`
    SessionID string    `json:"sid,omitempty"`
    TokenType TokenType `json:"typ,omitempty"`

    // Tenant context
    TenantID   string `json:"tid,omitempty"`
    TenantSlug string `json:"tslug,omitempty"`
    Role       string `json:"role,omitempty"` // For display purposes only

    // Permission version for sync (NEW)
    PermVersion int `json:"pv,omitempty"`

    // REMOVED - No longer in JWT:
    // Permissions []string `json:"permissions,omitempty"`
    // IsAdmin     bool     `json:"admin,omitempty"`

    jwt.RegisteredClaims
}

// GenerateSlimAccessToken creates an access token without permissions.
// Permissions are fetched server-side on each request.
func (g *Generator) GenerateSlimAccessToken(
    userID, email, name, sessionID string,
    tenant TenantMembership,
    permVersion int,
) (*TenantScopedAccessToken, error) {
    if userID == "" {
        return nil, ErrEmptyUserID
    }

    now := time.Now()
    expiresAt := now.Add(g.config.AccessTokenDuration)

    claims := Claims{
        UserID:      userID,
        Email:       email,
        Name:        name,
        SessionID:   sessionID,
        TokenType:   TokenTypeAccess,
        TenantID:    tenant.TenantID,
        TenantSlug:  tenant.TenantSlug,
        Role:        tenant.Role,
        PermVersion: permVersion,
        RegisteredClaims: jwt.RegisteredClaims{
            Issuer:    g.config.Issuer,
            Subject:   userID,
            ExpiresAt: jwt.NewNumericDate(expiresAt),
            IssuedAt:  jwt.NewNumericDate(now),
            NotBefore: jwt.NewNumericDate(now),
        },
    }

    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    signedToken, err := token.SignedString([]byte(g.config.Secret))
    if err != nil {
        return nil, err
    }

    return &TenantScopedAccessToken{
        AccessToken: signedToken,
        TenantID:    tenant.TenantID,
        TenantSlug:  tenant.TenantSlug,
        Role:        tenant.Role,
        ExpiresAt:   expiresAt,
    }, nil
}
```

#### 5.1.4 Permission Middleware

**File:** `api/internal/infra/http/middleware/permission_middleware.go`

```go
package middleware

import (
    "context"
    "net/http"
    "slices"
    "strconv"

    "github.com/openctemio/api/internal/app"
    "github.com/openctemio/api/internal/domain/permission"
    "github.com/openctemio/api/pkg/apierror"
    "github.com/openctemio/api/pkg/logger"
)

// PermissionMiddleware handles permission checking using Redis cache.
type PermissionMiddleware struct {
    permCache   *app.PermissionCacheService
    permVersion *app.PermissionVersionService
    logger      *logger.Logger
}

// NewPermissionMiddleware creates a new permission middleware.
func NewPermissionMiddleware(
    permCache *app.PermissionCacheService,
    permVersion *app.PermissionVersionService,
    logger *logger.Logger,
) *PermissionMiddleware {
    return &PermissionMiddleware{
        permCache:   permCache,
        permVersion: permVersion,
        logger:      logger.With("middleware", "permission"),
    }
}

// EnrichPermissions fetches permissions and adds them to the request context.
// Also checks for stale permissions and sets the X-Permission-Stale header.
func (m *PermissionMiddleware) EnrichPermissions(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        ctx := r.Context()
        claims := GetLocalClaims(ctx)

        if claims == nil || claims.TenantID == "" || claims.UserID == "" {
            next.ServeHTTP(w, r)
            return
        }

        // Check if JWT permission version matches current version in Redis
        currentVersion := m.permVersion.Get(ctx, claims.TenantID, claims.UserID)
        if claims.PermVersion != currentVersion {
            // Set header to notify frontend that permissions are stale
            w.Header().Set("X-Permission-Stale", "true")
            w.Header().Set("X-Permission-Version", strconv.Itoa(currentVersion))

            m.logger.Debug("stale permission detected",
                "user_id", claims.UserID,
                "jwt_version", claims.PermVersion,
                "current_version", currentVersion,
            )
        }

        // Fetch permissions from cache/DB
        permissions, err := m.permCache.GetPermissions(ctx, claims.TenantID, claims.UserID)
        if err != nil {
            m.logger.Warn("failed to get permissions",
                "user_id", claims.UserID,
                "error", err,
            )
            permissions = []string{} // Empty permissions on error
        }

        // Set permissions in context for handlers
        ctx = context.WithValue(ctx, PermissionsKey, permissions)

        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

// HasPermission checks if the current user has a specific permission.
// NO LONGER has admin bypass - all users go through the same check.
func HasPermission(ctx context.Context, perm string) bool {
    permissions := GetPermissions(ctx)
    return slices.Contains(permissions, perm)
}

// HasAnyPermission checks if the user has any of the specified permissions.
func HasAnyPermission(ctx context.Context, perms ...string) bool {
    permissions := GetPermissions(ctx)
    for _, p := range perms {
        if slices.Contains(permissions, p) {
            return true
        }
    }
    return false
}

// HasAllPermissions checks if the user has all specified permissions.
func HasAllPermissions(ctx context.Context, perms ...string) bool {
    permissions := GetPermissions(ctx)
    for _, p := range perms {
        if !slices.Contains(permissions, p) {
            return false
        }
    }
    return true
}

// Require creates middleware that requires a specific permission.
func (m *PermissionMiddleware) Require(perm permission.Permission) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            if !HasPermission(r.Context(), perm.String()) {
                apierror.Forbidden("Insufficient permissions").WriteJSON(w)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}

// RequireAny creates middleware that requires any of the specified permissions.
func (m *PermissionMiddleware) RequireAny(perms ...permission.Permission) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            permStrings := make([]string, len(perms))
            for i, p := range perms {
                permStrings[i] = p.String()
            }
            if !HasAnyPermission(r.Context(), permStrings...) {
                apierror.Forbidden("Insufficient permissions").WriteJSON(w)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}

// RequireAll creates middleware that requires all specified permissions.
func (m *PermissionMiddleware) RequireAll(perms ...permission.Permission) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            permStrings := make([]string, len(perms))
            for i, p := range perms {
                permStrings[i] = p.String()
            }
            if !HasAllPermissions(r.Context(), permStrings...) {
                apierror.Forbidden("Insufficient permissions").WriteJSON(w)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}
```

#### 5.1.5 Update Role Service

**File:** `api/internal/app/role_service.go` (additions)

```go
// Add to RoleService struct
type RoleService struct {
    // ... existing fields
    permVersion *PermissionVersionService
    permCache   *PermissionCacheService
}

// Update AssignRole
func (s *RoleService) AssignRole(ctx context.Context, input AssignRoleInput) error {
    // ... existing logic ...

    // Invalidate permission version and cache
    s.permVersion.Increment(ctx, input.TenantID, input.UserID)
    s.permCache.Invalidate(ctx, input.TenantID, input.UserID)

    // ... audit logging ...
    return nil
}

// Update RemoveRole
func (s *RoleService) RemoveRole(ctx context.Context, tenantID, userID, roleID string) error {
    // ... existing logic ...

    // Invalidate permission version and cache
    s.permVersion.Increment(ctx, tenantID, userID)
    s.permCache.Invalidate(ctx, tenantID, userID)

    // ... audit logging ...
    return nil
}

// Update SetUserRoles
func (s *RoleService) SetUserRoles(ctx context.Context, input SetUserRolesInput) error {
    // ... existing logic ...

    // Invalidate permission version and cache
    s.permVersion.Increment(ctx, input.TenantID, input.UserID)
    s.permCache.Invalidate(ctx, input.TenantID, input.UserID)

    // ... audit logging ...
    return nil
}

// Update UpdateRole (affects all users with this role)
func (s *RoleService) UpdateRole(ctx context.Context, input UpdateRoleInput) error {
    // ... existing logic ...

    // Get all users with this role
    userIDs, err := s.roleRepo.GetUserIDsWithRole(ctx, input.TenantID, input.RoleID)
    if err != nil {
        s.logger.Warn("failed to get users with role for cache invalidation", "error", err)
    } else {
        // Invalidate all affected users
        s.permVersion.IncrementForUsers(ctx, input.TenantID, userIDs)
        s.permCache.InvalidateForTenant(ctx, input.TenantID)
    }

    // ... audit logging ...
    return nil
}
```

### 5.2 Phase 2: Backend - Permission Endpoint

**Duration:** 1 day
**Risk Level:** Low
**Breaking Changes:** None (new endpoint)

#### 5.2.1 Permission Handler

**File:** `api/internal/infra/http/handler/permission_handler.go`

```go
package handler

import (
    "encoding/json"
    "fmt"
    "net/http"
    "strconv"
    "strings"

    "github.com/openctemio/api/internal/app"
    "github.com/openctemio/api/internal/infra/http/middleware"
    "github.com/openctemio/api/pkg/apierror"
    "github.com/openctemio/api/pkg/logger"
)

// PermissionHandler handles permission-related HTTP requests.
type PermissionHandler struct {
    roleService    *app.RoleService
    permVersion    *app.PermissionVersionService
    permCache      *app.PermissionCacheService
    logger         *logger.Logger
}

// NewPermissionHandler creates a new permission handler.
func NewPermissionHandler(
    roleService *app.RoleService,
    permVersion *app.PermissionVersionService,
    permCache *app.PermissionCacheService,
    logger *logger.Logger,
) *PermissionHandler {
    return &PermissionHandler{
        roleService: roleService,
        permVersion: permVersion,
        permCache:   permCache,
        logger:      logger.With("handler", "permission"),
    }
}

// GetMyPermissionsResponse is the response for GET /me/permissions.
type GetMyPermissionsResponse struct {
    Permissions []string `json:"permissions"`
    Version     int      `json:"version"`
}

// GetMyPermissions handles GET /api/v1/me/permissions.
// Returns the current user's permissions and version.
// Supports conditional requests via If-None-Match header or version query param.
//
// @Summary      Get my permissions
// @Description  Returns the current user's permissions with version for caching
// @Tags         Permissions
// @Produce      json
// @Param        v           query     int     false  "Client's current version (for conditional request)"
// @Param        If-None-Match header   string  false  "Client's current version as ETag"
// @Success      200  {object}  GetMyPermissionsResponse
// @Success      304  "Not Modified - permissions haven't changed"
// @Failure      401  {object}  apierror.APIError
// @Failure      500  {object}  apierror.APIError
// @Security     BearerAuth
// @Router       /me/permissions [get]
func (h *PermissionHandler) GetMyPermissions(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    tenantID := middleware.MustGetTenantID(ctx)
    userID := middleware.GetUserID(ctx)

    if tenantID == "" || userID == "" {
        apierror.Unauthorized("Authentication required").WriteJSON(w)
        return
    }

    // Get current permission version
    currentVersion := h.permVersion.Get(ctx, tenantID, userID)

    // Check for conditional request (If-None-Match header or query param)
    clientVersion := 0

    // Check ETag header first
    if etag := r.Header.Get("If-None-Match"); etag != "" {
        // ETag format: "5" or W/"5"
        etag = strings.Trim(etag, `"`)
        etag = strings.TrimPrefix(etag, "W/")
        clientVersion, _ = strconv.Atoi(etag)
    }

    // Also check query param as fallback
    if clientVersion == 0 {
        if v := r.URL.Query().Get("v"); v != "" {
            clientVersion, _ = strconv.Atoi(v)
        }
    }

    // If client version matches current version, return 304 Not Modified
    if clientVersion > 0 && clientVersion == currentVersion {
        w.Header().Set("ETag", fmt.Sprintf(`"%d"`, currentVersion))
        w.Header().Set("Cache-Control", "private, max-age=60")
        w.WriteHeader(http.StatusNotModified)
        return
    }

    // Fetch permissions
    permissions, err := h.permCache.GetPermissions(ctx, tenantID, userID)
    if err != nil {
        h.logger.Error("failed to get permissions",
            "tenant_id", tenantID,
            "user_id", userID,
            "error", err,
        )
        apierror.InternalError(err).WriteJSON(w)
        return
    }

    // Set caching headers
    w.Header().Set("ETag", fmt.Sprintf(`"%d"`, currentVersion))
    w.Header().Set("Cache-Control", "private, max-age=60")
    w.Header().Set("Content-Type", "application/json")

    response := GetMyPermissionsResponse{
        Permissions: permissions,
        Version:     currentVersion,
    }

    json.NewEncoder(w).Encode(response)
}
```

#### 5.2.2 Route Registration

**File:** `api/internal/infra/http/routes.go` (addition)

```go
// In the authenticated routes section
r.Route("/me", func(r chi.Router) {
    // ... existing routes ...

    // Permission endpoint
    r.Get("/permissions", permissionHandler.GetMyPermissions)
})
```

### 5.3 Phase 3: Frontend - Permission Provider

**Duration:** 2-3 days
**Risk Level:** Medium
**Breaking Changes:** Requires updating components using permissions

#### 5.3.1 Permission Storage Utility

**File:** `ui/src/lib/permission-storage.ts`

```typescript
/**
 * Permission Storage Utility
 *
 * Manages permission storage in localStorage with versioning.
 * Provides instant access to permissions without API calls.
 */

interface StoredPermissions {
  permissions: string[]
  version: number
  tenantId: string
  updatedAt: number
}

const STORAGE_KEY_PREFIX = 'user_permissions'
const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Generate storage key for a tenant
 */
function getStorageKey(tenantId: string): string {
  return `${STORAGE_KEY_PREFIX}:${tenantId}`
}

export const permissionStorage = {
  /**
   * Get stored permissions for a tenant
   * Returns null if not found or expired
   */
  get(tenantId: string): StoredPermissions | null {
    if (typeof window === 'undefined') return null

    try {
      const raw = localStorage.getItem(getStorageKey(tenantId))
      if (!raw) return null

      const data: StoredPermissions = JSON.parse(raw)

      // Check if expired (24 hours max age)
      if (Date.now() - data.updatedAt > MAX_AGE_MS) {
        this.clear(tenantId)
        return null
      }

      return data
    } catch (error) {
      console.warn('[PermissionStorage] Failed to get permissions:', error)
      return null
    }
  },

  /**
   * Store permissions for a tenant
   */
  set(tenantId: string, permissions: string[], version: number): void {
    if (typeof window === 'undefined') return

    try {
      const data: StoredPermissions = {
        permissions,
        version,
        tenantId,
        updatedAt: Date.now(),
      }
      localStorage.setItem(getStorageKey(tenantId), JSON.stringify(data))
    } catch (error) {
      console.warn('[PermissionStorage] Failed to set permissions:', error)
    }
  },

  /**
   * Get the stored version for a tenant
   * Returns 0 if not found
   */
  getVersion(tenantId: string): number {
    return this.get(tenantId)?.version || 0
  },

  /**
   * Get the stored permissions array for a tenant
   * Returns empty array if not found
   */
  getPermissions(tenantId: string): string[] {
    return this.get(tenantId)?.permissions || []
  },

  /**
   * Clear stored permissions for a tenant
   */
  clear(tenantId: string): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.removeItem(getStorageKey(tenantId))
    } catch (error) {
      console.warn('[PermissionStorage] Failed to clear permissions:', error)
    }
  },

  /**
   * Clear all stored permissions (all tenants)
   */
  clearAll(): void {
    if (typeof window === 'undefined') return

    try {
      const keys = Object.keys(localStorage).filter((key) =>
        key.startsWith(STORAGE_KEY_PREFIX)
      )
      keys.forEach((key) => localStorage.removeItem(key))
    } catch (error) {
      console.warn('[PermissionStorage] Failed to clear all permissions:', error)
    }
  },
}
```

#### 5.3.2 Permission Provider

**File:** `ui/src/context/permission-provider.tsx`

```typescript
/**
 * Permission Provider
 *
 * Manages permission state with real-time synchronization.
 *
 * Features:
 * - Instant render from localStorage (no loading state)
 * - Background sync via polling and events
 * - Automatic refresh on stale detection
 * - Toast notification on permission changes
 */

'use client'

import * as React from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { useTenant } from '@/context/tenant-provider'
import { permissionStorage } from '@/lib/permission-storage'
import { toast } from 'sonner'

// ============================================
// TYPES
// ============================================

interface PermissionContextValue {
  /** Array of permission strings */
  permissions: string[]
  /** Current permission version */
  version: number
  /** True during initial fetch (no cached permissions) */
  isLoading: boolean
  /** Check if user has a specific permission */
  hasPermission: (permission: string) => boolean
  /** Check if user has any of the specified permissions */
  hasAnyPermission: (permissions: string[]) => boolean
  /** Check if user has all specified permissions */
  hasAllPermissions: (permissions: string[]) => boolean
  /** Manually refresh permissions from API */
  refreshPermissions: () => Promise<void>
}

interface PermissionApiResponse {
  permissions: string[]
  version: number
}

// ============================================
// CONTEXT
// ============================================

const PermissionContext = React.createContext<PermissionContextValue | null>(null)

// ============================================
// CONSTANTS
// ============================================

const POLLING_INTERVAL_MS = 2 * 60 * 1000 // 2 minutes
const MIN_FETCH_INTERVAL_MS = 5000 // 5 second debounce for rapid calls
const MIN_HIDDEN_DURATION_FOR_SYNC_MS = 30 * 1000 // 30 seconds - min time tab must be hidden before sync on focus

// ============================================
// PROVIDER
// ============================================

interface PermissionProviderProps {
  children: React.ReactNode
}

export function PermissionProvider({ children }: PermissionProviderProps) {
  const user = useAuthStore((state) => state.user)
  const { currentTenant } = useTenant()
  const tenantId = currentTenant?.id || ''

  // ----------------------------------------
  // State
  // ----------------------------------------

  // Initialize from localStorage for instant render
  const [permissions, setPermissions] = React.useState<string[]>(() => {
    if (!tenantId) return []
    return permissionStorage.getPermissions(tenantId)
  })

  const [version, setVersion] = React.useState<number>(() => {
    if (!tenantId) return 0
    return permissionStorage.getVersion(tenantId)
  })

  const [isLoading, setIsLoading] = React.useState(() => {
    // Only loading if we have a tenant but no cached permissions
    if (!tenantId) return false
    return permissionStorage.get(tenantId) === null
  })

  const [isInitialized, setIsInitialized] = React.useState(false)
  const fetchInProgressRef = React.useRef(false)
  const lastFetchRef = React.useRef(0)
  const tabHiddenAtRef = React.useRef(0) // Track when tab was hidden
  const etagRef = React.useRef<string | null>(null) // ETag for conditional requests

  // ----------------------------------------
  // Fetch Permissions from API
  // ----------------------------------------

  const fetchPermissions = React.useCallback(
    async (options?: { skipVersionCheck?: boolean }) => {
      if (!tenantId || !user) return
      if (fetchInProgressRef.current) return

      // Debounce: Skip if fetched recently (unless forced)
      const now = Date.now()
      if (!options?.skipVersionCheck && lastFetchRef.current > 0) {
        const timeSinceLastFetch = now - lastFetchRef.current
        if (timeSinceLastFetch < MIN_FETCH_INTERVAL_MS) {
          console.log(`[PermissionProvider] Skipping fetch - last fetch was ${timeSinceLastFetch}ms ago`)
          return
        }
      }
      lastFetchRef.current = now

      fetchInProgressRef.current = true

      try {
        const headers: Record<string, string> = {}

        // Use conditional request if we have an ETag (unless skipVersionCheck)
        if (!options?.skipVersionCheck && etagRef.current) {
          headers['If-None-Match'] = etagRef.current
        }

        const response = await fetch('/api/v1/me/permissions', {
          credentials: 'include',
          headers,
        })

        // 304 Not Modified - permissions haven't changed
        if (response.status === 304) {
          return
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch permissions: ${response.status}`)
        }

        const data: PermissionApiResponse = await response.json()

        // Check if permissions actually changed
        const oldPermsKey = [...permissions].sort().join(',')
        const newPermsKey = [...data.permissions].sort().join(',')
        const hasChanged = oldPermsKey !== newPermsKey

        if (hasChanged) {
          // Update state
          setPermissions(data.permissions)
          setVersion(data.version)

          // Persist to localStorage
          permissionStorage.set(tenantId, data.permissions, data.version)

          // Notify user (only after initial load)
          if (isInitialized) {
            toast.info('Your permissions have been updated', {
              description: 'The page will reflect your new access level.',
              duration: 4000,
            })
          }

          console.log('[PermissionProvider] Permissions updated', {
            oldVersion: version,
            newVersion: data.version,
            addedPerms: data.permissions.filter((p) => !permissions.includes(p)),
            removedPerms: permissions.filter((p) => !data.permissions.includes(p)),
          })
        } else if (data.version !== version) {
          // Version changed but permissions same - just update version
          setVersion(data.version)
          permissionStorage.set(tenantId, data.permissions, data.version)
        }
      } catch (error) {
        console.error('[PermissionProvider] Failed to fetch permissions:', error)
      } finally {
        fetchInProgressRef.current = false
      }
    },
    [tenantId, user, version, permissions, isInitialized]
  )

  // ----------------------------------------
  // Initial Load
  // ----------------------------------------

  React.useEffect(() => {
    if (!tenantId || !user) {
      setPermissions([])
      setVersion(0)
      setIsLoading(false)
      return
    }

    const stored = permissionStorage.get(tenantId)

    if (stored) {
      // Have cached permissions - use them immediately
      setPermissions(stored.permissions)
      setVersion(stored.version)
      setIsLoading(false)
      setIsInitialized(true)

      // Background fetch to check for updates
      fetchPermissions()
    } else {
      // No cache - must fetch (show loading only if truly loading)
      setIsLoading(true)
      fetchPermissions({ skipVersionCheck: true }).finally(() => {
        setIsLoading(false)
        setIsInitialized(true)
      })
    }
  }, [tenantId, user?.id]) // Note: intentionally not including fetchPermissions

  // ----------------------------------------
  // Polling
  // ----------------------------------------

  React.useEffect(() => {
    if (!tenantId || !user || !isInitialized) return

    const interval = setInterval(() => {
      fetchPermissions()
    }, POLLING_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [tenantId, user, isInitialized, fetchPermissions])

  // ----------------------------------------
  // Focus Event (only sync if tab was hidden > 30 seconds)
  // ----------------------------------------

  React.useEffect(() => {
    if (!tenantId || !user || !isInitialized) return

    // Track when tab becomes hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabHiddenAtRef.current = Date.now()
      }
    }

    // Only sync if tab was hidden for a significant period
    const handleFocus = () => {
      const hiddenDuration = tabHiddenAtRef.current > 0
        ? Date.now() - tabHiddenAtRef.current
        : 0

      if (hiddenDuration >= MIN_HIDDEN_DURATION_FOR_SYNC_MS) {
        fetchPermissions()
      }
      tabHiddenAtRef.current = 0
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [tenantId, user, isInitialized, fetchPermissions])

  // ----------------------------------------
  // Stale Permission Event (from API interceptor)
  // ----------------------------------------

  React.useEffect(() => {
    const handleStale = () => {
      console.log('[PermissionProvider] Stale permission detected, refreshing...')
      fetchPermissions({ skipVersionCheck: true })
    }

    window.addEventListener('permission:stale', handleStale)
    return () => window.removeEventListener('permission:stale', handleStale)
  }, [fetchPermissions])

  // ----------------------------------------
  // Permission Check Functions
  // ----------------------------------------

  const hasPermission = React.useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions]
  )

  const hasAnyPermission = React.useCallback(
    (perms: string[]) => perms.some((p) => permissions.includes(p)),
    [permissions]
  )

  const hasAllPermissions = React.useCallback(
    (perms: string[]) => perms.every((p) => permissions.includes(p)),
    [permissions]
  )

  const refreshPermissions = React.useCallback(async () => {
    await fetchPermissions({ skipVersionCheck: true })
  }, [fetchPermissions])

  // ----------------------------------------
  // Context Value
  // ----------------------------------------

  const value = React.useMemo<PermissionContextValue>(
    () => ({
      permissions,
      version,
      isLoading,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      refreshPermissions,
    }),
    [
      permissions,
      version,
      isLoading,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      refreshPermissions,
    ]
  )

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  )
}

// ============================================
// HOOKS
// ============================================

/**
 * Use the permission context
 * Must be used within PermissionProvider
 */
export function usePermissions(): PermissionContextValue {
  const context = React.useContext(PermissionContext)
  if (!context) {
    throw new Error('usePermissions must be used within PermissionProvider')
  }
  return context
}

/**
 * Check if user has a specific permission
 */
export function useHasPermission(permission: string): boolean {
  const { hasPermission } = usePermissions()
  return hasPermission(permission)
}

/**
 * Check if user has any of the specified permissions
 */
export function useHasAnyPermission(permissions: string[]): boolean {
  const { hasAnyPermission } = usePermissions()
  return hasAnyPermission(permissions)
}

/**
 * Check if user has all specified permissions
 */
export function useHasAllPermissions(permissions: string[]): boolean {
  const { hasAllPermissions } = usePermissions()
  return hasAllPermissions(permissions)
}

/**
 * Get the raw permissions array
 */
export function useUserPermissions(): string[] {
  const { permissions } = usePermissions()
  return permissions
}

/**
 * Check if permissions are still loading
 */
export function usePermissionsLoading(): boolean {
  const { isLoading } = usePermissions()
  return isLoading
}
```

#### 5.3.3 API Client Interceptor

**File:** `ui/src/lib/api/api-client.ts` (addition)

```typescript
// Add to existing API client configuration

/**
 * Response interceptor for permission stale detection
 */
apiClient.interceptors.response.use(
  (response) => {
    // Check for stale permission header
    const permissionStale = response.headers['x-permission-stale']
    if (permissionStale === 'true') {
      console.log('[API Client] Permission stale header detected')

      // Dispatch event for PermissionProvider to handle
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('permission:stale'))
      }
    }
    return response
  },
  (error) => {
    // Handle 403 Forbidden - might indicate permission revocation
    if (error.response?.status === 403) {
      const errorCode = error.response?.data?.code

      // If it's a permission error, trigger refresh
      if (
        errorCode === 'PERMISSION_DENIED' ||
        errorCode === 'INSUFFICIENT_PERMISSIONS' ||
        errorCode === 'FORBIDDEN'
      ) {
        console.log('[API Client] Permission denied, triggering refresh')

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('permission:stale'))
        }
      }
    }

    return Promise.reject(error)
  }
)
```

#### 5.3.4 Permission Gate Component

**File:** `ui/src/components/permission-gate.tsx`

```typescript
/**
 * Permission Gate Component
 *
 * Conditionally renders children based on user permissions.
 *
 * Modes:
 * - 'hide': Completely hides content if user lacks permission
 * - 'disable': Shows content but disabled with tooltip
 *
 * @example
 * // Hide if no permission
 * <PermissionGate permission="assets:write">
 *   <CreateAssetButton />
 * </PermissionGate>
 *
 * // Disable if no permission
 * <PermissionGate permission="assets:delete" mode="disable">
 *   <DeleteButton />
 * </PermissionGate>
 *
 * // Multiple permissions (any)
 * <PermissionGate permissions={['assets:write', 'assets:delete']}>
 *   <ManageAssets />
 * </PermissionGate>
 */

'use client'

import * as React from 'react'
import {
  useHasPermission,
  useHasAnyPermission,
  useHasAllPermissions,
  usePermissionsLoading,
} from '@/context/permission-provider'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface PermissionGateProps {
  /** Single permission to check */
  permission?: string
  /** Multiple permissions to check */
  permissions?: string[]
  /** If true, requires ALL permissions; if false, requires ANY (default: false) */
  requireAll?: boolean
  /** How to handle lack of permission: 'hide' removes from DOM, 'disable' shows disabled */
  mode?: 'hide' | 'disable'
  /** Content to show when hidden (only for mode='hide') */
  fallback?: React.ReactNode
  /** Tooltip message when disabled */
  disabledMessage?: string
  /** Children to render */
  children: React.ReactNode
}

export function PermissionGate({
  permission,
  permissions,
  requireAll = false,
  mode = 'hide',
  fallback = null,
  disabledMessage = 'You do not have permission to perform this action',
  children,
}: PermissionGateProps) {
  const isLoading = usePermissionsLoading()

  // Determine if user has access
  let hasAccess = false

  if (permission) {
    // Single permission check
    // eslint-disable-next-line react-hooks/rules-of-hooks
    hasAccess = useHasPermission(permission)
  } else if (permissions && permissions.length > 0) {
    // Multiple permissions check
    if (requireAll) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      hasAccess = useHasAllPermissions(permissions)
    } else {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      hasAccess = useHasAnyPermission(permissions)
    }
  } else {
    // No permission specified - allow access
    hasAccess = true
  }

  // During loading, show children (optimistic)
  if (isLoading) {
    return <>{children}</>
  }

  // Has access - render children
  if (hasAccess) {
    return <>{children}</>
  }

  // No access - handle based on mode
  if (mode === 'disable') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-block cursor-not-allowed">
            <div
              className="pointer-events-none select-none opacity-50"
              aria-disabled="true"
            >
              {children}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{disabledMessage}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  // Hide mode - return fallback or null
  return <>{fallback}</>
}

/**
 * Resource-based permission gate
 *
 * @example
 * <ResourceGate resource="assets" action="write">
 *   <EditButton />
 * </ResourceGate>
 */
export function ResourceGate({
  resource,
  action,
  ...props
}: Omit<PermissionGateProps, 'permission'> & {
  resource: string
  action: 'read' | 'write' | 'delete'
}) {
  return <PermissionGate permission={`${resource}:${action}`} {...props} />
}
```

### 5.4 Phase 4: Integration & Cleanup

**Duration:** 1-2 days
**Risk Level:** Medium
**Breaking Changes:** Updates to existing components

#### 5.4.1 Update App Providers

**File:** `ui/src/app/providers.tsx`

```typescript
import { PermissionProvider } from '@/context/permission-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <DirectionProvider>
        <TenantProvider>
          <PermissionProvider>
            {/* ... other providers */}
            {children}
          </PermissionProvider>
        </TenantProvider>
      </DirectionProvider>
    </ThemeProvider>
  )
}
```

#### 5.4.2 Update Auth Actions

**File:** `ui/src/features/auth/actions/local-auth-actions.ts`

```typescript
// After successful login, fetch and store permissions
export async function loginAction(input: LoginInput) {
  // ... existing login logic ...

  // Fetch permissions after login
  try {
    const permRes = await fetch('/api/v1/me/permissions', {
      credentials: 'include',
    })

    if (permRes.ok) {
      const data = await permRes.json()
      permissionStorage.set(input.tenant_id, data.permissions, data.version)
    }
  } catch (error) {
    console.warn('[Login] Failed to fetch initial permissions:', error)
  }

  // ... redirect ...
}

// Clear permissions on logout
export async function logoutAction() {
  permissionStorage.clearAll()
  // ... existing logout logic ...
}
```

#### 5.4.3 Update Tenant Switching

**File:** `ui/src/context/tenant-provider.tsx`

```typescript
const switchTeam = async (tenantId: string) => {
  // Clear old tenant's permissions
  if (currentTenant?.id) {
    permissionStorage.clear(currentTenant.id)
  }

  // ... existing switch logic ...

  // After successful switch, permissions will be fetched by PermissionProvider
  // due to tenantId change
}
```

#### 5.4.4 Remove Old Permission Logic

- Remove `permissions` from JWT parsing in auth store
- Remove `isAdmin` bypass logic from old middleware
- Update components using `user.permissions` to use `usePermissions()` hook

---

## 6. API Specification

### 6.1 GET /api/v1/me/permissions/sync

Returns the current user's permissions with version for caching.

**Request:**

```http
GET /api/v1/me/permissions/sync HTTP/1.1
Authorization: Bearer <access_token>
If-None-Match: "5"
```

**Response (200 OK):**

```json
{
  "permissions": [
    "assets:read",
    "assets:write",
    "findings:read",
    "findings:write",
    "team:members:read"
  ],
  "version": 6
}
```

**Response Headers:**

```
ETag: "6"
Cache-Control: private, max-age=60
```

**Response (304 Not Modified):**

When client's version matches server's version:

```
HTTP/1.1 304 Not Modified
ETag: "5"
```

### 6.2 Response Headers

All authenticated API responses may include:

| Header | Description |
|--------|-------------|
| `X-Permission-Stale: true` | JWT permission version doesn't match current |
| `X-Permission-Version: 6` | Current permission version |

---

## 7. Migration Strategy

### 7.1 Backward Compatibility

During migration, both old and new systems work simultaneously:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     MIGRATION PHASES                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Phase A: Deploy Backend (Version Check + New Endpoint)             │
│  ─────────────────────────────────────────────────────              │
│  • JWT still contains permissions (backward compatible)             │
│  • New version field added to JWT                                   │
│  • Permission middleware checks Redis version                        │
│  • X-Permission-Stale header set when stale                         │
│  • New /me/permissions endpoint available                           │
│                                                                      │
│  Phase B: Deploy Frontend (Permission Provider)                     │
│  ─────────────────────────────────────────────────                  │
│  • PermissionProvider fetches from API                              │
│  • localStorage cache for instant render                            │
│  • Old components still work (read from store)                      │
│                                                                      │
│  Phase C: Migrate Components                                        │
│  ───────────────────────────                                        │
│  • Update components to use usePermissions() hook                   │
│  • Remove old permission logic                                      │
│                                                                      │
│  Phase D: Remove Old Code                                           │
│  ────────────────────────                                           │
│  • Remove permissions from JWT generation                           │
│  • Remove IsAdmin bypass                                            │
│  • Remove old permission checks                                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Feature Flags

```go
// config/config.go
type FeatureFlags struct {
    UseServerSidePermissions bool `env:"FF_SERVER_SIDE_PERMISSIONS" envDefault:"false"`
    IncludePermissionsInJWT  bool `env:"FF_JWT_PERMISSIONS" envDefault:"true"`
}
```

### 7.3 Rollback Triggers

| Condition | Action |
|-----------|--------|
| Redis unavailable > 5 min | Fall back to JWT permissions |
| Permission check latency > 100ms | Alert, investigate |
| Error rate > 1% | Consider rollback |
| User reports > 10 | Pause rollout, investigate |

---

## 8. Testing Plan

### 8.1 Unit Tests

| Component | Test Cases |
|-----------|------------|
| PermissionVersionService | Get, Increment, IncrementForUsers |
| PermissionCacheService | GetPermissions (cache hit/miss), Invalidate |
| Permission Middleware | Stale detection, Header setting |
| Permission Provider | Initial load, Refresh, Event handling |

### 8.2 Integration Tests

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Permission Revoke | 1. User logged in<br>2. Admin revokes role<br>3. User makes API call | X-Permission-Stale header set |
| Permission Grant | 1. User logged in<br>2. Admin grants role<br>3. User makes API call | New permissions in /me/permissions |
| Role Update | 1. Multiple users have role<br>2. Admin updates role permissions<br>3. All users make API calls | All users see stale header |

### 8.3 E2E Tests

| Test | Description |
|------|-------------|
| Login Flow | User logs in, permissions stored in localStorage |
| Permission Revoke Flow | Admin revokes, user sees UI update |
| Permission Grant Flow | Admin grants, user sees new feature |
| Team Switch | User switches team, permissions update |

### 8.4 Performance Tests

| Metric | Target | Test Method |
|--------|--------|-------------|
| Redis GET latency | < 1ms | Load test with 1000 concurrent users |
| /me/permissions latency | < 50ms | API benchmark |
| UI re-render time | < 100ms | React profiler |

---

## 9. Rollback Plan

### 9.1 Rollback Procedure

```
┌─────────────────────────────────────────────────────────────────────┐
│                       ROLLBACK PROCEDURE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Step 1: Set Feature Flag                                           │
│  ────────────────────────                                           │
│  FF_SERVER_SIDE_PERMISSIONS=false                                   │
│  FF_JWT_PERMISSIONS=true                                            │
│                                                                      │
│  Step 2: Deploy Backend                                             │
│  ──────────────────────                                             │
│  • Permission middleware falls back to JWT claims                   │
│  • Token generation includes permissions array                      │
│                                                                      │
│  Step 3: Deploy Frontend (Optional)                                 │
│  ─────────────────────────────────                                  │
│  • Revert to previous version                                       │
│  • Or: PermissionProvider falls back to auth store                  │
│                                                                      │
│  Step 4: Clear Redis Cache                                          │
│  ────────────────────────                                           │
│  redis-cli KEYS "perm_ver:*" | xargs redis-cli DEL                  │
│  redis-cli KEYS "user_perms:*" | xargs redis-cli DEL                │
│                                                                      │
│  Step 5: Monitor                                                    │
│  ───────────                                                        │
│  • Check error rates                                                │
│  • Verify user login flow                                           │
│  • Confirm permissions working                                      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.2 Data Cleanup

No database migrations required - rollback is configuration-only.

---

## 10. Implementation Status

### 10.1 Completed Implementation

All phases have been implemented:

| Phase | Status | Files Created/Modified |
|-------|--------|------------------------|
| **Phase 1**: Backend Services | ✅ Complete | `permission_version_service.go`, `permission_cache_service.go` |
| **Phase 2**: Permission Endpoint | ✅ Complete | `permission_handler.go`, routes updated |
| **Phase 3**: Frontend Provider | ✅ Complete | `permission-provider.tsx`, `permission-storage.ts` |
| **Phase 4**: Integration | ✅ Complete | `main.go` wired up, `permission-gate.tsx` |

### 10.2 Success Criteria

| Criteria | Target | Status |
|----------|--------|--------|
| Permission update latency | < 5 seconds for active users | ✅ Implemented |
| JWT token size | < 500 bytes (fixed) | ✅ With `GenerateSlimAccessToken` |
| Initial load time | No regression (instant) | ✅ localStorage cache |
| Error rate | < 0.1% | Monitoring required |
| User satisfaction | No permission-related support tickets | Monitoring required |

---

## Appendix A: File Changes Summary

### Backend Files (Implemented)

| File | Action | Description |
|------|--------|-------------|
| `api/internal/app/permission_version_service.go` | ✅ Created | Version tracking with Redis INCR |
| `api/internal/app/permission_cache_service.go` | ✅ Created | Permission cache with 5-min TTL |
| `api/internal/infra/http/middleware/permission_sync.go` | ✅ Created | Middleware for stale detection |
| `api/internal/infra/http/handler/permission_handler.go` | ✅ Created | GET /me/permissions/sync handler |
| `api/pkg/jwt/jwt.go` | ✅ Modified | Added PermVersion field, GenerateSlimAccessToken |
| `api/internal/app/role_service.go` | ✅ Modified | Added invalidation on role changes |
| `api/internal/app/tenant_service.go` | ✅ Modified | Added cache invalidation on member removal |
| `api/internal/app/session_service.go` | ✅ Modified | Added cache invalidation on session revoke |
| `api/internal/app/user_service.go` | ✅ Modified | Added session revocation on user suspend |
| `api/internal/app/tenant_membership_adapter.go` | ✅ Created | Adapter for getting user's tenant IDs |
| `api/internal/infra/http/routes.go` | ✅ Modified | Added permission handler and route |
| `api/cmd/server/main.go` | ✅ Modified | Wired up all permission services |

### Frontend Files (Implemented)

| File | Action | Description |
|------|--------|-------------|
| `ui/src/lib/permission-storage.ts` | ✅ Created | localStorage utility with TTL |
| `ui/src/context/permission-provider.tsx` | ✅ Created | Permission context with polling |
| `ui/src/components/permission-gate.tsx` | ✅ Created | Permission gate and hooks |

### Integration (Completed)

| File | Action | Description |
|------|--------|-------------|
| `ui/src/lib/api/client.ts` | ✅ Modified | X-Permission-Stale header detection |
| `ui/src/components/layout/dashboard-providers.tsx` | ✅ Modified | Added PermissionProvider |
| `ui/src/stores/auth-store.ts` | ✅ Modified | Clear permissions on logout/clearAuth |
| `ui/src/context/tenant-provider.tsx` | ✅ Modified | Clear old tenant permissions on switch |

---

## Appendix B: Cache Invalidation Triggers

### B.1 When Cache is Invalidated

| Event | Cache Invalidated | Version Action | Service |
|-------|-------------------|----------------|---------|
| Role assigned to user | ✅ User cache cleared | ⬆️ Incremented | `RoleService.AssignRole` |
| Role removed from user | ✅ User cache cleared | ⬆️ Incremented | `RoleService.RemoveRole` |
| User roles replaced | ✅ User cache cleared | ⬆️ Incremented | `RoleService.SetUserRoles` |
| Role permissions changed | ✅ All users with role | ⬆️ All affected users | `RoleService.UpdatePermissions` |
| **User removed from tenant** | ✅ User cache cleared | 🗑️ **Deleted** | `TenantService.RemoveMember` |
| **Session revoked** | ✅ All tenants cleared | ❌ Not changed | `SessionService.RevokeSession` |
| **All sessions revoked** | ✅ All tenants cleared | ❌ Not changed | `SessionService.RevokeAllSessions` |
| **User suspended** | ✅ Via session revoke | ❌ Not changed | `UserService.SuspendUser` |
| User logout (single device) | ❌ Not cleared* | ❌ Not changed | N/A |

*Single-device logout doesn't clear cache because: (1) User may have other active sessions, (2) Cache TTL is only 5 min, (3) Permission version ensures staleness detection.

### B.2 Member Removal Flow

When a user is removed from a tenant, the following happens:

```
RemoveMember()
    │
    ├─► DeleteMembership() ─► DELETE FROM tenant_members
    │                      ─► DELETE FROM user_roles (all roles)
    │
    ├─► invalidateUserPermissions()
    │       │
    │       ├─► permCacheSvc.Invalidate() ─► DEL user_perms:{tenant}:{user}
    │       │
    │       └─► permVersionSvc.Delete() ─► DEL perm_ver:{tenant}:{user}
    │
    └─► Audit log
```

### B.3 Session Revocation Flow

When a user's session is revoked (logout from all devices, or admin action), permissions are invalidated across ALL tenants:

```
RevokeSession() / RevokeAllSessions()
    │
    ├─► Update session status to "revoked"
    │
    ├─► Revoke refresh tokens
    │
    └─► invalidateUserPermissionsAllTenants()
            │
            ├─► tenantRepo.GetUserTenantIDs() ─► Get all tenants user belongs to
            │
            └─► For each tenant:
                    └─► permCacheSvc.Invalidate() ─► DEL user_perms:{tenant}:{user}
```

### B.4 User Suspension Flow

When a user is suspended, all their sessions are immediately revoked to block access:

```
SuspendUser()
    │
    ├─► u.Suspend() ─► Set user status to "suspended"
    │
    ├─► repo.Update() ─► Save to database
    │
    └─► sessionService.RevokeAllSessions()
            │
            ├─► Revoke all sessions (no exception)
            │
            ├─► Revoke all refresh tokens
            │
            └─► invalidateUserPermissionsAllTenants()
                    └─► Clear cache for all tenants
```

**Security Timeline After User Suspension:**

```
0 ─────────────────────────────────────────────────────────── 15 min
│                                                              │
│ ✅ User status set to "suspended" in DB                      │
│ ✅ All sessions revoked immediately                          │
│ ✅ All refresh tokens revoked                                │
│ ✅ Permission cache cleared for all tenants                  │
│                                                              │
│ If suspended user tries to access:                           │
│   - Session validation fails → 401 Unauthorized              │
│   - Cannot refresh token → Must re-login                     │
│   - Re-login fails → User status is "suspended"              │
│                                                              │
│                                                 Token expires │
└──────────────────────────────────────────────────────────────┘

Window of vulnerability: 0 seconds (sessions revoked immediately)
```

### B.6 Cache Key Isolation

Cache keys are scoped per-tenant, preventing cross-tenant data leaks:

```
user_perms:{tenant_a}:{user_id}  ─┐
                                  ├─► Completely isolated
user_perms:{tenant_b}:{user_id}  ─┘

# When user switches tenants, they get a new access token with new tenant_id
# Old tenant's cache is NOT accessed (different key)
```

### B.7 Security Timeline After Member Removal

```
0 ─────────────────────────────────────────────────────────── 15 min
│                                                              │
│ Cache cleared immediately (invalidateUserPermissions)        │
│ DB: user_roles deleted (no permissions in DB)                │
│                                                              │
│ If user tries to access with old token:                      │
│   - Cache miss → DB query → Empty permissions                │
│   - /me/modules returns empty → Frontend shows nothing       │
│                                                              │
│                                                 Token expires │
└──────────────────────────────────────────────────────────────┘

Window of vulnerability: 0 seconds (cache cleared immediately)
```

---

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| **Permission Version** | Integer that increments when a user's permissions change |
| **Stale Permission** | When JWT's permission version doesn't match Redis version |
| **Permission Cache** | Redis cache storing user permissions (5 min TTL) |
| **Slim JWT** | JWT without embedded permissions (~400 bytes) |
| **Permission Provider** | React context managing permission state |

---

**Document End**
