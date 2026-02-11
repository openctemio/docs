---
layout: default
title: Rate Limiting Improvements
parent: Architecture
nav_order: 23
---

# Rate Limiting Improvements Plan

> Implementation plan for enhancing the rate limiting system to production-grade for multi-instance deployments.

**Status:** Planning
**Priority:** High
**Last Updated:** 2026-01-24

---

## Table of Contents

1. [Current State](#current-state)
2. [Gap Analysis](#gap-analysis)
3. [Improvement Plan](#improvement-plan)
4. [Implementation Details](#implementation-details)
5. [Migration Strategy](#migration-strategy)
6. [Testing Plan](#testing-plan)

---

## Current State

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT IMPLEMENTATION                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Request → Rate Limiter (In-Memory) → Handler                   │
│            └── Per-IP, Token Bucket                              │
│            └── 100 req/sec, burst 200                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Existing Components

| Component | Location | Status | Description |
|-----------|----------|--------|-------------|
| In-Memory Rate Limiter | `internal/infra/http/middleware/ratelimit.go` | ✅ Active | Token bucket, per-IP |
| Redis Rate Limiter | `internal/infra/redis/ratelimiter.go` | ✅ Ready | Sliding window log, distributed |
| Middleware Adapter | `internal/infra/redis/ratelimiter.go` | ✅ Ready | Bridges Redis limiter to HTTP middleware |
| Test Notification Limiter | `internal/infra/http/handler/integration_handler.go` | ✅ Active | 5 req/min per user+integration |
| Dynamic Plan Limits | `internal/app/licensing_service.go` | ✅ Active | Subscription-based limits |

### Current Configuration

```go
// internal/config/config.go
type RateLimitConfig struct {
    Enabled         bool          // RATE_LIMIT_ENABLED (default: true)
    RequestsPerSec  float64       // RATE_LIMIT_RPS (default: 100)
    Burst           int           // RATE_LIMIT_BURST (default: 200)
    CleanupInterval time.Duration // RATE_LIMIT_CLEANUP (default: 1m)
}
```

### Strengths

1. **Token Bucket Algorithm** - Efficient, allows burst traffic
2. **Standard Headers** - X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
3. **Graceful Shutdown** - Cleanup goroutines properly stopped
4. **Redis Implementation Ready** - Sliding window log with Lua scripts
5. **Fail-Open Design** - Allows requests if Redis unavailable
6. **Metrics Integration** - Prometheus compatible
7. **Test Notification Limiting** - Prevents abuse of test endpoint

---

## Gap Analysis

### Critical Issues

| Issue | Risk Level | Impact | Current State |
|-------|------------|--------|---------------|
| **Single-instance only** | High | Scale limitation | Redis limiter exists but unused |
| **No auth endpoint protection** | Critical | Brute force attacks | Same limit as regular endpoints |
| **IP spoofing vulnerability** | High | Rate limit bypass | X-Forwarded-For trusted blindly |

### Missing Features

| Feature | Priority | Description |
|---------|----------|-------------|
| Distributed rate limiting | High | Required for multi-instance deployment |
| Per-endpoint limits | Medium | Different limits for different endpoints |
| Per-user limits | Medium | Rate limit by authenticated user |
| Auth endpoint protection | Critical | Stricter limits for login/register |
| Trusted proxy validation | High | Prevent IP spoofing |
| Rate limit tiers | Low | Different limits per tenant configuration |
| Adaptive rate limiting | Low | Adjust limits based on load |

### Security Vulnerabilities

```
Current Attack Vectors:
├── Brute Force Login
│   └── No stricter limit on /auth/login endpoint
│   └── Attacker can try 100 passwords/second
│
├── IP Spoofing
│   └── X-Forwarded-For header trusted without validation
│   └── Attacker can bypass rate limit by rotating fake IPs
│
└── Credential Stuffing
    └── No per-user rate limiting
    └── Attacker can target multiple users from same IP
```

---

## Improvement Plan

### Phase 1: Critical Security (Week 1)

**Goal:** Protect authentication endpoints from brute force attacks.

```
Priority: CRITICAL
Effort: 2-3 days
Risk: Low (backward compatible)
```

**Tasks:**

1. Add auth-specific rate limiter configuration
2. Create stricter limits for auth endpoints:
   - `/api/v1/auth/login` - 5 req/min per IP
   - `/api/v1/auth/register` - 3 req/min per IP
   - `/api/v1/auth/forgot-password` - 3 req/min per IP
   - `/api/v1/auth/refresh` - 30 req/min per IP
3. Add failed login tracking (lock after 5 failures)
4. Implement trusted proxy validation

### Phase 2: Distributed Rate Limiting (Week 2)

**Goal:** Enable horizontal scaling with Redis-based rate limiting.

```
Priority: HIGH
Effort: 3-4 days
Risk: Medium (requires Redis)
```

**Tasks:**

1. Wire Redis rate limiter into server.go
2. Add configuration for Redis vs in-memory selection
3. Implement fallback to in-memory when Redis unavailable
4. Add per-user rate limiting for authenticated requests
5. Update monitoring/alerting

### Phase 3: Advanced Features (Week 3-4)

**Goal:** Fine-grained rate limiting and observability.

```
Priority: MEDIUM
Effort: 5-7 days
Risk: Low
```

**Tasks:**

1. Per-endpoint rate limit configuration
2. Rate limit tiers based on tenant configuration
3. Rate limit dashboard/metrics
4. Admin API to view/reset rate limits
5. Rate limit exemption for internal services

---

## Implementation Details

### Phase 1: Auth Endpoint Protection

#### 1.1 Configuration Changes

```go
// internal/config/config.go

type RateLimitConfig struct {
    // Global settings
    Enabled         bool          `mapstructure:"enabled"`
    RequestsPerSec  float64       `mapstructure:"requests_per_sec"`
    Burst           int           `mapstructure:"burst"`
    CleanupInterval time.Duration `mapstructure:"cleanup_interval"`

    // NEW: Auth endpoint settings
    Auth AuthRateLimitConfig `mapstructure:"auth"`

    // NEW: Trusted proxy settings
    TrustedProxies []string `mapstructure:"trusted_proxies"`
}

type AuthRateLimitConfig struct {
    LoginLimit          int           `mapstructure:"login_limit"`           // 5
    LoginWindow         time.Duration `mapstructure:"login_window"`          // 1m
    RegisterLimit       int           `mapstructure:"register_limit"`        // 3
    RegisterWindow      time.Duration `mapstructure:"register_window"`       // 1m
    ForgotPasswordLimit int           `mapstructure:"forgot_password_limit"` // 3
    ForgotPasswordWindow time.Duration `mapstructure:"forgot_password_window"` // 5m
    MaxFailedAttempts   int           `mapstructure:"max_failed_attempts"`   // 5
    LockoutDuration     time.Duration `mapstructure:"lockout_duration"`      // 15m
}
```

#### 1.2 Environment Variables

```bash
# Auth rate limiting
RATE_LIMIT_AUTH_LOGIN_LIMIT=5
RATE_LIMIT_AUTH_LOGIN_WINDOW=1m
RATE_LIMIT_AUTH_REGISTER_LIMIT=3
RATE_LIMIT_AUTH_REGISTER_WINDOW=1m
RATE_LIMIT_AUTH_FORGOT_PASSWORD_LIMIT=3
RATE_LIMIT_AUTH_FORGOT_PASSWORD_WINDOW=5m
RATE_LIMIT_AUTH_MAX_FAILED_ATTEMPTS=5
RATE_LIMIT_AUTH_LOCKOUT_DURATION=15m

# Trusted proxies (comma-separated CIDRs)
RATE_LIMIT_TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
```

#### 1.3 Auth Rate Limiter

```go
// internal/infra/http/middleware/auth_ratelimit.go

package middleware

import (
    "net/http"
    "sync"
    "time"

    "github.com/openctemio/api/internal/config"
    "github.com/openctemio/api/pkg/apierror"
    "github.com/openctemio/api/pkg/logger"
)

// AuthRateLimiter provides rate limiting for authentication endpoints
// with additional protection against brute force attacks.
type AuthRateLimiter struct {
    cfg     *config.AuthRateLimitConfig
    log     *logger.Logger

    // Per-endpoint limiters
    login          *EndpointLimiter
    register       *EndpointLimiter
    forgotPassword *EndpointLimiter

    // Failed login tracking
    failedAttempts map[string]*FailedAttempt
    failedMu       sync.RWMutex

    done    chan struct{}
    stopped chan struct{}
}

type FailedAttempt struct {
    Count     int
    FirstFail time.Time
    LockedAt  *time.Time
}

type EndpointLimiter struct {
    requests map[string][]time.Time
    mu       sync.Mutex
    limit    int
    window   time.Duration
}

func NewAuthRateLimiter(cfg *config.AuthRateLimitConfig, log *logger.Logger) *AuthRateLimiter {
    rl := &AuthRateLimiter{
        cfg:            cfg,
        log:            log,
        login:          newEndpointLimiter(cfg.LoginLimit, cfg.LoginWindow),
        register:       newEndpointLimiter(cfg.RegisterLimit, cfg.RegisterWindow),
        forgotPassword: newEndpointLimiter(cfg.ForgotPasswordLimit, cfg.ForgotPasswordWindow),
        failedAttempts: make(map[string]*FailedAttempt),
        done:           make(chan struct{}),
        stopped:        make(chan struct{}),
    }

    go rl.cleanup()
    return rl
}

// LoginMiddleware rate limits login attempts with lockout support.
func (rl *AuthRateLimiter) LoginMiddleware() func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            ip := getClientIP(r)

            // Check if IP is locked out
            if rl.isLockedOut(ip) {
                rl.log.Warn("login attempt from locked out IP",
                    "ip", ip,
                    "request_id", GetRequestID(r.Context()),
                )
                w.Header().Set("Retry-After", "900") // 15 minutes
                apierror.TooManyFailedAttempts().WriteJSON(w)
                return
            }

            // Check rate limit
            if !rl.login.allow(ip) {
                rl.log.Warn("login rate limit exceeded",
                    "ip", ip,
                    "request_id", GetRequestID(r.Context()),
                )
                w.Header().Set("Retry-After", "60")
                apierror.RateLimitExceeded().WriteJSON(w)
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}

// RecordFailedLogin records a failed login attempt.
// Call this from the login handler when authentication fails.
func (rl *AuthRateLimiter) RecordFailedLogin(ip string) bool {
    rl.failedMu.Lock()
    defer rl.failedMu.Unlock()

    fa, exists := rl.failedAttempts[ip]
    if !exists {
        fa = &FailedAttempt{
            Count:     0,
            FirstFail: time.Now(),
        }
        rl.failedAttempts[ip] = fa
    }

    fa.Count++

    if fa.Count >= rl.cfg.MaxFailedAttempts {
        now := time.Now()
        fa.LockedAt = &now
        rl.log.Warn("IP locked out due to failed login attempts",
            "ip", ip,
            "attempts", fa.Count,
        )
        return true // locked
    }

    return false // not locked
}

// RecordSuccessfulLogin clears failed attempt tracking for an IP.
func (rl *AuthRateLimiter) RecordSuccessfulLogin(ip string) {
    rl.failedMu.Lock()
    defer rl.failedMu.Unlock()
    delete(rl.failedAttempts, ip)
}

func (rl *AuthRateLimiter) isLockedOut(ip string) bool {
    rl.failedMu.RLock()
    defer rl.failedMu.RUnlock()

    fa, exists := rl.failedAttempts[ip]
    if !exists || fa.LockedAt == nil {
        return false
    }

    // Check if lockout has expired
    if time.Since(*fa.LockedAt) > rl.cfg.LockoutDuration {
        return false
    }

    return true
}

// RegisterMiddleware rate limits registration attempts.
func (rl *AuthRateLimiter) RegisterMiddleware() func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            ip := getClientIP(r)

            if !rl.register.allow(ip) {
                rl.log.Warn("register rate limit exceeded",
                    "ip", ip,
                    "request_id", GetRequestID(r.Context()),
                )
                w.Header().Set("Retry-After", "60")
                apierror.RateLimitExceeded().WriteJSON(w)
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}

// ForgotPasswordMiddleware rate limits password reset requests.
func (rl *AuthRateLimiter) ForgotPasswordMiddleware() func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            ip := getClientIP(r)

            if !rl.forgotPassword.allow(ip) {
                rl.log.Warn("forgot password rate limit exceeded",
                    "ip", ip,
                    "request_id", GetRequestID(r.Context()),
                )
                w.Header().Set("Retry-After", "300")
                apierror.RateLimitExceeded().WriteJSON(w)
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}

func (rl *AuthRateLimiter) Stop() {
    close(rl.done)
    <-rl.stopped
}

func (rl *AuthRateLimiter) cleanup() {
    ticker := time.NewTicker(time.Minute)
    defer ticker.Stop()
    defer close(rl.stopped)

    for {
        select {
        case <-rl.done:
            return
        case <-ticker.C:
            rl.cleanupFailedAttempts()
            rl.login.cleanup()
            rl.register.cleanup()
            rl.forgotPassword.cleanup()
        }
    }
}

func (rl *AuthRateLimiter) cleanupFailedAttempts() {
    rl.failedMu.Lock()
    defer rl.failedMu.Unlock()

    for ip, fa := range rl.failedAttempts {
        // Remove if lockout expired or no recent failures
        if fa.LockedAt != nil && time.Since(*fa.LockedAt) > rl.cfg.LockoutDuration {
            delete(rl.failedAttempts, ip)
        } else if fa.LockedAt == nil && time.Since(fa.FirstFail) > rl.cfg.LoginWindow {
            delete(rl.failedAttempts, ip)
        }
    }
}

// EndpointLimiter helper functions
func newEndpointLimiter(limit int, window time.Duration) *EndpointLimiter {
    return &EndpointLimiter{
        requests: make(map[string][]time.Time),
        limit:    limit,
        window:   window,
    }
}

func (el *EndpointLimiter) allow(key string) bool {
    el.mu.Lock()
    defer el.mu.Unlock()

    now := time.Now()
    windowStart := now.Add(-el.window)

    // Filter to only requests within window
    reqs := el.requests[key]
    var valid []time.Time
    for _, t := range reqs {
        if t.After(windowStart) {
            valid = append(valid, t)
        }
    }

    if len(valid) >= el.limit {
        el.requests[key] = valid
        return false
    }

    el.requests[key] = append(valid, now)
    return true
}

func (el *EndpointLimiter) cleanup() {
    el.mu.Lock()
    defer el.mu.Unlock()

    now := time.Now()
    for key, reqs := range el.requests {
        var valid []time.Time
        for _, t := range reqs {
            if now.Sub(t) < el.window {
                valid = append(valid, t)
            }
        }
        if len(valid) == 0 {
            delete(el.requests, key)
        } else {
            el.requests[key] = valid
        }
    }
}
```

#### 1.4 Trusted Proxy Validation

```go
// internal/infra/http/middleware/trusted_proxy.go

package middleware

import (
    "net"
    "net/http"
    "strings"
)

// TrustedProxyConfig configures trusted proxy validation.
type TrustedProxyConfig struct {
    // TrustedProxies is a list of trusted proxy CIDRs.
    // If empty, X-Forwarded-For is trusted from any source (not recommended).
    TrustedProxies []string

    // parsed CIDRs
    trustedNets []*net.IPNet
}

// NewTrustedProxyConfig creates a new trusted proxy configuration.
func NewTrustedProxyConfig(proxies []string) (*TrustedProxyConfig, error) {
    cfg := &TrustedProxyConfig{
        TrustedProxies: proxies,
        trustedNets:    make([]*net.IPNet, 0, len(proxies)),
    }

    for _, cidr := range proxies {
        _, network, err := net.ParseCIDR(cidr)
        if err != nil {
            // Try as single IP
            ip := net.ParseIP(cidr)
            if ip == nil {
                return nil, fmt.Errorf("invalid proxy CIDR or IP: %s", cidr)
            }
            // Convert single IP to /32 or /128
            bits := 32
            if ip.To4() == nil {
                bits = 128
            }
            _, network, _ = net.ParseCIDR(fmt.Sprintf("%s/%d", cidr, bits))
        }
        cfg.trustedNets = append(cfg.trustedNets, network)
    }

    return cfg, nil
}

// GetClientIP extracts the real client IP, respecting trusted proxies.
func (cfg *TrustedProxyConfig) GetClientIP(r *http.Request) string {
    // Get direct connection IP
    remoteIP := getIPFromAddr(r.RemoteAddr)

    // If no trusted proxies configured, don't trust forwarded headers
    if len(cfg.trustedNets) == 0 {
        return remoteIP
    }

    // Check if direct connection is from trusted proxy
    if !cfg.isTrusted(remoteIP) {
        return remoteIP
    }

    // Trust X-Real-IP from trusted proxy
    if xrip := r.Header.Get("X-Real-IP"); xrip != "" {
        return strings.TrimSpace(xrip)
    }

    // Trust X-Forwarded-For from trusted proxy
    if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
        // Take the first (client) IP
        if idx := strings.Index(xff, ","); idx != -1 {
            return strings.TrimSpace(xff[:idx])
        }
        return strings.TrimSpace(xff)
    }

    return remoteIP
}

func (cfg *TrustedProxyConfig) isTrusted(ip string) bool {
    parsedIP := net.ParseIP(ip)
    if parsedIP == nil {
        return false
    }

    for _, network := range cfg.trustedNets {
        if network.Contains(parsedIP) {
            return true
        }
    }

    return false
}

func getIPFromAddr(addr string) string {
    // Remove port if present
    if idx := strings.LastIndex(addr, ":"); idx != -1 {
        // Check if it's IPv6 [::1]:port format
        if strings.Contains(addr, "[") {
            addr = strings.TrimPrefix(addr, "[")
            if idx := strings.Index(addr, "]"); idx != -1 {
                return addr[:idx]
            }
        }
        return addr[:idx]
    }
    return addr
}
```

#### 1.5 Route Registration

```go
// internal/infra/http/handler/auth_handler.go (updated)

func (h *AuthHandler) RegisterRoutes(r chi.Router, authRateLimiter *middleware.AuthRateLimiter) {
    r.Route("/auth", func(r chi.Router) {
        // Apply auth-specific rate limiting
        r.With(authRateLimiter.LoginMiddleware()).Post("/login", h.Login)
        r.With(authRateLimiter.RegisterMiddleware()).Post("/register", h.Register)
        r.With(authRateLimiter.ForgotPasswordMiddleware()).Post("/forgot-password", h.ForgotPassword)

        // Standard rate limiting for other auth endpoints
        r.Post("/refresh", h.Refresh)
        r.Post("/logout", h.Logout)
    })
}
```

### Phase 2: Distributed Rate Limiting

#### 2.1 Configuration Changes

```go
// internal/config/config.go

type RateLimitConfig struct {
    Enabled         bool          `mapstructure:"enabled"`
    RequestsPerSec  float64       `mapstructure:"requests_per_sec"`
    Burst           int           `mapstructure:"burst"`
    CleanupInterval time.Duration `mapstructure:"cleanup_interval"`

    // NEW: Distributed settings
    Distributed DistributedRateLimitConfig `mapstructure:"distributed"`

    Auth           AuthRateLimitConfig `mapstructure:"auth"`
    TrustedProxies []string            `mapstructure:"trusted_proxies"`
}

type DistributedRateLimitConfig struct {
    Enabled    bool          `mapstructure:"enabled"`    // Use Redis instead of in-memory
    KeyPrefix  string        `mapstructure:"key_prefix"` // "ratelimit:api"
    Limit      int           `mapstructure:"limit"`      // Requests per window
    Window     time.Duration `mapstructure:"window"`     // Window duration
    FailOpen   bool          `mapstructure:"fail_open"`  // Allow if Redis unavailable
}
```

#### 2.2 Environment Variables

```bash
# Distributed rate limiting
RATE_LIMIT_DISTRIBUTED_ENABLED=true
RATE_LIMIT_DISTRIBUTED_KEY_PREFIX=ratelimit:api
RATE_LIMIT_DISTRIBUTED_LIMIT=100
RATE_LIMIT_DISTRIBUTED_WINDOW=1m
RATE_LIMIT_DISTRIBUTED_FAIL_OPEN=true
```

#### 2.3 Server Integration

```go
// internal/infra/http/server.go (updated)

func NewServer(cfg *config.Config, redisClient *redis.Client, log *logger.Logger, opts ...ServerOption) *Server {
    s := &Server{
        config: cfg,
        logger: log,
    }

    // Apply options
    for _, opt := range opts {
        opt(s)
    }

    if s.router == nil {
        s.router = NewChiRouter()
    }

    // Create rate limiter based on configuration
    var rateLimitMw func(http.Handler) http.Handler
    var rateLimitStop func()

    if cfg.RateLimit.Distributed.Enabled && redisClient != nil {
        // Use distributed Redis rate limiter
        rl, err := redisinfra.NewRateLimiter(
            redisClient,
            cfg.RateLimit.Distributed.KeyPrefix,
            cfg.RateLimit.Distributed.Limit,
            cfg.RateLimit.Distributed.Window,
            log,
        )
        if err != nil {
            log.Warn("failed to create distributed rate limiter, falling back to in-memory",
                "error", err,
            )
            rateLimitMw, rateLimitStop = middleware.RateLimitWithStop(&cfg.RateLimit, log)
        } else {
            adapter := redisinfra.NewMiddlewareAdapter(rl)
            rateLimitMw = middleware.DistributedRateLimit(middleware.DistributedRateLimitConfig{
                Limiter: adapter,
                Logger:  log,
            })
            rateLimitStop = func() {} // Redis limiter doesn't need cleanup
        }
    } else {
        // Use in-memory rate limiter
        rateLimitMw, rateLimitStop = middleware.RateLimitWithStop(&cfg.RateLimit, log)
    }

    s.cleanupFuncs = append(s.cleanupFuncs, rateLimitStop)

    // ... rest of middleware chain
}
```

### Phase 3: Per-User Rate Limiting

#### 3.1 User-Based Key Function

```go
// internal/infra/http/middleware/ratelimit.go (add)

// UserAwareRateLimitConfig for per-user rate limiting.
type UserAwareRateLimitConfig struct {
    Limiter            *redisinfra.MiddlewareAdapter
    Logger             *logger.Logger
    AuthenticatedLimit int // Higher limit for authenticated users
    AnonymousLimit     int // Lower limit for anonymous users
}

// UserAwareRateLimit applies different limits based on authentication.
func UserAwareRateLimit(cfg UserAwareRateLimitConfig) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            var key string
            var limit int

            if userID := GetUserID(r.Context()); userID != "" {
                // Authenticated: rate limit by user ID
                key = "user:" + userID
                limit = cfg.AuthenticatedLimit
            } else {
                // Anonymous: rate limit by IP
                key = "ip:" + getClientIP(r)
                limit = cfg.AnonymousLimit
            }

            // TODO: Create dynamic limiter with different limits
            // or use AllowN with calculated tokens

            result, err := cfg.Limiter.Allow(r.Context(), key)
            if err != nil {
                // Fail open
                next.ServeHTTP(w, r)
                return
            }

            // Set headers and handle result...
        })
    }
}
```

---

## Migration Strategy

### Pre-Migration Checklist

- [ ] Redis cluster deployed and accessible
- [ ] Rate limit configuration values determined
- [ ] Monitoring/alerting configured
- [ ] Load testing completed
- [ ] Rollback plan documented

### Deployment Steps

#### Phase 1: Auth Rate Limiting (No downtime)

```bash
# 1. Deploy new code with auth rate limiter disabled
RATE_LIMIT_AUTH_LOGIN_LIMIT=0  # Disabled

# 2. Monitor for errors

# 3. Enable auth rate limiting
RATE_LIMIT_AUTH_LOGIN_LIMIT=5
RATE_LIMIT_AUTH_LOGIN_WINDOW=1m

# 4. Monitor failed login tracking
```

#### Phase 2: Distributed Rate Limiting

```bash
# 1. Deploy with distributed disabled (in-memory still active)
RATE_LIMIT_DISTRIBUTED_ENABLED=false

# 2. Enable distributed in canary/staging
RATE_LIMIT_DISTRIBUTED_ENABLED=true
RATE_LIMIT_DISTRIBUTED_FAIL_OPEN=true

# 3. Monitor Redis metrics and error rates

# 4. Roll out to production gradually
```

### Rollback Plan

```bash
# Immediate rollback for any issues
RATE_LIMIT_DISTRIBUTED_ENABLED=false

# This falls back to in-memory rate limiting
# No data loss or service interruption
```

---

## Testing Plan

### Unit Tests

```go
// internal/infra/http/middleware/auth_ratelimit_test.go

func TestAuthRateLimiter_LoginLimit(t *testing.T) {
    cfg := &config.AuthRateLimitConfig{
        LoginLimit:  5,
        LoginWindow: time.Minute,
    }
    rl := NewAuthRateLimiter(cfg, logger.NewNop())
    defer rl.Stop()

    // Should allow first 5 requests
    for i := 0; i < 5; i++ {
        req := httptest.NewRequest("POST", "/auth/login", nil)
        req.RemoteAddr = "192.168.1.1:12345"

        rr := httptest.NewRecorder()
        handler := rl.LoginMiddleware()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            w.WriteHeader(http.StatusOK)
        }))
        handler.ServeHTTP(rr, req)

        assert.Equal(t, http.StatusOK, rr.Code)
    }

    // 6th request should be rate limited
    req := httptest.NewRequest("POST", "/auth/login", nil)
    req.RemoteAddr = "192.168.1.1:12345"

    rr := httptest.NewRecorder()
    handler := rl.LoginMiddleware()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
    }))
    handler.ServeHTTP(rr, req)

    assert.Equal(t, http.StatusTooManyRequests, rr.Code)
}

func TestAuthRateLimiter_Lockout(t *testing.T) {
    cfg := &config.AuthRateLimitConfig{
        LoginLimit:        5,
        LoginWindow:       time.Minute,
        MaxFailedAttempts: 3,
        LockoutDuration:   time.Minute,
    }
    rl := NewAuthRateLimiter(cfg, logger.NewNop())
    defer rl.Stop()

    ip := "192.168.1.1"

    // Record 3 failed attempts
    for i := 0; i < 3; i++ {
        locked := rl.RecordFailedLogin(ip)
        if i < 2 {
            assert.False(t, locked)
        } else {
            assert.True(t, locked)
        }
    }

    // Should be locked out
    assert.True(t, rl.isLockedOut(ip))
}
```

### Integration Tests

```go
// internal/infra/http/handler/auth_handler_test.go

func TestLoginRateLimit_Integration(t *testing.T) {
    // Setup test server with auth rate limiter
    srv := setupTestServer(t)

    // Make 5 login requests
    for i := 0; i < 5; i++ {
        resp, err := http.Post(srv.URL+"/api/v1/auth/login", "application/json",
            strings.NewReader(`{"email":"test@test.com","password":"wrong"}`))
        require.NoError(t, err)
        assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
    }

    // 6th request should be rate limited
    resp, err := http.Post(srv.URL+"/api/v1/auth/login", "application/json",
        strings.NewReader(`{"email":"test@test.com","password":"wrong"}`))
    require.NoError(t, err)
    assert.Equal(t, http.StatusTooManyRequests, resp.StatusCode)
    assert.NotEmpty(t, resp.Header.Get("Retry-After"))
}
```

### Load Tests

```bash
# Using k6 for load testing

# Test 1: Normal traffic pattern
k6 run --vus 50 --duration 5m scripts/load-test-normal.js

# Test 2: Burst traffic
k6 run --vus 200 --duration 1m scripts/load-test-burst.js

# Test 3: Auth endpoint abuse simulation
k6 run --vus 10 --duration 5m scripts/load-test-auth.js
```

---

## Monitoring & Alerting

### Metrics to Track

```yaml
# Prometheus metrics

# Rate limit hits
rate_limit_total{endpoint, status="allowed|rejected"}

# Failed login attempts
auth_failed_login_total{ip_hash}

# IP lockouts
auth_lockout_total

# Redis rate limiter health
redis_rate_limit_errors_total
redis_rate_limit_latency_seconds
```

### Alerts

```yaml
# High rate limit rejection rate
- alert: HighRateLimitRejection
  expr: sum(rate(rate_limit_total{status="rejected"}[5m])) / sum(rate(rate_limit_total[5m])) > 0.1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: High rate of rate limit rejections

# Potential brute force attack
- alert: PotentialBruteForce
  expr: sum(rate(auth_failed_login_total[5m])) > 100
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: Potential brute force attack detected

# Redis rate limiter unavailable
- alert: RedisRateLimiterDown
  expr: sum(rate(redis_rate_limit_errors_total[5m])) > 10
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: Redis rate limiter experiencing errors
```

---

## Summary

| Phase | Priority | Effort | Deliverables |
|-------|----------|--------|--------------|
| **Phase 1** | Critical | 2-3 days | Auth endpoint protection, trusted proxy |
| **Phase 2** | High | 3-4 days | Distributed rate limiting with Redis |
| **Phase 3** | Medium | 5-7 days | Per-user limits, dashboard, admin API |

**Total Estimated Effort:** 10-14 days

**Risk Assessment:**
- Phase 1: Low risk (additive, backward compatible)
- Phase 2: Medium risk (requires Redis, has fallback)
- Phase 3: Low risk (enhancements only)

---

## References

- [OWASP Rate Limiting](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)
- [Token Bucket Algorithm](https://en.wikipedia.org/wiki/Token_bucket)
- [Sliding Window Log Algorithm](https://blog.cloudflare.com/counting-things-a-lot-of-different-things/)
- [Redis Rate Limiting Best Practices](https://redis.io/docs/manual/patterns/rate-limiter/)
