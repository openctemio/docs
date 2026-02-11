# Implementation Review - AI Triage & Real-time Updates

**Date**: 2026-02-02
**Reviewer**: Claude (PM/TechLead/Security/UX perspectives)
**Scope**: AI Triage, Finding Activity, WebSocket, Authentication

---

## Executive Summary

| Aspect | Rating | Priority Issues |
|--------|--------|-----------------|
| Architecture | ⭐⭐⭐⭐ (4/5) | Solid DDD, clean separation |
| Security | ⭐⭐⭐ (3/5) | **Critical: Authorization gap** |
| Performance | ⭐⭐⭐ (3/5) | N+1 queries in broadcasts |
| UX | ⭐⭐⭐⭐ (4/5) | Good real-time feedback |
| Code Quality | ⭐⭐⭐⭐ (4/5) | Well-structured, testable |

---

## 1. PM/Tech Lead/BA Perspective

### Strengths
- Clean Domain-Driven Design architecture
- Good separation: Handler → Service → Repository
- Async job processing with Asynq
- Real-time WebSocket integration
- Licensing/module gating

### Weaknesses
- Missing OpenAPI documentation for WebSocket events
- No feature flags for runtime toggles
- Missing monitoring/metrics for WebSocket hub
- Token usage accounting happens AFTER processing (no rollback on failure)

### Recommendations
1. Add OpenAPI specs for WebSocket message formats
2. Implement feature flags (e.g., LaunchDarkly, Unleash)
3. Add Prometheus metrics for hub health
4. Implement token pre-allocation with rollback

---

## 2. Security Expert Perspective

### CRITICAL ISSUES

#### Issue #1: Incomplete WebSocket Authorization (HIGH)

**Location**: `api/internal/infra/websocket/hub.go:64-94`

**Problem**: Authorization only checks tenant membership, not resource access permission.

```go
// CURRENT (INSECURE)
case ChannelTypeFinding:
    return client.TenantID != "" && id != ""  // Anyone in tenant can subscribe!
```

**Risk**: Any authenticated user in a tenant can subscribe to any finding's channel, potentially leaking sensitive vulnerability data.

**Fix Required**: Check user's permission to access the specific finding.

#### Issue #2: Token in Query Parameter (MEDIUM)

**Location**: Cross-origin WebSocket auth

**Problem**: Token passed via `?token=xxx` is logged in:
- Web server access logs
- Proxy logs (nginx, cloudflare)
- Browser history
- Browser developer tools

**Mitigation**: Use short-lived tokens (5 min) for WebSocket auth only.

#### Issue #3: No Rate Limiting on WebSocket (MEDIUM)

**Location**: `api/internal/infra/websocket/hub.go`

**Problem**: No limits on:
- Connections per user
- Subscriptions per client
- Messages per second

**Risk**: DoS via subscription flooding.

#### Issue #4: Missing CSRF Protection for SSE Token (LOW)

**Location**: `ui/src/app/api/auth/sse-token/route.ts`

**Problem**: SSE token endpoint returns access token without CSRF validation.

**Mitigation**: Token is already in httpOnly cookie, so risk is limited.

### Security Recommendations Matrix

| Issue | Severity | Effort | Fix |
|-------|----------|--------|-----|
| WebSocket Auth | HIGH | Medium | Add permission check |
| Token in URL | MEDIUM | Low | Use short-lived tokens |
| No Rate Limit | MEDIUM | Medium | Add rate limiter middleware |
| CSRF on SSE | LOW | Low | Add CSRF token validation |

---

## 3. User Experience Perspective

### Strengths
- Real-time updates without page refresh
- Activity feed shows who did what
- AI Triage progress visible immediately
- Automatic reconnection on disconnect

### Issues

#### Issue #1: Unknown Actor in Activity
**Status**: Fixed in this session
- Actor name/email now enriched from user table

#### Issue #2: No Loading States on WebSocket Disconnect
- Users don't see connection status
- Activities appear to "freeze" on disconnect

#### Issue #3: No Toast for AI Triage Completion
- User might miss triage completion if they scroll away

### UX Recommendations
1. Add connection status indicator (green/yellow/red dot)
2. Add toast notification on triage completion
3. Add "retry" button for failed triages
4. Show "live" indicator on activity feed

---

## 4. Database Performance Analysis

### Current Query Pattern (Activity Broadcast)

```
[Request: AI Triage]
    │
    ├─ INSERT INTO triage_results (1 query)
    │
    ├─ INSERT INTO finding_activities (1 query)
    │
    └─ BROADCAST
         └─ SELECT * FROM users WHERE id = $1 (1 query per broadcast)
```

**Problem**: Each activity broadcast does a user lookup.

### N+1 Query Scenario (Bulk Triage)

```
Bulk triage 100 findings:
  - 100 x INSERT triage_results = 100 queries
  - 100 x INSERT activities = 100 queries
  - 100 x SELECT user (for broadcast) = 100 queries
  Total: 300 queries!
```

### Optimization Recommendations

#### Option A: Cache User Lookups (Recommended)
```go
type userCache struct {
    cache map[shared.ID]*user.User
    mu    sync.RWMutex
    ttl   time.Duration
}
```

#### Option B: Batch User Lookups
```go
// In bulk operations, pre-fetch all users
userIDs := collectActorIDs(activities)
users, _ := userRepo.GetByIDs(ctx, userIDs)
userMap := indexByID(users)
```

#### Option C: Include Name in Input
```go
type RecordActivityInput struct {
    ActorID    *string
    ActorName  string  // NEW: Caller provides name
    ActorEmail string  // NEW: Caller provides email
}
```

### Query Count Comparison

| Scenario | Current | With Cache | With Batch |
|----------|---------|------------|------------|
| Single triage | 3 | 2-3 | 3 |
| Bulk 100 | 300 | 102 | 103 |
| Bulk 100 (warm cache) | 300 | 102 | 103 |

---

## 5. Implementation Plan

### Phase 1: Security Fixes (Priority: HIGH)

1. **Fix WebSocket Authorization**
   - Add permission service to hub
   - Check FindingsRead permission before subscribe
   - Log unauthorized attempts

2. **Add Rate Limiting**
   - Max 10 connections per user
   - Max 50 subscriptions per client
   - Max 100 messages/second per channel

### Phase 2: Performance Fixes (Priority: MEDIUM)

1. **Add User Cache to Activity Service**
   - Simple in-memory cache with 5-minute TTL
   - Cache invalidation on user update

2. **Batch User Lookups for Bulk Operations**
   - Pre-fetch users before broadcasting

### Phase 3: UX Improvements (Priority: LOW)

1. Add WebSocket connection status indicator
2. Add toast notifications for triage completion
3. Add "live" badge on activity feed

---

## Implementation Checklist

### Completed This Session
- [x] Fix unknown user in activity broadcasts (`finding_activity_service.go`)
- [x] Add user cache to reduce N+1 queries (`finding_activity_service.go`)
  - Simple sync.Map-based cache with 5-minute TTL
  - Cache hit avoids database query
- [x] Add rate limiting to WebSocket hub (`hub.go`, `client.go`)
  - Max 10 connections per user
  - Max 50 subscriptions per client
  - Connections over limit are immediately closed

### Remaining TODO
- [ ] Add granular permission check to WebSocket channel authorization
  - Currently checks tenant membership only
  - Should verify user has `FindingsRead` permission for that specific finding
- [ ] Add connection status UI indicator (frontend)
- [ ] Add triage completion toast notification (frontend)
- [ ] Implement message rate limiting per client (commented in code)

### Code Changes Summary

**Files Modified:**
1. `api/internal/app/finding_activity_service.go`
   - Added `userCache` struct with TTL-based caching
   - Updated `SetUserRepo` to wire user repository
   - Updated broadcast logic to use cache-first approach

2. `api/internal/infra/websocket/hub.go`
   - Added `userConnCounts` map to track connections per user
   - Added `maxConnectionsPerUser` constant (10)
   - Updated `Run()` loop to enforce connection limits
   - Connections over limit are rejected and closed

3. `api/internal/infra/websocket/client.go`
   - Added `maxSubscriptionsPerClient` constant (50)
   - Updated `Subscribe()` to check subscription limit
   - Logs warning when limits exceeded

4. `api/cmd/server/services.go`
   - Wired user repository to FindingActivityService

